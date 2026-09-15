import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createServer } from '../src/server.js';
import type { ServerContext } from '../src/server.js';
import type { RedactionEntry } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.resolve(__dirname, '../data/test-tmp');

function getTempDbPath(): string {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  return path.join(TEST_DIR, `test-retention-${randomUUID()}.db`);
}

function cleanupDb(dbPath: string): void {
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const wal = `${dbPath}-wal`;
    const shm = `${dbPath}-shm`;
    if (fs.existsSync(wal)) fs.unlinkSync(wal);
    if (fs.existsSync(shm)) fs.unlinkSync(shm);
  } catch {
    // ignore
  }
}

describe('D3 — Retention, Scheduled Sweep & Local Purge Verification', () => {
  let ctx: ServerContext;
  let server: http.Server;
  let baseUrl: string;
  let dbPath: string;

  before(async () => {
    dbPath = getTempDbPath();
    ctx = createServer(dbPath);
    server = http.createServer(ctx.app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    ctx.db.close();
    cleanupDb(dbPath);
  });

  test('POST /api/retention/purge: seeds audit records, purges, asserts zero remain and exactly one purge event exists', async () => {
    const convId = 999;
    const mockRemovals: RedactionEntry[] = [
      {
        id: 'rem-p1',
        utteranceId: 1,
        clusterId: 'SPEAKER_2',
        speakerName: 'Unknown Diner',
        category: 'UNCONSENTED_SPEAKER',
        reason: 'Unconsented speaker suppressed by absence',
        span: [0, 30],
        charCount: 30,
        wordCount: 6,
        replacementText: '[REDACTED: UNCONSENTED SPEAKER]'
      },
      {
        id: 'rem-p2',
        utteranceId: 2,
        clusterId: 'SPEAKER_1',
        speakerName: 'Bob',
        category: 'THIRD_PARTY_PII',
        reason: 'Redacted email address',
        span: [15, 42],
        charCount: 27,
        wordCount: 1,
        replacementText: '[REDACTED: PII]'
      }
    ];

    // Seed audit records in SQLite
    ctx.db.saveAuditRecords(convId, mockRemovals);
    const storedBefore = ctx.db.getAuditRecords(convId);
    assert.strictEqual(storedBefore.length, 2);

    // Call POST /api/retention/purge
    const res = await fetch(`${baseUrl}/api/retention/purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: convId })
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.conversationId, convId);
    assert.strictEqual(body.deletedAuditRecords, 2);

    // Assert zero audit records remain for that conversation
    const storedAfter = ctx.db.getAuditRecords(convId);
    assert.strictEqual(storedAfter.length, 0);

    // Assert that the events table contains EXACTLY one purge event for this conversation
    const allEvents = ctx.db.listEvents(100);
    const purgeEvents = allEvents.filter(
      (e) => e.conversationId === convId && e.kind === 'PURGE'
    );
    assert.strictEqual(purgeEvents.length, 1, 'Events table must record exactly one purge event');
    assert.ok(purgeEvents[0].detail?.includes('Purged 2 stored audit records'));
  });

  test('POST /api/retention/purge: rejects invalid conversationId with 400', async () => {
    const res = await fetch(`${baseUrl}/api/retention/purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: 'invalid-id' })
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.code, 'INVALID_CONVERSATION_ID');
  });

  test('POST /api/retention/sweep: deletes expired audit records honoring retention days', async () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Seed records older than 30 days (40 days ago) for conversation 888
    const oldRemovals: RedactionEntry[] = [
      {
        id: 'rem-old-1',
        utteranceId: 10,
        clusterId: 'SPEAKER_2',
        speakerName: 'Unknown',
        category: 'UNCONSENTED_SPEAKER',
        reason: 'Old unconsented speech',
        span: [0, 20],
        charCount: 20,
        wordCount: 4,
        replacementText: '[REDACTED: UNCONSENTED SPEAKER]'
      }
    ];
    ctx.db.saveAuditRecords(888, oldRemovals, now - 40 * dayMs);

    // Seed recent records (5 days ago) for conversation 777
    const recentRemovals: RedactionEntry[] = [
      {
        id: 'rem-recent-1',
        utteranceId: 20,
        clusterId: 'SPEAKER_1',
        speakerName: 'Bob',
        category: 'THIRD_PARTY_PII',
        reason: 'Recent email',
        span: [0, 15],
        charCount: 15,
        wordCount: 1,
        replacementText: '[REDACTED: PII]'
      }
    ];
    ctx.db.saveAuditRecords(777, recentRemovals, now - 5 * dayMs);

    // Run sweep with 30 days retention
    const res = await fetch(`${baseUrl}/api/retention/sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays: 30 })
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.sweptAuditRecords, 1);

    // Assert conversation 888 records swept
    assert.strictEqual(ctx.db.getAuditRecords(888).length, 0);

    // Assert conversation 777 records preserved
    assert.strictEqual(ctx.db.getAuditRecords(777).length, 1);
  });

  test('GET and POST /api/retention/config: reads and updates retention days with validation', async () => {
    // Read initial config
    const getRes = await fetch(`${baseUrl}/api/retention/config`);
    assert.strictEqual(getRes.status, 200);
    const getBody = (await getRes.json()) as any;
    assert.strictEqual(typeof getBody.retentionDays, 'number');

    // Update config
    const postRes = await fetch(`${baseUrl}/api/retention/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays: 14 })
    });
    assert.strictEqual(postRes.status, 200);
    const postBody = (await postRes.json()) as any;
    assert.strictEqual(postBody.retentionDays, 14);

    // Reject non-positive number
    const badRes = await fetch(`${baseUrl}/api/retention/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays: 0 })
    });
    assert.strictEqual(badRes.status, 400);
    const badBody = (await badRes.json()) as any;
    assert.strictEqual(badBody.code, 'INVALID_RETENTION_DAYS');
  });
});

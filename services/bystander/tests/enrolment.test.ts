import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createServer } from '../src/server.js';
import type { ServerContext } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.resolve(__dirname, '../data/test-tmp');

function getTempDbPath(): string {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  return path.join(TEST_DIR, `test-enrol-${randomUUID()}.db`);
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

describe('D2 — Enrolment Flow, Validation & Gating Flip', () => {
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

  test('POST /api/consent/enrol: enrolling with status "MAYBE" must 400', async () => {
    const res = await fetch(`${baseUrl}/api/consent/enrol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clusterId: 'SPEAKER_9',
        name: 'Eve',
        role: 'PARTICIPANT',
        status: 'MAYBE'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.code, 'INVALID_STATUS');
    assert.ok(body.error.includes('MAYBE'));
  });

  test('POST /api/consent/enrol: rejects invalid role with 400 and machine-readable code', async () => {
    const res = await fetch(`${baseUrl}/api/consent/enrol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clusterId: 'SPEAKER_9',
        name: 'Eve',
        role: 'OBSERVER', // Invalid
        status: 'CONSENTED'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = (await res.json()) as any;
    assert.strictEqual(body.code, 'INVALID_ROLE');
  });

  test('POST /api/consent/enrol: successfully enrols participant and logs event', async () => {
    const res = await fetch(`${baseUrl}/api/consent/enrol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clusterId: 'SPEAKER_5',
        name: 'Grace',
        role: 'PARTICIPANT',
        status: 'CONSENTED',
        notes: 'Enrolled collaborator'
      })
    });

    assert.strictEqual(res.status, 201);
    const body = (await res.json()) as any;
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.participant.clusterId, 'SPEAKER_5');
    assert.strictEqual(body.participant.name, 'Grace');
    assert.strictEqual(body.participant.status, 'CONSENTED');

    // Verify events log has entry
    const eventsRes = await fetch(`${baseUrl}/api/events`);
    const eventsBody = (await eventsRes.json()) as any;
    const enrolEvent = eventsBody.events.find((e: any) => e.clusterId === 'SPEAKER_5');
    assert.ok(enrolEvent, 'Event log must contain enrolment event');
    assert.strictEqual(enrolEvent.kind, 'CONSENT_ENROL');
  });

  test('PATCH /api/consent/:clusterId: updates status and notes', async () => {
    const res = await fetch(`${baseUrl}/api/consent/SPEAKER_5`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'REVOKED',
        notes: 'Consent withdrawn verbally'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.participant.status, 'REVOKED');
    assert.strictEqual(body.participant.notes, 'Consent withdrawn verbally');
  });

  test('Un-enrolling a CONSENTED cluster flips pipeline for that conversation to REFUSED', async () => {
    // Clean up temporary participant from previous test
    ctx.ledger.unenrol('SPEAKER_5');

    // 1. In fixture 101, SPEAKER_0 (Alice) and SPEAKER_1 (Bob) are initially CONSENTED.
    // Ensure both are set to CONSENTED.
    ctx.ledger.setConsent('SPEAKER_0', 'Alice', 'WEARER', 'CONSENTED');
    ctx.ledger.setConsent('SPEAKER_1', 'Bob', 'PARTICIPANT', 'CONSENTED');

    // Check pipeline 101 initial state: NOT refused
    const initialPipelineRes = await fetch(`${baseUrl}/api/pipeline/101`);
    assert.strictEqual(initialPipelineRes.status, 200);
    const initialPipeline = (await initialPipelineRes.json()) as any;
    assert.strictEqual(initialPipeline.refusal.refused, false);
    assert.notStrictEqual(initialPipeline.summary, null);

    // 2. Un-enrol SPEAKER_1 (Bob) via DELETE
    const deleteRes = await fetch(`${baseUrl}/api/consent/SPEAKER_1`, {
      method: 'DELETE'
    });
    assert.strictEqual(deleteRes.status, 200);
    const deleteBody = (await deleteRes.json()) as any;
    assert.strictEqual(deleteBody.status, 'UNKNOWN');

    // Assert that status in ledger is strictly UNKNOWN
    assert.strictEqual(ctx.ledger.getStatus('SPEAKER_1'), 'UNKNOWN');
    assert.strictEqual(ctx.ledger.isConsented('SPEAKER_1'), false);

    // 3. Re-evaluate pipeline 101: MUST flip to REFUSED because Bob is now an UNKNOWN cluster
    const flippedPipelineRes = await fetch(`${baseUrl}/api/pipeline/101`);
    assert.strictEqual(flippedPipelineRes.status, 200);
    const flippedPipeline = (await flippedPipelineRes.json()) as any;

    assert.strictEqual(
      flippedPipeline.refusal.refused,
      true,
      'Pipeline must flip to refused when an active speaker cluster is un-enrolled'
    );
    assert.strictEqual(flippedPipeline.refusal.code, 'REFUSAL_UNCONSENTED_PARTICIPANTS');
    assert.strictEqual(
      flippedPipeline.summary,
      null,
      'Summary must be suppressed when summarisation is refused'
    );

    // 4. Verify un-enrol event was recorded
    const eventsRes = await fetch(`${baseUrl}/api/events`);
    const eventsBody = (await eventsRes.json()) as any;
    const unenrolEvent = eventsBody.events.find(
      (e: any) => e.clusterId === 'SPEAKER_1' && e.kind === 'CONSENT_UNENROL'
    );
    assert.ok(unenrolEvent, 'Event log must contain CONSENT_UNENROL event');
  });
});

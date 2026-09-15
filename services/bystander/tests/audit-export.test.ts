import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createServer, formatAuditRecordsCsv } from '../src/server.js';
import type { ServerContext } from '../src/server.js';
import type { StoredAuditRecord } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.resolve(__dirname, '../data/test-tmp');

function getTempDbPath(): string {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  return path.join(TEST_DIR, `test-export-${randomUUID()}.db`);
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

/**
 * Standard RFC 4180 CSV line parser
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }
  fields.push(current);
  return fields;
}

describe('D6 — Audit Export (CSV & JSON format, Content-Disposition, and Comma Invariance)', () => {
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

  test('audit record whose reason contains commas and quotes survives CSV round-trip intact', () => {
    const complexRecord: StoredAuditRecord = {
      id: 'rem-complex-1',
      conversationId: 501,
      category: 'THIRD_PARTY_PII',
      clusterId: 'SPEAKER_1',
      reason: 'Third-party PII detected, scrubbed, and logged per policy (contact: "Carol, Esq.")',
      spanStart: 45,
      spanEnd: 82,
      charCount: 37,
      wordCount: 5,
      replacementText: '[REDACTED: PII]',
      createdAt: 1726380000000
    };

    const csvOutput = formatAuditRecordsCsv([complexRecord]);
    const lines = csvOutput.split(/\r?\n/).filter(Boolean);

    assert.strictEqual(lines.length, 2, 'CSV must have 1 header line and 1 data line');

    const headers = lines[0].split(',');
    assert.strictEqual(headers[0], 'id');
    assert.strictEqual(headers[4], 'reason');

    const parsedRow = parseCsvLine(lines[1]);
    assert.strictEqual(parsedRow.length, 11);
    assert.strictEqual(parsedRow[0], complexRecord.id);
    assert.strictEqual(parseInt(parsedRow[1], 10), complexRecord.conversationId);
    assert.strictEqual(parsedRow[2], complexRecord.category);
    assert.strictEqual(parsedRow[3], complexRecord.clusterId);

    // Reason with commas and quotes MUST match exactly after round-trip
    assert.strictEqual(parsedRow[4], complexRecord.reason);

    assert.strictEqual(parseInt(parsedRow[5], 10), complexRecord.spanStart);
    assert.strictEqual(parseInt(parsedRow[6], 10), complexRecord.spanEnd);
    assert.strictEqual(parseInt(parsedRow[7], 10), complexRecord.charCount);
    assert.strictEqual(parseInt(parsedRow[8], 10), complexRecord.wordCount);
    assert.strictEqual(parsedRow[9], complexRecord.replacementText);
    assert.strictEqual(parseInt(parsedRow[10], 10), complexRecord.createdAt);
  });

  test('GET /api/audit/:id/export?format=csv returns text/csv with Content-Disposition header', async () => {
    const res = await fetch(`${baseUrl}/api/audit/101/export?format=csv`);
    assert.strictEqual(res.status, 200);

    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('text/csv'), `Content-Type must be text/csv, got: ${contentType}`);

    const disposition = res.headers.get('content-disposition') || '';
    assert.strictEqual(
      disposition,
      'attachment; filename="audit-conversation-101.csv"',
      'Must set exact attachment Content-Disposition filename'
    );

    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    assert.ok(lines.length >= 2, 'CSV must have header and at least 1 record for conversation 101');

    // Absence check: CSV export must NOT contain unconsented speech or sensitive PII
    assert.strictEqual(text.includes('carol@partner-network.org'), false);
    assert.strictEqual(text.includes('555-0199'), false);
    assert.strictEqual(text.includes('originalText'), false);
  });

  test('GET /api/audit/:id/export?format=json returns application/json with Content-Disposition header', async () => {
    const res = await fetch(`${baseUrl}/api/audit/101/export?format=json`);
    assert.strictEqual(res.status, 200);

    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('application/json'));

    const disposition = res.headers.get('content-disposition') || '';
    assert.strictEqual(
      disposition,
      'attachment; filename="audit-conversation-101.json"'
    );

    const body = (await res.json()) as any;
    assert.strictEqual(body.conversationId, 101);
    assert.ok(Array.isArray(body.records));
    assert.ok(body.records.length > 0);

    // Absence check: JSON export must NOT contain unconsented speech or sensitive PII
    const serialized = JSON.stringify(body);
    assert.strictEqual(serialized.includes('carol@partner-network.org'), false);
    assert.strictEqual(serialized.includes('555-0199'), false);
    assert.strictEqual(serialized.includes('originalText'), false);
  });
});

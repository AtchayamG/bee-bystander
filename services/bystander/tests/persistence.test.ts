import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { BystanderDatabase, runMigrations, seedParticipantsIfEmpty } from '../src/db.js';
import { ConsentLedger } from '../src/consent-ledger.js';
import { DEFAULT_LEDGER } from '../src/fixtures.js';
import type { RedactionEntry } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.resolve(__dirname, '../data/test-tmp');

function getTempDbPath(): string {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  return path.join(TEST_DIR, `test-${randomUUID()}.db`);
}

function cleanupDb(dbPath: string): void {
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const wal = `${dbPath}-wal`;
    const shm = `${dbPath}-shm`;
    if (fs.existsSync(wal)) fs.unlinkSync(wal);
    if (fs.existsSync(shm)) fs.unlinkSync(shm);
  } catch {
    // ignore on windows file lock release delays
  }
}

describe('D1 — SQLite Persistence, Migrations & Audit Schema Invariants', () => {
  test('round-trip test: writes a consent change, closes db, reopens, asserts change survived', () => {
    const dbPath = getTempDbPath();
    try {
      const db1 = new BystanderDatabase(dbPath, DEFAULT_LEDGER);
      const repo1 = db1.getParticipantRepository();
      const ledger1 = new ConsentLedger(DEFAULT_LEDGER, repo1);

      // Verify initial seed loaded
      assert.strictEqual(ledger1.getStatus('SPEAKER_0'), 'CONSENTED');
      assert.strictEqual(ledger1.getStatus('SPEAKER_2'), 'UNKNOWN');

      // Write a new participant and alter existing participant
      ledger1.setConsent('SPEAKER_3', 'Dave', 'PARTICIPANT', 'REVOKED', 'Refused consent explicitly');
      ledger1.setConsent('SPEAKER_0', 'Alice', 'WEARER', 'REVOKED', 'Wearer opted out');

      assert.strictEqual(ledger1.getStatus('SPEAKER_3'), 'REVOKED');
      assert.strictEqual(ledger1.getStatus('SPEAKER_0'), 'REVOKED');

      // Close database
      db1.close();

      // Reopen fresh database on same file
      const db2 = new BystanderDatabase(dbPath, DEFAULT_LEDGER);
      const repo2 = db2.getParticipantRepository();
      const ledger2 = new ConsentLedger([], repo2);

      // Verify changes survived persistence round-trip
      assert.strictEqual(ledger2.getStatus('SPEAKER_3'), 'REVOKED');
      const p3 = ledger2.getParticipant('SPEAKER_3');
      assert.strictEqual(p3?.name, 'Dave');
      assert.strictEqual(p3?.role, 'PARTICIPANT');
      assert.strictEqual(p3?.notes, 'Refused consent explicitly');

      assert.strictEqual(ledger2.getStatus('SPEAKER_0'), 'REVOKED');
      const p0 = ledger2.getParticipant('SPEAKER_0');
      assert.strictEqual(p0?.name, 'Alice');

      db2.close();
    } finally {
      cleanupDb(dbPath);
    }
  });

  test('idempotency test: running migration and seed twice leaves row counts unchanged', () => {
    const dbPath = getTempDbPath();
    try {
      const bystanderDb = new BystanderDatabase(dbPath, DEFAULT_LEDGER);
      const rawDb = bystanderDb.db;

      const initialParticipantCount = (
        rawDb.prepare('SELECT COUNT(*) as count FROM participants').get() as { count: number }
      ).count;
      assert.strictEqual(initialParticipantCount, DEFAULT_LEDGER.length);

      const initialEventCount = bystanderDb.countEvents();
      assert.strictEqual(initialEventCount, DEFAULT_LEDGER.length); // 1 seed event per initial participant

      // Run migrations again
      runMigrations(rawDb);

      // Run seeding again
      const seededAgain = seedParticipantsIfEmpty(rawDb, DEFAULT_LEDGER);
      assert.strictEqual(seededAgain, false, 'Should not seed if participants table already has rows');

      const afterParticipantCount = (
        rawDb.prepare('SELECT COUNT(*) as count FROM participants').get() as { count: number }
      ).count;
      assert.strictEqual(afterParticipantCount, initialParticipantCount);

      const afterEventCount = bystanderDb.countEvents();
      assert.strictEqual(afterEventCount, initialEventCount);

      bystanderDb.close();
    } finally {
      cleanupDb(dbPath);
    }
  });

  test('audit_records table schema strictly prohibits any column capable of holding removed text', () => {
    const dbPath = getTempDbPath();
    try {
      const bystanderDb = new BystanderDatabase(dbPath, DEFAULT_LEDGER);
      const tableInfo = bystanderDb.db.prepare('PRAGMA table_info(audit_records)').all() as Array<{
        name: string;
      }>;
      const columnNames = tableInfo.map((c) => c.name.toLowerCase());

      // Assert forbidden column names per README section 2.1
      const forbiddenTerms = ['original', 'removed', 'raw', 'speech', 'transcript', 'text_content'];
      for (const col of columnNames) {
        // replacement_text is allowed as it holds [REDACTED: CATEGORY]
        if (col === 'replacement_text') continue;

        for (const term of forbiddenTerms) {
          assert.strictEqual(
            col.includes(term),
            false,
            `Forbidden column "${col}" in audit_records table could hold removed text`
          );
        }
      }

      // Assert required columns are present
      assert.ok(columnNames.includes('char_count'));
      assert.ok(columnNames.includes('word_count'));
      assert.ok(columnNames.includes('replacement_text'));
      assert.ok(columnNames.includes('reason'));

      bystanderDb.close();
    } finally {
      cleanupDb(dbPath);
    }
  });

  test('saves and retrieves audit records with charCount and wordCount', () => {
    const dbPath = getTempDbPath();
    try {
      const bystanderDb = new BystanderDatabase(dbPath, DEFAULT_LEDGER);

      const mockRemoval: RedactionEntry = {
        id: 'rem-1',
        utteranceId: 10,
        clusterId: 'SPEAKER_2',
        speakerName: 'Unknown Diner',
        category: 'UNCONSENTED_SPEAKER',
        reason: 'Unconsented speaker utterance suppressed by absence',
        span: [0, 45],
        charCount: 45,
        wordCount: 8,
        replacementText: '[REDACTED: UNCONSENTED SPEAKER]'
      };

      bystanderDb.saveAuditRecords(101, [mockRemoval]);

      const records = bystanderDb.getAuditRecords(101);
      assert.strictEqual(records.length, 1);
      assert.strictEqual(records[0].id, 'rem-1');
      assert.strictEqual(records[0].charCount, 45);
      assert.strictEqual(records[0].wordCount, 8);
      assert.strictEqual(records[0].replacementText, '[REDACTED: UNCONSENTED SPEAKER]');

      // Assert that serialized record contains NO removed text
      const serialized = JSON.stringify(records);
      assert.strictEqual(serialized.includes('originalText'), false);

      bystanderDb.close();
    } finally {
      cleanupDb(dbPath);
    }
  });
});

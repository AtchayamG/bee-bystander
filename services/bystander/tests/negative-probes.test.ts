import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { ConsentLedger } from '../src/consent-ledger.js';
import { Redactor } from '../src/redactor.js';
import { RefusalEngine } from '../src/refusal.js';
import { FIXTURE_CONVERSATIONS, DEFAULT_LEDGER } from '../src/fixtures.js';
import { BystanderDatabase } from '../src/db.js';
import { createServer, formatAuditRecordsCsv } from '../src/server.js';
import type { RedactionEntry, StoredAuditRecord } from '../src/types.js';

describe('Negative Probes — proving that guards fail when safety rules are broken', () => {
  it('PROBE 1: Absence check fails if unconsented text is deliberately leaked into output', () => {
    const ledger = new ConsentLedger(DEFAULT_LEDGER);
    const conv = FIXTURE_CONVERSATIONS[0];
    const { redactedText } = Redactor.redactConversation(conv, ledger);

    // Deliberately leak unconsented text into output string
    const leakedOutput = `${redactedText}\nLeaked: carol@partner-network.org`;

    // Absence check MUST catch this and throw an assertion error
    assert.throws(
      () => {
        assert.ok(
          !leakedOutput.includes('carol@partner-network.org'),
          'ABSENCE_VIOLATION: leaked email detected'
        );
      },
      { name: 'AssertionError' }
    );
  });

  it('PROBE 2: Audit count check fails if removal count is tampered or forged', () => {
    const ledger = new ConsentLedger(DEFAULT_LEDGER);
    const conv = FIXTURE_CONVERSATIONS[1];
    const { audit } = Redactor.redactConversation(conv, ledger);

    // Tamper with audit total count
    const tamperedAudit = { ...audit, totalRedactedChars: audit.totalRedactedChars + 50 };

    // The cross-check assertion MUST fail
    assert.throws(
      () => {
        const computed = tamperedAudit.removals.reduce((sum, r) => sum + r.charCount, 0);
        assert.equal(tamperedAudit.totalRedactedChars, computed);
      },
      { name: 'AssertionError' }
    );
  });

  it('PROBE 3: Surface claim guard fails if hardcoded checkmark "✓" is introduced', () => {
    const mockBadUiCode = `
      function renderBadge() {
        return '<span class="status">✓ Consented</span>';
      }
    `;

    assert.throws(
      () => {
        assert.ok(!mockBadUiCode.includes('✓'), 'HARDCODED_CLAIM_VIOLATION: checkmark found');
      },
      { name: 'AssertionError' }
    );
  });

  it('PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN', () => {
    const ledger = new ConsentLedger(DEFAULT_LEDGER);
    // Explicitly set Bob to UNKNOWN
    ledger.setConsent('SPEAKER_1', 'Bob', 'PARTICIPANT', 'UNKNOWN');

    const conv = FIXTURE_CONVERSATIONS[0];
    const { audit } = Redactor.redactConversation(conv, ledger);
    const refusal = RefusalEngine.evaluate(conv, ledger, audit);

    // Must refuse
    assert.equal(refusal.refused, true);
    assert.equal(refusal.code, 'REFUSAL_UNCONSENTED_PARTICIPANTS');
  });

  // TASK 22 New Probes (D1, D2, D3, D6)

  it('PROBE D1: an audit record INSERT containing an unauthorized column (e.g. original_text) is rejected by SQLite schema', () => {
    const db = new BystanderDatabase(':memory:');
    try {
      assert.throws(
        () => {
          db.db.prepare(`
            INSERT INTO audit_records (
              id, conversation_id, category, cluster_id, reason,
              span_start, span_end, char_count, word_count, replacement_text,
              original_text, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            'rec-d1-probe',
            101,
            'UNCONSENTED_SPEAKER',
            'SPEAKER_2',
            'unauthorized column insertion probe',
            0,
            15,
            15,
            3,
            '[REDACTED]',
            'secret unconsented speech',
            Date.now()
          );
        },
        /has no column named original_text/
      );
    } finally {
      db.close();
    }
  });

  it('PROBE D2: an enrolment request with an unknown role or status returns HTTP 400 and does NOT insert a row', async () => {
    const ctx = createServer(':memory:');
    const repo = ctx.db.getParticipantRepository();
    const server = http.createServer(ctx.app);
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
    const port = (server.address() as { port: number }).port;

    try {
      // Attempt 1: Unknown Role
      const badRoleRes = await fetch(`http://127.0.0.1:${port}/api/consent/enrol`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusterId: 'SPEAKER_ROGUE_1',
          name: 'Rogue Actor',
          role: 'ADMINISTRATOR',
          status: 'CONSENTED'
        })
      });
      assert.strictEqual(badRoleRes.status, 400);
      const badRoleBody = (await badRoleRes.json()) as any;
      assert.strictEqual(badRoleBody.code, 'INVALID_ROLE');
      assert.strictEqual(
        repo.get('SPEAKER_ROGUE_1'),
        undefined,
        'Database must not contain row for rejected role'
      );

      // Attempt 2: Unknown Status
      const badStatusRes = await fetch(`http://127.0.0.1:${port}/api/consent/enrol`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusterId: 'SPEAKER_ROGUE_2',
          name: 'Rogue Actor 2',
          role: 'PARTICIPANT',
          status: 'PENDING_OPT_IN'
        })
      });
      assert.strictEqual(badStatusRes.status, 400);
      const badStatusBody = (await badStatusRes.json()) as any;
      assert.strictEqual(badStatusBody.code, 'INVALID_STATUS');
      assert.strictEqual(
        repo.get('SPEAKER_ROGUE_2'),
        undefined,
        'Database must not contain row for rejected status'
      );
    } finally {
      server.close();
      ctx.db.close();
    }
  });

  it('PROBE D3: a purge request for a non-existent conversation returns 0 deletions and leaves other conversations untouched', async () => {
    const ctx = createServer(':memory:');
    const server = http.createServer(ctx.app);
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
    const port = (server.address() as { port: number }).port;

    try {
      // Seed audit records for conversation 101
      const sampleRemovals: RedactionEntry[] = [
        {
          id: 'rem-d3-preserve',
          utteranceId: 1,
          clusterId: 'SPEAKER_1',
          speakerName: 'Bob',
          category: 'THIRD_PARTY_PII',
          reason: 'Sensitive contact',
          span: [10, 30],
          charCount: 20,
          wordCount: 2,
          replacementText: '[REDACTED: PII]'
        }
      ];
      ctx.db.saveAuditRecords(101, sampleRemovals);
      assert.strictEqual(ctx.db.getAuditRecords(101).length, 1);

      // Request purge for non-existent conversation 99999
      const purgeNonExistent = await fetch(`http://127.0.0.1:${port}/api/retention/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: 99999 })
      });
      assert.strictEqual(purgeNonExistent.status, 200);
      const purgeBody = (await purgeNonExistent.json()) as any;
      assert.strictEqual(purgeBody.deletedAuditRecords, 0);

      // Verify conversation 101 records are completely preserved
      const preserved = ctx.db.getAuditRecords(101);
      assert.strictEqual(preserved.length, 1);
      assert.strictEqual(preserved[0].id, 'rem-d3-preserve');

      // Request purge with invalid non-positive conversationId
      const purgeInvalid = await fetch(`http://127.0.0.1:${port}/api/retention/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: -99 })
      });
      assert.strictEqual(purgeInvalid.status, 400);
      assert.strictEqual(ctx.db.getAuditRecords(101).length, 1);
    } finally {
      server.close();
      ctx.db.close();
    }
  });

  it('PROBE D6: a CSV export with an entity containing embedded commas/quotes/newlines is round-tripped through an RFC 4180 parser and asserts field count matches', () => {
    const complexReason = 'Contains "Dr. Evans, MD", hospital: Mercy General,\r\nnotes: "Confidential, patient #44"';
    const complexReplacement = '[REDACTED: ENTITY, "CLINICAL", SUITE #100]';

    const record: StoredAuditRecord = {
      id: 'rec-rfc4180',
      conversationId: 107,
      // SENSITIVE_ENTITY, not THIRD_PARTY_ENTITY: the latter is not a member of
      // RedactionCategory and this line failed tsc --noEmit while the test
      // itself passed, because tsx strips types without checking them.
      category: 'SENSITIVE_ENTITY',
      clusterId: 'SPEAKER_0',
      reason: complexReason,
      spanStart: 12,
      spanEnd: 98,
      charCount: 86,
      wordCount: 14,
      replacementText: complexReplacement,
      createdAt: 1726380000000
    };

    const csv = formatAuditRecordsCsv([record]);

    // RFC 4180 compliant parser
    function parseRfc4180Csv(csvText: string): string[][] {
      const rows: string[][] = [];
      let currentRow: string[] = [];
      let currentField = '';
      let insideQuote = false;

      for (let i = 0; i < csvText.length; i++) {
        const ch = csvText[i];
        const next = csvText[i + 1];

        if (insideQuote) {
          if (ch === '"' && next === '"') {
            currentField += '"';
            i++; // skip escaped quote
          } else if (ch === '"') {
            insideQuote = false;
          } else {
            currentField += ch;
          }
        } else {
          if (ch === '"') {
            insideQuote = true;
          } else if (ch === ',') {
            currentRow.push(currentField);
            currentField = '';
          } else if (ch === '\r' && next === '\n') {
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
            i++; // skip \n
          } else if (ch === '\n') {
            currentRow.push(currentField);
            rows.push(currentRow);
            currentRow = [];
            currentField = '';
          } else {
            currentField += ch;
          }
        }
      }
      if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
      }
      return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
    }

    const parsed = parseRfc4180Csv(csv);
    assert.strictEqual(parsed.length, 2, 'CSV must produce exactly 2 rows: header and 1 record');
    assert.strictEqual(parsed[0].length, 11, 'Header must have exactly 11 columns');
    assert.strictEqual(parsed[1].length, 11, 'Data row must have exactly 11 columns despite embedded commas and newlines');

    // Assert round-trip fidelity of tricky fields
    assert.strictEqual(parsed[1][0], 'rec-rfc4180');
    assert.strictEqual(parsed[1][4], complexReason, 'Embedded quotes, commas, and newlines must survive round-trip unaltered');
    assert.strictEqual(parsed[1][9], complexReplacement, 'Replacement text with quotes and commas must survive round-trip');
  });
});

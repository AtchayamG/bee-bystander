import { test, describe } from 'node:test';
import assert from 'node:assert';
import { FIXTURE_CONVERSATIONS, DEFAULT_LEDGER } from '../src/fixtures.js';
import { ConsentLedger } from '../src/consent-ledger.js';
import { Redactor } from '../src/redactor.js';
import { RefusalEngine } from '../src/refusal.js';

describe('D5 — Distinct Conversation Fixtures & Boundary Branches', () => {
  const ledger = new ConsentLedger(DEFAULT_LEDGER);

  test('Fixture 104 (empty speaker string): triggers REFUSAL_AMBIGUOUS_ATTRIBUTION', () => {
    const conv104 = FIXTURE_CONVERSATIONS.find((c) => c.id === 104);
    assert.ok(conv104, 'Fixture 104 must exist');

    // Confirm that utterance 2 has an empty speaker string
    const emptySpeakerUtterance = conv104.transcriptions[0].utterances.find((u) => u.speaker === '');
    assert.ok(emptySpeakerUtterance, 'Utterance with empty speaker string must be present');

    const { audit } = Redactor.redactConversation(conv104, ledger);
    const refusal = RefusalEngine.evaluate(conv104, ledger, audit);

    assert.strictEqual(refusal.refused, true);
    assert.strictEqual(refusal.code, 'REFUSAL_AMBIGUOUS_ATTRIBUTION');
    assert.ok(refusal.reason?.includes('lacks definitive acoustic speaker attribution'));
  });

  test('Fixture 105 (all speakers UNKNOWN): completely suppresses speech and triggers REFUSAL_UNCONSENTED_PARTICIPANTS', () => {
    const conv105 = FIXTURE_CONVERSATIONS.find((c) => c.id === 105);
    assert.ok(conv105, 'Fixture 105 must exist');

    const { redactedUtterances, redactedText, audit } = Redactor.redactConversation(conv105, ledger);
    const refusal = RefusalEngine.evaluate(conv105, ledger, audit);

    // Both utterances from SPEAKER_7 and SPEAKER_8 must be suppressed
    assert.strictEqual(audit.unconsentedSpeakerCount, 2);

    // Verify absence of unconsented speech in output
    assert.strictEqual(redactedText.includes('elevator'), false);
    assert.strictEqual(redactedText.includes('parking garage'), false);
    assert.strictEqual(redactedText.includes('north elevator bank'), false);

    for (const u of redactedUtterances) {
      assert.ok(u.text.startsWith('[REDACTED: UNCONSENTED SPEAKER'));
    }

    assert.strictEqual(refusal.refused, true);
    assert.strictEqual(refusal.code, 'REFUSAL_UNCONSENTED_PARTICIPANTS');
  });

  test('Fixture 106 (participant revokes consent mid-way): triggers REFUSAL_CONSENT_REVOKED', () => {
    const conv106 = FIXTURE_CONVERSATIONS.find((c) => c.id === 106);
    assert.ok(conv106, 'Fixture 106 must exist');

    const { audit } = Redactor.redactConversation(conv106, ledger);
    const refusal = RefusalEngine.evaluate(conv106, ledger, audit);

    assert.strictEqual(refusal.refused, true);
    assert.strictEqual(refusal.code, 'REFUSAL_CONSENT_REVOKED');
    assert.strictEqual(refusal.details?.clusterId, 'SPEAKER_4');
    assert.strictEqual(refusal.details?.triggerUtteranceId, 2);
  });

  test('Fixture 107 (overlapping PII in single utterance): scrubs email, phone, and entity without leaks', () => {
    const conv107 = FIXTURE_CONVERSATIONS.find((c) => c.id === 107);
    assert.ok(conv107, 'Fixture 107 must exist');

    const { redactedText, audit } = Redactor.redactConversation(conv107, ledger);

    // Verify absence of all sensitive PII tokens in output
    assert.strictEqual(redactedText.includes('evans@mercy-general.org'), false);
    assert.strictEqual(redactedText.includes('555-0144'), false);
    assert.strictEqual(redactedText.includes('biopsy'), false);
    assert.strictEqual(redactedText.includes('Dr. Evans'), false);

    // Verify audit records capture each removal
    assert.ok(audit.removals.length >= 4, 'Must record removals for entity, email, phone, and medical term');
    const categories = audit.removals.map((r) => r.category);
    assert.ok(categories.includes('THIRD_PARTY_PII'));
    assert.ok(categories.includes('SENSITIVE_ENTITY'));

    // Verify audit records carry charCount and wordCount, zero removed text
    for (const r of audit.removals) {
      assert.ok(r.charCount > 0);
      assert.ok(r.wordCount > 0);
      assert.strictEqual((r as any).originalText, undefined);
    }
  });

  test('all 7 fixtures match the ConversationDetail schema with valid structure', () => {
    assert.strictEqual(FIXTURE_CONVERSATIONS.length, 7);
    for (const conv of FIXTURE_CONVERSATIONS) {
      assert.strictEqual(typeof conv.id, 'number');
      assert.strictEqual(typeof conv.state, 'string');
      assert.strictEqual(typeof conv.created_at, 'number');
      assert.strictEqual(typeof conv.updated_at, 'number');
      assert.ok(Array.isArray(conv.transcriptions));
      assert.ok(conv.transcriptions.length > 0);
      for (const t of conv.transcriptions) {
        assert.strictEqual(typeof t.id, 'number');
        assert.ok(Array.isArray(t.utterances));
        for (const u of t.utterances) {
          assert.strictEqual(typeof u.id, 'number');
          assert.strictEqual(typeof u.text, 'string');
          assert.strictEqual(typeof u.speaker, 'string');
          assert.strictEqual(typeof u.created_at, 'number');
        }
      }
    }
  });
});

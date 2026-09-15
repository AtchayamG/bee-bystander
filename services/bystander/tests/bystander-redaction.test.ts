import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConsentLedger } from '../src/consent-ledger.js';
import { Redactor } from '../src/redactor.js';
import { RefusalEngine } from '../src/refusal.js';
import { FIXTURE_CONVERSATIONS, DEFAULT_LEDGER } from '../src/fixtures.js';
import type { ConversationDetail } from '../src/types.js';

describe('Bystander Redaction & Gating Pipeline', () => {
  it('verifies redaction by ABSENCE: sensitive strings never appear in serialized output', () => {
    const ledger = new ConsentLedger(DEFAULT_LEDGER);
    const conv1 = FIXTURE_CONVERSATIONS[0]; // Alice & Bob, mentions Carol, email, phone

    const result = Redactor.redactConversation(conv1, ledger);
    const { redactedText, redactedUtterances, audit } = result;

    // Serialise EVERYTHING a caller can receive, audit included, minus rawText
    // which exists only for the local before/after view and is never returned
    // by a tool. Scoping this to { redactedText, redactedUtterances } is what
    // let the audit carry every removed span verbatim while this test passed:
    // audit.removals[].originalText held the exact words, and
    // bystander_get_transcript hands audit.removals to its caller.
    const { rawText: _localOnly, ...returnable } = result;
    const serialized = JSON.stringify(returnable);

    // ABSENCE assertions - string must not appear anywhere in serialized output
    assert.ok(!serialized.includes('carol@partner-network.org'), 'Email leaked into serialized output');
    assert.ok(!serialized.includes('555-0199'), 'Phone leaked into serialized output');
    assert.ok(!serialized.includes('Carol'), 'Third-party name Carol leaked into serialized output');

    // Confirm that redactions were recorded
    assert.ok(audit.removals.length > 0, 'Audit record is empty');
    assert.equal(audit.piiCount, 4, 'Expected 4 PII/entity removals');
  });

  it('verifies unconsented bystander speech is completely suppressed by ABSENCE', () => {
    const ledger = new ConsentLedger(DEFAULT_LEDGER);
    const conv2 = FIXTURE_CONVERSATIONS[1]; // Cafe ambient bystander SPEAKER_2

    const result2 = Redactor.redactConversation(conv2, ledger);
    const { rawText: _local2, ...returnable2 } = result2;
    const serialized = JSON.stringify(returnable2);

    // Bystander unconsented speech must NOT appear anywhere in output
    assert.ok(!serialized.includes('biopsy test results'), 'Bystander private speech leaked');
    assert.ok(!serialized.includes('patient ID is 8841'), 'Bystander patient ID leaked');
    assert.ok(!serialized.includes('Excuse me Dr. Evans'), 'Bystander doctor invocation leaked');
    assert.ok(serialized.includes('[REDACTED: UNCONSENTED SPEAKER (SPEAKER_2 - Status: UNKNOWN)]'));
  });

  it('strictly enforces UNKNOWN consent as refusal, never as permission', () => {
    const ledger = new ConsentLedger(); // completely empty ledger
    // Any cluster query on empty ledger must return UNKNOWN
    assert.equal(ledger.getStatus('SPEAKER_0'), 'UNKNOWN');
    assert.equal(ledger.getStatus('SPEAKER_RANDOM'), 'UNKNOWN');

    // isConsented MUST be false
    assert.equal(ledger.isConsented('SPEAKER_0'), false);
    assert.equal(ledger.isConsented('SPEAKER_RANDOM'), false);

    // Refusal engine must refuse summarisation when UNKNOWN speech exists
    const conv = FIXTURE_CONVERSATIONS[0];
    const { audit } = Redactor.redactConversation(conv, ledger);
    const refusal = RefusalEngine.evaluate(conv, ledger, audit);

    assert.equal(refusal.refused, true);
    assert.equal(refusal.code, 'REFUSAL_UNCONSENTED_PARTICIPANTS');
  });

  it('verifies audit counts match removals length computed both ways', () => {
    const ledger = new ConsentLedger(DEFAULT_LEDGER);
    const conv = FIXTURE_CONVERSATIONS[1]; // Cafe conversation

    const { audit } = Redactor.redactConversation(conv, ledger);

    // 1. removals.length matches sum of categories
    assert.equal(
      audit.removals.length,
      audit.unconsentedSpeakerCount + audit.piiCount,
      'Audit category counts do not sum to total removals'
    );

    // 2. totalRedactedChars matches the sum of the per-entry counts
    const computedChars = audit.removals.reduce((sum, r) => sum + r.charCount, 0);
    assert.equal(audit.totalRedactedChars, computedChars, 'totalRedactedChars mismatch');

    // 3. totalRedactedWords matches sum of word counts
    const computedWords = audit.removals.reduce((sum, r) => sum + r.wordCount, 0);
    assert.equal(audit.totalRedactedWords, computedWords, 'totalRedactedWords mismatch');
  });

  it('no redaction entry carries the text it removed, in any field', () => {
    // The structural version of the absence test. Even if a future change adds
    // a field, this fails unless every value on a removal entry is a number, a
    // short label, or the placeholder that replaced the content.
    const ledger = new ConsentLedger(DEFAULT_LEDGER);
    for (const conv of FIXTURE_CONVERSATIONS) {
      const raw = conv.transcriptions.flatMap((t) => t.utterances).map((u) => u.text);
      const { audit } = Redactor.redactConversation(conv, ledger);

      for (const entry of audit.removals) {
        assert.ok(
          !Object.prototype.hasOwnProperty.call(entry, 'originalText'),
          'A removal entry has an originalText field again'
        );
        const values = JSON.stringify(entry);
        for (const utteranceText of raw) {
          // No removal entry may contain a whole utterance, and no entry may
          // contain any run of 4+ words from one.
          const words = utteranceText.split(/\s+/).filter(Boolean);
          for (let i = 0; i + 4 <= words.length; i++) {
            const run = words.slice(i, i + 4).join(' ');
            assert.ok(
              !values.includes(run),
              `Removal entry ${entry.id} contains a 4-word run of source speech: "${run}"`
            );
          }
        }
      }
    }
  });

  it('guarantees substring safety: word-list matching does not match subwords', () => {
    const ledger = new ConsentLedger(DEFAULT_LEDGER);

    // Synthetic test conversation with potential false-positive triggers
    const trickyConv: ConversationDetail = {
      id: 999,
      title: 'Substring Safety Probe',
      summary: 'Testing substring boundaries',
      short_summary: 'Substring safety',
      state: 'completed',
      created_at: Date.now(),
      updated_at: Date.now(),
      primary_location: { address: null, latitude: 0, longitude: 0, created_at: Date.now() },
      suggested_links: [],
      transcriptions: [
        {
          id: 9001,
          realtime: false,
          utterances: [
            {
              id: 1,
              realtime: false,
              start: 0,
              end: 1000,
              spoken_at: Date.now(),
              text: 'The annual conference discussed how participants consented to all terms.',
              speaker: 'SPEAKER_0',
              created_at: Date.now()
            },
            {
              id: 2,
              realtime: false,
              start: 1000,
              end: 2000,
              spoken_at: Date.now(),
              text: 'We spotted a bobcat near the canal yesterday.',
              speaker: 'SPEAKER_1',
              created_at: Date.now()
            }
          ]
        }
      ]
    };

    const { redactedUtterances, audit } = Redactor.redactConversation(trickyConv, ledger);

    // "annual" must NOT have "Ann" stripped
    assert.ok(redactedUtterances[0].text.includes('annual'), 'annual was corrupted by Ann regex');
    // "consented" must NOT have "consent" stripped
    assert.ok(redactedUtterances[0].text.includes('consented'), 'consented was corrupted by consent regex');
    // "bobcat" must NOT have "Bob" stripped
    assert.ok(redactedUtterances[1].text.includes('bobcat'), 'bobcat was corrupted by Bob regex');

    // No removals should have been triggered on these safe utterances
    assert.equal(audit.removals.length, 0, 'False-positive redactions occurred on substrings');
  });

  it('explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED', () => {
    const ledger = new ConsentLedger(DEFAULT_LEDGER);
    const conv3 = FIXTURE_CONVERSATIONS[2]; // Explicit revocation scenario

    const { audit } = Redactor.redactConversation(conv3, ledger);
    const refusal = RefusalEngine.evaluate(conv3, ledger, audit);

    assert.equal(refusal.refused, true);
    assert.equal(refusal.code, 'REFUSAL_CONSENT_REVOKED');
    assert.ok(refusal.reason?.includes('revoked consent'));
  });
});

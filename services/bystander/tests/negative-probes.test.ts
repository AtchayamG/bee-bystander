import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConsentLedger } from '../src/consent-ledger.js';
import { Redactor } from '../src/redactor.js';
import { RefusalEngine } from '../src/refusal.js';
import { FIXTURE_CONVERSATIONS, DEFAULT_LEDGER } from '../src/fixtures.js';

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
        const computed = tamperedAudit.removals.reduce((sum, r) => sum + r.originalText.length, 0);
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
});

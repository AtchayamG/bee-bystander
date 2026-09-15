import type {
  ConversationDetail,
  RefusalResult,
  RedactionAudit
} from './types.js';
import { ConsentLedger } from './consent-ledger.js';

const REVOCATION_PHRASES = [
  'revoke consent',
  'do not record',
  'stop recording',
  'did not agree',
  'never agreed to be recorded'
];

export class RefusalEngine {
  /**
   * Evaluates whether Bystander refuses to produce a summary.
   * Refusal is loud, explicit, and carries a machine-readable reason code.
   */
  public static evaluate(
    conversation: ConversationDetail,
    ledger: ConsentLedger,
    audit: RedactionAudit
  ): RefusalResult {
    const utterances = conversation.transcriptions.flatMap((t) => t.utterances);

    // 1. Explicit in-band revocation check
    for (const u of utterances) {
      const lower = u.text.toLowerCase();
      for (const phrase of REVOCATION_PHRASES) {
        if (lower.includes(phrase)) {
          const cluster = u.speaker || 'unknown';
          const participant = ledger.getParticipant(cluster);
          const name = participant ? participant.name : cluster;
          return {
            refused: true,
            code: 'REFUSAL_CONSENT_REVOKED',
            reason: `Participant ${name} (${cluster}) explicitly revoked consent during recording: "${u.text}"`,
            details: {
              triggerUtteranceId: u.id,
              clusterId: cluster,
              explanation: `Explicit revocation phrase "${phrase}" matched at utterance ${u.id}. Bystander strictly refuses summarisation.`
            }
          };
        }
      }
    }

    // 2. Ledger revocation check
    for (const p of ledger.list()) {
      if (p.status === 'REVOKED') {
        return {
          refused: true,
          code: 'REFUSAL_CONSENT_REVOKED',
          reason: `Participant ${p.name} (${p.clusterId}) has consent status REVOKED in the ledger.`,
          details: {
            clusterId: p.clusterId,
            explanation: `Consent state for ${p.clusterId} is set to REVOKED. All automated processing refused.`
          }
        };
      }
    }

    // 3. Unconsented participant check
    // If the conversation contains utterances from UNKNOWN or unconsented clusters
    if (audit.unconsentedSpeakerCount > 0) {
      const firstUnconsented = audit.removals.find(
        (r) => r.category === 'UNCONSENTED_SPEAKER'
      );
      const cluster = firstUnconsented?.clusterId || 'unknown';
      return {
        refused: true,
        code: 'REFUSAL_UNCONSENTED_PARTICIPANTS',
        reason: `Conversation contains ${audit.unconsentedSpeakerCount} unconsented speaker turn(s) from non-consenting participants (e.g. ${cluster}).`,
        details: {
          triggerUtteranceId: firstUnconsented?.utteranceId,
          clusterId: cluster,
          explanation: `Bystander refuses to summarize conversations containing third-party voices whose consent has not been confirmed.`
        }
      };
    }

    // 4. Ambiguous attribution check (missing or empty speaker)
    for (const u of utterances) {
      if (!u.speaker || u.speaker.trim() === '' || u.speaker === 'unknown') {
        return {
          refused: true,
          code: 'REFUSAL_AMBIGUOUS_ATTRIBUTION',
          reason: `Utterance ${u.id} lacks definitive acoustic speaker attribution and cannot be verified against the consent ledger.`,
          details: {
            triggerUtteranceId: u.id,
            explanation: `Bee transcript returned an unlabelled utterance ("${u.text.slice(0, 40)}..."). Refusing summary due to attribution ambiguity.`
          }
        };
      }
    }

    return { refused: false };
  }
}

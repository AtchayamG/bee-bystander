import type {
  ConversationDetail,
  Utterance,
  RedactionEntry,
  RedactionAudit
} from './types.js';
import { ConsentLedger } from './consent-ledger.js';

// Regex patterns with strict word boundaries to avoid substring false positives.
// "Ann" must not fire inside "annual", "Bob" must not fire inside "bobcat",
// "consent" must not fire inside "consented".
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;
const PHONE_REGEX = /\b(?:\+?1[-.\s]?)?(?:\(?([0-9]{3})\)?[-.\s]?)?([0-9]{3})[-.\s]?([0-9]{4})\b/g;

// Named entities representing third parties or sensitive subjects
const THIRD_PARTY_ENTITIES = [
  'Carol',
  'Dr\.\s*Evans',
  'Charlie',
  'Dave',
  'Eve',
  'biopsy',
  'patient ID'
];

export class Redactor {
  /**
   * Measures a removed span without retaining it. The only thing that leaves
   * this function is two integers.
   */
  private static sizeOf(text: string): { charCount: number; wordCount: number } {
    return {
      charCount: text.length,
      wordCount: text.trim().split(/\s+/).filter(Boolean).length
    };
  }

  /**
   * Redacts a single utterance or text block against the consent ledger.
   */
  public static redactConversation(
    conversation: ConversationDetail,
    ledger: ConsentLedger
  ): {
    redactedUtterances: Utterance[];
    audit: RedactionAudit;
    redactedText: string;
    rawText: string;
  } {
    const removals: RedactionEntry[] = [];
    const redactedUtterances: Utterance[] = [];
    const rawLines: string[] = [];
    const redactedLines: string[] = [];

    const allUtterances = conversation.transcriptions.flatMap((t) => t.utterances);

    for (const u of allUtterances) {
      const cluster = u.speaker || 'unknown';
      const participant = ledger.getParticipant(cluster);
      const speakerDisplayName = participant ? participant.name : cluster;
      const status = ledger.getStatus(cluster);

      rawLines.push(`${speakerDisplayName} (${cluster}): ${u.text}`);

      // Rule 1: Whole-speaker suppression if not CONSENTED
      if (!ledger.isConsented(cluster)) {
        const replacement = `[REDACTED: UNCONSENTED SPEAKER (${cluster} - Status: ${status})]`;
        const entry: RedactionEntry = {
          id: `rem-spk-${u.id}`,
          utteranceId: u.id,
          clusterId: cluster,
          speakerName: speakerDisplayName,
          category: 'UNCONSENTED_SPEAKER',
          reason: `Speaker cluster "${cluster}" has consent status "${status}". Speech suppressed.`,
          span: [0, u.text.length],
          ...Redactor.sizeOf(u.text),
          replacementText: replacement
        };
        removals.push(entry);

        redactedUtterances.push({
          ...u,
          text: replacement
        });
        redactedLines.push(`${speakerDisplayName} (${cluster}): ${replacement}`);
        continue;
      }

      // Rule 2: In-text PII and third-party redaction for consented speakers
      let currentText = u.text;
      let workingUtteranceText = u.text;

      // 2a. Scrub Emails
      workingUtteranceText = workingUtteranceText.replace(EMAIL_REGEX, (match, offset) => {
        const replacement = '[REDACTED: EMAIL]';
        removals.push({
          id: `rem-pii-email-${u.id}-${offset}`,
          utteranceId: u.id,
          clusterId: cluster,
          speakerName: speakerDisplayName,
          category: 'THIRD_PARTY_PII',
          reason: 'Third-party email address detected in transcript',
          span: [offset, offset + match.length],
          ...Redactor.sizeOf(match),
          replacementText: replacement
        });
        return replacement;
      });

      // 2b. Scrub Phone Numbers
      workingUtteranceText = workingUtteranceText.replace(PHONE_REGEX, (match, ...args) => {
        const offset = typeof args[args.length - 2] === 'number' ? args[args.length - 2] : 0;
        const replacement = '[REDACTED: PHONE]';
        removals.push({
          id: `rem-pii-phone-${u.id}-${offset}`,
          utteranceId: u.id,
          clusterId: cluster,
          speakerName: speakerDisplayName,
          category: 'THIRD_PARTY_PII',
          reason: 'Third-party telephone number detected in transcript',
          span: [offset, offset + match.length],
          ...Redactor.sizeOf(match),
          replacementText: replacement
        });
        return replacement;
      });

      // 2c. Scrub Named Third-Party Entities with strict word boundaries
      for (const entityPattern of THIRD_PARTY_ENTITIES) {
        const regex = new RegExp(`\\b${entityPattern}\\b`, 'gi');
        workingUtteranceText = workingUtteranceText.replace(regex, (match, offset) => {
          const replacement = `[REDACTED: ENTITY]`;
          removals.push({
            id: `rem-entity-${u.id}-${offset}`,
            utteranceId: u.id,
            clusterId: cluster,
            speakerName: speakerDisplayName,
            category: 'SENSITIVE_ENTITY',
            // The reason must not quote the match. It used to read
            // `Third-party entity "${match}" detected`, which put the name
            // straight back into the audit that had just removed it - the same
            // leak as originalText, one line further down.
            reason: 'A third-party entity name was detected in this utterance',
            span: [offset, offset + match.length],
            ...Redactor.sizeOf(match),
            replacementText: replacement
          });
          return replacement;
        });
      }

      redactedUtterances.push({
        ...u,
        text: workingUtteranceText
      });
      redactedLines.push(`${speakerDisplayName} (${cluster}): ${workingUtteranceText}`);
    }

    // Compute exact audit metrics - NEVER hardcode or estimate
    let totalChars = 0;
    let totalWords = 0;
    let unconsentedCount = 0;
    let piiCount = 0;

    for (const r of removals) {
      totalChars += r.charCount;
      totalWords += r.wordCount;
      if (r.category === 'UNCONSENTED_SPEAKER') {
        unconsentedCount++;
      } else {
        piiCount++;
      }
    }

    const audit: RedactionAudit = {
      removals,
      totalRedactedChars: totalChars,
      totalRedactedWords: totalWords,
      unconsentedSpeakerCount: unconsentedCount,
      piiCount,
      processedAt: Date.now()
    };

    return {
      redactedUtterances,
      audit,
      redactedText: redactedLines.join('\n'),
      rawText: rawLines.join('\n')
    };
  }
}

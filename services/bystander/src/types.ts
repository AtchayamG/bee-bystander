export type ConsentStatus = 'CONSENTED' | 'REVOKED' | 'UNKNOWN';

export type ParticipantRole = 'WEARER' | 'PARTICIPANT' | 'BYSTANDER';

export interface ParticipantConsent {
  clusterId: string;
  name: string;
  role: ParticipantRole;
  status: ConsentStatus;
  updatedAt: number;
  notes?: string;
}

export interface Utterance {
  id: number;
  realtime: boolean;
  start: number | null;
  end: number | null;
  spoken_at: number | null;
  text: string;
  speaker: string;
  created_at: number;
}

export interface Transcription {
  id: number;
  realtime: boolean;
  utterances: Utterance[];
}

export interface ConversationDetail {
  id: number;
  title: string | null;
  summary: string | null;
  short_summary: string | null;
  state: string;
  created_at: number;
  updated_at: number;
  transcriptions: Transcription[];
  suggested_links: Array<{ url: string; created_at: number }>;
  primary_location: {
    address: string | null;
    latitude: number;
    longitude: number;
    created_at: number;
  };
}

export interface ConversationSummary {
  id: number;
  title: string | null;
  summary: string | null;
  short_summary: string | null;
  state: string;
  created_at: number;
  updated_at: number;
  utterances_count: number;
}

export interface Fact {
  id: number;
  text: string;
  tags: string[];
  created_at: number;
  confirmed: boolean;
}

export type RedactionCategory = 'UNCONSENTED_SPEAKER' | 'THIRD_PARTY_PII' | 'SENSITIVE_ENTITY';

export interface RedactionEntry {
  id: string;
  utteranceId: number;
  clusterId: string;
  speakerName: string;
  category: RedactionCategory;
  reason: string;
  span: [number, number];
  /**
   * The SIZE of what was removed, never the content.
   *
   * This field used to be `originalText: string` - the removed span verbatim.
   * Every redaction entry therefore carried the exact words it had just
   * suppressed, and `bystander_get_transcript` returns `audit.removals` to its
   * caller, so an assistant asking for a redacted transcript received the
   * unconsented speech back inside the audit that claimed to have removed it.
   *
   * The redaction test did not catch it because it serialised only
   * `{ redactedText, redactedUtterances }` and asserted absence over that -
   * the part that passes. The audit was outside the assertion.
   *
   * A char and word count supports every figure the audit needs to report and
   * reconstructs nothing. If a future consumer needs the original text, that is
   * a reason to refuse the consumer, not to put the text back.
   */
  charCount: number;
  wordCount: number;
  replacementText: string;
}

export interface RedactionAudit {
  removals: RedactionEntry[];
  totalRedactedChars: number;
  totalRedactedWords: number;
  unconsentedSpeakerCount: number;
  piiCount: number;
  processedAt: number;
}

export type RefusalCode =
  | 'REFUSAL_UNCONSENTED_PARTICIPANTS'
  | 'REFUSAL_AMBIGUOUS_ATTRIBUTION'
  | 'REFUSAL_CONSENT_REVOKED';

export interface RefusalResult {
  refused: boolean;
  code?: RefusalCode;
  reason?: string;
  details?: {
    triggerUtteranceId?: number;
    clusterId?: string;
    explanation: string;
  };
}

export interface PipelineResult {
  conversationId: number;
  title: string;
  rawUtteranceCount: number;
  redactedUtteranceCount: number;
  rawCharCount: number;
  redactedCharCount: number;
  ledger: ParticipantConsent[];
  audit: RedactionAudit;
  refusal: RefusalResult;
  redactedUtterances: Utterance[];
  redactedText: string;
  summary: string | null;
  mode: 'live' | 'fixture';
  apiStatus: {
    code: number;
    message: string;
  };
}

export interface StoredAuditRecord {
  id: string;
  conversationId: number;
  category: RedactionCategory;
  clusterId: string;
  reason: string;
  spanStart: number;
  spanEnd: number;
  charCount: number;
  wordCount: number;
  replacementText: string;
  createdAt: number;
}

export interface EventRecord {
  id: string;
  kind: string;
  clusterId?: string | null;
  conversationId?: number | null;
  detail?: string | null;
  createdAt: number;
}

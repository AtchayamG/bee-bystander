import type { ParticipantConsent, ConsentStatus, ParticipantRole, Utterance } from './types.js';

export class ConsentLedger {
  private participants: Map<string, ParticipantConsent>;

  constructor(initialParticipants: ParticipantConsent[] = []) {
    this.participants = new Map();
    for (const p of initialParticipants) {
      this.participants.set(p.clusterId, { ...p });
    }
  }

  public getStatus(clusterId: string): ConsentStatus {
    const participant = this.participants.get(clusterId);
    if (!participant) {
      // Hard rule: UNKNOWN is never treated as consent
      return 'UNKNOWN';
    }
    return participant.status;
  }

  public isConsented(clusterId: string): boolean {
    // Only strictly CONSENTED returns true
    return this.getStatus(clusterId) === 'CONSENTED';
  }

  public setConsent(
    clusterId: string,
    name: string,
    role: ParticipantRole,
    status: ConsentStatus,
    notes?: string
  ): void {
    this.participants.set(clusterId, {
      clusterId,
      name,
      role,
      status,
      updatedAt: Date.now(),
      notes
    });
  }

  public getParticipant(clusterId: string): ParticipantConsent | undefined {
    return this.participants.get(clusterId);
  }

  public list(): ParticipantConsent[] {
    return Array.from(this.participants.values());
  }

  public clone(): ConsentLedger {
    return new ConsentLedger(this.list());
  }

  public hasUnconsentedSpeech(utterances: Utterance[]): boolean {
    for (const u of utterances) {
      const cluster = u.speaker || 'unknown';
      if (!this.isConsented(cluster)) {
        return true;
      }
    }
    return false;
  }
}

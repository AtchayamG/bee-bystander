import type { ParticipantConsent, ConsentStatus, ParticipantRole, Utterance } from './types.js';
import type { ParticipantRepository } from './db.js';

export class ConsentLedger {
  private participants: Map<string, ParticipantConsent>;
  private repository?: ParticipantRepository;

  constructor(initialParticipants: ParticipantConsent[] = [], repository?: ParticipantRepository) {
    this.repository = repository;
    this.participants = new Map();
    if (this.repository) {
      const stored = this.repository.list();
      if (stored.length > 0) {
        for (const p of stored) {
          this.participants.set(p.clusterId, { ...p });
        }
      } else {
        for (const p of initialParticipants) {
          this.participants.set(p.clusterId, { ...p });
          this.repository.set(p);
        }
      }
    } else {
      for (const p of initialParticipants) {
        this.participants.set(p.clusterId, { ...p });
      }
    }
  }

  public getStatus(clusterId: string): ConsentStatus {
    const participant = this.getParticipant(clusterId);
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
    const participant: ParticipantConsent = {
      clusterId,
      name,
      role,
      status,
      updatedAt: Date.now(),
      notes
    };
    this.participants.set(clusterId, participant);
    if (this.repository) {
      this.repository.set(participant);
    }
  }

  public unenrol(clusterId: string): boolean {
    this.participants.delete(clusterId);
    if (this.repository) {
      return this.repository.delete(clusterId);
    }
    return true;
  }

  public getParticipant(clusterId: string): ParticipantConsent | undefined {
    if (this.repository) {
      const p = this.repository.get(clusterId);
      if (p) {
        this.participants.set(clusterId, p);
        return p;
      }
      this.participants.delete(clusterId);
      return undefined;
    }
    return this.participants.get(clusterId);
  }

  public list(): ParticipantConsent[] {
    if (this.repository) {
      const list = this.repository.list();
      this.participants.clear();
      for (const p of list) {
        this.participants.set(p.clusterId, p);
      }
      return list;
    }
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


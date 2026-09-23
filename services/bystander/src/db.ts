import DatabaseConstructor, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type {
  ParticipantConsent,
  ParticipantRole,
  ConsentStatus,
  RedactionEntry,
  StoredAuditRecord,
  EventRecord,
  RedactionCategory
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_DB_PATH = path.resolve(__dirname, '../data/bystander.db');

export interface DbParticipantRow {
  cluster_id: string;
  name: string;
  role: string;
  status: string;
  updated_at: number;
  notes: string | null;
}

export interface DbAuditRow {
  id: string;
  conversation_id: number;
  category: string;
  cluster_id: string;
  reason: string;
  span_start: number;
  span_end: number;
  char_count: number;
  word_count: number;
  replacement_text: string;
  created_at: number;
}

export interface DbEventRow {
  id: string;
  kind: string;
  cluster_id: string | null;
  conversation_id: number | null;
  detail: string | null;
  created_at: number;
}

export function runMigrations(db: DatabaseType): void {
  db.pragma('journal_mode = WAL');
  // Zero deleted content instead of leaving it in free pages. Without this, a
  // withdrawn participant's name stayed readable in the file after DELETE.
  db.pragma('secure_delete = ON');
  db.pragma('foreign_keys = ON');

  // 1. Participants table
  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      cluster_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      notes TEXT
    );
  `);

  // 2. Audit records table (explicitly contains NO removed text)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_records (
      id TEXT PRIMARY KEY,
      conversation_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      cluster_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      span_start INTEGER NOT NULL,
      span_end INTEGER NOT NULL,
      char_count INTEGER NOT NULL,
      word_count INTEGER NOT NULL,
      replacement_text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_conv ON audit_records(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_records(created_at);
  `);

  // 3. Events table (append-only log)
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      cluster_id TEXT,
      conversation_id INTEGER,
      detail TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
    CREATE INDEX IF NOT EXISTS idx_events_conv ON events(conversation_id);
  `);
}

/**
 * Reads the two storage invariants back OUT of the live database rather than
 * restating them.
 *
 * The settings view used to print "WAL (Write-Ahead Logging)" and "ON" as
 * literals next to a computed database path. Both happened to be true, which is
 * exactly what makes that kind of line dangerous: it would have kept saying WAL
 * after someone changed the pragma. Same defect class as the hardcoded
 * guardrail ticks removed from project 2's surface.
 */
export function readStorageInvariants(db: DatabaseType): {
  journalMode: string;
  foreignKeys: boolean;
} {
  const journal = db.pragma('journal_mode', { simple: true }) as string;
  const fk = db.pragma('foreign_keys', { simple: true }) as number;
  return { journalMode: String(journal).toUpperCase(), foreignKeys: fk === 1 };
}

export function seedParticipantsIfEmpty(
  db: DatabaseType,
  seedData: ParticipantConsent[]
): boolean {
  const row = db.prepare('SELECT COUNT(*) as count FROM participants').get() as { count: number };
  if (row.count > 0) {
    return false;
  }

  const insertParticipant = db.prepare(`
    INSERT INTO participants (cluster_id, name, role, status, updated_at, notes)
    VALUES (@clusterId, @name, @role, @status, @updatedAt, @notes)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO events (id, kind, cluster_id, conversation_id, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    const now = Date.now();
    for (const p of seedData) {
      insertParticipant.run({
        clusterId: p.clusterId,
        name: p.name,
        role: p.role,
        status: p.status,
        updatedAt: p.updatedAt,
        notes: p.notes ?? null
      });
      insertEvent.run(
        randomUUID(),
        'INITIAL_SEED',
        p.clusterId,
        null,
        `Seeded initial participant ${p.name} (${p.status})`,
        now
      );
    }
  });

  transaction();
  return true;
}

export interface ParticipantRepository {
  get(clusterId: string): ParticipantConsent | undefined;
  list(): ParticipantConsent[];
  set(participant: ParticipantConsent): void;
  delete(clusterId: string): boolean;
}

export class SqliteParticipantRepository implements ParticipantRepository {
  constructor(private db: DatabaseType) {}

  public get(clusterId: string): ParticipantConsent | undefined {
    const row = this.db
      .prepare('SELECT cluster_id, name, role, status, updated_at, notes FROM participants WHERE cluster_id = ?')
      .get(clusterId) as DbParticipantRow | undefined;

    if (!row) return undefined;
    return {
      clusterId: row.cluster_id,
      name: row.name,
      role: row.role as ParticipantRole,
      status: row.status as ConsentStatus,
      updatedAt: row.updated_at,
      notes: row.notes ?? undefined
    };
  }

  public list(): ParticipantConsent[] {
    const rows = this.db
      .prepare('SELECT cluster_id, name, role, status, updated_at, notes FROM participants ORDER BY cluster_id ASC')
      .all() as DbParticipantRow[];

    return rows.map((r) => ({
      clusterId: r.cluster_id,
      name: r.name,
      role: r.role as ParticipantRole,
      status: r.status as ConsentStatus,
      updatedAt: r.updated_at,
      notes: r.notes ?? undefined
    }));
  }

  public set(participant: ParticipantConsent): void {
    this.db
      .prepare(`
        INSERT INTO participants (cluster_id, name, role, status, updated_at, notes)
        VALUES (@clusterId, @name, @role, @status, @updatedAt, @notes)
        ON CONFLICT(cluster_id) DO UPDATE SET
          name = excluded.name,
          role = excluded.role,
          status = excluded.status,
          updated_at = excluded.updated_at,
          notes = excluded.notes
      `)
      .run({
        clusterId: participant.clusterId,
        name: participant.name,
        role: participant.role,
        status: participant.status,
        updatedAt: participant.updatedAt,
        notes: participant.notes ?? null
      });
  }

  public delete(clusterId: string): boolean {
    const res = this.db.prepare('DELETE FROM participants WHERE cluster_id = ?').run(clusterId);
    return res.changes > 0;
  }
}

export class BystanderDatabase {
  public readonly db: DatabaseType;
  public readonly dbPath: string;

  constructor(dbPath: string = DEFAULT_DB_PATH, initialSeed?: ParticipantConsent[]) {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseConstructor(dbPath);
    runMigrations(this.db);
    if (initialSeed && initialSeed.length > 0) {
      seedParticipantsIfEmpty(this.db, initialSeed);
    }
  }

  public close(): void {
    if (this.db.open) {
      this.db.close();
    }
  }

  public getParticipantRepository(): ParticipantRepository {
    return new SqliteParticipantRepository(this.db);
  }

  // Audit records operations
  public saveAuditRecords(conversationId: number, removals: RedactionEntry[], createdAt = Date.now()): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO audit_records (
        id, conversation_id, category, cluster_id, reason,
        span_start, span_end, char_count, word_count, replacement_text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      for (const r of removals) {
        stmt.run(
          r.id,
          conversationId,
          r.category,
          r.clusterId,
          r.reason,
          r.span[0],
          r.span[1],
          r.charCount,
          r.wordCount,
          r.replacementText,
          createdAt
        );
      }
    });
    tx();
  }

  public getAuditRecords(conversationId: number): StoredAuditRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM audit_records WHERE conversation_id = ? ORDER BY span_start ASC')
      .all(conversationId) as DbAuditRow[];

    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      category: r.category as RedactionCategory,
      clusterId: r.cluster_id,
      reason: r.reason,
      spanStart: r.span_start,
      spanEnd: r.span_end,
      charCount: r.char_count,
      wordCount: r.word_count,
      replacementText: r.replacement_text,
      createdAt: r.created_at
    }));
  }

  public deleteAuditRecordsByConversation(conversationId: number): number {
    const res = this.db.prepare('DELETE FROM audit_records WHERE conversation_id = ?').run(conversationId);
    return res.changes;
  }

  public deleteAuditRecordsOlderThan(cutoffMs: number): number {
    const res = this.db.prepare('DELETE FROM audit_records WHERE created_at < ?').run(cutoffMs);
    return res.changes;
  }

  public countAuditRecords(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM audit_records').get() as { count: number };
    return row.count;
  }

  // Events operations
  public logEvent(
    kind: string,
    opts: { clusterId?: string | null; conversationId?: number | null; detail?: string | null; createdAt?: number } = {}
  ): EventRecord {
    const event: EventRecord = {
      id: randomUUID(),
      kind,
      clusterId: opts.clusterId ?? null,
      conversationId: opts.conversationId ?? null,
      detail: opts.detail ?? null,
      createdAt: opts.createdAt ?? Date.now()
    };

    this.db
      .prepare(`
        INSERT INTO events (id, kind, cluster_id, conversation_id, detail, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(event.id, event.kind, event.clusterId, event.conversationId, event.detail, event.createdAt);

    return event;
  }

  public listEvents(limit = 100): EventRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM events ORDER BY created_at DESC, rowid DESC LIMIT ?')
      .all(limit) as DbEventRow[];

    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      clusterId: r.cluster_id,
      conversationId: r.conversation_id,
      detail: r.detail,
      createdAt: r.created_at
    }));
  }

  public countEvents(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number };
    return row.count;
  }
}

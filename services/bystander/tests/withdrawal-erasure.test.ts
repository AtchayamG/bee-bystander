import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../src/server.js';

/**
 * Withdrawing consent must erase the person, not just their row.
 *
 * Un-enrolling deleted the participants row and then wrote the person's name
 * into the append-only events log ("Un-enrolled participant \"...\""), which no
 * retention sweep touches - so the one act that means "forget me" was what
 * made the name permanent. SQLite also leaves deleted rows readable in free
 * pages unless secure_delete is on.
 *
 * Method, as elsewhere in this repo: search every resting place (the database
 * file, its WAL and SHM, every API payload), with a CONTROL that finds the
 * name before withdrawal - a search that cannot see the text proves nothing.
 */
const NAME = 'Zelda Quintero-Okafor';
const CLUSTER = 'SPEAKER_7';

function call(port: number, method: string, p: string, body?: unknown) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      { host: '127.0.0.1', port, method, path: p, headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload).toString() } : {} },
      (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({ status: res.statusCode || 0, body: d })); }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function bytesOnDisk(dbPath: string): string {
  return ['', '-wal', '-shm']
    .map((suffix) => dbPath + suffix)
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f).toString('latin1'))
    .join('\n');
}

describe('Consent withdrawal erases the person', () => {
  it('leaves the withdrawn name nowhere: not in the DB file, WAL, SHM, ledger or event feed', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bystander-erasure-'));
    const dbPath = path.join(dir, 'erasure.db');
    const { app, db } = createServer(dbPath);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as { port: number }).port;

    try {
      const enrol = await call(port, 'POST', '/api/consent/enrol', { clusterId: CLUSTER, name: NAME, role: 'BYSTANDER', status: 'CONSENTED' });
      assert.equal(enrol.status, 201);

      // CONTROL: while enrolled, the name must be findable, or the search below is blind.
      const ledgerBefore = await call(port, 'GET', '/api/ledger');
      assert.ok(ledgerBefore.body.includes(NAME), 'control: name must be visible in the ledger while enrolled');

      const withdraw = await call(port, 'DELETE', `/api/consent/${CLUSTER}`);
      assert.equal(withdraw.status, 200);

      const ledger = await call(port, 'GET', '/api/ledger');
      const events = await call(port, 'GET', '/api/events');
      assert.ok(!ledger.body.includes(NAME), 'name still in the ledger after withdrawal');
      assert.ok(!events.body.includes(NAME), 'name still in the event feed after withdrawal');
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
      db.close();
    }

    const disk = bytesOnDisk(dbPath);
    assert.ok(disk.length > 0, 'control: the database file must exist to be searched');
    assert.ok(!disk.includes(NAME), 'the withdrawn name is still readable in the database bytes on disk');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('control for the disk search: an enrolled name IS found in the bytes', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bystander-erasure-ctl-'));
    const dbPath = path.join(dir, 'control.db');
    const { app, db } = createServer(dbPath);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as { port: number }).port;
    await call(port, 'POST', '/api/consent/enrol', { clusterId: CLUSTER, name: NAME, role: 'BYSTANDER', status: 'CONSENTED' });
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
    assert.ok(bytesOnDisk(dbPath).includes(NAME), 'the byte search must be able to see a name that is really there');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

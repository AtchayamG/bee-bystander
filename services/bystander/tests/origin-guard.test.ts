import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../src/server.js';

/**
 * Cross-origin guard.
 *
 * This server holds a consent ledger. Before this test existed it answered
 * every origin with `Access-Control-Allow-Origin: *` and checked nothing, so
 * any web page open in the wearer's browser could PATCH a bystander from
 * REVOKED to CONSENTED over 127.0.0.1 and then read the speech that consent
 * had been protecting. The MCP Streamable HTTP spec also requires servers to
 * validate Origin on every connection (DNS rebinding).
 *
 * Browsers always send Origin on cross-site writes and cannot forge it, so
 * rejecting unknown origins on the server is the real control; CORS headers
 * alone only stop the attacker READING the response, not the write landing.
 * Requests with no Origin (curl, Node MCP clients, the test suite) are
 * non-browser callers already inside the machine and are allowed.
 */

const EVIL = 'https://evil.example';
const SURFACE = 'http://127.0.0.1:5175';

let server: http.Server;
let closeDb: () => void = () => {};
let port = 0;
let tmpDir = '';

function request(
  method: string,
  urlPath: string,
  opts: { origin?: string; host?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body);
    const headers: Record<string, string> = { ...(opts.headers || {}) };
    if (opts.origin) headers['Origin'] = opts.origin;
    if (opts.host) headers['Host'] = opts.host;
    if (payload !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

describe('Cross-origin guard (consent ledger + MCP endpoint)', () => {
  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bystander-origin-'));
    const { app, db } = createServer(path.join(tmpDir, 'origin.db'));
    closeDb = () => db.close();
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as { port: number }).port;
  });

  after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('refuses a consent flip from a foreign web origin, and the ledger is unchanged', async () => {
    const before = JSON.parse((await request('GET', '/api/ledger')).body);
    const target = before.ledger.find((p: { status: string }) => p.status !== 'CONSENTED');
    assert.ok(target, 'fixture ledger must contain a non-consented participant to attack');

    const attack = await request('PATCH', `/api/consent/${target.clusterId}`, {
      origin: EVIL,
      body: { status: 'CONSENTED' }
    });
    assert.equal(attack.status, 403, `foreign-origin PATCH must be refused, got ${attack.status}`);
    assert.notEqual(attack.headers['access-control-allow-origin'], '*');

    const afterLedger = JSON.parse((await request('GET', '/api/ledger')).body);
    const same = afterLedger.ledger.find((p: { clusterId: string }) => p.clusterId === target.clusterId);
    assert.equal(same.status, target.status, 'the refused write must not have landed');
  });

  it('refuses foreign-origin writes on every mutating route', async () => {
    const cases: Array<[string, string, unknown]> = [
      ['POST', '/api/consent', { clusterId: 'SPEAKER_9', status: 'CONSENTED' }],
      ['POST', '/api/consent/enrol', { clusterId: 'SPEAKER_9', name: 'x', role: 'BYSTANDER', status: 'CONSENTED' }],
      ['DELETE', '/api/consent/SPEAKER_1', undefined],
      ['POST', '/api/retention/purge', { conversationId: 101 }],
      ['POST', '/api/retention/config', { retentionDays: 1 }],
      ['POST', '/api/retention/sweep', {}]
    ];
    for (const [method, p, body] of cases) {
      const res = await request(method, p, { origin: EVIL, body });
      assert.equal(res.status, 403, `${method} ${p} from a foreign origin must be 403, got ${res.status}`);
    }
  });

  it('refuses a foreign-origin MCP initialize (spec: servers MUST validate Origin)', async () => {
    const res = await request('POST', '/mcp', {
      origin: EVIL,
      headers: { Accept: 'application/json, text/event-stream' },
      body: {
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'evil', version: '1' } }
      }
    });
    assert.equal(res.status, 403);
  });

  it('gives a foreign origin no CORS grant on preflight', async () => {
    const res = await request('OPTIONS', '/api/consent/SPEAKER_1', {
      origin: EVIL,
      headers: { 'Access-Control-Request-Method': 'PATCH' }
    });
    assert.ok(!res.headers['access-control-allow-origin'], 'no ACAO header may be granted to a foreign origin');
  });

  it('refuses a DNS-rebinding Host header even with no Origin', async () => {
    const res = await request('GET', '/api/ledger', { host: 'evil.example:3002' });
    assert.equal(res.status, 403);
  });

  it('still serves the real surface origin and non-browser callers', async () => {
    const fromSurface = await request('GET', '/api/ledger', { origin: SURFACE });
    assert.equal(fromSurface.status, 200);
    assert.equal(fromSurface.headers['access-control-allow-origin'], SURFACE);

    const fromCurl = await request('GET', '/api/status');
    assert.equal(fromCurl.status, 200);
  });
});

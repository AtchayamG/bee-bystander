import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createServer } from '../src/server.js';
import type { ServerContext } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DIR = path.resolve(__dirname, '../data/test-tmp');

function getTempDbPath(): string {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  return path.join(TEST_DIR, `test-mcp-${randomUUID()}.db`);
}

function cleanupDb(dbPath: string): void {
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    const wal = `${dbPath}-wal`;
    const shm = `${dbPath}-shm`;
    if (fs.existsSync(wal)) fs.unlinkSync(wal);
    if (fs.existsSync(shm)) fs.unlinkSync(shm);
  } catch {
    // ignore
  }
}

describe('D8 — Real MCP Streamable HTTP Client Flow In-Process', () => {
  let ctx: ServerContext;
  let server: http.Server;
  let baseUrl: string;
  let dbPath: string;

  before(async () => {
    dbPath = getTempDbPath();
    ctx = createServer(dbPath);
    server = http.createServer(ctx.app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    ctx.db.close();
    cleanupDb(dbPath);
  });

  test('MCP Streamable HTTP: initialize, list tools, and call bystander_get_transcript on consented and unconsented conversations', async () => {
    const postMcp = async (body: any, sessionId?: string) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      };
      if (sessionId) {
        headers['mcp-session-id'] = sessionId;
      }
      const res = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const resSessionId = res.headers.get('mcp-session-id');
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        // may be empty or non-JSON
      }
      return { status: res.status, sessionId: resSessionId, json };
    };

    // 1. Initialize with protocol floor
    const initRes = await postMcp({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'inprocess-test-client', version: '0.1.0' }
      }
    });

    assert.strictEqual(initRes.status, 200);
    assert.ok(initRes.sessionId, 'Server must return mcp-session-id header on initialize');
    assert.strictEqual(
      initRes.json?.result?.protocolVersion,
      '2025-11-25',
      'Server must confirm protocolVersion 2025-11-25'
    );
    const sessionId = initRes.sessionId as string;

    // 2. Initialized notification
    await postMcp(
      {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      },
      sessionId
    );

    // 3. Tools list request
    const listRes = await postMcp(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      },
      sessionId
    );

    assert.strictEqual(listRes.status, 200);
    const tools = listRes.json?.result?.tools;
    assert.ok(Array.isArray(tools), 'tools/list must return array of tools');
    assert.strictEqual(tools.length, 4, 'Must register exactly four verified MCP tools');
    const toolNames = tools.map((t: any) => t.name);
    assert.ok(toolNames.includes('bystander_get_transcript'));
    assert.ok(toolNames.includes('bystander_list_conversations'));
    assert.ok(toolNames.includes('bystander_get_consent_ledger'));
    assert.ok(toolNames.includes('bystander_verify_redactions'));

    // 4. Call bystander_get_transcript on consented conversation 101
    const call101Res = await postMcp(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'bystander_get_transcript',
          arguments: { id: 101 }
        }
      },
      sessionId
    );

    assert.strictEqual(call101Res.status, 200);
    const content101 = JSON.parse(call101Res.json?.result?.content[0]?.text);
    assert.strictEqual(content101.refused, false, 'Consented conversation 101 must not be refused');
    assert.ok(typeof content101.redactedTranscript === 'string');
    assert.ok(content101.redactedTranscript.includes('[REDACTED: EMAIL]'));
    assert.strictEqual(content101.redactedTranscript.includes('carol@partner-network.org'), false);
    assert.ok(content101.audit.totalRedactedChars > 0);
    assert.ok(content101.audit.totalRedactedWords > 0);
    assert.ok(typeof content101.summary === 'string' && content101.summary.length > 0);

    // 5. Call bystander_get_transcript on unconsented conversation 102
    const call102Res = await postMcp(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'bystander_get_transcript',
          arguments: { id: 102 }
        }
      },
      sessionId
    );

    assert.strictEqual(call102Res.status, 200);
    const content102 = JSON.parse(call102Res.json?.result?.content[0]?.text);
    assert.strictEqual(content102.refused, true, 'Unconsented conversation 102 must be refused');
    assert.strictEqual(content102.refusalCode, 'REFUSAL_UNCONSENTED_PARTICIPANTS');
    assert.ok(typeof content102.refusalReason === 'string' && content102.refusalReason.length > 0);
    assert.strictEqual(content102.summary, null, 'Summary must be withheld (null) when refused');
  });
});

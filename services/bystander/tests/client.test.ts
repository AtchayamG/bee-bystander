import { test, describe } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { BeeApiClient } from '../src/client.js';

async function withBeeProxy(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  run: (base: string) => Promise<void>
): Promise<void> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

describe('D4 — Bee API Client Unauthenticated Fallback & Token Secrecy', () => {
  test('rejects plain HTTP endpoints outside loopback', () => {
    assert.throws(
      () => new BeeApiClient({ apiBase: 'http://example.com' }),
      /loopback/i
    );
  });

  test('local proxy 200 /v1/me and an empty list stay live, never fixtures', async () => {
    const paths: string[] = [];
    await withBeeProxy((req, res) => {
      paths.push(req.url || '');
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/v1/me') {
        res.end(JSON.stringify({ id: 'private-user-value' }));
      } else if (req.url === '/v1/conversations') {
        res.end(JSON.stringify({ conversations: [] }));
      } else {
        res.statusCode = 404;
        res.end('{}');
      }
    }, async (apiBase) => {
      const client = new BeeApiClient({ apiBase });
      const result = await client.listConversations();
      assert.deepStrictEqual(paths, ['/v1/me', '/v1/conversations']);
      assert.deepStrictEqual(result.conversations, []);
      assert.strictEqual(result.mode, 'live');
      assert.strictEqual(result.viaProxy, true);
      assert.strictEqual(client.getStatus().mode, 'live');
      assert.strictEqual(client.getStatus().viaProxy, true);
      assert.strictEqual(client.getStatus().hasToken, false);
      assert.strictEqual(JSON.stringify(result).includes('private-user-value'), false);
    });
  });

  test('local proxy 401 is clearly fixture mode', async () => {
    await withBeeProxy((_req, res) => {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
    }, async (apiBase) => {
      const client = new BeeApiClient({ apiBase });
      const result = await client.listConversations();
      assert.strictEqual(result.mode, 'fixture');
      assert.strictEqual(result.apiStatus.code, 401);
      assert.ok(result.conversations.length > 0);
    });
  });

  test('with no token, client reports mode fixture and HTTP 401 status code', async () => {
    const client = new BeeApiClient({ token: undefined });

    // Initial status
    const status = client.getStatus();
    assert.strictEqual(status.mode, 'fixture');
    assert.strictEqual(status.hasToken, false);
    assert.strictEqual(status.code, 401);

    // listConversations should return fixture mode and real 401 status from the live probe
    const listRes = await client.listConversations();
    assert.strictEqual(listRes.mode, 'fixture');
    assert.strictEqual(listRes.apiStatus.code, 401);
    assert.ok(listRes.conversations.length >= 2, 'Should return fixture conversations');

    // getConversation should return fixture mode and real 401 status
    const convRes = await client.getConversation(101);
    assert.strictEqual(convRes.mode, 'fixture');
    assert.strictEqual(convRes.apiStatus.code, 401);
    assert.strictEqual(convRes.conversation?.id, 101);
  });

  test('token secrecy guard: token is never exposed in status or response payloads', async () => {
    const secretToken = 'do-not-leak-this-token-xyz-987';
    // Instantiate with a token to test the secrecy boundary
    const client = new BeeApiClient({ token: secretToken });

    const status = client.getStatus();
    assert.strictEqual(status.hasToken, true);

    const serializedStatus = JSON.stringify(status);
    assert.strictEqual(
      serializedStatus.includes(secretToken),
      false,
      'getStatus() output must never contain the token string'
    );
    assert.strictEqual(
      serializedStatus.includes(secretToken.slice(0, 4)),
      false,
      'getStatus() output must never contain token prefix'
    );
  });
});

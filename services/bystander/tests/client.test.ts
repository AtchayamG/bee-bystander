import { test, describe } from 'node:test';
import assert from 'node:assert';
import { BeeApiClient } from '../src/client.js';

describe('D4 — Bee API Client Unauthenticated Fallback & Token Secrecy', () => {
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

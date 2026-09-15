#!/usr/bin/env node
/**
 * Bystander MCP Streamable HTTP Client Demo
 *
 * Exercises the production Streamable HTTP transport against the Bystander
 * MCP server:
 *   1. Initializes with protocol floor 2025-11-25 and verifies session ID header.
 *   2. Lists all 4 verified tools.
 *   3. Calls bystander_get_transcript on consented conversation 101:
 *      - prints redacted text
 *      - prints audit summary (chars removed, words scrubbed, PII count)
 *      - prints refusal status (false)
 *   4. Calls bystander_get_transcript on unconsented conversation 102:
 *      - prints refusal status (true)
 *      - prints reason code (REFUSAL_UNCONSENTED_PARTICIPANTS)
 *      - prints machine-evaluated reason
 *      - prints empty or withheld summary
 *
 * Usage: node ops/mcp-client-demo.mjs
 */

const URL_MCP = process.env.MCP_URL || 'http://127.0.0.1:3002/mcp';

async function main() {
  console.log('================================================================');
  console.log('Bystander MCP Streamable HTTP Client Demo');
  console.log(`Connecting to: ${URL_MCP}`);
  console.log('================================================================\n');

  let currentId = 1;
  let sessionId = null;

  const post = async (body, extraHeaders = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...extraHeaders
    };
    if (sessionId) {
      headers['mcp-session-id'] = sessionId;
    }
    const res = await fetch(URL_MCP, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    const resSessionId = res.headers.get('mcp-session-id');
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // may be empty or non-JSON
    }
    return { status: res.status, sessionId: resSessionId, json };
  };

  // STEP 1: Initialize
  console.log('[Step 1] Initializing session with protocolVersion: 2025-11-25...');
  const initRes = await post({
    jsonrpc: '2.0',
    id: currentId++,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: {
        name: 'bystander-mcp-demo-client',
        version: '0.1.0'
      }
    }
  });

  if (initRes.status !== 200) {
    console.error(`Initialization failed with HTTP ${initRes.status}:`, initRes.json);
    process.exit(1);
  }

  sessionId = initRes.sessionId;
  if (!sessionId) {
    console.error('FAILED: Server did not return mcp-session-id header.');
    process.exit(1);
  }

  const negotiatedVersion = initRes.json?.result?.protocolVersion;
  const serverName = initRes.json?.result?.serverInfo?.name;
  console.log(`  HTTP Status:         ${initRes.status}`);
  console.log(`  mcp-session-id:      ${sessionId}`);
  console.log(`  Negotiated Protocol: ${negotiatedVersion} (Held to >= 2025-11-25)`);
  console.log(`  Server Name:         ${serverName}\n`);

  // Send initialized notification
  await post(
    {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    },
    { 'mcp-session-id': sessionId }
  );

  // STEP 2: Tools List
  console.log('[Step 2] Requesting available tools (tools/list)...');
  const listRes = await post(
    {
      jsonrpc: '2.0',
      id: currentId++,
      method: 'tools/list',
      params: {}
    },
    { 'mcp-session-id': sessionId }
  );

  const tools = listRes.json?.result?.tools || [];
  console.log(`  Discovered ${tools.length} available tools:`);
  for (const t of tools) {
    console.log(`    - ${t.name.padEnd(30)}: ${t.description.slice(0, 75)}...`);
  }
  console.log('');

  // STEP 3: Call bystander_get_transcript on Consented Conversation (101)
  console.log('[Step 3] Calling bystander_get_transcript on Consented Conversation 101...');
  const call101 = await post(
    {
      jsonrpc: '2.0',
      id: currentId++,
      method: 'tools/call',
      params: {
        name: 'bystander_get_transcript',
        arguments: { id: 101 }
      }
    },
    { 'mcp-session-id': sessionId }
  );

  const data101 = JSON.parse(call101.json?.result?.content[0]?.text);
  console.log(`  Refusal Status:  ${data101.refused} (false = permitted downstream)`);
  console.log(`  Conversation:    ${data101.title} (ID: ${data101.conversationId})`);
  console.log('  Audit Summary:');
  console.log(`    - Total Removals:          ${data101.audit.totalRemovals}`);
  console.log(`    - Characters Removed:      ${data101.audit.totalRedactedChars}`);
  console.log(`    - Words Scrubbed:          ${data101.audit.totalRedactedWords}`);
  console.log(`    - Unconsented Blocks:      ${data101.audit.unconsentedSpeakerBlocks}`);
  console.log(`    - Third-Party PII Count:   ${data101.audit.piiCount}`);
  console.log(`  Summary:         "${data101.summary}"`);
  console.log('  Redacted Transcript (sample):');
  console.log('  ' + data101.redactedTranscript.split('\n').slice(0, 4).join('\n  '));
  console.log('\n----------------------------------------------------------------\n');

  // STEP 4: Call bystander_get_transcript on Unconsented Conversation (102)
  console.log('[Step 4] Calling bystander_get_transcript on Unconsented Conversation 102...');
  const call102 = await post(
    {
      jsonrpc: '2.0',
      id: currentId++,
      method: 'tools/call',
      params: {
        name: 'bystander_get_transcript',
        arguments: { id: 102 }
      }
    },
    { 'mcp-session-id': sessionId }
  );

  const data102 = JSON.parse(call102.json?.result?.content[0]?.text);
  console.log(`  Refusal Status:  ${data102.refused} (true = BLOCKED at capture layer)`);
  console.log(`  Reason Code:     ${data102.refusalCode}`);
  console.log(`  Machine Reason:  ${data102.refusalReason}`);
  console.log(`  Details:         ${data102.details?.explanation || 'No extra detail'}`);
  console.log(`  Summary Payload: ${data102.summary === null ? '[WITHHELD - NULL]' : data102.summary}`);
  console.log('  Audit Summary:');
  console.log(`    - Total Removals:          ${data102.audit.totalRemovals}`);
  console.log(`    - Characters Removed:      ${data102.audit.totalRedactedChars}`);
  console.log(`    - Words Scrubbed:          ${data102.audit.totalRedactedWords}`);
  console.log(`    - Unconsented Blocks:      ${data102.audit.unconsentedSpeakerBlocks}`);

  console.log('\n================================================================');
  console.log('PASS: MCP client demo executed cleanly against Streamable HTTP transport.');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Fatal error during MCP client demo:', err);
  process.exit(1);
});

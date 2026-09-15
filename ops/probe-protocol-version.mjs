/**
 * Bystander MCP Protocol Version Probe
 *
 * Verifies that the Bystander MCP server strictly enforces the hackathon
 * minimum protocol floor of 2025-11-25 across Streamable HTTP.
 *
 * Usage: node ops/probe-protocol-version.mjs (server running on :3002)
 */

const URL_MCP = process.env.MCP_URL || 'http://127.0.0.1:3002/mcp';

const post = async (body, extraHeaders = {}) => {
  const res = await fetch(URL_MCP, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, sessionId: res.headers.get('mcp-session-id'), json };
};

const init = (protocolVersion) => ({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    ...(protocolVersion === undefined ? {} : { protocolVersion }),
    capabilities: {},
    clientInfo: { name: 'bystander-protocol-probe', version: '0.1.0' }
  }
});

const cases = [
  ['client asks for 2025-11-25 (the hackathon minimum)', '2025-11-25'],
  ['client asks for 2025-06-18 (below floor)', '2025-06-18'],
  ['client asks for 2025-03-26 (SDK default)', '2025-03-26'],
  ['client asks for 2024-11-05 (legacy)', '2024-11-05'],
  ['client omits protocolVersion entirely', undefined],
  ['client asks for non-existent 2099-01-01', '2099-01-01']
];

console.log(`Probing Bystander MCP Protocol Negotiation at ${URL_MCP}\n`);
console.log('request'.padEnd(52), 'HTTP', 'negotiated');
console.log('-'.repeat(52), '----', '-'.repeat(12));

let allCompliant = true;

for (const [label, version] of cases) {
  try {
    const { status, json } = await post(init(version));
    const negotiated =
      json?.result?.protocolVersion ??
      (json?.error ? `error ${json.error.code}: ${String(json.error.message).slice(0, 60)}` : '(none)');
    console.log(label.padEnd(52), String(status).padEnd(4), negotiated);

    // If version is older than 2025-11-25, it must be raised to 2025-11-25
    if (version && version < '2025-11-25' && negotiated !== '2025-11-25') {
      allCompliant = false;
    }
  } catch (err) {
    console.log(label.padEnd(52), 'ERR ', err.message);
    allCompliant = false;
  }
}

console.log('\nEvaluation against Hackathon Protocol Floor (2025-11-25):');
if (allCompliant) {
  console.log('PASS: All sub-floor negotiations held at 2025-11-25 minimum.');
} else {
  console.error('FAIL: Server negotiated a sub-floor protocol version.');
  process.exit(1);
}

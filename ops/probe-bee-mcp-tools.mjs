// Measures Bee's own MCP server: what protocol version it negotiates, and how
// many tools it exposes.
//
//     node ops\probe-bee-mcp-tools.mjs
//
// Why this exists. Bystander's whole MCP argument is that the hackathon's
// 2025-11-25 floor has to be measured rather than claimed, because the SDK will
// silently serve an older dialect if a client asks for one. That claim is worth
// more if it is checked against the platform's own server instead of only our
// own. So this probe asks Bee's MCP server to initialize at 2025-11-25 and
// prints what comes back.
//
// It sends no credentials. Tool discovery turns out not to need any, which is
// itself the finding that makes this reproducible for a judge with no Bee
// account.
import { spawn } from 'node:child_process';

const REQUESTED = '2025-11-25';
const CLI = 'npx';
const ARGS = ['-y', '@beeai/cli@0.7.3', 'mcp', 'serve'];

// Cold-start budget. npx resolving and unpacking the CLI took longer than the
// handshake did on the first attempt here, which looked exactly like a server
// that never answered. Everything below is paced off this.
const START_MS = 10000;

// shell:true is required on Windows: npx is a .cmd shim, and Node 22 refuses to
// spawn one directly (EINVAL, errno -4071). The earlier "no response" run was
// the cold-start budget, not the shell.
const child = spawn(CLI, ARGS, {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: process.platform === 'win32'
});

let out = '';
let err = '';
child.stdout.on('data', (d) => (out += d));
child.stderr.on('data', (d) => (err += d));
child.on('error', (e) => {
  console.error(`FAIL: could not start "${CLI} ${ARGS.join(' ')}": ${e.message}`);
  process.exit(2);
});

const send = (o) => child.stdin.write(JSON.stringify(o) + '\n');

setTimeout(
  () =>
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: REQUESTED,
        capabilities: {},
        clientInfo: { name: 'bystander-orchestrator-probe', version: '0.1.0' }
      }
    }),
  START_MS
);
setTimeout(() => send({ jsonrpc: '2.0', method: 'notifications/initialized' }), START_MS + 1500);
setTimeout(() => send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }), START_MS + 3000);

setTimeout(() => {
  child.kill();

  let negotiated = null;
  let tools = null;
  let listError = null;

  for (const line of out.split('\n').filter(Boolean)) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id === 1) negotiated = msg.result?.protocolVersion ?? `error: ${JSON.stringify(msg.error)}`;
    if (msg.id === 2) {
      if (msg.error) listError = JSON.stringify(msg.error);
      else tools = (msg.result?.tools ?? []).map((t) => t.name).sort();
    }
  }

  console.log(`\nBee MCP server  (${CLI} ${ARGS.join(' ')}), stdio transport\n`);
  console.log(`  client requested protocolVersion : ${REQUESTED}`);
  console.log(`  server negotiated                : ${negotiated ?? '(no initialize response)'}`);
  console.log(`  authorization sent               : none`);

  if (listError) {
    console.log(`  tools/list                       : error ${listError}`);
  } else if (tools) {
    console.log(`  tools/list                       : ${tools.length} tools, unauthenticated\n`);
    for (const t of tools) console.log(`    ${t}`);
  } else {
    console.log('  tools/list                       : (no response)');
  }

  if (err.trim()) {
    console.log('\n  stderr:');
    console.log(
      err
        .trim()
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n')
    );
  }

  console.log('\nEvaluation against the hackathon protocol floor (2025-11-25):');
  if (negotiated === null) {
    // Do not read silence as a downgrade. The first run of this probe reported
    // "answered with null" because npx had not finished starting the server,
    // which is a probe bug, not a platform finding.
    console.log(`  INCONCLUSIVE: no initialize response within the budget.`);
    console.log(`  Raise START_MS and re-run. Do not quote this run as a result.`);
    process.exit(3);
  } else if (negotiated === REQUESTED) {
    console.log(`  Bee's server held the floor.`);
  } else {
    console.log(`  Bee's server answered a ${REQUESTED} request with ${negotiated}.`);
    console.log(`  A client that trusts the negotiated version is speaking an older dialect`);
    console.log(`  than it asked for, with no error and no warning.`);
  }
  console.log('');
  process.exit(0);
}, START_MS + 8000);

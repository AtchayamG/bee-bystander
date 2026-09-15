// Reproducible live probe of the Bee developer API.
//
// This exists because the README makes two "VERIFIED" claims about the live
// host - that the system trust store rejects it and that PROD_ROOT_CA accepts
// it, and that an unauthenticated call returns 401 - and a claim is only
// verified if a judge can re-run the thing that produced it. Run:
//
//     node ops\probe-bee-live.mjs
//
// It sends no credentials and prints no secrets. If BEE_TOKEN happens to be
// set in the environment it is deliberately NOT read here: the point of the
// probe is the unauthenticated path.
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Read the PEM out of certs.ts rather than duplicating it, so the probe can
// never drift from the CA the service actually uses.
const certsSrc = readFileSync(join(here, '..', 'services', 'bystander', 'src', 'certs.ts'), 'utf8');
const pem = certsSrc.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
if (!pem) {
  console.error('FAIL: could not find a PEM block in services/bystander/src/certs.ts');
  process.exit(2);
}
const PROD_ROOT_CA = pem[0];

const HOST = 'app-api-developer.ce.bee.amazon.dev';
const PATH = '/v1/me';

function probe(label, agentOptions) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: HOST,
        path: PATH,
        method: 'GET',
        agent: new https.Agent(agentOptions),
        timeout: 15000
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () =>
          resolve({ label, status: res.statusCode, body: body.slice(0, 120).replace(/\s+/g, ' ') })
        );
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('timeout after 15s'));
    });
    req.on('error', (err) => resolve({ label, error: `${err.code || ''} ${err.message}`.trim() }));
    req.end();
  });
}

const results = [];
results.push(await probe('system trust store only (no custom CA)', {}));
results.push(await probe('PROD_ROOT_CA supplied', { ca: PROD_ROOT_CA }));

console.log(`\nGET https://${HOST}${PATH}  (no Authorization header sent)\n`);
for (const r of results) {
  console.log(`  ${r.label}`);
  if (r.error) console.log(`    -> transport error: ${r.error}`);
  else console.log(`    -> HTTP ${r.status}  body: ${r.body || '(empty)'}`);
}

const [plain, withCa] = results;
console.log('\nEvaluation');
console.log(
  `  system trust store:  ${plain.error ? 'REJECTED at transport (' + plain.error + ')' : 'reached the app, HTTP ' + plain.status}`
);
console.log(
  `  with PROD_ROOT_CA:   ${withCa.error ? 'REJECTED at transport (' + withCa.error + ')' : 'reached the app, HTTP ' + withCa.status}`
);
console.log(
  '\nWhat this does and does not show: it shows whether the TLS chain validates\n' +
    'and what an unauthenticated request returns. It says nothing about the\n' +
    'authenticated API surface, which needs a paired device this machine does\n' +
    'not have.\n'
);

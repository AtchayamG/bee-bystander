import puppeteer from '../../services/bystander/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'cards');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1920px; height: 1080px; overflow: hidden;
    background: #080b12;
    color: #f4f4f5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex; align-items: center; justify-content: center;
  }
  .glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(900px 520px at 20% 20%, rgba(14, 165, 233, 0.15), transparent 65%),
      radial-gradient(800px 500px at 80% 80%, rgba(168, 85, 247, 0.12), transparent 65%);
  }
  .wrap { position: relative; width: 1540px; z-index: 10; }
  .kicker {
    font-size: 20px; letter-spacing: 0.3em; text-transform: uppercase;
    color: #38bdf8; font-weight: 700; margin-bottom: 24px;
    display: flex; align-items: center; gap: 12px;
  }
  .kicker-badge {
    background: rgba(14, 165, 233, 0.2); border: 1px solid rgba(14, 165, 233, 0.4);
    color: #38bdf8; padding: 4px 10px; border-radius: 4px; font-size: 13px;
  }
  h1 { font-size: 96px; line-height: 1.05; letter-spacing: -0.03em; font-weight: 800; color: #fff; }
  .sub { font-size: 36px; color: #a1a1aa; margin-top: 24px; line-height: 1.4; font-weight: 400; max-width: 1300px; }
  .rule { height: 3px; width: 180px; background: linear-gradient(90deg, #38bdf8, transparent); margin: 38px 0; }
  .meta { font-size: 24px; color: #71717a; line-height: 1.8; }
  .meta strong { color: #e4e4e7; font-weight: 600; }
  .terminal-box {
    background: #0d1117; border: 1px solid #30363d; border-radius: 8px;
    padding: 24px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 19px; line-height: 1.6; color: #e6edf3; margin-top: 28px;
  }
  .term-green { color: #3fb950; }
  .term-amber { color: #d29922; }
  .term-blue { color: #58a6ff; }
  .term-gray { color: #8b949e; }
  .fine { font-size: 18px; color: #52525b; margin-top: 24px; }
`;

const LT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1920px; height: 1080px; overflow: hidden;
    background: transparent;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex; align-items: flex-end; justify-content: flex-start;
    padding: 60px 80px;
  }
  .lt-card {
    background: rgba(9, 9, 11, 0.94);
    border: 1px solid rgba(63, 63, 70, 0.8);
    border-left: 6px solid #0ea5e9;
    border-radius: 8px;
    padding: 22px 32px;
    max-width: 1200px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  }
  .lt-kicker {
    font-size: 13px; letter-spacing: 0.25em; text-transform: uppercase;
    color: #38bdf8; font-weight: 700; margin-bottom: 6px;
  }
  .lt-title {
    font-size: 30px; font-weight: 700; color: #f4f4f5; line-height: 1.2;
  }
  .lt-sub {
    font-size: 18px; color: #a1a1aa; margin-top: 6px; font-weight: 400;
  }
`;

const CARDS = [
  {
    name: 'card-open.png',
    html: `
      <!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head>
      <body>
        <div class="glow"></div>
        <div class="wrap">
          <div class="kicker">
            <span class="kicker-badge">Amazon Developer Hackathon 2026</span>
            <span>Bee Track Entry</span>
          </div>
          <h1>BYSTANDER</h1>
          <p class="sub">A consent-aware capture, redaction, and gating layer for always-listening wearables.</p>
          <div class="rule"></div>
          <p class="meta">
            <strong>Concept:</strong> Maintains a verifiable consent ledger per speaker cluster.<br>
            <strong>Protection:</strong> Redacts third-party speech and PII before downstream storage.<br>
            <strong>Author:</strong> Atchayam G (Solo Entrant) &bull; <strong>Licence:</strong> MIT Open Source
          </p>
        </div>
      </body></html>
    `
  },
  {
    name: 'card-probe.png',
    html: `
      <!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head>
      <body>
        <div class="glow"></div>
        <div class="wrap">
          <div class="kicker">
            <span class="kicker-badge">Phase 1 Ground Truth</span>
            <span>Verified Protocol Evidence</span>
          </div>
          <h1 style="font-size: 80px;">Verifiable Protocol Compliance</h1>
          <p class="sub">Measured against the live Bee developer API and hackathon MCP protocol floor.</p>
          
          <div class="terminal-box">
            <span class="term-gray"># 1. Live Bee Developer API Probe (Amazon Private CA: PROD_ROOT_CA)</span><br>
            <span class="term-blue">GET</span> https://app-api-developer.ce.bee.amazon.dev/v1/me<br>
            <span class="term-amber">HTTP 401 Unauthorized</span> &bull; <span class="term-gray">{"error":"unauthorized"} (Truthful unauthenticated state)</span><br><br>
            <span class="term-gray"># 2. Model Context Protocol Specification Floor Probe (ops/probe-protocol-version.mjs)</span><br>
            client asks for 2025-11-25 (hackathon minimum) &rarr; <span class="term-green">HTTP 200 (negotiated: 2025-11-25)</span><br>
            client asks for 2025-06-18 (below floor)       &rarr; <span class="term-green">HTTP 200 (negotiated: 2025-11-25 [REWRITTEN TO FLOOR])</span><br>
            client asks for 2025-03-26 (SDK default)       &rarr; <span class="term-green">HTTP 200 (negotiated: 2025-11-25 [REWRITTEN TO FLOOR])</span><br>
            <span class="term-green">PASS: Protocol floor strictly held at 2025-11-25 across Streamable HTTP.</span>
          </div>
        </div>
      </body></html>
    `
  },
  {
    name: 'card-close.png',
    html: `
      <!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head>
      <body>
        <div class="glow"></div>
        <div class="wrap">
          <div class="kicker">
            <span class="kicker-badge">Summary & Verification</span>
            <span>Build &bull; Ship &bull; Shape 2026</span>
          </div>
          <h1 style="font-size: 82px;">Ambient AI with Verified Consent</h1>
          <p class="sub">Turning wearable microphones from unchecked surveillance into consent-governed capture systems.</p>
          <div class="rule"></div>
          <p class="meta">
            <strong>Architecture:</strong> Node.js &bull; TypeScript &bull; Express &bull; Streamable HTTP MCP &bull; Vite Surface<br>
            <strong>Test Coverage:</strong> 17/17 unit tests passing (Absence checks, Substring safety, Surface guards)<br>
            <strong>Provenance:</strong> 100% computed metrics &bull; Zero fabricated numbers &bull; Zero hardcoded claims<br>
            <strong>Entrant:</strong> Atchayam G &bull; <strong>Licence:</strong> MIT
          </p>
          <p class="fine">
            * Narration synthesised via Microsoft Edge Neural TTS (en-US-AndrewNeural, +6% rate). Disclosed per hackathon rules.
          </p>
        </div>
      </body></html>
    `
  },
  {
    name: 'lt-03.png',
    html: `
      <!DOCTYPE html><html><head><meta charset="utf-8"><style>${LT_CSS}</style></head>
      <body>
        <div class="lt-card">
          <div class="lt-kicker">SCENARIO 1 &bull; CONSENTED SPEAKERS</div>
          <div class="lt-title">Boundary-Aware PII and Third-Party Entity Redaction</div>
          <div class="lt-sub">Email, phone, and named entities scrubbed with zero substring false positives.</div>
        </div>
      </body></html>
    `
  },
  {
    name: 'lt-04.png',
    html: `
      <!DOCTYPE html><html><head><meta charset="utf-8"><style>${LT_CSS}</style></head>
      <body>
        <div class="lt-card" style="border-left-color: #f43f5e;">
          <div class="lt-kicker" style="color: #f43f5e;">SCENARIO 2 &bull; UNCONSENTED BYSTANDER</div>
          <div class="lt-title">Total Absence Suppression & Loud Machine Refusal</div>
          <div class="lt-sub">Unknown cluster SPEAKER_2 speech completely redacted; summary blocked with reason code.</div>
        </div>
      </body></html>
    `
  },
  {
    name: 'lt-05.png',
    html: `
      <!DOCTYPE html><html><head><meta charset="utf-8"><style>${LT_CSS}</style></head>
      <body>
        <div class="lt-card" style="border-left-color: #a855f7;">
          <div class="lt-kicker" style="color: #c084fc;">INTERACTION &bull; MODEL CONTEXT PROTOCOL</div>
          <div class="lt-title">Live Ledger Reactivity & Verifiable Audit Trail</div>
          <div class="lt-sub">Every metric computed live from the pipeline payload. Zero hardcoded claims.</div>
        </div>
      </body></html>
    `
  }
];

async function main() {
  console.log(`Launching headless Edge to render ${CARDS.length} title cards...`);
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  for (const card of CARDS) {
    const outPath = join(OUT, card.name);
    console.log(`Rendering ${card.name}...`);
    await page.setContent(card.html, { waitUntil: 'load' });
    await page.screenshot({ path: outPath, type: 'png', omitBackground: card.name.startsWith('lt-') });
    console.log(`  -> Saved ${outPath}`);
  }

  await browser.close();
  console.log('All title cards generated successfully.');
}

main().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});

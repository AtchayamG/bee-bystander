import puppeteer from '../../services/bystander/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FRAMES = join(here, 'frames');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SURFACE_URL = 'http://127.0.0.1:5175/';
const BACKEND_HEALTH = 'http://127.0.0.1:3002/api/status';

const vo = JSON.parse(readFileSync(join(here, 'vo-manifest.json'), 'utf8'));
const voDur = (id) => {
  const seg = vo.segments.find((s) => s.id === id);
  if (!seg) throw new Error(`No voiceover measured for ${id}`);
  return seg.durationSec;
};

const PAD = 1.4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function assertServersUp() {
  try {
    const res = await fetch(BACKEND_HEALTH);
    if (!res.ok) throw new Error(`Backend returned HTTP ${res.status}`);
    const body = await res.json();
    console.log(`[record] Backend up: ${body.service} (${body.participants.length} ledger participants)`);
  } catch (err) {
    console.error('\n[record] FAIL: Bystander backend not running on 127.0.0.1:3002.');
    console.error('[record] Start servers from source first:');
    console.error('    ops\\run-both-detached.cmd\n');
    process.exit(2);
  }

  try {
    const res = await fetch(SURFACE_URL);
    if (!res.ok) throw new Error(`Surface returned HTTP ${res.status}`);
    console.log(`[record] Surface web app up at ${SURFACE_URL}`);
  } catch (err) {
    console.error('\n[record] FAIL: Surface web app not running on 127.0.0.1:5175.');
    process.exit(2);
  }
}

async function recordSegment(page, segmentId, durationSec, actionFn) {
  const segDir = join(FRAMES, segmentId);
  if (existsSync(segDir)) rmSync(segDir, { recursive: true });
  mkdirSync(segDir, { recursive: true });

  const fps = 30;
  const totalFrames = Math.round(durationSec * fps);
  console.log(`[record] Recording ${segmentId}: ${durationSec.toFixed(2)}s (${totalFrames} frames @ ${fps}fps)...`);

  const concatLines = [];
  const frameInterval = 1000 / fps;
  let frameIdx = 0;

  const actionPromise = actionFn(page, durationSec);

  const startTime = Date.now();
  for (let i = 0; i < totalFrames; i++) {
    const frameFile = `frame_${String(frameIdx).padStart(5, '0')}.jpg`;
    const framePath = join(segDir, frameFile);

    await page.screenshot({
      path: framePath,
      type: 'jpeg',
      quality: 90
    });

    concatLines.push(`file '${frameFile}'`);
    concatLines.push(`duration ${(1 / fps).toFixed(6)}`);
    frameIdx++;

    const elapsed = Date.now() - startTime;
    const target = frameIdx * frameInterval;
    if (target > elapsed) {
      await sleep(target - elapsed);
    }
  }

  // Duplicate last frame without duration for ffmpeg concat demuxer
  concatLines.push(`file 'frame_${String(frameIdx - 1).padStart(5, '0')}.jpg'`);
  writeFileSync(join(segDir, 'concat.txt'), concatLines.join('\n'));

  await actionPromise;
  console.log(`[record]   -> Completed ${segmentId}: ${frameIdx} frames captured.`);
  return { id: segmentId, frames: frameIdx, durationSec, fps };
}

async function main() {
  await assertServersUp();

  console.log(`Launching headless Edge for high-fidelity 1920x1080 capture...`);
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  await page.goto(SURFACE_URL, { waitUntil: 'networkidle0' });
  await sleep(1000);

  const clips = [];

  // CLIP 1: vo-03 (Scenario 101 - Consented speakers with third-party PII redaction)
  const dur03 = voDur('vo-03') + PAD;
  const clip03 = await recordSegment(page, 'clip-03', dur03, async (p, dur) => {
    // Smooth scroll down to show redactions and audit table
    await sleep(2000);
    await p.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await sleep(4000);
    await p.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await sleep(Math.max(1000, (dur - 8) * 1000));
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  });
  clips.push(clip03);

  // CLIP 2: vo-04 (Scenario 102 - Unconsented bystander and refusal)
  const dur04 = voDur('vo-04') + PAD;
  const clip04 = await recordSegment(page, 'clip-04', dur04, async (p, dur) => {
    // Switch to scenario 102
    await sleep(1500);
    await p.select('#scenarioSelect', '102');
    await sleep(2000);
    // Scroll down to highlight refusal banner and SPEAKER_2 suppression
    await p.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await sleep(5000);
    await p.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await sleep(Math.max(1000, (dur - 10) * 1000));
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  });
  clips.push(clip04);

  // CLIP 3: vo-05 (Reactivity & MCP)
  const dur05 = voDur('vo-05') + PAD;
  const clip05 = await recordSegment(page, 'clip-05', dur05, async (p, dur) => {
    // Switch to scenario 101
    await sleep(1000);
    await p.select('#scenarioSelect', '101');
    await sleep(1500);
    // Click toggle on Bob (SPEAKER_1) to show live reactivity
    await p.evaluate(() => {
      const btn = document.querySelector('button[data-cluster="SPEAKER_1"]');
      if (btn) btn.click();
    });
    await sleep(4000);
    // Toggle back to CONSENTED
    await p.evaluate(() => {
      const btn = document.querySelector('button[data-cluster="SPEAKER_1"]');
      if (btn) btn.click();
    });
    await sleep(3000);
    // Scroll down to show audit table
    await p.evaluate(() => window.scrollBy({ top: 450, behavior: 'smooth' }));
    await sleep(Math.max(1000, (dur - 10) * 1000));
  });
  clips.push(clip05);

  await browser.close();

  const manifest = {
    capturedAt: new Date().toISOString(),
    clips
  };
  writeFileSync(join(FRAMES, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nAll 3 screencast clips recorded successfully. Manifest saved.`);
}

main().catch((err) => {
  console.error('[record] Fatal error:', err);
  process.exit(1);
});

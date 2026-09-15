// Paced screencast recorder for the four-view Bystander application.
//
//   ops\run-both-detached.cmd     (start the backend and the surface first)
//   node ops\video\record.mjs
//
// Four clips, one per view, each cut to its own narration segment's measured
// length. The previous version recorded a single scrolling page in three
// clips; the application now has four views and the narration was rewritten to
// match, so the choreography had to follow rather than the other way round.
//
// Every interaction here is a real click or a real keystroke against the
// running app: the enrolment form is typed into, the un-enrol button is
// pressed, the purge modal is confirmed. Nothing is staged by injecting DOM.
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
    console.log(
      `[record] Backend up: ${body.service}, ${body.participants.length} ledger participants, ` +
        `journal ${body.storage?.journalMode}, ${body.mcpTools?.length} MCP tools`
    );
  } catch {
    console.error('\n[record] FAIL: Bystander backend not running on 127.0.0.1:3002.');
    console.error('[record] Start servers from source first:  ops\\run-both-detached.cmd\n');
    process.exit(2);
  }

  try {
    const res = await fetch(SURFACE_URL);
    if (!res.ok) throw new Error(`Surface returned HTTP ${res.status}`);
    console.log(`[record] Surface web app up at ${SURFACE_URL}`);
  } catch {
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
    await page.screenshot({ path: join(segDir, frameFile), type: 'jpeg', quality: 90 });

    concatLines.push(`file '${frameFile}'`);
    concatLines.push(`duration ${(1 / fps).toFixed(6)}`);
    frameIdx++;

    const elapsed = Date.now() - startTime;
    const target = frameIdx * frameInterval;
    if (target > elapsed) await sleep(target - elapsed);
  }

  // Duplicate last frame without duration, for the ffmpeg concat demuxer.
  concatLines.push(`file 'frame_${String(frameIdx - 1).padStart(5, '0')}.jpg'`);
  writeFileSync(join(segDir, 'concat.txt'), concatLines.join('\n'));

  await actionPromise;
  console.log(`[record]   -> ${segmentId}: ${frameIdx} frames captured.`);
  return { id: segmentId, frames: frameIdx, durationSec, fps };
}

const go = (page, hash) => page.evaluate((h) => { window.location.hash = h; }, hash);

async function main() {
  await assertServersUp();

  console.log('Launching headless Edge for 1920x1080 capture...');
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(SURFACE_URL, { waitUntil: 'networkidle0' });
  await sleep(1200);

  const clips = [];

  // CLIP 1 (vo-03) - Capture view: consented scrub, then the cafe refusal.
  const clip03 = await recordSegment(page, 'clip-03', voDur('vo-03') + PAD, async (p, dur) => {
    await go(p, '#capture');
    await sleep(1500);
    await p.select('#scenarioSelect', '101');
    await sleep(3500);
    await p.evaluate(() => window.scrollBy({ top: 620, behavior: 'smooth' }));
    await sleep(4500);
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1200);
    // The cafe: an unenrolled cluster speaks and the gate refuses.
    await p.select('#scenarioSelect', '102');
    await sleep(3000);
    await p.evaluate(() => window.scrollBy({ top: 420, behavior: 'smooth' }));
    await sleep(Math.max(1000, (dur - 16) * 1000));
  });
  clips.push(clip03);

  // CLIP 2 (vo-04) - Ledger view: enrol a cluster, then un-enrol Bob.
  const clip04 = await recordSegment(page, 'clip-04', voDur('vo-04') + PAD, async (p, dur) => {
    await go(p, '#ledger');
    await sleep(2000);
    // Type into the real form, slowly enough to read.
    await p.click('#enrol-cluster');
    await p.type('#enrol-cluster', 'SPEAKER_3', { delay: 90 });
    await p.click('#enrol-name');
    await p.type('#enrol-name', 'Dana (barista)', { delay: 70 });
    await p.select('#enrol-role', 'BYSTANDER');
    await sleep(400);
    await p.select('#enrol-status', 'UNKNOWN');
    await sleep(400);
    await p.click('#enrol-notes');
    await p.type('#enrol-notes', 'Behind the counter. Not asked.', { delay: 45 });
    await sleep(600);
    await p.evaluate(() => {
      const form = document.getElementById('enrol-form');
      const btn = form && (form.querySelector('button[type="submit"]') || form.querySelector('.btn-primary'));
      if (btn) btn.click();
    });
    await sleep(3200);
    await p.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
    await sleep(2500);
    // Un-enrol Bob (SPEAKER_1), a CONSENTED participant.
    await p.evaluate(() => {
      const btn = document.querySelector('.btn-unenrol-ledger[data-cluster="SPEAKER_1"]');
      if (btn) btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    await sleep(900);
    await p.evaluate(() => {
      const btn = document.querySelector('.btn-unenrol-ledger[data-cluster="SPEAKER_1"]');
      if (btn) btn.click();
    });
    await sleep(2600);
    // Back to capture: the gate has followed the ledger.
    await go(p, '#capture');
    await sleep(1200);
    await p.select('#scenarioSelect', '101');
    await sleep(Math.max(1000, (dur - 20) * 1000));
  });
  clips.push(clip04);

  // CLIP 3 (vo-05) - Audit view: stored records, export, then a real purge.
  const clip05 = await recordSegment(page, 'clip-05', voDur('vo-05') + PAD, async (p, dur) => {
    await go(p, '#audit');
    await sleep(3000);
    await p.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await sleep(3500);
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1200);
    await p.evaluate(() => document.getElementById('btn-open-purge')?.click());
    await sleep(3500);
    await p.evaluate(() => document.getElementById('modal-confirm-btn')?.click());
    await sleep(Math.max(1000, (dur - 16) * 1000));
  });
  clips.push(clip05);

  // CLIP 4 (vo-06) - Settings view: measured invariants, tools, floor.
  const clip06 = await recordSegment(page, 'clip-06', voDur('vo-06') + PAD, async (p, dur) => {
    await go(p, '#settings');
    await sleep(3000);
    await p.evaluate(() => window.scrollBy({ top: 200, behavior: 'smooth' }));
    await sleep(Math.max(1000, (dur - 5) * 1000));
  });
  clips.push(clip06);

  await browser.close();

  writeFileSync(
    join(FRAMES, 'manifest.json'),
    JSON.stringify({ capturedAt: new Date().toISOString(), clips }, null, 2)
  );
  console.log(`\nAll ${clips.length} screencast clips recorded. Manifest saved.`);
}

main().catch((err) => {
  console.error('[record] Fatal error:', err);
  process.exit(1);
});

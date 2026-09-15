import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const VO = join(here, 'vo');
if (!existsSync(VO)) mkdirSync(VO, { recursive: true });

const VOICE = 'en-US-AndrewNeural';
const RATE = '+6%';

export const SEGMENTS = [
  {
    id: 'vo-01',
    text:
      "The Bee wearable is an always-listening ambient microphone worn into everyday spaces containing people who never consented to be recorded. " +
      "Bystander is an open-source consent and redaction layer built for the Bee developer ecosystem. " +
      "Instead of assuming consent away, it maintains a verifiable consent ledger per speaker cluster and protects bystander privacy."
  },
  {
    id: 'vo-02',
    text:
      "Phase 1 research probed the live Bee API. The findings shaped this architecture: " +
      "Bee's ASR produces anonymous cluster tags like SPEAKER 0 and SPEAKER 1, but no participant identity or wearer profile. " +
      "And live calls without a paired device honestly return HTTP 401 Unauthorized using Amazon's private root CA. " +
      "Bystander embraces this reality: it runs a real HTTPS client with verified offline fallback, clearly badging authentication status."
  },
  {
    id: 'vo-03',
    text:
      "Here in the live surface, we see an ambient capture. Alice and Bob are consented participants, but Bob shares sensitive third-party details. " +
      "Bystander scrubs the email, phone, and named entities with boundary-aware redaction, preventing subword false positives like Ann in annual. " +
      "Every redaction produces a machine-readable audit entry with exact spans and category tags."
  },
  {
    id: 'vo-04',
    text:
      "In Scenario 2, an unconsented bystander at a nearby table is picked up discussing medical details. " +
      "Because cluster SPEAKER 2 is unknown, Bystander strictly enforces the hard rule: unknown is never treated as consent. " +
      "The bystander's speech is completely suppressed by absence, and the downstream summarisation engine loudly refuses to generate a summary, naming the machine-readable reason."
  },
  {
    id: 'vo-05',
    text:
      "Bystander exposes this entire pipeline over the Model Context Protocol, holding the required 2025-11-25 protocol floor via Streamable HTTP. " +
      "Every number on this screen is computed from the live pipeline payload: zero hardcoded checkmarks, zero invented percentages, and zero unmeasured claims. " +
      "Bystander turns ambient audio from an unchecked surveillance risk into a consent-governed system."
  },
  {
    id: 'vo-06',
    text:
      "Bystander demonstrates that wearable AI agents can respect bystander privacy and verify consent without physical hardware gates. " +
      "Full source code, test suite, and research logs are open source."
  }
];

function ffprobeDuration(path) {
  const stdout = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path],
    { encoding: 'utf8' }
  );
  return parseFloat(stdout.trim());
}

console.log(`Generating ${SEGMENTS.length} voiceover segments with edge-tts (${VOICE}, ${RATE})...\n`);

const measured = [];
let totalDur = 0;

for (const seg of SEGMENTS) {
  const mp3 = join(VO, `${seg.id}.mp3`);
  console.log(`Synthesising ${seg.id}...`);
  execFileSync('edge-tts', [
    '--voice', VOICE,
    '--rate', RATE,
    '--text', seg.text,
    '--write-media', mp3
  ]);
  const dur = ffprobeDuration(mp3);
  measured.push({ ...seg, mp3, durationSec: dur });
  totalDur += dur;
  console.log(`  -> ${dur.toFixed(2)}s`);
}

const manifest = {
  voice: VOICE,
  rate: RATE,
  totalDurationSec: totalDur,
  segments: measured
};

writeFileSync(join(here, 'vo-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nTotal voiceover duration: ${totalDur.toFixed(2)}s (ceiling: 180s).`);
if (totalDur > 180) {
  console.error('[FAIL] Narration exceeds 180s limit!');
  process.exit(1);
} else {
  console.log('[PASS] Narration duration is strictly within hackathon limits.');
}

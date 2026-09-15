import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const VO = join(here, 'vo');
if (!existsSync(VO)) mkdirSync(VO, { recursive: true });

const VOICE = 'en-US-AndrewNeural';
const RATE = '+6%';

// Seven segments: two title cards, one per application view, and a close.
//
// Rewritten for the four-view application. The previous script narrated a
// single scrolling page and described features - persistence, enrolment,
// purge, export - that had not been built yet. Every claim below is visible on
// screen in the clip it accompanies.
export const SEGMENTS = [
  {
    id: 'vo-01',
    text:
      "An always-on microphone worn into a room has a second set of people in front of it: the ones who never agreed to anything. " +
      "Bee's developer surface is built entirely around the person wearing it. " +
      "Bystander is the layer for everyone else in the room - a consent ledger per speaker, and a summariser that refuses out loud rather than guessing."
  },
  {
    id: 'vo-02',
    text:
      "It has to be a ledger because consent cannot be looked up. " +
      "Bee's transcript API returns anonymous acoustic clusters - SPEAKER 0, SPEAKER 1, sometimes an empty string - with no identity and no flag marking the wearer. " +
      "Live calls from this machine return a real HTTP 401, and the host needs Amazon's private root CA before the connection survives the handshake at all. " +
      "Both of those are reproducible from a script in the repository."
  },
  {
    id: 'vo-03',
    text:
      "The capture view runs the pipeline. Alice and Bob both consented, but Bob names a third party who did not, " +
      "so the email, the phone number and the name are scrubbed with boundary-aware matching - Ann never matches inside annual. " +
      "Switch to the cafe, and an unenrolled cluster speaks. Unknown is never treated as consent: the turn is suppressed, " +
      "and the gate refuses with a machine-readable reason code instead of quietly summarising around it."
  },
  {
    id: 'vo-04',
    text:
      "Consent is state, so it needs somewhere to live. The ledger view enrols a speaker cluster with a role and a status and writes it to SQLite - " +
      "the event log underneath shows the initial seed and every retention sweep since. " +
      "Un-enrol a consented speaker and that cluster falls back to unknown, which means the capture view's gate flips to refused. " +
      "None of that is a special case. It is the same rule, applied to a ledger that changed."
  },
  {
    id: 'vo-05',
    text:
      "The audit trail is read back out of the database. Each record carries the category, the cluster, the character span and the size of what was removed - " +
      "and deliberately not the text, because an audit that reprints what it removed is not an audit. Export is JSON or RFC 4180 CSV. " +
      "And purge matters more than it looks: Bee's conversations endpoint is read-only, so a revocation can never delete anything upstream. " +
      "A local purge is the only place the word forget can mean anything."
  },
  {
    id: 'vo-06',
    text:
      "Everything on the settings view is read rather than asserted. The journal mode and the foreign-key state come from PRAGMA queries on the open database. " +
      "The tool list comes from the server, not from a sentence typed into the page. " +
      "And the protocol floor is measured, not claimed: a client asking for an older dialect is raised to 2025-11-25."
  },
  {
    id: 'vo-07',
    text:
      "Forty-eight tests across ten suites, four reproducible probe scripts, " +
      "and an absence check that searches the API payload, both exports, and the database file itself. All of it open source."
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

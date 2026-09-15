import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(here, '..', '..', 'docs', '06-demo-submission');
const OUT = join(OUT_DIR, 'bystander-demo.mp4');
const WORK = join(here, 'work');
const CARDS = join(here, 'cards');
const FRAMES = join(here, 'frames');
const VO = join(here, 'vo');

if (!existsSync(WORK)) mkdirSync(WORK, { recursive: true });
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const vo = JSON.parse(readFileSync(join(here, 'vo-manifest.json'), 'utf8'));
const rec = JSON.parse(readFileSync(join(FRAMES, 'manifest.json'), 'utf8'));

const voDur = (id) => {
  const seg = vo.segments.find((s) => s.id === id);
  if (!seg) throw new Error(`Missing VO duration for ${id}`);
  return seg.durationSec;
};

const clipInfo = (id) => {
  const c = rec.clips.find((item) => item.id === id);
  if (!c) throw new Error(`Missing clip info for ${id}`);
  return c;
};

const PAD = 1.4;
const ff = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });

// Seven segments: two cards, one clip per application view, one close card.
const TIMELINE = [
  { id: 'vo-01', kind: 'card', src: join(CARDS, 'card-open.png'), dur: voDur('vo-01') + 1.0 },
  { id: 'vo-02', kind: 'card', src: join(CARDS, 'card-probe.png'), dur: voDur('vo-02') + 1.0 },
  { id: 'vo-03', kind: 'clip', clipId: 'clip-03', lt: join(CARDS, 'lt-03.png'), dur: clipInfo('clip-03').durationSec },
  { id: 'vo-04', kind: 'clip', clipId: 'clip-04', lt: join(CARDS, 'lt-04.png'), dur: clipInfo('clip-04').durationSec },
  { id: 'vo-05', kind: 'clip', clipId: 'clip-05', lt: join(CARDS, 'lt-05.png'), dur: clipInfo('clip-05').durationSec },
  { id: 'vo-06', kind: 'clip', clipId: 'clip-06', lt: join(CARDS, 'lt-06.png'), dur: clipInfo('clip-06').durationSec },
  { id: 'vo-07', kind: 'card', src: join(CARDS, 'card-close.png'), dur: voDur('vo-07') + 2.5 }
];

console.log('\n=== Assembling Bystander Demo Video ===');
let timelineOffset = 0;
const segmentVideos = [];
const audioTracks = [];

for (let i = 0; i < TIMELINE.length; i++) {
  const seg = TIMELINE[i];
  const pieceOut = join(WORK, `piece_${String(i).padStart(2, '0')}.mp4`);
  console.log(`\nProcessing Segment ${seg.id} (${seg.kind}, target dur: ${seg.dur.toFixed(2)}s)...`);

  if (seg.kind === 'card') {
    // Generate video from still image
    ff([
      '-loop', '1',
      '-i', seg.src,
      '-t', seg.dur.toFixed(3),
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
      '-r', '30',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      pieceOut
    ]);
  } else {
    // Screencast clip with lower third overlay
    const concatFile = join(FRAMES, seg.clipId, 'concat.txt');
    // Hard rule: PNG overlay needs -loop 1
    // Lower third fades in at 0.5s, stays for 7.0s, fades out
    ff([
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-loop', '1',
      '-i', seg.lt,
      '-filter_complex',
      `[1:v]fade=t=in:st=0.5:d=0.5:alpha=1,fade=t=out:st=7.5:d=0.5:alpha=1[lt];` +
      `[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[base];` +
      `[base][lt]overlay=0:0:shortest=1[v]`,
      '-map', '[v]',
      '-t', seg.dur.toFixed(3),
      '-r', '30',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      pieceOut
    ]);
  }

  segmentVideos.push(pieceOut);

  // Audio delay calculation
  const audioFile = join(VO, `${seg.id}.mp3`);
  const delayMs = Math.round(timelineOffset * 1000);
  audioTracks.push({ file: audioFile, delayMs });

  timelineOffset += seg.dur;
}

console.log(`\nTotal computed timeline duration: ${timelineOffset.toFixed(2)}s (ceiling: 180s)`);
if (timelineOffset > 180) {
  console.error('[FAIL] Video timeline exceeds 180s limit!');
  process.exit(1);
}

// 2. Concat video pieces
console.log('\nConcatenating video segments...');
const concatListPath = join(WORK, 'video_concat.txt');
writeFileSync(
  concatListPath,
  segmentVideos.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n')
);

const rawVideo = join(WORK, 'raw_video.mp4');
ff([
  '-f', 'concat',
  '-safe', '0',
  '-i', concatListPath,
  '-c', 'copy',
  rawVideo
]);

// 3. Mix audio tracks with delay and loudness normalisation
console.log('\nMixing and normalising audio tracks...');
const audioInputs = [];
const filterComplexParts = [];
for (let i = 0; i < audioTracks.length; i++) {
  audioInputs.push('-i', audioTracks[i].file);
  filterComplexParts.push(`[${i}:a]adelay=${audioTracks[i].delayMs}|${audioTracks[i].delayMs}[a${i}];`);
}

const mixInputs = audioTracks.map((_, i) => `[a${i}]`).join('');
const filterComplex =
  filterComplexParts.join('') +
  // Deliver 48 kHz stereo. Without this the mix inherits the mono 96 kHz layout
  // of the TTS mp3s, which is an odd delivery format and differs from the other
  // three submission videos in this entry.
  // pan, not aformat: aformat's mono->stereo upmix applies the usual -3 dB
  // per-channel power normalisation, which measured as mean -19.3 dB / peak
  // -4.3 dB and undid the loudnorm target. pan copies c0 to both channels at
  // unity gain, so the measured loudness stays where loudnorm put it.
  `${mixInputs}amix=inputs=${audioTracks.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,` +
  `aresample=48000,pan=stereo|c0=c0|c1=c0[aout]`;

const finalAudio = join(WORK, 'final_audio.wav');
ff([
  ...audioInputs,
  '-filter_complex', filterComplex,
  '-map', '[aout]',
  finalAudio
]);

// 4. Mux final video and audio
console.log('\nMuxing final demo video to ' + OUT + '...');
ff([
  '-i', rawVideo,
  '-i', finalAudio,
  '-c:v', 'copy',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-shortest',
  OUT
]);

console.log('\nDemo video build complete: ' + OUT);

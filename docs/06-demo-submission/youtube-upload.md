# YouTube upload — Bystander demo video

**File**: `docs/06-demo-submission/bystander-demo.mp4` (6.9 MB, 143.912 s =
2:23.9, 1920x1080 @ 30 fps, AAC 48 kHz stereo, mean −16.3 dB / peak −1.3 dB, no
silence gap over 4 s)

36.1 seconds under the 3:00 hard limit.

**Thumbnail**: `docs/assets/thumbnail-youtube.png` (1280x720, 352 KB)

This is the re-cut. The first cut showed `Third-party entity "Carol" detected in
utterance` in the audit table at 1:52–2:16 — the leak described in README
section 2.1, on screen, next to the `[REDACTED: ENTITY]` token that was supposed
to have removed it. Cards, screencast and audio mix were all rebuilt against the
fixed service.

## Visibility

**Public.** The rules require a publicly viewable video and a judge following
the Devpost link must not hit a sign-in wall.

## Title

```
Bystander — a consent layer for the Bee wearable: UNKNOWN is never consent
```

## Description

```
A Bee is an always-listening microphone worn into rooms full of people who never
agreed to be recorded. Bystander is the capture layer that treats that as the
problem rather than a detail: a consent ledger per speaker cluster, whole-speaker
suppression for anyone not enrolled, and a summariser that refuses out loud
instead of quietly guessing.

0:00  An always-on microphone in a room of people who never agreed
0:22  What the live Bee API actually returns, and what it does not
0:53  Scenario 1: consented speakers, third-party PII scrubbed
1:17  Scenario 2: an unenrolled bystander, and a loud refusal
1:43  Live ledger reactivity, the audit trail, and the MCP floor
2:11  What this proves

Three things this demo is actually about:

1. THE PLATFORM CANNOT TELL YOU WHO IS SPEAKING. Bee's transcript API returns
flat acoustic cluster labels — SPEAKER_0, SPEAKER_1, sometimes an empty string —
with no participant identity, no voiceprint enrolment, and no flag marking which
cluster is the person wearing the device. That is checkable in the official
@beeai/cli v0.7.3 source, quoted with file and line in the research log. So
consent cannot be looked up; it has to be maintained. Bystander keeps an
external ledger mapping clusters to enrolled participants, and any cluster it
has not been told about defaults to UNKNOWN. UNKNOWN is never treated as
consent — it behaves as refusal, which is the one invariant the whole project
rests on.

2. AN AUDIT THAT RE-PRINTS WHAT IT REMOVED IS NOT AN AUDIT. The first working
version of the redactor put every removed span into the audit record as
originalText, and that audit is returned to callers. Suppressed bystander speech
travelled back out inside the record claiming to have removed it, and the entity
reason string leaked a second copy. The absence test passed the whole time,
because it serialised only the two parts of the result that were never at risk.
A removal record now carries a character count and a word count and nothing
else; the tests serialise the entire returnable payload and additionally assert
that no record contains any four-word run of the source speech. Both new guards
were checked by reinstating the leak and watching them fail. This is written up
in the README rather than buried, because the failure mode — a partial
serialisation in an absence check — is the interesting part.

3. NOTHING HERE IS PRETENDING TO BE PAIRED HARDWARE. There is no Bee device on
this machine. Every live call to the developer API is real HTTPS and returns a
real HTTP 401, reproducible with `node ops/probe-bee-live.mjs`, which also shows
that the host needs Amazon's private root CA before the connection survives the
handshake at all. The demo then runs on an offline fixture set matching the
official CLI's schemas, and the surface badges that state on screen rather than
hiding it. 18 tests across 3 suites; every number on the dashboard is computed
from the payload, with a test that scans the UI source for hardcoded ticks,
invented percentages and numeric fallbacks.

Amazon "Build, Ship, Shape" Developer Hackathon 2026
Track: Bee (primary) · Mini: Open Source
Entrant: Atchayam G (solo)

Code (MIT): https://github.com/AtchayamG/bee-bystander

The narration is synthesized with Microsoft Edge Neural TTS, as the closing card
states. The MCP protocol-floor result quoted in the video is stdout from
ops/probe-protocol-version.mjs against the running server.
```

## Tags

```
Bee, Bee wearable, ambient AI, wearables, privacy, consent, bystander privacy, redaction, Model Context Protocol, MCP, TypeScript, hackathon
```

## Settings that matter

- **Audience**: "No, it's not made for kids"
- **Altered content / synthetic media**: **Yes** — the narration voice is
  synthesized, and the closing card says so.
- **Category**: Science & Technology
- **Thumbnail**: upload `docs/assets/thumbnail-youtube.png`
- **Comments**: leave on

## Uploaded

**https://youtu.be/o85SZu3wlWM** — public, 2026-09-15. Title and custom
thumbnail confirmed live via the oEmbed endpoint and
`i.ytimg.com/vi/o85SZu3wlWM/maxresdefault.jpg`.

Carried into: the README header block, `walkthrough.md`, and the Devpost
submission's video field.

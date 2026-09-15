# YouTube upload — Bystander demo video (v3, four-view application)

**File**: `docs/06-demo-submission/bystander-demo.mp4` (7.9 MB, 166.84 s =
2:46.8, 1920x1080 @ 30 fps, AAC 48 kHz stereo, mean −16.3 dB / peak −1.4 dB, no
silence gap over 4 s)

13.2 seconds under the 3:00 hard limit.

**Thumbnail**: `docs/assets/thumbnail-youtube.png` (1280x720, 352 KB) — unchanged.

## Why this replaces https://youtu.be/o85SZu3wlWM

That cut narrated a single scrolling page and described persistence, enrolment,
purge and export as things that were coming. All four now ship, and the app is
four views. This cut records them working:

- **1:14** the enrolment form is typed into and submitted — `SPEAKER_3`,
  "Dana (barista)", BYSTANDER / UNKNOWN — and the event log gains a
  `CONSENT_ENROL` row.
- **1:23** Bob, a CONSENTED participant, is un-enrolled. A `CONSENT_UNENROL`
  row is written and the banner reads "Cluster reverted to UNKNOWN (strict
  refusal)".
- **1:33** back on the capture view, *the same conversation that was APPROVED
  at 0:55* now reads REFUSED with `REFUSAL_UNCONSENTED_PARTICIPANTS`, Bob's two
  turns replaced, and the metrics recomputed to 3 redactions / 190 characters /
  29 words. Nothing was re-coded between those two moments; only the ledger
  changed.
- **2:05** a purge is confirmed through a focus-trapped dialog and the result
  is stated: "Purged conversation 101: 6 records deleted. Verified 0 records
  remain."

Everything in the shot is a real click or keystroke against the running app.
Recorded by `ops/video/record.mjs`, which fails loudly if the backend or the
surface is not up.

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
0:20  Why it has to be a ledger: anonymous clusters, a real 401, a private CA
0:48  Capture: boundary-aware scrubbing, then a loud refusal
1:14  Consent Ledger: enrol, un-enrol, and watch the gate follow
1:41  Audit: records without the speech, export, and a real purge
2:13  Settings: measured with PRAGMA, not asserted in the page
2:35  What this proves

Three things this demo is actually about:

1. THE PLATFORM CANNOT TELL YOU WHO IS SPEAKING. Bee's transcript API returns
flat acoustic cluster labels — SPEAKER_0, SPEAKER_1, sometimes an empty string —
with no participant identity, no voiceprint enrolment, and no flag marking which
cluster is the person wearing the device. That is checkable in the official
@beeai/cli v0.7.3 source, quoted with file and line in the research log. So
consent cannot be looked up; it has to be maintained. Any cluster the ledger has
not been told about defaults to UNKNOWN, and UNKNOWN is never treated as
consent. At 1:23 a consented speaker is un-enrolled, and at 1:33 the same
conversation that was approved thirty-eight seconds earlier is refused. Nothing
was re-coded in between. That is the whole argument.

2. AN AUDIT THAT RE-PRINTS WHAT IT REMOVED IS NOT AN AUDIT. The first working
version of the redactor put every removed span into the audit record as
originalText, and that audit is returned to callers. Suppressed bystander speech
travelled back out inside the record claiming to have removed it. The absence
test passed the whole time, because it serialised only the two parts of the
result that were never at risk. A removal record now carries a character count
and a word count and nothing else, and the tests serialise the entire returnable
payload. An independent probe searches five surfaces — the API payload, the
stored rows, the CSV export, the JSON export, and the SQLite file read off disk
as bytes — for any four-word run of the source speech, with an all-consented
control to prove the search can see text when text is there. This is written up
in the README rather than buried, because the failure mode is the interesting
part.

3. NOTHING HERE IS PRETENDING TO BE PAIRED HARDWARE. There is no Bee device on
this machine. Every live call to the developer API is real HTTPS and returns a
real HTTP 401, reproducible with `node ops/probe-bee-live.mjs`, which also shows
that the host needs Amazon's private root CA before the connection survives the
handshake at all. A second probe measures Bee's own MCP server and finds it
answers a 2025-11-25 initialize with 2024-11-05 — the same silent downgrade this
project had, in the platform's own server. 48 tests across 10 suites; every
number on screen is computed, with guard tests that fail if a fallback, a
percentage or an asserted database literal is introduced.

Amazon "Build, Ship, Shape" Developer Hackathon 2026
Track: Bee (primary) · Mini: Open Source
Entrant: Atchayam G (solo)

Code (MIT): https://github.com/AtchayamG/bee-bystander

The narration is synthesized with Microsoft Edge Neural TTS, as the closing card
states. The purge, the enrolment and the un-enrolment in this video are real
clicks against the running application, not staged frames.
```

## Tags

```
Bee, Bee wearable, ambient AI, wearables, privacy, consent, bystander privacy, redaction, Model Context Protocol, MCP, SQLite, TypeScript, hackathon
```

## Settings that matter

- Visibility: **Public**
- Audience: **No, it's not made for kids**
- Altered or synthetic content: **Yes** — the narration voice is synthesized,
  and the closing card says so.
- Category: **Science & Technology**
- Thumbnail: upload `docs/assets/thumbnail-youtube.png`
- Comments: leave on

## Uploaded

**https://youtu.be/dwu7O8YLK7w** — public, 2026-09-15. Title and custom
thumbnail confirmed live via the oEmbed endpoint and
`i.ytimg.com/vi/dwu7O8YLK7w/maxresdefault.jpg`.

Carried into the README header, `walkthrough.md`, and the Devpost submission's
video field. Nothing in this repository links to the previous cut any more.

### Devpost renders a cached embed — CHECK THIS BEFORE THE DEADLINE

`software[video_url]` stores the new URL (verified by reloading the edit form),
but the public project page kept rendering an iframe for the **old** video id.
Devpost keeps a denormalised embed separate from the field, and it did not
refresh on save. Three attempts failed to force it:

1. Re-saving the field with the new `youtu.be/` URL — field updated, embed stale.
2. Clearing the field and saving, intending to re-add it — the clear did not
   persist, because the video link is a required field.
3. Saving the canonical `https://www.youtube.com/watch?v=` form so the cache key
   would differ — field updated, embed still stale.

So this is Devpost-side and time-based, not a lost save. Re-check the public
page nearer the deadline; if the iframe still points at `o85SZu3wlWM`, ask
Devpost support to refresh the embed rather than deleting and recreating the
submission. **This is also the reason not to delete the old video from YouTube
yet** — while that embed is live, deleting the video would leave the submission
page playing a dead frame.

### The superseded cut

`https://youtu.be/o85SZu3wlWM` narrated the single-page surface. It is not
wrong, only out of date. Recommended: **unlist rather than delete.** Unlisting
takes it out of search and suggestions so nobody lands on the older app by
accident, while any link already shared — it sat on the Devpost page for a few
hours — still resolves instead of returning a dead video. Deleting is
irreversible and buys nothing over unlisting. Only one video needs to be
public for the rules, and that is the one above.

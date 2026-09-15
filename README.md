# Bystander — Consent-Aware Capture Layer for Bee


**▶ [Watch the demo](https://youtu.be/o85SZu3wlWM)** — an unenrolled voice is picked up, suppressed by absence, and the summariser refuses out loud with a machine-readable reason code.

> A 2:47 re-cut for the four-view application is built and awaiting upload: it
> records the enrolment form being typed into, a consented speaker being
> un-enrolled, and the same conversation flipping from APPROVED to REFUSED
> because the ledger changed — plus a real purge. The link above still points at
> the earlier cut, which narrates the older single-page surface.

> **Amazon Developer Hackathon 2026 (Build, Ship, Shape)**  
> **Track**: Bee Track (Ambient AI / Wearables)  
> **Entrant**: Atchayam G (Solo Entrant)  
> **Licence**: MIT Open Source  
> **Architecture**: TypeScript &bull; Express &bull; Streamable HTTP MCP (`2025-11-25`) &bull; Vite Surface

---

## 1. Executive Summary

A Bee wearable is an always-listening ambient microphone worn into rooms, cafes, and meetings containing individuals who never agreed to be recorded. Existing wearable features assume this privacy dilemma away.

**Bystander** is the capture and redaction layer that confronts it directly:
- **Verifiable Speaker Consent Ledger**: Tracks consent state per acoustic speaker cluster (`SPEAKER_0`, `SPEAKER_1`, etc.), not merely for the device owner.
- **Strict Invariant**: `UNKNOWN` status is **never treated as consent** — it behaves strictly as a refusal.
- **Dual-Layer Redaction**: Suppresses utterances from non-consenting speaker clusters entirely (verified by absence), and scrubs third-party PII (emails, phone numbers, named entities) from consented speech using boundary-aware regex to prevent subword false positives.
- **Machine-Readable Loud Refusals**: When unconsented speech or explicit revocation occurs, Bystander loudly declines to produce summaries, attaching a structured reason code (`REFUSAL_UNCONSENTED_PARTICIPANTS`, `REFUSAL_CONSENT_REVOKED`, `REFUSAL_AMBIGUOUS_ATTRIBUTION`).
- **Verifiable Audit Trail**: Emits structured machine-readable records of every removal (span, reason, category, replacement).
- **Model Context Protocol (MCP) Server**: Implements tools over Streamable HTTP, strictly holding the hackathon minimum protocol floor of `2025-11-25`.
- **Zero Invented Figures**: Every metric on the dashboard and in the audit trail is computed from the payload. Zero hardcoded claims, zero checkmark decorations, and zero fabricated numbers.

---

## 2. Verified vs. Unverified Status

In accordance with portfolio anti-fabrication standards, the following table distinguishes between what has been observed and proven on this machine versus what remains unverified or simulated:

| Feature / Claim | Claimed State | Verification Method / Command | Status |
| :--- | :--- | :--- | :--- |
| **Bee API Production Host & TLS** | Requires internal Amazon Private Root CA (`PROD_ROOT_CA`) | `node ops\probe-bee-live.mjs` — one process, two requests to `https://app-api-developer.ce.bee.amazon.dev/v1/me`, with and without the CA | **VERIFIED** (System trust store dies at the transport with `SELF_SIGNED_CERT_IN_CHAIN`; with `PROD_ROOT_CA` the request reaches the app) |
| **Bee API Authentication Status** | Unauthenticated requests return HTTP 401 | `node ops\probe-bee-live.mjs` (sends no `Authorization` header) | **VERIFIED** (`HTTP 401`, body `{"error":"unauthorized"}` — no fake auth, no token in this repo) |
| **Speaker Diarisation Reality** | Flat anonymous clusters only (`speaker: string`); no identity | Inspected official `@beeai/cli` v0.7.3 source (`sources/resources/conversations/index.ts`) | **VERIFIED** (No user profiles, no voiceprints, no wearer tag) |
| **API Mutation Capabilities** | Facts & Todos are CRUD; Conversations are Read-Only | Inspected official CLI command and resource definitions in `@beeai/cli` v0.7.3 | **VERIFIED** (`/v1/conversations` has no POST/PUT/DELETE) |
| **MCP Protocol Floor Enforcement** | Strictly enforces `2025-11-25` minimum over Streamable HTTP | `node ops/probe-protocol-version.mjs` against running backend | **VERIFIED** (All sub-floor versions raised to `2025-11-25`) |
| **Bee's Own MCP Server Does Not Hold That Floor** | `bee mcp serve` answers a `2025-11-25` request with `2024-11-05`, and exposes 34 tools | `node ops/probe-bee-mcp-tools.mjs` — spawns `npx -y @beeai/cli@0.7.3 mcp serve`, initialises over stdio, lists tools, sends no credential | **VERIFIED** (Measured, not read from docs; see friction log Entry 5. `tools/list` needs no auth, so a judge with no Bee account can re-run it) |
| **Unit Test Suite** | 18/18 tests passing across 3 test suites | `ops\test.cmd` (runs `tsx --test tests/**/*.test.ts`) | **VERIFIED** (All 18 tests green; 320 ms on the reference run, and the figure moves a few ms run to run) |
| **Absence-Based Redaction** | Redacted strings never appear in serialized output | `services/bystander/tests/bystander-redaction.test.ts` | **VERIFIED** (The whole returnable object is serialised, audit included — see the note below on why that wording matters) |
| **Audit Records Carry No Removed Text** | A removal record states category, cluster, span, size and replacement — never the text it removed | `services/bystander/tests/bystander-redaction.test.ts` → `'no redaction entry carries the text it removed, in any field'`; live check with `curl http://127.0.0.1:3002/api/pipeline/101` | **VERIFIED** (Field-level check plus a scan for any 4-word run of the source speech anywhere in the payload) |
| **Substring Safety** | Subwords like "Ann" in "annual" or "Bob" in "bobcat" never match | `services/bystander/tests/bystander-redaction.test.ts` | **VERIFIED** (Boundary-aware regex tested) |
| **Surface Guard Against Invented Figures** | Zero hardcoded checkmarks, percentages, or fallback literals | `services/bystander/tests/surface-no-invented-claims.test.ts` | **VERIFIED** (Scans UI source; fails build on violations) |
| **Negative Probes** | Breaking safety invariants causes tests to fail | `docs/04-agents/negative-probes-evidence.md` | **VERIFIED** (All 4 guards proven with broken/reverted pairs) |
| **Physical Bee Wearable Hardware** | Active Bluetooth pairing and live audio ingestion on body | Hardware device paired to this machine | **UNVERIFIED** (No physical device present; operating via verified offline fixture set) |

### 2.1 A leak this project shipped and then fixed

The first working version of the redactor put the removed span into the audit
record as `originalText`, so a judge reading `audit.removals` — which
`bystander_get_transcript` and `GET /api/pipeline/:id` both return — got the
suppressed bystander speech back verbatim, inside the record that claimed to
have removed it. The entity reason string did the same thing a second way:
`Third-party entity "Carol" detected`.

The absence test passed the whole time, because it serialised only
`{ redactedText, redactedUtterances }` — the two parts of the result that were
never the problem. That is the failure mode worth naming: an absence check is
only as good as the surface it serialises.

Both leaks are gone. A removal record now carries `charCount` and `wordCount`
instead of the text, the reason names the category rather than the match, and
the tests were changed in two ways:

1. Both absence tests now serialise the entire returnable object, keeping only
   `rawText` (the deliberately local-only field) out of the check.
2. A new test asserts no entry has an `originalText` field at all, and that no
   entry contains any four-word run of the source speech.

Both new guards were confirmed to have teeth by reintroducing the leak and
watching them fail, then reverting. The audit trail shown in the demo video was
re-recorded against the fixed service.

---

## 3. Architecture

```
                 +-----------------------------------------------+
                 |              Bee Wearable Device              |
                 |     (Ambient Audio -> Cloud ASR -> Clusters)   |
                 +-----------------------+-----------------------+
                                         |
                                         v
                         +-------------------------------+
                         |   Bee Developer Cloud API     |
                         |  (HTTP 401 without hardware)  |
                         +---------------+---------------+
                                         |
                       +-----------------+-----------------+
                       | (Live HTTPS /   | (Offline        |
                       |  PROD_ROOT_CA)  |  Fixture Set)   |
                       v                 v                 v
                 +-----------------------------------------------+
                 |        Bystander Consent & Redaction          |
                 |                                               |
                 |  1. Consent Ledger (SPEAKER_0 -> Consented)   |
                 |  2. Strict Gating (UNKNOWN = Refusal)         |
                 |  3. Redactor (Whole-Speaker + PII Scrubbing)  |
                 |  4. Refusal Engine (Loud Machine Refusals)    |
                 +-----------------------+-----------------------+
                                         |
                         +---------------+---------------+
                         |                               |
                         v                               v
          +-------------------------------+ +----------------------------+
          | Streamable HTTP MCP Server    | | Bystander Surface UI       |
          | (Protocol Floor 2025-11-25)   | | (Vite 1920x1080 Reactive)  |
          | Tools: bystander_summarize,   | | Computed Metrics & Audit   |
          | bystander_audit, etc.         | | Zero Hardcoded Claims      |
          +-------------------------------+ +----------------------------+
```

---

## 4. Quickstart & Verification

### Prerequisites
- Windows 11 (or Linux/macOS)
- Node.js v20+ (tested on v22.22.3)
- npm v10+
- (Optional) `ffmpeg` and `edge-tts` for demo video pipeline

### 1. Run Automated Test Suite
```cmd
ops\test.cmd
```
Runs all 18 unit tests measuring absence verification, substring safety, and UI source guards, followed by a full Vite production build.

### 2. Launch Local Servers
```cmd
ops\run-both-detached.cmd
```
Starts:
- Bystander Backend on `http://127.0.0.1:3002` (REST API & Streamable HTTP MCP)
- Bystander Surface on `http://127.0.0.1:5175` (Reactive Dashboard)

### 3. Verify Protocol Negotiation
```cmd
node ops\probe-protocol-version.mjs
```
Probes all protocol versions against the running server and verifies that the `2025-11-25` floor is held.

---

## 5. Repository Structure

```
projects/04-bee-bystander/
├── README.md                      # This specification & verified status
├── LICENSE                        # MIT Licence
├── .env.example                   # Configuration placeholders
├── apps/
│   └── surface/                   # Vite + TypeScript reactive dashboard
│       ├── index.html
│       ├── vite.config.ts
│       └── src/
│           ├── main.ts            # Dynamic UI binding (zero hardcoded claims)
│           └── style.css          # Dark aesthetic styling
├── services/
│   └── bystander/                 # TypeScript MCP server & redaction engine
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── certs.ts           # Amazon Private CA (PROD_ROOT_CA)
│       │   ├── client.ts          # Real HTTPS Bee client with fixture fallback
│       │   ├── consent-ledger.ts  # Cluster-to-participant ledger (UNKNOWN rule)
│       │   ├── redactor.ts        # Absence-based redactor & PII scrubber
│       │   ├── refusal.ts         # Loud machine-readable refusal engine
│       │   ├── mcp-server.ts      # MCP Server (2025-11-25 floor enforcement)
│       │   ├── fixtures.ts        # Verified offline fixture conversations
│       │   ├── server.ts          # Express & Streamable HTTP transport
│       │   └── index.ts           # Service entrypoint
│       └── tests/
│           ├── bystander-redaction.test.ts        # Absence & substring tests
│           ├── surface-no-invented-claims.test.ts # Hardcoded claim guard
│           └── negative-probes.test.ts            # Deliberate breakage proofs
├── ops/
│   ├── test.cmd                   # Unified test & build runner
│   ├── run-both-detached.cmd      # Detached launcher for backend & surface
│   ├── stop-both.cmd              # Clean process termination
│   ├── probe-protocol-version.mjs # MCP protocol floor verification
│   ├── probe-bee-live.mjs         # Live TLS + unauthenticated 401 probe (no credentials)
│   ├── probe-bee-mcp-tools.mjs    # Measures Bee's own MCP floor + tool count (no credentials)
│   └── video/                     # Automated demo video pipeline
│       ├── generate-tts.mjs       # Edge Neural TTS narration
│       ├── generate-cards.mjs     # 1920x1080 typography cards & lower thirds
│       ├── record.mjs             # Headless Edge paced screencast recorder
│       ├── assemble.mjs           # ffmpeg video assembler (loop 1 lower thirds)
│       └── verify-video.cmd       # Quality & duration verification
└── docs/
    ├── 00-research/
    │   └── bee-api-evidence.md    # First-hand probes, raw HTTP & diarisation findings
    ├── 04-agents/
    │   ├── handoff-task21.md      # Worker handoff & figures provenance
    │   └── negative-probes-evidence.md # Raw outputs from negative probes
    └── 06-demo-submission/
        ├── friction-log.md        # Technical friction log (+10% bonus category)
        ├── product-feedback.md    # Actionable product feedback for Bee team
        └── walkthrough.md         # Judge walkthrough & reproduction steps
```

---

## 6. Updated Verification Status (Task 22 Complete)

Following the completion of Task 22 deliverables (D1–D9), the verification matrix is updated to reflect all newly implemented and empirically verified capabilities:

| Component / Subsystem | Claimed State | Verification Method / Command | Status |
| :--- | :--- | :--- | :--- |
| **SQLite Persistence & Invariants (D1)** | WAL-mode SQLite storage (`bystander.db`); `participants`, `audit_records`, and `events` tables; schema strictly omits any column for removed speech | `services/bystander/tests/persistence.test.ts` (round-trip, idempotency, and schema column validation) | **VERIFIED** (Audit schema invariant proven; round-trip survives DB close/reopen) |
| **Real Enrolment Flow & Gating Flip (D2)** | `POST /api/consent/enrol`, `PATCH /api/consent/:clusterId`, `DELETE /api/consent/:clusterId` with machine-readable error codes (`INVALID_ROLE`, `INVALID_STATUS`) | `services/bystander/tests/enrolment.test.ts` | **VERIFIED** (Gating immediately flips from APPROVED to REFUSED when speaker is un-enrolled) |
| **Audit Retention Sweep & Local Purge (D3)** | Automated retention sweeps (`POST /api/retention/sweep`), local conversation purge (`POST /api/retention/purge`), and threshold config (`/api/retention/config`) | `services/bystander/tests/retention.test.ts` | **VERIFIED** (Sweep deletes expired records; purge removes records and logs immutable PURGE event, leaving 0 records) |
| **Honest Bee API Client Fallback (D4)** | Connects via HTTPS to `https://app-api-developer.ce.bee.amazon.dev` with Amazon Private CA (`PROD_ROOT_CA`); falls back honestly on 401 Unauthorized; never echoes or logs tokens | `services/bystander/tests/client.test.ts`, and `node ops\probe-bee-live.mjs` for the raw transport result | **VERIFIED** (Honest 401 status captured; zero simulated 200s. Token confidentiality is verified for `getStatus()` only — see section 6.1) |
| **7 Distinct Conversation Fixtures (D5)** | 7 schema-identical `@beeai/cli` v0.7.3 fixtures exercising all boundary conditions: ambiguous attribution (104), all UNKNOWN (105), mid-session revocation (106), overlapping PII (107) | `services/bystander/tests/fixtures-branches.test.ts` | **VERIFIED** (All 7 boundary branches trigger exact refusal codes and clean scrub outputs) |
| **Audit Export in JSON & CSV (D6)** | RFC 4180 compliant CSV export with proper escaping of quotes, commas, and newlines; JSON export; Content-Disposition attachment headers | `services/bystander/tests/audit-export.test.ts` | **VERIFIED** (Headers verified; RFC 4180 round-trip comma survival tested; zero unconsented text in export) |
| **4-View Accessible Web Application (D7)** | Hash-routed SPA (`#capture`, `#ledger`, `#audit`, `#settings`); every text pair clears **WCAG AA**, lowest measured **5.67:1**; visible focus on every interactive control; purge modal with focus trapping & Escape dismiss | `services/bystander/tests/surface-no-invented-claims.test.ts`, the production build (`tsc && vite build`), and a Tab-walk plus token contrast measurement in `ops-tools/` | **VERIFIED at AA, not AAA** (Three pairs sit below AAA's 7:1 — danger text 6.65, speaker tag 6.96, danger-on-tint 5.67. Focus visibility was a real defect and is fixed; see section 6.1) |
| **Streamable HTTP MCP Client Demo (D8)** | Real client connects over Streamable HTTP (`/mcp`), initializes with protocol floor `2025-11-25`, discovers 4 tools, calls `bystander_get_transcript` on consented and unconsented sessions | `node ops/mcp-client-demo.mjs` & `services/bystander/tests/mcp-client-flow.test.ts` | **VERIFIED** (Live run against port 3002 passes; in-process CI test passes) |
| **Negative Probes (D9)** | 8 negative probes proving that breaking schema, validation, purge isolation, absence, or claims causes tests to fail | `services/bystander/tests/negative-probes.test.ts` & `docs/04-agents/negative-probes-evidence.md` | **VERIFIED** (All 8 probes fail when broken, pass when enabled) |
| **Live Bee Production API with Real Hardware Token** | End-to-end cloud sync with an active physical wearable hardware token | Remote HTTP call with provisioned hardware bearer token | **UNVERIFIED** (Bee token not provisioned; live endpoint tested via genuine 401 response; all pipeline stages verified against schema-identical local fixtures) |

### 6.1 What the Task 22 review changed

The nine deliverables above are real: the ledger persists across restarts, the
enrolment flow writes to SQLite, purge deletes and logs, the CSV export is
RFC 4180 correct, and the MCP client demo opens a genuine Streamable HTTP
session. Independent review found five defects and one class of documentation
error, all fixed here.

**The absence guarantee now covers the places Task 22 added.** Persistence, a
CSV export and a JSON export are three new resting places for speech that did
not exist when the `originalText` leak was found (section 2.1). An
orchestrator-written probe ran the same conversation through four consent
states and searched five surfaces — the API payload, the stored rows, the CSV,
the JSON, and the raw `.db` and `-wal` files read off disk as bytes — for any
four-word run of the bystander's sentence. All three suppressing states came
back clean on all five; the all-consented control leaked, which is what proves
the search can see text when text is there.

**Fixed: the settings view asserted runtime state instead of reading it.**
`Journal Mode: WAL (Write-Ahead Logging)`, `Foreign Key Constraints: ON` and
`Exposes 4 verified tools: bystander_get_transcript, …` were literal sentences
in the HTML. All three were true, which is exactly what makes them dangerous —
they would have kept saying so after the pragma or the tool list changed. This
is the same defect the hardcoded guardrail ticks were in project 2.
`GET /api/status` now reports `storage.journalMode` and `storage.foreignKeys`
from `PRAGMA` reads on the open database, and `mcpTools` from the single array
the four `server.tool()` registrations use.

**Fixed: five form controls had no visible focus indicator.** The enrolment
form — the main interactive feature of the new ledger view — carried
`outline: none` with a `:focus` rule that only shifted `border-color` by one
pixel. A Tab walk recording the computed outline and box-shadow of
`document.activeElement` at each stop reported `NO VISIBLE FOCUS` for all five.
Links and buttons were fine throughout. Now every stop shows a 2px ring.

**Fixed: a numeric fallback disguised as a ternary.** The retention field read
`status?.retentionDays ? status.retentionDays : 30`, which substitutes a number
the server never sent and turns a real retention window of 0 days into a
displayed 30. The existing guards scan for `|| <number>` and `?? <number>`, so
it passed them. There is now a third guard for the ternary spelling, and one
for asserted database and protocol literals. Both were confirmed by
reintroducing the defects and watching the suite fail.

**Fixed: a dead status field.** The settings badge read `beeApi.status`, which
the server has never sent, so `isLive` was permanently false — with a real
token configured the panel would still have claimed local fixture mode. It now
reads `beeApi.mode`, and the panel reports the configured endpoint instead of
`not reported`.

**Fixed: `tsc --noEmit` did not pass.** A negative probe used the category
`THIRD_PARTY_ENTITY`, which is not a member of `RedactionCategory`. The test
passed anyway because `tsx` strips types without checking them. Both packages
now typecheck clean.

**Corrected documentation.** The Task 22 handoff's accessibility figures were
computed against `#f8fafc`, `#0f172a` and `#3b82f6` — none of which appear in
this project's stylesheet — and reported ">= 6.7:1 (WCAG AAA)" while listing a
4.6:1 pair in the same row. Measured against the real tokens, every text pair
clears AA and the floor is 5.67:1, so the claim in the table above is AA. The
handoff also described consent statuses (`REFUSED`), roles
(`consented_participant`) and audit categories (`SPEAKER_SUPPRESSION`,
`THIRD_PARTY_ENTITY`) that the codebase does not define, plus a pipeline
latency metric and a SHA-256 digest panel that do not exist in the source. The
screens were re-shot at 1920x1080 and read directly; `docs/04-agents/handoff-task22.md`
section 7 lists every correction.

Two things a reader should know about this repository's history. Two commits
have mixed contents — `7ebfcb2` ("D1 — SQLite persistence") also carries the
Bee MCP probe and friction log entry 5, and `a18d937` ("measure Bee's own MCP
server") also carries 157 lines of Express routes — because the orchestrator
and the worker agent both ran `git add -A` against one working tree within the
same few minutes. Nothing was lost and the history is linear; the messages
simply understate what landed. And the demo video linked at the top of this
README predates Task 22: it shows the single-page surface, not the four-view
application, and fixture 102's figures have since changed. It is being re-cut.

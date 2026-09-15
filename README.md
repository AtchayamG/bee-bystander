# Bystander — Consent-Aware Capture Layer for Bee

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
| **Bee API Production Host & TLS** | Requires internal Amazon Private Root CA (`PROD_ROOT_CA`) | Live HTTPS probe to `https://app-api-developer.ce.bee.amazon.dev` with and without custom CA in `scratch/probe_bee_live.js` | **VERIFIED** (Fails TLS handshake without CA; passes TLS with CA) |
| **Bee API Authentication Status** | Unauthenticated requests return HTTP 401 | Raw HTTP probe returns `HTTP/1.1 401 Unauthorized` (`{"error":"unauthorized"}`) | **VERIFIED** (Truthfully logged; no fake auth) |
| **Speaker Diarisation Reality** | Flat anonymous clusters only (`speaker: string`); no identity | Inspected official `@beeai/cli` v0.7.3 source (`sources/resources/conversations/index.ts`) | **VERIFIED** (No user profiles, no voiceprints, no wearer tag) |
| **API Mutation Capabilities** | Facts & Todos are CRUD; Conversations are Read-Only | Inspected official CLI command and resource definitions in `@beeai/cli` v0.7.3 | **VERIFIED** (`/v1/conversations` has no POST/PUT/DELETE) |
| **MCP Protocol Floor Enforcement** | Strictly enforces `2025-11-25` minimum over Streamable HTTP | `node ops/probe-protocol-version.mjs` against running backend | **VERIFIED** (All sub-floor versions raised to `2025-11-25`) |
| **Unit Test Suite** | 17/17 tests passing across 3 test suites | `ops\test.cmd` (runs `tsx --test tests/**/*.test.ts`) | **VERIFIED** (All 17 tests green in 323ms) |
| **Absence-Based Redaction** | Redacted strings never appear in serialized output | `services/bystander/tests/bystander-redaction.test.ts` | **VERIFIED** (Tested by serialized string absence) |
| **Substring Safety** | Subwords like "Ann" in "annual" or "Bob" in "bobcat" never match | `services/bystander/tests/bystander-redaction.test.ts` | **VERIFIED** (Boundary-aware regex tested) |
| **Surface Guard Against Invented Figures** | Zero hardcoded checkmarks, percentages, or fallback literals | `services/bystander/tests/surface-no-invented-claims.test.ts` | **VERIFIED** (Scans UI source; fails build on violations) |
| **Negative Probes** | Breaking safety invariants causes tests to fail | `docs/04-agents/negative-probes-evidence.md` | **VERIFIED** (All 4 guards proven with broken/reverted pairs) |
| **Physical Bee Wearable Hardware** | Active Bluetooth pairing and live audio ingestion on body | Hardware device paired to this machine | **UNVERIFIED** (No physical device present; operating via verified offline fixture set) |

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
Runs all 17 unit tests measuring absence verification, substring safety, and UI source guards, followed by a full Vite production build.

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

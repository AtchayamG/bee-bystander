# Product Feedback — Bee Wearable Developer Ecosystem

> **Amazon Developer Hackathon 2026 (Build, Ship, Shape)**  
> **Project**: Bystander — Consent-Aware Capture Layer for Bee  
> **Author**: Atchayam G (Solo Entrant)  
> **Ecosystem Evaluated**: `@beeai/cli` v0.7.3, Bee Developer REST API, Bee MCP Server, Documentation (`docs.bee.computer`)  
> **Style**: Technical Bug Report & Platform Assessment  

---

## 1. Tool & SDK Breakdown

### 1.1 `@beeai/cli` (v0.7.3)
- **What Worked**:
  * Clean TypeScript architecture with declarative resource definitions (`sources/resources/*`).
  * The `bee ping` connectivity probe is instant and provides immediate diagnostic feedback without needing prior authentication.
  * Ephemeral curve25519 pairing via QR code (`sources/utils/appPairingCrypto.ts`) is cryptographically clean and removes static secrets from the mobile setup.
- **What Needs Improvement**:
  * Unauthenticated CLI commands fail with a bare `Not logged in. Run "bee login" first.` message and exit code 1, but offer no machine-readable JSON output even when `--json` is supplied.
  * The CLI binary embeds a private root CA (`PROD_ROOT_CA`), but the documentation does not explain that non-CLI tools require this certificate to communicate with the production API.
- **Severity / Verdict**: Solid CLI tool, but tightly coupled to its own runtime.

### 1.2 Bee Developer REST API (`https://app-api-developer.ce.bee.amazon.dev`)
- **What Worked**:
  * Facts (`/v1/facts`) and Todos (`/v1/todos`) endpoints support full CRUD operations with clean JSON payloads and cursor-based pagination.
  * The search endpoint (`POST /v1/search/conversations`) provides both BM25 keyword filtering and neural semantic search over captured conversations.
- **What Needs Improvement**:
  * **Critical Gap: Diarisation without Identity**: Utterance models only provide acoustic clusters (`SPEAKER_0`, `SPEAKER_1`) without profile mapping, voiceprints, or wearer designation.
  * **Read-Only Conversations**: Captured conversations cannot be mutated, redacted, or deleted via the API. Privacy-preserving middleware cannot delete unconsented speech from the cloud.
  * **Custom TLS CA**: Terminating production endpoints with an Amazon internal private CA breaks standard HTTP clients out of the box.
- **Severity / Verdict**: Good CRUD for notes/todos; insufficient for consent-aware speech governance.

### 1.3 Bee MCP Server (`bee mcp serve`)
- **What Worked**:
  * Exposes 35 discrete tools covering status, search, facts, todos, activity, and transcripts.
  * Includes local client connectors for Claude, Claude Code, and Codex (`bee mcp connect <client>`).
- **What Needs Improvement**:
  * Protocol negotiation is unconstrained; defaults to older spec dialects without holding a protocol floor.
  * MCP tools return raw upstream transcripts with no option to filter out third-party PII or non-consenting speakers before ingestion into LLM context windows.
- **Severity / Verdict**: Comprehensive tool coverage, but passes all ambient audio through indiscriminately.

---

## 2. Developer Onboarding Experience

1. **Getting Started**:
   - Initial connectivity verification is straightforward: `npx @beeai/cli ping` returns `pong` immediately.
   - However, progressing beyond `ping` requires either a physical wearable device paired to an iOS/Android app or an active developer token.
   - When developing backend services or middleware (which the build session explicitly encouraged), the lack of a documented sandbox or developer mock mode forces builders to reverse-engineer endpoint shapes from CLI source files.

2. **Documentation Quality (`docs.bee.computer`)**:
   - Documentation for CLI commands and proxy usage is clean and easy to read.
   - Crucial operational details are missing:
     * No documentation on TLS root certificate requirements.
     * No schema reference for `/v1/conversations/:id/transcript` utterances.
     * No discussion of privacy, consent, or bystander audio handling.

---

## 3. Would-You-Build-Again Assessment

- **Yes, but with reservations regarding privacy architecture**:
  The Bee wearable platform offers an impressive pipeline from audio capture to diarised transcriptions and neural search. However, the ecosystem currently operates under an "all-capturing, always-listening" paradigm that completely ignores the presence of non-consenting third parties in public and shared private spaces.
- **What would make it a first-class developer platform**:
  1. A first-class **Speaker Attribution & Consent API** that lets wearers label clusters and register consent preferences.
  2. Cloud mutation endpoints (`DELETE /v1/conversations/:id`, `PUT /v1/conversations/:id/redact`) allowing privacy tools to sanitize stored data.
  3. Standard public TLS certificates for developer endpoints to avoid custom CA friction.

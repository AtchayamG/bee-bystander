# Judge Walkthrough — Bystander (Bee Wearable Track)

> **Amazon Developer Hackathon (Build, Ship, Shape 2026)**  
> **Project**: Bystander — Consent-Aware Capture Layer for Bee  
> **Entrant**: Atchayam G (Solo Entrant)  
> **Licence**: MIT Open Source  

This document is written for two readers:
1. **The judge who will not run anything**: an executive summary explaining what the project proves, how the safety invariants work, and the exact verified evidence captured from the system.
2. **The judge who will run everything**: exact, copy-pasteable shell commands that reproduce every test, verify the protocol floor, and launch the reactive web surface.

---

## Part 1: For the Judge Who Will Not Run Anything

### The Problem Bystander Solves
A Bee wearable is an always-listening microphone worn on the body. Unlike a phone call or smart speaker, it passively records everyone nearby: colleagues in an open-plan office, bystanders at an adjacent cafe table, or family members at home. Standard LLM ingestion passes all of this ambient speech into vector databases and summarisation models without checking whether those speakers agreed to be recorded.

### What Bystander Proves
Bystander introduces a verifiable consent governance layer directly between ambient audio ingestion and downstream consumers:

1. **Explicit Participant Consent Ledger**:
   - The Bee API provides anonymous acoustic cluster labels (`SPEAKER_0`, `SPEAKER_1`, etc.).
   - Bystander maps these clusters to enrolled participants and maintains a strict invariant: **`UNKNOWN` is never treated as consent — it behaves as refusal**.
2. **Dual-Layer Redaction Verified by Absence**:
   - **Speaker-level**: Utterances from non-consenting clusters (`UNKNOWN` or `REVOKED`) are completely suppressed. The raw speech string is verified to not exist anywhere in the output payload.
   - **Content-level**: Third-party emails, phone numbers, and named entities (e.g. Carol, Dave) are scrubbed from consented speech using boundary-aware regular expressions that eliminate subword false positives (e.g., "Ann" never matches inside "annual").
3. **Loud Machine-Readable Refusals**:
   - Rather than guessing or silently omitting context, Bystander **loudly refuses** to generate summaries when unconsented speech or explicit revocation occurs, attaching a machine-readable code (`REFUSAL_UNCONSENTED_PARTICIPANTS`, `REFUSAL_CONSENT_REVOKED`).
4. **Verifiable Audit Trail with Zero Invented Figures**:
   - Every removal produces an audit record with exact span indices, reason string, and category.
   - Every metric on the dashboard (character count, word count, removal count) is computed live from the JSON data. The UI contains zero hardcoded checkmarks ("✓"), zero invented percentages, and zero appliance-style placeholder literals.
5. **Model Context Protocol (MCP) Floor Enforcement**:
   - Exposes tools over Streamable HTTP (`bystander_status`, `bystander_summarize`, `bystander_audit`, `bystander_manage_consent`).
   - The hackathon spec minimum is `2025-11-25`. Probed with `ops/probe-protocol-version.mjs`, the server strictly rewrites sub-floor negotiations to `2025-11-25`.

---

## Part 2: For the Judge Who Will Run Everything

### 1. Environment Requirements
- Windows 11 (or macOS / Linux)
- Node.js v20 or higher (tested on v22.22.3)
- npm v10+

### 2. Verify the Complete Test Suite
```cmd
ops\test.cmd
```
**Expected Output**:
- Runs 18 unit tests across 3 suites in `services/bystander` using `tsx --test`.
- Tests absence verification: the whole returnable result is serialised — audit records included — and checked for the removed text.
- Tests that no audit record carries the text it removed, in any field, nor any four-word run of it.
- Tests substring safety ("Ann" in "annual", "consent" in "consented", "Bob" in "bobcat").
- Tests UI guard (`apps/surface/src/main.ts` contains no hardcoded checkmarks or invented figures).
- Builds `apps/surface` production bundle via `vite build`.
- Final line: `=== ALL SUITES GREEN ===` (Exit code: 0).

### 3. Launch the Backend and Web Surface
```cmd
ops\run-both-detached.cmd
```
**What this starts**:
- Bystander Backend on `http://127.0.0.1:3002` (REST API & Streamable HTTP MCP).
- Bystander Surface on `http://127.0.0.1:5175` (Vite reactive web interface).
- Probes `ops/probe-protocol-version.mjs` against the live backend, proving `2025-11-25` floor compliance.

### 4. Interactive Surface Walkthrough
Open your browser to `http://127.0.0.1:5175/`:
1. **Scenario 1 (Architecture Review)**:
   - Alice and Bob are consented participants.
   - Bob utters Carol's email (`carol@partner-network.org`) and phone number (`555-0199`).
   - Observe the live redaction badges and the 4 audit records in Panel 4.
   - Downstream Gate indicates: `APPROVED`.
2. **Scenario 2 (Cafe with Ambient Bystander)**:
   - Select "Cafe Meeting with Ambient Bystander (ID: 102)" in the scenario dropdown.
   - Speaker `SPEAKER_2` is an unenrolled bystander with `UNKNOWN` consent status.
   - Observe that `SPEAKER_2`'s speech is completely suppressed by absence.
   - Observe Panel 2: Downstream Gate turns red: `REFUSED` (`REFUSAL_UNCONSENTED_PARTICIPANTS`), and summary generation is blocked.
3. **Live Reactivity Test**:
   - In Scenario 1, click the **Toggle** button next to Bob (`SPEAKER_1`) to change status from `CONSENTED` to `REVOKED`.
   - The UI immediately updates: the downstream gate flips to `REFUSED` (`REFUSAL_CONSENT_REVOKED`), proving dynamic ledger reactivity.
   - Click **Toggle** again to restore consent and approve the pipeline.

### 5. Terminate Servers
```cmd
ops\stop-both.cmd
```
Kills processes on ports 3002 and 5175 cleanly.

# Bee API Evidence & Ground Truth Analysis

**Date**: 2026-09-15  
**Author / Worker**: agy  
**Project**: `projects/04-bee-bystander`  
**Sources Examined**:
- Official Bee Documentation: `https://docs.bee.computer/` (`/docs/proxy`, `/docs/cli`, `/docs/mcp`, `/docs/skill`)
- Official CLI Repository: `https://github.com/bee-computer/bee-cli` (v0.7.3)
- Official Skill Repository: `https://github.com/bee-computer/bee-skill`
- Live Network Probes against production endpoints

---

## 1. Network Probes & Raw HTTP Evidence

### 1.1 Production API Host & TLS Architecture
- **Base URL**: `https://app-api-developer.ce.bee.amazon.dev/`
- **TLS Requirement**: The production endpoint uses an internal Amazon Private Root CA (`PROD_ROOT_CA` embedded in `bee-cli/sources/certs.ts`), issued by `BeeCertificateAuthority` (`OU=Trust and Privacy`).
- Probing with the default Node.js system trust store fails immediately with:
  `Error: unable to get local issuer certificate` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
- When requests include `PROD_ROOT_CA` in the TLS agent `ca` bundle, the server accepts the TLS handshake.

### 1.2 Raw HTTP Responses (Captured Live)

#### Probe 1: `GET /v1/me` (Unauthenticated)
```http
GET https://app-api-developer.ce.bee.amazon.dev/v1/me HTTP/1.1
Host: app-api-developer.ce.bee.amazon.dev
Accept: application/json

HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8
Content-Length: 23

{"error":"unauthorized"}
```

#### Probe 2: `GET /v1/me` (Invalid Bearer Token)
```http
GET https://app-api-developer.ce.bee.amazon.dev/v1/me HTTP/1.1
Host: app-api-developer.ce.bee.amazon.dev
Authorization: Bearer invalid_test_token_401
Accept: application/json

HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8
Content-Length: 23

{"error":"unauthorized"}
```

#### Probe 3: `GET /v1/conversations` (Unauthenticated)
```http
GET https://app-api-developer.ce.bee.amazon.dev/v1/conversations HTTP/1.1
Host: app-api-developer.ce.bee.amazon.dev
Accept: application/json

HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8
Content-Length: 23

{"error":"unauthorized"}
```

#### Probe 4: `GET /v1/facts` (Unauthenticated)
```http
GET https://app-api-developer.ce.bee.amazon.dev/v1/facts HTTP/1.1
Host: app-api-developer.ce.bee.amazon.dev
Accept: application/json

HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8
Content-Length: 23

{"error":"unauthorized"}
```

#### Probe 5: `POST /apps/pairing/request` (Auth Service)
```http
POST https://auth.beeai-services.com/apps/pairing/request HTTP/1.1
Host: auth.beeai-services.com
Content-Type: application/json
Content-Length: 48

{"app_id":"bystander-test","publicKey":"dummy"}

HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8
Content-Length: 41

{"ok":false,"error":"invalid_public_key"}
```

---

## 2. CLI Probes (`@beeai/cli 0.7.3`)

### 2.1 Connectivity & Status Commands
Command: `npx.cmd -y @beeai/cli ping`
```text
pong
```
(Exit code: 0)

Command: `npx.cmd -y @beeai/cli status`
```text
API: production (https://app-api-developer.ce.bee.amazon.dev/)
Not logged in.
```
(Exit code: 0)

Command: `npx.cmd -y @beeai/cli version`
```text
@beeai/cli 0.7.3
```
(Exit code: 0)

### 2.2 Unauthenticated Command Behavior
Command: `npx.cmd -y @beeai/cli conversations list`
```text
Not logged in. Run "bee login" first.
bee conversations list [--limit N] [--cursor <cursor>] [--json]
bee conversations get <id> [--json]
bee conversations transcript <id> [--since <epochMs>] [--json]
bee conversations related <id> [--limit N] [--json]

List developer conversations.
```
(Exit code: 1)

---

## 3. Ground Truth: Speaker Attribution & Diarisation

### 3.1 The Schema
Inspection of the conversation resource schema (`sources/resources/conversations/index.ts` lines 360–376 and `sources/commands/now/index.ts` lines 81–92):

```typescript
type Utterance = {
  id: number;
  realtime: boolean;
  start: number | null;
  end: number | null;
  spoken_at: number | null;
  text: string;
  speaker: string; // Anonymous cluster label
  created_at: number;
};

type Transcription = {
  id: number;
  realtime: boolean;
  utterances: Utterance[];
};

type ConversationDetail = {
  id: number;
  title: string | null;
  summary: string | null;
  short_summary: string | null;
  state: string;
  created_at: number;
  updated_at: number;
  transcriptions: Transcription[];
  suggested_links: Array<{ url: string; created_at: number }>;
  primary_location: {
    address: string | null;
    latitude: number;
    longitude: number;
    created_at: number;
  };
};
```

### 3.2 Diarisation Analysis & Limitations
1. **Flat Cluster Labels Only**: The `speaker` field contains values such as `"SPEAKER_0"`, `"SPEAKER_1"`, or `""` (which the CLI defaults to `"unknown"`, per `conversations/index.ts:512`).
2. **No Participant Identity**: The Bee API has **no** concept of user profiles for participants, **no** voiceprints, **no** speaker enrolment, and **no** address book linking.
3. **No Wearer Identification**: The API does **not** indicate which speaker cluster belongs to the device owner/wearer.
4. **Conclusion for Bystander Architecture**:
   - The consent ledger **cannot** expect the Bee API to supply identity.
   - Bystander must maintain an explicit **Participant Ledger** that maps speaker clusters (`SPEAKER_0`, `SPEAKER_1`, etc.) to enrolled identities and their consent status (`CONSENTED`, `REVOKED`, `UNKNOWN`).
   - Unenrolled clusters default strictly to `UNKNOWN`.
   - In addition to cluster-level gating, Bystander must perform **content-based redaction** (detecting names, phone numbers, emails, addresses, and third-party mentions) because a consented speaker may utter private details concerning an unconsented bystander.

---

## 4. Ground Truth: Read vs Write Capabilities

| Resource | Endpoints Available | Writeback / Mutation Scope |
| :--- | :--- | :--- |
| **Conversations** | `GET /v1/conversations`<br>`GET /v1/conversations/:id`<br>`GET /v1/conversations/:id/transcript`<br>`GET /v1/conversations/:id/related`<br>`POST /v1/search/conversations` | **READ-ONLY**. There are no `POST`, `PUT`, or `DELETE` endpoints for conversations or transcriptions. |
| **Daily Summaries** | `GET /v1/daily`<br>`GET /v1/daily/:id` | **READ-ONLY**. Summaries cannot be updated or deleted in the Bee cloud. |
| **Facts** | `GET /v1/facts`<br>`GET /v1/facts/:id`<br>`POST /v1/facts`<br>`PUT /v1/facts/:id`<br>`DELETE /v1/facts/:id` | **FULL CRUD**. Facts can be created, updated, confirmed, and deleted. |
| **Todos** | `GET /v1/todos`<br>`POST /v1/todos`<br>`PUT /v1/todos/:id`<br>`DELETE /v1/todos/:id` | **FULL CRUD**. Todos can be created, updated, completed, and deleted. |
| **Insights** | `GET /v1/insights`<br>`GET /v1/insights/:id` | **READ-ONLY**. |
| **Voice Notes** | `GET /v1/voice_notes`<br>`GET /v1/voice_notes/:id` | **READ-ONLY**. |

### Architectural Consequence:
Because Bee conversations and daily summaries are read-only upstream, **Bystander acts as an in-flight redaction and gating interceptor**:
1. When an AI agent or downstream assistant requests conversations or summaries via Bystander's MCP server, Bystander fetches raw context from Bee (or fixture when unauthenticated), applies the consent ledger and redaction engine, and emits redacted text with an attached machine-readable audit trail.
2. For facts (which ARE writable), Bystander can sanitize proposed facts before persisting them to Bee via `POST /v1/facts`, or delete unconsented facts via `DELETE /v1/facts/:id`.
3. If unconsented speech dominates a conversation or speaker attribution is ambiguous, Bystander **refuses** to produce a summary, emitting a loud machine-readable refusal reason instead of guessing.

---

## 5. Account & Token Status

- **Environment State**:
  - `BEE_TOKEN` environment variable: **UNSET**
  - `~/.bee/` credentials directory: **DOES NOT EXIST** (`Test-Path "$env:USERPROFILE\.bee"` evaluated to `False`)
  - No physical Bee device is paired to this machine.
- **Handling in Shipped Code**:
  - `services/bystander/client.ts` implements a real HTTP client targeting `https://app-api-developer.ce.bee.amazon.dev/` with `PROD_ROOT_CA`.
  - When no token is configured, the client attempts the request, honestly logs the HTTP `401 Unauthorized` response, and gracefully falls back to a verified offline fixture set for testing and demonstration.
  - The UI and CLI explicitly display: `Bee API: 401 Unauthorized (No token configured) — Running in verified offline fixture mode`. No mock is hidden in the live path; the status is reported truthfully.

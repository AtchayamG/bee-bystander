# Task 22 — agy prompt (for the record; the code block pasted in chat is the deliverable)

You are Antigravity ("agy"), the worker agent on Atchayam G's solo entry to the
Amazon "Build, Ship, Shape" Developer Hackathon 2026.

WORKSPACE (absolute): D:\Work\Codex\Hackathon Projects\Amazon Developer Hackathon
YOUR PROJECT FOR THIS TASK (absolute, and the ONLY project you may modify):
  D:\Work\Codex\Hackathon Projects\Amazon Developer Hackathon\projects\04-bee-bystander

## READ FIRST, before you write a single line

1. D:\Work\Codex\Hackathon Projects\Amazon Developer Hackathon\AGENTS.md
2. D:\Work\Codex\Hackathon Projects\Amazon Developer Hackathon\HACKATHON-RULES-AND-RESOURCES.md
   — specifically the Stage 2 judging criteria (four at 25% each) and the Bee row
   of the "NO PHYSICAL HARDWARE IS REQUIRED" table.
3. projects\04-bee-bystander\README.md — all of it, and section 2.1 twice.
4. projects\04-bee-bystander\docs\04-agents\handoff-task21.md — including
   section 6, the orchestrator review of your own Task 21. Read what was found
   and why the test suite did not catch it. The same class of mistake in this
   task will be found the same way.
5. projects\04-bee-bystander\docs\00-research\bee-api-evidence.md

## CONTEXT: where Project 4 stands

Task 21 shipped a working consent layer: a redactor, a refusal engine, an MCP
server holding the 2025-11-25 floor, and a one-page surface. Orchestrator review
found one real defect (the audit records carried the text they claimed to have
removed), fixed it, re-cut the demo video, published the repo public + MIT at
https://github.com/AtchayamG/bee-bystander, and the Devpost entry is going in.
Suite is currently 18 tests / 3 suites, all green.

What it is NOT yet is the thing the entrant asked for across this whole
portfolio: a complete, live, working application rather than a demonstration of
a mechanism. Today the consent ledger is an in-memory object that resets on
restart, there are exactly two hardcoded fixture conversations, there is no way
to enrol a person, there is no way to make the system forget anything, and the
whole product is one scrolling dashboard. A judge scoring "Design — complete,
coherent product experience" and "Technical Implementation" is looking at a
demo, and will score it as one.

## THE TASK

Turn Project 4 into a complete application, without inventing a single fact.
Nine deliverables. Do them in this order, and commit locally after each one so a
failure never costs more than one deliverable.

### D1 — Persistence that survives a restart (SQLite)

The consent ledger is the product's memory and it currently has none.

- Add `better-sqlite3` to `services/bystander`. Database file at
  `services/bystander/data/bystander.db`, and add `services/bystander/data/`
  to `.gitignore` — the database is state, not source.
- Tables at minimum: `participants` (cluster_id PK, name, role, status,
  updated_at, notes), `audit_records` (id PK, conversation_id, category,
  cluster_id, reason, span_start, span_end, char_count, word_count,
  replacement_text, created_at), `events` (an append-only log of consent
  changes and purges: id, kind, cluster_id, conversation_id, detail, created_at).
- `audit_records` must NOT have a column capable of holding removed text. If
  you find yourself wanting one, re-read README section 2.1.
- `ConsentLedger` keeps its current public API. Add a repository layer beneath
  it so the class does not become a database object.
- Seed on first run from the existing three participants, and only on first run.
- Migration must be idempotent: starting the server twice must not duplicate or
  wipe anything.

Test: a round-trip test that writes a consent change, closes the database,
reopens it, and asserts the change survived. And a test that runs the migration
twice and asserts the row counts are unchanged.

### D2 — A real enrolment flow

- `POST /api/consent/enrol` — add a new cluster to the ledger with name, role
  (WEARER | PARTICIPANT | BYSTANDER), status and optional notes.
- `PATCH /api/consent/:clusterId` — change status or notes.
- `DELETE /api/consent/:clusterId` — un-enrol, which means the cluster returns
  to UNKNOWN, which means refusal. It does not mean "allow".
- Every one of these writes an `events` row.
- Validation: reject an unknown role, reject an unknown status, reject a
  cluster id that is not a non-empty string, with a 400 and a machine-readable
  error code. Do not coerce, do not default silently.

Test: enrolling with `status: "MAYBE"` must 400. Un-enrolling a CONSENTED
cluster must flip the pipeline for that conversation to REFUSED.

### D3 — Retention and purge, which is the feature the Bee API cannot offer

Friction log Entry 3 records that Bee's conversations endpoint is read-only, so
redaction cannot be pushed back upstream. That is exactly why a local purge is
worth building.

- `POST /api/retention/purge` with a conversation id: delete every stored
  audit record and derived artefact for that conversation, and write an
  `events` row recording that a purge happened, how many records went, and when.
- A retention setting (days) that a scheduled sweep honours. Implement the
  sweep as a function called on server start and exposed as
  `POST /api/retention/sweep` so it is testable without waiting.
- The purge event must be provable: after a purge, the audit table has zero
  rows for that conversation, and the events table has exactly one purge row.

Test: seed audit records, purge, assert zero remain and one event exists.

### D4 — A live Bee path that is real when a token exists and honest when it does not

`client.ts` already does real HTTPS with `PROD_ROOT_CA` and falls back to
fixtures. Finish it.

- If `BEE_TOKEN` is set in `.env`, the client fetches real conversations from
  `/v1/conversations` and a real transcript from
  `/v1/conversations/:id/transcript`, and the surface badges LIVE.
- If it is unset or rejected, the surface badges the real HTTP status and the
  word FIXTURE, as it does now.
- The token must never be logged, never appear in a response body, never be
  written to any file, and never be echoed to the surface. Not the first four
  characters. Not the length. Nothing.
- Add `BEE_TOKEN=` to `.env.example` as an empty placeholder only.
- You do NOT have a token and you must not obtain one. So you will verify the
  unauthenticated branch only, and you will say exactly that in the handoff.
  Run `node ops\probe-bee-live.mjs` and paste its real output.

Test: with no token, the client reports mode `fixture` and the real status code.
Do not write a test that asserts live behaviour you have not observed.

### D5 — More than two conversations, and none of them invented as data

Add at least four more fixture conversations, each exercising a distinct branch:
a conversation with an empty `speaker` string (the API really does return that);
a conversation where every speaker is UNKNOWN; a conversation with a REVOKED
participant mid-way; a conversation with overlapping PII inside one utterance
(an email adjacent to a phone number adjacent to an entity). Each fixture must
match the `@beeai/cli` v0.7.3 schema exactly — the same field names, the same
types, the same nullability. Cite the file and line in the fixture's comment for
the schema you matched, as `bee-api-evidence.md` already does.

These are fixtures, clearly labelled as fixtures, in a file named for fixtures.
That is legitimate. What is not legitimate is a fixture presented anywhere as a
real capture from a real device.

### D6 — Audit export

- `GET /api/audit/:conversationId/export?format=json` and `?format=csv`.
- CSV must be correct, not string-concatenated: quote fields containing commas
  or quotes, and set a `Content-Disposition` filename.
- The export carries the same columns as the stored record, which means it also
  carries no removed text.

Test: an audit record whose reason contains a comma must survive a CSV
round-trip.

### D7 — The surface becomes an application

Four views, real client-side routing (hash routing is fine), shared header:

1. **Capture** — what exists today: pipeline, redaction, gate, audit trail.
2. **Ledger** — the enrolment flow. Add a participant, change a status, un-enrol.
   Shows the events log.
3. **Audit** — the records for a selected conversation, with export buttons and
   the purge action behind a confirmation.
4. **Settings** — retention days, the Bee connection badge, the MCP endpoint and
   the protocol floor, and the real API status.

Design constraints, and these are not optional:
- Keep the existing visual language. Do not restyle the project.
- Every number on screen stays computed from the payload. The guard test in
  `surface-no-invented-claims.test.ts` already scans for hardcoded ticks,
  invented percentages and numeric fallbacks; extend it to the new views'
  source files rather than working around it.
- Keyboard reachable end to end: visible focus on every interactive element,
  the confirmation dialog traps focus and closes on Escape, and the refusal
  banner is an `aria-live="assertive"` region so a screen reader announces a
  refusal instead of silently missing it.
- Contrast: every text/background pair at 4.5:1 or better. Measure it, do not
  eyeball it — write the ratios into the handoff.
- No emoji as UI, no gradient-over-everything, nothing that reads as generic
  AI-generated layout. The entrant has said this explicitly and repeatedly.

### D8 — A real MCP client, not a description of one

`ops/mcp-client-demo.mjs`: a script that opens a real Streamable HTTP session
against the running server, initialises at `2025-11-25`, lists tools, calls
`bystander_get_transcript` on a consented conversation and then on one with an
unconsented speaker, and prints both the session id and the refusal with its
reason code. Its stdout is the artefact.

### D9 — Tests, and then prove they can fail

Raise the suite. For each of D1, D2, D3, D6 there is at least one test that
would fail if the feature regressed.

Then do a negative probe for each of these four new guards: break the invariant
deliberately, run the suite, capture the failing output verbatim with exit code,
revert, run again, capture the pass. Append all four to
`docs\04-agents\negative-probes-evidence.md` in the format already used there.
A guard you have not watched fail is a guard you have not tested.

## WHAT YOU MUST NOT TOUCH

- `projects\01-firetv-narratv`, `projects\02-ring-doorstep`,
  `projects\03-alexa-mcp` — not one byte, for any reason.
- `projects\04-bee-bystander\docs\06-demo-submission\**` — the demo video,
  walkthrough, friction log, product feedback and YouTube metadata are the
  orchestrator's. If your work changes something a submission document states,
  write the correction in your handoff and let the orchestrator apply it.
- `projects\04-bee-bystander\ops\video\**` — do not regenerate, re-record or
  re-assemble the demo video. The orchestrator re-cuts it after review.
- `README.md` section 2.1 — extend the verified/unverified table with your new
  rows, but do not rewrite that section.

## THE FOUR HARD RULES — verbatim, and they end the task if broken

1. **No invented media, data, sources, licences or test results.** If something
   fails, report BLOCKED with the exact error text. A real error is a useful
   result; a fabricated success ends the task.
2. **No simulation standing in for a failing real component.** Mocks belong in
   tests and nowhere else. If the live Bee path cannot be verified, say it
   cannot be verified — do not write a fake one and describe it as live.
3. **Scripts in `ops\` only, and never anything outside the project folder.**
   No `taskkill node.exe`. No `timeout`. No writing, moving or deleting a file
   outside `projects\04-bee-bystander`.
4. **No commit to a remote, no push, no deploy, no Devpost, no YouTube, no AWS
   console.** Local commits only; the orchestrator publishes. Never sign a
   judge-facing document as its author.

## SECRETS

No token, API key, account id or redemption code goes into any file, commit,
log, screenshot or handoff. `.env` is gitignored; `.env.example` carries empty
placeholders only. If you ever see a value that looks like a credential, do not
copy it anywhere, including into your own notes.

## REQUIRED HANDOFF

Write `projects\04-bee-bystander\docs\04-agents\handoff-task22.md` containing:

- **DONE / BLOCKED / RISK / NEXT** at the top, in that order, one line each
  before any detail.
- A section per deliverable D1–D9 with the files you changed and why.
- **Raw output, pasted, not summarised**: the full test run with the
  `# tests / # pass / # fail` lines; `npx tsc --noEmit` output; the Vite build
  output; `node ops\probe-bee-live.mjs`; `node ops\probe-protocol-version.mjs`;
  `node ops\mcp-client-demo.mjs`.
- **SHA-256 of every file you created or changed**, as
  `certutil -hashfile <path> SHA256`.
- **A figures provenance table**: every number you state anywhere, and the exact
  command or file:line that produces it.
- **What I actually SEE** — for each of the four views, describe what is on your
  screen, including anything wrong, empty or ugly. Not what you intended to
  build. If you have not opened a view in a browser, say so.
- **What I could not verify** — and be specific. "The live Bee path" is not
  specific; "the authenticated `/v1/conversations` response shape, because this
  machine has no token and I did not obtain one" is.
- Measured contrast ratios for every new text/background pair.

## HOW THIS WILL BE CHECKED

The orchestrator re-runs every test you cite, re-runs every probe, re-fetches
every URL you quote, opens every screenshot, reads every diff, and writes its
own independent probes against your guards rather than trusting yours. Task 21
looked green and had a real leak in it; that was found by serialising the whole
payload instead of the part the test chose to look at. Assume the same
scepticism. The fastest route through review is an honest BLOCKED.

Start a fresh conversation for this task. Work through D1–D9 in order.

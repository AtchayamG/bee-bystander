# Privacy

Bystander is software you run on your own computer. There is no hosted
Bystander service: the author operates no server, receives no data, and has
no way to see anything you or the people around you say.

Every statement below is checkable against the code, and the file or test
that backs it is named.

## What it reads

- **Your Bee conversations**, either from the Bee developer API
  (`https://app-api-developer.ce.bee.amazon.dev`) using an optional direct
  `BEE_TOKEN`, or through the official Bee CLI's local proxy at
  `http://127.0.0.1:8787`. The proxy keeps CLI authentication local; Bystander
  does not read or export its credential. Plain HTTP is accepted only on
  loopback. (`services/bystander/src/client.ts`)
- **Bundled fixture conversations** when the configured Bee connection is not
  authenticated. A successful live response with an empty conversation list
  remains live and empty; it is never replaced with fixtures.

## What it stores

One SQLite file on your disk, `services/bystander/data/bystander.db`, which is
excluded from git. It has exactly three tables
(`services/bystander/src/db.ts`):

| Table | What is in it |
| :--- | :--- |
| `participants` | The consent ledger: speaker cluster id, the name you typed when enrolling someone, their role, their consent status, when it last changed, optional notes. |
| `audit_records` | One row per removal: conversation id, category, cluster id, reason, character span, character and word counts, and the placeholder that replaced it. **Never the text that was removed** — the schema has no column for it (`tests/persistence.test.ts`). |
| `events` | An append-only activity log: event kind, cluster id, conversation id, a short description, a timestamp. **It never contains a person's name** (`tests/withdrawal-erasure.test.ts`). |

It does **not** store transcripts — raw or redacted — audio, voiceprints, or
anything that identifies a speaker beyond the cluster id Bee assigns and the
name you choose to enter.

## What leaves your machine

Only the requests to the Bee API described above. In proxy mode the official
Bee CLI authenticates the local forwarding request; Bystander receives no raw
credential. No analytics, no telemetry, no crash reporting, no third-party
services, and no AI model calls: redaction and refusal are deterministic code
that runs locally.

## Who can reach it

The service listens on `127.0.0.1` only, not on your network
(`tests/entrypoint-bind.test.ts`). Browser access is limited to Bystander's
own interface: any other web page is refused with `403`, on every route,
including the MCP endpoint (`tests/origin-guard.test.ts`).

## People who never agreed to be recorded

A voice Bystander has no consent record for is treated as a refusal, never as
consent: its speech is withheld from every transcript and summary until that
person is enrolled as `CONSENTED` (`tests/bystander-redaction.test.ts`).

## Withdrawing consent

Un-enrolling a person deletes their row from the ledger, and the database is
opened with `secure_delete` on, so the deleted bytes are overwritten rather
than left readable in the file. After withdrawal, the name is absent from the
database file, its WAL and SHM files, the ledger API and the event feed —
tested byte-for-byte, with a control that proves the search can see a name
that is really there (`tests/withdrawal-erasure.test.ts`). Their cluster then
reverts to `UNKNOWN`, which means refusal.

## Retention

- **Audit records** older than `RETENTION_DAYS` (default **30**) are deleted
  when the service starts and whenever a sweep is run.
- **A single conversation's** audit records can be purged at any time from the
  interface or `POST /api/retention/purge`.
- **Events** are kept. They hold no names and no speech, but they do record
  cluster ids and timestamps of what happened, indefinitely.
- **Your Bee data itself** is held by Bee and governed by Bee's own privacy
  terms, not by this project.

## Known limits

- Any program already running on your computer can call the service; there is
  no local login. The protection is against web pages and other machines.
- If you choose direct-token mode, your Bee token sits in a plain `.env` file
  on your disk. Proxy mode does not require a token in `.env`.
- This is open-source software under the MIT licence, provided as is.

## Contact

Open an issue at https://github.com/AtchayamG/bee-bystander/issues.

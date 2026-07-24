# VG Email Sidecar

A long-lived Node.js process that handles outbound email for Village Green
service requests. The sidecar polls the `notification_event` table in the
shared database, resolves recipients based on service type and volunteer
capabilities, and sends email via the Gmail API (`googleapis` — not SMTP).

## Setup

### Prerequisites

- Node.js 18+
- Access to the Village Green database (same credentials as the API)
- A Google service-account key JSON with domain-wide delegation for the `gmail.send` scope (stored at the path in `GMAIL_SA_KEY_PATH`)

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env` and update with your environment:
   ```bash
   cp .env.example .env
   ```

2. Place the service-account key JSON at the path specified by
   `GMAIL_SA_KEY_PATH` (default `./vg-mailer-sa-key.json`). This file is the
   key you downloaded for the service account and contains at least:
   ```json
   {
     "client_email": "vg-mailer@your-project.iam.gserviceaccount.com",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   }
   ```
   The service account must have domain-wide delegation authorized for the
   `https://www.googleapis.com/auth/gmail.send` scope so it can impersonate
   the sending mailboxes. The key file is gitignored — never commit it.

3. Database credentials must match the Village Green API setup (same host,
   user, password, database).

4. Optional: set `TEST_RECIPIENTS` (comma-separated emails) to redirect
   **all** outbound mail to test addresses. Test mode prefixes subjects with
   `[TEST]` and injects a banner listing the intended real recipients.

## Running

```bash
npm start
```

The sidecar will:
1. Verify database connectivity and Gmail credentials
2. Run an immediate poll for pending notification events
3. Start a recurring poll every 60 seconds (or `POLL_INTERVAL_MS` if configured)
4. Log all activity to stdout

## Event Types and Email Flow

The API writes rows to `notification_event`; the sidecar dispatches on
`eventType`:

### `open` — new/reopened request seeking a volunteer

1. Map `serviceName` to a capability ("Ride: *" → Rides,
   "Household Chores/Handy Help" → Home Help, "Tech Support" → Tech Support,
   "Errand: *" → Errands).
2. Query all volunteers in the request's village holding that capability.
3. Send **one email, BCC'd to the whole volunteer pool** (the member is not
   copied). Subject: `SR Request #<n>-For <member>-Service Date: <date>`,
   using the legacy `requestNumber` when present, otherwise the DB id.
4. Repeat opens for the same SR get an ordinal subject prefix (`2nd`, `3rd`,
   `4th`) and a `SECOND REQUEST` style body prefix; legacy SRs count their
   presumed-sent original.

### `confirmed` — volunteer assigned

Sends two differently-templated emails: one to the assigned volunteer, one to
the member (skipped if the member has no email). Subject: `SR Conf #…`.

### `cancelled`

Notifies the member, and the volunteer if one was assigned.
Subject: `SR Cancel #…`.

### `reminder` — service is two days away

Sent to the assigned volunteer and the member (skipped if the member has no
email). Subject: `SR Reminder #…`. One shared template covers all four service
types; **Starting Location appears on rides only**.

Reminder rows are enqueued by a MySQL scheduled `EVENT` owned by the
village-green migrations, not by the API — see `docs/examples/reminder-event.sql`
for a documented reference implementation (prerequisite:
`SET GLOBAL event_scheduler = ON`).

**The event is recreated by hand at each DST boundary.** The production database
runs on UTC, and `ON SCHEDULE ... STARTS` is evaluated once at `CREATE` time, so
a daily event does not follow a DST change on its own. 7am Eastern is **11:00
UTC during EDT** and **12:00 UTC during EST**; at each boundary, drop the event
and recreate it with the other time. Between boundaries it fires at a stable UTC
time, and a missed boundary sends reminders an hour early or late until fixed.

Because pending rows are durable and are not age-filtered, a reminder queued
while the sidecar is down is delivered whenever it next runs. The branch
therefore re-checks the request at send time: anything no longer `Confirmed`,
or that has lost its volunteer, is **marked sent without emailing** rather than
marked failed — skipping is the correct outcome, and a `failedAt` row would
read as a false alarm during triage.

Unknown event types are marked failed.

## PIN Webhook (`POST /internal/send-pin`)

Besides polling `notification_event`, the sidecar runs a small HTTP listener
(default `127.0.0.1:8125`, tunable via `HTTP_PORT`/`HTTP_HOST`) for the
enrollment **PIN fast path**. The VG API POSTs `{ email, pin, firstName, kind }`
fire-and-forget; the sidecar emails the plaintext PIN.

**Authentication.** The endpoint requires a static shared-secret bearer:

- Set `VG_ENROLL_SIDECAR_KEY` here to the **same value** as the API's
  `VG_ENROLL_SIDECAR_KEY`.
- The API sends `Authorization: Bearer <VG_ENROLL_SIDECAR_KEY>`; the sidecar
  verifies it with a constant-time compare before reading the body.
- **Fail-closed:** if `VG_ENROLL_SIDECAR_KEY` is unset here, the listener
  rejects **every** `/internal/send-pin` request with `401`.
- On a missing/wrong token the sidecar returns `401 {"error":"unauthorized"}`
  and logs nothing from the token or body (the body carries the PIN).

This bearer is defense-in-depth. The primary control in production is network
isolation: run the API and this VM in the same Azure VNet (Regional VNet
Integration) and restrict the VM's NSG to the integration subnet, so the
webhook port is not reachable from other tenants at all.

## Error Handling

- **Success:** `sentAt` is stamped and `recipients` records the JSON array of
  notified person ids.
- **Failure** (send error, unresolvable recipients, missing service request):
  `failedAt` is stamped. The pending-events query excludes rows with
  `failedAt` set, so **failed events are not retried** — clearing `failedAt`
  manually re-queues a row.
- **Database errors:** logged; the event is skipped and subsequent events
  continue processing.

## Logging

All logs are printed to stdout with ISO timestamps. Format:
```
[2026-06-22T15:30:45.123Z] Event log message
```

## Graceful Shutdown

The sidecar responds to `SIGTERM` and `SIGINT` signals: stops the poll loop,
closes database connections, and exits cleanly.

## Database Schema

The sidecar expects these tables (managed by VG API migrations; all VG-native
columns are **camelCase**):

- `notification_event` — the queue: `id, eventType, serviceRequestId,
  createdAt, sentAt, recipients, failedAt` (`recipients` is written by the
  sidecar on send)
- `service_request` — request details (`serviceName`, `memberPersonId`,
  `volunteerPersonId`, wall-clock `serviceDate`/time columns, …)
- `person`, `member`, `volunteer` — people and their roles
- `volunteer_capability`, `capability` — capability associations and master
  list (Rides, Errands, Home Help, Tech Support)

**Date/time caution:** `serviceDate` and the time columns are wall-clock
civil values (`YYYY-MM-DD`, `HH:MM:SS`), not instants. The formatters in
`src/templates.js` and `src/email-processor.js` parse them as plain strings —
never run them through `new Date(isoString)` or timezone conversion.

## Testing

```bash
npm test    # node --test over test/*.test.js
```

Tests cover the pure pieces: template builders, subject/ordinal logic,
recipient derivation. There is no DB or Gmail integration harness.

## Troubleshooting

### Gmail send failures
Check that `GMAIL_SA_KEY_PATH` points to a valid service-account key JSON
(with `client_email` and `private_key`). An `unauthorized_client` error means
the service account's domain-wide delegation for the `gmail.send` scope is not
authorized in the Google Workspace admin console for the mailbox being
impersonated.

### No emails being sent
Check `notification_event` for pending rows
(`WHERE sentAt IS NULL AND failedAt IS NULL`). Rows with `failedAt` set will
never retry on their own. Verify volunteer capabilities match the mapped
capability for the service type. Check logs for warnings about missing emails
or unrecognized service types.

## Development

The sidecar is written in **CommonJS** (`require`). Database access uses
`mysql2/promise` with a fresh connection per query (`initializePool` is a
startup connectivity check, not a real pool).

To extend:
- New service type mappings: `SERVICE_TYPE_TO_CAPABILITY` in
  `src/email-processor.js`
- Email templates: builder functions in `src/templates.js` (one per
  event-type × service-family combination, e.g.
  `buildRidesOpenRequestTemplate`, `buildHomeHelpMemberConfirmedTemplate`,
  `buildCancelledTemplate`)
- Poll interval: `POLL_INTERVAL_MS` environment variable

## Service Request Time-Correction Emails (one-off)

Re-sends each `Ride:` service request (`id <= 2003`) as a **CORRECTED**
open-request email to the same volunteers who originally received it. The
original emails showed ride times 4 hours ahead of what the Member requested
(an old UTC-rendering bug, since fixed in `templates.js`); this re-renders
the corrected DB rows through the current Eastern-time template and prepends
a red-framed correction notice.

```bash
# 1. Dry run — list target SRs and resolved recipients, send nothing:
node src/send-corrections.js --dry-run

# 2. Test pass — set TEST_RECIPIENTS in .env, then send to yourself:
node src/send-corrections.js

# 3. Live — unset TEST_RECIPIENTS, then send to real volunteers:
node src/send-corrections.js
```

Read-only against the DB (no writes, no `notification_event` rows). Each SR
with no matching `Rides` volunteers is skipped with a warning.

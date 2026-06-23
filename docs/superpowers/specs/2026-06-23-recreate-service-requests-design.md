# Recreate Service Requests From Sent Email — Design

**Date:** 2026-06-23
**Status:** Approved (pending spec review)
**Type:** One-off recovery utility

## Problem

A set of `service_request` rows were accidentally deleted from the Village Green
(`vg`) database. The corresponding "open request" emails sent to volunteers still
exist in the Gmail **Sent** folder of `services@villagecommonri.org`. Each email's
subject line and HTML body contain enough information to reconstruct the deleted
rows. This utility reads those Sent emails, parses them, and emits **reviewable
SQL** (`INSERT` statements) that an operator runs manually to restore the rows
with their **original IDs**.

This is a one-off script. It does **not** write to the database. It produces SQL
and a JSON report for human review.

## Scope

**In scope:** A specific, known range of open service requests — IDs **#1024
through #1040** (17 requests), all with subject prefix `SR Request`. Verified
2026-06-23: all 17 IDs are absent from `service_request`, so all 17 are to be
recovered (none are survivors to skip).

**Out of scope (explicitly):**
- Confirmed requests (`SR Conf`). There are none to recover. No confirmed-email
  parsing, no volunteer-recipient resolution.
- Live database writes from this utility.
- Restoring `person` / `member` rows — those still exist and are joined to, not
  duplicated onto, `service_request`.

## Key facts established during design

1. **The send token cannot read mail.** `services-mailer-token.json` is scoped to
   `gmail.send` only; `messages.list` fails with "insufficient authentication
   scopes." **Resolution:** re-run the OAuth consent flow with
   `gmail.send` + `gmail.readonly` and overwrite `services-mailer-token.json`.
   The oauth helper at `../oauth-dance/get-refresh-token.js` will have
   `gmail.readonly` added to its `SCOPES` array.
2. **`village_id` is `NOT NULL`** on `service_request`. Every other recoverable
   column is nullable. `village_id` must be resolved (from the member's
   `person.village_id`) or the row flagged for manual fill.
3. **`id` is `auto_increment` but we force the original value.** Explicit `id` in
   the `INSERT` preserves the IDs that other tables (e.g. `email_event`) reference.
4. **673 `service_request` rows still exist; the target range #1024–#1040 is
   entirely missing** (verified 2026-06-23). As a safety net the script still
   queries existing IDs and **skips any id that already exists**, emitting a
   `-- SKIPPED` note rather than an `INSERT`. For this run none of 1024–1040 will
   trigger it, but it protects against re-runs and accidental overlap.
5. **All recovered rows have `status = 'Open'`** and `volunteer_person_id = NULL`.

## Source selection

We recover an explicit ID range, **#1024–#1040** (configurable via CLI:
`--from=1024 --to=1040`). Gmail cannot search a numeric range directly, so the
script issues **one read-only search per id**:

```
in:sent subject:"SR Request #<id>"
```

looping over each id in the range. This gives a precise per-id outcome:
- exactly one match → process it;
- zero matches → emit a `-- MISSING EMAIL for id=<id>` note in `out.sql` and log
  it in `report.json` (no email exists to recover from);
- multiple matches → use the most recent and add a `-- WARNING: multiple emails`
  note.

(Gmail substring subject matching may also surface `#10240` for a `#1024` query;
the parser re-validates the exact id from each matched subject and discards
non-exact hits.)

## Output

1. **`out.sql`** (path configurable / stdout) — one `INSERT INTO service_request`
   per recoverable email, with explicit `id`, preceded by any `-- WARNING` /
   `-- SKIPPED` comment lines. Wrapped in a transaction header/footer comment for
   the operator's convenience (`-- BEGIN; ... -- COMMIT;` left commented so the
   operator opts in).
2. **`report.json`** — per-message log: gmail message id, parsed `id`, member name,
   resolution outcomes, warnings, and skip reasons. For auditing the run.

## Data extraction (per email)

| Column | Source | Notes |
|---|---|---|
| `id` | Subject `#{id}` | Authoritative. Skip if already in DB. |
| `status` | constant | Always `'Open'`. |
| `member_person_id` | DB lookup of `member_name` (from subject) in `person` | NULL + WARNING on 0 / >1 match. |
| `village_id` | DB: `person.village_id` of matched member | **NOT NULL** — if member unresolved, emit row with placeholder `NULL` and a prominent `-- WARNING: village_id must be set manually`. |
| `start_at` | Subject `Service Date: M/D/YYYY` | Date only; time refined from body pickup time when present. |
| `created_at` | Email `Date` header | |
| `service_name` | Body header line ("...seeking someone to provide **X** for...") | Falls back to NULL + WARNING if unparseable. |
| `description` | Body "Short Description" cell | Best-effort. |
| `destination`, `address`, `city`, `state`, `zip` | Body "Destination" cell (Rides/Errands) | Best-effort; NULL when absent (e.g. Home Help / Tech Support). |
| `appt_time`, `return_time` | Body "Appointment Time" / "Return Pickup Time" cells | Best-effort; combined with `start_at` date. |
| `transportation_type` | Body "Transportation" cell | Best-effort. |
| `phone`, `instructions`, `finish_at`, `request_number` | not recoverable | Left NULL. |
| `volunteer_person_id` | constant | Always NULL (open requests). |

"Body best-effort" means: parse the value from the HTML when the corresponding
labeled table cell is present; otherwise leave the column NULL. Member contact
fields shown in the email (member address/phone) come from the live `person`
table via JOIN and are **not** written onto `service_request`, so they are not
parsed.

## Ambiguity handling

Always emit an `INSERT` (never halt, never silently drop), and prepend
`-- WARNING: <reason>` comment lines above the affected statement when:
- `member_name` matches zero or multiple `person` rows (→ `member_person_id` NULL,
  and `village_id` NULL needing manual fill).
- `service_name` cannot be parsed from the body.
- A body detail field is present-but-unparseable.

Emit `-- SKIPPED id=N (already exists in service_request)` instead of an `INSERT`
when the id is already present in the DB. Emit `-- MISSING EMAIL for id=N` when no
Sent email matches that id (nothing to recover from).

## Module structure

```
src/recreate/
  index.js         # CLI entry: arg parsing, orchestration, writes out.sql + report.json
  gmail-reader.js  # readonly-scoped auth; list + get + decode message body/headers
  parser.js        # PURE: subject parser + body field extractors (string in -> fields out)
  resolver.js      # DB lookups: member_person_id, village_id, existing ids
  sql-writer.js    # build INSERT statements + WARNING/SKIPPED comments; value escaping
```

Reuses existing repo infrastructure: `dotenv`, `googleapis`, `mysql2`, and the
DB connection pattern from `src/db.js`. The OAuth client construction mirrors
`src/gmail.js` (`buildAuthClient`) but reads the re-authorized
`services-mailer-token.json` and uses the `gmail.readonly` capability.

`parser.js` has no I/O dependencies, so it is unit-testable in isolation.

## Data flow

```
CLI args (--from, --to) ──> existingIds = resolver.existingIds(from..to)
   for srId in from..to:
     if srId in existingIds: sql-writer.skipped(srId); report.push(skip); continue
     msgs = gmail-reader.search(`in:sent subject:"SR Request #${srId}"`)
     if msgs empty: sql-writer.missing(srId); report.push(missing); continue
     msg = most-recent(msgs); gmail-reader.get(msg.id) ──> { subject, dateHeader, bodyHtml }
     parsed = parser.parseSubject(subject)   # re-validate exact id == srId
     parser.parseBody(bodyHtml) ──> { service_name, description, destination, ... }
     resolver.resolveMember(parsed.member_name) ──> { member_person_id, village_id, warning? }
     sql-writer.insert(row, warnings) ──> appended to out.sql
     report.push(...)
write out.sql, report.json
```

## Error handling

- **Gmail auth failure (scope):** fail fast with a clear message pointing to the
  re-auth step. (This is the first thing the script verifies.)
- **DB unreachable:** fail fast before processing any messages.
- **Per-message parse error:** caught, logged to `report.json`, emitted as a
  `-- WARNING` with the raw subject so nothing is lost; processing continues.
- **No live writes**, so there is no partial-write or rollback concern.

## Testing

- **TDD on `parser.js`** (pure): fixtures captured from real Sent emails — one per
  recoverable service type (Rides, Errands, Home Help, Tech Support), all `SR
  Request`. Assert extracted `id`, `member_name`, `service_date`, `service_name`,
  `description`, and destination/time fields. Include a malformed-subject fixture
  and a missing-body-field fixture to exercise the NULL/WARNING paths.
- **`sql-writer.js`**: assert value escaping (quotes, NULLs, dates) and that
  warnings/skips render as comments.
- **`resolver.js` / `gmail-reader.js`:** thin I/O wrappers, verified during a live
  dry run against the real mailbox + DB (read-only), checking the generated SQL
  before any manual execution.

## Operator runbook (post-implementation)

1. Re-run `../oauth-dance/get-refresh-token.js` (now requesting
   `gmail.send`+`gmail.readonly`); overwrite `services-mailer-token.json`.
2. `node src/recreate/index.js --from=1024 --to=1040 --out out.sql`
3. Review `out.sql` and `report.json`; resolve any `-- WARNING` / `-- MISSING`
   rows (especially missing `village_id`, and any id with no Sent email).
4. Run the reviewed SQL manually against `vg`.

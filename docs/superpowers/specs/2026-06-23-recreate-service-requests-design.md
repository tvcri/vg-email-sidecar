# Recreate Service Requests From Sent Email — Design

**Date:** 2026-06-23
**Status:** Approved (pending spec review)
**Type:** One-off recovery utility

## Problem

A set of `service_request` rows were accidentally deleted from the Village Green
(`vg`) database. The corresponding "open request" emails sent to volunteers have
been collected into a single local file, **`./Recovery_emails.eml`** — an outer
email whose attachments are the original request emails (one `message/rfc822`
attachment per request). Each attached email's subject line and HTML body contain
enough information to reconstruct the deleted rows. This utility reads that local
`.eml` file, parses the attached emails, and emits **reviewable SQL** (`INSERT`
statements) that an operator runs manually to restore the rows with their
**original IDs**.

This is a one-off script. It reads a local file only — **no Gmail/network access
and no OAuth** are required. It does **not** write to the database. It produces SQL
and a JSON report for human review.

## Scope

**In scope:** The open service requests attached to `./Recovery_emails.eml` —
IDs **#1024 through #1040** (17 requests), all with subject prefix `SR Request`.
Verified 2026-06-23: all 17 IDs are present as attachments and all 17 are absent
from `service_request`, so all 17 are to be recovered (none are survivors to skip).

**Note — duplicate:** ID **#1024 appears twice** in the file, with two different
service dates (6/24/2026 and 6/26/2026). The script must detect duplicate ids and
flag them (emit both, commented out, with a `-- WARNING: duplicate id` so the
operator picks the correct one). See Duplicate handling.

**Out of scope (explicitly):**
- Confirmed requests (`SR Conf`). There are none to recover. No confirmed-email
  parsing, no volunteer-recipient resolution.
- Gmail / network access and OAuth — the source is a local file.
- Live database writes from this utility.
- Restoring `person` / `member` rows — those still exist and are joined to, not
  duplicated onto, `service_request`.

## Key facts established during design

1. **Source is the local `./Recovery_emails.eml`.** It is a `multipart/mixed`
   email; each request is a `message/rfc822` attachment named e.g.
   `SR Request #1040-For Masullo, Linda-Service Date: 7/1/2026.eml`. Some
   attachments are forwarded replies (`Re: SR Request #…` wrapping the original);
   the parser uses the **inner-most original message** for the subject and body.
   Bodies are quoted-printable encoded (soft `=\n` line breaks) and must be decoded
   before parsing. **No Gmail read access / OAuth is needed** (this supersedes the
   earlier plan to re-authorize the token with `gmail.readonly`).
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
6. **#1024 is duplicated** in the source (two service dates). See Duplicate
   handling.

## Source: parsing `Recovery_emails.eml`

The script reads the single local file (path via `--in`, default
`./Recovery_emails.eml`) and walks its MIME tree:

1. Parse the outer `multipart/mixed` message.
2. Collect every `message/rfc822` attachment.
3. For each attachment, descend to the **inner-most `message/rfc822`** (unwrapping
   any forwarded `Re:` wrapper) to get the original request's `Subject`, `Date`
   header, and `text/html` body.
4. Decode the body (quoted-printable) before handing it to the parser.

The script is **offline and deterministic** — it runs the same way every time with
no network, no quota, and no auth. Because the source file is fixed on disk, no
caching layer is needed; re-running is already cheap and repeatable. A standard
MIME parser (`mailparser`, already transitively common, or a small hand-rolled
walker) handles step 1–4; choice is an implementation detail.

The subject and body of each inner message are then parsed exactly as before
(see Data extraction). The id is taken from the subject and **re-validated**
against the attachment filename's id.

### Duplicate handling

If two attachments yield the **same id** (as #1024 does), both are emitted
**commented out**, each preceded by `-- WARNING: duplicate id N — two source
emails (dates: …); operator must choose one`. They are also recorded together in
`report.json`. The operator picks the correct one, uncomments it, and discards the
other.

## Output

1. **`out.sql`** (path configurable / stdout) — one `INSERT INTO service_request`
   per recoverable email, with explicit `id`, preceded by any `-- WARNING` /
   `-- SKIPPED` comment lines. Wrapped in a transaction header/footer comment for
   the operator's convenience (`-- BEGIN; ... -- COMMIT;` left commented so the
   operator opts in).
2. **`report.json`** — per-attachment log: source filename, parsed `id`, member
   name, resolution outcomes, warnings, duplicate/skip reasons. For auditing the run.

## Data extraction (per email)

| Column | Source | Notes |
|---|---|---|
| `id` | Subject `#{id}` | Authoritative. Skip if already in DB. |
| `status` | constant | Always `'Open'`. |
| `member_person_id` | DB lookup of `member_name` (from subject) in `person` | NULL + WARNING on 0 / >1 match. |
| `village_id` | DB: `person.village_id` of matched member | **NOT NULL** — if member unresolved, the row is emitted **commented out** with a prominent `-- WARNING: village_id must be set manually` (NULL would violate the constraint). |
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

Two categories of `INSERT`:

- **Clean rows** — fully resolved, no warnings — are emitted as runnable
  `INSERT` statements.
- **Flagged rows** — anything that triggered a warning — are emitted with
  `-- WARNING: <reason>` lines **and the `INSERT` statement itself commented out**
  (every line of the statement prefixed with `-- `). The operator must read the
  warning, fix the value, and uncomment the statement to run it. This prevents
  accidentally executing an incomplete or invalid row (e.g. a `NULL` `village_id`,
  which would violate the `NOT NULL` constraint anyway).

A row is flagged (commented out) when:
- `member_name` matches zero or multiple `person` rows (→ `member_person_id` NULL,
  and `village_id` NULL needing manual fill).
- `service_name` cannot be parsed from the body.
- A body detail field is present-but-unparseable.
- The id is **duplicated** across attachments (see Duplicate handling).

Emit `-- SKIPPED id=N (already exists in service_request)` instead of an `INSERT`
when the id is already present in the DB. Emit `-- MISSING id=N (no attachment in
Recovery_emails.eml)` if an expected id has no attachment.

To make the commented-out statements easy to find and fix, each is also written
to `report.json` with its id and the list of reasons.

## Module structure

```
src/recreate/
  index.js         # CLI entry: arg parsing, orchestration, writes out.sql + report.json
  eml-source.js    # read Recovery_emails.eml, walk MIME, yield {id, filename, subject, dateHeader, bodyHtml} per attachment
  parser.js        # PURE: subject parser + body field extractors (string in -> fields out)
  resolver.js      # DB lookups: member_person_id, village_id, existing ids
  sql-writer.js    # build INSERT statements (commenting out flagged/duplicate rows) + WARNING/SKIPPED/MISSING comments; value escaping
```

`eml-source.js` is the only module `index.js` calls for email data; it owns MIME
parsing, forwarded-wrapper unwrapping, and quoted-printable decoding, yielding
clean `{ subject, bodyHtml, ... }` records. No Gmail, no OAuth, no cache.

Reuses existing repo infrastructure: `dotenv`, `mysql2`, and the DB connection
pattern from `src/db.js`. MIME parsing uses a small library (e.g. `mailparser`)
or a focused hand-rolled walker — an implementation detail. (`googleapis` is no
longer needed by this utility.)

`parser.js` has no I/O dependencies, so it is unit-testable in isolation.

## Data flow

```
CLI args (--in, --out)
emails = eml-source.read(inPath)            # [{id, filename, subject, dateHeader, bodyHtml}, ...]
ids    = emails.map(id); dups = ids with count > 1
existingIds = resolver.existingIds(distinct ids)
   for email in emails (sorted by id, filename):
     if email.id in existingIds: sql-writer.skipped(email.id); report.push(skip); continue
     warnings = []
     if email.id in dups: warnings.push("duplicate id")
     parsed = parser.parseSubject(email.subject)   # re-validate id == filename id
     parser.parseBody(email.bodyHtml) ──> { service_name, description, destination, ... }
     resolver.resolveMember(parsed.member_name) ──> { member_person_id, village_id, warning? }
     sql-writer.insert(row, warnings)   # commented out if warnings non-empty
     report.push(...)
write out.sql, report.json
```

## Error handling

- **Input file missing/unreadable:** fail fast with a clear message naming the path.
- **DB unreachable:** fail fast before processing any attachments.
- **Per-attachment parse error:** caught, logged to `report.json`, emitted as a
  `-- WARNING` with the raw filename/subject so nothing is lost; processing
  continues with the remaining attachments.
- **No live writes / no network**, so there is no partial-write, rollback, or auth
  concern.

## Testing

- **TDD on `parser.js`** (pure): fixtures are the subject + decoded body HTML of
  attachments extracted from `Recovery_emails.eml` — covering each recoverable
  service type (Rides, Errands, Home Help, Tech Support), all `SR Request`. Assert
  extracted `id`, `member_name`, `service_date`, `service_name`, `description`, and
  destination/time fields. Include a malformed-subject fixture and a
  missing-body-field fixture to exercise the NULL/WARNING paths. (Fixtures used by
  committed tests are scrubbed of PII; the real `Recovery_emails.eml` is
  git-ignored.)
- **`eml-source.js`**: assert it extracts all attachments from a small sample
  `.eml`, unwraps a forwarded `Re:` wrapper to the inner original, decodes
  quoted-printable bodies, and reports duplicate ids.
- **`sql-writer.js`**: assert value escaping (quotes, NULLs, dates); that clean
  rows render as runnable `INSERT`s; that flagged/duplicate rows render with
  `-- WARNING` lines **and every line of the `INSERT` commented out**; and that
  skips/missing render as comments.
- **`resolver.js`:** thin DB wrapper, verified during a dry run against the real DB
  (read-only), checking the generated SQL before any manual execution.

## Operator runbook (post-implementation)

1. Ensure `./Recovery_emails.eml` is present (default input path).
2. `node src/recreate/index.js --in ./Recovery_emails.eml --out out.sql`
3. Review `out.sql` and `report.json`; resolve any `-- WARNING` rows — especially
   the **duplicate #1024** (pick one date) and any unresolved `village_id`.
4. Run the reviewed SQL manually against `vg`.

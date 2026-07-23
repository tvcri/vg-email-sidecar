# SR Starting-Address Fields in Request Emails

**Date:** 2026-07-16
**Status:** Approved, ready for implementation plan

## Problem

Request emails currently hard-code the starting location of a service request
as the requesting member's home address:

```js
const startingLocation = memberAddress
  ? `Home - ${memberAddress} ${memberCity}, ${memberState} ${memberZip}`
  : '';
```

The Village Green API is adding an explicit "start" leg to `service_request`
(migration `0016-sr-starting-address.js`), mirroring the existing destination
block. These are authoritative field values; "member's home" is only a
client-side fill convenience. The sidecar must prefer these new fields when
present.

### New columns (API migration 0016)

Added atomically in a single `ALTER TABLE service_request`:

| Destination (existing) | Start (new)   |
| ---------------------- | ------------- |
| `destination` (label)  | `start` (label) |
| `address`              | `startAddress`  |
| `city`                 | `startCity`     |
| `state`                | `startState`    |
| `zip`                  | `startZip`      |
| `phone`                | `startPhone`    |

No `isHome` flag. No backfill — existing rows keep `NULL` start columns.

## Requirements

1. When `start*` fields are populated, emails use them as the starting location.
2. When `start*` is `NULL` (legacy rows, in-flight SRs), fall back to the
   member's home address — byte-identical to today's output. No visual change
   for any existing SR.
3. **Deploy-ahead safe:** this sidecar may deploy before migration 0016 merges.
   It must run clean against a schema where the `start*` columns do not exist
   yet (no SQL error). The absent-column case and the NULL case collapse into
   the same fallback-to-home code path.
4. Rendering matches today's one-line style; `startPhone` is not shown and no
   map link is added.

## Scope of templates

Only Rides and Errands carry a starting location (Home Help / Tech Support are
in-home; cancelled notices are not applicable).

**Volunteer-facing (row already exists — swap computation only):**
- `buildRidesOpenRequestTemplate`
- `buildRidesConfirmedRequestTemplate`
- `buildErrandsOpenRequestTemplate`
- `buildErrandsConfirmedRequestTemplate`

**Member-facing confirmed (add a new Starting Location row above Destination):**
- `buildRidesMemberConfirmedTemplate`
- `buildErrandsMemberConfirmedTemplate`

## Design

### 1. Query builder + schema guardrail

Mirror the existing payload-column shim (`buildGetPendingEvents` /
`setPendingEventsHasPayload` / `detectPayloadColumn`) introduced for VG
migration 0017.

**`src/queries.js`** — convert the `GET_SERVICE_REQUEST` const into a builder:

- `buildGetServiceRequest({ hasStart })` — includes the six `sr.start*` selects
  only when `hasStart` is true. `startZip` gets `LPAD(sr.startZip, 5, '0') as
  startZip`, matching `zip` and `memberZip`.
- A module-level pinned variable defaulting to `hasStart: true` (db.js overrides
  at startup after probing).
- `setServiceRequestHasStart(hasStart)` and `getServiceRequestQuery()`.

**`src/db.js`:**

- `detectStartColumns(conn)` — probe `information_schema.columns` for
  `service_request.startAddress`. Probing one column suffices; migration 0016
  adds all six in one statement.
- In `initializePool`, call it alongside the payload probe, pass the result to
  `queries.setServiceRequestHasStart(...)`, and log presence/absence.
- `getServiceRequest` calls `queries.getServiceRequestQuery()` instead of the
  former const.

When the columns are absent, the query omits the start selects, so
`requestData.startAddress` is `undefined` and the fallback branch runs.

### 2. Shared helper — `src/templates.js`

Add near `formatServiceDate` / `formatCivilTime`:

```js
function formatStartingLocation(rd) {
  if (rd.startAddress) {
    const label = rd.start ? `${rd.start} - ` : '';
    return `${label}${rd.startAddress} ${rd.startCity}, ${rd.startState} ${rd.startZip}`;
  }
  if (rd.memberAddress) {
    return `Home - ${rd.memberAddress} ${rd.memberCity}, ${rd.memberState} ${rd.memberZip}`;
  }
  return '';
}
```

Keyed off `startAddress` alone — the `start` name label is optional decoration,
the address is the substance (parallel to the home fallback requiring no label
beyond "Home"). Export it in `module.exports`.

### 3. Template edits — `src/templates.js`

Each of the six templates: replace its inline `startingLocation` computation
with `const startingLocation = formatStartingLocation(requestData);`.

The two member-confirmed templates receive full `requestData` and need no
destructuring change (the helper reads fields directly). Insert a new row above
the existing Destination row:

```html
<tr>
  <td valign='top'>Starting Location:</td>
  <td valign='top'>${startingLocation}</td>
</tr>
```

Home Help, Tech Support, and cancelled templates are untouched.

### 4. Tests & preview

**`test/templates.test.js`:**
- `formatStartingLocation` unit: start+label, start no-label, home fallback
  (`Home - 45 Benefit St ...`), both-absent → `''`.
- Fallback regression: the 6 templates still render `Home - 45 Benefit St` with
  the existing no-start fixture.
- New start rendering: a `start*`-populated fixture renders the start line and
  does **not** render `Home -` in all 6 templates.
- Member-confirmed new row: Rides/Errands member-confirmed contain
  `Starting Location:`.

**`test/pending-events-query.test.js`** (or a sibling query test): assert
`buildGetServiceRequest({ hasStart: true })` includes `startAddress` and
`{ hasStart: false }` omits all six `start*` selects.

**`preview-templates.js`:** add `start*` fields to the Rides and Errands
fixtures so previews exercise the authoritative-start path; leave at least one
fixture without start fields to eyeball the home fallback.

## Non-goals

- No `startPhone` rendering, no start map link.
- No changes to Home Help / Tech Support / cancelled templates.
- No backfill of existing rows (owned by the API side).

# Design: Repeat Open Request Ordinal + Test Mode Subject Prefix

**Date:** 2026-06-30

## Overview

Two related subject-line enhancements:

1. When a volunteer solicitation email (`open` event) is sent for a service request that has already been solicited before, the subject line and body description reflect that this is a repeat request — e.g. `"2nd SR Request #..."` and `"SECOND REQUEST Member needs help with..."`.

2. When `TEST_RECIPIENTS` is set (test mode), every outgoing email subject is prefixed with `[TEST]`. For a 2nd-request test-mode send, `[TEST]` comes first: `"[TEST] 2nd SR Request #..."`.

## Scope

- **Ordinal prefix:** Applies only to `open` event type (volunteer BCC emails), subject line and description body.
- **`[TEST]` prefix:** Applies to all event types (`open`, `confirmed`, `cancelled`, `reminder`), subject line only.
- First send (`priorCount === 0`) retains the current subject and body format unchanged (aside from `[TEST]` when in test mode).

## Data Layer

### New SQL query — `GET_PRIOR_OPEN_COUNT`

Added to `src/queries.js`:

```sql
SELECT COUNT(*) AS prior_count
FROM notification_event
WHERE service_request_id = ?
  AND event_type = 'open'
  AND sent_at IS NOT NULL
```

Counts successfully sent `open` events for the same service request. Failed events and unsent events are excluded.

### New db function — `getPriorOpenCount(serviceRequestId)`

Added to `src/db.js`. Returns the integer count (extracts `prior_count` from the single result row). Exported and available for injection in tests.

## Ordinal Logic (open events only)

Two pure helper functions added to `src/email-processor.js`:

### `getSubjectOrdinal(priorCount)`

| `priorCount` | Returns    |
|--------------|------------|
| 0            | `null`     |
| 1            | `"2nd"`    |
| 2            | `"3rd"`    |
| 3            | `"4th"`    |
| >= 4         | `null` (logs a console warning) |

### `getBodyOrdinalPrefix(priorCount)`

| `priorCount` | Returns              |
|--------------|----------------------|
| 0            | `null`               |
| 1            | `"SECOND REQUEST"`   |
| 2            | `"THIRD REQUEST"`    |
| 3            | `"FOURTH REQUEST"`   |
| >= 4         | `null` (logs a console warning) |

Both functions are exported for unit testing.

## Subject Assembly

A new pure helper `buildSubject(baseSubject, isTestMode)` in `src/email-processor.js` handles the `[TEST]` prefix universally:

```
buildSubject("SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026", false)
→ "SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026"

buildSubject("SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026", true)
→ "[TEST] SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026"

buildSubject("2nd SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026", true)
→ "[TEST] 2nd SR Request #27143-For Mary Lou Foley-Service Date: 6/22/2026"
```

All event-type branches in `pollOnce` pass their subject string through `buildSubject` with the resolved `isTestMode` flag from the relevant `resolveRecipients*` return value.

### Open event subject and description assembly

A helper `buildOpenSubjectAndDescription` handles the ordinal-aware subject and description for `open` events:

- Calls `getPriorOpenCountFn(serviceRequestId)` (injected for testability)
- Derives ordinal strings via `getSubjectOrdinal` / `getBodyOrdinalPrefix`
- Builds the base subject string, then passes it through `buildSubject(base, isTestMode)`
- Returns `{ subject, description }` where `description` has the body prefix prepended when applicable

## No Template Changes

All existing template builder functions are unchanged. They receive a `requestData` object whose `description` field already contains the prefix when appropriate.

## Error Handling

- If `getPriorOpenCount` throws, the error propagates to the existing `try/catch` in `pollOnce`, which marks the event failed — consistent with existing behavior.

## Testing

- Unit tests for `getSubjectOrdinal`, `getBodyOrdinalPrefix`, and `buildSubject` covering all cases.
- Integration tests for `buildOpenSubjectAndDescription` covering: first send non-test, first send test-mode, second send non-test, second send test-mode.
- For all other event branches: verify `buildSubject` is called with `isTestMode` by checking the subject returned includes `[TEST]` when test mode is active.

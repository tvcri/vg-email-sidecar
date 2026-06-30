# Design: Repeat Open Request Ordinal Subject/Body

**Date:** 2026-06-30

## Overview

When a volunteer solicitation email (`open` event) is sent for a service request that has already been solicited before, the subject line and body description should reflect that this is a repeat request — e.g. "2nd SR Request #..." and "SECOND REQUEST Member needs help with...".

## Scope

- Applies only to `open` event type (volunteer BCC emails).
- `confirmed`, `cancelled`, and `reminder` events are unaffected.
- First send (no prior successful `open` notifications) retains the current subject and body unchanged.

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

Counts successfully sent `open` events for the same service request. Failed events (`failed_at IS NOT NULL`, or unsent) are excluded.

### New db function — `getPriorOpenCount(serviceRequestId)`

Added to `src/db.js`. Returns the integer count (extracts `prior_count` from the single result row). Exported and available for injection in tests.

## Ordinal Logic

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

## Subject and Body Assembly

In the `sendToBccVolunteers` branch of `pollOnce` in `src/email-processor.js`:

1. Call `getPriorOpenCount(event.service_request_id)` → `priorCount`
2. **Subject:** When `priorCount > 0` and `getSubjectOrdinal(priorCount)` is non-null, prefix the subject: `"${ordinal} SR Request #${subjectNumber}-For ${member}-Service Date: ${date}"`. When `priorCount === 0`, subject is unchanged.
3. **Body description:** When `priorCount > 0` and `getBodyOrdinalPrefix(priorCount)` is non-null, prepend the body prefix to `requestData.description` on a local copy of `requestData` before passing to the template builder. No changes to any template function.

## No Template Changes

All existing template builder functions (`buildHomeHelpOpenRequestTemplate`, `buildRidesOpenRequestTemplate`, etc.) are unchanged. They receive a `requestData` object whose `description` field already contains the prefix when appropriate.

## Error Handling

- If `getPriorOpenCount` throws, the error propagates to the existing `try/catch` in `pollOnce`, which marks the event failed and logs the error — consistent with the existing failure handling pattern.

## Testing

- Unit tests for `getSubjectOrdinal` and `getBodyOrdinalPrefix` covering all cases (0, 1, 2, 3, >=4).
- Integration: existing tests for `sendToBccVolunteers` path should mock `getPriorOpenCount` returning 0 to confirm no regression; add cases returning 1 and 2 to verify subject and description mutation.

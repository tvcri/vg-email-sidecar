# Gmail Credential Check at Startup

**Date:** 2026-06-26

## Problem

Gmail credentials are only exercised when the first email is sent. A missing token file or an expired/invalid token goes undetected until a real email event arrives, which may be hours or days after startup. Operators get no early warning.

## Goals

- Hard-fail at startup if the token file is missing or unreadable.
- Probe the Gmail API at startup; log a warning if the token is bad but keep the process running.
- Fix the pre-existing inconsistency where `gmail.js` hardcodes the token path instead of reading it from `getGmailConfig()`.

## Out of Scope

- Retrying the API probe on a schedule.
- Alerting beyond console output.

## Design

### `gmail.js` changes

1. Remove the `TOKEN_PATH` constant.
2. Import `getGmailConfig` from `./config` and use `getGmailConfig().tokenPath` wherever the path is needed (`buildAuthClient` and `verifyCredentials`).
3. Export a new `verifyCredentials()` async function:
   - Read and parse the token file. If missing or unreadable, **throw** — this surfaces as a hard startup failure.
   - Build the OAuth2 client and call `gmail.users.getProfile({ userId: 'me' })` as a lightweight probe.
   - If the API call fails, `console.warn` the error and **resolve normally** — the process stays alive.

### `index.js` changes

Call `verifyCredentials()` in `startSidecar()` after `initializePool()` and before `pollOnce()`:

```js
await initializePool();
await verifyCredentials();  // throws on missing file → process.exit(1) via existing catch
await pollOnce();
```

The existing `try/catch` in `startSidecar()` already calls `process.exit(1)` on any thrown error, so no additional error-handling code is needed in `index.js`.

### Failure modes

| Condition | Behavior |
|---|---|
| Token file missing or unreadable | `verifyCredentials()` throws → `startSidecar()` catches → `process.exit(1)` |
| Token file present, Gmail API rejects it | `console.warn`, process continues |
| Token file present, Gmail API succeeds | Silent success, startup proceeds normally |

## Files Changed

- `src/gmail.js` — add `verifyCredentials()`, replace hardcoded `TOKEN_PATH` with `getGmailConfig().tokenPath`
- `src/index.js` — call `verifyCredentials()` after DB init

## Verification

- Remove the token file and confirm the process exits with an error at startup.
- Restore the file with a bad `refresh_token` and confirm the process logs a warning but continues polling.
- Normal startup with valid credentials produces no new output.

# VG Email Sidecar

A long-lived Node.js process that handles outbound email for Village Green's service request emergency feature. The sidecar polls the `email_event` table in the shared database, resolves recipients based on service type and volunteer availability, and sends emails via Gmail.

## Setup

### Prerequisites

- Node.js 18+
- Access to the Village Green database (same credentials as the API)
- Gmail OAuth2 credentials (stored in `services-mailer-token.json`)

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env` and update with your environment:
   ```bash
   cp .env.example .env
   ```

2. Ensure `services-mailer-token.json` exists at the path specified by `GMAIL_TOKEN_PATH`. This file should contain:
   ```json
   {
     "client_id": "your-client-id",
     "client_secret": "your-client-secret",
     "refresh_token": "your-refresh-token"
   }
   ```

3. Database credentials must match the Village Green API setup (same host, user, password, database).

## Running

```bash
npm start
```

The sidecar will:
1. Initialize a database connection pool
2. Run an immediate poll for pending email events
3. Start a recurring poll every 60 seconds (or `POLL_INTERVAL_MS` if configured)
4. Log all activity to stdout

## Email Flow

### New Service Request (no volunteer assigned)

When a `new_request` event is created without a `volunteer_id`:

1. Extract the service type (capability) from `service_name` (e.g., "Ride: Medical Appnt" → "Rides")
2. Query all volunteers in the request's village with that capability
3. Send an email to each volunteer requesting participation
4. Copy the member on the email
5. Mark the event as sent once all emails succeed (no partial retries)

**Recipient Mapping:**
- `service_name` starting with "Ride:" → Capability "Rides"
- `service_name` == "Household Chores/Handy Help" → Capability "Home Help"
- `service_name` == "Tech Support" → Capability "Tech Support"
- `service_name` starting with "Errand:" → Capability "Errands"

### Confirmed Service Request (volunteer assigned)

When a `patch_request` event is created with a non-null `volunteer_id`:

1. Resolve the assigned volunteer
2. Send a confirmation email to the volunteer with full request details
3. Copy the member on the email
4. Mark the event as sent once the email succeeds

## Error Handling

- **Missing emails**: If a volunteer has no email address, that volunteer's email is skipped (logged as warning). If a member has no email, the entire event fails and will retry indefinitely.
- **Send failures**: If email sending fails, the `sent_at` field is left NULL, and the event will be retried in the next poll cycle.
- **Database errors**: Logged and the event is skipped; subsequent events continue processing.

## Logging

All logs are printed to stdout with ISO timestamps. Format:
```
[2026-06-22T15:30:45.123Z] Event log message
```

## Graceful Shutdown

The sidecar responds to `SIGTERM` and `SIGINT` signals:
- Stops the poll loop
- Closes database connections
- Exits cleanly

## Database Schema

The sidecar expects the following tables (managed by VG API migrations):

- `email_event`: event queue with id, event_type, service_request_id, volunteer_id, created_at, sent_at
- `service_request`: request details with service_name, member_person_id, volunteer_person_id, etc.
- `volunteer`: volunteer records with person_id
- `person`: person records with email, phone, address, emergency_contact_* fields
- `member`: member details with service_notes
- `volunteer_capability`: volunteer-capability associations
- `capability`: capability master list (Rides, Errands, Home Help, Tech Support)

## Troubleshooting

### "Pool not initialized" error
Ensure the database connection parameters are correct and the database is accessible.

### Gmail send failures
Check that `GMAIL_TOKEN_PATH` points to a valid `services-mailer-token.json` with valid OAuth credentials. The refresh token may have expired; regenerate via the oauth-dance script.

### No emails being sent
Check `email_event` table for pending rows (WHERE sent_at IS NULL). Verify volunteer capabilities match the mapped capability for the service type. Check logs for warnings about missing emails or unrecognized service types.

## Development

The sidecar is written in ES modules. All database queries use `mysql2/promise` for async/await support.

To extend:
- Add new service type mappings to `SERVICE_TYPE_TO_CAPABILITY` in `src/email-processor.js`
- Modify email templates by editing `buildNewRequestTemplate()` and `buildPatchRequestTemplate()` functions
- Adjust poll interval via `POLL_INTERVAL_MS` environment variable

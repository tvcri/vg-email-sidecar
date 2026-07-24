-- EXAMPLE ONLY - not applied by this repo.
--
-- Enqueues reminder notification_event rows. This belongs to the village-green
-- migrations (see tvcri/village-green#62); it lives here as a reviewed
-- reference because the sidecar is what consumes the rows.
--
-- Business rule: send reminders at 7am Eastern, two days before the service
-- date, for Confirmed requests that have an assigned volunteer.
--
-- ---------------------------------------------------------------------------
-- DST: this event is recreated by hand twice a year. Read this before editing.
-- ---------------------------------------------------------------------------
-- The production database runs on UTC, and 7am Eastern is a different UTC time
-- depending on the season:
--
--     EDT (roughly mid-March to early November)  7am ET = 11:00 UTC
--     EST (roughly early November to mid-March)  7am ET = 12:00 UTC
--
-- ON SCHEDULE ... STARTS is evaluated ONCE, when the event is created, and the
-- interval is then added to that fixed instant forever. It does not re-evaluate
-- and will not follow a DST change on its own.
--
-- The accepted operational practice here is to DROP and re-CREATE this event at
-- each DST boundary with the correct UTC time below, rather than making the
-- event self-adjusting. Between boundaries it fires at a stable UTC time; for
-- the days between a missed boundary and the fix, reminders go out an hour
-- early or an hour late, which is tolerable for this notice.
--
-- The STARTS date below is a concrete example - use the next occurrence of the
-- chosen UTC time when you actually create the event.
--
-- Prerequisite: SET GLOBAL event_scheduler = ON;
--
-- Idempotent: the NOT EXISTS guard means a re-run, a scheduler restart, or a
-- manual re-run cannot double-queue a reminder for the same service request.

-- ============================================================================
-- EDT version (mid-March to early November): 11:00 UTC = 7am EDT
-- ============================================================================
CREATE EVENT vg_reminder_enqueue
ON SCHEDULE EVERY 1 DAY
STARTS '2026-07-24 11:00:00'
DO
  INSERT INTO notification_event (eventType, serviceRequestId)
  SELECT 'reminder', sr.id
  FROM service_request sr
  WHERE sr.status = 'Confirmed'
    AND sr.volunteerPersonId IS NOT NULL
    AND sr.serviceDate = DATE(NOW()) + INTERVAL 2 DAY
    AND NOT EXISTS (
      SELECT 1 FROM notification_event ne
      WHERE ne.serviceRequestId = sr.id
        AND ne.eventType = 'reminder');

-- ============================================================================
-- EST version (early November to mid-March): 12:00 UTC = 7am EST
-- At the boundary:  DROP EVENT vg_reminder_enqueue;  then CREATE with 12:00.
-- ============================================================================
--
--   CREATE EVENT vg_reminder_enqueue
--   ON SCHEDULE EVERY 1 DAY
--   STARTS '2026-11-02 12:00:00'
--   DO
--     INSERT INTO notification_event (eventType, serviceRequestId)
--     SELECT 'reminder', sr.id
--     FROM service_request sr
--     WHERE sr.status = 'Confirmed'
--       AND sr.volunteerPersonId IS NOT NULL
--       AND sr.serviceDate = DATE(NOW()) + INTERVAL 2 DAY
--       AND NOT EXISTS (
--         SELECT 1 FROM notification_event ne
--         WHERE ne.serviceRequestId = sr.id
--           AND ne.eventType = 'reminder');

-- ---------------------------------------------------------------------------
-- Note on DATE(NOW()): the server is UTC and the event fires at 11:00/12:00
-- UTC, which is 7am Eastern the SAME calendar day - the UTC date and the
-- Eastern date agree at that hour. So "two days out" means the same window
-- under either reading, and no timezone conversion is needed here.
--
-- This holds only because the event fires mid-morning UTC. Eastern is behind
-- UTC, so in the small hours of the UTC day the Eastern date is still the day
-- before. Verified boundaries:
--
--     03:00 UTC on 2026-07-24 (EDT) -> Eastern date is 2026-07-23
--     04:00 UTC on 2026-01-15 (EST) -> Eastern date is 2026-01-14
--
-- So an event scheduled before 04:00 UTC (EDT) or 05:00 UTC (EST) would need
-- the Eastern date computed explicitly. At 11:00/12:00 UTC it does not.
--
-- serviceDate is a wall-clock DATE column (no timezone), compared here against
-- a bare date. Never compare it against a timestamp.
-- ---------------------------------------------------------------------------

-- To preview what a run would enqueue, without inserting:
--
--   SELECT sr.id, sr.serviceName, sr.serviceDate
--   FROM service_request sr
--   WHERE sr.status = 'Confirmed'
--     AND sr.volunteerPersonId IS NOT NULL
--     AND sr.serviceDate = DATE(NOW()) + INTERVAL 2 DAY
--     AND NOT EXISTS (
--       SELECT 1 FROM notification_event ne
--       WHERE ne.serviceRequestId = sr.id AND ne.eventType = 'reminder');

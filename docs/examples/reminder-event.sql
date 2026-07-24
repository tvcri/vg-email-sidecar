-- EXAMPLE ONLY - not applied by this repo.
--
-- Enqueues reminder notification_event rows. This belongs to the village-green
-- migrations (see tvcri/village-green#62); it lives here as a reviewed
-- reference because the sidecar is what consumes the rows.
--
-- Business rule: send reminders at 7am Eastern, two days before the service
-- date, for Confirmed requests that have an assigned volunteer.
--
-- Why hourly rather than daily: a fixed-UTC daily schedule cannot hold 7am ET
-- across DST. 7am ET is 11:00 UTC in summer but 12:00 UTC in winter, and a
-- STARTS expression is evaluated once at CREATE time and then advanced by
-- exactly 24h forever - so it would silently drift by an hour each spring and
-- fall. Running hourly and gating on the Eastern hour is self-correcting.
--
-- Prerequisites:
--   * mysql.time_zone_name must be populated, or CONVERT_TZ returns NULL and
--     the WHERE clause silently matches nothing. Verify with:
--       SELECT CONVERT_TZ('2026-01-24 07:00:00','America/New_York','UTC');
--     -- expect 2026-01-24 12:00:00 (and 11:00:00 for a July date)
--   * SET GLOBAL event_scheduler = ON;
--
-- Idempotent: the NOT EXISTS guard means an hourly re-run, a scheduler
-- restart, or a manual re-run cannot double-queue a reminder.

CREATE EVENT vg_reminder_enqueue
ON SCHEDULE EVERY 1 HOUR
DO
  INSERT INTO notification_event (eventType, serviceRequestId)
  SELECT 'reminder', sr.id
  FROM service_request sr
  WHERE HOUR(CONVERT_TZ(NOW(), 'UTC', 'America/New_York')) = 7
    AND sr.status = 'Confirmed'
    AND sr.volunteerPersonId IS NOT NULL
    AND sr.serviceDate = DATE(CONVERT_TZ(NOW(), 'UTC', 'America/New_York')) + INTERVAL 2 DAY
    AND NOT EXISTS (
      SELECT 1 FROM notification_event ne
      WHERE ne.serviceRequestId = sr.id
        AND ne.eventType = 'reminder');

-- To preview what a run would enqueue, without inserting:
--
--   SELECT sr.id, sr.serviceName, sr.serviceDate
--   FROM service_request sr
--   WHERE sr.status = 'Confirmed'
--     AND sr.volunteerPersonId IS NOT NULL
--     AND sr.serviceDate = DATE(CONVERT_TZ(NOW(),'UTC','America/New_York')) + INTERVAL 2 DAY
--     AND NOT EXISTS (
--       SELECT 1 FROM notification_event ne
--       WHERE ne.serviceRequestId = sr.id AND ne.eventType = 'reminder');

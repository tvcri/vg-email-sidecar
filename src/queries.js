// The payload column only exists once VG migration 0017 has run. Against an
// older schema (e.g. production main) we omit it so the query still works;
// event.payload is then undefined, which only the enroll_ineligible handler
// reads and that event type is never enqueued on a pre-0017 schema.
function buildGetPendingEvents({ hasPayload }) {
  const cols = hasPayload
    ? 'id, eventType, serviceRequestId, payload, createdAt'
    : 'id, eventType, serviceRequestId, createdAt';
  return `
  SELECT ${cols}
  FROM notification_event
  WHERE sentAt IS NULL AND failedAt IS NULL
  ORDER BY createdAt ASC
`;
}

// Default to the full (post-0017) query; db.js overrides this at startup once
// it has probed the live schema.
let GET_PENDING_EVENTS = buildGetPendingEvents({ hasPayload: true });

function setPendingEventsHasPayload(hasPayload) {
  GET_PENDING_EVENTS = buildGetPendingEvents({ hasPayload });
}

function getPendingEventsQuery() {
  return GET_PENDING_EVENTS;
}

const MARK_NOTIFICATION_SENT = `
  UPDATE notification_event
  SET sentAt = NOW(), recipients = ?
  WHERE id = ?
`;

const MARK_NOTIFICATION_FAILED = `
  UPDATE notification_event
  SET failedAt = NOW()
  WHERE id = ?
`;

// The start* columns are added by the VG sr-starting-address migration. This
// sidecar is only ever deployed after that migration has run, so the columns are
// always present. Rows created before the feature (or otherwise left blank) have
// NULL start*, which the formatStartingLocation helper falls back to the
// member's home address for.
const GET_SERVICE_REQUEST = `
  SELECT
    sr.id,
    sr.requestNumber,
    sr.serviceName,
    sr.villageId,
    sr.memberPersonId,
    sr.volunteerPersonId,
    sr.status,
    sr.description,
    sr.instructions,
    DATE_FORMAT(sr.serviceDate, '%Y-%m-%d') AS serviceDate,
    sr.timesFlexible,
    sr.startTime,
    sr.finishTime,
    sr.apptTime,
    sr.returnTime,
    sr.address,
    sr.city,
    sr.state,
    LPAD(sr.zip, 5, '0') as zip,
    sr.destination,
    sr.phone,
    sr.start,
    sr.startAddress,
    sr.startCity,
    sr.startState,
    LPAD(sr.startZip, 5, '0') as startZip,
    sr.startPhone,
    sr.transportationType,
    mp.id as memberPersonId,
    mp.fullName as memberName,
    mp.email as memberEmail,
    mp.phone as memberPhone,
    mp.cell as memberCell,
    mp.address as memberAddress,
    mp.city as memberCity,
    mp.state as memberState,
    LPAD(mp.zip, 5, '0') as memberZip,
    mp.emergencyContactName,
    mp.emergencyContactRelationship,
    mp.emergencyContactPhone,
    m.serviceNotes
  FROM service_request sr
  LEFT JOIN person mp ON sr.memberPersonId = mp.id
  LEFT JOIN active_member m ON mp.id = m.personId
  WHERE sr.id = ?
`;

const GET_VOLUNTEER = `
  SELECT
    v.id,
    v.personId,
    p.fullName,
    p.email
  FROM active_volunteer v
  JOIN person p ON v.personId = p.id
  WHERE v.id = ?
`;

const GET_PERSON = `
  SELECT id, fullName, email, phone, cell
  FROM person
  WHERE id = ?
`;

const GET_VOLUNTEERS_BY_CAPABILITY = `
  SELECT DISTINCT
    p.id,
    p.fullName,
    p.email
  FROM active_volunteer v
  JOIN person p ON v.personId = p.id
  JOIN volunteer_capability vc ON v.id = vc.volunteerId
  JOIN capability c ON vc.capabilityId = c.id
  WHERE p.villageId = ? AND c.name = ?
`;

const GET_PRIOR_OPEN_COUNT = `
  SELECT COUNT(*) AS priorCount
  FROM notification_event
  WHERE serviceRequestId = ?
    AND eventType = 'open'
    AND sentAt IS NOT NULL
`;

module.exports = {
  getPendingEventsQuery,
  setPendingEventsHasPayload,
  GET_SERVICE_REQUEST,
  MARK_NOTIFICATION_SENT,
  MARK_NOTIFICATION_FAILED,
  GET_VOLUNTEER,
  GET_PERSON,
  GET_VOLUNTEERS_BY_CAPABILITY,
  GET_PRIOR_OPEN_COUNT,
};

const GET_PENDING_EVENTS = `
  SELECT id, eventType, serviceRequestId, payload, createdAt
  FROM notification_event
  WHERE sentAt IS NULL AND failedAt IS NULL
  ORDER BY createdAt ASC
`;

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
  GET_PENDING_EVENTS,
  MARK_NOTIFICATION_SENT,
  MARK_NOTIFICATION_FAILED,
  GET_SERVICE_REQUEST,
  GET_VOLUNTEER,
  GET_PERSON,
  GET_VOLUNTEERS_BY_CAPABILITY,
  GET_PRIOR_OPEN_COUNT,
};

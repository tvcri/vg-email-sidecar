const GET_PENDING_EVENTS = `
  SELECT id, event_type, service_request_id, created_at
  FROM notification_event
  WHERE sent_at IS NULL AND failed_at IS NULL
  ORDER BY created_at ASC
`;

const MARK_NOTIFICATION_SENT = `
  UPDATE notification_event
  SET sent_at = NOW(), recipients = ?
  WHERE id = ?
`;

const MARK_NOTIFICATION_FAILED = `
  UPDATE notification_event
  SET failed_at = NOW()
  WHERE id = ?
`;

const GET_SERVICE_REQUEST = `
  SELECT
    sr.id,
    sr.service_name,
    sr.village_id,
    sr.member_person_id,
    sr.volunteer_person_id,
    sr.status,
    sr.description,
    sr.instructions,
    sr.start_at,
    sr.appt_time,
    sr.return_time,
    sr.finish_at,
    sr.address,
    sr.city,
    sr.state,
    LPAD(sr.zip, 5, '0') as zip,
    sr.destination,
    sr.phone,
    sr.transportation_type,
    mp.id as member_person_id,
    mp.full_name as member_name,
    mp.email as member_email,
    mp.phone as member_phone,
    mp.cell as member_cell,
    mp.address as member_address,
    mp.city as member_city,
    mp.state as member_state,
    LPAD(mp.zip, 5, '0') as member_zip,
    mp.emergency_contact_name,
    mp.emergency_contact_relationship,
    mp.emergency_contact_phone,
    m.service_notes
  FROM service_request sr
  LEFT JOIN person mp ON sr.member_person_id = mp.id
  LEFT JOIN member m ON mp.id = m.person_id
  WHERE sr.id = ?
`;

const GET_VOLUNTEER = `
  SELECT
    v.id,
    v.person_id,
    p.full_name,
    p.email
  FROM volunteer v
  JOIN person p ON v.person_id = p.id
  WHERE v.id = ?
`;

const GET_PERSON = `
  SELECT id, full_name, email, phone, cell
  FROM person
  WHERE id = ?
`;

const GET_VOLUNTEERS_BY_CAPABILITY = `
  SELECT DISTINCT
    p.id,
    p.full_name,
    p.email
  FROM volunteer v
  JOIN person p ON v.person_id = p.id
  JOIN volunteer_capability vc ON v.id = vc.volunteer_id
  JOIN capability c ON vc.capability_id = c.id
  WHERE p.village_id = ? AND c.name = ?
`;

module.exports = {
  GET_PENDING_EVENTS,
  MARK_NOTIFICATION_SENT,
  MARK_NOTIFICATION_FAILED,
  GET_SERVICE_REQUEST,
  GET_VOLUNTEER,
  GET_PERSON,
  GET_VOLUNTEERS_BY_CAPABILITY,
};

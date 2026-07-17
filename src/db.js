const mysql = require('mysql2/promise');
const queries = require('./queries');

function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vg',
    timezone: 'Z',
  };
}

async function createConnection() {
  return mysql.createConnection(getDbConfig());
}

async function withConnection(fn) {
  const conn = await createConnection();
  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

// Probe the live schema for notification_event.payload (added by VG migration
// 0017) and pin the pending-events query to whichever columns exist. Lets the
// sidecar run against a pre-0017 production schema without a SQL error.
async function detectPayloadColumn(conn) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS hasPayload
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'notification_event'
        AND column_name = 'payload'`
  );
  return rows[0].hasPayload > 0;
}

// Probe the live schema for the service_request start* columns (added by VG
// migration 0016) and pin the service-request query to whichever columns exist.
// Migration 0016 adds all six start* columns atomically, so probing startAddress
// alone is sufficient. Lets the sidecar run against a pre-0016 schema without a
// SQL error; the emails then fall back to the member's home address.
async function detectStartColumns(conn) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS hasStart
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'service_request'
        AND column_name = 'startAddress'`
  );
  return rows[0].hasStart > 0;
}

async function initializePool() {
  await withConnection(async (conn) => {
    const hasPayload = await detectPayloadColumn(conn);
    queries.setPendingEventsHasPayload(hasPayload);
    console.log(`notification_event.payload column ${hasPayload ? 'present' : 'absent'}; enroll_ineligible events ${hasPayload ? 'supported' : 'not supported on this schema'}`);

    const hasStart = await detectStartColumns(conn);
    queries.setServiceRequestHasStart(hasStart);
    console.log(`service_request.start* columns ${hasStart ? 'present' : 'absent'}; request emails ${hasStart ? 'use authoritative start address' : 'fall back to member home for starting location'}`);
  });
  return true;
}

async function getPendingEmailEvents() {
  return withConnection(async (conn) => {
    const [rows] = await conn.query(queries.getPendingEventsQuery());
    return rows;
  });
}

async function markNotificationSent(id, recipientPersonIds) {
  return withConnection((conn) =>
    conn.query(queries.MARK_NOTIFICATION_SENT, [JSON.stringify(recipientPersonIds), id])
  );
}

async function markNotificationFailed(id) {
  return withConnection((conn) =>
    conn.query(queries.MARK_NOTIFICATION_FAILED, [id])
  );
}

async function getServiceRequest(serviceRequestId) {
  return withConnection(async (conn) => {
    const [rows] = await conn.query(queries.getServiceRequestQuery(), [serviceRequestId]);
    return rows[0] || null;
  });
}

async function getVolunteer(volunteerId) {
  return withConnection(async (conn) => {
    const [rows] = await conn.query(queries.GET_VOLUNTEER, [volunteerId]);
    return rows[0] || null;
  });
}

async function getPerson(personId) {
  return withConnection(async (conn) => {
    const [rows] = await conn.query(queries.GET_PERSON, [personId]);
    return rows[0] || null;
  });
}

async function getVolunteersByCapability(villageId, capabilityName) {
  return withConnection(async (conn) => {
    const [rows] = await conn.query(queries.GET_VOLUNTEERS_BY_CAPABILITY, [villageId, capabilityName]);
    return rows;
  });
}

async function getPriorOpenCount(serviceRequestId) {
  return withConnection(async (conn) => {
    const [rows] = await conn.query(queries.GET_PRIOR_OPEN_COUNT, [serviceRequestId]);
    return rows[0].priorCount;
  });
}

async function closePool() {
  // No-op for simple connection approach
}

module.exports = {
  initializePool,
  getPendingEmailEvents,
  markNotificationSent,
  markNotificationFailed,
  getServiceRequest,
  getPerson,
  getVolunteersByCapability,
  getPriorOpenCount,
  closePool,
};

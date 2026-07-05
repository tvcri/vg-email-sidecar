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

async function initializePool() {
  await withConnection(() => {});
  return true;
}

async function getPendingEmailEvents() {
  return withConnection(async (conn) => {
    const [rows] = await conn.query(queries.GET_PENDING_EVENTS);
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
    const [rows] = await conn.query(queries.GET_SERVICE_REQUEST, [serviceRequestId]);
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

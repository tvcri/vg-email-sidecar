function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vg',
  };
}

function getGmailConfig() {
  return {
    tokenPath: process.env.GMAIL_TOKEN_PATH || './services-mailer-token.json',
    fromAddress: 'services@villagecommonri.org',
    fromName: 'The Village Common of RI',
  };
}

function getPollConfig() {
  return {
    intervalMs: parseInt(process.env.POLL_INTERVAL_MS || '60000', 10),
  };
}

function getTestConfig() {
  return {
    overrideRecipients: process.env.TEST_RECIPIENTS
      ? process.env.TEST_RECIPIENTS.split(',').map(e => e.trim())
      : null,
  };
}

module.exports = {
  getDbConfig,
  getGmailConfig,
  getPollConfig,
  getTestConfig,
};

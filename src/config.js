const DEFAULT_MAILBOX = 'services@villagecommonri.org';
const DEFAULT_DISPLAY_NAME = 'The Village Common of RI';

// Sending mailbox per message kind (customer assignments, 2026-07-14).
// Kinds are notification_event.eventType values plus sidecar-internal kinds
// (enroll_pin is the webhook PIN send). member_welcome is reserved for a
// planned event type that has no handler yet. Unlisted kinds -> DEFAULT_MAILBOX.
const MAILBOX_BY_KIND = {
  open: 'services@villagecommonri.org',
  confirmed: 'services@villagecommonri.org',
  cancelled: 'services@villagecommonri.org',
  reminder: 'services@villagecommonri.org',
  enroll_pin: 'village-green@villagecommonri.org',
  enroll_ineligible: 'village-green@villagecommonri.org',
  member_welcome: 'volunteer@villagecommonri.org',
};

const MAILBOX_DISPLAY_NAMES = {
  'services@villagecommonri.org': 'The Village Common of RI',
  'village-green@villagecommonri.org': 'Village Green',
  'volunteer@villagecommonri.org': 'The Village Common of RI',
};

function getMailboxForKind(kind) {
  return MAILBOX_BY_KIND[kind] || DEFAULT_MAILBOX;
}

function getMailboxDisplayName(mailbox) {
  return MAILBOX_DISPLAY_NAMES[mailbox] || DEFAULT_DISPLAY_NAME;
}

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
    saKeyPath: process.env.GMAIL_SA_KEY_PATH || './vg-mailer-sa-key.json',
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

function getHttpConfig() {
  return {
    port: parseInt(process.env.HTTP_PORT || '8125', 10),
    host: process.env.HTTP_HOST || '127.0.0.1',
    // Shared secret for the API→sidecar PIN webhook bearer. Unset => the
    // listener fails closed (rejects every /internal/send-pin request).
    sidecarKey: process.env.VG_ENROLL_SIDECAR_KEY,
  };
}

module.exports = {
  getDbConfig,
  getGmailConfig,
  getPollConfig,
  getTestConfig,
  getHttpConfig,
  getMailboxForKind,
  getMailboxDisplayName,
};

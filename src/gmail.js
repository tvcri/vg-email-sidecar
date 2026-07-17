const fs = require('fs');
const { google } = require('googleapis');
const { getGmailConfig, getMailboxForKind, getMailboxDisplayName } = require('./config');

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

// One JWT client per impersonated mailbox: subject is fixed at construction.
// Domain-wide delegation lets the service account send as any domain mailbox.
const authClients = new Map();

function buildAuthClient(mailbox) {
  const { saKeyPath } = getGmailConfig();
  const { client_email, private_key } = JSON.parse(
    fs.readFileSync(saKeyPath, 'utf8')
  );
  return new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: [GMAIL_SEND_SCOPE],
    subject: mailbox,
  });
}

function getAuthClient(mailbox) {
  if (!authClients.has(mailbox)) {
    authClients.set(mailbox, buildAuthClient(mailbox));
  }
  return authClients.get(mailbox);
}

function encodeHeader(text) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function buildRawMessage({ to, bcc, subject, html, from }) {
  // Gmail requires a recipient somewhere (To, Cc, or Bcc) — not specifically a
  // To: header. When `to` is omitted we send a "blind" message carried by Bcc:
  // and leave out To: entirely, so guard against the no-recipient case.
  if (!to && !bcc) {
    throw new Error('buildRawMessage requires either a "to" or "bcc" recipient');
  }

  const messageParts = [
    `From: ${from}`,
    ...(to ? [`To: ${to}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ];
  const message = messageParts.join('\r\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function verifyCredentials() {
  const { saKeyPath } = getGmailConfig();
  const key = JSON.parse(fs.readFileSync(saKeyPath, 'utf8')); // throws if missing/unreadable
  const missing = ['client_email', 'private_key'].filter(k => !key[k]);
  if (missing.length > 0) {
    console.warn(`Service-account key file is missing required fields: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

// kind selects the sending mailbox (see MAILBOX_BY_KIND in config.js).
// Callers never pass a mailbox; omitted/unknown kinds send from services@.
async function sendEmail({ to, bcc, subject, html, kind }) {
  try {
    const mailbox = getMailboxForKind(kind);
    const auth = getAuthClient(mailbox);
    const gmail = google.gmail({ version: 'v1', auth });

    const raw = buildRawMessage({
      to,
      bcc,
      subject,
      html,
      from: `${getMailboxDisplayName(mailbox)} <${mailbox}>`,
    });

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return { success: true, messageId: res.data.id };
  } catch (error) {
    console.error('Failed to send email:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendEmail, verifyCredentials };

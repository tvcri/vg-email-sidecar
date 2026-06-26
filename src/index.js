require('dotenv/config');

const { initializePool, closePool } = require('./db');
const { pollOnce } = require('./email-processor');
const { getPollConfig } = require('./config');
const { verifyCredentials } = require('./gmail');

let pollInterval = null;

async function startSidecar() {
  try {
    console.log('Initializing database pool...');
    console.log('DB config:', {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
    });
    await initializePool();
    console.log('Database pool initialized');

    console.log('Verifying Gmail credentials...');
    const credentialsOk = verifyCredentials();
    if (credentialsOk) {
      console.log('Gmail credentials OK');
    }

    console.log('Running initial poll...');
    await pollOnce();

    const pollConfig = getPollConfig();
    console.log(`Starting poll loop every ${pollConfig.intervalMs}ms`);
    pollInterval = setInterval(async () => {
      try {
        await pollOnce();
      } catch (error) {
        console.error('Error during poll cycle:', error.message);
      }
    }, pollConfig.intervalMs);
  } catch (error) {
    console.error('Failed to start sidecar:', error.message);
    process.exit(1);
  }
}

async function shutdown() {
  console.log('Shutting down...');
  if (pollInterval) {
    clearInterval(pollInterval);
  }
  await closePool();
  console.log('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startSidecar();

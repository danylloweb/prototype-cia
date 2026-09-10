const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const config = {
  // SCA
  sca: {
    baseUrl: process.env.SCA_BASE_URL || 'https://app.sistemasca.com',
    username: process.env.SCA_USERNAME,
    password: process.env.SCA_PASSWORD,
    unitName: process.env.SCA_UNIT_NAME || '',
  },

  // Crawler
  crawler: {
    concurrency: parseInt(process.env.CONCURRENCY || '5', 10),
    requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '500', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10),
  },

  // Storage
  storage: {
    dataDir: process.env.DATA_DIR || './data',
  },

  // API
  api: {
    port: parseInt(process.env.API_PORT || '3000', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Validate required fields
if (!config.sca.username || !config.sca.password) {
  throw new Error('SCA_USERNAME and SCA_PASSWORD are required in .env file');
}

module.exports = config;

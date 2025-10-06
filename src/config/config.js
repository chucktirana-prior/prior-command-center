require('dotenv').config();

const config = {
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY
  },

  notifications: {
    email: {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL
    },
    recipients: process.env.NOTIFICATION_RECIPIENTS
      ? process.env.NOTIFICATION_RECIPIENTS.split(',').map(email => email.trim())
      : []
  },

  monitoring: {
    checkIntervalHours: parseInt(process.env.CHECK_INTERVAL_HOURS) || 24,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    timeoutMs: parseInt(process.env.TIMEOUT_MS) || 10000,
    batchSize: 10
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/place-monitor.log'
  },

  data: {
    directory: './data'
  }
};

function validateConfig() {
  const errors = [];

  if (!config.googleMaps.apiKey) {
    errors.push('GOOGLE_MAPS_API_KEY is required');
  }

  if (config.notifications.recipients.length === 0) {
    console.warn('No notification recipients configured');
  }

  if (!config.notifications.email.user && config.notifications.recipients.length > 0) {
    errors.push('EMAIL_USER is required when notification recipients are configured');
  }

  if (!config.notifications.email.pass && config.notifications.recipients.length > 0) {
    errors.push('EMAIL_PASS is required when notification recipients are configured');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }

  return true;
}

module.exports = {
  config,
  validateConfig
};
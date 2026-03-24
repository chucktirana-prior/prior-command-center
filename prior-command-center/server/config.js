import 'dotenv/config';

const config = {
  port: process.env.PORT || 3002,

  // Contentful (Document Uploader)
  contentful: {
    spaceId: process.env.CONTENTFUL_SPACE_ID,
    environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
    cmaToken: process.env.CONTENTFUL_CMA_TOKEN,
    cmaTokenRotatedAt: process.env.CONTENTFUL_CMA_TOKEN_ROTATED_AT || null,
    articleTypeId: process.env.CONTENTFUL_ARTICLE_TYPE_ID || 'article',
    personTypeId: process.env.CONTENTFUL_PERSON_TYPE_ID || 'person',
    categoryTypeId: process.env.CONTENTFUL_CATEGORY_TYPE_ID || 'category',
  },

  // Klaviyo
  klaviyo: {
    apiKey: process.env.KLAVIYO_API_KEY,
  },

  // Google Analytics
  googleAnalytics: {
    propertyId: process.env.GA_PROPERTY_ID,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },

  // Google Maps / Location Monitor
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
  },

  // Instagram
  instagram: {
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    syncDays: Number(process.env.INSTAGRAM_SYNC_DAYS || 60),
  },

  // Claude API
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  // Sync
  syncCron: process.env.SYNC_CRON || '0 6 * * *',
};

export function getMissingContentfulConfig() {
  const missing = [];
  if (!config.contentful.spaceId) missing.push('CONTENTFUL_SPACE_ID');
  if (!config.contentful.cmaToken) missing.push('CONTENTFUL_CMA_TOKEN');
  return missing;
}

export function hasContentfulConfig() {
  return getMissingContentfulConfig().length === 0;
}

export function getContentfulTokenRotationStatus() {
  const rotatedAt = config.contentful.cmaTokenRotatedAt;
  if (!rotatedAt) {
    return {
      tracked: false,
      windowDays: 90,
    };
  }

  const rotatedDate = new Date(`${rotatedAt}T00:00:00`);
  if (Number.isNaN(rotatedDate.getTime())) {
    return {
      tracked: false,
      invalidDate: true,
      windowDays: 90,
    };
  }

  const dueDate = new Date(rotatedDate);
  dueDate.setDate(dueDate.getDate() + 90);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = dueDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let status = 'healthy';
  if (daysRemaining <= 0) {
    status = 'expired';
  } else if (daysRemaining <= 7) {
    status = 'urgent';
  } else if (daysRemaining <= 30) {
    status = 'warning';
  }

  return {
    tracked: true,
    rotatedAt,
    dueAt: dueDate.toISOString().slice(0, 10),
    daysRemaining,
    windowDays: 90,
    status,
  };
}

export default config;

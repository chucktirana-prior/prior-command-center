import 'dotenv/config';

export default {
  port: process.env.PORT || 3001,

  // Contentful (Document Uploader)
  contentful: {
    spaceId: process.env.CONTENTFUL_SPACE_ID,
    environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
    cmaToken: process.env.CONTENTFUL_CMA_TOKEN,
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

  // Instagram
  instagram: {
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
  },

  // Claude API
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  // Sync
  syncCron: process.env.SYNC_CRON || '0 6 * * *',
};

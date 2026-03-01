import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { OAuth2Client } from 'google-auth-library';
import config from '../../config.js';
import { upsertGaPage, upsertGaTraffic } from '../../db/index.js';

function createClient() {
  const oauth2Client = new OAuth2Client(
    config.googleAnalytics.clientId,
    config.googleAnalytics.clientSecret
  );
  oauth2Client.setCredentials({
    refresh_token: config.googleAnalytics.refreshToken,
  });

  return new BetaAnalyticsDataClient({
    authClient: oauth2Client,
  });
}

function isConfigured() {
  const ga = config.googleAnalytics;
  return ga.propertyId && ga.clientId && ga.clientSecret && ga.refreshToken;
}

async function fetchPageMetrics(client, propertyId) {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: '90daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'pagePath' },
      { name: 'date' },
    ],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'sessions' },
      { name: 'averageSessionDuration' },
      { name: 'engagementRate' },
      { name: 'bounceRate' },
    ],
    limit: 10000,
  });

  return (response.rows || []).map(row => ({
    page_path: row.dimensionValues[0].value,
    date: formatGaDate(row.dimensionValues[1].value),
    page_views: parseInt(row.metricValues[0].value, 10) || 0,
    sessions: parseInt(row.metricValues[1].value, 10) || 0,
    avg_session_duration: parseFloat(row.metricValues[2].value) || 0,
    engagement_rate: parseFloat(row.metricValues[3].value) || 0,
    bounce_rate: parseFloat(row.metricValues[4].value) || 0,
  }));
}

async function fetchTrafficSources(client, propertyId) {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: '90daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'date' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
    ],
    limit: 10000,
  });

  return (response.rows || []).map(row => ({
    source: row.dimensionValues[0].value,
    medium: row.dimensionValues[1].value,
    date: formatGaDate(row.dimensionValues[2].value),
    sessions: parseInt(row.metricValues[0].value, 10) || 0,
    users: parseInt(row.metricValues[1].value, 10) || 0,
  }));
}

// GA4 returns dates as YYYYMMDD — convert to YYYY-MM-DD
function formatGaDate(raw) {
  if (raw.length === 8) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

export async function syncGoogleAnalytics() {
  if (!isConfigured()) {
    console.warn('Google Analytics not fully configured, skipping sync');
    return 0;
  }

  console.log('Syncing Google Analytics...');
  const client = createClient();
  const propertyId = config.googleAnalytics.propertyId;
  const now = new Date().toISOString();
  let count = 0;

  // Page metrics
  const pages = await fetchPageMetrics(client, propertyId);
  for (const page of pages) {
    upsertGaPage({ ...page, synced_at: now });
    count++;
  }
  console.log(`  GA pages: ${pages.length} rows`);

  // Traffic sources
  const traffic = await fetchTrafficSources(client, propertyId);
  for (const row of traffic) {
    upsertGaTraffic({ ...row, synced_at: now });
    count++;
  }
  console.log(`  GA traffic: ${traffic.length} rows`);

  console.log(`Google Analytics sync complete: ${count} total rows`);
  return count;
}

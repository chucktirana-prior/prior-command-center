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
      { name: 'engagedSessions' },
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'keyEvents' },
      { name: 'averageSessionDuration' },
      { name: 'userEngagementDuration' },
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
    engaged_sessions: parseInt(row.metricValues[2].value, 10) || 0,
    active_users: parseInt(row.metricValues[3].value, 10) || 0,
    new_users: parseInt(row.metricValues[4].value, 10) || 0,
    entrances: 0,
    key_events: parseFloat(row.metricValues[5].value) || 0,
    avg_session_duration: parseFloat(row.metricValues[6].value) || 0,
    user_engagement_duration: parseFloat(row.metricValues[7].value) || 0,
    engagement_rate: parseFloat(row.metricValues[8].value) || 0,
    bounce_rate: parseFloat(row.metricValues[9].value) || 0,
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
      { name: 'engagedSessions' },
      { name: 'newUsers' },
      { name: 'keyEvents' },
      { name: 'userEngagementDuration' },
    ],
    limit: 10000,
  });

  return (response.rows || []).map(row => ({
    source: row.dimensionValues[0].value,
    medium: row.dimensionValues[1].value,
    date: formatGaDate(row.dimensionValues[2].value),
    sessions: parseInt(row.metricValues[0].value, 10) || 0,
    users: parseInt(row.metricValues[1].value, 10) || 0,
    engaged_sessions: parseInt(row.metricValues[2].value, 10) || 0,
    new_users: parseInt(row.metricValues[3].value, 10) || 0,
    key_events: parseFloat(row.metricValues[4].value) || 0,
    user_engagement_duration: parseFloat(row.metricValues[5].value) || 0,
  }));
}

async function fetchLandingPageMetrics(client, propertyId) {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: '90daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'landingPagePlusQueryString' },
      { name: 'date' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'engagedSessions' },
      { name: 'keyEvents' },
    ],
    limit: 10000,
  });

  return (response.rows || []).map(row => ({
    page_path: normalizeLandingPagePath(row.dimensionValues[0].value),
    date: formatGaDate(row.dimensionValues[1].value),
    landing_page_sessions: parseInt(row.metricValues[0].value, 10) || 0,
    landing_page_engaged_sessions: parseInt(row.metricValues[1].value, 10) || 0,
    landing_page_key_events: parseFloat(row.metricValues[2].value) || 0,
  }));
}

// GA4 returns dates as YYYYMMDD — convert to YYYY-MM-DD
function formatGaDate(raw) {
  if (raw.length === 8) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

function normalizeLandingPagePath(raw) {
  if (!raw) return '/';
  return raw.split('?')[0] || '/';
}

export async function syncGoogleAnalytics(options = {}) {
  if (!isConfigured()) {
    console.warn('Google Analytics not fully configured, skipping sync');
    return { records: 0, skipped: true, reason: 'Google Analytics credentials are incomplete' };
  }

  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  console.log('Syncing Google Analytics...');
  onProgress({ step_pct: 10, detail: 'Connecting to Google Analytics' });
  const client = createClient();
  const propertyId = config.googleAnalytics.propertyId;
  const now = new Date().toISOString();
  let count = 0;

  // Page metrics
  onProgress({ step_pct: 20, detail: 'Fetching page metrics' });
  const pages = await fetchPageMetrics(client, propertyId);
  onProgress({ step_pct: 45, detail: 'Fetching landing page metrics' });
  const landingPages = await fetchLandingPageMetrics(client, propertyId);
  const landingPageMap = new Map(
    landingPages.map((row) => [`${row.page_path}::${row.date}`, row])
  );
  for (const page of pages) {
    const landingPage = landingPageMap.get(`${page.page_path}::${page.date}`);
    upsertGaPage({
      ...page,
      entrances: landingPage?.landing_page_sessions || 0,
      landing_page_sessions: landingPage?.landing_page_sessions || 0,
      synced_at: now,
    });
    count++;
  }
  console.log(`  GA pages: ${pages.length} rows`);
  console.log(`  GA landing pages: ${landingPages.length} rows`);

  // Traffic sources
  onProgress({ step_pct: 65, detail: 'Fetching traffic sources', processed: pages.length, total: pages.length });
  const traffic = await fetchTrafficSources(client, propertyId);
  for (const row of traffic) {
    upsertGaTraffic({ ...row, synced_at: now });
    count++;
  }
  console.log(`  GA traffic: ${traffic.length} rows`);

  console.log(`Google Analytics sync complete: ${count} total rows`);
  onProgress({ step_pct: 100, detail: `Synced ${count.toLocaleString()} GA rows`, processed: count, total: count });
  return count;
}

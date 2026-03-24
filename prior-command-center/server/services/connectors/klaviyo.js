import config from '../../config.js';
import { getKlaviyoCampaignById, upsertKlaviyoCampaign } from '../../db/index.js';

const BASE_URL = 'https://a.klaviyo.com/api';
const REVISION = '2024-10-15';
const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_RECENT_DAYS = 30;

function headers() {
  return {
    'Authorization': `Klaviyo-API-Key ${config.klaviyo.apiKey}`,
    'revision': REVISION,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function klaviyoFetch(url) {
  const res = await fetchWithTimeout(url, { headers: headers() });

  // Handle rate limiting
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
    console.log(`Klaviyo rate limited, waiting ${retryAfter}s...`);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return klaviyoFetch(url);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Klaviyo API ${res.status}: ${body}`);
  }

  return res.json();
}

function getCampaignTimestamp(attributes = {}) {
  return attributes.send_time || attributes.scheduled_at || attributes.updated_at || attributes.created_at || null;
}

function isOnOrAfterCutoff(timestamp, cutoffIso) {
  if (!timestamp || !cutoffIso) {
    return false;
  }

  return new Date(timestamp).getTime() >= new Date(cutoffIso).getTime();
}

function getRecentCutoffIso(daysBack) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - daysBack);
  return cutoff.toISOString();
}

async function fetchCampaigns({ fullSync = false, daysBack = DEFAULT_RECENT_DAYS } = {}) {
  const campaigns = [];
  let url = `${BASE_URL}/campaigns?filter=equals(messages.channel,"email")&sort=-scheduled_at`;
  const recentCutoffIso = fullSync ? null : getRecentCutoffIso(daysBack);
  let reachedOlderCampaigns = false;

  while (url) {
    const data = await klaviyoFetch(url);
    if (data.data) {
      for (const campaign of data.data) {
        const timestamp = getCampaignTimestamp(campaign.attributes);
        if (!recentCutoffIso || isOnOrAfterCutoff(timestamp, recentCutoffIso)) {
          campaigns.push(campaign);
          continue;
        }

        reachedOlderCampaigns = true;
      }
    }
    url = reachedOlderCampaigns ? null : (data.links?.next || null);
  }

  return campaigns;
}

export async function syncKlaviyo(options = {}) {
  if (!config.klaviyo.apiKey) {
    console.warn('Klaviyo API key not configured, skipping sync');
    return { records: 0, skipped: true, reason: 'Klaviyo API key not configured' };
  }

  const fullSync = options.fullSync === true;
  const daysBack = options.daysBack || DEFAULT_RECENT_DAYS;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

  console.log(`Syncing Klaviyo campaigns (${fullSync ? 'full sync' : `last ${daysBack} days`})...`);
  onProgress({ step_pct: 5, detail: 'Loading campaign list' });
  const campaigns = await fetchCampaigns({ fullSync, daysBack });
  const now = new Date().toISOString();
  let count = 0;

  onProgress({
    step_pct: campaigns.length ? 10 : 100,
    detail: campaigns.length ? `Checking ${campaigns.length} campaigns` : 'No campaigns to sync',
    processed: 0,
    total: campaigns.length,
  });

  for (const campaign of campaigns) {
    const attrs = campaign.attributes || {};
    const sendTime = getCampaignTimestamp(attrs);
    const existing = getKlaviyoCampaignById(campaign.id);
    onProgress({
      step_pct: campaigns.length ? Math.round(10 + ((count / campaigns.length) * 85)) : 95,
      detail: `Syncing metadata for ${attrs.name || campaign.id}`,
      processed: count,
      total: campaigns.length,
    });

    upsertKlaviyoCampaign({
      id: campaign.id,
      name: attrs.name || null,
      subject: attrs.send_options?.subject || null,
      send_time: sendTime,
      opens: null,
      open_rate: null,
      clicks: null,
      click_rate: null,
      bounces: null,
      bounce_rate: null,
      revenue: null,
      recipients: null,
      synced_at: now,
      metadata_synced_at: now,
      csv_imported_at: existing?.csv_imported_at ?? null,
      metrics_source: existing?.csv_imported_at ? 'mixed' : (existing?.metrics_source || 'api'),
      match_key: attrs.name && sendTime ? `${String(attrs.name).trim().toLowerCase().replace(/\s+/g, ' ')}::${sendTime.slice(0, 10)}` : null,
    });
    count++;
  }

  console.log(`Klaviyo metadata sync complete: ${count} campaigns`);
  onProgress({
    step_pct: 100,
    detail: `Synced metadata for ${count} campaigns`,
    processed: count,
    total: campaigns.length,
  });
  return {
    records: count,
    metricsRefreshed: 0,
    metricsSkipped: 0,
    nextRetryAt: null,
    mode: fullSync ? 'full' : 'recent',
    daysBack: fullSync ? null : daysBack,
    metadataOnly: true,
  };
}

export async function backfillKlaviyoHistoricalMetrics(options = {}) {
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  onProgress({
    step_pct: 100,
    detail: 'Disabled: use weekly CSV import for Klaviyo metrics',
    processed: 0,
    total: 0,
  });
  return {
    records: 0,
    metricsRefreshed: 0,
    metricsSkipped: 0,
    mode: 'background_backfill',
    skipped: true,
    reason: 'Disabled: use weekly CSV import for Klaviyo metrics',
  };
}

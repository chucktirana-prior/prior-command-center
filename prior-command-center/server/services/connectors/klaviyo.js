import config from '../../config.js';
import { upsertKlaviyoCampaign } from '../../db/index.js';

const BASE_URL = 'https://a.klaviyo.com/api';
const REVISION = '2024-10-15';

function headers() {
  return {
    'Authorization': `Klaviyo-API-Key ${config.klaviyo.apiKey}`,
    'revision': REVISION,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

async function klaviyoFetch(url) {
  const res = await fetch(url, { headers: headers() });

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

async function fetchCampaigns() {
  const campaigns = [];
  let url = `${BASE_URL}/campaigns?filter=equals(messages.channel,"email")&sort=-send_time&page[size]=50`;

  while (url) {
    const data = await klaviyoFetch(url);
    if (data.data) {
      campaigns.push(...data.data);
    }
    url = data.links?.next || null;
  }

  return campaigns;
}

async function fetchCampaignMetrics(campaignId) {
  try {
    const url = `${BASE_URL}/campaign-values-reports`;
    const res = await fetch(url, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        data: {
          type: 'campaign-values-report',
          attributes: {
            statistics: [
              'open_rate', 'click_rate', 'bounce_rate',
              'revenue_per_recipient', 'unique_recipients'
            ],
            timeframe: { key: 'last_365_days' },
            filter: `equals(campaign_id,"${campaignId}")`,
          },
        },
      }),
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return fetchCampaignMetrics(campaignId);
    }

    if (!res.ok) return null;

    const data = await res.json();
    const results = data.data?.attributes?.results?.[0];
    if (!results) return null;

    return {
      open_rate: results.statistics?.open_rate ?? null,
      click_rate: results.statistics?.click_rate ?? null,
      bounce_rate: results.statistics?.bounce_rate ?? null,
      revenue: results.statistics?.revenue_per_recipient ?? null,
      recipients: results.statistics?.unique_recipients ?? null,
    };
  } catch {
    return null;
  }
}

export async function syncKlaviyo() {
  if (!config.klaviyo.apiKey) {
    console.warn('Klaviyo API key not configured, skipping sync');
    return 0;
  }

  console.log('Syncing Klaviyo campaigns...');
  const campaigns = await fetchCampaigns();
  const now = new Date().toISOString();
  let count = 0;

  for (const campaign of campaigns) {
    const attrs = campaign.attributes || {};
    const metrics = await fetchCampaignMetrics(campaign.id);

    upsertKlaviyoCampaign({
      id: campaign.id,
      name: attrs.name || null,
      subject: attrs.send_options?.subject || null,
      send_time: attrs.send_time || attrs.created_at || null,
      open_rate: metrics?.open_rate ?? null,
      click_rate: metrics?.click_rate ?? null,
      bounce_rate: metrics?.bounce_rate ?? null,
      revenue: metrics?.revenue ?? null,
      recipients: metrics?.recipients ?? null,
      synced_at: now,
    });
    count++;
  }

  console.log(`Klaviyo sync complete: ${count} campaigns`);
  return count;
}

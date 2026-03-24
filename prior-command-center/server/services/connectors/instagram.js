import config from '../../config.js';
import { upsertInstagramPost, upsertInstagramProfile } from '../../db/index.js';

const GRAPH_URL = 'https://graph.facebook.com/v21.0';
const REQUEST_TIMEOUT_MS = 15000;

function isConfigured() {
  return config.instagram.accessToken && config.instagram.businessAccountId;
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

async function igFetch(url) {
  const separator = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}access_token=${config.instagram.accessToken}`;
  const res = await fetchWithTimeout(fullUrl);

  if (res.status === 429) {
    console.log('Instagram rate limited, waiting 60s...');
    await new Promise(r => setTimeout(r, 60000));
    return igFetch(url);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instagram API ${res.status}: ${body}`);
  }

  return res.json();
}

function getRecentCutoffIso(daysBack) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - daysBack);
  return cutoff.toISOString();
}

function isRecent(timestamp, cutoffIso) {
  if (!timestamp || !cutoffIso) {
    return false;
  }

  return new Date(timestamp).getTime() >= new Date(cutoffIso).getTime();
}

async function fetchMedia({ fullSync = false, daysBack = config.instagram.syncDays } = {}) {
  const posts = [];
  const accountId = config.instagram.businessAccountId;
  let url = `${GRAPH_URL}/${accountId}/media?fields=id,caption,media_type,permalink,thumbnail_url,timestamp&limit=50`;
  const cutoffIso = fullSync ? null : getRecentCutoffIso(daysBack);
  let reachedOlderPosts = false;

  while (url) {
    const data = await igFetch(url);
    if (data.data) {
      for (const post of data.data) {
        if (!cutoffIso || isRecent(post.timestamp, cutoffIso)) {
          posts.push(post);
          continue;
        }

        reachedOlderPosts = true;
      }
    }
    url = reachedOlderPosts ? null : (data.paging?.next || null);
  }

  return posts;
}

async function fetchPostInsights(mediaId) {
  try {
    const url = `${GRAPH_URL}/${mediaId}/insights?metric=likes,comments,saved,shares,reach,impressions`;
    const data = await igFetch(url);

    const metrics = {};
    for (const item of (data.data || [])) {
      metrics[item.name] = item.values?.[0]?.value ?? 0;
    }
    return metrics;
  } catch {
    // Some post types (e.g., stories) may not support all metrics
    return {};
  }
}

async function fetchProfile() {
  const accountId = config.instagram.businessAccountId;
  const url = `${GRAPH_URL}/${accountId}?fields=followers_count,follows_count,media_count`;
  return igFetch(url);
}

async function refreshTokenIfNeeded() {
  // Long-lived tokens last 60 days. This refreshes the token.
  // In production, you'd track the expiry and only refresh when needed.
  try {
    const url = `${GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.instagram.appId || ''}&client_secret=${config.instagram.appSecret || ''}&fb_exchange_token=${config.instagram.accessToken}`;

    if (!config.instagram.appId || !config.instagram.appSecret) {
      return; // Can't refresh without app credentials
    }

    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        console.log('Instagram token refreshed (update .env with new token for persistence)');
      }
    }
  } catch {
    // Token refresh is best-effort
  }
}

export async function syncInstagram(options = {}) {
  if (!isConfigured()) {
    console.warn('Instagram not fully configured, skipping sync');
    return { records: 0, skipped: true, reason: 'Instagram credentials are incomplete' };
  }

  const fullSync = options.fullSync === true;
  const daysBack = options.daysBack || config.instagram.syncDays;

  console.log(`Syncing Instagram (${fullSync ? 'full sync' : `last ${daysBack} days`})...`);
  await refreshTokenIfNeeded();

  const now = new Date().toISOString();
  const today = now.split('T')[0];
  let count = 0;

  // Fetch and upsert posts with insights
  const posts = await fetchMedia({ fullSync, daysBack });
  for (const post of posts) {
    const insights = await fetchPostInsights(post.id);

    upsertInstagramPost({
      id: post.id,
      type: (post.media_type || '').toLowerCase(),
      caption: post.caption || null,
      permalink: post.permalink || null,
      thumbnail_url: post.thumbnail_url || null,
      posted_at: post.timestamp || null,
      likes: insights.likes ?? 0,
      comments: insights.comments ?? 0,
      saves: insights.saved ?? 0,
      shares: insights.shares ?? 0,
      reach: insights.reach ?? 0,
      impressions: insights.impressions ?? 0,
      synced_at: now,
    });
    count++;
  }
  console.log(`  Instagram posts: ${posts.length}`);

  // Profile snapshot
  const profile = await fetchProfile();
  upsertInstagramProfile({
    date: today,
    followers: profile.followers_count || 0,
    follows: profile.follows_count || 0,
    media_count: profile.media_count || 0,
    synced_at: now,
  });
  count++;
  console.log('  Instagram profile snapshot saved');

  console.log(`Instagram sync complete: ${count} total records`);
  return {
    records: count,
    mode: fullSync ? 'full' : 'recent',
    daysBack: fullSync ? null : daysBack,
  };
}

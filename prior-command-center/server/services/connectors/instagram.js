import config from '../../config.js';
import { upsertInstagramPost, upsertInstagramProfile } from '../../db/index.js';

const GRAPH_URL = 'https://graph.facebook.com/v21.0';

function isConfigured() {
  return config.instagram.accessToken && config.instagram.businessAccountId;
}

async function igFetch(url) {
  const separator = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}access_token=${config.instagram.accessToken}`;
  const res = await fetch(fullUrl);

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

async function fetchMedia() {
  const posts = [];
  const accountId = config.instagram.businessAccountId;
  let url = `${GRAPH_URL}/${accountId}/media?fields=id,caption,media_type,permalink,thumbnail_url,timestamp&limit=50`;

  while (url) {
    const data = await igFetch(url);
    if (data.data) {
      posts.push(...data.data);
    }
    url = data.paging?.next || null;
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
    const url = `${GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID || ''}&client_secret=${process.env.META_APP_SECRET || ''}&fb_exchange_token=${config.instagram.accessToken}`;

    if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
      return; // Can't refresh without app credentials
    }

    const res = await fetch(url);
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

export async function syncInstagram() {
  if (!isConfigured()) {
    console.warn('Instagram not fully configured, skipping sync');
    return 0;
  }

  console.log('Syncing Instagram...');
  await refreshTokenIfNeeded();

  const now = new Date().toISOString();
  const today = now.split('T')[0];
  let count = 0;

  // Fetch and upsert posts with insights
  const posts = await fetchMedia();
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
  return count;
}

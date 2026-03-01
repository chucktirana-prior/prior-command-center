/**
 * Seed script — populates the database with realistic sample data
 * for Prior's analytics pipeline.
 *
 * Run: node server/db/seed.js
 */

import { initDb, getDb } from './index.js';

initDb();
const db = getDb();

const now = new Date().toISOString();

// --- Helper: generate dates going back N days ---
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// --- Klaviyo Campaigns ---
const campaigns = [
  { id: 'kc_001', name: 'The Lisbon Edit', subject: 'Discover Lisbon\'s Hidden Courtyards', send_time: `${daysAgo(3)}T09:00:00Z`, open_rate: 0.42, click_rate: 0.08, bounce_rate: 0.012, revenue: 2450.00, recipients: 12500 },
  { id: 'kc_002', name: 'Spring Travel Guide', subject: 'Your Spring 2026 Travel Blueprint', send_time: `${daysAgo(10)}T10:30:00Z`, open_rate: 0.38, click_rate: 0.065, bounce_rate: 0.015, revenue: 1890.00, recipients: 12200 },
  { id: 'kc_003', name: 'Weekend Reads', subject: 'Five Stories We Loved This Week', send_time: `${daysAgo(17)}T08:00:00Z`, open_rate: 0.35, click_rate: 0.055, bounce_rate: 0.018, revenue: 980.00, recipients: 11800 },
  { id: 'kc_004', name: 'Hotel Spotlight: Aman Tokyo', subject: 'Inside Aman Tokyo\'s New Wing', send_time: `${daysAgo(24)}T09:00:00Z`, open_rate: 0.45, click_rate: 0.092, bounce_rate: 0.01, revenue: 3200.00, recipients: 12000 },
  { id: 'kc_005', name: 'February Digest', subject: 'The Prior Monthly — February 2026', send_time: `${daysAgo(30)}T10:00:00Z`, open_rate: 0.31, click_rate: 0.048, bounce_rate: 0.022, revenue: 1200.00, recipients: 11500 },
  { id: 'kc_006', name: 'Wellness Retreats', subject: 'The 10 Best Wellness Retreats for 2026', send_time: `${daysAgo(38)}T09:30:00Z`, open_rate: 0.40, click_rate: 0.078, bounce_rate: 0.014, revenue: 2100.00, recipients: 11900 },
  { id: 'kc_007', name: 'Paris Guide Update', subject: 'Paris, Reimagined: A New Neighborhood Guide', send_time: `${daysAgo(45)}T08:30:00Z`, open_rate: 0.44, click_rate: 0.085, bounce_rate: 0.011, revenue: 2800.00, recipients: 11700 },
  { id: 'kc_008', name: 'Winter Escapes', subject: 'Where to Go When Winter Lingers', send_time: `${daysAgo(55)}T09:00:00Z`, open_rate: 0.36, click_rate: 0.06, bounce_rate: 0.016, revenue: 1500.00, recipients: 11400 },
];

const insertCampaign = db.prepare(`
  INSERT OR REPLACE INTO klaviyo_campaigns
    (id, name, subject, send_time, open_rate, click_rate, bounce_rate, revenue, recipients, synced_at)
  VALUES (@id, @name, @subject, @send_time, @open_rate, @click_rate, @bounce_rate, @revenue, @recipients, @synced_at)
`);

for (const c of campaigns) {
  insertCampaign.run({ ...c, synced_at: now });
}
console.log(`Seeded ${campaigns.length} Klaviyo campaigns`);

// --- Google Analytics Pages ---
const topPages = [
  '/best-hotels-lisbon',
  '/wellness-retreats-2026',
  '/paris-neighborhood-guide',
  '/aman-tokyo-review',
  '/travel-essentials-packing',
  '/where-to-eat-kyoto',
  '/sustainable-luxury-travel',
  '/weekend-in-copenhagen',
  '/',
  '/about',
];

const insertGaPage = db.prepare(`
  INSERT OR REPLACE INTO ga_pages
    (page_path, date, page_views, sessions, avg_session_duration, engagement_rate, bounce_rate, synced_at)
  VALUES (@page_path, @date, @page_views, @sessions, @avg_session_duration, @engagement_rate, @bounce_rate, @synced_at)
`);

let gaPageCount = 0;
for (let day = 0; day < 60; day++) {
  const date = daysAgo(day);
  for (const pagePath of topPages) {
    const isHome = pagePath === '/' || pagePath === '/about';
    const baseViews = isHome ? 800 : Math.floor(Math.random() * 400) + 50;
    // Add some weekly seasonality (weekends lower)
    const dayOfWeek = new Date(date).getDay();
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.6 : 1.0;
    const views = Math.floor(baseViews * weekendFactor * (0.8 + Math.random() * 0.4));

    insertGaPage.run({
      page_path: pagePath,
      date,
      page_views: views,
      sessions: Math.floor(views * 0.85),
      avg_session_duration: 45 + Math.random() * 180,
      engagement_rate: 0.55 + Math.random() * 0.3,
      bounce_rate: 0.25 + Math.random() * 0.3,
      synced_at: now,
    });
    gaPageCount++;
  }
}
console.log(`Seeded ${gaPageCount} GA page rows`);

// --- Google Analytics Traffic Sources ---
const trafficSources = [
  { source: 'google', medium: 'organic' },
  { source: 'instagram', medium: 'social' },
  { source: 'klaviyo', medium: 'email' },
  { source: 'direct', medium: '(none)' },
  { source: 'pinterest', medium: 'social' },
  { source: 'facebook', medium: 'social' },
];

const insertGaTraffic = db.prepare(`
  INSERT OR REPLACE INTO ga_traffic
    (source, medium, date, sessions, users, synced_at)
  VALUES (@source, @medium, @date, @sessions, @users, @synced_at)
`);

let gaTrafficCount = 0;
for (let day = 0; day < 60; day++) {
  const date = daysAgo(day);
  for (const { source, medium } of trafficSources) {
    const baseSessions = source === 'google' ? 500 : source === 'direct' ? 300 : source === 'instagram' ? 200 : 100;
    const sessions = Math.floor(baseSessions * (0.7 + Math.random() * 0.6));
    insertGaTraffic.run({
      source, medium, date,
      sessions,
      users: Math.floor(sessions * 0.9),
      synced_at: now,
    });
    gaTrafficCount++;
  }
}
console.log(`Seeded ${gaTrafficCount} GA traffic rows`);

// --- Instagram Posts ---
const igPosts = [
  { id: 'ig_001', type: 'carousel_album', caption: 'The light in Lisbon hits different. Our guide to the city\'s most photogenic courtyards is live now.', permalink: 'https://instagram.com/p/001', posted_at: `${daysAgo(2)}T14:00:00Z`, likes: 2840, comments: 156, saves: 890, shares: 234, reach: 28500, impressions: 42000 },
  { id: 'ig_002', type: 'video', caption: 'Morning rituals at Aman Tokyo. Full review on the site.', permalink: 'https://instagram.com/p/002', posted_at: `${daysAgo(5)}T12:00:00Z`, likes: 4200, comments: 287, saves: 1450, shares: 520, reach: 52000, impressions: 78000 },
  { id: 'ig_003', type: 'image', caption: 'Paris, always. A new neighborhood guide for the city that never stops surprising.', permalink: 'https://instagram.com/p/003', posted_at: `${daysAgo(8)}T15:30:00Z`, likes: 1950, comments: 98, saves: 420, shares: 145, reach: 18000, impressions: 25000 },
  { id: 'ig_004', type: 'video', caption: 'Pack like a Prior editor. Our travel essentials, no extras.', permalink: 'https://instagram.com/p/004', posted_at: `${daysAgo(12)}T11:00:00Z`, likes: 3600, comments: 210, saves: 1680, shares: 380, reach: 45000, impressions: 68000 },
  { id: 'ig_005', type: 'carousel_album', caption: 'Copenhagen in 48 hours. Every restaurant, every shop, every moment that matters.', permalink: 'https://instagram.com/p/005', posted_at: `${daysAgo(15)}T13:00:00Z`, likes: 2100, comments: 134, saves: 760, shares: 198, reach: 22000, impressions: 33000 },
  { id: 'ig_006', type: 'image', caption: 'Kyoto, off the beaten path. Where the locals actually eat.', permalink: 'https://instagram.com/p/006', posted_at: `${daysAgo(19)}T16:00:00Z`, likes: 1750, comments: 89, saves: 540, shares: 120, reach: 16500, impressions: 23000 },
  { id: 'ig_007', type: 'video', caption: 'The 10 wellness retreats that will define 2026. Link in bio.', permalink: 'https://instagram.com/p/007', posted_at: `${daysAgo(22)}T10:00:00Z`, likes: 5100, comments: 340, saves: 2200, shares: 680, reach: 65000, impressions: 95000 },
  { id: 'ig_008', type: 'carousel_album', caption: 'Sustainable luxury isn\'t an oxymoron. These hotels prove it.', permalink: 'https://instagram.com/p/008', posted_at: `${daysAgo(26)}T14:30:00Z`, likes: 2400, comments: 167, saves: 890, shares: 245, reach: 24000, impressions: 36000 },
  { id: 'ig_009', type: 'image', caption: 'That golden hour in Lisbon, again and again.', permalink: 'https://instagram.com/p/009', posted_at: `${daysAgo(30)}T17:00:00Z`, likes: 3100, comments: 142, saves: 620, shares: 178, reach: 30000, impressions: 44000 },
  { id: 'ig_010', type: 'video', caption: 'Winter light, warm interiors. Where to escape when the cold lingers.', permalink: 'https://instagram.com/p/010', posted_at: `${daysAgo(35)}T11:30:00Z`, likes: 2650, comments: 195, saves: 980, shares: 310, reach: 32000, impressions: 48000 },
];

const insertPost = db.prepare(`
  INSERT OR REPLACE INTO instagram_posts
    (id, type, caption, permalink, thumbnail_url, posted_at, likes, comments, saves, shares, reach, impressions, synced_at)
  VALUES (@id, @type, @caption, @permalink, @thumbnail_url, @posted_at, @likes, @comments, @saves, @shares, @reach, @impressions, @synced_at)
`);

for (const p of igPosts) {
  insertPost.run({ ...p, thumbnail_url: null, synced_at: now });
}
console.log(`Seeded ${igPosts.length} Instagram posts`);

// --- Instagram Profile Snapshots ---
const insertProfile = db.prepare(`
  INSERT OR REPLACE INTO instagram_profile
    (date, followers, follows, media_count, synced_at)
  VALUES (@date, @followers, @follows, @media_count, @synced_at)
`);

let profileCount = 0;
let followers = 48200;
for (let day = 60; day >= 0; day--) {
  const date = daysAgo(day);
  followers += Math.floor(Math.random() * 80) + 10; // Steady growth
  insertProfile.run({
    date,
    followers,
    follows: 1250,
    media_count: 420 + Math.floor((60 - day) / 3),
    synced_at: now,
  });
  profileCount++;
}
console.log(`Seeded ${profileCount} Instagram profile snapshots`);

// --- Sync Log (mark as seeded) ---
const insertSync = db.prepare(`
  INSERT INTO sync_log (source, status, records_synced, error_message, started_at, completed_at, duration_ms)
  VALUES (@source, @status, @records_synced, @error_message, @started_at, @completed_at, @duration_ms)
`);

for (const source of ['klaviyo', 'google_analytics', 'instagram']) {
  insertSync.run({
    source,
    status: 'success',
    records_synced: source === 'klaviyo' ? campaigns.length : source === 'google_analytics' ? gaPageCount + gaTrafficCount : igPosts.length + profileCount,
    error_message: null,
    started_at: now,
    completed_at: now,
    duration_ms: Math.floor(Math.random() * 3000) + 500,
  });
}
console.log('Seeded sync log entries');

// --- Insights (Intelligence Engine) ---
const insertInsightStmt = db.prepare(`
  INSERT INTO insights
    (generated_at, type, headline, highlights, concerns, recommendations, data_points, raw_response)
  VALUES (@generated_at, @type, @headline, @highlights, @concerns, @recommendations, @data_points, @raw_response)
`);

// Clear old insights first
db.prepare('DELETE FROM insights').run();

// Insight 1 — oldest (3 weeks ago)
insertInsightStmt.run({
  generated_at: new Date(Date.now() - 21 * 86400000).toISOString(),
  type: 'digest',
  headline: 'Lisbon content sparks cross-platform surge as follower growth accelerates',
  highlights: JSON.stringify([
    'The Lisbon Edit newsletter achieved the highest open rate this quarter at 42%, driven by the "Hidden Courtyards" subject line.',
    'Instagram followers grew by 1,200+ over the past three weeks — the fastest growth rate since launch.',
    'Carousel posts continue to outperform single images, averaging 38% more saves per post.',
  ]),
  concerns: JSON.stringify([
    'Pinterest referral traffic has declined 22% month-over-month, suggesting our Pin strategy needs refreshing.',
    'The /about page has a 62% bounce rate — visitors arriving from organic search may not be finding what they expect.',
  ]),
  recommendations: JSON.stringify([
    'Create a dedicated Lisbon content series — the topic clearly resonates and could sustain 3–4 more pieces.',
    'Audit the /about page copy and add clearer CTAs to convert curious visitors into newsletter subscribers.',
    'Refresh Pinterest boards with new cover images and descriptions aligned to 2026 travel trends.',
  ]),
  data_points: JSON.stringify({ period: { start: daysAgo(28), end: daysAgo(21) } }),
  raw_response: '{}',
});

// Insight 2 — mid-range (10 days ago)
insertInsightStmt.run({
  generated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  type: 'on_demand',
  headline: 'Hotel deep-dives outperform roundups by 2.4x in email click-through rate',
  highlights: JSON.stringify([
    'The Aman Tokyo Spotlight campaign achieved a 9.2% click rate — nearly double the portfolio average of 4.8%.',
    'Single-property email features generate 2.4x higher click-through rates than multi-destination roundups.',
    'Web traffic from email sources is up 18% week-over-week, with Klaviyo now the second-largest referrer after Google organic.',
    'The wellness retreats article has become our top-performing evergreen page, averaging 350+ daily views.',
  ]),
  concerns: JSON.stringify([
    'The February Digest had the lowest open rate (31%) and click rate (4.8%) of all campaigns — generic roundups may be losing traction.',
    'Average session duration on article pages has dropped from 3:20 to 2:45, possibly indicating content that doesn\'t hold attention as well.',
    'Static image posts on Instagram underperform across all engagement metrics — the content mix may need rebalancing.',
  ]),
  recommendations: JSON.stringify([
    'Replace the generic monthly digest with themed, curated editions (e.g., "The Wellness Edit" or "City Weekends") to boost open rates.',
    'Expand the Aman Tokyo formula — detailed, single-property deep dives with rich visuals consistently outperform broader roundups.',
    'Add "Read More" links and content teasers mid-article to improve session duration on longer pieces.',
    'Shift Instagram content mix to 60% video / 25% carousel / 15% static to align with engagement patterns.',
  ]),
  data_points: JSON.stringify({ period: { start: daysAgo(17), end: daysAgo(10) } }),
  raw_response: '{}',
});

// Insight 3 — most recent (today)
insertInsightStmt.run({
  generated_at: new Date().toISOString(),
  type: 'digest',
  headline: 'Video content drives 3x engagement while email open rates hold steady',
  highlights: JSON.stringify([
    'Video posts averaged 52K reach vs 18K for static images — a 2.9x multiplier that suggests the audience craves motion and storytelling.',
    'The Aman Tokyo hotel review drove the highest engagement of the month with 4,200 likes and 1,450 saves, indicating strong appetite for in-depth property coverage.',
    'Email open rates remain healthy at 38.2% average, well above the luxury media benchmark of 28%.',
    'Organic search continues to be the top traffic driver, accounting for roughly 40% of all sessions.',
  ]),
  concerns: JSON.stringify([
    'The February Digest had the lowest open rate (31%) and click rate (4.8%) of all campaigns — generic roundups may be losing traction.',
    'Weekend traffic drops by ~40%, suggesting an opportunity to better target weekend readers with tailored content.',
    'Static image posts underperform across all engagement metrics — the content mix may need rebalancing.',
  ]),
  recommendations: JSON.stringify([
    'Double down on video content, especially hotel reviews and destination walkthroughs — the data strongly supports this format.',
    'Replace the generic monthly digest with themed, curated editions (e.g., "The Wellness Edit" or "City Weekends") to boost open rates.',
    'Schedule high-engagement content (video posts, key newsletters) for Tuesday–Thursday when audience activity peaks.',
    'Expand the Aman Tokyo formula — detailed, single-property deep dives with rich visuals consistently outperform broader roundups.',
  ]),
  data_points: JSON.stringify({ period: { start: daysAgo(7), end: daysAgo(0) } }),
  raw_response: '{}',
});
console.log('Seeded 3 insights');

// --- Anomalies ---
db.prepare('DELETE FROM anomalies').run();

const insertAnomalyStmt = db.prepare(`
  INSERT INTO anomalies
    (detected_at, source, metric, current_value, baseline_value, deviation_pct, severity, message, dismissed)
  VALUES (@detected_at, @source, @metric, @current_value, @baseline_value, @deviation_pct, @severity, @message, 0)
`);

insertAnomalyStmt.run({
  detected_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  source: 'instagram',
  metric: 'saves',
  current_value: 2200,
  baseline_value: 780,
  deviation_pct: 182,
  severity: 'high',
  message: 'Wellness Retreats video post received 2,200 saves — 182% above the 28-day baseline average of 780. This is the highest-performing save count in the dataset.',
});

insertAnomalyStmt.run({
  detected_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  source: 'klaviyo',
  metric: 'open_rate',
  current_value: 0.31,
  baseline_value: 0.40,
  deviation_pct: -22.5,
  severity: 'medium',
  message: 'February Digest open rate dropped to 31%, down 22.5% from the campaign baseline of 40%. Generic roundup format may be contributing to lower engagement.',
});

insertAnomalyStmt.run({
  detected_at: new Date().toISOString(),
  source: 'google_analytics',
  metric: 'page_views',
  current_value: 1250,
  baseline_value: 850,
  deviation_pct: 47,
  severity: 'medium',
  message: 'The wellness retreats article is seeing a 47% traffic spike (1,250 daily views vs 850 baseline), likely driven by the high-performing Instagram video post linking to it.',
});

console.log('Seeded 3 anomalies');

console.log('\nDone! Demo data is ready for your review.');

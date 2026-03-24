import {
  getKlaviyoCampaigns,
  getGaPages,
  getGaTraffic,
  getInstagramPosts,
  getInstagramProfile,
} from '../../db/index.js';

function isHubPage(path) {
  return ['/', '/editorial', '/travel-design', '/city-guides', '/shopping-guides'].includes(path);
}

function summarizeKlaviyo(campaigns) {
  if (!campaigns.length) return { campaigns_count: 0, metric_campaigns_count: 0 };
  const metricCampaigns = campaigns.filter((campaign) =>
    campaign.csv_imported_at != null && (
      campaign.recipients != null || campaign.open_rate != null || campaign.click_rate != null || campaign.bounce_rate != null
    )
  );
  if (!metricCampaigns.length) {
    return {
      campaigns_count: campaigns.length,
      metric_campaigns_count: 0,
      total_recipients: 0,
      avg_open_rate: null,
      avg_click_rate: null,
      best_campaign: null,
      worst_campaign: null,
      recent_campaigns: [],
    };
  }

  const avgOpen = metricCampaigns.reduce((s, c) => s + (c.open_rate || 0), 0) / metricCampaigns.length;
  const avgClick = metricCampaigns.reduce((s, c) => s + (c.click_rate || 0), 0) / metricCampaigns.length;
  const totalRecipients = metricCampaigns.reduce((s, c) => s + (c.recipients || 0), 0);

  const sorted = [...metricCampaigns].sort((a, b) => (b.open_rate || 0) - (a.open_rate || 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const recentCampaigns = [...metricCampaigns]
    .sort((a, b) => new Date(b.send_time || 0) - new Date(a.send_time || 0))
    .slice(0, 6)
    .map((campaign) => ({
      name: campaign.name,
      subject: campaign.subject,
      send_time: campaign.send_time,
      recipients: campaign.recipients,
      open_rate: campaign.open_rate,
      click_rate: campaign.click_rate,
      bounce_rate: campaign.bounce_rate,
    }));

  return {
    campaigns_count: campaigns.length,
    metric_campaigns_count: metricCampaigns.length,
    avg_open_rate: +avgOpen.toFixed(4),
    avg_click_rate: +avgClick.toFixed(4),
    total_recipients: totalRecipients,
    best_campaign: { name: best.name, open_rate: best.open_rate, click_rate: best.click_rate },
    worst_campaign: { name: worst.name, open_rate: worst.open_rate, click_rate: worst.click_rate },
    recent_campaigns: recentCampaigns,
  };
}

function summarizeGA(pages, traffic) {
  const totalViews = pages.reduce((s, p) => s + (p.page_views || 0), 0);
  const totalSessions = pages.reduce((s, p) => s + (p.sessions || 0), 0);
  const avgEngagement = pages.length ? pages.reduce((s, p) => s + (p.engagement_rate || 0), 0) / pages.length : 0;
  const avgBounce = pages.length ? pages.reduce((s, p) => s + (p.bounce_rate || 0), 0) / pages.length : 0;

  // Top 5 pages by views
  const pageAgg = {};
  for (const p of pages) {
    pageAgg[p.page_path] = (pageAgg[p.page_path] || 0) + (p.page_views || 0);
  }
  const topPages = Object.entries(pageAgg)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([path, views]) => ({ path, views }));
  const topFeaturePage = Object.entries(pageAgg)
    .sort(([, a], [, b]) => b - a)
    .map(([path, views]) => ({ path, views }))
    .find((page) => !isHubPage(page.path)) || topPages[0] || null;

  // Traffic source breakdown
  const sourceAgg = {};
  for (const t of traffic) {
    sourceAgg[t.source] = (sourceAgg[t.source] || 0) + (t.sessions || 0);
  }
  const trafficSources = Object.entries(sourceAgg)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([source, sessions]) => ({ source, sessions }));

  return {
    total_page_views: totalViews,
    total_sessions: totalSessions,
    avg_engagement_rate: +avgEngagement.toFixed(4),
    avg_bounce_rate: +avgBounce.toFixed(4),
    top_pages: topPages,
    top_feature_page: topFeaturePage,
    traffic_sources: trafficSources,
  };
}

function summarizeInstagram(posts, profile) {
  if (!posts.length) return { posts_count: 0 };

  const totalReach = posts.reduce((s, p) => s + (p.reach || 0), 0);
  const totalEngagement = posts.reduce((s, p) =>
    s + (p.likes || 0) + (p.comments || 0) + (p.saves || 0) + (p.shares || 0), 0);
  const avgEngRate = posts.reduce((s, p) => {
    const eng = (p.likes || 0) + (p.comments || 0) + (p.saves || 0) + (p.shares || 0);
    return s + (p.reach ? eng / p.reach : 0);
  }, 0) / posts.length;

  const bestPost = [...posts].sort((a, b) => (b.reach || 0) - (a.reach || 0))[0];

  // Content type breakdown
  const typePerf = {};
  for (const p of posts) {
    const t = p.type || 'unknown';
    if (!typePerf[t]) typePerf[t] = { count: 0, totalReach: 0, totalEng: 0 };
    typePerf[t].count++;
    typePerf[t].totalReach += p.reach || 0;
    typePerf[t].totalEng += (p.likes || 0) + (p.comments || 0) + (p.saves || 0) + (p.shares || 0);
  }

  const sortedProfile = [...profile].sort((a, b) => a.date.localeCompare(b.date));
  const followerStart = sortedProfile[0]?.followers || null;
  const followerEnd = sortedProfile[sortedProfile.length - 1]?.followers || null;

  return {
    posts_count: posts.length,
    total_reach: totalReach,
    total_engagement: totalEngagement,
    avg_engagement_rate: +avgEngRate.toFixed(4),
    best_post: bestPost ? { caption: bestPost.caption?.slice(0, 80), type: bestPost.type, reach: bestPost.reach, likes: bestPost.likes, saves: bestPost.saves } : null,
    content_type_performance: typePerf,
    follower_growth: followerStart && followerEnd ? followerEnd - followerStart : null,
    current_followers: followerEnd,
  };
}

export function collectMetrics(startDate, endDate) {
  const campaigns = getKlaviyoCampaigns(startDate, endDate);
  const pages = getGaPages(startDate, endDate);
  const traffic = getGaTraffic(startDate, endDate);
  const posts = getInstagramPosts(startDate, endDate);
  const profile = getInstagramProfile(startDate, endDate);

  return {
    period: { start: startDate, end: endDate },
    klaviyo: summarizeKlaviyo(campaigns),
    googleAnalytics: summarizeGA(pages, traffic),
    instagram: summarizeInstagram(posts, profile),
  };
}

export function collectComparativeMetrics(currentDays = 7, baselineDays = 28) {
  const now = new Date();
  const currentEnd = now.toISOString().split('T')[0];
  const currentStart = new Date(now - currentDays * 86400000).toISOString().split('T')[0];
  const baselineEnd = currentStart;
  const baselineStart = new Date(now - (currentDays + baselineDays) * 86400000).toISOString().split('T')[0];

  return {
    current: collectMetrics(currentStart, currentEnd),
    baseline: collectMetrics(baselineStart, baselineEnd),
  };
}

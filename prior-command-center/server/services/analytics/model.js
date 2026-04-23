import {
  getKlaviyoCampaigns,
  getKlaviyoMetricsStatus,
  getGaPages,
  getGaTraffic,
  getInstagramPosts,
  getInstagramProfile,
} from '../../db/index.js';
import { classifyCampaign, classifyPage, normalizeSource } from './taxonomy.js';

function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getComparisonRange(startDate, endDate) {
  if (!startDate || !endDate) return null;

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;

  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const previousEnd = shiftDate(startDate, -1);
  const previousStart = shiftDate(previousEnd, -(days - 1));
  return { startDate: previousStart, endDate: previousEnd };
}

function safeDivide(numerator, denominator) {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

function sum(items, getter) {
  return items.reduce((total, item) => total + (getter(item) || 0), 0);
}

function average(items, getter) {
  if (!items.length) return null;
  return sum(items, getter) / items.length;
}

function toPctChange(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function pointChange(current, previous) {
  if (current == null || previous == null) return null;
  return current - previous;
}

function hasMeaningfulSample(value, minimum = 5) {
  return (value || 0) >= minimum;
}

function buildKlaviyoModel(campaigns) {
  const enrichedCampaigns = campaigns.map((campaign) => ({
    ...campaign,
    taxonomy: classifyCampaign(campaign.name, campaign.subject),
  }));
  const metricCampaigns = enrichedCampaigns.filter((campaign) =>
    campaign.csv_imported_at != null && (
      campaign.recipients != null ||
      campaign.open_rate != null ||
      campaign.click_rate != null ||
      campaign.bounce_rate != null
    )
  );

  const recentCampaigns = [...metricCampaigns]
    .sort((a, b) => new Date(b.send_time || 0) - new Date(a.send_time || 0))
    .slice(0, 6)
    .map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      send_time: campaign.send_time,
      recipients: campaign.recipients,
      open_rate: campaign.open_rate,
      click_rate: campaign.click_rate,
      bounce_rate: campaign.bounce_rate,
      ctor: safeDivide(campaign.click_rate, campaign.open_rate),
      taxonomy: campaign.taxonomy,
    }));

  const bestCampaign = [...metricCampaigns]
    .filter((campaign) => hasMeaningfulSample(campaign.recipients))
    .sort((a, b) => (b.open_rate || 0) - (a.open_rate || 0))[0] || null;

  const worstCampaign = [...metricCampaigns]
    .filter((campaign) => hasMeaningfulSample(campaign.recipients))
    .sort((a, b) => (a.open_rate || 0) - (b.open_rate || 0))[0] || null;

  const byCampaignType = Object.values(metricCampaigns.reduce((acc, campaign) => {
    const key = campaign.taxonomy.campaign_type;
    if (!acc[key]) {
      acc[key] = { campaign_type: key, campaigns: 0, recipients: 0, avg_open_rate: 0, avg_click_rate: 0 };
    }
    acc[key].campaigns += 1;
    acc[key].recipients += campaign.recipients || 0;
    acc[key].avg_open_rate += campaign.open_rate || 0;
    acc[key].avg_click_rate += campaign.click_rate || 0;
    return acc;
  }, {})).map((group) => ({
    ...group,
    avg_open_rate: group.campaigns ? group.avg_open_rate / group.campaigns : null,
    avg_click_rate: group.campaigns ? group.avg_click_rate / group.campaigns : null,
  })).sort((a, b) => (b.recipients || 0) - (a.recipients || 0));

  const sendDayRollup = Object.values(metricCampaigns.reduce((acc, campaign) => {
    const date = campaign.send_time ? new Date(campaign.send_time) : null;
    const key = date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
      : 'Unknown';
    if (!acc[key]) {
      acc[key] = { day: key, campaigns: 0, avg_open_rate: 0, avg_click_rate: 0 };
    }
    acc[key].campaigns += 1;
    acc[key].avg_open_rate += campaign.open_rate || 0;
    acc[key].avg_click_rate += campaign.click_rate || 0;
    return acc;
  }, {})).map((row) => ({
    ...row,
    avg_open_rate: row.campaigns ? row.avg_open_rate / row.campaigns : null,
    avg_click_rate: row.campaigns ? row.avg_click_rate / row.campaigns : null,
  }));

  return {
    campaigns_count: enrichedCampaigns.length,
    metric_campaigns_count: metricCampaigns.length,
    total_recipients: sum(metricCampaigns, (campaign) => campaign.recipients),
    avg_open_rate: average(metricCampaigns, (campaign) => campaign.open_rate),
    avg_click_rate: average(metricCampaigns, (campaign) => campaign.click_rate),
    avg_delivered_rate: average(metricCampaigns, (campaign) => campaign.delivered_rate),
    avg_unsubscribe_rate: average(metricCampaigns, (campaign) => campaign.unsubscribe_rate),
    avg_bounce_rate: average(metricCampaigns, (campaign) => campaign.bounce_rate),
    avg_ctor: average(metricCampaigns.filter((campaign) => campaign.open_rate > 0), (campaign) =>
      safeDivide(campaign.click_rate, campaign.open_rate)
    ),
    best_campaign: bestCampaign ? {
      name: bestCampaign.name,
      open_rate: bestCampaign.open_rate,
      click_rate: bestCampaign.click_rate,
      recipients: bestCampaign.recipients,
      campaign_type: bestCampaign.taxonomy.campaign_type,
    } : null,
    worst_campaign: worstCampaign ? {
      name: worstCampaign.name,
      open_rate: worstCampaign.open_rate,
      click_rate: worstCampaign.click_rate,
      recipients: worstCampaign.recipients,
      campaign_type: worstCampaign.taxonomy.campaign_type,
    } : null,
    recent_campaigns: recentCampaigns,
    campaign_type_rollup: byCampaignType,
    send_day_rollup: sendDayRollup,
    availability: {
      metrics_source: 'csv',
      has_csv_metrics: metricCampaigns.length > 0,
      missing_metrics: enrichedCampaigns.length > metricCampaigns.length,
    },
    metrics_status: getKlaviyoMetricsStatus(),
  };
}

function buildGaContentRollup(pages) {
  const pageAgg = {};
  for (const page of pages) {
    const key = page.page_path || '/';
    if (!pageAgg[key]) {
      pageAgg[key] = {
        path: key,
        views: 0,
        sessions: 0,
        engaged_sessions: 0,
        active_users: 0,
        new_users: 0,
        entrances: 0,
        landing_page_sessions: 0,
        key_events: 0,
        avg_engagement_rate_total: 0,
        avg_bounce_rate_total: 0,
        avg_session_duration_total: 0,
        user_engagement_duration_total: 0,
        rows: 0,
        taxonomy: classifyPage(key),
      };
    }
    const target = pageAgg[key];
    target.views += page.page_views || 0;
    target.sessions += page.sessions || 0;
    target.engaged_sessions += page.engaged_sessions || 0;
    target.active_users += page.active_users || 0;
    target.new_users += page.new_users || 0;
    target.entrances += page.entrances || 0;
    target.landing_page_sessions += page.landing_page_sessions || 0;
    target.key_events += page.key_events || 0;
    target.avg_engagement_rate_total += page.engagement_rate || 0;
    target.avg_bounce_rate_total += page.bounce_rate || 0;
    target.avg_session_duration_total += page.avg_session_duration || 0;
    target.user_engagement_duration_total += page.user_engagement_duration || 0;
    target.rows += 1;
  }

  return Object.values(pageAgg).map((page) => ({
    path: page.path,
    views: page.views,
    sessions: page.sessions,
    engaged_sessions: page.engaged_sessions,
    active_users: page.active_users,
    new_users: page.new_users,
    returning_users: Math.max((page.active_users || 0) - (page.new_users || 0), 0),
    entrances: page.entrances,
    landing_page_sessions: page.landing_page_sessions,
    key_events: page.key_events,
    engagement_rate: page.rows ? page.avg_engagement_rate_total / page.rows : null,
    bounce_rate: page.rows ? page.avg_bounce_rate_total / page.rows : null,
    avg_session_duration: page.rows ? page.avg_session_duration_total / page.rows : null,
    avg_engagement_time: page.rows ? safeDivide(page.user_engagement_duration_total, page.sessions) : null,
    taxonomy: page.taxonomy,
  }));
}

function buildGaSourceRollup(traffic) {
  const sourceAgg = {};
  for (const row of traffic) {
    const normalized = normalizeSource(row.source, row.medium);
    const key = `${normalized.source}::${normalized.medium}`;
    if (!sourceAgg[key]) {
      sourceAgg[key] = {
        ...normalized,
        sessions: 0,
        users: 0,
        engaged_sessions: 0,
        new_users: 0,
        key_events: 0,
        user_engagement_duration: 0,
      };
    }
    const target = sourceAgg[key];
    target.sessions += row.sessions || 0;
    target.users += row.users || 0;
    target.engaged_sessions += row.engaged_sessions || 0;
    target.new_users += row.new_users || 0;
    target.key_events += row.key_events || 0;
    target.user_engagement_duration += row.user_engagement_duration || 0;
  }

  return Object.values(sourceAgg).map((row) => ({
    ...row,
    returning_users: Math.max((row.users || 0) - (row.new_users || 0), 0),
    engagement_rate: safeDivide(row.engaged_sessions, row.sessions),
    conversion_rate: safeDivide(row.key_events, row.sessions),
    avg_engagement_time: safeDivide(row.user_engagement_duration, row.sessions),
  }));
}

function buildGoogleAnalyticsModel(pages, traffic) {
  const pagePerformance = buildGaContentRollup(pages);
  const sourcePerformance = buildGaSourceRollup(traffic);

  const topPages = [...pagePerformance]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5)
    .map((page) => ({
      path: page.path,
      views: page.views,
      sessions: page.sessions,
      landing_page_sessions: page.landing_page_sessions,
      engaged_sessions: page.engaged_sessions,
      engagement_rate: page.engagement_rate,
      key_events: page.key_events,
    }));

  const topFeaturePage = [...pagePerformance]
    .filter((page) => !['/', '/editorial', '/travel-design', '/city-guides', '/shopping-guides'].includes(page.path))
    .sort((a, b) => (b.views || 0) - (a.views || 0))[0] || topPages[0] || null;
  const topConvertingPage = [...pagePerformance]
    .filter((page) => hasMeaningfulSample(page.sessions, 20))
    .sort((a, b) => ((b.key_events || 0) - (a.key_events || 0)) || ((b.landing_page_sessions || 0) - (a.landing_page_sessions || 0)))[0] || null;

  const trafficSources = [...sourcePerformance]
    .sort((a, b) => (b.sessions || 0) - (a.sessions || 0))
    .slice(0, 5)
    .map((row) => ({ source: row.source, medium: row.medium, sessions: row.sessions, channel_group: row.channel_group }));

  const channelRollup = Object.values(sourcePerformance.reduce((acc, row) => {
    const key = row.channel_group;
    if (!acc[key]) {
      acc[key] = { channel_group: key, sessions: 0, users: 0, new_users: 0, returning_users: 0, engaged_sessions: 0, key_events: 0, user_engagement_duration: 0 };
    }
    acc[key].sessions += row.sessions || 0;
    acc[key].users += row.users || 0;
    acc[key].new_users += row.new_users || 0;
    acc[key].returning_users += row.returning_users || 0;
    acc[key].engaged_sessions += row.engaged_sessions || 0;
    acc[key].key_events += row.key_events || 0;
    acc[key].user_engagement_duration += row.user_engagement_duration || 0;
    return acc;
  }, {})).map((row) => ({
    ...row,
    engagement_rate: safeDivide(row.engaged_sessions, row.sessions),
    conversion_rate: safeDivide(row.key_events, row.sessions),
    avg_engagement_time: safeDivide(row.user_engagement_duration, row.sessions),
  })).sort((a, b) => (b.sessions || 0) - (a.sessions || 0));

  const contentRollup = Object.values(pagePerformance.reduce((acc, page) => {
    const key = page.taxonomy.content_theme;
    if (!acc[key]) {
      acc[key] = { content_theme: key, pages: 0, views: 0, sessions: 0, engaged_sessions: 0, key_events: 0 };
    }
    acc[key].pages += 1;
    acc[key].views += page.views || 0;
    acc[key].sessions += page.sessions || 0;
    acc[key].engaged_sessions += page.engaged_sessions || 0;
    acc[key].key_events += page.key_events || 0;
    return acc;
  }, {})).map((row) => ({
    ...row,
    engagement_rate: safeDivide(row.engaged_sessions, row.sessions),
    conversion_rate: safeDivide(row.key_events, row.sessions),
  })).sort((a, b) => (b.views || 0) - (a.views || 0));

  const totalSessions = sum(pagePerformance, (page) => page.sessions);
  const totalUsers = sum(sourcePerformance, (row) => row.users);
  const newUsers = sum(sourcePerformance, (row) => row.new_users);
  const returningUsers = Math.max(totalUsers - newUsers, 0);

  const topTrafficSourceByQuality = [...sourcePerformance]
    .filter((row) => hasMeaningfulSample(row.sessions, 20))
    .sort((a, b) => ((b.engagement_rate || 0) + (b.conversion_rate || 0)) - ((a.engagement_rate || 0) + (a.conversion_rate || 0)))[0] || null;
  const topConvertingSource = [...sourcePerformance]
    .filter((row) => hasMeaningfulSample(row.sessions, 20))
    .sort((a, b) => ((b.key_events || 0) - (a.key_events || 0)) || ((b.conversion_rate || 0) - (a.conversion_rate || 0)))[0] || null;

  return {
    conversion_definition: {
      metric: 'key_events',
      label: 'Key events',
      note: 'Current conversion proxy until a business-defined conversion event is configured',
    },
    total_page_views: sum(pagePerformance, (page) => page.views),
    total_sessions: totalSessions,
    engaged_sessions: sum(pagePerformance, (page) => page.engaged_sessions),
    engagement_rate: safeDivide(sum(pagePerformance, (page) => page.engaged_sessions), totalSessions),
    avg_engagement_rate: average(pagePerformance, (page) => page.engagement_rate),
    avg_bounce_rate: average(pagePerformance, (page) => page.bounce_rate),
    avg_engagement_time_per_session: safeDivide(sum(pagePerformance, (page) => (page.avg_engagement_time || 0) * (page.sessions || 0)), totalSessions),
    total_key_events: sum(pagePerformance, (page) => page.key_events),
    total_users: totalUsers,
    new_users: newUsers,
    returning_users: returningUsers,
    new_users_pct: safeDivide(newUsers, totalUsers),
    returning_users_pct: safeDivide(returningUsers, totalUsers),
    top_pages: topPages,
    top_feature_page: topFeaturePage,
    top_converting_page: topConvertingPage ? {
      path: topConvertingPage.path,
      key_events: topConvertingPage.key_events,
      landing_page_sessions: topConvertingPage.landing_page_sessions,
      conversion_rate: safeDivide(topConvertingPage.key_events, topConvertingPage.landing_page_sessions || topConvertingPage.sessions),
    } : null,
    traffic_sources: trafficSources,
    top_traffic_source_by_quality: topTrafficSourceByQuality,
    top_converting_source: topConvertingSource ? {
      source: topConvertingSource.source,
      medium: topConvertingSource.medium,
      key_events: topConvertingSource.key_events,
      sessions: topConvertingSource.sessions,
      conversion_rate: topConvertingSource.conversion_rate,
    } : null,
    source_quality: sourcePerformance,
    channel_rollup: channelRollup,
    content_rollup: contentRollup,
    page_performance: pagePerformance,
    availability: {
      has_engagement_metrics: pagePerformance.some((page) => page.engaged_sessions > 0),
      has_conversion_metrics: pagePerformance.some((page) => (page.key_events || 0) > 0),
    },
  };
}

function buildInstagramModel(posts, profile) {
  if (!posts.length) {
    return { posts_count: 0, total_reach: 0, total_engagement: 0, avg_engagement_rate: null, current_followers: null };
  }

  const totalReach = sum(posts, (post) => post.reach);
  const totalEngagement = sum(posts, (post) => (post.likes || 0) + (post.comments || 0) + (post.saves || 0) + (post.shares || 0));
  const avgEngRate = average(posts, (post) => {
    const engagement = (post.likes || 0) + (post.comments || 0) + (post.saves || 0) + (post.shares || 0);
    return safeDivide(engagement, post.reach);
  });
  const bestPost = [...posts].sort((a, b) => (b.reach || 0) - (a.reach || 0))[0];
  const sortedProfile = [...profile].sort((a, b) => a.date.localeCompare(b.date));
  const followerStart = sortedProfile[0]?.followers || null;
  const followerEnd = sortedProfile[sortedProfile.length - 1]?.followers || null;

  return {
    posts_count: posts.length,
    total_reach: totalReach,
    total_engagement: totalEngagement,
    avg_engagement_rate: avgEngRate,
    best_post: bestPost ? {
      caption: bestPost.caption?.slice(0, 80),
      type: bestPost.type,
      reach: bestPost.reach,
      likes: bestPost.likes,
      saves: bestPost.saves,
    } : null,
    follower_growth: followerStart != null && followerEnd != null ? followerEnd - followerStart : null,
    current_followers: followerEnd,
  };
}

export function buildAnalyticsSnapshot(startDate, endDate) {
  const campaigns = getKlaviyoCampaigns(startDate, endDate);
  const pages = getGaPages(startDate, endDate);
  const traffic = getGaTraffic(startDate, endDate);
  const posts = getInstagramPosts(startDate, endDate);
  const profile = getInstagramProfile(startDate, endDate);

  return {
    period: { start: startDate, end: endDate },
    raw: {
      campaigns,
      pages,
      traffic,
      posts,
      profile,
    },
    klaviyo: buildKlaviyoModel(campaigns),
    googleAnalytics: buildGoogleAnalyticsModel(pages, traffic),
    instagram: buildInstagramModel(posts, profile),
  };
}

export function buildAnalyticsComparison(startDate, endDate) {
  const current = buildAnalyticsSnapshot(startDate, endDate);
  const comparisonRange = getComparisonRange(startDate, endDate);
  const previous = comparisonRange
    ? buildAnalyticsSnapshot(comparisonRange.startDate, comparisonRange.endDate)
    : null;

  return {
    current,
    previous,
    comparison_range: comparisonRange,
  };
}

export function buildComparativeMetrics(currentDays = 7, baselineDays = 28) {
  const now = new Date();
  const currentEnd = now.toISOString().slice(0, 10);
  const currentStart = new Date(now - currentDays * 86400000).toISOString().slice(0, 10);
  const baselineEnd = shiftDate(currentStart, -1);
  const baselineStart = shiftDate(baselineEnd, -(baselineDays - 1));
  const current = buildAnalyticsSnapshot(currentStart, currentEnd);
  const baseline = buildAnalyticsSnapshot(baselineStart, baselineEnd);

  return {
    current,
    baseline,
    summary: {
      klaviyo_recipients_change_pct: toPctChange(
        current.klaviyo.total_recipients,
        baseline.klaviyo.total_recipients
      ),
      ga_sessions_change_pct: toPctChange(
        current.googleAnalytics.total_sessions,
        baseline.googleAnalytics.total_sessions
      ),
      ga_engagement_rate_change: pointChange(
        current.googleAnalytics.engagement_rate,
        baseline.googleAnalytics.engagement_rate
      ),
    },
  };
}

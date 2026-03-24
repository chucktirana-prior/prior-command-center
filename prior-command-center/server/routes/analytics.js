import express from 'express';
import {
  getKlaviyoCampaigns,
  getKlaviyoMetricsStatus,
  getGaPages,
  getGaTraffic,
  getInstagramPosts,
  getInstagramProfile,
  getAllLastSyncs,
} from '../db/index.js';

const router = express.Router();

function parseDateRange(req) {
  const { start, end } = req.query;
  return { startDate: start || null, endDate: end || null };
}

function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getComparisonRange(startDate, endDate) {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null;
  }

  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const previousEnd = shiftDate(startDate, -1);
  const previousStart = shiftDate(previousEnd, -(days - 1));

  return {
    startDate: previousStart,
    endDate: previousEnd,
  };
}

function aggregateKlaviyo(campaigns) {
  const metricCampaigns = campaigns.filter((c) =>
    c.csv_imported_at != null && (
      c.recipients != null || c.open_rate != null || c.click_rate != null || c.bounce_rate != null
    )
  );
  const avgOpenRate = metricCampaigns.length
    ? metricCampaigns.reduce((sum, c) => sum + (c.open_rate || 0), 0) / metricCampaigns.length
    : null;
  const avgClickRate = metricCampaigns.length
    ? metricCampaigns.reduce((sum, c) => sum + (c.click_rate || 0), 0) / metricCampaigns.length
    : null;
  const avgBounceRate = metricCampaigns.length
    ? metricCampaigns.reduce((sum, c) => sum + (c.bounce_rate || 0), 0) / metricCampaigns.length
    : null;

  return {
    campaigns_count: campaigns.length,
    metric_campaigns_count: metricCampaigns.length,
    total_recipients: metricCampaigns.reduce((sum, c) => sum + (c.recipients || 0), 0),
    avg_open_rate: avgOpenRate,
    avg_click_rate: avgClickRate,
    avg_bounce_rate: avgBounceRate,
    metrics_status: getKlaviyoMetricsStatus(),
  };
}

function aggregateGoogleAnalytics(pages) {
  return {
    total_page_views: pages.reduce((sum, p) => sum + (p.page_views || 0), 0),
    total_sessions: pages.reduce((sum, p) => sum + (p.sessions || 0), 0),
  };
}

function aggregateInstagram(posts, profileHistory) {
  const totalReach = posts.reduce((sum, p) => sum + (p.reach || 0), 0);
  const avgEngagement = posts.length
    ? posts.reduce((sum, p) => {
        const total = (p.likes || 0) + (p.comments || 0) + (p.saves || 0) + (p.shares || 0);
        return sum + total;
      }, 0) / posts.length
    : null;
  const latestProfile = profileHistory[0] || null;

  return {
    posts_count: posts.length,
    total_reach: totalReach,
    avg_engagement: avgEngagement,
    followers: latestProfile?.followers || null,
  };
}

// GET /api/analytics/overview — aggregated stats across all platforms
router.get('/overview', (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const comparisonRange = getComparisonRange(startDate, endDate);

    const campaigns = getKlaviyoCampaigns(startDate, endDate);
    const pages = getGaPages(startDate, endDate);
    const posts = getInstagramPosts(startDate, endDate);
    const profileHistory = getInstagramProfile(startDate, endDate);
    const syncs = getAllLastSyncs();

    const syncStatus = {};
    for (const s of syncs) {
      syncStatus[s.source] = { status: s.status, completed_at: s.completed_at };
    }

    const previousCampaigns = comparisonRange
      ? getKlaviyoCampaigns(comparisonRange.startDate, comparisonRange.endDate)
      : [];
    const previousPages = comparisonRange
      ? getGaPages(comparisonRange.startDate, comparisonRange.endDate)
      : [];
    const previousPosts = comparisonRange
      ? getInstagramPosts(comparisonRange.startDate, comparisonRange.endDate)
      : [];
    const previousProfileHistory = comparisonRange
      ? getInstagramProfile(comparisonRange.startDate, comparisonRange.endDate)
      : [];

    const currentOverview = {
      klaviyo: aggregateKlaviyo(campaigns),
      google_analytics: aggregateGoogleAnalytics(pages),
      instagram: aggregateInstagram(posts, profileHistory),
    };

    const previousOverview = comparisonRange
      ? {
          klaviyo: aggregateKlaviyo(previousCampaigns),
          google_analytics: aggregateGoogleAnalytics(previousPages),
          instagram: aggregateInstagram(previousPosts, previousProfileHistory),
        }
      : null;

    res.json({
      ok: true,
      data: {
        ...currentOverview,
        previous_period: previousOverview,
        comparison_range: comparisonRange,
        sync_status: syncStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/analytics/klaviyo — campaign data
router.get('/klaviyo', (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const campaigns = getKlaviyoCampaigns(startDate, endDate);
    res.json({
      ok: true,
      data: campaigns,
      metrics_status: getKlaviyoMetricsStatus(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/analytics/ga — page metrics + traffic sources
router.get('/ga', (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const pages = getGaPages(startDate, endDate);
    const traffic = getGaTraffic(startDate, endDate);
    res.json({ ok: true, data: { pages, traffic } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/analytics/instagram — posts + profile
router.get('/instagram', (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const posts = getInstagramPosts(startDate, endDate);
    const profile = getInstagramProfile(startDate, endDate);
    res.json({ ok: true, data: { posts, profile } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

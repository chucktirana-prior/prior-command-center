import express from 'express';
import {
  getKlaviyoCampaigns,
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

// GET /api/analytics/overview — aggregated stats across all platforms
router.get('/overview', (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);

    const campaigns = getKlaviyoCampaigns(startDate, endDate);
    const pages = getGaPages(startDate, endDate);
    const posts = getInstagramPosts(startDate, endDate);
    const profileHistory = getInstagramProfile(startDate, endDate);
    const syncs = getAllLastSyncs();

    // Aggregate Klaviyo
    const avgOpenRate = campaigns.length
      ? campaigns.reduce((sum, c) => sum + (c.open_rate || 0), 0) / campaigns.length
      : null;
    const avgClickRate = campaigns.length
      ? campaigns.reduce((sum, c) => sum + (c.click_rate || 0), 0) / campaigns.length
      : null;

    // Aggregate GA
    const totalPageViews = pages.reduce((sum, p) => sum + (p.page_views || 0), 0);
    const totalSessions = pages.reduce((sum, p) => sum + (p.sessions || 0), 0);

    // Aggregate Instagram
    const totalReach = posts.reduce((sum, p) => sum + (p.reach || 0), 0);
    const avgEngagement = posts.length
      ? posts.reduce((sum, p) => {
          const total = (p.likes || 0) + (p.comments || 0) + (p.saves || 0) + (p.shares || 0);
          return sum + total;
        }, 0) / posts.length
      : null;
    const latestProfile = profileHistory[0] || null;

    const syncStatus = {};
    for (const s of syncs) {
      syncStatus[s.source] = { status: s.status, completed_at: s.completed_at };
    }

    res.json({
      ok: true,
      data: {
        klaviyo: {
          campaigns_count: campaigns.length,
          avg_open_rate: avgOpenRate,
          avg_click_rate: avgClickRate,
        },
        google_analytics: {
          total_page_views: totalPageViews,
          total_sessions: totalSessions,
        },
        instagram: {
          posts_count: posts.length,
          total_reach: totalReach,
          avg_engagement: avgEngagement,
          followers: latestProfile?.followers || null,
        },
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
    res.json({ ok: true, data: campaigns });
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

import express from 'express';
import { getAllLastSyncs } from '../db/index.js';
import { buildAnalyticsComparison, buildAnalyticsSnapshot } from '../services/analytics/model.js';

const router = express.Router();

function parseDateRange(req) {
  const { start, end } = req.query;
  return { startDate: start || null, endDate: end || null };
}

function buildSyncStatusMap() {
  const syncs = getAllLastSyncs();
  const syncStatus = {};
  for (const sync of syncs) {
    syncStatus[sync.source] = { status: sync.status, completed_at: sync.completed_at };
  }
  return syncStatus;
}

router.get('/overview', (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const { current, previous, comparison_range } = buildAnalyticsComparison(startDate, endDate);

    res.json({
      ok: true,
      data: {
        klaviyo: current.klaviyo,
        google_analytics: current.googleAnalytics,
        instagram: current.instagram,
        channels: current.googleAnalytics.channel_rollup,
        content_rollup: current.googleAnalytics.content_rollup,
        previous_period: previous ? {
          klaviyo: previous.klaviyo,
          google_analytics: previous.googleAnalytics,
          instagram: previous.instagram,
        } : null,
        comparison_range,
        sync_status: buildSyncStatusMap(),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/klaviyo', (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const snapshot = buildAnalyticsSnapshot(startDate, endDate);
    res.json({
      ok: true,
      data: snapshot.raw.campaigns,
      summary: snapshot.klaviyo,
      metrics_status: snapshot.klaviyo.metrics_status,
      campaign_type_rollup: snapshot.klaviyo.campaign_type_rollup,
      send_day_rollup: snapshot.klaviyo.send_day_rollup,
      availability: snapshot.klaviyo.availability,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/ga', (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const snapshot = buildAnalyticsSnapshot(startDate, endDate);
    res.json({
      ok: true,
      data: {
        pages: snapshot.raw.pages,
        traffic: snapshot.raw.traffic,
        summary: snapshot.googleAnalytics,
        page_performance: snapshot.googleAnalytics.page_performance,
        source_quality: snapshot.googleAnalytics.source_quality,
        channel_rollup: snapshot.googleAnalytics.channel_rollup,
        content_rollup: snapshot.googleAnalytics.content_rollup,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/instagram', (req, res) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const snapshot = buildAnalyticsSnapshot(startDate, endDate);
    res.json({
      ok: true,
      data: {
        posts: snapshot.raw.posts,
        profile: snapshot.raw.profile,
        summary: snapshot.instagram,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

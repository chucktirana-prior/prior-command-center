import express from 'express';
import {
  getLocationArticleRollups,
  getLocationMonitorSummary,
  getRecentLocationAiReviews,
  getRecentLocationChecks,
  getRecentLocationWebsiteChecks,
  listLocationPlaces,
} from '../db/index.js';
import { importGuidePostsFromContentful, importLocationBusinessesFromContentful } from '../services/locationMonitor/contentfulImport.js';
import { checkLocationPlace, hasGoogleMapsConfig } from '../services/locationMonitor/googleMaps.js';
import { checkLocationWebsite } from '../services/locationMonitor/websiteChecks.js';
import { reviewLocationPlace } from '../services/locationMonitor/review.js';
import { cancelLocationMonitorJob, getLocationMonitorJobState, startAiReviewJob, startFullReviewJob, startMapsCheckJob, startWebsiteCheckJob } from '../services/locationMonitor/jobs.js';
import config from '../config.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    res.json({
      ok: true,
      summary: getLocationMonitorSummary(),
      places: listLocationPlaces(),
      articleRollups: getLocationArticleRollups(20),
      recentChecks: getRecentLocationChecks(25),
      recentWebsiteChecks: getRecentLocationWebsiteChecks(25),
      recentAiReviews: getRecentLocationAiReviews(25),
      activeJobs: getLocationMonitorJobState(),
      configured: {
        googleMaps: hasGoogleMapsConfig(),
        anthropic: !!config.anthropic.apiKey,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/import-contentful', async (req, res) => {
  try {
    const [articleResult, guidePostResult] = await Promise.all([
      importLocationBusinessesFromContentful(),
      importGuidePostsFromContentful(),
    ]);
    res.json({
      ok: true,
      ...articleResult,
      importedGuidePosts: guidePostResult.imported,
      skippedGuidePosts: guidePostResult.skipped,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/check-all', async (req, res) => {
  try {
    const rawLimit = Number(req.body?.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : null;
    const mode = typeof req.body?.mode === 'string' ? req.body.mode : 'all';
    const sourceType = ['article', 'guide_post'].includes(req.body?.sourceType) ? req.body.sourceType : null;
    const result = startMapsCheckJob({ limit, mode, sourceType });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/check/:id', async (req, res) => {
  try {
    const result = await checkLocationPlace(req.params.id);
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/website-check-all', async (req, res) => {
  try {
    const rawLimit = Number(req.body?.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : null;
    const mode = typeof req.body?.mode === 'string' ? req.body.mode : 'all';
    const sourceType = ['article', 'guide_post'].includes(req.body?.sourceType) ? req.body.sourceType : null;
    const placeIds = Array.isArray(req.body?.placeIds) ? req.body.placeIds : null;
    const result = startWebsiteCheckJob({ limit, mode, sourceType, ...(placeIds ? { placeIds } : {}) });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/website-check/:id', async (req, res) => {
  try {
    const result = await checkLocationWebsite(req.params.id);
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/review-all', async (req, res) => {
  try {
    const rawLimit = Number(req.body?.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : null;
    const mode = typeof req.body?.mode === 'string' ? req.body.mode : 'all';
    const sourceType = ['article', 'guide_post'].includes(req.body?.sourceType) ? req.body.sourceType : null;
    const placeIds = Array.isArray(req.body?.placeIds) ? req.body.placeIds : null;
    const result = startAiReviewJob({ limit, mode, sourceType, ...(placeIds ? { placeIds } : {}) });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/review/:id', async (req, res) => {
  try {
    const result = await reviewLocationPlace(req.params.id);
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/cancel-job/:slot', (req, res) => {
  try {
    const result = cancelLocationMonitorJob(req.params.slot);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/full-review-all', async (req, res) => {
  try {
    const mode = typeof req.body?.mode === 'string' ? req.body.mode : 'all';
    const sourceType = ['article', 'guide_post'].includes(req.body?.sourceType) ? req.body.sourceType : null;
    const placeIds = Array.isArray(req.body?.placeIds) ? req.body.placeIds : null;
    const result = startFullReviewJob({ mode, sourceType, ...(placeIds ? { placeIds } : {}) });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;

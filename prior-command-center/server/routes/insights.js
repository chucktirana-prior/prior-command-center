import express from 'express';
import { getLatestInsight, getRecentInsights, getActiveAnomalies, dismissAnomaly } from '../db/index.js';
import { generateWeeklyDigest, analyzeOnDemand, detectAndAnalyzeAnomalies } from '../services/intelligence/index.js';

const router = express.Router();

// GET /api/insights/latest — most recent insight
router.get('/latest', (req, res) => {
  try {
    const type = req.query.type || null;
    const insight = getLatestInsight(type);
    if (!insight) return res.json({ ok: true, data: null });

    res.json({
      ok: true,
      data: {
        ...insight,
        highlights: JSON.parse(insight.highlights || '[]'),
        concerns: JSON.parse(insight.concerns || '[]'),
        recommendations: JSON.parse(insight.recommendations || '[]'),
        data_points: JSON.parse(insight.data_points || '{}'),
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/insights/history — recent insights
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const insights = getRecentInsights(limit).map(i => ({
      ...i,
      highlights: JSON.parse(i.highlights || '[]'),
      concerns: JSON.parse(i.concerns || '[]'),
      recommendations: JSON.parse(i.recommendations || '[]'),
    }));
    res.json({ ok: true, data: insights });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/insights/generate — trigger on-demand analysis
router.post('/generate', async (req, res) => {
  try {
    const { start, end, question } = req.body;
    const startDate = start || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const endDate = end || new Date().toISOString().split('T')[0];

    const result = await analyzeOnDemand(startDate, endDate, question || null);
    res.json({ ok: true, data: result });
  } catch (err) {
    console.error('Insight generation error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/insights/anomalies — active anomalies
router.get('/anomalies', (req, res) => {
  try {
    res.json({ ok: true, data: getActiveAnomalies() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/insights/anomalies/detect — trigger anomaly scan
router.post('/anomalies/detect', async (req, res) => {
  try {
    const result = await detectAndAnalyzeAnomalies();
    res.json({ ok: true, data: result });
  } catch (err) {
    console.error('Anomaly detection error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/insights/anomalies/:id/dismiss
router.post('/anomalies/:id/dismiss', (req, res) => {
  try {
    dismissAnomaly(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

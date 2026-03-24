import express from 'express';
import {
  getLocationMonitorSummary,
  getRecentLocationChecks,
  listLocationPlaces,
} from '../db/index.js';
import { importLocationBusinessesFromContentful } from '../services/locationMonitor/contentfulImport.js';
import { checkAllLocationPlaces, checkLocationPlace, hasGoogleMapsConfig } from '../services/locationMonitor/googleMaps.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    res.json({
      ok: true,
      summary: getLocationMonitorSummary(),
      places: listLocationPlaces(),
      recentChecks: getRecentLocationChecks(25),
      configured: {
        googleMaps: hasGoogleMapsConfig(),
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/import-contentful', async (req, res) => {
  try {
    const result = await importLocationBusinessesFromContentful();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/check-all', async (req, res) => {
  try {
    const result = await checkAllLocationPlaces();
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

export default router;

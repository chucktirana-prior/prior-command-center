import express from 'express';
import { syncAll, syncOne } from '../services/sync.js';
import { getLastSync, getAllLastSyncs } from '../db/index.js';

const router = express.Router();

// POST /api/sync — trigger full sync of all connectors
router.post('/', async (req, res) => {
  try {
    const summary = await syncAll();
    res.json({ ok: true, summary });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/sync/:source — trigger sync for a single source
router.post('/:source', async (req, res) => {
  try {
    const result = await syncOne(req.params.source);
    res.json({ ok: true, source: req.params.source, ...result });
  } catch (err) {
    console.error(`Sync error (${req.params.source}):`, err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// GET /api/sync/status — get latest sync status for each source
router.get('/status', (req, res) => {
  try {
    const syncs = getAllLastSyncs();
    const status = {};
    for (const sync of syncs) {
      status[sync.source] = sync;
    }
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

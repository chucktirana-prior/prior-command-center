import express from 'express';
import { getActiveBackfillState, getActiveSyncState, startKlaviyoBackfill, syncAllWithOptions, syncOne } from '../services/sync.js';
import { getAllLastSyncs, getKlaviyoMetricsStatus } from '../db/index.js';

const router = express.Router();

function normalizeKlaviyoStatus(status) {
  const klaviyoStatus = status.klaviyo;
  const metricsStatus = getKlaviyoMetricsStatus();
  const lastCsvImport = metricsStatus?.last_csv_import_at || null;
  const lastMetadataSync = metricsStatus?.last_metadata_sync_at || null;

  if (!klaviyoStatus && !lastCsvImport && !lastMetadataSync) {
    return status;
  }

  const effectiveCompletedAt = lastCsvImport || lastMetadataSync || klaviyoStatus?.completed_at || null;

  if (lastCsvImport) {
    status.klaviyo = {
      ...(klaviyoStatus || {}),
      source: 'klaviyo',
      status: 'success',
      completed_at: effectiveCompletedAt,
      records_synced: metricsStatus.csv_backed_campaigns || klaviyoStatus?.records_synced || 0,
      error_message: null,
      workflow: 'csv_metrics',
    };
    return status;
  }

  if (lastMetadataSync) {
    status.klaviyo = {
      ...(klaviyoStatus || {}),
      source: 'klaviyo',
      status: 'success',
      completed_at: effectiveCompletedAt,
      records_synced: metricsStatus.total_campaigns || klaviyoStatus?.records_synced || 0,
      error_message: null,
      workflow: 'metadata_only',
    };
    return status;
  }

  return status;
}

function buildSyncOptions(req) {
  const mode = req.body?.mode || req.query.mode || 'recent';
  const fullSync = mode === 'full';

  return {
    mode,
    klaviyo: {
      fullSync,
      daysBack: fullSync ? undefined : 30,
    },
    instagram: {
      fullSync,
      daysBack: fullSync ? undefined : 60,
    },
  };
}

// POST /api/sync — trigger full sync of all connectors
router.post('/', async (req, res) => {
  try {
    const summary = await syncAllWithOptions(buildSyncOptions(req));
    res.json({ ok: true, summary });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/sync/:source — trigger sync for a single source
router.post('/:source', async (req, res) => {
  try {
    const sourceOptions = buildSyncOptions(req)[req.params.source] || {};
    const result = await syncOne(req.params.source, sourceOptions);
    res.json({ ok: true, source: req.params.source, ...result });
  } catch (err) {
    console.error(`Sync error (${req.params.source}):`, err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/sync/klaviyo/backfill — start background backfill for missing Klaviyo metrics
router.post('/klaviyo/backfill', (req, res) => {
  try {
    const result = startKlaviyoBackfill();
    res.status(result.started ? 202 : 200).json({ ok: true, ...result });
  } catch (err) {
    console.error('Klaviyo backfill error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/sync/status — get latest sync status for each source
router.get('/status', (req, res) => {
  try {
    const syncs = getAllLastSyncs();
    let status = {};
    for (const sync of syncs) {
      status[sync.source] = sync;
    }
    status = normalizeKlaviyoStatus(status);
    res.json({ ok: true, status, activeSync: getActiveSyncState(), activeBackfill: getActiveBackfillState() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

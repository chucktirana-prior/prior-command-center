import { logSync, updateBackgroundJob } from '../db/index.js';
import { syncKlaviyo } from './connectors/klaviyo.js';
import { syncGoogleAnalytics } from './connectors/googleAnalytics.js';
import { syncInstagram } from './connectors/instagram.js';

const CONNECTORS = {
  klaviyo: syncKlaviyo,
  google_analytics: syncGoogleAnalytics,
  instagram: syncInstagram,
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

let activeSyncState = null;
let activeBackfillState = null;
const KLAVIYO_BACKFILL_JOB_KEY = 'klaviyo_historical_metrics';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function cloneSyncState() {
  return activeSyncState ? JSON.parse(JSON.stringify(activeSyncState)) : null;
}

function cloneBackfillState() {
  return activeBackfillState ? JSON.parse(JSON.stringify(activeBackfillState)) : null;
}

function persistBackfillState() {
  if (!activeBackfillState?.id) {
    return;
  }

  updateBackgroundJob({
    id: activeBackfillState.id,
    status: activeBackfillState.running ? 'running' : (activeBackfillState.status || 'completed'),
    progress_pct: activeBackfillState.progress_pct || 0,
    processed: activeBackfillState.processed || 0,
    total: activeBackfillState.total || 0,
    detail: activeBackfillState.detail || null,
    metrics_refreshed: activeBackfillState.metrics_refreshed || 0,
    mode: activeBackfillState.mode || null,
    error_message: activeBackfillState.error || null,
    next_retry_at: activeBackfillState.next_retry_at || null,
    updated_at: new Date().toISOString(),
    completed_at: activeBackfillState.completed_at || null,
  });
}

function initializeActiveSyncState(options = {}) {
  const startedAt = new Date().toISOString();
  activeSyncState = {
    running: true,
    started_at: startedAt,
    mode: options.mode || 'recent',
    progress_pct: 0,
    completed_sources: 0,
    total_sources: Object.keys(CONNECTORS).length,
    sources: Object.fromEntries(
      Object.keys(CONNECTORS).map((name) => [name, { status: 'pending', records: 0, error: null }])
    ),
  };
}

function updateActiveSource(source, patch) {
  if (!activeSyncState) return;
  activeSyncState.sources[source] = {
    ...activeSyncState.sources[source],
    ...patch,
  };
  const sourceStates = Object.values(activeSyncState.sources);
  const completedWeight = sourceStates
    .filter((item) => item.status === 'success' || item.status === 'failed' || item.status === 'skipped')
    .length;
  const runningWeight = sourceStates.reduce((sum, item) => {
    if (item.status !== 'running') return sum;
    return sum + ((item.step_pct || 0) / 100);
  }, 0);
  activeSyncState.progress_pct = Math.max(
    activeSyncState.completed_sources ? Math.round((activeSyncState.completed_sources / activeSyncState.total_sources) * 100) : 0,
    Math.round(((completedWeight + runningWeight) / activeSyncState.total_sources) * 100)
  );
}

function markSourceComplete(source, result) {
  if (!activeSyncState) return;
  activeSyncState.sources[source] = {
    ...activeSyncState.sources[source],
    ...result,
  };
  activeSyncState.completed_sources = Object.values(activeSyncState.sources)
    .filter((item) => item.status === 'success' || item.status === 'failed' || item.status === 'skipped')
    .length;
  activeSyncState.progress_pct = Math.round(
    (activeSyncState.completed_sources / activeSyncState.total_sources) * 100
  );
}

async function syncSource(name, fn, options = {}) {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const progressOptions = {
    ...options,
    onProgress: (patch = {}) => updateActiveSource(name, { status: 'running', ...patch }),
  };
  updateActiveSource(name, { status: 'running', started_at: startedAt, error: null, step_pct: 0 });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fn(progressOptions);
      const duration = Date.now() - startTime;
      const normalized = typeof result === 'number' ? { records: result } : (result || {});
      const skipped = normalized.skipped === true;
      const records = normalized.records || 0;
      const errorMessage = normalized.reason || null;

      logSync({
        source: name,
        status: skipped ? 'skipped' : 'success',
        records_synced: records,
        error_message: errorMessage,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: duration,
      });

      const finalResult = { status: skipped ? 'skipped' : 'success', records, duration, error: errorMessage };
      markSourceComplete(name, finalResult);
      return finalResult;
    } catch (err) {
      console.error(`${name} sync attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);
      updateActiveSource(name, { status: 'running', attempt, error: err.message });

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`  Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        const duration = Date.now() - startTime;

        logSync({
          source: name,
          status: 'failed',
          records_synced: 0,
          error_message: err.message,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          duration_ms: duration,
        });

        const finalResult = { status: 'failed', error: err.message, duration, records: 0 };
        markSourceComplete(name, finalResult);
        return finalResult;
      }
    }
  }
}

export async function syncAll() {
  return syncAllWithOptions({});
}

export async function syncAllWithOptions(options = {}) {
  console.log('Starting sync...');
  const startTime = Date.now();
  initializeActiveSyncState(options);

  const results = await Promise.allSettled(
    Object.entries(CONNECTORS).map(([name, fn]) =>
      syncSource(name, fn, options[name] || {}).then(result => ({ name, ...result }))
    )
  );

  const summary = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { name, ...data } = result.value;
      summary[name] = data;
    } else {
      // This shouldn't happen since syncSource catches errors, but just in case
      summary['unknown'] = { status: 'error', error: result.reason?.message };
    }
  }

  const totalDuration = Date.now() - startTime;
  console.log(`Sync complete in ${totalDuration}ms`);
  if (activeSyncState) {
    activeSyncState.running = false;
    activeSyncState.progress_pct = 100;
    activeSyncState.completed_at = new Date().toISOString();
    activeSyncState.duration_ms = totalDuration;
  }

  return summary;
}

export async function syncOne(source, options = {}) {
  const fn = CONNECTORS[source];
  if (!fn) {
    throw new Error(`Unknown sync source: ${source}. Valid sources: ${Object.keys(CONNECTORS).join(', ')}`);
  }

  console.log(`Starting sync for ${source}...`);
  return syncSource(source, fn, options);
}

export function getActiveSyncState() {
  return cloneSyncState();
}

export function getActiveBackfillState() {
  if (!activeBackfillState) {
    const latestJob = getLatestBackgroundJob(KLAVIYO_BACKFILL_JOB_KEY);
    if (latestJob) {
      activeBackfillState = {
        id: latestJob.id,
        running: latestJob.status === 'running',
        source: latestJob.source,
        job: latestJob.job_key,
        started_at: latestJob.started_at,
        progress_pct: latestJob.progress_pct,
        processed: latestJob.processed,
        total: latestJob.total,
        detail: latestJob.detail,
        metrics_refreshed: latestJob.metrics_refreshed,
        mode: latestJob.mode,
        error: latestJob.error_message,
        next_retry_at: latestJob.next_retry_at,
        completed_at: latestJob.completed_at,
        status: latestJob.status,
      };
    }
  }
  return cloneBackfillState();
}

export function startKlaviyoBackfill({ resumeJobId = null } = {}) {
  const startedAt = new Date().toISOString();
  activeBackfillState = {
    id: null,
    running: false,
    source: 'klaviyo',
    job: KLAVIYO_BACKFILL_JOB_KEY,
    started_at: startedAt,
    progress_pct: 100,
    processed: 0,
    total: 0,
    detail: 'Disabled: use weekly CSV import for Klaviyo metrics',
    metrics_refreshed: 0,
    mode: 'background_backfill',
    error: null,
    next_retry_at: null,
    status: 'disabled',
    completed_at: startedAt,
  };
  return { started: false, state: cloneBackfillState() };
}

export function resumeBackgroundJobs() {
  activeBackfillState = {
    id: null,
    running: false,
    source: 'klaviyo',
    job: KLAVIYO_BACKFILL_JOB_KEY,
    started_at: null,
    progress_pct: 100,
    processed: 0,
    total: 0,
    detail: 'Disabled: use weekly CSV import for Klaviyo metrics',
    metrics_refreshed: 0,
    mode: 'background_backfill',
    error: null,
    next_retry_at: null,
    completed_at: null,
    status: 'disabled',
  };
  return { started: false, state: cloneBackfillState() };
}

import {
  getLatestBackgroundJob,
  getLocationPlaceById,
  insertBackgroundJob,
  listLocationPlaces,
  updateBackgroundJob,
} from '../../db/index.js';
import { checkAllLocationPlaces, checkLocationPlace, hasGoogleMapsConfig } from './googleMaps.js';
import { checkAllLocationWebsites, checkLocationWebsite } from './websiteChecks.js';
import { reviewAllLocationPlaces, reviewLocationPlace } from './review.js';

async function fullReviewRunner({ placeIds, initialProcessed = 0, totalOverride = null, onProgress = null, shouldStop = null } = {}) {
  const total = totalOverride ?? placeIds.length;
  let processed = initialProcessed;
  const mapsConfigured = hasGoogleMapsConfig();

  for (const id of placeIds) {
    if (shouldStop?.()) break;

    const place = getLocationPlaceById(id);
    if (!place) {
      processed++;
      continue;
    }

    onProgress?.({
      detail: `Reviewing ${place.business_name}`,
      processed,
      total,
      progress_pct: Math.round((processed / total) * 100),
    });

    // Step 1: website check
    try { await checkLocationWebsite(id); } catch { /* continue */ }

    if (shouldStop?.()) break;

    // Step 2: Maps check only if website is suspect/error and Maps is configured
    if (mapsConfigured) {
      const refreshed = getLocationPlaceById(id);
      if (['suspect', 'error'].includes(refreshed?.website_check_status)) {
        try { await checkLocationPlace(id); } catch { /* continue */ }
      }
    }

    if (shouldStop?.()) break;

    // Step 3: AI review
    try { await reviewLocationPlace(id); } catch { /* continue */ }

    processed++;
    onProgress?.({
      detail: `Reviewed ${place.business_name}`,
      processed,
      total,
      progress_pct: Math.round((processed / total) * 100),
    });
  }

  return { processed };
}

const JOB_CONFIG = {
  maps: {
    slot: 'maps',
    jobKey: 'location_monitor_maps',
    source: 'location_monitor_maps',
    runner: checkAllLocationPlaces,
    initialDetail: 'Preparing Google Maps checks',
    completedDetail: 'Google Maps checks complete',
    failedDetail: 'Google Maps checks failed',
  },
  website: {
    slot: 'website',
    jobKey: 'location_monitor_website',
    source: 'location_monitor_website',
    runner: checkAllLocationWebsites,
    initialDetail: 'Preparing website checks',
    completedDetail: 'Website checks complete',
    failedDetail: 'Website checks failed',
  },
  aiReview: {
    slot: 'aiReview',
    jobKey: 'location_monitor_ai_review',
    source: 'location_monitor_ai_review',
    runner: reviewAllLocationPlaces,
    initialDetail: 'Preparing AI review queue',
    completedDetail: 'AI review complete',
    failedDetail: 'AI review failed',
  },
  fullReview: {
    slot: 'fullReview',
    jobKey: 'location_monitor_full_review',
    source: 'location_monitor_full_review',
    runner: fullReviewRunner,
    initialDetail: 'Starting full review pipeline',
    completedDetail: 'Full review complete',
    failedDetail: 'Full review failed',
  },
};

let activeJobs = {
  maps: null,
  website: null,
  aiReview: null,
  fullReview: null,
};

// Cancellation flags — set to true to stop the next loop iteration
const cancelFlags = {
  maps: false,
  website: false,
  aiReview: false,
  fullReview: false,
};

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function parsePayload(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function serializePayload(payload) {
  return JSON.stringify(payload || {});
}

function isRiskPlace(place) {
  return (
    ['suspect', 'error'].includes(place.website_check_status)
    || ['needs_review', 'likely_changed', 'likely_closed'].includes(place.ai_review_status)
    || ['closed', 'not_found', 'error'].includes(place.check_status)
  );
}

function selectPlaceIds(type, { mode = 'all', limit = null, sourceType = null } = {}) {
  const allPlaces = listLocationPlaces();
  // Filter by source type first if specified ('article' | 'guide_post')
  const places = sourceType ? allPlaces.filter((p) => p.source_type === sourceType) : allPlaces;
  let selectedPlaces = places;

  if (type === 'maps') {
    if (mode === 'unreviewed') {
      selectedPlaces = places.filter((place) => !place.last_checked_at || place.check_status === 'pending');
    } else if (mode === 'risky') {
      selectedPlaces = places.filter(isRiskPlace);
    }
  } else if (type === 'website') {
    if (mode === 'unreviewed') {
      selectedPlaces = places.filter((place) => !place.website_checked_at || place.website_check_status === 'pending');
    } else if (mode === 'risky') {
      selectedPlaces = places.filter(isRiskPlace);
    }
  } else if (type === 'aiReview') {
    if (mode === 'unreviewed') {
      selectedPlaces = places.filter((place) => !place.ai_reviewed_at || place.ai_review_status === 'pending');
    } else if (mode === 'risky') {
      selectedPlaces = places.filter((place) => (
        ['suspect', 'error'].includes(place.website_check_status)
        || ['closed', 'not_found', 'error'].includes(place.check_status)
        || place.ai_review_status === 'needs_review'
      ));
    } else if (mode === 'website_checked') {
      selectedPlaces = places.filter((place) => !!place.website_checked_at);
    }
  } else if (type === 'fullReview') {
    if (mode === 'unconfirmed') {
      selectedPlaces = places.filter((place) =>
        place.website_check_status === 'pending'
        || place.check_status === 'pending'
        || place.ai_review_status === 'pending'
      );
    }
  }

  if (typeof limit === 'number' && limit > 0) {
    selectedPlaces = selectedPlaces.slice(0, limit);
  }

  return selectedPlaces.map((place) => place.id);
}

function persistJob(job) {
  if (!job?.id) return;

  updateBackgroundJob({
    id: job.id,
    status: job.status,
    progress_pct: job.progress_pct || 0,
    processed: job.processed || 0,
    total: job.total || 0,
    detail: job.detail || null,
    metrics_refreshed: 0,
    mode: job.mode || null,
    payload: serializePayload(job.payload),
    error_message: job.error || null,
    next_retry_at: null,
    updated_at: new Date().toISOString(),
    completed_at: job.completed_at || null,
  });
}

function hydrateJob(type, row) {
  if (!row) return null;

  const config = JOB_CONFIG[type];
  return {
    id: row.id,
    type,
    slot: config.slot,
    job_key: row.job_key,
    source: row.source,
    running: row.status === 'running',
    status: row.status,
    mode: row.mode || 'all',
    limit: parsePayload(row.payload).limit ?? null,
    processed: row.processed || 0,
    total: row.total || 0,
    progress_pct: row.progress_pct || 0,
    detail: row.detail || config.initialDetail,
    started_at: row.started_at,
    completed_at: row.completed_at || null,
    error: row.error_message || null,
    result: parsePayload(row.payload).result || null,
    payload: parsePayload(row.payload),
  };
}

function createPersistedJob(type, options = {}) {
  const config = JOB_CONFIG[type];
  const startedAt = new Date().toISOString();
  const placeIds = options.placeIds || selectPlaceIds(type, options);
  const payload = {
    placeIds,
    limit: options.limit ?? null,
    sourceType: options.sourceType ?? null,
    result: null,
  };

  // Build a readable mode label (e.g. "all · editorial")
  let modeLabel = options.mode || 'all';
  if (options.sourceType === 'article') modeLabel += ' · editorial';
  else if (options.sourceType === 'guide_post') modeLabel += ' · guides';

  const insertResult = insertBackgroundJob({
    job_key: config.jobKey,
    source: config.source,
    status: 'running',
    progress_pct: 0,
    processed: 0,
    total: placeIds.length,
    detail: config.initialDetail,
    metrics_refreshed: 0,
    mode: modeLabel,
    payload: serializePayload(payload),
    error_message: null,
    next_retry_at: null,
    started_at: startedAt,
    updated_at: startedAt,
    completed_at: null,
  });

  return {
    id: insertResult.lastInsertRowid,
    type,
    slot: config.slot,
    job_key: config.jobKey,
    source: config.source,
    running: true,
    status: 'running',
    mode: modeLabel,
    limit: options.limit ?? null,
    processed: 0,
    total: placeIds.length,
    progress_pct: 0,
    detail: config.initialDetail,
    started_at: startedAt,
    completed_at: null,
    error: null,
    result: null,
    payload,
  };
}

function finalizeJob(job, patch) {
  Object.assign(job, {
    running: false,
    completed_at: new Date().toISOString(),
    ...patch,
  });
  persistJob(job);
}

function runJob(job, { resume = false } = {}) {
  const config = JOB_CONFIG[job.type];
  const remainingIds = (job.payload?.placeIds || []).slice(job.processed || 0);

  // Reset the cancel flag when a fresh job starts
  cancelFlags[config.slot] = false;

  config.runner({
    mode: job.mode,
    limit: job.limit,
    placeIds: remainingIds,
    initialProcessed: job.processed || 0,
    totalOverride: job.total || (job.payload?.placeIds || []).length,
    shouldStop: () => cancelFlags[config.slot] === true,
    onProgress: (patch = {}) => {
      Object.assign(job, patch, { running: true, status: 'running', error: null });
      persistJob(job);
    },
  })
    .then((result) => {
      job.payload = {
        ...(job.payload || {}),
        result,
      };
      const wasCancelled = cancelFlags[config.slot];
      finalizeJob(job, {
        status: wasCancelled ? 'cancelled' : 'completed',
        progress_pct: wasCancelled ? job.progress_pct : 100,
        detail: wasCancelled ? `Cancelled after ${job.processed} of ${job.total}` : config.completedDetail,
        result,
      });
    })
    .catch((error) => {
      finalizeJob(job, {
        status: 'failed',
        error: error.message,
        detail: config.failedDetail,
      });
    });

  if (resume) {
    persistJob(job);
  }
}

function startJob(type, options = {}) {
  const config = JOB_CONFIG[type];
  const activeJob = activeJobs[config.slot];

  if (activeJob?.running) {
    return { started: false, job: clone(activeJob) };
  }

  const job = createPersistedJob(type, options);
  activeJobs[config.slot] = job;
  runJob(job);
  return { started: true, job: clone(job) };
}

export function getLocationMonitorJobState() {
  return {
    maps: clone(activeJobs.maps),
    website: clone(activeJobs.website),
    aiReview: clone(activeJobs.aiReview),
    fullReview: clone(activeJobs.fullReview),
  };
}

export function cancelLocationMonitorJob(slot) {
  const validSlots = ['maps', 'website', 'aiReview', 'fullReview'];
  if (!validSlots.includes(slot)) {
    return { cancelled: false, reason: 'Unknown job slot' };
  }
  // Set the flag unconditionally — runJob resets it at the start of each new job,
  // so setting it here is always safe and avoids a stale-running-flag race.
  cancelFlags[slot] = true;
  const job = activeJobs[slot];
  if (job) {
    Object.assign(job, { detail: 'Cancelling — finishing current item…' });
    persistJob(job);
  }
  return { cancelled: true, slot };
}

export function startMapsCheckJob(options = {}) {
  return startJob('maps', options);
}

export function startWebsiteCheckJob(options = {}) {
  return startJob('website', options);
}

export function startAiReviewJob(options = {}) {
  return startJob('aiReview', options);
}

export function startFullReviewJob(options = {}) {
  return startJob('fullReview', options);
}

export function resumeLocationMonitorJobs() {
  for (const type of Object.keys(JOB_CONFIG)) {
    const config = JOB_CONFIG[type];
    const latestJob = getLatestBackgroundJob(config.jobKey);
    const hydrated = hydrateJob(type, latestJob);
    activeJobs[config.slot] = hydrated;

    if (hydrated?.status === 'running') {
      hydrated.running = true;
      hydrated.detail = hydrated.detail || config.initialDetail;
      runJob(hydrated, { resume: true });
    }
  }

  return getLocationMonitorJobState();
}

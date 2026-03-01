import { logSync } from '../db/index.js';
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

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function syncSource(name, fn) {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const records = await fn();
      const duration = Date.now() - startTime;

      logSync({
        source: name,
        status: 'success',
        records_synced: records,
        error_message: null,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: duration,
      });

      return { status: 'success', records, duration };
    } catch (err) {
      console.error(`${name} sync attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);

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

        return { status: 'failed', error: err.message, duration };
      }
    }
  }
}

export async function syncAll() {
  console.log('Starting full sync...');
  const startTime = Date.now();

  const results = await Promise.allSettled(
    Object.entries(CONNECTORS).map(([name, fn]) =>
      syncSource(name, fn).then(result => ({ name, ...result }))
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
  console.log(`Full sync complete in ${totalDuration}ms`);

  return summary;
}

export async function syncOne(source) {
  const fn = CONNECTORS[source];
  if (!fn) {
    throw new Error(`Unknown sync source: ${source}. Valid sources: ${Object.keys(CONNECTORS).join(', ')}`);
  }

  console.log(`Starting sync for ${source}...`);
  return syncSource(source, fn);
}

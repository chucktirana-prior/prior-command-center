import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import config, { hasContentfulConfig, getContentfulTokenRotationStatus } from './config.js';
import { initDb, getAllLastSyncs } from './db/index.js';
import { resumeBackgroundJobs, syncAll } from './services/sync.js';
import { generateWeeklyDigest, detectAndAnalyzeAnomalies } from './services/intelligence/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = config.port;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// --- Initialize Database ---
initDb();
resumeBackgroundJobs();

// --- API Routes ---

// Uploader routes (migrated from article-uploader)
import parseRoutes from './routes/uploader/parse.js';
import contentfulRoutes from './routes/uploader/contentful.js';
import uploadImagesRoutes from './routes/uploader/uploadImages.js';

app.use('/api/parse', parseRoutes);
app.use('/api/contentful/upload-images', uploadImagesRoutes);
app.use('/api/contentful', contentfulRoutes);
app.use('/api/upload-images', uploadImagesRoutes);

// Sync & Analytics routes (Phase 1)
import syncRoutes from './routes/sync.js';
import analyticsRoutes from './routes/analytics.js';

// Intelligence Engine routes (Phase 3)
import insightsRoutes from './routes/insights.js';

// Report Generator routes (Phase 4)
import reportRoutes from './routes/reports.js';

// AI Assistant routes (Phase 5)
import assistantRoutes from './routes/assistant.js';
import locationMonitorRoutes from './routes/locationMonitor.js';
import klaviyoImportRoutes from './routes/klaviyoImport.js';

app.use('/api/sync', syncRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/location-monitor', locationMonitorRoutes);
app.use('/api/klaviyo-import', klaviyoImportRoutes);

// Health check with DB and sync status
app.get('/api/health', (req, res) => {
  try {
    const syncs = getAllLastSyncs();
    const syncStatus = {};
    for (const s of syncs) {
      syncStatus[s.source] = { status: s.status, completed_at: s.completed_at };
    }
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      contentful: {
        configured: hasContentfulConfig(),
        tokenRotation: getContentfulTokenRotationStatus(),
      },
      last_syncs: syncStatus,
    });
  } catch (err) {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'error',
      db_error: err.message,
      contentful: {
        configured: hasContentfulConfig(),
        tokenRotation: getContentfulTokenRotationStatus(),
      },
    });
  }
});

// --- Scheduled Sync ---
if (cron.validate(config.syncCron)) {
  cron.schedule(config.syncCron, async () => {
    console.log(`[cron] Running scheduled sync at ${new Date().toISOString()}`);
    try {
      const summary = await syncAll();
      console.log('[cron] Sync complete:', JSON.stringify(summary));

      // Run anomaly detection after each sync
      if (config.anthropic.apiKey) {
        try {
          const { anomalies } = await detectAndAnalyzeAnomalies();
          if (anomalies.length) console.log(`[cron] ${anomalies.length} anomalies detected and analyzed`);
        } catch (err) {
          console.error('[cron] Anomaly detection failed:', err.message);
        }
      }
    } catch (err) {
      console.error('[cron] Sync failed:', err.message);
    }
  });
  console.log(`Sync scheduled: ${config.syncCron}`);
} else {
  console.warn(`Invalid cron expression: ${config.syncCron}, skipping scheduled sync`);
}

// Weekly digest: Mondays at 7am
cron.schedule('0 7 * * 1', async () => {
  if (!config.anthropic.apiKey) return;
  console.log(`[cron] Generating weekly digest at ${new Date().toISOString()}`);
  try {
    const digest = await generateWeeklyDigest();
    console.log('[cron] Weekly digest generated:', digest.headline);
  } catch (err) {
    console.error('[cron] Weekly digest failed:', err.message);
  }
});
console.log('Weekly digest scheduled: Mondays at 7:00 AM');

// --- Startup Checks ---
function checkEnvKeys() {
  const checks = [
    { name: 'Contentful (Uploader)', configured: hasContentfulConfig() },
    { name: 'Klaviyo', configured: !!config.klaviyo.apiKey },
    { name: 'Google Analytics', configured: !!(config.googleAnalytics.propertyId && config.googleAnalytics.clientId && config.googleAnalytics.clientSecret && config.googleAnalytics.refreshToken) },
    { name: 'Instagram', configured: !!(config.instagram.accessToken && config.instagram.businessAccountId) },
    { name: 'Meta App Credentials (optional token refresh)', configured: !!(config.instagram.appId && config.instagram.appSecret) },
    { name: 'Anthropic (Intelligence)', configured: !!config.anthropic.apiKey },
    { name: 'Google Maps (Location Monitor)', configured: !!config.googleMaps.apiKey },
  ];
  for (const check of checks) {
    if (check.configured) {
      console.log(`  ${check.name}: configured`);
    } else {
      console.warn(`  ${check.name}: not configured (sync will be skipped)`);
    }
  }
}

// --- Serve React app in production ---
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Prior Command Center server running on http://localhost:${PORT}`);
  console.log('API connectors:');
  checkEnvKeys();
});

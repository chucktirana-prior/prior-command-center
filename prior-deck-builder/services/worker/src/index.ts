import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectToDatabase, processNextDeckJob, type CoreConfig } from '@prior/deck-builder-core';

const currentFilePath = fileURLToPath(import.meta.url);
const defaultStorageDir = path.resolve(path.dirname(currentFilePath), '../../../storage');

function getConfig(): CoreConfig & { pollIntervalMs: number } {
  return {
    mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/prior-deck-builder',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
    downloadSigningSecret: process.env.DOWNLOAD_SIGNING_SECRET || 'local-dev-secret',
    appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3001',
    storageMode: process.env.STORAGE_MODE === 's3' ? 's3' : 'local',
    localStorageDir: process.env.LOCAL_STORAGE_DIR || defaultStorageDir,
    templateVersion: process.env.TEMPLATE_VERSION || 'prior-2026-v1',
    modelVersion: process.env.MODEL_VERSION || (process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest'),
    pptxTemplatePath: process.env.PPTX_TEMPLATE_PATH,
    s3: process.env.DO_SPACES_BUCKET && process.env.DO_SPACES_REGION && process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET
      ? {
          bucket: process.env.DO_SPACES_BUCKET,
          region: process.env.DO_SPACES_REGION,
          endpoint: process.env.DO_SPACES_ENDPOINT,
          accessKeyId: process.env.DO_SPACES_KEY,
          secretAccessKey: process.env.DO_SPACES_SECRET,
        }
      : undefined,
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS || 3000),
  };
}

const config = getConfig();
const workerId = process.env.WORKER_ID || `worker-${randomUUID()}`;

async function main() {
  await connectToDatabase(config.mongodbUri);
  console.log(`Deck Builder worker ${workerId} connected to MongoDB; polling every ${config.pollIntervalMs}ms`);

  while (true) {
    const processed = await processNextDeckJob(config, { workerId, lockMs: 60_000 });
    if (processed) {
      console.log(`Processed deck ${processed._id.toString()} with status ${processed.status}`);
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

main().catch((error) => {
  console.error('Worker failed', error);
  process.exitCode = 1;
});

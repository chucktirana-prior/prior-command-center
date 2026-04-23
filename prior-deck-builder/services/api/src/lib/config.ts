import 'dotenv/config';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import type { CoreConfig } from '@prior/deck-builder-core';

const rootDir = path.resolve(process.cwd(), '..', '..');
const defaultStorageDir = path.join(rootDir, 'storage');

export function getConfig(): CoreConfig & { port: number } {
  const storageDir = process.env.LOCAL_STORAGE_DIR || defaultStorageDir;
  mkdirSync(storageDir, { recursive: true });

  return {
    port: Number(process.env.PORT || 3001),
    mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/prior-deck-builder',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
    downloadSigningSecret: process.env.DOWNLOAD_SIGNING_SECRET || 'local-dev-secret',
    appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3001}`,
    storageMode: process.env.STORAGE_MODE === 's3' ? 's3' : 'local',
    localStorageDir: storageDir,
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
  };
}

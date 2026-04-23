import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { access } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { connectToDatabase } from '@prior/deck-builder-core';
import { getAuthSummary, requireUser } from './lib/auth.js';
import { getConfig } from './lib/config.js';
import { createDeckRoutes } from './routes/decks.js';

const config = getConfig();
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  const storageStatus = config.storageMode === 'local'
    ? await access(config.localStorageDir).then(() => 'ok').catch(() => 'missing')
    : config.s3 ? 'configured' : 'missing_config';
  res.json({
    status: 'ok',
    service: 'deck-builder-api',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    storage: {
      mode: config.storageMode,
      status: storageStatus,
    },
    auth: getAuthSummary(),
    prompts: {
      templateVersion: config.templateVersion,
      modelVersion: config.modelVersion,
    },
  });
});

app.use(requireUser);

app.get('/api/downloads/*', async (req, res) => {
  const relativeKey = req.path.replace('/api/downloads/', '');
  if (!relativeKey) {
    res.status(400).json({ error: 'Missing file key' });
    return;
  }

  const absolutePath = path.resolve(config.localStorageDir, relativeKey);
  if (!absolutePath.startsWith(path.resolve(config.localStorageDir))) {
    res.status(400).json({ error: 'Invalid file key' });
    return;
  }
  try {
    await access(absolutePath);
    res.download(absolutePath);
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

app.use('/api/decks', createDeckRoutes(config));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', issues: error.issues });
    return;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ error: message });
});

connectToDatabase(config.mongodbUri)
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Deck Builder API running on http://localhost:${config.port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect API to MongoDB', error);
    process.exitCode = 1;
  });

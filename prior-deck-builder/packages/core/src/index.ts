// @ts-nocheck
import Anthropic from '@anthropic-ai/sdk';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PptxGenJS from 'pptxgenjs';
import {
  type CreateDeckInput,
  DECK_STATUSES,
  type DeckSlide,
  type DeckStatus,
  type JobKind,
  layoutRegistry,
  type LastCompletedStep,
  outlineSlideSchema,
  slideSchema,
} from '@prior/deck-builder-shared';

export type CoreConfig = {
  mongodbUri: string;
  anthropicApiKey?: string;
  anthropicModel: string;
  downloadSigningSecret: string;
  appBaseUrl: string;
  storageMode: 'local' | 's3';
  localStorageDir: string;
  s3?: {
    bucket: string;
    region: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  templateVersion: string;
  modelVersion: string;
  pptxTemplatePath?: string;
};

const currentJobSchema = new Schema({
  kind: { type: String, enum: ['outline_generation', 'copy_generation', 'pptx_build'] },
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed'] },
  requestedAt: String,
  startedAt: String,
  completedAt: String,
  lockedBy: String,
  lockExpiresAt: String,
}, { _id: false });

const deckSchema = new Schema({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  deckType: { type: String, enum: ['client', 'internal'], required: true },
  audience: { type: String, required: true },
  keyMessages: [{ type: String, required: true }],
  slideCount: { type: Number, required: true },
  additionalContext: { type: String, default: '' },
  outline: [{
    slideNumber: Number,
    layoutId: String,
    title: String,
  }],
  slides: [{
    slideNumber: Number,
    layoutId: String,
    headline: String,
    subhead: String,
    body: String,
    speakerNotes: String,
    designNote: String,
  }],
  status: { type: String, enum: DECK_STATUSES, default: 'draft', index: true },
  templateVersion: { type: String, required: true },
  modelVersion: { type: String, required: true },
  outlineVersion: { type: Number, default: 0 },
  slidesVersion: { type: Number, default: 0 },
  currentJob: currentJobSchema,
  lastCompletedStep: { type: String, enum: ['brief', 'outline', 'copy', 'build'], default: 'brief' },
  retryCount: { type: Number, default: 0 },
  failureCode: String,
  failureDetails: String,
  fileKey: String,
  completedAt: String,
  promptVersion: { type: String, default: 'deck-builder-v1' },
}, {
  timestamps: true,
  collection: 'decks',
});

deckSchema.index({ userId: 1, updatedAt: -1 });
deckSchema.index({ status: 1, updatedAt: 1 });
deckSchema.index({ 'currentJob.status': 1, updatedAt: 1 });

export type DeckDocument = InferSchemaType<typeof deckSchema> & { _id: mongoose.Types.ObjectId };
const DeckModel = (mongoose.models.Deck as Model<DeckDocument>) || mongoose.model<DeckDocument>('Deck', deckSchema);

export async function connectToDatabase(mongodbUri: string) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  await mongoose.connect(mongodbUri);
  return mongoose.connection;
}

export function getDeckModel() {
  return DeckModel;
}

export async function createDeck(config: CoreConfig, userId: string, input: CreateDeckInput) {
  return DeckModel.create({
    userId,
    ...input,
    outline: [],
    slides: [],
    status: 'draft',
    templateVersion: config.templateVersion,
    modelVersion: config.modelVersion,
    lastCompletedStep: 'brief',
  });
}

export async function listDecks(userId: string) {
  return DeckModel.find({ userId }).sort({ updatedAt: -1 }).lean();
}

export async function getDeckForUser(deckId: string, userId: string) {
  return DeckModel.findOne({ _id: deckId, userId });
}

export async function queueDeckJob(deckId: string, userId: string, kind: JobKind) {
  const now = new Date().toISOString();
  const statusByKind: Record<JobKind, DeckStatus> = {
    outline_generation: 'outline_queued',
    copy_generation: 'copy_queued',
    pptx_build: 'build_queued',
  };

  const deck = await DeckModel.findOne({ _id: deckId, userId });
  if (!deck) {
    return null;
  }

  const alreadyActive = deck.currentJob?.kind === kind && ['queued', 'running'].includes(deck.currentJob.status);
  if (alreadyActive) {
    return deck;
  }

  deck.status = statusByKind[kind];
  deck.currentJob = {
    kind,
    status: 'queued',
    requestedAt: now,
  };
  deck.failureCode = undefined;
  deck.failureDetails = undefined;
  await deck.save();
  return deck;
}

export async function saveOutline(deckId: string, userId: string, outlineVersion: number, outline: unknown) {
  const parsed = outlineSlideSchema.array().parse(outline);
  const deck = await DeckModel.findOne({ _id: deckId, userId });
  if (!deck) return { kind: 'not_found' as const };
  if (deck.outlineVersion !== outlineVersion) return { kind: 'conflict' as const, currentVersion: deck.outlineVersion };

  deck.outline = parsed;
  deck.outlineVersion += 1;
  deck.status = 'outline_ready';
  deck.lastCompletedStep = 'outline';
  deck.failureCode = undefined;
  deck.failureDetails = undefined;
  await deck.save();
  return { kind: 'ok' as const, deck };
}

export async function saveSlides(deckId: string, userId: string, slidesVersion: number, slides: unknown) {
  const parsed = slideSchema.array().parse(slides);
  const deck = await DeckModel.findOne({ _id: deckId, userId });
  if (!deck) return { kind: 'not_found' as const };
  if (deck.slidesVersion !== slidesVersion) return { kind: 'conflict' as const, currentVersion: deck.slidesVersion };

  deck.slides = parsed;
  deck.slidesVersion += 1;
  deck.status = 'copy_ready';
  deck.lastCompletedStep = 'copy';
  deck.failureCode = undefined;
  deck.failureDetails = undefined;
  await deck.save();
  return { kind: 'ok' as const, deck };
}

type PromptTemplate = {
  version: string;
  outlineSystem: string;
  copySystem: string;
};

const currentFilePath = fileURLToPath(import.meta.url);
const promptsDir = path.resolve(path.dirname(currentFilePath), '..', 'prompts');

function loadPrompts(): PromptTemplate {
  const allowedLayouts = layoutRegistry.map((layout) => layout.layoutId).join(', ');
  const outlineTemplate = readFileSync(path.join(promptsDir, 'outline-system.txt'), 'utf8');
  const copyTemplate = readFileSync(path.join(promptsDir, 'copy-system.txt'), 'utf8');
  return {
    version: 'deck-builder-v1',
    outlineSystem: outlineTemplate.replace('{{ALLOWED_LAYOUTS}}', allowedLayouts),
    copySystem: copyTemplate.replace('{{ALLOWED_LAYOUTS}}', allowedLayouts),
  };
}

const PROMPTS: PromptTemplate = loadPrompts();

export async function generateOutline(config: CoreConfig, deck: DeckDocument) {
  const fallback = buildFallbackOutline(deck);
  if (!config.anthropicApiKey) {
    return fallback;
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const promptPayload = {
    title: deck.title,
    deckType: deck.deckType,
    audience: deck.audience,
    keyMessages: deck.keyMessages,
    slideCount: deck.slideCount,
    additionalContext: deck.additionalContext,
  };

  const result = await requestJsonWithRepair(client, config.anthropicModel, PROMPTS.outlineSystem, JSON.stringify(promptPayload, null, 2));
  return outlineSlideSchema.array().parse(result);
}

export async function generateSlides(config: CoreConfig, deck: DeckDocument) {
  const fallback = buildFallbackSlides(deck);
  if (!config.anthropicApiKey) {
    return fallback;
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const promptPayload = {
    title: deck.title,
    deckType: deck.deckType,
    audience: deck.audience,
    keyMessages: deck.keyMessages,
    outline: deck.outline,
  };

  const result = await requestJsonWithRepair(client, config.anthropicModel, PROMPTS.copySystem, JSON.stringify(promptPayload, null, 2));
  return slideSchema.array().parse(result);
}

async function requestJsonWithRepair(client: Anthropic, model: string, system: string, prompt: string) {
  const firstResponse = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  const firstText = extractText(firstResponse);
  try {
    return JSON.parse(firstText);
  } catch {
    const repairResponse = await client.messages.create({
      model,
      max_tokens: 4096,
      system: 'Return valid JSON only. Do not include markdown fences or commentary.',
      messages: [{
        role: 'user',
        content: `Repair this into valid JSON without changing intent:\n${firstText}`,
      }],
    });
    return JSON.parse(extractText(repairResponse));
  }
}

function extractText(response: Anthropic.Messages.Message) {
  return response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function buildFallbackOutline(deck: DeckDocument) {
  const middleLayouts = ['text_right_image', 'single_column_narrative', 'three_column_stats', 'case_study', 'summary_next_steps'] as const;
  const slides = Array.from({ length: deck.slideCount }, (_, index) => {
    const slideNumber = index + 1;
    let layoutId: typeof middleLayouts[number] | 'cover' | 'close' = 'text_right_image';
    if (slideNumber === 1) layoutId = 'cover';
    else if (slideNumber === deck.slideCount) layoutId = 'close';
    else layoutId = middleLayouts[(slideNumber - 2) % middleLayouts.length];

    return {
      slideNumber,
      layoutId,
      title: slideNumber === 1
        ? deck.title
        : slideNumber === deck.slideCount
          ? 'Thank You'
          : `Slide ${slideNumber}: ${deck.keyMessages[(slideNumber - 2) % deck.keyMessages.length]}`,
    };
  });
  return outlineSlideSchema.array().parse(slides);
}

function buildFallbackSlides(deck: DeckDocument) {
  const slides = deck.outline.map((outlineSlide, index) => ({
    slideNumber: outlineSlide.slideNumber,
    layoutId: outlineSlide.layoutId,
    headline: outlineSlide.title,
    subhead: deck.deckType === 'client' ? 'A polished narrative for partners and clients.' : 'An internal working draft for the PRIOR team.',
    body: [
      `Audience: ${deck.audience}`,
      `Key message: ${deck.keyMessages[index % deck.keyMessages.length]}`,
      deck.additionalContext ? `Context: ${deck.additionalContext}` : '',
    ].filter(Boolean).join('\n\n'),
    speakerNotes: `Expand on how this slide supports the ${deck.deckType} deck narrative.`,
    designNote: `Use the ${outlineSlide.layoutId} layout from template version ${deck.templateVersion}.`,
  }));
  return slideSchema.array().parse(slides);
}

export async function processNextDeckJob(config: CoreConfig, options: { workerId?: string; lockMs?: number } = {}) {
  const workerId = options.workerId || 'worker';
  const lockMs = options.lockMs || 60_000;
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + lockMs).toISOString();
  const deck = await DeckModel.findOneAndUpdate(
    {
      'currentJob.status': 'queued',
      $or: [
        { 'currentJob.lockExpiresAt': { $exists: false } },
        { 'currentJob.lockExpiresAt': null },
        { 'currentJob.lockExpiresAt': { $lt: now.toISOString() } },
      ],
    },
    {
      $set: {
        'currentJob.status': 'running',
        'currentJob.startedAt': now.toISOString(),
        'currentJob.lockedBy': workerId,
        'currentJob.lockExpiresAt': lockExpiresAt,
      },
    },
    {
      sort: { updatedAt: 1 },
      new: true,
    },
  );

  if (!deck) {
    return null;
  }

  deck.currentJob = {
    ...(deck.currentJob?.toObject?.() ?? deck.currentJob),
    status: 'running',
  };

  if (deck.currentJob?.kind === 'outline_generation') {
    deck.status = 'outline_generating';
    await deck.save();
    return runOutlineJob(config, deck);
  }
  if (deck.currentJob?.kind === 'copy_generation') {
    deck.status = 'copy_generating';
    await deck.save();
    return runCopyJob(config, deck);
  }
  deck.status = 'building';
  await deck.save();
  return runBuildJob(config, deck);
}

async function runOutlineJob(config: CoreConfig, deck: DeckDocument) {
  try {
    deck.outline = await generateOutline(config, deck);
    deck.outlineVersion += 1;
    deck.status = 'outline_ready';
    return await finalizeJob(deck, 'outline');
  } catch (error) {
    return failJob(deck, 'outline_generation_failed', error);
  }
}

async function runCopyJob(config: CoreConfig, deck: DeckDocument) {
  try {
    if (!deck.outline.length) {
      throw new Error('Outline must exist before copy generation');
    }
    deck.slides = await generateSlides(config, deck);
    deck.slidesVersion += 1;
    deck.status = 'copy_ready';
    return await finalizeJob(deck, 'copy');
  } catch (error) {
    return failJob(deck, 'copy_generation_failed', error);
  }
}

async function runBuildJob(config: CoreConfig, deck: DeckDocument) {
  try {
    if (!deck.slides.length) {
      throw new Error('Slide copy must exist before build');
    }
    const artifact = await buildDeckArtifact(config, deck);
    deck.fileKey = artifact.fileKey;
    deck.status = 'complete';
    deck.completedAt = new Date().toISOString();
    return await finalizeJob(deck, 'build');
  } catch (error) {
    return failJob(deck, 'build_failed', error);
  }
}

async function finalizeJob(deck: DeckDocument, step: LastCompletedStep) {
  deck.lastCompletedStep = step;
  deck.currentJob = {
    ...(deck.currentJob?.toObject?.() ?? deck.currentJob),
    status: 'completed',
    completedAt: new Date().toISOString(),
    lockExpiresAt: undefined,
  };
  deck.retryCount = 0;
  deck.failureCode = undefined;
  deck.failureDetails = undefined;
  await deck.save();
  return deck;
}

async function failJob(deck: DeckDocument, code: string, error: unknown) {
  deck.status = 'failed';
  deck.retryCount += 1;
  deck.failureCode = code;
  deck.failureDetails = error instanceof Error ? error.message : 'Unknown error';
  deck.currentJob = {
    ...(deck.currentJob?.toObject?.() ?? deck.currentJob),
    status: 'failed',
    completedAt: new Date().toISOString(),
    lockExpiresAt: undefined,
  };
  await deck.save();
  return deck;
}

async function buildDeckArtifact(config: CoreConfig, deck: DeckDocument) {
  const pptx = new PptxGenJS();
  pptx.author = 'PRIOR Deck Builder';
  pptx.company = 'PRIOR';
  pptx.subject = deck.title;
  pptx.title = deck.title;
  pptx.layout = 'LAYOUT_WIDE';
  pptx.theme = {
    headFontFace: 'Georgia',
    bodyFontFace: 'Arial',
    lang: 'en-US',
  };

  deck.slides.forEach((slide) => {
    const page = pptx.addSlide();
    page.background = { color: slide.slideNumber % 2 === 0 ? 'F5F1EA' : 'FFFFFF' };
    page.addText(slide.headline, { x: 0.6, y: 0.5, w: 10.8, h: 0.8, fontFace: 'Georgia', fontSize: 24, bold: true, color: '1D1D1B' });
    if (slide.subhead) {
      page.addText(slide.subhead, { x: 0.6, y: 1.4, w: 10.4, h: 0.5, fontFace: 'Arial', fontSize: 13, color: '555555' });
    }
    page.addText(slide.body || '', { x: 0.6, y: 2.1, w: 7.3, h: 3.0, fontFace: 'Arial', fontSize: 16, color: '1D1D1B', breakLine: false, valign: 'top' });
    page.addText(`Layout: ${slide.layoutId}\n\n${slide.designNote || ''}`, { x: 8.2, y: 2.1, w: 2.5, h: 2.5, fontFace: 'Arial', fontSize: 10, color: '666666', margin: 0.08 });
  });

  const fileKey = `decks/${deck._id.toString()}.pptx`;
  const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
  await uploadDeckBuffer(config, fileKey, buffer);
  return { fileKey };
}

async function uploadDeckBuffer(config: CoreConfig, fileKey: string, buffer: Buffer) {
  if (config.storageMode === 's3' && config.s3) {
    const client = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      forcePathStyle: !!config.s3.endpoint,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
    await client.send(new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }));
    return;
  }

  const { mkdir, writeFile } = await import('node:fs/promises');
  const { dirname, join } = await import('node:path');
  const absolutePath = join(config.localStorageDir, fileKey);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
}

export async function getDownloadUrl(config: CoreConfig, fileKey: string) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  if (config.storageMode === 's3' && config.s3) {
    const client = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      forcePathStyle: !!config.s3.endpoint,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
    const url = await getSignedUrl(client, new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: fileKey,
    }), { expiresIn: 60 * 60 * 24 });
    return { url, expiresAt };
  }

  const encodedFileKey = encodeURIComponent(fileKey);
  const url = `${config.appBaseUrl}/api/downloads/${encodedFileKey}?expiresAt=${encodeURIComponent(expiresAt)}&signature=local`;
  return { url, expiresAt };
}

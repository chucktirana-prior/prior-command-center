import { Router } from 'express';
import {
  createDeck,
  getDeckForUser,
  getDownloadUrl,
  listDecks,
  queueDeckJob,
  saveOutline,
  saveSlides,
  type CoreConfig,
} from '@prior/deck-builder-core';
import {
  createDeckSchema,
  updateOutlineSchema,
  updateSlidesSchema,
} from '@prior/deck-builder-shared';
import { getUserId } from '../lib/auth.js';

export function createDeckRoutes(config: CoreConfig) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const decks = await listDecks(getUserId(req));
      res.json({ decks });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const payload = createDeckSchema.parse(req.body);
      const deck = await createDeck(config, getUserId(req), payload);
      res.status(201).json({ deck });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const deck = await getDeckForUser(req.params.id, getUserId(req));
      if (!deck) {
        res.status(404).json({ error: 'Deck not found' });
        return;
      }
      res.json({ deck });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/outline/generate', async (req, res, next) => {
    try {
      const deck = await queueDeckJob(req.params.id, getUserId(req), 'outline_generation');
      if (!deck) {
        res.status(404).json({ error: 'Deck not found' });
        return;
      }
      res.status(202).json({ deck });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id/outline', async (req, res, next) => {
    try {
      const payload = updateOutlineSchema.parse(req.body);
      const result = await saveOutline(req.params.id, getUserId(req), payload.outlineVersion, payload.outline);
      if (result.kind === 'not_found') {
        res.status(404).json({ error: 'Deck not found' });
        return;
      }
      if (result.kind === 'conflict') {
        res.status(409).json({ error: 'Outline version conflict', currentVersion: result.currentVersion });
        return;
      }
      res.json({ deck: result.deck });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/copy/generate', async (req, res, next) => {
    try {
      const deck = await queueDeckJob(req.params.id, getUserId(req), 'copy_generation');
      if (!deck) {
        res.status(404).json({ error: 'Deck not found' });
        return;
      }
      res.status(202).json({ deck });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id/copy', async (req, res, next) => {
    try {
      const payload = updateSlidesSchema.parse(req.body);
      const result = await saveSlides(req.params.id, getUserId(req), payload.slidesVersion, payload.slides);
      if (result.kind === 'not_found') {
        res.status(404).json({ error: 'Deck not found' });
        return;
      }
      if (result.kind === 'conflict') {
        res.status(409).json({ error: 'Slides version conflict', currentVersion: result.currentVersion });
        return;
      }
      res.json({ deck: result.deck });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/build', async (req, res, next) => {
    try {
      const deck = await queueDeckJob(req.params.id, getUserId(req), 'pptx_build');
      if (!deck) {
        res.status(404).json({ error: 'Deck not found' });
        return;
      }
      res.status(202).json({ deck });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/download-url', async (req, res, next) => {
    try {
      const deck = await getDeckForUser(req.params.id, getUserId(req));
      if (!deck) {
        res.status(404).json({ error: 'Deck not found' });
        return;
      }
      if (deck.status !== 'complete' || !deck.fileKey) {
        res.status(409).json({ error: 'Deck is not ready for download' });
        return;
      }
      const download = await getDownloadUrl(config, deck.fileKey);
      res.json(download);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DECK_STATUSES,
  briefSchema,
  inferBuildStatus,
  inferCopyStatus,
  inferOutlineStatus,
  layoutRegistry,
  layoutIds,
  updateOutlineSchema,
  updateSlidesSchema,
} from '../packages/shared/src/index.ts';

test('brief schema enforces key message limit and slide count bounds', () => {
  const result = briefSchema.safeParse({
    title: 'Partner deck',
    deckType: 'client',
    audience: 'Travel partners',
    keyMessages: ['One', 'Two', 'Three', 'Four'],
    slideCount: 20,
    additionalContext: '',
  });

  assert.equal(result.success, false);
});

test('layout registry is stable and unique', () => {
  assert.equal(layoutRegistry.length, 10);
  assert.deepEqual(layoutIds, layoutRegistry.map((layout) => layout.layoutId));
  assert.equal(new Set(layoutRegistry.map((layout) => layout.layoutId)).size, layoutRegistry.length);
  assert.equal(new Set(layoutRegistry.map((layout) => layout.templateSlideRef)).size, layoutRegistry.length);
});

test('outline and slide schemas accept known layout ids only', () => {
  const valid = updateOutlineSchema.safeParse({
    outlineVersion: 0,
    outline: [{
      slideNumber: 1,
      layoutId: layoutRegistry[0].layoutId,
      title: 'Cover',
    }],
  });

  const invalid = updateOutlineSchema.safeParse({
    outlineVersion: 0,
    outline: [{
      slideNumber: 1,
      layoutId: 'unknown-layout',
      title: 'Cover',
    }],
  });

  assert.equal(valid.success, true);
  assert.equal(invalid.success, false);

  const slideValid = updateSlidesSchema.safeParse({
    slidesVersion: 0,
    slides: [{
      slideNumber: 1,
      layoutId: layoutRegistry[0].layoutId,
      headline: 'Cover',
    }],
  });

  const slideInvalid = updateSlidesSchema.safeParse({
    slidesVersion: 0,
    slides: [{
      slideNumber: 1,
      layoutId: 'unknown-layout',
      headline: 'Cover',
    }],
  });

  assert.equal(slideValid.success, true);
  assert.equal(slideInvalid.success, false);
});

test('status helpers collapse the full async lifecycle for the ui', () => {
  const outlineStatuses = new Map([
    ['draft', 'idle'],
    ['outline_queued', 'pending'],
    ['outline_generating', 'pending'],
    ['outline_ready', 'ready'],
    ['copy_queued', 'ready'],
    ['copy_generating', 'ready'],
    ['copy_ready', 'ready'],
    ['build_queued', 'ready'],
    ['building', 'ready'],
    ['complete', 'ready'],
    ['failed', 'failed'],
  ]);
  const copyStatuses = new Map([
    ['draft', 'idle'],
    ['outline_queued', 'idle'],
    ['outline_generating', 'idle'],
    ['outline_ready', 'idle'],
    ['copy_queued', 'pending'],
    ['copy_generating', 'pending'],
    ['copy_ready', 'ready'],
    ['build_queued', 'ready'],
    ['building', 'ready'],
    ['complete', 'ready'],
    ['failed', 'failed'],
  ]);
  const buildStatuses = new Map([
    ['draft', 'idle'],
    ['outline_queued', 'idle'],
    ['outline_generating', 'idle'],
    ['outline_ready', 'idle'],
    ['copy_queued', 'idle'],
    ['copy_generating', 'idle'],
    ['copy_ready', 'idle'],
    ['build_queued', 'pending'],
    ['building', 'pending'],
    ['complete', 'ready'],
    ['failed', 'failed'],
  ]);

  assert.deepEqual([...outlineStatuses.keys()], [...DECK_STATUSES]);
  assert.deepEqual([...copyStatuses.keys()], [...DECK_STATUSES]);
  assert.deepEqual([...buildStatuses.keys()], [...DECK_STATUSES]);

  for (const [status, expected] of outlineStatuses) {
    assert.equal(inferOutlineStatus(status), expected);
  }
  for (const [status, expected] of copyStatuses) {
    assert.equal(inferCopyStatus(status), expected);
  }
  for (const [status, expected] of buildStatuses) {
    assert.equal(inferBuildStatus(status), expected);
  }
});

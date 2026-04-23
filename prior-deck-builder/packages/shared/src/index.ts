import { z } from 'zod';

export const DECK_STATUSES = [
  'draft',
  'outline_queued',
  'outline_generating',
  'outline_ready',
  'copy_queued',
  'copy_generating',
  'copy_ready',
  'build_queued',
  'building',
  'complete',
  'failed',
] as const;

export const LAST_COMPLETED_STEPS = [
  'brief',
  'outline',
  'copy',
  'build',
] as const;

export const JOB_KINDS = [
  'outline_generation',
  'copy_generation',
  'pptx_build',
] as const;

export const layoutRegistry = [
  { layoutId: 'cover', displayName: 'Cover', templateSlideRef: 'layout-cover', allowedFields: ['title', 'headline', 'subhead'], validationRules: ['required-first-slide'] },
  { layoutId: 'text_right_image', displayName: 'Text + Right Image', templateSlideRef: 'layout-text-right-image', allowedFields: ['title', 'headline', 'body', 'designNote'], validationRules: [] },
  { layoutId: 'centered_list', displayName: 'Centred List', templateSlideRef: 'layout-centered-list', allowedFields: ['title', 'headline', 'body'], validationRules: [] },
  { layoutId: 'section_divider', displayName: 'Section Divider', templateSlideRef: 'layout-section-divider', allowedFields: ['title', 'headline'], validationRules: [] },
  { layoutId: 'case_study', displayName: 'Case Study', templateSlideRef: 'layout-case-study', allowedFields: ['title', 'headline', 'body', 'speakerNotes'], validationRules: [] },
  { layoutId: 'quote_pullout', displayName: 'Quote / Pullout', templateSlideRef: 'layout-quote-pullout', allowedFields: ['title', 'headline', 'body'], validationRules: [] },
  { layoutId: 'close', displayName: 'Close / Thank You', templateSlideRef: 'layout-close', allowedFields: ['title', 'headline'], validationRules: ['required-last-slide'] },
  { layoutId: 'single_column_narrative', displayName: 'Single-Column Narrative', templateSlideRef: 'layout-single-column-narrative', allowedFields: ['title', 'headline', 'body', 'speakerNotes'], validationRules: [] },
  { layoutId: 'three_column_stats', displayName: 'Three-Column Stats', templateSlideRef: 'layout-three-column-stats', allowedFields: ['title', 'headline', 'body', 'designNote'], validationRules: [] },
  { layoutId: 'summary_next_steps', displayName: 'Summary + Next Steps', templateSlideRef: 'layout-summary-next-steps', allowedFields: ['title', 'headline', 'body', 'speakerNotes'], validationRules: [] },
] as const;

export type DeckStatus = (typeof DECK_STATUSES)[number];
export type LastCompletedStep = (typeof LAST_COMPLETED_STEPS)[number];
export type JobKind = (typeof JOB_KINDS)[number];
export type LayoutId = (typeof layoutRegistry)[number]['layoutId'];

export const layoutIds = layoutRegistry.map((layout) => layout.layoutId) as [LayoutId, ...LayoutId[]];

export const deckTypeSchema = z.enum(['client', 'internal']);

export const briefSchema = z.object({
  title: z.string().trim().min(3).max(120),
  deckType: deckTypeSchema,
  audience: z.string().trim().min(3).max(200),
  keyMessages: z.array(z.string().trim().min(3).max(200)).min(1).max(3),
  slideCount: z.number().int().min(5).max(15),
  additionalContext: z.string().trim().max(1000).optional().default(''),
});

export const outlineSlideSchema = z.object({
  slideNumber: z.number().int().positive(),
  layoutId: z.enum(layoutIds),
  title: z.string().trim().min(1).max(160),
});

export const slideSchema = z.object({
  slideNumber: z.number().int().positive(),
  layoutId: z.enum(layoutIds),
  headline: z.string().trim().min(1).max(200),
  subhead: z.string().trim().max(240).optional().default(''),
  body: z.string().trim().max(4000).optional().default(''),
  speakerNotes: z.string().trim().max(4000).optional().default(''),
  designNote: z.string().trim().max(1000).optional().default(''),
});

export const jobSchema = z.object({
  kind: z.enum(JOB_KINDS),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  requestedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export const createDeckSchema = briefSchema;

export const updateOutlineSchema = z.object({
  outlineVersion: z.number().int().nonnegative(),
  outline: z.array(outlineSlideSchema).min(1),
});

export const updateSlidesSchema = z.object({
  slidesVersion: z.number().int().nonnegative(),
  slides: z.array(slideSchema).min(1),
});

export const downloadUrlResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().datetime(),
});

export type CreateDeckInput = z.infer<typeof createDeckSchema>;
export type OutlineSlide = z.infer<typeof outlineSlideSchema>;
export type DeckSlide = z.infer<typeof slideSchema>;
export type UpdateOutlineInput = z.infer<typeof updateOutlineSchema>;
export type UpdateSlidesInput = z.infer<typeof updateSlidesSchema>;

export function inferOutlineStatus(status: DeckStatus): 'idle' | 'pending' | 'ready' | 'failed' {
  if (['outline_queued', 'outline_generating'].includes(status)) return 'pending';
  if (['outline_ready', 'copy_queued', 'copy_generating', 'copy_ready', 'build_queued', 'building', 'complete'].includes(status)) return 'ready';
  if (status === 'failed') return 'failed';
  return 'idle';
}

export function inferCopyStatus(status: DeckStatus): 'idle' | 'pending' | 'ready' | 'failed' {
  if (['copy_queued', 'copy_generating'].includes(status)) return 'pending';
  if (['copy_ready', 'build_queued', 'building', 'complete'].includes(status)) return 'ready';
  if (status === 'failed') return 'failed';
  return 'idle';
}

export function inferBuildStatus(status: DeckStatus): 'idle' | 'pending' | 'ready' | 'failed' {
  if (['build_queued', 'building'].includes(status)) return 'pending';
  if (status === 'complete') return 'ready';
  if (status === 'failed') return 'failed';
  return 'idle';
}

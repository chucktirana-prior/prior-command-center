import Anthropic from '@anthropic-ai/sdk';
import config from '../../config.js';
import {
  getLocationPlaceById,
  insertLocationAiReview,
  listLocationPlaces,
  updateLocationPlaceAiReview,
} from '../../db/index.js';

const REVIEW_MODEL = 'claude-haiku-4-5-20251001';

function getClient() {
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  return new Anthropic({ apiKey: config.anthropic.apiKey });
}

function buildPrompt(place) {
  const evidence = {
    articleTitle: place.article_title,
    articleUrl: place.article_url,
    section: place.section,
    businessName: place.business_name,
    sourceLinkText: place.source_link_text,
    websiteUrl: place.website_url,
    websiteCheckStatus: place.website_check_status,
    websiteHttpStatus: place.website_http_status,
    websiteFinalUrl: place.website_final_url,
    websitePageTitle: place.website_page_title,
    websiteSignalSummary: place.website_signal_summary,
    googleCheckStatus: place.check_status,
    businessStatus: place.business_status,
    lastWebsiteCheckedAt: place.website_checked_at,
    lastMapsCheckedAt: place.last_checked_at,
  };

  return {
    system: 'You review editorial location evidence. Return strict JSON only.',
    user: `Given this evidence, classify the business as one of: likely_active, likely_changed, likely_closed, needs_review. Return JSON with keys status, confidence, summary, recommendation.\n\n${JSON.stringify(evidence, null, 2)}`,
    evidence,
  };
}

function persistAiReview(place, review, rawResponse, errorMessage = null) {
  const reviewedAt = new Date().toISOString();

  updateLocationPlaceAiReview({
    id: place.id,
    ai_review_status: review.status,
    ai_review_confidence: review.confidence ?? null,
    ai_review_summary: review.summary || null,
    ai_review_recommendation: review.recommendation || null,
    ai_reviewed_at: reviewedAt,
    updated_at: reviewedAt,
  });

  insertLocationAiReview({
    location_place_id: place.id,
    reviewed_at: reviewedAt,
    review_status: review.status,
    confidence: review.confidence ?? null,
    summary: review.summary || null,
    recommendation: review.recommendation || null,
    evidence_snapshot: JSON.stringify(buildPrompt(place).evidence),
    raw_response: rawResponse || null,
    error_message: errorMessage,
  });
}

function selectPlacesForAiReview(places, { limit = null, mode = 'all' } = {}) {
  let selectedPlaces = places;

  switch (mode) {
    case 'unreviewed':
      selectedPlaces = places.filter((place) => (
        !place.ai_reviewed_at
        || place.ai_review_status === 'pending'
      ));
      break;
    case 'risky':
      selectedPlaces = places.filter((place) => (
        ['suspect', 'error'].includes(place.website_check_status)
        || ['closed', 'not_found', 'error'].includes(place.check_status)
        || place.ai_review_status === 'needs_review'
      ));
      break;
    case 'website_checked':
      selectedPlaces = places.filter((place) => !!place.website_checked_at);
      break;
    case 'all':
    default:
      selectedPlaces = places;
      break;
  }

  if (typeof limit === 'number' && limit > 0) {
    return selectedPlaces.slice(0, limit);
  }

  return selectedPlaces;
}

export async function reviewLocationPlace(placeId) {
  const place = getLocationPlaceById(placeId);
  if (!place) {
    throw new Error('Location place not found');
  }

  const { system, user } = buildPrompt(place);
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: REVIEW_MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const raw = response.content[0]?.text || '';
    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

    const review = {
      status: parsed.status || 'needs_review',
      confidence: parsed.confidence ?? null,
      summary: parsed.summary || '',
      recommendation: parsed.recommendation || '',
    };

    persistAiReview(place, review, raw, null);
    return review;
  } catch (error) {
    const review = {
      status: 'needs_review',
      confidence: 0,
      summary: '',
      recommendation: '',
    };
    persistAiReview(place, review, null, error.message);
    return review;
  }
}

export async function reviewAllLocationPlaces({ limit = null, mode = 'all', placeIds = null, initialProcessed = 0, totalOverride = null, onProgress = null, shouldStop = null } = {}) {
  const places = listLocationPlaces();
  const selectedPlaces = Array.isArray(placeIds)
    ? placeIds.map((id) => places.find((place) => place.id === id)).filter(Boolean)
    : selectPlacesForAiReview(places, { limit, mode });
  const totalCount = totalOverride ?? selectedPlaces.length;
  const summary = {
    mode,
    selected: totalCount,
    reviewed: initialProcessed,
    likely_active: 0,
    likely_changed: 0,
    likely_closed: 0,
    needs_review: 0,
  };

  onProgress?.({
    mode,
    processed: initialProcessed,
    total: totalCount,
    progress_pct: totalCount ? Math.round((initialProcessed / totalCount) * 100) : 100,
    detail: selectedPlaces.length ? 'Preparing AI review queue' : 'No matching places to review',
  });

  for (const place of selectedPlaces) {
    if (shouldStop?.()) break;
    onProgress?.({
      mode,
      processed: summary.reviewed,
      total: totalCount,
      progress_pct: totalCount ? Math.round((summary.reviewed / totalCount) * 100) : 100,
      detail: `Reviewing ${place.business_name}`,
    });
    const result = await reviewLocationPlace(place.id);
    summary.reviewed++;
    summary[result.status] = (summary[result.status] || 0) + 1;

    onProgress?.({
      mode,
      processed: summary.reviewed,
      total: totalCount,
      progress_pct: totalCount ? Math.round((summary.reviewed / totalCount) * 100) : 100,
      detail: `Reviewed ${place.business_name}`,
    });
  }

  return summary;
}

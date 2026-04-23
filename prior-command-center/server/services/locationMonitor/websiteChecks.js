import {
  getLocationPlaceById,
  insertLocationWebsiteCheck,
  listLocationPlaces,
  updateLocationPlaceWebsiteEvidence,
} from '../../db/index.js';

const USER_AGENT = 'PriorCommandCenter/1.0 (+https://priorworld.com)';

const CLOSURE_PATTERNS = [
  /permanently closed/i,
  /temporarily closed/i,
  /has closed/i,
  /no longer open/i,
  /closed for good/i,
  /ceased operations/i,
  /shut down/i,
];

const SUSPICIOUS_PATTERNS = [
  /coming soon/i,
  /under maintenance/i,
  /page not found/i,
  /404/i,
  /book now/i,
];

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]) : '';
}

function collectSignals(text, patterns) {
  return patterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source.replace(/\\b/g, '').replace(/\\s\+/g, ' '));
}

function summarizeWebsiteEvidence({ httpStatus, title, closureSignals, suspiciousSignals, finalUrl, place }) {
  const summary = [];
  if (httpStatus) summary.push(`HTTP ${httpStatus}`);
  if (title) summary.push(`title: ${title}`);
  if (finalUrl && finalUrl !== place.website_url) summary.push(`redirected to ${finalUrl}`);
  if (closureSignals.length) summary.push(`closure signals: ${closureSignals.join(', ')}`);
  if (suspiciousSignals.length) summary.push(`suspicious signals: ${suspiciousSignals.join(', ')}`);
  return summary.join(' | ');
}

function classifyWebsiteCheck({ httpStatus, closureSignals, suspiciousSignals }) {
  if (!httpStatus) return 'error';
  if (httpStatus >= 500) return 'error';
  if (httpStatus >= 400) return 'suspect';
  if (closureSignals.length) return 'suspect';
  if (suspiciousSignals.length) return 'suspect';
  return 'active';
}

function persistWebsiteCheck(place, result) {
  const checkedAt = new Date().toISOString();

  updateLocationPlaceWebsiteEvidence({
    id: place.id,
    website_check_status: result.checkStatus,
    website_http_status: result.httpStatus ?? null,
    website_final_url: result.finalUrl || null,
    website_page_title: result.pageTitle || null,
    website_signal_summary: result.signalSummary || null,
    website_checked_at: checkedAt,
    updated_at: checkedAt,
  });

  insertLocationWebsiteCheck({
    location_place_id: place.id,
    checked_at: checkedAt,
    check_status: result.checkStatus,
    http_status: result.httpStatus ?? null,
    final_url: result.finalUrl || null,
    page_title: result.pageTitle || null,
    signal_summary: result.signalSummary || null,
    closure_signals: JSON.stringify(result.closureSignals || []),
    redirect_chain: JSON.stringify(result.redirectChain || []),
    raw_excerpt: result.rawExcerpt || null,
    error_message: result.errorMessage || null,
  });
}

function selectPlacesForWebsiteCheck(places, { limit = null, mode = 'all' } = {}) {
  let selectedPlaces = places;

  switch (mode) {
    case 'unreviewed':
      selectedPlaces = places.filter((place) => !place.website_checked_at || place.website_check_status === 'pending');
      break;
    case 'risky':
      selectedPlaces = places.filter((place) => (
        ['suspect', 'error'].includes(place.website_check_status)
        || ['needs_review', 'likely_changed', 'likely_closed'].includes(place.ai_review_status)
        || ['closed', 'not_found', 'error'].includes(place.check_status)
      ));
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

export async function checkLocationWebsite(placeId) {
  const place = getLocationPlaceById(placeId);
  if (!place) {
    throw new Error('Location place not found');
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10 s max per site

    let response;
    try {
      response = await fetch(place.website_url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          'accept': 'text/html,application/xhtml+xml',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const finalUrl = response.url || place.website_url;
    const httpStatus = response.status;
    const html = await response.text();
    const text = stripHtml(html).slice(0, 4000);
    const pageTitle = extractTitle(html);
    const closureSignals = collectSignals(text, CLOSURE_PATTERNS);
    const suspiciousSignals = collectSignals(text, SUSPICIOUS_PATTERNS);
    const checkStatus = classifyWebsiteCheck({ httpStatus, closureSignals, suspiciousSignals });
    const signalSummary = summarizeWebsiteEvidence({
      httpStatus,
      title: pageTitle,
      closureSignals,
      suspiciousSignals,
      finalUrl,
      place,
    });

    const result = {
      checkStatus,
      httpStatus,
      finalUrl,
      pageTitle,
      signalSummary,
      closureSignals,
      suspiciousSignals,
      redirectChain: [place.website_url, finalUrl].filter(Boolean),
      rawExcerpt: text.slice(0, 500),
      errorMessage: null,
    };

    persistWebsiteCheck(place, result);
    return result;
  } catch (error) {
    const result = {
      checkStatus: 'error',
      httpStatus: null,
      finalUrl: place.website_url,
      pageTitle: '',
      signalSummary: '',
      closureSignals: [],
      suspiciousSignals: [],
      redirectChain: [place.website_url].filter(Boolean),
      rawExcerpt: '',
      errorMessage: error.message,
    };

    persistWebsiteCheck(place, result);
    return result;
  }
}

export async function checkAllLocationWebsites({ limit = null, mode = 'all', placeIds = null, initialProcessed = 0, totalOverride = null, onProgress = null, shouldStop = null } = {}) {
  const places = listLocationPlaces();
  const selectedPlaces = Array.isArray(placeIds)
    ? placeIds.map((id) => places.find((place) => place.id === id)).filter(Boolean)
    : selectPlacesForWebsiteCheck(places, { limit, mode });
  const totalCount = totalOverride ?? selectedPlaces.length;
  const summary = {
    mode,
    selected: totalCount,
    checked: initialProcessed,
    active: 0,
    suspect: 0,
    errors: 0,
  };

  onProgress?.({
    mode,
    processed: initialProcessed,
    total: totalCount,
    progress_pct: totalCount ? Math.round((initialProcessed / totalCount) * 100) : 100,
    detail: selectedPlaces.length ? 'Preparing website checks' : 'No matching places to check',
  });

  for (const place of selectedPlaces) {
    if (shouldStop?.()) break;
    onProgress?.({
      mode,
      processed: summary.checked,
      total: totalCount,
      progress_pct: totalCount ? Math.round((summary.checked / totalCount) * 100) : 100,
      detail: `Checking ${place.business_name}`,
    });
    const result = await checkLocationWebsite(place.id);
    summary.checked++;
    if (result.checkStatus === 'active') summary.active++;
    else if (result.checkStatus === 'suspect') summary.suspect++;
    else summary.errors++;

    onProgress?.({
      mode,
      processed: summary.checked,
      total: totalCount,
      progress_pct: totalCount ? Math.round((summary.checked / totalCount) * 100) : 100,
      detail: `Checked ${place.business_name}`,
    });
  }

  return summary;
}

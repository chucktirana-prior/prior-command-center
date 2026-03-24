import config from '../../config.js';
import {
  getLocationPlaceById,
  insertLocationCheck,
  listLocationPlaces,
  updateLocationPlaceCheck,
} from '../../db/index.js';

function isConfigured() {
  return !!config.googleMaps.apiKey;
}

function isPlaceOpen(place) {
  if (!place) return null;
  if (place.business_status === 'CLOSED_PERMANENTLY') return false;
  if (place.business_status === 'CLOSED_TEMPORARILY') return false;
  if (place.permanently_closed === true) return false;
  if (place.business_status === 'OPERATIONAL') return true;
  return null;
}

async function findPlace(query) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.set('key', config.googleMaps.apiKey);
  url.searchParams.set('input', query);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'place_id,name,formatted_address,business_status');

  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Google Maps request failed (${response.status})`);
  }

  const data = await response.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || `Google Maps findPlace returned ${data.status}`);
  }

  return data.candidates?.[0] || null;
}

async function getPlaceDetails(placeId) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('key', config.googleMaps.apiKey);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'place_id,name,formatted_address,business_status,opening_hours,permanently_closed,website,formatted_phone_number');

  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Google Maps details request failed (${response.status})`);
  }

  const data = await response.json();
  if (data.status !== 'OK') {
    throw new Error(data.error_message || `Google Maps placeDetails returned ${data.status}`);
  }

  return data.result;
}

function writeCheckResult(place, result) {
  const checkedAt = new Date().toISOString();

  updateLocationPlaceCheck({
    id: place.id,
    google_place_id: result.placeId || null,
    address: result.address || null,
    phone: result.phone || null,
    business_status: result.businessStatus || null,
    is_open: result.isOpen == null ? null : (result.isOpen ? 1 : 0),
    check_status: result.checkStatus,
    confidence: result.confidence ?? null,
    last_checked_at: checkedAt,
    updated_at: checkedAt,
  });

  insertLocationCheck({
    location_place_id: place.id,
    checked_at: checkedAt,
    check_status: result.checkStatus,
    business_status: result.businessStatus || null,
    is_open: result.isOpen == null ? null : (result.isOpen ? 1 : 0),
    confidence: result.confidence ?? null,
    place_id: result.placeId || null,
    address: result.address || null,
    phone: result.phone || null,
    raw_response: result.rawResponse ? JSON.stringify(result.rawResponse) : null,
    error_message: result.errorMessage || null,
  });
}

export async function checkLocationPlace(placeId) {
  if (!isConfigured()) {
    throw new Error('GOOGLE_MAPS_API_KEY not configured');
  }

  const place = getLocationPlaceById(placeId);
  if (!place) {
    throw new Error('Location place not found');
  }

  try {
    const candidate = await findPlace(place.maps_query || place.business_name);

    if (!candidate) {
      const result = {
        checkStatus: 'not_found',
        confidence: 0,
        errorMessage: null,
        rawResponse: { candidate: null },
      };
      writeCheckResult(place, result);
      return result;
    }

    const details = await getPlaceDetails(candidate.place_id);
    const isOpen = isPlaceOpen(details);
    const result = {
      checkStatus: isOpen === false ? 'closed' : 'open',
      businessStatus: details.business_status || candidate.business_status || 'UNKNOWN',
      isOpen,
      confidence: isOpen === false ? 0.9 : 0.8,
      placeId: details.place_id,
      address: details.formatted_address || candidate.formatted_address || null,
      phone: details.formatted_phone_number || null,
      rawResponse: details,
    };

    writeCheckResult(place, result);
    return result;
  } catch (error) {
    const result = {
      checkStatus: 'error',
      confidence: 0,
      errorMessage: error.message,
      rawResponse: null,
    };
    writeCheckResult(place, result);
    return result;
  }
}

export async function checkAllLocationPlaces() {
  if (!isConfigured()) {
    throw new Error('GOOGLE_MAPS_API_KEY not configured');
  }

  const places = listLocationPlaces();
  const summary = {
    checked: 0,
    open: 0,
    closed: 0,
    notFound: 0,
    errors: 0,
  };

  for (const place of places) {
    const result = await checkLocationPlace(place.id);
    summary.checked++;
    if (result.checkStatus === 'open') summary.open++;
    else if (result.checkStatus === 'closed') summary.closed++;
    else if (result.checkStatus === 'not_found') summary.notFound++;
    else if (result.checkStatus === 'error') summary.errors++;
  }

  return summary;
}

export function hasGoogleMapsConfig() {
  return isConfigured();
}

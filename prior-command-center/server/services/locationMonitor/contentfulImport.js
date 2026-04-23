import contentful from 'contentful-management';
import config from '../../config.js';
import { deleteLocationPlacesByIds, listLocationPlaces, upsertLocationPlace } from '../../db/index.js';

const INTERNAL_HOSTS = [
  'priorworld.com',
  'www.priorworld.com',
  'prior.com',
  'localhost',
  '127.0.0.1',
];

const NON_VENUE_LINK_PATTERNS = [
  /make an inquiry/i,
  /enquiry/i,
  /inquiry/i,
  /contact sales/i,
  /request availability/i,
  /book now/i,
  /link in bio/i,
];

function getClient() {
  if (!config.contentful.spaceId || !config.contentful.cmaToken) {
    throw new Error('Contentful is not configured');
  }

  return contentful.createClient({
    accessToken: config.contentful.cmaToken,
  });
}

async function getEnvironment() {
  const client = getClient();
  const space = await client.getSpace(config.contentful.spaceId);
  return space.getEnvironment(config.contentful.environment);
}

function getLocalized(entry, fieldName, fallback = '') {
  const value = entry.fields?.[fieldName];
  if (value?.['en-US'] != null) return value['en-US'];
  return value ?? fallback;
}

function isExternalLink(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return !INTERNAL_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function sectionLabelFromHeading(headingText) {
  return headingText
    .replace(/^#+\s*/, '')
    .trim();
}

function normalizeBusinessName(text, url) {
  const trimmed = (text || '').trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./i, '');
    return hostname.split('.')[0]
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return trimmed || 'Unknown Business';
  }
}

function isLikelyVenueLink(text, url) {
  const combined = `${text || ''} ${url || ''}`;
  if (NON_VENUE_LINK_PATTERNS.some((pattern) => pattern.test(combined))) {
    return false;
  }

  try {
    const parsed = new URL(url);
    if (/\/(enquiry|inquiry|contact|book|booking|request)(\/|$)/i.test(parsed.pathname)) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

function buildMapsQuery(businessName, articleTitle) {
  if (!businessName) return articleTitle || '';
  if (!articleTitle) return businessName;
  return `${businessName} ${articleTitle}`.trim();
}

function extractLinkedBusinesses(markdown, article) {
  if (!markdown) return [];

  const records = [];
  let skipped = 0;
  const lines = markdown.split('\n');
  let currentSection = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      currentSection = sectionLabelFromHeading(headingMatch[2]);
    }

    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = markdownLinkRegex.exec(line)) !== null) {
      const [, text, url] = match;
      if (!isExternalLink(url)) continue;
      if (!isLikelyVenueLink(text, url)) {
        skipped++;
        continue;
      }

      const businessName = normalizeBusinessName(text, url);
      records.push({
        article_id: article.id,
        article_title: article.title,
        article_slug: article.slug,
        article_url: article.slug ? `https://priorworld.com/editorial/${article.slug.replace(/^\//, '')}` : '',
        date_published: article.datePublished || null,
        section: currentSection,
        business_name: businessName,
        source_link_text: text.trim(),
        website_url: url.trim(),
        maps_query: buildMapsQuery(businessName, article.title),
      });
    }
  }

  return { records, skipped };
}

export async function importLocationBusinessesFromContentful() {
  const env = await getEnvironment();
  const now = new Date().toISOString();
  let imported = 0;
  let scannedArticles = 0;
  let skippedNonVenueLinks = 0;
  let prunedNonVenueLinks = 0;
  let skip = 0;
  const limit = 100;
  let total = Infinity;

  const existingNonVenueIds = listLocationPlaces()
    .filter((place) => !isLikelyVenueLink(place.source_link_text, place.website_url))
    .map((place) => place.id);

  if (existingNonVenueIds.length > 0) {
    const result = deleteLocationPlacesByIds(existingNonVenueIds);
    prunedNonVenueLinks = result.changes || 0;
  }

  while (skip < total) {
    const entries = await env.getEntries({
      content_type: config.contentful.articleTypeId,
      limit,
      skip,
      order: '-sys.updatedAt',
      select: 'sys.id,fields.title,fields.slug,fields.datePublished,fields.articleBody',
    });

    total = entries.total ?? entries.items.length;

    for (const item of entries.items) {
      const article = {
        id: item.sys.id,
        title: getLocalized(item, 'title', ''),
        slug: getLocalized(item, 'slug', ''),
        datePublished: getLocalized(item, 'datePublished', ''),
        articleBody: getLocalized(item, 'articleBody', ''),
      };

      if (!article.title || !article.articleBody) continue;
      scannedArticles++;

      const { records, skipped } = extractLinkedBusinesses(article.articleBody, article);
      skippedNonVenueLinks += skipped;
      for (const record of records) {
        upsertLocationPlace({
          ...record,
          first_seen_at: now,
          updated_at: now,
        });
        imported++;
      }
    }

    if (entries.items.length < limit) break;
    skip += entries.items.length;
  }

  return {
    scannedArticles,
    imported,
    skippedNonVenueLinks,
    prunedNonVenueLinks,
  };
}

export async function importGuidePostsFromContentful() {
  const env = await getEnvironment();
  const now = new Date().toISOString();
  let imported = 0;
  let skipped = 0;
  let skip = 0;
  const limit = 100;
  let total = Infinity;

  while (skip < total) {
    const entries = await env.getEntries({
      content_type: config.contentful.guidePostTypeId,
      limit,
      skip,
      order: '-sys.updatedAt',
      select: 'sys.id,fields.title,fields.slug,fields.website,fields.address,fields.phoneNumber,fields.guide,fields.guideType',
    });

    total = entries.total ?? entries.items.length;

    // Collect unique guide and guideType IDs to batch-resolve
    const guideIds = [...new Set(
      entries.items.map((item) => getLocalized(item, 'guide')?.sys?.id).filter(Boolean)
    )];
    const guideTypeIds = [...new Set(
      entries.items.map((item) => getLocalized(item, 'guideType')?.sys?.id).filter(Boolean)
    )];

    const guideMap = new Map();
    if (guideIds.length > 0) {
      const guideEntries = await env.getEntries({
        content_type: config.contentful.guideTypeId,
        'sys.id[in]': guideIds.join(','),
        select: 'sys.id,fields.title,fields.slug',
      });
      for (const g of guideEntries.items) {
        guideMap.set(g.sys.id, {
          title: getLocalized(g, 'title', ''),
          slug: getLocalized(g, 'slug', ''),
        });
      }
    }

    const guideTypeMap = new Map();
    if (guideTypeIds.length > 0) {
      const gtEntries = await env.getEntries({
        content_type: config.contentful.guideSubCategoryTypeId,
        'sys.id[in]': guideTypeIds.join(','),
        select: 'sys.id,fields.name',
      });
      for (const gt of gtEntries.items) {
        guideTypeMap.set(gt.sys.id, getLocalized(gt, 'name', ''));
      }
    }

    for (const item of entries.items) {
      const title = getLocalized(item, 'title', '');
      const postSlug = getLocalized(item, 'slug', '');
      const website = getLocalized(item, 'website', '');
      const address = getLocalized(item, 'address', '');
      const phone = getLocalized(item, 'phoneNumber', '');

      const guideRef = getLocalized(item, 'guide');
      const guideId = guideRef?.sys?.id || '';
      const guide = guideMap.get(guideId) || { title: '', slug: '' };

      const guideTypeRef = getLocalized(item, 'guideType');
      const guideTypeId = guideTypeRef?.sys?.id || '';
      const section = guideTypeMap.get(guideTypeId) || null;

      if (!title) {
        skipped++;
        continue;
      }

      // Prefer the venue's own website; fall back to the Prior guide post URL for uniqueness
      const websiteUrl = website
        || (guide.slug && postSlug ? `https://priorworld.com/guides/${guide.slug}/${postSlug}` : null);

      if (!websiteUrl) {
        skipped++;
        continue;
      }

      // article_id = parent guide's entry ID so rollups group by guide, not by individual post
      const articleId = guideId || item.sys.id;
      const articleUrl = guide.slug ? `https://priorworld.com/guides/${guide.slug}` : '';

      // Build a precise maps query using the first line of the address
      const addressFirstLine = address ? address.split('\n')[0].trim() : '';
      const mapsQuery = [title, addressFirstLine].filter(Boolean).join(', ');

      upsertLocationPlace({
        article_id: articleId,
        article_title: guide.title || title,
        article_slug: guide.slug || '',
        article_url: articleUrl,
        date_published: null,
        section,
        business_name: title,
        source_link_text: title,
        website_url: websiteUrl,
        maps_query: mapsQuery,
        address: address || null,
        phone: phone || null,
        source_type: 'guide_post',
        first_seen_at: now,
        updated_at: now,
      });
      imported++;
    }

    if (entries.items.length < limit) break;
    skip += entries.items.length;
  }

  return { imported, skipped };
}

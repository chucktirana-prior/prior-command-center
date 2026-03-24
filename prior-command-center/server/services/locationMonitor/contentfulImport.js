import contentful from 'contentful-management';
import config from '../../config.js';
import { upsertLocationPlace } from '../../db/index.js';

const INTERNAL_HOSTS = [
  'priorworld.com',
  'www.priorworld.com',
  'prior.com',
  'localhost',
  '127.0.0.1',
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

function buildMapsQuery(businessName, articleTitle) {
  if (!businessName) return articleTitle || '';
  if (!articleTitle) return businessName;
  return `${businessName} ${articleTitle}`.trim();
}

function extractLinkedBusinesses(markdown, article) {
  if (!markdown) return [];

  const records = [];
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

  return records;
}

export async function importLocationBusinessesFromContentful() {
  const env = await getEnvironment();
  const entries = await env.getEntries({
    content_type: config.contentful.articleTypeId,
    limit: 1000,
    order: '-sys.updatedAt',
  });

  const now = new Date().toISOString();
  let imported = 0;
  let scannedArticles = 0;

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

    const links = extractLinkedBusinesses(article.articleBody, article);
    for (const record of links) {
      upsertLocationPlace({
        ...record,
        first_seen_at: now,
        updated_at: now,
      });
      imported++;
    }
  }

  return {
    scannedArticles,
    imported,
  };
}

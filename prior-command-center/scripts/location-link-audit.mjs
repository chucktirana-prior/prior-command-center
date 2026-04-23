import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, getDb } from '../server/db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'reports', 'location-monitor');
const CONCURRENCY = Number(process.env.LINK_AUDIT_CONCURRENCY || 24);
const TIMEOUT_MS = Number(process.env.LINK_AUDIT_TIMEOUT_MS || 8000);

mkdirSync(OUTPUT_DIR, { recursive: true });

initDb();
const db = getDb();
const places = db.prepare(`
  select id, article_title, article_url, business_name, website_url
  from location_places
  order by article_title asc, id asc
`).all();

function normalizeError(message) {
  const text = String(message || '').toLowerCase();
  if (text.includes('timeout')) return 'timeout';
  if (text.includes('certificate')) return 'tls';
  if (text.includes('fetch failed')) return 'fetch failed';
  return String(message || 'request failed');
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url) {
  const userAgent = 'PriorCommandCenter-LinkAudit/1.0 (+https://priorworld.com)';

  try {
    let response;
    try {
      response = await fetchWithTimeout(url, {
        method: 'HEAD',
        headers: { 'user-agent': userAgent, accept: '*/*' },
      });
      if (response.status === 405 || response.status === 403) {
        throw new Error(`head_${response.status}`);
      }
    } catch {
      response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml' },
      });
    }

    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      broken: !response.ok,
      reason: response.ok ? null : `http_${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      finalUrl: url,
      broken: true,
      reason: normalizeError(error?.message),
    };
  }
}

let index = 0;
let processed = 0;
const broken = [];

async function worker() {
  while (index < places.length) {
    const current = places[index++];
    const result = await checkUrl(current.website_url);
    processed++;

    if (processed % 250 === 0) {
      console.log(JSON.stringify({ progress: processed, total: places.length }));
    }

    if (result.broken) {
      broken.push({
        article_title: current.article_title,
        article_url: current.article_url,
        business_name: current.business_name,
        website_url: current.website_url,
        reason: result.reason,
        status: result.status,
        final_url: result.finalUrl,
      });
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const byArticle = new Map();
for (const row of broken) {
  const key = `${row.article_title}__${row.article_url || ''}`;
  if (!byArticle.has(key)) {
    byArticle.set(key, {
      article_title: row.article_title,
      article_url: row.article_url,
      broken_count: 0,
      links: [],
    });
  }
  const article = byArticle.get(key);
  article.broken_count += 1;
  article.links.push({
    business_name: row.business_name,
    website_url: row.website_url,
    reason: row.reason,
    status: row.status,
    final_url: row.final_url,
  });
}

const articles = Array.from(byArticle.values())
  .sort((a, b) => b.broken_count - a.broken_count || a.article_title.localeCompare(b.article_title));

const summary = {
  generated_at: new Date().toISOString(),
  scanned: places.length,
  broken_links: broken.length,
  broken_articles: articles.length,
  articles,
};

const jsonPath = path.join(OUTPUT_DIR, 'broken-link-audit.json');
const csvPath = path.join(OUTPUT_DIR, 'broken-link-audit.csv');

writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);

const csvRows = [
  ['article_title', 'article_url', 'broken_count', 'business_name', 'website_url', 'reason', 'status', 'final_url'],
  ...articles.flatMap((article) => article.links.map((link) => [
    article.article_title,
    article.article_url || '',
    String(article.broken_count),
    link.business_name,
    link.website_url,
    link.reason || '',
    link.status == null ? '' : String(link.status),
    link.final_url || '',
  ])),
];

const csv = csvRows
  .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
  .join('\n');

writeFileSync(csvPath, `${csv}\n`);

console.log(JSON.stringify({
  scanned: summary.scanned,
  broken_links: summary.broken_links,
  broken_articles: summary.broken_articles,
  jsonPath,
  csvPath,
  top_articles: articles.slice(0, 20).map((article) => ({
    article_title: article.article_title,
    article_url: article.article_url,
    broken_count: article.broken_count,
  })),
}, null, 2));

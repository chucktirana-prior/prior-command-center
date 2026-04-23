import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db = null;

export function initDb() {
  const dbPath = path.join(__dirname, '..', '..', 'data', 'prior.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  // Migration: add type column to insights if missing (existing DBs)
  try { db.exec('ALTER TABLE insights ADD COLUMN type TEXT DEFAULT "digest"'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE background_jobs ADD COLUMN next_retry_at TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE background_jobs ADD COLUMN payload TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE klaviyo_campaigns ADD COLUMN opens INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE klaviyo_campaigns ADD COLUMN clicks INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE klaviyo_campaigns ADD COLUMN sent_emails INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE klaviyo_campaigns ADD COLUMN delivered_emails INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE klaviyo_campaigns ADD COLUMN delivered_rate REAL'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE klaviyo_campaigns ADD COLUMN unsubscribes INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE klaviyo_campaigns ADD COLUMN unsubscribe_rate REAL'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE klaviyo_campaigns ADD COLUMN bounces INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE klaviyo_campaigns ADD COLUMN metadata_synced_at TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE klaviyo_campaigns ADD COLUMN csv_imported_at TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE klaviyo_campaigns ADD COLUMN metrics_source TEXT DEFAULT "api"'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE klaviyo_campaigns ADD COLUMN match_key TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE ga_pages ADD COLUMN engaged_sessions INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE ga_pages ADD COLUMN active_users INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE ga_pages ADD COLUMN new_users INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE ga_pages ADD COLUMN entrances INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE ga_pages ADD COLUMN landing_page_sessions INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE ga_pages ADD COLUMN key_events REAL'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE ga_pages ADD COLUMN user_engagement_duration REAL'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE ga_traffic ADD COLUMN engaged_sessions INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE ga_traffic ADD COLUMN new_users INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE ga_traffic ADD COLUMN key_events REAL'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE ga_traffic ADD COLUMN user_engagement_duration REAL'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN date_published TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN article_url TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN source_link_text TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN confidence REAL'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN website_check_status TEXT DEFAULT "pending"'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN website_http_status INTEGER'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN website_final_url TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN website_page_title TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN website_signal_summary TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN website_checked_at TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN ai_review_status TEXT DEFAULT "pending"'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN ai_review_confidence REAL'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN ai_review_summary TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN ai_review_recommendation TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN ai_reviewed_at TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE location_places ADD COLUMN source_type TEXT DEFAULT "article"'); } catch { /* already exists */ }

  console.log(`Database initialized at ${dbPath}`);
  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized — call initDb() first');
  return db;
}

// --- Klaviyo ---

export function upsertKlaviyoCampaign(row) {
  const stmt = getDb().prepare(`
    INSERT INTO klaviyo_campaigns
      (id, name, subject, send_time, opens, open_rate, clicks, click_rate, sent_emails, delivered_emails, delivered_rate, unsubscribes, unsubscribe_rate, bounces, bounce_rate, revenue, recipients, synced_at, metadata_synced_at, csv_imported_at, metrics_source, match_key)
    VALUES
      (@id, @name, @subject, @send_time, @opens, @open_rate, @clicks, @click_rate, @sent_emails, @delivered_emails, @delivered_rate, @unsubscribes, @unsubscribe_rate, @bounces, @bounce_rate, @revenue, @recipients, @synced_at, @metadata_synced_at, @csv_imported_at, @metrics_source, @match_key)
    ON CONFLICT(id) DO UPDATE SET
      name = COALESCE(excluded.name, klaviyo_campaigns.name),
      subject = COALESCE(excluded.subject, klaviyo_campaigns.subject),
      send_time = COALESCE(excluded.send_time, klaviyo_campaigns.send_time),
      opens = COALESCE(excluded.opens, klaviyo_campaigns.opens),
      open_rate = COALESCE(excluded.open_rate, klaviyo_campaigns.open_rate),
      clicks = COALESCE(excluded.clicks, klaviyo_campaigns.clicks),
      click_rate = COALESCE(excluded.click_rate, klaviyo_campaigns.click_rate),
      sent_emails = COALESCE(excluded.sent_emails, klaviyo_campaigns.sent_emails),
      delivered_emails = COALESCE(excluded.delivered_emails, klaviyo_campaigns.delivered_emails),
      delivered_rate = COALESCE(excluded.delivered_rate, klaviyo_campaigns.delivered_rate),
      unsubscribes = COALESCE(excluded.unsubscribes, klaviyo_campaigns.unsubscribes),
      unsubscribe_rate = COALESCE(excluded.unsubscribe_rate, klaviyo_campaigns.unsubscribe_rate),
      bounces = COALESCE(excluded.bounces, klaviyo_campaigns.bounces),
      bounce_rate = COALESCE(excluded.bounce_rate, klaviyo_campaigns.bounce_rate),
      revenue = COALESCE(excluded.revenue, klaviyo_campaigns.revenue),
      recipients = COALESCE(excluded.recipients, klaviyo_campaigns.recipients),
      synced_at = COALESCE(excluded.synced_at, klaviyo_campaigns.synced_at),
      metadata_synced_at = COALESCE(excluded.metadata_synced_at, klaviyo_campaigns.metadata_synced_at),
      csv_imported_at = COALESCE(excluded.csv_imported_at, klaviyo_campaigns.csv_imported_at),
      metrics_source = COALESCE(excluded.metrics_source, klaviyo_campaigns.metrics_source),
      match_key = COALESCE(excluded.match_key, klaviyo_campaigns.match_key)
  `);
  return stmt.run(row);
}

export function getKlaviyoCampaigns(startDate, endDate) {
  let sql = 'SELECT * FROM klaviyo_campaigns';
  const params = {};
  if (startDate || endDate) {
    const clauses = [];
    if (startDate) { clauses.push('send_time >= @startDate'); params.startDate = startDate; }
    if (endDate) { clauses.push('send_time <= @endDate'); params.endDate = endDate; }
    sql += ' WHERE ' + clauses.join(' AND ');
  }
  sql += ' ORDER BY send_time DESC';
  return getDb().prepare(sql).all(params);
}

export function getKlaviyoCampaignById(id) {
  return getDb().prepare('SELECT * FROM klaviyo_campaigns WHERE id = ?').get(id);
}

export function getKlaviyoCampaignsForMatching() {
  return getDb().prepare(`
    SELECT id, name, subject, send_time, metadata_synced_at, csv_imported_at, metrics_source
    FROM klaviyo_campaigns
    ORDER BY send_time DESC
  `).all();
}

export function insertKlaviyoImportReview(row) {
  const stmt = getDb().prepare(`
    INSERT INTO klaviyo_import_review
      (imported_at, source_file, campaign_id, campaign_name, subject, send_time, reason, row_data)
    VALUES
      (@imported_at, @source_file, @campaign_id, @campaign_name, @subject, @send_time, @reason, @row_data)
  `);
  return stmt.run(row);
}

export function getRecentKlaviyoImportReview(limit = 50) {
  return getDb().prepare(`
    SELECT * FROM klaviyo_import_review
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);
}

export function getKlaviyoMetricsStatus() {
  return getDb().prepare(`
    SELECT
      COUNT(*) AS total_campaigns,
      COALESCE(SUM(CASE WHEN csv_imported_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS csv_backed_campaigns,
      COALESCE(SUM(CASE WHEN metrics_source = 'api' OR metrics_source = 'mixed' THEN 1 ELSE 0 END), 0) AS api_backed_campaigns,
      MAX(COALESCE(metadata_synced_at, synced_at)) AS last_metadata_sync_at,
      MAX(csv_imported_at) AS last_csv_import_at
    FROM klaviyo_campaigns
  `).get();
}

// --- Google Analytics Pages ---

export function upsertGaPage(row) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO ga_pages
      (page_path, date, page_views, sessions, engaged_sessions, active_users, new_users, entrances, landing_page_sessions, key_events, avg_session_duration, user_engagement_duration, engagement_rate, bounce_rate, synced_at)
    VALUES
      (@page_path, @date, @page_views, @sessions, @engaged_sessions, @active_users, @new_users, @entrances, @landing_page_sessions, @key_events, @avg_session_duration, @user_engagement_duration, @engagement_rate, @bounce_rate, @synced_at)
  `);
  return stmt.run(row);
}

export function getGaPages(startDate, endDate) {
  let sql = 'SELECT * FROM ga_pages';
  const params = {};
  if (startDate || endDate) {
    const clauses = [];
    if (startDate) { clauses.push('date >= @startDate'); params.startDate = startDate; }
    if (endDate) { clauses.push('date <= @endDate'); params.endDate = endDate; }
    sql += ' WHERE ' + clauses.join(' AND ');
  }
  sql += ' ORDER BY date DESC, page_views DESC';
  return getDb().prepare(sql).all(params);
}

// --- Google Analytics Traffic ---

export function upsertGaTraffic(row) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO ga_traffic
      (source, medium, date, sessions, users, engaged_sessions, new_users, key_events, user_engagement_duration, synced_at)
    VALUES
      (@source, @medium, @date, @sessions, @users, @engaged_sessions, @new_users, @key_events, @user_engagement_duration, @synced_at)
  `);
  return stmt.run(row);
}

export function getGaTraffic(startDate, endDate) {
  let sql = 'SELECT * FROM ga_traffic';
  const params = {};
  if (startDate || endDate) {
    const clauses = [];
    if (startDate) { clauses.push('date >= @startDate'); params.startDate = startDate; }
    if (endDate) { clauses.push('date <= @endDate'); params.endDate = endDate; }
    sql += ' WHERE ' + clauses.join(' AND ');
  }
  sql += ' ORDER BY date DESC, sessions DESC';
  return getDb().prepare(sql).all(params);
}

// --- Instagram Posts ---

export function upsertInstagramPost(row) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO instagram_posts
      (id, type, caption, permalink, thumbnail_url, posted_at, likes, comments, saves, shares, reach, impressions, synced_at)
    VALUES
      (@id, @type, @caption, @permalink, @thumbnail_url, @posted_at, @likes, @comments, @saves, @shares, @reach, @impressions, @synced_at)
  `);
  return stmt.run(row);
}

export function getInstagramPosts(startDate, endDate) {
  let sql = 'SELECT * FROM instagram_posts';
  const params = {};
  if (startDate || endDate) {
    const clauses = [];
    if (startDate) { clauses.push('posted_at >= @startDate'); params.startDate = startDate; }
    if (endDate) { clauses.push('posted_at <= @endDate'); params.endDate = endDate; }
    sql += ' WHERE ' + clauses.join(' AND ');
  }
  sql += ' ORDER BY posted_at DESC';
  return getDb().prepare(sql).all(params);
}

// --- Instagram Profile ---

export function upsertInstagramProfile(row) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO instagram_profile
      (date, followers, follows, media_count, synced_at)
    VALUES
      (@date, @followers, @follows, @media_count, @synced_at)
  `);
  return stmt.run(row);
}

export function getInstagramProfile(startDate, endDate) {
  let sql = 'SELECT * FROM instagram_profile';
  const params = {};
  if (startDate || endDate) {
    const clauses = [];
    if (startDate) { clauses.push('date >= @startDate'); params.startDate = startDate; }
    if (endDate) { clauses.push('date <= @endDate'); params.endDate = endDate; }
    sql += ' WHERE ' + clauses.join(' AND ');
  }
  sql += ' ORDER BY date DESC';
  return getDb().prepare(sql).all(params);
}

// --- Sync Log ---

export function logSync({ source, status, records_synced = 0, error_message = null, started_at, completed_at, duration_ms }) {
  const stmt = getDb().prepare(`
    INSERT INTO sync_log (source, status, records_synced, error_message, started_at, completed_at, duration_ms)
    VALUES (@source, @status, @records_synced, @error_message, @started_at, @completed_at, @duration_ms)
  `);
  return stmt.run({ source, status, records_synced, error_message, started_at, completed_at, duration_ms });
}

export function getLastSync(source) {
  return getDb().prepare(
    'SELECT * FROM sync_log WHERE source = ? ORDER BY id DESC LIMIT 1'
  ).get(source);
}

export function getAllLastSyncs() {
  return getDb().prepare(`
    SELECT sl.* FROM sync_log sl
    INNER JOIN (
      SELECT source, MAX(id) as max_id FROM sync_log GROUP BY source
    ) latest ON sl.id = latest.max_id
  `).all();
}

// --- Background Jobs ---

export function insertBackgroundJob(job) {
  const stmt = getDb().prepare(`
    INSERT INTO background_jobs
      (job_key, source, status, progress_pct, processed, total, detail, metrics_refreshed, mode, payload, error_message, next_retry_at, started_at, updated_at, completed_at)
    VALUES
      (@job_key, @source, @status, @progress_pct, @processed, @total, @detail, @metrics_refreshed, @mode, @payload, @error_message, @next_retry_at, @started_at, @updated_at, @completed_at)
  `);
  return stmt.run(job);
}

export function updateBackgroundJob(job) {
  const stmt = getDb().prepare(`
    UPDATE background_jobs
    SET
      status = @status,
      progress_pct = @progress_pct,
      processed = @processed,
      total = @total,
      detail = @detail,
      metrics_refreshed = @metrics_refreshed,
      mode = @mode,
      payload = @payload,
      error_message = @error_message,
      next_retry_at = @next_retry_at,
      updated_at = @updated_at,
      completed_at = @completed_at
    WHERE id = @id
  `);
  return stmt.run(job);
}

export function getLatestBackgroundJob(jobKey) {
  return getDb().prepare(
    'SELECT * FROM background_jobs WHERE job_key = ? ORDER BY id DESC LIMIT 1'
  ).get(jobKey);
}

// --- Insights ---

export function insertInsight({ generated_at, type, headline, highlights, concerns, recommendations, data_points, raw_response }) {
  const stmt = getDb().prepare(`
    INSERT INTO insights (generated_at, type, headline, highlights, concerns, recommendations, data_points, raw_response)
    VALUES (@generated_at, @type, @headline, @highlights, @concerns, @recommendations, @data_points, @raw_response)
  `);
  return stmt.run({ generated_at, type, headline, highlights, concerns, recommendations, data_points, raw_response });
}

export function getLatestInsight(type = null) {
  if (type) {
    return getDb().prepare('SELECT * FROM insights WHERE type = ? ORDER BY id DESC LIMIT 1').get(type);
  }
  return getDb().prepare('SELECT * FROM insights ORDER BY id DESC LIMIT 1').get();
}

export function getRecentInsights(limit = 10) {
  return getDb().prepare('SELECT * FROM insights ORDER BY id DESC LIMIT ?').all(limit);
}

// --- Anomalies ---

export function insertAnomaly({ detected_at, source, metric, current_value, baseline_value, deviation_pct, severity, message }) {
  const stmt = getDb().prepare(`
    INSERT INTO anomalies (detected_at, source, metric, current_value, baseline_value, deviation_pct, severity, message)
    VALUES (@detected_at, @source, @metric, @current_value, @baseline_value, @deviation_pct, @severity, @message)
  `);
  return stmt.run({ detected_at, source, metric, current_value, baseline_value, deviation_pct, severity, message });
}

export function getActiveAnomalies() {
  return getDb().prepare('SELECT * FROM anomalies WHERE dismissed = 0 ORDER BY id DESC').all();
}

export function dismissAnomaly(id) {
  return getDb().prepare('UPDATE anomalies SET dismissed = 1 WHERE id = ?').run(id);
}

// --- Location Monitor ---

export function upsertLocationPlace(row) {
  const existing = getDb().prepare(`
    SELECT id, google_place_id, address, phone, business_status, is_open, check_status, confidence, last_checked_at
    FROM location_places
    WHERE article_id = @article_id AND website_url = @website_url
  `).get(row);

  const payload = {
    ...row,
    source_type: row.source_type ?? 'article',
    google_place_id: existing?.google_place_id ?? null,
    address: existing?.address ?? row.address ?? null,
    phone: existing?.phone ?? row.phone ?? null,
    business_status: existing?.business_status ?? null,
    is_open: existing?.is_open ?? null,
    check_status: existing?.check_status ?? 'pending',
    confidence: existing?.confidence ?? null,
    last_checked_at: existing?.last_checked_at ?? null,
  };

  const stmt = getDb().prepare(`
    INSERT INTO location_places
      (article_id, article_title, article_slug, article_url, date_published, section, business_name, source_link_text, website_url, maps_query, google_place_id, address, phone, business_status, is_open, check_status, confidence, last_checked_at, source_type, first_seen_at, updated_at)
    VALUES
      (@article_id, @article_title, @article_slug, @article_url, @date_published, @section, @business_name, @source_link_text, @website_url, @maps_query, @google_place_id, @address, @phone, @business_status, @is_open, @check_status, @confidence, @last_checked_at, @source_type, @first_seen_at, @updated_at)
    ON CONFLICT(article_id, website_url) DO UPDATE SET
      article_title = excluded.article_title,
      article_slug = excluded.article_slug,
      article_url = excluded.article_url,
      date_published = excluded.date_published,
      section = excluded.section,
      business_name = excluded.business_name,
      source_link_text = excluded.source_link_text,
      maps_query = excluded.maps_query,
      updated_at = excluded.updated_at
  `);
  return stmt.run(payload);
}

export function listLocationPlaces() {
  return getDb().prepare(`
    SELECT lp.*,
      (
        SELECT COUNT(*)
        FROM location_checks lc
        WHERE lc.location_place_id = lp.id
      ) AS checks_count
    FROM location_places lp
    ORDER BY
      CASE
        WHEN lp.check_status = 'closed' THEN 0
        WHEN lp.check_status = 'not_found' THEN 1
        WHEN lp.check_status = 'error' THEN 2
        WHEN lp.check_status = 'open' THEN 3
        ELSE 4
      END,
      lp.updated_at DESC,
      lp.article_title ASC,
      lp.business_name ASC
  `).all();
}

export function getLocationPlaceById(id) {
  return getDb().prepare('SELECT * FROM location_places WHERE id = ?').get(id);
}

export function deleteLocationPlacesByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { changes: 0 };

  const stmt = getDb().prepare(`
    DELETE FROM location_places
    WHERE id IN (${ids.map(() => '?').join(',')})
  `);
  return stmt.run(...ids);
}

export function updateLocationPlaceCheck(row) {
  const stmt = getDb().prepare(`
    UPDATE location_places
    SET
      google_place_id = @google_place_id,
      address = @address,
      phone = @phone,
      business_status = @business_status,
      is_open = @is_open,
      check_status = @check_status,
      confidence = @confidence,
      last_checked_at = @last_checked_at,
      updated_at = @updated_at
    WHERE id = @id
  `);
  return stmt.run(row);
}

export function updateLocationPlaceWebsiteEvidence(row) {
  const stmt = getDb().prepare(`
    UPDATE location_places
    SET
      website_check_status = @website_check_status,
      website_http_status = @website_http_status,
      website_final_url = @website_final_url,
      website_page_title = @website_page_title,
      website_signal_summary = @website_signal_summary,
      website_checked_at = @website_checked_at,
      updated_at = @updated_at
    WHERE id = @id
  `);
  return stmt.run(row);
}

export function insertLocationWebsiteCheck(row) {
  const stmt = getDb().prepare(`
    INSERT INTO location_website_checks
      (location_place_id, checked_at, check_status, http_status, final_url, page_title, signal_summary, closure_signals, redirect_chain, raw_excerpt, error_message)
    VALUES
      (@location_place_id, @checked_at, @check_status, @http_status, @final_url, @page_title, @signal_summary, @closure_signals, @redirect_chain, @raw_excerpt, @error_message)
  `);
  return stmt.run(row);
}

export function updateLocationPlaceAiReview(row) {
  const stmt = getDb().prepare(`
    UPDATE location_places
    SET
      ai_review_status = @ai_review_status,
      ai_review_confidence = @ai_review_confidence,
      ai_review_summary = @ai_review_summary,
      ai_review_recommendation = @ai_review_recommendation,
      ai_reviewed_at = @ai_reviewed_at,
      updated_at = @updated_at
    WHERE id = @id
  `);
  return stmt.run(row);
}

export function insertLocationAiReview(row) {
  const stmt = getDb().prepare(`
    INSERT INTO location_ai_reviews
      (location_place_id, reviewed_at, review_status, confidence, summary, recommendation, evidence_snapshot, raw_response, error_message)
    VALUES
      (@location_place_id, @reviewed_at, @review_status, @confidence, @summary, @recommendation, @evidence_snapshot, @raw_response, @error_message)
  `);
  return stmt.run(row);
}

export function insertLocationCheck(row) {
  const stmt = getDb().prepare(`
    INSERT INTO location_checks
      (location_place_id, checked_at, check_status, business_status, is_open, confidence, place_id, address, phone, raw_response, error_message)
    VALUES
      (@location_place_id, @checked_at, @check_status, @business_status, @is_open, @confidence, @place_id, @address, @phone, @raw_response, @error_message)
  `);
  return stmt.run(row);
}

export function getRecentLocationChecks(limit = 50) {
  return getDb().prepare(`
    SELECT lc.*, lp.business_name, lp.article_title, lp.website_url
    FROM location_checks lc
    INNER JOIN location_places lp ON lp.id = lc.location_place_id
    ORDER BY lc.id DESC
    LIMIT ?
  `).all(limit);
}

export function getRecentLocationWebsiteChecks(limit = 25) {
  return getDb().prepare(`
    SELECT lwc.*, lp.business_name, lp.article_title, lp.website_url
    FROM location_website_checks lwc
    INNER JOIN location_places lp ON lp.id = lwc.location_place_id
    ORDER BY lwc.id DESC
    LIMIT ?
  `).all(limit);
}

export function getRecentLocationAiReviews(limit = 25) {
  return getDb().prepare(`
    SELECT lar.*, lp.business_name, lp.article_title, lp.website_url
    FROM location_ai_reviews lar
    INNER JOIN location_places lp ON lp.id = lar.location_place_id
    ORDER BY lar.id DESC
    LIMIT ?
  `).all(limit);
}

export function getLocationArticleRollups(limit = 25) {
  return getDb().prepare(`
    SELECT
      article_id,
      article_title,
      article_slug,
      article_url,
      COUNT(*) AS total_places,
      COALESCE(SUM(CASE WHEN website_check_status IN ('suspect', 'error', 'dead') THEN 1 ELSE 0 END), 0) AS website_at_risk_count,
      COALESCE(SUM(CASE WHEN ai_review_status IN ('likely_changed', 'likely_closed', 'needs_review') THEN 1 ELSE 0 END), 0) AS ai_at_risk_count,
      MAX(updated_at) AS updated_at,
      MAX(website_checked_at) AS website_checked_at,
      MAX(ai_reviewed_at) AS ai_reviewed_at
    FROM location_places
    GROUP BY article_id, article_title, article_slug, article_url
    HAVING COUNT(*) > 0
    ORDER BY
      (COALESCE(SUM(CASE WHEN website_check_status IN ('suspect', 'error', 'dead') THEN 1 ELSE 0 END), 0)
       + COALESCE(SUM(CASE WHEN ai_review_status IN ('likely_changed', 'likely_closed', 'needs_review') THEN 1 ELSE 0 END), 0)) DESC,
      total_places DESC,
      article_title ASC
    LIMIT ?
  `).all(limit);
}

export function getLocationMonitorSummary() {
  return getDb().prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN check_status = 'open' THEN 1 ELSE 0 END), 0) AS open_count,
      COALESCE(SUM(CASE WHEN check_status = 'closed' THEN 1 ELSE 0 END), 0) AS closed_count,
      COALESCE(SUM(CASE WHEN check_status = 'not_found' THEN 1 ELSE 0 END), 0) AS not_found_count,
      COALESCE(SUM(CASE WHEN check_status = 'error' THEN 1 ELSE 0 END), 0) AS error_count,
      COALESCE(SUM(CASE WHEN check_status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
      COALESCE(SUM(CASE WHEN website_check_status = 'active' THEN 1 ELSE 0 END), 0) AS website_active_count,
      COALESCE(SUM(CASE WHEN website_check_status = 'suspect' THEN 1 ELSE 0 END), 0) AS website_suspect_count,
      COALESCE(SUM(CASE WHEN website_check_status = 'error' THEN 1 ELSE 0 END), 0) AS website_error_count,
      COALESCE(SUM(CASE WHEN ai_review_status = 'likely_active' THEN 1 ELSE 0 END), 0) AS ai_active_count,
      COALESCE(SUM(CASE WHEN ai_review_status = 'likely_changed' THEN 1 ELSE 0 END), 0) AS ai_changed_count,
      COALESCE(SUM(CASE WHEN ai_review_status = 'likely_closed' THEN 1 ELSE 0 END), 0) AS ai_closed_count,
      COALESCE(SUM(CASE WHEN ai_review_status = 'needs_review' THEN 1 ELSE 0 END), 0) AS ai_needs_review_count,
      MAX(updated_at) AS last_import_at,
      MAX(last_checked_at) AS last_checked_at,
      MAX(website_checked_at) AS website_checked_at,
      MAX(ai_reviewed_at) AS ai_reviewed_at
    FROM location_places
  `).get();
}

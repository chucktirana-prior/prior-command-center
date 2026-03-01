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
    INSERT OR REPLACE INTO klaviyo_campaigns
      (id, name, subject, send_time, open_rate, click_rate, bounce_rate, revenue, recipients, synced_at)
    VALUES
      (@id, @name, @subject, @send_time, @open_rate, @click_rate, @bounce_rate, @revenue, @recipients, @synced_at)
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

// --- Google Analytics Pages ---

export function upsertGaPage(row) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO ga_pages
      (page_path, date, page_views, sessions, avg_session_duration, engagement_rate, bounce_rate, synced_at)
    VALUES
      (@page_path, @date, @page_views, @sessions, @avg_session_duration, @engagement_rate, @bounce_rate, @synced_at)
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
      (source, medium, date, sessions, users, synced_at)
    VALUES
      (@source, @medium, @date, @sessions, @users, @synced_at)
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

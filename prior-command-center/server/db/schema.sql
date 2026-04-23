-- Klaviyo campaigns
CREATE TABLE IF NOT EXISTS klaviyo_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT,
  subject TEXT,
  send_time TEXT,
  opens INTEGER,
  open_rate REAL,
  clicks INTEGER,
  click_rate REAL,
  sent_emails INTEGER,
  delivered_emails INTEGER,
  delivered_rate REAL,
  unsubscribes INTEGER,
  unsubscribe_rate REAL,
  bounces INTEGER,
  bounce_rate REAL,
  revenue REAL,
  recipients INTEGER,
  synced_at TEXT,
  metadata_synced_at TEXT,
  csv_imported_at TEXT,
  metrics_source TEXT DEFAULT 'api',
  match_key TEXT
);

CREATE TABLE IF NOT EXISTS klaviyo_import_review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imported_at TEXT NOT NULL,
  source_file TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  subject TEXT,
  send_time TEXT,
  reason TEXT NOT NULL,
  row_data TEXT NOT NULL
);

-- Google Analytics page metrics
CREATE TABLE IF NOT EXISTS ga_pages (
  page_path TEXT NOT NULL,
  date TEXT NOT NULL,
  page_views INTEGER,
  sessions INTEGER,
  engaged_sessions INTEGER,
  active_users INTEGER,
  new_users INTEGER,
  entrances INTEGER,
  landing_page_sessions INTEGER,
  key_events REAL,
  avg_session_duration REAL,
  user_engagement_duration REAL,
  engagement_rate REAL,
  bounce_rate REAL,
  synced_at TEXT,
  PRIMARY KEY (page_path, date)
);

-- Google Analytics traffic sources
CREATE TABLE IF NOT EXISTS ga_traffic (
  source TEXT NOT NULL,
  medium TEXT NOT NULL,
  date TEXT NOT NULL,
  sessions INTEGER,
  users INTEGER,
  engaged_sessions INTEGER,
  new_users INTEGER,
  key_events REAL,
  user_engagement_duration REAL,
  synced_at TEXT,
  PRIMARY KEY (source, medium, date)
);

-- Instagram posts
CREATE TABLE IF NOT EXISTS instagram_posts (
  id TEXT PRIMARY KEY,
  type TEXT,
  caption TEXT,
  permalink TEXT,
  thumbnail_url TEXT,
  posted_at TEXT,
  likes INTEGER,
  comments INTEGER,
  saves INTEGER,
  shares INTEGER,
  reach INTEGER,
  impressions INTEGER,
  synced_at TEXT
);

-- Instagram profile snapshots
CREATE TABLE IF NOT EXISTS instagram_profile (
  date TEXT PRIMARY KEY,
  followers INTEGER,
  follows INTEGER,
  media_count INTEGER,
  synced_at TEXT
);

-- Sync log for tracking every sync attempt
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER
);

-- Background jobs for resumable tasks
CREATE TABLE IF NOT EXISTS background_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_key TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_pct INTEGER DEFAULT 0,
  processed INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  detail TEXT,
  metrics_refreshed INTEGER DEFAULT 0,
  mode TEXT,
  payload TEXT,
  error_message TEXT,
  next_retry_at TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

-- Intelligence engine insights
CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generated_at TEXT,
  type TEXT DEFAULT 'digest',
  headline TEXT,
  highlights TEXT,
  concerns TEXT,
  recommendations TEXT,
  data_points TEXT,
  raw_response TEXT
);

-- Anomaly detection results
CREATE TABLE IF NOT EXISTS anomalies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  detected_at TEXT NOT NULL,
  source TEXT NOT NULL,
  metric TEXT NOT NULL,
  current_value REAL,
  baseline_value REAL,
  deviation_pct REAL,
  severity TEXT NOT NULL,
  message TEXT,
  dismissed INTEGER DEFAULT 0
);

-- Location monitor imported businesses
CREATE TABLE IF NOT EXISTS location_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT,
  article_title TEXT NOT NULL,
  article_slug TEXT,
  article_url TEXT,
  date_published TEXT,
  section TEXT,
  business_name TEXT NOT NULL,
  source_link_text TEXT,
  website_url TEXT NOT NULL,
  google_place_id TEXT,
  maps_query TEXT,
  address TEXT,
  phone TEXT,
  business_status TEXT,
  is_open INTEGER,
  check_status TEXT DEFAULT 'pending',
  confidence REAL,
  last_checked_at TEXT,
  website_check_status TEXT DEFAULT 'pending',
  website_http_status INTEGER,
  website_final_url TEXT,
  website_page_title TEXT,
  website_signal_summary TEXT,
  website_checked_at TEXT,
  ai_review_status TEXT DEFAULT 'pending',
  ai_review_confidence REAL,
  ai_review_summary TEXT,
  ai_review_recommendation TEXT,
  ai_reviewed_at TEXT,
  source_type TEXT DEFAULT 'article',
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(article_id, website_url)
);

CREATE TABLE IF NOT EXISTS location_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_place_id INTEGER NOT NULL,
  checked_at TEXT NOT NULL,
  check_status TEXT NOT NULL,
  business_status TEXT,
  is_open INTEGER,
  confidence REAL,
  place_id TEXT,
  address TEXT,
  phone TEXT,
  raw_response TEXT,
  error_message TEXT,
  FOREIGN KEY (location_place_id) REFERENCES location_places(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS location_website_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_place_id INTEGER NOT NULL,
  checked_at TEXT NOT NULL,
  check_status TEXT NOT NULL,
  http_status INTEGER,
  final_url TEXT,
  page_title TEXT,
  signal_summary TEXT,
  closure_signals TEXT,
  redirect_chain TEXT,
  raw_excerpt TEXT,
  error_message TEXT,
  FOREIGN KEY (location_place_id) REFERENCES location_places(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS location_ai_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_place_id INTEGER NOT NULL,
  reviewed_at TEXT NOT NULL,
  review_status TEXT NOT NULL,
  confidence REAL,
  summary TEXT,
  recommendation TEXT,
  evidence_snapshot TEXT,
  raw_response TEXT,
  error_message TEXT,
  FOREIGN KEY (location_place_id) REFERENCES location_places(id) ON DELETE CASCADE
);

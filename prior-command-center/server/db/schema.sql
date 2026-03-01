-- Klaviyo campaigns
CREATE TABLE IF NOT EXISTS klaviyo_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT,
  subject TEXT,
  send_time TEXT,
  open_rate REAL,
  click_rate REAL,
  bounce_rate REAL,
  revenue REAL,
  recipients INTEGER,
  synced_at TEXT
);

-- Google Analytics page metrics
CREATE TABLE IF NOT EXISTS ga_pages (
  page_path TEXT NOT NULL,
  date TEXT NOT NULL,
  page_views INTEGER,
  sessions INTEGER,
  avg_session_duration REAL,
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

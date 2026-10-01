-- B-Atlas Cloudflare persistence schema
-- State remains JSON-shaped to mirror the local .bscout-data/community-state.json workflow.
CREATE TABLE IF NOT EXISTS bscout_state (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bscout_rate_events (
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bscout_rate_events_hash_time
  ON bscout_rate_events(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS share_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '我的分享',
  headline TEXT,
  category_ids TEXT,
  excluded_todo_ids TEXT NOT NULL DEFAULT '[]',
  statuses TEXT NOT NULL DEFAULT '["pending","in_progress","completed"]',
  date_field TEXT NOT NULL DEFAULT 'created_at',
  date_start TEXT,
  date_end TEXT,
  expires_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_share_links_key ON share_links(key);
CREATE INDEX IF NOT EXISTS idx_share_links_user_id ON share_links(user_id);

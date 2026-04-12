CREATE TABLE IF NOT EXISTS bookmark_share_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '我的书签分享',
  headline TEXT,
  category_ids TEXT,
  excluded_bookmark_ids TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TEXT,
  theme TEXT NOT NULL DEFAULT 'light',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bm_share_links_key ON bookmark_share_links(key);
CREATE INDEX IF NOT EXISTS idx_bm_share_links_user_id ON bookmark_share_links(user_id);

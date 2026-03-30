-- Bookmark categories (two-level: parent_id NULL = top-level)
CREATE TABLE IF NOT EXISTS bookmark_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  color      TEXT    NOT NULL DEFAULT '#6366f1',
  icon       TEXT,
  parent_id  INTEGER REFERENCES bookmark_categories(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bm_cats_user ON bookmark_categories(user_id);

-- Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES bookmark_categories(id) ON DELETE SET NULL,
  title       TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  description TEXT,
  favicon     TEXT,
  tags        TEXT    NOT NULL DEFAULT '[]',  -- JSON array of strings
  is_pinned   INTEGER NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user     ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id);

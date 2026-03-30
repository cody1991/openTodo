const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { category_id, search, pinned } = req.query;

  let sql = `
    SELECT b.*, bc.name as category_name, bc.color as category_color
    FROM bookmarks b
    LEFT JOIN bookmark_categories bc ON b.category_id = bc.id
    WHERE b.user_id = ?
  `;
  const params = [req.user.id];

  if (category_id) { sql += ' AND b.category_id = ?'; params.push(category_id); }
  if (pinned === 'true') { sql += ' AND b.is_pinned = 1'; }
  if (search) {
    sql += ' AND (b.title LIKE ? OR b.url LIKE ? OR b.description LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  sql += ' ORDER BY b.is_pinned DESC, b.created_at DESC';

  const bookmarks = db.prepare(sql).all(...params).map((bm) => ({
    ...bm,
    tags: JSON.parse(bm.tags || '[]'),
  }));

  res.json({ bookmarks });
});

router.get('/:id', (req, res) => {
  const bm = db
    .prepare(
      `SELECT b.*, bc.name as category_name, bc.color as category_color
       FROM bookmarks b
       LEFT JOIN bookmark_categories bc ON b.category_id = bc.id
       WHERE b.id = ? AND b.user_id = ?`
    )
    .get(req.params.id, req.user.id);
  if (!bm) return res.status(404).json({ message: 'Not found' });
  bm.tags = JSON.parse(bm.tags || '[]');
  res.json({ bookmark: bm });
});

router.post('/', (req, res) => {
  const { title, url, description, favicon, category_id, tags = [], is_pinned = false } = req.body;
  if (!title || !url) return res.status(400).json({ message: 'Title and URL are required' });

  const result = db
    .prepare(
      `INSERT INTO bookmarks (user_id, category_id, title, url, description, favicon, tags, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      category_id || null,
      title,
      url,
      description || null,
      favicon || null,
      JSON.stringify(tags),
      is_pinned ? 1 : 0
    );

  const bm = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(result.lastInsertRowid);
  bm.tags = JSON.parse(bm.tags);
  res.status(201).json({ bookmark: bm });
});

router.put('/:id', (req, res) => {
  const bm = db
    .prepare('SELECT * FROM bookmarks WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!bm) return res.status(404).json({ message: 'Not found' });

  const { title, url, description, favicon, category_id, tags, is_pinned } = req.body;
  db.prepare(
    `UPDATE bookmarks SET
       title       = COALESCE(?, title),
       url         = COALESCE(?, url),
       description = COALESCE(?, description),
       favicon     = COALESCE(?, favicon),
       category_id = ?,
       tags        = COALESCE(?, tags),
       is_pinned   = COALESCE(?, is_pinned),
       updated_at  = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    title, url, description, favicon,
    category_id !== undefined ? (category_id || null) : bm.category_id,
    tags !== undefined ? JSON.stringify(tags) : null,
    is_pinned !== undefined ? (is_pinned ? 1 : 0) : null,
    bm.id
  );

  const updated = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(bm.id);
  updated.tags = JSON.parse(updated.tags);
  res.json({ bookmark: updated });
});

router.delete('/:id', (req, res) => {
  const bm = db
    .prepare('SELECT id FROM bookmarks WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!bm) return res.status(404).json({ message: 'Not found' });
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(bm.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;

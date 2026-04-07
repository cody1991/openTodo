const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// List all share links for the current user
router.get('/', (req, res) => {
  const links = db
    .prepare(
      `SELECT sl.*, u.username as owner_username, u.avatar as owner_avatar
       FROM share_links sl
       JOIN users u ON sl.user_id = u.id
       WHERE sl.user_id = ?
       ORDER BY sl.created_at DESC`
    )
    .all(req.user.id);

  const parsed = links.map((l) => ({
    ...l,
    category_ids: l.category_ids ? JSON.parse(l.category_ids) : null,
    excluded_todo_ids: JSON.parse(l.excluded_todo_ids || '[]'),
    statuses: JSON.parse(l.statuses || '[]'),
  }));
  res.json(parsed);
});

// Create a new share link
router.post('/', (req, res) => {
  const {
    name = '我的分享',
    headline,
    category_ids,
    excluded_todo_ids = [],
    statuses = ['pending', 'in_progress', 'completed'],
    date_field = 'created_at',
    date_start,
    date_end,
    expires_in,
    theme = 'light',
  } = req.body;

  const key = uuidv4().replace(/-/g, '').slice(0, 16);

  let expires_at = null;
  if (expires_in && expires_in !== 'never') {
    const ms = {
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      '180d': 180 * 24 * 60 * 60 * 1000,
      '365d': 365 * 24 * 60 * 60 * 1000,
    }[expires_in];
    if (ms) {
      expires_at = new Date(Date.now() + ms).toISOString();
    }
  }

  const stmt = db.prepare(`
    INSERT INTO share_links
      (user_id, key, name, headline, category_ids, excluded_todo_ids, statuses, date_field, date_start, date_end, expires_at, theme)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    req.user.id,
    key,
    name,
    headline || null,
    category_ids ? JSON.stringify(category_ids) : null,
    JSON.stringify(excluded_todo_ids),
    JSON.stringify(statuses),
    date_field,
    date_start || null,
    date_end || null,
    expires_at,
    theme
  );

  const link = db.prepare('SELECT * FROM share_links WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({
    ...link,
    category_ids: link.category_ids ? JSON.parse(link.category_ids) : null,
    excluded_todo_ids: JSON.parse(link.excluded_todo_ids),
    statuses: JSON.parse(link.statuses),
  });
});

// Update a share link
router.put('/:id', (req, res) => {
  const link = db
    .prepare('SELECT * FROM share_links WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!link) return res.status(404).json({ message: req.t('share.notFound') });

  const {
    name,
    headline,
    category_ids,
    excluded_todo_ids,
    statuses,
    date_field,
    date_start,
    date_end,
    expires_in,
    theme,
  } = req.body;

  let expires_at = link.expires_at;
  if (expires_in !== undefined) {
    if (!expires_in || expires_in === 'never') {
      expires_at = null;
    } else {
      const ms = {
        '30m': 30 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000,
        '180d': 180 * 24 * 60 * 60 * 1000,
        '365d': 365 * 24 * 60 * 60 * 1000,
      }[expires_in];
      if (ms) expires_at = new Date(Date.now() + ms).toISOString();
    }
  }

  db.prepare(`
    UPDATE share_links SET
      name = ?, headline = ?, category_ids = ?, excluded_todo_ids = ?,
      statuses = ?, date_field = ?, date_start = ?, date_end = ?,
      expires_at = ?, theme = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(
    name ?? link.name,
    headline !== undefined ? headline : link.headline,
    category_ids !== undefined ? (category_ids ? JSON.stringify(category_ids) : null) : link.category_ids,
    excluded_todo_ids !== undefined ? JSON.stringify(excluded_todo_ids) : link.excluded_todo_ids,
    statuses !== undefined ? JSON.stringify(statuses) : link.statuses,
    date_field ?? link.date_field,
    date_start !== undefined ? date_start : link.date_start,
    date_end !== undefined ? date_end : link.date_end,
    expires_at,
    theme !== undefined ? theme : link.theme,
    req.params.id,
    req.user.id
  );

  const updated = db.prepare('SELECT * FROM share_links WHERE id = ?').get(req.params.id);
  res.json({
    ...updated,
    category_ids: updated.category_ids ? JSON.parse(updated.category_ids) : null,
    excluded_todo_ids: JSON.parse(updated.excluded_todo_ids),
    statuses: JSON.parse(updated.statuses),
  });
});

// Delete a share link
router.delete('/:id', (req, res) => {
  const link = db
    .prepare('SELECT * FROM share_links WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!link) return res.status(404).json({ message: req.t('share.notFound') });

  db.prepare('DELETE FROM share_links WHERE id = ?').run(req.params.id);
  res.json({ message: req.t('share.deleted') });
});

module.exports = router;

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const links = db
    .prepare(
      `SELECT bsl.*, u.username as owner_username, u.avatar as owner_avatar
       FROM bookmark_share_links bsl
       JOIN users u ON bsl.user_id = u.id
       WHERE bsl.user_id = ?
       ORDER BY bsl.created_at DESC`
    )
    .all(req.user.id);

  const parsed = links.map((l) => ({
    ...l,
    category_ids: l.category_ids ? JSON.parse(l.category_ids) : null,
    excluded_bookmark_ids: JSON.parse(l.excluded_bookmark_ids || '[]'),
  }));
  res.json(parsed);
});

router.post('/', (req, res) => {
  const {
    name = '我的书签分享',
    headline,
    category_ids,
    excluded_bookmark_ids = [],
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
    INSERT INTO bookmark_share_links
      (user_id, key, name, headline, category_ids, excluded_bookmark_ids, expires_at, theme)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    req.user.id,
    key,
    name,
    headline || null,
    category_ids ? JSON.stringify(category_ids) : null,
    JSON.stringify(excluded_bookmark_ids),
    expires_at,
    theme
  );

  const link = db.prepare('SELECT * FROM bookmark_share_links WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({
    ...link,
    category_ids: link.category_ids ? JSON.parse(link.category_ids) : null,
    excluded_bookmark_ids: JSON.parse(link.excluded_bookmark_ids),
  });
});

router.put('/:id', (req, res) => {
  const link = db
    .prepare('SELECT * FROM bookmark_share_links WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!link) return res.status(404).json({ message: req.t('share.notFound') });

  const {
    name,
    headline,
    category_ids,
    excluded_bookmark_ids,
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
    UPDATE bookmark_share_links SET
      name = ?, headline = ?, category_ids = ?, excluded_bookmark_ids = ?,
      expires_at = ?, theme = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(
    name ?? link.name,
    headline !== undefined ? headline : link.headline,
    category_ids !== undefined ? (category_ids ? JSON.stringify(category_ids) : null) : link.category_ids,
    excluded_bookmark_ids !== undefined ? JSON.stringify(excluded_bookmark_ids) : link.excluded_bookmark_ids,
    expires_at,
    theme !== undefined ? theme : link.theme,
    req.params.id,
    req.user.id
  );

  const updated = db.prepare('SELECT * FROM bookmark_share_links WHERE id = ?').get(req.params.id);
  res.json({
    ...updated,
    category_ids: updated.category_ids ? JSON.parse(updated.category_ids) : null,
    excluded_bookmark_ids: JSON.parse(updated.excluded_bookmark_ids),
  });
});

router.delete('/:id', (req, res) => {
  const link = db
    .prepare('SELECT * FROM bookmark_share_links WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!link) return res.status(404).json({ message: req.t('share.notFound') });

  db.prepare('DELETE FROM bookmark_share_links WHERE id = ?').run(req.params.id);
  res.json({ message: req.t('share.deleted') });
});

module.exports = router;

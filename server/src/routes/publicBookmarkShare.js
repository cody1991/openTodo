const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/:key', (req, res) => {
  const { key } = req.params;

  const link = db.prepare('SELECT * FROM bookmark_share_links WHERE key = ?').get(key);
  if (!link) return res.status(404).json({ message: req.t('share.notFound') });

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return res.status(410).json({ message: req.t('share.expired') });
  }

  const owner = db
    .prepare('SELECT id, username, avatar FROM users WHERE id = ?')
    .get(link.user_id);

  const categoryIds = link.category_ids ? JSON.parse(link.category_ids) : null;
  const excludedIds = JSON.parse(link.excluded_bookmark_ids || '[]');

  let sql = `
    SELECT b.*, bc.name as category_name, bc.color as category_color
    FROM bookmarks b
    LEFT JOIN bookmark_categories bc ON b.category_id = bc.id
    WHERE b.user_id = ?
  `;
  const params = [link.user_id];

  if (categoryIds !== null && categoryIds.length > 0) {
    const includeUncategorized = categoryIds.includes(-1);
    const realIds = categoryIds.filter((id) => id !== -1);

    const allCatIds = new Set(realIds);
    if (realIds.length > 0) {
      const subs = db
        .prepare(`SELECT id FROM bookmark_categories WHERE parent_id IN (${realIds.map(() => '?').join(',')})`)
        .all(...realIds);
      subs.forEach((s) => allCatIds.add(s.id));
    }
    const expanded = [...allCatIds];

    if (expanded.length > 0 && includeUncategorized) {
      sql += ` AND (b.category_id IN (${expanded.map(() => '?').join(',')}) OR b.category_id IS NULL)`;
      params.push(...expanded);
    } else if (expanded.length > 0) {
      sql += ` AND b.category_id IN (${expanded.map(() => '?').join(',')})`;
      params.push(...expanded);
    } else if (includeUncategorized) {
      sql += ` AND b.category_id IS NULL`;
    }
  }

  if (excludedIds.length > 0) {
    sql += ` AND b.id NOT IN (${excludedIds.map(() => '?').join(',')})`;
    params.push(...excludedIds);
  }

  sql += ` ORDER BY b.is_pinned DESC, b.created_at DESC`;

  const bookmarks = db.prepare(sql).all(...params).map((bm) => ({
    ...bm,
    tags: JSON.parse(bm.tags || '[]'),
  }));

  const categories = db
    .prepare(
      `SELECT bc.*, pbc.name as parent_name
       FROM bookmark_categories bc
       LEFT JOIN bookmark_categories pbc ON bc.parent_id = pbc.id
       WHERE bc.user_id = ?
       ORDER BY bc.sort_order`
    )
    .all(link.user_id);

  res.json({
    share: {
      key: link.key,
      name: link.name,
      headline: link.headline,
      expires_at: link.expires_at,
      view_count: link.view_count,
      created_at: link.created_at,
      theme: link.theme || 'light',
    },
    owner: {
      username: owner.username,
      avatar: owner.avatar,
    },
    bookmarks,
    categories,
  });
});

router.post('/:key/view', (req, res) => {
  const { key } = req.params;
  const link = db.prepare('SELECT id FROM bookmark_share_links WHERE key = ?').get(key);
  if (!link) return res.status(404).json({ message: req.t('share.notFound') });

  db.prepare(
    `UPDATE bookmark_share_links SET view_count = view_count + 1, last_viewed_at = datetime('now') WHERE key = ?`
  ).run(key);

  const { view_count } = db.prepare('SELECT view_count FROM bookmark_share_links WHERE key = ?').get(key);
  res.json({ view_count });
});

module.exports = router;

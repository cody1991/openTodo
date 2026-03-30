const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/:key', (req, res) => {
  const { key } = req.params;

  const link = db.prepare('SELECT * FROM share_links WHERE key = ?').get(key);
  if (!link) return res.status(404).json({ message: '分享链接不存在' });

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return res.status(410).json({ message: '该分享链接已过期' });
  }

  // Get owner info
  const owner = db
    .prepare('SELECT id, username, avatar FROM users WHERE id = ?')
    .get(link.user_id);

  // Build todos query
  const categoryIds = link.category_ids ? JSON.parse(link.category_ids) : null;
  const excludedIds = JSON.parse(link.excluded_todo_ids || '[]');
  const statuses = JSON.parse(link.statuses || '["pending","in_progress","completed"]');

  let sql = `
    SELECT DISTINCT t.*,
           c.name as category_name, c.color as category_color,
           c.icon as category_icon,
           pc.name as parent_category_name
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE t.user_id = ?
  `;
  const params = [link.user_id];

  if (statuses.length > 0) {
    sql += ` AND t.status IN (${statuses.map(() => '?').join(',')})`;
    params.push(...statuses);
  }

  if (categoryIds !== null && categoryIds.length > 0) {
    const includeUncategorized = categoryIds.includes(-1);
    const realIds = categoryIds.filter((id) => id !== -1);

    // Expand real category IDs to include their subcategories
    const allCatIds = new Set(realIds);
    if (realIds.length > 0) {
      const subs = db
        .prepare(`SELECT id FROM categories WHERE parent_id IN (${realIds.map(() => '?').join(',')})`)
        .all(...realIds);
      subs.forEach((s) => allCatIds.add(s.id));
    }
    const expanded = [...allCatIds];

    if (expanded.length > 0 && includeUncategorized) {
      sql += ` AND (t.category_id IN (${expanded.map(() => '?').join(',')}) OR t.category_id IS NULL)`;
      params.push(...expanded);
    } else if (expanded.length > 0) {
      sql += ` AND t.category_id IN (${expanded.map(() => '?').join(',')})`;
      params.push(...expanded);
    } else if (includeUncategorized) {
      sql += ` AND t.category_id IS NULL`;
    }
  }

  if (excludedIds.length > 0) {
    sql += ` AND t.id NOT IN (${excludedIds.map(() => '?').join(',')})`;
    params.push(...excludedIds);
  }

  const dateField = ['created_at', 'updated_at', 'completed_at', 'due_date'].includes(link.date_field)
    ? link.date_field
    : 'created_at';

  if (link.date_start) {
    sql += ` AND t.${dateField} >= ?`;
    params.push(link.date_start);
  }
  if (link.date_end) {
    sql += ` AND t.${dateField} <= ?`;
    params.push(link.date_end + ' 23:59:59');
  }

  sql += ` ORDER BY t.priority DESC, t.created_at DESC`;

  const todos = db.prepare(sql).all(...params);

  // Attach tags
  const todosWithTags = todos.map((todo) => {
    const tags = db
      .prepare(
        `SELECT t.* FROM tags t
         JOIN todo_tags tt ON tt.tag_id = t.id
         WHERE tt.todo_id = ?`
      )
      .all(todo.id);
    return { ...todo, tags };
  });

  // Get categories summary for sidebar
  const categories = db
    .prepare(
      `SELECT c.*, pc.name as parent_name,
              (SELECT COUNT(*) FROM todos t2 WHERE t2.category_id = c.id AND t2.user_id = ?) as todo_count
       FROM categories c
       LEFT JOIN categories pc ON c.parent_id = pc.id
       WHERE c.user_id = ?
       ORDER BY c.sort_order`
    )
    .all(link.user_id, link.user_id);

  // Increment view count
  db.prepare(
    `UPDATE share_links SET view_count = view_count + 1, last_viewed_at = datetime('now') WHERE key = ?`
  ).run(key);

  res.json({
    share: {
      key: link.key,
      name: link.name,
      headline: link.headline,
      expires_at: link.expires_at,
      view_count: link.view_count + 1,
      created_at: link.created_at,
    },
    owner: {
      username: owner.username,
      avatar: owner.avatar,
    },
    todos: todosWithTags,
    categories,
    statuses,
  });
});

module.exports = router;

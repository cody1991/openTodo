const express = require('express');
const db = require('../db');
const { validateCategoryOwnership, validateTagsOwnership } = require('../services/todoService');
const { rateLimitShareRequest } = require('../middleware/rateLimitShareRequest');
const { notifyNewShareRequestAsync } = require('../services/shareRequestNotify');

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
    .prepare('SELECT id, username, avatar, timezone FROM users WHERE id = ?')
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

  // Attach tags (batch query to avoid N+1)
  const tagMap = {};
  if (todos.length > 0) {
    const todoIds = todos.map((t) => t.id);
    const placeholders = todoIds.map(() => '?').join(',');
    const allTags = db
      .prepare(
        `SELECT tt.todo_id, t.* FROM tags t
         JOIN todo_tags tt ON tt.tag_id = t.id
         WHERE tt.todo_id IN (${placeholders})`
      )
      .all(...todoIds);
    allTags.forEach(({ todo_id, ...tag }) => {
      if (!tagMap[todo_id]) tagMap[todo_id] = [];
      tagMap[todo_id].push(tag);
    });
  }
  const todosWithTags = todos.map((todo) => ({ ...todo, tags: tagMap[todo.id] || [] }));

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

  const tags = db
    .prepare('SELECT id, name, color FROM tags WHERE user_id = ? ORDER BY name')
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
      timezone: owner.timezone || 'UTC',
    },
    todos: todosWithTags,
    categories,
    tags,
    statuses,
  });
});

router.post('/:key/requests', rateLimitShareRequest, (req, res) => {
  const { key } = req.params;
  const link = db.prepare('SELECT * FROM share_links WHERE key = ?').get(key);
  if (!link) return res.status(404).json({ message: '分享链接不存在' });

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return res.status(410).json({ message: '该分享链接已过期' });
  }

  const ownerId = link.user_id;
  const {
    title,
    content = '',
    priority = 'medium',
    due_date = null,
    category_id = null,
    tag_ids = [],
    contact = null,
  } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ message: '请填写标题' });
  }
  if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
    return res.status(400).json({ message: '无效的优先级' });
  }

  const ids = Array.isArray(tag_ids)
    ? tag_ids.map((x) => parseInt(x, 10)).filter((x) => !Number.isNaN(x))
    : [];

  if (!validateCategoryOwnership(category_id, ownerId)) {
    return res.status(400).json({ message: '分类无效' });
  }
  if (!validateTagsOwnership(ids, ownerId)) {
    return res.status(400).json({ message: '标签无效' });
  }

  const contactStr = contact != null ? String(contact).slice(0, 200) : null;

  const result = db
    .prepare(
      `INSERT INTO share_requests (share_link_id, title, content, category_id, priority, due_date, tag_ids, contact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      link.id,
      String(title).trim(),
      String(content || ''),
      category_id || null,
      priority,
      due_date || null,
      JSON.stringify(ids),
      contactStr
    );

  notifyNewShareRequestAsync({
    ownerId,
    shareLinkName: link.name,
    title: String(title).trim(),
    priority,
    content: String(content || ''),
    contact: contactStr,
  });

  res.status(201).json({
    id: result.lastInsertRowid,
    message: '已提交',
  });
});

// Record a view — called once by the client after the page loads
router.post('/:key/view', (req, res) => {
  const { key } = req.params;
  const link = db.prepare('SELECT id FROM share_links WHERE key = ?').get(key);
  if (!link) return res.status(404).json({ message: '分享链接不存在' });

  const result = db
    .prepare(`UPDATE share_links SET view_count = view_count + 1, last_viewed_at = datetime('now') WHERE key = ?`)
    .run(key);

  const { view_count } = db.prepare('SELECT view_count FROM share_links WHERE key = ?').get(key);
  res.json({ view_count });
});

module.exports = router;

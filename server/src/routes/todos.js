const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function getTodoWithTags(id) {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  if (!todo) return null;
  const tags = db
    .prepare(
      `SELECT t.* FROM tags t
       JOIN todo_tags tt ON tt.tag_id = t.id
       WHERE tt.todo_id = ?`
    )
    .all(id);
  return { ...todo, tags };
}

router.get('/', (req, res) => {
  const {
    status,
    priority,
    category_id,
    include_subcategories,
    uncategorized,
    tag_id,
    due_start,
    due_end,
    search,
    page = 1,
    limit = 50,
  } = req.query;

  let sql = `
    SELECT DISTINCT t.*,
           c.name as category_name, c.color as category_color,
           c.icon as category_icon
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN todo_tags tt ON tt.todo_id = t.id
    WHERE t.user_id = ?
  `;
  const params = [req.user.id];

  if (status) {
    sql += ` AND t.status = ?`;
    params.push(status);
  }
  if (priority) {
    sql += ` AND t.priority = ?`;
    params.push(priority);
  }
  if (uncategorized === 'true') {
    sql += ` AND t.category_id IS NULL`;
  } else if (category_id) {
    if (include_subcategories === 'true') {
      const children = db
        .prepare('SELECT id FROM categories WHERE parent_id = ? AND user_id = ?')
        .all(category_id, req.user.id);
      const ids = [category_id, ...children.map((c) => c.id)];
      const placeholders = ids.map(() => '?').join(',');
      sql += ` AND t.category_id IN (${placeholders})`;
      params.push(...ids);
    } else {
      sql += ` AND t.category_id = ?`;
      params.push(category_id);
    }
  }
  if (tag_id) {
    sql += ` AND tt.tag_id = ?`;
    params.push(tag_id);
  }
  if (due_start) {
    sql += ` AND t.due_date >= ?`;
    params.push(due_start);
  }
  if (due_end) {
    sql += ` AND t.due_date <= ?`;
    params.push(due_end);
  }
  if (search) {
    sql += ` AND (t.title LIKE ? OR t.content LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  const orderBy = ` ORDER BY
    CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
    t.due_date ASC NULLS LAST,
    t.created_at DESC`;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const baseSql = sql;
  const baseParams = params.slice();
  const countSql = `SELECT COUNT(DISTINCT t.id) as total FROM todos t LEFT JOIN categories c ON t.category_id = c.id LEFT JOIN todo_tags tt ON tt.todo_id = t.id WHERE t.user_id = ?${baseSql.split('WHERE t.user_id = ?')[1]}`;
  const { total } = db.prepare(countSql).get(baseParams);

  sql += orderBy + ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  const todos = db.prepare(sql).all(params);

  const todoIds = todos.map((t) => t.id);
  const tagMap = {};
  if (todoIds.length > 0) {
    const placeholders = todoIds.map(() => '?').join(',');
    const todoTags = db
      .prepare(
        `SELECT tt.todo_id, t.* FROM tags t
         JOIN todo_tags tt ON tt.tag_id = t.id
         WHERE tt.todo_id IN (${placeholders})`
      )
      .all(todoIds);
    todoTags.forEach((tag) => {
      if (!tagMap[tag.todo_id]) tagMap[tag.todo_id] = [];
      const { todo_id, ...rest } = tag;
      tagMap[tag.todo_id].push(rest);
    });
  }

  const result = todos.map((t) => ({ ...t, tags: tagMap[t.id] || [] }));

  res.json({ todos: result, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/:id', (req, res) => {
  const todo = db
    .prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!todo) return res.status(404).json({ message: 'Todo not found' });

  const tags = db
    .prepare(
      `SELECT t.* FROM tags t JOIN todo_tags tt ON tt.tag_id = t.id WHERE tt.todo_id = ?`
    )
    .all(todo.id);
  res.json({ todo: { ...todo, tags } });
});

function validateCategoryOwnership(categoryId, userId) {
  if (!categoryId) return true;
  const cat = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(categoryId, userId);
  return !!cat;
}

function validateTagsOwnership(tagIds, userId) {
  if (!tagIds || tagIds.length === 0) return true;
  const placeholders = tagIds.map(() => '?').join(',');
  const owned = db
    .prepare(`SELECT id FROM tags WHERE id IN (${placeholders}) AND user_id = ?`)
    .all(...tagIds, userId);
  return owned.length === tagIds.length;
}

router.post('/', (req, res) => {
  const { title, content = '', category_id, priority = 'medium', due_date, tag_ids = [], notify_enabled = 1 } =
    req.body;
  if (!title) return res.status(400).json({ message: 'title required' });

  if (!validateCategoryOwnership(category_id, req.user.id)) {
    return res.status(400).json({ message: '分类不存在或无权使用' });
  }
  if (!validateTagsOwnership(tag_ids, req.user.id)) {
    return res.status(400).json({ message: '标签不存在或无权使用' });
  }

  const result = db
    .prepare(
      `INSERT INTO todos (title, content, category_id, user_id, priority, due_date, notify_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(title, content, category_id || null, req.user.id, priority, due_date || null, notify_enabled ? 1 : 0);

  const todoId = result.lastInsertRowid;

  if (tag_ids.length > 0) {
    const insertTag = db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
    tag_ids.forEach((tid) => insertTag.run(todoId, tid));
  }

  const todo = getTodoWithTags(todoId);
  res.status(201).json({ todo });
});

router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ message: 'Todo not found' });

  const { title, content, category_id, priority, due_date, status, tag_ids, notify_enabled } = req.body;

  if (category_id !== undefined && !validateCategoryOwnership(category_id, req.user.id)) {
    return res.status(400).json({ message: '分类不存在或无权使用' });
  }
  if (tag_ids !== undefined && !validateTagsOwnership(tag_ids, req.user.id)) {
    return res.status(400).json({ message: '标签不存在或无权使用' });
  }

  const setClauses = [];
  const values = [];

  if (title !== undefined) { setClauses.push('title = ?'); values.push(title); }
  if (content !== undefined) { setClauses.push('content = ?'); values.push(content); }
  if (category_id !== undefined) { setClauses.push('category_id = ?'); values.push(category_id ?? null); }
  if (priority !== undefined) { setClauses.push('priority = ?'); values.push(priority); }
  if (due_date !== undefined) { setClauses.push('due_date = ?'); values.push(due_date ?? null); }
  if (status !== undefined) { setClauses.push('status = ?'); values.push(status); }

  if (status !== undefined) {
    if (status === 'completed') {
      const current = db.prepare('SELECT status FROM todos WHERE id = ?').get(req.params.id);
      if (current.status !== 'completed') {
        setClauses.push('completed_at = ?');
        values.push(new Date().toISOString());
      }
    } else {
      setClauses.push('completed_at = ?');
      values.push(null);
    }
  }

  if (notify_enabled !== undefined) { setClauses.push('notify_enabled = ?'); values.push(notify_enabled ? 1 : 0); }

  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.id, req.user.id);

  db.prepare(
    `UPDATE todos SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`
  ).run(...values);

  if (tag_ids !== undefined) {
    db.prepare('DELETE FROM todo_tags WHERE todo_id = ?').run(req.params.id);
    if (tag_ids.length > 0) {
      const insertTag = db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
      tag_ids.forEach((tid) => insertTag.run(req.params.id, tid));
    }
  }

  const todo = getTodoWithTags(req.params.id);
  res.json({ todo });
});

router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['pending', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const existing = db
    .prepare('SELECT id, status FROM todos WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ message: 'Todo not found' });

  let completedAt = null;
  if (status === 'completed' && existing.status !== 'completed') {
    completedAt = new Date().toISOString();
  }

  db.prepare(
    `UPDATE todos SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, ?) ELSE NULL END, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`
  ).run(status, status, completedAt, req.params.id, req.user.id);

  const todo = getTodoWithTags(req.params.id);
  res.json({ todo });
});

router.delete('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ message: 'Todo not found' });

  db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Todo deleted' });
});

module.exports = router;

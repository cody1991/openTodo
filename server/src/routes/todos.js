const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const {
  getTodoWithTags,
  validateCategoryOwnership,
  validateTagsOwnership,
  createTodoForUser,
} = require('../services/todoService');

const router = express.Router();
router.use(authenticate);

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

router.get('/export', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories WHERE user_id = ?').all(req.user.id);
  const tags = db.prepare('SELECT * FROM tags WHERE user_id = ?').all(req.user.id);
  const todos = db.prepare('SELECT * FROM todos WHERE user_id = ?').all(req.user.id);

  const todoIds = todos.map((t) => t.id);
  let todoTags = [];
  if (todoIds.length > 0) {
    const placeholders = todoIds.map(() => '?').join(',');
    todoTags = db.prepare(`SELECT * FROM todo_tags WHERE todo_id IN (${placeholders})`).all(todoIds);
  }

  res.json({
    version: 1,
    exported_at: new Date().toISOString(),
    categories,
    tags,
    todos,
    todo_tags: todoTags,
  });
});

router.post('/import', (req, res) => {
  const { categories = [], tags = [], todos = [], todo_tags = [] } = req.body;

  if (!Array.isArray(todos) || !Array.isArray(categories) || !Array.isArray(tags)) {
    return res.status(400).json({ message: req.t('todos.invalidFormat') });
  }

  const importFn = db.transaction(() => {
    const existingTodos = db.prepare('SELECT id FROM todos WHERE user_id = ?').all(req.user.id);
    const existingTodoIds = existingTodos.map((t) => t.id);
    if (existingTodoIds.length > 0) {
      const placeholders = existingTodoIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM todo_tags WHERE todo_id IN (${placeholders})`).run(existingTodoIds);
    }
    db.prepare('DELETE FROM todos WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM categories WHERE user_id = ?').run(req.user.id);
    db.prepare('DELETE FROM tags WHERE user_id = ?').run(req.user.id);

    const categoryIdMap = {};
    const insertCategory = db.prepare(
      'INSERT INTO categories (name, color, icon, parent_id, sort_order, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const cat of categories.filter((c) => !c.parent_id)) {
      const r = insertCategory.run(
        cat.name, cat.color || '#1677ff', cat.icon || 'folder', null,
        cat.sort_order || 0, req.user.id,
        cat.created_at || new Date().toISOString(),
        cat.updated_at || new Date().toISOString()
      );
      categoryIdMap[cat.id] = r.lastInsertRowid;
    }
    for (const cat of categories.filter((c) => c.parent_id)) {
      const r = insertCategory.run(
        cat.name, cat.color || '#1677ff', cat.icon || 'folder',
        categoryIdMap[cat.parent_id] || null,
        cat.sort_order || 0, req.user.id,
        cat.created_at || new Date().toISOString(),
        cat.updated_at || new Date().toISOString()
      );
      categoryIdMap[cat.id] = r.lastInsertRowid;
    }

    const tagIdMap = {};
    const insertTag = db.prepare(
      'INSERT INTO tags (name, color, user_id, created_at) VALUES (?, ?, ?, ?)'
    );
    for (const tag of tags) {
      const r = insertTag.run(
        tag.name, tag.color || '#1677ff', req.user.id,
        tag.created_at || new Date().toISOString()
      );
      tagIdMap[tag.id] = r.lastInsertRowid;
    }

    const todoIdMap = {};
    const insertTodo = db.prepare(
      `INSERT INTO todos (title, content, category_id, user_id, status, priority, due_date, completed_at, is_overdue, sort_order, notify_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const todo of todos) {
      const r = insertTodo.run(
        todo.title, todo.content || '',
        todo.category_id ? (categoryIdMap[todo.category_id] || null) : null,
        req.user.id,
        todo.status || 'pending', todo.priority || 'medium',
        todo.due_date || null, todo.completed_at || null,
        todo.is_overdue || 0, todo.sort_order || 0,
        todo.notify_enabled !== undefined ? todo.notify_enabled : 1,
        todo.created_at || new Date().toISOString(),
        todo.updated_at || new Date().toISOString()
      );
      todoIdMap[todo.id] = r.lastInsertRowid;
    }

    const insertTodoTag = db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
    for (const tt of todo_tags) {
      const newTodoId = todoIdMap[tt.todo_id];
      const newTagId = tagIdMap[tt.tag_id];
      if (newTodoId && newTagId) insertTodoTag.run(newTodoId, newTagId);
    }

    return {
      categories: Object.keys(categoryIdMap).length,
      tags: Object.keys(tagIdMap).length,
      todos: Object.keys(todoIdMap).length,
    };
  });

  try {
    const result = importFn();
    res.json({ message: req.t('todos.importSuccess'), ...result });
  } catch (e) {
    console.error('Import error:', e);
    res.status(500).json({ message: req.t('todos.importFailed') + ': ' + e.message });
  }
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

router.post('/', (req, res) => {
  const { title, content = '', category_id, priority = 'medium', due_date, tag_ids = [], notify_enabled = 1 } =
    req.body;
  if (!title) return res.status(400).json({ message: 'title required' });

  try {
    const todo = createTodoForUser(req.user.id, {
      title,
      content,
      category_id,
      priority,
      due_date,
      tag_ids,
      notify_enabled,
    });
    res.status(201).json({ todo });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ message: e.i18nKey ? req.t(e.i18nKey) : e.message });
    throw e;
  }
});

router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ message: 'Todo not found' });

  const { title, content, category_id, priority, due_date, status, tag_ids, notify_enabled } = req.body;

  if (category_id !== undefined && !validateCategoryOwnership(category_id, req.user.id)) {
    return res.status(400).json({ message: req.t('todos.categoryInvalid') });
  }
  if (tag_ids !== undefined && !validateTagsOwnership(tag_ids, req.user.id)) {
    return res.status(400).json({ message: req.t('todos.tagsInvalid') });
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

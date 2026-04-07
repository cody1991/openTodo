const db = require('../db');

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

/**
 * Create a todo for a user (used by POST /todos and share request approval).
 */
function createTodoForUser(userId, payload) {
  const {
    title,
    content = '',
    category_id = null,
    priority = 'medium',
    due_date = null,
    tag_ids = [],
    notify_enabled = 1,
  } = payload;

  if (!title || !String(title).trim()) {
    const err = new Error('title required');
    err.statusCode = 400;
    throw err;
  }
  const safeTitle = String(title).trim();

  if (!validateCategoryOwnership(category_id, userId)) {
    const err = new Error('todos.categoryInvalid');
    err.statusCode = 400;
    err.i18nKey = 'todos.categoryInvalid';
    throw err;
  }
  if (!validateTagsOwnership(tag_ids, userId)) {
    const err = new Error('todos.tagsInvalid');
    err.statusCode = 400;
    err.i18nKey = 'todos.tagsInvalid';
    throw err;
  }

  const result = db
    .prepare(
      `INSERT INTO todos (title, content, category_id, user_id, priority, due_date, notify_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(safeTitle, content, category_id || null, userId, priority, due_date || null, notify_enabled ? 1 : 0);

  const todoId = result.lastInsertRowid;

  if (tag_ids.length > 0) {
    const insertTag = db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
    tag_ids.forEach((tid) => insertTag.run(todoId, tid));
  }

  return getTodoWithTags(todoId);
}

module.exports = {
  getTodoWithTags,
  validateCategoryOwnership,
  validateTagsOwnership,
  createTodoForUser,
};

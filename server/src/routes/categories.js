const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  // For root categories (parent_id IS NULL), pending_count aggregates own todos + sub-category todos.
  // For sub-categories, pending_count is only their own todos.
  const categories = db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM todos t
         WHERE t.user_id = c.user_id
           AND (t.category_id = c.id
                OR (c.parent_id IS NULL AND t.category_id IN (
                  SELECT id FROM categories WHERE parent_id = c.id AND user_id = c.user_id
                )))) as total_count,
        (SELECT COUNT(*) FROM todos t
         WHERE t.user_id = c.user_id
           AND t.status != 'completed'
           AND (t.category_id = c.id
                OR (c.parent_id IS NULL AND t.category_id IN (
                  SELECT id FROM categories WHERE parent_id = c.id AND user_id = c.user_id
                )))) as pending_count
       FROM categories c
       WHERE c.user_id = ?
       ORDER BY COALESCE(c.parent_id, c.id), c.parent_id IS NOT NULL, c.sort_order, c.created_at`
    )
    .all(req.user.id);

  const { uncategorized_pending_count } = db
    .prepare(
      `SELECT COUNT(*) as uncategorized_pending_count
       FROM todos WHERE user_id = ? AND category_id IS NULL AND status != 'completed'`
    )
    .get(req.user.id);

  res.json({ categories, uncategorized_pending_count });
});

router.post('/', (req, res) => {
  const { name, color = '#1677ff', icon = 'folder', parent_id } = req.body;
  if (!name) return res.status(400).json({ message: 'name required' });

  // Validate parent: must be a root category (no parent_id itself)
  if (parent_id) {
    const parent = db
      .prepare('SELECT id, parent_id FROM categories WHERE id = ? AND user_id = ?')
      .get(parent_id, req.user.id);
    if (!parent) return res.status(404).json({ message: 'Parent category not found' });
    if (parent.parent_id) return res.status(400).json({ message: 'Only one level of sub-categories is supported' });
  }

  const maxOrder = db
    .prepare('SELECT MAX(sort_order) as m FROM categories WHERE user_id = ? AND parent_id IS ?')
    .get(req.user.id, parent_id || null);
  const sortOrder = (maxOrder?.m || 0) + 1;

  const result = db
    .prepare(
      'INSERT INTO categories (name, color, icon, user_id, sort_order, parent_id) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(name, color, icon, req.user.id, sortOrder, parent_id || null);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ category });
});

router.put('/:id', (req, res) => {
  const { name, color, icon, sort_order, parent_id } = req.body;
  const cat = db
    .prepare('SELECT id, parent_id FROM categories WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!cat) return res.status(404).json({ message: 'Category not found' });

  // Validate parent_id change
  if (parent_id !== undefined) {
    if (parent_id !== null) {
      if (Number(parent_id) === Number(req.params.id)) {
        return res.status(400).json({ message: 'A category cannot be its own parent' });
      }
      const parent = db
        .prepare('SELECT id, parent_id FROM categories WHERE id = ? AND user_id = ?')
        .get(parent_id, req.user.id);
      if (!parent) return res.status(404).json({ message: 'Parent category not found' });
      if (parent.parent_id) {
        return res.status(400).json({ message: 'Only one level of sub-categories is supported' });
      }
      // Cannot move a category that already has children
      const { count } = db
        .prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ? AND user_id = ?')
        .get(req.params.id, req.user.id);
      if (count > 0) {
        return res.status(400).json({ message: 'Cannot nest a category that already has sub-categories' });
      }
    }

    db.prepare(
      `UPDATE categories SET
        name = COALESCE(?, name),
        color = COALESCE(?, color),
        icon = COALESCE(?, icon),
        sort_order = COALESCE(?, sort_order),
        parent_id = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`
    ).run(name, color, icon, sort_order, parent_id, req.params.id, req.user.id);
  } else {
    db.prepare(
      `UPDATE categories SET
        name = COALESCE(?, name),
        color = COALESCE(?, color),
        icon = COALESCE(?, icon),
        sort_order = COALESCE(?, sort_order),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`
    ).run(name, color, icon, sort_order, req.params.id, req.user.id);
  }

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json({ category: updated });
});

router.delete('/:id', (req, res) => {
  const cat = db
    .prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!cat) return res.status(404).json({ message: 'Category not found' });

  db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(
    req.params.id,
    req.user.id
  );
  res.json({ message: 'Category deleted' });
});

module.exports = router;

const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// List all categories for current user (flat, client builds tree)
router.get('/', (req, res) => {
  const cats = db
    .prepare(
      `SELECT * FROM bookmark_categories WHERE user_id = ? ORDER BY parent_id NULLS FIRST, sort_order, name`
    )
    .all(req.user.id);
  res.json({ categories: cats });
});

router.post('/', (req, res) => {
  const { name, color = '#6366f1', icon, parent_id, sort_order = 0 } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });

  // Only allow one level of nesting: parent must be a root category
  if (parent_id) {
    const parent = db
      .prepare('SELECT id, parent_id FROM bookmark_categories WHERE id = ? AND user_id = ?')
      .get(parent_id, req.user.id);
    if (!parent) return res.status(404).json({ message: 'Parent category not found' });
    if (parent.parent_id) return res.status(400).json({ message: req.t('bookmarks.maxDepth') });
  }

  const result = db
    .prepare(
      `INSERT INTO bookmark_categories (user_id, name, color, icon, parent_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, name, color, icon || null, parent_id || null, sort_order);

  const cat = db.prepare('SELECT * FROM bookmark_categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ category: cat });
});

router.put('/:id', (req, res) => {
  const cat = db
    .prepare('SELECT * FROM bookmark_categories WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!cat) return res.status(404).json({ message: 'Not found' });

  const { name, color, icon, sort_order, parent_id } = req.body;
  db.prepare(
    `UPDATE bookmark_categories SET
       name       = COALESCE(?, name),
       color      = COALESCE(?, color),
       icon       = COALESCE(?, icon),
       sort_order = COALESCE(?, sort_order),
       parent_id  = ?
     WHERE id = ?`
  ).run(name, color, icon, sort_order, parent_id !== undefined ? (parent_id || null) : cat.parent_id, cat.id);

  res.json({ category: db.prepare('SELECT * FROM bookmark_categories WHERE id = ?').get(cat.id) });
});

router.delete('/:id', (req, res) => {
  const cat = db
    .prepare('SELECT * FROM bookmark_categories WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!cat) return res.status(404).json({ message: 'Not found' });
  db.prepare('DELETE FROM bookmark_categories WHERE id = ?').run(cat.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;

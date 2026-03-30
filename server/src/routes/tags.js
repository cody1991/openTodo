const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const tags = db
    .prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name')
    .all(req.user.id);
  res.json({ tags });
});

router.post('/', (req, res) => {
  const { name, color = '#1677ff' } = req.body;
  if (!name) return res.status(400).json({ message: 'name required' });

  const result = db
    .prepare('INSERT INTO tags (name, color, user_id) VALUES (?, ?, ?)')
    .run(name, color, req.user.id);

  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ tag });
});

router.put('/:id', (req, res) => {
  const { name, color } = req.body;
  const tag = db
    .prepare('SELECT id FROM tags WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!tag) return res.status(404).json({ message: 'Tag not found' });

  db.prepare(
    `UPDATE tags SET
      name = COALESCE(?, name),
      color = COALESCE(?, color)
     WHERE id = ? AND user_id = ?`
  ).run(name, color, req.params.id, req.user.id);

  const updated = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  res.json({ tag: updated });
});

router.delete('/:id', (req, res) => {
  const tag = db
    .prepare('SELECT id FROM tags WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!tag) return res.status(404).json({ message: 'Tag not found' });

  db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Tag deleted' });
});

module.exports = router;

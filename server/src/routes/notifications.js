const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { page = 1, limit = 20, unread_only } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let sql = 'SELECT * FROM notifications WHERE user_id = ?';
  const params = [req.user.id];

  if (unread_only === 'true') {
    sql += ' AND is_read = 0';
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const notifications = db.prepare(sql).all(params);
  const { count } = db
    .prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(req.user.id);

  res.json({ notifications, unread_count: count });
});

router.patch('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
    req.params.id,
    req.user.id
  );
  res.json({ message: 'Marked as read' });
});

router.patch('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'All marked as read' });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(
    req.params.id,
    req.user.id
  );
  res.json({ message: 'Notification deleted' });
});

module.exports = router;

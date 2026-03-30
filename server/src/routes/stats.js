const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', (req, res) => {
  const uid = req.user.id;

  const overview = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN priority = 'urgent' AND status != 'completed' THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_TIMESTAMP AND status != 'completed' THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN DATE(due_date) = DATE('now') AND status != 'completed' THEN 1 ELSE 0 END) as due_today
       FROM todos WHERE user_id = ?`
    )
    .get(uid);

  const byCategory = db
    .prepare(
      `SELECT c.id, c.name, c.color, c.icon,
              COUNT(t.id) as total,
              SUM(CASE WHEN t.status != 'completed' THEN 1 ELSE 0 END) as pending
       FROM categories c
       LEFT JOIN todos t ON t.category_id = c.id AND t.user_id = c.user_id
       WHERE c.user_id = ?
       GROUP BY c.id
       ORDER BY pending DESC`
    )
    .all(uid);

  const uncategorized = db
    .prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) as pending
       FROM todos WHERE user_id = ? AND category_id IS NULL`
    )
    .get(uid);

  const byPriority = db
    .prepare(
      `SELECT priority, COUNT(*) as count
       FROM todos WHERE user_id = ? AND status != 'completed'
       GROUP BY priority`
    )
    .all(uid);

  const last7Days = db
    .prepare(
      `SELECT DATE(completed_at) as date, COUNT(*) as count
       FROM todos
       WHERE user_id = ? AND status = 'completed'
         AND completed_at >= DATE('now', '-6 days')
       GROUP BY DATE(completed_at)
       ORDER BY date`
    )
    .all(uid);

  const urgentTodos = db
    .prepare(
      `SELECT t.*, c.name as category_name, c.color as category_color
       FROM todos t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.priority = 'urgent' AND t.status != 'completed'
       ORDER BY t.due_date ASC NULLS LAST
       LIMIT 5`
    )
    .all(uid);

  res.json({ overview, byCategory, uncategorized, byPriority, last7Days, urgentTodos });
});

router.get('/report', (req, res) => {
  const uid = req.user.id;
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const completedYesterday = db
    .prepare(
      `SELECT t.*, c.name as category_name
       FROM todos t LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.status = 'completed'
         AND DATE(t.completed_at) = DATE(?, '-1 day')
       ORDER BY t.completed_at DESC`
    )
    .all(uid, targetDate);

  const pendingToday = db
    .prepare(
      `SELECT t.*, c.name as category_name
       FROM todos t LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.status != 'completed'
       ORDER BY
         CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         t.due_date ASC NULLS LAST
       LIMIT 20`
    )
    .all(uid);

  const overdue = db
    .prepare(
      `SELECT t.*, c.name as category_name
       FROM todos t LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.status != 'completed'
         AND t.due_date < CURRENT_TIMESTAMP AND t.due_date IS NOT NULL
       ORDER BY t.due_date ASC`
    )
    .all(uid);

  res.json({ completedYesterday, pendingToday, overdue, date: targetDate });
});

router.get('/calendar', (req, res) => {
  const uid = req.user.id;
  const { start, end } = req.query;

  let sql = `
    SELECT t.id, t.title, t.status, t.priority, t.due_date, t.created_at, t.completed_at,
           c.name as category_name, c.color as category_color
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
  `;
  const params = [uid];

  if (start) {
    sql += ' AND (t.due_date >= ? OR DATE(t.created_at) >= ?)';
    params.push(start, start);
  }
  if (end) {
    sql += ' AND (t.due_date <= ? OR DATE(t.created_at) <= ?)';
    params.push(end, end);
  }

  const todos = db.prepare(sql).all(params);
  res.json({ todos });
});

module.exports = router;

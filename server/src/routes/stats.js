const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { getLocalDate, getLocalDayUTCBounds, utcToLocalDate } = require('../utils/dateUtils');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', (req, res) => {
  const uid = req.user.id;
  const tz = req.user.timezone || 'UTC';
  const localToday = getLocalDate(tz);
  const [todayStart, todayEnd] = getLocalDayUTCBounds(localToday, tz);

  const overview = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN priority = 'urgent' AND status != 'completed' THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_TIMESTAMP AND status != 'completed' THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN due_date >= ? AND due_date < ? AND status != 'completed' THEN 1 ELSE 0 END) as due_today
       FROM todos WHERE user_id = ?`
    )
    .get(todayStart, todayEnd, uid);

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

  // Fetch last 7 days completions and group by user's local date
  const localSixDaysAgo = getLocalDate(tz, -6);
  const [rangeStart] = getLocalDayUTCBounds(localSixDaysAgo, tz);
  const [, rangeEnd] = getLocalDayUTCBounds(localToday, tz);
  const completedRows = db
    .prepare(
      `SELECT completed_at FROM todos
       WHERE user_id = ? AND status = 'completed'
         AND completed_at >= ? AND completed_at < ?`
    )
    .all(uid, rangeStart, rangeEnd);

  const dateMap = {};
  completedRows.forEach((row) => {
    const localDate = utcToLocalDate(row.completed_at, tz);
    dateMap[localDate] = (dateMap[localDate] || 0) + 1;
  });
  const last7Days = Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

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
  const tz = req.user.timezone || 'UTC';
  const { date } = req.query;
  const targetDate = date || getLocalDate(tz);

  // Compute yesterday's UTC bounds in the user's local timezone
  const targetDateObj = new Date(targetDate + 'T12:00:00Z');
  targetDateObj.setUTCDate(targetDateObj.getUTCDate() - 1);
  const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(targetDateObj);
  const [yesterdayStart, yesterdayEnd] = getLocalDayUTCBounds(yesterday, tz);

  const completedYesterday = db
    .prepare(
      `SELECT t.*, c.name as category_name
       FROM todos t LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.status = 'completed'
         AND t.completed_at >= ? AND t.completed_at < ?
       ORDER BY t.completed_at DESC`
    )
    .all(uid, yesterdayStart, yesterdayEnd);

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

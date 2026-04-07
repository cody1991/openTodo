const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { createTodoForUser } = require('../services/todoService');

const router = express.Router();
router.use(authenticate);

function parseTagIds(raw) {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n)) : [];
  } catch {
    return [];
  }
}

function loadTagsForIds(tagIds, userId) {
  if (!tagIds.length) return [];
  const ph = tagIds.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM tags WHERE user_id = ? AND id IN (${ph})`).all(userId, ...tagIds);
}

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT sr.*, sl.name as share_name, sl.key as share_key
    FROM share_requests sr
    JOIN share_links sl ON sr.share_link_id = sl.id
    WHERE sl.user_id = ?
  `;
  const params = [req.user.id];
  if (status) {
    sql += ' AND sr.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY datetime(sr.created_at) DESC';

  const rows = db.prepare(sql).all(...params);

  const pendingRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM share_requests sr
       JOIN share_links sl ON sr.share_link_id = sl.id
       WHERE sl.user_id = ? AND sr.status = 'pending'`
    )
    .get(req.user.id);

  const requests = rows.map((row) => {
    const tag_ids = parseTagIds(row.tag_ids);
    const tags = loadTagsForIds(tag_ids, req.user.id);
    return {
      ...row,
      tag_ids,
      tags,
    };
  });

  res.json({ requests, pending_count: pendingRow.c });
});

router.post('/:id/approve', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db
    .prepare(
      `SELECT sr.*, sl.user_id as owner_id FROM share_requests sr
       JOIN share_links sl ON sr.share_link_id = sl.id
       WHERE sr.id = ?`
    )
    .get(id);

  if (!row) return res.status(404).json({ message: req.t('shareRequests.notFound') });
  if (row.owner_id !== req.user.id) return res.status(403).json({ message: req.t('shareRequests.forbidden') });
  if (row.status !== 'pending') return res.status(400).json({ message: req.t('shareRequests.alreadyHandled') });

  const o = req.body || {};
  const title = o.title !== undefined ? o.title : row.title;
  const content = o.content !== undefined ? o.content : row.content;
  const priority = o.priority !== undefined ? o.priority : row.priority;
  const due_date = o.due_date !== undefined ? o.due_date : row.due_date;
  const category_id = o.category_id !== undefined ? o.category_id : row.category_id;
  const tag_ids = o.tag_ids !== undefined ? o.tag_ids : parseTagIds(row.tag_ids);
  const notify_enabled = o.notify_enabled !== undefined ? o.notify_enabled : 1;

  try {
    const todo = createTodoForUser(req.user.id, {
      title,
      content,
      category_id,
      priority,
      due_date,
      tag_ids: Array.isArray(tag_ids) ? tag_ids : parseTagIds(row.tag_ids),
      notify_enabled,
    });

    db.prepare(
      `UPDATE share_requests SET status = 'approved', result_todo_id = ?, reviewed_at = datetime('now') WHERE id = ?`
    ).run(todo.id, id);

    const updated = db.prepare('SELECT * FROM share_requests WHERE id = ?').get(id);
    res.json({ todo, request: { ...updated, tag_ids: parseTagIds(updated.tag_ids), tags: todo.tags } });
  } catch (e) {
    if (e.statusCode) return res.status(e.statusCode).json({ message: e.i18nKey ? req.t(e.i18nKey) : e.message });
    throw e;
  }
});

router.post('/:id/reject', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = db
    .prepare(
      `SELECT sr.*, sl.user_id as owner_id FROM share_requests sr
       JOIN share_links sl ON sr.share_link_id = sl.id
       WHERE sr.id = ?`
    )
    .get(id);

  if (!row) return res.status(404).json({ message: req.t('shareRequests.notFound') });
  if (row.owner_id !== req.user.id) return res.status(403).json({ message: req.t('shareRequests.forbidden') });
  if (row.status !== 'pending') return res.status(400).json({ message: req.t('shareRequests.alreadyHandled') });

  db.prepare(`UPDATE share_requests SET status = 'rejected', reviewed_at = datetime('now') WHERE id = ?`).run(id);

  const updated = db.prepare('SELECT * FROM share_requests WHERE id = ?').get(id);
  res.json({ request: { ...updated, tag_ids: parseTagIds(updated.tag_ids) } });
});

module.exports = router;

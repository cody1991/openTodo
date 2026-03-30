const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate, requireAdmin);

// --- Users ---
router.get('/users', (req, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.role_id, u.avatar,
              u.notifications_enabled, u.daily_report_enabled, u.created_at,
              r.name as role_name
       FROM users u JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    )
    .all();
  res.json({ users });
});

router.post('/users', (req, res) => {
  const { username, email, password, role_id = 2 } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'username, email, password required' });
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(username, email);
  if (existing) {
    return res.status(409).json({ message: 'Username or email already exists' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const result = db
    .prepare('INSERT INTO users (username, email, password_hash, role_id) VALUES (?, ?, ?, ?)')
    .run(username, email, hash, role_id);

  res.status(201).json({ message: 'User created', userId: result.lastInsertRowid });
});

router.put('/users/:id', (req, res) => {
  const { username, email, password, role_id } = req.body;
  const { id } = req.params;

  if (password) {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      hash,
      id
    );
  }
  if (username)
    db.prepare(
      'UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(username, id);
  if (email)
    db.prepare('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      email,
      id
    );
  if (role_id)
    db.prepare(
      'UPDATE users SET role_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(role_id, id);

  res.json({ message: 'User updated' });
});

router.delete('/users/:id', (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ message: 'Cannot delete yourself' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted' });
});

// --- Roles ---
router.get('/roles', (req, res) => {
  const roles = db.prepare('SELECT * FROM roles ORDER BY id').all();
  roles.forEach((r) => (r.permissions = JSON.parse(r.permissions || '[]')));
  res.json({ roles });
});

router.post('/roles', (req, res) => {
  const { name, permissions = [] } = req.body;
  if (!name) return res.status(400).json({ message: 'name required' });

  const result = db
    .prepare('INSERT INTO roles (name, permissions) VALUES (?, ?)')
    .run(name, JSON.stringify(permissions));

  res.status(201).json({ message: 'Role created', roleId: result.lastInsertRowid });
});

router.put('/roles/:id', (req, res) => {
  const { name, permissions } = req.body;
  if (name)
    db.prepare(
      'UPDATE roles SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(name, req.params.id);
  if (permissions)
    db.prepare(
      'UPDATE roles SET permissions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(JSON.stringify(permissions), req.params.id);

  res.json({ message: 'Role updated' });
});

router.delete('/roles/:id', (req, res) => {
  if ([1, 2].includes(parseInt(req.params.id))) {
    return res.status(400).json({ message: 'Cannot delete built-in roles' });
  }
  db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id);
  res.json({ message: 'Role deleted' });
});

module.exports = router;

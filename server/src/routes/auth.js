const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  const user = db
    .prepare(
      `SELECT u.*, r.name as role_name, r.permissions
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.username = ? OR u.email = ?`
    )
    .get(username, username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  res.cookie('token', token, COOKIE_OPTIONS);

  const { password_hash, ...safeUser } = user;
  safeUser.permissions = JSON.parse(safeUser.permissions || '[]');

  res.json({ message: 'Login successful', user: safeUser, token });
});

router.post('/register', (req, res) => {
  if (process.env.ALLOW_REGISTRATION === 'false') {
    return res.status(403).json({ message: '当前不开放注册，请联系管理员' });
  }

  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: '用户名、邮箱和密码均为必填项' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: '密码长度不能少于 8 位' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: '邮箱格式不正确' });
  }

  const exists = db
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(username, email);
  if (exists) {
    return res.status(409).json({ message: '用户名或邮箱已被注册' });
  }

  const userRole = db.prepare("SELECT id FROM roles WHERE name = 'user'").get();
  if (!userRole) {
    return res.status(500).json({ message: '系统角色未初始化，请联系管理员' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const result = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, role_id) VALUES (?, ?, ?, ?)`
    )
    .run(username, email, hash, userRole.id);

  const newUser = db
    .prepare(
      `SELECT u.*, r.name as role_name, r.permissions
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`
    )
    .get(result.lastInsertRowid);

  const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  res.cookie('token', token, COOKIE_OPTIONS);

  const { password_hash, ...safeUser } = newUser;
  safeUser.permissions = JSON.parse(safeUser.permissions || '[]');

  res.status(201).json({ message: '注册成功', user: safeUser, token });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.put('/password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both passwords required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    hash,
    req.user.id
  );

  res.json({ message: 'Password updated' });
});

router.put('/settings', authenticate, (req, res) => {
  const { wecom_webhook, notifications_enabled, daily_report_enabled, daily_report_time, avatar, timezone } =
    req.body;

  db.prepare(
    `UPDATE users SET
      wecom_webhook = COALESCE(?, wecom_webhook),
      notifications_enabled = COALESCE(?, notifications_enabled),
      daily_report_enabled = COALESCE(?, daily_report_enabled),
      daily_report_time = COALESCE(?, daily_report_time),
      avatar = COALESCE(?, avatar),
      timezone = COALESCE(?, timezone),
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    wecom_webhook,
    notifications_enabled != null ? (notifications_enabled ? 1 : 0) : null,
    daily_report_enabled != null ? (daily_report_enabled ? 1 : 0) : null,
    daily_report_time,
    avatar,
    timezone || null,
    req.user.id
  );

  res.json({ message: 'Settings updated' });
});

module.exports = router;

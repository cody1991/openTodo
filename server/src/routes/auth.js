const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

function getAllowedWecomHosts() {
  const envVal = process.env.WECOM_ALLOWED_HOSTS;
  if (envVal) return envVal.split(',').map((h) => h.trim()).filter(Boolean);
  return ['qyapi.weixin.qq.com'];
}

function isValidWebhookUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && getAllowedWecomHosts().includes(parsed.hostname);
  } catch {
    return false;
  }
}

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post('/login', (req, res) => {
  const { t } = req;
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: t('auth.credentialsRequired') });
  }

  const user = db
    .prepare(
      `SELECT u.*, r.name as role_name, r.permissions
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.username = ? OR u.email = ?`
    )
    .get(username, username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ message: t('auth.invalidCredentials') });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  res.cookie('token', token, COOKIE_OPTIONS);

  const { password_hash, ...safeUser } = user;
  safeUser.permissions = JSON.parse(safeUser.permissions || '[]');

  res.json({ message: t('auth.loginSuccess'), user: safeUser, token });
});

router.post('/register', (req, res) => {
  const { t } = req;

  if (process.env.ALLOW_REGISTRATION === 'false') {
    return res.status(403).json({ message: t('auth.registrationClosed') });
  }

  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: t('auth.fieldsMissing') });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: t('auth.passwordTooShort') });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: t('auth.invalidEmail') });
  }

  const exists = db
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(username, email);
  if (exists) {
    return res.status(409).json({ message: t('auth.userExists') });
  }

  const userRole = db.prepare("SELECT id FROM roles WHERE name = 'user'").get();
  if (!userRole) {
    return res.status(500).json({ message: t('auth.roleNotInit') });
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

  res.status(201).json({ message: t('auth.registerSuccess'), user: safeUser, token });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: req.t('auth.loggedOut') });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.put('/password', authenticate, (req, res) => {
  const { t } = req;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: t('auth.passwordsRequired') });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: t('auth.newPasswordTooShort') });
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ message: t('auth.currentPasswordWrong') });
  }

  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
    hash,
    req.user.id
  );

  res.json({ message: t('auth.passwordUpdated') });
});

router.put('/settings', authenticate, (req, res) => {
  const { t } = req;
  const { wecom_webhook, notifications_enabled, daily_report_enabled, daily_report_time, avatar, timezone } =
    req.body;

  if (!isValidWebhookUrl(wecom_webhook)) {
    return res.status(400).json({ message: t('auth.invalidWebhook') });
  }

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

  res.json({ message: t('auth.settingsUpdated') });
});

module.exports = router;

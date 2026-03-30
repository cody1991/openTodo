const jwt = require('jsonwebtoken');
const db = require('../db');

function authenticate(req, res, next) {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = db
      .prepare(
        `SELECT u.id, u.username, u.email, u.role_id, u.avatar, u.notifications_enabled,
                u.daily_report_enabled, u.daily_report_time, u.wecom_webhook,
                r.name as role_name, r.permissions
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = ?`
      )
      .get(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    user.permissions = JSON.parse(user.permissions || '[]');
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };

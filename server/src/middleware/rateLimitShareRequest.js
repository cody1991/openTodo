/**
 * Simple hourly rate limit by IP for public share request submissions.
 */
const buckets = new Map();

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;

function rateLimitShareRequest(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const key = ip;
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > MAX_PER_WINDOW) {
    return res.status(429).json({ message: '请求过于频繁，请稍后再试' });
  }
  next();
}

module.exports = { rateLimitShareRequest };

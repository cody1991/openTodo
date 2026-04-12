const MAX_STRING_LENGTH = 100000;

function sanitizeValue(val) {
  if (typeof val === 'string') {
    let s = val.replace(/\0/g, '');
    if (s.length > MAX_STRING_LENGTH) {
      s = s.slice(0, MAX_STRING_LENGTH);
    }
    return s;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val && typeof val === 'object') {
    return sanitizeObject(val);
  }
  return val;
}

function sanitizeObject(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = sanitizeValue(value);
  }
  return result;
}

function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
}

module.exports = sanitizeInput;

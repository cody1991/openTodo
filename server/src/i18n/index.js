const zhCN = require('./zh-CN.json');
const zhTW = require('./zh-TW.json');
const en   = require('./en.json');
const ja   = require('./ja.json');
const nl   = require('./nl.json');

const translations = { 'zh-CN': zhCN, 'zh-TW': zhTW, en, ja, nl };
const fallback = 'zh-CN';

/**
 * Resolve a dot-notation key from a nested object.
 */
function getNestedValue(obj, key) {
  return key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

/**
 * Resolve the best-matching language from an Accept-Language header value.
 * Supports exact matches (e.g. "zh-CN") and prefix matches (e.g. "zh" -> "zh-CN").
 */
function resolveLanguage(acceptLanguage) {
  if (!acceptLanguage) return fallback;

  const candidates = acceptLanguage
    .split(',')
    .map((part) => {
      const [lang, q] = part.trim().split(';q=');
      return { lang: lang.trim(), q: q ? parseFloat(q) : 1.0 };
    })
    .sort((a, b) => b.q - a.q)
    .map((item) => item.lang);

  for (const candidate of candidates) {
    if (translations[candidate]) return candidate;
    // prefix match: "zh" -> "zh-CN", "zh-tw" -> "zh-TW"
    const lower = candidate.toLowerCase();
    const matched = Object.keys(translations).find(
      (key) => key.toLowerCase() === lower || key.toLowerCase().startsWith(lower + '-')
    );
    if (matched) return matched;
  }

  return fallback;
}

/**
 * Get a translation function for the given Accept-Language header.
 * Usage: const t = getT(req.headers['accept-language']);
 *        res.json({ message: t('auth.loginSuccess') });
 */
function getT(acceptLanguage) {
  const lang = resolveLanguage(acceptLanguage);
  const dict = translations[lang] || translations[fallback];

  return function t(key) {
    const value = getNestedValue(dict, key);
    if (value !== undefined) return value;
    // fallback to zh-CN
    const fbValue = getNestedValue(translations[fallback], key);
    return fbValue !== undefined ? fbValue : key;
  };
}

module.exports = { getT, resolveLanguage };

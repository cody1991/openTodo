const { getT } = require('../i18n');

/**
 * Attaches req.t — a translation function scoped to the request's Accept-Language header.
 */
function langMiddleware(req, _res, next) {
  req.t = getT(req.headers['accept-language']);
  next();
}

module.exports = langMiddleware;

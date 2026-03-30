function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userPerms = req.user.permissions || [];
    const hasAll = permissions.every((p) => userPerms.includes(p));

    if (!hasAll) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (req.user.role_name !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

module.exports = { requirePermission, requireAdmin };

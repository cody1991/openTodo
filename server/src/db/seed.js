const bcrypt = require('bcryptjs');
const db = require('./index');

const ALL_PERMISSIONS = [
  'todos:read', 'todos:write', 'todos:delete',
  'categories:read', 'categories:write', 'categories:delete',
  'tags:read', 'tags:write', 'tags:delete',
  'users:read', 'users:write', 'users:delete',
  'roles:read', 'roles:write', 'roles:delete',
  'admin:access',
];

const USER_PERMISSIONS = [
  'todos:read', 'todos:write', 'todos:delete',
  'categories:read', 'categories:write', 'categories:delete',
  'tags:read', 'tags:write', 'tags:delete',
];

function seed() {
  // Insert roles
  const insertRole = db.prepare(
    'INSERT OR IGNORE INTO roles (id, name, permissions) VALUES (?, ?, ?)'
  );
  insertRole.run(1, 'admin', JSON.stringify(ALL_PERMISSIONS));
  insertRole.run(2, 'user', JSON.stringify(USER_PERMISSIONS));
  console.log('[Seed] Roles created');

  // Insert default admin user
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123456!';

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);
  if (!existing) {
    const hash = bcrypt.hashSync(adminPassword, 12);
    db.prepare(
      'INSERT INTO users (username, email, password_hash, role_id) VALUES (?, ?, ?, ?)'
    ).run(adminUsername, adminEmail, hash, 1);
    console.log(`[Seed] Admin user created: ${adminUsername}`);
  } else {
    console.log('[Seed] Admin user already exists, skipping');
  }
}

module.exports = { seed };

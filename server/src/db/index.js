const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../../data/todo.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).sort();

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      ran_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const ranMigrations = db
    .prepare('SELECT filename FROM _migrations')
    .all()
    .map((r) => r.filename);

  for (const file of migrationFiles) {
    if (!file.endsWith('.sql')) continue;
    if (ranMigrations.includes(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
    console.log(`[DB] Migration ran: ${file}`);
  }
}

runMigrations();

module.exports = db;

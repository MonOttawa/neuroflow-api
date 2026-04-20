import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/neuroflow.db');

import { mkdirSync } from 'fs';
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    display_name TEXT,
    plan        TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    stripe_end_at  INTEGER,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL,
    frequency   INTEGER NOT NULL,
    duration    INTEGER NOT NULL,
    color       TEXT NOT NULL,
    started_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    completed_at INTEGER,
    aborted     INTEGER NOT NULL DEFAULT 0,
    notes       TEXT
  );

  CREATE TABLE IF NOT EXISTS user_presets (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    frequency   INTEGER NOT NULL,
    color       TEXT NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS anon_users (
    device_id   TEXT PRIMARY KEY,
    plan        TEXT NOT NULL DEFAULT 'free',
    daily_sessions_used INTEGER NOT NULL DEFAULT 0,
    last_session_date TEXT,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// Prepared statements
const STMT = {
  // Users
  getUserById:     db.prepare('SELECT * FROM users WHERE id = ?'),
  getUserByEmail:  db.prepare('SELECT * FROM users WHERE email = ?'),
  createUser:      db.prepare('INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)'),
  updateUserPlan:  db.prepare('UPDATE users SET plan = ?, stripe_customer_id = ?, stripe_subscription_id = ?, stripe_end_at = ?, updated_at = unixepoch() WHERE id = ?'),
  updateUser:      db.prepare('UPDATE users SET display_name = ?, updated_at = unixepoch() WHERE id = ?'),

  // Anon users (device-level free tier)
  getAnon:         db.prepare('SELECT * FROM anon_users WHERE device_id = ?'),
  upsertAnon:      db.prepare('INSERT INTO anon_users (device_id) VALUES (?) ON CONFLICT(device_id) DO NOTHING'),

  // Sessions
  createSession:   db.prepare('INSERT INTO sessions (user_id, frequency, duration, color) VALUES (?, ?, ?, ?)'),
  getUserSessions: db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?'),
  getSessionCount: db.prepare('SELECT COUNT(*) as count FROM sessions WHERE user_id = ?'),

  // User presets
  getUserPresets:  db.prepare('SELECT * FROM user_presets WHERE user_id = ? ORDER BY created_at DESC'),
  createPreset:    db.prepare('INSERT INTO user_presets (user_id, name, frequency, color) VALUES (?, ?, ?, ?)'),
  deletePreset:    db.prepare('DELETE FROM user_presets WHERE id = ? AND user_id = ?'),
};

export default db;
export { STMT };

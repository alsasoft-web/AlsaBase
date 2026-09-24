import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const DB_PATH =
  process.env.DATABASE_PATH || path.join(DATA_DIR, "alsabase.sqlite");

let activeDb = new DatabaseSync(DB_PATH);

function initDbPragmas(targetDb: DatabaseSync) {
  targetDb.exec("PRAGMA journal_mode = WAL;");
  targetDb.exec("PRAGMA foreign_keys = ON;");
  targetDb.exec("PRAGMA synchronous = NORMAL;");
  targetDb.exec("PRAGMA cache_size = -64000;");
  targetDb.exec("PRAGMA temp_store = MEMORY;");
  targetDb.exec("PRAGMA busy_timeout = 5000;");
}

initDbPragmas(activeDb);

export const db = new Proxy({} as DatabaseSync, {
  get(_target, prop, receiver) {
    const value = Reflect.get(activeDb, prop, receiver);
    if (typeof value === "function") {
      return value.bind(activeDb);
    }
    return value;
  },
});

export function reopenDatabase() {
  try {
    activeDb.close();
  } catch {}
  activeDb = new DatabaseSync(DB_PATH);
  initDbPragmas(activeDb);
  initSystemTables();
}

export function initSystemTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _superusers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _collections (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      schema_json TEXT NOT NULL,
      rules_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      method TEXT,
      path TEXT,
      status INTEGER,
      duration_ms REAL,
      error_message TEXT,
      stack_trace TEXT,
      metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS _auth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      type TEXT NOT NULL,
      token TEXT NOT NULL,
      new_email TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _crons (
      name TEXT PRIMARY KEY,
      schedule TEXT,
      last_run_at TEXT,
      last_status TEXT,
      last_duration_ms REAL,
      updated_at TEXT NOT NULL
    );

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON _logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_level ON _logs(level);
    CREATE INDEX IF NOT EXISTS idx_users_email ON _users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON _users(username);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON _auth_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON _auth_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_crons_name ON _crons(name);
  `);

  // Purge oversized/corrupted logs from recursion and reclaim space
  try {
    const bloatedCount =
      (
        db
          .prepare(
            "SELECT COUNT(*) as c FROM _logs WHERE length(metadata_json) > 3000 OR metadata_json LIKE '%\"totalPages\":%' OR metadata_json LIKE '%\"items\":%'",
          )
          .get() as any
      )?.c || 0;
    if (bloatedCount > 0) {
      console.log(
        `[DB] Pruning ${bloatedCount} bloated/corrupt log entries...`,
      );
      db.prepare(
        "DELETE FROM _logs WHERE length(metadata_json) > 3000 OR metadata_json LIKE '%\"totalPages\":%' OR metadata_json LIKE '%\"items\":%'",
      ).run();
      db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      db.exec("VACUUM;");
      console.log(`[DB] VACUUM completed in place.`);
    }
  } catch {}
}

// Ensure system tables are ready on load
initSystemTables();

// Scrypt password hashing
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export function hasSuperusers(): boolean {
  const stmt = db.prepare("SELECT COUNT(*) as count FROM _superusers");
  const result = stmt.get() as { count: number };
  return result.count > 0;
}

-- 家庭记账本 / Family Ledger — D1 schema
-- 金额一律用整数「分」存储，避免浮点误差。All money is stored as integer cents.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,          -- 登录名，区分大小写；存小写副本用于比对
  display_name  TEXT NOT NULL,
  pwd_hash      TEXT NOT NULL,                 -- HMAC-SHA256(pepper, clientPBKDF2(password))
  avatar        TEXT,                          -- 'emoji:cat' 或 'data:image/webp;base64,...'
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS households (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  invite_code       TEXT,
  invite_expires_at INTEGER,
  created_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_households_invite ON households(invite_code);

CREATE TABLE IF NOT EXISTS household_members (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member',   -- owner | member
  joined_at    INTEGER NOT NULL,
  PRIMARY KEY (household_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON household_members(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '📦',
  direction    TEXT NOT NULL DEFAULT 'expense', -- expense | income
  sort         INTEGER NOT NULL DEFAULT 0,
  archived_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_categories_household ON categories(household_id);

CREATE TABLE IF NOT EXISTS entries (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by   TEXT NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL,                -- 永远为正，方向由 direction 决定
  direction    TEXT NOT NULL DEFAULT 'expense', -- expense | income
  category_id  TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  occurred_on  TEXT NOT NULL,                   -- YYYY-MM-DD（本地日期）
  client_uuid  TEXT NOT NULL,                   -- 离线幂等键
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted_at   INTEGER                          -- 软删除：非空即视为已删
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_client_uuid ON entries(household_id, client_uuid);
CREATE INDEX IF NOT EXISTS idx_entries_month ON entries(household_id, occurred_on);
CREATE INDEX IF NOT EXISTS idx_entries_author ON entries(household_id, created_by, occurred_on);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,                  -- SHA-256(session token)，库里不存明文
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS entry_log (            -- 变更历史：谁改了什么
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id   TEXT NOT NULL,
  actor_id   TEXT NOT NULL,
  action     TEXT NOT NULL,                     -- create | update | delete | restore
  detail     TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entry_log_entry ON entry_log(entry_id);

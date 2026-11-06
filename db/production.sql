PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,          -- 登录名，区分大小写；存小写副本用于比对
  display_name  TEXT NOT NULL,
  pwd_hash      TEXT NOT NULL,                 -- HMAC-SHA256(pepper, clientPBKDF2(password))
  created_at    INTEGER NOT NULL
);
INSERT INTO "users" ("id","username","display_name","pwd_hash","created_at") VALUES('c7e9da65-0ec1-45bb-82b3-2f47b88509c3','flysusdjd','小林','84ab3e8fc6a35d2b40be9f89bb071eb60437a364f2061154a19c7e0d6f5506cc',1793989743);
CREATE TABLE households (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  invite_code       TEXT,
  invite_expires_at INTEGER,
  created_at        INTEGER NOT NULL
);
INSERT INTO "households" ("id","name","invite_code","invite_expires_at","created_at") VALUES('beade644-2225-4e2e-b8fd-ffc99e233475','我们的家',NULL,NULL,1793989743);
CREATE TABLE household_members (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member',   -- owner | member
  joined_at    INTEGER NOT NULL,
  PRIMARY KEY (household_id, user_id)
);
INSERT INTO "household_members" ("household_id","user_id","role","joined_at") VALUES('beade644-2225-4e2e-b8fd-ffc99e233475','c7e9da65-0ec1-45bb-82b3-2f47b88509c3','owner',1793989743);
CREATE TABLE categories (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '📦',
  direction    TEXT NOT NULL DEFAULT 'expense', -- expense | income
  sort         INTEGER NOT NULL DEFAULT 0,
  archived_at  INTEGER
);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES('5c96f9ab-a739-4e26-9ebf-6b941ba84c42','beade644-2225-4e2e-b8fd-ffc99e233475','餐饮','🍚','expense',0,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES('cd4b3847-4c9f-4f12-b3f7-306c372b73cf','beade644-2225-4e2e-b8fd-ffc99e233475','买菜','🥬','expense',1,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES('9cb46b4e-e50f-4ee6-83f0-93442f0848d5','beade644-2225-4e2e-b8fd-ffc99e233475','交通','🚌','expense',2,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES('50ed626b-ba0d-4dcc-9017-7ae631bac117','beade644-2225-4e2e-b8fd-ffc99e233475','日用','🧴','expense',3,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES('a2eb32c3-3e2a-463a-8f8e-1adc0a6349e5','beade644-2225-4e2e-b8fd-ffc99e233475','住房','🏠','expense',4,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES('7a83fa27-d1e7-4be2-8ddf-7a27253c3af9','beade644-2225-4e2e-b8fd-ffc99e233475','医疗','💊','expense',5,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES('a4192f60-1207-47a3-9c46-dcc2c97fd0f6','beade644-2225-4e2e-b8fd-ffc99e233475','娱乐','🎮','expense',6,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES('5b783a0a-2b25-4753-8021-4d3b45c52aad','beade644-2225-4e2e-b8fd-ffc99e233475','学习','📚','expense',7,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES('c2514790-6c48-408a-a39f-b8021521b117','beade644-2225-4e2e-b8fd-ffc99e233475','人情','🎁','expense',8,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES('335da438-4327-4875-9914-be359b7b605e','beade644-2225-4e2e-b8fd-ffc99e233475','其他','📦','expense',9,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES('e83a06db-15a7-4cf9-95f1-8b2b82129355','beade644-2225-4e2e-b8fd-ffc99e233475','工资','💰','income',10,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES('5d13cd10-0d71-4770-a7ff-d54d49e5007f','beade644-2225-4e2e-b8fd-ffc99e233475','奖金','🎉','income',11,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES('5826ad51-4dc0-4fa5-acd8-6e095a5ca262','beade644-2225-4e2e-b8fd-ffc99e233475','其他收入','✨','income',12,NULL);
CREATE TABLE entries (
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
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                  -- SHA-256(session token)，库里不存明文
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE entry_log (            -- 变更历史：谁改了什么
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id   TEXT NOT NULL,
  actor_id   TEXT NOT NULL,
  action     TEXT NOT NULL,                     -- create | update | delete | restore
  detail     TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('entry_log',3);
CREATE INDEX idx_households_invite ON households(invite_code);
CREATE INDEX idx_members_user ON household_members(user_id);
CREATE INDEX idx_categories_household ON categories(household_id);
CREATE UNIQUE INDEX idx_entries_client_uuid ON entries(household_id, client_uuid);
CREATE INDEX idx_entries_month ON entries(household_id, occurred_on);
CREATE INDEX idx_entries_author ON entries(household_id, created_by, occurred_on);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_entry_log_entry ON entry_log(entry_id);

-- 家庭记账本 · 演示数据（可直接在 Navicat 里执行建库）
-- 两个账号：demo / demo12345（小林，账本创建者）、ajane / demo12345（阿珍）
PRAGMA foreign_keys=ON;

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,          -- 登录名，区分大小写；存小写副本用于比对
  display_name  TEXT NOT NULL,
  pwd_hash      TEXT NOT NULL,                 -- HMAC-SHA256(pepper, clientPBKDF2(password))
  created_at    INTEGER NOT NULL
);
-- users: 2 行
INSERT INTO "users" ("id","username","display_name","pwd_hash","created_at") VALUES ('7d404357-831f-4531-a6b6-3d1371ad2e05','demo','小林','80b6be43d25d4965a3182e842e91a539f4ef9cddf324c7b5e44c28feb41b4d67',1793984756);
INSERT INTO "users" ("id","username","display_name","pwd_hash","created_at") VALUES ('723ca07c-c3e3-4217-85c2-60d67a66108f','ajane','阿珍','49fd9670f2108391701e73553b516fc9c47f6f71ee8bcf4b22b1d0cba6e231bc',1793984756);

CREATE TABLE households (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  invite_code       TEXT,
  invite_expires_at INTEGER,
  created_at        INTEGER NOT NULL
);
-- households: 1 行
INSERT INTO "households" ("id","name","invite_code","invite_expires_at","created_at") VALUES ('37a1ced7-f13b-4141-ac09-63b6699ec514','我们的家','FZND88',1793993790,1793984756);

CREATE TABLE household_members (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member',   -- owner | member
  joined_at    INTEGER NOT NULL,
  PRIMARY KEY (household_id, user_id)
);
-- household_members: 2 行
INSERT INTO "household_members" ("household_id","user_id","role","joined_at") VALUES ('37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05','owner',1793984756);
INSERT INTO "household_members" ("household_id","user_id","role","joined_at") VALUES ('37a1ced7-f13b-4141-ac09-63b6699ec514','723ca07c-c3e3-4217-85c2-60d67a66108f','member',1793984756);

CREATE TABLE categories (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  emoji        TEXT NOT NULL DEFAULT '📦',
  direction    TEXT NOT NULL DEFAULT 'expense', -- expense | income
  sort         INTEGER NOT NULL DEFAULT 0,
  archived_at  INTEGER
);
-- categories: 13 行
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES ('a538fe81-0be9-4d6e-ad5c-226273dd08c8','37a1ced7-f13b-4141-ac09-63b6699ec514','餐饮','🍚','expense',0,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES ('147a2b7f-6b97-42eb-bd4c-77f505ec9714','37a1ced7-f13b-4141-ac09-63b6699ec514','买菜','🥬','expense',1,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES ('57dfe0ed-77ea-407a-98ca-642e96d3bde3','37a1ced7-f13b-4141-ac09-63b6699ec514','交通','🚌','expense',2,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES ('fd98a0a2-a361-48ac-af7f-e189f5c85580','37a1ced7-f13b-4141-ac09-63b6699ec514','日用','🧴','expense',3,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES ('b00fdd92-f31e-47c9-9cef-f0518aba9a18','37a1ced7-f13b-4141-ac09-63b6699ec514','住房','🏠','expense',4,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES ('d4a9a649-29cd-4c1a-a943-83e7d250d76c','37a1ced7-f13b-4141-ac09-63b6699ec514','医疗','💊','expense',5,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES ('8d5d724b-31ab-482c-8da6-9a7be411ab0a','37a1ced7-f13b-4141-ac09-63b6699ec514','娱乐','🎮','expense',6,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES ('f38a9441-cf70-438e-8ca5-e47ac322e765','37a1ced7-f13b-4141-ac09-63b6699ec514','学习','📚','expense',7,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES ('7d11da45-dba8-456d-8c12-80279dc791f7','37a1ced7-f13b-4141-ac09-63b6699ec514','人情','🎁','expense',8,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES ('e8ff8eda-5c9e-4504-a04d-9c0d1d0ec026','37a1ced7-f13b-4141-ac09-63b6699ec514','其他','📦','expense',9,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES ('cbee7b74-a6f5-4f0c-93bd-33579a3726a5','37a1ced7-f13b-4141-ac09-63b6699ec514','工资','💰','income',10,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES ('2702cad6-1a5d-4325-8797-8e8ec94e02f4','37a1ced7-f13b-4141-ac09-63b6699ec514','奖金','🎉','income',11,NULL);
INSERT INTO "categories" ("id","household_id","name","emoji","direction","sort","archived_at") VALUES ('9c8f6307-62f8-453a-ae80-ed06128a73e5','37a1ced7-f13b-4141-ac09-63b6699ec514','其他收入','✨','income',12,NULL);

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
-- entries: 20 行
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('f0a18ec2-0509-4d5a-b645-850aa94fbc6d','37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05',2600,'expense','a538fe81-0be9-4d6e-ad5c-226273dd08c8','楼下面馆','2026-11-07','seed-餐饮-7-2600-9hea17',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('e69169e1-80c7-4766-b735-44e5698bcfe8','37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05',1200,'expense','57dfe0ed-77ea-407a-98ca-642e96d3bde3','地铁','2026-11-07','seed-交通-7-1200-3pwbey',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('89e649d8-e611-42a9-9923-e8a8d18294aa','37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05',8840,'expense','147a2b7f-6b97-42eb-bd4c-77f505ec9714','周末囤菜','2026-11-06','seed-买菜-6-8840-dzt2h4',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('47b7a775-4d98-4e1b-a7ba-2bf4bb4e0dff','37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05',4500,'expense','a538fe81-0be9-4d6e-ad5c-226273dd08c8','外卖','2026-11-05','seed-餐饮-5-4500-3cxjut',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('16aef31f-0598-4bec-a1c3-ce9ac54c56af','37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05',3990,'expense','fd98a0a2-a361-48ac-af7f-e189f5c85580','洗衣液','2026-11-04','seed-日用-4-3990-wl9a3l',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('08e799fb-09d2-4fcc-a827-b50555560fa6','37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05',6800,'expense','8d5d724b-31ab-482c-8da6-9a7be411ab0a','电影','2026-11-02','seed-娱乐-2-6800-383b2p',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('05ddaff2-bba7-486d-ae6f-fd02be42a709','37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05',1850000,'income','cbee7b74-a6f5-4f0c-93bd-33579a3726a5','十月工资','2026-11-01','seed-工资-1-1850000-bkyzts',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('e3bdc98d-52be-4873-bbaa-b81b74866fee','37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05',320000,'expense','b00fdd92-f31e-47c9-9cef-f0518aba9a18','房租','2026-11-01','seed-住房-1-320000-0crj43',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('3151831b-7443-4252-9f6c-4463370afb45','37a1ced7-f13b-4141-ac09-63b6699ec514','723ca07c-c3e3-4217-85c2-60d67a66108f',1800,'expense','a538fe81-0be9-4d6e-ad5c-226273dd08c8','早餐','2026-11-07','seed-餐饮-7-1800-7qwajw',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('69335b61-dc55-4ab9-8266-71ce6dbdfcb3','37a1ced7-f13b-4141-ac09-63b6699ec514','723ca07c-c3e3-4217-85c2-60d67a66108f',12900,'expense','f38a9441-cf70-438e-8ca5-e47ac322e765','一本书','2026-11-07','seed-学习-7-12900-s70q2y',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('ca24e992-21f3-427d-af13-e5e164950b2e','37a1ced7-f13b-4141-ac09-63b6699ec514','723ca07c-c3e3-4217-85c2-60d67a66108f',6250,'expense','147a2b7f-6b97-42eb-bd4c-77f505ec9714','水果','2026-11-06','seed-买菜-6-6250-3skjlw',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('90a59802-f947-4b4b-a72f-44ff0d19f743','37a1ced7-f13b-4141-ac09-63b6699ec514','723ca07c-c3e3-4217-85c2-60d67a66108f',800,'expense','57dfe0ed-77ea-407a-98ca-642e96d3bde3','公交','2026-11-05','seed-交通-5-800-k6j0gj',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('7a9aeff4-eafd-4384-975e-4288c352ff21','37a1ced7-f13b-4141-ac09-63b6699ec514','723ca07c-c3e3-4217-85c2-60d67a66108f',20000,'expense','7d11da45-dba8-456d-8c12-80279dc791f7','同事结婚','2026-11-03','seed-人情-3-20000-zumhfc',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('668354b5-f8a0-4003-9085-8ebe386b057e','37a1ced7-f13b-4141-ac09-63b6699ec514','723ca07c-c3e3-4217-85c2-60d67a66108f',1520000,'income','cbee7b74-a6f5-4f0c-93bd-33579a3726a5','十月工资','2026-11-01','seed-工资-1-1520000-ua7obp',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('3b4afbd2-f598-430b-86ee-5a852dd87c9c','37a1ced7-f13b-4141-ac09-63b6699ec514','723ca07c-c3e3-4217-85c2-60d67a66108f',15600,'expense','d4a9a649-29cd-4c1a-a943-83e7d250d76c','感冒药','2026-11-01','seed-医疗-1-15600-4tod9z',1793984756,1793984756,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('49c4e984-69b7-413d-8c66-702a7110f3a2','37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05',3600,'expense','a538fe81-0be9-4d6e-ad5c-226273dd08c8','','2026-11-07','01e125c8-d106-4c13-b097-f22d0dfda0b8',1793984801,1793984801,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('89f13980-0756-487e-8548-f4a63b1e6de4','37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05',990,'expense','a538fe81-0be9-4d6e-ad5c-226273dd08c8','','2026-11-07','4541a366-7800-42ac-9614-5847ef7a86a2',1793984861,1793984861,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('1cae15d6-fae5-4feb-b50c-f53994f9822f','37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05',1234,'expense','a538fe81-0be9-4d6e-ad5c-226273dd08c8','','2026-11-07','4656eb41-f1f4-4540-b665-5ddb6ca40707',1793990446,1793990446,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('a47cd993-9bc6-4524-a3b6-d5897e9cd2d0','37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05',3150,'expense','a538fe81-0be9-4d6e-ad5c-226273dd08c8','两杯咖啡（改）','2026-11-07','4623f059-b384-40d0-882a-e2aa98a59d6c',1793993092,1793993245,NULL);
INSERT INTO "entries" ("id","household_id","created_by","amount_cents","direction","category_id","note","occurred_on","client_uuid","created_at","updated_at","deleted_at") VALUES ('be089071-8a8b-494d-8561-2914660cf5cf','37a1ced7-f13b-4141-ac09-63b6699ec514','7d404357-831f-4531-a6b6-3d1371ad2e05',666,'expense','a538fe81-0be9-4d6e-ad5c-226273dd08c8','','2026-11-07','4067459a-2c24-464b-900d-eea8d860ac74',1793993270,1793993270,NULL);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                  -- SHA-256(session token)，库里不存明文
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
-- sessions: 4 行
INSERT INTO "sessions" ("token_hash","user_id","created_at","expires_at") VALUES ('e81111a04e8f8af3a48eb6c26b519150813699b523baee791c02ac937ee0561e','7d404357-831f-4531-a6b6-3d1371ad2e05',1793984756,1796576756);
INSERT INTO "sessions" ("token_hash","user_id","created_at","expires_at") VALUES ('032241cf1e8f1b126440151432f3c01d6e778f1d5e2c1dd560b3138525c101a6','723ca07c-c3e3-4217-85c2-60d67a66108f',1793984756,1796576756);
INSERT INTO "sessions" ("token_hash","user_id","created_at","expires_at") VALUES ('1d5bff63df23d407ce547a2b839ab71ecbd11e9e72efe455e162445c149acc9c','7d404357-831f-4531-a6b6-3d1371ad2e05',1793990355,1796582355);
INSERT INTO "sessions" ("token_hash","user_id","created_at","expires_at") VALUES ('7e1c472315dcd77da71c8350b28cf7566b619206a95e4c0b0a18b20d0165a384','7d404357-831f-4531-a6b6-3d1371ad2e05',1793993460,1796585460);

CREATE TABLE entry_log (            -- 变更历史：谁改了什么
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id   TEXT NOT NULL,
  actor_id   TEXT NOT NULL,
  action     TEXT NOT NULL,                     -- create | update | delete | restore
  detail     TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
-- entry_log: 22 行
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (1,'f0a18ec2-0509-4d5a-b645-850aa94fbc6d','7d404357-831f-4531-a6b6-3d1371ad2e05','create','expense 2600',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (2,'e69169e1-80c7-4766-b735-44e5698bcfe8','7d404357-831f-4531-a6b6-3d1371ad2e05','create','expense 1200',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (3,'89e649d8-e611-42a9-9923-e8a8d18294aa','7d404357-831f-4531-a6b6-3d1371ad2e05','create','expense 8840',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (4,'47b7a775-4d98-4e1b-a7ba-2bf4bb4e0dff','7d404357-831f-4531-a6b6-3d1371ad2e05','create','expense 4500',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (5,'16aef31f-0598-4bec-a1c3-ce9ac54c56af','7d404357-831f-4531-a6b6-3d1371ad2e05','create','expense 3990',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (6,'08e799fb-09d2-4fcc-a827-b50555560fa6','7d404357-831f-4531-a6b6-3d1371ad2e05','create','expense 6800',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (7,'05ddaff2-bba7-486d-ae6f-fd02be42a709','7d404357-831f-4531-a6b6-3d1371ad2e05','create','income 1850000',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (8,'e3bdc98d-52be-4873-bbaa-b81b74866fee','7d404357-831f-4531-a6b6-3d1371ad2e05','create','expense 320000',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (9,'3151831b-7443-4252-9f6c-4463370afb45','723ca07c-c3e3-4217-85c2-60d67a66108f','create','expense 1800',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (10,'69335b61-dc55-4ab9-8266-71ce6dbdfcb3','723ca07c-c3e3-4217-85c2-60d67a66108f','create','expense 12900',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (11,'ca24e992-21f3-427d-af13-e5e164950b2e','723ca07c-c3e3-4217-85c2-60d67a66108f','create','expense 6250',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (12,'90a59802-f947-4b4b-a72f-44ff0d19f743','723ca07c-c3e3-4217-85c2-60d67a66108f','create','expense 800',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (13,'7a9aeff4-eafd-4384-975e-4288c352ff21','723ca07c-c3e3-4217-85c2-60d67a66108f','create','expense 20000',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (14,'668354b5-f8a0-4003-9085-8ebe386b057e','723ca07c-c3e3-4217-85c2-60d67a66108f','create','income 1520000',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (15,'3b4afbd2-f598-430b-86ee-5a852dd87c9c','723ca07c-c3e3-4217-85c2-60d67a66108f','create','expense 15600',1793984756);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (16,'49c4e984-69b7-413d-8c66-702a7110f3a2','7d404357-831f-4531-a6b6-3d1371ad2e05','create','expense 3600',1793984801);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (17,'89f13980-0756-487e-8548-f4a63b1e6de4','7d404357-831f-4531-a6b6-3d1371ad2e05','create','expense 990',1793984861);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (23,'1cae15d6-fae5-4feb-b50c-f53994f9822f','7d404357-831f-4531-a6b6-3d1371ad2e05','create','expense 1234',1793990446);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (24,'a47cd993-9bc6-4524-a3b6-d5897e9cd2d0','7d404357-831f-4531-a6b6-3d1371ad2e05','create','expense 2850',1793993092);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (25,'a47cd993-9bc6-4524-a3b6-d5897e9cd2d0','7d404357-831f-4531-a6b6-3d1371ad2e05','update','2850->3150',1793993241);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (26,'a47cd993-9bc6-4524-a3b6-d5897e9cd2d0','7d404357-831f-4531-a6b6-3d1371ad2e05','delete','',1793993243);
INSERT INTO "entry_log" ("id","entry_id","actor_id","action","detail","created_at") VALUES (27,'be089071-8a8b-494d-8561-2914660cf5cf','7d404357-831f-4531-a6b6-3d1371ad2e05','create','expense 666',1793993270);

CREATE INDEX idx_households_invite ON households(invite_code);
CREATE INDEX idx_members_user ON household_members(user_id);
CREATE INDEX idx_categories_household ON categories(household_id);
CREATE UNIQUE INDEX idx_entries_client_uuid ON entries(household_id, client_uuid);
CREATE INDEX idx_entries_month ON entries(household_id, occurred_on);
CREATE INDEX idx_entries_author ON entries(household_id, created_by, occurred_on);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_entry_log_entry ON entry_log(entry_id);
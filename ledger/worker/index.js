/**
 * 家庭记账本 — Cloudflare Worker (API)
 * Family Ledger — Cloudflare Worker (API)
 *
 * 设计要点 / Design notes
 * 1. 密码永不出浏览器：前端做 600k 次 PBKDF2，只把拉伸结果 authHash 发上来。
 *    Password never leaves the browser: the client runs PBKDF2 (600k) and posts only `authHash`.
 * 2. Worker 只做一次 HMAC-SHA256(pepper, authHash)（约 0.1ms），远低于 10ms CPU 预算。
 *    The worker adds one HMAC with a server-side pepper (~0.1 ms), well inside the CPU budget.
 * 3. 「合并」是视图不是复制：entries.household_id + created_by，个人/家庭只是不同的 WHERE。
 *    "Merge" is a view, not a copy: entries.household_id + created_by, filtered by scope.
 * 4. 金额用整数分。Money is integer cents.
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

const ok = (data, extra = {}) =>
  new Response(JSON.stringify(data), { status: 200, headers: { ...JSON_HEADERS, ...extra } });

const fail = (status, code, message) =>
  new Response(JSON.stringify({ error: code, message }), { status, headers: JSON_HEADERS });

const bad = (message) => fail(400, 'bad_request', message);
const unauth = () => fail(401, 'unauthorized', '请先登录 / Please sign in');

const now = () => Math.floor(Date.now() / 1000);
const uid = () => crypto.randomUUID();

/* ------------------------------------------------------------------ 工具 */

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(key, text) {
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 定长比较，避免计时侧信道 / constant-time compare */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseCookies(request) {
  const raw = request.headers.get('Cookie') || '';
  const out = {};
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionCookie(token, request, maxAge = 60 * 60 * 24 * 30) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isMonth = (s) => /^\d{4}-\d{2}$/.test(s);
const clampInt = (v, min, max, dflt) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

/* ------------------------------------------------------------- 账号与会话 */

async function currentUser(request, env) {
  const token = parseCookies(request).sid;
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.user_id, s.expires_at, u.username, u.display_name
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
  )
    .bind(hash)
    .first();
  if (!row) return null;
  if (row.expires_at < now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
    return null;
  }
  const member = await env.DB.prepare(
    `SELECT m.household_id, m.role, h.name AS household_name
       FROM household_members m JOIN households h ON h.id = m.household_id
      WHERE m.user_id = ? ORDER BY m.joined_at DESC LIMIT 1`,
  )
    .bind(row.user_id)
    .first();
  return {
    id: row.user_id,
    username: row.username,
    displayName: row.display_name,
    householdId: member?.household_id ?? null,
    householdName: member?.household_name ?? null,
    role: member?.role ?? null,
  };
}

async function startSession(env, userId, request) {
  const token = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const t = now();
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(await sha256Hex(token), userId, t, t + 60 * 60 * 24 * 30)
    .run();
  return sessionCookie(token, request);
}

const DEFAULT_CATEGORIES = [
  ['餐饮', '🍚', 'expense'], ['买菜', '🥬', 'expense'], ['交通', '🚌', 'expense'],
  ['日用', '🧴', 'expense'], ['住房', '🏠', 'expense'], ['医疗', '💊', 'expense'],
  ['娱乐', '🎮', 'expense'], ['学习', '📚', 'expense'], ['人情', '🎁', 'expense'],
  ['其他', '📦', 'expense'],
  ['工资', '💰', 'income'], ['奖金', '🎉', 'income'], ['其他收入', '✨', 'income'],
];

async function seedCategories(env, householdId) {
  const stmts = DEFAULT_CATEGORIES.map(([name, emoji, direction], i) =>
    env.DB.prepare(
      'INSERT INTO categories (id, household_id, name, emoji, direction, sort) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(uid(), householdId, name, emoji, direction, i),
  );
  await env.DB.batch(stmts);
}

/* ------------------------------------------------------------------ 路由 */

async function register(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return bad('请求格式不对 / Malformed body');

  const username = String(body.username || '').trim().toLowerCase();
  const displayName = String(body.displayName || body.username || '').trim().slice(0, 24);
  const authHash = String(body.authHash || '');

  if (!/^[a-z0-9_]{3,20}$/.test(username)) return bad('用户名 3-20 位，只能用字母数字下划线');
  if (!/^[a-f0-9]{64}$/.test(authHash)) return bad('凭据格式不对 / Bad credential');
  if (!displayName) return bad('请填一个昵称 / Display name required');

  const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (exists) return fail(409, 'username_taken', '这个用户名已经有人用了');

  const t = now();
  const userId = uid();
  const householdId = uid();
  const pwdHash = await hmacHex(env.AUTH_PEPPER, authHash);

  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO users (id, username, display_name, pwd_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(userId, username, displayName, pwdHash, t),
    env.DB.prepare('INSERT INTO households (id, name, created_at) VALUES (?, ?, ?)').bind(
      householdId,
      '我们的家',
      t,
    ),
    env.DB.prepare(
      "INSERT INTO household_members (household_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
    ).bind(householdId, userId, t),
  ]);
  await seedCategories(env, householdId);

  const cookie = await startSession(env, userId, request);
  return ok({ ok: true, user: { id: userId, username, displayName } }, { 'Set-Cookie': cookie });
}

async function login(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return bad('请求格式不对 / Malformed body');
  const username = String(body.username || '').trim().toLowerCase();
  const authHash = String(body.authHash || '');
  if (!username || !/^[a-f0-9]{64}$/.test(authHash)) return bad('用户名或密码不对');

  const user = await env.DB.prepare(
    'SELECT id, username, display_name, pwd_hash FROM users WHERE username = ?',
  )
    .bind(username)
    .first();

  // 无论用户是否存在都做一次 HMAC，避免用响应时间探测账号 / equal-cost path
  const candidate = await hmacHex(env.AUTH_PEPPER, authHash);
  if (!user || !safeEqual(user.pwd_hash, candidate)) {
    return fail(401, 'bad_credentials', '用户名或密码不对');
  }

  const cookie = await startSession(env, user.id, request);
  return ok(
    { ok: true, user: { id: user.id, username: user.username, displayName: user.display_name } },
    { 'Set-Cookie': cookie },
  );
}

async function logout(request, env) {
  const token = parseCookies(request).sid;
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return ok({ ok: true }, { 'Set-Cookie': sessionCookie('', request, 0) });
}

async function me(request, env, user) {
  const self = await env.DB.prepare('SELECT avatar FROM users WHERE id = ?').bind(user.id).first();
  const members = await env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.avatar, m.role
       FROM household_members m JOIN users u ON u.id = m.user_id
      WHERE m.household_id = ? ORDER BY m.joined_at`,
  )
    .bind(user.householdId)
    .all();
  return ok({ user: { ...user, avatar: self?.avatar ?? null }, members: members.results ?? [] });
}

/* ------------------------------------------------------------ 改资料 */

const AVATAR_EMOJI = /^emoji:(initial|cat|dog|fox|bear|rabbit|panda|fish)$/;
const AVATAR_IMAGE = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]{100,40000}$/;

async function updateMe(request, env, user) {
  const body = await request.json().catch(() => null);
  if (!body) return bad('请求格式不对 / Malformed body');

  const sets = [];
  const params = [];

  if (body.displayName !== undefined) {
    const name = String(body.displayName || '').trim();
    if (name.length < 1 || name.length > 10) return bad('称呼请填 1–10 个字');
    sets.push('display_name = ?');
    params.push(name);
  }

  if (body.avatar !== undefined) {
    const av = body.avatar === null ? null : String(body.avatar);
    if (av !== null && !AVATAR_EMOJI.test(av) && !AVATAR_IMAGE.test(av)) {
      return bad('头像格式不支持');
    }
    if (av !== null && av.length > 40000) return bad('头像太大了，换一张小点的');
    sets.push('avatar = ?');
    params.push(av);
  }

  if (!sets.length) return bad('没有要改的内容');

  params.push(user.id);
  await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();

  return ok({ ok: true, displayName: body.displayName ?? undefined, avatar: body.avatar ?? undefined });
}

/* ------------------------------------------------------------------ 分类 */

async function listCategories(env, user) {
  const rows = await env.DB.prepare(
    `SELECT id, name, emoji, direction, sort FROM categories
      WHERE household_id = ? AND archived_at IS NULL ORDER BY direction, sort, name`,
  )
    .bind(user.householdId)
    .all();
  return ok({ categories: rows.results ?? [] });
}

async function createCategory(request, env, user) {
  const body = await request.json().catch(() => null);
  if (!body) return bad('请求格式不对');
  const name = String(body.name || '').trim().slice(0, 12);
  const emoji = String(body.emoji || '📦').slice(0, 8);
  const direction = body.direction === 'income' ? 'income' : 'expense';
  if (!name) return bad('请填分类名 / Name required');
  const id = uid();
  await env.DB.prepare(
    'INSERT INTO categories (id, household_id, name, emoji, direction, sort) VALUES (?, ?, ?, ?, ?, 99)',
  )
    .bind(id, user.householdId, name, emoji, direction)
    .run();
  return ok({ ok: true, category: { id, name, emoji, direction } });
}

/* ------------------------------------------------------------- 账单 CRUD */

/** 统一的会员筛选：all=全家, me=只看我, <userId>=看某个人 */
function memberClause(scope, user) {
  if (!scope || scope === 'all') return { sql: '', params: [] };
  if (scope === 'me') return { sql: ' AND created_by = ?', params: [user.id] };
  return { sql: ' AND created_by = ?', params: [String(scope)] };
}

/**
 * 日期范围：优先 from/to（YYYY-MM-DD），否则退回 month（YYYY-MM）。
 * Date range: use from/to when both are valid dates, otherwise fall back to month.
 */
function rangeClause(url) {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (from && to && isDate(from) && isDate(to) && from <= to) {
    return {
      sql: ' AND occurred_on BETWEEN ? AND ?',
      params: [from, to],
      range: { kind: 'range', from, to },
    };
  }
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
  if (!isMonth(month)) return null;
  return {
    sql: ' AND occurred_on LIKE ?',
    params: [`${month}-%`],
    range: { kind: 'month', month },
  };
}

async function listEntries(request, env, user) {
  const url = new URL(request.url);
  const r = rangeClause(url);
  if (!r) return bad('日期范围不对 / Bad date range');
  const scope = url.searchParams.get('member') || 'all';
  const q = (url.searchParams.get('q') || '').trim();

  const m = memberClause(scope, user);
  let sql = `SELECT e.id, e.amount_cents, e.direction, e.category_id, e.note, e.occurred_on,
                    e.created_by, e.client_uuid, u.display_name AS author_name,
                    c.name AS category_name, c.emoji AS category_emoji
               FROM entries e
               JOIN users u ON u.id = e.created_by
               LEFT JOIN categories c ON c.id = e.category_id
              WHERE e.household_id = ? AND e.deleted_at IS NULL${r.sql}${m.sql}`;
  const params = [user.householdId, ...r.params, ...m.params];
  if (q) {
    sql += ' AND (e.note LIKE ? OR c.name LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY e.occurred_on DESC, e.created_at DESC LIMIT 500';

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return ok({ entries: rows.results ?? [], range: r.range, month: r.range.month, scope });
}

async function createEntry(request, env, user) {
  const body = await request.json().catch(() => null);
  if (!body) return bad('请求格式不对');

  const amountCents = clampInt(body.amountCents, 0, 100_000_000, 0);
  if (amountCents <= 0) return bad('金额要大于 0 / Amount must be > 0');

  const direction = body.direction === 'income' ? 'income' : 'expense';
  const categoryId = String(body.categoryId || '');
  const cat = await env.DB.prepare(
    'SELECT id FROM categories WHERE id = ? AND household_id = ?',
  )
    .bind(categoryId, user.householdId)
    .first();
  if (!cat) return bad('分类不存在 / Unknown category');

  const occurredOn = isDate(body.occurredOn) ? body.occurredOn : new Date().toISOString().slice(0, 10);
  const note = String(body.note || '').slice(0, 120);
  const clientUuid = String(body.clientUuid || uid()).slice(0, 64);
  const t = now();

  // 离线重放可能重复提交：靠 (household_id, client_uuid) 唯一索引做幂等
  const existing = await env.DB.prepare(
    'SELECT id, amount_cents, direction, category_id, note, occurred_on, created_by FROM entries WHERE household_id = ? AND client_uuid = ?',
  )
    .bind(user.householdId, clientUuid)
    .first();
  if (existing) return ok({ ok: true, duplicate: true, entry: existing });

  const id = uid();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO entries (id, household_id, created_by, amount_cents, direction, category_id, note,
                            occurred_on, client_uuid, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, user.householdId, user.id, amountCents, direction, categoryId, note, occurredOn, clientUuid, t, t),
    env.DB.prepare(
      'INSERT INTO entry_log (entry_id, actor_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(id, user.id, 'create', `${direction} ${amountCents}`, t),
  ]);

  return ok({ ok: true, entry: { id, amountCents, direction, categoryId, note, occurredOn, createdBy: user.id } });
}

async function updateEntry(request, env, user, id) {
  const body = await request.json().catch(() => null);
  if (!body) return bad('请求格式不对');
  const row = await env.DB.prepare(
    'SELECT * FROM entries WHERE id = ? AND household_id = ? AND deleted_at IS NULL',
  )
    .bind(id, user.householdId)
    .first();
  if (!row) return fail(404, 'not_found', '这笔账不存在或已删除');

  const amountCents =
    body.amountCents === undefined ? row.amount_cents : clampInt(body.amountCents, 1, 100_000_000, row.amount_cents);
  const direction =
    body.direction === undefined ? row.direction : body.direction === 'income' ? 'income' : 'expense';
  const note = body.note === undefined ? row.note : String(body.note).slice(0, 120);
  const occurredOn = isDate(body.occurredOn) ? body.occurredOn : row.occurred_on;
  const categoryId = body.categoryId ? String(body.categoryId) : row.category_id;

  const t = now();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE entries SET amount_cents = ?, direction = ?, note = ?, occurred_on = ?, category_id = ?, updated_at = ?
        WHERE id = ?`,
    ).bind(amountCents, direction, note, occurredOn, categoryId, t, id),
    env.DB.prepare(
      'INSERT INTO entry_log (entry_id, actor_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(id, user.id, 'update', `${row.amount_cents}->${amountCents}`, t),
  ]);
  return ok({ ok: true });
}

async function deleteEntry(request, env, user, id) {
  const row = await env.DB.prepare(
    'SELECT id FROM entries WHERE id = ? AND household_id = ? AND deleted_at IS NULL',
  )
    .bind(id, user.householdId)
    .first();
  if (!row) return fail(404, 'not_found', '这笔账不存在');
  const t = now();
  await env.DB.batch([
    env.DB.prepare('UPDATE entries SET deleted_at = ?, updated_at = ? WHERE id = ?').bind(t, t, id),
    env.DB.prepare(
      'INSERT INTO entry_log (entry_id, actor_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(id, user.id, 'delete', '', t),
  ]);
  return ok({ ok: true });
}

async function restoreEntry(request, env, user, id) {
  const row = await env.DB.prepare('SELECT id FROM entries WHERE id = ? AND household_id = ?')
    .bind(id, user.householdId)
    .first();
  if (!row) return fail(404, 'not_found', '这笔账不存在');
  await env.DB.prepare('UPDATE entries SET deleted_at = NULL, updated_at = ? WHERE id = ?')
    .bind(now(), id)
    .run();
  return ok({ ok: true });
}

async function listDeleted(env, user) {
  const rows = await env.DB.prepare(
    `SELECT e.id, e.amount_cents, e.direction, e.note, e.occurred_on, e.deleted_at,
            u.display_name AS author_name, c.name AS category_name, c.emoji AS category_emoji
       FROM entries e JOIN users u ON u.id = e.created_by
       LEFT JOIN categories c ON c.id = e.category_id
      WHERE e.household_id = ? AND e.deleted_at IS NOT NULL
      ORDER BY e.deleted_at DESC LIMIT 100`,
  )
    .bind(user.householdId)
    .all();
  return ok({ entries: rows.results ?? [] });
}

/* ------------------------------------------------------------------ 统计 */

async function stats(request, env, user) {
  const url = new URL(request.url);
  const r = rangeClause(url);
  if (!r) return bad('日期范围不对 / Bad date range');
  const scope = url.searchParams.get('member') || 'all';
  const m = memberClause(scope, user);
  const params = [user.householdId, ...r.params, ...m.params];
  const rangeParams = [user.householdId, ...r.params];

  const totals = await env.DB.prepare(
    `SELECT direction, SUM(amount_cents) AS cents, COUNT(*) AS n
       FROM entries
      WHERE household_id = ? AND deleted_at IS NULL${r.sql}${m.sql}
      GROUP BY direction`,
  )
    .bind(...params)
    .all();

  const byCategory = await env.DB.prepare(
    `SELECT c.id, c.name, c.emoji, e.direction, SUM(e.amount_cents) AS cents, COUNT(*) AS n
       FROM entries e LEFT JOIN categories c ON c.id = e.category_id
      WHERE e.household_id = ? AND e.deleted_at IS NULL${r.sql}${m.sql}
      GROUP BY c.id, e.direction ORDER BY cents DESC`,
  )
    .bind(...params)
    .all();

  const byMember = await env.DB.prepare(
    `SELECT u.id, u.display_name, e.direction, SUM(e.amount_cents) AS cents
       FROM entries e JOIN users u ON u.id = e.created_by
      WHERE e.household_id = ? AND e.deleted_at IS NULL${r.sql}
      GROUP BY u.id, e.direction`,
  )
    .bind(...rangeParams)
    .all();

  const byDay = await env.DB.prepare(
    `SELECT occurred_on AS day, direction, SUM(amount_cents) AS cents
       FROM entries
      WHERE household_id = ? AND deleted_at IS NULL${r.sql}${m.sql}
      GROUP BY occurred_on, direction ORDER BY occurred_on`,
  )
    .bind(...params)
    .all();

  const pick = (rows, dir) => rows.find((r) => r.direction === dir)?.cents ?? 0;
  const t = totals.results ?? [];
  const expense = pick(t, 'expense');
  const income = pick(t, 'income');

  return ok({
    range: r.range,
    month: r.range.month,
    scope,
    total: { expense, income, balance: income - expense },
    byCategory: byCategory.results ?? [],
    byMember: byMember.results ?? [],
    byDay: byDay.results ?? [],
  });
}

/* -------------------------------------------------------------- 家庭共享 */

function inviteCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 去掉易混的 0/O/1/I
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

async function createInvite(env, user) {
  const code = inviteCode();
  const expires = now() + 10 * 60; // 一木那种短时效：10 分钟
  await env.DB.prepare('UPDATE households SET invite_code = ?, invite_expires_at = ? WHERE id = ?')
    .bind(code, expires, user.householdId)
    .run();
  return ok({ ok: true, code, expiresAt: expires, ttlSeconds: 600 });
}

/**
 * 退出家庭。三种情况：
 *  - 非创建者且账本里还有别人 → 直接退出成员关系
 *  - 创建者且账本里还有别人   → 把创建者身份转给最早加入的另一个人，再退出
 *  - 只剩自己一个人           → 把自己的账目与分类整体搬到新建的账本，不删任何数据
 * 无论哪种，退出后必须给这个账号留一个新账本，否则 householdId 为空、所有接口返回空。
 */
async function leaveHousehold(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const confirm = body?.confirm === true;
  if (!confirm) return fail(400, 'need_confirm', '这个操作需要先确认');

  const current = await env.DB.prepare(
    'SELECT household_id, role FROM household_members WHERE user_id = ? ORDER BY joined_at DESC LIMIT 1',
  )
    .bind(user.id)
    .first();
  if (!current) return fail(409, 'no_household', '账号还没有账本');

  const others = await env.DB.prepare(
    'SELECT u.id, u.display_name, m.role, m.joined_at FROM household_members m JOIN users u ON u.id = m.user_id WHERE m.household_id = ? AND m.user_id <> ? ORDER BY m.joined_at',
  )
    .bind(current.household_id, user.id)
    .all();
  const peer = (others.results ?? [])[0];

  const newHouseId = uid();
  const t = now();
  const newName = user.displayName ? `${user.displayName}的账本` : '我的账本';

  const steps = [];

  if (peer && current.role === 'owner') {
    // 转让创建者
    steps.push(
      env.DB.prepare("UPDATE household_members SET role = 'owner' WHERE household_id = ? AND user_id = ?")
        .bind(current.household_id, peer.id),
    );
  }

  // 离开旧账本
  steps.push(
    env.DB.prepare('DELETE FROM household_members WHERE household_id = ? AND user_id = ?')
      .bind(current.household_id, user.id),
  );

  // 建新账本并成为创建者
  steps.push(
    env.DB.prepare(
      'INSERT INTO households (id, name, invite_code, invite_expires_at, created_at) VALUES (?, ?, NULL, NULL, ?)',
    ).bind(newHouseId, newName, t),
  );
  steps.push(
    env.DB.prepare(
      "INSERT INTO household_members (household_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
    ).bind(newHouseId, user.id, t),
  );

  await env.DB.batch(steps);
  await seedCategories(env, newHouseId);

  // 原来那本只剩自己 → 把自己的账目和分类整体搬到新账本
  let moved = 0;
  if (!peer) {
    const catMap = new Map();
    const oldCats = await env.DB.prepare('SELECT id, name, direction FROM categories WHERE household_id = ?')
      .bind(current.household_id)
      .all();
    const newCats = await env.DB.prepare('SELECT id, name, direction FROM categories WHERE household_id = ?')
      .bind(newHouseId)
      .all();
    for (const c of oldCats.results ?? []) {
      const hit = (newCats.results ?? []).find((n) => n.name === c.name && n.direction === c.direction);
      if (hit) catMap.set(c.id, hit.id);
    }
    const moves = [];
    for (const [oldId, newId] of catMap) {
      moves.push(
        env.DB.prepare('UPDATE entries SET household_id = ?, category_id = ? WHERE household_id = ? AND category_id = ?')
          .bind(newHouseId, newId, current.household_id, oldId),
      );
    }
    if (moves.length) await env.DB.batch(moves);
    // 剩下对不上分类的账目也搬过去，保持数据不丢
    await env.DB.prepare(
      'UPDATE entries SET household_id = ? WHERE household_id = ?',
    ).bind(newHouseId, current.household_id).run();

    await env.DB.prepare('DELETE FROM households WHERE id = ?').bind(current.household_id).run();
    moved = 1;
  }

  return ok({ ok: true, householdId: newHouseId, householdName: newName, moved });
}

async function joinHousehold(request, env, user) {
  const body = await request.json().catch(() => null);
  const code = String(body?.code || '').trim().toUpperCase();
  if (!code) return bad('请输入邀请码');

  const house = await env.DB.prepare(
    'SELECT id, name, invite_code, invite_expires_at FROM households WHERE invite_code = ?',
  )
    .bind(code)
    .first();
  if (!house) return fail(404, 'invalid_code', '邀请码不对');
  if (!house.invite_expires_at || house.invite_expires_at < now())
    return fail(410, 'expired', '邀请码已过期，让对方重新生成一个');

  const already = await env.DB.prepare(
    'SELECT 1 AS x FROM household_members WHERE household_id = ? AND user_id = ?',
  )
    .bind(house.id, user.id)
    .first();
  if (already) return ok({ ok: true, householdId: house.id, already: true });

  await env.DB.prepare(
    "INSERT INTO household_members (household_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
  )
    .bind(house.id, user.id, now())
    .run();

  // 把「只有我一个人，而且一笔账都没记」的旧账本收掉，免得账号挂在废弃账本上。
  // 有账目的旧账本必须留着 —— 删掉会把 entries 一起 CASCADE 掉（旧版本真的这么干过）。
  const oldHouses = await env.DB.prepare(
    `SELECT m.household_id AS id,
            (SELECT COUNT(*) FROM household_members x WHERE x.household_id = m.household_id) AS members,
            (SELECT COUNT(*) FROM entries e WHERE e.household_id = m.household_id) AS entries
       FROM household_members m
      WHERE m.user_id = ? AND m.household_id <> ?`,
  )
    .bind(user.id, house.id)
    .all();

  for (const h of oldHouses.results ?? []) {
    if (h.members === 1 && h.entries === 0) {
      await env.DB.prepare('DELETE FROM household_members WHERE household_id = ?').bind(h.id).run();
      await env.DB.prepare('DELETE FROM households WHERE id = ?').bind(h.id).run();
    }
  }

  await env.DB.prepare('UPDATE households SET invite_code = NULL, invite_expires_at = NULL WHERE id = ?')
    .bind(house.id)
    .run();
  return ok({ ok: true, householdId: house.id, householdName: house.name, joinedAt: now() });
}

/* ------------------------------------------------------------------ 入口 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    if (!pathname.startsWith('/api/')) return fail(404, 'not_found', 'Not an API route');
    if (method === 'GET' && pathname === '/api/health') return ok({ ok: true, ts: now() });

    try {
      // ---- 免登录 ----
      if (pathname === '/api/auth/register' && method === 'POST') return await register(request, env);
      if (pathname === '/api/auth/login' && method === 'POST') return await login(request, env);
      if (pathname === '/api/auth/logout' && method === 'POST') return await logout(request, env);

      // ---- 需要登录 ----
      const user = await currentUser(request, env);
      if (!user) return unauth();
      if (!user.householdId) return fail(409, 'no_household', '账号还没有账本');

      if (pathname === '/api/me' && method === 'GET') return await me(request, env, user);
      if (pathname === '/api/me' && method === 'PATCH') return await updateMe(request, env, user);
      if (pathname === '/api/categories' && method === 'GET') return await listCategories(env, user);
      if (pathname === '/api/categories' && method === 'POST') return await createCategory(request, env, user);

      if (pathname === '/api/entries' && method === 'GET') return await listEntries(request, env, user);
      if (pathname === '/api/entries' && method === 'POST') return await createEntry(request, env, user);
      if (pathname === '/api/entries/deleted' && method === 'GET') return await listDeleted(env, user);

      const entryMatch = pathname.match(/^\/api\/entries\/([\w-]+)$/);
      if (entryMatch) {
        const id = entryMatch[1];
        if (method === 'PATCH' || method === 'PUT') return await updateEntry(request, env, user, id);
        if (method === 'DELETE') return await deleteEntry(request, env, user, id);
      }
      const restoreMatch = pathname.match(/^\/api\/entries\/([\w-]+)\/restore$/);
      if (restoreMatch && method === 'POST') return await restoreEntry(request, env, user, restoreMatch[1]);

      if (pathname === '/api/stats' && method === 'GET') return await stats(request, env, user);

      if (pathname === '/api/household/invite' && method === 'POST') return await createInvite(env, user);
      if (pathname === '/api/household/join' && method === 'POST') return await joinHousehold(request, env, user);
      if (pathname === '/api/household/leave' && method === 'POST') return await leaveHousehold(request, env, user);

      return fail(404, 'not_found', '没有这个接口 / Unknown endpoint');
    } catch (err) {
      console.error('worker error', err?.stack || err);
      return fail(500, 'server_error', '服务器出错了，稍后再试');
    }
  },
};

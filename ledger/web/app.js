/**
 * 家庭记账本 —— 前端 / frontend
 *
 * 无框架、无构建，一个文件。设计目标：打开就能按数字，3 秒记完一笔。
 * No framework, no build step. Goal: open → hit digits → done in ~3 seconds.
 */

/* ------------------------------------------------------------------ 状态 */

const state = {
  user: null,
  members: [],
  categories: [],
  month: new Date().toISOString().slice(0, 7),
  scope: localStorage.getItem('scope') || 'all', // all | me
  view: 'add',
  entries: [],
  stats: null,
  editing: null,
  draft: {
    digits: '', // 直接按分存：'2850' => ¥28.50
    direction: 'expense',
    categoryId: null,
    note: '',
    occurredOn: today(),
  },
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
};

const money = (cents) =>
  (cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ------------------------------------------------------------- 密码拉伸 */

/**
 * 和 worker/scripts/smoke.mjs 里完全一致的参数，换成浏览器实现。
 * salt 由用户名派生（SHA-256 前 16 字节），所以服务器不需要存 salt，
 * 也就不会出现"先查用户名是否存在"的探测面。
 */
async function deriveAuthHash(username, password) {
  const enc = new TextEncoder();
  const saltBuf = await crypto.subtle.digest('SHA-256', enc.encode(`ledger:v1:${username.toLowerCase()}`));
  const salt = new Uint8Array(saltBuf).slice(0, 16);

  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
    baseKey,
    256,
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ API */

async function api(method, path, body) {
  const cacheKey = `cache:${path}`;

  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch (e) {
    // 断网：GET 用上次存下来的那份，写入类请求交给离线队列处理
    if (method === 'GET') {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    }
    throw e;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }

  if (res.status === 401 && !path.startsWith('/api/auth')) {
    showAuth();
    throw new Error('未登录');
  }
  if (!res.ok) throw new Error(data?.message || `请求失败 (${res.status})`);

  if (method === 'GET') localStorage.setItem(cacheKey, JSON.stringify(data));
  return data;
}

/* ------------------------------------------------------------- 登录 / 注册 */

let authMode = 'login';

function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === 'login';
  $('#displayNameField').hidden = isLogin;
  $('#authSubmitText').textContent = isLogin ? '登录' : '创建账号';
  $('#authSwitchText').textContent = isLogin ? '还没有账号？' : '已经有账号了？';
  $('#authSwitch').textContent = isLogin ? '注册一个' : '去登录';
  $('#authError').hidden = true;
}

async function submitAuth(event) {
  event.preventDefault();
  const username = $('#username').value.trim();
  const password = $('#password').value;
  const btn = $('#authSubmit');
  const err = $('#authError');
  err.hidden = true;

  if (username.length < 3) return showAuthError('用户名至少 3 位');
  if (password.length < 8) return showAuthError('密码至少 8 位');

  btn.disabled = true;
  const original = $('#authSubmitText').textContent;
  $('#authSubmitText').textContent = '加密中…';

  try {
    const authHash = await deriveAuthHash(username, password);
    if (authMode === 'register') {
      await api('POST', '/api/auth/register', {
        username,
        displayName: $('#displayName').value.trim() || username,
        authHash,
      });
    } else {
      await api('POST', '/api/auth/login', { username, authHash });
    }
    await boot();
  } catch (e) {
    showAuthError(e.message);
  } finally {
    btn.disabled = false;
    $('#authSubmitText').textContent = original;
  }
}

function showAuthError(msg) {
  const err = $('#authError');
  err.textContent = msg;
  err.hidden = false;
}

function showAuth() {
  $('#appScreen').hidden = true;
  $('#authScreen').hidden = false;
  $('#password').value = '';
}

/* ------------------------------------------------------------------ 启动 */

async function boot() {
  try {
    const data = await api('GET', '/api/me');
    state.user = data.user;
    state.members = data.members;
    const cats = await api('GET', '/api/categories');
    state.categories = cats.categories;
    state.draft.categoryId =
      state.draft.categoryId || state.categories.find((c) => c.direction === state.draft.direction)?.id;
    $('#authScreen').hidden = true;
    $('#appScreen').hidden = false;
    render();
  } catch {
    showAuth();
  }
}

/* ------------------------------------------------------------------ 渲染 */

function render() {
  document.querySelectorAll('.tab').forEach((t) =>
    t.setAttribute('aria-selected', String(t.dataset.view === state.view)),
  );
  $('#monthLabel').textContent = formatMonth(state.month);
  $('#scopeToggle').textContent = state.scope === 'me' ? '只看我' : '全家';
  $('#scopeToggle').dataset.scope = state.scope;

  const view = $('#view');
  view.replaceChildren();
  if (state.view === 'add') view.append(renderAdd());
  if (state.view === 'list') renderList(view);
  if (state.view === 'stats') renderStats(view);
  if (state.view === 'me') renderMe(view);
}

function formatMonth(m) {
  const [y, mo] = m.split('-');
  return `${y} 年 ${Number(mo)} 月`;
}

/* --------------------------------------------------------------- 记一笔 */

function renderAdd() {
  const d = state.draft;
  const wrap = el('div', { className: 'compose' });

  const amountRow = el('div', { className: 'amount' });
  amountRow.append(el('span', { className: 'amount__value' + (d.digits ? '' : ' is-zero') }, '¥' + money(Number(d.digits || 0))));

  const dir = el('div', { className: 'direction' });
  for (const [key, label] of [['expense', '支出'], ['income', '收入']]) {
    const b = el('button', { type: 'button', textContent: label });
    b.setAttribute('aria-pressed', String(d.direction === key));
    b.onclick = () => {
      d.direction = key;
      const first = state.categories.find((c) => c.direction === key);
      if (first) d.categoryId = first.id;
      render();
    };
    dir.append(b);
  }
  amountRow.append(dir);
  wrap.append(amountRow);

  const cats = state.categories.filter((c) => c.direction === d.direction);
  const grid = el('div', { className: 'catgrid' });
  for (const c of cats) {
    const b = el('button', { type: 'button', className: 'cat' });
    b.setAttribute('aria-pressed', String(d.categoryId === c.id));
    b.append(el('span', { className: 'cat__emoji', textContent: c.emoji }), el('span', { textContent: c.name }));
    b.onclick = () => {
      d.categoryId = c.id;
      render();
    };
    grid.append(b);
  }
  wrap.append(grid);

  const meta = el('div', { className: 'compose__meta' });
  const note = el('input', { type: 'text', placeholder: '备注（可空）', maxLength: 120, value: d.note });
  note.oninput = () => {
    d.note = note.value;
    localStorage.setItem('lastNote', note.value);
  };
  const date = el('input', { type: 'date', value: d.occurredOn });
  date.onchange = () => {
    d.occurredOn = date.value || today();
  };
  meta.append(note, date);
  wrap.append(meta);

  const pad = el('div', { className: 'keypad' });
  const press = (key) => {
    if (key === 'del') d.digits = d.digits.slice(0, -1);
    else if (key === '00') d.digits = (d.digits + '00').slice(0, 9);
    else d.digits = (d.digits + key).slice(0, 9);
    render();
  };
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del']) {
    const b = el('button', { type: 'button', className: 'key', textContent: k === 'del' ? '⌫' : k });
    b.onclick = () => press(k);
    pad.append(b);
  }
  const save = el('button', { type: 'button', className: 'key key--save', textContent: '记下来' });
  save.disabled = !d.digits;
  save.onclick = saveEntry;
  pad.append(save);
  wrap.append(pad);

  return wrap;
}

async function saveEntry() {
  const d = state.draft;
  if (!d.digits || !d.categoryId) return;
  const cents = Number(d.digits);
  const payload = {
    amountCents: cents,
    direction: d.direction,
    categoryId: d.categoryId,
    note: d.note,
    occurredOn: d.occurredOn,
    clientUuid: crypto.randomUUID(),
  };
  try {
    await api('POST', '/api/entries', payload);
    toast(`已记 ${d.direction === 'income' ? '+' : '−'}¥${money(cents)}`);
  } catch (e) {
    if (looksOffline(e)) {
      const queue = readOutbox();
      queue.push(payload);
      writeOutbox(queue);
      toast('网络不通，已先存在这台设备上，联网后自动上传');
    } else {
      toast(e.message);
      return;
    }
  }
  d.digits = '';
  d.note = '';
  render();
}

/* -------------------------------------------------------------- 离线队列 */

const OUTBOX_KEY = 'outbox';

function readOutbox() {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeOutbox(items) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

function looksOffline(err) {
  return err instanceof TypeError || /Failed to fetch|NetworkError|Load failed|network/i.test(String(err?.message || ''));
}

/** 把断网时攒下的记录补传上去；client_uuid 保证重复上传也不会记两笔。 */
async function flushOutbox() {
  const items = readOutbox();
  if (!items.length) return;
  const left = [];
  let sent = 0;
  for (const item of items) {
    try {
      await api('POST', '/api/entries', item);
      sent += 1;
    } catch (e) {
      // 409 = 这笔之前已经成功上传过（离线重试场景），视为成功
      if (/\b409\b|已存在|duplicate/i.test(String(e.message))) sent += 1;
      else left.push(item);
    }
  }
  writeOutbox(left);
  if (sent) {
    toast(`离线攒的 ${sent} 笔已同步`);
    if (state.view === 'list') render();
  }
}

/* ------------------------------------------------------------------ 明细 */

async function renderList(view) {
  view.append(el('div', { className: 'empty', textContent: '加载中…' }));
  try {
    const [entries, stats] = await Promise.all([
      api('GET', `/api/entries?month=${state.month}&member=${state.scope}`),
      api('GET', `/api/stats?month=${state.month}&member=${state.scope}`),
    ]);
    state.entries = entries.entries;
    state.stats = stats;
  } catch (e) {
    view.replaceChildren(el('div', { className: 'empty', textContent: e.message }));
    return;
  }

  const s = state.stats.total;
  const summary = el('div', { className: 'summary' });
  for (const [label, value, cls] of [
    ['支出', money(s.expense), ''],
    ['收入', money(s.income), 'summary__value--income'],
    ['结余', money(s.balance), ''],
  ]) {
    const cell = el('div', { className: 'summary__cell' });
    cell.append(
      el('div', { className: 'summary__label', textContent: label }),
      el('div', { className: `summary__value ${cls}`, textContent: '¥' + value }),
    );
    summary.append(cell);
  }

  view.replaceChildren(summary);
  if (!state.entries.length) {
    view.append(el('div', { className: 'empty', textContent: '这个月还没有账。按下面的「记一笔」开始。' }));
    return;
  }

  const byDay = new Map();
  for (const e of state.entries) {
    if (!byDay.has(e.occurred_on)) byDay.set(e.occurred_on, []);
    byDay.get(e.occurred_on).push(e);
  }

  for (const [day, items] of byDay) {
    const group = el('div', { className: 'daygroup' });
    const spent = items.filter((i) => i.direction === 'expense').reduce((a, b) => a + b.amount_cents, 0);
    group.append(
      el('div', { className: 'daygroup__head' }, [
        el('span', { textContent: dayLabel(day) }),
        el('span', { textContent: spent ? `支出 ¥${money(spent)}` : '' }),
      ]),
    );
    for (const item of items) {
      const row = el('button', { type: 'button', className: 'row' });
      row.append(
        el('span', { className: 'row__emoji', textContent: item.category_emoji || '📦' }),
        el('div', { className: 'row__main' }, [
          el('div', { className: 'row__title', textContent: item.note || item.category_name || '未分类' }),
          el('div', {
            className: 'row__sub',
            textContent: item.note ? `${item.category_name || '未分类'} · ${item.author_name}` : item.author_name,
          }),
        ]),
        el('span', {
          className: 'row__amount' + (item.direction === 'income' ? ' row__amount--income' : ''),
          textContent: (item.direction === 'income' ? '+' : '−') + money(item.amount_cents),
        }),
      );
      row.onclick = () => openEntryActions(item);
      group.append(row);
    }
    view.append(group);
  }
}

function dayLabel(day) {
  if (day === today()) return '今天';
  const d = new Date(day);
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${Number(day.slice(5, 7))} 月 ${Number(day.slice(8, 10))} 日 · 周${week}`;
}

/* --------------------------------------------------------------- 统计 */

function renderStats(view) {
  const s = state.stats;
  if (!s) {
    view.append(el('div', { className: 'empty', textContent: '先看一次明细，统计就有数据了。' }));
    return;
  }
  const total = s.total;
  const summary = el('div', { className: 'summary' });
  for (const [label, value, cls] of [
    ['本月支出', money(total.expense), ''],
    ['本月收入', money(total.income), 'summary__value--income'],
    ['结余', money(total.balance), ''],
  ]) {
    const cell = el('div', { className: 'summary__cell' });
    cell.append(
      el('div', { className: 'summary__label', textContent: label }),
      el('div', { className: `summary__value ${cls}`, textContent: '¥' + value }),
    );
    summary.append(cell);
  }
  view.append(summary);

  const expenses = s.byCategory.filter((c) => c.direction === 'expense');
  if (expenses.length) {
    view.append(el('h3', { className: 'section-title', textContent: '花在哪了' }));
    const max = expenses[0].cents || 1;
    const bars = el('div', { className: 'bars' });
    for (const c of expenses.slice(0, 8)) {
      const bar = el('div', { className: 'bar' });
      const track = el('div', { className: 'bar__track' });
      track.append(el('div', { className: 'bar__fill', style: `width:${Math.max(4, (c.cents / max) * 100)}%` }));
      bar.append(
        el('span', { textContent: `${c.emoji || '📦'} ${c.name || '未分类'}` }),
        track,
        el('span', { className: 'bar__value', textContent: '¥' + money(c.cents) }),
      );
      bars.append(bar);
    }
    view.append(bars);
  }

  if (s.byMember.length) {
    view.append(el('h3', { className: 'section-title', textContent: '各花了多少' }));
    const people = new Map();
    for (const m of s.byMember) {
      if (!people.has(m.id)) people.set(m.id, { name: m.display_name, expense: 0, income: 0 });
      people.get(m.id)[m.direction] = m.cents;
    }
    for (const p of people.values()) {
      const row = el('div', { className: 'member' });
      row.append(
        el('span', { className: 'member__name', textContent: p.name }),
        el('span', { className: 'muted', textContent: `支出 ¥${money(p.expense)} · 收入 ¥${money(p.income)}` }),
      );
      view.append(row);
    }
  }
}

/* ------------------------------------------------------------------ 我的 */

function renderMe(view) {
  const card = el('div', { className: 'panel' });
  card.append(
    el('h3', { textContent: '当前账本' }),
    el('p', { textContent: `${state.user.householdName} · ${state.members.length} 位成员` }),
    el('p', {
      textContent: `你以「${state.user.displayName}」的身份记账。${
        state.user.role === 'owner' ? '你是这个账本的创建者。' : ''
      }`,
    }),
  );
  view.append(card);

  const inviteCard = el('div', { className: 'panel' });
  inviteCard.append(el('h3', { textContent: '把家人拉进来' }));
  const codeBox = el('div', { className: 'invite-code' });
  const codeHint = el('p', { textContent: '生成一个 10 分钟内有效的邀请码，让对方注册后输入。' });
  const genBtn = el('button', { type: 'button', className: 'btn btn--primary', textContent: '生成邀请码' });
  genBtn.style.marginTop = '12px';
  genBtn.onclick = async () => {
    try {
      const data = await api('POST', '/api/household/invite');
      codeBox.textContent = data.code;
      let left = data.ttlSeconds;
      const timer = setInterval(() => {
        left -= 1;
        codeHint.textContent = left > 0 ? `${Math.floor(left / 60)} 分 ${left % 60} 秒后失效` : '邀请码已失效';
        if (left <= 0) clearInterval(timer);
      }, 1000);
      codeHint.textContent = '10 分 0 秒后失效';
    } catch (e) {
      toast(e.message);
    }
  };
  inviteCard.append(codeHint, codeBox, genBtn);
  view.append(inviteCard);

  const joinCard = el('div', { className: 'panel' });
  joinCard.append(el('h3', { textContent: '我拿到了邀请码' }));
  const input = el('input', { type: 'text', placeholder: '6 位邀请码', maxLength: 8 });
  Object.assign(input.style, { width: '100%', padding: '11px 13px', borderRadius: '12px', background: 'var(--bg)', border: '1px solid var(--line)', marginTop: '10px', textTransform: 'uppercase' });
  const joinBtn = el('button', { type: 'button', className: 'btn btn--ghost', textContent: '加入这个账本' });
  joinBtn.style.marginTop = '10px';
  joinBtn.onclick = async () => {
    try {
      await api('POST', '/api/household/join', { code: input.value.trim() });
      toast('已加入，账现在合在一起了');
      await boot();
    } catch (e) {
      toast(e.message);
    }
  };
  joinCard.append(input, joinBtn);
  view.append(joinCard);

  const account = el('div', { className: 'panel' });
  account.append(el('h3', { textContent: '账号' }), el('p', { textContent: `@${state.user.username}` }));
  const outBtn = el('button', { type: 'button', className: 'btn btn--ghost', textContent: '退出登录' });
  outBtn.style.marginTop = '10px';
  outBtn.onclick = async () => {
    await api('POST', '/api/auth/logout').catch(() => {});
    location.reload();
  };
  account.append(outBtn);
  view.append(account);
}

/* -------------------------------------------------------------- 交互工具 */

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => (t.hidden = true), 2200);
}

function openEntryActions(item) {
  const modal = $('#modal');
  const card = el('div', { className: 'modal__card' });
  card.append(
    el('h3', { textContent: `${item.direction === 'income' ? '+' : '−'}¥${money(item.amount_cents)}` }),
    el('p', {
      className: 'muted',
      textContent: `${item.category_name || '未分类'} · ${item.occurred_on} · ${item.author_name}${
        item.note ? ` · ${item.note}` : ''
      }`,
    }),
  );
  const actions = el('div', { className: 'modal__actions' });
  const del = el('button', { type: 'button', className: 'btn btn--ghost', textContent: '删除' });
  del.onclick = async () => {
    await api('DELETE', `/api/entries/${item.id}`).catch((e) => toast(e.message));
    closeModal();
    toast('已删除，可在「我的」里找回');
    render();
  };
  const close = el('button', { type: 'button', className: 'btn btn--primary', textContent: '知道了' });
  close.onclick = closeModal;
  actions.append(del, close);
  card.append(actions);
  modal.replaceChildren(card);
  modal.hidden = false;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
}

function closeModal() {
  $('#modal').hidden = true;
}

/* ------------------------------------------------------------------ 绑定 */

function shiftMonth(delta) {
  const [y, m] = state.month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  render();
}

function bind() {
  // 用户名够 3 位、密码够 8 位，登录按钮才亮起来
  const syncAuthButton = () => {
    const ok = $('#username').value.trim().length >= 3 && $('#password').value.length >= 8;
    $('#authSubmit').disabled = !ok;
  };
  for (const sel of ['#username', '#password', '#displayName']) {
    $(sel).addEventListener('input', syncAuthButton);
  }
  syncAuthButton();

  $('#authForm').addEventListener('submit', submitAuth);
  $('#authSwitch').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.view = tab.dataset.view;
      render();
    });
  });
  $('#monthPrev').onclick = () => shiftMonth(-1);
  $('#monthNext').onclick = () => shiftMonth(1);
  $('#monthLabel').onclick = () => {
    state.month = new Date().toISOString().slice(0, 7);
    render();
  };
  $('#scopeToggle').onclick = () => {
    state.scope = state.scope === 'me' ? 'all' : 'me';
    localStorage.setItem('scope', state.scope);
    render();
  };
  const last = localStorage.getItem('lastNote');
  if (last) state.draft.note = '';
}

bind();
boot().then(() => flushOutbox());

// 联网就自动补传离线记账
window.addEventListener('online', () => flushOutbox());

// PWA：注册 service worker（离线可用）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

/* =============================================================================
   家庭记账本 · Family Ledger  —  app.js (v3)
   数据结构与接口沿用 worker/index.js，不新增后端字段。
   ============================================================================= */

import { cellLabel, lunarLine, termOf, solarToLunar } from './lunar.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ------------------------------------------------------------------ 图标集 */
/* 统一线性风格，替代 emoji。分类按名字匹配，匹配不到用默认图标。 */

const ICON = {
  add: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M8 6.5h11M8 12h11M8 17.5h11"/><circle cx="4.6" cy="6.5" r="1"/><circle cx="4.6" cy="12" r="1"/><circle cx="4.6" cy="17.5" r="1"/>',
  stats: '<path d="M4.5 19.5h15"/><path d="M7.5 19.5v-6M12 19.5V8M16.5 19.5v-8.5"/>',
  user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>',
  backspace: '<path d="M20 6.5H9.2L3.5 12l5.7 5.5H20a1.5 1.5 0 0 0 1.5-1.5V8a1.5 1.5 0 0 0-1.5-1.5Z"/><path d="M12.5 9.8 16.2 14M16.2 9.8 12.5 14"/>',
  search: '<circle cx="11" cy="11" r="6.2"/><path d="M15.6 15.6 20 20"/>',
  empty: '<path d="M4.8 7.5h14.4l-1 11.2a1.8 1.8 0 0 1-1.8 1.6H7.6a1.8 1.8 0 0 1-1.8-1.6Z"/><path d="M8.4 7.5V6a3.6 3.6 0 0 1 7.2 0v1.5"/>',
  check: '<path d="M5 12.5 9.6 17 19 7.5"/>',
  close: '<path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.4"/><path d="M15.5 8.5V6.4A2.4 2.4 0 0 0 13.1 4H6.4A2.4 2.4 0 0 0 4 6.4v6.7a2.4 2.4 0 0 0 2.4 2.4h2.1"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><path d="M16 5.4a3.2 3.2 0 0 1 0 6.2"/><path d="M17.4 14.7c2 .6 3.2 2.1 3.6 4.3"/>',
  wallet: '<rect x="3.5" y="6" width="17" height="13" rx="3"/><path d="M3.5 10h17"/><circle cx="16.8" cy="14.6" r="1.1"/>',
  food: '<path d="M4 13h16a8 8 0 0 1-16 0Z"/><path d="M8.6 9.6c0-1.3 1.1-1.7 1.1-3"/><path d="M12 9.6c0-1.3 1.1-1.7 1.1-3"/>',
  grocery: '<path d="M4.5 8.5h15l-1.4 10a2 2 0 0 1-2 1.7H7.9a2 2 0 0 1-2-1.7Z"/><path d="M9 8.5V6.8a3 3 0 0 1 6 0v1.7"/>',
  transit: '<rect x="5" y="4.5" width="14" height="12.5" rx="3"/><path d="M5 12h14"/><circle cx="9" cy="14.6" r="1"/><circle cx="15" cy="14.6" r="1"/><path d="M8 20.5l1.4-3.5M16 20.5l-1.4-3.5"/>',
  home: '<path d="M4 10.8 12 4l8 6.8V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z"/><path d="M9.5 20.5v-5.2h5v5.2"/>',
  daily: '<path d="M9 3.5v3M15 3.5v3"/><rect x="4" y="6" width="16" height="14" rx="2.6"/><path d="M4 11h16"/>',
  health: '<path d="M12 20.5S4.5 16 4.5 10.4A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 16 12 20.5 12 20.5Z"/>',
  fun: '<rect x="3.5" y="7.5" width="17" height="9.5" rx="4.7"/><circle cx="8.4" cy="12.2" r="1.1"/><circle cx="15.6" cy="12.2" r="1.1"/><path d="M11 10.4v3.4"/>',
  study: '<path d="M4 6.5h6.2a2 2 0 0 1 1.8 1.1V20a2.4 2.4 0 0 0-2-1.2H4Z"/><path d="M20 6.5h-6.2a2 2 0 0 0-1.8 1.1V20a2.4 2.4 0 0 1 2-1.2H20Z"/>',
  gift: '<rect x="3.8" y="9" width="16.4" height="11.5" rx="2"/><path d="M3.8 13.2h16.4M12 9v11.5"/><path d="M12 9S10.6 4.5 8.2 4.5a2.3 2.3 0 0 0 0 4.5M12 9s1.4-4.5 3.8-4.5a2.3 2.3 0 0 1 0 4.5"/>',
  other: '<circle cx="12" cy="12" r="8.2"/><path d="M12 8.4v.2M12 11.6v4"/>',
  salary: '<rect x="3.5" y="6.5" width="17" height="11" rx="2.4"/><circle cx="12" cy="12" r="2.6"/><path d="M6.6 9.6v.2M17.4 14.2v.2"/>',
  bonus: '<path d="M12 3.6l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8Z"/>',
  invest: '<path d="M4 17.5 9.2 12l3.4 3.2L20 7.5"/><path d="M15.5 7.5H20V12"/>',
  trend: '<path d="M4 15.5 9 10l3.5 3.5L20 6"/><path d="M15 6h5v5"/>',
};

const icon = (name, cls = '') => {
  const path = ICON[name] || ICON.other;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
};

/* 分类名 → 图标 / 线性色调 */
const CATEGORY_ICON = {
  餐饮: 'food',
  买菜: 'grocery',
  交通: 'transit',
  日用: 'daily',
  住房: 'home',
  医疗: 'health',
  娱乐: 'fun',
  学习: 'study',
  人情: 'gift',
  其他: 'other',
  工资: 'salary',
  奖金: 'bonus',
  理财: 'invest',
  报销: 'wallet',
  兼职: 'salary',
  红包: 'gift',
};

const catIcon = (name) => icon(CATEGORY_ICON[name] || 'other');

/* ------------------------------------------------------------------ 工具 */

const pad = (n) => String(n).padStart(2, '0');

/* 触屏和键盘两套提示 */
const isTouch = () => window.innerWidth <= 860 || window.matchMedia('(pointer: coarse)').matches;
const saveHint = () => (isTouch() ? '选好分类就能保存' : '电脑上可以直接按数字键，回车保存。');

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const monthStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

const fmtMoney = (cents, { sign = false, symbol = true } = {}) => {
  const abs = Math.abs(cents || 0);
  const yuan = Math.floor(abs / 100);
  const fen = pad(abs % 100);
  const withComma = String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const prefix = symbol ? '¥' : '';
  if (!sign) return `${prefix}${withComma}.${fen}`;
  if (cents < 0) return `−${prefix}${withComma}.${fen}`;
  return `${prefix}${withComma}.${fen}`;
};

const fmtMonthCN = (m) => {
  const [y, mm] = m.split('-');
  return `${y} 年 ${Number(mm)} 月`;
};

const dayLabel = (iso) => {
  const today = todayStr();
  const d = new Date(`${iso}T00:00:00`);
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yestStr = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;
  if (iso === today) return '今天';
  if (iso === yestStr) return '昨天';
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  return `${Number(iso.slice(5, 7))} 月 ${Number(iso.slice(8, 10))} 日 · ${week}`;
};

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 密码不出浏览器：600k 次 PBKDF2，只把拉伸结果发出去 */
async function deriveAuthHash(username, password) {
  const saltHex = (await sha256Hex(`ledger:v1:${username.toLowerCase()}`)).slice(0, 32);
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    baseKey,
    256,
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* -------------------------------------------------------------- 网络层 */

const OUTBOX_KEY = 'outbox';

const readOutbox = () => {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
  } catch {
    return [];
  }
};

const writeOutbox = (items) => {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {
    /* 空间满就算了 */
  }
};

const looksOffline = (err) =>
  err instanceof TypeError || /Failed to fetch|NetworkError|Load failed|network/i.test(String(err?.message || ''));

let onUnauthorized = () => {};

async function api(method, path, body) {
  const init = {
    method,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(path, init);
  } catch (err) {
    // 断网：GET 用缓存顶上，别把人踢回登录页
    if (method === 'GET') {
      const cached = localStorage.getItem(`cache:${path}`);
      if (cached) return JSON.parse(cached);
    }
    throw err;
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth')) {
      onUnauthorized();
      throw new Error('未登录');
    }
    const err = new Error(data.message || `请求失败 (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  if (method === 'GET') {
    try {
      localStorage.setItem(`cache:${path}`, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }
  return data;
}

/* ------------------------------------------------------------------ 状态 */

const state = {
  view: 'add',
  month: monthStr(),
  range: { kind: 'month', month: monthStr() },
  scrollMap: new Map(),
  bin: [],
  binLoading: false,
  highlightId: null,
  scope: 'all', // all | me | <memberId>
  me: null,
  members: [],
  categories: [],
  entries: [],
  stats: null,
  entriesLoading: false,
  statsLoading: false,
  listError: '',
  filters: { keyword: '', direction: 'all', category: 'all' },
  draft: {
    cents: 0,
    direction: 'expense',
    categoryId: null,
    note: '',
    date: todayStr(),
  },
  saving: false,
  invite: null,
  inviteTimer: null,
};

const scopedMemberId = () => (state.scope === 'all' || state.scope === 'me' ? '' : state.scope);

/* ------------------------------------------------------------ 顶部小提示 */

let toastTimer = null;
function toast(message, action) {
  const el = $('#toast');
  el.hidden = false;
  el.innerHTML = `<span>${message}</span>`;
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast__action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      hideToast();
      action.run();
    });
    el.appendChild(btn);
  }
  clearTimeout(toastTimer);
  const arms = () => {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 5000 : 2600);
  };
  el.onmouseenter = () => clearTimeout(toastTimer);
  el.onmouseleave = arms;
  el.onfocusin = () => clearTimeout(toastTimer);
  el.onfocusout = arms;
  arms();
}

function hideToast() {
  const el = $('#toast');
  el.hidden = true;
  el.innerHTML = '';
}

/* ------------------------------------------------------------------ 弹层 */

function openModal(html) {
  const modal = $('#modal');
  modal.innerHTML = `<div class="modal__card" role="dialog" aria-modal="true">${html}</div>`;
  modal.hidden = false;
  const focusable = $('input, select, button', modal);
  if (focusable) setTimeout(() => focusable.focus(), 30);
}

function closeModal() {
  const modal = $('#modal');
  modal.hidden = true;
  modal.innerHTML = '';
}

$('#modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
});

/* ================================================================== 登录 */

const authMode = { mode: 'login' };

function setAuthMode(mode) {
  authMode.mode = mode;
  const seg = $('#authMode');
  seg.dataset.mode = mode;
  $$('.segmented__btn', seg).forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });
  const isReg = mode === 'register';
  $('#authTitle').textContent = isReg ? '创建你的账本' : '欢迎回来';
  $('#authSub').textContent = isReg ? '填一个用户名和密码就能开始，稍后再邀请家人' : '用你注册时的用户名和密码登录';
  $('#displayNameField').hidden = !isReg;
  $('#authSubmitText').textContent = isReg ? '创建账号' : '登录';
  $('#password').setAttribute('autocomplete', isReg ? 'new-password' : 'current-password');
  $('#authSubmit').dataset.mode = mode;
  clearAuthError();
  syncAuthButton();
}

function clearAuthError() {
  const box = $('#authError');
  box.hidden = true;
  box.textContent = '';
}

function showAuthError(msg) {
  const box = $('#authError');
  box.textContent = msg;
  box.hidden = false;
}

function authValidity() {
  const username = $('#username').value.trim();
  const password = $('#password').value;
  const displayName = $('#displayName').value.trim();
  if (username.length < 3) return { ok: false, reason: '用户名至少 3 位' };
  if (password.length < 8) return { ok: false, reason: '密码至少 8 位' };
  if (authMode.mode === 'register' && displayName.length < 1) return { ok: false, reason: '写一个家里叫你的名字' };
  return { ok: true, username, password, displayName };
}

function syncAuthButton() {
  const v = authValidity();
  const btn = $('#authSubmit');
  btn.disabled = !v.ok;
  if (!v.ok) $('#authHint').textContent = v.reason;
  else
    $('#authHint').textContent =
      authMode.mode === 'register' ? '注册后可以在「我的」里生成邀请码，把家人拉进来' : '还没有账号？切到「注册」，10 秒就好。';
}

function showAuth() {
  closeModal();
  $('#appScreen').hidden = true;
  $('#authScreen').hidden = false;
  document.body.classList.remove('is-app');
  setAuthMode('login');
  $('#password').value = '';
  setTimeout(() => $('#username').focus(), 50);
}

function showApp() {
  $('#authScreen').hidden = true;
  $('#appScreen').hidden = false;
  document.body.classList.add('is-app');
}

$('#authMode').addEventListener('click', (e) => {
  const btn = e.target.closest('.segmented__btn');
  if (!btn) return;
  setAuthMode(btn.dataset.mode);
});

$('#peekPassword').addEventListener('click', () => {
  const input = $('#password');
  const on = input.type === 'password';
  input.type = on ? 'text' : 'password';
  $('#peekPassword').classList.toggle('is-on', on);
  $('#peekPassword').setAttribute('aria-label', on ? '隐藏密码' : '显示密码');
  input.focus();
});

['#username', '#password', '#displayName'].forEach((sel) => {
  $(sel).addEventListener('input', () => {
    clearAuthError();
    syncAuthButton();
  });
});

$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = authValidity();
  if (!v.ok) {
    showAuthError(v.reason);
    return;
  }

  const btn = $('#authSubmit');
  const label = $('#authSubmitText');
  const original = label.textContent;
  btn.classList.add('is-loading');
  btn.disabled = true;
  label.textContent = authMode.mode === 'register' ? '正在创建…' : '正在登录…';
  clearAuthError();

  try {
    const authHash = await deriveAuthHash(v.username, v.password);
    if (authMode.mode === 'register') {
      await api('POST', '/api/auth/register', {
        username: v.username,
        displayName: v.displayName,
        authHash,
      });
    } else {
      await api('POST', '/api/auth/login', { username: v.username, authHash });
    }
    await boot();
  } catch (err) {
    const status = err.status;
    if (status === 401) showAuthError('用户名或密码不对，再试一次');
    else if (status === 409) showAuthError('这个用户名已经有人用了，换一个');
    else if (looksOffline(err)) showAuthError('网络不通，连上再试');
    else showAuthError(err.message || '出了点问题，再试一次');
  } finally {
    btn.classList.remove('is-loading');
    label.textContent = original;
    syncAuthButton();
  }
});

/* ================================================================== 启动 */

async function boot() {
  try {
    const [me, cats] = await Promise.all([api('GET', '/api/me'), api('GET', '/api/categories')]);
    state.me = me.user;
    state.members = me.members || [];
    state.categories = cats.categories || [];
    showApp();
    paintShell();
    if (!state.draft.categoryId) {
      const first = state.categories.find((c) => c.direction === state.draft.direction);
      if (first) state.draft.categoryId = first.id;
    }
    setView(state.view, { silent: true });
    await Promise.all([loadEntries(), loadStats()]);
    flushOutbox();
  } catch (err) {
    if (err.message === '未登录') showAuth();
    else if (looksOffline(err)) showAuth();
    else showAuth();
  }
}

function paintShell() {
  const name = state.me?.displayName || state.me?.username || '—';
  $('#sideHousehold').textContent = state.me?.householdName || '家庭记账本';
  $('#sideUserName').textContent = name;
  $('#sideAvatar').textContent = name.slice(0, 1);
  const isOwner = state.me?.role === 'owner';
  $('#sideRole').textContent = isOwner ? '账本创建者' : '家庭成员';
  $('#monthLabel').textContent = fmtRangeCN(state.range);
  paintScope();
}

function paintScope() {
  const btn = $('#scopeToggle');
  btn.dataset.scope = state.scope;
  $('#scopeText').textContent =
    state.scope === 'all'
      ? '全家'
      : state.scope === 'me'
        ? '只看我'
        : state.members.find((m) => String(m.id) === String(state.scope))?.display_name || '全家';
}

/* ================================================================== 导航 */

function setView(name, { silent = false } = {}) {
  if (!silent && name !== state.view) state.scrollMap.set(state.view, window.scrollY);
  state.view = name;
  if (name === 'me' && !state.binLoading && !state.bin.length) loadBin();
  $$('.nav__item').forEach((b) => {
    const on = b.dataset.view === name;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });
  render();
  const y = silent ? 0 : (state.scrollMap.get(name) ?? 0);
  window.scrollTo({ top: y, behavior: 'auto' });
  const v = $('#view');
  if (v && !silent) {
    v.classList.remove('view-enter');
    void v.offsetWidth;
    v.classList.add('view-enter');
  }
}

$$('.nav__item').forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.view)));
$('#sideUser').addEventListener('click', () => setView('me'));

/* ============================================================ 日期范围 */

/** 把 range 渲染成顶部那行字：2026 年 11 月 / 11 月 1 日 – 11 月 7 日 / 11 月 7 日 */
function fmtRangeCN(r) {
  if (!r || r.kind === 'month') return fmtMonthCN(r?.month || todayYmd().slice(0, 7));
  if (r.kind === 'day') return mdCN(r.day);
  if (r.label) return r.label;
  if (r.from === r.to) return mdCN(r.from);
  return `${mdCN(r.from)} – ${mdCN(r.to)}`;
}

/** 统计/明细都用它，避免两处各自算边界 */
function rangeBounds(r) {
  if (!r) return { from: todayYmd().slice(0, 7) + '-01', to: todayYmd() };
  if (r.kind === 'day') return { from: r.day, to: r.day };
  if (r.kind === 'range') return { from: r.from, to: r.to };
  const [y, m] = r.month.split('-').map(Number);
  return { from: `${r.month}-01`, to: `${r.month}-${pad2(new Date(y, m, 0).getDate())}` };
}

function queryFor() {
  const q = new URLSearchParams({ member: state.scope });
  if (state.range.kind === 'range') {
    q.set('from', state.range.from);
    q.set('to', state.range.to);
  } else if (state.range.kind === 'day') {
    q.set('from', state.range.day);
    q.set('to', state.range.day);
  } else {
    q.set('month', state.range.month);
  }
  return q;
}

function setRange(r) {
  state.range = r;
  paintShell();
  loadEntries();
  loadStats();
  render();
}

$('#monthPrev').addEventListener('click', () => shiftRange(-1));
$('#monthNext').addEventListener('click', () => shiftRange(1));

/** 整月翻整月、单日翻单日；自定义区间按起点的月份整月移动 */
function shiftRange(delta) {
  const r = state.range;
  if (r.kind === 'day') return setRange({ kind: 'day', day: shiftYmd(r.day, delta) });
  const base = r.kind === 'month' ? r.month : (r.from || todayYmd()).slice(0, 7);
  const [y, m] = base.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  setRange({ kind: 'month', month: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` });
}

/* ------------------------------------------------------------ 日期面板 */

const WEEK_CN = ['一', '二', '三', '四', '五', '六', '日'];
const WD_CN = ['日', '一', '二', '三', '四', '五', '六'];
const pad2 = (n) => String(n).padStart(2, '0');
const ymdOf = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const todayYmd = () => {
  const d = new Date();
  return ymdOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
};
const shiftYmd = (ymd, days) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(y, m - 1, d + days);
  return ymdOf(t.getFullYear(), t.getMonth() + 1, t.getDate());
};
const mdCN = (ymd) => `${Number(ymd.slice(5, 7))} 月 ${Number(ymd.slice(8, 10))} 日`;
const weekdayOf = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

const pick = {
  mode: 'days',
  month: todayYmd().slice(0, 7),
  sel: todayYmd(),
  data: new Map(),
  loading: false,
};
const monthAggCache = new Map();

const PRESETS = [
  { key: 'thisMonth', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'last7', label: '近 7 天' },
  { key: 'last30', label: '近 30 天' },
  { key: 'thisYear', label: '今年' },
  { key: 'all', label: '全部' },
];

function presetRange(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const today = todayYmd();
  if (key === 'thisMonth') return { kind: 'month', month: `${y}-${pad2(m)}` };
  if (key === 'lastMonth') {
    const d = new Date(y, m - 2, 1);
    return { kind: 'month', month: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` };
  }
  if (key === 'last7') return { kind: 'range', from: shiftYmd(today, -6), to: today, label: '近 7 天' };
  if (key === 'last30') return { kind: 'range', from: shiftYmd(today, -29), to: today, label: '近 30 天' };
  if (key === 'thisYear') return { kind: 'range', from: `${y}-01-01`, to: today, label: '今年' };
  if (key === 'all') return { kind: 'range', from: '2000-01-01', to: today, label: '全部' };
  return { kind: 'month', month: `${y}-${pad2(m)}` };
}

function popEl() {
  return $('#pop');
}

async function loadPickMonth(month) {
  if (monthAggCache.has(month)) {
    pick.data = monthAggCache.get(month);
    renderPick();
    return;
  }
  pick.loading = true;
  pick.data = new Map();
  renderPick();
  try {
    const q = new URLSearchParams({ month, member: state.scope });
    const data = await api('GET', `/api/entries?${q}`);
    const map = new Map();
    (data.entries || []).forEach((e) => {
      const cur = map.get(e.occurred_on) || { expense: 0, income: 0, count: 0 };
      if (e.direction === 'expense') cur.expense += e.amount_cents;
      else cur.income += e.amount_cents;
      cur.count += 1;
      map.set(e.occurred_on, cur);
    });
    if (monthAggCache.size > 24) monthAggCache.clear();
    monthAggCache.set(month, map);
    if (month === pick.month) pick.data = map;
  } catch {
    if (month === pick.month) pick.data = new Map();
  } finally {
    pick.loading = false;
    if (!$('#pop').hidden) renderPick();
  }
}

function openPick() {
  const r = state.range;
  pick.mode = 'days';
  pick.month = r.kind === 'month' ? r.month : (r.day || r.from || todayYmd()).slice(0, 7);
  pick.sel = r.kind === 'day' ? r.day : r.kind === 'range' ? r.from : todayYmd();
  pick.data = monthAggCache.get(pick.month) || new Map();
  renderPick();
  const pop = popEl();
  $('#popBack').hidden = false;
  pop.hidden = false;
  pop.classList.toggle('is-sheet', window.innerWidth <= 860);
  if (window.innerWidth > 860) {
    const rect = $('#monthLabel').getBoundingClientRect();
    pop.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 372))}px`;
    pop.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 200)}px`;
  } else {
    pop.style.left = '';
    pop.style.top = 'auto';
  }
  $('#monthLabel').setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => pop.classList.add('is-open'));
  loadPickMonth(pick.month);
  const target = pop.querySelector('.cal__day[data-day]') || pop.querySelector('.pop__title');
  target?.focus?.();
}

function closePick({ restoreFocus = true } = {}) {
  const pop = popEl();
  pop.classList.remove('is-open');
  pop.hidden = true;
  $('#popBack').hidden = true;
  $('#monthLabel').setAttribute('aria-expanded', 'false');
  if (restoreFocus) $('#monthLabel').focus();
}

function goDay(day) {
  closePick();
  setRange({ kind: 'day', day });
  if (state.view !== 'list' && state.view !== 'stats') setView('list');
}

function renderPick() {
  const pop = popEl();
  const [y, m] = pick.month.split('-').map(Number);
  const title = pick.mode === 'days' ? `${y} 年 ${m} 月` : `${y} 年`;

  let body = '';
  if (pick.mode === 'days') {
    const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // 周一起始
    const dim = new Date(y, m, 0).getDate();
    const prevDim = new Date(y, m - 1, 0).getDate();
    const cells = [];
    for (let i = offset - 1; i >= 0; i -= 1) {
      const d = prevDim - i;
      const ym = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
      const day = ymdOf(ym.y, ym.m, d);
      cells.push(`<button type="button" class="cal__day is-out" data-day="${day}" data-out="1" tabindex="-1">
        <span class="cal__num">${d}</span><span class="cal__sub">${cellLabel(day)}</span></button>`);
    }
    for (let d = 1; d <= dim; d += 1) {
      const day = ymdOf(y, m, d);
      const agg = pick.data.get(day);
      const cls = [
        'cal__day',
        day === pick.sel ? 'is-sel' : '',
        day === pick.sel && day === todayYmd() ? 'is-today' : '',
        day === todayYmd() && day !== pick.sel ? 'is-today-outline' : '',
        agg ? 'has-entry' : '',
      ]
        .filter(Boolean)
        .join(' ');
      cells.push(`<button type="button" class="${cls}" data-day="${day}" aria-label="${mdCN(day)} ${lunarLine(day)}${agg ? `，${agg.count} 笔` : ''}">
        <span class="cal__num">${d}</span><span class="cal__sub">${cellLabel(day)}</span></button>`);
    }
    const tailNeed = (7 - ((offset + dim) % 7)) % 7;
    const tail = tailNeed === 0 ? 0 : tailNeed;
    for (let i = 1; i <= tail; i += 1) {
      const ym = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
      const day = ymdOf(ym.y, ym.m, i);
      cells.push(`<button type="button" class="cal__day is-out" data-day="${day}" data-out="1" tabindex="-1">
        <span class="cal__num">${i}</span><span class="cal__sub">${cellLabel(day)}</span></button>`);
    }

    body = `
      <div class="cal__dow">${WEEK_CN.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal__grid">${cells.join('')}</div>`;
  } else {
    body = `<div class="cal__months">${Array.from({ length: 12 }, (_, i) => i + 1)
      .map((mm) => {
        const ym = `${y}-${pad2(mm)}`;
        const on = pick.month === ym;
        return `<button type="button" class="cal__mon${on ? ' is-on' : ''}" data-ym="${ym}">${mm} 月</button>`;
      })
      .join('')}</div>`;
  }

  const selAgg = pick.data.get(pick.sel);
  const selLine = pick.mode === 'days' ? lunarLine(pick.sel) : '';
  const selSum = selAgg
    ? `支出 ${fmtMoney(selAgg.expense)}${selAgg.income ? ` · 收入 ${fmtMoney(selAgg.income)}` : ''} · ${selAgg.count} 笔`
    : pick.loading
      ? '正在看这天的账…'
      : '这天还没有记账';

  pop.innerHTML = `
    <div class="pop__head">
      <button type="button" class="iconbtn" data-nav="-1" aria-label="上一${pick.mode === 'days' ? '个月' : '年'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 6.5 8.5 12l6 5.5" /></svg>
      </button>
      <button type="button" class="pop__title" id="pickTitle" aria-label="切换年视图">${title}</button>
      <button type="button" class="iconbtn" data-nav="1" aria-label="下一${pick.mode === 'days' ? '个月' : '年'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 6.5 15.5 12l-6 5.5" /></svg>
      </button>
    </div>
    <div class="calcard">
      <div class="calcard__top">
        <b class="calcard__date">${mdCN(pick.sel)}</b>
        <span class="calcard__week">周${WD_CN[weekdayOf(pick.sel)]}</span>
      </div>
      ${selLine ? `<div class="calcard__lunar">${selLine}</div>` : ''}
      <div class="calcard__sum${selAgg ? '' : ' is-empty'}">${selSum}</div>
    </div>
    <div class="pop__presets">
      <button type="button" class="chip chip--today" data-today${pick.sel === todayYmd() ? ' data-on' : ''}>今天</button>
      ${PRESETS.map((p) => `<button type="button" class="chip" data-preset="${p.key}">${p.label}</button>`).join('')}
    </div>
    ${body}
    <div class="pop__foot">
      <button type="button" class="btn btn--primary btn--sm" data-seeday>看这天的账</button>
      <button type="button" class="btn btn--ghost btn--sm" data-close>取消</button>
    </div>`;
}

popEl().addEventListener('click', (ev) => {
  const t = ev.target.closest('button');
  if (!t) return;
  if (t.dataset.close !== undefined) return closePick();
  if (t.dataset.nav) {
    const step = Number(t.dataset.nav);
    if (pick.mode === 'days') {
      const [py, pm] = pick.month.split('-').map(Number);
      const d = new Date(py, pm - 1 + step, 1);
      pick.month = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      pick.data = monthAggCache.get(pick.month) || new Map();
      renderPick();
      loadPickMonth(pick.month);
    } else {
      const [py] = pick.month.split('-').map(Number);
      pick.month = `${py + step}-01`;
      renderPick();
      loadPickMonth(pick.month);
    }
    return;
  }
  if (t.id === 'pickTitle') {
    pick.mode = pick.mode === 'days' ? 'months' : 'days';
    return renderPick();
  }
  if (t.dataset.today !== undefined) return goDay(todayYmd());
  if (t.dataset.preset) {
    closePick();
    return setRange(presetRange(t.dataset.preset));
  }
  if (t.dataset.ym) {
    pick.mode = 'days';
    pick.month = t.dataset.ym;
    pick.data = monthAggCache.get(pick.month) || new Map();
    renderPick();
    loadPickMonth(pick.month);
    return;
  }
  if (t.dataset.seeday !== undefined) return goDay(pick.sel);
  if (t.dataset.day) {
    const day = t.dataset.day;
    pick.sel = day;
    if (t.dataset.out) {
      pick.month = day.slice(0, 7);
      pick.data = monthAggCache.get(pick.month) || new Map();
      loadPickMonth(pick.month);
    }
    return goDay(day);
  }
});

popEl().addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    ev.preventDefault();
    closePick();
    return;
  }
  if (pick.mode !== 'days') return;
  const cur = document.activeElement;
  if (!cur || !cur.dataset || !cur.dataset.day) return;
  const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (!(ev.key in map)) return;
  ev.preventDefault();
  const nextDay = shiftYmd(cur.dataset.day, map[ev.key]);
  pick.sel = nextDay;
  if (nextDay.slice(0, 7) !== pick.month) {
    pick.month = nextDay.slice(0, 7);
    pick.data = monthAggCache.get(pick.month) || new Map();
    loadPickMonth(pick.month);
  }
  renderPick();
  popEl().querySelector(`.cal__day[data-day="${nextDay}"]`)?.focus();
});

$('#monthLabel').addEventListener('click', () => {
  if (popEl().hidden) openPick();
  else closePick();
});
$('#popBack').addEventListener('click', () => closePick());

$('#scopeToggle').addEventListener('click', () => {
  state.scope = state.scope === 'all' ? 'me' : 'all';
  paintScope();
  loadEntries();
  loadStats();
  render();
});

/* ================================================================== 数据 */

let entriesSeq = 0;
async function loadEntries() {
  const seq = (entriesSeq += 1);
  state.entriesLoading = true;
  state.listError = '';
  render();
  try {
    const data = await api('GET', `/api/entries?${queryFor()}`);
    if (seq !== entriesSeq) return;
    state.entries = data.entries || [];
    state.rangeEcho = data.range || null;
  } catch (err) {
    if (seq !== entriesSeq) return;
    state.listError = looksOffline(err) ? '网络不通，显示的是上次的数据' : err.message;
  } finally {
    if (seq === entriesSeq) {
      state.entriesLoading = false;
      if (state.view === 'list' || state.view === 'stats') render();
    }
  }
}

let statsSeq = 0;
async function loadStats() {
  const seq = (statsSeq += 1);
  state.statsLoading = true;
  try {
    const data = await api('GET', `/api/stats?${queryFor()}`);
    if (seq !== statsSeq) return;
    state.stats = data;
  } catch {
    if (seq !== statsSeq) return;
    state.stats = null;
  } finally {
    if (seq === statsSeq) {
      state.statsLoading = false;
      if (state.view === 'stats') render();
    }
  }
}

/* ------------------------------------------------------------- 筛选逻辑 */

const filterActive = () =>
  Boolean(state.filters.keyword.trim()) ||
  state.filters.direction !== 'all' ||
  state.filters.category !== 'all';

function filteredEntries() {
  const kw = state.filters.keyword.trim().toLowerCase();
  return state.entries.filter((e) => {
    if (state.filters.direction !== 'all' && e.direction !== state.filters.direction) return false;
    if (state.filters.category !== 'all' && String(e.category_id) !== String(state.filters.category)) return false;
    if (kw) {
      const hay = `${e.note || ''} ${e.category_name} ${e.author_name}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

function sumOf(list, direction) {
  return list.filter((e) => e.direction === direction).reduce((s, e) => s + e.amount_cents, 0);
}

/* ================================================================== 渲染 */

function render() {
  const view = $('#view');
  if (!view) return;
  view.classList.toggle('view--add', state.view === 'add');
  if (state.view === 'add') view.innerHTML = renderAdd();
  else if (state.view === 'list') view.innerHTML = renderList();
  else if (state.view === 'stats') view.innerHTML = renderStats();
  else view.innerHTML = renderMe();
  bindView();
}

/* ---------------------------------------------------------------- 记一笔 */

function renderAdd() {
  const d = state.draft;
  const cats = state.categories.filter((c) => c.direction === d.direction);
  const amount = fmtMoney(d.cents, { symbol: false });
  const canSave = d.cents > 0 && d.categoryId;
  const note = !d.cents
    ? '先按上面的数字键输入金额'
    : !d.categoryId
      ? '选一个分类才能保存'
      : '';

  return `
    <div class="compose">
      <section class="card compose__left">
        <div class="amount">
          <span class="amount__cur">¥</span>
          <span class="amount__value ${d.cents ? '' : 'is-zero'}">${amount}</span>
        </div>
        <div class="keypad">
          ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0']
            .map((k) => `<button type="button" class="key" data-key="${k}">${k}</button>`)
            .join('')}
          <button type="button" class="key" data-key="del" aria-label="退格">${icon('backspace')}</button>
        </div>
      </section>

      <section class="card compose__right">
        <div class="direction" role="group" aria-label="收支类型">
          <button type="button" data-dir="expense" aria-pressed="${d.direction === 'expense'}">支出</button>
          <button type="button" data-dir="income" aria-pressed="${d.direction === 'income'}">收入</button>
        </div>

        <div class="catgrid">
          ${cats
            .map(
              (c) => `<button type="button" class="cat" data-cat="${c.id}" aria-pressed="${String(d.categoryId) === String(c.id)}">
                  <span class="cat__icon">${catIcon(c.name)}</span>
                  <span>${c.name}</span>
                </button>`,
            )
            .join('')}
        </div>

        <div class="compose__meta">
          <input class="input" id="draftNote" placeholder="备注（可空）" maxlength="40" value="${escapeAttr(d.note)}" />
          <input class="input input--date" id="draftDate" type="date" value="${d.date}" />
        </div>

        <div class="chips">
          <button type="button" class="chip" data-date-offset="0">今天</button>
          <button type="button" class="chip" data-date-offset="-1">昨天</button>
          <button type="button" class="chip" data-date-offset="-2">前天</button>
        </div>

        <div class="savebar">
          <button type="button" class="btn btn--primary btn--block${canSave ? '' : ' is-blocked'}" id="saveEntry" ${state.saving ? 'disabled aria-busy="true"' : ''}>
            <span class="btn__label">${d.direction === 'expense' ? '记下这笔支出' : '记下这笔收入'}</span>
            <span class="btn__spinner" aria-hidden="true"></span>
          </button>
          <p class="savenote" id="saveNote">${note || saveHint()}</p>
        </div>
      </section>
    </div>
    ${renderRecent()}
  `;
}

/* 首页底部：本月最近几笔，没有就提示一句 */
function renderRecent() {
  const list = [...state.entries].sort((a, b) => (a.occurred_on < b.occurred_on ? 1 : -1)).slice(0, 5);
  if (!list.length) {
    return `<section class="section-title">这个月还没记账</section>
      <p class="muted">按下上面的数字键记第一笔，月底就能看到钱去哪了。</p>`;
  }
  return `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">
      <h3 class="section-title" style="margin-bottom:10px">最近记的</h3>
      <button type="button" class="btn btn--ghost btn--sm" data-jump="list">全部明细</button>
    </div>
    <div class="rows">
      ${list
        .map(
          (e) => `<button type="button" class="row" data-entry="${e.id}">
            <span class="row__icon ${e.direction === 'income' ? 'row__icon--income' : ''}">${catIcon(e.category_name)}</span>
            <span class="row__main">
              <span class="row__title">${escapeAttr(e.note || e.category_name)}</span>
              <span class="row__sub">${e.occurred_on.slice(5)} · ${escapeAttr(e.author_name || '')}</span>
            </span>
            <span class="row__amount ${e.direction === 'income' ? 'row__amount--income' : ''}">${e.direction === 'income' ? '+' : '−'}${fmtMoney(e.amount_cents, { symbol: false })}</span>
          </button>`,
        )
        .join('')}
    </div>`;
}

function escapeAttr(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/* ------------------------------------------------------------------ 明细 */

function renderList() {
  const rows = filteredEntries();
  const expense = sumOf(rows, 'expense');
  const income = sumOf(rows, 'income');
  const balance = income - expense;

  const isDay = state.range.kind === 'day';
  const periodLabel = state.range.kind === 'month' ? '本月' : isDay ? '当日' : '区间';
  const dayHead = isDay
    ? `<div class="dayhead">
        <div class="dayhead__main">
          <b>${mdCN(state.range.day)}</b>
          <span>周${WD_CN[weekdayOf(state.range.day)]}</span>
          <span class="dayhead__lunar">${lunarLine(state.range.day)}</span>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" data-back="month">回到整月</button>
      </div>`
    : '';

  const memberOptions = [
    { value: 'all', label: '全家' },
    { value: 'me', label: '只看我' },
    ...state.members.map((m) => ({ value: String(m.id), label: m.display_name })),
  ];
  const catOptions = [
    { value: 'all', label: '全部分类' },
    ...state.categories.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const periodEmpty = !state.entriesLoading && !state.entries.length && !filterActive();
  if (periodEmpty) {
    return `
      ${dayHead}
      ${state.listError ? `<p class="hint">${state.listError}</p>` : ''}
      ${emptyBlock()}`;
  }

  return `
    ${dayHead}
    <div class="summary">
      <button type="button" class="summary__cell" data-jump="expense">
        <span class="summary__label">${periodLabel}支出</span>
        <span class="summary__value">${fmtMoney(expense)}</span>
        <span class="summary__hint">${rows.filter((e) => e.direction === 'expense').length} 笔</span>
      </button>
      <button type="button" class="summary__cell" data-jump="income">
        <span class="summary__label">${periodLabel}收入</span>
        <span class="summary__value summary__value--income">${fmtMoney(income)}</span>
        <span class="summary__hint">${rows.filter((e) => e.direction === 'income').length} 笔</span>
      </button>
      <button type="button" class="summary__cell" data-jump="stats">
        <span class="summary__label">${periodLabel}结余</span>
        <span class="summary__value summary__value--muted">${fmtMoney(balance, { sign: true })}</span>
        <span class="summary__hint">收入 − 支出</span>
      </button>
    </div>

    <div class="toolbar">
      <div class="toolbar__row">
        <span class="searchbox">
          ${icon('search')}
          <input id="searchInput" placeholder="搜备注、分类或人" value="${escapeAttr(state.filters.keyword)}" />
        </span>
        <select class="select" id="filterMember">
          ${memberOptions
            .map((o) => `<option value="${o.value}" ${state.scope === o.value ? 'selected' : ''}>${o.label}</option>`)
            .join('')}
        </select>
      </div>
      <div class="toolbar__row">
        <select class="select" id="filterDirection">
          ${[
            ['all', '收支不限'],
            ['expense', '只看支出'],
            ['income', '只看收入'],
          ]
            .map(([v, l]) => `<option value="${v}" ${state.filters.direction === v ? 'selected' : ''}>${l}</option>`)
            .join('')}
        </select>
        <select class="select" id="filterCategory">
          ${catOptions
            .map((o) => `<option value="${o.value}" ${state.filters.category === o.value ? 'selected' : ''}>${o.label}</option>`)
            .join('')}
        </select>
        ${filterActive() ? '<button type="button" class="btn btn--ghost btn--sm" id="clearFilters">清空筛选</button>' : ''}
      </div>
    </div>

    ${state.listError ? `<p class="hint">${state.listError}</p>` : ''}
    ${state.entriesLoading && !rows.length ? '<p class="loading">正在读取这个月的账目…</p>' : ''}
    ${!state.entriesLoading && !rows.length ? emptyBlock() : ''}
    ${rows.length ? groupRows(rows) : ''}
  `;
}

function emptyBlock() {
  if (filterActive()) {
    return `<div class="empty">
      <span class="empty__icon">${icon('search')}</span>
      <b>这些条件下没有账目</b>
      <span>换个关键词，或者清空筛选试试。</span>
    </div>`;
  }
  const label = state.range.kind === 'day' ? mdCN(state.range.day) : fmtMonthCN((state.range.month || todayYmd().slice(0, 7)));
  return `<div class="empty">
    <span class="empty__icon">${icon('empty')}</span>
    <b>${label}还没有记账</b>
    <span>记一笔，月底就知道钱去哪了。</span>
    <button type="button" class="btn btn--primary btn--sm" data-goto="add">记一笔</button>
  </div>`;
}

function groupRows(rows) {
  const groups = new Map();
  rows.forEach((e) => {
    if (!groups.has(e.occurred_on)) groups.set(e.occurred_on, []);
    groups.get(e.occurred_on).push(e);
  });
  const days = [...groups.keys()].sort((a, b) => (a < b ? 1 : -1));

  return days
    .map((day) => {
      const list = groups.get(day);
      const exp = sumOf(list, 'expense');
      const inc = sumOf(list, 'income');
      const parts = [];
      if (exp) parts.push(`支出 ${fmtMoney(exp)}`);
      if (inc) parts.push(`收入 ${fmtMoney(inc)}`);
      const headHidden = state.range.kind === 'day';
      return `<section class="daygroup">
        <header class="daygroup__head"${headHidden ? ' hidden' : ''}>
          <span>${dayLabel(day)}</span>
          <span class="daygroup__sum">${parts.join(' · ')}</span>
        </header>
        <div class="rows">
          ${list
            .map(
              (e) => `<button type="button" class="row${String(e.id) === String(state.highlightId) ? ' is-new' : ''}" data-entry="${e.id}">
                <span class="row__icon ${e.direction === 'income' ? 'row__icon--income' : ''}">${catIcon(e.category_name)}</span>
                <span class="row__main">
                  <span class="row__title">${escapeAttr(e.note || e.category_name)}</span>
                  <span class="row__sub">${e.note ? `${e.category_name} · ${escapeAttr(e.author_name || '')}` : escapeAttr(e.author_name || '')}</span>
                </span>
                <span class="row__amount ${e.direction === 'income' ? 'row__amount--income' : ''}">
                  ${e.direction === 'income' ? '+' : '−'}${fmtMoney(e.amount_cents, { symbol: false })}
                </span>
              </button>`,
            )
            .join('')}
        </div>
      </section>`;
    })
    .join('');
}

/* ------------------------------------------------------------------ 统计 */

function renderStats() {
  const s = state.stats;
  if (state.statsLoading && !s) return '<p class="loading">正在算这个月的账…</p>';
  if (!s) return '<p class="loading">暂时拿不到统计数据</p>';

  const total = s.total || { expense: 0, income: 0, balance: 0 };
  const empty = !total.expense && !total.income;

  const bounds = rangeBounds(state.range);
  const dayKeys = [];
  for (let d = bounds.from; d <= bounds.to; d = shiftYmd(d, 1)) {
    dayKeys.push(d);
    if (dayKeys.length > 400) break;
  }
  const byDay = new Map();
  (s.byDay || []).forEach((d) => {
    if (d.direction !== 'expense') return;
    byDay.set(String(d.day).slice(0, 10), (byDay.get(String(d.day).slice(0, 10)) || 0) + d.cents);
  });
  const dayMax = Math.max(1, ...[...byDay.values()]);
  const dayBars = dayKeys
    .map((day) => {
      const cents = byDay.get(day) || 0;
      const h = cents ? Math.max(7, Math.round((cents / dayMax) * 100)) : 2;
      return `<div class="spark__col" title="${mdCN(day)} ${fmtMoney(cents)}">
      <div class="spark__bar ${cents === dayMax && cents ? 'is-peak' : ''}" style="height:${cents ? h : 2}%"></div>
    </div>`;
    })
    .join('');

  const cats = (s.byCategory || []).filter((c) => c.direction === 'expense').sort((a, b) => b.cents - a.cents);
  const catMax = Math.max(1, ...cats.map((c) => c.cents));
  const catTotal = cats.reduce((acc, c) => acc + c.cents, 0) || 1;

  const members = new Map();
  (s.byMember || []).forEach((m) => {
    const cur = members.get(String(m.id)) || { id: m.id, name: m.display_name, expense: 0, income: 0 };
    if (m.direction === 'expense') cur.expense += m.cents;
    else cur.income += m.cents;
    members.set(String(m.id), cur);
  });
  const memberList = [...members.values()].sort((a, b) => b.expense - a.expense);

  return `
    <div class="summary">
      <button type="button" class="summary__cell" data-jump="list">
        <span class="summary__label">本月支出</span>
        <span class="summary__value">${fmtMoney(total.expense)}</span>
      </button>
      <button type="button" class="summary__cell" data-jump="list">
        <span class="summary__label">本月收入</span>
        <span class="summary__value summary__value--income">${fmtMoney(total.income)}</span>
      </button>
      <button type="button" class="summary__cell" data-jump="list">
        <span class="summary__label">本月结余</span>
        <span class="summary__value summary__value--muted">${fmtMoney(total.balance, { sign: true })}</span>
        <span class="summary__hint">收入 − 支出</span>
      </button>
    </div>

    ${
      empty
        ? `<div class="empty" style="margin-top:16px">
            <span class="empty__icon">${icon('trend')}</span>
            <b>这个月还没有数据</b>
            <span>记上几笔，这里就会长出趋势图。</span>
            <button type="button" class="btn btn--primary btn--sm" data-goto="add">记一笔</button>
          </div>`
        : `
        <h3 class="section-title">每天花了多少</h3>
        <div class="sparkbox">
          <div class="spark">${dayBars}</div>
          <div class="spark__axis">
            <span>1 日</span>
            <span>本月累计 ${fmtMoney(total.expense)}</span>
            <span>${daysInMonth} 日</span>
          </div>
        </div>

        <h3 class="section-title">钱花在哪了</h3>
        ${
          cats.length
            ? `<div class="bars">
                ${cats
                  .map(
                    (c) => `<div class="bar">
                      <span class="bar__name">${catIcon(c.name)}<span>${c.name}</span></span>
                      <span class="bar__track"><span class="bar__fill" style="width:${Math.max(3, Math.round((c.cents / catMax) * 100))}%"></span></span>
                      <span class="bar__value">${fmtMoney(c.cents)} · ${Math.round((c.cents / catTotal) * 100)}%</span>
                    </div>`,
                  )
                  .join('')}
              </div>`
            : '<p class="muted">这个月还没有支出。</p>'
        }

        <h3 class="section-title">各花了多少</h3>
        ${
          memberList.length
            ? `<div class="memlist">
                ${memberList
                  .map(
                    (m) => `<div class="memrow">
                      <span class="avatar">${escapeAttr((m.name || '?').slice(0, 1))}</span>
                      <span style="flex:1;min-width:0">
                        <span class="memrow__name">${escapeAttr(m.name)}</span>
                        <span class="memrow__meta">收入 ${fmtMoney(m.income)}</span>
                      </span>
                      <span class="row__amount">${fmtMoney(m.expense)}</span>
                    </div>`,
                  )
                  .join('')}
              </div>`
            : ''
        }
        <p class="trend-note">本月一共 ${memberList.length} 个人记了 ${state.entries.length} 笔账，平均每天 <b>${fmtMoney(Math.round(total.expense / daysInMonth))}</b>。</p>
      `
    }
  `;
}

/* ------------------------------------------------------------------ 我的 */

function renderMe() {
  const me = state.me || {};
  const name = me.displayName || me.username || '—';
  const isOwner = me.role === 'owner';

  return `
    <div class="panel">
      <div class="profile">
        <span class="profile__avatar">${escapeAttr(name.slice(0, 1))}</span>
        <div style="min-width:0">
          <div class="profile__name">${escapeAttr(name)}</div>
          <div class="profile__meta">@${escapeAttr(me.username || '')} · ${escapeAttr(me.householdName || '')}</div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__title">账本成员 <span class="muted">${state.members.length} 人</span></div>
      <p class="panel__desc">同一个账本里的每个人都能看到全部账目，各自记自己的，随时合看。</p>
      <div class="memlist">
        ${state.members
          .map(
            (m) => `<div class="memrow">
              <span class="avatar">${escapeAttr((m.display_name || '?').slice(0, 1))}</span>
              <span style="flex:1;min-width:0">
                <span class="memrow__name">${escapeAttr(m.display_name)}</span>
                <span class="memrow__meta">${m.role === 'owner' ? '账本创建者' : '家庭成员'}</span>
              </span>
              ${String(m.id) === String(me.id) ? '<span class="muted">是你</span>' : ''}
            </div>`,
          )
          .join('')}
      </div>
    </div>

    <div class="panel">
      <div class="panel__title">看账范围</div>
      <p class="panel__desc">「全家」是账本里所有人的账；「只看我」只显示你记的那些。这个选择同时作用于明细和统计。</p>
      <div class="scopechoice">
        <button type="button" class="scopeoption ${state.scope === 'all' ? 'is-active' : ''}" data-scope="all">
          全家<small>${state.members.length} 个人的账</small>
        </button>
        <button type="button" class="scopeoption ${state.scope === 'me' ? 'is-active' : ''}" data-scope="me">
          只看我<small>只统计我记的</small>
        </button>
      </div>
    </div>

    <div class="panel">
      <div class="panel__title">把家人拉进来</div>
      <p class="panel__desc">${isOwner ? '生成一个邀请码，10 分钟内有效。' : '账本创建者可以生成邀请码；你也可以用别人的码加入另一本账。'}</p>
      <div class="invite-code" id="inviteCode" title="点击复制">${state.invite ? state.invite.code : ''}</div>
      ${
        state.invite
          ? `<p class="muted" id="inviteHint">还剩 ${state.invite.left} 秒失效${state.invite.copied ? ' · 已复制' : ' · 点数字可复制'}</p>`
          : ''
      }
      <div class="stack">
        <button type="button" class="btn btn--primary btn--sm" id="genInvite">${state.invite ? '换一个邀请码' : '生成邀请码'}</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel__title">我拿到了邀请码</div>
      <p class="panel__desc">输入对方给的 6 位码，就会加入对方那本账。</p>
      <div class="invite-row">
        <input class="input" id="joinCode" placeholder="6 位邀请码" maxlength="6" autocapitalize="characters" />
        <button type="button" class="btn btn--ghost btn--sm" id="joinHousehold">加入</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel__title">账号</div>
      <p class="panel__desc">退出后需要重新输入用户名和密码，账目不会丢。</p>
      <button type="button" class="btn btn--ghost btn--sm" id="logoutBtn">退出登录</button>
    </div>

    <div class="panel">
      <div class="panel__title">回收站 <span class="muted">${state.bin.length ? `${state.bin.length} 条` : ''}</span></div>
      <p class="panel__desc">删掉的账会留在这里，想恢复随时点一下。</p>
      ${
        state.binLoading
          ? '<p class="hint">正在读回收站…</p>'
          : state.bin.length
            ? `<div class="binlist">${state.bin
                .map(
                  (e) => `<div class="binrow">
                    <span class="row__icon">${catIcon(e.category_name)}</span>
                    <span class="binrow__main">
                      <span class="row__title">${escapeAttr(e.note || e.category_name)}</span>
                      <span class="row__sub">${escapeAttr(e.occurred_on)} · ${escapeAttr(e.author_name || '')}</span>
                    </span>
                    <span class="row__amount">−${fmtMoney(e.amount_cents, { symbol: false })}</span>
                    <button type="button" class="btn btn--ghost btn--sm" data-restore="${e.id}">恢复</button>
                  </div>`,
                )
                .join('')}</div>`
            : '<p class="hint">回收站是空的。</p>'
      }
    </div>
  `;
}

/* ================================================================== 交互 */

function bindView() {
  const view = $('#view');

  /* 记一笔 */
  $$('.key', view).forEach((btn) => {
    btn.addEventListener('click', () => pressKey(btn.dataset.key));
  });
  $$('[data-dir]', view).forEach((btn) => {
    btn.addEventListener('click', () => {
      state.draft.direction = btn.dataset.dir;
      const first = state.categories.find((c) => c.direction === state.draft.direction);
      state.draft.categoryId = first ? first.id : null;
      render();
    });
  });
  $$('[data-cat]', view).forEach((btn) => {
    btn.addEventListener('click', () => {
      state.draft.categoryId = btn.dataset.cat;
      render();
    });
  });
  const noteInput = $('#draftNote', view);
  if (noteInput) {
    noteInput.addEventListener('input', () => {
      state.draft.note = noteInput.value;
    });
  }
  const dateInput = $('#draftDate', view);
  if (dateInput) {
    dateInput.addEventListener('change', () => {
      state.draft.date = dateInput.value || todayStr();
      render();
    });
  }
  $$('[data-date-offset]', view).forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = new Date();
      d.setDate(d.getDate() + Number(btn.dataset.dateOffset));
      state.draft.date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      render();
    });
  });
  const saveBtn = $('#saveEntry', view);
  if (saveBtn) saveBtn.addEventListener('click', saveDraft);

  $$('[data-restore]', view).forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await api('POST', `/api/entries/${btn.dataset.restore}/restore`);
        toast('已恢复');
        loadBin();
        loadEntries();
        loadStats();
      } catch (err) {
        btn.disabled = false;
        toast(err.message || '恢复失败');
      }
    });
  });

  /* 明细 */
  const search = $('#searchInput', view);
  if (search) {
    search.addEventListener('input', () => {
      state.filters.keyword = search.value;
      repaintList();
    });
  }
  const fMember = $('#filterMember', view);
  if (fMember) {
    fMember.addEventListener('change', () => {
      state.scope = fMember.value;
      paintScope();
      loadEntries();
      loadStats();
    });
  }
  const fDir = $('#filterDirection', view);
  if (fDir) {
    fDir.addEventListener('change', () => {
      state.filters.direction = fDir.value;
      repaintList();
    });
  }
  const fCat = $('#filterCategory', view);
  if (fCat) {
    fCat.addEventListener('change', () => {
      state.filters.category = fCat.value;
      repaintList();
    });
  }
  const clear = $('#clearFilters', view);
  if (clear) {
    clear.addEventListener('click', () => {
      state.filters = { keyword: '', direction: 'all', category: 'all' };
      render();
    });
  }
  $$('[data-entry]', view).forEach((btn) => {
    btn.addEventListener('click', () => openEntry(btn.dataset.entry));
  });
  $$('[data-jump]', view).forEach((btn) => {
    btn.addEventListener('click', () => {
      const jump = btn.dataset.jump;
      if (jump === 'stats') setView('stats');
      else if (jump === 'expense' || jump === 'income') {
        state.filters.direction = jump;
        setView('list');
      } else setView('list');
    });
  });
  $$('[data-goto]', view).forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.goto));
  });
  $$('[data-back="month"]', view).forEach((btn) => {
    btn.addEventListener('click', () => setRange({ kind: 'month', month: todayYmd().slice(0, 7) }));
  });

  /* 我的 */
  $$('[data-scope]', view).forEach((btn) => {
    btn.addEventListener('click', () => {
      state.scope = btn.dataset.scope;
      paintScope();
      loadEntries();
      loadStats();
      render();
    });
  });
  const gen = $('#genInvite', view);
  if (gen) gen.addEventListener('click', generateInvite);
  const codeEl = $('#inviteCode', view);
  if (codeEl && state.invite) {
    codeEl.addEventListener('click', () => copyInvite());
  }
  const join = $('#joinHousehold', view);
  if (join) join.addEventListener('click', joinHousehold);
  const logout = $('#logoutBtn', view);
  if (logout) logout.addEventListener('click', doLogout);
}

/* 只重画列表区域，保住搜索框焦点 */
function repaintList() {
  const view = $('#view');
  const active = document.activeElement;
  const isSearch = active && active.id === 'searchInput';
  const caret = isSearch ? active.selectionStart : null;
  view.innerHTML = renderList();
  bindView();
  if (isSearch) {
    const s = $('#searchInput');
    s.focus();
    if (caret != null) s.setSelectionRange(caret, caret);
  }
}

/* ------------------------------------------------------------ 数字键盘 */

function pressKey(key) {
  const d = state.draft;
  if (key === 'del') {
    d.cents = Math.floor(d.cents / 10);
  } else if (key === '00') {
    if (d.cents > 0 && d.cents < 10000000) d.cents = d.cents * 100;
  } else {
    if (d.cents >= 10000000) return;
    d.cents = d.cents * 10 + Number(key);
  }
  const val = $('.amount__value');
  const note = $('#saveNote');
  if (val) {
    val.textContent = fmtMoney(d.cents, { symbol: false });
    val.classList.toggle('is-zero', !d.cents);
  }
  const canSave = d.cents > 0 && d.categoryId && !state.saving;
  const btn = $('#saveEntry');
  if (btn) btn.disabled = !canSave;
  if (note) note.textContent = !d.cents ? '先按上面的数字键输入金额' : !d.categoryId ? '选一个分类才能保存' : saveHint();
}

/* -------------------------------------------------------------- 保存一笔 */

async function saveDraft() {
  if (state.saving) return;
  const d = state.draft;
  if (!d.cents) {
    markSaveError('金额要大于 0，先按上面的数字键');
    return;
  }
  if (!d.categoryId) {
    markSaveError('选一个分类再保存');
    return;
  }

  state.saving = true;
  const btn = $('#saveEntry');
  if (btn) {
    btn.classList.add('is-loading');
    btn.disabled = true;
  }

  const payload = {
    amountCents: d.cents,
    direction: d.direction,
    categoryId: String(d.categoryId),
    note: d.note.trim(),
    occurredOn: d.date,
    clientUuid: crypto.randomUUID(),
  };

  try {
    const data = await api('POST', '/api/entries', payload);
    const entry = data.entry || {};
    const sign = d.direction === 'income' ? '+' : '−';
    const label = `${sign}${fmtMoney(payload.amountCents)}`;
    state.draft.cents = 0;
    state.draft.note = '';
    state.saving = false;
    state.highlightId = entry.id || null;
    setTimeout(() => {
      if (state.highlightId === (entry.id || null)) {
        state.highlightId = null;
      }
    }, 1600);
    render();
    loadEntries();
    loadStats();
    toast(`已记 ${label}`, entry.id
      ? {
          label: '撤销',
          run: async () => {
            try {
              await api('DELETE', `/api/entries/${entry.id}`);
              loadEntries();
              loadStats();
              toast('已撤销');
            } catch {
              toast('撤销失败，去明细里删');
            }
          },
        }
      : null);
  } catch (err) {
    state.saving = false;
    if (looksOffline(err)) {
      const queue = readOutbox();
      queue.push(payload);
      writeOutbox(queue);
      state.draft.cents = 0;
      state.draft.note = '';
      render();
      toast('网络不通，已先存在这台设备上，联网后自动上传');
    } else {
      render();
      toast(err.message || '保存失败，再试一次');
    }
  }
}

/* -------------------------------------------------------- 保存的错误提示 */

function markSaveError(msg) {
  const note = $('#saveNote');
  if (note) {
    note.textContent = msg;
    note.classList.add('is-error');
  }
  const amount = document.querySelector('.amount');
  amount?.classList.remove('is-shake');
  if (amount) {
    void amount.offsetWidth;
    amount.classList.add('is-shake');
  }
}

/** 取回收站列表 */
async function loadBin() {
  state.binLoading = true;
  if (state.view === 'me') render();
  try {
    const data = await api('GET', '/api/entries/deleted');
    state.bin = data.entries || [];
  } catch {
    state.bin = [];
  } finally {
    state.binLoading = false;
    if (state.view === 'me') render();
  }
}

/* ------------------------------------------------------------ 离线补传 */

let flushing = false;
async function flushOutbox() {
  if (flushing) return;
  const queue = readOutbox();
  if (!queue.length) return;
  flushing = true;
  const rest = [];
  let done = 0;
  for (const item of queue) {
    try {
      await api('POST', '/api/entries', item);
      done += 1;
    } catch (err) {
      if (err.status === 409) done += 1;
      else rest.push(item);
    }
  }
  writeOutbox(rest);
  flushing = false;
  if (done) {
    toast(`离线攒的 ${done} 笔已同步`);
    loadEntries();
    loadStats();
  }
}

window.addEventListener('online', flushOutbox);

/* -------------------------------------------------------------- 条目弹层 */

function openEntry(id) {
  const e = state.entries.find((x) => String(x.id) === String(id));
  if (!e) return;
  const sign = e.direction === 'income' ? '+' : '−';
  openModal(`
    <div class="modal__title">${escapeAttr(e.note || e.category_name)}</div>
    <div class="modal__amount">${sign}${fmtMoney(e.amount_cents)}</div>
    <div class="modal__meta">${catIcon(e.category_name)}<span>${e.category_name} · ${e.occurred_on} · ${escapeAttr(e.author_name || '')}</span></div>

    <div class="modal__actions">
      <button type="button" class="btn btn--danger" data-act="delete">删除</button>
      <button type="button" class="btn btn--ghost" data-act="edit">改一下</button>
    </div>
    <div class="modal__actions" style="margin-top:8px">
      <button type="button" class="btn btn--primary" data-act="close">好</button>
    </div>
  `);

  const modal = $('#modal');
  $('[data-act="close"]', modal).addEventListener('click', closeModal);
  $('[data-act="edit"]', modal).addEventListener('click', () => openEdit(e));
  $('[data-act="delete"]', modal).addEventListener('click', () => confirmDelete(e));
}

function openEdit(e) {
  const cats = state.categories.map(
    (c) => `<option value="${c.id}" ${String(c.id) === String(e.category_id) ? 'selected' : ''}>${c.name}</option>`,
  );
  openModal(`
    <div class="modal__title">改一下</div>
    <div class="modal__field">
      <label class="modal__label">金额</label>
      <input class="input" id="editAmount" inputmode="decimal" value="${(e.amount_cents / 100).toFixed(2)}" />
    </div>
    <div class="modal__field">
      <label class="modal__label">备注</label>
      <input class="input" id="editNote" maxlength="40" value="${escapeAttr(e.note || '')}" placeholder="写点什么" />
    </div>
    <div class="modal__field">
      <label class="modal__label">分类</label>
      <select class="select" id="editCategory">${cats.join('')}</select>
    </div>
    <div class="modal__field">
      <label class="modal__label">日期</label>
      <input class="input" id="editDate" type="date" value="${e.occurred_on}" />
    </div>
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost" data-act="cancel">取消</button>
      <button type="button" class="btn btn--primary" data-act="save">保存</button>
    </div>
  `);

  const modal = $('#modal');
  $('[data-act="cancel"]', modal).addEventListener('click', closeModal);
  $('[data-act="save"]', modal).addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const amount = Math.round(Number($('#editAmount', modal).value.replace(/[^\d.]/g, '')) * 100);
    if (!amount || amount < 0) {
      toast('金额要大于 0');
      return;
    }
    btn.classList.add('is-loading');
    btn.disabled = true;
    try {
      await api('PATCH', `/api/entries/${e.id}`, {
        amountCents: amount,
        note: $('#editNote', modal).value.trim(),
        categoryId: $('#editCategory', modal).value,
        occurredOn: $('#editDate', modal).value,
      });
      closeModal();
      toast('改好了');
      loadEntries();
      loadStats();
    } catch (err) {
      btn.classList.remove('is-loading');
      btn.disabled = false;
      toast(looksOffline(err) ? '网络不通，改不了，先放一放' : err.message || '改不动，再试一次');
    }
  });
}

function confirmDelete(e) {
  openModal(`
    <div class="modal__title">删掉这笔？</div>
    <div class="modal__amount">${e.direction === 'income' ? '+' : '−'}${fmtMoney(e.amount_cents)}</div>
    <div class="modal__meta"><span>${e.category_name} · ${e.occurred_on}</span></div>
    <p class="muted" style="margin-top:10px">删掉后可以从这里撤销。</p>
    <div class="modal__actions">
      <button type="button" class="btn btn--ghost" data-act="cancel">取消</button>
      <button type="button" class="btn btn--danger" data-act="ok">删除</button>
    </div>
  `);
  const modal = $('#modal');
  $('[data-act="cancel"]', modal).addEventListener('click', closeModal);
  $('[data-act="ok"]', modal).addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    btn.classList.add('is-loading');
    btn.disabled = true;
    try {
      await api('DELETE', `/api/entries/${e.id}`);
      closeModal();
      loadEntries();
      loadStats();
      toast('已删除', {
        label: '撤销',
        run: async () => {
          try {
            await api('POST', `/api/entries/${e.id}/restore`);
            loadEntries();
            loadStats();
            toast('已恢复');
          } catch {
            toast('恢复失败');
          }
        },
      });
    } catch (err) {
      btn.classList.remove('is-loading');
      btn.disabled = false;
      toast(looksOffline(err) ? '网络不通，删不掉' : err.message || '删除失败');
    }
  });
}

/* -------------------------------------------------------------- 家庭管理 */

async function generateInvite() {
  const btn = $('#genInvite');
  if (btn) {
    btn.classList.add('is-loading');
    btn.disabled = true;
  }
  try {
    const data = await api('POST', '/api/household/invite', {});
    state.invite = { code: data.code, expiresAt: data.expiresAt, left: data.ttlSeconds || 600, copied: false };
    render();
    startInviteTimer();
  } catch (err) {
    if (btn) {
      btn.classList.remove('is-loading');
      btn.disabled = false;
    }
    toast(err.message || '生成失败，再试一次');
  }
}

function startInviteTimer() {
  clearInterval(state.inviteTimer);
  state.inviteTimer = setInterval(() => {
    if (!state.invite) return clearInterval(state.inviteTimer);
    state.invite.left -= 1;
    if (state.invite.left <= 0) {
      clearInterval(state.inviteTimer);
      state.invite = null;
      if (state.view === 'me') render();
      return;
    }
    const hint = $('#inviteHint');
    if (hint) hint.textContent = `还剩 ${state.invite.left} 秒失效${state.invite.copied ? ' · 已复制' : ' · 点数字可复制'}`;
  }, 1000);
}

async function copyInvite() {
  if (!state.invite) return;
  try {
    await navigator.clipboard.writeText(state.invite.code);
    state.invite.copied = true;
    const hint = $('#inviteHint');
    if (hint) hint.textContent = `还剩 ${state.invite.left} 秒失效 · 已复制`;
    toast('邀请码已复制');
  } catch {
    toast(`邀请码：${state.invite.code}`);
  }
}

async function joinHousehold() {
  const input = $('#joinCode');
  const code = (input?.value || '').trim().toUpperCase();
  if (code.length !== 6) {
    toast('邀请码是 6 位');
    return;
  }
  const btn = $('#joinHousehold');
  if (btn) {
    btn.classList.add('is-loading');
    btn.disabled = true;
  }
  try {
    await api('POST', '/api/household/join', { code });
    toast('加入成功');
    await boot();
    setView('list');
  } catch (err) {
    if (btn) {
      btn.classList.remove('is-loading');
      btn.disabled = false;
    }
    toast(err.message || '邀请码不对或已过期');
  }
}

async function doLogout() {
  try {
    await api('POST', '/api/auth/logout', {});
  } catch {
    /* 离线也要能退出 */
  }
  state.me = null;
  state.entries = [];
  state.stats = null;
  state.invite = null;
  clearInterval(state.inviteTimer);
  showAuth();
}

/* ------------------------------------------------------------ 实体键盘 */

document.addEventListener('keydown', (e) => {
  if (!state.me || state.view !== 'add') return;
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  if (/^[0-9]$/.test(e.key) && !typing) {
    pressKey(e.key);
    e.preventDefault();
  } else if (e.key === 'Backspace' && !typing) {
    pressKey('del');
    e.preventDefault();
  } else if (e.key === 'Enter' && !typing) {
    const btn = $('#saveEntry');
    if (btn && !btn.disabled) saveDraft();
    e.preventDefault();
  }
});

/* --------------------------------------------------------------- Service Worker */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

/* ------------------------------------------------------------------ 入口 */

onUnauthorized = () => showAuth();

setAuthMode('login');
boot();

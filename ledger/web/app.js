/**
 * 家庭记账本 —— 前端 / frontend
 *
 * 无框架、无构建，一个文件。打开就能按数字，3 秒记完一笔；
 * 电脑上支持实体键盘（数字 / 退格 / 回车），手机上就是九宫格。
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
  keyword: '',
  draft: {
    digits: '', // 按分存：'2850' => ¥28.50
    direction: 'expense',
    categoryId: null,
    note: '',
    occurredOn: today(),
  },
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
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
 * 和 worker 侧 smoke 测试完全一致的参数，换成浏览器实现。
 * salt 由用户名派生（SHA-256 前 16 字节），所以服务器不需要存 salt，
 * 也就不会出现「先查用户名是否存在」的探测面。
 */
async function deriveAuthHash(username, password) {
  const enc = new TextEncoder();
  const saltBuf = await crypto.subtle.digest(
    'SHA-256',
    enc.encode(`ledger:v1:${username.toLowerCase()}`),
  );
  const salt = new Uint8Array(saltBuf).slice(0, 16);

  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
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
    // 断网：GET 用上次存下来的那份，写入类请求交给离线队列
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

  const seg = $('#authMode');
  if (seg) {
    seg.dataset.mode = mode;
    for (const b of seg.querySelectorAll('.segmented__btn')) {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    }
  }

  $('#displayNameField').hidden = isLogin;
  $('#authSubmitText').textContent = isLogin ? '登录' : '创建账号';
  $('#authError').hidden = true;

  const title = $('#authTitle');
  const sub = $('#authSub');
  if (title) title.textContent = isLogin ? '欢迎回来' : '建一个账本';
  if (sub) {
    sub.textContent = isLogin
      ? '用你注册时的用户名和密码登录。'
      : '填一个用户名和密码就能开始，稍后再邀请家人。';
  }
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

  const original = $('#authSubmitText').textContent;
  btn.disabled = true;
  btn.classList.add('is-loading');
  $('#authSubmitText').textContent = '正在加密…';

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
    btn.classList.remove('is-loading');
    $('#authSubmitText').textContent = original;
    syncAuthButton();
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
  syncAuthButton();
}

function syncAuthButton() {
  const ok = $('#username').value.trim().length >= 3 && $('#password').value.length >= 8;
  $('#authSubmit').disabled = !ok;
}

/* ------------------------------------------------------------------ 启动 */

async function boot() {
  try {
    const data = await api('GET', '/api/me');
    state.user = data.user;
    state.members = data.members || [];
    const cats = await api('GET', '/api/categories');
    state.categories = cats.categories;
    state.draft.categoryId =
      state.draft.categoryId ||
      state.categories.find((c) => c.direction === state.draft.direction)?.id ||
      null;
    $('#authScreen').hidden = true;
    $('#appScreen').hidden = false;
    render();
  } catch {
    showAuth();
  }
}

/* ------------------------------------------------------------------ 渲染 */

function formatMonth(m) {
  const [y, mo] = m.split('-');
  return `${y} 年 ${Number(mo)} 月`;
}

function render() {
  for (const t of document.querySelectorAll('.nav__item')) {
    t.setAttribute('aria-selected', String(t.dataset.view === state.view));
  }

  $('#monthLabel').textContent = formatMonth(state.month);
  $('#scopeText').textContent = state.scope === 'me' ? '只看我' : '全家';
  $('#scopeToggle').dataset.scope = state.scope;

  if (state.user) {
    const name = state.user.displayName || state.user.username;
    $('#sideUserName').textContent = name;
    $('#sideAvatar').textContent = [...name][0] || '?';
    $('#sideRole').textContent = state.user.role === 'owner' ? '账本创建者' : '成员';
    $('#sideHousehold').textContent = state.user.householdName || '—';
  }

  const view = $('#view');
  view.replaceChildren();
  if (state.view === 'add') view.append(renderAdd());
  if (state.view === 'list') renderList(view);
  if (state.view === 'stats') renderStats(view);
  if (state.view === 'me') renderMe(view);
}

function summaryRow(labels) {
  const wrap = el('div', { className: 'summary' });
  for (const [label, value, cls] of labels) {
    const cell = el('div', { className: 'summary__cell' });
    cell.append(
      el('div', { className: 'summary__label', textContent: label }),
      el('div', { className: `summary__value ${cls || ''}`, textContent: '¥' + value }),
    );
    wrap.append(cell);
  }
  return wrap;
}

/* --------------------------------------------------------------- 记一笔 */

function renderAdd() {
  const d = state.draft;
  const wrap = el('div', { className: 'compose' });

  /* 左卡片：金额 + 数字键盘 */
  const left = el('div', { className: 'card' });

  const amountRow = el('div', { className: 'amount' });
  amountRow.append(
    el('span', { className: 'amount__cur', textContent: '¥' }),
    el(
      'span',
      { className: 'amount__value' + (d.digits ? '' : ' is-zero') },
      money(Number(d.digits || 0)),
    ),
  );
  left.append(amountRow);

  const pad = el('div', { className: 'keypad' });
  const press = (key) => {
    if (key === 'del') d.digits = d.digits.slice(0, -1);
    else if (key === '00') {
      if (d.digits) d.digits = (d.digits + '00').slice(0, 9);
    } else if (key === 'clear') d.digits = '';
    else d.digits = (d.digits + key).slice(0, 9);
    render();
  };
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del']) {
    const b = el('button', {
      type: 'button',
      className: 'key',
      textContent: k === 'del' ? '⌫' : k,
      'aria-label': k === 'del' ? '删除一位' : k,
    });
    b.onclick = () => press(k);
    pad.append(b);
  }
  left.append(pad);
  wrap.append(left);

  /* 右卡片：收/支、分类、备注、日期、保存 */
  const right = el('div', { className: 'card' });

  const dir = el('div', { className: 'direction' });
  for (const [key, label] of [
    ['expense', '支出'],
    ['income', '收入'],
  ]) {
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
  right.append(dir);

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
  right.append(grid);

  const meta = el('div', { className: 'compose__meta' });
  const note = el('input', { type: 'text', placeholder: '备注（可空）', maxLength: 120, value: d.note });
  note.oninput = () => {
    d.note = note.value;
  };
  const date = el('input', { type: 'date', value: d.occurredOn });
  date.onchange = () => {
    d.occurredOn = date.value || today();
  };
  meta.append(note, date);
  right.append(meta);

  const save = el('button', { type: 'button', className: 'key key--save', textContent: '记下来' });
  save.style.marginTop = '12px';
  save.disabled = !d.digits;
  save.onclick = saveEntry;
  right.append(save);

  right.append(el('p', { className: 'hint', textContent: '电脑上可以直接按数字键，回车保存。' }));
  wrap.append(right);

  return wrap;
}

async function saveEntry() {
  const d = state.draft;
  if (!d.digits || !d.categoryId) {
    if (!d.digits) toast('先按数字键输入金额');
    return;
  }
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
  return (
    err instanceof TypeError ||
    /Failed to fetch|NetworkError|Load failed|network/i.test(String(err?.message || ''))
  );
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
    if (state.view === 'list' || state.view === 'stats') render();
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
  view.replaceChildren(
    summaryRow([
      ['支出', money(s.expense), ''],
      ['收入', money(s.income), 'summary__value--income'],
      ['结余', money(s.balance), ''],
    ]),
  );

  const toolbar = el('div', { className: 'toolbar' });
  const box = el('div', { className: 'searchbox' });
  box.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a6 6 0 1 1-4.5 10L2 17.5 3.5 19l3.5-3.5A6 6 0 0 1 10 4Zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>';
  const search = el('input', { type: 'text', placeholder: '搜备注、分类或人', value: state.keyword });
  search.oninput = () => {
    state.keyword = search.value.trim();
    repaintRows();
  };
  box.append(search);
  toolbar.append(box);
  view.append(toolbar);

  const listWrap = el('div', {});
  view.append(listWrap);

  function repaintRows() {
    listWrap.replaceChildren();
    const k = state.keyword.toLowerCase();
    const items = k
      ? state.entries.filter((e) =>
          `${e.note || ''} ${e.category_name || ''} ${e.author_name || ''}`.toLowerCase().includes(k),
        )
      : state.entries;

    if (!items.length) {
      listWrap.append(
        el('div', {
          className: 'empty',
          textContent: k ? '没有匹配的记录' : '这个月还没有账，去「记一笔」开始吧。',
        }),
      );
      return;
    }

    const byDay = new Map();
    for (const e of items) {
      if (!byDay.has(e.occurred_on)) byDay.set(e.occurred_on, []);
      byDay.get(e.occurred_on).push(e);
    }

    for (const [day, dayItems] of byDay) {
      const group = el('div', { className: 'daygroup' });
      const spent = dayItems
        .filter((i) => i.direction === 'expense')
        .reduce((a, b) => a + b.amount_cents, 0);
      group.append(
        el('div', { className: 'daygroup__head' }, [
          el('span', { textContent: dayLabel(day) }),
          el('span', { textContent: spent ? `支出 ¥${money(spent)}` : '' }),
        ]),
      );
      for (const item of dayItems) {
        const row = el('button', { type: 'button', className: 'row' });
        row.append(
          el('span', { className: 'row__emoji', textContent: item.category_emoji || '📦' }),
          el('div', { className: 'row__main' }, [
            el('div', { className: 'row__title', textContent: item.note || item.category_name || '未分类' }),
            el('div', {
              className: 'row__sub',
              textContent: item.note
                ? `${item.category_name || '未分类'} · ${item.author_name}`
                : item.author_name,
            }),
          ]),
          el('span', {
            className: 'row__amount' + (item.direction === 'income' ? ' row__amount--income' : ''),
            textContent: (item.direction === 'income' ? '+' : '−') + money(item.amount_cents),
          }),
        );
        row.onclick = () => openEntryModal(item);
        group.append(row);
      }
      listWrap.append(group);
    }
  }

  repaintRows();
}

function dayLabel(day) {
  if (day === today()) return '今天';
  const d = new Date(day + 'T00:00:00');
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${Number(day.slice(5, 7))} 月 ${Number(day.slice(8, 10))} 日 · 周${week}`;
}

/* --------------------------------------------------------------- 统计 */

async function renderStats(view) {
  view.append(el('div', { className: 'empty', textContent: '加载中…' }));
  try {
    state.stats = await api('GET', `/api/stats?month=${state.month}&member=${state.scope}`);
  } catch (e) {
    view.replaceChildren(el('div', { className: 'empty', textContent: e.message }));
    return;
  }

  const s = state.stats;
  const total = s.total;
  view.replaceChildren(
    summaryRow([
      ['本月支出', money(total.expense), ''],
      ['本月收入', money(total.income), 'summary__value--income'],
      ['结余', money(total.balance), ''],
    ]),
  );

  if (s.byDay && s.byDay.length) {
    view.append(el('h3', { className: 'section-title', textContent: '每天花了多少' }));
    view.append(renderSpark(s.byDay));
  }

  const expenses = (s.byCategory || []).filter((c) => c.direction === 'expense');
  if (expenses.length) {
    view.append(el('h3', { className: 'section-title', textContent: '钱花在哪了' }));
    const sum = expenses.reduce((a, b) => a + b.cents, 0) || 1;
    const max = expenses[0].cents || 1;
    const bars = el('div', { className: 'bars' });
    for (const c of expenses.slice(0, 8)) {
      const bar = el('div', { className: 'bar' });
      const track = el('div', { className: 'bar__track' });
      track.append(
        el('div', { className: 'bar__fill', style: `width:${Math.max(4, (c.cents / max) * 100)}%` }),
      );
      bar.append(
        el('span', { textContent: `${c.emoji || '📦'} ${c.name || '未分类'}` }),
        track,
        el('span', {
          className: 'bar__value',
          textContent: `${Math.round((c.cents / sum) * 100)}%`,
        }),
      );
      bars.append(bar);
    }
    view.append(bars);
  } else {
    view.append(el('div', { className: 'empty', textContent: '这个月还没有支出。' }));
  }

  if (s.byMember && s.byMember.length) {
    view.append(el('h3', { className: 'section-title', textContent: '各花了多少' }));
    const people = new Map();
    for (const m of s.byMember) {
      if (!people.has(m.id)) people.set(m.id, { name: m.display_name, expense: 0, income: 0 });
      people.get(m.id)[m.direction] = m.cents;
    }
    for (const p of people.values()) {
      const row = el('div', { className: 'memrow' });
      row.append(
        el('span', { className: 'avatar', textContent: [...p.name][0] || '?' }),
        el('div', { style: 'flex:1' }, [
          el('div', { className: 'memrow__name', textContent: p.name }),
          el('div', {
            className: 'memrow__meta',
            textContent: `收入 ¥${money(p.income)}`,
          }),
        ]),
        el('div', { className: 'memrow__name', textContent: `支出 ¥${money(p.expense)}` }),
      );
      view.append(row);
    }
  }
}

/** 每天的支出柱状条（纯 CSS，无依赖，随宽度自适应） */
function renderSpark(byDay) {
  const [y, m] = state.month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const vals = new Array(days).fill(0);
  for (const r of byDay) {
    if (r.direction !== 'expense') continue;
    const i = Number(String(r.day).slice(8, 10)) - 1;
    if (i >= 0 && i < days) vals[i] += r.cents;
  }
  const max = Math.max(...vals, 1);

  const bars = el('div', { className: 'spark' });
  vals.forEach((v, i) => {
    const col = el('div', {
      className: 'spark__col',
      title: `${i + 1} 日 · ¥${money(v)}`,
    });
    const bar = el('div', { className: 'spark__bar' });
    // 用平方根压一下极端值，小额的日子也能看出来
    bar.style.height = v ? `${Math.round(6 + 94 * Math.sqrt(v / max))}%` : '3px';
    if (v && v === max) bar.classList.add('is-peak');
    col.append(bar);
    bars.append(col);
  });

  const axis = el('div', { className: 'spark__axis' }, [
    el('span', { textContent: '1 日' }),
    el('span', { textContent: `本月累计 ¥${money(vals.reduce((a, b) => a + b, 0))}` }),
    el('span', { textContent: `${days} 日` }),
  ]);

  return el('div', { className: 'sparkbox' }, [bars, axis]);
}

/* ------------------------------------------------------------------ 我的 */

function renderMe(view) {
  const u = state.user;

  const profile = el('div', { className: 'panel' });
  const prow = el('div', { className: 'profile' });
  prow.append(
    el('span', { className: 'avatar', textContent: [...(u.displayName || u.username)][0] || '?' }),
    el('div', {}, [
      el('b', { textContent: u.displayName || u.username }),
      el('small', { textContent: `@${u.username} · ${u.householdName || '我的账本'}` }),
    ]),
  );
  profile.append(prow);
  view.append(profile);

  if (state.members.length) {
    const members = el('div', { className: 'panel' });
    members.append(el('h3', { textContent: `账本成员（${state.members.length}）` }));
    for (const mem of state.members) {
      const row = el('div', { className: 'memrow' });
      row.style.background = 'transparent';
      row.style.border = '0';
      row.style.padding = '8px 0';
      row.append(
        el('span', { className: 'avatar', textContent: [...(mem.display_name || '?')][0] }),
        el('div', { style: 'flex:1' }, [
          el('div', { className: 'memrow__name', textContent: mem.display_name }),
          el('div', {
            className: 'memrow__meta',
            textContent: mem.role === 'owner' ? '创建者' : '成员',
          }),
        ]),
        mem.id === u.id ? el('span', { className: 'memrow__meta', textContent: '是你' }) : '',
      );
      members.append(row);
    }
    view.append(members);
  }

  const inviteCard = el('div', { className: 'panel' });
  inviteCard.append(el('h3', { textContent: '把家人拉进来' }));
  const hint = el('p', {
    className: 'muted',
    textContent: '生成一个 10 分钟内有效的邀请码，对方注册后输入即可。',
  });
  const codeBox = el('div', { className: 'invite-code' });
  const genBtn = el('button', { type: 'button', className: 'btn btn--primary btn--sm', textContent: '生成邀请码' });
  genBtn.onclick = async () => {
    try {
      genBtn.disabled = true;
      const data = await api('POST', '/api/household/invite');
      codeBox.textContent = data.code;
      let left = data.ttlSeconds ?? 600;
      const tick = () => {
        hint.textContent =
          left > 0 ? `${Math.floor(left / 60)} 分 ${left % 60} 秒后失效` : '邀请码已失效，重新生成一个';
        if (left <= 0) clearInterval(timer);
        left -= 1;
      };
      tick();
      const timer = setInterval(tick, 1000);
      codeBox.onclick = () => {
        navigator.clipboard?.writeText(data.code).then(
          () => toast('邀请码已复制'),
          () => {},
        );
      };
    } catch (e) {
      toast(e.message);
    } finally {
      genBtn.disabled = false;
    }
  };
  inviteCard.append(hint, codeBox, genBtn);
  view.append(inviteCard);

  const joinCard = el('div', { className: 'panel' });
  joinCard.append(el('h3', { textContent: '我拿到了邀请码' }));
  const row = el('div', { className: 'invite-row' });
  const input = el('input', { type: 'text', placeholder: '6 位邀请码', maxLength: 8 });
  const joinBtn = el('button', { type: 'button', className: 'btn btn--ghost btn--sm', textContent: '加入账本' });
  joinBtn.onclick = async () => {
    try {
      joinBtn.disabled = true;
      await api('POST', '/api/household/join', { code: input.value.trim() });
      toast('已加入，账现在合在一起了');
      await boot();
    } catch (e) {
      toast(e.message);
    } finally {
      joinBtn.disabled = false;
    }
  };
  row.append(input, joinBtn);
  joinCard.append(row);
  view.append(joinCard);

  const account = el('div', { className: 'panel' });
  account.append(el('h3', { textContent: '账号' }));
  const outBtn = el('button', { type: 'button', className: 'btn btn--ghost btn--sm', textContent: '退出登录' });
  outBtn.onclick = async () => {
    await api('POST', '/api/auth/logout').catch(() => {});
    location.reload();
  };
  account.append(outBtn);
  view.append(account);
}

/* -------------------------------------------------------------- 单笔详情 */

function openEntryModal(item) {
  const modal = $('#modal');
  const card = el('div', { className: 'modal__card' });

  card.append(
    el('h3', {
      textContent: (item.direction === 'income' ? '+' : '−') + '¥' + money(item.amount_cents),
    }),
    el('p', {
      className: 'muted',
      textContent: `${item.category_emoji || ''} ${item.category_name || '未分类'} · ${item.occurred_on} · ${
        item.author_name
      }`,
    }),
  );
  if (item.note) card.append(el('p', { textContent: item.note }));

  const actions = el('div', { className: 'modal__actions' });
  const edit = el('button', { type: 'button', className: 'btn btn--ghost', textContent: '改一下' });
  edit.onclick = () => openEditModal(item);
  const del = el('button', { type: 'button', className: 'btn btn--ghost', textContent: '删除' });
  del.style.color = '#a92e26';
  del.onclick = async () => {
    try {
      await api('DELETE', `/api/entries/${item.id}`);
      closeModal();
      toast('已删除');
      render();
    } catch (e) {
      toast(e.message);
    }
  };
  actions.append(del, edit);
  card.append(actions);

  const close = el('button', { type: 'button', className: 'btn btn--primary btn--block', textContent: '知道了' });
  close.style.marginTop = '8px';
  close.onclick = closeModal;
  card.append(close);

  modal.replaceChildren(card);
  modal.hidden = false;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
}

function openEditModal(item) {
  const modal = $('#modal');
  const card = el('div', { className: 'modal__card' });
  card.append(el('h3', { textContent: '改一下' }));

  const labelled = (text, control) => {
    const wrap = el('div', { className: 'modal__field' });
    wrap.append(el('label', { className: 'modal__label', textContent: text }), control);
    return wrap;
  };

  const amount = el('input', {
    type: 'number',
    step: '0.01',
    min: '0.01',
    value: (item.amount_cents / 100).toFixed(2),
    'aria-label': '金额',
  });

  const note = el('input', {
    type: 'text',
    placeholder: '比如：楼下面馆',
    maxLength: 120,
    value: item.note || '',
    'aria-label': '备注',
  });

  const select = el('select', { 'aria-label': '分类' });
  select.className = 'modal__select';
  for (const c of state.categories.filter((x) => x.direction === item.direction)) {
    const opt = el('option', { value: String(c.id), textContent: `${c.emoji} ${c.name}` });
    if (c.id === item.category_id) opt.selected = true;
    select.append(opt);
  }

  const date = el('input', { type: 'date', value: item.occurred_on, 'aria-label': '日期' });

  const amountField = labelled('金额', amount);
  const noteField = labelled('备注', note);
  const catField = labelled('分类', select);
  const dateField = labelled('日期', date);

  card.append(amountField, noteField, catField, dateField);

  const actions = el('div', { className: 'modal__actions' });
  const cancel = el('button', { type: 'button', className: 'btn btn--ghost', textContent: '取消' });
  cancel.onclick = closeModal;
  const save = el('button', { type: 'button', className: 'btn btn--primary', textContent: '保存' });
  save.onclick = async () => {
    const yuan = Number(amount.value);
    if (!Number.isFinite(yuan) || yuan <= 0) return toast('金额要大于 0');
    try {
      save.disabled = true;
      await api('PATCH', `/api/entries/${item.id}`, {
        amountCents: Math.round(yuan * 100),
        note: note.value.trim(),
        categoryId: Number(select.value),
        occurredOn: date.value,
      });
      closeModal();
      toast('已保存');
      render();
    } catch (e) {
      toast(e.message);
      save.disabled = false;
    }
  };
  actions.append(cancel, save);
  card.append(actions);

  modal.replaceChildren(card);
  modal.hidden = false;
}

function closeModal() {
  $('#modal').hidden = true;
}

/* -------------------------------------------------------------- 交互工具 */

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    t.hidden = true;
  }, 2400);
}

function shiftMonth(delta) {
  const [y, m] = state.month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  render();
}

/* ------------------------------------------------------------------ 绑定 */

function bind() {
  for (const sel of ['#username', '#password', '#displayName']) {
    $(sel).addEventListener('input', syncAuthButton);
  }
  syncAuthButton();

  $('#authForm').addEventListener('submit', submitAuth);

  for (const b of document.querySelectorAll('.segmented__btn')) {
    b.addEventListener('click', () => setAuthMode(b.dataset.mode));
  }

  const peek = $('#peekPassword');
  if (peek) {
    peek.addEventListener('click', () => {
      const input = $('#password');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      peek.classList.toggle('is-on', show);
      peek.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
    });
  }

  for (const item of document.querySelectorAll('.nav__item')) {
    item.addEventListener('click', () => {
      state.view = item.dataset.view;
      render();
      window.scrollTo({ top: 0 });
    });
  }

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

  // 实体键盘：数字直接输入、退格删除、回车保存
  window.addEventListener('keydown', (e) => {
    if (!$('#modal').hidden && e.key === 'Escape') {
      closeModal();
      return;
    }
    if (state.view !== 'add' || !$('#appScreen') || $('#appScreen').hidden) return;
    if ($('#modal').hidden === false) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      state.draft.digits = (state.draft.digits + e.key).slice(0, 9);
      render();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      state.draft.digits = state.draft.digits.slice(0, -1);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      saveEntry();
    }
  });
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

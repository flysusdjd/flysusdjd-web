/**
 * 造一份看起来像真的演示数据 / seed realistic demo data
 *
 * 只用于本地开发库（.dev.db），不要在线上跑。
 * Local dev only — it talks to http://127.0.0.1:8787.
 *
 *   node ledger/scripts/seed-demo.mjs
 *   node ledger/scripts/seed-demo.mjs --reset   # 先清空本地数据库（需自己重启 dev-server）
 */
const BASE = process.env.BASE || 'http://127.0.0.1:8787';

/* ------------------------------------------------------------ 密码拉伸 */

import { createHash, pbkdf2Sync } from 'node:crypto';

function deriveAuthHash(username, password) {
  const salt = createHash('sha256').update(`ledger:v1:${username.toLowerCase()}`).digest().subarray(0, 16);
  return pbkdf2Sync(password, salt, 600_000, 32, 'sha256').toString('hex');
}

/* ------------------------------------------------------------------ 请求 */

class Client {
  constructor() {
    this.cookie = '';
  }
  async call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.getSetCookie?.() || [];
    for (const c of setCookie) {
      const [pair] = c.split(';');
      if (pair.includes('=')) this.cookie = pair;
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* empty */
    }
    return { status: res.status, data };
  }
}

const log = (...a) => console.log(...a);

/* ------------------------------------------------------------------ 主流程 */

const DEMO_PASSWORD = 'demo12345';

async function registerOrLogin(client, username, displayName) {
  const password = DEMO_PASSWORD;
  const authHash = deriveAuthHash(username, password);
  const reg = await client.call('POST', '/api/auth/register', { username, displayName, authHash });
  if (reg.status === 409) {
    const login = await client.call('POST', '/api/auth/login', { username, authHash });
    log(`   ${username}: 已存在，登录 ${login.status === 200 ? 'OK' : 'FAILED'}`);
    return login.data;
  }
  log(`   ${username}: 注册 ${reg.status === 200 ? 'OK' : 'FAILED ' + JSON.stringify(reg.data)}`);
  return reg.data;
}

function d(day) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-${String(day).padStart(2, '0')}`;
}

const today = new Date().getDate();

async function addEntries(client, cats, plan) {
  const byName = new Map(cats.map((c) => [c.name, c]));
  let ok = 0;
  for (const [dayOffset, catName, cents, note] of plan) {
    const day = Math.max(1, today - dayOffset);
    const cat = byName.get(catName);
    if (!cat) {
      log(`   ! 找不到分类 ${catName}`);
      continue;
    }
    const res = await client.call('POST', '/api/entries', {
      amountCents: cents,
      direction: cat.direction,
      categoryId: cat.id,
      note,
      occurredOn: d(day),
      clientUuid: `seed-${catName}-${day}-${cents}-${Math.random().toString(36).slice(2, 8)}`,
    });
    if (res.status === 200) ok += 1;
    else log(`   ! ${catName} ${cents} -> ${res.status} ${JSON.stringify(res.data)}`);
  }
  log(`   写入 ${ok} / ${plan.length} 笔`);
}

const demo = new Client();
const partner = new Client();

log('1) 建两个账号');
const demoUser = await registerOrLogin(demo, 'demo', '小林');
const partnerUser = await registerOrLogin(partner, 'ajane', '阿珍');

log('2) 阿珍加入小林的账本');
const invite = await demo.call('POST', '/api/household/invite');
if (invite.status !== 200) throw new Error('生成邀请码失败: ' + JSON.stringify(invite.data));
const joined = await partner.call('POST', '/api/household/join', { code: invite.data.code });
log(`   邀请码 ${invite.data.code} → 加入 ${joined.status === 200 ? 'OK' : JSON.stringify(joined.data)}`);

log('3) 小林记账');
const demoCats = (await demo.call('GET', '/api/categories')).data.categories;
await addEntries(demo, demoCats, [
  [0, '餐饮', 2600, '楼下面馆'],
  [0, '交通', 1200, '地铁'],
  [1, '买菜', 8840, '周末囤菜'],
  [2, '餐饮', 4500, '外卖'],
  [3, '日用', 3990, '洗衣液'],
  [5, '娱乐', 6800, '电影'],
  [6, '工资', 1850000, '十月工资'],
  [8, '住房', 320000, '房租'],
]);

log('4) 阿珍记账');
const partnerCats = (await partner.call('GET', '/api/categories')).data.categories;
await addEntries(partner, partnerCats, [
  [0, '餐饮', 1800, '早餐'],
  [0, '学习', 12900, '一本书'],
  [1, '买菜', 6250, '水果'],
  [2, '交通', 800, '公交'],
  [4, '人情', 20000, '同事结婚'],
  [6, '工资', 1520000, '十月工资'],
  [9, '医疗', 15600, '感冒药'],
]);

log('5) 核对汇总');
for (const [name, c] of [['小林', demo], ['阿珍', partner]]) {
  const me = await c.call('GET', '/api/me');
  const stats = await c.call('GET', '/api/stats?month=' + new Date().toISOString().slice(0, 7) + '&member=all');
  log(
    `   ${name}: 账本「${me.data?.user?.householdName}」成员 ${me.data?.members?.length} 人，` +
      `本月支出 ¥${((stats.data?.total?.expense || 0) / 100).toFixed(2)}`,
  );
}

log('\n完成。用 demo / demo12345 或 ajane / demo12345 登录 http://127.0.0.1:8787');

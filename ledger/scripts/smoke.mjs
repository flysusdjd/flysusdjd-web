/**
 * 后端冒烟测试 / Backend smoke test
 * 需要先起 dev-server：node ledger/dev-server.mjs
 *   node ledger/scripts/smoke.mjs
 */
import { pbkdf2Sync, createHash, randomUUID } from 'node:crypto';

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const ITER = 600_000;

/** 和浏览器端完全一致的拉伸：salt = SHA-256("ledger:v1:<username>") 前 16 字节 */
function authHashOf(username, password) {
  const salt = createHash('sha256').update(`ledger:v1:${username.toLowerCase()}`).digest().subarray(0, 16);
  return pbkdf2Sync(password, salt, ITER, 32, 'sha256').toString('hex');
}

let cookie = '';
let pass = 0;
let failCount = 0;

function check(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failCount++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, data };
}

const suffix = Date.now().toString(36).slice(-5);
const alice = `alice_${suffix}`;
const bob = `bob_${suffix}`;
const PW = 'test-password-123';

console.log(`\n— 注册与登录 / register & login  (${alice}, ${bob})`);

let r = await api('POST', '/api/auth/register', {
  username: alice,
  displayName: 'Alice',
  authHash: authHashOf(alice, PW),
});
check('注册 alice', r.status === 200, JSON.stringify(r.data));

r = await api('GET', '/api/me');
check('登录态有效', r.status === 200 && r.data?.user?.username === alice);
check('自动建了家庭账本', !!r.data?.user?.householdId);

r = await api('GET', '/api/categories');
const cats = r.data?.categories ?? [];
check('默认分类 13 个', cats.length === 13, `实际 ${cats.length}`);
const expenseCats = cats.filter((c) => c.direction === 'expense');
const incomeCats = cats.filter((c) => c.direction === 'income');
check('收支分类都有', expenseCats.length === 10 && incomeCats.length === 3);

console.log('\n— 记账 / entries');

const uuid1 = randomUUID();
r = await api('POST', '/api/entries', {
  amountCents: 2850,
  direction: 'expense',
  categoryId: expenseCats[0].id,
  note: '午饭 黄焖鸡',
  occurredOn: new Date().toISOString().slice(0, 10),
  clientUuid: uuid1,
});
check('记一笔支出', r.status === 200 && r.data?.ok, JSON.stringify(r.data));

r = await api('POST', '/api/entries', {
  amountCents: 1200,
  direction: 'expense',
  categoryId: expenseCats[2].id,
  note: '地铁',
  occurredOn: new Date().toISOString().slice(0, 10),
  clientUuid: randomUUID(),
});
check('记第二笔', r.data?.ok);

r = await api('POST', '/api/entries', {
  amountCents: 1500000,
  direction: 'income',
  categoryId: incomeCats[0].id,
  note: '工资',
  occurredOn: new Date().toISOString().slice(0, 10),
  clientUuid: randomUUID(),
});
check('记一笔收入', r.data?.ok);

r = await api('POST', '/api/entries', {
  amountCents: 2850,
  direction: 'expense',
  categoryId: expenseCats[0].id,
  note: '重复提交',
  occurredOn: new Date().toISOString().slice(0, 10),
  clientUuid: uuid1,
});
check('同一 clientUuid 幂等', r.data?.duplicate === true);

r = await api('POST', '/api/entries', { amountCents: 0, categoryId: expenseCats[0].id, clientUuid: randomUUID() });
check('金额 0 被拒', r.status === 400);

console.log('\n— 家庭共享 / household sharing');

r = await api('POST', '/api/household/invite');
const code = r.data?.code;
check('生成 10 分钟邀请码', !!code && r.data?.ttlSeconds === 600, JSON.stringify(r.data));

cookie = '';
r = await api('POST', '/api/auth/register', {
  username: bob,
  displayName: 'Bob',
  authHash: authHashOf(bob, PW),
});
check('注册 bob（自带一个空账本）', r.status === 200);

r = await api('POST', '/api/household/join', { code });
check('bob 用邀请码加入', r.data?.ok, JSON.stringify(r.data));

r = await api('GET', '/api/me');
check('bob 已在同一账本', r.data?.members?.length === 2, `成员 ${r.data?.members?.length}`);

r = await api('POST', '/api/entries', {
  amountCents: 6600,
  direction: 'expense',
  categoryId: expenseCats[1].id,
  note: '超市买菜',
  occurredOn: new Date().toISOString().slice(0, 10),
  clientUuid: randomUUID(),
});
check('bob 记一笔', r.data?.ok);

console.log('\n— 合并视图 / merged view');

cookie = '';
r = await api('POST', '/api/auth/login', { username: alice, authHash: authHashOf(alice, PW) });
check('alice 重新登录', r.status === 200, JSON.stringify(r.data));

const month = new Date().toISOString().slice(0, 7);

r = await api('GET', `/api/entries?month=${month}&member=all`);
const all = r.data?.entries ?? [];
check('家庭视图看到两个人的账', all.length === 4, `实际 ${all.length}`);
check('账单带作者名', all.every((e) => !!e.author_name));

r = await api('GET', `/api/entries?month=${month}&member=me`);
check('个人视图只看到自己的 3 笔', (r.data?.entries ?? []).length === 3, `实际 ${(r.data?.entries ?? []).length}`);

r = await api('GET', `/api/stats?month=${month}&member=all`);
const st = r.data;
check('家庭支出 = 2850+1200+6600', st?.total?.expense === 10650, `实际 ${st?.total?.expense}`);
check('家庭收入 = 1500000', st?.total?.income === 1500000, `实际 ${st?.total?.income}`);
check('结余 = 收入-支出', st?.total?.balance === 1500000 - 10650);
check('按成员统计有 2 人', (st?.byMember ?? []).length >= 2);
check('按分类统计有数据', (st?.byCategory ?? []).length >= 3);

console.log('\n— 软删除 / soft delete');

const target = all.find((e) => e.note === '地铁');
r = await api('DELETE', `/api/entries/${target.id}`);
check('删除一笔', r.data?.ok);

r = await api('GET', `/api/entries?month=${month}&member=all`);
check('列表里少了一笔', (r.data?.entries ?? []).length === 3);

r = await api('GET', '/api/entries/deleted');
check('回收站能看到', (r.data?.entries ?? []).length === 1);

r = await api('POST', `/api/entries/${target.id}/restore`);
check('恢复这笔', r.data?.ok);

r = await api('GET', `/api/entries?month=${month}&member=all`);
check('恢复后回到 4 笔', (r.data?.entries ?? []).length === 4);

console.log('\n— 安全性 / security');

cookie = '';
r = await api('POST', '/api/auth/login', { username: alice, authHash: authHashOf(alice, 'wrong-password') });
check('错误密码 401', r.status === 401);

r = await api('GET', '/api/entries');
check('未登录访问被拒 401', r.status === 401);

cookie = '';
r = await api('POST', '/api/auth/register', {
  username: alice,
  displayName: 'Fake',
  authHash: authHashOf(alice, PW),
});
check('用户名重复 409', r.status === 409);

cookie = '';
r = await api('POST', '/api/auth/login', { username: 'nobody_here', authHash: authHashOf('x', PW) });
check('不存在的用户 401（不泄露）', r.status === 401);

console.log(`\n结果：${pass} 通过，${failCount} 失败\n`);
process.exit(failCount ? 1 : 0);

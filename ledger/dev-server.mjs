/**
 * 本地开发服务器 / Local dev server
 *
 * 为什么不用 wrangler：wrangler 要下载几十 MB 的 workerd，而 Node 24 自带 node:sqlite。
 * 这个文件把 D1 的 API（prepare/bind/first/all/run/batch）映射到 node:sqlite，
 * 然后把 /api/* 交给和线上完全同一份 worker/index.js 处理。
 *
 * Why not wrangler: no 50MB download needed. We shim the D1 API onto node:sqlite and run
 * the exact same worker/index.js that gets deployed, so local and production never diverge.
 *
 *   node ledger/dev-server.mjs            # http://127.0.0.1:8787
 *   node ledger/dev-server.mjs --reset    # 清空本地数据库重来
 */
import { createServer } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DB_PATH = join(ROOT, '.dev.db');
const WEB_DIR = join(ROOT, 'web');
const PORT = Number(process.env.PORT || 8787);
const PEPPER = process.env.AUTH_PEPPER || 'dev-only-pepper-change-me';

if (process.argv.includes('--reset') && existsSync(DB_PATH)) {
  await rm(DB_PATH);
  console.log('🧹 已清空本地数据库 / local db removed');
}

/* ------------------------------------------------------- D1 → node:sqlite */

class LocalStatement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params) {
    return new LocalStatement(this.db, this.sql, params.map((p) => (p === undefined ? null : p)));
  }
  async first(column) {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...this.params);
    if (!row) return null;
    return column ? row[column] : row;
  }
  async all() {
    const rows = this.db.prepare(this.sql).all(...this.params);
    return { results: rows, success: true, meta: {} };
  }
  async run() {
    const info = this.db.prepare(this.sql).run(...this.params);
    return {
      success: true,
      meta: { changes: info.changes, last_row_id: info.lastInsertRowid },
    };
  }
}

class LocalD1 {
  constructor(db) {
    this.db = db;
  }
  prepare(sql) {
    return new LocalStatement(this.db, sql);
  }
  async batch(statements) {
    const out = [];
    for (const s of statements) out.push(await s.run());
    return out;
  }
  async exec(sql) {
    this.db.exec(sql);
    return { count: 0, duration: 0 };
  }
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(await readFile(join(ROOT, 'worker', 'schema.sql'), 'utf8'));

const env = { DB: new LocalD1(db), AUTH_PEPPER: PEPPER };
const { default: worker } = await import('./worker/index.js');

/* ------------------------------------------------------------ 静态文件 */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function serveStatic(pathname, res) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const file = join(WEB_DIR, safe);
  if (!file.startsWith(WEB_DIR)) return false;
  try {
    const buf = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(buf);
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- HTTP */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (!url.pathname.startsWith('/api/')) {
    if (req.method === 'GET' && (await serveStatic(url.pathname, res))) return;
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404');
    return;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else headers.set(k, v);
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  });

  try {
    const response = await worker.fetch(request, env, {});
    const out = Buffer.from(await response.arrayBuffer());
    const setCookie = response.headers.get('set-cookie');
    const resHeaders = { 'content-type': response.headers.get('content-type') || 'application/json' };
    if (setCookie) resHeaders['set-cookie'] = setCookie;
    res.writeHead(response.status, resHeaders);
    res.end(out);
    console.log(`${req.method} ${url.pathname}${url.search} → ${response.status}`);
  } catch (err) {
    console.error('dev server error', err);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'dev_server_error', message: String(err?.message || err) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  家庭记账本 · 本地开发服务器`);
  console.log(`  http://127.0.0.1:${PORT}`);
  console.log(`  数据库 ${DB_PATH}`);
  console.log(`  pepper  ${PEPPER === 'dev-only-pepper-change-me' ? '使用默认开发值' : '自定义'}\n`);
});

// 让 CI / 脚本能干净退出
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

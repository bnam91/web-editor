/* H1 — 신고 큐가 라이브 라우팅 사고에서 살아나는지 (2026-09-06)
 *
 * ★사고 실측: 라이브에서 POST /api/report 가 404 {"ok":false,"error":"not_found"} 를 준다
 *   (서버의 /api/report·/api/notice 폴더 «전체»가 EC2 라우팅 화이트리스트에서 빠졌다 — 대성
 *   확인). 반면 POST /api/license/report 는 200 이다(대성이 실신고 1건으로 확인,
 *   reportId 6a9d28dfce2c16cb1daac337). main/report/queue.js 가 정본 하나만 쳐서, 404 가
 *   PERMANENT 목록에 없어(★의도된 설계 — 배포 순서로 신고를 잃지 않으려고) 큐에 «영원히»
 *   갇힌다 — 현빈 기계 reports-queue.json 에 실제로 2건 갇힘(1건 271회 재시도).
 *
 * ★고친 방식: 새 판정을 만들지 않는다. main/admin/index.js 의 _callWithAlias(정본→404 면
 *   alias) 를 «그대로» 재사용한다(공지가 이미 이 규약으로 돈다). 모양 차이(신고 큐는 이미지가
 *   실려 타임아웃이 더 길어야 하고, _apiBase 가 stage/live 로 바뀔 수 있다)만 timeoutMs·base
 *   두 인자로 열어서 흡수했다 — 로직을 복사하지 않았다.
 *
 * ★검사 원칙 — 「고쳤다」가 아니라 «갇힌 신고가 실제로 빠져나가는지»로 판정한다:
 *   H1-1 은 ★양성대조다 — dev(고치기 전) 소스를 그대로 떠서 같은 시나리오를 돌려 «빨간»
 *   것부터 본다. 대조 없이 초록만 보면 «애초에 안 걸리는 검사»를 통과시킨 것일 수 있다.
 *
 * ⛔라이브 서버·현빈 기계의 실제 reports-queue.json 은 건드리지 않는다. 전부 로컬 HTTP
 *   가짜 서버 + 임시 userData 디렉터리에서만 재현한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const require_ = createRequire(import.meta.url);
const { mkTmpRoot } = require_('./_tmproot.js');

/* admin/index.js 의 기본(3인자 호출) API_BASE 를 「존재하지만 절대 안 열리는」 주소로
 * 고정한다 — port 1 은 관례상 어느 OS 도 안 열어 즉시 ECONNREFUSED 다(오프라인처럼 빠르다).
 * ★이 값을 admin 이 «처음 require 되기 전»에 박아야 한다(services/authService.js 가
 * require 시점에 한 번만 읽는다). */
process.env.GODITOR_LICENSE_API = 'http://127.0.0.1:1';

/* ── 가짜 서버 ──────────────────────────────────────────────────────────── */
function startServer(routes) {
  return new Promise((resolve) => {
    const hits = [];
    const srv = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        let body = null;
        try { body = raw ? JSON.parse(raw) : null; } catch (_) { body = null; }
        hits.push({ method: req.method, url: req.url, body });
        const route = routes[req.url];
        if (!route) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"not_found"}'); return; }
        const { status, json } = typeof route === 'function' ? route(body) : route;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(json));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, hits, base: `http://127.0.0.1:${srv.address().port}` }));
  });
}
const close = (srv) => new Promise((r) => srv.close(r));

/* ── 큐 모듈 로더 — «새(고친)» 판과 «옛(dev, git show)» 판을 각각 격리해서 띄운다 ──
 *   같은 파일 경로를 두 번 require 하면 캐시가 뒤섞이니, 옛 판은 스크래치패드에 다른
 *   경로로 떠서 별개 모듈로 로드한다. */
function loadFixedQueue() {
  const p = require_.resolve(path.join(ROOT, 'main/report/queue.js'));
  delete require_.cache[p];
  return require_(p);
}
/* ★git show 로 매번 「고치기 전」을 뜨지 않는다 — 이 저장소를 local 'dev' 브랜치 없이
 * 클론(얕은 클론·CI worktree 등)하면 그 명령이 죽는다. 대신 얼린 고정자료를 쓴다
 * (U-M67 스위트가 옛 산식을 인라인으로 못 박는 것과 같은 관례) — 파일 자체가 provenance
 * 주석을 달고 있다. */
function loadOldQueue() {
  const p = require_.resolve('./_fixture-h1-queue-pre-fix.js');
  delete require_.cache[p];
  return require_(p);
}

function tmpUserData() { return mkTmpRoot('h1-ud-'); }
function queueFile(dir) { return path.join(dir, 'reports-queue.json'); }

test('H1-0 ★구조 — queue.js 가 admin 의 _callWithAlias 를 실제로 부른다(퇴행 감시)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'main/report/queue.js'), 'utf8');
  assert.match(src, /_callWithAlias\(/, '정본→alias 재시도 호출이 안 보인다');
  assert.match(src, /require\(['"]\.\.\/admin['"]\)/, 'admin 모듈을 재사용하지 않는다(복사됐을 수 있다)');
});

test('H1-1 ★양성대조 — dev(고치기 전) 큐는 정본 404·alias 200 에서도 «영원히 갇힌다»', async () => {
  const { srv, hits, base } = await startServer({
    '/api/report': { status: 404, json: { ok: false, error: 'not_found' } },       // ★실측 그대로
    '/api/license/report': { status: 200, json: { ok: true, reportId: 'deadbeefdeadbeefdeadbeef', message: '접수됨' } },
  });
  try {
    const q = loadOldQueue();
    const dir = tmpUserData();
    q.init({ userDataDir: dir, apiBase: base, readAuth: () => null, log: () => {} });
    q.enqueue({ text: '버그다' });
    const r = await q.flush();
    assert.equal(r.sent, 0, '옛 판이 alias 를 몰라 «못 보냈어야» 한다(대조군 자체가 무효라면 이 값이 1)');
    assert.equal(r.left, 1, '항목이 큐에 그대로 갇혀 있어야 한다');
    assert.equal(hits.length, 1, '옛 판은 정본 한 곳만 두드린다(alias 를 아예 모른다)');
    assert.equal(hits[0].url, '/api/report');
  } finally { await close(srv); }
});

test('H1-2 ★고친 큐 — 같은 시나리오에서 alias 로 넘어가 갇힌 신고가 빠져나간다', async () => {
  const { srv, hits, base } = await startServer({
    '/api/report': { status: 404, json: { ok: false, error: 'not_found' } },
    '/api/license/report': (body) => ({ status: 200, json: { ok: true, reportId: '6a9d28dfce2c16cb1daac337', message: '접수됨' } }),
  });
  try {
    const q = loadFixedQueue();
    const dir = tmpUserData();
    q.init({ userDataDir: dir, apiBase: base, readAuth: () => null, log: () => {} });
    q.enqueue({ text: '갇혔던 신고' });
    const r = await q.flush();
    assert.equal(r.sent, 1, 'alias 성공을 못 셌다');
    assert.equal(r.left, 0, '큐에 남아 있으면 안 된다');
    assert.equal(r.lastMessage, '접수됨');
    assert.deepEqual(JSON.parse(fs.readFileSync(queueFile(dir), 'utf8')).items, [], '파일에서도 빠져야 한다');
    assert.equal(hits.length, 2, '정본(404)+alias(200) 두 번이어야 한다');
    assert.deepEqual(hits.map((h) => h.url), ['/api/report', '/api/license/report']);
  } finally { await close(srv); }
});

test('H1-3 ★정본·alias 가 «둘 다» 404(메시지 없음) — 배포 전이니 버리지 않고 남긴다', async () => {
  const { srv, hits, base } = await startServer({
    '/api/report': { status: 404, json: { ok: false, error: 'not_found' } },
    '/api/license/report': { status: 404, json: { ok: false, error: 'not_found' } },
  });
  try {
    const q = loadFixedQueue();
    const dir = tmpUserData();
    q.init({ userDataDir: dir, apiBase: base, readAuth: () => null, log: () => {} });
    q.enqueue({ text: '아직 배포 전' });
    const r = await q.flush();
    assert.equal(r.sent, 0);
    assert.equal(r.dropped, 0, '404 는 PERMANENT 가 아니다 — 버리면 안 된다');
    assert.equal(r.left, 1);
    const items = JSON.parse(fs.readFileSync(queueFile(dir), 'utf8')).items;
    assert.equal(items.length, 1, '항목이 살아 있어야 다음 배포 뒤 재시도된다');
    assert.equal(items[0].tries, 1);
    assert.equal(hits.length, 2, '두 주소 다 두드려야 한다');
  } finally { await close(srv); }
});

test('H1-4 ★정본이 «내용을 읽고» 거절(400) — alias 를 두드리지 않고 즉시 버린다', async () => {
  const { srv, hits, base } = await startServer({
    '/api/report': { status: 400, json: { ok: false, error: 'text_too_long', message: '내용이 너무 깁니다' } },
    '/api/license/report': { status: 200, json: { ok: true } },   // 불려선 안 된다
  });
  try {
    const q = loadFixedQueue();
    const dir = tmpUserData();
    q.init({ userDataDir: dir, apiBase: base, readAuth: () => null, log: () => {} });
    q.enqueue({ text: 'x'.repeat(5000) });
    const r = await q.flush();
    assert.equal(r.dropped, 1);
    assert.equal(r.sent, 0);
    assert.equal(r.lastError, '내용이 너무 깁니다');
    assert.equal(hits.length, 1, 'PERMANENT 면 alias 를 부르면 안 된다(정본이 이미 «말과 함께» 거절)');
  } finally { await close(srv); }
});

test('H1-5 ⛔세션토큰이 큐 파일에 안 남는다 — 보낼 때만 실린다', async () => {
  const { srv, hits, base } = await startServer({
    '/api/report': { status: 404, json: { ok: false, error: 'not_found' } },
    '/api/license/report': { status: 200, json: { ok: true, message: 'ok' } },
  });
  try {
    const q = loadFixedQueue();
    const dir = tmpUserData();
    const SECRET = 'sekret-session-token-9f8e7d';
    q.init({ userDataDir: dir, apiBase: base, readAuth: () => ({ email: 'a@b.com', sessionToken: SECRET }), log: () => {} });
    q.enqueue({ text: '로그인 상태에서 신고' });
    // ★디스크에는 flush 전에도 SECRET 이 없어야 한다(enqueue 직후 파일).
    assert.ok(!fs.readFileSync(queueFile(dir), 'utf8').includes(SECRET), 'enqueue 직후인데 벌써 토큰이 파일에 있다');
    const r = await q.flush();
    assert.equal(r.sent, 1);
    // flush 뒤(성공하면 항목이 지워지지만, 지워지기 전 «중간 상태» inflightAt 기록 시점에도
    // 파일 전체를 다시 검사 — 큐 파일에는 어느 시점에도 토큰 문자열이 없어야 한다.
    assert.ok(!fs.readFileSync(queueFile(dir), 'utf8').includes(SECRET), 'flush 뒤 파일에 토큰이 남아 있다');
    // 그런데 실제 서버로 나간 요청 body 에는 토큰이 «실렸어야» 한다(안 실리면 신고가 항상 익명이 된다).
    const aliasHit = hits.find((h) => h.url === '/api/license/report');
    assert.ok(aliasHit, 'alias 가 안 불렸다');
    assert.equal(aliasHit.body.sessionToken, SECRET, '전송 body 에 토큰이 안 실렸다');
  } finally { await close(srv); }
});

test('H1-6 ★_apiBase(stage/live) 가 alias 에도 그대로 적용된다 — admin 의 고정 API_BASE 로 새지 않는다', async () => {
  // admin/index.js 의 기본 API_BASE 는 파일 맨 위에서 http://127.0.0.1:1(닫힌 포트)로 고정해 뒀다.
  // base 인자가 안 먹으면 alias 호출이 거기로 가 즉시 실패한다 — 이 테스트는 base 가 우리
  // 로컬 서버로 «실제로» 넘어가는지를 성공 여부로 증명한다.
  const { srv, hits, base } = await startServer({
    '/api/report': { status: 404, json: { ok: false, error: 'not_found' } },
    '/api/license/report': { status: 200, json: { ok: true, message: 'stage ok' } },
  });
  try {
    const q = loadFixedQueue();
    const dir = tmpUserData();
    q.init({ userDataDir: dir, apiBase: base, readAuth: () => null, log: () => {} });
    q.enqueue({ text: 'stage 큐' });
    const t0 = Date.now();
    const r = await q.flush();
    const elapsed = Date.now() - t0;
    assert.equal(r.sent, 1, 'base 가 admin 의 고정 API_BASE(닫힌 포트)로 새면 여기서 못 보낸다');
    assert.ok(elapsed < 2000, `너무 오래 걸렸다(${elapsed}ms) — 엉뚱한 주소로 갔다가 온 것일 수 있다`);
    assert.equal(hits.length, 2);
  } finally { await close(srv); }
});

test('H1-7 ★admin 의 기존 3-인자 호출부(공지 등)는 timeoutMs·base 추가로 동작이 안 바뀐다', async () => {
  const { srv, hits, base } = await startServer({
    '/api/notice': { status: 404, json: { ok: false, error: 'not_found' } },
    '/api/license/notice': { status: 200, json: { ok: true, notices: [] } },
  });
  try {
    const admin = require_(path.join(ROOT, 'main/admin/index.js'));
    // 4·5번째 인자를 «안 준다» — 기존 호출부(admin:notice-list 등)와 같은 모양.
    // base 를 안 주니 admin 고정 API_BASE(닫힌 포트 1)로 갈 것이다 — 그래서 여기선
    // 오프라인으로 «빠르게» 떨어지는지만 본다(회귀: 새 인자 때문에 예외가 나지 않는지).
    const r = await admin._callWithAlias('/api/notice', '/api/license/notice', {});
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'offline', `새 인자 추가로 기존 3-인자 호출의 기본 경로가 바뀌었다: ${JSON.stringify(r)}`);
    assert.equal(hits.length, 0, '우리 로컬 서버는 안 불렸어야 한다(기본값은 여전히 admin 자신의 API_BASE)');
  } finally { await close(srv); }
});

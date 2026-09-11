/* ★로그인 성공 직후 「사용 신호」 POST /api/license/goditor-use — 2026-09-11 지디 발주.
 *
 * 계약: body {sessionToken, kind:'use'}. 서버가 스위치를 꺼 둔 지금은
 *   {ok:true, recorded:false, reason:'not_enabled'} 로 온다 — 이건 «정상»이다(에러 아님).
 * ⛔fire-and-forget · non-blocking · 실패해도 로그인은 이미 끝난 뒤라야 한다.
 *
 * ★재는 방법: authService.goditorUse() 는 실제 HTTP 서버(로컬)를 띄워 몸통·주소를 재고,
 *   main.js 쪽 배선은 «실 구간을 떠내서» 호출 자리가 맞는지 잰다(문자열 존재 여부만 보지 않는다). */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAIN = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');

/** 로컬 목 서버 하나 — 응답을 시나리오별로 바꿔 가며 goditorUse() 에 물린다. */
function withMockServer(handler, fn) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        let json = {};
        try { json = JSON.parse(body || '{}'); } catch (_) {}
        handler(req, res, json);
      });
    });
    server.listen(0, '127.0.0.1', async () => {
      const port = server.address().port;
      try {
        const result = await fn(port);
        server.close(() => resolve(result));
      } catch (e) {
        server.close(() => reject(e));
      }
    });
  });
}

import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);

function loadAuthService(apiBase) {
  const modPath = require_.resolve('../../services/authService.js');
  delete require_.cache[modPath];
  process.env.GODITOR_LICENSE_API = apiBase;
  const svc = require_(modPath);
  svc.applyRuntime({ isPackaged: false }); // dev 모드라야 env(GODITOR_LICENSE_API) 를 읽는다
  return svc;
}

test('U1 ★올바른 주소·몸통으로 POST 한다 — {sessionToken, kind:"use"}', async () => {
  let received = null;
  await withMockServer(
    (req, res, json) => {
      received = { method: req.method, url: req.url, body: json };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, recorded: false, reason: 'not_enabled' }));
    },
    async (port) => {
      const svc = loadAuthService(`http://127.0.0.1:${port}`);
      const r = await svc.goditorUse('sess_abc123');
      assert.equal(received.method, 'POST');
      assert.equal(received.url, '/api/license/goditor-use');
      assert.deepEqual(received.body, { sessionToken: 'sess_abc123', kind: 'use' });
      // ★스위치 꺼짐 응답을 «그대로» 돌려준다 — 던지거나 null 로 뭉개지 않는다.
      assert.deepEqual(r, { ok: true, recorded: false, reason: 'not_enabled' });
    }
  );
});

test('U2 ★{ok:true, recorded:true} 로 바뀌어도(스위치 켜진 뒤) 그대로 통과시킨다', async () => {
  await withMockServer(
    (req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, recorded: true, logged: 'use#1' })); },
    async (port) => {
      const svc = loadAuthService(`http://127.0.0.1:${port}`);
      const r = await svc.goditorUse('sess_abc123');
      assert.deepEqual(r, { ok: true, recorded: true, logged: 'use#1' });
    }
  );
});

test('U3 ★네트워크 실패(연결 거부) — throw 하지 않고 null 을 준다', async () => {
  const svc = loadAuthService('http://127.0.0.1:1'); // 아무도 안 듣는 포트
  const r = await svc.goditorUse('sess_abc123');
  assert.equal(r, null, 'network 실패인데 throw 했거나 다른 값을 줬다');
});

test('U4 ★sessionToken 이 없으면 요청 자체를 안 보낸다', async () => {
  let hit = 0;
  await withMockServer(
    (req, res) => { hit++; res.writeHead(200); res.end('{}'); },
    async (port) => {
      const svc = loadAuthService(`http://127.0.0.1:${port}`);
      const r1 = await svc.goditorUse('');
      const r2 = await svc.goditorUse(undefined);
      assert.equal(r1, null);
      assert.equal(r2, null);
      assert.equal(hit, 0, `sessionToken 없이 서버를 ${hit}번 쳤다`);
    }
  );
});

/* ── main.js 배선 — «실제 구간»을 잰다 (문자열 존재 여부만 보는 검사가 아니다) ── */

test('M1 ★이메일 로그인 성공 경로 — writeAuth 바로 뒤에서 부른다', () => {
  const i = MAIN.indexOf("ipcMain.handle('auth:login'");
  assert.ok(i > 0, "auth:login 핸들러를 못 찾았다");
  // ★핸들러 «끝»은 다음 ipcMain.handle 시작이다 — 안쪽 `});` 는 여러 개라 첫 번째로 자르면
  //   writeAuth 보다 «먼저» 잘려 이 검사 자체가 무의미해진다.
  const j = MAIN.indexOf('ipcMain.handle(', i + 1);
  assert.ok(j > i, '다음 핸들러 경계를 못 찾았다');
  const seg = MAIN.slice(i, j);
  assert.match(seg, /writeAuth\(rec\);\s*\n\s*_notifyGoditorUse\(rec\.sessionToken\);/,
    '★writeAuth(rec) 직후에 _notifyGoditorUse 가 없다 — 성공 자리가 아닌 곳에서 부를 수 있다');
  // ★만료 분기(:auth:login 의 두 번째 writeAuth)에는 신호가 없어야 한다 — 로그인 성공이 아니다.
  const expiredIdx = seg.indexOf("r.reason === 'expired'");
  assert.ok(expiredIdx > 0, '만료 분기를 못 찾았다');
  const expiredSeg = seg.slice(expiredIdx, expiredIdx + 300);
  assert.ok(!expiredSeg.includes('_notifyGoditorUse'),
    '★만료(로그인 실패) 분기에서도 사용 신호가 나간다 — 실패를 성공으로 셌다');
});

test('M2 ★구글 로그인 성공 경로 — next 가 «없을 때»만 부른다', () => {
  const i = MAIN.indexOf('if (r.next) {');
  assert.ok(i > 0, 'next 분기를 못 찾았다');
  const j = MAIN.indexOf('return {', i);
  const seg = MAIN.slice(i, j);
  const nextBranch = seg.slice(0, seg.indexOf('} else {'));
  const elseBranch = seg.slice(seg.indexOf('} else {'));
  assert.ok(!nextBranch.includes('_notifyGoditorUse'),
    '★가입 미완(next) 분기에서도 사용 신호가 나간다 — 아직 로그인 성공이 아니다');
  assert.match(elseBranch, /writeAuth\(grec\);\s*\n\s*_notifyGoditorUse\(grec\.sessionToken\);/,
    '★writeAuth(grec) 직후에 _notifyGoditorUse 가 없다(else 분기 = 진짜 성공)');
});

test('M3 ★_notifyGoditorUse 자신은 던지지 않는다(동기·비동기 둘 다) — 소스 형태로 확인', () => {
  const i = MAIN.indexOf('function _notifyGoditorUse');
  assert.ok(i > 0, '_notifyGoditorUse 정의를 못 찾았다');
  const body = MAIN.slice(i, i + 200);
  assert.match(body, /try\s*\{\s*authGoditorUse\([^)]*\)\.catch\(\(\)\s*=>\s*\{\}\)\s*;\s*\}\s*catch/,
    '★동기 try/catch «와» promise.catch 가 둘 다 있어야 한다 — 하나만 있으면 다른 쪽에서 샌다');
});

test('M4 ★authService 가 goditorUse 를 내보낸다(반쪽 배선 방지)', () => {
  const svcPath = path.join(ROOT, 'services', 'authService.js');
  const src = fs.readFileSync(svcPath, 'utf8');
  assert.match(src, /module\.exports\s*=\s*\{[^}]*\bgoditorUse\b/,
    'module.exports 에 goditorUse 가 없다 — main.js 의 구조분해가 undefined 를 받는다');
});

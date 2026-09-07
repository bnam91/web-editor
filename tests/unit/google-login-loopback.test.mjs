/* U-GLOGIN — 고디터 구글 로그인, RFC 8252 루프백 계약 (인계 규격서 §4)
 *   실행: node --test "tests/unit/*.test.mjs"  ·  main.js 에서 함수를 «원문 그대로» 잘라 돌린다.
 *
 * ★규격서 §4 가 「주의할 것」으로 넷을 못박았다. 그 중 셋은 «기계로» 잴 수 있다:
 *     ⑴ 포트는 listen(0) 으로 «매번» 받는다 — 고정하면 다른 프로그램과 부딪힌다
 *     ⑵ 끝나면 서버를 «반드시» 닫는다 — 안 닫으면 로컬 포트가 열린 채 남는다
 *     ⑶ `localhost` 가 아니라 `127.0.0.1` — 서버가 localhost 를 거부한다(DNS 가 딴 데를 가리킬 수 있어서)
 *   넷째(창 포커스 복귀)는 BrowserWindow 가 있어야 해서 여기선 못 잰다 — 실기 확인 항목이다.
 *
 * ⛔이 검사는 구글에 «안» 붙는다. 붙이면 검사가 남의 서비스 상태에 묶인다.
 *   붙는 부분(우리 서버가 302 로 구글에 넘기는지)은 별도 실측으로 봤다:
 *   [260906 stage] → accounts.google.com/o/oauth2/v2/auth · state 에 루프백 주소가 실려 감.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';        // ★CRLF 체크아웃 방어(윈도우 core.autocrlf=true)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const require_ = createRequire(import.meta.url);
const SRC = readSrc(ROOT, 'main.js');

/** main.js 에서 최상위 함수 «원문»을 잘라낸다(최상위 함수는 0열 `}` 로 끝난다). */
function sliceFn(head) {
  const i = SRC.indexOf(head);
  assert.ok(i >= 0, `${head} 를 못 찾음 — 검사가 옛 소스를 보고 있다`);
  const end = SRC.indexOf('\n}\n', i);
  assert.ok(end > i, `${head} 의 끝을 못 찾음`);
  return SRC.slice(i, end + 3);
}
const sliceLoopback = () => sliceFn('function _startGoogleLoopback() {');

/* ★[2026-09-06 자수] 이 검사가 «매달렸다».
   완료 화면을 시안 F 로 바꾸면서 `_loopbackPage()` 를 «바깥 함수»로 뺐는데, 이 하네스는
   `_startGoogleLoopback` «만» 잘라 돌린다 → 요청 핸들러가 `_loopbackPage is not defined` 로
   던지고 → HTTP 응답이 안 끝나고 → hit() 이 영영 안 풀려 node --test 가 «안 끝났다».
   ⛔빨간 실패가 아니라 «무한 대기»라 로그만 보면 「아직 도는 중」과 구분이 안 된다 — 더 나쁘다.
   ⇒ 고친 방식: 의존 함수도 «원문 그대로» 같이 잘라 넣는다. 스텁을 두면 다음에 또 갈라진다.
   ⇒ 그리고 «갈라짐 자체»를 U-GLOGIN-0 이 검사한다(경고가 아니라 검사로 막는다). */
const DEPS = ['function _goditorIconDataUri() {', 'function _loopbackPage(ok, email, reason) {'];

const API_BASE = 'https://stage.blacksheepwall.kr';

/** electron 의 shell.openExternal «하나만» 스텁한다 — 나머지는 전부 진짜 코드다. */
function makeStart() {
  const opened = [];
  const shell = { openExternal: u => { opened.push(u); return Promise.resolve(); } };
  const src = [
    'let _ICON_DATA_URI = null;',
    ...DEPS.map(h => sliceFn(h)),
    sliceLoopback(),
  ].join('\n');
  const fn = new Function('shell', 'AUTH_API_BASE', 'require', 'fs', 'path', '__dirname', 'console',
    `${src}\nreturn _startGoogleLoopback;`)(shell, API_BASE, require_, fs, path, ROOT, console);
  return { start: fn, opened };
}

const redirectOf = u => decodeURIComponent(new URL(u).searchParams.get('redirect'));
const portOf = u => Number(new URL(redirectOf(u)).port);
const hit = url => new Promise((res, rej) =>
  http.get(url, r => { r.resume(); r.on('end', res); }).on('error', rej));
const portOpen = p => new Promise(r => {
  const s = net.connect({ port: p, host: '127.0.0.1' }, () => { s.destroy(); r(true); });
  s.on('error', () => r(false));
});
const settle = () => new Promise(r => setTimeout(r, 250));

test('U-GLOGIN-0 ★하네스가 «의존 함수 전부»를 싣는다 — 안 실으면 검사가 «매달린다»', () => {
  const body = sliceLoopback();
  /* 잘라 넣은 코드가 부르는 최상위 함수 이름을 «소스에서» 뽑아, DEPS 가 그걸 다 덮는지 본다.
     ⛔사람이 DEPS 를 손으로 맞추는 규약은 반드시 갈라진다 — 그래서 기계가 센다. */
  const called = new Set([...body.matchAll(/\b(_[A-Za-z][A-Za-z0-9]*)\s*\(/g)].map(m => m[1]));
  called.delete('_startGoogleLoopback');
  const covered = new Set(DEPS.map(h => h.match(/function\s+(\w+)/)[1]));
  const missing = [...called].filter(n => !covered.has(n) && new RegExp(`function\\s+${n}\\s*\\(`).test(SRC));
  assert.deepEqual(missing, [],
    `_startGoogleLoopback 이 부르는데 하네스가 «안 실은» 함수: ${missing.join(', ')} — DEPS 에 추가하라`);
});

test('U-GLOGIN-1 여는 주소가 규격서 §1 형식이다 (app=goditor · 127.0.0.1 루프백)', async () => {
  const { start, opened } = makeStart();
  const p = start();
  await settle();
  const u = new URL(opened[0]);
  assert.equal(u.origin + u.pathname, `${API_BASE}/api/license/google-start`);
  assert.equal(u.searchParams.get('app'), 'goditor');
  const rd = new URL(redirectOf(opened[0]));
  assert.equal(rd.hostname, '127.0.0.1',
    '★localhost 를 쓰면 서버가 거부한다 — DNS 가 딴 데를 가리킬 수 있어서다(규격서 §4)');
  assert.equal(rd.protocol, 'http:');
  await hit(`http://127.0.0.1:${rd.port}/cb?token=T&email=a%40b.com`);
  await p;
});

test('U-GLOGIN-2 콜백이 token·email·next 를 그대로 넘긴다', async () => {
  const { start, opened } = makeStart();
  const p = start();
  await settle();
  await hit(`http://127.0.0.1:${portOf(opened[0])}/cb?token=TKN&email=a%40b.com&next=%2Fsignup-extra.html`);
  assert.deepEqual(await p, { ok: true, token: 'TKN', email: 'a@b.com', next: '/signup-extra.html' });
});

test('U-GLOGIN-3 ★끝나면 포트를 «닫는다» — 안 닫으면 로컬 포트가 남는다', async () => {
  const { start, opened } = makeStart();
  const p = start();
  await settle();
  const port = portOf(opened[0]);
  assert.equal(await portOpen(port), true, '픽스처 무효: 애초에 안 열렸다');
  await hit(`http://127.0.0.1:${port}/cb?token=T&email=a%40b.com`);
  await p;
  await settle();
  assert.equal(await portOpen(port), false, `포트 ${port} 가 콜백 뒤에도 열려 있다`);
});

test('U-GLOGIN-4 ★포트는 «매번» 새로 받는다 (listen(0) — 고정하면 부딪힌다)', async () => {
  const a = makeStart(), b = makeStart();
  const pa = a.start(), pb = b.start();
  await settle();
  const [pA, pB] = [portOf(a.opened[0]), portOf(b.opened[0])];
  assert.notEqual(pA, pB, `두 호출이 같은 포트(${pA})를 썼다 — 포트가 고정돼 있다`);
  await hit(`http://127.0.0.1:${pA}/cb?token=T&email=a%40b.com`);
  await hit(`http://127.0.0.1:${pB}/cb?token=T&email=a%40b.com`);
  await Promise.all([pa, pb]);
});

test('U-GLOGIN-5 토큰 없는 콜백은 no_token — «성공»으로 새지 않는다', async () => {
  const { start, opened } = makeStart();
  const p = start();
  await settle();
  await hit(`http://127.0.0.1:${portOf(opened[0])}/cb`);
  assert.deepEqual(await p, { ok: false, reason: 'no_token' });
});

test('U-GLOGIN-6 ⛔세션 토큰이 렌더러로 새지 않는다 (auth:google-login 반환값)', () => {
  const i = SRC.indexOf("ipcMain.handle('auth:google-login'");
  assert.ok(i >= 0, 'auth:google-login 핸들러를 못 찾음');
  const body = SRC.slice(i, SRC.indexOf('\n});\n', i));
  const returns = [...body.matchAll(/return\s+\{[^}]*\}/g)].map(m => m[0]);
  assert.ok(returns.length > 0, 'return 문을 못 찾음 — 검사가 헛돈다');
  for (const r of returns) {
    assert.ok(!/\btoken\b|sessionToken/.test(r),
      `렌더러로 돌려주는 객체에 토큰이 들어 있다: ${r.slice(0, 90)}`);
  }
});

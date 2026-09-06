/* entitlement-authservice — services/authService.js 가 서버 값을 «뭉개지 않는가».
 *
 * ★이 파일이 잡는 것 = **H-A ①**(`verifySession` 의 `j.accessUntil || ''`).
 *   짝인 H-A ②(`writeAuth` 의 `String(… || '')`)와 H-B(`readAuth` 가드)는
 *   `entitlement-ipc.test.mjs` 가 «따로» 잡는다.
 *   ⛔셋을 한 검사로 묶으면 «어느 쪽이 깨졌는지» 못 가른다 — 그래서 파일부터 나눴다.
 *
 * ⛔라이브 서버 요청 0건. 127.0.0.1 임의 포트의 가짜 응답만 쓴다.
 * ⛔모든 대기에 상한 — 서버는 즉시 응답하고, 파일 끝에서 반드시 닫는다.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import http from 'node:http';

const require = createRequire(import.meta.url);

/** 다음 요청에 돌려줄 것. `{ __status, __json }` 로 감싸면 상태코드도 정한다. */
let NEXT = { ok: true };
const server = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    const status = NEXT.__status || 200;
    const json = NEXT.__json !== undefined ? NEXT.__json : NEXT;
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(json));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
after(() => new Promise((r) => server.close(r)));

/* ★API_BASE 는 «모듈 적재 시» 고정된다 — 그래서 require 前에 env 를 박는다. */
process.env.GODITOR_LICENSE_API = `http://127.0.0.1:${PORT}`;
const authService = require('../../services/authService.js');

/* ── H-A ① : verifySession ──────────────────────────────────────────────── */

test('U-ENT-A1 ★H-A① verifySession 이 accessUntil:null(무기한)을 «null 그대로» 준다 (⛔"" 아님)', async () => {
  NEXT = { ok: true, plan: 'pro', accessUntil: null };
  const r = await authService.verifySession('a@b.c', 'tok');
  assert.equal(r.ok, true);
  assert.equal(r.accessUntil, null,
    '★`|| ""` 가 살아 있으면 여기서 "" 가 나온다 — 그게 무기한 사용자를 매 실행 로그아웃시킨 첫 단추다');
  assert.notEqual(r.accessUntil, '');
});

test('U-ENT-A2 verifySession 이 `signed` 를 «가공 없이» 통과시킨다 (payload 바이트 동일)', async () => {
  const signed = { payload: 'eyJhIjoxfQ', sig: 'AAAA', kid: 'k1' };
  NEXT = { ok: true, plan: 'pro', accessUntil: null, signed };
  const r = await authService.verifySession('a@b.c', 'tok');
  assert.equal(r.signed.payload, signed.payload, '★payload 는 서명 대상 «그 문자열»이다 — 재직렬화하면 서명이 깨진다');
  assert.equal(r.signed.sig, signed.sig);
  assert.equal(r.signed.kid, signed.kid);
});

test('U-ENT-A3 서버가 accessUntil 을 «말하지 않으면» 키 자체를 안 만든다 (캐시를 덮지 않기 위해)', async () => {
  NEXT = { ok: true, plan: 'pro' };
  const r = await authService.verifySession('a@b.c', 'tok');
  assert.equal('accessUntil' in r, false,
    '★"" 를 만들어 넣으면 applyServerAnswer 가 그 "" 로 캐시된 유효기간을 덮어쓴다');
});

test('U-ENT-A4 ok:false(expired) 에도 signed 와 accessUntil 이 그대로 실린다 (만료도 «서명된 사실»)', async () => {
  const signed = { payload: 'p', sig: 's', kid: 'k1' };
  NEXT = { __status: 200, __json: { ok: false, reason: 'expired', plan: 'pro', accessUntil: '2020-01-01T00:00:00.000Z', signed } };
  const r = await authService.verifySession('a@b.c', 'tok');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'expired');
  assert.equal(r.accessUntil, '2020-01-01T00:00:00.000Z');
  assert.equal(r.signed.payload, 'p');
});

test('U-ENT-A5 회귀: 평범한 문자열 accessUntil 은 «그대로» 문자열이다', async () => {
  NEXT = { ok: true, plan: 'intern', accessUntil: '2027-01-01T00:00:00.000Z' };
  const r = await authService.verifySession('a@b.c', 'tok');
  assert.equal(r.accessUntil, '2027-01-01T00:00:00.000Z');
});

test('U-ENT-A6 회귀: 「말을 안 함」(5xx)은 여전히 null 이다 — 유예의 구분선을 안 옮겼다', async () => {
  NEXT = { __status: 500, __json: { ok: true, accessUntil: null } };
  const r = await authService.verifySession('a@b.c', 'tok');
  assert.equal(r, null, '★spoke 판정을 건드리면 안 된다 — 그 구분선은 verifySession 이 «이미» 그어 놨다');
});

/* ── 같은 병이 login() 에도 있었다 ──────────────────────────────────────── */

test('U-ENT-A8 ★login 과 verifySession 이 «같은 함수»를 지난다 (한쪽만 고치면 재발한다)', () => {
  /* ★지디 실측: 서버는 `login` 응답에도 `accessUntil: null` 을 넣는다
     (`api/license/login.js:112,174`). ⇒ 두 경로가 «같은 값»을 지난다.
     ⛔그런데 각자 변환하면 언젠가 한쪽만 고쳐진다 — 그래서 변환기를 «하나»로 둔 것이고,
       그 사실을 «검사»로 박는다. 경고는 갈라짐을 못 막는다. */
  const raw = readFileSync(new URL('../../services/authService.js', import.meta.url), 'utf8');
  /* ★주석을 먼저 지우고 재다 — 안 그러면 설명 주석의 `|| ''` 가 계측기를 속인다. */
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const body = (name) => {
    const m = src.match(new RegExp(`async function ${name}\\([\\s\\S]*?\\n\\}`));
    assert.ok(m, `${name} 을 못 찾았다 — 이름이 바뀌면 이 검사부터 고쳐라`);
    return m[0];
  };
  for (const fn of ['login', 'verifySession']) {
    const b = body(fn);
    assert.ok(b.includes('accessUntilField(j)'), `★${fn} 이 공용 변환기를 안 쓴다`);
    assert.equal(/accessUntil:\s*j\.accessUntil\s*\|\|/.test(b), false,
      `★${fn} 에 옆길 «직접 박기» 가 다시 생겼다`);
  }
  assert.equal((src.match(/function accessUntilField\(/g) || []).length, 1,
    '★변환기가 둘이 되면 그 순간 갈라진다');
});

test('U-ENT-A9 ★그래서 두 경로가 «같은 답»을 낸다 (동작으로 한 번 더)', async () => {
  NEXT = { ok: true, email: 'a@b.c', plan: 'pro', accessUntil: null, sessionToken: 'tok' };
  const a = await authService.login('a@b.c', 'pw');
  NEXT = { ok: true, plan: 'pro', accessUntil: null };
  const b = await authService.verifySession('a@b.c', 'tok');
  assert.equal(a.accessUntil, b.accessUntil, '★한쪽만 뭉개면 그 경로로 들어온 사람에게서 루프가 재발한다');
  assert.equal(a.accessUntil, null);
});

test('U-ENT-A7 ★login() 도 accessUntil:null 을 «null 그대로» 준다 (무기한 사용자의 «로그인» 경로)', async () => {
  NEXT = { ok: true, email: 'a@b.c', plan: 'pro', accessUntil: null, sessionToken: 'tok' };
  const r = await authService.login('a@b.c', 'pw');
  assert.equal(r.ok, true);
  assert.equal(r.accessUntil, null,
    '★지시가 짚은 두 자리 «밖»에 있던 세 번째 자리다 — 여기가 살아 있으면 무기한 사용자는 로그인 직후부터 같은 병을 앓는다');
});

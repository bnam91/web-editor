/* devtools-gate — 배포판 개발자 도구 잠금 (현빈 확정 2026-09-19)
 *
 * ★진짜 main/devtools-gate.js 를 require 해서 가짜 app·auth 를 «주입»해 돌린다(대역 아님).
 *
 * ★관리자코드 평문은 이 파일에도 없다(현빈: 소스 평문 금지).
 *   ⇒ 「맞는 코드면 열린다」는 «이 테스트가 만든 다른 코드»의 해시를 주입해 양성대조한다.
 *   ⇒ 「진짜 코드의 해시가 맞다」는 환경변수 GODITOR_TEST_ADMIN_CODE 가 있을 때만 잰다
 *      (없으면 skip 이 아니라 «그 사실을 이름에 적은» 통과 — 못 잰 것을 잰 척하지 않는다).
 *
 * ⛔이 파일이 «안» 보는 것: 진짜 Electron 의 devtools-opened 이벤트 타이밍. 그건 실기에서 잰다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const path = require('path');

const MOD = path.join(__dirname, '..', '..', 'main', 'devtools-gate.js');
const G = require(MOD);

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const TEST_CODE = 'test-' + crypto.randomBytes(4).toString('hex');   // 매번 다른 코드

function signedIn(email) {
  return {
    readAuth: () => ({ email: 'whatever@x.y', sessionToken: 't' }),
    authVerdict: () => ({ pass: true, payload: { email } }),
  };
}

function mk(extra = {}) {
  let t = 1_000_000;
  const clock = { now: () => t, tick: (ms) => { t += ms; } };
  const gate = G.createDevToolsGate({
    app: { isPackaged: true },
    env: {},
    now: clock.now,
    codeSha256: sha(TEST_CODE),
    ...extra,
  });
  return { gate, clock };
}

test('① dev(isPackaged=false) → 허용, reason=dev', () => {
  const g = G.createDevToolsGate({ app: { isPackaged: false }, env: {} });
  assert.strictEqual(g.isAllowed(), true);
  assert.strictEqual(g.reason(), 'dev');
});

test('①b dev 라도 GODITOR_FORCE_PACKAGED_GATE=1 이면 잠긴다(조이는 쪽 훅) · admin 인자로는 안 풀린다', () => {
  const g = G.createDevToolsGate({ app: { isPackaged: false }, env: { GODITOR_FORCE_PACKAGED_GATE: '1' }, isAdminAuthorized: () => true });
  assert.strictEqual(g.reason(), 'locked');
});

test('② 배포판 + 비로그인 → 잠김', () => {
  const { gate } = mk();
  assert.strictEqual(gate.isAllowed(), false);
  assert.strictEqual(gate.reason(), 'locked');
  assert.deepStrictEqual(gate.state(), { allowed: false, reason: 'locked', packaged: true });
});

test('③ 배포판 + 서명 검증된 payload.email = 관리자 → 허용 (대소문자·공백 무시)', () => {
  assert.strictEqual(G.ADMIN_EMAIL, 'coq3820@gmail.com');
  for (const e of ['coq3820@gmail.com', ' COQ3820@gmail.com ', 'Coq3820@Gmail.Com']) {
    const { gate } = mk(signedIn(e));
    assert.strictEqual(gate.reason(), 'admin-email', e);
  }
});

test('④ ★auth.json 조작 양성대조: record.email 만 관리자이고 payload 가 다르거나 없으면 잠김', () => {
  const rec = () => ({ email: 'coq3820@gmail.com', sessionToken: 't' });
  const cases = [
    { pass: true, payload: { email: 'other@x.y' } },       // 서명 주인은 딴 사람
    { pass: true },                                         // legacy_grace — payload 없음
    { pass: false, payload: { email: 'coq3820@gmail.com' } }, // 판정 실패(만료 등)
    { pass: false },                                        // sig_invalid
  ];
  for (const v of cases) {
    const { gate } = mk({ readAuth: rec, authVerdict: () => v });
    assert.strictEqual(gate.isAllowed(), false, JSON.stringify(v));
  }
  // 판정기가 던져도 «열리지» 않는다
  const { gate } = mk({ readAuth: rec, authVerdict: () => { throw new Error('boom'); } });
  assert.strictEqual(gate.isAllowed(), false);
});

test('⑤ 다른 이메일 로그인 → 잠김', () => {
  const { gate } = mk(signedIn('someone@gmail.com'));
  assert.strictEqual(gate.isAllowed(), false);
});

test('⑥ 맞는 코드(주입한 테스트 코드) → 해제, reason=unlocked, onChange 1회', () => {
  let changed = 0;
  const { gate } = mk({ onChange: () => { changed++; } });
  const r = gate.verifyCode(TEST_CODE);
  assert.deepStrictEqual(r, { ok: true });
  assert.strictEqual(gate.reason(), 'unlocked');
  assert.strictEqual(changed, 1);
  // 앞뒤 공백은 잘라서 비교
  const { gate: g2 } = mk();
  assert.strictEqual(g2.verifyCode('  ' + TEST_CODE + '\n').ok, true);
});

test('⑥b 기본 코드 레코드 = 소금 있는 scrypt(느린 KDF) — 흔한 값(빈칸·0000·123456·admin)이 아니다', () => {
  const k = G.CODE_KDF;
  assert.strictEqual(k.alg, 'scrypt');
  assert.ok(k.N >= 65536, 'N 이 작으면 오프라인 대입이 다시 싸진다');
  assert.match(k.salt, /^[0-9a-f]{32,}$/);
  assert.match(k.hash, /^[0-9a-f]{64}$/);
  for (const w of ['', '0000', '000000', '123456', 'admin', 'password']) {
    assert.strictEqual(G._kdfMatches(w, k), false, w);
  }
  // 기본 레코드로 만든 게이트는 테스트 코드를 거부한다
  const g = G.createDevToolsGate({ app: { isPackaged: true }, env: {} });
  assert.strictEqual(g.verifyCode(TEST_CODE).ok, false);
});

test('⑥b2 0919 QA: 번들 소스에 «빠른 해시(sha256 64hex)»로 된 코드 레코드가 남아 있지 않다', () => {
  const src = require('fs').readFileSync(path.join(__dirname, '..', '..', 'main', 'devtools-gate.js'), 'utf8');
  assert.ok(!/CODE_SHA256\s*=\s*'[0-9a-f]{64}'/.test(src), '소금 없는 sha256 코드 해시가 돌아왔다(0.3초 전수 대입)');
  // 음성대조: 같은 모양의 옛 선언을 넣으면 위 정규식이 잡는다
  assert.ok(/CODE_SHA256\s*=\s*'[0-9a-f]{64}'/.test("const CODE_SHA256 = '" + 'a'.repeat(64) + "';"));
});

test('⑥b3 scrypt 비교: 레코드를 스스로 만든 코드는 통과, 한 글자만 달라도 실패, 망가진 레코드는 실패닫힘', () => {
  const crypto = require('crypto');
  const salt = '00112233445566778899aabbccddeeff';
  const N = 1024, r = 8, p = 1;   // 테스트 속도용 작은 N(모양 검사는 ⑥b)
  const hash = crypto.scryptSync('424242', Buffer.from(salt, 'hex'), 32, { N, r, p }).toString('hex');
  const k = { alg: 'scrypt', N, r, p, keylen: 32, salt, hash };
  assert.strictEqual(G._kdfMatches('424242', k), true);
  assert.strictEqual(G._kdfMatches('424243', k), false);
  assert.strictEqual(G._kdfMatches('424242', { ...k, hash: 'zz' }), false);
  assert.strictEqual(G._kdfMatches('424242', { ...k, alg: 'sha256' }), false);
  const g = G.createDevToolsGate({ app: { isPackaged: true }, env: {}, codeKdf: k });
  assert.strictEqual(g.verifyCode(' 424242 ').ok, true, '앞뒤 공백은 자른다');
});

test('⑥c 실제 관리자코드 대조 — env GODITOR_TEST_ADMIN_CODE 가 있을 때만 잰다', () => {
  const code = process.env.GODITOR_TEST_ADMIN_CODE;
  if (!code) return; // ★못 잰 것 — 평문을 소스에 둘 수 없어 env 로만 받는다
  assert.strictEqual(G._kdfMatches(code.trim(), G.CODE_KDF), true);
  const g = G.createDevToolsGate({ app: { isPackaged: true }, env: {} });
  assert.strictEqual(g.verifyCode(code).ok, true);
});

test('⑦ 틀린 코드 → bad_code, 잠김 유지, onChange 없음', () => {
  let changed = 0;
  const { gate } = mk({ onChange: () => { changed++; } });
  const r = gate.verifyCode('nope');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'bad_code');
  assert.strictEqual(gate.isAllowed(), false);
  assert.strictEqual(changed, 0);
  assert.strictEqual(gate.verifyCode('').ok, false);
  assert.strictEqual(gate.verifyCode(null).ok, false);
});

test('⑧ 5회 연속 실패 → 맞는 코드도 rate_limited · 60초 뒤 다시 통과', () => {
  const { gate, clock } = mk();
  for (let i = 0; i < G.MAX_FAILS - 1; i++) assert.strictEqual(gate.verifyCode('x' + i).reason, 'bad_code');
  assert.strictEqual(gate.verifyCode('last').reason, 'rate_limited');
  assert.strictEqual(gate.verifyCode(TEST_CODE).reason, 'rate_limited');
  assert.strictEqual(gate.isAllowed(), false);
  clock.tick(G.LOCK_MS - 1);
  assert.strictEqual(gate.verifyCode(TEST_CODE).reason, 'rate_limited');
  clock.tick(1);
  assert.strictEqual(gate.verifyCode(TEST_CODE).ok, true);
  assert.strictEqual(gate.reason(), 'unlocked');
});

test('⑧b 성공하면 실패 횟수가 초기화된다 · lock() 으로 다시 잠긴다', () => {
  const { gate } = mk();
  for (let i = 0; i < 4; i++) gate.verifyCode('bad');
  assert.strictEqual(gate.verifyCode(TEST_CODE).ok, true);
  gate.lock();
  assert.strictEqual(gate.isAllowed(), false);
  for (let i = 0; i < 4; i++) assert.strictEqual(gate.verifyCode('bad').reason, 'bad_code');
});

test('⑨ 새 세션(새 게이트 인스턴스 / 모듈 재로드) → 해제가 풀려 있다(파일에 안 남는다)', () => {
  const { gate } = mk();
  gate.verifyCode(TEST_CODE);
  assert.strictEqual(gate.isAllowed(), true);
  delete require.cache[require.resolve(MOD)];
  const G2 = require(MOD);
  const g2 = G2.createDevToolsGate({ app: { isPackaged: true }, env: {}, codeSha256: sha(TEST_CODE) });
  assert.strictEqual(g2.isAllowed(), false);
});

function fakeWc() {
  const wc = new EventEmitter();
  wc.opened = false;
  wc.closeCalls = 0;
  wc.isDestroyed = () => false;
  wc.isDevToolsOpened = () => wc.opened;
  wc.openDevTools = () => { wc.opened = true; wc.emit('devtools-opened'); };
  wc.closeDevTools = () => { wc.closeCalls++; wc.opened = false; };
  return wc;
}

test('⑩ ★가드: web-contents-created 로 흘린 webContents 는 잠김이면 열리자마자 닫힌다, 허용이면 안 닫힌다', () => {
  const app = new EventEmitter();
  app.isPackaged = true;
  const { gate } = mk({ app });
  gate.install(app);
  const wc = fakeWc();
  app.emit('web-contents-created', {}, wc);
  wc.openDevTools();                       // 메뉴 role·가속키·우클릭 — 경로 무관
  assert.strictEqual(wc.closeCalls, 1);
  assert.strictEqual(wc.opened, false);

  gate.verifyCode(TEST_CODE);
  const wc2 = fakeWc();
  app.emit('web-contents-created', {}, wc2);
  wc2.openDevTools();
  assert.strictEqual(wc2.closeCalls, 0);
  assert.strictEqual(wc2.opened, true);
});

test('⑩b dev 에선 가드가 아무것도 안 닫는다(기존 동작 보존)', () => {
  const app = new EventEmitter();
  app.isPackaged = false;
  const g = G.createDevToolsGate({ app, env: {} });
  g.install(app);
  const wc = fakeWc();
  app.emit('web-contents-created', {}, wc);
  wc.openDevTools();
  assert.strictEqual(wc.closeCalls, 0);
});

test('⑪ toggleFor: 잠김이면 안 열고 false, 허용이면 열고/닫는다', () => {
  const { gate } = mk();
  const wc = fakeWc();
  assert.strictEqual(gate.toggleFor(wc), false);
  assert.strictEqual(wc.opened, false);
  gate.verifyCode(TEST_CODE);
  assert.strictEqual(gate.toggleFor(wc), true);
  assert.strictEqual(wc.opened, true);
  gate.toggleFor(wc);
  assert.strictEqual(wc.opened, false);
});

test('⑫ enforce/lock: 로그아웃·잠금 뒤엔 열려 있던 개발자 도구를 전부 닫는다', () => {
  let email = 'coq3820@gmail.com';
  const wcs = [fakeWc(), fakeWc()];
  const { gate } = mk({
    readAuth: () => (email ? { email } : null),
    authVerdict: () => ({ pass: true, payload: { email } }),
    getAllWebContents: () => wcs,
  });
  wcs.forEach((w) => gate.toggleFor(w));
  assert.ok(wcs.every((w) => w.opened));
  assert.strictEqual(gate.enforce(), 0);   // 아직 허용 — 아무것도 안 닫는다
  email = null;                             // 로그아웃
  assert.strictEqual(gate.enforce(), 2);
  assert.ok(wcs.every((w) => !w.opened));
});

test('⑬ IPC: state 는 이메일을 안 내보내고, open 은 잠김이면 거부, unlock 은 결과를 돌려준다', async () => {
  const handlers = {};
  const ipc = { handle: (ch, fn) => { handlers[ch] = fn; } };
  const { gate } = mk(signedIn('other@x.y'));
  gate.registerIpc(ipc);
  assert.deepStrictEqual(Object.keys(handlers).sort(), ['devtools:lock', 'devtools:open', 'devtools:state', 'devtools:unlock']);
  const st = await handlers['devtools:state']();
  assert.ok(!JSON.stringify(st).includes('@'), '이메일 원문이 새면 안 된다');
  const sender = { opened: 0, openDevTools() { this.opened++; } };
  assert.deepStrictEqual(await handlers['devtools:open']({ sender }), { ok: false, reason: 'locked' });
  assert.strictEqual(sender.opened, 0);
  assert.strictEqual((await handlers['devtools:unlock']({}, 'bad')).reason, 'bad_code');
  const ok = await handlers['devtools:unlock']({}, TEST_CODE);
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.state.reason, 'unlocked');
  assert.deepStrictEqual(await handlers['devtools:open']({ sender }), { ok: true });
  assert.strictEqual(sender.opened, 1);
  const locked = await handlers['devtools:lock']();
  assert.strictEqual(locked.allowed, false);
});

test('⑬b lock 은 «코드 해제»만 되돌린다 — 관리자 계정은 그대로 허용(화면이 버튼을 숨기는 근거) · 코드 해제 때 열린 도구는 닫힌다', async () => {
  const handlers = {};
  const ipc = { handle: (ch, fn) => { handlers[ch] = fn; } };
  const a = mk(signedIn('coq3820@gmail.com'));
  a.gate.registerIpc(ipc);
  const st = await handlers['devtools:lock']();
  assert.deepStrictEqual({ allowed: st.allowed, reason: st.reason }, { allowed: true, reason: 'admin-email' });

  const wcs = [fakeWc()];
  const b = mk({ getAllWebContents: () => wcs });
  assert.strictEqual(b.gate.verifyCode(TEST_CODE).ok, true);
  b.gate.toggleFor(wcs[0]);
  assert.strictEqual(wcs[0].opened, true);
  b.gate.lock();
  assert.strictEqual(b.gate.reason(), 'locked');
  assert.strictEqual(wcs[0].opened, false, 'lock 뒤 열린 개발자 도구가 닫혀야 한다');
});

test('⑭ 0919 QA: 운영자 admin(인자+토큰+admin.allow = 사용자 손에 있음)은 개발자 도구 예외가 «아니다» — 잠긴다', () => {
  const { gate } = mk({ isAdminAuthorized: () => true });
  assert.strictEqual(gate.reason(), 'locked', 'admin.allow 자가 발급으로 개발자 도구가 열리면 안 된다');
  assert.strictEqual(gate.isAllowed(), false);
  assert.strictEqual(gate.state().reason, 'locked');
});

test('⑮ 메뉴 항목: allowed=false 면 숨김·비활성, true 면 보임 · role 을 안 쓴다', () => {
  let n = 0;
  const off = G.devToolsMenuItem({ isMac: true, allowed: false, toggle: () => n++ });
  assert.strictEqual(off.visible, false);
  assert.strictEqual(off.enabled, false);
  assert.strictEqual(off.role, undefined);
  const on = G.devToolsMenuItem({ isMac: false, allowed: true, toggle: () => n++ });
  assert.strictEqual(on.visible, true);
  assert.strictEqual(on.accelerator, 'Ctrl+Shift+I');
  on.click();
  assert.strictEqual(n, 1);
});

/* ── 이벨류에이터 픽스 라운드(2026-09-19): «띄울 때 여는» 디버깅 길 ── */
test('⑯ debugLaunchViolations: CDP·inspect 인자는 걸리고, 평범한 실행 인자는 안 걸린다', () => {
  const d = G.debugLaunchViolations;
  assert.deepStrictEqual(d({ argv: ['/A/GODITOR'] }), []);
  assert.deepStrictEqual(d({ argv: ['/A/GODITOR', '--enable-logging', 'admin', '--user-data-dir=/tmp/x', '--remote-allow-origins=*', '/p/a.gdt'] }), []);
  assert.deepStrictEqual(d({ argv: ['x', '--remote-debugging-port=9222'] }), ['remote-debugging-port']);
  assert.deepStrictEqual(d({ argv: ['x', '--remote-debugging-pipe'] }), ['remote-debugging-pipe']);
  // argv 에 안 보여도 Chromium 스위치로 들어왔으면 걸린다
  assert.deepStrictEqual(d({ argv: ['x'], hasSwitch: (s) => s === 'remote-debugging-port' }), ['remote-debugging-port']);
  assert.deepStrictEqual(d({ argv: ['x', '--inspect'] }), ['inspect']);
  assert.deepStrictEqual(d({ argv: ['x', '--inspect-brk=9229'] }), ['inspect-brk']);
  assert.deepStrictEqual(d({ execArgv: ['--inspect-wait'] }), ['inspect-wait']);
  // 포트·표시 설정만 하는 인자는 디버거를 켜지 않는다(node --test 자식이 달고 온다 — 오탐 방지)
  assert.deepStrictEqual(d({ execArgv: ['--inspect-port=0', '--inspect-publish-uid=http'] }), []);
  // 인자와 무관하게 디버거가 «이미 켜져» 있으면 걸린다
  assert.deepStrictEqual(d({ inspectorUrl: () => 'ws://127.0.0.1:9229/abc' }), ['inspector-active']);
  assert.deepStrictEqual(d({ inspectorUrl: () => undefined }), []);
  assert.deepStrictEqual(d({ argv: ['x', '--debug-brk'] }), ['debug-brk']);
  assert.deepStrictEqual(d({ env: { NODE_OPTIONS: '--max-old-space-size=4096 --inspect=0' } }), ['NODE_OPTIONS']);
  assert.deepStrictEqual(d({ env: { NODE_OPTIONS: '--max-old-space-size=4096' } }), []);
  // 비슷한 이름에 속지 않는다
  assert.deepStrictEqual(d({ argv: ['x', '--inspector-foo', '--debugger', '--remote-debugging-portal'] }), []);
  // hasSwitch 가 던져도 앱이 죽지 않는다(판정만 안 한다)
  assert.deepStrictEqual(d({ argv: ['x'], hasSwitch: () => { throw new Error('boom'); } }), []);
});

test('⑰ 주기 재판정: 시간이 지나 관리자 판정이 풀리면(서명·플랜 만료) 열려 있던 개발자 도구가 닫힌다', async () => {
  const app = new EventEmitter();
  app.isPackaged = true;
  let admin = true;
  const wc = fakeWc();
  const g = G.createDevToolsGate({
    app, env: {},
    readAuth: () => ({ email: 'x' }),
    authVerdict: () => (admin ? { pass: true, payload: { email: G.ADMIN_EMAIL } } : { pass: false }),
    getAllWebContents: () => [wc],
    enforceIntervalMs: 15,
  });
  g.install(app);
  app.emit('web-contents-created', {}, wc);
  wc.openDevTools();
  assert.strictEqual(wc.opened, true, '관리자 판정 동안은 열려 있다');
  await new Promise(r => setTimeout(r, 60));
  assert.strictEqual(wc.opened, true, '판정이 그대로면 주기 재판정이 닫지 않는다');
  admin = false;                         // auth 쓰기 없이 판정만 바뀐다(만료)
  await new Promise(r => setTimeout(r, 80));
  assert.strictEqual(wc.opened, false, '주기 재판정이 닫았다');
});

test('⑰b enforceIntervalMs=0 이면 주기 재판정을 안 건다', async () => {
  const app = new EventEmitter();
  app.isPackaged = true;
  let admin = true;
  const wc = fakeWc();
  const g = G.createDevToolsGate({
    app, env: {},
    readAuth: () => ({ email: 'x' }),
    authVerdict: () => (admin ? { pass: true, payload: { email: G.ADMIN_EMAIL } } : { pass: false }),
    getAllWebContents: () => [wc],
    enforceIntervalMs: 0,
  });
  g.install(app);
  app.emit('web-contents-created', {}, wc);
  wc.openDevTools();
  admin = false;
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(wc.opened, true);
});

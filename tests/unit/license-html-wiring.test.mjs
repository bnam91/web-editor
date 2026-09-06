/* 단위 — pages/license.html 의 «실제 인라인 스크립트 배선» (E3).
 *
 * ★license-screen.test.mjs 는 js/license-screen.js 의 «판정 함수»만 잰다.
 *   이 파일은 «license.html 이 그 판정을 받아서 실제로 DOM에 무엇을 그리는가»를 잰다 —
 *   「코드가 이러니 될 것이다」가 아니라 «실행해서 화면(DOM)에 남은 것»으로 판정한다.
 * ★방법 = report-buffer.js 검사와 같은 방식(U-GLOGIN-0 규약): 파일을 «복사·재구성»하지
 *   않고, `pages/license.html` 안의 진짜 <script> 바이트를 그대로 꺼내 vm 으로 돌린다.
 *   가짜 DOM은 이 스크립트가 실제로 쓰는 API(getElementById·classList·style.display·
 *   textContent 등) 만 최소로 흉내낸다.
 * ⛔라이브 네트워크 0 — `electronAPI` 를 전부 모킹한다. 진짜 IPC·서버는 절대 안 부른다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.join(__dirname, '../../pages/license.html');
const LS_PATH = path.join(__dirname, '../../js/license-screen.js');

function extractInlineScript(html) {
  // 속성 없는 <script> ... </script> «하나»만 잡는다 — <script src="..."></script> 는
  // 속성이 있어 이 정규식에 안 걸린다(license.html 에 그 형태로 딱 하나 있는 걸 실측했다).
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('license.html 에서 인라인 <script> 를 못 찾았다 — 마크업이 바뀌었다');
  return m[1];
}

/** DOM 이 아니라 이 스크립트가 «실제로 쓰는» 최소 API만 흉내낸다. */
function makeFakeEl(id) {
  return {
    id,
    _text: '',
    _html: '',
    value: '',
    style: {},
    className: '',
    _classes: new Set(),
    classList: {
      add() {},
      remove() {},
      toggle(cls, on) { on ? this._classes.add(cls) : this._classes.delete(cls); },
      contains(cls) { return this._classes.has(cls); },
    },
    _listeners: {},
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
    focus() {},
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); },
  };
}
// classList.toggle 이 el 을 참조해야 해서 팩토리 위에서 바인드
function bindClassList(el) {
  el.classList.toggle = function (cls, on) { on ? el._classes.add(cls) : el._classes.delete(cls); };
  el.classList.contains = function (cls) { return el._classes.has(cls); };
  return el;
}

const KNOWN_IDS = [
  'pendingGdtMsg', 'googleBtn', 'email', 'password', 'loginBtn', 'statusMsg',
  'findEmailLink', 'findPwLink', 'signupLink',
  'loginScreen', 'expiredScreen', 'verifyScreen', 'logoSub',
  'expTitle', 'expDesc', 'expEmail', 'expUntil', 'purchaseBtn', 'backToLoginBtn', 'expiredStatus',
  'verifyTitle', 'verifyDesc', 'verifyAccountBox', 'verifyEmail', 'verifyUntilRow', 'verifyUntil',
  'verifyStatus', 'verifyRetryBtn', 'verifyBackBtn',
];

function bootPage(electronAPIMock) {
  const els = {};
  KNOWN_IDS.forEach((id) => { els[id] = bindClassList(makeFakeEl(id)); });

  const calls = { navigateToProjects: 0, refreshAuth: 0 };
  const api = Object.assign({ isElectron: false }, electronAPIMock);
  const origRefresh = api.refreshAuth;
  if (typeof origRefresh === 'function') {
    api.refreshAuth = (...args) => { calls.refreshAuth++; return origRefresh(...args); };
  }
  const origNav = api.navigateToProjects || (() => {});
  api.navigateToProjects = (...args) => { calls.navigateToProjects++; return origNav(...args); };

  const fakeDocument = {
    getElementById(id) {
      if (!els[id]) els[id] = bindClassList(makeFakeEl(id));   // 방어적 — 못 본 id 도 죽지 않게
      return els[id];
    },
    addEventListener() {},
    body: bindClassList(makeFakeEl('body')),
  };

  const ctx = {};
  ctx.window = ctx;
  ctx.document = fakeDocument;
  ctx.navigator = { userAgent: 'node-test' };
  ctx.console = { warn() {}, log() {}, error() {} };
  // ★타이머를 «즉시 실행」으로 — 600ms 뒤 navigateToProjects 를 기다리지 않는다.
  ctx.setTimeout = (fn) => { fn(); return 0; };
  ctx.clearTimeout = () => {};
  ctx.Date = Date;
  vm.createContext(ctx);

  vm.runInContext(fs.readFileSync(LS_PATH, 'utf8'), ctx);
  ctx.electronAPI = api;
  const inline = extractInlineScript(fs.readFileSync(HTML_PATH, 'utf8'));
  vm.runInContext(inline, ctx);

  return { els, calls, ctx };
}

/** init() 은 스크립트 바닥에서 «바로» 불린다(await 없이) — 미룬 프로미스가 다 풀릴 때까지
 *  마이크로태스크를 몇 바퀴 돌려준다. 타이머는 위에서 즉시실행으로 바꿔놨다. */
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/* ── 1. 기록 없음 → 로그인 화면, 네트워크 0 ─────────────────────────────── */
test('W1 st=null → loginScreen 만 visible, refreshAuth 호출 0', async () => {
  const { els, calls } = bootPage({ getAuthState: async () => null });
  await flush();
  assert.ok(els.loginScreen.classList.contains('visible'));
  assert.ok(!els.expiredScreen.classList.contains('visible'));
  assert.ok(!els.verifyScreen.classList.contains('visible'));
  assert.equal(calls.refreshAuth, 0, '로그인 화면은 서버를 안 부른다');
});

/* ── 2. 진짜 만료 — 로컬만으로 이미 결론났다(추가 네트워크 0) ──────────── */
test('W2 pending 없이 expired:true → expiredScreen, EXPIRED_COPY 문구, refreshAuth 호출 0', async () => {
  const st = { signedIn: false, expired: true, pending: null, email: 'a@b.com', accessUntil: '2026-01-01T00:00:00.000Z' };
  const { els, calls, ctx } = bootPage({ getAuthState: async () => st });
  await flush();
  assert.ok(els.expiredScreen.classList.contains('visible'));
  assert.ok(!els.verifyScreen.classList.contains('visible'));
  assert.equal(els.expTitle.textContent, ctx.LicenseScreen.EXPIRED_COPY.title);
  assert.equal(els.expDesc.textContent, ctx.LicenseScreen.EXPIRED_COPY.desc);
  assert.equal(els.expEmail.textContent, 'a@b.com');
  assert.match(els.expUntil.textContent, /까지$/);
  assert.equal(calls.refreshAuth, 0, '★로컬 판정이 이미 결론났으므로 추가로 서버를 안 부른다');
});

/* ── 3. 확인 필요 → 자동으로 refreshAuth 를 «한 번» 부른다 ─────────────── */
test('W3 pending:"verify" → verifyScreen 자동 표시 + refreshAuth 자동 호출(사용자 조작 0)', async () => {
  const st = { signedIn: false, expired: true, pending: 'verify', email: 'a@b.com', accessUntil: '2027-06-01T00:00:00.000Z', perpetual: false };
  const { els, calls } = bootPage({
    getAuthState: async () => st,
    refreshAuth: async () => ({ ok: false, reason: 'offline', offline: true }),
  });
  await flush();
  assert.ok(els.verifyScreen.classList.contains('visible'));
  assert.equal(calls.refreshAuth, 1, '★사용자가 아무것도 안 눌러도 한 번은 자동으로 확인한다(㉯)');
});

/* ── 4. offline 결과 → 「연결 필요」 문구 + 남은 기간 숫자 표시, «만료» 낱말 0 ── */
test('W4 offline → VERIFY_COPY.offline 문구, 남은 기간(날짜) 표시, expiredScreen 은 안 뜬다', async () => {
  const st = { signedIn: false, expired: true, pending: 'verify', email: 'a@b.com', accessUntil: '2027-06-01T00:00:00.000Z', perpetual: false };
  const { els, ctx } = bootPage({
    getAuthState: async () => st,
    refreshAuth: async () => ({ ok: false, reason: 'offline', offline: true }),
  });
  await flush();
  assert.ok(els.verifyScreen.classList.contains('visible'));
  assert.ok(!els.expiredScreen.classList.contains('visible'), '★오프라인을 만료 화면으로 보내면 안 된다');
  assert.equal(els.verifyTitle.textContent, ctx.LicenseScreen.VERIFY_COPY.offline.title);
  assert.equal(els.verifyDesc.textContent, ctx.LicenseScreen.VERIFY_COPY.offline.desc);
  for (const w of ctx.LicenseScreen.EXPIRY_WORDS) {
    assert.ok(!els.verifyTitle.textContent.includes(w));
    assert.ok(!els.verifyDesc.textContent.includes(w));
  }
  // ★남은 기간을 «숫자(날짜)」로 — account box 가 보이고 accessUntil 날짜가 들어 있다.
  assert.equal(els.verifyAccountBox.style.display, '');
  assert.match(els.verifyUntil.textContent, /202[0-9]년|까지 남아 있음/);
  assert.equal(els.verifyEmail.textContent, 'a@b.com');
  // 재시도 버튼은 있다 — 비밀번호 입력은 «없다»(㉰, 별도 정적 검사에서 한 번 더 확인)
  assert.equal(els.verifyRetryBtn.style.display, '');
});

test('W4b 무기한(perpetual) 이용자는 「무기한」으로 뜨지 만료로 안 읽힌다', async () => {
  const st = { signedIn: false, expired: true, pending: 'verify', email: 'p@b.com', accessUntil: '', perpetual: true };
  const { els } = bootPage({
    getAuthState: async () => st,
    refreshAuth: async () => ({ ok: false, reason: 'offline', offline: true }),
  });
  await flush();
  assert.match(els.verifyUntil.textContent, /무기한/);
});

/* ── 5. 온라인 확인이 «진짜 만료」를 알려주면 그때는 expiredScreen ─────── */
test('W5 refreshAuth 가 access_ended 로 답하면 expiredScreen 으로(서명된 사실이라 그쪽이 이긴다)', async () => {
  const st = { signedIn: false, expired: true, pending: 'verify', email: 'a@b.com', accessUntil: '2027-06-01T00:00:00.000Z' };
  const { els, ctx } = bootPage({
    getAuthState: async () => st,
    refreshAuth: async () => ({ ok: false, reason: 'access_ended', status: 'access_ended', accessUntil: '2026-08-01T00:00:00.000Z' }),
  });
  await flush();
  assert.ok(els.expiredScreen.classList.contains('visible'));
  assert.ok(!els.verifyScreen.classList.contains('visible'));
  assert.equal(els.expTitle.textContent, ctx.LicenseScreen.EXPIRED_COPY.title);
  assert.match(els.expUntil.textContent, /2026/, '서버가 «새로» 알려준 만료일을 쓴다(캐시된 날짜가 아니라)');
});

/* ── 6. 세션이 죽었다(다른 기기 로그인) → 로그인 화면 + 안내, 비번칸은 «비어» 재입력 요구 ── */
test('W6 invalid_session/email_not_verified → 로그인 화면 + 안내 문구, verifyScreen 은 감춰진다', async () => {
  const st = { signedIn: false, expired: true, pending: 'verify', email: 'a@b.com' };
  const { els } = bootPage({
    getAuthState: async () => st,
    refreshAuth: async () => ({ ok: false, reason: 'invalid_session' }),
  });
  await flush();
  assert.ok(els.loginScreen.classList.contains('visible'));
  assert.ok(!els.verifyScreen.classList.contains('visible'));
  assert.ok(!els.expiredScreen.classList.contains('visible'));
  assert.match(els.statusMsg.textContent, /다시 로그인/);
  assert.equal(els.email.value, 'a@b.com', '이메일은 다시 안 치게 남겨준다 — 비번만 다시 받는다(그건 서버가 요구한 것)');
});

/* ── 7. clock_rollback / 그 밖(generic) — 둘 다 verifyScreen, 문구가 offline 과 다르다 ── */
test('W7 clock_rollback → 시계 문구, offline/expired 문구와 다르다', async () => {
  const st = { signedIn: false, expired: true, pending: 'verify', email: 'a@b.com', accessUntil: '2027-01-01T00:00:00.000Z' };
  const { els, ctx } = bootPage({
    getAuthState: async () => st,
    refreshAuth: async () => ({ ok: false, reason: 'clock_rollback' }),
  });
  await flush();
  assert.ok(els.verifyScreen.classList.contains('visible'));
  assert.equal(els.verifyTitle.textContent, ctx.LicenseScreen.VERIFY_COPY.clock_rollback.title);
  assert.notEqual(els.verifyTitle.textContent, ctx.LicenseScreen.VERIFY_COPY.offline.title);
  assert.notEqual(els.verifyTitle.textContent, ctx.LicenseScreen.EXPIRED_COPY.title);
});

test('W8 signature_invalid 등 그 밖의 사유 → generic, «만료»로 안 새지 않는다', async () => {
  const st = { signedIn: false, expired: true, pending: 'verify', email: 'a@b.com' };
  const { els, ctx } = bootPage({
    getAuthState: async () => st,
    refreshAuth: async () => ({ ok: false, reason: 'signature_invalid', status: 'signature_invalid' }),
  });
  await flush();
  assert.ok(els.verifyScreen.classList.contains('visible'));
  assert.ok(!els.expiredScreen.classList.contains('visible'));
  assert.equal(els.verifyTitle.textContent, ctx.LicenseScreen.VERIFY_COPY.generic.title);
});

/* ── 8. ok:true → 성공 문구 뒤 navigateToProjects «호출됨» ─────────────── */
test('W9 refreshAuth ok:true → navigateToProjects 가 호출된다', async () => {
  const st = { signedIn: false, expired: true, pending: 'verify', email: 'a@b.com' };
  const { calls } = bootPage({
    getAuthState: async () => st,
    refreshAuth: async () => ({ ok: true, plan: 'pro12', status: 'signature_ok', accessUntil: '2027-06-01T00:00:00.000Z' }),
  });
  await flush();
  assert.equal(calls.navigateToProjects, 1);
});

/* ── 9. ★[다시 시도] 디바운스 — 연타해도 refreshAuth 는 2초 안에 한 번만 더 ── */
test('W10 ★재시도 버튼 연타 → 2초 디바운스로 두 번째 클릭은 무시된다', async () => {
  const st = { signedIn: false, expired: true, pending: 'verify', email: 'a@b.com', accessUntil: '2027-01-01T00:00:00.000Z' };
  const { els, calls } = bootPage({
    getAuthState: async () => st,
    refreshAuth: async () => ({ ok: false, reason: 'offline', offline: true }),
  });
  await flush();
  assert.equal(calls.refreshAuth, 1, '자동 확인 1회');

  const retryClick = els.verifyRetryBtn._listeners.click[0];
  retryClick();
  await flush();
  retryClick();   // ★연타 — 디바운스 창(2s) 안이라 무시돼야 한다
  await flush();
  assert.equal(calls.refreshAuth, 2, `자동(1) + 연타 중 «한 번만» 통과해야 하는데 ${calls.refreshAuth}번 불렸다`);
});

/* ── 10. ★㉰ — verifyScreen 마크업에 비밀번호 입력칸이 없다(정적 검사) ──── */
test('W11 ★verifyScreen 안에 type="password" 입력칸이 없다 — 푸는 조건이 재로그인이 아니다', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const m = html.match(/<div id="verifyScreen"[\s\S]*?\n {2}<\/div>/);
  assert.ok(m, 'verifyScreen 블록을 못 찾았다 — 마크업이 바뀌었다');
  assert.ok(!/type="password"/.test(m[0]), 'verifyScreen 안에 비밀번호 입력칸이 있다 — ㉰ 위반');
});

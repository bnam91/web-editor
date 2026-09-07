/* 단위 — js/license-screen.js (E3: license.html 상태 화면 판정).
 *
 * ★이 파일이 지키는 것 하나 — 지디 발주서 §E3 ㉮:
 *   「만료」(access_ended)와 「연결 필요」(offline·clock_rollback·generic)는
 *   «절대 같은 문구를 쓰지 않는다». 구독이 살아 있는데 「만료됐다」고 말하면
 *   그건 환불 요구가 된다 — 이 검사가 그 사고를 «기계로» 잠근다.
 * ⛔함수 «단독»을 재지 않는다(U-GLOGIN-0 규약) — 실제 파일을 vm 으로 그대로 실행해서 잰다
 *   (tests/unit/report-buffer-resource.test.mjs 와 같은 방식).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function boot() {
  const w = {};
  const code = fs.readFileSync(path.join(__dirname, '../../js/license-screen.js'), 'utf8');
  vm.runInNewContext(code, { window: w });
  return w.LicenseScreen;
}

/* ── ㉮ 만료 vs 연결필요 — 문구가 겹치지 않는다 ─────────────────────────── */
test('E3-COPY-1 ★「연결 필요」 사전 어디에도 «만료 낱말»이 없다 (offline·clock_rollback·generic)', () => {
  const LS = boot();
  const risky = ['offline', 'clock_rollback', 'generic'];
  for (const key of risky) {
    const entry = LS.VERIFY_COPY[key];
    for (const word of LS.EXPIRY_WORDS) {
      assert.ok(!entry.title.includes(word), `VERIFY_COPY.${key}.title 에 «${word}» — 만료 화면과 안 갈린다: ${entry.title}`);
      assert.ok(!entry.desc.includes(word), `VERIFY_COPY.${key}.desc 에 «${word}» — 만료 화면과 안 갈린다: ${entry.desc}`);
    }
  }
});

test('E3-COPY-2 ★만료 화면은 «만료 낱말»을 실제로 쓴다(양성대조 — 검사기 자체가 죽어있지 않은지)', () => {
  const LS = boot();
  const hit = LS.EXPIRY_WORDS.some((w) => LS.EXPIRED_COPY.title.includes(w) || LS.EXPIRED_COPY.desc.includes(w));
  assert.ok(hit, 'EXPIRED_COPY 가 만료 낱말을 하나도 안 쓴다 — 검사기가 아무것도 못 잡는 상태다');
});

test('E3-COPY-3 만료 화면과 연결필요(offline) 화면의 제목·본문이 문자열로 다르다', () => {
  const LS = boot();
  assert.notEqual(LS.EXPIRED_COPY.title, LS.VERIFY_COPY.offline.title);
  assert.notEqual(LS.EXPIRED_COPY.desc, LS.VERIFY_COPY.offline.desc);
});

/* ── decideInitialScreen — pending 이 expired 보다 먼저 이긴다 ──────────── */
test('E3-INIT-1 pending:"verify" 면 expired:true 가 같이 와도 verify 화면 (실제 auth:state 모양)', () => {
  const LS = boot();
  // main.js:617-622 실측 모양 — pass=false 면 expired 는 «항상» true, pending 은 screen==='verify'일 때만.
  const st = { signedIn: false, expired: true, pending: 'verify', status: 'signature_missing', reason: 'sigless_needs_verify' };
  assert.equal(LS.decideInitialScreen(st), 'verify');
});

test('E3-INIT-2 pending 없이 expired:true 면 expired 화면 (진짜 만료)', () => {
  const LS = boot();
  const st = { signedIn: false, expired: true, pending: null, status: 'access_ended', reason: 'access_ended' };
  assert.equal(LS.decideInitialScreen(st), 'expired');
});

test('E3-INIT-3 기록 자체가 없으면(st=null 이거나 email 없음 유래) login', () => {
  const LS = boot();
  assert.equal(LS.decideInitialScreen(null), 'login');
  assert.equal(LS.decideInitialScreen({ signedIn: false, expired: false, pending: null }), 'login');
});

test('E3-INIT-4 [변이] pending 검사를 지우면(=expired 를 먼저 본다) INIT-1 이 빨개진다', () => {
  // ★검사가 실제로 그 순서를 재는지 스스로 증명 — decideInitialScreen 을 «흉내» 안 내고
  //   같은 입력에 대해 «틀린 순서»로 판정했을 때 다른 답이 나온다는 것만 보인다(회귀 방향 확인).
  const st = { signedIn: false, expired: true, pending: 'verify' };
  const wrongOrder = (s) => { if (!s) return 'login'; if (s.expired) return 'expired'; if (s.pending === 'verify') return 'verify'; return 'login'; };
  assert.equal(wrongOrder(st), 'expired', '이 변이 함수 자체가 순서를 안 바꿨다면 테스트가 무의미하다');
  const LS = boot();
  assert.notEqual(LS.decideInitialScreen(st), wrongOrder(st), '올바른 구현은 «틀린 순서»와 다른 답을 내야 한다');
});

/* ── decideVerifyOutcome — main.js auth:refresh 의 실제 반환 모양으로 ───── */
test('E3-OUT-1 ok:true → ok', () => {
  const LS = boot();
  assert.equal(LS.decideVerifyOutcome({ ok: true, plan: 'pro12', status: 'signature_ok', accessUntil: '2027-06-01T00:00:00.000Z' }), 'ok');
});

test('E3-OUT-2 서버 응답 없음(reason:"offline") → offline', () => {
  const LS = boot();
  assert.equal(LS.decideVerifyOutcome({ ok: false, reason: 'offline', offline: true }), 'offline');
});

test('E3-OUT-3 IPC 자체가 실패해 result 가 null/undefined 여도 offline (throw 삼킨 자리)', () => {
  const LS = boot();
  assert.equal(LS.decideVerifyOutcome(null), 'offline');
  assert.equal(LS.decideVerifyOutcome(undefined), 'offline');
});

test('E3-OUT-4 invalid_session/email_not_verified → session_cleared(재로그인 화면으로)', () => {
  const LS = boot();
  assert.equal(LS.decideVerifyOutcome({ ok: false, reason: 'invalid_session' }), 'session_cleared');
  assert.equal(LS.decideVerifyOutcome({ ok: false, reason: 'email_not_verified' }), 'session_cleared');
});

test('E3-OUT-5 ★access_ended/access_unparsable → expired (진짜 만료 — 서버가 서명한 사실)', () => {
  const LS = boot();
  assert.equal(LS.decideVerifyOutcome({ ok: false, reason: 'access_ended', status: 'access_ended', accessUntil: '2026-01-01T00:00:00.000Z' }), 'expired');
  assert.equal(LS.decideVerifyOutcome({ ok: false, reason: 'access_unparsable', status: 'access_ended' }), 'expired');
  // reason 이 비어도 status 만으로도 잡는다(방어선 이중화)
  assert.equal(LS.decideVerifyOutcome({ ok: false, reason: 'unknown', status: 'access_ended' }), 'expired');
});

test('E3-OUT-6 clock_rollback → clock_rollback', () => {
  const LS = boot();
  assert.equal(LS.decideVerifyOutcome({ ok: false, reason: 'clock_rollback', status: 'locked' }), 'clock_rollback');
});

test('E3-OUT-7 그 밖(signature_invalid·sub_mismatch·grace_exceeded·sigless_needs_verify 등) → generic, «만료»로 안 간다', () => {
  const LS = boot();
  const reasons = ['signature_invalid', 'sub_mismatch', 'grace_exceeded', 'sigless_needs_verify', 'sid_mismatch_needs_verify', 'unknown'];
  for (const reason of reasons) {
    assert.equal(LS.decideVerifyOutcome({ ok: false, reason, status: 'locked' }), 'generic', `reason=${reason}`);
  }
});

/* ── remainingKind — 무기한을 «끝났다»로 안 읽는다 ──────────────────────── */
test('E3-REM-1 perpetual:true → perpetual (accessUntil 빈 문자열이어도)', () => {
  const LS = boot();
  assert.equal(LS.remainingKind({ email: 'a@b.com', perpetual: true, accessUntil: '' }), 'perpetual');
});

test('E3-REM-2 accessUntil 있으면 until', () => {
  const LS = boot();
  assert.equal(LS.remainingKind({ email: 'a@b.com', perpetual: false, accessUntil: '2027-06-01T00:00:00.000Z' }), 'until');
});

test('E3-REM-3 계정 자체가 없으면(email 없음) unknown', () => {
  const LS = boot();
  assert.equal(LS.remainingKind({ email: '', perpetual: false, accessUntil: '' }), 'unknown');
  assert.equal(LS.remainingKind(null), 'unknown');
});

/* ── E3-b ㉮ — 검증 안 된 값을 «사실」로 안 보여준다 ──────────────────────
 * 지디 실측 + E4 재현: payload 를 2099 로 위조한 기록도 signature_invalid 로
 * «접근은 정상 차단»되는데, 화면은 그 위조된 2099 를 「구독: …까지 남아 있음」으로
 * «사실»처럼 보여줬다. main.js auth:state 가 평문 accessUntil 을 검증 여부와
 * 무관하게 그대로 내보내기 때문 — 화면(이 파일) 쪽에서 status 를 보고 걸러야 한다. */
test('E3-REM-4 ★status:"signature_invalid" — 위조된 2099 accessUntil 을 «절대」 보여주지 않는다(unverified)', () => {
  const LS = boot();
  const forged = { email: 'a@b.com', status: 'signature_invalid', perpetual: false, accessUntil: '2099-12-31T00:00:00.000Z' };
  assert.equal(LS.remainingKind(forged), 'unverified');
});

test('E3-REM-5 ★status:"signature_missing" — 서명 자체가 없을 때도 accessUntil 을 안 보여준다', () => {
  const LS = boot();
  const record = { email: 'a@b.com', status: 'signature_missing', perpetual: false, accessUntil: '2027-01-01T00:00:00.000Z' };
  assert.equal(LS.remainingKind(record), 'unverified');
});

test('E3-REM-6 ★위조된 perpetual:true 도 unverified 상태에서는 안 보여준다(같은 평문 출처)', () => {
  const LS = boot();
  const forged = { email: 'a@b.com', status: 'signature_invalid', perpetual: true, accessUntil: '' };
  assert.equal(LS.remainingKind(forged), 'unverified');
});

test('E3-REM-7 ★반대 방향 — 서명 «검증을 통과한» 상태(clock_rollback·grace_exceeded)는 그대로 보여준다', () => {
  const LS = boot();
  // clock_rollback → status:'locked'. exp_in_grace/grace_exceeded → status:'sig_expired'.
  // 둘 다 entitlement.js classify 상 v.ok===true(서명 검증 통과) 뒤에만 도달한다 — 진짜 사실이다.
  assert.equal(LS.remainingKind({ email: 'a@b.com', status: 'locked', accessUntil: '2027-01-01T00:00:00.000Z' }), 'until');
  assert.equal(LS.remainingKind({ email: 'a@b.com', status: 'sig_expired', accessUntil: '2027-01-01T00:00:00.000Z' }), 'until');
  assert.equal(LS.remainingKind({ email: 'a@b.com', status: 'sig_expired', perpetual: true, accessUntil: '' }), 'perpetual');
});

test('E3-REM-8 UNVERIFIED_STATUSES 사전에 정확히 그 둘만 있다(다른 status 로 새지 않는다)', () => {
  const LS = boot();
  assert.equal(LS.UNVERIFIED_STATUSES.slice().sort().join(','), 'signature_invalid,signature_missing');
});

/* ── 적재 검사: 이 파일이 실제로 electron·DOM 의존이 0인지(브라우저 <script> 로도 로드되므로) ── */
test('U-LICSCR-0 electron·require·module 의존 없이 순수 함수만 있다(전역이 window 뿐이어도 로드된다)', () => {
  // boot() 자체가 window 하나만 준 vm 에서 실행됐다 — 여기까지 왔다는 게 증거다.
  const LS = boot();
  assert.equal(typeof LS.decideInitialScreen, 'function');
  assert.equal(typeof LS.decideVerifyOutcome, 'function');
  assert.equal(typeof LS.remainingKind, 'function');
});

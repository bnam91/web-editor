/* 단위 하네스 — services/entitlement.js (E1: 서명 자격증명 «순수 모듈»)
 *
 * ★이 검사의 절반은 «양성대조»다.
 *   ⓐ만 초록인 검사는 「검증하는 척」을 못 잡는다 — 검증 호출을 통째로 지워도 ⓐ는 초록이다.
 *   ⇒ 「항상 참을 돌려주는 가짜 검증기」를 만들어 **그게 전부 통과하는 것**을 «먼저» 보이고,
 *     그 다음 진짜 검증기가 «같은 입력»을 거부하는 것을 보인다.
 *     그래야 「검증기가 실제로 도는가」가 검사로 «닫힌다».
 *
 * ★개인키를 파일로 두지 않는다 — 실행 «시» generateKeyPairSync 로 만든다.
 *   (배포 게이트 `tools/release/asar-secret-gate.mjs:53` 이 PEM 개인키를 잡는다. 애초에 안 만든다.)
 *
 * ⛔모든 대기에 상한이 있다. 이 파일에 무한 대기는 «하나도» 없다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const SRC_PATH = path.join(ROOT, 'services/entitlement.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');
const require_ = createRequire(import.meta.url);
const E = require_(SRC_PATH);

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

/* ── 테스트 키 (실행 시 생성 · 파일 0) ────────────────────────────────────── */
const kp1 = crypto.generateKeyPairSync('ed25519');
const kp2 = crypto.generateKeyPairSync('ed25519');
const PUB1 = kp1.publicKey.export({ type: 'spki', format: 'pem' });
const PUB2 = kp2.publicKey.export({ type: 'spki', format: 'pem' });
const KEYS = { k1: PUB1 };

const T0 = Date.parse('2026-09-06T00:00:00.000Z');

/** 서버 `_lib/entitlement-sign.js` `issue()` 와 «같은 계산»(@522412a)으로 서명 블록을 만든다. */
function sign(overrides = {}, priv = kp1.privateKey, opts = {}) {
  const iat = overrides.iat ?? new Date(T0).toISOString();
  /* ★iat 가 «ISO 가 아닌» 값일 수 있다 — ⓣ 가 일부러 숫자를 넣는다. 그때 exp 도 그대로 받는다. */
  const iatMs = Date.parse(iat);
  const defaultExp = Number.isFinite(iatMs) ? new Date(iatMs + 30 * DAY).toISOString() : iat;
  const payload = {
    ver: 1,
    kid: 'k1',
    app: 'goditor',
    sub: 'user-1',
    email: 'a@b.c',
    plan: 'pro',
    accessUntil: new Date(T0 + 100 * DAY).toISOString(),
    iat,
    exp: defaultExp,
    sid: null,
    ...overrides,
  };
  /* ★키를 «지우는» 것은 반드시 직렬화 «전»이다 — 뒤에 두면 지워도 인코딩엔 남는다 */
  for (const k of (opts.omit || [])) delete payload[k];
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = Buffer.from(crypto.sign(null, Buffer.from(encoded, 'utf8'), priv)).toString('base64url');
  const field = opts.field || 'payload';
  return { [field]: encoded, sig, kid: payload.kid ?? 'k1', _text: encoded, _payload: payload };
}

const rec = (signed, extra = {}) => ({
  email: 'a@b.c', plan: 'pro',
  accessUntil: new Date(T0 + 100 * DAY).toISOString(),
  sessionToken: 'tok-1',
  ...(signed ? { signed } : {}),
  ...extra,
});

/* ── 가짜 검증기 «샴 모듈» ────────────────────────────────────────────────────
 * 소스를 «통째로» 실어 `require('crypto')` 만 바꿔치기한다 — crypto.verify 가 항상 true.
 * ⛔소스를 «잘라» 쓰지 않는다. 잘라 쓰면 「부르는 선언을 다 실었는지」를 사람이 맞춰야 하고,
 *   그 규약은 반드시 갈라진다. 통째로 싣고 U-ENT-0 이 «통째인지»를 기계로 센다. */
function loadSham() {
  const fakeCrypto = Object.create(crypto);
  fakeCrypto.verify = () => true;
  const mod = { exports: {} };
  const fn = new Function('require', 'module', 'exports', `${SRC}\nreturn module.exports;`);
  return fn(name => (name === 'crypto' ? fakeCrypto : require_(name)), mod, mod.exports);
}
const SHAM = loadSham();

/* ═══ U-ENT-0 하네스 무결성 ═════════════════════════════════════════════════ */

test('U-ENT-0 ★하네스가 소스를 «통째로» 실었다 — 조각을 실으면 대조가 거짓말한다', () => {
  /* 실제 모듈이 내보내는 이름을 «소스에서» 세어, 샴이 그걸 다 갖는지 본다.
     ⛔사람이 목록을 손으로 맞추는 규약은 갈라진다 — 그래서 기계가 센다. */
  const realNames = Object.keys(E).sort();
  const shamNames = Object.keys(SHAM).sort();
  assert.deepEqual(shamNames, realNames,
    `샴 모듈이 «안 실은» 내보내기: ${realNames.filter(n => !shamNames.includes(n)).join(', ')}`);
  /* 그리고 소스의 최상위 `function 이름(` 이 전부 샴 안에서 «정의»됐는지(=끊긴 조각이 아닌지) */
  const declared = [...SRC.matchAll(/^function\s+(\w+)\s*\(/gm)].map(m => m[1]);
  assert.ok(declared.length >= 12, `최상위 함수가 ${declared.length}개뿐 — 소스가 잘렸다`);
  const missing = declared.filter(n => !SRC.includes(`function ${n}(`));
  assert.deepEqual(missing, []);
});

test('U-ENT-0b ★샴이 «진짜로» 검증을 무력화했다 — 아니면 양성대조가 무의미하다', () => {
  const s = sign();
  const broken = { ...s, sig: Buffer.from('not-a-signature').toString('base64url') };
  assert.equal(E.verifyEntitlement(broken, KEYS).ok, false, '진짜는 쓰레기 서명을 거부해야 한다');
  assert.equal(SHAM.verifyEntitlement(broken, KEYS).ok, true, '샴은 쓰레기 서명도 통과시켜야 한다');
});

/* ═══ 양성대조 — «서명 검사에 의존하는» 거부들 ═══════════════════════════════ */

/** 이 넷의 거부는 «오직 서명 검증»에서 나온다 — 계약도 통과하고 JSON 도 멀쩡하다.
 *  ⇒ 검증 호출을 지우면 넷 다 통과한다. 그게 양성대조가 성립하는 조건이다.
 *  ⚠️★「b64 문자 하나를 raw 로 뒤집기」는 «여기 넣으면 안 된다» — JSON 이 깨져서
 *    서명 검사가 없어도 계약 검사에 걸린다. 그러면 「검증기가 도는가」를 못 재고
 *    «다른 장치가 잡은 것»을 서명의 공로로 착각하게 된다. 그건 따로 잰다(아래 ⓑ-raw). */
function signatureDependentCases() {
  const good = sign();
  const other = sign({ sub: 'user-2', plan: 'pro12' });
  /* ⓑ payload «한 글자» 변조 — JSON 은 멀쩡하게 두고 값 한 글자만 바꾼다(email a@b.c → a@b.d).
     서명은 «옛 것»을 그대로 붙인다. 계약은 통과하므로 막는 것은 오직 서명이다. */
  const oneChar = { ...good._payload, email: 'a@b.d' };
  const oneCharText = Buffer.from(JSON.stringify(oneChar)).toString('base64url');
  return [
    ['ⓑ payload 한 글자 변조(JSON 은 멀쩡)', { payload: oneCharText, sig: good.sig, kid: 'k1' }],
    ['ⓒ 다른 키로 서명',        sign({}, kp2.privateKey)],
    ['ⓖ sig 그대로 + payload 만 다른 정상 payload 로 바꿔치기',
                               { payload: other._text, sig: good.sig, kid: 'k1' }],
    ['ⓖ2 반대 방향(payload 그대로 + sig 만 남의 것)',
                               { payload: good._text, sig: other.sig, kid: 'k1' }],
  ];
}

test('★양성대조 ⑴ — 가짜 검증기에서는 ⓑⓒⓖ 가 «전부 통과»한다 (그래야 대조가 성립)', () => {
  for (const [name, signed] of signatureDependentCases()) {
    const r = SHAM.verifyEntitlement(signed, KEYS);
    assert.equal(r.ok, true, `${name}: 샴이 거부했다 — 이 케이스는 서명 말고 다른 이유로 막힌다`);
    const c = SHAM.classify(rec(signed), T0, KEYS, SHAM.CONSTANTS);
    assert.equal(c.pass, true, `${name}: 샴 classify 가 통과 안 함`);
  }
});

test('★양성대조 ⑵ — 진짜 검증기는 «같은 입력»을 전부 거부한다', () => {
  for (const [name, signed] of signatureDependentCases()) {
    const r = E.verifyEntitlement(signed, KEYS);
    assert.equal(r.ok, false, `${name}: 진짜가 통과시켰다`);
    assert.equal(r.why, 'bad_sig', `${name}: why=${r.why}`);
    assert.equal('payload' in r, false, `${name}: ★실패인데 payload 키가 있다 — 검증 «전» 파싱의 흔적`);
    const c = E.classify(rec(signed), T0, KEYS, E.CONSTANTS);
    assert.equal(c.pass, false, `${name}: classify 가 통과시켰다`);
    assert.equal(c.cls, 'sig_invalid');
    assert.equal('payload' in c, false, `${name}: ★classify 결과에 payload 키가 있다`);
  }
});

test('ⓑ-raw b64 한 글자 뒤집기 → 진짜는 «bad_sig»로 잡는다 = 검증이 «파싱보다 먼저» 돈다', () => {
  /* ★이 케이스가 알려 주는 것은 «거부»가 아니라 «거부한 순서»다.
     JSON 이 깨져 있으니 파싱을 먼저 했다면 why 는 bad_payload 여야 한다.
     bad_sig 라는 것은 서명 검사가 «먼저» 돌았다는 뜻 — 규율 ⑴ 의 기계 증거다. */
  const good = sign();
  const t = good._text;
  const flipped = t.slice(0, 20) + (t[20] === 'A' ? 'B' : 'A') + t.slice(21);
  const r = E.verifyEntitlement({ payload: flipped, sig: good.sig, kid: 'k1' }, KEYS);
  assert.equal(r.ok, false);
  assert.equal(r.why, 'bad_sig', `★why=${r.why} — 서명보다 파싱이 «먼저» 돌았다`);
  assert.equal('payload' in r, false);
  /* 대조: 샴(검증 무력화)은 같은 입력을 «bad_payload»로 잡는다 — 잡는 «장치»가 다르다 */
  assert.equal(SHAM.verifyEntitlement({ payload: flipped, sig: good.sig, kid: 'k1' }, KEYS).why,
               'bad_payload');
});

test('★양성대조 ⑶ — ⓓⓣ 의 거부는 «계약 검사»에서 나온다(샴에서도 여전히 거부)', () => {
  /* 서명 검증을 무력화해도 막히는 것 = 그 거부가 서명이 아니라 «계약»의 몫이라는 증거.
     ⇒ 거부 하나하나가 «어느 장치»에서 나오는지가 분리돼 기록된다. */
  for (const [name, signed] of [
    ['ⓓ app:godiv', sign({ app: 'godiv' })],
    ['ⓣ iat/exp 가 숫자', sign({ iat: T0, exp: T0 + 30 * DAY })],
    ['ver≠1', sign({ ver: 2 })],
    ['내부 kid ≠ 외부 kid', { ...sign({ kid: 'k9' }), kid: 'k1' }],
    ['exp < iat', sign({ exp: new Date(T0 - DAY).toISOString() })],
  ]) {
    assert.equal(SHAM.verifyEntitlement(signed, KEYS).ok, false, `${name}: 샴이 통과 — 계약 검사가 없다`);
    const r = E.verifyEntitlement(signed, KEYS);
    assert.equal(r.ok, false, `${name}: 진짜가 통과`);
    assert.equal(r.why, 'bad_payload', `${name}: why=${r.why}`);
    assert.equal('payload' in r, false);
  }
});

/* ═══ ⓐ~ⓣ 계약·판정 ════════════════════════════════════════════════════════ */

test('ⓐ 정상 서명·신선 → valid · 통과', () => {
  const c = E.classify(rec(sign()), T0 + DAY, KEYS, E.CONSTANTS);
  assert.equal(c.cls, 'valid');
  assert.equal(c.status, 'signature_ok');
  assert.equal(c.pass, true);
  assert.equal(c.screen, 'editor');
  assert.equal(c.needsVerify, 'background');
  assert.equal(c.payload.sub, 'user-1');
});

test('ⓔ record.sub 핀 ≠ payload.sub → sub_mismatch (정상 서명이어도)', () => {
  const c = E.classify(rec(sign(), { sub: 'user-OTHER' }), T0 + DAY, KEYS, E.CONSTANTS);
  assert.equal(c.cls, 'sub_mismatch');
  assert.equal(c.pass, false);
});

test('ⓕ exp 지남 · iat+GRACE 안 → exp_in_grace · 오프라인 통과 / GRACE 밖 → 거부', () => {
  const s = sign();                       // exp = iat+30d, accessUntil = iat+100d
  const inGrace = E.classify(rec(s), T0 + 40 * DAY, KEYS, E.CONSTANTS);
  assert.equal(inGrace.cls, 'exp_in_grace');
  assert.equal(inGrace.status, 'sig_expired');
  assert.equal(inGrace.pass, true, '유예 안인데 잠갔다 — 2026-08-05 재발');
  assert.equal(inGrace.needsVerify, 'background');

  const outGrace = E.classify(rec(s), T0 + 46 * DAY, KEYS, E.CONSTANTS);
  assert.equal(outGrace.cls, 'grace_exceeded');
  assert.equal(outGrace.pass, false);
  assert.equal(outGrace.screen, 'verify');
});

test('ⓗ ★accessUntil 지남 · exp 는 «신선» → access_ended (통과 아님) — 계획서 §8 구멍 ①', () => {
  /* 구독이 5일 뒤 끝나는 사람이 오늘 서명을 받으면 exp 는 30일 뒤다.
     exp 를 먼저 보면 «해지된 사람이 25일 더» 쓴다. 순서가 곧 돈이다. */
  const s = sign({ accessUntil: new Date(T0 + 5 * DAY).toISOString() });
  const now = T0 + 10 * DAY;               // exp(T0+30d) 는 아직 «살아 있다»
  assert.ok(now < Date.parse(s._payload.exp), '전제: 이 시점에 exp 는 신선해야 검사가 의미 있다');
  const c = E.classify(rec(s), now, KEYS, E.CONSTANTS);
  assert.equal(c.cls, 'access_ended');
  assert.equal(c.status, 'access_ended');
  assert.equal(c.pass, false, '★구독이 끝났는데 통과시켰다');
  assert.equal(c.screen, 'expired');
});

test('ⓗ2 ★판정 «순서»가 코드에 박혀 있다 — accessUntil 검사가 exp 검사보다 «앞»', () => {
  /* 표를 눈으로 맞추는 대신 «소스의 위치»로 센다. 순서가 뒤집히면 이 검사가 빨강. */
  /* ⛔초판은 «주석 표식»(L5 —/L6 —)을 셌다. 코드만 옮기면 생존한다(적대검수 지적).
     ⇒ classify «본문»에서 «실행되는 줄»의 위치를 잰다. */
  /* ★E2 교훈(U-ENT-B14): 소스를 문자열로 훑는 검사는 «주석을 먼저 지워라».
     E2 의 「부팅 경로에 await 0」 검사가 «자기가 쓴 주석 속 await» 에 걸려 빨갛게 났다 —
     계측기가 자기를 잡은 것이다. 여기도 주석에 같은 코드를 적으면 위치가 흔들린다. */
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;{}])\/\/[^\n]*/g, '$1');
  const body = strip(SRC.slice(SRC.indexOf('function classify('), SRC.indexOf('function legacyAccessValid(')));
  /* ⛔「본문까지 지웠나」 가드 — 스트리퍼가 과하게 먹으면 검사가 «조용히» 무의미해진다 */
  assert.ok(body.includes('function classify(') && body.includes('return out('),
    '★주석 제거가 본문까지 먹었다 — 이 검사는 무효다');
  const iAccess = body.indexOf('if (p.accessUntil !== null) {');
  const iExp = body.indexOf('if (now > exp + C.CLOCK_SKEW_MS');
  assert.ok(iAccess > 0, 'classify 안에서 accessUntil 검사 «코드»를 못 찾았다');
  assert.ok(iExp > 0, 'classify 안에서 exp 검사 «코드»를 못 찾았다');
  assert.ok(iAccess < iExp, '★accessUntil 검사가 exp 검사보다 «뒤»에 있다 — 구멍 ① 재발');
});

test('ⓘ signed:null → signature_missing (거부가 «아니다» — 위조로 읽으면 안 된다)', () => {
  const c = E.classify(rec(null), T0, KEYS, E.CONSTANTS);
  assert.notEqual(c.status, 'signature_invalid', '★없음을 위조로 읽었다');
  assert.ok(['signature_missing', 'legacy_grace'].includes(c.status), `status=${c.status}`);
  /* 3필드 중 하나만 빠져도 «없음» 쪽이지 «위조» 쪽이 아니다 */
  for (const drop of ['payload', 'sig', 'kid']) {
    const s = sign(); delete s[drop];
    const c2 = E.classify(rec(s), T0, KEYS, E.CONSTANTS);
    assert.notEqual(c2.status, 'signature_invalid', `${drop} 누락을 위조로 읽었다`);
  }
});

test('ⓙ sig 없음 · 마감 «전» · accessUntil 유효 → 통과(legacy_grace) + 백그라운드 verify', () => {
  const now = Date.parse(E.CONSTANTS.SIGLESS_GRACE_UNTIL) - DAY;
  const c = E.classify(rec(null, { accessUntil: new Date(now + 30 * DAY).toISOString() }),
                       now, KEYS, E.CONSTANTS);
  assert.equal(c.cls, 'legacy_grace');
  assert.equal(c.pass, true, '옛 사용자가 개입 0 으로 지나야 한다 — 가장 많은 사람이 지나는 길');
  assert.equal(c.needsVerify, 'background');
});

test('ⓚ ★sig 없음 · 마감 «후» · accessUntil=2099 → 오프라인 거부 (오늘의 해킹 파일)', () => {
  const now = Date.parse(E.CONSTANTS.SIGLESS_GRACE_UNTIL) + DAY;
  const hacked = rec(null, { accessUntil: '2099-01-01T00:00:00.000Z' });
  const c = E.classify(hacked, now, KEYS, E.CONSTANTS);
  assert.equal(c.pass, false, '★2099 로 고친 파일이 마감 후에도 통과했다');
  assert.equal(c.cls, 'sig_missing');
  assert.equal(c.screen, 'verify');
  /* 그리고 «마감 전»엔 같은 파일이 통과한다 — 그게 마이그레이션 약속이다(방향 대조) */
  const before = E.classify(hacked, Date.parse(E.CONSTANTS.SIGLESS_GRACE_UNTIL) - DAY, KEYS, E.CONSTANTS);
  assert.equal(before.pass, true, '마감 전엔 통과해야 옛 사용자가 안 잠긴다');
});

test('ⓛ 서버 expired(서명 «없이») → 저장 서명본 «삭제» → 오프라인 재실행 = 만료', () => {
  const before = rec(sign());
  const applied = E.applyServerAnswer(before, { ok: false, reason: 'expired', accessUntil: '2026-09-01T00:00:00.000Z' },
                                      { now: T0 + DAY, keys: KEYS, C: E.CONSTANTS });
  assert.equal(applied.diag.droppedSignature, true);
  assert.equal('signed' in applied.record, false, '★서명본이 남았다 — 해지자가 exp 까지 30일 더 쓴다');
  const c = E.classify(applied.record, T0 + 2 * DAY, KEYS, E.CONSTANTS);
  assert.equal(c.pass, false);
});

test('ⓛ2 서버 expired + «서명본 있음» → 그 서명본을 저장(교체)하고 다음 판정이 만료', () => {
  const expiredSigned = sign({ accessUntil: new Date(T0 - DAY).toISOString() });
  const applied = E.applyServerAnswer(rec(sign()), { ok: false, reason: 'expired', signed: expiredSigned },
                                      { now: T0 + DAY, keys: KEYS, C: E.CONSTANTS });
  assert.equal(applied.diag.storedExpiredSignature, true);
  assert.equal(E.classify(applied.record, T0 + DAY, KEYS, E.CONSTANTS).cls, 'access_ended');
});

test('ⓜ sig_invalid + 서버 OK → 통과 / + 서버 «말 안 함» → 거부 / + invalid_session → 로그인', async () => {
  const bad = { ...sign(), sig: Buffer.from('x'.repeat(64)).toString('base64url') };
  const base = rec(bad);
  const ctx = { now: T0 + DAY, keys: KEYS, C: E.CONSTANTS };

  const okR = await E.resolveAuth(base, { ...ctx, verify: async () => ({ ok: true, signed: sign() }) });
  assert.equal(okR.pass, true, '★우리 배포 사고(키 오배포)를 «헐거운 쪽»으로 떨어뜨려야 한다');

  const nullR = await E.resolveAuth(base, { ...ctx, verify: async () => null });
  assert.equal(nullR.pass, false, '서버가 말을 «안 했는데» 통과시켰다');

  const deadR = await E.resolveAuth(base, { ...ctx, verify: async () => ({ ok: false, reason: 'invalid_session' }) });
  assert.equal(deadR.pass, false);
  assert.equal(deadR.screen, 'login');
  assert.equal(deadR.record, null);
});

test('ⓝ 단조 iat — 더 «옛» 서명본으로는 교체되지 않는다(리플레이)', () => {
  const newer = sign({ iat: new Date(T0 + 10 * DAY).toISOString(),
                       exp: new Date(T0 + 40 * DAY).toISOString() });
  const older = sign({ iat: new Date(T0).toISOString() });
  const applied = E.applyServerAnswer(rec(newer), { ok: true, signed: older },
                                      { now: T0 + 11 * DAY, keys: KEYS, C: E.CONSTANTS });
  assert.equal(applied.diag.rejectedOlderSignature, true);
  assert.equal(applied.changed, false);
  assert.equal(applied.record.signed.payload, newer._text, '★옛 서명본으로 내려갔다');
});

test('ⓞ 「말 안 함」(네트워크·404·5xx·429)은 아무것도 안 바꾼다 = 유예', () => {
  const before = rec(sign());
  const after = E.applyServerAnswer(before, null, { now: T0, keys: KEYS, C: E.CONSTANTS });
  assert.equal(after.changed, false);
  assert.equal(after.diag.serverSpoke, false);
  assert.equal(after.record, before, '★유예는 «여기»에만 있다 — 객체가 그대로여야 한다');
});

test('ⓟ 저장 왕복 — `signed` 문자열이 «바이트 동일»(===)로 보존된다', () => {
  const s = sign();
  const applied = E.applyServerAnswer(rec(null), { ok: true, signed: s },
                                      { now: T0, keys: KEYS, C: E.CONSTANTS });
  assert.equal(applied.record.signed.payload, s._text, '★문자열이 재직렬화되면 정상 서명이 «실패»한다');
  assert.equal(applied.record.signed, s, '받은 객체를 «그대로» 넘겨야 한다');
  /* 그리고 plain 은 «응답»이 아니라 «payload 에서» 파생된다 */
  assert.equal(applied.record.plan, s._payload.plan);
  assert.equal(applied.record.sub, s._payload.sub);
});

test('ⓠ ★SIGLESS_GRACE_UNTIL 이 지났으면 이 검사가 «실패»한다 (릴리스 게이트)', () => {
  const deadline = Date.parse(E.CONSTANTS.SIGLESS_GRACE_UNTIL);
  assert.ok(Number.isFinite(deadline), 'SIGLESS_GRACE_UNTIL 이 ISO 가 아니다');
  assert.ok(Date.now() < deadline,
    `★마감일(${E.CONSTANTS.SIGLESS_GRACE_UNTIL})이 지났다 — 릴리스 전에 날짜를 갱신하거나 2단계로 가라. `
    + '경고가 아니라 «검사»로 막는 자리다.');
});

test('ⓡ ★PUBLIC_KEYS 위생 — 플레이스홀더·테스트키면 실패 · SPKI 44B · Ed25519 OID', () => {
  const pem = E.PUBLIC_KEYS.k1;
  assert.ok(pem, 'k1 키가 없다');
  assert.equal(pem.includes(E.PLACEHOLDER_MARK), false, '★플레이스홀더가 남아 있다');
  assert.notEqual(pem, PUB1, '★테스트 키가 상수로 박혔다 — 누구나 자기 서명을 통과시킨다');
  assert.notEqual(pem, PUB2);
  const k = crypto.createPublicKey(pem);
  assert.equal(k.asymmetricKeyType, 'ed25519');
  const der = k.export({ type: 'spki', format: 'der' });
  assert.equal(der.length, 44);
  assert.equal(der.subarray(0, 12).toString('hex'), '302a300506032b6570032100');
  /* ⚠️이 키가 «라이브 서버의 그 키»인지는 아직 교차검증 «안 됐다». E5 가 뒤집는 한 줄. */
  assert.equal(typeof E.KEY_PROVENANCE, 'string');
});

test('ⓢ ★accessUntil: null (무기한) → valid · 통과 — 잠그면 결함이다', () => {
  const s = sign({ accessUntil: null });
  const c = E.classify(rec(s, { accessUntil: null }), T0 + 5 * DAY, KEYS, E.CONSTANTS);
  assert.equal(c.cls, 'valid');
  assert.equal(c.pass, true, '★무기한 사용자를 잠갔다 — null 을 «파싱 실패 → 만료»로 읽은 것');
  assert.equal(c.diag.perpetual, true);
  /* 그리고 저장 때도 null 이 «빈 문자열»로 뭉개지지 않는다 */
  const applied = E.applyServerAnswer(rec(null), { ok: true, signed: s },
                                      { now: T0, keys: KEYS, C: E.CONSTANTS });
  assert.equal(applied.record.accessUntil, null, "★null 이 '' 로 뭉개졌다 = 만료 취급");
});

test('ⓢ3 ★null 통과는 «우연»이 아니라 «명시적 분기»다 — 같은 NaN, 반대 결과', () => {
  /* `Date.parse(null)` 도 NaN, `Date.parse('not-a-date')` 도 NaN 이다.
     NaN 비교에 «기대는» 구현이면 둘이 «같은 길»로 간다 — 그러면 무기한 사용자가 잠긴다.
     ⇒ 둘이 «반대» 결과라는 것이, 코드가 null 을 명시적으로 갈랐다는 기계 증거다. */
  assert.equal(Number.isNaN(Date.parse(null)), true, '전제: null 도 NaN');
  assert.equal(Number.isNaN(Date.parse('not-a-date')), true, '전제: 쓰레기도 NaN');
  const perpetual = E.classify(rec(sign({ accessUntil: null })), T0 + 5 * DAY, KEYS, E.CONSTANTS);
  const junk = E.classify(rec(sign({ accessUntil: 'not-a-date' })), T0 + 5 * DAY, KEYS, E.CONSTANTS);
  assert.equal(perpetual.pass, true, '★무기한을 잠갔다');
  assert.equal(junk.pass, false, '★쓰레기를 통과시켰다');
});

test('ⓢ2 accessUntil 이 «null 도 ISO 도 아닌 쓰레기» → 통과 쪽으로 «절대» 안 간다', () => {
  const junk = sign({ accessUntil: 'not-a-date' });
  const r = E.verifyEntitlement(junk, KEYS);
  assert.equal(r.ok, false);
  assert.equal(r.why, 'bad_payload');
  /* 계약을 우회해 classify 로 직접 들어와도(방어층) 통과가 아니다 */
  const c = E.classify(rec(junk), T0, KEYS, E.CONSTANTS);
  assert.equal(c.pass, false);
});

/* ═══ 시계 · sid · 키 · 필드명 ═══════════════════════════════════════════════ */

test('ⓘ2 시계 되돌리기 — now = iat−1h 는 «통과»(오탐 0) · iat−25h 는 clock_rollback', () => {
  const s = sign();
  assert.equal(E.classify(rec(s), T0 - 1 * 60 * MIN, KEYS, E.CONSTANTS).pass, true,
    '★시계가 조금 느린 정상 사용자를 잠갔다');
  const back = E.classify(rec(s), T0 - 25 * 60 * MIN, KEYS, E.CONSTANTS);
  assert.equal(back.cls, 'clock_rollback');
  assert.equal(back.pass, false);
});

test('★sid 불일치는 «위조»가 아니라 «없음» — 서버가 명시한 규약(재로그인 전원 잠금 방지)', () => {
  /* 서버 `_lib/entitlement-sign.js` 의 sid 주석(@522412a): 「sid 가 안 맞으면 위조가 아니라 없음으로 다뤄 재검증해라.
     정상 재로그인이면 토큰이 바뀌어 옛 서명의 sid 가 당연히 안 맞는다.」 */
  const s = sign({ sid: E.sidOf('OTHER-TOKEN') });
  const c = E.classify(rec(s), T0 + DAY, KEYS, E.CONSTANTS);
  assert.notEqual(c.cls, 'sig_invalid', '★재로그인한 사람을 위조로 몰았다 = 전원 잠김');
  assert.notEqual(c.status, 'signature_invalid');
  assert.equal(c.diag.sidMismatch, true);
  /* ★「거부」가 아니라 «재검증»이다 — 서버에 물어볼 자리를 반드시 알려 줘야 한다 */
  assert.ok(c.needsVerify, '★재검증 경로를 안 알려 준다 — 사용자가 «푸는 길»을 잃는다');
  /* ★★M23 이 잡아낸 것: needsVerify 만 보면 「마감 전 재로그인 사용자를 오프라인에서 잠근다」가
     안 잠긴다. «통과하는가»를 직접 재야 한다. */
  assert.equal(c.pass, true, '★마감 전 재로그인 사용자를 오프라인에서 잠갔다');
  assert.equal(c.cls, 'legacy_grace');
  assert.equal(E.diagLine(c).includes('sid=mismatch'), true, '진단에 sid 불일치가 안 남는다');

  /* ★★sid 불일치는 «갈래가 둘»이다 — 위 케이스는 마감 전이라 legacy_grace 로 «먼저» 빠진다.
     ⛔변이검사가 잡아낸 구멍: 이 검사만 두면 두 번째 갈래(마감 후)가 «한 번도 안 돌아»
       거기서 sig_invalid 로 바뀌어도 전부 초록이었다. 두 갈래를 «따로» 잰다. */
  const afterDeadline = Date.parse(E.CONSTANTS.SIGLESS_GRACE_UNTIL) + DAY;
  const s2 = sign({ sid: E.sidOf('OTHER-TOKEN'),
                    iat: new Date(afterDeadline - DAY).toISOString(),
                    exp: new Date(afterDeadline + 29 * DAY).toISOString(),
                    accessUntil: new Date(afterDeadline + 60 * DAY).toISOString() });
  const c2 = E.classify(rec(s2, { accessUntil: new Date(afterDeadline + 60 * DAY).toISOString() }),
                        afterDeadline, KEYS, E.CONSTANTS);
  assert.equal(c2.cls, 'sig_missing', `★마감 후 sid 불일치를 «${c2.cls}» 로 읽었다 — 위조가 아니라 «없음» 이다`);
  assert.notEqual(c2.status, 'signature_invalid');
  assert.equal(c2.needsVerify, 'blocking');
  assert.equal(E.diagLine(c2).startsWith('ent:sig_absent'), true,
    '★마감 후 sid 불일치가 «검증 실패»로 집계된다 — 세는 사람이 위조로 오독한다');
  /* 맞으면 그냥 지나간다 */
  const good = sign({ sid: E.sidOf('tok-1') });
  assert.equal(E.classify(rec(good), T0 + DAY, KEYS, E.CONSTANTS).cls, 'valid');
  /* 없으면 «건너뛴다» — 없는 걸 불일치로 읽으면 옛 규격 서명본 전원이 재검증된다 */
  assert.equal(E.classify(rec(sign({ sid: null })), T0 + DAY, KEYS, E.CONSTANTS).cls, 'valid');
});

test('★필드명은 `payload` «하나»다 — 옛 이름 `entitlement` 는 «안 받는다»(폴백 제거)', () => {
  /* 정본: hompage_app feat/entitlement@522412a · _lib/entitlement-sign.js
       `return { payload: encoded, sig, kid: KID }`
     폴백을 짧게 뒀다가 지웠다 — 대성 확인으로 «옛 이름은 라이브에 나간 적이 없다».
     ⇒ 나갈 일 없는 이름을 받아 주면 규격이 «둘»인 것처럼 보인다. 이 검사가 그 하나를 못박는다. */
  const asPayload = sign({}, kp1.privateKey, { field: 'payload' });
  assert.equal(E.verifyEntitlement(asPayload, KEYS).ok, true);
  assert.equal(E.verifyEntitlement(asPayload, KEYS).field, 'payload');

  const asOldName = sign({}, kp1.privateKey, { field: 'entitlement' });
  const r = E.verifyEntitlement(asOldName, KEYS);
  assert.equal(r.ok, false, '★옛 이름을 아직 받고 있다 — 폴백이 남았다');
  assert.equal(r.why, 'incomplete', `why=${r.why}`);
  assert.equal('payload' in r, false);
  /* ★그리고 「없음」쪽이지 「위조」쪽이 아니다 — 규격이 어긋난 것이지 공격이 아니다 */
  assert.equal(E.classify(rec(asOldName), T0, KEYS, E.CONSTANTS).status !== 'signature_invalid', true);
});

test('★★진단 — 「sig 없음」과 「검증 실패」가 «다른 문자열»이다(세는 사람이 갈라야 한다)', () => {
  const absent = E.classify(rec(null), Date.parse(E.CONSTANTS.SIGLESS_GRACE_UNTIL) + DAY, KEYS, E.CONSTANTS);
  const bad = E.classify(rec({ ...sign(), sig: Buffer.from('x'.repeat(64)).toString('base64url') }),
                         T0 + DAY, KEYS, E.CONSTANTS);
  const lineA = E.diagLine(absent);
  const lineB = E.diagLine(bad);
  assert.equal(lineA.startsWith('ent:sig_absent'), true, `sig 없음 → ${lineA}`);
  assert.equal(lineB.startsWith('ent:sig_bad'), true, `검증 실패 → ${lineB}`);
  assert.notEqual(lineA.split(' ')[0], lineB.split(' ')[0],
    '★둘이 «같은 문자열»이다 — 나중에 세는 사람이 못 가른다');
});

test('★진단 문자열에 email·sub·토큰·서명 원문이 «없다» · 1000자 상한', () => {
  const s0 = sign({ email: 'secret@example.com', sub: 'SUBSUBSUB' });
  const v = E.classify(rec(s0, { sessionToken: 'TOKTOKTOK' }), T0 + DAY, KEYS, E.CONSTANTS);
  const line = E.diagLine(v);
  for (const leak of ['@', 'SUBSUBSUB', 'TOKTOKTOK', s0._text.slice(0, 24)]) {
    assert.equal(line.includes(leak), false, `★진단에 «${leak}» 가 샜다: ${line}`);
  }
  /* 상한 — errors[] 는 항목당 1000자다 */
  const fat = E.diagLine({ status: 'signature_invalid', cls: 'sig_invalid', pass: false,
                           diag: { why: 'z'.repeat(5000) } });
  assert.ok(fat.length <= 1000, `상한 초과: ${fat.length}`);
});

test('★재검증은 「무한히 시도해라」가 «아니다» — 백오프와 상한이 값으로 있다', () => {
  const C = E.CONSTANTS;
  /* ★수열을 «손으로 적지 않고» 끝까지 돌려서 뽑는다 — 주석·상수가 바뀌면 여기가 먼저 빨개진다.
     ⛔초판 주석은 「2s→4s→8s」였는데 8s 는 «도달 불가»였다(E2 가 잡았다). 시도 3회 = 대기 2회다. */
  const seq = [];
  for (let a = 1; a <= 50; a++) { const d = E.nextRetryDelayMs(a, C); if (d === null) break; seq.push(d); }
  assert.deepEqual(seq, [2000, 4000], `★지연 수열이 바뀌었다: ${JSON.stringify(seq)} — 주석·상수와 맞춰라`);
  assert.equal(seq.length, C.VERIFY_MAX_ATTEMPTS - 1, '★시도 N회 = 대기 N−1회 여야 한다');
  assert.equal(E.nextRetryDelayMs(3, C), null, '★상한에서 «그만»이 안 나온다');
  assert.equal(E.nextRetryDelayMs(99, C), null);
  /* ★주석이 코드를 따라오게 «강제»한다 — 「없어야 할 낱말」을 금지하는 쪽으로 짰다가 물렸다:
     정정 주석이 「8s 는 도달 불가다」라고 «설명»하느라 그 낱말을 담고 있어서 빨개졌다.
     ⇒ 금지(부정)가 아니라 «코드에서 뽑은 수열을 주석이 말하는가»(긍정)로 잰다.
       상수가 바뀌면 기대 문자열도 같이 바뀌므로, 주석을 안 고치면 여기가 빨개진다. */
  const expected = seq.map(ms => `${ms / 1000}s`).join(' · ');
  const cmt = SRC.slice(Math.max(0, SRC.indexOf('VERIFY_MAX_ATTEMPTS') - 900), SRC.indexOf('VERIFY_MAX_ATTEMPTS'));
  assert.ok(cmt.includes(expected),
    `★주석이 실제 지연 수열 «${expected}» 를 말하지 않는다 — 코드가 바뀌었으면 주석도 고쳐라`);
  /* 지수인지(선형 아님) + 최대치 상한 */
  const big = { ...C, VERIFY_MAX_ATTEMPTS: 20, VERIFY_BACKOFF_MAX_MS: 60000 };
  assert.ok(E.nextRetryDelayMs(4, big) > E.nextRetryDelayMs(3, big));
  assert.equal(E.nextRetryDelayMs(19, big), 60000, '최대치 상한이 안 걸린다');
  /* ⚠️session 에는 «지금» 레이트리밋이 없다(대성 실측) — 그래도 앱이 스스로 상한을 갖는다 */
});

test('★keys 가 «빈 객체»면 전부 unknown_kid → 온라인 «필수» (배포 사고의 안전한 방향)', () => {
  /* 키를 잘못 배포하면 전원이 여기 떨어진다. 오프라인이면 잠기지만 «온라인이면 서버가 살린다»
     (ⓜ 의 server_vouched). ⇒ 사고가 「전원 영구 잠김」이 아니라 「온라인 1회 필요」로 끝난다.
     그게 이 방향을 고른 이유다 — 반대(모르는 kid 를 통과)로 두면 서명이 장식이 된다. */
  const r = E.verifyEntitlement(sign(), {});
  assert.equal(r.ok, false);
  assert.equal(r.why, 'unknown_kid');
  assert.equal('payload' in r, false);
});

test('★base64url 의 «관대함»은 무해하다 — 서명 대상이 «문자열 그 자체»라서', () => {
  /* 적대 검수 질문: 「Buffer.from(sig,"base64url") 가 표준 base64 도 받으니
     «다른 문자열이 같은 서명»으로 풀리지 않나?」
     답: 서명 대상은 디코드 «결과»가 아니라 b64url «문자열의 utf8 바이트»다.
     ⇒ 같은 payload 라도 인코딩 표기가 다르면 «다른 메시지»고, 서명은 실패한다. 아래가 그 증거. */
  assert.ok(Buffer.from('A+/A', 'base64url').length > 0, '전제: 디코더는 관대하다');
  const s = sign();
  const std = Buffer.from(s._text, 'base64url').toString('base64'); // 같은 payload, 다른 표기
  if (std !== s._text) {
    const r = E.verifyEntitlement({ payload: std, sig: s.sig, kid: 'k1' }, KEYS);
    assert.equal(r.ok, false, '★표기만 바꾼 문자열이 같은 서명으로 통과했다');
  }
});

test('★dev 전용 키 주입 — 패키징에선 «무시»된다', () => {
  const env = { GODITOR_ENTITLEMENT_PUBKEY: PUB2 };
  assert.deepEqual(E.resolveKeys({ isPackaged: true, env }), E.PUBLIC_KEYS, '★배포본이 env 키를 먹었다');
  assert.deepEqual(E.resolveKeys({ env }), E.PUBLIC_KEYS, '기본은 «막는» 쪽이어야 한다');
  const dev = E.resolveKeys({ isPackaged: false, env });
  assert.equal(dev.k1, PUB2, 'dev 에서는 주입이 먹어야 한다');
  /* 못 읽는 값이면 상수 키를 «지우지» 않는다 */
  assert.deepEqual(E.resolveKeys({ isPackaged: false, env: { GODITOR_ENTITLEMENT_PUBKEY: 'garbage' } }),
                   E.PUBLIC_KEYS);
});

/* ═══ 대기 상한 · 부팅 비차단 ═══════════════════════════════════════════════ */

test('⛔대기 상한 — verify 가 «영원히» 안 끝나도 판정은 상한 안에 돌아온다', async () => {
  const bad = { ...sign(), sig: Buffer.from('x'.repeat(64)).toString('base64url') };
  const C = { ...E.CONSTANTS, VERIFY_TIMEOUT_MS: 60 };
  const t = Date.now();
  const r = await E.resolveAuth(rec(bad), {
    now: T0 + DAY, keys: KEYS, C,
    verify: () => new Promise(() => {}),   // 절대 안 끝난다
  });
  assert.ok(Date.now() - t < 5000, `상한을 안 지켰다 (${Date.now() - t}ms)`);
  assert.equal(r.pass, false, '못 물어봤으면 통과가 아니다');
});

test('★로컬이 통과면 resolveAuth 는 verify 를 «기다리지 않는다» (부팅 비차단)', async () => {
  let called = false;
  const r = await E.resolveAuth(rec(sign()), {
    now: T0 + DAY, keys: KEYS, C: E.CONSTANTS,
    verify: () => { called = true; return new Promise(() => {}); },
  });
  assert.equal(r.pass, true);
  assert.equal(called, false, '★부팅 경로가 네트워크를 기다렸다 — 2026-08-05 재발');
  assert.equal(r.backgroundVerify, true, '대신 «비차단»으로 돌라고 알려 줘야 한다');
});

test('★ⓙ 이어서 — 옛 사용자가 온라인이면 «개입 0»으로 서명본이 생긴다', async () => {
  const now = Date.parse(E.CONSTANTS.SIGLESS_GRACE_UNTIL) - DAY;
  const old = rec(null, { accessUntil: new Date(now + 30 * DAY).toISOString() });
  assert.equal('signed' in old, false);
  const fresh = sign({ iat: new Date(now).toISOString(), exp: new Date(now + 30 * DAY).toISOString(),
                       accessUntil: new Date(now + 30 * DAY).toISOString() });
  const applied = E.applyServerAnswer(old, { ok: true, signed: fresh },
                                      { now, keys: KEYS, C: E.CONSTANTS });
  assert.equal(applied.record.signed.payload, fresh._text);
  assert.equal(E.classify(applied.record, now, KEYS, E.CONSTANTS).cls, 'valid');
});

test('★「ok:true 인데 signed 없음」은 «통과» — 서버가 정한 규약(우리 배포 사고의 모양)', () => {
  const applied = E.applyServerAnswer(rec(sign()), { ok: true, signed: null, plan: 'pro' },
                                      { now: T0 + DAY, keys: KEYS, C: E.CONSTANTS });
  assert.equal(applied.diag.serverDocMissing, true);
  assert.ok(applied.record.signed, '옛 서명본은 «유지»해야 한다');
});

test('★server_vouched 가 «만료»까지 통과시키지는 않는다 (헐거운 쪽 규약의 경계)', async () => {
  /* 적대 질문: 「ok:true 면 통과」 규약이 만료자까지 열어 주지 않나?
     ⇒ 안 열어 준다. 그 경로는 «서명이 없거나 못 읽을 때»만이고, 새 서명본이 만료면
       재분류가 access_ended 로 떨어져 통과 목록(sig_invalid|sig_missing)에 «안 들어간다». */
  const bad = { ...sign(), sig: Buffer.from('x'.repeat(64)).toString('base64url') };
  const expiredSigned = sign({ accessUntil: new Date(T0 - DAY).toISOString() });
  const r = await E.resolveAuth(rec(bad), {
    now: T0 + DAY, keys: KEYS, C: E.CONSTANTS,
    verify: async () => ({ ok: true, signed: expiredSigned }),
  });
  assert.equal(r.cls, 'access_ended');
  assert.equal(r.pass, false, '★서버가 ok 라고 «말했다»는 이유로 만료자를 열었다');
  assert.equal(r.screen, 'expired');
});

test('★grace 밖 + 서버가 새 서명본 → 조용히 복구(잠김이 «지속»되지 않는다)', async () => {
  const stale = sign();
  const fresh = sign({ iat: new Date(T0 + 46 * DAY).toISOString(),
                       exp: new Date(T0 + 76 * DAY).toISOString(),
                       accessUntil: new Date(T0 + 100 * DAY).toISOString() });
  const r = await E.resolveAuth(rec(stale), {
    now: T0 + 46 * DAY, keys: KEYS, C: E.CONSTANTS,
    verify: async () => ({ ok: true, signed: fresh }),
  });
  assert.equal(r.local, 'grace_exceeded', '전제: 로컬만 보면 잠겨야 한다');
  assert.equal(r.pass, true, '온라인인데 안 풀렸다');
  assert.equal(r.cls, 'valid');
});


/* ═══ 적대검수(fable) 반영 — vouch 방향 · 계약 · resolveAuth 경로 ═══════════ */

test('★①-A 「우리가 서명본을 «못 썼을 때»」는 서버 ok:true 가 살린다 — 네 갈래 전부', async () => {
  /* 적대검수 실측 재현: 초판은 cls 목록(sig_invalid|sig_missing)으로 걸러 아래가 «전원 잠김»이었다. */
  const ctx = { keys: KEYS, C: E.CONSTANTS };
  const vouch = async (record, now) => E.resolveAuth(record, {
    ...ctx, now, verify: async () => ({ ok: true, signed: null, plan: 'pro' }),
  });
  /* ⑴ 갱신 결제 + 서명 env 미배포 → 저장본은 access_ended */
  const ended = sign({ accessUntil: new Date(T0 - DAY).toISOString() });
  assert.equal((await vouch(rec(ended), T0 + DAY)).pass, true, '⑴ 갱신한 사용자를 잠갔다');
  /* ⑵ env 깨진 채 45일 → grace_exceeded */
  assert.equal((await vouch(rec(sign()), T0 + 46 * DAY)).pass, true, '⑵ 온라인인데 유예초과로 잠갔다');
  /* ⑶ 키 로테이션이 앱보다 먼저 → 저장본이 unknown_kid(sig_invalid) */
  const rotated = { ...sign(), kid: 'k9' };
  assert.equal((await vouch(rec(rotated), T0 + DAY)).pass, true, '⑶ 키 로테이션으로 잠갔다');
  /* ⑷ 시계 24h+ 느림 */
  assert.equal((await vouch(rec(sign()), T0 - 26 * 60 * MIN)).pass, true, '⑷ 시계 느린 사용자를 잠갔다');
});

test('★①-B 시계 문제는 «유효한 새 서명본»이 와도 살린다 — 자격 얘기가 아니라 시계 얘기다', async () => {
  /* 적대검수 ⑷ 의 «진짜» 모양: 서버가 서명을 «주는데» 서버 시각이 로컬보다 26h 앞선다.
     그러면 새 서명본으로 갈아도 여전히 clock_rollback 이다 ⇒ couldNotStore 로는 안 살아난다. */
  const future = new Date(T0 + 26 * 60 * MIN).toISOString();
  const fresh = sign({ iat: future, exp: new Date(Date.parse(future) + 30 * DAY).toISOString() });
  const r = await E.resolveAuth(rec(sign({ iat: future, exp: new Date(Date.parse(future) + 30 * DAY).toISOString() })), {
    now: T0, keys: KEYS, C: E.CONSTANTS, verify: async () => ({ ok: true, signed: fresh }),
  });
  assert.equal(r.local, 'clock_rollback', '전제: 로컬만 보면 시계 되돌림이어야 한다');
  assert.equal(r.pass, true, '★서버가 답했는데 로컬 시계로 잠갔다 — 서버 시각이 정본이다');
});

test('★①-C 경계 — 서버가 «유효한» 만료 서명본을 주면 ok:true 여도 «안 연다»', async () => {
  /* 넓히면 안 되는 쪽. 서명된 사실이 응답 플래그를 이긴다. */
  const expiredSigned = sign({ accessUntil: new Date(T0 - DAY).toISOString() });
  const r = await E.resolveAuth(rec({ ...sign(), sig: 'AAAA' }), {
    now: T0 + DAY, keys: KEYS, C: E.CONSTANTS,
    verify: async () => ({ ok: true, signed: expiredSigned }),
  });
  assert.equal(r.cls, 'access_ended');
  assert.equal(r.pass, false, '★만료 서명본을 열었다');
});

test('★①-D vouch 는 «서버가 ok:true 라고 말했을 때»만 — ok:false 로는 안 열린다', async () => {
  /* M46 이 살아남던 자리: `r.ok === true` 를 `r` 로 바꿔도 초록이었다. */
  const future = new Date(T0 + 26 * 60 * MIN).toISOString();
  const stored = sign({ iat: future, exp: new Date(Date.parse(future) + 30 * DAY).toISOString() });
  const r = await E.resolveAuth(rec(stored), {
    now: T0, keys: KEYS, C: E.CONSTANTS,
    verify: async () => ({ ok: false, reason: 'some_other_reason' }),
  });
  assert.equal(r.pass, false, '★서버가 ok:true 라고 «말하지 않았는데» 통과시켰다');
});

test('★ⓛ-resolveAuth 서버 expired → `resolveAuth` 경로에서도 PASS 아니다', async () => {
  /* ⓛ 은 applyServerAnswer «만» 불렀다 — resolveAuth 경로는 0건이었다(적대검수 M46 지적). */
  const r = await E.resolveAuth(rec({ ...sign(), sig: 'AAAA' }), {
    now: T0 + DAY, keys: KEYS, C: E.CONSTANTS,
    verify: async () => ({ ok: false, reason: 'expired', accessUntil: '2026-09-01T00:00:00.000Z' }),
  });
  assert.equal(r.pass, false);
  assert.equal('signed' in (r.record || {}), false, '서명본이 안 지워졌다');
});

test('★② `accessUntil` «키 부재» = bad_payload — null 만 무기한이다', () => {
  /* 키가 없으면 무기한으로 읽던 자리(적대검수 A7:ABSENT).
     서버가 필드명을 바꾸는 날 «전원 무기한»이 된다 — 계약이 거기서 터져야 한다. */
  const absent = sign({}, kp1.privateKey, { omit: ['accessUntil'] });
  const r = E.verifyEntitlement(absent, KEYS);
  assert.equal(r.ok, false, '★키가 없는데 통과했다 = 전원 무기한');
  assert.equal(r.why, 'bad_payload');
  assert.equal(E.classify(rec(absent), T0, KEYS, E.CONSTANTS).pass, false);
  /* 그래도 «null 은» 여전히 무기한이다(둘을 갈랐다는 대조) */
  assert.equal(E.verifyEntitlement(sign({ accessUntil: null }), KEYS).ok, true);
});

test('★④ 서버가 expired 에 `accessUntil` 을 «안 실어도» 해킹 파일이 안 열린다', () => {
  /* 지금 안 열리는 이유가 「서버가 실어 주기 때문」이면 그건 «남의 코드에 기댄» 안전이다.
     서버가 그 필드를 빼는 날 조용히 열린다 ⇒ 기대지 않는 것을 검사로 고정한다. */
  const hacked = rec(sign(), { accessUntil: '2099-01-01T00:00:00.000Z' });
  const applied = E.applyServerAnswer(hacked, { ok: false, reason: 'expired' },  // ← accessUntil 없음
                                      { now: T0 + DAY, keys: KEYS, C: E.CONSTANTS });
  assert.equal('signed' in applied.record, false);
  assert.notEqual(applied.record.accessUntil, '2099-01-01T00:00:00.000Z',
    '★2099 가 그대로 남았다 — 서명 삭제 뒤 옛 규칙으로 통과한다');
  assert.equal(E.classify(applied.record, T0 + 2 * DAY, KEYS, E.CONSTANTS).pass, false);
});

test('★M56 상수가 «조용히» 바뀌지 않는다 (값 자체를 못박는다)', () => {
  const C = E.CONSTANTS;
  assert.equal(C.SIG_VALID_DAYS, 30);
  assert.equal(C.GRACE_DAYS, 45, '★유예가 바뀌었다 — 현빈 결정 사항이다(계획서 §3-3)');
  assert.equal(C.CLOCK_SKEW_MS, 5 * 60 * 1000);
  assert.equal(C.ROLLBACK_TOL_MS, 24 * 60 * 60 * 1000);
});

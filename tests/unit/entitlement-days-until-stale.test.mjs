/* 단위 — services/entitlement.js `daysUntilSigStale` (E3-b ㉯: 잠그기 전 exp−7일 예고).
 *
 * ★이 함수는 «판정»이 아니다 — pass/reject 는 classify/resolveAuth 몫이고, 여기는
 *   「exp 까지 남은 일수」만 계산한다. 화면(projects.html 배너)이 이 숫자를 «옮겨 적기만»
 *   하도록 만드는 게 이 함수의 존재 이유다(§E3-b ㉮ 에서 지적된 「직접 해석」 사고 재발 방지).
 *
 * ★★legacy_grace(서명 없음) 사용자가 이 값에서 «자동으로» 빠지는지가 이 검사의 핵심 —
 *   지디 결정 ⒜(2026-09-06): legacy_grace 는 실제 마감이 exp 가 아니라
 *   SIGLESS_GRACE_UNTIL(전역 고정일)이라 같은 배너에 실으면 틀린 날짜를 예고한다.
 *   별도 분기 없이 「서명이 없으면 null」 하나로 해결되는지 여기서 고정한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_PATH = path.join(__dirname, '../../services/entitlement.js');
const require_ = createRequire(import.meta.url);
const E = require_(SRC_PATH);

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-09-06T00:00:00.000Z');

const kp1 = crypto.generateKeyPairSync('ed25519');
const kp2 = crypto.generateKeyPairSync('ed25519');
const PUB1 = kp1.publicKey.export({ type: 'spki', format: 'pem' });
const PUB2 = kp2.publicKey.export({ type: 'spki', format: 'pem' });
const KEYS = { k1: PUB1 };

/** entitlement.test.mjs 의 `sign()` 과 같은 계산(서버 issue() 재현). */
function sign(overrides = {}, priv = kp1.privateKey) {
  const iat = overrides.iat ?? new Date(T0).toISOString();
  const iatMs = Date.parse(iat);
  const defaultExp = Number.isFinite(iatMs) ? new Date(iatMs + 30 * DAY).toISOString() : iat;
  const payload = {
    ver: 1, kid: 'k1', app: 'goditor', sub: 'user-1', email: 'a@b.c', plan: 'pro',
    accessUntil: new Date(T0 + 100 * DAY).toISOString(), iat, exp: defaultExp, sid: null,
    ...overrides,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = Buffer.from(crypto.sign(null, Buffer.from(encoded, 'utf8'), priv)).toString('base64url');
  return { payload: encoded, sig, kid: payload.kid ?? 'k1' };
}
const rec = (signed, extra = {}) => ({ email: 'a@b.c', plan: 'pro', sessionToken: 'tok-1', ...(signed ? { signed } : {}), ...extra });

test('DUS-1 exp 가 3일 뒤 → 3', () => {
  const signed = sign({ iat: new Date(T0).toISOString(), exp: new Date(T0 + 3 * DAY).toISOString() });
  assert.equal(E.daysUntilSigStale(rec(signed), KEYS, T0), 3);
});

test('DUS-2 exp 가 이미 지남 → 음수(걸러내는 건 부르는 쪽 몫)', () => {
  const signed = sign({ iat: new Date(T0 - 40 * DAY).toISOString(), exp: new Date(T0 - 10 * DAY).toISOString() });
  const d = E.daysUntilSigStale(rec(signed), KEYS, T0);
  assert.ok(d < 0, `음수여야 하는데 ${d}`);
});

test('DUS-3 ★★서명 자체가 없다(legacy_grace 의 모양) → null — 별도 분기 없이 자동 제외', () => {
  assert.equal(E.daysUntilSigStale(rec(null), KEYS, T0), null);
  assert.equal(E.daysUntilSigStale({ email: 'a@b.c', accessUntil: '2027-01-01T00:00:00.000Z' }, KEYS, T0), null);
});

test('DUS-4 record 자체가 null/undefined 여도 죽지 않고 null', () => {
  assert.equal(E.daysUntilSigStale(null, KEYS, T0), null);
  assert.equal(E.daysUntilSigStale(undefined, KEYS, T0), null);
});

test('DUS-5 ★서명이 위조/불일치(다른 키) → null — 위조된 exp 로 「곧 만료」를 계산해 주지 않는다', () => {
  const signed = sign({ exp: new Date(T0 + 5 * DAY).toISOString() }, kp2.privateKey);   // 다른 개인키
  assert.equal(E.daysUntilSigStale(rec(signed), KEYS, T0), null);
});

test('DUS-6 payload 만 바꿔치기(sig 는 원래 것) → null', () => {
  const good = sign({ exp: new Date(T0 + 5 * DAY).toISOString() });
  const other = sign({ exp: new Date(T0 + 5 * DAY).toISOString(), sub: 'user-2' });
  const tampered = { ...good, payload: other.payload };   // sig 는 good 것, payload 만 other 것
  assert.equal(E.daysUntilSigStale(rec(tampered), KEYS, T0), null);
});

test('DUS-7 exp 가 파싱 불가(계약 위반) → null(통과 쪽으로 새지 않는다)', () => {
  const signed = sign({ exp: '이게-날짜냐' });
  assert.equal(E.daysUntilSigStale(rec(signed), KEYS, T0), null);
});

test('DUS-8 now 를 생략하면 Date.now() 를 쓴다(주입 가능·미주입도 안 죽는다)', () => {
  const soon = Date.now() + 2 * DAY;
  const signed = sign({ iat: new Date().toISOString(), exp: new Date(soon).toISOString() });
  const d = E.daysUntilSigStale(rec(signed), KEYS);
  assert.ok(Number.isInteger(d) && d >= 1 && d <= 2, `now 미주입 계산이 이상하다: ${d}`);
});

test('DUS-9 정확히 exp 시각 = now → 0(경계값)', () => {
  const signed = sign({ exp: new Date(T0 + 3 * DAY).toISOString() });
  assert.equal(E.daysUntilSigStale(rec(signed), KEYS, T0 + 3 * DAY), 0);
});

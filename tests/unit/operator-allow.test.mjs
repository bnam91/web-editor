/* 단위 하네스 — services/operator-allow.js (0919 3라운드 adminsig: 배포판 운영자 허가 = 서명 allow 파일)
 *
 * ★겨누는 것: 옛 판정(env 토큰 sha256 == admin.allow)은 «사용자가 자기 PC 에서 둘 다 정할 수 있어»
 *   누구나 운영자가 됐다. 이제는 운영자 개인키 서명 + 기한 + 기기 묶기를 «다» 지나야 한다.
 * ★양성대조를 먼저 둔다 — 올바른 파일이 ok 인 걸 보여야 «거부»가 검증기 때문인지 입력이 깨져서인지 갈린다.
 * ★개인키를 파일로 두지 않는다 — 실행 시 generateKeyPairSync. (asar-secret-gate 가 PEM 개인키를 잡는다)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const require_ = createRequire(import.meta.url);
const OA = require_(path.join(ROOT, 'services/operator-allow.js'));
const E = require_(path.join(ROOT, 'services/entitlement.js'));

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const NOW = Date.parse('2026-09-19T12:00:00.000Z');

const pair = () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return { priv: privateKey, pub: publicKey.export({ type: 'spki', format: 'pem' }) };
};
const K = pair();
const OTHER = pair();
const KEYS = { op1: K.pub };
const MACHINE = OA.machineIdFrom('AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB');
const MACHINE2 = OA.machineIdFrom('CCCCCCCC-1111-2222-3333-DDDDDDDDDDDD');

function payloadOf(over = {}) {
  return {
    typ: 'goditor-operator-allow', ver: 1, kid: 'op1', app: 'goditor', machine: MACHINE,
    iat: new Date(NOW - 1 * DAY).toISOString(), exp: new Date(NOW + 6 * DAY).toISOString(),
    ...over,
  };
}
function sign(payloadObj, { priv = K.priv, kid = 'op1', raw } = {}) {
  const b64 = raw !== undefined ? raw : Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.sign(null, Buffer.from(b64, 'utf8'), priv).toString('base64url');
  return JSON.stringify({ kid, payload: b64, sig });
}
const check = (fileText, o = {}) => OA.checkOperatorAllow({ fileText, keys: KEYS, machineId: MACHINE, now: NOW, ...o });

test('ⓐ 양성대조: 올바른 서명·같은 기기·기한 안 → ok', () => {
  const r = check(sign(payloadOf()));
  assert.deepEqual(r, { ok: true, why: null });
  const v = OA.verifyOperatorAllow(sign(payloadOf({ note: '운영PC' })), KEYS);
  assert.equal(v.ok, true);
  assert.equal(v.payload.note, '운영PC');
});

test('ⓑ 서명·payload 변조 → bad_sig', () => {
  const doc = JSON.parse(sign(payloadOf()));
  const sigBuf = Buffer.from(doc.sig, 'base64url'); sigBuf[0] ^= 0x01;
  assert.equal(check(JSON.stringify({ ...doc, sig: sigBuf.toString('base64url') })).why, 'bad_sig');
  const p = doc.payload; const flip = p[5] === 'A' ? 'B' : 'A';
  assert.equal(check(JSON.stringify({ ...doc, payload: p.slice(0, 5) + flip + p.slice(6) })).why, 'bad_sig');
});

test('ⓒ 다른 키로 서명 → bad_sig · 모르는 kid → unknown_kid', () => {
  assert.equal(check(sign(payloadOf(), { priv: OTHER.priv })).why, 'bad_sig');
  assert.equal(check(sign(payloadOf({ kid: 'zz' }), { kid: 'zz' })).why, 'unknown_kid');
});

test('ⓓ payload 규약 위반 → bad_payload (kid 불일치·typ·app·ver·iat/exp 숫자·exp<=iat·note 비문자)', () => {
  const cases = [
    payloadOf({ kid: 'op2' }),                       // 바깥 kid(op1) ≠ payload.kid
    (() => { const p = payloadOf(); delete p.typ; return p; })(),
    payloadOf({ typ: 'goditor-entitlement' }),
    payloadOf({ app: 'godive' }),
    payloadOf({ ver: 2 }),
    payloadOf({ iat: NOW - DAY, exp: NOW + DAY }),   // 숫자
    payloadOf({ exp: new Date(NOW - 2 * DAY).toISOString() }), // exp < iat
    payloadOf({ note: 3 }),
    payloadOf({ machine: 'x'.repeat(64) }),
  ];
  for (const p of cases) assert.equal(check(sign(p)).why, 'bad_payload', JSON.stringify(p));
});

test('ⓔ 기기: 다른 기기 → machine_mismatch · 기기 못 읽음(null) → no_machine', () => {
  assert.equal(check(sign(payloadOf()), { machineId: MACHINE2 }).why, 'machine_mismatch');
  assert.equal(check(sign(payloadOf()), { machineId: null }).why, 'no_machine');
  assert.equal(OA.machineIdFrom(''), null);
  assert.equal(OA.machineIdFrom(null), null);
  assert.equal(OA.machineIdFrom(' aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb '), MACHINE, '대소문자·공백 무관(같은 기기)');
});

test('ⓕ 기한: 지남 → expired · iat 미래(skew 초과) → not_yet · skew 안 → ok · TTL 32일 → ttl_too_long · 31일 → ok', () => {
  assert.equal(check(sign(payloadOf({ iat: new Date(NOW - 8 * DAY).toISOString(), exp: new Date(NOW - 1).toISOString() }))).why, 'expired');
  assert.equal(check(sign(payloadOf({ exp: new Date(NOW).toISOString() }))).why, 'expired', 'now == exp 는 만료');
  assert.equal(check(sign(payloadOf({ iat: new Date(NOW + 6 * MIN).toISOString() }))).why, 'not_yet');
  assert.equal(check(sign(payloadOf({ iat: new Date(NOW + 4 * MIN).toISOString() }))).ok, true);
  assert.equal(check(sign(payloadOf({ iat: new Date(NOW - DAY).toISOString(), exp: new Date(NOW + 31 * DAY).toISOString() }))).why, 'ttl_too_long');
  assert.equal(check(sign(payloadOf({ iat: new Date(NOW - DAY).toISOString(), exp: new Date(NOW + 30 * DAY).toISOString() }))).ok, true);
  assert.equal(check(sign(payloadOf()), { now: NaN }).ok, false);
});

test('ⓖ 형식: 빈 파일 → no_file · JSON 깨짐 → bad_json · 필드 모자람 → incomplete', () => {
  assert.equal(check('').why, 'no_file');
  assert.equal(check('   \n').why, 'no_file');
  assert.equal(check(undefined).why, 'no_file');
  assert.equal(check('{"kid":').why, 'bad_json');
  assert.equal(check('[]').why, 'incomplete');
  assert.equal(check(JSON.stringify({ kid: 'op1', payload: 'abc' })).why, 'incomplete');
  assert.equal(check(JSON.stringify({ kid: 'op1', payload: 'a b', sig: 'x' })).why, 'incomplete');
});

test('ⓗ ★옛 방식 거부: admin.allow 형식(sha256 hex 한 줄)을 넣으면 운영자가 아니다', () => {
  const oldAllow = crypto.createHash('sha256').update('anything-i-like').digest('hex') + '\n';
  const r = check(oldAllow);
  assert.equal(r.ok, false);
  assert.ok(['bad_json', 'incomplete'].includes(r.why), r.why);
});

test('ⓘ ★교차 수용 불가: entitlement 서명본(k1 형식)은 운영자 허가가 아니다', () => {
  // 사용자 auth.json 의 signed 모양 그대로(테스트 키로 서명)
  const entPayload = { ver: 1, kid: 'k1', app: 'goditor', sub: 'u_1', iat: new Date(NOW - DAY).toISOString(),
    exp: new Date(NOW + 29 * DAY).toISOString(), accessUntil: null, email: 'u@example.com' };
  const text = sign(entPayload, { kid: 'k1' });
  // 엔타이틀먼트 검증기로는 통과(양성대조 — 모양이 진짜다)
  assert.equal(E.verifyEntitlement(JSON.parse(text), { k1: K.pub }).ok, true);
  // 운영자 키 맵엔 k1 이 없다
  assert.equal(check(text).why, 'unknown_kid');
  // 누가 키 맵을 합쳐도(같은 키가 k1·op1 둘 다) typ 검사에서 떨어진다
  assert.equal(check(text, { keys: { k1: K.pub, op1: K.pub } }).why, 'bad_payload');
  // 실상수: kid·PEM 교집합 0
  const opKids = Object.keys(OA.OPERATOR_PUBLIC_KEYS);
  const entKids = Object.keys(E.PUBLIC_KEYS);
  assert.deepEqual(opKids.filter((k) => entKids.includes(k)), []);
  const norm = (p) => String(p).replace(/\s+/g, '');
  const entPems = Object.values(E.PUBLIC_KEYS).map(norm);
  assert.deepEqual(Object.values(OA.OPERATOR_PUBLIC_KEYS).map(norm).filter((p) => entPems.includes(p)), []);
});

test('ⓙ 실패 결과엔 payload 키가 «없다» (검증 뒤에만 디코드)', () => {
  const bads = [
    OA.verifyOperatorAllow('', KEYS),
    OA.verifyOperatorAllow('{', KEYS),
    OA.verifyOperatorAllow(sign(payloadOf(), { priv: OTHER.priv }), KEYS),
    OA.verifyOperatorAllow(sign(payloadOf({ typ: 'x' })), KEYS),
  ];
  for (const r of bads) { assert.equal(r.ok, false); assert.equal('payload' in r, false); }
  const c = check(sign(payloadOf()), { machineId: MACHINE2 });
  assert.equal('payload' in c, false, 'checkOperatorAllow 는 판정만 돌려준다');
  assert.equal('payload' in check(sign(payloadOf())), false);
});

test('ⓚ ★safe-by-default: 실상수 OPERATOR_PUBLIC_KEYS 가 비어 있으면 어떤 입력도 ok 가 아니다', () => {
  if (Object.keys(OA.OPERATOR_PUBLIC_KEYS).length === 0) {
    assert.equal(OA.OPERATOR_KEY_PROVENANCE, 'unset');
    for (const t of [sign(payloadOf()), sign(payloadOf(), { priv: OTHER.priv })]) {
      assert.equal(OA.checkOperatorAllow({ fileText: t, keys: OA.OPERATOR_PUBLIC_KEYS, machineId: MACHINE, now: NOW }).ok, false);
    }
    assert.equal(OA.checkOperatorAllow({ fileText: sign(payloadOf()), keys: {}, machineId: MACHINE, now: NOW }).why, 'unknown_kid');
  } else {
    // 실키가 들어온 뒤: 형식(Ed25519 SPKI)과 kid 만 잰다
    for (const [kid, pem] of Object.entries(OA.OPERATOR_PUBLIC_KEYS)) {
      assert.match(kid, /^op\d+$/);
      assert.equal(crypto.createPublicKey(pem).asymmetricKeyType, 'ed25519');
    }
    assert.match(OA.OPERATOR_KEY_PROVENANCE, /^(unset|verified-\d{4}-\d{2}-\d{2})$/);
  }
  assert.ok(Object.isFrozen(OA.OPERATOR_PUBLIC_KEYS));
});

test('ⓛ rawMachineUuid: 주입된 I/O 로 플랫폼별 원천을 읽고, 실패는 null', () => {
  const mac = OA.rawMachineUuid({ platform: 'darwin', execFileSync: (cmd, args) => {
    assert.equal(cmd, '/usr/sbin/ioreg'); assert.deepEqual(args, ['-rd1', '-c', 'IOPlatformExpertDevice']);
    return '  "IOPlatformUUID" = "AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB"\n'; } });
  assert.equal(OA.machineIdFrom(mac), MACHINE);
  const winCmds = [];
  const win = OA.rawMachineUuid({ platform: 'win32', existsSync: (p) => p === 'C:\\Windows\\System32\\reg.exe', env: {},
    execFileSync: (cmd) => { winCmds.push(cmd);
      return '\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography\r\n    MachineGuid    REG_SZ    1234abcd-0000-1111-2222-333344445555\r\n'; } });
  assert.equal(win, '1234abcd-0000-1111-2222-333344445555');
  assert.deepEqual(winCmds, ['C:\\Windows\\System32\\reg.exe'], '★reg 는 절대경로로 부른다(PATH 불신)');
  // 절대경로 reg.exe 를 못 찾으면 PATH 로 떨어지지 않고 null
  assert.equal(OA.rawMachineUuid({ platform: 'win32', existsSync: () => false, env: {}, execFileSync: () => { throw new Error('must not exec'); } }), null);
  assert.equal(OA.rawMachineUuid({ platform: 'linux', readFileSync: () => 'abcdef0123\n' }), 'abcdef0123');
  assert.equal(OA.rawMachineUuid({ platform: 'darwin', execFileSync: () => { throw new Error('no'); } }), null);
  assert.equal(OA.rawMachineUuid({ platform: 'darwin', execFileSync: () => 'nothing' }), null);
  assert.equal(OA.rawMachineUuid({ platform: 'linux', readFileSync: () => '  ' }), null);
});

test('ⓜ reg.exe 경로: 기본 C:\\Windows · SystemRoot 는 «드라이브:\\Windows» 모양만 · 그 밖(PATH·임의 폴더)은 안 받는다', () => {
  const all = () => true;
  assert.equal(OA.winRegExePath({ existsSync: all, env: {} }), 'C:\\Windows\\System32\\reg.exe');
  const onlyD = (p) => p.startsWith('D:');
  assert.equal(OA.winRegExePath({ existsSync: onlyD, env: { SystemRoot: 'D:\\Windows' } }), 'D:\\Windows\\System32\\reg.exe');
  const any = (p) => !p.startsWith('C:\\Windows');
  assert.equal(OA.winRegExePath({ existsSync: any, env: { SystemRoot: 'C:\\Users\\me\\evil' } }), null);
  assert.equal(OA.winRegExePath({ existsSync: any, env: { SystemRoot: 'D:\\Windows\\..\\evil' } }), null);
  assert.equal(OA.winRegExePath({ existsSync: () => false, env: {} }), null);
  assert.equal(OA.winRegExePath({}), null, 'existsSync 없으면 null(막는 쪽)');
});

test('ⓝ UTF-8 BOM 이 붙은 파일도 같은 판정(PowerShell 5 Out-File) · BOM 만 있으면 no_file · 서명 강도는 그대로', () => {
  const good = sign(payloadOf());
  assert.deepEqual(check('\uFEFF' + good), { ok: true, why: null });
  assert.equal(check('\uFEFF').why, 'no_file');
  assert.equal(check('\uFEFF\uFEFF' + good).why, 'bad_json', 'BOM 은 하나만 벗긴다');
  const d = JSON.parse(good); d.payload = d.payload.slice(0, -1) + (d.payload.endsWith('A') ? 'B' : 'A');
  assert.equal(check('\uFEFF' + JSON.stringify(d)).why, 'bad_sig', 'BOM 붙여도 변조는 여전히 거부');
});

test('ⓞ 거부 안내 문구(operatorDeniedNotice): 옛 흔적·키 없음·사유별 · 판정 함수와 분리', () => {
  const a = OA.operatorDeniedNotice({ why: 'no_file', legacy: true, keysConfigured: true });
  assert.match(a.detail, /이 버전부터 무효/);
  assert.match(a.detail, /서명된 운영자 허가 파일\(operator\.allow\)이 필요합니다/);
  assert.match(a.log, /operator\.allow: no_file/);
  const b = OA.operatorDeniedNotice({ why: 'unknown_kid', legacy: false, keysConfigured: false });
  assert.match(b.detail, /운영자 공개키가 없어/);
  assert.ok(!/무효/.test(b.detail));
  assert.match(OA.operatorDeniedNotice({ why: 'machine_mismatch', keysConfigured: true }).detail, /이 기기에 발급된 것이 아닙니다/);
  assert.match(OA.operatorDeniedNotice({}).log, /operator\.allow: unknown/);
});

/* admin-authorized-wiring — main.js isAdminAuthorized() 배선을 «실행»으로 잰다 (0919 3라운드 adminsig)
 *
 * ★핵심 재현(수정 전 true 였던 것): 배포판 + 'admin' 인자 + env GODITOR_ADMIN_TOKEN + 그 sha256 을 쓴
 *   userData/admin.allow — 셋 다 사용자 손이다. 이제는 false 여야 한다.
 * ★main.js 의 함수 «원문»을 잘라 가짜 app·process·fs 로 돌린다(devtools-menu-gate runLaunchBlock 과 같은 방식)
 *   — 모양이 아니라 행동을 잰다. 운영자 모듈은 진짜를 쓰되 키만 테스트 키로 바꾼다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { readSrc, toPosix } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(__dirname, '..', '..');
const MAIN = readSrc(ROOT, 'main.js');
const OA = require(path.join(ROOT, 'services', 'operator-allow.js'));

const DAY = 24 * 60 * 60 * 1000;
const UD = '/U/GODITOR';
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const TEST_KEYS = { op1: publicKey.export({ type: 'spki', format: 'pem' }) };
const HERE = OA.machineIdFrom('AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB');
const ELSEWHERE = OA.machineIdFrom('CCCCCCCC-1111-2222-3333-DDDDDDDDDDDD');

function signedAllow({ machine = HERE, now = Date.now(), days = 7 } = {}) {
  const p = { typ: OA.TYP, ver: 1, kid: 'op1', app: 'goditor', machine,
    iat: new Date(now - 60 * 1000).toISOString(), exp: new Date(now + days * DAY).toISOString() };
  const b64 = Buffer.from(JSON.stringify(p), 'utf8').toString('base64url');
  return JSON.stringify({ kid: 'op1', payload: b64, sig: crypto.sign(null, Buffer.from(b64, 'utf8'), privateKey).toString('base64url') });
}

/** isAdminAuthorized 원문을 돌린다. files = { 파일명: 내용 } (userData 아래). keys 미지정 = 실상수. */
function runAdmin({ packaged, argv = ['/A/GODITOR'], env = {}, files = {}, keys, machineId = HERE }) {
  const src = sliceBlock(MAIN, 'function isAdminAuthorized(');
  const app = { isPackaged: packaged, getPath: (n) => { assert.strictEqual(n, 'userData'); return UD; } };
  const proc = { argv, env, platform: 'darwin' };
  const reads = [];
  const fakeFs = {
    readFileSync: (p) => { reads.push(p); const k = path.relative(UD, p); if (k in files) return files[k]; const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; },
    existsSync: (p) => { reads.push(p); return path.relative(UD, p) in files; },
  };
  const mod = keys ? { ...OA, OPERATOR_PUBLIC_KEYS: keys } : OA;
  const denied = [];
  let machineCalls = 0;
  const fn = new Function('app', 'process', 'fs', 'path', '_operatorAllow', '_operatorMachineId', '_noteOperatorDenied', 'require',
    `${src}\nreturn isAdminAuthorized();`);
  /* ★진짜 require 를 준다 — 옛 판정(require('crypto') + sha256)을 되돌려 넣는 변이가 «예외로 false» 가 돼
     거짓 초록이 되지 않게(음성대조가 실제로 빨개지게). */
  const req = (m) => require(m);
  const out = fn(app, proc, fakeFs, path, mod, () => { machineCalls++; return machineId; }, (w) => denied.push(w), req);
  return { out, reads, denied, machineCalls };
}

const OLD_TOKEN = 'i-made-this-up';
const OLD_ALLOW = crypto.createHash('sha256').update(OLD_TOKEN).digest('hex');

test('W1 ★핵심 재현: 배포판 + admin 인자 + GODITOR_ADMIN_TOKEN + 맞는 sha256 admin.allow → false (옛 구멍 닫힘)', () => {
  const r = runAdmin({ packaged: true, argv: ['/A/GODITOR', 'admin'], env: { GODITOR_ADMIN_TOKEN: OLD_TOKEN },
    files: { 'admin.allow': OLD_ALLOW + '\n' }, keys: TEST_KEYS });
  assert.strictEqual(r.out, false);
  assert.ok(!r.reads.some((p) => p.endsWith('admin.allow')), 'admin.allow 는 읽지도 않는다');
  // 옛 파일 내용을 새 이름으로 옮겨도 안 된다
  const r2 = runAdmin({ packaged: true, argv: ['/A/GODITOR', 'admin'], files: { 'operator.allow': OLD_ALLOW }, keys: TEST_KEYS });
  assert.strictEqual(r2.out, false);
  assert.deepStrictEqual(r2.denied, ['bad_json']);
});

test('W2 배포판 + admin + 유효 서명 operator.allow + 같은 기기 → true · 다른 기기 → false', () => {
  const ok = runAdmin({ packaged: true, argv: ['/A/GODITOR', 'admin'], files: { 'operator.allow': signedAllow() }, keys: TEST_KEYS });
  assert.strictEqual(ok.out, true, '양성대조 — 배선이 살아 있다');
  assert.strictEqual(ok.machineCalls, 1);
  const other = runAdmin({ packaged: true, argv: ['/A/GODITOR', 'admin'], files: { 'operator.allow': signedAllow({ machine: ELSEWHERE }) }, keys: TEST_KEYS });
  assert.strictEqual(other.out, false);
  assert.deepStrictEqual(other.denied, ['machine_mismatch']);
  const noMachine = runAdmin({ packaged: true, argv: ['/A/GODITOR', 'admin'], files: { 'operator.allow': signedAllow() }, keys: TEST_KEYS, machineId: null });
  assert.strictEqual(noMachine.out, false, '기기를 못 읽으면 운영자 아님');
  const expired = runAdmin({ packaged: true, argv: ['/A/GODITOR', 'admin'], files: { 'operator.allow': signedAllow({ now: Date.now() - 10 * DAY }) }, keys: TEST_KEYS });
  assert.strictEqual(expired.out, false);
});

test('W3 배포판 + 인자 없음 + 유효 파일 → false (운영자도 평소 실행은 고객 경로)', () => {
  const r = runAdmin({ packaged: true, argv: ['/A/GODITOR'], files: { 'operator.allow': signedAllow() }, keys: TEST_KEYS });
  assert.strictEqual(r.out, false);
  assert.strictEqual(r.reads.length, 0, '인자가 없으면 파일도 안 읽는다');
});

test('W4 ★실상수(키 비어 있음)로는 유효 서명 파일도 false — safe-by-default · 파일 없으면 기기 UUID 도 안 읽는다', () => {
  if (Object.keys(OA.OPERATOR_PUBLIC_KEYS).length === 0) {
    const r = runAdmin({ packaged: true, argv: ['/A/GODITOR', 'admin'], files: { 'operator.allow': signedAllow() } });
    assert.strictEqual(r.out, false);
    assert.deepStrictEqual(r.denied, ['unknown_kid']);
  }
  const none = runAdmin({ packaged: true, argv: ['/A/GODITOR', 'admin'], keys: TEST_KEYS });
  assert.strictEqual(none.out, false);
  assert.strictEqual(none.machineCalls, 0);
  assert.deepStrictEqual(none.denied, ['no_file']);
});

test('W5 dev(!isPackaged): admin 인자면 true(파일 불필요) · 인자 없으면 false — 기존 dev 흐름 유지', () => {
  const r = runAdmin({ packaged: false, argv: ['e', '.', '--remote-debugging-port=9334', 'admin'] });
  assert.strictEqual(r.out, true);
  assert.strictEqual(r.reads.length, 0);
  assert.strictEqual(runAdmin({ packaged: false, argv: ['e', '.'] }).out, false);
});

test('W6 정적: 함수 본문에 옛 판정 흔적 없음 · checkOperatorAllow 호출 · 키는 상수에서만 · devtools 미혼입(M6)', () => {
  const body = stripComments(sliceBlock(MAIN, 'function isAdminAuthorized('));
  assert.ok(!/GODITOR_ADMIN_TOKEN/.test(body));
  assert.ok(!/admin\.allow/.test(body));
  assert.ok(!/createHash\(['"]sha256['"]\)\.update\(token/.test(body));
  assert.ok(!/process\.env/.test(body), 'env 로 키·토큰을 받지 않는다');
  assert.match(body, /_operatorAllow\.checkOperatorAllow\(/);
  assert.match(body, /keys:\s*_operatorAllow\.OPERATOR_PUBLIC_KEYS/);
  assert.match(body, /'operator\.allow'/);
  assert.ok(!/devtools|ADMIN_EMAIL|coq3820/i.test(body));
});

test('W7 ★판정은 하나: 호출처 스냅샷 + 두 번째 admin 판정 없음', () => {
  const code = stripComments(MAIN);
  const calls = code.match(/(?<!function )\bisAdminAuthorized\(\)/g) || [];
  // app:is-admin · registerClaudePMIPC · registerTerminalIPC · will-navigate · checkAuthAndLoad ·
  // license:navigate-projects · _openProjectImpl · MCP authed = 8
  assert.strictEqual(calls.length, 8, `isAdminAuthorized() 호출처 수가 바뀌었다(${calls.length}) — 새 자리면 이 스냅샷과 주석을 같이 갱신`);
  assert.match(code, /createDevToolsGate\(\{[\s\S]*?isAdminAuthorized,/, 'devtools-gate 주입(판정엔 안 씀)');
  // 'admin' 인자 판정은 isAdminAuthorized 한 곳뿐
  const files = [path.join(ROOT, 'main.js'), path.join(ROOT, 'preload.js')];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : /\.m?js$/.test(e.name) ? [path.join(d, e.name)] : []);
  files.push(...walk(path.join(ROOT, 'main')), ...walk(path.join(ROOT, 'services')));
  const argvHits = [];
  const oldHits = [];
  for (const f of files) {
    const c = stripComments(fs.readFileSync(f, 'utf8'));
    const n = (c.match(/argv\.includes\(\s*['"]admin['"]\s*\)/g) || []).length;
    if (n) argvHits.push([toPosix(path.relative(ROOT, f)), n]);
    if (/GODITOR_ADMIN_TOKEN|['"]admin\.allow['"]/.test(c)) oldHits.push(toPosix(path.relative(ROOT, f)));
  }
  assert.deepStrictEqual(argvHits, [['main.js', 1]]);
  assert.deepStrictEqual(oldHits, [], '옛 토큰·admin.allow 를 읽는 코드가 남아 있다');
});

test('W8 기기 해시 리더는 memo(프로세스당 1회)이고 모듈의 같은 원천을 쓴다', () => {
  const body = stripComments(sliceBlock(MAIN, 'function _operatorMachineId('));
  assert.match(body, /if \(_operatorMachineIdMemo !== undefined\) return _operatorMachineIdMemo;/);
  assert.match(body, /_operatorAllow\.rawMachineUuid\(/);
  assert.match(body, /_operatorAllow\.machineIdFrom\(raw\)/);
});

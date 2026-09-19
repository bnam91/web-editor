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
const { makePkgBuild } = require('./_pkgbuild.js');

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
/* ★0920 pkgguard: asar = «스톡 Electron 으로 app.asar 를 띄움»(app.isPackaged=false 인데 asar 안에서 로드됨).
   판정 헬퍼는 main.js `_isPackagedBuild` «원문»(_pkgbuild.js)을 주입한다. */
function runAdmin({ packaged, asar = false, argv = ['/A/GODITOR'], env = {}, files = {}, keys, machineId = HERE }) {
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
  const fn = new Function('app', 'process', 'fs', 'path', '_operatorAllow', '_operatorMachineId', '_noteOperatorDenied', 'require', '_isPackagedBuild',
    `${src}\nreturn isAdminAuthorized();`);
  /* ★진짜 require 를 준다 — 옛 판정(require('crypto') + sha256)을 되돌려 넣는 변이가 «예외로 false» 가 돼
     거짓 초록이 되지 않게(음성대조가 실제로 빨개지게). */
  const req = (m) => require(m);
  const out = fn(app, proc, fakeFs, path, mod, () => { machineCalls++; return machineId; }, (w) => denied.push(w), req,
    makePkgBuild({ appIsPackaged: packaged, asar }));
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
  /* 옛 흔적 이름은 «안내 문구»(_noteOperatorDenied·operatorDeniedNotice)에만 허용 — 판정 경로엔 0.
     그 두 블록을 잘라낸 나머지에서 잰다(W9 가 그 두 블록이 판정에 안 섞이는 걸 따로 잰다). */
  const NOTICE_BLOCKS = ['function _noteOperatorDenied(', 'function operatorDeniedNotice('];
  for (const f of files) {
    let raw = fs.readFileSync(f, 'utf8');
    for (const h of NOTICE_BLOCKS) { if (raw.includes(h)) raw = raw.replace(sliceBlock(raw, h), ''); }
    const c = stripComments(raw);
    const n = (c.match(/argv\.includes\(\s*['"]admin['"]\s*\)/g) || []).length;
    if (n) argvHits.push([toPosix(path.relative(ROOT, f)), n]);
    if (/GODITOR_ADMIN_TOKEN|['"]admin\.allow['"]/.test(c)) oldHits.push(toPosix(path.relative(ROOT, f)));
  }
  assert.deepStrictEqual(argvHits, [['main.js', 1]]);
  assert.deepStrictEqual(oldHits, [], '옛 토큰·admin.allow 를 읽는 코드가 남아 있다');
});

/** _operatorMachineId 원문을 돌린다 — 성공 memo · 실패는 굳히지 않고 재시도 간격 뒤 회복. */
function makeMachineReader({ uuids }) {
  const src = sliceBlock(MAIN, 'function _operatorMachineId(');
  const retryDecl = (MAIN.match(/const _OPERATOR_MID_RETRY_MS = [^;]+;/) || [])[0];
  assert.ok(retryDecl, '재시도 간격 상수가 있다');
  let clock = 1_000_000;
  const seen = [];
  const io = { execCalls: 0 };
  const fakeOA = { ...OA, rawMachineUuid: (o) => { io.execCalls++; seen.push(o); const v = uuids.shift(); if (v instanceof Error) throw v; return v; } };
  const fn = new Function('_operatorAllow', 'process', 'fs', 'require', 'Date',
    `${retryDecl}\nlet _operatorMachineIdMemo = null;\nlet _operatorMachineIdFailedAt = 0;\n${src}\nreturn _operatorMachineId;`);
  const FakeDate = { now: () => clock };
  const reader = fn(fakeOA, { platform: 'win32', env: { SystemRoot: 'C:\\Windows' } }, { readFileSync() {}, existsSync() { return true; } }, () => ({ execFileSync() {} }), FakeDate);
  return { reader, io, seen, tick: (ms) => { clock += ms; } };
}

test('W8 기기 해시 리더: 성공은 memo(1회) · ★실패는 굳히지 않는다(재시도 간격 뒤 회복) · 절대경로용 io 를 넘긴다', () => {
  const ok = makeMachineReader({ uuids: ['AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB'] });
  assert.strictEqual(ok.reader(), HERE);
  assert.strictEqual(ok.reader(), HERE);
  assert.strictEqual(ok.io.execCalls, 1, '성공값은 프로세스당 한 번');
  assert.strictEqual(typeof ok.seen[0].existsSync, 'function', 'reg.exe 절대경로 확인용 existsSync 주입');
  assert.ok(ok.seen[0].env, 'SystemRoot 확인용 env 주입');

  const flaky = makeMachineReader({ uuids: [new Error('timeout'), 'AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB'] });
  assert.strictEqual(flaky.reader(), null, '첫 호출 실패 → 운영자 아님');
  assert.strictEqual(flaky.reader(), null, '재시도 간격 안 → exec 안 함(메인 안 막음)');
  assert.strictEqual(flaky.io.execCalls, 1);
  flaky.tick(31 * 1000);
  assert.strictEqual(flaky.reader(), HERE, '★간격 뒤 회복 — 재시작 없이');
  assert.strictEqual(flaky.io.execCalls, 2);
  assert.strictEqual(flaky.reader(), HERE);
  assert.strictEqual(flaky.io.execCalls, 2);
});

/** _noteOperatorDenied 원문을 돌린다 — 로그·화면 안내 1회, 옛 흔적은 «문구»에만. */
async function runNotice({ why = 'no_file', env = {}, files = {}, keys = {}, calls = 1 }) {
  const src = sliceBlock(MAIN, 'function _noteOperatorDenied(');
  const warns = [];
  const dialogs = [];
  const app = { getPath: () => UD, isReady: () => true, once: () => { throw new Error('ready 뒤라 once 를 안 부른다'); } };
  const fakeFs = { existsSync: (p) => path.relative(UD, p) in files };
  const dialog = { showMessageBox: (...a) => { dialogs.push(a.length === 2 ? a[1] : a[0]); return Promise.resolve({ response: 0 }); } };
  const cons = { warn: (...a) => warns.push(a.join(' ')) };
  const fn = new Function('app', 'process', 'fs', 'path', '_operatorAllow', 'dialog', 'console', 'mainWindow',
    `let _operatorDeniedLogged = false;\n${src}\nreturn _noteOperatorDenied;`);
  const note = fn(app, { env }, fakeFs, path, { ...OA, OPERATOR_PUBLIC_KEYS: keys }, dialog, cons, undefined);
  for (let i = 0; i < calls; i++) note(why);
  await new Promise((r) => setImmediate(r));
  return { warns, dialogs };
}

test('W9 ★거부는 조용하지 않다: 로그 + 화면 안내 1회 · 옛 admin.allow/토큰이면 «무효·서명 allow 필요» · 키 없으면 그 사실', async () => {
  const legacyFile = await runNotice({ files: { 'admin.allow': OLD_ALLOW }, keys: TEST_KEYS, calls: 3 });
  assert.strictEqual(legacyFile.warns.length, 1, '로그는 한 번');
  assert.strictEqual(legacyFile.dialogs.length, 1, '화면 안내도 한 번');
  assert.match(legacyFile.warns[0], /무효/);
  assert.match(legacyFile.warns[0], /서명 operator\.allow 필요/);
  /* ★0920 pkgguard: 화면(detail)엔 파일명·경로·변수명을 안 적는다 — 상세는 로그에만. */
  assert.match(legacyFile.dialogs[0].detail, /운영자 권한이 없는 실행입니다/);
  assert.match(legacyFile.dialogs[0].detail, /코드: no_file/);
  assert.ok(!/admin\.allow|operator\.allow|GODITOR_ADMIN_TOKEN|README|tools\//.test(legacyFile.dialogs[0].detail), '화면에 내부 이름이 샌다');
  assert.ok(!legacyFile.warns[0].includes(OLD_ALLOW), '파일 내용은 안 남긴다');

  const legacyEnv = await runNotice({ env: { GODITOR_ADMIN_TOKEN: OLD_TOKEN }, keys: TEST_KEYS });
  assert.match(legacyEnv.warns[0], /무효/);
  assert.ok(!legacyEnv.warns[0].includes(OLD_TOKEN) && !legacyEnv.dialogs[0].detail.includes(OLD_TOKEN), '토큰 값은 안 남긴다');

  const noKeys = await runNotice({ keys: {} });
  assert.ok(!/공개키/.test(noKeys.dialogs[0].detail), '화면엔 공개키 유무를 안 적는다');
  assert.match(noKeys.warns[0], /운영자 공개키 없음/);

  const plain = await runNotice({ why: 'expired', keys: TEST_KEYS });
  assert.ok(!/무효/.test(plain.warns[0]), '옛 흔적 없으면 «무효» 문구 없음');
  assert.match(plain.dialogs[0].detail, /코드: expired/);
});

test('W10 안내는 판정에 안 섞인다: isAdminAuthorized 는 r.ok 만 돌려주고, 옛 흔적은 안내 블록 밖에서 안 읽는다', () => {
  const body = stripComments(sliceBlock(MAIN, 'function isAdminAuthorized('));
  assert.match(body, /if \(!r\.ok\) _noteOperatorDenied\(r\.why\);\s*return r\.ok === true;/);
  // 옛 파일이 있어도 결과는 같다(W1 과 같은 입력에 안내 블록이 붙어도 false)
  const r = runAdmin({ packaged: true, argv: ['/A/GODITOR', 'admin'], env: { GODITOR_ADMIN_TOKEN: OLD_TOKEN },
    files: { 'admin.allow': OLD_ALLOW + '\n', 'operator.allow': signedAllow() }, keys: TEST_KEYS });
  assert.strictEqual(r.out, true, '유효 서명 allow 면 옛 흔적 유무와 무관하게 true');
});

/* ═══ 0920 4라운드 pkgguard (T-063) — «스톡 Electron + app.asar» 도 배포판이다 ═══════════════════ */

test('W11 ★핵심 재현: app.isPackaged=false 인데 asar 안에서 로드됨 + admin 인자 → 서명 allow 없으면 false', () => {
  const r = runAdmin({ packaged: false, asar: true, argv: ['/r/electron', '/tmp/x/app.asar', 'admin'], keys: TEST_KEYS });
  assert.strictEqual(r.out, false, '★스톡 Electron 으로 app.asar 를 admin 인자와 띄워 운영자가 됐다');
  assert.deepStrictEqual(r.denied, ['no_file'], '배포판 경로(서명 allow 판정)를 탔다');
  // 옛 자가 발급도 여전히 안 된다
  const old = runAdmin({ packaged: false, asar: true, argv: ['/r/electron', '/tmp/x/app.asar', 'admin'],
    env: { GODITOR_ADMIN_TOKEN: OLD_TOKEN }, files: { 'admin.allow': OLD_ALLOW }, keys: TEST_KEYS });
  assert.strictEqual(old.out, false);
});

test('W12 양성대조: asar + admin + 유효 서명 operator.allow → true (운영자 경로는 산다)', () => {
  const r = runAdmin({ packaged: false, asar: true, argv: ['/r/electron', '/tmp/x/app.asar', 'admin'],
    files: { 'operator.allow': signedAllow() }, keys: TEST_KEYS });
  assert.strictEqual(r.out, true);
});

test('W13 음성대조: dev(폴더 로드, asar 아님) + admin → true 그대로', () => {
  const r = runAdmin({ packaged: false, asar: false, argv: ['e', '.', 'admin'] });
  assert.strictEqual(r.out, true, 'dev 흐름이 막혔다');
  assert.strictEqual(r.reads.length, 0);
});

test('W14 정적: isAdminAuthorized 본문은 app.isPackaged 를 직접 읽지 않고 _isPackagedBuild() 를 부른다', () => {
  const body = stripComments(sliceBlock(MAIN, 'function isAdminAuthorized('));
  assert.ok(!/app\.isPackaged/.test(body), '★실행파일 이름만 보는 판정으로 돌아갔다');
  assert.match(body, /_isPackagedBuild\(\)/);
});

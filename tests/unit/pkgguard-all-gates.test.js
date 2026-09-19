/* pkgguard-all-gates — 「배포판인가」를 묻는 «모든» 보안 게이트가 한 벌짜리 답을 쓰는가 (0920 4라운드, T-063)
 *
 * ★막는 것: 배포판 판정이 `app.isPackaged`(실행파일 «이름» 규칙)에만 매달려, 스톡 Electron 으로 app.asar 를
 *   띄우거나(`electron /x/app.asar admin`) 윈도우에서 GODITOR.exe 를 electron.exe 로 복사하면 dev 경로가 열리던 것.
 *   이제 판정 = main.js `_isPackagedBuild()` = Electron 답 OR authService 런타임 판정(⒜ asar 안에서 로드됨).
 *
 * ★두 겹으로 잰다
 *   ⑴ 배선(실행): main.js «원문»을 떼어 app.isPackaged=false · asar=true 로 돌린다 — 게이트가 닫혀야 한다.
 *      음성대조 asar=false(dev 폴더 로드) — 지금처럼 열려 있어야 한다.
 *   ⑵ 정적 가드: 주석 뺀 main.js·main/**\/*.js 에서 `app.isPackaged` 를 직접 읽는 자리가 «허용목록»뿐이다.
 *      다음에 누가 게이트를 새로 만들며 app.isPackaged 를 직접 읽으면 여기가 빨개진다.
 *   (G1 CDP 차단 = devtools-menu-gate M9b · G7 운영자 = admin-authorized-wiring W11~14 · G9 = debug-port-badge-gate ·
 *    G8 = devtools-gate ①c · G2~G5 = authservice-apibase U-AB-13~15 에서 잰다.)
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { readSrc, toPosix } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');
const { stripComments } = require('./_strip-comments.js');
const { makePkgBuild, PKG_BUILD_SRC } = require('./_pkgbuild.js');

const ROOT = path.join(__dirname, '..', '..');
const MAIN = readSrc(ROOT, 'main.js');
const WIRE = readSrc(ROOT, 'main/gdt/wire.js');
const entitlement = require(path.join(ROOT, 'services', 'entitlement.js'));

/* ── 헬퍼 자체 ─────────────────────────────────────────────────────────── */

test('P1 _isPackagedBuild: Electron 답 OR asar 판정 · 예외는 막는 쪽 · env 를 안 읽는다', () => {
  assert.strictEqual(makePkgBuild({ appIsPackaged: false })(), false, 'dev');
  assert.strictEqual(makePkgBuild({ appIsPackaged: false, asar: true })(), true, '★스톡 Electron + asar');
  assert.strictEqual(makePkgBuild({ appIsPackaged: true })(), true, '정식 배포본');
  assert.strictEqual(makePkgBuild({ appIsPackaged: false, authThrows: true })(), true, '판정 모듈이 깨지면 막는 쪽');
  const body = stripComments(PKG_BUILD_SRC);
  assert.ok(!/process\.env/.test(body), '★env 로 「나는 dev 다」를 주장할 수 있다');
  assert.match(body, /require\('\.\/services\/authService'\)\.isPackaged\(\)/, 'authService 의 한 벌짜리 답을 본다');
});

test('P2 _isPackagedBuild 는 함수 «선언»이고 CDP 차단 IIFE 보다 앞에 있다(호이스팅 + 읽기 순서)', () => {
  const decl = MAIN.indexOf('function _isPackagedBuild(');
  assert.ok(decl > 0);
  assert.ok(decl < MAIN.indexOf('(function _blockDebugLaunchInPackaged()'));
  assert.ok(!/const _isPackagedBuild|let _isPackagedBuild/.test(MAIN), '함수 표현식이면 IIFE 에서 TDZ');
});

/* ── G6 공개키 env 주입 (entKeys → entitlement.resolveKeys) ───────────────── */

const EVIL_PUB = require('crypto').generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' });
function runEntKeys({ packaged, asar }) {
  const src = sliceBlock(MAIN, 'function entKeys(');
  const env = { GODITOR_ENTITLEMENT_PUBKEY: EVIL_PUB };
  const fn = new Function('app', 'entitlement', 'process', '_isPackagedBuild', `${src}\nreturn entKeys();`);
  return fn({ isPackaged: packaged }, entitlement, { env }, makePkgBuild({ appIsPackaged: packaged, asar }));
}

test('G6 ★스톡 Electron + asar: env 공개키(GODITOR_ENTITLEMENT_PUBKEY)를 «무시»한다 — 자기 서명 라이선스 위조 차단', () => {
  const k = runEntKeys({ packaged: false, asar: true });
  assert.deepStrictEqual(k, entitlement.PUBLIC_KEYS, '★asar 에서 로드됐는데 env 공개키를 먹었다');
  assert.deepStrictEqual(runEntKeys({ packaged: true, asar: false }), entitlement.PUBLIC_KEYS);
});

test('G6 음성대조: dev 폴더 로드면 env 키 주입이 지금처럼 먹는다', () => {
  const k = runEntKeys({ packaged: false, asar: false });
  assert.notDeepStrictEqual(k, entitlement.PUBLIC_KEYS, 'dev 주입이 막혔다 — 이 검사가 장식이 아니라는 대조');
});

/* ── G10 핫리로드(watchFiles) — 보안은 아니지만 asar 안에서 fs.watch 가 throw 해 whenReady 체인이 끊긴다 ── */

function runWatch({ packaged, asar }) {
  const src = sliceBlock(MAIN, 'function watchFiles(');
  const watched = [];
  const fakeFs = { watch: (p) => { watched.push(p); return { on() {}, close() {} }; }, existsSync: () => true, statSync: () => ({ isDirectory: () => true }) };
  const fn = new Function('app', 'fs', 'path', '__dirname', 'mainWindow', 'console', '_isPackagedBuild', `${src}\nreturn watchFiles();`);
  try { fn({ isPackaged: packaged }, fakeFs, path, '/x', null, { log() {}, warn() {}, error() {} }, makePkgBuild({ appIsPackaged: packaged, asar })); } catch (_) {}
  return watched;
}

test('G10 스톡 Electron + asar: 핫리로드가 fs.watch 를 «한 번도» 안 부른다 · dev 는 부른다', () => {
  assert.deepStrictEqual(runWatch({ packaged: false, asar: true }), [], '★asar 안에서 fs.watch 를 걸었다');
  assert.ok(runWatch({ packaged: false, asar: false }).length > 0, '음성대조: dev 핫리로드가 죽었다');
});

/* ── G11 다중 인스턴스 예외(main/gdt/wire.js) ──────────────────────────── */

function runMulti({ asar, env = {}, argv = [] }) {
  const src = sliceBlock(WIRE, 'function _allowMultiInstance(');
  const req = (m) => {
    if (m === '../../services/authService') return { isPackaged: () => !!asar };
    throw new Error('unexpected require ' + m);
  };
  const fn = new Function('app', 'process', 'require', `${src}\nreturn _allowMultiInstance();`);
  return fn({ isPackaged: false }, { env, argv }, req);
}

test('G11 스톡 Electron + asar: GODITOR_ALLOW_MULTI=1 · CDP 인자로도 다중 인스턴스 예외 없음 · dev 는 그대로', () => {
  assert.strictEqual(runMulti({ asar: true, env: { GODITOR_ALLOW_MULTI: '1' } }), false, '★같은 userData 에 두 인스턴스');
  assert.strictEqual(runMulti({ asar: true, argv: ['--remote-debugging-port=9502'] }), false);
  assert.strictEqual(runMulti({ asar: false, env: { GODITOR_ALLOW_MULTI: '1' } }), true, '음성대조: dev 다중 실행이 막혔다');
  assert.strictEqual(runMulti({ asar: false, argv: ['--remote-debugging-port=9502'] }), true);
});

/* ── G8 개발자 도구 게이트 주입 ─────────────────────────────────────────── */

test('G8 main.js 가 devtools-gate 에 _isPackagedBuild 를 주입한다', () => {
  const code = stripComments(MAIN);
  assert.match(code, /createDevToolsGate\(\{[\s\S]*?isPackaged:\s*_isPackagedBuild\b[\s\S]*?\}\);/);
});

/* ── ⑵ 정적 가드: app.isPackaged 직접 읽기 = 허용목록뿐 ─────────────────────
 * 허용목록(판정이 아닌 것 / 판정 그 자체):
 *   main.js  · _isPackagedBuild 본문(판정 그 자체)
 *            · applyRuntime 에 넘기는 두 줄(_pkg·_pkg2 — authService 는 조이는 쪽으로만 받는다)
 *            · _blockDebugLaunchInPackaged 의 nodeOptionsHonored(퓨즈 유무 입력 — 판정이 아님)
 *            · updater 두 곳(_updaterCacheDir·_autoUpdateEnabled — G12, 의도적 제외: electron-updater 가 내부에서
 *              app.isPackaged 로 다시 판정해 넓혀 봐야 무동작, 스톡 Electron resourcesPath 엔 app-update.yml 없음)
 *   main/devtools-gate.js · realPackaged(주입된 isPackaged() 와 OR — 조이는 쪽) */
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : /\.m?js$/.test(e.name) ? [path.join(d, e.name)] : []);
}

const ALLOW = [
  { file: 'main.js', within: 'function _isPackagedBuild(', count: 1 },
  { file: 'main.js', line: /^\s*try \{ _pkg = app\.isPackaged; \}/, count: 1 },
  { file: 'main.js', line: /^\s*try \{ _pkg2 = app\.isPackaged; \}/, count: 1 },
  { file: 'main.js', line: /nodeOptionsHonored: \(\(\) => \{ try \{ return app\.isPackaged !== true; \}/, count: 1 },
  { file: 'main.js', within: 'function _updaterCacheDir(', count: 1 },
  { file: 'main.js', within: 'function _autoUpdateEnabled(', count: 1 },
  { file: 'main/devtools-gate.js', within: 'function realPackaged(', count: 1 },
];

/** 소스 묶음 { rel: raw } 에서 허용목록 밖의 app.isPackaged 읽기를 돌려준다. */
function strayReads(sources) {
  const stray = [];
  let total = 0;
  for (const [rel, raw] of Object.entries(sources)) {
    let code = stripComments(raw);
    const hits = (code.match(/\bapp\.isPackaged\b/g) || []).length;
    if (!hits) continue;
    total += hits;
    // 허용된 자리를 지우고 남는 게 있으면 새 판정이다
    for (const a of ALLOW.filter((x) => x.file === rel)) {
      if (a.within) {
        const blk = stripComments(sliceBlock(raw, a.within));
        const n = (blk.match(/\bapp\.isPackaged\b/g) || []).length;
        assert.strictEqual(n, a.count, `${rel} ${a.within} 안의 app.isPackaged 수가 바뀌었다(${n})`);
        code = code.replace(blk, '');
      } else {
        const lines = code.split('\n');
        const idx = lines.map((l, i) => (a.line.test(l) ? i : -1)).filter((i) => i >= 0);
        assert.strictEqual(idx.length, a.count, `${rel} 허용 줄 ${a.line} 을 못 찾았다(${idx.length})`);
        for (const i of idx) lines[i] = '';
        code = lines.join('\n');
      }
    }
    // 한 줄짜리 '...' 문자열 안(로그 문구)은 «읽기»가 아니다. ⛔템플릿 리터럴은 안 지운다(여러 줄을 삼켜 거짓 초록).
    const noStr = code.replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
    for (const l of noStr.split('\n').filter((x) => /\bapp\.isPackaged\b/.test(x))) stray.push(`${rel}: ${l.trim()}`);
  }
  return { stray, total };
}

function realSources() {
  const out = {};
  for (const f of [path.join(ROOT, 'main.js'), ...walk(path.join(ROOT, 'main'))]) {
    out[toPosix(path.relative(ROOT, f))] = fs.readFileSync(f, 'utf8');
  }
  return out;
}

test('S1 ★정적 가드: main.js·main/**/*.js 에서 app.isPackaged 를 직접 읽는 자리는 허용목록뿐', () => {
  const { stray, total } = strayReads(realSources());
  assert.deepStrictEqual(stray, [], '★허용목록 밖에서 app.isPackaged 를 직접 읽는다 — _isPackagedBuild() 를 써라:\n' + stray.join('\n'));
  assert.ok(total >= ALLOW.length, '허용목록이 실제 자리와 맞다');
});

test('S1b 양성대조: 게이트를 옛 판정(app.isPackaged 직접)으로 되돌린 변이를 S1 이 잡는다', () => {
  const src = realSources();
  const muts = [
    ['main.js', 'if (!_isPackagedBuild()) return true;', 'if (!app.isPackaged) return true;'],        // G7
    ['main.js', 'if (_isPackagedBuild()) return null;', 'if (app.isPackaged) return null;'],           // G9
    ['main/gdt/wire.js', 'if (packaged) return false;', 'if (app.isPackaged) return false;'],         // G11
  ];
  for (const [rel, from, to] of muts) {
    assert.ok(src[rel].includes(from), `변이 자리 ${from} 가 없다 — 문장이 바뀌었으면 이 대조부터 고쳐라`);
    const { stray } = strayReads({ ...src, [rel]: src[rel].replace(from, to) });
    assert.strictEqual(stray.length, 1, `★변이(${to})를 정적 가드가 못 잡았다 = 장식`);
  }
});

test('S2 게이트 전수: 보안 게이트 자리들이 _isPackagedBuild() 를 부른다', () => {
  const need = [
    ['(function _blockDebugLaunchInPackaged()', 'G1 CDP·inspect 부팅 차단'],
    ['function entKeys(', 'G6 공개키 env 주입'],
    ['function isAdminAuthorized(', 'G7 운영자(admin)'],
    ['function watchFiles(', 'G10 핫리로드'],
  ];
  for (const [h, name] of need) {
    const at = MAIN.indexOf(h);
    assert.ok(at >= 0, `${name}: ${h} 가 사라졌다`);
    const blk = h.startsWith('(function') ? MAIN.slice(at, MAIN.indexOf('})();', at)) : sliceBlock(MAIN, h);
    assert.match(stripComments(blk), /_isPackagedBuild\(\)/, `★${name} 가 한 벌짜리 판정을 안 쓴다`);
  }
  // G9 app:debug-port
  const dbg = MAIN.slice(MAIN.indexOf("ipcMain.handle('app:debug-port'"), MAIN.indexOf("ipcMain.handle('app:debug-port'") + 1500);
  assert.match(stripComments(dbg), /if \(_isPackagedBuild\(\)\) return null;/, 'G9 app:debug-port');
  // G11 wire
  assert.match(stripComments(sliceBlock(WIRE, 'function _allowMultiInstance(')), /require\('\.\.\/\.\.\/services\/authService'\)\.isPackaged\(\)/);
});

/* devtools-menu-gate — 개발자 도구 «여는 길»이 전부 게이트를 지나는지 원문으로 잰다 (2026-09-19)
 *
 * ★겨누는 것: 오늘 결함의 모양 그대로 — 메뉴의 표준 role 「toggleDevTools」 가 배포판에서도
 *   ⌥⌘I 로 누구나 열었다. 누가 그 role 을 도로 넣거나, main 어딘가에서 openDevTools 를
 *   게이트 없이 부르거나, 가드 등록을 createWindow 뒤로 옮기면 여기가 빨개진다.
 * ★관리자코드 평문 스캔은 «해시로» 한다 — 이 파일에도 평문이 없다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readSrc, toPosix } = require('./_srcread.js');
const { sliceBlock, sliceCall } = require('./_slice-block.js');

const ROOT = path.join(__dirname, '..', '..');
const MAIN = readSrc(ROOT, 'main.js');
const WIRE = readSrc(ROOT, 'main', 'gdt', 'wire.js');
const MODAL = readSrc(ROOT, 'js', 'settings', 'settings-modal.js');
const PRELOAD = readSrc(ROOT, 'preload.js');
const { CODE_SHA256 } = require(path.join(ROOT, 'main', 'devtools-gate.js'));

function walk(dir, out = []) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(m?js|html|json|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

test('M1 ★main/ 어디에도 표준 role 「toggleDevTools」 가 없다(role 은 게이트를 우회한다)', () => {
  const files = [path.join(ROOT, 'main.js'), ...walk(path.join(ROOT, 'main'))];
  const hits = files.filter((f) => /role\s*:\s*['"]toggleDevTools['"]/.test(fs.readFileSync(f, 'utf8')));
  assert.deepStrictEqual(hits.map((f) => toPosix(path.relative(ROOT, f))), []);
  assert.match(WIRE, /devToolsMenuItem\(\{\s*isMac,\s*allowed:\s*devToolsAllowed/);
});

test('M2 ★main 프로세스에서 openDevTools 를 직접 부르는 곳은 devtools-gate.js 뿐이다', () => {
  const files = [path.join(ROOT, 'main.js'), ...walk(path.join(ROOT, 'main'))]
    .filter((f) => !f.endsWith(path.join('main', 'devtools-gate.js')));
  const hits = files.filter((f) => /\.openDevTools\s*\(/.test(fs.readFileSync(f, 'utf8')));
  assert.deepStrictEqual(hits.map((f) => toPosix(path.relative(ROOT, f))), []);
});

test('M3 F12 핸들러는 --enable-logging 조건이 아니라 게이트를 거친다', () => {
  const cw = sliceBlock(MAIN, 'function createWindow()');
  const h = sliceCall(cw, "mainWindow.webContents.on('before-input-event'");
  assert.match(h, /F12/);
  assert.match(h, /_devtoolsGate\.toggleFor\(mainWindow\.webContents\)/);
  // 옛 조건(argv 에 --enable-logging 일 때만 핸들러를 붙임)이 createWindow 안에 남아 있지 않다
  assert.ok(!/argv\.includes\(\s*['"]--enable-logging['"]\s*\)\s*\)\s*\{\s*mainWindow\.webContents\.on\('before-input-event'/.test(cw),
    '--enable-logging 이 F12 를 감싸면 안 된다');
});

test('M4 ★가드 등록(install)은 whenReady·createWindow «앞»에 있다', () => {
  const inst = MAIN.indexOf('_devtoolsGate.install(app)');
  const ready = MAIN.indexOf('app.whenReady()');
  const cw = MAIN.indexOf('\n  createWindow();');
  assert.ok(inst > 0 && ready > 0 && cw > 0);
  assert.ok(inst < ready, 'install 이 whenReady 보다 앞');
  assert.ok(inst < cw, 'install 이 createWindow() 호출보다 앞');
  // 메뉴는 게터를 받아 짓는다(옛 인자 없는 buildAppMenu() 호출이 남아 있지 않다)
  assert.ok(!/\bbuildAppMenu\(\)/.test(MAIN), '인자 없는 buildAppMenu() 는 개발자 도구를 늘 숨긴다');
  assert.match(MAIN, /isDevToolsAllowed:\s*\(\)\s*=>\s*_devtoolsGate\.isAllowed\(\)/);
});

test('M5 계정이 바뀌는 자리(로그인·구글·로그아웃·persistApplied)에서 메뉴/강제닫기를 다시 한다', () => {
  assert.match(sliceCall(MAIN, "ipcMain.handle('auth:logout'"), /_devtoolsAuthChanged\(\)/);
  assert.match(sliceCall(MAIN, "ipcMain.handle('auth:login'"), /_devtoolsAuthChanged\(\)/);
  assert.match(sliceCall(MAIN, "ipcMain.handle('auth:google-login'"), /_devtoolsAuthChanged\(\)/);
  assert.match(sliceBlock(MAIN, 'function persistApplied('), /_devtoolsAuthChanged\(\)/);
  assert.match(sliceBlock(MAIN, 'function _devtoolsAuthChanged('), /_devtoolsGate\.enforce\(\)/);
});

test('M6 ⛔권한 확대 금지: isAdminAuthorized 는 개발자 도구 판정과 섞이지 않는다', () => {
  const body = sliceBlock(MAIN, 'function isAdminAuthorized(');
  assert.ok(!/devtools|ADMIN_EMAIL|coq3820/i.test(body));
});

test('M7 ★관리자코드 평문이 레포 어디에도 없다(해시로 스캔 — 6~8자리 숫자 전수)', () => {
  const dirs = ['js', 'main', 'pages', 'services', 'tests', 'css'].map((d) => path.join(ROOT, d));
  const files = [...dirs.flatMap((d) => walk(d)), path.join(ROOT, 'main.js'), path.join(ROOT, 'preload.js'), path.join(ROOT, 'index.html')];
  const hits = [];
  for (const f of files) {
    let src = '';
    try { src = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
    const seen = new Set(src.match(/\d{4,8}/g) || []);
    for (const n of seen) {
      if (crypto.createHash('sha256').update(n).digest('hex') === CODE_SHA256) hits.push(toPosix(path.relative(ROOT, f)));
    }
  }
  assert.ok(files.length > 100, '스캔 대상이 비었으면 검사가 헛돈다');
  assert.deepStrictEqual(hits, []);
});

test('M8 톱니바퀴 「디버깅」 탭: 있고 · MVP 비활성 목록에 없고 · 진입 시 렌더 · 입력 키 격리', () => {
  assert.match(MODAL, /data-tab="debug">디버깅</);
  assert.match(MODAL, /data-pane="debug"/);
  const dis = MODAL.match(/const MVP_DISABLED_TABS = \[([^\]]*)\]/);
  assert.ok(dis, 'MVP_DISABLED_TABS 선언');
  assert.ok(!/debug/.test(dis[1]));
  assert.match(dis[1], /'dev'/);
  assert.match(MODAL, /if \(tab === 'debug'\) renderDebugPane\(\)/);
  const body = sliceBlock(MODAL, 'async function renderDebugPane(');
  assert.match(body, /type="password"/);
  assert.match(body, /inputmode="numeric"/);
  assert.match(body, /autocomplete="off"/);
  assert.match(body, /e\.stopPropagation\(\)/);
  assert.match(body, /코드가 맞지 않습니다/);
  assert.match(body, /잠시 후 다시 시도하세요/);
  assert.match(PRELOAD, /devtools:\s*\{[\s\S]*?devtools:state[\s\S]*?devtools:unlock[\s\S]*?devtools:open/);
});

/* ── 이벨류에이터 픽스 라운드(2026-09-19): «띄울 때 여는» 디버깅 길(CDP·inspect) ──
   ★main.js 의 차단 블록 «원문»을 잘라 가짜 app·process 로 «실행»한다 — 모양이 아니라 행동을 잰다. */
function runLaunchBlock({ packaged, argv = ['/A/GODITOR'], switches = [], env = {}, admin = false }) {
  const start = MAIN.indexOf('(function _blockDebugLaunchInPackaged()');
  assert.ok(start > 0, '차단 블록이 main.js 에 있다');
  const end = MAIN.indexOf('})();', start);
  const src = MAIN.slice(start, end + 5);
  const calls = { appExit: 0, procExit: 0 };
  class Exit extends Error {}
  const app = {
    isPackaged: packaged,
    commandLine: { hasSwitch: (s) => switches.includes(s) },
    exit: () => { calls.appExit++; },
  };
  const proc = { argv, execArgv: [], env, exit: () => { calls.procExit++; throw new Exit(); } };
  const req = (p) => (p === './main/devtools-gate' ? require(path.join(ROOT, 'main', 'devtools-gate.js')) : require(p));
  const quiet = { error() {}, warn() {}, log() {} };
  const fn = new Function('app', 'process', 'require', 'isAdminAuthorized', 'console', src);
  try { fn(app, proc, req, () => admin, quiet); } catch (e) { if (!(e instanceof Exit)) throw e; }
  return calls;
}

test('M9 ★배포판을 --remote-debugging-port/--inspect 로 띄우면 «뜨기 전에» 끈다 · dev·평범한 실행·운영자 admin 은 그대로', () => {
  // 배포판 + CDP → 종료
  let c = runLaunchBlock({ packaged: true, argv: ['/A/GODITOR', '--remote-debugging-port=9222', '--remote-allow-origins=*'] });
  assert.strictEqual(c.procExit, 1, 'CDP 인자면 종료');
  c = runLaunchBlock({ packaged: true, switches: ['remote-debugging-pipe'] });
  assert.strictEqual(c.procExit, 1, 'Chromium 스위치로 들어온 pipe 도 종료');
  c = runLaunchBlock({ packaged: true, argv: ['/A/GODITOR', '--inspect=9229'] });
  assert.strictEqual(c.procExit, 1, '메인 Node 디버거도 종료');
  // 배포판 + 평범한 실행 → 안 끈다
  c = runLaunchBlock({ packaged: true, argv: ['/A/GODITOR', '/Users/x/a.gdt'] });
  assert.strictEqual(c.procExit + c.appExit, 0, '평범한 실행은 그대로');
  // dev → CDP 여도 안 끈다(검증 흐름 보존)
  c = runLaunchBlock({ packaged: false, argv: ['e', '.', '--remote-debugging-port=9334', 'admin'] });
  assert.strictEqual(c.procExit + c.appExit, 0, 'dev 는 CDP 로 검증한다 — 건드리지 않는다');
  // 운영자 admin(인자+토큰+admin.allow) → 허용
  c = runLaunchBlock({ packaged: true, argv: ['/A/GODITOR', '--remote-debugging-port=9222', 'admin'], admin: true });
  assert.strictEqual(c.procExit + c.appExit, 0, '운영자 admin 은 허용');
});

test('M10 차단 블록 자리: path·fs 선언 뒤, userData 이사·크래시 기록기·단일인스턴스 잠금보다 앞', () => {
  const at = MAIN.indexOf('(function _blockDebugLaunchInPackaged()');
  assert.ok(at > MAIN.indexOf("const path = require('path')"), 'path 뒤');
  assert.ok(at > MAIN.indexOf("const fs = require('fs')"), 'fs 뒤');
  assert.ok(at < MAIN.indexOf('(function _migrateUserDataDir()'), '이사 앞');
  assert.ok(at < MAIN.indexOf("require('./main/crash')"), '크래시 기록기 앞');
  assert.ok(at < MAIN.indexOf('app.whenReady('), 'whenReady 앞');
  // ⛔조이는 테스트 훅(GODITOR_FORCE_PACKAGED_GATE)으로 «푸는» 길이 생기면 안 된다
  const end = MAIN.indexOf('})();', at);
  assert.ok(!/GODITOR_FORCE_PACKAGED_GATE|GODITOR_ALLOW/.test(MAIN.slice(at, end)), 'env 로 푸는 비상구 없음');
});

test('M11 빌드 퓨즈: RunAsNode·NODE_OPTIONS·--inspect(+SIGUSR1) 를 끈다', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const f = pkg.build && pkg.build.electronFuses;
  assert.ok(f, 'build.electronFuses 가 있다');
  assert.strictEqual(f.runAsNode, false);
  assert.strictEqual(f.enableNodeOptionsEnvironmentVariable, false);
  assert.strictEqual(f.enableNodeCliInspectArguments, false);
  // 퓨즈를 바꾸면 arm64 ad-hoc 서명이 깨질 수 있어 electron-builder 가 다시 서명하게 한다(T-056 2라운드)
  assert.strictEqual(f.resetAdHocDarwinSignature, true);
  // runAsNode=false 면 main 의 child_process.fork 가 깨진다 — 앱 코드에 fork 가 없어야 한다
  const files = ['main.js', ...walk(path.join(ROOT, 'main')).map(p => path.relative(ROOT, p)), ...walk(path.join(ROOT, 'services')).map(p => path.relative(ROOT, p))]
    .filter(p => /\.m?js$/.test(p));
  const code = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');   // 주석 제외(설명 문장은 사용처가 아니다)
  const forks = files.filter(p => /\bfork\s*\(|ELECTRON_RUN_AS_NODE/.test(code(p)));
  assert.deepStrictEqual(forks, [], 'main/services 에 fork·ELECTRON_RUN_AS_NODE 사용처 없음');
});

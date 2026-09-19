/* authservice-apibase — 「서버 주소를 배포본에서 못 바꾼다」
 *
 * ★막는 것: 위조자가 자기 서버(`{ok:true, signed:null}` 만 돌려주는 10줄짜리)를 띄우고
 *   `GODITOR_LICENSE_API` 로 앱을 그쪽에 붙이는 것. 앱의 「ok:true 인데 signed 없으면 통과」
 *   유예 규약이 «그대로» 발동해 통과한다 — 서명 도입으로 올린 난이도가 이 한 줄로 도로 내려간다.
 *   그리고 이 우회는 asar 를 뜯어 코드를 고치는 것보다 «쉽다».
 *
 * ★규약은 `resolveKeys`(services/entitlement.js)·`isAdminAuthorized`(main.js) 와 «같다» —
 *   미패키징에서만 env 허용, 패키징에선 무시. 새 규약이 아니다.
 *
 * ⛔네트워크 0 — global.fetch 를 갈아끼워 «어느 주소로 가려 했는지»만 본다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sliceBlock } from './_slice-block.js';
import { stripComments } from './_strip-comments.js';   // ★구간 떠내기는 «공용 부품»(_slice-block.js) 하나로 — ⛔여기서 자를 새로 만들지 마라(끝은 «균형괄호»로 찾는다)
import { createRequire } from 'node:module';
import { readSrc } from './_srcread.js';   // ★CRLF 체크아웃 방어(윈도우 core.autocrlf=true)

const require = createRequire(import.meta.url);
const A = require('../../services/authService.js');
const LIVE = A.LIVE_API_BASE;
const EVIL = 'http://127.0.0.1:9999';

/* ── ⓐ 개발 빌드: env 를 주면 그 주소를 쓴다 ─────────────────────────────── */

test('U-AB-1 ⓐ dev(!isPackaged) 는 env 주소를 «그대로» 쓴다', () => {
  assert.equal(A.resolveApiBase({ isPackaged: false, env: { GODITOR_LICENSE_API: EVIL } }), EVIL);
});

test('U-AB-2 ⓐ dev 라도 env 가 없으면 라이브다(폴백 없음)', () => {
  assert.equal(A.resolveApiBase({ isPackaged: false, env: {} }), LIVE);
});

/* ── ⓑ 패키징 빌드: env 를 줘도 무시하고 라이브 ──────────────────────────── */

test('U-AB-3 ★ⓑ 패키징은 env 주소를 «무시»한다', () => {
  assert.equal(A.resolveApiBase({ isPackaged: true, env: { GODITOR_LICENSE_API: EVIL } }), LIVE,
    '★배포본이 env 서버를 먹었다 — 위조자가 자기 서버로 통과한다');
});

test('U-AB-4 ★기본은 «막는» 쪽 — isPackaged 를 «안 주면» 패키징으로 본다', () => {
  assert.equal(A.resolveApiBase({ env: { GODITOR_LICENSE_API: EVIL } }), LIVE);
  assert.equal(A.resolveApiBase(), LIVE);
  assert.equal(A.resolveApiBase(null), LIVE);
});

test('U-AB-5 ★«false 를 닮은 값»으로는 안 열린다 (=== false 만 dev)', () => {
  for (const v of ['false', 0, '', null, undefined, 'no', [], {}]) {
    assert.equal(A.resolveApiBase({ isPackaged: v, env: { GODITOR_LICENSE_API: EVIL } }), LIVE,
      `isPackaged=${JSON.stringify(v)} 가 dev 로 통과했다`);
  }
});

/* ── ⓓ ★「패키징인가」의 근거를 사용자가 못 만든다 ──────────────────────────
 * env 로 「나는 dev 다」를 주장할 수 있으면 위 전부가 도로아미타불이다. */

test('U-AB-6 ★★ⓓ 어떤 env 로도 런타임 판정을 dev 로 못 돌린다', () => {
  const base = A._isPackagedRuntime();
  const saved = { ...process.env };
  const liars = {
    NODE_ENV: 'development', ELECTRON_IS_DEV: '1', GODITOR_DEV: '1',
    GODITOR_IS_PACKAGED: '0', ELECTRON_RUN_AS_NODE: '1', DEBUG: '*',
    npm_lifecycle_event: 'start', GODITOR_LICENSE_API: EVIL, GODITOR_PACKAGED: 'false',
  };
  try {
    Object.assign(process.env, liars);
    assert.equal(A._isPackagedRuntime(), base,
      '★env 가 「패키징인가」를 흔들었다 — 판정 근거가 사용자 손 안에 있다');
  } finally {
    for (const k of Object.keys(liars)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test('U-AB-7 ★ⓓ 판정 근거는 execPath 와 __dirname 뿐이다 (env 낱말이 소스에 없다)', () => {
  const src = readSrc(require.resolve('../../services/authService.js'));
  /* ★주석을 «먼저» 지운다 — 안 그러면 자기가 쓴 설명문에 걸려 빨개진다.
     ⛔2026-09-09: 여기 있던 거르개는 이 레포에서 «9벌이 같은 형태로» 부서져 있던 그 정규식
       (`/\/\*[\s\S]*?\*\//g`)이었다 — `image/*` 같은 문자열의 `/*` 를 주석 시작으로 읽고
       그 뒤를 삼킨다. 이름을 안 붙여 써서 strip-comments 가드(S-6)에도 안 걸리고 있었다.
       ⇒ 공용 거르개로 바꿨다. */
  const code = stripComments(src);
  /* ★0920 pkgguard: 판정 «표»는 순수 함수 packagedVerdict 로 뺐고, isPackagedRuntime 은 실제 값을 넣는 포장이다. */
  const fn = sliceBlock(code, 'function isPackagedRuntime');
  const verdict = sliceBlock(code, 'function packagedVerdict');
  assert.ok(fn.includes('process.execPath'), 'execPath 근거가 사라졌다');
  assert.ok(fn.includes('__dirname'), '__dirname 근거가 사라졌다');
  assert.ok(/asar/.test(verdict), 'asar 근거가 사라졌다');
  assert.ok(!/process\.env/.test(fn) && !/process\.env/.test(verdict), '★판정 함수가 env 를 읽는다 — 사용자가 답을 만들 수 있다');
  assert.ok(!/\bprocess\./.test(verdict), '★packagedVerdict 는 순수해야 한다(입력만 본다)');
});

/* ── 배선: applyRuntime 이 파생 URL «전부»를 따라오게 하는가 ───────────────── */

test('U-AB-8 ★ⓑ 패키징이면 실제 로그인 요청도 라이브로 간다 (LOGIN_URL 이 따라온다)', async () => {
  const realFetch = global.fetch;
  const hits = [];
  global.fetch = async (url) => { hits.push(String(url)); throw new Error('blocked-by-test'); };
  try {
    process.env.GODITOR_LICENSE_API = EVIL;

    A.applyRuntime({ isPackaged: false });
    assert.equal(A.API_BASE, EVIL, 'ⓐ dev 주입이 안 먹었다');
    await A.login('a@b.c', 'pw');
    assert.ok(hits.at(-1).startsWith(EVIL), `dev 인데 ${hits.at(-1)} 로 갔다`);

    A.applyRuntime({ isPackaged: true });
    assert.equal(A.API_BASE, LIVE, '★ⓑ 패키징인데 API_BASE 가 env 주소다');
    assert.equal(A.SIGNUP_URL, `${LIVE}/signup.html`, '★파생 URL 이 안 따라왔다');
    assert.equal(A.FIND_PASSWORD_URL, `${LIVE}/find-password.html`);
    await A.login('a@b.c', 'pw');
    assert.ok(hits.at(-1).startsWith(`${LIVE}/api/license/login`),
      `★패키징인데 ${hits.at(-1)} 로 갔다 — LOGIN_URL 이 옛 주소에 얼어붙었다`);
  } finally {
    global.fetch = realFetch;
    delete process.env.GODITOR_LICENSE_API;
    A.applyRuntime({ isPackaged: false });
  }
});

/* ── 런타임 판정 «동작» 검사 ────────────────────────────────────────────────
 * ★U-AB-6/7 은 판정의 «근거»만 봤다 — node 로 돌리면 항상 ⒞(=dev) 로 빠져서
 *   ⒜⒝ 가 «한 번도 실행되지 않는다». 그래서 자식 프로세스에서 execPath 와
 *   경로를 진짜 배포본처럼 위장해 «그 줄을 지나게» 만든다.
 *   ⛔안 하면 「검사가 있다」이지 「검사가 그 줄을 지난다」가 아니다. */
function probe({ execPath, electron, dir, applyFalse = false }) {
  const { execFileSync } = require('child_process');
  const svc = require.resolve('../../services/authService.js');
  const src = `
    Object.defineProperty(process, 'execPath', { value: ${JSON.stringify(execPath)} });
    ${electron ? "process.versions.electron = '30.0.0';" : "delete process.versions.electron;"}
    const Module = require('module');
    const _rf = Module._resolveFilename;
    const target = ${JSON.stringify(svc)};
    ${dir ? `
    const fs = require('fs');
    const src = fs.readFileSync(target, 'utf8');
    const m = new Module(${JSON.stringify(dir)} + '/authService.js', null);
    m.filename = ${JSON.stringify(dir)} + '/authService.js';
    m.paths = Module._nodeModulePaths(require('path').dirname(target));
    m._compile(src, m.filename);
    ${applyFalse ? "m.exports.applyRuntime({ isPackaged: false });" : ''}
    process.stdout.write(JSON.stringify({ base: m.exports.API_BASE, packaged: m.exports.isPackaged() }));
    ` : `process.stdout.write(JSON.stringify({ base: require(target).API_BASE, packaged: require(target).isPackaged() }));`}
  `;
  const out = JSON.parse(execFileSync(process.execPath, ['-e', src], {
    encoding: 'utf8', timeout: 15000,
    env: { ...process.env, GODITOR_LICENSE_API: EVIL },
  }));
  return applyFalse || dir ? out : out.base;   // 옛 검사(U-AB-9·10)는 주소 문자열만 본다
}

test('U-AB-9 ★ⓑ ⒝ Electron+앱 바이너리 이름 = 패키징 → env 무시', () => {
  assert.equal(
    probe({ execPath: '/Applications/GODITOR.app/Contents/MacOS/GODITOR', electron: true }),
    LIVE, '★배포 바이너리인데 env 서버를 먹었다');
});

test('U-AB-10 ⓐ ⒝ Electron + 실행파일이 electron = dev → env 를 쓴다', () => {
  assert.equal(
    probe({ execPath: '/r/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron', electron: true }),
    EVIL, 'dev 실행인데 env 가 막혔다 — stage 검증이 죽는다');
});

test('U-AB-11 ★ⓑ ⒜ asar 안이면 실행파일 이름과 무관하게 패키징', () => {
  assert.equal(
    probe({ execPath: '/r/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron',
            electron: true, dir: '/A/GODITOR.app/Contents/Resources/app.asar/services' }).base,
    LIVE, '★asar 안에서 도는데 dev 로 판정했다');
});

test('U-AB-12 ★applyRuntime 도 «=== false 만» dev 로 본다 (falsy 는 막는다)', () => {
  const saved = A.API_BASE;
  try {
    process.env.GODITOR_LICENSE_API = EVIL;
    for (const v of [0, '', null, undefined, NaN]) {
      A.applyRuntime({ isPackaged: v });
      assert.equal(A.API_BASE, LIVE, `isPackaged=${String(v)} 가 dev 로 통과했다`);
    }
    A.applyRuntime({});
    assert.equal(A.API_BASE, LIVE, '빈 객체가 dev 로 통과했다');
  } finally {
    delete process.env.GODITOR_LICENSE_API;
    A.applyRuntime({ isPackaged: false });
    assert.equal(A.API_BASE, saved);
  }
});

/* ═══ 0920 4라운드 pkgguard (T-063) — applyRuntime 이 asar 판정을 «덮지» 못한다 ═══════════════════
 * ★수정 전: main.js 가 applyRuntime({isPackaged: app.isPackaged}) 를 부르는데, 스톡 Electron 으로 app.asar 를
 *   띄우면 app.isPackaged=false → ⒜ 의 올바른 「패키징」 답이 dev 로 바뀌어 env 서버·.env·collab 이 열렸다. */

const STOCK_MAC = '/r/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron';

test('U-AB-13 ★★핵심 재현: asar 안 + applyRuntime({isPackaged:false}) 뒤에도 LIVE · isPackaged()=true', () => {
  const r = probe({ execPath: STOCK_MAC, electron: true, dir: '/tmp/x/app.asar/services', applyFalse: true });
  assert.equal(r.base, LIVE, '★applyRuntime(false) 가 asar 판정을 덮어 env 서버로 갔다');
  assert.equal(r.packaged, true, '★applyRuntime(false) 가 asar 판정을 dev 로 덮었다');
});

test('U-AB-14 ★윈도우 모양: C:\\GODITOR\\resources\\app.asar\\services + electron.exe → 패키징(applyRuntime false 로도)', () => {
  const r = probe({ execPath: 'C:\\tools\\electron.exe', electron: true, dir: 'C:\\GODITOR\\resources\\app.asar\\services', applyFalse: true });
  assert.equal(r.packaged, true, '★exe 이름을 electron.exe 로 바꾼 윈도우 실행을 dev 로 판정했다');
  assert.equal(r.base, LIVE);
});

test('U-AB-13b 음성대조: dev 폴더 로드 + Electron 바이너리 + applyRuntime(false) → dev 그대로(env 사용)', () => {
  const r = probe({ execPath: STOCK_MAC, electron: true, dir: '/Users/dev/web-editor/services', applyFalse: true });
  assert.equal(r.packaged, false, 'dev 가 막혔다');
  assert.equal(r.base, EVIL);
});

test('U-AB-16 ★★이름 바꾼 asar · 대문자 경로 + applyRuntime(false) → 패키징(LIVE) — 4라운드 픽스 재현', () => {
  for (const dir of ['/tmp/x/goditor.asar/services', '/tmp/x/APP.ASAR/services', 'C:\\G\\resources\\Goditor.Asar\\services']) {
    const r = probe({ execPath: STOCK_MAC, electron: true, dir, applyFalse: true });
    assert.equal(r.packaged, true, `★${dir} 를 dev 로 판정했다`);
    assert.equal(r.base, LIVE, `★${dir} 에서 env 서버로 갔다`);
  }
});

test('U-AB-15 ★packagedVerdict 표', () => {
  const V = A.packagedVerdict;
  const rows = [
    // [설명, 입력, 기대]
    ['dev 폴더 + electron', { dirname: '/Users/d/web-editor/services', execPath: STOCK_MAC, isElectron: true }, false],
    ['스톡 Electron + asar', { dirname: '/tmp/x/app.asar/services', execPath: STOCK_MAC, isElectron: true }, true],
    ['exe 이름 변경 + asar(윈)', { dirname: 'C:\\G\\resources\\app.asar\\services', execPath: 'C:\\G\\electron.exe', isElectron: true }, true],
    ['app.asar.unpacked', { dirname: '/A/GODITOR.app/Contents/Resources/app.asar.unpacked/services', execPath: STOCK_MAC, isElectron: true }, true],
    ['asar 루트 바로(끝)', { dirname: '/tmp/x/app.asar', execPath: STOCK_MAC, isElectron: true }, true],
    ['앱 바이너리 이름', { dirname: '/Users/d/web-editor/services', execPath: '/Applications/GODITOR.app/Contents/MacOS/GODITOR', isElectron: true }, true],
    ['윈 앱 바이너리', { dirname: 'C:\\dev\\services', execPath: 'C:\\P\\GODITOR\\GODITOR.exe', isElectron: true }, true],
    // ★4라운드 픽스: 파일 이름만 바꾸거나(스톡 Electron 은 확장자 .asar 면 로드) 대문자 경로로 불러도 배포판
    ['★이름 바꾼 asar(goditor.asar)', { dirname: '/tmp/x/goditor.asar/services', execPath: STOCK_MAC, isElectron: true }, true],
    ['★대문자 경로(APP.ASAR, 윈)', { dirname: 'C:\\x\\APP.ASAR\\services', execPath: 'Electron.exe', isElectron: true }, true],
    ['★섞인 대소문자(App.Asar.Unpacked)', { dirname: '/tmp/x/App.Asar.Unpacked/services', execPath: STOCK_MAC, isElectron: true }, true],
    ['★이름 바꾼 asar 루트 바로(끝)', { dirname: 'D:\\z\\evil.ASAR', execPath: 'C:\\e\\electron.exe', isElectron: true }, true],
    ['비슷한 이름(x.asarbak)은 아님', { dirname: '/tmp/x.asarbak/services', execPath: STOCK_MAC, isElectron: true }, false],
    ['비슷한 이름(app.asarx)은 아님', { dirname: '/tmp/app.asarx/services', execPath: STOCK_MAC, isElectron: true }, false],
    ['node 단위검사(⒞)', { dirname: '/Users/d/web-editor/services', execPath: '/usr/local/bin/node', isElectron: false }, false],
    ['빈 입력', {}, false],
    // ⚠️알려진 한계 고정 — asar 를 «풀어» 폴더로 스톡 Electron 에 띄우면 dev 로 판정된다(README «한계»).
    //   이 줄이 빨개지면(=막게 됐으면) 한계 문서도 같이 고쳐라.
    ['⚠️한계: asar 를 풀어 폴더로 실행', { dirname: '/tmp/extracted/app/services', execPath: STOCK_MAC, isElectron: true }, false],
  ];
  for (const [name, input, want] of rows) assert.equal(V(input), want, name);
  assert.equal(V(null), false);
});

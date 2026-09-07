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
  /* ★주석을 «먼저» 지운다 — 안 그러면 자기가 쓴 설명문에 걸려 빨개진다. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const body = code.slice(code.indexOf('function isPackagedRuntime'));
  const fn = body.slice(0, body.indexOf('\n}') + 2);
  assert.ok(fn.includes('process.execPath'), 'execPath 근거가 사라졌다');
  assert.ok(/asar/.test(fn), 'asar 근거가 사라졌다');
  assert.ok(!/process\.env/.test(fn), '★판정 함수가 env 를 읽는다 — 사용자가 답을 만들 수 있다');
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
function probe({ execPath, electron, dir }) {
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
    process.stdout.write(m.exports.API_BASE);
    ` : `process.stdout.write(require(target).API_BASE);`}
  `;
  return execFileSync(process.execPath, ['-e', src], {
    encoding: 'utf8', timeout: 15000,
    env: { ...process.env, GODITOR_LICENSE_API: EVIL },
  });
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
            electron: true, dir: '/A/GODITOR.app/Contents/Resources/app.asar/services' }),
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

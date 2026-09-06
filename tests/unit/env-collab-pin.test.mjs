/* env-collab-pin — 「배포본은 사용자가 쓸 수 있는 파일·env 로 열리지 않는다」(E2-c)
 *
 * ★막는 것 둘 (2026-09-06 실측, 둘 다 `isPackaged` 분기가 «없었다»)
 *   ⑴ main.js 가 `~/.config/secrets/.env` 를 조건 없이 읽었다 → 사용자가 «자기 홈에 한 줄»
 *      쓰는 것만으로 `GODITOR_LICENSE_API`·`GODITOR_ENTITLEMENT_PUBKEY`·`GODITOR_ADMIN_TOKEN`
 *      게이트가 전부 열렸다. 그 게이트들을 「패키징에선 무시」로 막아 둔 근거가
 *      「env 우회는 asar 를 뜯는 것보다 쉽다」였는데, 이건 그보다 «더» 쉬웠다.
 *   ⑵ `main/collab/transport.js` 가 `GODITOR_COLLAB_API` 로 collab API 전체를 딴 데로 돌렸다.
 *      authService 쪽 주소를 라이브로 못박아도(E2-b) 협업 경로가 통째로 새 나갔다.
 *
 * ★규약은 `resolveApiBase`(authService)·`resolveKeys`(entitlement)·`isAdminAuthorized`(main.js)
 *   와 «같다» — 미패키징만 env 허용, 패키징에선 무시. 새 규약이 아니다.
 *
 * ★그리고 판정은 «한 벌»이다: `authService.isPackaged()`. 이 파일의 ⓓ 묶음이 그걸 «센다».
 * ⛔네트워크 0. 진짜 홈 디렉터리·진짜 process.env 를 건드리지 않는다(전부 주입).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const A = require('../../services/authService.js');
const ENVFILE = require('../../main/env-file.js');
const TRANSPORT = require('../../main/collab/transport.js');
const LIVE = A.LIVE_API_BASE;
const EVIL = 'http://127.0.0.1:9999';

/** 주석을 «먼저» 지운 소스. ⛔안 지우면 자기가 쓴 설명문에 검사가 걸린다. */
function codeOf(rel) {
  const src = fs.readFileSync(require.resolve(rel), 'utf8');
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/** 임시 .env 두 개를 만들고 경로를 돌려준다. */
function makeEnvFiles(tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `e2c-${tag}-`));
  const appEnv = path.join(dir, 'app.env');
  const homeEnv = path.join(dir, 'home.env');
  fs.writeFileSync(appEnv, '# c\nGODITOR_LICENSE_API=' + EVIL + '\nGEMINI_API_KEY=devkey\n', 'utf8');
  fs.writeFileSync(homeEnv, 'GODITOR_ADMIN_TOKEN=zzz\nGODITOR_ENTITLEMENT_PUBKEY=evilpem\n', 'utf8');
  return { dir, files: [appEnv, homeEnv] };
}

/* ═══ ⓐ 개발 빌드 — 지금 동작 그대로 ═══════════════════════════════════════ */

test('U-E2C-1 ⓐ dev 는 .env 를 «읽는다» (개발자 편의 보존)', () => {
  const { files } = makeEnvFiles('dev');
  const env = {};
  try {
    A.applyRuntime({ isPackaged: false });
    const r = ENVFILE.loadDevEnvFiles({ files, env });
    assert.equal(r.skipped, false, '★dev 인데 .env 를 건너뛰었다 — 개발자 키가 죽는다');
    assert.equal(env.GEMINI_API_KEY, 'devkey');
    assert.equal(env.GODITOR_LICENSE_API, EVIL);
    assert.equal(env.GODITOR_ADMIN_TOKEN, 'zzz', '두 번째 파일(~/.config/secrets)도 읽어야 한다');
    assert.equal(r.count, 4);
  } finally { A.applyRuntime({ isPackaged: false }); }
});

test('U-E2C-2 ⓐ dev 는 GODITOR_COLLAB_API 가 «먹는다» (가짜 서버 검증 보존)', () => {
  const saved = process.env.GODITOR_COLLAB_API;
  try {
    process.env.GODITOR_COLLAB_API = EVIL;
    A.applyRuntime({ isPackaged: false });
    assert.equal(TRANSPORT.collabBase(), `${EVIL}/api/collab`);
    assert.equal(TRANSPORT.BASE, `${EVIL}/api/collab`, '옛 이름 BASE 도 따라와야 한다');
  } finally {
    if (saved === undefined) delete process.env.GODITOR_COLLAB_API; else process.env.GODITOR_COLLAB_API = saved;
    A.applyRuntime({ isPackaged: false });
  }
});

/* ═══ ⓑ 패키징 빌드 — 막힌다 ═══════════════════════════════════════════════ */

test('U-E2C-3 ★ⓑ 패키징은 .env 를 «한 줄도» 안 읽는다', () => {
  const { files } = makeEnvFiles('pkg');
  const env = {};
  try {
    A.applyRuntime({ isPackaged: true });
    const r = ENVFILE.loadDevEnvFiles({ files, env });
    assert.equal(r.skipped, true, '★배포본이 .env 를 읽었다 — 홈에 한 줄이면 모든 env 게이트가 열린다');
    assert.equal(r.count, 0);
    assert.deepEqual(Object.keys(env), [], `★배포본이 ${Object.keys(env)} 를 주입했다`);
  } finally { A.applyRuntime({ isPackaged: false }); }
});

test('U-E2C-4 ★ⓑ 패키징은 GODITOR_COLLAB_API 를 «무시»하고 라이브로 간다', () => {
  const saved = process.env.GODITOR_COLLAB_API;
  try {
    process.env.GODITOR_COLLAB_API = EVIL;
    A.applyRuntime({ isPackaged: true });
    assert.equal(TRANSPORT.collabBase(), `${LIVE}/api/collab`,
      '★배포본 collab 이 env 서버로 갔다 — 세션·초대·문서가 위조 서버로 흐른다');
    assert.equal(TRANSPORT.BASE, `${LIVE}/api/collab`);
  } finally {
    if (saved === undefined) delete process.env.GODITOR_COLLAB_API; else process.env.GODITOR_COLLAB_API = saved;
    A.applyRuntime({ isPackaged: false });
  }
});

test('U-E2C-5 ★ⓑ 실제 요청도 라이브로 간다 (BASE 가 옛 주소에 얼어붙지 않는다)', async () => {
  const realFetch = global.fetch;
  const saved = process.env.GODITOR_COLLAB_API;
  const hits = [];
  global.fetch = async (url) => { hits.push(String(url)); throw new Error('blocked-by-test'); };
  try {
    process.env.GODITOR_COLLAB_API = EVIL;
    A.applyRuntime({ isPackaged: false });
    await TRANSPORT.request('join', {}).catch(() => {});
    assert.ok(hits.at(-1).startsWith(EVIL), `ⓐ dev 인데 ${hits.at(-1)} 로 갔다`);

    A.applyRuntime({ isPackaged: true });
    await TRANSPORT.request('join', {}).catch(() => {});
    assert.ok(hits.at(-1).startsWith(`${LIVE}/api/collab/join`),
      `★패키징인데 ${hits.at(-1)} 로 갔다`);
  } finally {
    global.fetch = realFetch;
    if (saved === undefined) delete process.env.GODITOR_COLLAB_API; else process.env.GODITOR_COLLAB_API = saved;
    A.applyRuntime({ isPackaged: false });
  }
});

test('U-E2C-6 ★«false 를 닮은 값»으로는 안 열린다 (=== false 만 dev)', () => {
  const saved = process.env.GODITOR_COLLAB_API;
  const { files } = makeEnvFiles('falsy');
  try {
    process.env.GODITOR_COLLAB_API = EVIL;
    for (const v of [0, '', 'false', null, undefined, NaN, 'no']) {
      A.applyRuntime({ isPackaged: v });
      assert.equal(A.isPackaged(), true, `isPackaged=${String(v)} 가 dev 로 통과했다`);
      assert.equal(TRANSPORT.collabBase(), `${LIVE}/api/collab`, `collab: isPackaged=${String(v)}`);
      const env = {};
      assert.equal(ENVFILE.loadDevEnvFiles({ files, env }).skipped, true, `.env: isPackaged=${String(v)}`);
    }
    A.applyRuntime({});
    assert.equal(A.isPackaged(), true, '빈 객체가 dev 로 통과했다');
  } finally {
    if (saved === undefined) delete process.env.GODITOR_COLLAB_API; else process.env.GODITOR_COLLAB_API = saved;
    A.applyRuntime({ isPackaged: false });
  }
});

/* ═══ ⓓ ★판정이 «한 벌»인가 — 기계로 센다 ═════════════════════════════════ */

test('U-E2C-7 ★★ⓓ 판정을 «내리는» 곳은 authService 하나다 (소비자는 부르기만)', () => {
  const svc = codeOf('../../services/authService.js');
  // 판정 «생산»: 근거(asar 경로·execPath)를 읽는 함수는 이 파일에 한 개뿐이다.
  assert.equal((svc.match(/function isPackagedRuntime/g) || []).length, 1,
    '★런타임 판정 함수가 하나가 아니다');
  assert.equal((svc.match(/process\.execPath/g) || []).length, 1, '★execPath 근거가 여러 벌이다');

  // 판정 «소비»: 두 소비자는 근거를 다시 만들지 않고 isPackaged() 를 부른다.
  for (const rel of ['../../main/env-file.js', '../../main/collab/transport.js']) {
    const c = codeOf(rel);
    assert.match(c, /isPackaged\(\)/, `${rel} 가 한 벌짜리 판정을 안 쓴다`);
    assert.ok(!/app\.isPackaged/.test(c), `★${rel} 가 판정을 «따로» 내린다(app.isPackaged)`);
    assert.ok(!/process\.execPath/.test(c), `★${rel} 가 판정을 «따로» 내린다(execPath)`);
    assert.ok(!/asar/.test(c), `★${rel} 가 판정을 «따로» 내린다(asar 경로검사)`);
  }
});

test('U-E2C-8 ★ⓓ main.js 는 .env 를 «직접» 읽지 않고 게이트를 통과해 읽는다', () => {
  const c = codeOf('../../main.js');
  assert.match(c, /require\('\.\/main\/env-file'\)\.loadDevEnvFiles\(/,
    '★main.js 가 게이트를 안 부른다 — .env 가 안 읽히거나 게이트 없이 읽힌다');
  assert.ok(!/_loadEnvFile\s*\(/.test(c),
    '★main.js 에 게이트를 우회하는 .env 읽기가 남아 있다');
  // applyRuntime(=판정 주입)이 .env 로드보다 «먼저» 와야 한다 — 게이트가 그 답을 본다.
  assert.ok(c.indexOf('applyRuntime') < c.indexOf('loadDevEnvFiles'),
    '★.env 로드가 판정 주입보다 먼저다 — 게이트가 기본값으로 판정한다');
});

/* ═══ ⓒ ★그 줄을 «실제로» 지나게 한다 ═════════════════════════════════════
 * 위 검사들은 `applyRuntime` 으로 답을 «주입»해서 잰다. 진짜 배포본에선 아무도
 * 주입 안 해도 `isPackagedRuntime()` 의 ⒜⒝ 가 막아야 한다 — 그런데 node 로 돌리면
 * 늘 ⒞(=dev)로 빠져서 ⒜⒝ 가 «한 번도 실행되지 않는다».
 * ⇒ 자식 프로세스에서 execPath·경로를 배포본처럼 위장하고, authService 를 그 상태로
 *   컴파일해 require.cache 에 꽂아 두 소비자가 «그 인스턴스»를 쓰게 만든다. */
function probe({ execPath, electron, svcDir }) {
  const { execFileSync } = require('child_process');
  const svc = require.resolve('../../services/authService.js');
  const { files } = makeEnvFiles('probe');
  const src = `
    Object.defineProperty(process, 'execPath', { value: ${JSON.stringify(execPath)} });
    ${electron ? "process.versions.electron = '30.0.0';" : "delete process.versions.electron;"}
    const path = require('path'), fs = require('fs'), Module = require('module');
    const real = ${JSON.stringify(svc)};
    const fake = ${svcDir ? JSON.stringify(svcDir) : 'path.dirname(real)'} + '/authService.js';
    const m = new Module(fake, null);
    m.filename = fake;
    m.paths = Module._nodeModulePaths(path.dirname(real));
    m._compile(fs.readFileSync(real, 'utf8'), fake);
    m.loaded = true;
    require.cache[real] = m;                 // ← 두 소비자가 이 인스턴스를 본다
    const A = require(real);
    const ENVFILE = require(${JSON.stringify(require.resolve('../../main/env-file.js'))});
    const T = require(${JSON.stringify(require.resolve('../../main/collab/transport.js'))});
    const env = {};
    const r = ENVFILE.loadDevEnvFiles({ files: ${JSON.stringify(files)}, env });
    process.stdout.write(JSON.stringify({
      packaged: A.isPackaged(), apiBase: A.API_BASE, collab: T.collabBase(),
      envSkipped: r.skipped, envKeys: Object.keys(env),
    }));
  `;
  const out = execFileSync(process.execPath, ['-e', src], {
    encoding: 'utf8', timeout: 20000,
    env: { ...process.env, GODITOR_COLLAB_API: EVIL, GODITOR_LICENSE_API: EVIL },
  });
  return JSON.parse(out);
}

const APP_EXE = '/Applications/GODITOR.app/Contents/MacOS/GODITOR';
const DEV_EXE = '/r/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron';
const ASAR_DIR = '/A/GODITOR.app/Contents/Resources/app.asar/services';

test('U-E2C-9 ★ⓒ ⒝ 배포 바이너리 이름 → .env·collab env 둘 다 막힌다 (주입 없이)', () => {
  const r = probe({ execPath: APP_EXE, electron: true });
  assert.equal(r.packaged, true, '★배포 바이너리를 dev 로 판정했다');
  assert.equal(r.envSkipped, true, `★배포본이 .env 를 읽었다 (${r.envKeys})`);
  assert.deepEqual(r.envKeys, []);
  assert.equal(r.collab, `${LIVE}/api/collab`, '★배포본 collab 이 env 서버로 갔다');
  assert.equal(r.apiBase, LIVE);
});

test('U-E2C-10 ★ⓒ ⒜ asar 안이면 실행파일 이름과 무관하게 막힌다', () => {
  const r = probe({ execPath: DEV_EXE, electron: true, svcDir: ASAR_DIR });
  assert.equal(r.packaged, true, '★asar 안에서 도는데 dev 로 판정했다');
  assert.equal(r.envSkipped, true, `★asar 안인데 .env 를 읽었다 (${r.envKeys})`);
  assert.equal(r.collab, `${LIVE}/api/collab`);
});

test('U-E2C-11 ⓐⓒ dev 실행(Electron 바이너리)에선 둘 다 살아 있다', () => {
  const r = probe({ execPath: DEV_EXE, electron: true });
  assert.equal(r.packaged, false, 'dev 실행을 패키징으로 판정했다 — 개발이 막힌다');
  assert.equal(r.envSkipped, false, 'dev 인데 .env 를 건너뛰었다');
  assert.ok(r.envKeys.includes('GEMINI_API_KEY'), 'dev 개발자 키가 안 들어왔다');
  assert.equal(r.collab, `${EVIL}/api/collab`, 'dev 인데 GODITOR_COLLAB_API 가 막혔다');
});

test('U-E2C-14 ★ⓒ authService 가 «부분 스텁»이면 답을 못 얻은 것 → 막는 쪽으로 간다', () => {
  /* ★검사 하네스가 실제로 그렇게 한다(tests/unit/entitlement-ipc.test.mjs 는 authService 를
     login/verifySession 만 든 객체로 갈아끼운다). 그때 조용히 열리면 «검사가 돌 때만»
     열리는 문이 생긴다. main.js 가 applyRuntime 을 typeof 로 감싸 부르는 것과 같은 규약. */
  const { execFileSync } = require('child_process');
  const { files } = makeEnvFiles('stub');
  const svc = require.resolve('../../services/authService.js');
  const src = `
    const p = ${JSON.stringify(svc)};
    require.cache[p] = { id: p, filename: p, loaded: true,
      exports: { login: async () => null, verifySession: async () => null, API_BASE: 'http://127.0.0.1:1' } };
    const ENVFILE = require(${JSON.stringify(require.resolve('../../main/env-file.js'))});
    const T = require(${JSON.stringify(require.resolve('../../main/collab/transport.js'))});
    const env = {};
    const r = ENVFILE.loadDevEnvFiles({ files: ${JSON.stringify(files)}, env });
    process.stdout.write(JSON.stringify({ envSkipped: r.skipped, envKeys: Object.keys(env), collab: T.collabBase() }));
  `;
  const r = JSON.parse(execFileSync(process.execPath, ['-e', src], {
    encoding: 'utf8', timeout: 20000,
    env: { ...process.env, GODITOR_COLLAB_API: EVIL },
  }));
  assert.equal(r.envSkipped, true, `★부분 스텁이 .env 게이트를 열었다 (${r.envKeys})`);
  assert.deepEqual(r.envKeys, []);
  assert.equal(r.collab, 'http://127.0.0.1:1/api/collab', '★부분 스텁이 collab env 게이트를 열었다');
});

/* ═══ ⓔ 배포본에서 «사용자 자기 키» 경로가 살아 있는가 ═══════════════════════
 * .env 를 안 읽어도 AI 기능이 죽으면 안 된다. 사용자 키는 settings.json →
 * main.js `getApiKey()` → `payload.apiKey` 로 들어오며 이 경로와 «무관»하다.
 * ⇒ 서비스들이 payload.apiKey 를 «먼저» 보는지, env 없이도 통과하는지 «실행»으로 잰다. */

test('U-E2C-12 ★ⓔ env 가 «비어도» payload.apiKey 로 AI 호출이 나간다', async () => {
  const realFetch = global.fetch;
  const savedKeys = {};
  const ENVK = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'OPENAI_API_KEY_GODITOR', 'ANTHROPIC_API_KEY'];
  for (const k of ENVK) { savedKeys[k] = process.env[k]; delete process.env[k]; }
  const hits = [];
  global.fetch = async (url, init) => {
    hits.push({ url: String(url), init });
    return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
  };
  try {
    const gemini = require('../../services/geminiService.js');
    const openai = require('../../services/openaiService.js');
    const anthropic = require('../../services/anthropicService.js');
    const blocks = [{ id: 'b1', text: 'x' }];
    await gemini.fillSectionTexts({ apiKey: 'USERKEY-G', blocks }).catch(() => {});
    await openai.fillSectionTexts({ apiKey: 'USERKEY-O', blocks }).catch(() => {});
    await anthropic.fillSectionTexts({ apiKey: 'USERKEY-A', blocks }).catch(() => {});
    const all = JSON.stringify(hits);
    assert.ok(hits.length >= 3, `★env 없이 AI 호출이 «안 나갔다» (${hits.length}건) — 배포본에서 AI 가 죽는다`);
    assert.ok(all.includes('USERKEY-G'), 'gemini: 사용자 키가 안 실렸다');
    assert.ok(all.includes('USERKEY-O'), 'openai: 사용자 키가 안 실렸다');
    assert.ok(all.includes('USERKEY-A'), 'anthropic: 사용자 키가 안 실렸다');
  } finally {
    global.fetch = realFetch;
    for (const k of ENVK) { if (savedKeys[k] === undefined) delete process.env[k]; else process.env[k] = savedKeys[k]; }
  }
});

test('U-E2C-13 ★ⓔ 이미지 생성도 payload.apiKey 만으로 선다 (env 무관)', () => {
  const c = codeOf('../../services/imageGenService.js');
  assert.match(c, /payload\?\.apiKey/, '★이미지 생성이 사용자 키 경로를 잃었다');
  // main.js 가 그 키를 «주입»하는 자리가 살아 있는가
  const m = codeOf('../../main.js');
  assert.match(m, /aiGenerateImage\(\{ \.\.\.payload, apiKey: apiKeyOverride \}\)/,
    '★main.js 가 사용자 키를 이미지 생성에 안 넘긴다');
  assert.match(m, /if \(s\?\.apiKeys\?\.\[provider\]\) return s\.apiKeys\[provider\];/,
    '★settings.json 사용자 키가 env 보다 «먼저»가 아니다');
});

/* ★E2E-HARDCODED-FORBIDDEN-PORT-9345-01 (S6-T7 ③ · 2026-10-25) — «앱을 띄우는 길이 GODITOR_MCP_PORT 를 준다»를 잰다.
   ⛔「포트가 9345 가 아니다」로 재지 않는다 — 그건 우연히 통과한다(9345 가 이미 잡혀 있으면 앱이 9346 으로 번진다). «넘겼나»를 잰다.
   구조: tests 안에서 앱을 띄우는 자리는 helpers.launchElectron «하나»뿐이고, 그것이 env 를 맨 뒤에 덮어 쓴다.
   세 자:
     ⑴ 가로채기 — 가짜 playwright 위에서 helpers 의 띄우개(launchElectron · launchIsolated · launchApp)를 불러
        _electron.launch 가 «받은 인자»의 env 를 본다(앱은 안 띄운다 · fs 쓰기·자격증명 복사는 막는다).
     ⑵ 전수 — tests 전체의 «날글자»(주석·문자열 안 걷는다)에서 `_electron` 은 helpers.js 의 두 줄(받기 ＋ launchElectron 몸)뿐,
        tests/e2e 에는 electron 을 이름·경로로 직접 띄우는 글자가 없다.
        ★날글자로 재는 까닭: 따옴표 키·정규식·템플릿·계산 키·별칭 어느 꼴로 써도 `_electron` 글자는 남는다
          (독립 평가 S6-T7 이 주석/문자열 걷기 판에서 거짓 초록 7＋9 를 냈다 — 걷기가 정규식·템플릿에서 깨졌다).
        ⚠️못 재는 길(이름): 글자를 쪼개 붙이기('_elec'+'tron') · tests/unit 의 electron 문자열(스텁용이라 범위 밖) —
          E2E-LAUNCH-CENSUS-SPLIT-TOKEN-01 · E2E-LAUNCH-CENSUS-SCOPE-UNIT-ELECTRON-01
     ⑶ ⑵ 의 자가 «속지 않는다» — 독립 평가가 낸 반례들을 그대로 먹여 본다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const HELPERS = path.join(ROOT, 'tests', 'e2e', 'helpers.js');
const HELPERS_REL = 'tests/e2e/helpers.js';
/* helpers.js 에서 `_electron` 이 있어도 되는 두 줄 — 글자째 */
const ALLOWED_LINES = [
  "const { chromium, _electron } = require('@playwright/test');",
  'return _electron.launch({ ...opts, env });',
];
const PROFILE = '/nonexistent/s6-t7-probe';

/** helpers.js 를 «가짜 playwright» 위에서 새로 읽어 fn(h) 를 부른다. fs 쓰기·자격증명 복사는 막는다. */
async function withFakeHelpers(fn, { envOverride = {} } = {}) {
  const pwPath = require.resolve('@playwright/test', { paths: [path.dirname(HELPERS)] });
  const seen = { launch: [], copied: 0, mkdir: 0 };
  const fakeApp = {
    evaluate: async () => PROFILE,
    close: async () => {},
    firstWindow: async () => ({ waitForLoadState: async () => {} }),
  };
  const fake = { chromium: {}, _electron: { launch: async (o) => { seen.launch.push(o); return fakeApp; } } };
  const savedPw = require.cache[pwPath];
  const savedHelpers = require.cache[HELPERS];
  const saved = { mkdirSync: fs.mkdirSync, copyFileSync: fs.copyFileSync, existsSync: fs.existsSync };
  const savedEnv = {};
  for (const k of Object.keys(envOverride)) {
    savedEnv[k] = process.env[k];
    if (envOverride[k] === undefined) delete process.env[k]; else process.env[k] = envOverride[k];
  }
  require.cache[pwPath] = { id: pwPath, filename: pwPath, loaded: true, exports: fake };
  delete require.cache[HELPERS];
  fs.mkdirSync = () => { seen.mkdir++; };
  fs.copyFileSync = () => { seen.copied++; };
  fs.existsSync = (p) => (String(p).endsWith('auth.json') ? false : saved.existsSync(p));
  try {
    const h = require(HELPERS);
    let err = null;
    try { await fn(h); } catch (e) { err = e; }
    return { seen, err };
  } finally {
    Object.assign(fs, saved);
    for (const k of Object.keys(savedEnv)) {
      if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k];
    }
    if (savedPw) require.cache[pwPath] = savedPw; else delete require.cache[pwPath];
    delete require.cache[HELPERS];
    if (savedHelpers) require.cache[HELPERS] = savedHelpers;
  }
}
const isolated = (mcpPort) => (h) => h.launchIsolated({ port: 9614, profile: PROFILE, mcpPort });

test('⑴a launchIsolated 는 _electron.launch 에 env.GODITOR_MCP_PORT = 부른 쪽이 준 값을 넘긴다', async () => {
  const { seen, err } = await withFakeHelpers(isolated(9615));
  assert.equal(err, null, `던지면 안 된다: ${err && err.message}`);
  assert.equal(seen.launch.length, 1, 'launch 가 한 번 불려야 한다(가로채기가 붙었다는 양성대조)');
  const env = seen.launch[0].env;
  assert.ok(env, '★launch 인자에 env 가 없다 — 앱이 MCP 를 9345 부터 잡는다');
  assert.equal(env.GODITOR_MCP_PORT, '9615');
  assert.equal(env.PATH, process.env.PATH, 'env 는 process.env 를 이어받아야 한다(PATH 등을 잃으면 앱이 못 뜬다)');
});

test('⑴b mcpPort 를 안 주거나 띠(9610~9629) 밖이면 «띄우기 전»에 던진다 — 프로필·자격증명도 안 만진다', async () => {
  for (const bad of [undefined, '', '9345', 9334, 9609, 9630, 'x', 9615.5]) {
    const { seen, err } = await withFakeHelpers(isolated(bad));
    assert.ok(err && /GODITOR_MCP_PORT/.test(err.message), `mcpPort=${bad} 에서 던져야 한다`);
    assert.deepEqual([seen.launch.length, seen.mkdir, seen.copied], [0, 0, 0], `mcpPort=${bad}: launch·mkdir·copy 0 이어야 한다`);
  }
  for (const ok of [9610, '9629']) {
    const { seen, err } = await withFakeHelpers(isolated(ok));
    assert.equal(err, null, `띠 끝 ${ok} 는 받아야 한다`);
    assert.equal(seen.launch[0].env.GODITOR_MCP_PORT, String(ok));
  }
});

test('⑴c launchElectron — 부른 쪽이 opts.env 로 덮으려 해도 GODITOR_MCP_PORT 가 남는다 · 다른 인자는 그대로 간다', async () => {
  const a = await withFakeHelpers((h) => h.launchElectron({ args: ['.', 'x'], cwd: '/c', env: { PATH: '/only' } }, 9616));
  assert.equal(a.err, null, a.err && a.err.message);
  const o = a.seen.launch[0];
  assert.deepEqual([o.args, o.cwd, o.env.GODITOR_MCP_PORT, o.env.PATH], [['.', 'x'], '/c', '9616', process.env.PATH]);
  const b = await withFakeHelpers((h) => h.launchElectron({ args: ['.'] }, undefined));
  assert.ok(b.err && b.seen.launch.length === 0, 'mcpPort 없으면 launch 0 으로 던져야 한다');
});

test('⑴d launchApp(옛 9334 길)도 E2E_MCP_PORT 를 넘긴다 · 없으면 띄우기 전에 던진다', async () => {
  const a = await withFakeHelpers((h) => h.launchApp(), { envOverride: { E2E_MCP_PORT: '9617' } });
  assert.equal(a.err, null, a.err && a.err.message);
  assert.equal(a.seen.launch[0].env.GODITOR_MCP_PORT, '9617');
  const b = await withFakeHelpers((h) => h.launchApp(), { envOverride: { E2E_MCP_PORT: undefined } });
  assert.ok(b.err && /GODITOR_MCP_PORT/.test(b.err.message) && b.seen.launch.length === 0, 'E2E_MCP_PORT 없으면 launch 0 으로 던져야 한다');
});

/** files: { rel: text } → 어긋남 목록(빈 배열 = 통과). 날글자로 잰다. */
function audit(files) {
  const bad = [];
  for (const [rel, text] of Object.entries(files)) {
    const lines = text.split('\n');
    lines.forEach((l, i) => {
      if (!l.includes('_electron')) return;
      const ok = rel === HELPERS_REL && ALLOWED_LINES.includes(l.trim()) && l.split('_electron').length === 2;
      if (!ok) bad.push(`${rel}:${i + 1} _electron 글자 — 띄우는 자리는 helpers.launchElectron 하나뿐이어야 한다: ${l.trim().slice(0, 90)}`);
    });
    if (rel === HELPERS_REL) {
      for (const want of ALLOWED_LINES) {
        const n = lines.filter(l => l.trim() === want).length;
        if (n !== 1) bad.push(`${rel} 「${want}」 가 ${n} 줄 — 정확히 1 이어야 한다`);
      }
    }
    if (rel.startsWith('tests/e2e/')) {
      const re = /['"`]([^'"`\n]*\/)?electron(\.cmd|\.exe)?['"`]|require\.resolve\s*\(\s*['"`]electron/g;
      for (let m; (m = re.exec(text));) bad.push(`${rel}:${text.slice(0, m.index).split('\n').length} electron 을 이름·경로로 부른다(직접 띄우는 길)`);
    }
  }
  return bad;
}

function treeFiles() {
  const out = {};
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.(c?js|mjs|ts|sh)$/.test(e.name) && f !== __filename) out[path.relative(ROOT, f).split(path.sep).join('/')] = fs.readFileSync(f, 'utf8');
  } };
  walk(path.join(ROOT, 'tests'));
  return out;
}

test('⑵ tests 전체 날글자 전수 — `_electron` 은 helpers 두 줄뿐 · tests/e2e 에 electron 직접 띄우기 0', () => {
  const files = treeFiles();
  const n = Object.keys(files).length;
  /* 「0건」이 «못 찾은» 게 아님을 먼저 보인다 — helpers 가 읽혔고, 허락된 두 줄이 거기 있다 */
  assert.ok(n > 100 && files[HELPERS_REL], `파일 ${n} 개 · helpers 읽힘 ${!!files[HELPERS_REL]} — 검사가 대상을 놓쳤다`);
  assert.equal(files[HELPERS_REL].split('_electron').length - 1, 2, 'helpers 안 `_electron` 글자 = 2(받기 ＋ launchElectron 몸)');
  assert.deepEqual(audit(files), []);
});

test('⑶ ⑵ 의 자는 반례에 속지 않는다 — 지금 helpers 는 통과 · 독립 평가 반례는 전부 걸린다', () => {
  const H = fs.readFileSync(HELPERS, 'utf8');
  assert.deepEqual(audit({ [HELPERS_REL]: H }), [], '지금 helpers 가 걸렸다');
  const E = 'tests/e2e/zz.spec.js';
  const BAD = {
    /* 1차 평가(a7ee6ab7) 반례 */
    shorthand: { [E]: "const { _electron } = require('@playwright/test');\nasync function a(){ const env = process.env; return _electron.launch({ env }); }" },
    alias: { [E]: "const { _electron: E } = require('@playwright/test');\nE.launch({});" },
    bracket: { [E]: "pw._electron['launch']({});" },
    spawnRequire: { [E]: "spawn(require.resolve('electron'), ['.']);" },
    helperRelaunch: { [HELPERS_REL]: H.replace('async function launchElectron', "function relaunchRaw(env){ return _electron.launch({ args: ['.'], env }); }\nasync function launchElectron") },
    /* 2차 평가(21141dfd) 반례 */
    quotedKey: { [E]: "async function a(){ return pw._electron.launch({ env: mcpPortEnv(9615), 'env': process.env }); }" },
    regexBreaksStrip: { [E]: "const re = /\\/*/;\nconst { _electron } = require('@playwright/test');\n_electron.launch({ args: ['.'] });" },
    regexQuote: { [E]: "const re = /'/; _electron.launch({ args: ['.'] });" },
    templateExpr: { [E]: "const s = `${(await _electron.launch({args:['.']})) && 'x'}`;" },
    stringToken: { [E]: "pw['_electron'].launch({});" },
    computedDestructure: { [E]: "const { ['_electron']: E } = require('@playwright/test'); E.launch({});" },
    spawnByName: { [E]: "spawn('npx', ['electron', '.']);" },
    spawnByPath: { [E]: "spawn('node_modules/.bin/electron', ['.']);" },
    keySpill: { [HELPERS_REL]: H.replace('async function launchElectron', "const relaunchRaw = () => _electron.launch({ args: ['.'] });\nasync function launchElectron") },
    /* launchElectron 몸에서 env 를 opts 앞에 두면 부른 쪽이 덮을 수 있다 — 허락된 줄과 글자가 달라져 걸린다 */
    envFirst: { [HELPERS_REL]: H.replace('return _electron.launch({ ...opts, env });', 'return _electron.launch({ env, ...opts });') },
    secondImport: { [HELPERS_REL]: H + "\nconst { chromium, _electron } = require('@playwright/test');" },
  };
  for (const [k, files] of Object.entries(BAD)) {
    const r = audit(files);
    console.log(`⑶ ${k}: ${JSON.stringify(r).slice(0, 160)}`);
    assert.ok(r.length > 0, `반례 ${k} 가 «초록»으로 샜다`);
  }
});

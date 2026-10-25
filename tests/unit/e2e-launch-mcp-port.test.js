/* ★E2E-HARDCODED-FORBIDDEN-PORT-9345-01 (S6-T7 ③ · 2026-10-25) — «_electron.launch 가 GODITOR_MCP_PORT 를 준다»를 잰다.
   ⛔「포트가 9345 가 아니다」로 재지 않는다 — 그건 우연히 통과한다(9345 가 이미 잡혀 있으면 앱이 9346 으로 번진다). «넘겼나»를 잰다.
   두 자:
     ⑴ 가로채기 — helpers.launchIsolated 를 부르고 _electron.launch 가 «받은 인자»의 env 를 본다(앱은 안 띄운다).
     ⑵ 전수 — tests/e2e 의 _electron.launch 자리를 «전부» 찾아, 각 자리가 mcpPortEnv(...) 로 만든 env 를 넘기는지 본다.
        안 넘기는 자리는 «이름 붙은 예외»와 정확히 같아야 한다 — 새 자리가 env 없이 생기면 여기서 빨개진다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const HELPERS = path.join(ROOT, 'tests', 'e2e', 'helpers.js');

/* ⛔고치지 않은 자리 — 고칠지는 지디 판정(보고에서 묻는다). 줄이 바뀌어도 함수 이름으로 가린다. */
const KNOWN_NO_ENV = {
  'tests/e2e/helpers.js#launchApp': 'E2E-LAUNCHAPP-9334-NO-MCP-ENV-01 — 9334 하드코딩 옛 길 · 고칠지 지디 판정',
};

/** helpers.js 를 «가짜 playwright» 위에서 새로 읽어 launchIsolated 한 번을 부른다. fs 쓰기·자격증명 복사는 막는다. */
async function callLaunchIsolated(opts) {
  const pwPath = require.resolve('@playwright/test', { paths: [path.dirname(HELPERS)] });
  const seen = { launch: [], copied: 0, mkdir: 0 };
  const fake = {
    chromium: {},
    _electron: {
      launch: async (o) => { seen.launch.push(o); return { evaluate: async () => opts.profile, close: async () => {} }; },
    },
  };
  const savedPw = require.cache[pwPath];
  const savedHelpers = require.cache[HELPERS];
  const saved = { mkdirSync: fs.mkdirSync, copyFileSync: fs.copyFileSync, existsSync: fs.existsSync };
  require.cache[pwPath] = { id: pwPath, filename: pwPath, loaded: true, exports: fake };
  delete require.cache[HELPERS];
  fs.mkdirSync = () => { seen.mkdir++; };
  fs.copyFileSync = () => { seen.copied++; };
  fs.existsSync = (p) => (String(p).endsWith('auth.json') ? false : saved.existsSync(p));
  try {
    const h = require(HELPERS);
    let err = null;
    try { await h.launchIsolated(opts); } catch (e) { err = e; }
    return { seen, err };
  } finally {
    Object.assign(fs, saved);
    if (savedPw) require.cache[pwPath] = savedPw; else delete require.cache[pwPath];
    delete require.cache[HELPERS];
    if (savedHelpers) require.cache[HELPERS] = savedHelpers;
  }
}

test('⑴a launchIsolated 는 _electron.launch 에 env.GODITOR_MCP_PORT = 부른 쪽이 준 값을 넘긴다', async () => {
  const { seen, err } = await callLaunchIsolated({ port: 9614, profile: '/nonexistent/s6-t7-probe', mcpPort: 9615 });
  assert.equal(err, null, `던지면 안 된다: ${err && err.message}`);
  assert.equal(seen.launch.length, 1, 'launch 가 한 번 불려야 한다(가로채기가 붙었다는 양성대조)');
  const env = seen.launch[0].env;
  assert.ok(env, '★launch 인자에 env 가 없다 — 앱이 MCP 를 9345 부터 잡는다');
  assert.equal(env.GODITOR_MCP_PORT, '9615');
  assert.equal(env.PATH, process.env.PATH, 'env 는 process.env 를 이어받아야 한다(PATH 등을 잃으면 앱이 못 뜬다)');
});

test('⑴b mcpPort 를 안 주거나 띠(9610~9629) 밖이면 «띄우기 전»에 던진다 — 프로필·자격증명도 안 만진다', async () => {
  for (const bad of [undefined, '', '9345', 9334, 9609, 9630, 'x']) {
    const { seen, err } = await callLaunchIsolated({ port: 9614, profile: '/nonexistent/s6-t7-probe', mcpPort: bad });
    assert.ok(err && /GODITOR_MCP_PORT/.test(err.message), `mcpPort=${bad} 에서 던져야 한다`);
    assert.deepEqual([seen.launch.length, seen.mkdir, seen.copied], [0, 0, 0], `mcpPort=${bad}: launch·mkdir·copy 0 이어야 한다`);
  }
  for (const ok of [9610, '9629']) {
    const { seen, err } = await callLaunchIsolated({ port: 9614, profile: '/nonexistent/s6-t7-probe', mcpPort: ok });
    assert.equal(err, null, `띠 끝 ${ok} 는 받아야 한다`);
    assert.equal(seen.launch[0].env.GODITOR_MCP_PORT, String(ok));
  }
});

/** tests/e2e 아래 .js/.mjs 의 _electron.launch( 자리 전수 → [{ key, file, line, passesEnv }] */
function launchSites() {
  const dir = path.join(ROOT, 'tests', 'e2e');
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(d, e.name)); else if (/\.(c?js|mjs)$/.test(e.name)) files.push(path.join(d, e.name)); } };
  walk(dir);
  const out = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const re = /_electron\.launch\s*\(/g; let m;
    while ((m = re.exec(src))) {
      let i = m.index + m[0].length, depth = 1;
      while (i < src.length && depth) { if (src[i] === '(') depth++; else if (src[i] === ')') depth--; i++; }
      const argText = src.slice(m.index + m[0].length, i - 1);
      const before = src.slice(0, m.index);
      const fnStart = Math.max(before.lastIndexOf('async function'), before.lastIndexOf('test.beforeAll('));
      const scope = before.slice(fnStart);
      const fnName = (scope.match(/^async function\s+(\w+)/) || [, scope.startsWith('test.beforeAll(') ? 'beforeAll' : '?'])[1];
      const envKey = /(^|[,{\s])env\s*(,|\}|$)/m.test(argText) ? 'shorthand' : (/(^|[,{\s])env\s*:\s*mcpPortEnv\s*\(/m.test(argText) ? 'inline' : null);
      const passesEnv = envKey === 'inline' || (envKey === 'shorthand' && /const\s+env\s*=[^;]*\bmcpPortEnv\s*\(/.test(scope));
      out.push({ key: `${path.relative(ROOT, f)}#${fnName}`, line: before.split('\n').length, passesEnv });
    }
  }
  return out;
}

test('⑵ tests/e2e 의 _electron.launch 자리 전수 — mcpPortEnv 로 만든 env 를 안 넘기는 자리 = 이름 붙은 예외와 정확히 같다', () => {
  const sites = launchSites();
  /* 「0건」이 «못 찾은» 게 아님을 먼저 보인다 — 2026-10-25 실측 넷(helpers launchApp·launchIsolated · 12 · 13) */
  assert.ok(sites.length >= 4, `launch 자리를 ${sites.length} 개만 찾았다 — 검사가 대상을 놓쳤다:\n${JSON.stringify(sites)}`);
  for (const k of ['tests/e2e/helpers.js#launchIsolated', 'tests/e2e/12-insert-seam-settle.spec.js#beforeAll', 'tests/e2e/13-undo-family.spec.js#beforeAll']) {
    assert.ok(sites.some(s => s.key === k), `고친 자리 ${k} 를 못 찾았다`);
  }
  const missing = sites.filter(s => !s.passesEnv).map(s => s.key).sort();
  assert.deepEqual(missing, Object.keys(KNOWN_NO_ENV).sort(),
    `GODITOR_MCP_PORT 를 안 넘기는 launch 자리:\n  ${sites.filter(s => !s.passesEnv).map(s => `${s.key} :${s.line}`).join('\n  ')}`);
});

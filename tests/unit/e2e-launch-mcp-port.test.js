/* ★E2E-HARDCODED-FORBIDDEN-PORT-9345-01 (S6-T7 ③ · 2026-10-25) — «_electron.launch 가 GODITOR_MCP_PORT 를 준다»를 잰다.
   ⛔「포트가 9345 가 아니다」로 재지 않는다 — 그건 우연히 통과한다(9345 가 이미 잡혀 있으면 앱이 9346 으로 번진다). «넘겼나»를 잰다.
   두 자:
     ⑴ 가로채기 — helpers.launchIsolated 를 부르고 _electron.launch 가 «받은 인자»의 env 를 본다(앱은 안 띄운다).
     ⑵ 전수 — tests 아래 _electron.launch 자리를 «전부» 찾아, 각 자리의 인자 안에 «env: mcpPortEnv(...)» 가 바로 있는지 본다.
        안 넘기는 자리는 «이름 붙은 예외»와 정확히 같아야 한다 — 새 자리가 env 없이 생기면 여기서 빨개진다.
        ★주석·문자열은 걷고 잰다. 다른 데서 만든 env(축약 `env` · `env: x` · 펼침 뒤 덮어쓰기)는 «안 넘김»으로 친다.
        ★_electron 을 별칭·괄호로 부르거나 require('electron') 으로 직접 띄우면 «못 재는 길»이라 그것도 빨강이다.
     ⑶ ⑵ 의 자가 «속지 않는다» — 독립 평가(S6-T7)가 낸 거짓 초록 반례들을 그대로 먹여 본다. */
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

/** 주석을 걷는다(문자열은 둔다) · 그리고 문자열 속을 빈칸으로 바꾼 판도 만든다 — 길이는 그대로(줄 번호가 맞게). */
function views(src) {
  let code = '', blank = '', i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); const e = j < 0 ? n : j + 2; const w = src.slice(i, e).replace(/[^\n]/g, ' '); code += w; blank += w; i = e; continue; }
    if (c === '/' && d === '/') { let j = src.indexOf('\n', i); if (j < 0) j = n; const w = ' '.repeat(j - i); code += w; blank += w; i = j; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1; while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      const e = Math.min(j + 1, n); const lit = src.slice(i, e);
      code += lit; blank += c + lit.slice(1, -1).replace(/[^\n]/g, ' ') + (e - i > 1 ? c : ''); i = e; continue;
    }
    code += c; blank += c; i++;
  }
  return { code, blank };
}

/** 소스 하나를 잰다 → { sites:[{fn,line,ok,why}], bad:[까닭] } */
function auditSource(src) {
  const { code, blank } = views(src);
  const lineOf = (k) => src.slice(0, k).split('\n').length;
  const bad = [];
  /* 직접 띄우는 길 — 이 자로는 env 를 못 잰다 */
  const reEl = /\brequire\s*\(\s*['"]electron['"]\s*\)|\bfrom\s+['"]electron['"]|\bimport\s*\(\s*['"]electron['"]\s*\)/g;
  for (let m; (m = reEl.exec(code));) bad.push(`:${lineOf(m.index)} electron 을 직접 불러온다(못 재는 길)`);
  /* _electron 은 «구조분해로 받기» 와 «_electron.launch(» 둘만 허락 */
  const reTok = /\b_electron\b/g;
  for (let m; (m = reTok.exec(blank));) {
    const after = blank.slice(m.index + 9);
    if (/^\s*\.\s*launch\s*\(/.test(after)) continue;
    if (/^\s*[,}]/.test(after) && /[{,]\s*$/.test(blank.slice(0, m.index))) continue;
    bad.push(`:${lineOf(m.index)} _electron 을 별칭·괄호·값으로 쓴다(못 재는 길)`);
  }
  const sites = [];
  const reL = /\b_electron\s*\.\s*launch\s*\(/g;
  for (let m; (m = reL.exec(blank));) {
    let i = m.index + m[0].length, depth = 1;
    const start = i;
    while (i < blank.length && depth) {
      const ch = blank[i];
      if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
      i++;
    }
    const arg = blank.slice(start, i - 1);
    /* 이름 붙은 예외를 가리는 열쇠 — 앞쪽에서 가장 가까운 «function 이름» 또는 test.beforeAll */
    const encl = blank.slice(0, m.index).match(/(?:function\s+(\w+)|(test\.beforeAll)\s*\()(?![\s\S]*(?:function\s+\w+|test\.beforeAll\s*\())/) || [];
    const fn = encl[1] || (encl[2] ? 'beforeAll' : '?');
    let why = null;
    const o = arg.indexOf('{');
    // 한 겹(객체 바로 안) 글자만 남긴다 — 안쪽 괄호 속은 빈칸
    let d = 0, flat = '';
    for (let k = o; k >= 0 && k < arg.length; k++) { const ch = arg[k]; if ('([{'.includes(ch)) { d++; if (d > 1) { flat += ' '; continue; } } else if (')]}'.includes(ch)) { d--; if (d >= 1) { flat += ' '; continue; } } if (d === 1 || (d === 0 && ch === '}')) flat += d === 1 ? ch : ''; else flat += ' '; }
    const envKeys = (flat.match(/(^|[{,\s])env\s*(?=[:,}]|$)/g) || []).length;
    const spread = /\.\.\./.test(flat);
    const m2 = /(^|[{,\s])env\s*:\s*mcpPortEnv\s*\(/.exec(arg.slice(o));
    if (o < 0) why = '인자가 객체가 아니다';
    else if (spread) why = '인자 한 겹에 펼침(...)이 있다 — env 를 덮을 수 있다';
    else if (envKeys !== 1) why = `env 열쇠가 ${envKeys} 개`;
    else if (!m2) why = 'env 값이 mcpPortEnv(...) 가 아니다';
    else {
      // mcpPortEnv( … ) 가 닫힌 바로 뒤가 , 또는 } 여야 한다(덧셈·속성 접근 금지)
      let k = o + m2.index + m2[0].length, dd = 1;
      while (k < arg.length && dd) { if (arg[k] === '(') dd++; else if (arg[k] === ')') dd--; k++; }
      if (!/^\s*[,}]/.test(arg.slice(k))) why = 'mcpPortEnv(...) 뒤에 무언가 붙었다';
    }
    sites.push({ fn, line: lineOf(m.index), ok: !why, why });
  }
  return { sites, bad };
}

/** tests 아래 .js/.mjs/.cjs 전수(node_modules · 이 파일 제외) */
function auditTree() {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else if (/\.(c?js|mjs)$/.test(e.name) && f !== __filename) files.push(f); } };
  walk(path.join(ROOT, 'tests'));
  const sites = [], bad = [];
  for (const f of files) {
    const rel = path.relative(ROOT, f);
    const r = auditSource(fs.readFileSync(f, 'utf8'));
    for (const s of r.sites) sites.push({ key: `${rel}#${s.fn}`, ...s });
    for (const b of r.bad) bad.push(rel + b);
  }
  return { files: files.length, sites, bad };
}

test('⑵ tests 의 _electron.launch 자리 전수 — env: mcpPortEnv(...) 를 안 넘기는 자리 = 이름 붙은 예외와 정확히 같다 · 못 재는 길 0', () => {
  const { files, sites, bad } = auditTree();
  /* 「0건」이 «못 찾은» 게 아님을 먼저 보인다 — 2026-10-25 실측 넷(helpers launchApp·launchIsolated · 12 · 13) */
  assert.ok(files > 50 && sites.length >= 4, `파일 ${files} · launch 자리 ${sites.length} — 검사가 대상을 놓쳤다:\n${JSON.stringify(sites)}`);
  for (const k of ['tests/e2e/helpers.js#launchIsolated', 'tests/e2e/12-insert-seam-settle.spec.js#beforeAll', 'tests/e2e/13-undo-family.spec.js#beforeAll']) {
    assert.ok(sites.some(s => s.key === k && s.ok), `고친 자리 ${k} 가 «넘김»으로 안 잡힌다: ${JSON.stringify(sites.filter(s => s.key === k))}`);
  }
  assert.deepEqual(bad, [], '못 재는 길이 있다');
  const missing = sites.filter(s => !s.ok).map(s => s.key).sort();
  assert.deepEqual(missing, Object.keys(KNOWN_NO_ENV).sort(),
    `GODITOR_MCP_PORT 를 안 넘기는 launch 자리:\n  ${sites.filter(s => !s.ok).map(s => `${s.key} :${s.line} — ${s.why}`).join('\n  ')}`);
});

test('⑶ ⑵ 의 자는 반례에 속지 않는다 — 좋은 꼴 셋은 통과 · 거짓 초록 반례는 전부 걸린다', () => {
  const GOOD = {
    inline: "const { test, _electron } = require('@playwright/test');\nasync function a(){ return _electron.launch({ args: ['.', ...x], cwd, env: mcpPortEnv(p) }); }",
    destructured: "test.beforeAll(async () => { const { mcpPortEnv } = require('./helpers.js'); app = await _electron.launch({ args: ['.'], env: mcpPortEnv(process.env.E2E_MCP_PORT) }); });",
  };
  const BAD = {
    shorthandFromProcess: "async function a(){ const env = process.env; return _electron.launch({ env }); }",
    commentBorrow: "async function a(){ // const env = mcpPortEnv(9615)\n const env = process.env; return _electron.launch({ args:['.'], env }); }",
    envProcess: "async function a(){ return _electron.launch({ env: process.env }); }",
    noEnv: "const f = () => _electron.launch({ args: ['.'] });",
    arrowBorrow: "async function a(){ const env = mcpPortEnv(9615); }\nconst r = (env) => _electron.launch({ env });",
    overrideAfterSpread: "async function a(){ return _electron.launch({ env: { ...mcpPortEnv(9615), GODITOR_MCP_PORT: '' } }); }",
    topSpread: "async function a(){ return _electron.launch({ env: mcpPortEnv(9615), ...o }); }",
    twoEnv: "async function a(){ return _electron.launch({ env: mcpPortEnv(9615), env: process.env }); }",
    tailed: "async function a(){ return _electron.launch({ env: mcpPortEnv(9615) && process.env }); }",
    alias: "const { _electron: E } = require('@playwright/test');\nE.launch({});",
    bracket: "pw._electron['launch']({});",
    valueAlias: "const E = _electron; E.launch({});",
    spawnElectron: "spawn(require('electron'), ['.']);",
    helperRelaunch: "async function launchIsolated(){ mcpPortEnv(p); return _electron.launch({ cwd, env: mcpPortEnv(p) }); }\nfunction relaunchRaw(env){ return _electron.launch({ args: ['.'], env }); }",
  };
  for (const [k, src] of Object.entries(GOOD)) {
    const r = auditSource(src);
    assert.ok(r.sites.length === 1 && r.sites[0].ok && r.bad.length === 0, `좋은 꼴 ${k} 가 걸렸다: ${JSON.stringify(r)}`);
  }
  for (const [k, src] of Object.entries(BAD)) {
    const r = auditSource(src);
    const caught = r.bad.length > 0 || r.sites.some(s => !s.ok);
    console.log(`⑶ ${k}: ${JSON.stringify(r.bad.concat(r.sites.filter(s => !s.ok).map(s => s.why)))}`);
    assert.ok(caught, `반례 ${k} 가 «초록»으로 샜다: ${JSON.stringify(r)}`);
  }
});

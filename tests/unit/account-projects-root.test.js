/* 계정별 프로젝트 뿌리(<userData>/accounts/<계정키>/projects) — ★«진짜 파일시스템»에 돌려서 잰다.
   ⛔소스 문자열 검사로 하지 않는다. 「그렇게 적혀 있다」는 「그렇게 돈다」가 아니다.
     main.js 는 Electron 없이는 통째로 못 읽으니, 해당 블록만 «떼어내» 실제 fs 위에서 실행한다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { readSrc } = require('./_srcread.js');   // ★CRLF 체크아웃 방어(윈도우 core.autocrlf=true)
const SRC = readSrc(__dirname, '..', '..', 'main.js');

/* 주석을 «통째로» 지운다 — 줄 단위로 지우면 블록 주석 «안쪽»이 남아 코드로 세어진다
   (오늘 아침 D7 에서 그걸로 가짜 빨강을 냈다). 문자열 안의 // 는 여기선 문제가 안 된다. */
function stripComments(src) {
  return String(src).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const BEGIN = 'const PROJECTS_DIR_LEGACY = path.join(USER_DATA_DIR, \'projects\');';
const END = "_repointProjectsDir('startup');";

function extractBlock(src = SRC) {
  const i = src.indexOf(BEGIN);
  const j = src.indexOf(END, i);
  assert.ok(i >= 0, '★블록 시작을 못 찾았다 — 검사가 «대상을 놓친» 것이지 통과가 아니다');
  assert.ok(j > i, '★블록 끝을 못 찾았다');
  return src.slice(i, j + END.length);
}

/* 떼어낸 블록을 «진짜 fs»와 임시 userData 위에서 실행한다. */
function load({ email = null, block = extractBlock(), userData = null, authThrows = false } = {}) {
  const ud = userData || fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-acct-'));
  /* ★readAuthOrThrow 를 흉내낸다 — «파일 없음(null)»과 «못 읽음(throw)»을 가르는 함수다.
     그게 이 판의 핵심이라, 하네스가 그 둘을 «따로» 만들 수 있어야 한다. */
  const readAuthOrThrow = () => { if (authThrows) throw new Error('auth.json 깨짐'); return email ? { email } : null; };
  const factory = new Function(
    'path', 'fs', 'USER_DATA_DIR', 'migrateFiles', '__dirname', 'readAuthOrThrow', 'require', 'console',
    block + `
    ; return {
        _accountKeyFor, _currentAccountKey, _accountProjectsDir, _repointProjectsDir,
        _adoptLegacyIfSoleAccount, _existingAccountKeys, _legacyProjectEntries, _projectsRoot,
        get PROJECTS_DIR() { return PROJECTS_DIR; },
        get state() { return _projectsDirState; },
        PROJECTS_DIR_LEGACY, ACCOUNTS_DIR, PROJECTS_DIR_UNRESOLVED,
      };`
  );
  const api = factory(path, fs, ud, () => {}, ud, readAuthOrThrow, require, { log() {}, warn() {}, error() {} });
  return { ud, api, setEmail(e) { email = e; }, setAuthThrows(v) { authThrows = v; } };
}

const mkproj = (root, id) => {
  fs.mkdirSync(path.join(root, id), { recursive: true });
  fs.writeFileSync(path.join(root, id, 'proj.json'), JSON.stringify({ id, name: id }));
};

/* ── M1 비로그인이면 레거시 공용 풀 ─────────────────────────────────────── */
test('M1 비로그인 = 레거시 공용 풀 (지금 되던 것이 계속 된다)', () => {
  const { ud, api } = load({ email: null });
  assert.strictEqual(api.PROJECTS_DIR, path.join(ud, 'projects'));
});

/* ── M2 로그인하면 «계정 폴더»로 간다 ───────────────────────────────────── */
test('M2 로그인 = <userData>/accounts/<키>/projects 로 간다', () => {
  const { ud, api } = load({ email: 'chulsoo@example.com' });
  const key = api._accountKeyFor('chulsoo@example.com');
  assert.strictEqual(api.PROJECTS_DIR, path.join(ud, 'accounts', key, 'projects'));
  assert.ok(fs.existsSync(api.PROJECTS_DIR), '뿌리 폴더가 «실제로» 만들어져야 한다');
});

/* ── M3 ★본론: 민수는 철수 프로젝트를 «뿌리에서부터» 못 본다 ─────────────── */
test('M3 ★다른 계정의 프로젝트는 «목록의 뿌리»가 달라 보이지 않는다', () => {
  const h = load({ email: 'chulsoo@example.com' });
  mkproj(h.api.PROJECTS_DIR, 'proj_1111');            // 철수가 만든 것
  const chulsooRoot = h.api.PROJECTS_DIR;

  h.setEmail('minsoo@example.com');
  h.api._repointProjectsDir('login');                  // 민수 로그인
  const minsooRoot = h.api.PROJECTS_DIR;

  assert.notStrictEqual(minsooRoot, chulsooRoot);
  assert.deepStrictEqual(fs.readdirSync(minsooRoot), [], '★민수 뿌리에 철수 것이 있으면 안 된다');
  assert.ok(fs.existsSync(path.join(chulsooRoot, 'proj_1111')), '철수 것은 «지워지지 않고» 그대로 있어야 한다');
});

/* ── M4 로그아웃하면 레거시로 돌아온다 ──────────────────────────────────── */
test('M4 로그아웃 = 레거시 풀로 복귀 (계정 것이 안 보이는 게 맞다)', () => {
  const h = load({ email: 'chulsoo@example.com' });
  mkproj(h.api.PROJECTS_DIR, 'proj_2222');
  h.setEmail(null);
  h.api._repointProjectsDir('logout');
  assert.strictEqual(h.api.PROJECTS_DIR, h.api.PROJECTS_DIR_LEGACY);
  assert.ok(!fs.existsSync(path.join(h.api.PROJECTS_DIR, 'proj_2222')));
});

/* ── M5 ★기존 데이터가 «사라지지 않는다» — 첫 계정이 물려받는다 ─────────── */
test('M5 ★업데이트 전 프로젝트는 첫 로그인 계정이 물려받는다 (갤러리가 비지 않는다)', () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-acct-'));
  const legacy = path.join(ud, 'projects');
  mkproj(legacy, 'proj_9001'); mkproj(legacy, 'proj_9002');   // 업데이트 이전 데이터

  const { api } = load({ email: 'hyunbin@example.com', userData: ud });
  const got = fs.readdirSync(api.PROJECTS_DIR).sort();
  assert.deepStrictEqual(got, ['proj_9001', 'proj_9002'], '★2건이 그대로 따라와야 한다');
  assert.deepStrictEqual(fs.readdirSync(legacy).filter(n => /^proj_/.test(n)), [], '레거시는 비워진다(복사 아닌 이동)');

  const rec = JSON.parse(fs.readFileSync(path.join(ud, 'accounts', api._accountKeyFor('hyunbin@example.com'), 'adopted.json'), 'utf8'));
  assert.strictEqual(rec.moved, 2, '★옮긴 사실이 기록돼야 되돌릴 수 있다');
  assert.ok(rec.from && rec.to, '되돌릴 «어디에서 어디로»가 적혀야 한다');
});

/* ── M6 ★두 번째 계정은 물려받지 못한다 (남의 것일 수 있다) ─────────────── */
test('M6 ★계정 폴더가 이미 있으면 레거시를 «가져가지 않는다»', () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-acct-'));
  const legacy = path.join(ud, 'projects');

  const h = load({ email: 'chulsoo@example.com', userData: ud });   // 철수가 먼저(레거시 빈 상태)
  mkproj(legacy, 'proj_7777');                                       // 그 뒤에 레거시에 뭔가 생겼다

  h.setEmail('minsoo@example.com');
  const st = h.api._repointProjectsDir('login');
  assert.strictEqual(st.adopt.adopted, 0);
  assert.strictEqual(st.adopt.skipped, 'other-accounts-exist');
  assert.ok(fs.existsSync(path.join(legacy, 'proj_7777')), '★레거시 것은 그대로 남아야 한다');
});

/* ── M7 같은 이메일은 대소문자·공백이 달라도 «같은 폴더» ────────────────── */
test('M7 같은 계정이면 대소문자/공백이 달라도 같은 뿌리', () => {
  const { api } = load({ email: 'a@b.com' });
  assert.strictEqual(api._accountKeyFor('  A@B.CoM '), api._accountKeyFor('a@b.com'));
  assert.notStrictEqual(api._accountKeyFor('a@b.com'), api._accountKeyFor('a@c.com'));
  assert.match(api._accountKeyFor('a@b.com'), /^acct_[a-z0-9._-]+_[0-9a-f]{8}$/,
    '★폴더 이름만 보고 누구 것인지 알 수 있어야 한다(그게 폴더로 가른 이유 ⑵)');
});

/* ── M8 경로에 못 쓸 글자가 폴더 이름을 깨지 않는다 ─────────────────────── */
test('M8 이메일에 이상한 글자가 있어도 경로가 안 새어 나간다', () => {
  const { ud, api } = load({ email: '../../evil@x.com' });
  assert.ok(!api._accountKeyFor('../../evil@x.com').includes('/'), '★슬래시가 남으면 탈출이 된다');
  assert.ok(api.PROJECTS_DIR.startsWith(path.join(ud, 'accounts')), '뿌리는 accounts 밖으로 못 나간다');
});

/* ── M9 ★뿌리를 «값으로 붙잡아 두는» 자리가 남아 있지 않다 ─────────────── */
test('M9 ★PROJECTS_DIR 을 «한 번만 읽고 보관»하는 자리가 없다', () => {
  /* ⚠️여기서 재는 것은 «붙잡아 두기»지 «쓰기»가 아니다.
     f(PROJECTS_DIR, id) 처럼 매번 호출할 때 읽는 것은 안전하다 — 재지정이 그대로 먹는다.
     위험한 건 결과가 «오래 사는» 두 모양뿐이다:
       ⒜ const/let/var X = PROJECTS_DIR      ⒝ register…·set…·new 배선에 값으로 넘김 */
  /* 제외는 «그 줄에 적혀 있어야» 한다(주석이 멀어지면 못 잰다):
       ⑴ PROJECTS_DIR_LEGACY(다른 상수)  ⑵ [뿌리-스냅샷] 표식(진단 기록 — 읽어 쓰는 곳이 없다) */
  const lines = SRC.split('\n').map((l, i) => [i + 1, l])
    .filter(([, l]) => !/PROJECTS_DIR_LEGACY/.test(l) && !/\[뿌리-스냅샷\]/.test(l));
  const held = lines.filter(([, l]) => /\b(?:const|let|var)\s+\w+\s*=\s*PROJECTS_DIR\b/.test(l));
  /* ⛔1판의 제외 `(?!\s*\))` 는 정본 `setX(() => PROJECTS_DIR)` 를 빼려던 것인데,
       ★막으려는 «퇴행» 자체인 `setX(PROJECTS_DIR)` 도 같이 빼 줬다(변이로 확인: 초록).
       그리고 `held` 가 `const X = PROJECTS_DIR` 만 봐서 «객체 프로퍼티 배선»
       (`startMcpServer({ projectsDir: PROJECTS_DIR })`)을 못 봤다.
     ⇒ 제외를 «게터 모양»으로 좁히고, `:` 대입도 붙잡는다. */
  const wired = lines.filter(([, l]) =>
    (/\b(?:register|set)[A-Z]\w*\([^)]*\bPROJECTS_DIR\b/.test(l) && !/\(\s*\)\s*=>\s*PROJECTS_DIR/.test(l))
    || /\bnew\s+\w+\([^)]*\bPROJECTS_DIR\b/.test(l)
    || (/[:=]\s*PROJECTS_DIR\s*[,}]/.test(l) && !/=>\s*PROJECTS_DIR/.test(l) && !/PROJECTS_DIR =/.test(l)));
  const bad = held.concat(wired);
  assert.deepStrictEqual(bad, [], `★계정이 바뀌어도 옛 뿌리를 보게 된다:\n${bad.map(([n, l]) => `  ${n}: ${l.trim()}`).join('\n')}`);
  assert.match(SRC, /registerGdtIpc\(\{ projectsDir: _projectsRoot,/, '★gdt 는 «게터»로 받아야 한다');
});

/* ── M10 ★경로 조립기가 «둘 이상»이 되지 않았다 ───────────────────────────
   이 검사는 실제 사고에서 나왔다. ipc.js 를 고치고도 mcp-server.js 가 «자기 나름의»
   userData/projects 를 만들고 있어서, 계정 격리를 켠 뒤 read_project 가
   ⒜ 자기 계정 프로젝트를 못 찾고  ⒝ 옛 공용 풀(=남의 계정 것)을 읽었다.
   ⇒ 「고쳤다」가 아니라 «전수»로 잰다 — projects 를 직접 이어 붙이는 곳을 «세어» 본다. */
test('M10 ★projects 경로를 «직접 조립»하는 곳이 남아 있지 않다 (전수)', () => {
  const root = path.join(__dirname, '..', '..');
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'tests') continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(js|cjs|mjs)$/.test(e.name)) files.push(f);
    }
  })(root);
  assert.ok(files.length > 20, `★파일을 ${files.length}개밖에 못 셌다 — 「0건」이 아니라 «못 잰» 것이다`);

  const offenders = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    src.split('\n').forEach((l, i) => {
      /* ⛔1판은 「userData 를 «그 줄에서» 부르고 곧바로 'projects' 를 잇는」 모양만 봤다.
           ★별칭 한 줄(`const ud = _getUserDataDir(); path.join(ud,'projects')`)이나
             큰따옴표(`"projects"`)면 통과했다(변이로 확인: 둘 다 초록).
         ⇒ 뒤집는다 — 'projects'/"projects" 가 «경로 세그먼트»로 쓰인 줄을 «전부» 잡고,
           정당한 것만 표식으로 뺀다. 「이 모양만 잡는다」는 새 모양이 곧 사각지대가 된다. */
      /* ⛔`[^)]*` 를 쓰면 «안쪽 괄호»에서 멈춘다 — `path.join(_getUserDataDir(), "projects")` 가
           통과했다(내 변이로 확인: 0 빨강). 인자 안에 함수 호출이 있으면 못 보는 것이다.
         ⇒ 괄호를 세지 말고 «그 줄에 .join( 과 'projects' 가 같이 있나»로 본다.
           넓게 잡고 «표식»으로만 뺀다 — 「이 모양만 잡는다」는 새 모양이 곧 사각지대다. */
      if (/\.join\(.*['"]projects['"]/.test(l)) {
        /* 뺄 것은 둘뿐이다 — 그리고 «그 줄에 적혀 있어야» 뺀다(주석이 멀어지면 못 잰다).
           ⑴ main.js 의 정본 정의(레거시 뿌리 자체)  ⑵ [뿌리-폴백] 표식이 달린 줄 */
        if (/PROJECTS_DIR_LEGACY\s*=/.test(l)) return;
        if (/\[뿌리-폴백\]/.test(l)) return;
        if (/\[뿌리-하네스\]/.test(l)) return;   // 릴리스 게이트 하네스(비로그인 픽스처) — 그 파일의 경고 참조
        if (/\[뿌리-정본\]/.test(l)) return;     // 뿌리를 «만드는» 자리(레거시 풀 정의·계정 뿌리 생성)
        offenders.push(`${path.relative(root, f)}:${i + 1}: ${l.trim()}`);
      }
    });
  }
  assert.deepStrictEqual(offenders, [], `★여기가 «자기 나름의» projects 뿌리를 만든다 — 계정 격리를 새게 한다:\n  ${offenders.join('\n  ')}`);
});

test('M10b ★뿌리를 주입받는 배선이 실제로 걸려 있다', () => {
  const mcp = fs.readFileSync(path.join(__dirname, '..', '..', 'main', 'claude-pm', 'mcp-server.js'), 'utf8');
  const ipc = fs.readFileSync(path.join(__dirname, '..', '..', 'main', 'claude-pm', 'ipc.js'), 'utf8');
  assert.match(mcp, /function setProjectsRoot\(fn\)/, '★MCP 서버가 뿌리를 «받을» 수 있어야 한다');
  assert.match(ipc, /function setPmProjectsRoot\(fn\)/, '★PM 폴더도 뿌리를 «받을» 수 있어야 한다');
  assert.match(SRC, /setMcpProjectsRoot\(\(\) => PROJECTS_DIR\)/, '★main.js 가 MCP 에 진짜 뿌리를 꽂아야 한다');
  assert.match(SRC, /setPmProjectsRoot\(\(\) => PROJECTS_DIR\)/, '★main.js 가 PM 에 진짜 뿌리를 꽂아야 한다');
});

/* ── M11 ★뿌리 갈아끼우기가 «로그인·로그아웃 외길목»에 실제로 걸려 있다 ──
   변이 검사에서 이 채널이 «비어 있었다»(훅을 떼도 M1~M10 이 전부 초록).
   M1~M10 은 _repointProjectsDir 를 손으로 부르니 「누가 부르는가」를 못 잰다.
   ⚠️이건 소스 검사다 — 약한 채널인 걸 알고 쓴다. 다만 «함수 몸통을 떼어» 보므로
     주석이나 다른 함수의 같은 문자열에는 속지 않는다. */
/** ★중괄호 셈이 안 통하는 함수용 — 본문에 «템플릿 리터럴»이 있으면 bodyOf 가 일찍 끊긴다
    (실측: _invokeRendererUpdateSection). 최상위 `\n}` 까지 잘라 쓴다. */
function topLevelBody(name) {
  const i = SRC.indexOf(`function ${name}(`);
  assert.ok(i >= 0, `★${name} 을 못 찾았다 — 검사가 대상을 놓쳤다`);
  const j = SRC.indexOf('\n}\n', i);
  assert.ok(j > i, `★${name} 의 끝을 못 찾았다`);
  return SRC.slice(i, j);
}

function bodyOf(name) {
  const i = SRC.indexOf(`function ${name}(`);
  assert.ok(i >= 0, `★${name} 을 못 찾았다 — 검사가 대상을 놓쳤다`);
  let depth = 0, started = false;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') { depth++; started = true; }
    else if (SRC[k] === '}') { depth--; if (started && depth === 0) return SRC.slice(i, k + 1); }
  }
  assert.fail(`★${name} 의 끝을 못 찾았다`);
}

test('M11 ★writeAuth/clearAuth 가 뿌리를 갈아끼운다 (로그인 경로의 외길목)', () => {
  assert.match(bodyOf('writeAuth'), /_repointProjectsDir\('login'\)/,
    '★로그인해도 뿌리가 안 바뀌면 민수가 철수 폴더를 그대로 본다');
  assert.match(bodyOf('clearAuth'), /_repointProjectsDir\('logout'\)/,
    '★로그아웃해도 뿌리가 남으면 로그아웃한 철수 것을 다음 사람이 본다');
  // 외길목이 맞는지 — auth.json 을 쓰는 다른 경로가 있으면 훅이 새 나간다
  const writers = SRC.split('\n').filter(l => /writeFileSync\(getAuthPath\(\)/.test(l));
  assert.strictEqual(writers.length, 1, `★auth.json 을 쓰는 자리가 ${writers.length} 곳 — 외길목이 아니면 훅 하나론 부족하다`);
});

/* ────────────────────────────────────────────────────────────────────────────
   M12·M13 — ★«폴백»이 격리를 조용히 되돌리는 두 자리 (지디 지적, 2026-09-07)
   내가 「철수 id 를 지목해도 not found」를 격리 증거로 적었는데, 그건 틀렸다.
   두 번째 뿌리가 «비어 있어서» 못 찾은 것일 수도 있었다(실측: 그 폴더는 아예 없었다).
   ⇒ 「못 찾았다」를 «막았다»로 읽지 않으려면 «일부러 놔두고» 재야 한다.
   ──────────────────────────────────────────────────────────────────────────── */
const os2 = require('os');

function loadMcpServer(env = {}) {
  // 모듈 캐시를 비워 «호출 시점 환경»이 실제로 먹는지 본다
  const p = require.resolve('../../main/claude-pm/mcp-server.js');
  delete require.cache[p];
  const saved = {};
  for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  try { return { mod: require(p), restore: () => { for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } } }; }
  catch (e) { for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } throw e; }
}

test('M12 ★주입이 «끊기면» 조용히 공용 폴더로 가지 않는다 — 던진다', () => {
  const { mod, restore } = loadMcpServer({ GODITOR_MCP_ALLOW_SHARED_ROOT: undefined });
  try {
    const g = mod.__test_getProjectsDir;
    assert.strictEqual(typeof g, 'function', '★검사할 함수를 못 꺼냈다 — 검사가 대상을 놓쳤다');

    // ⒜ 아예 주입 안 함
    assert.throws(() => g(), /NO_PROJECTS_ROOT/, '★주입이 없는데 «공용 폴더»를 돌려주면 격리가 조용히 풀린다');
    // ⒝ 주입 함수가 던짐 — 예전엔 catch 가 삼키고 공용 폴더로 갔다
    mod.setProjectsRoot(() => { throw new Error('boom'); });
    assert.throws(() => g(), /boom/, '★주입이 던졌는데 삼키면, 그 뒤는 «남의 계정 것»을 읽는다');
    // ⒞ 주입 함수가 빈 값
    mod.setProjectsRoot(() => null);
    assert.throws(() => g(), /NO_PROJECTS_ROOT/);
    // ⒟ 제대로 주입되면 «그대로» 나온다 (반대방향 오탐 방지)
    mod.setProjectsRoot(() => '/tmp/some-root');
    assert.strictEqual(g(), '/tmp/some-root');
  } finally { restore(); }
});

test('M13 ★두 번째 뿌리에 «남의 프로젝트»를 심어도 안 읽힌다 (양성대조)', () => {
  const shared = path.join(__dirname, '..', '..', 'projects');     // 코드가 뒤지던 두 번째 뿌리
  const victim = 'proj_9999001';
  const mine = fs.mkdtempSync(path.join(os2.tmpdir(), 'gdt-mine-'));
  const planted = path.join(shared, victim);
  const preexisting = fs.existsSync(shared);
  fs.mkdirSync(planted, { recursive: true });
  fs.writeFileSync(path.join(planted, 'proj.json'), JSON.stringify({ id: victim, name: '★남의것-비밀' }));
  try {
    const { mod, restore } = loadMcpServer({ GODITOR_MCP_ALLOW_SHARED_ROOT: undefined });
    try {
      mod.setProjectsRoot(() => mine);                              // 내 계정 뿌리(비어 있음)
      const read = mod.__test_readProjectFile;
      assert.strictEqual(typeof read, 'function', '★검사할 함수를 못 꺼냈다');
      // ★심어둔 것이 «진짜 거기 있다»는 것부터 보인다 — 「0건」이 «안 심어져서»면 검사가 무의미하다
      assert.ok(fs.existsSync(path.join(planted, 'proj.json')), '★양성대조 자체가 안 깔렸다');
      assert.throws(() => read(victim), /project not found/,
        '★두 번째 뿌리(앱/레포의 공용 projects)를 뒤지면 «계정을 넘어» 읽힌다');
      // 내 계정 것은 «읽혀야» 한다 — 반대방향 오탐 방지
      fs.mkdirSync(path.join(mine, 'proj_9999002'), { recursive: true });
      fs.writeFileSync(path.join(mine, 'proj_9999002', 'proj.json'), JSON.stringify({ id: 'proj_9999002', name: '내것' }));
      assert.strictEqual(read('proj_9999002').name, '내것');
    } finally { restore(); }
  } finally {
    fs.rmSync(planted, { recursive: true, force: true });
    if (!preexisting) { try { fs.rmdirSync(shared); } catch (_) {} }
    fs.rmSync(mine, { recursive: true, force: true });
  }
});

test('M14 ★뿌리 주입이 «서버가 듣기 전»에 걸린다 (그 사이 요청이 주입 없이 처리되지 않게)', () => {
  const iInject = SRC.indexOf('setMcpProjectsRoot(() => PROJECTS_DIR);');
  const iStart = SRC.indexOf('await startMcpServer({');
  assert.ok(iInject > 0 && iStart > 0, '★두 자리를 다 못 찾았다 — 검사가 대상을 놓쳤다');
  assert.ok(iInject < iStart, '★주입이 서버 기동 «뒤»면 그 사이 요청은 뿌리 없이 처리된다');
});

test('M15 ★PM 폴더 뿌리도 «조용히» 공용 폴더로 폴백하지 않는다', () => {
  /* 변이 검사에서 이 채널이 «비어 있었다» — ipc.js 를 옛 동작(조용한 폴백)으로 되돌려도
     M1~M14 가 전부 초록이었다. PM 폴더가 «남의 계정 폴더 아래» 조용히 생기는 길이다. */
  const p = require.resolve('../../main/claude-pm/ipc.js');
  delete require.cache[p];
  const ipc = require(p);
  const root = ipc._internal && ipc._internal._projectsRootPath;
  assert.strictEqual(typeof root, 'function', '★검사할 함수를 못 꺼냈다 — 검사가 대상을 놓쳤다');

  assert.throws(() => root(), /NO_PROJECTS_ROOT/, '★주입이 없는데 공용 폴더를 돌려주면 PM 폴더가 엉뚱한 계정 아래 생긴다');
  ipc.setPmProjectsRoot(() => { throw new Error('boom'); });
  assert.throws(() => root(), /boom/, '★주입이 던졌는데 삼키면 그대로 공용 폴더로 간다');
  ipc.setPmProjectsRoot(() => null);
  assert.throws(() => root(), /NO_PROJECTS_ROOT/);
  ipc.setPmProjectsRoot(() => '/tmp/pm-root');          // 반대방향 오탐 방지
  assert.strictEqual(root(), '/tmp/pm-root');
  ipc.setPmProjectsRoot(null);
});

/* ────────────────────────────────────────────────────────────────────────────
   M16~M18 — ★같은 «형제 패턴»이 맨 위층(main.js)에 셋 더 있었다 (지디 지적 2차)
   mcp-server·ipc 에서 「삼키고 공용 풀로」를 지웠는데, 같은 무늬를 main.js 에선 안 훑었다.
   ★결함 단위를 «함수»가 아니라 «형제 패턴»으로 잡아라.
   ──────────────────────────────────────────────────────────────────────────── */

test('M16 ★「auth.json 을 못 읽었다」는 «공용 풀»로 내려가지 않는다', () => {
  /* ⛔1차 수정은 «작동하지 않는 문장»이었다(지디 지적): _currentAccountKey 에서 던지게 했지만
       readAuth 가 «먼저» 삼켜서 예외가 올라올 일이 없었다. 그래서 주석 「진짜 비로그인」이 거짓이었다.
     ★즉 「던지게 했다」는 «던질 것이 있어야» 말이 된다. ⇒ readAuthOrThrow 로 갈랐다.
     실측(손상 auth.json 으로 앱 기동): 오늘은 MCP 가 NOT_LOGGED_IN 으로 거절하고 렌더러는
     로그인 화면에 머물러 «도달 불가»였다. 그래도 고친다 — 안전이 «무관한 게이트 둘»에
     얹혀 있으면, 그 둘 중 하나만 바뀌어도 조용히 열린다. */
  const h = load({ email: 'chulsoo@example.com' });
  h.setAuthThrows(true);
  const st = h.api._repointProjectsDir('login');

  assert.notStrictEqual(h.api.PROJECTS_DIR, h.api.PROJECTS_DIR_LEGACY,
    '★못 읽었는데 «공용 풀»로 내려가면, 거기 쌓인 것이 다음 계정에게 입양된다');
  assert.strictEqual(h.api.PROJECTS_DIR, h.api.PROJECTS_DIR_UNRESOLVED, '★격리 폴더로 가야 한다');
  assert.strictEqual(st.unresolved, true, '★상태에 «못 알아냈다»가 남아야 진단이 된다');
  assert.match(st.error, /깨짐/);
  assert.ok(fs.existsSync(h.api.PROJECTS_DIR), '격리 폴더가 «실제로» 있어야 한다(앱이 계속 돌아야 하니까)');

  // ★격리 폴더는 «계정»으로 세지 않는다 — 세면 나중에 진짜 계정이 입양을 못 받는다
  const keys = h.api._existingAccountKeys();
  assert.ok(keys.every(k => !k.includes('_unresolved')),
    `★_unresolved 가 «계정»으로 세이면 다음 계정 첫 로그인이 입양을 못 받는다 (지금: ${JSON.stringify(keys)})`);
  assert.ok(fs.existsSync(path.join(h.ud, 'accounts', '_unresolved')),
    '★양성대조: 격리 폴더가 «실제로» 만들어졌는데도 안 세어져야 의미가 있다');

  // 반대방향 오탐 방지 — «진짜 파일 없음»은 공용 풀이 맞다
  const out = load({ email: null });
  assert.strictEqual(out.api.PROJECTS_DIR, out.api.PROJECTS_DIR_LEGACY);
});

test('M17 ★★입양이 «던져도» 뿌리는 계정 폴더에 서 있다 (공용 풀에 안 남는다)', () => {
  /* ⛔예전엔 adopt 를 먼저 하고 그 «아래»에서 PROJECTS_DIR 을 바꿨다. adopt 가 던지면
       대입에 도달을 못 해 ★직전 뿌리(=레거시 공용 풀)가 그대로 남았다.
       그러면 로그인한 사용자의 새 프로젝트가 «공용 풀»에 쌓이고, 나중에 다른 계정이
       첫 로그인 할 때 입양돼 넘어간다 — A 의 작업물이 B 에게. 현빈 시나리오다.
     ⚠️정직하게: «오늘의» adopt 는 rename 실패를 안에서 잡아 사실상 안 던진다.
       그래서 처음 쓴 M17(renameSync 를 던지게)은 ★양쪽 다 초록인 «장식»이었다(변이 0 빨강).
       ⇒ adopt 안의 «감싸지지 않은» fs.existsSync 를 던지게 해서 진짜 상황을 만든다.
       ⇒ 그리고 adopt 가 «실제로 루프까지 도달»하도록 «첫 계정»으로 놓는다
          (다른 계정 폴더가 있으면 adopt 는 루프 전에 반환한다 — M6). */
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-acct-'));
  const legacy = path.join(ud, 'projects');
  fs.mkdirSync(path.join(legacy, 'proj_5001'), { recursive: true });

  const h = load({ email: null, userData: ud });          // 비로그인 = 레거시 공용 풀
  assert.strictEqual(h.api.PROJECTS_DIR, h.api.PROJECTS_DIR_LEGACY, '출발점 확인');

  const realExists = fs.existsSync;
  fs.existsSync = (p) => {
    if (String(p).includes('proj_5001')) throw new Error('입양 도중 폭발');   // adopt 루프 안, 감싸지지 않은 자리
    return realExists(p);
  };
  try {
    h.setEmail('chulsoo@example.com');                     // ★첫 계정 로그인
    let threw = null;
    try { h.api._repointProjectsDir('login'); } catch (e) { threw = e; }
    assert.ok(threw && /입양 도중 폭발/.test(threw.message),
      '★양성대조: 입양이 «실제로» 던져야 이 검사가 의미가 있다');
    assert.notStrictEqual(h.api.PROJECTS_DIR, h.api.PROJECTS_DIR_LEGACY,
      `★입양이 던졌다고 «공용 풀»에 남으면, 새 프로젝트가 거기 쌓여 남에게 입양된다 (지금: ${h.api.PROJECTS_DIR})`);
    assert.ok(h.api.PROJECTS_DIR.includes('chulsoo'), '★자기 계정 뿌리에 서 있어야 한다');
  } finally { fs.existsSync = realExists; }
});

test('M17b ★순서 자체를 못박는다 — 「뿌리 확정」이 「입양」보다 «먼저»', () => {
  /* 위 검사는 «오늘의» adopt 가 던질 수 있어야 성립한다. adopt 가 나중에 더 단단해져
     아예 안 던지게 되면 M17 은 조용히 장식이 된다. ⇒ 순서는 «구조»로도 박아 둔다. */
  const body = bodyOf('_repointProjectsDir');
  const iRoot = body.indexOf('PROJECTS_DIR = dest;');
  const iAdopt = body.indexOf('_adoptLegacyIfSoleAccount(');
  assert.ok(iRoot > 0 && iAdopt > 0, '★두 자리를 다 못 찾았다 — 검사가 대상을 놓쳤다');
  assert.ok(iRoot < iAdopt, '★입양이 «먼저»면, 입양이 던질 때 이전 계정 뿌리가 그대로 남는다');
});

test('M18 ★없는 폴더를 «뿌리»로 꽂지 않는다 (mkdir 실패를 삼키지 않는다)', () => {
  const h = load({ email: null });
  const realMkdir = fs.mkdirSync;
  fs.mkdirSync = () => { throw new Error('mkdir 실패'); };
  try {
    h.setEmail('chulsoo@example.com');
    assert.throws(() => h.api._repointProjectsDir('login'), /mkdir 실패/,
      '★폴더를 못 만들었는데 그걸 뿌리로 쓰면 «내 프로젝트가 다 사라졌다»가 된다');
  } finally { fs.mkdirSync = realMkdir; }
});

test('M19 ★로그아웃이 «실패해도» 앞사람 뿌리에 머물지 않는다', () => {
  /* clearAuth 가 auth.json 을 못 지우면 _repointProjectsDir 는 «아직 로그인»으로 읽는다.
     판단은 맞아도, 사용자가 로그아웃을 «눌렀다»면 다음 사람에게 앞사람 것이 보이면 안 된다. */
  /* ⛔1판은 「PROJECTS_DIR = PROJECTS_DIR_LEGACY 라는 «글자»가 있나」만 봤다. 그래서
       그 문장을 _repointProjectsDir('logout') «앞»으로 옮기는(현실적인 리팩터) 변이에
       ★초록이었다 — 앞으로 옮기면 뒤이은 repoint 가 「아직 로그인」으로 읽고 계정 뿌리로
       되돌려 놓아서, 검사 제목이 말하는 동작이 완전히 깨지는데도.
     ⇒ M17b 가 _repointProjectsDir 에 한 것과 같이 «순서»를 못박는다. */
  const body = bodyOf('clearAuth');
  assert.doesNotMatch(body, /catch\s*\(\s*_\s*\)\s*\{\s*\}/,
    '★삭제 실패를 조용히 삼키면 로그아웃한 척하고 계정 뿌리에 머문다');
  assert.match(body, /ENOENT/, '★원래 없던 파일은 «실패»가 아니다 — 그건 갈라야 한다');

  const iRepoint = body.indexOf("_repointProjectsDir('logout')");
  const iFallback = body.indexOf('PROJECTS_DIR = PROJECTS_DIR_LEGACY');
  assert.ok(iRepoint > 0, '★로그아웃이 뿌리를 갈아끼우지 않는다');
  assert.ok(iFallback > 0, '★못 지웠을 때의 착지점이 없다');
  assert.ok(iFallback > iRepoint,
    '★★공용 풀로 내리는 문장이 repoint «앞»에 있으면, 뒤이은 repoint 가 「아직 로그인」으로 읽고 계정 뿌리로 되돌린다');
  assert.match(body.slice(iRepoint), /if \(!unlinked\)/,
    '★그 착지는 「못 지웠을 때」로 걸려 있어야 한다(무조건 내리면 정상 로그아웃도 이상해진다)');
});

test('M20 ★readAuthOrThrow «진짜 함수»가 「없음」과 「손상」을 가른다', () => {
  /* ⛔변이 검사에서 이 채널이 «비어 있었다» — 하네스가 readAuthOrThrow 를 «흉내» 내므로
     진짜 함수를 손상 삼키게 바꿔도 M1~M19 가 전부 초록이었다.
     ★「흉내낸 것」을 재고 「진짜 것」을 안 잰 것 — 오늘 두 번째다.
     ⇒ 함수 몸통을 «떼어» 실제 파일 위에서 돌린다. */
  const body = bodyOf('readAuthOrThrow');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-auth-'));
  const authPath = path.join(dir, 'auth.json');
  const f = new Function('path', 'fs', 'getAuthPath', body + '\n; return readAuthOrThrow;')(path, fs, () => authPath);

  // ⒜ 파일이 «없다» = 진짜 비로그인 → null
  assert.strictEqual(f(), null, '★파일이 없는 것은 «비로그인»이지 오류가 아니다');

  // ⒝ ★손상 → «던진다» (잘린 JSON = 디스크 꽉 참·강제종료의 실제 모양)
  fs.writeFileSync(authPath, '{"email":"a@b.c');
  assert.throws(() => f(), /JSON|Unexpected|Unterminated/i,
    '★손상을 null 로 삼키면 「비로그인」으로 읽혀 ★공용 풀로 내려간다');

  // ⒞ 객체가 아니면 던진다
  fs.writeFileSync(authPath, '"문자열"');
  assert.throws(() => f(), /객체가 아니다/);

  // ⒟ 정상 → 객체 (반대방향 오탐 방지)
  fs.writeFileSync(authPath, JSON.stringify({ email: 'a@b.c', plan: 'x' }));
  assert.strictEqual(f().email, 'a@b.c');

  // ⒠ 우리 레코드가 아니면(email 없음) 로그인 아님 → null. ⛔이건 «손상»이 아니다
  fs.writeFileSync(authPath, JSON.stringify({ plan: 'x' }));
  assert.strictEqual(f(), null);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('M20b ★readAuth(자격증명 SSOT)는 «안 건드렸다»', () => {
  /* 지디 조언: readAuth 는 SSOT 라 건드리는 값이 크다. 별도 함수를 두는 쪽이 안전하다.
     ⇒ 「안 건드렸다」를 말로 하지 말고 «검사»로 둔다. */
  const body = bodyOf('readAuth');
  assert.match(body, /catch \(_\) \{\s*\n?\s*return null;/, '★readAuth 의 계약(로그인 아님이면 null)은 그대로여야 한다');
  assert.ok(!/throw/.test(body), '★readAuth 가 던지기 시작하면 로그인 경로 전체가 흔들린다');
});

test('M21 ★진단 필드가 «health 까지» 배선돼 있다 (만들고 안 실으면 조용히 사라진다)', () => {
  /* 실제로 그랬다 — accountUnresolved 를 main.js 프로브에 넣고 mcp-server 의 health 에서
     안 실어서 undefined 로 나왔다. ★「0건이면 못 잰 것 아닌가」는 «필드»에도 적용된다. */
  const mcp = fs.readFileSync(path.join(__dirname, '..', '..', 'main', 'claude-pm', 'mcp-server.js'), 'utf8');
  for (const f of ['accountScoped', 'accountUnresolved', 'accountFingerprint']) {
    assert.ok(SRC.includes(`${f}:`), `★프로브(main.js)에 ${f} 가 없다`);
    assert.match(mcp, new RegExp(`${f}:\\s*[^,\\n]*a\\.${f}`), `★health(mcp-server.js)가 ${f} 를 안 싣는다 — 만들어도 안 보인다`);
  }
});

test('M22 ★격리 폴더에 «나오는 길»이 적힌다 (읽는 코드가 0곳이라 사람이 꺼내야 한다)', () => {
  /* 지디 지적: 나는 「샐 위험」을 「갇힐 위험」과 바꿔놓고 ★그 교환을 아무 데도 안 적었다.
     _unresolved 를 «읽는» 코드는 0곳이다 — 입양 후보도 아니고 목록에도 안 뜬다.
     ⇒ 코드로 자동 회수하지 «않는» 대신(입양 규칙은 현빈 판단 대기), 손으로 꺼낼 길을 남긴다. */
  const h = load({ email: 'chulsoo@example.com' });
  h.setAuthThrows(true);
  h.api._repointProjectsDir('login');

  const readme = path.join(h.ud, 'accounts', '_unresolved', 'README-읽어주세요.txt');
  assert.ok(fs.existsSync(readme), '★나오는 길이 안 적히면 데이터가 «영영» 갇힌다');
  const txt = fs.readFileSync(readme, 'utf8');
  assert.match(txt, /acct_/, '★«어느 폴더»로 옮기는지가 적혀야 한다');
  assert.match(txt, /proj_\*/, '★«무엇»을 옮기는지가 적혀야 한다');
  assert.match(txt, /스스로 읽지 않습니다/, '★앱이 자동 회수하지 «않는다»는 것을 알려야 한다');
  assert.match(txt, /깨짐/, '★왜 여기로 왔는지(사유)가 적혀야 한다');
});

test('M22b ★안내문 쓰기가 실패해도 «격리 자체»는 선다 (안전이 먼저)', () => {
  const h = load({ email: 'chulsoo@example.com' });
  h.setAuthThrows(true);
  const realWrite = fs.writeFileSync;
  fs.writeFileSync = () => { throw new Error('디스크 꽉 참'); };
  try {
    const st = h.api._repointProjectsDir('login');
    assert.strictEqual(h.api.PROJECTS_DIR, h.api.PROJECTS_DIR_UNRESOLVED,
      '★안내문을 못 써도 «공용 풀»로 떨어지면 안 된다 — 안내문은 편의, 격리는 안전');
    assert.strictEqual(st.unresolved, true);
  } finally { fs.writeFileSync = realWrite; }
});

test('M22c ★_unresolved 를 «읽는» 코드가 0곳이다 (교환의 근거가 되는 «사실»)', () => {
  /* ⛔이 검사의 1판은 「주석에 «나오는 길이 없다» 라는 글자가 있나」를 봤다. 두 가지가 틀렸다(지디 지적):
       ⑴ `SRC.slice(i-2000, i)` 고정 창 — ★오늘 아침 D7 에서 «내가 고친» 바로 그 버그를 다시 만들었다.
          주석 한 문단만 늘어도 근거가 창 밖으로 밀려 «가짜 빨강»이 난다.
       ⑵ ★더 큰 것 — «주석이 있나»는 보지만 «주석이 참인가»는 못 본다. 나중에 누가 자동 회수를 얹으면
          「나오는 길이 없다」가 «거짓»이 되는데 검사는 그대로 초록이다.
          ⇒ 그 순간 이 검사는 «거짓 문장을 인증하는 장치»가 된다. 검사가 없느니만 못하다.
     ★규칙: «말»을 검사하지 말고 «말이 가리키는 사실»을 검사해라.

     여기서 지키는 «사실» = 「_unresolved 는 들어가는 길만 있고 «읽는» 코드가 없다」.
     그게 「샐 위험 ↔ 갇힐 위험」 교환의 근거다. 이 사실이 바뀌면(=회수 경로가 생기면)
     교환도 바뀐 것이니, 그때 «사람이» 근거를 갱신하도록 여기서 막아선다. */
  /* ⛔1판은 «문자 등장 횟수»를 셌다 — 그래서 ★주석에 이름을 한 번 더 적기만 해도 빨개졌다
       (동작은 그대로인데). 반대 방향 오탐이라 「멀쩡한데 빨강」이고, 그게 반복되면
       다음 사람이 숫자만 올려 버려서 검사가 죽는다.
     ⇒ «코드 줄»만 센다(줄 주석·블록 주석 제외). 진짜로 지키는 것은 아래 for 루프의
       「읽는 모양이 없다」이고, 이 숫자는 그 «변화 감지기»다. */
  const codeLines = stripComments(SRC).split('\n');
  const hits = codeLines.filter((l) => l.includes('PROJECTS_DIR_UNRESOLVED')).length;
  // 그리고 그 4곳이 «전부 쓰는 쪽»인지 — 읽는 모양(readdir/exists/입양 후보)이 섞이지 않았나
  for (const line of codeLines.filter((l) => l.includes('PROJECTS_DIR_UNRESOLVED'))) {
    assert.doesNotMatch(line, /readdirSync|_adoptLegacy|roots\s*\.push|\[\s*PROJECTS_DIR_UNRESOLVED/,
      `★여기가 «읽는» 자리다 — 회수 경로가 생겼으면 교환의 근거를 갱신해라: ${line.trim()}`);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   M23 — ★입양 고지 (지디 머지 조건 ②)
   「되돌릴 수 있다」는 adopted.json + console.log 뿐이었다. ★사용자는 그 둘을 «영원히» 안 본다.
   장치는 있는데 «닿는 길»이 없으면 없는 것과 같다 — 오늘 종일 잡은 그 모양이다.
   ──────────────────────────────────────────────────────────────────────────── */

test('M23 ★입양이 일어나면 «고지할 것»이 생기고, 한 번 보여준 뒤엔 안 생긴다', () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-acct-'));
  const legacy = path.join(ud, 'projects');
  fs.mkdirSync(path.join(legacy, 'proj_6001'), { recursive: true });
  fs.mkdirSync(path.join(legacy, 'proj_6002'), { recursive: true });

  const h = load({ email: 'hyunbin@example.com', userData: ud });
  const rec = JSON.parse(fs.readFileSync(path.join(ud, 'accounts', h.api._accountKeyFor('hyunbin@example.com'), 'adopted.json'), 'utf8'));

  // ★고지에 필요한 셋이 «파일에» 있어야 한다 — 화면 문구는 여기서 나온다
  assert.strictEqual(rec.moved, 2, '★몇 개를 옮겼나');
  assert.strictEqual(rec.email, 'hyunbin@example.com', '★«어느 계정»으로 옮겼나 — 이게 없으면 남의 것인지 판단을 못 한다');
  assert.ok(rec.from && rec.to, '★«어디서 어디로» — 되돌리려면 필요하다');
  assert.ok(!rec.noticeShownAt, '아직 안 보여줬다');
});

test('M23b ★고지 «소비»는 메모리가 아니라 파일에 적힌다 (고지 전에 앱이 죽어도 살아남는다)', () => {
  /* ⛔메모리에만 두면 고지 전에 앱이 죽었을 때 영영 안 뜬다.
     ⇒ adopted.json 의 noticeShownAt 이 «소비 기록»이다. */
  assert.match(SRC, /function _pendingAdoptionNotice\(\)/, '★고지를 «집어 드는» 함수가 있어야 한다');
  assert.match(SRC, /function _markAdoptionNoticeShown\(\)/, '★«보여줬다»를 적는 함수가 있어야 한다');
  const pend = bodyOf('_pendingAdoptionNotice');
  assert.match(pend, /rec\.noticeShownAt/, '★파일의 표시를 봐야 재시작을 견딘다');
  assert.match(pend, /!rec\.moved/, '★옮긴 게 «없으면» 고지하지 않는다 (빈 고지는 소음이다)');
  const mark = bodyOf('_markAdoptionNoticeShown');
  assert.match(mark, /noticeShownAt = new Date/, '★파일에 적어야 한다');
});

test('M23c ★고지가 «화면까지» 닿는 통로가 있다 (없으면 adopted.json 과 똑같이 안 보인다)', () => {
  assert.match(SRC, /ipcMain\.handle\('projects:peekAdoptionNotice'/, '★렌더러가 «가져갈» 통로');
  assert.match(SRC, /ipcMain\.handle\('projects:ackAdoptionNotice'/, '★«봤다»를 돌려줄 통로');
  // ⛔push 가 아니라 pull 이어야 한다 — 리스너를 걸기 전에 도착하면 유실된다(gdt:takePendingOpen 과 같은 결)
  assert.doesNotMatch(SRC, /send\('projects:adoptionNotice'/, '★push 로 보내면 렌더러 준비 전에 도착해 유실된다');
});

test('M23d ★고지가 실패해도 «앱»과 «입양»은 선다 (고지는 편의)', () => {
  const pend = bodyOf('_pendingAdoptionNotice');
  assert.match(pend, /catch[\s\S]*return null;/, '★고지를 못 읽는다고 갤러리가 안 뜨면 안 된다');
  const email = bodyOf('_currentAccountEmail');
  assert.match(email, /catch \(_\) \{ return null; \}/, '★이름을 못 읽은 것이지 «옮기지 말라»는 뜻이 아니다');
});

test('M23e ★preload 가 고지 채널을 «열어» 준다 (화이트리스트라 안 적으면 못 부른다)', () => {
  /* ⛔preload 는 화이트리스트다. main 에 ipcMain.handle 이 있어도 여기 없으면 렌더러가 못 부른다
     ⇒ adopted.json 과 «똑같이» 사용자에게 안 닿는다. 그게 이 고지를 만든 이유였는데
       preload 를 빠뜨리면 같은 병을 한 층 아래에서 반복하는 것이다. */
  const pre = fs.readFileSync(path.join(__dirname, '..', '..', 'preload.js'), 'utf8');
  for (const ch of ['projects:peekAdoptionNotice', 'projects:ackAdoptionNotice']) {
    assert.ok(pre.includes(ch), `★preload 에 ${ch} 가 없다 — main 에 있어도 렌더러가 못 부른다`);
    assert.ok(SRC.includes(`ipcMain.handle('${ch}'`), `★main 에 ${ch} 핸들러가 없다`);
  }
  // 양성대조 — preload 가 «실제로» 화이트리스트인지(전부 통과시키는 게 아닌지) 확인
  assert.doesNotMatch(pre, /invoke:\s*\(channel[^)]*\)\s*=>\s*ipcRenderer\.invoke\(channel/,
    '★preload 가 임의 채널을 통과시키면 이 검사의 전제가 틀린 것이다');
});

/* ────────────────────────────────────────────────────────────────────────────
   M24~M26 — 적대적 리뷰가 찾은 «형제 패턴의 다음 자리» (2026-09-07)
   ★셋 다 고친 뒤 변이를 돌렸더니 «0 빨강»이었다 = 지키는 검사가 «없었다».
     고쳤는데 검사가 없으면 닫힌 게 아니다. 여기서 채운다.
   ──────────────────────────────────────────────────────────────────────────── */

test('M24 ★_existingAccountKeys — 「못 읽었다」를 「계정이 없다」로 읽지 않는다 (fail-open 이었다)', () => {
  /* `[]` 는 「다른 계정이 없다」로 읽혀 ★입양을 «해도 된다»가 된다 = 삼킨 뒤 기본값이 «허용».
     같은 catch(_) 라도 _legacyProjectEntries 의 [] 는 「옮길 게 없다」라 거부 착지(방어)인데
     이 자리만 반대였다. ⇒ ENOENT 만 [], 나머지는 던진다. */
  const h = load({ email: 'chulsoo@example.com' });
  const realReaddir = fs.readdirSync;
  fs.readdirSync = (p, o) => {
    if (String(p).includes('accounts')) { const e = new Error('EACCES'); e.code = 'EACCES'; throw e; }
    return realReaddir(p, o);
  };
  try {
    assert.throws(() => h.api._existingAccountKeys(), /EACCES/,
      '★못 읽은 것을 «빈 목록»으로 돌려주면 남의 공용 풀을 가져간다');
  } finally { fs.readdirSync = realReaddir; }

  // ENOENT(폴더가 원래 없음 = 진짜 첫 로그인)는 «[]» 가 맞다 — 반대방향 오탐 방지
  fs.readdirSync = (p, o) => {
    if (String(p).includes('accounts')) { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; }
    return realReaddir(p, o);
  };
  try { assert.deepStrictEqual(h.api._existingAccountKeys(), []); }
  finally { fs.readdirSync = realReaddir; }
});

test('M25 ★로그인은 됐는데 «키를 못 만든» 경우도 공용 풀로 안 내려간다', () => {
  /* email 이 공백뿐이면 `!a.email` 은 거짓이라 통과하고 _accountKeyFor 는 null 을 준다.
     그 null 을 «비로그인»으로 읽으면 레거시 공용 풀에 앉고, 거기 만든 것은 다음 계정에게 입양된다.
     ★「비로그인」은 readAuthOrThrow() === null «하나»뿐이어야 한다. */
  for (const bad of ['   ', '\t\n', '@', '  @  ']) {
    const h = load({ email: 'chulsoo@example.com' });
    h.setEmail(bad);
    let landed = null;
    try { h.api._repointProjectsDir('login'); } catch (_) { landed = 'threw'; }
    assert.notStrictEqual(h.api.PROJECTS_DIR, h.api.PROJECTS_DIR_LEGACY,
      `★email=${JSON.stringify(bad)} 로 «공용 풀»에 앉았다 — 여기 만든 것은 남에게 입양된다`);
  }
  // 반대방향 — 멀쩡한 이메일은 자기 폴더로
  const ok = load({ email: 'chulsoo@example.com' });
  assert.ok(ok.api.PROJECTS_DIR.includes('chulsoo'));
});

test('M26 ★게이트를 «여는 자리»와 «닫는 자리»의 수가 맞는다 (로그아웃이 로그아웃이어야 한다)', () => {
  /* 실측(적대적 리뷰): _editorAccessGranted 를 true 로 «여는» 함수는 있는데
     false 로 «닫는» 자리가 0곳이었다. ⇒ 로그아웃한 앱에서 MCP 인증 게이트가 계속
     authed:true 를 돌려주고, 그 쓰기는 (clearAuth 가 내려놓은) 레거시 공용 풀에 떨어진다.
     ★「가장 먼저 로그인을 본다」가 로그아웃한 앱에 「예」라고 답하던 것이다.
     ⇒ «비대칭 자체»를 검사로 박는다 — 여는 자리가 늘면 닫는 자리도 있어야 한다. */
  assert.match(SRC, /function _revokeEditorAccess\(\)\s*\{\s*_editorAccessGranted = false;\s*\}/,
    '★게이트를 «닫는» 함수가 있어야 한다');
  assert.match(bodyOf('clearAuth'), /_revokeEditorAccess\(\)/,
    '★로그아웃이 게이트를 안 닫으면 로그아웃이 아니다');
  const grants = (SRC.match(/_editorAccessGranted = true/g) || []).length;
  const revokes = (SRC.match(/_editorAccessGranted = false/g) || []).length;
  assert.ok(revokes >= 1, `★여는 자리 ${grants} / 닫는 자리 ${revokes} — 닫는 자리가 없다`);
});

test('W1 ★섹션 이름의 «정본»은 sec._name 이다 — dataset 만 쓰면 저장 직전에 되돌아간다', () => {
  /* 2026-09-07 실측: update_section{name} 이 dataset.name «만» 써서, 화면엔 1.5초 보이다가
     옛 이름으로 복귀했다. 범인은 저장 직전의 이 줄이다(js/io/save-load.js getSerializedCanvas):
       if (sec._name && sec.dataset.name !== sec._name) sec.dataset.name = sec._name;
     ⇒ ★grep 으로는 안 나왔다. `dataset.name = v` 는 패치한 setAttribute 를 «우회»해서
       덫에도 안 걸렸고, CDP DOM 중단점으로야 잡혔다.
     ⇒ 둘을 «같이» 써야 한다. 하나만 쓰면 조용히 되돌아간다. */
  const body = topLevelBody('_invokeRendererUpdateSection');
  assert.match(body, /sec\._name = nv;/, '★정본(_name)을 안 쓰면 저장 직전에 덮인다');
  assert.match(body, /sec\.dataset\.name = nv;/, '★미러(dataset)도 써야 화면·읽기가 맞는다');
  const iName = body.indexOf('sec._name = nv;');
  const iDs = body.indexOf('sec.dataset.name = nv;');
  assert.ok(iName > 0 && iDs > 0);

  // ★반대방향 — 직렬화기가 «여전히» _name 을 정본으로 쓰는지(그게 바뀌면 이 처방이 낡는다)
  const ser = readSrc(__dirname, '..', '..', 'js', 'io', 'save-load.js');
  assert.match(ser, /sec\._name && sec\.dataset\.name !== sec\._name/,
    '★직렬화기가 _name 을 더는 정본으로 안 쓴다면 위 처방을 다시 봐야 한다');
});

test('W2 ★자동저장 함수 이름을 «틀리게» 부르지 않는다 (오타를 조용히 삼키던 자리)', () => {
  /* 같은 도구가 window.scheduleAutosave 를 불렀는데 그런 이름은 «없었다»(정의 0곳).
     진짜 이름은 scheduleAutoSave(대문자 S)이고 폴백이 triggerAutoSave 다.
     ★`typeof f === 'function'` 폴백은 오타를 «조용히» 삼킨다 — 아무 일도 안 일어난다. */
  /* ⛔«주석»에는 그 오타가 «일부러» 적혀 있다(무엇이 틀렸었는지 남기려고).
     검사는 «코드»만 봐야 한다 — 안 그러면 기록을 남긴 것이 빨강이 된다. */
  const body = stripComments(topLevelBody('_invokeRendererUpdateSection'));
  assert.doesNotMatch(body, /window\.scheduleAutosave/, '★소문자 s 오타 — 그런 함수는 없다');
  assert.match(body, /scheduleAutoSave/, '★앱의 진짜 이름');
  assert.match(body, /triggerAutoSave/, '★폴백도 앱과 같은 순서로');
  assert.match(body, /NO_AUTOSAVE/, '★하나도 못 찾으면 «말해야» 한다 — 조용히 지나가면 또 데인다');

  // ★양성대조 — 그 이름들이 앱에 «실제로» 있나(없는 이름을 요구하면 이 검사가 거짓말이다)
  const files = fs.readdirSync(path.join(__dirname, '..', '..', 'js'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(__dirname, '..', '..', 'js', f), 'utf8')).join('\n');
  assert.ok(/triggerAutoSave/.test(files), '★앱에 triggerAutoSave 가 있어야 이 요구가 성립한다');
});

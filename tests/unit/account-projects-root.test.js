/* 계정별 프로젝트 뿌리(<userData>/accounts/<계정키>/projects) — ★«진짜 파일시스템»에 돌려서 잰다.
   ⛔소스 문자열 검사로 하지 않는다. 「그렇게 적혀 있다」는 「그렇게 돈다」가 아니다.
     main.js 는 Electron 없이는 통째로 못 읽으니, 해당 블록만 «떼어내» 실제 fs 위에서 실행한다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8');

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
function load({ email = null, block = extractBlock(), userData = null } = {}) {
  const ud = userData || fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-acct-'));
  const readAuth = () => (email ? { email } : null);
  const factory = new Function(
    'path', 'fs', 'USER_DATA_DIR', 'migrateFiles', '__dirname', 'readAuth', 'require', 'console',
    block + `
    ; return {
        _accountKeyFor, _currentAccountKey, _accountProjectsDir, _repointProjectsDir,
        _adoptLegacyIfSoleAccount, _existingAccountKeys, _legacyProjectEntries, _projectsRoot,
        get PROJECTS_DIR() { return PROJECTS_DIR; },
        PROJECTS_DIR_LEGACY, ACCOUNTS_DIR,
      };`
  );
  const api = factory(path, fs, ud, () => {}, ud, readAuth, require, { log() {}, warn() {} });
  return { ud, api, setEmail(e) { email = e; } };
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
  const lines = SRC.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => !/PROJECTS_DIR_LEGACY/.test(l));
  const held = lines.filter(([, l]) => /\b(?:const|let|var)\s+\w+\s*=\s*PROJECTS_DIR\b/.test(l));
  const wired = lines.filter(([, l]) => /\b(?:register|set)[A-Z]\w*\([^)]*\bPROJECTS_DIR\b(?!\s*\))/.test(l) || /\bnew\s+\w+\([^)]*\bPROJECTS_DIR\b/.test(l));
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
      if (/\.join\([^)]*(?:getUserDataDir\(\)|getPath\('userData'\)|USER_DATA_DIR)[^)]*,\s*'projects'/.test(l)) {
        /* 뺄 것은 둘뿐이다 — 그리고 «그 줄에 적혀 있어야» 뺀다(주석이 멀어지면 못 잰다).
           ⑴ main.js 의 정본 정의(레거시 뿌리 자체)  ⑵ [뿌리-폴백] 표식이 달린 줄 */
        if (/PROJECTS_DIR_LEGACY\s*=/.test(l)) return;
        if (/\[뿌리-폴백\]/.test(l)) return;
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

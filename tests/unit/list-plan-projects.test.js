/* list-plan-projects.test.js — [T-064] 목록이 기획(plan_*) 프로젝트도 싣는다.
 *
 * ★무엇이 깨졌었나 (실측 2026-09-21, 격리 9547 실앱):
 *   기획 프로젝트를 만들면(`'plan_' + Date.now()`) 디스크엔 `plan_1789980680078/proj.json` 이
 *   생기는데 `projects:list` 는 []를 돌려줬다(카드 0개). _listProjectsImpl 의 걸름망이
 *   «세 곳 모두» /^proj_\d+$/ 였기 때문이다 — 디렉터리명 · 레거시 flat 파일명 · 파일 «안» data.id.
 *
 * ★왜 «명부»가 아니라 «판정 함수»인가: 같은 규칙이 세 군데 손으로 적혀 있었다.
 *   접두를 넓히면서 한 곳을 빠뜨리면 「일부만 목록에 뜨는」 재현 어려운 상태가 된다.
 *   ⇒ main.js `_isListableProjectId` 하나로 모았고, 이 검사가 «그 셋 다»를 각각 잰다.
 *
 * ★★넓힌 것은 «접두뿐»이다 — 뒤는 여전히 숫자만 받는다(T-049 방어).
 *   id 는 렌더러가 onclick="fn(event, '<id>')" 안에 그대로 박으므로, 모양을 풀면
 *   HTML 이스케이프로도 못 막는 인라인 핸들러 탈출이 되살아난다. 그 축도 여기서 잰다(P5·P6).
 *
 * ★기법 — folders-list-integration.test.js 와 같은 수법. main.js 는 Electron 없이 통째로
 *   못 읽으니 대상 함수만 소스에서 «떼어내» 진짜 fs 위에 꽂는다(검사가 «진짜 구현»을 잰다).
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const MAIN_SRC = readSrc(REPO, 'main.js');

function fnSrc(name) {
  for (const pat of [`async function ${name}(`, `function ${name}(`, `const ${name} = `]) {
    if (MAIN_SRC.indexOf(pat) < 0) continue;
    return sliceBlock(MAIN_SRC, pat, '검사가 «대상을 놓친» 것이지 통과가 아니다');
  }
  throw new Error(`★main.js 에 ${name} 이(가) 없다 — 이름이 바뀌었으면 이 검사도 «같이» 고쳐라`);
}

const REAL_FNS = ['_safeSeg', '_getMigrator', '_atomicWriteFileSync', '_resolveProjectJsonPath',
  '_resolveMetaJsonPath', '_ensureNewLayoutPaths', '_refreshListMeta', '_listItemFor',
  '_isListableProjectId', '_listProjectsImpl'];

function loadRealImpls(projectsDir) {
  const req = (m) => require(m.startsWith('.') ? path.join(REPO, m) : m);
  const factory = new Function('fs', 'path', 'PROJECTS_DIR', 'require', 'console',
    REAL_FNS.map(fnSrc).join('\n\n') + `\n; return { ${REAL_FNS.join(', ')} };`);
  return factory(fs, path, projectsDir, req, { log() {}, warn() {}, error() {} });
}

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-planlist-')); }

/** 신 레이아웃(디렉터리) — 갤러리의 saveProject 가 남기는 모양과 같다. */
function seedDir(dir, id, name, extra = {}) {
  fs.mkdirSync(path.join(dir, id), { recursive: true });
  fs.writeFileSync(path.join(dir, id, 'proj.json'), JSON.stringify({
    id, name, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    pages: [{ id: 'page_1', canvas: '' }], ...extra,
  }));
}
/** 레거시 flat — 파일명과 파일 «안» id 를 따로 줄 수 있다(둘이 다를 수 있는 게 이 경로의 특징). */
function seedFlat(dir, filename, dataId, name, extra = {}) {
  fs.writeFileSync(path.join(dir, filename), JSON.stringify({
    id: dataId, name, pages: [{ id: 'page_1', canvas: '' }], ...extra,
  }));
}

/* ── ① 신 레이아웃 디렉터리 ─────────────────────────────────────────────── */

test('P1 ★기획(plan_<숫자>) 디렉터리가 목록에 «뜬다» — 이 카드의 본체', () => {
  const dir = tmp();
  seedDir(dir, 'plan_1789980680078', '기획 하나', { type: 'planning' });
  const items = loadRealImpls(dir)._listProjectsImpl();
  assert.equal(items.length, 1, '★기획 프로젝트가 목록에서 빠졌다 — 만들어도 «사라지는» 그 증상이다');
  assert.equal(items[0].id, 'plan_1789980680078');
  assert.equal(items[0].type, 'planning',
    '★type 이 안 실렸다 — 화면이 «📋 기획» 배지와 planning.html 열기를 이 필드로 고른다');
});

test('P2 양성대조 — 일반(proj_<숫자>) 프로젝트는 그대로 뜬다(넓히다 옛 길을 막지 않았다)', () => {
  const dir = tmp();
  seedDir(dir, 'proj_1000', '일반 하나');
  seedDir(dir, 'plan_2000', '기획 하나', { type: 'planning' });
  const ids = loadRealImpls(dir)._listProjectsImpl().map(i => i.id).sort();
  assert.deepEqual(ids, ['plan_2000', 'proj_1000']);
});

/* ── ② 레거시 flat 폴백 — 파일명 걸름망과 data.id 걸름망은 «다른 자리»다 ───── */

test('P3 ★레거시 flat 기획(plan_<숫자>.json)도 뜬다 — 파일명 걸름망도 같이 넓혔다', () => {
  const dir = tmp();
  seedFlat(dir, 'plan_3000.json', 'plan_3000', '옛 기획', { type: 'planning' });
  const items = loadRealImpls(dir)._listProjectsImpl();
  assert.equal(items.length, 1, '★flat 폴백의 «파일명» 걸름망이 아직 proj_ 만 받는다(한 곳만 고친 자리)');
  assert.equal(items[0].id, 'plan_3000');
  assert.equal(items[0].type, 'planning');
});

test('P4 ★flat 의 파일 «안» data.id 걸름망도 같이 넓혔다 — 파일명만 맞고 id 가 plan_ 인 경우', () => {
  const dir = tmp();
  // 파일명은 proj_*, 안의 id 는 plan_* — 두 걸름망이 «따로»라는 것을 드러내는 배치
  seedFlat(dir, 'proj_4000.json', 'plan_4000', '이름은 proj 파일, 속은 기획', { type: 'planning' });
  const items = loadRealImpls(dir)._listProjectsImpl();
  assert.equal(items.length, 1, '★data.id 걸름망이 아직 proj_ 만 받는다 — 세 자리 중 하나가 남았다');
  assert.equal(items[0].id, 'plan_4000');
});

/* ── ③ ★넓힌 것은 «접두뿐» — 모양 강제는 그대로다(T-049 방어) ──────────── */

test('P5 ★모양이 어긋난 plan_ id 는 여전히 «조용히» 빠진다 — 인라인 onclick 탈출 봉쇄', () => {
  const dir = tmp();
  seedFlat(dir, 'plan_5000.json', "plan_5000', onerror=alert(1), x='", '나쁜 id');
  const items = loadRealImpls(dir)._listProjectsImpl();
  assert.equal(items.length, 0,
    '★형식이 어긋난 id 를 통과시켰다 — 렌더러 onclick="fn(event, \'<id>\')" 탈출 경로가 되살아난다(T-049)');
});

test('P6 ★숫자가 아닌 꼬리(plan_abc·proj_abc)는 디렉터리에서도 안 받는다', () => {
  const dir = tmp();
  seedDir(dir, 'plan_abc', '글자 꼬리 기획', { type: 'planning' });
  seedDir(dir, 'proj_abc', '글자 꼬리 일반');
  seedDir(dir, 'plan_7000', '정상 기획', { type: 'planning' });
  const ids = loadRealImpls(dir)._listProjectsImpl().map(i => i.id);
  assert.deepEqual(ids, ['plan_7000'],
    '★접두만 넓혀야 하는데 꼬리까지 풀렸다 — [A-Za-z0-9_-] 로 풀면 T-049 가 되살아난다');
});

test('P7 ⛔plan/proj 가 «아닌» 접두는 안 받는다 — 목록은 아무 폴더나 집지 않는다', () => {
  const dir = tmp();
  for (const bad of ['fold_1000', 'draft_1000', 'planx_1000', 'projx_1000', 'plan1000']) seedDir(dir, bad, bad);
  seedDir(dir, 'plan_8000', '정상 기획', { type: 'planning' });
  const ids = loadRealImpls(dir)._listProjectsImpl().map(i => i.id);
  assert.deepEqual(ids, ['plan_8000']);
});

/* ── ④ ★«판정하는 자리»가 하나다 — 명부를 다시 늘리지 못하게 못박는다 ───── */

test('P8 ★목록 코어에 손으로 적은 접두 정규식이 «남아 있지 않다» — 판정은 _isListableProjectId 하나로', () => {
  const body = sliceBlock(MAIN_SRC, 'function _listProjectsImpl(', '검사가 대상을 놓쳤다');
  // 주석은 설명을 위해 규칙을 인용할 수 있다 — «코드»만 본다.
  const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\/\^proj_/,
    '★_listProjectsImpl 안에 /^proj_…/ 가 다시 손으로 적혔다 — 접두 규칙이 두 곳으로 갈리면 '
    + '「일부만 목록에 뜨는」 재현 어려운 상태가 돌아온다. _isListableProjectId 를 써라');
  const calls = (code.match(/_isListableProjectId\(/g) || []).length;
  assert.ok(calls >= 3,
    `★걸름망은 세 자리다(디렉터리명·flat 파일명·flat data.id) — _isListableProjectId 호출이 ${calls}번뿐이다`);
});

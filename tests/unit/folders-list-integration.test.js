/* folders-list-integration.test.js — main.js 의 «진짜» 목록 함수가 folderId 를 들고 오나(T-A).
 *
 * ★왜 이 파일이 따로 있나 — folders.js 단위검사(folders-crud.test.js)는 folders.js 자체만 잰다.
 *   하지만 folderId 가 «화면(검색·레일)에 도달»하려면 main.js 의 _listItemFor 가 그 필드를
 *   ★두 반환 경로 «모두»(meta 캐시 빠른 경로 · proj.json 풀파싱 폴백)에서 실어야 한다.
 *   한쪽만 고치면 「일부 프로젝트만 폴더/검색에 안 걸리는」 재현 어려운 버그가 된다
 *   (이 레포가 favorite 에서 이미 겪은 실수 — main.js 주석에 남아 있다).
 *
 * ★기법 — mcp-project-crud.test.js·account-projects-root.test.js 와 같은 수법이다.
 *   main.js 는 Electron 없이 통째로 못 읽으니, 대상 함수만 소스에서 «떼어내» 진짜 fs 위에 꽂는다.
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
    const i = MAIN_SRC.indexOf(pat);
    if (i < 0) continue;
    return sliceBlock(MAIN_SRC, pat, '검사가 «대상을 놓친» 것이지 통과가 아니다');
  }
  throw new Error(`★main.js 에 ${name} 이(가) 없다 — 이름이 바뀌었으면 이 검사도 «같이» 고쳐라`);
}

const REAL_FNS = ['_safeSeg', '_getMigrator', '_atomicWriteFileSync', '_resolveProjectJsonPath',
  '_resolveMetaJsonPath', '_ensureNewLayoutPaths', '_refreshListMeta', '_listItemFor', '_listProjectsImpl'];

function loadRealImpls(projectsDir) {
  const req = (m) => require(m.startsWith('.') ? path.join(REPO, m) : m);
  const factory = new Function('fs', 'path', 'PROJECTS_DIR', 'require', 'console',
    REAL_FNS.map(fnSrc).join('\n\n') + `\n; return { ${REAL_FNS.join(', ')} };`);
  return factory(fs, path, projectsDir, req, { log() {}, warn() {}, error() {} });
}

function seed(dir, id, name, extra = {}) {
  fs.mkdirSync(path.join(dir, id), { recursive: true });
  fs.writeFileSync(path.join(dir, id, 'proj.json'), JSON.stringify({
    id, name, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    pages: [{ id: 'page_1', canvas: '' }], ...extra,
  }));
}

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'gdt-list-folderid-')); }

test('L1 ★풀파싱 폴백(첫 조회, 메타 캐시 없음) 경로가 folderId 를 싣는다', () => {
  const dir = tmp();
  seed(dir, 'proj_1000', '이름1');
  fs.writeFileSync(path.join(dir, 'proj_1000', 'proj_meta.json'), JSON.stringify({ id: 'proj_1000', folderId: 'fold_abc' }));
  const R = loadRealImpls(dir);
  const items = R._listProjectsImpl();
  assert.equal(items.length, 1);
  assert.equal(items[0].folderId, 'fold_abc', '★풀파싱 폴백 경로에 folderId 가 없다');
});

test('L2 ★메타 캐시 빠른 경로(listMetaV 마커 있음)도 folderId 를 싣는다', () => {
  const dir = tmp();
  seed(dir, 'proj_2000', '이름2');
  const R = loadRealImpls(dir);
  R._listProjectsImpl();   // 1차 호출 — meta 캐시(listMetaV)를 만든다
  // 캐시에 folderId 를 얹는다(폴더 배정이 한 것과 같은 결과 상태)
  const metaPath = path.join(dir, 'proj_2000', 'proj_meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  assert.ok(meta.listMetaV, '전제: 1차 호출이 listMetaV 캐시를 만들어야 한다');
  meta.folderId = 'fold_xyz';
  fs.writeFileSync(metaPath, JSON.stringify(meta));
  // proj.json 보다 meta 가 «더 최신»이어야 빠른 경로를 탄다(mtime 비교) — 다시 써서 mtime 을 올린다
  fs.utimesSync(metaPath, new Date(), new Date());

  const items = R._listProjectsImpl();
  assert.equal(items.length, 1);
  assert.equal(items[0].folderId, 'fold_xyz', '★빠른(캐시) 경로에 folderId 가 없다 — 두 경로 중 하나만 고쳤을 때 나는 병');
});

test('L3 folderId 가 없는 프로젝트는 null(=미분류)로 온다 — undefined 로 새지 않는다', () => {
  const dir = tmp();
  seed(dir, 'proj_3000', '이름3');
  const R = loadRealImpls(dir);
  const items = R._listProjectsImpl();
  assert.strictEqual(items[0].folderId, null);
});

test('L4 ★「전체」 개념 — list_projects 는 folderId 값과 무관하게 «모든» 프로젝트를 준다', () => {
  const dir = tmp();
  seed(dir, 'proj_4001', 'A');
  seed(dir, 'proj_4002', 'B');
  fs.writeFileSync(path.join(dir, 'proj_4002', 'proj_meta.json'), JSON.stringify({ id: 'proj_4002', folderId: 'fold_없는폴더' }));
  const R = loadRealImpls(dir);
  const items = R._listProjectsImpl();
  assert.equal(items.length, 2, '★목록 코어가 folderId 로 걸러버렸다 — 필터링은 렌더러 몫이어야 한다');
});

/* ══════════════════════════════════════════════════════════════════════════
 * L5 — ★[XSS 근원차단] 레거시 flat 폴백(proj_<id>.json)의 data.id 형식 검증(T-B 보강안).
 *   data.id 는 파일 «내용»이라 파일명(proj_<숫자>.json)과 다를 수 있다. 렌더러가 이 id 를
 *   onclick="fn(event, '${id}')" 처럼 홑따옴표 JS 문자열 리터럴 안에 그대로 박으므로,
 *   형식이 어긋난 id(따옴표 포함 등)가 여기를 통과하면 HTML 이스케이프로도 못 막는
 *   인라인 핸들러 탈출이 가능하다. ⇒ /^proj_\d+$/ 가 아니면 목록에서 조용히 뺀다.
 * ══════════════════════════════════════════════════════════════════════════ */
function writeFlat(dir, filename, dataId, name) {
  fs.writeFileSync(path.join(dir, filename), JSON.stringify({ id: dataId, name, pages: [{ id: 'page_1', canvas: '' }] }));
}

test('L5 ★레거시 flat — data.id 가 /^proj_\\d+$/ 형식이 아니면 목록에서 «조용히» 빠진다', () => {
  const dir = tmp();
  writeFlat(dir, 'proj_5001.json', "proj_5001', onerror=alert(1), x='", '나쁜 id');
  const R = loadRealImpls(dir);
  const items = R._listProjectsImpl();
  assert.equal(items.length, 0, '★형식이 어긋난 id 를 그대로 통과시켰다 — 인라인 onclick 탈출 경로다');
});

test('L5b 양성대조 — 형식이 «맞는» 레거시 flat id 는 정상적으로 목록에 뜬다', () => {
  const dir = tmp();
  writeFlat(dir, 'proj_5002.json', 'proj_5002', '정상 이름');
  const R = loadRealImpls(dir);
  const items = R._listProjectsImpl();
  assert.equal(items.length, 1, '★검증을 너무 세게 걸어 «정상 id»까지 걸러냈다');
  assert.equal(items[0].id, 'proj_5002');
});

/* ══════════════════════════════════════════════════════════════════════════
 * L6 — ★[인수시험 4] 폴더에 넣은 프로젝트를 저장(에디터 왕복)해도 folderId 가 생존한다.
 *   _refreshListMeta 는 name/type/createdAt/updatedAt/marketRef/listMetaV «만» 덮어쓰고
 *   기존 merged 를 스프레드하므로 folderId 가 살아야 한다 — read-merge-write 계약을 실측으로 못박는다.
 * ══════════════════════════════════════════════════════════════════════════ */
test('L6 ★저장(에디터 왕복) 후에도 folderId 가 살아남는다(_refreshListMeta read-merge-write)', () => {
  const dir = tmp();
  seed(dir, 'proj_6000', '원래이름');
  // 폴더 배정(= main/folders.js 가 하는 것과 같은 결과 상태) 흉내
  const metaPath = path.join(dir, 'proj_6000', 'proj_meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({ id: 'proj_6000', folderId: 'fold_abc' }));

  const R = loadRealImpls(dir);
  // 사용자가 이름을 바꾸고 «저장»한 상황 — _refreshListMeta 가 목록 캐시 필드를 갱신한다
  R._refreshListMeta('proj_6000', { name: '바뀐이름', type: null, createdAt: '2026-01-01', updatedAt: '2026-02-02', marketRef: null });

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  assert.equal(meta.name, '바뀐이름', '이름 갱신이 안 됐다 — 애초에 저장이 안 도는 것이면 이 검사가 무의미하다');
  assert.equal(meta.folderId, 'fold_abc', '★저장 왕복에 folderId 가 살아남지 못했다 — read-merge-write 가 깨졌다');
});

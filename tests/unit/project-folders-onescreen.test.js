/* project-folders-onescreen.test.js — 폴더 «한 화면»(시안 B, 2026-09-19) 회귀 검사.
 *
 * ★정적 대조만으로는 «규칙이 진짜로 그렇게 도나»를 모른다 — 필터·이주·상대시간은 소스에서
 *   함수를 «떼어내» 진짜로 실행해서 잰다(project-search.test.js 의 loadMatcher 와 같은 기법).
 * ★실제 화면(클릭·드래그·XSS)은 tests/dom/projects-onescreen.dom.spec.js 가 크로미움에서 잰다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripComments } = require('./_strip-comments.js');
const { sliceBlock } = require('./_slice-block.js');

const HTML = fs.readFileSync(path.join(__dirname, '../../pages/projects.html'), 'utf8');
const CODE = stripComments(HTML);

test('OS-1 ★[R8] 옛 저장값 \'__unassigned__\' 이주 — null 을 돌려주고 키를 지운다(다른 값은 그대로)', () => {
  const fnSrc = sliceBlock(CODE, 'function _getSelectedFolder() {');
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    removeItem: (k) => { store.delete(k); },
    setItem: (k, v) => { store.set(k, String(v)); },
  };
  const get = new Function('localStorage', 'FOLDER_VIEW_KEY', fnSrc + '\n; return _getSelectedFolder;')(localStorage, 'goditor_projects_folder');
  store.set('goditor_projects_folder', '__unassigned__');
  assert.equal(get(), null, '옛 「미분류」 값이 이주되지 않았다');
  assert.equal(store.has('goditor_projects_folder'), false, '옛 값을 지우지 않았다');
  store.set('goditor_projects_folder', 'fold_abc');
  assert.equal(get(), 'fold_abc', '정상 폴더 id 까지 지웠다');
  assert.equal(get.call(null), 'fold_abc');
  store.clear();
  assert.equal(get(), null);
  // 키 이름은 그대로(선택 기억 유지)
  assert.match(CODE, /const FOLDER_VIEW_KEY = 'goditor_projects_folder'/);
});

function loadFilter() {
  const src = ['function _norm(', 'function _matchesQuery(', 'function _filterForView(']
    .map(h => sliceBlock(CODE, h)).join('\n');
  return new Function('_folderNameById', src + '\n; return { _norm, _filterForView };')((id) => ({ f1: '파테나', f2: '보관' }[id] || null));
}
const LIST = [
  { id: 'proj_1', name: '루트 하나' },
  { id: 'proj_2', name: '루트 둘', folderId: null },
  { id: 'proj_3', name: '파테나 상세', folderId: 'f1' },
  { id: 'proj_4', name: '다른 것', folderId: 'f1' },
  { id: 'proj_5', name: '보관본', folderId: 'f2' },
  { id: 'proj_6', name: '고아', folderId: 'f_deleted' },
];
const KNOWN = new Set(['f1', 'f2']);

test('OS-2 ★모드별 목록 — 루트=폴더 밖만 · 폴더 안=그 폴더만 · 검색=전체 범위(폴더 선택 무관)', () => {
  const { _norm, _filterForView } = loadFilter();
  const ids = (l) => l.map(p => p.id).sort();
  assert.deepEqual(ids(_filterForView(LIST, '', null, KNOWN)), ['proj_1', 'proj_2', 'proj_6'],
    '루트가 폴더 밖 프로젝트만 보여주지 않는다');
  assert.deepEqual(ids(_filterForView(LIST, '', 'f1', KNOWN)), ['proj_3', 'proj_4'], '폴더 안 필터가 틀렸다');
  // 검색은 폴더 안에서 해도 전체 범위 — 「파테나」는 이름(proj_3)·소속 폴더명(proj_4) 둘 다 걸린다
  assert.deepEqual(ids(_filterForView(LIST, _norm('파테나'), 'f2', KNOWN)), ['proj_3', 'proj_4'],
    '★검색이 선택 폴더 범위에 갇혔다');
});

test('OS-2b ★없는 폴더를 가리키는 프로젝트는 루트에 뜬다 — 폴더 버그가 프로젝트를 «안 보이게» 만들면 안 된다', () => {
  const { _filterForView } = loadFilter();
  assert.ok(_filterForView(LIST, '', null, KNOWN).some(p => p.id === 'proj_6'), '고아 folderId 프로젝트가 사라졌다');
  // 폴더 API 가 없는 환경(브라우저 폴백: 폴더 0개) — 전부 루트에 보여야 한다
  assert.equal(_filterForView(LIST, '', null, new Set()).length, LIST.length);
});

test('OS-2c 상대시간 — 오늘/어제/N일 전/N주 전/N개월 전', () => {
  const rel = new Function(sliceBlock(CODE, 'function _relTime(') + '\n; return _relTime;')();
  const now = new Date(2026, 8, 19, 15, 0, 0);
  const ago = (d) => new Date(2026, 8, 19 - d, 9, 0, 0).toISOString();
  assert.equal(rel(ago(0), now), '오늘');
  assert.equal(rel(ago(1), now), '어제');
  assert.equal(rel(ago(2), now), '2일 전');
  assert.equal(rel(ago(10), now), '1주 전');
  assert.equal(rel(ago(21), now), '3주 전');
  assert.equal(rel(ago(65), now), '2개월 전');
  assert.equal(rel('', now), '');
  assert.equal(rel('garbage', now), '');
});

test('OS-3 ★경로의 폴더 이름은 textContent 로만 넣는다(XSS 경로 0)', () => {
  const fn = sliceBlock(CODE, 'function renderFolderChrome() {');
  assert.match(fn, /crumbName\.textContent = fname/, '경로 이름을 textContent 로 안 넣는다');
  assert.ok(!/crumb\w*\.innerHTML/.test(CODE), '★경로(crumb)에 innerHTML 을 쓴다');
  assert.match(CODE, /<span id="gal-crumb-name"[^>]*><\/span>/, '경로 이름 자리는 비어 있어야 한다(정적 텍스트 0)');
});

test('OS-4 ★[R4] 「Projects」 클릭 — 프로젝트 탭에서 폴더를 보고 있으면 밖으로(selectFolder(null)), 아니면 _setGalleryView', () => {
  const fn = sliceBlock(CODE, "document.getElementById('gal-tab-projects').addEventListener('click', () => {");
  assert.match(fn, /if \(_galleryView === 'projects' && _selectedFolderId\) selectFolder\(null\);\s*else _setGalleryView\('projects'\);/,
    '「Projects」 분기가 틀렸다 — 휴지통에서 돌아올 때 폴더 기억이 풀리거나, 폴더 안에서 밖으로 못 나간다');
  // 휴지통 → 돌아오기는 _setSelectedFolder 를 건드리지 않는다(기억 유지)
  assert.ok(!/_setSelectedFolder/.test(sliceBlock(CODE, 'function _setGalleryView(v) {')), '★휴지통 전환이 선택 폴더를 지운다');
});

test('OS-5 폴더 안에서 새 프로젝트 → 그 폴더 소속(try 로 감싸 진입을 막지 않고, openProject 보다 먼저)', () => {
  const fn = sliceBlock(CODE, 'async function createProject() {');
  const iAssign = fn.indexOf('folders.assign({ projectIds: [id], folderId: _selectedFolderId })');
  const iSave = fn.indexOf('await saveNewProject(proj)');
  const iOpen = fn.indexOf('openProject(id)');
  assert.ok(iAssign > -1, '새 프로젝트를 현재 폴더에 배정하지 않는다');
  assert.ok(iSave < iAssign && iAssign < iOpen, '★배정 순서가 틀렸다(저장 뒤·열기 전이어야 한다)');
  const around = fn.slice(fn.lastIndexOf('if (', iAssign), iAssign);
  assert.match(around, /_selectedFolderId && !_isSearching\(\) && window\.electronAPI\?\.folders/, '배정 조건 가드가 없다');
  assert.match(fn.slice(iAssign - 50, iAssign), /try \{/, '★배정이 try 로 안 감싸져 실패 시 진입이 막힌다');
});

test('OS-6 ★XSS — 타일·⋯메뉴 템플릿의 폴더 이름/id 는 전부 _escHtml 을 거친다', () => {
  const chrome = sliceBlock(CODE, 'function renderFolderChrome() {');
  const menu = sliceBlock(CODE, 'function openFolderTileMenu(');
  for (const [nm, fn] of [['renderFolderChrome', chrome], ['openFolderTileMenu', menu]]) {
    assert.ok(!/\$\{f\.(name|id)\}/.test(fn), `★${nm} 에 이스케이프 안 된 \${f.name}/\${f.id} 가 있다`);
    // HTML 을 만드는 템플릿(«<» 를 품은 백틱 문자열)만 본다 — .title/.textContent 대입은 HTML 이 아니다
    const htmlTpls = (fn.match(/`[^`]*<[^`]*`/g) || []).join('\n');
    assert.ok(!/\$\{(folderId|name|fname|id)\}/.test(htmlTpls), `★${nm} 의 HTML 템플릿에 이스케이프 안 된 이름/id 보간이 있다`);
  }
  assert.ok((chrome.match(/_escHtml\(f\.(name|id)\)/g) || []).length >= 4, '타일 템플릿의 이스케이프 사용처가 너무 적다');
  // 인라인 입력칸 값은 .value 로만(속성 문자열로 안 넣는다)
  const sw = sliceBlock(CODE, 'function _swapToNameInput(');
  assert.match(sw, /input\.value = initial/);
  assert.ok(!/value="\$\{/.test(sw), '★입력칸 초기값을 HTML 문자열로 넣는다');
});

test('OS-7 폴더 0개 — 타일 줄엔 「+ 새 폴더」 하나만, 개수는 비우고 구역 여백을 줄인다', () => {
  const fn = sliceBlock(CODE, 'function renderFolderChrome() {');
  assert.match(fn, /tiles\.innerHTML = _foldersCache\.map\([\s\S]*?\)\.join\(''\) \+ addTile;/, '타일 목록 끝에 「+ 새 폴더」를 붙이지 않는다');
  assert.match(fn, /zone\.classList\.toggle\('is-empty', !_foldersCache\.length\)/, '폴더 0개 여백 축소(is-empty)가 없다');
  assert.match(fn, /_foldersCache\.length \? String\(_foldersCache\.length\) : ''/, '폴더 0개에도 개수 0 을 적는다');
  assert.match(CODE, /#folder-zone\.is-empty \{ margin-bottom: 16px; \}/);
  // 루트의 «폴더 밖 0개»는 큰 빈 화면이 아니라 compact
  const grid = sliceBlock(CODE, 'function _renderGridFromCache() {');
  assert.match(grid, /_setEmptyState\('폴더 밖 프로젝트가 없어요[^']*', true\)/, '폴더 밖 0개가 큰 빈 화면으로 뜬다');
  assert.match(CODE, /#empty-state\.is-compact \{/);
});

test('OS-8 [R5] 폴더 안에서 경로 「Projects」에 드롭 = 미분류로 빼기(folderId null), 폴더 안일 때만', () => {
  const fn = sliceBlock(CODE, "up.addEventListener('drop', async (e) => {");
  assert.match(fn, /if \(!canDropUp\(\)\) return;/, '폴더 안이 아닐 때도 드롭을 받는다');
  assert.match(fn, /_assignToFolder\(\[projectId\], null\)/, '「Projects」 드롭이 미분류(null)로 배정하지 않는다');
  assert.match(CODE, /const canDropUp = \(\) => _viewMode\(\) === 'inside';/);
});

test('OS-9 ★[R1] 배정 결과를 버리지 않는다 — 실패·moved 0(기획 프로젝트) 을 알린다', () => {
  const fn = sliceBlock(CODE, 'async function _assignToFolder(');
  assert.match(fn, /r\.ok !== true/, '실패를 안 본다');
  assert.match(fn, /r\.moved === 0/, 'moved 0(조용한 no-op)을 안 본다');
  // 사용자 경로(카드 메뉴·타일 드롭·경로 드롭)는 전부 이걸 거친다 — 맨 assign 호출은 createProject 하나뿐
  const bare = CODE.match(/window\.electronAPI\.folders\.assign\(/g) || [];
  assert.equal(bare.length, 2, `folders.assign 직접 호출이 ${bare.length}곳 — _assignToFolder·createProject 외엔 없어야 한다`);
});

test('OS-10 목록 보기 — #gallery-col 에 is-list-mode 를 달아 타일 줄을 압축형으로(줄은 유지)', () => {
  const fn = sliceBlock(CODE, 'function applyViewMode(');
  assert.match(fn, /getElementById\('gallery-col'\)\?\.classList\.toggle\('is-list-mode', m === 'list'\)/);
  assert.match(CODE, /\.is-list-mode #folder-tiles \{[^}]*minmax\(180px, 1fr\)/);
  assert.ok(!/\.is-list-mode #folder-(zone|tiles) \{[^}]*display:\s*none/.test(CODE), '★목록 보기에서 타일 줄을 숨긴다');
});

test('OS-11 Esc «밖으로» — 입력칸·계정메뉴·열린 메뉴/모달이 먼저다', () => {
  const i = CODE.indexOf("if (e.key !== 'Escape' || e.defaultPrevented) return;");
  assert.ok(i > -1, '폴더 밖으로 Esc 처리가 없다');
  const blk = CODE.slice(i, CODE.indexOf('selectFolder(null);', i));
  assert.match(blk, /_viewMode\(\) !== 'inside'/);
  assert.match(blk, /input, textarea/);
  assert.match(blk, /#acct/);
  assert.match(blk, /card-folder-menu/);
  assert.match(blk, /settings-modal-overlay/);
});

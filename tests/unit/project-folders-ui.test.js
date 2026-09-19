/* project-folders-ui.test.js — 폴더 UI(T-A → 2026-09-19 B안 «한 화면» 타일) 정적 검사. project-search.test.js 와 같은 기법.
 *
 * ★B안 이식 때 레일(#folder-rail) 전제 검사를 «의도가 같은 검사»로 바꿨다 — 레일 id → 타일 id.
 *   보호 의도(드롭 이동·「뜻 없는 칸」 드롭 거부·파란 액센트 금지·prompt 금지·삭제 문구)는 그대로다.
 *
 * ★folders-crud.test.js(main/folders.js) · folders-list-integration.test.js(main.js 목록 함수)
 *   와는 층이 다르다 — 이 파일은 «화면(pages/projects.html)»이 그 위에 올린 배선을 잰다.
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

test('PF-1 폴더 구역이 실재한다 — 레일은 없고 #folder-zone/#folder-tiles + 「+ 새 폴더」 타일', () => {
  assert.ok(!/<aside id="folder-rail"/.test(CODE), '★옛 레일(#folder-rail)이 남아 있다 — B안은 레일을 걷는다');
  assert.match(CODE, /<section id="folder-zone"/, '#folder-zone 이 없다');
  assert.match(CODE, /<div id="folder-tiles"><\/div>/, '#folder-tiles 가 없다');
  const fn = sliceBlock(CODE, 'function renderFolderChrome() {');
  assert.match(fn, /id="ft-add-folder"/, 'renderFolderChrome 이 「+ 새 폴더」 타일을 안 그린다');
});

test('PF-2 ★타일은 전용 클래스 .ft-tile «한 벌», 메뉴 항목은 공용 .tab-add-item 재사용(디자인 게이트)', () => {
  const fn = sliceBlock(CODE, 'function renderFolderChrome() {');
  assert.match(fn, /class="ft-tile/, '타일이 .ft-tile 을 안 쓴다');
  assert.ok(!/class="(fr-item|folder-tile|ftile)\b/.test(CODE), '★타일 클래스를 한 벌 더 만들었다');
  const menu = sliceBlock(CODE, 'function openFolderTileMenu(');
  assert.match(menu, /class="tab-add-item"/, '⋯ 메뉴 항목이 공용 .tab-add-item 을 안 쓴다');
  assert.match(menu, /card-folder-menu/, '⋯ 메뉴가 카드 📁 메뉴 껍데기를 재사용하지 않는다');
  // <button> 안에 <button> 금지(09-16) — ⋯ 은 타일의 «형제»
  assert.match(fn, /<\/button>\s*<button type="button" class="ft-more"/, '★⋯ 버튼이 타일 «형제»가 아니다(버튼 안 버튼)');
});

test('PF-3 ★파란 액센트 금지 — 타일 hover·드롭·강조는 보더/배경 토큰뿐', () => {
  for (const sel of ['.ft-tile:hover', '.ft-tile.is-drop-target', '.ft-tile.is-fresh', '#gal-tab-projects.is-drop-target']) {
    const i = CODE.indexOf(sel + ' {');
    assert.ok(i > -1, `${sel} 규칙이 없다`);
    const rule = CODE.slice(i, CODE.indexOf('}', i));
    assert.ok(!/#2d6fe8|accent/.test(rule), `★${sel} 에 파란 액센트를 썼다`);
    assert.match(rule, /var\(--ui-(divider|text-dim|border-mid)\)/, `${sel} 이 토큰을 안 쓴다`);
  }
});

test('PF-4 ⛔claudePM:folderMap 이름을 재사용하지 않는다(다른 용도로 이미 쓰임)', () => {
  const m = /const FOLDER_VIEW_KEY = '([^']+)'/.exec(CODE);
  assert.ok(m, 'FOLDER_VIEW_KEY 상수를 못 찾았다');
  assert.notEqual(m[1], 'claudePM:folderMap', '★클로드 터미널 패널의 folderMap 키와 충돌한다');
  assert.match(CODE, /claudePM:folderMap/, '(참고) claudePM:folderMap 은 여전히 다른 용도로 쓰인다 — 그대로 있어야 정상');
});

test('PF-5 드래그앤드롭 — 카드는 draggable, 타일 구역은 dragover/drop 을 받는다', () => {
  assert.match(CODE, /card\.draggable = true/, '카드에 draggable 배선이 없다');
  assert.match(CODE, /tiles\.addEventListener\('dragover'/, '타일 구역이 dragover 를 안 듣는다');
  assert.match(CODE, /tiles\.addEventListener\('drop'/, '타일 구역이 drop 을 안 듣는다');
  const drop = sliceBlock(CODE, "tiles.addEventListener('drop', async (e) => {");
  assert.match(drop, /text\/x-goditor-project-id/, 'dataTransfer 키가 바뀌었다');
  assert.match(drop, /_assignToFolder\(\[projectId\], tile\.dataset\.folderKey\)/, '드롭이 그 타일 폴더로 배정하지 않는다');
  assert.match(drop, /renderGrid\(\)/, '드롭 뒤 다시 안 그린다');
});

test('PF-6 ★「+ 새 폴더」 타일은 드롭 대상이 아니다(뜻이 없다 — 레일 「전체」 거부 의도 이식)', () => {
  for (const ev of ['dragover', 'drop']) {
    const fn = sliceBlock(CODE, `tiles.addEventListener('${ev}', ` + (ev === 'drop' ? 'async (e) => {' : '(e) => {'));
    assert.match(fn, /classList\.contains\('ft-add'\)\) return/, `${ev} 가 「+ 새 폴더」 타일을 안 거른다`);
    assert.match(fn, /\.ft-tile\[data-folder-key\]/, `${ev} 대상이 폴더 타일로 한정되지 않는다`);
  }
});

test('PF-7 삭제 확인 문구가 사실대로 — 프로젝트는 지워지지 않고 미분류로 간다', () => {
  assert.match(CODE, /안에 있는 프로젝트는 지워지지 않고 «미분류»로 갑니다/, '삭제 확인 문구가 없거나 달라졌다');
});

test('PF-8 폴더 생성/이름변경은 prompt() 를 안 쓴다 — 인라인 input(.fr-name-input) 로 받는다', () => {
  for (const head of ['function startNewFolderTile() {', 'function startRenameFolder(id) {', 'function _swapToNameInput(']) {
    const fn = sliceBlock(CODE, head);
    assert.ok(!/window\.prompt\(|\bprompt\(/.test(fn), `★${head} 가 prompt() 를 쓴다 — Electron 이 차단한다`);
  }
  assert.match(sliceBlock(CODE, 'function _swapToNameInput('), /fr-name-input/, '인라인 input 을 안 쓴다');
  assert.match(sliceBlock(CODE, 'function startNewFolderTile() {'), /_swapToNameInput\(/, '새 폴더가 인라인 입력을 안 거친다');
});

test('PF-9 카드 메뉴(📁)에도 «미분류로 빼기 / 폴더들 / 새 폴더 만들어 넣기» 세 경로가 있다 — 새 폴더는 메뉴 안 인라인', () => {
  const fn = sliceBlock(CODE, 'async function openFolderMenuUI(');
  assert.match(fn, /미분류로 빼기/);
  assert.match(fn, /cfm-new-folder/);
  assert.match(fn, /_foldersCache\.map/);
  assert.ok(!/prompt\(/.test(fn), '★카드 메뉴가 아직 prompt() 를 쓴다');
  assert.ok(!/fr-add-folder/.test(fn), '★사라진 레일 버튼(#fr-add-folder)을 대체 경로로 가리킨다');
  assert.match(fn, /_swapToNameInput\(newItem/, '새 폴더를 메뉴 안 인라인 입력으로 안 받는다');
  assert.match(fn, /_assignToFolder\(\[projectId\], r2\.folder\.id\)/, '만든 폴더에 «이 카드»를 안 넣는다');
});

test('PF-10 목록 코어(main.js)와의 연결 — folders:list IPC 를 부른다(폴더 이름 캐시)', () => {
  assert.match(CODE, /window\.electronAPI\.folders\.list\(\)/, 'folders:list 를 안 부른다');
  assert.match(CODE, /window\.electronAPI\?\.folders/, 'folders API 존재 가드가 없다(구버전 preload 대비)');
});

test('PF-11 리스트뷰 예약폭 — 폴더 이동 버튼이 항상 뜨므로 4버튼 폭(110px)', () => {
  const m = /#project-grid\.is-list \.card-body \{[\s\S]*?padding:\s*6px\s+(\d+)px/.exec(CODE);
  assert.ok(m);
  assert.equal(Number(m[1]), 110);
});

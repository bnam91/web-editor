/* project-folders-ui.test.js — 폴더 레일(T-A) 정적 검사. project-search.test.js 와 같은 기법.
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

test('PF-1 폴더 레일이 실재한다 — aside#folder-rail + 새 폴더 버튼', () => {
  assert.match(CODE, /<aside id="folder-rail"/, '#folder-rail 이 없다');
  assert.match(CODE, /<button type="button" class="tab-add-item" id="fr-add-folder"/, '새 폴더 버튼이 없다');
});

test('PF-2 ★행은 새 클래스가 아니라 기존 .tab-add-item 을 재사용한다(디자인 게이트)', () => {
  // 정적 <aside> 는 껍데기뿐이고, 실제 행은 renderFolderRail() 이 JS 로 그린다 — 그 함수를 잰다.
  const fn = sliceBlock(CODE, 'function renderFolderRail() {');
  assert.match(fn, /class="tab-add-item/, '레일 행이 .tab-add-item 을 안 쓴다');
  assert.ok(!/class="fr-item/.test(fn), '★새 행 클래스(.fr-item 류)를 만들었다 — 재사용 원칙 위반');
});

test('PF-3 ★선택 표시 — 파란 액센트 금지, 배경은 border-mid 토큰뿐', () => {
  assert.match(CODE, /#folder-rail \.tab-add-item\.is-selected \{[^}]*var\(--ui-border-mid\)/,
    '선택 표시가 border-mid 토큰을 안 쓴다');
  const selRule = /#folder-rail \.tab-add-item\.is-selected \{[^}]*\}/.exec(CODE)[0];
  assert.ok(!/#2d6fe8/.test(selRule), '★폴더 선택 표시에 파란 액센트를 썼다');
});

test('PF-4 ⛔claudePM:folderMap 이름을 재사용하지 않는다(다른 용도로 이미 쓰임)', () => {
  const m = /const FOLDER_VIEW_KEY = '([^']+)'/.exec(CODE);
  assert.ok(m, 'FOLDER_VIEW_KEY 상수를 못 찾았다');
  assert.notEqual(m[1], 'claudePM:folderMap', '★클로드 터미널 패널의 folderMap 키와 충돌한다');
  assert.match(CODE, /claudePM:folderMap/, '(참고) claudePM:folderMap 은 여전히 다른 용도로 쓰인다 — 그대로 있어야 정상');
});

test('PF-5 드래그앤드롭 — 카드는 draggable, 레일은 dragover/drop 을 받는다', () => {
  assert.match(CODE, /card\.draggable = true/, '카드에 draggable 배선이 없다');
  assert.match(CODE, /rail\.addEventListener\('dragover'/, '레일이 dragover 를 안 듣는다');
  assert.match(CODE, /rail\.addEventListener\('drop'/, '레일이 drop 을 안 듣는다');
});

test('PF-6 ★「전체」 행은 드롭 대상이 아니다(뜻이 없다) — 빈 folderKey 를 거른다', () => {
  const fn = sliceBlock(CODE, "rail.addEventListener('drop', async (e) => {");
  assert.match(fn, /row\.dataset\.folderKey === ''/, '「전체」로의 드롭을 안 거른다');
});

test('PF-7 삭제 확인 문구가 사실대로 — 프로젝트는 지워지지 않고 미분류로 간다', () => {
  assert.match(CODE, /안에 있는 프로젝트는 지워지지 않고 «미분류»로 갑니다/, '삭제 확인 문구가 없거나 달라졌다');
});

test('PF-8 폴더 생성/이름변경은 prompt() 를 안 쓴다 — 레일 인라인 input(.fr-name-input) 로 받는다', () => {
  const addFn = sliceBlock(CODE, "document.getElementById('fr-add-folder').addEventListener('click', () => {");
  assert.ok(!/window\.prompt\(/.test(addFn), '★새 폴더 만들기가 window.prompt() 를 쓴다 — Electron 이 차단한다');
  assert.match(addFn, /fr-name-input/, '인라인 input 을 안 쓴다');
});

test('PF-9 카드 메뉴(📁)에도 «미분류로 빼기 / 폴더들 / 새 폴더 만들기» 세 경로가 있다', () => {
  const fn = sliceBlock(CODE, 'async function openFolderMenuUI(');
  assert.match(fn, /미분류로 빼기/);
  assert.match(fn, /cfm-new-folder/);
  assert.match(fn, /_foldersCache\.map/);
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

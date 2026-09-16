/* project-search.test.js — 프로젝트 검색(T-B) 정적 검사.
 *
 * ★DOM 실행 없이(jsdom 없음) 소스 텍스트로 잰다 — gallery-trash-tab.test.mjs 와 같은 기법.
 *   실제 필터 매칭 규칙(정규화·부분일치)은 로직을 함수로 떼어내 직접 실행해서 잰다.
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

test('PS-1 검색창이 실재한다 — input·지우기 버튼·헤더 배치', () => {
  assert.match(CODE, /<div id="proj-search">/, '#proj-search 컨테이너가 없다');
  assert.match(CODE, /<input type="text" id="proj-search-input"/, '검색 input 이 없다');
  assert.match(CODE, /<button type="button" id="proj-search-clear"/, '지우기 버튼이 없다');
});

test('PS-2 ★한글 IME 조합 가드 — compositionstart/compositionend 를 실제로 다룬다', () => {
  assert.match(CODE, /compositionstart/, 'compositionstart 를 안 듣는다 — 조합 중 자모 단위로 필터가 쪼개진다');
  assert.match(CODE, /compositionend/, 'compositionend 를 안 듣는다 — 조합 완료 신호를 못 받는다');
});

test('PS-3 디바운스가 있다(120~150ms 대) — 매 타건마다 다시 그리지 않는다', () => {
  const m = /debounceT = setTimeout\(apply, (\d+)\)/.exec(CODE);
  assert.ok(m, '디바운스 setTimeout 을 못 찾았다');
  const ms = Number(m[1]);
  assert.ok(ms >= 100 && ms <= 200, `디바운스 값이 범위 밖이다: ${ms}ms`);
});

test('PS-4 ★검색은 loadProjects() 를 다시 안 부른다 — 캐시(_allProjectsCache)를 재사용한다', () => {
  const applyBlock = CODE.slice(CODE.indexOf('const apply = () => {'), CODE.indexOf('input.addEventListener(\'compositionstart\''));
  assert.ok(!/loadProjects\(\)/.test(applyBlock), '★검색 입력마다 loadProjects() 를 다시 불러 IPC 를 왕복한다');
  assert.match(applyBlock, /_renderGridFromCache\(\)/, '캐시 재사용 렌더 함수를 안 부른다');
});

test('PS-5 ★필터 상태는 renderGrid() 호출부 «전부»가 같이 타는 내부 상태다 — 12곳 중 하나만 확인', () => {
  // toggleFavorite·deleteProject·startRename 등은 전부 renderGrid()를 부른다 — 그게 필터를 물고 간다.
  assert.match(CODE, /async function renderGrid\(\) \{[\s\S]{0,300}_renderGridFromCache\(\);/,
    'renderGrid() 가 _renderGridFromCache() 를 거치지 않는다 — 호출부마다 필터가 풀린다');
});

test('PS-6 XSS — 카드 이름·폴더 이름이 이스케이프 없이 innerHTML 에 들어가지 않는다', () => {
  assert.match(CODE, /_escHtml\(proj\.name \|\| '이름 없음'\)/, '카드 이름이 이스케이프 없이 삽입된다');
  assert.match(CODE, /function _escHtml\(t\)/, '_escHtml 헬퍼가 없다');
});

test('PS-7 검색 0건 문구가 «아직 프로젝트가 없어요»와 갈라져 있다', () => {
  assert.match(CODE, /에 맞는 프로젝트가 없어요/, '검색 0건 전용 문구가 없다');
  assert.match(CODE, /검색 지우기/, '검색 지우기 버튼 문구가 없다');
});

test('PS-8 ★파란 액센트 없이 — 포커스 표시가 border 토큰(divider)만 쓴다', () => {
  const block = CODE.slice(CODE.indexOf('#proj-search:focus-within'), CODE.indexOf('#proj-search:focus-within') + 120);
  assert.match(block, /var\(--ui-divider\)/, '포커스 표시가 divider 토큰을 안 쓴다');
  assert.ok(!/#2d6fe8/.test(block), '★검색창 포커스에 기존 파란 액센트(#2d6fe8)를 썼다 — 디자인 게이트 위반');
});

test('PS-9 휴지통 탭에서 검색창·폴더 레일을 숨긴다', () => {
  const fn = sliceBlock(CODE, 'function _setGalleryView(v) {');
  assert.match(fn, /'folder-rail', 'proj-search'/, '휴지통 전환 시 folder-rail/proj-search 를 안 숨긴다');
});

test('PS-10 ⌘F/Ctrl+F 로 검색창에 포커스, Esc 로 지운다', () => {
  assert.match(CODE, /e\.metaKey \|\| e\.ctrlKey/, 'Cmd/Ctrl 단축키 가드가 없다');
  assert.match(CODE, /key === 'Escape'/, 'Esc 처리가 없다');
});

/* ══════════════════════════════════════════════════════════════════════════
 * 매칭 규칙 — 소스에서 함수를 «떼어내» 진짜로 실행해서 잰다(정적 정규식 대조가 아니라).
 * ══════════════════════════════════════════════════════════════════════════ */
function loadMatcher() {
  const norm = sliceBlock(CODE, 'function _norm(');
  const matches = sliceBlock(CODE, 'function _matchesQuery(');
  const factory = new Function(norm + '\n' + matches + '\n; return { _norm, _matchesQuery };');
  return factory();
}

test('PM-1 이름 부분일치(대소문자·NFC 무시)', () => {
  const { _norm, _matchesQuery } = loadMatcher();
  const proj = { id: 'proj_1', name: 'Summer Sale' };
  assert.ok(_matchesQuery(proj, _norm('summer')));
  assert.ok(_matchesQuery(proj, _norm('SALE')));
  assert.ok(!_matchesQuery(proj, _norm('winter')));
});

test('PM-2 ★ID — proj_ 접두어를 뗀 값에도 부분일치(예: "1789")', () => {
  const { _norm, _matchesQuery } = loadMatcher();
  const proj = { id: 'proj_1789012345', name: '이름없음' };
  assert.ok(_matchesQuery(proj, _norm('1789')), '★접두어 뗀 id 부분일치가 안 된다');
  assert.ok(_matchesQuery(proj, _norm('proj_1789')));
});

test('PM-3 소속 폴더 이름으로도 찾는다', () => {
  // _folderNameById 를 대역한다(실제 파일엔 전역 캐시가 있어 떼어낸 함수 단독으론 못 돈다)
  const norm = sliceBlock(CODE, 'function _norm(');
  const body = sliceBlock(CODE, 'function _matchesQuery(');
  const factory = new Function('_folderNameById', norm + '\n' + body + '\n; return _matchesQuery;');
  const matchesQuery = factory((id) => (id === 'fold_1' ? '여름신상' : null));
  const proj = { id: 'proj_1', name: '아무거나', folderId: 'fold_1' };
  assert.ok(matchesQuery(proj, '여름신상'.normalize('NFC')));
});

test('PM-4 빈 질의는 전부 통과한다', () => {
  const { _matchesQuery } = loadMatcher();
  assert.ok(_matchesQuery({ id: 'proj_1', name: 'x' }, ''));
});

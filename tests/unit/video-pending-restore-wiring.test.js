/* video-pending-restore-wiring.test.js — T-033 범위확장 «원문 게이트» (2026-09-15)
 *
 * ★배경
 *   video-pending(트림 확정 전 영상)이 undo 뿐 아니라 «캔버스를 통째로 갈아 앉히는 모든
 *   복원 경로»(페이지 전환 switchPage · 페이지 삭제 후 남은 페이지 deletePage · 탭전환/
 *   프로젝트로드/브랜치전환이 공유하는 applyProjectData)에서 같은 이유로 샌다는 지적을
 *   받았다(js/io/section-serialize.js 의 T-012 세척이 그 경로들이 쓰는 page.canvas 문자열도
 *   거치기 때문). 낱개로 각 지점에 reattachVideoPendingBlocks 를 심으면 «하나 빠뜨리는 날
 *   그 경로만 샌다»(팀리드 지적) — 그래서 그 모든 경로가 공통으로 거치는 rebindAll(js/io/
 *   save-load.js) «한 곳»에만 심었다(js/history.js 의 restoreSnapshot/restoreSnapshotScoped
 *   가 중복으로 부르던 것도 제거해 단일 진실원으로 좁혔다).
 *
 * ★이 파일이 재는 것 — «문장이 있나»(원문 게이트). 렌더 결과는 tests/dom/
 *   video-pending-undo-reattach.dom.spec.js 가 section-serialize.js 자체 로직을 실물로
 *   잰다. save-load.js/editor.js 는 에디터 전역(state·electronAPI·DOM 부트스트랩)이 통째로
 *   필요해 이 레포의 다른 unit 테스트들과 같은 이유로 실행 하네스에 못 얹는다 — 그래서 여기는
 *   «배선이 끊기지 않았나»만 지킨다(scratch-paste-dup.test.js 와 같은 한계).
 *
 * ⛔주석 거르기는 tests/unit/_strip-comments.js 의 makeStripper «만» 쓴다.
 * ⛔고정 창(slice) 금지 — 함수 몸통은 중괄호를 세어 떼어낸다(template-marker-leak.dom.spec.js
 *   의 extractFn 과 같은 방식, 이 파일 것은 async 함수도 받게 정규식만 넓혔다).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeStripper } = require('./_strip-comments');

const ROOT = path.join(__dirname, '..', '..');
const readSrc = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

/** 함수 «몸통»을 중괄호 균형으로 떠낸다 — function/async function 둘 다 받는다. */
function extractFn(src, name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  const start = m.index;
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

/** 함수 몸통에서 주석을 걷어낸 «코드만»을 한 문자열로 돌려준다 — includes 가 주석 속
 *  문구에 «속아 초록나는» 걸 막는다(이 레포의 house rule). */
function codeOnly(fnSrc) {
  const strip = makeStripper();
  return fnSrc.split('\n').map(strip).join('\n');
}

const SAVE_LOAD_SRC = readSrc('js', 'io', 'save-load.js');
const HISTORY_SRC   = readSrc('js', 'history.js');
const EDITOR_SRC     = readSrc('js', 'editor.js');

const REBIND_ALL_BODY        = codeOnly(extractFn(SAVE_LOAD_SRC, 'rebindAll'));
const SWITCH_PAGE_BODY       = codeOnly(extractFn(SAVE_LOAD_SRC, 'switchPage'));
const DELETE_PAGE_BODY       = codeOnly(extractFn(SAVE_LOAD_SRC, 'deletePage'));
const APPLY_PROJECT_DATA_BODY = codeOnly(extractFn(SAVE_LOAD_SRC, 'applyProjectData'));
const RESTORE_SNAPSHOT_BODY  = codeOnly(extractFn(HISTORY_SRC, 'restoreSnapshot'));
const RESTORE_SCOPED_BODY    = codeOnly(extractFn(HISTORY_SRC, 'restoreSnapshotScoped'));

test('W0 ★뗀 몸통들이 비어 있지 않다 (아래 초록이 빈 함수의 초록이 아니다)', () => {
  for (const [name, body] of [
    ['rebindAll', REBIND_ALL_BODY], ['switchPage', SWITCH_PAGE_BODY],
    ['deletePage', DELETE_PAGE_BODY], ['applyProjectData', APPLY_PROJECT_DATA_BODY],
    ['restoreSnapshot', RESTORE_SNAPSHOT_BODY], ['restoreSnapshotScoped', RESTORE_SCOPED_BODY],
  ]) {
    assert.ok(body.length > 80, `${name} 을 못 뗐다`);
  }
});

test('W1 ★rebindAll 이 reattachVideoPendingBlocks 를 부른다 — 단일 진실원', () => {
  assert.match(REBIND_ALL_BODY, /window\.reattachVideoPendingBlocks\??\.\(/,
    '★rebindAll 이 video-pending 재연결을 안 부른다 — 이 함수를 거치는 모든 복원 경로가 샌다');
});

test('W2 ★페이지 전환(switchPage)이 rebindAll 을 거친다 — 직접 손대지 않는다', () => {
  assert.match(SWITCH_PAGE_BODY, /\brebindAll\(\)/,
    '★switchPage 가 rebindAll 을 안 부른다 — page.canvas(세척된 문자열) 복원 뒤 video-pending 재연결 경로가 없다');
});

test('W3 ★페이지 삭제 후 남은 페이지 복원(deletePage)도 rebindAll 을 거친다', () => {
  assert.match(DELETE_PAGE_BODY, /\brebindAll\(\)/,
    '★deletePage 의 활성페이지 복원 분기가 rebindAll 을 안 부른다');
});

test('W4 ★applyProjectData(탭전환·프로젝트로드·브랜치전환 공유 지점)가 rebindAll 을 거친다', () => {
  assert.match(APPLY_PROJECT_DATA_BODY, /\brebindAll\(\)/,
    '★applyProjectData 가 rebindAll 을 안 부른다 — 탭전환/프로젝트로드/브랜치전환 전부가 새는 경로가 된다');
});

test('W5 ★undo(restoreSnapshot)도 rebindAll 을 거친다 — 중복 재연결 호출을 직접 들고 있지 않다', () => {
  assert.match(RESTORE_SNAPSHOT_BODY, /\brebindAll\(\)/, 'restoreSnapshot 이 rebindAll 을 안 부른다');
  assert.doesNotMatch(RESTORE_SNAPSHOT_BODY, /reattachVideoPendingBlocks/,
    '★restoreSnapshot 이 reattachVideoPendingBlocks 를 «직접» 부른다 — rebindAll 과 중복이다(단일 진실원 원칙 위반, drift 위험)');
});

test('W6 ★스코프 undo(restoreSnapshotScoped)도 rebindAll 을 거친다 — 중복 호출 없음', () => {
  assert.match(RESTORE_SCOPED_BODY, /\brebindAll\(\)/, 'restoreSnapshotScoped 가 rebindAll 을 안 부른다');
  assert.doesNotMatch(RESTORE_SCOPED_BODY, /reattachVideoPendingBlocks/,
    '★restoreSnapshotScoped 가 reattachVideoPendingBlocks 를 «직접» 부른다 — rebindAll 과 중복이다');
});

test('W7 ★섹션 복사(editor.js)가 raw outerHTML 대신 세척된 clone 을 clipboard 에 담는다', () => {
  const m = /clipboard\s*=\s*\{\s*type:\s*'section'\s*,\s*html:\s*([^}]+)\}/.exec(EDITOR_SRC);
  assert.ok(m, '★섹션 복사 대입문을 못 찾았다 — editor.js 구조가 바뀌었다(이 검사를 다시 겨냥해야 한다)');
  const rhs = m[1].trim();
  assert.match(rhs, /serializeSectionClone\(/,
    `★섹션 복사가 여전히 raw outerHTML 이다("${rhs}") — video-pending 원본이 세척 없이 클립보드로 한 벌 더 샌다`);
  assert.doesNotMatch(rhs, /\.outerHTML\s*$/,
    `★섹션 복사 대입식이 outerHTML 로 끝난다("${rhs}") — 클론 세척을 거치지 않는 옛 경로로 보인다`);
});

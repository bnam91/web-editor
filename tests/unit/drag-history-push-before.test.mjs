/* U-DRAGHIST — 드래그 제스처가 히스토리에 «양쪽 끝»을 다 남기는가.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스만 읽는다(라이브 무접촉).
 *
 * ★[0920b-resize-undo] 현빈 2026-09-20 「원 도형 추가 후 «최초» 모서리 핸들로 키운 뒤 ⌘Z →
 *   크기가 되돌려지는 게 아니라 블록 삽입된 게 사라진다」.
 *
 * ★원인은 도형이 아니라 «규약이 두 벌»이라는 것 — pushHistory 는 부르는 그 순간의 캔버스를
 *   찍으므로 스택은 «표본의 줄»이다. 바꾸기 «전»에 찍는 자리(109)와 바꾼 «뒤»에 찍는
 *   자리(258)가 섞이면 이음매에서 표본이 빠지거나(⌘Z 가 둘을 같이 먹음) 겹친다(⌘Z 먹통).
 *   ⇒ 전수 개종은 사정거리 밖이므로, «드래그는 양쪽 끝을 다 찍는다»로 어느 이웃과도
 *     맞물리게 했다. 겹친 표본은 js/history.js 의 무변화 중복 차단이 버린다.
 *     (설명은 js/drag-history.js 머리말 · js/CLAUDE.md 「히스토리 규약」)
 *
 * ★이 검사가 «자물쇠»다. 드래그 자리가 다시 «한쪽 끝만» 찍는 모양으로 돌아가는 걸 막는다.
 *   이 레포는 「선례가 결함을 복제」를 실물로 겪었다(_slice-block.js 서문). 규약은 문서만으로
 *   안 지켜진다 — 기계가 세야 한다.
 *
 * ⛔새 드래그 핸들러를 만들 때 ROSTER 에 «안» 적고 넘어가지 마라. 적으면 이 검사가 지킨다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sliceBlock } from './_slice-block.js';
import { makeStripper } from './_strip-comments.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

/** 파일 하나를 «주석 없는» 소스로 읽는다(주석 속 pushHistory 가 검사를 속이지 못하게). */
function readCode(rel) {
  const strip = makeStripper();
  return fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').map(strip).join('\n');
}
const SRC = new Map();
const code = (rel) => { if (!SRC.has(rel)) SRC.set(rel, readCode(rel)); return SRC.get(rel); };

/* ── 로스터 — 「제스처마다 beginDragHistory 하나」. 파일 : 라벨 목록 ──────────────────
   라벨은 undo 버튼 툴팁에 그대로 뜨는 값이자, 이 검사가 자리를 찾는 열쇠다. */
const ROSTER = {
  'js/block-drag.js': ['도형 크기', '블록 이동', '블록 이동', '블록 이동'],
  'js/overlay-handles.js': [
    '프레임 회전', '프레임 크기', '프레임 모서리', '목업 크기', '아이콘 크기',
    '에셋 모서리', '에셋 크기', '모달 모서리', '모달 크기', '아이콘서클 크기',
    '카드 모서리', '카드 크기', '벡터 크기',
    /* 2026-09-20 통합(int/0920b) — T-068 오버레이 텍스트 모서리. 원래는 «시작 표본만» 찍는
       옛 push-before 꼴이었는데, 그 꼴이면 이 드래그 «뒤»에 push-after 동작이 오는 순간
       ⌘Z 한 번이 그 동작과 크기를 같이 먹는다(이 파일 머리말 ⑴). 규약으로 맞췄다. */
    '오버레이 텍스트 크기',
  ],
  'js/sticker-select.js': ['형광펜 선 끝점 이동', '스티커 회전', '스티커 크기 조절', '선 형광펜 이동', '스티커 이동'],
  'js/asset-rotate.js': ['이미지 블록 회전', '쉐이프 회전', "(cfg.historyLabel || '회전')"],
  'js/gradient-select.js': ['그라데이션 리사이즈', '그라데이션 이동'],
  'js/annotation-select.js': ['어노테이션 이동', '어노테이션 핸들 이동'],
  'js/blocks/canvas-block.js': ['카드 이미지 위치'],
  'js/blocks/mockup-block.js': ['목업 오프셋'],
  'js/props/asset-video-trim.js': ['영상 트림 구간 조절'],
  'js/image-handling.js': ['이미지 위치 조절', '배경 위치 조절'],
};

test('★제스처마다 beginDragHistory 가 «하나»다 — 0이면 규약 밖, 2+면 항목이 두 개 쌓인다', () => {
  for (const [file, labels] of Object.entries(ROSTER)) {
    const hits = [...code(file).matchAll(/beginDragHistory\?\.\(([^;]*?)\)\s*;/g)].map(m => m[1].trim());
    const want = labels.map(l => (l.startsWith('(') ? l : `'${l}'`));
    assert.deepEqual(hits, want,
      `${file}: beginDragHistory 목록이 로스터와 다르다.\n  잰 것: ${JSON.stringify(hits)}\n  적힌 것: ${JSON.stringify(want)}\n` +
      '  ⇒ 새 드래그를 만들었으면 로스터에 적어라. 지웠으면 왜 지웠는지 여기 남겨라.');
  }
});

test('★모든 beginDragHistory 는 제 짝 arm() 을 «쓰기 전»에 부른다', () => {
  for (const file of Object.keys(ROSTER)) {
    const s = code(file);
    const opens = [...s.matchAll(/beginDragHistory\?\.\(/g)].map(m => m.index);
    const arms  = [...s.matchAll(/\barm\(/g)].map(m => m.index);
    assert.equal(arms.length, opens.length, `${file}: arm() 수(${arms.length}) 가 제스처 수(${opens.length}) 와 다르다`);
    for (let i = 0; i < opens.length; i++) {
      assert.ok(arms[i] > opens[i], `${file}: ${i + 1}번째 arm() 이 선언보다 앞이다`);
      if (i + 1 < opens.length) {
        assert.ok(arms[i] < opens[i + 1],
          `${file}: ${i + 1}번째 제스처가 arm() 없이 다음 제스처로 넘어간다 — 시작 표본이 안 찍힌다`);
      }
    }
  }
});

/* ⚠️이 검사가 이벨류에이터 ④(줌 150% 에서 1px 조정이 무동작)의 «자물쇠»다.
   arm() 은 히스토리만 연다. 그 반환값으로 쓰기를 막으면 임계 미만 틱의 «변형»까지 사라진다. */
test('★⛔arm() 의 반환값으로 early-return 하지 않는다 — 임계가 «쓰기»를 삼키면 안 된다', () => {
  const bad = [];
  for (const file of Object.keys(ROSTER)) {
    const s = code(file);
    for (const m of s.matchAll(/^.*\barm\(.*$/gm)) {
      const line = m[0];
      if (/\breturn\b/.test(line) || /if\s*\([^)]*!\s*\w*\.?arm\(/.test(line)) bad.push(`${file}: ${line.trim()}`);
    }
    // 두 줄로 쪼갠 꼴(`if (!h.arm(dx,dy))` 다음 줄 `return;`)도 잡는다
    for (const m of s.matchAll(/if\s*\([^)]*\barm\([^)]*\)[^)]*\)\s*\n?\s*return/g)) bad.push(`${file}: ${m[0].replace(/\s+/g, ' ')}`);
  }
  assert.deepEqual(bad, [], `arm() 반환값이 쓰기를 막고 있다:\n  ${bad.join('\n  ')}`);
});

/* ── 「끝 표본」도 있어야 한다 — 한쪽만 찍으면 이음매에서 다시 갈린다 ──────────────────
   ⚠️이 검사가 이벨류에이터 ①(회귀)의 «자물쇠»다. 1차 수정은 onUp 의 pushHistory 를 «떼고»
     onMove 로 옮겼는데, 그러면 규약이 통일된 게 아니라 이음매가 옮겨갈 뿐이라 고친 드래그
     뒤에 push-after 동작이 오는 순간 ⌘Z 가 둘을 같이 먹었다. 그 모양으로 돌아가면 여기서 걸린다. */
const GESTURE_SPAN = 220;   // 한 제스처(mousedown~onUp)가 차지하는 줄 수의 넉넉한 상한

test('★제스처마다 «끝 표본»(onUp 의 pushHistory)이 시작 표본과 «짝»으로 있다', () => {
  const bad = [];
  for (const [file, labels] of Object.entries(ROSTER)) {
    const lines = code(file).split('\n');
    const opens = [];
    lines.forEach((l, i) => { if (/beginDragHistory\?\.\(/.test(l)) opens.push(i); });
    opens.forEach((ln, k) => {
      const end = Math.min(k + 1 < opens.length ? opens[k + 1] : lines.length, ln + GESTURE_SPAN);
      const region = lines.slice(ln, end);
      if (!region.some(l => /pushHistory/.test(l))) bad.push(`${file}:${ln + 1} (${labels[k]})`);
    });
  }
  assert.deepEqual(bad, [],
    '끝 표본이 없는 제스처:\n  ' + bad.join('\n  ') +
    '\n  ⇒ onUp 의 pushHistory 를 «떼지» 마라. 떼면 이 드래그 «뒤»에 오는 push-after 동작과의' +
    '\n    사이에 표본이 빠져 ⌘Z 한 번이 둘을 같이 먹는다(2026-09-20 실측된 회귀).');
});

/* ── 허용목록 — 「이 자리는 이래도 되는」 이유를 여기 박아 둔다 ────────────────────── */

test('허용① js/scratch-pad.js — 캔버스는 그대로고 sideEffects 로 역동작을 «명시»한다', () => {
  const SP = code('js/scratch-pad.js');
  const i = SP.indexOf('pushHistory');
  assert.ok(i !== -1, 'scratch-pad 의 pushHistory 가 사라졌다 — 의도한 변경인지 확인할 것');
  const near = SP.slice(i, i + 400);
  assert.match(near, /sideEffects|onUndo|onRedo/,
    'sideEffects 없이 찍고 있다 — 그러면 history.js 의 무변화 차단이 이 항목을 버린다(되돌릴 역동작이 사라진다)');
});

test('허용② js/block-drag.js 드래그아웃 — 한 제스처에 끝 표본은 «하나»(추출까지 끝난 뒤)', () => {
  const BD = code('js/block-drag.js');
  const i = BD.indexOf('draggedOutside && _dragOutParentFrame');
  assert.ok(i !== -1, '드래그아웃 분기를 못 찾았다 — 리팩터링됐나?');
  const branch = BD.slice(i, BD.indexOf('return;', i));
  const iMut = branch.search(/dragEl\.style\.|delete dragEl\.dataset\.|inner\.(insertBefore|appendChild)\(/);
  const iPush = branch.indexOf('pushHistory');
  assert.ok(iMut !== -1, '추출 변형을 못 찾았다');
  assert.ok(iPush !== -1, '드래그아웃이 끝 표본을 안 남긴다');
  assert.ok(iPush > iMut,
    'pushHistory 가 추출 «앞»에 있다 — 시작 표본은 이미 onMove 가 찍었으므로 여기 또 찍으면 한 제스처가 두 항목이 된다');
});

test('허용③ js/overlay-handles.js 그리드 거터 둘 — 시작은 mousedown, 끝은 onUp', () => {
  for (const fn of ['_onGridColMouseDown', '_onGridRowMouseDown']) {
    const h = sliceBlock(code('js/overlay-handles.js'), `function ${fn}(`);
    const iPush = h.indexOf('pushHistory');
    const iMove = h.indexOf('function onMove(');
    assert.ok(iPush !== -1 && iPush < iMove, `${fn}: 시작 표본(mousedown 1회)이 사라졌다`);
    const onUp = sliceBlock(h, 'function onUp(');
    assert.match(onUp, /pushHistory/,
      `${fn}: 끝 표본이 없다 — 다음 동작이 push-after 면 ⌘Z 한 번이 둘을 같이 먹는다`);
  }
});

/* ── 부품 자신의 계약 ──────────────────────────────────────────────────────────── */

const DH = () => fs.readFileSync(path.join(ROOT, 'js/drag-history.js'), 'utf8');

test('★부품 — «움직이기만 하면» 열고, 완전 정지엔 안 열고, 여는 건 한 번뿐', () => {
  const pushed = [];
  const w = { pushHistory: (l) => pushed.push(l) };
  new Function('window', DH())(w);
  const h = w.beginDragHistory('도형 크기');
  assert.equal(h.arm(0, 0), false, '완전 정지(0,0)에서 열렸다 — 맨클릭이 항목을 만든다');
  assert.deepEqual(pushed, []);
  /* ★줌 150% 에서 화면 1px = 캔버스 0.67px. 이게 «안» 열리면 그 틱의 리사이즈가
     되돌릴 수 없는 편집이 된다(예전 기본 임계 1px 이 그랬다). */
  assert.equal(h.arm(0.67, 0), true, '캔버스 0.67px(=150% 줌의 화면 1px)에서 안 열렸다');
  assert.deepEqual(pushed, ['도형 크기']);
  assert.equal(h.arm(99, 99), true);
  assert.deepEqual(pushed, ['도형 크기'], '두 번 찍었다 — 한 제스처에 시작 표본은 «하나»다');
  assert.equal(h.armed, true);
});

test('★부품 — 시작 표본의 라벨은 «직전 항목»의 이름을 물려받는다(undo 툴팁이 맞아야 한다)', () => {
  /* 되돌리기 버튼은 historyStack[pos].action 을 보여주는데 실제로 복원되는 건 [pos-1] 이다
     (js/history.js _updateUndoRedoBtns). 시작 표본이 가리키는 되돌리기는 «이 드래그»가 아니라
     «직전에 끝난 동작»이므로 그 이름을 써야 「실행 취소: 도형 추가」로 정확히 뜬다. */
  const pushed = [];
  const w = { pushHistory: (l) => pushed.push(l), getHistoryTip: () => ({ action: '도형 추가' }) };
  new Function('window', DH())(w);
  w.beginDragHistory('도형 크기').arm(5, 0);
  assert.deepEqual(pushed, ['도형 추가']);
});

test('★부품 — pushHistory·getHistoryTip 이 없어도 던지지 않는다(초기 로드·하네스)', () => {
  const w = {};
  new Function('window', DH())(w);
  assert.equal(w.beginDragHistory('x').arm(10, 10), true);
  const w2 = { pushHistory: () => { throw new Error('should not be called'); },
               getHistoryTip: () => { throw new Error('tip boom'); } };
  new Function('window', DH())(w2);
  const pushed = [];
  w2.pushHistory = (l) => pushed.push(l);
  w2.beginDragHistory('라벨').arm(1, 1);
  assert.deepEqual(pushed, ['라벨'], 'getHistoryTip 이 던져도 제 라벨로 떨어져야 한다');
});

test('★index.html 이 drag-history.js 를 «플레인 스크립트»로, 모듈보다 «먼저» 싣는다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const i = html.indexOf('js/drag-history.js');
  assert.ok(i !== -1, 'index.html 에 drag-history.js 가 없다 — window.beginDragHistory 가 undefined 가 된다');
  const tag = html.slice(html.lastIndexOf('<script', i), i);
  assert.doesNotMatch(tag, /type=["']module["']/,
    'type="module" 로 실었다 — sticker-select.js 같은 플레인 스크립트에서 못 본다');
  assert.doesNotMatch(tag, /\bdefer\b/,
    'defer 로 실었다 — 핸들러 바인딩보다 늦게 붙을 수 있다');
});

/* ── history.js 무변화 중복 차단 — 소스 계약(행동은 DOM 스펙 D1) ─────────────────── */
test('★history.js — 무변화 중복 차단이 sideEffects 를 «예외»로 둔다', () => {
  const H = code('js/history.js');
  const i = H.indexOf('function pushHistory(');
  const body = sliceBlock(H.slice(i), 'function pushHistory(');
  assert.match(body, /!sideEffects[\s\S]{0,200}?_sameEdit\(_top\.canvas, _canvas\)/,
    '무변화 차단이 없거나 sideEffects 예외가 빠졌다 — 스크래치패드 되돌리기가 죽는다');
  const iSkip = body.indexOf('return;');
  const iSlice = body.indexOf('historyStack.slice(');
  assert.ok(iSkip !== -1 && iSkip < iSlice,
    '건너뛰기가 slice(redo 꼬리 자르기) «뒤»에 있다 — 아무것도 안 바꾼 호출이 redo 를 죽인다');
});

test('★history.js — 비교자가 «편집이 아닌» 속성을 벗긴다(저장 문자열은 안 바꾼다)', () => {
  const H = code('js/history.js');
  assert.match(H, /_NON_EDIT_ATTR_RE[\s\S]{0,80}draggable/,
    'draggable 정규화가 사라졌다 — 리사이즈→회전 사이에 먹통 ⌘Z 한 칸이 되살아난다(2026-09-20 실측)');
  /* ★2026-09-21: 벗기기가 _sameEdit 안에서 _stripNonEdit 로 빠졌다(섹션 툴바까지 같이 벗기려고).
     그래서 «어디서 벗기나»가 아니라 «비교자가 벗기기를 «실제로» 지나가나»를 잰다. */
  const fn = sliceBlock(H.slice(H.indexOf('function _sameEdit(')), 'function _sameEdit(');
  const strip = sliceBlock(H.slice(H.indexOf('function _stripNonEdit(')), 'function _stripNonEdit(');
  assert.match(fn, /_stripNonEdit\(a\)\s*===\s*_stripNonEdit\(b\)/,
    '비교자가 벗기기를 실제로 지나가지 않는다');
  assert.match(strip, /replace\(_NON_EDIT_ATTR_RE/, '벗기기가 정규화를 실제로 쓰지 않는다');
  assert.doesNotMatch(H, /_canvas\s*=\s*_canvas\.replace|_canvas\.replace\(_NON_EDIT_ATTR_RE/,
    '★«저장되는» 스냅샷 문자열까지 벗기고 있다 — 되돌리면 draggable 이 사라진다');
});

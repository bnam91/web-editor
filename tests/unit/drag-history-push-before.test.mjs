/* U-DRAGHIST — 드래그 핸들러 14자리가 「히스토리는 «바꾸기 전»에 1회」 규약을 지키는가.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스만 읽는다(라이브 무접촉).
 *
 * ★[0920b-resize-undo] 현빈 2026-09-20 「원 도형 추가 후 «최초» 모서리 핸들로 키운 뒤 ⌘Z →
 *   크기가 되돌려지는 게 아니라 블록 삽입된 게 사라진다」.
 *   원인은 도형이 아니라 «규약이 두 벌»이었다는 것 — block-factory 는 바꾸기 «전»에 찍고
 *   (push-before), 드래그류는 onUp 에서 바꾼 «뒤»에 찍었다(push-after). 각각 혼자 쓰면
 *   일관되지만 섞이면 그 이음매에서 항목 한 칸이 통째로 빈다(설명은 js/CLAUDE.md).
 *
 * ★이 검사가 «자물쇠»다. 14자리가 다시 갈라지는 걸 막는다.
 *   이 레포는 「선례가 결함을 복제」를 실물로 겪었다(_slice-block.js 서문). 규약은
 *   문서만으로 안 지켜진다 — 기계가 세야 한다.
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

const OH = readCode('js/overlay-handles.js');
const BD = readCode('js/block-drag.js');
const SRC = { 'js/overlay-handles.js': OH, 'js/block-drag.js': BD };

/* ── P0 로스터 — 「첫 실제 이동 직전에 1회」로 통일한 드래그 핸들러 14자리 ────────────── */
const ROSTER = [
  ['js/block-drag.js',      '_onShapeHandleMouseDown',        '도형 크기'],
  ['js/overlay-handles.js', '_onFrameRotateMouseDown',        '프레임 회전'],
  ['js/overlay-handles.js', '_onHandleMouseDown',             '프레임 크기'],
  ['js/overlay-handles.js', '_onRadiusHandleMouseDown',       '프레임 모서리'],
  ['js/overlay-handles.js', '_onMockupHandleMouseDown',       '목업 크기'],
  ['js/overlay-handles.js', '_onIconHandleMouseDown',         '아이콘 크기'],
  ['js/overlay-handles.js', '_onAssetRadiusHandleMouseDown',  '에셋 모서리'],
  ['js/overlay-handles.js', '_onAssetResizeHandleMouseDown',  '에셋 크기'],
  ['js/overlay-handles.js', '_onModalRadiusHandleMouseDown',  '모달 모서리'],
  ['js/overlay-handles.js', '_onModalResizeHandleMouseDown',  '모달 크기'],
  ['js/overlay-handles.js', '_onIcbResizeMouseDown',          '아이콘서클 크기'],
  ['js/overlay-handles.js', '_onCanvasRadiusHandleMouseDown', '카드 모서리'],
  ['js/overlay-handles.js', '_onCanvasResizeHandleMouseDown', '카드 크기'],
  ['js/overlay-handles.js', '_onVectorResizeHandleMouseDown', '벡터 크기'],
];

/** 「이 줄부터 DOM/모델이 바뀐다」를 알리는 첫 토큰. 이름 명부가 아니라 «쓰기의 모양»이다. */
/* ⚠️«읽기»는 세면 안 된다 — 모든 onMove 가 첫 줄에서 `scaler.style.transform` 으로 배율을
   읽는다. 그래서 대입(`= `)까지 본다. 이걸 놓치면 14자리 전부 거짓 빨강이 된다(실측). */
const MUTATE_RE = /\w+\.style\.[\w-]+\s*=[^=]|\w+\.style\.cssText\s*=[^=]|\w+\.dataset\.\w+\s*=[^=]|\.setAttribute\(|\brender[A-Z]\w*\(|\bsetModalSizeMode\(|\b_composeFrameTransform\(/;

const handler = (file, name) => sliceBlock(SRC[file], `function ${name}(`);

test('★14자리 전부 onUp 에 pushHistory 가 «없다» — 있으면 첫 ⌘Z 가 앞 동작까지 먹는다', () => {
  const bad = [];
  for (const [file, name] of ROSTER) {
    const onUp = sliceBlock(handler(file, name), 'function onUp(');
    if (/pushHistory/.test(onUp)) bad.push(`${file} ${name}`);
  }
  assert.deepEqual(bad, [], `onUp 에서 찍는 자리가 남았다(push-after 재발): ${bad.join(', ')}`);
});

test('★14자리 전부 제스처마다 beginDragHistory 를 «하나» 연다 — 라벨도 같이 고정한다', () => {
  for (const [file, name, label] of ROSTER) {
    const h = handler(file, name);
    const hits = h.match(/beginDragHistory\?\.\(/g) || [];
    assert.equal(hits.length, 1,
      `${file} ${name}: beginDragHistory 가 ${hits.length}개다 — 0이면 규약 밖, 2+면 항목이 2개 쌓인다`);
    assert.ok(h.includes(`beginDragHistory?.('${label}')`),
      `${file} ${name}: 라벨이 '${label}' 이 아니다 — undo 버튼 툴팁에 그대로 뜨는 값이다`);
    // ★선언은 onMove «밖»이어야 한다. 안에 있으면 mousemove 마다 새로 열려 매 틱 push 한다.
    const iDecl = h.indexOf('beginDragHistory');
    const iMove = h.indexOf('function onMove(');
    assert.ok(iDecl !== -1 && iMove !== -1 && iDecl < iMove,
      `${file} ${name}: beginDragHistory 가 onMove «안»에 있다 — 틱마다 항목이 쌓인다`);
  }
});

test('★14자리 전부 onMove 의 arm() 이 «첫 쓰기보다 앞»이다 — 뒤면 규약이 뒤집힌 것과 같다', () => {
  for (const [file, name] of ROSTER) {
    const onMove = sliceBlock(handler(file, name), 'function onMove(');
    const iArm = onMove.search(/_hist\s*&&\s*!_hist\.arm\(/);
    assert.ok(iArm !== -1, `${file} ${name}: onMove 에 arm() 가드가 없다`);
    const m = MUTATE_RE.exec(onMove);
    assert.ok(m, `${file} ${name}: onMove 에서 «쓰기»를 못 찾았다 — MUTATE_RE 를 넓혀야 하나?`);
    assert.ok(iArm < m.index,
      `${file} ${name}: arm() 이 첫 쓰기(${m[0]}) «뒤»에 있다 — 그 한 틱이 히스토리 밖으로 샌다`);
  }
});

test('★arm 의 델타는 «캔버스 좌표»다 — 화면 px 로 재면 40% 줌에서 임계가 2.5배가 된다', () => {
  for (const [file, name] of ROSTER) {
    const onMove = sliceBlock(handler(file, name), 'function onMove(');
    assert.match(onMove, /\/\s*(scale|_sc)\b/,
      `${file} ${name}: onMove 가 델타를 배율로 안 나눈다 — 현빈 실사용 줌이 40% 다`);
  }
});

/* ── 허용목록 — 「onUp 에서 찍는 게 맞는」 세 자리. 이유를 여기 박아 둔다. ──────────────── */

test('허용① js/scratch-pad.js — 캔버스는 그대로고 sideEffects 로 역동작을 «명시»한다(정당한 push-after)', () => {
  const SP = readCode('js/scratch-pad.js');
  const i = SP.indexOf('pushHistory');
  assert.ok(i !== -1, 'scratch-pad 의 pushHistory 가 사라졌다 — 의도한 변경인지 확인할 것');
  const near = SP.slice(i, i + 400);
  assert.match(near, /sideEffects|onUndo|onRedo/,
    'sideEffects 없이 찍고 있다 — 그러면 이 자리는 허용목록에 남을 근거가 없다');
});

test('허용② js/block-drag.js 드래그아웃 — onUp «안»이지만 추출 변형보다 «앞»이라 실질 push-before', () => {
  const onUps = BD.split('function onUp()');
  const hit = onUps.find(s => /draggedOutside/.test(s.slice(0, 400)) && /pushHistory/.test(s.slice(0, 600)));
  assert.ok(hit, '드래그아웃 onUp 을 못 찾았다 — 리팩터링됐나?');
  const iPush = hit.indexOf('pushHistory');
  const iMut = hit.search(/dragEl\.style\.|delete dragEl\.dataset\.|inner\.(insertBefore|appendChild)\(/);
  assert.ok(iMut !== -1 && iPush < iMut,
    'pushHistory 가 추출 변형 «뒤»로 밀렸다 — 그 순간 이 자리도 push-after 가 된다');
});

test('허용③ js/overlay-handles.js 그리드 거터 둘 — mousedown 에서 1회 찍는다(onUp 아님)', () => {
  for (const fn of ['_onGridColMouseDown', '_onGridRowMouseDown']) {
    const h = sliceBlock(OH, `function ${fn}(`);
    const iPush = h.indexOf('pushHistory');
    const iMove = h.indexOf('function onMove(');
    assert.ok(iPush !== -1, `${fn}: pushHistory 가 사라졌다 — 거터 드래그가 기록을 안 남긴다`);
    assert.ok(iPush < iMove,
      `${fn}: pushHistory 가 onMove/onUp «안»으로 들어갔다 — mousedown 1회 규약이 깨졌다`);
    const onUp = sliceBlock(h, 'function onUp(');
    assert.doesNotMatch(onUp, /pushHistory/, `${fn}: onUp 에서 찍기 시작했다`);
  }
});

test('★부품이 제 노릇을 한다 — beginDragHistory 는 임계 전엔 안 찍고, 찍는 건 «한 번»뿐', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/drag-history.js'), 'utf8');
  const pushed = [];
  const w = { pushHistory: (l) => pushed.push(l) };
  new Function('window', src)(w);
  const h = w.beginDragHistory('테스트');
  assert.equal(h.arm(0.5, 0.5), false, '임계(1 캔버스px) 미만인데 열렸다');
  assert.deepEqual(pushed, [], '임계 미만에서 찍었다 — 맨클릭이 항목을 만든다');
  assert.equal(h.arm(0, 2), true, '임계를 넘었는데 안 열렸다');
  assert.deepEqual(pushed, ['테스트'], '라벨이 안 실렸다');
  assert.equal(h.arm(99, 99), true);
  assert.deepEqual(pushed, ['테스트'], '두 번 찍었다 — 한 제스처에 항목은 «하나»다');
  assert.equal(h.armed, true);
  // minPx=0 이어도 «완전 정지»(0,0)는 안 연다 — 맨클릭이 항목을 만들면 redo 꼬리가 죽는다.
  const h0 = w.beginDragHistory('영', { minPx: 0 });
  assert.equal(h0.arm(0, 0), false, 'minPx=0 에서 (0,0) 이 열렸다');
  assert.equal(h0.arm(0.01, 0), true);
});

test('★pushHistory 가 없어도 던지지 않는다 — 하네스·초기 로드 중 호출을 견딘다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/drag-history.js'), 'utf8');
  const w = {};
  new Function('window', src)(w);
  const h = w.beginDragHistory('x');
  assert.equal(h.arm(10, 10), true);
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

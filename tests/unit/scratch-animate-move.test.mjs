/* scratch-animate-move.test.mjs — 한 아이템을 «지정한 자리»로 옮기는 자(window._scratchAnimateItemTo)
 * 실행: node --test tests/unit/scratch-animate-move.test.mjs
 *
 * ★배경 — 연결선 더블클릭 「당기기」(현빈 2026-09-30)가 부르는 자리다. 자리·저장·되돌리기는
 *   «스크래치의 것»이라 js/scratch-pad.js 에 두었고(부르는 쪽은 «어디로»만 정한다), 여기서는
 *   그 함수를 «소스에서 떼어» 실제로 돌린다.
 *
 * ★재는 것 — 화면 움직임이 아니라 «규약»이다:
 *   M1 이미 그 자리면 아무 일도 안 한다(히스토리 0). ⛔이게 현빈이 못박은 동작이다.
 *   M2 옮기면 히스토리가 «한 번» 쌓이고, undo 가 x·y·linkDy 를 «같이» 되돌린다.
 *      ★linkDy 를 빼먹으면 undo 뒤 다음 섹션 이동에 엉뚱한 자리로 튄다(_scratchGeomSnapshot 머리말).
 *   M3 redo 는 «목표값»으로 간다 — 트윈 중간값이 아니다.
 *   M4 ⌘Z 가 트윈 «도중»에 와도 트윈이 복원값을 덮지 않는다(먼저 트윈을 세운다).
 *   M5 x=0 을 «없는 값»으로 읽지 않는다(왼쪽 끝 아이템이 조용히 안 움직이던 부류의 함정).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const { sliceBlock } = require_('./_slice-block.js');
const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'scratch-pad.js'), 'utf8');

/* ★2026-10-09 — 본체가 «여러 장»판으로 옮겨 갔다(그룹 링크선 당기기). 한 장짜리는 그 겉면이다.
   ⇒ ★둘 다 떠서 싣는다. 겉면만 실으면 「is not a function」으로 여섯이 한꺼번에 빨개진다(실제로 그랬다).
   ⛔겉면을 빼고 본체만 재지 마라 — 「한 장의 길이 그대로인가」가 이 파일이 잠근 것이다. */
/* ⛔닻에 ★매개변수 목록을 적지 마라 — 누가 인자 하나만 더해도 이 검사가 ★조용히 눈이 먼다.
   (집행 = tests/unit/anchor-signature-ratchet.test.mjs R1. 실측: 매개변수를 적었더니 그 래칫이 빨개졌다.) */
const MOVE_SRC  = sliceBlock(SRC, 'window._scratchAnimateItemTo = (');
const MOVES_SRC = sliceBlock(SRC, 'window._scratchAnimateItemsTo = (');
const SNAP_SRC = sliceBlock(SRC, 'const _scratchGeomSnapshot = items =>');
const APPLY_SRC = sliceBlock(SRC, 'function _applyScratchGeomSnapshot(');

/** 실물 두 조각(스냅샷 뜨기·되돌리기)을 그대로 싣고, 나머지는 최소 대역으로 채운다. */
function harness(items) {
  const hist = [];
  const saves = [];
  const el = () => ({ style: {}, dataset: {} });
  const _scratchItems = items.map(it => ({ ...it, el: it.el || el() }));
  const sandbox = {
    _scratchItems,
    _saveScratch: () => saves.push(_scratchItems.map(i => ({ id: i.id, x: i.x, y: i.y, linkDy: i.linkDy }))),
    window: {
      pushHistory: (label, opts) => hist.push({ label, ...opts }),
      SPLink: { resyncFollow: () => {} },
    },
    performance: { now: () => 0 },          // ★ms=0 경로만 쓴다(트윈 시간은 이 검사의 관심이 아니다)
    requestAnimationFrame: (fn) => { sandbox.__raf.push(fn); return sandbox.__raf.length; },
    cancelAnimationFrame: (h) => { sandbox.__cancelled.push(h); },
    __raf: [], __cancelled: [],
  };
  const body = `
    ${SNAP_SRC}
    ${APPLY_SRC}
    ${MOVES_SRC}
    ${MOVE_SRC}
    return [window._scratchAnimateItemTo, window._scratchAnimateItemsTo];`;
  const [fn, fns] = new Function('_scratchItems', '_saveScratch', 'window', 'performance',
    'requestAnimationFrame', 'cancelAnimationFrame', body)(
    sandbox._scratchItems, sandbox._saveScratch, sandbox.window, sandbox.performance,
    sandbox.requestAnimationFrame, sandbox.cancelAnimationFrame);
  return { move: fn, moveMany: fns, items: sandbox._scratchItems, hist, saves, sandbox };
}

test('M1 ★이미 그 자리면 아무 일도 안 한다 — 히스토리도 안 쌓인다', () => {
  const h = harness([{ id: 'a', x: 100, y: 200, w: 300 }]);
  const r = h.move('a', 100, 200, { ms: 0 });
  assert.deepEqual(r, { ok: true, moved: false });
  assert.equal(h.hist.length, 0, '★안 움직였는데 히스토리를 쌓았다 — ⌘Z 가 한 번 헛돈다');
  assert.equal(h.saves.length, 0, '★안 움직였는데 저장을 불렀다');
});

test('M2 ★옮기면 히스토리 «한 번» + undo 가 x·y·linkDy 를 같이 되돌린다', () => {
  const h = harness([{ id: 'a', x: 900, y: 40, w: 200, linkDy: 500 }]);
  const r = h.move('a', 424, 90, { ms: 0, linkDy: 90, label: '참고이미지 당기기' });
  assert.deepEqual(r, { ok: true, moved: true });
  assert.equal(h.hist.length, 1, '★히스토리가 한 번이 아니다');
  assert.equal(h.hist[0].label, '참고이미지 당기기');
  const it = h.items[0];
  assert.equal(it.x, 424); assert.equal(it.y, 90); assert.equal(it.linkDy, 90);
  assert.equal(it.el.style.left, '424px'); assert.equal(it.el.style.top, '90px');
  h.hist[0].onUndo();
  assert.equal(it.x, 900, '★undo 가 x 를 안 되돌렸다');
  assert.equal(it.y, 40,  '★undo 가 y 를 안 되돌렸다');
  assert.equal(it.linkDy, 500,
    '★undo 가 linkDy 를 안 되돌렸다 — 좌표만 돌아가고 앵커는 새 값으로 남아 «다음 섹션 이동»에 튄다');
});

test('M3 ★redo 는 «목표값»으로 간다 (트윈 중간값이 아니다)', () => {
  const h = harness([{ id: 'a', x: 900, y: 40, w: 200 }]);
  h.move('a', 424, 90, { ms: 0, linkDy: 90 });
  h.hist[0].onUndo();
  h.hist[0].onRedo();
  const it = h.items[0];
  assert.equal(it.x, 424); assert.equal(it.y, 90); assert.equal(it.linkDy, 90);
});

test('M4 ⛔되돌리기가 트윈을 «먼저 세운다» — 트윈이 복원값을 덮지 않는다', () => {
  const h = harness([{ id: 'a', x: 900, y: 40, w: 200 }]);
  const it = h.items[0];
  it._tweenRAF = 77;                      // 트윈이 «도는 중»이라고 꾸민다
  h.move('a', 424, 90, { ms: 0 });
  // 새 호출이 앞 트윈을 세웠다
  assert.ok(h.sandbox.__cancelled.includes(77), '★앞 트윈을 안 세웠다 — 두 트윈이 같은 아이템을 다툰다');
  it._tweenRAF = 88;                      // undo 직전에 또 돈다고 꾸민다
  h.hist[0].onUndo();
  assert.ok(h.sandbox.__cancelled.includes(88),
    '★undo 가 트윈을 안 세웠다 — 복원한 좌표를 트윈이 다음 프레임에 덮어쓴다');
  assert.equal(it.x, 900);
});

test('M5 ⛔x=0 을 «없는 값»으로 읽지 않는다 (왼쪽 끝 아이템이 조용히 안 움직이던 부류)', () => {
  const h = harness([{ id: 'a', x: 0, y: 0, w: 200 }]);
  const r = h.move('a', 0, 0, { ms: 0 });
  assert.deepEqual(r, { ok: true, moved: false }, '★x=0·y=0 에서 «같은 자리»를 못 알아본다');
  const h2 = harness([{ id: 'a', x: 0, y: 0, w: 200 }]);
  assert.deepEqual(h2.move('a', 0, 50, { ms: 0 }), { ok: true, moved: true });
  assert.equal(h2.items[0].y, 50);
});

test('M6 없는 아이템이면 조용히 실패한다 — 던지지 않는다(연결이 앞서 끊겼을 수 있다)', () => {
  const h = harness([{ id: 'a', x: 0, y: 0, w: 200 }]);
  assert.deepEqual(h.move('없는id', 10, 10, { ms: 0 }), { ok: false, reason: 'NOT_FOUND' });
  assert.equal(h.hist.length, 0);
});

/* ══ 여러 장을 «한 걸음»으로 (2026-10-09, 그룹 링크선 당기기) ═══════════════════════════
 * 현빈 ⑤「그룹설정이 됐는데도 링크 선을 만지면 각각 당겨지는 문제가 있어」의 ★자리.
 * ⛔여기서 재는 것은 «누가 부르나»가 아니라 «부르면 어떤 규약을 지키나»다 —
 *   「그룹이면 전원이 온다」는 js/scratchpad-link.js 쪽 검사(tests/dom)가 잰다.
 */
test('M7 ★N장을 옮겨도 히스토리는 «한 번» — undo 한 번에 전원이 제자리로', () => {
  const h = harness([
    { id: 'a', x: 1300, y: 120, w: 200, linkDy: 120 },
    { id: 'b', x: 1300, y: 350, w: 200, linkDy: 350 },
    { id: 'c', x: 1300, y: 580, w: 200, linkDy: 580 },
  ]);
  const r = h.moveMany([
    { id: 'a', x: 424, y: 0,   linkDy: 0 },
    { id: 'b', x: 424, y: 230, linkDy: 230 },
    { id: 'c', x: 424, y: 460, linkDy: 460 },
  ], { ms: 0, label: '참고이미지 당기기' });
  assert.deepEqual(r, { ok: true, moved: true });
  assert.equal(h.hist.length, 1, '★N장을 옮겼는데 히스토리가 N번 쌓였다 — ⌘Z 가 N걸음이 된다');
  assert.deepEqual(h.items.map(i => [i.x, i.y, i.linkDy]), [[424, 0, 0], [424, 230, 230], [424, 460, 460]]);
  h.hist[0].onUndo();
  assert.deepEqual(h.items.map(i => [i.x, i.y, i.linkDy]),
    [[1300, 120, 120], [1300, 350, 350], [1300, 580, 580]],
    '★undo 한 번이 전원을 되돌리지 않았다');
  h.hist[0].onRedo();
  assert.deepEqual(h.items.map(i => [i.x, i.y]), [[424, 0], [424, 230], [424, 460]], '★redo 가 목표값이 아니다');
});

test('M8 ★★한 장이라도 움직이면 «전원»을 스냅샷에 담는다 — 제자리인 장을 빼지 않는다', () => {
  /* ⛔「안 움직이는 장은 빼자」로 짜면 그 장은 undo 의 복원 대상에서 사라진다.
     이 단언이 그 변이를 잡는다: b 는 제자리지만 onUndo 가 그 자리를 «다시 쓸» 수 있어야 한다. */
  const h = harness([
    { id: 'a', x: 0, y: 0, w: 200 },
    { id: 'b', x: 500, y: 500, w: 200 },
  ]);
  h.moveMany([{ id: 'a', x: 40, y: 0 }, { id: 'b', x: 500, y: 500 }], { ms: 0 });
  assert.equal(h.hist.length, 1);
  const before = h.hist[0];
  h.items[1].x = 999;                       // 누가 b 를 옮겨 놓았다고 꾸민다
  before.onUndo();
  assert.equal(h.items[1].x, 500, '★제자리였던 장이 스냅샷에서 빠졌다 — undo 가 그 장을 못 되돌린다');
});

test('M9 ★전원이 제자리면 아무 일도 안 한다 (히스토리 0 · 저장 0)', () => {
  const h = harness([{ id: 'a', x: 10, y: 20, w: 200 }, { id: 'b', x: 30, y: 40, w: 200 }]);
  const r = h.moveMany([{ id: 'a', x: 10, y: 20 }, { id: 'b', x: 30, y: 40 }], { ms: 0 });
  assert.deepEqual(r, { ok: true, moved: false });
  assert.equal(h.hist.length, 0);
  assert.equal(h.saves.length, 0);
});

test('M10 빈 목록·없는 id 만이면 조용히 실패한다 — 던지지 않는다', () => {
  const h = harness([{ id: 'a', x: 0, y: 0, w: 200 }]);
  assert.deepEqual(h.moveMany([], { ms: 0 }), { ok: false, reason: 'NOT_FOUND' });
  assert.deepEqual(h.moveMany([{ id: '없는id', x: 1, y: 1 }], { ms: 0 }), { ok: false, reason: 'NOT_FOUND' });
  assert.equal(h.hist.length, 0);
});

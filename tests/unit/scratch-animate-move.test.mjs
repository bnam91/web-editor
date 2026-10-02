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

const MOVE_SRC = sliceBlock(SRC, 'window._scratchAnimateItemTo = (id, x, y, opts = {}) =>');
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
    ${MOVE_SRC}
    return window._scratchAnimateItemTo;`;
  const fn = new Function('_scratchItems', '_saveScratch', 'window', 'performance',
    'requestAnimationFrame', 'cancelAnimationFrame', body)(
    sandbox._scratchItems, sandbox._saveScratch, sandbox.window, sandbox.performance,
    sandbox.requestAnimationFrame, sandbox.cancelAnimationFrame);
  return { move: fn, items: sandbox._scratchItems, hist, saves, sandbox };
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

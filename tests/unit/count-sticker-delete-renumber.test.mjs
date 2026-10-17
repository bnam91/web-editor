/* count-sticker-delete-renumber — CountSticker.renumberSections (1017t1j3 · 현빈 「3을 지웠어. 그러면 4~10은 −1씩」).
 *
 * ★무엇을 잠그나
 *   R0 전제 — window.CountSticker.renumberSections 가 실제로 함수다
 *   R1 한 섹션 — 그 섹션 안에서만 1..n (countStickerRenumber 그대로 재사용했는지는 결과로 본다)
 *   R2 섹션 둘이 섞인 입력 — 각자 안에서만 1..n(한쪽이 다른 쪽 번호에 안 섞인다)
 *   R3 ∅ 입력(빈 배열·빈 Set) — 0 을 돌려주고 던지지 않는다
 *   R4 문서에서 떨어진 섹션(isConnected === false) — 건너뛴다(돈 수에 안 낀다)
 *   R5 배열 입력도 Set 과 같이 받는다(호출자가 Set 이든 배열이든)
 * ★기대값은 글자로. ⛔앱 0 · 네트워크 0 — js/count-sticker-tool.js 를 vm 으로 그대로 싣는다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const TOOL = 'js/count-sticker-tool.js';

function load() {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, TOOL), ctx);
  return ctx;
}

/* 섹션 흉내 — countStickerRenumber 가 읽는 것만(querySelectorAll). 기본 isConnected = true. */
function fakeSection(counts, { isConnected = true } = {}) {
  const blocks = counts.map((k) => ({ dataset: { count: String(k) }, closest: () => sec, classList: { contains: () => false } }));
  const sec = { querySelectorAll: () => blocks, isConnected };
  return { sec, blocks };
}

test('R0 전제 — CountSticker.renumberSections 가 실제로 함수다', () => {
  const CS = load().CountSticker;
  assert.equal(typeof CS?.renumberSections, 'function');
});

test('R1 한 섹션 — 1,3,7(빈 2 있던 꼴)을 1..3 으로', () => {
  const CS = load().CountSticker;
  const A = fakeSection([1, 3, 7]);
  const n = CS.renumberSections([A.sec]);
  assert.equal(n, 1, '돈 섹션 수');
  assert.deepEqual(A.blocks.map((b) => b.dataset.count), ['1', '2', '3']);
});

test('R2 섹션 둘이 섞인 입력 — 각자 안에서만 1..n(안 섞인다)', () => {
  const CS = load().CountSticker;
  const A = fakeSection([1, 4, 5]);     // → 1,2,3
  const B = fakeSection([2, 9]);        // → 1,2 (B 는 A 의 번호를 안 물려받는다)
  const n = CS.renumberSections(new Set([A.sec, B.sec]));
  assert.equal(n, 2);
  assert.deepEqual(A.blocks.map((b) => b.dataset.count), ['1', '2', '3']);
  assert.deepEqual(B.blocks.map((b) => b.dataset.count), ['1', '2']);
});

test('R3 ∅ 입력 — 0 을 돌려주고 던지지 않는다', () => {
  const CS = load().CountSticker;
  assert.equal(CS.renumberSections(new Set()), 0);
  assert.equal(CS.renumberSections([]), 0);
  assert.equal(CS.renumberSections(undefined), 0);
});

test('R4 문서에서 떨어진 섹션 — 건너뛴다(돈 수에 안 낀다 · 그 섹션은 안 바뀐다)', () => {
  const CS = load().CountSticker;
  const Live = fakeSection([1, 5]);
  const Gone = fakeSection([1, 5], { isConnected: false });
  const n = CS.renumberSections([Live.sec, Gone.sec]);
  assert.equal(n, 1, '떨어진 섹션은 안 센다');
  assert.deepEqual(Live.blocks.map((b) => b.dataset.count), ['1', '2'], '살아있는 섹션은 당겨진다');
  assert.deepEqual(Gone.blocks.map((b) => b.dataset.count), ['1', '5'], '떨어진 섹션은 ★그대로(건드리지 않는다)');
});

test('R5 배열 입력도 Set 과 같이 받는다', () => {
  const CS = load().CountSticker;
  const A = fakeSection([2, 8]);
  assert.equal(CS.renumberSections([A.sec]), 1);
  assert.deepEqual(A.blocks.map((b) => b.dataset.count), ['1', '2']);
});

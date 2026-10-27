/* 단위 하네스 — ★1020t2h2 「섹션 높이가 달라져 마킹이 캔버스로 나간다」(현빈 261027 · 「섹션 밖 보이기로 조절」)
 *
 * ★병: 스티커(마킹)의 섹션 밖 크롭(--sec-clip)은 렌더·드래그 때만 계산됐다 ⇒ 섹션이 줄어도 옛 값이 남아
 *   «섹션 밖 보이기» 꺼짐인데도 밖이 보였다(앱 실측 9386 · 섹션 183px · 마킹 5·6 이 100px 밖 · clip none).
 * ★고침: js/section-height.js 의 섹션 ResizeObserver(이미 모든 섹션에 걸려 있다)가 바뀐 섹션의
 *   «직속» 스티커마다 window._updateStickerSecClip 을 부른다(그라데이션 _gradSecRO 와 같은 꼴 · 좌표는 안 당긴다).
 * ★자 — 실제 section-height.js 를 가짜 window/document 위에서 돌리고, 잡아 둔 ResizeObserver 콜백에 «크기 변화»를 손으로 전한다.
 *   ★양성대조: `STK_WATCH_SRC=<콜백 한 줄을 지운 사본>` 으로 돌리면 W1 이 빨개져야 한다.
 * ★못 재는 것: 진짜 브라우저가 언제 전하나 · 화면에 안 그려지는 창(ResizeObserver 가 안 온다 — js/editor.js 주석).
 *   ⛔프레임 안 스티커는 범위 밖 — 스티커는 섹션 «직속»으로만 붙는다(sticker-block.js · count-sticker-tool.js 의 sec.appendChild).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC_PATH = process.env.STK_WATCH_SRC || path.join(ROOT, 'js', 'section-height.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

function boot() {
  const W = { cb: null, calls: [] };
  class FakeRO { constructor(cb) { W.cb = cb; } observe() {} unobserve() {} }
  class FakeMO { constructor() {} observe() {} }
  const canvas = { children: [], querySelectorAll: () => [] };
  const document = { readyState: 'complete', getElementById: (id) => (id === 'canvas' ? canvas : null), addEventListener() {}, querySelectorAll: () => [] };
  const window = { addEventListener() {}, _updateStickerSecClip: (b) => W.calls.push(b) };
  vm.runInNewContext(SRC, { window, document, ResizeObserver: FakeRO, MutationObserver: FakeMO, setTimeout: () => 0 });
  return W;
}

test(`W1 ★섹션 크기가 바뀌면 그 섹션 «직속» 스티커마다 크롭을 다시 낸다 [src=${path.basename(SRC_PATH)}]`, () => {
  const W = boot();
  assert.equal(typeof W.cb, 'function', 'ResizeObserver 를 안 만들었다');
  const a = { id: 'a' }, b = { id: 'b' };
  const sec = { querySelectorAll: (sel) => (sel === ':scope > .sticker-block' ? [a, b] : []) };
  W.cb([{ target: sec }]);
  assert.deepEqual(W.calls, [a, b], '섹션이 줄어도 스티커 크롭이 안 따라온다 — 1020t2h2 재발');
});

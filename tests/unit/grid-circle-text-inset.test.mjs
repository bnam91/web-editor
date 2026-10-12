/* G20-INSET — 원 «안 글자»의 폭(내접 정사각형 %)이 ★두 자리에 사는 문제의 «재는 자». (2026-10-07)
 *
 * ★왜 있나 — 같은 기하(지름 × 1/√2)가 ★두 곳에 산다:
 *     ⑴ js/blocks/grid-block.js `GRID_CIRCLE_TEXT_INSET_PCT`  — 그리드 칸 원 «안» 글자(인라인 style)
 *     ⑵ css/editor-blocks.css  `.icb-children { width: ... }` — 서클 에셋블럭 «원 안» 자식 그릇
 *   CSS 를 JS 로 들여올 길이 없어 ★합칠 수 없다. ⛔그러면 «경고 주석»으로 막지 않는다 —
 *   이 레포의 답은 ★「행위로 못 재는 자리는 구조로 잠가라」이고, 구조로 못 합칠 때는 ★«재는 자»다
 *   (선례: tests/unit/grid-patchcell-reject.test.js P6 — 상수를 렌더러 소스에서 파싱해 맞춘다).
 *
 * ★무엇을 재나 — ⑴의 ★식을 소스에서 떠서 ★돌리고, ⑵의 ★리터럴을 CSS 에서 파싱해 ★같은지 본다.
 *   ⛔두 수를 이 파일에 ★손으로 적지 않는다 — 적으면 ★세 번째 명부가 된다.
 * ★양성대조: 둘 중 ★아무 쪽이든 바꾸면 ★빨강이다(아래 I3 가 그걸 «변이로» 증명한다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const JS_SRC  = fs.readFileSync(path.join(ROOT, 'js/blocks/grid-block.js'), 'utf8');
const CSS_SRC = fs.readFileSync(path.join(ROOT, 'css/editor-blocks.css'), 'utf8');

/** grid-block.js 의 그 상수 «식»을 떠서 돌린다(리터럴이 아니라 식이라 √2 출처가 코드에 남는다). */
function jsPct(src) {
  const m = /export const GRID_CIRCLE_TEXT_INSET_PCT\s*=\s*([^;]+);/.exec(src);
  if (!m) return null;
  return Function(`"use strict";return (${m[1]});`)();
}
/** css 의 `.icb-children { … width: N% … }` 에서 N 을 뜬다. */
function cssPct(src) {
  const blk = /\.icb-children\s*\{([^}]*)\}/.exec(src);
  if (!blk) return null;
  const m = /(?:^|;|\s)width:\s*([\d.]+)%/.exec(blk[1]);
  return m ? Number(m[1]) : null;
}

test('I1 ★전제 — 두 자리를 «둘 다» 찾았다(못 찾으면 아래 대조는 다른 이유로 초록이 된다)', () => {
  const a = jsPct(JS_SRC), b = cssPct(CSS_SRC);
  assert.ok(Number.isFinite(a), '★grid-block.js 에서 GRID_CIRCLE_TEXT_INSET_PCT 식을 못 떴다 — 이름이 바뀌었나?');
  assert.ok(Number.isFinite(b), '★css/editor-blocks.css `.icb-children` 의 width:N% 를 못 떴다 — 그 절이 바뀌었나?');
  /* ★둘 다 «내접 정사각형»이라는 기하를 실제로 만족하는가 — 이름만 같고 수가 엉뚱하면 I2 는 «둘이 같이 틀린» 것을 통과시킨다. */
  const ideal = 100 / Math.SQRT2;
  assert.ok(Math.abs(a - ideal) <= 0.01, `★JS 값 ${a} 가 1/√2(${ideal.toFixed(4)})에서 0.01%p 넘게 벗어났다`);
});

test('I2 ★두 자리의 수가 같다 — 그리드 칸 원 글자 폭 == 서클 에셋 자식 그릇 폭', () => {
  const a = jsPct(JS_SRC), b = cssPct(CSS_SRC);
  assert.equal(a, b,
    `★같은 기하가 두 수로 갈렸다: grid-block.js=${a} · editor-blocks.css .icb-children=${b}\n` +
    '  ⇒ 한쪽만 고쳤다. 「서클 에셋블럭과 같은 배치」라는 약속이 거짓이 됐다.');
});

test('I3 ★양성대조 — CSS 쪽 수를 한 글자 바꾸면 I2 가 빨개진다(이 자가 «수»를 실제로 잠근다)', () => {
  const a = jsPct(JS_SRC);
  /* ⛔파일을 쓰지 않는다 — «메모리에서» 변이를 만들어 같은 파서에 먹인다. */
  const mutated = CSS_SRC.replace(/(\.icb-children\s*\{[^}]*?width:\s*)([\d.]+)(%)/,
    (_, pre, n, suf) => `${pre}${(Number(n) + 1).toFixed(2)}${suf}`);
  assert.notEqual(mutated, CSS_SRC, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다');
  const b2 = cssPct(mutated);
  assert.ok(Number.isFinite(b2), '★변이본에서 수를 못 떴다 — 파서가 깨졌다(음성대조 실패)');
  assert.notEqual(a, b2, `★변이(${b2})를 넣었는데도 JS 값(${a})과 같다 — I2 는 이 종류의 어긋남을 못 잡는다`);
});

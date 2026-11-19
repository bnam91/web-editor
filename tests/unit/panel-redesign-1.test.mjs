/* panel-redesign-1.test.mjs — 우측 패널 재설계 «적용 1차»(현빈 확정 261120) 중 소스·CSS 로 잴 수 있는 것. 화면은 tests/dom/panel-redesign-1.dom.spec.js.
 *   실행: node --test tests/unit/panel-redesign-1.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { readSrc } = _req('./_srcread.js');
const { stripComments } = _req('./_strip-comments.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const css = (rel) => stripComments(readSrc(ROOT, rel));
const tokenOf = (src, name) => (new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(src) || [])[1]?.trim();

/* ② 절 제목 색 한 규칙 + Figma 간격. 양성대조: 토큰을 옛 값(--ui-text-sub · space-2 · 10px)으로 되돌리면 빨강 */
test('R2 절 제목 = --ui-text · 머리 위아래 space-3 · 몸 아래 space-4 · 빈 절 흐림 규칙 없음', () => {
  const base = css('css/editor-base.css');
  assert.equal(tokenOf(base, '--ui-sec-title-color'), 'var(--ui-text)');
  assert.equal(tokenOf(base, '--ui-sec-head-py'), 'var(--ui-space-3)');
  assert.equal(tokenOf(base, '--ui-sec-body-pb'), 'var(--ui-space-4)');
  const props = css('css/editor-props.css');
  assert.doesNotMatch(props, /--ui-sec-title-color\s*:/, '★절마다 제목 색을 다시 정하는 규칙이 생겼다(한 규칙이어야)');
  assert.doesNotMatch(props, /\.prop-sec-head\s*>\s*\.prop-section-title:hover/, '★절 머리 hover 색이 되살았다');
});

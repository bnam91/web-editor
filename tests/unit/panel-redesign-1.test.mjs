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

/* ⑦ 숫자 칸 스피너 걷음 — 우측 패널 전체 한 규칙. 양성대조: 그 규칙을 지우면 빨강 */
test('R7 #panel-right 숫자 칸 = textfield · 스핀 단추 -webkit-appearance none · 다시 누름 판정이 스피너 없는 칸의 오른쪽 끝도 칸으로', () => {
  const props = css('css/editor-props.css');
  assert.match(props, /#panel-right input\[type="number"\]\s*\{[^}]*appearance:\s*textfield/);
  assert.match(props, /#panel-right input\[type="number"\]::-webkit-inner-spin-button\s*\{[^}]*-webkit-appearance:\s*none/);
  assert.match(props, /#panel-right input\[type="number"\]::-webkit-outer-spin-button/);
  const ed = css('js/editor.js');
  assert.match(ed, /const _reclickSelectAll = [^;]*appearance === 'textfield'/, '★스피너가 없는데 오른쪽 18px 을 스피너로 본다');
});

/* ⑪ 켜짐 표시 Figma 식 — 텍스트 가로 정렬 · B I U S 두 묶음만 · 토큰만. 양성대조: 규칙을 지우면 빨강 */
test('R11 #txt-align-group · #txt-style-group 켜짐 = border-mid 바탕 · border-strong 테두리 · ui-text 글자', () => {
  const props = css('css/editor-props.css');
  const m = /#txt-align-group \.prop-align-btn\.active,\s*#txt-style-group \.prop-style-btn\.active\s*\{([^}]*)\}/.exec(props);
  assert.ok(m, '★두 묶음 켜짐 규칙이 없다');
  assert.match(m[1], /background:\s*var\(--ui-border-mid\)/);
  assert.match(m[1], /border-color:\s*var\(--ui-border-strong\)/);
  assert.match(m[1], /color:\s*var\(--ui-text\)/);
  assert.doesNotMatch(m[1], /#[0-9a-f]{3,8}\b|accent/i, '★리터럴 색·파란 채움');
  assert.match(props, /\.prop-align-btn\.active\s*\{[^}]*--ui-accent-primary/, '[대조] 다른 묶음의 파란 켜짐은 그대로');
});

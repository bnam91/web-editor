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

/* ⑩ 텍스트 패널 «Font»·«글자색» 라벨 글 걷음 — 칸은 그대로 · 이름은 aria-label. 다른 패널(모달·그리드)은 기본 인자 = 라벨 그대로.
 *   양성대조: prop-text-template.js 의 fontLabel:false / colorLabel:false 를 빼면 빨강 */
test('R10 텍스트 패널 산출에 «Font»·«글자색» 라벨 0 · 고르개·색 칸은 있다 · 공용 빌더 기본은 라벨 있음', () => {
  const { loadTextTemplate, GOLDEN_STATE } = _req('./_text-template-harness.js');
  const html = loadTextTemplate().buildTextPropsHtml(GOLDEN_STATE);
  assert.doesNotMatch(html, /class="prop-field-label"[^>]*>Font</, '★«Font» 라벨이 남았다');
  assert.doesNotMatch(html, /class="prop-label">글자색</, '★«글자색» 라벨이 남았다');
  assert.match(html, /id="txt-font-trigger" type="button" aria-label="Font"/);
  assert.match(html, /<input type="color" id="txt-color" value="[^"]*" aria-label="글자색">/);
  const typo = readSrc(ROOT, 'js/props/_typo-section.js');
  assert.match(typo, /fontLabel = true/, '[대조] 공용 빌더 기본 = 라벨 있음(모달·그리드 바이트 동일)');
  assert.match(typo, /colorLabel = true/);
});

/* ⑥ 텍스트 Size = 너비 숫자 칸(칸 안 라벨 · 끌기) + 꺼진 높이 칸 «auto». 양성대조: 옛 슬라이더 줄로 되돌리면 빨강 */
test('R6 텍스트 Size — 너비 슬라이더 없음 · 너비/높이 칸 한 줄 · 높이 disabled placeholder auto · 끌기 배선', () => {
  const { loadTextTemplate, GOLDEN_STATE } = _req('./_text-template-harness.js');
  const html = loadTextTemplate().buildTextPropsHtml(GOLDEN_STATE);
  const size = /data-sec="size"[\s\S]*?<div class="prop-sec-body"[^>]*>([\s\S]*?)\n {6}<\/div>\n {4}<\/div>/.exec(html)?.[1] || '';
  assert.ok(size, '[전제] Size 절 몸을 찾았다');
  assert.doesNotMatch(size, /txt-width-slider|type="range"/, '★너비 슬라이더가 남았다');
  assert.match(size, /<div class="prop-lhls-row">[\s\S]*id="txt-width-scrub"[^>]*>너비<\/span>\s*<input type="number" id="txt-width-number"[\s\S]*<span class="prop-xy-label">높이<\/span>\s*<input type="number" id="txt-height-number" disabled placeholder="auto"/);
  const wire = stripComments(readSrc(ROOT, 'js/props/prop-text-wireup-position.js'));
  assert.match(wire, /getElementById\('txt-width-scrub'\)[\s\S]*pointermove[\s\S]*lostpointercapture[\s\S]*pushHistory/, '★라벨 끌기 배선이 없다');
  assert.doesNotMatch(wire, /txt-width-slider/);
  assert.match(css('css/editor-props.css'), /\.prop-icon-input:has\(> input:disabled\)\s*\{[^}]*opacity:\s*var\(--ui-disabled-opacity\)/);
});

/* ④ 텍스트만 Layout(가로 정렬)이 Size 위 — _section-spec 예외표 한 자리. 양성대조: 텍스트 spec 의 panel:'text' 를 빼면 빨강 */
test('R4 sectionOrderFor(text) = layout 이 size 바로 앞 · 다른 패널 그대로 · 텍스트 산출 순서 Position → Layout → Size → Padding', async () => {
  const { sectionOrderFor, SECTION_ORDER } = _req('../dom/_panel-sections.js').loadSectionSpec();   // 정본을 vm 에 올린 것(게이트와 같은 길)
  const t = [...sectionOrderFor('text')];
  assert.equal(t.indexOf('layout') + 1, t.indexOf('size'), '★텍스트 Layout 이 Size 바로 앞이 아니다');
  assert.deepEqual([...t].sort(), [...SECTION_ORDER].sort(), '★키가 빠지거나 늘었다');
  assert.ok(SECTION_ORDER.indexOf('size') < SECTION_ORDER.indexOf('layout'), '[대조] 전역 순서는 그대로(Size → Layout)');
  assert.equal(sectionOrderFor('section')[0], 'fill', '[대조] 섹션 예외 그대로');
  const { loadTextTemplate, GOLDEN_STATE } = _req('./_text-template-harness.js');
  const html = loadTextTemplate().buildTextPropsHtml(GOLDEN_STATE);
  const secs = [...html.matchAll(/data-sec="([a-z]+)"/g)].map((m) => m[1]).filter((k) => ['position', 'size', 'layout', 'padding'].includes(k));
  assert.deepEqual(secs, ['position', 'layout', 'size', 'padding']);
  assert.match(html, /data-sec="layout"[^>]*data-order="text"[\s\S]*id="txt-align-group"/, '★가로 정렬이 Layout(텍스트 순서) 절에 없다');
});

/* ⑫ 타입 12칸 두 줄 · Quote 도 같은 묶음 · 칸마다 네 테두리. 양성대조: CSS 의 #txt-kind-group 칸 규칙을 지우면 빨강 */
test('R12 타입 12칸 순서·글 · 바꾸기 없는 넷 disabled · 6열 격자 · 칸마다 왼 테두리', () => {
  const { loadTextTemplate, GOLDEN_STATE } = _req('./_text-template-harness.js');
  const html = loadTextTemplate().buildTextPropsHtml(GOLDEN_STATE);
  const g = /<div class="prop-type-group" id="txt-kind-group">([\s\S]*?)\n {6}<\/div>/.exec(html)?.[1] || '';
  const btns = [...g.matchAll(/<button ([^>]*)>([^<]*)<\/button>/g)].map((m) => ({ a: m[1], t: m[2] }));
  assert.deepEqual(btns.map((b) => b.t), ['H1', 'H2', 'H3', 'Body', 'Caption', 'Bullet', 'Label', 'Tags', 'Icon Text', 'Bubble', 'Quote', 'Liner']);
  assert.deepEqual(btns.filter((b) => / disabled/.test(b.a)).map((b) => b.t), ['Tags', 'Icon Text', 'Bubble', 'Liner']);
  assert.deepEqual(btns.filter((b) => /data-cls=/.test(b.a)).map((b) => b.t), ['H1', 'H2', 'H3', 'Body', 'Caption', 'Bullet', 'Label'], '★바꾸기 배선(data-cls) 칸이 바뀌었다');
  assert.match(g, /id="txt-to-quote"[^>]*>Quote</, '★Quote 가 묶음 밖이다');
  const props = css('css/editor-props.css');
  assert.match(props, /#txt-kind-group\s*\{[^}]*grid-template-columns:\s*repeat\(6,/);
  assert.match(props, /#txt-kind-group > \.prop-type-btn\s*\{[^}]*border-left:\s*1px solid var\(--ui-border-mid\)/, '★Quote(마지막 칸) 왼 테두리 잘림이 돌아온다');
});

/* ⑤ 패딩 이름(Q25 · Q24) · 텍스트 좌우패딩 사슬 줄 · 잠금 저장(Q26). 양성대조: prop-text.js 의 dataset 읽기를 옛 «좌 = 우»로 되돌리면 R5b 빨강 */
test('R5a 패딩 새 이름 — 블럭 줄 «상하패딩·좌우패딩·좌측패딩·우측패딩» · 태그 «태그 좌우패딩» · 옛 이름 0 · Q27 줄은 그대로', () => {
  const files = ['prop-canvas', 'prop-divider', 'prop-frame', 'prop-graph', 'prop-icon-circle', 'prop-page', 'prop-radial', 'prop-row', 'prop-section',
    'prop-simple-card', 'prop-table', 'prop-comparison', 'prop-modal', 'prop-sticker', 'prop-step', 'prop-text-template'].map((f) => [f, stripComments(readSrc(ROOT, `js/props/${f}.js`))]);
  for (const [f, src] of files) {
    assert.doesNotMatch(src, /(?:prop-label|prop-field-label)">(?:상하 패딩|좌우 패딩|좌우 여백|L\/R)</, `★${f}: 옛 패딩 이름`);
    assert.doesNotMatch(src, /(?:sliderRowHTML|_pairRow)\([^,]+, '(?:상하 패딩|좌우 패딩)'/, `★${f}: 옛 패딩 이름(줄 부품)`);
  }
  const src = Object.fromEntries(files);
  assert.match(src['prop-step'], />좌측패딩<[\s\S]*id="stb-padl-slider"/);
  assert.match(src['prop-table'], />좌우패딩</, '★표 «좌우 여백» → «좌우패딩»(v6)');
  assert.match(src['prop-text-template'], /sliderRowHTML\('태그 좌우패딩', 'txt-label-padx-slider'/);
  /* Q27 — 뜻이 다른 줄은 그대로 */
  assert.match(stripComments(readSrc(ROOT, 'js/props/prop-section.js')), /아래 패딩/);
  assert.match(stripComments(readSrc(ROOT, 'js/props/prop-grid.js')), /위아래 여백/);
});

test('R5b 텍스트 좌우패딩 — 잠금 = 한 줄(#txt-ph-*) · 풂 = 그 줄 비우고 좌측·우측 줄 · 잠금은 data-pad-x-linked 로 저장 · 옛 저장본은 좌 = 우', () => {
  const { loadTextTemplate, GOLDEN_STATE } = _req('./_text-template-harness.js');
  const T = loadTextTemplate();
  const on = T.buildTextPropsHtml({ ...GOLDEN_STATE, currentPadL: 8, currentPadR: 8, phLinked: true });
  assert.match(on, /<div class="prop-row" id="txt-ph-row">\s*<span class="prop-label">좌우패딩<\/span>\s*<input type="range"[^>]*id="txt-ph-slider"[^>]*value="8">\s*<input type="number"[^>]*id="txt-ph-number"[^>]*value="8">\s*<button class="prop-chain-btn active" id="txt-ph-chain"[^>]*aria-pressed="true"/);
  assert.match(on, /id="txt-pl-row" hidden>/); assert.match(on, /id="txt-pr-row" hidden>/);
  const off = T.buildTextPropsHtml({ ...GOLDEN_STATE, phLinked: false });
  assert.match(off, /id="txt-ph-slider"[^>]*style="visibility:hidden"/, '★풀었는데 한 줄 슬라이더가 보인다');
  assert.match(off, /id="txt-pl-row">\s*<span class="prop-label">좌측패딩/); assert.match(off, /id="txt-pr-row">\s*<span class="prop-label">우측패딩/);
  const read = stripComments(readSrc(ROOT, 'js/props/prop-text.js'));
  assert.match(read, /phLinked\s*=\s*tb\.dataset\.padXLinked != null \? tb\.dataset\.padXLinked === '1' : currentPadL === currentPadR/, '★잠금을 저장값에서 안 읽는다(Q26)');
  const wire = stripComments(readSrc(ROOT, 'js/props/prop-text-wireup-padding.js'));
  assert.match(wire, /tb\.dataset\.padXLinked = phLinked \? '1' : '0';[\s\S]*showLinked\(\);\s*window\.pushHistory\?\.\(/, '★사슬이 블럭에 쓰고 이력을 남기지 않는다');
  assert.match(wire, /phSlider\?\.addEventListener\('input', \(\) => setL\(/);
});

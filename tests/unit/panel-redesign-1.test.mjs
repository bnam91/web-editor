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
  assert.doesNotMatch(props, /is-collapsed/, '★접기 없는 표준 절에 죽은 .is-collapsed 규칙이 남았다(QA 경6)');
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
  const size = /data-sec="size"[^>]*>[\s\S]*?<div class="prop-sec-body" id="psec-size-body">([\s\S]*?)\n {6}<\/div>/.exec(html)?.[1] || '';   // ★기대 바뀜(Q1) — Size 는 Layout 묶음 안 몸
  assert.ok(size, '[전제] Size 절 몸을 찾았다');
  assert.doesNotMatch(size, /txt-width-slider|type="range"/, '★너비 슬라이더가 남았다');
  assert.match(size, /<div class="prop-lhls-row">[\s\S]*id="txt-width-scrub"[^>]*>너비<\/span>\s*<input type="number" class="prop-number" id="txt-width-number"[\s\S]*<span class="prop-xy-label">높이<\/span>\s*<input type="number" id="txt-height-number" disabled placeholder="auto"/);
  const wire = stripComments(readSrc(ROOT, 'js/props/prop-text-wireup-position.js'));
  assert.match(wire, /getElementById\('txt-width-scrub'\)[\s\S]*pointermove[\s\S]*lostpointercapture[\s\S]*pushHistory/, '★라벨 끌기 배선이 없다');
  assert.match(wire, /addEventListener\('pointerdown', \(e\) => \{\s*if \(e\.button\) return;/, '★오른쪽 클릭으로도 끌린다(QA 경2)');
  assert.doesNotMatch(wire, /txt-width-slider/);
  /* QA 경1 — 너비 칸은 .prop-number 를 지녀 포커스 때 값 전체선택(editor.js _AUTO_SELECT_SEL)이 그대로 걸린다 */
  assert.match(stripComments(readSrc(ROOT, 'js/editor.js')), /const _AUTO_SELECT_SEL = '\.prop-number/);
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
  /* ★기대 바뀜(Q1 · 현빈 GO 261120) — 셋은 «Layout» 머리 하나 아래 몸(순서 layout → size → padding) */
  const secs = [...html.matchAll(/ data-sec="([a-z]+)"/g)].map((m) => m[1]).filter((k) => ['position', 'size', 'layout', 'padding'].includes(k));
  assert.deepEqual(secs, ['position', 'layout', 'size', 'padding']);
  assert.match(html, /data-sec-group="layout size padding" data-order="text"[\s\S]*?data-sec="layout"[^>]*id="psec-layout">[\s\S]*?id="txt-align-group"/, '★가로 정렬이 Layout 몸에 없다');
});

/* ⑫ 타입 12칸 두 줄 · Quote 도 같은 묶음 · 칸마다 네 테두리. 양성대조: CSS 의 #txt-kind-group 칸 규칙을 지우면 빨강 */
test('R12 타입 12칸 순서·글 · 바꾸기 없는 넷 disabled · 줄바꿈 묶음 · 칸마다 왼 테두리', () => {
  const { loadTextTemplate, GOLDEN_STATE } = _req('./_text-template-harness.js');
  const html = loadTextTemplate().buildTextPropsHtml(GOLDEN_STATE);
  const g = /<div class="prop-type-group" id="txt-kind-group">([\s\S]*?)\n {6}<\/div>/.exec(html)?.[1] || '';
  const btns = [...g.matchAll(/<button ([^>]*)>([^<]*)<\/button>/g)].map((m) => ({ a: m[1], t: m[2] }));
  assert.deepEqual(btns.map((b) => b.t), ['H1', 'H2', 'H3', 'Body', 'Cap', 'Bullet', 'Label', 'Tags', 'Icon', 'Bubble', 'Quote', 'Liner']);
  assert.deepEqual(btns.filter((b) => / disabled/.test(b.a)).map((b) => b.t), ['Tags', 'Icon', 'Bubble', 'Liner']);
  assert.deepEqual(btns.filter((b) => /data-cls=/.test(b.a)).map((b) => b.t), ['H1', 'H2', 'H3', 'Body', 'Cap', 'Bullet', 'Label'], '★바꾸기 배선(data-cls) 칸이 바뀌었다');
  assert.match(g, /id="txt-to-quote"[^>]*>Quote</, '★Quote 가 묶음 밖이다');
  const props = css('css/editor-props.css');
  /* ★기대 바뀜(시안 v10 ① — 6 × 2 격자 · 가로 2 · 세로 4 · 칸 안 좌우 0. QA 경6 «세로도 2px» 를 시안이 덮었다) */
  assert.match(props, /#txt-kind-group\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(6, auto\);\s*column-gap:\s*var\(--ui-space-0_5\);\s*row-gap:\s*var\(--ui-space-1\)/);
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
  assert.match(src['prop-text-template'], /sliderRowHTML\('태그 좌우', 'txt-label-padx-slider'[^\n]*title="태그 좌우패딩"/, '★태그 알약 여백 = 짧은 라벨 «태그 좌우» + title(시안 v9 · Q24)');
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
  assert.match(off, /id="txt-pl-row">\s*<span class="prop-label">좌측패딩/);
  /* QA 경3 — 그림이 저장된 상태를 따른다(풂 = 끊긴 사슬 · 잠금 = 이어진 사슬 · aria-pressed 와 같은 뜻) */
  assert.match(off, /id="txt-ph-chain"[\s\S]*?<line x1="5\.2" y1="4\.8" x2="6\.8" y2="7\.2"/, '★풂인데 이어진 사슬 그림');
  assert.match(on, /id="txt-ph-chain"[\s\S]*?<line x1="4\.5" y1="6" x2="7\.5" y2="6"/); assert.match(off, /id="txt-pr-row">\s*<span class="prop-label">우측패딩/);
  const read = stripComments(readSrc(ROOT, 'js/props/prop-text.js'));
  assert.match(read, /phLinked\s*=\s*tb\.dataset\.padXLinked != null \? tb\.dataset\.padXLinked === '1' : currentPadL === currentPadR/, '★잠금을 저장값에서 안 읽는다(Q26)');
  const wire = stripComments(readSrc(ROOT, 'js/props/prop-text-wireup-padding.js'));
  assert.match(wire, /tb\.dataset\.padXLinked = phLinked \? '1' : '0';[\s\S]*showLinked\(\);\s*window\.pushHistory\?\.\(/, '★사슬이 블럭에 쓰고 이력을 남기지 않는다');
  assert.match(wire, /phSlider\?\.addEventListener\('input', \(\) => setL\(/);
  assert.match(wire, /if \(phLinked\) \{[\s\S]*?tb\.dataset\.customPadR = '1';[\s\S]*?_syncBubbleTail\(\);\s*\}\s*showLinked\(\);/, '★다시 잠글 때 손댐 표시·꼬리 맞춤이 빠졌다(QA 경3)');
});

/* ⑧ 끝 옵션 칼럼 — 토큰 하나(--ui-opt-col-w) · 절 몸이 그만큼 비워 두고 머리 손잡이·줄 끝 사슬만 그 칼럼에. 양성대조: padding-right 규칙을 지우면 빨강 */
test('R8 옵션 칼럼 — --ui-opt-col-w 토큰 · 절 padding-right · 머리/사슬 줄 음수 margin · 타입 띠 제외', () => {
  assert.match(tokenOf(css('css/editor-base.css'), '--ui-opt-col-w') || '', /^calc\(22px \+ var\(--ui-space-1_5\)\)$/);
  const props = css('css/editor-props.css');
  assert.match(props, /\.prop-section\[data-sec\]:not\(\[data-sec="kind"\]\)\s*\{\s*padding-right:\s*calc\(var\(--ui-space-2\) \+ var\(--ui-opt-col-w\)\)/);
  assert.match(props, /:not\(\[data-sec="kind"\]\) > \.prop-sec-head\s*\{\s*margin-right:\s*calc\(-1 \* var\(--ui-opt-col-w\)\)/);
  assert.match(props, /\.prop-row:has\(> \.prop-chain-btn:last-child\)\s*\{\s*margin-right:\s*calc\(-1 \* var\(--ui-opt-col-w\)\)/);
});

/* ⑨ Stroke «＋»(켜면 «−» · 같은 체크박스) · Effects «＋»(종류 목록). 양성대조: strokeSection 머리를 옛 prop-toggle 로 되돌리면 빨강 */
test('R9 Stroke 머리 = 단추꼴 label 안 체크박스 + ＋/− 그림 · Effects 머리 = «＋» select(텍스트만) · 공용 fx 산출 기본 바이트 그대로', () => {
  const { loadTextTemplate, GOLDEN_STATE } = _req('./_text-template-harness.js');
  const T = loadTextTemplate();
  const on = T.buildTextPropsHtml({ ...GOLDEN_STATE, stroke: { on: false, width: 2, align: 'outside', color: '#000000' }, strokeColorHtml: '' });
  assert.match(on, /<label class="prop-chain-btn prop-sec-add"[^>]*>\s*<input type="checkbox" id="txt-stroke-on"\s+aria-label="Stroke">\s*<svg class="prop-sec-add-plus"[\s\S]*?<svg class="prop-sec-add-minus"/);
  assert.doesNotMatch(on, /id="txt-stroke-section"[\s\S]*?prop-toggle-track[\s\S]*?id="txt-stroke-section-body"/, '★Stroke 머리에 옛 켜기 토글이 남았다');
  /* ★기대 바뀜(시안 v10 · 현빈 GO 261120) — Effects ＋ = 22 단추 + 종류 메뉴(.fp-menu-item) · 고르개 아님 */
  assert.match(on, /<button type="button" class="prop-chain-btn prop-fx-add-btn" id="txt-fx-add-btn"[^>]*aria-haspopup="menu"[^>]*>[\s\S]*?<div class="prop-fx-menu" id="txt-fx-menu" role="menu" hidden><button type="button" class="fp-menu-item" role="menuitem" data-fx="/);
  assert.doesNotMatch(on, /id="txt-fx-add"/);
  const props = css('css/editor-props.css');
  assert.match(props, /\.prop-sec-add:has\(> input:checked\) > \.prop-sec-add-plus,\s*\.prop-sec-add:not\(:has\(> input:checked\)\) > \.prop-sec-add-minus\s*\{\s*display:\s*none/);
  assert.match(stripComments(readSrc(ROOT, 'js/effects-registry.js')), /<option value="">\$\{FX_ADD_HEAD_LABEL\}<\/option>/, '[대조] 다른 패널(plus 없음)은 옛 «효과 추가…» 그대로');
});

/* ⑫ 매핑 교정(현빈 261120) — 블럭마다 켜지는 칸은 정확히 하나 · 말풍선은 Bubble 만. 양성대조: _kind 를 currentClass 로 되돌리면 빨강
 *   ★기대 바뀜(지디 261120 · 시안 v10 실측: 곡선 13 · 아이콘텍스트 10 = 타입 칸 0) — 곡선·아이콘텍스트는 타입 절 없음(옛 판 그대로) */
test('R12b 켜짐 = 정확히 한 칸 — H1·Label·Bubble · 곡선/아이콘텍스트는 타입 절 없음', () => {
  const { loadTextTemplate, GOLDEN_STATE } = _req('./_text-template-harness.js');
  const T = loadTextTemplate();
  const html = (st) => T.buildTextPropsHtml({ ...GOLDEN_STATE, ...st });
  const on = (st) => {
    const g = /id="txt-kind-group">([\s\S]*?)\n {6}<\/div>/.exec(html(st))?.[1] || '';
    return [...g.matchAll(/<button class="prop-type-btn ?(active)?"[^>]*>([^<]*)<\/button>/g)].filter((m) => m[1]).map((m) => m[2]);
  };
  assert.deepEqual(on({ currentClass: 'tb-h1' }), ['H1']);
  assert.deepEqual(on({ currentClass: 'tb-label', isLabel: true }), ['Label']);
  /* Bullet 상태는 이 하네스가 글머리 명부(text-type-class)를 안 실어 못 그린다 — DOM P12b 가 잰다 */
  assert.deepEqual(on({ currentClass: 'tb-body', isSpeechBubble: true }), ['Bubble'], '★말풍선에 Body 가 같이 켜진다');
  assert.doesNotMatch(html({ currentClass: 'tb-liner', isLiner: true }), /id="txt-kind-group"|data-sec="kind"/, '★곡선에 타입 절이 생겼다(시안 v10 = 칸 0)');
  assert.doesNotMatch(html({ isIconText: true }), /id="txt-kind-group"|data-sec="kind"/, '★아이콘텍스트에 타입 절이 생겼다(시안 v10 = 칸 0)');
});
/* 라벨 크기 하나(시안 v9 #4) — ★기대 바뀜(지디 261120: 텍스트 패널만 → 전 패널 · 공용 클래스 정의 자리 한 곳). 양성대조: 정의를 fs-10 으로 되돌리면 빨강 */
test('R13 라벨 글자 크기 = --ui-fs-base — .prop-field-label · .prop-xy-label 정의 자리(전 패널) · 텍스트 전용 규칙 없음', () => {
  const props = css('css/editor-props.css');
  assert.match(props, /\.prop-field-label\s*\{\s*font-size:\s*var\(--ui-fs-base\)/);
  assert.match(props, /\.prop-xy-label\s*\{[^}]*font-size:\s*var\(--ui-fs-base\)/);
  assert.doesNotMatch(props, /data-order="text"\] :is\(\.prop-field-label/, '★텍스트 전용 규칙이 남았다');
  /* ⑧ 덧 — 틀 절 색 칸 바닥값(정적 렌더 실측 · 색 줄 128곳 넘침 → 0) */
  assert.match(props, /\.prop-section\[data-sec\] \.prop-color-field\s*\{\s*min-width:\s*121px/);
});

/* 시안 v10 ⑤ — 컬러 변수 칩 줄은 끝 옵션 칼럼까지 · 한 줄. 양성대조: 규칙을 지우면 빨강 */
test('R14 VAR·최근 색 칩 줄 — 끝 칼럼까지(음수 margin = --ui-opt-col-w) · nowrap · 최근 효과 줄만 빼고 (1120b R1 — 최근 색도 칼럼까지)', () => {
  assert.match(css('css/editor-props.css'), /\.prop-section\[data-sec\] > \.prop-sec-body > \.cv-chips:not\(\.ts-recent-row\)\s*\{\s*margin-right:\s*calc\(-1 \* var\(--ui-opt-col-w\)\);\s*flex-wrap:\s*nowrap/);
});

/* Q17 반전 «한 자리»(js/block-flip.js) — 저장 키 dataset.flipH/V = '1' · 끄면 키 지움 · transform 끝 scale(±1, ±1) 하나 · 회전 조각 보존 · 멱등.
 *   양성대조: applyFlip 이 scale 을 안 붙이면 빨강 */
test('R17 block-flip — 켜고 끄기 · 회전과 한 transform · 멱등 · 옛 저장본(키 없음)은 손 안 댐', async () => {
  const vm = await import('node:vm');
  const src = readSrc(ROOT, 'js/block-flip.js').replace(/^export\s+/gm, '');
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(src + '\n;globalThis.__F = { applyFlip, toggleFlip, flipScale };', ctx);
  const F = ctx.__F;
  const mk = (t = '') => { const st = { transform: t, transformOrigin: '', removeProperty(k) { this[k] = ''; } }; return { dataset: {}, style: st }; };
  const a = mk('rotate(30deg)');
  F.applyFlip(a);
  assert.equal(a.style.transform, 'rotate(30deg)', '★옛 저장본(키 없음)을 열기만 했는데 transform 을 바꿨다');
  assert.equal(F.toggleFlip(a, 'flipH'), true);
  assert.equal(a.dataset.flipH, '1');
  assert.equal(a.style.transform, 'rotate(30deg) scale(-1, 1)');
  F.toggleFlip(a, 'flipV');
  assert.equal(a.style.transform, 'rotate(30deg) scale(-1, -1)');
  a.style.transform = a.style.transform.replace(/rotate\([^)]*\)\s*/, '') + ' rotate(45deg)';   // 회전 코드(rotate 만 갈아 끼움)를 흉내
  F.applyFlip(a); F.applyFlip(a);
  assert.equal(a.style.transform, 'rotate(45deg) scale(-1, -1)', '★회전과 반전이 한 transform 에 안 산다 / 멱등 아님');
  F.toggleFlip(a, 'flipH'); F.toggleFlip(a, 'flipV');
  assert.deepEqual([a.dataset.flipH, a.dataset.flipV, a.style.transform], [undefined, undefined, 'rotate(45deg)'], '★끄면 키를 지우고 scale 을 걷는다');
  const b = mk(''); F.toggleFlip(b, 'flipH'); F.toggleFlip(b, 'flipH');
  assert.equal(b.style.transform, '', '★아무 것도 없으면 transform 도 없다');
  const tpl = stripComments(readSrc(ROOT, 'js/props/prop-text-template.js'));
  assert.match(tpl, /rotRowHTML\(\{ p: 'txt', numberId: 'txt-rot-number'/);
  assert.doesNotMatch(tpl, /txt-rot-slider/, '★회전 슬라이더가 남았다(Q20)');
});

/* Q37 — 블록 Template 절: 블럭이면 붙고(머리 ＋ · 이름·폴더·태그·저장) · 패널이 이미 template 절을 내면 안 붙고 · 블럭 아니면(섹션) 안 붙는다 · 저장 = saveBlockAsTemplate.
 *   양성대조: blockTemplateSection 이 늘 null 이면 빨강 */
test('R18 blockTemplateSection — 붙는 조건 · 마크업 · 저장 함수', async () => {
  const vm = await import('node:vm');
  const strip = (s) => String(s).replace(/^import[^\n]*\n/gm, '').replace(/^export\s+/gm, '');
  const ctx = { console, propPanel: {}, window: { SECTION_BLOCK_TYPE_SEL: '.text-block' } };
  vm.createContext(ctx);
  vm.runInContext([readSrc(ROOT, 'js/props/_helpers.js'), readSrc(ROOT, 'js/props/_section-spec.js'), readSrc(ROOT, 'js/props/_panel-frame.js')].map(strip).join('\n;\n') + '\n;globalThis.__T = { blockTemplateSection, sec };', ctx);
  const { blockTemplateSection, sec } = ctx.__T;
  const blk = { matches: (s) => s === '.text-block' }, secEl = { matches: () => false };
  const t = blockTemplateSection(blk, [sec('fill', 'f')]);
  assert.equal(t?.key, 'template');
  assert.match(t.html, /id="blk-tpl-form" hidden>[\s\S]*id="blk-tpl-name" placeholder="템플릿 이름"[\s\S]*id="blk-tpl-folder"[\s\S]*id="blk-tpl-tags" placeholder="태그 \(쉼표 구분\)"[\s\S]*id="blk-tpl-save">블록 템플릿으로 저장</);
  assert.match(t.headTools, /id="blk-tpl-toggle"[^>]*aria-expanded="false"/);
  assert.equal(blockTemplateSection(blk, [sec('template', 'mine')]), null, '★한 패널에 Template 절 둘');
  assert.equal(blockTemplateSection(secEl, []), null, '★블럭 아닌 것(섹션 등)에 붙었다');
  assert.match(stripComments(readSrc(ROOT, 'js/props/_panel-frame.js')), /window\.saveBlockAsTemplate\?\.\(block, name, f, /, '★우클릭과 같은 저장 함수를 안 쓴다');
});

/* QA2 ③(지디) — 회전·반전 transform 은 «한 함수가 한 순서로»: writeRotation(js/block-flip.js) = [나머지] rotate(θ) scale(±1, ±1).
 *   회전을 «쓰는» 자리는 전부 그 함수를 부른다(자리마다 문자열 + applyFlip 꼴 금지). 양성대조: CTL prd1-qa2-m1(텍스트가 옛 꼴로 되돌아감) → 빨강 */
test('R19 writeRotation — 순서 rotate → scale 고정 · 종류별 키 · 0° 키 지움 · keepKey 는 키 안 고침 · 쓰는 자리 전부 이 함수', async () => {
  const vm = await import('node:vm');
  const src = readSrc(ROOT, 'js/block-flip.js').replace(/^export\s+/gm, '');
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(src + '\n;globalThis.__F = { writeRotation, toggleFlip };', ctx);
  const F = ctx.__F;
  const mk = (t = '', cls = '') => ({ dataset: {}, classList: { contains: (c) => c === cls }, style: { transform: t, transformOrigin: '', removeProperty(k) { this[k === 'transform-origin' ? 'transformOrigin' : k] = ''; } } });
  const ORDER = /rotate\(-?\d+(?:\.\d+)?deg\) scale\(-?1, -?1\)$/;
  const a = mk('translate(3px, 4px)');
  F.toggleFlip(a, 'flipH');
  F.writeRotation(a, 30);
  assert.equal(a.style.transform, 'translate(3px, 4px) rotate(30deg) scale(-1, 1)', '★순서/보존');
  assert.match(a.style.transform, ORDER);
  assert.equal(a.dataset.rotation, '30');
  F.writeRotation(a, -45); F.writeRotation(a, -45);
  assert.equal(a.style.transform, 'translate(3px, 4px) rotate(-45deg) scale(-1, 1)', '★멱등 · 반전 뒤 각도 바꿔도 순서 고정');
  F.writeRotation(a, 200);
  assert.equal(a.dataset.rotation, '-160', '★감싸기(자르기 아님)');
  F.writeRotation(a, 0);
  assert.deepEqual([a.dataset.rotation, a.style.transform], [undefined, 'translate(3px, 4px) scale(-1, 1)'], '★0° = rotate 없음 · 키 지움 · 반전은 남음');
  const sh = mk('', 'shape-block'); F.writeRotation(sh, 15);
  assert.deepEqual([sh.dataset.shapeRotation, sh.dataset.rotation], ['15', undefined], '★도형 키 = shapeRotation');
  const r = mk('rotate(12deg)'); r.dataset.rotation = '12'; F.writeRotation(r, 12, { keepKey: true });
  assert.deepEqual([r.dataset.rotation, r.style.transform], ['12', 'rotate(12deg)'], '★렌더러(keepKey) — 옛 저장본(반전 없음)을 같은 꼴로');
  const z = mk(''); F.writeRotation(z, 0);
  assert.equal(z.style.transform, '', '★아무 것도 없으면 transform 도 없다');
  const sites = [
    ['js/asset-rotate.js', 5], ['js/props/prop-shape.js', 1], ['js/props/prop-text-wireup-position.js', 1], ['js/block-factory.js', 1],
    ['js/section-drag.js', 1], ['js/sticker-select.js', 1], ['js/blocks/iconify-block.js', 2], ['js/blocks/modal-block.js', 1], ['js/props/prop-vector.js', 1], ['js/frame-geometry.js', 1],
  ];
  for (const [f, n] of sites) {
    const code = stripComments(readSrc(ROOT, f));
    assert.equal((code.match(/\.writeRotation\??\.?\(/g) || []).length, n, `★${f} — 회전 쓰기가 한 함수를 안 부른다`);
    assert.doesNotMatch(code, /\.style\.transform\s*=[^;\n]*rotate\(\$\{/, `★${f} — 블럭 transform 에 rotate 를 손으로 짠다(순서가 갈린다)`);
  }
  const fg = stripComments(readSrc(ROOT, 'js/frame-geometry.js'));
  assert.match(fg, /const tf = d\.textFrame === 'true';\s*const fx = !tf && d\.flipH === '1'/, '★QA2 C2 — 틀 transform 이 텍스트 프레임 반전을 센다(⌘Z·열기에서 글 회전을 덮는다)');
});

/* QA2 ④(지디 ⓑ) — Figma JSON 에 반전이 안 실린다는 안내: 반전 블럭이 «있을 때만» · 수 포함 · 파일 저장·플러그인 업로드 두 길 다.
 *   양성대조: CTL prd1-qa2-figflip.patch(파일 저장 길의 안내 빠짐) → 빨강 */
test('R20 flipNotExportedText — 있을 때만 · 수 · 두 길', async () => {
  const vm = await import('node:vm');
  const src = readSrc(ROOT, 'js/io/export-figma-json.js');
  const fn = /function flipNotExportedText\(roots\) \{[\s\S]*?\n\}/.exec(src)?.[0];
  assert.ok(fn, '★flipNotExportedText 없음');
  const ctx = {}; vm.createContext(ctx); vm.runInContext(fn + '\n;globalThis.__f = flipNotExportedText;', ctx);
  const root = (n) => ({ querySelectorAll: (sel) => { assert.match(sel, /\[data-flip-h="1"\], \[data-flip-v="1"\]/); return { length: n }; } });
  assert.equal(ctx.__f([root(0), root(0)]), '', '★반전 블럭이 없는데 알린다');
  assert.equal(ctx.__f([]), '');
  assert.equal(ctx.__f([null]), '');
  assert.match(ctx.__f([root(2), root(1)]), /반전.*Figma 로 안 나갑니다.*3개/, '★수가 안 맞다');
  const code = stripComments(src);
  assert.match(code, /flipNotExportedText\(_flipRoots\)\]\.filter\(Boolean\)/, '★파일 저장(exportFigmaJSON) 길에 안내 없음');
  assert.match(code, /_flipRoots\.push\(sec\)/, '★내보낸 섹션을 안 센다');
  assert.match(stripComments(readSrc(ROOT, 'js/io/figma-publish.js')), /window\.flipNotExportedText\?\.\(selectedIds\.map/, '★플러그인 업로드 길에 안내 없음');
});

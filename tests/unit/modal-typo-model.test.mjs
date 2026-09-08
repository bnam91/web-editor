/* U-MDLTYPO — 모달의 «타이포 모델»이 dataset 에 살고, 재렌더를 견디는가. (2026-09-08, B단위)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리)로 부르지 마라 — Node 24 에서 한 개도 안 돌고 죽는데
 *     화면엔 「tests 1 / pass 0 / fail 1」로 «작은 실패»처럼 보인다.
 *
 * ★이 파일이 막으려는 «단 하나»의 사고
 *   모달 패널에 타이포 배선을 붙일 때, 텍스트 패널의 관례를 그대로 베끼면
 *   슬롯(.tb-mdl-text)에 인라인 style 을 박게 된다. 그러면 «첫 측정은 통과한다» —
 *     슬롯에 style.fontFamily 를 박고 getComputedStyle 로 재면 Georgia 가 나온다.
 *   그런데 renderModalBlock 은 `block.innerHTML = html` 로 슬롯을 «통째로 새로» 만든다.
 *   재렌더는 패널의 «모든» 조작·변형 전환·슬롯 글자 커밋·로드(save-load.js)마다 일어난다.
 *   ⇒ 인라인 배선은 첫 측정을 통과하고 «조용히 죽는다». 그게 이 파일이 잡으려는 것이다.
 *
 * ★그래서 모든 단언에 «재렌더 한 번 더»가 들어간다.
 *
 * ⚠️여기는 «렌더 산출물»(block.style.cssText / innerHTML)까지 잰다.
 *   진짜 getComputedStyle 은 이 레포에 jsdom 이 없어서 단위검사로는 못 잰다 —
 *   그건 CDP QA 가 실물 Electron 에서 잰다. 이 파일은 그 «앞단»이다:
 *   렌더가 선언을 안 내면 getComputedStyle 도 볼 것이 없다.
 *
 * ⛔주석 걷어내기는 공용 부품(./_strip-comments.js)만 쓴다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');
const { readSrc } = _req('./_srcread.js');
const { loadModalModule, fakeBlock } = _req('./_modal-harness.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const M = loadModalModule();
const SRC_MODAL = stripComments(readSrc(ROOT, 'js/blocks/modal-block.js'));

/** dataset 만 든 블록을 렌더하고 «렌더 산출물»을 돌려준다. */
function render(ds) {
  const b = fakeBlock(ds);
  M.renderModalBlock(b);
  return b;
}
/** ★재렌더 «한 번 더». 인라인 배선이 죽는 자리를 재현한다. */
function renderTwice(ds) {
  const b = fakeBlock(ds);
  M.renderModalBlock(b);
  const first = { css: b.style.cssText, html: b.innerHTML };
  M.renderModalBlock(b);
  return { block: b, first, second: { css: b.style.cssText, html: b.innerHTML } };
}
const slotsOf = (html) => [...String(html).matchAll(/data-mdl-slot="([^"]+)"/g)].map((m) => m[1]);

/* ══ B-0 — 「입력이 살아 있다」. ⛔이게 없으면 아래가 전부 0바퀴 자가통과한다. ══ */

test('B-0 ★변형이 6개 이상이고, «각 변형»의 슬롯이 하나도 안 비었다', () => {
  // 되돌리면 빨강: MODAL_VARIANTS 를 비우거나 renderModalBlock 이 슬롯을 안 그리면.
  assert.ok(Array.isArray(M.MODAL_VARIANTS), 'MODAL_VARIANTS 가 배열이 아니다');
  assert.ok(M.MODAL_VARIANTS.length >= 6,
    `변형이 ${M.MODAL_VARIANTS.length}개다 — 6개 이상이어야 한다. ` +
    `목록이 비면 아래 검사들이 «한 바퀴도 안 돌면서» 초록이 된다.`);
  for (const v of M.MODAL_VARIANTS) {
    const slots = slotsOf(render({ variant: v }).innerHTML);
    assert.ok(slots.length > 0,
      `변형 «${v}» 의 슬롯이 0개다 — 렌더가 글자 자리를 안 만든다. ` +
      `이 상태로는 「타이포가 먹는가」를 «잴 대상 자체»가 없다.`);
  }
  // 슬롯 이름이 실제로 갈린다는 것도 세운다(전부 같은 이름이면 잣대가 죽은 것이다)
  assert.deepEqual(slotsOf(render({ variant: 'grid-2' }).innerHTML), ['cell1', 'cell2'],
    'grid-2 의 슬롯이 cell1/cell2 가 아니다 — 렌더 모양이 바뀌었다');
  assert.deepEqual(slotsOf(render({ variant: 'titled' }).innerHTML), ['title', 'text'],
    'titled 의 슬롯이 title/text 가 아니다');
});

/* ══ B-1 — 렌더가 타이포 선언을 «실제로» 낸다 ═════════════════════════════ */

const CASES = [
  ['fontFamily', { fontFamily: 'Georgia, serif' }, /font-family:Georgia, serif;/],
  ['fontWeight', { fontWeight: '700' }, /font-weight:700;/],
  ['bold',       { bold: '1' }, /font-weight:700;/],
  ['lineHeight', { lineHeight: '2.4' }, /line-height:2.4;/],
  ['letterSpacing', { letterSpacing: '3' }, /letter-spacing:3px;/],
  ['italic',     { italic: '1' }, /font-style:italic;/],
  ['strike',     { strike: '1' }, /text-decoration:line-through;/],
];

test('B-1 ★dataset 에 넣은 타이포가 «전부» cssText 로 나온다', () => {
  // 되돌리면 빨강: _typoStyles 에서 어느 한 줄이라도 빠지면.
  assert.equal(CASES.length, 7, '검사 항목이 7개가 아니다 — 목록이 줄면 빠진 키를 아무도 안 본다');
  for (const [name, ds, re] of CASES) {
    const css = render({ variant: 'plain', ...ds }).style.cssText;
    assert.match(css, re, `«${name}» 을 dataset 에 넣었는데 cssText 에 안 나온다.\n  실제: ${css}`);
  }
});

test('B-1-b ★B(bold)가 굵기 select 를 이긴다 — 텍스트 패널과 같은 관례', () => {
  // 되돌리면 빨강: _effWeight 에서 bold 우선순위를 없애면.
  const css = render({ variant: 'plain', bold: '1', fontWeight: '300' }).style.cssText;
  assert.match(css, /font-weight:700;/, `bold=1 인데 300 이 이겼다: ${css}`);
  assert.doesNotMatch(css, /font-weight:300;/, `굵기 선언이 «둘» 나갔다: ${css}`);
});

/* ══ B-3 — ★★재렌더 생존. 이 파일의 존재 이유. ═══════════════════════════ */

test('B-3 ★재렌더를 «한 번 더» 해도 타이포가 그대로다', () => {
  /* 되돌리면 빨강: 배선이 dataset 이 아니라 슬롯 인라인에 쓰도록 바뀌면
     (그러면 dataset 이 비고, 여기서 재렌더한 cssText 에 선언이 아예 안 나온다). */
  for (const [name, ds, re] of CASES) {
    const { first, second } = renderTwice({ variant: 'plain', ...ds });
    assert.match(first.css, re, `«${name}»: 첫 렌더에서부터 안 나왔다 — B-1 을 먼저 봐라`);
    assert.match(second.css, re,
      `«${name}» 이 «재렌더 뒤» 사라졌다. 이게 인라인 배선이 조용히 죽는 자리다.\n` +
      `  1회: ${first.css}\n  2회: ${second.css}`);
    assert.equal(first.css, second.css, `«${name}»: 두 렌더의 cssText 가 다르다 — 렌더가 멱등이 아니다`);
  }
});

test('B-3-b ★양성대조 — 슬롯에 «직접» 박은 것은 재렌더에서 «실제로» 죽는다', () => {
  /* ⛔이 단언이 없으면 B-3 이 「무엇을 막고 있는지」가 증명되지 않는다.
     renderModalBlock 은 block.innerHTML 을 통째로 갈아끼운다 — 그걸 여기서 실물로 보인다. */
  const b = fakeBlock({ variant: 'plain' });
  M.renderModalBlock(b);
  // 「슬롯에 인라인으로 박는」 배선이 하는 짓을 흉내낸다.
  b.innerHTML = b.innerHTML.replace('<div class="tb-mdl-text"',
    '<div class="tb-mdl-text" style="font-family:Georgia, serif;color:rgb(255,0,0)"');
  assert.match(b.innerHTML, /font-family:Georgia/, '주입이 «안 먹었다» — 이 대조는 아무것도 증명하지 못한다');

  M.renderModalBlock(b);   // ★재렌더 한 번 더
  assert.doesNotMatch(b.innerHTML, /font-family:Georgia/,
    '슬롯에 박은 인라인이 재렌더 뒤에도 살아 있다 — renderModalBlock 이 innerHTML 을 ' +
    '통째로 갈아끼우지 않게 바뀌었나. 그렇다면 B-3 의 전제가 무너진 것이다.');
  assert.match(SRC_MODAL, /block\.innerHTML\s*=\s*html/,
    'renderModalBlock 이 innerHTML 을 통째로 쓰지 않는다 — 이 검사의 근거가 사라졌다');
});

/* ══ B-4 — 저장·로드 왕복 ════════════════════════════════════════════════ */

test('B-4 ★dataset 만 남은 «왕복본»도 같은 화면을 낸다', () => {
  /* 저장·로드는 dataset 만 싣고 온다(인라인 style 은 안 실린다).
     되돌리면 빨강: 타이포가 dataset 이 아니라 인라인에만 살면 왕복 뒤 전부 증발한다. */
  const ds = { variant: 'titled', fontFamily: 'Georgia, serif', fontWeight: '300',
               lineHeight: '2.2', letterSpacing: '2', italic: '1', strike: '1' };
  const live = renderTwice(ds);
  // 「저장→로드」 흉내: dataset 을 JSON 으로 왕복시킨 «새» 블록.
  const roundTripped = render(JSON.parse(JSON.stringify({ ...ds })));
  assert.equal(roundTripped.style.cssText, live.second.css,
    `왕복본의 cssText 가 다르다 — 어떤 값이 dataset 밖에 살고 있다.\n` +
    `  살아있던 것: ${live.second.css}\n  왕복본:      ${roundTripped.style.cssText}`);
  assert.equal(roundTripped.innerHTML, live.second.html, '왕복본의 슬롯 HTML 이 다르다');
});

/* ══ B-5 — 이 커밋은 «화면을 안 바꾼다» ══════════════════════════════════ */

test('B-5 ★타이포 dataset 이 없는 블록은 예전과 «같은» 선언만 낸다', () => {
  /* 되돌리면 빨강: _typoStyles 가 기본값을 무조건 뱉게 만들면(예: font-weight:400 항상).
     그러면 이 커밋이 조용히 화면을 바꾼다. */
  for (const v of M.MODAL_VARIANTS) {
    const css = render({ variant: v }).style.cssText;
    assert.match(css, /line-height:1\.7;/, `«${v}»: 예전 하드코딩 1.7 이 사라졌다: ${css}`);
    for (const [what, re] of [['font-family', /font-family:/], ['font-weight', /font-weight:/],
                              ['letter-spacing', /letter-spacing:/], ['font-style', /font-style:/],
                              ['text-decoration', /text-decoration:/]]) {
      assert.doesNotMatch(css, re,
        `«${v}»: 아무 것도 안 정했는데 ${what} 선언이 나갔다 — 이 커밋은 화면을 바꾸면 안 된다.\n  ${css}`);
    }
  }
});

test('B-5-b ★line-height 1.7 이 «리터럴»로 안 박혀 있다 (dataset 이 출처다)', () => {
  // 되돌리면 빨강: renderModalBlock 안에 line-height:1.7 을 도로 적으면.
  assert.doesNotMatch(SRC_MODAL, /line-height:1\.7/,
    'modal-block.js 에 line-height:1.7 이 리터럴로 남아 있다 — 그러면 패널이 줄간격을 ' +
    '바꿔도 «먹는 척하고 안 먹는다». 출처는 MODAL_DEFAULTS.lineHeight 하나여야 한다.');
  assert.match(SRC_MODAL, /lineHeight:\s*1\.7/, 'MODAL_DEFAULTS.lineHeight 가 1.7 이 아니다 — 기본 화면이 바뀐다');
  assert.equal(M.MODAL_DEFAULTS.lineHeight, 1.7, '런타임 기본값이 1.7 이 아니다');
});

/* ══ B-6 — 예상버그 둘을 «실측으로» 못박는다 ═════════════════════════════ */

test('B-6 ★titled 의 제목은 굵기를 «정했을 때만» 인라인으로 받는다 (CSS 700 을 이기려고)', () => {
  /* ★근거(실측): css/editor-blocks.css 의 `.modal-block .tb-mdl-title { font-weight: 700 }` 은
     선택자가 붙은 규칙이라, 루트 인라인 굵기가 «상속»으로 내려와도 그걸 못 이긴다.
     되돌리면 빨강: _titleWeightCss 를 지우면 titled 에서 굵기가 «제목에만» 안 먹는다. */
  const titleStyle = (b) => (b.innerHTML.match(/<div class="tb-mdl-title"[^>]*style="([^"]*)"/) || [])[1];

  const set = render({ variant: 'titled', fontWeight: '300' });
  assert.match(titleStyle(set), /font-weight:300;/,
    `굵기 300 을 정했는데 제목에 인라인이 안 붙었다 — CSS 의 700 이 이겨서 «제목만» 안 바뀐다: ${titleStyle(set)}`);

  const unset = render({ variant: 'titled' });
  assert.doesNotMatch(titleStyle(unset) || '', /font-weight/,
    `굵기를 안 정했는데 제목에 인라인 굵기가 붙었다 — CSS 의 «제목은 굵다»(700)가 죽는다: ${titleStyle(unset)}`);

  // 근거가 낡으면 먼저 알려 준다.
  const css = stripComments(readSrc(ROOT, 'css/editor-blocks.css'));
  assert.match(css, /\.modal-block\s+\.tb-mdl-title\s*\{[^}]*font-weight:\s*700/,
    'CSS 의 «제목은 700» 규칙이 사라졌다 — _titleWeightCss 의 존재 이유가 없어졌다. 다시 재고 정하라.');
});

test('B-6-b ★컬러변수 var(--color-…) 를 색으로 «받는다»', () => {
  /* 되돌리면 빨강: _MDL_COLOR_RE 에서 var(…) 갈래를 지우면 — 그러면 Fill 절의 컬러변수 칩이
     「눌리는데 안 먹는」 상태가 된다(실측 2026-09-08). */
  const ok = M.makeModalBlock({ textColor: 'var(--color-brand, #ff0000)' });
  assert.equal(ok.block.dataset.textColor, 'var(--color-brand, #ff0000)',
    `컬러변수를 거부했다 — 칩을 눌러도 기본색으로 되돌아간다. 실제: ${ok.block.dataset.textColor}`);
  M.renderModalBlock(ok.block);
  assert.match(ok.block.style.cssText, /color:var\(--color-brand, #ff0000\);/,
    `cssText 에 var() 가 안 실렸다: ${ok.block.style.cssText}`);

  // ⛔그렇다고 아무거나 받으면 안 된다 — cssText 를 깨는 값은 여전히 거부한다.
  const bad = M.makeModalBlock({ textColor: 'red;position:fixed' });
  assert.notEqual(bad.block.dataset.textColor, 'red;position:fixed',
    '세미콜론이 든 값을 그대로 받았다 — cssText 선언이 깨지고 그 뒤가 통째로 밀린다');
});

/* ══ B-7 — 패널 «배선»이 dataset 으로 간다 (소스) ═════════════════════════
 * ⚠️이 절만 소스 문자열을 잰다. 이유를 적어 둔다:
 *   위 검사들은 renderModalBlock 을 «진짜로» 돌려서 잰다. 하지만 패널 배선
 *   (showModalProperties 안의 리스너들)은 propPanel.innerHTML 파싱이 필요해서
 *   jsdom 없이는 못 돌린다 — 이 레포엔 jsdom 이 없다.
 *   ⇒ 실물 확인은 CDP QA 가 한다. 여기서는 «배선이 dataset 으로 가는가»만 소스로 못박는다.
 *   ⛔이게 없으면 setDs 에서 dataset 대입 한 줄만 지워도 «전부 초록»이다(실측: 변이 M2 가
 *     이 절을 붙이기 전엔 살아남았다).
 */

const SRC_PANEL = stripComments(readSrc(ROOT, 'js/props/prop-modal.js'));

/** `const name = (…) => { … }` 의 본문을 «중괄호 균형»으로 잘라 온다. ⛔고정 창 금지. */
function arrowBody(src, name) {
  const i = src.indexOf(`const ${name} =`);
  assert.ok(i >= 0, `${name} 을 못 찾았다 — 이 검사는 지금 아무것도 안 보고 있다`);
  const open = src.indexOf('{', i);
  assert.ok(open >= 0, `${name}: 여는 중괄호를 못 찾았다`);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(open, j + 1);
  }
  assert.fail(`${name}: 중괄호 짝이 안 맞는다`);
}

test('B-7 ★setDs 가 «dataset 에 쓰고» 재렌더한다', () => {
  // 되돌리면 빨강: 대입을 지우거나 rerender() 를 빼면(변이 M2).
  const body = arrowBody(SRC_PANEL, 'setDs');
  assert.match(body, /block\.dataset\[key\]\s*=\s*String\(val\)/,
    `setDs 가 block.dataset 에 «안 쓴다» — 패널을 아무리 만져도 모델이 안 바뀐다.\n  본문: ${body}`);
  assert.match(body, /delete block\.dataset\[key\]/,
    'setDs 가 «지우기»를 안 한다 — 값을 끄면(B 를 다시 누르면) 선언이 안 사라진다');
  assert.match(body, /\brerender\(\)/,
    `setDs 가 rerender() 를 안 부른다 — dataset 은 바뀌는데 «화면이 안 바뀐다».\n  본문: ${body}`);
  // ⛔슬롯 인라인으로 새는지도 본다 — 이 파일의 존재 이유다.
  assert.doesNotMatch(SRC_PANEL, /tb-mdl-(text|title|cell)/,
    'prop-modal.js 가 슬롯(.tb-mdl-*)을 직접 만진다 — 재렌더가 통째로 지우는 자리다. dataset 에 써라.');
  assert.doesNotMatch(SRC_PANEL, /\.style\.(fontFamily|fontWeight|lineHeight|letterSpacing)/,
    'prop-modal.js 가 인라인 style 로 타이포를 박는다 — 재렌더에서 죽는다. dataset 에 써라.');
});

test('B-7-b ★타이포 컨트롤 «전부»가 배선돼 있다 (id 9종 + setDs 호출)', () => {
  /* 되돌리면 빨강: 컨트롤 하나의 리스너를 지우면.
     ⛔먼저 「마크업이 그 id 를 실제로 낸다」를 세운다 — 안 그러면 목록이 낡아도 조용하다. */
  const IDS = ['mdl-typo-font-weight', 'mdl-typo-size-number', 'mdl-typo-lh-number', 'mdl-typo-ls-number',
               'mdl-typo-bold-btn', 'mdl-typo-italic-btn', 'mdl-typo-strike-btn', 'mdl-typo-highlight-btn',
               'mdl-typo-color', 'mdl-typo-color-hex', 'mdl-typo-color-alpha', 'mdl-typo-color-chips'];
  assert.equal(IDS.length, 12, '목록이 12개가 아니다 — 줄면 빠진 컨트롤을 아무도 안 본다');

  // 양성대조: 그 id 들이 «실제로» 절 마크업에서 나온다.
  const markup = buildTypoMarkup();
  for (const id of IDS) {
    assert.ok(markup.includes(`id="${id}"`),
      `절 마크업이 «${id}» 를 안 낸다 — id 규칙이 바뀌었다. 이 상태로는 아래 배선 검사가 ` +
      `「없는 것을 안 배선했다」고 통과하거나, 진짜 배선 누락을 못 잡는다.`);
  }
  // 본 단언: 패널이 그 id 를 «집는다».
  for (const id of IDS) {
    assert.ok(SRC_PANEL.includes(id),
      `prop-modal.js 가 «${id}» 를 안 집는다 — 그 컨트롤은 화면에 보이는데 «아무 일도 안 한다».`);
  }
  // 그리고 그 배선들이 실제로 dataset 으로 간다(폰트 피커의 onPick 포함).
  const setDsCalls = (SRC_PANEL.match(/\bsetDs\(/g) || []).length;
  assert.ok(setDsCalls >= 8,
    `setDs( 호출이 ${setDsCalls}개다 — 8개 이상이어야 한다(폰트·굵기·크기·B/I/S/H·줄간격·자간·색). ` +
    `줄었다면 어떤 컨트롤이 dataset 을 안 거치고 있다.`);
  assert.match(SRC_PANEL, /wireFontPicker\(\{[\s\S]*?onPick:[\s\S]*?setDs\('fontFamily'/,
    '폰트 피커의 onPick 이 dataset.fontFamily 로 안 간다 — 폰트만 재렌더에서 죽는다');
});

/** 절 마크업을 «소스 그대로» 돌려서 얻는다(베끼지 않는다). */
function buildTypoMarkup() {
  const vm = _req('node:vm');
  const strip = (rel) => readSrc(ROOT, rel).replace(/^import[^\n]*\n/gm, '').replace(/^export\s+/gm, '');
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(`${strip('js/props/prop-text-utils.js')}\n;${strip('js/props/_typo-section.js')}
    ;globalThis.__O = buildTypographySectionHtml({ p:'mdl-typo', font:'', weight:'', size:36,
        isBold:false, isItalic:false, isStrike:false, isHighlight:false, lh:1.7, ls:0, sizeMin:10, sizeMax:60 })
      + buildFillSectionHtml({ p:'mdl-typo', colorHex:'#1c1c1e', alpha:100 });`,
    ctx, { filename: 'js/props/_typo-section.js' });
  return ctx.__O;
}

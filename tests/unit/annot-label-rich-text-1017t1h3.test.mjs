/* annot-label-rich-text-1017t1h3 — 어노테이션 라벨의 «부분 서식»(고른 글자만 색·폰트크기)이
 *   ★«어디까지 열렸나»와 ★«무엇이 안 달라졌나»를 잰다.
 *
 * ★요구(현빈 1017t1h3 원문): 「라벨의 텍스트인 경우 선택한 영역만 색지정 혹은 폰트크기 등 각 다르게
 *   입력할수 있게해줘. 일반 텍스트 블럭 처럼 말야.」
 *
 * ★★무엇을 잠그나 — ★이 검사의 ★심장은 H2·H3 ★둘이다
 *   H0 전제  — 내보내는 이름 · `font-size` 가 ★기본 명부에 ★없다 · 좁히는 표에 ★딱 하나 있다
 *   H1 열림  — `opts.styleProps` 를 ★줄 때만 `font-size:14px` 가 통과한다(안 주면 ★옛 길 = 제거)
 *   H2 좁힘  — `inherit`·`larger`·`xx-large`·`2em`·`200%`·`0px`·맨수·`calc(`·`url(`·4자리px 가 ★전부 막힌다
 *              ⇐ ★이 칸이 ★이 티켓의 ★설계 결정이다. `--tb-dot-i` 와 ★같은 길로 열었다면
 *                 `safeStyleValue` 의 `VAL_WORD` 가 ★`inherit` 류를 ★통과시켰다(그 실측이 ★처방의 근거다).
 *   H3 무변  — ★기본 명부 ★다섯을 ★전수로: ★어노테이션 opts 를 ★주든 ★안 주든 ★산출이 ★한 글자도 같다
 *              ＋ `--tb-dot-i`(옛 소비자가 연 prop)도 ★그대로 — ★좁히는 표가 ★그 길을 ★안 건드린다
 *   H4 명부  — 라벨은 ★제 거르개를 ★안 만들었다(⛔새 sanitizer 0) · 공용 한 벌을 ★import 한다
 *   H5 저장  — `labelHtml` 이 `ANNOT_DATA_KEYS` 에 있다(없으면 리로드·⌘Z 복원마다 서식이 사라진다 — labelDx 가 밟은 그 함정)
 *   H6 갈림  — 팩토리·커밋·패널 ★세 자리가 ★「서식 있을 때만 HTML, 없으면 평문」 ★한 규약을 쓴다
 *
 * ★★이 검사가 ★못 재는 것(솔직히) — ⛔`sanitizeRichTextHtml` ★자체는 ★여기서 ★안 돈다.
 *   그 함수는 `document.createElement('template')` 가 필요하고 ★이 레포 단위 하네스엔 ★DOM 이 없다(jsdom 0).
 *   ⇒ ★여기서는 ★그 값 게이트인 ★`sanitizeStyle`(★순수 문자열 함수)을 ★소스에서 걷어 ★그대로 돌린다 —
 *     ★`font-size` 를 ★받거나 ★버리는 ★판단은 ★전부 ★그 함수 안에 있다(sanitizeInto 는 그 결과를 ★쓰기만 한다).
 *   ★«태그 거르기»(script·onerror·javascript:·url()·중첩 언랩)와 ★«라벨 렌더/왕복»은 ★DOM 축이다 —
 *     기존 tests/dom/rich-text-sanitize.dom.spec.js 가 그 축의 자리이고,
 *     ★1017t1h3 은 ★그것을 ★9334 개발판(실 DOM)에서 ★손으로 재서 ★보고에 수를 남겼다(DOM 0 지시).
 *
 * ⛔앱 0 · 네트워크 0 · DOM 0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

const SANITIZE_MOD = 'js/util/sanitize-rich-text.js';
const ANNOT_MOD    = 'js/blocks/annotation-block.js';
const SELECT_MOD   = 'js/annotation-select.js';
const PANEL_MOD    = 'js/props/prop-annotation.js';

/** 모듈 본문을 ★그대로 평가해 ★«안쪽» 이름까지 걷는다 — ⛔기대값을 손으로 옮겨적지 않는다.
 *  ★최상위에 `document` 접근이 ★없으므로(정규식 const · Set · 함수 선언뿐) ★DOM 없이 실린다.
 *  ★DOM 이 필요한 함수(sanitizeRichTextHtml·richTextBlocksToBreaks)는 ★부르지 않는다. */
function loadSanitize() {
  const src = readSrc(REPO, SANITIZE_MOD);
  const names = ['RICH_TEXT_ALLOWED_TAGS', 'RICH_TEXT_ALLOWED_STYLE_PROPS', 'RICH_TEXT_STRICT_STYLE_VALS',
    'sanitizeStyle', 'safeStyleValue', 'normOpts'];
  return new Function(src.replace(/\bexport\s+/g, '') + `\n;return { ${names.join(', ')} };`)();
}
const S = loadSanitize();

/** 어노테이션이 ★실제로 넘기는 opts — ⛔검사가 손으로 적지 않는다. 소스의 리터럴을 평가한다. */
function annotOpts() {
  const src = readSrc(REPO, ANNOT_MOD);
  const m = src.match(/export const ANNOT_RICH_TEXT_OPTS = (Object\.freeze\([\s\S]*?\));/);
  assert.ok(m, '★전제: ANNOT_RICH_TEXT_OPTS 정의를 찾았다');
  // eslint-disable-next-line no-new-func
  return new Function(`return ${m[1]};`)();
}
const OPTS = annotOpts();
/** 소비자가 준 opts → 내부 cfg(정규화된 Set 꼴). sanitizeStyle 이 받는 ★그 값이다. */
const cfg = (o) => S.normOpts(o);
/** 한 선언을 걸러 본다 — 돌아온 값이 '' 면 ★그 선언이 버려졌다. */
const style = (decl, o) => S.sanitizeStyle(decl, cfg(o));

/* ── H0 전제 ───────────────────────────────────────────────────────── */
test('H0 전제 ★계측기 — 함수가 실리고, font-size 는 기본 명부에 «없고», 좁히는 표에 «있다»', () => {
  assert.equal(typeof S.sanitizeStyle, 'function', 'sanitizeStyle 을 걷었다');
  assert.equal(typeof S.safeStyleValue, 'function', 'safeStyleValue 를 걷었다');
  assert.equal(typeof S.normOpts, 'function', 'normOpts 를 걷었다');
  // ★런타임 값으로 읽는다(소스 문자열 파싱 아님 — 내 주석이 입력이 되는 함정 회피)
  assert.equal(S.RICH_TEXT_ALLOWED_STYLE_PROPS.has('font-size'), false,
    '★font-size 를 ★기본 명부에 더하지 않았다(더하면 스티커·모달·그리드·line-host 넷의 공격면이 같이 넓어진다)');
  assert.ok(S.RICH_TEXT_STRICT_STYLE_VALS instanceof Map, '좁히는 표가 Map 으로 실렸다');
  assert.deepEqual([...S.RICH_TEXT_STRICT_STYLE_VALS.keys()], ['font-size'],
    '★좁히는 표의 손님은 지금 font-size 하나다 — 늘면 이 줄이 빨개져 「값 패턴을 같이 적었나」를 묻는다');
  assert.deepEqual(OPTS, { styleProps: ['font-size'] },
    '★어노테이션이 여는 것은 font-size «하나»다 — classes 는 열지 않았다(라벨엔 형광펜·점이 없다)');
  /* ★★두 명부가 ★겹치지 않는다 — ★`sanitizeStyle` 의 `!isBase` 가드가 ★뜻을 갖는 ★전제다.
     ★왜 적나(1017t1h3 변이 M3): 「strict 를 ★base 에도 적용」으로 바꿔도 ★검사가 ★전부 초록이었다.
       까닭은 ★겹치는 prop 이 ★0 이라 ★두 판이 ★행동이 ★같았기 때문 — ★«죽은 변이»였다.
     ⇒ ★겹침이 생기는 날 ★이 줄이 빨개져 「그 가드가 이제 ★행동을 가른다」를 ★알린다. */
  const overlap = [...S.RICH_TEXT_STRICT_STYLE_VALS.keys()].filter((p) => S.RICH_TEXT_ALLOWED_STYLE_PROPS.has(p));
  assert.deepEqual(overlap, [],
    '★기본 명부 ∩ 좁히는 표 = ∅ — 겹치면 `!isBase` 가드가 기본 명부의 값 검사를 «바꾸기» 시작한다');
});

/* ── H1 열림 ───────────────────────────────────────────────────────── */
test('H1 열림 ★opts 를 줄 때만 font-size 가 통과한다', () => {
  assert.equal(style('font-size:14px', OPTS), 'font-size:14px', '어노테이션 opts → 통과');
  assert.equal(style('font-size: 24px', OPTS), 'font-size:24px', '공백 있는 직렬화 꼴도 통과(Chrome 산출)');
  assert.equal(style('font-size:8.5px', OPTS), 'font-size:8.5px', '소수점도 통과');
  assert.equal(style('FONT-SIZE:14px', OPTS), 'font-size:14px', 'prop 이름 대소문자 무관');
  assert.equal(style('font-size:14px', null), '',
    '★opts 를 안 주면 ★제거 = 스티커·모달·line-host 는 ★옛 동작 그대로다');
  assert.equal(style('font-size:14px', { styleProps: ['--tb-dot-i'] }), '',
    '★다른 소비자가 다른 prop 을 열어도 font-size 는 ★안 열린다(이름을 하나씩 적는다)');
});

/* ── H2 좁힘 — ★이 티켓의 설계 결정 ───────────────────────────────── */
test('H2 좁힘 ★«수 + px» 밖은 전부 막힌다 — VAL_WORD 를 타지 않는다', () => {
  /* ⚠️이 목록이 ★처방의 근거다: `--tb-dot-i` 와 ★같은 길로 열었다면 safeStyleValue 의
     VAL_WORD(/^[a-z]+([ -][a-z]+)*$/i)가 ★아래 낱말들을 ★통과시킨다.
     ★★＋ 아래 음성대조가 ★잰 한 가지 더 — 그 길은 ★`14px` 를 ★막는다(옛 네 패턴에 «수+단위»가 없다).
       ⇒ ★좁히는 표는 ★«샘을 막는 자»이면서 ★«이 기능을 서게 하는 자»다. */
  for (const bad of ['inherit', 'larger', 'smaller', 'xx-large', 'medium', 'initial', 'unset', 'revert']) {
    assert.equal(style(`font-size:${bad}`, OPTS), '', `낱말 「${bad}」은 수가 아니다 — 막힌다`);
    assert.equal(S.safeStyleValue(bad), bad,
      `★대조: safeStyleValue 는 「${bad}」을 ★그대로 받는다 ⇒ 위 초록은 ★좁히는 표가 ★일하고 있다는 뜻이다`);
  }
  for (const bad of ['2em', '1.5rem', '200%', '12pt', '3vw', '1ex', '14', '0', '-14px', '0px', '0.5px',
    'calc(1px + 2px)', 'url(//evil/x)', 'url(javascript:alert(1))', 'expression(1)', '1000px', '14px!important',
    '14 px', 'var(--x)', '']) {
    assert.equal(style(`font-size:${bad}`, OPTS), '', `「${bad}」은 막힌다`);
  }
  for (const ok of ['1px', '9px', '24px', '48px', '999px', '12.5px', '8.125px']) {
    assert.equal(style(`font-size:${ok}`, OPTS), `font-size:${ok}`, `「${ok}」은 통과한다`);
  }
  // ★같은 선언문에 둘을 넣어 끼워 팔기 — 좋은 쪽만 남는다
  assert.equal(style('font-size:14px;background-image:url(//evil)', OPTS), 'font-size:14px',
    '명부 밖 prop(background-image)은 같은 줄에 있어도 버려진다');
});

/* ── H3 무변 — ★기본 명부 전수 ────────────────────────────────────── */
test('H3 무변 ★기본 명부 다섯은 opts 를 주든 안 주든 산출이 같다 (전수)', () => {
  /* ★분모를 손으로 적지 않는다 — ★정의 자리의 ★런타임 값을 돈다. */
  const props = [...S.RICH_TEXT_ALLOWED_STYLE_PROPS];
  assert.equal(props.length, 5, `★전제: 기본 명부는 다섯이다(지금 ${props.length}) — 늘었으면 아래 표본을 같이 늘려라`);
  /* 값 표본: 각 패턴 갈래(hex·함수형·낱말·정수)와 ★막혀야 하는 것들. */
  const VALS = ['#ff0000', '#f00', 'rgb(1,2,3)', 'rgba(1,2,3,0.5)', 'hsl(1,2%,3%)', 'bold', 'italic',
    'underline', 'line-through', 'normal', '700', '999', '999999', 'url(//evil)', 'expression(1)',
    'javascript:alert(1)', '14px', 'inherit', ''];
  for (const p of props) {
    for (const v of VALS) {
      const withOpts = style(`${p}:${v}`, OPTS);
      const without  = style(`${p}:${v}`, null);
      assert.equal(withOpts, without,
        `★${p}:${v} — 어노테이션 opts 가 ★기본 명부의 판단을 ★바꾸면 안 된다(with=${JSON.stringify(withOpts)} without=${JSON.stringify(without)})`);
    }
  }
  // ★점 찍기(옛 소비자가 연 prop)도 그대로 — 좁히는 표가 그 길을 안 건드린다
  const dot = { styleProps: ['--tb-dot-i'] };
  assert.equal(style('--tb-dot-i:-0.5', dot), '--tb-dot-i:-0.5', '음수·소수 그대로(VAL_SNUM 길)');
  assert.equal(style('--tb-dot-i:1', dot), '--tb-dot-i:1');
  assert.equal(style('--tb-dot-i:url(//evil)', dot), '', 'url( 은 두 패턴 어느 쪽도 통과 못 한다');
  assert.equal(style('--tb-dot-i:bold', dot), '--tb-dot-i:bold',
    '★낱말도 통과한다 — ★이것이 ★옛 동작이고, ★좁히는 표는 ★이 prop 을 ★안 건드렸다(바뀌었으면 빨개진다)');
});

/* ── H4 명부 — 새 거르개 0 ─────────────────────────────────────────── */
test('H4 명부 ★라벨은 제 거르개를 만들지 않았다 — 공용 한 벌을 import 한다', () => {
  const src = readSrc(REPO, ANNOT_MOD);
  assert.match(src, /import \{[^}]*sanitizeRichTextHtml[^}]*\} from '\.\.\/util\/sanitize-rich-text\.js'/,
    '공용 모듈에서 sanitizeRichTextHtml 을 들인다');
  assert.match(src, /import \{[^}]*richTextHasFormatting[^}]*\} from '\.\.\/util\/sanitize-rich-text\.js'/,
    '서식 판정도 같은 한 벌');
  assert.match(src, /import \{[^}]*richTextBlocksToBreaks[^}]*\} from '\.\.\/util\/sanitize-rich-text\.js'/,
    '블럭 경계 펴기도 같은 한 벌(line-host _lnReadHtml 과 같은 식)');
  // ⛔제 손으로 거르거나 이스케이프 사본을 만들지 않았다(1013t2C6 의 금지)
  assert.doesNotMatch(src, /createElement\(['"]template['"]\)/, '★제 template 파서를 세우지 않았다');
  assert.doesNotMatch(src, /replace\(\/<\/g/, '★손 이스케이프 사본을 만들지 않았다');
  // ★소비자 명부(그 모듈 머리말)에 라벨이 올라 있다 — 「늘면 여기 적어라」의 집행
  const sanSrc = readSrc(REPO, SANITIZE_MOD);
  assert.match(sanSrc, /annotation-block\.js[^\n]*labelHtml/,
    '★sanitize-rich-text.js 머리말 소비자 명부에 어노테이션 라벨이 적혔다');
});

/* ── H5 저장 ───────────────────────────────────────────────────────── */
test('H5 저장 ★labelHtml 이 ANNOT_DATA_KEYS 에 있다 (리로드·⌘Z 복원에 살아남는다)', () => {
  const src = readSrc(REPO, ANNOT_MOD);
  const m = src.match(/const ANNOT_DATA_KEYS = (\[[\s\S]*?\]);/);
  assert.ok(m, '★전제: 명부 리터럴을 찾았다');
  const arr = JSON.parse(m[1].replace(/'/g, '"').replace(/,(\s*\])/, '$1').replace(/\/\/[^\n]*/g, ''));
  assert.ok(arr.includes('labelHtml'),
    '★없으면 rebindAll(리로드·⌘Z 복원)이 이 키를 안 되돌려 써 ★부분 서식이 조용히 사라진다');
  assert.equal(arr[arr.length - 1], 'labelHtml',
    '★맨 끝 — 팩토리가 쓰는 순서와 같아야 직렬화 문자열이 같다(F2 ⌘Z 유령 칸)');
  // ★팩토리도 «맨 끝»에 쓴다 — 두 순서가 갈리면 여기서 빨개진다
  const body = src.slice(src.indexOf('function makeAnnotationBlock'));
  const writes = [...body.matchAll(/block\.dataset\.([A-Za-z0-9_$]+)\s*=/g)].map((x) => x[1]);
  assert.equal(writes[writes.length - 1], 'labelHtml', '★팩토리의 마지막 dataset 쓰기 = labelHtml');
});

/* ── H6 갈림 — 세 자리가 한 규약 ───────────────────────────────────── */
test('H6 갈림 ★「서식 있을 때만 HTML · 없으면 평문」을 세 자리가 같이 쓴다', () => {
  /* ★판정 한 벌 = annotLabelHtmlToStore. ★세 소비자가 ★그것을 부른다 —
     ⛔저마다 richTextHasFormatting 을 다시 부르면 ★판정 명부가 넷이 된다. */
  const annot  = readSrc(REPO, ANNOT_MOD);
  const select = readSrc(REPO, SELECT_MOD);
  const panel  = readSrc(REPO, PANEL_MOD);
  assert.match(annot, /function annotLabelHtmlToStore/, '판정 한 벌이 정의됐다');
  assert.match(annot, /window\.annotLabelHtmlToStore = annotLabelHtmlToStore/,
    '고전 스크립트(annotation-select.js)가 부를 다리 — ★사본이 아니라 같은 함수');
  for (const [name, src] of [['팩토리', annot], ['커밋(annotation-select)', select], ['패널(prop-annotation)', panel]]) {
    assert.match(src, /annotLabelHtmlToStore/, `★${name} 이 판정 한 벌을 쓴다`);
  }
  // ★커밋은 ★평문만 견주지 않는다 — beforeHtml 도 본다(⌘B 만 누른 커밋이 ⌘Z 표본에 들어가게)
  assert.match(select, /const beforeHtml = block\.dataset\.labelHtml \|\| ''/, '편집 전 HTML 을 기억한다');
  assert.match(select, /val !== before \|\| nextHtml !== beforeHtml/,
    '★「글자 또는 서식」이 바뀌면 끝 표본 — 평문만 견주면 서식만 바뀐 커밋이 ⌘Z 에서 사라진다');
  // ★패널은 라벨 전체 dataset 을 안 건드린다(고른 글자 갈래에서)
  assert.match(panel, /function _annotApplyToSelection/, '패널의 「고른 글자만」 한 자리');
  assert.doesNotMatch(
    panel.slice(panel.indexOf('function _annotApplyToSelection'), panel.indexOf('// ── 블록 재렌더')),
    /_writeProps/,
    '★고른 글자 갈래는 _writeProps(라벨 전체)를 ★부르지 않는다');
});

/* ── H7 배선 ────────────────────────────────────────────────────────
 * ★★솔직히: 아래 셋은 ★«행동»이 아니라 ★«소스 앵커»다. ★그 셋의 행동축은 ★DOM 이고
 *   (팩토리 렌더 · 줄 수 · blur 뒤 선택 생존), ★이 하네스엔 ★DOM 이 없다.
 * ★왜 ★그래도 적나 — 1017t1h3 ★변이 돌리기에서 ★이 셋을 끊었을 때 ★검사가 ★전부 초록이었다
 *   (M10·M12·M18 ★빨강 0). ★«안 재고 있다»를 ★그냥 두면 ★조용히 풀린다.
 * ★이 셋의 ★행동은 ★tests/dom/annot-label-rich-text-1017t1h3.dom.spec.js 가 ★임자다 —
 *   ＋1017t1h3 은 ★그 축들을 ★9334 개발판(실 DOM)에서 ★손으로 재서 ★수를 보고에 남겼다(DOM 0 지시).
 * ⛔이 칸이 초록이라고 ★「행동이 맞다」로 읽지 마라. ★「배선이 아직 붙어 있다」까지다. */
test('H7 배선 ★팩토리는 받은 labelHtml 을 날로 믿지 않는다 (변이 M10 의 자리)', () => {
  const src = readSrc(REPO, ANNOT_MOD);
  assert.match(src, /const labelHtml\s*=\s*annotLabelHtmlToStore\(annotLabelHtml\(opts\.labelHtml\s*\?\?\s*''\)\)/,
    '★거르기(annotLabelHtml) → 판정(annotLabelHtmlToStore) 두 겹을 ★지나야 한다 — '
    + '★이 줄이 풀리면 ★손댄 저장본의 `<img onerror>` 가 ★라벨에 ★그대로 들어간다(1013t2C6 의 병)');
  // ★그릴 때 넣는 것도 ★그 변수여야 한다(원본 opts 가 아니라)
  assert.match(src, /if \(labelHtml\) labelEl\.innerHTML = labelHtml;/, '★렌더가 쓰는 것 = 거른 값');
  assert.doesNotMatch(src, /innerHTML\s*=\s*opts\.labelHtml/, '⛔원본 opts 를 날로 그리지 않는다');
});

test('H7 배선 ★커밋은 거르기 «전»에 블럭 경계를 편다 (변이 M12 의 자리)', () => {
  const src = readSrc(REPO, ANNOT_MOD);
  assert.match(src, /sanitizeRichTextHtml\(richTextBlocksToBreaks\(raw\), ANNOT_RICH_TEXT_OPTS\)/,
    '★안 펴면 sanitize 가 DIV 를 ★언랩만 해 `text`(\\n 둘)와 `labelHtml`(한 줄)이 ★줄 수에서 갈린다(line-host LR8)');
});

test('H7 배선 ★편집이 열려 있으면 패널이 라벨을 다시 그리지 않는다 (변이 M19 의 자리)', () => {
  const src = readSrc(REPO, PANEL_MOD);
  const fn = src.slice(src.indexOf('function _annotApplyToSelection'), src.indexOf('// ── 블록 재렌더'));
  assert.match(fn, /if \(label\.getAttribute\('contenteditable'\) !== 'true'\) \{/,
    '★색 피커 스와치는 mousedown 을 막아 ★포커스가 라벨에 남는다(line-host 실측) — '
    + '★그 채로 다시 그리면 ★방금 친 글자가 사라진다. ★이 가드가 그 갈림이다');
  // ★dataset 쓰기는 ★두 갈래 «밖»이다 — 편집 중에도 autoSave 가 들고 가야 한다
  assert.ok(fn.indexOf('block.dataset.labelHtml = next') < fn.indexOf("!== 'true'"),
    '★dataset 쓰기가 ★가드보다 ★앞이다(편집 중에도 쓴다)');
});

test('H7 배선 ★.annot-label 이 RETAIN 명부에 있다 (변이 M18 의 자리)', () => {
  const src = readSrc(REPO, 'js/props/_text-selection.js');
  const m = src.match(/export const RETAIN_ON_PANEL_BLUR_SEL = '([^']*)';/);
  assert.ok(m, '★전제: RETAIN 명부 정의를 찾았다');
  const list = m[1].split(',').map((s) => s.trim());
  assert.ok(list.includes('.annot-label'),
    '★없으면 패널로 가는 blur 가 ★저장 선택을 버려 ★크기·색이 ★「고른 글자」가 아니라 ★라벨 전체에 간다');
  // ⛔블럭 꼴로 넓히지 않았다 — 라벨 하나만 글자칸이다
  assert.ok(!list.includes('.annotation-block'),
    '⛔블럭 꼴(.annotation-block)로 넓히지 않았다 — 글자칸은 라벨 하나다');
});

/* ── 음성대조(계측기 자가검사) ─────────────────────────────────────── */
/* ★★이 음성대조가 ★내 말을 ★고쳤다(1017t1h3 실측) ─────────────────────────────
 *   ★내가 적으려던 문장: 「`--tb-dot-i` 와 같은 길로 열면 ★inherit 이 ★샌다」 — ★그건 ★맞다.
 *   ★그런데 ★표를 비워 재 보니 ★`14px` 도 ★같이 막혔다. 까닭: 옛 길의 네 패턴 어디에도
 *     ★«수+단위»가 ★없다(VAL_WORD 는 글자로 시작 · VAL_NUM·VAL_SNUM 은 단위 없는 수).
 *   ⇒ ★★그러니 이 표는 ★«좁히는 자»이기만 한 게 아니라 ★«이 기능을 ★가능하게 하는 자»다.
 *     ★「느슨한 패턴을 쓰면 샌다」로만 적었으면 ★절반만 참인 기록이 됐다. */
test('N-음성 ★좁히는 표를 무력화하면 — inherit 이 새고 ＋ 14px 가 막힌다(양방향)', () => {
  const src = readSrc(REPO, SANITIZE_MOD);
  // 표를 비운다 = font-size 가 옛 길(safeStyleValue → VAL_WORD/VAL_NUM, 또는 VAL_SNUM)로 떨어진다
  const sabotaged = src.replace(
    /export const RICH_TEXT_STRICT_STYLE_VALS = new Map\(\[\['font-size', VAL_FONT_SIZE_PX\]\]\);/,
    'export const RICH_TEXT_STRICT_STYLE_VALS = new Map([]);');
  assert.notEqual(sabotaged, src, '★전제: 무력화가 실제로 소스를 바꿨다');
  const names = ['sanitizeStyle', 'normOpts'];
  const M = new Function(sabotaged.replace(/\bexport\s+/g, '') + `\n;return { ${names.join(', ')} };`)();
  const c = M.normOpts(OPTS);
  assert.equal(M.sanitizeStyle('font-size:inherit', c), 'font-size:inherit',
    '★표가 비면 inherit 이 ★샌다(VAL_WORD) — ★그 샘을 막는 것이 이 결정의 한쪽이다');
  assert.equal(M.sanitizeStyle('font-size:14px', c), '',
    '★표가 비면 ★14px 도 ★막힌다 — 옛 네 패턴엔 ★«수+단위»가 없다 ⇒ ★표가 ★이 기능을 ★서게 하는 자다');
  // ★그 판에서 실제로 통과하는 것 = 낱말과 맨수뿐이라는 것까지 못 박는다
  assert.equal(M.sanitizeStyle('font-size:14', c), 'font-size:14',
    '★단위 없는 맨수는 새지만 ★CSS 가 무시한다 = 「되는 척」만 하는 값이다');
});

test('N-음성 ★기본 명부에서 한 prop 을 빼면 H3 의 그 칸이 빨개진다', () => {
  const src = readSrc(REPO, SANITIZE_MOD);
  const sabotaged = src.replace("'color', 'font-weight'", "'font-weight'");
  assert.notEqual(sabotaged, src, '★전제: 무력화가 실제로 소스를 바꿨다');
  const M = new Function(sabotaged.replace(/\bexport\s+/g, '')
    + '\n;return { sanitizeStyle, normOpts, RICH_TEXT_ALLOWED_STYLE_PROPS };')();
  assert.equal(M.RICH_TEXT_ALLOWED_STYLE_PROPS.size, 4, '★전제: 넷으로 줄었다');
  assert.equal(M.sanitizeStyle('color:#ff0000', M.normOpts(OPTS)), '',
    '★color 가 명부에서 빠지면 ★막힌다 ⇒ H3 의 초록은 ★실제로 그 다섯을 재고 있다');
});

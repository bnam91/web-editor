/* U-CSSFILT — ★배송본 `<style>` 에서 ★걸러내는 자(`EDITOR_ONLY_SEL`)가 ★★콘텐츠를 ★먹지 않는가. (2026-10-22)
 *   실행: `npm test`
 *
 * ★왜 — ★그 명부의 ★머리말이 ★★자기 금지선을 ★어기고 있었다
 *   `js/io/export-css-collect.js:30~31` 원문:
 *     「⛔`-btn` 같은 ★«너무 넓은» 조각은 ★쓰지 않는다: 배너 프리셋의 .cta-btn 처럼 ★진짜 콘텐츠가
 *       같은 꼬리를 쓸 수 있다. ★여기 적는 것은 ★이 레포가 ★실제로 ★편집 전용으로 쓰는 이름들이다」
 *   ★그런데 ★`'placeholder'` 한 조각이 ★★`.chb-profile-placeholder`(★채팅 프로필 ★빈자리 회색 사람 SVG ·
 *     `js/blocks/chat-block.js:109~116`) 의 CSS 를 ★먹었다 ⇒ ★★내보낸 HTML 에서 ★그 아이콘이
 *     ★가운데 정렬(`display:flex`)과 ★크기(`svg{width:100%}`)를 ★잃는다. ★★그건 ★콘텐츠다.
 *
 * ★★이 파일이 ★앱 없이 ★완전히 잠그는 까닭
 *   `EDITOR_ONLY_SEL.test(selectorText)` 는 ★★순수 술어다 — ★DOM·앱이 필요 없다.
 *   ⇒ ★제품의 ★그 정규식을 ★소스에서 ★떼어 와 ★돌린다(⛔내 테스트에 ★사본을 쓰면 ★항등식이 된다).
 *
 * ⚠️★이 파일이 ★못 재는 것
 *   ★화면에서 ★아이콘이 ★제대로 보이는 것. ★여기 있는 것은 ★「그 선택자가 ★걸러지나」까지다.
 *   ★그리고 ★★`[data-is-placeholder="true"]` ★4개(안내문 ★흐리게)는 ★★일부러 ★안 건드렸다 —
 *     ★그건 ★「안내문 ★요소가 ★내보내기에 ★실리나」라는 ★다른 축이고, ★범위가 ★샌다.
 *     ⇒ ★별건 이름으로 명부에(`PLACEHOLDER-TEXT-DIM-CSS-FILTERED-01`). ★이 파일은 ★그 넷을 ★★안 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const ROOT = process.env.GD1001_ROOT || path.join(import.meta.dirname, '..', '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** ★제품의 `EDITOR_ONLY_SEL` 을 ★그 소스에서 ★떼어 ★되살린다 — ⛔사본 금지(항등식이 된다). */
function productFilter() {
  const src = rd('js/io/export-css-collect.js');
  const m = src.match(/const EDITOR_ONLY_SEL = new RegExp\(\[([\s\S]*?)\]\.join\('\|'\),\s*'i'\)/);
  assert.ok(m, '⛔제품에서 EDITOR_ONLY_SEL 을 못 떼었다 — 꼴이 바뀌었으면 이 자를 고쳐라');
  const body = m[1].replace(/\/\*[\s\S]*?\*\//g, ' ');
  /* ★★JS 문자열 ★이스케이프를 ★풀어야 한다 — ⛔안 풀면 `'\\\\.selected\\\\b'` 가
     ★«리터럴 백슬래시 ＋ .selected» 를 찾는 정규식이 되어 ★아무것도 안 맞는다.
     ★261022 실측: 안 풀었더니 ★T2(음성대조)가 ★`.selected`·`.hlb-handle` 을 ★「실린다」로 ★읽었다.
     ⇒ ★★T2 가 ★없었으면 ★T1 만 고치고 ★이 흠을 ★영영 못 봤다. ⛔T2 를 지우지 마라. */
  const frags = [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)]
    .map(x => x[1].replace(/\\(.)/g, '$1'));
  assert.ok(frags.length >= 40, `⛔조각을 ${frags.length} 개만 떼었다 — 자가 좁아졌다(261022 실측 55)`);
  return { re: new RegExp(frags.join('|'), 'i'), frags };
}

/** ★★콘텐츠 — ★배송본에 ★실려야 한다(걸러지면 ⛔결함)
 *  ★★두 축으로 ★가른다 — ★임자가 ★다르다:
 *    ⒜ `placeholder` 축 = ★지디가 고친다(별건 · 어노테이션과 ★무관)
 *    ⒝ `annot` 축      = ★★S7 의 ⑶ 일감이다(치수선) — ★내가 고치면 ★그 일감을 ★가로챈다
 *  ⇒ ★⒝ 는 ★`todo` 로 둔다. ⛔「일부러 빨강」으로 두면 ★다음 빨강을 ★가린다. */
const MUST_SHIP_PLACEHOLDER = [
  ['.chb-profile-placeholder',     'chat-block.js:116 — 프로필 사진이 없을 때 그리는 회색 사람 SVG(콘텐츠)'],
  ['.chb-profile-placeholder svg', '그 SVG 의 크기 규칙'],
];
const MUST_SHIP_ANNOT = [
  ['.annot-label',      '어노테이션·치수선 라벨(콘텐츠 · js 50곳)'],
  ['.annot-svg',        '어노테이션 그림판(콘텐츠)'],
  ['.annotation-block', '현빈 ⒝ 로 거름 명부에서 빠졌다 = 콘텐츠'],
];

/** ★★편집 전용 — ★걸러져야 한다(실리면 ⛔결함) */
const MUST_FILTER = [
  ['.prop-input::placeholder', '우측 패널 입력칸 안내문'],
  ['.ai-textarea::placeholder', '모달 입력칸 안내문'],
  ['.icb-placeholder',          'display:none — 아이콘 칸 빈 자리'],
  ['.col-placeholder',          'display:none !important'],
  ['.annot-handle',             '어노테이션 손잡이'],
  ['.annot-selbox',             '어노테이션 선택 상자'],
  ['.hlb-handle',               '선 형광펜 손잡이'],
  ['.selected',                 '고름 표시'],
];

test('T1a ★★`placeholder` 축 — ★채팅 프로필 아이콘 CSS 가 ★실린다', () => {
  const { re } = productFilter();
  const eaten = MUST_SHIP_PLACEHOLDER.filter(([s]) => re.test(s));
  assert.deepEqual(eaten.map(x => x[0]), [],
    '⛔콘텐츠를 먹는다: ' + eaten.map(([s, why]) => `${s} (${why})`).join(' · '));
});

/* ★★T1b — ★★★2026-10-24 ★`todo` 를 ★★떼었다 (★현빈 ★GO · ★지디 ★집행).
   ★이름 = `ANNOT-CSS-FILTERED-01`
   ★옛 상태 : ★★S7 의 ⑶ 일감으로 ★`todo` 였다(★「일부러 빨강」이 ★다음 빨강을 ★가리지 ★않게).
   ★★★S7 의 ★트리·커밋이 ★사라져(★fsck ★매달린 ★169 중 ★0건) ★★그 레인이 ★없어졌고,
     ★★현빈이 ★★「데브머지 하고 ★내가 ★볼 수 ★있게 ★해줘」로 ★GO 했다 ⇒ ★★★지디가 ★닫았다.
   ★고친 것 : ★`js/io/export-css-collect.js` 의 ★조각 ★둘을 ★좁혔다 —
     ★`\.annotation` → `\.annotation(?!-block)` · ★`\.annot-` → `\.annot-(?!label(?![-\w])|svg(?![-\w]))`
   ★★★이제 ★이 단언이 ★★«재는 자»다 — ★조각이 ★다시 ★넓어지면 ★★여기서 ★빨개진다.
   ⛔`todo` 를 ★다시 ★붙이지 ★마라. ★★T2(음성대조)가 ★반대쪽을 ★지킨다. */
test('T1b ★`annot` 축 — 어노테이션·치수선 콘텐츠 CSS 가 실린다 (★261024 지디가 닫았다)', () => {
  const { re } = productFilter();
  const eaten = MUST_SHIP_ANNOT.filter(([s]) => re.test(s));
  assert.deepEqual(eaten.map(x => x[0]), [],
    '⛔콘텐츠를 먹는다: ' + eaten.map(([s, why]) => `${s} (${why})`).join(' · '));
});

test('T2 ★편집 전용은 ★여전히 ★걸러진다 (★음성대조 — ★한쪽만 재면 절반이다)', () => {
  const { re } = productFilter();
  const leaked = MUST_FILTER.filter(([s]) => !re.test(s));
  assert.deepEqual(leaked.map(x => x[0]), [],
    '⛔편집 전용이 배송본에 실린다: ' + leaked.map(([s, why]) => `${s} (${why})`).join(' · '));
});

test('T3 ★★양성대조 — ★이 파일의 자가 ★«고치기 전» 꼴을 ★잡는가', () => {
  // ★261022 실측: 고치기 전 명부에는 ★`'placeholder'` ★맨 조각이 있었다. ★그 꼴을 미끼로 쓴다.
  const bait = new RegExp(['\\.selected\\b', 'placeholder', '-handle\\b'].join('|'), 'i');
  assert.ok(bait.test('.chb-profile-placeholder'),
    '⛔자가 눈이 멀었다 — 고치기 전 꼴이 콘텐츠를 먹는 것을 못 잡는다');
  // ★음성대조 — 좁힌 꼴은 그 콘텐츠를 안 먹어야 한다
  const fixed = new RegExp(['\\.selected\\b', '::placeholder', '\\.icb-placeholder', '-handle\\b'].join('|'), 'i');
  assert.ok(!fixed.test('.chb-profile-placeholder'), '⛔좁힌 꼴도 콘텐츠를 먹는다');
  assert.ok(fixed.test('.prop-input::placeholder'), '⛔좁힌 꼴이 입력칸 안내문을 놓친다');
});

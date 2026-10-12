/* shape-star-fill-key.test.mjs — ★`data-star-fill` ★한 키 (현빈 1010t2a ⑵ · 지디 판정 2026-10-11)
 *
 * ★지디 원문의 ★조건 ★세 칸을 ★그대로 ★잰다:
 *   ⒜ ★키 ★없음        ⇒ ★`STAR_FILL_ON`(주황)
 *   ⒝ ★★모르는 값      ⇒ ★★주황
 *   ⒞ ★★블록당 ★한 키  (★챗은 ★메시지별이지만 ★«메시지별 색»은 ★요구에 ★없었다)
 * ＋ ★지디가 ★이름으로 ★건 ★단언 ★둘:
 *   ⑴ ★`#9e9e9e` ≠ ★`#d6d6d6`
 *   ⑵ ★「평점 5 · 회색」 배열 ≠ ★「평점 0」 배열
 *
 * ★★★이 파일이 ★안 재는 것 — ★«사람이 ★고를 수 있다»(★패널 입구)는 ★★아직 ★없다.
 *   ⇒ ★그건 ⑷ 의 ★세 커밋 중 ★셋째다(★chb-stars 게이트가 ★발동함을 ★증명한 ★뒤).
 *   ⇒ ★★그래서 ★이 파일의 ★범위는 ★★«상태 → 칠» ★한 축이다. ⛔넓혀 ★읽지 ★마라.
 *
 * ★★«항등식 단언»을 ★피하려고 ★각 칸에 ★★음성대조를 ★붙였다 —
 *   ★`starFillColor` 가 ★★«언제나 ★폴백»이어도 ⒜ 는 ★초록이 된다
 *   ⇒ ★그러면 ★그 칸은 ★★아무것도 ★안 잠근다(★내 교훈: 「★항상 ★참인 ★단언은 ★0을 ★잠근다」).
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');
const { mkTmpRoot } = require('./_tmproot.js');   /* ★임시 루트의 ★임자 — ⛔rmSync 를 여기 두지 마라 */

const ROOT = path.join(import.meta.dirname, '..', '..');
const M = await (async () => {
  const fs = (await import('node:fs')).default;
  const { pathToFileURL } = await import('node:url');
  const tmp = mkTmpRoot('gd-star-fill-');
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(ROOT, 'js/shape-star.js'), path.join(tmp, 'm.js'));
  return await import(pathToFileURL(path.join(tmp, 'm.js')).href);
})();
const { starFillColor, starFillsFor, starRatingFills, STAR_FILL_HEX6,
        STAR_FILL_ON, STAR_FILL_OFF, STAR_FILL_GREY, STAR_FILL_SWATCHES } = M;

/* ★★소스 자 — ★주석을 ★★뗀다. ⛔안 떼면 ★★머리말의 ★예시가 ★측정값이 ★된다(내 교훈 261007) */
const PANEL = stripComments(readSrc(ROOT, 'js', 'props', 'prop-shape.js'));
const CHATBLOCK = stripComments(readSrc(ROOT, 'js', 'blocks', 'chat-block.js'));
const CHATPANEL = stripComments(readSrc(ROOT, 'js', 'props', 'prop-chat.js'));
const SRC = stripComments(readSrc(ROOT, 'js', 'shape-star.js'));

test('F1 ★전제 — ★이 파일이 ★재려는 ★이름들이 ★★실제로 ★있나(⛔없으면 아래가 전부 undefined 비교다)', () => {
  for (const [n, v] of Object.entries({ starFillColor, starFillsFor, starRatingFills })) {
    assert.strictEqual(typeof v, 'function', `★전제 깨짐 — ★${n} 이 ★함수가 ★아니다(잰 값: ${typeof v})`);
  }
  /* ★★2026-10-11 — ★`CHOICES`(=★허용 ★전부)가 ★★`SWATCHES`(=★★권하는 ★견본)로 ★뜻이 ★바뀌었다.
     ★현빈이 ★★«임의의 색»을 ★원했으므로 ★★«허용 명부»라는 ★것이 ★★더는 ★없다. */
  assert.ok(Array.isArray(STAR_FILL_SWATCHES), '★전제 깨짐 — ★견본이 ★배열이 ★아니다');
  assert.ok(STAR_FILL_SWATCHES.length >= 2,
    `★전제 깨짐 — ★견본이 ★둘 미만(잰 값: ${STAR_FILL_SWATCHES.length})`);
  assert.ok(STAR_FILL_HEX6 instanceof RegExp, '★전제 깨짐 — ★`STAR_FILL_HEX6` 가 ★정규식이 ★아니다');
  console.log(`    ★견본 = ${STAR_FILL_SWATCHES.join(' · ')} · ★기본 두 색 = ${STAR_FILL_ON} / ${STAR_FILL_OFF}`);
});

test('F2 ⒜⒝ ★★술어를 ★갈았다 — ★★«2택인가»에서 ★★«유효한 #RRGGBB 인가»로 · ★★폴백은 ★그대로 (지디 2026-10-11)', () => {
  /* ★★★무엇이 ★바뀌고 ★무엇이 ★남았나 — ★지디 판정 ★그대로 ★적는다:
   *   ★옛 술어 = ★「★2택(주황·회색) ★중 ★하나인가」  ⇒ ★★현빈의 ★«임의 색»과 ★★거꾸로 섰다
   *   ★새 술어 = ★「★★유효한 ★`#RRGGBB` 인가」
   *   ★★그런데 ★★«모르는 값 ⇒ 기본색»의 ★★참 몫은 ★★«쓰레기 값이 와도 ★화면이 ★안 깨진다»(★폴백)
   *     ⇒ ★★그 몫은 ★★그대로 ★산다 ⇒ ★★★폴백 단언을 ★★지우지 ★않는다(★지디가 ★이름으로 ★건 조건).
   */
  /* ⒜ ★★폴백 — ★미설정·빈 값·쓰레기는 ★★제 ★기본색으로 */
  const toFallback = [undefined, null, '', '   ', 'red', 'orange', '0', '#ff8a0', '#9e9e9e9', '#12345g', 'rgb(1,2,3)'];
  for (const raw of toFallback) {
    assert.strictEqual(starFillColor(raw, STAR_FILL_ON), STAR_FILL_ON,
      `★무효 값이 ★폴백하지 ★않았다 — 넣은 값 ${JSON.stringify(raw)} · 잰 값 ${starFillColor(raw, STAR_FILL_ON)}`);
    assert.strictEqual(starFillColor(raw, STAR_FILL_OFF), STAR_FILL_OFF,
      `★빈 색 쪽 ★폴백이 ★안 선다 — 넣은 값 ${JSON.stringify(raw)}`);
  }
  /* ⒝ ★★★새 술어 — ★★임의의 ★유효색을 ★★받는다. ⛔이게 ★이번 ★요구의 ★핵이다 */
  for (const raw of ['#ff0000', '#0000ff', '#ADD8E6', '#9e9e9e', '#000000', '#ffffff']) {
    assert.strictEqual(starFillColor(raw, STAR_FILL_ON), raw.toLowerCase(),
      `★★유효한 색을 ★★버렸다 — 넣은 값 ${raw} · 잰 값 ${starFillColor(raw, STAR_FILL_ON)}\n`
      + '  ⇒ ★현빈 요구: 「★빨강/회색 , ★파랑/연파랑 … ★내가 컨트롤 가능하게」');
  }
  /* ★★★음성대조 — ⛔이게 ★없으면 ★위 ⒜ 는 ★★«언제나 ★폴백»과 ★구분이 ★안 된다(★항등식) */
  assert.notStrictEqual(starFillColor('#ff0000', STAR_FILL_ON), STAR_FILL_ON,
    '★★모든 값이 ★폴백된다 ⇒ ★이 자는 ★★«언제나 ★기본색»이다 — ★자유색이 ★죽었다');
  /* ★대소문자·여백은 ★같은 뜻 — ★정본 ★한 꼴(소문자)로 ★돌려준다 */
  assert.strictEqual(starFillColor('  #ADD8E6 ', STAR_FILL_ON), '#add8e6',
    `★여백·대문자를 ★★버렸다(잰 값: ${starFillColor('  #ADD8E6 ', STAR_FILL_ON)})`);
});

test('F3 ⑴ ★★채운 회색 ≠ ★빈 회색 — ⛔같으면 ★«몇 점인가»가 ★안 읽힌다', () => {
  assert.notStrictEqual(STAR_FILL_GREY, STAR_FILL_OFF,
    `★★두 회색이 ★같다 ⇒ ★회색을 고르면 ★평점이 ★사라진다(채움 ${STAR_FILL_GREY} · 빔 ${STAR_FILL_OFF})`);
  /* ★★그리고 ★그 다름이 ★★배열까지 ★살아 오나 — ★상수만 ★견주면 ★배선은 ★안 잰다 */
  const g = starRatingFills(3, 5, STAR_FILL_GREY);
  assert.deepStrictEqual(g, [STAR_FILL_GREY, STAR_FILL_GREY, STAR_FILL_GREY, STAR_FILL_OFF, STAR_FILL_OFF],
    `★회색 ★평점 3 의 ★배열이 ★틀렸다 (잰 값: ${JSON.stringify(g)})`);
  /* ★★★그리고 ★★«칠의 임자»를 ★거쳐서도 ★같은 값이 ★나오나 — ⛔위 줄은 ★`starRatingFills` 를
     ★곧장 부르므로 ★`starFillsFor` 가 ★fill 을 ★★버려도 ★초록이다(★변이 N5 가 ★그것을 ★보였다:
     ★그 변이를 ★잡은 칸이 ★★하나뿐이었다) ⇒ ★★임자 경로를 ★한 줄 ★더 ★잠근다. */
  const via = starFillsFor({ rating: 5, count: 5, fill: STAR_FILL_GREY });
  assert.deepStrictEqual(via, new Array(5).fill(STAR_FILL_GREY),
    `★★임자(starFillsFor)가 ★고른 색을 ★버렸다 (잰 값: ${JSON.stringify(via)})`);
});

test('F4 ⑵ ★★「평점 5 · 회색」 ≠ ★「평점 0」 — ⛔같으면 ★만점이 ★0점처럼 ★보인다', () => {
  const full = starFillsFor({ rating: 5, count: 5, fill: STAR_FILL_GREY });
  const zero = starFillsFor({ rating: 0, count: 5, fill: STAR_FILL_GREY });
  assert.ok(Array.isArray(full) && Array.isArray(zero),
    `★전제 깨짐 — ★둘 중 하나가 ★배열이 ★아니다(full ${JSON.stringify(full)} · zero ${JSON.stringify(zero)})`);
  assert.notDeepStrictEqual(full, zero,
    `★★만점과 ★0점이 ★같은 ★칠이다 (잰 값: ${JSON.stringify(full)})`);
  /* ★★주황 쪽도 ★같은 자로 — ★한 색에서만 ★참인 ★단언은 ★★«안 재고 있다»와 ★구분이 ★안 된다 */
  assert.notDeepStrictEqual(starFillsFor({ rating: 5, count: 5 }), starFillsFor({ rating: 0, count: 5 }),
    '★주황 쪽에서 ★만점과 ★0점이 ★같다');
});

test('F5 ⒜ ★★키가 ★없으면 ★옛 바이트다 — ★fill 인자 ★전·후가 ★★같은 배열이어야 한다', () => {
  const noKey = starFillsFor({ rating: 3, count: 5 });
  const undef = starFillsFor({ rating: 3, count: 5, fill: undefined });
  const empty = starFillsFor({ rating: 3, count: 5, fill: '' });
  assert.deepStrictEqual(noKey, undef, '★키 ★없음과 ★undefined 가 ★다르다');
  assert.deepStrictEqual(noKey, empty, '★키 ★없음과 ★빈 문자열이 ★다르다');
  assert.deepStrictEqual(noKey, [STAR_FILL_ON, STAR_FILL_ON, STAR_FILL_ON, STAR_FILL_OFF, STAR_FILL_OFF],
    `★★미설정 ★기본이 ★주황이 ★아니다 (잰 값: ${JSON.stringify(noKey)})`);
  /* ★★평점도 ★없으면 ★★null — ★«칠하지 ★말라»다. ⛔색 고르기가 ★이걸 ★깨우지 ★않는다 */
  assert.strictEqual(starFillsFor({ count: 5, fill: STAR_FILL_GREY }), null,
    '★★평점이 ★없는데 ★색만으로 ★칠이 ★생겼다 ⇒ ★옛 저장본의 ★별이 ★회색이 된다');
});

test('F6 ★개별 색이 ★이기는 ★규율은 ★그대로다 — ⛔⒠ 가 ★그 순서를 ★바꾸지 ★않았다', () => {
  const f = starFillsFor({ rating: 5, count: 3, colors: '#ff0000,,#00ff00', fill: STAR_FILL_GREY });
  assert.deepStrictEqual(f, ['#ff0000', STAR_FILL_GREY, '#00ff00'],
    `★★명시(개별 색) ＞ ★파생(평점 칠) 이 ★깨졌다 (잰 값: ${JSON.stringify(f)})`);
});

test('F7 ⒞ ★★«두 키» ＋ ★읽는 파일은 ★★하나다 ＋ ⛔46번째 ★hex 명부를 ★안 만들었다', () => {
  /* ★★2026-10-11 — ★키가 ★★하나(`starFill`)에서 ★★둘(`starFillOn`·`starFillOff`)로 ★늘었다.
     ★현빈이 ★★«채운 색»과 ★★«빈 색»을 ★따로 ★원했다 ⇒ ★★한 키로는 ★담을 수 ★없다. */
  const KEYS = ['starFillOn', 'starFillOff'];
  const files = [['prop-shape.js', PANEL], ['chat-block.js', CHATBLOCK], ['prop-chat.js', CHATPANEL]];
  for (const k of KEYS) {
    const per = files.map(([n, src]) => [n, (src.match(new RegExp('dataset\\.' + k + '\\b', 'g')) || []).length]);
    const readers = per.filter(([, c]) => c > 0).map(([n]) => n);
    console.log(`    ★dataset.${k} — ` + per.map(([n, c]) => `${n} ${c}`).join(' · '));
    assert.deepEqual(readers, ['prop-shape.js'],
      `★★${k} 를 ★읽는 ★파일이 ★«칠의 임자» ★하나가 ★아니다 (잰 값: ${readers.join(',') || '없음'})`);
  }
  /* ⒝ ★★`_mineFills` 가 ★★«지금 ★쓰는 ★두 색»을 ★품나 — ★★자유색이라 ★정적 명부로는 ★못 덮는다.
     ★★⒠ 때 ★실측한 ★물림: ★이 집합에 ★없으면 ★평점을 ★꺼도 ★그 칠이 ★안 떨어진다. */
  assert.match(PANEL, /_mineFills\s*=\s*new Set\(\[[\s\S]{0,400}?starFillColor\(block\.dataset\.starFillOn/,
    '★★`_mineFills` 가 ★★«해석한 ★채운 색»을 ★안 품는다 ⇒ ★평점을 ★꺼도 ★칠이 ★안 떨어진다');
  assert.match(PANEL, /_mineFills\s*=\s*new Set\(\[[\s\S]{0,400}?starFillColor\(block\.dataset\.starFillOff/,
    '★★`_mineFills` 가 ★★«해석한 ★빈 색»을 ★안 품는다');
  /* ⒞ ★★칠의 임자에게 ★★둘 다 ★넘기나 */
  assert.match(PANEL, /fill:\s*block\.dataset\.starFillOn,\s*fillOff:\s*block\.dataset\.starFillOff/,
    '★★`starFillsFor` 에 ★두 키를 ★같이 ★안 넘긴다');
  /* ⒟ ★★★«명부를 ★늘리지 ★않았나» — ★이 레포엔 ★6자리 hex 를 ★재는 자가 ★★45곳쯤 ★흩어져 있다(★실측).
     ★그래서 ★★«하나로 합쳐라»는 ★★이번 범위가 ★아니다. ★★다만 ⛔★★내가 ★하나를 ★★더하지는 ★않았다.
     ★`prop-shape.js` 의 ★1개는 ★★`_lastSolidOf`(★2026-10-11 ★이전부터 ★있던 것)다 — ★dev 에서도 ★1개다.
     ⇒ ★★별 축의 ★술어는 ★★`shape-star.js` 의 ★`STAR_FILL_HEX6` ★하나이고 ★소비자는 ★끌어다 ★쓴다. */
  const hex6 = (PANEL.match(/0-9a-fA-F\]\{6\}|0-9a-f\]\{6\}/g) || []).length;
  assert.strictEqual(hex6, 1,
    `★★`.concat(`prop-shape.js 안 ★hex6 정규식이 ★${hex6}개다 — ★dev 와 ★같은 ★1개여야 한다\n`)
    + '  ⇒ ★★별 색 술어를 ★거기 ★다시 적었다면 ★★46번째 ★명부다. ★`starFillColor` 를 ★끌어다 써라');
  assert.ok(PANEL.includes('starFillColor'),
    '★★`starFillColor` 를 ★안 쓴다 — ★★제 손으로 ★접고 있다면 ★명부가 ★둘이다');
});

test('F8 ★★챗은 ★★안 건드린다 — ★지디 판정(2026-10-11): ★★쉐이프만 ★간다', () => {
  /* ★★이 칸은 ★«③ 를 ★했나»를 ★안 잰다 — ★★«별점 ★두 색이 ★챗까지 ★샜나»만 잰다.
     ★★지디 판정(2026-10-11): ★★쉐이프만 ★간다 · ★챗은 ★기존 값 ★유지 ⇒ ★★이 칸이 ★그 결정을 ★잠근다.
     ★실측(DOM 1벌 · 같은 날): ★챗 별 ★5칸 = ★#ff8a00 ×4 ＋ ★#d6d6d6 ×1 ⇒ ★★무회귀 ✅
     ⚠️★옛 까닭 줄은 ★아래에 ★남긴다 — ★그때의 ★사실이었다:
       ⇒ ★먼저 ★그 게이트를 ★세우고 ★★발동을 ★증명한 ★뒤에 ★바꾼다(지디 ⑷ ⑴→⑵ 순서). */
  for (const [n, s] of [['chat-block.js', CHATBLOCK], ['prop-chat.js', CHATPANEL]]) {
    assert.ok(!/starFillOn\b|starFillOff\b/.test(s),
      `★★별점 ★두 색 키가 ★${n} 까지 ★샜다 — ★★지디 판정(2026-10-11): ★쉐이프만 ★간다`);
  }
  /* ★★그리고 ★이 커밋이 ★별 도형 쪽 ★상수를 ★★안 늘렸나 — ★`#ff8a00` 은 ★정의 ★한 자리뿐 */
  const lits = (SRC.match(/#ff8a00/g) || []).length;
  assert.strictEqual(lits, 1,
    `★★shape-star.js 안의 ★#ff8a00 가 ★한 자리가 ★아니다 ⇒ ★여섯째 자리가 ★생겼다 (잰 값: ${lits})`);
});

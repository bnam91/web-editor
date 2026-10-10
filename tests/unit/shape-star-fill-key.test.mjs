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
 *   ★`starFillChoice` 가 ★★«언제나 ★주황»이어도 ⒝ 는 ★초록이 된다
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
const { starFillChoice, starFillsFor, starRatingFills,
        STAR_FILL_ON, STAR_FILL_OFF, STAR_FILL_GREY, STAR_FILL_CHOICES } = M;

/* ★★소스 자 — ★주석을 ★★뗀다. ⛔안 떼면 ★★머리말의 ★예시가 ★측정값이 ★된다(내 교훈 261007) */
const PANEL = stripComments(readSrc(ROOT, 'js', 'props', 'prop-shape.js'));
const CHATBLOCK = stripComments(readSrc(ROOT, 'js', 'blocks', 'chat-block.js'));
const CHATPANEL = stripComments(readSrc(ROOT, 'js', 'props', 'prop-chat.js'));
const SRC = stripComments(readSrc(ROOT, 'js', 'shape-star.js'));

test('F1 ★전제 — ★이 파일이 ★재려는 ★이름들이 ★★실제로 ★있나(⛔없으면 아래가 전부 undefined 비교다)', () => {
  for (const [n, v] of Object.entries({ starFillChoice, starFillsFor, starRatingFills })) {
    assert.strictEqual(typeof v, 'function', `★전제 깨짐 — ★${n} 이 ★함수가 ★아니다(잰 값: ${typeof v})`);
  }
  assert.ok(Array.isArray(STAR_FILL_CHOICES), '★전제 깨짐 — ★명부가 ★배열이 ★아니다');
  assert.ok(STAR_FILL_CHOICES.length >= 2,
    `★전제 깨짐 — ★고를 것이 ★둘 미만이면 ★«고르기»가 ★아니다(잰 값: ${STAR_FILL_CHOICES.length})`);
  for (const c of [STAR_FILL_ON, STAR_FILL_GREY]) {
    assert.ok(STAR_FILL_CHOICES.includes(c), `★명부에 ★${c} 가 ★없다`);
  }
  console.log(`    ★명부 = ${STAR_FILL_CHOICES.join(' · ')} · ★빈 별 = ${STAR_FILL_OFF}`);
});

test('F2 ⒜⒝ ★★미설정·★모르는 값은 ★★주황이다 ＋ ★★음성대조(★아는 값은 ★안 바뀐다)', () => {
  /* ⒜ ＋ ⒝ — ★지디가 ★이름으로 ★준 ★두 칸 */
  const toOrange = [undefined, null, '', '   ', 'red', '#123456', '#ff8a0', 'orange', '0', '#9e9e9e9'];
  for (const raw of toOrange) {
    assert.strictEqual(starFillChoice(raw), STAR_FILL_ON,
      `★모르는 값이 ★주황이 ★아니다 — 넣은 값 ${JSON.stringify(raw)} · 잰 값 ${starFillChoice(raw)}`);
  }
  /* ★★★음성대조 — ⛔이 칸이 ★없으면 ★위 전부는 ★★«언제나 ★주황»과 ★구분이 ★안 된다 */
  assert.strictEqual(starFillChoice(STAR_FILL_GREY), STAR_FILL_GREY,
    `★★아는 값이 ★주황으로 ★덮였다 ⇒ ★이 자는 ★★«언제나 주황»이다(잰 값: ${starFillChoice(STAR_FILL_GREY)})`);
  /* ★대소문자·여백은 ★같은 뜻으로 ★받는다 — ★★그러나 ★정본 ★한 꼴로 ★돌려준다 */
  assert.strictEqual(starFillChoice('  #9E9E9E '), STAR_FILL_GREY,
    `★대소문자·여백이 ★다른 ★같은 색을 ★★모르는 값으로 ★버렸다(잰 값: ${starFillChoice('  #9E9E9E ')})`);
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

test('F7 ⒞ ★★«블록당 ★한 키» ＋ ★읽는 자는 ★★하나다 ＋ ★명부는 ★★파생된다', () => {
  /* ⑴ ★dataset 을 ★읽는 자리 ★전수 — ★★주석 뗀 ★뒤에 ★센다 */
  const readers = [['prop-shape.js', PANEL], ['chat-block.js', CHATBLOCK], ['prop-chat.js', CHATPANEL]]
    .map(([n, s]) => [n, (s.match(/dataset\.starFill\b/g) || []).length]);
  const total = readers.reduce((a, [, k]) => a + k, 0);
  console.log('    ★dataset.starFill 를 ★읽는 자리: '
    + readers.map(([n, k]) => `${n} ${k}`).join(' · ') + ` (★합 ${total})`);
  assert.strictEqual(total, 1, `★★읽는 자가 ★하나가 ★아니다 — ★합 ${total}`);
  assert.strictEqual(readers.find(([n]) => n === 'prop-shape.js')[1], 1,
    '★★그 하나가 ★`prop-shape.js` 가 ★아니다(칠의 임자 자리)');
  /* ⑵ ★★명부를 ★손으로 ★다시 적지 ★않았나 — ★`_mineFills` 는 ★★파생이어야 ★한다 */
  assert.match(PANEL, /_mineFills\s*=\s*new Set\(\[\s*\.\.\.STAR_FILL_CHOICES\s*,\s*STAR_FILL_OFF\s*\]\)/,
    '★★`_mineFills` 가 ★명부에서 ★파생되지 ★않는다 ⇒ ★회색 칠이 ★안 떨어진다(행위로 재는 자리)');
  assert.doesNotMatch(PANEL, /new Set\(\[\s*STAR_FILL_ON\s*,\s*STAR_FILL_OFF\s*\]\)/,
    '★★옛 꼴(손으로 적은 ★두 색)이 ★★아직 ★있다 ⇒ ★★명부가 ★둘이다');
  /* ⑶ ★★패널이 ★그 키를 ★칠의 임자에게 ★넘기나 — ⛔제가 ★섞으면 ★순서가 ★칠을 정한다 */
  assert.match(PANEL, /fill:\s*block\.dataset\.starFill/,
    '★★`starFillsFor` 에 ★그 키를 ★안 넘긴다');
});

test('F8 ★★챗은 ★★아직 ★안 건드렸다 — ③ 는 ⑷ 의 ★게이트가 ★발동한 ★뒤다', () => {
  /* ★★이 칸은 ★«③ 를 ★했나»를 ★안 잰다(★그건 ★C8 의 ★자리다) — ★★«⒠ 가 ★거기까지 ★샜나»만 잰다.
     ★까닭: ★`chb-stars` 의 ★색은 ★행위로 ★재는 ★검사가 ★★0건이다
       ⇒ ★먼저 ★그 게이트를 ★세우고 ★★발동을 ★증명한 ★뒤에 ★바꾼다(지디 ⑷ ⑴→⑵ 순서). */
  for (const [n, s] of [['chat-block.js', CHATBLOCK], ['prop-chat.js', CHATPANEL]]) {
    assert.ok(!/starFill\b/.test(s),
      `★★⒠ 의 키가 ★${n} 까지 ★샜다 — ★챗은 ⑷ 의 ★게이트 ★뒤다`);
  }
  /* ★★그리고 ★이 커밋이 ★별 도형 쪽 ★상수를 ★★안 늘렸나 — ★`#ff8a00` 은 ★정의 ★한 자리뿐 */
  const lits = (SRC.match(/#ff8a00/g) || []).length;
  assert.strictEqual(lits, 1,
    `★★shape-star.js 안의 ★#ff8a00 가 ★한 자리가 ★아니다 ⇒ ★여섯째 자리가 ★생겼다 (잰 값: ${lits})`);
});

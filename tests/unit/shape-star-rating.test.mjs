/* shape-star-rating.test.mjs — ★별 «평점»(별점) · 1010t1b3 (현빈 2026-10-10 · 지디 판정 ④⑤)
 *
 * ★현빈 원문: 「★별점기능이 들어가야함 ★챗블럭에 ★이미 있는 기능인데 ★참고
 *               (★별점기능을 하면 ★별이 ★5개로 구성)」
 *   ＋ 섹션 data-memo: 「우측패널에서 ★평점입력가능했으면 좋겠거든」(★현빈 ★원문의 자리 · t1bstar 실측)
 *
 * ★★이 파일이 ★무엇을 ★잠그나 — ★세 가지다:
 *   ㉠ ★순수층(clampStarRating · starRatingFills · starRatingPreview) — ★불러서 잰다
 *   ㉡ ★★«명부 둘 대조» — ★두 색이 ★★챗블럭과 ★같다. ⛔값을 ★손으로 베끼지 않고 ★챗 소스에서 ★뽑아 ★견준다
 *      (★선례 = shape-star.test.mjs 의 「SHAPE_DEFS.star 의 옛 문자열 == starPoints(5) — 명부가 둘이라 대조로 잠근다」)
 *   ㉢ ★패널 배선 — ★켜면 ★갯수가 ★잠기고 ★까닭이 ★화면에 ★적히나(소스 문자열)
 *
 * ★★판정 ④⑤(지디 2026-10-10)를 ★검사로 ★박는다:
 *   ④ ★빈 별은 ★#d6d6d6 ★고정 · ⛔반투명 아님 · ★★반쪽 별 ★안 받는다(0~5 ★정수)
 *   ⑤ ★켜면 ★갯수 ★5 로 ★잠근다 · ★끄면 ★풀린다 · ★«잠겼다»를 ★겉모습으로 ★말한다
 *
 * ⚠️★이 파일은 ★★«창(DOM)»을 ★안 쓴다 — ★순수함수 ＋ ★소스 문자열까지다.
 *   ★★그래서 ★«사람이 토글을 ★눌렀을 때 ★참으로 ★그리 되나»는 ★★여기서 ★안 잰다(DOM 몫).
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
/* ★순수 함수는 ★불러서 재라 — ⛔소스 문자열만 보면 자가 죽는다(inner-gap 파일의 그 실측). */
const M = await (async () => {
  const fs = (await import('node:fs')).default;
  const os = (await import('node:os')).default;
  const { pathToFileURL } = await import('node:url');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-star-rating-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(ROOT, 'js/shape-star.js'), path.join(tmp, 'm.js'));
  const m = await import(pathToFileURL(path.join(tmp, 'm.js')).href);
  fs.rmSync(tmp, { recursive: true, force: true });
  return m;
})();
const { clampStarRating, starRatingFills, starRatingPreview,
        STAR_RATING_MIN, STAR_RATING_MAX, STAR_RATING_COUNT,
        STAR_FILL_ON, STAR_FILL_OFF } = M;

const PANEL = stripComments(readSrc(ROOT, 'js', 'props', 'prop-shape.js'));
const CHAT  = stripComments(readSrc(ROOT, 'js', 'blocks', 'chat-block.js'));

test('R0 ★전제 — ★«별 5개로 구성»의 ★그 5 가 ★참으로 5 다 (⛔재기 전에 단언)', () => {
  assert.strictEqual(STAR_RATING_COUNT, 5,
    `★분모가 5 가 아니다(잰 값: ${STAR_RATING_COUNT}) — ★이 파일의 이름이 거짓이 된다`);
  assert.strictEqual(STAR_RATING_MIN, 0, `★하한 (잰 값: ${STAR_RATING_MIN})`);
  assert.strictEqual(STAR_RATING_MAX, 5, `★상한 (잰 값: ${STAR_RATING_MAX})`);
});

test('R1 ★미설정 = ★null = ★«평점 아님» — ⛔숫자로 바꾸지 않는다', () => {
  for (const v of [undefined, null, '']) {
    assert.strictEqual(clampStarRating(v), null, `★${JSON.stringify(v)} 가 null 이 아니다`);
  }
  assert.strictEqual(clampStarRating('abc'), null, '★비수가 null 이 아니다');
  /* ★★그리고 ★그 null 이 ★«칠하지 않는다»를 ★실제로 낸다 — ★행위로 */
  assert.strictEqual(starRatingFills(undefined, 5), null, '★미설정인데 fill 배열이 나왔다');
  assert.strictEqual(starRatingFills(null, 5), null, '★null 인데 fill 배열이 나왔다');
});

test('R2 ★0~5 로 조인다 · ★반쪽 별은 ★안 받는다(판정 ④)', () => {
  assert.strictEqual(clampStarRating(-3), STAR_RATING_MIN, '★하한 클램프가 안 산다');
  assert.strictEqual(clampStarRating(999), STAR_RATING_MAX, '★상한 클램프가 안 산다');
  assert.strictEqual(clampStarRating(0), 0, '★0 은 ★유효한 평점이다(미설정과 다르다)');
  /* ★★반쪽 별 = ★정수로 ★접힌다. ⇒ ★3.5 가 ★3.5 로 ★살아남으면 ★판정 ④ 가 깨진 것이다. */
  assert.strictEqual(clampStarRating(3.5), 4, `★3.5 가 정수로 안 접혔다 (잰 값: ${clampStarRating(3.5)})`);
  assert.strictEqual(clampStarRating(2.4), 2, `★2.4 가 정수로 안 접혔다 (잰 값: ${clampStarRating(2.4)})`);
  for (const r of [0, 1, 2, 3, 4, 5]) {
    const f = starRatingFills(r, 5);
    assert.ok(f.every(x => x === STAR_FILL_ON || x === STAR_FILL_OFF),
      `★평점 ${r} 에서 ★두 색 밖의 값이 나왔다: ${JSON.stringify(f)}`);
  }
});

test('R3 ★채운 수가 ★평점과 ★같다 · ★나머지는 ★빈 색 · ★길이는 ★갯수다', () => {
  for (const r of [0, 1, 3, 5]) {
    const f = starRatingFills(r, 5);
    assert.strictEqual(f.length, 5, `★길이가 갯수와 다르다 (잰 값: ${f.length})`);
    const on = f.filter(x => x === STAR_FILL_ON).length;
    assert.strictEqual(on, r, `★평점 ${r} 인데 ★채운 별이 ${on} 개다`);
    assert.strictEqual(f.filter(x => x === STAR_FILL_OFF).length, 5 - r, `★빈 별 수가 안 맞다(평점 ${r})`);
    /* ★★«앞에서부터» 채운다 — ⛔수만 세면 ★순서가 뒤집혀도 초록이다 */
    assert.deepStrictEqual(f, f.slice(0, r).concat(f.slice(r)),
      '★배열이 제 조각과 안 같다(자가 모순)');
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(f[i], i < r ? STAR_FILL_ON : STAR_FILL_OFF,
        `★평점 ${r} 의 ★${i} 번째 별이 틀렸다 (잰 값: ${f[i]})`);
    }
  }
  /* ★갯수가 5 가 아니어도 ★길이는 ★갯수를 따른다(평점 분모 5 와 ★다른 축이다) */
  assert.strictEqual(starRatingFills(3, 2).length, 2, '★갯수 2 인데 길이가 2 가 아니다');
});

test('R4 ★★명부 둘 대조 — ★두 색이 ★챗블럭과 ★같다 (⛔값을 손으로 베끼지 않는다)', () => {
  /* ★챗의 ★그 줄에서 ★두 색을 ★뽑는다 — `k < sc ? '#ff8a00' : '#d6d6d6'` 꼴.
     ★★닻을 지어내지 않았다: ★chat-block.js 가 ★채운/빈 을 ★한 삼항에 ★나란히 적는다. */
  const m = CHAT.match(/\?\s*'(#[0-9a-fA-F]{3,8})'\s*:\s*'(#[0-9a-fA-F]{3,8})'/);
  assert.ok(m, '★챗블럭에서 ★별점 두 색을 ★못 뽑았다 — ★대조할 ★정본이 사라졌다');
  assert.strictEqual(STAR_FILL_ON, m[1],
    `★채운 별 색이 ★챗과 다르다 — 별 ${STAR_FILL_ON} vs 챗 ${m[1]}`);
  assert.strictEqual(STAR_FILL_OFF, m[2],
    `★빈 별 색이 ★챗과 다르다 — 별 ${STAR_FILL_OFF} vs 챗 ${m[2]}`);
  /* ★판정 ④ — ⛔반투명을 ★안 쓴다. ★두 값이 ★불투명 hex 여야 한다(rgba·opacity 아님) */
  for (const c of [STAR_FILL_ON, STAR_FILL_OFF]) {
    assert.match(c, /^#[0-9a-fA-F]{6}$/, `★${c} 가 ★불투명 6자리 hex 가 아니다(판정 ④: 반투명 금지)`);
  }
});

test('R5 ★미리보기 꼴이 ★챗과 ★같다 (채운 ★ ＋ 빈 ☆ · 합이 5)', () => {
  assert.strictEqual(starRatingPreview(3), '★★★☆☆', `잰 값: ${starRatingPreview(3)}`);
  assert.strictEqual(starRatingPreview(0), '☆☆☆☆☆', `잰 값: ${starRatingPreview(0)}`);
  assert.strictEqual(starRatingPreview(5), '★★★★★', `잰 값: ${starRatingPreview(5)}`);
  for (const r of [0, 1, 2, 3, 4, 5]) {
    assert.strictEqual([...starRatingPreview(r)].length, STAR_RATING_MAX,
      `★평점 ${r} 의 미리보기 글자 수가 ${STAR_RATING_MAX} 가 아니다`);
  }
  /* ★미설정이면 ★«꽉 찬» 모습 — 챗이 그렇다(hasStars 아니면 value 5 ＋ opacity 0.3) */
  assert.strictEqual(starRatingPreview(null), '★★★★★', '★미설정 미리보기가 챗과 다르다');
});

test('R6 ★패널 — ★평점 칸 ★세 쪼가리가 ★있다(토글·숫자·미리보기)', () => {
  /* ★★`includes(id)` 로 ★쟀다가 ★★고쳤다 — ★변이 M9(미리보기 id 를 갈기)에서 ★★초록이었다.
     ★까닭: ★같은 글자가 ★배선의 ★`getElementById('…')` 에도 ★살아 있어 ★파일 ★어딘가에 ★있기만 하면 ★통과였다.
     ⇒ ★★«낱말이 파일에 있나»가 ★아니라 ★★«그 요소가 ★패널 HTML 로 ★그려지나»를 ★재야 한다.
        ⇒ ★`id="…"` ★속성 꼴로 ★닻을 ★좁혔다. (★「낱말 grep 으로 닫지 마라」) */
  for (const id of ['shape-star-rating-toggle', 'shape-star-rating-num', 'shape-star-rating-preview']) {
    assert.ok(PANEL.includes(`id="${id}"`), `★패널 HTML 에 ★id="${id}" 가 없다`);
  }
  /* ★0~5 를 ★입력칸이 ★스스로 ★막는다 — ⛔「코드가 조인다」만 믿지 않는다 */
  assert.match(PANEL, /id="shape-star-rating-num"[^>]*min="\$\{STAR_RATING_MIN\}"/,
    '★숫자칸의 min 이 ★상수에서 안 온다');
  assert.match(PANEL, /id="shape-star-rating-num"[^>]*max="\$\{STAR_RATING_MAX\}"/,
    '★숫자칸의 max 가 ★상수에서 안 온다');
});

test('R7 ★판정 ⑤ — ★켜면 ★갯수 두 칸이 ★잠기고 ★까닭이 ★화면에 ★적힌다', () => {
  /* ★갯수 ★슬라이더와 ★숫자칸 ★둘 다 — ⛔한쪽만 잠그면 ★다른 쪽으로 ★샌다 */
  const cnt = PANEL.match(/id="shape-star-count-slider"[^>]*>/);
  assert.ok(cnt, '★갯수 슬라이더 줄을 못 찾았다');
  assert.match(cnt[0], /ratingOn \? ' disabled' : ''/,
    '★갯수 ★슬라이더가 ★평점에서 ★안 잠긴다');
  const cntN = PANEL.match(/id="shape-star-count-num"[^>]*>/);
  assert.ok(cntN, '★갯수 숫자칸 줄을 못 찾았다');
  assert.match(cntN[0], /ratingOn \? ' disabled' : ''/,
    '★갯수 ★숫자칸이 ★평점에서 ★안 잠긴다 — ★슬라이더만 막으면 ★여기로 ★샌다');
  /* ★★«잠겼다»를 ★겉모습으로 ★말한다(t2cmdl ㉣) — ★까닭 줄이 ★조건부로 ★뜬다 */
  assert.ok(PANEL.includes('shape-star-rating-hint'), '★잠금 ★까닭 줄이 ★없다');
  assert.match(PANEL, /ratingOn \? `<div class="prop-hint" id="shape-star-rating-hint"/,
    '★까닭 줄이 ★평점 켜짐에 ★안 매여 있다');
  /* ★끄면 ★풀린다 = ★잠금이 ★dataset 에서 ★파생된다(★손으로 ★박은 상태가 ★아니다) */
  assert.match(PANEL, /const ratingOn\s*=\s*starRating !== null;/,
    '★잠금이 ★평점값에서 ★파생되지 않는다 — ★끄면 ★풀린다를 ★보장 못 한다');
});

test('R8 ★배선 — ★켤 때 ★갯수를 ★5 로 맞추고 ★그 임자는 ★applyStarCount ★하나다', () => {
  /* ⛔평점 쪽에 ★폭 계산을 ★다시 쓰면 ★명부가 둘이다 — ★그 함수를 ★부르는지 본다 */
  assert.match(PANEL, /applyStarCount\?\.\(STAR_RATING_COUNT\)/,
    '★평점을 켤 때 ★applyStarCount 를 ★안 부른다 — ★폭 규칙의 ★명부가 ★둘이 될 자리다');
  /* ★★폭 계산식이 ★평점 배선 안에 ★복제되지 ★않았나.
     ★★이 단언은 ★★b1(1010t1b1)에서 ★한 번 ★빨개졌고 ★★그게 ★맞는 빨강이었다 — ★★닻을 갈았다:
       ★옛 닻 = `curW *`(패널에 ★1 군데). ★b1 이 ★그 식을 ★`starFrameWidthFor`(shape-star.js)로 ★옮겼다
       ⇒ ★패널의 ★`curW *` 가 ★0 이 됐다 ⇒ ★★「0 군데」로 ★정직하게 ★빨개졌다.
     ⇒ ★지금 ★참값: ★식은 ★★순수 모듈에 ★하나, ★패널은 ★★클램프만 가진 ★자 `_starWantW` ★하나. */
  const dup = (PANEL.match(/curW \* [a-zA-Z]/g) || []).length;
  assert.strictEqual(dup, 0,
    `★패널에 ★폭 계산식이 ★${dup} 군데 ★남았다 — ★식은 ★순수 모듈(starFrameWidthFor)에 ★있어야 한다`);
  /* ★끄면 ★키를 지운다 — ★옛 저장본 ★바이트 보존(starGap 0 과 같은 규율) */
  assert.match(PANEL, /delete block\.dataset\.starRating;/,
    '★평점을 끌 때 ★키를 ★지우지 않는다 — ★옛 바이트가 ★안 지켜진다');
});

test('R9 ★★그라데이션 별을 ★죽이지 않는다 — ★뗄 때 ★«내가 칠한 두 색일 때만»', () => {
  /* ★이 파일 ★머리말의 그 함정이다: `_applyStarGeom` 이 ★polygon 의 fill 을 ★무조건 떼면
     ★그라데이션(`url(#…)`)이 ★polygon 속성에 사는 별의 ★칠이 ★사라진다. */
  /* ⛔★여기 ★`!regex` ★단언을 ★뒀다가 ★★지웠다 — ★`A || B` 꼴이라 ★B 가 참인 동안 ★★항상 참이었다.
     ⇒ ★★아무것도 ★안 잠그는 단언이 ★«덮었다»로 ★읽힌다. ★아래 ★한 줄이 ★참으로 ★재는 자다. */
  /* ★★이 닻은 ★1010t1b2(개별 색)에서 ★한 번 ★빨개졌고 ★★맞는 빨강이었다 — ★가드가 ★★세졌다:
     ★옛 꼴 = `cur === STAR_FILL_ON || cur === STAR_FILL_OFF` (평점 두 색만)
     ★새 꼴 = ★`isMine(cur, i)` — ★평점 두 색 ★＋ ★사람이 ★그 별에 ★직접 준 색까지 ★«내 것»으로 센다
     ⇒ ★★닻을 ★그 술어로 갈았다. ⛔제품이 ★약해진 것이 ★아니다 — ★덮는 범위가 ★늘었다. */
  const own = PANEL.match(/const isMine = [\s\S]*?;/);
  assert.ok(own, '★«내 것인가»를 가리는 술어가 ★없다 — ★무조건 떼면 ★그라데이션이 죽는다');
  assert.match(own[0], /STAR_FILL_ON/, '★술어가 ★평점 ★채운 색을 ★안 센다');
  assert.match(own[0], /STAR_FILL_OFF/, '★술어가 ★평점 ★빈 색을 ★안 센다');
  /* ★★그리고 ★떼는 자리가 ★★그 술어에 ★매여 있나 — ⛔술어만 있고 ★안 쓰면 ★장식이다 */
  const removes = (PANEL.match(/poly\.removeAttribute\('fill'\)/g) || []).length;
  assert.strictEqual(removes, 1, `★fill 을 떼는 자리가 ★${removes} 군데다 — ★하나여야 한다`);
  assert.match(PANEL, /isMine\(cur, i\)\) \{\s*\n\s*poly\.removeAttribute\('fill'\);/,
    '★떼는 자리가 ★★«내 것인가» 술어에 ★안 매여 있다 — ★그라데이션 별이 ★조용히 하얘진다');
});

test('R10 ★★«평점이 그라데이션을 덮는다»가 ★★가역이다 — ★끄면 ★참조가 ★되돌아온다 (지디 요청 실측)', () => {
  /* ★★지디가 ★막은 칸이다: 「★평점이 이긴다는 ★네 기본값이다 ⇒ ★★«끄면 돌아오나»를 ★재서 올려라.
   *   ★돌아오면 ★비가역이 아니니 ★가도 된다. ★안 돌아오면 ★데이터 손실 ⇒ ★현빈 결정」
   * ★★★쟀다 — ★★별은 ★`refreshShapeInnerSVG`(block-factory.js)가 ★★안 지나간다:
   *   ★그 함수 머리 = `if (!def || !def.dynamic) return;` · ★★`SHAPE_DEFS.star` 에 ★`dynamic` ★없음
   *   ★실측: ★dynamic 을 가진 타입은 ★rectangle·ellipse ★둘뿐이다(★star·line·arrow·polygon 은 ★없다)
   *   ⇒ ★rect/ellipse 는 ★⌘Z·페이지전환에서 ★다시 칠해지는데 ★★별은 ★★아무도 ★안 칠해 준다
   *   ⇒ ★★그래서 ★★«스스로는 ★안 돌아왔다» (★`dataset.shapeGradient` 는 ★살아 있으니 ★데이터 손실은 ★아니다)
   * ⇒ ★★★그래서 ★★고쳤다 — ★평점을 ★끌 때 ★`_restoreShapeGradientFill` 이 ★참조를 ★되돌린다.
   *   ⇒ ★★이 칸은 ★그 ★가역성을 ★잠근다. ★★이게 빨개지면 ★★그 결정이 ★다시 ★현빈 건이 된다. */
  /* ⒜ ★끄는 길에 ★되돌리는 자가 ★있다 */
  const offBranch = PANEL.match(/delete block\.dataset\.starRating;[\s\S]{0,600}?\n      \}/);
  assert.ok(offBranch, '★평점 끄는 갈래를 ★못 떴다 — ★닻이 썩었다');
  assert.match(offBranch[0], /_restoreShapeGradientFill\(block\)/,
    '★★평점을 끌 때 ★그라데이션을 ★되돌리지 않는다 — ★★사용자가 ★칠한 것이 ★사라진다');
  /* ⒝ ★그 함수가 ★★id·선택자를 ★다시 쓰지 ★않는다(명부 하나) */
  const fn = PANEL.match(/function _restoreShapeGradientFill\(block\) \{[\s\S]*?\n\}/);
  assert.ok(fn, '★_restoreShapeGradientFill 몸통을 ★못 떴다');
  assert.match(fn[0], /_gradIdFor\(block\)/, '★id 를 ★제 손으로 짓는다 — ★`_gradIdFor` 를 써야 한다');
  assert.match(fn[0], /FILLABLE_SEL/, '★선택자를 ★제 손으로 적는다 — ★`FILLABLE_SEL` 을 써야 한다');
  assert.ok(!/grad-\$\{/.test(fn[0]), '★id 문자열을 ★다시 지었다(명부 둘)');
  /* ⒞ ★★def 가 ★없으면 ★칠하지 ★않는다 — ⛔없는 id 를 가리키면 ★도형이 ★투명해진다 */
  assert.match(fn[0], /if \(!svg\.querySelector\([\s\S]*?\) return false;/,
    '★def 존재 가드가 ★없다 — ★없는 id 를 ★가리키면 ★별이 ★투명해진다');
  /* ⒟ ★테두리 전용(fill="none")은 ★건드리지 않는다 */
  assert.match(fn[0], /getAttribute\('fill'\) === 'none'/, "★fill=none 가드가 ★없다");
});

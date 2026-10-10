/* shape-star-frame-width.test.mjs — ★b1 ★«간격 ↔ 너비» (현빈 2026-10-10 · 1010t1b1 · 지디 판정 ①②③)
 *
 * ★현빈 원문: 「우측패널에서 ★간격을 조절하면 ★해당 블럭의 ★너비가 늘어나며, ★별모양이 아닌
 *   ★별모양 ★간의 갭이 조절되어야될 것 같은데, ★너비고정에, ★간격이 넓어지면 ★별모양 ★비율까지
 *   영향을 끼치게 되더라. ★별모양 블럭의 ★너비가 조절되게함으로써 ★별모양 영향을 ★안 끼치는 선에서」
 *
 * ★★무엇이 흠이었나 — ★`js/shape-star.js` 의 ★간격 머리말이 ★이미 ★임자를 ★이름으로 ★지목해 뒀고
 *   「⛔이 묶음에 ★넣지 않았다 … ★그 별건이 서면 ★상한을 확정한다」로 ★★유보해 뒀다. ★b1 = ★그 별건이다.
 *   ★`applyStarCount` 는 ★폭을 ★키웠고 ★`applyStarGap` 은 ★★안 키웠다
 *   ⇒ ★현빈 판정 「별 크기 유지」(2026-10-06)를 ★★한쪽만 ★지키고 있었다.
 *
 * ★★고치기 ★전 ★실측(t1bstar · 기준판 5b8cf0cc1119 · ★순수함수 호출):
 *   ★W 500 고정 · count 5 · inner 48 에서 ★별 하나의 ★가로:세로 비
 *     gap 0 → ★0.9988 · ★gap 15 → ★0.9423 · gap 50 → 0.8324 · gap 100 → 0.7134 · ★gap 200 → ★0.5549
 *   ⇒ ★세로는 ★불변, ★가로만 줄었다. ★상한에서 ★★44.5% 납작했다.
 *
 * ★★이 파일이 ★무엇을 ★잠그나
 *   ㉠ ★식 — ★W' = W · vbW' / vbW 가 ★★«비»를 ★참으로 ★붙드나 (★gap 축 ＋ ★count 축 ★전수)
 *   ㉡ ★★«하나의 자» — ★count 와 ★gap 이 ★★같은 함수를 쓰나(★소스 문자열)
 *   ㉢ ★옛 식(`c/prev`)이 ★★gap 을 ★안 셌다는 ★그 수를 ★★못박는다(★회귀 증인)
 *
 * ⚠️★이 파일은 ★★«창(DOM)»을 ★안 쓴다 — ★순수함수 ＋ ★소스 문자열까지다.
 *   ★★그래서 ★«슬라이더를 ★참으로 ★움직였을 때 ★프레임이 ★넓어지나»는 ★★여기서 ★안 잰다(DOM 몫).
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const M = await (async () => {
  const fs = (await import('node:fs')).default;
  const os = (await import('node:os')).default;
  const { pathToFileURL } = await import('node:url');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-star-fw-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(ROOT, 'js/shape-star.js'), path.join(tmp, 'm.js'));
  const m = await import(pathToFileURL(path.join(tmp, 'm.js')).href);
  fs.rmSync(tmp, { recursive: true, force: true });
  return m;
})();
const { starViewBox, starViewBoxWidth, starFrameWidthFor, starPointsList,
        STAR_VB_W, STAR_VB_H, STAR_GAP_MIN, STAR_GAP_MAX,
        STAR_COUNT_MIN, STAR_COUNT_MAX } = M;

const PANEL = stripComments(readSrc(ROOT, 'js', 'props', 'prop-shape.js'));

/** points 문자열 → 가로·세로 바운딩박스 */
const bbox = (pts) => {
  const xs = [], ys = [];
  pts.trim().split(/\s+/).forEach(p => { const [a, b] = p.split(',').map(Number); xs.push(a); ys.push(b); });
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

test('W0 ★전제 — ★틀은 200×190 이고 ★간격 범위는 ★−150~200 이다 (⛔재기 전에 단언)', () => {
  assert.strictEqual(STAR_VB_W, 200, `★틀 가로 (잰 값: ${STAR_VB_W})`);
  assert.strictEqual(STAR_VB_H, 190, `★틀 세로 (잰 값: ${STAR_VB_H})`);
  /* ★판정 ① — ★상한 ★200 을 ★★두었다(⛔풀지 않았다). ★b1 이 서면 ★그때 ★재서 ★판정한다. */
  assert.strictEqual(STAR_GAP_MAX, 200,
    `★간격 상한이 200 이 아니다(잰 값: ${STAR_GAP_MAX}) — ★판정 ①은 ★«두어라»였다`);
  assert.strictEqual(STAR_GAP_MIN, -150, `★간격 하한 (잰 값: ${STAR_GAP_MIN})`);
});

test('W1 ★폭 식이 ★«틀 N개 ＋ 사이 간격»과 ★같다 · ★문자열도 ★그 수를 쓴다', () => {
  /* ★★★처음 이 칸을 ★«폭 함수 == 문자열»로만 ★썼다 ⇒ ★★항등식이었다.
     ★까닭: ★`starViewBox` 가 ★`starViewBoxWidth` 를 ★불러 ★만든다 ⇒ ★★둘이 ★같이 틀려도 ★초록이다.
     ★변이 N4(식을 `g*c` 로 갈기)가 ★★W1 을 ★못 잡아 ★드러났다.
     ⇒ ★★기대값을 ★★«이 검사 안에서» ★따로 센다 — ★틀 N개 ＋ ★사이(c−1) 번의 간격. ★그 뒤 ★문자열도 견준다. */
  for (let c = STAR_COUNT_MIN; c <= STAR_COUNT_MAX; c++) {
    for (const g of [STAR_GAP_MIN, -40, 0, 15, 77, STAR_GAP_MAX]) {
      const expected = STAR_VB_W * c + g * (c - 1);   // ★간격은 ★별 «사이»에만 — ★(c−1) 번
      assert.strictEqual(starViewBoxWidth(c, g), expected,
        `★count ${c} gap ${g}: ★잰 값 ${starViewBoxWidth(c, g)} vs ★기대 ${expected}`);
      const fromStr = Number(starViewBox(c, g).split(' ')[2]);
      assert.strictEqual(fromStr, expected,
        `★count ${c} gap ${g}: ★viewBox 문자열 ${fromStr} vs ★기대 ${expected}`);
    }
  }
});

test('W2 ★★★식이 ★«별 하나의 비»를 ★참으로 붙든다 — ★간격 축 ★전수', () => {
  /* ★현빈 블록의 실제 값에서 출발한다: W 500 · count 5 · inner 48 */
  const W0 = 500, H = 100, count = 5, inner = 48, g0 = 0;
  const vb0 = starViewBoxWidth(count, g0);
  const star0 = bbox(starPointsList(5, count, g0, inner)[0]);
  const aspect0 = (star0.w * (W0 / vb0)) / (star0.h * (H / STAR_VB_H));
  for (const g of [-150, -40, 0, 15, 50, 100, 200]) {
    const W1 = starFrameWidthFor(W0, count, g0, count, g);
    assert.ok(W1 !== null, `★gap ${g}: ★폭이 null 이다`);
    const vb1 = starViewBoxWidth(count, g);
    const star1 = bbox(starPointsList(5, count, g, inner)[0]);
    const aspect1 = (star1.w * (W1 / vb1)) / (star1.h * (H / STAR_VB_H));
    assert.ok(Math.abs(aspect1 - aspect0) < 1e-9,
      `★gap ${g} 에서 ★비가 ★바뀌었다 — ★잰 값 ${aspect1.toFixed(6)} vs ★기준 ${aspect0.toFixed(6)} (폭 ${W1})`);
  }
});

test('W3 ★같은 식이 ★갯수 축에서도 ★비를 붙든다 — ★★한 자가 ★두 축을 ★덮는다(지디 ③)', () => {
  const W0 = 100, H = 100, g = 15, inner = 48;
  const vb0 = starViewBoxWidth(1, g);
  const s0 = bbox(starPointsList(5, 1, g, inner)[0]);
  const aspect0 = (s0.w * (W0 / vb0)) / (s0.h * (H / STAR_VB_H));
  for (let c = STAR_COUNT_MIN; c <= STAR_COUNT_MAX; c++) {
    const W1 = starFrameWidthFor(W0, 1, g, c, g);
    const vb1 = starViewBoxWidth(c, g);
    const s1 = bbox(starPointsList(5, c, g, inner)[0]);
    const aspect1 = (s1.w * (W1 / vb1)) / (s1.h * (H / STAR_VB_H));
    assert.ok(Math.abs(aspect1 - aspect0) < 1e-9,
      `★count ${c} 에서 ★비가 ★바뀌었다 — ${aspect1.toFixed(6)} vs ${aspect0.toFixed(6)}`);
  }
});

test('W4 ★★회귀 증인 — ★옛 식(`c/prev`)은 ★★gap 을 ★안 셌다(그 수를 못박는다)', () => {
  /* ★t1bstar 실측(2026-10-10): ★gap 15 에서 ★옛 식의 ★오차.
     ★★이 칸이 ★«왜 고쳤나»의 ⚰️증인이다 — ⛔이 수가 0 이 되면 ★고칠 까닭이 ★없었다는 뜻이다. */
  const g = 15;
  const err = (prev, c) => {
    const naive = c / prev;
    const exact = starViewBoxWidth(c, g) / starViewBoxWidth(prev, g);
    return (naive / exact - 1) * 100;
  };
  assert.ok(Math.abs(err(1, 5) - (-5.66)) < 0.01, `★prev1→c5 오차 (잰 값: ${err(1, 5).toFixed(2)}%)`);
  assert.ok(Math.abs(err(5, 6) - (-0.24)) < 0.01, `★prev5→c6 오차 (잰 값: ${err(5, 6).toFixed(2)}%)`);
  assert.ok(Math.abs(err(5, 10) - (-0.70)) < 0.01, `★prev5→c10 오차 (잰 값: ${err(5, 10).toFixed(2)}%)`);
  /* ★★그리고 ★gap 0 에서는 ★★항등이다 — ★★그래서 ★기존 검사가 ★전부 초록이었고 ★안 잡혔다 */
  for (const [prev, c] of [[1, 5], [5, 6], [2, 3]]) {
    const naive = c / prev;
    const exact = starViewBoxWidth(c, 0) / starViewBoxWidth(prev, 0);
    assert.strictEqual(naive, exact,
      `★gap 0 에서 ★옛 식과 ★새 식이 ★달라졌다(prev ${prev}→c ${c}) — ★기존 S3 가 깨질 자리다`);
  }
});

test('W5 ★count=1 ＋ gap 0 은 ★옛 폭 그대로 — ★바이트 규율이 안 깨진다', () => {
  assert.strictEqual(starViewBoxWidth(1, 0), STAR_VB_W, `잰 값: ${starViewBoxWidth(1, 0)}`);
  /* ★count=1 이면 ★간격이 ★폭에 ★안 든다(★(c−1)=0) ⇒ ★어떤 gap 이든 ★같다 */
  for (const g of [STAR_GAP_MIN, 0, 77, STAR_GAP_MAX]) {
    assert.strictEqual(starViewBoxWidth(1, g), STAR_VB_W, `★count 1 · gap ${g} 에서 폭이 변했다`);
  }
  /* ★그래서 ★count 1 에서는 ★폭 연동도 ★아무 일도 안 한다(비가 1) */
  assert.strictEqual(starFrameWidthFor(123, 1, 0, 1, 200), 123, '★count 1 에서 폭이 바뀌었다');
});

test('W6 ★못난 입력은 ★null — ⛔0 이나 NaN 폭을 ★쓰지 않는다', () => {
  for (const bad of [0, -5, NaN, undefined, null, 'abc']) {
    assert.strictEqual(starFrameWidthFor(bad, 5, 0, 5, 50), null,
      `★폭 ${JSON.stringify(bad)} 가 null 이 아니다`);
  }
  /* ★★클램프는 ★이 함수에 ★없다 — ★상·하한은 ★패널 것이다(머리말의 그 ⚠️) */
  assert.ok(starFrameWidthFor(800, 1, 0, 10, 200) > 860,
    '★순수 함수가 ★제 맘대로 ★860 으로 ★조였다 — ★클램프는 ★부르는 쪽 몫이다');
});

test('W7 ★★«하나의 자» — ★갯수와 ★간격이 ★★같은 함수를 쓴다 (⛔명부 둘 금지)', () => {
  /* ★패널에 ★자가 ★하나 ★정의되고 — ⛔둘이면 ★어긋난다 */
  const def = (PANEL.match(/const _starWantW = /g) || []).length;
  assert.strictEqual(def, 1, `★_starWantW 정의가 ★${def} 개다 — ★하나여야 한다`);
  /* ★★그리고 ★두 길이 ★★그것을 ★부른다 — ★갯수 쪽 ＋ ★간격 쪽 */
  /* ★★내 ★첫 수는 ★3 이었고 ★★틀렸다 — ★정의는 `_starWantW = (` 라 ★`_starWantW(` 에 ★안 걸린다.
     ⇒ ★★호출만 센다: ★갯수 1 ＋ ★간격 1 = ★2. (★★이 빨강은 ★제품이 아니라 ★★내 ★자의 흠이었다) */
  const calls = (PANEL.match(/_starWantW\(/g) || []).length;
  assert.strictEqual(calls, 2, `★_starWantW 호출이 ★${calls} 번이다 — ★갯수 1 ＋ ★간격 1 = 2`);
  /* ★★★간격 쪽이 ★참으로 ★폭을 ★쓰나 — ★`applyStarGap` 안에 ★applySize 가 ★있어야 한다.
     ★★고치기 전에는 ★여기가 ★★비어 있었고 ★그게 ★b1 의 ★흠 ★그 자체였다. */
  const gapFn = PANEL.match(/const applyStarGap = \(raw\) => \{[\s\S]*?\n    \};/);
  assert.ok(gapFn, '★applyStarGap 몸통을 ★못 떴다 — ★닻이 썩었다');
  assert.match(gapFn[0], /_starWantW\(/, '★★간격이 ★폭 자를 ★안 쓴다 — ★b1 이 ★안 걸렸다');
  assert.match(gapFn[0], /applySize\(/, '★★간격이 ★폭을 ★안 쓴다(applySize 없음) — ★별이 ★납작해진다');
  /* ★갯수 쪽도 ★같은 자를 쓰나 */
  const cntFn = PANEL.match(/applyStarCount = \(raw\) => \{[\s\S]*?\n    \};/);
  assert.ok(cntFn, '★applyStarCount 몸통을 ★못 떴다');
  assert.match(cntFn[0], /_starWantW\(/, '★갯수가 ★공용 자를 ★안 쓴다');
});

test('W8 ★★dataset 을 ★쓰기 «전»에 ★폭을 잰다 — ⛔뒤면 ★prev 가 ★새 값이 되어 ★비가 1 이 된다', () => {
  /* ★이 순서가 ★깨지면 ★폭이 ★★한 번도 ★안 변한다(조용히 아무 일 없음) ⇒ ★순서를 ★검사로 잠근다 */
  for (const [name, re] of [
    ['applyStarCount', /applyStarCount = \(raw\) => \{[\s\S]*?\n    \};/],
    ['applyStarGap',   /const applyStarGap = \(raw\) => \{[\s\S]*?\n    \};/],
  ]) {
    const body = PANEL.match(re);
    assert.ok(body, `★${name} 몸통을 ★못 떴다`);
    const iWant = body[0].indexOf('_starWantW(');
    const iWrite = body[0].search(/block\.dataset\.star(Count|Gap)\s*=|delete block\.dataset\.starGap/);
    assert.ok(iWant >= 0, `★${name} 에 ★폭 자 호출이 없다`);
    assert.ok(iWrite >= 0, `★${name} 에 ★dataset 쓰기가 없다`);
    assert.ok(iWant < iWrite,
      `★${name}: ★폭을 ★dataset 쓰기 ★«뒤»에 잰다(자 ${iWant} · 쓰기 ${iWrite}) — ★prev 가 ★새 값이 된다`);
  }
});

test('W9 ★★상한 860 이 ★무는 ★자리 — ★거기서 ★비 보장이 ★끊긴다(판정 ③ 의 ★대가를 ★못박는다)', () => {
  /* ★★판정 ③(지디) = 「★상한에 닿으면 ★거기서 ★멈춘다(= 별이 작아진다)」.
   * ★★그 «대가»를 ★수로 적어 둔다 — ⛔「멈춘다」만 적으면 ★다음 사람이 ★«비는 늘 지켜진다»로 읽는다.
   * ★★실측(t1bstar 2026-10-10 · 지디 ① 후속 요청에 답한 수):
   *   ★현빈 블록(W 500 · count 5 · gap 15 에서 출발)은 ★gap 200 에서 ★폭 ★849 ⇒ ★★상한 ★안 닿는다(여유 10.9px)
   *     ⇒ ★비가 ★gap 0~200 ★전 구간에서 ★지켜진다(0.9418~0.9429 · 흔들림은 ★폭 정수 반올림뿐)
   *   ★★그러나 ★gap 0 에서 ★출발하면 ★gap 200 이 ★폭 ★900 을 요구한다 ⇒ ★860 으로 ★잘리고 ★비가 ★−4.44% 깨진다
   *   ★★경계 = ★W0 ≥ ★479 (식: W0 · vbW(5,200)/vbW(5,0) > 860 ⇒ W0 > 477.78)
   * ⇒ ★★이 칸은 ★«결함»이 아니라 ★★«판정 ③ 의 ★알려진 대가»를 ★잠그는 자다.
   *   ★★그 경계가 ★조용히 움직이면(상한·범위·틀폭이 갈리면) ★여기가 ★빨개진다. */
  /* ★★★먼저 ★«내 CLAMP 가 ★제품의 ★그 수인가»를 ★잰다 — ⛔안 재면 ★이 칸은 ★산술만 ★잠근다.
     ★★실측으로 드러났다: ★변이 N8(제품 상한 860→900)에서 ★★이 칸이 ★fail 0 이었다.
       ★까닭 = ★아래 CLAMP 가 ★860 을 ★손에 들고 있어 ★제품이 ★움직여도 ★★안 보였다.
     ⇒ ★★상한을 ★제품 소스에서 ★뽑아 ★견준다. (★「기대값을 ★제품과 ★같이 ★흔들리게 두지 마라」의 ★반대편 — 
        ★여기선 ★제품 수를 ★★«읽어 ★단언»한다. ★뽑아서 ★계산에 ★쓰면 ★또 ★항등식이 된다) */
  const capM = PANEL.match(/Math\.max\(10, Math\.min\((\d+), Math\.round\(raw\)\)\)/);
  assert.ok(capM, '★패널의 ★클램프 줄을 ★못 떴다 — ★닻이 썩었다(제품이 ★딴 꼴로 조이고 있다)');
  assert.strictEqual(Number(capM[1]), 860,
    `★제품의 ★상한이 ★860 이 아니다(잰 값: ${capM[1]}) — ★아래 수(849·479·−4.44%)가 ★전부 ★그 860 에서 나온다`);
  assert.match(PANEL, /Math\.max\(10, Math\.min\(860/, '★하한 10 ＋ 상한 860 꼴이 아니다');

  const CLAMP = (w) => Math.max(10, Math.min(860, Math.round(w)));
  const H = 100, C = 5, IN = 48;
  const aspectAt = (W, g) => {
    const b = bbox(starPointsList(5, C, g, IN)[0]);
    return (b.w * (W / starViewBoxWidth(C, g))) / (b.h * (H / STAR_VB_H));
  };
  /* ⒜ ★현빈 블록은 ★상한에 ★안 닿는다 — ★★그래서 ★판정 ①(상한 200 유지)이 ★그 블록엔 ★무해하다 */
  const need = starFrameWidthFor(500, C, 15, C, STAR_GAP_MAX);
  assert.ok(Math.round(need) <= 860,
    `★현빈 블록이 ★상한에 ★닿는다 — ★요구 폭 ${need.toFixed(1)} > 860`);
  assert.strictEqual(CLAMP(need), 849, `★gap 200 에서의 폭 (잰 값: ${CLAMP(need)})`);
  assert.ok(Math.abs(aspectAt(CLAMP(need), STAR_GAP_MAX) - aspectAt(500, 15)) < 0.002,
    '★현빈 블록의 ★비가 ★gap 200 에서 ★깨졌다 — ★상한에 안 닿는데 깨지면 ★식이 틀렸다');
  /* ⒝ ★★그러나 ★넓은 블록은 ★잘린다 — ★그 경계를 ★못박는다 */
  const edge = 860 * starViewBoxWidth(C, 0) / starViewBoxWidth(C, STAR_GAP_MAX);
  assert.ok(Math.abs(edge - 477.78) < 0.01, `★경계 식 (잰 값: ${edge.toFixed(2)})`);
  assert.ok(Math.round(starFrameWidthFor(479, C, 0, C, STAR_GAP_MAX)) > 860,
    '★W0 479 가 ★상한을 ★안 넘는다 — ★경계가 움직였다');
  assert.ok(Math.round(starFrameWidthFor(478, C, 0, C, STAR_GAP_MAX)) <= 860,
    '★W0 478 이 ★벌써 ★상한을 넘는다 — ★경계가 움직였다');
  /* ⒞ ★★잘린 자리에서는 ★비가 ★참으로 ★깨진다 — ⛔「멈춘다」가 ★«비 보장»을 ★안 지킨다는 ★그 사실 */
  const capped = CLAMP(starFrameWidthFor(500, C, 0, C, STAR_GAP_MAX));
  assert.strictEqual(capped, 860, `★잘린 폭 (잰 값: ${capped})`);
  const drop = (aspectAt(capped, STAR_GAP_MAX) / aspectAt(500, 0) - 1) * 100;
  assert.ok(drop < -4 && drop > -5,
    `★잘린 자리의 ★비 손실이 ★−4~−5% 밖이다 (잰 값: ${drop.toFixed(2)}%)`);
});

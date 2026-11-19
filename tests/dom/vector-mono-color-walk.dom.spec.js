/* vector-mono-color-walk — VECTOR-MONO-COLOR-DOM-WALK-P1-02 (시트 0.9.13 130행 · 현빈 순서 ① 단색 색 바꾸기 제대로)
 *   옛 그리기는 fill="black|#000000|#000|currentColor" 네 글자만 바꿨다(vector-block.js 옛 :43-46) ⇒ style 안 칠 · stroke · 칠 없는 도형(기본 검정) ·
 *   검정 아닌 단색 아이콘(빨강 등)은 패널에서 색을 골라도 안 바뀌었다.
 *   고침 = SVG 요소를 걸어 칠 슬롯(fill·stroke × 속성·style · 칠 없는 도형)에 쓴다 · none·url()·여러 색은 건드리지 않는다 ·
 *     단색 비검정은 색 바꾸기 한 문(setVectorColor)이 data-svg 를 검정으로 한 번 고쳐 적는다 · currentColor 는 뿌리 color 로 풀린다.
 * 칸 (색은 패널 hex 칸 «진짜 입력» · 판정은 그린 요소의 getComputedStyle)
 *   M1 검정 단색 SVG 슬롯 여섯 — 칠 없는 path · style fill · stroke 속성 · fill none(그대로)+stroke · currentColor · url()(그대로) → 빨강
 *   M2 빨강 단색 아이콘(fill·stroke 둘) → 파랑 → 다시 검정 · 저장→다시 열기 · 다시 그리기 뒤에도 그 색 · ⌘Z 한 번 = 앞 색
 *   M3 [음성] 두 색 SVG(빨강·파랑) → 초록을 골라도 그림·data-svg 무변(여러 색은 P2 몫 — 조용히 한 색으로 만들지 않는다)
 * 양성대조: _patches/vector-p1-CTL-text-replace.patch(그리기를 옛 글자 치환 넷으로 되돌림) → M1·M2 빨강 · M3 초록.
 * ⛔고정 대기 0(expect.poll · 조건 대기).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const SLOTS = `<svg ${NS} viewBox="0 0 60 10" width="120" height="20">` +
  '<defs><linearGradient id="g"><stop offset="0" stop-color="#00ff00"/><stop offset="1" stop-color="#00ff00"/></linearGradient></defs>' +
  '<path d="M0 0h10v10H0z"/>' +
  '<rect x="10" width="10" height="10" style="fill:#000"/>' +
  '<line x1="20" y1="5" x2="30" y2="5" stroke="#000000" stroke-width="4"/>' +
  '<rect x="30" width="10" height="10" fill="none" stroke="black"/>' +
  '<rect x="40" width="10" height="10" fill="currentColor"/>' +
  '<rect x="50" width="10" height="10" fill="url(#g)"/></svg>';
const RED_ICON = `<svg ${NS} viewBox="0 0 20 10" width="80" height="40"><path d="M0 0h10v10H0z" fill="#ff0000"/><rect x="10" width="10" height="10" fill="none" stroke="#FF0000" stroke-width="2"/></svg>`;
const TWO = `<svg ${NS} viewBox="0 0 20 10" width="80" height="40"><rect width="10" height="10" fill="#ff0000"/><rect x="10" width="10" height="10" fill="#0000ff"/></svg>`;

async function scene(page, svg, waitSel = '#vb-hex') {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async (svg) => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    await window.addSection();
    const b = window.addVectorFromSvgText(svg, 'T');
    b.id = 'vbT';
    window.deselectAll?.();
    b.scrollIntoView({ block: 'center', inline: 'center' });
    return b.id;
  }, svg);
  expect(id, '[전제] 벡터 블럭').toBe('vbT');
  const r = await waitStableRect(page, '#vbT');
  await page.mouse.click(r.cx, r.cy);
  await page.waitForSelector(waitSel, { timeout: 5000 });   // [전제] 벡터 패널이 떴다(단색 = #vb-hex · 여러 색 = 무리 줄 — P2)
  return errs;
}
/** 패널 hex 칸에 진짜로 쳐서 확정(input → 그리기 · Tab = change → 히스토리) */
async function pick(page, hex) {
  await page.locator('#vb-hex').fill(hex);
  await page.locator('#vb-hex').press('Tab');
  await expect.poll(() => page.evaluate(() => document.getElementById('vbT').dataset.color.toLowerCase()), `[전제] 색 ${hex} 이 블럭에 들어갔다`).toBe('#' + hex.toLowerCase());
}
/** 그린 도형마다 계산된 [fill, stroke] (그라데이션은 'url') */
const painted = (page) => page.evaluate(() => [...document.querySelectorAll('#vbT .vb-inner svg :is(path, rect, line)')].map((el) => {
  const cs = getComputedStyle(el);
  return [cs.fill.startsWith('url(') ? 'url' : cs.fill, cs.stroke.startsWith('url(') ? 'url' : cs.stroke];
}));
const R = 'rgb(255, 0, 0)', B = 'rgb(0, 0, 255)', K = 'rgb(0, 0, 0)';

test('M1 검정 단색 SVG 슬롯 여섯 → 빨강(none·url 은 그대로)', async ({ page }) => {
  const errs = await scene(page, SLOTS);
  expect((await painted(page)).length, '[전제] 그린 도형 여섯').toBe(6);
  await pick(page, 'FF0000');
  await expect.poll(() => painted(page)).toEqual([
    [R, 'none'],     // 칠 없는 path(기본 검정 → 뿌리 fill)
    [R, 'none'],     // style fill:#000
    [R, R],          // line — stroke 속성 #000000 · fill 은 칠 없음(뿌리 fill 물려받음 · 선엔 안 보임)
    ['none', R],     // fill none 그대로 · stroke black → 빨강
    [R, 'none'],     // currentColor → 뿌리 color
    ['url', 'none'], // url(#g) 그대로
  ]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M2 빨강 단색 아이콘 → 파랑 → 검정 · ⌘Z · 저장→다시 열기 · 다시 그리기', async ({ page }) => {
  const errs = await scene(page, RED_ICON);
  expect(await painted(page), '[전제] 처음엔 제 빨강').toEqual([[R, 'none'], ['none', R]]);
  await pick(page, '0000FF');
  await expect.poll(() => painted(page), '★빨강 단색 아이콘이 파랑으로').toEqual([[B, 'none'], ['none', B]]);
  await pick(page, '000000');
  await expect.poll(() => painted(page), '★검정도 고를 수 있다').toEqual([[K, 'none'], ['none', K]]);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => painted(page), '★⌘Z 한 번 = 앞 색(파랑)').toEqual([[B, 'none'], ['none', B]]);
  const canvas = await page.evaluate(() => window.getSerializedCanvas());
  await page.evaluate((c) => window.applyProjectData({ canvas: c }), canvas);
  await page.waitForSelector('#vbT');
  expect(await painted(page), '★저장→다시 열기 뒤 파랑').toEqual([[B, 'none'], ['none', B]]);
  await page.evaluate(() => window.renderVector(document.getElementById('vbT')));
  expect(await painted(page), '★다시 그리기 뒤에도 파랑(data-svg·color 로 다시 지어도)').toEqual([[B, 'none'], ['none', B]]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ★기대 바뀜(VECTOR-MULTICOLOR-STROKE-P2-01 · 04cc5fa15 · 지디 261120 판정): P1-02 때 «여러 색 SVG 는 단색 칸이 칠하지 않는다»(음성)였는데
 *   P2 가 여러 색이면 단색 칸(#vb-hex) 대신 «색 1·2 …» 무리 줄을 띄운다 ⇒ 같은 뜻(«한 색을 고르면 다른 색은 그대로»)을 무리 줄로 잰다. */
test('M3 [음성] 두 색 SVG → 단색 칸 없음 · 색 1 만 초록 · 색 2(파랑) 그대로', async ({ page }) => {
  const errs = await scene(page, TWO, '#vb-g1-hex');
  expect(await painted(page), '[전제] 빨강·파랑').toEqual([[R, 'none'], [B, 'none']]);
  expect(await page.locator('#vb-hex').count(), '여러 색 = 단색 칸 없음(무리 줄)').toBe(0);
  expect(await page.locator('[id^="vb-g"][id$="-hex"]').count(), '무리 줄 둘').toBe(2);
  await page.locator('#vb-g0-hex').fill('00FF00'); await page.locator('#vb-g0-hex').press('Tab');
  await expect.poll(() => painted(page), '★색 1 만 초록 · 색 2 파랑 그대로').toEqual([['rgb(0, 255, 0)', 'none'], [B, 'none']]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

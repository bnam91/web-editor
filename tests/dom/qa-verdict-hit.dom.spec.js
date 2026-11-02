/* qa-verdict-hit — 관리자 QA 블럭 판정 단추의 위 절반을 위 글자 프레임이 가져가던 것 (w3 328 재현 · 지디 3차)
 * 왜: .qa-verdict(top:-21px · z-index 1)가 블록 밖으로 나오는데 위 프레임이 같은 쌓임 맥락에서 z-index 2 다.
 * 자: 앱 입구(addSection · addQABlock)로 지은 장면 · 진짜 마우스 클릭 · data-verdict.
 * 변이: css/editor-blocks.css .qa-verdict 의 z-index 를 1 로 되돌리면 V1 빨강 · V2 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled, waitStableRect } = require('./_root-harness.js');
const raf2 = (p) => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 950 });
  await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); await window.addSection(); window.selectSection?.([...c.querySelectorAll('.section-block')].pop()); window.addQABlock(); window.deselectAll?.(); window.applyZoom?.(100); });
  await waitZoomSettled(page, 100);
  await page.evaluate(() => document.querySelector('#canvas .qa-block').scrollIntoView({ block: 'center' }));
  await waitStableRect(page, '#canvas .qa-verdict-btn--pass');   // 부드러운 스크롤 중에 잰 자리를 누르면 다른 것이 눌린다
  await raf2(page);
}
const pointOn = (page, v, f) => page.evaluate(([v, f]) => { const b = document.querySelector(`#canvas .qa-block .qa-verdict-btn--${v}`), r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height * f; return { x, y, mine: document.elementFromPoint(x, y) === b }; }, [v, f]);
const verdict = (page) => page.evaluate(() => document.querySelector('#canvas .qa-block').dataset.verdict);

for (const v of ['pass', 'revise', 'fail']) {
  test(`V1 ${v} 단추 가운데를 누르면 그 판정이 된다`, async ({ page }) => {
    await setup(page);
    const p = await pointOn(page, v, 0.5);
    expect(p.mine, '가운데 임자가 단추').toBe(true);
    await page.mouse.click(p.x, p.y); await raf2(page);
    expect(await verdict(page)).toBe(v);
  });
  test(`V2 [음성] ${v} 단추 아래쪽을 눌러도 같다`, async ({ page }) => {
    await setup(page);
    const p = await pointOn(page, v, 0.8);
    await page.mouse.click(p.x, p.y); await raf2(page);
    expect(await verdict(page)).toBe(v);
  });
}
test('V3 [음성] 위 글자 본문은 여전히 글자가 받는다(단추 밖)', async ({ page }) => {
  await setup(page);
  const own = await page.evaluate(() => { const t = document.querySelector('#canvas .tb-h2').getBoundingClientRect(), b = document.querySelector('#canvas .qa-verdict').getBoundingClientRect(); return String(document.elementFromPoint(t.left + 20, b.top + 2)?.className).split(' ')[0]; });
  expect(own).toBe('tb-h2');
});

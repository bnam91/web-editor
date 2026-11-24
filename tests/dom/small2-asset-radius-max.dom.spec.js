/* small2-asset-radius-max.dom.spec.js — 0.9.13 179행 t13F-03(현빈 261122): 에셋 모서리 radius 상한 120 → «블럭 짧은 변의 절반»(바닥 120).
 *   R1 큰 에셋(짧은 변 ≥ 600) — 패널 슬라이더 max = 짧은 변 절반 · 숫자칸에 250 = 그대로 250px(옛: 120 에서 잘림)
 *   R2 작은 에셋(짧은 변 절반 < 120) — max 는 120(옛 저장값이 칸 밖으로 안 밀려남) */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, w, h) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(([w, h]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); window.addSection();
    window.addAssetBlock('standard'); const ab = document.querySelector('#canvas .asset-block');
    ab.style.width = w + 'px'; ab.style.height = h + 'px'; ab.dataset.w = String(w); ab.dataset.h = String(h);
    window.showAssetProperties(ab); return ab.id;
  }, [w, h]);
  return { errs, id };
}

test('R1 큰 에셋 — 슬라이더 max = 짧은 변 절반 · 숫자 250 = 250px', async ({ page }) => {
  const { errs, id } = await scene(page, 700, 640);
  const box = await page.evaluate((i) => { const b = document.getElementById(i); return Math.min(b.offsetWidth, b.offsetHeight); }, id);
  expect(box, '[전제] 짧은 변이 240 보다 크다(120 넘는 상한이 뜻이 있다)').toBeGreaterThan(240);
  expect(Number(await page.locator('#asset-r-slider').getAttribute('max')), '★슬라이더 max = 짧은 변 절반').toBe(Math.floor(box / 2));
  await page.fill('#asset-r-number', '250');
  await page.dispatchEvent('#asset-r-number', 'input');
  expect(await page.evaluate((i) => document.getElementById(i).style.borderRadius, id), '★250 이 120 에서 안 잘린다').toBe('250px');
  expect(errs).toEqual([]);
});

test('R2 작은 에셋 — max 바닥 120', async ({ page }) => {
  const { errs } = await scene(page, 200, 160);
  expect(Number(await page.locator('#asset-r-slider').getAttribute('max')), '짧은 변 절반 80 < 120 ⇒ 120').toBe(120);
  expect(errs).toEqual([]);
});

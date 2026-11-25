/* close0913-fix.dom.spec.js — 0.9.13 마감 채점 ◑ 둘(미카사 GRADE-0913close-2 · 판 1cd189937 · 지디 261125)
 *   C1 179 t13F-03 에셋 모서리 숫자칸 500 → 캔버스 287(짧은 변 절반 상한) · 칸도 287 로 고쳐 씀(옛: 500 그대로)
 *   C2 186 IAL-01 그리드 패널 띄우기 단추 툴팁 = «Ignore Auto Layout — …»(다른 패널과 같은 꼴 · 옛: «오토레이아웃에서 빼서…»)
 * 빨강 기대: 1cd189937 = C1·C2 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function boot(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); });
  return errs;
}

test('C1 에셋 모서리 숫자칸 500 → 캔버스·칸 둘 다 상한 287', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => { window.addAssetBlock(); const b = [...document.querySelectorAll('#canvas .asset-block')].pop(); b.id = 'c1A'; b.style.width = '860px'; b.style.height = '575px'; });
  await page.waitForFunction(() => document.getElementById('c1A')?.classList.contains('selected'));
  await page.waitForSelector('#asset-r-number', { state: 'attached' });
  const max = await page.evaluate(() => Math.floor(Math.min(document.getElementById('c1A').offsetWidth, document.getElementById('c1A').offsetHeight) / 2));
  expect(max, '[전제] 짧은 변 절반 = 287').toBe(287);
  await page.evaluate(() => { const n = document.getElementById('asset-r-number'); n.value = '500'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('c1A')).borderTopLeftRadius)), '캔버스 = 287').toBe(287);
  expect(await page.inputValue('#asset-r-number'), '★C1 칸도 287 로 고쳐 씀').toBe('287');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('C2 그리드 패널 띄우기 단추 툴팁 = «Ignore Auto Layout — …»', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => { window.addGridBlock(); });
  await page.waitForSelector('#grd-float-toggle', { state: 'attached' });
  const t = await page.evaluate(() => { const b = document.getElementById('grd-float-toggle'); return b.getAttribute('title') || b.getAttribute('aria-label') || ''; });
  expect(t.startsWith('Ignore Auto Layout — '), `★C2 툴팁 «${t}»`).toBe(true);
  expect(t, '옛 «오토레이아웃에서 빼서» 글 없음').not.toContain('오토레이아웃에서 빼서');
  expect(errs, errs.join(' | ')).toEqual([]);
});

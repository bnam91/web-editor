/* stroke-std — 표준 Stroke 절 부품(js/props/_stroke-section.js · 현빈 261123 GO · 정본 시안 8910 strokestd2 · 계약 §4c ②b) · 단계 1 = 부품 + 어댑터 + 첫 소비자(도형)
 * S1 도형 패널 Stroke 절 = 부품(.ui-stroke2[data-part=stroke]) · 칸 셋(stroke-color · stroke-align · stroke-width)
 * S2 굵기 칸 입력 → 저장 키 shapeStrokeWidth(옛 키 그대로) · svg stroke-width · change = ⌘Z 한 칸
 * S3 위치 = 막힘(도형은 아직 위치를 못 그림 · §4c «칸만 + 막힘») — aria-disabled · 까닭 툴팁 · 값 = 지금 그려지는 쪽(사각형 = 안쪽) · 화살표 키로 안 바뀜
 * 양성대조: _patches/stroke-std-CTL.patch(어댑터 width 를 안 부름) ⇒ S2 빨강
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addShapeBlock('rectangle'); const b = sec.querySelector('.shape-block'); b.id = b.id || 'shS'; window.selectBlock(b.id); window.showShapeProperties?.(b); window.clearHistory?.(); return b.id; });
  await page.waitForSelector('#panel-right [data-part="stroke"]');
  return { errs, id };
}

test('S1·S2 도형 Stroke = 표준 부품 · 굵기 입력 = 옛 키 · svg · ⌘Z 한 칸', async ({ page }) => {
  const { errs, id } = await scene(page);
  const ui = await page.evaluate(() => { const u = document.querySelector('#panel-right .prop-section[data-sec="stroke"] .ui-stroke2[data-part="stroke"]'); return u && { fields: [...u.querySelectorAll('[data-field]')].map((e) => e.dataset.field), oldSlider: !!document.getElementById('shape-stroke-slider') }; });
  expect(ui, '★Stroke 절 = 표준 부품 · 칸 셋 · 옛 슬라이더 없음').toEqual({ fields: ['stroke-color', 'stroke-align', 'stroke-width'], oldSlider: false });
  const w0 = await page.evaluate((id) => document.getElementById(id).dataset.shapeStrokeWidth ?? null, id);
  await page.fill('#shape-stroke-width', '7'); await page.locator('#shape-stroke-width').dispatchEvent('change'); await raf(page);
  const w1 = await page.evaluate((id) => { const b = document.getElementById(id); return { ds: b.dataset.shapeStrokeWidth, svg: b.querySelector('svg')?.style.strokeWidth ?? null }; }, id);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await raf(page);
  const w2 = await page.evaluate((id) => document.getElementById(id)?.dataset.shapeStrokeWidth ?? null, id);
  console.log('[S2 실측]', JSON.stringify({ w0, w1, w2 }));
  expect(w1, '★굵기 7 = 옛 키 shapeStrokeWidth · svg stroke-width').toEqual({ ds: '7', svg: '7' });
  expect(w2, '★⌘Z 한 칸 = 옛 굵기').toBe(w0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S3 위치 = 막힘(칸만) · 까닭 툴팁 · 값 = 지금 그려지는 쪽 · 키로 안 바뀜', async ({ page }) => {
  const { errs } = await scene(page);
  const a0 = await page.evaluate(() => { const a = document.getElementById('shape-stroke-align'); return { v: a.value, dis: a.getAttribute('aria-disabled'), why: !!a.title, tab: a.tabIndex }; });
  await page.focus('#shape-stroke-align'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await raf(page);
  const v1 = await page.evaluate(() => document.getElementById('shape-stroke-align').value);
  expect([a0.v, a0.dis, a0.why, a0.tab >= 0], '★사각형 = 안쪽 · 막힘 · 까닭 툴팁 · 초점 받음').toEqual(['inside', 'true', true, true]);
  expect(v1, '★막힘 = 화살표 키로 안 바뀜').toBe('inside');
  expect(errs, errs.join(' | ')).toEqual([]);
});

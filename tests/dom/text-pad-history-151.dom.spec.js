/* text-pad-history-151 — 0.9.13 151 TEXT-PAD-SLIDER-NO-HISTORY-01(지디 261120 · 옛 판부터): 텍스트 패딩 슬라이더가 이력을 안 남김
 * P1 상하 패딩 슬라이더 끌기(input 여러 번 → change 한 번) = 이력 한 칸 · ⌘Z 한 번 = 끌기 전 값 · 다른 변경(좌우)과 안 섞임
 * 진짜 끌기 손: 슬라이더 손잡이를 마우스로 끈다(input 연발 + 놓을 때 change) */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function dragSlider(page, id, frac) {
  const b = await page.evaluate((id) => { const e = document.getElementById(id); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width, v: e.value, min: +e.min, max: +e.max }; }, id);
  const x0 = b.x + b.w * ((+b.v - b.min) / (b.max - b.min));
  await page.mouse.move(x0, b.y); await page.mouse.down();
  await page.mouse.move(b.x + b.w * frac, b.y, { steps: 6 });
  await page.mouse.up(); await raf(page);
}
test('P1 (151) 패딩 슬라이더 끌기 = 이력 한 칸 · ⌘Z 한 번 = 끌기 전 · 좌우와 안 섞임', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.applyZoom?.(100);
    window.deselectAll(); window.selectSection(sec); window.addTextBlock('body'); const tb = [...sec.querySelectorAll('.text-block')].pop(); tb.id = 'tbP';
    window.deselectAll(); window.selectBlock('tbP'); window.showTextProperties?.(tb); window.clearHistory?.(); });
  await waitZoomSettled(page, 100);
  await page.waitForSelector('#txt-pv-slider', { state: 'attached' });
  const st = () => page.evaluate(() => { const t = document.getElementById('tbP'); return { pt: t.style.paddingTop || '', pl: t.style.paddingLeft || '', tip: window.getHistoryTip?.()?.pos ?? null }; });
  const s0 = await st();
  await dragSlider(page, 'txt-pv-slider', 0.5);
  const s1 = await st();
  await dragSlider(page, 'txt-ph-slider', 0.75);
  const s2 = await st();
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await raf(page);
  const s3 = await st();
  await page.keyboard.press('Meta+z'); await raf(page);
  const s4 = await st();
  console.log('[151 실측]', JSON.stringify({ s0, s1, s2, s3, s4 }));
  expect([s1.pt !== s0.pt, s1.tip], '★상하 끌기 = 값 바뀜 · 이력 한 칸').toEqual([true, s0.tip + 1]);
  expect([s2.pl !== s1.pl, s2.tip], '★좌우 끌기 = 값 바뀜 · 이력 한 칸 더').toEqual([true, s0.tip + 2]);
  expect([s3.pt, s3.pl], '★⌘Z 한 번 = 좌우만 되돌림(상하 그대로 · 안 섞임)').toEqual([s1.pt, s1.pl]);
  expect([s4.pt, s4.pl], '★⌘Z 두 번 = 끌기 전').toEqual([s0.pt, s0.pl]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

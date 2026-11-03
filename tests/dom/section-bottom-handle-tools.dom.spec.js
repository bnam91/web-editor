/* 도구를 켜면 섹션 바닥 띠를 찍어도 손잡이가 아니라 그 도구가 찍는다.
   변이: css/section-bottom-handle.css 에서 그 도구 줄을 빼면 그 칸이 빨강.
   장면 준비만 evaluate — 찍기는 진짜 마우스. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect, waitZoomSettled } = require('./_root-harness.js');

const TOOLS = [
  { name: '형광펜', on: 'enterHighlightBMode', clicks: 2 },
  { name: '벡터 펜', on: 'enterVectorPenMode', clicks: 2, enter: true },
  { name: '주석', on: 'enterPenMode', clicks: 1 },
];
for (const t of TOOLS) {
  test(`${t.name} — 바닥 띠를 찍으면 도구가 찍는다`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1200 });
    await bootApp(page);
    await page.evaluate(() => {
      const c = document.getElementById('canvas');
      c.querySelectorAll('.section-block').forEach((s) => s.remove());
      c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sT" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>');
      window.rebindAll(); window.applyZoom?.(100);
      document.getElementById('sT').scrollIntoView({ block: 'center' });
    });
    await waitZoomSettled(page, 100);
    const r = await waitStableRect(page, '#sT');
    const before = await page.evaluate(() => {
      window.__first = null;
      document.addEventListener('pointerdown', (e) => { window.__first ??= String(e.target.className); }, true);
      return document.querySelectorAll('#sT *').length;
    });
    await page.evaluate((fn) => window[fn](), t.on);
    /* 형광펜은 진입 뒤 250ms 안의 클릭을 무시한다(_entryClickSeenAt) ⇒ 그 창이 닫힐 때까지 기다린다 */
    const entered = await page.evaluate(() => performance.now());
    await page.waitForFunction((t0) => performance.now() - t0 > 300, entered);
    const pts = [[r.cx, r.top + r.height - 4], [r.cx + 120, r.top + r.height / 2]];
    for (let i = 0; i < t.clicks; i++) {
      await page.mouse.move(pts[i][0], pts[i][1] - 30);
      await page.mouse.move(pts[i][0], pts[i][1]);
      await page.mouse.down(); await page.mouse.up();
    }
    if (t.enter) await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.__first), '★첫 누름의 임자가 손잡이가 아니다').not.toContain('section-bottom-handle');
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('#sT *').length), { message: '★도구가 무언가를 그렸다' }).toBeGreaterThan(before);
  });
}

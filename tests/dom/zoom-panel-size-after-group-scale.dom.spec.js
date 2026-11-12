/* zoom-panel-size-after-group-scale — ZOOM-PANEL-SIZE-FIELD-STALE-AFTER-GROUP-SCALE-01 (0.9.12 · 미카사 발주10 곁 발견 261110).
 * 줌 블럭을 ⌘G 묶음 손잡이로 줄인 뒤 줌 패널 「크기」 칸이 옛 값(260)을 보였다(화면은 줄었음).
 * 뿌리: 크기 칸이 dataset.size 만 읽었다 — 손잡이·묶음 크기는 덧씌우개 dataset.w 에 쓴다(가로 = shapeHalf 의 w ?? size).
 * 장면은 group-scale-zoom-coupon.dom.spec.js 의 묶음 짓기를 그대로 옮겼다(진짜 마우스 ⌘클릭·⌘G·손잡이 끌기).
 *   ZS0 [지킴] 묶기 전 새 줌 — 크기 칸 260 · ZS1 묶음 se 손잡이로 줄인 뒤 패널 크기 칸 = 실제 가로(dataset.w = 그린 폭)
 * 양성대조: prop-zoom.js 의 `st.w ?? st.size` 를 `st.size` 로 되돌리면 ZS1 빨강(260), ZS0 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const HANDLE = (d) => `#ss-handles-overlay .ss-resize-handle.${d}`;
const mid = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, sel);

async function grouped(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = [...c.querySelectorAll('.section-block')].pop(); sec.id = 'sG';
    sec.querySelector('.section-inner').insertAdjacentHTML('beforeend', '<div class="gap-block" id="gbG" data-type="gap" style="height:500px"></div>');
    window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate(() => {
    const sec = document.getElementById('sG');
    // ⚠️도형과 떨어뜨린다 — 확대블럭의 광원(12시 방향 170px)이 위를 덮어 도형 ⌘클릭을 가로챈다
    window.deselectAll(); window.selectSection(sec); window.addZoomBlock({ x: 300, y: 220 }); [...sec.querySelectorAll('.zoom-block')].pop().id = 'z1';
    window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.shape-block')); window.addShapeBlock('rectangle');
    const sh = [...sec.querySelectorAll('.shape-block')].find((x) => !b.has(x)); sh.id = 'sh1';
    const shf = sh.closest('.frame-block'); shf.id = 'shf'; window.updateFrameBlock?.(shf.id, { width: 160, height: 100 });
    const p = window.OverlayFloat.posElOf(shf); window.OverlayFloat.enterFloat(p); p.style.left = '40px'; p.style.top = '40px'; p.dataset.offsetX = '40'; p.dataset.offsetY = '40';
    window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  });
  let [x, y] = await mid(page, '#z1'); await page.mouse.click(x, y);
  await page.keyboard.down('Meta'); [x, y] = await mid(page, '#sh1'); await page.mouse.click(x, y); await page.keyboard.up('Meta');
  await page.keyboard.press('Meta+g');
  await page.locator(HANDLE('se')).waitFor({ state: 'attached' });
  const ok = await page.evaluate(() => { const g = document.getElementById('z1').closest('[data-group="true"]'); return !!g && document.getElementById('shf').closest('[data-group="true"]') === g; });
  expect(ok, '[전제] 둘이 한 묶음').toBe(true);
  return errs;
}
async function drag(page, sel, dx, dy) {
  const [x, y] = await mid(page, sel);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}

const panelSize = (page) => page.evaluate(() => { const z = document.getElementById('z1'); window.showZoomProperties(z);
  return { num: +document.getElementById('zm-size-num').value, sl: +document.getElementById('zm-size').value, dw: z.dataset.w == null ? null : +z.dataset.w, drawn: z.getBoundingClientRect().width }; });

test('ZS0 [지킴] 묶음 손잡이 전 — 크기 칸은 기본 260', async ({ page }) => {
  const errs = await grouped(page);
  const p = await panelSize(page);
  expect(p.dw, '[전제] 아직 덧씌우개 없음').toBeNull();
  expect([p.num, p.sl]).toEqual([260, 260]);
  expect(errs).toEqual([]);
});

test('ZS1 묶음 se 손잡이로 줄인 뒤 — 크기 칸이 실제 가로를 따른다', async ({ page }) => {
  const errs = await grouped(page);
  await drag(page, HANDLE('se'), -120, -80);
  const p = await panelSize(page);
  expect(p.dw, '[전제] 묶음 크기가 줌 가로를 줄였다').toBeLessThan(250);
  expect(Math.abs(p.dw - p.drawn), `[전제] 정본 ${p.dw} = 그린 폭 ${p.drawn}`).toBeLessThanOrEqual(1.5);
  expect(p.num, '크기 칸이 옛 값에 머문다').toBe(Math.round(p.dw));
  expect(Math.abs(p.sl - p.dw), '슬라이더(step 2 라 ±1)').toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

/* grid-circle-shift-drag — GRID-CIRCLE-SHIFT-DRAG-NO-RESIZE-01 (0.9.11_별건 · 미카사 발주9 곁 발견 261110 · int-3 실앱).
 * 그리드 원(원형 줄) 손잡이를 Shift 누른 채 끌면 크기가 아예 안 바뀌었다(120 그대로). Shift 없이는 정상.
 * 뿌리: overlay-handles.js _onGridImageResizeHandleMouseDown 이 Shift = lockAspect 로 resizeGridImage 를 불렀다 —
 *   원은 폭 = 셀 폭 역산(cellW = startW)이라 폭이 상한에 묶이고 높이 = 폭/비율 ⇒ 그대로. 원은 늘 1:1 이라 Shift 를 무시한다.
 * 장면·끌기는 grid-circle-drag-square.dom.spec.js 를 옮겼다(진짜 마우스 · 두 번 클릭으로 그 줄 · 코너 핸들) + Shift 누름.
 *   SC1 se 늘리기 · SC2 se 줄이기 — Shift 끌기 = Shift 없는 끌기와 같은 크기 · 정원
 *   SC0 [지킴] 사각(2:1 그림) 줄은 Shift 비율 고정 그대로(음성대조)
 * 양성대조: overlay-handles.js 의 `&& !(line && line.imgShape === 'circle')` 만 지우면 SC1(120 그대로) 빨강 · SC0 초록. SC2 는 옛 판에서도 바뀔 수 있다(줄이기는 높이 우세면 옛 길도 움직임) — 판정 안 함.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PX2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGNQSjujlHYGAAf/AqmCyMKsAAAAAElFTkSuQmCC';

const raf = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function setupGrid(page, line) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((line) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [line] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.clearHistory?.();
  }, line);
  await raf(page);
  /* 현빈 손: 그림 클릭(블럭) → 한 번 더(그 줄) → 코너 핸들 4개 */
  const { cx: x, cy: y } = await waitStableRect(page, '#gG .grd-img-frame');   // 배율 맞추기가 끝난 뒤에 누른다
  await page.mouse.click(x, y); await raf(page);
  await page.mouse.click(x, y); await raf(page);
  await page.waitForFunction(() => [...document.querySelectorAll('.grd-img-overlay-handle')].filter(h => h.style.display !== 'none').length === 4, null, { timeout: 10000 });
  return errs;
}

const box = (page, sel) => page.evaluate((sel) => {
  const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect();
  return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
}, sel);
const gridH = (page) => page.evaluate(() => JSON.parse(document.getElementById('gG').dataset.cols)[0].lines[0].height);

/* 핸들 중심에서 눌러 (dx,dy) 까지 4걸음 · 2걸음째(중간) 와 4걸음째(놓기 직전) 표본 · 놓은 뒤 표본 */
async function drag(page, handleSel, dx, dy, measureSel, shift = false) {
  const b = await page.locator(handleSel).boundingBox();
  expect(b, `핸들 ${handleSel} 이 없다`).not.toBeNull();
  const x0 = b.x + b.width / 2, y0 = b.y + b.height / 2;
  const before = await box(page, measureSel);
  await page.mouse.move(x0, y0); if (shift) await page.keyboard.down('Shift'); await page.mouse.down();
  let mid = null, last = null;
  for (let i = 1; i <= 4; i++) {
    await page.mouse.move(x0 + dx * i / 4, y0 + dy * i / 4); await raf(page);
    if (i === 2) mid = await box(page, measureSel);
    if (i === 4) last = await box(page, measureSel);
  }
  await page.mouse.up(); if (shift) await page.keyboard.up('Shift'); await raf(page);
  const after = await box(page, measureSel);
  return { before, mid, last, after };
}

const CIRC = { type: 'image', imgSrc: PX, imgShape: 'circle', height: 120, align: 'center' };
const FRAME = '#gG .grd-img-frame';

for (const [n, dx, dy] of [[1, 90, 30], [2, -30, -40]]) {
  test(`SC${n} 그리드 원 se 를 Shift 로 ${dx},${dy} — Shift 없는 끌기와 같은 크기 · 정원`, async ({ page }) => {
    const errs = await setupGrid(page, CIRC);
    const s = await drag(page, '.grd-img-overlay-handle.se', dx, dy, FRAME, true);
    const hShift = await gridH(page);
    console.log(`[SC${n}] shift ${JSON.stringify(s)} h=${hShift}`);
    await page.evaluate(() => { document.activeElement?.blur?.(); window.undo?.(); });
    await raf(page);
    expect(await gridH(page), '[전제] ⌘Z 로 120 복귀').toBe(120);
    await page.evaluate(() => { window.deselectAll?.(); window.hideGridImageResizeHandle?.(); }); await raf(page);
    const { cx: x, cy: y } = await waitStableRect(page, FRAME);
    await page.mouse.click(x, y); await raf(page); await page.mouse.click(x, y); await raf(page);
    await page.waitForFunction(() => [...document.querySelectorAll('.grd-img-overlay-handle')].filter(h => h.style.display !== 'none').length === 4, null, { timeout: 10000 });
    await drag(page, '.grd-img-overlay-handle.se', dx, dy, FRAME, false);
    const hPlain = await gridH(page);
    expect(hShift, `Shift 끌기 ${hShift} ≠ 기본 끌기 ${hPlain}`).toBe(hPlain);
    expect(Math.abs(hShift - 120), '[전제] 크기가 바뀌었다').toBeGreaterThan(10);
    expect(Math.abs(s.after.w - s.after.h), `정원 ${JSON.stringify(s.after)}`).toBeLessThanOrEqual(1);
    expect(errs).toEqual([]);
  });
}

test('SC0 [지킴] 사각 2:1 그림 줄 — Shift 끌기는 비율 고정 그대로', async ({ page }) => {
  const errs = await setupGrid(page, { type: 'image', imgSrc: PX2, height: 120 });
  const s = await drag(page, '.grd-img-overlay-handle.se', -60, -10, FRAME, true);
  console.log(`[SC0] ${JSON.stringify(s)}`);
  expect(Math.abs(s.after.w / s.after.h - 2), `비율 ${JSON.stringify(s.after)}`).toBeLessThanOrEqual(0.05);
  expect(errs).toEqual([]);
});

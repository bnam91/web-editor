/* canvas-rotate-zone-328.dom.spec.js — 시트 328 둘째 꼴: 카드(캔버스) 블럭 회전 모서리가 안 눌렸다.
 *   병: renderCanvas 의 인라인 overflow:hidden 이 모서리 바깥 핫존을 잘라 그 자리 임자가 이웃 글자·빈칸이었다(앱 0/36).
 *   처방: 고른 동안만 overflow 를 푼다(css/editor-blocks.css).
 *   R*  진짜 마우스로 모서리를 끌면 그 핫존이 눌리고 각도가 남는다 · ⌘Z 한 번에 돌아온다.
 *   N1 [음성] 안 고른 블럭은 여전히 자른다 · 핫존도 없다. N2 [음성] 모서리 안쪽 카드 몸을 누르면 안 돈다.
 *   ⛔자 한계: 하네스 · 합성 마우스 · 블럭 위아래 이웃은 기본 장면(소제목·빈칸)뿐. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled, waitStableRect } = require('./_root-harness.js');
const { hitAt } = require('./_click-at.js');

async function scene(page, zoom) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async (zoom) => {
    const cv = document.getElementById('canvas');
    cv.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection([...cv.querySelectorAll('.section-block')].pop());
    window.addCanvasBlock();
    window.applyZoom(zoom);
  }, zoom);
  await waitZoomSettled(page, zoom);
  await page.waitForSelector('.canvas-block.selected > .cvb-rotate-zone.br', { state: 'attached' });
  return errs;
}
/* 핫존을 화면 가운데로 — ⛔zone.scrollIntoView 금지: 잘린 핫존이면 overflow:hidden 인 블럭 «안»을 스크롤해 거짓 초록이 난다 */
async function zonePoint(page, id) {
  const q = `.cvb-rotate-zone.${id}`;
  await page.evaluate((q) => {
    const r = document.querySelector(q).getBoundingClientRect(), w = document.getElementById('canvas-wrap'), W = w.getBoundingClientRect();
    w.scrollTop += r.top + r.height / 2 - (W.top + W.height / 2);
    w.scrollLeft += r.left + r.width / 2 - (W.left + W.width / 2);
  }, q);
  await waitStableRect(page, q);
  return page.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, q);
}
const deg = (page) => page.evaluate(() => document.querySelector('.canvas-block').dataset.rotation || '');

for (const zoom of [40, 100, 160]) for (const id of ['tl', 'tr', 'bl', 'br']) {
  test(`R ${zoom}% ${id} — 모서리를 끌면 돌고 ⌘Z 한 번에 돌아온다`, async ({ page }) => {
    const errs = await scene(page, zoom);
    const p = await zonePoint(page, id);
    expect((await hitAt(page, p.x, p.y)).cls, '그 점의 임자').toContain(`cvb-rotate-zone ${id}`);
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    const dx = id.includes('l') ? 1 : -1, dy = id.includes('t') ? -1 : 1;
    await page.mouse.move(p.x + 30 * dx, p.y + 12 * dy, { steps: 4 }); await page.mouse.move(p.x + 60 * dx, p.y + 40 * dy, { steps: 4 });
    await page.mouse.up();
    const d = parseFloat(await deg(page));
    expect(Number.isFinite(d) && d !== 0, `각도가 남는다(${d})`).toBe(true);
    await page.evaluate(() => window.undo());
    await page.waitForFunction(() => { const b = document.querySelector('.canvas-block'); return !!b && !parseFloat(b.dataset.rotation || '0'); });
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
test('N1 [음성] 안 고른 블럭은 여전히 자르고 핫존이 없다', async ({ page }) => {
  await scene(page, 100);
  await page.evaluate(() => window.deselectAll());
  await page.waitForFunction(() => !document.querySelector('.cvb-rotate-zone'));
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.canvas-block')).overflow)).toBe('hidden');
});
test('N2 [음성] 카드 몸을 눌러 끌면 안 돈다', async ({ page }) => {
  await scene(page, 100);
  const p = await zonePoint(page, 'tl');
  await page.mouse.move(p.x + 60, p.y + 60); await page.mouse.down();
  await page.mouse.move(p.x + 90, p.y + 80, { steps: 4 });
  await page.mouse.up();
  expect(await deg(page)).toBe('');
});

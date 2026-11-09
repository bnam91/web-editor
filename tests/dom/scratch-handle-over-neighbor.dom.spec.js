/* scratch-handle-over-neighbor — 스크래치 그림 A 를 고르면 이웃 B 가 A 모서리를 덮어도 A 의 크기 손잡이가 잡힌다 (0.9.11 SCRATCH-HANDLE-UNDER-NEIGHBOR-01 · int-2 다시 짓기)
 * 왜: 항목은 전부 z 100 이고 손잡이는 항목 «안»이라 뒤 이웃(DOM 뒤 = 위)이 덮으면 그 자리를 잡을 때 B 가 잡혔다. t2-10 으로 손잡이가 네 모서리라 넷 다 잰다.
 * 장면: scratch-resize-corners 와 같다(배율 40% · A 300 폭) + 이웃 B(200 폭)를 A 의 그 모서리를 덮게 A 뒤에 넣는다. 진짜 마우스: A 가운데로 손을 올린 뒤 모서리 손잡이를 바깥으로.
 * 칸: A1~A4 nw·ne·sw·se — A 를 고른 채 그 모서리를 B 가 덮어도 A 가 커지고 B 는 그대로·안 골림
 *     N1 [대조] 아무것도 안 골랐으면 겹친 자리는 여전히 B 가 잡힌다(층 순서 무변) · N2 [대조] A 를 골라도 겹친 자리(모서리 밖)를 누르면 B 가 잡힌다(고른 장을 올리지 않는다 · 지디 판정).
 * 고침 = 대리 손잡이 넷(js/scratch-pad.js _ensureSelResize · css .scratch-resize-sel — 수지 692a9f9b9 를 네 모서리로). 고른 장 z 를 올리는 안(95fa0bb33)은 되돌렸다(e3f4b5893).
 * 양성대조: css/editor-canvas.css · js/scratch-pad.js 를 9efb4abeb 로 되돌리면 A1~A4 빨강 · N1·N2 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect, waitZoomSettled } = require('./_root-harness.js');
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
const frames = async (page) => { for (let i = 0; i < 6; i++) await settle(page); };
const CORNERS = ['nw', 'ne', 'sw', 'se'];
const OPP = { nw: ['right', 'bottom'], ne: ['left', 'bottom'], sw: ['right', 'top'], se: ['left', 'top'] };
const OUT = { nw: [-1, -1], ne: [1, -1], sw: [-1, 1], se: [1, 1] };   // 바깥 방향(화면)

async function setup(page, { zoom = 100, kind = '일반' } = {}) {
  await page.setViewportSize({ width: 1800, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((z) => window.applyZoom(z), zoom);
  await waitZoomSettled(page, zoom);
  await page.evaluate(async (kind) => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; c.getContext('2d').fillRect(0, 0, 600, 400);
    const src = c.toDataURL('image/png');
    await window.addSection();
    await window.initScratchPad('proj_rc', window.state.currentPageId);
    await window._scratchAddAndSave(src, 1000, 200, 300, kind === '그룹' ? 'g1' : undefined, 'A');
    if (window.__coverAt) { const [bx, by] = window.__coverAt; await window._scratchAddAndSave(src, bx, by, 200, undefined, 'B'); }   // 이웃 B — A 뒤에 넣어 DOM 뒤(=위)
    if (kind === '그룹') await window._scratchAddAndSave(src, 1360, 300, 200, 'g1', 'C');
    if (kind === '연결') window.SPLink.addLink(document.querySelector('#canvas .section-block').id, 'A');
    window.clearHistory?.();
    document.querySelector('[data-scratch-id="A"]').scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  }, kind);
  await waitStableRect(page, '[data-scratch-id="A"]');
  await frames(page);
  return errs;
}
const rectOf = (page, id) => page.evaluate((id) => { const r = document.querySelector(`[data-scratch-id="${id}"]`).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width }; }, id);
const geo = (page, id) => page.evaluate((id) => { const it = window._scratchItemById(id); return { x: it.x, y: it.y, w: it.w, linkDy: it.linkDy }; }, id);
const handle = (page, c, id = 'A') => page.evaluate(([c, id]) => { const r = document.querySelector(`[data-scratch-id="${id}"] .scratch-resize--${c}`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, [c, id]);
async function drag(page, c, dx, dy, id = 'A') {
  const r = await rectOf(page, id);
  await page.mouse.move(r.left + r.width / 2, (r.top + r.bottom) / 2);   // 손을 올린다(사람 길)
  const h = await handle(page, c, id);
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.mouse.move(h.x + dx, h.y + dy, { steps: 6 });
  await page.mouse.up();
  await frames(page);
}
const near = (a, b) => Math.abs(a - b) <= 1;

/* A(1000,200,300×200) 모서리를 덮는 B 자리 — 모서리에서 안쪽 50·33 까지 덮는다 */
const COVER = { nw: [850, 100], ne: [1250, 100], sw: [850, 367], se: [1250, 367] };
const sel = (page) => page.evaluate(() => [...document.querySelectorAll('.scratch-item.scratch-selected')].map((e) => e.dataset.scratchId));

for (const [i, c] of CORNERS.entries()) {
  test(`A${i + 1} ${c} — A 를 고른 채 그 모서리를 이웃 B 가 덮어도 A 의 손잡이가 잡힌다`, async ({ page }) => {
    await page.addInitScript((xy) => { window.__coverAt = xy; }, COVER[c]);
    const errs = await setup(page, { zoom: 40 });
    const ra = await rectOf(page, 'A');
    await page.mouse.click(ra.left + ra.width / 2, (ra.top + ra.bottom) / 2);   // A 를 고른다(덮이지 않은 가운데)
    await frames(page);
    expect(await sel(page), '[전제] A 를 골랐다').toEqual(['A']);
    const covered = await page.evaluate(([c]) => { const h = document.querySelector(`[data-scratch-id="A"] .scratch-resize--${c}`).getBoundingClientRect(); const B = document.querySelector('[data-scratch-id="B"]').getBoundingClientRect(); const x = h.left + h.width / 2, y = h.top + h.height / 2; return x >= B.left && x <= B.right && y >= B.top && y <= B.bottom; }, [c]);
    expect(covered, '[전제] B 가 A 의 그 모서리를 덮는다').toBe(true);
    const a0 = await geo(page, 'A'), b0 = await geo(page, 'B');
    await drag(page, c, OUT[c][0] * 40, OUT[c][1] * 40);
    const a1 = await geo(page, 'A'), b1 = await geo(page, 'B');
    expect(a1.w, `★A 가 안 커졌다(손잡이가 B 밑) ${a0.w}→${a1.w}`).toBeGreaterThan(a0.w + 10);
    expect(b1, '★B 가 대신 잡혔다').toEqual(b0);
    expect(await sel(page), 'B 가 골리지 않는다').toEqual(['A']);
    expect(errs).toEqual([]);
  });
}

test('N1 [대조] 아무것도 안 골랐으면 겹친 자리는 B 가 잡힌다 — 층 순서 무변', async ({ page }) => {
  await page.addInitScript((xy) => { window.__coverAt = xy; }, COVER.se);
  const errs = await setup(page, { zoom: 40 });
  await page.evaluate(() => window.deselectAll?.());
  const p = await page.evaluate(() => { const A = document.querySelector('[data-scratch-id="A"]').getBoundingClientRect(); const B = document.querySelector('[data-scratch-id="B"]').getBoundingClientRect(); return { x: (Math.max(A.left, B.left) + Math.min(A.right, B.right)) / 2, y: (Math.max(A.top, B.top) + Math.min(A.bottom, B.bottom)) / 2 }; });
  const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.scratch-item')?.dataset.scratchId, p);
  expect(top, '★고르지 않았는데 겹친 자리의 맨 위가 바뀌었다').toBe('B');
  expect(errs).toEqual([]);
});

test('N2 [대조] A 를 골라도 겹친 자리(모서리 밖)를 누르면 B 가 잡힌다 — 고른 장을 올리지 않는다', async ({ page }) => {
  await page.addInitScript((xy) => { window.__coverAt = xy; }, COVER.se);
  const errs = await setup(page, { zoom: 40 });
  const ra = await rectOf(page, 'A');
  await page.mouse.click(ra.left + ra.width / 2, (ra.top + ra.bottom) / 2);
  await frames(page);
  expect(await sel(page), '[전제] A 를 골랐다').toEqual(['A']);
  /* 겹친 사각형 가운데 — 모서리 손잡이(8px)에서 떨어진 자리 */
  const p = await page.evaluate(() => { const A = document.querySelector('[data-scratch-id="A"]').getBoundingClientRect(); const B = document.querySelector('[data-scratch-id="B"]').getBoundingClientRect(); return { x: (Math.max(A.left, B.left) + Math.min(A.right, B.right)) / 2, y: (Math.max(A.top, B.top) + Math.min(A.bottom, B.bottom)) / 2 }; });
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.scratch-item')?.dataset.scratchId, p), '★고른 장이 이웃 위로 올라왔다').toBe('B');
  await page.mouse.click(p.x, p.y); await frames(page);
  expect(await sel(page), '★겹친 자리를 눌렀는데 B 가 안 잡혔다').toEqual(['B']);
  expect(errs).toEqual([]);
});

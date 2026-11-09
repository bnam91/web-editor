/* scratch-resize-corners — 스크래치 그림 크기 손잡이가 네 모서리에 있다 (t2-10 · 현빈 0.9.11_t2 「좌상·우상·좌하·우하 4개 핸들」)
 * 왜: 우하단 하나뿐이라 왼쪽·위쪽으로 키우려면 키운 뒤 옮겨야 했다. 잡은 모서리의 «맞은편»이 고정점 · 비율 유지 · 겉은 옛 우하단과 같다.
 * 칸: C1 네 개 같은 겉 · 손을 올려야 보임 · 자르기 모드에선 숨음 · C2 모서리마다 바깥으로 60 → 폭 +60/배율 · 맞은편 모서리 화면 자리 고정(100·40%)
 *     C3 안으로 끌면 폭 60 에서 멈춤 · C4 그룹 둘 + nw → 묶음 우하단 고정 · C5 ⌘Z/⌘⇧Z · C6 손잡이를 눌러 세로로 끌어도 그림이 안 움직임 · C7 연결된 장 nw → 다시하기 자리 같음
 */
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

test('C1 네 손잡이 — 같은 크기·바탕·테두리 · 손을 올려야 보이고 · 자르기 모드에선 숨는다', async ({ page }) => {
  const errs = await setup(page, { zoom: 40 });
  const look = () => page.evaluate((CS) => CS.map((c) => {
    const e = document.querySelector(`[data-scratch-id="A"] .scratch-resize--${c}`); if (!e) return null;
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    return { w: Math.round(r.width * 10), h: Math.round(r.height * 10), bg: s.backgroundColor, bd: s.borderTopWidth + ' ' + s.borderTopColor, op: s.opacity, pe: s.pointerEvents };
  }), CORNERS);
  await page.mouse.move(2, 2);
  const idle = await look();
  expect(idle.every(Boolean), '★모서리 손잡이가 넷이 아니다').toBe(true);
  for (const v of idle) expect({ ...v, op: undefined, pe: undefined }).toEqual({ ...idle[3], op: undefined, pe: undefined });   // se(옛 손잡이)와 같은 겉
  expect(idle.map((v) => v.op), '손을 안 올리면 숨는다').toEqual(['0', '0', '0', '0']);
  expect(idle.slice(0, 3).map((v) => v.pe), '새 세 모서리는 숨은 동안 클릭을 안 받는다(옆 그림 클릭 가로채기 방지)').toEqual(['none', 'none', 'none']);
  const r = await rectOf(page, 'A');
  await page.mouse.move(r.left + r.width / 2, (r.top + r.bottom) / 2);
  await expect.poll(async () => (await look()).map((v) => v.op + v.pe), { message: '손을 올리면 넷 다 보이고 눌린다' }).toEqual(Array(4).fill('1auto'));
  const sb = await page.evaluate(() => { const r = document.querySelector('[data-scratch-id="A"] .scratch-slice-btn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(sb.x, sb.y);
  await expect.poll(() => page.evaluate(() => document.querySelector('[data-scratch-id="A"]').classList.contains('scratch-slice-mode')), { message: '[전제] 자르기 모드' }).toBe(true);
  await expect.poll(async () => (await look()).map((v) => v.op + v.pe), { message: '자르기 모드에선 넷 다 숨고 안 눌린다' }).toEqual(Array(4).fill('0none'));
  expect(errs).toEqual([]);
});

for (const zoom of [100, 40]) for (const c of CORNERS) {
  test(`C2 ${zoom}% ${c} — 바깥으로 60 끌면 폭 +60/배율 · 맞은편 모서리 자리 고정`, async ({ page }) => {
    const errs = await setup(page, { zoom });
    const g0 = await geo(page, 'A'), r0 = await rectOf(page, 'A');
    const scale = r0.width / g0.w;
    await drag(page, c, OUT[c][0] * 60, OUT[c][1] * 40);
    const g1 = await geo(page, 'A'), r1 = await rectOf(page, 'A');
    expect(Math.abs(g1.w - (g0.w + 60 / scale)), `★폭 ${g0.w} → ${g1.w} (기대 +${(60 / scale).toFixed(1)})`).toBeLessThanOrEqual(1);
    const [ex, ey] = OPP[c];
    expect(near(r1[ex], r0[ex]) && near(r1[ey], r0[ey]), `★맞은편 모서리(${ex}·${ey})가 움직였다 ±1 · ${JSON.stringify([r0[ex], r0[ey], r1[ex], r1[ey]])}`).toBe(true);
    expect(errs).toEqual([]);
  });
}

test('C3 안으로 끌면 폭 60 에서 멈추고 맞은편은 그대로', async ({ page }) => {
  const errs = await setup(page, { zoom: 100 });
  const r0 = await rectOf(page, 'A');
  await drag(page, 'nw', 600, 0);
  const g1 = await geo(page, 'A'), r1 = await rectOf(page, 'A');
  expect(g1.w).toBeCloseTo(60, 3);
  expect(near(r1.right, r0.right) && near(r1.bottom, r0.bottom), `우하단 ±1 · ${JSON.stringify([r0.right, r0.bottom, r1.right, r1.bottom])}`).toBe(true);
  expect(errs).toEqual([]);
});

test('C4 그룹 둘 + nw → 묶음 우하단 고정 · 둘 다 같은 배율', async ({ page }) => {
  const errs = await setup(page, { zoom: 100, kind: '그룹' });
  const bb = async () => { const a = await rectOf(page, 'A'), c = await rectOf(page, 'C'); return { right: Math.max(a.right, c.right), bottom: Math.max(a.bottom, c.bottom) }; };
  const a0 = await geo(page, 'A'), c0 = await geo(page, 'C'), b0 = await bb();
  await drag(page, 'nw', -60, 0);
  const a1 = await geo(page, 'A'), c1 = await geo(page, 'C'), b1 = await bb();
  expect(a1.w / a0.w, '[전제] 커졌다').toBeGreaterThan(1.05);
  expect(c1.w / c0.w).toBeCloseTo(a1.w / a0.w, 3);
  expect(near(b1.right, b0.right) && near(b1.bottom, b0.bottom), `묶음 우하단 ±1 · ${JSON.stringify([b0, b1])}`).toBe(true);
  expect(errs).toEqual([]);
});

test('C5 nw 리사이즈 → ⌘Z 가 x·y·w 를 되돌리고 ⌘⇧Z 가 다시 한다', async ({ page }) => {
  const errs = await setup(page, { zoom: 100 });
  const g0 = await geo(page, 'A');
  await drag(page, 'nw', -60, -40);
  const g1 = await geo(page, 'A');
  expect(g1.x, '[전제] x 가 움직였다').toBeLessThan(g0.x - 10);
  await page.keyboard.press('Meta+z'); await frames(page);
  const u = await geo(page, 'A');
  expect([u.x, u.y, u.w].map(Math.round)).toEqual([g0.x, g0.y, g0.w].map(Math.round));
  await page.keyboard.press('Meta+Shift+z'); await frames(page);
  const r = await geo(page, 'A');
  expect([r.x, r.y, r.w].map(Math.round)).toEqual([g1.x, g1.y, g1.w].map(Math.round));
  expect(errs).toEqual([]);
});

test('C6 손잡이를 눌러 세로로만 끌면 그림이 «안» 움직인다(그림 끌기로 새지 않는다)', async ({ page }) => {
  const errs = await setup(page, { zoom: 100 });
  for (const c of CORNERS) {
    const g0 = await geo(page, 'A');
    await drag(page, c, 0, 80);
    expect(await geo(page, 'A'), `★${c} 손잡이가 그림 끌기를 시작했다`).toEqual(g0);
  }
  expect(errs).toEqual([]);
});

test('C7 섹션에 연결된 장 + nw → ⌘Z 뒤 ⌘⇧Z 자리가 리사이즈 직후와 같다', async ({ page }) => {
  const errs = await setup(page, { zoom: 100, kind: '연결' });
  await drag(page, 'nw', -60, 0);
  await frames(page);
  const g1 = await geo(page, 'A');
  expect(typeof g1.linkDy, '[전제] 앵커(linkDy)가 섰다').toBe('number');
  await page.keyboard.press('Meta+z'); await frames(page);
  await page.keyboard.press('Meta+Shift+z'); await frames(page);
  const r = await geo(page, 'A');
  expect([r.x, r.y, r.w].map(Math.round), `리사이즈 직후 ${JSON.stringify(g1)} · 다시하기 ${JSON.stringify(r)}`).toEqual([g1.x, g1.y, g1.w].map(Math.round));
  expect(errs).toEqual([]);
});

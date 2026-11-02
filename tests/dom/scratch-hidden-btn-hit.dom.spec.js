/* scratch-hidden-btn-hit — 안 보이는 ✕·가위·연결 단추는 클릭을 안 받는다
 * 왜: 좁은 그림이면 단추가 옆 그림 위로 나간다. opacity 0 은 클릭을 막지 않아, 옆 그림을 누른 손에 좁은 그림이 지워졌다(앱 ×3 · 3/3 · ⌘S 뒤 영구).
 * 칸: H1 ✕ · H2 가위 · H3 연결 = A 를 아래로 내려 단추가 옆 그림 «몸통» 위에 있을 때 멀리서 곧장 누르면 옆 그림이 골라진다
 *     H6 같은 줄 = 옆 그림 자기 ✕ 자리를 누르면 A 가 아니라 옆 그림이 지워진다(그 자리는 옆 그림의 ✕ 다)
 *     H4 [음성] 그림에 손을 올리고 ✕ 를 누르면 지워진다 · H5 [음성] 손을 올리면 세 단추가 다 받는다.
 * 변이(잰 값): CSS 되돌림 = H1·H2·H3·H6·H5 빨강 · H4 초록 | ✕ 의 hover auto 만 빼면 H6·H4·H5 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));

/* 배율 40% · 왼쪽에 B(폭 300) · 그 오른쪽에 좁은 A. 사이 없음. dy = A 를 그만큼 아래로(B 윗줄 단추를 비킨다). */
async function setup(page, w, dy = 0) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ([w, dy]) => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; c.getContext('2d').fillRect(0, 0, 600, 400);
    const src = c.toDataURL('image/png');
    window.applyZoom(40);
    await window.initScratchPad('proj_hbh', window.state.currentPageId);
    await window._scratchAddAndSave(src, 1000, 100, 300, undefined, 'B');
    await window._scratchAddAndSave(src, 1300, 100 + dy, w, undefined, 'A');
    document.querySelector('[data-scratch-id="A"]').scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    await window.__spLinkRerender?.();
  }, [w, dy]);
  await page.waitForSelector('[data-scratch-id="A"] .spl-btn', { state: 'attached' });
  await waitStableRect(page, '[data-scratch-id="A"]');   // applyZoom 은 0.15초 전환 — 멈춘 뒤에 자리를 읽는다
  await settle(page);
  return errs;
}
/* A 의 단추가 B 와 겹친 자리의 가운데. 겹침이 없으면 null. */
const overSpot = (page, sel) => page.evaluate((sel) => {
  const a = document.querySelector('[data-scratch-id="A"]');
  const x = a.querySelector(sel).getBoundingClientRect(), b = document.querySelector('[data-scratch-id="B"]').getBoundingClientRect();
  const l = Math.max(x.left, b.left), r = Math.min(x.right, b.right), t = Math.max(x.top, b.top), o = Math.min(x.bottom, b.bottom);
  return r > l && o > t ? { x: (l + r) / 2, y: (t + o) / 2 } : null;
}, sel);
const hover = (page, id, on) => page.waitForFunction(([id, on]) => document.querySelector(`[data-scratch-id="${id}"]`).matches(':hover') === on, [id, on]);
const state = (page) => page.evaluate(() => ({
  items: [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId),
  sel: [...document.querySelectorAll('.scratch-item.scratch-selected')].map((e) => e.dataset.scratchId),
  slicing: !!document.querySelector('.scratch-item.scratch-slice-mode'),
  linking: !!document.querySelector('.spl-link-banner, .spl-linking, body.spl-link-mode'),
}));

for (const [name, sel, w] of [['H1 ✕', '.scratch-close', 30], ['H2 가위', '.scratch-slice-btn', 60], ['H3 연결', '.spl-btn', 60]]) {
  test(`${name} — 옆 그림 위로 나간 자리를 멀리서 곧장 누르면 옆 그림이 골라지고 A 는 그대로다`, async ({ page }) => {
    const errs = await setup(page, w, 150);
    const p = await overSpot(page, sel);
    expect(p, '[전제] 단추가 옆 그림 위로 나갔다').toBeTruthy();
    await page.mouse.move(2, 2); await hover(page, 'A', false);
    await page.mouse.click(p.x, p.y);
    await expect.poll(async () => (await state(page)).sel, { message: '★옆 그림이 안 골라졌다' }).toEqual(['B']);
    const s = await state(page);
    expect(s.items, '★안 보이는 단추가 클릭을 받아 A 가 지워졌다').toEqual(['B', 'A']);
    expect(s.slicing, '★안 보이는 가위가 클릭을 받았다').toBe(false);
    expect(errs).toEqual([]);
  });
}

test('H6 같은 줄 — 옆 그림의 ✕ 자리를 누르면 A 가 아니라 옆 그림이 지워진다', async ({ page }) => {
  const errs = await setup(page, 30);
  const p = await overSpot(page, '.scratch-close');
  expect(p, '[전제] 겹쳤다').toBeTruthy();
  await page.mouse.move(2, 2); await hover(page, 'A', false);
  await page.mouse.move(p.x, p.y); await hover(page, 'B', true);   // 옆 그림 ✕ 는 그 그림에 손이 올라가야 받는다
  await page.mouse.down(); await page.mouse.up();
  await expect.poll(async () => (await state(page)).items, { message: '★누른 자리의 임자가 아닌 그림이 지워졌다' }).toEqual(['A']);
  expect(errs).toEqual([]);
});

test('H4 [음성] 그림에 손을 올리고 ✕ 를 누르면 지워진다', async ({ page }) => {
  const errs = await setup(page, 300);
  const r = await page.evaluate(() => { const q = document.querySelector('[data-scratch-id="A"]'); const a = q.getBoundingClientRect(), x = q.querySelector('.scratch-close').getBoundingClientRect(); return { ax: a.left + a.width / 2, ay: a.top + a.height / 2, x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  await page.mouse.move(r.ax, r.ay); await hover(page, 'A', true);
  await page.mouse.move(r.x, r.y); await settle(page);
  await page.mouse.down(); await page.mouse.up();
  await expect.poll(async () => (await state(page)).items, { message: '★손을 올리고 눌렀는데 안 지워졌다' }).toEqual(['B']);
  expect(errs).toEqual([]);
});

test('H5 [음성] 손을 올리면 세 단추가 다 클릭을 받고, 손을 빼면 안 받는다', async ({ page }) => {
  const errs = await setup(page, 300);
  const look = () => page.evaluate(() => { const a = document.querySelector('[data-scratch-id="A"]'); return ['.scratch-close', '.scratch-slice-btn', '.spl-btn'].map((s) => getComputedStyle(a.querySelector(s)).pointerEvents); });
  const c = await page.evaluate(() => { const r = document.querySelector('[data-scratch-id="A"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(c.x, c.y); await hover(page, 'A', true);
  expect(await look()).toEqual(['auto', 'auto', 'auto']);
  await page.mouse.move(2, 2); await hover(page, 'A', false);
  expect(await look(), '★손을 뺐는데 받는다').toEqual(['none', 'none', 'none']);
  expect(errs).toEqual([]);
});

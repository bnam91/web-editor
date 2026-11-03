/* scratch-narrow-btns — 단추 넷이 그림 폭에 안 들어가면 손을 올려도 숨는다 (현빈 결정 247)
 * 왜: 40% 에서 폭 100 그림 가운데를 누르면 자기 ✕ 가 받아 지워졌고(앱 3/3), ✕·✨·가위·연결이 옆 그림 위로 나가 옆 그림을 누른 손에 받았다.
 * 칸: F 문턱 · C 가운데 누름 · O 옆 그림 자리 · K 숨긴 동안 Delete·⌘X · L 숨긴 동안 ⌘L · G 그룹 진입 우클릭 · Z 손을 올린 채 배율 · W [음성] 넓으면 단추 그대로
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const BTN = ['.scratch-ai-btn', '.scratch-close', '.scratch-slice-btn', '.spl-btns'];
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));

/* 왼쪽 B(폭 300) · 그 오른쪽 사이 20 에 A. 연결은 섹션에 잇고, 그룹은 멀리 짝을 둔다. */
async function setup(page, { zoom = 40, w = 100, kind = '일반' } = {}) {
  await page.setViewportSize({ width: 1800, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ([zoom, w, kind]) => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; c.getContext('2d').fillRect(0, 0, 600, 400);
    const src = c.toDataURL('image/png');
    await window.addSection();
    window.applyZoom(zoom);
    await window.initScratchPad('proj_nb', window.state.currentPageId);
    await window._scratchAddAndSave(src, 1000, 100, 300, undefined, 'B');
    await window._scratchAddAndSave(src, 1320, 100, w, kind === '그룹' ? 'g1' : undefined, 'A');
    if (kind === '그룹') await window._scratchAddAndSave(src, 1320 + w + 400, 100, 100, 'g1', 'C');
    if (kind === '연결') window.SPLink.addLink(document.querySelector('#canvas .section-block').id, 'A');
    document.querySelector('[data-scratch-id="A"]').scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    await window.__spLinkRerender?.();
  }, [zoom, w, kind]);
  await page.waitForSelector('[data-scratch-id="A"] .spl-btn', { state: 'attached' });
  await waitStableRect(page, '[data-scratch-id="A"]');   // applyZoom 은 0.15초 전환 — 멈춘 뒤에 다시 가운데로(전환 중 스크롤은 빗나간다)
  await page.evaluate(() => document.querySelector('[data-scratch-id="A"]').scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
  await waitStableRect(page, '[data-scratch-id="A"]');
  await settle(page);
  return errs;
}
const center = (page, id = 'A') => page.evaluate((id) => { const r = document.querySelector(`[data-scratch-id="${id}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
const hoverA = async (page) => { const c = await center(page); await page.mouse.move(2, 2); await page.mouse.move(c.x, c.y); await page.waitForFunction(() => document.querySelector('[data-scratch-id="A"]').matches(':hover')); await settle(page); return c; };
const shown = (page) => page.evaluate((BTN) => BTN.map((s) => { const c = getComputedStyle(document.querySelector('[data-scratch-id="A"]').querySelector(s)); return c.pointerEvents !== 'none' && c.opacity !== '0'; }), BTN);
const items = (page) => page.evaluate(() => [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId));
const clipboardOk = (page) => page.evaluate(() => {
  window.__clipCalls = 0;
  const old = window.electronAPI;
  window.electronAPI = new Proxy({}, {
    get: (t, k) => (k === 'clipboardWriteImage'
      ? (() => { window.__clipCalls++; return Promise.resolve({ ok: true }); })
      : old[k]),
  });
});
const ALL = [true, true, true, true], NONE = [false, false, false, false];
/* ✨ 왼끝이 그림 왼끝을 넘는 폭(문턱): right + 20×역배율. 잰 값 = 40% 234 · 100% 96 · 160% 61.5 · 연결은 ✨ 가 24 더 왼쪽 */
const NEED = { 40: { 일반: 234, 연결: 294, 그룹: 234 }, 100: { 일반: 96, 연결: 120, 그룹: 96 }, 160: { 일반: 62, 연결: 77, 그룹: 62 } };

for (const zoom of [40, 100, 160]) for (const kind of ['일반', '연결', '그룹']) {
  test(`F ${zoom}% ${kind} — 문턱 아래는 숨고 문턱부터 보인다`, async ({ page }) => {
    const need = NEED[zoom][kind];
    const errs = await setup(page, { zoom, kind, w: need - 1 });
    await hoverA(page);
    expect(await shown(page), `★폭 ${need - 1} 숨는다`).toEqual(NONE);
    await page.evaluate((w) => { document.querySelector('[data-scratch-id="A"]').style.width = w + 'px'; }, need + 1);
    const c = await center(page); await page.mouse.move(c.x + 1, c.y);
    await expect.poll(() => shown(page), { message: `★폭 ${need + 1} 보인다` }).toEqual(ALL);
    expect(errs).toEqual([]);
  });
}

for (const kind of ['일반', '연결', '그룹']) {
  test(`C 40% 폭 100 ${kind} — 가운데를 누르면 지워지지 않고 골린다`, async ({ page }) => {
    const errs = await setup(page, { kind });
    const c = await hoverA(page);
    const before = await items(page);
    await page.mouse.down(); await page.mouse.up();
    await expect.poll(() => page.evaluate(() => document.querySelector('[data-scratch-id="A"]')?.classList.contains('scratch-selected')), { message: '★골려야 한다' }).toBe(true);
    expect(await items(page), '★자기 ✕ 가 받아 지워졌다').toEqual(before);
    expect(errs).toEqual([]);
  });
  test(`O 40% 폭 100 ${kind} — 옆 그림 위로 나간 단추 자리는 옆 그림 차지`, async ({ page }) => {
    const errs = await setup(page, { kind });
    const spots = await page.evaluate((BTN) => { const a = document.querySelector('[data-scratch-id="A"]'), b = document.querySelector('[data-scratch-id="B"]').getBoundingClientRect();
      return BTN.map((s) => { const x = a.querySelector(s).getBoundingClientRect(); const l = Math.max(x.left, b.left), r = Math.min(x.right, b.right), t = Math.max(x.top, b.top), o = Math.min(x.bottom, b.bottom); return r > l && o > t ? { x: (l + r) / 2, y: (t + o) / 2 } : null; }).filter(Boolean); }, BTN);
    expect(spots.length, '[전제] 단추가 옆 그림 위로 나갔다').toBeGreaterThan(0);
    for (const p of spots) {
      await hoverA(page);
      await page.mouse.move(p.x, p.y); await settle(page);
      expect(await page.evaluate((p) => document.elementFromPoint(p.x, p.y).closest('.scratch-item')?.dataset.scratchId, p), '★A 단추가 받는다').toBe('B');
    }
    expect(errs).toEqual([]);
  });
}

for (const [keyName, key] of [['Delete', 'Delete'], ['⌘X', 'Meta+x']]) {
  test(`K 숨긴 동안 ${keyName} — 골라서 지운다 · ⌘Z 로 돌아온다`, async ({ page }) => {
    const errs = await setup(page);
    await clipboardOk(page);
    await hoverA(page);
    await page.mouse.down(); await page.mouse.up();
    await expect.poll(() => page.evaluate(() => document.querySelector('[data-scratch-id="A"]').classList.contains('scratch-selected'))).toBe(true);
    await page.keyboard.press(key);
    await expect.poll(() => items(page), { message: '★키로 지워진다' }).toEqual(['B']);
    await page.keyboard.press('Meta+z');
    await expect.poll(() => items(page), { message: '⌘Z' }).toEqual(['B', 'A']);
    expect(errs).toEqual([]);
  });
}

test('L 숨긴 동안 ⌘L — 고른 그림이 섹션에 이어진다', async ({ page }) => {
  const errs = await setup(page);
  await hoverA(page);
  await page.mouse.down(); await page.mouse.up();
  await expect.poll(() => page.evaluate(() => document.querySelector('[data-scratch-id="A"]').classList.contains('scratch-selected'))).toBe(true);
  await page.keyboard.press('Meta+l');
  await expect.poll(() => page.evaluate(() => window.SPLink.allLinks().some((l) => l.scratchId === 'A')), { message: '★⌘L 이 안 잇는다' }).toBe(true);
  expect(errs).toEqual([]);
});

test('G 숨긴 동안 그룹 진입 우클릭 — 빼기·삭제가 메뉴에 있다', async ({ page }) => {
  const errs = await setup(page, { kind: '그룹' });
  const c = await hoverA(page);
  await page.mouse.dblclick(c.x, c.y);
  await expect.poll(() => page.evaluate(() => document.querySelector('[data-scratch-id="A"]')?.classList.contains('scratch-group-mode')), { message: '★진입 안 됨' }).toBe(true);
  await page.mouse.click(c.x, c.y, { button: 'right' });
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.scratch-send-menu [data-scratch-group-act]')].map((e) => e.dataset.scratchGroupAct))).toEqual(['detach', 'delete']);
  expect(errs).toEqual([]);
});

test('Z 손을 올린 채 배율을 내리면 숨고, 올린 뒤 손이 움직이면 돌아온다', async ({ page }) => {
  const errs = await setup(page, { zoom: 100, w: 100 });
  await hoverA(page);
  await expect.poll(() => shown(page), { message: '[전제] 100% 폭 100 은 들어간다' }).toEqual(ALL);
  await page.evaluate(() => window.applyZoom(40));
  expect(await page.evaluate(() => document.querySelector('[data-scratch-id="A"]').classList.contains('scratch-btns-narrow')), '★마우스를 안 움직여도 숨는다').toBe(true);
  await page.evaluate(() => window.applyZoom(100));
  await waitStableRect(page, '[data-scratch-id="A"]');
  await hoverA(page);
  await expect.poll(() => shown(page), { message: '★돌아온다' }).toEqual(ALL);
  expect(errs).toEqual([]);
});

for (const zoom of [40, 100, 160]) {
  test(`W [음성] ${zoom}% 폭 400 — 단추가 보이고 ✕ 를 누르면 지워진다`, async ({ page }) => {
    const errs = await setup(page, { zoom, w: 400 });
    await hoverA(page);
    await expect.poll(() => shown(page)).toEqual(ALL);
    const x = await page.evaluate(() => { const r = document.querySelector('[data-scratch-id="A"] .scratch-close').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.move(x.x, x.y); await settle(page);
    await page.mouse.down(); await page.mouse.up();
    await expect.poll(() => items(page), { message: '★✕ 가 안 받는다' }).toEqual(['B']);
    expect(errs).toEqual([]);
  });
}

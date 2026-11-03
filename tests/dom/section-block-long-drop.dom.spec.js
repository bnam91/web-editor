/* section-block-long-drop — 섹션 직속 블럭을 길게 끌어 놓기. 조작 = 진짜 마우스, 자리 차림만 앱 함수.
 * 자: 섹션 안 형제 순서 · drop 수 · 놓는 점 임자 · 안내선 수 · 끌기 상태. 화면 px 를 숫자와 견주지 않는다.
 * S3 실측: 놓는 점 임자가 topbar 면 drop 이 안 온다(36/36 일치). 그건 결함이 아니라 맞는 동작이고, 놓인 자리가 없으니 블럭은 제자리다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const J = require('./_frame-judge-294.js');
const FR = '.frame-block:not([data-text-frame])';

async function scene(page) {
  await page.setViewportSize({ width: 1800, height: 1400 });
  await bootApp(page);
  const ids = await page.evaluate(async (FR) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block');
    window.deselectAll(); window.selectSection(sec); window._activeFrame = null;
    const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const F = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)).id;
    window.updateFrameBlock(F, { width: 800, height: 500 });
    window.deselectAll(); window.selectSection(sec); window._activeFrame = null;
    const a = new Set(sec.querySelectorAll('.asset-block')); window.addAssetBlock(); const x = [...sec.querySelectorAll('.asset-block')].find((n) => !a.has(n)); x.dataset.ld = '1';
    window.deselectAll(); window._activeFrame = null; window.clearHistory?.();
    return { F, sec: sec.id };
  }, FR);
  await J.settle(page);
  await page.evaluate(() => { window.__ld = { drop: 0 }; addEventListener('drop', () => { window.__ld.drop++; }, true); });
  return ids;
}
const box = (page, sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom }; }, sel);
const order = (page, sec) => page.evaluate((sec) => [...document.getElementById(sec).querySelector('.section-inner').children].map((c) => (c.querySelector?.('[data-ld]') || c.dataset?.ld ? 'X' : c.id || c.className)).join(), sec);
async function pick(page) { for (let i = 0; i < 6; i++) { if (await page.evaluate(() => document.querySelector('[data-ld]').classList.contains('selected'))) return true; const b = await box(page, '[data-ld]'); await page.mouse.click(b.x, b.y); await J.settle(page); } return false; }
async function dragTo(page, to) {
  const f = await box(page, '[data-ld]');
  await page.mouse.move(f.x, f.y); await page.mouse.down(); await page.mouse.move(to[0], to[1], { steps: 20 }); await J.settle(page);
  await page.mouse.move(to[0] + 0.5, to[1]); await J.settle(page); await page.mouse.move(to[0], to[1]); await J.settle(page);
  const owner = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('#topbar, .topbar') ? 'topbar' : 'canvas', to);
  await page.mouse.up(); await J.settle(page);
  return owner;
}
const left = (page) => page.evaluate(() => ({ dragSrc: !!window.dragSrc, ind: document.querySelectorAll('.drop-indicator').length, dragging: document.querySelectorAll('#canvas .dragging').length, count: document.querySelectorAll('[data-ld]').length }));

test('길게 끌어 캔버스 프레임 위에 놓으면 drop 이 오고 자리가 바뀐다', async ({ page }) => {
  const ids = await scene(page); expect(await pick(page), '[전제] 고름').toBe(true);
  const b4 = await order(page, ids.sec); const F = await box(page, '#' + ids.F);
  expect(await dragTo(page, [F.x, F.top + 8])).toBe('canvas');
  expect(await page.evaluate(() => window.__ld.drop)).toBe(1);
  expect(await order(page, ids.sec)).not.toBe(b4);
  expect(await left(page)).toEqual({ dragSrc: false, ind: 0, dragging: 0, count: 1 });
});
test('음성: 상단 바 위에 놓으면 drop 이 없고 블럭은 제자리, 끌기 상태도 안 남고 다음 끌기가 된다', async ({ page }) => {
  const ids = await scene(page); expect(await pick(page), '[전제] 고름').toBe(true);
  const b4 = await order(page, ids.sec); const tb = await box(page, '#topbar, .topbar'); const f = await box(page, '[data-ld]');
  expect(await dragTo(page, [f.x, tb.y]), '[전제] 놓는 점 임자').toBe('topbar');
  expect(await page.evaluate(() => window.__ld.drop)).toBe(0);
  expect(await order(page, ids.sec)).toBe(b4);
  expect(await left(page)).toEqual({ dragSrc: false, ind: 0, dragging: 0, count: 1 });
  expect(await pick(page), '[전제] 다시 고름').toBe(true);
  const F = await box(page, '#' + ids.F);
  expect(await dragTo(page, [F.x, F.top + 8])).toBe('canvas');
  expect(await order(page, ids.sec)).not.toBe(b4);
});

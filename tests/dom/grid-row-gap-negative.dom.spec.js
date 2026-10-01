/* grid-row-gap-negative.dom.spec.js — 현빈 2026-10-01 「그리드 블럭 로우 2개 사이 간격 0~200 까지 되는데 음수도 -50 정도까지」
 * 행 간격만 GRID_ROW_GAP_MIN(-50)까지. CSS row-gap 은 음수를 버리므로 row-gap:0 + 둘째 줄부터 margin-top:<음수>.
 * 앱 통째(bootApp) · 진짜 마우스로 그리드를 눌러 패널을 열고 숫자칸에 친다.
 * ★양성대조 판 7699ea33 → 빨강: N1 N2 N3 / 초록: N0(양수 간격 그대로 — 지키는 시험) · N4(열 간격은 여전히 0 아래 거절 — 지키는 시험). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:300px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }], rows: [{ height: 'auto' }, { height: 'auto' }],
      cells: [[{ lines: [{ type: 'body', text: 'A' }] }, { lines: [{ type: 'body', text: 'B' }] }], [{ lines: [{ type: 'body', text: 'C' }] }, { lines: [{ type: 'body', text: 'D' }] }]], rowGap: 20, colGap: 20 });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
  });
  await page.waitForTimeout(200);
}
/* 0행 칸 아래끝 ~ 1행 칸 위끝 (모델 px — 캔버스 배율 무관). 음수면 겹친 것. */
const seam = (page) => page.evaluate(() => {
  const a = document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"]'), b = document.querySelector('#gG .grd-cell[data-r="1"][data-c="0"]');
  const k = a.getBoundingClientRect().height / a.offsetHeight;
  return Math.round((b.getBoundingClientRect().top - a.getBoundingClientRect().bottom) / k);
});
async function openPanel(page) {
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('gG').getBoundingClientRect(); return [r.left + 4, r.top + 4]; });
  await page.mouse.click(x, y); await page.waitForTimeout(250);
}
async function typeRowGap(page, v) {
  await page.fill('#grd-row-gap-number', String(v));
  await page.evaluate(() => document.getElementById('grd-row-gap-number').dispatchEvent(new Event('change', { bubbles: true })));
  await page.waitForTimeout(150);
}

test('N0 지키는 시험 — 양수 행 간격(20)은 그대로 20', async ({ page }) => {
  await setup(page);
  expect(await seam(page)).toBe(20);
});
test('N1 ★패널 «행 간격» 슬라이더·숫자칸이 -50 까지 내려간다', async ({ page }) => {
  await setup(page); await openPanel(page);
  expect(await page.evaluate(() => [document.getElementById('grd-row-gap-slider')?.min, document.getElementById('grd-row-gap-number')?.min])).toEqual(['-50', '-50']);
});
test('N2 ★행 간격 -30 → 둘째 줄이 첫째 줄에 30px 겹친다 · ⌘Z 로 20 으로', async ({ page }) => {
  await setup(page); await openPanel(page);
  await typeRowGap(page, -30);
  expect(await page.evaluate(() => document.getElementById('gG').dataset.rowGap)).toBe('-30');
  expect(await seam(page)).toBe(-30);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  expect(await seam(page)).toBe(20);
});
test('N3 ★MCP/코드 길(updateGridBlock) — rowGap -50 은 받고 -51 은 거절', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(() => [window.updateGridBlock('gG', { rowGap: -50 })?.ok, window.updateGridBlock('gG', { rowGap: -51 })?.ok]);
  expect(r).toEqual([true, false]);
  expect(await seam(page)).toBe(-50);
});
test('N4 지키는 시험 — 열 간격은 여전히 0 아래를 거절', async ({ page }) => {
  await setup(page);
  expect(await page.evaluate(() => window.updateGridBlock('gG', { colGap: -10 })?.ok)).toBe(false);
});

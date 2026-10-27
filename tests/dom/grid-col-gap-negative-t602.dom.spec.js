/* grid-col-gap-negative-t602.dom.spec.js — t6-02 그리드 «열 간격»도 −50 까지
 * 원문: 「📍 그리드 블럭의 열간격 역시 -50까지 되게 해줄 것 (현재는 로우 간격만 됨)」
 * 아이맥 실측(ca702d40 ×3): 열 간격 min 0(슬라이더·숫자) · −50 입력 → 0 · −80 → 0 / 행 간격 min −50(전제).
 * 칸
 *   P0  전제 — 같은 패널의 행 간격 min = −50 · 2×2 그리드의 열 사이(seam) 가 양수 colGap 그대로
 *   M   열 간격 슬라이더·숫자칸 min = −50
 *   C   숫자칸에 −30 → dataset.colGap −30 · 둘째 열이 첫째 열에 30 겹친다(seam −30) · −80 → −50 에서 멈춘다
 *   U   ⌘Z → 이전 값으로
 * 양성대조: GD1001_ROOT=<핀 d772f49e 사본> ⇒ M·C·U 빨강 · P0 초록.
 * ⛔고정 대기 없음 — waitForFunction 만. ⛔앱 무접촉(_root-harness.bootApp). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:300px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }], rows: [{ height: 'auto' }, { height: 'auto' }],
      cells: [[{ lines: [{ type: 'body', text: 'A' }] }, { lines: [{ type: 'body', text: 'B' }] }], [{ lines: [{ type: 'body', text: 'C' }] }, { lines: [{ type: 'body', text: 'D' }] }]], rowGap: 20, colGap: 24 });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
  });
  await page.waitForFunction(() => !!document.querySelector('#gG .grd-cell[data-c="1"]'));
  return errs;
}
/* 0열 칸 오른끝 ~ 1열 칸 왼끝 (모델 px). 음수면 겹친 것. */
const seam = (page) => page.evaluate(() => {
  const a = document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"]'), b = document.querySelector('#gG .grd-cell[data-r="0"][data-c="1"]');
  const k = a.getBoundingClientRect().width / a.offsetWidth;
  return Math.round((b.getBoundingClientRect().left - a.getBoundingClientRect().right) / k);
});
async function openPanel(page) {
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('gG').getBoundingClientRect(); return [r.left + 4, r.top + 4]; });
  await page.mouse.click(x, y);
  /* 패널은 고른 뒤 한 번 더 다시 그려질 수 있다 — «같은 입력칸이 두 프레임 산다»를 조건으로 기다린다(⛔고정 대기 아님) */
  await page.waitForFunction(() => new Promise((res) => {
    const n = document.getElementById('grd-col-gap-number');
    if (!n) return res(false);
    n.__s5mk = (n.__s5mk || 0) + 1;
    requestAnimationFrame(() => requestAnimationFrame(() => res(document.getElementById('grd-col-gap-number') === n && n.__s5mk >= 2)));
  }));
}
async function typeColGap(page, v) {
  await page.fill('#grd-col-gap-number', String(v));
  await page.evaluate(() => document.getElementById('grd-col-gap-number').dispatchEvent(new Event('change', { bubbles: true })));
}

test('P0 전제 — 행 간격 min −50 · 열 사이 = 양수 colGap 24', async ({ page }) => {
  const errs = await setup(page); await openPanel(page);
  expect(await page.evaluate(() => document.getElementById('grd-row-gap-number')?.min)).toBe('-50');
  expect(await seam(page)).toBe(24);
  expect(errs).toEqual([]);
});
test('M 열 간격 슬라이더·숫자칸 min = −50', async ({ page }) => {
  const errs = await setup(page); await openPanel(page);
  expect(await page.evaluate(() => [document.getElementById('grd-col-gap-slider')?.min, document.getElementById('grd-col-gap-number')?.min])).toEqual(['-50', '-50']);
  expect(errs).toEqual([]);
});
test('C −30 → 30 겹침 · −80 → −50 에서 멈춤', async ({ page }) => {
  const errs = await setup(page); await openPanel(page);
  await typeColGap(page, -30);
  await page.waitForFunction(() => document.getElementById('gG').dataset.colGap === '-30');
  expect(await seam(page)).toBe(-30);
  await typeColGap(page, -80);
  await page.waitForFunction(() => document.getElementById('gG').dataset.colGap !== '-30');
  expect(await page.evaluate(() => document.getElementById('gG').dataset.colGap)).toBe('-50');
  expect(await seam(page)).toBe(-50);
  expect(errs).toEqual([]);
});
test('U ⌘Z → 이전 값으로', async ({ page }) => {
  const errs = await setup(page); await openPanel(page);
  const pos0 = await page.evaluate(() => window.getHistoryTip?.()?.pos ?? null);
  await typeColGap(page, -30);
  await page.waitForFunction(() => document.getElementById('gG').dataset.colGap === '-30');
  /* 이력 한 칸이 «쌓인 뒤» 되돌린다 — 쌓이기 전에 누르면 앞 칸을 되돌린다(첫 판 3번 중 1번 그랬다) */
  await page.waitForFunction((p0) => (window.getHistoryTip?.()?.pos ?? null) !== p0, pos0);
  await page.evaluate(() => { document.activeElement?.blur?.(); window.undo(); });
  await page.waitForFunction(() => { const g = document.getElementById('gG'); return !!g && g.dataset.colGap !== '-30'; });
  expect(await seam(page)).toBe(24);
  expect(errs).toEqual([]);
});

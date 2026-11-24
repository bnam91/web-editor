/* t13g-03-pen-outside-ial.dom.spec.js — 0.9.13 185행 t13G-03(현빈 결정 261124 야간): 섹션 밖에서 펜으로 그린 선 = 그린 자리에 IAL(떠 있는) 펜 벡터.
 *   옛(t13A-04): 섹션 밖 = 스크래치 «펜 항목»(임시보관함) — 현빈 «스크래치패드처럼 되는 문제».
 *   P1 섹션 하나 · 캔버스 오른쪽 빈 곳 세 점 + Enter → 스크래치 무변 · 그 섹션에 떠 있는 펜 벡터(노드 셋) · 세로 자리 = 그린 자리(±2px) · ⌘Z 한 번 = 벡터 0
 *   P2 섹션 둘 · 둘째 섹션 높이에서 오른쪽 밖에 그림 → 둘째 섹션에 들어감(가장 가까운 섹션 규칙 = 바깥 .svg 드랍과 같음)
 *   진짜 마우스 · 고정 대기 0 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled, waitStableRect } = require('./_root-harness.js');

async function scene(page, n) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async (n) => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    for (let i = 0; i < n; i++) { const s = await window.addSection(); s.id = `sP${i + 1}`; }
    window.deselectAll?.(); window.clearHistory?.();
  }, n);
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  await waitStableRect(page, `#sP${n}`);
  return errs;
}
const scratchN = (page) => page.evaluate(() => document.querySelectorAll('.scratch-item').length);
const vecIn = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block .vector-block')].map((v) => ({
  sec: v.closest('.section-block').id, nodes: v.dataset.penNodes ? JSON.parse(v.dataset.penNodes).length : 0,
  float: v.dataset.overlayBlock === 'true' || !!v.closest('[data-overlay-block="true"]'), top: Math.round(v.getBoundingClientRect().top) })));
/** 섹션(id) 높이 안 · 캔버스 오른쪽 밖 세 점 — 임자가 #canvas 밖이어야 한다 */
const outsidePts = (page, id) => page.evaluate((id) => {
  const c = document.getElementById('canvas').getBoundingClientRect(), s = document.getElementById(id).getBoundingClientRect();
  const y0 = Math.max(s.top, 0) + Math.min(60, s.height / 4);
  return [[c.right + 80, y0], [c.right + 180, y0 + 20], [c.right + 130, y0 + 60]].map(([x, y]) => ({ x, y, out: !document.elementFromPoint(x, y)?.closest('#canvas') }));
}, id);
async function draw(page, pts) {
  expect(pts.every((p) => p.out), '[전제] 세 점 = 캔버스 밖').toBe(true);
  await page.evaluate(() => window.enterVectorPenMode());
  for (const p of pts) await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Enter');
}

test('P1 섹션 밖 펜 → 그 높이 섹션에 떠 있는 펜 벡터 · 스크래치 무변 · 세로 자리 그대로 · ⌘Z 한 번', async ({ page }) => {
  const errs = await scene(page, 1);
  const s0 = await scratchN(page);
  const pts = await outsidePts(page, 'sP1');
  await draw(page, pts);
  await expect.poll(() => vecIn(page).then((v) => v.map(({ sec, nodes, float }) => ({ sec, nodes, float }))), '★떠 있는 펜 벡터 하나(노드 셋)').toEqual([{ sec: 'sP1', nodes: 3, float: true }]);
  expect(await scratchN(page), '★스크래치(임시보관함) 무변').toBe(s0);
  const z = await page.evaluate(() => (window.currentZoom || 40) / 100);
  const want = Math.round(Math.min(...pts.map((p) => p.y)) - 4 * z);   // pad = 선 굵기 2 + 2
  const got = (await vecIn(page))[0].top;
  expect(Math.abs(got - want) <= 2, `★세로 자리 = 그린 자리 want ${want} got ${got}`).toBe(true);
  await page.evaluate(() => { window.exitVectorPenMode?.(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await expect.poll(() => vecIn(page).then((v) => v.length), '★⌘Z 한 번 = 벡터 0').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P2 섹션 둘 — 둘째 섹션 높이 밖에 그리면 둘째 섹션으로', async ({ page }) => {
  const errs = await scene(page, 2);
  await page.evaluate(() => document.getElementById('sP2').scrollIntoView({ block: 'center' }));
  await waitStableRect(page, '#sP2');
  await draw(page, await outsidePts(page, 'sP2'));
  await expect.poll(() => vecIn(page).then((v) => v.map(({ sec, float }) => ({ sec, float }))), '★둘째 섹션의 떠 있는 벡터').toEqual([{ sec: 'sP2', float: true }]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

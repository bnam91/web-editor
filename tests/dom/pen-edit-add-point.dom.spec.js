/* pen-edit-add-point — 133 PEN-EDIT-ADD-POINT-ON-SEGMENT-01(현빈 «이번 판») 펜 편집 모드에서 선분 눌러 점 추가
 * A1 곡선 펜 벡터 → 편집 모드 → 선분 0 의 40% 자리(누름 띠 위 · 그 점의 임자 = 띠) 누름 → 노드 +1 · 새 점 고름(채운 사각) · 그린 path 모양 무변(길이·상자 ±0.5)
 *    · ⌘Z 한 번 = 노드 옛 수 · Esc 뒤 저장→다시 열기 = 늘어난 노드
 * A2 직선 선분 → 핸들 없는 꼭짓점(곧은 선 그대로)
 * 양성대조: _patches/pen-addpt-CTL-no-band.patch(누름 띠 안 그림) → A1·A2 빨강 · 단위 S1 은 bezier-split CTL.
 * ⛔고정 대기 0.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

async function scene(page, nodes) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async (nodes) => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    await window.addSection();
    const vb = window.commitPenNodes(document.querySelector('#canvas .section-block'), nodes, false);
    vb.id = 'vbP';
    vb.scrollIntoView({ block: 'center' });
  }, nodes);
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  await page.evaluate(() => window.enterPenEditMode(document.getElementById('vbP')));
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.vpen-edit-overlay path[data-seg-idx]').length), '[전제] 누름 띠').toBeGreaterThan(0);
  return errs;
}
const nodeCount = (page) => page.evaluate(() => JSON.parse(document.getElementById('vbP').dataset.penNodes).length);
const shape = (page) => page.evaluate(() => { const p = document.querySelector('#vbP .vb-inner svg path'); const b = p.getBBox(); return [p.getTotalLength(), b.x, b.y, b.width, b.height].map((v) => Math.round(v * 2) / 2); });
async function pressSeg(page, idx, frac) {
  let prev = '', q = null;
  await expect.poll(async () => { q = await page.evaluate(([idx, frac]) => { const p = document.querySelector(`.vpen-edit-overlay path[data-seg-idx="${idx}"]`); const pt = p.getPointAtLength(p.getTotalLength() * frac); return { x: pt.x, y: pt.y, own: document.elementFromPoint(pt.x, pt.y) === p }; }, [idx, frac]); const k = `${q.x},${q.y}`, s = k === prev; prev = k; return q.own && s; },
    { message: '[전제] 누를 점 = 그 선분 띠 · 멎음', intervals: [50] }).toBe(true);
  await page.mouse.click(q.x, q.y);
}

test('A1 곡선 선분 누름 = 점 추가 · 모양 무변 · ⌘Z · 저장', async ({ page }) => {
  const errs = await scene(page, [{ x: 0, y: 60, type: 'corner', hIn: null, hOut: { x: 60, y: 0 } }, { x: 200, y: 60, type: 'corner', hIn: { x: 140, y: 120 }, hOut: null }]);
  const n0 = await nodeCount(page), s0 = await shape(page);
  await pressSeg(page, 0, 0.4);
  await expect.poll(() => nodeCount(page), '★노드 +1').toBe(n0 + 1);
  expect(await page.evaluate(() => [...document.querySelectorAll('.vpen-edit-overlay rect')].filter((r) => r.getAttribute('fill') !== '#fff').length), '★새 점 고름').toBe(1);
  const s1 = await shape(page);
  expect(s1.map((v, i) => Math.abs(v - s0[i]) <= 0.5), `★모양 무변 ${JSON.stringify([s0, s1])}`).toEqual([true, true, true, true, true]);
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => nodeCount(page), '★⌘Z 한 번 = 옛 수').toBe(n0);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => nodeCount(page)).toBe(n0 + 1);
  await page.evaluate(() => { window.flushCurrentPage?.(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); });
  await expect.poll(() => nodeCount(page), '★저장→다시 열기 = 늘어난 노드').toBe(n0 + 1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('A2 직선 선분 = 핸들 없는 꼭짓점', async ({ page }) => {
  const errs = await scene(page, [{ x: 0, y: 0, type: 'corner', hIn: null, hOut: null }, { x: 200, y: 80, type: 'corner', hIn: null, hOut: null }]);
  await pressSeg(page, 0, 0.5);
  await expect.poll(() => nodeCount(page)).toBe(3);
  const mid = await page.evaluate(() => JSON.parse(document.getElementById('vbP').dataset.penNodes)[1]);
  expect([mid.type, mid.hIn, mid.hOut], '★핸들 없는 꼭짓점').toEqual(['corner', null, null]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

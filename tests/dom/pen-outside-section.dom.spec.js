/* pen-outside-section — t13A-04(현빈 GO 261119 · DESIGN-t13A-04 ⓐ «오버레이 모드가 기본»)
 *   섹션 «밖»(캔버스 빈 곳)에서 펜 = 스크래치 «펜 항목»(SVG 안 data-goditor-pen 에 펜 데이터) · 섹션에 끌어 놓으면 놓은 자리에 «떠 있는» 벡터(penNodes 그대로 · 점 편집 됨).
 *   섹션 안 펜은 지금 그대로(흐름 벡터).
 * 칸 (진짜 마우스 · 판정 = DOM·dataset)
 *   S1 펜 모드 · 캔버스 오른쪽 빈 곳 세 점 + Enter → .scratch-item +1 · 섹션 블럭 수 무변 · 그 장 src = SVG 이고 펜 데이터 노드 셋
 *   S2 그 장을 섹션 가운데로 끌어 놓기(안내선 뜬 뒤 놓음) → 벡터 하나(dataset.penNodes 노드 셋 · 떠 있음 data-overlay-block) · 그 장 사라짐 · ⌘Z 한 번 = 벡터 0 · 장 되살아남
 *   S3 [음성] 섹션 안에서 세 점 + Enter → 흐름 벡터(penNodes) · 스크래치 장 수 무변
 * 양성대조: _patches/pen-outside-CTL-section-only.patch(_penHost 가 섹션 밖이면 null — 옛 동작) → S1·S2 빨강 · S3 초록.
 * ⛔고정 대기 0(expect.poll · 조건 대기).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    await window.addSection();
    window.deselectAll?.();
  });
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));
  return errs;
}
const counts = (page) => page.evaluate(() => ({ scratch: document.querySelectorAll('.scratch-item').length, blocks: document.querySelectorAll('#canvas .section-block .vector-block, #canvas .section-block .asset-block').length }));
const penOf = (page, id) => page.evaluate((id) => {
  const it = document.querySelector(`.scratch-item[data-scratch-id="${id}"] img`); if (!it) return null;
  const src = it.getAttribute('src') || '';
  if (!src.startsWith('data:image/svg+xml;base64,')) return { svg: false };
  const txt = decodeURIComponent(escape(atob(src.slice(26))));
  const m = /data-goditor-pen="([^"]+)"/.exec(txt);
  return { svg: true, nodes: m ? JSON.parse(decodeURIComponent(m[1])).nodes.length : 0 };
}, id);
/** 캔버스 오른쪽 빈 곳 세 점(화면) — 그 점의 임자가 #canvas 밖이어야 한다 */
const outsidePts = (page) => page.evaluate(() => {
  const c = document.getElementById('canvas').getBoundingClientRect();
  const pts = [[c.right + 80, c.top + 120], [c.right + 180, c.top + 140], [c.right + 130, c.top + 220]];
  return pts.map(([x, y]) => ({ x, y, out: !document.elementFromPoint(x, y)?.closest('#canvas') }));
});

test('S1 섹션 밖 펜 → 스크래치 펜 항목 · 섹션 블럭 무변', async ({ page }) => {
  const errs = await scene(page);
  const c0 = await counts(page);
  const pts = await outsidePts(page);
  expect(pts.every((p) => p.out), '[전제] 세 점 = 캔버스 밖').toBe(true);
  await page.evaluate(() => window.enterVectorPenMode());
  for (const p of pts) await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Enter');
  await expect.poll(counts, '★스크래치 +1 · 섹션 블럭 무변').toEqual({ scratch: c0.scratch + 1, blocks: c0.blocks });
  const id = await page.evaluate(() => [...document.querySelectorAll('.scratch-item')].pop().dataset.scratchId);
  expect(await penOf(page, id), '★SVG 장 · 펜 노드 셋').toEqual({ svg: true, nodes: 3 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S2 펜 항목을 섹션에 끌어 놓기 → 떠 있는 펜 벡터 · ⌘Z 한 번 = 되돌림', async ({ page }) => {
  const errs = await scene(page);
  const pts = await outsidePts(page);
  await page.evaluate(() => window.enterVectorPenMode());
  for (const p of pts) await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Enter');
  await expect.poll(() => counts(page).then((c) => c.scratch), '[전제] 펜 항목').toBe(1);
  await page.evaluate(() => window.exitVectorPenMode?.());
  const id = await page.evaluate(() => document.querySelector('.scratch-item').dataset.scratchId);
  /* 장 가운데(그 점의 임자 = 그 장 · 멎음)에서 잡아 섹션 가운데로 */
  let prev = '', a = null;
  await expect.poll(async () => { a = await page.evaluate((id) => { const el = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`); const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, own: document.elementFromPoint(x, y)?.closest('.scratch-item') === el }; }, id); const k = `${a.x},${a.y}`, s = k === prev; prev = k; return a.own && s; },
    { message: '[전제] 장 가운데 = 그 장 · 멎음', intervals: [50] }).toBe(true);
  const b = await page.evaluate(() => { const r = document.querySelector('#canvas .section-block').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(a.x + (b.x - a.x) * i / 8, a.y + (b.y - a.y) * i / 8);
  await expect.poll(() => page.evaluate(() => !!document.querySelector('.sp2c-section-target, .sp2c-insert-indicator, .sp2c-replace-target')), '[전제] 놓을 자리 안내(아밍)').toBe(true);
  await page.mouse.move(b.x + 1, b.y + 1);   // 아밍 뒤 한 번 더 움직여 끌기 쪽 판정(dropKind)을 갱신
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.mouse.up();
  const vec = () => page.evaluate(() => { const v = document.querySelector('#canvas .section-block .vector-block'); if (!v) return null; return { nodes: v.dataset.penNodes ? JSON.parse(v.dataset.penNodes).length : 0, float: !!v.closest('[data-overlay-block="true"]') || v.dataset.overlayBlock === 'true' }; });
  await expect.poll(vec, '★떠 있는 펜 벡터(노드 셋)').toEqual({ nodes: 3, float: true });
  await expect.poll(() => counts(page).then((c) => c.scratch), '★장은 섹션으로 옮겨 감').toBe(0);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(vec, '★⌘Z 한 번 = 벡터 0').toBeNull();
  await expect.poll(() => counts(page).then((c) => c.scratch), '★⌘Z 한 번 = 장 되살아남').toBe(1);
  expect(await penOf(page, id), '★되살린 장도 펜 항목').toEqual({ svg: true, nodes: 3 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S3 [음성] 섹션 안 펜 = 흐름 벡터 · 스크래치 무변', async ({ page }) => {
  const errs = await scene(page);
  const c0 = await counts(page);
  const pts = await page.evaluate(() => { const r = document.querySelector('#canvas .section-block').getBoundingClientRect(); return [[0.3, 0.3], [0.6, 0.35], [0.45, 0.6]].map(([fx, fy]) => ({ x: r.left + r.width * fx, y: r.top + r.height * fy })); });
  await page.evaluate(() => window.enterVectorPenMode());
  for (const p of pts) await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => { const v = document.querySelector('#canvas .section-block .vector-block'); return v ? JSON.parse(v.dataset.penNodes || '[]').length : 0; }), '★섹션 안 = 흐름 펜 벡터').toBe(3);
  expect((await counts(page)).scratch, '★스크래치 무변').toBe(c0.scratch);
  expect(errs, errs.join(' | ')).toEqual([]);
});

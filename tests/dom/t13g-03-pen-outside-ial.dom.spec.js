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

/* ★0.9.13 마감 채점 ◑(지디 261125 · 아이맥 GRADE-0913close-2 G03-02~04 · 판 dev 1cd189937) — 섹션 밖에 그린 선이 «섹션 안쪽 끝»으로 옮겨져 들어감(왼쪽 밖 → left 0 · 약 193px · 오른쪽 밖 → 섹션 오른끝 안)
 *   → 그린 자리 그대로 떠 있게(조임 없음 · 섹션 밖은 그 섹션 «섹션 밖 보이기»(Clip content)가 정한다 — 새 섹션 = 밖 보임 · editor.js 그라데이션 넣기와 같은 규약)
 *   P3 펜 왼쪽 밖 · 오른쪽 밖 = 벡터 상자가 그린 점들을 가로로 감싼다(±2px) · 왼쪽은 섹션 왼끝보다 왼쪽 · 저장 → 다시 열기 뒤에도 같은 자리
 *   P4 연필 왼쪽 밖 · 붓 오른쪽 밖 = 같은 규칙 */
const sideRect = (page, id) => page.evaluate((id) => { const v = document.getElementById(id); const r = v.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), clip: getComputedStyle(v.closest('[data-overlay-block="true"]') || v).clipPath }; }, id);
const sidePts = (page, side, n) => page.evaluate(([side, n]) => {
  const c = document.getElementById('canvas').getBoundingClientRect(), s = document.querySelector('#canvas .section-block').getBoundingClientRect();
  const w = document.getElementById('canvas-wrap').getBoundingClientRect();
  const x0 = side === 'left' ? c.left - 170 : c.right + 60, y0 = (Math.max(s.top, w.top) + Math.min(s.bottom, w.bottom)) / 2;   // 섹션의 «보이는» 세로 가운데(섹션이 위로 밀려 있어도 윗막대에 안 닿게)
  return Array.from({ length: n }, (_, i) => { const x = x0 + (110 * i) / Math.max(1, n - 1), y = y0 + 15 * Math.sin(i / 2); const el = document.elementFromPoint(x, y); return { x, y, out: !el?.closest('#canvas') && !!el?.closest('#canvas-wrap'), hit: el ? (el.id || String(el.className).slice(0, 40)) : null }; });
}, [side, n]);
const lastVecId = (page) => page.evaluate(() => { const v = [...document.querySelectorAll('#canvas .section-block .vector-block')].pop(); if (v && !v.id) v.id = 'vec_' + Math.random().toString(36).slice(2, 8); return v?.id || null; });
const reopenFile = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
function expectWraps(rect, pts, label) {
  const xs = pts.map((p) => p.x);
  expect(rect.l <= Math.min(...xs) + 2 && rect.r >= Math.max(...xs) - 2, `★${label} — 벡터 상자(${rect.l}~${rect.r})가 그린 점(${Math.round(Math.min(...xs))}~${Math.round(Math.max(...xs))})을 가로로 감싼다 = 그린 자리`).toBe(true);
}

test('P3 펜 섹션 왼쪽·오른쪽 밖 = 그린 자리 그대로(조임 없음) · 저장 → 다시 열기 뒤 같은 자리', async ({ page }) => {
  const errs = await scene(page, 1);
  const sec = await page.evaluate(() => { const r = document.getElementById('sP1').getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right) }; });
  const out = {};
  for (const side of ['left', 'right']) {
    const pts = await sidePts(page, side, 3);
    expect(pts.every((p) => p.out), `[전제] ${side} 세 점 = 캔버스 밖 · 캔버스 바탕 위`).toBe(true);
    await page.evaluate(() => window.enterVectorPenMode());
    for (const p of pts) await page.mouse.click(p.x, p.y);
    await page.keyboard.press('Enter');
    await expect.poll(() => vecIn(page).then((v) => v.length), `[전제] ${side} 벡터 생김`).toBe(side === 'left' ? 1 : 2);
    await page.evaluate(() => window.exitVectorPenMode?.());
    const id = await lastVecId(page), r = await sideRect(page, id);
    expectWraps(r, pts, `펜 ${side}`);
    if (side === 'left') expect(r.l < sec.l, `★왼쪽 밖 = 섹션 왼끝(${sec.l})보다 왼쪽(${r.l}) — 옛: left 0 으로 당겨짐`).toBe(true);
    else expect(r.r > sec.r, `★오른쪽 밖 = 섹션 오른끝(${sec.r})보다 오른쪽(${r.r}) — 옛: 섹션 안으로 당겨짐`).toBe(true);
    expect(r.clip, '[전제] 새 섹션 = 섹션 밖 보임(자르지 않음)').toBe('none');
    out[side] = { id, r };
  }
  await reopenFile(page);
  await waitStableRect(page, '#sP1');
  for (const side of ['left', 'right']) {
    const r = await sideRect(page, out[side].id);
    expect([r.l, r.r, r.t], `★저장 → 다시 열기 뒤 ${side} 같은 자리`).toEqual([out[side].r.l, out[side].r.r, out[side].r.t]);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P4 연필 왼쪽 밖 · 붓 오른쪽 밖 = 그린 자리 그대로', async ({ page }) => {
  const errs = await scene(page, 1);
  for (const [tool, side] of [['pencil', 'left'], ['brush', 'right']]) {
    const pts = await sidePts(page, side, 25);
    expect(pts.every((p) => p.out), `[전제] ${tool} 점 = 캔버스 밖 · 캔버스 바탕 위 ${JSON.stringify(pts.filter((p) => !p.out).map((p) => [Math.round(p.x), Math.round(p.y), p.hit]))}`).toBe(true);
    await page.evaluate((t) => window.enterFreehand(t), tool);
    await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y);
    await page.mouse.up();
    await expect.poll(() => vecIn(page).then((v) => v.length), `[전제] ${tool} 벡터 생김`).toBe(tool === 'pencil' ? 1 : 2);
    await page.evaluate(() => window.exitFreehand?.());
    expectWraps(await sideRect(page, await lastVecId(page)), pts, `${tool} ${side}`);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

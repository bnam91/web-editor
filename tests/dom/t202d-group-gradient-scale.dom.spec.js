/* t202d-group-gradient-scale.dom.spec.js — t2-02d: ⌘G 묶음 손잡이로 늘린 그라데이션이 «다음 렌더»에 옛 크기로 튀었다(300 → 360 → 300).
 * 뿌리: 묶음 손잡이(js/overlay-handles.js groupSnap)가 그라데이션을 상자로 보고 style 만 썼다 — 정본은 dataset(x·y·gradWidth·gradHeight)이고
 *   renderGradientBlock 이 cssText 를 그 키로 통째로 다시 쓴다. 고침 = window._scaleGradientFromSnap(js/blocks/gradient-block.js)이 모델 키로 늘린다.
 * 장면: 섹션 · 그라데이션 g1(140,100 300×200) · 떠 있는 사각 도형 160×100(40,40) — 그라데이션이 묶음 원점에서 떨어져 x·y 도 잰다 → 진짜 클릭·⌘클릭 → ⌘G → 손잡이 끌기 → 강제 다시 그리기.
 * 양성대조: 0d552c2f5 의 js 로 돌리면 D1·D2·D3·D4 빨강. 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const HANDLE = (d) => `#ss-handles-overlay .ss-resize-handle.${d}`;
const mid = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, sel);

async function grouped(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = [...c.querySelectorAll('.section-block')].pop(); sec.id = 'sG';
    sec.querySelector('.section-inner').insertAdjacentHTML('beforeend', '<div class="gap-block" id="gbG" data-type="gap" style="height:500px"></div>');
    window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate(() => {
    const sec = document.getElementById('sG');
    window.deselectAll(); window.selectSection(sec); window.addGradientBlock({ x: 140, y: 100, width: 300, height: 200 }).id = 'g1';
    window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.shape-block')); window.addShapeBlock('rectangle');
    const sh = [...sec.querySelectorAll('.shape-block')].find((x) => !b.has(x)); sh.id = 'sh1';
    const shf = sh.closest('.frame-block'); shf.id = 'shf'; window.updateFrameBlock?.(shf.id, { width: 160, height: 100 });
    const p = window.OverlayFloat.posElOf(shf); window.OverlayFloat.enterFloat(p); p.style.left = '40px'; p.style.top = '40px'; p.dataset.offsetX = '40'; p.dataset.offsetY = '40';
    window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  });
  let [x, y] = await mid(page, '#g1'); await page.mouse.click(x, y);
  await page.keyboard.down('Meta'); [x, y] = await mid(page, '#sh1'); await page.mouse.click(x, y); await page.keyboard.up('Meta');
  await page.keyboard.press('Meta+g');
  await page.locator(HANDLE('se')).waitFor({ state: 'attached' });
  const ok = await page.evaluate(() => { const g = document.getElementById('g1').closest('[data-group="true"]'); return !!g && document.getElementById('shf').closest('[data-group="true"]') === g; });
  expect(ok, '[전제] 둘이 한 묶음').toBe(true);
  return errs;
}
async function drag(page, sel, dx, dy) {
  const [x, y] = await mid(page, sel);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}
/** 묶음 기준 그려진 상자 [left, top, w, h](줌 100) · 그라데이션 정본 키 */
const read = (page) => page.evaluate(() => {
  const g = document.getElementById('g1').closest('[data-group="true"]'); const gr = g.getBoundingClientRect();
  const box = (e) => { const r = e.getBoundingClientRect(); return [r.left - gr.left, r.top - gr.top, r.width, r.height]; };
  const d = document.getElementById('g1').dataset;
  return { g: [gr.width, gr.height], g1: box(document.getElementById('g1')), shf: box(document.getElementById('shf')), d: [+d.x, +d.y, +d.gradWidth, +d.gradHeight] };
});
const rerender = (page) => page.evaluate(() => window.renderGradientBlock(document.getElementById('g1')));
function expectFollows(a, b, tag, ids = ['g1', 'shf']) {
  const sx = b.g[0] / a.g[0], sy = b.g[1] / a.g[1];
  for (const id of ids) [sx, sy, sx, sy].forEach((s, i) => expect(Math.abs(b[id][i] - a[id][i] * s), `${tag} ${id}[${i}] ${b[id][i]} vs ${a[id][i] * s}`).toBeLessThanOrEqual(1.5));
  b.d.forEach((v, i) => expect(Math.abs(v - b.g1[i]), `${tag} 정본 ${b.d} = 그린 상자 ${b.g1}`).toBeLessThanOrEqual(1));
}

for (const [n, dir, dx, dy] of [[1, 'se', 100, 60], [2, 'nw', -100, -60]]) {
  test(`D${n} ${dir} 손잡이 ${dx},${dy} — 강제 다시 그린 뒤에도 그라데이션이 묶음 비율대로`, async ({ page }) => {
    const errs = await grouped(page);
    const a = await read(page);
    await drag(page, HANDLE(dir), dx, dy);
    const mid1 = await read(page);
    await rerender(page);
    const b = await read(page);
    console.log(`[D${n}] ` + JSON.stringify({ a, mid1, b }));
    expect([b.g[0] - a.g[0], b.g[1] - a.g[1]], '묶음 +100,+60').toEqual([100, 60]);
    expectFollows(a, b, `D${n}`);
    expect(errs).toEqual([]);
  });
}

test('D3 ⌘Z 한 번이 정확히 되돌린다', async ({ page }) => {
  const errs = await grouped(page);
  const a = await read(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  let b;
  await expectOneUndoStep(page, async () => { await drag(page, HANDLE('se'), 100, 60); await rerender(page); b = await read(page); }, '묶음 손잡이 그라데이션');
  expectFollows(a, b, 'D3 끈 뒤');
  expect(await read(page), '⌘Z 뒤 = 끌기 전').toEqual(a);
  expect(errs).toEqual([]);
});

test('D4 저장 → 다시 열기 뒤 같은 상자', async ({ page }) => {
  const errs = await grouped(page);
  const a = await read(page);
  await drag(page, HANDLE('se'), 100, 60);
  const b = await read(page);
  await page.evaluate(async () => { window.deselectAll(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(d); });
  await page.waitForFunction(() => !!document.getElementById('g1')?.closest('[data-group="true"]'));
  const r = await read(page);
  expectFollows(a, r, 'D4 다시 연 뒤');
  expect(r, '다시 열어도 끈 직후와 같다').toEqual(b);
  expect(errs).toEqual([]);
});

test('C1 [대조] 같은 묶음의 도형은 바닥 길 그대로 비율대로', async ({ page }) => {
  const errs = await grouped(page);
  const a = await read(page);
  await drag(page, HANDLE('se'), 100, 60);
  await rerender(page);
  const b = await read(page);
  expectFollows(a, b, 'C1', ['shf']);
  expect(errs).toEqual([]);
});

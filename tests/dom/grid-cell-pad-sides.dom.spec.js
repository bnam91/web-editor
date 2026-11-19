/* grid-cell-pad-sides.dom.spec.js — GRID-ROW-PADDING-PER-SIDE-01 (현빈 B 261118) 칸 안쪽 여백 상·하·좌·우 따로
 *   실행: npx playwright test tests/dom/grid-cell-pad-sides.dom.spec.js
 *   모델: padding(한 값 = 네 변, 옛 꼴) · padSides [위,오른,아래,왼](있으면 이긴다). 묶음 여부 = padSides 가 있나.
 *   P1 옛 저장본(padding 만) — 칸 style 바이트 `padding:16px;` 그대로 · 패널 = 묶음(사슬 켬 · 한 칸)
 *   P2 사슬 풀기 = padSides [16×4] · 화면 무변 · 패널 = 네 칸
 *   P3 변마다 값 → 계산 스타일 네 변 · ⌘Z(undo) 한 번 = 마지막 한 변만 되돌림(편집 하나 = 히스토리 한 칸)
 *   P4 다시 묶기 = 위 값 한 값(padding) · padSides 지워짐
 *   P5 «모든 칸» 절도 같은 손잡이 — 풀고 한 변 바꾸면 모든 칸이 따른다
 *   P6 저장→다시 열기 — padSides·화면 유지
 *   양성대조: _patches/GRID-PADSIDES-CTL-render-ignores.patch(렌더러가 padSides 를 안 읽음) → P3 빨강
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const ADDR = { r: 1, c: 0, li: 0 };

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="pS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="row" id="pR" data-layout="stack"></div></div></div>');
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }],
      rows: [{ height: 'auto' }, { height: 'auto' }] });
    g.id = 'pG'; document.getElementById('pR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.applyZoom?.(100);
    window.updateGridBlock('pG', { patchCell: { r: 1, c: 0, lines: [{ type: 'body', text: 'C' }], padding: 16 } });
    window.clearHistory?.();
  });
  return errs;
}
const open = (page, addr) => page.evaluate((addr) => window.showGridProperties(document.getElementById('pG'), addr), addr);
const cellEl = '#pG .grd-cell[data-r="1"][data-c="0"]';
const read = (page) => page.evaluate((sel) => {
  const el = document.querySelector(sel); const cs = getComputedStyle(el);
  const cell = (JSON.parse(document.getElementById('pG').dataset.cells || '[]')[1] || [])[0] || {};
  return { css: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '),
    inlinePad: (el.getAttribute('style').match(/padding:[^;]*;/) || [''])[0],
    padding: cell.padding ?? null, padSides: cell.padSides ?? null };
}, cellEl);
const panel = (page, pre) => page.evaluate((pre) => ({
  chainOn: !!document.getElementById(`${pre}-pad-chain`)?.classList.contains('active'),
  one: !!document.getElementById(`${pre}-padding`),
  four: ['t', 'r', 'b', 'l'].filter(k => document.getElementById(`${pre}-pad-${k}`)).length,
}), pre);
const click = (page, id) => page.evaluate((id) => document.getElementById(id).click(), id);
const put = (page, id, v) => page.evaluate(([id, v]) => {
  const el = document.getElementById(id); el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, v]);

test('P1 옛 저장본 — padding 한 값 = 바이트 그대로 · 패널 묶음', async ({ page }) => {
  const errs = await scene(page);
  await open(page, ADDR);
  const s = await read(page);
  expect(s.inlinePad, '★옛 칸 style 바이트가 바뀌었다').toBe('padding:16px;');
  expect(s.css).toBe('16px 16px 16px 16px');
  expect(s.padSides).toBe(null);
  expect(await panel(page, 'grd-cell')).toEqual({ chainOn: true, one: true, four: 0 });
  expect(errs).toEqual([]);
});

test('P2~P4 풀기 → 변마다 → ⌘Z 한 칸 → 다시 묶기', async ({ page }) => {
  const errs = await scene(page);
  await open(page, ADDR);
  await click(page, 'grd-cell-pad-chain');
  await expect.poll(() => read(page).then(s => s.padSides)).toEqual([16, 16, 16, 16]);
  expect((await read(page)).css, '★풀기만 했는데 화면이 바뀌었다').toBe('16px 16px 16px 16px');
  await open(page, ADDR);
  expect(await panel(page, 'grd-cell')).toEqual({ chainOn: false, one: false, four: 4 });

  for (const [k, v] of [['t', '4'], ['r', '8'], ['b', '12'], ['l', '20']]) { await open(page, ADDR); await put(page, `grd-cell-pad-${k}`, v); }
  await expect.poll(() => read(page).then(s => s.css)).toBe('4px 8px 12px 20px');
  expect((await read(page)).padSides).toEqual([4, 8, 12, 20]);

  await page.evaluate(() => window.undo());
  await expect.poll(() => read(page).then(s => s.css), '★⌘Z 한 번이 «왼» 한 변만 되돌려야 한다(편집 하나 = 히스토리 한 칸)').toBe('4px 8px 12px 16px');

  await open(page, ADDR);
  await click(page, 'grd-cell-pad-chain');
  await expect.poll(() => read(page).then(s => [s.padding, s.padSides])).toEqual([4, null]);
  expect((await read(page)).css).toBe('4px 4px 4px 4px');
  await open(page, ADDR);
  expect(await panel(page, 'grd-cell')).toEqual({ chainOn: true, one: true, four: 0 });
  expect(errs).toEqual([]);
});

test('P5 «모든 칸» 절 — 풀고 위 변만 바꾸면 모든 칸이 따른다', async ({ page }) => {
  const errs = await scene(page);
  await open(page, null);
  expect(await panel(page, 'grd-cellall'), '[전제] 블럭만 고르면 «모든 칸» 절 · 묶음').toMatchObject({ chainOn: true, one: true });
  await put(page, 'grd-cellall-padding', '10');
  await open(page, null);
  await click(page, 'grd-cellall-pad-chain');
  await open(page, null);
  await expect.poll(() => panel(page, 'grd-cellall').then(p => p.four)).toBe(4);
  await put(page, 'grd-cellall-pad-t', '30');
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#pG .grd-cell')].map(el => getComputedStyle(el).paddingTop + '/' + getComputedStyle(el).paddingLeft)))
    .toEqual(['30px/10px', '30px/10px', '30px/10px', '30px/10px']);
  expect(errs).toEqual([]);
});

test('P6 저장→다시 열기 — padSides·화면 유지', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => window.updateGridBlock('pG', { patchCell: { r: 1, c: 0, padSides: [2, 6, 10, 14] } }));
  await expect.poll(() => read(page).then(s => s.css)).toBe('2px 6px 10px 14px');
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
  await expect.poll(() => page.evaluate((sel) => { const el = document.querySelector(sel); return el && getComputedStyle(el).paddingLeft; }, cellEl)).toBe('14px');
  expect(await read(page)).toMatchObject({ css: '2px 6px 10px 14px', padSides: [2, 6, 10, 14] });
  expect(errs).toEqual([]);
});

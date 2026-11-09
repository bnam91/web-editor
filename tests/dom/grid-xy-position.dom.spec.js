/* grid-xy-position.dom.spec.js — 현빈QA GRID-XY-POSITION
 *   그리드 X/Y = 에셋 X/Y 와 «같은 공용 부품»(js/overlay-float.js floatPositionRowHTML + wireFloatPosition · prefix 'grd').
 *   ★뜻도 에셋과 같다 — 오토레이아웃(흐름)에선 칸을 «안 낸다», 떠 있을 때만 섹션 기준 offsetX/Y 를 보이고 고친다.
 *   P1 흐름: 그리드·에셋 둘 다 X/Y 칸 없음 · 띄우면 둘 다 생기고 마크업 꼴이 같다(prefix 만 다름)
 *   P2 떠 있는 그리드: 칸이 지금 x/y 를 보인다 · 타이핑하면 그리드가 움직인다 · ⌘Z 한 번 = 타이핑 전 자리
 * ★제품코드 변경 없음(6c56d4620 에 이미 있다) — 대조는 wireFloatPosition 배선을 뺀 사본으로 P2 가 빨강인지 본다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="40" style="padding-left:40px;padding-right:40px">
      <div class="row" id="aR" data-layout="stack"><div class="asset-block" id="ab" data-overlay="false" style="width:300px;height:120px" data-size="100" data-base-height="120"><div class="asset-overlay"></div></div></div>
      <div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:500px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g);
  });
}
const xyShape = (prefix) => {
  const x = document.getElementById(prefix + '-x-number'); if (!x) return null;
  const row = x.closest('.prop-lhls-row');
  return { label: row.previousElementSibling?.className + ':' + row.previousElementSibling?.textContent,
    html: row.outerHTML.split(prefix + '-').join('P-').replace(/value="-?\d+"/g, 'value="N"').replace(/\s+/g, ' ') };
};
const showGrid = (page) => page.evaluate(() => { const g = document.getElementById('gG'); window.deselectAll?.(); window.selectBlock(g); window.showGridProperties(g); });
const showAsset = (page) => page.evaluate(() => { const a = document.getElementById('ab'); window.deselectAll?.(); window.selectBlock(a); window.showAssetProperties(a); });

test('P1 흐름에선 둘 다 X/Y 없음 · 띄우면 둘 다 같은 꼴로 생긴다', async ({ page }) => {
  await setup(page);
  await showAsset(page); await expect(page.locator('#asset-float-toggle')).toHaveCount(1);
  expect(await page.evaluate(xyShape, 'asset'), '에셋 — 흐름에선 X/Y 없음').toBeNull();
  await showGrid(page); await expect(page.locator('#grd-float-toggle')).toHaveCount(1);
  expect(await page.evaluate(xyShape, 'grd'), '그리드 — 흐름에선 X/Y 없음(에셋과 같다)').toBeNull();
  await page.click('#grd-float-toggle'); await expect(page.locator('#grd-x-number')).toHaveCount(1);
  const grid = await page.evaluate(xyShape, 'grd');
  await showAsset(page); await page.click('#asset-float-toggle'); await expect(page.locator('#asset-x-number')).toHaveCount(1);
  const asset = await page.evaluate(xyShape, 'asset');
  expect(asset.html).toContain('prop-icon-input');
  expect(grid).toEqual(asset);
});

test('P2 떠 있는 그리드 — 칸이 지금 x/y · 타이핑하면 움직인다 · ⌘Z 한 번', async ({ page }) => {
  await setup(page);
  await showGrid(page); await page.click('#grd-float-toggle');
  await expect(page.locator('#grd-x-number')).toHaveCount(1);
  const m0 = await page.evaluate(() => { const g = document.getElementById('gG'); return { x: g.dataset.offsetX, y: g.dataset.offsetY, left: g.style.left }; });
  expect(await page.locator('#grd-x-number').inputValue()).toBe(String(parseInt(m0.x) || 0));
  expect(await page.locator('#grd-y-number').inputValue()).toBe(String(parseInt(m0.y) || 0));
  await page.evaluate(() => window.clearHistory?.());
  await page.locator('#grd-x-number').fill('123');
  await page.locator('#grd-x-number').press('Enter');
  await expect.poll(() => page.evaluate(() => document.getElementById('gG').style.left)).toBe('123px');
  expect(await page.evaluate(() => document.getElementById('gG').dataset.offsetX)).toBe('123');
  await page.locator('#grd-x-number').blur();
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => document.getElementById('gG').dataset.offsetX)).toBe(m0.x);
});

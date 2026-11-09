/* grid-fullbleed-toggle-switch.dom.spec.js — 현빈QA GRID-FULLWIDTH-TOGGLE
 *   그리드 「좌우 패딩 제외 (전폭)」 체크박스 → 에셋 #asset-padx-toggle 과 같은 prop-toggle 스위치.
 *   S1 스위치 구조(라벨·입력·트랙 클래스)와 «라벨 왼쪽·스위치 오른쪽» 자리가 에셋 것과 같다
 *   S2 스위치를 누르면 전폭이 켜진다 · ⌘Z 한 번에 꺼진다
 * ★양성대조: prop-grid.js 를 6c56d4620 판으로 되돌리면 S1·S2 가 빨강(label.prop-toggle 이 없다). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const shape = (id) => {
  const inp = document.getElementById(id), lab = inp?.closest('label');
  if (!lab) return null;
  return {
    label: lab.className, input: inp.type, kids: [...lab.children].map(e => e.tagName + '.' + e.className),
    labelLeft: !!lab.previousElementSibling?.classList.contains('prop-label'),
  };
};

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sF" data-section="1"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="32" style="padding-left:32px;padding-right:32px">
      <div class="row" id="rF" data-layout="stack"><div class="asset-block" id="ab" data-overlay="false" style="width:300px;height:200px" data-size="100" data-base-height="200"><div class="asset-overlay"></div></div></div>
      <div class="row" id="rG" data-layout="stack"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gF'; document.getElementById('rG').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g);
  });
}

test('S1 스위치 구조·라벨 자리가 에셋 패딩 제외 스위치와 같다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.showAssetProperties(document.getElementById('ab')));
  await expect(page.locator('#asset-padx-toggle')).toHaveCount(1);
  const asset = await page.evaluate(shape, 'asset-padx-toggle');
  await page.evaluate(() => { const g = document.getElementById('gF'); window.selectBlock?.(g); window.showGridProperties(g); });
  await expect(page.locator('#grd-use-padx')).toHaveCount(1);
  const grid = await page.evaluate(shape, 'grd-use-padx');
  expect(asset, '전제 — 에셋 스위치 구조').toEqual({ label: 'prop-toggle', input: 'checkbox', kids: ['INPUT.', 'SPAN.prop-toggle-track'], labelLeft: true });
  expect(grid).toEqual(asset);
});

test('S2 스위치를 누르면 전폭 · ⌘Z 한 번에 원래대로', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { const g = document.getElementById('gF'); window.deselectAll?.(); window.selectBlock?.(g); window.showGridProperties(g); window.clearHistory?.(); });
  const sw = page.locator('label.prop-toggle:has(#grd-use-padx)');
  await sw.click();
  await expect.poll(() => page.evaluate(() => document.getElementById('gF').dataset.fullBleed)).toBe('true');
  expect(await page.evaluate(() => document.getElementById('gF').style.marginLeft)).toBe('-32px');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => document.getElementById('gF').dataset.fullBleed ?? 'false')).toBe('false');
  expect(await page.evaluate(() => document.getElementById('gF').style.marginLeft)).not.toBe('-32px');
});

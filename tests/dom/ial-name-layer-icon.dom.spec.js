/* ial-name-layer-icon.dom.spec.js — 0.9.13 186행 IAL-01 · 189행 IAL-05(현빈 승인 261122 · 시안 8910 «ial» 열)
 *   N1 IAL-01 — 띄우기 단추 = 이름 «Ignore Auto Layout»(aria-label · 툴팁) · 아이콘 = 네 모서리 괄호 + 작은 네모(옛 네모 둘 겹침 0)
 *   N2 IAL-05 — 켠 블럭의 레이어 아이콘 = 그 아이콘 + 네 모서리 괄호 · 안 켠 블럭 = 괄호 0 · 끄면 다시 0 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); window.addSection();
    window.addAssetBlock('standard'); window.addAssetBlock('standard');
    const [a, b] = [...document.querySelectorAll('#canvas .asset-block')]; window.deselectAll(); window.showAssetProperties(a); return [a.id, b.id];
  });
  return { errs, ids };
}
const layerIcon = (page, id) => page.evaluate((i) => {
  window.buildLayerPanel();
  const el = document.getElementById(i);
  const item = [...document.querySelectorAll('#layer-panel-body .layer-item, #layer-panel-body .layer-row-header')].find((x) => { const t = x._dragTarget || x.parentElement?._dragTarget; return t && (t === el || t.contains(el)) && !x.querySelector('.layer-item'); });
  const ic = item && item.querySelector('svg');
  return ic ? { ial: ic.dataset.ial || null, brackets: !!ic.querySelector('.layer-ial-brackets'), rowIal: item.getAttribute('data-ial') } : null;
}, id);

test('N1 IAL-01 띄우기 단추 — 이름·툴팁 «Ignore Auto Layout» · 괄호 아이콘', async ({ page }) => {
  const { errs } = await scene(page);
  const b = await page.evaluate(() => { const x = document.getElementById('asset-float-toggle'); const p = x?.querySelector('svg path'); return x && { aria: x.getAttribute('aria-label'), title: x.title, d: p?.getAttribute('d') || '', oldRects: x.querySelectorAll('svg rect').length }; });
  expect(b, '[전제] 에셋 띄우기 단추가 있다').not.toBeNull();
  expect(b.aria).toBe('Ignore Auto Layout');
  expect(b.title.startsWith('Ignore Auto Layout'), `툴팁 «${b.title.slice(0, 30)}»`).toBe(true);
  expect(b.d.startsWith('M1 3.5V1h2.5'), '네 모서리 괄호 path').toBe(true);
  expect(b.oldRects, '네모는 하나(옛 = 둘 겹침)').toBe(1);
  expect(errs).toEqual([]);
});

test('N2 IAL-05 켠 블럭 레이어 아이콘 = 괄호 · 안 켠 블럭 0 · 끄면 0', async ({ page }) => {
  const { errs, ids: [a, b] } = await scene(page);
  expect(await layerIcon(page, a), '[전제] 켜기 전 = 괄호 0').toMatchObject({ brackets: false });
  await page.click('#asset-float-toggle');
  await expect.poll(() => page.evaluate((i) => { const ab = document.getElementById(i); return !!ab.closest('[data-overlay-block="true"]') || ab.dataset.overlayBlock === 'true'; }, a), { message: '[전제] 띄워졌다' }).toBe(true);
  expect(await layerIcon(page, a), '★켠 블럭 아이콘에 네 모서리 괄호').toMatchObject({ ial: '1', brackets: true, rowIal: '1' });
  expect(await layerIcon(page, b), '안 켠 블럭은 괄호 0').toMatchObject({ brackets: false });
  await page.evaluate((i) => window.showAssetProperties(document.getElementById(i)), a);
  await page.click('#asset-float-toggle');
  await expect.poll(() => layerIcon(page, a).then((x) => x && x.brackets), { message: '끄면 괄호 0' }).toBe(false);
  expect(errs).toEqual([]);
});

/* block-convert-207.dom.spec.js — 0.9.13 207행 BLOCK-CONVERT-RECT-ASSET-FRAME-01 ⓐ(현빈 GO 261123 · 지디 Q1 = 가 · Q2 = 입구 없음).
 *   W1 우클릭 «프레임으로 감싸기 ⌥⌘G» = 새 프레임이 감쌈(사각형은 그대로 안에) · ⌘Z 한 칸
 *   A1 에셋 Fill 칠 종류 «단색» = 같은 자리 사각형 · 그림은 사각형 이미지 칠 · 크기·테두리·모서리·이름 유지 · 확인창 없음 · ⌘Z 한 칸
 *   D1 이미지 파일을 사각형 위에 놓기 = 사각형 그대로(칠 무변) + 새 이미지 블럭
 *   (Q2 — 프레임 → 사각형/에셋 입구 없음 = 잴 것 없음.) */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(() => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); window.addSection(); });
  return errs;
}
const undo = async (page) => { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); };

test('W1 우클릭 «프레임으로 감싸기 ⌥⌘G» — 새 프레임이 사각형을 감싼다 · ⌘Z 한 칸', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { window.addShapeBlock('rectangle'); });
  const id = await page.evaluate(() => document.querySelector('#canvas .shape-block').id);
  const r = await waitStableRect(page, '#' + id);
  await page.mouse.click(r.cx, r.cy, { button: 'right' });
  await expect(page.locator('#bcm-wrap-frame'), '[새 것] 우클릭 메뉴에 «프레임으로 감싸기» 가 없다').toBeVisible();
  const n0 = await page.evaluate(() => document.querySelectorAll('#canvas .frame-block').length);
  await page.locator('#bcm-wrap-frame').click();
  const after = await page.evaluate((i) => { const s = document.getElementById(i); const wrap = s.closest('.frame-block'); const outer = wrap?.parentElement?.closest('.frame-block');
    return { n: document.querySelectorAll('#canvas .frame-block').length, shapeAlive: !!s, outerHasShape: !!outer && outer.contains(s), shapeImg: s.dataset.shapeImage || null }; }, id);
  expect(after.n, '[새 것] 프레임이 하나 늘어야 한다(감싸기)').toBe(n0 + 1);
  expect(after.outerHasShape, '[새 것] 새 프레임 안에 사각형이 그대로 있다').toBe(true);
  await undo(page);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .frame-block').length), { message: '⌘Z 한 번 = 감싸기 전' }).toBe(n0);
  expect(errs).toEqual([]);
});

test('A1 에셋 Fill 칠 종류 «단색» — 같은 자리 사각형 · 그림 = 이미지 칠 · 크기·테두리·모서리·이름 유지 · ⌘Z 한 칸', async ({ page }) => {
  const errs = await scene(page);
  const id = await page.evaluate((png) => {
    window.addAssetBlock('standard');
    const ab = document.querySelector('#canvas .asset-block');
    const img = document.createElement('img'); img.className = 'asset-img'; img.src = png; ab.appendChild(img); ab.classList.add('has-image');
    ab.dataset.strokeWidth = '3'; ab.dataset.strokeColor = '#ff0000'; ab.style.borderRadius = '12px'; ab.dataset.layerName = '내 그림';
    return ab.id;
  }, PNG);
  const before = await page.evaluate((i) => { const ab = document.getElementById(i); return { w: ab.offsetWidth, h: ab.offsetHeight, parent: ab.parentElement.id || ab.parentElement.className }; }, id);
  await page.evaluate((i) => { window.deselectAll(); window.showAssetProperties(document.getElementById(i)); }, id);
  await expect(page.locator('#asset-fill-kind'), '[새 것] 에셋 Fill 에 칠 종류가 없다').toHaveCount(1);
  let dialog = false; page.on('dialog', (d) => { dialog = true; d.dismiss(); });
  await page.selectOption('#asset-fill-kind', 'solid');
  const r = await page.evaluate((i) => { const s = document.querySelector('#canvas .shape-block'); const ss = s && s.closest('.frame-block');
    return { assetGone: !document.getElementById(i), shape: !!s, img: s?.dataset.shapeImage || null, fill: s?.dataset.shapeFill || null, w: ss?.offsetWidth, h: ss?.offsetHeight,
      radius: ss?.dataset.radius || null, sw: s?.dataset.shapeStrokeWidth, sc: s?.dataset.shapeStrokeColor, name: ss?.dataset.layerName, parent: ss?.parentElement.id || ss?.parentElement.className }; }, id);
  expect(r.assetGone, '에셋이 사각형으로 바뀌었다(에셋은 없다)').toBe(true);
  expect(r.shape).toBe(true);
  expect([r.img, r.fill], '그림 = 사각형 이미지 칠(버리지 않음)').toEqual(['1', 'image']);
  expect([r.w, r.h], '크기 그대로').toEqual([before.w, before.h]);
  expect([r.radius, r.sw, r.sc, r.name], '모서리·테두리·이름 그대로').toEqual(['12', '3', '#ff0000', '내 그림']);
  expect(r.parent, '같은 자리(같은 부모)').toBe(before.parent);
  expect(dialog, '확인창 없음').toBe(false);
  await undo(page);
  await expect.poll(() => page.evaluate((i) => !!document.getElementById(i), id), { message: '⌘Z 한 번 = 에셋 그대로' }).toBe(true);
  expect(errs).toEqual([]);
});

test('D1 이미지 파일을 사각형 위에 놓기 — 사각형 칠 무변 + 새 이미지 블럭', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { window.addShapeBlock('rectangle'); });
  const id = await page.evaluate(() => document.querySelector('#canvas .shape-block').id);
  const n0 = await page.evaluate(() => document.querySelectorAll('#canvas .asset-block').length);
  await page.evaluate(async ([i, png]) => {
    const bin = atob(png.split(',')[1]); const u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);   // fetch(data:) 는 CSP 로 막힘
    const file = new File([u8], 'x.png', { type: 'image/png' });
    const dt = new DataTransfer(); dt.items.add(file);
    const el = document.getElementById(i); const r = el.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    el.dispatchEvent(new DragEvent('dragover', o)); el.dispatchEvent(new DragEvent('drop', o));
  }, [id, PNG]);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .asset-block').length), { message: '[새 것] 새 이미지 블럭이 안 생겼다' }).toBe(n0 + 1);
  const s = await page.evaluate((i) => { const b = document.getElementById(i); return { alive: !!b, img: b?.dataset.shapeImage || null, fill: b?.dataset.shapeFill || null }; }, id);
  expect(s, '사각형은 그대로(칠 무변)').toEqual({ alive: true, img: null, fill: null });
  expect(errs).toEqual([]);
});

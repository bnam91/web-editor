/* grid-img-panel-height.dom.spec.js — ② panel-height-disable (2026-10-06 · APPROVED_BY: 지디 panel-height-disable)
 *
 * 병(실측 10-06 B1 · hbits.log): E157 뒤 크롭 없는 그림 줄은 height 를 «그릴 때 무시»한다. 그런데 패널 「높이(px)」 칸은
 *   gridPreviewLine 으로 height 를 «저장»했다 — 화면 645→645 그대로 · dataset height:300. 말없는 무동작.
 * 처방 ⒤(지디): 크롭 없는 줄이면 칸을 «막고» 까닭을 보이게 적는다(말풍선 상하 여백 칸 선례 — prop-text-template.js txt-pv-bubble-hint).
 *   ⛔⒥(크롭 길로 커밋)는 새 동작 — 다음 판.
 * 머리표: [새 것] 80f98bd7 에서 빨강 · [음성대조]/[회귀 지킴] 80f98bd7 에서도 초록 · [전제]. 예측 = reports/I15/FIX25/predict-panel-height.md. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const REASON = '자르기 전에는 높이를 정할 수 없습니다 — 그림 비율로 그려집니다';
async function scene(page, line) {
  await page.setViewportSize({ width: 1500, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async (ln) => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300; const x = cv.getContext('2d'); x.fillStyle = '#3366cc'; x.fillRect(0, 0, 400, 300);
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sP" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="sP-in"></div></div>');
    const { row, block } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ ...ln, imgSrc: cv.toDataURL('image/png') }] }] });
    block.id = 'gP'; document.getElementById('sP-in').appendChild(row); window.rebindAll?.(); window.applyZoom?.(100);
    window.grdSetActiveLine?.(block, { r: 0, c: 0, li: 0 }); window.showGridProperties?.(block, { r: 0, c: 0, li: 0 });
  }, line);
  await page.waitForFunction(() => [...document.querySelectorAll('#gP img')].every(i => i.complete && i.naturalWidth > 0));
  await page.waitForTimeout(150);
  return errs;
}
const field = (page) => page.evaluate(() => {
  const i = document.getElementById('grd-img-height'), h = document.getElementById('grd-img-height-hint');
  return { has: !!i, disabled: i ? i.disabled : null, hint: h ? { text: h.textContent.trim(), shown: !!h.offsetParent } : null };
});
const frameH = (page) => page.evaluate(() => document.querySelector('#gP .grd-img-frame').offsetHeight);

test('P0 [전제] 크롭 없는 그림 줄의 패널에 「높이(px)」 칸이 있다', async ({ page }) => {
  const errs = await scene(page, { type: 'image' });
  expect((await field(page)).has).toBe(true);
  expect(errs).toEqual([]);
});

test('P1 [새 것] 크롭 없는 줄 — 칸이 막히고 까닭이 보인다', async ({ page }) => {
  const errs = await scene(page, { type: 'image', height: 200 });
  const f = await field(page);
  expect(f.disabled, '★크롭 없는 줄인데 「높이(px)」 칸이 열려 있다 — 넣어도 화면이 안 바뀌는(저장만 되는) 칸').toBe(true);
  expect(f.hint, '★막은 까닭이 안 보인다').toEqual({ text: REASON, shown: true });
  expect(errs).toEqual([]);
});

test('P2 [음성대조] 크롭된 줄 — 칸이 살아 있고 300 을 넣으면 틀이 300', async ({ page }) => {
  const errs = await scene(page, { type: 'image', height: 200, imgSizePct: 120, imgPosX: -10, imgPosY: -10 });
  const f = await field(page);
  expect([f.disabled, f.hint], '★크롭된 줄의 칸까지 막았다').toEqual([false, null]);
  await page.evaluate(() => { const i = document.getElementById('grd-img-height'); i.value = '300'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(250);
  expect(await frameH(page), '★크롭된 줄에 300 을 넣었는데 틀이 안 바뀌었다').toBe(300);
  expect(errs).toEqual([]);
});

test('P3 [회귀 지킴] 원 그림 줄 — 「지름(px)」 칸은 살아 있다', async ({ page }) => {
  const errs = await scene(page, { type: 'image', imgShape: 'circle', height: 120 });
  const f = await field(page);
  expect([f.disabled, f.hint], '★원 그림 줄의 지름 칸을 막았다(원은 height 를 지름으로 읽는다)').toEqual([false, null]);
  expect(errs).toEqual([]);
});

/* eyedropper-grid-cell-bg.dom.spec.js — 0912 GRID-CELL-BG-EYEDROPPER-I-NOT-WORKING-01
 * 「그리드블럭 칸에 배경색을 지정하려고 스포이드를 누르면 안 된다」
 * 뿌리 둘:
 *   B 피커(공용 color-picker.js) 스포이드 단추가 input 만 쏘고 change(commit)를 안 쏜다 → «change 에서만 커밋»하는
 *     그리드 칸 배경은 견본만 칠하고 모델에 안 들어갔다.
 *   K i 단축키(editor.js)에 그리드 «칸» 갈래가 없었다(텍스트·쉐이프·프레임·섹션만).
 * 장면: 섹션 → Grid 단추 → 블럭을 진짜 클릭으로 고름 → 칸(0,0) 주소는 grdSetActiveLine+showGridProperties(캔버스 둘째 클릭과 같은 두 문).
 *   EyeDropper 는 OS 창이라 대역(고른 색을 돌려준다)을 부팅 전에 심는다(eyedropper-frame-t707 와 같은 꼴).
 * 양성대조: B — color-picker.js 스포이드의 `{ commit: true }` 를 지우면 B 빨강(모델 bg 없음).
 *          K — editor.js 의 `gridCell` 갈래를 지우면 K 빨강(모델 bg 없음).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const PICK = '#12ab34';
const SEC = '[id="secT"]';
const SEC_HTML = '<div class="section-block" id="secT" style="position:relative;height:460px;background:#f4f4f6"><div class="section-inner"></div></div>';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.addInitScript((pick) => {
    window.EyeDropper = class { open() { window.__eyeOpened = (window.__eyeOpened || 0) + 1; return Promise.resolve({ sRGBHex: pick }); } };
  }, PICK);
  const errs = await bootApp(page);
  await page.evaluate((html) => { document.getElementById('canvas').innerHTML = html; window.rebindAll?.(); window.applyZoom?.(100); }, SEC_HTML);
  const r = await waitStableRect(page, SEC);
  await clickAt(page, r.left + r.width * 0.9, r.top + r.height * 0.9, { sel: SEC }, { label: '섹션 고르기' });
  await page.click('#fp-grid-btn');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#secT .grid-block').length)).toBe(1);
  /* 블럭 고르기 = 진짜 클릭(첫 클릭은 언제나 블럭 선택) */
  const gb = await waitStableRect(page, '#secT .grid-block');
  await page.evaluate(() => window.deselectAll?.());
  await clickAt(page, gb.left + gb.width / 2, gb.top + gb.height / 2, { sel: '#secT .grid-block' }, { label: '그리드 고르기' });
  await expect.poll(() => page.evaluate(() => document.querySelector('#secT .grid-block').classList.contains('selected'))).toBe(true);
  /* 칸(0,0) — 줄 없음(li:null) */
  await page.evaluate(() => {
    const b = document.querySelector('#secT .grid-block');
    const a = { r: 0, c: 0, li: null };
    window.grdSetActiveLine(b, a);
    window.showGridProperties(b, a);
    document.activeElement?.blur?.();
  });
  await expect(page.locator('#grd-cell-bg')).toHaveCount(1);
  return errs;
}
const cellBg = (page) => page.evaluate(() => {
  const b = document.querySelector('#secT .grid-block');
  return window.getGridModel(b).cells?.[0]?.[0]?.bg ?? null;
});
const secBg = (page) => page.evaluate(() => document.getElementById('secT').dataset.bg ?? null);

test('B 칸 배경 견본 → 피커 스포이드 단추 → 칸 배경이 모델에 들어간다', async ({ page }) => {
  const errs = await setup(page);
  expect(await cellBg(page), '전제: 칸 배경 없음').toBeFalsy();
  if (!(await page.locator('#grd-cell-bg').isVisible())) await page.click('#grd-cell-toggle');
  await page.locator('.prop-color-swatch:has(#grd-cell-bg)').click();
  const dropper = page.locator('.goya-cp-popover:not([hidden]) [data-el="dropper"]');
  await expect(dropper).toBeVisible();
  await dropper.click();
  await expect.poll(() => page.evaluate(() => window.__eyeOpened || 0)).toBe(1);
  await expect.poll(() => cellBg(page), '칸 모델 bg').toBeTruthy();
  const got = await cellBg(page);
  console.log('[B] 칸 bg = ' + got);
  /* 피커는 HSV 를 거쳐 다시 hex 로 낸다 — 채널마다 ±1 */
  const ch = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  ch(got).forEach((v, i) => expect(Math.abs(v - ch(PICK)[i]), `채널 ${i}`).toBeLessThanOrEqual(1));
  expect(errs).toEqual([]);
});

test('K 칸을 고른 채 i → 그 칸 배경 = 고른 색 · 섹션 배경은 그대로', async ({ page }) => {
  const errs = await setup(page);
  const sec0 = await secBg(page);
  await page.keyboard.press('i');
  await expect.poll(() => page.evaluate(() => window.__eyeOpened || 0)).toBe(1);
  await expect.poll(() => cellBg(page), '칸 모델 bg').toBe(PICK);
  expect(await secBg(page), '섹션 배경은 안 바뀐다').toBe(sec0);
  expect(errs).toEqual([]);
});

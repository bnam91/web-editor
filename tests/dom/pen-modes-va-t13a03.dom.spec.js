/* pen-modes-va-t13a03.dom.spec.js — t13A-03 1단계: 펜툴 선택/앵커 편집 모드 전환 (Illustrator V/A)
 *   M1 V 출구(penToolExitToSelect — V 키는 공용 «도구 모드 끝» 명부(t13A-08)가 부른다 · 여기선 출구 함수를 부른다): 그리던 앵커 3 → 벡터 1 확정 · 펜 꺼짐
 *   M2 그리는 중 A → 확정 + 그 벡터 앵커 편집 · 에셋 메뉴 안 열림
 *   M3 펜 벡터 하나 고르고 A → 앵커 편집 · 에셋 메뉴 안 열림
 *   M4 [음성대조] 아무것도 안 고르고 A → 에셋 메뉴(기존 그대로) · 편집 아님
 *   M5 [음성대조] 펜 데이터 없는 벡터(SVG 들여오기 꼴) 고르고 A → 에셋 메뉴 · 편집 아님
 *   M6 편집 중 캔버스 빈 곳 누르기 → 편집 끝
 *   M7 펜 벡터 더블클릭 → 앵커 편집
 *   M8 펜 그리는 중 맨 V(진짜 키 · 공용 명부 js/tool-modes.js → 펜 출구) → 확정 + 펜 끔(선택 커서) · 에셋 메뉴·편집 아님
 *     양성대조(_patches/T13A03-CTL3-v.patch): registerToolModeExit('pen') 줄을 빼면 M8 빨강.
 *   양성대조(_patches/T13A03-CTL.patch): editor.js 문맥 A 줄 · 바깥 누르기 리스너 · 더블클릭 · 출구의 확정을 빼면 M1·M2·M3·M6·M7 빨강 · M4·M5 초록.
 *   키·마우스 = 진짜 입력. ⛔고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    document.getElementById('canvas').innerHTML = '<div class="section-block" id="secA" style="position:relative;height:520px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.(); window.clearHistory?.(); window.applyZoom?.(100); window.deselectAll?.();
    document.getElementById('secA').scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  return { errs, sr: await waitStableRect(page, '#secA') };
}
const st = (page) => page.evaluate(() => ({
  pen: document.body.classList.contains('vpen-mode'),
  edit: document.body.classList.contains('vpen-edit-mode'),
  asset: document.getElementById('fp-asset-dropdown')?.classList.contains('open') === true,
  vec: document.querySelectorAll('#secA .vector-block').length,
  penVec: document.querySelectorAll('#secA .vector-block[data-pen-nodes]').length,
}));
async function drawThree(page, sr) {
  await page.mouse.move(sr.left + sr.width * 0.5, sr.top + sr.height * 0.5);
  await page.keyboard.press('p');
  await expect.poll(() => st(page).then((s) => s.pen), '[전제] 펜 모드').toBe(true);
  const y = sr.top + sr.height * 0.3;
  for (const f of [0.2, 0.5, 0.8]) await page.mouse.click(sr.left + sr.width * f, y + (f === 0.5 ? sr.height * 0.1 : 0));
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#secA .vpen-preview rect').length), '[전제] 앵커 3').toBe(3);
}
async function makePenVector(page, sr) {
  await drawThree(page, sr);
  await page.keyboard.press('Enter');
  await expect.poll(() => st(page).then((s) => s.penVec), '[전제] 펜 벡터 1').toBe(1);
  await page.keyboard.press('Escape');
  await expect.poll(() => st(page).then((s) => s.pen), '[전제] 펜 끔').toBe(false);
  await page.evaluate(() => window.deselectAll?.());
}
async function clickBlock(page, sel, dbl = false) {
  const r = await waitStableRect(page, sel);
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  if (dbl) await page.mouse.dblclick(x, y); else await page.mouse.click(x, y);
}

test('M1 V 출구 — 그리던 앵커 3 이 벡터 1 로 확정되고 펜이 꺼진다', async ({ page }) => {
  const { errs, sr } = await setup(page);
  await drawThree(page, sr);
  const made = await page.evaluate(() => window.penToolExitToSelect().classList.contains('vector-block'));
  expect(made, '출구가 확정한 블럭을 돌려준다').toBe(true);
  expect(await st(page)).toEqual({ pen: false, edit: false, asset: false, vec: 1, penVec: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M2 그리는 중 A — 확정 + 그 벡터 앵커 편집 · 에셋 메뉴 안 열림', async ({ page }) => {
  const { errs, sr } = await setup(page);
  await drawThree(page, sr);
  await page.keyboard.press('a');
  expect(await st(page)).toEqual({ pen: false, edit: true, asset: false, vec: 1, penVec: 1 });
  expect(await page.evaluate(() => document.querySelector('#secA .vector-block').classList.contains('pen-editing')), '편집 대상 = 방금 그 벡터').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M3 펜 벡터 고르고 A — 앵커 편집 · 에셋 메뉴 안 열림', async ({ page }) => {
  const { errs, sr } = await setup(page);
  await makePenVector(page, sr);
  await clickBlock(page, '#secA .vector-block');
  await expect.poll(() => page.evaluate(() => document.querySelector('#secA .vector-block').classList.contains('selected')), '[전제] 골라짐').toBe(true);
  await page.keyboard.press('a');
  expect(await st(page)).toEqual({ pen: false, edit: true, asset: false, vec: 1, penVec: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M4 [음성대조] 아무것도 안 고르고 A — 에셋 메뉴 그대로', async ({ page }) => {
  const { errs, sr } = await setup(page);
  await makePenVector(page, sr);
  await page.keyboard.press('a');
  expect(await st(page)).toEqual({ pen: false, edit: false, asset: true, vec: 1, penVec: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M5 [음성대조] 펜 데이터 없는 벡터 고르고 A — 에셋 메뉴 그대로', async ({ page }) => {
  const { errs } = await setup(page);
  await page.evaluate(() => {
    window.selectSection?.(document.getElementById('secA'));
    window.addVectorBlock('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="120" height="120"><circle cx="20" cy="20" r="18"/></svg>', { w: 120, h: 120, label: 'SVG' });
    window.deselectAll?.();
  });
  await clickBlock(page, '#secA .vector-block');
  await expect.poll(() => page.evaluate(() => document.querySelector('#secA .vector-block').classList.contains('selected')), '[전제] 골라짐').toBe(true);
  await page.keyboard.press('a');
  expect(await st(page)).toEqual({ pen: false, edit: false, asset: true, vec: 1, penVec: 0 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M6 편집 중 캔버스 빈 곳 누르기 — 편집 끝', async ({ page }) => {
  const { errs, sr } = await setup(page);
  await drawThree(page, sr);
  await page.keyboard.press('a');
  await expect.poll(() => st(page).then((s) => s.edit), '[전제] 편집').toBe(true);
  await page.mouse.click(sr.left + sr.width * 0.9, sr.top + sr.height * 0.9);
  expect(await st(page)).toEqual({ pen: false, edit: false, asset: false, vec: 1, penVec: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M7 펜 벡터 더블클릭 — 앵커 편집', async ({ page }) => {
  const { errs, sr } = await setup(page);
  await makePenVector(page, sr);
  await clickBlock(page, '#secA .vector-block', true);
  expect(await st(page)).toEqual({ pen: false, edit: true, asset: false, vec: 1, penVec: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M8 펜 그리는 중 맨 V — 확정 + 펜 끔(선택 커서)', async ({ page }) => {
  const { errs, sr } = await setup(page);
  await drawThree(page, sr);
  await page.keyboard.press('v');
  expect(await st(page)).toEqual({ pen: false, edit: false, asset: false, vec: 1, penVec: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

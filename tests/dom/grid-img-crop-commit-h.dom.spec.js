/* grid-img-crop-commit-h.dom.spec.js — E2/E3 ⒜ (2026-10-06 · APPROVED_BY: 지디 E2E3-crop-a): 그리드 그림 크롭 편집기가
 *   «열 때 height 를 혼자 쓰지 않고», «커밋 때 크롭 세 값 + height:H(커밋 직전에 잰 보이는 틀 높이)»를 한 patch 로 쓴다.
 *
 * 병(E157 뒤 · 실측 10-06 meas.log): E157 이 «크롭 없는 그림 줄은 height 를 그릴 때 무시»로 바꾸자
 *   E3 — 높이 키 없는 줄: 여는 길의 {height} 혼자 patch 가 T-122 가드에 INVALID → 편집기가 «말없이 안 열림»(0ff05430 은 열림).
 *   E2 — 옛 height 200 이 남은 크롭 없는 줄: 보이는 틀 498 → 끌어 커밋하면 크롭 줄이 되어 200 으로 튐(0ff05430: 200 → 200).
 * 처방 ⒜ 조건(지디): H 는 «커밋 직전»에 다시 잰다(열 때 쥔 값 금지 — A4 가 음성대조) · 열고 아무것도 안 하고 닫으면 문서 바이트 그대로(A3).
 * 길: bootApp(앱 통째 · 줌 있음) → enterGridImageEditMode(앱이 쓰는 같은 함수) → 진짜 마우스로 프록시 끌기 → Escape.
 * 머리표: [새 것] dbf40249 에서 빨강 · [회귀 지킴] dbf40249 에서도 초록 · [전제] 재기 위한 조건. 예측 = reports/I15/FIX25/predict-E2E3.md. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, line) {
  await page.setViewportSize({ width: 1500, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async (ln) => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300;
    const x = cv.getContext('2d'); x.fillStyle = '#3366cc'; x.fillRect(0, 0, 400, 300); x.fillStyle = '#ffcc00'; x.fillRect(40, 30, 160, 120);
    const src = cv.toDataURL('image/png');
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sC" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="sC-in"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    const { row, block } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ ...ln, imgSrc: src }] }] });
    block.id = 'gC'; document.getElementById('sC-in').appendChild(row);
    window.rebindAll?.(); window.applyZoom?.(100); window.deselectAll?.();
    const toasts = []; const o = window.showToast; window.__t = toasts; window.showToast = function (m, ...r) { toasts.push(String(m)); return o?.call(this, m, ...r); };
  }, line);
  await page.waitForFunction(() => [...document.querySelectorAll('#gC img')].every(i => i.complete && i.naturalWidth > 0));
  await page.waitForTimeout(200);
  return errs;
}
const frameH = (page) => page.evaluate(() => document.querySelector('#gC .grd-img-frame').offsetHeight);   // 레이아웃 px(줌 무관)
const ds = (page) => page.evaluate(() => { const g = document.getElementById('gC'); return JSON.stringify({ cols: g.dataset.cols, cells: g.dataset.cells || null }); });
const lineOf = (page) => page.evaluate(() => window.getGridModel(document.getElementById('gC')).cells[0][0].lines[0]);
async function open(page) {
  await page.evaluate(() => { document.querySelector('#gC .grd-img-frame').scrollIntoView({ block: 'center' }); window.enterGridImageEditMode(document.getElementById('gC'), { r: 0, c: 0, li: 0 }); });
  return page.waitForFunction(() => document.querySelectorAll('.img-corner-handle').length > 0, null, { timeout: 5000 }).then(() => true, () => false);
}
async function drag(page) {
  const box = await page.locator('.grd-img-edit-proxy img.asset-img').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2 - 16, { steps: 8 }); await page.mouse.up();
}
async function close(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.grd-img-edit-proxy').length === 0, null, { timeout: 5000 });
  await page.waitForTimeout(200);
}

test('A0 [전제] h200 키가 남은 크롭 없는 줄 — 보이는 틀은 그림 비율(≠200)', async ({ page }) => {
  const errs = await scene(page, { type: 'image', height: 200 });
  const h0 = await frameH(page);
  expect(h0, '[전제] 틀이 비율 높이가 아니다 — 이 파일의 E2 축이 안 선다').not.toBe(200);
  expect(h0).toBeGreaterThan(100);
  expect(errs).toEqual([]);
});

test('A1 [새 것·E3] 높이 키 없는 줄 — 편집기가 열린다(말없이 안 열리던 것)', async ({ page }) => {
  const errs = await scene(page, { type: 'image' });
  expect(await open(page), '★편집기가 안 열렸다 — 여는 길이 height 를 혼자 쓰다 거절당했나').toBe(true);
  expect(errs).toEqual([]);
});

test('A2 [새 것·E2] h200 줄을 끌어 크롭하면 틀이 «보이던 높이» 그대로 · 모델 height = 그 높이', async ({ page }) => {
  const errs = await scene(page, { type: 'image', height: 200 });
  const h0 = await frameH(page);
  expect(await open(page), '[전제] 열림').toBe(true);
  await drag(page); await close(page);
  const ln = await lineOf(page);
  expect(Number.isFinite(Number(ln.imgSizePct)), '[전제] 크롭이 커밋됐다').toBe(true);
  expect(Math.abs((await frameH(page)) - h0), `★틀이 튀었다 ${h0} → ${await frameH(page)}`).toBeLessThanOrEqual(1);
  expect(Math.abs(Number(ln.height) - h0), `★모델 height 가 보이던 높이가 아니다 ${JSON.stringify(ln.height)} vs ${h0}`).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

for (const [nm, line] of [['h200 줄', { type: 'image', height: 200 }], ['높이 키 없는 줄', { type: 'image' }]]) {
  test(`A3 [새 것·숨은 이득] ${nm} — 열고 아무것도 안 하고 닫으면 문서(dataset) 바이트 그대로`, async ({ page }) => {
    const errs = await scene(page, line);
    const d0 = await ds(page);
    expect(await open(page), '[전제] 열림').toBe(true);
    await close(page);
    expect(await ds(page), '★열고 닫기만 했는데 문서가 바뀌었다').toBe(d0);
    expect(errs).toEqual([]);
  });
}

test('A4 [음성대조·줌] 100 에서 열고 → 40 → 끌기 → 100 → 닫기 — 틀이 안 튄다(H 는 커밋 직전에 잰다)', async ({ page }) => {
  const errs = await scene(page, { type: 'image', height: 200 });
  const h0 = await frameH(page);
  expect(await open(page), '[전제] 열림').toBe(true);
  await page.evaluate(() => window.applyZoom(40)); await page.waitForTimeout(400);
  const still = await page.evaluate(() => document.querySelectorAll('.grd-img-edit-proxy').length);
  if (still) await drag(page);
  await page.evaluate(() => window.applyZoom(100)); await page.waitForTimeout(400);
  if (await page.evaluate(() => document.querySelectorAll('.grd-img-edit-proxy').length)) await close(page);
  expect(Math.abs((await frameH(page)) - h0), `★줌을 오간 뒤 커밋한 틀이 튀었다 ${h0} → ${await frameH(page)} (편집 유지=${still})`).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('A5 [회귀 지킴] 이미 크롭된 줄(h200 · 180%)은 끌어 닫아도 틀 200 그대로', async ({ page }) => {
  const errs = await scene(page, { type: 'image', height: 200, imgSizePct: 180, imgPosX: -40, imgPosY: -25 });
  expect(await frameH(page), '[전제] 크롭 틀 = 200').toBe(200);
  expect(await open(page)).toBe(true);
  await drag(page); await close(page);
  expect(await frameH(page)).toBe(200);
  expect(Number((await lineOf(page)).height)).toBe(200);
  expect(errs).toEqual([]);
});

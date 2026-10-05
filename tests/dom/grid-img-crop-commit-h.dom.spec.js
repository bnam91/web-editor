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

test('A4 [배율 간 튐 방지] 100 에서 열고 → 40 → 끌기 → 100 → 닫기 — 틀이 안 튄다 (⛔묵은 H 는 못 가른다 — 레이아웃 px 는 줌 무관 · 그건 A6)', async ({ page }) => {
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

test('A6 [음성대조·묵은 H] 끌어 맞춘 «뒤» 그릇(섹션 여백)을 좁히고 닫기 — 틀 = 닫기 직전 보이던 높이(열 때 높이 아님)', async ({ page }) => {
  /* A4(줌)는 «묵은 H» 를 못 가른다 — 레이아웃 px 는 줌에 안 바뀐다(변이 Mc 실측: 전부 초록). 이 시험은 «보이는 틀 높이»가
     편집 중에 «정말» 바뀌는 장면을 만든다: 끌어서 크롭을 정한 뒤(그래야 커밋이 산다) 그릇을 좁혀 칸 폭 → 비율 높이를 바꾼다.
     ⛔applyGridOwnWidth 는 그리드를 다시 그려 편집을 닫는다(1판 무효) · 좁힌 «뒤» 끌면 프록시를 못 잡는다(2판 무효). */
  const errs = await scene(page, { type: 'image', height: 200 });
  const h0 = await frameH(page);
  expect(await open(page), '[전제] 열림').toBe(true);
  await drag(page);
  await page.evaluate(() => { const s = document.getElementById('sC-in'); s.style.paddingLeft = '300px'; s.style.paddingRight = '300px'; }); await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.querySelectorAll('.grd-img-edit-proxy').length), '[전제] 그릇을 좁혀도 편집이 열려 있다(닫혔으면 무효)').toBe(1);
  const hMid = await frameH(page);
  expect(Math.abs(hMid - h0), `[전제] 그릇을 좁혔는데 보이는 틀 높이가 그대로다 ${h0} → ${hMid}`).toBeGreaterThan(20);
  await close(page);
  const ln = await lineOf(page);
  expect(Number.isFinite(Number(ln.imgSizePct)), `[전제] 크롭이 커밋됐다(안 됐으면 «아무것도 안 씀» 길이라 H 를 못 잰다 — 무효) ${JSON.stringify({ ...ln, imgSrc: undefined })}`).toBe(true);
  expect(Math.abs((await frameH(page)) - hMid), `★커밋한 틀이 «닫기 직전 보이던 높이»(${hMid})가 아니다 → ${await frameH(page)} (열 때 ${h0})`).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('A7 [⒜ 덧단언] 크롭 → 「원래대로」 → 다시 크롭(UI) — 틀이 묵은 높이로 안 튄다', async ({ page }) => {
  /* 지디(10-06): 「원래대로」 뒤 줄엔 안 읽히는 height 가 남는다(실측 P2: 200). 다시 크롭하면 그 묵은 값이 «틀 높이»로 살아나면 안 된다 —
     ⒜ 는 재크롭 커밋이 height:Hc 로 덮어 이 갈래를 제품 쪽에서 닫는다. */
  const errs = await scene(page, { type: 'image', height: 200 });
  expect(await open(page), '[전제] 열림 1').toBe(true);
  await drag(page); await close(page);
  expect(await open(page), '[전제] 열림 2').toBe(true);
  /* ⛔여기서 showGridProperties 를 부르지 마라 — 패널을 다시 그려 편집기가 붙인 「원래대로」 단추를 지운다(1판 [전제] 빨강 = 무효 06:37:19). */
  const reset = await page.waitForSelector('#grd-img-crop-reset', { timeout: 5000 }).then(() => true, () => false);
  expect(reset, '[전제] 「원래대로」 단추').toBe(true);
  await page.click('#grd-img-crop-reset');
  await page.waitForFunction(() => document.querySelectorAll('.grd-img-edit-proxy').length === 0, null, { timeout: 5000 });
  await page.waitForTimeout(200);
  const afterReset = await lineOf(page);
  expect(['imgSizePct', 'imgPosX', 'imgPosY'].filter(k => afterReset[k] !== undefined), '[전제] 「원래대로」가 크롭을 지웠다').toEqual([]);
  const hReset = await frameH(page);
  expect(await open(page), '[전제] 열림 3').toBe(true);
  await drag(page); await close(page);
  expect(Math.abs((await frameH(page)) - hReset), `★다시 크롭했더니 틀이 튀었다 ${hReset} → ${await frameH(page)} (남아 있던 height ${afterReset.height})`).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

/* ══ ③ reset-drops-height (2026-10-06 · APPROVED_BY: 지디 reset-drops-height) — 「원래대로」가 height 키도 지운다.
 *   병(실측 B2 · hbits.log): 「원래대로」 뒤 남은 height(안 읽힘)는 «씨앗»이다 — MCP 가 크롭 세 값만 주면(편집기 커밋을 안 거침) 그 묵은 값이 틀 높이로 살아나 645 → 200 으로 튄다.
 *   ⛔이번 판은 MCP 쪽 가드를 따로 안 둔다(SCOPE 에 이름) — 씨앗을 없애는 것으로 이 갈래를 닫는다. */
async function resetCrop(page) {
  expect(await open(page), '[전제] 열림').toBe(true);
  const ok = await page.waitForSelector('#grd-img-crop-reset', { timeout: 5000 }).then(() => true, () => false);
  expect(ok, '[전제] 「원래대로」 단추').toBe(true);
  await page.click('#grd-img-crop-reset');
  await page.waitForFunction(() => document.querySelectorAll('.grd-img-edit-proxy').length === 0, null, { timeout: 5000 });
  await page.waitForTimeout(200);
}
const LEGACY_CROPPED = { type: 'image', height: 200, imgSizePct: 120, imgPosX: -10, imgPosY: -10 };

test('A8 [새 것] 옛 크롭 줄 → 「원래대로」 — 크롭 세 값과 height 키가 같이 없어진다', async ({ page }) => {
  const errs = await scene(page, LEGACY_CROPPED);
  await resetCrop(page);
  const ln = await lineOf(page);
  expect(['imgSizePct', 'imgPosX', 'imgPosY', 'height'].filter(k => ln[k] !== undefined), `★「원래대로」 뒤 남은 키 ${JSON.stringify({ ...ln, imgSrc: undefined })}`).toEqual([]);
  expect(errs).toEqual([]);
});

test('A9 [새 것] 「원래대로」 뒤 MCP 가 크롭 세 값만 주면 — 틀이 묵은 높이로 안 튄다', async ({ page }) => {
  const errs = await scene(page, LEGACY_CROPPED);
  await resetCrop(page);
  const h1 = await frameH(page);
  const r = await page.evaluate(() => window.updateGridBlock('gC', { patchCell: { r: 0, c: 0, lineIndex: 0, imgSizePct: 100, imgPosX: 0, imgPosY: 0 } }));
  expect(r && r.ok, `[전제] MCP 크롭 세 값 ${JSON.stringify(r)}`).toBe(true);
  await page.waitForTimeout(250);
  expect(Math.abs((await frameH(page)) - h1), `★크롭 세 값만 줬는데 틀이 튀었다 ${h1} → ${await frameH(page)}`).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

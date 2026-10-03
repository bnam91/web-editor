/* icon-circle-grid-svg.dom.spec.js — S2 써클블럭 svg (현빈 체크리스트 2026-10-04):
 *   「좌측 레이어패널·우측 프로퍼티패널 아이콘을 그리드 칸에 들어가는 svg로 교체」
 * ★그리드 칸 svg = 칸 우클릭 「원형 이미지 추가」 의 그림(옛 index.html #bcm-grid-img-circle 인라인) → js/blocks/grid-circle-icon.js 상수 한 벌.
 *   이 시험은 «상수»로 잰다(글자 사본으로 재지 않는다): 서클블럭 레이어 행·우측 헤더·칸 메뉴의 svg 안이 상수와 같고,
 *   다른 블록(asset·grid) 행/헤더 아이콘은 그 상수가 «아니다»(안 바뀜).
 * 입력 = 레이어 행 진짜 클릭(page.click). 앱을 안 띄우고 bootApp 하네스.
 * 실행: dom-lock.sh npx playwright test --config=tests/dom/playwright.dom.config.js icon-circle-grid-svg --workers=1
 * 양성대조: GD1001_ROOT=<07d8178b 체크아웃> — 그 판엔 상수 모듈이 없어 import 가 실패 ⇒ 빨강. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');

const SHOT = process.env.S2_SHOT_DIR || '';
const shot = async (page, name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, name) }); } };

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    window.addSection();
    window.addAssetBlock();
    window.addIconCircleBlock();
    window.addGridBlock && window.addGridBlock();
    window.buildLayerPanel();
  });
  await page.waitForTimeout(300);
  return errs;
}
/* 상수는 «앱이 실제로 쓰는 모듈»에서 끌어온다 — 07d8178b 판엔 이 모듈이 없어 import 가 던진다(양성대조 빨강). */
const constants = (page) => page.evaluate(async () => {
  const m = await import('/js/blocks/grid-circle-icon.js');
  /* DOM 이 직렬화한 꼴(`<circle …></circle>`)로 맞춘다 — 같은 상수를 svg 에 넣었다 읽은 것(글자 사본 아님) */
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); t.innerHTML = m.GRID_CIRCLE_ICON_INNER;
  return { inner: t.innerHTML, vb: m.GRID_CIRCLE_ICON_VIEWBOX, sw: m.GRID_CIRCLE_ICON_STROKE_WIDTH, raw: m.GRID_CIRCLE_ICON_INNER };
});
const rowByName = (page, name) => page.locator('#layer-panel-body .layer-item', { has: page.locator(`.layer-item-name:text-is("${name}")`) }).first();

test('S2-1 서클블럭: 레이어 행 아이콘이 그리드 칸 원형 svg 상수와 같다 (진짜 클릭)', async ({ page }) => {
  const errs = await setup(page);
  await shot(page, 'layer-row.png');   // 증거 스크린샷은 단언 «앞»에서(옛 판에선 상수 import 가 던진다)
  const k = await constants(page);
  expect(k.raw, '전제: 상수가 비어 있지 않다').toContain('<circle');
  const row = rowByName(page, 'Asset-Circle');
  await expect(row, '전제: 서클블럭 행이 있다').toHaveCount(1);
  const icb = await row.locator('svg.layer-item-icon').evaluate(s => ({ inner: s.innerHTML, vb: s.getAttribute('viewBox') }));
  expect(icb.inner).toBe(k.inner);
  expect(icb.vb).toBe(k.vb);
  expect(await row.locator('svg.layer-item-icon').getAttribute('stroke-width'), '선 굵기도 상수').toBe(k.sw);
  expect(await row.locator('svg.layer-item-icon text').count(), '옛 ★ 글리프가 없다').toBe(0);
  expect(errs).toEqual([]);
});

test('S2-2 서클블럭: 행을 눌러 고르면 우측 헤더 아이콘이 같은 상수다', async ({ page }) => {
  await setup(page);
  await rowByName(page, 'Asset-Circle').click();
  await page.waitForSelector('#icb-pos-btn, #icb-upload-btn', { timeout: 5000 });   // 전제: 서클블럭 패널이 떴다
  await shot(page, 'prop-header.png');
  const k = await constants(page);
  const hd = await page.locator('#prop-panel .prop-block-icon svg, #panel-right .prop-block-icon svg').first()
    .evaluate(s => ({ inner: s.innerHTML, vb: s.getAttribute('viewBox'), w: s.getAttribute('width') }));
  expect(hd.inner).toBe(k.inner);
  expect(hd.vb).toBe(k.vb);
  expect(hd.w, '이웃 헤더 아이콘과 같은 12px').toBe('12');
});

test('S2-3 칸 우클릭 메뉴 「원형 이미지 추가」 svg 도 같은 상수에서 파생(사본 없음)', async ({ page }) => {
  await setup(page);
  const k = await constants(page);
  const menu = await page.evaluate(() => { const e = document.getElementById('bcm-grid-img-circle-icon'); return { inner: e.innerHTML, sw: e.getAttribute('stroke-width') }; });
  expect(menu.inner).toBe(k.inner);
  expect(menu.sw).toBe(k.sw);
});

test('S2-4 다른 블록 아이콘은 안 바뀐다 (asset 행·우측 헤더는 상수가 아니다)', async ({ page }) => {
  await setup(page);
  const k = await constants(page);
  const assetIcon = await rowByName(page, 'Asset').locator('svg.layer-item-icon').first().evaluate(s => s.innerHTML);
  expect(assetIcon).not.toBe(k.inner);
  expect(assetIcon).toContain('<rect');   // asset 의 원래 그림(액자+산)
  const gridRow = page.locator('#layer-panel-body .layer-item', { has: page.locator('.layer-item-type:text-is("Grid")') }).first();
  if (await gridRow.count()) {
    const g = await gridRow.locator('svg.layer-item-icon').evaluate(s => s.innerHTML);
    expect(g).not.toBe(k.inner);
  }
  await rowByName(page, 'Asset').click();
  await page.waitForTimeout(150);
  const h = await page.locator('#panel-right .prop-block-icon svg, #prop-panel .prop-block-icon svg').first().evaluate(s => s.innerHTML);
  expect(h).not.toBe(k.inner);
});

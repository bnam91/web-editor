/* modal-icon-picker-size.dom.spec.js — E125 «모달 블럭 아이콘을 고르기 창에서 64 로 골라도 24 로 들어간다» 잠금 (태양 lane-e125-mdlicon 2026-10-05)
 * ★실측(9ef09f76): applyPickedIconToModal 이 picked.size 를 안 읽었다 — 고른 뒤 dataset.iconSize 24 → 24.
 * 고침(판정 (a) · 태양 10-05 «창이 보여 준 것을 적용»): picked.size 를 앉힌다 · 모달 패널 범위 12~96 로 자른다(창은 16~600).
 *   ⚠️창의 크기 칸 기본값이 64 라 «안 건드리고 고르면» 64 가 된다(P1 이 그 꼴).
 * 순서 = 실앱 순서: 캔버스의 모달 아이콘 슬롯을 «클릭»(clickAt) → 고르기 창 → Favorite 탭 → 아이콘 칸 클릭 → (크기 칸) → 「삽입」 클릭.
 *   아이콘은 Favorite(로컬 저장 svg)로 고른다 — 검색 탭은 네트워크(iconify API)가 필요해 시험에서 못 쓴다.
 * 형제(지킴): 같은 창의 «콜백 없음» 길(addIconifyBlock — 아이콘 블럭)은 이 고침과 무관 — 여기 G1 이 64 를 본다.
 * 양성대조: 9ef09f76 나무 안 → P1 P2 P3 빨강 · G1 초록 (predict: $S/e125/predict.md).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/modal-icon-picker-size.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>';

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((SVG) => {
    try { localStorage.setItem('__probe', '1'); } catch (_) {}
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="sec1"><div class="section-hitzone"></div><div class="section-inner"></div></div>');
    window.rebindAll?.(); window.selectSection(document.getElementById('sec1'));
    window.addModalBlock({ variant: 'icon' });
    const m = [...document.querySelectorAll('#canvas .modal-block')].pop(); m.id = 'M1';
    window.deselectAll?.(); window.applyZoom?.(100);
    m.scrollIntoView({ block: 'center' });
  }, SVG);
  return errs;
}
/** 슬롯 클릭 → 창 → Favorite → 칸 → (크기) → 삽입 */
async function pickViaPicker(page, size) {
  const sl = await waitStableRect(page, '#M1 .mdl-icon');
  await clickAt(page, sl.cx, sl.cy, { sel: '#M1 .mdl-icon' }, { label: '모달 아이콘 슬롯' });
  await expect(page.locator('#iconify-modal')).toBeVisible();
  const tab = await waitStableRect(page, '#iconify-modal .iconify-subtab[data-subtab="favorite"]');
  await clickAt(page, tab.cx, tab.cy, { sel: '.iconify-subtab[data-subtab="favorite"]' }, { label: 'Favorite 탭' });
  const cell = await waitStableRect(page, '#iconify-fav-grid .iconify-fav-cell');
  await clickAt(page, cell.cx, cell.cy, { sel: '.iconify-fav-cell' }, { label: '아이콘 칸' });
  const before = await page.inputValue('#iconify-size-input');
  if (size !== undefined) await page.fill('#iconify-size-input', String(size));
  const ins = await waitStableRect(page, '#iconify-insert-btn');
  await clickAt(page, ins.cx, ins.cy, { sel: '[id="iconify-insert-btn"]' }, { label: '삽입' });
  await expect(page.locator('#iconify-modal')).toBeHidden();
  return before;
}
const iconState = (page) => page.evaluate(() => { const m = document.getElementById('M1'); const ic = m.querySelector('.mdl-icon'); return { ds: m.dataset.iconSize, w: ic?.offsetWidth, svg: !!m.dataset.iconSvg }; });

test.beforeEach(async ({ page }) => {
  await page.addInitScript((SVG) => {
    try { localStorage.setItem('goditor.stickerFavorites', JSON.stringify([{ shape: 'icon', iconName: 'test:dot', iconSvg: SVG, iconColor: '#333333' }])); } catch (_) {}
  }, SVG);
});

test('P1 ★크기 칸을 «안 건드리고»(보이는 값 64) 고르면 모달 아이콘 = 64', async ({ page }) => {
  const errs = await setup(page);
  expect((await iconState(page)).ds, '전제 — 모달 아이콘 기본 24').toBe('24');
  const shown = await pickViaPicker(page);
  expect(shown, '전제 — 창이 보여 준 크기 64').toBe('64');
  expect(await iconState(page)).toEqual({ ds: '64', w: 64, svg: true });
  /* 하네스 한계 한 줄만 뺀다 — bootApp 의 electronAPI 가짜(모든 호출 null)에는 svgPresets.list 가 없어 고르기 창이 열 때 TypeError(실앱엔 있음). 다른 오류는 그대로 빨강. */
  expect(errs.filter(e => !/electronAPI\?\.svgPresets\?\.list is not a function/.test(e))).toEqual([]);
});
test('P2 ★크기 칸에 48 을 적고 고르면 48', async ({ page }) => {
  await setup(page);
  await pickViaPicker(page, 48);
  expect(await iconState(page)).toMatchObject({ ds: '48', w: 48 });
});
test('P3 ★200 을 적으면 모달 패널 끝값 96 으로 잘린다(패널 슬라이더와 같은 수)', async ({ page }) => {
  await setup(page);
  await pickViaPicker(page, 200);
  expect(await iconState(page)).toMatchObject({ ds: '96', w: 96 });
});
test('G1 지킴 — 「콜백 없음」 길의 끝(iconify-panel _doInsert → addIconifyBlock(name, svg, size))은 이 고침과 무관 — 64 그대로', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate((SVG) => { window.selectSection(document.getElementById('sec1')); window.addIconifyBlock('test:dot', SVG, 64); const b = [...document.querySelectorAll('#canvas .icon-block')].pop(); return b && b.dataset.size; }, SVG);
  expect(r).toBe('64');
});

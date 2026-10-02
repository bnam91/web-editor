/* divider-width.dom.spec.js — 현빈 2026-10-01 「dvd_qwvhfa8 와 같은 디바이더 블럭 — 두께 조절 외에도 너비 조절되게 슬라이드 추가」
 * 가로 디바이더에 «너비»(dataset.lineWidth, px) — 값 없음 = 지금처럼 전폭. 끝까지 올리면 값을 지워 전폭으로.
 * 고정 데이터 = 현빈 저장본 dvd_qwvhfa8 의 속성 그대로(lineLength=80 이 박혀 있어도 전폭이어야 한다 — W0).
 * ★양성대조 판 7699ea33 → 빨강: W1 W2 W3 W4(전제에서 짐) / 초록: W0(옛 블록 무변화 — 지키는 시험).
 * 진짜 마우스로 블럭을 눌러 패널을 열고, 숫자칸에 쳐서 바꾼다(슬라이더 끌기와 같은 applyWidth 를 탄다). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const DVD = `<div class="divider-block" data-type="divider" id="dvd_qwvhfa8" data-line-color="#cccccc" data-line-style="solid" data-line-weight="1"
  data-pad-v="40" data-pad-h="0" data-line-dir="horizontal" data-line-length="80" style="padding: 40px 0px;"><hr class="dvd-line" style="border-top:1px solid #cccccc;"></div>`;
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate((d) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="dS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="dR" data-layout="stack">${d}</div><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
    window.rebindAll?.(); window.deselectAll?.(); window.applyDividerStyle(document.getElementById('dvd_qwvhfa8')); }, DVD);
  await page.waitForTimeout(200);
}
const lineW = (page) => page.evaluate(() => document.querySelector('#dvd_qwvhfa8 .dvd-line').offsetWidth);   // 모델 px(캔버스 배율 무관)
const blockW = (page) => page.evaluate(() => document.getElementById('dvd_qwvhfa8').clientWidth);
async function openPanel(page) {
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('dvd_qwvhfa8').getBoundingClientRect(); return [r.left + r.width / 2, r.top + 8]; });
  await page.mouse.click(x, y); await page.waitForTimeout(200);
}
async function typeWidth(page, v) {
  await page.fill('#dvd-width-number', String(v)); await page.press('#dvd-width-number', 'Enter');
  await page.evaluate(() => document.getElementById('dvd-width-number').dispatchEvent(new Event('change', { bubbles: true })));
  await page.waitForTimeout(150);
}

test('W0 지키는 시험 — 옛 디바이더(lineLength=80 박힘)는 지금처럼 전폭', async ({ page }) => {
  await setup(page);
  expect(await lineW(page)).toBe(await blockW(page));
});
test('W1 ★가로 디바이더 패널에 «너비» 슬라이더가 보인다(두께 아래)', async ({ page }) => {
  await setup(page); await openPanel(page);
  expect(await page.isVisible('#dvd-width-slider')).toBe(true);
  expect(await page.evaluate(() => document.getElementById('dvd-width-slider').closest('.prop-row').querySelector('.prop-label').textContent)).toBe('너비');
});
test('W2 ★너비 300 → 선이 300px 로 가운데에 · ⌘Z 한 번에 전폭', async ({ page }) => {
  await setup(page); await openPanel(page);
  await typeWidth(page, 300);
  expect(await lineW(page)).toBe(300);
  const mid = await page.evaluate(() => { const b = document.getElementById('dvd_qwvhfa8').getBoundingClientRect(), l = document.querySelector('#dvd_qwvhfa8 .dvd-line').getBoundingClientRect();
    return Math.abs((l.left + l.width / 2) - (b.left + b.width / 2)); });
  expect(mid).toBeLessThanOrEqual(1);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(200);
  expect(await lineW(page)).toBe(await blockW(page));
});
test('W3 ★끝(전폭)까지 올리면 값이 «지워진다» — 숫자가 아니라 «없음»이 전폭', async ({ page }) => {
  await setup(page); await openPanel(page);
  await typeWidth(page, 300);
  await typeWidth(page, 99999);
  expect(await page.evaluate(() => document.getElementById('dvd_qwvhfa8').dataset.lineWidth)).toBeUndefined();
  expect(await lineW(page)).toBe(await blockW(page));
});
test('W4 ★세로로 바꾸면 너비 줄은 숨고 길이 줄이 뜬다(세로는 길이가 너비 역할)', async ({ page }) => {
  await setup(page); await openPanel(page);
  expect(await page.isVisible('#dvd-width-row'), '전제 — 가로일 땐 너비 줄이 보인다(없으면 «숨었다»가 공짜로 참)').toBe(true);
  await page.click('#dvd-dir-group [data-dir="vertical"]'); await page.waitForTimeout(150);
  expect(await page.isVisible('#dvd-width-row')).toBe(false);
  expect(await page.isVisible('#dvd-length-row')).toBe(true);
});

/* grid-gap-line-height.dom.spec.js — 현빈 「칸 > 갭 줄을 더하면 갭 높이 조절이 안 된다」(TASK-20261003-goditor-32 ②G3)
 * 칸 안 «여백 줄(type:gap)» 의 높이 — 패널 「높이(px)」 칸(grd-line-gap-h) → 렌더 높이 · dataset · ⌘Z · 저장 왕복.
 * 앱 통째(bootApp) · 줄 고르기·입력은 진짜 마우스·키. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page, lines) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate((lines) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
  }, lines);
  await page.waitForTimeout(200);
}
const gapOff = (page) => page.evaluate(() => document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-gap')?.offsetHeight ?? null);
const model = (page) => page.evaluate(() => JSON.parse(document.getElementById('gG').dataset.cols)[0].lines.map(l => l.type + ':' + (l.height ?? '')));
async function selectGap(page) {
  const [x, y] = await page.evaluate(() => { const r = document.querySelector('#gG .grd-gap').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(x, y); await page.waitForTimeout(200);
  await page.mouse.click(x, y); await page.waitForTimeout(300);
}
async function typeHeight(page, v) {
  const box = await page.evaluate(() => { const e = document.getElementById('grd-line-gap-h'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  expect(box, '패널에 갭 줄 높이 칸(grd-line-gap-h)').not.toBeNull();
  await page.mouse.click(box[0], box[1]);
  await page.keyboard.press('Meta+a'); await page.keyboard.type(String(v)); await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
}
const LINES = [{ type: 'body', text: 'A' }, { type: 'gap', height: 16 }, { type: 'body', text: 'C' }];

test('G3-0 전제 — 갭 줄이 16px 로 그려지고 패널에 높이 칸이 있다', async ({ page }) => {
  await setup(page, LINES);
  expect(await gapOff(page)).toBe(16);
  await selectGap(page);
  expect(await page.evaluate(() => document.getElementById('grd-line-gap-h')?.value)).toBe('16');
  expect(await page.evaluate(() => document.getElementById('grd-line-gap-h')?.getBoundingClientRect().width), '★높이 칸이 «보인다»(접힌 절 안에 숨지 않는다)').toBeGreaterThan(0);
});
test('G3-1 ★높이 칸에 60 → 렌더 높이 60 · 모델 gap:60 · ⌘Z 로 16 · 저장 왕복 60', async ({ page }) => {
  await setup(page, LINES);
  await selectGap(page);
  await typeHeight(page, 60);
  expect(await gapOff(page)).toBe(60);
  expect(await model(page)).toEqual(['body:', 'gap:60', 'body:']);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await gapOff(page)).toBe(16);
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(300);
  expect(await gapOff(page)).toBe(60);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForTimeout(400);
  expect(await gapOff(page)).toBe(60);
});
test('G3-2 ★두 번째로 바꿔도 먹는다(60 → 100)', async ({ page }) => {
  await setup(page, LINES);
  await selectGap(page); await typeHeight(page, 60);
  await selectGap(page); await typeHeight(page, 100);
  expect(await gapOff(page)).toBe(100);
});
test('G3-3 갭 줄만 든 칸 — 높이 칸이 뜨고 먹는다', async ({ page }) => {
  await setup(page, [{ type: 'gap', height: 16 }]);
  await selectGap(page); await typeHeight(page, 80);
  expect(await gapOff(page)).toBe(80);
});
test('G3-4 ★갭 줄은 처음부터 펼침 · 머리글을 누르면 접히고 다시 누르면 펴진다(첫 클릭에 튀지 않는다) · 글자 줄은 여전히 접힘 기본', async ({ page }) => {
  await setup(page, LINES);
  await selectGap(page);
  const tg = () => page.evaluate(() => { const e = document.getElementById('grd-line-toggle').getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; });
  const vis = () => page.evaluate(() => document.getElementById('grd-line-body').style.display);
  expect(await vis()).toBe('block');
  let t = await tg(); await page.mouse.click(t[0], t[1]); await page.waitForTimeout(200);
  expect(await vis()).toBe('none');
  t = await tg(); await page.mouse.click(t[0], t[1]); await page.waitForTimeout(200);
  expect(await vis()).toBe('block');
});
test('G3-5 대조 — 글자 줄은 여전히 접힘 기본(펼침 기본은 갭·구분선 줄만)', async ({ page }) => {
  await setup(page, LINES);
  const [x, y] = await page.evaluate(() => { const r = document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-line').getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; });
  await page.mouse.click(x, y); await page.waitForTimeout(200);
  await page.mouse.click(x, y); await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.getElementById('grd-line-body')?.style.display)).toBe('none');
});

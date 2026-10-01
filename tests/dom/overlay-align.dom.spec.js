/* overlay-align.dom.spec.js — A2 (현빈 2026-10-01 「오버레이 블럭 복수 선택 시 «블럭 간» 정렬」)
 * 앱 통째로 헤드리스(bootApp) — 진짜 ⌘클릭으로 고르고, 패널 단추를 진짜로 누른다.
 * ★양성대조 판 = 7699ea33 → 그 판엔 이 패널이 없다(빨강이어야 할 것: O1 O2 O3 O4 O5). O6 은 지키는 시험.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `
<div class="section-block" id="secO" data-section="1" style="height:900px;background:#eee;">
  <div class="section-hitzone"><span class="section-label">O</span></div>
  <div class="section-inner" id="innerO"><div class="gap-block" id="gapO" data-type="gap" style="height:880px;"></div></div>
  <div class="frame-block" id="ovS" data-overlay-block="true" data-sel-variant="sticker" data-free-layout="true"
       data-offset-x="60" data-offset-y="80" style="position:absolute;left:60px;top:80px;width:120px;height:120px;">
    <div class="shape-block" id="shS" data-shape="rectangle" style="width:100%;height:100%;background:#4a7"></div></div>
  <div class="frame-block" id="ovT" data-text-frame="true" data-overlay-block="true" data-sel-variant="sticker"
       data-offset-x="400" data-offset-y="300" style="position:absolute;left:400px;top:300px;width:200px;height:60px;">
    <div class="text-block" id="tbT" data-type="body"><div class="tb-body" contenteditable="false">오버레이 글자</div></div></div>
  <div class="zoom-block" id="zmO" data-type="zoom" data-x="250" data-y="600" data-w="200" data-h="100"
       style="position:absolute;left:250px;top:600px;width:200px;height:100px;"></div>
</div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => { document.getElementById('canvas').insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.(); document.getElementById('secO').scrollIntoView({ block: 'start' }); }, SEC);
  await page.waitForTimeout(300);
  return errs;
}
const ctr = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
async function pick(page, ids) {
  for (let i = 0; i < ids.length; i++) {
    const [x, y] = await ctr(page, ids[i]);
    if (i) await page.keyboard.down('Meta');
    await page.mouse.click(x, y);
    if (i) await page.keyboard.up('Meta');
  }
  await page.waitForTimeout(150);
}
const geo = (page) => page.evaluate(() => {
  const s = document.getElementById('secO').getBoundingClientRect(); const k = s.width / document.getElementById('secO').offsetWidth;
  const g = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: Math.round((r.left - s.left) / k), y: Math.round((r.top - s.top) / k), w: Math.round(r.width / k), h: Math.round(r.height / k) }; };
  return { S: g('ovS'), T: g('ovT'), Z: g('zmO') };
});
const press = async (page, sel) => { const [x, y] = await page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel); await page.mouse.click(x, y); };

test('O1 ★떠 있는 셋을 ⌘클릭으로 고르면 «서로 맞춤» 패널이 뜬다', async ({ page }) => {
  await setup(page);
  await pick(page, ['ovS', 'ovT', 'zmO']);
  const r = await page.evaluate(() => ({ crumb: document.querySelector('#panel-right .prop-breadcrumb')?.textContent || '', units: window.getSelectedOverlayUnits?.()?.map(u => u.id) || null }));
  expect(r.units, '고른 단위').toEqual(expect.arrayContaining(['ovS', 'ovT', 'zmO']));
  expect(r.crumb).toContain('서로 맞춤');
});

test('O2 ★왼쪽 맞춤 — 셋의 왼쪽 모서리가 가장 왼쪽 것(60)에 맞는다 · dataset 과 style 이 같다', async ({ page }) => {
  await setup(page);
  await pick(page, ['ovS', 'ovT', 'zmO']);
  await press(page, '#panel-right [data-ov-align="left"]');
  const g = await geo(page);
  expect([g.S.x, g.T.x, g.Z.x]).toEqual([60, 60, 60]);
  const ds = await page.evaluate(() => [document.getElementById('ovT').dataset.offsetX, document.getElementById('ovT').style.left, document.getElementById('zmO').dataset.x, document.getElementById('zmO').style.left]);
  expect(ds).toEqual(['60', '60px', '60', '60px']);
});

test('O3 ★세로 가운데 맞춤 — 세 중심 y 가 경계상자 중심에 모인다', async ({ page }) => {
  await setup(page);
  await pick(page, ['ovS', 'ovT', 'zmO']);
  await press(page, '#panel-right [data-ov-align="vcenter"]');
  const g = await geo(page);
  const cy = [g.S.y + g.S.h / 2, g.T.y + g.T.h / 2, g.Z.y + g.Z.h / 2].map(Math.round);
  expect(Math.max(...cy) - Math.min(...cy)).toBeLessThanOrEqual(1);
});

test('O4 ★가로 균등 — 양 끝 제자리, 사이 간격 둘이 같다', async ({ page }) => {
  await setup(page);
  await pick(page, ['ovS', 'ovT', 'zmO']);
  const b = await geo(page);
  await press(page, '#panel-right [data-ov-dist="h"]');
  const g = await geo(page);
  const items = [g.S, g.T, g.Z].sort((a, c) => a.x - c.x);
  expect(items[0].x, '왼쪽 끝 제자리').toBe(Math.min(b.S.x, b.T.x, b.Z.x));
  const gap1 = items[1].x - (items[0].x + items[0].w), gap2 = items[2].x - (items[1].x + items[1].w);
  expect(Math.abs(gap1 - gap2)).toBeLessThanOrEqual(1);
});

test('O5 ⌘Z 한 번 = 정렬 한 번', async ({ page }) => {
  await setup(page);
  await pick(page, ['ovS', 'ovT', 'zmO']);
  const b = await geo(page);
  await press(page, '#panel-right [data-ov-align="left"]');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(200);
  const g = await geo(page);
  expect([g.T.x, g.Z.x]).toEqual([b.T.x, b.Z.x]);
});

test('O6 흐름 블럭이 하나라도 섞이면 이 패널이 아니다(갈래를 넓히지 않았다)', async ({ page }) => {
  await setup(page);
  await pick(page, ['ovS', 'gapO']);
  expect(await page.evaluate(() => window.getSelectedOverlayUnits?.() ?? null)).toBeNull();
});

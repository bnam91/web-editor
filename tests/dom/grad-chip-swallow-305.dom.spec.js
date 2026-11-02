/* grad-chip-swallow-305.dom.spec.js — 그라디언트 칩을 끈 뒤 사용자 클릭이 먹히지 않는다 (시트 305 CLICK-SWALLOW-LOCAL-COPY-DIFFERS-300MS-01)
 * 까닭: js/gradient-line-overlay.js 의 자기 사본은 click 이 안 오면 300ms 동안 살았다. 끌기 중 Esc·⌘Z 는 오버레이를 걷어 합성 click 이 안 오게 하는 사람 길이다.
 *   K1·K2 그 길 ⇒ 놓은 뒤 바로 누른 패널 클릭이 닿는다(사본이면 먹힌다 — 빨강).
 *   S  [지킴] 평소 끌기 ⇒ 끈 뒤 합성 click 은 여전히 삼킨다 — 옮기다 삼킴이 죽으면 빨강(공용 0ms 가 그 click 보다 먼저 걷히는 꼴도 여기서 걸린다).
 *   N  [음성] 끌기 없는 클릭 ⇒ 닿는다(세는 자가 산다).
 * ⛔안 재는 것: 실 OS 창 밖 놓기 · 끝 원 끌기 · 사람 손. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const AWAY_Y = 300;   // 칩에서 멀리 놓는다 — 칩 위에서 놓으면 합성 click 대상이 오버레이 안이라 그 문서 리스너가 대신 막아 삼킴을 못 잰다(변이로 확인)
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(() => {
    window.addSection();
    const sec = [...document.querySelectorAll('#canvas .section-block')].pop();
    window.selectSection(sec);
    sec.dataset.bg = 'linear-gradient(90deg,#ff0000,#0000ff)';
    window.applySectionBg(sec);
    window.showGradientLine(sec);
    sec.scrollIntoView({ block: 'center' });
    window.__clicks = 0;
    document.addEventListener('click', () => { window.__clicks++; });
  });
  await page.waitForFunction(() => document.querySelector('.grad-line-overlay .grad-stop-chip:not(.grad-stop-chip-fill)'));
  return page.evaluate(() => {
    const q = document.querySelector('.grad-line-overlay .grad-stop-chip:not(.grad-stop-chip-fill)').getBoundingClientRect();
    const h = document.querySelector('#panel-right .panel-header').getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2, tx: h.x + 5, ty: h.y + 5 };
  });
}
const clicks = (page) => page.evaluate(() => window.__clicks);
async function dragChip(page, p, midKey, awayY = 0) {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  expect(await page.evaluate(() => !!document.querySelector('.grad-stop-chip.is-dragging')), '[전제] 칩을 잡았다').toBe(true);
  await page.mouse.move(p.x + 25, p.y);
  await page.mouse.move(p.x + 45, p.y + awayY);
  if (midKey) {
    await page.keyboard.press(midKey);
    expect(await page.evaluate(() => document.querySelectorAll('.grad-line-overlay').length), '[전제] 그 키가 오버레이를 걷었다').toBe(0);
  }
  await page.mouse.up();
}

for (const [name, key] of [['K1 끌기 중 Esc', 'Escape'], ['K2 끌기 중 ⌘Z', 'Meta+z']]) {
  test(`${name} — 놓은 뒤 바로 누른 클릭이 닿는다`, async ({ page }) => {
    const p = await scene(page);
    await dragChip(page, p, key);
    const n0 = await clicks(page);
    await clickAt(page, p.tx, p.ty, { sel: '.panel-header' });
    expect(await clicks(page), '끈 뒤 사용자 클릭이 먹혔다').toBe(n0 + 1);
  });
}
test('S [지킴] 평소 끌기 — 끈 뒤 합성 click 은 삼키고 다음 클릭은 닿는다', async ({ page }) => {
  const p = await scene(page);
  await dragChip(page, p, null, AWAY_Y);
  expect(await clicks(page), '합성 click 이 새었다').toBe(0);
  await clickAt(page, p.tx, p.ty, { sel: '.panel-header' });
  expect(await clicks(page)).toBe(1);
});
test('N [음성] 끌기 없는 클릭 — 닿는다', async ({ page }) => {
  const p = await scene(page);
  await clickAt(page, p.tx, p.ty, { sel: '.panel-header' });
  expect(await clicks(page)).toBe(1);
});

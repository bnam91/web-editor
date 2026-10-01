/* grid-fullbleed-rerender.dom.spec.js — 현빈 2026-10-01 「grd_ts0he_lvy913j: 좌우패딩제외 체크 → 열 간격을 마우스로 조절하니
 *   좌측에 붙은채 우측 패딩이 들어가지더라」
 * 원인: renderGridBlock 이 다시 그릴 때마다 style.width='100%' 를 박고 「패딩 제외」를 다시 안 걸었다 — 음수 마진만 남는다.
 * ★양성대조 판 7699ea33 → 빨강: R1 R2 / 초록: R0(전제 — 켠 직후엔 양쪽이 붙는다) · R3(끈 그리드는 그대로 — 지키는 시험).
 * ⚠️열 간격 «끌기 손잡이»를 진짜 마우스로 끈 것은 아니다 — 끌기가 부르는 «다시 그리기»를 직접 불렀다(미측정 · 태양 · 2026-10-01). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page, fullBleed) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate((fb) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="40" style="padding-left:40px;padding-right:40px"><div class="row" id="gR" data-layout="stack"></div></div></div>`);
    const g = document.createElement('div'); g.className = 'grid-block'; g.id = 'gG'; g.dataset.type = 'grid'; g.dataset.gap = '24';
    g.dataset.cols = JSON.stringify([{ width: 0.61, lines: [{ type: 'body', text: 'a' }] }, { width: 1.39, lines: [{ type: 'body', text: 'b' }] }]);
    document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g);
    if (fb) { g.dataset.fullBleed = 'true'; window.applyBlockFullBleed(g); }
  }, fullBleed);
}
const edges = (page) => page.evaluate(() => { const s = document.getElementById('gS').getBoundingClientRect(), b = document.getElementById('gG').getBoundingClientRect();
  return { l: Math.round(b.left - s.left), r: Math.round(s.right - b.right) }; });

test('R0 전제 — 「패딩 제외」를 켠 직후엔 좌우가 섹션 끝에 붙는다', async ({ page }) => {
  await setup(page, true);
  expect(await edges(page)).toEqual({ l: 0, r: 0 });
});
test('R1 ★열 간격을 바꿔 다시 그려도 좌우가 그대로 붙어 있다(옛 판: 오른쪽만 패딩)', async ({ page }) => {
  await setup(page, true);
  await page.evaluate(() => { const g = document.getElementById('gG'); g.dataset.gap = '60'; window.renderGridBlock(g); });
  expect(await edges(page)).toEqual({ l: 0, r: 0 });
});
test('R2 ★여러 번 다시 그려도(끌기는 매 움직임마다 그린다) 그대로', async ({ page }) => {
  await setup(page, true);
  await page.evaluate(() => { const g = document.getElementById('gG'); for (let i = 0; i < 5; i++) { g.dataset.gap = String(24 + i * 8); window.renderGridBlock(g); } });
  expect(await edges(page)).toEqual({ l: 0, r: 0 });
});
test('R3 지키는 시험 — 끈 그리드는 다시 그려도 섹션 패딩 안에 있다', async ({ page }) => {
  await setup(page, false);
  const before = await edges(page);
  expect(before.l).toBeGreaterThan(0);
  await page.evaluate(() => { const g = document.getElementById('gG'); g.dataset.gap = '60'; window.renderGridBlock(g); });
  expect(await edges(page)).toEqual(before);
});

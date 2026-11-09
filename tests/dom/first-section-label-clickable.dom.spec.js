/* first-section-label-clickable.dom.spec.js — FIRST-SECTION-LABEL-HIDDEN-UNDER-TOPBAR-01 (지디 ㉠: 고칠 것 없음 + 잠금)
 *   잰 것(e7d97f1ec): 라벨 자체는 pointer-events:none(설계) — 누르는 것은 섹션 위 26px «히트존» 띠(누르면 섹션 고르기).
 *   연 직후(쉼 스크롤) 첫 섹션 띠는 툴바(#topbar) 아래에 온전히 있고 눌린다. 띠 높이만큼 내리면 띠가 툴바 밑으로 들어가
 *   그 자리 맨 위가 #topbar — 그건 «스크롤 가림»이라 그대로 둔다(라벨을 섹션 안쪽으로 내리는 ㉡ 는 현빈 묶음 질문).
 *   L1 연 직후: 첫 섹션 띠 윗변 ≥ 툴바 아래끝 · 띠 가운데 맨 위 = 그 띠 · 진짜 클릭 = 첫 섹션 골라짐 (둘째 섹션도 같은 꼴 = 대조)
 *   L2 ★양성대조: 쉼 스크롤을 띠 높이만큼 내리면 L1 의 세 단언이 뒤집힌다(맨 위 = #topbar · 클릭해도 안 골라짐) — L1 이 «장식»이 아님을 잰다 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); await window.addSection(); await window.addSection(); window.deselectAll?.(); });
  await raf2(page);
  return errs;
}
const strip = (page, i) => page.evaluate((i) => {
  const s = document.querySelectorAll('#canvas .section-block')[i]; const r = s.querySelector('.section-hitzone').getBoundingClientRect();
  const x = r.left + 30, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
  return { id: s.id, top: r.top, h: r.height, x, y, topbarBottom: document.getElementById('topbar').getBoundingClientRect().bottom,
    onTop: top?.closest('.section-hitzone')?.closest('.section-block')?.id === s.id, topbarOnTop: !!top?.closest('#topbar') };
}, i);
const clickSelects = async (page, s) => { await page.mouse.click(s.x, s.y); await raf2(page);
  return page.evaluate((id) => document.getElementById(id).classList.contains('selected'), s.id); };

test('L1 연 직후 — 첫 섹션 라벨 띠가 툴바 밑에 안 깔리고 눌린다 (둘째 섹션 대조)', async ({ page }) => {
  const errs = await setup(page);
  const top0 = await page.evaluate(() => document.getElementById('canvas-wrap').scrollTop);   // «연 직후» 스크롤 — 섹션 띠를 누르면 캔버스가 그 섹션 쪽으로 내려가므로 둘째도 이 자리에서 잰다
  for (const i of [0, 1]) {
    await page.evaluate((t) => { document.getElementById('canvas-wrap').scrollTop = t; }, top0); await raf2(page);
    const s = await strip(page, i);
    expect(s.top, `섹션 ${i + 1} 띠 윗변 ${s.top} ≥ 툴바 아래끝 ${s.topbarBottom}`).toBeGreaterThanOrEqual(s.topbarBottom);
    expect(s.onTop, `섹션 ${i + 1} 띠 가운데 맨 위 = 그 띠`).toBe(true);
    expect(await clickSelects(page, s), `섹션 ${i + 1} 띠 진짜 클릭 = 그 섹션 골라짐`).toBe(true);
    await page.evaluate(() => window.deselectAll?.()); await raf2(page);
  }
  expect(errs).toEqual([]);
});

test('L2 ★양성대조 — 쉼 스크롤을 띠 높이만큼 내리면 첫 섹션 띠는 툴바 밑(맨 위 = #topbar · 클릭해도 안 골라짐)', async ({ page }) => {
  await setup(page);
  const s0 = await strip(page, 0);
  await page.evaluate((d) => { document.getElementById('canvas-wrap').scrollTop += d; }, (s0.top - s0.topbarBottom) + s0.h);
  await raf2(page);
  const s = await strip(page, 0);
  expect(s.top).toBeLessThan(s.topbarBottom);
  expect(s.onTop, '띠가 아직 맨 위다 — 이 대조가 L1 을 가르지 못한다').toBe(false);
  expect(s.topbarOnTop, '그 자리 맨 위 = #topbar').toBe(true);
  expect(await clickSelects(page, s), '툴바 밑 띠를 눌렀는데 골라졌다').toBe(false);
});

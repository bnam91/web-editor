/* radial-cell-default-t406.dom.spec.js — t4-06 라디얼 블럭 칸(에셋) 기본 120 · 빈 칸 = 체크 무늬
 * 원문: 「t4-06 에셋의 크기는 기본 추가될 때 120으로 해주고 안쪽은 서클이미지블럭처럼 단순히 체크패턴들어간 에셋블럭이면 된다.」
 * 수지 실측(ca702d40): 칸 크기 기본 160(120 아님) · 칸 안은 #e8e8e8 바탕 + 이미지 아이콘, 체크 무늬 아님.
 * 칸
 *   P0  전제 — 새 라디얼 블럭이 서고 칸이 여럿 · 칸에 그림이 없다(빈 칸)
 *   S   새 블럭 dataset.cellSize = 120 · 그려진 칸 지름 = 120(모델 px)
 *   K   빈 칸 바탕 = 체크 무늬(repeating-conic-gradient) · 그림 아이콘(.rdl-ph) 0
 *   F   칸 색을 고르면(기본값 아님) 그 색이 보인다(체크 무늬 위에 인라인 색)
 * 양성대조: GD1001_ROOT=<핀 d772f49e 사본> ⇒ S·K 빨강 · P0 초록.
 * ⛔고정 대기 없음 — waitForFunction 만. ⛔앱 무접촉(_root-harness.bootApp). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection(); const sec = c.querySelector('.section-block');
    window.selectSection(sec); window.addRadialBlock();
    window.__r = sec.querySelector('.radial-block'); window.applyZoom?.(100);
  });
  await page.waitForFunction(() => !!window.__r && window.__r.querySelectorAll('.rdl-cell').length >= 3);
  return errs;
}
const cells = (page) => page.evaluate(() => [...window.__r.querySelectorAll('.rdl-cell:not(.rdl-cell--dot)')].map(c => {
  const cs = getComputedStyle(c); const z = c.getBoundingClientRect().width / (c.offsetWidth || 1);
  return { empty: c.classList.contains('rdl-cell--empty'), w: Math.round(c.offsetWidth), bgImg: cs.backgroundImage.slice(0, 26), bgCol: cs.backgroundColor, ph: c.querySelectorAll('.rdl-ph').length, pic: c.querySelectorAll('.rdl-cell-img').length, z: +z.toFixed(2) };
}));

test('P0 전제 — 새 라디얼 블럭 · 칸 여럿 · 다 빈 칸', async ({ page }) => {
  const errs = await setup(page);
  const cs = await cells(page);
  expect(cs.length).toBeGreaterThanOrEqual(3);
  expect(cs.every(c => c.pic === 0)).toBe(true);
  expect(errs).toEqual([]);
});
test('S 새 블럭 칸 크기 120', async ({ page }) => {
  const errs = await setup(page);
  expect(await page.evaluate(() => window.__r.dataset.cellSize)).toBe('120');
  const cs = await cells(page);
  expect(cs.every(c => c.w === 120)).toBe(true);
  expect(errs).toEqual([]);
});
test('K 빈 칸 = 체크 무늬 · 아이콘 0', async ({ page }) => {
  const errs = await setup(page);
  const cs = await cells(page);
  expect(cs.every(c => c.empty && c.bgImg.startsWith('repeating-conic-gradient') && c.ph === 0)).toBe(true);
  expect(errs).toEqual([]);
});
test('F 칸 색을 고르면 그 색이 보인다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { const r = window.updateRadialBlock?.(window.__r.id, { cellFill: '#12ab34' }); if (!r || r.ok === false) { window.__r.dataset.cellFill = '#12ab34'; window.renderRadialBlock?.(window.__r); } });
  await page.waitForFunction(() => getComputedStyle(window.__r.querySelector('.rdl-cell')).backgroundColor === 'rgb(18, 171, 52)');
  expect(errs).toEqual([]);
});

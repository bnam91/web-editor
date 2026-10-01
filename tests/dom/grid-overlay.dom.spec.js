/* grid-overlay.dom.spec.js — 현빈 2026-10-01 「그리드 블럭도 오버레이되는 기능이 필요하다」
 * 텍스트·도형·에셋과 같은 공용 오버레이(js/overlay-float.js) — 그리드는 posElOf 가 «자기 자신».
 * mousedown 다툼은 텍스트 오버레이 규칙 그대로(지디 조건 ①): 끌면 이동 · 안 움직인 클릭은 원래 동작 ·
 *   편집 중 글자와 손잡이 위에선 이동 안 함. 그리드의 칸 경계·줄 손잡이는 그리드 «밖» 손잡이 층이라 다툼이 없다.
 * ★렌더 폭 줄의 조건 둘(떠 있음 · 좌우 패딩 제외) — G3 이 «둘 다 참»을 잰다(지디 조건 ②).
 * ★대조(같은 판, 조건만 바꿈): G0 — 같은 그리드에서 overlayBlock 표식만 없으면 다시 그릴 때 100% 로 돌아간다.
 * ★양성대조 판 7699ea33: 버튼이 없어 «전제에서 지는» 약한 빨강 — 명부에 따로. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page, { fullBleed = false } = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate((fb) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="40" style="padding-left:40px;padding-right:40px">
      <div class="gap-block" data-type="gap" style="height:80px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:500px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: '왼칸' }] }, { width: 1, lines: [{ type: 'body', text: '오른칸' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g);
    if (fb) { g.dataset.fullBleed = 'true'; window.applyBlockFullBleed(g); }
    window.deselectAll?.(); document.getElementById('gS').scrollIntoView({ block: 'start' });
  }, fullBleed);
  await page.waitForTimeout(250);
}
/* 섹션 기준 자리·폭(모델 px — 배율 무관) */
const geo = (page) => page.evaluate(() => { const sec = document.getElementById('gS'), g = document.getElementById('gG');
  const s = sec.getBoundingClientRect(), b = g.getBoundingClientRect(), k = s.width / sec.offsetWidth;
  return { x: Math.round((b.left - s.left) / k), y: Math.round((b.top - s.top) / k), w: Math.round(b.width / k), r: Math.round((s.right - b.right) / k),
           float: g.dataset.overlayBlock === 'true', parent: g.parentElement.id || g.parentElement.className, styleW: g.style.width, ml: g.style.marginLeft }; });
async function openPanel(page) {
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('gG').getBoundingClientRect(); return [r.left + 6, r.top + 6]; });
  await page.mouse.click(x, y); await page.waitForTimeout(250);
}
async function toggle(page) {
  await page.click('#grd-float-toggle'); await page.waitForTimeout(250);
}
const rerender = (page, gap) => page.evaluate((gap) => { const g = document.getElementById('gG'); g.dataset.gap = String(gap); window.renderGridBlock(g); }, gap);

test('G0 대조 — 안 띄운 그리드는 다시 그리면 폭 100%(섹션 패딩 안)', async ({ page }) => {
  await setup(page);
  await rerender(page, 60);
  const g = await geo(page);
  expect(g.styleW).toBe('100%'); expect(g.x).toBe(40); expect(g.r).toBe(40);
});
test('G1 ★패널 「오버레이」 → 섹션 위에 뜬다(자리 그대로, 점프 없음) · 다시 누르면 원래 줄로', async ({ page }) => {
  await setup(page);
  const g0 = await geo(page);
  await openPanel(page);
  expect(await page.isVisible('#grd-float-toggle'), '그리드 패널에 오버레이 버튼').toBe(true);
  await toggle(page);
  const g1 = await geo(page);
  expect(g1.float).toBe(true);
  expect(Math.abs(g1.x - g0.x) + Math.abs(g1.y - g0.y), '띄워도 화면 자리 그대로').toBeLessThanOrEqual(1);
  expect(g1.w).toBe(g0.w);
  await toggle(page);
  const g2 = await geo(page);
  expect(g2).toMatchObject({ float: false, parent: 'gR', x: g0.x, y: g0.y, w: g0.w });
});
test('G2 ★띄운 뒤 다시 그려도(열 간격 변경) 폭이 굳힌 px 그대로 — 섹션 전폭으로 안 펴진다', async ({ page }) => {
  await setup(page);
  const g0 = await geo(page);
  await openPanel(page); await toggle(page);
  await rerender(page, 60);
  const g = await geo(page);
  expect(g.float).toBe(true);
  expect(g.styleW).toMatch(/^\d+px$/);
  expect(g.w).toBe(g0.w);
});
test('G3 ★「좌우 패딩 제외」 + 오버레이 둘 다 참 — 띄워도 자리·폭 그대로 · 다시 그려도 그대로 · 내리면 패딩 제외가 돌아온다(R1 과 같은 양쪽 0)', async ({ page }) => {
  await setup(page, { fullBleed: true });
  const g0 = await geo(page);
  expect({ x: g0.x, r: g0.r }, '전제 — 패딩 제외가 걸려 양쪽이 섹션 끝').toEqual({ x: 0, r: 0 });
  await openPanel(page);
  expect(await page.isVisible('#grd-use-padx'), '전제 — 안 띄웠을 땐 패딩 제외 칸이 보인다').toBe(true);
  await toggle(page);
  let g = await geo(page);
  expect(g.float).toBe(true);
  expect({ x: g.x, y: g.y, w: g.w }).toEqual({ x: g0.x, y: g0.y, w: g0.w });
  expect(await page.isVisible('#grd-use-padx'), '떠 있는 동안엔 패딩 제외 칸을 숨긴다(못 거는 자리)').toBe(false);
  await rerender(page, 60);
  g = await geo(page);
  expect({ x: g.x, w: g.w }, '떠 있는 동안 다시 그려도 그대로').toEqual({ x: g0.x, w: g0.w });
  await toggle(page);
  g = await geo(page);
  expect({ float: g.float, x: g.x, r: g.r }).toEqual({ float: false, x: 0, r: 0 });
  await rerender(page, 30);
  g = await geo(page);
  expect({ x: g.x, r: g.r }, '내린 뒤 다시 그려도 양쪽 0(7bb0761f R1 과 같은 꼴)').toEqual({ x: 0, r: 0 });
});
test('G4 ★띄운 그리드를 칸 위에서 끌면 움직인다 · 안 움직인 클릭은 자리 그대로', async ({ page }) => {
  await setup(page);
  await openPanel(page); await toggle(page);
  const g0 = await geo(page);
  const [x, y] = await page.evaluate(() => { const r = document.querySelector('#gG .grd-cell[data-c="1"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(x, y); await page.waitForTimeout(150);
  expect(await geo(page), '클릭만 = 그대로').toMatchObject({ x: g0.x, y: g0.y });
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + i * 6, y + i * 5);
  await page.mouse.up(); await page.waitForTimeout(150);
  const g1 = await geo(page);
  expect(g1.float).toBe(true);
  expect(g1.x - g0.x, '오른쪽으로 끌었다').toBeGreaterThan(20);
  expect(g1.y - g0.y, '아래로 끌었다').toBeGreaterThan(20);
});
test('G5 ★저장·다시 열기 뒤에도 떠 있고, 폭이 그대로이고, 끌린다', async ({ page }) => {
  await setup(page);
  await openPanel(page); await toggle(page);
  const g0 = await geo(page);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('gS').scrollIntoView({ block: 'start' }));
  const g1 = await geo(page);
  expect({ float: g1.float, x: g1.x, y: g1.y, w: g1.w }).toEqual({ float: true, x: g0.x, y: g0.y, w: g0.w });
  const [x, y] = await page.evaluate(() => { const r = document.querySelector('#gG .grd-cell[data-c="0"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + i * 6, y + i * 5);
  await page.mouse.up(); await page.waitForTimeout(150);
  expect((await geo(page)).x - g1.x, '다시 연 뒤에도 끌린다').toBeGreaterThan(20);
});

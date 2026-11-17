/* preview-horizontal — 0.9.12 SECTION-HORIZONTAL-SPREAD-VIEW-IDEATION-01 (현빈 결정 261117) «⇆ 가로» 미리보기
 *   js/preview.js togglePreviewHorizontal · setSectionRowLayout(그릇 하나 · 배치는 CSS .section-row-layout)
 * 칸:
 *   H1 켜면 섹션 x 가 왼→오 증가 · y 같음 / 끄면 처음 자리(세로)로 원복 · 편집 캔버스 섹션 수·스크래치 항목 수 무변
 *   H2 페이지 둘 — 페이지마다 한 줄(그 줄 안 y 같음) · 두 줄은 위아래(뒤 페이지 줄이 아래)
 *   H3 Side by Side 와 배타 — 가로 켠 채 SBS 켜면 가로 꺼짐 · SBS 켠 채 가로 켜면 SBS 꺼짐(본문 다시 보임)
 *   H4 줌 — 가로에서 previewZoomStep(−50) 하면 섹션 화면 폭이 반 · 가로 그대로
 *   H5 Esc 로 나가면 정리 — 단추 꺼짐 · 다시 들어가면 세로
 *   H6 가로에서 섹션 누르면 편집으로 돌아가 그 섹션이 골라진다(같은 페이지)
 * 양성대조: _patches/PVH-CTL-no-row.patch(setSectionRowLayout 의 class 켜는 한 줄 삭제) → H1·H2·H3·H4 빨강(H3 은 줄 수 단언) · H5·H6 초록.
 * ⛔고정 대기 0 · 자리는 offsetLeft/offsetTop(레이아웃 px · 줌 transform 무관) · 화면 px 는 비율로만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, { pages = 1 } = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async (pages) => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    for (let i = 0; i < 3; i++) await window.addSection();
    window.flushCurrentPage();
    if (pages > 1) window.state.pages.push({ id: 'page_hz2', name: 'Page 2', label: '', pageSettings: { ...window.state.pageSettings }, canvas: window.state.pages[0].canvas });
    const before = { canvasSecs: document.querySelectorAll('#canvas .section-block').length, scratch: document.querySelectorAll('.scratch-item').length };
    window.enterPreview();
    return { before, ids: [...document.querySelectorAll('#canvas .section-block')].map((s) => s.id) };
  }, pages);
  await expect(page.locator('body.preview-mode'), '[전제] 미리보기').toHaveCount(1);
  return { errs, ...r };
}
const pos = (page) => page.evaluate(() => [...document.querySelectorAll('#preview-content .preview-page-block')].map((b) =>
  [...b.querySelectorAll('.preview-page-inner > .section-block')].map((s) => ({ x: s.offsetLeft, y: s.offsetTop }))));
const hz = (page, on) => page.evaluate((on) => window.togglePreviewHorizontal(on), on);
const state = (page) => page.evaluate(() => ({
  hzBtn: !!document.getElementById('preview-hz-btn')?.classList.contains('active'),
  rows: document.querySelectorAll('#preview-content .preview-page-inner.section-row-layout').length,
  sbsBtn: !!document.getElementById('preview-sbs-btn')?.classList.contains('active'),
  content: getComputedStyle(document.getElementById('preview-content')).display,
}));
const incr = (a) => a.every((v, i) => i === 0 || v > a[i - 1]);
const same = (a) => a.every((v) => Math.abs(v - a[0]) < 1);

test('H1 켜면 왼→오 한 줄(x 증가 · y 같음) · 끄면 원복 · 캔버스·스크래치 무변', async ({ page }) => {
  const { errs, before } = await scene(page);
  const [p0] = await pos(page);
  expect({ n: p0.length, yIncr: incr(p0.map((q) => q.y)), xSame: same(p0.map((q) => q.x)) }, '[전제] 세로 셋').toEqual({ n: 3, yIncr: true, xSame: true });
  await hz(page, true);
  const [p1] = await pos(page);
  expect({ xIncr: incr(p1.map((q) => q.x)), ySame: same(p1.map((q) => q.y)), st: await state(page) }, '★가로 한 줄').toEqual({ xIncr: true, ySame: true, st: { hzBtn: true, rows: 1, sbsBtn: false, content: 'block' } });
  await hz(page, false);
  expect(await pos(page), '★끄면 처음 자리').toEqual([p0]);
  expect((await state(page)).rows).toBe(0);
  expect(await page.evaluate(() => ({ canvasSecs: document.querySelectorAll('#canvas .section-block').length, scratch: document.querySelectorAll('.scratch-item').length })), '편집 캔버스·스크래치 무변').toEqual(before);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H2 페이지 둘 — 페이지마다 한 줄 · 두 줄은 위아래', async ({ page }) => {
  const { errs } = await scene(page, { pages: 2 });
  await hz(page, true);
  const rows = await pos(page);
  expect(rows.map((r) => ({ n: r.length, xIncr: incr(r.map((q) => q.x)), ySame: same(r.map((q) => q.y)) })), '★페이지마다 한 줄').toEqual([{ n: 3, xIncr: true, ySame: true }, { n: 3, xIncr: true, ySame: true }]);
  const tops = await page.evaluate(() => [...document.querySelectorAll('#preview-content .preview-page-block')].map((b) => b.offsetTop));
  expect(incr(tops), `★두 줄은 위아래 ${JSON.stringify(tops)}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H3 Side by Side 와 배타', async ({ page }) => {
  const { errs } = await scene(page);
  await hz(page, true);
  await page.evaluate(() => window.togglePreviewSideBySide());
  expect(await state(page), '가로 켠 채 SBS → 가로 꺼짐').toEqual({ hzBtn: false, rows: 0, sbsBtn: true, content: 'none' });
  await hz(page, true);
  expect(await state(page), 'SBS 켠 채 가로 → SBS 꺼짐 · 본문 보임').toEqual({ hzBtn: true, rows: 1, sbsBtn: false, content: 'block' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H4 줌 — 가로에서도 먹는다', async ({ page }) => {
  const { errs } = await scene(page);
  await hz(page, true);
  const w = () => page.evaluate(() => document.querySelector('#preview-content .section-block').getBoundingClientRect().width);
  const w0 = await w();
  await page.evaluate(() => window.previewZoomStep(-50));
  const ratio = (await w()) / w0;
  expect(ratio, `★화면 폭 비율 ${ratio}`).toBeCloseTo(0.5, 2);
  const [p] = await pos(page);
  expect({ xIncr: incr(p.map((q) => q.x)), ySame: same(p.map((q) => q.y)) }, '가로 그대로').toEqual({ xIncr: true, ySame: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H5 Esc 로 나가면 정리 · 다시 들어가면 세로', async ({ page }) => {
  const { errs } = await scene(page);
  await hz(page, true);
  await page.keyboard.press('Escape');
  await expect(page.locator('body.preview-mode'), '[전제] 나감').toHaveCount(0);
  expect(await page.evaluate(() => document.getElementById('preview-hz-btn').classList.contains('active'))).toBe(false);
  await page.evaluate(() => window.enterPreview());
  expect((await state(page)).rows, '다시 들어가면 세로').toBe(0);
  const [p] = await pos(page);
  expect(incr(p.map((q) => q.y))).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H6 가로에서 섹션 누르면 편집으로 돌아가 그 섹션이 골라진다', async ({ page }) => {
  const { errs, ids } = await scene(page);
  await hz(page, true);
  const c = await page.evaluate(() => { const s = document.querySelectorAll('#preview-content .section-block')[2]; s.scrollIntoView({ block: 'center', inline: 'center' }); const q = s.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2, s.id]; });
  expect(c[2], '[전제] 셋째 섹션 = 캔버스 셋째와 같은 id').toBe(ids[2]);
  await page.mouse.click(c[0], c[1]);
  await expect(page.locator('body.preview-mode'), '★편집으로 돌아감').toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.getSelectedSection()?.id), '★그 섹션이 골라짐').toBe(ids[2]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* slide-fb — 현빈 슬라이드 피드백 261118(지디/handoff/ANALYSIS-slide-feedback-261118.md 1·2절) · 가지 ty/slide-fb-261118.
 * F1 SLIDE-SCRATCH-DND-01: 스크래치 그림을 슬라이드 위에 놓으면 → 판정 'slide' · 안내 «슬라이드에 추가» · 슬라이드 «끝»에 한 장 · 옆에 새 에셋 0
 *    · 12장 가득이면 안 붙고 false · 받지 않는 주소(javascript:)도 false
 *    (js/canvas-scratch-drop.js 의 진짜 판정·실행 = scratch-pad onUp 이 부르는 previewScratchDropAt·commitScratchDropAt — cert-block S1 과 같은 꼴)
 * 양성대조(CTL · _patches/): F1 = slide-fb-CTL1-no-branch.patch(케이스 A4 판정 덩이 삭제) → F1 빨강(rowLike insert = 옆에 새 에셋)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function pngs(page) {
  return page.evaluate(() => ['#ff0000', '#0000ff'].map((c) => { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 40, 30); return cv.toDataURL('image/png'); }));
}
async function scene(page, slides) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const [R, B] = await pngs(page);
  const id = await page.evaluate(async ({ n, R }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block'); window.selectSection(sec);
    const { row, block } = window.makeSlideBlock({ slides: Array.from({ length: n }, () => ({ src: R })) });
    (sec.querySelector('.section-inner') || sec).appendChild(row); window.bindBlock?.(block);
    block.scrollIntoView({ block: 'center' });
    return block.id;
  }, { n: slides, R });
  return { errs, id, R, B };
}
const center = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
const count = (page, id) => page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.slides).length, id);

test('F1 스크래치 → 슬라이드 끝에 한 장 · 옆에 새 에셋 0 · 가득/이상한 주소 = 안 들어감', async ({ page }) => {
  const { errs, id, B } = await scene(page, 1);
  const p = await center(page, id);
  const assets0 = await page.locator('#canvas .asset-block').count();
  expect(await page.evaluate(({ x, y }) => window.previewScratchDropAt(x, y), p)).toBe('slide');
  await expect(page.locator(`#${id} .sp2c-badge`)).toHaveText('슬라이드에 추가');
  const ok = await page.evaluate(({ x, y, src }) => { const r = window.commitScratchDropAt(x, y, src); window.clearScratchDropGuides?.(); return r; }, { ...p, src: B });
  expect(ok).toBe(true);
  const st = await page.evaluate((id) => { const b = document.getElementById(id); return { srcs: JSON.parse(b.dataset.slides).map((s) => s.src.slice(-12)), imgs: b.querySelectorAll('.sld-img').length }; }, id);
  expect(st.srcs.length).toBe(2);
  expect(st.srcs[1]).toBe(B.slice(-12));   // 끝에
  expect(st.imgs).toBe(2);
  expect(await page.locator('#canvas .asset-block').count(), '★옆에 새 에셋(rowLike insert)').toBe(assets0);
  const bad = await page.evaluate(({ x, y }) => { const r = window.commitScratchDropAt(x, y, 'javascript:window.__pwn=1'); window.clearScratchDropGuides?.(); return r; }, p);
  expect(bad).toBe(false);
  expect(await count(page, id)).toBe(2);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F1b 12장 가득 → 안 붙음 · 말함', async ({ page }) => {
  const { errs, id, B } = await scene(page, 12);
  const p = await center(page, id);
  const ok = await page.evaluate(({ x, y, src }) => { const r = window.commitScratchDropAt(x, y, src); window.clearScratchDropGuides?.(); return r; }, { ...p, src: B });
  expect(ok).toBe(false);
  expect(await count(page, id)).toBe(12);
  await expect(page.locator('#editor-toast')).toContainText('12장까지');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* slide-fb — 현빈 슬라이드 피드백 261118(지디/handoff/ANALYSIS-slide-feedback-261118.md 1·2절) · 가지 ty/slide-fb-261118.
 * F1 SLIDE-SCRATCH-DND-01: 스크래치 그림을 슬라이드 위에 놓으면 → 판정 'slide' · 안내 «슬라이드에 추가» · 슬라이드 «끝»에 한 장 · 옆에 새 에셋 0
 *    · 12장 가득이면 안 붙고 false · 받지 않는 주소(javascript:)도 false
 *    (js/canvas-scratch-drop.js 의 진짜 판정·실행 = scratch-pad onUp 이 부르는 previewScratchDropAt·commitScratchDropAt — cert-block S1 과 같은 꼴)
 * F2 SLIDE-PADDING-EXCLUDE-01: 섹션 좌우 패딩 40 → 패널 «패딩 제외»(#sld-fullbleed · Padding 절) 켜기 = 슬라이드 폭 = 섹션 안쪽 + 2·40 · 왼끝 = 섹션 왼끝 ·
 *    섹션 패딩 20 으로 바꾸면 따라감(−20) · 끄기 = 원래 폭 · ⌘Z 한 번 = 켜기 전
 * 양성대조(CTL · _patches/): F1 = slide-fb-CTL1-no-branch.patch(케이스 A4 판정 덩이 삭제) → F1 빨강(rowLike insert = 옆에 새 에셋)
 *   F2 = slide-fb-CTL2-no-bleed.patch(renderSlideBlock 의 applyBlockFullBleed 줄 삭제) → F2 빨강(켜도 안 넓어짐)
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

const geo = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id), sec = b.closest('.section-block'), inner = sec.querySelector('.section-inner');
  const k = sec.getBoundingClientRect().width / sec.offsetWidth, br = b.getBoundingClientRect(), sr = sec.getBoundingClientRect();
  return { w: Math.round(br.width / k), left: Math.round((br.left - sr.left) / k), innerW: inner.clientWidth, ml: b.style.marginLeft, fb: b.dataset.fullBleed || null };
}, id);

test('F2 패딩 제외 — 켜면 섹션 끝까지 · 패딩 바뀌면 따라감 · 끄면 원래 · ⌘Z', async ({ page }) => {
  const { errs, id } = await scene(page, 2);
  await page.evaluate((id) => { const inner = document.getElementById(id).closest('.section-inner'); inner.dataset.paddingX = '40'; window.applyPadXToSection(inner, 40); }, id);
  const g0 = await geo(page, id);
  expect(g0.left, '[전제] 꺼짐 = 섹션 패딩 안쪽').toBe(40);
  await page.evaluate((id) => window.selectBlock(id), id);
  await expect(page.locator('#sld-fullbleed'), '[전제] Padding 절에 «패딩 제외»').toHaveCount(1);
  await page.locator('#sld-fullbleed').check({ force: true });
  const g1 = await geo(page, id);
  expect({ fb: g1.fb, left: g1.left, w: g1.w }).toEqual({ fb: 'true', left: 0, w: g0.w + 80 });
  await page.evaluate((id) => { const inner = document.getElementById(id).closest('.section-inner'); inner.dataset.paddingX = '20'; window.applyPadXToSection(inner, 20); }, id);
  const g2 = await geo(page, id);
  expect({ left: g2.left, ml: g2.ml }).toEqual({ left: 0, ml: '-20px' });
  await page.evaluate((id) => { const inner = document.getElementById(id).closest('.section-inner'); inner.dataset.paddingX = '40'; window.applyPadXToSection(inner, 40); window.selectBlock(id); }, id);
  await page.locator('#sld-fullbleed').uncheck({ force: true });
  const g3 = await geo(page, id);
  expect({ fb: g3.fb, left: g3.left, w: g3.w }).toEqual({ fb: null, left: 40, w: g0.w });
  await page.locator('#sld-fullbleed').check({ force: true });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await geo(page, id)).left, '⌘Z 한 번 = 켜기 전').toBe(40);
  expect(errs, errs.join(' | ')).toEqual([]);
});

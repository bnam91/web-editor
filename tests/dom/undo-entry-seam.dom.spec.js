/* undo-entry-seam.dom.spec.js — push-before 입구 뒤 패널 편집(push-after)의 ⌘Z 한 번이 입구까지 같이 풀던 것(js/CLAUDE.md 히스토리 규약 ⑴).
 *   E 효과 ✕ 끄기 · G 그리드 열 ＋ · F 그리드 칼럼 펴기 · S 슬라이더 끌기 — 입구 끝 표본이 있어야 ⌘Z 한 번 = 패널 편집 · 두 번 = 입구.
 *   음성대조: 끝 표본 줄만 빼면 E·G 빨강.
 * ⛔고정 대기 없음 — 조건 대기만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const { hitAt } = require('./_click-at.js');

const fsOf = (page) => page.evaluate(() => { const tb = document.getElementById(window.__tbId); return parseFloat(getComputedStyle(tb.querySelector('.tb-body') || tb.querySelector('[contenteditable]')).fontSize); });
const keys = (page) => page.evaluate(() => Object.keys(document.getElementById(window.__tbId).dataset).filter((k) => /^(tf|fx)/.test(k)).sort().join());
async function undo(page) { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); }

for (const [fx, del] of [['freetransform', 'fxft-del'], ['glow', 'fxgl-del']]) {
  test(`E ${fx} ✕ 끄기 → 패널 크기 → ⌘Z 한 번 = 크기만 · 한 번 더 = 효과가 돌아온다`, async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 1100 });
    const errs = await bootApp(page);
    await page.evaluate(() => {
      const c = document.getElementById('canvas');
      c.querySelectorAll('.section-block').forEach((s) => s.remove());
      window.addSection();
      const sec = c.querySelector('.section-block');
      sec.querySelectorAll('.text-block').forEach((t) => (t.closest('.frame-block[data-text-frame]') || t).remove());
      window.selectSection(sec);
      window.addTextBlock('body');
      window.applyZoom?.(100);
      window.__tbId = sec.querySelector('.text-block').id;
      document.getElementById(window.__tbId).scrollIntoView({ block: 'center' });
      window.selectBlock(window.__tbId);
    });
    await waitZoomSettled(page, 100);
    await page.waitForFunction(() => !!document.getElementById('txt-fx-add'));
    const k0 = await keys(page);
    await page.selectOption('#txt-fx-add', fx);
    await page.waitForFunction((k) => Object.keys(document.getElementById(window.__tbId).dataset).filter((x) => /^(tf|fx)/.test(x)).sort().join() !== k, k0);
    const kOn = await keys(page);
    await page.waitForFunction((d) => !!document.querySelector(`[id$="${d}"]`), del);
    await page.evaluate((d) => document.querySelector(`[id$="${d}"]`).click(), del);
    await page.waitForFunction((k) => Object.keys(document.getElementById(window.__tbId).dataset).filter((x) => /^(tf|fx)/.test(x)).sort().join() !== k, kOn);
    const kOff = await keys(page);
    const f0 = await fsOf(page);
    await page.click('#txt-size-number', { clickCount: 3 });
    await page.keyboard.type(String(Math.round(f0 * 2)));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.id === 'txt-size-number');
    expect(await fsOf(page), '전제: 크기가 먹었다').toBeGreaterThan(f0 + 1);
    await undo(page);
    await page.waitForFunction((f) => { const tb = document.getElementById(window.__tbId); return tb && Math.abs(parseFloat(getComputedStyle(tb.querySelector('.tb-body') || tb.querySelector('[contenteditable]')).fontSize) - f) < 0.2; }, f0);
    expect(await keys(page), '★⌘Z 한 번에 효과 끄기까지 풀렸다').toBe(kOff);
    await undo(page);
    await page.waitForFunction((k) => { const tb = document.getElementById(window.__tbId); return tb && Object.keys(tb.dataset).filter((x) => /^(tf|fx)/.test(x)).sort().join() === k; }, kOn);
    expect(errs, `앱 오류: ${errs.join(' | ')}`).toEqual([]);
  });
}

test('G 그리드 열 ＋ → 칸 간격 → ⌘Z 한 번 = 간격만 · 한 번 더 = 열이 줄어든다', async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    window.selectSection(sec); window._activeFrame = null;
    window.addGridBlock();
    window.applyZoom?.(100);
    window.__gId = c.querySelector('.grid-block').id;
    document.getElementById(window.__gId).scrollIntoView({ block: 'center' });
  });
  await waitZoomSettled(page, 100);
  const nCols = () => page.evaluate(() => JSON.parse(document.getElementById(window.__gId).dataset.cols || '[]').length);
  const gap = () => page.evaluate(() => document.getElementById(window.__gId).dataset.colGap ?? null);
  await page.waitForFunction(() => { const b = document.querySelector(`#grd-plus-layer > .grd-add-btn[data-grd-for="${window.__gId}"][data-grd-add="col"]`); return b && b.getBoundingClientRect().width > 0; });
  const p = await page.evaluate(() => { const r = document.querySelector(`#grd-plus-layer > .grd-add-btn[data-grd-for="${window.__gId}"][data-grd-add="col"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  expect((await hitAt(page, p.x, p.y))?.cls, '전제: 누른 점의 임자가 열 ＋').toContain('grd-add-btn');
  const c0 = await nCols();
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction((n) => JSON.parse(document.getElementById(window.__gId).dataset.cols || '[]').length === n + 1, c0);
  const g0 = await gap();
  await page.waitForFunction(() => !!document.getElementById('grd-col-gap-number'));
  await page.fill('#grd-col-gap-number', '30');
  await page.evaluate(() => document.getElementById('grd-col-gap-number').dispatchEvent(new Event('change', { bubbles: true })));
  await page.waitForFunction(() => document.getElementById(window.__gId).dataset.colGap === '30');
  await undo(page);
  await page.waitForFunction((g) => { const b = document.getElementById(window.__gId); return b && (b.dataset.colGap ?? null) === g; }, g0);
  expect(await nCols(), '★⌘Z 한 번에 열 ＋ 까지 풀렸다').toBe(c0 + 1);
  await undo(page);
  await page.waitForFunction((n) => { const b = document.getElementById(window.__gId); return b && JSON.parse(b.dataset.cols || '[]').length === n; }, c0);
  expect(errs, `앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('F 그리드 펴기 → 칸 간격 → ⌘Z 한 번 = 간격만 · 한 번 더 = 행이 돌아온다', async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    window.selectSection(c.querySelector('.section-block')); window._activeFrame = null;
    window.addGridBlock();
    window.applyZoom?.(100);
    window.__gId = c.querySelector('.grid-block').id;
    window.gridAddAtEnd(document.getElementById(window.__gId), 'row');
  });
  await waitZoomSettled(page, 100);
  const rows = () => page.evaluate(() => document.getElementById(window.__gId).dataset.rows ?? null);
  const r0 = await rows();
  expect(r0, '전제: 두 행 이상').toBeTruthy();
  await page.evaluate(() => window.gridCollapseToColumns(document.getElementById(window.__gId)));
  expect(await rows(), '전제: 펴졌다').toBeNull();
  await page.waitForFunction(() => !!document.getElementById('grd-col-gap-number'));
  await page.fill('#grd-col-gap-number', '30');
  await page.evaluate(() => document.getElementById('grd-col-gap-number').dispatchEvent(new Event('change', { bubbles: true })));
  await page.waitForFunction(() => document.getElementById(window.__gId).dataset.colGap === '30');
  await undo(page);
  await page.waitForFunction(() => { const b = document.getElementById(window.__gId); return b && b.dataset.colGap !== '30'; });
  expect(await rows(), '★⌘Z 한 번에 펴기까지 풀렸다').toBeNull();
  await undo(page);
  await page.waitForFunction((r) => { const b = document.getElementById(window.__gId); return b && b.dataset.rows === r; }, r0);
  expect(errs, `앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

async function dragSlider(page, sel) {
  const s = await page.evaluate((sel) => { const e = document.querySelector(sel); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return { l: q.left, r: q.right, y: q.top + q.height / 2 }; }, sel);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.mouse.move(s.l + (s.r - s.l) * 0.2, s.y);
  expect((await hitAt(page, s.l + (s.r - s.l) * 0.2, s.y))?.tag, '전제: 누른 점의 임자가 슬라이더').toBe('INPUT');
  await page.mouse.down(); await page.mouse.move(s.l + (s.r - s.l) * 0.7, s.y, { steps: 5 }); await page.mouse.up();
}
for (const [fx, sl] of [['glow', '[id$="fxgl-blur-slider"]'], ['reflect', '[id$="fx-len-slider"]']]) {
  test(`S ${fx} 슬라이더 끌기 → 패널 크기 → ⌘Z 한 번 = 크기만 · 한 번 더 = 끌기 전`, async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 1100 });
    const errs = await bootApp(page);
    await page.evaluate(() => {
      const c = document.getElementById('canvas');
      c.querySelectorAll('.section-block').forEach((s) => s.remove());
      window.addSection();
      const sec = c.querySelector('.section-block');
      sec.querySelectorAll('.text-block').forEach((t) => (t.closest('.frame-block[data-text-frame]') || t).remove());
      window.selectSection(sec);
      window.addTextBlock('body');
      window.applyZoom?.(100);
      window.__tbId = sec.querySelector('.text-block').id;
      window.selectBlock(window.__tbId);
    });
    await waitZoomSettled(page, 100);
    await page.waitForFunction(() => !!document.getElementById('txt-fx-add'));
    await page.selectOption('#txt-fx-add', fx);
    await page.waitForFunction((sl) => !!document.querySelector(sl), sl);
    const fxv = () => page.evaluate(() => JSON.stringify(Object.entries(document.getElementById(window.__tbId).dataset).filter(([k]) => /^fx/.test(k))));
    const v0 = await fxv();
    await dragSlider(page, sl);
    await page.waitForFunction((v) => JSON.stringify(Object.entries(document.getElementById(window.__tbId).dataset).filter(([k]) => /^fx/.test(k))) !== v, v0);
    const v1 = await fxv();
    const f0 = await fsOf(page);
    await page.click('#txt-size-number', { clickCount: 3 });
    await page.keyboard.type(String(Math.round(f0 * 2)));
    await page.keyboard.press('Enter');
    await page.waitForFunction((f) => { const tb = document.getElementById(window.__tbId); return parseFloat(getComputedStyle(tb.querySelector('.tb-body') || tb.querySelector('[contenteditable]')).fontSize) > f + 1; }, f0);
    await undo(page);
    await page.waitForFunction((f) => { const tb = document.getElementById(window.__tbId); return tb && Math.abs(parseFloat(getComputedStyle(tb.querySelector('.tb-body') || tb.querySelector('[contenteditable]')).fontSize) - f) < 0.2; }, f0);
    expect(await fxv(), '★⌘Z 한 번에 슬라이더 끌기까지 풀렸다').toBe(v1);
    await undo(page);
    await page.waitForFunction((v) => { const tb = document.getElementById(window.__tbId); return tb && JSON.stringify(Object.entries(tb.dataset).filter(([k]) => /^fx/.test(k))) === v; }, v0);
    expect(errs, `앱 오류: ${errs.join(' | ')}`).toEqual([]);
  });
}

test('S bindSlider(그리드 배경 여백) 끌기 → 칸 간격 → ⌘Z 한 번 = 간격만', async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    window.selectSection(c.querySelector('.section-block')); window._activeFrame = null;
    window.addGridBlock();
    window.applyZoom?.(100);
    const g = c.querySelector('.grid-block'); window.__gId = g.id;
    window.updateGridBlock(g.id, { blockBg: { on: true } });
    window.selectBlock?.(g.id);
  });
  await waitZoomSettled(page, 100);
  await page.waitForFunction(() => !!document.getElementById('grd-bbg-padx-slider'));
  const pick = () => { const { colGap, ...rest } = document.getElementById(window.__gId).dataset; return JSON.stringify(rest); };
  await page.evaluate(`window.__pick = ${pick.toString()}`);
  const ds = () => page.evaluate(() => window.__pick());
  const v0 = await ds();
  await dragSlider(page, '#grd-bbg-padx-slider');
  await page.waitForFunction((v) => window.__pick() !== v, v0);
  const v1 = await ds();
  await page.fill('#grd-col-gap-number', '30');
  await page.evaluate(() => document.getElementById('grd-col-gap-number').dispatchEvent(new Event('change', { bubbles: true })));
  await page.waitForFunction(() => document.getElementById(window.__gId).dataset.colGap === '30');
  await undo(page);
  await page.waitForFunction(() => { const b = document.getElementById(window.__gId); return b && b.dataset.colGap !== '30'; });
  expect(await ds(), '★⌘Z 한 번에 슬라이더 끌기까지 풀렸다').toBe(v1);
  expect(errs, `앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

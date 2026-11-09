/* grid-divider-width.dom.spec.js — 1109t1A3 (현빈 「그리드 블럭에 구분선 줄 추가한 뒤 너비 조절기능 추가해줄 것」).
 * ★너비 = 구분선의 «가로 길이»(칸 콘텐츠 폭 대비 %, 줄 필드 widthPct · 5~100 클램프 · 100/없음 = 꽉 참).
 *   W1 패널 #grd-divider-w (구분선 줄에만) 50 → 폭 ≈ 칸의 절반 · W2 PNG 클론 픽셀도 절반 · W3 저장 왕복
 *   W4 ⌘Z 한 번 = 꽉 참 · W5 입구 클램프(999 → 꽉 참 · 2 → 5%) · W6 줄 정렬 가운데 → 좌우 틈 같음
 * 실행: tests/dom/playwright.dom.config.js grid-divider-width */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const COND_MS = 15000;
const DARK = '#000000';
const frames2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));

async function setup(page, divider = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((dv) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    const lines = [{ type: 'body', text: 'A' }, { type: 'divider', height: 4, color: '#000000', ...dv }, { type: 'body', text: 'C' }];
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
  }, divider);
  await page.waitForFunction(() => !!document.querySelector('#gG .grd-divider'), null, { timeout: COND_MS });
  return errs;
}
/** 구분선 폭 · 칸 콘텐츠 폭 · 좌우 틈 (px). */
const geo = (page) => page.evaluate(() => {
  const d = document.querySelector('#gG .grd-divider'); const p = d.parentElement; const cs = getComputedStyle(p);
  const pr = p.getBoundingClientRect(), dr = d.getBoundingClientRect();
  const l = pr.left + parseFloat(cs.paddingLeft), r = pr.right - parseFloat(cs.paddingRight);
  return { w: dr.width, cw: r - l, gapL: dr.left - l, gapR: r - dr.right };
});
const model = (page) => page.evaluate(() => JSON.parse(document.getElementById('gG').dataset.cols)[0].lines[1]);
/** 진짜 마우스로 구분선 줄을 고른다(블록 선택 → 줄 선택). */
async function selectDivider(page) {
  let r = await waitStableRect(page, '#gG .grd-divider');
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction(() => document.getElementById('gG')?.classList.contains('selected'), null, { timeout: COND_MS });
  r = await waitStableRect(page, '#gG .grd-divider');
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction(() => !!document.getElementById('grd-divider-h'), null, { timeout: COND_MS });
}
async function typeInto(page, id, v) {
  const r = await waitStableRect(page, '#' + id);
  await page.mouse.click(r.cx, r.cy);
  await page.keyboard.press('Meta+a'); await page.keyboard.type(String(v)); await page.keyboard.press('Enter');
}

test('W1 ★#grd-divider-w 는 구분선 줄에만 · 50 → 구분선 폭 ≈ 칸 콘텐츠 폭의 절반', async ({ page }) => {
  const errs = await setup(page);
  // 대조 — 글자 줄에는 너비 칸이 없다
  const t = await waitStableRect(page, '#gG .grd-cell[data-r="0"][data-c="0"] [data-line="0"]');
  await page.mouse.click(t.cx, t.cy);
  await page.waitForFunction(() => document.getElementById('gG')?.classList.contains('selected'), null, { timeout: COND_MS });
  await page.mouse.click(t.cx, t.cy);
  await page.waitForFunction(() => !!document.getElementById('grd-line-toggle'), null, { timeout: COND_MS });
  expect(await page.evaluate(() => !!document.getElementById('grd-divider-w')), '글자 줄에 너비 칸이 났다').toBe(false);
  await page.evaluate(() => window.deselectAll?.());
  await selectDivider(page);
  const g0 = await geo(page);
  expect(Math.abs(g0.w - g0.cw)).toBeLessThanOrEqual(1);
  await typeInto(page, 'grd-divider-w', 50);
  await page.waitForFunction(() => /width:50%/.test(document.querySelector('#gG .grd-divider')?.getAttribute('style') || ''), null, { timeout: COND_MS });
  const g = await geo(page);
  expect(Math.abs(g.w - g.cw / 2), JSON.stringify(g)).toBeLessThanOrEqual(1);
  expect((await model(page)).widthPct).toBe(50);
  expect(errs).toEqual([]);
});

async function cloneDarkSpan(page) {
  await page.evaluate(() => window.deselectAll?.());
  const p = await page.evaluate(async () => {
    const ex = await import('/js/io/export-image.js');
    const clone = await ex.prepareCloneForCapture(document.getElementById('gS'), 860, true);
    ex.renderComponentsInClone(clone);
    clone.id = '__clone'; clone.style.position = 'fixed'; clone.style.zIndex = '2147483647'; clone.style.top = '0px'; clone.style.left = '0px'; clone.style.background = '#ffffff';
    const d = clone.querySelector('.grd-divider'); const cell = d.closest('.grd-cell'); const cr = clone.getBoundingClientRect();
    const dr = d.getBoundingClientRect(), kr = cell.getBoundingClientRect();
    return { y: dr.top + dr.height / 2 - cr.top, x0: kr.left - cr.left, x1: kr.right - cr.left, cw: cr.width };
  });
  await page.evaluate(() => document.getElementById('proj-loading-overlay')?.remove());
  const shot = await page.locator('#__clone').screenshot({ type: 'png' });
  const n = await page.evaluate(async ([b64, p]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0); const s = img.width / p.cw;
    const y = Math.round(p.y * s); let dark = 0;
    for (let x = Math.round(p.x0 * s); x < Math.round(p.x1 * s); x++) { const d = ctx.getImageData(x, y, 1, 1).data; if (d[0] < 60 && d[1] < 60 && d[2] < 60) dark++; }
    return dark;
  }, [shot.toString('base64'), p]);
  await page.evaluate(() => document.getElementById('__clone')?.remove());
  return n;
}

test('W2 ★PNG 내보내기 클론 — 50% 구분선의 어두운 픽셀이 100% 일 때의 절반', async ({ page }) => {
  await setup(page);
  const full = await cloneDarkSpan(page);
  expect(full, '꽉 찬 구분선이 클론에 찍혔다(전제)').toBeGreaterThan(50);
  const r = await page.evaluate(() => window.updateGridBlock('gG', { patchCell: { r: 0, c: 0, lineIndex: 1, widthPct: 50 } }));
  expect(r.ok, JSON.stringify(r)).toBe(true);
  const half = await cloneDarkSpan(page);
  expect(Math.abs(half / full - 0.5), `full=${full} half=${half}`).toBeLessThanOrEqual(0.03);
});

test('W3 ★저장 왕복 — serializeProject → applyProjectData 뒤에도 widthPct 50', async ({ page }) => {
  await setup(page, { widthPct: 50 });
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction(() => !!document.querySelector('#gG .grd-divider'), null, { timeout: COND_MS });
  expect((await model(page)).widthPct).toBe(50);
  const g = await geo(page);
  expect(Math.abs(g.w - g.cw / 2), JSON.stringify(g)).toBeLessThanOrEqual(1);
});

test('W4 ★⌘Z 한 번 → 다시 꽉 찬 폭', async ({ page }) => {
  await setup(page);
  await selectDivider(page);
  await typeInto(page, 'grd-divider-w', 50);
  await page.waitForFunction(() => /width:50%/.test(document.querySelector('#gG .grd-divider')?.getAttribute('style') || ''), null, { timeout: COND_MS });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(() => { const d = document.querySelector('#gG .grd-divider'); return d && !/width:/.test(d.getAttribute('style') || ''); }, null, { timeout: COND_MS });
  const g = await geo(page);
  expect(Math.abs(g.w - g.cw)).toBeLessThanOrEqual(1);
  expect((await model(page)).widthPct).toBeUndefined();
  expect((await model(page)).height, '⌘Z 한 번이 굵기까지 되돌리지 않았다').toBe(4);
});

test('W5 ★입구 클램프 — patchCell widthPct 999 → 꽉 참 · 2 → 5%', async ({ page }) => {
  await setup(page);
  let r = await page.evaluate(() => window.updateGridBlock('gG', { patchCell: { r: 0, c: 0, lineIndex: 1, widthPct: 999 } }));
  expect(r.ok, JSON.stringify(r)).toBe(true);
  let g = await geo(page);
  expect(Math.abs(g.w - g.cw)).toBeLessThanOrEqual(1);
  r = await page.evaluate(() => window.updateGridBlock('gG', { patchCell: { r: 0, c: 0, lineIndex: 1, widthPct: 2 } }));
  expect(r.ok, JSON.stringify(r)).toBe(true);
  g = await geo(page);
  expect(Math.abs(g.w - g.cw * 0.05), JSON.stringify(g)).toBeLessThanOrEqual(1);
});

test('W6 ★줄 정렬 가운데 → 줄어든 구분선이 칸 가운데(좌우 틈 같음)', async ({ page }) => {
  await setup(page, { widthPct: 50 });
  await selectDivider(page);
  const g0 = await geo(page);
  expect(g0.gapL, '기본은 왼쪽 붙음(전제)').toBeLessThanOrEqual(1);
  await page.selectOption('#grd-line-align', 'center');
  await page.waitForFunction(() => /margin-left:auto;margin-right:auto;/.test(document.querySelector('#gG .grd-divider')?.getAttribute('style') || ''), null, { timeout: COND_MS });
  await frames2(page);
  const g = await geo(page);
  expect(Math.abs(g.gapL - g.gapR), JSON.stringify(g)).toBeLessThanOrEqual(1);
  expect((await model(page)).align).toBe('center');
});

/* grid-pill-radius-slider.dom.spec.js — 현빈QA GRID-PILL-RADIUS-SLIDER
 *   알약 둥글기 #grd-badge-radius → 「슬라이더 + 숫자」(구분선 너비 #grd-divider-w-slider 와 같은 bindSlider · 같은 꼴).
 *   R1 꼴 = 구분선 줄 · 빈 칸(기본 = 완전 둥근) → 슬라이더 끝 · 슬라이더 끝 ≥ 기본 알약 높이의 반(실측)
 *   R2 진짜 마우스로 끌면 숫자·모델·캔버스가 따라온다 · ⌘Z 한 번 = 끌기 전
 *   R3 999 를 치면 그대로(모델 999 · 슬라이더 끝) · R4 빈 칸 확정 = 미설정(완전 둥근) · 슬라이더 끝
 *   R5 저장→다시 열기 유지 · R6 PNG 내보내기 클론의 border-radius = 캔버스 · R7 배경 없으면 줄 자체가 없다
 * ★양성대조: prop-grid.js 를 8bb9ca390 판으로 되돌리면 R1~R4 빨강(슬라이더가 없다). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const COND_MS = 15000;
const BG = '#2f3d57';
async function setup(page, { bg = BG, radius } = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(({ bg, radius }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1" style="background:#ffffff"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    const pill = { type: 'body', text: 'Pill' }; if (bg) pill.bg = bg; if (radius !== undefined) pill.radius = radius;
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [pill, { type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
    window.selectBlock(g); window.showGridProperties(g, { r: 0, c: 0, li: 0 }); window.clearHistory?.();
  }, { bg, radius });
  await openLineSec(page);
  if (bg) await page.waitForFunction(() => !!document.getElementById('grd-badge-radius-slider'), null, { timeout: COND_MS });
}
// body 줄의 「줄 꾸미기」 절은 접혀서 열린다 — 사람처럼 머리를 눌러 편다
async function openLineSec(page) {
  await page.waitForFunction(() => !!document.getElementById('grd-line-body'), null, { timeout: COND_MS });
  if (await page.locator('#grd-line-body').isHidden()) await page.locator('#grd-line-toggle').click();
  await expect(page.locator('#grd-line-body')).toBeVisible();
}
const st = (page) => page.evaluate(() => ({
  slider: document.getElementById('grd-badge-radius-slider')?.value, number: document.getElementById('grd-badge-radius')?.value,
  radius: JSON.parse(document.getElementById('gG').dataset.cols)[0].lines[0].radius ?? null,
  css: document.querySelector('#gG .grd-badge')?.style.borderRadius ?? null,
}));

test('R1 구분선 줄과 같은 꼴 · 빈 칸 = 슬라이더 끝 · 끝 ≥ 기본 알약 높이의 반', async ({ page }) => {
  await setup(page);
  const shape = await page.evaluate(() => [...document.getElementById('grd-badge-radius').closest('.prop-row').children].map(e => e.tagName + '.' + e.className + (e.type ? ':' + e.type : '')));
  expect(shape).toEqual(['SPAN.prop-label', 'INPUT.prop-slider:range', 'INPUT.prop-number:number']);
  const sl = await page.evaluate(() => { const s = document.getElementById('grd-badge-radius-slider'); return { min: s.min, max: s.max, step: s.step }; });
  expect(sl).toEqual({ min: '0', max: '40', step: '1' });
  expect(await st(page)).toEqual({ slider: '40', number: '', radius: null, css: '999px' });
  const h = await page.evaluate(() => document.querySelector('#gG .grd-badge').offsetHeight);
  console.log(`[measure] default body pill height = ${h}px · half = ${h / 2}px`);
  expect(Number(sl.max), '슬라이더 끝이 기본 알약 높이의 반보다 짧으면 끝에서도 완전 둥근 모양이 안 나온다').toBeGreaterThanOrEqual(h / 2);
});

test('R2 끌면 숫자·모델·캔버스가 따라온다 · ⌘Z 한 번 = 끌기 전', async ({ page }) => {
  await setup(page);
  const r = await waitStableRect(page, '#grd-badge-radius-slider');
  await page.mouse.move(r.left + r.width - 2, r.cy); await page.mouse.down();
  await page.mouse.move(r.left + r.width * 0.6, r.cy, { steps: 4 });
  await page.mouse.move(r.left + r.width * 0.3, r.cy, { steps: 4 });
  await page.mouse.up();
  const s = await st(page);
  expect(Number(s.slider)).toBeGreaterThan(2); expect(Number(s.slider)).toBeLessThan(30);
  expect(s.number).toBe(s.slider); expect(s.radius).toBe(Number(s.slider)); expect(s.css).toBe(`${s.slider}px`);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await st(page)).css).toBe('999px');
  expect((await st(page)).radius, '⌘Z 한 번에 끌기 전체가 풀린다').toBeNull();
});

test('R3 999 를 치면 그대로 · 슬라이더는 끝', async ({ page }) => {
  await setup(page);
  await page.locator('#grd-badge-radius').fill('999');
  await page.locator('#grd-badge-radius').press('Enter');
  expect(await st(page)).toEqual({ slider: '40', number: '999', radius: 999, css: '999px' });
  await page.locator('#grd-badge-radius').fill('12');
  await page.locator('#grd-badge-radius').press('Enter');
  expect(await st(page)).toEqual({ slider: '12', number: '12', radius: 12, css: '12px' });
});

test('R4 빈 칸 확정 = 미설정(완전 둥근) · 슬라이더 끝', async ({ page }) => {
  await setup(page, { radius: 10 });
  expect(await st(page)).toEqual({ slider: '10', number: '10', radius: 10, css: '10px' });
  await page.locator('#grd-badge-radius').fill('');
  await page.locator('#grd-badge-radius').press('Enter');
  await page.locator('#grd-badge-radius').blur();
  await expect.poll(() => st(page)).toEqual({ slider: '40', number: '', radius: null, css: '999px' });
});

test('R5 저장 → 다시 열기 유지', async ({ page }) => {
  await setup(page);
  await page.locator('#grd-badge-radius').fill('7');
  await page.locator('#grd-badge-radius').press('Enter');
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); }, snap);
  await page.evaluate(() => { const g = document.getElementById('gG'); window.selectBlock(g); window.showGridProperties(g, { r: 0, c: 0, li: 0 }); });
  await openLineSec(page);
  await page.waitForFunction(() => !!document.getElementById('grd-badge-radius-slider'), null, { timeout: COND_MS });
  expect(await st(page)).toEqual({ slider: '7', number: '7', radius: 7, css: '7px' });
});

test('R6 PNG 내보내기 클론의 border-radius = 캔버스', async ({ page }) => {
  await setup(page, { radius: 9 });
  await page.evaluate(() => window.deselectAll?.());
  const got = await page.evaluate(async () => {
    const canvas = getComputedStyle(document.querySelector('#gG .grd-badge')).borderTopLeftRadius;
    const ex = await import('/js/io/export-image.js');
    const clone = await ex.prepareCloneForCapture(document.getElementById('gS'), 860, true);
    ex.renderComponentsInClone(clone);
    clone.id = '__clone'; Object.assign(clone.style, { position: 'fixed', top: '0px', left: '0px' });
    const b = clone.querySelector('.grd-badge');
    const out = { canvas, clone: b && getComputedStyle(b).borderTopLeftRadius };
    clone.remove();
    return out;
  });
  expect(got).toEqual({ canvas: '9px', clone: '9px' });
});

test('R7 배경 없으면 알약 둥글기 줄이 없다', async ({ page }) => {
  await setup(page, { bg: null });
  await page.waitForFunction(() => !!document.getElementById('grd-badge-hex'), null, { timeout: COND_MS });
  expect(await page.evaluate(() => [!!document.getElementById('grd-badge-radius-slider'), !!document.getElementById('grd-badge-radius')])).toEqual([false, false]);
});

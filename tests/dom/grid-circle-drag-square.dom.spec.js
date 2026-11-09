/* grid-circle-drag-square.dom.spec.js — 현빈QA 「그리드 원형 이미지를 핸들로 늘리면 끄는 «동안» 타원이 됐다가 놓으면 정원으로 돌아온다」
 * 기대: 끄는 동안에도 1:1. ★규칙은 놓을 때와 «같은 것»(렌더러: 지름 = height) — 미리보기도 gridPreviewLine 으로 그린다.
 * ★진짜 마우스(page.mouse down → 여러 move → up). 중간 표본은 move + rAF 두 번 뒤, up 전에 잰다.
 * 대조: D0 사각 이미지 줄은 드래그 중 자유 비율(오늘 동작) · D5 아이콘원형 · D6 확대블럭 원 — 원래 정원(같은 결함 아님 증거).
 * 양성대조(6c56d4620 의 js/overlay-handles.js): D1·D2 빨강(중간 표본 타원), D0·D5·D6 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PX2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGNQSjujlHYGAAf/AqmCyMKsAAAAAElFTkSuQmCC';

const raf = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function setupGrid(page, line) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((line) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [line] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.clearHistory?.();
  }, line);
  await raf(page);
  /* 현빈 손: 그림 클릭(블럭) → 한 번 더(그 줄) → 코너 핸들 4개 */
  const { cx: x, cy: y } = await waitStableRect(page, '#gG .grd-img-frame');   // 배율 맞추기가 끝난 뒤에 누른다
  await page.mouse.click(x, y); await raf(page);
  await page.mouse.click(x, y); await raf(page);
  await page.waitForFunction(() => [...document.querySelectorAll('.grd-img-overlay-handle')].filter(h => h.style.display !== 'none').length === 4, null, { timeout: 10000 });
  return errs;
}

const box = (page, sel) => page.evaluate((sel) => {
  const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect();
  return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
}, sel);
const gridH = (page) => page.evaluate(() => JSON.parse(document.getElementById('gG').dataset.cols)[0].lines[0].height);

/* 핸들 중심에서 눌러 (dx,dy) 까지 4걸음 · 2걸음째(중간) 와 4걸음째(놓기 직전) 표본 · 놓은 뒤 표본 */
async function drag(page, handleSel, dx, dy, measureSel) {
  const b = await page.locator(handleSel).boundingBox();
  expect(b, `핸들 ${handleSel} 이 없다`).not.toBeNull();
  const x0 = b.x + b.width / 2, y0 = b.y + b.height / 2;
  const before = await box(page, measureSel);
  await page.mouse.move(x0, y0); await page.mouse.down();
  let mid = null, last = null;
  for (let i = 1; i <= 4; i++) {
    await page.mouse.move(x0 + dx * i / 4, y0 + dy * i / 4); await raf(page);
    if (i === 2) mid = await box(page, measureSel);
    if (i === 4) last = await box(page, measureSel);
  }
  await page.mouse.up(); await raf(page);
  const after = await box(page, measureSel);
  return { before, mid, last, after };
}

/* 가운데 정렬 — 왼쪽 붙은 원은 nw/sw 핸들이 칸 왼쪽 가장자리에 앉아 눌러도 안 잡힌다(실측 · 별건). 여기선 sw 를 재려고 띄운다. */
const CIRC = { type: 'image', imgSrc: PX, imgShape: 'circle', height: 120, align: 'center' };
const FRAME = '#gG .grd-img-frame';

for (const [dir, dx, dy] of [['se', 90, 30], ['sw', -40, 20]]) {
  test(`D${dir === 'se' ? 1 : 2} ★그리드 원 ${dir} 코너를 dx≠dy 로 끌면 «끄는 동안» 폭=높이 · 놓은 뒤 폭=높이=모델 height`, async ({ page }) => {
    const errs = await setupGrid(page, CIRC);
    const s = await drag(page, `.grd-img-overlay-handle.${dir}`, dx, dy, FRAME);
    console.log(`[D ${dir}] ${JSON.stringify(s)}`);
    expect(Math.abs(s.mid.w - s.mid.h), `★중간 프레임 타원 ${JSON.stringify(s.mid)}`).toBeLessThanOrEqual(1);
    expect(Math.abs(s.last.w - s.last.h), `★놓기 직전 타원 ${JSON.stringify(s.last)}`).toBeLessThanOrEqual(1);
    expect(Math.abs(s.after.w - s.after.h), `놓은 뒤 ${JSON.stringify(s.after)}`).toBeLessThanOrEqual(1);
    expect(Math.abs(s.after.w - s.before.w), '[전제] 크기가 실제로 바뀌었다').toBeGreaterThan(10);
    expect(Math.abs(s.last.w - s.after.w), `★놓는 순간 튄다 ${s.last.w}→${s.after.w}`).toBeLessThanOrEqual(1);
    const model = await page.evaluate(() => { const f = document.querySelector('#gG .grd-img-frame'); return { off: [f.offsetWidth, f.offsetHeight] }; });
    expect(model.off).toEqual([await gridH(page), await gridH(page)]);
    expect(errs).toEqual([]);
  });
}

test('D3 ★⌘Z 한 번이면 크기가 돌아온다', async ({ page }) => {
  await setupGrid(page, CIRC);
  await drag(page, '.grd-img-overlay-handle.se', 90, 30, FRAME);
  expect(await gridH(page), '[전제] 늘었다').toBeGreaterThan(130);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await raf(page);
  expect(await gridH(page)).toBe(120);
  const f = await box(page, FRAME);
  expect(Math.abs(f.w - f.h)).toBeLessThanOrEqual(1);
});

test('D4 ★저장 → 다시 열기 뒤에도 정원 · 지름 그대로', async ({ page }) => {
  await setupGrid(page, CIRC);
  await drag(page, '.grd-img-overlay-handle.se', 90, 30, FRAME);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction(() => !!document.querySelector('.grd-img-frame.grd-img-circle'), null, { timeout: 10000 });
  await raf(page);
  const f = await page.evaluate(() => { const e = document.querySelector('.grd-img-frame.grd-img-circle');
    return { w: e.offsetWidth, h: e.offsetHeight, height: JSON.parse(e.closest('.grid-block').dataset.cols)[0].lines[0].height }; });
  expect(f.height, '[전제] 늘어난 지름이 저장됐다').toBeGreaterThan(130);
  expect([f.w, f.h]).toEqual([f.height, f.height]);
});

test('D0 대조 — 사각 그리드 이미지는 드래그 중 자유 비율(오늘 동작 그대로)', async ({ page }) => {
  await setupGrid(page, { type: 'image', imgSrc: PX2, height: 120 });
  const s = await drag(page, '.grd-img-overlay-handle.se', -100, 40, FRAME);
  console.log(`[D0 rect] ${JSON.stringify(s)}`);
  expect(Math.abs(s.mid.w - (s.before.w - 50)), `중간 폭 ${JSON.stringify(s)}`).toBeLessThanOrEqual(2);
  expect(Math.abs(s.mid.h - (s.before.h + 20)), `중간 높이 ${JSON.stringify(s)}`).toBeLessThanOrEqual(2);
});

test('D5 증거 — 아이콘원형 블럭은 드래그 중에도 정원(같은 결함 아님)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:60px"></div></div></div>`);
    const r = window.makeIconCircleBlock(); r.block.id = 'qC'; document.querySelector('#gS .section-inner').appendChild(r.row); window.rebindAll?.(); window.deselectAll?.();
  });
  await raf(page);
  const { cx: x, cy: y } = await waitStableRect(page, '#qC .icb-circle');
  await page.mouse.click(x, y); await raf(page);
  await page.waitForFunction(() => document.querySelectorAll('.icb-overlay-handle').length === 4, null, { timeout: 5000 });
  await waitStableRect(page, '#qC .icb-circle');
  const s = await drag(page, '.icb-overlay-handle.se', 90, 30, '#qC .icb-circle');
  console.log(`[D5 icon-circle] ${JSON.stringify(s)}`);
  expect(Math.abs(s.mid.w - s.mid.h), JSON.stringify(s)).toBeLessThanOrEqual(1);
  expect(Math.abs(s.after.w - s.before.w), '[전제] 크기가 바뀌었다').toBeGreaterThan(10);
});

test('D6 증거 — 확대블럭(원)은 드래그 중에도 정원(같은 결함 아님)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:500px"></div></div></div>`);
    window.selectSection(document.getElementById('gS'));
    window.addZoomBlock({ shape: 'circle' });
  });
  await raf(page);
  await page.waitForFunction(() => document.querySelectorAll('.zm-overlay-handle').length === 4, null, { timeout: 5000 });
  await waitStableRect(page, '.zoom-block');   // addZoomBlock 이 부드러운 scrollIntoView 를 건다 — 멈춘 뒤 끈다
  const s = await drag(page, '.zm-overlay-handle.se', 90, 30, '.zoom-block');
  console.log(`[D6 zoom-circle] ${JSON.stringify(s)}`);
  expect(Math.abs(s.mid.w - s.mid.h), JSON.stringify(s)).toBeLessThanOrEqual(1);
  expect(Math.abs(s.after.w - s.before.w), '[전제] 크기가 바뀌었다').toBeGreaterThan(3);
});

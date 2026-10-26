/* t6-04-nest-gap.dom.spec.js — t6-04㉡ 「📍그리드 블럭 나란히 두칸으로 나누기 줄을 추가할 수 있는데 해당 추가한 줄의 경우,
 *   캔버스에서 추가한 두칸(칼럼)의 간격 조절 가능하게 해줄래?」(현빈) · 지디 GO ㈐ = 우클릭 「칸 사이 간격…」 입력.
 *   값 = 그 줄의 line.gap(새로 만든 줄 = 8) · 쓰는 문 = patchCell{r,c,lineIndex,gap} · 입력 = 섹션 메모 팝오버 꼴(.section-memo-popover).
 * 칸
 *   P0 전제 — 칸 우클릭 「나란히 두 칸으로 나누기」 진짜 클릭 → 그 줄 생김 · gap 8 · 두 칸 사이 8
 *   M  ★그 줄 안을 우클릭하면 「칸 사이 간격…」 이 보인다
 *   G  ★누르면 팝오버 · 숫자칸 = 8 → 20 Enter → 모델 gap 20 · column-gap 20px · 두 칸 사이 실측 20
 *   U  ★G 뒤 ⌘Z 한 번 → gap 8
 *   S  ★저장 꼴 왕복 — 섹션 HTML 을 다시 들여도 20
 *   N  그 줄 밖(다른 칸) 우클릭이면 「칸 사이 간격…」 안 보인다
 * 양성대조: GD1001_ROOT=<핀 8608bb13 사본> ⇒ M·G·U·S 빨강(입구 0) · P0·N 초록.
 * ⛔고정 대기 없음. 하네스 = _root-harness.bootApp · 우클릭·메뉴·키는 진짜 입력.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const frames = (page, n = 2) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const shown = (sel) => `(() => { const e = document.querySelector('${sel}'); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; })()`;
async function clickMenu(page, sel) {
  await page.waitForFunction(shown(sel), null, { timeout: 4000 });
  const p = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  await page.mouse.click(p[0], p[1]);
}
async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); window.addSection(); const sec = c.querySelector('.section-block'); window.selectSection(sec); window.addGridBlock(); window.__g = sec.querySelector('.grid-block'); window.deselectAll?.(); window.__g.scrollIntoView({ block: 'center' }); });
  await page.evaluate(() => new Promise((done) => { let p = null, n = 0; const t = () => { const r = window.__g.getBoundingClientRect(); const k = [r.left, r.top, r.width].join(); if (k === p) { if (++n >= 2) return done(); } else n = 0; p = k; requestAnimationFrame(t); }; requestAnimationFrame(t); }));
  const cell = await page.evaluate(() => { const r = window.__g.querySelector('.grd-cell[data-r="0"][data-c="0"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(cell[0], cell[1]); await frames(page, 3);
  await page.mouse.click(cell[0], cell[1], { button: 'right' });
  await clickMenu(page, '#bcm-grid-nested');
  await page.waitForFunction(() => !!window.__g.querySelector('.grd-nested[data-line]'), null, { timeout: 4000 });
  await frames(page, 3);
  return errs;
}
const read = (page) => page.evaluate(() => {
  const nest = window.__g.querySelector('.grd-nested[data-line]');
  const li = Number(nest.dataset.line);
  const line = window.getGridModel(window.__g).cells[0][0].lines[li];
  const cols = [...nest.querySelectorAll(':scope > .grd-nested-col')];
  const k = window.__g.getBoundingClientRect().width / window.__g.offsetWidth;
  return { li, gap: line?.gap ?? null, css: getComputedStyle(nest).columnGap, seam: +((cols[1].getBoundingClientRect().left - cols[0].getBoundingClientRect().right) / k).toFixed(1) };
});
const nestPt = (page) => page.evaluate(() => { const r = window.__g.querySelector('.grd-nested[data-line] > .grd-nested-col').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
async function openGap(page) {
  const p = await nestPt(page);
  await page.mouse.click(p[0], p[1], { button: 'right' });
  await clickMenu(page, '#bcm-grid-nested-gap');
  await page.waitForFunction(() => document.activeElement?.id === 'grd-nest-gap-input', null, { timeout: 4000 });
}
async function setGap(page, v) {
  await openGap(page);
  await page.keyboard.press('Meta+a'); await page.keyboard.type(String(v)); await page.keyboard.press('Enter');
  await page.waitForFunction((v) => { const n = window.__g.querySelector('.grd-nested[data-line]'); return n && getComputedStyle(n).columnGap === v + 'px'; }, v, { timeout: 4000 });
}

test('P0 전제 — 나란히 두 칸 줄 · gap 8 · 사이 8', async ({ page }) => {
  const errs = await setup(page);
  expect(await read(page)).toMatchObject({ gap: 8, css: '8px', seam: 8 });
  expect(errs).toEqual([]);
});

test('M ★그 줄 안 우클릭 → 「칸 사이 간격…」 보임', async ({ page }) => {
  const errs = await setup(page);
  const p = await nestPt(page);
  await page.mouse.click(p[0], p[1], { button: 'right' });
  await page.waitForFunction(shown('#bcm-grid-nested'), null, { timeout: 4000 });
  expect(await page.evaluate(shown('#bcm-grid-nested-gap')), '★「칸 사이 간격…」 이 없다').toBe(true);
  expect(errs).toEqual([]);
});

test('G ★팝오버(메모 꼴) · 8 → 20 Enter → 모델 20 · column-gap 20px · 사이 20', async ({ page }) => {
  const errs = await setup(page);
  await openGap(page);
  const pop = await page.evaluate(() => ({ cls: !!document.querySelector('.section-memo-backdrop .section-memo-popover #grd-nest-gap-input'), v: document.getElementById('grd-nest-gap-input').value }));
  expect(pop, '★메모 팝오버 꼴 · 지금 값 8').toEqual({ cls: true, v: '8' });
  await page.keyboard.press('Meta+a'); await page.keyboard.type('20'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => getComputedStyle(window.__g.querySelector('.grd-nested[data-line]')).columnGap === '20px', null, { timeout: 4000 });
  expect(await read(page)).toMatchObject({ gap: 20, css: '20px', seam: 20 });
  await page.waitForFunction(() => !document.querySelector('.section-memo-backdrop'), null, { timeout: 4000 });
  expect(errs).toEqual([]);
});

test('U ★G 뒤 ⌘Z 한 번 → 8', async ({ page }) => {
  const errs = await setup(page);
  await setGap(page, 20);
  await page.waitForFunction(() => !document.querySelector('.section-memo-backdrop'), null, { timeout: 4000 });
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await page.waitForFunction(() => { const g = document.querySelector('#canvas .grid-block'); window.__g = g; const n = g?.querySelector('.grd-nested[data-line]'); return n && getComputedStyle(n).columnGap === '8px'; }, null, { timeout: 4000 });
  expect((await read(page)).gap).toBe(8);
  expect(errs).toEqual([]);
});

test('S ★섹션 HTML 왕복 뒤에도 20', async ({ page }) => {
  const errs = await setup(page);
  await setGap(page, 20);
  await page.evaluate(() => { const sec = window.__g.closest('.section-block'); const html = sec.outerHTML; const c = document.getElementById('canvas'); sec.remove(); c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.__g = c.querySelector('.grid-block'); window.renderGridBlock?.(window.__g); });
  await frames(page, 3);
  expect(await read(page)).toMatchObject({ gap: 20, css: '20px' });
  expect(errs).toEqual([]);
});

test('N 그 줄 밖(다른 칸) 우클릭이면 안 보인다', async ({ page }) => {
  const errs = await setup(page);
  const p = await page.evaluate(() => { const r = window.__g.querySelector('.grd-cell[data-r="0"][data-c="1"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(p[0], p[1], { button: 'right' });
  await page.waitForFunction(shown('#bcm-grid-nested'), null, { timeout: 4000 });
  expect(await page.evaluate(shown('#bcm-grid-nested-gap'))).toBe(false);
  expect(errs).toEqual([]);
});

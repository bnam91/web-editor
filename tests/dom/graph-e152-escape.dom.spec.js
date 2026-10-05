/* graph-e152-escape.dom.spec.js — E152 그래프 렌더러가 사용자 값을 innerHTML 에 날것으로 넣던 자리 (태양 lane-bt2-fix 2026-10-06)
 * E150 은 꺾은선 카테고리 하나만 고쳤다. 남은 자리(drag-utils.js @0f572e2a):
 *   글자 5 — 849 꺾은선 값 라벨 · 873/874 비교 범례 seriesA/B · 883 비교 값 라벨 · 928 가로 % → 기존 _escGraphHtml
 *   색 15 줄 — 716·717·805·806·819·844·845·865·866·873·874·884·907·910·911 → 기존 _safeGraphColor(검증기)
 * 사본 52(08-07) 의 그래프 색 값 56 개는 전부 검증기 통과(0 거절 · $S/bt2fix/color-census.json) ⇒ 기존 문서 색 무변(그 표본 안에서).
 * 넣는 길: MCP 꼴(dataset + renderGraph) · 비교 범례 A 는 패널 실타이핑 한 판 더(T2b).
 * 양성대조: 0f572e2a 나무 안 → T* · C* 빨강 · S(정상 색 그대로) 초록. 변이(_escGraphHtml 항등) → T* 빨강.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-e152-escape.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const TXT = '<b>x</b>';
const EVIL = ['red" data-x="1', 'red;background-image:url(x)'];
const COLOR_KEYS = ['barColor', 'barColor2', 'lineColor', 'fillColor', 'labelColor', 'vlabelColor', 'xlabelColor'];

async function make(page, type, ds = {}, items = null) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(([type, ds, items]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100); window.selectSection(document.getElementById('sG')); window.addGraphBlock({ chartType: type });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    for (const [k, v] of Object.entries(ds)) g.dataset[k] = v;
    if (items) g.dataset.items = JSON.stringify(items);
    window.renderGraph(g); window.deselectAll?.(); return g.id;
  }, [type, ds, items]);
  return { errs, id };
}
const textOf = (page, id, sel, i = 0) => page.evaluate(([id, sel, i]) => { const e = document.getElementById(id).querySelectorAll(sel)[i]; return e ? { text: e.textContent.trim(), kids: e.querySelectorAll('*').length } : null; }, [id, sel, i]);
const ITEMS = [{ label: 'a', value: TXT, value2: TXT }, { label: 'b', value: 50, value2: 40 }];

test('T1 ★꺾은선 값 라벨에 <b>x</b> → 글자 그대로 · 자식 0', async ({ page }) => {
  const { errs, id } = await make(page, 'line', {}, ITEMS);
  expect(await textOf(page, id, '.grb-line-vlabel')).toEqual({ text: TXT, kids: 0 });
  expect(errs).toEqual([]);
});
test('T2 ★비교 범례 seriesA <b>x</b> → 글자 그대로 · 자식 0', async ({ page }) => {
  const { errs, id } = await make(page, 'bar-pair', { seriesA: TXT, seriesB: 'B' });
  expect(await page.evaluate((id) => { const e = document.getElementById(id).querySelectorAll('.grb-pair-legend-item')[0]; return { text: e.textContent.trim(), b: e.querySelectorAll('b').length }; }, id)).toEqual({ text: TXT, b: 0 });
  expect(errs).toEqual([]);
});
test('T2b ★비교 범례 A — 패널 «시리즈 A» 칸 실타이핑 <b>x</b> → 캔버스 글자 그대로', async ({ page }) => {
  const { errs, id } = await make(page, 'bar-pair');
  let prev = null, p = null;
  for (let k = 0; k < 40; k++) { p = await page.evaluate((id) => { const g = document.getElementById(id); g.scrollIntoView({ block: 'center' }); const r = g.querySelector('.grb-bar-fill-wrap').getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; }, id); if (prev && prev.join() === p.join()) break; prev = p; await page.waitForTimeout(150); }
  await clickAt(page, p[0], p[1], { sel: '.graph-block' }, { label: '비교 그래프 고르기' });
  const inp = page.locator('#grb-series-a'); await inp.scrollIntoViewIfNeeded(); await inp.click(); await page.keyboard.press('Meta+a'); await page.keyboard.type(TXT); await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate((id) => { const e = document.getElementById(id).querySelector('.grb-pair-legend-item'); return e ? { text: e.textContent.trim(), b: e.querySelectorAll('b').length } : null; }, id)).toEqual({ text: TXT, b: 0 });
  expect(errs).toEqual([]);
});
test('T3 ★비교 범례 seriesB <b>x</b> → 글자 그대로 · 자식 0', async ({ page }) => {
  const { errs, id } = await make(page, 'bar-pair', { seriesA: 'A', seriesB: TXT });
  expect(await page.evaluate((id) => { const e = document.getElementById(id).querySelectorAll('.grb-pair-legend-item')[1]; return { text: e.textContent.trim(), b: e.querySelectorAll('b').length }; }, id)).toEqual({ text: TXT, b: 0 });
  expect(errs).toEqual([]);
});
test('T4 ★비교 값 라벨에 <b>x</b> → 글자 그대로 · 자식 0', async ({ page }) => {
  const { errs, id } = await make(page, 'bar-pair', {}, ITEMS);
  expect(await textOf(page, id, '.grb-bar-val-label')).toEqual({ text: TXT, kids: 0 });
  expect(errs).toEqual([]);
});
test('T5 ★가로 막대 % 에 <b>x</b> → 글자 그대로 · 자식 0', async ({ page }) => {
  const { errs, id } = await make(page, 'bar-h', {}, ITEMS);
  expect(await textOf(page, id, '.grb-bar-h-pct')).toEqual({ text: TXT, kids: 0 });
  expect(errs).toEqual([]);
});

for (const type of ['bar-v', 'line', 'bar-pair', 'bar-h']) for (const evil of EVIL) {
  test(`C ★${type} — 색 키 일곱에 «${evil}» → 여분 속성 0 · style 안 url( 0`, async ({ page }) => {
    const ds = Object.fromEntries(COLOR_KEYS.map(k => [k, evil]));
    if (type === 'line') ds.fillArea = '1';
    if (type === 'bar-pair') { ds.seriesA = 'A'; ds.seriesB = 'B'; }
    const { errs, id } = await make(page, type, ds);
    const r = await page.evaluate((id) => { const g = document.getElementById(id); const all = [...g.querySelectorAll('*')];
      return { extraAttr: all.filter(e => e.hasAttribute('data-x')).length, urlInStyle: all.filter(e => /url\(/i.test(e.getAttribute('style') || '') || /url\(/i.test(e.getAttribute('fill') || '')).length }; }, id);
    expect(r).toEqual({ extraAttr: 0, urlInStyle: 0 });
    expect(errs).toEqual([]);
  });
}

test('S 지킴 — 정상 색(hex · rgba · 이름색 · linear-gradient)은 그대로 칠해진다', async ({ page }) => {
  const { errs, id } = await make(page, 'line', { lineColor: '#ff0000', vlabelColor: 'rgba(0, 128, 0, 0.5)', xlabelColor: 'blue', fillArea: '1', fillColor: '#00ff00' });
  const r = await page.evaluate((id) => { const g = document.getElementById(id); const cs = (s, p) => getComputedStyle(g.querySelector(s))[p];
    return { stroke: cs('.grb-line-path', 'stroke'), v: cs('.grb-line-vlabel', 'color'), x: cs('.grb-line-xlabel', 'color'), fill: g.querySelector('.grb-line-area')?.getAttribute('fill') }; }, id);
  expect(r).toEqual({ stroke: 'rgb(255, 0, 0)', v: 'rgba(0, 128, 0, 0.5)', x: 'rgb(0, 0, 255)', fill: '#00ff00' });
  const { id: id2 } = await make(page, 'bar-h', { barColor: 'linear-gradient(90deg, #ff0000, #0000ff)' });
  const bg = await page.evaluate((id) => getComputedStyle(document.getElementById(id).querySelector('.grb-bar-h-fill')).backgroundImage, id2);
  expect(bg).toMatch(/^linear-gradient\(/);
  expect(errs).toEqual([]);
});

/* graph-pie-donut.dom.spec.js — 1012t1G1 그래프 블럭 원형(pie) · 도넛(donut) (태양 098-graph 2026-10-12)
 * 현빈: 그래프 블럭에 원형그래프 — 꽉 찬 파이 · 가운데 뚫린 도넛.
 * 고침: js/graph-pie-geom.js piePaths(순수 기하) · drag-utils.js GRAPH_RENDERERS 등록표(pie·donut → _renderPie · 인라인 SVG path, 구멍은 고리 path 로 실제로 뚫는다)
 *   · graph-limits.js PIE_HOLE_MIN/MAX/DEFAULT · prop-graph.js 유형 버튼 표(6개) + Pie Settings(도넛 구멍 슬라이더) + 조각 색(단색 전용)
 *   · editor-graph.css 조각 색(프리셋 막대색 × 불투명도 사다리 · 컬러풀 5색) · canvas-contrast 색 칸 표 · block-factory 정수 키 pieHole.
 * 기하는 «화면 좌표»가 아니라 SVG 사용자 좌표의 isPointInFill 로 잰다 — 배율·패널 폭과 무관(0~1000 viewBox · 중심 500 · 12시 시작 · 시계 방향).
 * 고침 라운드(2026-10-13): P10 조각 사이 틈(같은 색이 맞닿는 5n+1 항목) · P7 범례 % 합 100.
 * 기다림은 전부 조건(waitForFunction · expect.poll · 로케이터 자동 대기) — 고정 대기 0.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-pie-donut.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const V3 = [{ label: '가', value: 1 }, { label: '나', value: 1 }, { label: '다', value: 2 }];
const raf2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));

/* 판 세우기 — 빈 섹션에 그래프 하나(addGraphBlock = 사용자 삽입과 같은 입구). items 는 dataset 으로 덮는다(입구는 빈 배열을 안 받는다). */
async function setup(page, { type = 'pie', items = null, extra = {} } = {}) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(({ type, items, extra }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    const S = document.getElementById('sG'); window.selectSection(S); window.addGraphBlock({ chartType: type });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    if (!g) return null;
    if (items) g.dataset.items = JSON.stringify(items);
    for (const [k, v] of Object.entries(extra)) g.dataset[k] = v;
    if (items || Object.keys(extra).length) window.renderGraph(g);
    window.deselectAll?.();
    return g.id;
  }, { type, items, extra });
  expect(id, '전제: 그래프 블럭이 만들어졌다').toBeTruthy();
  expect(await ds(page, id, 'chartType'), '전제: chartType 이 섰다').toBe(type);
  await raf2(page);
  return { errs, id };
}
const ds = (page, id, k) => page.evaluate(([id, k]) => document.getElementById(id).dataset[k] ?? null, [id, k]);
const setDs = (page, id, kv) => page.evaluate(([id, kv]) => { const b = document.getElementById(id); for (const [k, v] of Object.entries(kv)) { if (v == null) delete b.dataset[k]; else b.dataset[k] = typeof v === 'string' ? v : JSON.stringify(v); } window.renderGraph(b); }, [id, kv]);
const itemsOf = (page, id) => page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.items), id);
const openPanel = (page, id) => page.evaluate((id) => window.showGraphProperties(document.getElementById(id)), id);
const dOf = (page, id) => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-pie-slice')].map(p => p.getAttribute('d')), id);
const legend = (page, id) => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-pie-legend-item')].map(li => ({
  label: li.querySelector('.grb-pie-label').textContent, val: li.querySelector('.grb-pie-val').textContent,
  labelShown: getComputedStyle(li.querySelector('.grb-pie-label')).display !== 'none', valShown: getComputedStyle(li.querySelector('.grb-pie-val')).display !== 'none',
})), id);
/* 각도 deg(12시 = 0 · 시계 방향) · 반지름 비율 rr 의 점이 «어느 조각의 채움 안»인가 — 조각마다 true/false */
const hit = (page, id, deg, rr) => page.evaluate(([id, deg, rr]) => {
  const a = deg * Math.PI / 180, x = 500 + 500 * rr * Math.sin(a), y = 500 - 500 * rr * Math.cos(a);
  return [...document.getElementById(id).querySelectorAll('.grb-pie-slice')].map(p => !!p.getAttribute('d') && p.isPointInFill(new DOMPoint(x, y)));
}, [id, deg, rr]);
const paint = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id);
  const sl = [...g.querySelectorAll('.grb-pie-slice')].map(p => { const c = getComputedStyle(p); return [c.fill, c.fillOpacity]; });
  const dt = [...g.querySelectorAll('.grb-pie-dot')].map(p => { const c = getComputedStyle(p); return [c.backgroundColor, c.opacity]; });
  return { sl, dt };
}, id);

test('P0 생성 — pie 로 넣으면 조각이 항목 수만큼 · 막대 DOM 0 · 오류 0', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie' });
  const r = await page.evaluate((id) => { const g = document.getElementById(id); return {
    n: JSON.parse(g.dataset.items).length, slices: g.querySelectorAll('.grb-pie-slice').length, svg: g.querySelectorAll('svg.grb-pie-svg').length,
    barsH: g.querySelectorAll('.grb-bars-h').length, barsV: g.querySelectorAll('.grb-bars-v').length, legend: g.querySelectorAll('.grb-pie-legend-item').length,
    drawn: [...g.querySelectorAll('.grb-pie-slice')].filter(p => p.getAttribute('d')).length, svgW: g.querySelector('.grb-pie-svg').clientWidth > 0,
  }; }, id);
  expect(r.n, '전제: 기본 항목이 있다').toBeGreaterThan(0);
  expect(r).toEqual({ n: r.n, slices: r.n, svg: 1, barsH: 0, barsV: 0, legend: r.n, drawn: r.n, svgW: true });
  expect(errs).toEqual([]);
});

test('P1 비율 — [1,1,2]: 조각마다 가운데 각의 0.75R 점이 «그 조각만» 안', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  expect((await dOf(page, id)).length, '전제: 조각 3').toBe(3);
  expect(await hit(page, id, 45, 0.75), '0~90° 의 가운데').toEqual([true, false, false]);
  expect(await hit(page, id, 135, 0.75), '90~180° 의 가운데').toEqual([false, true, false]);
  expect(await hit(page, id, 270, 0.75), '180~360° 의 가운데').toEqual([false, false, true]);
  /* 경계 바로 안쪽·바깥쪽 — 12시에서 시작해 시계 방향 */
  expect(await hit(page, id, 2, 0.75)).toEqual([true, false, false]);
  expect(await hit(page, id, 358, 0.75)).toEqual([false, false, true]);
  expect(errs).toEqual([]);
});

test('P2 구멍 — 도넛은 가운데가 «실제로» 비고 원형은 찬다 · 구멍 크기가 dataset.pieHole 을 따른다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'donut', items: V3 });
  expect(await ds(page, id, 'pieHole'), '전제: 구멍 키 없음 = 기본 55').toBeNull();
  expect(await hit(page, id, 45, 0.3), '도넛 55: 0.3R 은 모든 조각 밖').toEqual([false, false, false]);
  expect(await hit(page, id, 45, 0.8), '도넛 55: 0.8R 은 첫 조각 안').toEqual([true, false, false]);
  expect(await hit(page, id, 45, 0.5), '도넛 55: 0.5R 은 구멍').toEqual([false, false, false]);
  await setDs(page, id, { pieHole: '20' });
  expect(await hit(page, id, 45, 0.3), '도넛 20: 0.3R 은 조각 안').toEqual([true, false, false]);
  expect(await hit(page, id, 45, 0.1), '도넛 20: 0.1R 은 구멍').toEqual([false, false, false]);
  await setDs(page, id, { chartType: 'pie' });
  expect(await hit(page, id, 45, 0.3), '원형: 0.3R 은 조각 안').toEqual([true, false, false]);
  expect(await hit(page, id, 45, 0.02), '원형: 가운데도 찬다').toEqual([true, false, false]);
  expect(await ds(page, id, 'pieHole'), '원형으로 바꿔도 구멍 값은 남는다').toBe('20');
  /* 한계 밖 값은 렌더가 자른다(패널과 같은 상수) — 5 → 20 · 99 → 80 */
  await setDs(page, id, { chartType: 'donut', pieHole: '5' });
  expect(await hit(page, id, 45, 0.15)).toEqual([false, false, false]);
  await setDs(page, id, { pieHole: '99' });
  expect(await hit(page, id, 45, 0.85), '80 에서 잘린다 — 고리가 남는다').toEqual([true, false, false]);
  expect(errs).toEqual([]);
});

/* 1013t1C1 «의도된 변경» — 유형 버튼은 다섯(「원형」 하나) · 도넛은 Pie Settings 의 「도너츠」 토글(chartType 'pie' + pieDonut '1'). 옛 버튼 #grb-type-donut 은 없다. */
test('P3 패널 배치 — 유형 버튼 5개가 안 넘치고 · 구멍 줄은 도너츠 토글을 켰을 때만 · 막대 설정은 숨는다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'bar-v' });
  await openPanel(page, id);
  const grp = () => page.evaluate(() => { const g = document.getElementById('grb-type-v').closest('.prop-type-group'); const bs = [...g.querySelectorAll('button')];
    return { ids: bs.map(b => b.id), active: bs.filter(b => b.classList.contains('active')).map(b => b.id), fits: g.scrollWidth <= g.clientWidth, widths: bs.every(b => b.offsetWidth > 0 && b.scrollWidth <= b.clientWidth),
      labels: bs.map(b => b.textContent.trim()) }; });
  const g0 = await grp();
  expect(g0.ids).toEqual(['grb-type-v', 'grb-type-h', 'grb-type-line', 'grb-type-pair', 'grb-type-pie']);
  expect(g0.labels.slice(4)).toEqual(['원형']);
  expect(g0).toMatchObject({ active: ['grb-type-v'], fits: true, widths: true });
  expect(await page.locator('#grb-bar-thickness-slider').count(), '전제: 막대에선 두께 줄이 있다').toBe(1);
  await page.locator('#grb-type-pie').click();
  await expect.poll(() => ds(page, id, 'chartType')).toBe('pie');
  expect(await page.locator('#grb-pie-donut-toggle').count(), '전제: 원형이면 도너츠 토글이 있다').toBe(1);
  expect(await page.locator('#grb-pie-hole-slider').count(), '전제: 토글을 켜기 전엔 구멍 줄 없음').toBe(0);
  await page.locator('#grb-pie-donut-toggle').locator('xpath=..').click();
  await expect.poll(() => ds(page, id, 'pieDonut')).toBe('1');
  expect(await ds(page, id, 'chartType'), '도너츠 = 원형 + 토글(유형은 pie 그대로)').toBe('pie');
  expect(await grp()).toMatchObject({ active: ['grb-type-pie'], fits: true, widths: true });
  expect(await page.locator('#grb-pie-hole-slider').count()).toBe(1);
  expect(await page.locator('#grb-pie-hole-number').count()).toBe(1);
  expect(await page.locator('#grb-bar-thickness-slider').count(), '도넛: 막대 설정 없음').toBe(0);
  expect((await dOf(page, id)).filter(Boolean).length, '캔버스도 도넛으로 그려졌다 — 기본 5항목이 다 조각').toBe(5);
  await page.locator('#grb-pie-donut-toggle').locator('xpath=..').click();
  await expect.poll(() => ds(page, id, 'pieDonut')).toBeNull();
  expect(await ds(page, id, 'chartType')).toBe('pie');
  expect(await grp()).toMatchObject({ active: ['grb-type-pie'], fits: true, widths: true });
  expect(await page.locator('#grb-pie-hole-slider').count(), '원형: 구멍 줄 없음').toBe(0);
  expect(await page.locator('#grb-bar-thickness-slider').count()).toBe(0);
  /* 기존 유형으로 돌아가는 길도 그대로 */
  await page.locator('#grb-type-h').click();
  await expect.poll(() => ds(page, id, 'chartType')).toBe('bar-h');
  expect(await page.locator('#grb-bar-thickness-slider').count()).toBe(1);
  expect(errs).toEqual([]);
});

test('P4 구멍 슬라이더 — 끌면 그려지고 · 숫자칸은 한계에서 되써지고 · ⌘Z 한 번에 돌아온다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'donut' });
  await openPanel(page, id);
  const d0 = await dOf(page, id);
  expect(d0.length, '전제: 조각이 있다').toBeGreaterThan(0);
  expect(await page.evaluate(() => { const s = document.getElementById('grb-pie-hole-slider'), n = document.getElementById('grb-pie-hole-number'); return [s.min, s.max, s.value, n.min, n.max, n.value]; }),
    '칸의 한계·기본 = GRAPH_LIMITS').toEqual(await page.evaluate(() => { const L = window.GRAPH_LIMITS; const a = [String(L.PIE_HOLE_MIN), String(L.PIE_HOLE_MAX), String(L.PIE_HOLE_DEFAULT)]; return [...a, ...a]; }));
  await page.evaluate(() => { const s = document.getElementById('grb-pie-hole-slider'); s.value = '70'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await ds(page, id, 'pieHole')).toBe('70');
  const d70 = await dOf(page, id);
  expect(d70, '구멍이 바뀌면 조각 길이 바뀐다').not.toEqual(d0);
  expect(await page.inputValue('#grb-pie-hole-number')).toBe('70');
  await page.evaluate(() => document.getElementById('grb-pie-hole-slider').dispatchEvent(new Event('change', { bubbles: true })));   // 놓기 = 히스토리 한 칸
  /* 숫자칸 실타이핑 999 → 위 끝으로 되써진다 */
  await page.locator('#grb-pie-hole-number').fill('999');
  await page.locator('#grb-pie-hole-number').press('Enter');
  await expect.poll(() => ds(page, id, 'pieHole')).toBe('80');
  expect(await page.inputValue('#grb-pie-hole-number')).toBe('80');
  expect(await page.inputValue('#grb-pie-hole-slider')).toBe('80');
  /* ⌘Z 한 번 = 직전 확정(70) */
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => document.querySelector('#sG .graph-block')?.dataset.pieHole ?? null)).toBe('70');
  expect(await page.evaluate(() => [...document.querySelectorAll('#sG .graph-block .grb-pie-slice')].map(p => p.getAttribute('d'))), '되돌린 뒤 그림 = 70 때 그림').toEqual(d70);
  /* 한 번 더 = 슬라이더를 만지기 전(키 없음 = 기본 구멍) */
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => { const g = document.querySelector('#sG .graph-block'); return g ? [g.dataset.chartType, g.dataset.pieHole ?? null] : null; })).toEqual(['donut', null]);
  expect(await page.evaluate(() => [...document.querySelectorAll('#sG .graph-block .grb-pie-slice')].map(p => p.getAttribute('d')))).toEqual(d0);
  /* 빈 숫자칸이 확정돼도 NaN 이 안 들어간다 — 기본값으로 */
  await openPanel(page, await page.evaluate(() => document.querySelector('#sG .graph-block').id));
  await page.evaluate(() => { const n = document.getElementById('grb-pie-hole-number'); n.value = ''; n.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(await page.evaluate(() => document.querySelector('#sG .graph-block').dataset.pieHole)).toBe('55');
  expect(await page.inputValue('#grb-pie-hole-number')).toBe('55');
  expect(errs).toEqual([]);
});

test('P5 색 — 미지정은 조각·범례 점이 같은 색 사다리 · 항목 색은 그 조각만 · 그라데이션 탭 없음', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie' });
  const p0 = await paint(page, id);
  expect(p0.sl.length, '전제: 조각 5').toBe(5);
  for (let k = 0; k < p0.sl.length; k++) expect(p0.dt[k], `조각 ${k} 과 범례 점 ${k} 이 같은 색·같은 불투명도`).toEqual(p0.sl[k]);
  expect(p0.sl[0], '이웃 조각이 구별된다').not.toEqual(p0.sl[1]);
  expect(new Set(p0.sl.map(s => s.join('/'))).size, '다섯 조각이 다 다르다').toBe(5);
  /* 패널 경로 — 둘째 항목 색 칸에 실타이핑 */
  await openPanel(page, id);
  expect(await page.evaluate(() => document.getElementById('grb-data-color-1-color').dataset.cpModes), '조각 색은 단색 전용').toBe('solid');
  await page.locator('#grb-data-color-1-hex').fill('ff0000');
  await page.locator('#grb-data-color-1-hex').press('Enter');
  await expect.poll(async () => (await itemsOf(page, id))[1].color || null).not.toBeNull();
  const its = await itemsOf(page, id);
  expect(String(its[1].color).toLowerCase()).toContain('ff0000');
  expect(its.map(i => !!i.color)).toEqual([false, true, false, false, false]);
  const p1 = await paint(page, id);
  expect(p1.sl[1]).toEqual(['rgb(255, 0, 0)', '1']);
  expect(p1.dt[1]).toEqual(['rgb(255, 0, 0)', '1']);
  for (const k of [0, 2, 3, 4]) { expect(p1.sl[k], `조각 ${k} 불변`).toEqual(p0.sl[k]); expect(p1.dt[k]).toEqual(p0.dt[k]); }
  /* 진짜 피커를 열어 본다 — 그라데이션 탭이 잠겨 있다 */
  await page.locator('#grb-data-color-0-color').evaluate(e => e.closest('.prop-color-swatch').scrollIntoView({ block: 'center' }));
  await page.locator('.prop-color-swatch:has(#grb-data-color-0-color)').click();
  await page.waitForFunction(() => { const p = document.querySelector('.goya-cp-popover'); return p && !p.hidden; }, null, { timeout: 4000 });
  await expect(page.locator('.goya-cp-popover'), '전제: 색 피커가 열렸다').toBeVisible();
  const tab = page.locator('.goya-cp-popover .goya-cp-tab[data-tab="gradient"]');
  expect(await tab.count(), '전제: 그라데이션 탭은 «있다»(잠글 대상)').toBe(1);
  await expect(tab, '그라데이션 탭이 잠겼다').toBeDisabled();
  await expect(tab).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.goya-cp-popover .goya-cp-tab[data-tab="solid"]'), '단색 탭은 열려 있다').toBeEnabled();
  await page.keyboard.press('Escape');
  /* 막대에서 넘어온 그라데이션 항목 색은 조각에서 «미지정» — 프리셋 색으로 그린다 */
  const grad = 'linear-gradient(180deg, #ff0000 0%, #0000ff 100%)';
  await setDs(page, id, { items: its.map((it, i) => i === 2 ? { ...it, color: grad } : it) });
  const p2 = await paint(page, id);
  expect(p2.sl[2], '그라데이션 = 미지정').toEqual(p0.sl[2]);
  expect((await itemsOf(page, id))[2].color, '모델의 그라데이션은 안 지운다(막대로 돌아가면 산다)').toBe(grad);
  expect(errs).toEqual([]);
});

test('P6 가드 — 합 0 · 항목 하나 · 음수 · 0 섞임', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: [1, 2, 3, 4, 5].map(i => ({ label: 'z' + i, value: 0 })) });
  const z = await page.evaluate((id) => { const g = document.getElementById(id); return { empty: g.querySelectorAll('.grb-pie-empty').length, html: g.innerHTML, slices: g.querySelectorAll('.grb-pie-slice').length }; }, id);
  expect(z.slices, '전제: 조각 요소는 항목 수만큼 있다').toBe(5);
  expect(z.empty, '합 0 = 빈 원').toBe(1);
  expect(z.html).not.toMatch(/NaN|Infinity|undefined/);
  expect(await dOf(page, id)).toEqual(['', '', '', '', '']);
  expect((await legend(page, id)).map(l => l.val)).toEqual(['0%', '0%', '0%', '0%', '0%']);
  /* 빈 배열 */
  await setDs(page, id, { items: [] });
  expect(await page.evaluate((id) => { const g = document.getElementById(id); return [g.querySelectorAll('.grb-pie-slice').length, g.querySelectorAll('.grb-pie-empty').length, /NaN|Infinity|undefined/.test(g.innerHTML)]; }, id)).toEqual([0, 1, false]);
  /* 항목 하나 = 온 원 — 네 사분면 다 안 */
  await setDs(page, id, { items: [{ label: '하나', value: 7 }] });
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.grb-pie-empty').length, id)).toBe(0);
  for (const deg of [45, 135, 225, 315]) expect(await hit(page, id, deg, 0.6), `${deg}°`).toEqual([true]);
  /* 도넛 한 항목 — 고리는 차고 가운데는 빈다 */
  await setDs(page, id, { chartType: 'donut', pieHole: null });
  for (const deg of [45, 135, 225, 315]) { expect(await hit(page, id, deg, 0.8)).toEqual([true]); expect(await hit(page, id, deg, 0.3)).toEqual([false]); }
  /* 음수는 0 */
  await setDs(page, id, { chartType: 'pie', items: [{ label: '음', value: -5 }, { label: '양', value: 10 }] });
  expect((await dOf(page, id)).map(d => d === '')).toEqual([true, false]);
  expect((await legend(page, id)).map(l => l.val)).toEqual(['0%', '100%']);
  expect(await hit(page, id, 200, 0.5)).toEqual([false, true]);
  /* 0 이 섞여도 조각 요소는 항목 수 — 색 순번이 안 밀린다 */
  await setDs(page, id, { items: [{ label: 'a', value: 0 }, { label: 'b', value: 3 }, { label: 'c', value: 1 }] });
  expect((await dOf(page, id)).map(d => d === '')).toEqual([true, false, false]);
  expect(await hit(page, id, 135, 0.5)).toEqual([false, true, false]);
  expect(await hit(page, id, 315, 0.5)).toEqual([false, false, true]);
  expect(errs).toEqual([]);
});

test('P7 라벨 — 비율 % · 값/카테고리 표시 토글 · 사용자 글자는 글자 그대로', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  const l0 = await legend(page, id);
  expect(l0.length, '전제: 범례 3').toBe(3);
  expect(l0.map(l => l.val)).toEqual(['25%', '25%', '50%']);
  /* 합이 100 — 조각마다 따로 반올림하면 1·1·1 이 33·33·33(합 99)이 된다. 최대 잔여법 · 동률은 앞 항목 */
  await setDs(page, id, { items: [1, 1, 1].map((v, i) => ({ label: 't' + i, value: v })) });
  const l3 = (await legend(page, id)).map(l => l.val);
  expect(l3).toEqual(['34%', '33%', '33%']);
  expect(l3.reduce((a, t) => a + parseInt(t), 0)).toBe(100);
  await setDs(page, id, { items: [1, 1, 1, 1, 1, 1].map((v, i) => ({ label: 's' + i, value: v })) });
  const l6 = (await legend(page, id)).map(l => parseInt(l.val));
  expect(l6.length, '전제: 범례 6').toBe(6);
  expect(l6.reduce((a, b) => a + b, 0)).toBe(100);
  await setDs(page, id, { items: V3 });
  expect(l0.map(l => l.label)).toEqual(['가', '나', '다']);
  expect(l0.every(l => l.labelShown && l.valShown)).toBe(true);
  await setDs(page, id, { showVLabel: '0' });
  expect((await legend(page, id)).map(l => [l.labelShown, l.valShown])).toEqual([[true, false], [true, false], [true, false]]);
  await setDs(page, id, { showVLabel: '1', showXLabel: '0' });
  expect((await legend(page, id)).map(l => [l.labelShown, l.valShown])).toEqual([[false, true], [false, true], [false, true]]);
  await setDs(page, id, { showXLabel: null, items: [{ label: '<b>x', value: 1 }, { label: '"q"&', value: 1 }] });
  const r = await page.evaluate((id) => { const g = document.getElementById(id); return { b: g.querySelectorAll('b').length, t: [...g.querySelectorAll('.grb-pie-label')].map(e => e.textContent) }; }, id);
  expect(r).toEqual({ b: 0, t: ['<b>x', '"q"&'] });
  /* 라벨 색 — 공통 키(labelColor · xlabelColor · vlabelColor)를 따른다 · 검증기를 못 지나는 색은 버린다 */
  await setDs(page, id, { labelColor: '#00ff00', vlabelColor: '#0000ff' });
  expect(await page.evaluate((id) => { const g = document.getElementById(id); return [getComputedStyle(g.querySelector('.grb-pie-label')).color, getComputedStyle(g.querySelector('.grb-pie-val')).color]; }, id)).toEqual(['rgb(0, 255, 0)', 'rgb(0, 0, 255)']);
  await setDs(page, id, { labelColor: 'red;background:url(x)"><i>', vlabelColor: null });
  expect(await page.evaluate((id) => { const g = document.getElementById(id); return [g.querySelectorAll('i').length, g.innerHTML.includes('url(')]; }, id)).toEqual([0, false]);
  expect(errs).toEqual([]);
});

test('P8 왕복·결정성 — 막대로 돌아가면 새 막대와 바이트가 같고 · 데이터가 남고 · 저장본에서 다시 살아난다', async ({ page }) => {
  const items = [{ label: 'A', value: 30, value2: 12, color: '#123456' }, { label: 'B', value: 50, value2: 7 }, { label: 'C', value: 20, value2: 3, color: 'linear-gradient(180deg, #ff0000 0%, #0000ff 100%)' }];
  const { errs, id } = await setup(page, { type: 'pie', items });
  expect((await dOf(page, id)).length, '전제: 원형으로 그려졌다').toBe(3);
  /* 같은 dataset 으로 처음부터 bar-v 인 블럭(분리된 새 요소)과 비교 */
  const r = await page.evaluate((id) => {
    const g = document.getElementById(id);
    const twice = (() => { window.renderGraph(g); const a = g.innerHTML; window.renderGraph(g); return a === g.innerHTML; })();
    const pieHTML = g.innerHTML;
    g.dataset.chartType = 'donut'; window.renderGraph(g); const donutHTML = g.innerHTML;
    g.dataset.chartType = 'bar-v'; window.renderGraph(g);
    const fresh = window.makeGraphBlock().block; fresh.dataset.items = g.dataset.items; fresh.dataset.preset = g.dataset.preset; window.renderGraph(fresh);
    const barSame = g.innerHTML === fresh.innerHTML, barHas = g.querySelectorAll('.grb-bar-fill').length, pieLeft = g.querySelectorAll('.grb-pie-slice, .grb-pie-legend').length;
    g.dataset.chartType = 'pie'; window.renderGraph(g);
    return { twice, barSame, barHas, pieLeft, back: g.innerHTML === pieHTML, donutDiff: donutHTML !== pieHTML, items: JSON.parse(g.dataset.items) };
  }, id);
  expect(r).toEqual({ twice: true, barSame: true, barHas: 3, pieLeft: 0, back: true, donutDiff: true, items });
  /* 저장본(직렬화) → 다시 꽂기 → rebindAll: 조각이 그대로 있고 다시 그려도 같다 */
  const s = await page.evaluate((id) => {
    const g = document.getElementById(id); const before = g.innerHTML; const row = g.parentElement; const html = row.outerHTML;
    const saved = window.getSerializedCanvas();
    row.insertAdjacentHTML('afterend', html); row.remove(); window.rebindAll?.();
    const n = document.getElementById(id);
    const kept = n.innerHTML === before, slices = n.querySelectorAll('.grb-pie-slice').length;
    window.renderGraph(n);
    return { kept, slices, rerender: n.innerHTML === before, inSaved: saved.includes('grb-pie-slice') && saved.includes('data-chart-type="pie"'), savedClean: !/NaN|Infinity/.test(saved) };
  }, id);
  expect(s).toEqual({ kept: true, slices: 3, rerender: true, inSaved: true, savedClean: true });
  expect(errs).toEqual([]);
});

test('P9 라벨 편집 — 범례 라벨 더블클릭 → 타이핑 → Enter = items[i].label', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'donut', items: V3 });
  const lab = page.locator(`#${id} .grb-pie-label`).nth(1);
  await expect(lab, '전제: 둘째 라벨이 보인다').toHaveText('나');
  await lab.click();   // 선택
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id)).toBe(true);
  await page.locator(`#${id} .grb-pie-label`).nth(1).dblclick();
  await expect.poll(() => page.evaluate((id) => { const a = document.activeElement; return !!a && a.matches('.grb-pie-label') && a.isContentEditable && document.getElementById(id).contains(a); }, id), { message: '라벨이 편집 상태로 포커스', timeout: 3000 }).toBe(true);
  await page.keyboard.press('Meta+a');
  await page.keyboard.type('새라벨G1');
  await page.keyboard.press('Meta+Enter');   // ★261018 1017t1f6 — 캔버스 라벨 확정은 ⌘Enter(맨 Enter 는 줄바꿈 · graph-label-edit.dom.spec.js N1)
  await expect.poll(async () => (await itemsOf(page, id)).map(i => i.label)).toEqual(['가', '새라벨G1', '다']);
  expect((await legend(page, id)).map(l => l.label)).toEqual(['가', '새라벨G1', '다']);
  expect(await page.evaluate((id) => ({ ce: document.getElementById(id).querySelectorAll('[contenteditable]').length, ed: document.getElementById(id).classList.contains('editing') }), id)).toEqual({ ce: 0, ed: false });
  expect((await itemsOf(page, id)).map(i => i.value), '값은 불변').toEqual([1, 1, 2]);
  expect(errs).toEqual([]);
});

test('P10 틈 — 6항목(끝 조각 = 첫 조각과 같은 색)에서 경계각의 점은 어느 조각에도 안 든다 · 항목 하나면 틈 없음', async ({ page }) => {
  const vals = [30, 20, 15, 15, 10, 10];
  const { errs, id } = await setup(page, { type: 'pie', items: vals.map((v, i) => ({ label: 'k' + i, value: v })) });
  expect((await dOf(page, id)).filter(Boolean).length, '전제: 조각 6').toBe(6);
  const p = await paint(page, id);
  expect(p.sl[5], '전제: 끝 조각과 첫 조각이 같은 색·같은 불투명도(틈이 없으면 한 덩어리)').toEqual(p.sl[0]);
  const none = [false, false, false, false, false, false];
  const bounds = vals.reduce((a, v) => [...a, a[a.length - 1] + v * 3.6], [0]);   // 0 · 108 · 180 · 234 · 288 · 324 · 360
  const check = async (label, radii) => {
    for (let i = 0; i < 6; i++) {
      const own = none.map((_, k) => k === i);
      for (const rr of radii) expect(await hit(page, id, (bounds[i] + bounds[i + 1]) / 2, rr), `${label}: 조각 ${i} 의 가운데 각 · ${rr}R 은 제 조각 안`).toEqual(own);
      for (const rr of radii) expect(await hit(page, id, bounds[i], rr), `${label}: 경계 ${bounds[i]}° · ${rr}R 은 틈`).toEqual(none);
    }
  };
  await check('원형', [0.75, 0.3]);
  /* 틈은 «가는» 틈이다 — 경계에서 2° 만 들어가도 조각 안(0.75R 에서 2° ≈ 13 단위 > 틈 절반 5) */
  expect(await hit(page, id, 2, 0.75)).toEqual([true, false, false, false, false, false]);
  expect(await hit(page, id, 358, 0.75)).toEqual([false, false, false, false, false, true]);
  await setDs(page, id, { chartType: 'donut' });
  await check('도넛', [0.75, 0.6]);
  /* 항목 하나 = 온 원 — 12시 방향에 틈이 없다(원형·도넛) */
  await setDs(page, id, { chartType: 'pie', items: [{ label: '하나', value: 5 }] });
  expect(await hit(page, id, 0, 0.75)).toEqual([true]);
  await setDs(page, id, { chartType: 'donut' });
  expect(await hit(page, id, 0, 0.75)).toEqual([true]);
  /* 값 있는 조각이 하나뿐(0 이 섞인 여럿)이어도 틈 없음 */
  await setDs(page, id, { chartType: 'pie', items: [{ label: 'a', value: 0 }, { label: 'b', value: 4 }, { label: 'c', value: 0 }] });
  expect(await hit(page, id, 0, 0.75)).toEqual([false, true, false]);
  expect(errs).toEqual([]);
});

/* D1(이벨류에이터 2026-10-13) — 패널 Data 절이 항목 라벨·값을 value="…" 에 «그대로» 넣던 것. 원형·도넛 패널도 같은 줄을 탄다. */
for (const type of ['bar-v', 'pie']) {
  test(`P11 패널 이스케이프(${type}) — 라벨에 "> 와 태그가 들어도 패널에 요소가 안 생기고 · 입력칸은 원문 그대로`, async ({ page }) => {
    const EVIL = '"><img src=x onerror=window.__pwn=1>';
    const { errs, id } = await setup(page, { type, items: [{ label: EVIL, value: 50 }, { label: "a'b&amp;<i>", value: 30 }] });
    expect((await itemsOf(page, id)).map(i => i.label), '전제: 모델에 원문이 실렸다').toEqual([EVIL, "a'b&amp;<i>"]);
    expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('img, i').length, id), '전제: 캔버스 그림은 글자로만 그린다').toBe(0);
    await openPanel(page, id);
    await expect(page.locator('#grb-data-list .grb-data-item:not(.grb-seg-item)'), '전제: 패널이 열렸고 항목 줄이 둘').toHaveCount(2);
    await raf2(page);
    const r = await page.evaluate(() => { const panel = document.getElementById('grb-data-list').closest('.prop-section').parentElement;
      return { img: panel.querySelectorAll('img').length, tags: panel.querySelectorAll('#grb-data-list i').length,
        labels: [...panel.querySelectorAll('#grb-data-list .grb-data-item:not(.grb-seg-item) .grb-data-label-input')].map(e => e.value),
        vals: [...panel.querySelectorAll('#grb-data-list .grb-data-item:not(.grb-seg-item) .grb-data-val-input:not(.grb-data-val2-input)')].map(e => e.value),
        stray: [...document.getElementById('grb-data-list').childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).length }; });
    expect(r.img, '패널 안 img 0').toBe(0);
    expect(r.tags, '패널 안 사용자 태그 0').toBe(0);
    expect(r.labels, '입력칸 값 = 원문 그대로').toEqual([EVIL, "a'b&amp;<i>"]);
    expect(r.vals).toEqual(['50', '30']);
    expect(r.stray, '속성 밖으로 샌 글자 0').toBe(0);
    expect(await page.evaluate(() => window.__pwn), 'onerror 가 안 돌았다').toBeUndefined();
    /* 그 칸에서 고쳐 써도 원문이 그대로 모델로 간다(이스케이프가 값에 섞이지 않는다) */
    await page.locator('#grb-data-list .grb-data-label-input').first().fill(EVIL + '!');
    await expect.poll(async () => (await itemsOf(page, id))[0].label).toBe(EVIL + '!');
    expect(errs).toEqual([]);
  });
}

/* D1b(이벨류에이터 2026-10-13) — 같은 줄의 «값 · 값2» 칸. 모델에 글자 값이 실려 와도(불러온 파일·AI 채움) 패널 value="…" 를 못 뚫는다. bar-pair 는 값2 칸까지. */
for (const type of ['bar-v', 'bar-pair']) {
  test(`P11b 패널 이스케이프 — 값·값2(${type}) — 값에 "> 와 태그가 들어도 패널에 요소가 안 생긴다`, async ({ page }) => {
    const EVIL = '"><img src=x onerror=window.__pwn=1>';
    const { errs, id } = await setup(page, { type, items: [{ label: 'a', value: EVIL, value2: EVIL }, { label: 'b', value: 30, value2: 20 }] });
    const m = await itemsOf(page, id);
    expect([m[0].value, m[0].value2], '전제: 모델의 값·값2 에 원문이 실렸다').toEqual([EVIL, EVIL]);
    expect(await page.evaluate(() => window.__pwn), '전제: 캔버스 그림에서 onerror 가 안 돌았다').toBeUndefined();
    expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('img').length, id), '전제: 캔버스 그림은 글자로만 그린다').toBe(0);
    await openPanel(page, id);
    await expect(page.locator('#grb-data-list .grb-data-item:not(.grb-seg-item)'), '전제: 패널이 열렸고 항목 줄이 둘').toHaveCount(2);
    await expect(page.locator('#grb-data-list .grb-data-val2-input'), `전제: 값2 칸은 bar-pair 에만(${type})`).toHaveCount(type === 'bar-pair' ? 2 : 0);
    await raf2(page);
    const r = await page.evaluate(() => { const list = document.getElementById('grb-data-list'), panel = list.closest('.prop-section').parentElement;
      return { img: panel.querySelectorAll('img').length, rows: list.querySelectorAll('.grb-data-item:not(.grb-seg-item)').length,
        vals: list.querySelectorAll('.grb-data-val-input:not(.grb-data-val2-input)').length,
        stray: [...list.querySelectorAll('.grb-data-item')].flatMap(row => [...row.childNodes]).concat([...list.childNodes]).filter(n => n.nodeType === 3 && n.textContent.trim()).length }; });
    expect(r.img, '패널 안 img 0').toBe(0);
    expect(r.vals, '값 칸은 항목마다 하나(속성이 안 깨졌다)').toBe(2);
    expect(r.stray, '속성 밖으로 샌 글자 0').toBe(0);
    expect(await page.evaluate(() => window.__pwn), 'onerror 가 안 돌았다').toBeUndefined();
    expect(errs).toEqual([]);
  });
}

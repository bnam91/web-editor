/* u5-variants-tgb — U5(right-panel-unify) 표·그래프·배너02·월계관 패널을 «분기마다» 연다.
 * 틀 이관(renderPanel + sec) 뒤에는 «해당 없는 절»이 DOM 에서 빠진다(옛: display:none 으로 남았다) ⇒ 배선이 없는 칸을 만지면 pageerror.
 * 분기마다 ⑴ 패널을 연다 ⑵ 그 분기에만 사는 칸 하나에 값을 넣고 input·change 를 쏜다 ⑶ block.dataset(또는 그 칸의 저장 자리)에 써졌는지 읽는다 ⑷ pageerror == [].
 *   그래프: bar-v · bar-h · line · bar-pair · pie · donut · radial · 실루엣(bar-v + 모양)
 *   표: 헤더 켬 · 헤더 끔 · 이미지 행
 *   배너02: 변형(BANNER02_VARIANTS 전부) · 줄 «전체» 보기 + 줄 추가(빈 줄 = 편집칸 열림)
 *   월계관: 패딩 제외 줄 있음 · 없음
 * 양성대조(되돌리면 빨강):
 *   ① prop-graph.js 「항목 간격」 배선의 `if (igSlider) {` 가드를 떼면 line·pie·radial 분기에서 igSlider(null).addEventListener 로 pageerror → G 빨강.
 *   ② prop-table.js 헤더 토글 배선의 `propPanel.querySelectorAll('.tbl-header-ctl')` 를 옛 `document.getElementById('tbl-header-controls').style…` 로 되돌리면 T2 pageerror(그 id 는 이제 없다) 빨강.
 *   ③ prop-laurel.js `document.getElementById('lrl-fullbleed-toggle')?.addEventListener` 의 `?.` 를 떼면 L1(패딩 줄 없음) 빨강.
 *   ⛔안 재는 것: 접기·⌘Z(u5-subfold-undo 몫) · 그래프 bar-h/pair 의 색 칸 · 표 칼럼별 색(colored 테마). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.deselectAll?.(); window.selectSection(sec); window.clearHistory?.(); });
  return errs;
}
async function add(page, cls, entry) {
  return page.evaluate(async ({ cls, entry }) => {
    const before = new Set(document.querySelectorAll('.' + cls));
    await window[entry]();
    const b = [...document.querySelectorAll('.' + cls)].find((x) => !before.has(x));
    window.selectBlock(b.id);
    return b.id;
  }, { cls, entry });
}
/** 칸에 값을 넣고 input·change 를 쏜다(배선이 어느 쪽을 듣든). 칸이 없으면 false. */
const put = (page, sel, v) => page.evaluate(({ sel, v }) => {
  const el = document.querySelector('#panel-right ' + sel);
  if (!el) return false;
  if (el.type === 'checkbox') { el.click(); return true; }
  el.value = String(v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, { sel, v });
const ds = (page, id, k) => page.evaluate(({ id, k }) => document.getElementById(id)?.dataset[k] ?? null, { id, k });
const click = (page, sel) => page.evaluate((sel) => { const el = document.querySelector('#panel-right ' + sel); if (el) el.click(); return !!el; }, sel);

test('G 그래프 — 유형마다 패널이 열리고 그 유형 칸 하나가 dataset 에 쓴다', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'graph-block', 'addGraphBlock');
  const CASES = [
    { name: 'bar-v', type: '#grb-type-v', sel: '#grb-item-gap-number', v: 30, key: 'vItemGap' },
    { name: 'bar-h', type: '#grb-type-h', sel: '#grb-item-gap-number', v: 32, key: 'itemGap' },
    { name: 'line', type: '#grb-type-line', sel: '#grb-stroke-number', v: 7, key: 'strokeWidth' },
    { name: 'bar-pair', type: '#grb-type-pair', sel: '#grb-series-a', v: '우리', key: 'seriesA' },
    { name: 'pie', type: '#grb-type-pie', sel: '#grb-pie-gap-number', v: 3, key: 'pieGap' },
    { name: 'radial', type: '#grb-type-radial', sel: '#grb-radial-radius-number', v: 30, key: 'radialRadius' },
  ];
  for (const c of CASES) {
    expect(await click(page, c.type), `[전제] ${c.name} 유형 단추`).toBe(true);
    await expect.poll(() => ds(page, id, 'chartType'), { message: c.name }).toBe(c.name);
    expect(await put(page, c.sel, c.v), `${c.name}: ${c.sel} 칸이 있다`).toBe(true);
    expect(await ds(page, id, c.key), `${c.name}: ${c.key} 에 썼다`).toBe(String(c.v));
    expect(errs, `${c.name}: pageerror`).toEqual([]);
  }
  // donut = pie + 도너츠 토글 → 구멍 크기 칸
  expect(await click(page, '#grb-type-pie')).toBe(true);
  expect(await put(page, '#grb-pie-donut-toggle'), '[전제] 도너츠 토글').toBe(true);
  await expect.poll(() => ds(page, id, 'pieDonut')).toBe('1');
  expect(await put(page, '#grb-pie-hole-number', 40), 'donut: 구멍 크기 칸').toBe(true);
  expect(await ds(page, id, 'pieHole')).toBe('40');
  // 실루엣 = bar-v + 모양
  expect(await click(page, '#grb-type-v')).toBe(true);
  expect(await put(page, '#grb-shape-select', 'person'), '[전제] 모양 고르기').toBe(true);
  await expect.poll(() => ds(page, id, 'barShape')).toBe('person');
  expect(await page.locator('#grb-bar-thickness-number').count(), '실루엣: 두께 줄 없음(절 분기)').toBe(0);   // ★기대 바뀜(표준 Appearance/Layout · 현빈 261124 L-4/7 슬라이더 걷음 · C1): 두께 = 숫자 칸(-slider 는 늘 0 이라 눈멂)
  expect(await put(page, '#grb-fillmax-number', 80), '실루엣: 최대값 칸').toBe(true);
  expect(await ds(page, id, 'fillMax')).toBe('80');
  expect(errs).toEqual([]);
});

test('T 표 — 헤더 켬·끔 · 이미지 행에서 패널이 열리고 칸이 쓴다', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'table-block', 'addTableBlock');
  // T1 헤더 켬(기본) — 헤더 크기
  expect(await put(page, '#tbl-header-size-number', 20), 'T1: 헤더 크기 칸').toBe(true);
  expect(await ds(page, id, 'headerSize')).toBe('20');
  // T2 헤더 끔 — 하위 칸 둘(.tbl-header-ctl)이 숨고, 패널을 다시 열어도 다른 칸이 쓴다
  expect(await put(page, '#tbl-show-header'), 'T2: 헤더 토글').toBe(true);
  expect(await ds(page, id, 'showHeader')).toBe('false');
  expect(await page.evaluate(() => [...document.querySelectorAll('#panel-right .tbl-header-ctl')].map((e) => getComputedStyle(e).display)), 'T2: 헤더 하위 칸 숨김').toEqual(['none', 'none']);
  await page.evaluate((id) => window.selectBlock(id), id);
  expect(await page.evaluate(() => [...document.querySelectorAll('#panel-right .tbl-header-ctl')].map((e) => getComputedStyle(e).display)), 'T2: 다시 열어도 숨김').toEqual(['none', 'none']);
  expect(await put(page, '#tbl-padx-number', 12), 'T2: 좌우 여백 칸').toBe(true);
  expect(await ds(page, id, 'tablePadX'), 'T2: 좌우 여백').toBe('12');
  // T3 이미지 행 — 행 하나를 이미지 행으로 바꾸고 패널을 다시 연다(Size 절이 생긴다)
  await page.evaluate((id) => { const b = document.getElementById(id); window.__convertTableRowToImg(b.querySelector('tbody tr')); window.showTableProperties(b); }, id);
  expect(await page.evaluate(() => document.getElementById('tbl-img-h-num-0')?.closest('.prop-section[data-sec]')?.dataset.sec ?? null), 'T3: 이미지 행 칸 = Size 절').toBe('size');
  expect(await put(page, '#tbl-img-h-num-0', 90), 'T3: 이미지 행 높이 칸').toBe(true);
  expect(await page.evaluate((id) => document.getElementById(id).querySelector('tr[data-row-img="true"]')?.dataset.imgH ?? null, id), 'T3: 행 dataset.imgH').toBe('90');
  expect(errs).toEqual([]);
});

test('B 배너02 — 변형마다 · 줄 전체/추가에서 패널이 열리고 칸이 쓴다', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'banner02-block', 'addBanner02Block');
  const variants = await page.evaluate(() => Object.keys(window.BANNER02_VARIANTS || {}));
  expect(variants.length, '[전제] 변형 ≥ 2').toBeGreaterThanOrEqual(2);
  for (const v of variants) {
    expect(await click(page, `[data-variant="${v}"]`), `[전제] 변형 단추 ${v}`).toBe(true);
    await expect.poll(() => ds(page, id, 'variant'), { message: v }).toBe(v);
    await page.evaluate((id) => window.selectBlock(id), id);
    expect(await put(page, '#bn2-w', 700), `${v}: 너비 칸`).toBe(true);
    expect(await ds(page, id, 'bannerW'), `${v}: bannerW`).toBe('700');
    expect(errs, `${v}: pageerror`).toEqual([]);
  }
  // 줄 «전체» 보기 → 줄 추가(빈 줄 = 편집칸 열림) → 그 줄의 글자 크기
  expect(await click(page, '[data-line-chip="all"]'), '[전제] 전체 칩').toBe(true);
  expect(await click(page, '#bn2-line-add'), '[전제] 줄 추가').toBe(true);
  const last = await page.evaluate((id) => window._bn2Lines.read(document.getElementById(id)).length - 1, id);
  expect(await put(page, `[data-line-size-num="${last}"]`, 33), '새 빈 줄: 글자 크기 칸(편집칸 열림)').toBe(true);
  expect(await page.evaluate(({ id, last }) => window._bn2Lines.read(document.getElementById(id))[last].size, { id, last })).toBe(33);
  expect(errs).toEqual([]);
});

test('L 월계관 — 패딩 제외 줄 없음 · 있음', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'laurel-block', 'addLaurelBlock');
  // L1 없음 — 뚫을 패딩이 없는 자리(effectiveSectionPadX 0)
  await page.evaluate((id) => { window.__u5PadX = window.effectiveSectionPadX; window.effectiveSectionPadX = () => 0; delete document.getElementById(id).dataset.fullBleed; window.showLaurelProperties(document.getElementById(id)); }, id);
  expect(await page.locator('#lrl-fullbleed-toggle').count(), 'L1: 패딩 제외 줄 없음').toBe(0);
  expect(await page.locator('#panel-right .prop-section[data-sec="padding"]').count(), 'L1: Padding 절 없음').toBe(0);
  expect(await put(page, '#lrl-all-gap-num', 40), 'L1: 잎 간격 칸').toBe(true);
  expect(await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.cells || '[]')[0]?.gap, id)).toBe(40);
  // L2 있음 — 켜진 블럭은 늘 보인다
  await page.evaluate((id) => { window.effectiveSectionPadX = window.__u5PadX; const b = document.getElementById(id); b.dataset.fullBleed = 'true'; window.showLaurelProperties(b); }, id);
  expect(await page.locator('#panel-right .prop-section[data-sec="padding"] #lrl-fullbleed-toggle').count(), 'L2: Padding 절 안에 토글').toBe(1);
  expect(await put(page, '#lrl-fullbleed-toggle'), 'L2: 토글 끄기').toBe(true);
  expect(await ds(page, id, 'fullBleed'), 'L2: fullBleed 지움').toBeNull();
  expect(errs).toEqual([]);
});

/* graph-pie-1013.dom.spec.js — 1013t1-C 원형·도너츠 7건 (태양 1013-pie 2026-10-13)
 * 현빈: 원형 하나 + 「도너츠」 토글(C1) · 시작 각도(C2) · 조각 크기(C4) · 조각 간격(C6) … (C3·C5·C7 은 이 파일 뒤쪽에 이어 붙는다).
 * 옛 칸(P0~P11)은 tests/dom/graph-pie-donut.dom.spec.js 에 그대로 — 여기는 «새 키»와 «옛 저장본이 안 변한다»만 잰다.
 * 기하는 «화면 좌표»가 아니라 SVG 사용자 좌표의 isPointInFill 로 잰다(0~1000 viewBox · 중심 500 · 12시 = 0° · 시계 방향) — 배율·패널 폭과 무관.
 * 기다림은 전부 조건(waitForFunction · expect.poll · 로케이터 자동 대기) — 고정 대기 0.
 *   C1 — D1 옛 donut 패널 · D2 도너츠 토글 왕복 · D3 옛 donut → 막대 → 원형 = 도넛 · D4 ⌘Z · G1 옛 꼴 블럭 저장·다시 열기·패널 무변 · G2 구멍 슬라이더 왕복
 *   C6 — E1 조각 간격이 그림을 바꾼다(0 = 맞닿음 · 40 = 넓은 틈) · E2 패널 칸의 한계 = GRAPH_LIMITS · 999 → 40 되쓰기 · ⌘Z
 *   G0 골든 핀: 새 키가 «하나도 없는» 블럭의 그림(innerHTML)이 1012 판과 바이트가 같다 — 1013t1C0 에서 «고치기 전 판» 위에 박았다.
 * 실행: bash ~/taeyang-098/run-test.sh dom tests/dom/graph-pie-1013.dom.spec.js */
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { bootApp } = require('./_root-harness.js');

const V3 = [{ label: '가', value: 1 }, { label: '나', value: 1 }, { label: '다', value: 2 }];
const V6 = [30, 20, 15, 15, 10, 10].map((v, i) => ({ label: 'k' + i, value: v }));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const raf2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));

/* 판 세우기 — 빈 섹션에 그래프 하나(addGraphBlock = 사용자 삽입과 같은 입구). items 는 dataset 으로 덮는다(입구는 빈 배열을 안 받는다).
   도우미 이름·꼴은 graph-pie-donut.dom.spec.js 머리와 같다(setup · ds · setDs · itemsOf · openPanel · dOf · hit). */
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
const htmlOf = (page, id) => page.evaluate((id) => document.getElementById(id).innerHTML, id);
const dOf = (page, id) => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-pie-slice')].map(p => p.getAttribute('d')), id);
/* 각도 deg(12시 = 0 · 시계 방향) · 반지름 비율 rr(바깥 반지름 500 대비)의 점이 «어느 조각의 채움 안»인가 — 조각마다 true/false */
const hit = (page, id, deg, rr) => page.evaluate(([id, deg, rr]) => {
  const a = deg * Math.PI / 180, x = 500 + 500 * rr * Math.sin(a), y = 500 - 500 * rr * Math.cos(a);
  return [...document.getElementById(id).querySelectorAll('.grb-pie-slice')].map(p => !!p.getAttribute('d') && p.isPointInFill(new DOMPoint(x, y)));
}, [id, deg, rr]);

/* ── G0 골든 핀 ── 새 키 0 인 블럭 일곱 표본의 innerHTML sha256. 이 수는 1013t1C0(제품 0줄) 판에서 잰 것 = 1012 판의 그림. */
const GOLD = {
  pie5:     'b0c0891f18d771f8213eb8eb29f194c3bebe5215bee032ca8022c8a5288e45bb',
  donut5:   'e1b953fa73c6f11b94d3a5bbb06c6efe9ecb2ff9d694e532923f52a8bf0b27b4',
  v3color:  '79e7ba0816fada136f8e63fcb5e28dae5d54d70b7d841e2e5ea857558163e599',
  hole20:   '09043e5d7755aa26bfd894a4cbbe3ad9cfb8433de2116e689ca5080486986b36',
  sum0:     '8f201ae0db00d23c731ba0270818c587bf398b5229c003c756ae055f9bcd4656',
  one:      '3e6feb00da10ff062e019b01c9cf35ffa4bfb390c400c1d3808b06230598b713',
  six:      '01c42707860cbf16183fd67b4d5cabb61f493bd23bf0f201af9bef69722af037',
};
test('G0 골든 핀 — 새 키가 없는 원형·도넛 일곱 표본의 그림(innerHTML)이 1012 판과 바이트가 같다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie' });
  const got = {};
  const snap = async (name) => { const h = await htmlOf(page, id); expect(h, `전제(${name}): 원형 svg 가 그려졌다`).toContain('grb-pie-svg'); got[name] = sha(h); };
  expect((await itemsOf(page, id)).length, '전제: 기본 항목 5').toBe(5);
  await snap('pie5');
  await setDs(page, id, { chartType: 'donut' });
  await snap('donut5');
  await setDs(page, id, { chartType: 'pie', items: V3.map((it, i) => i === 1 ? { ...it, color: '#123456' } : it) });
  await snap('v3color');
  await setDs(page, id, { chartType: 'donut', pieHole: '20', items: V3 });
  await snap('hole20');
  await setDs(page, id, { chartType: 'pie', pieHole: null, items: [1, 2, 3].map(i => ({ label: 'z' + i, value: 0 })) });
  await snap('sum0');
  await setDs(page, id, { items: [{ label: '하나', value: 7 }] });
  await snap('one');
  await setDs(page, id, { chartType: 'donut', items: V6 });
  await snap('six');
  expect(Object.keys(got).length, '전제: 표본 일곱을 다 쟀다').toBe(7);
  expect(new Set(Object.values(got)).size, '전제: 일곱 표본이 서로 다른 그림이다').toBe(7);
  expect(got).toEqual(GOLD);
  expect(errs).toEqual([]);
});

/* ── C1 원형 하나 + 「도너츠」 토글 ── 옛 유형 'donut' 은 «읽을 때» 영구 별칭 · 쓰는 자리는 유형 버튼과 토글 둘뿐. */
const typeGroup = (page) => page.evaluate(() => { const bs = [...document.getElementById('grb-type-v').closest('.prop-type-group').querySelectorAll('button')];
  return { ids: bs.map(b => b.id), active: bs.filter(b => b.classList.contains('active')).map(b => b.id), labels: bs.map(b => b.textContent.trim()) }; });
const clickToggle = (page, id) => page.locator(`#${id}`).locator('xpath=..').click();   // 보이는 것은 label(트랙) — 사용자가 누르는 자리
const outerOf = (page, id) => page.evaluate((id) => document.getElementById(id).outerHTML, id);

test('D1 옛 donut 블럭의 패널 — 「원형」이 켜져 있고 · 도너츠 토글 checked · 구멍 줄 1 · 블럭은 한 글자도 안 변한다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'donut', items: V3 });
  expect(await ds(page, id, 'pieDonut'), '전제: 옛 꼴 — 새 키 없음').toBeNull();
  const before = await outerOf(page, id);
  await openPanel(page, id);
  const g = await typeGroup(page);
  expect(g.ids, '유형 버튼은 다섯').toEqual(['grb-type-v', 'grb-type-h', 'grb-type-line', 'grb-type-pair', 'grb-type-pie']);
  expect(g.labels[4]).toBe('원형');
  expect(g.active, '옛 donut = 「원형」 버튼이 켜진다').toEqual(['grb-type-pie']);
  expect(await page.locator('#grb-type-donut').count(), '옛 도넛 버튼은 없다').toBe(0);
  await expect(page.locator('#grb-pie-donut-toggle'), '도너츠 토글이 켜져 있다').toBeChecked();
  expect(await page.evaluate(() => document.getElementById('grb-pie-donut-toggle').closest('.prop-row').querySelector('.prop-label').textContent.trim())).toBe('도너츠');
  expect(await page.locator('#grb-pie-hole-slider').count()).toBe(1);
  expect(await outerOf(page, id), '패널을 열기만 해서는 블럭(dataset 포함)이 안 변한다').toBe(before);
  expect(await ds(page, id, 'chartType')).toBe('donut');
  expect(errs).toEqual([]);
});

test('D2 도너츠 토글 왕복 — 끄면 가운데가 차고 · 켜면 옛 donut 과 «같은 그림» · 유형은 pie + pieDonut', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'donut', items: V3 });
  const html0 = await htmlOf(page, id);
  expect(await hit(page, id, 45, 0.02), '전제: 옛 donut 은 가운데가 빈다').toEqual([false, false, false]);
  expect(await hit(page, id, 45, 0.8), '전제: 고리는 찬다').toEqual([true, false, false]);
  await openPanel(page, id);
  await clickToggle(page, 'grb-pie-donut-toggle');
  await expect.poll(() => ds(page, id, 'chartType')).toBe('pie');
  expect(await ds(page, id, 'pieDonut'), '끄면 키가 지워진다').toBeNull();
  expect(await hit(page, id, 45, 0.02), '꺼짐: 가운데 점이 채움 안').toEqual([true, false, false]);
  expect(await page.locator('#grb-pie-hole-slider').count(), '꺼짐: 구멍 줄 없음').toBe(0);
  await expect(page.locator('#grb-pie-donut-toggle')).not.toBeChecked();
  await clickToggle(page, 'grb-pie-donut-toggle');
  await expect.poll(() => ds(page, id, 'pieDonut')).toBe('1');
  expect(await ds(page, id, 'chartType'), '새로 쓰는 꼴은 pie + pieDonut').toBe('pie');
  expect(await hit(page, id, 45, 0.02), '켜짐: 가운데가 다시 빈다').toEqual([false, false, false]);
  expect(await htmlOf(page, id), "'pie' + pieDonut 의 그림 = 옛 'donut' 의 그림(바이트)").toBe(html0);
  expect(await page.locator('#grb-pie-hole-slider').count()).toBe(1);
  /* addGraphBlock 입구도 같은 키 */
  const made = await page.evaluate(() => { window.selectSection(document.getElementById('sG')); window.addGraphBlock({ chartType: 'pie', pieDonut: true });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop(); return [g.dataset.chartType, g.dataset.pieDonut ?? null, g.querySelectorAll('.grb-pie-slice').length > 0]; });
  expect(made).toEqual(['pie', '1', true]);
  expect(errs).toEqual([]);
});

test('D3 옛 donut → 세로 막대 → 원형 — 도넛으로 돌아온다 · 처음부터 원형이던 블럭은 원형 그대로', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'donut', items: V3 });
  const html0 = await htmlOf(page, id);
  await openPanel(page, id);
  await page.locator('#grb-type-v').click();
  await expect.poll(() => ds(page, id, 'chartType')).toBe('bar-v');
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.grb-pie-slice').length, id), '전제: 막대로 그려졌다(조각 0)').toBe(0);
  expect(await page.locator('#grb-pie-donut-toggle').count(), '막대: Pie Settings 없음').toBe(0);
  await page.locator('#grb-type-pie').click();
  await expect.poll(() => ds(page, id, 'chartType')).toBe('pie');
  expect(await ds(page, id, 'pieDonut')).toBe('1');
  expect(await htmlOf(page, id), '돌아온 그림 = 처음 donut 그림').toBe(html0);
  await expect(page.locator('#grb-pie-donut-toggle')).toBeChecked();
  expect(await page.locator('#grb-pie-hole-slider').count()).toBe(1);
  /* 처음부터 원형 — 막대에 갔다 와도 도넛이 되지 않는다 */
  const id2 = await page.evaluate(() => { window.selectSection(document.getElementById('sG')); window.addGraphBlock({ chartType: 'pie' }); return [...document.querySelectorAll('#sG .graph-block')].pop().id; });
  expect(id2, '전제: 둘째 블럭').not.toBe(id);
  await openPanel(page, id2);
  await page.locator('#grb-type-v').click();
  await expect.poll(() => ds(page, id2, 'chartType')).toBe('bar-v');
  await page.locator('#grb-type-pie').click();
  await expect.poll(() => ds(page, id2, 'chartType')).toBe('pie');
  expect(await ds(page, id2, 'pieDonut')).toBeNull();
  await expect(page.locator('#grb-pie-donut-toggle')).not.toBeChecked();
  expect(errs).toEqual([]);
});

test('D4 도너츠 토글 ⌘Z — 한 번에 켜기 전으로', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie' });
  const html0 = await htmlOf(page, id);
  await openPanel(page, id);
  await expect(page.locator('#grb-pie-donut-toggle'), '전제: 새 원형은 토글이 꺼져 있다').not.toBeChecked();
  await clickToggle(page, 'grb-pie-donut-toggle');
  await expect.poll(() => ds(page, id, 'pieDonut')).toBe('1');
  expect(await htmlOf(page, id), '전제: 켜면 그림이 바뀐다').not.toBe(html0);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => { const g = document.querySelector('#sG .graph-block'); return g ? [g.dataset.chartType, g.dataset.pieDonut ?? null] : null; })).toEqual(['pie', null]);
  expect(await page.evaluate(() => document.querySelector('#sG .graph-block').innerHTML), '되돌린 그림 = 켜기 전').toBe(html0);
  expect(errs).toEqual([]);
});

test('G1 옛 꼴 블럭(chartType donut · 새 키 0) — 저장 → 다시 꽂기 → rebindAll → 패널 열기까지 블럭이 한 글자도 안 변한다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'donut', items: V3 });
  const r = await page.evaluate((id) => {
    const g = document.getElementById(id); const before = g.outerHTML; const row = g.parentElement; const html = row.outerHTML;
    const saved = window.getSerializedCanvas();
    row.insertAdjacentHTML('afterend', html); row.remove(); window.rebindAll?.();
    const n = document.getElementById(id);
    window.showGraphProperties(n);
    return { same: n.outerHTML === before, isNew: n !== g, slices: n.querySelectorAll('.grb-pie-slice').length, panel: !!document.getElementById('grb-pie-donut-toggle'),
      savedDonut: saved.includes('data-chart-type="donut"'), savedNewKeys: /data-pie-(donut|gap|start)/.test(saved), keys: Object.keys(n.dataset).filter(k => /^pie/.test(k)) };
  }, id);
  expect(r).toEqual({ same: true, isNew: true, slices: 3, panel: true, savedDonut: true, savedNewKeys: false, keys: [] });
  expect(errs).toEqual([]);
});

test('G2 옛 꼴 블럭의 구멍 슬라이더 55 → 56 → 55 — 그림이 처음과 같다 · 유형은 donut 그대로', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'donut', items: V3 });
  const html0 = await htmlOf(page, id);
  await openPanel(page, id);
  expect(await page.inputValue('#grb-pie-hole-slider'), '전제: 기본 구멍 55').toBe('55');
  const slide = (v) => page.evaluate((v) => { const s = document.getElementById('grb-pie-hole-slider'); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  await slide('56');
  expect(await ds(page, id, 'pieHole')).toBe('56');
  expect(await htmlOf(page, id), '전제: 56 은 다른 그림').not.toBe(html0);
  await slide('55');
  expect(await ds(page, id, 'pieHole')).toBe('55');
  expect(await htmlOf(page, id), '55 로 돌아오면 처음 그림(바이트)').toBe(html0);
  expect(await ds(page, id, 'chartType'), '구멍만 만져서는 유형을 안 옮겨 쓴다').toBe('donut');
  expect(await ds(page, id, 'pieDonut')).toBeNull();
  expect(errs).toEqual([]);
});

/* ── C6 조각 간격(dataset.pieGap · viewBox 단위 · 없으면 기본 10) ── */
test('E1 조각 간격 — 경계 옆 점: 기본은 틈 · pieGap 0 이면 조각 안 · 40 이면 더 먼 점도 틈', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V6 });
  expect((await dOf(page, id)).filter(Boolean).length, '전제: 조각 6').toBe(6);
  expect(await ds(page, id, 'pieGap'), '전제: 키 없음 = 기본 틈').toBeNull();
  const none = [false, false, false, false, false, false], s1 = [false, true, false, false, false, false];
  /* 경계 108°(조각0|조각1). 0.75R 에서 0.5° ≈ 3.3 단위(기본 틈 절반 5 보다 안) · 2° ≈ 13 단위(기본 틈 밖 · 40 의 절반 20 보다 안) */
  expect(await hit(page, id, 108.5, 0.75), '전제: 기본 틈 — 경계에서 0.5° 는 어느 조각에도 안 든다').toEqual(none);
  expect(await hit(page, id, 110, 0.75), '전제: 기본 틈 — 2° 는 조각1 안').toEqual(s1);
  await setDs(page, id, { pieGap: '0' });
  expect(await hit(page, id, 108.5, 0.75), 'pieGap 0: 0.5° 가 조각1 안(맞닿는다)').toEqual(s1);
  expect(await hit(page, id, 107.5, 0.75), 'pieGap 0: 반대쪽 0.5° 는 조각0 안').toEqual([true, false, false, false, false, false]);
  await setDs(page, id, { pieGap: '40' });
  expect(await hit(page, id, 110, 0.75), 'pieGap 40: 2° 도 틈').toEqual(none);
  expect(await hit(page, id, 126, 0.75), 'pieGap 40: 조각1 의 가운데는 그대로 조각 안').toEqual(s1);
  /* 한계 밖·험한 값은 렌더가 자른다 — 999 = 40 과 같은 그림 · 글자 = 기본과 같은 그림 */
  const d40 = await dOf(page, id);
  await setDs(page, id, { pieGap: '999' });
  expect(await dOf(page, id)).toEqual(d40);
  await setDs(page, id, { pieGap: null });
  const dDef = await dOf(page, id);
  await setDs(page, id, { pieGap: 'abc' });
  expect(await dOf(page, id), '글자 = 기본 틈').toEqual(dDef);
  expect(await htmlOf(page, id)).not.toMatch(/NaN|Infinity|undefined/);
  expect(errs).toEqual([]);
});

test('E2 조각 간격 칸 — 한계·기본 = GRAPH_LIMITS · 끌면 그려지고 · 999 → 40 되써지고 · ⌘Z 한 번에 돌아온다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie' });
  await openPanel(page, id);
  const d0 = await dOf(page, id);
  expect(d0.length, '전제: 조각이 있다').toBeGreaterThan(0);
  expect(await page.locator('#grb-pie-gap-slider').count(), '전제: 원형이면 조각 간격 줄이 있다').toBe(1);
  expect(await page.evaluate(() => { const s = document.getElementById('grb-pie-gap-slider'), n = document.getElementById('grb-pie-gap-number'); return [s.min, s.max, s.value, n.min, n.max, n.value]; }),
    '칸의 한계·기본 = GRAPH_LIMITS').toEqual(await page.evaluate(() => { const L = window.GRAPH_LIMITS; const a = [String(L.PIE_GAP_MIN), String(L.PIE_GAP_MAX), String(L.PIE_GAP)]; return [...a, ...a]; }));
  await page.evaluate(() => { const s = document.getElementById('grb-pie-gap-slider'); s.value = '25'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await ds(page, id, 'pieGap')).toBe('25');
  const d25 = await dOf(page, id);
  expect(d25, '간격이 바뀌면 조각 길이 바뀐다').not.toEqual(d0);
  expect(await page.inputValue('#grb-pie-gap-number')).toBe('25');
  await page.evaluate(() => document.getElementById('grb-pie-gap-slider').dispatchEvent(new Event('change', { bubbles: true })));   // 놓기 = 히스토리 한 칸
  await page.locator('#grb-pie-gap-number').fill('999');
  await page.locator('#grb-pie-gap-number').press('Enter');
  await expect.poll(() => ds(page, id, 'pieGap')).toBe('40');
  expect(await page.inputValue('#grb-pie-gap-number')).toBe('40');
  expect(await page.inputValue('#grb-pie-gap-slider')).toBe('40');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => document.querySelector('#sG .graph-block')?.dataset.pieGap ?? null)).toBe('25');
  expect(await page.evaluate(() => [...document.querySelectorAll('#sG .graph-block .grb-pie-slice')].map(p => p.getAttribute('d'))), '되돌린 그림 = 25 때 그림').toEqual(d25);
  /* 막대 유형에선 줄이 없다 */
  await openPanel(page, await page.evaluate(() => document.querySelector('#sG .graph-block').id));
  await page.locator('#grb-type-v').click();
  await expect.poll(() => page.evaluate(() => document.querySelector('#sG .graph-block').dataset.chartType)).toBe('bar-v');
  expect(await page.locator('#grb-pie-gap-slider').count()).toBe(0);
  expect(errs).toEqual([]);
});

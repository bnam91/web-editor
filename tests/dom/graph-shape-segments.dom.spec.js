/* graph-shape-segments.dom.spec.js — 1012t1G4 막대·실루엣을 비율별 마디로 (태양 098-graph 2026-10-12)
 * 현빈 G4: 「막대그래프 혹은 특정 svg를 넣으면 비율별로 마디 나눠서 볼 수 있게」(예: 약통이 아래부터 제품원가/영업비/광고비/마진).
 * 고침: items[i].segments([{label,value,color?}] · 0번이 맨 아래) — js/graph-shape.js shapeColsHTML 의 마디 쌓기 · 마스크 밖 라벨 층 ·
 *   canvas-contrast 마디 라벨 톤(파생 변수) · prop-graph.js Data 절의 마디 줄 · 항목을 다시 쓰는 세 자리의 보존(carryItemExtras).
 * 기하는 offsetHeight/offsetTop(레이아웃 px — 배율과 무관). 기다림은 전부 조건 — 고정 대기 0.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-shape-segments.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const raf2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
const SEG4 = [{ label: '제품원가', value: 40 }, { label: '영업비', value: 30 }, { label: '광고비', value: 20 }, { label: '마진', value: 10 }];

async function setup(page, { items = null, extra = {} } = {}) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(({ items, extra }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1" style="background:#ffffff"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    const S = document.getElementById('sG'); window.selectSection(S); window.addGraphBlock({ chartType: 'bar-v' });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    if (!g) return null;
    if (items) g.dataset.items = JSON.stringify(items);
    for (const [k, v] of Object.entries(extra)) g.dataset[k] = v;
    if (items || Object.keys(extra).length) window.renderGraph(g);
    window.deselectAll?.();
    return g.id;
  }, { items, extra });
  expect(id, '전제: 그래프 블럭이 만들어졌다').toBeTruthy();
  expect(await page.evaluate((id) => document.getElementById(id).dataset.chartType, id), '전제: 세로 막대다').toBe('bar-v');
  await raf2(page);
  return { errs, id };
}
const ds = (page, id, k) => page.evaluate(([id, k]) => document.getElementById(id).dataset[k] ?? null, [id, k]);
const setDs = (page, id, kv) => page.evaluate(([id, kv]) => { const b = document.getElementById(id); for (const [k, v] of Object.entries(kv)) { if (v == null) delete b.dataset[k]; else b.dataset[k] = typeof v === 'string' ? v : JSON.stringify(v); } window.renderGraph(b); }, [id, kv]);
const itemsOf = (page, id) => page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.items), id);
const openPanel = (page, id) => page.evaluate((id) => window.showGraphProperties(document.getElementById(id)), id);
/* 상자마다: 쌓기·마디·라벨의 레이아웃 px(상자 기준 위치는 offsetTop 사슬) */
const segGeom = (page, id) => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-shape-box')].map(box => {
  const topIn = (e) => { let t = 0; for (; e && e !== box; e = e.offsetParent) t += e.offsetTop; return t; };
  const stack = box.querySelector('.grb-seg-stack'), mask = box.querySelector('.grb-shape-mask'), track = box.querySelector('.grb-shape-track');
  const cm = getComputedStyle(mask);
  return {
    boxH: box.offsetHeight, boxW: box.offsetWidth, on: box.classList.contains('grb-shape-on'),
    mask: (cm.maskImage && cm.maskImage !== 'none') ? cm.maskImage : (cm.webkitMaskImage || 'none'),
    stackH: stack ? stack.offsetHeight : null, stackW: stack ? stack.offsetWidth : null, stackTop: stack ? topIn(stack) : null, fill: stack ? stack.getAttribute('data-fill') : null,
    gap: stack ? parseFloat(getComputedStyle(stack).rowGap) : null,
    trackTop: track ? topIn(track) : null, trackH: track ? track.offsetHeight : null,
    segs: [...box.querySelectorAll('.grb-seg')].map(s => { const ink = s.querySelector('.grb-seg-ink'), c = getComputedStyle(ink); return { top: topIn(s), h: s.offsetHeight, w: s.offsetWidth, bg: c.backgroundColor, op: parseFloat(c.opacity), shown: getComputedStyle(s).display !== 'none' }; }),
    labels: [...box.querySelectorAll('.grb-seg-label')].map(l => ({ text: l.textContent, top: topIn(l), h: l.offsetHeight, inMask: !!l.closest('.grb-shape-mask'), color: getComputedStyle(l).color, shown: getComputedStyle(l).display !== 'none' })),
  };
}), id);

test('G4-1 비율·순서 — [40,30,20,10] 은 마디 높이 4:3:2:1 · 0번이 맨 아래 · 항목 값은 합(100)', async ({ page }) => {
  const { errs, id } = await setup(page);
  /* 쓰는 길 = updateGraphBlock(자동화 입구) — 항목 값을 일부러 틀리게 줘도 합으로 써 둔다 */
  const r = await page.evaluate(([id, segs]) => window.updateGraphBlock(id, { items: [{ label: '원가 구조', value: 1, segments: segs }, { label: '보통', value: 50 }] }), [id, SEG4]);
  expect(r.ok, '전제: 쓰기가 됐다 ' + JSON.stringify(r)).toBe(true);
  await raf2(page);
  const items = await itemsOf(page, id);
  expect(items[0].value, 'item.value = 마디 합').toBe(100);
  expect(items[0].segments.map(s => [s.label, s.value])).toEqual(SEG4.map(s => [s.label, s.value]));
  const g = await segGeom(page, id);
  expect(g.length, '전제: 상자 2(마디 항목 + 보통 항목)').toBe(2);
  const b = g[0];
  expect(b.segs.length, '전제: 마디 4').toBe(4);
  expect(b.stackH, '전제: 쌓기에 높이가 있다').toBeGreaterThan(100);
  expect(b.gap, '전제: 틈 = 기본값').toBe(await page.evaluate(() => window.GRAPH_LIMITS.SEG_GAP_DEFAULT));
  const usable = b.stackH - b.gap * 3;
  [0.4, 0.3, 0.2, 0.1].forEach((ratio, j) => expect(Math.abs(b.segs[j].h - usable * ratio), `마디 ${j}: 높이 ${b.segs[j].h} ↔ ${usable} × ${ratio}`).toBeLessThanOrEqual(1));
  /* 0번이 맨 아래(offsetTop 최대) · 위로 갈수록 작아진다 */
  const tops = b.segs.map(s => s.top);
  expect(tops[0], '0번 마디가 맨 아래').toBe(Math.max(...tops));
  expect([...tops].sort((x, y) => y - x), '아래 → 위 순서 = 색인 순서').toEqual(tops);
  expect(Math.abs((b.segs[0].top + b.segs[0].h) - b.boxH), '0번 마디의 바닥 = 상자 바닥').toBeLessThanOrEqual(1);
  expect(b.fill, '채움 비율 = 100 / max(items)=100').toBe('1.000');
  /* 값 라벨은 합을 보인다 · 모델도 같은 수 */
  expect(await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-bar-val-label')].map(e => e.textContent), id)).toEqual(['100', '50']);
  const m = await page.evaluate((id) => window.graphFillModel(id), id);
  expect(m.items[0]).toEqual({ label: '원가 구조', value: 100, ratio: 1, segments: [
    { label: '제품원가', ratio: 0.4, color: null }, { label: '영업비', ratio: 0.3, color: null }, { label: '광고비', ratio: 0.2, color: null }, { label: '마진', ratio: 0.1, color: null }] });
  expect(m.items[1]).toEqual({ label: '보통', value: 50, ratio: 0.5, segments: [] });
  /* 마디 없는 이웃 항목은 보통 막대 높이(50 / 100) */
  expect(Math.abs(g[1].boxH * 0.5 - (await page.evaluate((id) => document.getElementById(id).querySelectorAll('.grb-shape-box')[1].querySelector('.grb-shape-fill').offsetHeight, id)))).toBeLessThanOrEqual(1);
  /* 값 0 마디는 자리를 안 차지하고(틈도 없다) 요소는 남는다 · 틈 키를 따른다 */
  await setDs(page, id, { segGap: '6', items: [{ label: 'z', value: 30, segments: [{ label: 'a', value: 10 }, { label: 'b', value: 0 }, { label: 'c', value: 20 }] }] });
  const z = (await segGeom(page, id))[0];
  expect(z.segs.map(s => s.shown)).toEqual([true, false, true]);
  expect(z.gap).toBe(6);
  expect(Math.abs(z.segs[0].h - (z.stackH - 6) / 3), '보이는 둘이 1:2').toBeLessThanOrEqual(1);
  expect(Math.abs(z.segs[2].h - (z.stackH - 6) * 2 / 3)).toBeLessThanOrEqual(1);
  expect((await page.evaluate((id) => document.getElementById(id).innerHTML, id)).includes('NaN')).toBe(false);
  expect(errs).toEqual([]);
});

test('G4-2 색 — 정한 색은 그 마디만 · 안 정한 마디는 막대색 그대로에 위로 갈수록 옅게', async ({ page }) => {
  const segs = [{ label: 'a', value: 25 }, { label: 'b', value: 25, color: '#ff8800' }, { label: 'c', value: 25 }, { label: 'd', value: 25 }];
  const { errs, id } = await setup(page, { items: [{ label: '마디', value: 100, segments: segs }, { label: '보통', value: 100 }] });
  const g = await segGeom(page, id);
  expect(g[0].segs.length, '전제: 마디 4').toBe(4);
  const barColor = await page.evaluate((id) => getComputedStyle(document.getElementById(id).querySelectorAll('.grb-shape-box')[1].querySelector('.grb-shape-fill')).backgroundColor, id);
  expect(/^rgb/.test(barColor), '전제: 이웃 보통 막대의 색을 읽었다').toBe(true);
  const s = g[0].segs;
  expect(s[1].bg, '정한 색').toBe('rgb(255, 136, 0)');
  expect(s[1].op, '정한 색은 불투명').toBe(1);
  [0, 2, 3].forEach(j => expect(s[j].bg, `마디 ${j}: 막대색 그대로`).toBe(barColor));
  expect(s[0].op, '맨 아래는 막대색 그대로').toBe(1);
  expect(s[2].op, '위로 갈수록 옅다').toBeLessThan(s[0].op);
  expect(s[3].op).toBeLessThan(s[2].op);
  expect(s[3].op).toBeGreaterThan(0);
  /* 항목 색 · 블럭 막대색도 그대로 먹는다(마디가 그 색의 사다리) */
  await setDs(page, id, { items: [{ label: '마디', value: 100, color: '#00aa00', segments: segs }, { label: '보통', value: 100 }] });
  const t = (await segGeom(page, id))[0].segs;
  expect([t[0].bg, t[2].bg, t[1].bg]).toEqual(['rgb(0, 170, 0)', 'rgb(0, 170, 0)', 'rgb(255, 136, 0)']);
  /* 검증기를 못 지나는 마디 색은 버린다(속성 탈출 0) */
  await setDs(page, id, { items: [{ label: '마디', value: 2, segments: [{ label: 'a', value: 1, color: 'red;background:url(x)"><i>' }, { label: 'b', value: 1 }] }] });
  expect(await page.evaluate((id) => { const b = document.getElementById(id); return [b.querySelectorAll('i').length, b.innerHTML.includes('url(x)'), b.querySelectorAll('.grb-seg').length]; }, id)).toEqual([0, false, 2]);
  expect(errs).toEqual([]);
});

test('G4-3 라벨 — 글자 = 마디 라벨(태그는 글자 그대로) · 가운데가 자기 마디 안 · 마스크 밖 · 바탕에 맞는 글자색', async ({ page }) => {
  const segs = [{ label: '제품원가', value: 40, color: '#111111' }, { label: '<b>x</b>', value: 30, color: '#ffff00' }, { label: '"q"&', value: 30 }];
  const { errs, id } = await setup(page, { items: [{ label: '약통', value: 100, segments: segs }], extra: { barShape: 'bottle', chartHeight: '400' } });
  const b = (await segGeom(page, id))[0];
  expect(b.labels.length, '전제: 라벨 3').toBe(3);
  expect(b.segs.length, '전제: 마디 3').toBe(3);
  expect(b.labels.map(l => l.text)).toEqual(['제품원가', '<b>x</b>', '"q"&']);
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('b').length, id), '태그로 안 읽힌다').toBe(0);
  b.labels.forEach((l, j) => {
    const mid = l.top + l.h / 2, s = b.segs[j];
    expect(mid >= s.top - 1 && mid <= s.top + s.h + 1, `라벨 ${j} 가운데 ${mid} 가 마디 ${s.top}~${s.top + s.h} 안`).toBe(true);
    expect(l.inMask, `라벨 ${j} 는 마스크 밖(실루엣에 안 잘린다)`).toBe(false);
  });
  /* 글자색: 어두운 마디 위는 밝게, 밝은 마디 위는 어둡게 — 두 색이 다르다 */
  expect(b.labels[0].color, '#111 위 = 밝은 글자').toBe('rgb(242, 242, 242)');
  expect(b.labels[1].color, '노랑 위 = 어두운 글자').toBe('rgb(34, 34, 34)');
  /* 그 색은 파생 변수 — 저장본엔 안 실린다(열면 다시 계산) · 라이브엔 있다 */
  const sv = await page.evaluate((id) => ({ live: document.getElementById(id).innerHTML.includes('--grb-seg-fg'), saved: window.getSerializedCanvas().includes('--grb-seg-fg'), savedHasLabel: window.getSerializedCanvas().includes('grb-seg-label') }), id);
  expect(sv).toEqual({ live: true, saved: false, savedHasLabel: true });
  /* 섹션 바탕이 바뀌면 옅은 마디의 판정이 따라 바뀐다(관찰자) — 흰 바탕 위 옅은 마디 = 어두운 글자 → 검은 바탕 위 = 밝은 글자 */
  await setDs(page, id, { items: [{ label: '약통', value: 100, segments: [{ label: 'a', value: 50 }, { label: 'b', value: 50 }, { label: 'c', value: 50 }, { label: 'd', value: 50 }, { label: 'e', value: 50 }] }] });
  const top0 = (await segGeom(page, id))[0];
  expect(top0.segs[4].op, '전제: 맨 위 마디는 옅다').toBeLessThan(0.5);
  expect(top0.labels[4].color, '흰 바탕 위 옅은 마디 = 어두운 글자').toBe('rgb(34, 34, 34)');
  await page.evaluate(() => { document.getElementById('sG').style.background = '#000000'; });
  await expect.poll(async () => (await segGeom(page, id))[0].labels[4].color, { message: '검은 바탕 위 옅은 마디 = 밝은 글자' }).toBe('rgb(242, 242, 242)');
  /* 카테고리 라벨·값 라벨은 그대로 한 벌 */
  expect(await page.evaluate((id) => { const g = document.getElementById(id); return [g.querySelectorAll('.grb-bar-label').length, g.querySelectorAll('.grb-bar-val-label').length]; }, id)).toEqual([1, 1]);
  expect(errs).toEqual([]);
});

test('G4-4 패널 — 「+ 마디 추가」로 늘고 · 항목 라벨을 고쳐도 마디가 남고 · 마디 ✕ 는 그 마디만 지운다 · ⌘Z', async ({ page }) => {
  const { errs, id } = await setup(page);
  await openPanel(page, id);
  const it0 = (await itemsOf(page, id))[0];
  const n = (await itemsOf(page, id)).length;
  expect(it0.segments, '전제: 마디 없음').toBeUndefined();
  expect(it0.value, '전제: 첫 항목에 값이 있다').toBeGreaterThan(0);
  await expect(page.locator('#grb-data-list .grb-seg-add'), '전제: 항목마다 「+ 마디 추가」').toHaveCount(n);
  const html0 = await page.evaluate((id) => document.getElementById(id).innerHTML, id);
  const seg0 = async () => (await itemsOf(page, id))[0].segments ?? null;
  /* 첫 마디는 항목 값을 통째로 받는다(막대 높이 무변) */
  await page.locator('#grb-data-list .grb-seg-add').first().click();
  await expect.poll(async () => (await seg0())?.length ?? 0).toBe(1);
  expect((await seg0())[0].value).toBe(it0.value);
  expect((await itemsOf(page, id))[0].value).toBe(it0.value);
  await page.locator('#grb-data-list .grb-seg-add').first().click();
  await expect.poll(async () => (await seg0())?.length ?? 0).toBe(2);
  const sum2 = it0.value + 10;
  expect((await itemsOf(page, id))[0].value, '값 = 합').toBe(sum2);
  /* 줄 꼴: 마디 줄 2 · 부모 값 칸은 읽기 전용(합) · 항목 줄 수는 그대로 · 안 넘친다 */
  const rows = await page.evaluate(() => { const l = document.getElementById('grb-data-list'); const p = l.querySelector('.grb-data-item:not(.grb-seg-item)');
    return { seg: l.querySelectorAll('.grb-seg-item').length, item: l.querySelectorAll('.grb-data-item:not(.grb-seg-item)').length, ro: p.querySelector('.grb-data-val-input').readOnly, val: p.querySelector('.grb-data-val-input').value,
      fits: [...l.querySelectorAll('.grb-data-item')].every(r => r.scrollWidth <= r.clientWidth) && l.scrollWidth <= l.clientWidth, segLabelW: l.querySelector('.grb-seg-item .grb-data-label-input').offsetWidth > 60,
      colorIds: [...l.querySelectorAll('.grb-seg-item [id$="-hex"]')].map(e => e.id) }; });
  expect(rows).toEqual({ seg: 2, item: n, ro: true, val: String(sum2), fits: true, segLabelW: true, colorIds: ['grb-seg-color-0-0-hex', 'grb-seg-color-0-1-hex'] });
  /* 부모 라벨 칸에 타이핑 → 마디가 남는다(옛 syncItems 는 모르는 필드를 떨궜다) */
  const pLabel = page.locator('#grb-data-list .grb-data-item:not(.grb-seg-item) .grb-data-label-input').first();
  await pLabel.fill('원가 구조');
  await expect.poll(async () => (await itemsOf(page, id))[0].label).toBe('원가 구조');
  expect((await seg0()).length, '라벨을 고쳐도 마디 2 그대로').toBe(2);
  expect((await itemsOf(page, id))[0].value).toBe(sum2);
  /* 마디 값·라벨 타이핑 → 모델 · 그림 · 부모 합 칸 */
  const s1 = page.locator('#grb-data-list .grb-seg-item[data-seg="1"]').first();
  await s1.locator('.grb-data-val-input').fill('25');
  await s1.locator('.grb-data-label-input').fill('마진');
  await s1.locator('.grb-data-label-input').press('Tab');
  await expect.poll(async () => (await seg0()).map(s => [s.label, s.value])).toEqual([['마디 1', it0.value], ['마진', 25]]);
  expect((await itemsOf(page, id))[0].value).toBe(it0.value + 25);
  expect(await page.locator('#grb-data-list .grb-data-item:not(.grb-seg-item) .grb-data-val-input').first().inputValue(), '부모 합 칸이 따라온다').toBe(String(it0.value + 25));
  expect(await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-seg-label')].map(e => e.textContent), id)).toEqual(['마디 1', '마진']);
  /* 마디 ✕ — 0번 마디만 지운다(항목은 그대로) */
  await page.locator('#grb-data-list .grb-seg-item[data-seg="0"] .grb-data-del-btn').first().click();
  await expect.poll(async () => (await seg0())?.map(s => s.label)).toEqual(['마진']);
  expect((await itemsOf(page, id)).length, '항목 수 그대로').toBe(n);
  expect((await itemsOf(page, id))[0].value).toBe(25);
  /* ⌘Z 한 번 = ✕ 직전(마디 둘) */
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => { const g = document.querySelector('#sG .graph-block'); return g ? (JSON.parse(g.dataset.items)[0].segments || []).map(s => s.label) : null; })).toEqual(['마디 1', '마진']);
  /* 마지막 마디까지 지우면 보통 막대로 — 다른 덧키가 없으니 옛 세로 막대 꼴 */
  const live = await page.evaluate(() => document.querySelector('#sG .graph-block').id);
  await openPanel(page, live);
  await page.locator('#grb-data-list .grb-seg-item[data-seg="1"] .grb-data-del-btn').first().click();
  await expect.poll(async () => ((await itemsOf(page, live))[0].segments || []).length).toBe(1);
  await page.locator('#grb-data-list .grb-seg-item[data-seg="0"] .grb-data-del-btn').first().click();
  await expect.poll(async () => (await itemsOf(page, live))[0].segments ?? null).toBeNull();
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.grb-shape-box, .grb-seg').length, live), '마디가 다 없어지면 옛 세로 막대 길').toBe(0);
  /* 항목 ✕ 는 여전히 항목을 지운다(가드가 기존 길을 안 막았다) */
  await page.locator('#grb-data-list .grb-data-item:not(.grb-seg-item) .grb-data-del-btn').first().click();
  await expect.poll(async () => (await itemsOf(page, live)).length).toBe(n - 1);
  /* 다른 유형에선 마디 줄이 안 나온다 */
  await page.locator('#grb-type-h').click();
  await expect.poll(() => ds(page, live, 'chartType')).toBe('bar-h');
  expect(await page.locator('#grb-data-list .grb-seg-add').count()).toBe(0);
  expect(html0.includes('grb-seg'), '전제 확인: 처음 그림엔 마디가 없었다').toBe(false);
  expect(errs).toEqual([]);
});

test('G4-5 보존 — AI 채움 · updateGraphBlock 이 항목을 다시 써도 마디·항목 모양이 남는다(새 값엔 같은 비율로 맞춘다)', async ({ page }) => {
  const { errs, id } = await setup(page, { items: [{ label: 'A', value: 100, segments: SEG4, shape: 'drop' }, { label: 'B', value: 40 }], extra: { barShape: 'person' } });
  expect((await itemsOf(page, id))[0].segments.length, '전제: 마디 4').toBe(4);
  expect(await page.evaluate(() => [typeof window._aiApplyExt_graph, typeof window.updateGraphBlock]), '전제: AI 적용 함수 · updateGraphBlock 이 실제로 있다').toEqual(['function', 'function']);
  /* AI 채움: { label, value } 만 준다 */
  const ok = await page.evaluate((id) => window._aiApplyExt_graph(document.getElementById('sG'), { id, items: [{ label: '새A', value: 50 }, { label: '새B', value: 70 }] }), id);
  expect(ok).toBe(true);
  let it = await itemsOf(page, id);
  expect(it.map(i => i.label)).toEqual(['새A', '새B']);
  expect(it[0].segments.map(s => s.label), '마디가 남는다').toEqual(['제품원가', '영업비', '광고비', '마진']);
  expect(it[0].segments.map(s => s.value), '새 값 50 에 같은 비율로').toEqual([20, 15, 10, 5]);
  expect(it[0].value).toBe(50);
  expect(it[0].shape, '항목 모양도 남는다').toBe('drop');
  expect(it[1]).toEqual({ label: '새B', value: 70 });
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.grb-seg').length, id), '그림에도 마디 4').toBe(4);
  /* updateGraphBlock({items}) */
  const r = await page.evaluate((id) => window.updateGraphBlock(id, { items: [{ label: 'U', value: 200 }, { label: 'V', value: 10 }] }), id);
  expect(r.ok).toBe(true);
  it = await itemsOf(page, id);
  expect(it[0].segments.map(s => s.value)).toEqual([80, 60, 40, 20]);
  expect([it[0].label, it[0].value, it[0].shape]).toEqual(['U', 200, 'drop']);
  /* 들어온 항목이 마디를 직접 주면 그것으로 바꾼다 · 값 = 합 · 색은 단순 색 글자만 */
  const r2 = await page.evaluate((id) => window.updateGraphBlock(id, { items: [{ label: 'W', value: 0, segments: [{ label: 'x', value: 3, color: '#abcdef' }, { label: 'y', value: 7, color: 'url(evil)' }, { label: 'z', value: -4 }] }] }), id);
  expect(r2.ok).toBe(true);
  it = await itemsOf(page, id);
  expect(it[0]).toEqual({ label: 'W', value: 10, shape: 'drop', segments: [{ label: 'x', value: 3, color: '#abcdef' }, { label: 'y', value: 7 }, { label: 'z', value: 0 }] });
  /* 새 값이 0 이면 마디 비율을 안 잃는다(값은 합으로) */
  await page.evaluate((id) => window._aiApplyExt_graph(document.getElementById('sG'), { id, items: [{ label: 'W', value: 0 }] }), id);
  it = await itemsOf(page, id);
  expect(it[0].segments.map(s => s.value)).toEqual([3, 7, 0]);
  expect(it[0].value).toBe(10);
  expect(errs).toEqual([]);
});

test('G4-6 사각 쌓기 — 모양이 없으면 마스크 없이 막대 두께 그대로 쌓는다 · 트랙 없음 · 마디를 걷으면 옛 막대와 바이트 동일', async ({ page }) => {
  const { errs, id } = await setup(page, { extra: { vBarThickness: '40' } });
  const html0 = await page.evaluate((id) => document.getElementById(id).innerHTML, id);
  const base = await itemsOf(page, id);
  expect(base.length, '전제: 항목이 있다').toBeGreaterThan(1);
  await setDs(page, id, { items: [{ ...base[0], segments: SEG4 }, ...base.slice(1)] });
  const g = await segGeom(page, id);
  expect(g.length, '전제: 상자 = 항목 수').toBe(base.length);
  const b = g[0];
  expect(b.segs.length, '전제: 마디 4').toBe(4);
  expect(b.on, '모양 상자가 아니다').toBe(false);
  expect(b.mask, '마스크 없음').toBe('none');
  expect(b.boxW, '상자 폭 = 두께').toBe(40);
  expect(b.stackW, '쌓기 폭 = 두께').toBe(40);
  expect(b.segs.every(s => s.w === 40)).toBe(true);
  expect(b.trackH, '사각엔 트랙이 없다').toBeNull();
  expect(await ds(page, id, 'barShape')).toBeNull();
  /* 분모 = 옛 max(items) — 합 100 이 가장 크니 꽉 찬다 · 이웃은 값 / 100 */
  expect(b.fill).toBe('1.000');
  expect(Math.abs(b.stackH - b.boxH)).toBeLessThanOrEqual(1);
  expect(g[1].on).toBe(false);
  /* 두께 칸의 위 끝은 여전히 «칸 폭»(마디가 아니라) */
  await openPanel(page, id);
  const thk = await page.evaluate((id) => { const s = document.getElementById('grb-bar-thickness-slider'); return [Number(s.max), document.getElementById(id).querySelector('.grb-bar-col').clientWidth]; }, id);
  expect(thk[0], `두께 상한 ${thk[0]} = 칸 폭 ${thk[1]}`).toBe(thk[1]);
  /* 마디를 걷으면 옛 길 — 처음과 바이트 동일 */
  await setDs(page, id, { items: base });
  expect(await page.evaluate((id) => document.getElementById(id).innerHTML, id)).toBe(html0);
  expect(errs).toEqual([]);
});

test('G4-7 모양+마디 — 약통 실루엣 안에 마디 넷 · 합이 최대값보다 작으면 위는 트랙', async ({ page }) => {
  const { errs, id } = await setup(page, { items: [{ label: '원가 구조', value: 100, segments: SEG4 }], extra: { barShape: 'bottle', chartHeight: '400' } });
  let b = (await segGeom(page, id))[0];
  expect(b.segs.length, '전제: 마디 4').toBe(4);
  expect(b.on).toBe(true);
  expect(b.mask.startsWith('url("data:image/svg+xml,'), '마스크 있음: ' + b.mask.slice(0, 40)).toBe(true);
  expect(b.mask.includes(';base64')).toBe(false);
  expect(Math.abs(b.boxW / b.boxH - 120 / 200), '상자 비 = 약통 viewBox 비').toBeLessThan(0.02);
  expect(b.labels.map(l => l.text)).toEqual(['제품원가', '영업비', '광고비', '마진']);
  expect(b.fill, '합 100 / 최대값 100').toBe('1.000');
  expect(b.trackH, '꽉 차면 트랙 없음').toBeNull();
  const usable = b.stackH - b.gap * 3;
  [0.4, 0.3, 0.2, 0.1].forEach((ratio, j) => expect(Math.abs(b.segs[j].h - usable * ratio), `마디 ${j}`).toBeLessThanOrEqual(1));
  /* 최대값 125 → 합 100 은 0.8 까지만 · 그 위 0.2 는 트랙(마디 틈으로 트랙이 안 비친다 — 트랙은 쌓기 위에만) */
  await setDs(page, id, { fillMax: '125' });
  b = (await segGeom(page, id))[0];
  expect(b.fill).toBe('0.800');
  expect(Math.abs(b.stackH - b.boxH * 0.8)).toBeLessThanOrEqual(1);
  expect(Math.abs(b.trackH - b.boxH * 0.2), `트랙 ${b.trackH} = 상자 ${b.boxH} × 0.2`).toBeLessThanOrEqual(1);
  expect(b.trackTop, '트랙은 맨 위에서').toBe(0);
  expect(Math.abs((b.trackTop + b.trackH) - b.stackTop), '트랙 바닥 = 쌓기 꼭대기').toBeLessThanOrEqual(1);
  /* 모양을 끄면 같은 마디가 사각 쌓기로(데이터는 그대로) */
  expect(await page.evaluate((id) => window.setGraphShape(id, { shape: null }), id)).toEqual({ ok: true, shape: null });
  b = (await segGeom(page, id))[0];
  expect([b.on, b.mask, b.segs.length]).toEqual([false, 'none', 4]);
  expect((await itemsOf(page, id))[0].segments.length).toBe(4);
  expect(errs).toEqual([]);
});

test('G4-8 다른 유형 — 마디 있는 항목을 꺾은선·원형·가로로 바꾸면 값 칸이 풀리고(읽기 전용 아님) · 마디는 남고 · 세로 막대로 돌아오면 값 = 마디 합', async ({ page }) => {
  const { errs, id } = await setup(page, { items: [{ label: 'A', value: 100, segments: SEG4 }, { label: 'B', value: 40 }] });
  await openPanel(page, id);
  const pVal = () => page.locator('#grb-data-list .grb-data-item:not(.grb-seg-item) .grb-data-val-input:not(.grb-data-val2-input)').first();
  const panel = () => page.evaluate(() => { const l = document.getElementById('grb-data-list'); const v = l.querySelector('.grb-data-item:not(.grb-seg-item) .grb-data-val-input');
    return { ro: v.readOnly, val: v.value, segRows: l.querySelectorAll('.grb-seg-item').length, add: l.querySelectorAll('.grb-seg-add').length }; });
  const it0 = async () => (await itemsOf(page, id))[0];
  const segVals = async () => ((await it0()).segments || []).map(s => s.value);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const goType = async (btn, type) => { await page.locator(btn).click(); await expect.poll(() => ds(page, id, 'chartType')).toBe(type); };
  /* 전제: 세로 막대에선 읽기 전용 합 칸 + 마디 줄 4 */
  expect(await panel(), '전제: 세로 막대 = 읽기 전용 합').toEqual({ ro: true, val: '100', segRows: 4, add: 2 });
  expect(await segVals(), '전제: 마디 4').toEqual([40, 30, 20, 10]);

  /* ① 꺾은선 — 값 칸이 풀린다 · 마디 줄은 없다 · 마디는 모델에 남는다 */
  await goType('#grb-type-line', 'line');
  expect(await panel(), '꺾은선: 값 칸이 읽기 전용이 아니다').toEqual({ ro: false, val: '100', segRows: 0, add: 0 });
  expect(await segVals(), '유형을 바꿔도 마디는 남는다').toEqual([40, 30, 20, 10]);
  await pVal().fill('70');
  await expect.poll(async () => (await it0()).value, { message: '값 입력이 items[0].value 에 반영된다(마디 합 100 으로 되써지지 않는다)' }).toBe(70);
  expect((await it0()).segments.map(s => s.label), '마디가 남아 있다').toEqual(['제품원가', '영업비', '광고비', '마진']);
  expect(await pVal().inputValue(), '칸의 글자도 그대로').toBe('70');
  await pVal().press('Enter');
  await expect.poll(segVals, { message: '확정하면 마디를 새 값에 같은 비율로 맞춘다' }).toEqual([28, 21, 14, 7]);
  expect((await it0()).value).toBe(70);
  /* 라벨을 고쳐도 값·마디가 그대로 */
  await page.locator('#grb-data-list .grb-data-item:not(.grb-seg-item) .grb-data-label-input').first().fill('에이');
  await expect.poll(async () => (await it0()).label).toBe('에이');
  expect([(await it0()).value, await segVals()]).toEqual([70, [28, 21, 14, 7]]);
  /* 세로 막대로 복귀 — 값 = 마디 합 · 다시 읽기 전용 · 그림도 그 값 */
  await goType('#grb-type-v', 'bar-v');
  expect((await it0()).value, '복귀: item.value === 마디 합').toBe(sum(await segVals()));
  expect((await it0()).value).toBe(70);
  expect(await panel()).toEqual({ ro: true, val: '70', segRows: 4, add: 2 });
  expect(await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-bar-val-label')].map(e => e.textContent), id)).toEqual(['70', '40']);
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.grb-seg').length, id), '마디 4 가 다시 그려진다').toBe(4);

  /* ② 원형 — 값 0 을 확정하면 마디는 그대로(비율 보존) · 돌아오면 마디 합이 값이 된다 */
  await goType('#grb-type-pie', 'pie');
  expect(await panel()).toEqual({ ro: false, val: '70', segRows: 0, add: 0 });
  await pVal().fill('0');
  await pVal().press('Enter');
  await expect.poll(async () => (await it0()).value).toBe(0);
  expect(await segVals(), '값 0: 마디는 그대로').toEqual([28, 21, 14, 7]);
  await goType('#grb-type-v', 'bar-v');
  expect([(await it0()).value, await segVals()], '복귀: 값 = 마디 합(70)').toEqual([70, [28, 21, 14, 7]]);

  /* ③ 가로 막대 — 확정 키 없이 곧장 유형 단추를 눌러도 같은 규칙(값이 이긴다) */
  await goType('#grb-type-h', 'bar-h');
  expect((await panel()).ro, '가로: 값 칸이 읽기 전용이 아니다').toBe(false);
  await pVal().fill('35');
  await expect.poll(async () => (await it0()).value).toBe(35);
  await goType('#grb-type-v', 'bar-v');
  expect([(await it0()).value, await segVals()], '복귀: 마디가 35 에 같은 비율로').toEqual([35, [14, 10.5, 7, 3.5]]);
  expect(await panel()).toEqual({ ro: true, val: '35', segRows: 4, add: 2 });
  /* 마디 없는 이웃 항목은 내내 그대로 */
  expect((await itemsOf(page, id))[1]).toEqual({ label: 'B', value: 40 });
  expect(errs).toEqual([]);
});

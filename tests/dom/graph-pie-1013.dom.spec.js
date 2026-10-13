/* graph-pie-1013.dom.spec.js — 1013t1-C 원형·도너츠 7건 (태양 1013-pie 2026-10-13)
 * 현빈: 원형 하나 + 「도너츠」 토글(C1) · 시작 각도(C2) · 조각 크기(C4) · 조각 간격(C6) … (C3·C5·C7 은 이 파일 뒤쪽에 이어 붙는다).
 * 옛 칸(P0~P11)은 tests/dom/graph-pie-donut.dom.spec.js 에 그대로 — 여기는 «새 키»와 «옛 저장본이 안 변한다»만 잰다.
 * 기하는 «화면 좌표»가 아니라 SVG 사용자 좌표의 isPointInFill 로 잰다(0~1000 viewBox · 중심 500 · 12시 = 0° · 시계 방향) — 배율·패널 폭과 무관.
 * 기다림은 전부 조건(waitForFunction · expect.poll · 로케이터 자동 대기) — 고정 대기 0.
 *   C1 — D1 옛 donut 패널 · D2 도너츠 토글 왕복 · D3 옛 donut → 막대 → 원형 = 도넛 · D4 ⌘Z · G1 옛 꼴 블럭 저장·다시 열기·패널 무변 · G2 구멍 슬라이더 왕복
 *   C6 — E1 조각 간격이 그림을 바꾼다(0 = 맞닿음 · 40 = 넓은 틈) · E2 패널 칸의 한계 = GRAPH_LIMITS · 999 → 40 되쓰기 · ⌘Z
 *   C2 — F1 시작 각도가 조각을 돌린다(범례 순서·% 는 그대로) · 패널 칸
 *   조각 고르기(C4 전제) — S1 첫 클릭 = 블럭 · 둘째 클릭 = 조각(표식 + Slice 절) · S2 범례 클릭 = 해제 · S3 떠나면 해제 · S4 저장본에 표식 0
 *     · S5 패널 항목 줄 버튼 · S6 다시 그려도 표식 유지 · S7 조각을 잡고 끌기는 고르기가 아니다
 *   C4 조각 크기 — H1 pieGrow 가 그 조각만 바깥으로 키우고 viewBox 를 대칭으로 넓힌다 · H2 라벨을 쳐도·항목을 다시 써도 pieGrow 유지 · H3 Slice 절 「크기」 칸 · ⌘Z
 *   C5 밀어내기 — I1 piePull 이 그 조각만 이등분각 방향으로 옮긴다(d 무변 · transform · viewBox) · 옮긴 자리에서 눌러야 골라진다 · I2 Slice 절 「밀어내기」 칸 · ⌘Z
 *   C3 조각 안 라벨 — J1 순위·이름 토글(기본 꺼짐 · 덧층 · 「n위」) · J2 좁은 조각 자동 숨김 · 조각별 「라벨」 자동/항상/숨김 · J3 이름은 글자 그대로(주입 0)
 *     · J4 글자 톤이 조각 색을 따른다 · 저장본에 톤 변수 0 · J5 라벨이 제 조각 위에 앉고(크기·밀어내기·시작 각도) 클릭을 안 가로챈다 · J6 끄면 켜기 전 그림(바이트)
 *   C7 그림자 — K1 Shadow 절 없음/부드럽게/강하게(dataset.dropShadow · 없음 = 키 삭제) · 그림(innerHTML) 무변 · ⌘Z · 저장 · K2 값 = 확대블럭 선례와 같다 · 막대에선 절도 그림자도 없다
 *   G0 골든 핀: 새 키가 «하나도 없는» 블럭의 그림(innerHTML)이 1012 판과 바이트가 같다 — 1013t1C0 에서 «고치기 전 판» 위에 박았다.
 * 실행: bash ~/taeyang-098/run-test.sh dom tests/dom/graph-pie-1013.dom.spec.js */
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { bootApp, waitStableRect } = require('./_root-harness.js');

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
/* 각도 deg(12시 = 0 · 시계 방향) · 반지름 비율 rr(바깥 반지름 500 대비)의 점이 «어느 조각의 채움 안»인가 — 조각마다 true/false.
   isPointInFill 은 «요소 제 좌표»로 잰다 ⇒ 밀어낸 조각(1013t1C5 · transform translate)은 점에서 옮긴 양을 뺀다(안 민 조각은 0 을 뺀다 = 옛 판정 그대로). */
const hit = (page, id, deg, rr) => page.evaluate(([id, deg, rr]) => {
  const a = deg * Math.PI / 180, x = 500 + 500 * rr * Math.sin(a), y = 500 - 500 * rr * Math.cos(a);
  return [...document.getElementById(id).querySelectorAll('.grb-pie-slice')].map(p => { const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(p.getAttribute('transform') || '');
    return !!p.getAttribute('d') && p.isPointInFill(new DOMPoint(x - (m ? +m[1] : 0), y - (m ? +m[2] : 0))); });
}, [id, deg, rr]);
const tfOf = (page, id) => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-pie-slice')].map(p => p.getAttribute('transform')), id);

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
  expect(await hit(page, id, 126, 0.75), 'pieGap 40: 조각1 의 안쪽은 그대로 조각 안').toEqual(s1);
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

/* ── C2 시작 각도(dataset.pieStart · 도 · 없으면 0) ── */
const legendOf = (page, id) => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-pie-legend-item')].map(li => [li.querySelector('.grb-pie-label').textContent, li.querySelector('.grb-pie-val').textContent]), id);
test('F1 시작 각도 — pieStart 90 이면 첫 조각이 3시에서 시작한다 · 범례 순서·% 는 그대로 · 패널 칸이 같은 값을 쓴다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  expect(await ds(page, id, 'pieStart'), '전제: 키 없음 = 12시 시작').toBeNull();
  const s0 = [true, false, false], s2 = [false, false, true];
  expect(await hit(page, id, 20, 0.75), '전제: 12시 바로 뒤(20°)는 조각0').toEqual(s0);
  expect(await hit(page, id, 110, 0.75), '전제: 110° 는 조각1').toEqual([false, true, false]);
  const lg0 = await legendOf(page, id);
  expect(lg0, '전제: 범례').toEqual([['가', '25%'], ['나', '25%'], ['다', '50%']]);
  const d0 = await dOf(page, id);
  await setDs(page, id, { pieStart: '90' });
  expect(await hit(page, id, 110, 0.75), 'pieStart 90: 3시 바로 뒤(110°)가 조각0').toEqual(s0);
  expect(await hit(page, id, 20, 0.75), 'pieStart 90: 12시 쪽(20°)은 끝 조각').toEqual(s2);
  expect(await hit(page, id, 225, 0.75), '조각1 은 180~270°').toEqual([false, true, false]);
  expect(await legendOf(page, id), '범례 순서·% 는 시작 각도와 무관').toEqual(lg0);
  const d90 = await dOf(page, id);
  expect(d90).not.toEqual(d0);
  await setDs(page, id, { pieStart: '450' });
  expect(await dOf(page, id), '450 ≡ 90').toEqual(d90);
  await setDs(page, id, { pieStart: 'abc' });
  expect(await dOf(page, id), '글자 = 0').toEqual(d0);
  await setDs(page, id, { pieStart: null });
  /* 패널 칸 — 한계 = GRAPH_LIMITS · 끌면 같은 그림 · 999 → 359 */
  await openPanel(page, id);
  expect(await page.evaluate(() => { const s = document.getElementById('grb-pie-start-slider'), n = document.getElementById('grb-pie-start-number'); return [s.min, s.max, s.value, n.min, n.max, n.value]; }))
    .toEqual(await page.evaluate(() => { const L = window.GRAPH_LIMITS; const a = [String(L.PIE_START_MIN), String(L.PIE_START_MAX), '0']; return [...a, ...a]; }));
  await page.evaluate(() => { const s = document.getElementById('grb-pie-start-slider'); s.value = '90'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await ds(page, id, 'pieStart')).toBe('90');
  expect(await dOf(page, id), '칸으로 준 90 = dataset 으로 준 90').toEqual(d90);
  expect(await page.inputValue('#grb-pie-start-number')).toBe('90');
  await page.evaluate(() => document.getElementById('grb-pie-start-slider').dispatchEvent(new Event('change', { bubbles: true })));
  await page.locator('#grb-pie-start-number').fill('999');
  await page.locator('#grb-pie-start-number').press('Enter');
  await expect.poll(() => ds(page, id, 'pieStart')).toBe('359');
  expect(await page.inputValue('#grb-pie-start-number')).toBe('359');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => document.querySelector('#sG .graph-block')?.dataset.pieStart ?? null)).toBe('90');
  expect(errs).toEqual([]);
});

/* ── 조각 고르기(C4·C5 의 전제) ── 상태 = 캔버스 표식 하나(path.grb-pie-cell-selected). 첫 클릭 = 블럭, 이미 선택된 블럭의 조각 클릭 = 그 조각. */
/* 조각 i 의 가운데 각 · 반지름 비율 rr 점의 «화면 자리»(SVG 사용자 좌표 → getScreenCTM) — 누를 자리로만 쓴다(수와 견주지 않는다). on = 그 자리 맨 위 요소가 몇 번 조각인가(아니면 −1). */
const slicePoint = (page, id, i, rr = 0.7) => page.evaluate(([id, i, rr]) => {
  const b = document.getElementById(id), items = JSON.parse(b.dataset.items);
  const geo = window.GRAPH_PIE_GEOM.piePaths(items.map(it => it.value), 0, 0, { start: parseInt(b.dataset.pieStart) || 0 });
  const mid = (geo.angles[i][0] + geo.angles[i][1]) / 2 * Math.PI / 180;
  const tf = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(b.querySelectorAll('.grb-pie-slice')[i].getAttribute('transform') || '');   // 밀어낸 조각(C5)은 옮긴 자리에서 누른다
  const p = new DOMPoint(500 + 500 * rr * Math.sin(mid) + (tf ? +tf[1] : 0), 500 - 500 * rr * Math.cos(mid) + (tf ? +tf[2] : 0)).matrixTransform(b.querySelector('.grb-pie-svg').getScreenCTM());
  const el = document.elementFromPoint(p.x, p.y);
  return { x: p.x, y: p.y, on: (el && el.matches('.grb-pie-slice')) ? [...b.querySelectorAll('.grb-pie-slice')].indexOf(el) : -1 };
}, [id, i, rr]);
const clickSlice = async (page, id, i) => {
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  const p = await slicePoint(page, id, i);
  expect(p.on, `전제: 누를 자리의 맨 위 요소가 조각 ${i}`).toBe(i);
  await page.mouse.click(p.x, p.y);
};
/* 블럭 선택 여부 · 표식이 붙은 조각 색인들 · API 가 말하는 고른 조각 */
const markOf = (page, id) => page.evaluate((id) => { const b = document.getElementById(id); return { sel: b.classList.contains('selected'),
  marks: [...b.querySelectorAll('.grb-pie-slice')].map((p, i) => p.classList.contains('grb-pie-cell-selected') ? i : -1).filter(i => i >= 0), api: window.grbPieSelected(b) }; }, id);
/* 사용자 길로 조각 i 를 고른다 — 한 번 눌러 블럭을 고르고, 한 번 더 눌러 조각을 고른다 */
const pickSlice = async (page, id, i) => {
  await clickSlice(page, id, i);
  await expect.poll(async () => (await markOf(page, id)).sel, { message: '첫 클릭 = 블럭 선택' }).toBe(true);
  await clickSlice(page, id, i);
  await expect.poll(async () => (await markOf(page, id)).marks, { message: `둘째 클릭 = 조각 ${i}` }).toEqual([i]);
};
const sliceSection = (page) => page.evaluate(() => { const s = document.getElementById('grb-pie-slice-section'); return s ? { title: s.querySelector('.prop-section-title').textContent.trim(), name: document.getElementById('grb-pie-slice-name').textContent, idx: s.dataset.slice,
  activeBtns: [...document.querySelectorAll('#grb-data-list .grb-data-icon-btn[data-slice-index].active')].map(b => b.dataset.sliceIndex) } : null; });

test('S1 조각 고르기 — 첫 클릭은 블럭 선택(표식 0) · 둘째 클릭은 그 조각(표식 1 + Slice 절) · 다른 조각을 누르면 옮겨 간다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  expect(await markOf(page, id), '전제: 아무것도 안 골랐다').toEqual({ sel: false, marks: [], api: -1 });
  await clickSlice(page, id, 2);
  await expect.poll(async () => (await markOf(page, id)).sel).toBe(true);
  expect(await markOf(page, id), '첫 클릭 = 블럭만').toEqual({ sel: true, marks: [], api: -1 });
  expect(await page.locator('#grb-pie-donut-toggle').count(), '전제: 그래프 패널이 열렸다').toBe(1);
  expect(await sliceSection(page), '조각을 안 골랐으면 Slice 절 없음').toBeNull();
  expect(await page.locator('#grb-data-list .grb-data-icon-btn[data-slice-index]').count(), '항목 줄마다 조각 버튼').toBe(3);
  await clickSlice(page, id, 2);
  await expect.poll(async () => (await markOf(page, id)).marks).toEqual([2]);
  expect(await markOf(page, id)).toEqual({ sel: true, marks: [2], api: 2 });
  expect(await sliceSection(page), 'Slice 절 머리 = 「n번 · 라벨」').toEqual({ title: 'Slice', name: '3번 · 다', idx: '2', activeBtns: ['2'] });
  /* 표식이 «보인다» — 고른 조각에만 테두리 · 선택된 블럭의 조각은 손가락 커서 */
  const st = await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-pie-slice')].map(p => { const c = getComputedStyle(p); return [c.stroke !== 'none', c.cursor]; }), id);
  expect(st).toEqual([[false, 'pointer'], [false, 'pointer'], [true, 'pointer']]);
  await clickSlice(page, id, 0);
  await expect.poll(async () => (await markOf(page, id)).marks, { message: '다른 조각을 누르면 그 조각으로' }).toEqual([0]);
  expect((await sliceSection(page)).name).toBe('1번 · 가');
  /* 테두리가 조각 색에 «묻히지 않는다» — 기본 프리셋의 첫 조각은 선택색과 같은 파랑이라, 선택색 테두리는 안 보였다. 테두리 색 ≠ 그 조각의 채움색 · 점선 */
  const ink = await page.evaluate((id) => { const p = document.getElementById(id).querySelector('.grb-pie-cell-selected'); const c = getComputedStyle(p); return { stroke: c.stroke, fill: c.fill, dashed: c.strokeDasharray !== 'none', w: parseFloat(c.strokeWidth) > 0 }; }, id);
  expect(ink.stroke, '전제: 테두리가 있다').not.toBe('none');
  expect(ink.stroke, '테두리 색이 조각 채움색과 다르다').not.toBe(ink.fill);
  expect({ dashed: ink.dashed, w: ink.w }).toEqual({ dashed: true, w: true });
  expect(errs).toEqual([]);
});

test('S2 범례(조각 밖)를 누르면 조각 선택이 풀린다 — 블럭 선택은 남는다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  await pickSlice(page, id, 1);
  expect(await sliceSection(page), '전제: Slice 절이 있다').not.toBeNull();
  await page.locator(`#${id} .grb-pie-legend-item`).nth(0).click();
  await expect.poll(async () => (await markOf(page, id)).marks).toEqual([]);
  expect(await markOf(page, id)).toEqual({ sel: true, marks: [], api: -1 });
  expect(await sliceSection(page)).toBeNull();
  expect(errs).toEqual([]);
});

test('S3 블럭을 떠나면 조각 선택이 풀린다 — deselectAll · 다른 블럭 클릭', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  const id2 = await page.evaluate(() => { window.selectSection(document.getElementById('sG')); window.addGraphBlock({ chartType: 'bar-v' }); window.deselectAll(); return [...document.querySelectorAll('#sG .graph-block')].pop().id; });
  expect(id2, '전제: 둘째 블럭').not.toBe(id);
  await pickSlice(page, id, 1);
  await page.evaluate(() => window.deselectAll());
  expect(await markOf(page, id), 'deselectAll = 표식 0').toEqual({ sel: false, marks: [], api: -1 });
  await pickSlice(page, id, 1);
  await waitStableRect(page, `#${id2}`);
  await page.locator(`#${id2}`).click();
  await expect.poll(() => page.evaluate((id2) => document.getElementById(id2).classList.contains('selected'), id2), { message: '전제: 둘째 블럭이 선택됐다' }).toBe(true);
  expect(await markOf(page, id), '다른 블럭 클릭 = 표식 0').toEqual({ sel: false, marks: [], api: -1 });
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .grb-pie-cell-selected').length)).toBe(0);
  expect(errs).toEqual([]);
});

test('S4 저장본 — 조각을 고른 채 직렬화해도 표식이 안 실린다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  await pickSlice(page, id, 0);
  const r = await page.evaluate((id) => { const saved = window.getSerializedCanvas();
    return { live: document.getElementById(id).outerHTML.includes('grb-pie-cell-selected'), hasGraph: saved.includes('grb-pie-slice') && saved.includes(`id="${id}"`), leaked: saved.includes('grb-pie-cell-selected'),
      marker: window.runtimeMarkers.isRuntimeMarker('grb-pie-cell-selected') }; }, id);
  expect(r).toEqual({ live: true, hasGraph: true, leaked: false, marker: true });
  expect((await markOf(page, id)).marks, '직렬화는 화면의 선택을 안 건드린다').toEqual([0]);
  expect(errs).toEqual([]);
});

test('S5 패널 항목 줄의 조각 버튼 — 누르면 그 조각 · 다시 누르면 풀린다 · 항목을 지우면 풀린다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  await clickSlice(page, id, 0);   // 블럭 선택(사용자 길)
  await expect.poll(async () => (await markOf(page, id)).sel).toBe(true);
  expect((await markOf(page, id)).marks, '전제: 조각은 아직 안 골랐다').toEqual([]);
  await page.locator('#grb-data-list .grb-data-icon-btn[data-slice-index="1"]').click();
  await expect.poll(async () => (await markOf(page, id)).marks).toEqual([1]);
  expect(await sliceSection(page)).toEqual({ title: 'Slice', name: '2번 · 나', idx: '1', activeBtns: ['1'] });
  await page.locator('#grb-data-list .grb-data-icon-btn[data-slice-index="1"]').click();
  await expect.poll(async () => (await markOf(page, id)).marks).toEqual([]);
  expect(await sliceSection(page)).toBeNull();
  /* 항목 삭제 — 색인이 다른 조각을 가리키지 않게 푼다 */
  await page.locator('#grb-data-list .grb-data-icon-btn[data-slice-index="2"]').click();
  await expect.poll(async () => (await markOf(page, id)).marks).toEqual([2]);
  await page.locator('#grb-data-list .grb-data-del-btn[data-index="0"]').click();
  await expect.poll(async () => (await itemsOf(page, id)).length).toBe(2);
  expect((await markOf(page, id)).marks).toEqual([]);
  expect(await sliceSection(page)).toBeNull();
  /* 막대 유형에선 조각 버튼이 없다 */
  await page.locator('#grb-type-v').click();
  await expect.poll(() => ds(page, id, 'chartType')).toBe('bar-v');
  expect(await page.locator('#grb-data-list .grb-data-icon-btn[data-slice-index]').count()).toBe(0);
  expect(errs).toEqual([]);
});

test('S6 다시 그려도 조각 선택이 남는다 — dataset 변경 · 패널 라벨 타이핑(Slice 절 머리도 따라 쓴다)', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  await pickSlice(page, id, 1);
  const h0 = await htmlOf(page, id);
  await setDs(page, id, { labelSize: '24' });
  expect(await htmlOf(page, id), '전제: 다시 그려졌다(다른 그림)').not.toBe(h0);
  expect(await markOf(page, id)).toEqual({ sel: true, marks: [1], api: 1 });
  await page.locator('#grb-data-list .grb-data-item:not(.grb-seg-item) .grb-data-label-input').nth(1).fill('새이름');
  await expect.poll(async () => (await itemsOf(page, id))[1].label).toBe('새이름');
  expect((await markOf(page, id)).marks, '라벨을 쳐도 표식 유지').toEqual([1]);
  expect((await sliceSection(page)).name).toBe('2번 · 새이름');
  /* 표식은 마크업 문자열이 아니라 «되붙인» 클래스다 — 풀고 다시 그리면 표식 없는 그림과 같다 */
  const marked = await htmlOf(page, id);
  const clean = await page.evaluate((id) => { const b = document.getElementById(id); window.grbPieSelect(b, null); window.renderGraph(b); return b.innerHTML; }, id);
  expect(marked).toContain('grb-pie-cell-selected');
  expect(clean).not.toContain('grb-pie-cell-selected');
  expect(marked.replace(' grb-pie-cell-selected', ''), '표식 클래스 한 낱말만 다르다').toBe(clean);
  expect(errs).toEqual([]);
});

test('S7 조각을 잡고 블럭을 끄는 것은 조각 고르기가 아니다 — 끈 뒤 표식 0', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  await clickSlice(page, id, 0);
  await expect.poll(async () => (await markOf(page, id)).sel, { message: '전제: 블럭이 선택돼 있다(다음 «클릭»이면 조각이 골라질 상태)' }).toBe(true);
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  const from = await slicePoint(page, id, 0);
  expect(from.on, '전제: 잡는 자리가 조각 0 위').toBe(0);
  const to = await page.evaluate(() => { const r = document.querySelector('#sG .gap-block').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await raf2(page);
  const b = await page.evaluate(() => { const g = document.querySelector('#sG .graph-block'); return g ? { slices: g.querySelectorAll('.grb-pie-slice').length, marks: g.querySelectorAll('.grb-pie-cell-selected').length } : null; });
  expect(b, '끈 뒤에도 블럭은 있고 · 조각 표식은 없다').toEqual({ slices: 3, marks: 0 });
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .grb-pie-cell-selected').length)).toBe(0);
  expect(errs).toEqual([]);
});

/* ── C4 조각 크기(items[i].pieGrow · 바깥 반지름에 더하는 % · 0 이면 키 없음) ── */
const vbOf = (page, id) => page.evaluate((id) => document.getElementById(id).querySelector('.grb-pie-svg').getAttribute('viewBox'), id);
test('H1 조각 크기 — pieGrow 20: 그 조각의 1.1R 점이 채움 안 · viewBox 가 대칭으로 넓어진다 · 다른 조각은 그대로', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  expect(await vbOf(page, id), '전제: 안 키운 원형의 viewBox').toBe('0 0 1000 1000');
  const none = [false, false, false];
  expect(await hit(page, id, 45, 1.1), '전제: 조각0 가운데 각의 1.1R 은 원 밖').toEqual(none);
  expect(await hit(page, id, 45, 0.9), '전제: 0.9R 은 조각0 안').toEqual([true, false, false]);
  const d0 = await dOf(page, id);
  await setDs(page, id, { items: V3.map((it, i) => i === 0 ? { ...it, pieGrow: 20 } : it) });
  expect(await hit(page, id, 45, 1.1), 'pieGrow 20: 1.1R 이 조각0 안').toEqual([true, false, false]);
  expect(await hit(page, id, 45, 1.25), '1.2R 너머는 밖').toEqual(none);
  expect(await vbOf(page, id), 'viewBox 대칭 확장(나간 길이 100)').toBe('-100 -100 1200 1200');
  expect(await hit(page, id, 135, 1.1), '다른 조각은 1.1R 이 밖').toEqual(none);
  expect(await hit(page, id, 270, 1.1)).toEqual(none);
  const d1 = await dOf(page, id);
  expect(d1[0], '전제: 키운 조각의 d 는 다르다').not.toBe(d0[0]);
  expect(d1.slice(1), '다른 조각의 d 는 한 글자도 안 변한다').toEqual(d0.slice(1));
  /* 도너츠에서도 — 바깥만 커지고 구멍은 같다 */
  await setDs(page, id, { pieDonut: '1' });
  expect(await hit(page, id, 45, 1.1)).toEqual([true, false, false]);
  expect(await hit(page, id, 45, 0.5), '구멍(0.55R 안)은 그대로 빈다').toEqual(none);
  /* 한계 밖은 렌더가 자른다(999 → PIE_GROW_MAX 30) · 0·글자는 안 키움 = 옛 viewBox */
  await setDs(page, id, { pieDonut: null, items: V3.map((it, i) => i === 0 ? { ...it, pieGrow: 999 } : it) });
  expect(await vbOf(page, id)).toBe(await page.evaluate(() => { const m = 500 * window.GRAPH_LIMITS.PIE_GROW_MAX / 100; return `${-m} ${-m} ${1000 + 2 * m} ${1000 + 2 * m}`; }));
  await setDs(page, id, { items: V3.map((it, i) => i === 0 ? { ...it, pieGrow: 'abc' } : it) });
  expect(await vbOf(page, id)).toBe('0 0 1000 1000');
  expect(await dOf(page, id)).toEqual(d0);
  expect(await htmlOf(page, id)).not.toMatch(/NaN|Infinity|undefined/);
  expect(errs).toEqual([]);
});

test('H2 조각 크기 보존 — 패널에서 라벨·값을 쳐도 · updateGraphBlock 으로 항목을 다시 써도 pieGrow 가 남는다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3.map((it, i) => i === 1 ? { ...it, pieGrow: 20 } : it) });
  expect((await itemsOf(page, id)).map(i => i.pieGrow ?? null), '전제: 둘째 항목에 pieGrow').toEqual([null, 20, null]);
  await openPanel(page, id);
  const rows = page.locator('#grb-data-list .grb-data-item:not(.grb-seg-item)');
  await expect(rows, '전제: 항목 줄 3').toHaveCount(3);
  await rows.nth(1).locator('.grb-data-label-input').fill('나!');
  await expect.poll(async () => (await itemsOf(page, id))[1].label).toBe('나!');
  expect((await itemsOf(page, id)).map(i => i.pieGrow ?? null), '라벨 한 글자에 떨어지지 않는다').toEqual([null, 20, null]);
  await rows.nth(0).locator('.grb-data-val-input').fill('3');
  await expect.poll(async () => (await itemsOf(page, id))[0].value).toBe(3);
  expect((await itemsOf(page, id)).map(i => i.pieGrow ?? null)).toEqual([null, 20, null]);
  expect(await vbOf(page, id), '그림도 키운 채').toBe('-100 -100 1200 1200');
  /* 항목을 통째로 다시 쓰는 길(carryItemExtras) */
  const r = await page.evaluate((id) => { const fn = window.updateGraphBlock; if (typeof fn !== 'function') return 'no-fn';
    try { const o = fn(id, { items: [{ label: 'x', value: 1 }, { label: 'y', value: 2 }, { label: 'z', value: 3 }] }); return (o && o.ok === false) ? 'fail: ' + o.code + ' ' + o.message : 'ok'; } catch (e) { return 'threw: ' + e.message; } }, id);
  expect(r, '전제: updateGraphBlock 이 있다').toBe('ok');
  await expect.poll(async () => (await itemsOf(page, id)).map(i => i.label)).toEqual(['x', 'y', 'z']);
  expect((await itemsOf(page, id)).map(i => i.pieGrow ?? null), 'updateGraphBlock 뒤에도').toEqual([null, 20, null]);
  expect(errs).toEqual([]);
});

test('H3 Slice 절 「크기」 칸 — 고른 조각에만 쓰고 · 0 이면 키가 지워지고 · 999 → 30 되써지고 · ⌘Z 한 번에 돌아온다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie' });
  expect(await page.locator('#grb-pie-grow-slider').count(), '전제: 조각을 안 골랐으면 칸이 없다').toBe(0);
  await pickSlice(page, id, 1);
  expect(await page.evaluate(() => { const s = document.getElementById('grb-pie-grow-slider'), n = document.getElementById('grb-pie-grow-number'); return [s.min, s.max, s.value, n.min, n.max, n.value]; }),
    '칸의 한계 = GRAPH_LIMITS · 처음 값 0').toEqual(await page.evaluate(() => { const a = ['0', String(window.GRAPH_LIMITS.PIE_GROW_MAX), '0']; return [...a, ...a]; }));
  expect(await page.evaluate(() => document.getElementById('grb-pie-grow-slider').closest('.prop-section').id), '칸은 Slice 절 안').toBe('grb-pie-slice-section');
  const grows = async () => (await itemsOf(page, id)).map(i => i.pieGrow ?? null);
  expect(await grows(), '전제: 키 없음').toEqual([null, null, null, null, null]);
  await page.evaluate(() => { const s = document.getElementById('grb-pie-grow-slider'); s.value = '15'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await grows(), '고른 조각(1)에만').toEqual([null, 15, null, null, null]);
  expect(await vbOf(page, id)).toBe('-75 -75 1150 1150');
  expect(await page.inputValue('#grb-pie-grow-number')).toBe('15');
  expect((await markOf(page, id)).marks, '칸을 움직여도 조각 선택 유지').toEqual([1]);
  await page.evaluate(() => document.getElementById('grb-pie-grow-slider').dispatchEvent(new Event('change', { bubbles: true })));   // 놓기 = 히스토리 한 칸
  await page.locator('#grb-pie-grow-number').fill('999');
  await page.locator('#grb-pie-grow-number').press('Enter');
  await expect.poll(grows).toEqual([null, 30, null, null, null]);
  expect(await page.inputValue('#grb-pie-grow-number')).toBe('30');
  expect(await page.inputValue('#grb-pie-grow-slider')).toBe('30');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => JSON.parse(document.querySelector('#sG .graph-block').dataset.items).map(i => i.pieGrow ?? null))).toEqual([null, 15, null, null, null]);
  expect(await page.evaluate(() => document.querySelector('#sG .graph-block .grb-pie-svg').getAttribute('viewBox')), '되돌린 그림 = 15 때').toBe('-75 -75 1150 1150');
  /* 0 으로 내리면 키가 지워진다 — 안 만진 항목과 같은 꼴 · viewBox 도 옛 글자 */
  const id2 = await page.evaluate(() => document.querySelector('#sG .graph-block').id);
  await page.evaluate((id2) => { const b = document.getElementById(id2); b.classList.add('selected'); window.grbPieSelect(b, 1); window.showGraphProperties(b); }, id2);
  await expect(page.locator('#grb-pie-grow-slider'), '전제: 되돌린 뒤 Slice 절을 다시 열었다').toHaveValue('15');
  await page.evaluate(() => { const s = document.getElementById('grb-pie-grow-slider'); s.value = '0'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await page.evaluate((id2) => 'pieGrow' in JSON.parse(document.getElementById(id2).dataset.items)[1], id2)).toBe(false);
  expect(await vbOf(page, id2)).toBe('0 0 1000 1000');
  expect(errs).toEqual([]);
});

/* ── C5 밀어내기(items[i].piePull · 바깥 반지름 대비 % · 0 이면 키 없음) ── d 는 그대로 두고 path 의 transform 으로 옮긴다. */
test('I1 밀어내기 — piePull 20: 그 조각만 transform 으로 옮겨진다(d 무변) · viewBox 대칭 확장 · 조각은 «옮긴 자리»에서 눌린다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  expect(await tfOf(page, id), '전제: 안 민 원형은 transform 속성이 없다').toEqual([null, null, null]);
  const none = [false, false, false], s0 = [true, false, false];
  expect(await hit(page, id, 45, 0.1), '전제: 조각0 가운데 각의 0.1R 은 조각0 안').toEqual(s0);
  expect(await hit(page, id, 45, 1.1), '전제: 1.1R 은 원 밖').toEqual(none);
  const d0 = await dOf(page, id), html0 = await htmlOf(page, id);
  await setDs(page, id, { items: V3.map((it, i) => i === 0 ? { ...it, piePull: 20 } : it) });
  expect(await tfOf(page, id), '조각0 에만 · R × 20 % = 100 을 45° 방향으로').toEqual(['translate(70.71 -70.71)', null, null]);
  expect(await dOf(page, id), 'd 는 한 글자도 안 변한다(세 조각 다)').toEqual(d0);
  expect(await vbOf(page, id), 'viewBox 대칭 확장(나간 길이 100)').toBe('-100 -100 1200 1200');
  expect(await hit(page, id, 45, 1.1), '옮긴 뒤: 1.1R 이 조각0 안').toEqual(s0);
  expect(await hit(page, id, 45, 0.1), '옮긴 뒤: 0.1R 은 빈 자리(조각이 떠났다)').toEqual(none);
  expect(await hit(page, id, 135, 0.9), '다른 조각은 제자리').toEqual([false, true, false]);
  expect(await hit(page, id, 135, 1.1)).toEqual(none);
  /* 화면에서도 옮겨졌다 — 옮긴 자리(1.1R)의 맨 위 요소가 조각0 · 떠난 자리(0.1R − 민 양 = 중심 쪽)는 조각0 이 아니다. 누르면 그 조각이 골라진다(판정이 옮긴 자리 기준) */
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  expect((await slicePoint(page, id, 0, 0.9)).on, '옮긴 자리의 맨 위 요소 = 조각0').toBe(0);
  const left = await page.evaluate((id) => { const b = document.getElementById(id); const a = Math.PI / 4;
    const p = new DOMPoint(500 + 50 * Math.sin(a), 500 - 50 * Math.cos(a)).matrixTransform(b.querySelector('.grb-pie-svg').getScreenCTM());
    const el = document.elementFromPoint(p.x, p.y); return !!el && b.contains(el) && !el.matches('.grb-pie-slice'); }, id);
  expect(left, '떠난 자리(0.1R)는 조각이 아니다(블럭 안의 빈 자리)').toBe(true);
  await page.mouse.click((await slicePoint(page, id, 0, 0.9)).x, (await slicePoint(page, id, 0, 0.9)).y);
  await expect.poll(async () => (await markOf(page, id)).sel, { message: '첫 클릭 = 블럭 선택' }).toBe(true);
  const far = await slicePoint(page, id, 0, 0.95);   // 옮기기 전엔 원 밖이던 자리(0.95R + 0.2R 민 자리 = 원래 좌표 1.15R)
  expect(far.on, '전제: 원래 원 밖이던 자리에 조각0 이 와 있다').toBe(0);
  await page.mouse.click(far.x, far.y);
  await expect.poll(async () => (await markOf(page, id)).marks, { message: '옮긴 자리에서 누르면 조각0 이 골라진다' }).toEqual([0]);
  expect((await sliceSection(page)).name).toBe('1번 · 가');
  expect(await tfOf(page, id), '고른 뒤(패널이 다시 그려도) 옮긴 양 그대로').toEqual(['translate(70.71 -70.71)', null, null]);
  /* 크기와 같이 — extent 는 더해진다 · 한계 밖은 렌더가 자른다(999 → PIE_PULL_MAX) · 0·글자는 안 밂 = 옛 그림(바이트) */
  await page.evaluate(() => window.deselectAll());
  await setDs(page, id, { items: V3.map((it, i) => i === 0 ? { ...it, piePull: 20, pieGrow: 20 } : it) });
  expect(await vbOf(page, id), '크기 20 + 밀어내기 20 = 200').toBe('-200 -200 1400 1400');
  await setDs(page, id, { items: V3.map((it, i) => i === 1 ? { ...it, piePull: 999 } : it) });
  expect(await vbOf(page, id)).toBe(await page.evaluate(() => { const m = 500 * window.GRAPH_LIMITS.PIE_PULL_MAX / 100; return `${-m} ${-m} ${1000 + 2 * m} ${1000 + 2 * m}`; }));
  expect((await tfOf(page, id)).map(t => t === null), '둘째 조각에만').toEqual([true, false, true]);
  await setDs(page, id, { items: V3.map((it, i) => i === 0 ? { ...it, piePull: 'abc' } : { ...it, piePull: 0 }) });
  expect(await htmlOf(page, id), '안 밀면 옛 그림과 바이트가 같다(transform 속성 자체가 없다)').toBe(html0);
  expect(await htmlOf(page, id)).not.toMatch(/NaN|Infinity|undefined/);
  expect(errs).toEqual([]);
});

test('I2 Slice 절 「밀어내기」 칸 — 고른 조각에만 쓰고 · 999 → 30 되써지고 · ⌘Z 한 번에 돌아오고 · 0 이면 키와 transform 이 지워진다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie' });
  expect(await page.locator('#grb-pie-pull-slider').count(), '전제: 조각을 안 골랐으면 칸이 없다').toBe(0);
  await pickSlice(page, id, 2);
  expect(await page.evaluate(() => { const s = document.getElementById('grb-pie-pull-slider'), n = document.getElementById('grb-pie-pull-number'); return [s.min, s.max, s.value, n.min, n.max, n.value]; }),
    '칸의 한계 = GRAPH_LIMITS · 처음 값 0').toEqual(await page.evaluate(() => { const a = ['0', String(window.GRAPH_LIMITS.PIE_PULL_MAX), '0']; return [...a, ...a]; }));
  expect(await page.evaluate(() => { const r = document.getElementById('grb-pie-pull-slider').closest('.prop-row'); return [r.closest('.prop-section').id, r.querySelector('.prop-label').textContent.trim()]; })).toEqual(['grb-pie-slice-section', '밀어내기']);
  const pulls = async () => (await itemsOf(page, id)).map(i => i.piePull ?? null);
  expect(await pulls(), '전제: 키 없음').toEqual([null, null, null, null, null]);
  await page.evaluate(() => { const s = document.getElementById('grb-pie-pull-slider'); s.value = '12'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await pulls(), '고른 조각(2)에만').toEqual([null, null, 12, null, null]);
  expect((await tfOf(page, id)).map(t => t === null)).toEqual([true, true, false, true, true]);
  expect(await vbOf(page, id)).toBe('-60 -60 1120 1120');
  expect(await page.inputValue('#grb-pie-pull-number')).toBe('12');
  expect((await markOf(page, id)).marks, '칸을 움직여도 조각 선택 유지').toEqual([2]);
  await page.evaluate(() => document.getElementById('grb-pie-pull-slider').dispatchEvent(new Event('change', { bubbles: true })));   // 놓기 = 히스토리 한 칸
  await page.locator('#grb-pie-pull-number').fill('999');
  await page.locator('#grb-pie-pull-number').press('Enter');
  await expect.poll(pulls).toEqual([null, null, 30, null, null]);
  expect(await page.inputValue('#grb-pie-pull-slider')).toBe('30');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => JSON.parse(document.querySelector('#sG .graph-block').dataset.items).map(i => i.piePull ?? null))).toEqual([null, null, 12, null, null]);
  expect(await page.evaluate(() => document.querySelector('#sG .graph-block .grb-pie-svg').getAttribute('viewBox')), '되돌린 그림 = 12 때').toBe('-60 -60 1120 1120');
  const id2 = await page.evaluate(() => document.querySelector('#sG .graph-block').id);
  await page.evaluate((id2) => { const b = document.getElementById(id2); b.classList.add('selected'); window.grbPieSelect(b, 2); window.showGraphProperties(b); }, id2);
  await expect(page.locator('#grb-pie-pull-slider'), '전제: 되돌린 뒤 Slice 절을 다시 열었다').toHaveValue('12');
  await page.evaluate(() => { const s = document.getElementById('grb-pie-pull-slider'); s.value = '0'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await page.evaluate((id2) => 'piePull' in JSON.parse(document.getElementById(id2).dataset.items)[2], id2)).toBe(false);
  expect(await tfOf(page, id2)).toEqual([null, null, null, null, null]);
  expect(await vbOf(page, id2)).toBe('0 0 1000 1000');
  /* 라벨을 쳐도 piePull 이 남는다(syncItems 보존 — pieGrow 와 같은 길) */
  await page.evaluate(() => { const s = document.getElementById('grb-pie-pull-slider'); s.value = '9'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#grb-data-list .grb-data-item:not(.grb-seg-item) .grb-data-label-input').nth(0).fill('새');
  await expect.poll(() => page.evaluate((id2) => JSON.parse(document.getElementById(id2).dataset.items)[0].label, id2)).toBe('새');
  expect(await page.evaluate((id2) => JSON.parse(document.getElementById(id2).dataset.items).map(i => i.piePull ?? null), id2)).toEqual([null, null, 9, null, null]);
  expect(errs).toEqual([]);
});

/* ── C3 조각 안 라벨(순위 배지 + 이름) ── dataset.pieRank / pieName '1'(기본 꺼짐) · 조각별 items[i].pieTag 'on' / 'off' / 없음(자동). svg 뒤의 HTML 덧층 .grb-pie-tags. */
const tagsOf = (page, id) => page.evaluate((id) => { const b = document.getElementById(id);
  return { layers: b.querySelectorAll('.grb-pie-tags').length, n: b.querySelectorAll('.grb-pie-tag').length,
    rank: [...b.querySelectorAll('.grb-pie-tag')].map(t => t.querySelector('.grb-pie-rank')?.textContent ?? null),
    name: [...b.querySelectorAll('.grb-pie-tag')].map(t => t.querySelector('.grb-pie-name')?.textContent ?? null),
    shown: [...b.querySelectorAll('.grb-pie-tag')].map(t => getComputedStyle(t).display !== 'none') }; }, id);

test('J1 순위·이름 토글 — 기본은 꺼짐(덧층 없음) · 켜면 조각마다 라벨 하나 · 「n위」(동률은 같은 순위) · 끄면 키가 지워진다 · ⌘Z', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V6 });
  expect(await tagsOf(page, id), '전제: 새 원형에는 덧층이 없다').toEqual({ layers: 0, n: 0, rank: [], name: [], shown: [] });
  expect([await ds(page, id, 'pieRank'), await ds(page, id, 'pieName')], '전제: 키 없음').toEqual([null, null]);
  await openPanel(page, id);
  await expect(page.locator('#grb-pie-rank-toggle'), '전제: 토글 꺼짐').not.toBeChecked();
  await expect(page.locator('#grb-pie-name-toggle')).not.toBeChecked();
  expect(await page.evaluate(() => ['grb-pie-rank-toggle', 'grb-pie-name-toggle'].map(i => document.getElementById(i).closest('.prop-row').querySelector('.prop-label').textContent.trim()))).toEqual(['순위 표시', '이름 표시']);
  await clickToggle(page, 'grb-pie-rank-toggle');
  await expect.poll(() => ds(page, id, 'pieRank')).toBe('1');
  let t = await tagsOf(page, id);
  expect([t.layers, t.n], '덧층 하나 · 라벨 = 항목 수').toEqual([1, 6]);
  expect(t.rank, '값 30·20·15·15·10·10 → 동률은 같은 순위').toEqual(['1위', '2위', '3위', '3위', '5위', '5위']);
  expect(t.name, '이름은 아직 꺼짐').toEqual([null, null, null, null, null, null]);
  expect(t.shown.slice(0, 2), '넉넉한 조각은 보인다').toEqual([true, true]);
  expect(await page.evaluate((id) => { const b = document.getElementById(id); const w = b.querySelector('.grb-pie-wrap'); return [w.children.length, w.children[0].matches('svg.grb-pie-svg'), w.children[1].matches('.grb-pie-tags')]; }, id), '덧층은 svg 바로 뒤').toEqual([2, true, true]);
  await clickToggle(page, 'grb-pie-name-toggle');
  await expect.poll(() => ds(page, id, 'pieName')).toBe('1');
  t = await tagsOf(page, id);
  expect(t.name).toEqual(['k0', 'k1', 'k2', 'k3', 'k4', 'k5']);
  expect(t.rank[0]).toBe('1위');
  expect(await legendOf(page, id), '범례는 그대로(라벨·%)').toEqual([['k0', '30%'], ['k1', '20%'], ['k2', '15%'], ['k3', '15%'], ['k4', '10%'], ['k5', '10%']]);
  /* ⌘Z 한 번 = 이름 켜기 전 */
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => { const g = document.querySelector('#sG .graph-block'); return [g.dataset.pieRank ?? null, g.dataset.pieName ?? null, g.querySelectorAll('.grb-pie-name').length]; })).toEqual(['1', null, 0]);
  /* 끄면 키가 지워지고 덧층이 사라진다 */
  const id2 = await page.evaluate(() => document.querySelector('#sG .graph-block').id);
  await openPanel(page, id2);
  await expect(page.locator('#grb-pie-rank-toggle'), '전제: 되돌린 뒤 패널 — 순위 켜짐').toBeChecked();
  await clickToggle(page, 'grb-pie-rank-toggle');
  await expect.poll(() => ds(page, id2, 'pieRank')).toBeNull();
  expect((await tagsOf(page, id2)).layers).toBe(0);
  /* 값 0 항목 — 라벨은 있되(색인 유지) 숨고 순위 글자가 없다 · 막대 유형에선 토글이 없다 */
  await setDs(page, id2, { pieRank: '1', items: [{ label: 'a', value: 0 }, { label: 'b', value: 5 }, { label: 'c', value: 5 }] });
  t = await tagsOf(page, id2);
  expect([t.n, t.rank, t.shown]).toEqual([3, ['', '1위', '1위'], [false, true, true]]);
  await openPanel(page, id2);
  await page.locator('#grb-type-v').click();
  await expect.poll(() => ds(page, id2, 'chartType')).toBe('bar-v');
  expect(await page.locator('#grb-pie-rank-toggle').count()).toBe(0);
  expect(await page.evaluate((id2) => document.getElementById(id2).querySelectorAll('.grb-pie-tags').length, id2), '막대로 그리면 덧층도 없다').toBe(0);
  expect(errs).toEqual([]);
});

const VW = [50, 30, 12, 5, 3].map((v, i) => ({ label: 'w' + i, value: v }));   // 각 폭 180 · 108 · 43.2 · 18 · 10.8 — 뒤의 둘이 자동 숨김 문턱 아래
test('J2 좁은 조각은 자동으로 숨는다 · 조각별 「라벨」 자동/항상/숨김이 이긴다 · 구멍이 크면(고리가 얇으면) 자동은 전부 숨는다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: VW, extra: { pieRank: '1', pieName: '1' } });
  let t = await tagsOf(page, id);
  expect(t.n, '전제: 라벨 5(항목마다 하나)').toBe(5);
  expect(t.shown, '넓은 셋은 보이고 좁은 둘은 숨는다').toEqual([true, true, true, false, false]);
  expect(t.rank[4], '숨은 라벨도 글자는 있다(색인 유지)').toBe('5위');
  await setDs(page, id, { items: VW.map((it, i) => i === 3 ? { ...it, pieTag: 'on' } : i === 0 ? { ...it, pieTag: 'off' } : it) });
  expect((await tagsOf(page, id)).shown, "pieTag 'on' = 좁아도 보임 · 'off' = 넓어도 숨김").toEqual([false, true, true, true, false]);
  await setDs(page, id, { items: VW.map((it, i) => i === 3 ? { ...it, pieTag: 'banana' } : it) });
  expect((await tagsOf(page, id)).shown, '모르는 값 = 자동').toEqual([true, true, true, false, false]);
  /* 패널 Slice 절 「라벨」 */
  await setDs(page, id, { items: VW });
  await pickSlice(page, id, 1);
  expect(await page.evaluate(() => { const s = document.getElementById('grb-pie-tag-select'); return [s.closest('.prop-section').id, s.closest('.prop-row').querySelector('.prop-label').textContent.trim(), s.value, [...s.options].map(o => [o.value, o.textContent.trim()])]; }))
    .toEqual(['grb-pie-slice-section', '라벨', '', [['', '자동'], ['on', '항상'], ['off', '숨김']]]);
  await page.locator('#grb-pie-tag-select').selectOption('off');
  await expect.poll(async () => (await itemsOf(page, id)).map(i => i.pieTag ?? null)).toEqual([null, 'off', null, null, null]);
  expect((await tagsOf(page, id)).shown).toEqual([true, false, true, false, false]);
  expect((await markOf(page, id)).marks, '칸을 바꿔도 조각 선택 유지').toEqual([1]);
  await page.locator('#grb-pie-tag-select').selectOption('on');
  await expect.poll(async () => (await itemsOf(page, id))[1].pieTag).toBe('on');
  await page.locator('#grb-pie-tag-select').selectOption('');
  await expect.poll(async () => 'pieTag' in (await itemsOf(page, id))[1], { message: '자동 = 키 삭제' }).toBe(false);
  expect((await tagsOf(page, id)).shown).toEqual([true, true, true, false, false]);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => JSON.parse(document.querySelector('#sG .graph-block').dataset.items)[1].pieTag ?? null), { message: '⌘Z 한 번 = 직전 값' }).toBe('on');
  /* 다시 열면 칸이 모델 값을 보인다 · 라벨을 쳐도 pieTag 가 남는다 */
  const id2 = await page.evaluate(() => document.querySelector('#sG .graph-block').id);
  await page.evaluate((id2) => { const b = document.getElementById(id2); b.classList.add('selected'); window.grbPieSelect(b, 1); window.showGraphProperties(b); }, id2);
  await expect(page.locator('#grb-pie-tag-select')).toHaveValue('on');
  await page.locator('#grb-data-list .grb-data-item:not(.grb-seg-item) .grb-data-label-input').nth(1).fill('새');
  await expect.poll(async () => (await itemsOf(page, id2))[1].label).toBe('새');
  expect((await itemsOf(page, id2))[1].pieTag).toBe('on');
  expect((await tagsOf(page, id2)).name[1], '조각 안 이름도 따라 바뀐다').toBe('새');
  /* 도너츠 — 구멍 80 이면 고리 두께 100 < 문턱 ⇒ 자동은 전부 숨고 'on' 만 남는다 */
  await setDs(page, id2, { pieDonut: '1', pieHole: '80' });
  expect((await tagsOf(page, id2)).shown).toEqual([false, true, false, false, false]);
  await setDs(page, id2, { pieHole: '55' });
  expect((await tagsOf(page, id2)).shown).toEqual([true, true, true, false, false]);
  expect(errs).toEqual([]);
});

test('J3 이름은 사용자 글자 — 태그·속성이 «글자 그대로» 찍히고 요소가 안 생기고 스크립트가 안 돈다', async ({ page }) => {
  const evil = ['<img src=x onerror="window.__pwn=1">', '</span></div><script>window.__pwn=2</script><svg onload="window.__pwn=3">', '"><b style="color:red">굵게</b>&amp;'];
  const { errs, id } = await setup(page, { type: 'pie', items: evil.map(l => ({ label: l, value: 1 })), extra: { pieRank: '1', pieName: '1' } });
  const probe = (bid) => page.evaluate((bid) => { const b = document.getElementById(bid); const L = b.querySelector('.grb-pie-tags');
    return { tags: L ? L.querySelectorAll('.grb-pie-tag').length : -1, names: L ? [...L.querySelectorAll('.grb-pie-name')].map(n => n.textContent) : [],
      kids: L ? [...L.querySelectorAll('*')].filter(e => !e.matches('.grb-pie-tag, .grb-pie-rank, .grb-pie-name')).map(e => e.tagName) : ['no-layer'],
      alien: b.querySelectorAll('img, script, b, [onerror], [onload]').length, svgs: b.querySelectorAll('svg').length, pwn: window.__pwn ?? null }; }, bid);
  await raf2(page);
  const r = await probe(id);
  expect(r.tags, '전제: 덧층에 라벨 3').toBe(3);
  expect(r.names, '이름은 넣은 글자 그대로').toEqual(evil);
  expect({ kids: r.kids, alien: r.alien, svgs: r.svgs, pwn: r.pwn }, '덧층 안에는 라벨 요소뿐 · 주입된 요소 0 · svg 는 그래프 하나 · 실행 0').toEqual({ kids: [], alien: 0, svgs: 1, pwn: null });
  /* 패널에서 «치는» 길도 같다 */
  await openPanel(page, id);
  const evil2 = '<img src=x onerror="window.__pwn=9"><i>기울임</i>';
  await page.locator('#grb-data-list .grb-data-item:not(.grb-seg-item) .grb-data-label-input').nth(0).fill(evil2);
  await expect.poll(async () => (await itemsOf(page, id))[0].label).toBe(evil2);
  await raf2(page);
  const r2 = await probe(id);
  expect(r2.names[0]).toBe(evil2);
  expect({ kids: r2.kids, alien: r2.alien, pwn: r2.pwn }).toEqual({ kids: [], alien: 0, pwn: null });
  expect(await page.evaluate(() => document.querySelectorAll('#sG i, #sG img').length), '캔버스 섹션 어디에도 주입된 요소가 없다').toBe(0);
  expect(errs).toEqual([]);
});

test('J4 글자 톤 — 어두운 조각 위는 밝은 글자 · 밝은 조각 위는 어두운 글자 · 배지 글자는 그 반대 · 저장본에는 톤 변수가 안 실린다', async ({ page }) => {
  const items = [{ label: '어둠', value: 1, color: '#111111' }, { label: '밝음', value: 1, color: '#f5f5f5' }];
  const { errs, id } = await setup(page, { type: 'pie', items, extra: { pieRank: '1', pieName: '1' } });
  const tone = (bid) => page.evaluate((bid) => [...document.getElementById(bid).querySelectorAll('.grb-pie-tag')].map(t => { const r = t.querySelector('.grb-pie-rank');
    return { fg: t.style.getPropertyValue('--grb-seg-fg').trim(), ink: t.style.getPropertyValue('--grb-pie-rank-ink').trim(), color: getComputedStyle(t).color, pill: getComputedStyle(r).backgroundColor, pillInk: getComputedStyle(r).color }; }), bid);
  await expect.poll(async () => (await tone(id)).map(t => !!t.fg), { message: '전제: 라벨 둘에 톤 변수가 섰다' }).toEqual([true, true]);
  const t = await tone(id);
  expect(t[0].fg, '두 조각의 글자 톤이 다르다').not.toBe(t[1].fg);
  expect([t[0].ink, t[1].ink], '배지 글자 = 상대 조각의 글자 톤(두 색을 맞바꿔 쓴다 — 새 색 0)').toEqual([t[1].fg, t[0].fg]);
  expect(t[0].color, '그려진 글자색도 다르다').not.toBe(t[1].color);
  expect([t[0].pill, t[1].pill], '배지 바탕 = 그 라벨의 글자색(채운 알약)').toEqual([t[0].color, t[1].color]);
  expect([t[0].pillInk, t[1].pillInk], '배지 글자 = 반대 톤').toEqual([t[1].color, t[0].color]);
  /* 어두운 조각 위 글자가 더 밝다 — 밝기는 색 성분의 합으로 견준다(리터럴 없이) */
  const lum = (c) => c.match(/\d+/g).slice(0, 3).reduce((a, b) => a + +b, 0);
  expect(lum(t[0].color), '어두운 조각 위 글자가 밝은 조각 위 글자보다 밝다').toBeGreaterThan(lum(t[1].color));
  /* 조각 색을 맞바꾸면 톤도 맞바뀐다(색인으로 짝짓는다) */
  await setDs(page, id, { items: [{ ...items[0], color: '#f5f5f5' }, { ...items[1], color: '#111111' }] });
  const t2 = await tone(id);
  expect([t2[0].fg, t2[1].fg]).toEqual([t[1].fg, t[0].fg]);
  /* 저장본 — 라벨은 실리고 톤 변수는 안 실린다 · 화면은 그대로 */
  const r = await page.evaluate((id) => { const saved = window.getSerializedCanvas(); const live = document.getElementById(id).innerHTML;
    return { hasTags: saved.includes('grb-pie-tag') && saved.includes('grb-pie-rank'), fg: saved.includes('--grb-seg-fg'), ink: saved.includes('--grb-pie-rank-ink'), liveFg: live.includes('--grb-seg-fg'), liveInk: live.includes('--grb-pie-rank-ink'),
      listed: ['--grb-seg-fg', '--grb-pie-rank-ink'].map(v => window.__gdTextTone.DERIVED_AUTO_VARS.includes(v)) }; }, id);
  expect(r).toEqual({ hasTags: true, fg: false, ink: false, liveFg: true, liveInk: true, listed: [true, true] });
  /* 저장본을 다시 꽂으면(열기) 관찰자가 톤을 다시 쓴다 — 변수 없는 채로 굳지 않는다 */
  await page.evaluate((id) => { const g = document.getElementById(id); const row = g.parentElement; const tmp = document.createElement('div'); tmp.innerHTML = window.getSerializedCanvas();
    const fresh = tmp.querySelector('#' + id); const html = fresh.parentElement.outerHTML; row.insertAdjacentHTML('afterend', html); row.remove(); window.rebindAll?.(); }, id);
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.grb-pie-tag').length, id), '전제: 다시 꽂은 블럭에 라벨 2').toBe(2);
  await expect.poll(async () => (await tone(id)).map(x => x.fg), { message: '다시 꽂은 뒤 톤 변수가 돌아온다' }).toEqual([t2[0].fg, t2[1].fg]);
  expect(errs).toEqual([]);
});

/* 라벨 i 의 가운데(화면) → SVG 사용자 좌표 → 조각마다 채움 안인가(밀어낸 조각은 옮긴 양을 뺀다) · 그 자리의 맨 위 요소가 몇 번 조각인가 */
const tagSpot = (page, id) => page.evaluate((id) => { const b = document.getElementById(id); const svg = b.querySelector('.grb-pie-svg'); const inv = svg.getScreenCTM().inverse(); const slices = [...b.querySelectorAll('.grb-pie-slice')];
  return [...b.querySelectorAll('.grb-pie-tag')].map((t, i) => { if (getComputedStyle(t).display === 'none') return null; const r = t.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const p = new DOMPoint(cx, cy).matrixTransform(inv);
    const inFill = slices.map(s => { const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(s.getAttribute('transform') || ''); return !!s.getAttribute('d') && s.isPointInFill(new DOMPoint(p.x - (m ? +m[1] : 0), p.y - (m ? +m[2] : 0))); });
    const el = document.elementFromPoint(cx, cy);
    return { own: inFill[i], others: inFill.filter((v, k) => v && k !== i).length, top: el && el.matches('.grb-pie-slice') ? slices.indexOf(el) : -1, x: cx, y: cy }; }); }, id);
test('J5 라벨은 제 조각 위에 앉는다(원형·도너츠 · 크기·밀어내기·시작 각도를 따라간다) · 클릭을 안 가로챈다(라벨 위를 눌러도 그 조각)', async ({ page }) => {
  const all = V6.map(it => ({ ...it, pieTag: 'on' }));   // 좁은 조각까지 전부 보이게 — 자리가 조금만 어긋나도 이웃 조각에 떨어진다
  const { errs, id } = await setup(page, { type: 'pie', items: all, extra: { pieRank: '1', pieName: '1' } });
  const check = async (what) => { await waitStableRect(page, `#${id} .grb-pie-svg`); const sp = await tagSpot(page, id);
    expect(sp.length, `전제(${what}): 라벨 6`).toBe(6); expect(sp.every(Boolean), `전제(${what}): 여섯 다 보인다`).toBe(true);
    expect(sp.map(s => [s.own, s.others]), `${what}: 라벨 가운데가 제 조각 채움 안 · 다른 조각 밖`).toEqual(sp.map(() => [true, 0]));
    expect(sp.map(s => s.top), `${what}: 라벨 가운데의 맨 위 요소 = 그 조각(덧층이 안 가린다)`).toEqual([0, 1, 2, 3, 4, 5]); return sp; };
  await check('원형');
  await setDs(page, id, { pieDonut: '1' });
  await check('도너츠');
  await setDs(page, id, { pieStart: '77', pieGap: '30' });
  await check('시작 각도 77 · 간격 30');
  await setDs(page, id, { items: all.map((it, i) => i === 0 ? { ...it, pieGrow: 30 } : i === 4 ? { ...it, piePull: 30 } : i === 2 ? { ...it, pieGrow: 10, piePull: 15 } : it) });
  expect(await vbOf(page, id), '전제: viewBox 가 넓어졌다').not.toBe('0 0 1000 1000');
  const sp = await check('크기·밀어내기(도너츠)');
  await setDs(page, id, { pieDonut: null });
  await check('크기·밀어내기(원형)');
  /* 덧층은 svg 가 그려지는 정사각과 겹친다 — 네 변이 svg 의 viewBox 네 변과 같다(SVG 좌표로 되돌려 견준다 · 화면 px 리터럴 없이) */
  const box = await page.evaluate((id) => { const b = document.getElementById(id); const svg = b.querySelector('.grb-pie-svg'); const inv = svg.getScreenCTM().inverse(); const r = b.querySelector('.grb-pie-tags').getBoundingClientRect();
    const a = new DOMPoint(r.left, r.top).matrixTransform(inv), c = new DOMPoint(r.right, r.bottom).matrixTransform(inv); const vb = svg.viewBox.baseVal;
    return [a.x - vb.x, a.y - vb.y, c.x - (vb.x + vb.width), c.y - (vb.y + vb.height)].map(v => Math.abs(v) < vb.width / 200); }, id);
  expect(box, '덧층 네 변 = viewBox 네 변(0.5 % 안)').toEqual([true, true, true, true]);
  /* 라벨 위를 눌러도 조각이 골라진다 — 한 번 = 블럭 · 또 한 번 = 그 조각 */
  const sp2 = await tagSpot(page, id);
  await page.mouse.click(sp2[1].x, sp2[1].y);
  await expect.poll(async () => (await markOf(page, id)).sel, { message: '라벨 위 첫 클릭 = 블럭 선택' }).toBe(true);
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  const sp3 = await tagSpot(page, id);
  expect(sp3[4].top, '전제: 밀어낸 조각4 의 라벨 자리').toBe(4);
  await page.mouse.click(sp3[4].x, sp3[4].y);
  await expect.poll(async () => (await markOf(page, id)).marks, { message: '라벨 위 둘째 클릭 = 그 조각' }).toEqual([4]);
  expect((await tagsOf(page, id)).n, '고른 뒤에도 라벨 6').toBe(6);
  expect(sp.length).toBe(6);
  expect(errs).toEqual([]);
});

test('J6 둘 다 끄면 켜기 전 그림과 바이트가 같다 · 두 번 그려 같다 · pieTag 만 있고 토글이 꺼져 있으면 덧층이 없다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'donut', items: V6 });
  const html0 = await htmlOf(page, id);
  expect(html0, '전제: 덧층 없는 그림').not.toContain('grb-pie-tag');
  await setDs(page, id, { pieRank: '1', pieName: '1' });
  const on = await htmlOf(page, id);
  expect(on, '전제: 켜면 덧층이 생긴다').toContain('class="grb-pie-tags"');
  await setDs(page, id, {});
  expect(await htmlOf(page, id), '같은 데이터로 다시 그리면 같은 글자(톤 변수 포함)').toBe(on);
  expect(on.replace(/<div class="grb-pie-tags".*?<\/div><\/div>/s, ''), '덧층을 뺀 나머지는 켜기 전과 한 글자도 안 다르다').toBe(html0);
  await setDs(page, id, { pieRank: null, pieName: null });
  expect(await htmlOf(page, id), '끄면 켜기 전 그림(바이트)').toBe(html0);
  await setDs(page, id, { items: V6.map(it => ({ ...it, pieTag: 'on' })) });
  expect(await htmlOf(page, id), "조각별 pieTag 'on' 만으로는 아무것도 안 그린다(블럭 토글이 꺼져 있다)").toBe(html0);
  await setDs(page, id, { pieRank: '0', pieName: 'yes' });
  expect(await htmlOf(page, id), "켜짐 = 정확히 '1' 만").toBe(html0);
  expect(errs).toEqual([]);
});

/* ── C7 그림자(dataset.dropShadow 'soft' / 'strong' · 없음 = 키 없음) ── 칠하는 자리 = CSS(.grb-pie-svg 의 filter). 그림(innerHTML)은 안 바뀐다. */
const filterOf = (page, id, sel = '.grb-pie-svg') => page.evaluate(([id, sel]) => { const e = document.getElementById(id).querySelector(sel); return e ? getComputedStyle(e).filter : null; }, [id, sel]);
const dropGroup = (page) => page.evaluate(() => { const g = document.getElementById('grb-drop-group'); return g ? { title: g.closest('.prop-section').querySelector('.prop-section-title').textContent.trim(),
  btns: [...g.querySelectorAll('.prop-align-btn')].map(b => [b.dataset.val, b.textContent.trim()]), active: [...g.querySelectorAll('.prop-align-btn.active')].map(b => b.dataset.val) } : null; });
test('K1 그림자 — Shadow 절의 없음/부드럽게/강하게가 svg 에 그림자를 건다 · 없음 = 키 삭제 · 그림(innerHTML)은 한 글자도 안 바뀐다 · ⌘Z · 저장본에 키가 실린다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  expect(await ds(page, id, 'dropShadow'), '전제: 키 없음').toBeNull();
  expect(await filterOf(page, id), '전제: 그림자 없음').toBe('none');
  const html0 = await htmlOf(page, id);
  await openPanel(page, id);
  expect(await dropGroup(page), 'Shadow 절 — 세 단계 · 「없음」이 켜져 있다').toEqual({ title: 'Shadow', btns: [['none', '없음'], ['soft', '부드럽게'], ['strong', '강하게']], active: ['none'] });
  await page.locator('#grb-drop-group .prop-align-btn[data-val="soft"]').click();
  await expect.poll(() => ds(page, id, 'dropShadow')).toBe('soft');
  const fSoft = await filterOf(page, id);
  expect(fSoft, '부드럽게: svg 에 drop-shadow').toContain('drop-shadow');
  expect((await dropGroup(page)).active).toEqual(['soft']);
  expect(await htmlOf(page, id), '그림(innerHTML)은 그대로 — 속성 하나만 바뀐다').toBe(html0);
  expect(await filterOf(page, id, '.grb-pie-legend'), '범례에는 그림자가 없다').toBe('none');
  await page.locator('#grb-drop-group .prop-align-btn[data-val="strong"]').click();
  await expect.poll(() => ds(page, id, 'dropShadow')).toBe('strong');
  const fStrong = await filterOf(page, id);
  expect(fStrong).toContain('drop-shadow');
  expect(fStrong, '강하게 ≠ 부드럽게').not.toBe(fSoft);
  /* 저장본에 키가 실리고(파생 값이 아니다) 다시 꽂아도 그림자가 선다 */
  expect(await page.evaluate(() => window.getSerializedCanvas().includes('data-drop-shadow="strong"'))).toBe(true);
  /* ⌘Z 한 번 = 직전 단계 */
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => document.querySelector('#sG .graph-block')?.dataset.dropShadow ?? null)).toBe('soft');
  const id2 = await page.evaluate(() => document.querySelector('#sG .graph-block').id);
  expect(await filterOf(page, id2), '되돌린 그림자 = 부드럽게').toBe(fSoft);
  /* 없음 = 키 삭제(안 만진 블럭과 같은 꼴) */
  await openPanel(page, id2);
  expect((await dropGroup(page)).active, '전제: 다시 연 패널이 모델 값을 보인다').toEqual(['soft']);
  await page.locator('#grb-drop-group .prop-align-btn[data-val="none"]').click();
  await expect.poll(() => ds(page, id2, 'dropShadow')).toBeNull();
  expect(await filterOf(page, id2)).toBe('none');
  expect(await page.evaluate((id2) => document.getElementById(id2).hasAttribute('data-drop-shadow'), id2)).toBe(false);
  expect(await htmlOf(page, id2)).toBe(html0);
  /* 도너츠·조각 안 라벨과 같이 — 그림자는 svg 에만(라벨 덧층에는 없다) · 모르는 값은 그림자 없음 + 「없음」 */
  await setDs(page, id2, { pieDonut: '1', pieRank: '1', dropShadow: 'soft' });
  expect(await filterOf(page, id2)).toBe(fSoft);
  expect(await filterOf(page, id2, '.grb-pie-tags')).toBe('none');
  await setDs(page, id2, { dropShadow: 'banana' });
  expect(await filterOf(page, id2)).toBe('none');
  await openPanel(page, id2);
  expect((await dropGroup(page)).active).toEqual(['none']);
  expect(errs).toEqual([]);
});

test('K2 그림자 값은 확대블럭 선례와 같다(넷째 벌 없음) · 막대 유형에선 Shadow 절도 그림자도 없다(죽은 키)', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  /* 선례 = css/editor-blocks.css `.zoom-block[data-drop-shadow] > .zoom-clip` — 같은 판에 탐침을 세워 «계산된 값»끼리 견준다(리터럴 없이) */
  const ref = await page.evaluate(() => { const out = {}; for (const v of ['soft', 'strong']) { const z = document.createElement('div'); z.className = 'zoom-block'; z.dataset.dropShadow = v; z.innerHTML = '<div class="zoom-clip"></div>';
    document.body.appendChild(z); out[v] = getComputedStyle(z.firstChild).filter; z.remove(); } return out; });
  expect(ref.soft, '전제: 선례 값이 있다').toContain('drop-shadow');
  expect(ref.strong, '전제').toContain('drop-shadow');
  expect(ref.soft, '전제: 선례의 두 단계는 다르다').not.toBe(ref.strong);
  await setDs(page, id, { dropShadow: 'soft' });
  expect(await filterOf(page, id), '부드럽게 = 확대블럭 soft').toBe(ref.soft);
  await setDs(page, id, { dropShadow: 'strong' });
  expect(await filterOf(page, id), '강하게 = 확대블럭 strong').toBe(ref.strong);
  /* 막대로 바꾸면 — 키는 남아도 걸리는 요소가 없다 · 패널에 절이 없다 */
  await openPanel(page, id);
  expect(await page.locator('#grb-drop-group').count(), '전제: 원형이면 절이 있다').toBe(1);
  await page.locator('#grb-type-v').click();
  await expect.poll(() => ds(page, id, 'chartType')).toBe('bar-v');
  expect(await page.locator('#grb-drop-group').count(), '막대: Shadow 절 없음').toBe(0);
  expect(await ds(page, id, 'dropShadow'), '전제: 키는 남아 있다').toBe('strong');
  const any = await page.evaluate((id) => { const b = document.getElementById(id); return [b, ...b.querySelectorAll('*')].filter(e => getComputedStyle(e).filter !== 'none').length; }, id);
  expect(any, '막대 그래프의 어느 요소에도 그림자가 없다').toBe(0);
  await page.locator('#grb-type-pie').click();
  await expect.poll(() => ds(page, id, 'chartType')).toBe('pie');
  expect(await filterOf(page, id), '원형으로 돌아오면 그림자도 돌아온다').toBe(ref.strong);
  expect(errs).toEqual([]);
});

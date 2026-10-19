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
 *     · 고침(이벨류에이터 실측) — J7 참고 그림 꼴(도너츠 · 1위만 키움)에서 라벨이 제 조각 안(겹침 0 · 넘침 0 · 네 귀) · J8 기본 높이 240 에서 긴 이름은 숨고 배지만 · 저장본에 잰 결과 0 · 블럭 폭이 바뀌면 다시 잰다
 *       · J9 라벨 크기 40 + 긴 이름(띄어쓰기 없는 낱말 포함) × 높이 240/420/560 × 원형·도너츠 · 「항상」 라벨은 안 숨고 제 조각 안으로 잘린다 · 범례를 안 덮는다
 *     · 고침 2(게이트 반려 — 숨기기 전에 단계) — J10 기본 240 에서 이름 5/5(도너츠·원형) · 저장본에 줄인 글자 변수 0 · J11 2줄 경로 · J12 줄인 글자 경로(< 라벨 크기 · ≥ 최소 · 넓으면 안 줄인다)
 *       · J13 「항상」 라벨의 줄 수 자르기(line-clamp) · J14 패널 안내 줄 「좁아서 이름 n개 숨김」(n = 숨긴 수 · 0 이면 없음 · 크기가 바뀌면 따라간다)
 *     · 검사 칸 메우기(이벨류에이터 음성대조 — 지키는 칸이 없던 셋) — J16 안내 줄은 «지금 패널의 블럭» 것만(블럭 둘 · 다른 쪽의 grb-pie-fit 에 안 덮인다) · J7 에 라벨 여백(PIE_TAG_PAD) 한 줄 · H5 온 원은 pieGrow 가 있어도 안 키운다(viewBox)
 *     · 고침 3(산출물) — J15 단독 HTML 산출물(스크립트 없음 · 글자 폭을 키운 판)에서도 라벨이 제 조각 안 · 한계 쌍이 기하 안 · 높이 none 이 안 실린다(X1 뒤에 있다 — exportHtml 도우미 옆)
     · 고침 2(C4) — S9 같은 블럭을 ⌘클릭해 풀면 Slice 절이 걷히고 · 쥐어 둔 칸에 써도 블럭·히스토리 무변 · H4 조각이 하나(온 원)면 「크기」·「밀어내기」 칸이 잠기고 안내 줄
     · S8 ⌘클릭 다중 선택에서도 조각 표식이 걷힌다 · K3 쓰레기 dropShadow 에서 「없음」 = 키 삭제 · Shadow 줄에 prop-label
 *   C7 그림자 — K1 Shadow 절 없음/부드럽게/강하게(dataset.dropShadow · 없음 = 키 삭제) · 그림(innerHTML) 무변 · ⌘Z · 저장 · K2 값 = 확대블럭 선례와 같다 · 막대에선 절도 그림자도 없다
 *   내보내기 — X1 단독 HTML 산출물에 조각 표식 0 · X2 피그마 JSON 이 새 키를 «있는 것만» 싣는다(옛 꼴은 무변) · X3 addGraphBlock 옵션
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
  expect(g.ids, '유형 버튼은 여섯(★261020 b8055ada 방사형 이식으로 +1)').toEqual(['grb-type-v', 'grb-type-h', 'grb-type-line', 'grb-type-pair', 'grb-type-pie', 'grb-type-radial']);
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
  /* [폐기 — 261018] 「기본 프리셋의 첫 조각은 선택색과 같은 파랑이라, 선택색 테두리는 안 보였다」— 더 이상 참이 아니다.
     261018 현빈 확정으로 기본 프리셋 첫 조각색을 --p-green-500 으로 바꿨다(css/editor-graph.css --grb-pie-base 비석 참조) —
     ⇒ 테두리를 --sel-color(파랑)로 되돌려도 더는 묻히지 않는다. 테두리 색 ≠ 그 조각의 채움색 · 점선 · ★테두리 색 = --sel-color. */
  const ink = await page.evaluate((id) => { const p = document.getElementById(id).querySelector('.grb-pie-cell-selected'); const c = getComputedStyle(p); return { stroke: c.stroke, fill: c.fill, dashed: c.strokeDasharray !== 'none', w: parseFloat(c.strokeWidth) > 0 }; }, id);
  expect(ink.stroke, '전제: 테두리가 있다').not.toBe('none');
  expect(ink.stroke, '테두리 색이 조각 채움색과 다르다').not.toBe(ink.fill);
  expect({ dashed: ink.dashed, w: ink.w }).toEqual({ dashed: true, w: true });
  /* 261018 신규 단언 — 테두리 색이 «선택색(--sel-color)» 그 자체다(지금은 currentColor 라 안 잠겨 있던 자리).
     음성대조: css/editor-graph.css 의 stroke 를 currentColor 로 되돌리면 이 단언이 빨강이어야 한다(실측함). */
  const selRgb = await page.evaluate(() => {
    const d = document.createElement('div');
    d.style.color = 'var(--sel-color)';
    document.body.appendChild(d);
    const rgb = getComputedStyle(d).color;
    d.remove();
    return rgb;
  });
  expect(ink.stroke, '테두리 색이 선택색(--sel-color)이다').toBe(selRgb);
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

test('S8 ⌘클릭 다중 선택 — 조각을 고른 뒤 다른 블럭을 ⌘클릭하면 조각 표식이 걷힌다(두 블럭은 선택된 채)', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  const id2 = await page.evaluate(() => { window.selectSection(document.getElementById('sG')); window.addGraphBlock({ chartType: 'bar-v' }); window.deselectAll(); return [...document.querySelectorAll('#sG .graph-block')].pop().id; });
  expect(id2, '전제: 둘째 블럭').not.toBe(id);
  await pickSlice(page, id, 1);
  expect((await markOf(page, id)).marks, '전제: 조각 1 을 골랐다').toEqual([1]);
  await waitStableRect(page, `#${id2}`);
  await page.locator(`#${id2}`).click({ modifiers: ['Meta'] });
  await expect.poll(() => page.evaluate(([a, b]) => [a, b].map(x => document.getElementById(x).classList.contains('selected')), [id, id2]), { message: '전제: ⌘클릭 = 두 블럭 다 선택(다중 선택)' }).toEqual([true, true]);
  expect((await markOf(page, id)).marks, '다중 선택에서는 조각 표식이 없다').toEqual([]);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .grb-pie-cell-selected').length)).toBe(0);
  expect(errs).toEqual([]);
});

/* 1013t1C4 고침 2 — «같은 블럭»을 ⌘클릭해 풀면 선택이 0 이 되고 패널은 다시 안 그려진다(블럭 종류와 무관한 기존 동작) ⇒ Slice 절이 남아 풀린 블럭에 썼다.
   두 겹을 따로 잰다: ① 표식이 걷힐 때 Slice 절·조각 버튼 켜짐이 같이 걷힌다 ② 걷히기 전에 쥐어 둔 칸에 써도(가드) 블럭·히스토리가 안 변한다. */
test('S9 같은 블럭을 ⌘클릭해 풀면 — 조각 표식 0 · Slice 절이 걷힌다 · 쥐어 둔 Slice 칸에 써도 풀린 블럭의 items·그림·히스토리가 안 변한다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3 });
  await pickSlice(page, id, 1);
  expect(await sliceSection(page), '전제: Slice 절이 있다(조각 1)').toEqual({ title: 'Slice', name: '2번 · 나', idx: '1', activeBtns: ['1'] });
  expect(await page.evaluate(() => { window.__s9 = { gs: document.getElementById('grb-pie-grow-slider'), gn: document.getElementById('grb-pie-grow-number'), pn: document.getElementById('grb-pie-pull-number'), tag: document.getElementById('grb-pie-tag-select') };
    return Object.values(window.__s9).every(e => e && e.isConnected && !e.disabled); }), '전제: Slice 절의 칸 넷을 쥐었다(살아 있고 · 열려 있다)').toBe(true);
  await waitStableRect(page, `#${id}`);
  await page.locator(`#${id}`).click({ modifiers: ['Meta'] });
  await expect.poll(() => markOf(page, id), { message: '전제: 같은 블럭 ⌘클릭 = 선택 해제 · 표식 0' }).toEqual({ sel: false, marks: [], api: -1 });
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .graph-block.selected').length), '전제: 선택된 그래프 블럭이 0 이다(다중 선택 패널로 안 넘어간다)').toBe(0);
  await raf2(page);
  expect(await sliceSection(page), '① 표식이 걷히면 Slice 절도 걷힌다').toBeNull();
  expect(await page.locator('#grb-data-list .grb-data-icon-btn[data-slice-index].active').count(), '① 데이터 줄의 조각 버튼도 꺼진다').toBe(0);
  /* ② 쓰기 가드 — 걷힌 칸(쥐어 둔 요소)에 사용자 입력과 같은 이벤트를 준다. 블럭·히스토리 무변 */
  const snap = () => page.evaluate((id) => ({ items: document.getElementById(id).dataset.items, vb: document.getElementById(id).querySelector('.grb-pie-svg').getAttribute('viewBox'), tip: window.getHistoryTip(), canvas: window.getSerializedCanvas() }), id);
  const before = await snap();
  expect(before.vb, '전제: 안 키운 viewBox').toBe('0 0 1000 1000');
  expect(typeof before.tip, '전제: 히스토리 끝을 읽었다').toBe('object');
  await page.evaluate(() => { const k = window.__s9, ev = (el, t) => el.dispatchEvent(new Event(t, { bubbles: true }));
    k.gs.value = '20'; ev(k.gs, 'input'); ev(k.gs, 'change'); k.gn.value = '20'; ev(k.gn, 'change'); k.pn.value = '20'; ev(k.pn, 'change'); k.tag.value = 'on'; ev(k.tag, 'change'); });
  await raf2(page);
  const after = await snap();
  expect(JSON.parse(after.items), '② 풀린 블럭의 items 무변(pieGrow · piePull · pieTag 0)').toEqual(JSON.parse(before.items));
  expect(JSON.parse(after.items).some(it => 'pieGrow' in it || 'piePull' in it || 'pieTag' in it)).toBe(false);
  expect(after.vb, '② 그림 무변').toBe(before.vb);
  expect(after.tip, '② 히스토리 +0').toEqual(before.tip);
  expect(after.canvas, '② 저장본 무변').toBe(before.canvas);
  expect(await markOf(page, id), '블럭은 풀린 채').toEqual({ sel: false, marks: [], api: -1 });
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

/* 1013t1C4 고침 2 — 그려지는 조각이 하나(온 원)면 「크기」·「밀어내기」는 그림에 안 먹는다(렌더가 온 원은 안 키우고 안 민다) ⇒ 두 줄의 칸을 잠그고 안내 한 줄. 「라벨」은 먹으므로 열어 둔다. */
const soloOf = (page) => page.evaluate(() => { const g = (id) => document.getElementById(id), h = g('grb-pie-slice-hint');
  return { sec: !!g('grb-pie-slice-section'), dis: ['grb-pie-grow-slider', 'grb-pie-grow-number', 'grb-pie-pull-slider', 'grb-pie-pull-number'].map(id => g(id)?.disabled ?? null), tag: g('grb-pie-tag-select')?.disabled ?? null,
    hints: document.querySelectorAll('#grb-pie-slice-hint').length, hint: h ? { text: h.textContent, cls: h.className, inline: h.getAttribute('style'), afterPull: h.previousElementSibling === g('grb-pie-pull-slider').closest('.prop-row'), inSec: h.closest('.prop-section') === g('grb-pie-slice-section') } : null }; });
test('H4 조각이 하나(온 원)면 Slice 절 「크기」·「밀어내기」 칸이 잠기고 안내 줄이 선다 · 조각이 여럿이면 열려 있다 · 값을 쳐서 하나가 되면 따라 잠기고 되돌리면 풀린다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: [{ label: '하나', value: 5 }] });
  expect((await dOf(page, id)).length, '전제: 조각 하나').toBe(1);
  await pickSlice(page, id, 0);
  const one = await soloOf(page);
  expect(one.sec, '전제: Slice 절이 있다').toBe(true);
  expect(one.dis, '온 원: 크기·밀어내기 칸 넷이 잠긴다').toEqual([true, true, true, true]);
  expect(one.tag, '온 원: 「라벨」은 열려 있다(먹는다)').toBe(false);
  expect([one.hints, one.hint], '안내 줄 하나 — 밀어내기 줄 바로 아래 · Slice 절 안 · 기존 prop-hint 꼴(인라인 스타일 0)')
    .toEqual([1, { text: '조각이 하나라 적용되지 않음', cls: 'prop-hint', inline: null, afterPull: true, inSec: true }]);
  /* 여럿 — 패널을 다시 열면 열려 있고 안내 줄이 없다 */
  await setDs(page, id, { items: V3 });
  expect((await markOf(page, id)).marks, '전제: 다시 그려도 조각 0 이 골라져 있다').toEqual([0]);
  await openPanel(page, id);
  const many = await soloOf(page);
  expect([many.sec, many.dis, many.tag, many.hints], '조각 셋: 칸이 열려 있고 안내 줄이 없다').toEqual([true, [false, false, false, false], false, 0]);
  /* 패널을 다시 안 그리는 길(데이터 줄에 값을 친다) — 다른 조각을 0 으로 내리면 따라 잠기고, 되돌리면 풀린다 */
  const rows = page.locator('#grb-data-list .grb-data-val-input');
  expect(await rows.count(), '전제: 값 칸 셋').toBe(3);
  await rows.nth(1).fill('0'); await rows.nth(2).fill('0');
  await expect.poll(async () => (await itemsOf(page, id)).map(i => Number(i.value)), { message: '전제: 값이 모델에 들어갔다(가 1 · 나 0 · 다 0)' }).toEqual([1, 0, 0]);
  const typed = await soloOf(page);
  expect([typed.dis, typed.hints, typed.hint && typed.hint.text], '값을 쳐서 조각이 하나가 되면 따라 잠긴다').toEqual([[true, true, true, true], 1, '조각이 하나라 적용되지 않음']);
  await rows.nth(1).fill('3');
  await expect.poll(async () => (await itemsOf(page, id)).map(i => Number(i.value))).toEqual([1, 3, 0]);
  const back = await soloOf(page);
  expect([back.dis, back.hints], '다시 여럿이 되면 풀리고 안내 줄이 걷힌다').toEqual([[false, false, false, false], 0]);
  expect(errs).toEqual([]);
});

/* 1013t1C4 검사 칸 메우기 — 「온 원은 안 키운다」의 «그려진» 쪽(유닛 U14 만 지키던 줄). 칸은 잠겨 있어도 dataset 에는 pieGrow 가 남을 수 있다(조각이 여럿일 때 키운 뒤 항목을 지운 판 · 옛 저장본). */
test('H5 조각이 하나(온 원)면 pieGrow 30 이 dataset 에 있어도 안 키운다 — viewBox 는 0 0 1000 1000 · 1.1R 은 원 밖 · 항목을 늘리면 넓어지고 · 다시 하나가 되면 돌아온다 · 도너츠도 같다', async ({ page }) => {
  const SOLO = [{ label: '하나', value: 5, pieGrow: 30 }];
  const { errs, id } = await setup(page, { type: 'pie', items: SOLO });
  expect((await dOf(page, id)).length, '전제: 조각 하나').toBe(1);
  expect((await itemsOf(page, id))[0].pieGrow, '전제: dataset 의 항목에 pieGrow 30 이 실려 있다').toBe(30);
  const wide = await page.evaluate(() => { const g = window.GRAPH_LIMITS.PIE_GROW_MAX; return { g, m: Math.ceil(500 * Math.min(g, 30) / 100) }; });
  expect(wide.g, '전제: 30 은 조각 크기 한계 안(렌더가 0 으로 자르는 값이 아니다)').toBeGreaterThanOrEqual(30);
  const grown = `${-wide.m} ${-wide.m} ${1000 + 2 * wide.m} ${1000 + 2 * wide.m}`;
  expect(await vbOf(page, id), '온 원: pieGrow 가 있어도 viewBox 는 그대로').toBe('0 0 1000 1000');
  expect(await hit(page, id, 45, 0.9), '전제: 0.9R 은 조각 안').toEqual([true]);
  expect(await hit(page, id, 45, 1.1), '온 원: 1.1R 은 원 밖(바깥 반지름이 안 커졌다)').toEqual([false]);
  /* 항목을 늘리면(같은 pieGrow) 그 조각이 커지고 viewBox 가 넓어진다 — 위의 「그대로」가 «pieGrow 를 못 읽어서»가 아니다 */
  await setDs(page, id, { items: [...SOLO, { label: '둘', value: 5 }] });
  expect((await dOf(page, id)).filter(Boolean).length, '전제: 조각 둘').toBe(2);
  expect(await vbOf(page, id), '조각이 둘이면 같은 pieGrow 30 으로 viewBox 가 대칭으로 넓어진다').toBe(grown);
  expect(await hit(page, id, 90, 1.1), '조각 둘: 키운 조각의 1.1R 이 채움 안').toEqual([true, false]);
  /* 다시 하나(다른 조각의 값이 0 — 그려지는 조각은 하나) → 돌아온다 */
  await setDs(page, id, { items: [...SOLO, { label: '둘', value: 0 }] });
  expect((await dOf(page, id)).filter(Boolean).length, '전제: 그려진 조각 하나(값 0 항목은 d 가 비었다)').toBe(1);
  expect(await vbOf(page, id), '값 0 으로 하나가 되면 viewBox 가 돌아온다').toBe('0 0 1000 1000');
  /* 도너츠 온 원도 같다 */
  await setDs(page, id, { items: SOLO, pieDonut: '1' });
  expect(await vbOf(page, id), '도너츠 온 원: viewBox 그대로').toBe('0 0 1000 1000');
  expect(await hit(page, id, 45, 1.1), '도너츠 온 원: 1.1R 은 밖').toEqual([false]);
  expect(await htmlOf(page, id)).not.toMatch(/NaN|Infinity|undefined/);
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

/* ── C3 고침 — 라벨을 «재서» 제 조각 안에 넣는다(둘째 단 · drag-utils.js grbPieFitTags) ──
   재는 것(보이는 라벨마다): 사각형이 svg 가 그려지는 정사각(viewBox 네 변) 밖으로 나간 양 · 네 귀(반 px 안쪽)가 제 조각의 채움 안인가(SVG 좌표 isPointInFill · 민 조각은 옮긴 양을 뺀다)
   · 라벨 사각형끼리 겹치는 쌍 · 글자가 잘렸는가(scroll > client) · 이름이 보이는가 · 범례와 겹치는가. 화면 px 를 리터럴과 견주지 않는다(반 px 는 부동소수 여유). */
const tagFit = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id), svg = b.querySelector('.grb-pie-svg'), m = svg.getScreenCTM(), inv = m.inverse(), vb = svg.viewBox.baseVal, E = 0.5;
  const p0 = new DOMPoint(vb.x, vb.y).matrixTransform(m), p1 = new DOMPoint(vb.x + vb.width, vb.y + vb.height).matrixTransform(m);
  const slices = [...b.querySelectorAll('.grb-pie-slice')], lg = b.querySelector('.grb-pie-legend').getBoundingClientRect();
  const hitRect = (a, c) => Math.min(a.right, c.right) - Math.max(a.left, c.left) > E && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > E;
  const tags = [...b.querySelectorAll('.grb-pie-tag')].map((t, i) => {
    const stage1 = t.style.display !== 'none', vis = getComputedStyle(t).display !== 'none';
    if (!vis) return { i, stage1, vis };
    const r = t.getBoundingClientRect(), name = t.querySelector('.grb-pie-name'), rank = t.querySelector('.grb-pie-rank');
    const tf = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(slices[i].getAttribute('transform') || '');
    const corner = (x, y) => { const q = new DOMPoint(x, y).matrixTransform(inv); return slices[i].isPointInFill(new DOMPoint(q.x - (tf ? +tf[1] : 0), q.y - (tf ? +tf[2] : 0))); };
    const nameOn = !!name && getComputedStyle(name).display !== 'none';
    return { i, stage1, vis, r: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, area: r.width * r.height,
      out: Math.max(0, p0.x - r.left, r.right - p1.x, p0.y - r.top, r.bottom - p1.y),
      cornersIn: [[r.left + E, r.top + E], [r.right - E, r.top + E], [r.left + E, r.bottom - E], [r.right - E, r.bottom - E]].filter(c => corner(c[0], c[1])).length,
      clipped: t.scrollWidth > t.clientWidth || t.scrollHeight > t.clientHeight || (nameOn && name.scrollHeight > name.clientHeight),
      nameOn, rankOn: !!rank && !!rank.textContent, lines: nameOn ? Math.round(name.getBoundingClientRect().height / parseFloat(getComputedStyle(name).lineHeight)) : 0,
      legend: hitRect(r, lg), fitVars: [...t.style].filter(k => /^--grb-pie-(tag|name)-/.test(k)).length + (name ? [...name.style].filter(k => /^--grb-pie-name-/.test(k)).length : 0) };
  });
  const vis = tags.filter(t => t.vis);
  let overlaps = 0; vis.forEach((a, x) => vis.forEach((c, y) => { if (y > x && hitRect(a.r, c.r)) overlaps++; }));
  return { n: tags.length, layer: b.querySelector('.grb-pie-tags').offsetWidth, stage1: tags.filter(t => t.stage1).map(t => t.i), vis: vis.map(t => t.i), overlaps,
    out: vis.filter(t => t.out > E).map(t => t.i), badCorners: vis.filter(t => t.cornersIn !== 4).map(t => [t.i, t.cornersIn]), clipped: vis.filter(t => t.clipped).map(t => t.i),
    names: vis.filter(t => t.nameOn).map(t => t.i), rankOnly: vis.filter(t => !t.nameOn && t.rankOn).map(t => t.i), lines: vis.map(t => t.lines), legend: vis.filter(t => t.legend).map(t => t.i),
    areas: vis.map(t => t.area > 0), fitVars: tags.map(t => t.fitVars || 0).reduce((a, c) => a + c, 0) };
}, id);
/* 불변식 — 겹침 0 · 정사각 밖 0 · 네 귀가 제 조각 위 · 범례를 안 덮는다. onIdx = 「항상」 라벨(잘려도 된다 — 그 밖의 라벨은 글자가 온전해야 한다) */
const expectFit = (f, what, onIdx = []) => {
  expect(f.overlaps, `${what}: 라벨 사각형끼리 겹치는 쌍 0`).toBe(0);
  expect(f.out, `${what}: svg 정사각 밖으로 나간 라벨 0`).toEqual([]);
  expect(f.badCorners, `${what}: 라벨 사각형의 네 귀가 전부 제 조각의 채움 안`).toEqual([]);
  expect(f.legend, `${what}: 범례를 덮는 라벨 0`).toEqual([]);
  expect(f.clipped.filter(i => !onIdx.includes(i)), `${what}: 자동 라벨은 글자가 안 잘린다(안 들면 이름 → 라벨 순으로 숨는다)`).toEqual([]);
};
/* 1013t1C3 검사 칸 메우기 — 라벨 여백(GRAPH_LIMITS.PIE_TAG_PAD · viewBox 단위): 보이는 라벨 사각형의 네 귀를 viewBox 좌표로 옮긴 뒤 «여백의 절반씩» 바깥으로(가로·세로) 밀어도 제 조각의 채움 안.
   귀가 움직이는 길이 = 여백 × 0.71 < 여백 ⇒ 라벨이 가장자리에서 여백만큼 떨어져 있으면 든다(화면 px 리터럴 없음 — 배율은 CTM 이 옮긴다). 여백이 0 이면 이 줄이 expectFit 의 네 귀와 같아지므로 「0 이 아니다」를 전제로 건다. */
const tagPad = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id), svg = b.querySelector('.grb-pie-svg'), inv = svg.getScreenCTM().inverse(), pad = window.GRAPH_LIMITS.PIE_TAG_PAD, d = pad / 2;
  const slices = [...b.querySelectorAll('.grb-pie-slice')], bad = []; let seen = 0;
  [...b.querySelectorAll('.grb-pie-tag')].forEach((t, i) => {
    if (getComputedStyle(t).display === 'none') return;
    seen++;
    const r = t.getBoundingClientRect(), tf = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(slices[i].getAttribute('transform') || '');
    [[r.left, r.top, -1, -1], [r.right, r.top, 1, -1], [r.left, r.bottom, -1, 1], [r.right, r.bottom, 1, 1]].forEach(([x, y, sx, sy], k) => {
      const q = new DOMPoint(x, y).matrixTransform(inv);
      if (!slices[i].isPointInFill(new DOMPoint(q.x + sx * d - (tf ? +tf[1] : 0), q.y + sy * d - (tf ? +tf[2] : 0)))) bad.push([i, k]);
    });
  });
  return { pad, seen, bad };
}, id);
const expectPad = (p, what, nVis) => {
  expect(p.pad, `전제(${what}): 라벨 여백 한도가 0 이 아니다`).toBeGreaterThan(0);
  expect(p.seen, `전제(${what}): 보이는 라벨을 실제로 쟀다`).toBe(nVis);
  expect(p.seen, `전제(${what}): 보이는 라벨이 하나 이상`).toBeGreaterThan(0);
  expect(p.bad, `${what}: 라벨 사각형의 네 귀를 여백의 절반씩 밖으로 밀어도 제 조각 안(가장자리에서 여백만큼 떨어져 있다) — [라벨, 귀]`).toEqual([]);
};
const REF = [{ label: '탈취 기능', value: 60, color: '#f04e1f', pieGrow: 30 }, { label: '처리 불가 음식물', value: 10, color: '#a9a9a9' }, { label: '저소음/음소거 기능', value: 22, color: '#2b2b2b' },
  { label: '기타 A', value: 3, color: '#ededed' }, { label: '기타 B', value: 3, color: '#f6f6f6' }, { label: '기타 C', value: 2, color: '#bcbcbc' }];
test('J7 참고 그림 꼴(도너츠 · 구멍 38 · 간격 4 · 시작 295 · 1위만 크기 30 · 순위+이름) — 높이 560/420/240 에서 라벨이 제 조각 안 · 겹침 0 · 긴 이름은 제 조각 안에서 줄을 바꾼다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: REF, extra: { pieDonut: '1', pieHole: '38', pieGap: '4', pieStart: '295', chartHeight: '560', pieRank: '1', pieName: '1' } });
  expect(await vbOf(page, id), '전제: 1위를 키워 viewBox 가 넓어졌다').not.toBe('0 0 1000 1000');
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  const f = await tagFit(page, id);
  expect(f.n, '전제: 라벨 6').toBe(6);
  expect(f.stage1, '전제: 기하(첫 단)는 넓은 셋을 보이게 둔다').toEqual([0, 1, 2]);
  expect(f.vis, '높이 560: 1·2·3위 라벨이 다 보인다').toEqual([0, 1, 2]);
  expect(f.areas.every(Boolean), '전제: 보이는 라벨에 넓이가 있다').toBe(true);
  expectFit(f, '높이 560');
  expectPad(await tagPad(page, id), '높이 560', f.vis.length);
  expect(f.names, '높이 560: 1위·2위는 이름까지').toEqual(expect.arrayContaining([0, 2]));
  expect(f.lines[f.vis.indexOf(2)], '긴 이름(저소음/음소거 기능)은 제 조각 안에서 줄을 바꾼다(둘째 줄 이상)').toBeGreaterThan(1);
  const seen = { 560: f };
  for (const h of ['420', '240']) {
    await setDs(page, id, { chartHeight: h });
    await waitStableRect(page, `#${id} .grb-pie-svg`);
    const g = await tagFit(page, id);
    expect(g.stage1, `전제(높이 ${h}): 첫 단은 그대로 셋`).toEqual([0, 1, 2]);
    expect(g.layer, `전제(높이 ${h}): 덧층이 작아졌다`).toBeLessThan(seen[560].layer);
    expectFit(g, `높이 ${h}`);
    expectPad(await tagPad(page, id), `높이 ${h}`, g.vis.length);
    seen[h] = g;
  }
  expect(seen[240].names.length + seen[240].vis.length, '작아지면 이름·라벨이 줄어든다(둘째 단이 px 를 본다)').toBeLessThan(seen[560].names.length + seen[560].vis.length);
  expect(seen[240].vis, '높이 240 에서도 1위 라벨은 남는다').toContain(0);
  expect(errs).toEqual([]);
});

const LONG5 = [['처리 불가 음식물', 30], ['저소음/음소거 기능', 25], ['탈취 기능', 20], ['세척 편의성', 15], ['디자인', 10]].map(([label, value]) => ({ label, value }));
const FIT_VARS = ['--grb-pie-tag-w', '--grb-pie-tag-h', '--grb-pie-tag-d', '--grb-pie-name-d', '--grb-pie-name-lines', '--grb-pie-tag-fs'];
test('J8 기본 높이 240 · 라벨 20 · 도너츠 · 긴 이름 5 — 재서 제 조각 안에 넣는다 · 겹침 0 · 저장본에 잰 결과가 안 실린다 · 다시 꽂으면 다시 잰다 · 블럭 폭이 바뀌면 다시 잰다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: LONG5, extra: { pieDonut: '1', pieRank: '1', pieName: '1' } });
  expect([null, '240'], '전제: 높이는 기본(키 없음 또는 240)').toContain(await ds(page, id, 'chartHeight'));
  expect(await ds(page, id, 'labelSize'), '전제: 라벨 크기는 기본(키 없음)').toBeNull();
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  const f = await tagFit(page, id);
  expect(f.n, '전제: 라벨 5').toBe(5);
  expect(f.stage1.length, '전제: 첫 단(기하)은 라벨을 여럿 보이게 둔다').toBeGreaterThanOrEqual(4);
  expect(f.vis.length, '전제: 보이는 라벨이 있다').toBeGreaterThanOrEqual(1);
  expectFit(f, '기본 240');
  expect(f.names.length, '고침 2: 글자를 줄이고 줄을 바꿔 이름이 든다(몇 개인가는 J10 · 배지만 남는 꼴은 아래 좁힌 판과 J14)').toBeGreaterThanOrEqual(1);
  expect(f.fitVars, '전제: 잰 결과가 인라인 변수로 섰다').toBeGreaterThan(0);
  /* 저장본 — 잰 결과(파생 변수)는 안 실리고 기하 사각형(마크업)은 실린다 · 화면은 그대로 */
  const r = await page.evaluate(([id, vars]) => { const saved = window.getSerializedCanvas(); const live = document.getElementById(id).innerHTML;
    return { saved: vars.filter(v => saved.includes(v)), live: vars.some(v => live.includes(v)), box: saved.includes('--grb-pie-box-w') && saved.includes('--grb-pie-box-h'), listed: vars.every(v => window.__gdTextTone.DERIVED_AUTO_VARS.includes(v)) }; }, [id, FIT_VARS]);
  expect(r, '저장본에 잰 변수 0 · 화면에는 있다 · 기하 사각형은 실린다 · 파생 목록에 다 올랐다').toEqual({ saved: [], live: true, box: true, listed: true });
  expect(await tagFit(page, id), '직렬화가 화면을 안 바꾼다').toEqual(f);
  /* 저장본을 다시 꽂으면(열기) 다시 잰다 — 넘친 채로 굳지 않는다 */
  await page.evaluate((id) => { const g = document.getElementById(id); const row = g.parentElement; const tmp = document.createElement('div'); tmp.innerHTML = window.getSerializedCanvas();
    const fresh = tmp.querySelector('#' + id); const html = fresh.parentElement.outerHTML; row.insertAdjacentHTML('afterend', html); row.remove(); window.rebindAll?.(); }, id);
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.grb-pie-tag').length, id), '전제: 다시 꽂은 블럭에 라벨 5').toBe(5);
  await expect.poll(async () => { const g = await tagFit(page, id); return [g.vis, g.names, g.rankOnly]; }, { message: '다시 꽂은 뒤 같은 결과로 돌아온다' }).toEqual([f.vis, f.names, f.rankOnly]);
  expectFit(await tagFit(page, id), '다시 꽂은 뒤');
  /* 다시 그리지 않고 블럭 폭만 줄인다(스타일 속성을 안 건드린다 — 문서 머리의 규칙 하나) ⇒ 크기 관찰자가 다시 잰다 */
  await page.evaluate((id) => { const st = document.createElement('style'); st.id = 'j8-narrow'; st.textContent = `#${id}{width:50% !important;max-width:calc(${document.getElementById(id).querySelector('.grb-pie-tags').offsetWidth}px / 2) !important}`; document.head.appendChild(st); }, id);
  await expect.poll(async () => (await tagFit(page, id)).layer, { message: '전제: 덧층이 줄었다' }).toBeLessThan(f.layer);
  await expect.poll(async () => { const g = await tagFit(page, id); return g.overlaps + g.out.length + g.badCorners.length + g.clipped.length; }, { message: '폭이 줄면 다시 재서 제 조각 안으로' }).toBe(0);
  const n = await tagFit(page, id);
  expect(n.names.length + n.vis.length, '줄어든 차트에서는 이름·라벨이 더 숨는다').toBeLessThan(f.names.length + f.vis.length);
  expect(n.names.length, '줄어든 차트: 이름이 숨은 조각이 있다(배지만 남거나 라벨째 숨는다)').toBeLessThan(f.names.length);
  await page.evaluate(() => document.getElementById('j8-narrow').remove());
  await expect.poll(async () => { const g = await tagFit(page, id); return [g.layer, g.vis, g.names]; }, { message: '폭을 되돌리면 처음 결과로' }).toEqual([f.layer, f.vis, f.names]);
  expect(errs).toEqual([]);
});

const WORD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ가나다라마바사아자차카타파하';   // 띄어쓰기 없는 긴 낱말 — keep-all 만으로는 블럭 폭을 가로질렀다
const LONG6 = [['처리 불가 음식물 처리 불가 음식물', 34], [WORD, 26], ['저소음/음소거 기능 저소음/음소거 기능', 18], ['세척 편의성과 분리 세척', 12], ['디자인', 6], ['기타', 4]].map(([label, value]) => ({ label, value }));
test('J9 라벨 크기 40 + 긴 이름(띄어쓰기 없는 낱말 포함) — 높이 240/420/560 × 원형·도너츠에서 겹침 0 · 차트 밖 0 · 범례를 안 덮는다 · 「항상」 라벨은 안 숨고 제 조각 안으로 잘린다', async ({ page }) => {
  const items = LONG6.map((it, i) => i === 2 ? { ...it, pieTag: 'on' } : it);
  const { errs, id } = await setup(page, { type: 'pie', items, extra: { labelSize: '40', pieRank: '1', pieName: '1' } });
  expect(await page.evaluate((id) => getComputedStyle(document.getElementById(id).querySelector('.grb-pie-tags')).fontSize, id), '전제: 덧층 글자 크기 = 라벨 크기 40').toBe('40px');
  const shown = {};
  for (const donut of [null, '1']) for (const h of ['240', '420', '560']) {
    await setDs(page, id, { pieDonut: donut, chartHeight: h });
    await waitStableRect(page, `#${id} .grb-pie-svg`);
    const f = await tagFit(page, id), what = `${donut ? '도너츠' : '원형'} · 높이 ${h}`;
    expect(f.n, `전제(${what}): 라벨 6`).toBe(6);
    expect(f.stage1, `전제(${what}): 첫 단은 넓은 조각들을 보이게 둔다(「항상」 포함)`).toEqual(expect.arrayContaining([0, 1, 2]));
    expect(f.vis, `${what}: 「항상」 라벨(조각 2)은 안 숨는다`).toContain(2);
    expectFit(f, what, [2]);
    shown[what] = f.names.length + f.vis.length;
  }
  expect(shown['원형 · 높이 560'], '큰 차트일수록 더 많이 보인다(px 를 본다)').toBeGreaterThanOrEqual(shown['원형 · 높이 240']);
  /* 「항상」 라벨의 이름은 줄 수로 잘린다(조각 밖으로 흘러넘치지 않는다) — 가장 작은 판에서 */
  await setDs(page, id, { pieDonut: '1', chartHeight: '240' });
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  const cut = await page.evaluate((id) => { const t = document.getElementById(id).querySelectorAll('.grb-pie-tag')[2]; const cs = getComputedStyle(t);
    return { display: cs.display !== 'none', overflow: cs.overflow, maxH: cs.maxHeight !== 'none', maxW: cs.maxWidth !== 'none' }; }, id);
  expect(cut, '「항상」: 보이고 · 넘는 것은 자른다 · 폭·높이 한계가 섰다').toEqual({ display: true, overflow: 'hidden', maxH: true, maxW: true });
  expect(errs).toEqual([]);
});

/* ── C3 고침 2(게이트 반려) — «숨기기 전에» 단계를 밟는다: 줄바꿈(이름 2줄까지) → 글자 줄이기(pieTagFontSizes · LABEL_SIZE_MIN 위) → 이름 숨김 → 라벨 숨김. 「항상」은 가장 작은 글자에서 줄 수로 자른다.
   재는 것(라벨마다): 계산된 글자 크기(px) · 이름 줄 수(높이 ÷ 줄 높이) · line-clamp · 실제로 잘렸는가. 견주는 수는 전부 앱의 한도(GRAPH_LIMITS · pieTagFontSizes)에서 읽는다(px 리터럴 없음). */
const tagType = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id), L = window.GRAPH_LIMITS, base = parseInt(b.dataset.labelSize) || L.LABEL_SIZE_DEFAULT;
  const items = JSON.parse(b.dataset.items);
  const tags = [...b.querySelectorAll('.grb-pie-tag')].map((t, i) => {
    const vis = getComputedStyle(t).display !== 'none', name = t.querySelector('.grb-pie-name'), nameOn = vis && !!name && getComputedStyle(name).display !== 'none';
    const lh = nameOn ? parseFloat(getComputedStyle(name).lineHeight) : 0;
    return { i, vis, nameOn, fs: vis ? parseFloat(getComputedStyle(t).fontSize) : null, lines: nameOn ? Math.round(name.offsetHeight / lh) : 0, tall: nameOn ? name.offsetHeight / lh : 0,
      clamp: nameOn ? getComputedStyle(name).webkitLineClamp : null, cut: nameOn && name.scrollHeight > name.clientHeight, nl: name ? name.style.getPropertyValue('--grb-pie-name-lines').trim() : '',
      fsVar: t.style.getPropertyValue('--grb-pie-tag-fs').trim(), counted: !!name && !(items[i] && items[i].pieTag === 'off') && Number(items[i] && items[i].value) > 0 };
  });
  return { base, min: L.LABEL_SIZE_MIN, maxLines: L.PIE_TAG_NAME_LINES, sizes: window.GRAPH_PIE_GEOM.pieTagFontSizes(base), layerFs: parseFloat(getComputedStyle(b.querySelector('.grb-pie-tags')).fontSize), tags,
    names: tags.filter(t => t.nameOn).map(t => t.i), hiddenByDom: tags.filter(t => t.counted && !t.nameOn).map(t => t.i), hiddenApi: window.grbPieHiddenNames(b) };
}, id);
const hintOf = (page) => page.evaluate(() => { const h = document.getElementById('grb-pie-name-hint'); const all = document.querySelectorAll('#grb-pie-name-hint').length;
  return h ? { n: all, text: h.textContent, cls: h.className, afterName: h.previousElementSibling === document.getElementById('grb-pie-name-toggle').closest('.prop-row'), inline: h.getAttribute('style') } : { n: all }; });

test('J10 기본 높이 240 · 라벨 20 · 긴 이름 5 — 도너츠·원형 모두 이름이 5/5 보인다(글자를 줄이고 줄을 바꿔서) · 전부 제 조각 안 · 저장본에 줄인 글자 변수 0', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: LONG5, extra: { pieDonut: '1', pieRank: '1', pieName: '1' } });
  expect([null, '240'], '전제: 높이는 기본(키 없음 또는 240)').toContain(await ds(page, id, 'chartHeight'));
  expect(await ds(page, id, 'labelSize'), '전제: 라벨 크기는 기본(키 없음)').toBeNull();
  for (const [what, donut] of [['도너츠', '1'], ['원형', null]]) {
    await setDs(page, id, { pieDonut: donut });
    await waitStableRect(page, `#${id} .grb-pie-svg`);
    const f = await tagFit(page, id), t = await tagType(page, id);
    expect(f.n, `전제(${what}): 라벨 5`).toBe(5);
    expect(f.stage1, `전제(${what}): 첫 단(기하)은 다섯 다 보이게 둔다`).toEqual([0, 1, 2, 3, 4]);
    expect([t.base, t.layerFs], `전제(${what}): 덧층 글자 = 블럭 라벨 크기`).toEqual([t.base, t.base]);
    expect(f.names.length, `${what}: 보이는 이름 5/5 (고치기 전 0/5 — 글자 크기가 하나라 숨겼다)`).toBeGreaterThanOrEqual(5);
    expect(t.names, `${what}: 두 측정이 같은 이름을 본다`).toEqual(f.names);
    expectFit(f, `${what} · 기본 240`);
    expect(t.tags.every(x => t.sizes.includes(x.fs)), `${what}: 고른 글자 크기는 전부 단계 목록(pieTagFontSizes) 안`).toBe(true);
    expect(t.tags.every(x => x.fs <= t.base && x.fs >= t.min), `${what}: 라벨 크기를 안 넘고(안 키운다) 최소 밑으로 안 내려간다`).toBe(true);
    expect(t.tags.every(x => x.lines >= 1 && x.lines <= t.maxLines), `${what}: 이름은 1~${t.maxLines}줄`).toBe(true);
    expect([t.hiddenByDom, t.hiddenApi], `${what}: 숨겨진 이름 0`).toEqual([[], 0]);
  }
  /* 저장본 — 줄인 글자 변수는 화면에만 산다 */
  const r = await page.evaluate((id) => { const saved = window.getSerializedCanvas(); const live = document.getElementById(id).innerHTML; const v = '--grb-pie-tag-fs';
    return { live: live.includes(v), saved: saved.includes(v), listed: window.__gdTextTone.DERIVED_AUTO_VARS.includes(v), fit: window.__gdTextTone.GRAPH_PIE_FIT_VARS.includes(v), savedTags: saved.includes('class="grb-pie-tag"') }; }, id);
  expect(r, '화면에는 줄인 글자 변수가 있고 · 저장본에는 없고 · 파생 목록에 올랐다').toEqual({ live: true, saved: false, listed: true, fit: true, savedTags: true });
  expect(errs).toEqual([]);
});

test('J11 2줄 경로 — 좁은 조각의 긴 이름은 «둘째 줄»로 꺾여 놓인다(높이가 두 줄) · 셋째 줄은 없다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: LONG5, extra: { pieRank: '1', pieName: '1' } });
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  const t = await tagType(page, id);
  expect(t.maxLines, '전제: 이름 줄 수의 위 끝이 둘 이상(한도가 graph-limits 에 있다)').toBeGreaterThanOrEqual(2);
  expect(t.names.length, '전제: 이름이 보이는 라벨이 있다').toBeGreaterThanOrEqual(1);
  const two = t.tags.filter(x => x.nameOn && x.lines === 2);
  expect(two.length, '두 줄로 놓인 이름이 있다').toBeGreaterThanOrEqual(1);
  expect(two.every(x => x.tall > 1.5 && !x.cut && x.clamp === 'none'), '그 이름의 높이는 줄 높이의 1.5 배를 넘고 · 잘리지 않았고 · line-clamp 가 아니다(자동 라벨은 온전한 글자)').toBe(true);
  expect(t.tags.filter(x => x.nameOn && x.lines > t.maxLines).map(x => x.i), '위 끝을 넘는 줄 수 0').toEqual([]);
  expectFit(await tagFit(page, id), '원형 · 기본 240');
  expect(errs).toEqual([]);
});

test('J12 줄인 글자 경로 — 어떤 라벨의 계산된 글자 크기 < 블럭 라벨 크기 · ≥ 최소 · 배지도 같은 비로 준다 · 넓은 차트에서는 안 줄인다 · 라벨 크기가 이미 최소면 더 안 줄인다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: LONG5, extra: { pieDonut: '1', pieRank: '1', pieName: '1' } });
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  let t = await tagType(page, id);
  expect(t.sizes.length, '전제: 줄이는 단계가 있다(목록이 둘 이상)').toBeGreaterThanOrEqual(2);
  expect(t.sizes[0], '전제: 첫 단계 = 블럭 라벨 크기').toBe(t.base);
  const small = t.tags.filter(x => x.nameOn && x.fs < t.base);
  expect(small.length, '이름이 보이는데 글자가 줄어든 라벨이 있다').toBeGreaterThanOrEqual(1);
  expect(small.every(x => x.fs >= t.min && x.fsVar === x.fs + 'px'), '줄인 크기 ≥ 최소 · 인라인 변수가 그 값').toBe(true);
  expect(t.tags.filter(x => x.vis && x.fs === t.base).every(x => x.fsVar === ''), '안 줄인 라벨에는 변수가 없다').toBe(true);
  const badge = await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-pie-tag')].filter(x => getComputedStyle(x).display !== 'none')
    .map(x => { const fs = parseFloat(getComputedStyle(x).fontSize), b = parseFloat(getComputedStyle(x.querySelector('.grb-pie-rank')).fontSize); return { fs, b, ratio: b / fs }; }), id);
  expect(badge.length, '전제: 보이는 라벨마다 배지').toBe(t.tags.filter(x => x.vis).length);
  expect(new Set(badge.map(x => x.fs)).size, '전제: 글자 크기가 다른 라벨이 섞여 있다').toBeGreaterThanOrEqual(2);
  expect(Math.max(...badge.map(x => x.ratio)) - Math.min(...badge.map(x => x.ratio)), '배지 ÷ 라벨 글자의 비는 어느 라벨이나 같다(em — 줄인 라벨은 배지도 같이 준다)').toBeLessThan(0.01);
  expect(badge.every(x => x.ratio > 0 && x.ratio < 1), '배지는 라벨 글자보다 작다').toBe(true);
  /* 넓은 차트 — 줄일 까닭이 없다 */
  await setDs(page, id, { chartHeight: '560' });
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  t = await tagType(page, id);
  expect(t.names.length, '전제(높이 560): 이름 5').toBe(5);
  expect(t.tags.map(x => x.fs), '높이 560: 전부 블럭 라벨 크기 그대로(키우지도 줄이지도 않는다)').toEqual(t.tags.map(() => t.base));
  /* 라벨 크기가 이미 최소 — 단계가 하나뿐 */
  await setDs(page, id, { chartHeight: '240', labelSize: String(t.min) });
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  t = await tagType(page, id);
  expect([t.base, t.sizes], '전제: 라벨 크기 = 최소 → 단계 하나').toEqual([t.min, [t.min]]);
  expect(t.tags.filter(x => x.vis).every(x => x.fs === t.min && x.fsVar === ''), '최소 밑으로는 안 줄인다').toBe(true);
  expectFit(await tagFit(page, id), '라벨 크기 최소');
  expect(errs).toEqual([]);
});

const WIDE3 = [['가나다라 마바사아 자차카타 파하가나 다라마바', 20], ['처리 불가 음식물 처리 불가 음식물 처리 불가', 20], ['x', 60]].map(([label, value]) => ({ label, value }));
test('J13 「항상」 라벨의 줄 수 자르기 — 가장 작은 글자로도 안 드는 이름은 숨지 않고 2줄에서 말줄임으로 잘린다 · 자동이면 같은 이름이 숨는다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: WIDE3, extra: { pieRank: '1', pieName: '1' } });
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  let t = await tagType(page, id);
  expect(t.tags.length, '전제: 라벨 3').toBe(3);
  expect(t.tags.slice(0, 2).map(x => x.nameOn), '전제(자동): 긴 이름 둘은 어느 단계로도 안 들어 이름이 숨는다').toEqual([false, false]);
  expect([t.hiddenByDom, t.hiddenApi], '전제(자동): 숨겨진 이름 2').toEqual([[0, 1], 2]);
  await setDs(page, id, { items: WIDE3.map((it, i) => i < 2 ? { ...it, pieTag: 'on' } : it) });
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  t = await tagType(page, id);
  const on = t.tags.slice(0, 2);
  expect(on.map(x => [x.vis, x.nameOn]), '「항상」: 라벨도 이름도 보인다').toEqual([[true, true], [true, true]]);
  expect(on.map(x => x.fs), '「항상」: 가장 작은 단계의 글자').toEqual([t.sizes[t.sizes.length - 1], t.sizes[t.sizes.length - 1]]);
  expect(on.map(x => [x.nl, x.clamp]), '줄 수 한계가 인라인 변수로 서고 계산된 line-clamp 가 그 값').toEqual(on.map(() => [String(t.maxLines), String(t.maxLines)]));
  expect(on.map(x => [x.lines, x.cut]), '보이는 것은 정확히 그 줄 수 · 글자가 실제로 잘렸다(scroll > client)').toEqual(on.map(() => [t.maxLines, true]));
  expect(t.tags[2].clamp, '넉넉한 라벨에는 줄 수 한계가 없다').toBe('none');
  expect([t.hiddenByDom, t.hiddenApi], '잘린 「항상」 라벨은 «숨김»으로 안 센다').toEqual([[], 0]);
  expectFit(await tagFit(page, id), '「항상」 둘', [0, 1]);
  expect(errs).toEqual([]);
});

test('J14 패널 안내 줄 「좁아서 이름 n개 숨김」 — n = 실제로 숨긴 수 · 「숨김」 조각과 값 0 조각은 안 센다 · 0 이면 줄이 없다 · 블럭이 커지면 줄고 좁아지면 는다(패널을 연 채)', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: LONG5, extra: { pieDonut: '1', pieRank: '1', pieName: '1', labelSize: '28' } });
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  let t = await tagType(page, id);
  const n0 = t.hiddenByDom.length;
  expect(n0, '전제: 라벨 28 · 높이 240 에서는 숨겨진 이름이 있다').toBeGreaterThanOrEqual(1);
  expect(n0, '전제: 다 숨은 것은 아니다').toBeLessThan(5);
  expect(t.hiddenApi, '재는 쪽이 센 수 = 화면에서 센 수').toBe(n0);
  await openPanel(page, id);
  await expect(page.locator('#grb-pie-name-toggle'), '전제: 이름 표시 켜짐').toBeChecked();
  expect(await hintOf(page), '안내 줄 하나 · 이름 표시 줄 바로 아래 · prop-hint 그대로(인라인 꾸밈 없음)').toEqual({ n: 1, text: `좁아서 이름 ${n0}개 숨김`, cls: 'prop-hint', afterName: true, inline: null });
  /* 사용자가 「숨김」으로 둔 조각 · 값 0 조각은 안 센다 */
  const off = t.hiddenByDom[0];
  await setDs(page, id, { items: [...LONG5.map((it, i) => i === off ? { ...it, pieTag: 'off' } : it), { label: '값 없는 항목', value: 0 }] });
  await expect.poll(async () => (await tagType(page, id)).tags.length, { message: '전제: 라벨 6(값 0 항목 포함)' }).toBe(6);
  t = await tagType(page, id);
  expect(t.tags[5].nameOn, '전제: 값 0 조각의 이름은 안 보인다').toBe(false);
  expect(t.tags[off].vis, '전제: 「숨김」 조각의 라벨은 안 보인다').toBe(false);
  const n1 = t.hiddenByDom.length;
  expect(n1, '「숨김」 하나를 빼면 하나 준다(값 0 은 처음부터 안 센다)').toBe(n0 - 1);
  await expect.poll(async () => (await hintOf(page)).text ?? null, { message: '안내 줄이 다시 잰 수를 따라간다' }).toBe(n1 > 0 ? `좁아서 이름 ${n1}개 숨김` : null);
  /* 블럭을 키운다(패널은 그대로 열려 있다) → 숨긴 이름 0 → 줄이 사라진다 */
  await setDs(page, id, { items: LONG5, labelSize: null, chartHeight: '560' });
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  await expect.poll(async () => (await tagType(page, id)).hiddenByDom.length, { message: '전제: 높이 560 · 라벨 20 에서는 숨긴 이름 0' }).toBe(0);
  await expect.poll(async () => (await hintOf(page)).n, { message: '0 이면 줄 자체가 없다' }).toBe(0);
  /* 다시 그리지 않고 블럭 폭만 줄인다(크기 관찰자) → 숨긴 이름이 생기고 줄이 그 수로 선다 → 되돌리면 사라진다 */
  const w0 = await page.evaluate((id) => document.getElementById(id).querySelector('.grb-pie-tags').offsetWidth, id);
  await page.evaluate(([id, w0]) => { const st = document.createElement('style'); st.id = 'j14-narrow'; st.textContent = `#${id}{width:25% !important;max-width:calc(${w0}px / 4) !important}`; document.head.appendChild(st); }, [id, w0]);
  await expect.poll(async () => page.evaluate((id) => document.getElementById(id).querySelector('.grb-pie-tags').offsetWidth, id), { message: '전제: 덧층이 줄었다' }).toBeLessThan(w0);
  await expect.poll(async () => { const x = await tagType(page, id); return x.hiddenByDom.length > 0 && x.hiddenApi === x.hiddenByDom.length; }, { message: '전제: 좁아지면 숨긴 이름이 생긴다 · 두 셈이 같다' }).toBe(true);
  await expect.poll(async () => { const x = await tagType(page, id), h = await hintOf(page); return [h.n, h.text ?? null, x.hiddenByDom.length > 0]; }, { message: '안내 줄이 관찰자가 다시 잰 수로 선다' })
    .toEqual([1, `좁아서 이름 ${(await tagType(page, id)).hiddenByDom.length}개 숨김`, true]);
  await page.evaluate(() => document.getElementById('j14-narrow').remove());
  await expect.poll(async () => [(await tagType(page, id)).hiddenByDom.length, (await hintOf(page)).n], { message: '폭을 되돌리면 줄이 사라진다' }).toEqual([0, 0]);
  /* 이름 표시를 끄면 줄도 없다 */
  await setDs(page, id, { labelSize: '28', chartHeight: '240' });
  await expect.poll(async () => (await hintOf(page)).n, { message: '전제: 다시 좁은 판 — 줄이 선다' }).toBe(1);
  await clickToggle(page, 'grb-pie-name-toggle');
  await expect.poll(() => ds(page, id, 'pieName')).toBeNull();
  await expect.poll(async () => (await hintOf(page)).n, { message: '이름 표시를 끄면 안내 줄이 없다' }).toBe(0);
  expect(errs).toEqual([]);
});

/* 1013t1C3 검사 칸 메우기 — 안내 줄은 «지금 패널의 블럭» 것만 쓴다. J14 는 블럭 하나로만 재서, 듣는 자가 «아무 블럭의» grb-pie-fit 에나 줄을 고쳐도 초록이었다.
   블럭 둘(A: 숨긴 이름 있음 · B: 0)을 세우고, 한쪽 패널을 연 채 «다른 쪽»이 다시 재게 한다(값을 고쳐 다시 그린다 → grb-pie-fit). 이벤트가 실제로 올랐는지는 문서에 건 셈으로 본다
   (셈은 제품의 듣는 자 «뒤에» 걸린다 ⇒ 셈이 오른 때에는 제품 쪽이 이미 돌았다). */
test('J16 안내 줄은 다른 블럭의 숫자로 덮이지 않는다 — A(숨김 n) 패널을 연 채 B(숨김 0)가 다시 재도 「n개 숨김」 그대로 · B 패널을 연 채 A 가 다시 재도 줄이 안 생긴다', async ({ page }) => {
  const EXTRA = { pieDonut: '1', pieRank: '1', pieName: '1' };
  const { errs, id: A } = await setup(page, { type: 'pie', items: LONG5, extra: { ...EXTRA, labelSize: '28' } });
  const B = await page.evaluate(([items, extra]) => {
    window.selectSection(document.getElementById('sG')); window.addGraphBlock({ chartType: 'pie' });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    g.dataset.items = JSON.stringify(items);
    for (const [k, v] of Object.entries(extra)) g.dataset[k] = v;
    window.renderGraph(g); window.deselectAll?.();
    window.__j16 = {};
    document.addEventListener('grb-pie-fit', (e) => { window.__j16[e.target.id] = (window.__j16[e.target.id] || 0) + 1; });
    return g.id;
  }, [LONG5, { ...EXTRA, chartHeight: '560' }]);
  expect(B && B !== A, '전제: 둘째 그래프 블럭이 따로 섰다').toBe(true);
  expect(await page.evaluate(() => document.querySelectorAll('#sG .graph-block').length), '전제: 그래프 블럭 둘').toBe(2);
  await waitStableRect(page, `#${A} .grb-pie-svg`); await waitStableRect(page, `#${B} .grb-pie-svg`);
  const fired = (id) => page.evaluate((id) => window.__j16[id] || 0, id);
  const hidden = (id) => page.evaluate((id) => window.grbPieHiddenNames(document.getElementById(id)), id);
  await expect.poll(async () => (await tagType(page, B)).hiddenByDom.length, { message: '전제: B(높이 560 · 라벨 20)는 숨긴 이름 0' }).toBe(0);
  const tA = await tagType(page, A), tB = await tagType(page, B);
  const nA = tA.hiddenByDom.length;
  expect(nA, '전제: A(높이 240 · 라벨 28)는 숨긴 이름이 있다').toBeGreaterThanOrEqual(1);
  expect([tA.hiddenApi, tB.hiddenApi], '전제: 재는 쪽이 센 수 = 화면에서 센 수(A n · B 0) — 두 블럭의 숨김 수가 서로 다르다').toEqual([nA, 0]);
  /* ① A 패널을 연 채 B 가 다시 잰다 */
  await openPanel(page, A);
  await expect(page.locator('#grb-pie-name-toggle'), '전제: 패널(A)의 이름 표시 켜짐').toBeChecked();
  expect(await hintOf(page), '전제: A 패널의 안내 줄 = A 의 수').toMatchObject({ n: 1, text: `좁아서 이름 ${nA}개 숨김` });
  const b0 = await fired(B), a0 = await fired(A);
  await setDs(page, B, { items: LONG5.map((it, i) => i === 0 ? { ...it, value: it.value + 1 } : it) });
  await expect.poll(() => fired(B), { message: '전제: B 가 다시 재서 grb-pie-fit 이 한 번 이상 올랐다' }).toBeGreaterThan(b0);
  expect(await hidden(B), '전제: 다시 잰 B 의 숨김 수는 여전히 0(A 의 수와 다르다)').toBe(0);
  expect(await fired(A), '전제: 그 사이 A 는 다시 안 쟀다(줄을 A 가 고쳐 쓴 것이 아니다)').toBe(a0);
  expect(await hintOf(page), 'A 패널의 안내 줄은 B 의 이벤트에 안 덮인다 — 줄 하나 · A 의 수 그대로').toMatchObject({ n: 1, text: `좁아서 이름 ${nA}개 숨김` });
  /* ② 반대 — B 패널을 연 채 A 가 다시 잰다 */
  await openPanel(page, B);
  await expect(page.locator('#grb-pie-name-toggle'), '전제: 패널(B)의 이름 표시 켜짐').toBeChecked();
  expect((await hintOf(page)).n, '전제: B 패널에는 안내 줄이 없다(숨김 0)').toBe(0);
  const a1 = await fired(A), b1 = await fired(B);
  await setDs(page, A, { items: LONG5.map((it, i) => i === 0 ? { ...it, value: it.value + 1 } : it) });
  await expect.poll(() => fired(A), { message: '전제: A 가 다시 재서 grb-pie-fit 이 한 번 이상 올랐다' }).toBeGreaterThan(a1);
  expect(await hidden(A), '전제: 다시 잰 A 에는 숨긴 이름이 있다(B 의 0 과 다르다)').toBeGreaterThanOrEqual(1);
  expect(await fired(B), '전제: 그 사이 B 는 다시 안 쟀다').toBe(b1);
  expect((await hintOf(page)).n, 'B 패널에는 A 의 이벤트로 줄이 안 생긴다').toBe(0);
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

/* ── 내보내기 · 입구 ── */
/* 진짜 exportHTMLFile 을 돌리고 «내려받는 대신» 산출 글자를 받는다(effects-reflection · frame-keep-empty 와 같은 가로채기 — 파일 창 0) */
test('K3 쓰레기 dropShadow 값(abc)에서 「없음」을 누르면 키가 지워진다 · Shadow 줄에 이웃 줄과 같은 prop-label 이 있다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3, extra: { dropShadow: 'abc' } });
  expect(await ds(page, id, 'dropShadow'), '전제: 쓰레기 값이 실려 있다').toBe('abc');
  expect(await filterOf(page, id), '전제: 모르는 값 = 그림자 없음').toBe('none');
  await openPanel(page, id);
  expect((await dropGroup(page)).active, '전제: 패널은 「없음」을 보인다').toEqual(['none']);
  const row = await page.evaluate(() => { const g = document.getElementById('grb-drop-group'); const r = g.closest('.prop-row'); const nb = document.getElementById('grb-pie-rank-toggle').closest('.prop-row');
    return { label: r.querySelector(':scope > .prop-label')?.textContent.trim() ?? null, first: r.firstElementChild.className, nbFirst: nb.firstElementChild.className }; });
  expect(row.label, 'Shadow 줄에 prop-label').toBe('그림자');
  expect(row.first, '줄의 첫 칸 = 이웃 줄(순위 표시)과 같은 꼴').toBe(row.nbFirst);
  await page.evaluate(() => window.pushHistory());   // 전제: 쓰레기 값이 실린 지금 판을 히스토리에 박는다(아래 ⌘Z 가 돌아올 자리)
  const h0 = await page.evaluate(() => window.getSerializedCanvas().includes('data-drop-shadow'));
  expect(h0, '전제: 저장본에 쓰레기 키가 실린다').toBe(true);
  await page.locator('#grb-drop-group .prop-align-btn[data-val="none"]').click();
  await expect.poll(() => ds(page, id, 'dropShadow'), { message: '「없음」 = 키 삭제(쓰레기 값이어도)' }).toBeNull();
  expect(await page.evaluate((id) => document.getElementById(id).hasAttribute('data-drop-shadow'), id)).toBe(false);
  expect((await dropGroup(page)).active).toEqual(['none']);
  /* 키가 없을 때 「없음」을 또 눌러도 아무 일도 없다(히스토리에 빈 칸을 안 쌓는다) — ⌘Z 한 번이 쓰레기 값으로 돌아간다 */
  await page.locator('#grb-drop-group .prop-align-btn[data-val="none"]').click();
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => document.querySelector('#sG .graph-block')?.dataset.dropShadow ?? null), { message: '⌘Z 한 번 = 지우기 전' }).toBe('abc');
  expect(errs).toEqual([]);
});

const exportHtml = (page) => page.evaluate(async () => { let out = null; const oc = URL.createObjectURL; URL.createObjectURL = (b) => { out = b; return 'blob:x'; };
  const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
  try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ck; } return out ? await out.text() : ''; });
test('X1 단독 HTML 내보내기 — 조각을 고른 채 내보내도 표식(grb-pie-cell-selected)이 안 실린다 · 조각·밀어내기·라벨은 실린다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: V3.map((it, i) => i === 0 ? { ...it, piePull: 20 } : it), extra: { pieRank: '1' } });
  await pickSlice(page, id, 1);
  expect(await page.evaluate((id) => document.getElementById(id).outerHTML.includes('grb-pie-cell-selected'), id), '전제: 화면에는 표식이 있다').toBe(true);
  const html = await exportHtml(page);
  expect(html.length, '전제: 산출물이 있다').toBeGreaterThan(0);
  expect(html.includes('class="grb-pie-slice"'), '전제: 그 그래프의 조각이 산출물에 있다').toBe(true);
  expect(/class="[^"]*grb-pie-cell-selected/.test(html), '산출물의 어느 요소에도 표식 클래스가 없다').toBe(false);
  expect(html.includes('transform="translate(70.71 -70.71)"'), '밀어낸 조각은 그대로 실린다').toBe(true);
  expect(html.includes('class="grb-pie-rank"'), '조각 안 라벨도 실린다').toBe(true);
  expect((await markOf(page, id)).marks, '내보내기는 화면의 선택을 안 건드린다').toEqual([1]);
  expect(errs).toEqual([]);
});

/* ── C3 고침 3(이벨류에이터 실측 2026-10-14) — 단독 HTML 산출물은 «잰 결과»(인라인 --grb-pie-tag-*)를 그대로 싣는데 스크립트가 없어 다시 못 잰다 ⇒ 글꼴이 다르면 줄이 바뀐다.
   지키는 것: 잰 쪽이 쓰는 한계는 «쌍»이고 그 사각형 자체가 조각 안이다(높이 none 을 안 남긴다) ⇒ 산출물에서 글자가 어떻게 놓여도 라벨은 제 조각을 못 넘는다.
   재는 길: ① 편집 화면에서 한계 쌍을 기하(pieTagRoom().fits)에 묻는다(글꼴과 무관) ② 산출물을 스크립트 없이 띄워 — 그대로 한 번 · 글자 폭을 억지로 키워 한 번 — 위 tagFit 자로 잰다. */
const WIDE_TYPE_CSS = '.grb-pie-tag, .grb-pie-tag * { font-family: monospace !important; letter-spacing: 0.2em !important; word-spacing: 0.4em !important; }';
test('J15 단독 HTML 산출물(스크립트 없음) — 글꼴이 달라져도(글자 폭을 억지로 키워도) 라벨이 제 조각 안 · svg 정사각 밖 0 · 겹침 0 · 한계 쌍이 기하 안 · 높이 none 이 안 실린다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie', items: LONG5, extra: { pieDonut: '1', pieRank: '1', pieName: '1', chartHeight: '240', labelSize: '20' } });
  await waitStableRect(page, `#${id} .grb-pie-svg`);
  const f = await tagFit(page, id);
  expect(f.n, '전제: 라벨 5').toBe(5);
  expect(f.vis.length, '전제: 편집 화면에 보이는 라벨이 있다').toBeGreaterThanOrEqual(1);
  expect(f.fitVars, '전제: 잰 결과가 인라인 변수로 섰다').toBeGreaterThan(0);
  expectFit(f, '편집 화면');
  /* ① 한계 쌍 — 보이는 라벨마다 (폭 한계, 높이 한계)가 % 값이고 그 사각형이 조각 안(fits). 기하는 그려진 조각과 같은 것이어야 한다(전제: path 글자가 같다) */
  const caps = await page.evaluate((id) => { const b = document.getElementById(id), L = window.GRAPH_LIMITS, G = window.GRAPH_PIE_GEOM, items = JSON.parse(b.dataset.items);
    const geo = G.piePaths(items.map(it => it.value), L.PIE_HOLE_DEFAULT, L.PIE_GAP, { start: 0, grow: items.map(() => 0), pull: items.map(() => 0) });
    const room = G.pieTagRoom(geo), vb = b.querySelector('.grb-pie-svg').viewBox.baseVal;
    const same = JSON.stringify(geo.paths) === JSON.stringify([...b.querySelectorAll('.grb-pie-slice')].map(p => p.getAttribute('d')));
    const tags = [...b.querySelectorAll('.grb-pie-tag')].map((t, i) => { if (getComputedStyle(t).display === 'none') return null;
      const w = t.style.getPropertyValue('--grb-pie-tag-w').trim() || t.style.getPropertyValue('--grb-pie-box-w').trim(), h = t.style.getPropertyValue('--grb-pie-tag-h').trim() || t.style.getPropertyValue('--grb-pie-box-h').trim();
      return { i, w, h, pct: /^\d+(\.\d+)?%$/.test(w) && /^\d+(\.\d+)?%$/.test(h), fits: room[i].fits(parseFloat(w) / 100 * vb.width, parseFloat(h) / 100 * vb.width) }; }).filter(Boolean);
    return { same, side: vb.width, tags }; }, id);
  expect(caps.same, '전제: 검사가 지은 기하 = 그려진 조각(path 글자가 같다)').toBe(true);
  expect(caps.tags.map(t => t.i), '전제: 보이는 라벨을 다 쟀다').toEqual(f.vis);
  expect(caps.tags.filter(t => !t.pct).map(t => [t.i, t.w, t.h]), '보이는 라벨의 폭·높이 한계는 둘 다 % 값이다(none · 빈 값 0)').toEqual([]);
  expect(caps.tags.filter(t => !t.fits).map(t => [t.i, t.w, t.h]), '한계 사각형 자체가 제 조각 안이다(fits) — 글자가 어떻게 놓여도 못 넘는다').toEqual([]);
  /* ② 산출물 */
  const html = await exportHtml(page);
  expect(html.length, '전제: 산출물이 있다').toBeGreaterThan(0);
  expect(/<script/i.test(html), '전제: 산출물에 스크립트가 없다(다시 잴 자가 없다)').toBe(false);
  expect(/\.grb-pie-tag\s*\{/.test(html), '전제: 산출물에 .grb-pie-tag 규칙이 실렸다').toBe(true);
  expect(html.includes(`id="${id}"`) && html.includes('class="grb-pie-tag"'), '전제: 그 그래프와 라벨이 산출물에 있다').toBe(true);
  expect(html.includes('</head>'), '전제: 덧씌울 자리(head 끝)가 있다').toBe(true);
  expect(/--grb-pie-tag-h:\s*none/.test(html), '산출물에 «높이 한계 none»이 굳어 실리지 않는다').toBe(false);
  const p2 = await page.context().newPage(); await p2.setViewportSize({ width: 1500, height: 1200 });
  for (const [what, extra] of [['산출물 그대로', ''], ['산출물 + 넓은 글자', WIDE_TYPE_CSS]]) {
    await p2.setContent(extra ? html.replace('</head>', `<style>${extra}</style></head>`) : html, { waitUntil: 'load' });
    await p2.evaluate(() => document.fonts.ready.then(() => true));
    await waitStableRect(p2, `#${id} .grb-pie-svg`);
    const type = await p2.evaluate((id) => { const t = [...document.getElementById(id).querySelectorAll('.grb-pie-tag')].find(x => getComputedStyle(x).display !== 'none'); if (!t) return null;
      const cs = getComputedStyle(t); return { pos: cs.position, overflow: cs.overflow, ls: cs.letterSpacing, ff: cs.fontFamily }; }, id);
    expect(type && [type.pos, type.overflow], `전제(${what}): 라벨 규칙이 먹었다(absolute · 넘는 것은 자른다)`).toEqual(['absolute', 'hidden']);
    if (extra) expect([type.ls !== 'normal' && parseFloat(type.ls) > 0, type.ff], `전제(${what}): 글자 폭 키우기가 먹었다`).toEqual([true, 'monospace']);
    const g = await tagFit(p2, id);
    expect(g.n, `전제(${what}): 라벨 5`).toBe(5);
    expect(g.layer, `전제(${what}): 덧층에 폭이 있다`).toBeGreaterThan(0);
    expect(g.vis, `${what}: 편집 화면과 같은 라벨이 보인다`).toEqual(f.vis);
    expect(g.areas.every(Boolean), `전제(${what}): 보이는 라벨에 넓이가 있다`).toBe(true);
    expect(g.overlaps, `${what}: 라벨 사각형끼리 겹치는 쌍 0`).toBe(0);
    expect(g.out, `${what}: svg 정사각 밖으로 나간 라벨 0`).toEqual([]);
    expect(g.badCorners, `${what}: 라벨 사각형의 네 귀가 전부 제 조각의 채움 안`).toEqual([]);
    expect(g.legend, `${what}: 범례를 덮는 라벨 0`).toEqual([]);
  }
  await p2.close();
  expect(errs).toEqual([]);
});

test('X2 피그마 JSON — 원형의 새 키를 «있는 것만» 싣는다 · 새 키 없는 원형·옛 donut 은 예전 꼴 그대로', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'donut', items: V3 });
  expect(await page.evaluate(() => typeof window.buildFigmaExportJSON), '전제: 내보내기 함수가 있다').toBe('function');
  /* 섹션이 잡히는 꼴로 — 저장 왕복 한 번 뒤에 짓는다(graph-gr-overlay 의 피그마 칸과 같은 길). 블럭 id 는 왕복해도 같다 */
  const node = () => page.evaluate((id) => { window.applyProjectData(JSON.parse(window.serializeProject()));
    const find = (o) => { if (!o || typeof o !== 'object') return null; if (o.type === 'graph' && o.id === id) return o;
      for (const v of Array.isArray(o) ? o : Object.values(o)) { const r = find(v); if (r) return r; } return null; }; return find(window.buildFigmaExportJSON()); }, id);
  const NEW = ['pieDonut', 'pieHole', 'pieStart', 'pieGap', 'pieRank', 'pieName', 'dropShadow'];
  const n0 = await node();
  expect(n0, '전제: 그래프 노드를 찾았다').toBeTruthy();
  const OLD = Object.keys(n0).sort();
  expect(['type', 'id', 'chartType', 'items'].every(k => OLD.includes(k)), '전제: 예전 키 묶음이 있다').toBe(true);
  expect([n0.chartType, NEW.filter(k => k in n0)], '옛 donut(새 키 0) — 새 키를 하나도 안 싣는다').toEqual(['donut', []]);
  await setDs(page, id, { pieHole: '40' });
  expect(Object.keys(await node()).sort(), '옛 donut 의 pieHole 은 안 싣는다(옛 JSON 무변)').toEqual(OLD);
  await setDs(page, id, { chartType: 'pie', pieDonut: '1', pieStart: '90', pieGap: '0', pieRank: '1', pieName: '1', dropShadow: 'soft', items: V3.map((it, i) => i === 0 ? { ...it, pieGrow: 20, piePull: 10, pieTag: 'on' } : it) });
  const n1 = await node();
  expect({ chartType: n1.chartType, pieDonut: n1.pieDonut, pieHole: n1.pieHole, pieStart: n1.pieStart, pieGap: n1.pieGap, pieRank: n1.pieRank, pieName: n1.pieName, dropShadow: n1.dropShadow })
    .toEqual({ chartType: 'pie', pieDonut: true, pieHole: 40, pieStart: 90, pieGap: 0, pieRank: true, pieName: true, dropShadow: 'soft' });
  expect(n1.items[0], '조각별 키는 items 에 실려 간다').toEqual({ label: '가', value: 1, pieGrow: 20, piePull: 10, pieTag: 'on' });
  /* 꺼진 것·험한 값은 안 싣는다 · 막대에선 원형 키를 안 싣는다 */
  await setDs(page, id, { pieDonut: null, pieStart: 'abc', pieGap: null, pieRank: '0', pieName: null, dropShadow: 'banana', items: V3 });
  expect(Object.keys(await node()).sort(), '새 키가 다 꺼지면 예전 꼴').toEqual(OLD);
  await setDs(page, id, { chartType: 'bar-v', pieDonut: '1', pieStart: '90', dropShadow: 'soft' });
  expect(Object.keys(await node()).sort(), '막대: 원형 키 없음').toEqual(OLD);
  expect(errs).toEqual([]);
});

test('X3 addGraphBlock 옵션 — pieStart · pieGap · pieRank · pieName · dropShadow 가 dataset 으로 가고 그대로 그려진다 · 험한 값은 안 싣는다', async ({ page }) => {
  const { errs, id } = await setup(page, { type: 'pie' });
  const made = await page.evaluate(() => { window.selectSection(document.getElementById('sG'));
    window.addGraphBlock({ chartType: 'pie', pieDonut: true, pieHole: 45, pieStart: 300, pieGap: 6, pieRank: true, pieName: true, dropShadow: 'soft', items: [{ label: 'a', value: 3, pieGrow: 20 }, { label: 'b', value: 1, piePull: 10 }] });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop(); const d = g.dataset;
    return { id: g.id, ds: [d.chartType, d.pieDonut, d.pieHole, d.pieStart, d.pieGap, d.pieRank, d.pieName, d.dropShadow], tags: g.querySelectorAll('.grb-pie-tag').length, rank: [...g.querySelectorAll('.grb-pie-rank')].map(e => e.textContent),
      tf: [...g.querySelectorAll('.grb-pie-slice')].map(p => p.hasAttribute('transform')), vb: g.querySelector('.grb-pie-svg').getAttribute('viewBox') }; });
  expect(made.id, '전제: 새 블럭').not.toBe(id);
  expect(made.ds).toEqual(['pie', '1', '45', '300', '6', '1', '1', 'soft']);
  expect([made.tags, made.rank, made.tf, made.vb]).toEqual([2, ['1위', '2위'], [false, true], '-100 -100 1200 1200']);
  expect(await filterOf(page, made.id), '그림자도 선다').toContain('drop-shadow');
  const bad = await page.evaluate(() => { window.selectSection(document.getElementById('sG'));
    window.addGraphBlock({ chartType: 'pie', pieStart: 'abc', pieGap: -3, pieRank: 0, pieName: '', dropShadow: 'url(#x)' });
    const d = [...document.querySelectorAll('#sG .graph-block')].pop().dataset; return ['pieStart', 'pieGap', 'pieRank', 'pieName', 'dropShadow'].map(k => d[k] ?? null); });
  expect(bad, '험한 값은 키를 안 남긴다').toEqual([null, null, null, null, null]);
  expect(errs).toEqual([]);
});

/* graph-pie-1013.dom.spec.js — 1013t1-C 원형·도너츠 7건 (태양 1013-pie 2026-10-13)
 * 현빈: 원형 하나 + 「도너츠」 토글(C1) · 시작 각도(C2) · 조각 크기(C4) · 조각 간격(C6) … (C3·C5·C7 은 이 파일 뒤쪽에 이어 붙는다).
 * 옛 칸(P0~P11)은 tests/dom/graph-pie-donut.dom.spec.js 에 그대로 — 여기는 «새 키»와 «옛 저장본이 안 변한다»만 잰다.
 * 기하는 «화면 좌표»가 아니라 SVG 사용자 좌표의 isPointInFill 로 잰다(0~1000 viewBox · 중심 500 · 12시 = 0° · 시계 방향) — 배율·패널 폭과 무관.
 * 기다림은 전부 조건(waitForFunction · expect.poll · 로케이터 자동 대기) — 고정 대기 0.
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

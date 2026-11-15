/* graph-mcp-item-value2-img-1116.dom.spec.js — MCP items 다시 쓰기가 value2(bar-pair 둘째 시리즈)·img(방사형 마커 샘플 키)를 떨구던 것 (261116 별건)
 *   뿌리(읽기): js/block-factory.js updateGraphBlock 이 새 항목을 { label, value } + carryItemExtras 로 짓는다 — 둘 다 그 덧필드에 없다(패널 syncItems 는 보존 · prop-graph.js:828·836).
 *   고침: 짝지은 옛 항목(pairPrevItems · 같은 라벨 먼저)의 value2·img 를 옮긴다(color 와 같은 자리).
 * 칸
 *   V1 bar-pair — 같은 목록을 값만 바꿔 다시 넣어도 value2 가 모델과 둘째 막대(.grb-bar-fill-b 높이 %)에 남는다 · 순서를 바꾸면 따라간다
 *   I1 radial(마커 asset) — 같은 목록을 다시 넣어도 img 가 모델과 마커(.grb-radial-node 가 비지 않음)에 남는다
 *   N1 음성 — 짝 없는 새 항목은 value2·img 가 없다
 * 양성대조(장면 한 줄씩):
 *   CTL-V2 = `if (_pv.value2 !== undefined) _o.value2 = _pv.value2;` 삭제 → V1 빨강(A·B 의 value2 가 null · 둘째 막대 4px) · I1·N1 초록
 *   CTL-IMG = `if (typeof _pv.img === 'string' && _pv.img) _o.img = _pv.img;` 삭제 → I1 빨강(img null · 노드 is-empty) · V1·N1 초록
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page, { chartType, items, extra = {} }) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(({ chartType, items, extra }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.selectSection(document.getElementById('sG')); window.addGraphBlock({ chartType });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    if (!g) return null;
    g.dataset.chartType = chartType; g.dataset.items = JSON.stringify(items);
    for (const [k, v] of Object.entries(extra)) g.dataset[k] = v;
    window.renderGraph(g); window.deselectAll?.();
    return g.id;
  }, { chartType, items, extra });
  expect(id, '[전제] 그래프 블럭').toBeTruthy();
  return { errs, id };
}
const update = (page, id, items) => page.evaluate(([id, items]) => window.updateGraphBlock(id, { items }), [id, items]);
const model = (page, id, k) => page.evaluate(([id, k]) => JSON.parse(document.getElementById(id).dataset.items).map(i => [i.label, i[k] ?? null]), [id, k]);

test('V1 bar-pair — value2 가 남고 순서를 따라간다', async ({ page }) => {
  const { errs, id } = await setup(page, { chartType: 'bar-pair', items: [{ label: 'A', value: 50, value2: 80 }, { label: 'B', value: 40, value2: 20 }, { label: 'C', value: 30 }] });
  const fillB = () => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-bar-fill-b')].map(f => f.style.height), id);
  const h0 = await fillB();
  expect(h0.length, '[전제] 둘째 막대 셋').toBe(3);
  expect(h0[0], '[전제] A 둘째 막대는 % 높이').toMatch(/%$/);
  expect((await update(page, id, [{ label: 'A', value: 10 }, { label: 'B', value: 20 }, { label: 'C', value: 30 }])).ok).toBe(true);
  expect(await model(page, id, 'value2'), '★같은 목록을 다시 넣었는데 둘째 시리즈가 빠졌다').toEqual([['A', 80], ['B', 20], ['C', null]]);
  await expect.poll(() => fillB().then(h => h.slice(0, 2).map(x => /%$/.test(x))), '둘째 막대 그림에도').toEqual([true, true]);
  expect((await update(page, id, [{ label: 'B', value: 20 }, { label: 'A', value: 10 }])).ok).toBe(true);
  expect(await model(page, id, 'value2'), '순서를 바꾸면 value2 가 항목을 따라간다').toEqual([['B', 20], ['A', 80]]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('I1 radial — 마커 그림(img)이 남는다', async ({ page }) => {
  const { errs, id } = await setup(page, { chartType: 'radial', items: [{ label: 'A', value: 1 }, { label: 'B', value: 1 }, { label: 'C', value: 1 }], extra: { radialMarker: 'asset' } });
  const key = await page.evaluate((id) => { const K = window.RADIAL_SAMPLES.KEYS[0]; const g = document.getElementById(id); const it = JSON.parse(g.dataset.items); it[1].img = K; g.dataset.items = JSON.stringify(it); window.renderGraph(g); return K; }, id);
  const nodes = () => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-radial-node')].map(n => !n.classList.contains('is-empty')), id);
  expect(await nodes(), '[전제] B 마커에만 그림').toEqual([false, true, false]);
  expect((await update(page, id, [{ label: 'A', value: 2 }, { label: 'B', value: 3 }, { label: 'C', value: 4 }])).ok).toBe(true);
  expect(await model(page, id, 'img'), '★같은 목록을 다시 넣었는데 마커 그림이 빠졌다').toEqual([['A', null], ['B', key], ['C', null]]);
  await expect.poll(() => nodes(), '마커 그림에도').toEqual([false, true, false]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N1 음성 — 짝 없는 새 항목은 value2·img 가 없다', async ({ page }) => {
  const { errs, id } = await setup(page, { chartType: 'bar-pair', items: [{ label: 'A', value: 50, value2: 80, img: 'leaf' }] });
  expect((await update(page, id, [{ label: 'A', value: 1 }, { label: 'Z', value: 2 }])).ok).toBe(true);
  expect(await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.items)[1], id)).toEqual({ label: 'Z', value: 2 });
  expect(errs, errs.join('\n')).toEqual([]);
});

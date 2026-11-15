/* graph-mcp-item-color-1116.dom.spec.js — GRAPH-MCP-UPDATE-DROPS-ITEM-COLOR-01 (워커2 261116 곁 관찰)
 *   증상: MCP update_graph_block(→ 렌더러 updateGraphBlock)으로 items 를 다시 쓰면 항목 개별 색(items[i].color · 단색·그라데이션)이 빠진다.
 *   뿌리(읽기): updateGraphBlock 이 새 항목을 { label, value } + carryItemExtras 로 짓는데 color 는 그 덧필드에 없다(패널 syncItems·AI 채움은 옮긴다).
 *   고침: js/block-factory.js — 짝지은 옛 항목(pairPrevItems)의 color 를 옮긴다.
 * 칸
 *   C1 같은 항목 목록(값만 바꿈)을 다시 넣어도 단색·그라데이션 색이 모델과 막대 그림(.grb-bar-fill)에 남는다
 *   C2 순서를 바꾸면 색이 항목을 따라간다(번호 자리 ✗ · 앞 커밋 pairPrevItems 와 같은 짝)
 *   N1 음성 — 새 라벨이 더해진 항목(짝 없음)은 색이 없다(프리셋)
 * 양성대조: CTL-C.patch(새 색 옮기기 줄 삭제) → C1·C2 빨강 · N1 초록
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const GRAD = 'linear-gradient(90deg, #ff0000, #0000ff)';
const ITEMS = [{ label: 'A', value: 30, color: '#ff0000' }, { label: 'B', value: 60, color: GRAD }, { label: 'C', value: 40 }];

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate((items) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.selectSection(document.getElementById('sG')); window.addGraphBlock({ chartType: 'bar-v' });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    if (!g) return null;
    g.dataset.items = JSON.stringify(items); window.renderGraph(g); window.deselectAll?.();
    return g.id;
  }, ITEMS);
  expect(id, '[전제] 그래프 블럭').toBeTruthy();
  return { errs, id };
}
const update = (page, id, items) => page.evaluate(([id, items]) => window.updateGraphBlock(id, { items }), [id, items]);
const colors = (page, id) => page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.items).map(i => [i.label, i.color ?? null]), id);
const fills = (page, id) => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-bar-fill')].map(f => f.style.background || f.style.backgroundImage || f.style.backgroundColor || ''), id);

test('C1·C2 items 를 다시 넣어도 개별 색이 남고 · 순서를 바꾸면 항목을 따라간다', async ({ page }) => {
  const { errs, id } = await setup(page);
  const f0 = await fills(page, id);
  expect(f0.length, '[전제] 막대 셋').toBe(3);
  expect(f0[0], '[전제] 단색이 그림에').toContain('255, 0, 0');
  expect((await update(page, id, [{ label: 'A', value: 10 }, { label: 'B', value: 20 }, { label: 'C', value: 30 }])).ok).toBe(true);
  expect(await colors(page, id), '★C1 같은 목록을 다시 넣었는데 개별 색이 빠졌다').toEqual([['A', '#ff0000'], ['B', GRAD], ['C', null]]);
  await expect.poll(() => fills(page, id).then(f => [f[0].includes('255, 0, 0'), f[1].includes('gradient')]), 'C1 그림에도').toEqual([true, true]);
  expect((await update(page, id, [{ label: 'C', value: 30 }, { label: 'B', value: 20 }, { label: 'A', value: 10 }])).ok).toBe(true);
  expect(await colors(page, id), '★C2 순서를 바꿨는데 색이 번호에 남았다').toEqual([['C', null], ['B', GRAD], ['A', '#ff0000']]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N1 음성 — 짝 없는 새 항목은 색이 없다', async ({ page }) => {
  const { errs, id } = await setup(page);
  expect((await update(page, id, [{ label: 'A', value: 10 }, { label: 'B', value: 20 }, { label: 'C', value: 30 }, { label: 'D', value: 5 }])).ok).toBe(true);
  expect((await colors(page, id))[3]).toEqual(['D', null]);
  expect(errs, errs.join('\n')).toEqual([]);
});

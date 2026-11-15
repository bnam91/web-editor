/* graph-mcp-items-pair-1116.dom.spec.js — GRAPH-MCP-ITEMS-REPLACE-KEEPS-SHAPE-BY-INDEX-01 (미카사 261113 곁)
 *   증상: MCP update_graph_block(→ 렌더러 updateGraphBlock)으로 items 를 통째로 바꾸면 옛 항목의 모양(shape)·조각 키가 «번호 자리»에 남는다
 *         — 항목을 빼거나 순서를 바꾸면 살아남은 옛 B 의 모양이 그 번호에 온 새 항목에 붙는다(UI ✕ 길은 picker G6 에서 이미 고침).
 *   뿌리: js/block-factory.js updateGraphBlock 이 carryItemExtras(…, _prevItems[i], …) — 늘 같은 순번.
 *   고침: js/graph-shape.js pairPrevItems — 같은 라벨 먼저 · 번호는 «이름만 바뀐» 자리(그 옛 라벨이 새 목록에 없을 때)만.
 * 칸
 *   R1 가운데 항목(B · 모양 drop)을 빼면 → 그 번호에 온 C 에 모양이 안 붙는다
 *   R2 순서를 바꾸면(B,A,C) → 모양이 B 를 따라간다
 *   N1 음성 — 전부 이름만 바꾸면(U,V,W) 같은 순번으로 옮긴다(1012t1G4 · graph-shape-segments G4-5 계약 그대로)
 * 양성대조: CTL-G.patch(block-factory 가 다시 _prevItems[i]) → R1·R2 빨강 · N1 초록
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const ITEMS = [{ label: 'A', value: 30 }, { label: 'B', value: 60, shape: 'drop', pieGrow: 20 }, { label: 'C', value: 40 }];

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate((items) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.selectSection(document.getElementById('sG')); window.addGraphBlock({ chartType: 'bar-v' });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    if (!g) return null;
    g.dataset.items = JSON.stringify(items); g.dataset.barShape = 'person'; window.renderGraph(g); window.deselectAll?.();
    return g.id;
  }, ITEMS);
  expect(id, '[전제] 그래프 블럭').toBeTruthy();
  return { errs, id };
}
const update = (page, id, items) => page.evaluate(([id, items]) => window.updateGraphBlock(id, { items }), [id, items]);
const view = (page, id) => page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.items).map(i => [i.label, i.shape ?? null, i.pieGrow ?? null]), id);

test('R1·R2 항목을 빼거나 순서를 바꿔도 모양·조각 키가 그 항목을 따라간다', async ({ page }) => {
  const { errs, id } = await setup(page);
  expect(await view(page, id), '[전제]').toEqual([['A', null, null], ['B', 'drop', 20], ['C', null, null]]);
  expect((await update(page, id, [{ label: 'B', value: 60 }, { label: 'A', value: 30 }, { label: 'C', value: 40 }])).ok).toBe(true);
  expect(await view(page, id), '★R2 순서를 바꿨는데 모양이 번호(1)에 남았다').toEqual([['B', 'drop', 20], ['A', null, null], ['C', null, null]]);
  expect((await update(page, id, [{ label: 'A', value: 30 }, { label: 'C', value: 40 }])).ok).toBe(true);
  expect(await view(page, id), '★R1 B 를 뺐는데 그 번호에 온 C 에 B 의 모양이 붙었다').toEqual([['A', null, null], ['C', null, null]]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N1 음성 — 전부 이름만 바꾸면 같은 순번으로 옮긴다(계약 그대로)', async ({ page }) => {
  const { errs, id } = await setup(page);
  expect((await update(page, id, [{ label: 'U', value: 1 }, { label: 'V', value: 2 }, { label: 'W', value: 3 }])).ok).toBe(true);
  expect(await view(page, id)).toEqual([['U', null, null], ['V', 'drop', 20], ['W', null, null]]);
  expect(errs, errs.join('\n')).toEqual([]);
});

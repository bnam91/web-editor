/* grid-children-figma.dom.spec.js — G19 C4 「그리드 밑 자식 블럭이 Figma 업로드 JSON 에 «블럭으로 한 번씩» 나간다」 (시험 한 쌍)
 *   측정 M2(37ab1c65): 자식은 블럭으로 안 나가고, 자식 «글자»만 그리드 껍데기(GENERIC) texts 에 (0,0)·24px 로 섞여 나갔다 · 에셋 자식은 흔적 없음.
 *   고침(export-figma-json.js «한 커밋»): ⑴ 그리드 전용 분기 _blockAll/_gridKidBlocks 가 :scope > .grd-children 자식을 블럭으로 잇는다
 *     ⑵ GENERIC 의 tb-·svg 수집에서 .grd-children 안쪽을 뺀다. ⛔둘 중 하나만 하면 글자가 «두 번»(⑴만) 나가거나 «안»(⑵만) 나간다.
 * F1 ★자식 글자는 JSON 전체에서 «정확히 한 번» — 그것도 type:'text' 블럭으로(껍데기 texts 엔 없음).
 * F2 ★에셋 자식이 «빠지지 않는다» — 그 id 의 type:'image' 블럭이 있고, 그리드 뒤에 온다.
 * F0 지키는 시험 — 자식 0개 그리드의 JSON 은 G19 이전과 같은 모양(블럭 하나 · 껍데기 높이 = 그리드 높이).
 * 하네스 = _root-harness bootApp. buildFigmaExportJSON 은 state.pages[].canvas «직렬본»을 읽는다(측정 M2 와 같은 수법).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const COLS = '[{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;칸글자&quot;}]},{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;둘째칸&quot;}]}]';
const SEC = (kids) => `<div class="section-block" id="sF" data-section="1" data-name="F"><div class="section-hitzone"></div><div class="section-inner">
<div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top" data-cols="${COLS}"></div></div>
<div class="gap-block" data-type="gap" id="gEnd" style="height:100px"></div></div></div>`;

async function setup(page, withKids) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(({ h, withKids }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    window.renderGridBlock(document.getElementById('gG'));
    if (withKids) {
      const t = window.addGridChild('gG', 'body');
      const tc = t.block.querySelector('.tb-body'); tc.textContent = 'CHILD-TEXT-XYZ'; delete tc.dataset.isPlaceholder;
      window.addGridChild('gG', 'image');
    }
  }, { h: SEC(), withKids });
  return errs;
}
const exportJson = (page) => page.evaluate(async () => {
  const ps = { bg: '#eeeeee', padX: 0 };
  const { state } = await import('/js/globals.js');
  state.pages = [{ canvas: document.getElementById('canvas').innerHTML, pageSettings: ps }]; state.pageSettings = ps;
  const json = window.buildFigmaExportJSON(null);
  const kidsBox = document.querySelector('#gG > .grd-children');
  return { json, flat: JSON.stringify(json), assetId: kidsBox?.querySelector('.asset-block')?.id || null,
    innerH: document.querySelector('#gG > .grd-inner').offsetHeight, gridH: document.getElementById('gG').offsetHeight };
});

test('F1 ★자식 글자는 JSON 전체에서 정확히 «한 번» — type:text 블럭으로(그리드 껍데기 texts 엔 없다)', async ({ page }) => {
  const errs = await setup(page, true);
  const { json, flat } = await exportJson(page);
  const blocks = json.sections[0].blocks;
  const grid = blocks.find(b => b.type === 'generic' && b.kind === 'grid');
  expect(grid, '전제 — 그리드 껍데기가 나갔다').toBeTruthy();
  expect(flat.split('CHILD-TEXT-XYZ').length - 1, '자식 글자 등장 횟수').toBe(1);
  expect(JSON.stringify(grid.texts || [])).not.toContain('CHILD-TEXT-XYZ');
  const t = blocks.find(b => b.type === 'text' && JSON.stringify(b).includes('CHILD-TEXT-XYZ'));
  expect(t, '자식 글자가 «글자 블럭»으로 나간다').toBeTruthy();
  expect(blocks.indexOf(t)).toBeGreaterThan(blocks.indexOf(grid));
  expect(errs).toEqual([]);
});

test('F2 ★에셋 자식이 빠지지 않는다 — 그 id 의 image 블럭이 그리드 뒤에 · 껍데기 높이 = 격자 높이', async ({ page }) => {
  const errs = await setup(page, true);
  const { json, assetId, innerH, gridH } = await exportJson(page);
  expect(assetId, '전제 — 에셋 자식이 있다').toBeTruthy();
  expect(gridH, '전제 — 그리드가 자식만큼 자랐다').toBeGreaterThan(innerH + 20);
  const blocks = json.sections[0].blocks;
  const grid = blocks.find(b => b.type === 'generic' && b.kind === 'grid');
  const img = blocks.find(b => b.type === 'image' && b.id === assetId);
  expect(img, '에셋 자식이 image 블럭으로 나간다').toBeTruthy();
  expect(blocks.indexOf(img)).toBeGreaterThan(blocks.indexOf(grid));
  expect(grid.height, '껍데기 높이 = 격자(.grd-inner) — 자식 높이를 «또» 싣지 않는다').toBe(innerH);
  expect(errs).toEqual([]);
});

test('F0 지키는 시험 — 자식 0개 그리드: 블럭은 [그리드, gap] · 껍데기 높이 = 그리드 높이 · 칸 글자는 종전대로', async ({ page }) => {
  const errs = await setup(page, false);
  const { json, gridH } = await exportJson(page);
  const blocks = json.sections[0].blocks;
  expect(blocks.map(b => b.type + (b.kind ? ':' + b.kind : ''))).toEqual(['generic:grid', 'gap']);
  expect(blocks[0].height).toBe(gridH);
  expect(errs).toEqual([]);
});

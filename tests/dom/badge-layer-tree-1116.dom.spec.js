/* badge-layer-tree-1116.dom.spec.js — BADGE-SECTION-LAYER-TREE-STALE-01 (미카사 261112 · int-4 실앱 곁)
 *   증상: 레이어에서 섹션 이름을 «**badge_…» 로 바꾸면 이스터에그(badge-transform.js)가 section-inner 를 통째로 배지 줄로 간다.
 *         그런데 레이어 트리는 옛 자식(Gap/Heading/Gap) 행을 그대로 보여 준다.
 *   뿌리: js/panels/layer-panel.js 이름 편집 finish() — transformSectionToBadge 뒤 buildLayerPanel 을 안 불렀다.
 *   고침: 그 바로 뒤 window.buildLayerPanel?.() 한 줄.
 * 칸
 *   B1 «**badge_테스트» Enter → 옛 블럭들의 레이어 행(block._layerItem)이 문서에서 빠졌다 · 배지 줄이 트리에 행으로 있다
 *   B2 배지 줄 행 = 그 섹션의 트리 행 «하나»(data-layer-type badge · 이름 Badge) · 누르면 그 섹션이 골라진다(배지 설정은 섹션 패널)
 *   N1 음성 — 평범한 이름 바꾸기는 옛 행을 그대로 둔다(트리 재구성 없음 = 지금 동작)
 * 0.9.12 포팅(wk2/0912-badge-tree-port · 현빈 결정 #5 B안): 열차 base bdb4171f1 에서 B1 «배지 줄이 트리에 없다» 빨강 — 트리 갈래(walkInnerChild)가
 *   .badge-hologram-row(-block 아님)를 어느 갈래로도 안 받아 다시 그려도 «빈 섹션»이었다 → layer-panel.js 에 배지 줄 행 갈래.
 * 양성대조: _patches/controls/BADGE-CTL.patch(layer-panel.js 를 base 로 = 두 고침 다 되돌림) → B1 빨강(옛 행) · B2 빨강 · N1 초록
 *          _patches/controls/BADGE-ROW-CTL.patch(배지 줄 행 갈래만 되돌림) → B1 빨강(배지 줄이 트리에 없다 · 0) · B2 빨강 · N1 초록
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  const secId = await page.evaluate(async () => {
    document.getElementById('canvas').querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    const sec = document.querySelector('#canvas > .section-block');
    if (!sec.id) sec.id = 'secBadge';
    window.selectSection?.(sec);
    window.addGapBlock?.(); window.addTextBlock('heading', { content: 'HEAD' }); window.addGapBlock?.();
    window.buildLayerPanel?.(); window.clearHistory?.();
    return sec.id;
  });
  return { errs, secId };
}
const blocksState = (page, secId) => page.evaluate((id) => {
  const sec = document.getElementById(id);
  window.__oldBlocks = window.__oldBlocks || [...sec.querySelectorAll('.section-inner > *, .section-inner .text-block, .section-inner .gap-block')];
  const rowsOld = window.__oldBlocks.filter(b => b._layerItem).map(b => b._layerItem.isConnected);
  const lsec = document.querySelector(`.layer-section[data-sec-id="${id}"]`);
  return { oldRows: rowsOld.length, oldRowsConnected: rowsOld.filter(Boolean).length, badge: !!sec.querySelector('.badge-hologram-row'),
    rowCount: lsec ? lsec.querySelectorAll('.layer-children > *').length : -1 };
}, secId);

async function rename(page, secId, name) {
  const nm = page.locator(`.layer-section[data-sec-id="${secId}"] .layer-section-name`).first();
  await nm.scrollIntoViewIfNeeded();
  await nm.dblclick();
  await expect(nm).toHaveAttribute('contenteditable', 'true');
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
}

test('B1 «**badge_» 이름 → 트리가 배지 줄로 다시 그려진다(옛 행 0)', async ({ page }) => {
  const { errs, secId } = await setup(page);
  const s0 = await blocksState(page, secId);
  expect(s0.oldRows, '[전제] 옛 블럭에 레이어 행이 달려 있다').toBeGreaterThan(0);
  expect(s0.oldRowsConnected, '[전제] 옛 행이 트리에 있다').toBe(s0.oldRows);
  await rename(page, secId, '**badge_테스트');
  await expect.poll(() => blocksState(page, secId).then(s => s.badge), '[전제] 배지로 바뀌었다').toBe(true);
  const s1 = await blocksState(page, secId);
  expect(s1.oldRowsConnected, '★배지로 바뀌었는데 트리에 옛 행(Gap/Heading…)이 남았다').toBe(0);
  expect(s1.rowCount, '배지 줄이 트리에 없다').toBeGreaterThan(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('B2 배지 줄 행 = 트리 행 하나(Badge) · 누르면 그 섹션이 골라진다', async ({ page }) => {
  const { errs, secId } = await setup(page);
  await rename(page, secId, '**badge_테스트');
  await expect.poll(() => blocksState(page, secId).then(s => s.badge), '[전제] 배지로 바뀌었다').toBe(true);
  const rows = await page.evaluate((id) => [...document.querySelector(`.layer-section[data-sec-id="${id}"] .layer-children`).children]
    .map(r => ({ type: r.dataset.layerType ?? null, name: r.querySelector('.layer-item-name')?.textContent ?? null })), secId);
  expect(rows, '배지 섹션의 트리 행 = 배지 줄 하나').toEqual([{ type: 'badge', name: 'Badge' }]);
  await page.evaluate(() => window.deselectAll?.());
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), secId), '[전제] 섹션 선택 풀림').toBe(false);
  const row = page.locator(`.layer-section[data-sec-id="${secId}"] .layer-item[data-layer-type="badge"]`);
  await row.scrollIntoViewIfNeeded();
  expect(await row.evaluate(e => e.getClientRects().length > 0), '[전제] 배지 행이 보인다(섹션이 접혀 있지 않다)').toBe(true);
  await row.click();
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), secId), '배지 행을 누르면 그 섹션이 골라진다').toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N1 음성 — 평범한 이름 바꾸기는 트리를 다시 안 그린다(옛 행 그대로)', async ({ page }) => {
  const { errs, secId } = await setup(page);
  const s0 = await blocksState(page, secId);
  await rename(page, secId, '평범한 이름');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.name, secId)).toBe('평범한 이름');
  const s1 = await blocksState(page, secId);
  expect(s1.badge).toBe(false);
  expect(s1.oldRowsConnected, '평범한 이름 바꾸기에서 행이 바뀌었다').toBe(s0.oldRows);
  expect(errs, errs.join('\n')).toEqual([]);
});

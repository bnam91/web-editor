/* u5-subfold-undo — U5(right-panel-unify) 자작 접기 3곳(월계관 칸 카드 · 배너02 줄 카드 · 표 행별 높이)이
 * 공용 블록별 접기(_helpers.js discSecOpen/discSecToggle — 블록 id 키)로 합류했다 ⇒ ⌘Z 가 블록을 «같은 id 의 새 요소»로
 * 갈아끼워도(history.js restoreSnapshot) 사람이 바꾼 접기 상태가 그대로다. 쉐브론 = disclosureChevronHtml 한 벌.
 * 양성대조:
 *   ① prop-laurel.js isExpanded 를 옛 «요소 프로퍼티» 맵(block._laurelCellExpanded)으로 되돌리면 U1 빨강(새 요소엔 맵이 없다 → 칸 1 접힘).
 *   ② prop-banner02.js discSecOpen(block, `bn2-line-${idx}`) 를 WeakMap(요소 키)으로 되돌리면 U2 빨강.
 *   ③ prop-table.js discSecOpen(block, 'tbl-rowh') 를 요소 키 상태로 되돌리면 U3 빨강.
 *   [전제] 칸마다 «⌘Z 뒤 요소가 실제로 갈렸다»(old !== new)를 먼저 단언 — 안 갈리면 이 시험은 아무것도 안 잰다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.deselectAll?.(); window.selectSection(sec); window.clearHistory?.(); });
  return errs;
}
async function add(page, cls, entry) {
  return page.evaluate(async ({ cls, entry }) => {
    const before = new Set(document.querySelectorAll('.' + cls));
    await window[entry]();
    const b = [...document.querySelectorAll('.' + cls)].find((x) => !before.has(x));
    window.selectBlock(b.id);
    return b.id;
  }, { cls, entry });
}
/** 기록 한 칸 → 블록에 무해한 표시 → 기록 → ⌘Z. 요소가 갈렸는지 돌려준다. */
async function undoSwap(page, id) {
  return page.evaluate((id) => {
    const old = document.getElementById(id);
    window.pushHistory?.('u5 전');
    old.dataset.u5Probe = '1';
    window.pushHistory?.('u5 후');
    window.undo();
    const now = document.getElementById(id);
    window.selectBlock(id);
    return { swapped: !!now && now !== old };
  }, id);
}

test('U1 월계관 칸 카드 — 칸 1 을 펼친 채 ⌘Z 뒤에도 펼침(기본은 칸 0 만)', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'laurel-block', 'addLaurelBlock');
  const exp = () => page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-cell-card.expanded')].map((e) => e.dataset.cellIdx));
  expect(await page.locator('#panel-right .prop-cell-card').count(), '[전제] 칸 카드 ≥ 2').toBeGreaterThanOrEqual(2);
  expect(await exp(), '[전제] 기본 = 칸 0 만 펼침').toEqual(['0']);
  await page.locator('#panel-right .prop-cell-card[data-cell-idx="1"] .lrl-cell-toggle').click();
  expect(await exp()).toEqual(['0', '1']);
  expect(await page.locator('#panel-right .prop-cell-card[data-cell-idx="1"] .lrl-cell-toggle svg').getAttribute('style'), '쉐브론 = 공용 한 벌(펼침 0°)').toContain('rotate(0deg)');
  expect((await undoSwap(page, id)).swapped, '[전제] ⌘Z 가 블록 요소를 갈았다').toBe(true);
  expect(await exp(), '★⌘Z 뒤에도 칸 1 펼침 유지').toEqual(['0', '1']);
  expect(errs).toEqual([]);
});

test('U2 배너02 줄 카드 — 접은 줄이 ⌘Z 뒤에도 접힘', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'banner02-block', 'addBanner02Block');
  const head = page.locator('#bn2-line-head-0');
  await expect(head, '[전제] 줄 0 머리(비어 있지 않은 줄)').toBeAttached();
  const before = await head.getAttribute('aria-expanded');
  await head.click();
  const after = await page.locator('#bn2-line-head-0').getAttribute('aria-expanded');
  expect(after, '[전제] 클릭이 접기 상태를 바꿨다').not.toBe(before);
  expect((await undoSwap(page, id)).swapped, '[전제] ⌘Z 가 블록 요소를 갈았다').toBe(true);
  expect(await page.locator('#bn2-line-head-0').getAttribute('aria-expanded'), '★⌘Z 뒤에도 같은 접기 상태').toBe(after);
  expect(errs).toEqual([]);
});

test('U3 표 행별 높이 — 펼친 채 ⌘Z 뒤에도 펼침(기본 접힘)', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'table-block', 'addTableBlock');
  const body = () => page.evaluate(() => getComputedStyle(document.getElementById('tbl-rowh-body')).display);
  expect(await body(), '[전제] 기본 접힘').toBe('none');
  await page.locator('#tbl-rowh-toggle').click();
  expect(await body()).not.toBe('none');
  expect((await undoSwap(page, id)).swapped, '[전제] ⌘Z 가 블록 요소를 갈았다').toBe(true);
  expect(await body(), '★⌘Z 뒤에도 펼침 유지').not.toBe('none');
  expect(errs).toEqual([]);
});

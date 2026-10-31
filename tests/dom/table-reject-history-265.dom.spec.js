/* table-reject-history-265.dom.spec.js — 시트 265 REJECTED-INPUT-LEAVES-HISTORY-ENTRY-UNDO-EATS-A-STEP-01 의 패널 문 (imac-gd-L3 · 261031 · JQ-RULER-A ⑶ 곁)
 * 원문 장면: 표 패널 Header Merge 칸에 0:2(성공) → 범위 밖(거절) → ⌘Z 한 번. frame-fuzz-294 V265·V265N 은 updateTableBlock 문이라 원문의 패널 문을 안 지난다 ⇒ 여기서 그 문을 잰다.
 * H0 [음성] 거절 없음 · H1 거절 있음 — 둘의 이력 꼭대기·⌘Z 뒤 값을 나란히 찍는다. H1 은 «거절이 꼭대기를 안 움직인다» 를 단언한다.
 * ⛔이 자가 안 재는 것: 실앱(Electron) 창 · 다른 패널의 거절 · 원문 ⬜ 의 update*Block 전수 · ⌘Z 를 두 번 눌렀을 때. 재기 전 부름 = bootApp·evaluate·마우스·키보드(스크린샷 0).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); window.selectSection(sec); window.addTableBlock(); window.__t = sec.querySelector('.table-block'); });
  const r = await page.evaluate(() => { const b = window.__t.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await page.mouse.click(r[0], r[1]);
  await expect(page.locator('#tbl-merge-headers')).toBeVisible();
  await page.evaluate(() => window.clearHistory?.());
}
const tip = (page) => page.evaluate(() => { const h = window.getHistoryTip(); return [h.pos, h.len]; });
const val = (page) => page.evaluate(() => { const t = document.getElementById(window.__t.id); return t ? t.dataset.mergedHeaderCols ?? null : 'gone'; });
const put = async (page, v) => { const i = page.locator('#tbl-merge-headers'); await i.click(); await i.press('ControlOrMeta+a'); await page.keyboard.type(v); await page.keyboard.press('Tab'); };
const rafs = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const undoFromCanvas = async (page) => { await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); }); await page.keyboard.press('Meta+z'); await rafs(page); };

test('H0 [음성] 0:2 만 — 꼭대기·⌘Z 값', async ({ page }) => {
  await setup(page); await put(page, '0:2'); await expect.poll(() => val(page)).toBe('[[0,2]]'); await rafs(page);
  const t1 = await tip(page); await rafs(page); const t2 = await tip(page);
  await undoFromCanvas(page);
  console.log(`H0 ${JSON.stringify({ t1, t2, afterZ: { v: await val(page), tip: await tip(page) } })}`);
  expect(t2).toEqual(t1);
});
test('H1 0:2 → 0:99(거절) — 거절이 꼭대기를 안 움직인다 · ⌘Z 값은 H0 과 나란히', async ({ page }) => {
  await setup(page); await put(page, '0:2'); await expect.poll(() => val(page)).toBe('[[0,2]]'); await rafs(page);
  const t1 = await tip(page); await put(page, '0:99'); await rafs(page); const t2 = await tip(page); const v2 = await val(page);
  await undoFromCanvas(page);
  console.log(`H1 ${JSON.stringify({ t1, t2, v2, afterZ: { v: await val(page), tip: await tip(page) } })}`);
  expect(v2, '[전제] 거절됐다').toBe('[[0,2]]');
  expect(t2, '거절이 이력 꼭대기를 움직였다').toEqual(t1);
});

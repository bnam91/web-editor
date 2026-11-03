/* wrap-keeps-fixed-width — ⌘⌥G·⌘G 로 묶을 때 px 폭 프레임이 안 늘어나고 화면 자리가 그대로다(300→716 이던 것).
 * 칸: W1 ⌘⌥G 둘 W2 ⌘G W3 ⌘Z ⌘⇧Z W4 다시 묶어도(rebindAll) N1 [음성] 폭 100% 프레임은 그대로 꽉 참 N2 [음성] 860 프레임(창보다 넓음)도 꽉 참
 * 양성대조: block-factory 의 px 폭 블럭 줄을 걷으면 W1~W4 빨강 · N1·N2 초록. 장면 준비만 evaluate — 고르기(레이어)·키는 진짜. 폭은 레이아웃 px. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
async function scene(page, specs) {
  await page.setViewportSize({ width: 1500, height: 1400 }); const errs = await bootApp(page);
  const ids = await page.evaluate(async (specs) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const out = specs.map((sp) => { window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.frame-block')); window.addFrameBlock(sp.full ? { fullWidth: true } : {}); const e = [...sec.querySelectorAll('.frame-block')].find((x) => !b.has(x)); if (sp.w) window.updateFrameBlock(e.id, { width: sp.w, height: 80 }); return e.id; });
    window.deselectAll(); window.clearHistory?.(); document.getElementById(out[0]).scrollIntoView({ block: 'center' }); return out; }, specs);
  return { errs, ids };
}
const pick = async (page, id, meta) => { const L = await page.evaluate((id) => { const it = document.getElementById(id)._layerItem; it.scrollIntoView({ block: 'center' }); const q = it.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, id); if (meta) await page.keyboard.down('Meta'); await page.mouse.click(L[0], L[1]); if (meta) await page.keyboard.up('Meta'); await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id), '[전제] 골랐다').toBe(true); };
/* 폭 + 캔버스 기준 가로 중심(레이아웃 px) */
const read = (page, ids) => page.evaluate((ids) => { const c = document.getElementById('canvas'), cr = c.getBoundingClientRect(), k = cr.width / c.offsetWidth || 1; return ids.map((i) => { const e = document.getElementById(i), q = e.getBoundingClientRect(); return { w: e.offsetWidth, cx: (q.left + q.width / 2 - cr.left) / k }; }); }, ids);
const inGroup = (page, id) => page.evaluate((id) => !!document.getElementById(id).parentElement.closest('.frame-block'), id);
const same = (a, b) => a.forEach((x, i) => { expect(b[i].w, `칸${i} 폭`).toBe(x.w); expect(Math.abs(b[i].cx - x.cx), `칸${i} 가로 중심`).toBeLessThanOrEqual(1); });
const wrap = async (page, ids, key) => { await pick(page, ids[0]); await pick(page, ids[1], true); await page.keyboard.press(key); await expect.poll(() => inGroup(page, ids[0]), '묶였다').toBe(true); };

for (const [name, key] of [['W1 ⌘⌥G', 'Meta+Alt+g'], ['W2 ⌘G', 'Meta+g']]) test(`${name} — 폭 300 프레임 둘이 안 늘어나고 자리 그대로`, async ({ page }) => {
  const { errs, ids } = await scene(page, [{ w: 300 }, { w: 300 }]); const a = await read(page, ids); expect(a[0].w, '[전제]').toBe(300);
  await wrap(page, ids, key); same(a, await read(page, ids));
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('W3 ⌘Z 로 돌아오고 ⌘⇧Z 로 다시 그 폭', async ({ page }) => {
  const { errs, ids } = await scene(page, [{ w: 300 }, { w: 300 }]); const a = await read(page, ids); await wrap(page, ids, 'Meta+Alt+g'); await page.evaluate(() => window.deselectAll());
  await page.keyboard.press('Meta+z'); await expect.poll(() => inGroup(page, ids[0]), '⌘Z').toBe(false); same(a, await read(page, ids));
  await page.keyboard.press('Meta+Shift+z'); await expect.poll(() => inGroup(page, ids[0]), '⌘⇧Z').toBe(true); same(a, await read(page, ids));
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('W4 다시 묶어도(rebindAll · 재오픈 길) 폭 그대로', async ({ page }) => {
  const { errs, ids } = await scene(page, [{ w: 300 }, { w: 300 }]); const a = await read(page, ids); await wrap(page, ids, 'Meta+Alt+g');
  await page.evaluate(() => window.rebindAll?.()); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); same(a, await read(page, ids));
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('N1 [음성] 폭 100% 프레임은 그대로 꽉 찬다', async ({ page }) => {
  const { errs, ids } = await scene(page, [{ full: true }, { full: true }]); const a = await read(page, ids); await wrap(page, ids, 'Meta+Alt+g'); same(a, await read(page, ids));
  expect(await page.evaluate((id) => document.getElementById(id).style.width, ids[0])).toBe('100%');
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('N2 [음성] 창보다 넓은 860 프레임은 꽉 찬다(전과 같다)', async ({ page }) => {
  const { errs, ids } = await scene(page, [{}, {}]); const a = await read(page, ids); await wrap(page, ids, 'Meta+Alt+g'); same(a, await read(page, ids));
  expect(await page.evaluate((id) => document.getElementById(id).style.width, ids[0])).toBe('100%');
  expect(errs, errs.join(' | ')).toEqual([]);
});

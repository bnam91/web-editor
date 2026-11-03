/* wrap-keeps-turn — ⌘⌥G·⌘G 로 묶기 전후 화면이 같다: 회전·반전이 안 풀리고, 이동값이 두 번 안 밀리고, 뒤 블럭이 안 겹친다.
 * 칸: R1 ⌘⌥G 회전+평범 R2 ⌘G R3 둘 다 회전 ⌘Z ⌘⇧Z R4 회전+이동 ⌘⇧Z R5 이동만 ⌘⇧Z R6 반전 R7 다시 그린 뒤(rebindAll) R8 회전 글자 ⌘⌥G R9 저장 왕복 N1 [음성] 평범 프레임 N2 [음성] 평범 글자는 ⌘⌥G 에서 새 프레임 직속(잠긴 동작)
 * 양성대조: block-factory 의 _keepTurnFoldMove 를 transform='' 로 되돌리면 R1~R7·R9 빨강, 텍스트 프레임 rotation 조건을 걷으면 R8 빨강, N1·N2 초록. 회전 상자는 getBoundingClientRect 로 잰다. 장면 준비만 evaluate — 고르기(레이어)·키·값 칸은 진짜. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
async function scene(page, specs) {
  await page.setViewportSize({ width: 1500, height: 1400 }); const errs = await bootApp(page);
  const ids = await page.evaluate(async (specs) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const out = specs.map(() => { window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.frame-block')); window.addFrameBlock({}); const e = [...sec.querySelectorAll('.frame-block')].find((x) => !b.has(x)); window.updateFrameBlock(e.id, { width: 300, height: 80 }); return e.id; });
    window.deselectAll(); window.clearHistory?.(); if (out[0]) document.getElementById(out[0]).scrollIntoView({ block: 'center' }); return out; }, specs);
  for (let i = 0; i < specs.length; i++) if (Object.keys(specs[i]).length) { await pick(page, ids[i]); await page.evaluate((s) => { const set = (id, v) => { const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }; if (s.r != null) set('ss-rotate-deg', s.r); if (s.tx != null) set('ss-pos-x', s.tx); if (s.ty != null) set('ss-pos-y', s.ty); if (s.flip) document.getElementById('ss-flip-h').click(); }, specs[i]); }
  await page.evaluate(() => window.deselectAll());
  return { errs, ids };
}
const pick = async (page, id, meta) => { const L = await page.evaluate((id) => { const e = document.getElementById(id), it = e._layerItem || e.querySelector('.text-block')?._layerItem; it.scrollIntoView({ block: 'center' }); const q = it.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, id); if (meta) await page.keyboard.down('Meta'); await page.mouse.click(L[0], L[1]); if (meta) await page.keyboard.up('Meta'); await expect.poll(() => page.evaluate((id) => document.querySelector(`#${id}`).classList.contains('selected') || !!document.querySelector(`#${id} .text-block.selected`), id), '[전제] 골랐다').toBe(true); };
/* 캔버스 기준 회전 상자(레이아웃 px) + 행렬 앞 두 칸 */
const read = (page, ids) => page.evaluate((ids) => { const c = document.getElementById('canvas'), cr = c.getBoundingClientRect(), k = cr.width / c.offsetWidth || 1; return ids.map((i) => { const e = document.getElementById(i), q = e.getBoundingClientRect(), t = getComputedStyle(e).transform; return { x: (q.left - cr.left) / k, y: (q.top - cr.top) / k, w: q.width / k, h: q.height / k, m: t === 'none' ? [1, 0] : t.slice(7, -1).split(',').slice(0, 2).map((v) => Math.round(+v * 100) / 100) }; }); }, ids);
const inGroup = (page, id) => page.evaluate((id) => !!document.getElementById(id).parentElement.closest('.frame-block:not([data-text-frame])'), id);
const same = (a, b, at) => a.forEach((x, i) => { for (const k of ['x', 'y', 'w', 'h']) expect(Math.abs(b[i][k] - x[k]), `${at} 칸${i} ${k} ${x[k]}→${b[i][k]}`).toBeLessThanOrEqual(1); expect(b[i].m, `${at} 칸${i} 행렬`).toEqual(x.m); });
const wrap = async (page, ids, key) => { await pick(page, ids[0]); if (ids[1]) await pick(page, ids[1], true); await page.keyboard.press(key); await expect.poll(() => inGroup(page, ids[0]), '묶였다').toBe(true); };
const undoRedo = async (page, ids, a) => { await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z'); await expect.poll(() => inGroup(page, ids[0]), '⌘Z').toBe(false); same(a, await read(page, ids), '⌘Z'); await page.keyboard.press('Meta+Shift+z'); await expect.poll(() => inGroup(page, ids[0]), '⌘⇧Z').toBe(true); same(a, await read(page, ids), '⌘⇧Z'); };

for (const [name, key] of [['R1 ⌘⌥G', 'Meta+Alt+g'], ['R2 ⌘G', 'Meta+g']]) test(`${name} — 회전 프레임이 안 풀리고 뒤 프레임 자리도 그대로`, async ({ page }) => {
  const { errs, ids } = await scene(page, [{ r: 15 }, {}]); const a = await read(page, ids); expect(a[0].m, '[전제] 돌았다').toEqual([0.97, 0.26]);
  await wrap(page, ids, key); same(a, await read(page, ids), '묶음'); expect(errs, errs.join(' | ')).toEqual([]);
});
test('R3 둘 다 회전 — ⌘Z ⌘⇧Z 도 같은 화면', async ({ page }) => {
  const { errs, ids } = await scene(page, [{ r: 15 }, { r: -20 }]); const a = await read(page, ids);
  await wrap(page, ids, 'Meta+Alt+g'); same(a, await read(page, ids), '묶음'); await undoRedo(page, ids, a); expect(errs, errs.join(' | ')).toEqual([]);
});
test('R4 회전+이동 — ⌘⇧Z 에 이동이 두 번 안 밀린다', async ({ page }) => {
  const { errs, ids } = await scene(page, [{ r: 15, tx: 30, ty: 20 }, {}]); const a = await read(page, ids);
  await wrap(page, ids, 'Meta+Alt+g'); same(a, await read(page, ids), '묶음'); await undoRedo(page, ids, a); expect(errs, errs.join(' | ')).toEqual([]);
});
test('R5 이동만 — ⌘⇧Z 에 두 번 안 밀린다', async ({ page }) => {
  const { errs, ids } = await scene(page, [{ tx: 40 }, {}]); const a = await read(page, ids);
  await wrap(page, ids, 'Meta+Alt+g'); same(a, await read(page, ids), '묶음'); await undoRedo(page, ids, a); expect(errs, errs.join(' | ')).toEqual([]);
});
test('R6 반전이 안 풀린다', async ({ page }) => {
  const { errs, ids } = await scene(page, [{ flip: 1 }, {}]); const a = await read(page, ids); expect(a[0].m[0], '[전제] 뒤집혔다').toBe(-1);
  await wrap(page, ids, 'Meta+Alt+g'); same(a, await read(page, ids), '묶음'); await undoRedo(page, ids, a); expect(errs, errs.join(' | ')).toEqual([]);
});
test('R7 다시 그린 뒤(rebindAll)에도 같은 화면', async ({ page }) => {
  const { errs, ids } = await scene(page, [{ r: 15 }, {}]); const a = await read(page, ids); await wrap(page, ids, 'Meta+Alt+g');
  await page.evaluate(() => window.rebindAll?.()); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); same(a, await read(page, ids), '다시 그림'); expect(errs, errs.join(' | ')).toEqual([]);
});
test('R9 묶자마자 저장 왕복 — 회전·이동 그대로, 뒤 프레임도 그대로', async ({ page }) => {
  const { errs, ids } = await scene(page, [{ r: 15, tx: 30, ty: 20 }, { r: -20 }]); const a = await read(page, ids); await wrap(page, ids, 'Meta+Alt+g'); await page.evaluate(() => window.deselectAll());
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); }); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  same(a, await read(page, ids), '저장 왕복'); expect(errs, errs.join(' | ')).toEqual([]);
});
test('R8 회전 글자 ⌘⌥G — 안 풀린다', async ({ page }) => {
  const { errs, ids } = await scene(page, []); const id = await page.evaluate(async () => { const sec = document.querySelector('.section-block'); window.deselectAll(); window.selectSection(sec); window.addTextBlock('body', { content: '글자' }); const h = sec.querySelector('.frame-block[data-text-frame]'); h.dataset.rotation = '20'; h.style.transform = 'rotate(20deg)'; h.style.transformOrigin = 'center center'; window.deselectAll(); window.clearHistory?.(); return h.id; }); const a = await read(page, [id]); expect(a[0].m, '[전제] 돌았다').toEqual([0.94, 0.34]);
  await wrap(page, [id], 'Meta+Alt+g'); same(a, await read(page, [id]), '묶음'); await undoRedo(page, [id], a); expect(errs, errs.join(' | ')).toEqual([]);
});
test('N1 [음성] 평범 프레임은 그대로', async ({ page }) => {
  const { errs, ids } = await scene(page, [{}, {}]); const a = await read(page, ids); expect(a[0].m, '[전제]').toEqual([1, 0]);
  await wrap(page, ids, 'Meta+Alt+g'); same(a, await read(page, ids), '묶음'); expect(await page.evaluate((id) => document.getElementById(id).style.transform, ids[0])).toBe(''); await undoRedo(page, ids, a); expect(errs, errs.join(' | ')).toEqual([]);
});
test('N2 [음성] 안 돈 글자는 ⌘⌥G 에서 새 프레임 직속', async ({ page }) => {
  const { errs } = await scene(page, []); const tid = await page.evaluate(async () => { const sec = document.querySelector('.section-block'); window.deselectAll(); window.selectSection(sec); window.addTextBlock('body', { content: '글자' }); const t = sec.querySelector('.text-block'); window.deselectAll(); window.clearHistory?.(); return t.id; }); const hid = await page.evaluate((id) => document.getElementById(id).closest('.frame-block').id, tid); await pick(page, hid);
  await page.keyboard.press('Meta+Alt+g'); await expect.poll(() => page.evaluate((id) => document.getElementById(id).parentElement.matches('.frame-block:not([data-text-frame])'), tid), '직속').toBe(true); expect(errs, errs.join(' | ')).toEqual([]);
});

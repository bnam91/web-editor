/* free-frame-child-frame-dragout-section — 자유 프레임 R 안의 자식 «프레임» C 를 R 밖 빈 섹션 자리에 놓으면 섹션 흐름으로 빠진다(현빈 261107 · 8te2eiu).
 * 옛: 다른 프레임 위가 아니면 아무 일 없이 R 안으로 죄어 돌아왔다(글자는 빠지는데 프레임만 안 빠짐).
 * 칸: 밖 → 섹션 흐름(좌표 걷힘) · 안 → R 에 남음 · ⌘Z 한 번에 R.
 * 양성대조: block-drag.js 프레임 onUp 의 «섹션 흐름으로 꺼낸다» 갈래를 빼면 첫 칸·⌘Z 칸 빨강, 「안」 칸 초록. 장면만 evaluate — 고르기(더블클릭)·끌기는 진짜 마우스. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const reopen = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (FR) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__sec = sec.id;
    const mk = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return f.id; };
    const R = mk(); const C = mk(R);
    window.updateFrameBlock(R, { width: 420, height: 360 }); window.updateFrameBlock(C, { width: 160, height: 120 });
    const f = document.getElementById(C); f.style.left = '40px'; f.style.top = '40px'; f.dataset.offsetX = 40; f.dataset.offsetY = 40;
    return { R, C }; }, FR);
  await reopen(page); await raf(page);
  await page.evaluate((R) => document.getElementById(R).scrollIntoView({ block: 'center' }), ids.R); await raf(page);
  return { errs, ...ids };
}
const st = (page, C) => page.evaluate(({ C, FR }) => { const e = document.getElementById(C); const r = e.getBoundingClientRect(); return { n: document.querySelectorAll('#' + C).length, par: e.parentElement.closest(FR)?.id || null, inner: e.parentElement.classList.contains('section-inner'), pos: e.style.position, sel: e.classList.contains('selected'), x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, { C, FR });
const box = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, id);
async function pickC(page, s) { await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; window._enteredFrame = null; }); const w = await st(page, s.C); await page.mouse.dblclick(w.x, w.y); await raf(page); return (await st(page, s.C)).sel; }
async function drag(page, x, y, tx, ty) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 12; i++) { await page.mouse.move(x + (tx - x) * i / 12, y + (ty - y) * i / 12); await raf(page); } await page.mouse.up(); await raf(page); }

test('밖 빈 섹션 자리에 놓으면 섹션 흐름으로 빠진다(좌표 걷힘)', async ({ page }) => {
  const s = await scene(page); expect(await pickC(page, s), '[전제] 더블클릭으로 C 고르기').toBe(true);
  const w = await st(page, s.C); const r = await box(page, s.R);
  await drag(page, w.x, w.y, r.r + 120, w.y);
  const a = await st(page, s.C);
  expect(a.n, '사본·유실 없음').toBe(1); expect(a.inner, `섹션 흐름이 아니다(부모 프레임 ${a.par})`).toBe(true); expect(a.pos, '좌표가 남았다').toBe('');
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
test('R 안에서 놓으면 R 에 남는다', async ({ page }) => {
  const s = await scene(page); expect(await pickC(page, s)).toBe(true);
  const w = await st(page, s.C);
  await drag(page, w.x, w.y, w.x + 60, w.y + 40);
  const a = await st(page, s.C);
  expect(a.par).toBe(s.R); expect(a.pos).toBe('absolute');
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
test('⌘Z 한 번에 R 안으로 돌아온다', async ({ page }) => {
  const s = await scene(page); expect(await pickC(page, s)).toBe(true);
  const w = await st(page, s.C); const r = await box(page, s.R);
  await drag(page, w.x, w.y, r.r + 120, w.y);
  expect((await st(page, s.C)).inner, '[전제] 빠짐').toBe(true);
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await st(page, s.C)).par, '한 번에').toBe(s.R);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

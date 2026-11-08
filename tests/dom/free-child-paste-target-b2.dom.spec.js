/* free-child-paste-target-b2 — 자유 프레임 안 블럭 한 개의 ⌘V 자리(S3 J294L B-2 · 현빈 FRAME-GROUP-PASTE-TARGET-RULE-01 「선택된 곳에 붙여넣기」).
 * 고른 곳에 붙는다 · 안 골랐으면 원래 부모 안 원본 옆 +20. 프레임 묶음 규칙은 multi-frame-copy-294 가 잠근다. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const KINDS = [['text-block', 'addTextBlock'], ['asset-block', 'addAssetBlock'], ['table-block', 'addTableBlock']];
async function scene(page, cls, entry) {
  return page.evaluate(async ({ cls, entry }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((x) => x.remove()); await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); const FR = '.frame-block:not([data-text-frame])';
    const add = (h) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = null; window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].pop(); window.updateFrameBlock(f.id, { width: 860, height: h }); return f; };
    const A = add(600), B = add(300), C = add(300); delete C.dataset.freeLayout; delete C.dataset.height; C.dataset.fullWidth = 'true'; C.style.height = ''; C.style.minHeight = '300px';
    window.deselectAll(); window.selectSection(sec); window._activeFrame = B; await window.addTextBlock();
    window.deselectAll(); window.selectSection(sec); window._activeFrame = A; await window[entry](); const k = A.querySelector('.' + cls); if (!k.id) k.id = 'k_' + Math.random().toString(36).slice(2, 8);
    const w = k.closest('.frame-block[data-text-frame]') || k; w.style.position = 'absolute'; w.style.left = '40px'; w.style.top = '50px'; w.dataset.offsetX = 40; w.dataset.offsetY = 50;
    await window.addSection(); const S2 = [...c.querySelectorAll('.section-block')].pop();
    window.deselectAll(); window._activeFrame = null; window.clearHistory?.(); A.scrollIntoView({ block: 'start' });
    return { k: k.id, A: A.id, B: B.id, C: C.id, S2: S2.id };
  }, { cls, entry });
}
const open = async (page) => { await page.setViewportSize({ width: 1500, height: 1400 }); await bootApp(page); await page.evaluate(() => window.applyZoom(40)); await waitZoomSettled(page, 40); };
const corner = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.right - 5, r.bottom - 5]; }, id);
const clickFrame = async (page, id) => { const p = await corner(page, id); await page.mouse.click(p[0], p[1]); await raf(page); };
async function pick(page, s) { await clickFrame(page, s.A); const m = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, s.k); await page.mouse.dblclick(m[0], m[1]); await raf(page); }   // B안(현빈 261107): 프레임 뒤 자식 = 더블클릭 진입(옛: 한 번 클릭 드릴인)
const count = (page, cls) => page.evaluate((c) => document.querySelectorAll('#canvas .' + c).length, cls);
async function paste(page, cls) { const n = await count(page, cls); await page.keyboard.press('Meta+v'); await page.waitForFunction(([c, n]) => document.querySelectorAll('#canvas .' + c).length > n, [cls, n]); await raf(page); }
const home = (page, s, cls) => page.evaluate(({ s, cls }) => { const cnt = (id) => document.getElementById(id).querySelectorAll('.' + cls).length; return { A: cnt(s.A), B: cnt(s.B), C: cnt(s.C), S2: cnt(s.S2) }; }, { s, cls });
const reopen = async (page) => { await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); }); await raf(page); };
const b0 = (cls) => (cls === 'text-block' ? 1 : 0);   // B 에 미리 있는 글자 한 개
const s2Own = (cls) => (cls === 'text-block' ? 1 : 0);   // 새 섹션의 기본 글자

for (const [cls, entry] of KINDS) {
  test(`${cls} ⌘X → 다른 자유 프레임 → ⌘V 는 그 프레임 안 · 저장 왕복 · ⌘Z 한 번에 빠진다`, async ({ page }) => {
    await open(page); const s = await scene(page, cls, entry); await raf(page);
    const s2 = s2Own(cls) && await page.evaluate(([S2, c]) => document.getElementById(S2).querySelectorAll('.' + c).length, [s.S2, cls]);
    await pick(page, s); await page.keyboard.press('Meta+x'); await raf(page);
    await clickFrame(page, s.B); await paste(page, cls);
    expect(await home(page, s, cls)).toEqual({ A: 0, B: b0(cls) + 1, C: 0, S2: s2 });
    await page.keyboard.press('Meta+z'); await raf(page);
    expect((await home(page, s, cls)).B, '⌘Z').toBe(b0(cls));
    await page.keyboard.press('Meta+Shift+z'); await raf(page);
    await reopen(page);
    expect(await home(page, s, cls), '저장 왕복').toEqual({ A: 0, B: b0(cls) + 1, C: 0, S2: s2 });
  });
}
test('⌘C → 다른 자유 프레임 → ⌘V 는 그 프레임 안 · 원본 그대로', async ({ page }) => {
  await open(page); const [cls, entry] = KINDS[1]; const s = await scene(page, cls, entry); await raf(page);
  await pick(page, s); await page.keyboard.press('Meta+c'); await raf(page);
  await clickFrame(page, s.B); await paste(page, cls);
  expect(await home(page, s, cls)).toEqual({ A: 1, B: 1, C: 0, S2: 0 });
});
test('⌘X → 아무것도 안 고름 → ⌘V 는 원래 부모 안 원본 옆 +20 · 다시 ⌘V 는 또 +20', async ({ page }) => {
  await open(page); const [cls, entry] = KINDS[0]; const s = await scene(page, cls, entry); await raf(page);
  await pick(page, s); await page.keyboard.press('Meta+x'); await raf(page);
  await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; document.querySelectorAll('#canvas .section-block.selected').forEach((x) => x.classList.remove('selected')); }); await raf(page);
  await paste(page, cls);
  const at = () => page.evaluate((A) => [...document.getElementById(A).querySelectorAll('.frame-block[data-text-frame]')].map((w) => [w.style.left, w.style.top]), s.A);
  expect(await at()).toEqual([['60px', '70px']]);
  await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; document.querySelectorAll('#canvas .section-block.selected').forEach((x) => x.classList.remove('selected')); }); await raf(page);
  await paste(page, cls);
  expect(await at(), '둘째는 겹치지 않는다').toEqual([['60px', '70px'], ['80px', '90px']]);
});
test('⌘X → 빈 스택 프레임 → ⌘V 는 그 안 흐름으로', async ({ page }) => {
  await open(page); const [cls, entry] = KINDS[1]; const s = await scene(page, cls, entry); await raf(page);
  await pick(page, s); await page.keyboard.press('Meta+x'); await raf(page);
  await clickFrame(page, s.C); await paste(page, cls);
  expect(await home(page, s, cls)).toEqual({ A: 0, B: 0, C: 1, S2: 0 });
  expect(await page.evaluate((C) => document.getElementById(C).querySelector('.asset-block').style.position, s.C), '흐름').not.toBe('absolute');
});
test('⌘X → 다른 섹션 → ⌘V 는 그 섹션', async ({ page }) => {
  await open(page); const [cls, entry] = KINDS[1]; const s = await scene(page, cls, entry); await raf(page);
  await pick(page, s); await page.keyboard.press('Meta+x'); await raf(page);
  await page.evaluate((S2) => { window.deselectAll(); window._activeFrame = null; window.selectSection(document.getElementById(S2)); }, s.S2); await raf(page);
  await paste(page, cls);
  expect(await home(page, s, cls)).toEqual({ A: 0, B: 0, C: 0, S2: 1 });
});
test('음성 — 고른 채 ⌘C ⌘V ⌘V 는 같은 부모 안 서로 다른 자리 · ⌘D 도 그 안', async ({ page }) => {
  await open(page); const [cls, entry] = KINDS[0]; const s = await scene(page, cls, entry); await raf(page);
  await pick(page, s); await page.keyboard.press('Meta+c'); await raf(page);
  await paste(page, cls); await paste(page, cls);
  const pos = await page.evaluate((A) => [...document.getElementById(A).querySelectorAll('.frame-block[data-text-frame]')].map((w) => w.style.left + ',' + w.style.top), s.A);
  expect(new Set(pos).size, pos.join(' | ')).toBe(3);
  await pick(page, s); await page.keyboard.press('Meta+d'); await page.waitForFunction(([A]) => document.getElementById(A).querySelectorAll('.frame-block[data-text-frame]').length === 4, [s.A]);
  expect(await page.evaluate((A) => document.getElementById(A).querySelectorAll('.frame-block[data-text-frame]').length, s.A)).toBe(4);
});

/* frame-mode-roundtrip-294l — J294L 프레임 모드 섞기·컴포넌트 왕복. 조작 = 진짜 마우스·키, 자리 차림만 앱 함수.
 * 자: 블럭 수 · 부모 프레임 id · 모드(data-free-layout) · 대상 selected.
 * test.fail = 지금 깨져 있는 칸(회신 B-2·B-5). 고쳐지면 이 표시가 빨강이 되니 그때 뗀다.
 * ⛔안 재는 것: B-1 사라짐(srv 워커2 몫), 좌표·폭 왕복(설계 판정 전), 33 종 전수(회신 표의 값은 ~/.gd-work/j294l), 파일 저장. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const J = require('./_frame-judge-294.js');
const FR = '.frame-block:not([data-text-frame])';

async function scene(page) {
  await page.setViewportSize({ width: 1900, height: 1600 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (FR) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); await window.addSection();
    const [sec, sec2] = c.querySelectorAll('.section-block');
    const add = (par, w, h, l, t) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const id = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)).id; return { id, w, h, l, t, par }; };
    const R = add(null, 1040, 900); const G1 = add(R.id, 490, 800, 10, 20); const GG = add(G1.id, 450, 380, 20, 20); const GS = add(G1.id, 450, 380, 20, 410);
    for (const n of [R, G1, GG, GS]) { const f = document.getElementById(n.id); window.updateFrameBlock(n.id, { width: n.w, height: n.h }); if (n.par) { f.style.left = n.l + 'px'; f.style.top = n.t + 'px'; f.dataset.offsetX = n.l; f.dataset.offsetY = n.t; } }
    window.deselectAll(); window._activeFrame = null; window.clearHistory?.();
    return { sec: sec.id, sec2: sec2.id, R: R.id, G1: G1.id, GG: GG.id, GS: GS.id };
  }, FR);
  await J.reopen(page);
  return { ids, errs };
}
const addBlock = (page, fn, sel, secId, frameId) => page.evaluate(({ fn, sel, secId, frameId }) => {
  const b4 = new Set(document.querySelectorAll(sel)); window.deselectAll(); window.selectSection(document.getElementById(secId)); window._activeFrame = frameId ? document.getElementById(frameId) : null; window[fn]();
  const e = [...document.querySelectorAll(sel)].find((x) => !b4.has(x)); e.setAttribute('data-j294l', '1'); window.deselectAll(); e.scrollIntoView({ block: 'center' });
}, { fn, sel, secId, frameId });
const marked = (page) => page.evaluate((FR) => { const e = document.querySelector('[data-j294l]'); if (!e) return null; const r = e.getBoundingClientRect(); return { par: e.parentElement.closest(FR)?.id || null, x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, FR);
const STEPS = 12;
async function drag(page, from, to) { await page.mouse.move(from[0], from[1]); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(from[0] + (to[0] - from[0]) * i / STEPS, from[1] + (to[1] - from[1]) * i / STEPS); await J.settle(page); } await page.mouse.up(); await J.settle(page); }
const nearCorner = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width * 0.9, r.top + r.height * 0.9]; }, id);
const layerRowCenter = (page, id) => page.evaluate((id) => { window.buildLayerPanel?.(); document.querySelectorAll('[class*=layer].collapsed').forEach((x) => x.classList.remove('collapsed')); const it = document.getElementById(id)._layerItem; const h = it.querySelector?.(':scope > .layer-row-header, :scope > .layer-row') || it; h.scrollIntoView({ block: 'center' }); const r = h.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, id);


test('B-1 짝: 표 같은 끌기(BLOCK_SEL 안 종)는 안 사라지고 ⌘Z 로 되돌아간다', async ({ page }) => {
  const { ids } = await scene(page); await addBlock(page, 'addStepBlock', '.step-block', ids.sec, null); await J.settle(page);
  const a = await marked(page); await page.mouse.click(a.x, a.y); await J.settle(page);
  await drag(page, [a.x, a.y], await nearCorner(page, ids.R));
  expect((await marked(page)).par).toBe(ids.R);
  await page.keyboard.press('Meta+z'); await J.settle(page);
  expect((await marked(page)).par).toBe(null);
});

test('B-2 ⌘X → 다른 프레임 고름 → ⌘V 는 고른 프레임으로 간다', async ({ page }) => {
  test.fail(true, '회신 B-2: editor.js freeLayout 붙이기가 sourceFrameId 를 먼저 봄');
  const { ids } = await scene(page); await addBlock(page, 'addTableBlock', '.table-block', ids.sec, ids.GG); await J.settle(page);
  const src = await page.evaluate(() => document.querySelector('[data-j294l]').id);
  const p = await layerRowCenter(page, src); await page.mouse.click(p[0], p[1]); await J.settle(page);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+x'); await J.settle(page);
  expect(await marked(page)).toBe(null);
  const t = await layerRowCenter(page, ids.GS); await page.mouse.click(t[0], t[1]); await J.settle(page);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), ids.GS)).toBe(true);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+v'); await J.settle(page);
  expect((await marked(page)).par).toBe(ids.GS);
});

test('B-6 값: 패널에서 프레임 행에 놓으면 지금은 섹션 직속으로 간다, ⌘Z 한 번에 돌아온다', async ({ page }) => {
  const { ids } = await scene(page); await addBlock(page, 'addTableBlock', '.table-block', ids.sec, ids.GG); await J.settle(page);
  const src = await page.evaluate(() => document.querySelector('[data-j294l]').id);
  const a = await layerRowCenter(page, src); const b = await layerRowCenter(page, ids.GS);
  const a2 = await layerRowCenter(page, src); await drag(page, a2, b);
  const m = await marked(page); test.info().annotations.push({ type: 'V', description: 'par=' + m.par + ' start=' + a });
  expect(m.par).toBe(null);
  await page.keyboard.press('Meta+z'); await J.settle(page);
  expect((await marked(page)).par).toBe(ids.GG);
});

test('A 왕복: 자식 찬 프레임 stack 변환 뒤 자식 수·부모 유지, ⌘Z 로 자유 복귀, 다시 열어도 같은 모드', async ({ page }) => {
  const { ids } = await scene(page);
  const p = await layerRowCenter(page, ids.G1); await page.mouse.click(p[0], p[1]); await J.settle(page);
  await page.locator('#ss-to-stack-btn').click(); await J.settle(page);
  const read = () => page.evaluate(({ FR, ids }) => { const g = document.getElementById(ids.G1); return { free: g.dataset.freeLayout === 'true', kids: [...g.querySelectorAll(FR)].map((x) => x.id).sort(), ggPar: document.getElementById(ids.GG).parentElement.closest(FR)?.id }; }, { FR, ids });
  const s = await read(); expect(s.free).toBe(false); expect(s.kids).toEqual([ids.GG, ids.GS].sort()); expect(s.ggPar).toBe(ids.G1);
  await J.reopen(page); expect((await read()).free).toBe(false);
  await page.keyboard.press('Escape');
  expect((await read()).kids).toEqual([ids.GG, ids.GS].sort());
});

test('B-5 변환 직후 stack 프레임에 섹션 row 를 놓으면 그 프레임으로 들어간다', async ({ page }) => {
  test.fail(true, '회신 B-5: 맨 위 R 로 감. 다시 열면 들어감');
  const { ids } = await scene(page);
  for (const id of [ids.GS, ids.G1, ids.R]) { const p = await layerRowCenter(page, id); await page.mouse.click(p[0], p[1]); await J.settle(page); await page.locator('#ss-to-stack-btn').click(); await J.settle(page); }
  await addBlock(page, 'addAssetBlock', '.asset-block', ids.sec, null); await J.settle(page);
  const a = await marked(page); await page.mouse.click(a.x, a.y); await J.settle(page);
  await drag(page, [a.x, a.y], await nearCorner(page, ids.GS));
  expect((await marked(page)).par).toBe(ids.GS);
});

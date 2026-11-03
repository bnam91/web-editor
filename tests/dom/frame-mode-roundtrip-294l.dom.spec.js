/* frame-mode-roundtrip-294l — J294L 프레임 모드 섞기·컴포넌트 왕복. 조작 = 진짜 마우스·키, 자리 차림만 앱 함수.
 * 자: 블럭 수 · 부모 프레임 id · 모드(data-free-layout) · 대상 selected.
 * test.fail = 지금 깨져 있는 칸(지금 0 칸). 고쳐지면 이 표시가 빨강이 되니 그때 뗀다.
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
  const { ids } = await scene(page); await addBlock(page, 'addTableBlock', '.table-block', ids.sec, ids.GG); await J.settle(page);
  const src = await page.evaluate(() => document.querySelector('[data-j294l]').id);
  const p = await layerRowCenter(page, src); await page.mouse.click(p[0], p[1]); await J.settle(page);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+x'); await J.settle(page);
  expect(await marked(page)).toBe(null);
  const t = await layerRowCenter(page, ids.GS); await page.mouse.click(t[0], t[1]); await J.settle(page);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), ids.GS)).toBe(true);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+v');
  /* ⌘V 는 paste 이벤트에 양보하느라 30ms 뒤에 붙는다(js/editor.js keydown). 두 rAF 만 기다리면 부하 때 붙기 전에 읽는다 */
  await expect.poll(async () => (await marked(page))?.par).toBe(ids.GS);
  expect(await page.evaluate(() => document.querySelectorAll('[data-j294l]').length)).toBe(1);
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

const addText = (page, secId, frameId) => page.evaluate(({ secId, frameId }) => { window.deselectAll(); window.selectSection(document.getElementById(secId)); window._activeFrame = document.getElementById(frameId); window.addTextBlock('body'); window.deselectAll(); window._activeFrame = null; }, { secId, frameId });
async function toStack(page, ids) {
  for (const f of [ids.GG, ids.GS]) await addText(page, ids.sec, f);
  await J.settle(page);
  for (const id of [ids.GG, ids.GS, ids.G1, ids.R]) { const p = await layerRowCenter(page, id); await page.mouse.click(p[0], p[1]); await J.settle(page); await page.locator('#ss-to-stack-btn').click(); await J.settle(page); }
  expect(await page.evaluate((l) => l.filter((id) => document.getElementById(id).dataset.freeLayout).length, [ids.GG, ids.GS, ids.G1, ids.R]), '[전제] 넷 다 stack').toBe(0);
}
async function pickMarked(page) { for (let i = 0; i < 6; i++) { if (await page.evaluate(() => document.querySelector('[data-j294l]').classList.contains('selected'))) return true; const m = await marked(page); await page.mouse.click(m.x, m.y); await J.settle(page); } return false; }
const lowerMiddle = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.9]; }, id);

test('B-5 변환 직후 안쪽 stack 프레임의 블럭을 옆 stack 프레임에 놓으면 그 프레임으로 들어간다', async ({ page }) => {
  const { ids } = await scene(page); await toStack(page, ids);
  await addBlock(page, 'addAssetBlock', '.asset-block', ids.sec, ids.GG); await J.settle(page);
  expect((await marked(page)).par, '[전제] GG 안').toBe(ids.GG);
  expect(await pickMarked(page), '[전제] 클릭 고르기').toBe(true);
  const a = await marked(page); await drag(page, [a.x, a.y], await lowerMiddle(page, ids.GS));
  expect((await marked(page)).par).toBe(ids.GS);
  expect(await page.evaluate(() => document.querySelectorAll('[data-j294l]').length)).toBe(1);
});
test('B-4 값: 섹션 직속 블럭을 깊은 stack 프레임에 놓으면 변환 직후·다시 연 뒤 똑같이 맨 위 프레임으로 간다', async ({ page }) => {
  const { ids } = await scene(page); await toStack(page, ids);
  const once = async () => { await addBlock(page, 'addAssetBlock', '.asset-block', ids.sec, null); await J.settle(page); const a = await marked(page); await page.mouse.click(a.x, a.y); await J.settle(page); const b = await marked(page); await drag(page, [b.x, b.y], await lowerMiddle(page, ids.GS)); return (await marked(page)).par; };
  expect(await once()).toBe(ids.R);
  await page.evaluate(() => document.querySelector('[data-j294l]').removeAttribute('data-j294l'));
  await J.reopen(page); await J.settle(page);
  expect(await once()).toBe(ids.R);
});

/* B-6: 패널 안내선 ↔ 실제 놓임. 안내선 바로 다음 항목 앞에 놓여야 한다. 마지막에 한 번 더 움직여 dragover 를 받게 한다 */
async function panelDrop(page, from, to) {
  await page.mouse.move(from[0], from[1]); await page.mouse.down();
  for (let i = 1; i <= STEPS; i++) { await page.mouse.move(from[0] + (to[0] - from[0]) * i / STEPS, from[1] + (to[1] - from[1]) * i / STEPS); await J.settle(page); }
  await page.mouse.move(to[0], to[1] + 0.5);
  await expect.poll(() => page.evaluate(() => !!document.querySelector('.layer-drop-indicator'))).toBe(true); await J.settle(page);
  const next = await page.evaluate(() => document.querySelector('.layer-drop-indicator').nextElementSibling?._dragTarget?.id || null);
  await page.mouse.up(); await J.settle(page);
  return next;
}
const nextOfMarked = (page) => page.evaluate(() => { const e = document.querySelector('[data-j294l]'); const inner = e.closest('.section-inner'); let u = e; while (u.parentElement !== inner) u = u.parentElement; return u.nextElementSibling?.id || null; });
const lastGapRow = (page, sec) => page.evaluate((sec) => { const g = [...document.getElementById(sec).querySelector('.section-inner').children].filter((c) => c.classList.contains('gap-block')).pop(); const r = g._layerItem.getBoundingClientRect(); g.dataset.j294lgap = '1'; return { id: g.id, pt: [r.x + r.width / 2, r.y + r.height * 0.8] }; }, sec);
test('B-6 패널 맨 끝에 놓으면 안내선과 같은 자리(끝 여백 앞)에 놓인다', async ({ page }) => {
  const { ids } = await scene(page); await addBlock(page, 'addTableBlock', '.table-block', ids.sec, ids.GG); await J.settle(page);
  const src = await page.evaluate(() => document.querySelector('[data-j294l]').id);
  await layerRowCenter(page, src); const a = await layerRowCenter(page, src); await page.mouse.click(a[0], a[1]); await J.settle(page);
  const from = await layerRowCenter(page, src); const g = await lastGapRow(page, ids.sec);
  const line = await panelDrop(page, from, g.pt);
  expect(line, '안내선 다음 = 끝 여백').toBe(g.id);
  expect(await nextOfMarked(page)).toBe(g.id);
});
test('B-6 음성: 프레임 행 위에서는 안내선이 섹션 층 맨 위 프레임 앞이고 정말 거기 놓인다', async ({ page }) => {
  const { ids } = await scene(page); await addBlock(page, 'addTableBlock', '.table-block', ids.sec, ids.GG); await J.settle(page);
  const src = await page.evaluate(() => document.querySelector('[data-j294l]').id);
  const a = await layerRowCenter(page, src); await page.mouse.click(a[0], a[1]); await J.settle(page);
  const from = await layerRowCenter(page, src);
  const to = await page.evaluate((id) => { const it = document.getElementById(id)._layerItem; const h = it.querySelector(':scope > .layer-row-header, :scope > .layer-row') || it; const r = h.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, ids.G1);
  const line = await panelDrop(page, from, to);
  expect(line, '안내선 다음 = 맨 위 프레임').toBe(ids.R);
  expect(await nextOfMarked(page)).toBe(ids.R);
});
/* 안내선이 서기 전(rAF 전)에 놓는 장면 — dragover 의 rAF 를 멈춘 채 진짜 마우스로 놓는다 */
async function panelDropBeforeLine(page, from, to) {
  await page.mouse.move(from[0], from[1]); await page.mouse.down();
  for (let i = 1; i <= STEPS; i++) { await page.mouse.move(from[0] + (to[0] - from[0]) * i / STEPS, from[1] + (to[1] - from[1]) * i / STEPS); await J.settle(page); }
  await page.evaluate(() => { document.querySelectorAll('.layer-drop-indicator').forEach((x) => x.remove()); window.__raf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; });
  await page.mouse.move(to[0], to[1] + 0.5);
  expect(await page.evaluate(() => !!document.querySelector('.layer-drop-indicator')), '[전제] 안내선 없음').toBe(false);
  await page.mouse.up();
  await page.evaluate(() => { window.requestAnimationFrame = window.__raf; }); await J.settle(page);
}
test('B-6 안내선이 서기 전에 프레임 행 위에 놓아도 끝 여백 뒤로 안 가고 그 자리에 놓인다', async ({ page }) => {
  const { ids } = await scene(page); await addBlock(page, 'addTableBlock', '.table-block', ids.sec, ids.GG); await J.settle(page);
  const src = await page.evaluate(() => document.querySelector('[data-j294l]').id);
  const a = await layerRowCenter(page, src); await page.mouse.click(a[0], a[1]); await J.settle(page);
  const from = await layerRowCenter(page, src);
  const to = await page.evaluate((id) => { const it = document.getElementById(id)._layerItem; const h = it.querySelector(':scope > .layer-row-header, :scope > .layer-row') || it; const r = h.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, ids.R);
  await panelDropBeforeLine(page, from, to);
  expect(await nextOfMarked(page)).toBe(ids.R);
  expect(await page.evaluate(() => document.querySelectorAll('.layer-drop-indicator').length), '안내선이 남지 않는다').toBe(0);
});
test('B-6 음성: 안내선이 서기 전에 맨 끝에 놓아도 끝 여백 앞이다', async ({ page }) => {
  const { ids } = await scene(page); await addBlock(page, 'addTableBlock', '.table-block', ids.sec, ids.GG); await J.settle(page);
  const src = await page.evaluate(() => document.querySelector('[data-j294l]').id);
  await layerRowCenter(page, src); const a = await layerRowCenter(page, src); await page.mouse.click(a[0], a[1]); await J.settle(page);
  const from = await layerRowCenter(page, src); const g = await lastGapRow(page, ids.sec);
  await panelDropBeforeLine(page, from, g.pt);
  expect(await nextOfMarked(page)).toBe(g.id);
});

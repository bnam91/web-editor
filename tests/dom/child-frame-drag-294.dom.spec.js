/* child-frame-drag-294 — 부모 프레임 안 자식 프레임을 끌면 자식이 움직이고 부모는 안 끌린다(294 t9-03 · J294G).
 * 음성: 부모 자신을 끄는 HTML5 순서 바꾸기는 그대로 산다 · 손자 끌기는 전부터 정상. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
/* 저장본에서 다시 태어난 판 = 자식이 absolute 로 바인드된다(사람이 다시 연 프로젝트). 같은 세션 updateFrameBlock 만으로는 flow 로 바인드돼 좌표 끌기가 없다. */
const reopen = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (FR) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const add = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return f.id; };
    const P = add(); window.updateFrameBlock(P, { width: 860, height: 700 }); const A = add(P); window.updateFrameBlock(A, { width: 300, height: 200 }); const G = add(A); window.updateFrameBlock(G, { width: 100, height: 60 }); const B = add(P); window.updateFrameBlock(B, { width: 300, height: 200 });
    for (const [id, l, t] of [[A, 20, 20], [B, 360, 20], [G, 20, 20]]) { const e = document.getElementById(id); e.style.left = l + 'px'; e.style.top = t + 'px'; e.dataset.offsetX = l; e.dataset.offsetY = t; }
    const Q = add(); window.clearHistory?.(); document.getElementById(P).scrollIntoView({ block: 'center' });
    window.__dragstarts = []; addEventListener('dragstart', (e) => window.__dragstarts.push(e.target.id), true);
    return { P, A, B, G, Q }; }, FR);
  await page.evaluate(() => {}); await reopen(page); await raf(page); await page.evaluate((P) => document.getElementById(P).scrollIntoView({ block: 'center' }), ids.P); await raf(page); return { errs, ...ids };
}
const box = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, id);
const tops = (page) => page.evaluate((FR) => [...document.querySelector('#canvas .section-inner').querySelectorAll(':scope > ' + FR)].map((f) => f.id), FR);
const pos = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return [parseInt(e.style.left), parseInt(e.style.top), e.parentElement.closest('.frame-block')?.id || null]; }, id);
async function drag(page, x, y, dx, dy) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 12; i++) { await page.mouse.move(x + dx * i / 12, y + dy * i / 12); await page.waitForTimeout(20); } await page.mouse.up(); await raf(page); }

test('자식 프레임을 끌면 자식만 끝까지 따라오고 부모는 제자리다', async ({ page }) => {
  const { errs, P, A, B, Q } = await scene(page);
  const p = await box(page, P); await page.mouse.click(p.l + 300, p.b - 10); await raf(page);
  const a = await box(page, B);
  const order0 = await tops(page);
  await drag(page, a.r - 6, a.b - 6, -40, 60);
  const scale = await page.evaluate(() => parseFloat(document.getElementById('canvas-scaler').style.transform.match(/scale\(([^)]+)\)/)?.[1] || '1'));
  const [l, t, par] = await pos(page, B);
  expect(await page.evaluate(() => window.__dragstarts), '부모 HTML5 끌기가 시작되면 안 된다').toEqual([]);
  expect(par, '부모 그대로').toBe(P);
  expect(Math.abs(l - (360 - 40 / scale)), `left ${l}`).toBeLessThan(3);
  expect(Math.abs(t - (20 + 60 / scale)), `top ${t}`).toBeLessThan(3);
  expect(await tops(page), '섹션 안 순서 그대로').toEqual(order0);
  expect(await page.evaluate(([P, Q]) => [!document.getElementById(Q).contains(document.getElementById(P))], [P, Q])).toEqual([true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('음성 — 같은 세션에 ⌘G 한 그룹의 자식을 누르고 끌면 여태처럼 그룹이 끌린다(자식에 좌표 끌기 없음)', async ({ page }) => {
  const { errs, Q } = await scene(page);
  const [a, b] = await page.evaluate(([FR]) => { const sec = document.querySelector('#canvas .section-block'); const add = () => { window.deselectAll(); window.selectSection(sec); window._activeFrame = null; const q = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !q.has(x)); window.deselectAll(); return f.id; }; const r = [add(), add()]; document.getElementById(r[0]).scrollIntoView({ block: 'center' }); return r; }, [FR]); await raf(page);
  const ca = await box(page, a); await page.mouse.click((ca.l + ca.r) / 2, (ca.t + ca.b) / 2); await raf(page);
  const cb = await box(page, b); await page.keyboard.down('Meta'); await page.mouse.click((cb.l + cb.r) / 2, (cb.t + cb.b) / 2); await page.keyboard.up('Meta'); await raf(page);
  await page.keyboard.press('Meta+g'); await raf(page);
  const grp = await page.evaluate((a) => document.getElementById(a).parentElement.id, a);
  expect(await page.evaluate((id) => document.getElementById(id).dataset.group, grp), '[전제] 묶임').toBe('true');
  const c = await box(page, a); await page.evaluate(() => { window.__dragstarts.length = 0; });
  await drag(page, (c.l + c.r) / 2, (c.t + c.b) / 2, 0, 30);
  expect(await page.evaluate(() => window.__dragstarts), '그룹 끌기').toContain(grp);
  expect(Q && errs.length).toBe(0);
});
test('음성 — 부모를 빈 자리에서 끌면 HTML5 끌기가 그대로 시작되고, 놓은 뒤 draggable 이 돌아온다', async ({ page }) => {
  const { errs, P, A } = await scene(page);
  const p = await box(page, P); await page.mouse.click(p.l + 300, p.b - 10); await raf(page);
  const a = await box(page, A);
  await page.mouse.click(a.r - 6, a.b - 6); await raf(page);   // 자식 눌렀다 놓기 — 값이 돌아오나
  expect(await page.evaluate((P) => document.getElementById(P).getAttribute('draggable'), P), '자식 누른 뒤 부모 draggable 복귀').toBe('true');
  await page.mouse.click(p.l + 300, p.b - 10); await raf(page);
  await drag(page, p.l + 300, p.b - 10, 0, 60);
  expect(await page.evaluate(() => window.__dragstarts), '부모 끌기').toContain(P);
  expect(errs, errs.join(' | ')).toEqual([]);
});

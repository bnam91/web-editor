/* frame-hold-drag-selection — S3 C. 더블클릭으로 들어가면 글자 선택이 남고, 그 위를 눌러 잠깐 있다 끌면 프레임이 안 움직였다.
 * 조작 = 진짜 마우스, 자리 차림만 앱 함수. 자: dataset.offsetX/Y · getSelection().type · dragstart 수. 화면 px 를 숫자와 견주지 않는다.
 * 기다림은 «눌러 쥔 시간» 그 자체가 재는 값이다(화면을 기다리는 대기가 아니다). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const J = require('./_frame-judge-294.js');
const FR = '.frame-block:not([data-text-frame])';
const HOLD_MS = 400;

async function scene(page) {
  await page.setViewportSize({ width: 1800, height: 1500 });
  await bootApp(page);
  const ids = await page.evaluate(async (FR) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block');
    const add = (par, w, h, l, t) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const id = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)).id; return { id, par, w, h, l, t }; };
    const L0 = add(null, 1000, 830); const L1 = add(L0.id, 970, 780, 15, 15); const L2 = add(L1.id, 940, 740, 15, 15);
    const E = add(L2.id, 200, 120, 20, 20); const S = add(L2.id, 400, 560, 100, 160);
    for (const n of [L0, L1, L2, E, S]) { const f = document.getElementById(n.id); window.updateFrameBlock(n.id, { width: n.w, height: n.h }); if (n.par) { f.style.left = n.l + 'px'; f.style.top = n.t + 'px'; f.dataset.offsetX = n.l; f.dataset.offsetY = n.t; } }
    window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(S.id); window.addTableBlock();
    const b = new Set(sec.querySelectorAll('.text-block')); window.addTextBlock('body'); const t = [...sec.querySelectorAll('.text-block')].find((x) => !b.has(x)); t.dataset.hd = '1'; const tb = t.querySelector('.tb-body') || t.querySelector('[contenteditable]') || t; tb.textContent = '가나다라마바사 abc def ghi jkl';
    window.deselectAll(); window._activeFrame = null; window.clearHistory?.();
    return { L0: L0.id, L1: L1.id, L2: L2.id, E: E.id, S: S.id };
  }, FR);
  await J.reopen(page); await page.evaluate(J.PAGE_LIB); await page.evaluate(J.EYE_LIB); await J.settle(page);
  await page.evaluate(() => { window.__hd = { ds: 0, down: 0 }; addEventListener('dragstart', () => { window.__hd.ds++; }, true); addEventListener('mousedown', () => { window.__hd.down = performance.now(); }, true); });
  return ids;
}
const pickE = (page, ids) => J.select(page, ids.E, 3, { chain: [ids.L0, ids.L1, ids.L2] });
const offs = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return [e.dataset.offsetX, e.dataset.offsetY].map(Number); }, id);
const selType = (page) => page.evaluate(() => getSelection().type);
const heldLongEnough = (page) => page.waitForFunction((ms) => performance.now() - window.__hd.down >= ms, HOLD_MS);
async function holdDrag(page, p, hx, hy) {
  await page.mouse.move(p[0], p[1]); await page.mouse.down(); await heldLongEnough(page);
  await page.mouse.move(p[0] + hx, p[1] + hy, { steps: 10 }); await J.settle(page); await page.mouse.up(); await J.settle(page);
}
const textBox = (page) => page.evaluate(() => { const e = document.querySelector('[data-hd]'); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, sel: e.classList.contains('selected') }; });
async function enterText(page) {
  for (let i = 0; i < 8; i++) { const b = await textBox(page); if (b.sel) break; await page.mouse.dblclick(b.x + b.w / 2, b.y + b.h / 2);  /* B안(현빈 261107): 자식은 더블클릭으로 진입해야 잡힌다 — 한 번 클릭은 바깥 프레임 */ await J.settle(page); }
  const b = await textBox(page); await page.mouse.dblclick(b.x + b.w / 2, b.y + b.h / 2); await J.settle(page);
  return page.evaluate(() => !!document.activeElement?.isContentEditable);
}

test('C 더블클릭으로 들어가 글자 선택이 남은 프레임을 눌러 쥐었다 끌면 프레임이 움직인다', async ({ page }) => {
  const ids = await scene(page); expect((await pickE(page, ids)).sel).toBe(true);
  /* 더블클릭이 남기는 범위는 눌린 자리 옆 글자에 달렸다(앱 값: «\n항목» 3/3). 판마다 자리가 달라 장면은 같은 꼴을 직접 세운다 */
  await page.evaluate((id) => getSelection().selectAllChildren(document.getElementById(id).closest('.section-block')), ids.E);
  expect(await selType(page), '[전제] 글자 선택이 남았다').toBe('Range');
  const o0 = await offs(page, ids.E); const p = await J.ownPoint(page, ids.E);
  /* ⓐ(FREE-FRAME-SIBLING-DROP-A-01) 뒤 — 옛 (60,40)은 커서가 형제 S 위에서 끝나 E 가 S «안»으로 든다(피그마식 · 인텔 실측 커서 y 812 ⊂ S 804~). 재는 것(쥐었다 끌기)은 그대로, 놓는 자리만 S 밖 */
  await holdDrag(page, p, 60, 20);
  const o1 = await offs(page, ids.E);
  expect(await page.evaluate(() => window.__hd.ds)).toBe(0);
  expect(o1[0]).toBeGreaterThan(o0[0]); expect(o1[1]).toBeGreaterThan(o0[1]);
});
test('음성 C: 바로 끌어도 전처럼 움직인다', async ({ page }) => {
  const ids = await scene(page); expect((await pickE(page, ids)).sel).toBe(true);
  const o0 = await offs(page, ids.E); const p = await J.ownPoint(page, ids.E);
  await page.mouse.move(p[0], p[1]); await page.mouse.down(); await page.mouse.move(p[0] + 60, p[1] + 40, { steps: 10 }); await J.settle(page); await page.mouse.up(); await J.settle(page);
  expect((await offs(page, ids.E))[0]).toBeGreaterThan(o0[0]);
});
test('음성 C: 편집 중 글자를 끌어 고르면 선택이 살아 있고 블럭은 안 움직인다', async ({ page }) => {
  const ids = await scene(page); expect((await J.select(page, ids.S, 3, { chain: [ids.L0, ids.L1, ids.L2] })).sel).toBe(true);
  expect(await enterText(page), '[전제] 편집 중').toBe(true);
  const b = await textBox(page);
  const q = await page.evaluate(() => { const e = document.querySelector('[data-hd] .tb-body') || document.querySelector('[data-hd]'); const n = document.createTreeWalker(e, NodeFilter.SHOW_TEXT).nextNode(); const g = document.createRange(); g.setStart(n, 1); g.setEnd(n, 12); const r = g.getBoundingClientRect(); return [r.left, r.right, r.top + r.height / 2]; });
  await page.mouse.move(q[0], q[2]); await page.mouse.down(); await heldLongEnough(page);
  await page.mouse.move(q[1], q[2], { steps: 10 }); await J.settle(page); await page.mouse.up(); await J.settle(page);
  expect(await selType(page)).toBe('Range');
  expect((await page.evaluate(() => getSelection().toString())).length).toBeGreaterThan(0);
  const a = await textBox(page); expect([a.x, a.y]).toEqual([b.x, b.y]);
});
test('음성 C: 편집 중에 프레임을 눌러도 이 고침은 글자 선택을 안 지운다', async ({ page }) => {
  const ids = await scene(page); expect((await J.select(page, ids.S, 3, { chain: [ids.L0, ids.L1, ids.L2] })).sel).toBe(true);
  expect(await enterText(page), '[전제] 편집 중').toBe(true);
  await page.evaluate(() => { window.__hd.editingAtDown = null; window.__hd.cleared = 0; const f = Selection.prototype.removeAllRanges; Selection.prototype.removeAllRanges = function () { if (document.activeElement?.isContentEditable && new Error().stack.includes('block-drag')) window.__hd.cleared++; return f.apply(this); }; });
  const p = await J.ownPoint(page, ids.S); await page.mouse.move(p[0], p[1]); await page.mouse.down(); await J.settle(page); await page.mouse.up(); await J.settle(page);
  expect(await page.evaluate(() => window.__hd.cleared)).toBe(0);
});

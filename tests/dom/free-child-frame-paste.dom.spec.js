/* free-child-frame-paste — 자유 프레임 안 프레임 하나의 ⌘X·⌘C ⌘V 자리(FRAME-GROUP-PASTE-TARGET-RULE-01). 안 골랐으면 원래 부모 안 원본 옆 +20.
 * 전: 안 고르면 섹션 끝 흐름으로 갔다(⌘X 24/24). free-child-paste-target-b2 는 글자·에셋·표만 잠갔다.
 * ⌘D 는 이 규칙 밖이다(t902-copy4 C3 · 시트 287 이 잠근다). 변이: _pickedFreeChildFrame 을 빼면 F1·F2·F3 빨강 · N1·N2 초록. 헤드리스 대역이다(시스템 클립보드 무접촉). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const FR = '.frame-block:not([data-text-frame])';
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const read = (page) => page.evaluate((FR) => { const all = [...document.querySelectorAll('#canvas ' + FR)]; return { ids: all.map((f) => f.id), par: Object.fromEntries(all.map((f) => [f.id, f.parentElement.closest(FR)?.id || null])), pos: Object.fromEntries(all.map((f) => [f.id, [f.style.position, f.style.left, f.style.top]])), texts: [...document.querySelectorAll('#canvas .text-block')].map((t) => [t.id, t.closest(FR)?.id || null, t.textContent.trim()]) }; }, FR);
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1400 }); const errs = await bootApp(page);
  const ids = await page.evaluate(async (FR) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const add = (par, w, h, l, t) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.updateFrameBlock(f.id, { width: w, height: h }); if (par) { f.style.left = l + 'px'; f.style.top = t + 'px'; f.dataset.offsetX = l; f.dataset.offsetY = t; } window.deselectAll(); window._activeFrame = null; return f.id; };
    const P = add(null, 860, 500); const A = add(P, 240, 160, 20, 20); const G = add(A, 100, 60, 10, 10); const B = add(P, 240, 160, 300, 20); const C = add(P, 240, 160, 580, 20); const X = add(null, 860, 200); const Y = add(null, 860, 200);
    window.deselectAll(); window.clearHistory?.(); document.getElementById(P).scrollIntoView({ block: 'center' }); return { P, A, G, B, C, X, Y }; }, FR);
  await page.waitForFunction(() => { const t = document.getElementById('canvas-scaler')?.style.transform; const same = t === window.__zt; window.__zt = t; return same; }, null, { polling: 150 });   // 첫 맞춤 줌이 자리 잡을 때까지
  await page.evaluate((P) => document.getElementById(P).scrollIntoView({ block: 'center' }), ids.P); await raf(page); return { errs, ...ids };
}
const box = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, id);
/* ⌘V 는 paste 이벤트에 양보하느라 setTimeout 30ms 뒤에 붙는다 — 프레임 수가 늘 때까지 기다린다(raf 만이면 18건 중 1건 흔들림). */
const pasteKey = async (p) => { const n = await p.evaluate((FR) => document.querySelectorAll('#canvas ' + FR).length, FR); await p.keyboard.press('Meta+v'); await p.waitForFunction(([FR, n]) => document.querySelectorAll('#canvas ' + FR).length > n, [FR, n], { timeout: 3000 }); await raf(p); };
const clk = async (page, x, y, mod, dbl) => { if (mod) await page.keyboard.down(mod); if (dbl) await page.mouse.dblclick(x, y); else await page.mouse.click(x, y); if (mod) await page.keyboard.up(mod); await raf(page); };
async function pickKids(page, { P, A, B }) { const p = await box(page, P); await clk(page, (p.l + p.r) / 2, p.b - 12); const a = await box(page, A); await clk(page, (a.l + a.r) / 2, (a.t + a.b) / 2 + 10); const b = await box(page, B); await clk(page, (b.l + b.r) / 2, (b.t + b.b) / 2, 'Shift'); const sel = await page.evaluate(([A, B]) => [A, B].map((i) => document.getElementById(i).classList.contains('selected')), [A, B]); expect(sel, '[전제] 자식 둘 고름').toEqual([true, true]); }

const info = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return e && { par: e.parentElement.id, pos: e.style.position, l: e.style.left, t: e.style.top }; }, id);
const none = (page) => page.evaluate(() => { window.deselectAll(); window._activeFrame = null; document.querySelectorAll('#canvas .section-block.selected').forEach((x) => x.classList.remove('selected')); });
const pickChild = async (page, s, id) => { const p = await box(page, s.P); await clk(page, (p.l + p.r) / 2, p.b - 12); const a = await box(page, id); await clk(page, (a.l + a.r) / 2, (a.t + a.b) / 2, null, true); };   // B안(현빈 261107): 자식 = 더블클릭 진입
const newOf = async (page, before) => (await read(page)).ids.filter((i) => !before.ids.includes(i));

test('F1 ⌘X → 안 고름 → ⌘V 는 원래 부모 안 원본 옆 +20 · 다시 ⌘V 는 또 +20 · ⌘Z 한 걸음', async ({ page }) => {
  const { errs, ...s } = await scene(page);
  await pickChild(page, s, s.B); const o = await info(page, s.B);
  await page.keyboard.press('Meta+x'); await raf(page);
  expect(await info(page, s.B), '전제 — 잘렸다').toBeNull();
  const b0 = await read(page);
  await none(page); await pasteKey(page);
  const [n1] = await newOf(page, b0);
  expect(await info(page, n1)).toEqual({ par: s.P, pos: 'absolute', l: (parseInt(o.l) + 20) + 'px', t: (parseInt(o.t) + 20) + 'px' });
  const b1 = await read(page);
  await none(page); await pasteKey(page);
  const [n2] = await newOf(page, b1);
  expect(await info(page, n2), '둘째는 또 +20').toEqual({ par: s.P, pos: 'absolute', l: (parseInt(o.l) + 40) + 'px', t: (parseInt(o.t) + 40) + 'px' });
  await none(page); await page.keyboard.press('Meta+z'); await raf(page);
  expect(await info(page, n2), '⌘Z 한 걸음').toBeNull();
  expect(await info(page, n1), '앞 사본은 남는다').not.toBeNull();
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('F2 ⌘C → 안 고름 → ⌘V 도 원래 부모 안 원본 옆 +20 · 원본 그대로', async ({ page }) => {
  const { errs, ...s } = await scene(page);
  await pickChild(page, s, s.B); const o = await info(page, s.B);
  await page.keyboard.press('Meta+c'); await raf(page); const b0 = await read(page);
  await none(page); await pasteKey(page);
  const [n1] = await newOf(page, b0);
  expect(await info(page, n1)).toEqual({ par: s.P, pos: 'absolute', l: (parseInt(o.l) + 20) + 'px', t: (parseInt(o.t) + 20) + 'px' });
  expect(await info(page, s.B), '원본 그대로').toEqual(o);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('F3 저장 왕복 뒤에도 그 자리다', async ({ page }) => {
  const { errs, ...s } = await scene(page);
  await pickChild(page, s, s.B); const o = await info(page, s.B);
  await page.keyboard.press('Meta+x'); await raf(page); const b0 = await read(page);
  await none(page); await pasteKey(page);
  const [n1] = await newOf(page, b0);
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); }); await raf(page);
  await page.waitForFunction((i) => document.getElementById(i), n1, { timeout: 5000 });
  expect(await info(page, n1)).toEqual({ par: s.P, pos: 'absolute', l: (parseInt(o.l) + 20) + 'px', t: (parseInt(o.t) + 20) + 'px' });
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('N1 [음성] ⌘C → 다른 섹션을 고르면 그 섹션에 붙는다', async ({ page }) => {
  const { errs, ...s } = await scene(page);
  const sec2 = await page.evaluate(() => { window.addSection(); return [...document.querySelectorAll('#canvas .section-block')].pop().id; });
  await pickChild(page, s, s.B);
  await page.keyboard.press('Meta+c'); await raf(page); const b0 = await read(page);
  await page.evaluate((id) => { window.deselectAll(); window._activeFrame = null; window.selectSection(document.getElementById(id)); }, sec2); await raf(page);
  await pasteKey(page);
  const [n1] = await newOf(page, b0);
  expect(await page.evaluate(([n, id]) => document.getElementById(n).closest('.section-block').id === id, [n1, sec2])).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('N2 [음성] 맨 위 프레임 하나 ⌘C ⌘V 는 묶음 길을 안 탄다 — 그대로 흐름', async ({ page }) => {
  const { errs, ...s } = await scene(page);
  const q = await box(page, s.X); await clk(page, q.r - 5, q.b - 5);
  await page.keyboard.press('Meta+c'); await raf(page); const b0 = await read(page);
  await pasteKey(page);
  const [n1] = await newOf(page, b0);
  const r = await info(page, n1);
  expect(r.pos, '흐름').toBe('');
  expect(errs, errs.join(' | ')).toEqual([]);
});

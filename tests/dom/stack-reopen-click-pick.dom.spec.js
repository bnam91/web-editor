/* stack-reopen-click-pick — 다시 연 중첩 스택에서 안쪽 프레임·블럭을 더블클릭으로 차례로 고르고(B안 — 한 번 클릭은 바깥), 끌면 블럭이 간다(S6 새 발견 ① · 고치기 전엔 G1 에 묶여 아무것도 안 움직였다).
 * 음성: 맨 위 프레임 빈 자리 클릭은 맨 위를 고른다. absolute 자식·그룹 자식은 child-frame-drag-294 가 지킨다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const STEPS = 12;
const reopen = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
async function scene(page, sel, fn, arg) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (FR) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const add = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return f.id; };
    const text = (par) => { window.selectSection(sec); window._activeFrame = document.getElementById(par); window.addTextBlock('body'); window.deselectAll(); window._activeFrame = null; };
    const R = add(); const G1 = add(R); const A = add(G1); const B = add(G1); text(A); text(B);
    for (const [i, w, h] of [[R, 1000, 1000], [G1, 900, 900], [A, 800, 260], [B, 800, 260]]) window.updateFrameBlock(i, { width: w, height: h });
    for (const [i, l, t] of [[G1, 20, 20], [A, 20, 20], [B, 20, 320]]) { const f = document.getElementById(i); f.style.left = l + 'px'; f.style.top = t + 'px'; f.dataset.offsetX = l; f.dataset.offsetY = t; }
    return { R, G1, A, B }; }, FR);
  await reopen(page); await raf(page);
  await page.evaluate(({ ids, sel, fn, arg }) => { for (const n of ['A', 'B', 'G1', 'R']) window.__convertFreeLayoutToStack(document.getElementById(ids[n]));
    const before = new Set(document.querySelectorAll(sel)); window.deselectAll(); window.selectSection(document.querySelector('#canvas .section-block')); window._activeFrame = document.getElementById(ids.A); window[fn](arg);
    [...document.querySelectorAll(sel)].find((x) => !before.has(x)).dataset.mk = '1'; window.deselectAll(); window._activeFrame = null; }, { ids, sel, fn, arg });
  await reopen(page); await raf(page);
  await page.evaluate((R) => document.getElementById(R).scrollIntoView({ block: 'center' }), ids.R); await raf(page);
  return { errs, ...ids };
}
const mk = (page) => page.evaluate((FR) => { const e = document.querySelector('#canvas [data-mk]'); const r = e.getBoundingClientRect(); return { n: document.querySelectorAll('#canvas [data-mk]').length, x: r.left + r.width / 2, y: r.top + r.height / 2, par: e.parentElement.closest(FR)?.id, sel: e.classList.contains('selected') }; }, FR);
const selected = (page) => page.evaluate((FR) => [...document.querySelectorAll('#canvas ' + FR + '.selected')].map((f) => f.id), FR);
const spot = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - 8]; }, id);
async function drag(page, x, y, tx, ty) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + (tx - x) * i / STEPS, y + (ty - y) * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }
const KINDS = [['에셋', '.asset-block', 'addAssetBlock'], ['표', '.table-block', 'addTableBlock'], ['글자', '.text-block', 'addTextBlock', 'body'], ['챗', '.chat-block', 'addChatBlock']];

for (const [name, sel, fn, arg] of KINDS) {
  /* B안(현빈 261107): 옛 «클릭할 때마다 R→G1→A→블럭» 드릴인은 일부러 뺐다 — 한 번 클릭은 바깥(R)에 머물고, 더블클릭이 한 겹씩 내려간다. */
  test(`${name} — 한 번 클릭은 R 에 머물고 더블클릭할 때마다 G1→A→블럭으로 내려간다`, async ({ page }) => {
    const s = await scene(page, sel, fn, arg);
    const clicks = [];
    for (let i = 0; i < 3; i++) { const w = await mk(page); await page.mouse.click(w.x, w.y); await raf(page); clicks.push((await selected(page)).pop()); }
    expect(clicks, '한 번 클릭은 거듭해도 R').toEqual([s.R, s.R, s.R]);
    expect((await mk(page)).sel, '한 번 클릭으로는 블럭이 안 잡힌다').toBe(false);
    const seen = [];
    for (let i = 0; i < 3; i++) { const w = await mk(page); await page.mouse.dblclick(w.x, w.y); await raf(page); seen.push((await selected(page)).pop()); }
    expect(seen.slice(0, 2)).toEqual([s.G1, s.A]);
    expect((await mk(page)).sel, '셋째 더블클릭에 블럭').toBe(true);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
test('에셋 — 고른 뒤 끌면 블럭이 B 로 간다', async ({ page }) => {
  const s = await scene(page, KINDS[0][1], KINDS[0][2]);
  for (let i = 0; i < 4 && !(await mk(page)).sel; i++) { const w = await mk(page); await page.mouse.dblclick(w.x, w.y); await raf(page); }  // B안: 더블클릭 진입으로 고른다
  expect((await mk(page)).sel, '[전제] 고르기').toBe(true);
  const w = await mk(page); const [tx, ty] = await spot(page, s.B);
  await drag(page, w.x, w.y, tx, ty);
  const a = await mk(page);
  expect([a.n, a.par]).toEqual([1, s.B]);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
test('음성 — R 만 고른 채 안쪽을 끌어도 프레임 구조·순서는 그대로다', async ({ page }) => {
  const s = await scene(page, KINDS[0][1], KINDS[0][2]);
  const tree = () => page.evaluate((FR) => [...document.querySelectorAll('#canvas ' + FR)].map((f) => f.id + '<' + (f.parentElement.closest(FR)?.id || '')).join(' '), FR);
  const w = await mk(page); await page.mouse.click(w.x, w.y); await raf(page);
  expect((await selected(page)).pop(), '[전제] R 고름').toBe(s.R);
  const t0 = await tree(); const [tx, ty] = await spot(page, s.R);
  await drag(page, w.x, w.y, tx, ty);
  expect(await tree()).toBe(t0);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
test('음성 — 맨 위 프레임 빈 자리 클릭은 맨 위를 고른다', async ({ page }) => {
  const s = await scene(page, KINDS[0][1], KINDS[0][2]);
  const w = await page.evaluate((R) => { const r = document.getElementById(R).getBoundingClientRect(); return [r.left + 2, r.bottom - 2]; }, s.R);
  await page.mouse.click(w[0], w[1]); await raf(page);
  expect(await selected(page)).toEqual([s.R]);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

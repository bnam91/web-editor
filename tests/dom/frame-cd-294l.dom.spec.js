/* frame-cd-294l — J294L 축 D 재현. 조작 = 진짜 마우스·키, 자리 차림만 앱 함수.
 * 자: dataset.offsetX/Y · style.width(레이아웃 값, 배율 무관) · selected. 화면 px 를 숫자와 견주지 않는다.
 * test.fail = 지금 깨져 있는 칸. 고쳐지면 이 표시가 빨강이 되니 그때 뗀다.
 * ⛔안 재는 것: 시간(축 C 값은 격리 앱에서만 뜻이 있다, ~/.gd-work/j294l2), 파일 저장, 보호 섹션 프레임 삭제(회신 LOSS2, srv 워커1 몫). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const J = require('./_frame-judge-294.js');
const FR = '.frame-block:not([data-text-frame])';

async function scene(page) {
  await page.setViewportSize({ width: 1800, height: 1500 });
  await bootApp(page);
  const ids = await page.evaluate(async (FR) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block');
    const add = (par, w, h, l, t) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const id = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)).id; return { id, par, w, h, l, t }; };
    const R = add(null, 800, 900); const A = add(R.id, 400, 420, 20, 20); const G = add(A.id, 300, 200, 40, 40);
    for (const n of [R, A, G]) { const f = document.getElementById(n.id); window.updateFrameBlock(n.id, { width: n.w, height: n.h }); if (n.par) { f.style.left = n.l + 'px'; f.style.top = n.t + 'px'; f.dataset.offsetX = n.l; f.dataset.offsetY = n.t; } }
    window.deselectAll(); window._activeFrame = null; window.clearHistory?.();
    return { R: R.id, A: A.id, G: G.id };
  }, FR);
  await J.reopen(page); await page.evaluate(J.PAGE_LIB); await page.evaluate(J.EYE_LIB); await J.settle(page);
  return ids;
}
const pickA = (page, ids) => J.select(page, ids.A, 1, { chain: [ids.R] });
const pickG = (page, ids) => J.select(page, ids.G, 2, { chain: [ids.R, ids.A] });
const offs = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return [e.dataset.offsetX, e.dataset.offsetY].map(Number); }, id);
const styleW = (page, id) => page.evaluate((id) => document.getElementById(id).style.width, id);
const isSel = (page, id) => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id);
async function rotateA(page, ids, deg) { await pickA(page, ids); const i = await page.$('#ss-rotate-deg'); await i.fill(String(deg)); await i.press('Enter'); await J.settle(page); await page.evaluate(() => document.activeElement?.blur?.()); }
async function dragG(page, ids) { await dragFrom(page, await J.ownPoint(page, ids.G)); }
const pointOn = (page, id, fx, fy) => page.evaluate(({ id, fx, fy }) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width * fx, r.top + r.height * fy]; }, { id, fx, fy });
const ownerAt = (page, p) => page.evaluate(({ p, FR }) => document.elementFromPoint(p[0], p[1])?.closest(FR)?.id, { p, FR });
async function dragFrom(page, p) { await page.mouse.move(p[0], p[1]); await page.mouse.down(); await page.mouse.move(p[0] + 30, p[1] + 20, { steps: 10 }); await J.settle(page); await page.mouse.up(); await J.settle(page); }
async function setWidthA(page, ids, v) { await pickA(page, ids); const i = await page.$('#ss-width-num'); await i.fill(String(v)); await i.press('Enter'); await page.evaluate(() => document.activeElement?.blur?.()); await J.settle(page); }
async function handleShrinkA(page, ids) {
  await pickA(page, ids);
  const h = await page.evaluate(() => { const x = [...document.querySelectorAll('.ss-resize-handle')].find((n) => n.getBoundingClientRect().width > 0 && /\bse\b/.test(n.className)); const q = x.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await page.mouse.move(h[0], h[1]); await page.mouse.down(); await page.mouse.move(h[0] - 150, h[1], { steps: 12 }); await page.mouse.up(); await J.settle(page);
}

test('음성: 회전 없는 프레임 안 G 는 끌리고 선택이 그대로다', async ({ page }) => {
  const ids = await scene(page); expect((await pickG(page, ids)).sel).toBe(true);
  const g0 = await offs(page, ids.G); await dragG(page, ids); const g1 = await offs(page, ids.G);
  expect(g1[0]).toBeGreaterThan(g0[0]); expect(g1[1]).toBeGreaterThan(g0[1]); expect(await isSel(page, ids.G)).toBe(true);
});
test('음성: 30도 돈 프레임 안 G 를 G 위에서 잡아 끌면 G 가 움직이고 선택이 남는다', async ({ page }) => {
  const ids = await scene(page); await rotateA(page, ids, 30); expect((await pickG(page, ids)).sel).toBe(true);
  const p = await pointOn(page, ids.G, 0.5, 0.5); expect(await ownerAt(page, p)).toBe(ids.G);
  const g0 = await offs(page, ids.G); await dragFrom(page, p); expect(await offs(page, ids.G)).not.toEqual(g0); expect(await isSel(page, ids.G)).toBe(true);
});
test('D-회전: 90도 돈 프레임 안 G 를 오른쪽 끝에서 잡아 끌어도 선택이 G 에 남는다', async ({ page }) => {
  const ids = await scene(page); await rotateA(page, ids, 90); expect((await pickG(page, ids)).sel).toBe(true);
  const p = await pointOn(page, ids.G, 0.85, 0.5); expect(await ownerAt(page, p)).toBe(ids.G);
  await dragFrom(page, p); expect(await isSel(page, ids.G)).toBe(true);
  expect(await page.evaluate((a) => document.getElementById(a).classList.contains('selected'), ids.A), '부모는 안 남는다').toBe(false);
});
test('음성: 끌고 놓은 다음의 진짜 클릭은 삼키지 않는다 — 곧바로 다른 프레임을 누르면 그쪽이 골라진다', async ({ page }) => {
  const ids = await scene(page); await rotateA(page, ids, 90); await pickG(page, ids);
  const p = await pointOn(page, ids.G, 0.85, 0.5); await dragFrom(page, p);
  const q = await J.ownPoint(page, ids.R); await page.mouse.click(q[0], q[1]); await J.settle(page);
  expect(await isSel(page, ids.R)).toBe(true);
});
test('음성: 폭을 입력칸으로 줄였다 되늘리면 자식 폭이 돌아온다', async ({ page }) => {
  const ids = await scene(page); await setWidthA(page, ids, 100); await setWidthA(page, ids, 400);
  expect(await styleW(page, ids.G)).toBe('300px'); expect((await offs(page, ids.G))[0]).toBe(40);
});
test('D-축소: 손잡이로 줄였다 입력칸으로 되늘려도 자식 폭이 그대로다', async ({ page }) => {
  const ids = await scene(page); await handleShrinkA(page, ids); await setWidthA(page, ids, 400);
  expect(await styleW(page, ids.G)).toBe('300px'); expect(await page.evaluate((id) => document.getElementById(id).style.left, ids.G)).toBe('40px');
});
test('음성 D-축소: 손잡이로 줄인 뒤 입력칸 200 은 곧바로 200 넣은 것과 같은 비율이다, 또 줄여도 부풀지 않는다', async ({ page }) => {
  const ids = await scene(page); await handleShrinkA(page, ids); await setWidthA(page, ids, 200);
  expect(await styleW(page, ids.G)).toBe('150px'); expect(await page.evaluate((id) => document.getElementById(id).style.left, ids.G)).toBe('20px');
  await setWidthA(page, ids, 400);
  expect(await styleW(page, ids.G)).toBe('300px');
});
test('음성 D-축소: 다시 열어도 기준이 남고, 되늘린 뒤 ⌘Z 로 돌아온다', async ({ page }) => {
  const ids = await scene(page); await handleShrinkA(page, ids); await J.reopen(page); await J.settle(page); await page.evaluate(J.PAGE_LIB); await page.evaluate(J.EYE_LIB);
  await setWidthA(page, ids, 400);
  expect(await styleW(page, ids.G)).toBe('300px');
  await page.keyboard.press('Meta+z'); await J.settle(page);
  expect(await styleW(page, ids.G)).toBe('300px');
});
test('D-축소: 손잡이로 줄인 것은 ⌘Z 한 번에 돌아온다', async ({ page }) => {
  const ids = await scene(page); await handleShrinkA(page, ids);
  await page.keyboard.press('Meta+z'); await J.settle(page);
  expect(await styleW(page, ids.A)).toBe('400px'); expect(await styleW(page, ids.G)).toBe('300px');
});

async function addJokerIn(page, ids) {
  await page.evaluate((f) => { const sec = document.getElementById(f).closest('.section-block'); window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(f); const b4 = new Set(document.querySelectorAll('.joker-block')); window.addJokerBlock(); const e = [...document.querySelectorAll('.joker-block')].find((x) => !b4.has(x)); e.dataset.jk = '1'; window.deselectAll(); window._activeFrame = null; e.scrollIntoView({ block: 'center' }); }, ids.G);
  await J.settle(page);
}
const joker = (page) => page.evaluate((FR) => { const e = document.querySelector('[data-jk]'); const r = e.getBoundingClientRect(); const f = e.parentElement.closest(FR); const q = f.getBoundingClientRect(); return { par: f.id, sel: e.classList.contains('selected'), x: q.left + q.width / 2, y: q.top + q.height / 2, off: [e.dataset.offsetX, e.dataset.offsetY].map(Number), rx: r.left, ry: r.top }; }, FR);
async function pickJoker(page) { for (let i = 0; i < 6; i++) { const w = await joker(page); if (w.sel) return w; await page.mouse.click(w.x, w.y); await J.settle(page); } return joker(page); }
for (const [name, hx, hy] of [['오른쪽 아래', 40, 16], ['왼쪽 위', -40, -16], ['오른쪽 조금 더', 60, 20]]) {
  test(`B-9 프레임보다 큰 조커를 ${name}로 끌면 손 쪽으로 가고 프레임에 남는다`, async ({ page }) => {
    const ids = await scene(page); await addJokerIn(page, ids);
    const a = await pickJoker(page); expect(a.sel, '[전제] 고름').toBe(true);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + hx, a.y + hy, { steps: 10 }); await J.settle(page); await page.mouse.up(); await J.settle(page);
    const b = await joker(page);
    expect(b.par).toBe(ids.G);
    expect(Math.sign(b.off[0] - a.off[0])).toBe(Math.sign(hx)); expect(Math.sign(b.off[1] - a.off[1])).toBe(Math.sign(hy));
    expect(Math.sign(b.rx - a.rx)).toBe(Math.sign(hx)); expect(Math.sign(b.ry - a.ry)).toBe(Math.sign(hy));
  });
}
test('음성 B-9: 큰 조커도 정말 멀리 끌면 프레임에서 빠지고, 안 사라지며, ⌘Z 로 돌아온다', async ({ page }) => {
  const ids = await scene(page); await addJokerIn(page, ids);
  const a = await pickJoker(page); expect(a.sel, '[전제] 고름').toBe(true);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + 300, a.y, { steps: 10 }); await J.settle(page); await page.mouse.up(); await J.settle(page);
  const st = () => page.evaluate((FR) => { const l = document.querySelectorAll('[data-jk]'); return [l.length, l[0]?.parentElement.closest(FR)?.id || null]; }, FR);
  expect(await st()).toEqual([1, null]);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await J.settle(page);
  expect(await st()).toEqual([1, ids.G]);
});
test('음성 B-9: 프레임보다 작은 표는 전과 같이 멀리 끌면 프레임에서 빠진다', async ({ page }) => {
  const ids = await scene(page);
  await page.evaluate((f) => { const sec = document.getElementById(f).closest('.section-block'); window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(f); const b4 = new Set(document.querySelectorAll('.table-block')); window.addTableBlock(); const e = [...document.querySelectorAll('.table-block')].find((x) => !b4.has(x)); e.dataset.jk = '1'; window.deselectAll(); window._activeFrame = null; e.scrollIntoView({ block: 'center' }); }, ids.G); await J.settle(page);
  const a = await pickJoker(page); expect(a.sel, '[전제] 고름').toBe(true);
  const p = await page.evaluate(() => { const r = document.querySelector('[data-jk]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(p[0], p[1]); await page.mouse.down(); await page.mouse.move(p[0] - 500, p[1] - 300, { steps: 14 }); await J.settle(page); await page.mouse.up(); await J.settle(page);
  expect(await page.evaluate((FR) => document.querySelector('[data-jk]').parentElement.closest(FR)?.id || null, FR)).toBe(null);
});

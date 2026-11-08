/* frame-single-dup-offset-295 — 현빈 0.9.10 FRAME-SINGLE-DUP-OVERLAPS-ORIGINAL-01: 자유 프레임 안 프레임 사본은 +20 으로 비켜 복사된 걸 알아본다.
 * 칸: D1 단건 ⌘D · D2 ⌘D ⌘D 계단 · C1 ⌘C ⌘V ⌘V 계단 · E1 부모 끝자리에서도 안 겹침 · G1 묶음 → 형제 C → ⌘V 첫째 +20·상대 배치 유지
 *     N1 [음성] 맨 위 프레임 ⌘D 흐름 — 좌표 없음 · N2 [음성] 스택 프레임 안 자식 ⌘D — 좌표 없음
 * 양성대조: _stepPastedFreeChild 호출 둘을 걷으면 D1·D2·C1·E1·G1 빨강 · N1·N2 초록. 장면 준비만 evaluate — 고르기·키는 진짜. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const FR = '.frame-block:not([data-text-frame])';
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1400 }); const errs = await bootApp(page);
  const ids = await page.evaluate(async (FR) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const add = (par, w, h, l, t) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.updateFrameBlock(f.id, { width: w, height: h }); if (par) { f.style.left = l + 'px'; f.style.top = t + 'px'; f.dataset.offsetX = l; f.dataset.offsetY = t; } window.deselectAll(); window._activeFrame = null; return f.id; };
    const P = add(null, 860, 500); const A = add(P, 240, 160, 20, 20); const B = add(P, 240, 160, 300, 20); const C = add(P, 240, 160, 580, 20); const E = add(P, 200, 120, 660, 380);
    const X = add(null, 860, 200); const K = add(X, 240, 100, 0, 0); const xf = document.getElementById(X); delete xf.dataset.freeLayout; const kf = document.getElementById(K); kf.style.position = ''; kf.style.left = ''; kf.style.top = ''; delete kf.dataset.offsetX; delete kf.dataset.offsetY;
    window.deselectAll(); window.clearHistory?.(); document.getElementById(P).scrollIntoView({ block: 'center' }); return { P, A, B, C, E, X, K }; }, FR);
  await page.waitForFunction(() => { const t = document.getElementById('canvas-scaler')?.style.transform; const same = t === window.__zt; window.__zt = t; return same; }, null, { polling: 150 });   // 첫 맞춤 줌이 자리 잡을 때까지
  await page.evaluate((P) => document.getElementById(P).scrollIntoView({ block: 'center' }), ids.P); await raf(page); return { errs, ...ids };
}
const pos = (page) => page.evaluate((FR) => Object.fromEntries([...document.querySelectorAll('#canvas ' + FR)].map((f) => [f.id, { par: f.parentElement.closest(FR)?.id || null, at: [f.style.position, f.style.left, f.style.top], off: [f.dataset.offsetX, f.dataset.offsetY], prev: f.previousElementSibling?.id || null }])), FR);
/* 자리 비율로 누른다 — 좌표 px 를 안 박아 배율을 안 탄다 */
const clickAt = async (page, id, fx, fy, mod, dbl) => { const r = await page.evaluate((id) => { const q = document.getElementById(id).getBoundingClientRect(); return [q.left, q.top, q.width, q.height]; }, id); if (mod) await page.keyboard.down(mod); if (dbl) await page.mouse.dblclick(r[0] + r[2] * fx, r[1] + r[3] * fy); else await page.mouse.click(r[0] + r[2] * fx, r[1] + r[3] * fy); if (mod) await page.keyboard.up(mod); await raf(page); };
const isSel = (page, id) => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id);
const pick = async (page, P, kid) => { await clickAt(page, P, 0.5, 0.6); await clickAt(page, kid, 0.5, 0.5, null, true);   /* B안(현빈 261107): 자식은 더블클릭 진입(옛: 한 번 클릭 드릴인) */ expect(await isSel(page, kid), '[전제] 자식 고름').toBe(true); };
const fresh = async (page, before, n) => { await expect.poll(async () => Object.keys(await pos(page)).filter((i) => !before[i]).length, '[전제] 사본 수').toBe(n); const now = await pos(page); return { now, ids: Object.keys(now).filter((i) => !before[i]) }; };
const count = (page) => page.evaluate((FR) => document.querySelectorAll('#canvas ' + FR).length, FR);

test('D1 단건 ⌘D — 같은 부모 안 +20 · 좌표 값 둘이 같다 · 원본 그대로', async ({ page }) => {
  const { errs, P, A } = await scene(page); const s0 = await pos(page);
  await pick(page, P, A); await page.keyboard.press('Meta+d');
  const { now, ids } = await fresh(page, s0, 1);
  expect(now[ids[0]]).toMatchObject({ par: P, at: ['absolute', '40px', '40px'], off: ['40', '40'] });
  expect(now[A].at, '원본').toEqual(['absolute', '20px', '20px']);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('D2 ⌘D ⌘D — 사본에서 다시 +20 계단', async ({ page }) => {
  const { errs, P, A } = await scene(page); const s0 = await pos(page);
  await pick(page, P, A); await page.keyboard.press('Meta+d'); await fresh(page, s0, 1); await page.keyboard.press('Meta+d');
  const { now, ids } = await fresh(page, s0, 2);
  expect(ids.map((i) => now[i].at[1]).sort(), '두 사본 자리').toEqual(['40px', '60px']);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('C1 ⌘C ⌘V ⌘V — 같은 클립보드라도 안 겹치고 계단', async ({ page }) => {
  const { errs, P, A } = await scene(page); const s0 = await pos(page);
  await pick(page, P, A); await page.keyboard.press('Meta+c');
  const n = await count(page);
  await page.keyboard.press('Meta+v'); await page.waitForFunction(([FR, n]) => document.querySelectorAll('#canvas ' + FR).length === n, [FR, n + 1]);
  await page.keyboard.press('Meta+v'); await page.waitForFunction(([FR, n]) => document.querySelectorAll('#canvas ' + FR).length === n, [FR, n + 2]);
  const { now, ids } = await fresh(page, s0, 2);
  expect(ids.map((i) => now[i].at.slice(1).join()).sort(), '두 사본 자리').toEqual(['40px,40px', '60px,60px']);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('E1 부모 끝자리 자식 ⌘D — 프레임 안에 있고 원본과 안 겹친다', async ({ page }) => {
  const { errs, P, E } = await scene(page); const s0 = await pos(page);
  await pick(page, P, E); await page.keyboard.press('Meta+d');
  const { now, ids } = await fresh(page, s0, 1);
  expect(now[ids[0]].par).toBe(P);
  expect(now[ids[0]].at.slice(1).join(), '원본 자리 아님').not.toBe(now[E].at.slice(1).join());
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('G1 자식 둘 ⌘C → 형제 C → ⌘V — 첫째 +20 · 상대 배치 유지 · C 다음 자리', async ({ page }) => {
  const { errs, P, A, B, C } = await scene(page); const s0 = await pos(page);
  await pick(page, P, A); await clickAt(page, B, 0.5, 0.5, 'Shift'); expect(await isSel(page, B), '[전제] 둘 고름').toBe(true);
  await page.keyboard.press('Meta+c'); await clickAt(page, C, 0.5, 0.5); expect(await isSel(page, C), '[전제] C 고름').toBe(true);
  const n = await count(page); await page.keyboard.press('Meta+v'); await page.waitForFunction(([FR, n]) => document.querySelectorAll('#canvas ' + FR).length === n, [FR, n + 2]);
  const { now, ids } = await fresh(page, s0, 2);
  const first = ids.find((i) => now[i].prev === C);
  expect(first, 'C 다음 자리').toBeTruthy();
  expect(now[first].at, '첫째').toEqual(['absolute', '40px', '40px']);
  expect(now[ids.find((i) => i !== first)].at, '둘째 = 원본 간격 유지').toEqual(['absolute', '320px', '40px']);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('N1 [음성] 맨 위 프레임 ⌘D — 흐름 자리는 좌표가 없다', async ({ page }) => {
  const { errs, X } = await scene(page); const s0 = await pos(page);
  await clickAt(page, X, 0.8, 0.8); expect(await isSel(page, X), '[전제] X 고름').toBe(true); await page.keyboard.press('Meta+d');
  const { now, ids } = await fresh(page, s0, 2);   // X + 자식 K
  const root = ids.find((i) => now[i].par === null);
  expect(now[root].at).toEqual(['', '', '']);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('N2 [음성] 스택 프레임 안 자식 ⌘D — 흐름 자리는 좌표가 없다', async ({ page }) => {
  const { errs, X, K } = await scene(page); const s0 = await pos(page);
  await page.evaluate((K) => document.getElementById(K).scrollIntoView({ block: 'center' }), K); await raf(page);
  await pick(page, X, K); await page.keyboard.press('Meta+d');
  const { now, ids } = await fresh(page, s0, 1);
  expect(now[ids[0]]).toMatchObject({ par: X, at: ['', '', ''] });
  expect(errs, errs.join(' | ')).toEqual([]);
});

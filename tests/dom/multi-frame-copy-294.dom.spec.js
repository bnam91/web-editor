/* multi-frame-copy-294 — 프레임 여럿을 골라 ⌘D·⌘C⌘V 하면 고른 것들이 복사된다(294 t9-03 · J294G).
 * 음성: 프레임 하나 ⌘D 는 +부분나무 하나 · 부모가 다른 조합은 값만(설계 물음 · 회신). */
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
  for (let i = 0, last = null; i < 40; i++) { const t = await page.evaluate(() => document.getElementById('canvas-scaler')?.style.transform); if (t === last) break; last = t; await page.waitForTimeout(150); }   // 첫 맞춤 줌이 자리 잡을 때까지
  await page.evaluate((P) => document.getElementById(P).scrollIntoView({ block: 'center' }), ids.P); await raf(page); return { errs, ...ids };
}
const box = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, id);
const clk = async (page, x, y, mod) => { if (mod) await page.keyboard.down(mod); await page.mouse.click(x, y); if (mod) await page.keyboard.up(mod); await raf(page); };
async function pickKids(page, { P, A, B }) { const p = await box(page, P); await clk(page, (p.l + p.r) / 2, p.b - 12); const a = await box(page, A); await clk(page, (a.l + a.r) / 2, (a.t + a.b) / 2 + 10); const b = await box(page, B); await clk(page, (b.l + b.r) / 2, (b.t + b.b) / 2, 'Shift'); const sel = await page.evaluate(([A, B]) => [A, B].map((i) => document.getElementById(i).classList.contains('selected')), [A, B]); expect(sel, '[전제] 자식 둘 고름').toEqual([true, true]); }
for (const [name, act] of [['⌘D', (p) => p.keyboard.press('Meta+d')], ['⌘C⌘V', async (p) => { await p.keyboard.press('Meta+c'); await p.keyboard.press('Meta+v'); }]]) {
  test(`자식 둘 ${name} — 고른 둘만 같은 부모 안에 +20 · 부모는 복사 안 됨 · ⌘Z 한 번에 처음`, async ({ page }) => {
    const { errs, P, A, G, B } = await scene(page); const s0 = await read(page);
    await pickKids(page, { P, A, B }); await act(page); await raf(page);
    const s1 = await read(page); const fresh = s1.ids.filter((i) => !s0.ids.includes(i));
    expect(fresh.length, '새 프레임 = A 부분나무 2 + B 1').toBe(3);
    expect(new Set(s1.ids).size, 'id 겹침 없음').toBe(s1.ids.length);
    const roots = fresh.filter((i) => !fresh.includes(s1.par[i]));
    expect(roots.map((i) => s1.par[i]), '사본 부모 = 원본 부모').toEqual([P, P]);
    expect(roots.map((i) => s1.pos[i]), '단건 ⌘D 처럼 +20').toEqual([['absolute', '40px', '40px'], ['absolute', '320px', '40px']]);
    for (const i of s0.ids) expect(s1.par[i], `원본 ${i}`).toBe(s0.par[i]);
    await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z'); await raf(page);
    const s2 = await read(page); expect(s2.ids, '⌘Z 한 번').toEqual(s0.ids);
    expect(G).toBeTruthy(); expect(errs, errs.join(' | ')).toEqual([]);
  });
}
test('자식 둘 Delete — 고른 둘만 지워진다 · 부모·형제 그대로 · ⌘Z 처음', async ({ page }) => {
  const { errs, P, A, G, B, C } = await scene(page); const s0 = await read(page);
  await pickKids(page, { P, A, B }); await page.keyboard.press('Delete'); await raf(page);
  const s1 = await read(page); expect(s1.ids.includes(P), '부모 남음').toBe(true); expect(s1.ids.includes(C), '형제 남음').toBe(true); expect(s1.ids.includes(A) || s1.ids.includes(B) || s1.ids.includes(G), '고른 둘 지워짐').toBe(false);
  await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z'); await raf(page); expect((await read(page)).ids, '⌘Z').toEqual(s0.ids);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('보호 섹션에서 자식 둘 Delete — 아무것도 안 지워진다', async ({ page }) => {
  const { errs, P, A, B } = await scene(page); const s0 = await read(page);
  await pickKids(page, { P, A, B });
  await page.evaluate((P) => { const o = window.isSectionProtected; window.isSectionProtected = (s) => s === document.getElementById(P).closest('.section-block') || (o ? o(s) : false); }, P);
  await page.keyboard.press('Delete'); await raf(page);
  expect((await read(page)).ids, '그대로').toEqual(s0.ids); expect(errs, errs.join(' | ')).toEqual([]);
});
test('자식 둘 ⌘C ⌘V ⌘V — 사본이 안 겹친다', async ({ page }) => {
  const { errs, P, A, B } = await scene(page); const s0 = await read(page);
  await pickKids(page, { P, A, B }); await page.keyboard.press('Meta+c'); await page.keyboard.press('Meta+v'); await raf(page); await page.keyboard.press('Meta+v'); await raf(page);
  const s1 = await read(page); const roots = s1.ids.filter((i) => !s0.ids.includes(i) && s1.par[i] === P); const at = roots.map((i) => s1.pos[i].join());
  expect(new Set(at).size, '자리 넷').toBe(4); expect(errs, errs.join(' | ')).toEqual([]);
});
test('그룹 자식 전부 Delete — 빈 그룹이 안 남는다', async ({ page }) => {
  const { errs, X, Y } = await scene(page);
  await page.evaluate((X) => document.getElementById(X).scrollIntoView({ block: 'center' }), X); await raf(page);
  const x = await box(page, X); await clk(page, (x.l + x.r) / 2, (x.t + x.b) / 2); const y = await box(page, Y); await clk(page, (y.l + y.r) / 2, (y.t + y.b) / 2, 'Meta'); await page.keyboard.press('Meta+g'); await raf(page);
  const g = await page.evaluate((X) => document.getElementById(X).parentElement.id, X);
  expect(await page.evaluate((g) => document.getElementById(g).dataset.group, g), '[전제] 묶임').toBe('true');
  await page.evaluate(([X, Y]) => { window.deselectAll(); const s = document.getElementById(X).closest('.section-block'); s.classList.add('selected'); document.getElementById(X).classList.add('selected'); document.getElementById(Y).classList.add('selected'); }, [X, Y]);
  await page.keyboard.press('Delete'); await raf(page);
  expect(await page.evaluate((g) => !!document.getElementById(g), g), '빈 그룹 없음').toBe(false); expect(errs, errs.join(' | ')).toEqual([]);
});
test('자식 둘 ⌘X⌘V — 부모가 안 사라지고 둘이 그 부모 안 +20 으로 돌아온다', async ({ page }) => {
  const { errs, P, A, B, C } = await scene(page);
  await pickKids(page, { P, A, B }); await page.keyboard.press('Meta+x'); await raf(page);
  const s1 = await read(page); expect(s1.ids.includes(P), '잘라도 부모 남음').toBe(true); expect(s1.ids.includes(A), 'A 잘림').toBe(false);
  await page.keyboard.press('Meta+v'); await raf(page);
  const s2 = await read(page); const fresh = s2.ids.filter((i) => !s1.ids.includes(i)); const roots = fresh.filter((i) => !fresh.includes(s2.par[i]));
  expect(roots.map((i) => s2.par[i]), '부모 안').toEqual([P, P]); expect(roots.map((i) => s2.pos[i][0]), 'absolute').toEqual(['absolute', 'absolute']);
  expect(C).toBeTruthy(); expect(errs, errs.join(' | ')).toEqual([]);
});
test('프레임 둘 ⌘C → 다른 섹션 클릭 → ⌘V — 고른 섹션에 붙는다', async ({ page }) => {
  const { errs, X, Y } = await scene(page);
  await page.evaluate((X) => document.getElementById(X).scrollIntoView({ block: 'center' }), X); await raf(page);
  const x = await box(page, X); await clk(page, (x.l + x.r) / 2, (x.t + x.b) / 2); const y = await box(page, Y); await clk(page, (y.l + y.r) / 2, (y.t + y.b) / 2, 'Meta'); await page.keyboard.press('Meta+c');
  const secId = await page.evaluate(async () => { await window.addSection(); const s = [...document.querySelectorAll('#canvas .section-block')].pop(); window.deselectAll(); window.selectSection(s); window._activeFrame = null; return s.id; }); await raf(page); await page.waitForTimeout(100);
  await page.keyboard.press('Meta+v'); await raf(page);
  const n = await page.evaluate(([id, FR]) => document.getElementById(id).querySelectorAll(FR).length, [secId, FR]); expect(n, '고른 섹션에 둘').toBe(2);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('맨 위 프레임 둘 ⌘D — 둘 다 복사된다 · 흐름', async ({ page }) => {
  const { errs, X, Y } = await scene(page); const s0 = await read(page);
  await page.evaluate((X) => document.getElementById(X).scrollIntoView({ block: 'center' }), X); await raf(page);
  const x = await box(page, X); await clk(page, (x.l + x.r) / 2, (x.t + x.b) / 2); const y = await box(page, Y); await clk(page, (y.l + y.r) / 2, (y.t + y.b) / 2, 'Meta');
  await page.keyboard.press('Meta+d'); await raf(page);
  const s1 = await read(page); const fresh = s1.ids.filter((i) => !s0.ids.includes(i));
  expect(fresh.length, '둘').toBe(2); expect(fresh.map((i) => s1.par[i]), '맨 위').toEqual([null, null]); expect(fresh.map((i) => s1.pos[i][0]), '흐름').toEqual(['', '']);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('음성 — 프레임 하나 ⌘D 는 하나(부분나무) · 부모가 다른 조합은 값만', async ({ page }) => {
  const { errs, P, A, B, X } = await scene(page); const s0 = await read(page);
  const p = await box(page, P); await clk(page, (p.l + p.r) / 2, p.b - 12); const a = await box(page, B); await clk(page, (a.l + a.r) / 2, (a.t + a.b) / 2);
  await page.keyboard.press('Meta+d'); await raf(page); const s1 = await read(page); const f1 = s1.ids.filter((i) => !s0.ids.includes(i)); expect(f1.length, '하나').toBe(1); expect(s1.par[f1[0]], '같은 부모').toBe(P);
  await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z'); await raf(page);
  const p2 = await box(page, P); await clk(page, (p2.l + p2.r) / 2, p2.b - 12); const a2 = await box(page, A); await clk(page, (a2.l + a2.r) / 2, (a2.t + a2.b) / 2 + 10); await page.evaluate((X) => document.getElementById(X).scrollIntoView({ block: 'center' }), X); await raf(page); const x = await box(page, X); await clk(page, (x.l + x.r) / 2, (x.t + x.b) / 2, 'Meta');
  const n0 = (await read(page)).ids.length; await page.keyboard.press('Meta+d'); await raf(page); const s3 = await read(page); console.log('V3 다른 부모 ⌘D 새 프레임 ' + (s3.ids.length - n0));
  expect(new Set(s3.ids).size, 'id 겹침 없음').toBe(s3.ids.length); expect(errs, errs.join(' | ')).toEqual([]);
});

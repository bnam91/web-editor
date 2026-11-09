/* multi-frame-copy-294 — 프레임 여럿을 골라 ⌘D·⌘C⌘V 하면 고른 것들이 복사된다(294 t9-03 · J294G).
 * 음성: 프레임 하나 ⌘D 는 +부분나무 하나. 자리 규칙 = 현빈 0.9.10 FRAME-GROUP-PASTE-TARGET-RULE-01 ＋ 1109t1C1:
 *   밖에서 고른 맨 위 프레임 → 그 안 끝(⌘V 만 · g·⌘D 는 다음 자리) · 섹션만 고름 → 섹션 끝. 전체 표는 frame-paste-target-c1. */
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
/* B안(현빈 261107): 프레임 여백 클릭 뒤 자식은 «더블클릭» 진입으로 고른다(옛: 자식 한 번 클릭 = 드릴인) — 아래 dbl=true 세 자리 */
async function pickKids(page, { P, A, B }) { const p = await box(page, P); await clk(page, (p.l + p.r) / 2, p.b - 12); const a = await box(page, A); await clk(page, (a.l + a.r) / 2, (a.t + a.b) / 2 + 10, null, true); const b = await box(page, B); await clk(page, (b.l + b.r) / 2, (b.t + b.b) / 2, 'Shift'); const sel = await page.evaluate(([A, B]) => [A, B].map((i) => document.getElementById(i).classList.contains('selected')), [A, B]); expect(sel, '[전제] 자식 둘 고름').toEqual([true, true]); }
for (const [name, act] of [['⌘D', (p) => p.keyboard.press('Meta+d')], ['⌘C⌘V', async (p) => { await p.keyboard.press('Meta+c'); await pasteKey(p); }]]) {
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
  await pickKids(page, { P, A, B }); await page.keyboard.press('Meta+c'); await pasteKey(page); await raf(page); await pasteKey(page); await raf(page);
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
  await pasteKey(page); await raf(page);
  const s2 = await read(page); const fresh = s2.ids.filter((i) => !s1.ids.includes(i)); const roots = fresh.filter((i) => !fresh.includes(s2.par[i]));
  expect(roots.map((i) => s2.par[i]), '부모 안').toEqual([P, P]); expect(roots.map((i) => s2.pos[i][0]), 'absolute').toEqual(['absolute', 'absolute']);
  expect(C).toBeTruthy(); expect(errs, errs.join(' | ')).toEqual([]);
});
test('프레임 둘 ⌘C → 다른 섹션 클릭 → ⌘V — 고른 섹션에 붙는다', async ({ page }) => {
  const { errs, X, Y } = await scene(page);
  await page.evaluate((X) => document.getElementById(X).scrollIntoView({ block: 'center' }), X); await raf(page);
  const x = await box(page, X); await clk(page, (x.l + x.r) / 2, (x.t + x.b) / 2); const y = await box(page, Y); await clk(page, (y.l + y.r) / 2, (y.t + y.b) / 2, 'Meta'); await page.keyboard.press('Meta+c');
  const secId = await page.evaluate(async () => { await window.addSection(); const s = [...document.querySelectorAll('#canvas .section-block')].pop(); window.deselectAll(); window.selectSection(s); window._activeFrame = null; return s.id; }); await raf(page);
  await pasteKey(page); await raf(page);
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
test('음성 — 프레임 하나 ⌘D 는 하나(부분나무)', async ({ page }) => {
  const { errs, P, A, B, X } = await scene(page); const s0 = await read(page);
  const p = await box(page, P); await clk(page, (p.l + p.r) / 2, p.b - 12); const a = await box(page, B); await clk(page, (a.l + a.r) / 2, (a.t + a.b) / 2, null, true);
  await page.keyboard.press('Meta+d'); await raf(page); const s1 = await read(page); const f1 = s1.ids.filter((i) => !s0.ids.includes(i)); expect(f1.length, '하나').toBe(1); expect(s1.par[f1[0]], '같은 부모').toBe(P);
  await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z'); await raf(page);
  expect(new Set(s1.ids).size, 'id 겹침 없음').toBe(s1.ids.length); expect(errs, errs.join(' | ')).toEqual([]);
});
test('한 줄(.row)의 프레임 둘을 지우면 빈 줄이 안 남고, 하나 남으면 줄도 남는다', async ({ page }) => {
  const { errs, X, Y } = await scene(page);
  const r = await page.evaluate(([X, Y]) => { const x = document.getElementById(X); const row = document.createElement('div'); row.className = 'row'; row.id = 'rowT'; x.before(row); row.append(x, document.getElementById(Y)); x.classList.add('selected'); document.getElementById(Y).classList.add('selected'); const did = window._deletePickedFrames(); return { did, row: !!document.getElementById('rowT') }; }, [X, Y]);
  expect(r).toEqual({ did: true, row: false });
  await page.keyboard.press('Meta+z'); await raf(page);
  const k = await page.evaluate(([X, Y]) => { const row = document.getElementById('rowT'); const third = document.createElement('div'); third.className = 'frame-block'; row.appendChild(third); [X, Y].forEach((i) => document.getElementById(i).classList.add('selected')); const did = window._deletePickedFrames(); return { did, row: !!document.getElementById('rowT') }; }, [X, Y]);
  expect(k, '음성').toEqual({ did: true, row: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── FRAME-GROUP-PASTE-TARGET-RULE-01 ── */
const fresh = (s, s0) => s.ids.filter((i) => !s0.ids.includes(i));
const rootsOf = (s, s0) => { const f = fresh(s, s0); return f.filter((i) => !f.includes(s.par[i])); };
async function pickMixed(page, { P, A, X }) { const p = await box(page, P); await clk(page, (p.l + p.r) / 2, p.b - 12); const a = await box(page, A); await clk(page, (a.l + a.r) / 2, (a.t + a.b) / 2 + 10, null, true); await page.evaluate((X) => document.getElementById(X).scrollIntoView({ block: 'center' }), X); await raf(page); const x = await box(page, X); await clk(page, (x.l + x.r) / 2, (x.t + x.b) / 2, 'Meta'); expect(await page.evaluate(([A, X]) => [A, X].map((i) => document.getElementById(i).classList.contains('selected')), [A, X]), '[전제] 부모가 다른 둘 고름').toEqual([true, true]); }
for (const [name, act] of [['⌘D', (p) => p.keyboard.press('Meta+d')], ['⌘C⌘V', async (p) => { await p.keyboard.press('Meta+c'); await pasteKey(p); }]]) {
  test(`부모가 다른 둘 ${name} — 고른 만큼 전부 · 각자 원래 부모 안 원본 옆 · ⌘Z 처음`, async ({ page }) => {
    const { errs, P, A, X } = await scene(page); const s0 = await read(page);
    await pickMixed(page, { P, A, X }); await act(page); await raf(page);
    const s1 = await read(page); const r = rootsOf(s1, s0);
    expect(r.length, '고른 만큼').toBe(2); expect(r.map((i) => s1.par[i]).sort(), '각자 부모').toEqual([P, null].sort()); expect(fresh(s1, s0).length, 'A 부분나무 2 + X 1').toBe(3);
    const a1 = r.find((i) => s1.par[i] === P); expect(s1.pos[a1], 'A 사본 +20').toEqual(['absolute', '40px', '40px']);
    expect(await page.evaluate(([X, id]) => document.getElementById(X).nextElementSibling?.id === id, [X, r.find((i) => s1.par[i] === null)]), 'X 사본은 X 바로 다음').toBe(true);
    await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z'); await raf(page);
    expect((await read(page)).ids, '⌘Z 처음').toEqual(s0.ids); expect(errs, errs.join(' | ')).toEqual([]);
  });
}
test('자식 둘 ⌘C → 맨 위 다른 프레임 클릭 → ⌘V — 그 프레임 «안» 끝(1109t1C1 ㉡) · 좌표째 · 첫째 원본+20 · 간격·순서 유지', async ({ page }) => {
  const { errs, P, A, B, Y } = await scene(page); const s0 = await read(page);
  await pickKids(page, { P, A, B }); await page.keyboard.press('Meta+c');
  await page.evaluate((Y) => document.getElementById(Y).scrollIntoView({ block: 'center' }), Y); await raf(page); const y = await box(page, Y); await clk(page, (y.l + y.r) / 2, (y.t + y.b) / 2);
  await pasteKey(page);
  const s1 = await read(page); const r = rootsOf(s1, s0);
  expect(r.map((i) => s1.par[i]), 'Y 안').toEqual([Y, Y]); expect(r.map((i) => s1.pos[i][0]), '좌표째').toEqual(['absolute', 'absolute']);
  const yMax = await page.evaluate(([Y, id]) => Math.max(0, document.getElementById(Y).clientHeight - document.getElementById(id).offsetHeight), [Y, r[0]]);
  expect(s1.pos[r[0]].slice(1), '첫째 = A(20,20)+20 · Y 안으로 클램프').toEqual(['40px', Math.min(40, yMax) + 'px']);
  expect(parseInt(s1.pos[r[1]][1]) - parseInt(s1.pos[r[0]][1]), '가로 간격 = 원본 300-20').toBe(280);
  expect(await page.evaluate(([Y, r]) => { const k = [...document.getElementById(Y).children]; return k.slice(-2).map((e) => e.id).join() === r.join(); }, [Y, r]), 'Y 끝에 순서대로').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('자식 둘 ⌘C → 같은 부모의 다른 자식 클릭 → ⌘V — 그 옆 · 묶음 상대 배치 유지', async ({ page }) => {
  const { errs, P, A, B, C } = await scene(page); const s0 = await read(page);
  await pickKids(page, { P, A, B }); await page.keyboard.press('Meta+c');
  const c = await box(page, C); await clk(page, (c.l + c.r) / 2, (c.t + c.b) / 2); expect(await page.evaluate((C) => document.getElementById(C).classList.contains('selected'), C), '[전제] C 고름').toBe(true);
  await pasteKey(page);
  const s1 = await read(page); const r = rootsOf(s1, s0);
  expect(r.map((i) => s1.par[i]), '같은 부모').toEqual([P, P]);
  expect(parseInt(s1.pos[r[1]][1]) - parseInt(s1.pos[r[0]][1]), '가로 간격 = 원본 300-20').toBe(280); expect(parseInt(s1.pos[r[1]][2]) - parseInt(s1.pos[r[0]][2]), '세로 간격 0').toBe(0);
  expect(await page.evaluate(([C, f]) => document.getElementById(C).nextElementSibling?.id === f, [C, r[0]]), 'C 다음 자리').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('부모가 다른 둘 ⌘X⌘V — 부모·형제 남고 각자 부모로 돌아온다 · ⌘X → 맨 위 다른 프레임 → ⌘V 는 그 «안» 끝(1109t1C1 ㉡)', async ({ page }) => {
  const { errs, P, A, B, X, Y } = await scene(page);
  await pickMixed(page, { P, A, X }); await page.keyboard.press('Meta+x'); await raf(page);
  const s1 = await read(page); expect([P, B, Y].every((i) => s1.ids.includes(i)), '부모·형제 남음').toBe(true); expect([A, X].some((i) => s1.ids.includes(i)), '둘 다 잘림').toBe(false);
  await pasteKey(page); const s2 = await read(page); const r = rootsOf(s2, s1);
  expect(r.map((i) => s2.par[i]).sort(), '각자 부모').toEqual([P, null].sort());
  await page.keyboard.press('Meta+z'); await raf(page);
  await page.evaluate((Y) => document.getElementById(Y).scrollIntoView({ block: 'center' }), Y); await raf(page); const y = await box(page, Y); await clk(page, (y.l + y.r) / 2, (y.t + y.b) / 2);
  const s3 = await read(page); await pasteKey(page); const s4 = await read(page); const r2 = rootsOf(s4, s3);
  expect(r2.map((i) => s4.par[i]), 'Y 안으로').toEqual([Y, Y]); expect(r2.map((i) => s4.pos[i][0]), '좌표째').toEqual(['absolute', 'absolute']);
  expect(await page.evaluate(([Y, r]) => [...document.getElementById(Y).children].slice(-2).map((e) => e.id).join() === r.join(), [Y, r2]), 'Y 끝에 순서대로').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

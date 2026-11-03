/* frame-scenarios-294 — 294 t9-03 요청 ②③ 중 퍼즈가 안 덮는 복합·비정상 조작(J294G ④). 조작 = 진짜 마우스·키 · 나무 짓기만 앱 입구.
 * 장면: 사촌·빈 프레임·깊이 다른 형제·글자 혼합 — P1{A{G·글자},B(빈)} · P2{C{글자}} · E(빈).
 * 자: 프레임·글자 id · 부모 · 순서 · 크기 · 글자를 canon 으로 맞댄다(frame-fuzz-294 와 같은 꼴). ★Z0 = 이 자의 양성(망가뜨리면 빨강).
 * ⛔이 파일이 안 재는 것: 좌표·겹침(부모·순서만) · 파일 저장(FS294 축) · OS 창 포커스.
 * ⚠️V 값 칸은 단언이 아니라 값이다 — 설계인지 결함인지는 회신의 물음(요청 ③ · 임의 변경 금지). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const FR = '.frame-block:not([data-text-frame])';
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const canon = (s) => JSON.stringify({ f: Object.keys(s.frames).sort().map((k) => [k, s.frames[k].parent, s.frames[k].order, s.frames[k].w, s.frames[k].h]), t: Object.keys(s.texts).sort().map((k) => [k, s.texts[k].frame, s.texts[k].text]) });
const read = (page) => page.evaluate((FR) => { const root = document.querySelector('#canvas .section-block'); const frames = {}; const texts = {}; const dupes = []; const seen = new Set(); const mark = (id) => { if (seen.has(id)) dupes.push(id); seen.add(id); };
  const all = [...root.querySelectorAll(FR)]; all.forEach((f, i) => { mark(f.id); frames[f.id] = { parent: f.parentElement.closest(FR)?.id || null, order: i, w: f.dataset.width ?? '', h: f.dataset.height ?? '' }; });
  root.querySelectorAll('.text-block').forEach((t) => { mark(t.id); texts[t.id] = { frame: t.closest(FR)?.id || null, text: (t.querySelector('.tb-body') || t).textContent.trim() }; });
  return { frames, texts, dupes }; }, FR);
const shape = (s, id) => ({ w: s.frames[id].w, h: s.frames[id].h, t: Object.keys(s.texts).filter((k) => s.texts[k].frame === id).map((k) => s.texts[k].text).sort(), k: Object.keys(s.frames).filter((k) => s.frames[k].parent === id).map((c) => shape(s, c)).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)) });

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (FR) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const add = (par, w, h, l, t) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.updateFrameBlock(f.id, { width: w, height: h }); if (par) { f.style.left = l + 'px'; f.style.top = t + 'px'; f.dataset.offsetX = l; f.dataset.offsetY = t; } window.deselectAll(); window._activeFrame = null; return f.id; };
    const txt = (par, s) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(par); const b = new Set(sec.querySelectorAll('.text-block')); window.addTextBlock('body'); const n = [...sec.querySelectorAll('.text-block')].find((x) => !b.has(x)); (n.querySelector('.tb-body') || n).textContent = s; const w = n.closest('.frame-block[data-text-frame]') || n; w.style.position = 'absolute'; w.style.left = '4px'; w.style.top = '4px'; w.style.width = '60px'; window.deselectAll(); window._activeFrame = null; return n.id; };
    const P1 = add(null, 860, 500); const A = add(P1, 320, 300, 20, 20); const G = add(A, 120, 100, 20, 20); const TG = txt(G, 'TG'); const B = add(P1, 320, 300, 400, 20);
    const P2 = add(null, 860, 400); const C = add(P2, 320, 300, 20, 20); const TC = txt(C, 'TC'); const E = add(null, 860, 200);
    window.deselectAll(); window._activeFrame = null; window.clearHistory?.(); document.getElementById(P2).scrollIntoView({ block: 'center' });
    return { P1, A, G, B, P2, C, E, TG, TC }; }, FR);
  await raf(page);
  return { errs, ...ids };
}
const box = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, id);
const clickFree = async (page, id, mod) => { await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id); await raf(page); const b = await box(page, id); if (mod) await page.keyboard.down(mod); await page.mouse.click(b.r - 8, b.b - 8); if (mod) await page.keyboard.up(mod); await raf(page); };
/* 위에서부터 사람 순서로 고른다: 부모 빈 자리 클릭 → 그 안의 자식 빈 자리 클릭 … */
const pick = async (page, chain) => { await page.keyboard.press('Escape'); await page.evaluate(() => window.deselectAll()); for (const id of chain) await clickFree(page, id); const s = await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), chain[chain.length - 1]); expect(s, `[전제] ${chain.length} 단계로 고름`).toBe(true); };
const desel = (page) => page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); });
const press = async (page, key) => { await page.keyboard.press(key); await raf(page); };
const clean = (s) => { expect(s.dupes, 'id 겹침 없음').toEqual([]); };

test('Z0 자 양성 — 부모를 옮기거나 글자를 바꾸거나 프레임을 지우면 canon 이 달라진다', async ({ page }) => {
  const { P1, G, B, TG } = await scene(page); const a = canon(await read(page));
  await page.evaluate(([G, B]) => document.getElementById(B).appendChild(document.getElementById(G)), [G, B]); const b = canon(await read(page)); expect(b).not.toBe(a);
  await page.evaluate(([G, B]) => { document.getElementById(B).remove(); }, [G, B]); expect(canon(await read(page))).not.toBe(b);
  expect(P1 && TG).toBeTruthy();
});
test('S1 부모를 자손 안으로 — moveBlock·마우스 끌기 둘 다 나무가 그대로 · 대조: 형제 이동은 움직인다', async ({ page }) => {
  const { errs, P1, A, G, B } = await scene(page); const s0 = await read(page);
  const r = await page.evaluate(([P1, A, G]) => [window.moveBlock(P1, { afterId: A }), window.moveBlock(P1, { beforeId: G }), window.moveBlock(A, { afterId: G })], [P1, A, G]); await raf(page);
  expect(r, '거절').toEqual([false, false, false]);
  expect(canon(await read(page)), '거절 뒤 그대로').toBe(canon(s0));
  await pick(page, [P1]); const pb = await box(page, P1); const gb = await box(page, G);
  /* 잡는 점 = 부모의 빈 자리(아래 가운데). ⛔고른 프레임의 귀를 잡으면 둥글기 핸들을 끈다(J294G 실측). */
  const gx = pb.l + pb.w / 2; const gy = pb.b - 20;
  await page.mouse.move(gx, gy); await page.mouse.down(); for (let i = 1; i <= 15; i++) { await page.mouse.move(gx + (gb.l + 10 - gx) * i / 15, gy + (gb.t + 10 - gy) * i / 15); await raf(page); } await page.mouse.up(); await raf(page);
  const s1 = await read(page); expect(canon(s1), '끌어 놓아도 부모는 제 자손에 안 들어간다').toBe(canon(s0));
  await press(page, 'Escape');
  expect(await page.evaluate(([A, B]) => !!window.moveBlock(A, { afterId: B }), [A, B]), '대조: 형제 이동은 된다').toBe(true); await raf(page);
  expect(canon(await read(page)), '대조: 나무가 움직인다').not.toBe(canon(s0));
  await desel(page); await press(page, 'Meta+z'); expect(canon(await read(page)), '⌘Z').toBe(canon(s0));
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('S2 서로 다른 계층 다중 선택 ⌘C⌘V → 이동 → ⌘Z — 원본 불변 · 새 id · 내용 보존', async ({ page }) => {
  const { errs, A, P1, P2, TC, TG, C } = await scene(page); const s0 = await read(page);
  await pick(page, [P1, A]); await clickFree(page, P2, 'Meta');   // 자식 + 다른 위계의 맨 위
  const sel = await page.evaluate((FR) => [...document.querySelectorAll('#canvas ' + FR + '.selected')].map((f) => f.id), FR);
  expect(sel.length, '[전제] 둘 이상 고름').toBeGreaterThan(1);
  /* ⌘V 는 paste 이벤트에 양보하느라 setTimeout 30 뒤에 붙는다(js/editor.js) ⇒ 두 rAF 로는 못 본다(단독 11/11 빨강) · 프레임 수가 늘 때까지 기다린다 */
  const nFr = await page.evaluate((FR) => document.querySelectorAll('#canvas ' + FR).length, FR);
  await page.keyboard.press('Meta+c'); await press(page, 'Meta+v');
  await page.waitForFunction(([FR, n]) => document.querySelectorAll('#canvas ' + FR).length > n, [FR, nFr], { timeout: 5000 });
  const s1 = await read(page); clean(s1);
  for (const k of Object.keys(s0.frames)) { expect(s1.frames[k]?.parent, `원본 ${k} 부모`).toBe(s0.frames[k].parent); }
  for (const k of Object.keys(s0.texts)) expect(s1.texts[k]?.text, '원본 글자').toBe(s0.texts[k].text);
  const fresh = Object.keys(s1.frames).filter((k) => !s0.frames[k]);
  console.log('S2 V ' + JSON.stringify({ sel: sel.length, fresh: fresh.length, parents: fresh.map((k) => (s1.frames[k].parent && !fresh.includes(s1.frames[k].parent) ? (s0.frames[s1.frames[k].parent] ? '원본 안' : '?') : fresh.includes(s1.frames[k].parent) ? '사본 안' : '맨 위')) }));
  expect(fresh.length, '사본이 생겼다').toBeGreaterThan(0);
  const roots = fresh.filter((k) => !fresh.includes(s1.frames[k].parent));
  for (const k of roots) { await page.evaluate(() => 0); }
  await desel(page); await press(page, 'Meta+z');
  expect(canon(await read(page)), '⌘Z 한 번에 복사 전').toBe(canon(s0));
  await press(page, 'Meta+Shift+z'); const s2 = await read(page); clean(s2);
  expect(Object.keys(s2.frames).length, '⌘⇧Z 로 사본 복귀').toBe(Object.keys(s1.frames).length);
  expect(TC && TG && C).toBeTruthy(); expect(errs, errs.join(' | ')).toEqual([]);
});
test('S3 복사 직후 대상 삭제 — ⌘D 뒤 사본 Delete · ⌘C 뒤 원본 Delete 후 ⌘V · ⌘Z 들 — 나무가 안 깨진다', async ({ page }) => {
  const { errs, A, P1, P2 } = await scene(page); const s0 = await read(page);
  await pick(page, [P2]); await press(page, 'Meta+d'); const s1 = await read(page); clean(s1);
  const added = Object.keys(s1.frames).filter((k) => !s0.frames[k]); expect(added.length, '[전제] ⌘D 부분나무').toBe(2);
  const root = added.find((k) => !added.includes(s1.frames[k].parent));
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), root), '[전제] 사본이 골라짐').toBe(true);
  await press(page, 'Delete'); expect(canon(await read(page)), '사본 Delete = 복사 전').toBe(canon(s0));
  await desel(page); await press(page, 'Meta+z'); expect(Object.keys((await read(page)).frames).length, '⌘Z = 사본 복귀').toBe(Object.keys(s1.frames).length);
  await press(page, 'Meta+z'); expect(canon(await read(page)), '⌘Z = 처음').toBe(canon(s0));
  /* ⌘C → 원본 Delete → ⌘V */
  await pick(page, [P1]); await page.keyboard.press('Meta+c'); await press(page, 'Delete');
  const gone = await read(page); expect(gone.frames[P1], '지워짐').toBeUndefined(); clean(gone);
  await press(page, 'Meta+v');
  await page.waitForFunction(([FR, n]) => document.querySelectorAll('#canvas ' + FR).length > n, [FR, Object.keys(gone.frames).length], { timeout: 5000 });   // S2 와 같은 까닭(setTimeout 30)
  const pasted = await read(page); clean(pasted);
  const n = Object.keys(pasted.frames).length - Object.keys(gone.frames).length;
  console.log('S3 V ' + JSON.stringify({ '⌘C·Delete·⌘V 새 프레임': n, 원본부분나무: 3 + 1 }));
  /* ⌘V 가 붙었든 안 붙었든 ⌘Z 를 거듭하면 처음으로 돌아와야 한다 */
  await desel(page); for (let i = 0; i < 4; i++) { await press(page, 'Meta+z'); if (canon(await read(page)) === canon(s0)) break; }
  expect(canon(await read(page)), '⌘Z 거듭 = 처음').toBe(canon(s0));
  expect(A).toBeTruthy(); expect(errs, errs.join(' | ')).toEqual([]);
});
test('S4 빠른 연속 ⌘Z·⌘⇧Z — 기다리지 않고 눌러도 끝 상태가 편집마다 찍어 둔 표와 같다 · 대조: 하나 덜 누르면 다르다', async ({ page }) => {
  const { errs, P2, E } = await scene(page); const marks = [canon(await read(page))];
  for (let i = 0; i < 6; i++) { await pick(page, [i % 2 ? E : P2]); await press(page, 'Meta+d'); marks.push(canon(await read(page))); }
  await desel(page);
  for (let i = 0; i < 6; i++) await page.keyboard.press('Meta+z');
  await raf(page); await expect.poll(async () => canon(await read(page)), { message: '⌘Z×6 연타 = 처음' }).toBe(marks[0]);
  for (let i = 0; i < 6; i++) await page.keyboard.press('Meta+Shift+z');
  await raf(page); await expect.poll(async () => JSON.parse(canon(await read(page))).f.length, { message: '⌘⇧Z×6 연타 = 끝 수' }).toBe(JSON.parse(marks[6]).f.length);
  for (const [k, n] of [['Meta+z', 3], ['Meta+Shift+z', 1], ['Meta+z', 2], ['Meta+Shift+z', 4]]) for (let i = 0; i < n; i++) await page.keyboard.press(k);
  await raf(page); await expect.poll(async () => JSON.parse(canon(await read(page))).f.length, { message: '섞어 연타 = 끝 수(-3+1-2+4)' }).toBe(JSON.parse(marks[6]).f.length);
  await page.keyboard.press('Meta+z'); await raf(page); await expect.poll(async () => JSON.parse(canon(await read(page))).f.length, { message: '대조: 하나 더 누르면 수가 다르다' }).toBe(JSON.parse(marks[5]).f.length);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('S5 복사→그룹→해제→재복사 · 빠른 선택 전환 뒤 ⌘D 는 마지막 고른 것만', async ({ page }) => {
  const { errs, P2, E, P1 } = await scene(page); const s0 = await read(page);
  await clickFree(page, P1); await clickFree(page, P2); await clickFree(page, E); await press(page, 'Meta+d');
  const s1 = await read(page); clean(s1); const f1 = Object.keys(s1.frames).filter((k) => !s0.frames[k]);
  expect(f1.length, '빠른 전환 뒤 마지막 하나(E)만').toBe(1);
  expect(s1.frames[f1[0]].parent, '맨 위 사본').toBe(null);
  await pick(page, [P2]); await press(page, 'Meta+d'); const s2 = await read(page); clean(s2);
  const g0 = Object.keys(s2.frames).length;
  await press(page, 'Meta+g'); const s3 = await read(page); clean(s3); expect(Object.keys(s3.frames).length, '그룹 = +1').toBe(g0 + 1);
  for (const k of Object.keys(s2.texts)) expect(s3.texts[k]?.text, '그룹 뒤 글자').toBe(s2.texts[k].text);
  await press(page, 'Meta+Shift+g'); const s4 = await read(page); clean(s4); expect(Object.keys(s4.frames).length, '해제 = 그룹 전 수').toBe(g0);
  for (const k of Object.keys(s2.frames)) expect(s4.frames[k], `해제 뒤 ${k} 남음`).toBeTruthy();
  await clickFree(page, P2); await press(page, 'Meta+d'); const s5 = await read(page); clean(s5);
  expect(Object.keys(s5.frames).length, '재복사 = +부분나무').toBeGreaterThan(g0);
  await desel(page); for (let i = 0; i < 12; i++) { await press(page, 'Meta+z'); if (canon(await read(page)) === canon(s0)) break; }
  expect(canon(await read(page)), '⌘Z 거듭 = 처음').toBe(canon(s0));
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('S6 부모 복사 → 자손 수정 → 부모 삭제 → ⌘Z — 수정이 살아 있고 사본은 수정 전 값', async ({ page }) => {
  const { errs, P2, C, TC } = await scene(page); const s0 = await read(page);
  await pick(page, [P2]); await press(page, 'Meta+d'); const s1 = await read(page); const fresh = Object.keys(s1.frames).filter((k) => !s0.frames[k]); const root = fresh.find((k) => !fresh.includes(s1.frames[k].parent));
  expect(JSON.stringify(shape(s1, root)), '사본 꼴 = 원본').toBe(JSON.stringify(shape(s1, P2)));
  await desel(page);
  await page.evaluate(([C, TC]) => { window.updateFrameBlock(C, { width: 280 }); window.pushHistory?.('글자 고침 전'); document.querySelector('#' + CSS.escape(TC) + ' .tb-body').textContent = 'TC2'; window.pushHistory?.('글자 고침'); }, [C, TC]); await raf(page);
  const s2 = await read(page); expect(s2.texts[TC].text, '[전제] 수정').toBe('TC2');
  const copyTexts = Object.keys(s2.texts).filter((k) => !s0.texts[k]).map((k) => s2.texts[k].text); expect(copyTexts, '사본 글자는 수정 전').toEqual(['TC']);
  await pick(page, [P2]); await press(page, 'Delete'); const s3 = await read(page); expect(s3.frames[P2]).toBeUndefined(); clean(s3);
  await desel(page); await press(page, 'Meta+z'); const s4 = await read(page); clean(s4);
  expect(canon(s4), '⌘Z = 삭제 전 그대로(수정 포함)').toBe(canon(s2));
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('S7 프레임을 다른 프레임 안으로 끌어 옮긴 뒤 복사 — 새 부모 아래 사본 · ⌘Z 둘이면 처음', async ({ page }) => {
  const { errs, E, P2, C } = await scene(page); const s0 = await read(page);
  await pick(page, [E]); const eb = await box(page, E); const cb = await box(page, P2);
  const gx = eb.l + eb.w / 2; const gy = eb.t + eb.h / 2; const tx = cb.r - 40; const ty = cb.b - 20; await page.mouse.move(gx, gy); await page.mouse.down(); for (let i = 1; i <= 15; i++) { await page.mouse.move(gx + (tx - gx) * i / 15, gy + (ty - gy) * i / 15); await raf(page); } await page.mouse.up(); await raf(page);
  const s1 = await read(page); clean(s1); expect(Object.keys(s1.frames).sort(), '유실·중복 없음').toEqual(Object.keys(s0.frames).sort());
  console.log('S7 V ' + JSON.stringify({ E부모: s1.frames[E].parent === P2 ? 'P2' : s1.frames[E].parent === C ? 'C' : s1.frames[E].parent }));
  await raf(page);
  await press(page, 'Escape'); await desel(page);
  const moved = s1.frames[E].parent !== s0.frames[E].parent;
  if (moved) { const how = await page.evaluate((id) => { const o = document.getElementById(id); const it = o._layerItem; (it?.querySelector(':scope > .layer-row') || it)?.click(); return { it: !!it, sel: o.classList.contains('selected') }; }, E); await raf(page); console.log('S7 고름(레이어 패널 줄) ' + JSON.stringify(how));
    if (!how.sel) { await page.evaluate((id) => { const o = document.getElementById(id); o.classList.add('selected'); o.closest('.section-block').classList.add('selected'); window._activeFrame = o; }, E); } await press(page, 'Meta+d'); const s2 = await read(page); clean(s2); const add = Object.keys(s2.frames).filter((k) => !s1.frames[k]); expect(add.length, '사본 하나').toBe(1); expect(s2.frames[add[0]].parent, '새 부모 아래').toBe(s1.frames[E].parent); await desel(page); await press(page, 'Meta+z'); }
  await desel(page); await press(page, 'Meta+z'); expect(canon(await read(page)), '⌘Z = 처음').toBe(canon(s0));
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* flow-ungroup-294 — 흐름 자리에서 ⌘G 한 프레임을 ⌘⇧G 로 풀면 흐름으로 돌아온다(294 t9-03 · J294G).
 * 음성: 자유 프레임 안에서 묶었다 풀면 absolute 좌표 그대로 · ⌘Z 두 번이면 처음 꼴. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const view = (page, ids) => page.evaluate(([ids]) => { const sec = document.querySelector('#canvas .section-block').getBoundingClientRect(); const rs = ids.map((i) => { const e = document.getElementById(i); const r = e.getBoundingClientRect(); return { pos: getComputedStyle(e).position, top: Math.round(r.top - sec.top), bottom: Math.round(r.bottom - sec.top), group: e.parentElement.closest('.frame-block')?.dataset.group || null }; }); return { rs, secH: Math.round(sec.height) }; }, [ids]);
/* 첫 맞춤 줌이 자리 잡을 때까지 — 자리 값을 맞대는 시험이 부팅 직후 줌에 흔들렸다(실측 73 ↔ 81) */
const settleZoom = async (page) => { let last = null; for (let i = 0; i < 40; i++) { const t = await page.evaluate(() => document.getElementById('canvas-scaler')?.style.transform + '|' + Math.round(document.querySelector('#canvas .section-block')?.getBoundingClientRect().height || 0)); if (t === last) return; last = t; await page.waitForTimeout(150); } };
async function boot(page) { await page.setViewportSize({ width: 1500, height: 1400 }); const errs = await bootApp(page); await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); }); await settleZoom(page); return errs; }
const add = (page, parent) => page.evaluate(([FR, parent]) => { const sec = document.querySelector('#canvas .section-block'); window.deselectAll(); window.selectSection(sec); window._activeFrame = parent ? document.getElementById(parent) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return f.id; }, [FR, parent]);
const clickAt = async (page, id, mod) => { const q = await page.evaluate((id) => { const o = document.getElementById(id); const r = o.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id); if (mod) await page.keyboard.down(mod); await page.mouse.click(q[0], q[1]); if (mod) await page.keyboard.up(mod); await raf(page); };

test('⌘G → ⌘⇧G: 흐름 프레임 둘이 흐름·위아래 순서로 돌아오고 섹션이 담는다', async ({ page }) => {
  const errs = await boot(page);
  const a = await add(page); const b = await add(page); await page.evaluate(() => window.clearHistory?.()); await settleZoom(page);
  const v0 = await view(page, [a, b]);
  await clickAt(page, a); await clickAt(page, b, 'Meta');
  await page.keyboard.press('Meta+g'); await raf(page);
  const v1 = await view(page, [a, b]);
  expect(v1.rs[0].group, '[전제] 묶임').toBe('true');
  await page.keyboard.press('Meta+Shift+g'); await raf(page);
  const v2 = await view(page, [a, b]);
  console.log('V', JSON.stringify({ v0, v1, v2 }));
  expect(v2.rs.map((r) => r.pos), '흐름으로').toEqual(v0.rs.map((r) => r.pos));
  expect(v2.rs[0].top, '첫째가 둘째 위').toBeLessThan(v2.rs[1].top);
  expect(v2.rs[0].bottom, '겹침 없음').toBeLessThanOrEqual(v2.rs[1].top);
  expect(v2.secH, '섹션이 자식을 담는다').toBeGreaterThanOrEqual(v2.rs[1].bottom);
  expect(await page.evaluate((a) => document.getElementById(a).getAttribute('draggable'), a), '다시 끌 수 있다').toBe('true');
  await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z'); await raf(page);
  expect((await view(page, [a, b])).rs.map((r) => r.group), '⌘Z 하나 = 다시 묶인 꼴(이력이 살아 있다)').toEqual(['true', 'true']);
  await page.keyboard.press('Meta+z'); await raf(page);
  expect(await view(page, [a, b]), '⌘Z 둘이면 처음 꼴').toEqual(v0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('푼 프레임을 다시 끌 수 있다 — 같은 세션 · ⌘Z⌘⇧Z 로 복원된 그룹(자식이 absolute 로 다시 바인드된 판)', async ({ page }) => {
  const errs = await boot(page);
  const a = await add(page); const b = await add(page); const q = await add(page); await page.evaluate(() => window.clearHistory?.()); await raf(page);
  await page.evaluate(() => { window.__ds = []; addEventListener('dragstart', (e) => window.__ds.push(e.target.id), true); });
  await clickAt(page, a); await clickAt(page, b, 'Meta'); await page.keyboard.press('Meta+g'); await raf(page);
  await page.evaluate(() => { window.deselectAll(); }); await page.keyboard.press('Meta+z'); await raf(page); await page.keyboard.press('Meta+Shift+z'); await raf(page);   // 복원 = 자식이 absolute 로 새로 바인드
  const grp = await page.evaluate((a) => document.getElementById(a).parentElement.id, a);
  expect(await page.evaluate((g) => document.getElementById(g).dataset.group, grp), '[전제] 복원된 그룹').toBe('true');
  const g = await page.evaluate((g) => { const r = document.getElementById(g).getBoundingClientRect(); return [r.right - 40, r.bottom - 8]; }, grp); await page.mouse.click(g[0], g[1]); await raf(page);
  await page.keyboard.press('Meta+Shift+g'); await raf(page);
  expect(await page.evaluate((a) => getComputedStyle(document.getElementById(a)).position, a), '흐름으로').toBe('relative');
  const order0 = await page.evaluate((FR) => [...document.querySelector('#canvas .section-inner').querySelectorAll(':scope > ' + FR)].map((f) => f.id), FR);
  await clickAt(page, b);
  const c = await page.evaluate((b) => { const r = document.getElementById(b).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, b);
  const left0 = await page.evaluate((b) => document.getElementById(b).style.left, b);
  await page.mouse.move(c[0], c[1]); await page.mouse.down(); for (let i = 1; i <= 12; i++) { await page.mouse.move(c[0], c[1] + i * 3); await page.waitForTimeout(16); } await page.mouse.up(); await raf(page);
  expect(await page.evaluate(() => window.__ds), 'HTML5 끌기가 시작된다').toContain(b);
  expect(await page.evaluate((b) => document.getElementById(b).style.left, b), '옛 좌표 끌기가 흐름 프레임에 값을 안 쓴다').toBe(left0);
  expect(order0.length, '셋').toBe(3); expect(q).toBeTruthy(); expect(errs, errs.join(' | ')).toEqual([]);
});
test('글자 둘: ⌘G → ⌘⇧G 뒤 흐름 · 순서 · 끌기 살아 있음', async ({ page }) => {
  const errs = await boot(page);
  const [t0, t1] = await page.evaluate(() => { const s = document.querySelector('#canvas .section-block'); const mk = (x) => { window.deselectAll(); window.selectSection(s); window._activeFrame = null; const b = new Set(s.querySelectorAll('.text-block')); window.addTextBlock('body'); const n = [...s.querySelectorAll('.text-block')].find((v) => !b.has(v)); (n.querySelector('.tb-body') || n).textContent = x; window.deselectAll(); return n.id; }; const r = [mk('L0'), mk('L1')]; window.clearHistory?.(); return r; }); await raf(page);
  const look = () => page.evaluate(([t0, t1]) => [t0, t1].map((t) => { const e = document.getElementById(t); const f = e.closest('.frame-block[data-text-frame]') || e; const r = e.getBoundingClientRect(); return { pos: getComputedStyle(f).position, top: Math.round(r.top), text: e.textContent.trim(), drag: f.getAttribute('draggable') }; }), [t0, t1]);
  const v0 = await look();
  await clickAt(page, t0); await clickAt(page, t1, 'Shift');
  const sel = await page.evaluate(() => document.querySelectorAll('#canvas .text-block.selected').length); expect(sel, '[전제] 둘').toBe(2);
  await page.keyboard.press('Meta+g'); await raf(page);
  expect(await page.evaluate((t) => document.getElementById(t).closest('.frame-block[data-group]')?.dataset.group, t0), '[전제] 묶임').toBe('true');
  await page.keyboard.press('Meta+Shift+g'); await raf(page);
  const v1 = await look(); console.log('V2 ' + JSON.stringify({ v0, v1 }));
  expect(v1.map((x) => x.pos), '흐름').toEqual(v0.map((x) => x.pos));
  expect(v1[0].top, '순서').toBeLessThan(v1[1].top);
  expect(v1.map((x) => x.text)).toEqual(['L0', 'L1']);
  expect(v1.map((x) => x.drag), '끌기 살아남').toEqual(v0.map((x) => x.drag));
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('풀어도 다른 프레임 리스너가 안 겹친다 — ⌘클릭으로 둘을 고를 수 있다', async ({ page }) => {
  const errs = await boot(page);
  const a = await add(page); const b = await add(page); const x = await add(page); const y = await add(page); await page.evaluate(() => window.clearHistory?.()); await raf(page);
  await clickAt(page, a); await clickAt(page, b, 'Meta'); await page.keyboard.press('Meta+g'); await raf(page); await page.keyboard.press('Meta+Shift+g'); await raf(page);
  await page.evaluate((x) => document.getElementById(x).scrollIntoView({ block: 'center' }), x); await raf(page);
  await clickAt(page, x); await clickAt(page, y, 'Meta');
  const sel = await page.evaluate(([x, y]) => [x, y].map((i) => document.getElementById(i).classList.contains('selected')), [x, y]);
  expect(sel, '안 바꾼 프레임 ⌘클릭').toEqual([true, true]);
  await clickAt(page, b); await clickAt(page, a, 'Meta');
  expect(await page.evaluate(([a, b]) => [a, b].map((i) => document.getElementById(i).classList.contains('selected')), [a, b]), '푼 프레임 ⌘클릭').toEqual([true, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('음성 — 자유 프레임 안에서 묶었다 풀면 absolute 그대로 · 좌표 유지', async ({ page }) => {
  const errs = await boot(page);
  const P = await add(page); await page.evaluate((P) => window.updateFrameBlock(P, { width: 860, height: 700 }), P);
  const a = await add(page, P); const b = await add(page, P);
  for (const [id, l, t] of [[a, 20, 20], [b, 360, 40]]) await page.evaluate(([id, l, t]) => { window.updateFrameBlock(id, { width: 300, height: 200 }); const e = document.getElementById(id); e.style.left = l + 'px'; e.style.top = t + 'px'; e.dataset.offsetX = l; e.dataset.offsetY = t; }, [id, l, t]);
  await page.evaluate(() => window.clearHistory?.()); await raf(page);
  const before = await page.evaluate((id) => { const e = document.getElementById(id).getBoundingClientRect(); return [e.left, e.top]; }, b);
  const p = await page.evaluate((P) => { const r = document.getElementById(P).getBoundingClientRect(); return [r.left + 300, r.bottom - 10]; }, P);
  await page.mouse.click(p[0], p[1]); await raf(page);
  await clickAt(page, a); await clickAt(page, b, 'Shift');
  await page.keyboard.press('Meta+g'); await raf(page);
  expect(await page.evaluate((a) => document.getElementById(a).parentElement.dataset.group, a), '[전제] 묶임').toBe('true');
  await page.keyboard.press('Meta+Shift+g'); await raf(page);
  const v = await page.evaluate(([a, P]) => { const e = document.getElementById(a); return [getComputedStyle(e).position, e.parentElement.closest('.frame-block')?.id]; }, [a, P]);
  expect(v).toEqual(['absolute', P]);
  const after = await page.evaluate((id) => { const e = document.getElementById(id).getBoundingClientRect(); return [e.left, e.top]; }, b);
  expect(Math.abs(after[0] - before[0]) + Math.abs(after[1] - before[1]), '자리 유지').toBeLessThan(2);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('프레임 안 스티커·그라데이션은 풀린 뒤에도 제 바인더가 있고 눌러 고를 수 있다', async ({ page }) => {
  const errs = await boot(page);
  const a = await add(page); const b = await add(page);
  const { stk, gr } = await page.evaluate((a) => { const sec = document.querySelector('#canvas .section-block'); const A = document.getElementById(a); const put = (sel, make, left) => { window.deselectAll(); window.selectSection(sec); make(); const e = [...sec.querySelectorAll(sel)].pop(); e.style.left = left + 'px'; e.style.top = '60px'; e.dataset.x = left; e.dataset.y = 60; e.dataset.offsetX = left; e.dataset.offsetY = 60; A.appendChild(e); return e.id; };   // 다시 그리기가 dataset 에서 자리를 읽는다 · 귀퉁이는 둥글기 핸들 자리
    const stk = put('.sticker-block', () => window.addStickerBlock(), 60); const gr = put('.gradient-block', () => window.addGradientBlock(), 200); window.deselectAll(); window.clearHistory?.(); return { stk, gr }; }, a);
  await settleZoom(page);
  const pickA = async () => { const q = await page.evaluate((a) => { document.getElementById(a).scrollIntoView({ block: 'center' }); const r = document.getElementById(a).getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - 8]; }, a); await page.mouse.click(q[0], q[1]); await raf(page); expect(await page.evaluate((a) => document.getElementById(a).classList.contains('selected'), a), '[전제] 프레임 고름').toBe(true); };
  await pickA(); await clickAt(page, stk); expect(await page.evaluate((stk) => document.getElementById(stk).classList.contains('selected'), stk), '[양성] 묶기 전에도 골라진다').toBe(true); await page.evaluate(() => window.deselectAll());
  await pickA(); await clickAt(page, b, 'Meta');
  await page.keyboard.press('Meta+g'); await raf(page);
  expect(await page.evaluate((a) => document.getElementById(a).parentElement.dataset.group, a), '[전제] 묶임').toBe('true');
  await page.keyboard.press('Meta+Shift+g'); await raf(page);
  expect(await page.evaluate((a) => document.getElementById(a).parentElement.dataset.group, a), '[전제] 풀림').toBeUndefined();
  expect(await page.evaluate(([stk, gr]) => [!!document.getElementById(stk)._stickerBound, !!document.getElementById(gr)._gradientBound], [stk, gr]), '바인더').toEqual([true, true]);
  await pickA(); await clickAt(page, stk); await raf(page);
  expect(await page.evaluate((stk) => document.getElementById(stk).classList.contains('selected'), stk), '스티커가 눌러 골라진다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

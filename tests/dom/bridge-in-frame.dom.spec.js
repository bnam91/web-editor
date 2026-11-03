/* bridge-in-frame — stack 프레임 안 브릿지가 저장·재오픈에 섹션 패딩만큼 안 넓어진다(600→744 이던 것).
 * 칸: B1 넣고 왕복 B2 프레임 패딩 40 B3 px 폭 B4 free↔stack 왕복 뒤 B5 깊이 2 D1~D4 끌어 넣기·내기는 놓자마자 재오픈 값 N1 [음성] 섹션 직속은 여전히 full-bleed N2 [음성] 자유 프레임 그대로 N3 [음성] 이미 넓게 저장된 옛 꼴은 그대로 N4 [음성] 다른 것을 끌어 넣어도 옛 꼴 그대로
 * 양성대조: applyBridgeFullBleed 가드를 '.frame-block[data-free-layout="true"]' 로 되돌리고 prop-page 가드를 걷으면 B1~B5 · N2 · N3 빨강, N1 초록. settleMovedBridge 를 걷으면 D1~D4 빨강. 왕복 = serializeProject → applyProjectData. 장면 준비만 evaluate. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const FR = '.frame-block:not([data-text-frame])';
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const reopen = async (page) => { await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); }); await raf(page); };
async function scene(page, { place = 'stack', pad = 0, w = 600 } = {}) {
  await page.setViewportSize({ width: 1500, height: 1400 }); const errs = await bootApp(page);
  const id = await page.evaluate(async ({ place, pad, w, FR }) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const within = (par, f, sel) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par; const b = new Set(sec.querySelectorAll(sel)); f(); const e = [...sec.querySelectorAll(sel)].find((x) => !b.has(x)); window._activeFrame = null; return e; };
    const frame = (par, width) => { const f = within(par, () => window.addFrameBlock({}), FR); window.updateFrameBlock(f.id, { width, height: 300 }); return f; };
    const stack = (f) => { within(f, () => window.addTextBlock('body', { content: '글자' }), '.text-block'); window.__convertFreeLayoutToStack(f); if (f.dataset.freeLayout) throw new Error('[전제] stack 이 안 됐다'); };
    let host = null;
    if (place !== 'section') { host = frame(null, w); if (place === 'deep') { const inner = frame(host, w - 60); stack(inner); inner.style.left = '0px'; inner.style.top = '400px'; inner.dataset.offsetX = '0'; inner.dataset.offsetY = '400'; const innerId = inner.id; stack(host); host = document.getElementById(innerId); /* 변환이 흐름 자식을 새로 묶어 노드가 바뀐다 */ } else if (place === 'stack') stack(host); }
    if (pad) { host.dataset.padX = String(pad); host.style.paddingLeft = host.style.paddingRight = pad + 'px'; }
    const b = within(host, () => window.addBridgeBlock(), '.bridge-block'); window.deselectAll(); window.clearHistory?.(); return b.id; }, { place, pad, w, FR });
  await raf(page); return { errs, id };
}
/* 진짜 끌기 장면 — 섹션 직속 · stack S · free G 에 브릿지 하나 */
async function dragScene(page, from) {
  await page.setViewportSize({ width: 1500, height: 1400 }); const errs = await bootApp(page);
  const i = await page.evaluate(async ({ from, FR }) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const within = (par, f, sel) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par; const b = new Set(sec.querySelectorAll(sel)); f(); const e = [...sec.querySelectorAll(sel)].find((x) => !b.has(x)); window._activeFrame = null; return e; };
    const frame = (w) => { const f = within(null, () => window.addFrameBlock({}), FR); window.updateFrameBlock(f.id, { width: w, height: 300 }); return f; };
    const S = frame(600); within(S, () => window.addTextBlock('body', { content: '글자' }), '.text-block'); window.__convertFreeLayoutToStack(S); const G = frame(600);
    const B = within({ section: null, stack: S, free: G }[from], () => window.addBridgeBlock(), '.bridge-block'); window.deselectAll(); window.clearHistory?.(); sec.scrollIntoView({ block: 'start' }); window.applyZoom(30); return { S: S.id, G: G.id, B: B.id }; }, { from, FR });
  await waitZoomSettled(page, 30); await raf(page); return { errs, ...i };
}
const STEPS = 12;
const centerOf = (page, id) => page.evaluate((id) => { const q = document.getElementById(id).getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, id);
const grab = async (page, id) => { const LIMIT = 4; for (let n = 0; n < LIMIT; n++) { const c = await centerOf(page, id); await page.mouse.click(c[0], c[1]); await raf(page); if (await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id)) return true; } return false; };
async function dragTo(page, id, t) { const a = await centerOf(page, id); await page.mouse.move(a[0], a[1]); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(a[0] + (t[0] - a[0]) * i / STEPS, a[1] + (t[1] - a[1]) * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }
const bottomOf = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - 8]; }, id);
const belowOf = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.bottom + 24]; }, id);
/* 놓은 값 = 재오픈 값 = 기대. ⌘Z 로 돌아온다 */
for (const [name, from, to, where] of [['D1 섹션 → stack', 'section', 'S', bottomOf], ['D2 섹션 → free', 'section', 'G', bottomOf], ['D3 stack → 섹션', 'stack', 'G', belowOf], ['D4 free → 섹션(좌표 끌기)', 'free', 'G', belowOf]]) test(`${name} — 놓자마자 재오픈과 같은 값`, async ({ page }) => {
  const s = await dragScene(page, from); const a = await read(page, s.B); expect(await grab(page, s.B), '[전제] 골랐다').toBe(true);
  await dragTo(page, s.B, await where(page, s[to])); const m = await read(page, s.B);
  const toFrame = name.includes('→ stack') || name.includes('→ free'); expect(m.inFrame, `[전제] 도착 ${JSON.stringify(m)}`).toBe(toFrame);
  if (toFrame) expect([m.w, m.x], '프레임 폭').toEqual([600, 0]); else expect(m.css, '섹션 full-bleed').toContain('calc');
  await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z'); await raf(page); const u = await read(page, s.B); expect([u.w, u.x, u.inFrame], '⌘Z').toEqual([a.w, a.x, a.inFrame]);
  await page.keyboard.press('Meta+Shift+z'); await raf(page); const r = await read(page, s.B); expect([r.w, r.x, r.inFrame], '⌘⇧Z').toEqual([m.w, m.x, m.inFrame]);
  await reopen(page); const o = await read(page, s.B); expect([o.w, o.x, o.inFrame], '재오픈').toEqual([m.w, m.x, m.inFrame]); expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
test('N4 [음성] 프레임에 다른 것을 끌어 넣어도 그 안 옛 꼴 브릿지는 그대로', async ({ page }) => {
  const s = await dragScene(page, 'stack'); await page.evaluate((id) => { const e = document.getElementById(id); e.style.marginLeft = '-72px'; e.style.marginRight = '-72px'; e.style.width = 'calc(100% + 144px)'; }, s.B); await raf(page); const a = await read(page, s.B);
  const tb = await page.evaluate(() => { const sec = document.querySelector('.section-block'); window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.asset-block')); window.addAssetBlock(); const e = [...sec.querySelectorAll('.asset-block')].find((x) => !b.has(x)); window.deselectAll(); e.scrollIntoView({ block: 'center' }); return e.id; }); await raf(page);
  expect(await grab(page, tb), '[전제] 골랐다').toBe(true); await dragTo(page, tb, await bottomOf(page, s.S)); expect(await page.evaluate(([t, S]) => document.getElementById(S).contains(document.getElementById(t)), [tb, s.S]), '[전제] 들어갔다').toBe(true);
  const b = await read(page, s.B); expect(b.css).toBe(a.css); expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
const read = (page, id) => page.evaluate(({ id, FR }) => { const e = document.getElementById(id), c = document.getElementById('canvas'), k = c.getBoundingClientRect().width / c.offsetWidth || 1, q = e.getBoundingClientRect(), h = e.parentElement.closest(FR)?.getBoundingClientRect() || c.getBoundingClientRect(); return { w: Math.round(q.width / k), x: Math.round((q.left - h.left) / k), inFrame: !!e.parentElement.closest(FR), css: e.style.width }; }, { id, FR });
for (const [name, opt] of [['B1 넣고 왕복', {}], ['B2 프레임 패딩 40', { pad: 40 }], ['B5 깊이 2', { place: 'deep' }]]) test(`${name} — 폭·자리 그대로`, async ({ page }) => {
  const { errs, id } = await scene(page, opt); const a = await read(page, id); expect(a.inFrame, '[전제]').toBe(true);
  await reopen(page); const b = await read(page, id); expect([b.w, b.x], `${JSON.stringify(a)} → ${JSON.stringify(b)}`).toEqual([a.w, a.x]);
  await reopen(page); const c = await read(page, id); expect([c.w, c.x], '두 번째 왕복').toEqual([a.w, a.x]); expect(errs, errs.join(' | ')).toEqual([]);
});
test('B3 px 폭 자식 — 왕복에도 그 폭', async ({ page }) => {
  const { errs, id } = await scene(page); await page.evaluate((id) => { const e = document.getElementById(id); e.style.width = '300px'; e.dataset.stackW = '300'; }, id); await raf(page); const a = await read(page, id); expect(a.w, '[전제]').toBe(300);
  await reopen(page); const b = await read(page, id); expect([b.w, b.css]).toEqual([300, '300px']); expect(errs, errs.join(' | ')).toEqual([]);
});
test('B4 free↔stack 왕복 뒤 재오픈 — 폭 그대로', async ({ page }) => {
  const { errs, id } = await scene(page); const a = await read(page, id);
  await page.evaluate((id) => { const f = document.getElementById(id).parentElement.closest('.frame-block'); window.deselectAll(); f.classList.add('selected'); window.showFrameProperties(f); }, id); await page.locator('#ss-to-free-btn').click(); await raf(page); expect(await page.evaluate((id) => !!document.getElementById(id).parentElement.closest('.frame-block').dataset.freeLayout, id), '[전제] free').toBe(true);
  await page.evaluate((id) => window.__convertFreeLayoutToStack(document.getElementById(id).parentElement.closest('.frame-block')), id); await raf(page); const m = await read(page, id); expect(m.w, '왕복 직후').toBe(a.w);
  await reopen(page); const b = await read(page, id); expect([b.w, b.x], JSON.stringify(b)).toEqual([a.w, m.x]); expect(errs, errs.join(' | ')).toEqual([]);
});
test('N1 [음성] 섹션 직속은 왕복에도 full-bleed', async ({ page }) => {
  const { errs, id } = await scene(page, { place: 'section' }); const a = await read(page, id); expect(a.css, '[전제] 넓혔다').toContain('calc');
  await reopen(page); const b = await read(page, id); expect([b.w, b.x, b.css]).toEqual([a.w, a.x, a.css]); expect(errs, errs.join(' | ')).toEqual([]);
});
test('N2 [음성] 자유 프레임 안 그대로', async ({ page }) => {
  const { errs, id } = await scene(page, { place: 'free' }); const a = await read(page, id); expect(a.inFrame, '[전제]').toBe(true);
  await reopen(page); const b = await read(page, id); expect([b.w, b.x]).toEqual([a.w, a.x]); expect(errs, errs.join(' | ')).toEqual([]);
});
test('N3 [음성] 이미 넓게 저장된 옛 꼴은 왕복에 안 바뀐다', async ({ page }) => {
  const { errs, id } = await scene(page); await page.evaluate((id) => { const e = document.getElementById(id); e.style.marginLeft = '-72px'; e.style.marginRight = '-72px'; e.style.width = 'calc(100% + 144px)'; }, id); await raf(page); const a = await read(page, id);
  await reopen(page); const b = await read(page, id); expect([b.w, b.x, b.css]).toEqual([a.w, a.x, a.css]); expect(errs, errs.join(' | ')).toEqual([]);
});

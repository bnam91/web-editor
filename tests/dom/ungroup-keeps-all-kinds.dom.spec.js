/* ungroup-keeps-all-kinds — ⌘G → ⌘⇧G 가 어느 종이든 자식을 잃지 않는다(UNGROUP-DROPS-SPEECH-BUBBLE-IN-FREE-FRAME-01).
 * 풀기가 absolute 자식만 꺼내고 그룹째 지워, 자유 프레임 안 말풍선(입구가 흐름으로 넣는다)이 사라졌다.
 * 명부 = 소스: js/editor.js SECTION_BLOCK_TYPE_SEL 의 종마다 입구 하나(ENTRY), 더해 프레임. 정본에 새 종이 늘면 K0 이 빨개진다.
 * 음성: absolute 자식은 자리·수 그대로. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const FR = '.frame-block:not([data-text-frame])';
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const ENTRY = { 'text-block': ['addTextBlock', ['body']], 'asset-block': ['addAssetBlock', []], 'gap-block': ['addGapBlock', []], 'icon-circle-block': ['addIconCircleBlock', []], 'icon-text-block': ['addIconTextBlock', []], 'icon-block': ['addIconifyBlock', ['', '', 64]], 'table-block': ['addTableBlock', []], 'label-group-block': ['addLabelGroupBlock', []], 'graph-block': ['addGraphBlock', []], 'divider-block': ['addDividerBlock', []], 'bridge-block': ['addBridgeBlock', []], 'grid-block': ['addGridBlock', []], 'infocard-block': ['addInfoCardBlock', []], 'innercard-block': ['addInnerCardBlock', []], 'modal-block': ['addModalBlock', []], 'shape-block': ['addShapeBlock', ['rectangle']], 'speech-bubble-block': ['addSpeechBubbleBlock', ['left']], 'banner02-block': ['addBanner02Block', []], 'comparison-block': ['addComparisonBlock', []], 'mockup-block': ['addMockupBlock', []], 'vector-block': ['addVectorBlock', ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>']], 'step-block': ['addStepBlock', []], 'joker-block': ['addJokerBlock', []], 'canvas-block': ['addCanvasBlock', []], 'chat-block': ['addChatBlock', []], 'coupon-block': ['addCouponBlock', []], 'quote-block': ['addQuoteBlock', []], 'radial-block': ['addRadialBlock', []], 'gradient-block': ['addGradientBlock', []], 'sticker-block': ['addStickerBlock', []], 'laurel-block': ['addLaurelBlock', []], 'zoom-block': ['addZoomBlock', []], 'qa-block': ['addQABlock', []] };
async function boot(page) { await page.setViewportSize({ width: 1500, height: 1400 }); return bootApp(page); }
/* 하네스 electronAPI 대역에 svgPresets 가 없다(앱 전수 pageerr 0) — 그 한 줄만 뺀다 */
const real = (errs) => errs.filter((e) => !/svgPresets/.test(e));
const build = (page, entry, args, depth) => page.evaluate(async ({ entry, args, depth, FR }) => {
  const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
  sec.querySelectorAll('.frame-block[data-text-frame]').forEach((t) => (t.closest('.row') || t).remove());
  const add = (par, w, h) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.updateFrameBlock(f.id, { width: w, height: h }); return f; };
  let host = add(null, 780, 900); if (depth === 2) host = add(host, 640, 600);
  window.deselectAll(); window.selectSection(sec); window._activeFrame = host; const SEL = window.SECTION_BLOCK_TYPE_SEL + ', ' + FR; const before = new Set(sec.querySelectorAll(SEL));
  await window[entry](...args);
  const el = [...sec.querySelectorAll(SEL)].find((x) => !before.has(x)); if (!el.id) el.id = 'blk_' + Math.random().toString(36).slice(2, 9);
  window._activeFrame = null; window.deselectAll(); window.clearHistory?.(); return { id: el.id, host: host.id, inHost: host.contains(el) };
}, { entry, args, depth, FR });
/* 고르기는 앱 안 함수로 — 칸마다 손 클릭 흔들림을 빼고 ⌘G·⌘⇧G 키만 잰다. 말풍선 칸은 아래 B1 이 진짜 클릭으로 간다 */
const selectIn = (page, id, host) => page.evaluate(({ id, host }) => { const e = document.getElementById(id); const sec = e.closest('.section-block'); window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(host); e.classList.add('selected'); }, { id, host });
const clickPick = async (page, id) => { await page.keyboard.press('Escape'); await page.evaluate((id) => { window.deselectAll(); window._activeFrame = null; document.getElementById(id).scrollIntoView({ block: 'center' }); }, id); await raf(page); const q = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id); for (let i = 0; i < 4; i++) { await page.mouse.dblclick(q[0], q[1]); /* B안(현빈 261107): 자식은 더블클릭으로 진입해야 잡힌다 — 한 번 클릭은 바깥 프레임 */ await raf(page); if (await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id)) return true; } return false; };
const state = (page, id) => page.evaluate(({ id }) => { const e = document.getElementById(id); const S = window.SECTION_BLOCK_TYPE_SEL; return { n: document.querySelectorAll('#canvas :is(' + S + ')').length, has: !!e, grp: !!e?.closest('.frame-block[data-group="true"]'), groups: document.querySelectorAll('#canvas .frame-block[data-group="true"]').length, pos: e ? getComputedStyle(e.closest('.frame-block[data-text-frame]') || e).position : null }; }, { id });
const reopen = (page) => page.evaluate(async () => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(d); window.clearHistory?.(); });

test('K0 명부가 정본과 같다 — 새 종이 늘면 여기에 입구를 더해 같이 잰다', async ({ page }) => {
  await boot(page);
  const canon = await page.evaluate(() => window.SECTION_BLOCK_TYPE_SEL.split(',').map((s) => s.trim().slice(1)).sort());
  expect(Object.keys(ENTRY).sort()).toEqual(canon);
});
for (const depth of [1, 2]) test(`K1 깊이 ${depth} 자유 프레임: 묶이는 종 전부 ⌘G→⌘⇧G 뒤 수·존재·저장 왕복`, async ({ page }) => {
  test.setTimeout(240000);
  const errs = await boot(page); const lost = []; let grouped = 0;
  for (const [cls, [entry, args]] of Object.entries(ENTRY)) {
    const b = await build(page, entry, args, depth); await raf(page); await selectIn(page, b.id, b.host);
    const s0 = await state(page, b.id); await page.keyboard.press('Meta+g'); await raf(page); const s1 = await state(page, b.id);
    if (!s1.grp) continue; grouped++;
    await page.keyboard.press('Meta+Shift+g'); await raf(page); const s2 = await state(page, b.id);
    if (s2.groups !== 0) { lost.push(cls + ' 안 풀림'); continue; }
    if (!s2.has || s2.n !== s0.n) { lost.push(`${cls} ${s0.n}→${s2.n}`); continue; }
    await reopen(page); await raf(page); const s3 = await state(page, b.id); if (!s3.has || s3.n !== s0.n) lost.push(`${cls} 왕복 ${s0.n}→${s3.n}`);
  }
  expect(lost, '잃은 종').toEqual([]); expect(grouped, '[전제] 묶인 칸이 있다').toBeGreaterThan(20); expect(real(errs), errs.join(' | ')).toEqual([]);
});
test('B1 말풍선 — 진짜 클릭 ⌘G→⌘⇧G: 남고, 부모 자유 프레임의 absolute 가 되고, 자리 그대로, 저장·⌘Z 왕복', async ({ page }) => {
  const errs = await boot(page); const b = await build(page, 'addSpeechBubbleBlock', ['left'], 1); await raf(page);
  const box = () => page.evaluate((id) => { const se = document.querySelector('#canvas .section-block'); const s = se.getBoundingClientRect(); const z = s.width / se.offsetWidth; const r = document.getElementById(id).getBoundingClientRect(); return [(r.left - s.left) / z, (r.top - s.top) / z, r.width / z].map(Math.round); }, b.id);
  const box0 = await box(); expect(await clickPick(page, b.id), '[전제] 클릭으로 고름').toBe(true);
  await page.keyboard.press('Meta+g'); await raf(page); expect((await state(page, b.id)).grp, '[전제] 묶임').toBe(true);
  await page.keyboard.press('Meta+Shift+g'); await raf(page); const s = await state(page, b.id);
  expect(s.has, '말풍선이 남는다').toBe(true); expect(s.groups, '그룹은 풀렸다').toBe(0); expect(s.pos, '자유 프레임 자식').toBe('absolute');
  expect(await page.evaluate(({ id, host }) => document.getElementById(id).closest('.frame-block[data-text-frame]').parentElement.id === host, { id: b.id, host: b.host }), '부모 프레임으로 돌아온다').toBe(true);
  expect(await box(), '자리·폭 그대로').toEqual(box0);
  await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z'); await raf(page); const u = await state(page, b.id); expect([u.has, u.grp], '⌘Z 하나 = 다시 묶임').toEqual([true, true]);
  await page.keyboard.press('Meta+Shift+z'); await raf(page); const r = await state(page, b.id); expect([r.has, r.grp], '⌘⇧Z = 풀림').toEqual([true, false]);
  await reopen(page); await raf(page); expect((await state(page, b.id)).has, '저장 왕복 뒤').toBe(true); expect(await box(), '왕복 뒤 자리').toEqual(box0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('B2 ⌘G → 저장 왕복 → ⌘⇧G: 이미 저장된 그룹도 잃지 않는다', async ({ page }) => {
  const errs = await boot(page); const b = await build(page, 'addSpeechBubbleBlock', ['left'], 1); await raf(page); await clickPick(page, b.id);
  await page.keyboard.press('Meta+g'); await raf(page); const g = await page.evaluate((id) => document.getElementById(id).closest('.frame-block[data-group="true"]').id, b.id);
  await reopen(page); await raf(page); expect((await state(page, b.id)).grp, '[전제] 왕복 뒤 그룹').toBe(true);
  await page.evaluate((g) => { window.deselectAll(); document.getElementById(g).classList.add('selected'); }, g); await page.keyboard.press('Meta+Shift+g'); await raf(page);
  const s = await state(page, b.id); expect([s.has, s.groups], '남고 풀림').toEqual([true, 0]);
  await reopen(page); await raf(page); expect((await state(page, b.id)).has, '다시 왕복').toBe(true); expect(errs, errs.join(' | ')).toEqual([]);
});
test('N1 음성: absolute 글자 · 흐름 자식 섞인 그룹 — absolute 는 자리 그대로, 둘 다 남는다', async ({ page }) => {
  const errs = await boot(page); const b = await build(page, 'addTextBlock', ['body'], 1); await raf(page);
  const q = await page.evaluate(async ({ id, host }) => { const sec = document.querySelector('#canvas .section-block'); window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(host); window.addSpeechBubbleBlock('left'); window._activeFrame = null; window.deselectAll(); const sb = sec.querySelector('.speech-bubble-block'); const t = document.getElementById(id).closest('.frame-block[data-text-frame]'); t.style.left = '40px'; t.style.top = '700px'; t.dataset.offsetX = '40'; t.dataset.offsetY = '700'; window.clearHistory?.(); window.selectSection(sec); window._activeFrame = document.getElementById(host); document.getElementById(id).classList.add('selected'); sb.classList.add('selected'); return { sb: sb.id }; }, { id: b.id, host: b.host });
  await page.keyboard.press('Meta+g'); await raf(page); const grp = await state(page, b.id); expect(grp.grp, '[전제] 묶임').toBe(true);
  const box = (id) => page.evaluate((id) => { const se = document.querySelector('#canvas .section-block'); const s = se.getBoundingClientRect(); const z = s.width / se.offsetWidth; const r = document.getElementById(id).getBoundingClientRect(); return [(r.left - s.left) / z, (r.top - s.top) / z].map(Math.round); }, id);
  const t0 = await box(b.id); await page.keyboard.press('Meta+Shift+g'); await raf(page);
  expect(await page.evaluate(({ a, c }) => [!!document.getElementById(a), !!document.getElementById(c)], { a: b.id, c: q.sb }), '둘 다 남는다').toEqual([true, true]);
  expect(await box(b.id), 'absolute 자리 그대로').toEqual(t0); expect(errs, errs.join(' | ')).toEqual([]);
});

for (const [name, entry, args] of [['말풍선', 'addSpeechBubbleBlock', ['left']], ['라이너', 'addLinerBlock', ['arc-up']], ['배너', 'addBannerBlock', []], ['버즈', 'addBuzzBlock', []]]) test(`C1 묶은 그룹 안에 입구로 넣은 ${name} — ⌘⇧G·왕복 뒤 남는다`, async ({ page }) => {
  const errs = await boot(page); const b = await build(page, 'addTextBlock', ['body'], 1); await raf(page); await selectIn(page, b.id, b.host); await page.keyboard.press('Meta+g'); await raf(page);
  const r = await page.evaluate(async ({ entry, args, FR }) => { document.activeElement?.blur?.(); const g = document.querySelector('#canvas .frame-block[data-group="true"]'); const sec = g.closest('.section-block'); window.deselectAll(); window.selectSection(sec); window._activeFrame = g; const SEL = window.SECTION_BLOCK_TYPE_SEL + ', .liner-block, ' + FR; const before = new Set(sec.querySelectorAll(SEL)); await window[entry](...args); const el = [...sec.querySelectorAll(SEL)].find((x) => !before.has(x)); if (!el.id) el.id = 'blk_' + Math.random().toString(36).slice(2, 9); const inG = g.contains(el); window._activeFrame = null; window.deselectAll(); g.classList.add('selected'); return { id: el.id, inG }; }, { entry, args, FR });
  expect(r.inG, '[전제] 그룹 안').toBe(true); const n0 = (await state(page, r.id)).n;
  await page.keyboard.press('Meta+Shift+g'); await raf(page); const s = await state(page, r.id); expect([s.has, s.n, s.groups], '남고 수 그대로').toEqual([true, n0, 0]);
  await reopen(page); await raf(page); const t = await state(page, r.id); expect([t.has, t.n], '왕복 뒤').toEqual([true, n0]); expect(real(errs), errs.join(' | ')).toEqual([]);
});
test('B3 풀린 말풍선을 끌면 자유 프레임 좌표로 움직인다(흐름 끌기 처리기가 남지 않았다)', async ({ page }) => {
  const errs = await boot(page); const b = await build(page, 'addSpeechBubbleBlock', ['left'], 1); await raf(page); await clickPick(page, b.id); await page.keyboard.press('Meta+g'); await raf(page); await page.keyboard.press('Meta+Shift+g'); await raf(page);
  expect(await clickPick(page, b.id), '[전제] 다시 고름').toBe(true);
  const tf = () => page.evaluate((id) => { const t = document.getElementById(id).closest('.frame-block[data-text-frame]'); return { left: parseInt(t.style.left), top: parseInt(t.style.top), pos: getComputedStyle(t).position, par: t.parentElement.id }; }, b.id); const t0 = await tf();
  const q = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, b.id);
  await page.mouse.move(q[0], q[1]); await page.mouse.down(); for (let i = 1; i <= 8; i++) { await page.mouse.move(q[0], q[1] + i * 15); await raf(page); } await page.mouse.up(); await raf(page);
  const t1 = await tf(); expect(t1.pos, '여전히 absolute').toBe('absolute'); expect(await page.evaluate((id) => document.getElementById(id).closest('.frame-block[data-text-frame]').getAttribute('draggable'), b.id), 'HTML5 끌기 꺼짐(자유 프레임 자식 꼴)').toBe('false'); expect(t1.par, '같은 프레임').toBe(t0.par); expect(t1.top, '아래로 움직였다').toBeGreaterThan(t0.top); expect(await page.evaluate(() => document.querySelectorAll('#canvas .speech-bubble-block').length), '끌어도 하나').toBe(1); expect(real(errs), errs.join(' | ')).toEqual([]);
});

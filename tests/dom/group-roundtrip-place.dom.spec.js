/* group-roundtrip-place — ⌘G→⌘⇧G 뒤 자리·크기, 저장 왕복 뒤 값이 ⌘G 전과 같다(t9-06 ⑶ · S3 자리 바뀜 표).
 * 뿌리 셋: ① 묶기가 흐름 자리(margin·width·position)를 지우고 풀기가 못 되돌린다 ② 떠 있는 블럭의 정본 dataset.x/y 를 풀기가 안 되민다 ③ ⌘⇧G 가 안쪽 대신 바깥 그룹을 집는다.
 * 음성: 자유 프레임 안 왕복, 그룹 안에서 바꾼 폭, 옛 저장본(적어 둔 값 없음). 저장 왕복은 serializeProject → applyProjectData. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const FR = '.frame-block:not([data-text-frame])';
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
async function boot(page) { await page.setViewportSize({ width: 1500, height: 1400 }); return bootApp(page); }
const real = (errs) => errs.filter((e) => !/svgPresets/.test(e));
const build = (page, entry, args, place) => page.evaluate(async ({ entry, args, place, FR }) => {
  const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop();
  sec.querySelectorAll('.frame-block[data-text-frame]').forEach((t) => (t.closest('.row') || t).remove());
  let host = null;
  if (place !== 'section') { window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); host = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.updateFrameBlock(host.id, { width: 780, height: 900 });
    if (place === 'stack') { window.deselectAll(); window.selectSection(sec); window._activeFrame = host; window.addTextBlock('body'); window._activeFrame = null; window.__convertFreeLayoutToStack(host); } }
  window.deselectAll(); window.selectSection(sec); window._activeFrame = host; const SEL = window.SECTION_BLOCK_TYPE_SEL + ', .liner-block, ' + FR; const before = new Set(sec.querySelectorAll(SEL));
  await window[entry](...args);
  const el = [...sec.querySelectorAll(SEL)].find((x) => !before.has(x)); window._activeFrame = null; window.deselectAll(); window.clearHistory?.(); if (!el.id) el.id = 'blk_' + Math.random().toString(36).slice(2, 9);
  return { id: el.id, host: host?.id || null };
}, { entry, args, place, FR });
const box = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); if (!e) return null; const se = document.querySelector('#canvas .section-block'); const sr = se.getBoundingClientRect(); const z = (sr.width / se.offsetWidth) || 1; const r = e.getBoundingClientRect(); return [r.left - sr.left, r.top - sr.top, r.width, r.height].map((v) => Math.round(v / z)); }, id);
const near = (a, b) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= 1);
const select = (page, ids, host) => page.evaluate(({ ids, host }) => { const e = document.getElementById(ids[0]); window.deselectAll(); window.selectSection(e.closest('.section-block')); window._activeFrame = host ? document.getElementById(host) : null; ids.forEach((i) => document.getElementById(i).classList.add('selected')); }, { ids, host });
const reopen = (page) => page.evaluate(async () => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(d); window.clearHistory?.(); });
const groups = (page) => page.evaluate(() => document.querySelectorAll('#canvas .frame-block[data-group="true"]').length);
const G = async (page) => { await page.keyboard.press('Meta+g'); await raf(page); };
const U = async (page) => { await page.keyboard.press('Meta+Shift+g'); await raf(page); await raf(page); };
const pickOnlyGroup = (page) => page.evaluate(() => { window.deselectAll(); document.querySelector('#canvas .frame-block[data-group="true"]').classList.add('selected'); });

/* 흐름 자리에서 묶는 종(앞 값: S3 표 · t9-06 표에서 자리가 바뀌던 칸) */
const FLOW = [['아이콘', 'addIconifyBlock', ['', '', 64]], ['목업', 'addMockupBlock', []], ['벡터', 'addVectorBlock', [SVG]], ['배너', 'addBannerBlock', []], ['버즈', 'addBuzzBlock', []], ['챗', 'addChatBlock', []], ['월계', 'addLaurelBlock', []], ['조커', 'addJokerBlock', []]];
/* 정본이 dataset.x/y 인 떠 있는 종 */
const FLOAT = [['스티커', 'addStickerBlock', []], ['선 스티커', 'addStickerBlock', [{ shape: 'arrow' }]], ['줌', 'addZoomBlock', []], ['그라데', 'addGradientBlock', []]];

for (const place of ['section', 'stack']) test(`F1 ${place}: 흐름 종 ⌘G→⌘⇧G 뒤 자리·크기, 저장 왕복 뒤도 같다`, async ({ page }) => {
  test.setTimeout(180000); const errs = await boot(page); const bad = []; let n = 0;
  for (const [name, entry, args] of FLOW) {
    const b = await build(page, entry, args, place); await raf(page); const a = await box(page, b.id); await select(page, [b.id], b.host); await G(page);
    if (!(await groups(page))) { bad.push(name + ' 안 묶임'); continue; } n++;
    await U(page); const u = await box(page, b.id); if (await groups(page)) bad.push(name + ' 안 풀림'); if (!near(a, u)) bad.push(`${name} 풀기 ${a}→${u}`);
    await page.evaluate(() => window.deselectAll()); await reopen(page); await raf(page); const r = await box(page, b.id); if (!near(a, r)) bad.push(`${name} 저장 왕복 ${a}→${r}`);
  }
  expect(bad, '자리 바뀐 칸').toEqual([]); expect(n, '[전제] 다 묶임').toBe(FLOW.length); expect(real(errs), errs.join(' | ')).toEqual([]);
});
test('F2 ⌘G → 저장 왕복 → ⌘⇧G: 이미 저장된 그룹을 풀어도 흐름 자리가 돌아온다', async ({ page }) => {
  test.setTimeout(120000); const errs = await boot(page); const bad = [];
  for (const [name, entry, args] of FLOW) {
    const b = await build(page, entry, args, 'section'); await raf(page); const a = await box(page, b.id); await select(page, [b.id], null); await G(page);
    await page.evaluate(() => window.deselectAll()); await reopen(page); await raf(page); await pickOnlyGroup(page); await U(page);
    const u = await box(page, b.id); if (!near(a, u)) bad.push(`${name} ${a}→${u}`);
  }
  expect(bad).toEqual([]); expect(real(errs), errs.join(' | ')).toEqual([]);
});
test('F3 ⌘Z 둘이면 처음 자리, ⌘⇧Z 는 풀린 자리 — 적어 둔 값이 이력과 어긋나지 않는다', async ({ page }) => {
  const errs = await boot(page); const b = await build(page, 'addMockupBlock', [], 'section'); await raf(page); const a = await box(page, b.id); await select(page, [b.id], null); await G(page); await U(page);
  await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z'); await raf(page); expect(await groups(page), '⌘Z 하나 = 묶인 꼴').toBe(1);
  await page.keyboard.press('Meta+z'); await raf(page); expect(await groups(page), '⌘Z 둘 = 처음').toBe(0); expect(near(a, await box(page, b.id)), '처음 자리').toBe(true);
  await page.keyboard.press('Meta+Shift+z'); await page.keyboard.press('Meta+Shift+z'); await raf(page); await raf(page); expect(near(a, await box(page, b.id)), '⌘⇧Z 둘 = 풀린 자리').toBe(true);
  expect(await page.evaluate((id) => document.getElementById(id).dataset.flowBack ?? null, b.id), '풀린 뒤 표식이 안 남는다').toBe(null); expect(real(errs), errs.join(' | ')).toEqual([]);
});
for (const [name, tf, ds, keep] of [['이동', 'translate(40px, 20px)', { translateX: '40', translateY: '20' }, 'translate(40px, 20px)'], ['회전', 'rotate(30deg)', { rotateDeg: '30' }, 'rotate(30deg)']]) test(`F4 ${name}한 흐름 프레임: ⌘G→⌘⇧G 뒤 자리·transform, 저장 왕복 뒤도 같다`, async ({ page }) => {
  const errs = await boot(page); const b = await build(page, 'addFrameBlock', [], 'section'); await page.evaluate(({ id, tf, ds }) => { window.updateFrameBlock(id, { width: 300, height: 200 }); const f = document.getElementById(id); Object.assign(f.dataset, ds); f.style.transform = tf; window.applyFrameRotationMargin?.(f); window.clearHistory?.(); }, { id: b.id, tf, ds }); await raf(page);
  const a = await box(page, b.id); await select(page, [b.id], null); await G(page); expect(await groups(page), '[전제] 묶임').toBe(1); await U(page);
  expect(await box(page, b.id), '자리').toEqual(a); expect(await page.evaluate((id) => document.getElementById(id).style.transform, b.id)).toBe(keep);
  await page.evaluate(() => window.deselectAll()); await reopen(page); await raf(page); expect(near(a, await box(page, b.id)), '저장 왕복 뒤').toBe(true); expect(real(errs), errs.join(' | ')).toEqual([]);
});
test('A1 떠 있는 종: ⌘G→⌘⇧G 뒤 저장 왕복해도 자리가 0,0 으로 안 간다 · 오버레이 표식을 안 붙인다', async ({ page }) => {
  test.setTimeout(120000); const errs = await boot(page); const bad = [];
  for (const [name, entry, args] of FLOAT) {
    const b = await build(page, entry, args, 'section'); await raf(page); const a = await box(page, b.id); const xy0 = await page.evaluate((id) => { const d = document.getElementById(id).dataset; return [d.x, d.y]; }, b.id);
    await select(page, [b.id], null); await G(page); if (!(await groups(page))) { bad.push(name + ' 안 묶임'); continue; } await U(page);
    const u = await box(page, b.id); if (!near(a, u)) bad.push(`${name} 풀기 ${a}→${u}`);
    const d = await page.evaluate((id) => { const e = document.getElementById(id); return { x: e.dataset.x, y: e.dataset.y, ov: e.dataset.overlayBlock ?? null, ox: e.dataset.offsetX ?? null, par: e.parentElement.classList.contains('section-block') }; }, b.id);
    if (Math.abs(+d.x - +xy0[0]) > 1 || Math.abs(+d.y - +xy0[1]) > 1) bad.push(`${name} 정본 ${xy0}→${d.x},${d.y}`); if (d.ov || d.ox) bad.push(`${name} 표식 ${d.ov},${d.ox}`); if (!d.par) bad.push(name + ' 섹션 직속 아님');
    await page.evaluate(() => window.deselectAll()); await reopen(page); await raf(page); const r = await box(page, b.id); if (!near(a, r)) bad.push(`${name} 저장 왕복 ${a}→${r}`);
  }
  expect(bad, '자리 바뀐 칸').toEqual([]); expect(real(errs), errs.join(' | ')).toEqual([]);
});
for (const [name, entry, args] of FLOAT) test(`A2 ${name}: 스택 프레임과 함께 묶었다 풀면 둘 다 제자리, 떠 있는 것은 섹션 직속으로`, async ({ page }) => {
  const errs = await boot(page); const b = await build(page, entry, args, 'stack'); await raf(page);
  /* build 의 스택 그릇은 맨 앞이다(떠 있는 종은 입구가 섹션 직속에 둔다) */
  const hostA = await box(page, b.host); const a = await box(page, b.id); expect(await page.evaluate((id) => document.getElementById(id).parentElement.classList.contains('section-block'), b.id), '[전제] 섹션 직속').toBe(true);
  await select(page, [b.host, b.id], null); await G(page); expect(await groups(page), '[전제] 묶임').toBe(1); await U(page); expect(await groups(page)).toBe(0);
  expect(near(a, await box(page, b.id)), '떠 있는 것 자리').toBe(true); expect(near(hostA, await box(page, b.host)), '그릇 자리').toBe(true);
  expect(await page.evaluate((id) => document.getElementById(id).parentElement.classList.contains('section-block'), b.id), '섹션 직속으로').toBe(true);
  await page.evaluate(() => window.deselectAll()); await reopen(page); await raf(page); expect(near(a, await box(page, b.id)), '저장 왕복 뒤').toBe(true); expect(real(errs), errs.join(' | ')).toEqual([]);
});
test('I1 그룹 안에서 묶으면 ⌘⇧G 는 방금 만든 안쪽을 푼다 — 바깥 그룹은 그대로', async ({ page }) => {
  const errs = await boot(page); const b = await build(page, 'addZoomBlock', [], 'stack'); await raf(page); await select(page, [b.host, b.id], null); await G(page);
  const outer = await page.evaluate(() => document.querySelector('#canvas .frame-block[data-group="true"]').id); const a = await box(page, b.id);
  await page.evaluate(({ outer, id }) => { window.deselectAll(); window.selectSection(document.getElementById(id).closest('.section-block')); const o = document.getElementById(outer); o.classList.add('selected'); window._activeFrame = o; document.getElementById(id).classList.add('selected'); }, { outer, id: b.id });
  await G(page); expect(await groups(page), '[전제] 안쪽이 생김').toBe(2); expect(near(a, await box(page, b.id))).toBe(true);
  expect(await page.evaluate((o) => document.getElementById(o).classList.contains('selected'), outer), '[전제] 바깥도 고른 꼴 — 이 칸을 잰다').toBe(true);
  await U(page); expect(await groups(page), '안쪽만 풀림').toBe(1); expect(await page.evaluate((o) => !!document.getElementById(o), outer), '바깥이 남는다').toBe(true);
  expect(await page.evaluate(({ id, o }) => document.getElementById(id).parentElement.id === o, { id: b.id, o: outer }), '바깥의 자식으로').toBe(true); expect(near(a, await box(page, b.id)), '자리').toBe(true); expect(real(errs), errs.join(' | ')).toEqual([]);
});
test('I2 깊이 2 자유 프레임에 든 그라데이션: ⌘G→⌘⇧G 뒤 정본·자리, 저장 왕복 뒤도 같다', async ({ page }) => {
  const errs = await boot(page); const b = await build(page, 'addGradientBlock', [], 'free'); await raf(page);
  /* 앱 입구는 섹션 직속에 둔다 — 깊이 2 칸은 그릇 안으로 옮겨 만든다(t9-06 칸의 ⌘G 입구와 같은 끝 꼴) */
  const inner = await page.evaluate(({ id, host, FR }) => { const sec = document.getElementById(id).closest('.section-block'); window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(host); const bb = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !bb.has(x)); window.updateFrameBlock(f.id, { width: 640, height: 600 }); const g = document.getElementById(id); f.appendChild(g); g.dataset.x = '30'; g.dataset.y = '40'; g.style.left = '30px'; g.style.top = '40px'; window._activeFrame = null; window.deselectAll(); window.clearHistory?.(); return f.id; }, { id: b.id, host: b.host, FR }); await raf(page);
  const a = await box(page, b.id); await select(page, [b.id], inner); await G(page); expect(await groups(page), '[전제] 묶임').toBe(1); await U(page);
  expect(near(a, await box(page, b.id)), '자리').toBe(true); expect(await page.evaluate((id) => { const d = document.getElementById(id).dataset; return [d.x, d.y, d.overlayBlock ?? null, d.offsetX ?? null]; }, b.id)).toEqual(['30', '40', null, null]);
  await page.evaluate(() => window.deselectAll()); await reopen(page); await raf(page); expect(near(a, await box(page, b.id)), '저장 왕복 뒤').toBe(true); expect(real(errs), errs.join(' | ')).toEqual([]);
});
test('N1 음성: 자유 프레임 안 왕복은 전과 같다(좌표 그대로, flowBack 안 씀)', async ({ page }) => {
  const errs = await boot(page); const b = await build(page, 'addVectorBlock', [SVG], 'free'); await raf(page); const a = await box(page, b.id); const s0 = await page.evaluate((id) => document.getElementById(id).getAttribute('style'), b.id);
  await select(page, [b.id], b.host); await G(page); expect(await page.evaluate((id) => document.getElementById(id).dataset.flowBack ?? null, b.id), '자유 갈래는 안 적는다').toBe(null); await U(page);
  expect(near(a, await box(page, b.id))).toBe(true); expect(await page.evaluate((id) => document.getElementById(id).getAttribute('style'), b.id)).toBe(s0); expect(real(errs), errs.join(' | ')).toEqual([]);
});
test('N2 음성: 그룹 안에서 폭을 바꿨으면 풀어도 그 폭이다', async ({ page }) => {
  const errs = await boot(page); const b = await build(page, 'addMockupBlock', [], 'section'); await raf(page); await select(page, [b.id], null); await G(page);
  await page.evaluate((id) => { document.getElementById(id).style.width = '300px'; }, b.id); await U(page);
  expect(await page.evaluate((id) => document.getElementById(id).style.width, b.id)).toBe('300px'); expect(await page.evaluate((id) => getComputedStyle(document.getElementById(id)).position, b.id)).not.toBe('absolute'); expect(real(errs), errs.join(' | ')).toEqual([]);
});
test('N3 음성: 옛 저장본(적어 둔 값 없음)을 풀어도 전처럼 흐름으로, 챗은 전처럼 좌표로', async ({ page }) => {
  const errs = await boot(page);
  for (const [entry, args, pos] of [['addMockupBlock', [], 'relative'], ['addChatBlock', [], 'absolute']]) {
    const b = await build(page, entry, args, 'section'); await raf(page); await select(page, [b.id], null); await G(page); await page.evaluate((id) => { delete document.getElementById(id).dataset.flowBack; }, b.id); await pickOnlyGroup(page); await U(page);
    expect(await groups(page)).toBe(0); expect(await page.evaluate((id) => !!document.getElementById(id), b.id), '남는다').toBe(true); expect(await page.evaluate((id) => getComputedStyle(document.getElementById(id)).position, b.id), entry).toBe(pos);
  }
  expect(real(errs), errs.join(' | ')).toEqual([]);
});

/* ial-0913b — 현빈 261123 F «IAL 치명»(0.9.13 몫) · 근거 = handoff/IAL-RUNS/r1/notes.md + IAL-SCENARIOS.md 1회차 판정 · 태양
 * I1 (S1-3) 떠 있는 사각형 B + 흐름 본문 C 를 섞어 ⌘G → 그룹이 떠 있다(IAL 유지 · 섹션 직속) · B·C 화면 자리 그대로 · C 는 흐름에서 빠짐 · ⌘Z 한 번 = 묶기 전
 * I2 (S1-4ⓐ · S3-3) 떠 있는 B + 흐름 제목 A 를 ⇧클릭으로 섞어 고름 → «서로 맞춤» 패널 · 세로 가운데 = B 만 움직여 둘의 경계 가운데로 · A 자리·글자 정렬 그대로 · ⌘Z 한 번
 * 양성대조(I2): _patches/ial-I2-CTL.patch(editor.js 섞임 갈래 한 줄 걷음) ⇒ I2 빨강.
 * 양성대조: _patches/ial-I1-CTL.patch(block-factory.js 섞어 묶기 갈래 걷음) ⇒ I1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/* 기본판(IAL-SCENARIOS «공통 장면»의 섹션 쪽): 제목 A · 사각형 B · 본문 C — B 를 띄운다(S1-1) */
async function base(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); sec.id = 'sI'; window.applyZoom?.(100);
    window.deselectAll(); window.selectSection(sec);
    const add = (fn) => { const before = new Set(sec.querySelectorAll('.text-block, .shape-block')); fn(); return [...sec.querySelectorAll('.text-block, .shape-block')].find((x) => !before.has(x)); };
    add(() => window.addTextBlock('h1')).id = 'tA';
    const b = add(() => window.addShapeBlock('rectangle')); b.id = 'rB'; window.updateShapeBlock?.(b, { width: 400, height: 200 });
    add(() => window.addTextBlock('body')).id = 'tC';
    window.OverlayFloat.enterFloat(window.OverlayFloat.posElOf(b));
    window.deselectAll(); window.clearHistory?.();
  });
  await waitZoomSettled(page, 100);
  return errs;
}
const rectOf = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }, id);

test('I1 (S1-3 ⓑ) 떠 있는 B + 흐름 C ⌘G → 흐름 그룹(흐름 블럭에 붙임 · t5-08) · B 는 그룹 안 같은 화면 자리 · ⌘Z 한 번', async ({ page }) => {
  const errs = await base(page);
  const pre = await page.evaluate(() => ({ bFloat: window.OverlayFloat.posElOf(document.getElementById('rB')).dataset.overlayBlock, cFlow: !!document.getElementById('tC').closest('.section-inner') }));
  expect(pre, '[전제] B 떠 있음 · C 흐름').toEqual({ bFloat: 'true', cFlow: true });
  const b0 = await rectOf(page, 'rB'), c0 = await rectOf(page, 'tC');
  await page.evaluate(() => { window.deselectAll(); for (const id of ['rB', 'tC']) document.getElementById(id).classList.add('selected'); });
  await page.evaluate(() => window.groupSelectedBlocks());
  await raf(page);
  const g = await page.evaluate(() => {
    const B = document.getElementById('rB'), C = document.getElementById('tC'), gb = B.closest('[data-group="true"]');
    return gb && { same: gb === C.closest('[data-group="true"]'), overlay: gb.dataset.overlayBlock ?? null, parentIsSec: gb.parentElement?.id === 'sI', cInFlow: !!C.closest('.section-inner') };
  });
  const b1 = await rectOf(page, 'rB'), c1 = await rectOf(page, 'tC');
  console.log('[I1 실측]', JSON.stringify({ g, b0, b1, c0, c1 }));
  expect(g, '★그룹 = 흐름(떠 있지 않음) · 섹션 본문 안 · B·C 같은 그룹 · C 흐름에 그대로').toEqual({ same: true, overlay: null, parentIsSec: false, cInFlow: true });   // ★기대 바뀜: 현빈 261123 ⓑ «떠 있는 것 + 흐름 ⌘G = 흐름 블럭에 붙임(옛 t5-08)» — 1차 기대(그룹 떠 있음 · S1-3)를 되돌림
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 1);
  expect([near(b0, b1), near(c0, c1)], `★화면 자리 그대로 B ${b0}→${b1} · C ${c0}→${c1}`).toEqual([true, true]);
  await page.evaluate(() => window.undo()); await raf(page);
  const u = await page.evaluate(() => ({ group: !!document.getElementById('rB').closest('[data-group="true"]'), bFloat: window.OverlayFloat.posElOf(document.getElementById('rB')).dataset.overlayBlock ?? null, cFlow: !!document.getElementById('tC').closest('.section-inner') }));
  expect(u, '★⌘Z 한 번 = 묶기 전(B 떠 있음 · C 흐름)').toEqual({ group: false, bFloat: 'true', cFlow: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('I2 (S1-4ⓐ) 떠 있는 B + 흐름 A 섞어 고름 → 세로 가운데 = B 만 경계 가운데로 · A 글자 정렬 그대로', async ({ page }) => {
  const errs = await base(page);
  const mid = (id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  let p = await mid('rB'); await page.mouse.click(p[0], p[1]); await raf(page);
  p = await mid('tA'); await page.keyboard.down('Shift'); await page.mouse.click(p[0], p[1]); await page.keyboard.up('Shift'); await raf(page);
  await page.waitForFunction(() => !!document.querySelector('#panel-right [data-ov-align="vcenter"]'), null, { timeout: 5000 });
  const a0 = await rectOf(page, 'tA'), b0 = await rectOf(page, 'rB');
  const ta0 = await page.evaluate(() => getComputedStyle(document.querySelector('#tA [class^="tb-"]')).textAlign);
  await page.click('#panel-right [data-ov-align="vcenter"]'); await raf(page);
  const a1 = await rectOf(page, 'tA'), b1 = await rectOf(page, 'rB');
  const ta1 = await page.evaluate(() => getComputedStyle(document.querySelector('#tA [class^="tb-"]')).textAlign);
  const top = Math.min(a0[1], b0[1]), bot = Math.max(a0[1] + a0[3], b0[1] + b0[3]), want = (top + bot) / 2;
  console.log('[I2 실측]', JSON.stringify({ a0, a1, b0, b1, ta0, ta1, want }));
  expect([a1.join(), ta1], '★흐름 A 는 자리·글자 정렬 그대로').toEqual([a0.join(), ta0]);
  expect(Math.abs(b1[1] + b1[3] / 2 - want) <= 2, `★B 세로 가운데 = 고른 것 경계 가운데(${want}) · B ${b0}→${b1}`).toBe(true);
  expect(b1[0], '★B 가로 자리 그대로').toBe(b0[0]);
  await page.evaluate(() => window.undo()); await raf(page);
  expect((await rectOf(page, 'rB')).join(), '★⌘Z 한 번 = 맞추기 전').toBe(b0.join());
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* I3 (S1-9 · 다름-치명 «⌘Z 한 번에 두 단계») — 1회차의 이어진 손짓(⌘G → 섞어 고른 정렬)을 그대로 하고 ⌘Z 를 하나씩: 매번 «바로 앞 상태 하나»로만 */
test('I3 (S1-9) ⌘G → 섞어 고른 세로 가운데 → ⌘Z 하나씩 = 한 단계씩', async ({ page }) => {
  const errs = await base(page);
  const sig = () => page.evaluate(() => { const B = document.getElementById('rB'), g = B.closest('[data-group="true"]'), r = B.getBoundingClientRect();
    return JSON.stringify({ group: !!g, bTop: Math.round(r.top), cFlow: !!document.getElementById('tC').closest('.section-inner'), aAlign: getComputedStyle(document.querySelector('#tA [class^="tb-"]')).textAlign }); });
  const mid = (sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  await page.evaluate(() => { const sec = document.getElementById('sI'), w = window.OverlayFloat.posElOf(document.getElementById('rB')), sr = sec.getBoundingClientRect(), z = (parseFloat(window.state?.zoom) || 100) / 100;   // ★전제(아이맥 261123 I3 전제 빨강 — 글꼴 높이에 따라 그룹 상자가 A 를 덮으면 세로 가운데가 무동작) ⇒ B 를 A·C 아래 멀리 두어 «A∪그룹» 경계와 그룹 가운데가 늘 다르게
    const bot = Math.max(...['tA', 'tC'].map((id) => document.getElementById(id).getBoundingClientRect().bottom)); window.OverlayFloat._applyOverlayPos ? window.OverlayFloat._applyOverlayPos(w, parseFloat(w.style.left) || 0, Math.round((bot - sr.top) / z) + 200) : (w.style.top = Math.round((bot - sr.top) / z) + 200 + 'px', w.dataset.offsetY = String(Math.round((bot - sr.top) / z) + 200)); sec.style.minHeight = '900px'; window.OverlayFloat.enterFloat(window.OverlayFloat.posElOf(document.getElementById('tC'))); window.clearHistory?.(); });   // ★전제 바뀜(현빈 261123 ⓑ — 떠 있는 것+흐름 ⌘G = 흐름 그룹이라 «섞어 고른 정렬» 장면이 안 섬) ⇒ C 도 띄워 «떠 있는 둘 ⌘G = 떠 있는 그룹» 으로 S1-9(⌘Z 한 단계씩)를 그대로 잰다
  const s0 = await sig();
  await page.evaluate(() => { window.deselectAll(); for (const id of ['rB', 'tC']) document.getElementById(id).classList.add('selected'); window.groupSelectedBlocks(); });
  await raf(page);
  const s1 = await sig();
  await page.evaluate(() => window.deselectAll()); await raf(page);
  let p = await mid('#rB'); await page.mouse.click(p[0], p[1]); await raf(page); // I2 와 같은 순서(B 먼저) — A 먼저 누르면 첫 클릭이 섹션을 고름(장면 전제)
  await page.evaluate(() => window.toggleBlockSelect(document.getElementById('tA'))); await raf(page); // ⇧클릭 정본 — ⌘G 그룹 틀(B·C 경계)이 A 를 덮어 화면 ⇧클릭은 그룹에 맞음(장면 전제 · 실측 hit=frame-block)
  await page.waitForFunction(() => !!document.querySelector('#panel-right [data-ov-align="vcenter"]'), null, { timeout: 3000 }).catch(() => {});
  const panel = await page.evaluate(() => !!document.querySelector('#panel-right [data-ov-align="vcenter"]'));
  if (panel) { await page.click('#panel-right [data-ov-align="vcenter"]'); await raf(page); }
  const s2 = await sig();
  const undos = [];
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.undo()); await raf(page); undos.push(await sig()); }
  console.log('[I3 실측]', JSON.stringify({ panel, s0, s1, s2, undos }));
  expect([panel, s0 !== s1, s1 !== s2], '[전제] 섞어 고른 패널이 떴고 세 상태가 서로 다르다').toEqual([true, true, true]);
  expect(undos.slice(0, 2), '★⌘Z 한 번 = 한 단계(정렬 → ⌘G 순으로 하나씩)').toEqual([s1, s0]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* I4 (S5-2 · 다름-치명 «프레임 위로 끌면 섹션 자식이 됨 · 레이어 패널 갱신 안 됨») — 떠 있는 B 를 흐름 프레임 F 위에 놓으면 F 의 자식(떠 있는 채) · 놓은 자리 그대로 · 레이어 패널 다시 짬 · ⌘Z 한 번
 * 양성대조: _patches/ial-I4-CTL.patch(overlay-float.js 놓을 때 주인 바꾸기 두 줄 걷음) ⇒ I4 빨강. */
test('I4 (S5-2) 떠 있는 B 를 프레임 F 위에 놓음 → F 자식 · IAL 유지 · 자리 그대로 · 레이어 갱신 · ⌘Z 한 번', async ({ page }) => {
  const errs = await base(page);
  await page.evaluate(() => { const sec = document.getElementById('sI'); window.deselectAll(); window.selectSection(sec); window.addFrameBlock(); const f = [...sec.querySelectorAll('.frame-block:not([data-text-frame])')].find((x) => !x.dataset.group); f.id = 'fF'; window.deselectAll(); window.clearHistory?.(); });
  await raf(page);
  const pre = await page.evaluate(() => ({ fFlow: !!document.getElementById('fF').closest('.section-inner'), bParent: window.OverlayFloat.posElOf(document.getElementById('rB')).parentElement.id }));
  expect(pre, '[전제] F 흐름 프레임 · B 섹션 직속 떠 있음').toEqual({ fFlow: true, bParent: 'sI' });
  const mid = (id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  const b0 = await rectOf(page, 'rB'), [bx, by] = await mid('rB'), [fx, fy] = await mid('fF');
  await page.evaluate(() => { window.__lp = 0; const o = window.buildLayerPanel; window.buildLayerPanel = (...a) => { window.__lp++; return o(...a); }; });
  await page.mouse.move(bx, by); await page.mouse.down(); await page.mouse.move((bx + fx) / 2, (by + fy) / 2, { steps: 6 }); await page.mouse.move(fx, fy, { steps: 6 }); await page.mouse.up(); await raf(page);
  const b1 = await rectOf(page, 'rB');
  const got = await page.evaluate(() => { const w = window.OverlayFloat.posElOf(document.getElementById('rB')); return { parent: w.parentElement.id, overlay: w.dataset.overlayBlock ?? null, host: window.OverlayFloat.floatHostOf(w)?.id, lp: window.__lp > 0 }; });
  const want = [Math.round(b0[0] + fx - bx), Math.round(b0[1] + fy - by)];
  console.log('[I4 실측]', JSON.stringify({ b0, b1, want, got }));
  expect(got, '★F 자식 · 떠 있음 · 주인 = F · 레이어 패널 다시 짬').toEqual({ parent: 'fF', overlay: 'true', host: 'fF', lp: true });
  expect([Math.abs(b1[0] - want[0]) <= 2, Math.abs(b1[1] - want[1]) <= 2, b1[2], b1[3]], `★놓은 자리 그대로(${want}) · 크기 그대로`).toEqual([true, true, b0[2], b0[3]]);
  await page.evaluate(() => window.undo()); await raf(page);
  const u = await page.evaluate(() => window.OverlayFloat.posElOf(document.getElementById('rB')).parentElement.id);
  expect([u, (await rectOf(page, 'rB')).join()], '★⌘Z 한 번 = 끌기 전(섹션 직속 · 옛 자리)').toEqual(['sI', b0.join()]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* I5 (S1-5 · 다름-치명 «IAL 그룹을 프레임 안으로 못 넣음 · 그룹을 누르면 자식 B 가 잡힘») — ⌘G 로 만든 떠 있는 그룹을 눌러(= 그룹이 골라짐) 프레임 F 위에 놓으면 F 자식 · IAL 유지 · 자식 B·C 그룹 안 그대로 */
test('I5 (S1-5) 떠 있는 그룹 누름 = 그룹 고름 · F 위에 놓음 → F 자식 · IAL 유지 · ⌘Z 한 번', async ({ page }) => {
  const errs = await base(page);
  await page.evaluate(() => { const sec = document.getElementById('sI'); window.OverlayFloat.enterFloat(window.OverlayFloat.posElOf(document.getElementById('tC'))); window.deselectAll(); for (const id of ['rB', 'tC']) document.getElementById(id).classList.add('selected'); window.groupSelectedBlocks();   // ★전제 바뀜(현빈 261123 ⓑ) — C 도 띄워 떠 있는 그룹을 만든다(떠 있는 것+흐름은 이제 흐름 그룹)
    const g = document.getElementById('rB').closest('[data-group="true"]'); g.id = 'gG'; window.deselectAll(); window.selectSection(sec); window.addFrameBlock(); const f = [...sec.querySelectorAll('.frame-block:not([data-text-frame])')].find((x) => !x.dataset.group && !x.closest('[data-group]')); f.id = 'fF'; window.deselectAll(); window.clearHistory?.(); });
  await raf(page);
  const mid = (id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  const [bx, by] = await mid('rB'), [fx, fy] = await mid('fF'), g0 = await rectOf(page, 'gG');
  await page.mouse.click(bx, by); await raf(page);
  const sel = await page.evaluate(() => ({ g: document.getElementById('gG').classList.contains('selected'), b: document.getElementById('rB').classList.contains('selected') }));
  await page.mouse.move(bx, by); await page.mouse.down(); await page.mouse.move((bx + fx) / 2, (by + fy) / 2, { steps: 6 }); await page.mouse.move(fx, fy, { steps: 6 }); const gUp = await rectOf(page, 'gG'); await page.mouse.up(); await raf(page);   // 그룹 폭 = 섹션 폭이라 가로는 탄성으로 커서를 덜 따라감 ⇒ «놓기 직전 화면 자리»와 견준다
  const got = await page.evaluate(() => { const g = document.getElementById('gG'); return { parent: g.parentElement.id, overlay: g.dataset.overlayBlock ?? null, kids: ['rB', 'tC'].every((id) => document.getElementById(id).closest('[data-group="true"]') === g) }; });
  const g1 = await rectOf(page, 'gG');
  console.log('[I5 실측]', JSON.stringify({ sel, g0, gUp, g1, got }));
  expect(sel, '★그룹 자리 누름 = 그룹이 골라짐(자식 B 아님)').toEqual({ g: true, b: false });
  expect(got, '★그룹 = F 자식 · 떠 있음 · B·C 그룹 안 그대로').toEqual({ parent: 'fF', overlay: 'true', kids: true });
  expect([g1.join(), g1[1] - g0[1] > 50], `★놓은 자리 그대로(놓기 직전 ${gUp}) · 아래로 옮겨짐`).toEqual([gUp.join(), true]);
  await page.evaluate(() => window.undo()); await raf(page);
  expect(await page.evaluate(() => document.getElementById('gG').parentElement.id), '★⌘Z 한 번 = 끌기 전(섹션 직속)').toBe('sI');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* I6 (S3-4 · 다름-치명 «셋 고르고 화살표 → 화면은 셋 다 움직이는데 한 블럭의 패널 X 가 안 바뀜 · IAL 끈 뒤 10px 치우침») — 1회차 손짓 그대로: 셋 띄움 → 흩음 → 셋 고름 → 가로 균등 → → · ⇧→ → 하나씩 고른 패널 X = 화면 = 정본 · IAL 끄면 셋 다 같은 가로 자리 */
test('I6 (S3-4) 셋 고르고 → · ⇧→ → 패널 X = 정본 = 화면 +11 · IAL 끈 뒤 치우침 없음', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); sec.id = 'sQ'; window.applyZoom?.(100);
    const OF = window.OverlayFloat;
    ['r1', 'r2', 'r3'].forEach((id) => { window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll('.shape-block')); window.addShapeBlock('rectangle'); const b = [...sec.querySelectorAll('.shape-block')].find((x) => !before.has(x)); b.id = id; });
    ['r1', 'r2', 'r3'].forEach((id) => OF.enterFloat(OF.posElOf(document.getElementById(id))));
    [[40, 20], [220, 70], [350, 20]].forEach(([x, y], i) => { const w = OF.posElOf(document.getElementById('r' + (i + 1))); w.style.left = x + 'px'; w.style.top = y + 'px'; w.dataset.offsetX = x; w.dataset.offsetY = y; });
    window.deselectAll(); window.clearHistory?.();
  });
  await waitZoomSettled(page, 100);
  const mid = (id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  let p = await mid('r1'); await page.mouse.click(p[0], p[1]); await raf(page);
  for (const id of ['r2', 'r3']) { p = await mid(id); await page.keyboard.down('Shift'); await page.mouse.click(p[0], p[1]); await page.keyboard.up('Shift'); await raf(page); }
  await page.waitForFunction(() => !!document.querySelector('#panel-right [data-ov-dist="h"]:not([disabled])'), null, { timeout: 5000 });
  await page.click('#panel-right [data-ov-dist="h"]'); await raf(page);
  const st = () => page.evaluate(() => ['r1', 'r2', 'r3'].map((id) => { const b = document.getElementById(id), w = window.OverlayFloat.posElOf(b); return { id, w: w === b ? 'self' : w.className.split(' ')[0], ox: w.dataset.offsetX, left: w.style.left, inner: Math.round(b.getBoundingClientRect().left - w.getBoundingClientRect().left), sx: Math.round(b.getBoundingClientRect().left) }; }));
  const s0 = await st();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowRight'); await raf(page);
  const s1 = await st();
  const panelX = [];
  for (const id of ['r1', 'r2', 'r3']) { p = await mid(id); await page.mouse.click(1590, 1090); await raf(page); await page.mouse.click(p[0], p[1]); await raf(page); await page.waitForTimeout(50); panelX.push(await page.evaluate(() => document.querySelector('#panel-right input[aria-label="X position"]')?.value ?? null)); }
  await page.evaluate(() => ['r1', 'r2', 'r3'].forEach((id) => window.OverlayFloat.exitFloat(window.OverlayFloat.posElOf(document.getElementById(id))))); await raf(page);
  const lefts = await page.evaluate(() => ['r1', 'r2', 'r3'].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().left)));
  console.log('[I6 실측]', JSON.stringify({ s0, s1, panelX, lefts }));
  expect(s1.map((s, i) => s.sx - s0[i].sx), '[전제] 화면에서 셋 다 +11').toEqual([11, 11, 11]);
  expect(s1.map((s, i) => [+s.ox - +s0[i].ox, s.inner]), '★정본(래퍼 offsetX)이 +11 · 래퍼 안 도형은 안 밀림(inner 0) — 옛 판은 래퍼 안 도형만 밀려 정본 무변').toEqual([[11, 0], [11, 0], [11, 0]]);
  expect(panelX, '★하나씩 고른 패널 X = 정본(offsetX)').toEqual(s1.map((s) => s.ox));
  expect(new Set(lefts).size, `★IAL 끈 뒤 셋 다 같은 가로 자리(흐름 가운데) ${lefts}`).toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* I7 (현빈 9510 QA 197 4-a · 미카사 실앱 재현 «틀 누르면 안 도형 잡힘 · 화살표 도형만 1px») — 흐름 도형 래퍼(자유배치 shape-frame) 틀을 누르고 방향키 → 래퍼 안 도형만 밀리지 않는다(흐름이라 무동작)
 * 같은 고침 = aacbf8402(S3-4 · editor.js _freePositionedAncestor 도형 래퍼 거름) — 지디 261123 «두 벌 고침 금지 · ial 가지 몫으로 이 칸이 덮는지 확인» · 양성대조 = _patches/ial-I6-CTL.patch(같은 한 줄) */
test('I7 (197 4-a) 흐름 도형 래퍼 틀 누름 → →·⇧→ → 안 도형이 래퍼 안에서 안 밀림 · 래퍼도 제자리(흐름)', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); sec.id = 'sW'; window.applyZoom?.(100);
    window.deselectAll(); window.selectSection(sec); const before = new Set(sec.querySelectorAll('.shape-block')); window.addShapeBlock('rectangle');
    const b = [...sec.querySelectorAll('.shape-block')].find((x) => !before.has(x)); b.id = 'shW'; b.closest('.frame-block').id = 'sfW';
    window.deselectAll(); window.clearHistory?.();
  });
  await waitZoomSettled(page, 100);
  const st = () => page.evaluate(() => { const b = document.getElementById('shW'), f = document.getElementById('sfW'), rb = b.getBoundingClientRect(), rf = f.getBoundingClientRect(); return { inner: [Math.round(rb.left - rf.left), Math.round(rb.top - rf.top)], innerStyle: [b.style.left, b.style.top], wrap: [Math.round(rf.left), Math.round(rf.top)], wrapFlow: f.dataset.overlayBlock !== 'true' && !!f.closest('.section-inner'), freeLayout: f.dataset.freeLayout ?? null }; });
  const s0 = await st();
  const p = await page.evaluate(() => { const r = document.getElementById('sfW').getBoundingClientRect(); return [r.left + 3, r.top + 3]; });   // 틀(래퍼 가장자리 안쪽) 누름
  await page.mouse.click(p[0], p[1]); await raf(page);
  const sel = await page.evaluate(() => [...document.querySelectorAll('#canvas .selected')].map((e) => e.id));
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowRight'); await raf(page);
  const s1 = await st();
  console.log('[I7 실측]', JSON.stringify({ s0, sel, s1 }));
  expect([s0.wrapFlow, s0.freeLayout], '[전제] 흐름 도형 래퍼(자유배치)').toEqual([true, 'true']);
  expect(sel.length > 0, '[전제] 무언가 골라짐').toBe(true);
  expect([s1.inner, s1.innerStyle], '★래퍼 안 도형이 안 밀림(옛 판 = 화살표마다 안 도형만 left 가 밀림)').toEqual([s0.inner, s0.innerStyle]);
  expect(s1.wrap, '★흐름 래퍼는 제자리(흐름 블럭 ←→ 무동작 · t13D-01)').toEqual(s0.wrap);
  expect(errs, errs.join(' | ')).toEqual([]);
});

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

test('I1 (S1-3) 떠 있는 B + 흐름 C ⌘G → 그룹이 떠 있음 · 자리 그대로 · C 흐름에서 빠짐 · ⌘Z 한 번', async ({ page }) => {
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
  expect(g, '★그룹 = 떠 있음(IAL 유지) · 섹션 직속 · B·C 같은 그룹 · C 흐름에서 빠짐').toEqual({ same: true, overlay: 'true', parentIsSec: true, cInFlow: false });
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

/* undo-annotation-selection-222.dom.spec.js — 시트 222 UNDO-DROPS-ANNOTATION-SELECTION-PANEL-CLOSES-01(S6 185 곁 관찰 · 지디 새 줄)
 *   증상(앱 ×3 · 7f3c6de2): 치수선을 고른 채 방향 단추 → ⌘Z ⇒ 고름이 풀리고 패널이 닫힌다(값은 되돌아간다).
 *   읽은 뿌리: ⌘Z 의 선택 복원(js/history.js _captureSelection)은 «캔버스 선택 블록» 셀렉터(CANVAS_SEL_BLOCKS_AND_SHAPE)로 고른 것 하나를 찾는다 —
 *     그 셀렉터에 annotation-block 이 없다 ⇒ 치수선을 고른 채 쌓은 칸의 selection = null ⇒ 복원 뒤 아무것도 안 고른다.
 * 칸
 *   ★⌘Z 가 되살리는 고름 = «돌아가는 칸»에 적힌 고름이다(_restoreSelection(snap.selection)). 패널 칸은 바꾼 «뒤»에 쌓으므로(push-after)
 *     고른 뒤 «첫» 바꿈의 ⌘Z 는 고르기 전 칸으로 간다 ⇒ 고름이 풀리는 것은 일반 블록도 같다(하네스 ×1 · 글 블록 · 보고서) — 222 몫 아님.
 *     ⇒ 이 spec 은 «돌아가는 칸이 치수선을 고른 채 쌓였는데도 풀리는» 것만 잰다: 바꿈 둘(첫 칸이 고른 채 쌓인다) 뒤 ⌘Z · ⌘Z 뒤 ⌘⇧Z.
 *   K1 ★방향 가로 → 세로 → ⌘Z — 값은 가로로 · 고름·패널(#annot-dim-axis)은 남는다
 *   K2 ★선 두께 5 → 6 → ⌘Z — 같은 것(방향 단추 하나만의 일이 아님을 본다)
 *   K3 ★방향 → ⌘Z → ⌘⇧Z — 값은 다시 가로 · 고름·패널 남음
 *   N1 [음성대조] 아무것도 안 고른 채 바꾼 칸(코드로 dimAxis 바꾸고 push) ⌘Z — 고름 0 (되살리며 «새로» 고르지 않는다)
 * 고침: _captureSelection 이 «그 함수 안에서만» .annotation-block.selected 도 잡는다 · _restoreSelection 은 window._selectAnnotation 한 벌로 다시 고른다.
 * 양성대조: 고치기 전 판(809d7cf5) ⇒ K1·K2·K3 빨강 · N1 초록. 사본에서 _captureSelection 의 넓힘 한 줄 걷음 ⇒ K1·K2·K3 빨강.
 * 기대값은 앱이 쥔 값(dataset)에서 · 고르기 = 라벨 실클릭 · 단추 = 실클릭 · ⌘Z = 실제 키. ⛔고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const D = [200, 160], C = [500, 260];

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(([D, C]) => {
    document.getElementById('canvas').innerHTML = '<div class="section-block" id="secA" style="position:relative;height:520px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.(); window.clearHistory?.();
    const sec = document.getElementById('secA');
    const mid = [(D[0] + C[0]) / 2 + 30, (D[1] + C[1]) / 2 - 60];
    const place = window.annotDimPlaceAt([D, C], mid, { dimAxis: 'auto' });
    const b = window.makeAnnotationBlock({ points: [D, C], text: '수치입력', annotKind: 'dim', dimA: place.dimA, dimB: place.dimB });
    b.id = 'annA'; sec.appendChild(b); window.bindAnnotationSelect?.(b); window.deselectAll?.(); window.buildLayerPanel?.();
    /* 치수선이 «있는» 칸 하나 — 185 앱 탐침(증상 ×3)과 같은 순서. ⚠️도구 길(annotation-tool.js _finalizeAnnotation)은 만들기 «전» 한 칸만 쌓는다 —
       그 순서만 두면 패널 첫 바꿈의 ⌘Z 가 치수선을 통째로 지운다(하네스 ×1 · 앱 도구 길은 안 잼 · 보고서 곁 관찰). 이 spec 은 222(고름)만 잰다. */
    window.pushHistory?.('치수선 추가');
  }, [D, C]);
  return errs;
}
const state = (page) => page.evaluate(() => {
  const b = document.getElementById('annA');
  return { exists: !!b, axis: b ? (b.dataset.dimAxis || 'auto') : null, sw: b ? b.dataset.strokeWidth || null : null,
    selected: !!(b && b.classList.contains('selected')), panel: !!document.getElementById('annot-dim-axis'), tip: window.getHistoryTip?.().action };
});
async function pick(page) {
  const r = await waitStableRect(page, '#annA .annot-label');
  await page.mouse.click(r.cx, r.cy);
  await expect.poll(() => state(page).then(s => s.selected && s.panel), '[전제] 골라졌고 패널이 열렸다').toBe(true);
}
async function key(page, k) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press(k);
}

test('K1 ★방향 가로 → 세로 → ⌘Z — 값은 가로로 · 고름·패널은 남는다', async ({ page }) => {
  const errs = await setup(page);
  await pick(page);
  const b = await waitStableRect(page, '#annot-dim-axis .prop-align-btn[data-axis="h"]');
  await page.mouse.click(b.cx, b.cy);
  await expect.poll(() => state(page).then(s => s.axis), '[전제] 가로가 됐다').toBe('h');
  const v = await waitStableRect(page, '#annot-dim-axis .prop-align-btn[data-axis="v"]');
  await page.mouse.click(v.cx, v.cy);
  await expect.poll(() => state(page).then(s => s.axis), '[전제] 세로가 됐다').toBe('v');
  const before = await state(page);
  await key(page, 'Meta+z');
  await expect.poll(() => state(page).then(s => s.axis), '[전제] ⌘Z 로 가로로 되돌았다').toBe('h');
  const after = await state(page);
  console.log('[K1] ' + JSON.stringify({ before, after }));
  expect(after.exists).toBe(true);
  expect({ selected: after.selected, panel: after.panel }, `★⌘Z 뒤 고름·패널 ${JSON.stringify(after)}`).toEqual({ selected: true, panel: true });
  expect(errs).toEqual([]);
});

test('K2 ★선 두께 5 → 6 → ⌘Z — 값은 5 로 · 고름·패널은 남는다', async ({ page }) => {
  const errs = await setup(page);
  await pick(page);
  for (const w of ['5', '6']) {
    await page.fill('#annot-stroke-w-num', w);
    await page.dispatchEvent('#annot-stroke-w-num', 'change');
    await expect.poll(() => state(page).then(s => s.sw), `[전제] 두께 ${w}`).toBe(w);
  }
  const before = await state(page);
  await key(page, 'Meta+z');
  await expect.poll(() => state(page).then(s => s.sw), '[전제] ⌘Z 로 두께 5 로 되돌았다').toBe('5');
  const after = await state(page);
  console.log('[K2] ' + JSON.stringify({ before, after }));
  expect({ selected: after.selected, panel: after.panel }, `★⌘Z 뒤 고름·패널 ${JSON.stringify(after)}`).toEqual({ selected: true, panel: true });
  expect(errs).toEqual([]);
});

test('K3 ★방향 → ⌘Z → ⌘⇧Z — 값은 다시 가로 · 고름·패널 남음', async ({ page }) => {
  const errs = await setup(page);
  await pick(page);
  const b = await waitStableRect(page, '#annot-dim-axis .prop-align-btn[data-axis="h"]');
  await page.mouse.click(b.cx, b.cy);
  await expect.poll(() => state(page).then(s => s.axis), '[전제] 가로가 됐다').toBe('h');
  await key(page, 'Meta+z');
  await expect.poll(() => state(page).then(s => s.axis), '[전제] ⌘Z').toBe('auto');
  await key(page, 'Meta+Shift+z');
  await expect.poll(() => state(page).then(s => s.axis), '[전제] ⌘⇧Z 로 다시 가로').toBe('h');
  const after = await state(page);
  console.log('[K3] ' + JSON.stringify(after));
  expect({ selected: after.selected, panel: after.panel }, `★⌘⇧Z 뒤 고름·패널 ${JSON.stringify(after)}`).toEqual({ selected: true, panel: true });
  expect(errs).toEqual([]);
});

test('N1 [음성대조] 안 고른 채 쌓은 칸 ⌘Z — 고름 0(새로 고르지 않는다)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { const b = document.getElementById('annA'); b.dataset.dimAxis = 'v'; window.pushHistory?.('치수선 방향'); });
  expect((await state(page)).selected, '[전제] 아무것도 안 골랐다').toBe(false);
  await key(page, 'Meta+z');
  await expect.poll(() => state(page).then(s => s.axis), '[전제] ⌘Z 로 값이 되돌았다').toBe('auto');
  const after = await state(page);
  console.log('[N1] ' + JSON.stringify(after));
  expect({ selected: after.selected, panel: after.panel }).toEqual({ selected: false, panel: false });
  expect(errs).toEqual([]);
});

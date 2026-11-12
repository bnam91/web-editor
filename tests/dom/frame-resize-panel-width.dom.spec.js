/* frame-resize-panel-width — FRAME-RESIZE-PANEL-WIDTH-STALE-01 (0.9.12 · 미카사 발주16 곁 관찰 261110 · int-5).
 * 중첩 프레임을 모서리 손잡이로 넓힌 직후 우측 패널 너비 칸이 옛 값(307) 그대로였다(다시 고르면 새 값 · 값·저장은 맞음).
 * 뿌리: 프레임 손잡이 onUp(overlay-handles.js _onHandleMouseDown)이 패널을 다시 안 그렸다(그리드 손잡이는 그린다).
 * 장면·고르기·끌기는 nested-frame-width-cap.dom.spec.js 를 그대로 옮겼다(사람 손 클릭·더블클릭·se 손잡이).
 *   FP1 free/stack 부모 안 K · FP2 섹션 직속 P — 끈 직후 #ss-width-num/#ss-height-num 이 dataset 과 같다
 * 양성대조: overlay-handles.js 의 FRAME-RESIZE-PANEL-WIDTH-STALE-01 두 줄만 지우면 FP1 빨강(FP2 는 판정 안 함 — 원래 맞았는지 안 쟀다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const f2 = (p) => p.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
/** 섹션 직속 P(500×400 · free|stack) 안에 들어가(진입) 만든 K(부모 80%) */
async function scene(page, kind) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(async (kind) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = [...c.querySelectorAll('.section-block')].pop(); window.applyZoom?.(50);
    window.deselectAll(); window.selectSection(sec); window._activeFrame = null; window.addFrameBlock();
    const P = [...sec.querySelectorAll('.frame-block')].pop(); P.id = 'P';
    if (kind === 'stack') delete P.dataset.freeLayout;
    window.updateFrameBlock?.('P', { width: 500, height: 400 });
    window.deselectAll(); P.classList.add('selected'); window._activeFrame = P; window._enteredFrame = P; window.addFrameBlock(); window._enteredFrame = null;
    const K = [...P.querySelectorAll('.frame-block')].pop(); K.id = 'K';
    window.deselectAll(); window.clearHistory?.();
  }, kind);
  await f2(page);
  return errs;
}
const read = (page) => page.evaluate(() => {
  const K = document.getElementById('K'), P = document.getElementById('P'), kr = K.getBoundingClientRect(), pr = P.getBoundingClientRect();
  const z = pr.width / P.offsetWidth;
  // 부모 오른쪽 변 바로 밖(자식이 넘친 자리) — 잘렸으면 거기서 K 를 못 맞힌다
  const probe = kr.right > pr.right + 20 ? document.elementFromPoint(pr.right + 10, (kr.top + kr.bottom) / 2) : null;
  return { Kw: K.offsetWidth, KmaxW: K.style.maxWidth, Pw: P.offsetWidth, Ph: P.offsetHeight, Pover: getComputedStyle(P).overflow,
    over: Math.round((kr.right - pr.right) / z), hitOutside: probe ? (K.contains(probe) || probe === K) : null };
});
/* 고르기는 «사람 손»으로 — P = P 여백 한 번 클릭 · K = P 여백 클릭 → K 더블클릭(한 겹 내려가 오브젝트로 고름). 스크립트로 .selected 만 달면 쌓기 자식은 손잡이 배선이 안 선다(바탕 판도 같음 · 실측). */
async function pick(page, id) {
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); }); await f2(page);
  const pc = await page.evaluate(() => { const r = document.getElementById('P').getBoundingClientRect(); return [r.right - 6, r.bottom - 6]; });
  await page.mouse.click(pc[0], pc[1]); await f2(page);
  if (id === 'K') { const kc = await page.evaluate(() => { const r = document.getElementById('K').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await page.mouse.dblclick(kc[0], kc[1]); await f2(page); }
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected') && !!document.querySelector('#ss-handles-overlay .ss-resize-handle.se'), id);
}
async function dragEast(page, id, dx) {
  await pick(page, id);
  const h = await page.evaluate(() => { const e = document.querySelector('#ss-handles-overlay .ss-resize-handle.se'); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await page.mouse.move(h[0], h[1]); await page.mouse.down();
  await page.mouse.move(h[0] + dx, h[1] + 4, { steps: 8 }); await page.mouse.up(); await f2(page);
}

const panel = (page, id) => page.evaluate((id) => { const e = document.getElementById(id);
  return { w: +document.getElementById('ss-width-num')?.value, h: +document.getElementById('ss-height-num')?.value, dw: parseInt(e.dataset.width), dh: parseInt(e.dataset.height) }; }, id);

for (const kind of ['free', 'stack']) {
  test(`FP1 ${kind} 부모 안 프레임 — 손잡이로 넓힌 직후 패널 너비 칸이 새 값`, async ({ page }) => {
    const errs = await scene(page, kind);
    await pick(page, 'K');
    const a = await panel(page, 'K');
    expect(a.w, '[전제] 고른 직후 패널 = 자식 폭').toBe(a.dw);
    await dragEast(page, 'K', 120);
    const b = await panel(page, 'K');
    expect(b.dw, '[전제] 손잡이가 폭을 바꿨다').toBeGreaterThan(a.dw);
    expect(b.w, `패널 너비 칸 ${b.w} — 실제 ${b.dw}`).toBe(b.dw);
    expect(b.h).toBe(b.dh);
    expect(errs).toEqual([]);
  });
}

test('FP2 섹션 직속 프레임 — 손잡이로 넓힌 직후 패널 너비 칸이 새 값', async ({ page }) => {
  const errs = await scene(page, 'free');
  await page.evaluate(() => window.updateFrameBlock?.('P', { width: 400, height: 400 }));
  await pick(page, 'P');
  const a = await panel(page, 'P');
  await dragEast(page, 'P', 100);
  const b = await panel(page, 'P');
  expect(b.dw, '[전제] 손잡이가 폭을 바꿨다').toBeGreaterThan(a.dw);
  expect(b.w).toBe(b.dw);
  expect(errs).toEqual([]);
});

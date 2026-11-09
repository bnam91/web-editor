/* stack-drop-into-nested-stack-t2-09b — 스택 프레임 S 안 블럭을 «자유 프레임 P 안의 스택 프레임 N» 에 끌어 놓으면 N 이 아니라 P 에 떨어졌다.
 * 까닭: 진입 안 한 P 의 자손(N 포함)은 pointer-events:none(css/editor-blocks.css «덮개») ⇒ dragover·drop 을 P 가 받는다.
 * ★고침 = P 의 dragover·drop 이 포인터 아래 «가장 깊은 프레임»(block-drag.js _frameUnderPointer — 이미 있던 함수)을 찾아 그 프레임에 넘긴다. CSS 무접촉.
 * 끌기는 진짜 마우스 HTML5 끌기(frame-drop-keeps-block-365 와 같은 꼴 · B안: 스택 안 블럭은 스택 클릭 → 블럭 더블클릭으로 고른다).
 * 양성대조: js/block-drag.js 를 e7d97f1ec 판으로 돌리면 T1 빨강(블럭이 P 직속). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';

const open = async (page) => { await page.setViewportSize({ width: 1500, height: 1400 }); await bootApp(page); await page.evaluate(() => window.applyZoom(40)); await waitZoomSettled(page, 40); };
/* S = 스택(흐름) 프레임 + 안에 자산 블럭 · P = 자유 프레임 · N = P 안의 스택 프레임(그 안에 갭 하나 — 비면 높이가 0 에 가깝다) */
const scene = (page) => page.evaluate(async (FR) => {
  const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop();
  const addFrame = (h, into) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = into || null; window.addFrameBlock(); const f = [...(into || sec).querySelectorAll(FR)].filter(x => x !== into).pop(); window.updateFrameBlock(f.id, { width: into ? 500 : 700, height: h }); return f; };
  const toStack = (f) => { delete f.dataset.freeLayout; delete f.dataset.height; f.style.height = ''; f.style.minHeight = ''; };
  const S = addFrame(300); toStack(S); S.dataset.fullWidth = 'true';
  window.deselectAll(); window.selectSection(sec); window._activeFrame = S; await window.addAssetBlock();
  const blk = S.querySelector('.asset-block'); if (!blk.id) blk.id = 'blk_t209b';
  const P = addFrame(600);
  const N = addFrame(300, P); toStack(N);
  window.deselectAll(); window.selectSection(sec); window._activeFrame = N; window.addGapBlock?.();
  window.deselectAll(); window._activeFrame = null; window.clearHistory?.(); P.scrollIntoView({ block: 'center' });
  return { blk: blk.id, S: S.id, P: P.id, N: N.id, nInP: N.parentElement === P, nAbs: N.style.position, nH: N.offsetHeight };
}, FR);
const center = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
const STEPS = 12;
async function dragTo(page, from, to) { await page.mouse.move(from[0], from[1]); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(from[0] + (to[0] - from[0]) * i / STEPS, from[1] + (to[1] - from[1]) * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }
async function pickInStack(page, s) {
  const r = await page.evaluate((a) => { const b = document.getElementById(a).getBoundingClientRect(); return [b.left + 6, b.top + 6]; }, s.S);
  await page.mouse.click(r[0], r[1]); await raf(page);
  const from = await center(page, s.blk); await page.mouse.dblclick(from[0], from[1]); await raf(page);
}
const host = (page, s) => page.evaluate(({ blk, P, N, S }) => { const f = document.getElementById(blk).closest('.frame-block:not([data-text-frame])'); return f?.id === N ? 'N' : f?.id === P ? 'P' : f?.id === S ? 'S' : (f?.id || null); }, s);

test('T1 ★스택 안 블럭 → 자유 프레임 P 안 스택 N 에 놓으면 N 에 든다', async ({ page }) => {
  await open(page);
  const s = await scene(page); await raf(page);
  expect([s.nInP, s.nAbs], '전제: N 은 P 안 · 좌표 배치').toEqual([true, 'absolute']);
  expect(s.nH, '전제: N 에 높이가 있다').toBeGreaterThan(20);
  await pickInStack(page, s);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), s.blk), '전제: 블럭이 골라졌다').toBe(true);
  await dragTo(page, await center(page, s.blk), await center(page, s.N));
  expect(await host(page, s), '놓인 프레임').toBe('N');
});
test('T2 대조 — P 의 N 밖 자리에 놓으면 종전대로 P 에 든다', async ({ page }) => {
  await open(page);
  const s = await scene(page); await raf(page);
  await pickInStack(page, s);
  const to = await page.evaluate(({ P, N }) => { const p = document.getElementById(P).getBoundingClientRect(), n = document.getElementById(N).getBoundingClientRect(); return [p.left + (p.width) / 2, Math.max(n.bottom + 20, p.bottom - 30)]; }, s);
  await dragTo(page, await center(page, s.blk), to);
  expect(await host(page, s), '놓인 프레임').toBe('P');
});

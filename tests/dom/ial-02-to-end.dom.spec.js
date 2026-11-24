/* ial-02-to-end.dom.spec.js — 0.9.13 187행 IAL-02(현빈 승인 261122): 맨 앞/맨 뒤(⇧⌘] / ⇧⌘[) 살리기.
 *   옛 ⇧ 갈래(editor.js «도달 불가» 핸들러)는 앞 metaKey 블록이 먼저 잡아 한 번도 안 돌았다 ⇒ ⇧⌘[ ] 도 한 칸만 움직였다.
 *   T1 떠 있는 도형 셋(S1 S2 S3) — S1 고르고 ⇧⌘] = 맨 앞(형제 끝) · ⇧⌘[ = 맨 뒤(형제 처음) · 이력 이름 «맨 앞으로 가져오기»
 *   T2 흐름 블럭 셋(A B C) — A 고르고 ⇧⌘] = 맨 아래(흐름 끝) · ⌘[ 한 칸은 그대로 한 칸
 *   장면 = float-unit-insert-cmdarrow 와 같은 꼴(addSection · enterFloat · 실제 키) */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, floats) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (floats) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); sec.id = 'sE'; window.applyZoom?.(100);
    const inner = sec.querySelector('.section-inner'); [...inner.children].forEach((x) => { if (!x.classList.contains('drop-indicator')) x.remove(); });
    const add = (fn, tag) => { const before = new Set(inner.children); window.deselectAll(); window.selectSection(sec); fn(); const u = [...inner.children].find((x) => !before.has(x)); u.dataset.probe = tag; return u; };
    if (floats) {
      const us = ['S1', 'S2', 'S3'].map((t) => add(() => window.addShapeBlock('rectangle'), t));
      const m = await import(new URL('js/overlay-float.js', document.baseURI).href); us.forEach((u) => m.enterFloat(u));
    } else {
      ['A', 'B', 'C'].forEach((t) => add(() => window.addTextBlock('body'), t));
    }
    window.deselectAll(); window.clearHistory?.();
  }, floats);
  await waitZoomSettled(page, 100);
  return errs;
}
const floatOrder = (page) => page.evaluate(() => [...document.getElementById('sE').children].map((x) => x.dataset.probe).filter(Boolean));
const flowOrder = (page) => page.evaluate(() => [...document.querySelector('#sE .section-inner').children].map((x) => x.dataset.probe).filter(Boolean));

test('T1 떠 있는 도형 — ⇧⌘] = 맨 앞 · ⇧⌘[ = 맨 뒤(한 번에 끝까지)', async ({ page }) => {
  const errs = await scene(page, true);
  expect(await floatOrder(page), '[전제] 떠 있는 셋 = 섹션 직속 S1 S2 S3').toEqual(['S1', 'S2', 'S3']);
  await page.evaluate(() => { const f = document.querySelector('#sE [data-probe="S1"]'); window.deselectAll(); window.selectShapeBlock(f.querySelector('.shape-block')); });
  await page.keyboard.press('Meta+Shift+BracketRight'); await raf(page);
  expect(await floatOrder(page), '★⇧⌘] = 맨 앞(형제 끝)까지 한 번에(옛: 한 칸 = S2 S1 S3)').toEqual(['S2', 'S3', 'S1']);
  await page.keyboard.press('Meta+Shift+BracketLeft'); await raf(page);
  expect(await floatOrder(page), '★⇧⌘[ = 맨 뒤(형제 처음)까지 한 번에').toEqual(['S1', 'S2', 'S3']);
  expect(errs).toEqual([]);
});

test('T2 흐름 블럭 — ⇧⌘] = 흐름 끝까지 · ⌘[ 는 그대로 한 칸', async ({ page }) => {
  const errs = await scene(page, false);
  expect(await flowOrder(page), '[전제] 흐름 A B C').toEqual(['A', 'B', 'C']);
  await page.evaluate(() => { const u = document.querySelector('#sE [data-probe="A"]'); window.deselectAll(); const tb = u.querySelector('.text-block'); tb.classList.add('selected'); u.closest('.section-block').classList.add('selected'); });
  await page.keyboard.press('Meta+Shift+BracketRight'); await raf(page);
  expect(await flowOrder(page), '★⇧⌘] = 맨 아래까지').toEqual(['B', 'C', 'A']);
  await page.keyboard.press('Meta+BracketLeft'); await raf(page);
  expect(await flowOrder(page), '⌘[ = 한 칸(무변 규약)').toEqual(['B', 'A', 'C']);
  expect(errs).toEqual([]);
});

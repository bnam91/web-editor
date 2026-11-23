/* ial-03-rehome.dom.spec.js — 0.9.13 188행 IAL-03(지디 승인 261124 «새는 길 재현 0 → 방어»).
 *   ① 떠 있는 상자가 .section-inner 흐름 사이에 끼어 있으면(옛 판 데이터) ⌘[ ⌘] 가 그 상자를 지나쳤다(㈎ = 섹션 직속만).
 *      R1 S2 를 흐름 사이로 옮긴 장면 — S2 고르고 ⌘[ ⇒ 섹션 직속으로 돌아와 순서가 바뀐다 · 화면 자리 그대로(±1px)
 *   ③ R2 바꿀 게 없을 때 알림 — 혼자 / 이미 맨 앞 / 이미 맨 뒤
 *   장면 = ial-02-to-end 와 같은 꼴 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, n) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (n) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); sec.id = 'sE'; window.applyZoom?.(100);
    const inner = sec.querySelector('.section-inner'); [...inner.children].forEach((x) => { if (!x.classList.contains('drop-indicator')) x.remove(); });
    const add = (fn, tag) => { const before = new Set(inner.children); window.deselectAll(); window.selectSection(sec); fn(); const u = [...inner.children].find((x) => !before.has(x)); u.dataset.probe = tag; return u; };
    ['A', 'B'].forEach((t) => add(() => window.addTextBlock('body'), t));
    const us = ['S1', 'S2', 'S3'].slice(0, n).map((t) => add(() => window.addShapeBlock('rectangle'), t));
    const m = await import(new URL('js/overlay-float.js', document.baseURI).href); us.forEach((u, i) => { m.enterFloat(u); u.style.left = `${40 + i * 60}px`; u.style.top = `${30 + i * 40}px`; });
    window.deselectAll(); window.clearHistory?.();
    window.__toasts = []; const t0 = window.showToast; window.showToast = (msg, ...a) => { window.__toasts.push(String(msg)); return t0?.(msg, ...a); };
  }, n);
  await waitZoomSettled(page, 100);
  return errs;
}
const floatOrder = (page) => page.evaluate(() => [...document.getElementById('sE').children].map((x) => x.dataset.probe).filter(Boolean));
const pick = (page, tag) => page.evaluate((tag) => { const f = document.querySelector(`#sE [data-probe="${tag}"]`); window.deselectAll(); window.selectShapeBlock(f.querySelector('.shape-block')); }, tag);
const rectOf = (page, tag) => page.evaluate((tag) => { const r = document.querySelector(`#sE [data-probe="${tag}"]`).getBoundingClientRect(); return [r.left, r.top]; }, tag);

test('R1 흐름 사이에 낀 떠 있는 상자 — ⌘[ 전에 섹션 직속으로 · 자리 그대로 · 순서 바뀜', async ({ page }) => {
  const errs = await scene(page, 3);
  await page.evaluate(() => { const s2 = document.querySelector('#sE [data-probe="S2"]'); const b = document.querySelector('#sE [data-probe="B"]'); b.before(s2); });   // 옛 판 데이터 흉내: A S2 B
  expect(await floatOrder(page), '[전제] 섹션 직속 = S1 S3(S2 는 흐름 사이)').toEqual(['S1', 'S3']);
  const before = await rectOf(page, 'S2');
  await pick(page, 'S2');
  await page.keyboard.press('Meta+BracketLeft'); await raf(page);
  expect(await floatOrder(page), '★S2 가 섹션 직속으로 돌아와(끝) 한 칸 뒤로 = S1 S2 S3').toEqual(['S1', 'S2', 'S3']);
  const after = await rectOf(page, 'S2');
  expect(Math.abs(after[0] - before[0]) <= 1 && Math.abs(after[1] - before[1]) <= 1, `★화면 자리 그대로 ${before} → ${after}`).toBe(true);
  expect(errs).toEqual([]);
});

test('R2 바꿀 게 없을 때 알림 — 혼자 · 이미 맨 앞 · 이미 맨 뒤', async ({ page }) => {
  const errs = await scene(page, 2);
  await pick(page, 'S2'); await page.keyboard.press('Meta+BracketRight'); await raf(page);
  await pick(page, 'S1'); await page.keyboard.press('Meta+BracketLeft'); await raf(page);
  await page.evaluate(() => document.querySelector('#sE [data-probe="S2"]').remove());
  await pick(page, 'S1'); await page.keyboard.press('Meta+BracketRight'); await raf(page);
  expect(await page.evaluate(() => window.__toasts), '★알림 셋').toEqual(['이미 맨 앞이에요', '이미 맨 뒤예요', '겹친 상대가 없어 순서를 바꿀 수 없어요']);
  expect(errs).toEqual([]);
});

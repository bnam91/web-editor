/* kscale-esc-handles — 0.9.13 t13F-02(텍스트 K 스케일 → Esc 뒤 꼭지점 손잡이 안 보임 · 수평·수직만) · 현빈 261122 · 태양
 *   뿌리: K 동안 흐름 글 = 옛 모서리(data-tf-resize-dir) + 상자 «변» 넷(data-tbx-dir n/s/e/w). textScaleExit 는 표식만 지우고
 *     손잡이를 다시 안 그려 → 옛 모서리는 rAF 가드가 걷고 변 넷만 남았다(보통 꼴 = 모서리+변 여덟 · t13D-10).
 *   고침: js/text-scale-tool.js textScaleExit — 아직 골라져 있으면 showHandlesFor 로 보통 손잡이를 다시.
 * K1 흐름 글 — K(변 넷 + 옛 모서리 넷) → Esc → 상자 손잡이 여덟(모서리 넷 포함) · 옛 모서리 0 · 선택 남음
 * K2 같은 끝 길 둘(K 다시 · V) 도 여덟
 * 양성대조: _patches/kscale-esc-CTL.patch(다시 그리기 한 줄 걷음) ⇒ K1·K2 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.waitForFunction(() => typeof window.textScaleToggle === 'function' && typeof window.exitToolModes === 'function', null, { polling: 100 });
  await page.evaluate(() => {
    window.__admin = { ...(window.__admin || {}), state: () => ({ isAdmin: true }) };   // [전제] 상자 손잡이 = 관리자만(t13E-10)
    window.applyZoom?.(100);
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); sec.id = 'S';
    sec.querySelectorAll('.frame-block[data-text-frame]').forEach((t) => (t.closest('.row') || t).remove());
    window.deselectAll(); window.selectSection(sec); window.addTextBlock('body');
    const tb = [...sec.querySelectorAll('.text-block')].pop(); tb.id = 'TB';
    const t = tb.querySelector('[class^="tb-"]'); t.id = 'TC'; t.textContent = '스케일 시험 글'; delete t.dataset.isPlaceholder;
    window.rebindAll?.(); window.deselectAll(); window.clearHistory?.();
  });
  return errs;
}
const hs = (page) => page.evaluate(() => ({
  box: [...document.querySelectorAll('#ss-handles-overlay [data-tbx-dir]')].map((h) => h.dataset.tbxDir).sort().join(','),
  old: document.querySelectorAll('#ss-handles-overlay [data-tf-resize-dir]').length,
  sel: !!document.getElementById('TB')?.classList.contains('selected'),
}));
const ALL8 = ['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w'].join(',');
async function pickAndK(page) {
  const r = await waitStableRect(page, '#TC');
  await page.mouse.click(r.cx, r.cy);
  await expect.poll(async () => (await hs(page)).box, '[전제] 고르면 상자 손잡이 여덟').toBe(ALL8);
  await page.keyboard.press('k');
  await expect.poll(async () => { const x = await hs(page); return [x.box, x.old]; }, '[전제] K = 변 넷 + 옛 모서리 넷').toEqual(['e,n,s,w', 4]);
}

test('K1 K → Esc → 상자 손잡이 여덟(꼭지점 포함) · 옛 모서리 0 · 선택 남음', async ({ page }) => {
  const errs = await scene(page);
  await pickAndK(page);
  await page.keyboard.press('Escape');
  await expect.poll(async () => hs(page), '★Esc 뒤 = 보통 꼴(모서리+변 여덟)').toEqual({ box: ALL8, old: 0, sel: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('K2 K 다시 · V 로 끝내도 여덟', async ({ page }) => {
  const errs = await scene(page);
  await pickAndK(page);
  await page.keyboard.press('k');
  await expect.poll(async () => hs(page), '★K 다시').toEqual({ box: ALL8, old: 0, sel: true });
  await page.keyboard.press('k');
  await expect.poll(async () => (await hs(page)).old, '[전제] K 켜짐').toBe(4);
  await page.keyboard.press('v');
  await expect.poll(async () => hs(page), '★V').toEqual({ box: ALL8, old: 0, sel: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* decorblur-clear-keeps-key — 0.9.13 DECORBLUR-CLEAR-KEEPS-KEY-01(탑 · 지디 GO 261125)
 * 결함(srv 실측): 흐림(setFxDecorBlur on) → clearAssetImage → dataset.decorBlur 가 남는다 ⇒ 새 그림도 말없이 흐려진다.
 *   가림(data-redact)은 걷힌다(image-handling.js clearAssetImage 의 applyRedact(ab,0) · delete redactOff).
 * C1 흐림 켬 → 그림 지움 → decorBlur·decorBlurOff·--decor-blur 없음 → 새 그림 img filter none
 * C2 흐림 끔(눈) → 그림 지움 → decorBlurOff 없음 → 새 그림에 «끈 흐림 카드» 없음
 * C3 [대조] 가림 켬 → 그림 지움 → redact 없음 → 새 그림 filter none (옛 동작 · 지킴)
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

/* 그림 = 페이지 안 canvas PNG(img-fx-decor-blur 꼴) — 줄무늬라 흐림이 걸리면 filter 로 바로 보인다 */
const PNG_IN_PAGE = `(c) => { const cv = document.createElement('canvas'); cv.width = 120; cv.height = 90; const x = cv.getContext('2d'); for (let i = 0; i < 120; i += 12) { x.fillStyle = c; x.fillRect(i, 0, 6, 90); x.fillStyle = '#ffff00'; x.fillRect(i + 6, 0, 6, 90); } return cv.toDataURL('image/png'); }`;

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await bootApp(page);
  await page.evaluate(async (mk) => {
    const src = (0, eval)(mk)('#0000ff');
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); window.applyZoom?.(100);
    const sec = c.querySelector('.section-block');
    const { row, block } = window.makeAssetBlock(); sec.querySelector('.section-inner').appendChild(row); window.bindBlock?.(block); window.rebindAll?.();
    block.id = 'abC'; window.setAssetImageFromSrc(block, src);
  }, PNG_IN_PAGE);
  await waitZoomSettled(page, 100);
  await page.waitForFunction(() => document.querySelector('#abC .asset-img')?.complete, null, { timeout: 15000 });
}
/* 지우고 → 새 그림 → 상태 */
const clearAndRefill = (page) => page.evaluate(async (mk) => {
  const src = (0, eval)(mk)('#ff0000');
  const ab = document.getElementById('abC');
  window.clearAssetImage(ab);
  const afterClear = { on: ab.dataset.decorBlur ?? null, off: ab.dataset.decorBlurOff ?? null, redact: ab.dataset.redact ?? null, redactOff: ab.dataset.redactOff ?? null, varDecor: ab.style.getPropertyValue('--decor-blur') || null };
  window.setAssetImageFromSrc(ab, src);
  const img = ab.querySelector('.asset-img');
  await new Promise((r) => (img.complete ? r() : img.addEventListener('load', r, { once: true })));
  return { afterClear, after: { on: ab.dataset.decorBlur ?? null, off: ab.dataset.decorBlurOff ?? null, redact: ab.dataset.redact ?? null, filter: getComputedStyle(img).filter, fx: window.fxDecorBlurOf(ab).state } };
}, PNG_IN_PAGE);

test('C1 흐림 켬 → 그림 지움 → 흐림 키 없음 · 새 그림 filter none', async ({ page }) => {
  await scene(page);
  await page.evaluate(() => window.setFxDecorBlur(document.getElementById('abC'), { state: 'on', v: 8 }, { history: false }));
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#abC .asset-img')).filter)).toBe('blur(8px)');
  const r = await clearAndRefill(page);
  expect(r.afterClear).toEqual({ on: null, off: null, redact: null, redactOff: null, varDecor: null });
  expect(r.after.on).toBeNull();
  expect(r.after.filter).toBe('none');
  expect(r.after.fx).toBe('none');
});

test('C2 흐림 끔(눈) → 그림 지움 → decorBlurOff 없음 · 끈 카드 안 붙음', async ({ page }) => {
  await scene(page);
  await page.evaluate(() => window.setFxDecorBlur(document.getElementById('abC'), { state: 'off', v: 12 }, { history: false }));
  const r = await clearAndRefill(page);
  expect(r.afterClear.off).toBeNull();
  expect(r.after.off).toBeNull();
  expect(r.after.fx).toBe('none');
});

test('C3 [대조] 가림 켬 → 그림 지움 → redact 없음 · 새 그림 filter none', async ({ page }) => {
  await scene(page);
  await page.evaluate(() => window.setFxBlur(document.getElementById('abC'), { state: 'on', v: 40 }, { history: false }));
  const r = await clearAndRefill(page);
  expect(r.afterClear.redact).toBeNull();
  expect(r.after.redact).toBeNull();
  expect(r.after.filter).toBe('none');
});

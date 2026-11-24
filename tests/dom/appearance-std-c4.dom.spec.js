/* appearance-std-c4.dom.spec.js — 표준 Appearance A4·A5 갈래 C4(탑 261125 · PLAN-appearance-layout-std-261124 §4 A4·A5 · 정본 시안 8910 #mkp-appstd)
 *   A4 = Opacity 칸(op) — frame · modal · banner02 · radial · shape · grid · icon-circle · gradient · vector
 *        (Appearance 절이 없던 블럭은 Opacity 만 든 새 절 · 머리 [눈] 보류 표식) · 칸 id = `${prefix}-opacity`
 *        계약(갈래 E 몫 · 여기선 시험이 가짜로 끼운다): window.setBlockOpacity(block, v 0~100) · window.readBlockOpacity(block)
 *   A5 = shape «가림막»(redact 방식·강도·블러) → Effects 절(id·키 무변 · 동작 무변)
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/appearance-std-c4.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
/* [이름, 더하기, 고르기(블럭 식), 패널 함수, 접두] */
const BLOCKS = [
  ['frame', 'window.addFrameBlock()', "document.querySelector('#canvas .frame-block.selected')", 'showFrameProperties', 'ss'],
  ['modal', 'window.addModalBlock({})', "[...document.querySelectorAll('#canvas .modal-block')].pop()", 'showModalProperties', 'mdl'],
  ['banner02', 'window.addBanner02Block()', "[...document.querySelectorAll('#canvas .banner02-block')].pop()", 'showBanner02Properties', 'bn2'],
  ['radial', 'window.addRadialBlock()', "[...document.querySelectorAll('#canvas .radial-block')].pop()", 'showRadialProperties', 'rdl'],
  ['shape', "window.addShapeBlock('rectangle')", "[...document.querySelectorAll('#canvas .shape-block')].pop()", 'showShapeProperties', 'shape'],
  ['grid', 'window.addGridBlock()', "[...document.querySelectorAll('#canvas .grid-block')].pop()", 'showGridProperties', 'grd'],
  ['icon-circle', 'window.addIconCircleBlock()', "[...document.querySelectorAll('#canvas .icon-circle-block')].pop()", 'showIconCircleProperties', 'icb'],
  ['gradient', 'window.addGradientBlock()', "[...document.querySelectorAll('#canvas .gradient-block')].pop()", 'showGradientProperties', 'grad'],
  ['vector', `window.addVectorBlock(${JSON.stringify(SVG)}, { w: 80, h: 80 })`, "[...document.querySelectorAll('#canvas .vector-block')].pop()", 'showVectorProperties', 'vb'],
];

async function scene(page, add, pick, show) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ([add, pick, show]) => {
    window.__op = [];   // 갈래 E 계약 가짜 — 100 이면 키 지움
    window.setBlockOpacity = (b, v) => { window.__op.push([b === window.__b, v]); if (v >= 100) delete b.dataset.opacity; else b.dataset.opacity = String(v); };
    window.readBlockOpacity = (b) => (b.dataset.opacity != null ? Number(b.dataset.opacity) : 100);
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    await (0, eval)(add);
    window.__b = (0, eval)(pick);
    window[show](window.__b);
  }, [add, pick, show]);
  return errs;
}
const setNum = (page, id, v) => page.evaluate(([id, v]) => { const n = document.getElementById(id); n.value = String(v); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const countHistory = (page) => page.evaluate(() => { window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); }; });

for (const [name, add, pick, show, pfx] of BLOCKS) {
  test(`AC1 ${name} Appearance 절 = Opacity 칸(${pfx}-opacity · 표준 칸 · 머리 눈) → setBlockOpacity(그 블럭 · 40) · 이력 1 · 다시 그리면 40`, async ({ page }) => {
    const errs = await scene(page, add, pick, show);
    const o = await page.evaluate((pfx) => {
      const n = document.getElementById(`${pfx}-opacity`);
      return {
        field: !!n?.closest('.prop-section[data-sec="appearance"] [data-part="appearance"] [data-field="appearance-opacity"]'),
        v: n?.value ?? null,
        eye: document.querySelector(`#panel-right .prop-sec-head #${pfx}-app-eye`)?.getAttribute('aria-disabled') ?? null,
        scrub: !!document.getElementById(`${pfx}-opacity-scrub`),
      };
    }, pfx);
    expect(o).toEqual({ field: true, v: '100', eye: 'true', scrub: true });
    await countHistory(page);
    await setNum(page, `${pfx}-opacity`, 40);
    expect(await page.evaluate(() => [window.__op.at(-1), window.__ph, window.__b.dataset.opacity])).toEqual([[true, 40], 1, '40']);
    await page.evaluate((show) => window[show](window.__b), show);
    expect(await page.inputValue(`#${pfx}-opacity`)).toBe('40');
    expect(errs).toEqual([]);
  });
}

test('AC2 shape 가림막 = Effects 절(A5) — 토글·방식·강도 id 무변 · Appearance 절엔 없음 · 켜면 shapeRedact · 강도 12 → shapeRedactBlur 12 · Appearance = Opacity 그대로', async ({ page }) => {
  const errs = await scene(page, BLOCKS[4][1], BLOCKS[4][2], BLOCKS[4][3]);
  const where = () => page.evaluate(() => ['shape-redact-toggle', 'shape-redact-controls', 'shape-redact-mode-seg', 'shape-redact-blur-num', 'shape-opacity']
    .map((id) => document.getElementById(id)?.closest('.prop-section[data-sec]')?.dataset.sec ?? null));
  expect(await where()).toEqual(['effects', 'effects', 'effects', 'effects', 'appearance']);
  await page.click('#shape-redact-toggle');
  await expect.poll(() => page.evaluate(() => window.__b.dataset.shapeRedact ?? null)).toBe('true');
  expect(await where(), '★켠 뒤 다시 그려도 Effects').toEqual(['effects', 'effects', 'effects', 'effects', 'appearance']);
  await setNum(page, 'shape-redact-blur-num', 12);
  expect(await page.evaluate(() => window.__b.dataset.shapeRedactBlur)).toBe('12');
  expect(await page.evaluate(() => !!document.querySelector('#panel-right .prop-section[data-sec="appearance"] [id^="shape-redact"]'))).toBe(false);
  expect(errs).toEqual([]);
});

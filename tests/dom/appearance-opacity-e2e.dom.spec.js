/* appearance-opacity-e2e.dom.spec.js — 패널 Opacity 칸 → 갈래 E «진짜» window.setBlockOpacity(js/block-opacity.js) 끝까지(탑 통합 261125)
 *   갈래 spec(appearance-std-c1~c4)은 계약을 가짜로 끼워 쟀다 → 여기선 가짜 없이: 칸 40 → 대상 dataset.opacity '40' · style.opacity 0.4 · 이력 1 · 다시 그리면 40 · 100 → 키·인라인 지움
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/appearance-opacity-e2e.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* [이름, 더하기, 고르기, 패널 함수, 접두] — 갈래마다 하나 이상(C1 gap · C4 frame·shape·grid) */
const BLOCKS = [
  ['gap', 'window.addGapBlock()', "[...document.querySelectorAll('#canvas .gap-block')].pop()", 'showGapProperties', 'gap'],
  ['frame', 'window.addFrameBlock()', "document.querySelector('#canvas .frame-block.selected')", 'showFrameProperties', 'ss'],
  ['shape', "window.addShapeBlock('rectangle')", "[...document.querySelectorAll('#canvas .shape-block')].pop()", 'showShapeProperties', 'shape'],
  ['grid', 'window.addGridBlock()', "[...document.querySelectorAll('#canvas .grid-block')].pop()", 'showGridProperties', 'grd'],
];

for (const [name, add, pick, show, pfx] of BLOCKS) {
  test(`OE1 ${name} — ${pfx}-opacity 40 → 진짜 setBlockOpacity · 0.4 · 이력 1 · 다시 그리면 40 · 100 → 지움`, async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 1100 });
    const errs = await bootApp(page);
    const real = await page.evaluate(async ([add, pick, show]) => {
      const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
      const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
      await (0, eval)(add);
      window.__b = (0, eval)(pick);
      window[show](window.__b);
      window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); };
      return typeof window.setBlockOpacity === 'function' && /_target/.test(String(window.setBlockOpacity));
    }, [add, pick, show]);
    expect(real, '전제: 갈래 E 의 진짜 setBlockOpacity 가 있다').toBe(true);
    const set = (v) => page.evaluate(([id, v]) => { const n = document.getElementById(id); n.value = String(v); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, [`${pfx}-opacity`, v]);
    /* 대상 = E 가 고르는 요소(readBlockOpacity 가 읽는 곳) — dataset 을 든 요소를 블럭 안팎에서 찾는다 */
    const state = () => page.evaluate(() => {
      const b = window.__b; const el = b.dataset.opacity != null ? b : (b.closest('[data-opacity]') || b.querySelector('[data-opacity]') || b);
      return { read: window.readBlockOpacity(b), ds: el.dataset.opacity ?? null, css: el.style.opacity || null, ph: window.__ph };
    });
    await set(40);
    expect(await state()).toEqual({ read: 40, ds: '40', css: '0.4', ph: 1 });
    await page.evaluate((show) => window[show](window.__b), show);
    expect(await page.inputValue(`#${pfx}-opacity`)).toBe('40');
    await set(100);
    expect(await state()).toEqual({ read: 100, ds: null, css: null, ph: 2 });
    expect(errs).toEqual([]);
  });
}

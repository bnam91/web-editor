/* appearance-std-c1.dom.spec.js — 표준 Appearance A4 Opacity 갈래 C1(graph · chat · divider · bridge · quote · gap — table·comparison 은 대성 갈래로 이관 261125)
 *   (정본 시안 8910 #mkp-appstd · PLAN-appearance-layout-std-261124 §3 A4 · 탑 발주 tp0914-c1)
 *   Appearance 절이 없던 블럭 = 새 절(Opacity 만 · 모서리 칸·단추 없음) · 있던 블럭(chat) = Opacity 가 R 앞 칸
 *   계약(갈래 E 몫 · 여기선 가짜): window.setBlockOpacity(block, v 0~100) · window.readBlockOpacity(block) → 0~100 · 100 = 키 지움
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/appearance-std-c1.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, add, cls, show) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ([add, cls, show]) => {
    window.__op = [];
    window.setBlockOpacity = (b, v) => { window.__op.push(v); if (v >= 100) { delete b.dataset.opacity; b.style.opacity = ''; } else { b.dataset.opacity = String(v); b.style.opacity = String(v / 100); } };
    window.readBlockOpacity = (b) => (b.dataset.opacity != null ? Number(b.dataset.opacity) : 100);
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    (0, eval)(add);
    window[show]([...document.querySelectorAll('#canvas .' + cls)].pop());
  }, [add, cls, show]);
  return errs;
}
const setNum = (page, id, v) => page.evaluate(([id, v]) => { const n = document.getElementById(id); n.value = String(v); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);

/* [이름, 만들기, class, 패널 함수, 접두, 모서리 칸 있나] */
for (const [name, add, cls, show, pfx, radius] of [
  ['gap', 'window.addGapBlock()', 'gap-block', 'showGapProperties', 'gap', false],
  ['bridge', 'window.addBridgeBlock()', 'bridge-block', 'showBridgeProperties', 'brg', false],
  ['divider', 'window.addDividerBlock()', 'divider-block', 'showDividerProperties', 'dvd', false],
  ['graph', 'window.addGraphBlock()', 'graph-block', 'showGraphProperties', 'grb', false],
  ['quote', 'window.addQuoteBlock()', 'quote-block', 'showQuoteProperties', 'qt', false],
  ['chat', 'window.addChatBlock()', 'chat-block', 'showChatProperties', 'chb', true],
]) {
  test(`AC1 ${name} Appearance Opacity 칸 — 부품 안 · 100 · 모서리 ${radius ? '있음(R 앞)' : '없음'} · 40 = 계약 + 키 · 이력 1 · 다시 그리면 40`, async ({ page }) => {
    const errs = await scene(page, add, cls, show);
    const o = await page.evaluate((pfx) => {
      const n = document.getElementById(pfx + '-opacity');
      const row = n?.closest('.ui-s2-main');
      return {
        inPart: !!n?.closest('[data-part="appearance"] [data-field="appearance-opacity"]'),
        sec: n?.closest('.prop-section[data-sec]')?.dataset.sec ?? null,
        v: n?.value ?? null,
        first: row?.querySelector('input[type=number]') === n,
        corners: !!document.getElementById(pfx + '-corners'),
        radius: !!row?.querySelector('[data-field="appearance-radius"]'),
      };
    }, pfx);
    expect(o).toEqual({ inPart: true, sec: 'appearance', v: '100', first: true, corners: radius, radius });
    await page.evaluate(() => { window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); }; });
    await setNum(page, pfx + '-opacity', 40);
    const op = () => page.evaluate((cls) => [...document.querySelectorAll('#canvas .' + cls)].pop()?.dataset.opacity ?? null, cls);
    await expect.poll(op).toBe('40');
    expect(await page.evaluate(() => window.__ph)).toBe(1);
    await page.evaluate(([cls, show]) => window[show]([...document.querySelectorAll('#canvas .' + cls)].pop()), [cls, show]);
    expect(await page.inputValue('#' + pfx + '-opacity')).toBe('40');
    await setNum(page, pfx + '-opacity', 150);
    await expect.poll(op, '★150 → 100 = 키 지움(계약)').toBe(null);
    expect(errs).toEqual([]);
  });
}

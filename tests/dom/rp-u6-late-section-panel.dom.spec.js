/* rp-u6-late-section-panel — 늦게 온 섹션 패널이 더 최신인 블럭 패널을 덮지 않는다 (right-panel-unify U6 R9).
 * 원인: showSectionProperties 는 async(await _presetsReady) — 같은 태스크에서 selectSection → 블럭 추가·선택이면 섹션 패널이 «뒤에» 도착한다.
 *   옛 가드는 «섹션이 아직 골라져 있으면» 그렸는데, 섹션 안 블럭을 고르면 섹션도 .selected 로 남는다(selectShapeBlock) ⇒ 도형 패널이 섹션 패널로 갈렸다
 *   (rp-u4-panel-hygiene H1·H2·X1 의 «액션 직후 패널이 갈림»).
 * L1 같은 태스크: selectSection → addShapeBlock(그 안에서 selectShapeBlock) → 두 프레임 뒤에도 패널 = 도형(#shape-rot-slider) · 섹션 패널 칸(#sec-padx-number) 없음
 * L2 [지킴] 섹션만 고르면 섹션 패널이 «늦게라도» 선다(가드가 섹션 패널 자체를 막지 않는다)
 * 양성대조: prop-section.js 의 `if (panelRenderGen() !== _gen0) return;` 한 줄 삭제 → L1 빨강(섹션 패널로 갈림) · L2 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const f2 = (p) => p.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); window.__sec = c.querySelector('.section-block'); window.deselectAll?.();
  });
  await f2(page);
  return errs;
}
const panel = (page) => page.evaluate(() => ({ shape: !!document.getElementById('shape-rot-slider'), section: !!document.getElementById('sec-padx-number') }));

test('L1 같은 태스크 selectSection → 도형 추가·선택 → 패널은 도형 그대로', async ({ page }) => {
  const errs = await scene(page);
  const sync = await page.evaluate(() => { window.selectSection(window.__sec); window.addShapeBlock('ellipse'); return !!document.getElementById('shape-rot-slider'); });
  expect(sync, '[전제] 추가 직후(동기) 패널 = 도형').toBe(true);
  await f2(page);
  expect(await panel(page), '★늦게 온 섹션 패널이 도형 패널을 덮었다').toEqual({ shape: true, section: false });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L2 [지킴] 섹션만 고르면 섹션 패널이 선다', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => window.selectSection(window.__sec));
  await page.waitForFunction(() => !!document.getElementById('sec-padx-number'), null, { timeout: 3000 }).catch(() => {});
  expect(await panel(page)).toEqual({ shape: false, section: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

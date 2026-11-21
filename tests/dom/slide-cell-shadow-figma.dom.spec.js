/* slide-cell-shadow-figma — SLIDE-CELL-SHADOW-FIGMA-01(현빈 «반드시» · 지디 261121 안B) 보내는 쪽: 칸 그림자를 Figma JSON 칸 프레임에 싣는다.
 *   렌더러 쪽(감싸개 «슬라이드 그림자 여백» · DROP_SHADOW · 흐름 높이 지킴) = 단위 figma-slide-cell-shadow R1~R3.
 * J1 새 블럭(칸 셋 · 옅은 그림자) → buildFigmaExportJSON 슬라이드 프레임 칸 block.shadow = {y 18 · blur 50 · rgba(0,0,0,0.22)} · 한 칸 «진하게» → 그 칸만 {10 · 28 · .32}
 * J2 [지킴] 그림자 끔(칸 셋) → shadow 키 0(옛 JSON)
 * 양성대조: _patches/slide-shadow-figma-json-CTL.patch(싣는 줄의 _sh 를 null) → J1 빨강.
 * 셀렉터·전역 대조(제품 소스 grep): addSlideBlock · renderSlideBlock · flushCurrentPage · buildFigmaExportJSON · CELL_SHADOWS(slide-block.js window)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function menuScene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    const made = window.addSlideBlock();   // 추가 메뉴 onclick 과 같은 입구 · 칸 셋 · 칸마다 옅은 그림자
    made.block.scrollIntoView({ block: 'center' });
    return made.block.id;
  });
  return { errs, id };
}
const shadows = (page, id) => page.evaluate((id) => {
  window.flushCurrentPage?.();
  let node = null; const walk = (o) => { if (node || !o || typeof o !== 'object') return; if (o.id === id) { node = o; return; } Object.values(o).forEach(walk); };
  walk(window.buildFigmaExportJSON?.(null));
  return node ? node.children.map((m) => m.block?.shadow ?? null) : 'no-node';
}, id);

test('J1 칸 그림자 → JSON 칸 프레임 shadow 값(칸마다 제 값)', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const SOFT = { y: 18, blur: 50, color: 'rgba(0,0,0,0.22)' }, STRONG = { y: 10, blur: 28, color: 'rgba(0,0,0,0.32)' };
  const a = await shadows(page, id);
  expect(Array.isArray(a) && a.length >= 2, `[전제] 슬라이드 프레임 칸이 실림 ${JSON.stringify(a)}`).toBe(true);
  expect(a, '★칸마다 옅은 그림자 값').toEqual(a.map(() => SOFT));
  await page.evaluate((id) => { const b = document.getElementById(id); b.querySelector('.sld-cell').dataset.shadow = 'strong'; window.renderSlideBlock(b); }, id);
  const b = await shadows(page, id);
  expect(b, '★첫 칸만 진하게').toEqual([STRONG, ...b.slice(1).map(() => SOFT)]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('J2 [지킴] 그림자 끔 → shadow 키 0', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  await page.evaluate((id) => { const b = document.getElementById(id); b.querySelectorAll('.sld-cell').forEach((c) => delete c.dataset.shadow); window.renderSlideBlock(b); }, id);
  const a = await shadows(page, id);
  expect(Array.isArray(a) && a.length >= 2, `[전제] 칸이 실림 ${JSON.stringify(a)}`).toBe(true);
  expect(a, '★키 0(옛 JSON)').toEqual(a.map(() => null));
  expect(errs, errs.join(' | ')).toEqual([]);
});

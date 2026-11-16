/* shape-star-round — NEW-현빈QA-SHAPE-STAR-CORNER-ROUNDNESS-01 «star 블럭도 꼭짓점 곡률 조절 가능하게»(현빈 블럭 shp_6jh6q_fghutoi 는 증상 참고 — 시험은 픽스처 별).
 *   진짜 길: addShapeBlock('star') → 우측 패널 «꼭짓점 둥글기 %»(shape-star-round-num · 톱니 «끝 둥글기 %»와 같은 slider+number 꼴).
 * S1 둥글기 40 → polygon 점 70(꼭짓점 10 × 7) · 끝 반지름이 옛 별보다 안쪽 · data-star-round 40 · 0 으로 되돌리면 옛 점 문자열 그대로 + 키 지움
 * S2 갯수 3 + 둥글기 → 별 셋 다 같은 꼴(점 70) · 저장 왕복(serializeProject → applyProjectData) 뒤에도 같은 점 · 패널 다시 열면 40
 * 양성대조(예측 · CTL): js/props/prop-shape.js _applyStarGeom 의 `block.dataset.starScales, block.dataset.starRound` 에서 `, block.dataset.starRound` 삭제 → S1·S2 빨강
 * 셀렉터·전역 대조(제품 소스 grep): window.addShapeBlock · window.showShapeProperties · #shape-star-round-num/-slider(prop-shape.js 별 패널) · #shape-star-count-num(같은 패널) ·
 *   window.serializeProject · window.applyProjectData(save-load.js) · .shape-block svg polygon
 * Figma: 옛 판은 별 내보내기가 «별 하나 고정 꼴»이었다(갯수·통통함·둥글기 0건) → 261117 SHAPE-STAR-FIGMA-EXPORT-FIXED-FORM-01 이 캔버스 SVG 를 싣게 고쳤다(tests/unit/figma-star-export-0912).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" style="background:#fff;"><div class="section-hitzone"><span class="section-label">A</span></div><div class="section-inner"></div></div>';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 900 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
    window.selectSection?.(document.getElementById('sA'));
    window.addShapeBlock('star');
  }, SEC);
  await page.waitForFunction(() => !!document.querySelector('#canvas .shape-block svg polygon'), null, { timeout: 15000 });
  await openPanel(page);
  return errs;
}
const openPanel = async (page) => {
  await page.evaluate(() => window.showShapeProperties(document.querySelector('#canvas .shape-block')));
  await expect(page.locator('#shape-star-round-num'), '[전제] «꼭짓점 둥글기» 칸').toHaveCount(1);
};
const setNum = (page, id, v) => page.evaluate(([i, val]) => {
  const n = document.getElementById(i); n.value = String(val);
  n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, v]);
const geo = (page) => page.evaluate(() => {
  const b = document.querySelector('#canvas .shape-block');
  const polys = [...b.querySelectorAll('svg polygon')].map((p) => p.getAttribute('points'));
  const pts = polys[0].split(' ').map((q) => q.split(',').map(Number));
  return { polys, n: pts.length, rMax: Math.max(...pts.map(([x, y]) => Math.hypot(x - 100, y - 98.66))), key: b.dataset.starRound ?? null };
});

test('S1 둥글기 40 → 꼭짓점이 둥글다 · 0 = 옛 별', async ({ page }) => {
  const errs = await setup(page);
  const g0 = await geo(page);
  expect(g0.n, '[전제] 옛 별 = 점 10').toBe(10);
  await setNum(page, 'shape-star-round-num', 40);
  const g1 = await geo(page);
  expect(g1.n, '★꼭짓점마다 곡선(10 × 7)').toBe(70);
  expect(g1.rMax, `★끝이 안 둥글다 — ${g0.rMax.toFixed(1)} → ${g1.rMax.toFixed(1)}`).toBeLessThan(g0.rMax - 1);
  expect(g1.key, '저장 키').toBe('40');
  await setNum(page, 'shape-star-round-num', 0);
  const g2 = await geo(page);
  expect([g2.polys[0], g2.key], '0 = 옛 점 그대로 · 키 지움').toEqual([g0.polys[0], null]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S2 별 셋 + 둥글기 — 셋 다 같은 꼴 · 저장 왕복 · 패널 값', async ({ page }) => {
  const errs = await setup(page);
  await setNum(page, 'shape-star-count-num', 3);
  await page.waitForFunction(() => document.querySelectorAll('#canvas .shape-block svg polygon').length === 3, null, { timeout: 15000 });
  await openPanel(page);
  await setNum(page, 'shape-star-round-num', 40);
  const g1 = await geo(page);
  expect(g1.polys.map((p) => p.split(' ').length), '★별 셋 다 둥글다').toEqual([70, 70, 70]);
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); window.applyProjectData(d); });
  await page.waitForFunction(() => document.querySelectorAll('#canvas .shape-block svg polygon').length === 3, null, { timeout: 15000 });
  const g2 = await geo(page);
  expect([g2.polys, g2.key], '★저장 왕복 뒤 같은 점·키').toEqual([g1.polys, '40']);
  await openPanel(page);
  expect(await page.inputValue('#shape-star-round-num'), '패널 다시 열면 40').toBe('40');
  expect(errs, errs.join(' | ')).toEqual([]);
});

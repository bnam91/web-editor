/* asset-align-stale-margin.dom.spec.js — 현빈 「좌측정렬인데 왼쪽으로 튀어나감」 (B6, 2026-10-03)
 * 실물(proj_1786077501267 / ab_lns8z1r)의 «꼴»: row[stack] > 에셋 width:720px + margin ±72px(풀블리드가 심은 음수마진의
 *   «반쪽 세트»), 섹션 좌우 패딩 60(마진 72 ≠ 패딩 60 — 옛 padX 의 흔적). 에셋은 패딩 제외(use-padx 기본 켬) 상태.
 * 원인: 정렬 단추(prop-asset applyAlign)가 align-self 만 바꿨다 — 폭이 px 로 고정된 에셋에 남은 음수마진이
 *   좌 정렬이면 왼쪽(-72), 우 정렬이면 오른쪽으로 섹션 안쪽 경계를 넘긴다(가운데만 상쇄).
 * 대조: 진짜 풀블리드(폭 calc(100% + 2·padX), 마진 -padX)는 바깥으로 뻗는 게 «의도» — 정렬을 눌러도 그대로.
 * 전제 단언: 배율(currentZoom)이 실제로 100/40 인지 먼저 단언한다.
 * ⛔앱 통째 헤드리스(bootApp). 실행: npx playwright test --config=tests/dom/playwright.dom.config.js asset-align-stale-margin --workers=2
 * ★양성대조: GD1001_ROOT=<604602cd 체크아웃> 이면 같은 시험이 옛 판을 잰다(빨강이어야 한다). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = (abHtml) => `<div class="section-block" data-section="1" id="sec1"><div class="section-hitzone"></div>
  <div class="section-inner" style="padding-left: 60px; padding-right: 60px;" data-padding-x="60">
    <div class="row" data-layout="stack">${abHtml}</div></div></div>`;
const AB = (id, align, w, ml) =>
  `<div class="asset-block" id="${id}" data-align="${align}" data-overlay="false" style="align-self: ${align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'}; margin-left: ${ml}px; margin-right: ${ml}px; width: ${w}; height: 300px;" data-size="100" data-base-height="300"><div class="asset-overlay"></div></div>`;

async function setup(page, html, zoom) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await bootApp(page);
  await page.evaluate(([h, z]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    window.applyZoom?.(z);
  }, [html, zoom]);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.currentZoom), '전제: 배율이 실제로 걸렸다').toBe(zoom);
}
const pos = (page) => page.evaluate(() => {
  const ab = document.getElementById('ab'), inner = ab.closest('.section-inner');
  const ir = inner.getBoundingClientRect(), ar = ab.getBoundingClientRect(), sc = ir.width / inner.offsetWidth;
  const cs = getComputedStyle(inner), pl = parseFloat(cs.paddingLeft) * sc, pr = parseFloat(cs.paddingRight) * sc;
  return { left: (ar.left - (ir.left + pl)) / sc, right: ((ir.right - pr) - ar.right) / sc, w: ar.width / sc };
});
const pressAlign = async (page, a) => {
  await page.evaluate(() => window.showAssetProperties(document.getElementById('ab')));
  await page.waitForTimeout(100);
  await page.click(`#asset-align-group [data-align="${a}"]`);
  await page.waitForTimeout(100);
};

for (const zoom of [100, 40]) {
  for (const w of ['720px', '400px', '200px']) {
    for (const a of ['left', 'center', 'right']) {
      test(`${a} × 폭 ${w} × 배율 ${zoom}% ★섹션 안쪽(패딩) 경계를 안 넘는다`, async ({ page }) => {
        await setup(page, SEC(AB('ab', 'center', w, -72)), zoom);
        await pressAlign(page, a);
        const p = await pos(page);
        expect(p.left, '왼쪽 경계').toBeGreaterThanOrEqual(-1);
        expect(p.right, '오른쪽 경계').toBeGreaterThanOrEqual(-1);
        if (a === 'left') expect(Math.abs(p.left)).toBeLessThanOrEqual(1);
        if (a === 'right') expect(Math.abs(p.right)).toBeLessThanOrEqual(1);
        if (a === 'center') expect(Math.abs(p.left - p.right)).toBeLessThanOrEqual(1);
        expect(p.w, '폭은 그대로').toBeCloseTo(parseFloat(w), 0);
      });
    }
  }
}

for (const zoom of [100, 40]) {
  test(`대조 — 진짜 풀블리드(패딩 제외, calc 폭 + 마진 -60)는 정렬을 눌러도 바깥으로 뻗는다 (배율 ${zoom}%)`, async ({ page }) => {
    await setup(page, SEC(AB('ab', 'left', 'calc(100% + 120px)', -60)), zoom);
    const before = await pos(page);
    expect(before.left, '전제: 풀블리드는 패딩 밖으로 60 뻗는다').toBeCloseTo(-60, 0);
    await pressAlign(page, 'left');
    const after = await pos(page);
    expect(after.left).toBeCloseTo(-60, 0);
    expect(after.w).toBeCloseTo(before.w, 0);
    expect(await page.evaluate(() => document.getElementById('ab').style.marginLeft)).toBe('-60px');
  });
}

/* ── 적대QA(0e) ① 폭 741~859px(콘텐츠 폭 740 초과) + 음수마진은 정렬 단추가 «건드리지 않는다» — 걷으면 오른쪽이 섹션 밖으로 잘린다 ── */
for (const zoom of [100, 40]) {
  test(`경계 — 폭 859px · margin -60 · 좌정렬 → 마진 그대로(오른쪽이 더 잘리지 않는다) (배율 ${zoom}%)`, async ({ page }) => {
    await setup(page, SEC(AB('ab', 'center', '859px', -60)), zoom);
    await pressAlign(page, 'left');
    const m = await page.evaluate(() => { const a = document.getElementById('ab'); return [a.style.marginLeft, a.style.marginRight, a.style.width]; });
    expect(m).toEqual(['-60px', '-60px', '859px']);
  });
}

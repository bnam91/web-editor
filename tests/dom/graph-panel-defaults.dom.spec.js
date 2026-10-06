/* graph-panel-defaults.dom.spec.js — 그래프 패널 숫자 칸 대체값 == 그려지는 값 (태양 lane-graph-panel 2026-10-05 · PANEL-SHOWS-WRONG 꼴)
 * 옛: 키 없는 새 그래프 → 패널 13·0·60 ↔ 렌더 20·16·라벨×3 (명부 E105 = 13≠20 · E106 · E110).
 * 고침: GRAPH_LIMITS.LABEL_SIZE_DEFAULT · LINE_PADX_DEFAULT · PCT_SIZE_FACTOR(graph-limits.js 한 자리)를 렌더러·패널이 같이 읽는다.
 * 양성대조: dev 끝(기준) 나무 안 → L1 · E106 · E110 빨강 · L2 초록(키가 있으면 옛날에도 같았다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-panel-defaults.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function newGraph(page, chartType, labelSize) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(([chartType, labelSize]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.selectSection(document.getElementById('sG')); window.addGraphBlock({ chartType });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    if (labelSize) { g.dataset.labelSize = String(labelSize); window.renderGraph(g); }
    window.deselectAll?.(); return g.id;
  }, [chartType, labelSize || 0]);
  // 실클릭으로 고른다(패널이 «사람이 보는» 길로 열린다) — 멈춘 rect
  let prev = null, p = null;
  for (let k = 0; k < 40; k++) { p = await page.evaluate((id) => { const g = document.getElementById(id); g.scrollIntoView({ block: 'center' }); const r = g.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height * 0.3)]; }, id); if (prev && prev.join() === p.join()) break; prev = p; await page.waitForTimeout(150); }
  await clickAt(page, p[0], p[1], { sel: '.graph-block' }, { label: '그래프 선택' });
  await page.waitForSelector('#grb-label-number', { timeout: 3000 });
  return { errs, id };
}
const read = (page, id, sel) => page.evaluate(([id, sel]) => ({ panel: +document.getElementById('grb-label-number').value, slider: +document.getElementById('grb-label-slider').value, drawn: parseFloat(getComputedStyle(document.getElementById(id).querySelector(sel)).fontSize), key: document.getElementById(id).dataset.labelSize ?? null }), [id, sel]);

for (const [type, sel] of [['bar-v', '.grb-bar-label'], ['line', '.grb-line-xlabel']]) {
  test(`L1 ★${type} 새 그래프(labelSize 키 없음): 패널 라벨 크기 == 그려진 글자 크기`, async ({ page }) => {
    const { errs, id } = await newGraph(page, type);
    const r = await read(page, id, sel);
    expect(r.key, '전제: 키 없음').toBe(null);
    expect({ panel: r.panel, slider: r.slider }).toEqual({ panel: r.drawn, slider: r.drawn });
    expect(errs).toEqual([]);
  });
}
test('L2 키가 있으면(17) 패널 == 글자(옛날에도 같았다 — 음성대조)', async ({ page }) => {
  const { errs, id } = await newGraph(page, 'bar-v', 17);
  const r = await read(page, id, '.grb-bar-label');
  expect(r).toEqual({ panel: 17, slider: 17, drawn: 17, key: '17' });
  expect(errs).toEqual([]);
});

test('E106 ★꺾은선 새 그래프: 패널 «좌우 패딩» == 16 == 그려진 첫 점 x(SVG 가상폭 단위)', async ({ page }) => {
  const { errs, id } = await newGraph(page, 'line');
  const r = await page.evaluate((id) => {
    const g = document.getElementById(id), path = g.querySelector('.grb-line-path');
    const first = path.tagName === 'polyline' ? +path.getAttribute('points').trim().split(/[\s,]+/)[0] : +path.getAttribute('d').match(/M\s*([\d.]+)/)[1];
    return { panel: +document.getElementById('grb-padx-number').value, slider: +document.getElementById('grb-padx-slider').value, firstX: Math.round(first), key: g.dataset.padX ?? null };
  }, id);
  expect(r).toEqual({ panel: 16, slider: 16, firstX: 16, key: null });
  expect(errs).toEqual([]);
});
test('E110 ★가로 막대 · 라벨 크기 18(숫자 크기 키 없음): 패널 «숫자 크기» == 54 == 그려진 % 글자', async ({ page }) => {
  const { errs, id } = await newGraph(page, 'bar-h', 18);
  const r = await page.evaluate((id) => ({ panel: +document.getElementById('grb-pct-size-number').value, drawn: parseFloat(getComputedStyle(document.getElementById(id).querySelector('.grb-bar-h-pct')).fontSize), key: document.getElementById(id).dataset.pctSize ?? null }), id);
  expect(r).toEqual({ panel: 54, drawn: 54, key: null });
  expect(errs).toEqual([]);
});

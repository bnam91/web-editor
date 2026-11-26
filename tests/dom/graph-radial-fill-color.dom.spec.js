/* graph-radial-fill-color.dom.spec.js — 0.9.13 204행 GRAPH-RADIAL-FILL-COLOR-ZERO-01(탑 261123 곁 발견).
 *   병: 방사형(chartType radial) Fill «라벨 색상 / 카테고리 색상» 칸이 검정 견본 · HEX 빈칸 · 0% —
 *       graphFieldShown(canvas-contrast.js GRAPH_FIELD_PARTS.xlabel)이 막대·선·원형 라벨 클래스만 찾고 방사형 .grb-radial-label 을 몰라 빈 값.
 *   R1 방사형 패널: 라벨 색 칸(grb-label · grb-xlabel 있으면 둘 다) HEX = 그려진 .grb-radial-label 색 · 불투명도 100
 *   R2 [음성] 막대(bar-v) — 카테고리 칸 = 그려진 색 · 합친 «라벨 색상» = Mix(옛 길 무변 · E149) */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const hex6 = (s) => { const m = (String(s).match(/[\d.]+/g) || []).map(Number); return m.length >= 3 ? m.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase() : null; };

async function open(page, type, sel) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const r = await page.evaluate(([type, sel]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection(); const S = c.querySelector('.section-block'); window.selectSection(S);
    window.addGraphBlock({ chartType: type }); const g = [...S.querySelectorAll('.graph-block')].pop(); window.renderGraph?.(g);
    window.deselectAll?.(); g.classList.add('selected'); window.showGraphProperties(g);
    const lab = g.querySelector(sel);
    const f = (p) => { const h = document.getElementById(p + '-hex'), a = document.getElementById(p + '-alpha'); return h ? { hex: h.value, ph: h.placeholder, a: a ? a.value : null } : null; };
    return { drawn: lab ? getComputedStyle(lab).color : null, label: f('grb-label'), xlabel: f('grb-xlabel') };
  }, [type, sel]);
  return { errs, r };
}

test('R1 방사형 — 라벨/카테고리 색 칸 = 그려진 라벨 색 · 100%', async ({ page }) => {
  const { errs, r } = await open(page, 'radial', '.grb-radial-label');
  expect(r.drawn, '[전제] 방사형 라벨이 그려졌다').toBeTruthy();
  const want = hex6(r.drawn);
  const fields = [r.label, r.xlabel].filter(Boolean);
  expect(fields.length, '[전제] 라벨 색 칸이 패널에 있다').toBeGreaterThan(0);
  fields.forEach((f) => expect({ hex: f.hex.toUpperCase(), a: f.a }, `★칸 = 그려진 색 ${want} · 100% (옛: 빈 HEX · 0%)`).toEqual({ hex: want, a: '100' }));
  expect(errs).toEqual([]);
});

test('R2 [음성] 막대 — 라벨 색 칸은 옛 길 그대로(그려진 색)', async ({ page }) => {
  const { errs, r } = await open(page, 'bar-v', '.grb-bar-label');
  /* 막대는 값 라벨·카테고리 라벨 색이 달라 «라벨 색상»(합친 칸) = Mix(E149 규약) — 카테고리 칸이 그려진 카테고리 라벨 색 */
  expect(r.xlabel && r.xlabel.hex.toUpperCase(), '★막대 카테고리 칸 = 그려진 색').toBe(hex6(r.drawn));
  expect(r.label && r.label.ph, '[지킴] 합친 라벨 칸 = Mix(값·카테고리 색 다름)').toBe('Mix');
  expect(errs).toEqual([]);
});

/* graph-h2.dom.spec.js — 묶음 E1 H2(현빈 2026-10-05 「격자선을 막대 뒤로」) 잠금 (태양 lane-e1-plus)
 * ★재현(REPRO H2 · d1f642ff): 격자선은 오버레이(.grb-ov · z-index 1 · 막대 뒤 DOM)에 그려져 막대 «위»에 비쳤다.
 * 고침(drag-utils.js _barVPlotGeom): 격자선만 따로 층(.grb-ov-grid-layer · z-index:-1) + 막대 줄 쌓임 맥락(z-index:0 · 격자 켤 때만).
 *   선·점·축·눈금은 그대로 위 층(.grb-ov) — 음성대조 P2 가 그것을 잰다(격자와 같이 뒤로 밀리면 안 된다).
 * 픽셀로 잰다(격자 층은 pointer-events:none 이라 elementFromPoint 로 안 보인다) — 화면 캡처 1점(asset-bg-visible-on-canvas 와 같은 자).
 * 순서 = 실앱 순서: 그래프를 진짜 클릭으로 고름 → 패널 토글(격자선 · 꺾은선)을 진짜 클릭. 격자선 잉크 = 라벨 색 #ff0000(옛 판에도 있는 규칙 — 양성대조가 같은 자로 잰다).
 * 1px 선은 소수 y 에 앉으므로 y−1·y·y+1 세 점을 잰다.
 * 양성대조: d1f642ff 나무 안 → P1 빨강(막대 위 격자선 = 빨강) · P2 P3 초록 (predict: $S/e1/predict.md).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-h2.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  const id = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.selectSection(document.getElementById('sG')); window.addGraphBlock({});
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    g.dataset.items = JSON.stringify([{ label: 'A', value: 100 }, { label: 'B', value: 70 }, { label: 'C', value: 40 }]);
    g.dataset.chartHeight = '400'; g.dataset.labelColor = '#ff0000'; window.renderGraph(g);   // 격자선 잉크 = 라벨 색(옛 판·고친 판 둘 다 그 규칙) — 빨강 × 0.2 가 막대 위에 비치면 픽셀이 바뀐다
    window.deselectAll?.(); g.scrollIntoView({ block: 'center' }); return g.id;
  });
  const r = await waitStableRect(page, `#${id}`);
  await clickAt(page, r.left + r.width * 0.05, r.top + 6, { sel: `[id="${id}"]` }, { label: '그래프 고르기' });
  await page.waitForFunction(() => !!document.getElementById('grb-show-grid'), null, { timeout: 3000 });
  return { errs, id };
}
async function toggle(page, inputId) {
  await page.evaluate((i) => document.getElementById(i).closest('.prop-toggle').scrollIntoView({ block: 'center' }), inputId);
  const r = await waitStableRect(page, `#${inputId} + .prop-toggle-track`);
  await clickAt(page, r.cx, r.cy, { sel: '.prop-toggle' }, { label: inputId });
  await page.waitForFunction((i) => document.getElementById(i).checked, inputId, { timeout: 3000 });
}
async function pixelAt(page, x, y) {
  const buf = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } });
  return page.evaluate(async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)]; }, buf.toString('base64'));
}
const rgbOf = (s) => (String(s).match(/\d+/g) || []).slice(0, 3).map(Number);
const near = (a, b, tol = 6) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

test('P1 ★H2 — 격자선이 막대를 지나는 점의 픽셀 = 막대 색(격자선 빨강이 안 비친다)', async ({ page }) => {
  const { errs, id } = await setup(page);
  await toggle(page, 'grb-show-grid');
  await page.evaluate(() => document.activeElement?.blur?.());
  const pt = await page.evaluate((id) => {
    const g = document.getElementById(id); g.scrollIntoView({ block: 'center' });
    const fill = g.querySelector('.grb-bar-fill'), fr = fill.getBoundingClientRect();
    const layer = g.querySelector('.grb-ov-grid-layer') || g.querySelector('.grb-ov');
    const lr = layer.getBoundingClientRect();
    const ys = [...g.querySelectorAll('.grb-ov-grid')].map(l => lr.top + (+l.getAttribute('y1') / 1000) * lr.height).filter(y => y > fr.top + 4 && y < fr.bottom - 4);
    return { x: fr.left + fr.width / 2, y: ys[0], bar: getComputedStyle(fill).backgroundColor, n: ys.length };
  }, id);
  expect(pt.n, `전제 — 막대를 지나는 격자선이 있다 ${JSON.stringify(pt)}`).toBeGreaterThan(0);
  const pxs = [];
  for (const dy of [-1, 0, 1]) pxs.push(await pixelAt(page, pt.x, pt.y + dy));
  const bar = rgbOf(pt.bar);
  expect(pxs.every(px => near(px, bar, 3)), `★막대 위 격자선 자리(y−1·y·y+1) 픽셀 ${JSON.stringify(pxs)} = 막대 색 ${pt.bar}(옛: 빨강 × 0.2 가 비쳐 한 줄이 다르다)`).toBe(true);
  expect(errs).toEqual([]);
});

test('P2 음성대조 — 꺾은선 점은 여전히 막대 «위»(격자와 같이 뒤로 밀리지 않는다)', async ({ page }) => {
  const { errs, id } = await setup(page);
  await toggle(page, 'grb-show-grid');
  await toggle(page, 'grb-show-line');
  await page.evaluate(() => document.activeElement?.blur?.());
  const pt = await page.evaluate((id) => {
    const g = document.getElementById(id); g.scrollIntoView({ block: 'center' });
    const dot = g.querySelector('.grb-ov-dot'), dr = dot.getBoundingClientRect(), fill = g.querySelector('.grb-bar-fill'), fr = fill.getBoundingClientRect();
    return { x: dr.left + dr.width / 2, y: dr.top + dr.height / 2 + 2, dotColor: getComputedStyle(dot).backgroundColor, bar: getComputedStyle(fill).backgroundColor, onBar: dr.left + dr.width / 2 > fr.left && dr.left + dr.width / 2 < fr.right };
  }, id);
  expect(pt.onBar, `전제 — 점이 막대 위 가로 범위 ${JSON.stringify(pt)}`).toBe(true);
  expect(near(rgbOf(pt.dotColor), rgbOf(pt.bar)), '전제 — 점 색 ≠ 막대 색').toBe(false);
  const px = await pixelAt(page, pt.x, pt.y);
  expect(near(px, rgbOf(pt.dotColor), 20), `★점 자리 픽셀 ${px} = 점 색 ${pt.dotColor}(막대 ${pt.bar} 가 아니다)`).toBe(true);
  expect(errs).toEqual([]);
});

test('P3 지킴 — 격자 끄면 격자 층 없음 · 막대 줄에 z-index 없음(옛 바이트 그대로 — GR-W0)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const r = await page.evaluate((id) => { const g = document.getElementById(id); return { layer: !!g.querySelector('.grb-ov-grid-layer'), z: /z-index/.test(g.querySelector('.grb-bars-v').getAttribute('style') || '') }; }, id);
  expect(r).toEqual({ layer: false, z: false });
  expect(errs).toEqual([]);
});

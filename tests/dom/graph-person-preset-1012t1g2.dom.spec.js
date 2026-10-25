/* graph-person-preset-1012t1g2.dom.spec.js — 1012t1G2 「사람」 실루엣 교체 · 항목별 SVG 회귀 (2026-10-25)
 * 현빈: 「각 막대마다 다른 Svg를 넣을 수도 있게 해줘(⒜ — 이미 됨) … 프리셋에 들어가있는 사람은 무슨 화장실픽토그램이니? … 다른 이쁜 걸로 바꿔줘(⒝)」
 *   P1 블럭 모양 「사람」 → 막대에 실리는 마스크(--grb-shape)를 되풀면 새 path · 옛 path 0 · 상자 비 = 76/240(늘어나지 않는다)
 *   P2 ⒜ 회귀 — 블럭은 사람 · 1번 항목만 사용자 SVG → 그 칸에만 custom 마스크 · 다른 칸은 블럭 마스크(사람)
 * 기다림은 전부 조건 — 고정 대기 0.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-person-preset-1012t1g2.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const raf2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
const OLD_BODY = 'M16 52H60Q76 52 76 68V132Q76 140 68 140Q60 140 60 132V84H56V232Q56 240 48 240Q40 240 40 232V150H36V232Q36 240 28 240Q20 240 20 232V84H16V132Q16 140 8 140Q0 140 0 132V68Q0 52 16 52Z';
const ITEMS = [{ label: '가', value: 40 }, { label: '나', value: 70 }, { label: '다', value: 100 }];
const STAR = '<svg viewBox="0 0 10 10"><path d="M5 0L10 10H0Z"/></svg>';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate((items) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sP" data-section="1" style="background:#ffffff"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.selectSection(document.getElementById('sP')); window.addGraphBlock({ chartType: 'bar-v' });
    const g = [...document.querySelectorAll('#sP .graph-block')].pop();
    if (!g) return null;
    g.dataset.items = JSON.stringify(items); window.renderGraph(g); window.deselectAll?.();
    return g.id;
  }, ITEMS);
  expect(id, '전제: 그래프 블럭이 만들어졌다').toBeTruthy();
  return { errs, id };
}
/* 블럭 줄(.grb-bars-v)과 칸(.grb-bar-col)의 --grb-shape 를 되푼 SVG 글자로 */
const masks = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id);
  const un = (v) => { const m = /data:image\/svg\+xml,([^'")]*)/.exec(v || ''); return m ? decodeURIComponent(m[1]) : ''; };
  return { block: un(g.querySelector('.grb-bars-v')?.style.getPropertyValue('--grb-shape')), cols: [...g.querySelectorAll('.grb-bar-col')].map(c => un(c.style.getPropertyValue('--grb-shape'))) };
}, id);

test('P1 사람 — 막대에 실리는 마스크가 새 실루엣(옛 화장실 픽토그램 path 0) · 상자 비 = viewBox 비', async ({ page }) => {
  const { errs, id } = await setup(page);
  expect(await page.evaluate((id) => window.setGraphShape(id, { shape: 'person' }), id)).toEqual({ ok: true, shape: 'person' });
  await raf2(page);
  const m = await masks(page, id);
  const want = await page.evaluate(() => window.GRAPH_SHAPE.GRAPH_SHAPE_PRESETS.person.svg);
  expect(m.block.length, '전제: 블럭 마스크가 섰다').toBeGreaterThan(0);
  expect(m.block, '블럭 마스크 = 내장 사람 + xmlns').toBe(want.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
  expect(m.block.includes(OLD_BODY), '옛 화장실 픽토그램 path 가 막대에 실렸다').toBe(false);
  expect(/d="[^"]*C/.test(m.block), '몸통 path 에 곡선(C)').toBe(true);
  /* ★잉크 경계 = viewBox(제어점이 밖으로 튀면 잘린다 — U6 은 끝점만 본다 · S6 적대 검수 변이 B) */
  const bb = await page.evaluate((svg) => { const h = document.createElement('div'); h.style.cssText = 'position:absolute;left:-9999px;top:0'; h.innerHTML = svg; document.body.appendChild(h);
    const s = h.querySelector('svg'); s.setAttribute('width', '76'); s.setAttribute('height', '240'); const b = s.getBBox(); h.remove(); return [b.x, b.y, b.width, b.height].map(v => Math.round(v * 10) / 10); }, want);
  expect(bb, '사람 잉크 경계 = viewBox 0 0 76 240').toEqual([0, 0, 76, 240]);
  const boxes = await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-shape-box.grb-shape-on')].map(b => [b.offsetWidth, b.offsetHeight, getComputedStyle(b.querySelector('.grb-shape-mask')).webkitMaskSize || getComputedStyle(b.querySelector('.grb-shape-mask')).maskSize]), id);
  expect(boxes.length, '상자 = 항목 수').toBe(ITEMS.length);
  for (const [w, h, ms] of boxes) {
    expect(w > 0 && h > 0, '전제: 상자에 크기').toBe(true);
    expect(Math.abs(w / h - 76 / 240), `상자 비 ${w}/${h} = 76/240(마스크가 세로로 안 늘어난다)`).toBeLessThan(0.02);
    expect(ms).toBe('100% 100%');
  }
  expect(errs).toEqual([]);
});

test('P2 ⒜ 회귀 — 블럭은 사람 · 1번 항목만 사용자 SVG → 그 칸에만 custom 마스크, 다른 칸은 블럭 모양', async ({ page }) => {
  const { errs, id } = await setup(page);
  await page.evaluate((id) => window.setGraphShape(id, { shape: 'person' }), id);
  expect(await page.evaluate(([id, svg]) => window.setGraphShape(id, { index: 1, svg }), [id, STAR])).toEqual({ ok: true, shape: 'custom' });
  await raf2(page);
  const items = await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.items), id);
  expect(items.map(it => it.shape ?? null)).toEqual([null, 'custom', null]);
  const m = await masks(page, id);
  expect(m.cols[0], '0번 칸 = 덮어쓰기 없음').toBe('');
  expect(m.cols[2], '2번 칸 = 덮어쓰기 없음').toBe('');
  expect(m.cols[1].includes('M5 0L10 10H0Z'), '1번 칸 = 불러온 SVG').toBe(true);
  expect(m.block.includes('<circle cx="38"'), '블럭 마스크는 사람 그대로').toBe(true);
  const eff = await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-shape-mask')].map(e => getComputedStyle(e).webkitMaskImage || getComputedStyle(e).maskImage), id);
  expect(eff.length).toBe(3);
  expect(eff[0]).toBe(eff[2]);
  expect(eff[1], '1번 칸만 다른 그림').not.toBe(eff[0]);
  expect(errs).toEqual([]);
});

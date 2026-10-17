/* graph-pie-1017.dom.spec.js — 1017t1 f1·f3·f4 (태양 w3f 2026-10-17)
 * 현빈: f1 원형 ↔ 범례 간격 조절 · f3 라벨 편집 테를 선택색으로 · f4 그림자를 x/y/blur/색상으로.
 * f2(조각 선택 테 파랑)는 결정 대기 — 이 파일에 없다. f5·f5-b 는 js/editor.js 전수가 필요해 이 레인에서 손대지 않았다.
 * 기다림은 전부 조건(waitForFunction · expect.poll · 로케이터 자동 대기) — 고정 대기 0(래칫 tests/unit/dom-fixed-wait-census.test.mjs W3).
 *   f1 — L1 pieLegendGap=40 → 계산된 marginTop 40px · L2 키 없음 = CSS 기본(em) 그대로 · L3 999 → 60(MAX) 클램프 · L4 기본값(16) 되쓰면 키가 지워진다 · L5 패널 칸 값
 *   f3 — M1 원형 범례 라벨 더블클릭 편집 중 outline = --sel-color 실선 · M2 편집 전엔 그 outline 이 없다 · M3 꺾은선 x축 라벨도 같다(GRB_CAT_LABEL_SEL 넷 중 둘 표본)
 *   f4 — N1 그림자 세기를 켠 뒤 x/y/blur/색상을 조절하면 계산된 filter 에 그 네 값이 실린다 · N2 세기가 «없음»이면 오버레이가 없다(프리셋 필터 그대로) ·
 *        N3 세기를 끄면 x/y/blur/색상 키가 함께 지워진다 · N4 패널 칸이 js/effects-shadow.js 의 라벨·범위 그대로(새 사용자 문장 0)
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-pie-1017.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const raf2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));

async function setup(page, { type = 'pie', items = null, extra = {} } = {}) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(({ type, items, extra }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    const S = document.getElementById('sG'); window.selectSection(S); window.addGraphBlock({ chartType: type });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    if (!g) return null;
    if (items) g.dataset.items = JSON.stringify(items);
    for (const [k, v] of Object.entries(extra)) g.dataset[k] = v;
    if (items || Object.keys(extra).length) window.renderGraph(g);
    window.deselectAll?.();
    return g.id;
  }, { type, items, extra });
  expect(id, '전제: 그래프 블럭이 만들어졌다').toBeTruthy();
  await raf2(page);
  return { errs, id };
}
const ds = (page, id, k) => page.evaluate(([id, k]) => document.getElementById(id).dataset[k] ?? null, [id, k]);
const setDs = (page, id, kv) => page.evaluate(([id, kv]) => { const b = document.getElementById(id); for (const [k, v] of Object.entries(kv)) { if (v == null) delete b.dataset[k]; else b.dataset[k] = typeof v === 'string' ? v : JSON.stringify(v); } window.renderGraph(b); }, [id, kv]);
const htmlOf = (page, id) => page.evaluate((id) => document.getElementById(id).innerHTML, id);
const openPanel = (page, id) => page.evaluate((id) => window.showGraphProperties(document.getElementById(id)), id);

/* ═══ f1 — 범례 간격 ═══ */
test.describe('1017t1f1 — 원형↔범례 간격', () => {
  test('L1 pieLegendGap=40 → 계산된 marginTop 40px', async ({ page }) => {
    const { id } = await setup(page, { type: 'pie' });
    await setDs(page, id, { pieLegendGap: '40' });
    const mt = await page.evaluate((id) => getComputedStyle(document.getElementById(id).querySelector('.grb-pie-legend')).marginTop, id);
    expect(mt).toBe('40px');
  });
  test('L2 키 없음 — innerHTML 에 margin-top 이 없다(CSS 기본 em 그대로 ⇒ G0 골든 무변)', async ({ page }) => {
    const { id } = await setup(page, { type: 'pie' });
    const h = await htmlOf(page, id);
    const legendStyle = /class="grb-pie-legend" style="([^"]*)"/.exec(h)?.[1] || '';
    expect(legendStyle, '범례 인라인 style 에 margin-top 이 없다').not.toContain('margin-top');
  });
  test('L3 999 → GRAPH_LIMITS.PIE_LEG_GAP_MAX(60) 로 클램프', async ({ page }) => {
    const { id } = await setup(page, { type: 'pie' });
    const max = await page.evaluate(() => window.GRAPH_LIMITS.PIE_LEG_GAP_MAX);
    expect(max, '전제: 한도가 0보다 크다').toBeGreaterThan(0);
    await setDs(page, id, { pieLegendGap: '999' });
    const mt = await page.evaluate((id) => getComputedStyle(document.getElementById(id).querySelector('.grb-pie-legend')).marginTop, id);
    expect(mt).toBe(`${max}px`);
  });
  test('L4 패널 슬라이더로 기본값(PIE_LEG_GAP_DEFAULT)을 되쓰면 키가 지워진다', async ({ page }) => {
    const { id } = await setup(page, { type: 'pie' });
    const dflt = await page.evaluate(() => window.GRAPH_LIMITS.PIE_LEG_GAP_DEFAULT);
    await setDs(page, id, { pieLegendGap: '40' });
    expect(await ds(page, id, 'pieLegendGap'), '전제: 키가 섰다').toBe('40');
    await openPanel(page, id);
    await page.locator('#grb-pie-leggap-number').fill(String(dflt));
    await page.locator('#grb-pie-leggap-number').dispatchEvent('change');
    expect(await ds(page, id, 'pieLegendGap'), '기본값 = 키 삭제').toBeNull();
  });
  test('L5 패널 칸 값이 지금 간격과 같다', async ({ page }) => {
    const { id } = await setup(page, { type: 'pie' });
    await setDs(page, id, { pieLegendGap: '33' });
    await openPanel(page, id);
    await expect(page.locator('#grb-pie-leggap-number')).toHaveValue('33');
  });
});

/* ═══ f3 — 라벨 편집 테 ═══ */
test.describe('1017t1f3 — 라벨 편집 중 outline = --sel-color', () => {
  test('M1 원형 범례 라벨 더블클릭 → outline 실선 · --sel-color · 배경 불투명', async ({ page }) => {
    const { id } = await setup(page, { type: 'pie', items: [{ label: '가', value: 1 }, { label: '나', value: 2 }] });
    const before = await page.evaluate((id) => {
      const lbl = document.getElementById(id).querySelector('.grb-pie-label');
      return getComputedStyle(lbl).outlineStyle;
    }, id);
    expect(before, '전제(M2): 편집 전엔 solid outline 이 없다').not.toBe('solid');
    await page.evaluate((id) => {
      const lbl = document.getElementById(id).querySelector('.grb-pie-label');
      lbl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }, id);
    const got = await page.evaluate((id) => {
      const lbl = document.getElementById(id).querySelector('.grb-pie-label');
      const cs = getComputedStyle(lbl);
      return { editable: lbl.getAttribute('contenteditable'), outlineStyle: cs.outlineStyle, bg: cs.backgroundColor };
    }, id);
    expect(got.editable, '전제: contenteditable 이 정말 켜졌다').toBe('true');
    expect(got.outlineStyle).toBe('solid');
    expect(got.bg, '배경이 투명이 아니다').not.toBe('rgba(0, 0, 0, 0)');
  });
  test('M3 꺾은선 x축 라벨도 같은 규칙(GRB_CAT_LABEL_SEL 넷 중 둘째 표본)', async ({ page }) => {
    const { id } = await setup(page, { type: 'line', items: [{ label: 'A', value: 1 }, { label: 'B', value: 2 }] });
    await page.evaluate((id) => {
      const lbl = document.getElementById(id).querySelector('.grb-line-xlabel');
      lbl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }, id);
    const got = await page.evaluate((id) => {
      const lbl = document.getElementById(id).querySelector('.grb-line-xlabel');
      return { editable: lbl?.getAttribute('contenteditable'), outlineStyle: lbl ? getComputedStyle(lbl).outlineStyle : null };
    }, id);
    expect(got.editable, '전제: contenteditable 이 켜졌다').toBe('true');
    expect(got.outlineStyle).toBe('solid');
  });
});

/* ═══ f4 — 그림자 x/y/blur/색상 ═══ */
test.describe('1017t1f4 — 그림자 x/y/blur/색상', () => {
  test('N1 세기를 켠 뒤 x/y/blur/색상을 조절하면 계산된 filter 에 네 값이 실린다', async ({ page }) => {
    const { id } = await setup(page, { type: 'pie' });
    await setDs(page, id, { dropShadow: 'soft', pieShadowX: '12', pieShadowY: '-8', pieShadowBlur: '0', pieShadowColor: '#ff0000' });
    const filter = await page.evaluate((id) => getComputedStyle(document.getElementById(id).querySelector('.grb-pie-svg')).filter, id);
    expect(filter).toContain('12px');
    expect(filter).toContain('-8px');
    expect(filter.replace(/\s+/g, ' ')).toMatch(/rgba?\(255,\s?0,\s?0/);
  });
  test('N2 세기가 「없음」이면 오버레이가 없다 — 프리셋 필터 그대로(K1 과 같은 자)', async ({ page }) => {
    const { id } = await setup(page, { type: 'pie' });
    await setDs(page, id, { pieShadowX: '12', pieShadowY: '-8' });   // dropShadow 없이 x/y 만
    const filter = await page.evaluate((id) => getComputedStyle(document.getElementById(id).querySelector('.grb-pie-svg')).filter, id);
    expect(filter, '프리셋도 오버레이도 없으면 filter 는 none').toBe('none');
  });
  test('N3 세기를 끄면 x/y/blur/색상 키가 함께 지워진다', async ({ page }) => {
    const { id } = await setup(page, { type: 'pie' });
    await setDs(page, id, { dropShadow: 'soft', pieShadowX: '12' });
    expect(await ds(page, id, 'pieShadowX'), '전제: 키가 섰다').toBe('12');
    await openPanel(page, id);
    await page.locator('#grb-drop-group .prop-align-btn[data-val="none"]').click();
    expect(await ds(page, id, 'dropShadow')).toBeNull();
    expect(await ds(page, id, 'pieShadowX'), '세기를 끄면 x 도 같이 지워진다').toBeNull();
  });
  test('N4 패널 칸 라벨·범위가 js/effects-shadow.js 그대로(새 사용자 문장 0)', async ({ page }) => {
    const { id } = await setup(page, { type: 'pie', extra: { dropShadow: 'soft' } });
    await openPanel(page, id);
    const labels = await page.locator('#grb-pie-sh-x-slider, #grb-pie-sh-y-slider, #grb-pie-sh-blur-slider').evaluateAll(els => els.map(el => el.closest('.prop-row').querySelector('.prop-label').textContent));
    expect(labels).toEqual(['X', 'Y', 'Blur']);
    const xRange = await page.evaluate(() => { const s = document.getElementById('grb-pie-sh-x-slider'); return [s.min, s.max]; });
    expect(xRange).toEqual(['-20', '20']);
  });
});

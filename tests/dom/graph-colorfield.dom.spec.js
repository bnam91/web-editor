/* graph-colorfield.dom.spec.js — E149 그래프 패널 색 칸 = «그려진 파생 전» 색 · Mix · 투명도만 = 그 색 + 투명도 (태양 lane-graph-colorfield 2026-10-05)
 * 병(실측 $S/e149): 칸마다 #222222·#4dabf7·#888888·#3b82f6 을 박아 19 칸 중 18 이 그려진 색과 달랐다. «투명도만» 고쳐도 그 틀린 hex 로
 *   명시 색이 굳었다 — 꺾은선 #111: 파랑(H6 58,120,234) → rgba(34,34,34,.5) = 26,26,26 · H6 꺼짐.
 * 고침(지디 ⒝): canvas-contrast syncGraphTone 이 «변수를 걷은 채» 읽은 선 색을 block._grbToneBase 에 둔다(JS 속성 · DOM·저장 0) ·
 *   graphFieldShown(block, field) = 칸 → (그리는 요소·속성) 표 한 자리 · prop-graph 7 종이 «데이터 값 || 그것». 라벨 색(값+카테고리) = 두 색이 다르면 Mix ·
 *   Mix(정해지지 않음)에서 «투명도만»은 색을 안 쓴다.
 * ⚠️색을 직접 고르면(투명도만이어도) 그 그래프의 자동 밝기(H6)는 꺼진다 — 명시 색 정책(기댓값으로 단언).
 * 양성대조: 8a24b96b 나무 안 → C1 C2 C3 C5 빨강 · C4(패널 열기 = 히스토리·DOM 0) 초록.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-colorfield.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const rgbOf = (s) => (String(s).match(/[\d.]+/g) || []).map(Number);
const hex6 = (s) => { const m = rgbOf(s); return m.length >= 3 ? m.slice(0, 3).map(x => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase() : null; };

async function make(page, { bg = '#ffffff', type = 'line', preset = 'default' } = {}) {
  return page.evaluate(([bg, type, preset]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100); const S = document.getElementById('sG'); window.setSectionBg(S, bg);
    window.selectSection(S); window.addGraphBlock({ chartType: type });
    const g = [...S.querySelectorAll('.graph-block')].pop(); g.dataset.preset = preset;
    if (type === 'line') g.dataset.fillArea = '1'; if (type === 'bar-v') g.dataset.showGrid = '1';
    window.renderGraph(g); window.deselectAll?.(); return g.id;
  }, [bg, type, preset]);
}
async function selectReal(page, id) {
  let prev = null, p = null;
  for (let k = 0; k < 40; k++) { p = await page.evaluate((id) => { const g = document.getElementById(id); g.scrollIntoView({ block: 'center' }); const r = (g.querySelector('svg, .grb-bar-fill-wrap, .grb-bar-h-track') || g).getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; }, id); if (prev && prev.join() === p.join()) break; prev = p; await page.waitForTimeout(150); }
  await clickAt(page, p[0], p[1], { sel: '.graph-block' }, { label: '그래프 선택' });
  await page.waitForSelector('#grb-bar-hex, #grb-label-hex', { timeout: 3000 });
}
/* 시험 쪽에서만: «파생 전» 그려진 값 = H6 변수를 잠깐 걷고 잰다(제품 함수는 안 부른다 — 같은 것을 쓰면 계산기 버그가 세탁된다) */
const drawnBase = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id), V = ['--grb-auto-grid', '--grb-auto-line', '--grb-auto-ink', '--grb-dot-hole'];
  const prev = V.map(v => g.style.getPropertyValue(v)); V.forEach(v => g.style.removeProperty(v));
  const cs = (sel, p) => { const e = g.querySelector(sel); return e ? getComputedStyle(e)[p] : null; };
  const plain = (sel) => [...g.querySelectorAll(sel)].find(e => !e.style.background && !e.style.backgroundColor);
  const t = g.dataset.chartType;
  const out = {
    bar: t === 'line' ? cs('.grb-line-path', 'stroke') : (() => { const e = plain(t === 'bar-h' ? '.grb-bar-h-fill' : '.grb-bar-fill:not(.grb-bar-fill-b)'); return e ? getComputedStyle(e).backgroundColor : null; })(),
    bar2: cs('.grb-bar-fill-b', 'backgroundColor'),
    vlabel: cs('.grb-bar-val-label, .grb-line-vlabel, .grb-bar-h-pct', 'color'),
    xlabel: cs('.grb-bar-label, .grb-line-xlabel, .grb-bar-h-desc', 'color'),
    fill: cs('.grb-line-area', 'fill'),
    grid: g.querySelector('.grb-ov-grid') ? cs('.grb-ov-grid-layer', 'color') : null,
  };
  V.forEach((v, i) => { if (prev[i]) g.style.setProperty(v, prev[i]); });
  return out;
}, id);
const fieldVal = (page, p) => page.evaluate((p) => { const h = document.getElementById(p + '-hex'); return h ? (h.value || '[' + h.placeholder + ']') : null; }, p);

for (const bg of ['#ffffff', '#111111']) for (const type of ['bar-v', 'bar-h', 'bar-pair', 'line']) {
  test(`C1 ★${bg} ${type} — 프리셋 넷: 색 칸 = 그려진 «파생 전» 색 · 라벨 색 = 두 색이 다르면 Mix`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1200 });
    const errs = await bootApp(page);
    const bad = [];
    for (const preset of ['default', 'dark', 'minimal', 'colorful']) {
      const id = await make(page, { bg, type, preset });
      await page.evaluate((id) => window.showGraphProperties(document.getElementById(id)), id);
      const d = await drawnBase(page, id);
      const want = { 'grb-bar': type === 'bar-v' ? d.bar : d.bar, 'grb-bar2': d.bar2, 'grb-vlabel': d.vlabel, 'grb-xlabel': d.xlabel, 'grb-fill': d.fill, 'grb-grid': d.grid };
      for (const [p, w] of Object.entries(want)) {
        if (w == null) continue;
        const f = await fieldVal(page, p); if (f == null) continue;
        if (f !== hex6(w)) bad.push(`${preset} ${p}: 칸 ${f} ≠ 그려진 ${w}`);
      }
      const lf = await fieldVal(page, 'grb-label');
      const mixed = rgbOf(d.vlabel).join() !== rgbOf(d.xlabel).join();
      if (lf !== (mixed ? '[Mix]' : hex6(d.xlabel))) bad.push(`${preset} grb-label: 칸 ${lf} ≠ ${mixed ? 'Mix' : hex6(d.xlabel)}`);
    }
    expect(bad).toEqual([]);
    expect(errs).toEqual([]);
  });
}

for (const bg of ['#111111', '#ffffff']) {
  test(`C2 ★${bg} 꺾은선 «선 색상» 투명도만 50(실클릭·타이핑) → 선 = 그려진 파랑 + 투명도(회색 아님) · H6 꺼짐 = 명시 색 정책`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 1200 });
    const errs = await bootApp(page);
    const id = await make(page, { bg, type: 'line' });
    const base = rgbOf((await drawnBase(page, id)).bar).slice(0, 3);
    await selectReal(page, id);
    const a = await page.evaluate(() => { const e = document.getElementById('grb-bar-alpha'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await clickAt(page, a[0], a[1], { sel: '#grb-bar-alpha' }, { label: '선 색상 투명도' });
    await page.keyboard.press('Meta+a'); await page.keyboard.type('50'); await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.lineColor || '', id)).toBe(`rgba(${base.join(',')},0.5)`);
    const r = await page.evaluate((id) => { const g = document.getElementById(id); return { stroke: getComputedStyle(g.querySelector('.grb-line-path')).stroke, h6: g.style.getPropertyValue('--grb-auto-line').trim() }; }, id);
    expect(rgbOf(r.stroke).slice(0, 3), '선 = 그려진 파랑(회색 아님)').toEqual(base);
    expect(base[2] - base[0], '파랑 계열(전제)').toBeGreaterThan(80);
    expect(r.h6, '명시 색 → H6 꺼짐(정책 · 기댓값)').toBe('');
    expect(errs).toEqual([]);
  });
}

test('C3 ★라벨 색 Mix — 투명도만 50 은 색을 안 쓴다(값 라벨 파랑 그대로) · hex 를 고르면 그때 쓴다', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await make(page, { bg: '#ffffff', type: 'bar-v' });
  await selectReal(page, id);
  expect(await fieldVal(page, 'grb-label'), '전제: Mix').toBe('[Mix]');
  const v0 = await page.evaluate((id) => getComputedStyle(document.getElementById(id).querySelector('.grb-bar-val-label')).color, id);
  const a = await page.evaluate(() => { const e = document.getElementById('grb-label-alpha'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await clickAt(page, a[0], a[1], { sel: '#grb-label-alpha' }, { label: '라벨 색 투명도' });
  await page.keyboard.press('Meta+a'); await page.keyboard.type('50'); await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  expect(await page.evaluate((id) => ({ ds: document.getElementById(id).dataset.labelColor ?? null, v: getComputedStyle(document.getElementById(id).querySelector('.grb-bar-val-label')).color }), id)).toEqual({ ds: null, v: v0 });
  const h = await page.evaluate(() => { const e = document.getElementById('grb-label-hex'); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await clickAt(page, h[0], h[1], { sel: '#grb-label-hex' }, { label: '라벨 색 hex' });
  await page.keyboard.type('FF0000'); await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.labelColor || '', id)).toMatch(/^rgba?\(255,\s*0,\s*0|^#ff0000/i);
  expect(errs).toEqual([]);
});

test('C4 패널 열기 = 히스토리 0 · 블럭 DOM 변경 0(자동저장을 부를 mutation 없음)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await make(page, { bg: '#111111', type: 'line' });
  await page.waitForTimeout(300);
  const r = await page.evaluate(async (id) => {
    const g = document.getElementById(id); let push = 0; const _p = window.pushHistory; window.pushHistory = (...a) => { push++; return _p(...a); };
    const recs = []; const mo = new MutationObserver(m => recs.push(...m)); mo.observe(document.getElementById('canvas'), { attributes: true, subtree: true, childList: true, characterData: true });
    window.showGraphProperties(g); await new Promise(r => setTimeout(r, 50));
    mo.disconnect(); window.pushHistory = _p;
    return { push, recs: recs.length, h6: g.style.getPropertyValue('--grb-auto-line').trim() !== '' };
  }, id);
  expect(r).toEqual({ push: 0, recs: 0, h6: true });
  expect(errs).toEqual([]);
});

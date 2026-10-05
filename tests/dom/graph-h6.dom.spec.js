/* graph-h6.dom.spec.js — H6 어두운 바탕 그래프 자동 밝기 + K7 꺾은선 + GR3 덧선 + E144 파생 변수 저장 걷기 (태양 lane-e1-plus 2026-10-05)
 * 지디 결정: 격자선 3.0 × 꺾은선 4.5(⒜) · tone=light(어두운 바탕)일 때만 · 흰 바탕 그대로(E142 따로) · 명시 색 그대로(U9 정책 — E143 따로) · CSS 변수만 · 점은 선과 같은 길 · GR3 포함(제 잉크 #333 → 흰 쪽 · 눈금 같이).
 * 고침: canvas-contrast.js syncGraphTone(블럭 인라인 변수 --grb-auto-grid/line/ink) · css/editor-graph.css 끝 네 줄(프리셋과 세기 같아 «순서»로 이김)
 *   · drag-utils renderGraph 끝 한 줄 · io/section-serialize.js 「파생 변수」 한 목록(E144 --tbl-header-fg 포함)으로 저장에서 걷음.
 * 대비 = WCAG(독립 구현 — 이 파일은 제품의 계산기를 import 하지 않는다: 같은 것을 쓰면 계산기 버그가 세탁된다).
 * 준비(섹션 배경·그래프 종류·덧선 토글)는 함수로 세운다 — 실앱 순서(패널 클릭)는 실앱 범위표에서 잰다.
 * 양성대조: d1f642ff 나무 안 → D1 D2 D3 D5 빨강 · D4 N1 N2 N3 N4 PR 초록 (predict: $S/h6/predict.md).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-h6.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (r) => 0.2126 * lin(r[0]) + 0.7152 * lin(r[1]) + 0.0722 * lin(r[2]);
const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb = (s) => (String(s).match(/[\d.]+/g) || []).map(Number);

async function setup(page, { secBg = '#111111', graph = {}, toggles = {} } = {}) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(({ secBg, graph, toggles }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    const S = document.getElementById('sG'); window.setSectionBg(S, secBg);
    window.selectSection(S); window.addGraphBlock(graph);
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    for (const [k, v] of Object.entries(toggles)) g.dataset[k] = v;
    window.renderGraph(g); window.deselectAll?.(); return g.id;
  }, { secBg, graph, toggles });
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  return { errs, id };
}
const look = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id), cs = (e) => e ? getComputedStyle(e) : null;
  const path = g.querySelector('.grb-line-path'), dot = g.querySelector('.grb-line-point-dot'), grid = g.querySelector('.grb-ov-grid'), ovl = g.querySelector('.grb-ov-line');
  return { bg: getComputedStyle(document.getElementById('sG')).backgroundColor,
    vars: ['--grb-auto-grid', '--grb-auto-line', '--grb-auto-ink'].map(v => g.style.getPropertyValue(v).trim()),
    path: path && cs(path).stroke, dot: dot && cs(dot).backgroundColor,
    grid: grid && { stroke: cs(grid).stroke, op: +cs(grid).strokeOpacity }, ovLine: ovl && cs(ovl).stroke };
}, id);
const gridEff = (l) => { const s = rgb(l.grid.stroke), bg = rgb(l.bg); const a = (s.length > 3 ? s[3] : 1) * l.grid.op; return s.slice(0, 3).map((c, i) => a * c + (1 - a) * bg[i]); };

test('D1 ★#111 위 꺾은선 선 대비 ≥ 4.5(K7 · 옛 4.09)', async ({ page }) => {
  const { errs, id } = await setup(page, { graph: { chartType: 'line' } });
  const l = await look(page, id);
  const c = cr(rgb(l.path), rgb(l.bg));
  expect(c, `선 ${l.path} · 바탕 ${l.bg} · 대비 ${c.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  expect(errs).toEqual([]);
});
test('D2 ★#111 위 격자선 실효 대비 ≥ 3.0(H6 · 옛 1.06)', async ({ page }) => {
  const { errs, id } = await setup(page, { toggles: { showGrid: '1' } });
  const l = await look(page, id);
  const c = cr(gridEff(l), rgb(l.bg));
  expect(c, `격자 ${JSON.stringify(l.grid)} · 대비 ${c.toFixed(2)}`).toBeGreaterThanOrEqual(3.0);
  expect(errs).toEqual([]);
});
test('D3 ★#111 위 GR3 덧선 대비 ≥ 4.5(옛 1.49)', async ({ page }) => {
  const { errs, id } = await setup(page, { toggles: { showLine: '1' } });
  const l = await look(page, id);
  const c = cr(rgb(l.ovLine), rgb(l.bg));
  expect(c, `덧선 ${l.ovLine} · 대비 ${c.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  expect(errs).toEqual([]);
});
test('D4 꺾은선 점 = 선과 같은 색(같은 길)', async ({ page }) => {
  const { errs, id } = await setup(page, { graph: { chartType: 'line' } });
  const l = await look(page, id);
  expect(rgb(l.dot).slice(0, 3)).toEqual(rgb(l.path).slice(0, 3));
  expect(errs).toEqual([]);
});
test('D5 ★흰 섹션 → 섹션 배경을 #111 로 바꾸면 따라 밝아진다(관찰자)', async ({ page }) => {
  const { errs, id } = await setup(page, { secBg: '#ffffff', graph: { chartType: 'line' } });
  await page.evaluate(() => window.setSectionBg(document.getElementById('sG'), '#111111'));
  await expect.poll(async () => { const l = await look(page, id); return +cr(rgb(l.path), rgb(l.bg)).toFixed(2); }, { message: '바탕 바뀐 뒤 선 대비' }).toBeGreaterThanOrEqual(4.5);
  expect(errs).toEqual([]);
});

test('N1 음성 — 흰 섹션: 변수 0 · 꺾은선 #2d6fe8 · 격자 #333×0.2 · 덧선 #333 그대로', async ({ page }) => {
  const a = await setup(page, { secBg: '#ffffff', graph: { chartType: 'line' } });
  const la = await look(page, a.id);
  expect(la.vars).toEqual(['', '', '']); expect(rgb(la.path).slice(0, 3)).toEqual([45, 111, 232]);
  const b = await setup(page, { secBg: '#ffffff', toggles: { showGrid: '1', showLine: '1' } });
  const lb = await look(page, b.id);
  expect(lb.vars).toEqual(['', '', '']);
  expect({ grid: rgb(lb.grid.stroke).slice(0, 3), op: lb.grid.op, ov: rgb(lb.ovLine).slice(0, 3) }).toEqual({ grid: [51, 51, 51], op: 0.2, ov: [51, 51, 51] });
});
test('N2 음성 — #111 위 명시 lineColor / labelColor → 변수 안 씀 · 그 색 그대로', async ({ page }) => {
  const a = await setup(page, { graph: { chartType: 'line', lineColor: '#ff0000' } });
  const la = await look(page, a.id);
  expect(la.vars[1], '선 변수 없음').toBe(''); expect(rgb(la.path).slice(0, 3)).toEqual([255, 0, 0]);
  const b = await setup(page, { graph: { labelColor: '#00ff00' }, toggles: { showGrid: '1', showLine: '1' } });
  const lb = await look(page, b.id);
  expect([lb.vars[0], lb.vars[2]], '격자·잉크 변수 없음').toEqual(['', '']);
  expect(rgb(lb.ovLine).slice(0, 3)).toEqual([0, 255, 0]);
});
test('N3 ★저장 바이트 비교 — #111 그래프·어두운 머리줄 표: 직렬화 = 변수를 손으로 지운 뒤 직렬화(바이트 같음) · 파생 변수 0', async ({ page }) => {
  const { errs, id } = await setup(page, { graph: { chartType: 'line' }, toggles: {} });
  await page.evaluate(() => { const S = document.getElementById('sG'); window.selectSection(S); window.addTableBlock(); const t = [...S.querySelectorAll('.table-block')].pop(); t.id = 'tH'; window.updateTableBlock('tH', { headerBg: '#222222', textColor: '#222222' });   /* 어두운 섹션에서 만든 표는 글자색이 어두운 테마 기본(#e8e8e8 = 명시 색 취급)이라 G6 가 안 붙는다 — 기본 #222222 로 되돌려 G6 의 꼴 */ });
  await page.waitForFunction(() => document.getElementById('tH').style.getPropertyValue('--tbl-header-fg').trim() !== '', null, { timeout: 3000 });
  const r = await page.evaluate((id) => {
    const g = document.getElementById(id), t = document.getElementById('tH');
    const live = { g: ['--grb-auto-line'].map(v => g.style.getPropertyValue(v)), t: t.style.getPropertyValue('--tbl-header-fg') };
    const a = window.getSerializedCanvas();
    const keep = { g: g.getAttribute('style'), t: t.getAttribute('style') };
    ['--grb-auto-grid', '--grb-auto-line', '--grb-auto-ink'].forEach(v => g.style.removeProperty(v)); t.style.removeProperty('--tbl-header-fg');
    const b = window.getSerializedCanvas();
    g.setAttribute('style', keep.g); t.setAttribute('style', keep.t);
    return { live, same: a === b, len: [a.length, b.length], derived: /--grb-auto|--tbl-header-fg/.test(a) };
  }, id);
  expect(r.live.g[0] !== '' && r.live.t !== '', `전제 — 라이브엔 변수가 있다 ${JSON.stringify(r.live)}`).toBe(true);
  expect(r.derived, '★저장본에 파생 변수 0').toBe(false);
  expect(r.same, `★바이트 같음 ${JSON.stringify(r.len)}`).toBe(true);
  expect(errs).toEqual([]);
});
test('N4 ★다시 열기 = 화면 같음(저장본에 변수가 없어도 관찰자가 다시 계산)', async ({ page }) => {
  const { id } = await setup(page, { graph: { chartType: 'line' } });
  await page.evaluate(() => { const S = document.getElementById('sG'); window.selectSection(S); window.addTableBlock(); const t = [...S.querySelectorAll('.table-block')].pop(); t.id = 'tH'; window.updateTableBlock('tH', { headerBg: '#222222', textColor: '#222222' });   /* 어두운 섹션에서 만든 표는 글자색이 어두운 테마 기본(#e8e8e8 = 명시 색 취급)이라 G6 가 안 붙는다 — 기본 #222222 로 되돌려 G6 의 꼴 */ });
  await page.waitForFunction(() => document.getElementById('tH').style.getPropertyValue('--tbl-header-fg').trim() !== '', null, { timeout: 3000 });
  const shot = () => page.evaluate((id) => { const g = document.getElementById(id), th = document.querySelector('#tH thead th'); return { path: getComputedStyle(g.querySelector('.grb-line-path')).stroke, th: getComputedStyle(th).color }; }, id);
  const before = await shot();
  const proj = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), proj);
  await page.waitForFunction((id) => !!document.getElementById(id) && document.getElementById('tH') && document.getElementById(id).style.getPropertyValue('--grb-auto-line').trim() !== '', id, { timeout: 5000 });
  expect(await shot()).toEqual(before);
});
for (const preset of ['default', 'dark', 'minimal', 'colorful']) {
  test(`PR ${preset} — 변수를 쓴 프리셋이면 계산된 선 색 == 변수 값(순서로 이긴다) · 안 쓴 프리셋은 프리셋 그대로`, async ({ page }) => {
    const { id } = await setup(page, { graph: { chartType: 'line' } });
    await page.evaluate(([id, p]) => { const g = document.getElementById(id); g.dataset.preset = p; window.renderGraph(g); }, [id, preset]);
    const l = await look(page, id);
    test.info().annotations.push({ type: 'preset', description: `${preset} vars=${JSON.stringify(l.vars)} path=${l.path} dot=${l.dot}` });
    if (l.vars[1]) { expect(rgb(l.path).slice(0, 3), '선 = 변수').toEqual(rgb(l.vars[1]).slice(0, 3)); expect(rgb(l.dot).slice(0, 3), '점 = 변수').toEqual(rgb(l.vars[1]).slice(0, 3)); }
    else expect(l.vars[1]).toBe('');
  });
}

/* N5 — 저장에서 걷는 목록은 «쓰는 자»(canvas-contrast DERIVED_AUTO_VARS)에서 나온다(두 번째 목록 금지 · 팀리드 10-05).
   쓰는 자의 목록에 새 이름을 보태고 그 이름을 인라인에 쓰면 → 저장에서 «저절로» 걷힌다. (양성대조: 직렬화기의 목록을 비운 판 → N3·N5 빨강) */
test('N5 ★쓰는 자 목록에 새 자동 변수를 보태면 저장에서 저절로 걷힌다(파생 목록 한 벌)', async ({ page }) => {
  const { errs, id } = await setup(page, { graph: { chartType: 'line' } });
  const r = await page.evaluate((id) => {
    const list = window.__gdTextTone.DERIVED_AUTO_VARS; list.push('--grb-auto-fake');
    const g = document.getElementById(id); g.style.setProperty('--grb-auto-fake', 'red');
    const out = { live: g.style.getPropertyValue('--grb-auto-fake'), saved: /--grb-auto-fake/.test(window.getSerializedCanvas()) };
    list.pop(); g.style.removeProperty('--grb-auto-fake'); return out;
  }, id);
  expect(r).toEqual({ live: 'red', saved: false });
  expect(errs).toEqual([]);
});

/* k3-grid-handles.dom.spec.js — K3 ⒜(지디 10-05 · lane-f-grid): 흐름 그리드에도 «폭» 모서리 손잡이 · 자리 = gridVisualBox(K2 선택 선과 같은 상자) · 높이 안 씀.
 *
 * 머리표: [새 것] 571b78f2 에서 빨강 · [회귀 지킴] 571b78f2 에서도 초록.
 * 실측(BUNDLE-F/K-MEASURE.md ⒝ · 571b78f2): 안 떠 있음 손잡이 0 · 떠 있음 4개 = 블럭 모서리(배경 켬이면 배경 안쪽 16).
 * 고르기 = clickAt · 끌기 = 진짜 마우스(손잡이 위 누름 → 이동 → 놓음) · 배경 = updateGridBlock{blockBg}(전제). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page, zoom, short = false) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate((short) => { window.__k3Short = short; }, short);
  await page.evaluate((zoom) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="kS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="kI" style="padding-left:60px;padding-right:60px">'
      + '<div class="gap-block" data-type="gap" style="height:80px"></div><div class="row" id="kR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:260px"></div></div></div>');
    /* ★키 큰 그리드(본문 네 줄) — 선택 시 ＋(G15)가 모서리와 안 겹치게(P4 ⒜: 겹치는 손잡이는 숨김). 짧은 그리드는 P4b 가 따로 잰다. */
    const L4 = (t) => [1, 2, 3, 4].map(i => ({ type: 'body', text: t + i }));
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: window.__k3Short ? [{ type: 'body', text: 'A' }] : L4('A') }, { width: 1, lines: window.__k3Short ? [{ type: 'body', text: 'B' }] : L4('B') }] });
    g.id = 'kG'; document.getElementById('kR').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(zoom);
    g.scrollIntoView({ block: 'center' });
  }, zoom);
  await page.waitForTimeout(300);
  return errs;
}
const bgOn = (page) => page.evaluate(() => window.updateGridBlock('kG', { blockBg: { on: true } }));
async function pick(page) {
  const p = await page.evaluate((id) => { const g = document.getElementById(id); g.scrollIntoView({ block: 'center' }); const r = g.getBoundingClientRect();
    const bad = (e) => !e || !g.contains(e) || e.closest('.grd-gutter, [data-grd-resize-dir], .grd-add-btn');
    for (const [fx, fy] of [[0.06, 0.5], [0.06, 0.3], [0.06, 0.7]])   /* 첫 열 안(8열이어도 열 폭 ≥ 1/8) — 열 경계 거터·모서리 손잡이·＋ 를 피한다 */ { const x = r.left + r.width * fx, y = r.top + r.height * fy; if (!bad(document.elementFromPoint(x, y))) return [x, y]; }
    return [r.left + r.width * 0.06, r.top + r.height / 2]; }, 'kG');
  await clickAt(page, p[0], p[1], { sel: '[id="kG"]' }, { label: '그리드 고르기' });
  await expect.poll(() => page.evaluate(() => document.getElementById('kG').classList.contains('selected')), { message: '[전제] 골라짐' }).toBe(true);
}
async function float(page) {
  const b = await page.locator('#grd-float-toggle').boundingBox();
  await clickAt(page, b.x + b.width / 2, b.y + b.height / 2, { sel: '[id="grd-float-toggle"]' }, { label: '띄우기' });
  await expect.poll(() => page.evaluate(() => document.getElementById('kG').dataset.overlayBlock ?? null), { message: '[전제] 떴다' }).toBe('true');
  await pick(page);
}
const handles = (page) => page.evaluate(async () => {
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const g = document.getElementById('kG'); const bg = g.querySelector(':scope > .grd-bg'); const B = (bg && g.dataset.blockBgOn === '1' ? bg : g).getBoundingClientRect(); const K = g.getBoundingClientRect();
  return [...document.querySelectorAll('[data-grd-resize-dir]')].filter(h => h.getBoundingClientRect().width > 0 && getComputedStyle(h).display !== 'none').map(h => { const q = h.getBoundingClientRect(); const cx = q.left + q.width / 2, cy = q.top + q.height / 2; const d = h.dataset.grdResizeDir;
    const tx = d.includes('w') ? B.left : B.right, ty = d.includes('n') ? B.top : B.bottom; const bx = d.includes('w') ? K.left : K.right, by = d.includes('n') ? K.top : K.bottom;
    return { dir: d, toVisual: [Math.round((cx - tx) * 10) / 10, Math.round((cy - ty) * 10) / 10], toBlock: [Math.round((cx - bx) * 10) / 10, Math.round((cy - by) * 10) / 10], x: cx, y: cy }; }); });
const atVisual = (hs) => hs.length === 4 && hs.every(h => Math.abs(h.toVisual[0]) <= 1.5 && Math.abs(h.toVisual[1]) <= 1.5);

test('H1 [새 것] 흐름(안 떠 있는) 그리드를 고르면 «폭» 손잡이 4개 — 블럭 모서리(배경 끔)', async ({ page }) => {
  const errs = await setup(page, 100); await pick(page);
  const hs = await handles(page);
  expect(atVisual(hs), `★손잡이 ${JSON.stringify(hs)}`).toBe(true);
  expect(errs).toEqual([]);
});
for (const zoom of [100, 50]) {
  test(`H2-${zoom} [새 것] 흐름 그리드 + 배경 켬 · 줌 ${zoom} — 손잡이 4개가 배경 모서리(선택 선과 같은 상자)`, async ({ page }) => {
    const errs = await setup(page, zoom); await bgOn(page); await pick(page);
    const hs = await handles(page);
    expect(atVisual(hs), `★손잡이 vs 배경 ${JSON.stringify(hs)}`).toBe(true);
    expect(errs).toEqual([]);
  });
}
test('H3 [새 것] 떠 있는 그리드 + 배경 켬 — 손잡이가 블럭 모서리가 아니라 배경 모서리', async ({ page }) => {
  const errs = await setup(page, 100); await bgOn(page); await pick(page); await float(page);
  const hs = await handles(page);
  expect(atVisual(hs), `★손잡이 vs 배경 ${JSON.stringify(hs)}`).toBe(true);
  expect(errs).toEqual([]);
});
test('H4 [새 것] 흐름 그리드 se 손잡이를 진짜로 +100(화면 px) 끌면 «폭 키»만 +100 · 높이 키 없음 · ⌘Z 한 번에 원래 폭', async ({ page }) => {
  const errs = await setup(page, 100); await pick(page);
  const w0 = await page.evaluate(() => document.getElementById('kG').offsetWidth);
  const se = (await handles(page)).find(h => h.dir === 'se');
  expect(se, '[전제] se 손잡이').toBeTruthy();
  await page.mouse.move(se.x, se.y); await page.mouse.down();
  await page.mouse.move(se.x - 200, se.y, { steps: 8 });   // 줄이기(흐름 그리드는 부모 폭이 끝이라 줄이는 쪽으로 잰다)
  await page.mouse.move(se.x - 100, se.y, { steps: 4 }); await page.mouse.up();
  const r = await page.evaluate(() => { const g = document.getElementById('kG'); return { key: g.dataset.gridWidth ?? null, w: g.offsetWidth, hKey: Object.keys(g.dataset).filter(k => /height/i.test(k)) }; });
  expect(Number(r.key), `★폭 키 = 시작폭−100 · ${JSON.stringify(r)} · w0=${w0}`).toBe(w0 - 100);
  expect(r.hKey, '높이 키 안 생김').toEqual([]);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  /* ⌘Z 는 «모델»로 잰다(키 없음 · width 100%) — 픽셀 폭은 이 장면의 인라인 섹션 패딩(60)이 히스토리 표본에 없어 되돌린 뒤 모델 패딩으로 다시 서서 달라진다(실측 740→796 · 키·style 은 같음). */
  expect(await page.evaluate(() => { const g = document.getElementById('kG'); return { key: g.dataset.gridWidth ?? null, sw: g.style.width, mw: g.style.maxWidth }; }), '⌘Z 한 번 = 키 없음(자동 100%)').toEqual({ key: null, sw: '100%', mw: '' });
  expect(errs).toEqual([]);
});
test('H6 [회귀 지킴] 떠 있는 그리드 nw 손잡이 끌기 = 오른쪽 아래 모서리 제자리(G2-b 그대로)', async ({ page }) => {
  const errs = await setup(page, 100); await pick(page); await float(page);
  const nw = (await handles(page)).find(h => h.dir === 'nw');
  const br0 = await page.evaluate(() => { const r = document.getElementById('kG').getBoundingClientRect(); return [r.right, r.bottom]; });
  await page.mouse.move(nw.x, nw.y); await page.mouse.down(); await page.mouse.move(nw.x + 60, nw.y, { steps: 6 }); await page.mouse.up();
  const br1 = await page.evaluate(() => { const r = document.getElementById('kG').getBoundingClientRect(); return [r.right, r.bottom]; });
  expect(Math.abs(br1[0] - br0[0]) <= 1, `오른쪽 끝 제자리 ${br0} → ${br1}`).toBe(true);
  expect(errs).toEqual([]);
});

test('P4b [새 것] 짧은 그리드(＋ 가 오른쪽 모서리를 덮음) — ne·se 는 숨고 nw·sw 만 선다 · sw 로 폭이 바뀐다(흐름 그리드: 왼쪽을 끌어도 오른쪽으로 자람 = K3 «폭만» 한계)', async ({ page }) => {
  const errs = await setup(page, 100, true); await pick(page);
  await page.waitForFunction(() => document.querySelectorAll('#grd-plus-layer > .grd-add-btn[data-grd-for="kG"]').length === 2, null, { timeout: 3000 });
  const hs = await handles(page);
  expect(hs.map(h => h.dir).sort(), `★보이는 손잡이 ${JSON.stringify(hs)}`).toEqual(['nw', 'sw']);
  const w0 = await page.evaluate(() => document.getElementById('kG').offsetWidth);
  const sw = hs.find(h => h.dir === 'sw');
  await page.mouse.move(sw.x, sw.y); await page.mouse.down(); await page.mouse.move(sw.x + 100, sw.y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(250);
  const r = await page.evaluate(() => { const g = document.getElementById('kG'); return { key: g.dataset.gridWidth ?? null, w: g.offsetWidth }; });
  expect(Number(r.key), `★sw 오른쪽 +100 = 폭 −100 · ${JSON.stringify(r)} · w0=${w0}`).toBe(w0 - 100);
  expect(errs).toEqual([]);
});

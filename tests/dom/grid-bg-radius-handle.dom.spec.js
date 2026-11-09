/* grid-bg-radius-handle.dom.spec.js — t2-07(현빈): 그리드 블럭 배경 「코너」를 캔버스 손잡이로(에셋 모서리 점과 같은 꼴) · 패널과 동기.
 *   H1 배경 끔 → 점 0 · 켬 + 고르기 → 넷이 .grd-bg 모서리 안쪽(inset) · 고름 풀기 → 0 · 패널에서 배경 끔 → 숨음
 *   H2 nw 를 안쪽 +40/+40 끌기(100%) → dataset·계산된 반경·슬라이더·숫자 = 시작+40 · 40% 줌 같은 화면 끌기 → 80 에서 멈춤 · 바깥 끌기 → 0
 *   H3 ⌘Z 한 번 = 시작값 · 저장→다시 열기 유지
 *   H4 40% · 여백 0 → ＋ 와 겹치는 점은 숨김 · 24px 미만 상자 → 넷 다 숨김 · 칸 글자 더블클릭 편집은 그대로
 *   H5 모양 = .asset-radius-handle 과 같다(크기·색·테두리·모양·z·커서)
 * ★양성대조: 만드는 루프를 빼면 H1 빨강 · onMove 의 applyGridBlockBg 를 빼면 H2 계산 반경 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page, { zoom = 100, lines = 4 } = {}) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(([zoom, lines]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="rS" data-section="1" style="background:#ffffff"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:80px;padding-right:80px">'
      + '<div class="gap-block" data-type="gap" style="height:80px"></div><div class="row" id="rR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:260px"></div></div></div>');
    const L = (t) => Array.from({ length: lines }, (_, i) => ({ type: 'body', text: t + i }));
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: L('A') }, { width: 1, lines: L('B') }] });
    g.id = 'rG'; document.getElementById('rR').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(zoom);
    g.scrollIntoView({ block: 'center' }); window.clearHistory?.();
  }, [zoom, lines]);
  await waitZoomSettled(page, zoom);
  return errs;
}
const bgOn = async (page, extra = {}) => { const r = await page.evaluate((p) => window.updateGridBlock('rG', { blockBg: { on: true, color: '#2f3d57', ...p } }), extra); expect(r && r.ok, JSON.stringify(r)).toBe(true); };
async function pick(page) {
  const p = await page.evaluate(() => { const g = document.getElementById('rG'); const r = g.getBoundingClientRect();
    const bad = (e) => !e || !g.contains(e) || e.closest('.grd-gutter, [data-grd-resize-dir], [data-grd-radius-dir], .grd-add-btn');
    for (const [fx, fy] of [[0.06, 0.5], [0.06, 0.3], [0.06, 0.7]]) { const x = r.left + r.width * fx, y = r.top + r.height * fy; if (!bad(document.elementFromPoint(x, y))) return [x, y]; }
    return [r.left + r.width * 0.06, r.top + r.height / 2]; });
  await clickAt(page, p[0], p[1], { sel: '[id="rG"]' }, { label: '그리드 고르기' });
  await expect.poll(() => page.evaluate(() => document.getElementById('rG').classList.contains('selected')), { message: '[전제] 골라짐' }).toBe(true);
}
/** 보이는 코너 점 — {dir, x, y, dx, dy}: (dx,dy) = 점 가운데 − .grd-bg 의 그 모서리(화면px) */
const dots = (page) => page.evaluate(async () => {
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const bg = document.querySelector('#rG > .grd-bg'); const B = bg ? bg.getBoundingClientRect() : null;
  return [...document.querySelectorAll('[data-grd-radius-dir]')].filter(h => getComputedStyle(h).display !== 'none' && h.getBoundingClientRect().width > 0).map(h => {
    const q = h.getBoundingClientRect(); const x = q.left + q.width / 2, y = q.top + q.height / 2; const d = h.dataset.grdRadiusDir;
    const cx = B ? (d.includes('w') ? B.left : B.right) : 0, cy = B ? (d.includes('n') ? B.top : B.bottom) : 0;
    return { dir: d, x, y, dx: Math.round((x - cx) * 10) / 10, dy: Math.round((y - cy) * 10) / 10 }; }).sort((a, b) => a.dir.localeCompare(b.dir));
});
const state = (page) => page.evaluate(() => { const g = document.getElementById('rG'); const bg = g.querySelector(':scope > .grd-bg');
  return { ds: g.dataset.blockBgRadius ?? null, css: bg ? getComputedStyle(bg).borderTopLeftRadius : null,
    slider: document.getElementById('grd-bbg-radius-slider')?.value ?? null, num: document.getElementById('grd-bbg-radius-num')?.value ?? null }; });
const all = (v) => ({ ds: String(v), css: v + 'px', slider: String(v), num: String(v) });
async function drag(page, dot, dx, dy) {
  await page.mouse.move(dot.x, dot.y); await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(dot.x + dx * i / 5, dot.y + dy * i / 5);
  await page.mouse.up();
}

test('H1 배경 끔 → 0 · 켬 + 고르기 → 넷이 .grd-bg 모서리 안쪽 · 고름 풀기 → 0 · 패널 끔 → 숨음', async ({ page }) => {
  const errs = await setup(page);
  await pick(page);
  expect(await dots(page), '배경 끔 = 점 없음').toEqual([]);
  await bgOn(page);
  await expect.poll(async () => (await dots(page)).map(d => d.dir)).toEqual(['ne', 'nw', 'se', 'sw']);
  const ds = await dots(page);
  for (const d of ds) {
    expect(Math.abs(Math.abs(d.dx) - 10), `${d.dir} 가로 inset ${d.dx}`).toBeLessThanOrEqual(1);
    expect(Math.abs(Math.abs(d.dy) - 10), `${d.dir} 세로 inset ${d.dy}`).toBeLessThanOrEqual(1);
    expect(Math.sign(d.dx), `${d.dir} 안쪽`).toBe(d.dir.includes('w') ? 1 : -1);
    expect(Math.sign(d.dy), `${d.dir} 안쪽`).toBe(d.dir.includes('n') ? 1 : -1);
  }
  await page.evaluate(() => window.deselectAll?.());
  await expect.poll(() => dots(page)).toEqual([]);
  await pick(page);
  await expect.poll(async () => (await dots(page)).length).toBe(4);
  await page.locator('#grd-bbg-toggle').evaluate(e => e.click());   // 숨은 체크박스 — 패널 change 경로 그대로
  await expect.poll(() => page.evaluate(() => document.getElementById('rG').dataset.blockBgOn ?? null), { message: '[전제] 패널에서 꺼짐' }).not.toBe('1');
  await expect.poll(() => dots(page)).toEqual([]);
  expect(errs).toEqual([]);
});

test('H2 nw 안쪽 끌기 = 시작+40(넷 다 같음) · 40% 줌 → 80 에서 멈춤 · 바깥 끌기 → 0', async ({ page }) => {
  const errs = await setup(page);
  await bgOn(page, { radius: 12 });
  await pick(page);
  await page.evaluate(() => window.showGridProperties(document.getElementById('rG')));
  await expect.poll(async () => (await dots(page)).length).toBe(4);
  let nw = (await dots(page)).find(d => d.dir === 'nw');
  await drag(page, nw, 40, 40);
  await expect.poll(() => state(page)).toEqual(all(52));
  /* 40% — 화면 40px = 캔버스 100px ⇒ 52+100 → 80 에서 멈춤 */
  await page.evaluate(() => window.applyZoom(40)); await waitZoomSettled(page, 40);
  await page.evaluate(() => document.getElementById('rG').scrollIntoView({ block: 'center' }));
  await expect.poll(async () => (await dots(page)).length).toBe(4);
  nw = (await dots(page)).find(d => d.dir === 'nw');
  await drag(page, nw, 40, 40);
  await expect.poll(() => state(page)).toEqual(all(80));
  const se = (await dots(page)).find(d => d.dir === 'se');
  await drag(page, se, 60, 60);   // se 바깥 = 오른쪽 아래
  await expect.poll(() => state(page)).toEqual(all(0));
  expect(errs).toEqual([]);
});

test('H3 ⌘Z 한 번 = 시작값 · 맨클릭은 항목 없음 · 저장→다시 열기 유지', async ({ page }) => {
  await setup(page);
  await bgOn(page, { radius: 12 });
  await pick(page);
  await page.evaluate(() => { window.showGridProperties(document.getElementById('rG')); window.clearHistory?.(); });
  await expect.poll(async () => (await dots(page)).length).toBe(4);
  const nw = (await dots(page)).find(d => d.dir === 'nw');
  const h0 = await page.evaluate(() => window.getHistoryTip?.()?.action ?? null);
  await page.mouse.click(nw.x, nw.y);
  expect(await page.evaluate(() => window.getHistoryTip?.()?.action ?? null), '맨클릭 = 항목 없음').toBe(h0);
  await drag(page, nw, 30, 30);
  await expect.poll(() => state(page).then(s => s.ds)).toBe('42');
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => { const g = document.getElementById('rG'); const bg = g.querySelector(':scope > .grd-bg');
    return [g.dataset.blockBgRadius, bg && getComputedStyle(bg).borderTopLeftRadius]; })).toEqual(['12', '12px']);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => page.evaluate(() => document.getElementById('rG').dataset.blockBgRadius)).toBe('42');
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
  await expect.poll(() => page.evaluate(() => { const g = document.getElementById('rG'); const bg = g && g.querySelector(':scope > .grd-bg');
    return [g?.dataset.blockBgRadius, bg && getComputedStyle(bg).borderTopLeftRadius]; })).toEqual(['42', '42px']);
});

test('H4 40% · 여백 0 → ＋ 와 겹친 점만 숨김 · 칸 더블클릭 편집 그대로', async ({ page }) => {
  await setup(page, { zoom: 40 });
  await bgOn(page, { padX: 0, padY: 0 });
  await pick(page);
  await expect.poll(async () => (await dots(page)).length).toBe(4);
  const se = (await dots(page)).find(d => d.dir === 'se');
  /* ＋ 하나를 se 점 위로 옮긴다(실제 ＋ 노드 · P4 ⒜ 양보 규칙을 잰다) — 다음 프레임에 se 만 숨는다 */
  const moved = await page.evaluate(([x, y]) => { const p = document.querySelector('#grd-plus-layer > .grd-add-btn[data-grd-for="rG"]'); if (!p) return false;
    /* 층은 #canvas-scaler(변형) 안 — 화면 차이 ÷ 배율만큼 left/top 을 민다 */
    const pin = () => { const q = p.getBoundingClientRect(); const k = q.width / (p.offsetWidth || 1); const cs = getComputedStyle(p);
      p.style.left = (parseFloat(cs.left) + (x - (q.left + q.width / 2)) / k) + 'px'; p.style.top = (parseFloat(cs.top) + (y - (q.top + q.height / 2)) / k) + 'px'; };
    pin(); window.__pinPlus = setInterval(pin, 16); return true; }, [se.x, se.y]);
  expect(moved, '[전제] ＋ 가 있다').toBe(true);
  await expect.poll(async () => (await dots(page)).map(d => d.dir)).toEqual(['ne', 'nw', 'sw']);
  await page.evaluate(() => clearInterval(window.__pinPlus));
  /* 칸 글자 더블클릭 = 편집(점이 가로채지 않는다) */
  const ln = await page.evaluate(() => { const r = document.querySelector('#rG .grd-line').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });   // 글자 가운데 — 여백 0 이면 nw 점(7px)이 줄 첫머리를 덮는다(에셋 점과 같은 성질)
  await page.mouse.dblclick(ln[0], ln[1]);
  await expect.poll(() => page.evaluate(() => !!document.querySelector('#rG [contenteditable="true"]'))).toBe(true);
  await expect.poll(() => dots(page)).toEqual([]);   // 편집 중엔 숨김
});

test('H4b 24px 미만 상자 → 넷 다 숨김', async ({ page }) => {
  await setup(page, { zoom: 40, lines: 1 });
  await bgOn(page, { padX: 0, padY: 0 });
  await pick(page);
  const h = await page.evaluate(() => document.querySelector('#rG > .grd-bg').getBoundingClientRect().height);
  expect(h, '[전제] 배경 상자 < 24px').toBeLessThan(24);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('[data-grd-radius-dir]').length), { message: '[전제] 점은 있다(숨김일 뿐)' }).toBe(4);
  expect(await dots(page)).toEqual([]);
});

test('H5 모양 = .asset-radius-handle 과 같다', async ({ page }) => {
  await setup(page);
  await bgOn(page);
  await pick(page);
  await expect.poll(async () => (await dots(page)).length).toBe(4);
  const r = await page.evaluate(() => {
    const ov = document.getElementById('ss-handles-overlay');
    const a = document.createElement('div'); a.className = 'asset-radius-handle nw'; ov.appendChild(a);
    const g = document.querySelector('[data-grd-radius-dir="nw"]');
    const pick = (e) => { const s = getComputedStyle(e); const q = e.getBoundingClientRect();
      return { w: q.width, h: q.height, bg: s.backgroundColor, bc: s.borderTopColor, bw: s.borderTopWidth, br: s.borderTopLeftRadius, z: s.zIndex, cur: s.cursor, pe: s.pointerEvents }; };
    const out = { grid: pick(g), asset: pick(a) }; a.remove(); return out;
  });
  expect(r.grid).toEqual(r.asset);
  expect([r.grid.w, r.grid.br, r.grid.cur]).toEqual([7, '50%', 'crosshair']);
});

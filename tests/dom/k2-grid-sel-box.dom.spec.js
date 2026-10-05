/* k2-grid-sel-box.dom.spec.js — K2(현빈 「같이 아웃라인이나 그런것도 늘어나야되지 않겠니?」 · lane-f-grid 승인): 배경 켠 그리드의 선택 선이 «배경»을 감싼다.
 *
 * 머리표(지디 규율): [새 것] 571b78f2 에서 빨강 · [회귀 지킴] 571b78f2 에서도 초록.
 * 실측(BUNDLE-F/K-MEASURE.md · 571b78f2 실앱): 보이는 선 = 오버레이 .ss-sel-path(선 = 블럭 상자) · 배경 .grd-bg 는 그 밖 16px(4변).
 * 고침 = grid-block.js gridVisualBox(배경 켬 = .grd-bg · 끔 = 블럭) 한 자리 · selection-overlay.js _geomOf 가 «기하»에만 그것을 쓴다(호스트·색은 블럭).
 * 재는 것: 선 사각형(.ss-sel-path getBoundingClientRect) vs 목표 상자 — 4변 차 ≤ 1.5 화면px(선은 상자 «안»으로 스냅 + 반굵기).
 * 고르기 = clickAt(맞힌 요소 단언) · 띄우기 = 패널 토글 진짜 클릭 · 배경 켜기 = updateGridBlock{blockBg}(전제 — 패널과 같은 고치는 문). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page, zoom) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate((zoom) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="kS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="kI" style="padding-left:60px;padding-right:60px">'
      + '<div class="gap-block" data-type="gap" style="height:80px"></div><div class="row" id="kR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:260px"></div></div></div>');
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }] });
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
/** 선 vs 상자 — 상자 = 'bg'(.grd-bg) 또는 'block' · 4변 차(화면 px) + 선 클래스 */
const look = (page, which) => page.evaluate(async (which) => {
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const g = document.getElementById('kG'); const box = which === 'bg' ? g.querySelector(':scope > .grd-bg') : g;
  if (!box) return { err: 'no box ' + which };
  const B = box.getBoundingClientRect();
  const ps = [...document.querySelectorAll('.ss-sel-path')].map(p => ({ q: p.getBoundingClientRect(), cls: p.getAttribute('class') })).filter(o => o.q.width > 10);
  if (!ps.length) return { err: 'no path' };
  const P = ps.sort((a, b) => (Math.abs(a.q.left - B.left) + Math.abs(a.q.top - B.top)) - (Math.abs(b.q.left - B.left) + Math.abs(b.q.top - B.top)))[0];
  return { d: [P.q.left - B.left, P.q.top - B.top, B.right - P.q.right, B.bottom - P.q.bottom].map(v => Math.round(v * 10) / 10), cls: P.cls };
}, which);
const near = (r) => !r.err && r.d.every(v => Math.abs(v) <= 1.5);

for (const zoom of [100, 50]) {
  test(`A1-${zoom} [새 것] 배경 켬 · 안 떠 있음 · 줌 ${zoom} — 선택 선이 배경(.grd-bg) 상자를 감싼다`, async ({ page }) => {
    const errs = await setup(page, zoom); await bgOn(page); await pick(page);
    const r = await look(page, 'bg');
    expect(near(r), `★선 vs 배경 4변 차 ${JSON.stringify(r)}`).toBe(true);
    expect(errs).toEqual([]);
  });
  test(`A3-${zoom} [새 것] 배경 켬 · 떠 있음 · 줌 ${zoom} — 선이 배경을 감싸고 보라(떠 있음 색) 그대로`, async ({ page }) => {
    const errs = await setup(page, zoom); await bgOn(page); await pick(page); await float(page);
    const r = await look(page, 'bg');
    expect(near(r), `★선 vs 배경 ${JSON.stringify(r)}`).toBe(true);
    expect(r.cls, '★떠 있음 색(보라 sticker 판) 유지 — 호스트는 블럭').toContain('ss-sel-path--sticker');
    expect(errs).toEqual([]);
  });
  test(`A4-${zoom} [회귀 지킴] 배경 끔 · 안 떠 있음/떠 있음 · 줌 ${zoom} — 선 = 블럭 상자 그대로`, async ({ page }) => {
    const errs = await setup(page, zoom); await pick(page);
    const r1 = await look(page, 'block');
    expect(near(r1), `안 떠 있음 ${JSON.stringify(r1)}`).toBe(true);
    await float(page);
    const r2 = await look(page, 'block');
    expect(near(r2), `떠 있음 ${JSON.stringify(r2)}`).toBe(true);
    expect(errs).toEqual([]);
  });
}

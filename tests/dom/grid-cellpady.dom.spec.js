/* grid-cellpady.dom.spec.js — 그리드 제4안 «높이 = 칸 위아래 여백»(cellPadY · 현빈 확정 10-05 · lane-grid-height).
 *
 * 머리표: [새 것] 0f572e2a 에서 빨강 · [회귀 지킴] 0f572e2a 에서도 초록.
 * Y0 = «키 없음 = 기존 문서 바이트 그대로» 잠금 — 키 없는 그리드 여섯 꼴의 렌더 outerHTML 을 «기준 판(0f572e2a)»에서 뜬 골든과 바이트 비교.
 *   골든 뜨기: GD1001_ROOT=<0f572e2a 나무> GRID_CPY_GOLDEN=update 로 한 번(⛔머리 판에서 뜨지 마라 — 그러면 무엇과도 같다).
 * 손잡이 = 진짜 마우스(위 변 가운데 n) · 패널 = 진짜 클릭/입력.
 * ★시안 8 ↔ 실제 6 · 아래·오른 변 가운데 = G15 ＋ 자리(10-05 지디 ⒤) — s·e 는 ＋ 와 겹쳐 늘 숨는다(P4 · 고름이 아니라 제약) · 위아래는 n 으로 잰다. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const GOLD = path.join(__dirname, 'fixtures', 'grid-cellpady-y0-golden.json');

const SCENE = '<div class="section-block" id="cS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="cI"><div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="cR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>';
async function setup(page, rows = 2) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate(([SCENE, rows]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', SCENE);
    const L = (t) => [{ type: 'body', text: t + ' 첫줄' }, { type: 'body', text: t + ' 둘째' }];
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: L('A') }, { width: 1, lines: L('B') }], rows: Array.from({ length: rows }, () => ({ height: 'auto' })) });
    g.id = 'cG'; document.getElementById('cR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(100); g.scrollIntoView({ block: 'center' });
  }, [SCENE, rows]);
  await page.waitForTimeout(300);
  return errs;
}
const meas = (page) => page.evaluate(() => { const g = document.getElementById('cG'); const t = g.querySelector('.grd-body'); const c = g.querySelector('.grd-cell'); const cs = getComputedStyle(c);
  return { key: g.dataset.cellPadY ?? null, h: Math.round(g.getBoundingClientRect().height), font: getComputedStyle(t).fontSize, padT: cs.paddingTop, padB: cs.paddingBottom, padL: cs.paddingLeft }; });

test('Y0 [회귀 지킴] 키 없는 그리드 여섯 꼴 = 기준 판(0f572e2a) 렌더 바이트 그대로', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  const got = await page.evaluate(() => {
    const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const CONF = {
      plain: {},
      cellPad: { cols: [{ width: 1, padding: 12, lines: [{ type: 'body', text: 'a' }] }, { width: 1, lines: [{ type: 'body', text: 'b' }] }] },
      cellsPad: { cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }] }, { width: 1, lines: [{ type: 'body', text: 'b' }] }], rows: [{ height: 'auto' }, { height: 120 }], cells: [[{ padding: 20 }, {}], [{}, { padding: 8, radius: 6 }]] },
      border: { cellBorderWidth: 2, cellBorderColor: '#333333', gap: 0 },
      bg: { blockBg: { on: true, color: '#eeeeee' } },
      /* 그림 줄은 «높이 키 없는» 꼴만 — 높이 키 있는 그림 줄은 E157 이 산출을 바꾼다(키 있음 = 이 잠금 밖 · e157-grid-ratio E1 이 잰다) */
      image: { cols: [{ width: 1, lines: [{ type: 'image', imgSrc: IMG }] }, { width: 1, lines: [{ type: 'image', imgSrc: IMG, widthPct: 60, align: 'center' }] }] },
    };
    const c = document.getElementById('canvas'); const out = {};
    for (const [k, o] of Object.entries(CONF)) {
      const { block: g } = window.makeGridBlock(o); g.id = 'y0_' + k; c.appendChild(g); window.renderGridBlock(g);
      out[k] = g.outerHTML; g.remove();
    }
    return out;
  });
  if (process.env.GRID_CPY_GOLDEN === 'update') { fs.writeFileSync(GOLD, JSON.stringify(got, null, 1)); test.info().annotations.push({ type: 'golden', description: 'written' }); return; }
  const want = JSON.parse(fs.readFileSync(GOLD, 'utf8'));
  for (const k of Object.keys(want)) expect(got[k], `★키 없음 «${k}» 렌더 바이트가 기준 판과 다르다`).toBe(want[k]);
  expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort());
  expect(errs).toEqual([]);
});

for (const rows of [2, 3]) {
  test(`Y1-${rows}행 [새 것] cellPadY 30 → 그리드 높이 +2×30×${rows} · 글자 크기 그대로 · 좌우 여백 그대로`, async ({ page }) => {
    const errs = await setup(page, rows);
    const a = await meas(page);
    expect((await page.evaluate(() => window.updateGridBlock('cG', { cellPadY: 30 }))).ok).toBe(true);
    const b = await meas(page);
    expect(b.h - a.h, `★높이 차 ${JSON.stringify({ a, b })}`).toBe(2 * 30 * rows);
    expect({ key: b.key, font: b.font, padT: b.padT, padB: b.padB, padL: b.padL }).toEqual({ key: '30', font: a.font, padT: '30px', padB: '30px', padL: a.padL });
    expect(errs).toEqual([]);
  });
}
test('Y2 [새 것] 위 변 가운데 손잡이(n) 진짜 끌기 위로 30 → cellPadY 30 · 높이 +2×30×행 · ⌘Z 한 번 = 키 없음 · s·e 는 숨음(＋ 자리)', async ({ page }) => {
  const errs = await setup(page, 2);
  const a = await meas(page);
  const p = await page.evaluate(() => { const g = document.getElementById('cG'); const t = g.querySelector('.grd-cell [data-line]'); const r = t.getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; });
  await clickAt(page, p[0], p[1], { sel: '[id="cG"]' }, { label: '그리드 고르기' });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('[data-grd-resize-dir]').length), { message: '[전제] 손잡이 여덟(DOM)' }).toBe(8);
  const vis = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-grd-resize-dir]')].map(h => [h.dataset.grdResizeDir, getComputedStyle(h).display !== 'none'])));
  expect(vis, '★보이는 손잡이 여섯 · s·e 숨김(＋ 자리)').toEqual({ nw: true, ne: true, sw: true, se: true, n: true, s: false, e: false, w: true });
  const s = await page.evaluate(() => { const h = document.querySelector('[data-grd-resize-dir="n"]'); const q = h.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
  await page.mouse.move(s.x, s.y); await page.mouse.down(); await page.mouse.move(s.x, s.y - 30, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250);
  const b = await meas(page);
  expect({ key: b.key, dh: b.h - a.h, font: b.font }, JSON.stringify({ a, b })).toEqual({ key: '30', dh: 120, font: a.font });
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect((await meas(page)).key, '⌘Z 한 번 = 키 없음').toBe(null);
  expect(errs).toEqual([]);
});
test('Y3·Y4 [새 것] 바닥 0(키 지움) · 상한 70 — 쓰는 문이 죈다', async ({ page }) => {
  const errs = await setup(page, 2);
  const r = await page.evaluate(() => { const g = document.getElementById('cG'); const out = {};
    out.up = window.applyGridCellPadY(g, 999); out.keyUp = g.dataset.cellPadY;
    out.down = window.applyGridCellPadY(g, -50); out.keyDown = g.dataset.cellPadY ?? null;
    out.inv = window.updateGridBlock('cG', { cellPadY: 71 }); out.zero = window.updateGridBlock('cG', { cellPadY: 0 }); out.keyZero = g.dataset.cellPadY ?? null; return { ...out, inv: { ok: out.inv.ok, code: out.inv.code }, zero: { ok: out.zero.ok } }; });
  expect(r).toEqual({ up: 70, keyUp: '70', down: 0, keyDown: null, inv: { ok: false, code: 'INVALID' }, zero: { ok: true }, keyZero: null });
  expect(errs).toEqual([]);
});
test('Y7 [새 것] 패널 「위아래 여백」 숫자칸 — 키 값 표시 · 입력 25 → 키 25', async ({ page }) => {
  const errs = await setup(page, 2);
  const p = await page.evaluate(() => { const g = document.getElementById('cG'); const t = g.querySelector('.grd-cell [data-line]'); const r = t.getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; });
  await clickAt(page, p[0], p[1], { sel: '[id="cG"]' }, { label: '그리드 고르기' });
  await expect.poll(() => page.evaluate(() => !!document.getElementById('grd-cellpady-number')), { message: '[전제] 위아래 여백 칸' }).toBe(true);
  expect(await page.inputValue('#grd-cellpady-number')).toBe('0');
  await page.fill('#grd-cellpady-number', '25'); await page.press('#grd-cellpady-number', 'Enter'); await page.waitForTimeout(250);
  expect((await meas(page)).key).toBe('25');
  expect(errs).toEqual([]);
});

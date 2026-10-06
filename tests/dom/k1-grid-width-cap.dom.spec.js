/* k1-grid-width-cap.dom.spec.js — K1 ⒝(지디 10-05 · lane-f-grid): 그리드 «그려지는» 폭 = min(키, 부모 폭) · 키 보존 · 패널 max = 그릇 폭.
 *
 * 머리표: [새 것] 571b78f2 에서 빨강 · [회귀 지킴] 571b78f2 에서도 초록.
 * 실측(BUNDLE-F REPRO K1 · 571b78f2): 5000 → 3000 · 부모 860 보다 2140 넓어 잘림.
 * 고침 = grid-block.js renderGridBlock 키 갈래 max-width:100%(그릴 때 한 자리) · prop-grid.js _grdWidthMax(패널 max/clamp).
 * 키 쓰기 = updateGridBlock{width}(MCP·패널 숫자 Enter 와 같은 고치는 문) · 패널 max 는 그리드를 진짜 클릭으로 고른 뒤 읽는다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page, where = 'sec') {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate((where) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="wS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="wI" style="padding-left:60px;padding-right:60px">'
      + '<div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="wR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>');
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }] });
    g.id = 'wG';
    if (where === 'flow') {
      const f = window.makeFrameBlock({ fullWidth: true }); f.id = 'wF'; f.style.padding = '20px';
      const r = document.createElement('div'); r.className = 'row'; r.dataset.layout = 'stack'; r.appendChild(g); f.appendChild(r);
      document.getElementById('wR').appendChild(f);
    } else document.getElementById('wR').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(100); g.scrollIntoView({ block: 'center' });
  }, where);
  await page.waitForTimeout(300);
  return errs;
}
const setW = (page, w) => page.evaluate((w) => window.updateGridBlock('wG', { width: w }), w);
const st = (page) => page.evaluate(() => { const g = document.getElementById('wG'); const p = g.parentElement; const cs = getComputedStyle(p);
  return { key: g.dataset.gridWidth ?? null, drawn: Math.round(g.getBoundingClientRect().width / (g.getBoundingClientRect().width / g.offsetWidth || 1)), w: g.offsetWidth, parentContent: Math.round(p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)), maxW: g.style.maxWidth }; });

test('W1 [새 것] 섹션 직속 그리드 키 3000 → 그려진 폭 = 부모(860) · 키는 3000', async ({ page }) => {
  const errs = await setup(page); expect((await setW(page, 3000)).ok).toBe(true);
  const s = await st(page);
  expect({ key: s.key, w: s.w }, JSON.stringify(s)).toEqual({ key: '3000', w: s.parentContent });
  expect(errs).toEqual([]);
});
test('W2 [새 것] 부모가 넓어지면 따라 커진다(섹션 안쪽 패딩 60→0) · 키 그대로', async ({ page }) => {
  const errs = await setup(page); await setW(page, 3000);
  const a = await st(page);
  await page.evaluate(() => { const i = document.getElementById('wI'); i.style.paddingLeft = '0px'; i.style.paddingRight = '0px'; });
  await page.waitForTimeout(200);
  const b = await st(page);
  expect(b.w, `넓어진 부모를 따라감 ${JSON.stringify({ a, b })}`).toBe(b.parentContent);
  expect(b.w > a.w, '실제로 더 넓어졌다').toBe(true);
  expect(b.key).toBe('3000');
  expect(errs).toEqual([]);
});
test('W3 [새 것] 저장 왕복(직렬화 → 다시 그림) — 키 3000 그대로 · 그려진 = 부모', async ({ page }) => {
  const errs = await setup(page); await setW(page, 3000);
  await page.evaluate(() => { const s = window.getSerializedCanvas(); const c = document.getElementById('canvas'); c.innerHTML = s; window.rebindAll(); window.renderGridBlock(document.getElementById('wG')); });
  await page.waitForTimeout(200);
  const s = await st(page);
  expect({ key: s.key, w: s.w }, JSON.stringify(s)).toEqual({ key: '3000', w: s.parentContent });
  expect(errs).toEqual([]);
});
test('W4 [회귀 지킴] 키 400(부모보다 작음) = 400 그대로', async ({ page }) => {
  const errs = await setup(page); await setW(page, 400);
  const s = await st(page);
  expect({ key: s.key, w: s.w }).toEqual({ key: '400', w: 400 });
  expect(errs).toEqual([]);
});
test('W5 [회귀 지킴] 키 없음(자동 100%) — style 에 max-width 없음', async ({ page }) => {
  const errs = await setup(page);
  const s = await st(page);
  expect({ key: s.key, maxW: s.maxW, full: s.w === s.parentContent }).toEqual({ key: null, maxW: '', full: true });
  expect(errs).toEqual([]);
});
test('W6 [새 것] 흐름 프레임 안 키 3000 → 프레임 내용 폭', async ({ page }) => {
  const errs = await setup(page, 'flow'); await setW(page, 3000);
  const s = await st(page);
  expect({ key: s.key, w: s.w }, JSON.stringify(s)).toEqual({ key: '3000', w: s.parentContent });
  expect(errs).toEqual([]);
});
test('P0 [새 것] 패널 너비 max = 그릇 내용 폭(860) · 숫자칸은 키 3000 을 그대로 보여 준다', async ({ page }) => {
  const errs = await setup(page); await setW(page, 3000);
  const p = await page.evaluate((id) => { const g = document.getElementById(id); g.scrollIntoView({ block: 'center' }); const r = g.getBoundingClientRect();
    const bad = (e) => !e || !g.contains(e) || e.closest('.grd-gutter, [data-grd-resize-dir], .grd-add-btn');
    for (const [fx, fy] of [[0.06, 0.5], [0.06, 0.3], [0.06, 0.7]])   /* 첫 열 안(8열이어도 열 폭 ≥ 1/8) — 열 경계 거터·모서리 손잡이·＋ 를 피한다 */ { const x = r.left + r.width * fx, y = r.top + r.height * fy; if (!bad(document.elementFromPoint(x, y))) return [x, y]; }
    return [r.left + r.width * 0.06, r.top + r.height / 2]; }, 'wG');
  await clickAt(page, p[0], p[1], { sel: '[id="wG"]' }, { label: '그리드 고르기' });
  await expect.poll(() => page.evaluate(() => !!document.getElementById('grd-width-slider')), { message: '[전제] 너비 줄' }).toBe(true);
  const r = await page.evaluate(() => ({ sMax: document.getElementById('grd-width-slider').max, nMax: document.getElementById('grd-width-number').max, nVal: document.getElementById('grd-width-number').value, inner: (() => { const i = document.getElementById('wI'); const cs = getComputedStyle(i); return Math.floor(i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)); })() }));
  expect({ sMax: r.sMax, nMax: r.nMax, nVal: r.nVal }, JSON.stringify(r)).toEqual({ sMax: String(r.inner), nMax: String(r.inner), nVal: '3000' });
  expect(errs).toEqual([]);
});

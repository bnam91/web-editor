/* t13d-09 — 0.9.13 t13D-09 섹션 좌우 패딩 0 인데 그리드 양옆에 여백(현빈 proj_1795145417046 grd_ofjwh_po3sn2v)
 * 실측(저장본): 그 그리드 data-grid-width="815" · style width:815px; max-width:100%; align-self:center — 섹션 860.
 * 원인: 흐름 그리드 폭 쓰기(applyGridOwnWidth — 손잡이·패널 슬라이더)가 그릇 폭 이상 값도 키로 박았다. K1 이 그릴 때 min(키, 그릇)으로 죄어
 *   패딩 72(그릇 716)에선 «꽉 찬 것처럼» 보이다가, 패딩을 0 으로 하면 그 px 로 드러나 가운데 정렬 + 양옆 여백.
 *   모서리 손잡이는 폭+높이라 «높이만» 끌어도 폭 716 키가 박힌다(D4).
 * 고침: 흐름 그리드에 그릇 폭 이상을 쓰면 = 다 쓴다(키 없음 → 100%). 그릇보다 좁은 값은 사람 폭 그대로(D3).
 * D1 그릇 폭 그대로 쓰기 → 키 없음 → 패딩 0 = 섹션 전폭
 * D2 그릇보다 넓게(815 > 716) → 키 없음 → 패딩 0 = 섹션 전폭
 * D3 [회귀 지킴] 500 → 키 500 · 패딩 0 뒤에도 500
 * D4 진짜 마우스 nw 손잡이를 «세로로만» 끌기(높이) → 폭 키 안 생김 · 패딩 0 = 섹션 전폭
 * 양성대조: _patches/t13d-09-CTL.patch → D1·D2·D4 빨강 · D3 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="pS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="pI" data-padding-x="72" style="padding-left:72px;padding-right:72px">'
      + '<div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="pR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:300px"></div></div></div>');
    const L4 = (t) => [1, 2, 3, 4].map((i) => ({ type: 'body', text: t + ' ' + i }));
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: L4('A') }, { width: 1, lines: L4('B') }] });
    g.id = 'pG'; document.getElementById('pR').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(100); g.scrollIntoView({ block: 'center' });
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('pG').offsetWidth), '[전제] 그리드가 섰다').toBeGreaterThan(0);
  return errs;
}
const st = (page) => page.evaluate(() => { const g = document.getElementById('pG'), s = document.getElementById('pS');
  return { key: g.dataset.gridWidth ?? null, w: g.offsetWidth, inner: document.getElementById('pI').clientWidth - parseFloat(getComputedStyle(document.getElementById('pI')).paddingLeft) * 2, sec: s.offsetWidth }; });
const pad0 = (page) => page.evaluate(() => { const i = document.getElementById('pI'); i.style.paddingLeft = '0px'; i.style.paddingRight = '0px'; i.dataset.paddingX = '0'; });

test('D1 그릇 폭 그대로 쓰기 → 키 없음 → 패딩 0 = 섹션 전폭', async ({ page }) => {
  const errs = await setup(page);
  const a = await st(page);
  expect(a.w, '[전제] 패딩 72 = 그릇 716 꽉').toBe(a.inner);
  await page.evaluate(() => { const g = document.getElementById('pG'); window.applyGridOwnWidth(g, g.offsetWidth); });
  expect((await st(page)).key, '★그릇 폭 = 다 쓴다(키 없음)').toBe(null);
  await pad0(page);
  const b = await st(page);
  expect(b.w, `★패딩 0 → 섹션 전폭 ${JSON.stringify(b)}`).toBe(b.sec);
  expect(errs).toEqual([]);
});

test('D2 그릇보다 넓게(815) → 키 없음 → 패딩 0 = 섹션 전폭', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.applyGridOwnWidth(document.getElementById('pG'), 815));
  expect((await st(page)).key, '★키 815 가 안 남는다').toBe(null);
  await pad0(page);
  const b = await st(page);
  expect(b.w, `★패딩 0 → 섹션 전폭 ${JSON.stringify(b)}`).toBe(b.sec);
  expect(errs).toEqual([]);
});

test('D3 [회귀 지킴] 그릇보다 좁은 500 → 키 500 · 패딩 0 뒤에도 500', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.applyGridOwnWidth(document.getElementById('pG'), 500));
  expect(await st(page)).toMatchObject({ key: '500', w: 500 });
  await pad0(page);
  expect(await st(page)).toMatchObject({ key: '500', w: 500 });
  expect(errs).toEqual([]);
});

test('D4 nw 손잡이를 세로로만 끌기(높이) → 폭 키 안 생김 · 패딩 0 = 섹션 전폭', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { const g = document.getElementById('pG'); window.selectBlock(g.id); window.showHandlesFor(g); });
  const nw = await page.evaluate(async () => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const h = document.querySelector('#ss-handles-overlay [data-grd-resize-dir="nw"]'); if (!h || getComputedStyle(h).display === 'none') return null; const q = h.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  expect(nw, '[전제] nw 손잡이').toBeTruthy();
  /* [시험만 · 인텔 261120 D4 3/3 ✘ a.pad=null] 코드 길(overlay-handles.js _onGridOverlayResizeMouseDown: nw 위로 = dp + → applyGridCellPadY)은 맞다 ⇒ «누른 점이 그 손잡이가 아니었다»가 남은 가설.
     전제 = 누를 점의 임자가 nw 손잡이(두 번 같은 자리) · 아니면 그 임자를 찍고 전제에서 진다(엉뚱한 «높이 안 바뀜» 대신). */
  const who = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.dataset?.grdResizeDir ? 'nw-handle' : (e.id || '') + '.' + String(e.className).slice(0, 50)) : null; }, nw);
  expect(who, `[전제] 누를 점 임자 = nw 손잡이 (본 것: ${who})`).toBe('nw-handle');
  /* DIAG(인텔 261120 D4 3/3 — 전제 «누른 점 = nw 손잡이» 통과 · 그다음 a.pad=null): 끌기 앞뒤 dataset 전부 · 높이 · 손잡이 imp(끌기 중 누구 mousedown 이 받았나) 를 실패 메시지에 */
  const ds = () => page.evaluate(() => { const g = document.getElementById('pG'); return { ds: { ...g.dataset }, h: g.offsetHeight, padRead: window.getGridCellPadY?.(g) }; });
  const d0 = await ds();
  await page.evaluate(() => { window.__d4 = []; const f = window.applyGridCellPadY; if (f && !f.__d4) { window.applyGridCellPadY = function (b, px) { window.__d4.push(['pad', b?.id, px]); return f.apply(this, arguments); }; window.applyGridCellPadY.__d4 = 1; } });
  await page.mouse.move(nw[0], nw[1]); await page.mouse.down();
  await page.mouse.move(nw[0], nw[1] - 30, { steps: 6 }); await page.mouse.up();
  const d1 = await ds(); const calls = await page.evaluate(() => window.__d4);
  const a = await page.evaluate(() => ({ pad: document.getElementById('pG').dataset.cellPadY ?? null, key: document.getElementById('pG').dataset.gridWidth ?? null }));
  expect(a.pad, `[전제] 높이(칸 위아래 여백)는 바뀌었다 · DIAG 앞 ${JSON.stringify(d0)} 뒤 ${JSON.stringify(d1)} applyGridCellPadY 부름 ${JSON.stringify(calls).slice(0, 200)}`).not.toBe(null);
  expect(a.key, '★높이만 끌었는데 폭 키가 박혔다').toBe(null);
  await pad0(page);
  const b = await st(page);
  expect(b.w, `★패딩 0 → 섹션 전폭 ${JSON.stringify(b)}`).toBe(b.sec);
  expect(errs).toEqual([]);
});

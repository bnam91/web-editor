/* coupon-svg-ids — 0.9.13 2차 S1 VISUAL-SVG-LIGHT-AUDIT-01 ①(쿠폰 SVG 고정 id fgrad·csh) · 현빈 261123 · 태양 · 감사표 handoff/AUDIT-visual-svg-261119.md #7 · 절차 7
 *   고침: js/blocks/coupon-block.js _cpnScopeIds — 문서에 넣는 한 자리(renderCouponBlock)에서 블럭 id 로 접두(cpn-<블럭id>-) · 생성기 무변
 * S1 쿠폰 둘 · 둘 다 그라데이션 + 그림자(drop) · 색 서로 다름 → 각 쿠폰의 url(#…) 이 «제 쿠폰 안» 정의를 가리킴 · 문서에서 id 겹침 0 · 그 정의의 색 = 제 색
 * S2 첫 쿠폰을 숨겨도(display:none) 둘째 쿠폰의 그라데이션·필터는 제 것(숨긴 쿠폰 안 정의를 안 씀)
 * 양성대조: _patches/svg-ids-CTL.patch(접두 한 줄 되돌림) ⇒ S1·S2 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); sec.id = 'sQ';
    const mk = (id, body, stub) => { window.deselectAll(); window.selectSection(sec); const b = window.addCouponBlock({}); const blk = b?.block || b || [...sec.querySelectorAll('.coupon-block')].pop();
      blk.id = id; Object.assign(blk.dataset, { bgKind: 'grad', shadow: 'drop', bodyCol: body, stubCol: stub }); window.renderCouponBlock(blk); return blk; };
    mk('cpA', '#FF0000', '#00FF00'); mk('cpB', '#0000FF', '#FFFF00');
  });
  return errs;
}
const look = (page) => page.evaluate(() => ['cpA', 'cpB'].map((id) => {
  const b = document.getElementById(id);
  const fillRef = /url\(#([^)]+)\)/.exec(b.querySelector('.cpn-bg path[fill^="url(#"]')?.getAttribute('fill') || '')?.[1];
  const filtRef = /url\(#([^)]+)\)/.exec(b.querySelector('.cpn-bg g[filter]')?.getAttribute('filter') || '')?.[1];
  const g = fillRef && document.getElementById(fillRef), f = filtRef && document.getElementById(filtRef);   // 크로미움 = 문서 첫 id
  return { id, gradOwn: !!g && g.closest('.coupon-block') === b, filtOwn: !!f && f.closest('.coupon-block') === b,
    dupGrad: fillRef ? document.querySelectorAll(`[id="${fillRef}"]`).length : 0, stop0: g?.querySelector('stop')?.getAttribute('stop-color') || null };
}));

test('S1 쿠폰 둘 — 그라데이션·그림자가 제 것 · id 겹침 0 · 색 = 제 색', async ({ page }) => {
  const errs = await scene(page);
  const r = await look(page);
  console.log('[S1 실측]', JSON.stringify(r));
  expect(r, '★둘 다 제 정의 · 겹침 0 · 제 색').toEqual([
    { id: 'cpA', gradOwn: true, filtOwn: true, dupGrad: 1, stop0: '#FF0000' },
    { id: 'cpB', gradOwn: true, filtOwn: true, dupGrad: 1, stop0: '#0000FF' }]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S2 첫 쿠폰을 숨겨도 둘째는 제 그라데이션·필터', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { document.getElementById('cpA').style.display = 'none'; });
  const r = (await look(page))[1];
  console.log('[S2 실측]', JSON.stringify(r));
  expect({ gradOwn: r.gradOwn, filtOwn: r.filtOwn, stop0: r.stop0 }, '★숨긴 쿠폰 정의를 안 씀').toEqual({ gradOwn: true, filtOwn: true, stop0: '#0000FF' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

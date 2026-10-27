/* f5-annot-layer-order.dom.spec.js — 1020t2f5 「ant ⌘] 했는데 레이어 순서가 안 바뀌고 zmb 아래」 · 현빈 261026 답(주석은 확대블럭 위로 · ⌘[/⌘])
 *
 * ★잰 값(S3 실앱 · 현빈 사본 sha 1e7df4a9a347): 5e4256d1 ×3 ⌘] ⌘] ⌘[ = 주석 z 50 · 확대 60 · 변화 0 / 고친 판 ×3 ⌘] = 주석 z 60(확대 위) · ⌘] = 80 · ⌘[ · ⌘Z 한 걸음.
 * ★처방(지디 ㉡) — js/annotation-select.js annotLayerOrder(capture · 스티커·그라데이션 선례 꼴) · 블럭별 z = 인라인(buzz-frame 선례).
 *
 * ★칸
 *   P  전제 — 같은 섹션에 확대블럭(z 60)과 겹치는 주석(z 50) · 주석이 골라졌다 · 처음엔 확대가 위
 *   L1 ⌘] ⇒ 주석 z = 확대 z · 문서 순서 확대 «뒤» ⇒ 그림 위 = 주석
 *   L2 ⌘[ ⇒ 다시 확대 아래(그림 위 = 확대)
 *   L3 ⌘Z ⇒ L2 앞(주석 위)으로 한 걸음
 *   N1 (지키는 칸) 주석을 안 고르면 ⌘] 가 주석 z 를 안 바꾼다
 * ⛔고정 대기 0 — 조건 대기만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection();
    const sec = [...c.querySelectorAll('.section-block')].pop();
    window.selectSection(sec); window.addZoomBlock();
    const zb = [...sec.querySelectorAll(':scope > .zoom-block')].pop();
    const zr = zb.getBoundingClientRect(), sr = sec.getBoundingClientRect(), k = sr.width / sec.offsetWidth || 1;
    const cx = (zr.left + zr.width / 2 - sr.left) / k, cy = (zr.top + zr.height / 2 - sr.top) / k;
    const a = window.makeAnnotationBlock({ points: [{ x: cx - 80, y: cy }, { x: cx + 80, y: cy }], text: '주석', labelRadius: 0 });
    sec.appendChild(a); window.bindAnnotationSelect?.(a); window.deselectAll?.(); sec.scrollIntoView({ block: 'center' });
    return { sec: sec.id, zb: zb.id, a: a.id };
  });
  await waitStableRect(page, '#' + ids.a + ' .annot-label');
  return { errs, ids };
}
const M = (page, ids) => page.evaluate((ids) => { const a = document.getElementById(ids.a), z = document.getElementById(ids.zb); const kids = [...a.parentElement.children];
  const za = parseInt(getComputedStyle(a).zIndex) || 0, zz = parseInt(getComputedStyle(z).zIndex) || 0;
  return { za, zz, top: za !== zz ? (za > zz ? 'ANT' : 'ZB') : (kids.indexOf(a) > kids.indexOf(z) ? 'ANT' : 'ZB'), sel: a.classList.contains('selected') }; }, ids);
const pick = async (page, ids) => { const r = await waitStableRect(page, '#' + ids.a + ' .annot-label'); await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), ids.a, { timeout: 3000 }); await page.evaluate(() => document.activeElement?.blur?.()); };

test('P·L1·L2·L3 ★주석 ⌘] 로 확대 위 · ⌘[ 아래 · ⌘Z 한 걸음', async ({ page }) => {
  const { errs, ids } = await setup(page);
  const m0 = await M(page, ids);
  expect([m0.za < m0.zz, m0.top], 'P 처음엔 확대가 위').toEqual([true, 'ZB']);
  await pick(page, ids);
  await page.keyboard.press('Meta+BracketRight');
  await page.waitForFunction((ids) => (parseInt(getComputedStyle(document.getElementById(ids.a)).zIndex) || 0) === (parseInt(getComputedStyle(document.getElementById(ids.zb)).zIndex) || 0), ids, { timeout: 3000 });
  const m1 = await M(page, ids);
  expect([m1.za, m1.top, m1.sel], 'L1 ⌘] ⇒ 확대 z 를 받고 위 · 고름 유지').toEqual([m0.zz, 'ANT', true]);
  await page.keyboard.press('Meta+BracketLeft');
  await page.waitForFunction((ids) => { const a = document.getElementById(ids.a), z = document.getElementById(ids.zb); const za = parseInt(getComputedStyle(a).zIndex) || 0, zz = parseInt(getComputedStyle(z).zIndex) || 0; const kids = [...a.parentElement.children]; return za < zz || (za === zz && kids.indexOf(a) < kids.indexOf(z)); }, ids, { timeout: 3000 });
  const m2 = await M(page, ids);
  expect(m2.top, 'L2 ⌘[ ⇒ 다시 확대 아래').toBe('ZB');
  await page.keyboard.press('Meta+z');
  await page.waitForFunction((ids) => { const a = document.getElementById(ids.a), z = document.getElementById(ids.zb); if (!a || !z) return false; const kids = [...a.parentElement.children]; return kids.indexOf(a) > kids.indexOf(z); }, ids, { timeout: 3000 });
  const m3 = await M(page, ids);
  expect(m3.top, 'L3 ⌘Z ⇒ 한 걸음(주석 위)').toBe('ANT');
  expect(errs).toEqual([]);
});

test('N1 주석을 안 고르면 ⌘] 가 주석 z 를 안 바꾼다', async ({ page }) => {
  const { errs, ids } = await setup(page);
  const m0 = await M(page, ids);
  await page.keyboard.press('Meta+BracketRight');
  await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  const m1 = await M(page, ids);
  expect([m1.za, m1.top], 'N1').toEqual([m0.za, m0.top]);
  expect(errs).toEqual([]);
});

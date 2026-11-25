/* arrow-shape-wrapper-197 — 0.9.13 197 HBQA-ARROW-MOVES-WRONG-TARGET-01(현빈 9510 QA ☐4-a · 미카사 MIKASA-hbqa-261123 4-a · 판 dev 11a67a399)
 *   «rectangle» 포장 프레임(addShapeBlock 꼴 · free-layout · 흐름) 자리를 클릭 → 방향키 = 안 도형만 포장 «안»에서 1px 씩(top −21→−20 · 포장 밖으로 샘)
 *   지디 판정 ⓐ(261125): 포장의 유일 자식 도형이면 방향키 = 포장째 · 흐름 포장 = 무동작 · 도형 패널 그대로 — dev 에선 aacbf8402(현빈 261123 F S3-4 «래퍼째») 가 이미 그 꼴(QA 판보다 뒤)
 *   A1 흐름 포장 = 사본 마크업 그대로 · 안 도형 top −21 · 캔버스 클릭 = 도형 패널 · ↓↑←→ = 도형 offset·포장 자리 그대로 · 이력 0
 *   A2 IAL 포장(섹션 직속 떠 있음) · ↓ ×2 = 포장 offsetY +2 · 안 도형 offset 그대로
 * 양성대조: editor.js _freePositionedAncestor 의 `&& !isShapeFrame(n.parentElement)` 를 걷으면 A1 빨강(도형이 포장 안에서 밀림) */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
/* 사본(미카사 /tmp/hbproj-1123 · proj_1795334411526 Section 14) 의 포장 프레임·도형 마크업 그대로(id 만 바꿈) — 손으로 만든 포장(addShapeBlock)으로는 옛 판에서 증상이 안 났다(실측) */
const REAL = `<div class="frame-block" id="wrA" data-bg="" data-free-layout="true" data-width="242" data-height="242" data-pad-y="0" data-layer-name="rectangle" style="padding: 0px; width: 242px; max-width: none; margin-top: 0px; margin-bottom: 0px; min-height: 242px; height: 242px; align-self: center; flex-shrink: 0;" draggable="true"><div class="shape-block" data-type="shape" data-shape-type="rectangle" data-shape-color="conic-gradient(from 90deg at 50% 50%, #b6d0f7 0%, #eef4e1 15%, #fafcfe 30%, #e2c1f9 45%, #bfd1f9 58%, #fafcfe 75%, #bae4e2 85%, #b6d0f7 100%)" data-shape-stroke-width="0" id="shpA" style="position: absolute; left: 0px; top: -21px;" data-fx-holo="{&quot;k&quot;:&quot;gold&quot;,&quot;a&quot;:100,&quot;prev&quot;:{&quot;c&quot;:&quot;#cccccc&quot;,&quot;g&quot;:null}}" data-shape-gradient="{&quot;type&quot;:&quot;conic&quot;,&quot;angle&quot;:90,&quot;stops&quot;:[{&quot;color&quot;:&quot;#b6d0f7&quot;,&quot;offset&quot;:0,&quot;opacity&quot;:1},{&quot;color&quot;:&quot;#eef4e1&quot;,&quot;offset&quot;:0.15,&quot;opacity&quot;:1},{&quot;color&quot;:&quot;#fafcfe&quot;,&quot;offset&quot;:0.3,&quot;opacity&quot;:1},{&quot;color&quot;:&quot;#e2c1f9&quot;,&quot;offset&quot;:0.45,&quot;opacity&quot;:1},{&quot;color&quot;:&quot;#bfd1f9&quot;,&quot;offset&quot;:0.58,&quot;opacity&quot;:1},{&quot;color&quot;:&quot;#fafcfe&quot;,&quot;offset&quot;:0.75,&quot;opacity&quot;:1},{&quot;color&quot;:&quot;#bae4e2&quot;,&quot;offset&quot;:0.85,&quot;opacity&quot;:1},{&quot;color&quot;:&quot;#b6d0f7&quot;,&quot;offset&quot;:1,&quot;opacity&quot;:1}]}" data-shape-redact-blur="8" data-offset-x="0" data-offset-y="-21"><svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="color:#cccccc;stroke-width:0;fill:currentColor;stroke:currentColor;"><defs><linearGradient x1="0.0000" y1="0.5000" x2="1.0000" y2="0.5000"><stop offset="0%" stop-color="#b6d0f7" stop-opacity="0"></stop><stop offset="15%" stop-color="#eef4e1" stop-opacity="0"></stop><stop offset="30%" stop-color="#fafcfe" stop-opacity="0"></stop><stop offset="45%" stop-color="#e2c1f9" stop-opacity="0"></stop><stop offset="58%" stop-color="#bfd1f9" stop-opacity="0"></stop><stop offset="75%" stop-color="#fafcfe" stop-opacity="0"></stop><stop offset="85%" stop-color="#bae4e2" stop-opacity="0"></stop><stop offset="100%" stop-color="#b6d0f7" stop-opacity="0"></stop></linearGradient></defs><rect x="0" y="0" width="100" height="100" rx="0" fill="url(#grad-shp_svlkp_ru4scb4)"></rect></svg></div></div>`;
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, ial) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (ial) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); sec.id = 'sA'; window.applyZoom?.(100);
    window.deselectAll(); window.selectSection(sec); window.addShapeBlock('rectangle');
    const shp = [...sec.querySelectorAll('.shape-block')].pop(), wr = shp.parentElement; shp.id = 'shpA'; wr.id = 'wrA';
    shp.style.left = '0px'; shp.style.top = '-21px'; shp.dataset.offsetX = '0'; shp.dataset.offsetY = '-21';   // 사본 꼴 그대로(offset 두 키 · 이미 포장 밖으로 21 삐짐 — 옛 문서는 손 0)
    if (ial) { window.OverlayFloat.enterFloat(window.OverlayFloat.posElOf(wr) || wr); }
    window.deselectAll(); window.clearHistory?.(); }, ial);
  await waitZoomSettled(page, 100); await raf(page);
  return errs;
}
const st = (page) => page.evaluate(() => { const s = document.getElementById('shpA'), w = document.getElementById('wrA'), r = w.getBoundingClientRect();
  return { shp: [s.style.left, s.style.top], wr: [Math.round(r.left), Math.round(r.top)], wrOff: [w.dataset.offsetX ?? null, w.dataset.offsetY ?? null], ov: w.dataset.overlayBlock ?? null, tip: window.getHistoryTip?.()?.pos ?? null, head: document.querySelector('#panel-right .prop-block-label, #panel-right .prop-block-name')?.textContent?.trim()?.slice(0, 20) || '' }; });
async function clickShape(page) { const p = await page.evaluate(() => { const r = document.getElementById('wrA').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await page.mouse.click(p[0], p[1]); await raf(page); await page.evaluate(() => document.activeElement?.blur?.()); }

test('A1 (197) 흐름 포장 도형 클릭 → 방향키 = 도형이 포장 안에서 안 밀림 · 포장 자리 그대로', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (REAL) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); sec.id = 'sA'; window.applyZoom?.(100);
    sec.querySelector('.section-inner').insertAdjacentHTML('beforeend', REAL); window.rebindAll?.(); window.deselectAll(); window.clearHistory?.(); }, REAL);
  await waitZoomSettled(page, 100); await raf(page);
  await clickShape(page);
  const a = await st(page);
  expect(await page.evaluate(() => !!document.querySelector('#shpA.selected')), '[전제] 클릭 = 안 도형 고름(도형 패널 그대로)').toBe(true);
  for (const k of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) await page.keyboard.press(k);
  await raf(page);
  const b = await st(page);
  console.log('[197 A1 실측]', JSON.stringify({ a, b }));
  expect([b.shp, b.wr, b.tip], '★도형 offset·포장 자리·이력 그대로(흐름 포장 = 무동작)').toEqual([a.shp, a.wr, a.tip]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('A2 (197) IAL 포장 도형 클릭 → ↓ ×2 = 포장째 +2 · 안 도형 그대로', async ({ page }) => {
  const errs = await scene(page, true);
  expect(await page.evaluate(() => document.getElementById('wrA').dataset.overlayBlock), '[전제] 포장 IAL').toBe('true');
  await clickShape(page);
  const a = await st(page);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await raf(page);
  const b = await st(page);
  console.log('[197 A2 실측]', JSON.stringify({ a, b }));
  expect(b.shp, '★안 도형 offset 그대로').toEqual(a.shp);
  expect(Number(b.wrOff[1]) - Number(a.wrOff[1]), '★포장 offsetY +2').toBe(2);
  expect(errs, errs.join(' | ')).toEqual([]);
});

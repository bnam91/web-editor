/* vector-dup-id — VECTOR-DUP-ID-AFTER-OVERLAY-UNDO-01(지디 261119 실앱 · 0.9.13 125행): 떠 있는 벡터가 같은 id 로 같은 섹션에 2개(위치 다름 · 저장본에도 2개).
 * 뿌리(실측으로 확인할 가설): 떠 있는 것을 끄는 «도중» 캔버스가 통째로 갈리면(⌘Z · 다시 그리기) 끌기 손잡이(overlay-float.js bindFloatMoveDrag)는
 *   옛(떨어져 나간) posEl·옛 섹션을 쥔 채 남는다 → 다음 움직임에서 «지금 커서 아래 섹션 ≠ 옛 섹션»이라 hover.appendChild(옛 posEl) = 되살아난 사본이 라이브 섹션에 붙는다.
 * D1 떠 있는 벡터를 끄는 도중 ⌘Z → 계속 끌고 놓기 → 같은 id 하나 · 저장본(getSerializedCanvas)에도 하나
 * 양성대조: _patches/vecdup-CTL.patch ⇒ D1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 고정 대기 0(dom-fixed-wait-census · cand7 t11) — 요소 상자가 두 rAF 동안 같을 때까지 */
const stable = (page, sel) => expect.poll(() => page.evaluate(async (sel) => {
  const m = () => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => v.toFixed(1)).join(','); };
  const a = m(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const b = m();
  return !!a && a === b;
}, sel), { message: `[전제] ${sel} 멎음` }).toBe(true);
const SVG = '<svg viewBox="0 0 24 24"><rect x="0" y="0" width="24" height="24" fill="currentColor"/></svg>';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((svg) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="vS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="40" style="padding-left:40px;padding-right:40px">
      <div class="gap-block" data-type="gap" style="height:80px"></div><div id="vHost"></div><div class="gap-block" data-type="gap" style="height:500px"></div></div></div>`);
    const { row, block } = window.makeVectorBlock({ svg, color: '#ff0000', w: 80, h: 80 });
    block.id = 'vV'; row.id = 'vR';
    document.getElementById('vHost').replaceWith(row); window.rebindAll?.();
    window.deselectAll?.(); document.getElementById('vS').scrollIntoView({ block: 'start' });
  }, SVG);
  await page.waitForFunction(() => (document.querySelector('#vV svg')?.clientWidth || 0) > 0);   // 그림이 그려졌다
  await stable(page, '#vV');
  return errs;
}
const count = (page) => page.evaluate(() => ({ dom: document.querySelectorAll('#canvas [id="vV"]').length, saved: (window.getSerializedCanvas?.() || '').split('id="vV"').length - 1 }));

test('D1 떠 있는 벡터 끄는 도중 ⌘Z → 계속 끌고 놓아도 같은 id 하나(DOM · 저장본)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { const OF = window.OverlayFloat; OF.enterFloat(OF.posElOf(document.getElementById('vV'))); window.deselectAll?.(); window.clearHistory?.(); window.pushHistory?.('떠 있음'); });
  await stable(page, '#vV');
  const c0 = await count(page);
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('vV').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 40, y + 30, { steps: 5 });
  const mid = await count(page);
  await page.keyboard.press('Meta+z');
  const afterUndo = await count(page);
  await page.mouse.move(x + 120, y + 90, { steps: 8 }); await page.mouse.up();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const c1 = await count(page);
  console.log('[D1 실측]', JSON.stringify({ c0, mid, afterUndo, c1 }));
  expect([c0.dom, c0.saved], '[전제] 처음 하나').toEqual([1, 1]);
  expect([c1.dom, c1.saved], '★끄는 도중 ⌘Z 뒤 계속 끌어도 같은 id 하나(DOM · 저장본)').toEqual([1, 1]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* neutral-preset-active.dom.spec.js — 미카사 실앱 검사 261124(handoff/MIKASA-active-color-261124) ②: 에셋 프리셋 «켬» = 고른 표식 = 2단 회색.
 *   옛: editor-props.css «:has(.prop-preset-btn) .prop-preset-btn.prop-type-btn.active» 한 줄이 남색 #1a2a3a 로 덮고 테·글은 기본(#555 · #969696)이 섞였다.
 *   P1 앱 에셋 패널의 켜진 프리셋 단추 계산값 = --ui-sel-neutral-on-bg / -border / -text · 꺼진 단추와 바탕이 다르다(구분은 산다) */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('P1 에셋 프리셋 켬 = 2단 회색(바탕·테·글 = 중립 켜짐 토큰) · 꺼짐과 구분', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(() => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); window.addSection(); window.addAssetBlock('standard'); window.showAssetProperties(document.querySelector('#canvas .asset-block')); });
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));   // 색 transition 이 끝난 뒤 잰다(panel-redesign-1 P11 과 같은 꼴)
  const r = await page.evaluate(() => {
    const on = document.querySelector('#panel-right .prop-preset-btn.active'), off = document.querySelector('#panel-right .prop-preset-btn:not(.active)');
    const tok = (n, prop) => { const p = document.createElement('span'); p.style[prop] = `var(${n})`; document.body.appendChild(p); const v = getComputedStyle(p)[prop]; p.remove(); return v; };
    const g = (e) => { const s = getComputedStyle(e); return [s.backgroundColor, s.borderTopColor, s.color]; };
    return on && off ? { on: g(on), off: g(off), want: [tok('--ui-sel-neutral-on-bg', 'backgroundColor'), tok('--ui-sel-neutral-on-border', 'color'), tok('--ui-sel-neutral-on-text', 'color')] } : null;
  });
  expect(r, '[전제] 켜진·꺼진 프리셋 단추가 다 있다').not.toBeNull();
  expect(r.on, '★켜진 프리셋 = 중립 켜짐 토큰 셋').toEqual(r.want);
  expect(r.on[0], '꺼짐과 바탕이 다르다').not.toBe(r.off[0]);
  expect(errs).toEqual([]);
});

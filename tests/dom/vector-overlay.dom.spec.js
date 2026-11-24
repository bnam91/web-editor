/* vector-overlay — VECTOR-OVERLAY-TOGGLE-01(현빈 9500 261118): 벡터 패널(prop-vector.js)에도 오버레이(플로팅) 버튼.
 * 공용 js/overlay-float.js 그대로(에셋 prop-asset.js · 아이콘 prop-iconify.js 와 같은 꼴) — 버튼 #vb-float-toggle(Position 절 머리) · X/Y #vb-x/y-number.
 * V0 측정 — 모듈 enterFloat 은 벡터에 그대로 맞는다(패널 배선만 없던 것 · 지디 확인과 같은 사실을 이 판에서 다시 잰다)
 * V1 ★패널 토글 → 섹션 위에 뜬다(자리 |Δ|≤1) · X/Y 칸 보임 · X 칸 입력 → offsetX 따라감 · 다시 누르면 원래 .row 로
 * 양성대조(CTL · _patches/vector-overlay-CTL-no-wire.patch): prop-vector.js 의 wireFloatToggle 줄을 빼면 → V1 빨강(눌러도 안 뜬다) · V0 초록
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
const geo = (page) => page.evaluate(() => {
  const sec = document.getElementById('vS'), g = document.getElementById('vV'), pe = window.OverlayFloat.posElOf(g);
  const s = sec.getBoundingClientRect(), b = g.getBoundingClientRect(), k = s.width / sec.offsetWidth;
  return { x: Math.round((b.left - s.left) / k), y: Math.round((b.top - s.top) / k), float: pe.dataset.overlayBlock === 'true', inRow: !!g.closest('#vR'), ox: pe.dataset.offsetX };
});
async function openPanel(page) {
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('vV').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(x, y);
  await expect(page.locator('#vb-w')).toBeVisible();   // 전제 — 벡터 패널이 열렸다
}
/* 누르기 전 떠 있음 상태를 재 두고 «바뀔 때까지» → 상자 멎음(고정 대기 0) */
const toggle = async (page) => {
  const was = await page.evaluate(() => window.OverlayFloat.posElOf(document.getElementById('vV')).dataset.overlayBlock === 'true');
  await page.click('#vb-float-toggle');
  await expect.poll(() => page.evaluate(() => window.OverlayFloat.posElOf(document.getElementById('vV')).dataset.overlayBlock === 'true'), '[전제] 오버레이 토글이 상태를 바꿨다').toBe(!was);
  await stable(page, '#vV');
};

test('V0 측정 — 공용 모듈 enterFloat 은 벡터에 그대로 맞는다', async ({ page }) => {
  await setup(page);
  const g0 = await geo(page);
  await page.evaluate(() => window.OverlayFloat.enterFloat(document.getElementById('vV')));
  const g1 = await geo(page);
  expect(g1.float).toBe(true);
  expect(Math.abs(g1.x - g0.x) + Math.abs(g1.y - g0.y)).toBeLessThanOrEqual(1);
});

test('V1 ★벡터 패널 토글 → 뜬다 · X/Y · 다시 누르면 원래 줄로', async ({ page }) => {
  const errs = await setup(page);
  const g0 = await geo(page);
  expect(g0).toMatchObject({ float: false, inRow: true });
  await openPanel(page);
  await expect(page.locator('#vb-float-toggle'), '벡터 패널에 오버레이 버튼').toBeVisible();
  await expect(page.locator('#vb-x-number')).toBeDisabled();   // ★2026-11-24 기대 바뀜 — 표준 Position 6-2: 안 떴을 땐 X/Y «있음 + disabled»(옛: 없음)
  await toggle(page);
  const g1 = await geo(page);
  expect(g1.float).toBe(true);
  expect(Math.abs(g1.x - g0.x) + Math.abs(g1.y - g0.y), '띄울 때 자리 점프 없음').toBeLessThanOrEqual(1);
  await expect(page.locator('#vb-float-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#vb-x-number')).toBeVisible();
  await page.fill('#vb-x-number', String((+g1.ox || 0) + 30));
  await expect.poll(async () => +(await geo(page)).ox).toBe((+g1.ox || 0) + 30);
  await toggle(page);
  const g2 = await geo(page);
  expect({ float: g2.float, inRow: g2.inRow }).toEqual({ float: false, inRow: true });
  expect(Math.abs(g2.x - g0.x) + Math.abs(g2.y - g0.y), '돌아오면 원래 자리').toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

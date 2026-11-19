/* vector-resize-stretch — VECTOR-RESIZE-STRETCH-01(현빈 9500 261118): 벡터 손잡이 끌기 = 피그마처럼 그림이 상자를 따라 늘어난다.
 *   js/overlay-handles.js _onVectorResizeHandleMouseDown 이 처음 끌 때 data-stretch=1 + data-stroke-k(그때 meet 배율) · js/blocks/vector-block.js renderVector 가
 *   preserveAspectRatio none + 획 non-scaling-stroke(stroke-width × k). 손잡이 = 모서리 넷(.vector-overlay-handle.nw/ne/sw/se).
 * S0 ★기존 저장본(표시 없음 · 상자 200×100 ≠ viewBox 1:1) → 열기만 해선 안 늘어남(preserveAspectRatio 없음 = meet · 그린 폭 ≈ 100)
 * S1 se 손잡이를 오른쪽으로 +100 끌기 → 표시 켜짐 · 그린 폭 = 상자 폭(늘어남) · 높이 그대로 · 획 화면 굵기 = 끌기 전과 같다
 * S2 Shift + se 끌기 → 상자 비율 그대로(2:1)
 * S3 펜 벡터(penNodes): 늘인 뒤 색 바꾸기(rebuildPenSvg) → viewBox 그대로 · 그린 패스 상자 무변(옛 판은 viewBox 를 w·h 로 다시 써 점과 어긋남)
 * S4 떠 있는 벡터를 nw 손잡이로 끌기 → 맞은편(se) 꼭지 화면 자리 그대로(에셋·도형과 같은 anchoredLeftTop)
 * 양성대조(CTL · _patches/vector-stretch-CTL-no-flag.patch): overlay-handles 의 `vb.dataset.stretch = '1'` 줄을 빼면 → S1 빨강(그린 폭이 안 따라감) · S0 초록
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 고정 대기 0(dom-fixed-wait-census · cand7 t11) — 요소 상자가 두 rAF 동안 같을 때까지 */
const stable = (page, sel) => expect.poll(() => page.evaluate(async (sel) => {
  const m = () => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => v.toFixed(1)).join(','); };
  const a = m(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const b = m();
  return !!a && a === b;
}, sel), { message: `[전제] ${sel} 멎음` }).toBe(true);
const SVG = '<svg viewBox="0 0 100 100" fill="none"><path d="M5 50H95" stroke="currentColor" stroke-width="10"/></svg>';

async function setup(page, extra) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(([svg, extra]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="40" style="padding-left:40px;padding-right:40px">
      <div class="gap-block" data-type="gap" style="height:80px"></div><div id="sHost"></div><div class="gap-block" data-type="gap" style="height:500px"></div></div></div>`);
    const { row, block } = window.makeVectorBlock({ color: '#000000', w: 200, h: 100, ...(extra || {}), svg });
    block.id = 'sV';
    document.getElementById('sHost').replaceWith(row); window.rebindAll?.();
    window.deselectAll?.(); document.getElementById('sS').scrollIntoView({ block: 'start' });
  }, [extra?.svg || SVG, extra || null]);
  await page.waitForFunction(() => (document.querySelector('#sV .vb-inner svg')?.clientWidth || 0) > 0);   // 그림이 그려졌다
  await stable(page, '#sV');
  return errs;
}
/* 화면 px → 모델 px(배율 나눔) · 그린 패스 상자 · 획 화면 굵기(모델 px) */
const look = (page) => page.evaluate(() => {
  const b = document.getElementById('sV'), svg = b.querySelector('.vb-inner svg'), p = svg.querySelector('path');
  const sec = document.getElementById('sS'), k = sec.getBoundingClientRect().width / sec.offsetWidth;
  const pr = p.getBoundingClientRect(), br = b.getBoundingClientRect();
  const sw = parseFloat(p.getAttribute('stroke-width'));
  const ve = p.getAttribute('vector-effect');
  /* 획 화면 굵기: non-scaling 이면 stroke-width 그대로(px) · 아니면 × meet 배율(= svg 그린 높이/viewBox 높이 중 작은 쪽) */
  const meet = Math.min(svg.clientWidth / 100, svg.clientHeight / 100);
  return { stretch: b.dataset.stretch || null, par: svg.getAttribute('preserveAspectRatio'), boxW: Math.round(br.width / k), boxH: Math.round(br.height / k),
    pathW: Math.round(pr.width / k), strokePx: Math.round((ve === 'non-scaling-stroke' ? sw : sw * meet) * 10) / 10, w: b.dataset.w, h: b.dataset.h };
});
async function select(page) {
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('sV').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(x, y);
  await expect(page.locator('.vector-overlay-handle.se')).toHaveCount(1);   // 전제 — 손잡이가 떴다
  await stable(page, '.vector-overlay-handle.se');
}
async function dragSe(page, dx, dy, shift = false, dir = 'se') {
  const h = await page.locator(`.vector-overlay-handle.${dir}`).boundingBox();
  const x = h.x + h.width / 2, y = h.y + h.height / 2;
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(x + (dx * i) / 5, y + (dy * i) / 5);
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
  await stable(page, '#sV');
}

test('S0 기존 저장본 — 표시 없으면 열기만 해선 안 늘어남(meet)', async ({ page }) => {
  await setup(page);
  const g = await look(page);
  expect(g).toMatchObject({ stretch: null, par: null, boxW: 200, boxH: 100 });
  expect(Math.abs(g.pathW - 90), `meet: 그림 폭 ≈ 100(viewBox 1:1 이 높이 100 에 맞춤) · 패스 90 · 실제 ${g.pathW}`).toBeLessThanOrEqual(2);
});

test('S1 ★손잡이 끌기 → 그림이 상자 폭을 따라 늘어남 · 획 굵기 그대로', async ({ page }) => {
  const errs = await setup(page);
  const g0 = await look(page);
  await select(page);
  const z = await page.evaluate(() => { const s = document.getElementById('sS'); return s.getBoundingClientRect().width / s.offsetWidth; });
  await dragSe(page, 100 * z, 0);
  const g1 = await look(page);
  expect(g1).toMatchObject({ stretch: '1', par: 'none', h: '100' });
  expect(Math.abs(+g1.w - 300), `상자 폭 ${g1.w}`).toBeLessThanOrEqual(2);
  expect(Math.abs(g1.pathW - 0.9 * g1.boxW), `늘어남: 패스 폭 ${g1.pathW} ≈ 0.9 × 상자 ${g1.boxW}`).toBeLessThanOrEqual(3);
  expect(Math.abs(g1.strokePx - g0.strokePx), `획 ${g0.strokePx} → ${g1.strokePx}`).toBeLessThanOrEqual(0.2);
  expect(errs).toEqual([]);
});

test('S2 Shift + 끌기 → 비율 고정(2:1)', async ({ page }) => {
  await setup(page);
  await select(page);
  const z = await page.evaluate(() => { const s = document.getElementById('sS'); return s.getBoundingClientRect().width / s.offsetWidth; });
  await dragSe(page, 100 * z, 10 * z, true);
  const g = await look(page);
  expect(g.stretch).toBe('1');
  expect(Math.abs(+g.w / +g.h - 2), `${g.w}×${g.h}`).toBeLessThanOrEqual(0.03);
  expect(+g.w).toBeGreaterThan(280);
});

test('S3 펜 벡터 — 늘인 뒤 색 바꿔도(rebuildPenSvg) 그림이 점과 어긋나지 않는다', async ({ page }) => {
  const nodes = [{ x: 5, y: 50 }, { x: 95, y: 50 }];
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M 5 50 L 95 50" fill="none" stroke="#000000" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  await setup(page, { svg, penNodes: JSON.stringify(nodes), penClosed: '0', strokeWidth: 10 });
  await select(page);
  const z = await page.evaluate(() => { const s = document.getElementById('sS'); return s.getBoundingClientRect().width / s.offsetWidth; });
  await dragSe(page, 100 * z, 0);
  const g1 = await look(page);
  expect(g1.stretch).toBe('1');
  const after = await page.evaluate(() => {
    const b = document.getElementById('sV'); b.dataset.color = '#ff0000';
    window.rebuildPenSvg(b); window.renderVector(b);
    return /viewBox="0 0 100 100"/.test(b.dataset.svg);
  });
  expect(after, 'viewBox 는 점 좌표계 그대로(상자 w·h 로 다시 쓰지 않음)').toBe(true);
  const g2 = await look(page);
  expect(Math.abs(g2.pathW - g1.pathW), `색 바꾸기 전후 패스 폭 ${g1.pathW} → ${g2.pathW}`).toBeLessThanOrEqual(1);
});

test('S4 떠 있는 벡터 nw 끌기 → se 꼭지 고정', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.OverlayFloat.enterFloat(document.getElementById('sV')));
  await select(page);
  const se0 = await page.evaluate(() => { const r = document.getElementById('sV').getBoundingClientRect(); return [r.right, r.bottom]; });
  const z = await page.evaluate(() => { const s = document.getElementById('sS'); return s.getBoundingClientRect().width / s.offsetWidth; });
  await dragSe(page, -60 * z, -30 * z, false, 'nw');
  const g = await page.evaluate(() => { const b = document.getElementById('sV'), r = b.getBoundingClientRect(); return { w: b.dataset.w, h: b.dataset.h, se: [r.right, r.bottom] }; });
  expect(+g.w).toBeGreaterThan(250);
  expect(Math.abs(g.se[0] - se0[0]) + Math.abs(g.se[1] - se0[1]), `se ${se0} → ${g.se}`).toBeLessThanOrEqual(2);
});

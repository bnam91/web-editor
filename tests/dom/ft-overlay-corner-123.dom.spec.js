/* ft-overlay-corner-123.dom.spec.js — 123 FT-OVERLAY-HANDLE-COVERS-FT-CORNER-01
 * 오버레이(플로팅) 글상자에 자유변형을 걸면 네 모서리의 FT 손잡이(.tfh-handle · 글상자 안 .tfh-layer)를
 * 오버레이 리사이즈 손잡이(.tfo-overlay-handle · #ss-handles-overlay z 9990 층 안 z 9992)가 덮는다 —
 * 미카사 앱 실측(8608bb13 ×3): 네 모서리 임자 = tfo · nw 를 끌면 FT 점이 아니라 상자가 줄어든다(461×119 → 405×105).
 * ★권고①(tfo z 9992 → 9993)은 같은 층 안의 순서만 바꾼다 — FT 손잡이는 캔버스 내용이라 그 층 «밑»이다(사본 실측 ×3 무변).
 * 처방(f2112dcf 의 «오버레이» 짝 · css :has): 자유변형이 걸린 글상자를 고른 동안 tfo 모서리 손잡이를 숨긴다(편집 중 숨김과 같은 뜻 ·
 *   js/overlay-handles.js 무접촉 — U2-SCOPE). 자유변형을 빼면 돌아온다.
 * 칸
 *   P0  전제 — 오버레이 글상자 · 자유변형 · FT 손잡이 12 · 모서리 넷이 tfo 자리와 «같은 점»(3px 안)
 *   C   ★모서리 넷 — 그 점의 임자 = 그 FT 손잡이
 *   D   ★nw 진짜 끌기 → FT 네 점의 nw 가 움직이고 상자 폭은 그대로(오버레이 리사이즈가 아니다)
 *   N   자유변형 없는 오버레이 글상자 — tfo 모서리 넷이 보이고 그 점의 임자 = tfo(오버레이 리사이즈 그대로)
 *   O   자유변형을 빼면 tfo 모서리가 돌아온다
 * 양성대조: GD1001_ROOT=<핀 8608bb13 사본> ⇒ C·D 빨강 · P0·N·O 초록.
 * ⛔고정 대기 없음 — waitForFunction 만. 하네스 = _root-harness.bootApp · 고르기·토글·끌기는 진짜 마우스.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page, { ft = true } = {}) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    window.selectSection(sec);
    window.addTextBlock('h1', { content: '오버레이 자유변형' });
    window.applyZoom?.(40);
    window.__tb = [...sec.querySelectorAll('.text-block')].pop();
    window.deselectAll?.();
    window.__tb.scrollIntoView({ block: 'center' });
  });
  const mid = () => page.evaluate(() => { const r = window.__tb.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  let p = await mid(); await page.mouse.click(p[0], p[1]);
  await page.waitForFunction(() => window.__tb.classList.contains('selected') && !!document.getElementById('txt-overlay-toggle'));
  const t = await page.evaluate(() => { const e = document.getElementById('txt-overlay-toggle'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(t[0], t[1]);
  await page.waitForFunction(() => window.__tb.closest('[data-overlay-block="true"]'));
  /* 오버레이 손잡이는 «캔버스 클릭»으로 붙는다 — 한 번 비우고 다시 진짜 클릭 */
  await page.evaluate(() => { window.deselectAll?.(); window.__tb.scrollIntoView({ block: 'center' }); });
  await page.waitForFunction(() => !window.__tb.classList.contains('selected'));
  p = await mid(); await page.mouse.click(p[0], p[1]);
  await page.waitForFunction(() => window.__tb.classList.contains('selected') && document.querySelectorAll('#ss-handles-overlay .tfo-overlay-handle').length === 4);
  if (ft) {
    await page.selectOption('#txt-fx-add', 'freetransform');
    await page.waitForFunction(() => window.__tb.querySelectorAll('.tfh-handle').length === 12 && window.__tb.dataset.tfCorners);
  }
  /* 손잡이 자리가 두 프레임 내리 같을 때까지 */
  await page.evaluate(() => new Promise((done) => { let prev = null, n = 0; const t = () => { const k = [...document.querySelectorAll('.tfh-handle.corner, #ss-handles-overlay .tfo-overlay-handle')].map((h) => { const r = h.getBoundingClientRect(); return r.left + ',' + r.top; }).join('|'); if (k === prev) { if (++n >= 2) return done(); } else n = 0; prev = k; requestAnimationFrame(t); }; requestAnimationFrame(t); }));
  return errs;
}
const ftAt = (page, n) => page.evaluate((n) => { const r = window.__tb.querySelector(`.tfh-handle[data-tfh="${n}"]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, n);
const tfoAt = (page, n) => page.evaluate((n) => { const h = document.querySelector(`#ss-handles-overlay .tfo-overlay-handle.${n}`); if (!h) return null; const r = h.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, n);
const ownerAt = (page, p) => page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e?.classList?.contains('tfh-handle') ? 'FT:' + e.dataset.tfh : e?.classList?.contains('tfo-overlay-handle') ? 'TFO' : (e ? e.className.toString().slice(0, 24) : null); }, p);
const CORNERS = ['nw', 'ne', 'se', 'sw'];

test('P0 전제 — 오버레이 · 자유변형 · FT 12 · FT 모서리 넷이 tfo 자리와 같은 점', async ({ page }) => {
  const errs = await setup(page, { ft: true });
  const d = [];
  for (const n of CORNERS) {
    const a = await ftAt(page, n);
    /* 고친 판에선 tfo 가 숨어 있다 — 자리는 블럭 상자 모서리로 잰다(tfo 가 앉는 바로 그 점 · _cornerScreen) */
    const b = await page.evaluate((n) => { const pe = window.__tb.closest('[data-overlay-block="true"]'); const r = pe.getBoundingClientRect(); return [n.includes('w') ? r.left : r.right, n.includes('n') ? r.top : r.bottom]; }, n);
    d.push(Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) <= 4);
  }
  expect(d, '★FT 모서리 = 오버레이 모서리 자리(겹침 전제)').toEqual([true, true, true, true]);
  expect(errs).toEqual([]);
});

test('C ★모서리 넷 — 그 점의 임자 = 그 FT 손잡이', async ({ page }) => {
  const errs = await setup(page, { ft: true });
  const out = [];
  for (const n of CORNERS) { const p = await ftAt(page, n); await page.mouse.move(p[0], p[1]); out.push(await ownerAt(page, p)); }
  expect(out).toEqual(CORNERS.map((n) => 'FT:' + n));
  expect(errs).toEqual([]);
});

test('D ★nw 진짜 끌기 → FT nw 점이 움직이고 상자 폭은 그대로', async ({ page }) => {
  const errs = await setup(page, { ft: true });
  const s0 = await page.evaluate(() => ({ tf: window.__tb.dataset.tfCorners, w: window.__tb.closest('[data-overlay-block="true"]').offsetWidth }));
  const p = await ftAt(page, 'nw');
  await page.mouse.move(p[0], p[1]); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(p[0] + 20 * i / 6, p[1] + 15 * i / 6);
  await page.mouse.up();
  await page.waitForFunction((t0) => window.__tb.dataset.tfCorners !== t0, s0.tf, { timeout: 5000 }).catch(() => {});
  const s1 = await page.evaluate(() => ({ tf: window.__tb.dataset.tfCorners, w: window.__tb.closest('[data-overlay-block="true"]').offsetWidth }));
  const a = s0.tf.split(',').map(Number), b = (s1.tf || '').split(',').map(Number);
  expect(b[0], '★nw.x 가 움직였다').toBeGreaterThan(a[0] + 5);
  expect(s1.w, '★상자 폭 그대로(오버레이 리사이즈 아님)').toBe(s0.w);
  expect(errs).toEqual([]);
});

test('N 자유변형 없는 오버레이 — tfo 모서리 넷이 보이고 임자 = tfo', async ({ page }) => {
  const errs = await setup(page, { ft: false });
  const out = [];
  for (const n of CORNERS) { const p = await tfoAt(page, n); out.push(p ? await ownerAt(page, p) : null); }
  expect(out).toEqual(['TFO', 'TFO', 'TFO', 'TFO']);
  expect(errs).toEqual([]);
});

test('O 자유변형을 빼면 tfo 모서리가 돌아온다', async ({ page }) => {
  const errs = await setup(page, { ft: true });
  expect(await page.evaluate(() => typeof window.setFxFreeTransform), '전제: 자유변형 문(✕ = null)').toBe('function');
  await page.evaluate(() => window.setFxFreeTransform(window.__tb, null));   /* 패널 ✕ 와 같은 문(effects-freetransform.js 머리) */
  await page.waitForFunction(() => !window.__tb.dataset.tfCorners, null, { timeout: 4000 });
  await page.waitForFunction(() => [...document.querySelectorAll('#ss-handles-overlay .tfo-overlay-handle')].filter((h) => getComputedStyle(h).display !== 'none').length === 4, null, { timeout: 4000 });
  const p = await tfoAt(page, 'se');
  expect(await ownerAt(page, p)).toBe('TFO');
  expect(errs).toEqual([]);
});

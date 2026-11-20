/* t13d-04 — 0.9.13 t13D-04 섹션 오버레이 블럭 끌기에 스마트 가이드(프레임 안 끌기와 같은 것)
 * 고침: overlay-float.js 끌기 onMove 가 smart-guides.js snapPosition/showGuides 를 부모 = 섹션으로 부른다(window.SmartGuides · 순수 import 규칙) · ⌘ = 자석 끔.
 * S1 섹션 가로 중앙 근처(6px)로 끌면 → 중앙에 붙고 세로 가이드선이 보인다 · 놓으면 가이드 0
 * S2 다른 떠 있는 블럭의 윗변 근처(5px)로 끌면 → 윗변이 같아지고 가로 가이드선
 * S3 ⌘ 누른 채 같은 끌기 → 자석 없음(6px 그대로) · 가이드 0
 * 양성대조: _patches/t13d-04-CTL.patch(overlay-float.js 의 자석·가이드 줄 걷음) → S1·S2 빨강 · S3 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const guides = (page) => page.evaluate(() => [...document.querySelectorAll('#ss-handles-overlay .smart-guide')].filter((g) => g.getBoundingClientRect().width > 0 || g.getBoundingClientRect().height > 0).map((g) => (g.classList.contains('vertical') ? 'v' : 'h')));

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    c.querySelector('.section-block').id = 'sG'; window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate(() => {
    const sec = document.getElementById('sG'); document.getElementById('canvas-wrap').scrollTop = 0; sec.scrollIntoView({ block: 'start' });
    const float = (tf, id, txt, x, y) => { tf.id = id; tf.style.width = '160px'; tf.dataset.width = '160';
      const tb = tf.querySelector('[class^="tb-"]'); tb.textContent = txt; tb.style.fontSize = '20px'; delete tb.dataset.isPlaceholder;
      const p = window.OverlayFloat.posElOf(tf); window.OverlayFloat.enterFloat(p); p.style.left = x + 'px'; p.style.top = y + 'px'; p.dataset.offsetX = String(x); p.dataset.offsetY = String(y); };
    float(sec.querySelector('.frame-block[data-text-frame]'), 'tfA', '가', 40, 30);
    window.deselectAll(); window.selectSection(sec); window.addTextBlock('body');
    float([...sec.querySelectorAll('.frame-block[data-text-frame]')].find((x) => x.id !== 'tfA'), 'tfB', '나', 560, 120);
    window.deselectAll(); document.activeElement?.blur?.();
  });
  await raf(page);
  const pre = await page.evaluate(() => ['tfA', 'tfB'].map((id) => { const t = document.getElementById(id); return [(window.OverlayFloat.posElOf(t) || t).dataset.overlayBlock, t.parentElement.id]; }));
  expect(pre, '[전제] 둘 다 섹션 직속 오버레이').toEqual([['true', 'sG'], ['true', 'sG']]);
  return errs;
}
const st = (page) => page.evaluate(() => { const a = document.getElementById('tfA'), b = document.getElementById('tfB'), s = document.getElementById('sG');
  return { aL: parseFloat(a.style.left), aT: parseFloat(a.style.top), aW: a.offsetWidth, bT: parseFloat(b.style.top), secW: s.offsetWidth }; });
/* A 를 골라 놓고(클릭) 진짜 마우스로 (dx, dy) 만큼 끈다 — 놓기 전 재기(mid)를 돌려준다 */
async function drag(page, dx, dy, { meta = false, mid } = {}) {
  const p = await page.evaluate(() => { const r = document.getElementById('tfA').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(p[0], p[1]); await raf(page);
  await page.mouse.move(p[0], p[1]); await page.mouse.down();
  if (meta) await page.keyboard.down('Meta');   // 누른 «뒤»에 ⌘ — ⌘클릭(복수 선택)과 안 섞이게 · 끌기 중 ⌘ 는 onMove 가 ev.metaKey 로 읽는다
  for (let i = 1; i <= 10; i++) await page.mouse.move(p[0] + dx * i / 10, p[1] + dy * i / 10);
  await raf(page);
  const during = mid ? await mid() : null;
  await page.mouse.up(); if (meta) await page.keyboard.up('Meta'); await raf(page);
  return during;
}

test('S1 섹션 가로 중앙 근처로 끌면 중앙에 붙고 세로 가이드선 · 놓으면 가이드 0', async ({ page }) => {
  const errs = await scene(page);
  const a = await st(page);
  const dx = a.secW / 2 - (a.aL + a.aW / 2) - 6;   // 중앙에서 6px 모자람(자석 10px 안)
  const during = await drag(page, dx, 0, { mid: async () => ({ s: await st(page), g: await guides(page) }) });
  expect(Math.abs(during.s.aL - (a.aL + dx)) <= 1 || during.s.aL + during.s.aW / 2 === during.s.secW / 2, '[전제] 끌기가 먹었다').toBe(true);
  expect(during.s.aL + during.s.aW / 2, `★가로 중앙에 붙음(섹션 폭 ${a.secW})`).toBe(a.secW / 2);
  expect(during.g, '★세로 가이드선').toContain('v');
  expect(await guides(page), '★놓으면 가이드 0').toEqual([]);
  expect(errs).toEqual([]);
});

test('S2 다른 떠 있는 블럭 윗변 근처로 끌면 윗변이 같아지고 가로 가이드선', async ({ page }) => {
  const errs = await scene(page);
  const a = await st(page);
  const dy = a.bT - a.aT - 5;   // B 윗변에서 5px 모자람 · 가로는 그대로(중앙·가장자리와 멀다)
  const during = await drag(page, 0, dy, { mid: async () => ({ s: await st(page), g: await guides(page) }) });
  expect(during.s.aT, `★B 윗변(${a.bT})에 붙음`).toBe(a.bT);
  expect(during.g, '★가로 가이드선').toContain('h');
  expect(errs).toEqual([]);
});

test('S3 ⌘ 누른 채 끌면 자석 없음 · 가이드 0', async ({ page }) => {
  const errs = await scene(page);
  const a = await st(page);
  const dx = a.secW / 2 - (a.aL + a.aW / 2) - 6;
  const during = await drag(page, dx, 0, { meta: true, mid: async () => ({ s: await st(page), g: await guides(page) }) });
  expect(Math.round(during.s.aL + during.s.aW / 2 - a.secW / 2), '★중앙에서 6px 모자란 그대로(자석 끔)').toBe(-6);
  expect(during.g, '★가이드 0').toEqual([]);
  expect(errs).toEqual([]);
});

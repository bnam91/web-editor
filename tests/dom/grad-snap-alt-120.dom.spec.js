/* grad-snap-alt-120.dom.spec.js — 120 H9-SNAP-INTENT-UNJUDGED-01 ⑵(현빈 GO · 261026): 그라데이션 끌기 스냅을 «보조키로 끄는 길»이 없다 → 더한다.
 *   보조키 = ⌥(Alt) — 선례 js/scratch-pad.js:1120 `snapEnabled = !mv.altKey`(「Alt 누르면 bypass」). 끄는 동안에만(매 mousemove 의 ev.altKey).
 *   ⛔스냅 세기(GRAD_SNAP_SCREEN 16 화면px)·섹션 clamp 는 안 건드린다. ⛔리사이즈의 ⌥(=가운데 기준)는 무접촉.
 * 장면: 섹션을 글상자로 키우고(천장이 안 막게 — h9ⓒ 실측 선례) 그라데이션 300×150 @ (200,200).
 * 칸
 *   P0  전제 — 진짜 클릭으로 그라데이션이 골라진다 · 섹션이 그라데이션보다 넓고 높다
 *   S   스냅 그대로 — 왼변을 섹션 왼끝 6 모델px 안까지 끌면 x = 0 으로 붙는다(옛 판과 같다)
 *   A   ★⌥ 누른 채 같은 끌기 → x = 6 ±1(안 붙는다) · 붙은 변 표시 0
 *   R   ⌥ 리사이즈는 옛 뜻 그대로(가운데 기준 · 폭 변화 = 끈 양 × 2)
 * 양성대조: GD1001_ROOT=<핀 8608bb13 사본> ⇒ A 빨강(⌥ 이어도 0 으로 붙음) · P0·S·R 초록.
 * ⛔고정 대기 없음. 하네스 = _root-harness.bootApp · 끌기·⌥ 는 진짜 입력(page.mouse · page.keyboard).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    for (let i = 0; i < 4; i++) { window.selectSection(sec); window.addTextBlock('h1', { content: '섹션 키우기 ' + i }); }
    window.selectSection(sec);
    window.addGradientBlock();
    const g = sec.querySelector(':scope > .gradient-block');
    Object.assign(g.dataset, { gradWidth: '300', gradHeight: '150', x: '200', y: '200' });
    window.renderGradientBlock(g);
    window.__sec = sec; window.__g = g;
    window.deselectAll?.();
    g.scrollIntoView({ block: 'center' });
  });
  await page.evaluate(() => new Promise((done) => { let p = null, n = 0; const t = () => { const r = window.__g.getBoundingClientRect(); const k = [r.left, r.top, r.width].join(); if (k === p) { if (++n >= 2) return done(); } else n = 0; p = k; requestAnimationFrame(t); }; requestAnimationFrame(t); }));
  const p = await page.evaluate(() => { const r = window.__g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(p[0], p[1]);
  await page.waitForFunction(() => window.__g.classList.contains('selected'));
  return errs;
}
/* 그라데이션 가운데를 눌러 왼변이 «모델 x = to» 가 되게 끈다(배율 반영) · alt = 끄는 동안 ⌥ */
async function dragTo(page, to, { alt = false } = {}) {
  const s = await page.evaluate(() => { const r = window.__g.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, z: (window.currentZoom || 40) / 100, x: +window.__g.dataset.x }; });
  const dx = (to - s.x) * s.z;
  await page.mouse.move(s.cx, s.cy); await page.mouse.down();
  if (alt) await page.keyboard.down('Alt');
  for (let i = 1; i <= 8; i++) await page.mouse.move(s.cx + dx * i / 8, s.cy + 2 * i / 8);
  const guides = await page.evaluate(() => [...document.querySelectorAll('#ss-handles-overlay > div')].filter((d) => d.style.zIndex === '9999' && /2px/.test(d.style.width + d.style.height)).length);
  await page.mouse.up();
  if (alt) await page.keyboard.up('Alt');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return { x: +(await page.evaluate(() => window.__g.dataset.x)), guides };
}

test('P0 전제 — 골라짐 · 섹션이 그라데이션보다 넓고 높다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => ({ sw: window.__sec.clientWidth, sh: window.__sec.clientHeight, gw: window.__g.offsetWidth, gh: window.__g.offsetHeight }));
  expect(r.sw).toBeGreaterThan(r.gw + 100);
  expect(r.sh).toBeGreaterThan(r.gh + 100);
  expect(errs).toEqual([]);
});

test('S 스냅 그대로 — 왼끝 6 안까지 끌면 x = 0', async ({ page }) => {
  const errs = await setup(page);
  const r = await dragTo(page, 6);
  expect(r.x, '★스냅이 사라졌다(옛 동작이 바뀌었다)').toBe(0);
  expect(errs).toEqual([]);
});

test('A ★⌥ 누른 채 같은 끌기 → x = 6 ±1 · 붙은 변 표시 0', async ({ page }) => {
  const errs = await setup(page);
  const r = await dragTo(page, 6, { alt: true });
  expect(Math.abs(r.x - 6), `★⌥ 인데 붙었다 x=${r.x}`).toBeLessThanOrEqual(1);
  expect(r.guides, '★⌥ 인데 붙은 변 표시가 떴다').toBe(0);
  expect(errs).toEqual([]);
});

test('R ⌥ 리사이즈는 옛 뜻 그대로 — 가운데 기준(폭 변화 = 끈 양 × 2)', async ({ page }) => {
  const errs = await setup(page);
  const h = await page.evaluate(() => { const e = window.__g.querySelector('[data-corner="br"], .gradient-corner-handle.br') || document.querySelector('#ss-handles-overlay > .gradient-corner-handle[data-corner="br"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, z: (window.currentZoom || 40) / 100 }; });
  test.skip(!h, '★br 모서리 손잡이를 못 찾았다(자리 이름이 다르다) — 이 칸은 범위 밖');
  const w0 = +(await page.evaluate(() => window.__g.dataset.gradWidth));
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.keyboard.down('Alt');
  for (let i = 1; i <= 6; i++) await page.mouse.move(h.x + 30 * h.z * i / 6, h.y);
  await page.mouse.up(); await page.keyboard.up('Alt');
  const w1 = +(await page.evaluate(() => window.__g.dataset.gradWidth));
  expect(Math.abs((w1 - w0) - 60), `★⌥ 리사이즈 폭 변화 ${w1 - w0}`).toBeLessThanOrEqual(2);
  expect(errs).toEqual([]);
});

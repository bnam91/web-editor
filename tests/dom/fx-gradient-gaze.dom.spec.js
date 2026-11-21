/* fx-gradient-gaze — FX-GRADIENT-GAZE-01 v1(현빈 261121 가안 «계산 그라데이션» · 지디 안 A): 색 고르기 그라데이션 탭 «홀로그램» 원형 프리셋 + «세기»
 *   프리셋 = 무지갯빛 정지점 묶음(js/fx/holo-palette.js · 배지와 같은 색)을 «기존 그라데이션 칠»에 넣는다 ⇒ PNG·HTML·Figma 가 기존 그라데이션 길로 나감.
 *   세기 = 모든 정지점 투명도를 한 번에(그라데이션 길 안 ⇒ Figma 정지점 알파도 나감). 블렌드 = v1 없음(덮개·플러그인 명령 필요 → 다음 판).
 * G1 도형 — 칠 스와치 → 그라데이션 탭 → «gold» 진짜 클릭 → 도형 SVG linearGradient 정지 8 = gold 7색(끝 = 첫 색) · Figma JSON gradientDef 정지 8 같은 색
 * G2 도형 «세기» 50 → SVG 정지 stop-opacity 전부 0.5 · Figma JSON 정지 opacity 0.5
 * G3 텍스트 — 글자색 스와치 → 그라데이션 탭 → «aurora» → 글자 그라데이션(background-clip:text) = aurora 색 · Figma JSON 글자 그라데이션 정지 = aurora
 * G4 내보내기 — PNG 도형 자리에 색이 여럿(무지갯빛 · 단색 아님) · HTML 에 그 정지 색
 * 양성대조: _patches/gaze-preset-CTL.patch(프리셋 클릭·세기 배선 걷음) → G1~G4 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const GOLD = ['#d4a956', '#fff3c2', '#b8821a', '#f0d088', '#a87420', '#ffefa0', '#b88830'];
const AURORA = ['#7ef0d0', '#a0c4ff', '#e3a8ff', '#ffd6a0', '#9bf6ff', '#ffffff', '#caffbf'];
const ring = (c) => [...c, c[0]];

async function scene(page, kind) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (kind) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); window.applyZoom?.(100);
    const sec = c.querySelector('.section-block'); sec.id = 'sG'; window.deselectAll(); window.selectSection(sec);
    if (kind === 'shape') { const before = new Set(sec.querySelectorAll('.shape-block')); window.addShapeBlock('rectangle'); [...sec.querySelectorAll('.shape-block')].find((x) => !before.has(x)).id = 'shG'; }
    else { const before = new Set(sec.querySelectorAll('.text-block')); window.addTextBlock('h1'); const tb = [...sec.querySelectorAll('.text-block')].find((x) => !before.has(x)); tb.id = 'tbG'; const e = tb.querySelector('[class^="tb-"]'); e.textContent = 'HOLOGRAM'; delete e.dataset.isPlaceholder; }
    window.clearHistory?.();
  }, kind);
  await waitZoomSettled(page, 100);
  const id = kind === 'shape' ? 'shG' : 'tbG';
  const xy = await page.evaluate((id) => { const e = document.getElementById(id); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + Math.min(30, r.width / 2), r.top + r.height / 2]; }, id);
  await page.mouse.click(xy[0], xy[1]); await raf(page);
  await page.evaluate(({ id, kind }) => { const el = document.getElementById(id); if (kind === 'shape' ? !document.getElementById('shape-color-color') : !document.getElementById('txt-color')) (kind === 'shape' ? window.showShapeProperties : window.showTextProperties)?.(el); }, { id, kind });
  const sw = kind === 'shape' ? '#shape-color-color' : '#txt-color';
  await page.waitForFunction((s) => !!document.querySelector(s), sw, { timeout: 5000 });
  await page.locator(sw).scrollIntoViewIfNeeded(); await page.locator(sw).locator('xpath=..').click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.goya-cp-popover') || document.body).display !== 'none' && !!document.querySelector('.goya-cp-popover'), null, { timeout: 5000 });
  await page.click('.goya-cp-tab[data-tab="gradient"]'); await raf(page);
  expect(await page.evaluate(() => document.querySelectorAll('.goya-cp-popover [data-holo]').length), '[전제] 홀로그램 프리셋 6').toBe(6);
  return errs;
}
const shapeStops = (page) => page.evaluate(() => [...document.querySelectorAll('#shG svg linearGradient stop')].map((s) => ({ c: (s.getAttribute('stop-color') || '').toLowerCase(), o: s.getAttribute('stop-opacity') })));
const figNode = (page, id) => page.evaluate(async (id) => { const j = await window.buildFigmaExportJSON(['sG']); let n = null; const w = (o) => { if (!o || typeof o !== 'object' || n) return; if (o.id === id) { n = o; return; } Object.values(o).forEach(w); }; w(j); return n; }, id);
const defStops = (d) => [...String(d || '').matchAll(/<stop[^>]*stop-color="([^"]+)"[^>]*stop-opacity="([^"]+)"/g)].map((m) => ({ color: m[1], opacity: parseFloat(m[2]) }));   // gradientDef = SVG <linearGradient> 글
const hexOf = (c) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); return m ? '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('') : String(c || '').toLowerCase(); };

test('G1 도형 «gold» → SVG 정지 8 = gold · Figma 같은 색', async ({ page }) => {
  const errs = await scene(page, 'shape');
  await page.click('.goya-cp-popover [data-holo="gold"]'); await raf(page);
  const st = await shapeStops(page);
  expect(st.map((s) => hexOf(s.c)), '★SVG 정지 = gold 고리').toEqual(ring(GOLD));
  const n = await figNode(page, 'shG');
  const fs = defStops(n?.gradientDef).map((s) => hexOf(s.color));
  expect(fs, `★Figma gradientDef ${JSON.stringify(n?.gradientDef)?.slice(0, 200)}`).toEqual(ring(GOLD));
  expect(errs).toEqual([]);
});

test('G2 도형 «세기» 50 → 정지 투명도 0.5 · Figma 0.5', async ({ page }) => {
  const errs = await scene(page, 'shape');
  await page.click('.goya-cp-popover [data-holo="gold"]'); await raf(page);
  await page.locator('.goya-cp-popover [data-el="gradAllOpacity"]').fill('50'); await raf(page); await raf(page);
  const st = await shapeStops(page);
  expect(st.length === 8 && st.every((s) => Math.abs(parseFloat(s.o) - 0.5) < 0.01), `★SVG stop-opacity 0.5 ${JSON.stringify(st)}`).toBe(true);
  const n = await figNode(page, 'shG');
  const op = defStops(n?.gradientDef).map((s) => s.opacity);
  expect(op.length === 8 && op.every((v) => Math.abs(v - 0.5) < 0.01), `★Figma 정지 opacity ${JSON.stringify(op)}`).toBe(true);
  expect(errs).toEqual([]);
});

test('G3 텍스트 «aurora» → 글자 그라데이션 · Figma 글자 정지', async ({ page }) => {
  const errs = await scene(page, 'text');
  await page.click('.goya-cp-popover [data-holo="aurora"]'); await raf(page);
  const css = await page.evaluate(() => { const e = document.querySelector('#tbG [class^="tb-"]'); return { bg: e.style.backgroundImage, clip: getComputedStyle(e).backgroundClip || getComputedStyle(e).webkitBackgroundClip }; });
  const cols = [...css.bg.matchAll(/rgba?\([^)]*\)|#[0-9a-f]{6}/gi)].map((m) => hexOf(m[0]));
  expect([cols, css.clip], `★글자 그라데이션 = aurora ${css.bg.slice(0, 160)}`).toEqual([ring(AURORA), 'text']);
  const n = await figNode(page, 'tbG');
  const s = JSON.stringify(n || {});
  expect(AURORA.every((c) => s.toLowerCase().includes(c.slice(1)) || s.toLowerCase().includes(c)), `★Figma 글자에 aurora 색 ${s.slice(0, 240)}`).toBe(true);
  expect(errs).toEqual([]);
});

test('G4 PNG 무지갯빛 · HTML 정지 색', async ({ page }) => {
  const errs = await scene(page, 'shape');
  const hues = () => page.evaluate(async () => { const s = document.getElementById('sG'); const r = await window.__exportGate.captureTruth(s, 860, window.__exportGate.sectionBgColor(s));
    const sr = s.getBoundingClientRect(), b = document.getElementById('shG').getBoundingClientRect(), k = 860 / sr.width; const x = r.canvas.getContext('2d');
    const d = x.getImageData(Math.round((b.left - sr.left) * k) + 6, Math.round((b.top - sr.top) * k) + 6, Math.round(b.width * k) - 12, Math.round(b.height * k) - 12).data; const set = new Set();
    for (let i = 0; i < d.length; i += 4 * 7) set.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4)); return set.size; });
  const h0 = await hues();
  await page.click('.goya-cp-popover [data-holo="oil"]'); await raf(page);
  const h1 = await hues();
  expect(h1 > h0 + 8, `★PNG 색 가짓수 ${h0} → ${h1}`).toBe(true);
  const html = await page.evaluate(async () => { let blob = null; const oc = URL.createObjectURL, ok = HTMLAnchorElement.prototype.click; URL.createObjectURL = function (x) { blob = x; return oc.call(URL, x); }; HTMLAnchorElement.prototype.click = function () { if (!this.download) return ok.call(this); }; try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok; } return blob ? (await blob.text()).toLowerCase() : ''; });
  expect(['#5ad1c8', '#f5a3c7', '#6b8cff'].every((c) => html.includes(c) || html.includes(hexOf(c))), '★HTML 에 oil 정지 색').toBe(true);
  expect(errs).toEqual([]);
});

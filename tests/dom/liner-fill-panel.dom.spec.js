/* liner-fill-panel.dom.spec.js — LINER-FILL-ALPHA-READS-MIRROR-01 (2026-11-21 · 제니)
 *
 * ★병 — 라이너(곡선 글자) 패널 Fill 이 «글자색 000000 · 0%». 패널이 숨은 미러 .tb-liner(CSS color:transparent)의 computed 를 읽었다.
 * ★고침 — 라이너면 실제 그려진 SVG 글자 칠(svg.lnr-svg text fill)을 읽는다 · SVG 글자가 없으면 미러 인라인(없으면 #111111) · 0% 로 안 보인다.
 * 재는 것: L1 기본 = 111111·100 · L2 패널에서 색·불투명도 → SVG 칠 · 다시 고르면 패널 같은 값 · 미러 투명 그대로 · L3 저장 왕복
 *   L4 SVG 글자 없는 순간 = 100% · L5 내보내기(Figma JSON svg · PNG) + png · N1 일반 텍스트 Fill 무변화
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/liner-fill-panel.dom.spec.js */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const OUT = process.env.LINER_FILL_PNG_DIR || path.join(os.homedir(), 'gd-team-261121', 'jn-liner-fill-png');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  const id = await page.evaluate(() => {
    if (!document.querySelector('#canvas .section-block')) window.addSection();
    const sec = [...document.querySelectorAll('#canvas .section-block')].pop(); sec.id = sec.id || 'sL';
    window.deselectAll?.(); window.selectSection(sec);
    window.addLinerBlock('arc-up');
    const b = [...sec.querySelectorAll('.liner-block')].pop(); b.id = b.id || 'lnrT';
    window.deselectAll?.(); b.scrollIntoView({ block: 'center' });
    return b.id;
  });
  await page.waitForFunction((id) => !!document.querySelector(`#${id} svg.lnr-svg text`), id, { timeout: 5000 });
  return { errs, id };
}
async function pick(page, id) {
  await expect(async () => {
    const r = await waitStableRect(page, `#${id}`);
    await page.evaluate(() => { window.deselectAll?.(); document.getElementById('txt-color-hex')?.remove(); });
    await page.mouse.click(r.left + r.width / 2, r.top + r.height / 2);
    await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected') && !!document.getElementById('txt-color-hex'), id, { timeout: 3000 });
  }).toPass({ timeout: 15000 });
}
const panel = (page) => page.evaluate(() => ({ hex: document.getElementById('txt-color-hex').value.toUpperCase(), alpha: document.getElementById('txt-color-alpha').value }));
const svgFill = (page, id) => page.evaluate((id) => getComputedStyle(document.querySelector(`#${id} svg.lnr-svg text`)).fill, id);
const mirrorCs = (page, id) => page.evaluate((id) => { const m = document.querySelector(`#${id} .tb-liner`); const cs = getComputedStyle(m); return { opacity: cs.opacity }; }, id);

test('L1 ★라이너를 고르면 패널 Fill = 그려진 칠 111111 · 100%(옛: 000000 · 0%)', async ({ page }) => {
  const { errs, id } = await setup(page);
  expect(await svgFill(page, id), '전제 — 그려진 칠').toBe('rgb(17, 17, 17)');
  await pick(page, id);
  expect(await panel(page)).toEqual({ hex: '111111', alpha: '100' });
  fs.mkdirSync(OUT, { recursive: true });
  const row = page.locator('#txt-color-hex').locator('xpath=ancestor::*[contains(@class,"prop-color-row") or contains(@class,"prop-row")][1]');
  await row.screenshot({ path: path.join(OUT, 'panel-fill-row.png') });
  expect(errs).toEqual([]);
});

test('L2 패널에서 FF0000 · 50% → SVG 칠 rgba(255,0,0,0.5) · 다시 고르면 패널도 같은 값 · 미러는 여전히 안 보임', async ({ page }) => {
  const { errs, id } = await setup(page);
  await pick(page, id);
  await page.fill('#txt-color-hex', 'FF0000'); await page.locator('#txt-color-hex').dispatchEvent('change');
  await page.fill('#txt-color-alpha', '50'); await page.locator('#txt-color-alpha').dispatchEvent('input'); await page.locator('#txt-color-alpha').dispatchEvent('change');
  await expect.poll(() => svgFill(page, id), '★SVG 칠이 따라온다').toBe('rgba(255, 0, 0, 0.5)');
  /* 미러는 transition:all — 고르기 클릭 뒤 opacity 가 0 으로 내려가는 중일 수 있다 ⇒ 멎을 때까지 */
  await expect.poll(async () => (await mirrorCs(page, id)).opacity, '미러 투명 그대로(인라인 색이 있어도 opacity 0)').toBe('0');
  await pick(page, id);
  expect(await panel(page), '★다시 고르면 같은 값').toEqual({ hex: 'FF0000', alpha: '50' });
  expect(errs).toEqual([]);
});

test('L3 저장 → 다시 열기 — SVG 칠·패널 값 그대로', async ({ page }) => {
  const { errs, id } = await setup(page);
  await pick(page, id);
  await page.fill('#txt-color-hex', '00AA55'); await page.locator('#txt-color-hex').dispatchEvent('change');
  await expect.poll(() => svgFill(page, id)).toBe('rgb(0, 170, 85)');
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction((id) => !!document.querySelector(`#${id} svg.lnr-svg text`), id);
  expect(await svgFill(page, id)).toBe('rgb(0, 170, 85)');
  await pick(page, id);
  expect(await panel(page)).toEqual({ hex: '00AA55', alpha: '100' });
  expect(errs).toEqual([]);
});

test('L4 SVG 글자가 아직 없는 순간 — 미러 값으로 · 0% 로 안 보인다(100%)', async ({ page }) => {
  const { errs, id } = await setup(page);
  await page.evaluate((id) => { document.querySelector(`#${id} svg.lnr-svg text`).remove(); window.showTextProperties(document.getElementById(id)); }, id);
  expect(await panel(page), '인라인 색 없음 → 그리개 기본 111111 · 100').toEqual({ hex: '111111', alpha: '100' });
  await page.evaluate((id) => { const b = document.getElementById(id); b.querySelector('.tb-liner').style.color = 'rgb(0, 0, 255)'; b.querySelector('svg.lnr-svg text')?.remove(); window.showTextProperties(b); }, id);
  expect(await panel(page), '인라인 색 → 그 값').toEqual({ hex: '0000FF', alpha: '100' });
  expect(errs).toEqual([]);
});

test('L5 내보내기 — Figma JSON 의 liner svg 에 칠 · PNG 에 빨간 점 · png 남김', async ({ page }) => {
  const { errs, id } = await setup(page);
  await pick(page, id);
  await page.fill('#txt-color-hex', 'FF0000'); await page.locator('#txt-color-hex').dispatchEvent('change');
  await expect.poll(() => svgFill(page, id)).toBe('rgb(255, 0, 0)');
  const svg = await page.evaluate((id) => { let s = null; const w = (o) => { if (!o || typeof o !== 'object' || s) return; if (o.type === 'liner' && o.id === id) { s = o.svg; return; } Object.values(o).forEach(w); }; w(window.buildFigmaExportJSON(null)); return s; }, id);
  expect(svg, '★Figma liner = 그려진 SVG 그대로(칠 포함)').toMatch(/fill="(rgb\(255, 0, 0\)|#ff0000|red)"/i);
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => (await cdp.send('Page.captureScreenshot', {
    format: 'png', clip: { x, y, width, height, scale }, captureBeyondViewport: true, fromSurface: true })).data);
  await page.evaluate(() => { window.deselectAll?.(); window.electronAPI = new Proxy({}, { get: (t, k) => k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : (() => Promise.resolve(null)) }); });
  const b64 = await page.evaluate(async (id) => { const r = await window.exportSection(document.getElementById(id).closest('.section-block'), 'png', 860, { returnDataUrl: true });
    return (typeof r === 'string' ? r : (r.dataUrl || r.url)).split(',')[1]; }, id);
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'export-section.png'), Buffer.from(b64, 'base64'));
  const red = await page.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] < 60) n++; return n; }, b64);
  expect(red, '★PNG 에 빨간 글자').toBeGreaterThan(100);
  expect(errs).toEqual([]);
});

test('N1 지킴 — 일반 텍스트 블럭 Fill 표시는 그대로(computed 색 · alpha)', async ({ page }) => {
  const { errs } = await setup(page);
  const tid = await page.evaluate(() => { const sec = [...document.querySelectorAll('#canvas .section-block')].pop(); window.selectSection(sec); window.addTextBlock('h2');
    const b = [...sec.querySelectorAll('.text-block:not(.liner-block)')].pop(); b.id = 'nT'; b.querySelector('[class^="tb-"]').style.color = 'rgba(10, 20, 30, 0.4)'; window.deselectAll(); b.scrollIntoView({ block: 'center' }); return b.id; });
  await pick(page, tid);
  expect(await panel(page)).toEqual({ hex: '0A141E', alpha: '40' });
  expect(errs).toEqual([]);
});

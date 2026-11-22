/* gif-color-reveal.dom.spec.js — SLIDE-FX-COLOR-REVEAL-01(현빈 «0.9.14» · 2026-11-21 · 제니)
 *   이미지(에셋) 블럭 GIF 움직임 «컬러 리빌»(흑백 → 색) · 방향 = 왼→오 쓸기(기본) · 전체 동시 · 가운데서 번짐.
 * R1 에셋 패널 GIF 단추 → 목록 = 컬러 리빌 · 방향 칸 보임(기본 wipe) · 머무름 칸 · 글자/슬라이드/신호등 칸 숨김
 * R2 GIF 저장(와이프) — 오염 0 · ≤60 · 첫 프레임 흑백 · 가운데 = 왼쪽 컬러/오른쪽 흑백 · 끝 쪽 = 컬러 · png 3장
 * R3 방향 «전체 동시» 가운데 = 왼·오 같은 반쯤 채도 · «가운데서 번짐» 가운데 = 가운데 컬러/모서리 흑백
 * R4 저장 — 방향·머무름이 data-anim-reveal 에 · 저장 왕복 뒤 그대로 · 기본이면 키 없음
 * R5 그림 없는 에셋 = GIF 저장 막힘(글) · 글자 블럭 GIF 패널은 옛 목록 그대로(음성대조)
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/gif-color-reveal.dom.spec.js */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootApp } = require('./_root-harness.js');

const OUT = process.env.REVEAL_PNG_DIR || path.join(os.homedir(), 'gd-team-261121', 'jn-color-reveal-png');

async function scene(page, { image = true } = {}) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  /* grid-step.dom.spec 과 같은 길 — 바탕 그림 = PNG 내보내기 길(captureSectionCdp)을 진짜 CDP 로 잇는다 */
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => (await cdp.send('Page.captureScreenshot', {
    format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: scale > 0 && scale <= 4 ? scale : 1 },
    captureBeyondViewport: true, fromSurface: true })).data);
  await page.evaluate(() => { const real = window.electronAPI; window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : real[k]) }); });
  await page.evaluate(async (image) => {
    window.__admin = { state: () => ({ isAdmin: true }) };
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    window.addAssetBlock();
    const ab = c.querySelector('.asset-block'); ab.id = ab.id || 'rvA';
    if (image) {   // 색 띠 넷(빨·초·파·노) — 실제 넣기 길(setAssetImageFromSrc)
      const cv = document.createElement('canvas'); cv.width = 400; cv.height = 200; const x = cv.getContext('2d');
      ['#ff0000', '#00c000', '#0040ff', '#ffd000'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * 100, 0, 100, 200); });
      window.setAssetImageFromSrc(ab, cv.toDataURL('image/png'));
    }
    window.selectBlock(ab.id);
  }, image);
  if (image) await page.waitForFunction(() => document.querySelector('#canvas .asset-block').classList.contains('has-image'));
  return errs;
}
async function openReveal(page) {
  await expect(page.locator('#open-anim-btn'), '[전제] 에셋 패널 GIF 단추').toBeVisible();
  await page.click('#open-anim-btn');
  await expect(page.locator('#anim-gif-modal')).toBeVisible();
  await page.click('#anim-list .anim-item[data-id="color-reveal"]');
}
/** GIF 를 가짜로 받아 프레임마다 읽는다(진짜 gif.js copy:true 와 같은 getImageData) · 고른 프레임은 dataURL 로. */
async function captureGif(page) {
  await page.evaluate(() => {
    window.__gif = { frames: [], err: null, w: 0, h: 0, done: false };
    window.GIF = class {
      constructor(o) { this.o = o; window.__gif.w = o.width; window.__gif.h = o.height; }
      addFrame(ctx) {
        try { ctx.getImageData(0, 0, 1, 1); window.__gif.frames.push(ctx.canvas.toDataURL('image/png')); }
        catch (e) { window.__gif.err = String(e); throw e; }
      }
      on(ev, f) { if (ev === 'finished') this.fin = f; }
      render() { window.__gif.done = true; setTimeout(() => this.fin?.(new Blob(['GIF89a'], { type: 'image/gif' })), 0); }   /* 끝 신호 — 단추를 되살려 다음 저장이 눌리게 */
    };
  });
  await page.click('.anim-export-btn');
  await page.waitForFunction(() => window.__gif.done || window.__gif.err, null, { timeout: 30000 });
  return page.evaluate(() => ({ n: window.__gif.frames.length, err: window.__gif.err, w: window.__gif.w, h: window.__gif.h }));
}
/** 프레임 i 의 채도(max-min 평균 · 0~255) — 왼 1/5 · 가운데 1/5 · 오른 1/5 · 왼위 모서리. */
const satOf = (page, i) => page.evaluate(async (i) => {
  const img = new Image(); img.src = window.__gif.frames[i]; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const W = c.width, H = c.height;
  const reg = (x0, x1, y0, y1) => { const d = x.getImageData(Math.round(x0 * W), Math.round(y0 * H), Math.max(1, Math.round((x1 - x0) * W)), Math.max(1, Math.round((y1 - y0) * H))).data;
    let s = 0, n = 0; for (let k = 0; k < d.length; k += 4) { s += Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]); n++; } return Math.round(s / n); };
  return { L: reg(0.02, 0.2, 0.3, 0.7), C: reg(0.4, 0.6, 0.4, 0.6), R: reg(0.8, 0.98, 0.3, 0.7), TL: reg(0.01, 0.06, 0.03, 0.12) };
}, i);
const savePng = async (page, i, name) => { fs.mkdirSync(OUT, { recursive: true });
  const b64 = await page.evaluate((i) => window.__gif.frames[i].split(',')[1], i); fs.writeFileSync(path.join(OUT, name), Buffer.from(b64, 'base64')); };

test('R1 GIF 패널 = 컬러 리빌 · 방향(기본 왼→오) · 머무름 · 다른 종류 칸 숨김', async ({ page }) => {
  const errs = await scene(page);
  await expect(page.locator('#open-anim-btn')).toBeVisible();
  await page.click('#open-anim-btn');
  expect(await page.evaluate(() => [...document.querySelectorAll('#anim-list .anim-item')].map((e) => e.dataset.id))).toEqual(['color-reveal']);
  await expect(page.locator('#anim-reveal-row'), '방향 칸').toBeVisible();
  expect(await page.inputValue('#anim-reveal-mode'), '기본 = 왼→오 쓸기').toBe('wipe');
  await expect(page.locator('#anim-slide-dwell-row'), '머무름 칸').toBeVisible();
  for (const id of ['#anim-slide-row', '#anim-step-past-row', '#anim-stamp-s0-row', '#anim-per-line']) await expect(page.locator(id), `${id} 숨김`).toBeHidden();
  await expect(page.locator('#anim-loop-info')).toContainText('상한 60');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R2 ★GIF 저장(왼→오) — 오염 0 · ≤60 · 첫 흑백 · 가운데 왼 컬러/오른 흑백 · 끝 컬러 · png 3장', async ({ page }) => {
  const errs = await scene(page);
  await openReveal(page);
  const g = await captureGif(page);
  expect(g.err, '오염(SecurityError) 없음').toBeNull();
  expect(g.n, `프레임 수 ${g.n}`).toBeGreaterThan(10);
  expect(g.n).toBeLessThanOrEqual(60);
  const mid = Math.round(g.n / 2), end = Math.round(g.n * 0.9);
  const s0 = await satOf(page, 0), sm = await satOf(page, mid), se = await satOf(page, end);
  console.log(`[R2] 프레임 ${g.n}(${g.w}×${g.h}) · 첫 ${JSON.stringify(s0)} · 가운데 ${JSON.stringify(sm)} · 끝 ${JSON.stringify(se)}`);
  await savePng(page, 0, 'wipe-0-gray.png'); await savePng(page, mid, 'wipe-1-mid.png'); await savePng(page, end, 'wipe-2-color.png');
  expect(Math.max(s0.L, s0.C, s0.R), '★첫 프레임 = 흑백').toBeLessThan(12);
  expect(sm.L, '★가운데 — 왼쪽은 색이 찼다').toBeGreaterThan(150);
  expect(sm.R, '★가운데 — 오른쪽은 아직 흑백').toBeLessThan(12);
  expect(Math.min(se.L, se.C, se.R), '★끝 쪽 = 컬러').toBeGreaterThan(150);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R3 방향 — 전체 동시(가운데 = 왼·오 같은 반쯤) · 가운데서 번짐(가운데 컬러/모서리 흑백)', async ({ page }) => {
  const errs = await scene(page);
  await openReveal(page);
  await page.selectOption('#anim-reveal-mode', 'all');
  let g = await captureGif(page); let m = await satOf(page, Math.round(g.n / 2));
  console.log(`[R3] all 가운데 ${JSON.stringify(m)}`);
  await savePng(page, Math.round(g.n / 2), 'all-1-mid.png');
  expect(Math.abs(m.L - m.R), '전체 동시 — 왼·오 같은 정도').toBeLessThan(30);
  expect(m.L, '반쯤').toBeGreaterThan(40); expect(m.L).toBeLessThan(200);
  await page.selectOption('#anim-reveal-mode', 'radial');
  g = await captureGif(page); m = await satOf(page, Math.round(g.n / 2));
  console.log(`[R3] radial 가운데 ${JSON.stringify(m)}`);
  await savePng(page, Math.round(g.n / 2), 'radial-1-mid.png');
  expect(m.C, '번짐 — 가운데 컬러').toBeGreaterThan(150);
  expect(m.TL, '번짐 — 모서리 아직 흑백').toBeLessThan(12);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R4 저장 — 방향·머무름 data-anim-reveal · 저장 왕복 · 기본이면 키 없음', async ({ page }) => {
  const errs = await scene(page);
  await openReveal(page);
  const ab = () => page.evaluate(() => document.querySelector('#canvas .asset-block').dataset.animReveal ?? null);
  expect(await ab(), '기본 = 키 없음').toBeNull();
  await page.selectOption('#anim-reveal-mode', 'radial');
  expect(JSON.parse(await ab())).toEqual({ mode: 'radial' });
  const snap = await page.evaluate(() => { window.closeAnimModal(); return window.serializeProject(); });
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction(() => !!document.querySelector('#canvas .asset-block'));
  expect(JSON.parse(await ab()), '왕복').toEqual({ mode: 'radial' });
  expect(await page.evaluate(() => window.readRevealState(document.querySelector('#canvas .asset-block')).anim.mode)).toBe('radial');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R5 그림 없는 에셋 = GIF 저장 막힘 · 글자 블럭 GIF 목록은 옛 그대로', async ({ page }) => {
  const errs = await scene(page, { image: false });
  await page.click('#open-anim-btn');
  await expect(page.locator('#anim-gif-modal')).toBeVisible();
  await expect(page.locator('.anim-export-btn')).toHaveAttribute('aria-disabled', 'true');
  expect(await page.getAttribute('.anim-export-btn', 'title')).toContain('그림이 없어');
  await page.evaluate(() => { window.closeAnimModal(); const sec = document.querySelector('#canvas .section-block'); window.selectSection(sec); window.addTextBlock('h2');
    const tb = [...sec.querySelectorAll('.text-block')].pop(); tb.querySelector('[class^="tb-"]').textContent = '글자'; window.openAnimModal(tb); });
  const ids = await page.evaluate(() => [...document.querySelectorAll('#anim-list .anim-item')].map((e) => e.dataset.id));
  expect(ids, '글자 목록').toContain('typewriter');
  expect(ids).not.toContain('color-reveal');
  await expect(page.locator('#anim-reveal-row'), '방향 칸 숨김').toBeHidden();
  expect(errs, errs.join(' | ')).toEqual([]);
});

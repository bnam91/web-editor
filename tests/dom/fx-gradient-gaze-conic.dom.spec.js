/* fx-gradient-gaze-conic — FX-GRADIENT-GAZE-01 v2(현빈 261121 · 16종 · 원뿔형 · 지디 ⓒ): 색 고르기 «홀로그램» 16 + 종류 «Angular»
 * 고침: gradient-model(conic 파싱·직렬화) · color-picker(Angular · 16 프리셋 · 종류 실음) · fx/holo-palette GAZE_PRESETS(우리 색) ·
 *       shape-conic.js(도형 위 conic 덮개 · 도형 SVG 모양 mask · 저장엔 안 실고 watchAll·변화 때 다시) · prop-shape(SVG 아래 칠 = 투명 linear 대역) ·
 *       prop-section(원뿔형 허용) · export-figma-json(gradientModel) · figma-renderer(GRADIENT_ANGULAR)
 * ★전제 바뀜(현빈 261123 GradientGaze 재현): 원뿔형 프리셋 = 짝수 칸(gold=Holo 02 · pearl=Holo 04 …) — 옛 prism·opal 은 이제 Linear 라 Z2·Z3·Z5·Z6 는 gold·pearl 로 고름
 * Z1 프리셋 16(원뿔형 8) · 종류 선택지에 Angular — ★v3(261121): 프리셋은 Effects «홀로그램» 카드(색 고르기 안 줄 0) · Z2~Z7 은 카드로 고름
 * Z2 원(ellipse) 도형 — «prism»(원뿔형) 진짜 클릭 → shapeGradient conic · 덮개 = conic-gradient + mask · SVG 정지 투명 · PNG 가운데 색 여럿 · 모서리 = 바탕(모양 밖 안 칠함)
 * Z3 텍스트 — «opal»(원뿔형) → 글자 background-image conic · Figma JSON 글자 그라데이션 type conic
 * Z4 섹션 바탕 — 원뿔형 css → 그려짐(computed conic) · PNG 색 여럿 (Figma: 섹션 그라데이션은 종류와 무관하게 원래 한 색으로 감 = 옛 MESH-FIGMA 갭 · 이번 범위 밖)
 * Z5 저장 표본엔 덮개 0 · shapeGradient 있음 → 다시 열기(rebindAll) 덮개 다시 · 도형 크기 바꾸면 덮개 크기 따라감
 * Z6 Figma JSON 도형 gradientModel = conic(정지점·각) · linear 프리셋 도형엔 없음
 * Z7 원뿔형 캔버스 그라데이션 «원»: 고리 보임 · 시작각 손잡이가 고리 바로 밖(가운데에서 R×1.15 · offset 0 칩과 안 겹침) · 손잡이를 진짜로 3시 방향으로 끌면 angle ≈ 90 · 칩이 고리 둘레
 * 양성대조: _patches/gaze-conic-CTL.patch(conic 파싱 · 덮개 · gradientModel 걷음) → Z2~Z6 빨강 · Z1 초록 · _patches/gaze-ring-CTL.patch(원뿔형 원 그리기 걷음 = 옛 직선 바) → Z7 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
/* captureTruth(PNG 길)는 electronAPI.captureSectionCdp 로 찍는다 — 하네스 electronAPI 는 «모든 키가 함수»인 Proxy 라 그대로 두면 null → base64,null → ci.onerror(Event).
   CDP Page.captureScreenshot 으로 갈아 끼운다(slide-frame-cells wireCdp 꼴 · 지디 Electron 전수 261122 «page.evaluate: Event» 11건 = 이 배선 빠짐). */
async function wireCdp(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => (await cdp.send('Page.captureScreenshot', {
    format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: scale > 0 && scale <= 4 ? scale : 1 },
    captureBeyondViewport: true, fromSurface: true })).data);
  await page.evaluate(() => { const real = window.electronAPI; window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : real?.[k]) }); });
}

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function scene(page, kind) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page); await wireCdp(page);
  await page.evaluate(async (kind) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); window.applyZoom?.(100);
    const sec = c.querySelector('.section-block'); sec.id = 'sZ'; sec.style.backgroundColor = '#ffffff'; window.deselectAll(); window.selectSection(sec);
    if (kind === 'shape') { const before = new Set(sec.querySelectorAll('.shape-block')); window.addShapeBlock('ellipse'); const b = [...sec.querySelectorAll('.shape-block')].find((x) => !before.has(x)); b.id = 'shZ'; window.updateShapeBlock?.('shZ', { width: 240, height: 240 }); }
    else if (kind === 'text') { const before = new Set(sec.querySelectorAll('.text-block')); window.addTextBlock('h1'); const tb = [...sec.querySelectorAll('.text-block')].find((x) => !before.has(x)); tb.id = 'tbZ'; const e = tb.querySelector('[class^="tb-"]'); e.textContent = 'OPAL'; delete e.dataset.isPlaceholder; e.style.fontSize = '120px'; e.style.fontWeight = '900'; }
    window.clearHistory?.();
  }, kind);
  await waitZoomSettled(page, 100);
  return errs;
}
/* FX-GRADIENT-GAZE-01 v3(현빈 261121 «별도 이펙트»): 홀로그램 = 도형·글자 Effects 드롭다운 «홀로그램» 카드(프리셋 16 + 세기) — 색 고르기 안 프리셋 줄은 걷음 */
async function holo(page, kind, key) {
  const P = kind === 'shape' ? 'shape' : 'txt';
  await page.waitForFunction((P) => !!(document.getElementById(`${P}-fxholo-card`) || document.getElementById(`${P}-fx-add`)), P, { timeout: 5000 });
  if (!(await page.$(`#${P}-fxholo-card`))) { await page.locator(`#${P}-fx-add`).scrollIntoViewIfNeeded(); await page.selectOption(`#${P}-fx-add`, 'holo'); await raf(page); }
  await page.evaluate((P) => { const b = document.getElementById(`${P}-fxholo-body`); if (b && b.hidden) document.getElementById(`${P}-fxholo-head`).click(); }, P);
  const sw = page.locator(`#${P}-fxholo-sws [data-holo="${key}"]`); await sw.scrollIntoViewIfNeeded(); await sw.click(); await raf(page);
}
async function openPanel(page, kind) {
  const id = kind === 'shape' ? 'shZ' : 'tbZ', sw = kind === 'shape' ? '#shape-color-color' : '#txt-color';
  const xy = await page.evaluate((id) => { const e = document.getElementById(id); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  await page.mouse.click(xy[0], xy[1]); await raf(page);
  await page.evaluate(({ id, kind, sw }) => { if (!document.querySelector(sw)) (kind === 'shape' ? window.showShapeProperties : window.showTextProperties)?.(document.getElementById(id)); }, { id, kind, sw });
  await page.waitForFunction((s) => !!document.querySelector(s), sw, { timeout: 5000 });
}
async function openGradTab(page, kind) {
  const id = kind === 'shape' ? 'shZ' : 'tbZ', sw = kind === 'shape' ? '#shape-color-color' : '#txt-color';
  const xy = await page.evaluate((id) => { const e = document.getElementById(id); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  await page.mouse.click(xy[0], xy[1]); await raf(page);
  await page.evaluate(({ id, kind, sw }) => { if (!document.querySelector(sw)) (kind === 'shape' ? window.showShapeProperties : window.showTextProperties)?.(document.getElementById(id)); }, { id, kind, sw });
  await page.waitForFunction((s) => !!document.querySelector(s), sw, { timeout: 5000 });
  await page.locator(sw).scrollIntoViewIfNeeded(); await page.locator(sw).locator('xpath=..').click();
  await page.waitForFunction(() => !!document.querySelector('.goya-cp-popover'), null, { timeout: 5000 });
  await page.click('.goya-cp-tab[data-tab="gradient"]'); await raf(page);
}
const figJson = (page) => page.evaluate(async () => JSON.stringify(await window.buildFigmaExportJSON(['sZ'])));
const node = (json, id) => { let n = null; const w = (o) => { if (!o || typeof o !== 'object' || n) return; if (o.id === id) { n = o; return; } Object.values(o).forEach(w); }; w(JSON.parse(json)); return n; };

test('Z1 프리셋 16 · Angular', async ({ page }) => {
  const errs = await scene(page, 'shape');
  await openGradTab(page, 'shape');
  const r = await page.evaluate(() => ({ inPicker: document.querySelectorAll('.goya-cp-popover [data-holo]').length,
    types: [...document.querySelector('.goya-cp-popover [data-el="gradType"]').options].map((o) => o.value) }));
  await page.keyboard.press('Escape'); await raf(page);
  await holo(page, 'shape', 'gold');
  const c = await page.evaluate(() => ({ n: document.querySelectorAll('#shape-fxholo-sws [data-holo]').length, conic: document.querySelectorAll('#shape-fxholo-sws [data-holo-type="conic"]').length }));
  expect({ ...r, ...c }, '★카드 16 · 원뿔형 8 · 피커 프리셋 줄 0 · Angular').toEqual({ inPicker: 0, types: ['linear', 'radial', 'conic'], n: 16, conic: 8 });   // ★기대 바뀜(v3 261121 «별도 이펙트») · ★기대 바뀜(현빈 261123 GradientGaze 재현 — 원뿔형 8): 프리셋 16 = 색 고르기 → Effects «홀로그램» 카드
  expect(errs).toEqual([]);
});

test('Z2 원 도형 «gold»(원뿔형) → 덮개 · 모양 밖 안 칠함', async ({ page }) => {
  const errs = await scene(page, 'shape');
  await openPanel(page, 'shape');
  await holo(page, 'shape', 'gold');
  await page.mouse.click(5, 700); await raf(page);
  const st = await page.evaluate(() => { const b = document.getElementById('shZ'), ov = b.querySelector(':scope > .shape-conic-ov'); const g = JSON.parse(b.dataset.shapeGradient || 'null');
    return { type: g && g.type, ov: !!ov, bg: ov ? /conic-gradient/.test(ov.style.background) : false, mask: ov ? /data:image\/svg\+xml/.test(ov.style.maskImage || ov.style.webkitMaskImage) : false,
      stopsOp: [...b.querySelectorAll('svg linearGradient stop, svg radialGradient stop')].map((s) => s.getAttribute('stop-opacity')) }; });
  expect([st.type, st.ov, st.bg, st.mask, st.stopsOp.length > 0 && st.stopsOp.every((v) => Number(v) === 0)], `★원뿔형 덮개 ${JSON.stringify(st)}`).toEqual(['conic', true, true, true, true]);
  const px = await page.evaluate(async () => { const s = document.getElementById('sZ'); const r = await window.__exportGate.captureTruth(s, 860, window.__exportGate.sectionBgColor(s)); const x = r.canvas.getContext('2d');
    const sr = s.getBoundingClientRect(), b = document.getElementById('shZ').querySelector('svg').getBoundingClientRect(), k = 860 / sr.width;
    const L = (b.left - sr.left) * k, T = (b.top - sr.top) * k, W = b.width * k, H = b.height * k;
    const corner = [...x.getImageData(Math.round(L + 2), Math.round(T + 2), 1, 1).data].slice(0, 3);
    const d = x.getImageData(Math.round(L + W * 0.25), Math.round(T + H * 0.25), Math.round(W * 0.5), Math.round(H * 0.5)).data; const set = new Set();
    for (let i = 0; i < d.length; i += 4 * 9) set.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
    return { corner, hues: set.size }; });
  expect([px.corner, px.hues > 12], `★모서리 바탕 · 가운데 색 여럿 ${JSON.stringify(px)}`).toEqual([[255, 255, 255], true]);
  expect(errs).toEqual([]);
});

test('Z3 글자 «pearl» 원뿔형 · Figma', async ({ page }) => {
  const errs = await scene(page, 'text');
  await openPanel(page, 'text');
  await holo(page, 'text', 'pearl');
  const bg = await page.evaluate(() => document.querySelector('#tbZ [class^="tb-"]').style.backgroundImage);
  expect(/^conic-gradient\(/.test(bg), `★글자 conic ${bg.slice(0, 80)}`).toBe(true);   // ★기대 바뀜(v3 261121): 시작각 0 이면 브라우저가 «from 0deg at 50% 50%» 를 통째로 지운다(옛 판은 피커 지금 각도라 머리가 있었다)
  expect(await page.evaluate(() => { const g = window.getTextGradient?.(document.querySelector('#tbZ [class^="tb-"]')); return g && g.type; }), '★머리 없는 꼴도 다시 읽힘(conic)').toBe('conic');
  expect(/"type":"conic"/.test(await figJson(page)), '★Figma 글자 그라데이션 conic').toBe(true);
  expect(errs).toEqual([]);
});

test('Z4 섹션 바탕 원뿔형', async ({ page }) => {
  const errs = await scene(page, 'text');
  await page.evaluate(() => { const s = document.getElementById('sZ'); s.dataset.bg = 'conic-gradient(from 45deg at 50% 50%, #f4f0ff 0%, #cfe8ff 50%, #f4f0ff 100%)'; window.applySectionBg?.(s); });
  await raf(page);
  const r = await page.evaluate(async () => { const s = document.getElementById('sZ'); const cap = await window.__exportGate.captureTruth(s, 860, window.__exportGate.sectionBgColor(s)); const d = cap.canvas.getContext('2d').getImageData(0, 0, cap.canvas.width, cap.canvas.height).data; const set = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) set.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4)); return { css: getComputedStyle(s).backgroundImage, hues: set.size }; });
  expect([/conic-gradient/.test(r.css), r.hues > 6], `★섹션 conic ${r.css.slice(0, 60)} · PNG 색 ${r.hues}`).toEqual([true, true]);
  expect(errs).toEqual([]);
});

test('Z5 저장 표본엔 덮개 0 → 다시 열면 덮개 · 크기 따라감', async ({ page }) => {
  const errs = await scene(page, 'shape');
  await openPanel(page, 'shape');
  await holo(page, 'shape', 'slick'); await page.mouse.click(5, 700); await raf(page);
  const h = await page.evaluate(() => window.getSerializedCanvas());
  expect([/shape-conic-ov/.test(h), /data-shape-gradient="[^"]*conic/.test(h)], '★표본 = 덮개 0 · 모델 있음').toEqual([false, true]);
  await page.evaluate((h) => { document.getElementById('canvas').innerHTML = h; window.rebindAll?.(); }, h);
  await page.waitForFunction(() => !!document.querySelector('#shZ > .shape-conic-ov'), null, { timeout: 5000 }).catch(() => {});
  expect(await page.evaluate(() => !!document.querySelector('#shZ > .shape-conic-ov')), '★다시 열면 덮개').toBe(true);
  await page.evaluate(() => window.updateShapeBlock?.('shZ', { width: 320, height: 160 })); await raf(page); await raf(page);
  const sz = await page.evaluate(() => { const b = document.getElementById('shZ'), ov = b.querySelector(':scope > .shape-conic-ov').getBoundingClientRect(), sv = b.querySelector('svg').getBoundingClientRect(); return [Math.round(ov.width - sv.width), Math.round(ov.height - sv.height)]; });
  expect(sz, '★덮개 = SVG 상자(크기 따라감)').toEqual([0, 0]);
  expect(errs).toEqual([]);
});

test('Z6 Figma 도형 gradientModel', async ({ page }) => {
  const errs = await scene(page, 'shape');
  await openPanel(page, 'shape');
  await holo(page, 'shape', 'gold');
  const a = node(await figJson(page), 'shZ');
  expect([a?.gradientModel?.type, a?.gradientModel?.stops?.length], '★conic 모델').toEqual(['conic', 8]);   // ★기대 바뀜(현빈 261123 GradientGaze 재현 — gold = 플러그인 #2 Angular 정지점 8 · 옛 prism 7)
  await holo(page, 'shape', 'mist');
  const b = node(await figJson(page), 'shZ');
  expect(b?.gradientModel ?? null, '★linear 면 없음').toBe(null);
  expect(errs).toEqual([]);
});

test('Z7 원뿔형 캔버스 바 = 원(가운데 + 시작각 손잡이)', async ({ page }) => {
  const errs = await scene(page, 'shape');
  await openPanel(page, 'shape');
  await holo(page, 'shape', 'gold');
  await page.evaluate(() => window.showGradientLine?.(document.getElementById('shZ'))); await raf(page);
  const g0 = await page.evaluate(() => { const ring = document.querySelector('.grad-line-ring'), end = document.querySelector('.grad-line-finish'), st = document.querySelector('.grad-line-start');
    if (!ring || getComputedStyle(ring).display === 'none') return { ring: false };
    const rr = ring.getBoundingClientRect(), er = end.getBoundingClientRect(), sr = st.getBoundingClientRect(); const cx = rr.left + rr.width / 2, cy = rr.top + rr.height / 2, R = rr.width / 2;
    const chips = [...document.querySelectorAll('.grad-stop-chip')].map((c) => { const q = c.getBoundingClientRect(); return Math.hypot(q.left + q.width / 2 - cx, q.top + q.height / 2 - cy) / R; });
    return { ring: true, endOn: Math.abs(Math.hypot(er.left + er.width / 2 - cx, er.top + er.height / 2 - cy) / R - 1.15), endHit: document.elementFromPoint(er.left + er.width / 2, er.top + er.height / 2) === end, startAtC: Math.hypot(sr.left + sr.width / 2 - cx, sr.top + sr.height / 2 - cy), chips, e: [er.left + er.width / 2, er.top + er.height / 2], c: [cx, cy], R };
  });
  expect([g0.ring, g0.endOn < 0.05, g0.endHit, g0.startAtC < 2, g0.chips && g0.chips.every((k) => Math.abs(k - 1) < 0.08)], `★원 ${JSON.stringify(g0)}`).toEqual([true, true, true, true, true]);
  await page.mouse.move(g0.e[0], g0.e[1]); await page.mouse.down(); await page.mouse.move(g0.c[0] + g0.R, g0.c[1], { steps: 8 }); await page.mouse.up(); await raf(page);
  const a = await page.evaluate(() => JSON.parse(document.getElementById('shZ').dataset.shapeGradient).angle);
  expect(Math.abs(a - 90) <= 3, `★끌어서 시작각 ≈ 90 (${a})`).toBe(true);
  expect(errs).toEqual([]);
});

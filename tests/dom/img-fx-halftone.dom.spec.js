/* img-fx-halftone — IMG-FX-HALFTONE-01(현빈 261121 · 피그마 «Halftone» 결): 에셋(그림) Effects 드롭다운 «하프톤» → 점 크기·간격·각도·모양·색
 * 고침: js/fx/halftone.js(셈) · js/effects-halftone.js(명부 식구 · 구운 덮개 img.asset-halftone) · section-serialize(표본에서 덮개 뺌) ·
 *       image-handling ASSET_FX_DS_KEYS · export-figma-json(src = 구운 그림) · index.html 한 줄
 * H1 드롭다운 «하프톤» 진짜 고르기 → data-halftone · 덮개 생김 · 덮개 픽셀 = 점무늬(흰 바탕 칸 + 어두운 점 칸 둘 다 · 원본엔 흰 칸 없음)
 * H2 카드 «점 크기» 숫자 → 값·덮개 다시 구움(그림 바뀜) · 모양 «네모» · 눈 끔 = 덮개 없음 · 값 보존
 * H3 저장 표본엔 덮개 0 · data-halftone 있음 → 그 표본으로 다시 열면(rebindAll) 덮개 다시 생김 · 값 바꾼 뒤 undo 1번 = 옛 값 + 덮개 다시 구움
 * H4 내보내기 — PNG(captureTruth) 그 자리에 흰 바탕 칸 있음(원본 PNG 엔 없음) · HTML 에 덮개 img · Figma JSON 그 블럭 src = 덮개 그림
 * H5 [지킴] 블러(가림)를 같이 켜면 덮개 없음 · Figma 는 src null(가림이 이김)
 * 양성대조: _patches/halftone-CTL.patch(applyHalftone 이 굽지 않고 덮개만 치움) → H1~H4 빨강 · H5 초록.
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

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page); await wireCdp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); window.applyZoom?.(100);
    const sec = c.querySelector('.section-block'); sec.id = 'sH';
    /* 사진 대역 — 위 절반 가로 그라데이션(밝음→어두움) · 아래 절반 진한 빨강(흰 칸 없음) */
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300; const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 400, 0); g.addColorStop(0, '#dddddd'); g.addColorStop(1, '#222222'); x.fillStyle = g; x.fillRect(0, 0, 400, 150);
    x.fillStyle = '#aa2222'; x.fillRect(0, 150, 400, 150);
    const { row, block } = window.makeAssetBlock(); sec.querySelector('.section-inner').appendChild(row);
    window.bindBlock?.(block); window.rebindAll?.(); window.setAssetImageFromSrc(block, cv.toDataURL('image/png')); block.id = 'abH';
  });
  await waitZoomSettled(page, 100);
  await page.waitForFunction(() => { const i = document.querySelector('#abH .asset-img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
  await page.evaluate(() => window.clearHistory?.());
  return errs;
}
async function openPanel(page) {
  const xy = await page.evaluate(() => { const e = document.getElementById('abH'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(xy[0], xy[1]); await raf(page);
  await page.evaluate(() => { const ab = document.getElementById('abH'); if (!document.getElementById('asset-fx-add')) { window.selectBlock?.('abH'); window.showAssetProperties?.(ab); } });
  await page.waitForFunction(() => !!document.getElementById('asset-fx-add'), null, { timeout: 5000 });
}
async function addHalftone(page) {
  await openPanel(page);
  const opts = await page.evaluate(() => [...document.getElementById('asset-fx-add').options].map((o) => o.value));
  expect(opts, '[전제] 드롭다운에 «하프톤»').toContain('halftone');
  await page.selectOption('#asset-fx-add', 'halftone'); await raf(page);
  await page.waitForFunction(() => document.querySelector('#abH .asset-img-clip > img.asset-halftone')?.complete, null, { timeout: 5000 }).catch(() => {});
}
/* 그림 한 장(data URL 또는 img)에서 «거의 흰 칸»·«어두운 칸» 비율 — 위 절반만(그라데이션 자리) */
const inkOf = (page, how) => page.evaluate(async (how) => {
  let src, box = null;
  if (how === 'overlay') src = document.querySelector('#abH img.asset-halftone')?.src;
  else if (how === 'orig') src = document.querySelector('#abH img.asset-img')?.src;
  else { const s = document.getElementById('sH'); const r = await window.__exportGate.captureTruth(s, 860, window.__exportGate.sectionBgColor(s)); src = r.canvas.toDataURL('image/png');
    const sr = s.getBoundingClientRect(), ar = document.querySelector('#abH .asset-img-clip').getBoundingClientRect(), k = 860 / sr.width; box = [(ar.left - sr.left) * k, (ar.top - sr.top) * k, ar.width * k, ar.height * k]; }
  if (!src) return null;
  const im = new Image(); await new Promise((r) => { im.onload = r; im.src = src; });
  const [bx, by, bw, bh] = box || [0, 0, im.width, im.height];
  const c = document.createElement('canvas'); c.width = Math.round(bw); c.height = Math.round(bh / 2); const x = c.getContext('2d');
  x.drawImage(im, bx, by, bw, bh / 2, 0, 0, c.width, c.height);
  const d = x.getImageData(4, 4, c.width - 8, c.height - 8).data; let white = 0, dark = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { n++; const m = (d[i] + d[i + 1] + d[i + 2]) / 3; if (m > 245) white++; else if (m < 120) dark++; }
  return { white: +(white / n).toFixed(3), dark: +(dark / n).toFixed(3) };
}, how);

test('H1 드롭다운 «하프톤» → 덮개 · 점무늬 픽셀', async ({ page }) => {
  const errs = await scene(page);
  const orig = await inkOf(page, 'orig');
  expect(orig.white, `[전제] 원본 위 절반엔 흰 칸 없음 ${JSON.stringify(orig)}`).toBeLessThan(0.01);
  await addHalftone(page);
  const st = await page.evaluate(() => ({ ds: document.getElementById('abH').dataset.halftone || null, ov: !!document.querySelector('#abH .asset-img-clip > img.asset-halftone') }));
  expect(st.ov && !!st.ds, `★data-halftone·덮개 ${JSON.stringify(st)}`).toBe(true);
  const ht = await inkOf(page, 'overlay');
  expect(ht && ht.white > 0.2 && ht.dark > 0.02, `★점무늬 — 흰 바탕 칸과 어두운 점 칸 둘 다 ${JSON.stringify(ht)}`).toBe(true);
  expect(errs).toEqual([]);
});

test('H2 점 크기·모양 → 다시 구움 · 눈 끔 = 덮개 없음 · 값 보존', async ({ page }) => {
  const errs = await scene(page);
  await addHalftone(page);
  const src0 = await page.evaluate(() => document.querySelector('#abH img.asset-halftone')?.src);
  await page.evaluate(() => { const b = document.getElementById('asset-fxht-body'); if (b?.hidden) document.getElementById('asset-fxht-head').click(); });
  await page.fill('#asset-fxht-size-num', '20'); await page.press('#asset-fxht-size-num', 'Enter'); await raf(page);
  await page.selectOption('#asset-fxht-shape', 'square'); await raf(page);
  const a = await page.evaluate(() => ({ o: JSON.parse(document.getElementById('abH').dataset.halftone), src: document.querySelector('#abH img.asset-halftone')?.src }));
  expect([a.o.size, a.o.shape, !!a.src && a.src !== src0], `★값 20·네모 · 덮개 그림 바뀜`).toEqual([20, 'square', true]);
  await page.click('#asset-fxht-eye'); await raf(page);
  const b = await page.evaluate(() => ({ on: document.getElementById('abH').dataset.halftone || null, off: document.getElementById('abH').dataset.halftoneOff || null, ov: !!document.querySelector('#abH img.asset-halftone') }));
  expect([b.on, b.ov, b.off && JSON.parse(b.off).size], `★끔 = 덮개 없음 · 값 보존 ${JSON.stringify(b)}`).toEqual([null, false, 20]);
  expect(errs).toEqual([]);
});

test('H3 저장 표본엔 덮개 0 → 다시 열면 덮개 · undo 1번 = 옛 값', async ({ page }) => {
  const errs = await scene(page);
  await addHalftone(page);
  const r = await page.evaluate(() => { const h = window.getSerializedCanvas(); return { ov: /asset-halftone/.test(h.replace(/data-halftone/g, '')), ds: /data-halftone="/.test(h), h }; });
  expect([r.ov, r.ds], '★표본 = 덮개 0 · data-halftone 있음').toEqual([false, true]);
  await page.evaluate((h) => { document.getElementById('canvas').innerHTML = h; window.rebindAll?.(); }, r.h);
  await page.waitForFunction(() => !!document.querySelector('#abH img.asset-halftone'), null, { timeout: 5000 }).catch(() => {});
  expect(await page.evaluate(() => !!document.querySelector('#abH img.asset-halftone')), '★다시 열면 덮개 다시 구움').toBe(true);
  await page.evaluate(() => window.clearHistory?.());
  await page.evaluate(() => window.setFxHalftone(document.getElementById('abH'), { size: 14 })); await raf(page);
  await page.evaluate(() => window.undo()); await raf(page);
  const u = await page.evaluate(() => ({ o: JSON.parse(document.getElementById('abH').dataset.halftone || 'null'), ov: !!document.querySelector('#abH img.asset-halftone') }));
  expect([u.o && u.o.size, u.ov], `★undo = 옛 값(8) · 덮개 다시 ${JSON.stringify(u)}`).toEqual([8, true]);
  expect(errs).toEqual([]);
});

test('H4 PNG·HTML·Figma 에 하프톤', async ({ page }) => {
  const errs = await scene(page);
  const p0 = await inkOf(page, 'png');
  await addHalftone(page);
  const p1 = await inkOf(page, 'png');
  expect(p1.white > 0.2 && p0.white < 0.01, `★PNG 그 자리 흰 바탕 칸 ${JSON.stringify([p0, p1])}`).toBe(true);
  const out = await page.evaluate(async () => {
    let blob = null; const oc = URL.createObjectURL, ok = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function (x) { blob = x; return oc.call(URL, x); }; HTMLAnchorElement.prototype.click = function () { if (!this.download) return ok.call(this); };
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok; }
    const html = blob ? await blob.text() : '';
    const ov = document.querySelector('#abH img.asset-halftone').getAttribute('src');
    const j = await window.buildFigmaExportJSON(['sH']); let node = null; const walk = (o) => { if (!o || typeof o !== 'object' || node) return; if (o.id === 'abH') { node = o; return; } Object.values(o).forEach(walk); }; walk(j);
    return { html: /class="asset-halftone"/.test(html), figma: !!node && node.src === ov };
  });
  expect(out, '★HTML 에 덮개 · Figma src = 덮개 그림').toEqual({ html: true, figma: true });
  expect(errs).toEqual([]);
});

test('H5 [지킴] 블러(가림)와 겹치면 하프톤 안 그림 · Figma src null', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { const ab = document.getElementById('abH'); window.setFxHalftone(ab, { state: 'on' }); window.setFxBlur(ab, { state: 'on', v: 40 }); window.applyHalftone(ab); });
  await raf(page);
  const r = await page.evaluate(async () => { const j = await window.buildFigmaExportJSON(['sH']); let node = null; const walk = (o) => { if (!o || typeof o !== 'object' || node) return; if (o.id === 'abH') { node = o; return; } Object.values(o).forEach(walk); }; walk(j);
    return { ov: !!document.querySelector('#abH img.asset-halftone'), src: node ? node.src : 'none' }; });
  expect(r, '★가림이 이김').toEqual({ ov: false, src: null });
  expect(errs).toEqual([]);
});

test('H6 카드 «바탕»·«점 색» hex 칸 안 잘림(지디 261121)', async ({ page }) => {   // 고침: 색 칸을 제 줄로(모드 select 와 한 줄에 셋이면 잘렸다)
  const errs = await scene(page);
  await addHalftone(page);
  await page.evaluate(() => { const b = document.getElementById('asset-fxht-body'); if (b?.hidden) document.getElementById('asset-fxht-head').click(); });
  await page.selectOption('#asset-fxht-color-mode', 'solid'); await raf(page);
  await page.evaluate(() => { const b = document.getElementById('asset-fxht-body'); if (b?.hidden) document.getElementById('asset-fxht-head').click(); });
  const r = await page.evaluate(() => ['asset-fxht-bg-hex', 'asset-fxht-color-hex'].map((id) => {
    const e = document.getElementById(id), card = document.getElementById('asset-fxht-card');
    const q = e.getBoundingClientRect(), c = card.getBoundingClientRect();
    return { id, inside: q.right <= c.right && q.left >= c.left, fits: e.scrollWidth <= e.clientWidth, sw: e.scrollWidth, cw: e.clientWidth };   // 칸 글자가 넘치면 scrollWidth > clientWidth
  }));
  expect(r.map((x) => [x.inside, x.fits]), `★hex 칸 카드 안 · 글자 다 보임 ${JSON.stringify(r)}`).toEqual([[true, true], [true, true]]);
  expect(errs).toEqual([]);
});

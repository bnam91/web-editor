/* img-fx-decor-blur — IMG-FX-BLUR-01(현빈 261121 결정 ⓑ): 꾸밈 블러 «흐림» 새 식구 — 가림(옛 블러 · data-redact)과 따로
 * 고침: js/effects-decor-blur.js(식구) · image-redact.js writeImgFilter(합성에 흐림 몫 · 가림이 이김) · editor-layout.css 3σ 키우기 · effects-blur.js 이름 «가림» ·
 *       export-figma-json(원본 src + decorBlur) · figma-renderer(LAYER_BLUR) · image-handling ASSET_FX_DS_KEYS
 * D1 드롭다운 = «가림»·«흐림» 둘 · «흐림» 진짜 고르기 → data-decor-blur 8 · 그림 filter blur(8px) · 픽셀이 흐려짐(이웃 차 줄어듦)
 * D2 숫자 20 → blur(20px) · 눈 끔 → filter 없음 · 값 보존
 * D3 저장 표본 → 다시 열기(rebindAll) = blur 그대로 · 옛 저장본(data-redact)은 계속 «가림» 카드
 * D4 내보내기 — PNG 흐려짐(회색 덮개 아님) · HTML 에 원본 src + filter blur · Figma JSON = 원본 src + decorBlur 8
 * D5 [지킴] 가림과 흐림을 같이 켜면 가림이 이김 — filter = 가림 px · Figma src null · decorBlur 없음
 * 양성대조: _patches/decor-blur-CTL.patch(writeImgFilter 흐림 몫 줄 걷음) → D1·D2·D3·D4 빨강 · D5 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); window.applyZoom?.(100);
    const sec = c.querySelector('.section-block'); sec.id = 'sD';
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 180; const x = cv.getContext('2d');
    for (let i = 0; i < 240; i += 12) { x.fillStyle = '#0000ff'; x.fillRect(i, 0, 6, 180); x.fillStyle = '#ffff00'; x.fillRect(i + 6, 0, 6, 180); }
    const { row, block } = window.makeAssetBlock(); sec.querySelector('.section-inner').appendChild(row); window.bindBlock?.(block); window.rebindAll?.(); window.setAssetImageFromSrc(block, cv.toDataURL('image/png')); block.id = 'abD';
  });
  await waitZoomSettled(page, 100);
  await page.waitForFunction(() => document.querySelector('#abD .asset-img')?.complete, null, { timeout: 15000 });
  await page.evaluate(() => window.clearHistory?.());
  return errs;
}
async function openPanel(page) {
  const xy = await page.evaluate(() => { const e = document.getElementById('abD'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(xy[0], xy[1]); await raf(page);
  await page.evaluate(() => { if (!document.getElementById('asset-fx-add')) { window.selectBlock?.('abD'); window.showAssetProperties?.(document.getElementById('abD')); } });
  await page.waitForFunction(() => !!document.getElementById('asset-fx-add'), null, { timeout: 5000 });
}
const st = (page) => page.evaluate(() => { const ab = document.getElementById('abD'), img = ab.querySelector('.asset-img');
  return { on: ab.dataset.decorBlur || null, off: ab.dataset.decorBlurOff || null, redact: ab.dataset.redact || null, filter: getComputedStyle(img).filter }; });
/* 가로 이웃 차 평균 — 줄무늬 원본은 크고 흐리면 작다. how: 'live'(화면 그림 상자 캡처 대신 PNG 파이프라인) */
const sharpPng = (page) => page.evaluate(async () => {
  const s = document.getElementById('sD'); const r = await window.__exportGate.captureTruth(s, 860, window.__exportGate.sectionBgColor(s));
  const sr = s.getBoundingClientRect(), ar = document.querySelector('#abD .asset-img-clip').getBoundingClientRect(), k = 860 / sr.width;
  const x = r.canvas.getContext('2d'), L = Math.round((ar.left - sr.left) * k) + 10, T = Math.round((ar.top - sr.top) * k) + 10, w = Math.round(ar.width * k) - 20, h = Math.round(ar.height * k) - 20;
  const d = x.getImageData(L, T, w, h).data; let sum = 0, n = 0, gray = 0;
  for (let i = 4; i < d.length; i += 4) { if ((i / 4) % w) { sum += Math.abs(d[i] - d[i - 4]) + Math.abs(d[i + 2] - d[i - 2]); n++; } if (Math.abs(d[i] - 74) < 6 && Math.abs(d[i + 1] - 74) < 6 && Math.abs(d[i + 2] - 74) < 6) gray++; }
  return { sharp: +(sum / n).toFixed(2), gray: +(gray / (d.length / 4)).toFixed(3) };
});
const figNode = (page) => page.evaluate(async () => { const j = await window.buildFigmaExportJSON(['sD']); let node = null; const walk = (o) => { if (!o || typeof o !== 'object' || node) return; if (o.id === 'abD') { node = o; return; } Object.values(o).forEach(walk); }; walk(j);
  const orig = document.querySelector('#abD .asset-img').getAttribute('src'); return node ? { srcIsOrig: node.src === orig, srcNull: node.src === null, decorBlur: node.decorBlur ?? null } : null; });

test('D1 드롭다운 «가림»·«흐림» · 흐림 고르기 → blur(8px) · 픽셀 흐려짐', async ({ page }) => {
  const errs = await scene(page);
  const s0 = await sharpPng(page);
  await openPanel(page);
  const opts = await page.evaluate(() => [...document.getElementById('asset-fx-add').options].map((o) => [o.value, o.textContent.trim()]));
  expect(opts.filter(([v]) => v === 'blur' || v === 'decorblur'), '★이름 갈림').toEqual([['blur', '가림'], ['decorblur', '흐림']]);
  await page.selectOption('#asset-fx-add', 'decorblur'); await raf(page);
  const a = await st(page);
  expect([a.on, a.filter], `★data-decor-blur 8 · blur(8px) ${JSON.stringify(a)}`).toEqual(['8', 'blur(8px)']);
  const s1 = await sharpPng(page);
  expect(s1.sharp < s0.sharp * 0.75, `★흐려짐 25% 넘게(두 측정 견줌 · 그림이 4배 늘어 8px 로는 ~30%) ${JSON.stringify([s0, s1])}`).toBe(true);
  expect(errs).toEqual([]);
});

test('D2 숫자 20 → blur(20px) · 눈 끔 = filter 없음 · 값 보존', async ({ page }) => {
  const errs = await scene(page);
  await openPanel(page); await page.selectOption('#asset-fx-add', 'decorblur'); await raf(page);
  await page.evaluate(() => { const b = document.getElementById('asset-fxdb-body'); if (b?.hidden) document.getElementById('asset-fxdb-head').click(); });
  await page.fill('#asset-fxdb-num', '20'); await page.press('#asset-fxdb-num', 'Enter'); await raf(page);
  expect((await st(page)).filter, '★20px').toBe('blur(20px)');
  await page.click('#asset-fxdb-eye'); await raf(page);
  const b = await st(page);
  expect([b.on, b.off, b.filter], `★끔 ${JSON.stringify(b)}`).toEqual([null, '20', 'none']);
  expect(errs).toEqual([]);
});

test('D3 저장 → 다시 열기 = 흐림 그대로 · 옛 data-redact = 가림 카드', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => window.setFxDecorBlur(document.getElementById('abD'), { state: 'on', v: 12 }));
  const h = await page.evaluate(() => window.getSerializedCanvas());
  expect(/data-decor-blur="12"/.test(h), '[전제] 표본에 data-decor-blur').toBe(true);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.innerHTML = h; c.querySelectorAll('.asset-img').forEach((i) => { i.style.filter = ''; }); window.rebindAll?.(); }, h);
  await raf(page);
  expect((await st(page)).filter, '★다시 열면 합성이 흐림을 다시 씀').toBe('blur(12px)');
  await page.evaluate(() => { const ab = document.getElementById('abD'); window.setFxDecorBlur(ab, { state: 'none' }, { history: false }); ab.dataset.redact = '40'; window.rebindAll?.(); });
  await openPanel(page);
  const card = await page.evaluate(() => ({ type: document.querySelector('#asset-fxbl-card')?.dataset.fxType || null, title: document.querySelector('#asset-fxbl-card .prop-cell-card-title')?.textContent.trim() || null, decor: !!document.querySelector('[data-fx-type="decorblur"]') }));
  expect(card, '★옛 블러 = 가림 카드').toEqual({ type: 'blur', title: '가림', decor: false });
  expect(errs).toEqual([]);
});

test('D4 PNG 흐림 · HTML 원본+filter · Figma 원본+decorBlur', async ({ page }) => {
  const errs = await scene(page);
  const s0 = await sharpPng(page);
  await page.evaluate(() => window.setFxDecorBlur(document.getElementById('abD'), { state: 'on', v: 8 })); await raf(page);
  const s1 = await sharpPng(page);
  expect(s1.sharp < s0.sharp * 0.75 && s1.gray < 0.05, `★PNG 흐림 25% 넘게(회색 덮개 아님) ${JSON.stringify([s0, s1])}`).toBe(true);
  const html = await page.evaluate(async () => {
    let blob = null; const oc = URL.createObjectURL, ok = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function (x) { blob = x; return oc.call(URL, x); }; HTMLAnchorElement.prototype.click = function () { if (!this.download) return ok.call(this); };
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok; }
    const t = blob ? await blob.text() : ''; const m = /<img[^>]*class="[^"]*asset-img[^"]*"[^>]*>/.exec(t); return { tag: m ? m[0].replace(/src="[^"]{40,}"/, 'src="…"') : null, hasData: m ? /src="data:image\/png;base64,/.test(m[0]) : false };
  });
  expect([html.hasData, /blur\(8px\)/.test(html.tag || '')], `★HTML 원본 src + filter blur ${JSON.stringify(html)}`).toEqual([true, true]);
  expect(await figNode(page), '★Figma 원본 + decorBlur 8').toEqual({ srcIsOrig: true, srcNull: false, decorBlur: 8 });
  expect(errs).toEqual([]);
});

test('D5 [지킴] 가림+흐림 = 가림이 이김', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { const ab = document.getElementById('abD'); window.setFxDecorBlur(ab, { state: 'on', v: 20 }); window.setFxBlur(ab, { state: 'on', v: 40 }); });
  await raf(page);
  const a = await st(page);
  expect(a.filter, '★가림 8px(흐림 20 아님)').toBe('blur(8px)');
  expect(await figNode(page), '★Figma = 가림(src null · decorBlur 없음)').toEqual({ srcIsOrig: false, srcNull: true, decorBlur: null });
  expect(errs).toEqual([]);
});

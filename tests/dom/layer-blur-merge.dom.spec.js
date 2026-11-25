/* layer-blur-merge — 0.9.13 172 t13E-06 «Layer blur» 합침(현빈 22:43 GO · 지디 조건 · 탑 task-blur-impl.md B)
 * 가림(data-redact) + 흐림(data-decor-blur) = Effects ＋ 목록 한 항목 «Layer blur»(FigCraft props-effect.rs:33-41 Effect::TYPES 낱말)
 *   카드 = Uniform 줄(effects.rs:213-222 · Progressive 는 다음 물결) + ☑ «원본 숨김(내보낼 때 원본 빼기)» + Blur 값(px · :231-232)
 *   ★저장 키 새로 0: 체크 켬 = data-redact(세기 = px×5) · 끔 = data-decor-blur(px) · 둘 다 있으면 가림 이김(줄 하나 · 체크 켬)
 * L1 목록 = «Layer blur» 하나(옛 «가림»·«흐림» 항목 0) · 고르면 흐림 8px · 체크 끔
 * L2 옛 문서 셋(가림만 · 흐림만 · 둘 다) — 다시 열기 = 캔버스 바이트 무변 · 패널 = Layer blur 카드 하나(체크 켬/끔/켬)
 * L3 체크 바꿈 = 값 옮겨 씀(12px ↔ 세기 60) · ⌘Z 한 번에 되돌림 · 켬은 20px 에서 자름(REDACT_MAX_PX)
 * L4 내보내기: 원본 숨김 켬 = HTML src 걷힘·Figma src null+redact / 끔 = HTML 원본+filter·Figma 원본+decorBlur ·
 *    PNG native(CDP) 는 둘 다 «화면 그대로» 흐림(켬이어도 회색 아님 — 화면 흐림과 같은 픽셀이 원본 픽셀 대신 찍힌다)
 * L5 눈 = 값 보존 끔(둘 다 있으면 둘 다) · × = 두 키 다 지움 · 읽기·MCP 길(window.setFxBlur/setFxDecorBlur/fxBlurOf/fxDecorBlurOf) 그대로
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

async function wireCdp(page) {   // img-fx-decor-blur 와 같은 배선(captureTruth = native CDP 길)
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
    const sec = c.querySelector('.section-block'); sec.id = 'sL';
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 180; const x = cv.getContext('2d');
    for (let i = 0; i < 240; i += 12) { x.fillStyle = '#0000ff'; x.fillRect(i, 0, 6, 180); x.fillStyle = '#ffff00'; x.fillRect(i + 6, 0, 6, 180); }
    const { row, block } = window.makeAssetBlock(); sec.querySelector('.section-inner').appendChild(row); window.bindBlock?.(block); window.rebindAll?.(); window.setAssetImageFromSrc(block, cv.toDataURL('image/png')); block.id = 'abL';
  });
  await waitZoomSettled(page, 100);
  await page.waitForFunction(() => document.querySelector('#abL .asset-img')?.complete, null, { timeout: 15000 });
  await page.evaluate(() => window.clearHistory?.());
  return errs;
}
async function openPanel(page) {
  await page.evaluate(() => { window.selectBlock?.('abL'); window.showAssetProperties?.(document.getElementById('abL')); });
  await page.waitForFunction(() => !!document.getElementById('asset-fx-section'), null, { timeout: 5000 });
  await raf(page);
}
const st = (page) => page.evaluate(() => { const ab = document.getElementById('abL'), img = ab.querySelector('.asset-img'), d = ab.dataset;
  return { redact: d.redact ?? null, redactOff: d.redactOff ?? null, decor: d.decorBlur ?? null, decorOff: d.decorBlurOff ?? null, filter: getComputedStyle(img).filter }; });
const card = (page) => page.evaluate(() => {
  const cards = [...document.querySelectorAll('#asset-fx-list .prop-cell-card')].map((c) => c.dataset.fxType);
  const hide = document.getElementById('asset-fxlb-hide'), num = document.getElementById('asset-fxlb-num');
  return { cards, title: document.querySelector('#asset-fxlb-card .prop-cell-card-title')?.textContent.trim() ?? null, hide: hide ? hide.checked : null, num: num ? num.value : null,
    type: document.getElementById('asset-fxlb-type')?.value ?? null };
});
const figNode = (page) => page.evaluate(async () => { const j = await window.buildFigmaExportJSON(['sL']); let node = null; const walk = (o) => { if (!o || typeof o !== 'object' || node) return; if (o.id === 'abL') { node = o; return; } Object.values(o).forEach(walk); }; walk(j);
  const orig = document.querySelector('#abL .asset-img').getAttribute('src'); return node ? { srcIsOrig: node.src === orig, srcNull: node.src === null, redact: !!node.redact, decorBlur: node.decorBlur ?? null } : null; });
const htmlOut = (page) => page.evaluate(async () => {
  let blob = null; const oc = URL.createObjectURL, ok = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = function (x) { blob = x; return oc.call(URL, x); }; HTMLAnchorElement.prototype.click = function () { if (!this.download) return ok.call(this); };
  try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok; }
  const t = blob ? await blob.text() : ''; const m = /<img[^>]*class="[^"]*asset-img[^"]*"[^>]*>/.exec(t);
  return { hasData: m ? /src="data:image\/png;base64,/.test(m[0]) : false, blur: m ? /blur\(\d+(\.\d+)?px\)/.test(m[0]) : false, anyPng: /data:image\/png;base64,iVBOR/.test(t) };
});
const png = (page) => page.evaluate(async () => {
  const s = document.getElementById('sL'); const r = await window.__exportGate.captureTruth(s, 860, window.__exportGate.sectionBgColor(s));
  const sr = s.getBoundingClientRect(), ar = document.querySelector('#abL .asset-img-clip').getBoundingClientRect(), k = 860 / sr.width;
  const x = r.canvas.getContext('2d'), L = Math.round((ar.left - sr.left) * k) + 10, T = Math.round((ar.top - sr.top) * k) + 10, w = Math.round(ar.width * k) - 20, h = Math.round(ar.height * k) - 20;
  const d = x.getImageData(L, T, w, h).data; let mx = 0, gray = 0;
  for (let i = 4; i < d.length; i += 4) { if ((i / 4) % w) { const g = Math.abs(d[i] - d[i - 4]) + Math.abs(d[i + 2] - d[i - 2]); if (g > mx) mx = g; } if (Math.abs(d[i] - 74) < 6 && Math.abs(d[i + 1] - 74) < 6 && Math.abs(d[i + 2] - 74) < 6) gray++; }
  return { edge: mx, gray: +(gray / (d.length / 4)).toFixed(3), native: !!r.native };
});

test('L1 ＋ 목록 = «Layer blur» 하나 · 고르면 흐림 8px · 체크 끔', async ({ page }) => {
  const errs = await scene(page);
  await openPanel(page);
  const opts = await page.evaluate(() => [...document.getElementById('asset-fx-add').options].map((o) => [o.value, o.textContent.trim()]));
  expect(opts.filter(([v]) => ['blur', 'decorblur', 'layerblur'].includes(v)), '★목록 한 항목 «Layer blur»(옛 가림·흐림 0)').toEqual([['layerblur', 'Layer blur']]);
  await page.selectOption('#asset-fx-add', 'layerblur'); await raf(page);
  expect(await st(page)).toEqual({ redact: null, redactOff: null, decor: '8', decorOff: null, filter: 'blur(8px)' });
  expect(await card(page)).toEqual({ cards: ['layerblur'], title: 'Layer blur', hide: false, num: '8', type: 'uniform' });
  expect(errs).toEqual([]);
});

test('L2 옛 문서 셋 — 다시 열기 = 바이트 무변 · 패널 = Layer blur 카드 하나(체크 켬/끔/켬)', async ({ page }) => {
  const errs = await scene(page);
  const cases = [['가림만', (ab) => window.setFxBlur(ab, { state: 'on', v: 37 }, { history: false }), true, '7.4'],
    ['흐림만', (ab) => window.setFxDecorBlur(ab, { state: 'on', v: 12 }, { history: false }), false, '12'],
    ['둘 다', (ab) => { window.setFxDecorBlur(ab, { state: 'on', v: 12 }, { history: false }); window.setFxBlur(ab, { state: 'on', v: 37 }, { history: false }); }, true, '7.4']];
  for (const [name, , hide, num] of cases) {
    const i = cases.findIndex((c) => c[0] === name);
    const h = await page.evaluate((src) => { const ab = document.getElementById('abL'); window.setFxBlur(ab, { state: 'none' }, { history: false }); window.setFxDecorBlur(ab, { state: 'none' }, { history: false }); (0, eval)(src)(ab); return window.getSerializedCanvas(); }, cases[i][1].toString());
    const h2 = await page.evaluate((h) => { const c = document.getElementById('canvas'); c.innerHTML = h; window.rebindAll?.(); return window.getSerializedCanvas(); }, h);
    expect(h2 === h, `★${name}: 다시 열기 = 캔버스 직렬화 바이트 무변`).toBe(true);
    await openPanel(page);
    const c = await card(page);
    expect([c.cards, c.hide, c.num], `★${name}: Layer blur 카드 하나 · 체크 ${hide} · 값 ${num}px ${JSON.stringify(c)}`).toEqual([['layerblur'], hide, num]);
    expect(await page.evaluate(() => window.getSerializedCanvas()) === h, `★${name}: 패널을 열어도 바이트 무변`).toBe(true);
  }
  expect(errs).toEqual([]);
});

test('L3 체크 바꿈 = 값 옮겨 씀 · ⌘Z 한 번 · 켬 20px 자름', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => window.setFxDecorBlur(document.getElementById('abL'), { state: 'on', v: 12 }, { history: false }));
  await page.evaluate(() => window.pushHistory?.('표본'));
  await openPanel(page);
  await page.click('#asset-fxlb-hide'); await raf(page);
  expect(await st(page), '★켬 = 가림 세기 60(12px×5) · 흐림 키 0').toEqual({ redact: '60', redactOff: null, decor: null, decorOff: null, filter: 'blur(12px)' });
  expect((await card(page)).hide).toBe(true);
  await page.evaluate(() => window.undo()); await raf(page);
  expect(await st(page), '★⌘Z 한 번 = 흐림 12 로').toEqual({ redact: null, redactOff: null, decor: '12', decorOff: null, filter: 'blur(12px)' });
  await page.evaluate(() => { const ab = document.getElementById('abL'); window.setFxDecorBlur(ab, { state: 'on', v: 30 }, { history: false }); });
  await openPanel(page);
  await page.click('#asset-fxlb-hide'); await raf(page);
  expect(await st(page), '★30px 켬 = 20px(세기 100) 에서 자름').toEqual({ redact: '100', redactOff: null, decor: null, decorOff: null, filter: 'blur(20px)' });
  await page.click('#asset-fxlb-hide'); await raf(page);
  expect(await st(page), '★끔 = 흐림 20px 로 옮김').toEqual({ redact: null, redactOff: null, decor: '20', decorOff: null, filter: 'blur(20px)' });
  expect(errs).toEqual([]);
});

test('L4 내보내기 — 원본 숨김 켬 = 원본 0 · 끔 = 원본 그대로', async ({ page }) => {
  const errs = await scene(page);
  await openPanel(page); await page.selectOption('#asset-fx-add', 'layerblur'); await raf(page);
  const offP = await png(page), offH = await htmlOut(page), offF = await figNode(page);
  await page.click('#asset-fxlb-hide'); await raf(page);
  const onP = await png(page), onH = await htmlOut(page), onF = await figNode(page);
  console.log(`[L4 실측] ${JSON.stringify({ offP, onP, offH, onH, offF, onF })}`);
  expect([offH.hasData, offH.blur], '★끔 HTML = 원본 src + filter blur').toEqual([true, true]);
  expect(offF, '★끔 Figma = 원본 + decorBlur 8 (렌더러 LAYER_BLUR 갈래 · sangpe_to_figma.mjs block.decorBlur)').toEqual({ srcIsOrig: true, srcNull: false, redact: false, decorBlur: 8 });
  expect([onH.hasData, onH.anyPng], '★켬 HTML = 원본 src 걷힘(파일에 원본 PNG 0)').toEqual([false, false]);
  expect(onF, '★켬 Figma = src null + redact 덮개 (렌더러 set_fill_color 갈래 · block.redact)').toEqual({ srcIsOrig: false, srcNull: true, redact: true, decorBlur: null });
  /* PNG native(CDP) = 화면 그대로 — 켬이어도 회색 덮개가 아니라 화면 흐림과 같은 픽셀(원본 픽셀은 8px 흐림 뒤 것만) */
  expect([offP.native, onP.native, offP.gray < 0.05, onP.gray < 0.05], '★PNG native 둘 다 화면 그대로(회색 아님)').toEqual([true, true, true, true]);
  expect(Math.abs(onP.edge - offP.edge) <= 4, `★PNG 켬 = 끔과 같은 흐림 ${JSON.stringify([offP, onP])}`).toBe(true);
  expect(errs).toEqual([]);
});

test('L5 눈 = 값 보존 끔 · × = 두 키 다 지움 · 읽기·MCP 전역 그대로', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { const ab = document.getElementById('abL'); window.setFxDecorBlur(ab, { state: 'on', v: 12 }, { history: false }); window.setFxBlur(ab, { state: 'on', v: 40 }, { history: false }); });
  await openPanel(page);
  await page.click('#asset-fxlb-eye'); await raf(page);
  expect(await st(page), '★둘 다 → 눈 = 둘 다 값 보존 끔(줄 하나 = 그림 흐림 0)').toEqual({ redact: null, redactOff: '40', decor: null, decorOff: '12', filter: 'none' });
  expect([(await card(page)).cards, (await card(page)).hide], '★끈 둘 = 여전히 카드 하나 · 체크 켬').toEqual([['layerblur'], true]);
  await page.click('#asset-fxlb-eye'); await raf(page);
  expect(await st(page), '★다시 눈 = 둘 다 켬 · 가림 이김').toEqual({ redact: '40', redactOff: null, decor: '12', decorOff: null, filter: 'blur(8px)' });
  await page.click('#asset-fxlb-del'); await raf(page);
  expect(await st(page), '★× = 네 키 다 지움').toEqual({ redact: null, redactOff: null, decor: null, decorOff: null, filter: 'none' });
  expect(await page.evaluate(() => ['setFxBlur', 'setFxDecorBlur', 'fxBlurOf', 'fxDecorBlurOf', 'applyImageRedact', 'readImageRedact'].filter((k) => typeof window[k] !== 'function')), '★읽기·MCP 전역 그대로').toEqual([]);
  expect(errs).toEqual([]);
});

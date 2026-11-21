/* halftone-goya-asset — 미카사 채점 261121 ①: 실제 사진(goya-asset://)엔 하프톤 망점 0(캔버스 오염) · data:URL 픽스처는 거짓 초록이었다.
 * 장면(오염 재현): 그림 바이트를 «다른 출처»(https://cross.test · crossOrigin 없음)에서 받아 캔버스를 실제로 오염시키고, 그 img 의 currentSrc = goya-asset:// 주소
 *   (앱에서 goya-asset 이 file:// 에 cross-origin 인 것과 같은 오염 · 이 하네스 chromium 은 goya-asset 스킴을 못 띄운다).
 *   가짜는 electronAPI.assetsReadAsDataUri 하나 — 같은 그림의 data URL(main 'assets:readAsDataUri' 약속).
 * G1 goya-asset 그림 + 하프톤 → 덮개가 구워진다(점 있음) · IPC 가 그 주소의 projectId·filename 으로 불렸다 · «오염» 경고 0
 * G2 가림(Redact) 켜면 덮개 치움 · 끄면 다시 구움(손으로 applyHalftone 안 부름 — 미카사 «가림 켜도 덮개가 남고 지우면 안 돌아옴»)
 * 양성대조(실측): _patches/halftone-goya-CTL.patch(굽기 drawImage 를 살아 있는 img 로 되돌림) → G1·G2 빨강 · halftone-redact-rebake-CTL.patch(가림 길의 다시 굽기 걷음) → G2 빨강.
 * 셀렉터·전역 대조(제품 소스 grep): makeAssetBlock · setAssetImageFromSrc · setFxHalftone · setFxBlur(effects-blur.js) · img.asset-halftone(effects-halftone.js)
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const GOYA = 'goya-asset://proj_ht/abc123.png';
async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  const png = await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300; const x = cv.getContext('2d');
    for (let yy = 0; yy < 300; yy += 10) for (let xx = 0; xx < 400; xx += 10) { x.fillStyle = ((xx + yy) / 10) % 2 ? '#111111' : '#dddddd'; x.fillRect(xx, yy, 10, 10); }
    return cv.toDataURL('image/png'); });
  await page.route('https://cross.test/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(png.split(',')[1], 'base64') }));
  const warns = [];
  page.on('console', (m) => { if (/halftone/.test(m.text())) warns.push(m.text()); });
  await page.evaluate(async ({ png, GOYA }) => {
    window.__reads = [];
    const real = window.electronAPI;
    window.electronAPI = new Proxy(real || {}, { get: (t, k) => (k === 'assetsReadAsDataUri' ? async (a) => { window.__reads.push(a); return { ok: true, dataUri: png }; } : t[k]) });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); window.applyZoom?.(100);
    const sec = c.querySelector('.section-block');
    const { row, block } = window.makeAssetBlock(); sec.querySelector('.section-inner').appendChild(row);
    window.bindBlock?.(block); window.rebindAll?.(); window.setAssetImageFromSrc(block, png); block.id = 'abG';
    const img = block.querySelector('.asset-img');
    Object.defineProperty(img, 'currentSrc', { get: () => GOYA });   // 앱의 goya-asset 그림
    img.src = 'https://cross.test/abc123.png';                          // 바이트는 다른 출처 = 캔버스 오염(앱과 같은 까닭)
  }, { png, GOYA });
  await waitZoomSettled(page, 100);
  await page.waitForFunction(() => { const i = document.querySelector('#abG .asset-img'); return i && i.complete && i.naturalWidth > 0 && /cross\.test/.test(i.src); }, null, { timeout: 15000 });
  const tainted = await page.evaluate(() => { const i = document.querySelector('#abG .asset-img'), cv = document.createElement('canvas'); cv.width = 4; cv.height = 4; const x = cv.getContext('2d'); x.drawImage(i, 0, 0, 4, 4); try { x.getImageData(0, 0, 1, 1); return false; } catch (_) { return true; } });
  expect(tainted, '[전제] 살아 있는 그림을 그리면 캔버스가 오염된다(앱의 goya-asset 과 같은 꼴)').toBe(true);
  return { errs, warns };
}
const dark = (page) => page.evaluate(async () => {
  const ov = document.querySelector('#abG img.asset-halftone'); if (!ov || !ov.complete) return null;
  const im = new Image(); await new Promise((r) => { im.onload = r; im.src = ov.src; });
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, im.width, im.height).data; let k = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 80) k++; return +(k / (d.length / 4)).toFixed(3);
});

test('G1 goya-asset 그림에도 망점이 구워진다(IPC 판 픽셀)', async ({ page }) => {
  const { errs, warns } = await scene(page);
  await page.evaluate(() => window.setFxHalftone(document.getElementById('abG'), { bg: 'white', color: '#000000' }));
  await page.waitForFunction(() => document.querySelector('#abG img.asset-halftone')?.complete, null, { timeout: 8000 }).catch(() => {});
  const d = await dark(page);
  expect(d !== null && d > 0.02, `★덮개·점 있음(어두운 칸 비 ${d})`).toBe(true);
  expect(await page.evaluate(() => window.__reads), '★IPC 가 그 주소로').toEqual([{ projectId: 'proj_ht', filename: 'abc123.png' }]);
  expect(warns.filter((w) => /오염|못 읽음/.test(w)), '오염 경고 0').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G2 가림 켜면 덮개 치움 · 끄면 다시 구움', async ({ page }) => {
  const { errs } = await scene(page);
  await page.evaluate(() => window.setFxHalftone(document.getElementById('abG'), {}));
  await page.waitForFunction(() => document.querySelector('#abG img.asset-halftone')?.complete, null, { timeout: 8000 });
  await page.evaluate(() => window.setFxBlur(document.getElementById('abG'), { state: 'on' }));
  expect(await page.evaluate(() => [!!document.getElementById('abG').dataset.redact, !!document.querySelector('#abG img.asset-halftone')]), '★가림 켬 → 덮개 없음').toEqual([true, false]);
  await page.evaluate(() => window.setFxBlur(document.getElementById('abG'), { state: 'none' }));
  await page.waitForFunction(() => document.querySelector('#abG img.asset-halftone')?.complete, null, { timeout: 8000 }).catch(() => {});
  expect(await page.evaluate(() => [!!document.getElementById('abG').dataset.redact, !!document.querySelector('#abG img.asset-halftone')]), '★가림 끔 → 덮개 다시').toEqual([false, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

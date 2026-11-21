/* halftone-decor-blur — 하프톤 + 흐림(꾸밈 블러) 같은 그림에 둘 다(지디 261121 «두 쪽 다 산다» · 열차 train/1121-fx)
 * 고침: js/effects-halftone.js applyHalftone — 원본을 굽기 캔버스에 그릴 때 ctx.filter = blur(흐림 px) ⇒ «흐린 사진을 망점화» · sig 에 흐림 값
 *       js/effects-decor-blur.js setFxDecorBlur — 바꾸면 window.applyHalftone(el) 로 다시 굽기
 * D1 흐림 0 → 12: 덮개 다시 구움(src 바뀜) · 덮개 밝기 표준편차가 준다(흐린 사진) · 흐림 끄면 다시 원래 표준편차 쪽
 * D2 [지킴] 가림(Redact)을 켜면 덮개 없음(가림 우선 · 옛 동작)
 * D3 [실측만] 투명 PNG(왼쪽 절반 투명) + 바탕 «원본 사진» + 흐림 12 — 투명 자리 경계 옆 띠에 무엇이 비치는지 숫자로 남김(단언 없음)
 * 양성대조: _patches/halftone-blur-CTL.patch(굽기의 ctx.filter 줄을 걷음) → D1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, { transparentLeft = false } = {}) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (tl) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); window.applyZoom?.(100);
    const sec = c.querySelector('.section-block'); sec.id = 'sB';
    /* 사진 대역 — 8px 바둑판(흑백 · 고주파) · tl 이면 왼쪽 절반은 투명 */
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300; const x = cv.getContext('2d');
    for (let yy = 0; yy < 300; yy += 8) for (let xx = tl ? 200 : 0; xx < 400; xx += 8) { x.fillStyle = ((xx + yy) / 8) % 2 ? '#111111' : '#eeeeee'; x.fillRect(xx, yy, 8, 8); }
    const { row, block } = window.makeAssetBlock(); sec.querySelector('.section-inner').appendChild(row);
    window.bindBlock?.(block); window.rebindAll?.(); window.setAssetImageFromSrc(block, cv.toDataURL('image/png')); block.id = 'abB';
  }, transparentLeft);
  await waitZoomSettled(page, 100);
  await page.waitForFunction(() => { const i = document.querySelector('#abB .asset-img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
  await page.evaluate(() => window.clearHistory?.());
  return errs;
}
const ovSrc = (page) => page.evaluate(() => document.querySelector('#abB .asset-img-clip > img.asset-halftone')?.getAttribute('src') || null);
async function waitOvChange(page, before) {
  await page.waitForFunction((b) => { const o = document.querySelector('#abB img.asset-halftone'); return o && o.getAttribute('src') !== b && o.complete; }, before, { timeout: 5000 }).catch(() => {});
  await raf(page);
}
/* 덮개 그림 밝기 표준편차(가장자리 16px 뺀 안쪽 — 흐림의 가장자리 번짐을 빼고 «사진 몫»만) */
const ovStd = (page) => page.evaluate(async () => {
  const src = document.querySelector('#abB img.asset-halftone')?.src; if (!src) return null;
  const im = new Image(); await new Promise((r) => { im.onload = r; im.src = src; });
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const m = 32, d = x.getImageData(m, m, im.width - 2 * m, im.height - 2 * m).data; let s = 0, s2 = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; n++; }
  const mean = s / n; return +Math.sqrt(Math.max(0, s2 / n - mean * mean)).toFixed(2);
});

test('D1 흐림 0 → 12 → 끔: 하프톤 덮개가 흐린 사진으로 다시 구워진다', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => window.setFxHalftone(document.getElementById('abB'), { bg: 'none', color: 'image' }));
  await page.waitForFunction(() => document.querySelector('#abB img.asset-halftone')?.complete, null, { timeout: 5000 });
  const s0 = await ovSrc(page), sd0 = await ovStd(page);
  expect(!!s0 && sd0 > 0, `[전제] 덮개 · 바둑판이라 표준편차 큼 ${sd0}`).toBe(true);
  await page.evaluate(() => window.setFxDecorBlur(document.getElementById('abB'), { state: 'on', v: 12 }));
  await waitOvChange(page, s0);
  const s12 = await ovSrc(page), sd12 = await ovStd(page);
  const st = await page.evaluate(() => ({ db: document.getElementById('abB').dataset.decorBlur || null, f: document.querySelector('#abB .asset-img').style.filter }));
  expect([st.db, /blur\(/.test(st.f), !!s12 && s12 !== s0], `★흐림 켜짐 · 원본 filter · 덮개 다시 구움 ${JSON.stringify(st)}`).toEqual(['12', true, true]);
  expect(sd12 < sd0 * 0.7, `★흐린 사진을 망점화 — 표준편차 ${sd0} → ${sd12}`).toBe(true);
  await page.evaluate(() => window.setFxDecorBlur(document.getElementById('abB'), { state: 'none' }));
  await waitOvChange(page, s12);
  const sdOff = await ovStd(page);
  expect(sdOff > sd12, `★흐림 끄면 다시 선명한 쪽 ${sd12} → ${sdOff}`).toBe(true);
  expect(errs).toEqual([]);
});

test('D2 [지킴] 가림을 켜면 하프톤 덮개 없음(가림 우선)', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { const b = document.getElementById('abB'); window.setFxHalftone(b, {}); window.setFxDecorBlur(b, { state: 'on', v: 12 }); });
  await page.waitForFunction(() => document.querySelector('#abB img.asset-halftone')?.complete, null, { timeout: 5000 });
  await page.evaluate(() => { const b = document.getElementById('abB'); window.setFxBlur(b, { state: 'on' }); window.applyHalftone(b); });
  await raf(page);
  const r = await page.evaluate(() => ({ redact: document.getElementById('abB').dataset.redact || null, ov: !!document.querySelector('#abB img.asset-halftone') }));
  expect([!!r.redact, r.ov], `★가림 켬 → 덮개 없음 ${JSON.stringify(r)}`).toEqual([true, false]);
  expect(errs).toEqual([]);
});

test('D3 [실측만] 투명 PNG + 바탕 «원본 사진» + 흐림 12 — 투명 자리에 비치는 것', async ({ page }) => {
  const errs = await scene(page, { transparentLeft: true });
  await page.evaluate(() => window.setFxHalftone(document.getElementById('abB'), { bg: 'none', color: 'image' }));
  await page.waitForFunction(() => document.querySelector('#abB img.asset-halftone')?.complete, null, { timeout: 5000 });
  const band = async () => {
    const buf = await page.locator('#abB .asset-img-clip').screenshot();
    return page.evaluate(async (b64) => {
      const im = new Image(); await new Promise((r) => { im.onload = r; im.src = 'data:image/png;base64,' + b64; });
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const mid = Math.round(im.width / 2), y0 = Math.round(im.height / 4), h = Math.round(im.height / 2);
      const dark = (x0, w) => { const d = x.getImageData(x0, y0, w, h).data; let k = 0; for (let i = 0; i < d.length; i += 4) if ((d[i] + d[i + 1] + d[i + 2]) / 3 < 235) k++; return +(k / (d.length / 4)).toFixed(3); };
      return { near: dark(mid - 24, 20), far: dark(8, 40) };   // near = 투명 쪽 경계 옆 띠 · far = 투명 쪽 먼 자리(바탕만 보여야)
    }, buf.toString('base64'));
  };
  const b0 = await band();
  const s0 = await ovSrc(page);
  await page.evaluate(() => window.setFxDecorBlur(document.getElementById('abB'), { state: 'on', v: 12 }));
  await waitOvChange(page, s0);
  const b12 = await band();
  console.log(`[D3 실측] 투명 쪽 어두운 칸 비율 — 흐림 0 ${JSON.stringify(b0)} · 흐림 12 ${JSON.stringify(b12)}`);
  expect(errs).toEqual([]);
});

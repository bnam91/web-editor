/* removebg-goya-asset-t211b.dom.spec.js — t2-11b (t2-11 QA B1): 다시 연 프로젝트의 그림(goya-asset://)도 remove.bg 로 보낼 수 있다.
 *   옛: _toB64 가 <img crossOrigin> 로 goya-asset:// 를 열려다 실패 → «❌ 이미지를 읽지 못했습니다» · 아무것도 안 보냄.
 *   새: 공용 문 goyaAssetToDrawableSrc(io/goya-asset-inline.js · window 다리)로 data: 로 바꾼 뒤 굽는다(ai-image-gen.js 와 같은 문).
 *   G1 goya-asset:// 그림 블럭 → 플러그인 → «remove.bg · 정밀 누끼» → 자산 읽기 1회 · removebgCutout 에 PNG b64 · 결과가 블럭 그림에 들어감
 *   G2 [음성] 자산 읽기 실패 → 옛 문구 «이미지를 읽지 못했습니다» · removebgCutout 0회 · 블럭 그대로
 *   G3 [대조] data: 그림은 자산 읽기 없이 그대로 보냄(옛 동작 유지)
 * ★양성대조: js/removebg-plugin.js 를 기준판(e7d97f1ec)으로 되돌리면 G1 빨강. 실제 키·API 호출 0(전부 가짜 electronAPI). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const OUT_B64 = PNG.split(',')[1];

async function setup(page, { readOk = true, src = 'goya-asset://proj_t211b/a.png' } = {}) {
  await page.addInitScript(([PNG, OUT_B64, readOk]) => {
    window.__reads = []; window.__cuts = [];
    const fake = {
      assetsReadAsDataUri: async (a) => { window.__reads.push(a); return readOk ? { ok: true, dataUri: PNG } : { ok: false }; },
      hasApiKey: async () => true,
      removebgCutout: async (p) => { window.__cuts.push(p); return { ok: true, b64: OUT_B64, mime: 'image/png' }; },
    };
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
  }, [PNG, OUT_B64, readOk]);
  const errs = await bootApp(page);
  const id = await page.evaluate((src) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sR" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="row" data-layout="stack"><div class="asset-block" id="abR" data-img-src="${src}" style="width:200px;height:120px"><img class="asset-img" src="${src}"></div></div></div></div>`);
    window.rebindAll?.(); window.deselectAll?.();
    document.getElementById('abR').classList.add('selected');   // 고르기 길은 이 검사의 대상이 아니다 — 변환·전송·반영만 잰다
    return 'abR';
  }, src);
  return { errs, id };
}
async function runPickRemoveBg(page) {
  await page.evaluate(() => { window.__toasts = []; const o = window.showToast; window.showToast = (m) => { window.__toasts.push(String(m)); o?.(m); }; window.runRemoveBg(); });
  const btn = page.locator('[data-rb-model="removebg"]');
  await expect(btn).toBeVisible();
  await btn.click();
}
const state = (page, id) => page.evaluate((id) => ({
  reads: window.__reads.length, cuts: window.__cuts.length,
  b64len: (window.__cuts[0]?.b64 || '').length, mime: window.__cuts[0]?.mime || null,
  src: document.getElementById(id).querySelector('img').getAttribute('src'),
  toasts: window.__toasts || [],
}), id);

test('G1 goya-asset:// 그림 → 자산 읽기 → PNG 로 remove.bg 전송 → 결과 반영', async ({ page }) => {
  const { id } = await setup(page);
  await runPickRemoveBg(page);
  await expect.poll(async () => (await state(page, id)).cuts, '★remove.bg 로 아무것도 안 보냈다(옛 «이미지를 읽지 못했습니다»)').toBe(1);
  const s = await state(page, id);
  expect(s.reads, '자산 읽기 1회').toBe(1);
  expect(s.mime).toBe('image/png');
  expect(s.b64len, 'PNG b64 가 비지 않았다').toBeGreaterThan(20);
  await expect.poll(async () => (await state(page, id)).src).toBe(`data:image/png;base64,${OUT_B64}`);
  expect(s.toasts.some(t => /읽지 못했습니다/.test(t))).toBe(false);
});

test('G2 [음성] 자산 읽기 실패 → «이미지를 읽지 못했습니다» · 전송 0 · 블럭 그대로', async ({ page }) => {
  const { id } = await setup(page, { readOk: false });
  await runPickRemoveBg(page);
  await expect.poll(async () => (await state(page, id)).toasts.some(t => /이미지를 읽지 못했습니다/.test(t))).toBe(true);
  const s = await state(page, id);
  expect(s.cuts, '읽기 실패인데 보냈다').toBe(0);
  expect(s.src).toBe('goya-asset://proj_t211b/a.png');
});

test('G3 [대조] data: 그림은 자산 읽기 없이 그대로 보낸다', async ({ page }) => {
  const { id } = await setup(page, { src: PNG });
  await runPickRemoveBg(page);
  await expect.poll(async () => (await state(page, id)).cuts).toBe(1);
  expect((await state(page, id)).reads).toBe(0);
});

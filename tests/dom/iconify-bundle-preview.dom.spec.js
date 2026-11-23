/* iconify-bundle-preview — 0.9.13 t13E-01(feather 프리뷰) · t13E-02(mdi 프리뷰·캔버스 깨짐) · 현빈 261122 · 태양
 *   뿌리: api.iconify.design 낱개 svg(/{set}/{name}.svg)는 속도 제한(429 · 코드 주석 실측 2026-09-10·09-22)에 걸린다.
 *     격자 미리보기는 묶음(/{set}.json?icons=)으로 받는데, 옛 판은 ⑴ 모르는 칸마다 낱개 <img> 를 먼저 쐈고 ⑵ 고른 미리보기 ⑶ 삽입이 낱개 svg 를 탔다
 *     ⇒ 429 면 미리보기 = 깨진 그림 · 삽입 = <img> 폴백이 캔버스에 박혀 깨짐(icn_svlkp_7k1g509 꼴).
 *   응답 = 261123 실측 꼴 그대로(mdi:file-warning-outline 은 별칭 → 부모 file-alert-outline · feather 는 검색 색인 밖 → 세트 목록)
 * B1 mdi 별칭 — 격자 svg · 고른 미리보기 = 인라인 svg · 삽입한 캔버스 블럭 = <svg>(<img> 아님) · 낱개 svg 요청 0
 * B2 feather 걸러 검색 — 세트 목록 → 묶음 → 격자·미리보기 인라인 · 낱개 요청 0
 * B3 [지킴] 묶음이 429 면 낱개 <img> 폴백은 그대로 남는다(서버가 회복되면 저절로 그려지는 길)
 * 양성대조: _patches/iconify-CTL.patch(제품 고침 되돌림) ⇒ B1·B2 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const MDI_JSON = { prefix: 'mdi', aliases: { 'file-warning-outline': { parent: 'file-alert-outline' } }, width: 24, height: 24,
  icons: { 'file-alert-outline': { body: '<path fill="currentColor" d="M20 17h2v-2h-2zm0-10v6h2V7M4 2c-1.11 0-2 .89-2 2v16c0 1.11.89 2 2 2h12c1.11 0 2-.89 2-2V8l-6-6M4 4h7v5h5v11H4Z"/>' },
    home: { body: '<path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3L2 12h3v8z"/>' } } };
const FEATHER_JSON = { prefix: 'feather', aliases: {}, width: 24, height: 24,
  icons: { home: { body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m3 9l9-7l9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></g>' } } };

async function scene(page, { bundleFails = false } = {}) {
  const hits = { single: 0, bundle: 0 };
  await page.route('https://api.iconify.design/**', (r) => {
    const u = new URL(r.request().url()), p = u.pathname;
    const json = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === '/search') return json(u.searchParams.get('prefix') === 'feather' ? { icons: [], total: 0 } : { icons: ['mdi:file-warning-outline', 'mdi:home'], total: 2 });
    if (p === '/collection') return json({ prefix: 'feather', total: 3, uncategorized: ['home', 'house-x', 'star'] });
    if (/^\/[\w-]+\.json$/.test(p)) { hits.bundle++; if (bundleFails) return json({}, 429); return json(p === '/mdi.json' ? MDI_JSON : FEATHER_JSON); }
    if (/^\/[\w-]+\/[\w-]+\.svg$/.test(p)) { hits.single++; return r.fulfill({ status: 429, contentType: 'text/plain', body: 'Too Many Requests' }); }
    return r.fulfill({ status: 404, body: '' });
  });
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); sec.id = 'sB'; window.selectSection(sec);
    window.openIconifyModal();
  });
  return { errs, hits };
}
const cellReady = (page, name, tag) => page.waitForFunction(([n, t]) => !!document.querySelector(`#iconify-grid .iconify-icon-cell[data-icon-name="${n}"] ${t}`), [name, tag], { polling: 100, timeout: 8000 });
const previewTag = (page) => page.evaluate(() => document.getElementById('iconify-selected-preview')?.firstElementChild?.tagName.toLowerCase() || null);

test('B1 mdi 별칭 — 미리보기·캔버스 = 인라인 svg · 낱개 svg 요청 0', async ({ page }) => {
  const { errs, hits } = await scene(page);
  await page.fill('#iconify-search-input', 'file');
  await cellReady(page, 'mdi:file-warning-outline', 'svg');
  await page.click('#iconify-grid .iconify-icon-cell[data-icon-name="mdi:file-warning-outline"]');
  const pv = await previewTag(page);
  await page.click('#iconify-insert-btn');
  await page.waitForFunction(() => !!document.querySelector('#sB .icon-block'), null, { polling: 100, timeout: 5000 });
  const blk = await page.evaluate(() => { const b = document.querySelector('#sB .icon-block'); return { svg: !!b.querySelector('svg path'), img: !!b.querySelector('img') }; });
  console.log('[B1 실측]', JSON.stringify({ pv, blk, hits }));
  expect(pv, '★고른 미리보기 = 인라인 svg(낱개 <img> 는 429 면 깨진 그림)').toBe('svg');
  expect(blk, '★캔버스 블럭 = svg · <img> 폴백 아님').toEqual({ svg: true, img: false });
  expect(hits.single, '★낱개 svg 요청 0(속도 제한을 다시 부르지 않음)').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B2 feather 걸러 검색 — 세트 목록 → 묶음 → 격자·미리보기 인라인 · 낱개 요청 0', async ({ page }) => {
  const { errs, hits } = await scene(page);
  await page.click('.iconify-col-btn[data-prefix="feather"]');
  await page.fill('#iconify-search-input', 'home');
  await cellReady(page, 'feather:home', 'svg');
  await page.click('#iconify-grid .iconify-icon-cell[data-icon-name="feather:home"]');
  const pv = await previewTag(page);
  console.log('[B2 실측]', JSON.stringify({ pv, hits }));
  expect(pv, '★feather 미리보기 = 인라인 svg').toBe('svg');
  expect(hits.single, '★낱개 svg 요청 0').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B3 [지킴] 묶음 429 → 낱개 <img> 폴백은 남는다', async ({ page }) => {
  const { errs } = await scene(page, { bundleFails: true });
  await page.fill('#iconify-search-input', 'file');
  await cellReady(page, 'mdi:home', 'img');
  await page.click('#iconify-grid .iconify-icon-cell[data-icon-name="mdi:home"]');
  expect(await previewTag(page), '★묶음 몸통이 없으면 미리보기도 <img> 폴백').toBe('img');
  expect(errs.filter((e) => !/429|Too Many/.test(e)), errs.join(' | ')).toEqual([]);
});

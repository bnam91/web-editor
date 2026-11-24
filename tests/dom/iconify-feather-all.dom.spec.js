/* iconify-feather-all — ☐2 Feather(현빈 261123 · 가지 tp/0913-feather · 근거 js/panels/iconify-panel.js _NO_INDEX · _showWholeCollection · _searchInCollection)
 *   Iconify 검색 색인엔 feather 가 없다(/search?prefix=feather = 0 · /collection?prefix=feather = 세트 전체 · 미카사 채점 261121 ②).
 *   F1 Feather 탭을 누르면(검색어 없음) 세트 «전체»가 격자에 뜬다(옛: «위에서 아이콘을 검색해보세요» 글만)
 *   F2 Feather 걸러 검색 = 세트 목록에서 고른 것 «전부»(옛: 상한 80)
 *   F3 검색어를 지우면 다시 전체 · 다른 세트(All)로 가면 옛 동작(빈 검색 = 안내 글)
 * 네트워크 = api.iconify.design 만 가짜(세트 120개 · 이름에 'ic' 든 것 100개) — 실서버 0.
 * 양성대조: _searchInCollection 에 .slice(0, 80) 를 되돌리면 F2 빨강 · 탭 배선의 _showWholeCollection 줄을 지우면 F1 빨강 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const NAMES = Array.from({ length: 120 }, (_, i) => (i < 100 ? `icon-${i}` : `x-${i}`));
    window.__fetchLog = []; const f0 = window.fetch;
    window.fetch = async (u, ...a) => { const s = String(u); if (!s.startsWith('https://api.iconify.design/')) return f0(u, ...a); window.__fetchLog.push(s);
      if (s.includes('/search?')) return new Response(JSON.stringify({ icons: [], total: 0 }), { status: 200 });
      if (s.includes('/collection?prefix=feather')) return new Response(JSON.stringify({ prefix: 'feather', total: NAMES.length, uncategorized: NAMES }), { status: 200 });
      if (s.includes('/feather.json')) { const want = decodeURIComponent((s.split('icons=')[1] || '')).split(','); const icons = {}; want.forEach((n) => { icons[n] = { body: '<path d="M1 1h2"/>' }; }); return new Response(JSON.stringify({ prefix: 'feather', icons, width: 24, height: 24 }), { status: 200 }); }
      return new Response('<svg/>', { status: 200 }); };
    window.openIconifyModal();
  });
  return errs;
}
const cells = (page) => page.evaluate(() => document.querySelectorAll('#iconify-grid .iconify-icon-cell').length);

test('F1 Feather 탭(검색어 없음) = 세트 전체 120', async ({ page }) => {
  const errs = await scene(page);
  await page.click('.iconify-col-btn[data-prefix="feather"]');
  await expect.poll(() => cells(page), { timeout: 8000 }).toBe(120);
  expect(errs).toEqual([]);
});

test('F2 Feather 걸러 검색 = 목록에서 고른 것 전부(상한 80 없음)', async ({ page }) => {
  const errs = await scene(page);
  await page.click('.iconify-col-btn[data-prefix="feather"]');
  await page.fill('#iconify-search-input', 'ic');
  await expect.poll(() => cells(page), { timeout: 8000 }).toBe(100);
  expect(errs).toEqual([]);
});

test('F3 검색어 지우면 다시 전체 · All 세트의 빈 검색 = 안내 글(옛 동작)', async ({ page }) => {
  const errs = await scene(page);
  await page.click('.iconify-col-btn[data-prefix="feather"]');
  await page.fill('#iconify-search-input', 'ic');
  await expect.poll(() => cells(page), { timeout: 8000 }).toBe(100);
  await page.fill('#iconify-search-input', '');
  await expect.poll(() => cells(page), { timeout: 8000 }).toBe(120);
  await page.click('.iconify-col-btn[data-prefix=""]');
  await page.fill('#iconify-search-input', 'x'); await page.fill('#iconify-search-input', '');
  await expect.poll(() => page.evaluate(() => (document.getElementById('iconify-grid')?.textContent || '').trim()), { timeout: 5000 }).toContain('검색해보세요');
  expect(errs).toEqual([]);
});

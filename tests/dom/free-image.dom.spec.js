/* free-image — t13A-06(현빈 GO 261119) 무료 이미지(Pixabay · 사용자 본인 키 · 서버 0)
 *   ★실키·실호출 0 — main 쪽(electronAPI.pixabay)은 가짜(키를 제 closure 에만 · ••••끝4 만 돌려줌) · 미리보기 그림 주소는 page.route 로 작은 PNG.
 * 칸
 *   F1 처음 열기 = «내 키» 화면(가입·API 문서 단추 · 붙여넣기 칸) → 가짜 키 저장 = 검색 화면(키 ••••끝4 · «Pixabay» 제공 표시) · 칸 비움
 *      → «고양이» 검색 = 칸 셋 · 같은 검색 다시 = 가짜 main 검색 1번만(24시간 캐시)
 *   F2 칸 누름 = 가짜 main 그림 받기(큰 그림 주소) → 모달 닫힘 · 에셋 블럭 +1(그 그림)
 *   F3 ★키 새는 곳 0 — 저장 글자(serializeProject) · 내보낸 HTML · localStorage 전부 · 콘솔 · 문서 HTML 어디에도 가짜 키 없음
 *   F4 키 틀림(main = bad_key) → «내 키» 화면 + 안내 한 줄
 * 양성대조: _patches/free-image-CTL-key-to-localstorage.patch(저장 때 키를 localStorage 에도) → F3 빨강.
 * ⛔고정 대기 0.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const FAKE = '99999999-fakekeyfordomspec0';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const HITS = [1, 2, 3].map((i) => ({ id: i, webformatURL: `https://pixabay.com/get/p${i}_640.png`, largeImageURL: `https://pixabay.com/get/p${i}_1280.png`, pageURL: `https://pixabay.com/photos/p-${i}/`, user: 'u' + i, tags: 'cat', imageWidth: 400, imageHeight: 300 }));

async function scene(page, { searchReason = null } = {}) {
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.route('https://pixabay.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async ([HITS, reason, PNGB64]) => {
    try { localStorage.removeItem('goditor.pixabayCache'); } catch (_) {}
    window.__admin = { ...(window.__admin || {}), state: () => ({ isAdmin: true }) };   // [전제] t13F-01 부터 관리자만 — 장면 전제 · 기대 무변
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    await window.addSection();
    window.__px = { searches: 0, fetched: [] };
    let key = '';   // 가짜 main — 키는 여기(closure)에만
    const pixabay = {
      status: async () => ({ hasKey: !!key, masked: key ? '••••' + key.slice(-4) : '' }),
      setKey: async (k) => { key = String(k); return { ok: true, hasKey: true, masked: '••••' + key.slice(-4) }; },
      clearKey: async () => { key = ''; return { ok: true, hasKey: false, masked: '' }; },
      search: async (p) => { window.__px.searches++; return reason ? { ok: false, reason } : { ok: true, data: { total: 3, hits: HITS } }; },
      fetchImage: async (u) => { window.__px.fetched.push(u); return { ok: true, dataUrl: 'data:image/png;base64,' + PNGB64 }; },
      openSite: async () => ({ ok: true }),
    };
    const base = window.electronAPI;
    window.electronAPI = new Proxy({ pixabay }, { get: (t, k) => (k in t ? t[k] : base?.[k]) });
  }, [HITS, searchReason, PNG.toString('base64')]);
  return { errs, logs };
}
const openPanel = (page) => page.evaluate(() => window.openFreeImageModal());
async function saveKey(page) {
  await expect(page.locator('#fi-key'), '★처음 = 내 키 화면').toBeVisible();
  await expect(page.locator('#fi-open-register')).toHaveCount(1);
  await expect(page.locator('#fi-open-docs')).toHaveCount(1);
  await page.locator('#fi-key').fill(FAKE);
  await page.locator('#fi-key-save').click();
  await expect(page.locator('#fi-q'), '★저장 = 검색 화면').toBeVisible();
}
async function search(page, q) { await page.locator('#fi-q').fill(q); await page.locator('#fi-go').click(); }

test('F1 내 키 → 검색 · 24시간 캐시', async ({ page }) => {
  const { errs } = await scene(page);
  await openPanel(page);
  await saveKey(page);
  await expect(page.locator('#fi-modal'), '★키 ••••끝4 · Pixabay 제공').toContainText('••••pec0');
  await expect(page.locator('#fi-credit')).toContainText('Pixabay');
  await search(page, '고양이');
  await expect(page.locator('.fi-item'), '★칸 셋').toHaveCount(3);
  await search(page, '고양이');
  await expect(page.locator('.fi-item')).toHaveCount(3);
  expect(await page.evaluate(() => window.__px.searches), '★같은 검색 = main 1번(캐시)').toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F2 칸 누름 = 에셋 블럭 하나', async ({ page }) => {
  const { errs } = await scene(page);
  await openPanel(page); await saveKey(page); await search(page, '고양이');
  await expect(page.locator('.fi-item')).toHaveCount(3);
  const n0 = await page.locator('#canvas .asset-block').count();
  await page.locator('.fi-item').nth(1).click();
  await expect(page.locator('#fi-modal'), '★모달 닫힘').toBeHidden();
  await expect(page.locator('#canvas .asset-block'), '★에셋 +1').toHaveCount(n0 + 1);
  expect(await page.evaluate(() => window.__px.fetched), '★큰 그림 주소로 받음').toEqual(['https://pixabay.com/get/p2_1280.png']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F3 ★키 새는 곳 0', async ({ page }) => {
  const { errs, logs } = await scene(page);
  await openPanel(page); await saveKey(page); await search(page, '고양이');
  await expect(page.locator('.fi-item')).toHaveCount(3);
  await page.locator('.fi-item').first().click();
  await expect(page.locator('#canvas .asset-block')).not.toHaveCount(0);
  const where = await page.evaluate(async (FAKE) => {
    const origCreate = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click;
    let blob = null;
    URL.createObjectURL = (b) => { blob = b; return 'blob:fi'; }; HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = origCreate; HTMLAnchorElement.prototype.click = origClick; }
    const html = blob ? await blob.text() : '';
    const ls = Object.keys(localStorage).map((k) => k + '=' + localStorage.getItem(k)).join('\n');
    return { saved: String(window.serializeProject?.() || '').includes(FAKE), html: !!html && html.includes(FAKE), htmlOk: !!html, ls: ls.includes(FAKE), dom: document.documentElement.outerHTML.includes(FAKE) };
  }, FAKE);
  expect(where, '★저장·HTML·localStorage·문서 어디에도 키 0').toEqual({ saved: false, html: false, htmlOk: true, ls: false, dom: false });
  expect(logs.filter((l) => l.includes(FAKE)), '★콘솔 0').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F4 키 틀림 = 내 키 화면 + 안내', async ({ page }) => {
  const { errs } = await scene(page, { searchReason: 'bad_key' });
  await openPanel(page); await saveKey(page); await search(page, '고양이');
  await expect(page.locator('#fi-note'), '★안내 한 줄').toContainText('키가 맞지 않아요');
  await expect(page.locator('#fi-key')).toBeVisible();
  expect(errs, errs.join(' | ')).toEqual([]);
});

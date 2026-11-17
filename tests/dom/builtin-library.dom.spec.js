/* builtin-library — 0.9.13 내장 라이브러리 모달(현빈 결정 261117 · js/panels/library-panel.js · 명부 js/data/builtin-library.js)
 * 장면은 앱의 제 문으로: 섹션 하나 고름 → 하단 Plugins(#fp-plugin-btn) → «내장 라이브러리»(#plugin-library) → 칸 클릭.
 * D1 모달: 묶음 칸 수 = 명부 · 그림이 실제로 읽힘(naturalWidth > 0) · 출처·라이선스 줄
 * D2 넣기: 칸 클릭 → 고른 섹션에 에셋 블럭 하나 더 · 그 그림 = 동봉 PNG 의 data URL · 폭 = 명부 w · 높이 = 그림 비율 · 넣은 직후 우측 패널 너비 240·패딩 제외 꺼짐
 * D3 탭: 묶음 둘 이상이면 탭 · 스토리보드 탭 → 3칸 · JPEG 넣기(폭 = 섹션 안쪽 상한 · 높이 = 1408:780 비율)
 * D4 관리자 폴더: 일반 계정 = 미모지 탭 없음(두들 탭은 있음) · 관리자(__admin._forceState) = 미모지 탭 2칸
 * D5 Fluent Emoji: 제 단추(#plugin-fluent-emoji) → 그 묶음 30칸만(탭 없음) · MIT 줄 · 내장 라이브러리 탭엔 없음 · 넣기 160×160
 * D6 제품 스케치컷 샘플: 일반 계정 = 탭 없음 · 관리자 = 8칸 · 그림 8장 다 읽힘
 * 자 = dataset·style 글자(화면 px 아님 · 배율 무관). ⛔고정 대기 0(조건 대기).
 * 양성대조(예측 · CTL): library-panel.js _insert 의 addAssetBlock 호출 줄을 지우면 → D2 빨강(블럭 수 그대로) · D1 초록
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas');
    if (!c.querySelector('.section-block')) await window.addSection();
    window.selectSection([...c.querySelectorAll('.section-block')].pop());
  });
  return errs;
}
async function openLibrary(page, item = '#plugin-library') {
  if (!(await page.isVisible(item))) await page.click('#fp-plugin-btn');
  await page.click(item);
  await expect(page.locator('#lib-modal')).toBeVisible();
}
const assetCount = (page) => page.evaluate(() => window.getSelectedSection().querySelectorAll('.asset-block').length);

test('D1 모달 — QR·바코드 13칸 · 그림 읽힘 · 출처·라이선스 줄', async ({ page }) => {
  const errs = await setup(page);
  await openLibrary(page);
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(13);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#lib-grid .lib-item img')].filter((i) => i.complete && i.naturalWidth > 0).length)).toBe(13);
  await expect(page.locator('#lib-credit')).toContainText('라이선스: 자체 제작');
  expect(errs).toEqual([]);
});

test('D2 넣기 — QR 칸 클릭 → 에셋 블럭 · 동봉 PNG data URL · 240×240', async ({ page }) => {
  await setup(page);
  const before = await assetCount(page);
  await openLibrary(page);
  await page.click('#lib-grid .lib-item[title="QR 기본"]');
  await expect.poll(() => assetCount(page)).toBe(before + 1);
  await expect(page.locator('#lib-modal')).toBeHidden();
  const got = await page.evaluate(() => {
    const ab = [...window.getSelectedSection().querySelectorAll('.asset-block')].pop();
    return { src: (ab.dataset.imgSrc || '').slice(0, 31), w: ab.style.width, h: ab.style.height };
  });
  expect(got).toEqual({ src: 'data:image/png;base64,iVBORw0KG', w: '240px', h: '240px' });
  /* r3(9500 실앱): 넣은 «직후» 우측 패널이 블럭 지금 값을 말해야 한다(낡은 860·패딩 제외 켬이면 만지는 순간 860 으로 튄다) */
  await expect(page.locator('#asset-w-number')).toHaveValue('240');
  await expect(page.locator('#asset-padx-toggle')).not.toBeChecked();
});

test('D3 탭 — 스토리보드 3칸 · JPEG 넣기 · 폭 상한·비율', async ({ page }) => {
  await setup(page);
  await openLibrary(page);
  await page.click('.lib-tab[data-col="storyboard"]');
  await expect(page.locator('.lib-tab[data-col="storyboard"]')).toHaveClass(/active/);
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(3);
  await expect(page.locator('#lib-credit')).toContainText('워터마크');
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#lib-grid .lib-item img')].filter((i) => i.naturalWidth > 0).length)).toBe(3);
  const before = await assetCount(page);
  await page.click('#lib-grid .lib-item[title="공장 전경"]');
  await expect.poll(() => assetCount(page)).toBe(before + 1);
  const got = await page.evaluate(() => {
    const ab = [...window.getSelectedSection().querySelectorAll('.asset-block')].pop();
    return { src: (ab.dataset.imgSrc || '').slice(0, 27), w: parseInt(ab.style.width, 10), h: parseInt(ab.style.height, 10) };
  });
  expect(got.src).toBe('data:image/jpeg;base64,/9j/');
  expect(got.w).toBeGreaterThan(0);
  expect(got.w).toBeLessThanOrEqual(860);
  expect(Math.abs(got.h - Math.round((got.w * 780) / 1408))).toBeLessThanOrEqual(1);
});

test('D4 관리자 폴더 — 일반 계정엔 미모지 탭 없음 · 관리자엔 2칸', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.__admin._forceState({ ok: true, isAdmin: false, hasRoleField: true }));
  await openLibrary(page);
  await expect(page.locator('.lib-tab[data-col="doodle"]')).toHaveCount(1);
  await expect(page.locator('.lib-tab[data-col="admin-memoji"]')).toHaveCount(0);
  await page.click('#lib-modal-close');
  await page.evaluate(() => window.__admin._forceState({ ok: true, isAdmin: true }));
  await openLibrary(page);
  await page.click('.lib-tab[data-col="admin-memoji"]');
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(2);
  await expect(page.locator('#lib-credit')).toContainText('관리자 개인용');
});

test('D5 Fluent Emoji — 제 단추 → 30칸만 · MIT 줄 · 라이브러리 탭엔 없음 · 160×160 넣기', async ({ page }) => {
  await setup(page);
  await openLibrary(page);
  await expect(page.locator('.lib-tab[data-col="fluent-emoji"]')).toHaveCount(0);
  await page.click('#lib-modal-close');
  await openLibrary(page, '#plugin-fluent-emoji');
  await expect(page.locator('#lib-tabs')).toBeHidden();
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(30);
  await expect(page.locator('#lib-credit')).toContainText('MIT © Microsoft Corporation');
  const before = await assetCount(page);
  await page.click('#lib-grid .lib-item[title="thumbs up"]');
  await expect.poll(() => assetCount(page)).toBe(before + 1);
  const got = await page.evaluate(() => {
    const ab = [...window.getSelectedSection().querySelectorAll('.asset-block')].pop();
    return { src: (ab.dataset.imgSrc || '').slice(0, 22), w: ab.style.width, h: ab.style.height };
  });
  expect(got).toEqual({ src: 'data:image/png;base64,', w: '160px', h: '160px' });
});

test('D6 제품 스케치컷 샘플 — 일반 계정엔 탭 없음 · 관리자엔 8장 다 읽힘', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.__admin._forceState({ ok: true, isAdmin: false, hasRoleField: true }));
  await openLibrary(page);
  await expect(page.locator('.lib-tab[data-col="product-sketch"]')).toHaveCount(0);
  await page.click('#lib-modal-close');
  await page.evaluate(() => window.__admin._forceState({ ok: true, isAdmin: true }));
  await openLibrary(page);
  await page.click('.lib-tab[data-col="product-sketch"]');
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(8);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#lib-grid .lib-item img')].filter((i) => i.naturalWidth > 0).length)).toBe(8);
});

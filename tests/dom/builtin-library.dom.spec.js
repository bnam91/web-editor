/* builtin-library — 0.9.13 내장 라이브러리 모달(현빈 결정 261117 · js/panels/library-panel.js · 명부 js/data/builtin-library.js)
 * 장면은 앱의 제 문으로: 섹션 하나 고름 → 하단 Plugins(#fp-plugin-btn) → «내장 라이브러리»(#plugin-library) → 칸 클릭.
 * D1 모달: 묶음 칸 수 = 명부 · 그림이 실제로 읽힘(naturalWidth > 0) · 출처·라이선스 줄
 * D2 넣기: 칸 클릭 → 고른 섹션에 에셋 블럭 하나 더 · 그 그림 = 동봉 PNG 의 data URL · 폭 = 명부 w · 높이 = 그림 비율
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
    return { src: (ab.dataset.imgSrc || '').slice(0, 30), w: ab.style.width, h: ab.style.height };
  });
  expect(got).toEqual({ src: 'data:image/png;base64,iVBORw0KG', w: '240px', h: '240px' });
});

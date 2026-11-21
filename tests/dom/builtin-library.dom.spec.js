/* builtin-library — 0.9.13 내장 라이브러리 모달(현빈 결정 261117 · js/panels/library-panel.js · 명부 js/data/builtin-library.js)
 * 장면은 앱의 제 문으로: 섹션 하나 고름 → 하단 Plugins(#fp-plugin-btn) → «내장 라이브러리»(#plugin-library) → 칸 클릭.
 * D1 모달: 묶음 칸 수 = 명부 · 그림이 실제로 읽힘(naturalWidth > 0) · 출처·라이선스 줄
 * D2 넣기: 칸 클릭 → 고른 섹션에 에셋 블럭 하나 더 · 그 그림 = 동봉 PNG 의 data URL · 폭 = 명부 w · 높이 = 그림 비율 · 넣은 직후 우측 패널 너비 240·패딩 제외 꺼짐
 * D3 탭: 스토리보드 탭 없음(현빈 261117 제거) · 묶음 둘 이상이면 탭 · 관리자 제품 스케치컷 탭 → JPEG 넣기(폭 = 섹션 안쪽 상한 · 높이 = 1410:360 비율)
 * D4 관리자 폴더: 일반 계정 = 미모지 탭 없음(두들 탭은 있음) · 관리자(__admin._forceState) = 미모지 탭 22칸(Fluent 사람 · Apple 모양 샘플 2 걷음 261117) 다 읽힘
 * D5 Fluent Emoji: 제 단추(#plugin-fluent-emoji) → 그 묶음 30칸만(탭 없음) · MIT 줄 · 내장 라이브러리 탭엔 없음 · 넣기 160×160
 * D6 제품 스케치컷 샘플: 일반 계정 = 탭 없음 · 관리자 = 8칸 · 그림 8장 다 읽힘
 * D7 두들(CC0 SVG): 일반 계정 탭 → 24칸 다 읽힘 · CC0 줄 · 넣기 = 벡터 블럭(libMono · 폭 200) · 색 칸 길로 색 바꿈 · 두 번 넣어도 id 안 겹침(★261120 기대 바뀜)
 * D8 화살표(자체 SVG): 탭 → 20칸 다 읽힘 · 자체 제작 줄 · 넣기 = 벡터 블럭(libMono) · 색 바꿈(★261120 기대 바뀜)
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
const vecCount = (page) => page.evaluate(() => window.getSelectedSection().querySelectorAll('.vector-block').length);
/* ★기대 바뀜(dev 9a724fb78 실앱 채점 ② · 현빈 «라이브러리 두들 넣기 → 색 바꾸기» · 261120): 내장 «단색» SVG(두들·화살표)는 에셋(그림)이 아니라 벡터 블럭(libMono)으로 —
   관리자 로컬 SVG(LIB-FIGMA · admin-local-library L1)와 같은 길. 옛 D7·D8 은 «에셋 · data:image/svg+xml» 을 잼(옛 뜻 = «색 바꾸기는 벡터 블럭으로 넣기 뒤 별도»).
   잰다: 벡터 하나 더 · 에셋 수 그대로 · libMono=1 · 색 #000000 · 폭 200 · 색 칸 길(dataset.color → renderVector)로 바꾸면 그려진 칠(계산값)이 그 색 ·
   두 번 넣으면 자르기 id 가 서로 다르다(동봉 두들은 다 clip0 — 같으면 둘째가 첫째 자르기 상자를 씀).
   양성대조: _patches/lib-CTL-builtin-svg-asset.patch(_insert 의 단색 벡터 갈래 걷음 → 옛 에셋) → D7·D8 빨강. */
async function insertVec(page, title) {
  const v0 = await vecCount(page), a0 = await assetCount(page);
  await page.click(`#lib-grid .lib-item[title="${title}"]`);
  await expect.poll(() => vecCount(page)).toBe(v0 + 1);
  expect(await assetCount(page), '에셋은 안 늘어난다').toBe(a0);
  return page.evaluate(() => {
    const b = [...window.getSelectedSection().querySelectorAll('.vector-block')].pop();
    const paint = (sel) => { const e = b.querySelector('.vb-inner svg ' + sel); if (!e) return null; const cs = getComputedStyle(e); return sel === 'path' ? [cs.fill, cs.stroke] : null; };
    const drawn = paint('path');
    b.dataset.color = '#123456'; window.renderVector(b);
    const after = paint('path');
    const ids = [...b.querySelectorAll('.vb-inner [id]')].map((e) => e.id);
    return { libMono: b.dataset.libMono, color: '#000000', w: b.dataset.w, drawn, after, ids };
  });
}
const hasRgb = (pair, rgb) => !!pair && pair.includes(rgb);

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
  await expect(page.locator('#lib-modal'), 'LIB-MODAL-STAY-OPEN-01(현빈 261118) — 넣어도 모달은 열린 채(옛 = 닫힘 · 제품 의도 변경)').toBeVisible();
  const got = await page.evaluate(() => {
    const ab = [...window.getSelectedSection().querySelectorAll('.asset-block')].pop();
    return { src: (ab.dataset.imgSrc || '').slice(0, 31), w: ab.style.width, h: ab.style.height };
  });
  expect(got).toEqual({ src: 'data:image/png;base64,iVBORw0KG', w: '240px', h: '240px' });
  /* r3(9500 실앱): 넣은 «직후» 우측 패널이 블럭 지금 값을 말해야 한다(낡은 860·패딩 제외 켬이면 만지는 순간 860 으로 튄다) */
  await expect(page.locator('#asset-w-number')).toHaveValue('240');
  await expect(page.locator('#asset-padx-toggle')).not.toBeChecked();
});

test('D3 탭 — 스토리보드 탭 없음 · JPEG 넣기 · 폭 상한·비율', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.__admin._forceState({ ok: true, isAdmin: true }));
  await openLibrary(page);
  await expect(page.locator('#lib-tabs')).toBeVisible();
  await expect(page.locator('.lib-tab[data-col="storyboard"]')).toHaveCount(0);   // 현빈 261117 — 스토리보드 묶음 걷음
  await page.click('.lib-tab[data-col="product-sketch"]');
  await expect(page.locator('.lib-tab[data-col="product-sketch"]')).toHaveClass(/active/);
  const before = await assetCount(page);
  await page.click('#lib-grid .lib-item[title="A 비교 한 장"]');
  await expect.poll(() => assetCount(page)).toBe(before + 1);
  const got = await page.evaluate(() => {
    const ab = [...window.getSelectedSection().querySelectorAll('.asset-block')].pop();
    return { src: (ab.dataset.imgSrc || '').slice(0, 27), w: parseInt(ab.style.width, 10), h: parseInt(ab.style.height, 10) };
  });
  expect(got.src).toBe('data:image/jpeg;base64,/9j/');
  expect(got.w).toBeGreaterThan(0);
  expect(got.w).toBeLessThanOrEqual(860);
  expect(Math.abs(got.h - Math.round((got.w * 360) / 1410))).toBeLessThanOrEqual(1);
});

test('D4 관리자 폴더 — 일반 계정엔 미모지 탭 없음 · 관리자엔 22칸 다 읽힘', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.__admin._forceState({ ok: true, isAdmin: false, hasRoleField: true }));
  await openLibrary(page);
  await expect(page.locator('.lib-tab[data-col="doodle"]')).toHaveCount(1);
  await expect(page.locator('.lib-tab[data-col="admin-memoji"]')).toHaveCount(0);
  await page.click('#lib-modal-close');
  await page.evaluate(() => window.__admin._forceState({ ok: true, isAdmin: true }));
  await openLibrary(page);
  await page.click('.lib-tab[data-col="admin-memoji"]');
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(22);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#lib-grid .lib-item img')].filter((i) => i.complete && i.naturalWidth > 0).length)).toBe(22);
  await expect(page.locator('#lib-credit')).toContainText('관리자 탭에만 보임');
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

test('D7 두들 — 24칸 다 읽힘 · CC0 줄 · 넣기 = 벡터(libMono) · 색 바꾸기 · id 안 겹침', async ({ page }) => {
  await setup(page);
  await openLibrary(page);
  await page.click('.lib-tab[data-col="doodle"]');
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(24);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#lib-grid .lib-item img')].filter((i) => i.complete && i.naturalWidth > 0).length)).toBe(24);
  await expect(page.locator('#lib-credit')).toContainText('CC0');
  const a = await insertVec(page, '닻');
  expect({ libMono: a.libMono, w: a.w }).toEqual({ libMono: '1', w: '200' });
  expect(hasRgb(a.drawn, 'rgb(0, 0, 0)'), `그려진 칠 = 검정 ${JSON.stringify(a.drawn)}`).toBe(true);
  expect(hasRgb(a.after, 'rgb(18, 52, 86)'), `★색 칸 길로 바꾼 칠 = #123456 ${JSON.stringify(a.after)}`).toBe(true);
  const b = await insertVec(page, '케이크');
  expect(a.ids.length > 0 && b.ids.length > 0, `[전제] 두 두들 다 자르기 id 가 있다 ${JSON.stringify([a.ids, b.ids])}`).toBe(true);
  expect(a.ids.filter((x) => b.ids.includes(x)), '★두 번 넣은 두들의 id 가 겹치지 않는다').toEqual([]);
});

test('D8 화살표 — 20칸 다 읽힘 · 자체 제작 줄 · 넣기 = 벡터(libMono) · 색 바꾸기', async ({ page }) => {
  await setup(page);
  await openLibrary(page);
  await page.click('.lib-tab[data-col="arrow"]');
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(20);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#lib-grid .lib-item img')].filter((i) => i.complete && i.naturalWidth > 0).length)).toBe(20);
  await expect(page.locator('#lib-credit')).toContainText('라이선스: 자체 제작');
  const a = await insertVec(page, 'U턴');
  expect({ libMono: a.libMono, w: a.w }).toEqual({ libMono: '1', w: '200' });
  expect(hasRgb(a.drawn, 'rgb(0, 0, 0)'), `그려진 획 = 검정 ${JSON.stringify(a.drawn)}`).toBe(true);
  expect(hasRgb(a.after, 'rgb(18, 52, 86)'), `★색 칸 길로 바꾼 획 = #123456 ${JSON.stringify(a.after)}`).toBe(true);
});

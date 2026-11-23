/* qa-samples-library — 0.9.13 t13F-06(벡터 여러 색·선 / SVG→패스 점 편집을 현빈이 바로 시험할 «QA 샘플» 상시 비치) · 현빈 261122 · 태양
 *   자리 = 내장 라이브러리 «QA 샘플» 탭(관리자 · js/data/builtin-library.js qa-samples · rawSvg) · 파일 = assets/library/qa-samples/ 30~39(지디 261122 원본 바이트)
 *   넣기 = «들여온 SVG»와 같은 문 window.addVectorFromSvgText(파일 고르기·끌어 놓기·붙여넣기 · P5 펜 변환) — 에셋 그림도 단색 libMono 도 아님.
 * Q1 일반 계정 = QA 샘플 탭 없음 · 관리자 = 탭 하나 · 10칸 · 썸네일 다 읽힘
 * Q2 31 여러색 꽃 → 벡터 블럭 하나 더(에셋 0) · 그려진 칠 다섯 가지 색 그대로(libMono 아님)
 * Q3 30 단색 하트 → «끌어 놓은 SVG»(addVectorFromSvgText 직접)와 같은 꼴(펜 노드 유무·칠·libMono 없음) — 하트는 호(A)라 P5 펜이 아님(앱 실측) · 옛 길이면 libMono=1
 * 양성대조: _patches/qa-samples-CTL.patch(_insert 의 rawSvg 갈래 걷음 → 옛 길: 다색 = 에셋 · 단색 = libMono) ⇒ Q2·Q3 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page, admin) {
  const errs = await bootApp(page);
  await page.evaluate(async (admin) => {
    window.__admin._forceState({ ok: true, isAdmin: admin, hasRoleField: true });
    const c = document.getElementById('canvas');
    if (!c.querySelector('.section-block')) await window.addSection();
    window.selectSection([...c.querySelectorAll('.section-block')].pop());
  }, admin);
  if (!(await page.isVisible('#plugin-library'))) await page.click('#fp-plugin-btn');
  await page.click('#plugin-library');
  await expect(page.locator('#lib-modal')).toBeVisible();
  return errs;
}
const counts = (page) => page.evaluate(() => { const s = window.getSelectedSection(); return { vec: s.querySelectorAll('.vector-block').length, asset: s.querySelectorAll('.asset-block').length }; });
async function insert(page, title) {
  const c0 = await counts(page);
  await page.click(`#lib-grid .lib-item[title="${title}"]`);
  await expect.poll(async () => (await counts(page)).vec, `[전제] ${title} 넣음`).toBe(c0.vec + 1);
  const c1 = await counts(page);
  return page.evaluate((asset) => {
    const b = [...window.getSelectedSection().querySelectorAll('.vector-block')].pop();
    const fills = [...new Set([...b.querySelectorAll('.vb-inner svg *')].map((e) => getComputedStyle(e).fill).filter((f) => f && f !== 'none' && !/^url/.test(f)))].sort();
    return { assetDelta: asset, libMono: b.dataset.libMono ?? null, pen: !!b.dataset.penNodes, fills };
  }, c1.asset - c0.asset);
}

test('Q1 일반 = 탭 없음 · 관리자 = QA 샘플 10칸 다 읽힘', async ({ page }) => {
  const errs = await setup(page, false);
  await expect(page.locator('.lib-tab[data-col="qa-samples"]'), '★일반 계정 = 탭 없음').toHaveCount(0);
  await page.click('#lib-modal-close');
  await page.evaluate(() => window.__admin._forceState({ ok: true, isAdmin: true }));
  if (!(await page.isVisible('#plugin-library'))) await page.click('#fp-plugin-btn');   // 모달을 닫으면 플러그인 판도 닫힌다
  await page.click('#plugin-library');
  await page.click('.lib-tab[data-col="qa-samples"]');
  await expect(page.locator('#lib-grid .lib-item')).toHaveCount(10);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#lib-grid .lib-item img')].filter((i) => i.complete && i.naturalWidth > 0).length), '★썸네일 10 다 읽힘').toBe(10);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Q2 31 여러색 꽃 → 벡터(에셋 아님) · 색 다섯 그대로', async ({ page }) => {
  const errs = await setup(page, true);
  await page.click('.lib-tab[data-col="qa-samples"]');
  const r = await insert(page, '31 여러색 꽃');
  console.log('[Q2 실측]', JSON.stringify(r));
  expect(r.assetDelta, '★에셋 그림으로 안 들어감').toBe(0);
  expect(r.libMono, '★단색 libMono 아님').toBe(null);
  expect(r.fills, '★다섯 색 그대로').toEqual(['rgb(142, 78, 198)', 'rgb(255, 138, 61)', 'rgb(255, 197, 61)', 'rgb(62, 99, 221)', 'rgb(70, 167, 88)'].sort());
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Q3 30 단색 하트 → 끌어 놓은 SVG 와 같은 꼴(libMono 아님 · 원본 빨강)', async ({ page }) => {
  const errs = await setup(page, true);
  await page.click('.lib-tab[data-col="qa-samples"]');
  const r = await insert(page, '30 단색 하트');
  const drop = await page.evaluate(async () => {   // 같은 파일을 «들여온 SVG» 문으로 직접(끌어 놓기·붙여넣기가 부르는 그 함수)
    const t = await (await fetch('assets/library/qa-samples/30-mono-heart.svg')).text();
    const b = window.addVectorFromSvgText(t, 'drop');
    const fills = [...new Set([...b.querySelectorAll('.vb-inner svg *')].map((e) => getComputedStyle(e).fill).filter((f) => f && f !== 'none' && !/^url/.test(f)))].sort();
    return { libMono: b.dataset.libMono ?? null, pen: !!b.dataset.penNodes, fills };
  });
  console.log('[Q3 실측]', JSON.stringify({ r, drop }));
  expect({ libMono: r.libMono, pen: r.pen, fills: r.fills }, '★라이브러리 넣기 = 끌어 놓은 SVG 와 같은 꼴').toEqual(drop);
  expect(r.fills, '★원본 빨강').toEqual(['rgb(229, 72, 77)']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

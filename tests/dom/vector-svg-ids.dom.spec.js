/* vector-svg-ids — 0.9.13 2차 S2 VISUAL-SVG-LIGHT-AUDIT-01 ②(사용자 SVG clip0 충돌) · 현빈 261123 · 태양 · 감사표 #9 ⑴
 *   origin/dev 실측: 아이콘 라이브러리 미리보기·적용(prop-iconify icnp·icn-)과 아이콘 스티커(stk-)는 이미 접두(2f81c0822). 남은 길 = 들여온 SVG 벡터 블럭(그리는 한 자리 renderVector).
 *   고침: js/blocks/vector-block.js renderVector — id 든 SVG 면 블럭 id 접두(vb-<id>-) · 저장 data-svg 무변.
 *   재료 = 지디 QA 표본 35(둥근 네모 clip)·39(원 clip) — 둘 다 clip0_1_2(피그마 «Copy as SVG» 꼴).
 * V1 35·39 를 «들여온 SVG» 문(addVectorFromSvgText)으로 차례로 → 각 벡터의 clip-path 가 제 블럭 안 clipPath · 39 의 틀 = 원(circle) · 문서에서 그 id 하나
 * V2 [지킴] 저장 data-svg 는 원본 그대로(clip0_1_2 · 접두 없음)
 * 양성대조: _patches/vector-ids-CTL.patch(접두 한 줄 되돌림) ⇒ V1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const S35 = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none"><g clip-path="url(#clip0_1_2)"><rect width="96" height="96" rx="20" fill="#1E1E1E"/><path d="M28 64 L48 28 L68 64 Z" fill="#30A46C"/><circle cx="48" cy="54" r="8" fill="#FFFFFF"/></g><defs><clipPath id="clip0_1_2"><rect width="96" height="96" rx="20" fill="white"/></clipPath></defs></svg>';
const S39 = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none"><g clip-path="url(#clip0_1_2)"><rect width="96" height="96" fill="#E5484D"/><rect x="20" y="20" width="56" height="56" fill="#FFE8A3"/></g><defs><clipPath id="clip0_1_2"><circle cx="48" cy="48" r="44" fill="white"/></clipPath></defs></svg>';

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async ([a, b]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec);
    const v1 = window.addVectorFromSvgText(a, '35'); window.deselectAll(); window.selectSection(sec);
    const v2 = window.addVectorFromSvgText(b, '39');
    return [v1.id, v2.id];
  }, [S35, S39]);
  return { errs, ids };
}

test('V1 35·39 — 각자 제 clipPath · 39 틀 = 원 · id 하나씩', async ({ page }) => {
  const { errs, ids } = await scene(page);
  const r = await page.evaluate((ids) => ids.map((id) => {
    const b = document.getElementById(id); const ref = /url\(#([^)]+)\)/.exec(b.querySelector('.vb-inner [clip-path]')?.getAttribute('clip-path') || '')?.[1];
    const cp = ref && document.getElementById(ref);   // 크로미움 = 문서 첫 id
    return { own: !!cp && cp.closest('.vector-block') === b, shape: cp?.firstElementChild?.tagName.toLowerCase() || null, dup: ref ? document.querySelectorAll(`[id="${ref}"]`).length : 0 };
  }), ids);
  console.log('[V1 실측]', JSON.stringify(r));
  expect(r, '★둘 다 제 틀 · 35 = 둥근 네모(rect) · 39 = 원 · 겹침 0').toEqual([{ own: true, shape: 'rect', dup: 1 }, { own: true, shape: 'circle', dup: 1 }]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V2 [지킴] 저장 data-svg 는 원본 id 그대로', async ({ page }) => {
  const { errs, ids } = await scene(page);
  const r = await page.evaluate((ids) => ids.map((id) => /id="clip0_1_2"/.test(document.getElementById(id).dataset.svg || '')), ids);
  expect(r, '★저장본 무변(접두는 그릴 때만)').toEqual([true, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

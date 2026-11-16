/* asset-overlay-paste-1116.dom.spec.js — NEW-현빈QA-ASSET-OVERLAY-COPY-PASTE-01 (현빈 실앱 QA 261116 · 9500)
 *   현빈: «에셋블럭 안의 컴퍼넌트의 경우, 복사 붙여넣기가 안 되네?» — 오버레이 글을 ⌘C → 편집 밖에서 ⌘V = 아무 일 없음.
 *   뿌리(읽기): 붙여넣기 자체는 돈다. 사본이 오버레이 글 표식 .overlay-tb 를 그대로 들고 섹션 흐름에 들어가는데,
 *     그 표식은 css/editor-layout.css 에서 «흰 글자(#fff)·흰 점선 선택»이다 ⇒ 흰 섹션 위에선 글도 선택도 안 보여 «안 붙은 듯».
 *   고침(js/editor.js _bindPastedEl — 붙여넣기·복제가 모두 지나는 한 문): 막(.asset-overlay) 밖에 놓인 .overlay-tb 만 보통 글로.
 *     사본 에셋 «안»의 막 글은 그대로(P3).
 *   현빈 결정 ⓑ 중 «고른 섹션이 있으면 그 섹션에»는 P1 이 잰다. «없으면 스크래치 패드로»는 이 판에 없음 — 스크래치 항목은 그림뿐(보고).
 * 칸
 *   P1 오버레이 글 고름 → ⌘C → 다른 섹션(S2) 고름 → ⌘V = S2 에 그 글 · .overlay-tb 없음 · 글자색 흰색 아님 · 크기 > 0 · 원본 막 글 그대로 1
 *   P2 불변식 — 오버레이 글을 고른 채(편집 안) ⌘V: 사본이 막 «안»이면 .overlay-tb 유지 · 밖이면 없음(자리는 annotation 기록)
 *   P3 음성 — 에셋째 복사 → S2 에 ⌘V = 사본 에셋의 막 글은 .overlay-tb 유지(과하게 벗기는 고침을 잡는다)
 * 양성대조(srv 미실행 · 아이맥): _patches/controls/ASSET-OVERLAY-PASTE-CTL.patch = _bindPastedEl 의 forEach 한 줄 삭제
 *   ⇒ P1 빨강(.overlay-tb 남음 · 색 rgb(255, 255, 255)) · P2·P3 초록.
 * 키는 하네스 브라우저 안 실키(⌘C/⌘V) — 앱·시스템 클립보드 무접촉. ⛔고정 대기 0(조건 대기).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    const sec = (id) => `<div class="section-block" id="${id}" data-section="1" style="background:#ffffff"><div class="section-hitzone"></div><div class="section-inner" id="${id}I">
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="${id}R" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:120px"></div></div></div>`;
    c.insertAdjacentHTML('beforeend', sec('S1') + sec('S2')); window.rebindAll?.();
    window.selectSection(document.getElementById('S1'));
    window.addAssetBlock?.();
    const ab = document.querySelector('#S1 .asset-block'); if (!ab) return null;
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 200; cv.getContext('2d').fillRect(0, 0, 300, 200);
    window.updateAssetBlock(ab.id, { imgSrc: cv.toDataURL('image/png'), overlay: 'true' });
    window.deselectAll(); window.selectBlock(ab.id); window.addTextBlock('body');
    const otb = ab.querySelector('.asset-overlay .overlay-tb'); if (!otb) return { ab: ab.id, otb: null };
    (otb.querySelector('[contenteditable]') || otb).textContent = 'OVTXT';
    window.deselectAll(); document.activeElement?.blur?.();
    return { ab: ab.id, otb: otb.id };
  });
  expect(ids?.otb, '[전제] 오버레이 글 든 에셋(S1)').toBeTruthy();
  return { errs, ...ids };
}

/* OVTXT 글 전수 — 막 안/밖 · 표식 · 보이는 색·크기 */
const census = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .text-block')]
  .filter(tb => /OVTXT/.test(tb.textContent))
  .map(tb => { const ce = tb.querySelector('[contenteditable]') || tb, r = tb.getBoundingClientRect();
    return { sec: tb.closest('.section-block')?.id, inOverlay: !!tb.closest('.asset-overlay'), ovTb: tb.classList.contains('overlay-tb'),
             color: getComputedStyle(ce).color, h: Math.round(r.height), w: Math.round(r.width) }; }));

test('P1 오버레이 글 ⌘C → 다른 섹션 고름 → ⌘V = 그 섹션에 «보이는» 보통 글', async ({ page }) => {
  const { errs, otb } = await setup(page);
  await page.evaluate((id) => { window.selectBlock(id); document.activeElement?.blur?.(); }, otb);
  await page.keyboard.press('Meta+c');
  await page.evaluate(() => { window.deselectAll(); window.selectSection(document.getElementById('S2')); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+v');
  await expect.poll(() => census(page).then(a => a.filter(x => x.sec === 'S2').length), '★S2 에 사본이 안 들어왔다').toBe(1);
  const all = await census(page);
  const pasted = all.find(x => x.sec === 'S2');
  expect(pasted, '★사본이 막 표식(흰 글자)을 그대로 들고 있다 — 흰 섹션 위에서 안 보인다')
    .toMatchObject({ inOverlay: false, ovTb: false });
  expect(pasted.color, '★글자색이 흰색 — 붙었지만 안 보인다').not.toBe('rgb(255, 255, 255)');
  expect(pasted.h > 0 && pasted.w > 0, '크기').toBe(true);
  expect(all.filter(x => x.sec === 'S1' && x.inOverlay && x.ovTb).length, '원본 막 글 그대로').toBe(1);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P2 불변식 — 오버레이 글 고른 채 ⌘V: 막 안이면 표식 유지 · 밖이면 없음', async ({ page }) => {
  const { errs, otb } = await setup(page);
  await page.evaluate((id) => { window.selectBlock(id); document.activeElement?.blur?.(); }, otb);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Meta+v');
  await expect.poll(() => census(page).then(a => a.length), '[전제] 사본 생김').toBe(2);
  const all = await census(page);
  test.info().annotations.push({ type: '실측', description: 'P2 자리 ' + JSON.stringify(all.map(x => ({ sec: x.sec, inOverlay: x.inOverlay, ovTb: x.ovTb }))) });
  for (const x of all) expect(x.ovTb, `표식 = 막 안 여부(${JSON.stringify(x)})`).toBe(x.inOverlay);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P3 음성 — 에셋째 복사·붙여넣기 = 사본 에셋의 막 글은 표식 유지', async ({ page }) => {
  const { errs, ab } = await setup(page);
  await page.evaluate((id) => { window.selectBlock(id); document.activeElement?.blur?.(); }, ab);
  await page.keyboard.press('Meta+c');
  await page.evaluate(() => { window.deselectAll(); window.selectSection(document.getElementById('S2')); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+v');
  await expect.poll(() => census(page).then(a => a.filter(x => x.sec === 'S2').length), '[전제] S2 에 사본 에셋').toBe(1);
  const pasted = (await census(page)).find(x => x.sec === 'S2');
  expect(pasted, '★사본 에셋 안 막 글의 표식까지 벗겼다').toMatchObject({ inOverlay: true, ovTb: true });
  expect(errs, errs.join('\n')).toEqual([]);
});

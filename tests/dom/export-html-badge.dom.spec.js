/* export-html-badge — 행 251. 단독 HTML 내보내기(window.exportHTMLFile, 사람이 누를 입구 0 · 현빈 «두고 검사만» 쪽) 길의 A/B 배지 장면.
 * 파생은 js/io/export-html.js → stripEditorOnlyForCapture(capture-safety.js) 한 벌이다. 이 길을 재는 검사가 0 이었다.
 * 조작 = 제품 함수(addSection·createVariation·exportHTMLFile) · 산출물 = 실제 Blob 글. 파일 저장 없음. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function exported(page) {
  return page.evaluate(async () => {
    let blob = null;
    const oc = URL.createObjectURL; URL.createObjectURL = (b) => { blob = b; return oc.call(URL, b); };
    const ac = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download !== 'export.html') return ac.call(this); };
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ac; }
    return blob ? blob.text() : null;
  });
}
const read = (page, html) => page.evaluate((html) => { const d = new DOMParser().parseFromString(html, 'text/html'); const secs = [...d.querySelectorAll('.section-block')]; return { badges: d.querySelectorAll('.variation-badge').length, secs: secs.length, mark: d.body.textContent.includes('배지시험글'), hidden: d.querySelectorAll('[data-variation-active="0"]').length, labels: d.querySelectorAll('.section-label, .section-toolbar').length, srcHasBadgeClass: d.body.innerHTML.includes('variation-badge') }; }, html);
async function scene(page, variation) {
  await bootApp(page);
  return page.evaluate(async (variation) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block');
    window.deselectAll(); window.selectSection(sec); window._activeFrame = null;
    const b = new Set(sec.querySelectorAll('.text-block')); window.addTextBlock('body');
    const t = [...sec.querySelectorAll('.text-block')].find((x) => !b.has(x)); (t.querySelector('[contenteditable]') || t).textContent = '배지시험글';
    window.deselectAll();
    if (variation) window.createVariation(sec);
    const all = [...c.querySelectorAll('.section-block')];
    return { live: c.querySelectorAll('.variation-badge').length, secs: all.length, shown: all.filter((s) => getComputedStyle(s).display !== 'none').length };
  }, variation);
}
const liveBadges = (page) => page.evaluate(() => document.querySelectorAll('#canvas .variation-badge').length);

test('A/B 시안 섹션을 단독 HTML 로 내보내면 배지가 없고, 쓰는 시안 하나만 글과 함께 남는다', async ({ page }) => {
  const pre = await scene(page, true);
  expect(pre.live, '[전제] 화면에 배지가 있다').toBeGreaterThan(0);
  expect(pre.secs, '[전제] 시안이 둘이다').toBe(2);
  const r = await read(page, await exported(page));
  expect(r).toEqual({ badges: 0, secs: 1, mark: true, hidden: 0, labels: 0, srcHasBadgeClass: false });
});
test('음성: 내보내도 화면의 배지는 그대로다', async ({ page }) => {
  const pre = await scene(page, true);
  await exported(page);
  expect(await liveBadges(page)).toBe(pre.live);
});
test('음성: 시안 없는 섹션도 글이 남는다', async ({ page }) => {
  const pre = await scene(page, false);
  expect(pre.live).toBe(0);
  const r = await read(page, await exported(page));
  expect(r).toEqual({ badges: 0, secs: 1, mark: true, hidden: 0, labels: 0, srcHasBadgeClass: false });
});

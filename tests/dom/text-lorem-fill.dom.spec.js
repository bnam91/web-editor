/* text-lorem-fill — TEXT-LOREM-FILL-01(현빈 261121 · 피그마 «Lorem ipsum» 결): 텍스트 패널 Content 절 «더미 글» → 단어·문장·문단 길이로 글 칸 채우기
 * 고침: js/text-lorem.js(생성 · 순수) · js/props/prop-text-wireup-lorem.js(배선 · 글 자리 = ai-text-slots 정본) · prop-text-template.js Content 절 두 줄
 * F1 보통 글 — 문장 3 «채우기» 진짜 클릭 → 글 = Lorem ipsum… 마침표 3 · 안내문구 표식 뗌 · ⌘Z(undo) 1번 = 옛 글·표식 그대로
 * F2 문단 2 → 줄바꿈(<br>) 으로 문단 2 · 단위를 «단어»로 바꾸면 개수 상한 200
 * F3 불릿 — 문장 4 → li 4(조각마다 한 줄)
 * F4 한글 — 글 «한글» → 한글만(라틴 0)
 * F5 내보내기·저장 — 채운 글이 저장 직렬화 · HTML 내보내기 · Figma JSON 에 실림 · PNG 는 문단 3 으로 높이가 커짐(글이 찍힘)
 * 양성대조: _patches/lorem-CTL.patch(배선의 fillLorem 부르기 걷음) → F1~F5 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, kind) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); c.querySelector('.section-block').id = 'sL'; window.applyZoom?.(100); });
  await waitZoomSettled(page, 100);
  await page.evaluate((kind) => {
    const sec = document.getElementById('sL'); document.getElementById('canvas-wrap').scrollTop = 0; sec.scrollIntoView({ block: 'start' });
    const before = new Set(sec.querySelectorAll('.text-block')); window.deselectAll(); window.selectSection(sec); window.addTextBlock(kind);
    const tb = [...sec.querySelectorAll('.text-block')].find((x) => !before.has(x)); tb.id = 'tbL'; window.clearHistory?.();
  }, kind);
  const xy = await page.evaluate(() => { const e = document.querySelector('#tbL [class^="tb-"]'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + Math.min(20, r.width / 2), r.top + r.height / 2]; });
  await page.mouse.click(xy[0], xy[1]); await raf(page);
  await page.evaluate(() => { if (!document.getElementById('txt-lorem-run')) window.showTextProperties?.(document.getElementById('tbL')); });
  await page.waitForFunction(() => !!document.getElementById('txt-lorem-run'), null, { timeout: 5000 });
  return errs;
}
async function fill(page, { unit, count, lang }) {
  if (unit) await page.selectOption('#txt-lorem-unit', unit);
  if (count) await page.fill('#txt-lorem-count', String(count));
  if (lang) await page.selectOption('#txt-lorem-lang', lang);
  await page.locator('#txt-lorem-run').scrollIntoViewIfNeeded(); await page.click('#txt-lorem-run'); await raf(page);
}
const slot = (page) => page.evaluate(() => { const e = document.querySelector('#tbL .tb-bullet, #tbL .tb-body, #tbL [class^="tb-"]');
  return { text: e.innerText, html: e.innerHTML, ph: e.dataset.isPlaceholder ?? null, li: e.querySelectorAll('li').length, br: e.querySelectorAll('br').length }; });

test('F1 문장 3 채우기 · 표식 뗌 · undo 1번 = 옛 글', async ({ page }) => {
  const errs = await scene(page, 'body');
  const a = await slot(page);
  await fill(page, { unit: 'sentence', count: 3 });
  const b = await slot(page);
  expect(b.text, `★Lorem 으로 시작 ${JSON.stringify(b)}`).toMatch(/^Lorem ipsum /);
  expect((b.text.match(/\./g) || []).length, '★마침표 3(문장 3)').toBe(3);
  expect(b.ph, '★안내문구 표식 뗌').toBe(null);
  await page.evaluate(() => window.undo()); await raf(page);
  const c = await slot(page);
  expect([c.text, c.ph], `★undo 1번 = 옛 글·표식 ${JSON.stringify([a, c])}`).toEqual([a.text, a.ph]);
  expect(errs).toEqual([]);
});

test('F2 문단 2 = 빈 줄로 나뉜 문단 둘 · 단어 단위 상한 200', async ({ page }) => {
  const errs = await scene(page, 'body');
  await fill(page, { unit: 'paragraph', count: 2 });
  const b = await slot(page);
  expect(b.br, `★문단 사이 <br><br> ${b.html.slice(0, 200)}`).toBe(2);
  expect(b.text.split(/\n\s*\n/).filter((x) => x.trim()).length, '★문단 2').toBe(2);
  await page.selectOption('#txt-lorem-unit', 'word');
  expect(await page.getAttribute('#txt-lorem-count', 'max'), '단어 상한').toBe('200');
  expect(errs).toEqual([]);
});

test('F3 불릿 — 문장 4 → li 4', async ({ page }) => {
  const errs = await scene(page, 'bullet');
  await fill(page, { unit: 'sentence', count: 4 });
  const b = await slot(page);
  expect(b.li, `★li 4 ${b.html.slice(0, 200)}`).toBe(4);
  expect(b.text, 'Lorem 으로 시작').toMatch(/^Lorem ipsum /);
  expect(errs).toEqual([]);
});

test('F4 한글 더미 — 한글만', async ({ page }) => {
  const errs = await scene(page, 'body');
  const a = await slot(page);
  await fill(page, { unit: 'sentence', count: 2, lang: 'ko' });
  const b = await slot(page);
  expect([b.text !== a.text, b.ph, (b.text.match(/\./g) || []).length], `★글이 바뀜(안내문구도 한글이라 «한글만»으론 못 가름) · 표식 뗌 · 문장 2 ${JSON.stringify([a.text, b.text])}`).toEqual([true, null, 2]);
  expect([/[가-힣]/.test(b.text), /[A-Za-z]/.test(b.text)], `★한글만 ${b.text}`).toEqual([true, false]);
  expect(errs).toEqual([]);
});

test('F5 저장·HTML·Figma 에 실림 · PNG 높이 커짐', async ({ page }) => {
  const errs = await scene(page, 'body');
  const pngH = () => page.evaluate(async () => { const s = document.getElementById('sL'); const r = await window.__exportGate.captureTruth(s, 860, window.__exportGate.sectionBgColor(s)); return r.canvas.height; });
  const h0 = await pngH();
  await page.evaluate(() => window.showTextProperties?.(document.getElementById('tbL'))); await page.waitForFunction(() => !!document.getElementById('txt-lorem-run'));
  await fill(page, { unit: 'paragraph', count: 3 });
  const b = await slot(page), key = b.text.split('\n')[0].slice(0, 40);
  const out = await page.evaluate(async (key) => {
    let blob = null; const oc = URL.createObjectURL, ok = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function (x) { blob = x; return oc.call(URL, x); }; HTMLAnchorElement.prototype.click = function () { if (!this.download) return ok.call(this); };
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok; }
    const html = blob ? await blob.text() : '';
    const fig = JSON.stringify(await window.buildFigmaExportJSON(['sL']));
    return { save: window.getSerializedCanvas().includes(key), html: html.includes(key), figma: fig.includes(key) };
  }, key);
  expect(out, `★저장·HTML·Figma 에 «${key}»`).toEqual({ save: true, html: true, figma: true });
  const h1 = await pngH();
  expect(h1 > h0, `★PNG 높이 ${h0} → ${h1}(문단 3 이 찍힘 · 두 측정 견줌)`).toBe(true);
  expect(errs).toEqual([]);
});

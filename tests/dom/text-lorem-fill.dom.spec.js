/* text-lorem-fill — TEXT-LOREM-FILL-01(현빈 261121 · 피그마 «Lorem ipsum» 결): 텍스트 패널 Content 절 «더미 글» → 단어·문장·문단 길이로 글 칸 채우기
 * 고침: js/text-lorem.js(생성 · 순수) · js/props/prop-text-wireup-lorem.js(배선 · 글 자리 = ai-text-slots 정본) · prop-text-template.js Content 절 두 줄
 * F1 보통 글 — 문장 3 «채우기» 진짜 클릭 → 글 = Lorem ipsum… 마침표 3 · 안내문구 표식 뗌 · ⌘Z(undo) 1번 = 옛 글·표식 그대로
 * F2 문단 2 → 줄바꿈(<br>) 으로 문단 2 · 단위를 «단어»로 바꾸면 개수 상한 200
 * F3 불릿 — 문장 4 → li 4(조각마다 한 줄)
 * F4 한글 — 글 «한글» → 한글만(라틴 0)
 * F5 내보내기·저장 — 채운 글이 저장 직렬화 · HTML 내보내기 · Figma JSON 에 실림 · PNG 는 문단 3 으로 높이가 커짐(글이 찍힘)
 * 양성대조: _patches/lorem-CTL.patch(배선의 fillLorem 부르기 걷음) → F1~F5 빨강.
 * ★기대 바뀜(174 t13E-08 · 현빈 결정 261125 21:27 «ⓐ 높이 지키기 우선» + 2차 확정 261123 «개수 = 슬라이더 0~최대 · 기본 꽉 · 줄이기만»):
 *   «채우기» = 늘 지금 높이에 꽉(auto 상자는 그 순간 높이를 굳힘) ⇒ 개수는 채운 «뒤» 슬라이더/숫자로 줄인다. 뜻(단위 꼴·한글·내보내기)을 지키려고 장면 = 높이 정한 상자 1400(문단 3 이 들어가게).
 *   F1 ⌘Z = 두 칸(채우기 · 줄이기) · F2 단어 상한 = 지금 높이에 들어가는 최대 · F5 PNG 높이 = 그대로(높이 지키기) · 글이 찍힘 = 그림이 바뀜.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
/* captureTruth(PNG 길)는 electronAPI.captureSectionCdp 로 찍는다 — 하네스 electronAPI 는 «모든 키가 함수»인 Proxy 라 그대로 두면 null → base64,null → ci.onerror(Event).
   CDP Page.captureScreenshot 으로 갈아 끼운다(slide-frame-cells wireCdp 꼴 · 지디 Electron 전수 261122 «page.evaluate: Event» 11건 = 이 배선 빠짐). */
async function wireCdp(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => (await cdp.send('Page.captureScreenshot', {
    format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: scale > 0 && scale <= 4 ? scale : 1 },
    captureBeyondViewport: true, fromSurface: true })).data);
  await page.evaluate(() => { const real = window.electronAPI; window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : real?.[k]) }); });
}

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, kind) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page); await wireCdp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); c.querySelector('.section-block').id = 'sL'; window.applyZoom?.(100); });
  await waitZoomSettled(page, 100);
  await page.evaluate((kind) => {
    const sec = document.getElementById('sL'); document.getElementById('canvas-wrap').scrollTop = 0; sec.scrollIntoView({ block: 'start' });
    const before = new Set(sec.querySelectorAll('.text-block')); window.deselectAll(); window.selectSection(sec); window.addTextBlock(kind);
    const tb = [...sec.querySelectorAll('.text-block')].find((x) => !before.has(x)); tb.id = 'tbL';
    const f = tb.closest('.frame-block[data-text-frame]') || tb; f.dataset.fixedH = '1400'; f.style.minHeight = '1400px';   // ★기대 바뀜(174) — 높이 정한 상자(손잡이가 쓰는 두 키) · 이 안에 넉넉히 들어감
    window.clearHistory?.();
  }, kind);
  const xy = await page.evaluate(() => { const e = document.querySelector('#tbL [class^="tb-"]'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + Math.min(20, r.width / 2), r.top + r.height / 2]; });
  await page.mouse.click(xy[0], xy[1]); await raf(page);
  await page.evaluate(() => { if (!document.getElementById('txt-lorem-run')) window.showTextProperties?.(document.getElementById('tbL')); });
  await page.waitForFunction(() => !!document.getElementById('txt-lorem-run'), null, { timeout: 5000 });
  return errs;
}
async function fill(page, { unit, count, lang }) {
  if (unit) await page.selectOption('#txt-lorem-unit', unit);
  if (lang) await page.selectOption('#txt-lorem-lang', lang);
  await page.locator('#txt-lorem-run').scrollIntoViewIfNeeded(); await page.click('#txt-lorem-run'); await raf(page);   // 채우기 = 지금 높이에 꽉(최대)
  if (count) { const max = Number(await page.getAttribute('#txt-lorem-count', 'max')); expect(max >= count, `[전제] 높이 1400 에 ${count} 이상 들어감(최대 ${max})`).toBe(true); await page.fill('#txt-lorem-count', String(count)); await page.press('#txt-lorem-count', 'Enter'); await page.evaluate(() => document.getElementById('txt-lorem-count')?.dispatchEvent(new Event('change', { bubbles: true }))); await raf(page); }   // 줄이기(숫자 칸 change = 슬라이더와 한 몸)
}
const slot = (page) => page.evaluate(() => { const e = document.querySelector('#tbL .tb-bullet, #tbL .tb-body, #tbL [class^="tb-"]');
  return { text: e.innerText, html: e.innerHTML, ph: e.dataset.isPlaceholder ?? null, li: e.querySelectorAll('li').length, br: e.querySelectorAll('br').length }; });

test('F1 문장 3 채우기 · 표식 뗌 · undo 2번(채우기·줄이기) = 옛 글', async ({ page }) => {
  const errs = await scene(page, 'body');
  const a = await slot(page);
  await fill(page, { unit: 'sentence', count: 3 });
  const b = await slot(page);
  expect(b.text, `★Lorem 으로 시작 ${JSON.stringify(b)}`).toMatch(/^Lorem ipsum /);
  expect((b.text.match(/\./g) || []).length, '★마침표 3(문장 3)').toBe(3);
  expect(b.ph, '★안내문구 표식 뗌').toBe(null);
  await page.evaluate(() => window.undo()); await raf(page);
  const c1 = await slot(page);
  expect((c1.text.match(/\./g) || []).length > 3, '★undo 1번 = 줄이기 전(꽉)').toBe(true);
  await page.evaluate(() => window.undo()); await raf(page);
  const c = await slot(page);
  expect([c.text, c.ph], `★undo 2번 = 옛 글·표식 ${JSON.stringify([a, c])}`).toEqual([a.text, a.ph]);
  expect(errs).toEqual([]);
});

test('F2 문단 2 = 빈 줄로 나뉜 문단 둘 · 단어 단위 = 지금 높이에 들어가는 최대', async ({ page }) => {
  const errs = await scene(page, 'body');
  await fill(page, { unit: 'paragraph', count: 2 });
  const b = await slot(page);
  expect(b.br, `★문단 사이 <br><br> ${b.html.slice(0, 200)}`).toBe(2);
  expect(b.text.split(/\n\s*\n/).filter((x) => x.trim()).length, '★문단 2').toBe(2);
  await page.selectOption('#txt-lorem-unit', 'word'); await raf(page);
  const w = await page.evaluate(() => { const m = window.loremMark(document.getElementById('tbL')); return { mk: m && { u: m.u, n: m.n, m: m.m }, max: document.getElementById('txt-lorem-count').max, val: document.getElementById('txt-lorem-count').value }; });
  expect(w, '★단어로 = 다시 꽉 · 최대 = 지금 높이에 들어가는 낱말 수 · 값 = 최대').toEqual({ mk: { u: 'word', n: w.mk.m, m: w.mk.m }, max: String(w.mk.m), val: String(w.mk.m) });
  expect(w.mk.m > 20, `★낱말 최대가 문단보다 많다(${w.mk.m})`).toBe(true);
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

test('F5 저장·HTML·Figma 에 실림 · PNG 높이 그대로(높이 지키기) · 글이 찍힘', async ({ page }) => {
  const errs = await scene(page, 'body');
  const pngH = () => page.evaluate(async () => { const s = document.getElementById('sL'); const r = await window.__exportGate.captureTruth(s, 860, window.__exportGate.sectionBgColor(s)); const u = r.canvas.toDataURL('image/png'); let h = 0; for (let i = 0; i < u.length; i += 7) h = (h * 31 + u.charCodeAt(i)) | 0; return { h: r.canvas.height, sig: h }; });
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
  expect(h1.h, `★PNG 높이 그대로 ${h0.h} → ${h1.h}(높이 지키기)`).toBe(h0.h);
  expect(h1.sig !== h0.sig, '★PNG 그림이 바뀜 = 글이 찍힘(두 측정 견줌)').toBe(true);
  expect(errs).toEqual([]);
});

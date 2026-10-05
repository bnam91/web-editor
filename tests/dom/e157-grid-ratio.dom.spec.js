/* e157-grid-ratio.dom.spec.js — E157(현빈 「고쳐 그럼」 10-05 · 지디 ⒜ · lane-grid-height) + 제4안 «한 식».
 *
 * 머리표: [새 것] 6287541b(cellPadY 만 · 지디 기준판) 에서 빨강 · [회귀 지킴] 거기서도 초록.
 * ★이 검사가 트랙 높이 = base + 2×cellPadY 한 식임을 증명한다(B1 — 정한 높이 행 + 배경 이미지 행 + cellPadY 한 장면).
 * 고침 = grid-block.js gridTrackMin(한 식) · 비율 캐시 + 다시 그림 · whenGridRatiosSettled(공용 대기) · 그림 줄 네이티브(크롭 없을 때).
 * 내보내기 입구 기다림(W*) = «산출물이 다 선 높이를 지니나»로 잰다(부른 횟수가 아니다 — 대기 함수 본문을 비우면 빨개져야 한다).
 * 장면 그림 = 매번 새 data URL(캐시 안 걸리게 · 800×500 = 원 비율 0.625). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) { await page.setViewportSize({ width: 1600, height: 1400 }); return bootApp(page); }
/** 새 그림(캐시 밖) + 섹션 하나 + 그리드 하나 — rows/cells/cols 를 받아 만든다. 반환: 그리드 id */
const mk = (page, opts) => page.evaluate((opts) => {
  const cv = document.createElement('canvas'); cv.width = 800; cv.height = 500; const g = cv.getContext('2d'); g.fillStyle = `rgb(${Math.random() * 255 | 0},90,120)`; g.fillRect(0, 0, 800, 500);
  const IMG = cv.toDataURL('image/png');
  const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
  c.insertAdjacentHTML('beforeend', '<div class="section-block" id="eS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="row" id="eR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>');
  const o = JSON.parse(JSON.stringify(opts).replaceAll('__IMG__', IMG));
  const { block: gb } = window.makeGridBlock(o); gb.id = 'eG'; document.getElementById('eR').appendChild(gb); window.rebindAll?.(); window.renderGridBlock(gb); window.applyZoom?.(100);
  return 'eG';
}, opts);
const rowsPx = (page) => page.evaluate(() => [...document.querySelectorAll('#eG > .grd-inner > .grd-cell[data-c="0"]')].map(c => Math.round(c.getBoundingClientRect().height)));
const cellW = (page, r, c) => page.evaluate(([r, c]) => document.querySelector(`#eG > .grd-inner > .grd-cell[data-r="${r}"][data-c="${c}"]`).clientWidth, [r, c]);
const BGROW = (Y) => ({ cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }] }, { width: 1, lines: [{ type: 'body', text: 'b' }] }], rows: [{ height: 300 }], cells: [[{ lines: [{ type: 'body', text: '배경 칸' }], bgImg: '__IMG__', bgFit: 'cover' }, {}]], ...(Y ? { cellPadY: Y } : {}) });

test('E1 [새 것] 그림 줄 높이 키 200(크롭 없음) — 그릴 때 무시 · 비율 그대로(0.625) · 잘림 0 · 저장 키 그대로', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, { cols: [{ width: 1, lines: [{ type: 'image', imgSrc: '__IMG__', height: 200 }] }, { width: 1, lines: [{ type: 'body', text: 'x' }] }] });
  await page.waitForFunction(() => { const i = document.querySelector('#eG .grd-img'); return i && i.complete && i.naturalWidth > 0; });
  const r = await page.evaluate(() => { const f = document.querySelector('#eG .grd-img-frame'); const i = f.querySelector('img'); const F = f.getBoundingClientRect(), I = i.getBoundingClientRect();
    return { frameRatio: +(F.height / F.width).toFixed(3), imgRatio: +(I.height / I.width).toFixed(3), cropped: I.height > F.height + 0.5 || getComputedStyle(i).objectFit === 'cover', key: JSON.parse(document.getElementById('eG').dataset.cols)[0].lines[0].height }; });
  expect(r, JSON.stringify(r)).toEqual({ frameRatio: 0.625, imgRatio: 0.625, cropped: false, key: 200 });
  expect(errs).toEqual([]);
});
test('E3 [새 것] 칸 배경 이미지 행(높이 키 300) — 디코드 뒤 행 = 칸 폭 × 0.625 · whenGridRatiosSettled = settled', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, BGROW(0));
  const st = await page.evaluate(() => window.whenGridRatiosSettled());
  expect(st.status, JSON.stringify(st)).toBe('settled');
  const w = await cellW(page, 0, 0);
  expect((await rowsPx(page))[0], `칸 폭 ${w}`).toBe(Math.round(w * 0.625));
  expect(await page.evaluate(() => window.whenGridRatiosSettled()), '다 선 뒤 = 기다릴 것 없음').toEqual({ status: 'none' });
  expect(errs).toEqual([]);
});
test('E4 [새 것] 정한 높이 행 H120 + cellPadY 30(배경 없음) → 행 180(옛 130 — 여백이 남는 자리에 먹혔다)', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, { cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }] }], rows: [{ height: 120 }], cellPadY: 30 });
  expect((await rowsPx(page))[0]).toBe(180);
  expect(errs).toEqual([]);
});
test('B1 [새 것] ★이 검사가 트랙 높이 = base + 2×cellPadY 한 식임을 증명한다 — 정한 높이 행 + 배경 이미지 행 + cellPadY 20 한 장면', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, { cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }] }, { width: 1, lines: [{ type: 'body', text: 'b' }] }], rows: [{ height: 120 }, { height: 300 }, { height: 'auto' }],
    cells: [[{}, {}], [{ bgImg: '__IMG__', bgFit: 'cover' }, {}], [{}, {}]], cellPadY: 20 });
  await page.evaluate(() => window.whenGridRatiosSettled());
  const w = await cellW(page, 1, 0);
  const rp = await rowsPx(page);
  const want = [await page.evaluate(() => window.gridTrackMin(120, null, 20)), await page.evaluate((w) => window.gridTrackMin(300, Math.round(w * 0.625), 20), w)];
  expect([rp[0], rp[1]], `행 = 한 식 ${JSON.stringify({ rp, want, w })}`).toEqual(want);
  expect(want, '식 값 그대로(120+40 · 칸폭×0.625+40)').toEqual([160, Math.round(w * 0.625) + 40]);
  expect(errs).toEqual([]);
});
test('N1 [회귀 지킴] 배경 칸 없는 문서 — whenGridRatiosSettled = none(기다릴 것 없음 ≠ 다 됨)', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, { cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }] }] });
  expect(await page.evaluate(() => window.whenGridRatiosSettled())).toEqual({ status: 'none' });
  expect(errs).toEqual([]);
});
/* ── 내보내기 입구 기다림 — «바로 부른» 산출물이 다 선 높이를 지니나 ── */
const settledRow0 = async (page) => { const w = await cellW(page, 0, 0); return Math.round(w * 0.625); };
test('W1 [새 것] prepareCloneForCapture(섹션 PNG/JPG/GIF · MCP export · export-gate) — 넣자마자 불러도 클론 행 = 다 선 높이', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, BGROW(0));
  const tpl = await page.evaluate(async () => { const m = await import(new URL('js/io/export-image.js', location.href).href); const clone = await m.prepareCloneForCapture(document.getElementById('eS'), 860, false); const t = clone.querySelector('.grd-inner').style.gridTemplateRows; clone.remove?.(); return t; });
  expect(tpl, '클론의 행 트랙').toBe(`minmax(${await settledRow0(page)}px, auto)`);
  expect(errs).toEqual([]);
});
test('W2 [새 것] 썸네일(captureThumbnail) — 넣자마자 불러도 html2canvas 가 받은 클론 행 = 다 선 높이', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, BGROW(0));
  const tpl = await page.evaluate(async () => { let got = null; const o = window.html2canvas; window.html2canvas = async (el, opt) => { const g = el.querySelector?.('.grd-inner'); got = g ? g.style.gridTemplateRows : null; const cv = document.createElement('canvas'); cv.width = 2; cv.height = 2; return cv; };
    try { await window.saveProjectToFile?.(); } finally { window.html2canvas = o; } return got; });   // captureThumbnail 은 window 에 없다 — 저장(saveProjectToFile)이 부른다
  expect(tpl, '썸네일 클론의 행 트랙(저장이 썸네일을 안 찍으면 null — 전제)').toBe(`minmax(${await settledRow0(page)}px, auto)`);
  expect(errs).toEqual([]);
});
test('W3 [새 것] 단독 HTML(exportHTMLFile) — 넣자마자 내보내도 HTML 안 행 = 다 선 높이', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, BGROW(0));
  const html = await page.evaluate(async () => { let txt = null; const oc = URL.createObjectURL; URL.createObjectURL = (b) => { b.text().then(t => { txt = t; }); return 'blob:x'; }; const oa = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = oa; } for (let i = 0; i < 50 && txt === null; i++) await new Promise(r => setTimeout(r, 20)); return txt || ''; });
  expect(html.includes(`minmax(${await settledRow0(page)}px, auto)`), '★HTML 에 다 선 행 높이').toBe(true);
  expect(errs).toEqual([]);
});
test('W4 [새 것] 피그마 JSON(exportFigmaJSON) — 넣자마자 내보내도 그리드 높이 = 다 선 높이', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, BGROW(0));
  const r = await page.evaluate(async () => { let txt = null; const oc = URL.createObjectURL; URL.createObjectURL = (b) => { b.text().then(t => { txt = t; }); return 'blob:x'; }; const oa = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportFigmaJSON(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = oa; } for (let i = 0; i < 50 && txt === null; i++) await new Promise(r => setTimeout(r, 20));
    const j = JSON.parse(txt || '{}'); const find = (o) => { if (!o || typeof o !== 'object') return null; if (o.id === 'eG') return o; for (const v of Object.values(o)) { const f = find(v); if (f) return f; } return null; }; const g = find(j);
    return { h: g ? g.height : null, live: Math.round(document.getElementById('eG').getBoundingClientRect().height) }; });
  expect(r.h, `피그마 그리드 높이 = 다 선 라이브 높이 ${JSON.stringify(r)}`).toBe(r.live);
  expect(errs).toEqual([]);
});

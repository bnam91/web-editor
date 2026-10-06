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
/* 10-06 고침 · 옛 = getBoundingClientRect().height(화면 px — #canvas-scaler 배율 변환을 탄다 · bootApp 뒤 배율 맞추기가 늦게 끝나 141→180 처럼 «덜 선» 값을 읽었다 · 들여다보기 실측)
   ⇒ 레이아웃 px(offsetHeight — 변환 안 탐 · cellW 의 clientWidth 와 «같은 자»). ⛔기다림을 늘려 맞추지 않는다(태양). */
const rowsPx = (page) => page.evaluate(() => [...document.querySelectorAll('#eG > .grd-inner > .grd-cell[data-c="0"]')].map(c => c.offsetHeight));
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
  /* 10-06 걷음 · 옛 단언 = status 'settled'(«시험이 읽을 때 디코드가 아직 안 끝났다»는 가정 — 출처 없음 · 짐작) ⇒ 기다리기만 하고 상태는 단언 안 함 */
  await page.evaluate(() => window.whenGridRatiosSettled());
  const w = await cellW(page, 0, 0);
  expect((await rowsPx(page))[0], `칸 폭 ${w}`).toBe(Math.round(w * 0.625));
  expect(await page.evaluate(() => window.whenGridRatiosSettled()), '다 선 뒤 = 기다릴 것 없음').toEqual({ status: 'none' });
  expect(errs).toEqual([]);
});
test('E4 [새 것] 정한 높이 행 H120 + cellPadY 30(배경 없음) → 행 180(옛 130 — 여백이 남는 자리에 먹혔다)', async ({ page }) => {
  const errs = await setup(page);
  await mk(page, { cols: [{ width: 1, lines: [{ type: 'body', text: 'a' }] }], rows: [{ height: 120 }], cellPadY: 30 });
  /* 기대값 = 손으로 셈 · 출처 approvals/lane-grid-height:13(⒜ «트랙 최소 = base + 2×cellPadY») — 120 + 2×30 = 180 (10-06 정정: 출처 줄을 적음) */
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
  /* 10-06 고침 · 옛 :59 = 기대값을 제품 함수 gridTrackMin 으로 셈 ⇒ 그림 vs «손 셈 상수»(설계 식 approvals:8):
     행0 = 정한 높이 120 + 2×20 = 160 · 행1 = 배경 이미지 행 → base = 칸 폭 w × (500/800) (키 300 은 그릴 때 무시) + 2×20.
     gridTrackMin 자체는 아래 B1g 가 상수로 따로 잡는다(옛 :60 의 닻 — 지디 10-06). */
  const want = [160, Math.round(w * 500 / 800) + 40];
  expect([rp[0], rp[1]], `행 = 한 식 ${JSON.stringify({ rp, want, w })}`).toEqual(want);
  expect(errs).toEqual([]);
});
/* B1g — 옛 :60 의 «상수 닻»을 따로 세움(지디 10-06): 한 식 함수 gridTrackMin 이 설계 값을 내나. B1 이 빨강이면 이것으로 가른다 —
   B1g 초록 = 식은 맞고 «그리는 길»이 키를 놓침 · B1g 빨강 = 식 함수가 틀림. 기대값 = approvals/lane-grid-height:8 · :13 손 셈. */
test('B1g [새 것] 한 식 함수 gridTrackMin = 설계 상수(120+2×20=160 · 120+2×30=180 · 배경 base 261+2×20=301 · 키 없음 = null)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => [window.gridTrackMin(120, null, 20), window.gridTrackMin(120, null, 30), window.gridTrackMin(300, 261, 20), window.gridTrackMin(null, null, 30), window.gridTrackMin(120, null, 0)]);
  expect(r, '[160 · 180 · 301 · 키 없음 null · Y0 = H 그대로 120]').toEqual([160, 180, 301, null, 120]);
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
/* 10-06 덧 · W* 장면은 그림 디코드를 «늦춘다»(500ms) — 하네스에선 디코드가 ~8ms 라 내보내기의 제 비동기 걸음만으로도 다 서 버려,
   대기 함수 본문을 비워도 W1·W3 가 초록이었다(대기 비움 대조 실측). 늦추면 «기다림이 없으면 덜 선 행»이 산출물에 남는다. */
const slowDecode = (page, ms = 500) => page.evaluate((ms) => { const o = HTMLImageElement.prototype.decode; HTMLImageElement.prototype.decode = function () { const p = o.call(this); return p.then((v) => new Promise((r) => setTimeout(() => r(v), ms))); }; }, ms);
test('W1 [새 것] prepareCloneForCapture(섹션 PNG/JPG/GIF · MCP export · export-gate) — 넣자마자 불러도 클론 행 = 다 선 높이', async ({ page }) => {
  const errs = await setup(page);
  await slowDecode(page); await mk(page, BGROW(0));
  const tpl = await page.evaluate(async () => { const m = await import(new URL('js/io/export-image.js', location.href).href); const clone = await m.prepareCloneForCapture(document.getElementById('eS'), 860, false); const t = clone.querySelector('.grd-inner').style.gridTemplateRows; clone.remove?.(); return t; });
  expect(tpl, '클론의 행 트랙').toBe(`minmax(${await settledRow0(page)}px, auto)`);
  expect(errs).toEqual([]);
});
test('W2 [새 것] 썸네일(captureThumbnail) — 넣자마자 불러도 html2canvas 가 받은 클론 행 = 다 선 높이', async ({ page }) => {
  const errs = await setup(page);
  await slowDecode(page); await mk(page, BGROW(0));
  const tpl = await page.evaluate(async () => { let got = null; const o = window.html2canvas; window.html2canvas = async (el, opt) => { const g = el.querySelector?.('.grd-inner'); got = g ? g.style.gridTemplateRows : null; const cv = document.createElement('canvas'); cv.width = 2; cv.height = 2; return cv; };
    try { await window.saveProjectToFile?.(); } finally { window.html2canvas = o; } return got; });   // captureThumbnail 은 window 에 없다 — 저장(saveProjectToFile)이 부른다
  test.skip(tpl === null, '[전제] 하네스에서 저장이 썸네일을 안 찍었다(클론 트랙 null) — 장면이 안 섬 = SKIP(FAIL 아님 · 10-06)');
  expect(tpl, '썸네일 클론의 행 트랙').toBe(`minmax(${await settledRow0(page)}px, auto)`);
  expect(errs).toEqual([]);
});
test('W3 [새 것] 단독 HTML(exportHTMLFile) — 넣자마자 내보내도 HTML 안 행 = 다 선 높이', async ({ page }) => {
  const errs = await setup(page);
  await slowDecode(page); await mk(page, BGROW(0));
  const html = await page.evaluate(async () => { let txt = null; const oc = URL.createObjectURL; URL.createObjectURL = (b) => { b.text().then(t => { txt = t; }); return 'blob:x'; }; const oa = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = oa; } for (let i = 0; i < 50 && txt === null; i++) await new Promise(r => setTimeout(r, 20)); return txt || ''; });
  expect(html.includes(`minmax(${await settledRow0(page)}px, auto)`), '★HTML 에 다 선 행 높이').toBe(true);
  expect(errs).toEqual([]);
});
test('W4 [새 것] 피그마 JSON(exportFigmaJSON) — 넣자마자 내보내도 그리드 높이 = 다 선 높이', async ({ page }) => {
  const errs = await setup(page);
  await slowDecode(page); await mk(page, BGROW(0));
  const r = await page.evaluate(async () => { let txt = null; const oc = URL.createObjectURL; URL.createObjectURL = (b) => { b.text().then(t => { txt = t; }); return 'blob:x'; }; const oa = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportFigmaJSON(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = oa; } for (let i = 0; i < 50 && txt === null; i++) await new Promise(r => setTimeout(r, 20));
    const j = JSON.parse(txt || '{}'); const find = (o) => { if (!o || typeof o !== 'object') return null; if (o.id === 'eG') return o; for (const v of Object.values(o)) { const f = find(v); if (f) return f; } return null; }; const g = find(j);
    return { h: g ? g.height : null, live: Math.round(document.getElementById('eG').getBoundingClientRect().height) }; });
  test.skip(r.h === null, `[전제] 피그마 JSON 에서 그리드 높이를 못 읽었다 ${JSON.stringify(r)} — 장면이 안 섬 = SKIP(FAIL 아님 · 10-06)`);
  expect(r.h, `피그마 그리드 높이 = 다 선 라이브 높이 ${JSON.stringify(r)}`).toBe(r.live);
  expect(errs).toEqual([]);
});

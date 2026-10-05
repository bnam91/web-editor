/* grid-cell-bg-image.dom.spec.js — G4 「각 칸 배경 이미지 채우기」(지디 승인 2026-10-04).
 *
 * ★재는 것: 칸 JSON 필드 bgImg·bgFit·bgPos 가 «칸 style 의 계산된 배경»으로 나오나 · 쌓임 픽셀(칸 색·G12 띠·칸 테두리·글자) ·
 *   패널(진짜 마우스 · 자산 길 = goya-asset URL · 폴백 = data URL) · ⌘Z · 저장 왕복 · 단독 HTML · PNG 두 길(CDP 클론 스크린샷 · html2canvas) ·
 *   MCP 입구 계약 · E57 지우기 꼴 · E64 교차(G12·G15·G2-b·G14) · 새 칸 상속 0 · 「X 와 같은 규칙」 대조(E68).
 * ★양성대조: GD1001_ROOT=<6119145c 체크아웃> 에서 C* 빨강 · P0 초록이어야 한다(⛔HEAD 금지).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/grid-cell-bg-image.dom.spec.js */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT } = require('./_root-harness.js');

const RED = '#ff0000', BLUE = '#0000ff', GREEN = '#00ff00', BG12 = '#2f3d57';

async function px(page, pts) {
  const buf = await page.screenshot();
  return page.evaluate(async ({ b64, pts }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return pts.map(([X, Y]) => { const d = x.getImageData(Math.round(X), Math.round(Y), 1, 1).data;
      return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join(''); });
  }, { b64: buf.toString('base64'), pts });
}

/* 장면(줌 100%): 섹션 안 2×2 그리드 gG(칸 간격 24). 칸 글자는 행 0 = 'A','B' · 행 1 = 'C','D'. */
async function setup(page, boot = bootApp) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await boot(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="gI" style="padding-left:60px;padding-right:60px">
      <div class="gap-block" data-type="gap" style="height:80px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:300px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({
      cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }],
      rows: [{ height: 160 }, { height: 160 }],
      cells: [[{ lines: [{ type: 'body', text: 'A' }] }, { lines: [{ type: 'body', text: 'B' }] }], [{ lines: [{ type: 'body', text: 'C' }] }, { lines: [{ type: 'body', text: 'D' }] }]],
    });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
    window.applyZoom?.(100);
    /* 시험 그림: 1×1 초록 PNG(data URL) — 캔버스로 만든다(바이트를 손으로 안 적는다). */
    const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1; const x = cv.getContext('2d'); x.fillStyle = '#00ff00'; x.fillRect(0, 0, 1, 1);
    window.__IMG = cv.toDataURL('image/png');
  });
  await page.waitForTimeout(250);
  return errs;
}
const IMG = (page) => page.evaluate(() => window.__IMG);
const updRaw = (page, id, partial, opts) => page.evaluate(([id, p, o]) => window.updateGridBlock(id, p, o), [id, partial, opts]);
const upd = async (page, id, partial, opts) => { const r = await updRaw(page, id, partial, opts); expect(r && r.ok, `updateGridBlock(${JSON.stringify(partial).slice(0, 140)}) → ${JSON.stringify(r).slice(0, 300)}`).toBe(true); return r; };
const cellCss = (page, r, c) => page.evaluate(([r, c]) => { const e = document.querySelector(`#gG .grd-cell[data-r="${r}"][data-c="${c}"]`); const cs = getComputedStyle(e);
  return { img: cs.backgroundImage, size: cs.backgroundSize, pos: cs.backgroundPosition, color: cs.backgroundColor, attr: e.getAttribute('style') || '' }; }, [r, c]);
const cellRect = (page, r, c) => page.evaluate(([r, c]) => { const e = document.querySelector(`#gG .grd-cell[data-r="${r}"][data-c="${c}"]`); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, h: q.height }; }, [r, c]);
const model = (page) => page.evaluate(() => JSON.parse(document.getElementById('gG').dataset.cells || '[]'));

/* ══ P0 전제 — 핀(6119145c)에서도 초록 ══ */
test('P0 전제 — 칸 style 에 배경 이미지 없음 · 「칸 꾸미기」 기본 접힘 · 프리로드에 assetsSaveCanvasImage · 에셋 fit 명부 = cover/contain', async ({ page }) => {
  const errs = await setup(page);
  const css = await cellCss(page, 0, 0);
  expect(css.img).toBe('none');
  const preload = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');
  expect(preload.includes('assetsSaveCanvasImage'), '자산 길(IPC)이 있다').toBe(true);
  const bf = fs.readFileSync(path.join(ROOT, 'js/block-factory.js'), 'utf8');
  expect(bf.includes("_enum('fit', ['cover', 'contain'])"), '에셋 fit 명부 = cover/contain').toBe(true);
  const pg = fs.readFileSync(path.join(ROOT, 'js/props/prop-grid.js'), 'utf8');
  expect(/const open = _grdSecOpen\(block, 'cell'\);/.test(pg), '칸 꾸미기는 기본 접힘(_grdSecOpen 기본 false)').toBe(true);
  expect(errs).toEqual([]);
});

/* ══ C — 기능(핀에서는 빨강) ══ */
test('C1 ★patchCell bgImg/bgFit/bgPos → 칸 계산 배경 · 칸 색 유지(축약 순서) · 다른 칸 무변 · 열 기본값(patchCol)도 같은 규칙', async ({ page }) => {
  await setup(page);
  const img = await IMG(page);
  await upd(page, 'gG', { patchCell: { r: 0, c: 0, bg: RED } });
  await upd(page, 'gG', { patchCell: { r: 0, c: 0, bgImg: img, bgFit: 'contain', bgPos: 'right bottom' } });
  const a = await cellCss(page, 0, 0);
  expect(a.img).toContain('data:image/png');
  expect(a.size).toBe('contain');
  expect(a.pos).toBe('100% 100%');
  expect(a.color, '★칸 배경색이 남아 있다 — 축약(background:) 이 이미지 «앞»').toBe('rgb(255, 0, 0)');
  expect(a.attr, '⛔background 축약에 이미지를 싣지 않는다(HTML 내보내기 규약)').toMatch(/background-image:\s*url/);
  expect(a.attr).not.toMatch(/background:\s*url/);
  expect((await cellCss(page, 0, 1)).img, '다른 칸은 그대로').toBe('none');
  expect((await model(page))[0][0]).toMatchObject({ bgImg: img, bgFit: 'contain', bgPos: 'right bottom' });
  // 열 기본값 — 칸 배경색과 같은 pick 규칙(열에 주면 그 열의 «자기 값 없는» 칸이 따른다)
  await upd(page, 'gG', { patchCol: { index: 1, bgImg: img } });
  expect((await cellCss(page, 0, 1)).img, '열 기본값 → 행 0').toContain('data:image');
  expect((await cellCss(page, 1, 1)).img, '열 기본값 → 행 1').toContain('data:image');
  await upd(page, 'gG', { patchCell: { r: 1, c: 1, bgImg: '' } });
  expect((await cellCss(page, 1, 1)).img, "'' = 열 기본값을 «끄는» 강제값").toBe('none');
  await upd(page, 'gG', { patchCell: { r: 1, c: 1, bgImg: null } });
  expect((await cellCss(page, 1, 1)).img, 'null = 키 지움 → 열 기본값으로').toContain('data:image');
});

test('C2 ★쌓임 픽셀 — contain 1:1 그림 = 가운데 정사각 초록 · 나머지 칸 색 · 글자 위 · 칸 테두리 위 · G12 띠 위(칸이 위)', async ({ page }) => {
  /* ★⑵ 장면 바꿈(10-06 · E157 ⒜) — 옛 장면이 잠근 것(한 줄): «쌓임 순서 — 그림은 칸 색 위 · 칸 테두리는 그림·색 위 · 블럭 띠는 칸 아래 · 그림 밖엔 칸 색».
     옛 장면(정한 높이 160 행 + contain 1:1)은 E157 뒤 행이 «칸 폭 × 비율»(160 → 358 · 실측)로 커져 contain 이 칸을 다 채운다 — «그림 밖»이 없다(P[1] 초록).
     E157 아래선 그림 비율이 무엇이든 행이 그 비율로 서므로, «그림 밖»은 «내용이 행을 더 키울 때»만 생긴다 ⇒ 새 장면 = 가로 4:1 그림(행 바닥 = 칸 폭 × ¼) + 그 칸 줄 다섯(내용이 행을 키움).
     네 점·네 단언은 그대로(같은 쌓임을 잠근다). 지운 단언 0 · 바꾼 것 = 그림(1:1 → 4:1)과 그 칸 줄 수. */
  await setup(page);
  const img = await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 1; const x = cv.getContext('2d'); x.fillStyle = '#00ff00'; x.fillRect(0, 0, 4, 1); return cv.toDataURL('image/png'); });
  await upd(page, 'gG', { blockBg: { on: true, color: BG12, padY: 30, padX: 30 } });
  await upd(page, 'gG', { cellBorderWidth: 3, cellBorderColor: BLUE });
  await upd(page, 'gG', { patchCell: { r: 1, c: 0, lines: ['C', 'C', 'C', 'C', 'C'].map(t => ({ type: 'body', text: t })) } });
  await upd(page, 'gG', { patchCell: { r: 1, c: 0, bg: RED, bgImg: img, bgFit: 'contain' } });
  await page.evaluate(() => window.whenGridRatiosSettled?.());
  const q = await cellRect(page, 1, 0);
  const cx = (q.l + q.r) / 2, cy = (q.t + q.b) / 2;
  const glyph = await page.evaluate(() => { const l = document.querySelector('#gG .grd-cell[data-r="1"][data-c="0"] .grd-line'); const r = l.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  const P = await px(page, [[cx, cy], [q.l + 6, q.t + 8], [q.l + 1, cy], [q.l - 15, cy]]);
  console.log(`[C2] cell=${JSON.stringify(q)} px=${P.join(',')}`);
  expect(P[0], '가운데 = 그림(contain 4:1 → 칸 폭만한 가로 띠 · 세로 가운데)').toBe(GREEN);
  expect(P[1], '그림 밖 칸 = 칸 배경색(그림 «아래»)').toBe(RED);
  expect(P[2], '칸 테두리(왼쪽 3px)가 그림·색 «위»').toBe(BLUE);
  expect(P[3], '칸 사이/블럭 밖 띠 = G12 블럭 배경(칸 아래 층)').toBe(BG12);
  expect(glyph.w, '글자 줄이 있다(전제)').toBeGreaterThan(0);
  const dark = await page.evaluate(() => getComputedStyle(document.querySelector('#gG .grd-cell[data-r="1"][data-c="0"] .grd-line')).color);
  console.log(`[C2] 이미지 칸 글자색 = ${dark} (G5 톤 = 못 잼 → 역할색)`);
});

test('C3 ★패널(진짜 마우스) — 자산 길: goya-asset URL 만 칸에(data URL 아님) · 폴백: data URL · Fit/위치 단추 = 에셋·G12 와 같은 꼴·값 · data-align 없음', async ({ page }) => {
  await setup(page);
  // 가짜 IPC — 자산 저장이 URL 을 돌려준다(main 의 assets:saveCanvasImage 대역)
  await page.evaluate(() => { window.__saved = []; window.activeProjectId = 'proj_g4test';
    window.electronAPI = new Proxy({ assetsSaveCanvasImage: async (a) => { window.__saved.push({ pid: a.projectId, mime: a.mime, n: (a.b64 || '').length }); return { ok: true, url: 'goya-asset://proj_g4test/abc123.png' }; } },
      { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }); });
  const pick = async (r, c) => {
    const [x, y] = await page.evaluate(() => { const g = document.getElementById('gG'); g.scrollIntoView({ block: 'center' }); const q = g.getBoundingClientRect(); return [q.left + 6, q.top + 6]; });
    await page.mouse.click(x, y); await page.waitForTimeout(250);
    const [lx, ly] = await page.evaluate(([r, c]) => { const l = document.querySelector(`#gG .grd-cell[data-r="${r}"][data-c="${c}"] .grd-line`); const q = l.getBoundingClientRect(); return [q.left + 3, q.top + q.height / 2]; }, [r, c]);
    await page.mouse.click(lx, ly); await page.waitForTimeout(300);
  };
  const openCell = async () => { const open = await page.evaluate(() => getComputedStyle(document.getElementById('grd-cell-body')).display !== 'none'); if (!open) { await page.click('#grd-cell-toggle'); await page.waitForTimeout(200); } };
  await pick(0, 0); await openCell();
  expect(await page.evaluate(() => !!document.getElementById('grd-cell-img-btn')), '「이미지」 줄이 있다').toBe(true);
  const fileP = path.join(require('os').tmpdir(), `g4-${process.pid}.png`);
  fs.writeFileSync(fileP, Buffer.from((await IMG(page)).split(',')[1], 'base64'));
  await page.setInputFiles('#grd-cell-img-input', fileP);
  await page.waitForTimeout(500);
  const m1 = await model(page);
  expect(m1[0][0].bgImg, '★자산 길 — 칸엔 goya-asset URL 만').toBe('goya-asset://proj_g4test/abc123.png');
  expect(await page.evaluate(() => window.__saved.length), 'IPC 가 한 번 불렸다').toBe(1);
  expect(JSON.stringify(m1).includes('data:image'), '★칸 JSON 에 base64 가 없다').toBe(false);
  // Fit 단추 = 에셋 #asset-fit-group 과 «같은» 꼴(글자·값·클래스) — E68 대조
  const fit = await page.evaluate(() => [...document.querySelectorAll('#grd-cell-fit-group button')].map(b => ({ t: b.textContent.trim(), v: b.dataset.cellFit, cls: b.className.replace(' active', '') })));
  const asset = fs.readFileSync(path.join(ROOT, 'js/props/prop-asset.js'), 'utf8');
  const assetFit = [...asset.matchAll(/data-fit="(cover|contain)" title="([^"]+)">([^<]+)</g)].map(m => ({ t: m[3], v: m[1], cls: 'prop-align-btn' }));
  expect(fit, '★Fit 단추 = 에셋 Fit 단추와 같은 글자·값·클래스').toEqual(assetFit);
  // 위치 단추 = G12 위치 단추와 같은 SVG(ALIGN_ICONS) · data-align 없음
  const icons = await page.evaluate(async () => {
    const { ALIGN_ICONS } = await import('/js/props/_helpers.js');
    const norm = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.firstElementChild.outerHTML; };
    return { x: [...document.querySelectorAll('#grd-cell-pos-x button svg')].map(s => s.outerHTML), y: [...document.querySelectorAll('#grd-cell-pos-y button svg')].map(s => s.outerHTML),
      ex: ['left', 'center', 'right'].map(k => norm(ALIGN_ICONS['object-h'][k])), ey: ['top', 'middle', 'bottom'].map(k => norm(ALIGN_ICONS['object-v'][k])),
      da: document.querySelectorAll('#grd-cell-body [data-align]').length };
  });
  expect(icons.x).toEqual(icons.ex); expect(icons.y).toEqual(icons.ey);
  expect(icons.da, '⛔data-align 이 붙으면 텍스트 정렬 배선이 잡는다').toBe(0);
  await page.click('#grd-cell-fit-group [data-cell-fit="contain"]'); await page.waitForTimeout(250);
  await openCell();
  await page.click('#grd-cell-pos-x [data-cpos-x="left"]'); await page.waitForTimeout(250);
  await openCell();
  await page.click('#grd-cell-pos-y [data-cpos-y="top"]'); await page.waitForTimeout(250);
  expect((await model(page))[0][0]).toMatchObject({ bgFit: 'contain', bgPos: 'left top' });
  // 폴백 — IPC 가 없으면 data URL
  await page.evaluate(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
  await pick(1, 1); await openCell();
  await page.setInputFiles('#grd-cell-img-input', fileP);
  await page.waitForTimeout(500);
  expect(String((await model(page))[1][1].bgImg || '').startsWith('data:image/png'), '폴백 = data URL(저장 때 외부화)').toBe(true);
  // 이미지 제거
  await openCell();
  await page.click('#grd-cell-img-clear'); await page.waitForTimeout(250);
  expect('bgImg' in (await model(page))[1][1], '제거 = 키 지움').toBe(false);
  fs.unlinkSync(fileP);
});

test('C4 ⌘Z 한 걸음 · 저장 왕복 · 단독 HTML · MCP 입구 계약 · 「X 와 같은 규칙」 대조(위치·URL = G12 · fit = 에셋)', async ({ page }) => {
  await setup(page);
  const img = await IMG(page);
  await upd(page, 'gG', { patchCell: { r: 0, c: 1, bgImg: img, bgPos: 'center top' } });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect('bgImg' in ((await model(page))[0][1] || {}), '⌘Z 한 번 = 이미지 전으로').toBe(false);
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(300);
  expect((await model(page))[0][1].bgImg).toBe(img);
  // 저장 왕복
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForTimeout(400);
  expect((await cellCss(page, 0, 1)).img).toContain('data:image');
  expect((await cellCss(page, 0, 1)).pos).toBe('50% 0%');
  // 단독 HTML
  const html = await page.evaluate(async () => {
    let out = null; const oc = URL.createObjectURL; URL.createObjectURL = (b) => { out = b; return 'blob:none'; };
    const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ck; }
    return out ? await out.text() : null;
  });
  const p2 = await page.context().newPage(); await p2.setContent(html);
  const h = await p2.evaluate(() => { const e = document.querySelector('#gG .grd-cell[data-r="0"][data-c="1"]'); return e && getComputedStyle(e).backgroundImage; });
  await p2.close();
  expect(h, '단독 HTML 칸에 그림').toContain('data:image');
  // MCP 입구 계약
  for (const bad of [{ bgFit: 'fill' }, { bgImg: 'http://x/a.png' }, { bgImg: "data:image/png;base64,a'b" }, { bgPos: 'middle top' }]) {
    const r = await updRaw(page, 'gG', { patchCell: { r: 0, c: 0, ...bad } });
    expect(r.ok, JSON.stringify(bad)).toBe(false);
    expect(r.code).toBe('INVALID');
  }
  const big = 'data:image/png;base64,' + 'A'.repeat(200001);
  expect((await updRaw(page, 'gG', { patchCell: { r: 0, c: 0, bgImg: big } })).ok, 'MCP 상한 200000자').toBe(false);
  expect((await updRaw(page, 'gG', { patchCell: { r: 0, c: 0, bgImg: big } }, { trusted: true })).ok, '패널(trusted)만 면제').toBe(true);
  // ★E68 대조 — 위치·URL 잣대 = G12 블럭 배경과 같은가(같은 후보 집합에 같은 판정)
  const cands = ['left top', 'center', 'right bottom', 'top left', 'middle top', 'center middle', '', 'left'];
  for (const v of cands) {
    const a = (await updRaw(page, 'gG', { blockBg: { pos: v } })).ok;
    const b = (await updRaw(page, 'gG', { patchCell: { r: 0, c: 0, bgPos: v } })).ok;
    expect(b, `bgPos ${JSON.stringify(v)}: G12=${a} G4=${b}`).toBe(v === '' ? true : a);   // '' 는 칸 계약상 «강제값»(늘 통과)
  }
  for (const v of ['goya-asset://p/x.png', 'data:image/png;base64,AAAA', 'http://x/y.png', 'data:image/png;base64,a b', 'goya-asset://p/(x).png']) {
    const a = (await updRaw(page, 'gG', { blockBg: { image: v } })).ok;
    const b = (await updRaw(page, 'gG', { patchCell: { r: 0, c: 0, bgImg: v } })).ok;
    expect(b, `bgImg ${v}: G12=${a} G4=${b}`).toBe(a);
  }
  // ★E68 대조 — fit 명부 = 에셋 fit 명부
  const aid = await page.evaluate(() => { const r = window.makeAssetBlock(); const b = r.block || r; b.id = b.id || 'aX'; document.getElementById('gI').appendChild(b); return b.id; });
  for (const v of ['cover', 'contain', 'fill', 'none', 'scale-down']) {
    const a = (await page.evaluate(([id, v]) => window.updateAssetBlock(id, { fit: v }), [aid, v])).ok;
    const b = (await updRaw(page, 'gG', { patchCell: { r: 0, c: 0, bgFit: v } })).ok;
    expect(b, `fit ${v}: 에셋=${a} G4=${b}`).toBe(a);
  }
});

test('C5 ★PNG 두 길 — ⒜ 주 경로 대역(클론 CDP 스크린샷) ⒝ html2canvas — 칸 그림이 «픽셀로» 나오나', async ({ page }) => {
  await setup(page);
  const img = await IMG(page);
  await upd(page, 'gG', { patchCell: { r: 1, c: 1, bg: RED, bgImg: img, bgFit: 'cover' } });
  await page.evaluate(() => window.deselectAll?.());
  const geo = await page.evaluate(async () => {
    const ex = await import('/js/io/export-image.js');
    const clone = await ex.prepareCloneForCapture(document.getElementById('gS'), 860, true);
    ex.renderComponentsInClone(clone);
    clone.id = '__clone'; clone.style.position = 'fixed'; clone.style.zIndex = '2147483647'; clone.style.top = '0px'; clone.style.left = '0px'; clone.style.background = '#ffffff';
    const C = clone.querySelector('.grd-cell[data-r="1"][data-c="1"]'); const r = C.getBoundingClientRect(); const cr = clone.getBoundingClientRect();
    return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2, cw: cr.width };
  });
  await page.evaluate(() => document.getElementById('proj-loading-overlay')?.remove());
  const shot = await page.locator('#__clone').screenshot({ type: 'png' });
  const a = await page.evaluate(async ([b64, g]) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
    const s = im.width / g.cw; const d = x.getImageData(Math.round(g.x * s), Math.round(g.y * s), 1, 1).data; return [d[0], d[1], d[2]];
  }, [shot.toString('base64'), geo]);
  // ⒝ html2canvas — export-image.js captureCloneToCanvas(useNative=false) 그 함수
  const b = await page.evaluate(async (g) => {
    const ex = await import('/js/io/export-image.js');
    document.getElementById('__clone')?.remove();
    const clone = await ex.prepareCloneForCapture(document.getElementById('gS'), 860, false);   // html2canvas 길의 준비(useNative=false)
    ex.renderComponentsInClone(clone);
    clone.id = '__clone2';
    if (!clone.isConnected) document.body.appendChild(clone);
    const { canvas } = await ex.captureCloneToCanvas(clone, 860, '#ffffff', false, document.getElementById('gS'));
    clone.remove();
    const s = canvas.width / g.cw; const d = canvas.getContext('2d').getImageData(Math.round(g.x * s), Math.round(g.y * s), 1, 1).data; return [d[0], d[1], d[2]];
  }, geo);
  await page.evaluate(() => document.getElementById('__clone')?.remove());
  console.log(`[C5] ⒜ 클론 스크린샷 칸 가운데 rgb=${a} · ⒝ html2canvas rgb=${b}`);
  const isGreen = (p) => p[0] < 60 && p[1] > 200 && p[2] < 60;
  expect(isGreen(a), `⒜ 주 경로 대역 rgb=${a}`).toBe(true);
  expect(isGreen(b), `⒝ html2canvas rgb=${b}`).toBe(true);
});

test('C6 ★E57 지우기 꼴 ⒜~⒡ + 선택 목록 기록', async ({ page }) => {
  await setup(page);
  const img = await IMG(page);
  await upd(page, 'gG', { patchCell: { r: 1, c: 0, bg: RED, bgImg: img, padding: 8 } });
  const st = () => page.evaluate(() => { const g = document.getElementById('gG'); const cells = g ? JSON.parse(g.dataset.cells || '[]') : [];
    const c = (cells[1] || [])[0] || {}; return { grid: !!g, img: !!c.bgImg, bg: c.bg || null, pad: c.padding || null, lines: (c.lines || []).length, selected: [...document.querySelectorAll('#canvas .selected')].map(e => e.id || e.className.split(' ')[0]) }; });
  const rows = {};
  rows.start = await st();
  // ⒜ 이미지 제거(고치는 문 null) — 이미지만
  await upd(page, 'gG', { patchCell: { r: 1, c: 0, bgImg: null } });
  rows.a_remove = await st();
  expect(rows.a_remove).toMatchObject({ img: false, bg: RED, pad: 8, lines: 1 });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  rows.a_undo = await st();
  expect(rows.a_undo.img, '⒜ ⌘Z 한 걸음 = 이미지 돌아옴').toBe(true);
  // ⒝ 칸 «내용» 지우기(줄 비우기) — 이미지 남음
  await upd(page, 'gG', { patchCell: { r: 1, c: 0, lines: [] } });
  rows.b_clearLines = await st();
  expect(rows.b_clearLines).toMatchObject({ img: true, lines: 0 });
  expect((await cellCss(page, 1, 0)).img, '빈 칸에도 그림이 그려진다').toContain('data:image');
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  // ⒞ 줄 편집 중 ⌫ = 글자만 (실제 키)
  const [x, y] = await page.evaluate(() => { const g = document.getElementById('gG'); g.scrollIntoView({ block: 'center' }); const q = g.getBoundingClientRect(); return [q.left + 6, q.top + 6]; });
  await page.mouse.click(x, y); await page.waitForTimeout(250);
  const ln = await page.evaluate(() => { const l = document.querySelector('#gG .grd-cell[data-r="1"][data-c="0"] .grd-line'); const q = l.getBoundingClientRect(); return [q.left + q.width - 2, q.top + q.height / 2]; });
  await page.mouse.dblclick(ln[0], ln[1]); await page.waitForTimeout(250);
  rows.c_editing = await st();
  await page.keyboard.press('End'); await page.keyboard.press('Backspace'); await page.waitForTimeout(100);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(300);
  rows.c_afterBs = await st();
  expect(rows.c_afterBs).toMatchObject({ grid: true, img: true });
  // ⒟ 블럭 선택 Delete = 통째 · ⌘Z 로 이미지까지 — 편집 상태를 먼저 빠져나온다(Esc ×2 · 빈 데 클릭)
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.evaluate(() => { document.activeElement?.blur?.(); window.deselectAll?.(); });
  await page.waitForTimeout(200);
  const [x2, y2] = await page.evaluate(() => { const g = document.getElementById('gG'); g.scrollIntoView({ block: 'center' }); const q = g.getBoundingClientRect(); return [q.left + 6, q.top + 6]; });
  await page.mouse.click(x2, y2); await page.waitForTimeout(300);
  rows.d_selected = await st();
  console.log(`[C6] d_selected sel=[${rows.d_selected.selected.join(',')}] active=${await page.evaluate(() => (document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || '-')}`);
  await page.keyboard.press('Delete'); await page.waitForTimeout(300);
  rows.d_afterDelete = await st();
  expect(rows.d_afterDelete.grid, '⒟ 블럭이 지워진다').toBe(false);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(400);
  rows.d_undo = await st();
  expect(rows.d_undo).toMatchObject({ grid: true, img: true });
  // ⒡ 행 줄이기 — 잘린 칸 이미지 사라짐 · ⌘Z 복원
  await upd(page, 'gG', { rows: [{ height: 160 }] });
  rows.f_shrink = await st();
  expect(rows.f_shrink.img).toBe(false);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  rows.f_undo = await st();
  expect(rows.f_undo.img, '⒡ ⌘Z 로 잘린 칸 이미지 복원').toBe(true);
  for (const [k, v] of Object.entries(rows)) console.log(`[C6] ${k.padEnd(13)} grid=${v.grid ? 1 : 0} img=${v.img ? 1 : 0} bg=${v.bg} pad=${v.pad} lines=${v.lines} sel=[${v.selected.map(s => /^tb_/.test(s) ? 'KID' : s).join(',')}]`);
});

test('C7 ★E64 교차 + 새 칸 상속 0 — ×G12(띠·안 A) · ×G15 ＋ · 피커(gridResizeTo) · ×G2-b 폭 · ×G14 원형 줄', async ({ page }) => {
  await setup(page);
  const img = await IMG(page);
  await upd(page, 'gG', { blockBg: { on: true, color: BG12, padY: 20, padX: 20 } });
  await upd(page, 'gG', { patchCell: { r: 0, c: 0, bgImg: img }, });
  // ×G15 ＋ — 열·행 하나씩
  await page.evaluate(() => { const g = document.getElementById('gG'); window.gridAddAtEnd(g, 'col'); window.gridAddAtEnd(g, 'row'); });
  let m = await model(page);
  expect(m[0][0].bgImg, '기존 칸 이미지 유지').toBe(img);
  const newCells = [m[0][2], m[1][2], m[2][0], m[2][1], m[2][2]];
  expect(newCells.every(c => !c || !('bgImg' in c)), '★＋ 로 생긴 칸은 이미지를 안 물려받는다').toBe(true);
  // 피커 = gridResizeTo — 같은 규칙
  await page.evaluate(async () => { const m = await import('/js/blocks/grid-block.js'); m.gridResizeTo(document.getElementById('gG'), 4, 4); });
  m = await model(page);
  expect(m.flat().filter(c => c && c.bgImg).length, '피커로 4×4 — 이미지 칸은 원래 하나').toBe(1);
  // ×G12 — 칸 이미지가 띠 위 · 띠 그대로
  const q = await cellRect(page, 0, 0);
  const [inCell, band] = await px(page, [[(q.l + q.r) / 2, (q.t + q.b) / 2], [q.l - 10, (q.t + q.b) / 2]]);
  expect(inCell, '칸 그림(cover)').toBe(GREEN);
  expect(band, 'G12 띠').toBe(BG12);
  // ×G2-b — 폭 바꿔도 cover 가 칸을 덮는다(px 저장 없음)
  await upd(page, 'gG', { width: 500 });
  const q2 = await cellRect(page, 0, 0);
  const [c2a, c2b] = await px(page, [[q2.l + 3, q2.t + 3], [q2.r - 3, q2.b - 3]]);
  expect([c2a, c2b], `폭 500 — 칸 구석까지 그림 (cell ${Math.round(q2.w)}×${Math.round(q2.h)})`).toEqual([GREEN, GREEN]);
  // ×G14 — 같은 칸에 원형 이미지 줄(그릇)을 얹어도 칸 그림은 그 둘레에 그대로
  await upd(page, 'gG', { patchCell: { r: 0, c: 0, lines: [{ type: 'image', imgShape: 'circle', imgSrc: '' }] } });
  const circ = await page.evaluate(() => !!document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] .grd-img-circle'));
  expect(circ, '원형 줄이 그려졌다(전제)').toBe(true);
  const q3 = await cellRect(page, 0, 0);
  const [corner] = await px(page, [[q3.l + 3, q3.t + 3]]);
  expect(corner, '원 밖 칸 구석 = 칸 그림').toBe(GREEN);
});

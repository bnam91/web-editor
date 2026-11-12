/* circle-clip-q11 — 현빈 261112 Q11: 원 계열 «내용 자르기» 끔 = 원(칸) 밖으로 그림이 보인다 · 원 바탕·테두리는 남는다 · 기본값 무변.
 *   대상 셋: 그리드 원형 줄(gridCircle) · 서클 에셋블럭(icb) · 래디얼 칸(radial). 표 = js/clip-content.js 한 자리.
 *   Q0 [지킴] 기본(켬) — 원 밖 점은 바탕색 · 저장 흔적 0(모델 키·data-clip-content·인라인 overflow 없음 = 옛 바이트)
 *   Q1 끔(패널 토글 실클릭) — 원 밖 점에 그림 색 · 값 = false/'false'
 *   Q2 PNG·썸네일 공용 겹(stripEditorOnlyForCapture 클론) — 켬 hidden / 끔 visible
 *   Q3 단독 HTML 배송본 — 켬 hidden / 끔 visible
 *   Q4 Figma JSON — 켬 = clip 키 없음 / 끔 = clip:false (icb·radial). ★그리드 원 줄 그림은 Figma JSON 에 원래 안 실린다(grid = generic svg 뿐) ⇒ 칸 없음.
 *      ⚠️figma-renderer 는 clip 을 아직 안 읽는다(G17 border 와 같은 처지) — 이 칸은 «보내는 쪽»만 잰다.
 *   Q5 서클 이미지 편집 들어갔다 나와도 끔 유지 · 켬이면 도로 자름(편집 끝 applyIcbClip)
 *   Q6 패널 — 토글 줄 뒤에 안내 문구(prop-hint)를 새로 달지 않았다(현빈 261112 채점 게이트)
 * 자 = 픽셀: 1×1 스크린샷을 페이지 캔버스로 풀어 RGB 를 잰다(elementsFromPoint 는 조상의 둥근 자름을 무시해 못 쓴다 — 프로브 실측).
 * 양성대조: ㉮ grid-block.js cClipOn 을 늘 true → grid Q1·Q2·Q3 빨강 · ㉯ editor-blocks.css 의 `.grd-img-circle[data-clip-content="false"] > .grd-img{border-radius:0}` 삭제 → grid Q1 픽셀 빨강(캔버스만 원으로 남음)
 *   · ㉰ clip-content.js applyIcbClip 의 visible 줄 삭제 → icb Q1·Q2·Q3·Q5 빨강 · ㉱ radial-block.js _noClip 을 늘 false → radial Q1·Q2·Q3 빨강 · ㉲ export-figma-json.js 두 줄 삭제 → Q4 빨강. Q0·Q6 은 늘 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const BLUE = [51, 102, 204];
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 400; const x = cv.getContext('2d'); x.fillStyle = '#3366cc'; x.fillRect(0, 0, 400, 400);
    const SRC = cv.toDataURL('image/png');
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sQ" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="sQ-in"></div></div>');
    const sec = document.getElementById('sQ');
    const g = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'image', imgShape: 'circle', height: 160, imgSrc: SRC }] }, { width: 1, lines: [{ type: 'body', text: '옆 칸' }] }] });
    g.block.id = 'gQ'; document.getElementById('sQ-in').appendChild(g.row);
    window.rebindAll?.(); window.selectSection?.(sec);
    const before = new Set(document.querySelectorAll('.icon-circle-block'));
    window.addIconCircleBlock({ size: 160 });
    const icb = [...document.querySelectorAll('.icon-circle-block')].find(e => !before.has(e)); icb.id = 'iQ';
    const circle = icb.querySelector('.icb-circle'); icb.classList.add('has-image'); icb.dataset.imgSrc = SRC; circle.style.position = 'relative';
    circle.innerHTML = `<img class="icb-img" src="${SRC}" style="width:100%;height:100%;object-fit:cover;display:block;" draggable="false">`;
    icb.dataset.imgW = '320'; icb.dataset.imgX = '-80'; icb.dataset.imgY = '-80'; window.applyCircleImageTransform(icb);   // 그림이 원보다 크다(밖으로 80px)
    window.selectSection?.(sec);
    const m = window.addRadialBlock({}); const rb = (m && m.block) || document.querySelector('.radial-block'); rb.id = 'rQ';
    rb.dataset.items = JSON.stringify(['leaf', 'drop', 'sun', 'moon', 'pill', 'bottle'].map(k => ({ label: '', img: k })));   // 샘플 = «네모 색면»(radial-samples.js 머리말)
    window.renderRadialBlock(rb);
    window.applyZoom?.(100); window.deselectAll?.();
  });
  await page.waitForFunction(() => [...document.querySelectorAll('#gQ img, #iQ img')].every(i => i.complete && i.naturalWidth > 0));
  await page.waitForTimeout(400);
  return errs;
}
/* 원 밖 점 — 그리드: 원 상자 왼쪽 위 10%(원 밖 · 그림 정사각 안) · 서클: 원 오른쪽 10px(그림은 80px 넘친다) · 래디얼: 칸 상자 12%(원 밖 · 테두리 5px 안쪽) */
const points = (page) => page.evaluate(() => { const R = (s) => document.querySelector(s).getBoundingClientRect();
  const g = R('#gQ .grd-img-circle'), i = R('#iQ .icb-circle'), r = R('#rQ .rdl-cell');
  return { grid: [g.left + g.width * 0.1, g.top + g.height * 0.1], icb: [i.right + 10, i.top + i.height / 2], radial: [r.left + r.width * 0.12, r.top + r.height * 0.12] }; });
async function pix(page, x, y) {
  const b = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } });
  return page.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3); }, b.toString('base64'));
}
async function pixAll(page) {
  await page.evaluate(() => { window.deselectAll?.(); document.getElementById('sQ').scrollIntoView({ block: 'start' }); });
  await page.mouse.move(2, 2); await page.waitForTimeout(200);
  const P = await points(page); const o = {};
  for (const k of Object.keys(P)) o[k] = await pix(page, ...P[k]);
  return o;
}
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 6);
const RADIAL_LEAF = [63, 166, 106];   // radial-samples leaf #3fa66a

async function clickToggle(page, sel, open) {
  await page.evaluate(open); await page.waitForTimeout(200);
  const p = await page.evaluate((s) => { const i = document.querySelector(s); if (!i) return null; const l = i.closest('label'); l.scrollIntoView({ block: 'center' }); const r = l.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  expect(p, `[전제] ${sel} 토글이 패널에 있다`).not.toBeNull();
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(300);
}
const OPEN = {
  grid: () => { const b = document.getElementById('gQ'); window.grdSetActiveLine?.(b, { r: 0, c: 0, li: 0 }); window.showGridProperties?.(b, { r: 0, c: 0, li: 0 }); },
  icb: () => window.showIconCircleProperties(document.getElementById('iQ')),
  radial: () => window.showRadialProperties(document.getElementById('rQ'), -1),
};
const TOGGLE = { grid: '#grd-img-clip-toggle', icb: '#icb-clip-toggle', radial: '#rdl-clip-toggle' };
async function allOff(page) { for (const k of ['grid', 'icb', 'radial']) await clickToggle(page, TOGGLE[k], OPEN[k]); }

const overflows = (root) => ({ grid: getComputedStyle(root.querySelector('.grd-img-circle')).overflow,
  icb: getComputedStyle(root.querySelector('.icb-circle')).overflow, radial: getComputedStyle(root.querySelector('.rdl-cell')).overflow });
async function pngLayer(page) {
  return page.evaluate(async (src) => {
    const ov = new Function('return ' + src)();
    const clone = document.getElementById('sQ').cloneNode(true); const mod = await import('/js/io/capture-safety.js'); mod.stripEditorOnlyForCapture(clone);
    clone.id = 'sQclone'; clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;'; document.body.appendChild(clone);
    const r = ov(clone); clone.remove(); return r;
  }, overflows.toString());
}
async function htmlShip(page, context) {
  const body = await page.evaluate(async () => { const OB = window.Blob, oc = HTMLAnchorElement.prototype.click; let b = null; HTMLAnchorElement.prototype.click = function () {};
    window.Blob = function (p, o) { b = (p || []).join(''); return new OB(p, o); }; try { await window.exportHTMLFile(); } catch (e) { b = 'THREW:' + (e && e.message); } window.Blob = OB; HTMLAnchorElement.prototype.click = oc; return b; });
  expect(String(body).startsWith('THREW'), '내보내기가 던졌다: ' + String(body).slice(0, 200)).toBe(false);
  const p2 = await context.newPage(); await p2.route('**/*', (r) => r.fulfill({ contentType: 'text/html', body })); await p2.goto('http://export.q11.test/x.html');
  const r = await p2.evaluate((src) => new Function('return ' + src)()(document), overflows.toString()); await p2.close(); return r;
}
const figma = (page) => page.evaluate(() => { window.flushCurrentPage?.(); const j = window.buildFigmaExportJSON(null); const f = {};
  JSON.stringify(j, (k, v) => { if (v && (v.id === 'iQ' || v.id === 'rQ')) f[v.id] = { type: v.type, hasClip: 'clip' in v, clip: v.clip }; return v; }); return f; });

test('Q0 [지킴] 기본(켬) — 원 밖은 바탕 · 저장 흔적 0', async ({ page }) => {
  const errs = await scene(page);
  const px = await pixAll(page);
  expect(near(px.grid, BLUE), `그리드 원 밖에 그림이 보인다 ${px.grid}`).toBe(false);
  expect(near(px.icb, BLUE), `서클 원 밖에 그림이 보인다 ${px.icb}`).toBe(false);
  expect(near(px.radial, RADIAL_LEAF), `래디얼 칸 밖에 그림이 보인다 ${px.radial}`).toBe(false);
  const ds = await page.evaluate(() => ({ grid: 'clipContent' in window.getGridModel(document.getElementById('gQ')).cells[0][0].lines[0],
    gAttr: document.querySelector('#gQ .grd-img-circle').hasAttribute('data-clip-content'), icb: document.getElementById('iQ').hasAttribute('data-clip-content'),
    icbInline: document.querySelector('#iQ .icb-circle').style.overflow, rad: document.getElementById('rQ').hasAttribute('data-clip-content'),
    radInline: /overflow/.test(document.querySelector('#rQ .rdl-cell').getAttribute('style') || '') }));
  expect(ds).toEqual({ grid: false, gAttr: false, icb: false, icbInline: '', rad: false, radInline: false });
  expect(errs).toEqual([]);
});

test('Q1 끔(토글 실클릭) — 원 밖에 그림이 보인다 · 값 false', async ({ page }) => {
  const errs = await scene(page);
  await allOff(page);
  const v = await page.evaluate(() => ({ grid: window.getGridModel(document.getElementById('gQ')).cells[0][0].lines[0].clipContent,
    icb: document.getElementById('iQ').dataset.clipContent, rad: document.getElementById('rQ').dataset.clipContent }));
  expect(v).toEqual({ grid: false, icb: 'false', rad: 'false' });
  const px = await pixAll(page);
  expect(near(px.grid, BLUE), `그리드 원 밖 픽셀 ${px.grid} — 캔버스만 원으로 남았나(그림 반경)`).toBe(true);
  expect(near(px.icb, BLUE), `서클 원 밖 픽셀 ${px.icb}`).toBe(true);
  expect(near(px.radial, RADIAL_LEAF), `래디얼 칸 밖 픽셀 ${px.radial}`).toBe(true);
  expect(errs).toEqual([]);
});

test('Q2 PNG·썸네일 공용 겹 — 켬 hidden · 끔 visible', async ({ page }) => {
  await scene(page);
  expect(await pngLayer(page)).toEqual({ grid: 'hidden', icb: 'hidden', radial: 'hidden' });
  await allOff(page);
  expect(await pngLayer(page)).toEqual({ grid: 'visible', icb: 'visible', radial: 'visible' });
});

test('Q3 단독 HTML 배송본 — 켬 hidden · 끔 visible', async ({ page, context }) => {
  await scene(page);
  expect(await htmlShip(page, context)).toEqual({ grid: 'hidden', icb: 'hidden', radial: 'hidden' });
  await allOff(page);
  expect(await htmlShip(page, context)).toEqual({ grid: 'visible', icb: 'visible', radial: 'visible' });
});

test('Q4 Figma JSON — 켬 = clip 키 없음 · 끔 = clip:false (서클·래디얼)', async ({ page }) => {
  await scene(page);
  const on = await figma(page);
  expect(on.iQ && on.rQ, '[전제] 서클·래디얼이 JSON 에 있다').toBeTruthy();
  expect([on.iQ.hasClip, on.rQ.hasClip], '켬인데 clip 키가 실렸다(옛 바이트가 달라짐)').toEqual([false, false]);
  await allOff(page);
  const off = await figma(page);
  expect([off.iQ.clip, off.rQ.clip]).toEqual([false, false]);
});

test('Q5 서클 이미지 편집 들어갔다 나와도 «내용 자르기» 값대로', async ({ page }) => {
  await scene(page);
  const cycle = () => page.evaluate(() => { const b = document.getElementById('iQ'); window.enterCircleImageEditMode(b); const mid = getComputedStyle(b.querySelector('.icb-circle')).overflow;
    window.exitCircleImageEditMode(b); return { mid, after: getComputedStyle(b.querySelector('.icb-circle')).overflow }; });
  expect(await cycle(), '켬: 편집 중엔 전체(visible) · 끝나면 도로 자름').toEqual({ mid: 'visible', after: 'hidden' });
  await clickToggle(page, TOGGLE.icb, OPEN.icb);
  expect(await cycle(), '끔: 편집 끝나도 visible 유지').toEqual({ mid: 'visible', after: 'visible' });
});

test('Q6 [게이트] 토글 줄 뒤에 안내 문구(prop-hint)를 새로 달지 않았다', async ({ page }) => {
  await scene(page);
  for (const k of ['grid', 'icb', 'radial']) {
    await page.evaluate(OPEN[k]); await page.waitForTimeout(150);
    const r = await page.evaluate((s) => { const row = document.querySelector(s)?.closest('.prop-row'); if (!row) return null;
      return { next: row.nextElementSibling?.classList.contains('prop-hint') || false, inRow: !!row.querySelector('.prop-hint') }; }, TOGGLE[k]);
    expect(r, `[전제] ${k} 토글 줄이 있다`).not.toBeNull();
    expect(r, `${k} 토글에 안내 문구가 붙었다`).toEqual({ next: false, inRow: false });
  }
});

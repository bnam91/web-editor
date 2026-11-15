/* figma-export-imgs — Figma 내보내기 JSON(buildFigmaExportJSON · figma-publish.js 업로드가 쓰는 길)에 «그림이 실리나»
 *   FIGMA-EXPORT-GRID-IMAGES-MISSING-01 — 그리드 칸 그림(<img class="grd-img">)이 generic {svg:'', texts:[]} 에 안 실려 Figma 엔 빈 프레임(미카사 261113)
 *   FIGMA-EXPORT-MOCKUP-SCREEN-MISSING-01 — 목업 화면 그림(.mkp-screen 배경 · dataset.imgSrc)이 JSON 에 칸 자체가 없어 Figma 화면이 검었다
 *   받는 쪽(figma-renderer)이 그 칸을 그리는지는 tests/unit/figma-renderer-images.test.mjs 가 잰다. ⛔실 Figma·토큰 0.
 * X1 그리드 칸 그림 셋(원 하나 포함) → generic kind grid 의 images 셋 · src = 그림 · 자리·크기 = 화면의 그림 틀(블럭 왼위 기준 레이아웃 px ±1) · 원 표시
 * X2 아이폰 목업 + 화면 그림 → mockup.screen.src = 그림 · % 상자 = 기기 정의(MOCKUP_DEVICES.iphone.screen) · 둥글기 8% · 틀 PNG(imgSrc)는 그대로
 * X3 [음성] 그림 없는 그리드·화면 없는 목업 — images·screen 키 0(옛 바이트)
 * 양성대조(예측): js/io/export-figma-json.js 그리드 갈래 `if (images.length) out.images = images;` 줄 삭제 → X1 빨강 ·
 *   목업 갈래 `if (el.dataset.imgSrc && _scr) {` → `if (false) {` → X2 빨강 · X3 초록
 * 셀렉터·전역 대조(제품 소스 grep): window.makeGridBlock(grid-block.js:4019) · window.renderGridBlock(:4766) · window.whenGridRatiosSettled(:4798) ·
 *   window.addMockupBlock(mockup-block.js:526 · opts.sectionId·imgSrc) · window.MOCKUP_DEVICES · window.flushCurrentPage(save-load.js:3294) ·
 *   window.buildFigmaExportJSON(export-figma-json.js:1608) · img.grd-img · .grd-img-frame · .grd-img-circle(grid-block.js 그림 줄)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SCENE = '<div class="section-block" id="cS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="cI"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="cR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>';
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function scene(page, { gridImgs, mockupImg }) {
  await page.setViewportSize({ width: 1600, height: 1600 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async ({ S, PX, gridImgs, mockupImg }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); c.insertAdjacentHTML('beforeend', S);
    const I = (o = {}) => (gridImgs ? { type: 'image', imgSrc: PX, height: 120, ...o } : { type: 'body', text: '글' });
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [I(), { type: 'body', text: 'A' }] }, { width: 1, lines: [I(), I({ imgShape: 'circle', height: 90 })] }], rows: [{ height: 'auto' }] });
    g.id = 'gX'; document.getElementById('cR').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g); window.applyZoom?.(100);
    const m = window.addMockupBlock({ sectionId: 'cS', deviceKey: 'iphone', ...(mockupImg ? { imgSrc: PX } : {}) });
    await (window.whenGridRatiosSettled?.() ?? Promise.resolve());
    window.flushCurrentPage?.();
    const json = window.buildFigmaExportJSON(null);
    const all = []; const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.type) all.push(o); Object.values(o).forEach(walk); } }; walk(json);
    const gr = g.getBoundingClientRect(), z = gr.width / g.offsetWidth;
    const dom = [...g.querySelectorAll('img.grd-img')].map((im) => { const f = (im.closest('.grd-img-frame') || im).getBoundingClientRect();
      return { x: (f.left - gr.left) / z, y: (f.top - gr.top) / z, w: f.width / z, h: f.height / z, circle: !!im.closest('.grd-img-circle') }; });
    return { grid: all.find((b) => b.type === 'generic' && b.id === 'gX') || null, mockup: all.find((b) => b.type === 'mockup') || null,
      dom, dev: window.MOCKUP_DEVICES?.iphone ? { screen: window.MOCKUP_DEVICES.iphone.screen, radius: window.MOCKUP_DEVICES.iphone.screenRadius } : null, mockupOk: !!(m && m.ok !== false) };
  }, { S: SCENE, PX, gridImgs, mockupImg });
  return { r, errs };
}

test('X1 그리드 칸 그림 — images 로 실린다(src·자리·크기·원)', async ({ page }) => {
  const { r, errs } = await scene(page, { gridImgs: true, mockupImg: false });
  expect(r.grid, '[전제] 그리드가 generic 으로 나간다').not.toBeNull();
  expect(r.dom.length, '[전제] 화면에 칸 그림 셋(원 하나)').toBe(3);
  expect(r.dom.filter((d) => d.circle).length, '[전제] 원 그림 하나').toBe(1);
  const imgs = r.grid.images || [];
  expect(imgs.length, `★칸 그림이 JSON 에 안 실렸다 — ${JSON.stringify(Object.keys(r.grid))}`).toBe(3);
  expect(imgs.map((i) => i.src === PX), 'src = 넣은 그림').toEqual([true, true, true]);
  const key = (o) => `${Math.round(o.x)},${Math.round(o.y)}`;
  for (const d of r.dom) {
    const i = imgs.find((x) => Math.abs(x.x - d.x) <= 1 && Math.abs(x.y - d.y) <= 1);
    expect(i, `★화면 그림 ${key(d)} 자리의 JSON 그림이 없다 — ${JSON.stringify(imgs.map((x) => [x.x, x.y, x.w, x.h]))}`).toBeTruthy();
    expect([Math.abs(i.w - d.w) <= 1, Math.abs(i.h - d.h) <= 1, i.circle], `크기·원 ${key(d)}`).toEqual([true, true, d.circle]);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('X2 아이폰 목업 화면 — screen 으로 실린다(src · % 상자 · 둥글기) · 틀 PNG 그대로', async ({ page }) => {
  const { r, errs } = await scene(page, { gridImgs: false, mockupImg: true });
  expect(r.mockupOk && r.mockup, '[전제] 목업이 mockup 으로 나간다').toBeTruthy();
  expect(r.mockup.imgSrc, '[지킴] 틀 PNG').toMatch(/iphone-14-blue\.png$/);
  const s = r.mockup.screen;
  expect(s, `★화면 그림이 JSON 에 안 실렸다 — ${JSON.stringify(Object.keys(r.mockup))}`).toBeTruthy();
  expect(s.src).toBe(PX);
  expect([s.l, s.t, s.w, s.h, s.radius], '% 상자 = 기기 정의').toEqual([r.dev.screen.l, r.dev.screen.t, r.dev.screen.w, r.dev.screen.h, r.dev.radius]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('X3 [음성] 그림 없는 그리드·화면 없는 목업 — images·screen 키 없음', async ({ page }) => {
  const { r, errs } = await scene(page, { gridImgs: false, mockupImg: false });
  expect(r.grid && r.mockup, '[전제] 둘 다 나간다').toBeTruthy();
  expect(['images' in r.grid, 'screen' in r.mockup]).toEqual([false, false]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

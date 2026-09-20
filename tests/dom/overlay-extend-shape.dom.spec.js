/* overlay-extend-shape.dom.spec.js — 0920b 현빈 원문 3번 「도형 블럭과 에셋 블럭에도
 * 오버레이 버튼·기능이 있어야할 것」(T-052) 중 «도형» 쪽 회귀 게이트.
 *
 * ★무엇이 새로 도는가 — 도형은 오버레이 «기능 자체»가 없었다(prop-shape.js 에 Position 절도
 *   토글도 없었다). 텍스트 전용이던 진입/이탈/드래그를 js/overlay-float.js 로 옮겨 공용화하고
 *   도형의 «위치를 쥔 요소»를 자유배치 래퍼 프레임(shape-frame.js shapeFrameOf)으로 해석한다.
 *
 * ★이 파일이 지키는 것
 *   S1 진입 — 래퍼가 .section-block 직속으로 올라가고 overlayBlock/offsetX/offsetY/selVariant 가 선다
 *   S2 이탈 — 원래 부모·원래 순서(직전 형제 뒤)로 되돌아온다
 *   S3 오버레이 상태로 다른 섹션에 옮긴 뒤 이탈 — «지금» 섹션 본문으로 간다(2026-09-16o 규약)
 *   S4 z-index — 겹친 본문 위에서 elementFromPoint 가 도형을 돌려준다 + [음성대조] 규칙을 끄면 본문이 잡힌다
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. 실제 js/overlay-float.js ·
 *   js/shape-frame.js · css/editor-blocks.css 를 route 로 그대로 먹인다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-extend-shape
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const OVERLAY_FLOAT_JS = fs.readFileSync(path.join(REPO, 'js/overlay-float.js'), 'utf8');
const FRAME_GEOMETRY_JS = fs.readFileSync(path.join(REPO, 'js/frame-geometry.js'), 'utf8');
const SHAPE_FRAME_JS = fs.readFileSync(path.join(REPO, 'js/shape-frame.js'), 'utf8');
const BLOCKS_CSS = fs.readFileSync(path.join(REPO, 'css/editor-blocks.css'), 'utf8');
/* ★editor-layout.css 도 «실제 파일 그대로» 먹인다 — .text-block 의 z-index:2 가 거기 있다.
   그게 없으면 S4-b 음성대조가 재현되지 않는다(경쟁 상대가 z-index:auto 라 DOM 순서만으로
   오버레이가 이겨, 규칙을 꺼도 초록이 된다 = 검사가 아무것도 안 보는 상태). */
const LAYOUT_CSS = fs.readFileSync(path.join(REPO, 'css/editor-layout.css'), 'utf8');

/* 섹션 2개 + 첫 섹션 본문에 row(텍스트) → 도형 래퍼 순서. 도형은 row 다음 형제라
   이탈 시 «row 뒤»로 정확히 돌아와야 한다. */
function harness({ killZIndex = false } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8">
    <style>${BLOCKS_CSS}</style>
    <style>${LAYOUT_CSS}</style>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; }
      .section-block { position: relative; width: 800px; height: 400px; background: #fff; }
      .section-inner { position: relative; padding: 0; }
      .tb-body { position: relative; width: 700px; height: 300px; background: rgba(0,128,0,0.1); }
      .frame-block[data-free-layout="true"] { position: relative; width: 200px; height: 120px; }
      .shape-block { position: absolute; left: 0; top: 0; width: 200px; height: 120px; background: rgba(255,0,0,0.3); }
      /* 음성대조: 실제 규칙과 «같은 선택자·같은 !important»로 덮어 끈다(뒤에 오므로 이긴다) */
      ${killZIndex ? '.section-block > [data-overlay-block="true"] { z-index: auto !important; }' : ''}
    </style>
    </head><body>
    <div class="section-block" id="sec1">
      <div class="section-inner" id="inner1">
        <div class="row" id="row0">
          <div class="text-block" id="tb0"><div class="tb-body" id="tbbody1">본문 텍스트</div></div>
        </div>
        <div class="frame-block" data-free-layout="true" id="ss1">
          <div class="shape-block" id="sh1" data-shape-type="ellipse"></div>
        </div>
      </div>
    </div>
    <div class="section-block" id="sec2">
      <div class="section-inner" id="inner2"><div class="row" id="row2"></div></div>
    </div>
    <script>
      window.currentZoom = 100;
      window.pushHistory = () => {};
      window.scheduleAutoSave = () => {};
      window.triggerAutoSave = () => {};
      window.buildLayerPanel = () => {};
      window._findSectionAt = () => null;
      window.genId = (p) => p + '_' + Math.random().toString(36).slice(2, 8);
    </script>
    <script type="module" src="/overlay-float.js"></script>
    </body></html>`;
}

async function boot(page, opts = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({ contentType: 'text/html', body: harness(opts) });
    }
    if (url.pathname === '/overlay-float.js') {
      return route.fulfill({ contentType: 'application/javascript', body: OVERLAY_FLOAT_JS });
    }
    if (url.pathname === '/frame-geometry.js') {
      return route.fulfill({ contentType: 'application/javascript', body: FRAME_GEOMETRY_JS });
    }
    if (url.pathname === '/shape-frame.js') {
      return route.fulfill({ contentType: 'application/javascript', body: SHAPE_FRAME_JS });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => !!window.OverlayFloat);
  return errs;
}

test('S0 전제 — posElOf(.shape-block) 가 «자유배치 래퍼»를 돌려준다(shape-frame.js SSOT 경유)', async ({ page }) => {
  await boot(page);
  const id = await page.evaluate(() => window.OverlayFloat.posElOf(document.getElementById('sh1'))?.id);
  expect(id, 'posElOf 가 래퍼가 아니라 다른 것을 돌려줬다 — 래퍼가 아니면 이동·복귀가 전부 어긋난다').toBe('ss1');
});

test('S1 ★진입 — 래퍼가 섹션 직속으로 올라가고 좌표·상태가 선다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const ss = document.getElementById('ss1');
    const before = ss.getBoundingClientRect();
    const ok = window.OverlayFloat.enterFloat(window.OverlayFloat.posElOf(document.getElementById('sh1')));
    const after = ss.getBoundingClientRect();
    return {
      ok,
      parentId: ss.parentElement.id,
      overlay: ss.dataset.overlayBlock,
      offsetX: ss.dataset.offsetX, offsetY: ss.dataset.offsetY,
      left: ss.style.left, top: ss.style.top, position: ss.style.position,
      variantWrap: ss.dataset.selVariant,
      variantShape: document.getElementById('sh1').dataset.selVariant,
      dx: Math.abs(after.left - before.left), dy: Math.abs(after.top - before.top),
    };
  });
  expect(errs, `페이지 에러: ${errs.join(' | ')}`).toEqual([]);
  expect(r.ok).toBe(true);
  expect(r.parentId, '래퍼가 섹션 직속으로 안 올라갔다').toBe('sec1');
  expect(r.overlay).toBe('true');
  expect(r.position).toBe('absolute');
  // 좌표 SSOT = dataset.offsetX/Y, style 은 그걸 되읽어 쓴다
  expect(r.left).toBe(r.offsetX + 'px');
  expect(r.top).toBe(r.offsetY + 'px');
  // 진입해도 «화면 자리»는 그대로여야 한다(순간이동 금지)
  expect(r.dx, '진입하면서 가로로 튀었다').toBeLessThanOrEqual(1);
  expect(r.dy, '진입하면서 세로로 튀었다').toBeLessThanOrEqual(1);
  /* ★보라 아웃라인 — selection-overlay.js _hostOf 는 «텍스트만» 래퍼로 올리고 나머지는 자기
     자신이다. 도형은 .shape-block 이 선택 호스트라 래퍼에만 심으면 보라가 안 뜬다. */
  expect(r.variantWrap, '래퍼에 selVariant 가 없다').toBe('sticker');
  expect(r.variantShape, '.shape-block 에 selVariant 가 없다 — 선택 테두리가 파랑으로 남는다').toBe('sticker');
});

test('S2 ★이탈 — 원래 부모·원래 순서(직전 형제 뒤)로 되돌아온다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const OF = window.OverlayFloat;
    const ss = OF.posElOf(document.getElementById('sh1'));
    OF.enterFloat(ss);
    OF.exitFloat(ss);
    return {
      parentId: ss.parentElement.id,
      prevId: ss.previousElementSibling?.id || null,
      overlay: ss.dataset.overlayBlock ?? null,
      left: ss.style.left, position: ss.style.position,
      offsetX: ss.dataset.offsetX ?? null,
      variantWrap: ss.dataset.selVariant ?? null,
      variantShape: document.getElementById('sh1').dataset.selVariant ?? null,
    };
  });
  expect(r.parentId).toBe('inner1');
  expect(r.prevId, '원래 순서(row0 뒤)가 아니다').toBe('row0');
  expect(r.overlay).toBe(null);
  expect(r.position).toBe('');
  expect(r.left).toBe('');
  expect(r.offsetX).toBe(null);
  expect(r.variantWrap).toBe(null);
  expect(r.variantShape).toBe(null);
});

test('S3 ★오버레이 상태로 다른 섹션에 옮긴 뒤 이탈 — «처음» 섹션이 아니라 «지금» 섹션 본문으로', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const OF = window.OverlayFloat;
    const ss = OF.posElOf(document.getElementById('sh1'));
    OF.enterFloat(ss);
    document.getElementById('sec2').appendChild(ss);   // 크로스섹션 드래그가 하는 일과 같다
    OF.exitFloat(ss);
    return { parentId: ss.parentElement.id, secId: ss.closest('.section-block').id };
  });
  expect(r.secId, '처음 섹션으로 순간이동했다 — 2026-09-16o 규약 위반').toBe('sec2');
  expect(r.parentId).toBe('inner2');
});

test('S4 ★z-index — 겹친 본문 위에서 클릭이 도형에 닿는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const OF = window.OverlayFloat;
    const ss = OF.posElOf(document.getElementById('sh1'));
    OF.enterFloat(ss);
    // 본문(.tb-body)과 확실히 겹치는 자리로 옮긴다
    ss.style.left = '60px'; ss.style.top = '60px';
    const r0 = ss.getBoundingClientRect();
    const el = document.elementFromPoint(r0.left + r0.width / 2, r0.top + r0.height / 2);
    const body = document.getElementById('tbbody1').getBoundingClientRect();
    return {
      overlapped: r0.left < body.right && r0.right > body.left && r0.top < body.bottom && r0.bottom > body.top,
      hitsOverlay: !!el?.closest('#ss1'),
      hitId: el?.id || el?.className,
      z: getComputedStyle(ss).zIndex,
    };
  });
  expect(r.overlapped, '전제가 안 맞다 — 도형과 본문이 화면에서 안 겹친다').toBe(true);
  expect(r.z, '[data-overlay-block] z-index 규칙이 도형 래퍼에 안 걸렸다').toBe('80');
  expect(r.hitsOverlay, `클릭이 도형이 아니라 ${r.hitId} 로 갔다`).toBe(true);
});

test('S4-b [음성대조] z-index 규칙을 끄면 클릭이 본문으로 샌다 — 이 검사가 실제 결함을 본다', async ({ page }) => {
  await boot(page, { killZIndex: true });
  const r = await page.evaluate(() => {
    const OF = window.OverlayFloat;
    const ss = OF.posElOf(document.getElementById('sh1'));
    OF.enterFloat(ss);
    ss.style.left = '60px'; ss.style.top = '60px';
    const r0 = ss.getBoundingClientRect();
    const el = document.elementFromPoint(r0.left + r0.width / 2, r0.top + r0.height / 2);
    return { hitsOverlay: !!el?.closest('#ss1'), hitId: el?.id || el?.className };
  });
  expect(r.hitsOverlay,
    '양성대조가 재현 안 됐다 — 규칙을 꺼도 도형이 잡힌다면 이 검사는 z-index 를 안 보고 있다는 뜻이다').toBe(false);
});

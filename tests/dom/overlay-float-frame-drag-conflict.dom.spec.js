/* overlay-float-frame-drag-conflict.dom.spec.js — 0920b 통합(int/0920b).
 *
 * ★왜 이 파일이 있나
 *   T-052(도형·에셋 오버레이)의 이벨류에이터가 «실앱에서만» 나는 high 를 하나 잡았다:
 *     저장 → 재로드한 «떠 있는 도형»은 드래그 핸들러가 «둘» 붙는다.
 *       ⑴ js/overlay-float.js bindFloatMoveDrag  — 탄성 클램프(섹션 밖까지 허용, 현빈 2026-09-20 결정)
 *       ⑵ js/block-drag.js bindFrameDropZone 의 «절대배치 프레임 전용» 드래그 — 부모로 «하드» 클램프
 *     도형 오버레이의 posEl 이 바로 .frame-block 이고 저장본에 position:absolute 가 담기므로
 *     재로드하면 ⑵의 게이트가 참이 된다. 둘 다 «같은 요소»의 mousedown 이라 stopPropagation
 *     으로는 서로를 못 막고(같은 요소의 리스너는 그걸로 안 막힌다), 둘이 같은 키
 *     (style.left/top · dataset.offsetX/offsetY)를 번갈아 써서 자리가 경계로 끌려오고 떨린다.
 *     ★텍스트는 bindFrameDropZone 이 data-text-frame 을 조기 return 으로 빼 둬서 무사했다.
 *
 *   ⛔T-052 가 새로 낸 DOM 스펙 3종(overlay-extend-*.dom.spec.js)은 js/block-drag.js 를 «한 줄도»
 *     싣지 않는다 ⇒ «같은 요소에 핸들러가 둘 붙는» 부류는 그 하네스에서 원리적으로 못 난다.
 *     그래서 이 파일은 ⑴과 ⑵를 «둘 다» 싣고 진짜 마우스로 끈다.
 *
 * ⛔앱을 «안» 띄운다. 진짜 mouse down/move/up(page.mouse).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-float-frame-drag-conflict
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { sliceBlock } = require('../unit/_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

const OVERLAY_FLOAT_JS = read('js/overlay-float.js');
const FRAME_GEOMETRY_JS = read('js/frame-geometry.js');
const SHAPE_FRAME_JS = read('js/shape-frame.js');

/* ★«진짜» bindFrameDropZone 을 떠 온다 — 베낀 사본은 이 결함을 증명하지 못한다.
   (resize-undo-history.dom.spec.js 와 같은 관용구: sliceBlock 으로 함수 한 덩이를 뜬다.) */
const BD = read('js/block-drag.js');
const BIND_FRAME_DROPZONE = sliceBlock(BD, 'function bindFrameDropZone(ss)');

/* 음성대조본 — 이번 통합이 붙인 «오버레이 가드» 한 줄만 걷어낸 것.
   이 판으로 돌리면 실앱에서 난 증상(하드클램프로 끌려옴)이 그대로 재현돼야 한다.
   ⛔재현이 안 되면 이 검사는 아무것도 지키지 못하는 것이다(그래서 아래 N1 이 있다). */
const GUARD_LINE = "if (ss.dataset.overlayBlock === 'true') return;";
if (!BIND_FRAME_DROPZONE.includes(GUARD_LINE)) {
  throw new Error('하네스가 늙었다 — bindFrameDropZone 에서 오버레이 가드 줄을 못 찾았다');
}
const BIND_FRAME_DROPZONE_PRE = BIND_FRAME_DROPZONE.replace(GUARD_LINE, '/* [음성대조] 가드 제거 */');

const SEC_W = 800, SEC_H = 400, BOX_W = 200, BOX_H = 120, START_TOP = 100;
const RESIST_ZONE = 40, MAGNET = 10, FACTOR = 0.35;

/* overlay-float.js _elasticAxis 와 «같은 수학»을 여기서 다시 도출한다(베끼면 늘 맞는다). */
function elastic(raw, boundMax, zone = RESIST_ZONE) {
  const magnet = zone * (MAGNET / RESIST_ZONE);
  if (raw < 0) {
    const over = -raw;
    if (over <= magnet) return 0;
    return over <= zone ? -((over - magnet) * FACTOR) : -((zone - magnet) * FACTOR + (over - zone));
  }
  if (raw > boundMax) {
    const over = raw - boundMax;
    if (over <= magnet) return boundMax;
    return over <= zone ? boundMax + (over - magnet) * FACTOR : boundMax + (zone - magnet) * FACTOR + (over - zone);
  }
  return raw;
}
const HARD_MAX_LEFT = SEC_W - BOX_W;   // bindFrameDropZone 의 하드 클램프 정확값

function harness(preMode) {
  return `<!doctype html><html><head><meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; }
      .section-block { position: relative; width: ${SEC_W}px; height: ${SEC_H}px; background: #fff; }
      .frame-block { width: ${BOX_W}px; height: ${BOX_H}px; background: rgba(0,0,255,0.12); }
      .shape-block { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: rgba(255,0,0,0.3); }
    </style>
    </head><body>
    <div class="section-block" id="sec1">
      <!-- ★저장본이 담고 있는 모양 그대로 — position:absolute 가 «인라인»으로 들어 있다.
           그게 bindFrameDropZone 의 절대배치 갈래를 여는 열쇠다(재로드가 방아쇠인 이유). -->
      <div class="frame-block" data-free-layout="true" data-overlay-block="true" id="ss1"
           data-offset-x="0" data-offset-y="${START_TOP}"
           style="position:absolute; left:0px; top:${START_TOP}px;">
        <div class="shape-block" id="sh1" data-shape-type="rectangle"></div>
      </div>
    </div>
    <script>
      window.currentZoom = 100;
      window.pushHistory = () => {};
      window.scheduleAutoSave = () => {};
      window.triggerAutoSave = () => {};
      window._findSectionAt = () => null;
      window.deselectAll = () => {};
      window.showFrameProperties = () => {};
      window.showFrameHandles = () => {};
      window.highlightBlock = () => {};
      window.setBlockAnchor = () => {};
      window.syncLayerActive = () => {};
      window.toggleBlockSelect = () => {};
      window.rangeSelectBlocks = () => {};
      window.beginDragHistory = () => ({ arm: () => {}, commit: () => {} });
      window.__jitter = [];
    </script>
    <script type="module" src="/overlay-float.js"></script>
    <script>
      /* ── bindFrameDropZone 이 파일 스코프에서 쓰는 이웃들 — 이 검사가 재는 축(좌표 쓰기)과
           무관한 것만 최소로 세운다(가짜 초록을 막으려고 드래그 «본체»는 진짜 코드 그대로다). */
      const BLOCK_DELEGATE_SEL = '.text-block, .asset-block, .shape-block, .mockup-block';
      const _isShapeFrameEl = () => false;
      const showFrameHandles = () => {};
      const _bindFrameOwnDrag = () => {};
      const clearDropIndicators = () => {};
      const getDragAfterElement = () => null;
      const showGuides = () => {};
      const hideGuides = () => {};
      const frameVisibleSize = (el) => ({ w: el.offsetWidth, h: el.offsetHeight });
      const frameAlignOffset = () => ({ dx: 0, dy: 0 });
      const dragState = {};
      const pushHistory = (...a) => window.pushHistory(...a);
      const beginDragHistory = (...a) => window.beginDragHistory(...a);
      const bindBlock = () => {};
      const rebindAll = () => {};
      ${preMode ? BIND_FRAME_DROPZONE_PRE : BIND_FRAME_DROPZONE}
      window.__bindFrameDropZone = bindFrameDropZone;
      window.__frameZoneReady = true;
    </script>
    </body></html>`;
}

async function boot(page, { pre = false } = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: harness(pre) });
    if (url.pathname === '/overlay-float.js') return route.fulfill({ contentType: 'application/javascript', body: OVERLAY_FLOAT_JS });
    if (url.pathname === '/frame-geometry.js') return route.fulfill({ contentType: 'application/javascript', body: FRAME_GEOMETRY_JS });
    if (url.pathname === '/shape-frame.js') return route.fulfill({ contentType: 'application/javascript', body: SHAPE_FRAME_JS });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => !!window._bindOverlayMoveDrag && !!window.__frameZoneReady);
  /* ★앱과 «같은 순서»로 건다 — 재로드 뒤 bindBlock 이 전용 드래그를, bindFrameDropZone 이
     프레임 드래그를 각각 «같은 요소»에 건다. 순서를 바꿔도 결과가 같아야 한다(N2 가 잰다). */
  await page.evaluate(() => {
    const ss = document.getElementById('ss1');
    window._bindOverlayMoveDrag(ss);
    window.__bindFrameDropZone(ss);
  });
  return errs;
}

async function dragRight(page, dx) {
  const c = await page.evaluate(() => {
    const r = document.getElementById('ss1').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + dx / 3, c.y);
  await page.mouse.move(c.x + (dx * 2) / 3, c.y);
  await page.mouse.move(c.x + dx, c.y);
  await page.mouse.up();
}
const stateOf = (page) => page.evaluate(() => {
  const ss = document.getElementById('ss1');
  return { left: parseFloat(ss.style.left) || 0, offsetX: parseFloat(ss.dataset.offsetX) || 0 };
});

const DX = 700;                                   // 섹션 밖으로 충분히 나가는 델타
const EXPECT_ELASTIC = elastic(DX, HARD_MAX_LEFT); // 탄성(= 현빈 결정대로 밖으로 나간 값)

test('F1 ★떠 있는 도형(저장본 모양, position:absolute) — 프레임 드래그가 «비켜간다», 좌표는 탄성값', async ({ page }) => {
  const errs = await boot(page);
  await dragRight(page, DX);
  const { left, offsetX } = await stateOf(page);
  expect(errs, `페이지 에러: ${errs.join(' | ')}`).toEqual([]);
  expect(Math.abs(left - EXPECT_ELASTIC),
    `탄성값이 아니다: left=${left}, 기대=${EXPECT_ELASTIC}, 하드클램프=${HARD_MAX_LEFT}`).toBeLessThanOrEqual(1.5);
  expect(left, '섹션 경계(하드클램프)에서 멈췄다 — 프레임 드래그가 좌표를 덮었다').toBeGreaterThan(HARD_MAX_LEFT);
  /* 두 핸들러가 같은 키를 번갈아 쓰면 style.left 와 dataset.offsetX 가 갈린다(실앱 떨림의 지문). */
  expect(Math.abs(left - offsetX),
    `style.left(${left}) 와 dataset.offsetX(${offsetX}) 가 갈렸다 — 두 핸들러가 번갈아 썼다`).toBeLessThanOrEqual(1);
});

test('F1-음성대조 ★가드 한 줄을 빼면 «하드클램프로 끌려오는» 실앱 증상이 그대로 재현된다', async ({ page }) => {
  await boot(page, { pre: true });
  await dragRight(page, DX);
  const { left, offsetX } = await stateOf(page);
  console.log(`[음성대조] left=${left} offsetX=${offsetX} (하드클램프=${HARD_MAX_LEFT}, 탄성기대=${EXPECT_ELASTIC})`);
  expect(left,
    `음성대조가 재현 안 됐다(left=${left}) — 이 검사는 결함을 못 잡는다. 하네스를 고쳐라`)
    .toBeLessThanOrEqual(HARD_MAX_LEFT);
});

test('F2 ★오버레이가 «아닌» 절대배치 프레임은 예전대로 프레임 드래그가 맡는다(가드가 과하지 않다)', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => { delete document.getElementById('ss1').dataset.overlayBlock; });
  await dragRight(page, DX);
  const { left } = await stateOf(page);
  expect(errs, `페이지 에러: ${errs.join(' | ')}`).toEqual([]);
  expect(left, `오버레이가 아닌 프레임인데 안 움직였다(left=${left}) — 가드가 너무 넓다`).toBeGreaterThan(0);
  expect(left, `하드 클램프 경계를 넘었다(left=${left}) — 프레임 드래그의 기존 규약이 바뀌었다`)
    .toBeLessThanOrEqual(HARD_MAX_LEFT);
});

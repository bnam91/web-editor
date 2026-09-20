/* overlay-extend-drag.dom.spec.js — 0920b T-052. 도형 오버레이의 «이동 드래그»가 텍스트와
 * 같은 수학을 타는가, 그리고 «회전 규약이 셋»이라는 함정을 실제로 넘는가.
 *
 * ★D2 가 이 파일의 이유다 — 회전각 규약이 타입마다 다르다:
 *     텍스트·에셋 dataset.rotation · 프레임 dataset.rotateDeg · ★도형 dataset.shapeRotation,
 *     게다가 도형은 그 값이 «래퍼»가 아니라 안쪽 .shape-block 에 있다(prop-shape.js applyShapeRotation).
 *   옛 코드는 `posEl.dataset.rotation` «하나»만 읽었다. 그대로 도형에 넓혔으면 45° 도형의
 *   탄성 클램프가 «회전 전 폭(200)» 기준으로 잡혀 경계가 26px 어긋난다 — 텍스트가 2026-09-16i
 *   에 앓은 병과 같은 뿌리. 이 검사는 그 둘(회전 반영 / 미반영)의 «기대값이 다른 자리»를
 *   골라 재서, 실제로 회전을 본 값이 나오는지 확인한다.
 *
 * ⛔앱을 «안» 띄운다. 진짜 mouse down/move/up(page.mouse, 합성 dispatchEvent 아님)으로 돌린다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-extend-drag
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const OVERLAY_FLOAT_JS = fs.readFileSync(path.join(REPO, 'js/overlay-float.js'), 'utf8');
const FRAME_GEOMETRY_JS = fs.readFileSync(path.join(REPO, 'js/frame-geometry.js'), 'utf8');
const SHAPE_FRAME_JS = fs.readFileSync(path.join(REPO, 'js/shape-frame.js'), 'utf8');

const SEC_W = 800, SEC_H = 400, BOX_W = 200, BOX_H = 120, START_TOP = 100;
const RESIST_ZONE = 40, MAGNET = 10, FACTOR = 0.35;

/* 원본 _elasticAxis 와 «같은 수학»을 테스트 쪽에서 다시 도출한다(베끼면 늘 맞는다). */
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
/* 회전한 상자의 축정렬 폭 — frame-geometry.js rotatedAABB 와 같은 식(독립 재도출). */
function aabbW(w, h, deg) {
  if (deg % 180 === 0) return w;
  const t = deg * Math.PI / 180;
  return Math.abs(Math.cos(t)) * w + Math.abs(Math.sin(t)) * h;
}
/* 드래그 후 예상 left — 회전 보정(clampW)을 «쓴/안 쓴» 두 갈래를 같은 식으로 만든다. */
function expectedLeft(rawX, clampW) {
  const visLeft = rawX + BOX_W / 2 - clampW / 2;
  const clamped = elastic(visLeft, Math.max(0, SEC_W - clampW));
  return clamped + clampW / 2 - BOX_W / 2;
}

function harness({ rotDeg = 0 } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; }
      .section-block { position: relative; width: ${SEC_W}px; height: ${SEC_H}px; background: #fff; }
      .frame-block[data-free-layout="true"] {
        position: absolute; width: ${BOX_W}px; height: ${BOX_H}px; background: rgba(0,0,255,0.12);
      }
      .shape-block {
        position: absolute; left: 0; top: 0; width: 100%; height: 100%;
        transform-origin: center center; background: rgba(255,0,0,0.3);
      }
      .shape-handle { position: absolute; width: 10px; height: 10px; right: -5px; bottom: -5px; background: #fff; border: 1px solid #333; }
    </style>
    </head><body>
    <div class="section-block" id="sec1">
      <div class="frame-block" data-free-layout="true" data-overlay-block="true" id="ss1"
           style="left:0px; top:${START_TOP}px;">
        <div class="shape-block" id="sh1" data-shape-type="rectangle"
             ${rotDeg ? `data-shape-rotation="${rotDeg}" style="transform: rotate(${rotDeg}deg);"` : ''}>
          <div class="shape-handle se" data-dir="se" id="h-se"></div>
        </div>
      </div>
    </div>
    <script>
      window.currentZoom = 100;
      window.pushHistory = () => {};
      window.scheduleAutoSave = () => {};
      window.triggerAutoSave = () => {};
      window._findSectionAt = () => null;
    </script>
    <script type="module" src="/overlay-float.js"></script>
    </body></html>`;
}

async function boot(page, opts = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: harness(opts) });
    if (url.pathname === '/overlay-float.js') return route.fulfill({ contentType: 'application/javascript', body: OVERLAY_FLOAT_JS });
    if (url.pathname === '/frame-geometry.js') return route.fulfill({ contentType: 'application/javascript', body: FRAME_GEOMETRY_JS });
    if (url.pathname === '/shape-frame.js') return route.fulfill({ contentType: 'application/javascript', body: SHAPE_FRAME_JS });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => !!window._bindOverlayMoveDrag);
  await page.evaluate(() => window._bindOverlayMoveDrag(document.getElementById('ss1')));
  return errs;
}

async function dragBy(page, dx, dy, { from = 'ss1' } = {}) {
  const c = await page.evaluate((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, from);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + dx / 2, c.y + dy / 2);
  await page.mouse.move(c.x + dx, c.y + dy);
  await page.mouse.up();
}
const leftOf = (page, id = 'ss1') => page.evaluate((i) => parseFloat(document.getElementById(i).style.left) || 0, id);

test('D1 ★도형 오버레이가 «텍스트와 같은» 탄성 저항 곡선을 탄다(회전 0)', async ({ page }) => {
  const errs = await boot(page);
  await dragBy(page, 700, 0);
  const left = await leftOf(page);
  const exp = expectedLeft(700, BOX_W);
  expect(errs, `페이지 에러: ${errs.join(' | ')}`).toEqual([]);
  expect(Math.abs(left - exp), `탄성 클램프 값이 다르다: left=${left}, expected=${exp}`).toBeLessThanOrEqual(1.5);
  expect(left, '섹션 경계에서 «하드»하게 멈췄다 — 탄성이 아니라 옛 하드클램프').toBeGreaterThan(SEC_W - BOX_W);
});

test('D2 ★회전 45° 도형 — 클램프 경계가 «회전 후 AABB» 기준이다(dataset.shapeRotation 을 읽는다)', async ({ page }) => {
  const errs = await boot(page, { rotDeg: 45 });
  /* 회전을 «본» 경계(AABB 226.3)는 넘지만, 회전을 «못 본» 경계(200)는 아직 안 넘는 자리를
     고른다 — 두 갈래의 기대값이 실제로 갈리는 구간이다(마그네틱 캐치 안쪽). */
  const DX = 592;
  await dragBy(page, DX, 0);
  const left = await leftOf(page);
  const clampW = aabbW(BOX_W, BOX_H, 45);
  const expRot  = expectedLeft(DX, clampW);   // 회전 반영(맞는 값)
  const expFlat = expectedLeft(DX, BOX_W);    // 회전 미반영(옛 dataset.rotation 만 읽던 코드)
  expect(errs, `페이지 에러: ${errs.join(' | ')}`).toEqual([]);
  expect(Math.abs(expRot - expFlat),
    '두 기대값이 같은 자리를 골랐다 — 이 검사는 아무것도 구분하지 못한다(DX 를 바꿔라)').toBeGreaterThan(2);
  expect(Math.abs(left - expRot),
    `회전 AABB 기준 클램프가 아니다: left=${left}, 회전반영=${expRot}, 회전미반영=${expFlat}`).toBeLessThanOrEqual(1.5);
});

test('D2-b [음성대조] 회전값을 지우면 «회전 미반영» 기대값이 나온다 — D2 가 실제로 회전을 본다', async ({ page }) => {
  await boot(page, { rotDeg: 45 });
  // 회전 «표식»만 지운다(그림은 그대로) — 옛 코드가 보던 상태와 같아진다
  await page.evaluate(() => { delete document.getElementById('sh1').dataset.shapeRotation; });
  const DX = 592;
  await dragBy(page, DX, 0);
  const left = await leftOf(page);
  const expFlat = expectedLeft(DX, BOX_W);
  expect(Math.abs(left - expFlat),
    `양성대조가 재현 안 됐다: left=${left}, 회전미반영 기대=${expFlat}`).toBeLessThanOrEqual(1.5);
});

test('D3 ★코너 리사이즈 핸들을 잡으면 이동 드래그가 «안» 걸린다(가드)', async ({ page }) => {
  await boot(page);
  const before = await leftOf(page);
  await dragBy(page, 120, 0, { from: 'h-se' });
  const after = await leftOf(page);
  expect(after, `핸들을 끌었는데 블록이 이동했다(${before}→${after}) — 크기조절이 이동에 먹힌다`).toBe(before);
});

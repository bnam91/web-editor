/* overlay-drag-rotation.dom.spec.js — T-037 후속 P0 (2026-09-16, 현빈 실측: "텍스트 오버레이
 * 후 90도 회전 후 좌우 이동이 안 되는거 같아").
 *
 * ★근본원인(재현 확정, 라이브 admin 인스턴스에서 직접 드래그로 확인): _bindOverlayMoveDrag가
 *   마우스다운 시점에 posEl.getBoundingClientRect()로 grabX/grabY를 구했다. 회전된 posEl의
 *   getBoundingClientRect()는 회전 «후» 화면상 축정렬 bounding box를 돌려준다(T-026과 같은
 *   병 — 90°에서 폭·높이가 뒤바뀐다). 그 값으로 만든 grabX/grabY를 이후 style.left/top(회전
 *   «전» 프레임 좌표계) 계산에 섞어 쓰면, 90°에서는 가로로만 끌어도 top이 요동쳤다(실측:
 *   좌우로만 100px 끌었는데 top이 -100 바뀌고 left는 그대로).
 *
 * ★처음 고친 방향(회전 행렬로 스크린 델타를 로컬로 보정)도 틀렸다 — style.left/top은 회전
 *   «전» 프레임의 위치이고 transform:rotate()는 그 프레임을 자기 중심으로 돌리기만 할 뿐
 *   위치를 안 옮기므로(변환 파이프라인상 이동과 자기중심 회전은 교환된다), 회전각과
 *   «무관하게» 스크린 델타를 그대로 로컬 델타로 더하면 된다 — 실측으로 되짚어 확정.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. prop-text-wireup-overlay.js
 *   원본을 실제 ES 모듈로 그대로 로드해서 진짜 mousedown/mousemove/mouseup(Playwright page.mouse,
 *   합성 dispatchEvent 아님)으로 돌린다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-drag-rotation
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const OVERLAY_JS = fs.readFileSync(path.join(REPO, 'js/props/prop-text-wireup-overlay.js'), 'utf8');

async function boot(page, { rotationDeg = 0, zoom = 40 } = {}) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; }
            .section-block { position: relative; width: 800px; height: 600px; background: #fff; }
            .frame-block[data-text-frame="true"] {
              position: absolute; width: 300px; height: 40px;
              transform-origin: center center;
              background: rgba(0,0,255,0.15);
            }
          </style>
          <script type="module" src="/overlay-wireup.js"></script>
          </head><body>
          <div class="section-block" id="sec1">
            <div class="frame-block" data-text-frame="true" data-overlay-block="true" id="tf1"
                 style="left:100px; top:150px; transform: rotate(${rotationDeg}deg);">
              <div class="tb-h2" contenteditable="false" id="txt1" style="width:100%;height:100%;">텍스트</div>
            </div>
          </div>
          <script>
            window.currentZoom = ${zoom};
            window.pushHistory = () => {};
            window.scheduleAutoSave = () => {};
            window.triggerAutoSave = () => {};
            window._findSectionAt = () => null;   // 다른 섹션 없음 — 재부모 경로는 이 파일에서 안 잰다
            window._clampToSection = (x, y) => [x, y];  // 클램프 무시(이 파일은 순수 델타만 잰다)
          </script>
          </body></html>`,
      });
    }
    if (url.pathname === '/overlay-wireup.js') {
      return route.fulfill({ contentType: 'application/javascript', body: OVERLAY_JS });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => !!window._bindOverlayMoveDrag);
  await page.evaluate(() => window._bindOverlayMoveDrag(document.getElementById('tf1')));
  return errs;
}

/** posEl 중심의 페이지 좌표(px)를 구한다. */
async function centerOf(page, id) {
  return page.evaluate((elId) => {
    const r = document.getElementById(elId).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, id);
}

async function dragBy(page, fromId, dxPage, dyPage) {
  const c = await centerOf(page, fromId);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  // 3px 미만 이동 무시 가드를 넘기기 위해 중간 지점을 하나 거친다.
  await page.mouse.move(c.x + dxPage / 2, c.y + dyPage / 2);
  await page.mouse.move(c.x + dxPage, c.y + dyPage);
  await page.mouse.up();
}

test('전제 — window._bindOverlayMoveDrag가 실제로 로드된다', async ({ page }) => {
  const errs = await boot(page, { rotationDeg: 0 });
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('R1 회전 0° — 순수 좌우 드래그는 top을 안 건드린다(회귀 없음, 기존 동작)', async ({ page }) => {
  await boot(page, { rotationDeg: 0, zoom: 100 });
  const before = await page.evaluate(() => ({
    left: document.getElementById('tf1').style.left,
    top: document.getElementById('tf1').style.top,
  }));
  await dragBy(page, 'tf1', 100, 0);
  const after = await page.evaluate(() => ({
    left: parseFloat(document.getElementById('tf1').style.left),
    top: parseFloat(document.getElementById('tf1').style.top),
  }));
  expect(after.top, `top이 바뀌었다(회전 0°인데): ${before.top} → ${after.top}`).toBeCloseTo(parseFloat(before.top), 0);
  expect(after.left, `left가 안 바뀌었다(가로 드래그인데): ${before.left} → ${after.left}`).toBeCloseTo(100 + 100, 0);
});

test('R2 ★핵심 — 회전 90° + 순수 좌우 드래그는 top을 «안» 건드린다(재현했던 버그)', async ({ page }) => {
  await boot(page, { rotationDeg: 90, zoom: 100 });
  const before = await page.evaluate(() => ({
    left: parseFloat(document.getElementById('tf1').style.left),
    top: parseFloat(document.getElementById('tf1').style.top),
  }));
  await dragBy(page, 'tf1', 100, 0);
  const after = await page.evaluate(() => ({
    left: parseFloat(document.getElementById('tf1').style.left),
    top: parseFloat(document.getElementById('tf1').style.top),
  }));
  expect(after.top, `★버그 재현 — 90° 회전 상태에서 가로로만 끌었는데 top이 ${before.top} → ${after.top} 로 바뀌었다`)
    .toBeCloseTo(before.top, 0);
  expect(after.left, `left가 가로 드래그만큼(+100) 안 바뀌었다: ${before.left} → ${after.left}`)
    .toBeCloseTo(before.left + 100, 0);
});

test('R3 회전 90° + 순수 상하 드래그는 left를 안 건드린다(top만 바뀐다)', async ({ page }) => {
  await boot(page, { rotationDeg: 90, zoom: 100 });
  const before = await page.evaluate(() => ({
    left: parseFloat(document.getElementById('tf1').style.left),
    top: parseFloat(document.getElementById('tf1').style.top),
  }));
  await dragBy(page, 'tf1', 0, 100);
  const after = await page.evaluate(() => ({
    left: parseFloat(document.getElementById('tf1').style.left),
    top: parseFloat(document.getElementById('tf1').style.top),
  }));
  expect(after.left, `left가 바뀌었다(세로 드래그인데): ${before.left} → ${after.left}`).toBeCloseTo(before.left, 0);
  expect(after.top, `top이 세로 드래그만큼(+100) 안 바뀌었다: ${before.top} → ${after.top}`).toBeCloseTo(before.top + 100, 0);
});

test('R4 회전 45°에서도 좌우 드래그는 top을 안 건드린다(90°만의 우연 보정이 아님을 확인)', async ({ page }) => {
  await boot(page, { rotationDeg: 45, zoom: 100 });
  const before = await page.evaluate(() => ({
    left: parseFloat(document.getElementById('tf1').style.left),
    top: parseFloat(document.getElementById('tf1').style.top),
  }));
  await dragBy(page, 'tf1', 120, 0);
  const after = await page.evaluate(() => ({
    left: parseFloat(document.getElementById('tf1').style.left),
    top: parseFloat(document.getElementById('tf1').style.top),
  }));
  expect(after.top, `45° 회전에서 top이 바뀌었다: ${before.top} → ${after.top}`).toBeCloseTo(before.top, 0);
  expect(after.left).toBeCloseTo(before.left + 120, 0);
});

test('R5 줌 40%에서도 드래그량이 줌 배율만큼 정확히 나뉜다(스크린 100px → 로컬 250px)', async ({ page }) => {
  await boot(page, { rotationDeg: 90, zoom: 40 });
  const before = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.top));
  await dragBy(page, 'tf1', 0, 100);   // 화면 100px, 줌 40% → 로컬 250px
  const after = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.top));
  expect(after - before, `줌 보정이 안 맞다: Δtop=${after - before} (기대 250 근처)`).toBeCloseTo(250, 0);
});

test('R6 [양성대조] getBoundingClientRect 기반 옛 산식으로 되돌리면 R2가 실패한다', async ({ page }) => {
  // ★이 검사가 실제로 그 회귀를 겨눈다는 증거 — 원문의 delta 산식을 지우고 옛(버그) 산식을
  //   흉내내는 별도 핸들러를 심어, «고치기 전 동작»이 실제로 top을 움직인다는 걸 재현한다.
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><body>
          <div class="section-block" style="position:relative;width:800px;height:600px;">
            <div class="frame-block" data-text-frame="true" id="tf1"
                 style="position:absolute; width:300px; height:40px; left:100px; top:150px;
                        transform: rotate(90deg); transform-origin:center center;">
              <div id="txt1" style="width:100%;height:100%;">텍스트</div>
            </div>
          </div>
          <script>
            window.currentZoom = 100;
            const posEl = document.getElementById('tf1');
            posEl.addEventListener('mousedown', e => {
              const r = posEl.getBoundingClientRect();   // ★옛(버그) 산식 — 회전된 bbox
              const grabX = e.clientX - r.left, grabY = e.clientY - r.top;
              const sec = posEl.closest('.section-block');
              const onMove = ev => {
                const sr = sec.getBoundingClientRect();
                posEl.style.left = ((ev.clientX - sr.left) - grabX) + 'px';
                posEl.style.top  = ((ev.clientY - sr.top) - grabY) + 'px';
              };
              const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            });
          </script>
          </body></html>`,
      });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  const before = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.top));
  await dragBy(page, 'tf1', 100, 0);
  const after = await page.evaluate(() => parseFloat(document.getElementById('tf1').style.top));
  expect(Math.abs(after - before), `양성대조가 재현 안 됨 — 옛 산식도 top을 안 건드렸다면 R2가 이 결함을 못 본다는 뜻`).toBeGreaterThan(20);
});

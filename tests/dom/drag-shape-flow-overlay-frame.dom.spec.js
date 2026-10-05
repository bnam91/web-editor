/* drag-shape-flow-overlay-frame.dom.spec.js — 끌리지 않던 두 꼴 (lane-drag · 2026-10-05 · 현빈 → 지디 → 태양)
 *
 * D1 · 섹션 «흐름»에 놓인 도형 래퍼(addShapeBlock 섹션 레벨 꼴 = 지금 새로 만드는 꼴)를 끌면 아무 일도 없다.
 *   실앱 실측(격리 9370 · 사본 proj_1790933370176 · 배율 0.4): shp_ts0he_ztaq2a7 / hlz0fdr · 새로 만든 도형 —
 *   «안 고르고 끌기 / 클릭 뒤 끌기» 넷 다 Δ0,0 · dragstart 0.
 *   기구: 래퍼 draggable 이 누르는 동안 true→false→true (bindFrameDropZone pointerdown 이 안쪽 .shape-block 을 보고
 *   «자식 드래그 중»이라 프레임 drag 를 끈다) · 그런데 그 자식 드래그(bindBlock isShape 갈래)는 래퍼가 absolute 가
 *   아니라 return ⇒ 두 길이 서로 미루고 아무도 안 끈다.
 *   ⇒ 흐름 래퍼는 다른 흐름 단위처럼 «순서 바꾸기(HTML5 drag)»로 끌린다. absolute 래퍼(옛 꼴)는 그대로 «좌표 이동».
 *
 * D2 · 다시 연 뒤(로드 경로) 오버레이 «프레임»(스티커 그룹 ss_ts0he_bkyuqva)이 안 끌린다.
 *   실측: _overlayMoveBound false · 끌기 Δ0,0. 프레임은 bindBlock 을 안 타고(block-factory.js 섹션 바인딩 셀렉터에
 *   .frame-block 없음) bindFrameDropZone 만 탄다 — 그 absolute 갈래는 오버레이면 return 한다(전용 드래그 몫) ⇒
 *   표식을 «쓰는» 세 자리(enterFloat · 오버레이 묶기 · 그룹 풀기) 밖, HTML 에서 «다시 태어난» 오버레이 프레임은
 *   받아줄 드래그가 없다. 고침 = bindFrameDropZone 에서 bindFloatMoveDrag 를 «걸기만» 한다.
 *   ★둘 다 돌면 안 된다 — 전용(onUp pushHistory('오버레이 이동'))과 옛 absolute 셀 드래그(onUp pushHistory() = '')를
 *     push 라벨로 가른다: 정확히 ['오버레이 이동'] 이어야 한다.
 *
 * ⛔앱을 «안» 띄운다 — js/block-drag.js 를 진짜 ES 모듈로 얹고 로드 경로와 같은 배선(bindBlock · bindFrameDropZone)만 부른다.
 *   마우스는 page.mouse(진짜 입력). 사람 순서 실측은 reports/lane-drag 실앱 표가 진다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/drag-shape-flow-overlay-frame.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin:0; }
  #canvas-wrap { position:relative; width:1000px; height:800px; background:#555; }
  .section-block { position:relative; width:800px; height:600px; background:#fff; }
  .section-inner { position:relative; }
  .frame-block { position:relative; overflow:hidden; }
  .shape-block { width:100%; height:100%; background:#99c; }
  .icon-circle-block { width:120px; height:120px; background:#c99; }
</style></head><body>
<div id="canvas-wrap">
  <div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0">
    <div id="canvas">
      <div class="section-block" id="sec"><div class="section-inner" id="inner"></div></div>
    </div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<script src="/js/feature-flags.js"></script>
<script>
  window.currentZoom = 100;
  window.__pushes = [];
  window.pushHistory = (label) => window.__pushes.push(label || '');
  window.scheduleAutoSave = () => {};
  window.triggerAutoSave = () => {};
  window.buildLayerPanel = () => {};
  window.beginDragHistory = () => ({ arm: () => {} });
  window._findSectionAt = () => null;
  window.deselectAll = () => document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  window.__ev = [];
  document.addEventListener('dragstart', e => window.__ev.push('dragstart:' + (e.target.id || '')), true);
</script>
<script type="module">
  import '/js/block-drag.js';                  // window.bindBlock · window.bindFrameDropZone
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true && typeof window.bindBlock === 'function' && typeof window.bindFrameDropZone === 'function');
  return errs;
}

const centerOf = (page, id) => page.evaluate((id) => {
  const r = document.getElementById(id).getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
}, id);

test('전제 — block-drag.js 가 콘솔 오류 없이 얹힌다', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

/* ── D1 ── 섹션 흐름 도형 래퍼(사본의 꼴 그대로: 래퍼 100×100 free-layout · 위치 없음 · 도형 absolute 0,0) */
async function mountFlowShape(page) {
  return page.evaluate(() => {
    const inner = document.getElementById('inner');
    inner.innerHTML = '<div class="gap-block" id="g0" style="height:40px"></div>' +
      '<div class="frame-block" id="sf" data-free-layout="true" data-layer-name="rectangle" draggable="true" style="width:100px;height:100px;padding:0">' +
      '<div class="shape-block" id="shp" data-type="shape" style="position:absolute;left:0;top:0"></div></div>' +
      '<div class="gap-block" id="g1" style="height:40px"></div>';
    const sf = document.getElementById('sf'), shp = document.getElementById('shp');
    window.bindBlock(shp);
    window.bindFrameDropZone(sf);       // ★로드 경로가 하는 배선 그대로
    window.__ev = [];
    return true;
  });
}

test('D1a ★흐름 도형 래퍼 — 도형 위를 누르는 동안 래퍼 draggable 이 꺼지지 않는다', async ({ page }) => {
  await boot(page);
  await mountFlowShape(page);
  const c = await centerOf(page, 'shp');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  const during = await page.evaluate(() => document.getElementById('sf').getAttribute('draggable'));
  await page.mouse.up();
  expect(during, `누르는 동안 래퍼 draggable=${during} (고치기 전 실측 = false)`).toBe('true');
});

test('D1b ★흐름 도형 래퍼 — 끌면 래퍼에서 HTML5 dragstart 가 난다(= 순서 바꾸기 길이 열린다)', async ({ page }) => {
  await boot(page);
  await mountFlowShape(page);
  const c = await centerOf(page, 'shp');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 10, c.y + 30);
  await page.mouse.move(c.x + 20, c.y + 120);
  const ev = await page.evaluate(() => window.__ev.slice());
  const sel = await page.evaluate(() => document.getElementById('sf').classList.contains('selected'));
  await page.mouse.up();
  expect(ev, `dragstart 기록=${JSON.stringify(ev)} (고치기 전 실측 = 0건)`).toContain('dragstart:sf');
  expect(sel, '래퍼가 골라져야 _bindFrameOwnDrag 의 selected 게이트를 넘는다').toBe(true);
});

/* ── D1 양성대조(옛 꼴) — 자유 프레임 안 absolute 래퍼: 고른 도형을 끌면 «래퍼»가 좌표로 움직인다 ── */
test('D1c 옛 꼴 — 자유 프레임 안 absolute 도형 래퍼는 지금처럼 좌표로 움직인다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const inner = document.getElementById('inner');
    inner.innerHTML = '<div class="frame-block" id="fr" data-free-layout="true" style="width:500px;height:360px;padding:0">' +
      '<div class="frame-block" id="sf2" data-free-layout="true" style="position:absolute;left:20px;top:30px;width:100px;height:100px;padding:0">' +
      '<div class="shape-block" id="shp2" data-type="shape" style="position:absolute;left:0;top:0"></div></div></div>';
    window.bindFrameDropZone(document.getElementById('fr'));
    window.bindFrameDropZone(document.getElementById('sf2'));
    window.bindBlock(document.getElementById('shp2'));
    /* 사람 순서(실앱 ㉠ C1): 도형 자리 첫 클릭은 «부모 프레임»을 고른다(고르지 않은 프레임의 자식은 pointer-events none
       — 실측 hit = 부모 프레임) → 그 뒤 도형 위를 끌면 래퍼의 absolute 셀 드래그가 움직인다(실측 20,226 → 120,261). */
    const fr = document.getElementById('fr');
    fr.classList.add('selected'); window._activeFrame = fr;
    return true;
  });
  const c = await centerOf(page, 'shp2');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 50, c.y + 20);
  await page.mouse.move(c.x + 100, c.y + 40);
  await page.mouse.up();
  const p = await page.evaluate(() => { const e = document.getElementById('sf2'); return { L: parseFloat(e.style.left), T: parseFloat(e.style.top), par: e.parentElement.id }; });
  expect(p, `옛 꼴 래퍼 자리=${JSON.stringify(p)}`).toEqual({ L: 120, T: 70, par: 'fr' });
});

/* ── D2 ── 로드된 오버레이 그룹 프레임(사본의 꼴: 섹션 직속 · absolute · group · free · overlay · 자식 absolute) */
async function mountOverlayGroup(page) {
  return page.evaluate(() => {
    const sec = document.getElementById('sec');
    sec.querySelectorAll(':scope > .frame-block').forEach(e => e.remove());
    const g = document.createElement('div');
    g.className = 'frame-block'; g.id = 'grp';
    g.dataset.freeLayout = 'true'; g.dataset.group = 'true'; g.dataset.overlayBlock = 'true'; g.dataset.selVariant = 'sticker';
    g.dataset.offsetX = '100'; g.dataset.offsetY = '80';
    g.style.cssText = 'position:absolute;left:100px;top:80px;width:200px;height:200px;padding:0;background:transparent';
    g.innerHTML = '<div class="icon-circle-block" id="icb" style="position:absolute;left:0;top:0"></div>';
    sec.appendChild(g);
    window.bindFrameDropZone(g);         // ★로드 경로(rebindAll · _bindPastedEl …)가 프레임에 거는 «유일한» 배선
    window.bindBlock(document.getElementById('icb'));
    window.__pushes = [];
    return { bound: !!g._overlayMoveBound };
  });
}

test('D2a ★로드된 오버레이 프레임에 전용 이동 드래그가 걸린다', async ({ page }) => {
  await boot(page);
  const m = await mountOverlayGroup(page);
  expect(m.bound, `_overlayMoveBound=${m.bound} (고치기 전 실측 = false)`).toBe(true);
});

test('D2b ★로드된 오버레이 프레임을 끌면 움직이고, 전용 드래그 «하나만» 돈다', async ({ page }) => {
  await boot(page);
  await mountOverlayGroup(page);
  const c = await centerOf(page, 'icb');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 30, c.y + 20);
  await page.mouse.move(c.x + 60, c.y + 40);
  await page.mouse.up();
  const p = await page.evaluate(() => { const g = document.getElementById('grp'); return { L: parseFloat(g.style.left), T: parseFloat(g.style.top), ox: +g.dataset.offsetX, oy: +g.dataset.offsetY, pushes: window.__pushes.slice() }; });
  expect({ L: p.L, T: p.T }, `그룹 자리=${JSON.stringify(p)} (고치기 전 실측 = 100,80 그대로)`).toEqual({ L: 160, T: 120 });
  expect({ ox: p.ox, oy: p.oy }, 'dataset 이 따라와야 한다').toEqual({ ox: 160, oy: 120 });
  expect(p.pushes, `push 라벨=${JSON.stringify(p.pushes)} — 옛 absolute 셀 드래그가 같이 돌면 '' 가 섞인다`).toEqual(['오버레이 이동']);
});

/* ── D5 (lane-drag 10-05 · 우리가 찾은 것) — 옛 꼴에서 «클릭 2번»(프레임 → 도형)으로 도형을 고른 뒤 끌면
   래퍼가 프레임 밖으로 빠졌다(실앱 ㉠: (100,75)모델 끌기 → section-inner 로 추출).
   까닭: bindBlock 끌어내기 판정 부모가 dragEl.closest(free) = «래퍼 자신»(free-layout 기본 · 100×100) → 중심이 100+60 을 넘으면 끌어내기.
   ⚠️D1c 는 «클릭 1번»(부모 프레임 고름) 장면이라 이 갈래(bindBlock)를 안 타서 D5 를 못 잡았다 — 그래서 따로 둔다. */
async function mountOldShapeSelected(page) {
  await page.evaluate(() => {
    const inner = document.getElementById('inner');
    inner.innerHTML = '<div class="frame-block" id="fr" data-free-layout="true" style="width:500px;height:360px;padding:0">' +
      '<div class="frame-block" id="sf2" data-free-layout="true" style="position:absolute;left:20px;top:30px;width:100px;height:100px;padding:0">' +
      '<div class="shape-block" id="shp2" data-type="shape" style="position:absolute;left:0;top:0"></div></div></div>';
    window.bindFrameDropZone(document.getElementById('fr'));
    window.bindFrameDropZone(document.getElementById('sf2'));
    window.bindBlock(document.getElementById('shp2'));
    window.selectShapeBlock(document.getElementById('shp2'));   // 클릭 2번째 = 도형 고름(래퍼+도형 selected)
    return true;
  });
}
const sf2State = (page) => page.evaluate(() => { const e = document.getElementById('sf2'); return { L: parseFloat(e.style.left), T: parseFloat(e.style.top), par: e.parentElement.id || e.parentElement.className }; });

test('D5a ★옛 꼴 · 도형을 고른 뒤 끌면 래퍼가 «프레임 안»에서 움직인다(밖으로 안 빠진다)', async ({ page }) => {
  await boot(page);
  await mountOldShapeSelected(page);
  const c = await centerOf(page, 'shp2');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 50, c.y + 20);
  await page.mouse.move(c.x + 100, c.y + 40);
  await page.mouse.up();
  const p = await sf2State(page);
  expect(p, `래퍼 자리=${JSON.stringify(p)} (고치기 전 실측 = 프레임 밖 section-inner 로 추출)`).toEqual({ L: 120, T: 70, par: 'fr' });
});

test('D5b 음성대조 · 진짜 프레임 «밖» 멀리 끌면 여전히 끌어내기 된다(의도된 기능 회귀 0)', async ({ page }) => {
  await boot(page);
  await mountOldShapeSelected(page);
  const c = await centerOf(page, 'shp2');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 300, c.y);
  await page.mouse.move(c.x + 600, c.y);      // 중심 x = 20+600+50 = 670 > 프레임 500 + 여유 60
  await page.mouse.up();
  const p = await page.evaluate(() => { const e = document.getElementById('sf2'); return { par: e.parentElement.id || e.parentElement.className, pos: e.style.position }; });
  expect(p, `끌어내기 결과=${JSON.stringify(p)}`).toEqual({ par: 'inner', pos: '' });
});

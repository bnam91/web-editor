/* gradient-canvas-picker-sync.dom.spec.js — 0918 canvasgrad: 캔버스 그라데이션 바 ↔ 컬러피커 스탑 양방향 동기.
 *
 * 고치기 전 결함(planner 실측): 캔버스→패널은 «스와치 배경만» 바꿨다. 열린 피커의 스탑 썸네일·
 *   재오픈 시드(dataset.cpGradient)는 그대로라 캔버스에서 바꾼 뒤 피커를 다시 열면 옛 값으로
 *   돌아갔다. 패널→캔버스는 «선택 스탑» 개념이 없었다. _seedGradientUI 는 angle 0 을 90 으로 둔갑.
 *
 * ⛔앱을 «안» 띄운다. color-picker.js(import 없는 모듈) + gradient-model.js + gradient-line-overlay.js
 *   + editor-blocks.css + color-picker.css 원문만 로드. prop-shape.js 의 배선(goya-cp:gradient →
 *   dataset 쓰기 → showGradientLine)은 하네스에서 같은 모양으로 흉내 낸다.
 * 실행: npm run test:dom -- gradient-canvas-picker-sync
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const FILES = {
  '/js/gradient-line-overlay.js': read('js/gradient-line-overlay.js'),
  '/js/props/gradient-model.js': read('js/props/gradient-model.js'),
  '/js/props/color-picker.js': read('js/props/color-picker.js'),
};
const BLOCKS_CSS = read('css/editor-blocks.css');
const CP_CSS = read('css/color-picker.css');
const CSS3 = 'linear-gradient(90deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)';

async function boot(page, { bind = true } = {}) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>${BLOCKS_CSS}</style><style>${CP_CSS}</style>
          <style>body{margin:0}.section-block{position:relative;}</style>
          <script>
            window.__hist = 0; window.pushHistory = () => { window.__hist++; };
            window.scheduleAutoSave = () => {};
            window.__emits = 0;
          </script>
          <script type="module">
            import './js/props/color-picker.js';
            import './js/gradient-line-overlay.js';
            const block = document.getElementById('shp');
            const inp = document.getElementById('shape-color-color');
            // prop-shape.js 배선 흉내: 피커 emit → dataset 쓰기 + 재오픈 시드 + 캔버스 재배치
            inp.addEventListener('goya-cp:gradient', (e) => {
              window.__emits++;
              block.dataset.shapeColor = e.detail.css;
              inp.dataset.cpGradient = JSON.stringify({ type: e.detail.type, angle: e.detail.angle, stops: e.detail.stops });
              window.showGradientLine(block);
            });
            window.showGradientLine(block);
            if (${bind}) window.bindGradientLinePicker(block, inp);
            window.__ready = true;
          </script>
          </head><body>
          <div class="section-block" style="width:900px;height:700px;">
            <div class="frame-block" style="position:absolute;left:80px;top:120px;width:300px;height:300px;">
              <div class="shape-block selected" id="shp" data-shape-type="rectangle" data-shape-color="${CSS3}">
                <svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;display:block"><rect width="100" height="100"/></svg>
              </div>
            </div>
            <div style="position:absolute;left:560px;top:40px;" class="prop-color-field">
              <div class="prop-color-swatch" id="sw" style="width:24px;height:24px;background:${CSS3}">
                <input type="color" id="shape-color-color" value="#ff0000">
              </div>
            </div>
          </div>
          </body></html>`,
      });
    }
    if (FILES[url.pathname]) return route.fulfill({ contentType: 'application/javascript', body: FILES[url.pathname] });
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

async function openPicker(page) {
  const r = await page.evaluate(() => { const b = document.getElementById('sw').getBoundingClientRect(); return { x: b.left + 12, y: b.top + 12 }; });
  await page.mouse.click(r.x, r.y);
  await page.waitForFunction(() => { const p = document.querySelector('.goya-cp-popover'); return p && !p.hidden; });
}
const pickerState = (page) => page.evaluate(() => {
  const pop = document.querySelector('.goya-cp-popover');
  const thumbs = [...pop.querySelectorAll('.goya-cp-grad-thumb')];
  return {
    open: !pop.hidden,
    tab: pop.querySelector('.goya-cp-tab.active')?.dataset.tab,
    lefts: thumbs.map(t => Math.round(parseFloat(t.style.left))),
    active: thumbs.map(t => t.classList.contains('is-active')),
    angle: pop.querySelector('[data-el="gradAngleNum"]').value,
  };
});

async function dragCanvasChip(page, idx, frac) {
  const pos = await page.evaluate(({ idx, frac }) => {
    const b = document.getElementById('shp');
    const refs = b._gradLine;
    const r = refs.chips[idx].getBoundingClientRect();
    const or = refs.overlay.getBoundingClientRect();
    const ln = window.GradientModel.gradientLine(refs.model, { space: 'bbox', w: 1, h: 1 });
    return {
      from: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      to: { x: or.left + (ln.p0.x + (ln.p1.x - ln.p0.x) * frac) * or.width, y: or.top + (ln.p0.y + (ln.p1.y - ln.p0.y) * frac) * or.height },
    };
  }, { idx, frac });
  await page.mouse.move(pos.from.x, pos.from.y);
  await page.mouse.down();
  await page.mouse.move(pos.to.x, pos.to.y, { steps: 6 });
  await page.mouse.up();
}

test('S1 캔버스 칩 드래그 → 열린 피커 썸네일 위치·선택이 캔버스와 같고, goya-cp:gradient 재발행 0회(루프 없음), 피커 안 닫힘', async ({ page }) => {
  const errs = await boot(page);
  await openPicker(page);
  const s0 = await pickerState(page);
  expect(s0.tab, 'bind 가 dataset.cpGradient 를 시드 → 그라데이션 탭으로 열려야').toBe('gradient');
  expect(s0.lefts).toEqual([0, 50, 100]);
  await page.evaluate(() => { window.__emits = 0; window.__hist = 0; });
  await dragCanvasChip(page, 1, 0.7);
  const s1 = await pickerState(page);
  expect(s1.open, '캔버스 칩을 잡았더니 피커가 outside-click 으로 닫혔다').toBe(true);
  expect(s1.lefts).toEqual([0, 70, 100]);
  expect(s1.active).toEqual([false, true, false]);
  const out = await page.evaluate(() => ({ emits: window.__emits, hist: window.__hist, css: document.getElementById('shp').dataset.shapeColor }));
  expect(out.emits, '동기화가 goya-cp:gradient 를 되쏘면 prop→showGradientLine→… 루프').toBe(0);
  expect(out.hist).toBe(1);
  expect(out.css).toBe('linear-gradient(90deg, #ff0000 0%, #00ff00 70%, #0000ff 100%)');
  expect(errs).toEqual([]);
});

test('S2 피커 썸네일 mousedown → 캔버스 칩 선택 이동', async ({ page }) => {
  const errs = await boot(page);
  await openPicker(page);
  const r = await page.evaluate(() => {
    const t = document.querySelectorAll('.goya-cp-popover .goya-cp-grad-thumb')[2].getBoundingClientRect();
    return { x: t.left + t.width / 2, y: t.top + t.height / 2 };
  });
  await page.mouse.move(r.x, r.y);
  await page.mouse.down();
  await page.mouse.up();
  const sel = await page.evaluate(() => [...document.querySelectorAll('#shp .grad-stop-chip')].map(c => c.classList.contains('is-selected')));
  expect(sel).toEqual([false, false, true]);
  // 반대로 캔버스 칩 클릭 → 피커 선택 썸네일 이동
  const c = await page.evaluate(() => { const r = document.getElementById('shp')._gradLine.chips[0].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(c.x, c.y);
  expect((await pickerState(page)).active).toEqual([true, false, false]);
  expect(errs).toEqual([]);
});

test('S3 ★캔버스에서 바꾼 뒤 피커 닫고 다시 열면 새 값(70%)으로 복원 — dataset.cpGradient 시드', async ({ page }) => {
  const errs = await boot(page);
  await openPicker(page);
  await page.evaluate(() => window.closeGoyaColorPicker());
  await dragCanvasChip(page, 1, 0.7);
  await openPicker(page);
  const s = await pickerState(page);
  expect(s.tab).toBe('gradient');
  expect(s.lefts).toEqual([0, 70, 100]);
  expect(errs).toEqual([]);
});

test('S3-음성대조 — bindGradientLinePicker 없이(=고치기 전 배선) 같은 조작이면 재오픈이 옛 값(50%)으로 돌아간다', async ({ page }) => {
  const errs = await boot(page, { bind: false });
  // 고치기 전에도 피커 emit 한 번은 시드를 남겼다 — 같은 조건을 만들려고 옛 값으로 시드
  await page.evaluate((css) => {
    document.getElementById('shape-color-color').dataset.cpGradient = JSON.stringify(window.GradientModel.parseGradient(css));
  }, CSS3);
  await dragCanvasChip(page, 1, 0.7);
  await openPicker(page);
  const s = await pickerState(page);
  expect(s.lefts, '음성대조가 새 값을 보이면 이 하네스가 결함을 재현 못 하는 것').toEqual([0, 50, 100]);
  expect(errs).toEqual([]);
});

test('S4 angle 0 시드 → 각도 필드 0 (90 둔갑 회귀)', async ({ page }) => {
  const errs = await boot(page, { bind: false });
  await page.evaluate(() => {
    document.getElementById('shape-color-color').dataset.cpGradient = JSON.stringify({
      type: 'linear', angle: 0, stops: [{ color: '#ff0000', offset: 0, opacity: 1 }, { color: '#0000ff', offset: 1, opacity: 1 }],
    });
  });
  await openPicker(page);
  expect((await pickerState(page)).angle).toBe('0');
  expect(errs).toEqual([]);
});

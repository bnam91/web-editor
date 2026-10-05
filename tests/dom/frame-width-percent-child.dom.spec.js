/* frame-width-percent-child.dom.spec.js — E166 (lane-drag · 2026-10-05 · 0.9.6 · D3 와 짝)
 *
 * 자유 프레임 폭을 패널(#ss-width-num)로 바꾸면 «폭 100% 글자»가 78px 로 쪼그라들고 왼쪽으로 붙었다.
 *   실앱 ㉠(사본 · 0.4 · 516→400): base 0f572e2a 와 고친 판(D3) 둘 다 style.width 100% → 78px · 글자 가운데 − 프레임 가운데 0 → −64.4.
 *   기구(코드독해): prop-frame.js applyWidth — curW = parseInt(block.style.width …) 가 '100%' 를 100 으로 읽고 ×0.775 = 78px.
 *   꼴 전수(reports/lane-drag/E166-CENSUS.md): 자유 프레임 직속 absolute 자식 1038 중 % 95 가 오독 대상.
 * 고침 = 폭이 px 이거나 비었을 때만 비율로 바꾼다(%·calc·키워드는 이미 부모를 따라간다).
 * ★양성대조 숫자(지디 ㉢): px 글자(74px · left 421)는 D3 실앱과 «같은 수»로 비율 이동(57px · 326) = 지금도 맞는 갈래 — 그대로여야 한다.
 *
 * ⛔앱을 «안» 띄운다 — prop-frame.js 를 진짜 모듈로 얹고 showFrameProperties → 패널 숫자칸에 진짜 타이핑.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/frame-width-percent-child.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin:0; display:flex; font: 32px/1.4 sans-serif; }
  #canvas-wrap { position:relative; width:900px; height:700px; background:#555; }
  .section-block { position:relative; width:860px; background:#fff; }
  .section-inner { display:flex; flex-direction:column; }
  .frame-block { position:relative; overflow:hidden; }
  #panel-right { width:320px; font-size:13px; }
</style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0"><div id="canvas">
  <div class="section-block" id="sec"><div class="section-inner" id="inner">
    <div class="frame-block" id="fr" data-free-layout="true" data-width="516" data-height="361" style="background:#fff;padding:0;width:516px;max-width:100%;margin:0 auto;min-height:361px;height:361px">
      <div class="frame-block" id="tfP" data-text-frame="true" data-width="100%" style="background:transparent;width:100%;box-sizing:border-box;position:absolute;left:0px;top:40px"><div class="text-block" id="tbP"><div class="tb-body" style="text-align:center">25%</div></div></div>
      <div class="frame-block" id="tfX" data-text-frame="true" data-width="74" style="background:transparent;width:74px;box-sizing:border-box;position:absolute;left:421px;top:200px"><div class="text-block" id="tbX"><div class="tb-body" style="text-align:center">25%</div></div></div>
    </div>
  </div></div>
</div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script>
  window.state = { pageSettings: { padX: 0 } };
  window.pushHistory = () => {}; window.scheduleAutoSave = () => {}; window.triggerAutoSave = () => {};
  window.buildLayerPanel = () => {}; window.showFrameHandles = () => {};
</script>
<script type="module">
  import '/js/props/prop-frame.js';
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
  await page.waitForFunction(() => window.__ready === true && typeof window.showFrameProperties === 'function');
  return errs;
}

const glyph = (page, tb, tf) => page.evaluate(({ tb, tf }) => {
  const n = document.querySelector(`#${tb} .tb-body`).firstChild; const r = document.createRange(); r.selectNodeContents(n);
  const b = r.getBoundingClientRect(); const f = document.getElementById('fr').getBoundingClientRect(); const e = document.getElementById(tf);
  return { w: e.style.width, L: e.style.left, off: Math.round(((b.left + b.right) / 2 - (f.left + f.right) / 2) * 10) / 10 };
}, { tb, tf });

async function setWidth(page, v) {
  await page.evaluate(() => window.showFrameProperties(document.getElementById('fr')));
  /* ⚠️«한 번에» 넣는다(fill = input 1번). 글자마다 치면 «4 → 40 → 400» 중간값이 최소값으로 죄어져 매번 자식을 다시 비율로 바꿔
     반올림이 쌓인다(첫 판: px 글자 58px — 실앱 57). 그건 E166 과 다른 병이라 여기선 «비율 한 번»만 잰다(곁 관찰로 보고). */
  const num = page.locator('#ss-width-num');
  await num.fill(String(v));
  await num.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
}

test('전제 — prop-frame.js 가 콘솔 오류 없이 얹히고 패널 폭 칸이 선다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => window.showFrameProperties(document.getElementById('fr')));
  expect(await page.locator('#ss-width-num').count(), '폭 숫자칸').toBe(1);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('E1 ★프레임 폭 516→400 — 폭 100% 글자는 100% 그대로 · 가운데 그대로', async ({ page }) => {
  await boot(page);
  const b = await glyph(page, 'tbP', 'tfP');
  await setWidth(page, 400);
  const a = await glyph(page, 'tbP', 'tfP');
  expect(await page.evaluate(() => document.getElementById('fr').offsetWidth), '프레임 폭이 400 이 됐다(장면)').toBe(400);
  expect({ w: a.w, off: Math.abs(a.off) <= 1 }, `전=${JSON.stringify(b)} 뒤=${JSON.stringify(a)} (고치기 전 실앱 = 78px · −64.4)`).toEqual({ w: '100%', off: true });
});

test('E2 양성대조 숫자 · px 글자(74px · left 421)는 D3 실앱과 같은 수로 비율 이동(57px · left 326)', async ({ page }) => {
  await boot(page);
  await setWidth(page, 400);
  const a = await glyph(page, 'tbX', 'tfX');
  expect({ w: a.w, L: a.L }, `뒤=${JSON.stringify(a)}`).toEqual({ w: '57px', L: '326px' });
});

/* qa0920b-asset-width-set.dom.spec.js — 0920b 통합 QA 반영(medium).
 *
 * ★무엇이 깨졌나 — «풀블리드(패딩제외) 에셋»은 width:calc(100% + 2·padX) 와 음수마진
 *   -padX 를 «세트»로 갖는다(prop-page.js applyAssetFullBleed 의 「세트 규약」). 그런데
 *   폭을 «줄이는» 자리 둘(prop-asset.js 슬라이더/숫자칸 · overlay-handles.js 에셋 리사이즈)이
 *   각자 `style.width = px` 만 쓰고 음수마진을 안 걷어내, width=400px + margin=-72px 라는
 *   반쪽 세트가 DOM·저장본에 굳었다. 오버레이 이탈 경로에서는 _unfreezeMargins 가
 *   「우리가 넣은 0px 가 그대로다」로 판정해 옛 풀블리드 마진을 되살리기까지 한다.
 *   실측(줌40%): align=left 면 좌로 72 로컬px, right 면 +72, center 만 상쇄돼 0.
 *
 * ★고침 — prop-page.js 에 applyAssetWidth(ab, px) 를 두고 «양방향 세트»를 한 곳에서 지킨다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- qa0920b-asset-width-set
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; }
    .section-block { position: relative; width: 860px; height: 400px; }
    .section-inner { position: relative; padding: 0 72px; }
  </style>
  </head><body>
  <div id="canvas">
    <div class="section-block" id="sec1">
      <div class="section-inner" id="inner1" data-padding-x="72">
        <div class="asset-block" id="ab1" data-use-padx="true" style="height:100px;background:#ccc;"></div>
      </div>
    </div>
  </div>
  <div id="panel-right"><div class="panel-body"></div></div>
  <div id="canvas-wrap"></div>
  <script>
    window.currentZoom = 100;
    window.scheduleAutoSave = () => {};
    window.triggerAutoSave = () => {};
    window.buildLayerPanel = () => {};
    window.pushHistory = () => {};
    window.getHistoryTip = () => null;
    window._findSectionAt = () => null;
  </script>
  <script type="module">
    import '/js/props/prop-page.js';
    import { enterFloat, exitFloat } from '/js/overlay-float.js';
    window.__OF = { enterFloat, exitFloat };
    window.__ready = true;
  </script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const margins = (page) => page.evaluate(() => {
  const ab = document.getElementById('ab1');
  const cs = getComputedStyle(ab);
  return { w: ab.style.width, ml: cs.marginLeft, mr: cs.marginRight };
});

test('전제 — 풀블리드 세트가 실제로 걸린다(폭 calc + 음수마진 -72)', async ({ page }) => {
  const errs = await boot(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  const r = await page.evaluate(() => {
    const ab = document.getElementById('ab1');
    window.applyAssetFullBleed(ab);
    const cs = getComputedStyle(ab);
    return { w: ab.style.width, ml: cs.marginLeft };
  });
  expect(r.w).toBe('calc(100% + 144px)');
  expect(r.ml).toBe('-72px');
});

test('W1 ★폭을 줄이면 풀블리드 음수마진이 «같이» 걷힌다 (반쪽 세트가 안 남는다)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const ab = document.getElementById('ab1');
    window.applyAssetFullBleed(ab);
    window.applyAssetWidth(ab, 400);
  });
  const m = await margins(page);
  expect(m.w).toBe('400px');
  expect(m.ml, '폭은 400 인데 풀블리드 음수마진이 남았다 — 왼쪽으로 72px 밀린다').toBe('0px');
  expect(m.mr).toBe('0px');
});

test('W2 최대폭으로 되돌리면 풀블리드 세트가 다시 «같이» 선다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const ab = document.getElementById('ab1');
    window.applyAssetFullBleed(ab);
    window.applyAssetWidth(ab, 400);
    window.applyAssetWidth(ab, 860);
  });
  const m = await margins(page);
  expect(m.w).toBe('calc(100% + 144px)');
  expect(m.ml).toBe('-72px');
});

test('W3 ★오버레이 이탈이 옛 풀블리드 마진을 되살리지 않는다 (떠 있는 동안 폭을 바꾼 경우)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const ab = document.getElementById('ab1');
    window.applyAssetFullBleed(ab);
    window.__OF.enterFloat(ab);            // 폭 굳히기 + 마진 0px 명시
    window.applyAssetWidth(ab, 400);       // 떠 있는 사이 패널로 폭 변경
    window.__OF.exitFloat(ab);
  });
  const m = await margins(page);
  expect(m.w, '사용자가 정한 폭이 증발했다').toBe('400px');
  expect(m.ml, '폭은 사용자 값인데 마진은 풀블리드 세트 — «말과 그림»이 갈린다').toBe('0px');
  expect(m.mr).toBe('0px');
});

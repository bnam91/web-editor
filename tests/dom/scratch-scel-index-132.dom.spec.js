/* scratch-scel-index-132.dom — ★132 ⓧ(지디 GO 261026): 연결선 rAF(_edgeLoop)가 매 프레임 아이템마다 부르던
 *   `document.querySelector('.scratch-item[data-scratch-id=…]')`(js/scratchpad-link.js _scEl)를 «이미 있는 색인»
 *   `window._scratchItemById(id).el`(js/scratch-pad.js)로 먼저 찾는다 · 없거나 끊긴 요소면 옛 길.
 *   근거(앱 실측 · 수지 저장본 · d0a6b6fa): 색인 el === querySelector 134/134 · 다름 0 · 그림 이동 3.46s 중 querySelector 698ms.
 * X1 [새 것] 색인이 있으면 프레임마다 그 querySelector 0 · 선 좌표는 옛 길(색인 없음)과 같다(음성대조 = 그림 무변)
 * X2 [옛 길] 색인이 null(고아 · 아직 안 실림) → querySelector 로 찾아 선이 선다
 * X3 [옛 길] 색인 el 이 끊김(isConnected false) — 살아 있는 같은 id 요소가 따로 있으면 그쪽으로 선이 붙는다
 * 하네스 = scratch-link-edges.dom.spec.js 의 page.route 그대로(새 관용구 0). 기다림은 전부 조건(고정 대기 0). */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-extra.css"></head><body style="margin:0">
<div id="canvas-wrap" style="width:1700px;height:1000px">
  <div id="canvas-scaler" style="margin:260px 360px; padding-top:260px; transition:none; transform:scale(1)">
    <div id="canvas"><div class="section-block" id="sec_1" style="height:360px"><div class="section-inner" style="height:360px"></div></div></div>
    <div class="scratch-item" data-scratch-id="s_1" style="left:980px; top:380px; width:180px; height:110px; background:#3a3f4b"></div>
  </div>
</div>
<script>
  window.__qsN = 0; const _qs = Document.prototype.querySelector;
  Document.prototype.querySelector = function (sel) { if (typeof sel === 'string' && sel.startsWith('.scratch-item[data-scratch-id=')) window.__qsN++; return _qs.call(this, sel); };
</script>
<script src="/js/scratchpad-link.js"></script>
<script>window.currentZoom = 100; window.__ready = true;</script>
</body></html>`;

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
  await page.setViewportSize({ width: 1720, height: 1020 });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true && !!window.SPLink);
  return errs;
}
/** 색인 놓기 — mode: 'live'(그 요소) · 'null'(고아) · 'detached'(끊긴 대역) · 'none'(색인 자체 없음 = 옛 하네스) */
const setIndex = (page, mode) => page.evaluate((mode) => {
  if (mode === 'none') { delete window._scratchItemById; return; }
  const ghost = document.createElement('div'); ghost.className = 'scratch-item'; ghost.dataset.scratchId = 's_1';
  /* ⚠️진짜 요소는 «여기서 한 번»만 잡는다 — 색인 함수 안에서 querySelector 를 부르면 그 자체가 세는 자에 잡힌다(첫 런에서 밟음) */
  const live = document.getElementsByClassName('scratch-item')[0];
  window._scratchItemById = (id) => {
    if (id !== 's_1') return null;
    if (mode === 'null') return null;
    return { id, el: mode === 'detached' ? ghost : live };
  };
}, mode);
/** 선 한 줄의 좌표(scaler-local) — 선이 서고 «두 프레임 연속 같은 값»일 때까지 */
const line = async (page) => {
  let prev = null, cur = null;
  await expect.poll(async () => { prev = cur; cur = await page.evaluate(() => { const l = document.querySelector('#link-edges line'); return l ? ['x1', 'y1', 'x2', 'y2'].map(k => Math.round(+l.getAttribute(k))).join(',') : null; }); return cur !== null && cur === prev; }, { timeout: 4000, intervals: [50] }).toBe(true);
  return cur;
};
/** N 프레임 동안 그 querySelector 가 몇 번 불리나 */
const qsOver = (page, frames) => page.evaluate((n) => new Promise(res => { const s = window.__qsN; let k = 0; const f = () => (++k >= n ? res(window.__qsN - s) : requestAnimationFrame(f)); requestAnimationFrame(f); }), frames);

test('X1 [새 것] 색인이 있으면 프레임마다 querySelector 0 · 선은 옛 길과 같은 자리', async ({ page }) => {
  const errs = await boot(page);
  await setIndex(page, 'none');
  await page.evaluate(() => window.SPLink.addLink('sec_1', 's_1'));
  const old = await line(page);
  expect(await qsOver(page, 10), '[전제] 옛 길은 프레임마다 querySelector 를 부른다(자가 잰다)').toBeGreaterThan(0);
  await setIndex(page, 'live');
  await page.evaluate(() => window.SPLink.rerender());
  const now = await line(page);
  expect(await qsOver(page, 10), '★색인이 있으면 _scEl 이 querySelector 를 안 부른다').toBe(0);
  expect(now, '음성대조 — 선 좌표 무변').toBe(old);
  expect(errs).toEqual([]);
});

test('X2 [옛 길] 색인이 null(고아) → querySelector 로 찾아 선이 선다', async ({ page }) => {
  const errs = await boot(page);
  await setIndex(page, 'null');
  await page.evaluate(() => window.SPLink.addLink('sec_1', 's_1'));
  expect(await line(page), '선이 섰다').not.toBe(null);
  expect(await qsOver(page, 10), '옛 길이 돈다').toBeGreaterThan(0);
  expect(errs).toEqual([]);
});

test('X3 [옛 길] 색인 el 이 끊겼으면 살아 있는 요소로 선이 붙는다', async ({ page }) => {
  const errs = await boot(page);
  await setIndex(page, 'none');
  await page.evaluate(() => window.SPLink.addLink('sec_1', 's_1'));
  const old = await line(page);
  await setIndex(page, 'detached');
  await page.evaluate(() => window.SPLink.rerender());
  expect(await line(page), '끊긴 대역(0×0)이 아니라 살아 있는 아이템에 붙는다 — 선 좌표 무변').toBe(old);
  expect(await qsOver(page, 10), '옛 길이 돈다').toBeGreaterThan(0);
  expect(errs).toEqual([]);
});

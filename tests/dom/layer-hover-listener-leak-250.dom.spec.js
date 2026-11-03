/* layer-hover-listener-leak-250.dom.spec.js — 250(렌더러 RSS 폭주)의 뿌리 하나.
 *
 * ★무엇이 깨졌나 — makeLayerBlockItem 이 빌드마다 «산 블럭»에 mouseenter/leave 를 새로 걸었다. 그 클로저가 옛 행을 잡고,
 *   옛 행은 부모 줄을 타고 옛 패널 통째를 잡는다 ⇒ 프레임을 더할수록 안 걷히는 DOM 이 쌓였다
 *   (e7987701 앱 실측: 사슬 128 둘 만드는 중 RSS 2404MB · 노드 514만 / 빌드를 끄면 460MB · 1만 2천).
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- layer-hover-listener-leak-250
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">
  <div id="canvas"><div class="section-block" id="sec1">
    <div class="asset-block" id="ab_test" style="position:relative;width:200px;height:80px;"></div>
  </div></div>
  <div id="layers"></div>
  <script>
    window.buildLayerPanel = () => {};
    window.pushHistory = () => {};
    window.AutoSaveSuppress = { begin: () => ({}), end: () => {} };
    window.__row = (block) => { const item = window.__mkItem(block, block, document.getElementById('sec1'), 1); const box = document.getElementById('layers'); box.innerHTML = ''; box.appendChild(item); return item; };
  </script>
  <script type="module">
    import { makeLayerBlockItem } from '/js/panels/layer-panel-items.js';
    window.__mkItem = makeLayerBlockItem;
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

const AWAY = { x: 900, y: 600 };
const bg = (page) => page.evaluate(() => window.__cur.style.background);

test('H1 블럭에 올리면 «지금» 행이 켜지고, 빠지면 꺼진다 — 여러 번 다시 만든 뒤에도', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => { const b = document.getElementById('ab_test'); window.__old = window.__row(b); window.__cur = window.__row(b); });
  await page.hover('#ab_test');
  expect(await bg(page)).toBe('var(--ui-bg-card)');
  await page.mouse.move(AWAY.x, AWAY.y);
  expect(await bg(page)).toBe('');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H2 켜진(active) 행은 빠져도 안 꺼진다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { const b = document.getElementById('ab_test'); window.__row(b); window.__cur = window.__row(b); window.__cur.classList.add('active'); });
  await page.hover('#ab_test');
  await page.mouse.move(AWAY.x, AWAY.y);
  expect(await bg(page)).toBe('var(--ui-bg-card)');
});

test('H3 복제된 블럭(리스너 없음)도 자기 행으로 켜진다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { const b = document.getElementById('ab_test'); window.__row(b); const c = b.cloneNode(true); b.replaceWith(c); window.__cur = window.__row(c); });
  await page.hover('#ab_test');
  expect(await bg(page)).toBe('var(--ui-bg-card)');
});

test('H4 ★30 번 다시 만들어도 블럭의 리스너는 한 벌이다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { const b = document.getElementById('ab_test'); for (let i = 0; i < 30; i++) window.__row(b); });
  const cdp = await page.context().newCDPSession(page);
  const { result } = await cdp.send('Runtime.evaluate', { expression: "document.getElementById('ab_test')" });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
  const n = (t) => listeners.filter((l) => l.type === t).length;
  expect([n('mouseenter'), n('mouseleave')], `쌓였다: ${JSON.stringify(listeners.map((l) => l.type))}`).toEqual([1, 1]);
});

test('H5 ★옛 행은 GC 가 걷는다 — 붙잡아 둔 행은 안 걷힌다(양성대조)', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { const b = document.getElementById('ab_test'); window.__held = window.__row(b); window.__heldRef = new WeakRef(window.__held); window.__oldRef = new WeakRef(window.__row(b)); window.__row(b); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const r = await page.evaluate(() => ({ old: !!window.__oldRef.deref(), held: !!window.__heldRef.deref() }));
  expect(r).toEqual({ old: false, held: true });
});

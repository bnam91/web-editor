/* hlb-thickness-handle.dom.spec.js — 1017t1e1 「하이라이트 스티커 블럭 : 높이조절 핸들 필요하다 추가해줘」
 *
 * ★어느 shape 인가 — highlightB(선 형광펜)의 손잡이는 끝점 2개뿐이었다. 「높이」= thickness.
 *   끝점 핸들과 «같은 클래스»(.hlb-handle)를 그대로 쓰고 data-endpoint="thick" 만 다르다
 *   (js/sticker-select.js:385 의 양보 가드가 그대로 먹는다 — ⛔새 클래스 금지).
 *   highlight(면)는 ★건드리지 않는다 — 코너 손잡이가 이미 hlH 를 쓴다(음성 ⒝).
 *
 * ★무엇을 잠그나
 *   E1-pre  전제 — _addHlbHandles 가 실제로 함수다
 *   E1-a    양성 — highlightB 선택 ⇒ .hlb-handle 3개 · [data-endpoint="thick"] 1개 ·
 *                  법선으로 끌면 thickness 가 바뀌고 선 길이(x1·y1·x2·y2)는 불변
 *   E1-n    음성대조 — thick 갈래를 지운 변형본에서 E1-a 가 실제로 빨강
 *   E1-b    음성대조(끄면 그대로) — highlight(면) 블럭은 여전히 .sticker-corner-handle 4개 ·
 *                  .hlb-handle 0개
 *
 * ⛔앱을 «안» 띄운다 — dev 원문 js 를 인라인으로(선례 insert-select-follows) ·
 *   page.waitForTimeout 금지(waitForFunction 만).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js hlb-thickness-handle
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://hlbthick.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8').replace(/\r\n/g, '\n');

const SS_SRC = read('js/sticker-select.js');

/* ── 음성대조본 N — thick 갈래를 지운다(핸들 생성 + 드래그 바인딩 둘 다) ─────── */
const SS_N_NOTHICK = (() => {
  const mkNeedle = `  const _thk = Number(block.dataset.thickness) || 12;
  const _mx = (x1 + x2) / 2, _my = (y1 + y2) / 2;
  const _ddx = x2 - x1, _ddy = y2 - y1;
  const _len = Math.hypot(_ddx, _ddy) || 1;
  const _nx = -_ddy / _len, _ny = _ddx / _len;   // 단위 법선
  mk('thick', _mx + _nx * (_thk / 2), _my + _ny * (_thk / 2));`;
  const dragNeedle = `    if (endpoint === 'thick') {`;
  if (!SS_SRC.includes(mkNeedle)) throw new Error('E1-n 변환이 늙었다 — thick 핸들 생성 블록을 못 찾았다');
  if (!SS_SRC.includes(dragNeedle)) throw new Error('E1-n 변환이 늙었다 — thick 드래그 갈래를 못 찾았다');
  return SS_SRC
    .replace(mkNeedle, '  /* N: thick 핸들 없음 */')
    .replace(dragNeedle, `    if (false /* N: thick 갈래 꺼짐 */) {`);
})();

function harness({ ss = SS_SRC } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>body{margin:0}</style>
<script>
  window.currentZoom = 40;
  window.__hist = 0;
  window.pushHistory = (a) => { window.__hist = (window.__hist||0) + 1; window.__lastAction = a; };
  window.scheduleAutoSave = () => {};
  window.showStickerProperties = () => {};
  window.beginDragHistory = () => ({ arm: () => {} });
  window.deselectAll = () => {};
</script>
</head><body>
<div id="canvas-scaler" style="transform:scale(0.4);transform-origin:top left;">
  <div id="canvas">
    <div class="section-block" id="sec1" style="position:relative;width:860px;height:600px"></div>
  </div>
</div>
<script type="module">
import '/js/blocks/sticker-block.js';
window.__sbReady = true;
</script>
<script>${ss}</script>
</body></html>`;
}

async function boot(page, opts) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/h.html') return route.fulfill({ contentType: 'text/html', body: harness(opts) });
    const file = path.join(REPO, u.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(`${ORIGIN}/h.html`);
  await page.waitForFunction(() => window.__sbReady && window.makeStickerBlock && window._addHlbHandles);
  return errs;
}

/* highlightB 블록 하나(수평선 x1=100,y1=100→x2=260,y2=100, thickness=12)를 section 에 심는다. */
async function plantHlb(page) {
  await page.evaluate(() => {
    const b = window.makeStickerBlock({ shape: 'highlightB', x1: 100, y1: 100, x2: 260, y2: 100, thickness: 12, lineStyle: 'line' });
    document.getElementById('sec1').appendChild(b);
    window.renderStickerBlock(b);
    return b.id;
  });
}

const toClient = (page, x, y) => page.evaluate(({ x, y }) => {
  const r = document.getElementById('sec1').getBoundingClientRect();
  const zoom = (window.currentZoom || 40) / 100;
  return { cx: r.left + x * zoom, cy: r.top + y * zoom };
}, { x, y });

test('E1-pre 전제 — _addHlbHandles 가 실제로 함수다', async ({ page }) => {
  const errs = await boot(page);
  const t = await page.evaluate(() => typeof window._addHlbHandles);
  expect(errs).toEqual([]);
  expect(t).toBe('function');
});

test('E1-a 양성 — highlightB 선택 ⇒ .hlb-handle 3개(끝점2+두께1) · 법선으로 끌면 두께만 바뀐다', async ({ page }) => {
  const errs = await boot(page);
  await plantHlb(page);
  const before = await page.evaluate(() => document.querySelectorAll('.hlb-handle').length);
  expect(before).toBe(0);   // ★전제 — 선택 전엔 핸들이 없다

  const block = await page.evaluate(() => {
    const b = document.querySelector('.sticker-block');
    window._selectSticker(b);
    return { id: b.id, thickness: b.dataset.thickness, x1: b.dataset.x1, y1: b.dataset.y1, x2: b.dataset.x2, y2: b.dataset.y2 };
  });
  const counts = await page.evaluate(() => ({
    all: document.querySelectorAll('.hlb-handle').length,
    thick: document.querySelectorAll('.hlb-handle[data-endpoint="thick"]').length,
    start: document.querySelectorAll('.hlb-handle[data-endpoint="start"]').length,
    end: document.querySelectorAll('.hlb-handle[data-endpoint="end"]').length,
  }));
  expect(counts).toEqual({ all: 3, thick: 1, start: 1, end: 1 });

  // ★두께 손잡이를 법선(이 선은 수평이므로 법선 = 수직) 방향으로 40 섹션-로컬px 끈다.
  const handlePos = await page.evaluate(() => {
    const h = document.querySelector('.hlb-handle[data-endpoint="thick"]');
    const r = h.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  });
  const zoom = 0.4;
  await page.mouse.move(handlePos.cx, handlePos.cy);
  await page.mouse.down();
  await page.mouse.move(handlePos.cx, handlePos.cy + 40 * zoom, { steps: 5 }); // 화면px = 섹션-로컬px × zoom
  await page.mouse.up();

  const after = await page.evaluate(() => {
    const b = document.querySelector('.sticker-block');
    return { thickness: Number(b.dataset.thickness), x1: b.dataset.x1, y1: b.dataset.y1, x2: b.dataset.x2, y2: b.dataset.y2 };
  });
  expect(errs).toEqual([]);
  // ★주 단언 — thickness 가 바뀌었다(법선으로 40 내렸으니 += 80, clamp 1~200)
  expect(after.thickness).toBeGreaterThan(Number(block.thickness));
  // ★선 길이(끝점)는 불변 — 두께 손잡이가 길이를 건드리지 않는다
  expect(after.x1).toBe(block.x1);
  expect(after.y1).toBe(block.y1);
  expect(after.x2).toBe(block.x2);
  expect(after.y2).toBe(block.y2);
  // ★히스토리 — 드래그 끝(onUp)에 한 번
  const hist = await page.evaluate(() => window.__hist);
  expect(hist).toBeGreaterThan(0);
});

test('E1-n 음성대조 — thick 갈래를 지우면 E1-a 가 실제로 빨강', async ({ page }) => {
  const errs = await boot(page, { ss: SS_N_NOTHICK });
  await plantHlb(page);
  await page.evaluate(() => { window._selectSticker(document.querySelector('.sticker-block')); });
  const counts = await page.evaluate(() => ({
    all: document.querySelectorAll('.hlb-handle').length,
    thick: document.querySelectorAll('.hlb-handle[data-endpoint="thick"]').length,
  }));
  expect(errs).toEqual([]);
  expect(counts.all).toBe(2);     // ★무력화 판 — 끝점 2개뿐(E1-a 의 3개 기대가 깨진다)
  expect(counts.thick).toBe(0);
  expect(() => expect(counts.all).toBe(3)).toThrow();
});

test('E1-b 음성대조(끄면 그대로) — highlight(면) 블록은 여전히 코너 핸들 4개 · hlb-handle 0개', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => {
    const b = window.makeStickerBlock({ shape: 'highlight', x: 40, y: 40 });
    document.getElementById('sec1').appendChild(b);
    window.renderStickerBlock(b);
  });
  await page.evaluate(() => { window._selectSticker(document.querySelector('.sticker-block')); });
  const counts = await page.evaluate(() => ({
    corner: document.querySelectorAll('.sticker-corner-handle').length,
    hlb: document.querySelectorAll('.hlb-handle').length,
  }));
  expect(errs).toEqual([]);
  expect(counts).toEqual({ corner: 4, hlb: 0 });
});

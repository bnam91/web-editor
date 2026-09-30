/* frame-float-group.dom.spec.js — 현빈 2026-09-30 proj_1790568699549 sec_6f1aku6 에서 잡은 넷
 *   ① 프레임 안에 목업만 두면 레이어 패널에 토글이 안 생긴다
 *   ② 프레임 «내용 자르기» 켬/끔(피그마 Clip content, 기본 끔)
 *   ③ 줌 이펙트(광원) 색
 *   ④ 흐름 자유배치 프레임 + 섹션에 떠 있는 줌블럭을 ⌘G — «자리 그대로» 한 묶음
 *
 * ★양성대조의 판 = 착수 직전 origin/dev **d816e131** (⛔HEAD 아님).
 *   그 판에서 «빨강이어야 하는» 시험(실측 7/7 빨강): G1 G2 G3 G4 L1 C1 Z1 — G4 도 빨강이다(옛 판은 벡터를 새 프레임에 «쌓았다»)
 *   실행: FFG_JS=<d816e131 판의 js 디렉터리> npx playwright test … frame-float-group
 *
 * ⛔앱을 «안» 띄운다. wrapSelectedBlocksInFrame 은 «그 함수만» 잘라 싣는다(overlay-group-zorder 하네스 방식).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { sliceBlock } = require('../unit/_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const JS_DIR = process.env.FFG_JS || path.join(REPO, 'js');
const CSS_DIR = process.env.FFG_CSS || path.join(REPO, 'css');
if (process.env.FFG_JS) console.warn(`[frame-float-group] ★양성대조 모드 — js 를 ${JS_DIR} 에서 읽는다`);

const BF = fs.readFileSync(path.join(JS_DIR, 'block-factory.js'), 'utf8');
const WRAP_SRC = sliceBlock(BF, 'function wrapSelectedBlocksInFrame(');
const NEXT_GROUP_SRC = sliceBlock(BF, 'function _nextGroupName(');

const WRAP_JS = `
import { isShapeFrame, shapeFrameOf, topLevelBlocksOf, isEmptyShell } from '/js/shape-frame.js';
let __n = 0;
function makeFrameBlock() {
  const ss = document.createElement('div');
  ss.className = 'frame-block'; ss.id = 'ss_new' + (++__n);
  ss.dataset.freeLayout = 'true'; ss.dataset.width = '860'; ss.dataset.height = '520';
  ss.style.cssText = 'width:860px;height:520px;min-height:520px;';
  return ss;
}
window.__hist = [];
window.pushHistory = (l) => window.__hist.push(l || '');
window.buildLayerPanel = () => {};
window.scheduleAutoSave = () => {};
window.genId = (p) => p + '_' + (++__n);
window.deselectAll = () => document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
window.__toasts = [];
window.showToast = (m) => window.__toasts.push(String(m));
${NEXT_GROUP_SRC}
${WRAP_SRC}
window.__wrap = wrapSelectedBlocksInFrame;
window.__ready = true;
`;

const CSS = `* { box-sizing: border-box; } body { margin: 0; }
  .section-block { position: relative; width: 860px; min-height: 1300px; }
  .section-inner { display: flex; flex-direction: column; }
  .frame-block { position: relative; max-width: 100%; }
  .zoom-block, .vector-block { position: absolute; }`;

const BODY = `
<div class="section-block" id="sec1">
  <div class="section-inner" id="inner1">
    <div class="row" id="row1"><div class="text-block" id="tb_flow" style="height:40px">흐름 글자</div></div>
    <div class="frame-block" id="ssA" data-free-layout="true" style="width:860px;height:797px;margin:0 auto;">
      <div class="mockup-block" id="mkp1" style="position:absolute;left:174px;top:0;width:513px;height:1037px;"></div>
    </div>
  </div>
  <div class="zoom-block" id="zmb1" data-x="109" data-y="900" style="left:109px;top:900px;width:638px;height:340px;"></div>
  <div class="frame-block" id="ovT" data-text-frame="true" data-overlay-block="true" data-sel-variant="sticker"
       data-offset-x="40" data-offset-y="1000" style="position:absolute;left:40px;top:1000px;width:120px;height:40px;">
    <div class="text-block" id="tbOv">오버레이</div>
  </div>
  <div class="vector-block" id="vec1" style="left:10px;top:1200px;width:50px;height:50px;"></div>
</div>`;

function route(page, harnessHtml, extra = {}) {
  return page.route(`${ORIGIN}/**`, async (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/__h.html') return r.fulfill({ contentType: 'text/html', body: harnessHtml });
    if (extra[u.pathname]) return r.fulfill({ contentType: 'application/javascript', body: extra[u.pathname] });
    let f;
    if (u.pathname.startsWith('/js/')) f = path.join(JS_DIR, u.pathname.slice(4));
    else if (u.pathname.startsWith('/css/')) f = path.join(CSS_DIR, u.pathname.slice(5));
    if (!f || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript', body: fs.readFileSync(f) });
  });
}

async function bootWrap(page) {
  await route(page, `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style>
    <script type="module" src="/__wrap.js"></script></head><body>${BODY}</body></html>`, { '/__wrap.js': WRAP_JS });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__h.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const RECTS = `(() => {
  const s = document.getElementById('sec1').getBoundingClientRect();
  const o = {};
  for (const id of ['ssA','zmb1','ovT','tb_flow']) {
    const b = document.getElementById(id).getBoundingClientRect();
    o[id] = [Math.round(b.left - s.left), Math.round(b.top - s.top), Math.round(b.width), Math.round(b.height)];
  }
  return o;
})()`;

test('G1 ★흐름 자유배치 프레임 + 떠 있는 줌 → 줌이 프레임 «안»으로, 화면 자리 그대로', async ({ page }) => {
  const errs = await bootWrap(page);
  const before = await page.evaluate(RECTS);
  const r = await page.evaluate(() => {
    document.getElementById('ssA').classList.add('selected');
    document.getElementById('zmb1').classList.add('selected');
    window.__wrap({ asGroup: true });
    const z = document.getElementById('zmb1');
    return { parent: z.parentElement.id, x: z.dataset.x, y: z.dataset.y,
             frames: document.querySelectorAll('.frame-block').length, toasts: window.__toasts };
  });
  const after = await page.evaluate(RECTS);
  expect(r.parent, '★줌이 프레임 안으로 안 들어갔다').toBe('ssA');
  expect(after.zmb1, '★줌의 화면 자리가 움직였다').toEqual(before.zmb1);
  expect(after.ssA, '프레임 자리는 그대로').toEqual(before.ssA);
  expect([r.x, r.y], 'dataset.x/y 는 «프레임 기준»').toEqual([String(before.zmb1[0] - before.ssA[0]), String(before.zmb1[1] - before.ssA[1])]);
  expect(r.frames, '⛔새 래퍼 프레임을 만들지 않는다(세로 쌓기 갈래로 안 떨어졌다)').toBe(2);
  expect(r.toasts.join('|')).toContain('자리 그대로');
  expect(errs).toEqual([]);
});

test('G2 줌 + 오버레이 글자 둘 다 — 오버레이 표식은 내려놓고 자리 그대로', async ({ page }) => {
  await bootWrap(page);
  const before = await page.evaluate(RECTS);
  const r = await page.evaluate(() => {
    ['ssA', 'zmb1', 'tbOv'].forEach(id => document.getElementById(id).classList.add('selected'));
    window.__wrap({ asGroup: true });
    const o = document.getElementById('ovT');
    return { zp: document.getElementById('zmb1').parentElement.id, op: o.parentElement.id,
             marker: o.dataset.overlayBlock ?? null, ret: o.dataset.overlayReturnParent ?? null };
  });
  const after = await page.evaluate(RECTS);
  expect([r.zp, r.op]).toEqual(['ssA', 'ssA']);
  expect(r.marker, '⛔표식을 남기면 섹션 좌표로 클램프돼 끌 때 튄다').toBeNull();
  expect(r.ret).toBeNull();
  expect(after.ovT).toEqual(before.ovT);
  expect(after.zmb1).toEqual(before.zmb1);
});

test('G3 흐름 쪽이 «자유배치 프레임 하나»가 아니면 — 쌓지 않고 까닭을 말하고 멈춘다', async ({ page }) => {
  await bootWrap(page);
  const r = await page.evaluate(() => {
    ['tb_flow', 'ssA', 'zmb1'].forEach(id => document.getElementById(id).classList.add('selected'));
    window.__wrap({ asGroup: true });
    return { toasts: window.__toasts, zp: document.getElementById('zmb1').parentElement.id,
             frames: document.querySelectorAll('.frame-block').length };
  });
  expect(r.zp, '★옛 갈래는 줌을 새 프레임에 «세로로» 쌓았다').toBe('sec1');
  expect(r.frames).toBe(2);
  expect(r.toasts.join('|')).toContain('자유배치 프레임 하나');
});

test('G4 프레임 안에서 못 끌리는 떠 있는 종류(벡터)는 넣지 않고 멈춘다', async ({ page }) => {
  await bootWrap(page);
  const r = await page.evaluate(() => {
    ['ssA', 'vec1'].forEach(id => document.getElementById(id).classList.add('selected'));
    window.__wrap({ asGroup: true });
    return { vp: document.getElementById('vec1').parentElement.id, toasts: window.__toasts };
  });
  expect(r.vp).toBe('sec1');
  expect(r.toasts.length).toBe(1);
});

/* ── ① 레이어 패널 ── */
test('L1 ★프레임 안에 목업«만» 있어도 레이어에 토글(자식 줄)이 생긴다', async ({ page }) => {
  await route(page, `<!doctype html><html><head><meta charset="utf-8"></head><body>${BODY}
    <script src="/js/panel-dispatch.js"></script>
    <script type="module">
      const M = await import('/js/panels/layer-panel-items.js');
      const ss = document.getElementById('ssA');
      const el = M.makeLayerFrameItem(ss, document.getElementById('sec1'), () => {}, 1);
      window.__r = { group: el.classList.contains('layer-row-group'),
                     chev: !!el.querySelector('.layer-chevron'),
                     kids: el.querySelectorAll('.layer-row-children > *').length };
      window.__ready = true;
    </script></body></html>`);
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__h.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  const r = await page.evaluate(() => window.__r);
  expect(r.kids, '★목업이 자식 줄로 안 잡혔다(손으로 적은 블럭 명부에 mockup 이 없었다)').toBe(1);
  expect(r.chev).toBe(true);
  expect(errs).toEqual([]);
});

/* ── ② 내용 자르기 CSS · ③ 광원 색 ── */
test('C1 ★내용 자르기 — 켜면 overflow hidden(풀어 주는 예외보다 이긴다) · 기본은 visible', async ({ page }) => {
  await route(page, `<!doctype html><html><head><meta charset="utf-8">
    <link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
    <div class="frame-block" id="f0" data-free-layout="true" style="height:100px"><div data-rotation="10"></div></div>
    <div class="frame-block" id="f1" data-free-layout="true" data-clip-content="true" style="height:100px"><div data-rotation="10"></div></div>
    <div class="frame-block" id="f2" data-free-layout="true" style="height:100px"></div>
    </body></html>`);
  await page.goto(`${ORIGIN}/__h.html`);
  const r = await page.evaluate(() => ['f0', 'f1', 'f2'].map(id => getComputedStyle(document.getElementById(id)).overflow));
  expect(r).toEqual(['visible', 'hidden', 'visible']);
});

test('Z1 ★줌 이펙트 색 — 광원 폴리곤이 shc 로 칠해지고, 없으면 옛 검정 · 이상한 값은 검정으로', async ({ page }) => {
  await route(page, `<!doctype html><html><head><meta charset="utf-8"></head><body>
    <script type="module">
      const G = await import('/js/blocks/zoom-geometry.js');
      const A = {x:0,y:0}, B = {x:10,y:0}, a = {x:0,y:10}, b = {x:10,y:10};
      const fills = (c) => [...new Set([...G.strips(A,B,a,b,4,1,0.3,c).matchAll(/fill="([^"]*)"/g)].map(m => m[1]))];
      window.__r = { red: fills('#ff3366'), none: fills(undefined), bad: fills('"><script>') };
      window.__ready = true;
    </script></body></html>`);
  await page.goto(`${ORIGIN}/__h.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  const r = await page.evaluate(() => window.__r);
  expect(r.red).toEqual(['#ff3366']);
  expect(r.none).toEqual(['#000']);
  expect(r.bad, '⛔SVG 속성에 날것을 넣지 않는다').toEqual(['#000']);
});

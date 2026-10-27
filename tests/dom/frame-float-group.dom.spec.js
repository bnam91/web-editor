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
const { ssotSelJs } = require('./_ssot-sel.js');

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
import { growFrameToFitChildren } from '/js/frame-geometry.js';   /* ★t5-08 — 흐름+떠 있음 갈래가 새 그룹을 떠 있는 것까지 키운다 */
${ssotSelJs(JS_DIR)}   // ★t5-07 — ⌘G 명부가 이 정본에서 파생된다(tests/dom/_ssot-sel.js)
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

test('G3 흐름 쪽이 «자유배치 프레임 하나»가 아니면 — (t5-08) 흐름 쪽을 새 그룹으로 묶고 떠 있는 것은 그 «안»에 자리 그대로', async ({ page }) => {
  /* ★옛 기대(쌓지 않고 까닭을 말하고 멈춘다)는 t5-08 현빈 원문으로 바뀌었다 — 「일반블럭과 오버레이된 블럭을 그룹설정하면
     일반블럭처럼 움직여져야됨 , 그룹더블클릭해서 그룹안으로 진입하면 그안에서 오버레이 블럭은 여전히 오버레이되어야함」.
     ⛔그래도 «세로로 쌓지» 않는다(옛 흠 — 줌이 자리를 잃는다): 줌은 화면 자리 그대로 새 그룹의 자식이다. */
  await bootWrap(page);
  const r = await page.evaluate(() => {
    const s = document.getElementById('sec1').getBoundingClientRect();
    const at = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.left - s.left), Math.round(b.top - s.top)]; };
    const before = at('zmb1');
    ['tb_flow', 'ssA', 'zmb1'].forEach(id => document.getElementById(id).classList.add('selected'));
    window.__wrap({ asGroup: true });
    const grp = document.getElementById('zmb1').closest('.frame-block[data-group="true"]');
    return { toasts: window.__toasts, grp: grp ? grp.id : null, tbIn: !!document.getElementById('tb_flow').closest('[data-group="true"]'),
             ssIn: !!document.getElementById('ssA').closest('[data-group="true"]'), before, after: at('zmb1') };
  });
  expect(r.grp, '줌이 새 그룹 안').not.toBeNull();
  expect([r.tbIn, r.ssIn], '흐름 쪽 둘도 그 그룹 안').toEqual([true, true]);
  expect(r.after, '줌 화면 자리 그대로(세로로 안 쌓였다)').toEqual(r.before);
  expect(r.toasts.length).toBe(1);
  expect(r.toasts[0]).toContain('그룹으로 묶었어요');
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
/* ★★★C1 을 ★칸 ★넷으로 ★갈랐다 (2026-10-11 · t3frame) — ⛔제품 ★0줄.
   ★★왜: ★옛 C1 은 ★★`['visible','hidden','visible']` ★한 줄에 ★★세 갈래를 ★섞었고,
     ★★2026-10-10(현빈 1009t3-②)에 ★기본이 ★«자름»으로 ★뒤집히자 ★셋째가 ★거짓이 됐다.
   ★★★그런데 ★첫째(f0)는 ★★아직 ★`visible` 이다 — ★★★까닭이 ★«기본»이 ★아니라
     ★★`css/editor-blocks.css:2231` 의 ★★«회전 예외»(2026-09-05 · 회전 자식의 AABB 가 잘리지 말라고)다.
     ⇒ ★★★셋째만 ★고치면 ★f0 이 ★★«기본은 visible»이라는 ★거짓 제목을 ★안고 ★통과한다
       (★★같은 결과라도 ★★«까닭»이 ★다르면 ★실패방식이 ★다르다) ⇒ ★★그래서 ★★이름으로 ★갈랐다.
   ★★날짜 ★셋 — ⛔지우지 마라, ★다음 사람이 ★네 번째로 ★뒤집기 ★전에 ★읽어야 한다:
     ★2026-09-28 현빈 ⇒ ★overflow ★visible 로 ★풀었다
     ★2026-09-30 현빈 ⇒ ★「내용 자르기」 토글(★기본 ★끔) — ★★옛 C1 이 ★그 판의 수다
     ★2026-10-10 현빈 ★1009t3-② ⇒ ★「프레임 밖은 ★안 보여야」 ⇒ ★★기본을 ★다시 ★hidden
   ★★그 사이 ★★여섯 칸이 ★★새 명부(기본=자름)로 ★옮겨졌고 ★★이 칸만 ★남아 ★★«고아»였다:
     `frame-clip-drag:230` · `free-frame-flow-drag:151` · `free-frame-fullwidth-drag:81` ·
     `clip-content-roster.test.mjs:62` · `frame-clips-predicate.test.mjs:161` · `block-full-bleed.test.mjs:228`
   ⇒ ★★그러니 ★이 갱신은 ★«내 판단»이 ★아니라 ★★★여섯 칸이 ★이미 ★그렇게 ★적혀 있다는 ★수다. */
const CLIP_HTML = (attrs, child) => `<!doctype html><html><head><meta charset="utf-8">
      <link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
      <div class="frame-block" id="fx" data-free-layout="true" ${attrs} style="height:100px">${child}</div>
      </body></html>`;
const ovOf = async (page, attrs, child) => {
  await route(page, CLIP_HTML(attrs, child));
  await page.goto(`${ORIGIN}/__h.html`);
  return page.evaluate(() => getComputedStyle(document.getElementById('fx')).overflow);
};
const ROT = '<div data-rotation="10"></div>';

test('C1a ★기본 = ★자름 — ★속성 없음 · ★회전 자식 없음 ⇒ hidden (★2026-10-10 현빈 1009t3-②)', async ({ page }) => {
  expect(await ovOf(page, '', ''), '★기본이 ★자름이다 — ⛔2026-09-30 의 ★«기본 끔»은 ★죽었다').toBe('hidden');
});

test('C1b ★회전 예외 = ★안 자름 — ★`[data-rotation]` 자식 ⇒ visible (★`css/editor-blocks.css:2231` · 2026-09-05)', async ({ page }) => {
  /* ★★이 칸의 ★까닭은 ★«기본»이 ★아니다 — ★★회전 자식의 ★AABB 가 ★잘리지 ★말라는 ★예외다.
     ⇒ ★★그래서 ★C1a 와 ★★따로 ★선다. ⛔한 칸으로 ★합치면 ★까닭이 ★섞인다. */
  expect(await ovOf(page, '', ROT), '★회전 자식이 ★있으면 ★안 자른다(★기본과 ★무관)').toBe('visible');
});

test('C1c ★명시 ★켬이 ★이긴다 — ★`clip-content="true"` ＋ ★회전 자식 ⇒ hidden (★옛 C1 의 그 뜻)', async ({ page }) => {
  /* ★옛 제목의 ★「풀어 주는 예외보다 ★이긴다」가 ★이 칸이다 — ★`!important`(:118)가 ★회전 예외를 ★이긴다 */
  expect(await ovOf(page, 'data-clip-content="true"', ROT), '★명시 켬이 ★회전 예외를 ★이긴다').toBe('hidden');
});

test('C1d ★명시 ★끔 — ★`clip-content="false"` ⇒ visible (★사람이 ★끌 수 있다 · unit `P1d-3` 의 ★DOM 짝)', async ({ page }) => {
  /* ★`block-full-bleed.test.mjs` 의 ★새 ★`P1d-3` 이 ★그 갈래를 ★unit 에서 ★잠근다
     ⇒ ★★DOM 쪽에도 ★있어야 ★★«사람이 ★끌 수 있다»가 ★두 층에서 ★선다 */
  expect(await ovOf(page, 'data-clip-content="false"', ''), '★명시 끔이면 ★안 자른다').toBe('visible');
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

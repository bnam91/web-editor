/* qa0919-fixes.dom.spec.js — 0919 적대적 QA(int/0919-release) 반영분 회귀.
 *
 *   W  ⌘G(wrapSelectedBlocksInFrame) — 새 프레임의 dataset.height 가 style 높이와 같다.
 *      (예전: makeFrameBlock 기본값 '520' 이 남아 redo·저장→재로드에서 520px 로 부풀어 아래 블럭이 400px 밀림)
 *   G  relinkShapeGradient — 붙여넣기·⌘D·재로드로 id 가 바뀐 도형 사본의 그라데이션 def/fill 짝을 다시 잇는다.
 *   P  _keepOnlyPastedSelected — 붙여넣기·⌘D 뒤 «사본만» 선택(원본까지 ⌫ 로 지워지던 것).
 *   A  shapeStopPaint — SVG 스탑 알파는 «한 번만»(rgba 색 + 같은 opacity 가 곱해져 50%→25%).
 *
 * ★원본 소스를 _slice-block 으로 잘라 하네스에서 실행한다(앱은 안 띄운다).
 * 실행: npm run test:dom -- qa0919-fixes
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { sliceBlock } = require('../unit/_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const SHAPE_FRAME_JS = read('js/shape-frame.js');
const BF = read('js/block-factory.js');
const WRAP_SRC = sliceBlock(BF, 'function wrapSelectedBlocksInFrame(');
const NEXT_GROUP_SRC = sliceBlock(BF, 'function _nextGroupName(');
const RELINK_SRC = sliceBlock(BF, 'function relinkShapeGradient(');
const KEEP_SRC = sliceBlock(read('js/editor.js'), 'function _keepOnlyPastedSelected(');
const STOP_SRC = sliceBlock(read('js/props/prop-shape.js'), 'export function shapeStopPaint(').replace(/^export /, '');
/* ★★1013t2A1 이 relinkShapeGradient 안에서 `ellipseFilterId()` 를 부르기 시작했다(원 이너 그림자 필터).
   ★그 함수는 ★다른 파일(js/shape-ellipse.js)에 살고 block-factory 는 ★import 로 쓴다 —
   ⇒ ★★함수만 잘라 얹는 이 하네스에는 ★정의가 ★없어 ★ReferenceError 가 났다(261014 전수 ×2 에서 G1·G2·G3).
   ⛔손으로 스텁을 쓰지 않는다 — ★★정본에서 ★같이 잘라 온다(★위 STOP_SRC 와 ★같은 관용구). */
const FILTER_ID_SRC = sliceBlock(read('js/shape-ellipse.js'), 'export function ellipseFilterId(').replace(/^export /, '');

const HARNESS_JS = `
import { isShapeFrame, shapeFrameOf, topLevelBlocksOf, isEmptyShell } from '/js/shape-frame.js';
let __n = 0;
/* makeFrameBlock 의 «기본값»을 그대로 흉내 낸다 — 이게 결함의 원천(dataset 860×520) */
function makeFrameBlock() {
  const ss = document.createElement('div');
  ss.className = 'frame-block';
  ss.id = 'ss_new' + (++__n);
  ss.dataset.freeLayout = 'true';
  ss.dataset.width = '860';
  ss.dataset.height = '520';
  ss.style.cssText = 'width:860px;height:520px;min-height:520px;';
  return ss;
}
window.pushHistory = () => {};
window.buildLayerPanel = () => {};
window.deselectAll = () => document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
${NEXT_GROUP_SRC}
${WRAP_SRC}
${FILTER_ID_SRC}
${RELINK_SRC}
const canvasEl = document.getElementById('canvas');
${KEEP_SRC}
${STOP_SRC}
window.__wrap = wrapSelectedBlocksInFrame;
window.__relink = relinkShapeGradient;
window.__keep = _keepOnlyPastedSelected;
window.__stop = shapeStopPaint;
window.__ready = true;
`;

async function boot(page, bodyHtml) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>
            .section-block{position:relative;width:800px;}
            .section-inner{display:flex;flex-direction:column;}
            .frame-block[data-free-layout="true"]{position:relative;}
            .shape-block{width:100%;height:100%;}
            .text-block{height:40px;}
          </style>
          <script type="module" src="/__harness.js"></script>
          </head><body><div id="canvas">${bodyHtml}</div></body></html>`,
      });
    }
    if (url.pathname === '/__harness.js') return route.fulfill({ contentType: 'application/javascript', body: HARNESS_JS });
    if (url.pathname === '/js/shape-frame.js') return route.fulfill({ contentType: 'application/javascript', body: SHAPE_FRAME_JS });
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

test('W1 ★섹션레벨 텍스트 1개 ⌘G → 새 그룹 dataset.height = style 높이(기본값 520 이 남지 않는다)', async ({ page }) => {
  const errs = await boot(page, `
    <div class="section-block selected" id="sec"><div class="section-inner" id="inner">
      <div class="row" id="r1"><div class="text-block selected" id="tb_1">Hello</div></div>
      <div class="row" id="r2"><div class="text-block" id="tb_2">Below</div></div>
    </div></div>`);
  const out = await page.evaluate(() => {
    window.__wrap({ asGroup: true });
    const g = document.querySelector('[id^=ss_new]');
    return { styleH: g.style.height, dsH: g.dataset.height, group: g.dataset.group };
  });
  expect(out.group).toBe('true');
  expect(out.styleH).toBe('120px');
  expect(out.dsH, 'dataset.height 가 520 이면 redo·재로드에서 부푼다').toBe('120');
  expect(errs).toEqual([]);
});

test('W2 자유배치 프레임 안 두 블럭 ⌘G → 새 그룹 dataset.width/height = 묶음 크기', async ({ page }) => {
  const errs = await boot(page, `
    <div class="section-block selected" id="sec"><div class="section-inner" id="inner">
      <div class="frame-block selected" id="ff" data-free-layout="true" style="width:600px;height:400px;">
        <div class="text-block selected" id="a" style="position:absolute;left:10px;top:20px;width:100px;height:40px"></div>
        <div class="text-block selected" id="b" style="position:absolute;left:150px;top:90px;width:120px;height:40px"></div>
      </div>
    </div></div>`);
  const out = await page.evaluate(() => {
    window.__wrap({ asGroup: true });
    const g = document.querySelector('[id^=ss_new]');
    return { w: g.style.width, h: g.style.height, dw: g.dataset.width, dh: g.dataset.height };
  });
  expect(out.w).toBe('260px');
  expect(out.h).toBe('110px');
  expect(out.dw).toBe('260');
  expect(out.dh).toBe('110');
  expect(errs).toEqual([]);
});

/* ★★★G0 — ★이 spec 이 ★«잘라 얹는» 꼴이라 ★생기는 ★구멍을 ★잰다.
   ★261014: A1 이 relinkShapeGradient 안에 ★다른 파일 함수 호출을 더하자 ★G1·G2·G3 가 ★한꺼번에
     `ReferenceError: ellipseFilterId is not defined` 로 ★죽었다. ★제품은 ★멀쩡했는데(앱은 import 가 잇는다)
     ★★그라데이션 재잇기 ★회귀 방어가 ★조용히 ★꺼진 채 ★dev 로 갈 뻔했다.
   ⇒ ★★이 칸이 ★★«무엇이 없는지»를 ★이름으로 ★말한다. ⛔「G1 이 빨갛다」보다 ★훨씬 많이 말한다.
   ⛔완벽한 정적 분석은 ★하지 않는다 — ★우리가 ★실제로 당한 꼴(★함수 호출)만 잡으면 ★된다. */
const _JS_BUILTINS = new Set(['document','window','Number','String','Object','Array','JSON','Math','console',
  'parseInt','parseFloat','Boolean','Set','Map','RegExp','Error','Date','Promise','Symbol','isNaN','getComputedStyle']);
/* ⛔★문자열·주석 ★안의 ★`이름(` 을 ★호출로 ★읽으면 ★거짓양성이 난다 —
   ★실측(261014): `fill="url(#grad-…)"` 의 ★`url(` 이 ★★「없는 이름」으로 ★올라왔다.
   ⇒ ★★세는 ★전에 ★문자열·템플릿·주석을 ★비운다. */
function _stripLiterals(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}
function freeCalls(rawSrc) {
  const src = _stripLiterals(rawSrc);
  const declared = new Set([...src.matchAll(/\b(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  return [...new Set([...src.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))]
    .filter((n) => !declared.has(n) && !_JS_BUILTINS.has(n)
      && !/^(if|for|while|switch|catch|return|typeof|new|function|do|else)$/.test(n));
}

test('G0 ★★전제 — 잘라 얹은 조각이 부르는 이름이 하네스에 전부 있다 (★다음 import 에 또 꺼지지 않게)', async () => {
  /* ★★⛔261014 ★실측으로 ★고친 자리 — ★처음엔 ★`[NEXT_GROUP_SRC, WRAP_SRC, FILTER_ID_SRC, …]` 라는
     ★★«손으로 적은 목록»에서 ★이름을 뽑았다. ⇒ ★★양성대조가 ★★실패했다:
       ★하네스 주입(`${FILTER_ID_SRC}`)을 ★떼도 ★그 목록엔 ★여전히 ★FILTER_ID_SRC 가 있어
       ★★G0 가 ★초록이고 ★G1~G3 만 ★빨갰다 — ★★자가 ★그 구멍을 ★못 잡았다.
     ⇒ ★★«하네스가 ★정말 ★얹는 것» = ★★`HARNESS_JS` ★하나뿐이다(★`${...}` 가 ★이미 전개된 ★문자열).
       ★★거기서만 ★뽑는다 — ★★「명부가 ★둘이면 ★파생시켜 ★하나로」. */
  const injected = new Set();
  {
    const h = _stripLiterals(HARNESS_JS);
    for (const m of h.matchAll(/\b(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) injected.add(m[1]);
    for (const m of HARNESS_JS.matchAll(/\bimport\s*\{([^}]*)\}/g)) m[1].split(',').forEach((x) => injected.add(x.trim()));
    for (const m of h.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) injected.add(m[1]);
  }
  const missing = freeCalls(RELINK_SRC).filter((n) => !injected.has(n));
  expect(missing, '★조각이 ★부르는데 ★하네스에 ★없는 이름 — ★이게 ★ReferenceError 가 된다').toEqual([]);
});

test('G1 ★붙여넣기 사본(def id 새로 지음 + fill 은 원본 참조) → 둘 다 grad-<사본 id> 로', async ({ page }) => {
  await boot(page, `<div class="shape-block" id="shp_copy" data-shape-gradient="1"><svg class="shape-svg"><defs><linearGradient id="grad-shp_renamed"><stop offset="0%"/></linearGradient></defs><rect fill="url(#grad-shp_orig)"/></svg></div>`);
  const out = await page.evaluate(() => {
    const b = document.getElementById('shp_copy');
    const changed = window.__relink(b);
    const again = window.__relink(b);
    return { changed, again, def: b.querySelector('linearGradient').id, fill: b.querySelector('rect').getAttribute('fill') };
  });
  expect(out.changed).toBe(true);
  expect(out.again, '멱등').toBe(false);
  expect(out.def).toBe('grad-shp_copy');
  expect(out.fill).toBe('url(#grad-shp_copy)');
});

test('G2 ⌘D 사본(def id 도 원본 그대로 = 문서에 같은 id 2개) → 사본 것만 새 id, 원본 불변', async ({ page }) => {
  await boot(page, `
    <div class="shape-block" id="shp_orig"><svg><defs><linearGradient id="grad-shp_orig"></linearGradient></defs><rect fill="url(#grad-shp_orig)"/></svg></div>
    <div class="shape-block" id="shp_dup"><svg><defs><linearGradient id="grad-shp_orig"></linearGradient></defs><rect fill="url(#grad-shp_orig)"/></svg></div>`);
  const out = await page.evaluate(() => {
    window.__relink(document.getElementById('shp_dup'));
    window.__relink(document.getElementById('shp_orig'));
    const q = (id) => { const b = document.getElementById(id); return [b.querySelector('linearGradient').id, b.querySelector('rect').getAttribute('fill')]; };
    return { o: q('shp_orig'), d: q('shp_dup') };
  });
  expect(out.o).toEqual(['grad-shp_orig', 'url(#grad-shp_orig)']);
  expect(out.d).toEqual(['grad-shp_dup', 'url(#grad-shp_dup)']);
});

test('G3 def 없이 fill 만 URL + 그라데이션 메타 없음(끊긴 참조) → 단색 복귀 · 그라데이션 없는 도형은 불변', async ({ page }) => {
  await boot(page, `
    <div class="shape-block" id="s1"><svg><rect fill="url(#grad-gone)"/></svg></div>
    <div class="shape-block" id="s2"><svg><rect fill="currentColor"/></svg></div>`);
  const out = await page.evaluate(() => ({
    c1: window.__relink(document.getElementById('s1')), f1: document.querySelector('#s1 rect').getAttribute('fill'),
    c2: window.__relink(document.getElementById('s2')), f2: document.querySelector('#s2 rect').getAttribute('fill'),
  }));
  expect(out).toEqual({ c1: true, f1: 'currentColor', c2: false, f2: 'currentColor' });
});

test('P1 ★붙여넣기 뒤 선택 = 사본만(원본 selected 해제) · 섹션 selected 는 유지', async ({ page }) => {
  await boot(page, `
    <div class="section-block selected" id="sec"><div class="section-inner">
      <div class="row"><div class="grid-block selected" id="grd_o"></div></div>
      <div class="row" id="pasted_row"><div class="grid-block selected" id="grd_c"></div></div>
      <div class="row" id="plain_row"><div class="text-block" id="tb_c"></div></div>
    </div></div>`);
  const out = await page.evaluate(() => {
    window.__keep([document.getElementById('pasted_row')]);
    const a = [...document.querySelectorAll('.selected')].map(e => e.id);
    // 사본 안에 선택 표시가 없으면 사본 루트(블럭)를 고른다
    document.querySelectorAll('.selected').forEach(e => { if (!e.classList.contains('section-block')) e.classList.remove('selected'); });
    const tb = document.getElementById('tb_c');
    window.__keep([tb]);
    return { a, b: [...document.querySelectorAll('.selected')].map(e => e.id), af: window._activeFrame };
  });
  expect(out.a.sort()).toEqual(['grd_c', 'sec']);
  expect(out.b.sort()).toEqual(['sec', 'tb_c']);
  expect(out.af).toBe(null);
});

test('A1 ★스탑 알파 한 번만: rgba(…,0.5)+opacity 0.5 = 0.5 · hex+0.5 = 0.5 · rgba(…,0.5)+1 = 0.5 · hex = 1', async ({ page }) => {
  await boot(page, '');
  const out = await page.evaluate(() => [
    window.__stop({ color: 'rgba(32,64,255,0.500)', opacity: 0.5 }),
    window.__stop({ color: '#2040ff', opacity: 0.5 }),
    window.__stop({ color: 'rgba(32,64,255,0.5)', opacity: 1 }),
    window.__stop({ color: '#2040ff' }),
  ]);
  expect(out[0]).toEqual({ col: 'rgb(32,64,255)', op: '0.5' });
  expect(out[1]).toEqual({ col: '#2040ff', op: '0.5' });
  expect(out[2]).toEqual({ col: 'rgb(32,64,255)', op: '0.5' });
  expect(out[3]).toEqual({ col: '#2040ff', op: '1' });
});

test('A2 렌더 실측: 50% 스탑의 SVG 픽셀 알파가 0.25 가 아니라 0.5', async ({ page }) => {
  await boot(page, '');
  const a = await page.evaluate(async () => {
    const { col, op } = window.__stop({ color: 'rgba(0,0,255,0.5)', opacity: 0.5 });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><defs><linearGradient id="g"><stop offset="0" stop-color="${col}" stop-opacity="${op}"/><stop offset="1" stop-color="${col}" stop-opacity="${op}"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas'); c.width = 10; c.height = 10;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    return ctx.getImageData(5, 5, 1, 1).data[3] / 255;
  });
  expect(Math.abs(a - 0.5)).toBeLessThan(0.02);
});

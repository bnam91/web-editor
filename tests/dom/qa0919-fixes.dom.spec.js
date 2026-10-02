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

/* resize-undo-history.dom.spec.js — 0920b «resize-undo»: 삽입 직후 «첫» 리사이즈 뒤 ⌘Z.
 *
 * ★현빈 2026-09-20 「원모양 쉐이프 블럭 추가후 최초에 모서리 핸들을 잡고 드래그 해서 크기를
 *   키웠다. 그 이후에 컨트롤 제트를 눌렀는데 사이즈가 되돌려지는게 아니라 블록 삽입된게
 *   사라지는 이슈」
 *
 * ★진짜 js/history.js 를 얹고, 진짜 드래그 핸들러를 _slice-block 으로 떠서 돌린다.
 *   (앱은 «안» 띄운다. 의존은 globals.js 하나뿐이고 globals.js 는 import 0 이라 #canvas 만 있으면 뜬다.)
 *
 * ★★음성대조가 이 스펙의 핵심이다 — 같은 소스를 문자열로 「pushHistory 를 onUp 으로」 되돌린
 *   변형본으로 같은 시나리오를 돌려 «첫 ⌘Z 에 도형이 사라짐»을 단언한다.
 *   변형본을 손으로 베껴 두지 «않는» 이유: 베껴 두면 본문이 바뀔 때 같이 안 늙어서
 *   「고치기 전」이 아니라 「그때의 코드」를 재는 화석이 된다. 여기선 «현재 소스»에서 만든다.
 *
 * 실행: npm run test:dom -- resize-undo-history
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { sliceBlock } = require('../unit/_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

const GLOBALS_JS = read('js/globals.js');
const HISTORY_JS = read('js/history.js');
const DRAG_HISTORY_JS = read('js/drag-history.js');
const BD = read('js/block-drag.js');
const OH = read('js/overlay-handles.js');

const SHAPE_SRC = sliceBlock(BD, 'function _onShapeHandleMouseDown(');
const FRAME_SRC = sliceBlock(OH, 'function _onHandleMouseDown(');
const ROT_SRC   = sliceBlock(OH, 'function _blockRotationDeg(');
const UNROT_SRC = sliceBlock(OH, 'function _unrotateDelta(').replace(/^export /, '');

/* ── 음성대조본: «현재» 소스를 고치기 «전» 모양으로 되돌린다 ─────────────────────────
 *   ⑴ beginDragHistory 선언 삭제  ⑵ onMove 의 arm 가드 삭제  ⑶ onUp 에 pushHistory 복원 */
function toPushAfter(src, fname) {
  /* 줄 단위로 «_hist 를 쓰는 줄»과 그 안내 주석을 걷어낸다. 정규식 한 벌로 본문 모양에
     매이지 않게 — 본문이 바뀌어도 이 변환은 안 늙는다(늙으면 아래에서 던진다). */
  let s = src.split('\n')
    .filter(l => !/_hist/.test(l) && !/^\s*\/\/ ★(첫 실제 이동|히스토리는)/.test(l))
    .join('\n');
  if (/_hist|beginDragHistory/.test(s)) throw new Error(`음성대조본에 _hist 잔재 (${fname})`);
  const up = s.indexOf('function onUp()');
  if (up === -1) throw new Error(`onUp 을 못 찾음 (${fname})`);
  const close = s.indexOf("document.removeEventListener('mouseup', onUp);", up);
  if (close === -1) throw new Error(`onUp 의 해제 줄을 못 찾음 (${fname})`);
  const at = s.indexOf('\n', close) + 1;
  s = s.slice(0, at) + '    window.pushHistory?.();\n' + s.slice(at);
  return s.replace(`function ${fname}(`, `function ${fname}_PRE(`);
}

const SHAPE_PRE = toPushAfter(SHAPE_SRC, '_onShapeHandleMouseDown');
const FRAME_PRE = toPushAfter(FRAME_SRC, '_onHandleMouseDown');

const HARNESS_JS = `
import './globals.js';
import './history.js';

/* ── history.js 가 기대하는 바깥 세계(최소) ── */
const canvas = document.getElementById('canvas');
window.getSerializedCanvas = () => canvas.innerHTML;
window.getLastVideoPendingSidecar = () => null;
window.rebindAll = () => {};
window.deselectAll = () => {};
window.applyPageSettings = () => {};
window.buildLayerPanel = () => {};
window.scheduleAutoSave = () => {};

${UNROT_SRC}
${ROT_SRC}
${SHAPE_SRC}
${FRAME_SRC}
${SHAPE_PRE}
${FRAME_PRE}
function applyFrameRotationMargin() {}

window.__handlers = {
  shape: _onShapeHandleMouseDown,
  shapePre: _onShapeHandleMouseDown_PRE,
  frame: _onHandleMouseDown,
  framePre: _onHandleMouseDown_PRE,
};
window.__ready = true;
`;

const BODY = `
<div id="canvas-scaler" style="transform:scale(1);transform-origin:0 0">
  <div id="canvas">
    <div class="section-block" id="sec"><div class="section-inner" id="inner"></div></div>
  </div>
</div>
<div id="canvas-wrap"></div><div id="panel-right"><div class="panel-body"></div></div>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    const js = (body) => route.fulfill({ contentType: 'application/javascript', body });
    if (u.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>.frame-block{position:relative;box-sizing:border-box}
                 .shape-block{width:100%;height:100%}
                 .section-inner{width:800px}\n                 .shape-handle{position:absolute;width:8px;height:8px}</style>
          <script src="/js/drag-history.js"></script>
          <script type="module" src="/__harness.js"></script>
          </head><body>${BODY}</body></html>`,
      });
    }
    if (u.pathname === '/__harness.js')       return js(HARNESS_JS);
    if (u.pathname === '/globals.js')         return js(GLOBALS_JS);
    if (u.pathname === '/history.js')         return js(HISTORY_JS);
    if (u.pathname === '/js/drag-history.js') return js(DRAG_HISTORY_JS);
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* 브라우저 안에서 도는 «시나리오» — which='shape'|'shapePre'|'frame'|'framePre' */
const SCENARIO = (which, zoom, moveBy) => {
  const inner = document.getElementById('inner');
  const scaler = document.getElementById('canvas-scaler');
  scaler.style.transform = `scale(${zoom})`;

  // ① 빈 캔버스에서 시작
  inner.innerHTML = '';
  window.clearHistory();

  // ② 「도형 삽입」 — block-factory 와 같은 push-before 규약: 찍고 나서 넣는다.
  window.pushHistory('도형 추가');
  const ss = document.createElement('div');
  ss.className = 'frame-block';
  ss.id = 'ss_circle';
  ss.dataset.width = '100'; ss.dataset.height = '100';
  ss.style.width = '100px'; ss.style.height = '100px';
  const blk = document.createElement('div');
  blk.className = 'shape-block';
  blk.id = 'shp_circle';
  ['nw', 'ne', 'sw', 'se'].forEach(d => {
    const h = document.createElement('div');
    h.className = `shape-handle ${d}`; h.dataset.dir = d;
    blk.appendChild(h);
  });
  ss.appendChild(blk);
  inner.appendChild(ss);

  const afterInsert = { len: window.historyStack.length, pos: window.historyPos };

  // ③ 첫 리사이즈 — se 핸들을 잡고 «한 번에» 끌지 않고 두 틱으로 민다(실제 마우스처럼).
  const target = which.startsWith('shape') ? blk : ss;
  const md = new MouseEvent('mousedown', { button: 0, clientX: 300, clientY: 300, bubbles: true });
  window.__handlers[which](md, target, 'se');
  const step = (dx, dy) => document.dispatchEvent(
    new MouseEvent('mousemove', { clientX: 300 + dx, clientY: 300 + dy, bubbles: true }));
  step(moveBy[0] / 2, moveBy[1] / 2);
  step(moveBy[0], moveBy[1]);
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

  const w = (id) => { const e = document.getElementById(id); return e ? e.style.width : null; };
  const snapHas = (i) => /id="ss_circle"/.test(window.historyStack[i]?.canvas || '');
  const snapW = (i) => (window.historyStack[i]?.canvas || '').match(/id="ss_circle"[^>]*style="width:\s*(\d+)px/)?.[1] || null;

  const afterDrag = { len: window.historyStack.length, pos: window.historyPos, liveW: w('ss_circle'),
                      topHas: snapHas(window.historyPos), topW: snapW(window.historyPos) };

  window.undo();
  const undo1 = { alive: !!document.getElementById('ss_circle'), liveW: w('ss_circle'),
                  len: window.historyStack.length, pos: window.historyPos };
  window.undo();
  const undo2 = { alive: !!document.getElementById('ss_circle'), pos: window.historyPos };
  window.redo();
  const redo1 = { alive: !!document.getElementById('ss_circle'), liveW: w('ss_circle') };
  window.redo();
  const redo2 = { alive: !!document.getElementById('ss_circle'), liveW: w('ss_circle') };

  return { afterInsert, afterDrag, undo1, undo2, redo1, redo2 };
};

const SCENARIO_SRC = SCENARIO.toString();
const run = (page, which, zoom, moveBy) => page.evaluate(
  ({ src, which, zoom, moveBy }) => eval('(' + src + ')')(which, zoom, moveBy),
  { src: SCENARIO_SRC, which, zoom, moveBy });

/* ═══════════════════════════════════════════════════════════════════════════
   T1b — 현빈 재현 그대로(도형 블록 .shape-handle)
═══════════════════════════════════════════════════════════════════════════ */
test('T1b ★도형 삽입 → «첫» 리사이즈 → ⌘Z = 크기만 되돌아간다(삽입은 살아 있다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'shape', 1, [80, 60]);
  expect(errs).toEqual([]);
  expect(r.afterInsert, '삽입은 push-before — [S0, B] 두 칸').toMatchObject({ len: 2, pos: 1 });
  // ★핵심: 드래그가 «삽입된 100px 상태»를 한 칸으로 남겼다.
  expect(r.afterDrag.len, '드래그가 히스토리 항목을 1개 남겨야 한다').toBe(3);
  expect(r.afterDrag.liveW).toBe('180px');
  expect(r.afterDrag.topHas, '맨 위 스냅샷에 도형이 «있어야» 한다').toBe(true);
  expect(r.afterDrag.topW, '맨 위 스냅샷은 «리사이즈 전» 100px 여야 한다').toBe('100');
  // ★현빈 제보 그 자리
  expect(r.undo1.alive, '첫 ⌘Z 에 도형이 사라졌다 — 바로 이 결함이다').toBe(true);
  expect(r.undo1.liveW, '첫 ⌘Z 는 «크기»만 되돌린다').toBe('100px');
  expect(r.undo2.alive, '두 번째 ⌘Z 에서야 삽입이 취소된다').toBe(false);
  expect(r.redo1.alive).toBe(true);
  expect(r.redo1.liveW).toBe('100px');
  expect(r.redo2.liveW, '⌘⇧Z 두 번이면 확대 상태로 돌아온다').toBe('180px');
});

test('T1b-음성대조 ★같은 소스를 «onUp 에서 찍던» 모양으로 되돌리면 첫 ⌘Z 가 삽입을 먹는다', async ({ page }) => {
  await boot(page);
  const r = await run(page, 'shapePre', 1, [80, 60]);
  expect(r.afterDrag.len, '고치기 전에도 항목 수는 3이다 — 수로는 안 보인다').toBe(3);
  expect(r.afterDrag.topW, '고치기 전엔 맨 위 스냅샷이 «확대된 뒤» 180px 다').toBe('180');
  expect(r.undo1.alive, '★음성대조 실패 — 고치기 전 모양인데 첫 ⌘Z 가 멀쩡하다(검사가 결함을 못 잰다)').toBe(false);
});

/* ═══════════════════════════════════════════════════════════════════════════
   T1a — 프레임 리사이즈 핸들(_onHandleMouseDown). 도형 전용 결함이 아님을 보인다.
═══════════════════════════════════════════════════════════════════════════ */
test('T1a ★프레임 리사이즈도 같다 — 도형 전용 결함이 아니다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'frame', 1, [80, 60]);
  expect(errs).toEqual([]);
  expect(r.afterDrag.len).toBe(3);
  expect(r.undo1.alive, '첫 ⌘Z 에 프레임이 통째로 사라졌다').toBe(true);
  expect(r.undo1.liveW).toBe('100px');
  expect(r.undo2.alive).toBe(false);
});

test('T1a-음성대조 ★프레임도 onUp 판이면 첫 ⌘Z 가 삽입을 먹는다', async ({ page }) => {
  await boot(page);
  const r = await run(page, 'framePre', 1, [80, 60]);
  expect(r.undo1.alive, '★음성대조 실패').toBe(false);
});

/* ═══════════════════════════════════════════════════════════════════════════
   40% 줌 — 현빈 실사용 배율. 임계가 «캔버스 좌표»여야 첫 미세 이동이 안 샌다.
═══════════════════════════════════════════════════════════════════════════ */
test('Z40 ★줌 40% 에서도 같다 — 화면 2px(=캔버스 5px) 이동이 기록된다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'shape', 0.4, [2, 2]);
  expect(errs).toEqual([]);
  expect(r.afterDrag.len, '40% 줌에서 화면 2px 가 «임계 미달»로 버려졌다').toBe(3);
  expect(r.afterDrag.liveW, '캔버스 좌표로 +5px → 105px').toBe('105px');
  expect(r.afterDrag.topW).toBe('100');
  expect(r.undo1.alive).toBe(true);
  expect(r.undo1.liveW).toBe('100px');
});

/* ═══════════════════════════════════════════════════════════════════════════
   부수결함 — 안 움직인 «맨클릭»이 항목을 만들지 않는다(= redo 꼬리가 안 죽는다).
═══════════════════════════════════════════════════════════════════════════ */
test('B1 ★⌘Z 뒤 핸들을 «툭» 눌렀다 떼도 항목이 안 쌓이고 redo 가 산다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const inner = document.getElementById('inner');
    inner.innerHTML = '';
    window.clearHistory();
    window.pushHistory('도형 추가');
    const ss = document.createElement('div');
    ss.className = 'frame-block'; ss.id = 'ss_circle';
    ss.style.width = '100px'; ss.style.height = '100px';
    const blk = document.createElement('div');
    blk.className = 'shape-block'; blk.id = 'shp_circle';
    const h = document.createElement('div');
    h.className = 'shape-handle se'; h.dataset.dir = 'se';
    blk.appendChild(h); ss.appendChild(blk); inner.appendChild(ss);

    const drag = (dx, dy) => {
      window.__handlers.shape(new MouseEvent('mousedown', { button: 0, clientX: 300, clientY: 300, bubbles: true }), blk, 'se');
      if (dx || dy) document.dispatchEvent(new MouseEvent('mousemove', { clientX: 300 + dx, clientY: 300 + dy, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    };
    drag(80, 60);
    window.undo();
    const before = { len: window.historyStack.length, pos: window.historyPos };
    drag(0, 0);                       // ★맨클릭 — 한 픽셀도 안 움직였다
    const after = { len: window.historyStack.length, pos: window.historyPos };
    window.redo();
    return { before, after, redoW: document.getElementById('ss_circle')?.style.width };
  });
  expect(errs).toEqual([]);
  expect(r.after.len, '맨클릭이 히스토리 항목을 만들었다 — redo 꼬리가 잘린다').toBe(r.before.len);
  expect(r.after.pos).toBe(r.before.pos);
  expect(r.redoW, '맨클릭 뒤 ⌘⇧Z 가 죽었다').toBe('180px');
});

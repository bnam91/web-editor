/* resize-undo-history.dom.spec.js — 0920b «resize-undo»: 삽입 직후 «첫» 리사이즈 뒤 ⌘Z.
 *
 * ★현빈 2026-09-20 「원모양 쉐이프 블럭 추가후 최초에 모서리 핸들을 잡고 드래그 해서 크기를
 *   키웠다. 그 이후에 컨트롤 제트를 눌렀는데 사이즈가 되돌려지는게 아니라 블록 삽입된게
 *   사라지는 이슈」
 *
 * ★기전(자세한 건 js/drag-history.js 머리말) — pushHistory 는 «부르는 그 순간»의 캔버스를
 *   찍는다. 그래서 스택은 «표본의 줄»이고 ⌘Z 는 한 칸 앞 표본으로 돌아간다. 이 레포엔
 *   부르는 규약이 두 벌이라(바꾸기 «전» 109자리 · 바꾼 «뒤» 258자리, 2026-09-20 기계 분류)
 *   이음매에서 표본이 «빠지거나»(⌘Z 가 둘을 같이 먹음) «겹친다»(⌘Z 한 번이 먹통).
 *   ⇒ 드래그는 «양쪽 끝»을 다 찍고, 겹친 표본은 history.js 가 버린다.
 *
 * ★진짜 js/history.js 를 얹고, 진짜 드래그 핸들러를 _slice-block 으로 떠서 돌린다.
 *   (앱은 «안» 띄운다. 의존은 globals.js 하나뿐이고 globals.js 는 import 0 이라 #canvas 만 있으면 뜬다.)
 *
 * ★★음성대조가 이 스펙의 핵심이다 — 같은 소스를 문자열로 「시작 표본을 안 찍던(dev)」
 *   모양으로 되돌린 변형본으로 같은 시나리오를 돌려 «첫 ⌘Z 에 도형이 사라짐»을 단언한다.
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
const SK = read('js/sticker-select.js');

const SHAPE_SRC = sliceBlock(BD, 'function _onShapeHandleMouseDown(');
const FRAME_SRC = sliceBlock(OH, 'function _onHandleMouseDown(');
/* ★2026-09-20 통합(int/0920b) — T-052(overlay-extend)가 overlay-handles.js 안의 사본
   _blockRotationDeg 를 지우고 frame-geometry.js 의 blockRotationDeg «한 벌»로 모았다
   (overlay-handles.js:82 는 이제 `const _blockRotationDeg = blockRotationDeg;` 별칭뿐이다.
    그 «한 벌» 규약을 tests/unit/overlay-float-wiring.test.mjs T1-b 가 지킨다).
   ⇒ 하네스도 SSOT 에서 떠 오고, 이름만 호출부가 쓰는 별칭 이름으로 맞춘다. */
const FG = read('js/frame-geometry.js');
const ROT_SRC   = sliceBlock(FG, 'export function blockRotationDeg(')
  .replace('export function blockRotationDeg(', 'function _blockRotationDeg(');
const UNROT_SRC = sliceBlock(OH, 'function _unrotateDelta(').replace(/^export /, '');
/* 스티커 — 이벨류에이터가 「현빈이 제보한 «그» 증상이 그대로 살아 있다」고 짚은 자리.
   코너 핸들은 _addCornerHandles 가 붙이므로 그 사슬을 통째로 떠서 «진짜» 경로로 돌린다. */
const STK_RM_SRC   = sliceBlock(SK, 'function _removeCornerHandles(');
const STK_CURSOR   = SK.split('\n').find(l => l.startsWith('const _STK_ROTATE_CURSOR'));
const STK_ADD_SRC  = sliceBlock(SK, 'function _addCornerHandles(');
const STK_CNR_SRC  = sliceBlock(SK, 'function _bindCornerHandleDrag(');
const STK_ROTB_SRC = sliceBlock(SK, 'function _bindRotateDrag(');

/* ── 음성대조본: «현재» 소스를 고치기 «전»(dev) 모양으로 되돌린다 ───────────────────
 *   dev 는 onUp 에서만 찍었다 = «시작 표본»이 없다. 그러니 _hist 를 쓰는 줄과 그 안내
 *   주석만 걷어내면 그게 곧 dev 모양이다(onUp 의 pushHistory 는 지금도 그대로 있다). */
function toNoStartSample(src, fname) {
  const lines = src.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/_hist/.test(l)) continue;
    // 「★«시작 상태»…」 안내 주석 블록(1~2줄)도 같이 걷는다
    if (/★«시작 상태»/.test(l)) { if (!/\*\//.test(l)) i++; continue; }
    out.push(l);
  }
  const s = out.join('\n');
  if (/_hist|beginDragHistory/.test(s)) throw new Error(`음성대조본에 _hist 잔재 (${fname})`);
  if (!/pushHistory/.test(s)) throw new Error(`음성대조본에 onUp pushHistory 가 없다 (${fname}) — 변환이 늙었다`);
  return s.replace(`function ${fname}(`, `function ${fname}_PRE(`);
}

const SHAPE_PRE = toNoStartSample(SHAPE_SRC, '_onShapeHandleMouseDown');
const FRAME_PRE = toNoStartSample(FRAME_SRC, '_onHandleMouseDown');
const STK_CNR_PRE = toNoStartSample(STK_CNR_SRC, '_bindCornerHandleDrag');

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
window._snapRotate = (d) => d;
window.showStickerProperties = () => {};
/* 스티커 렌더 — 진짜 renderStickerBlock 은 innerHTML 을 비운다(그래서 핸들을 다시 붙인다).
   그 «비우고 다시 붙이는» 성질만 최소로 흉내 낸다(크기는 dataset 이 진실이다). */
window.renderStickerBlock = (b) => {
  b.style.width  = (b.dataset.sizeW || b.dataset.size || 60) + 'px';
  b.style.height = (b.dataset.sizeH || b.dataset.size || 60) + 'px';
  b.style.left = (b.dataset.x || 0) + 'px';
  b.style.top  = (b.dataset.y || 0) + 'px';
};

${UNROT_SRC}
${ROT_SRC}
${SHAPE_SRC}
${FRAME_SRC}
${SHAPE_PRE}
${FRAME_PRE}
function applyFrameRotationMargin() {}
${STK_CURSOR}
${STK_RM_SRC}
${STK_ROTB_SRC}
${STK_CNR_SRC}
${STK_CNR_PRE}
${STK_ADD_SRC}

window.__handlers = {
  shape: _onShapeHandleMouseDown,
  shapePre: _onShapeHandleMouseDown_PRE,
  frame: _onHandleMouseDown,
  framePre: _onHandleMouseDown_PRE,
};
window.__stk = { add: _addCornerHandles, bind: _bindCornerHandleDrag, bindPre: _bindCornerHandleDrag_PRE };
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
  /* 삽입의 push-before 는 «빈 캔버스»를 찍는데 clearHistory 가 이미 같은 걸 찍어 뒀다
     ⇒ 무변화 중복 차단이 버린다. 「한 번 눌렀는데 두 칸」이던 게 여기서 사라진다. */
  expect(r.afterInsert, '삽입 직후는 여전히 한 칸 — 같은 빈 캔버스를 두 번 안 쌓는다').toMatchObject({ len: 1, pos: 0 });
  // ★핵심: 드래그가 «삽입된 100px 상태»를 한 칸으로 남겼다(시작 표본).
  expect(r.afterDrag.len, '드래그는 시작·끝 두 표본을 남긴다(빈칸 0 · 중복 0)').toBe(3);
  expect(r.afterDrag.liveW).toBe('180px');
  expect(r.afterDrag.topHas, '맨 위 스냅샷에 도형이 «있어야» 한다').toBe(true);
  expect(r.afterDrag.topW, '맨 위 스냅샷은 드래그 «끝» 180px 다').toBe('180');
  // ★현빈 제보 그 자리
  expect(r.undo1.alive, '첫 ⌘Z 에 도형이 사라졌다 — 바로 이 결함이다').toBe(true);
  expect(r.undo1.liveW, '첫 ⌘Z 는 «크기»만 되돌린다').toBe('100px');
  expect(r.undo2.alive, '두 번째 ⌘Z 에서야 삽입이 취소된다').toBe(false);
  expect(r.redo1.alive).toBe(true);
  expect(r.redo1.liveW).toBe('100px');
  expect(r.redo2.liveW, '⌘⇧Z 두 번이면 확대 상태로 돌아온다').toBe('180px');
});

test('T1b-음성대조 ★시작 표본을 안 찍던(dev) 모양이면 첫 ⌘Z 가 삽입을 먹는다', async ({ page }) => {
  await boot(page);
  const r = await run(page, 'shapePre', 1, [80, 60]);
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

test('T1a-음성대조 ★프레임도 dev 모양이면 첫 ⌘Z 가 삽입을 먹는다', async ({ page }) => {
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
  expect(r.undo1.alive).toBe(true);
  expect(r.undo1.liveW).toBe('100px');
});

/* ═══════════════════════════════════════════════════════════════════════════
   Z150 — 이벨류에이터 ④. 임계가 «쓰기»까지 막으면 100% 초과 줌에서 미세조정이 죽는다.
═══════════════════════════════════════════════════════════════════════════ */
test('Z150 ★줌 150% 에서 화면 1px(=캔버스 0.67px) 드래그가 «실제로» 크기를 바꾼다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'shape', 1.5, [1, 0]);
  expect(errs).toEqual([]);
  expect(r.afterDrag.liveW, '임계가 쓰기까지 삼켰다 — 고치기 전엔 먹히던 1px 조정이 무동작이 된다').toBe('101px');
  expect(r.afterDrag.len, '1px 조정도 되돌릴 수 있어야 한다').toBe(3);
  expect(r.undo1.liveW).toBe('100px');
  expect(r.undo1.alive).toBe(true);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M — «이웃 규약»과의 공존. 이벨류에이터 ①(회귀)·②(먹통 ⌘Z)가 여기서 걸린다.
   패널류 다수(258자리)는 «바꾸고 나서» 찍는다(push-after). 드래그가 그 앞에 와도 뒤에 와도
   표본이 빠지거나 겹치면 안 된다.
     · 드래그 → 패널  : 사이 표본이 없으면 ⌘Z 한 번이 «둘 다» 먹는다(①)
     · 패널 → 드래그  : 같은 표본이 두 칸 쌓이면 ⌘Z 한 번이 먹통이 된다(②)
   ⚠️사정거리 — 「삽입(push-before) → 패널(push-after)」 이음매는 이 카드가 «안» 고쳤다
     (드래그가 없는 이음매라 이 부품이 못 낀다 — dev 에도 있던 결함, P2 카드).
     그래서 시나리오는 삽입 «뒤»에 드래그를 한 번 넣어 그 이음매를 피한다.
═══════════════════════════════════════════════════════════════════════════ */
const MIX = (usePre) => {
  const inner = document.getElementById('inner');
  document.getElementById('canvas-scaler').style.transform = 'scale(1)';
  inner.innerHTML = '';
  window.clearHistory();

  window.pushHistory('도형 추가');                       // push-before(삽입)
  const ss = document.createElement('div');
  ss.className = 'frame-block'; ss.id = 'ss_circle';
  ss.dataset.width = '100'; ss.dataset.height = '100';
  ss.style.width = '100px'; ss.style.height = '100px';
  const blk = document.createElement('div');
  blk.className = 'shape-block'; blk.id = 'shp_circle';
  blk.dataset.fill = 'red';
  const h = document.createElement('div');
  h.className = 'shape-handle se'; h.dataset.dir = 'se';
  blk.appendChild(h); ss.appendChild(blk); inner.appendChild(ss);

  /* 「우측 패널에서 색을 바꾼다」 — 이 레포 다수파(push-after): 바꾸고 «나서» 찍는다. */
  const panelChange = () => { blk.dataset.fill = 'blue'; window.pushHistory('도형 색'); };
  /* 진짜 핸들러로 se 를 (dx,dy) 만큼 끈다. */
  const drag = (dx, dy) => {
    window.__handlers[usePre ? 'shapePre' : 'shape'](
      new MouseEvent('mousedown', { button: 0, clientX: 300, clientY: 300, bubbles: true }), blk, 'se');
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 300 + dx / 2, clientY: 300 + dy / 2, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 300 + dx, clientY: 300 + dy, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  };

  drag(80, 60);      // 100 → 180  (드래그 ①)
  panelChange();     // 색 red → blue (push-after)
  drag(60, 60);      // 180 → 240  (드래그 ②)

  const snap = () => {
    const e = document.getElementById('ss_circle');
    return { w: e ? e.style.width : null, fill: document.getElementById('shp_circle')?.dataset.fill || null,
             alive: !!e };
  };
  const steps = [snap()];
  for (let i = 0; i < 4; i++) { window.undo(); steps.push(snap()); }
  return { steps, len: window.historyStack.length };
};
const MIX_SRC = MIX.toString();
const mix = (page, usePre) => page.evaluate(
  ({ src, usePre }) => eval('(' + src + ')')(usePre), { src: MIX_SRC, usePre });

test('M1 ★드래그 ↔ 패널(push-after) 이 섞여도 ⌘Z 가 «한 번에 하나씩» 되돌린다', async ({ page }) => {
  const errs = await boot(page);
  const r = await mix(page, false);
  expect(errs).toEqual([]);
  expect(r.steps[0]).toMatchObject({ w: '240px', fill: 'blue' });
  expect(r.steps[1], '①⌘Z 는 드래그② 만 되돌린다').toMatchObject({ w: '180px', fill: 'blue' });
  expect(r.steps[2], '★회귀 — ⌘Z 한 번이 색과 «크기»를 같이 먹었다(드래그→패널 사이 표본이 빠졌다)')
    .toMatchObject({ w: '180px', fill: 'red' });
  expect(r.steps[3], '★먹통 — 화면이 하나도 안 바뀌는 ⌘Z 한 칸(패널→드래그 에서 같은 표본이 두 칸)')
    .toMatchObject({ w: '100px', fill: 'red', alive: true });
  expect(r.steps[4].alive, '마지막 ⌘Z 에 삽입이 취소된다').toBe(false);
});

test('M1-음성대조 ★시작 표본이 없으면(dev) ⌘Z 세 번에 «삽입까지» 사라진다', async ({ page }) => {
  await boot(page);
  const r = await mix(page, true);
  expect(r.steps[0]).toMatchObject({ w: '240px', fill: 'blue' });
  /* dev 는 셋 다 push-after 라 «자기들끼리»는 맞는다 — 어긋나는 건 삽입(push-before)과의 이음매다.
     그래서 같은 4연타에서 한 칸 «일찍» 블록이 사라진다(현빈이 본 그 증상). */
  expect(r.steps[3].alive, '★음성대조 실패 — dev 모양인데 삽입이 안 먹혔다(검사가 결함을 못 잰다)').toBe(false);
  expect(r.steps[3].w, 'dev 에선 「100px 로 돌아간 칸」이 아예 없다').toBe(null);
});

/* ═══════════════════════════════════════════════════════════════════════════
   S — 스티커. 이벨류에이터 ③ 「현빈이 제보한 «그» 증상이 스티커에 그대로 살아 있다」.
═══════════════════════════════════════════════════════════════════════════ */
const STICKER = (usePre) => {
  const inner = document.getElementById('inner');
  document.getElementById('canvas-scaler').style.transform = 'scale(1)';
  window.currentZoom = 100;
  inner.innerHTML = '';
  window.clearHistory();

  window.pushHistory('스티커 추가');            // push-before(삽입)
  const b = document.createElement('div');
  b.className = 'sticker-block'; b.id = 'stk1';
  b.dataset.shape = 'circle';
  b.dataset.sizeW = '60'; b.dataset.sizeH = '60'; b.dataset.size = '60';
  b.dataset.x = '0'; b.dataset.y = '0'; b.dataset.fontSize = '14';
  b.style.width = '60px'; b.style.height = '60px';
  inner.appendChild(b);
  window.__stk.add(b);
  if (usePre) {
    // 음성대조 — 핸들을 «고치기 전» 바인딩으로 다시 묶는다
    b.querySelectorAll('.sticker-corner-handle').forEach(el => {
      const c = el.dataset.corner;
      const fresh = el.cloneNode(true);
      el.replaceWith(fresh);
      window.__stk.bindPre(fresh, b, c);
    });
  }
  const br = b.querySelector('.sticker-corner-handle[data-corner="br"]');
  br.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 200, clientY: 200, bubbles: true }));
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: 220, clientY: 220, bubbles: true }));
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: 238, clientY: 238, bubbles: true }));
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

  const got = () => {
    const e = document.getElementById('stk1');
    return { alive: !!e, size: e ? e.dataset.sizeW : null };
  };
  const after = got();
  window.undo();
  const undo1 = got();
  window.undo();
  const undo2 = got();
  return { after, undo1, undo2, len: window.historyStack.length };
};
const STICKER_SRC = STICKER.toString();
const sticker = (page, usePre) => page.evaluate(
  ({ src, usePre }) => eval('(' + src + ')')(usePre), { src: STICKER_SRC, usePre });

test('S1 ★스티커 삽입 → «첫» 코너 리사이즈 → ⌘Z = 크기만 되돌아간다(스티커는 산다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await sticker(page, false);
  expect(errs).toEqual([]);
  expect(r.after.size, '드래그가 크기를 못 바꿨다 — 시나리오가 늙었다').toBe('98');
  expect(r.undo1.alive, '★첫 ⌘Z 에 스티커가 사라졌다 — 현빈 제보 그대로다').toBe(true);
  expect(r.undo1.size).toBe('60');
  expect(r.undo2.alive, '두 번째 ⌘Z 에서야 삽입이 취소된다').toBe(false);
});

test('S1-음성대조 ★스티커도 dev 모양이면 첫 ⌘Z 가 삽입을 먹는다', async ({ page }) => {
  await boot(page);
  const r = await sticker(page, true);
  expect(r.after.size).toBe('98');
  expect(r.undo1.alive, '★음성대조 실패 — 고치기 전 모양인데 첫 ⌘Z 가 멀쩡하다').toBe(false);
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

/* ═══════════════════════════════════════════════════════════════════════════
   D — history.js 무변화 중복 차단 자체의 계약
═══════════════════════════════════════════════════════════════════════════ */
test('D1 ★같은 캔버스를 두 번 찍으면 한 칸만 쌓인다 — 단, sideEffects 가 있으면 쌓는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const inner = document.getElementById('inner');
    inner.innerHTML = '<div id="x"></div>';
    window.clearHistory();
    const a = window.historyStack.length;
    window.pushHistory('무변화');                  // 캔버스 그대로
    const b = window.historyStack.length;
    let undone = 0;
    window.pushHistory('사이드이펙트', { onUndo: () => { undone++; } });  // 캔버스는 그대로지만 되돌릴 게 있다
    const c = window.historyStack.length;
    inner.innerHTML = '<div id="x"></div><div id="y"></div>';
    window.pushHistory('진짜 변화');
    const d = window.historyStack.length;
    return { a, b, c, d };
  });
  expect(errs).toEqual([]);
  expect(r.b, '무변화인데 한 칸이 쌓였다 — ⌘Z 가 먹통이 된다').toBe(r.a);
  expect(r.c, 'sideEffects 자리(스크래치패드)까지 버렸다 — 되돌릴 역동작이 사라진다').toBe(r.a + 1);
  expect(r.d, '진짜 변화가 안 쌓였다').toBe(r.c + 1);
});

test('D2 ★`draggable` 한 글자 차이는 «편집»이 아니다 — 그것 때문에 먹통 ⌘Z 가 남으면 안 된다', async ({ page }) => {
  /* 실측 근거(2026-09-20, 포트 9387): 리사이즈 끝 표본과 회전 시작 표본이 딱 이 한 글자만
     달라 중복 차단이 빗나갔고, ⌘Z 한 칸이 화면을 하나도 안 바꿨다(이벨류에이터 ②). */
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const inner = document.getElementById('inner');
    inner.innerHTML = '<div id="x" draggable="true"></div>';
    window.clearHistory();
    const a = window.historyStack.length;
    document.getElementById('x').setAttribute('draggable', 'false');   // 드래그 중 억제 — 편집이 아니다
    window.pushHistory('드래그 억제');
    const b = window.historyStack.length;
    document.getElementById('x').dataset.real = '1';                    // 진짜 편집
    window.pushHistory('진짜 편집');
    const c = window.historyStack.length;
    return { a, b, c };
  });
  expect(errs).toEqual([]);
  expect(r.b, 'draggable 뒤집힘이 히스토리 한 칸을 만들었다 — ⌘Z 가 먹통이 된다').toBe(r.a);
  expect(r.c, '진짜 편집이 안 쌓였다 — 정규화가 너무 넓다').toBe(r.a + 1);
});

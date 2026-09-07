// ── Zoom Block (확대블럭) ────────────────────────────────────────────────────
// 도형(rect/circle/square) + 그 도형에서 «광원 쪽으로» 뻗는 그림자 사다리꼴.
// ★그림자는 라디오로 끌 수 있다 — 그래서 이 «하나»가 스티커 블록 둘을 대신한다.
//     끔 = 도형 + 테두리(에셋블럭 스티커) / 켬 = 도형 + 그림자(돋보기)
// 현빈 발주: 「스티커블럭 추가. 확대블럭이라고 해줘. 들어가야 할 모양은 기본은 사각형이다.
//            그리고 프리셋으로 원, 정사각형을 넣어줘」
//
// 기하·SVG 조립은 전부 ./zoom-geometry.js(순수) — 이 파일은 dataset 읽기·DOM·이벤트만 한다.
//
// ⛔이 블록이 «아직 못 하는 것» 둘 — 조용히 빠지는 것이라 여기 적어 둔다(지디 지시 2026-09-08).
//   ① MCP 표면이 없다 — main/claude-pm 의 BLOCK_TYPES 에 zoom 이 «없다»(add_/update_ 도구 미구현).
//      ⇒ ★클로드PM 으로는 확대블럭을 «못 만들고 못 고친다». 사람이 컴포넌트 메뉴로만 넣을 수 있다.
//      (읽기 이름만 js/canvas-state.js PFX 에 zmb_ 로 줬다. grid 가 먼저 간 길이다.
//       도구를 만들면 BLOCK_TYPES 에 넣고 tests/unit/block-prefix-sync.test.js 의 known 에서 빼라.)
//   ② Figma export 분기가 없다 — js/io/export-figma-json.js 에 zoom 항목이 «없다».
//      ⇒ ★피그마로 업로드하면 확대블럭이 «조용히 빠진다»(오류도 안 난다). laurel 처럼 전용 분기가 필요하다.
//
// 의존성:
//   - insertAfterSelected (drag-utils.js)
//   - bindBlock (drag-drop.js)
//   - window.getSelectedSection / showNoSelectionHint / pushHistory / buildLayerPanel /
//     selectBlock / triggerAutoSave

import { insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';
import { buildZoomSvg, computeZoomGeometry } from './zoom-geometry.js';

const ZOOM_DEFAULTS = {
  shape:  'rect',   // ★기본은 사각형. 프리셋 = rect | circle | square
  angle:  0,        // 방향(도)
  length: 170,      // 길이(px) — 도형 중심 ~ 광원
  spread: 0,        // A·B 벌림(px)
  maxop:  30,       // ★최대 농도(%)
  curve:  100,      // 농도 곡선(= pw 1.0)
  narrow: 62,       // 좁아짐(%)
  size:   160,      // 도형 크기(px, 가로 지름)
  rot:    0,        // 도형 회전(도) — silhouette 이 받는 값
  fill:   '#cfd6e0',// 도형 색
  /* ★그림자 라디오(현빈 2026-09-08) — 이 한 값이 블록 «둘»을 하나로 합친다.
       'off' = 「에셋블럭 스티커」(도형 + 테두리) · 'on' = 「돋보기」(도형 + 그림자)
     ⛔off 여도 angle·length·maxop 는 «지우지 않는다». 다시 켜면 그대로 돌아와야 한다. */
  shadow: 'on',
  /* 테두리 — 원래 스티커 블록 A-1 의 「우측에서 테두리를 넣을 수 있다」가 여기로 들어왔다.
     그림자와 배타가 아니다(둘 다 켤 수 있다). ⛔도형 «바깥»에 그린다 — 크기가 줄면 안 된다. */
  bd:     'off',
  bdw:    6,        // 두께(px)
  bdc:    '#ffffff',// 색
  bdr:    0,        // 모서리(px) — 도형·테두리판이 «같이» 둥글어야 링 두께가 일정하다
};

const ZOOM_SHAPES = ['rect', 'circle', 'square'];
/** 라디오 두 벌의 값 — 모르는 값이 들어오면 기본으로 떨어뜨린다(저장본 변조 대비). */
function _onOff(v, dflt) { return (v === 'on' || v === 'off') ? v : dflt; }

function _num(v, dflt) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : dflt;
}

/** dataset → 상태. ★여기가 «기본값이 사는 단 한 자리»다. */
function readZoomState(block) {
  const d = block.dataset || {};
  const shape = ZOOM_SHAPES.includes(d.shape) ? d.shape : ZOOM_DEFAULTS.shape;
  return {
    shape,
    angle:  _num(d.angle,  ZOOM_DEFAULTS.angle),
    length: _num(d.length, ZOOM_DEFAULTS.length),
    spread: _num(d.spread, ZOOM_DEFAULTS.spread),
    maxop:  _num(d.maxop,  ZOOM_DEFAULTS.maxop),
    curve:  _num(d.curve,  ZOOM_DEFAULTS.curve),
    narrow: _num(d.narrow, ZOOM_DEFAULTS.narrow),
    size:   _num(d.size,   ZOOM_DEFAULTS.size),
    rot:    _num(d.rot,    ZOOM_DEFAULTS.rot),
    fill:   d.fill || ZOOM_DEFAULTS.fill,
    shadow: _onOff(d.shadow, ZOOM_DEFAULTS.shadow),
    bd:     _onOff(d.bd,     ZOOM_DEFAULTS.bd),
    bdw:    _num(d.bdw, ZOOM_DEFAULTS.bdw),
    bdc:    d.bdc || ZOOM_DEFAULTS.bdc,
    bdr:    _num(d.bdr, ZOOM_DEFAULTS.bdr),
  };
}

/* ★a·b 는 「끌기 전까지 «언제나» 자동」이다.
   한 번 고정해 두면 방향·길이를 바꿔도 안 따라와서 광원과 그림자가 «따로» 논다
   (현빈이 실제로 잡은 결함). ⇒ dataset 에 «네 값이 다 있을 때만» 사람이 끈 것으로 본다.
   끄는 «순간»에만 박는다(_pinShortEdge). */
function readPinnedShortEdge(block) {
  const d = block.dataset || {};
  const ax = parseFloat(d.ax), ay = parseFloat(d.ay);
  const bx = parseFloat(d.bx), by = parseFloat(d.by);
  if ([ax, ay, bx, by].every(Number.isFinite)) {
    return { a: { x: ax, y: ay }, b: { x: bx, y: by } };
  }
  return null;
}

/** 네 키를 지운다 = 다시 «언제나 자동». */
function clearPinnedShortEdge(block) {
  delete block.dataset.ax; delete block.dataset.ay;
  delete block.dataset.bx; delete block.dataset.by;
}

function _pinShortEdge(block, a, b) {
  block.dataset.ax = a.x.toFixed(2); block.dataset.ay = a.y.toFixed(2);
  block.dataset.bx = b.x.toFixed(2); block.dataset.by = b.y.toFixed(2);
}

function renderZoomBlock(block) {
  // ★그림은 «순수 모듈»이 만든다(zoom-geometry.js: buildZoomSvg) — 검사가 실제로 나가는
  //   마크업을 그대로 받아 잴 수 있게 하려는 것이다. 여기는 dataset 읽기와 위임 바인딩만.
  block.innerHTML = buildZoomSvg(readZoomState(block), readPinnedShortEdge(block));
  _bindZoomHandleDrag(block);
}

/* a·b 핸들 드래그 — 끄는 «순간»에만 dataset 에 박는다.
   ★한쪽만 끌어도 «둘 다» 박는다: 읽기(readPinnedShortEdge)가 네 값을 한 묶음으로 보기 때문이다.
     안 박힌 쪽을 자동으로 두면 「반은 고정·반은 따라옴」이라 축이 어긋난다.
   좌표 변환은 «도형 중심 로컬»로 한다 — 드래그 도중 bbox 가 커져 viewBox 가 움직여도
   시작점 기준 델타는 안 흔들린다. 화면 배율(캔버스 줌)은 svg 실측폭/viewBox폭으로 나눈다. */
function _bindZoomHandleDrag(block) {
  if (block._zoomHandleBound) return;
  block._zoomHandleBound = true;
  block.addEventListener('mousedown', e => {
    const h = e.target.closest?.('.zoom-handle');
    if (!h || !block.contains(h)) return;
    if (!block.classList.contains('selected')) return;
    e.preventDefault(); e.stopImmediatePropagation();

    const svg = block.querySelector('.zoom-svg');
    const vbW = parseFloat(svg?.getAttribute('viewBox')?.split(/\s+/)[2] || '0');
    const rect = svg?.getBoundingClientRect();
    const scale = (rect && rect.width > 0 && vbW > 0) ? (rect.width / vbW) : 1;

    const which = h.dataset.pt;               // 'a' | 'b'
    const st = readZoomState(block);
    const geo = computeZoomGeometry(st, readPinnedShortEdge(block));
    const start = { a: { ...geo.a }, b: { ...geo.b } };
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;

    const onMove = ev => {
      const dx = (ev.clientX - x0) / scale, dy = (ev.clientY - y0) / scale;
      if (!moved && Math.hypot(dx, dy) < 1) return;
      if (!moved) { moved = true; window.pushHistory?.('확대블럭 짧은 변'); }
      const next = { a: { ...start.a }, b: { ...start.b } };
      next[which] = { x: start[which].x + dx, y: start[which].y + dy };
      _pinShortEdge(block, next.a, next.b);
      renderZoomBlock(block);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (moved) {
        window.showZoomProperties?.(block);
        window.triggerAutoSave?.();
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function makeZoomBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'zoom-block';
  block.id = 'zmb_' + Math.random().toString(36).slice(2, 8);
  block.dataset.type = 'zoom';
  const shape = ZOOM_SHAPES.includes(opts.shape) ? opts.shape : ZOOM_DEFAULTS.shape;
  block.dataset.shape  = shape;
  block.dataset.angle  = String(opts.angle  ?? ZOOM_DEFAULTS.angle);
  block.dataset.length = String(opts.length ?? ZOOM_DEFAULTS.length);
  block.dataset.spread = String(opts.spread ?? ZOOM_DEFAULTS.spread);
  block.dataset.maxop  = String(opts.maxop  ?? ZOOM_DEFAULTS.maxop);
  block.dataset.curve  = String(opts.curve  ?? ZOOM_DEFAULTS.curve);
  block.dataset.narrow = String(opts.narrow ?? ZOOM_DEFAULTS.narrow);
  block.dataset.size   = String(opts.size   ?? ZOOM_DEFAULTS.size);
  block.dataset.rot    = String(opts.rot    ?? ZOOM_DEFAULTS.rot);
  block.dataset.fill   = String(opts.fill   ?? ZOOM_DEFAULTS.fill);
  block.dataset.shadow = _onOff(opts.shadow, ZOOM_DEFAULTS.shadow);
  block.dataset.bd     = _onOff(opts.bd,     ZOOM_DEFAULTS.bd);
  block.dataset.bdw    = String(opts.bdw    ?? ZOOM_DEFAULTS.bdw);
  block.dataset.bdc    = String(opts.bdc    ?? ZOOM_DEFAULTS.bdc);
  block.dataset.bdr    = String(opts.bdr    ?? ZOOM_DEFAULTS.bdr);
  // ⛔a·b 는 신규 생성 시 «절대» 박지 않는다 — 끌기 전까지 언제나 자동.
  renderZoomBlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addZoomBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory?.();
  const { row, block } = makeZoomBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel?.();
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeZoomBlock          = makeZoomBlock;
window.addZoomBlock           = addZoomBlock;
window.renderZoomBlock        = renderZoomBlock;
window.readZoomState          = readZoomState;
window.readPinnedZoomShortEdge = readPinnedShortEdge;
window.clearPinnedZoomShortEdge = clearPinnedShortEdge;
window.ZOOM_DEFAULTS          = ZOOM_DEFAULTS;
window.ZOOM_SHAPES            = ZOOM_SHAPES;

export {
  makeZoomBlock,
  addZoomBlock,
  renderZoomBlock,
  readZoomState,
  readPinnedShortEdge,
  clearPinnedShortEdge,
  ZOOM_DEFAULTS,
  ZOOM_SHAPES,
};

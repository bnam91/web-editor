// pen-tool.js — Figma/Illustrator 스타일 벡터 펜툴 (베지어 패스 그리기 + 재편집)
// 신규 vectorPen 모드 — annotation-tool.js의 penMode(폴리라인 주석)와는 별개.
//
// 그리기:
//   - 클릭            = 코너 앵커
//   - 클릭-드래그     = 스무드 앵커(대칭 핸들 생성)
//   - Option-드래그   = 비대칭 핸들 분리(out 핸들만 끌기)
//   - 첫 앵커 클릭/호버 = 패스 닫기
//   - Enter / 우클릭 / 더블클릭 = 열린 패스 확정
//   - Backspace       = 마지막 앵커 삭제
//   - Shift           = 직전 앵커 기준 45° 제약
//   - ESC             = 그리는 중이면 취소, idle이면 모드 종료
//
// 산출물: window.addVectorBlock(svg, {w,h,color,label:'Pen'}) → vector-block.
//         생성 블록에 dataset.penNodes / penClosed / strokeWidth 부착(재편집 복원용).
//
// 편집: window.enterPenEditMode(vbBlock) — dataset.penNodes 복원 → 오버레이에서 앵커/핸들 재편집.

import { segmentPoints, splitSegment, nearestT } from './fx/bezier-split.js';   // 133 선분 눌러 점 더하기(순수)
const SVG_NS = 'http://www.w3.org/2000/svg';
// F8: 정본 토큰(--ui-accent-primary)에서 런타임 1회 초기화. 미정의 시 #2d6fe8 폴백.
const ACCENT = (() => {
  try {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--ui-accent-primary').trim() || '#2d6fe8';
  } catch (_) { return '#2d6fe8'; }
})();

// ── 모듈 상태 (그리기) ──────────────────────────────────────────────────────
let _mode = false;
let _bound = false;
let _draw = null;            // { sec, nodes:[node], closed:bool }
let _overlay = null;         // 그리기 라이브 오버레이 (sec 내부)
let _cursor = { x: 0, y: 0 };// 현재 커서 (sec 좌표)
let _dragging = null;        // 드래그 중 핸들 만드는 임시 노드 ref
let _dragStart = null;       // 드래그 시작 sec 좌표
let _closingDrag = false;    // F4: 닫기 드래그(첫 앵커 hIn 갱신) 모드

// node = { x, y, type:'corner'|'smooth', hIn:{x,y}|null, hOut:{x,y}|null }
// 핸들은 노드 기준 "절대 좌표"(sec 좌표).

// ── 모듈 상태 (편집) ────────────────────────────────────────────────────────
let _edit = null;            // { block, sec, nodes, closed, strokeWidth, color, fill, bbox }
let _editOverlay = null;
let _editRaf = null;
let _editKeyBound = false;
let _selectedNodeIdx = -1;

// ── 공통 좌표 변환 ──────────────────────────────────────────────────────────
function _zoom() { return (window.currentZoom || 40) / 100; }

function _clientToSec(clientX, clientY, sec) {
  const rect = sec.getBoundingClientRect();
  const z = _zoom();
  return { x: (clientX - rect.left) / z, y: (clientY - rect.top) / z };
}

// 화면거리 hit-test용: sec 좌표 두 점의 화면상 거리
function _screenDist(a, b) {
  const z = _zoom();
  return Math.hypot((a.x - b.x) * z, (a.y - b.y) * z);
}

// ════════════════════════════════════════════════════════════════════════════
//  모드 토글
// ════════════════════════════════════════════════════════════════════════════
function enterVectorPenMode() {
  if (_mode) return;
  // annotation penMode와 상호 배타 · 연필·붓(t13A-02)도
  window.exitPenMode?.();
  window.exitFreehand?.();
  window.exitCountStickerMode?.();
  // 편집 모드 진행 중이면 종료
  exitPenEditMode();
  _mode = true;
  document.body.classList.add('vpen-mode');
  const btn = document.getElementById('fp-shape-dropdown')?.querySelector('.fp-dropdown-trigger');
  btn?.classList.add('active');
  _initListeners();
  document.addEventListener('keydown', _onDrawKeydown, true);
  window.showToast?.('🖊 펜툴 — 클릭=앵커 / 드래그=곡선 / Enter=확정 / ESC=종료');
}

function exitVectorPenMode() {
  if (!_mode) return;
  _mode = false;
  document.body.classList.remove('vpen-mode');
  const btn = document.getElementById('fp-shape-dropdown')?.querySelector('.fp-dropdown-trigger');
  btn?.classList.remove('active');
  _cancelDraw();
  _teardownListeners();
  document.removeEventListener('keydown', _onDrawKeydown, true);
}

function toggleVectorPenMode() {
  if (_mode) { exitVectorPenMode(); return; }
  enterVectorPenMode();
}

// ── 그리기 리스너 (capture) ─────────────────────────────────────────────────
function _initListeners() {
  if (_bound) return;
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap) return;
  wrap.addEventListener('mousedown',  _onMouseDown,  true);
  wrap.addEventListener('mousemove',  _onMouseMove,  true);
  wrap.addEventListener('mouseup',    _onMouseUp,    true);
  wrap.addEventListener('click',      _onClick,      true);
  wrap.addEventListener('dblclick',   _onDblClick,   true);
  wrap.addEventListener('contextmenu',_onContextMenu,true);
  _bound = true;
}

// F2: 종료 시 동일 옵션(capture=true)으로 전부 해제 + _bound 해제 (리스너 누수 방지)
function _teardownListeners() {
  if (!_bound) return;
  const wrap = document.getElementById('canvas-wrap');
  if (wrap) {
    wrap.removeEventListener('mousedown',  _onMouseDown,  true);
    wrap.removeEventListener('mousemove',  _onMouseMove,  true);
    wrap.removeEventListener('mouseup',    _onMouseUp,    true);
    wrap.removeEventListener('click',      _onClick,      true);
    wrap.removeEventListener('dblclick',   _onDblClick,   true);
    wrap.removeEventListener('contextmenu',_onContextMenu,true);
  }
  _bound = false;
}

function _cancelDraw() {
  _draw = null;
  _dragging = null;
  _dragStart = null;
  _closingDrag = false;
  if (_overlay) { _overlay.remove(); _overlay = null; }
}

// ── 마우스 다운: 앵커 추가 (드래그 시작 시 스무드 핸들 생성 준비) ──────────────
/* t13A-04(현빈 GO 261119 · DESIGN-t13A-04 ⓐ) — 섹션 «밖»(캔버스 빈 곳 · 스크래치 자리)에서 시작한 패스는 #canvas-scaler 좌표로 그리고
   확정하면 ★t13G-03 부터 가장 가까운 섹션의 떠 있는 펜 벡터(_finalizeDraw · 섹션이 없을 때만 스크래치 «펜 항목»). 섹션 안에서 시작하면 지금 그대로(섹션 블럭). 한 패스는 «시작한 곳» 기준. */
function _penHost(e) {
  const sec = e.target.closest?.('.section-block');
  if (sec) return sec;
  const scaler = document.getElementById('canvas-scaler');
  if (!scaler) return null;
  const t = e.target;
  return (t.closest?.('#canvas-scaler') || t.id === 'canvas-wrap') && !t.closest?.('#canvas') ? scaler : null;
}
const _isScratchHost = (h) => !!h && h.id === 'canvas-scaler';

/** 섹션 밖 그림의 «받을 섹션» — 화면 y(그린 것 세로 가운데)가 걸친 섹션, 없으면 위·아래 가장 가까운 것(바깥 .svg 드랍과 같은 규칙) · 섹션 0 이면 null.
 *  펜·연필(t13G-03)·붓(BRUSH-OUTSIDE-SECTION-FLOAT-01)이 같이 쓴다. */
export function penNearestSection(midY) {
  const secs = [...document.querySelectorAll('#canvas .section-block')];
  if (!secs.length) return null;
  const dist = (s) => { const q = s.getBoundingClientRect(); return midY < q.top ? q.top - midY : midY > q.bottom ? midY - q.bottom : 0; };
  return secs.reduce((a, s) => (dist(s) < dist(a) ? s : a));
}

function _onMouseDown(e) {
  if (!_mode || e.button !== 0) return;
  const sec = _penHost(e);
  if (!sec) return;
  e.stopPropagation();
  e.preventDefault();

  // 다른 섹션에서 시작 → 초기화
  if (_draw && _draw.sec !== sec) _cancelDraw();

  let p = _clientToSec(e.clientX, e.clientY, sec);
  p = _applyShift(p, e);

  // 첫 앵커 닫기 hit-test (이미 ≥2 노드 + 첫 앵커 근접)
  if (_draw && _draw.nodes.length >= 2 && !_draw.closed) {
    const first = _draw.nodes[0];
    if (_screenDist(p, { x: first.x, y: first.y }) <= 10) {
      _draw.closed = true;
      // 닫는 동작에서도 드래그하면 첫 앵커의 hIn을 만들 수 있게 dragging 세팅
      // F4: 닫기 드래그는 첫 앵커의 hIn(닫는 곡선 진입 핸들)을 갱신해야 함
      _dragging = first;
      _dragStart = { x: first.x, y: first.y };
      _closingDrag = true;
      _renderDraw();
      return;
    }
  }

  if (!_draw) _draw = { sec, nodes: [], closed: false };

  const node = { x: p.x, y: p.y, type: 'corner', hIn: null, hOut: null };
  _draw.nodes.push(node);
  _dragging = node;
  _dragStart = { x: p.x, y: p.y };
  _closingDrag = false;
  _renderDraw();
}

// ── 마우스 이동: 드래그 시 핸들 생성 / idle 시 고무줄 ───────────────────────
function _onMouseMove(e) {
  if (!_mode || !_draw) return;
  const sec = _draw.sec;
  let p = _clientToSec(e.clientX, e.clientY, sec);
  _cursor = p;

  if (_dragging && (e.buttons & 1)) {
    e.stopPropagation();
    e.preventDefault();
    let q = _applyShift(p, e, _dragStart);
    const dx = q.x - _dragging.x;
    const dy = q.y - _dragging.y;
    if (_closingDrag) {
      // F4: 닫기 드래그 — 첫 앵커의 hIn(마지막→첫 앵커 곡선의 진입 핸들)을 직접 갱신.
      // 드래그 방향 반대편을 hIn으로 둬 닫는 곡선이 자연스럽게 휘게 한다.
      _dragging.hIn = { x: _dragging.x - dx, y: _dragging.y - dy };
      if (!e.altKey) {
        // 대칭이면 hOut도 맞춰(첫 세그먼트도 부드럽게)
        _dragging.hOut = { x: _dragging.x + dx, y: _dragging.y + dy };
        _dragging.type = 'smooth';
      }
      _renderDraw();
      return;
    }
    _dragging.hOut = { x: _dragging.x + dx, y: _dragging.y + dy };
    if (e.altKey) {
      // Option: 비대칭 — hIn은 건드리지 않음 (out만 끌기)
      _dragging.type = 'corner';
    } else {
      // 대칭 스무드
      _dragging.hIn = { x: _dragging.x - dx, y: _dragging.y - dy };
      _dragging.type = 'smooth';
    }
    _renderDraw();
    return;
  }
  // idle 고무줄 갱신
  _renderDraw();
}

function _onMouseUp(e) {
  if (!_mode || !_draw) return;
  if (_dragging) {
    e.stopPropagation();
    _dragging = null;
    _dragStart = null;
    _closingDrag = false;
    // 닫힌 패스를 드래그로 마무리했으면 확정
    if (_draw.closed) { _finalizeDraw(); return; }
    _renderDraw();
  }
}

function _onClick(e) {
  // mousedown/up이 앵커를 처리하므로 click은 차단만 (선택/드래그 누출 방지)
  if (!_mode) return;
  const sec = _penHost(e);
  if (!sec) return;
  e.stopPropagation();
  e.preventDefault();
}

function _onDblClick(e) {
  if (!_mode) return;
  e.stopPropagation();
  e.preventDefault();
  // A1: 앵커 1개여도 _finalizeDraw가 토스트 안내 + 정리 담당
  if (_draw && _draw.nodes.length >= 1) _finalizeDraw();
}

function _onContextMenu(e) {
  if (!_mode) return;
  e.stopPropagation();
  e.preventDefault();
  if (_draw && _draw.nodes.length >= 1) _finalizeDraw();
  else _cancelDraw();
}

// Shift 45° 제약 — base(기본은 직전 앵커, 드래그면 dragStart) 기준
// ★1017t1h1 — 산식은 window._snapVecToStep(js/asset-rotate.js) 으로 옮겼다(공용화). 여기는 위임만.
//   tolDeg: null = 무조건 스냅(= 기존 Shift 꼴 그대로, 「Shift = 지금 꼴 유지」).
function _applyShift(p, e, base) {
  if (!e.shiftKey) return p;
  let ref = base;
  if (!ref && _draw && _draw.nodes.length > 0) {
    const prev = _draw.nodes[_draw.nodes.length - 1];
    ref = { x: prev.x, y: prev.y };
  }
  if (!ref) return p;
  return window._snapVecToStep(p, ref, { tolDeg: null });
}

// ════════════════════════════════════════════════════════════════════════════
//  노드 → SVG path
// ════════════════════════════════════════════════════════════════════════════
function nodesToSvgPath(nodes, closed) {
  if (!nodes || nodes.length === 0) return '';
  let d = `M ${_n(nodes[0].x)} ${_n(nodes[0].y)}`;
  for (let i = 1; i < nodes.length; i++) {
    d += _seg(nodes[i - 1], nodes[i]);
  }
  if (closed && nodes.length >= 2) {
    d += _seg(nodes[nodes.length - 1], nodes[0]);
    d += ' Z';
  }
  return d;
}

function _seg(a, b) {
  const c1 = a.hOut, c2 = b.hIn;
  if (c1 || c2) {
    const p1 = c1 || { x: a.x, y: a.y };
    const p2 = c2 || { x: b.x, y: b.y };
    return ` C ${_n(p1.x)} ${_n(p1.y)} ${_n(p2.x)} ${_n(p2.y)} ${_n(b.x)} ${_n(b.y)}`;
  }
  return ` L ${_n(b.x)} ${_n(b.y)}`;
}

function _n(v) { return Math.round(v * 100) / 100; }

// 전 노드 + 핸들 bbox
function _bbox(nodes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const acc = (x, y) => {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  };
  nodes.forEach(n => {
    acc(n.x, n.y);
    if (n.hIn) acc(n.hIn.x, n.hIn.y);
    if (n.hOut) acc(n.hOut.x, n.hOut.y);
  });
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

// 노드를 (minX,minY) 만큼 평행이동한 복사본 반환 (정규화)
function normalizeToBBox(nodes, bbox, pad) {
  const ox = bbox.minX - pad;
  const oy = bbox.minY - pad;
  return nodes.map(n => ({
    x: n.x - ox, y: n.y - oy, type: n.type,
    hIn: n.hIn ? { x: n.hIn.x - ox, y: n.hIn.y - oy } : null,
    hOut: n.hOut ? { x: n.hOut.x - ox, y: n.hOut.y - oy } : null,
  }));
}

// ════════════════════════════════════════════════════════════════════════════
//  라이브 그리기 오버레이
// ════════════════════════════════════════════════════════════════════════════
function _ensureOverlay(sec) {
  if (_overlay && _overlay._sec === sec) return _overlay;
  if (_overlay) _overlay.remove();
  const wrap = document.createElement('div');
  wrap.className = 'vpen-preview';
  wrap.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:60;';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;';
  wrap.appendChild(svg);
  wrap._svg = svg;
  wrap._sec = sec;
  sec.appendChild(wrap);
  _overlay = wrap;
  return wrap;
}

function _renderDraw() {
  if (!_draw) return;
  const { sec, nodes, closed } = _draw;
  const svg = _ensureOverlay(sec)._svg;
  svg.innerHTML = '';
  if (nodes.length === 0) return;

  // 확정 패스 (실선)
  const dConfirmed = nodesToSvgPath(nodes, closed);
  _path(svg, dConfirmed, ACCENT, 1.5, false);

  // 고무줄: 마지막 노드 → 커서 (닫히지 않았고 드래그 중 아닐 때)
  if (!closed && !_dragging && nodes.length >= 1) {
    const last = nodes[nodes.length - 1];
    const dRubber = `M ${_n(last.x)} ${_n(last.y)}` + (last.hOut
      ? ` C ${_n(last.hOut.x)} ${_n(last.hOut.y)} ${_n(_cursor.x)} ${_n(_cursor.y)} ${_n(_cursor.x)} ${_n(_cursor.y)}`
      : ` L ${_n(_cursor.x)} ${_n(_cursor.y)}`);
    _path(svg, dRubber, ACCENT, 1, true);
  }

  // 핸들 선 + 핸들 원
  nodes.forEach((n) => {
    if (n.hIn)  { _handleLine(svg, n, n.hIn);  _handleDot(svg, n.hIn); }
    if (n.hOut) { _handleLine(svg, n, n.hOut); _handleDot(svg, n.hOut); }
  });

  // 앵커 사각 (마지막 위에 그림)
  nodes.forEach((n, i) => _anchor(svg, n, i === 0));
}

function _path(svg, d, stroke, w, dashed) {
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', d);
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', stroke);
  p.setAttribute('stroke-width', String(w));
  if (dashed) p.setAttribute('stroke-dasharray', '4 3');
  p.setAttribute('stroke-linejoin', 'round');
  p.setAttribute('stroke-linecap', 'round');
  svg.appendChild(p);
  return p;
}

function _handleLine(svg, a, b) {
  const l = document.createElementNS(SVG_NS, 'line');
  l.setAttribute('x1', _n(a.x)); l.setAttribute('y1', _n(a.y));
  l.setAttribute('x2', _n(b.x)); l.setAttribute('y2', _n(b.y));
  l.setAttribute('stroke', ACCENT);
  l.setAttribute('stroke-width', '1');
  svg.appendChild(l);
}

function _handleDot(svg, p, idx, kind) {
  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('cx', _n(p.x)); c.setAttribute('cy', _n(p.y));
  c.setAttribute('r', '3.5');
  c.setAttribute('fill', '#fff');
  c.setAttribute('stroke', ACCENT);
  c.setAttribute('stroke-width', '1.2');
  if (kind) { c.dataset.handleKind = kind; c.dataset.nodeIdx = String(idx); }
  svg.appendChild(c);
  return c;
}

function _anchor(svg, n, isFirst, idx, selected) {
  const SZ = 7;
  const r = document.createElementNS(SVG_NS, 'rect');
  r.setAttribute('x', _n(n.x - SZ / 2)); r.setAttribute('y', _n(n.y - SZ / 2));
  r.setAttribute('width', SZ); r.setAttribute('height', SZ);
  r.setAttribute('fill', selected ? ACCENT : '#fff');
  r.setAttribute('stroke', ACCENT);
  r.setAttribute('stroke-width', '1.2');
  if (idx !== undefined) r.dataset.nodeIdx = String(idx);
  svg.appendChild(r);
  // 첫 앵커 닫기 인디케이터 (호버 근접 시)
  if (isFirst && _draw && _draw.nodes.length >= 2 && !_draw.closed &&
      _screenDist(_cursor, { x: n.x, y: n.y }) <= 10) {
    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('cx', _n(n.x)); ring.setAttribute('cy', _n(n.y));
    ring.setAttribute('r', '7');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', ACCENT);
    ring.setAttribute('stroke-width', '1.2');
    svg.appendChild(ring);
  }
  return r;
}

// ════════════════════════════════════════════════════════════════════════════
//  확정 → vector-block 커밋
// ════════════════════════════════════════════════════════════════════════════
// F17: penNodes JSON dataset 저장 길이 한도 (vector-block updateVectorBlock의 svg 한도와 동일)
const PEN_NODES_MAX = 200000;

function _finalizeDraw() {
  // A1: 앵커가 2개 미만이면 패스를 만들 수 없음 → 토스트 안내 + 펜딩 정리
  if (!_draw || _draw.nodes.length < 2) {
    if (_draw && _draw.nodes.length > 0) {
      window.showToast?.('점을 2개 이상 찍어야 패스가 만들어집니다');
    }
    _cancelDraw();
    return;
  }
  const sec = _draw.sec;
  // F7: 더블클릭/Enter 직전 중복 마지막 노드 제거 (같은 좌표 연속 클릭으로 생긴 퇴화 앵커)
  {
    const ns = _draw.nodes;
    while (ns.length >= 2) {
      const a = ns[ns.length - 1], b = ns[ns.length - 2];
      if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && !a.hIn && !a.hOut) {
        ns.pop();
      } else break;
    }
    if (ns.length < 2) {
      window.showToast?.('점을 2개 이상 찍어야 패스가 만들어집니다');
      _cancelDraw();
      return;
    }
  }
  const { nodes, closed } = _draw;
  const color = '#1a1a1a';
  const strokeWidth = 2;
  const fill = closed ? 'none' : 'none'; // 기본 채움 없음 — prop에서 토글

  const bb = _bbox(nodes);
  // F7: 퇴화 패스(bbox가 사실상 0) 미확정
  if ((bb.maxX - bb.minX) < 1 && (bb.maxY - bb.minY) < 1) {
    window.showToast?.('패스가 너무 작아 만들 수 없습니다');
    _cancelDraw();
    return;
  }
  const pad = strokeWidth + 2;
  const w = Math.max(20, Math.round(bb.maxX - bb.minX + pad * 2));
  const h = Math.max(20, Math.round(bb.maxY - bb.minY + pad * 2));
  const norm = normalizeToBBox(nodes, bb, pad);
  const d = nodesToSvgPath(norm, closed);

  const svg = _buildSvg(d, w, h, color, strokeWidth, fill);

  /* t13A-04 — 섹션 밖에서 시작한 패스 = 스크래치 펜 항목. 펜 데이터는 그 SVG 안(data-goditor-pen)에 싣는다 —
     스크래치의 모든 길(저장 외부화·다른 맥·⌘Z·복제·자르기)이 src 하나를 나르므로 칸을 따로 안 늘린다.
     src = base64 SVG data URL(저장 때 기존 외부화가 goya-asset .svg 로 · DESIGN §7). 섹션에 끌어 놓으면 펜 벡터(scratch-pad onUp). */
  /* ★t13G-03(0.9.13 185행 · 현빈 결정 261124 야간) — 섹션 밖 선 = «그린 자리»에 IAL(떠 있는) 펜 벡터. 임시보관함 아님 · 흐름 흡수 아님.
     섹션 = 그린 패스 세로 가운데가 걸친(없으면 위·아래 가장 가까운) 섹션 — 바깥 .svg 드랍(vector-block _nearestSection)과 같은 규칙 ·
     자리 = 그린 화면 자리 그대로 — 조임 없음(0.9.13 마감 ◑ 지디 261125: 옛 «섹션 상자 안 조임»은 왼쪽 밖 선을 ~193px 옮겼다) · 단 받을 섹션이 섹션 밖을 자르면 옛 조임 + 알림(아래 clips). 이력 = 놓은 «뒤» 한 칸(스크래치→섹션 변환과 같은 push-after).
     shortcut: 섹션이 하나도 없을 때만 옛 길(스크래치 펜 항목) — 그릴 섹션이 생기는 설계가 필요하면 그때. */
  if (_isScratchHost(sec)) {
    const z = _zoom(), hr = sec.getBoundingClientRect();
    const tgt = penNearestSection(hr.top + ((bb.minY + bb.maxY) / 2) * z);
    if (tgt && typeof window.placePenVectorInSection === 'function') {
      const tr = tgt.getBoundingClientRect();
      /* 받을 섹션이 섹션 밖을 자르면(Clip content 켬 = overflowVisible 키 없음/false) 그린 자리에 두면 놓는 즉시 다 잘려 «안 그려진다»(실앱 261125) ⇒ 옛 조임(섹션 안쪽) + 알림 · 자르지 않으면 그린 자리 — 지디 판정 ① · Figma «그린 선은 보인다» */
      const clips = tgt.dataset.overflowVisible !== 'true';
      const vb = window.placePenVectorInSection(tgt, { nodes: norm, closed: !!closed, sw: strokeWidth, color, fill, w, h },
        Math.round((hr.left + (bb.minX - pad) * z - tr.left) / z), Math.round((hr.top + (bb.minY - pad) * z - tr.top) / z), { clamp: clips });
      if (vb) {
        window.pushHistory?.('펜 패스');
        _cancelDraw();
        window.scheduleAutoSave?.();
        window.showToast?.(clips ? '🖊 섹션 밖 보이기가 꺼진 섹션이라 안쪽에 넣었어요' : '🖊 섹션 밖 패스 — 떠 있는 벡터로(Ignore Auto Layout)');
        return vb;
      }
    }
    const meta = encodeURIComponent(JSON.stringify({ nodes: norm, closed: !!closed, sw: strokeWidth, color, fill, w, h }));
    const tagged = svg.replace('<svg ', `<svg data-goditor-pen="${meta}" `);
    const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(tagged)));
    window._scratchAddAndSave?.(src, Math.round(bb.minX - pad), Math.round(bb.minY - pad), w);
    _cancelDraw();
    window.showToast?.('🖊 스크래치에 패스 — 섹션에 끌어 놓으면 벡터(점 편집)');
    return null;
  }

  // F1: 그린 섹션을 선택 상태로 동기화 → addVectorBlock의 insertAfterSelected가 해당 섹션 기준 삽입
  if (sec) window.selectSection?.(sec);

  // F17: penNodes JSON 길이 가드 — 초과 시 경고 후 메타 없이 저장(편집 불가하지만 도형은 유지)
  let penNodesStr = JSON.stringify(norm);
  let penMeta = {
    penNodes: penNodesStr,
    penClosed: closed ? '1' : '0',
    strokeWidth: String(strokeWidth),
    penFill: fill,
  };
  if (penNodesStr.length > PEN_NODES_MAX) {
    window.showToast?.('⚠ 패스 데이터가 너무 커 재편집 정보를 저장하지 않습니다');
    penMeta = {}; // 메타 스킵 (SVG 도형만 저장)
  }

  // F1: 펜 메타를 opts로 넘겨 makeVectorBlock이 생성 시점에 dataset에 박게 한다
  // (반환된 block을 fallback으로도 직접 부착 — querySelectorAll 마지막 집기 제거).
  const vb = window.addVectorBlock?.(svg, { w, h, color, label: 'Pen', ...penMeta });
  if (vb && penNodesStr.length <= PEN_NODES_MAX) {
    vb.dataset.penNodes = penMeta.penNodes;
    vb.dataset.penClosed = penMeta.penClosed;
    vb.dataset.strokeWidth = penMeta.strokeWidth;
    vb.dataset.penFill = penMeta.penFill;
  }

  _cancelDraw();
  window.scheduleAutoSave?.();
  window.showToast?.('🖊 패스 생성 — 펜툴 유지 중(ESC 종료)');
  return vb;
}

function _buildSvg(d, w, h, color, strokeWidth, fill) {
  const fillAttr = (fill && fill !== 'none') ? fill : 'none';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
         `<path d="${d}" fill="${fillAttr}" stroke="${color}" stroke-width="${strokeWidth}" ` +
         `stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

// ── 그리기 keydown ──────────────────────────────────────────────────────────
function _onDrawKeydown(e) {
  if (!_mode) return;
  const ae = document.activeElement;
  if (ae && (ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;

  if (e.key === 'Escape') {
    e.stopPropagation();
    if (_draw) { _cancelDraw(); }
    else { exitVectorPenMode(); }
    return;
  }
  if (e.key === 'Enter') {
    // A1: 앵커 1개여도 _finalizeDraw가 토스트 안내 + 정리 담당
    if (_draw && _draw.nodes.length >= 1) {
      e.stopPropagation();
      e.preventDefault();
      _finalizeDraw();
    }
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    if (_draw && _draw.nodes.length > 0) {
      e.stopPropagation();
      e.preventDefault();
      _draw.nodes.pop();
      _draw.closed = false;
      if (_draw.nodes.length === 0) _cancelDraw();
      else _renderDraw();
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  편집 모드 — 기존 vector-block의 penNodes 재편집
// ════════════════════════════════════════════════════════════════════════════
function enterPenEditMode(block) {
  if (!block || !block.classList?.contains('vector-block')) return;
  let nodes;
  try { nodes = JSON.parse(block.dataset.penNodes || '[]'); } catch (_) { nodes = []; }
  if (!Array.isArray(nodes) || nodes.length < 2) {
    window.showToast?.('이 벡터는 펜 패스 데이터가 없어 편집할 수 없습니다');
    return;
  }
  // 그리기 모드와 상호배타
  exitVectorPenMode();
  exitPenEditMode();

  _edit = {
    block,
    nodes,
    closed: block.dataset.penClosed === '1',
    strokeWidth: parseFloat(block.dataset.strokeWidth) || 2,
    color: block.dataset.color || '#1a1a1a',
    fill: block.dataset.penFill || 'none',
  };
  _selectedNodeIdx = -1;
  document.body.classList.add('vpen-edit-mode');
  block.classList.add('pen-editing'); // F15: 편집 대상 블록 강조 (CSS .pen-editing 활성화)
  _buildEditOverlay();
  _startEditRaf();
  if (!_editKeyBound) {
    document.addEventListener('keydown', _onEditKeydown, true);
    document.addEventListener('mousedown', _onEditOutsideDown, true);
    _editKeyBound = true;
  }
  window.showToast?.('✎ 패스 편집 — 앵커/핸들 드래그 · 선 누르면 점 추가 · Delete=앵커삭제 · ESC=완료');
}

function exitPenEditMode() {
  if (!_edit) return;
  _edit.block?.classList.remove('pen-editing'); // F15: 강조 해제
  _edit = null;
  _selectedNodeIdx = -1;
  document.body.classList.remove('vpen-edit-mode');
  if (_editRaf) { cancelAnimationFrame(_editRaf); _editRaf = null; }
  if (_editOverlay) { _editOverlay.remove(); _editOverlay = null; }
  if (_editKeyBound) {
    document.removeEventListener('keydown', _onEditKeydown, true);
    document.removeEventListener('mousedown', _onEditOutsideDown, true);
    _editKeyBound = false;
  }
}

function _buildEditOverlay() {
  const overlay = document.getElementById('ss-handles-overlay') || document.body;
  const wrap = document.createElement('div');
  wrap.className = 'vpen-edit-overlay';
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:9999;';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;overflow:visible;pointer-events:none;';
  wrap.appendChild(svg);
  wrap._svg = svg;
  overlay.appendChild(wrap);
  _editOverlay = wrap;
  _renderEdit();
}

// F5: 실제 SVG viewBox 추출 (dataset.svg에서). 없으면 dataset.w/h 폴백.
function _viewBoxOf(block) {
  const svg = block.dataset.svg || '';
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/i);
  if (m) return { vw: parseFloat(m[1]) || 120, vh: parseFloat(m[2]) || 120 };
  return { vw: parseInt(block.dataset.w) || 120, vh: parseInt(block.dataset.h) || 120 };
}

// 편집은 화면(client) 좌표로 핸들을 그린다 — block bbox를 screen에 매핑.
function _blockMap() {
  // F5: penNodes는 svg viewBox 좌표. 블록 client rect 폭/높이를 viewBox 기준으로 매핑.
  const b = _edit.block;
  const rect = b.getBoundingClientRect();
  const { vw, vh } = _viewBoxOf(b);
  const sx = rect.width / vw;
  const sy = rect.height / vh;
  return {
    toScreen: (p) => ({ x: rect.left + p.x * sx, y: rect.top + p.y * sy }),
    toLocal: (cx, cy) => ({ x: (cx - rect.left) / sx, y: (cy - rect.top) / sy }),
    sx, sy,
  };
}

function _renderEdit() {
  if (!_edit || !_editOverlay) return;
  const svg = _editOverlay._svg;
  svg.innerHTML = '';
  const m = _blockMap();
  const nodes = _edit.nodes;

  /* 133 PEN-EDIT-ADD-POINT-ON-SEGMENT-01 — 선분마다 안 보이는 굵은 «누름 띠»(앵커·핸들보다 먼저 그려 그 아래) · 누르면 그 자리에 점 */
  const segN = _edit.closed ? nodes.length : nodes.length - 1;
  for (let i = 0; i < segN; i++) {
    const sp = segmentPoints(nodes, i, _edit.closed);
    if (!sp) continue;
    const q = sp.map(m.toScreen);
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', `M ${_n(q[0].x)} ${_n(q[0].y)} C ${_n(q[1].x)} ${_n(q[1].y)} ${_n(q[2].x)} ${_n(q[2].y)} ${_n(q[3].x)} ${_n(q[3].y)}`);
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'transparent'); p.setAttribute('stroke-width', '10');
    p.dataset.segIdx = String(i);
    p.style.pointerEvents = 'stroke'; p.style.cursor = 'copy';
    p.addEventListener('mousedown', _onEditSegmentDown);
    svg.appendChild(p);
  }

  // 핸들 선 + 핸들 원
  nodes.forEach((n, i) => {
    const a = m.toScreen(n);
    if (n.hIn)  { const hi = m.toScreen(n.hIn);  _handleLine(svg, a, hi); _handleDot(svg, hi, i, 'in'); }
    if (n.hOut) { const ho = m.toScreen(n.hOut); _handleLine(svg, a, ho); _handleDot(svg, ho, i, 'out'); }
  });
  // 앵커
  nodes.forEach((n, i) => {
    const a = m.toScreen(n);
    const r = document.createElementNS(SVG_NS, 'rect');
    const SZ = 7; // F14: 그리기 앵커(7px)와 통일
    r.setAttribute('x', _n(a.x - SZ / 2)); r.setAttribute('y', _n(a.y - SZ / 2));
    r.setAttribute('width', SZ); r.setAttribute('height', SZ);
    r.setAttribute('fill', i === _selectedNodeIdx ? ACCENT : '#fff');
    r.setAttribute('stroke', ACCENT);
    r.setAttribute('stroke-width', '1.2'); // F14: 그리기 앵커(1.2)와 통일
    r.dataset.nodeIdx = String(i);
    svg.appendChild(r);
  });
  // 그려진 핸들/앵커에 mousedown 바인딩 — overlay는 pointer-events:none이므로
  // 개별 요소만 auto로
  svg.querySelectorAll('rect, circle[data-handle-kind]').forEach(el => {
    el.style.pointerEvents = 'auto';
    el.style.cursor = 'move';
  });
  svg.querySelectorAll('rect').forEach(el => {
    el.addEventListener('mousedown', _onEditAnchorDown);
  });
  svg.querySelectorAll('circle[data-handle-kind]').forEach(el => {
    el.addEventListener('mousedown', _onEditHandleDown);
  });
}

function _startEditRaf() {
  function loop() {
    if (!_edit) return;
    if (!_edit.block.isConnected) { exitPenEditMode(); return; }
    _renderEdit();
    _editRaf = requestAnimationFrame(loop);
  }
  _editRaf = requestAnimationFrame(loop);
}

/* 133 — 선분 누름 = 가장 가까운 t 에서 나눠 점 하나(곡선 = de Casteljau 로 모양 무변 · 직선 = 핸들 없는 꼭짓점) · 새 점 고름 · 이력 한 칸(_commitEdit) */
function _onEditSegmentDown(e) {
  if (e.button !== 0 || !_edit) return;
  e.stopPropagation(); e.preventDefault();
  const i = parseInt(e.currentTarget.dataset.segIdx);
  const sp = segmentPoints(_edit.nodes, i, _edit.closed);
  if (!sp) return;
  const { t } = nearestT(sp, _blockMap().toScreen, e.clientX, e.clientY);
  const r = splitSegment(_edit.nodes, i, t, _edit.closed);
  if (!r) return;
  _edit.nodes = r.nodes;
  _selectedNodeIdx = r.index;
  _commitEdit({ keepBox: true });
}

function _onEditAnchorDown(e) {
  e.stopPropagation(); e.preventDefault();
  const i = parseInt(e.currentTarget.dataset.nodeIdx);
  _selectedNodeIdx = i;
  const node = _edit.nodes[i];
  const m = _blockMap();
  const start = { cx: e.clientX, cy: e.clientY };
  const orig = JSON.parse(JSON.stringify(node));
  function onMove(ev) {
    const dx = (ev.clientX - start.cx) / m.sx;
    const dy = (ev.clientY - start.cy) / m.sy;
    node.x = orig.x + dx; node.y = orig.y + dy;
    if (orig.hIn)  node.hIn  = { x: orig.hIn.x + dx,  y: orig.hIn.y + dy };
    if (orig.hOut) node.hOut = { x: orig.hOut.x + dx, y: orig.hOut.y + dy };
    _commitEditLive();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    _commitEdit();
  }
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup', onUp, true);
}

function _onEditHandleDown(e) {
  e.stopPropagation(); e.preventDefault();
  const i = parseInt(e.currentTarget.dataset.nodeIdx);
  const kind = e.currentTarget.dataset.handleKind; // 'in' | 'out'
  const node = _edit.nodes[i];
  _selectedNodeIdx = i;
  const m = _blockMap();
  const start = { cx: e.clientX, cy: e.clientY };
  const orig = JSON.parse(JSON.stringify(node));
  function onMove(ev) {
    const dx = (ev.clientX - start.cx) / m.sx;
    const dy = (ev.clientY - start.cy) / m.sy;
    if (kind === 'out') {
      node.hOut = { x: (orig.hOut?.x ?? node.x) + dx, y: (orig.hOut?.y ?? node.y) + dy };
      if (node.type === 'smooth' && !ev.altKey && orig.hIn) {
        // 대칭 유지
        node.hIn = { x: node.x - (node.hOut.x - node.x), y: node.y - (node.hOut.y - node.y) };
      }
    } else {
      node.hIn = { x: (orig.hIn?.x ?? node.x) + dx, y: (orig.hIn?.y ?? node.y) + dy };
      if (node.type === 'smooth' && !ev.altKey && orig.hOut) {
        node.hOut = { x: node.x - (node.hIn.x - node.x), y: node.y - (node.hIn.y - node.y) };
      }
    }
    if (ev.altKey) node.type = 'corner';
    _commitEditLive();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    _commitEdit();
  }
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup', onUp, true);
}

// 편집 중 라이브 — bbox 재계산 없이 현재 viewBox 안에서만 path 갱신(드래그 중 크기 고정)
function _commitEditLive() {
  if (!_edit) return;
  const b = _edit.block;
  const { vw, vh } = _viewBoxOf(b);
  const d = nodesToSvgPath(_edit.nodes, _edit.closed);
  const svg = _buildSvg(d, vw, vh, _edit.color, _edit.strokeWidth, _edit.fill);
  b.dataset.svg = svg;
  window.renderVector?.(b);
}

// F5: 드래그 종료 시 핸들 포함 bbox 재계산 → 노드 정규화 → viewBox/w/h 함께 갱신(클리핑 방지)
/* keepBox(133 점 추가 · 인텔 261120 A1): 점 추가는 정규화하지 않는다 — de Casteljau 로 나눈 핸들은 옛 조종점 볼록 껍질 안이라 상자를 넘지 않는데,
   «핸들 포함 bbox» 로 다시 맞추면 짧아진 핸들 탓에 상자가 줄어 노드가 원점 쪽으로 밀리고 블럭 자리는 그대로라 곡선이 화면에서 뛰었다(로컬 y 46.5 → 11).
   ⇒ 지금 viewBox·w·h 그대로 · 노드만 바꿔 쓰고 이력 한 칸. */
function _commitEdit({ keepBox = false } = {}) {
  if (!_edit) return;
  const b = _edit.block;
  if (keepBox) {
    const { vw, vh } = _viewBoxOf(b);
    b.dataset.svg = _buildSvg(nodesToSvgPath(_edit.nodes, _edit.closed), vw, vh, _edit.color, _edit.strokeWidth || 2, _edit.fill);
    b.dataset.penNodes = JSON.stringify(_edit.nodes);
    // cand16 합침: 끝모양·점선·이음·채움만(P2 04cc5fa15 · P5 b139a7ce1)을 고른 펜은 점 추가 뒤에도 공용 재빌드(viewBox 그대로) — 아래 정규화 길과 같은 줄
    if (b.dataset.strokeCap || b.dataset.strokeDash || b.dataset.strokeJoin || b.dataset.penStroke) window.rebuildPenSvg?.(b);
    window.renderVector?.(b);
    window.pushHistory?.('패스 편집');
    window.scheduleAutoSave?.();
    return;
  }

  // 핸들 포함 bbox 재계산 + 정규화
  const sw = _edit.strokeWidth || 2;
  const pad = sw + 2;
  const bb = _bbox(_edit.nodes);
  const norm = normalizeToBBox(_edit.nodes, bb, pad);
  _edit.nodes = norm;
  const vw = Math.max(20, Math.round(bb.maxX - bb.minX + pad * 2));
  const vh = Math.max(20, Math.round(bb.maxY - bb.minY + pad * 2));
  /* VECTOR-RESIZE-STRETCH-01: 늘인 벡터(data-stretch=1)는 상자 = viewBox × 늘인 배율 — 확정 때 w·h 를 점 bbox 로 «되돌리지» 않고 그 배율을 지킨다. */
  const ov = _viewBoxOf(b);
  const kx = b.dataset.stretch === '1' ? (parseInt(b.dataset.w) || ov.vw) / ov.vw : 1;
  const ky = b.dataset.stretch === '1' ? (parseInt(b.dataset.h) || ov.vh) / ov.vh : 1;

  const d = nodesToSvgPath(_edit.nodes, _edit.closed);
  const svg = _buildSvg(d, vw, vh, _edit.color, sw, _edit.fill);
  b.dataset.svg = svg;
  b.dataset.w = String(Math.max(20, Math.round(vw * kx)));
  b.dataset.h = String(Math.max(20, Math.round(vh * ky)));
  b.dataset.penNodes = JSON.stringify(_edit.nodes);
  // 끝모양·점선을 고른 펜이면 공용 재빌드로 다시 짓는다(방금 쓴 viewBox 그대로 · _buildSvg 는 둥근 끝 실선만 안다 — P2)
  if (b.dataset.strokeCap || b.dataset.strokeDash || b.dataset.strokeJoin || b.dataset.penStroke) window.rebuildPenSvg?.(b);
  window.renderVector?.(b);

  // updateVectorBlock으로 히스토리/저장 일원화 (svg는 이미 dataset에 반영됨)
  window.pushHistory?.('패스 편집');
  window.scheduleAutoSave?.();
}

function _onEditKeydown(e) {
  if (!_edit) return;
  const ae = document.activeElement;
  if (ae && (ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;

  if (e.key === 'Escape') {
    e.stopPropagation();
    exitPenEditMode();
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && _selectedNodeIdx >= 0) {
    if (_edit.nodes.length <= 2) { window.showToast?.('앵커는 최소 2개 필요'); return; }
    e.stopPropagation();
    e.preventDefault();
    _edit.nodes.splice(_selectedNodeIdx, 1);
    _selectedNodeIdx = -1;
    _commitEdit();
  }
}

// t13A-03 — 편집 중 캔버스의 «다른 곳» 누르기 = 편집 끝(Illustrator 직접 선택으로 빈 곳 클릭). 클릭 자체는 막지 않는다(다른 블럭 고르기 그대로).
//   손잡이 오버레이(#ss-handles-overlay)·우측 패널은 #canvas-wrap 밖이라 안 걸린다.
function _onEditOutsideDown(e) {
  if (!_edit || e.button !== 0) return;
  if (!e.target.closest?.('#canvas-wrap') || _edit.block.contains(e.target)) return;
  exitPenEditMode();
}

// ── t13A-03 모드 전환 (V/A) ─────────────────────────────────────────────────
// V 출구 — 펜 그리기·편집을 끝내고 선택 커서로. 그리던 패스는 앵커 ≥2 면 확정(Illustrator: 도구를 바꾸면 열린 채 확정), 아니면 버림.
//   V 키는 여기서 잡지 않는다 — 공용 «V = 도구 모드 끝» 명부(t13A-08)가 이걸 부른다. 확정한 블럭을 돌려준다(없으면 null).
function penToolExitToSelect() {
  let vb = null;
  if (_mode) {
    if (_draw && _draw.nodes.length >= 2) vb = _finalizeDraw() || null;
    exitVectorPenMode();
  }
  exitPenEditMode();
  return vb;
}

// A 문맥 — 펜 그리는 중 · 펜 앵커 편집 중 · 펜 패스 벡터 하나가 골라져 있을 때만 A = 앵커 편집(true = A 를 먹었다).
//   그 밖은 false → editor.js 가 A 를 원래대로(에셋 메뉴) 쓴다. 펜 데이터 없는 벡터(SVG 들여오기 등)도 false.
function penEditFromContext() {
  if (_edit) return true;
  if (_mode) {
    const vb = penToolExitToSelect();
    if (vb) enterPenEditMode(vb);
    return true;
  }
  const sel = document.querySelectorAll('#canvas .vector-block.selected');
  if (sel.length !== 1 || !sel[0].dataset.penNodes) return false;
  enterPenEditMode(sel[0]);
  return !!_edit;
}

// ── window export ───────────────────────────────────────────────────────────
window.enterVectorPenMode  = enterVectorPenMode;
window.exitVectorPenMode   = exitVectorPenMode;
window.toggleVectorPenMode = toggleVectorPenMode;
window.enterPenEditMode    = enterPenEditMode;
/* t13A-02 연필 — 맞춘 노드(host 좌표)를 펜과 «같은» 확정 길(_finalizeDraw: 섹션 = 벡터 블럭 · 섹션 밖 = 떠 있는 펜 벡터 t13G-03)로. 그리던 펜 패스가 있으면 건드리지 않는다. */
window.penHostOf = _penHost;
window.commitPenNodes = (host, nodes, closed = false) => {
  if (_draw || !host || !Array.isArray(nodes) || nodes.length < 2) return null;
  _draw = { sec: host, nodes, closed: !!closed };
  return _finalizeDraw();
};
window.exitPenEditMode     = exitPenEditMode;
window.penNearestSection   = penNearestSection;   // 붓(freehand-tool) 섹션 밖 = 같은 받을 섹션 규칙
window.nodesToSvgPath      = nodesToSvgPath;
window.penToolExitToSelect = penToolExitToSelect;
window.penEditFromContext  = penEditFromContext;
// 맨 V = 공용 «도구 모드 끝» 명부(js/tool-modes.js) — 펜 그리기·편집이 켜져 있었을 때만 true(그때만 V 키를 먹는다).
window.registerToolModeExit?.('pen', () => { const on = _mode || !!_edit; penToolExitToSelect(); return on; });

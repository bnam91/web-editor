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

const SVG_NS = 'http://www.w3.org/2000/svg';
const ACCENT = '#0d99ff';

// ── 모듈 상태 (그리기) ──────────────────────────────────────────────────────
let _mode = false;
let _bound = false;
let _draw = null;            // { sec, nodes:[node], closed:bool }
let _overlay = null;         // 그리기 라이브 오버레이 (sec 내부)
let _cursor = { x: 0, y: 0 };// 현재 커서 (sec 좌표)
let _dragging = null;        // 드래그 중 핸들 만드는 임시 노드 ref
let _dragStart = null;       // 드래그 시작 sec 좌표

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
  // annotation penMode와 상호 배타
  window.exitPenMode?.();
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

function _cancelDraw() {
  _draw = null;
  _dragging = null;
  _dragStart = null;
  if (_overlay) { _overlay.remove(); _overlay = null; }
}

// ── 마우스 다운: 앵커 추가 (드래그 시작 시 스무드 핸들 생성 준비) ──────────────
function _onMouseDown(e) {
  if (!_mode || e.button !== 0) return;
  const sec = e.target.closest('.section-block');
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
      _dragging = first;
      _dragStart = { x: first.x, y: first.y };
      _renderDraw();
      return;
    }
  }

  if (!_draw) _draw = { sec, nodes: [], closed: false };

  const node = { x: p.x, y: p.y, type: 'corner', hIn: null, hOut: null };
  _draw.nodes.push(node);
  _dragging = node;
  _dragStart = { x: p.x, y: p.y };
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
    // 닫힌 패스를 드래그로 마무리했으면 확정
    if (_draw.closed) { _finalizeDraw(); return; }
    _renderDraw();
  }
}

function _onClick(e) {
  // mousedown/up이 앵커를 처리하므로 click은 차단만 (선택/드래그 누출 방지)
  if (!_mode) return;
  const sec = e.target.closest('.section-block');
  if (!sec) return;
  e.stopPropagation();
  e.preventDefault();
}

function _onDblClick(e) {
  if (!_mode) return;
  e.stopPropagation();
  e.preventDefault();
  if (_draw && _draw.nodes.length >= 2) _finalizeDraw();
}

function _onContextMenu(e) {
  if (!_mode) return;
  e.stopPropagation();
  e.preventDefault();
  if (_draw && _draw.nodes.length >= 2) _finalizeDraw();
  else _cancelDraw();
}

// Shift 45° 제약 — base(기본은 직전 앵커, 드래그면 dragStart) 기준
function _applyShift(p, e, base) {
  if (!e.shiftKey) return p;
  let ref = base;
  if (!ref && _draw && _draw.nodes.length > 0) {
    const prev = _draw.nodes[_draw.nodes.length - 1];
    ref = { x: prev.x, y: prev.y };
  }
  if (!ref) return p;
  const dx = p.x - ref.x;
  const dy = p.y - ref.y;
  const ang = Math.atan2(dy, dx);
  const snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
  const len = Math.hypot(dx, dy);
  return { x: ref.x + Math.cos(snap) * len, y: ref.y + Math.sin(snap) * len };
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
function _finalizeDraw() {
  if (!_draw || _draw.nodes.length < 2) { _cancelDraw(); return; }
  const { nodes, closed } = _draw;
  const color = '#1a1a1a';
  const strokeWidth = 2;
  const fill = closed ? 'none' : 'none'; // 기본 채움 없음 — prop에서 토글

  const bb = _bbox(nodes);
  const pad = strokeWidth + 2;
  const w = Math.max(20, Math.round(bb.maxX - bb.minX + pad * 2));
  const h = Math.max(20, Math.round(bb.maxY - bb.minY + pad * 2));
  const norm = normalizeToBBox(nodes, bb, pad);
  const d = nodesToSvgPath(norm, closed);

  const svg = _buildSvg(d, w, h, color, strokeWidth, fill);

  window.addVectorBlock?.(svg, { w, h, color, label: 'Pen' });

  // 방금 생성된 vector-block에 penNodes 등 부착 (addVectorBlock이 마지막 블록 추가)
  // selectSection 후 새 블록 찾기 — 가장 최근 vector-block
  const vbs = document.querySelectorAll('.vector-block');
  const vb = vbs[vbs.length - 1];
  if (vb) {
    vb.dataset.penNodes = JSON.stringify(norm);
    vb.dataset.penClosed = closed ? '1' : '0';
    vb.dataset.strokeWidth = String(strokeWidth);
    vb.dataset.penFill = fill;
  }

  _cancelDraw();
  window.scheduleAutoSave?.();
  window.showToast?.('🖊 패스 생성 — 펜툴 유지 중(ESC 종료)');
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
    if (_draw && _draw.nodes.length >= 2) {
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
  _buildEditOverlay();
  _startEditRaf();
  if (!_editKeyBound) {
    document.addEventListener('keydown', _onEditKeydown, true);
    _editKeyBound = true;
  }
  window.showToast?.('✎ 패스 편집 — 앵커/핸들 드래그, Delete=앵커삭제, ESC=완료');
}

function exitPenEditMode() {
  if (!_edit) return;
  _edit = null;
  _selectedNodeIdx = -1;
  document.body.classList.remove('vpen-edit-mode');
  if (_editRaf) { cancelAnimationFrame(_editRaf); _editRaf = null; }
  if (_editOverlay) { _editOverlay.remove(); _editOverlay = null; }
  if (_editKeyBound) {
    document.removeEventListener('keydown', _onEditKeydown, true);
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

// 편집은 화면(client) 좌표로 핸들을 그린다 — block bbox를 screen에 매핑.
function _blockMap() {
  // penNodes는 svg viewBox 좌표(0..w, 0..h). 블록의 client rect로 매핑.
  const b = _edit.block;
  const rect = b.getBoundingClientRect();
  const w = parseInt(b.dataset.w) || 120;
  const h = parseInt(b.dataset.h) || 120;
  const sx = rect.width / w;
  const sy = rect.height / h;
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
    const SZ = 8;
    r.setAttribute('x', _n(a.x - SZ / 2)); r.setAttribute('y', _n(a.y - SZ / 2));
    r.setAttribute('width', SZ); r.setAttribute('height', SZ);
    r.setAttribute('fill', i === _selectedNodeIdx ? ACCENT : '#fff');
    r.setAttribute('stroke', ACCENT);
    r.setAttribute('stroke-width', '1.4');
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

// 편집 중 라이브 — bbox 재계산 없이 viewBox 안에서만 path 갱신(블록 크기 고정)
function _commitEditLive() {
  if (!_edit) return;
  const b = _edit.block;
  const w = parseInt(b.dataset.w) || 120;
  const h = parseInt(b.dataset.h) || 120;
  const d = nodesToSvgPath(_edit.nodes, _edit.closed);
  const svg = _buildSvg(d, w, h, _edit.color, _edit.strokeWidth, _edit.fill);
  b.dataset.svg = svg;
  window.renderVector?.(b);
}

function _commitEdit() {
  if (!_edit) return;
  const b = _edit.block;
  _commitEditLive();
  b.dataset.penNodes = JSON.stringify(_edit.nodes);
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

// ── window export ───────────────────────────────────────────────────────────
window.enterVectorPenMode  = enterVectorPenMode;
window.exitVectorPenMode   = exitVectorPenMode;
window.toggleVectorPenMode = toggleVectorPenMode;
window.enterPenEditMode    = enterPenEditMode;
window.exitPenEditMode     = exitPenEditMode;
window.nodesToSvgPath      = nodesToSvgPath;

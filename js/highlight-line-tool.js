// highlight-line-tool.js — HighlightB (선 형광펜) 2점 클릭 입력 모드
// 모드 진입 → 캔버스 첫 클릭 (start point) + preview SVG → 두 번째 클릭 (end point) → finalize
// ESC 또는 우클릭으로 취소, 모드 재토글로 종료

let _hlbMode = false;
let _pending = null;          // { sec, x1, y1 }
let _previewEl = null;        // 임시 미리보기 DOM (sec 내부)
let _boundCanvas = false;
let _currentMouseSec = null;  // 현재 마우스가 위치한 섹션 (preview용)

const HLB_DEFAULTS = {
  thickness: 12,
  hlColor: 'rgba(255, 235, 70, 0.7)',
};

function enterHighlightBMode() {
  if (_hlbMode) return;
  _hlbMode = true;
  document.body.classList.add('hlb-mode');
  // 다른 모드와 충돌 방지
  window.exitPenMode?.();
  window._deselectAllStickers?.();
  window.deselectAll?.();
  _initCanvasListeners();
  document.addEventListener('keydown', _onKeydown, true);
  document.addEventListener('mousemove', _onMouseMove, true);
}

function exitHighlightBMode() {
  if (!_hlbMode) return;
  _hlbMode = false;
  document.body.classList.remove('hlb-mode');
  _cancelPending();
  document.removeEventListener('keydown', _onKeydown, true);
  document.removeEventListener('mousemove', _onMouseMove, true);
}

function toggleHighlightBMode() {
  if (_hlbMode) exitHighlightBMode();
  else enterHighlightBMode();
}

function _cancelPending() {
  _pending = null;
  if (_previewEl) { _previewEl.remove(); _previewEl = null; }
}

function _clientToSectionCoord(clientX, clientY, sec) {
  const rect = sec.getBoundingClientRect();
  const zoom = (window.currentZoom || 40) / 100;
  return {
    x: (clientX - rect.left) / zoom,
    y: (clientY - rect.top)  / zoom,
  };
}

function _initCanvasListeners() {
  if (_boundCanvas) return;
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap) return;
  wrap.addEventListener('click',       _onCanvasClickCapture,   true);
  wrap.addEventListener('mousedown',   _onMouseDownCapture,     true);
  wrap.addEventListener('contextmenu', _onContextMenuCapture,   true);
  _boundCanvas = true;
}

function _onCanvasClickCapture(e) {
  if (!_hlbMode) return;
  if (e.target.closest('#fp-pen-btn')) return;
  e.stopPropagation();
  e.preventDefault();
  _handleClick(e);
}

function _onMouseDownCapture(e) {
  if (!_hlbMode) return;
  if (e.target.closest('#fp-pen-btn')) return;
  if (!e.target.closest('.section-block')) return;
  e.stopPropagation();
  e.preventDefault();
}

function _onContextMenuCapture(e) {
  if (!_hlbMode) return;
  e.stopPropagation();
  e.preventDefault();
  _cancelPending();
}

function _handleClick(e) {
  const sec = e.target.closest('.section-block');
  if (!sec) return;
  let { x, y } = _clientToSectionCoord(e.clientX, e.clientY, sec);

  // 두 번째 클릭이 다른 섹션에서 일어나면 pending 리셋
  if (_pending && _pending.sec !== sec) {
    _cancelPending();
  }

  // Shift constrain — 첫 점 기준 수평/수직 snap
  if (e.shiftKey && _pending) {
    const dx = x - _pending.x1;
    const dy = y - _pending.y1;
    if (Math.abs(dx) >= Math.abs(dy)) y = _pending.y1;
    else x = _pending.x1;
  }

  if (!_pending) {
    // 1차 클릭 — start point 기록
    _pending = { sec, x1: x, y1: y };
    _updatePreview(x, y);
  } else {
    // 2차 클릭 — finalize
    _finalize(_pending.sec, _pending.x1, _pending.y1, x, y);
  }
}

function _onMouseMove(e) {
  if (!_hlbMode || !_pending) return;
  const sec = e.target.closest?.('.section-block') || _pending.sec;
  if (!sec) return;
  const { x, y } = _clientToSectionCoord(e.clientX, e.clientY, _pending.sec);
  _updatePreview(x, y, e.shiftKey);
}

function _updatePreview(x2, y2, shift = false) {
  if (!_pending) return;
  const { sec, x1, y1 } = _pending;
  if (shift) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (Math.abs(dx) >= Math.abs(dy)) y2 = y1;
    else x2 = x1;
  }
  if (!_previewEl) {
    const wrap = document.createElement('div');
    wrap.className = 'hlb-preview';
    wrap.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:60;';
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;';
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('stroke', HLB_DEFAULTS.hlColor);
    line.setAttribute('stroke-width', String(HLB_DEFAULTS.thickness));
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);
    // start dot
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('r', '4');
    c.setAttribute('fill', '#e74c3c');
    c.setAttribute('stroke', '#fff');
    c.setAttribute('stroke-width', '1.2');
    svg.appendChild(c);
    wrap.appendChild(svg);
    wrap._line = line;
    wrap._dot = c;
    sec.appendChild(wrap);
    _previewEl = wrap;
  }
  _previewEl._line.setAttribute('x1', x1);
  _previewEl._line.setAttribute('y1', y1);
  _previewEl._line.setAttribute('x2', x2);
  _previewEl._line.setAttribute('y2', y2);
  _previewEl._dot.setAttribute('cx', x1);
  _previewEl._dot.setAttribute('cy', y1);
}

function _finalize(sec, x1, y1, x2, y2) {
  // 너무 가까운 점은 무시
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.sqrt(dx * dx + dy * dy) < 4) {
    _cancelPending();
    return;
  }
  window.pushHistory?.('HighlightB 추가');
  const block = window.makeStickerBlock({
    shape: 'highlightB',
    x1, y1, x2, y2,
    thickness: HLB_DEFAULTS.thickness,
    hlColor: HLB_DEFAULTS.hlColor,
  });
  sec.appendChild(block);
  window.bindStickerSelect?.(block);
  _cancelPending();
  window.scheduleAutoSave?.();
}

function _onKeydown(e) {
  if (!_hlbMode) return;
  if (e.key === 'Escape') {
    e.stopPropagation();
    if (_pending) {
      _cancelPending();
    } else {
      exitHighlightBMode();
    }
  }
}

window.enterHighlightBMode  = enterHighlightBMode;
window.exitHighlightBMode   = exitHighlightBMode;
window.toggleHighlightBMode = toggleHighlightBMode;

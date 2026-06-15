// highlight-line-tool.js — HighlightB (선 형광펜) 2점 클릭 입력 모드
// 모드 진입 → 캔버스 첫 클릭 (start point) + preview SVG → 두 번째 클릭 (end point) → finalize
// ESC 또는 V 키로 모드 종료, 우클릭으로 pending 취소, 모드 재토글로 종료

let _hlbMode = false;
let _pending = null;          // { sec, x1, y1 }
let _previewEl = null;        // 임시 미리보기 DOM (sec 내부)
let _boundCanvas = false;
let _entryClickSeenAt = 0;    // 모드 진입 직후 첫 캔버스 click 무시용 타임스탬프 가드

const HLB_DEFAULTS = {
  thickness: 12,
  hlColor: 'rgba(255, 235, 70, 0.7)',
};

function enterHighlightBMode() {
  if (_hlbMode) return;
  _hlbMode = true;
  document.body.classList.add('hlb-mode');
  const btn = document.getElementById('fp-pen-btn');
  if (btn) btn.classList.add('active');
  // 다른 모드와 충돌 방지
  window.exitPenMode?.();
  window._deselectAllStickers?.();
  window.deselectAll?.();
  _initCanvasListeners();
  document.addEventListener('keydown', _onKeydown, true);
  document.addEventListener('mousemove', _onMouseMove, true);
  // 메뉴 버튼 클릭으로 진입한 직후 (~250ms) 같은 click 사이클이 캔버스로 흘러들어와
  // 즉시 시작점을 찍어버리는 부작용을 방지
  _entryClickSeenAt = performance.now();
}

function exitHighlightBMode() {
  if (!_hlbMode) return;
  _hlbMode = false;
  document.body.classList.remove('hlb-mode');
  const btn = document.getElementById('fp-pen-btn');
  if (btn) btn.classList.remove('active');
  _cancelPending();
  document.removeEventListener('keydown', _onKeydown, true);
  document.removeEventListener('mousemove', _onMouseMove, true);
}

function toggleHighlightBMode() {
  if (_hlbMode) { exitHighlightBMode(); return; }
  // (FIX-4) 이스터에그 게이팅 — off면 활성화 차단 (이미 켜진 건 위에서 정상 종료)
  if (window.isEasterEggEnabled && !window.isEasterEggEnabled('highlightBMode')) return;
  enterHighlightBMode();
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

// 좌표에서 가장 가까운 .section-block 을 elementsFromPoint 으로 탐색
// — section-block 위에 pointer-events:none preview 가 떠 있어도 잡힘
function _findSectionAtClient(clientX, clientY, evTarget) {
  // 1) target 의 closest 우선
  if (evTarget && evTarget.closest) {
    const direct = evTarget.closest('.section-block');
    if (direct) return direct;
  }
  // 2) elementsFromPoint 스택 탐색
  if (typeof document.elementsFromPoint === 'function') {
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const el of stack) {
      const sec = el.closest && el.closest('.section-block');
      if (sec) return sec;
    }
  }
  return null;
}

function _initCanvasListeners() {
  if (_boundCanvas) return;
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap) return;
  wrap.addEventListener('click',       _onCanvasClickCapture,   true);
  wrap.addEventListener('mousedown',   _onMouseDownCapture,     true);
  wrap.addEventListener('mouseup',     _onMouseUpCapture,       true);
  wrap.addEventListener('contextmenu', _onContextMenuCapture,   true);
  _boundCanvas = true;
}

function _onCanvasClickCapture(e) {
  if (!_hlbMode) return;
  if (e.target.closest?.('#fp-pen-btn')) return;
  if (e.target.closest?.('.fp-dropdown')) return;
  // 모드 진입 직후 50ms 내 click 은 진입 click 의 잔여 dispatch 일 수 있음 → 무시
  if (performance.now() - _entryClickSeenAt < 50) {
    _entryClickSeenAt = 0;
    e.stopPropagation();
    e.preventDefault();
    return;
  }
  e.stopPropagation();
  e.preventDefault();
  _handleClick(e);
}

function _onMouseDownCapture(e) {
  if (!_hlbMode) return;
  if (e.target.closest?.('#fp-pen-btn')) return;
  if (e.target.closest?.('.fp-dropdown')) return;
  // 캔버스/섹션 위 mousedown 은 모드 동안 전부 차단 (드래그 핸들러 진입 방지)
  if (!e.target.closest?.('#canvas-wrap')) return;
  e.stopPropagation();
  e.preventDefault();
}

function _onMouseUpCapture(e) {
  if (!_hlbMode) return;
  if (e.target.closest?.('#fp-pen-btn')) return;
  if (e.target.closest?.('.fp-dropdown')) return;
  if (!e.target.closest?.('#canvas-wrap')) return;
  // mouseup 도 차단 — 다른 select 로직이 mouseup 으로 동작하는 경우 대비
  e.stopPropagation();
}

function _onContextMenuCapture(e) {
  if (!_hlbMode) return;
  e.stopPropagation();
  e.preventDefault();
  if (_pending) _cancelPending();
  else exitHighlightBMode();
}

function _handleClick(e) {
  const sec = _findSectionAtClient(e.clientX, e.clientY, e.target);
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
  const sec = _pending.sec;
  if (!sec || !sec.isConnected) {
    _cancelPending();
    return;
  }
  const { x, y } = _clientToSectionCoord(e.clientX, e.clientY, sec);
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
  try { window.pushHistory?.('HighlightB 추가'); } catch (err) { console.warn('[HLB] pushHistory failed', err); }
  const block = window.makeStickerBlock({
    shape: 'highlightB',
    x1, y1, x2, y2,
    thickness: HLB_DEFAULTS.thickness,
    hlColor: HLB_DEFAULTS.hlColor,
  });
  sec.appendChild(block);
  try { window.bindStickerSelect?.(block); } catch (err) { console.warn('[HLB] bindStickerSelect failed', err); }
  _cancelPending();
  try { window.scheduleAutoSave?.(); } catch (err) { console.warn('[HLB] scheduleAutoSave failed', err); }
}

function _onKeydown(e) {
  if (!_hlbMode) return;
  // 입력 중인 텍스트 필드/contenteditable 에서는 단축키 무시
  const ae = document.activeElement;
  const editing = ae && (
    ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' ||
    ae.getAttribute?.('contenteditable') === 'true'
  );
  if (editing) return;

  if (e.key === 'Escape') {
    e.stopPropagation();
    e.preventDefault();
    if (_pending) _cancelPending();
    else exitHighlightBMode();
    return;
  }
  // V 키 — 펜딩 여부와 상관없이 모드 종료 (선택 도구로 복귀)
  if (e.key === 'v' || e.key === 'V') {
    e.stopPropagation();
    e.preventDefault();
    exitHighlightBMode();
  }
}

window.enterHighlightBMode  = enterHighlightBMode;
window.exitHighlightBMode   = exitHighlightBMode;
window.toggleHighlightBMode = toggleHighlightBMode;
// 디버깅용 상태 노출
window._hlbState = () => ({
  mode: _hlbMode,
  pending: !!_pending,
  previewMounted: !!_previewEl,
});

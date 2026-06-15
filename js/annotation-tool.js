// annotation-tool.js — 펜툴 어노테이션 Phase 2 (폴리라인)
// 펜툴 모드 진입 → 같은 섹션에서 N번 클릭 → 더블클릭 / Enter / 우클릭으로 종료
// ESC: 그리는 중이면 취소, 아니면 모드 종료. 버튼 재클릭 = 모드 종료
// 모드는 자동 종료되지 않음

// ── 모듈 상태 ─────────────────────────────────────────────────────────────
let _penMode = false;
let _pendingPoints = null;       // { sec, points: [[x,y], ...] }
let _pendingPreviewEl = null;    // 임시 SVG 미리보기 DOM (sec 내부)
let _penClickBound = false;      // 캔버스 캡처 리스너 1회 바인딩 가드

// 자체 더블클릭 검출 (native dblclick는 1번째 click이 점 추가로 소모되기 때문)
let _lastClickAt = 0;
let _lastClickXY = { x: 0, y: 0 };
const DBL_TIME_MS = 280;
const DBL_DIST_PX = 6;

// ── 모드 토글 ─────────────────────────────────────────────────────────────
function enterPenMode() {
  if (_penMode) return;
  _penMode = true;
  document.body.classList.add('pen-mode');
  const btn = document.getElementById('fp-pen-btn');
  if (btn) btn.classList.add('active');
  // 선택된 어노테이션이 있으면 해제 (선택/드래그 모드와 동시 활성 방지)
  window._deselectAllAnnotations?.();
  _initCanvasClickListener();
  document.addEventListener('keydown', _onKeydown, true);
}

function exitPenMode() {
  if (!_penMode) return;
  _penMode = false;
  document.body.classList.remove('pen-mode');
  const btn = document.getElementById('fp-pen-btn');
  if (btn) btn.classList.remove('active');
  _cancelPending();
  document.removeEventListener('keydown', _onKeydown, true);
}

function togglePenMode() {
  if (_penMode) { exitPenMode(); return; }
  // (FIX-4) 이스터에그 게이팅 — off면 활성화 차단 (이미 켜진 건 위에서 정상 종료)
  if (window.isEasterEggEnabled && !window.isEasterEggEnabled('penMode')) return;
  enterPenMode();
}

// ── 내부 유틸 ─────────────────────────────────────────────────────────────
function _cancelPending() {
  _pendingPoints = null;
  if (_pendingPreviewEl) { _pendingPreviewEl.remove(); _pendingPreviewEl = null; }
  _lastClickAt = 0;
}

// clientX/Y → 특정 section 좌상단 기준 px (zoom 보정)
function _clientToSectionCoord(clientX, clientY, sec) {
  const rect = sec.getBoundingClientRect();
  const zoom = (window.currentZoom || 40) / 100;
  const x = (clientX - rect.left) / zoom;
  const y = (clientY - rect.top) / zoom;
  return { x, y };
}

function _initCanvasClickListener() {
  if (_penClickBound) return;
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap) return;
  wrap.addEventListener('click',     _onCanvasClickCapture, true);
  wrap.addEventListener('mousedown', _onMouseDownCapture,   true);
  wrap.addEventListener('dblclick',  _onDblClickCapture,    true);
  wrap.addEventListener('contextmenu', _onContextMenuCapture, true);
  _penClickBound = true;
}

// ── 캡처 단계 이벤트 ──────────────────────────────────────────────────────
function _onCanvasClickCapture(e) {
  if (!_penMode) return;
  if (e.target.closest('.annot-label[contenteditable="true"]')) return;
  if (e.target.closest('#fp-pen-btn')) return;
  e.stopPropagation();
  e.preventDefault();
  _handlePenClick(e);
}

function _onMouseDownCapture(e) {
  if (!_penMode) return;
  if (e.target.closest('.annot-label[contenteditable="true"]')) return;
  if (e.target.closest('#fp-pen-btn')) return;
  if (!e.target.closest('.section-block')) return;
  e.stopPropagation();
  e.preventDefault();
}

function _onDblClickCapture(e) {
  if (!_penMode) return;
  // 자체 더블 검출로 처리하므로 native dblclick은 차단만
  e.stopPropagation();
  e.preventDefault();
}

function _onContextMenuCapture(e) {
  if (!_penMode) return;
  e.stopPropagation();
  e.preventDefault();
  // 그리는 중 ≥2점이면 우클릭으로도 종료
  if (_pendingPoints && _pendingPoints.points.length >= 2) {
    _finalizeAnnotation();
  } else {
    _cancelPending();
  }
}

// ── 클릭 핸들러 (N-step) ─────────────────────────────────────────────────
function _handlePenClick(e) {
  const sec = e.target.closest('.section-block');
  if (!sec) return;

  let { x, y } = _clientToSectionCoord(e.clientX, e.clientY, sec);
  const now = Date.now();

  // 다른 섹션에서 시작 → pending 초기화
  if (_pendingPoints && _pendingPoints.sec !== sec) {
    _cancelPending();
  }

  // Shift constrain — 이전 점으로부터 수평/수직 snap
  if (e.shiftKey && _pendingPoints && _pendingPoints.points.length > 0 && _pendingPoints.sec === sec) {
    const prev = _pendingPoints.points[_pendingPoints.points.length - 1];
    const dx = x - prev[0];
    const dy = y - prev[1];
    if (Math.abs(dx) >= Math.abs(dy)) y = prev[1]; // 수평
    else x = prev[0];                              // 수직
  }

  // 더블클릭 검출: 같은 위치 + 짧은 시간 + 이미 2점 이상이면 finalize
  if (_pendingPoints && _pendingPoints.points.length >= 2) {
    const dt = now - _lastClickAt;
    const dx = x - _lastClickXY.x;
    const dy = y - _lastClickXY.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dt < DBL_TIME_MS && dist < DBL_DIST_PX) {
      // 마지막에 추가된 중복점을 제거하지 않고 그대로 종료
      _finalizeAnnotation();
      return;
    }
  }

  // 점 추가
  if (!_pendingPoints) {
    _pendingPoints = { sec, points: [[x, y]] };
  } else {
    _pendingPoints.points.push([x, y]);
  }
  _lastClickAt = now;
  _lastClickXY = { x, y };
  _updatePreviewSvg();
}

// ── 미리보기 SVG ─────────────────────────────────────────────────────────
function _updatePreviewSvg() {
  if (!_pendingPoints) return;
  const { sec, points } = _pendingPoints;
  if (!_pendingPreviewEl) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const wrap = document.createElement('div');
    wrap.className = 'annot-preview';
    wrap.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:60;';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'annot-preview-svg');
    svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;';
    const poly = document.createElementNS(svgNS, 'polyline');
    poly.setAttribute('class', 'annot-preview-line');
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', '#1a1a1a');
    poly.setAttribute('stroke-width', '1.5');
    poly.setAttribute('stroke-dasharray', '4 3');
    poly.setAttribute('stroke-linejoin', 'round');
    poly.setAttribute('stroke-linecap', 'round');
    svg.appendChild(poly);
    wrap.appendChild(svg);
    wrap._poly = poly;
    wrap._svg = svg;
    sec.appendChild(wrap);
    _pendingPreviewEl = wrap;
  }
  const poly = _pendingPreviewEl._poly;
  const svg = _pendingPreviewEl._svg;
  poly.setAttribute('points', points.map(p => `${p[0]},${p[1]}`).join(' '));

  // 각 점 dot — 매번 다시 그림 (적은 수이므로 OK)
  // 기존 dot 제거
  svg.querySelectorAll('.annot-preview-dot').forEach(d => d.remove());
  const svgNS = 'http://www.w3.org/2000/svg';
  points.forEach((p, idx) => {
    const c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('class', 'annot-preview-dot');
    c.setAttribute('cx', p[0]);
    c.setAttribute('cy', p[1]);
    c.setAttribute('r', idx === 0 ? 4 : 3);
    c.setAttribute('fill', idx === 0 ? '#e74c3c' : '#fff');
    c.setAttribute('stroke', '#e74c3c');
    c.setAttribute('stroke-width', '1.2');
    svg.appendChild(c);
  });
}

// ── 어노테이션 확정 ──────────────────────────────────────────────────────
function _finalizeAnnotation() {
  if (!_pendingPoints) return;
  const { sec, points } = _pendingPoints;
  if (points.length < 2) { _cancelPending(); return; }

  if (typeof window.pushHistory === 'function') window.pushHistory('어노테이션 추가');
  const block = window.makeAnnotationBlock({ points, text: '텍스트' });
  sec.appendChild(block);

  // 라벨 즉시 편집 진입
  const label = block.querySelector('.annot-label');
  if (label) {
    label.setAttribute('contenteditable', 'true');
    _bindLabelEdit(label, block);
    setTimeout(() => {
      label.focus();
      try {
        const range = document.createRange();
        range.selectNodeContents(label);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (_) {}
    }, 0);
  }

  window.bindAnnotationSelect?.(block);
  _cancelPending();
  window.scheduleAutoSave?.();
  window.showToast?.('✏️ 펜 모드 유지 중 — ESC로 종료');
}

function _bindLabelEdit(label, block) {
  label.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      label.blur();
    } else if (ev.key === 'Escape') {
      ev.stopPropagation();
      label.blur();
    }
  });
  label.addEventListener('blur', () => {
    label.setAttribute('contenteditable', 'false');
    const txt = (label.textContent || '').trim();
    if (!txt) {
      label.textContent = '텍스트';
      block.dataset.text = '텍스트';
    } else {
      block.dataset.text = txt;
    }
    window.scheduleAutoSave?.();
  });
}

// ── 전역 keydown ─────────────────────────────────────────────────────────
function _onKeydown(e) {
  if (!_penMode) return;
  const active = document.activeElement;
  const editingLabel = active && active.classList && active.classList.contains('annot-label')
    && active.getAttribute('contenteditable') === 'true';

  // 그리는 중 Cmd+Z → 전역 undo(완성 주석 삭제) 막고 펜딩 마지막 점만 취소
  if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
    if (editingLabel) return;            // 라벨 편집 중 undo는 브라우저/전역에 위임
    if (_pendingPoints && _pendingPoints.points.length > 0) {
      e.stopPropagation();
      e.preventDefault();
      _pendingPoints.points.pop();
      if (_pendingPoints.points.length === 0) { _cancelPending(); }
      else { _lastClickAt = 0; _updatePreviewSvg(); }
      return;
    }
    // 펜딩 없으면 전역 undo 그대로 통과(가로채지 않음)
  }

  if (e.key === 'Escape') {
    // 라벨 편집 중 → 라벨 blur에 위임
    if (editingLabel) return;
    // 그리는 중 → 펜딩 취소
    if (_pendingPoints) {
      e.stopPropagation();
      _cancelPending();
      return;
    }
    // idle → 모드 종료
    e.stopPropagation();
    exitPenMode();
    return;
  }

  if (e.key === 'Backspace' || e.key === 'Delete') {
    if (editingLabel) return;            // 라벨 편집 중엔 텍스트 삭제로 위임
    if (_pendingPoints && _pendingPoints.points.length > 0) {
      e.stopPropagation();
      e.preventDefault();
      _pendingPoints.points.pop();        // 마지막 점 취소
      if (_pendingPoints.points.length === 0) { _cancelPending(); }
      else { _lastClickAt = 0; _updatePreviewSvg(); }  // 더블검출 리셋 + 미리보기 갱신
      return;
    }
  }

  if (e.key === 'Enter') {
    if (editingLabel) return; // 라벨 편집 중 Enter는 라벨이 처리
    if (_pendingPoints && _pendingPoints.points.length >= 2) {
      e.stopPropagation();
      e.preventDefault();
      _finalizeAnnotation();
    }
  }
}

// ── window export ────────────────────────────────────────────────────────
window.enterPenMode  = enterPenMode;
window.exitPenMode   = exitPenMode;
window.togglePenMode = togglePenMode;

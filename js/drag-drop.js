import { state } from './globals.js';
import {
  clearDropIndicators,
  clearLayerIndicators,
  clearSectionIndicators,
  clearLayerSectionIndicators,
  showToast,
  makeLabelItem,
  applyDividerStyle,
} from './drag-utils.js';
import { snapPosition, showGuides, hideGuides } from './smart-guides.js';

/* ═══════════════════════════════════
   DRAG AND DROP — state & event binding
═══════════════════════════════════ */

// perf(qa-perf): 드래그 중 autoSave MutationObserver 트리거 억제 헬퍼
function _suppressDragSave() { state._suppressAutoSave = true; }
function _resumeDragSave()   { state._suppressAutoSave = false; }

let dragSrc = null;
let layerDragSrc = null;
let sectionDragSrc = null;
let layerSectionDragSrc = null;

/* ═══════════════════════════════════
   FRAME RESIZE HANDLE OVERLAY
   Figma 방식: 핸들을 #ss-handles-overlay에 렌더링하여
   frame-block이 overflow:hidden을 직접 가질 수 있게 함
═══════════════════════════════════ */
let _overlayFrame = null;  // 현재 핸들이 표시된 frame-block
let _overlayRafId = null;

function _getOverlay() {
  return document.getElementById('ss-handles-overlay');
}

function showFrameHandles(ss) {
  if (_overlayFrame === ss) return; // already showing
  hideFrameHandles();
  _overlayFrame = ss;
  const overlay = _getOverlay();
  if (!overlay) return;

  const dirs = ['nw', 'ne', 'sw', 'se'];
  dirs.forEach(dir => {
    const h = document.createElement('div');
    h.className = `ss-resize-handle ${dir}`;
    h.dataset.dir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onHandleMouseDown(e, ss, dir));
  });
  _updateHandlePositions();
  _startHandleRaf();
}

function hideFrameHandles() {
  if (_overlayRafId) { cancelAnimationFrame(_overlayRafId); _overlayRafId = null; }
  _overlayFrame = null;
  const overlay = _getOverlay();
  if (overlay) overlay.innerHTML = '';
}

function _startHandleRaf() {
  function loop() {
    if (!_overlayFrame) return;
    // 프레임이 DOM에서 제거됐거나 선택 해제되면 핸들 제거
    if (!_overlayFrame.isConnected || !_overlayFrame.classList.contains('selected')) {
      hideFrameHandles();
      return;
    }
    _updateHandlePositions();
    _overlayRafId = requestAnimationFrame(loop);
  }
  _overlayRafId = requestAnimationFrame(loop);
}

function _updateHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_overlayFrame) return;
  const rect = _overlayFrame.getBoundingClientRect();
  const HALF = 3.5;
  const handles = overlay.querySelectorAll('.ss-resize-handle');
  handles.forEach(h => {
    const dir = h.dataset.dir;
    const top  = dir.includes('n') ? rect.top  - HALF : rect.bottom - HALF;
    const left = dir.includes('w') ? rect.left - HALF : rect.right  - HALF;
    h.style.top  = top  + 'px';
    h.style.left = left + 'px';
  });
}

function _onHandleMouseDown(e, ss, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const ssRect = ss.getBoundingClientRect();
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startW = Math.round(ssRect.width / scale0);
  const startH = Math.round(ssRect.height / scale0);
  const secInner = ss.closest('.section-inner') || ss.closest('.section-block');
  const secInnerCS = secInner ? getComputedStyle(secInner) : null;
  const paddingH = secInnerCS ? parseFloat(secInnerCS.paddingLeft) + parseFloat(secInnerCS.paddingRight) : 0;
  const maxW = secInner ? Math.round(secInner.clientWidth - paddingH) : 860;

  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    let newW = startW, newH = startH;
    if (dir.includes('e')) newW = Math.min(maxW, Math.max(60, startW + dx));
    if (dir.includes('w')) newW = Math.min(maxW, Math.max(60, startW - dx));
    if (dir.includes('s')) newH = Math.max(40, startH + dy);
    if (dir.includes('n')) newH = Math.max(40, startH - dy);
    newW = Math.round(newW); newH = Math.round(newH);
    ss.style.width  = `${newW}px`; ss.dataset.width  = String(newW);
    ss.style.height = `${newH}px`; ss.style.minHeight = `${newH}px`; ss.dataset.height = String(newH);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showFrameHandles = showFrameHandles;
window.hideFrameHandles = hideFrameHandles;

Object.defineProperty(window, 'dragSrc', {
  get() { return dragSrc; },
  set(v) { dragSrc = v; },
  configurable: true,
});
Object.defineProperty(window, 'layerDragSrc', {
  get() { return layerDragSrc; },
  set(v) { layerDragSrc = v; },
  configurable: true,
});
Object.defineProperty(window, 'sectionDragSrc', {
  get() { return sectionDragSrc; },
  set(v) { sectionDragSrc = v; },
  configurable: true,
});
Object.defineProperty(window, 'layerSectionDragSrc', {
  get() { return layerSectionDragSrc; },
  set(v) { layerSectionDragSrc = v; },
  configurable: true,
});

function getDragAfterElement(container, y) {
  const children = [...container.children].filter(el =>
    !el.classList.contains('drop-indicator') && el !== dragSrc
  );
  return children.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getSectionDragAfterEl(container, y) {
  const sections = [...container.children].filter(el =>
    el.classList.contains('section-block') && el !== sectionDragSrc
  );
  return sections.reduce((closest, sec) => {
    const box = sec.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: sec };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getLayerSectionDragAfterEl(panel, y) {
  const sections = [...panel.children].filter(el =>
    el.classList.contains('layer-section') && el !== layerSectionDragSrc?.sectionEl
  );
  return sections.reduce((closest, sec) => {
    const box = sec.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: sec };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getLayerDragAfterItem(container, y) {
  const items = [...container.children].filter(el =>
    (el.classList.contains('layer-item') || el.classList.contains('layer-row-group')) && el !== layerDragSrc
  );
  return items.reduce((closest, item) => {
    const box = item.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: item };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function ungroupBlock(groupEl) {
  const inner = groupEl.querySelector('.group-inner');
  if (!inner) { groupEl.remove(); return; }
  window.pushHistory();
  // group-inner의 자식들을 group-block 위치로 이동
  [...inner.children].forEach(child => groupEl.before(child));
  groupEl.remove();
  window.buildLayerPanel();
}

function bindGroupDrag(groupEl) {
  if (groupEl._groupDragBound) return;
  groupEl._groupDragBound = true;

  // group-block 클릭 핸들러:
  //   - group-editing 모드면 내부 블록 이벤트를 허용하고 리턴
  //   - 비선택 상태 클릭 → group-selected (1번 클릭)
  //   - group-selected 상태에서 재클릭 → group-editing 모드 진입 (2번 클릭)
  groupEl.addEventListener('click', e => {
    // group-editing 모드: 내부 블록 클릭을 bindBlock에 위임
    if (groupEl.classList.contains('group-editing')) return;
    // group-inner 내 클릭이지만 editing 모드가 아닌 경우: 전체 그룹 선택 처리
    if (e.target.closest('.group-inner')) {
      e.stopPropagation();
      if (groupEl.classList.contains('group-selected')) {
        // 2번 클릭 → group-editing 모드 진입
        groupEl.classList.add('group-editing');
        window.syncSection?.(groupEl.closest('.section-block'));
      } else {
        // 1번 클릭 → group-selected
        window.deselectAll?.();
        groupEl.classList.add('group-selected');
        window.syncSection?.(groupEl.closest('.section-block'));
      }
      return;
    }
    // 패딩 영역 클릭
    e.stopPropagation();
    if (groupEl.classList.contains('group-selected')) {
      // 이미 선택된 상태의 패딩 클릭은 group-editing 진입 없이 유지
      return;
    }
    window.deselectAll?.();
    groupEl.classList.add('group-selected');
    window.syncSection?.(groupEl.closest('.section-block'));
  });

  // group-editing 중 자식 클릭 시 deselectAll이 group 상태를 날린 뒤 setTimeout으로 복원
  groupEl.addEventListener('mousedown', e => {
    if (groupEl.classList.contains('group-editing') && groupEl.contains(e.target)) {
      setTimeout(() => {
        if (document.contains(groupEl)) {
          groupEl.classList.add('group-selected', 'group-editing');
        }
      }, 0);
    }
  }, true);

  // 외부 클릭으로 group-editing 해제 (document-level, capture)
  if (!groupEl._groupEditOutsideBound) {
    groupEl._groupEditOutsideBound = true;
    document.addEventListener('click', e => {
      if (!groupEl.classList.contains('group-editing')) return;
      if (!groupEl.contains(e.target)) {
        groupEl.classList.remove('group-editing');
      }
    }, true);
  }

  // group-block 자체를 드래그 핸들로 사용 (패딩 영역에서 드래그 시작)
  groupEl.setAttribute('draggable', 'true');
  groupEl.addEventListener('dragstart', e => {
    if (groupEl.classList.contains('group-editing')) return; // group-editing 중 그룹 드래그 차단
    if (e.target.closest('.group-inner')) return; // 내부 블록 드래그는 무시
    e.stopPropagation();
    _suppressDragSave();
    dragSrc = groupEl;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
    requestAnimationFrame(() => groupEl.classList.add('dragging'));
  });
  groupEl.addEventListener('dragend', () => {
    _resumeDragSave();
    groupEl.classList.remove('dragging');
    clearDropIndicators();
    dragSrc = null;
  });
}

function bindSectionDrag(sec) {
  const label = sec.querySelector('.section-label');
  if (!label || label._sectionDragBound) return;
  label._sectionDragBound = true;
  label.setAttribute('draggable', 'true');

  label.addEventListener('dragstart', e => {
    e.stopPropagation();
    _suppressDragSave();
    sectionDragSrc = sec;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
    requestAnimationFrame(() => sec.classList.add('section-dragging'));
  });
  label.addEventListener('dragend', () => {
    _resumeDragSave();
    sec.classList.remove('section-dragging');
    clearSectionIndicators();
    sectionDragSrc = null;
  });
}

function bindSectionDropZone(sec) {
  const inner = sec.querySelector('.section-inner');
  // rAF throttle: getBoundingClientRect()를 dragover 매 이벤트마다 호출하지 않도록 (DBG-11)
  let _innerDragRafId = null;
  inner.addEventListener('dragover', e => {
    if (!dragSrc) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (_innerDragRafId) return;
    const clientY = e.clientY;
    _innerDragRafId = requestAnimationFrame(() => {
      _innerDragRafId = null;
      if (!dragSrc) return;
      clearDropIndicators();
      const after = getDragAfterElement(inner, clientY);
      const indicator = document.createElement('div');
      indicator.className = 'drop-indicator';
      if (after) inner.insertBefore(indicator, after);
      else inner.appendChild(indicator);
    });
  });
  inner.addEventListener('dragleave', e => {
    if (!inner.contains(e.relatedTarget)) {
      if (_innerDragRafId) { cancelAnimationFrame(_innerDragRafId); _innerDragRafId = null; }
      clearDropIndicators();
    }
  });
  inner.addEventListener('drop', e => {
    e.preventDefault();
    if (_innerDragRafId) { cancelAnimationFrame(_innerDragRafId); _innerDragRafId = null; }
    if (!dragSrc) return;
    window.pushHistory();
    const indicator = inner.querySelector('.drop-indicator');
    if (indicator) inner.insertBefore(dragSrc, indicator);
    else inner.appendChild(dragSrc);
    clearDropIndicators();
    window.buildLayerPanel();
    dragSrc = null;
  });
}

function _getParentFrame(block) {
  return block.closest('.frame-block');
}
function _isInsideUnselectedFrame(block) {
  const ss = _getParentFrame(block);
  if (!ss) return false;
  // text-frame은 선택 투명 — 클릭 시 바로 text-block 선택
  if (ss.dataset.textFrame === 'true') return false;
  return !(ss.classList.contains('selected') && window._activeFrame === ss);
}

// 프레임(frame-block) 내 자식 블록 드래그 후 프레임 높이를 자동 확장
function _resizeFrameToFitChildren(block) {
  let ss = block.closest('.frame-block');
  if (!ss) return;
  // text-frame 자체가 넘어온 경우 → freeLayout 부모 프레임 대상으로
  if (ss.dataset.textFrame === 'true') {
    ss = ss.parentElement?.closest('.frame-block');
    if (!ss) return;
  }
  const childrenBottom = Math.max(...[...ss.children].map(c => {
    const top = parseInt(c.style.top || 0);
    return top + (c.offsetHeight || 0);
  }));
  if (childrenBottom > ss.offsetHeight) {
    ss.style.height = childrenBottom + 'px';
    ss.style.minHeight = childrenBottom + 'px';
  }
}

// 프레임 내부 블록 선택 시 프레임 selected 복원 헬퍼
// deselectAll()이 frame-block.selected를 제거해 CSS pointer-events가 다시 차단되는 문제 방지
function _restoreParentFrameSelected(block) {
  const pf = _getParentFrame(block);
  if (!pf) return;
  // text-frame은 선택 투명 wrapper — _activeFrame으로 설정하지 않고 실제 layout 프레임을 찾음
  const realFrame = pf.dataset.textFrame === 'true'
    ? pf.closest('.frame-block:not([data-text-frame])') // 상위 real frame (없으면 null)
    : pf;
  if (realFrame) {
    realFrame.classList.add('selected');
    window._activeFrame = realFrame;
    const parentSec = realFrame.closest('.section-block');
    if (parentSec) parentSec.classList.add('selected');
  }
  // realFrame이 null이면 (section 직속 text-frame): _activeFrame 설정 안 함 → 섹션에 추가됨
}

function bindBlock(block) {
  if (block._blockBound) return;
  block._blockBound = true;
  const isText       = block.classList.contains('text-block');
  const isGap        = block.classList.contains('gap-block');
  const isAsset      = block.classList.contains('asset-block');
  const isIconCb     = block.classList.contains('icon-circle-block');
  const isTableB     = block.classList.contains('table-block');
  const isLabelGroup = block.classList.contains('label-group-block');
  const isCard        = block.classList.contains('card-block');
  const isGraph       = block.classList.contains('graph-block');
  const isDivider     = block.classList.contains('divider-block');
  const isJoker      = block.classList.contains('joker-block');
  const isShape      = block.classList.contains('shape-block');

  // ── 공통: 절대좌표 드래그 (프레임 자유배치 — 모든 블록 타입) ──
  block.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (block.classList.contains('editing')) return;
    if (_getParentFrame(block) && !block.classList.contains('selected')) {
      // text-block 특례: text-frame 부모가 있고 실제 freeLayout frame이 selected면 드래그 허용
      if (isText) {
        const _tf = block.closest('.frame-block[data-text-frame="true"]');
        const _realFrame = _tf?.closest('.frame-block:not([data-text-frame])');
        if (!_realFrame?.classList.contains('selected')) return;
        // 드래그 허용 — 진행
      } else {
        return;
      }
    }
    if (isLabelGroup && e.target.closest('.label-item, .label-group-add-btn')) return;

    // shape-block: 부모 frame-block을 이동 대상으로
    // text-block: text-frame(래퍼)이 absolute인 경우 text-frame을 이동 대상으로
    // shape/text가 아닌 블록: block 자체가 absolute여야 함
    let dragEl = block;
    if (isShape) {
      const ss = block.closest('.frame-block');
      if (!ss || ss.style.position !== 'absolute') return;
      dragEl = ss;
    } else if (isText) {
      const tf = block.closest('.frame-block[data-text-frame="true"]');
      if (tf && tf.style.position === 'absolute') {
        dragEl = tf;
      } else if (block.style.position !== 'absolute') {
        return; // flow 배치 text-block은 HTML5 DnD에 위임
      }
    } else {
      if (block.style.position !== 'absolute') return;
    }

    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const startLeft = parseInt(dragEl.style.left || '0');
    const startTop  = parseInt(dragEl.style.top  || '0');

    // freeLayout 다중선택 피어 수집 — shift+클릭으로 선택된 형제 absolute 요소들
    const _parentFrameForMulti = dragEl.closest('.frame-block[data-free-layout]');
    const multiPeers = [];
    if (_parentFrameForMulti) {
      [..._parentFrameForMulti.children].forEach(ch => {
        if (ch === dragEl || ch.style.position !== 'absolute') return;
        const hasSelected = ch.querySelector(
          '.text-block.selected,.asset-block.selected,.shape-block.selected,' +
          '.gap-block.selected,.icon-circle-block.selected,.table-block.selected,' +
          '.label-group-block.selected,.card-block.selected,.graph-block.selected,' +
          '.divider-block.selected'
        );
        if (hasSelected) {
          multiPeers.push({
            el: ch,
            startLeft: parseInt(ch.style.left || '0'),
            startTop:  parseInt(ch.style.top  || '0'),
          });
        }
      });
    }

    // 드래그아웃 감지용 — freeLayout 프레임 밖으로 이동 시 섹션 레벨로 추출
    const _dragOutParentFrame   = dragEl.closest('.frame-block[data-free-layout]');
    const _dragOutParentSection = dragEl.closest('.section-block');

    let moved = false;
    let draggedOutside = false;    // 프레임 밖 드래그 상태 플래그
    let _dropInsertBefore = null;  // 삽입 기준 element (null=끝에 추가)
    function onMove(ev) {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      moved = true;
      const scaler = document.getElementById('canvas-scaler');
      const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1) : 1;

      const rawLeft = Math.round(startLeft + dx / scale);
      const rawTop  = Math.round(startTop  + dy / scale);

      // 드래그아웃 감지 (단일 선택 + 다중선택 없을 때만)
      // 커서 화면 좌표 대신 요소 중심의 캔버스 좌표로 판단 — scale 오탐 방지
      if (_dragOutParentFrame && _dragOutParentSection && multiPeers.length === 0) {
        const DRAGOUT_MARGIN = 60; // 캔버스 px — 의도치 않은 drag-out 방지
        const elCX = rawLeft + dragEl.offsetWidth  / 2;
        const elCY = rawTop  + dragEl.offsetHeight / 2;
        const fw   = _dragOutParentFrame.offsetWidth;
        const fh   = _dragOutParentFrame.offsetHeight;
        const outside = elCX < -DRAGOUT_MARGIN || elCX > fw + DRAGOUT_MARGIN ||
                        elCY < -DRAGOUT_MARGIN || elCY > fh + DRAGOUT_MARGIN;
        if (outside) {
          draggedOutside = true;
          hideGuides();
          // 삽입 기준 element를 closure 변수에 저장 (indicator 消失에 무관하게 유지)
          const inner = _dragOutParentSection.querySelector('.section-inner');
          _dropInsertBefore = getDragAfterElement(inner, ev.clientY) || null;
          // 섹션 inner에 드롭 인디케이터 표시
          clearDropIndicators();
          const indicator = document.createElement('div');
          indicator.className = 'drop-indicator';
          if (_dropInsertBefore) inner.insertBefore(indicator, _dropInsertBefore);
          else inner.appendChild(indicator);
          return;
        } else if (draggedOutside) {
          draggedOutside = false;
          _dropInsertBefore = null;
          clearDropIndicators();
        }
      }

      // 스마트 가이드 스냅 (단일 선택일 때만 — 다중선택 시 스냅 생략)
      const parentFrame = dragEl.closest('.frame-block[data-free-layout]');
      let newLeft = rawLeft, newTop = rawTop;
      if (parentFrame && multiPeers.length === 0) {
        const snapped = snapPosition(rawLeft, rawTop, dragEl, parentFrame, scale);
        newLeft = snapped.left;
        newTop  = snapped.top;
      }

      dragEl.style.left = `${newLeft}px`;
      dragEl.style.top  = `${newTop}px`;

      if (parentFrame && multiPeers.length === 0) showGuides(dragEl, parentFrame, scale);
      dragEl.dataset.offsetX = String(newLeft);
      dragEl.dataset.offsetY = String(newTop);

      // 다중선택 피어 동시 이동
      const scaledDx = Math.round(dx / scale);
      const scaledDy = Math.round(dy / scale);
      multiPeers.forEach(peer => {
        const pLeft = peer.startLeft + scaledDx;
        const pTop  = peer.startTop  + scaledDy;
        peer.el.style.left = `${pLeft}px`;
        peer.el.style.top  = `${pTop}px`;
        peer.el.dataset.offsetX = String(pLeft);
        peer.el.dataset.offsetY = String(pTop);
      });

      window.scheduleAutoSave?.();
      // prop 패널 X/Y 실시간 갱신 (패널이 열려있을 때)
      const xNum = document.getElementById('txt-x-number') || document.getElementById('lg-x-number');
      const yNum = document.getElementById('txt-y-number') || document.getElementById('lg-y-number');
      if (xNum) xNum.value = newLeft;
      if (yNum) yNum.value = newTop;
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('dragend', onUp);
      hideGuides();

      // 드래그아웃: freeLayout 프레임 밖에서 마우스업 → 섹션 레벨로 추출
      if (moved && draggedOutside && _dragOutParentFrame && _dragOutParentSection) {
        window.pushHistory?.();
        const inner = _dragOutParentSection.querySelector('.section-inner');
        clearDropIndicators();

        // 절대 위치 스타일 초기화
        dragEl.style.position = '';
        dragEl.style.left = '';
        dragEl.style.top = '';
        delete dragEl.dataset.offsetX;
        delete dragEl.dataset.offsetY;

        // _dropInsertBefore: onMove에서 저장한 삽입 기준 element (null=끝에 추가)
        const ref = _dropInsertBefore && _dropInsertBefore.parentNode === inner
          ? _dropInsertBefore : null;
        if (ref) inner.insertBefore(dragEl, ref);
        else inner.appendChild(dragEl);

        // flow 요소로 재바인딩
        dragEl._dragBound = false;
        const _tb = dragEl.querySelector('.text-block');
        if (_tb) { _tb._blockBound = false; bindBlock(_tb); }

        window.buildLayerPanel?.();
        return;
      }

      if (moved) {
        _resizeFrameToFitChildren(dragEl);
        multiPeers.forEach(p => _resizeFrameToFitChildren(p.el));
        window.pushHistory?.();
      }
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('dragend', onUp);
  });

  if (isShape) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      const sec = block.closest('.section-block');
      const ss = block.closest('.frame-block');
      const layerItem = ss?._layerItem || block._layerItem;
      if (e.metaKey || e.ctrlKey) { window.toggleBlockSelect?.(block, sec); return; }
      if (e.shiftKey) { window.rangeSelectBlocks?.(block, sec); return; }
      // shape-block은 프레임 선택 단계를 건너뛰고 직접 선택 (핸들 즉시 표시)
      window.deselectAll?.();
      if (ss) {
        const parentSec = ss.closest('.section-block');
        if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
        ss.classList.add('selected');
        window._activeFrame = ss;
      }
      block.classList.add('selected');
      window.syncSection?.(sec);
      window.highlightBlock?.(block, layerItem);
      window.setBlockAnchor?.(block);
      window.showShapeProperties?.(block);
    });

    // 4코너 리사이즈 핸들 생성 (중복 방지)
    if (!block.querySelector('.shape-handle')) {
      ['nw', 'ne', 'sw', 'se'].forEach(dir => {
        const h = document.createElement('div');
        h.className = `shape-handle ${dir}`;
        h.dataset.dir = dir;
        block.appendChild(h);
      });
    }

    // 핸들 mousedown → 리사이즈
    block.querySelectorAll('.shape-handle').forEach(handle => {
      handle.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        const dir    = handle.dataset.dir;
        const startX = e.clientX;
        const startY = e.clientY;
        const ss  = block.closest('.frame-block');
        const ssRect = ss?.getBoundingClientRect();
        const scaler0 = document.getElementById('canvas-scaler');
        const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1) : 1;
        const startW = ssRect ? Math.round(ssRect.width / scale0) : (parseInt(ss?.style.width || ss?.dataset.width) || 100);
        const startH = ssRect ? Math.round(ssRect.height / scale0) : (parseInt(ss?.style.height || ss?.dataset.height) || 100);

        function onMove(ev) {
          const scaler = document.getElementById('canvas-scaler');
          const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1) : 1;
          const dx = (ev.clientX - startX) / scale;
          const dy = (ev.clientY - startY) / scale;

          // frame(ss)만 리사이즈 — block/svg는 CSS 100%로 자동 추종
          let newW = startW, newH = startH;
          if (dir.includes('e')) newW = Math.max(20, startW + dx);
          if (dir.includes('w')) newW = Math.max(20, startW - dx);
          if (dir.includes('s')) newH = Math.max(20, startH + dy);
          if (dir.includes('n')) newH = Math.max(20, startH - dy);
          newW = Math.round(newW); newH = Math.round(newH);

          // Shift: 비율 고정 (더 많이 변한 축이 기준)
          if (ev.shiftKey && startW > 0 && startH > 0) {
            const ratio = startW / startH;
            const dW = Math.abs(newW - startW);
            const dH = Math.abs(newH - startH);
            if (dW >= dH) newH = Math.max(20, Math.round(newW / ratio));
            else          newW = Math.max(20, Math.round(newH * ratio));
          }

          if (ss) {
            ss.style.width  = `${newW}px`; ss.dataset.width  = String(newW);
            ss.style.height = `${newH}px`; ss.dataset.height = String(newH);
          }
          // 우측 패널 슬라이더 동기화
          const wNum = document.getElementById('shape-w-num');
          const wSl  = document.getElementById('shape-w-slider');
          const hNum = document.getElementById('shape-h-num');
          const hSl  = document.getElementById('shape-h-slider');
          if (wNum) { wNum.value = newW; if (wSl) wSl.value = newW; }
          if (hNum) { hNum.value = newH; if (hSl) hSl.value = newH; }
          window.scheduleAutoSave?.();
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          window.pushHistory?.();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });

    // HTML5 drag fall-through → 일반 블록과 동일한 DnD 파이프라인 사용
  }

  if (isJoker) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      window.deselectAll();
      _restoreParentFrameSelected(block);
      block.classList.add('selected');
      window.syncSection(block.closest('.section-block'));
      window.highlightBlock(block, block._layerItem);
      window.showJokerProperties?.(block);
    });

    // 서브섹션 내 absolute 조커: 드래그로 left/top 조절
    block.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (block.style.position !== 'absolute') return;
      e.stopPropagation();
      // preventDefault 사용 금지 — click 이벤트가 억제됨
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = parseInt(block.style.left || '0');
      const startTop  = parseInt(block.style.top  || '0');
      let moved = false;

      function onMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        moved = true;
        // 캔버스 스케일 보정
        const scaler = document.getElementById('canvas-scaler');
        const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1) : 1;
        const newLeft = Math.round(startLeft + dx / scale);
        const newTop  = Math.round(startTop  + dy / scale);
        block.style.left = `${newLeft}px`;
        block.style.top  = `${newTop}px`;
        block.dataset.offsetX = String(newLeft);
        block.dataset.offsetY = String(newTop);
        window.scheduleAutoSave?.();
        // 프로퍼티 패널 실시간 업데이트
        const xNum = document.getElementById('joker-x-number');
        const yNum = document.getElementById('joker-y-number');
        const xSl  = document.getElementById('joker-x-slider');
        const ySl  = document.getElementById('joker-y-slider');
        if (xNum) xNum.value = newLeft;
        if (xSl)  xSl.value  = newLeft;
        if (yNum) yNum.value = newTop;
        if (ySl)  ySl.value  = newTop;
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('dragend', onUp);
        if (moved) { _resizeFrameToFitChildren(block); window.pushHistory?.(); }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('dragend', onUp);
    });

    return; // 편집 불가 — 이벤트 바인딩 여기서 종료
  }

  // ── 텍스트 편집 이벤트 바인딩 헬퍼 (최초 1회) ──
  function _bindTextEditEl(el, block) {
    if (el._editBound) return;
    el._editBound = true;
    // input → 타이핑 즉시 placeholder 해제
    el.addEventListener('input', () => {
      if (el.dataset.isPlaceholder === 'true' && el.textContent.trim() !== '') {
        delete el.dataset.isPlaceholder;
      }
    });
    // blur → 편집 종료 (외부 클릭, 포커스 이탈 시)
    el.addEventListener('blur', () => {
      block.classList.remove('editing');
      el.setAttribute('contenteditable', 'false');
      // 빈 텍스트면 placeholder 복원
      const ph = el.dataset.placeholder;
      if (ph && el.textContent.trim() === '') {
        el.innerHTML = ph;
        el.dataset.isPlaceholder = 'true';
      } else if (el.textContent.trim() !== '') {
        delete el.dataset.isPlaceholder;
      }
    });
    // Escape → 편집 종료, 블록 선택 상태 유지
    el.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation(); // 전역 window.deselectAll() 차단
        el.blur();            // blur 핸들러가 editing 정리
      }
    });
    // paste → 서식 제거, 순수 텍스트만 삽입 (목적지 블록 스타일 유지)
    el.addEventListener('paste', ev => {
      ev.preventDefault();
      const text = ev.clipboardData.getData('text/plain');
      if (!text) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      sel.deleteFromDocument();
      sel.getRangeAt(0).insertNode(document.createTextNode(text));
      sel.collapseToEnd();
    });
  }

  if (isText) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      // 편집 모드 중 클릭은 무시 (커서 이동/텍스트 선택 기본 동작 유지)
      if (block.classList.contains('editing')) return;
      const sec = block.closest('.section-block');
      if (e.metaKey || e.ctrlKey) { window.toggleBlockSelect?.(block, sec); return; }
      if (e.shiftKey) { window.rangeSelectBlocks?.(block, sec); return; }
      if (_isInsideUnselectedFrame(block)) {
        e.stopPropagation();
        const ss = _getParentFrame(block);
        window.deselectAll?.();
        const parentSec = ss.closest('.section-block');
        if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
        ss.classList.add('selected');
        window._activeFrame = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showFrameProperties?.(ss);
        return;
      }
      window.deselectAll();
      _restoreParentFrameSelected(block);
      block.classList.add('selected');
      window.syncSection(sec);
      window.highlightBlock(block, block._layerItem);
      window.setBlockAnchor?.(block);
      window.showTextProperties(block);
    });
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      window.pushHistory?.(); // 편집 시작 전 상태 저장 → Cmd+Z로 복원 가능
      block.classList.add('editing');
      const editEls = block.querySelectorAll('[contenteditable]');
      editEls.forEach(el => el.setAttribute('contenteditable', 'true'));

      // 클릭 위치에 해당하는 편집 요소 찾기 (보통 1개)
      const clicked = [...editEls].find(el => el.contains(document.elementFromPoint(e.clientX, e.clientY))) || editEls[0];
      if (clicked) {
        clicked.focus();
        // placeholder 상태면 전체 선택 (즉시 타이핑으로 교체 가능)
        if (clicked.dataset.isPlaceholder === 'true') {
          const range = document.createRange();
          range.selectNodeContents(clicked);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          // 클릭 위치에 정확히 커서 지정
          const range = document.caretRangeFromPoint(e.clientX, e.clientY);
          if (range) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
        _bindTextEditEl(clicked, block);
      }
    });

    // ── Enter 키로 편집 모드 진입 (선택 상태에서) ──
    block._enterTextEditMode = function() {
      if (block.classList.contains('editing')) return;
      window.pushHistory?.();
      block.classList.add('editing');
      const editEls = block.querySelectorAll('[contenteditable]');
      editEls.forEach(el => el.setAttribute('contenteditable', 'true'));
      const target = editEls[0];
      if (!target) return;
      _bindTextEditEl(target, block);
      target.focus();
      // 커서를 끝으로 이동
      const range = document.createRange();
      range.selectNodeContents(target);
      if (target.dataset.isPlaceholder === 'true') {
        // placeholder면 전체 선택 (다음 타이핑으로 즉시 교체)
      } else {
        range.collapse(false);
      }
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    };

  }

  if (isAsset) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      const sec = block.closest('.section-block');
      if (e.metaKey || e.ctrlKey) { window.toggleBlockSelect?.(block, sec); return; }
      if (e.shiftKey) { window.rangeSelectBlocks?.(block, sec); return; }
      if (_isInsideUnselectedFrame(block)) {
        e.stopPropagation();
        const ss = _getParentFrame(block);
        window.deselectAll?.();
        const parentSec = ss.closest('.section-block');
        if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
        ss.classList.add('selected');
        window._activeFrame = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showFrameProperties?.(ss);
        return;
      }
      window.deselectAll();
      _restoreParentFrameSelected(block);
      block.classList.add('selected');
      window.syncSection(sec);
      window.highlightBlock(block, block._layerItem);
      window.setBlockAnchor?.(block);
      window.showAssetProperties(block);
    });
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      if (block.classList.contains('has-image')) {
        window.enterImageEditMode(block);
      } else {
        window.triggerAssetUpload(block);
      }
    });

    // ── 4코너 리사이즈 핸들 (선택 시 표시) ──
    if (!block.querySelector('.asset-handle')) {
      ['nw', 'ne', 'sw', 'se'].forEach(dir => {
        const h = document.createElement('div');
        h.className = `asset-handle ${dir}`;
        h.dataset.dir = dir;
        block.appendChild(h);
      });
    }
    block.querySelectorAll('.asset-handle').forEach(handle => {
      handle.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        const dir = handle.dataset.dir;
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = block.getBoundingClientRect();
        const scaler0 = document.getElementById('canvas-scaler');
        const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1) : 1;
        const startW = Math.round(rect.width / scale0);
        const startH = Math.round(rect.height / scale0);

        function onMove(ev) {
          const scaler = document.getElementById('canvas-scaler');
          const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1) : 1;
          const dx = (ev.clientX - startX) / scale;
          const dy = (ev.clientY - startY) / scale;
          let newW = startW, newH = startH;
          if (dir.includes('e')) newW = Math.min(860, Math.max(100, startW + dx));
          if (dir.includes('w')) newW = Math.min(860, Math.max(100, startW - dx));
          if (dir.includes('s')) newH = Math.max(40, startH + dy);
          if (dir.includes('n')) newH = Math.max(40, startH - dy);
          newW = Math.round(newW); newH = Math.round(newH);
          block.style.width  = newW >= 860 ? '' : newW + 'px';
          block.style.height = newH + 'px';
          // 우측 패널 슬라이더 동기화
          const wNum = document.getElementById('asset-w-number');
          const wSl  = document.getElementById('asset-w-slider');
          const hNum = document.getElementById('asset-h-number');
          const hSl  = document.getElementById('asset-h-slider');
          if (wNum) { wNum.value = newW; if (wSl) wSl.value = newW; }
          if (hNum) { hNum.value = newH; if (hSl) hSl.value = newH; }
          window.scheduleAutoSave?.();
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          window.pushHistory?.();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });

    // 파일 드래그 드롭
    block.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      block.classList.add('drag-over');
    });
    block.addEventListener('dragleave', e => {
      if (!block.contains(e.relatedTarget)) block.classList.remove('drag-over');
    });
    block.addEventListener('drop', e => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      block.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) window.loadImageToAsset(block, file);
    });
    // 로드/undo 후 has-image 상태 복원
    if (block.classList.contains('has-image')) {
      const overlayBtn = block.querySelector('.asset-overlay-clear');
      if (overlayBtn) overlayBtn.addEventListener('click', e => {
        e.stopPropagation();
        window.clearAssetImage(block);
      });
      // 수동 편집된 위치/크기 복원 (imgW가 있으면 절대 위치 모드)
      window.applyImageTransform(block);
      // 수동 편집 없으면 object-fit 적용
      if (!block.dataset.imgW) {
        const img = block.querySelector('.asset-img');
        if (img) img.style.objectFit = block.dataset.fit || 'cover';
      }
    }
  }

  if (isGap) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      const sec = block.closest('.section-block');
      if (e.metaKey || e.ctrlKey) { window.toggleBlockSelect?.(block, sec); return; }
      if (e.shiftKey) { window.rangeSelectBlocks?.(block, sec); return; }
      if (_isInsideUnselectedFrame(block)) {
        e.stopPropagation();
        const ss = _getParentFrame(block);
        window.deselectAll?.();
        const parentSec = ss.closest('.section-block');
        if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
        ss.classList.add('selected');
        window._activeFrame = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showFrameProperties?.(ss);
        return;
      }
      window.deselectAll();
      _restoreParentFrameSelected(block);
      block.classList.add('selected');
      window.syncSection(sec);
      window.highlightBlock(block, block._layerItem);
      window.setBlockAnchor?.(block);
      window.showGapProperties(block);
    });
  }

  if (isIconCb) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      const sec = block.closest('.section-block');
      if (e.metaKey || e.ctrlKey) { window.toggleBlockSelect?.(block, sec); return; }
      if (e.shiftKey) { window.rangeSelectBlocks?.(block, sec); return; }
      if (_isInsideUnselectedFrame(block)) {
        e.stopPropagation();
        const ss = _getParentFrame(block);
        window.deselectAll?.();
        const parentSec = ss.closest('.section-block');
        if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
        ss.classList.add('selected');
        window._activeFrame = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showFrameProperties?.(ss);
        return;
      }
      window.deselectAll();
      _restoreParentFrameSelected(block);
      block.classList.add('selected');
      window.syncSection(sec);
      window.highlightBlock(block, block._layerItem);
      window.setBlockAnchor?.(block);
      window.showIconCircleProperties(block);
    });
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      if (block.classList.contains('has-image')) {
        window.enterCircleImageEditMode(block);
      } else {
        window.triggerCircleUpload(block);
      }
    });
    block.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault(); e.stopPropagation();
      block.classList.add('drag-over');
    });
    block.addEventListener('dragleave', e => {
      if (!block.contains(e.relatedTarget)) block.classList.remove('drag-over');
    });
    block.addEventListener('drop', e => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault(); e.stopPropagation();
      block.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) window.loadImageToCircle(block, file);
    });
    // 로드/undo 후 has-image 복원
    if (block.classList.contains('has-image')) {
      const clearBtn = block.querySelector('.icb-clear-btn');
      if (clearBtn) clearBtn.addEventListener('click', e => { e.stopPropagation(); window.clearCircleImage(block); });
    }
  }

  if (isTableB) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      const sec = block.closest('.section-block');
      if (e.metaKey || e.ctrlKey) { window.toggleBlockSelect?.(block, sec); return; }
      if (e.shiftKey) { window.rangeSelectBlocks?.(block, sec); return; }
      if (_isInsideUnselectedFrame(block)) {
        e.stopPropagation();
        const ss = _getParentFrame(block);
        window.deselectAll?.();
        const parentSec = ss.closest('.section-block');
        if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
        ss.classList.add('selected');
        window._activeFrame = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showFrameProperties?.(ss);
        return;
      }
      window.deselectAll();
      _restoreParentFrameSelected(block);
      block.classList.add('selected');
      window.syncSection(sec);
      window.highlightBlock(block, block._layerItem);
      window.setBlockAnchor?.(block);
      window.showTableProperties(block);
    });
    // 셀 더블클릭 → contenteditable 활성화
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      const cell = e.target.closest('th, td');
      if (cell && block.classList.contains('selected')) {
        block.querySelectorAll('[contenteditable="true"]').forEach(el => {
          if (el !== cell) el.setAttribute('contenteditable','false');
        });
        // 편집 시작 전 히스토리 스냅샷 저장 (undo 복원 기준점)
        window.pushHistory('셀 편집');
        cell.setAttribute('contenteditable','true');
        cell.focus();
        // 커서를 끝으로 이동
        const range = document.createRange();
        range.selectNodeContents(cell);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        // blur 시 편집 종료 + 변경 내용 히스토리 저장 (최초 1회만 등록)
        if (!cell._editBound) {
          cell._editBound = true;
          cell.addEventListener('blur', () => {
            cell.setAttribute('contenteditable', 'false');
            window.pushHistory('셀 텍스트 변경');
          });
          cell.addEventListener('keydown', ev => {
            if (ev.key === 'Escape') {
              ev.preventDefault();
              ev.stopPropagation();
              cell.blur();
            }
          });
        }
      }
    });
  }

  if (isLabelGroup) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      if (_isInsideUnselectedFrame(block)) {
        const ss = _getParentFrame(block);
        window.deselectAll?.();
        const parentSec = ss.closest('.section-block');
        if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
        ss.classList.add('selected');
        window._activeFrame = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showFrameProperties?.(ss);
        return;
      }
      // + 버튼: 새 라벨 추가
      if (e.target.classList.contains('label-group-add-btn')) {
        window.pushHistory();
        const items  = block.querySelectorAll('.label-item');
        const first  = items[0];
        const lastBg     = first?.dataset.bg     || '#e8e8e8';
        const lastColor  = first?.dataset.color  || '#333333';
        const lastRadius = parseInt(first?.dataset.radius) || 40;
        const newItem = makeLabelItem('Tag', lastBg, lastColor, lastRadius);
        block.querySelector('.label-group-add-btn').before(newItem);
        block.querySelectorAll('.label-item').forEach(i => i.classList.remove('item-selected'));
        newItem.classList.add('item-selected');
        window.showLabelGroupProperties(block, newItem);
        return;
      }
      // × 버튼: 라벨 삭제
      if (e.target.classList.contains('label-item-delete-btn')) {
        const items = block.querySelectorAll('.label-item');
        if (items.length <= 1) { showToast('⚠️ 마지막 라벨은 삭제할 수 없어요.'); return; }
        window.pushHistory();
        e.target.closest('.label-item').remove();
        window.showLabelGroupProperties(block, null);
        return;
      }
      // 라벨 아이템 클릭: 아이템 선택
      const item = e.target.closest('.label-item');
      if (item) {
        if (!block.classList.contains('selected')) {
          window.deselectAll();
          _restoreParentFrameSelected(block);
          block.classList.add('selected');
          window.syncSection(block.closest('.section-block'));
          window.highlightBlock(block, block._layerItem);
        }
        block.querySelectorAll('.label-item').forEach(i => i.classList.remove('item-selected'));
        item.classList.add('item-selected');
        window.showLabelGroupProperties(block, item);
        return;
      }
      // 블록 배경 클릭: 블록만 선택
      const sec = block.closest('.section-block');
      if (e.metaKey || e.ctrlKey) { window.toggleBlockSelect?.(block, sec); return; }
      if (e.shiftKey) { window.rangeSelectBlocks?.(block, sec); return; }
      window.deselectAll();
      _restoreParentFrameSelected(block);
      block.classList.add('selected');
      window.syncSection(sec);
      window.highlightBlock(block, block._layerItem);
      window.setBlockAnchor?.(block);
      window.showLabelGroupProperties(block, null);
    });
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      const item = e.target.closest('.label-item');
      if (!item) return;
      const span = item.querySelector('.label-item-text');
      if (!span) return;
      window.pushHistory?.();
      span.contentEditable = 'true';
      span.focus();
      const range = document.createRange();
      range.selectNodeContents(span);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      block.classList.add('editing');
      span.addEventListener('blur', () => {
        span.contentEditable = 'false';
        block.classList.remove('editing');
      }, { once: true });
      span.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') { ev.preventDefault(); span.blur(); }
        if (ev.key === 'Escape') { span.blur(); }
      }, { once: true });
    });
  }

  if (isCard) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      const sec = block.closest('.section-block');
      if (e.metaKey || e.ctrlKey) { window.toggleBlockSelect?.(block, sec); return; }
      if (e.shiftKey) { window.rangeSelectBlocks?.(block, sec); return; }
      if (_isInsideUnselectedFrame(block)) {
        e.stopPropagation();
        const ss = _getParentFrame(block);
        window.deselectAll?.();
        const parentSec = ss.closest('.section-block');
        if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
        ss.classList.add('selected');
        window._activeFrame = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showFrameProperties?.(ss);
        return;
      }
      const rowEl = block.closest('.row');
      const isRowActive = rowEl && rowEl.classList.contains('row-active');
      window.deselectAll();
      _restoreParentFrameSelected(block);
      if (rowEl && !isRowActive) {
        // 첫 번째 클릭: Row 전체 선택 → Row Properties 표시
        rowEl.classList.add('row-active');
        window.showRowProperties(rowEl);
        return;
      }
      // 두 번째 클릭 (또는 단독 카드): 카드 선택 → Card Properties 표시
      block.classList.add('selected');
      window.syncSection(sec);
      window.highlightBlock(block, block._layerItem);
      window.setBlockAnchor?.(block);
      window.showCardProperties(block);
    });
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      // 이미지 영역 더블클릭 → 이미지 업로드
      if (e.target.closest('.cdb-image')) {
        window.triggerCardImageUpload(block);
        return;
      }
      // 텍스트 영역 더블클릭 → contenteditable 활성화
      const textEl = e.target.closest('.cdb-title, .cdb-desc');
      if (textEl) {
        window.pushHistory?.();
        textEl.contentEditable = 'true';
        textEl.focus();
        block.classList.add('editing');
        textEl.addEventListener('blur', () => {
          textEl.contentEditable = 'false';
          block.classList.remove('editing');
        }, { once: true });
        textEl.addEventListener('keydown', ev => {
          if (ev.key === 'Escape') { textEl.blur(); }
        }, { once: true });
      }
    });
    block.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault(); e.stopPropagation();
      block.classList.add('drag-over');
    });
    block.addEventListener('dragleave', e => {
      if (!block.contains(e.relatedTarget)) block.classList.remove('drag-over');
    });
    block.addEventListener('drop', e => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault(); e.stopPropagation();
      block.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) window.loadImageToCard(block, file);
    });
    // 로드/undo 후 has-image 복원
    if (block.classList.contains('has-image')) {
      const clearBtn = block.querySelector('.cdb-clear-btn');
      if (clearBtn) clearBtn.addEventListener('click', e => { e.stopPropagation(); window.clearCardImage(block); });
    }
  }

  if (isGraph) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      const sec = block.closest('.section-block');
      if (e.metaKey || e.ctrlKey) { window.toggleBlockSelect?.(block, sec); return; }
      if (e.shiftKey) { window.rangeSelectBlocks?.(block, sec); return; }
      if (_isInsideUnselectedFrame(block)) {
        e.stopPropagation();
        const ss = _getParentFrame(block);
        window.deselectAll?.();
        const parentSec = ss.closest('.section-block');
        if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
        ss.classList.add('selected');
        window._activeFrame = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showFrameProperties?.(ss);
        return;
      }
      window.deselectAll();
      _restoreParentFrameSelected(block);
      block.classList.add('selected');
      window.syncSection(sec);
      window.highlightBlock(block, block._layerItem);
      window.setBlockAnchor?.(block);
      window.showGraphProperties(block);
    });
  }

  const isIconText = block.classList.contains('icon-text-block');
  if (isIconText) {
    block.querySelectorAll('.asset-overlay, .asset-overlay-clear').forEach(el => el.remove());
    block.addEventListener('click', e => {
      e.stopPropagation();
      if (block.classList.contains('editing')) return;
      const sec = block.closest('.section-block');
      if (e.metaKey || e.ctrlKey) { window.toggleBlockSelect?.(block, sec); return; }
      if (e.shiftKey) { window.rangeSelectBlocks?.(block, sec); return; }
      if (_isInsideUnselectedFrame(block)) {
        e.stopPropagation();
        const ss = _getParentFrame(block);
        window.deselectAll?.();
        const parentSec = ss.closest('.section-block');
        if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
        ss.classList.add('selected');
        window._activeFrame = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showFrameProperties?.(ss);
        return;
      }
      window.deselectAll();
      _restoreParentFrameSelected(block);
      block.classList.add('selected');
      window.syncSection(sec);
      window.highlightBlock(block, block._layerItem);
      window.setBlockAnchor?.(block);
      window.showTextProperties(block);
    });
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      const bodyEl = block.querySelector('.itb-text');
      if (!bodyEl) return;
      window.pushHistory?.();
      block.classList.add('editing');
      bodyEl.setAttribute('contenteditable', 'true');
      bodyEl.focus();
      const range = document.createRange();
      range.selectNodeContents(bodyEl);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    const onItbBlur = e => {
      const bodyEl = block.querySelector('.itb-text');
      if (bodyEl && !block.contains(e.relatedTarget)) {
        block.classList.remove('editing');
        bodyEl.setAttribute('contenteditable', 'false');
        window.triggerAutoSave?.();
      }
    };
    block.addEventListener('focusout', onItbBlur);
    block.querySelectorAll('[contenteditable], .itb-text, .itb-icon').forEach(el => el.setAttribute('draggable', 'false'));

    // itb-icon 클릭 → 이미지 업로드
    block.querySelector('.itb-icon')?.addEventListener('click', e => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          window.pushHistory?.();
          const iconEl = block.querySelector('.itb-icon');
          let img = iconEl.querySelector('img');
          if (!img) { img = document.createElement('img'); iconEl.appendChild(img); }
          img.src = ev.target.result;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;';
          block.dataset.imgSrc = ev.target.result;
          iconEl.style.border = 'none';
          window.triggerAutoSave?.();
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }

  if (isDivider) {
    applyDividerStyle(block);
    block.addEventListener('click', e => {
      e.stopPropagation();
      const sec = block.closest('.section-block');
      if (e.metaKey || e.ctrlKey) { window.toggleBlockSelect?.(block, sec); return; }
      if (e.shiftKey) { window.rangeSelectBlocks?.(block, sec); return; }
      if (_isInsideUnselectedFrame(block)) {
        e.stopPropagation();
        const ss = _getParentFrame(block);
        window.deselectAll?.();
        const parentSec = ss.closest('.section-block');
        if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
        ss.classList.add('selected');
        window._activeFrame = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showFrameProperties?.(ss);
        return;
      }
      window.deselectAll();
      _restoreParentFrameSelected(block);
      block.classList.add('selected');
      window.syncSection(sec);
      window.highlightBlock(block, block._layerItem);
      window.setBlockAnchor?.(block);
      window.showDividerProperties(block);
    });
  }

  // hover ↔ layer item (frame-aware)
  block.addEventListener('mouseenter', () => {
    const ss = _getParentFrame(block);
    if (ss && _isInsideUnselectedFrame(block)) {
      if (ss._layerItem) ss._layerItem.style.background = 'var(--ui-bg-card)';
      return;
    }
    if (block._layerItem) block._layerItem.style.background = 'var(--ui-bg-card)';
  });
  block.addEventListener('mouseleave', e => {
    const ss = _getParentFrame(block);
    if (ss && _isInsideUnselectedFrame(block)) {
      if (!ss.contains(e.relatedTarget)) {
        if (ss._layerItem && !ss._layerItem.classList.contains('active'))
          ss._layerItem.style.background = '';
      }
      return;
    }
    if (block._layerItem && !block._layerItem.classList.contains('active'))
      block._layerItem.style.background = '';
  });

  // 드래그 이벤트 (overlay-tb는 마우스 드래그 사용, HTML5 drag 제외)
  if (block.classList.contains('overlay-tb')) return;
  const dragTarget = isGap ? block : (block.closest('.frame-block[data-text-frame]') || block.closest('.row') || block);
  if (dragTarget && !dragTarget._dragBound) {
    dragTarget._dragBound = true;
    // absolute 위치 요소는 HTML5 drag 완전 비활성화 — 커스텀 mousemove drag만 사용
    // (draggable 속성 자체를 제거 → dragstart 이벤트 미발생 → opacity 깜빡임 없음)
    // 적용 대상: absolute text-frame, absolute shape-block, absolute block 전반
    // 기존 저장된 HTML에 draggable="true"가 남아있을 수 있으므로 명시적 removeAttribute 처리
    const needsHtml5Drag = dragTarget.style.position !== 'absolute' && block.style.position !== 'absolute';
    if (needsHtml5Drag) {
      dragTarget.setAttribute('draggable', 'true');
    } else {
      dragTarget.removeAttribute('draggable');
    }
    if (isText) block.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('draggable', 'false'));

    dragTarget.addEventListener('dragstart', e => {
      if (block.style.position === 'absolute' || dragTarget.style.position === 'absolute') { e.preventDefault(); return; } // absolute 블록은 커스텀 mousemove drag 사용 (flow→absolute 전환 후 예외 처리)
      if (document.activeElement?.contentEditable === 'true') { e.preventDefault(); return; }
      if (block.classList.contains('editing')) { e.preventDefault(); return; }
      _suppressDragSave();
      dragSrc = dragTarget;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
      // ghost 이미지 투명 처리 (zoom 왜곡 방지)
      const ghost = document.createElement('div');
      ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => ghost.remove(), 0);
      requestAnimationFrame(() => dragTarget.classList.add('dragging'));
    });
    dragTarget.addEventListener('dragend', () => {
      _resumeDragSave();
      dragTarget.classList.remove('dragging');
      clearDropIndicators();
      dragSrc = null;
    });
  }
}

function bindFrameDropZone(ss) {
  if (ss._subSecBound) return;
  ss._subSecBound = true;

  // text-frame은 bindFrameDropZone 불필요 — 단순 wrapper이므로 click/drop 핸들러 불필요
  if (ss.dataset.textFrame === 'true') return;

  // shape frame은 drop 수신 불가 — shape-block 전용 컨테이너
  const isShapeFrame = !!ss.querySelector('.shape-block');

  const inner = ss;  // frame-inner 제거 — frame-block 자체가 content container
  let _rafId = null;

  // ── absolute 셀 프레임 mousemove 드래그 (position:absolute인 경우) ──
  if (ss.style.position === 'absolute') {
    ss.setAttribute('draggable', 'false');
    ss.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('.resize-handle, [contenteditable]')) return;
      e.preventDefault();
      e.stopPropagation();

      const parent = ss.parentElement; // parent frame-block (NewGrid)
      const parentRect = parent.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const origLeft = parseFloat(ss.style.left) || 0;
      const origTop  = parseFloat(ss.style.top)  || 0;
      let moved = false;

      // 클릭 시 셀 선택
      window.deselectAll?.();
      const parentSec = ss.closest('.section-block');
      if (parentSec) { parentSec.classList.add('selected'); }
      ss.classList.add('selected');
      window._activeFrame = ss;
      window.showFrameProperties?.(ss);

      const onMove = ev => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        moved = true;
        const newLeft = Math.round(origLeft + dx);
        const newTop  = Math.round(origTop  + dy);
        ss.style.left = newLeft + 'px';
        ss.style.top  = newTop  + 'px';
        ss.dataset.offsetX = String(newLeft);
        ss.dataset.offsetY = String(newTop);
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (moved) { window.pushHistory?.(); window.triggerAutoSave?.(); }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    return; // absolute 셀은 drop zone 바인딩 불필요
  }

  // 프레임 자체 드래그 — 프레임이 selected 상태에서 드래그 시 section-inner 내 순서 변경
  ss.setAttribute('draggable', 'true');
  ss.addEventListener('dragstart', e => {
    // 선택된 프레임이 아니면 드래그 취소
    if (!ss.classList.contains('selected')) { e.preventDefault(); return; }
    // 내부 자식 블록이 selected면 자식 drag 우선 (자식 drag는 mousedown 기반이므로 여기선 프레임 drag로 처리)
    e.stopPropagation();
    _suppressDragSave();
    dragSrc = ss;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
    requestAnimationFrame(() => ss.classList.add('dragging'));
  });
  ss.addEventListener('dragend', () => {
    _resumeDragSave();
    ss.classList.remove('dragging');
    clearDropIndicators();
    if (dragSrc === ss) dragSrc = null;
    window.buildLayerPanel();
    window.triggerAutoSave?.();
  });

  // 클릭: 서브섹션 선택 + 블록 삽입 타겟으로 설정
  ss.addEventListener('click', e => {
    // 내부 블록 클릭은 bindBlock 핸들러가 e.stopPropagation으로 처리 — 여기까지 버블되면 빈 영역 클릭
    // 단, 혹시 버블된 경우에도 실제 블록 요소면 제외
    if (e.target.closest('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .joker-block, .shape-block')) return;
    // ss 또는 frame-inner 빈 공간 클릭만 처리
    if (!e.target.closest('.frame-block')) return;
    e.stopPropagation();
    // deselectAll 직접 호출 (selectSection은 showSectionProperties 부작용 있음)
    window.deselectAll?.();
    const parentSec = ss.closest('.section-block');
    if (parentSec) {
      parentSec.classList.add('selected');
      window.syncLayerActive?.(parentSec);
    }
    ss.classList.add('selected');
    window._activeFrame = ss;
    window.highlightBlock?.(ss, ss._layerItem);
    window.showFrameProperties?.(ss);
    if (!isShapeFrame) showFrameHandles(ss);
  });

  // 드래그오버 — 내부 블록 재배치 (shape frame은 drop 불가)
  inner.addEventListener('dragover', e => {
    if (!dragSrc) return;
    if (isShapeFrame) return; // shape frame은 외부 블록 수신 차단
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (_rafId) return;
    const clientY = e.clientY;
    _rafId = requestAnimationFrame(() => {
      _rafId = null;
      if (!dragSrc) return;
      clearDropIndicators();
      ss.classList.add('ss-drag-over');
      const after = getDragAfterElement(inner, clientY);
      const indicator = document.createElement('div');
      indicator.className = 'drop-indicator';
      if (after) inner.insertBefore(indicator, after);
      else inner.appendChild(indicator);
    });
  });

  inner.addEventListener('dragleave', e => {
    if (!inner.contains(e.relatedTarget)) {
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
      ss.classList.remove('ss-drag-over');
      clearDropIndicators();
    }
  });

  inner.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    ss.classList.remove('ss-drag-over');
    if (!dragSrc) return;
    if (isShapeFrame) return; // shape frame drop 차단
    window.pushHistory();

    const isFullWidth = ss.dataset.fullWidth === 'true';
    const BLOCK_SEL = '.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .joker-block, .shape-block';
    const SS_W = 860; // 캔버스 기준 너비

    if (isFullWidth) {
      // ── fullWidth 프레임: row/블록을 flow 레이아웃 그대로 유지 (absolute 변환 금지) ──
      const indicator = inner.querySelector('.drop-indicator');
      if (dragSrc.classList.contains('row')) {
        // row 통째로 재배치
        if (indicator) inner.insertBefore(dragSrc, indicator);
        else inner.appendChild(dragSrc);
      } else if (dragSrc.matches?.(BLOCK_SEL)) {
        // 단일 블록: row로 감싸서 삽입
        const existingRow = dragSrc.closest('.row');
        if (existingRow && existingRow.parentElement === inner) {
          // 이미 inner 안의 row → row째로 재배치
          if (indicator) inner.insertBefore(existingRow, indicator);
          else inner.appendChild(existingRow);
        } else {
          if (indicator) inner.insertBefore(dragSrc, indicator);
          else inner.appendChild(dragSrc);
        }
      }
    } else {
      // ── 고정 크기 프레임(shape frame 아닌 것): 기존 absolute 방식 ──
      // 블록을 absolute로 전환하는 헬퍼
      const makeAbsolute = (block, left, top) => {
        const w = block.offsetWidth || Math.round(SS_W * 0.5);
        block.style.position = 'absolute';
        block.style.left = left + 'px';
        block.style.top  = top  + 'px';
        if (!block.style.width || block.style.width === '100%') {
          block.style.width = Math.min(w, SS_W) + 'px';
        }
        block.setAttribute('draggable', 'false');
      };

      // row 또는 text-frame이 드롭된 경우
      if (dragSrc.classList.contains('row') || (dragSrc.classList.contains('frame-block') && dragSrc.dataset.textFrame === 'true')) {
        if (dragSrc.dataset.textFrame === 'true') {
          // text-frame: wrapper를 유지하고 text-frame 자체를 absolute로 전환
          // (text-block을 꺼내면 orphan이 되므로 금지)
          const existingAbsEls = [...inner.children].filter(b => b.style.position === 'absolute');
          const nextY = existingAbsEls.reduce((maxY, b) => {
            const by = parseInt(b.style.top || 0) + (b.offsetHeight || 0);
            return Math.max(maxY, by);
          }, 0);
          dragSrc.style.position = 'absolute';
          dragSrc.style.left     = '0px';
          dragSrc.style.top      = (nextY > 0 ? nextY + 16 : 0) + 'px';
          if (!dragSrc.style.width || dragSrc.style.width === '') {
            dragSrc.style.width = '100%';
          }
          // absolute 전환 후 HTML5 drag 비활성화 — 이후 커스텀 mousemove drag 사용
          // (섹션에서 드롭 시 draggable="true"가 잔류하면 다음 드래그에서 회색이 됨)
          dragSrc.removeAttribute('draggable');
          dragSrc._dragBound = false; // 재바인딩 허용 플래그
          inner.appendChild(dragSrc);
          // text-block rebind — bindBlock이 absolute 상태를 다시 평가하도록
          const _tb = dragSrc.querySelector('.text-block');
          if (_tb) { _tb._blockBound = false; bindBlock(_tb); }
        } else {
        // row: 블록 추출 후 absolute 전환, wrapper 제거
        const blocks = [...dragSrc.querySelectorAll(BLOCK_SEL)];
        const existingBlocks = [...inner.querySelectorAll(BLOCK_SEL)];
        let nextY = existingBlocks.reduce((maxY, b) => {
          const by = parseInt(b.style.top || 0) + (b.offsetHeight || 0);
          return Math.max(maxY, by);
        }, 0);
        if (nextY > 0) nextY += 16;
        blocks.forEach(block => {
          makeAbsolute(block, 0, nextY);
          inner.appendChild(block);
          nextY += (block.offsetHeight || 60) + 16;
        });
        dragSrc.remove();
        }
      } else {
        // dragSrc가 inner의 조상인 경우 삽입 금지 (HierarchyRequestError 방지)
        if (dragSrc.contains(inner)) { clearDropIndicators(); return; }
        const indicator = inner.querySelector('.drop-indicator');
        if (indicator) inner.insertBefore(dragSrc, indicator);
        else inner.appendChild(dragSrc);
        if (dragSrc.matches?.(BLOCK_SEL) && dragSrc.style.position !== 'absolute') {
          const existingBlocks = [...inner.querySelectorAll(BLOCK_SEL)].filter(b => b !== dragSrc);
          const nextY = existingBlocks.reduce((maxY, b) => {
            const by = parseInt(b.style.top || 0) + (b.offsetHeight || 0);
            return Math.max(maxY, by);
          }, 0);
          makeAbsolute(dragSrc, 0, nextY > 0 ? nextY + 16 : 0);
        }
      }

      // DOM 순서 변경 후 absolute 블록의 top 재계산
      let _stackY = 0;
      [...inner.children].forEach(b => {
        if (b.classList.contains('drop-indicator')) return;
        if (b.style.position === 'absolute') {
          b.style.top  = _stackY + 'px';
          b.style.left = '0px';
        }
        _stackY += (b.offsetHeight || 60) + 16;
      });
    }

    // dragging 클래스 고착 방지
    dragSrc?.classList.remove('dragging', 'section-dragging', 'layer-dragging');
    clearDropIndicators();
    window.buildLayerPanel();
    dragSrc = null;
  });

  // 내부 블록 pointerdown 시 서브섹션 drag 일시 비활성 — 블록 선택/이동과 충돌 방지
  ss.addEventListener('pointerdown', e => {
    const isInnerBlock = e.target.closest('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .joker-block, .shape-block');
    if (isInnerBlock) {
      // 자식 블록 드래그 중엔 프레임 drag 비활성
      ss.setAttribute('draggable', 'false');
      document.addEventListener('pointerup', () => ss.setAttribute('draggable', 'true'), { once: true });
      return;
    }
    // 빈 영역 pointerdown → dragstart 전에 selected 상태 즉시 적용
    if (!ss.classList.contains('selected')) {
      window.deselectAll?.();
      const parentSec = ss.closest('.section-block');
      if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
      ss.classList.add('selected');
      window._activeFrame = ss;
      window.highlightBlock?.(ss, ss._layerItem);
      window.showFrameProperties?.(ss);
    }
  });

  // 프레임 자체 hover → 레이어 패널 하이라이트
  ss.addEventListener('mouseenter', () => {
    if (ss._layerItem && !ss._layerItem.classList.contains('active'))
      ss._layerItem.style.background = 'var(--ui-bg-card)';
  });
  ss.addEventListener('mouseleave', e => {
    if (ss.contains(e.relatedTarget)) return; // ss 내부로 이동 시 유지
    if (ss._layerItem && !ss._layerItem.classList.contains('active'))
      ss._layerItem.style.background = '';
  });

}

export {
  getDragAfterElement,
  getSectionDragAfterEl,
  getLayerSectionDragAfterEl,
  getLayerDragAfterItem,
  ungroupBlock,
  bindGroupDrag,
  bindSectionDrag,
  bindSectionDropZone,
  bindBlock,
  bindFrameDropZone,
};

// Backward compat
window.getDragAfterElement         = getDragAfterElement;
window.getSectionDragAfterEl       = getSectionDragAfterEl;
window.getLayerSectionDragAfterEl  = getLayerSectionDragAfterEl;
window.getLayerDragAfterItem       = getLayerDragAfterItem;
window.ungroupBlock                = ungroupBlock;
window.bindGroupDrag               = bindGroupDrag;
window.bindSectionDrag             = bindSectionDrag;
window.bindSectionDropZone         = bindSectionDropZone;
window.bindBlock                   = bindBlock;
window.bindFrameDropZone      = bindFrameDropZone;

// 드래그 중단(ESC 등)으로 dragging 클래스가 고착되는 현상 방지
document.addEventListener('dragend', () => {
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  clearDropIndicators();
  clearLayerSectionIndicators();
}, true);

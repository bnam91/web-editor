/* ═══════════════════════════════════
   SECTION / GROUP / ROW DRAG HELPERS
   HTML5 drag-and-drop for sections, groups, rows
   Extracted from drag-drop.js (lines ~1011–1257)
═══════════════════════════════════ */

import { state } from './globals.js';
import {
  clearDropIndicators,
  clearSectionIndicators,
  clearLayerSectionIndicators,
} from './drag-utils.js';

// perf(qa-perf): 드래그 중 autoSave MutationObserver 트리거 억제 헬퍼
export function _suppressDragSave() { state._suppressAutoSave = true; }
export function _resumeDragSave()   { state._suppressAutoSave = false; }

// Shared mutable drag state — exported as an object so both section-drag.js
// and block-drag.js can mutate the same properties (ES module live bindings
// cannot be reassigned by importers, but object property mutations propagate).
export const dragState = {
  dragSrc: null,
  layerDragSrc: null,
  sectionDragSrc: null,
  layerSectionDragSrc: null,
};

// Backward-compat window accessors (other scripts read/write window.dragSrc etc.)
Object.defineProperty(window, 'dragSrc', {
  get() { return dragState.dragSrc; },
  set(v) { dragState.dragSrc = v; },
  configurable: true,
});
Object.defineProperty(window, 'layerDragSrc', {
  get() { return dragState.layerDragSrc; },
  set(v) { dragState.layerDragSrc = v; },
  configurable: true,
});
Object.defineProperty(window, 'sectionDragSrc', {
  get() { return dragState.sectionDragSrc; },
  set(v) { dragState.sectionDragSrc = v; },
  configurable: true,
});
Object.defineProperty(window, 'layerSectionDragSrc', {
  get() { return dragState.layerSectionDragSrc; },
  set(v) { dragState.layerSectionDragSrc = v; },
  configurable: true,
});

function getDragAfterElement(container, y) {
  // y = dragover event.clientY (화면 좌표)
  // getBoundingClientRect도 화면 좌표 반환 → scale 보정 불필요, 두 값 단위 일치
  const children = [...container.children].filter(el =>
    !el.classList.contains('drop-indicator') && el !== dragState.dragSrc
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
    el.classList.contains('section-block') && el !== dragState.sectionDragSrc
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
    el.classList.contains('layer-section') && el !== dragState.layerSectionDragSrc?.sectionEl
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
    (el.classList.contains('layer-item') || el.classList.contains('layer-row-group')) && el !== dragState.layerDragSrc
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
    dragState.dragSrc = groupEl;
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
    dragState.dragSrc = null;
    // fix(qa-s02): group drag 종료 후 row-active 잔류 방지
    document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
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
    dragState.sectionDragSrc = sec;
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
    dragState.sectionDragSrc = null;
    // fix(qa-s02): 섹션 드래그 후 row-active 잔류 방지
    document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
  });
}

function bindSectionDropZone(sec) {
  // TODO-QA(S-02): 빈 row(블록 없음, col 없음)는 bindBlock이 호출되지 않아
  // draggable 속성이 설정되지 않음 → dragstart 이벤트 미발생 → 드래그 불가.
  // 빈 row를 다른 섹션으로 이동하려면 row에 직접 draggable+dragstart 바인딩 필요.
  // 현재는 실용적 빈도 낮으므로 미수정; 빈 row 생성 시 row.setAttribute('draggable','true') 추가 필요.
  const inner = sec.querySelector('.section-inner');
  // rAF throttle: getBoundingClientRect()를 dragover 매 이벤트마다 호출하지 않도록 (DBG-11)
  let _innerDragRafId = null;
  inner.addEventListener('dragover', e => {
    if (!dragState.dragSrc) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (_innerDragRafId) return;
    const clientY = e.clientY;
    _innerDragRafId = requestAnimationFrame(() => {
      _innerDragRafId = null;
      if (!dragState.dragSrc) return;
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
    if (!dragState.dragSrc) return;
    window.pushHistory();
    const indicator = inner.querySelector('.drop-indicator');
    if (indicator) inner.insertBefore(dragState.dragSrc, indicator);
    else inner.appendChild(dragState.dragSrc);
    clearDropIndicators();
    window.buildLayerPanel();
    dragState.dragSrc = null;
  });
}

/* 빈 row(블록 없음, col 없음)에 드래그 바인딩 — bindBlock이 호출되지 않는 경우를 대비 */
function bindEmptyRow(row) {
  if (row._dragBound) return;
  row._dragBound = true;
  row.setAttribute('draggable', 'true');
  row.addEventListener('dragstart', e => {
    e.stopPropagation();
    _suppressDragSave();
    dragState.dragSrc = row;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => ghost.remove(), 0);
    requestAnimationFrame(() => row.classList.add('dragging'));
  });
  row.addEventListener('dragend', () => {
    _resumeDragSave();
    row.classList.remove('dragging');
    clearDropIndicators();
    dragState.dragSrc = null;
    document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
  });
}

// Backward compat
window.getDragAfterElement        = getDragAfterElement;
window.getSectionDragAfterEl      = getSectionDragAfterEl;
window.getLayerSectionDragAfterEl = getLayerSectionDragAfterEl;
window.getLayerDragAfterItem      = getLayerDragAfterItem;
window.ungroupBlock               = ungroupBlock;
window.bindGroupDrag              = bindGroupDrag;
window.bindSectionDrag            = bindSectionDrag;
window.bindSectionDropZone        = bindSectionDropZone;
window.bindEmptyRow               = bindEmptyRow;

export {
  getDragAfterElement,
  getSectionDragAfterEl,
  getLayerSectionDragAfterEl,
  getLayerDragAfterItem,
  ungroupBlock,
  bindGroupDrag,
  bindSectionDrag,
  bindSectionDropZone,
  bindEmptyRow,
};

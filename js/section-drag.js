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
  /* ★합쳐 넣은 몸(.section-merged-part)은 «펴서» 후보에 넣는다.
     안 그러면 「아래 섹션 전체 높이를 가진 상자 하나」로 계산돼, 그 안 어디에 놓든
     이음매 앞 아니면 섹션 맨 끝 둘 중 하나로만 간다(중간 배치 불가).
     ⇒ 반환된 기준 노드의 «부모»에 넣어야 한다 — 부르는 쪽이 그렇게 하고 있다. */
  const flatten = (el) => [...el.children].flatMap(c =>
    c.classList.contains('section-merged-part') ? flatten(c) : [c]);
  const children = flatten(container).filter(el =>
    !el.classList.contains('drop-indicator') && el !== dragState.dragSrc
  );
  return children.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    /* ★«렌더된 중점» 그대로 쓴다 — 겹침을 되돌려 «흐름 위치»로 재는 보정을 넣어 봤다가
       걷어냈다(2026-09-04). 겹침이 크면 섹션이 줄어 보정 좌표가 렌더 영역 밖으로 나가고,
       커서가 거기 닿을 수 없어 «오히려» 도달 불가가 늘었다.
       실측(줌 100%, 단위 5개): 원래 pull 0~−500 전부 5/5 · 보정은 −200 부터 4/5.
       ⇒ 사용자가 «보는 대로» 판정하는 게 낫다. 남는 결함은 중점이 정확히 겹치는
         한 지점(m = −(앞높이+자기높이)/2)에서 드롭 띠가 얇아지는 것뿐이다. */
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getSectionDragAfterEl(container, y) {
  // DRAG-VAR-01: variation group의 다른 variant도 드래그 소스에서 제외 (display:none이라 height=0 → 위치 계산 오염 방지)
  const dragGroupId = dragState.sectionDragSrc?.dataset.variationGroup;
  const sections = [...container.children].filter(el => {
    if (!el.classList.contains('section-block')) return false;
    if (el === dragState.sectionDragSrc) return false;
    if (dragGroupId && el.dataset.variationGroup === dragGroupId) return false;
    return true;
  });
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
  // 피그마식 그룹(freeLayout 프레임 + data-group): 그룹 위치/회전을 자식에 baking 후 부모로 이동
  if (groupEl.dataset.group === 'true' || (groupEl.classList.contains('frame-block') && groupEl.dataset.freeLayout === 'true' && !groupEl.querySelector(':scope > .group-inner'))) {
    window.pushHistory();
    const parent = groupEl.parentElement;
    const gx = parseInt(groupEl.style.left) || 0;
    const gy = parseInt(groupEl.style.top) || 0;
    const gRot = parseFloat(groupEl.dataset.rotateDeg) || 0;
    const kids = [...groupEl.children].filter(c =>
      !c.classList.contains('frame-resize-handle') &&
      getComputedStyle(c).position === 'absolute');
    kids.forEach(c => {
      const cl = (parseInt(c.style.left) || 0) + gx;
      const ct = (parseInt(c.style.top) || 0) + gy;
      c.style.left = cl + 'px'; c.style.top = ct + 'px';
      c.dataset.offsetX = String(cl); c.dataset.offsetY = String(ct);
      // 그룹 회전은 각 자식 회전에 가산 (스큐 없음 가정)
      if (gRot) {
        const cr = (parseFloat(c.dataset.rotation) || 0) + gRot;
        c.dataset.rotation = String(cr);
        const base = (c.style.transform || '').replace(/\s*rotate\([^)]*\)/g, '').trim();
        c.style.transform = (base ? base + ' ' : '') + `rotate(${cr}deg)`;
        c.style.transformOrigin = 'center center';
      }
      groupEl.before(c);
    });
    groupEl.remove();
    window.deselectAll?.();
    window._activeFrame = (parent && parent.dataset?.freeLayout === 'true') ? parent : null;
    window.buildLayerPanel();
    window.scheduleAutoSave?.();
    return;
  }
  // 레거시 group-block(group-inner) 호환
  const inner = groupEl.querySelector('.group-inner');
  if (!inner) { groupEl.remove(); return; }
  window.pushHistory();
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
      // ★기준 노드의 «실제 부모»에 넣는다(상자 안이면 상자 안). inner 로만 넣으면
      //   insertBefore 가 NotFoundError 로 죽거나 블록이 상자 밖으로 튀어나온다.
      if (after && after.parentElement) after.parentElement.insertBefore(indicator, after);
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
    if (indicator && indicator.parentElement) indicator.parentElement.insertBefore(dragState.dragSrc, indicator);
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

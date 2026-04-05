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
  return block.closest('.sub-section-block');
}
function _isInsideUnselectedFrame(block) {
  const ss = _getParentFrame(block);
  if (!ss) return false;
  return !(ss.classList.contains('selected') && window._activeSubSection === ss);
}

// 프레임(sub-section-block) 내 자식 블록 드래그 후 프레임 높이를 자동 확장
function _resizeFrameToFitChildren(block) {
  const ss = block.closest('.sub-section-block');
  if (!ss) return;
  const inner = ss.querySelector('.sub-section-inner');
  if (!inner) return;
  const childrenBottom = Math.max(...[...inner.children].map(c => {
    const top = parseInt(c.style.top || 0);
    return top + (c.offsetHeight || 0);
  }));
  if (childrenBottom > ss.offsetHeight) {
    ss.style.height = childrenBottom + 'px';
    ss.style.minHeight = childrenBottom + 'px';
  }
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
  const isCanvas      = block.classList.contains('canvas-block');
  const isJoker      = block.classList.contains('joker-block');
  const isShape      = block.classList.contains('shape-block');

  if (isShape) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      const sec = block.closest('.section-block');
      const ss = block.closest('.sub-section-block');
      const layerItem = ss?._layerItem || block._layerItem;
      if (e.metaKey || e.ctrlKey) { window.toggleBlockSelect?.(block, sec); return; }
      if (e.shiftKey) { window.rangeSelectBlocks?.(block, sec); return; }
      // shape-block은 프레임 선택 단계를 건너뛰고 직접 선택 (핸들 즉시 표시)
      window.deselectAll?.();
      if (ss) {
        const parentSec = ss.closest('.section-block');
        if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
        ss.classList.add('selected');
        window._activeSubSection = ss;
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
        const ss  = block.closest('.sub-section-block');
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

  if (isText) {
    // absolute 텍스트 블록 (서브섹션 내부) 드래그 이동
    block.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (block.style.position !== 'absolute') return;
      if (block.classList.contains('editing')) return;
      // 프레임 내 블록: 자식 블록 자체가 선택된 상태일 때만 drag 허용
      if (_getParentFrame(block) && !block.classList.contains('selected')) return;
      e.stopPropagation();
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
        const scaler = document.getElementById('canvas-scaler');
        const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1) : 1;
        const newLeft = Math.round(startLeft + dx / scale);
        const newTop  = Math.round(startTop  + dy / scale);
        block.style.left = `${newLeft}px`;
        block.style.top  = `${newTop}px`;
        block.dataset.offsetX = String(newLeft);
        block.dataset.offsetY = String(newTop);
        window.scheduleAutoSave?.();
        const xNum = document.getElementById('txt-x-number');
        const yNum = document.getElementById('txt-y-number');
        if (xNum) xNum.value = newLeft;
        if (yNum) yNum.value = newTop;
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('dragend', onUp); // HTML5 drag 잔존 시 안전망
        if (moved) { _resizeFrameToFitChildren(block); window.pushHistory?.(); }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('dragend', onUp); // HTML5 drag가 mouseup 대신 dragend 발생 시 정리
    });

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
        window._activeSubSection = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showSubSectionProperties?.(ss);
        return;
      }
      window.deselectAll();
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
        // 편집 이벤트 바인딩 (최초 1회)
        if (!clicked._editBound) {
          clicked._editBound = true;
          // input → 타이핑 즉시 placeholder 해제
          clicked.addEventListener('input', () => {
            if (clicked.dataset.isPlaceholder === 'true' && clicked.textContent.trim() !== '') {
              delete clicked.dataset.isPlaceholder;
            }
          });
          // blur → 편집 종료 (외부 클릭, 포커스 이탈 시)
          clicked.addEventListener('blur', () => {
            block.classList.remove('editing');
            clicked.setAttribute('contenteditable', 'false');
            // 빈 텍스트면 placeholder 복원
            const ph = clicked.dataset.placeholder;
            if (ph && clicked.textContent.trim() === '') {
              clicked.innerHTML = ph;
              clicked.dataset.isPlaceholder = 'true';
            } else if (clicked.textContent.trim() !== '') {
              delete clicked.dataset.isPlaceholder;
            }
          });
          // Escape → 편집 종료, 블록 선택 상태 유지
          clicked.addEventListener('keydown', ev => {
            if (ev.key === 'Escape') {
              ev.preventDefault();
              ev.stopPropagation(); // 전역 window.deselectAll() 차단
              clicked.blur();       // blur 핸들러가 editing 정리
            }
          });
        }
      }
    });

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
        window._activeSubSection = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showSubSectionProperties?.(ss);
        return;
      }
      window.deselectAll();
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
    // 프레임(sub-section-inner) 내 absolute gap-block: 드래그로 top 조절
    block.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (block.style.position !== 'absolute') return;
      if (_getParentFrame(block) && !block.classList.contains('selected')) return;
      e.stopPropagation();
      const startX = e.clientX, startY = e.clientY;
      const startLeft = parseInt(block.style.left || '0');
      const startTop  = parseInt(block.style.top  || '0');
      let moved = false;
      function onMove(ev) {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        moved = true;
        const scaler = document.getElementById('canvas-scaler');
        const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1) : 1;
        block.style.left = `${Math.round(startLeft + dx / scale)}px`;
        block.style.top  = `${Math.round(startTop  + dy / scale)}px`;
        window.scheduleAutoSave?.();
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (moved) { _resizeFrameToFitChildren(block); window.pushHistory?.(); }
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

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
        window._activeSubSection = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showSubSectionProperties?.(ss);
        return;
      }
      window.deselectAll();
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
        window._activeSubSection = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showSubSectionProperties?.(ss);
        return;
      }
      window.deselectAll();
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
        window._activeSubSection = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showSubSectionProperties?.(ss);
        return;
      }
      window.deselectAll();
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
    // absolute 위치 드래그 이동 (서브섹션 내부)
    block.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (block.style.position !== 'absolute') return;
      if (block.classList.contains('editing')) return;
      // 프레임 내 블록: 자식 블록 자체가 선택된 상태일 때만 drag 허용
      if (_getParentFrame(block) && !block.classList.contains('selected')) return;
      if (e.target.closest('.label-item, .label-group-add-btn')) return;
      e.stopPropagation();
      const startX = e.clientX, startY = e.clientY;
      const startLeft = parseInt(block.style.left || '0');
      const startTop  = parseInt(block.style.top  || '0');
      let moved = false;
      function onMove(ev) {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
        moved = true;
        const scaler = document.getElementById('canvas-scaler');
        const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1) : 1;
        block.style.left = `${Math.round(startLeft + dx / scale)}px`;
        block.style.top  = `${Math.round(startTop  + dy / scale)}px`;
        const xNum = document.getElementById('lg-x-number');
        const yNum = document.getElementById('lg-y-number');
        if (xNum) xNum.value = parseInt(block.style.left);
        if (yNum) yNum.value = parseInt(block.style.top);
        window.scheduleAutoSave?.();
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (moved) { _resizeFrameToFitChildren(block); window.pushHistory?.(); }
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    block.addEventListener('click', e => {
      e.stopPropagation();
      if (_isInsideUnselectedFrame(block)) {
        const ss = _getParentFrame(block);
        window.deselectAll?.();
        const parentSec = ss.closest('.section-block');
        if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
        ss.classList.add('selected');
        window._activeSubSection = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showSubSectionProperties?.(ss);
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
        window._activeSubSection = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showSubSectionProperties?.(ss);
        return;
      }
      const rowEl = block.closest('.row');
      const isRowActive = rowEl && rowEl.classList.contains('row-active');
      window.deselectAll();
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
        window._activeSubSection = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showSubSectionProperties?.(ss);
        return;
      }
      window.deselectAll();
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
        window._activeSubSection = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showSubSectionProperties?.(ss);
        return;
      }
      window.deselectAll();
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
        window._activeSubSection = ss;
        window.highlightBlock?.(ss, ss._layerItem);
        window.showSubSectionProperties?.(ss);
        return;
      }
      window.deselectAll();
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
  const dragTarget = isGap ? block : (block.closest('.row') || block);
  if (dragTarget && !dragTarget._dragBound) {
    dragTarget._dragBound = true;
    dragTarget.setAttribute('draggable', 'true');
    if (isText) block.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('draggable', 'false'));

    dragTarget.addEventListener('dragstart', e => {
      if (block.style.position === 'absolute' && !block.closest('.sub-section-inner')) { e.preventDefault(); return; } // absolute 블록은 커스텀 mousemove drag 사용 (sub-section-inner 내부는 HTML5 drag 허용)
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

// ── Col 드롭존: 블록을 다른 col로 이동 ──
function bindColDropZone(col) {
  if (col._colDropBound) return;
  col._colDropBound = true;

  let _colRafId = null;

  col.addEventListener('dragover', e => {
    if (!dragSrc) return;
    const isSameCol = dragSrc.closest('.col') === col;
    if (!isSameCol) {
      // 다른 col → 비어있는 col에만 허용 (단일 블록 per col 규칙)
      const existing = [...col.querySelectorAll(':scope > *')].filter(el =>
        !el.classList.contains('col-placeholder') && !el.classList.contains('drop-indicator')
      );
      if (existing.length > 0) return;
      // multi-col row는 col에 드롭 불가 (col > row > col 중첩 방지)
      if (dragSrc.classList.contains('row') &&
          dragSrc.querySelectorAll(':scope > .col').length > 1) return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (_colRafId) return;
    const clientY = e.clientY;
    _colRafId = requestAnimationFrame(() => {
      _colRafId = null;
      if (!dragSrc) return;
      clearDropIndicators();
      const after = getDragAfterElement(col, clientY);
      const indicator = document.createElement('div');
      indicator.className = 'drop-indicator';
      if (after) col.insertBefore(indicator, after);
      else col.appendChild(indicator);
    });
  });

  col.addEventListener('dragleave', e => {
    if (!col.contains(e.relatedTarget)) {
      if (_colRafId) { cancelAnimationFrame(_colRafId); _colRafId = null; }
      clearDropIndicators();
    }
  });

  col.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    if (_colRafId) { cancelAnimationFrame(_colRafId); _colRafId = null; }
    if (!dragSrc) return;
    const isSameCol = dragSrc.closest('.col') === col;
    if (isSameCol) {
      // 같은 col 내 reorder
      window.pushHistory?.();
      const indicator = col.querySelector('.drop-indicator');
      if (indicator) col.insertBefore(dragSrc, indicator);
      else col.appendChild(dragSrc);
      clearDropIndicators();
      window.buildLayerPanel?.();
      dragSrc = null;
      return;
    }
    // 다른 col → 비어있는 col에만 허용
    const existingBlocks = [...col.querySelectorAll(':scope > *')].filter(el =>
      !el.classList.contains('col-placeholder') && !el.classList.contains('drop-indicator')
    );
    if (existingBlocks.length > 0) { clearDropIndicators(); return; }
    // multi-col row는 col에 드롭 불가 (col > row > col 중첩 방지)
    if (dragSrc.classList.contains('row') &&
        dragSrc.querySelectorAll(':scope > .col').length > 1) { clearDropIndicators(); return; }

    window.pushHistory?.();

    // dragSrc가 row인 경우: 단일 col + 단일 블록이면 블록을 추출해서 이동
    if (dragSrc.classList.contains('row')) {
      const srcCols = dragSrc.querySelectorAll(':scope > .col');
      if (srcCols.length === 1) {
        const srcCol = srcCols[0];
        const blocks = [...srcCol.querySelectorAll(':scope > *:not(.col-placeholder)')];
        if (blocks.length > 0) {
          const indicator = col.querySelector('.drop-indicator');
          blocks.forEach(b => {
            if (indicator) col.insertBefore(b, indicator);
            else col.appendChild(b);
          });
          // 소스 row가 비었으면 제거
          const remainingBlocks = srcCol.querySelectorAll(':scope > *:not(.col-placeholder)');
          if (!remainingBlocks.length) {
            const srcRow = dragSrc;
            srcRow.remove();
          }
          clearDropIndicators();
          window.buildLayerPanel?.();
          dragSrc = null;
          return;
        }
      }
    }

    // dragSrc가 gap-block 또는 단일 블록인 경우: 그대로 col에 삽입
    const indicator = col.querySelector('.drop-indicator');
    if (indicator) col.insertBefore(dragSrc, indicator);
    else col.appendChild(dragSrc);
    clearDropIndicators();
    window.buildLayerPanel?.();
    dragSrc = null;
  });
}

function bindSubSectionDropZone(ss) {
  if (ss._subSecBound) return;
  ss._subSecBound = true;

  // shape frame은 drop 수신 불가 — shape-block 전용 컨테이너
  const isShapeFrame = !!ss.querySelector('.shape-block');

  const inner = ss.querySelector('.sub-section-inner');
  let _rafId = null;

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
    if (e.target.closest('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .canvas-block, .joker-block, .shape-block')) return;
    // ss 또는 sub-section-inner 빈 공간 클릭만 처리
    if (!e.target.closest('.sub-section-block')) return;
    e.stopPropagation();
    // deselectAll 직접 호출 (selectSection은 showSectionProperties 부작용 있음)
    window.deselectAll?.();
    const parentSec = ss.closest('.section-block');
    if (parentSec) {
      parentSec.classList.add('selected');
      window.syncLayerActive?.(parentSec);
    }
    ss.classList.add('selected');
    window._activeSubSection = ss;
    window.highlightBlock?.(ss, ss._layerItem);
    window.showSubSectionProperties?.(ss);
  });

  // 4코너 리사이즈 핸들 — shape frame 제외
  // :scope > 로 직계 자식만 선택 — 중첩 프레임 핸들에 부모 클로저 리스너가 중복으로 달리는 버그 방지
  if (!isShapeFrame && !ss.querySelector(':scope > .ss-resize-handle')) {
    ['nw', 'ne', 'sw', 'se'].forEach(dir => {
      const h = document.createElement('div');
      h.className = `ss-resize-handle ${dir}`;
      h.dataset.dir = dir;
      ss.appendChild(h);
    });
  }
  ss.querySelectorAll(':scope > .ss-resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const dir = handle.dataset.dir;
      const startX = e.clientX;
      const startY = e.clientY;
      const ssRect = ss.getBoundingClientRect();
      const scaler0 = document.getElementById('canvas-scaler');
      const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
      const startW = Math.round(ssRect.width / scale0);
      const startH = Math.round(ssRect.height / scale0);
      // section-inner 콘텐츠 폭(패딩 제외)을 최대 너비로 제한
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
        ss.style.height = `${newH}px`; ss.dataset.height = String(newH);
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
    const BLOCK_SEL = '.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .canvas-block, .joker-block, .shape-block';
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

      // row가 드롭된 경우 → 블록 추출 후 absolute 전환, row 제거
      if (dragSrc.classList.contains('row')) {
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
      } else {
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
    const isInnerBlock = e.target.closest('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .canvas-block, .joker-block, .shape-block');
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
      window._activeSubSection = ss;
      window.highlightBlock?.(ss, ss._layerItem);
      window.showSubSectionProperties?.(ss);
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
  bindColDropZone,
  bindBlock,
  bindSubSectionDropZone,
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
window.bindColDropZone             = bindColDropZone;
window.bindBlock                   = bindBlock;
window.bindSubSectionDropZone      = bindSubSectionDropZone;

// 드래그 중단(ESC 등)으로 dragging 클래스가 고착되는 현상 방지
document.addEventListener('dragend', () => {
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  clearDropIndicators();
  clearLayerSectionIndicators();
}, true);

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

  const label = groupEl.querySelector(':scope > .group-block-label');
  if (!label) return;

  label.setAttribute('draggable', 'true');
  label.addEventListener('dragstart', e => {
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
  label.addEventListener('dragend', () => {
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
  const isStripBanner = block.classList.contains('strip-banner-block');
  const isGraph       = block.classList.contains('graph-block');
  const isDivider     = block.classList.contains('divider-block');


  if (isText) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      // 편집 모드 중 클릭은 무시 (커서 이동/텍스트 선택 기본 동작 유지)
      if (block.classList.contains('editing')) return;
      if (e.shiftKey) {
        if (block.classList.contains('selected')) {
          block.classList.remove('selected');
          if (block._layerItem) { block._layerItem.classList.remove('active'); block._layerItem.style.background = ''; }
        } else {
          block.classList.add('selected');
          if (block._layerItem) block._layerItem.classList.add('active');
        }
        window.syncSection(block.closest('.section-block'));
        return;
      }
      window.deselectAll();
      block.classList.add('selected');
      window.syncSection(block.closest('.section-block'));
      window.highlightBlock(block, block._layerItem);
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
        // 클릭 위치에 정확히 커서 지정
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range) {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        // 편집 이벤트 바인딩 (최초 1회)
        if (!clicked._editBound) {
          clicked._editBound = true;
          // blur → 편집 종료 (외부 클릭, 포커스 이탈 시)
          clicked.addEventListener('blur', () => {
            block.classList.remove('editing');
            clicked.setAttribute('contenteditable', 'false');
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
      if (e.shiftKey) {
        if (block.classList.contains('selected')) {
          block.classList.remove('selected');
          if (block._layerItem) { block._layerItem.classList.remove('active'); block._layerItem.style.background = ''; }
        } else {
          block.classList.add('selected');
          if (block._layerItem) block._layerItem.classList.add('active');
        }
        window.syncSection(block.closest('.section-block'));
        return;
      }
      window.deselectAll();
      block.classList.add('selected');
      window.syncSection(block.closest('.section-block'));
      window.highlightBlock(block, block._layerItem);
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
    block.addEventListener('click', e => {
      e.stopPropagation();
      if (e.shiftKey) {
        block.classList.toggle('selected');
        if (block._layerItem) block._layerItem.classList.toggle('active', block.classList.contains('selected'));
        window.syncSection(block.closest('.section-block'));
        return;
      }
      window.deselectAll();
      block.classList.add('selected');
      window.syncSection(block.closest('.section-block'));
      window.highlightBlock(block, block._layerItem);
      window.showGapProperties(block);
    });
  }

  if (isIconCb) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      if (e.shiftKey) {
        block.classList.toggle('selected');
        if (block._layerItem) block._layerItem.classList.toggle('active', block.classList.contains('selected'));
        window.syncSection(block.closest('.section-block'));
        return;
      }
      window.deselectAll();
      block.classList.add('selected');
      window.syncSection(block.closest('.section-block'));
      window.highlightBlock(block, block._layerItem);
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
      if (e.shiftKey) {
        block.classList.toggle('selected');
        if (block._layerItem) block._layerItem.classList.toggle('active', block.classList.contains('selected'));
        window.syncSection(block.closest('.section-block'));
        return;
      }
      window.deselectAll();
      block.classList.add('selected');
      window.syncSection(block.closest('.section-block'));
      window.highlightBlock(block, block._layerItem);
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
      if (e.shiftKey) {
        block.classList.toggle('selected');
        if (block._layerItem) block._layerItem.classList.toggle('active', block.classList.contains('selected'));
        window.syncSection(block.closest('.section-block'));
        return;
      }
      window.deselectAll();
      block.classList.add('selected');
      window.syncSection(block.closest('.section-block'));
      window.highlightBlock(block, block._layerItem);
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
      if (e.shiftKey) {
        block.classList.toggle('selected');
        if (block._layerItem) block._layerItem.classList.toggle('active', block.classList.contains('selected'));
        window.syncSection(block.closest('.section-block'));
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
      window.syncSection(block.closest('.section-block'));
      window.highlightBlock(block, block._layerItem);
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

  if (isStripBanner) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      if (e.shiftKey) {
        block.classList.toggle('selected');
        if (block._layerItem) block._layerItem.classList.toggle('active', block.classList.contains('selected'));
        window.syncSection(block.closest('.section-block'));
        return;
      }
      window.deselectAll();
      block.classList.add('selected');
      window.syncSection(block.closest('.section-block'));
      window.highlightBlock(block, block._layerItem);
      window.showStripBannerProperties(block);
    });
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      if (e.target.closest('.sbb-image')) {
        window.triggerStripBannerImageUpload(block);
        return;
      }
      const textEl = e.target.closest('.sbb-heading, .sbb-body');
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
      if (file && file.type.startsWith('image/')) window.loadImageToStripBanner(block, file);
    });
    if (block.classList.contains('has-image')) {
      const clearBtn = block.querySelector('.sbb-clear-btn');
      if (clearBtn) clearBtn.addEventListener('click', e => { e.stopPropagation(); window.clearStripBannerImage(block); });
    }
  }

  if (isGraph) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      if (e.shiftKey) {
        block.classList.toggle('selected');
        if (block._layerItem) block._layerItem.classList.toggle('active', block.classList.contains('selected'));
        window.syncSection(block.closest('.section-block'));
        return;
      }
      window.deselectAll();
      block.classList.add('selected');
      window.syncSection(block.closest('.section-block'));
      window.highlightBlock(block, block._layerItem);
      window.showGraphProperties(block);
    });
  }

  const isIconText = block.classList.contains('icon-text-block');
  if (isIconText) {
    block.querySelectorAll('.asset-overlay, .asset-overlay-clear').forEach(el => el.remove());
    block.addEventListener('click', e => {
      e.stopPropagation();
      if (block.classList.contains('editing')) return;
      if (e.shiftKey) {
        block.classList.toggle('selected');
        if (block._layerItem) block._layerItem.classList.toggle('active', block.classList.contains('selected'));
        window.syncSection(block.closest('.section-block'));
        return;
      }
      window.deselectAll();
      block.classList.add('selected');
      window.syncSection(block.closest('.section-block'));
      window.highlightBlock(block, block._layerItem);
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
      if (e.shiftKey) {
        block.classList.toggle('selected');
        if (block._layerItem) block._layerItem.classList.toggle('active', block.classList.contains('selected'));
        window.syncSection(block.closest('.section-block'));
        return;
      }
      window.deselectAll();
      block.classList.add('selected');
      window.syncSection(block.closest('.section-block'));
      window.highlightBlock(block, block._layerItem);
      window.showDividerProperties(block);
    });
  }

  // hover ↔ layer item
  block.addEventListener('mouseenter', () => { if (block._layerItem) block._layerItem.style.background = 'var(--ui-bg-card)'; });
  block.addEventListener('mouseleave', () => { if (block._layerItem && !block._layerItem.classList.contains('active')) block._layerItem.style.background = ''; });

  // 드래그 이벤트 (overlay-tb는 마우스 드래그 사용, HTML5 drag 제외)
  if (block.classList.contains('overlay-tb')) return;
  const dragTarget = isGap ? block : (block.closest('.row') || block);
  if (dragTarget && !dragTarget._dragBound) {
    dragTarget._dragBound = true;
    dragTarget.setAttribute('draggable', 'true');
    if (isText) block.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('draggable', 'false'));

    dragTarget.addEventListener('dragstart', e => {
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
    // 같은 col 내부의 row는 무시
    if (dragSrc.closest('.col') === col) return;
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
    if (dragSrc.closest('.col') === col) return;

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

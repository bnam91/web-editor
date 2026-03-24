import { state } from './globals.js';

/* ═══════════════════════════════════
   DRAG AND DROP
═══════════════════════════════════ */
function genId(prefix) {
  return (prefix || 'b') + '_' + Math.random().toString(36).slice(2, 9);
}

let dragSrc = null;
let layerDragSrc = null;
let sectionDragSrc = null;
let layerSectionDragSrc = null;

Object.defineProperty(window, 'layerDragSrc', {
  get() { return layerDragSrc; },
  set(v) { layerDragSrc = v; },
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

function clearDropIndicators() {
  document.querySelectorAll('.drop-indicator').forEach(d => d.remove());
}

function clearLayerIndicators() {
  document.querySelectorAll('.layer-drop-indicator').forEach(d => d.remove());
}

function clearSectionIndicators() {
  document.querySelectorAll('.section-drop-indicator').forEach(d => d.remove());
}

function clearLayerSectionIndicators() {
  document.querySelectorAll('.layer-section-drop-indicator').forEach(d => d.remove());
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
    sec.classList.remove('section-dragging');
    clearSectionIndicators();
    sectionDragSrc = null;
  });
}

function bindSectionDropZone(sec) {
  const inner = sec.querySelector('.section-inner');
  inner.addEventListener('dragover', e => {
    if (!dragSrc) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDropIndicators();
    const after = getDragAfterElement(inner, e.clientY);
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    if (after) inner.insertBefore(indicator, after);
    else inner.appendChild(indicator);
  });
  inner.addEventListener('dragleave', e => {
    if (!inner.contains(e.relatedTarget)) clearDropIndicators();
  });
  inner.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragSrc) return;
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
      window.triggerCircleUpload(block);
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
        cell.setAttribute('contenteditable','true');
        cell.focus();
        // 커서를 끝으로 이동
        const range = document.createRange();
        range.selectNodeContents(cell);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
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
        const lastBg     = first?.dataset.bg     || '#111111';
        const lastColor  = first?.dataset.color  || '#ffffff';
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
  block.addEventListener('mouseenter', () => { if (block._layerItem) block._layerItem.style.background = '#252525'; });
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
      dragTarget.classList.remove('dragging');
      clearDropIndicators();
      dragSrc = null;
    });
  }
}

function makeTextBlock(type) {
  const classMap  = { h1:'tb-h1', h2:'tb-h2', h3:'tb-h3', body:'tb-body', caption:'tb-caption', label:'tb-label' };
  const labelMap  = { h1:'Heading', h2:'Heading', h3:'Heading', body:'Body', caption:'Caption', label:'Label' };
  const dataType  = (type==='h1'||type==='h2'||type==='h3') ? 'heading' : type;
  const placeholder = { h1:'제목을 입력하세요', h2:'소제목을 입력하세요', h3:'소항목을 입력하세요', body:'본문 내용을 입력하세요.', caption:'캡션을 입력하세요', label:'Label' };

  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const tb = document.createElement('div');
  tb.className = 'text-block'; tb.dataset.type = dataType;
  tb.id = genId('tb');
  tb.innerHTML = `
    <div class="${classMap[type]}" contenteditable="false">${placeholder[type]}</div>`;

  if (state.pageSettings.padX > 0) { tb.style.paddingLeft = state.pageSettings.padX + 'px'; tb.style.paddingRight = state.pageSettings.padX + 'px'; }
  if (type !== 'label') {
    tb.style.paddingTop = state.pageSettings.padY + 'px';
    tb.style.paddingBottom = state.pageSettings.padY + 'px';
  }
  col.appendChild(tb);
  row.appendChild(col);
  return { row, block: tb };
}

function makeAssetBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const ab = document.createElement('div');
  ab.className = 'asset-block';
  ab.id = genId('ab');
  ab.dataset.align = 'center';
  ab.dataset.overlay = 'false';
  ab.style.alignSelf = 'center';
  ab.innerHTML = `
    ${ASSET_SVG}
    <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>
    <div class="asset-overlay"></div>`;

  col.appendChild(ab);
  row.appendChild(col);
  return { row, block: ab };
}

function makeGapBlock() {
  const gb = document.createElement('div');
  gb.className = 'gap-block'; gb.dataset.type = 'gap';
  gb.id = genId('gb');
  return gb;
}

function makeIconCircleBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const icb = document.createElement('div');
  icb.className = 'icon-circle-block'; icb.dataset.type = 'icon-circle';
  icb.id = genId('icb');
  icb.dataset.size = '240';
  icb.dataset.bgColor = '#e8e8e8';
  icb.dataset.border = 'none';
  icb.innerHTML = `
    <div class="icb-circle" style="width:240px;height:240px;background:#e8e8e8;">
      <span class="icb-placeholder">+</span>
    </div>`;

  col.appendChild(icb);
  row.appendChild(col);
  return { row, block: icb };
}

function makeLabelItem(text = 'Label', bg = '#111111', color = '#ffffff', radius = 40) {
  const item = document.createElement('div');
  item.className = 'label-item';
  item.dataset.bg     = bg;
  item.dataset.color  = color;
  item.dataset.radius = radius;
  item.style.backgroundColor = bg;
  item.style.color            = color;
  item.style.borderRadius     = radius + 'px';

  const span = document.createElement('span');
  span.className = 'label-item-text';
  span.contentEditable = 'false';
  span.textContent = text;

  const delBtn = document.createElement('button');
  delBtn.className = 'label-item-delete-btn';
  delBtn.textContent = '×';
  delBtn.title = '라벨 삭제';

  item.appendChild(span);
  item.appendChild(delBtn);
  return item;
}

function makeLabelGroupBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const block = document.createElement('div');
  block.className = 'label-group-block';
  block.id = genId('lg');

  block.appendChild(makeLabelItem('Tag', '#111111', '#ffffff', 40));

  const addBtn = document.createElement('button');
  addBtn.className = 'label-group-add-btn';
  addBtn.textContent = '+';
  addBtn.title = '라벨 추가';
  block.appendChild(addBtn);

  if (state.pageSettings.padX > 0) {
    block.style.paddingLeft  = state.pageSettings.padX + 'px';
    block.style.paddingRight = state.pageSettings.padX + 'px';
  }

  col.appendChild(block);
  row.appendChild(col);
  return { row, block };
}

function addLabelGroupBlock() {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeLabelGroupBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function makeTableBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const tb = document.createElement('div');
  tb.className = 'table-block'; tb.dataset.type = 'table';
  tb.id = genId('tbl');
  tb.dataset.style = 'default';
  tb.dataset.showHeader = 'true';
  tb.dataset.cellAlign = 'center';
  tb.innerHTML = `
    <table class="tb-table">
      <thead>
        <tr><th style="text-align:center">항목</th><th style="text-align:center">내용</th></tr>
      </thead>
      <tbody>
        <tr><td style="text-align:center">항목 1</td><td style="text-align:center"></td></tr>
        <tr><td style="text-align:center">항목 2</td><td style="text-align:center"></td></tr>
        <tr><td style="text-align:center">항목 3</td><td style="text-align:center"></td></tr>
        <tr><td style="text-align:center">항목 4</td><td style="text-align:center"></td></tr>
        <tr><td style="text-align:center">항목 5</td><td style="text-align:center"></td></tr>
        <tr><td style="text-align:center">항목 6</td><td style="text-align:center"></td></tr>
        <tr><td style="text-align:center">항목 7</td><td style="text-align:center"></td></tr>
      </tbody>
    </table>`;

  col.appendChild(tb);
  row.appendChild(col);
  return { row, block: tb };
}

/* 섹션 안 삽입 — 하단 Gap Block 바로 앞에 */
function insertBeforeBottomGap(section, el) {
  const inner = section.querySelector('.section-inner');
  const bottomGap = [...inner.querySelectorAll(':scope > .gap-block')].at(-1);
  if (bottomGap) inner.insertBefore(el, bottomGap);
  else inner.appendChild(el);
}

/* 선택된 블록 바로 다음에 삽입, 없으면 하단 Gap 앞에 */
function insertAfterSelected(section, el) {
  const inner = section.querySelector('.section-inner');
  const sel = document.querySelector('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected, .label-group-block.selected, .card-block.selected, .strip-banner-block.selected, .graph-block.selected, .divider-block.selected');

  if (sel && sel.closest('.section-block') === section) {
    const isGap = sel.classList.contains('gap-block');
    const ref = isGap ? sel : (sel.closest('.row') || sel);
    ref.after(el);
  } else {
    insertBeforeBottomGap(section, el);
  }
}

function showNoSelectionHint() {
  const fp = document.getElementById('floating-panel');
  fp.classList.add('fp-shake');
  setTimeout(() => fp.classList.remove('fp-shake'), 400);
  showToast('⚠️ 섹션 또는 블록을 먼저 선택하세요');
}

function showToast(msg) {
  let t = document.getElementById('editor-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'editor-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

function getSectionAlign(sec) {
  const first = sec.querySelector('.text-block .tb-h1, .text-block .tb-h2, .text-block .tb-h3, .text-block .tb-body');
  if (!first) return null;
  return first.style.textAlign || null;
}

function addTextBlock(type) {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeTextBlock(type);

  // 섹션의 기존 텍스트 정렬 상속
  const align = getSectionAlign(sec);
  if (align) {
    const contentEl = block.querySelector('[class^="tb-"]');
    if (type === 'label') {
      block.style.textAlign = align;
    } else if (contentEl) {
      contentEl.style.textAlign = align;
    }
  }

  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function groupSelectedBlocks() {
  const selected = [...document.querySelectorAll('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected, .card-block.selected, .strip-banner-block.selected, .graph-block.selected, .divider-block.selected')];
  if (selected.length < 2) return;

  // 같은 섹션의 블록만 그룹
  const sec = selected[0].closest('.section-block');
  if (!selected.every(b => b.closest('.section-block') === sec)) return;

  window.pushHistory();

  // DOM 순서대로 부모 row/gap 수집 (중복 제거)
  const sectionInner = sec.querySelector('.section-inner');
  const childrenInOrder = [...sectionInner.children];
  const rows = [];
  selected.forEach(b => {
    const row = b.classList.contains('gap-block') ? b : b.closest('.row');
    if (row && !rows.includes(row)) rows.push(row);
  });
  rows.sort((a, b) => childrenInOrder.indexOf(a) - childrenInOrder.indexOf(b));

  // group-block 생성
  const groupCount = sectionInner.querySelectorAll('.group-block').length + 1;
  const groupEl = document.createElement('div');
  groupEl.className = 'group-block';
  groupEl.dataset.name = `Group ${groupCount}`;
  const labelEl = document.createElement('span');
  labelEl.className = 'group-block-label';
  labelEl.textContent = groupEl.dataset.name;
  const groupInner = document.createElement('div');
  groupInner.className = 'group-inner';
  groupEl.appendChild(labelEl);
  groupEl.appendChild(groupInner);

  // 첫 번째 row 자리에 group-block 삽입 후 rows 이동
  rows[0].before(groupEl);
  rows.forEach(row => groupInner.appendChild(row));

  bindGroupDrag(groupEl);
  window.deselectAll();
  window.buildLayerPanel();
  window.selectSection(sec);
}

function addRowBlock() {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.layout = 'flex';
  row.dataset.ratioStr = '2*1';

  [0, 1].forEach(() => {
    const col = document.createElement('div');
    col.className = 'col';
    col.style.flex = '1';
    col.dataset.flex = '1';
    const ph = window.makeColPlaceholder(col);
    ph.style.minHeight = '390px'; // 단독 Asset 기본 높이(780px)의 약 절반
    col.appendChild(ph);
    row.appendChild(col);
  });

  insertAfterSelected(sec, row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

// ── Row 프리셋 생성 ──────────────────────────────────────────
function makePresetRow(type) {
  const row = document.createElement('div');
  row.className = 'row';

  const makeAb = () => {
    const ab = document.createElement('div');
    ab.className = 'asset-block';
    ab.id = genId('ab');
    ab.dataset.align = 'center';
    ab.dataset.overlay = 'false';
    ab.style.alignSelf = 'center';
    ab.innerHTML = `${ASSET_SVG}<span class="asset-label">에셋을 업로드하거나 드래그하세요</span><div class="asset-overlay"></div>`;
    return ab;
  };

  const makeCol = (flex) => {
    const col = document.createElement('div');
    col.className = 'col';
    col.style.flex = flex;
    col.dataset.flex = flex;
    return col;
  };

  if (type === 'img1') {
    row.dataset.layout = 'stack';
    const col = document.createElement('div');
    col.className = 'col'; col.dataset.width = '100';
    const ab = makeAb();
    col.appendChild(ab);
    row.appendChild(col);
    return { row, firstBlock: ab };
  }

  if (type === 'img2') {
    row.dataset.layout = 'flex'; row.dataset.ratioStr = '1*1';
    const blocks = [];
    [1, 1].forEach(flex => {
      const col = makeCol(flex);
      const ab = makeAb();
      ab.style.height = '390px'; // 2컬럼: 기본 높이 절반
      col.appendChild(ab);
      row.appendChild(col);
      blocks.push(ab);
    });
    return { row, firstBlock: blocks[0], allBlocks: blocks };
  }

  if (type === 'img3') {
    row.dataset.layout = 'flex'; row.dataset.ratioStr = '1*1*1';
    const blocks = [];
    [1, 1, 1].forEach(flex => {
      const col = makeCol(flex);
      const ab = makeAb();
      ab.style.height = '300px'; // 3컬럼: 더 낮게
      col.appendChild(ab);
      row.appendChild(col);
      blocks.push(ab);
    });
    return { row, firstBlock: blocks[0], allBlocks: blocks };
  }

  if (type === 'text-img') {
    row.dataset.layout = 'flex'; row.dataset.ratioStr = '1*1';
    // 텍스트 col
    const colText = makeCol(1);
    const tb = document.createElement('div');
    tb.className = 'text-block'; tb.dataset.type = 'body';
    tb.id = genId('tb');
    tb.innerHTML = `<div class="tb-body" contenteditable="false">본문을 입력하세요</div>`;
    if (state.pageSettings.padX > 0) { tb.style.paddingLeft = state.pageSettings.padX + 'px'; tb.style.paddingRight = state.pageSettings.padX + 'px'; }
    tb.style.paddingTop = state.pageSettings.padY + 'px';
    tb.style.paddingBottom = state.pageSettings.padY + 'px';
    colText.appendChild(tb);
    // 이미지 col
    const colImg = makeCol(1);
    const ab = makeAb();
    colImg.appendChild(ab);
    row.appendChild(colText);
    row.appendChild(colImg);
    return { row, firstBlock: ab, allBlocks: [tb, ab] };
  }

  return { row, firstBlock: null };
}

function addPresetRow(type) {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, firstBlock, allBlocks } = makePresetRow(type);
  insertAfterSelected(sec, row);
  if (allBlocks) allBlocks.forEach(b => bindBlock(b));
  else if (firstBlock) bindBlock(firstBlock);
  window.buildLayerPanel();
  window.selectSection(sec);
  // 첫 번째 asset-block 자동 선택 (이미지 업로드 유도)
  if (firstBlock && firstBlock.classList.contains('asset-block')) {
    firstBlock.click();
  }
}

const ASSET_PRESETS = {
  standard: { height: 780 },
  square:   { height: 860 },
  tall:     { height: 1032 },
  wide:     { height: 575 },
};

function addAssetBlock(preset) {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeAssetBlock();
  if (preset && ASSET_PRESETS[preset]) {
    block.style.height = ASSET_PRESETS[preset].height + 'px';
  }
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function addGapBlock() {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const gb = makeGapBlock();
  insertAfterSelected(sec, gb);
  bindBlock(gb);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function addIconCircleBlock() {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeIconCircleBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function addTableBlock() {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeTableBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function makeCardBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const cdb = document.createElement('div');
  cdb.className = 'card-block'; cdb.dataset.type = 'card';
  cdb.id = genId('cdb');
  cdb.dataset.bgColor = '#f5f5f5';
  cdb.dataset.radius = '12';
  cdb.innerHTML = `
    <div class="cdb-image">
      <span class="cdb-img-placeholder">+</span>
    </div>
    <div class="cdb-body" style="background:#f5f5f5; border-radius:0 0 12px 12px;">
      <div class="cdb-title" contenteditable="false">카드 제목</div>
      <div class="cdb-desc" contenteditable="false">설명 텍스트를 입력하세요</div>
    </div>`;

  col.appendChild(cdb);
  row.appendChild(col);
  return { row, block: cdb };
}

function addCardBlock() {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeCardBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function makeStripBannerBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const sbb = document.createElement('div');
  sbb.className = 'strip-banner-block'; sbb.dataset.type = 'strip-banner';
  sbb.id = genId('sbb');
  sbb.dataset.bgColor = '#f5f5f5';
  sbb.dataset.radius = '0';
  sbb.dataset.imgPos = 'left';
  sbb.dataset.usePadx = 'true';
  sbb.style.background = '#f5f5f5';
  sbb.innerHTML = `
    <div class="sbb-image">
      <span class="sbb-img-placeholder">+</span>
    </div>
    <div class="sbb-content" style="background:#f5f5f5;">
      <div class="sbb-heading" contenteditable="false">제목을 입력하세요</div>
      <div class="sbb-gap" style="height:8px"></div>
      <div class="sbb-body" contenteditable="false">내용을 입력하세요.</div>
    </div>`;

  col.appendChild(sbb);
  row.appendChild(col);
  return { row, block: sbb };
}

function addStripBannerBlock() {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeStripBannerBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

const GRAPH_DEFAULT_ITEMS = [
  { label: '항목 1', value: 75 },
  { label: '항목 2', value: 90 },
  { label: '항목 3', value: 55 },
  { label: '항목 4', value: 80 },
  { label: '항목 5', value: 65 },
];

function renderGraph(block) {
  const items      = JSON.parse(block.dataset.items || '[]');
  const chartType  = block.dataset.chartType  || 'bar-v';
  const maxVal     = Math.max(...items.map(i => i.value), 1);
  const chartH     = parseInt(block.dataset.chartHeight) || 240;
  const labelSize  = parseInt(block.dataset.labelSize)   || 13;
  const valSize    = Math.round(labelSize * 1.07);

  if (chartType === 'bar-v') {
    block.innerHTML = `
      <div class="grb-bars-v" style="height:${chartH}px">
        ${items.map(item => {
          const pct = Math.round((item.value / maxVal) * 100);
          return `
            <div class="grb-bar-col">
              <div class="grb-bar-val-label" style="font-size:${valSize}px">${item.value}</div>
              <div class="grb-bar-fill-wrap">
                <div class="grb-bar-fill" style="height:${pct}%"></div>
              </div>
              <div class="grb-bar-label" style="font-size:${labelSize}px">${item.label}</div>
            </div>`;
        }).join('')}
      </div>`;
  } else {
    block.innerHTML = `
      <div class="grb-bars-h">
        ${items.map(item => {
          const pct = Math.round((item.value / maxVal) * 100);
          return `
            <div class="grb-bar-row">
              <div class="grb-bar-row-label" style="font-size:${labelSize}px">${item.label}</div>
              <div class="grb-bar-h-wrap" style="height:${Math.round(chartH / 10)}px">
                <div class="grb-bar-h-fill" style="width:${pct}%">
                  <span class="grb-bar-h-val" style="font-size:${labelSize}px">${item.value}</span>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }
}

function makeGraphBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const grb = document.createElement('div');
  grb.className = 'graph-block'; grb.dataset.type = 'graph';
  grb.id = genId('grb');
  grb.dataset.chartType = 'bar-v';
  grb.dataset.preset = 'default';
  grb.dataset.items = JSON.stringify(GRAPH_DEFAULT_ITEMS);

  renderGraph(grb);

  col.appendChild(grb);
  row.appendChild(col);
  return { row, block: grb };
}

function addGraphBlock() {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeGraphBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function makeDividerBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const dvd = document.createElement('div');
  dvd.className = 'divider-block'; dvd.dataset.type = 'divider';
  dvd.id = genId('dvd');
  dvd.dataset.lineColor   = '#cccccc';
  dvd.dataset.lineStyle   = 'solid';
  dvd.dataset.lineWeight  = '1';
  dvd.dataset.padV        = '12';
  dvd.innerHTML = `<hr class="dvd-line" style="border-top:1px solid #cccccc;">`;

  col.appendChild(dvd);
  row.appendChild(col);
  return { row, block: dvd };
}

function addDividerBlock() {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeDividerBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function applyDividerStyle(block) {
  const hr      = block.querySelector('.dvd-line');
  if (!hr) return;
  const weight  = block.dataset.lineWeight  || '1';
  const style   = block.dataset.lineStyle   || 'solid';
  const color   = block.dataset.lineColor   || '#cccccc';
  const padV    = block.dataset.padV        || '12';
  hr.style.borderTop = `${weight}px ${style} ${color}`;
  block.style.padding = `${padV}px 0`;
}

function addSection() {
  const canvas  = document.getElementById('canvas');
  const secList = canvas.querySelectorAll('.section-block');
  const newIdx  = secList.length + 1;

  const sec = document.createElement('div');
  sec.className = 'section-block'; sec.dataset.section = newIdx;
  sec.id = genId('sec');
  sec.innerHTML = `
    <span class="section-label">Section ${String(newIdx).padStart(2,'0')}</span>
    <div class="section-toolbar">
      <button class="st-btn st-branch-btn" onclick="openSectionBranchMenu(this)" title="feature 브랜치로 실험">⎇</button>
    </div>
    <div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:100px" id="${genId('gb')}"></div>
      <div class="row" data-layout="stack">
        <div class="col" data-width="100">
          <div class="text-block" data-type="heading" id="${genId('tb')}">
            <div class="tb-h2" contenteditable="false">새 섹션 제목</div>
          </div>
        </div>
      </div>
      <div class="row" data-layout="stack">
        <div class="col" data-width="100">
          <div class="asset-block" id="${genId('ab')}" data-align="center" data-overlay="false">
            ${ASSET_SVG}
            <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>
            <div class="asset-overlay"></div>
          </div>
        </div>
      </div>
      <div class="gap-block" data-type="gap" style="height:100px" id="${genId('gb')}"></div>
    </div>`;

  const selectedSec = document.querySelector('.section-block.selected');
  if (selectedSec) selectedSec.after(sec);
  else canvas.appendChild(sec);

  // 이벤트 바인딩
  window.pushHistory();
  sec.addEventListener('click', e => { e.stopPropagation(); window.selectSection(sec); });
  window.bindSectionDelete(sec);
  window.bindSectionOrder(sec);
  bindSectionDropZone(sec);
  bindSectionDrag(sec);
  sec.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .card-block, .strip-banner-block, .graph-block, .divider-block').forEach(b => bindBlock(b));

  window.buildLayerPanel();
  window.selectSection(sec);
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.maybeAddNewSectionToScope(sec.id);
}

export {
  genId,
  getDragAfterElement,
  clearDropIndicators,
  clearLayerIndicators,
  clearSectionIndicators,
  clearLayerSectionIndicators,
  getSectionDragAfterEl,
  getLayerSectionDragAfterEl,
  getLayerDragAfterItem,
  ungroupBlock,
  bindGroupDrag,
  bindSectionDrag,
  bindSectionDropZone,
  bindBlock,
  makeTextBlock,
  makeAssetBlock,
  makeGapBlock,
  makeIconCircleBlock,
  makeLabelItem,
  makeLabelGroupBlock,
  addLabelGroupBlock,
  makeTableBlock,
  insertBeforeBottomGap,
  insertAfterSelected,
  showNoSelectionHint,
  showToast,
  getSectionAlign,
  addTextBlock,
  groupSelectedBlocks,
  addRowBlock,
  makePresetRow,
  addPresetRow,
  addAssetBlock,
  addGapBlock,
  addIconCircleBlock,
  addTableBlock,
  makeCardBlock,
  addCardBlock,
  makeStripBannerBlock,
  addStripBannerBlock,
  renderGraph,
  makeGraphBlock,
  addGraphBlock,
  makeDividerBlock,
  addDividerBlock,
  applyDividerStyle,
  addSection,
};

// Backward compat
window.genId = genId;
window.getDragAfterElement = getDragAfterElement;
window.clearDropIndicators = clearDropIndicators;
window.clearLayerIndicators = clearLayerIndicators;
window.clearSectionIndicators = clearSectionIndicators;
window.clearLayerSectionIndicators = clearLayerSectionIndicators;
window.getSectionDragAfterEl = getSectionDragAfterEl;
window.getLayerSectionDragAfterEl = getLayerSectionDragAfterEl;
window.getLayerDragAfterItem = getLayerDragAfterItem;
window.ungroupBlock = ungroupBlock;
window.bindGroupDrag = bindGroupDrag;
window.bindSectionDrag = bindSectionDrag;
window.bindSectionDropZone = bindSectionDropZone;
window.bindBlock = bindBlock;
window.makeTextBlock = makeTextBlock;
window.makeAssetBlock = makeAssetBlock;
window.makeGapBlock = makeGapBlock;
window.makeIconCircleBlock = makeIconCircleBlock;
window.makeLabelItem = makeLabelItem;
window.makeLabelGroupBlock = makeLabelGroupBlock;
window.addLabelGroupBlock = addLabelGroupBlock;
window.makeTableBlock = makeTableBlock;
window.insertBeforeBottomGap = insertBeforeBottomGap;
window.insertAfterSelected = insertAfterSelected;
window.showNoSelectionHint = showNoSelectionHint;
window.showToast = showToast;
window.getSectionAlign = getSectionAlign;
window.addTextBlock = addTextBlock;
window.groupSelectedBlocks = groupSelectedBlocks;
window.addRowBlock = addRowBlock;
window.makePresetRow = makePresetRow;
window.addPresetRow = addPresetRow;
window.addAssetBlock = addAssetBlock;
window.addGapBlock = addGapBlock;
window.addIconCircleBlock = addIconCircleBlock;
window.addTableBlock = addTableBlock;
window.makeCardBlock = makeCardBlock;
window.addCardBlock = addCardBlock;
window.makeStripBannerBlock = makeStripBannerBlock;
window.addStripBannerBlock = addStripBannerBlock;
window.renderGraph = renderGraph;
window.makeGraphBlock = makeGraphBlock;
window.addGraphBlock = addGraphBlock;
window.makeDividerBlock = makeDividerBlock;
window.addDividerBlock = addDividerBlock;
window.applyDividerStyle = applyDividerStyle;
window.addSection = addSection;

/* ═══════════════════════════════════
   LAYER PANEL
   makeLayer* 렌더러는 layer-panel-items.js로 분리 (2025-03-31)
═══════════════════════════════════ */
import { makeIndents, layerIcons, addLayerRename, makeLayerBlockItem, makeLayerGroupItem,
         makeLayerSubSectionItem, makeLayerAssetItem, makeLayerCardItem, makeLayerColItem,
         makeLayerRowGroup } from './layer-panel-items.js';

export function buildLayerPanel() {
  const panel = document.getElementById('layer-panel-body');

  // 재빌드 전 collapsed 상태 저장
  const collapsedSections = new Set(
    [...panel.querySelectorAll('.layer-section.collapsed')].map(s => s.dataset.section)
  );
  const collapsedRows = new Set();
  panel.querySelectorAll('.layer-section').forEach(s => {
    s.querySelectorAll('.layer-children > .layer-row-group').forEach((g, ri) => {
      if (g.classList.contains('collapsed')) collapsedRows.add(`${s.dataset.section}:${ri}`);
    });
  });

  panel.innerHTML = '';

  document.querySelectorAll('.section-block').forEach((sec, si) => {
    const sIdx = si + 1;
    const sectionEl = document.createElement('div');
    sectionEl.className = 'layer-section';
    sectionEl.dataset.section = sIdx;
    if (sec.id) sectionEl.dataset.secId = sec.id;
    sec._layerSectionEl = sectionEl;

    const header = document.createElement('div');
    header.className = 'layer-section-header';

    const chevron = document.createElement('div');
    chevron.innerHTML = `<svg class="layer-chevron" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>${layerIcons.section}`;
    chevron.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';

    const nameEl = document.createElement('span');
    nameEl.className = 'layer-section-name';
    nameEl.textContent = sec._name || 'Section';

    // 눈 아이콘 (섹션 숨김 토글)
    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'layer-eye-btn';
    const isHidden = sec.dataset.hidden === '1';
    eyeBtn.innerHTML = isHidden
      ? `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><line x1="2" y1="2" x2="12" y2="12"/></svg>`
      : `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.8"/></svg>`;
    eyeBtn.title = isHidden ? '섹션 표시' : '섹션 숨기기';
    if (isHidden) { sec.style.visibility = 'hidden'; sec.style.opacity = '0'; sectionEl.classList.add('layer-section-hidden'); sectionEl.classList.add('collapsed'); }

    header.appendChild(chevron);
    header.appendChild(nameEl);
    header.appendChild(eyeBtn);

    eyeBtn.addEventListener('click', e => {
      e.stopPropagation();
      const hidden = sec.dataset.hidden === '1';
      if (hidden) {
        sec.dataset.hidden = '0';
        sec.style.visibility = ''; sec.style.opacity = '';
        eyeBtn.innerHTML = `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.8"/></svg>`;
        eyeBtn.title = '섹션 숨기기';
        sectionEl.classList.remove('layer-section-hidden');
        sectionEl.classList.remove('collapsed');
      } else {
        sec.dataset.hidden = '1';
        sec.style.visibility = 'hidden'; sec.style.opacity = '0';
        eyeBtn.innerHTML = `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><line x1="2" y1="2" x2="12" y2="12"/></svg>`;
        eyeBtn.title = '섹션 표시';
        sectionEl.classList.add('layer-section-hidden');
        sectionEl.classList.add('collapsed');
      }
    });

    header.addEventListener('click', (e) => {
      if (e.shiftKey) {
        const panel = document.getElementById('layer-panel-body');
        const allSectionEls = [...document.querySelectorAll('#canvas .section-block')];
        const targetIdx = allSectionEls.indexOf(sec);

        const activeHeader = panel.querySelector('.layer-section-header.active');
        const anchorLayerSection = activeHeader ? activeHeader.closest('.layer-section') : null;
        const anchorIdx = anchorLayerSection
          ? parseInt(anchorLayerSection.dataset.section, 10) - 1
          : -1;

        if (anchorIdx === -1 || targetIdx === -1) {
          selectSection(sec, true);
          return;
        }

        const [from, to] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];

        // 범위 내 모든 섹션 선택
        allSectionEls.forEach(s => s.classList.remove('selected'));
        panel.querySelectorAll('.layer-section-header').forEach(h => h.classList.remove('active'));

        const allLayerSections = [...panel.querySelectorAll('.layer-section')];
        for (let i = from; i <= to; i++) {
          if (allSectionEls[i]) allSectionEls[i].classList.add('selected');
          if (allLayerSections[i]) {
            allLayerSections[i].querySelector('.layer-section-header')?.classList.add('active');
          }
        }
      } else {
        selectSection(sec, true);
      }
    });
    chevron.addEventListener('click', e => {
      e.stopPropagation();
      sectionEl.classList.toggle('collapsed');
    });
    nameEl.addEventListener('click', e => { e.stopPropagation(); selectSection(sec, true); });
    nameEl.addEventListener('dblclick', e => {
      e.stopPropagation();
      nameEl.contentEditable = 'true';
      nameEl.classList.add('editing');
      nameEl.focus();
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      const finish = () => {
        nameEl.contentEditable = 'false';
        nameEl.classList.remove('editing');
        const newName = nameEl.textContent.trim() || 'Section';
        nameEl.textContent = newName;
        sec._name = newName;
        const label = sec.querySelector('.section-label');
        if (label) label.textContent = newName;
      };
      const onKeyDown = ev => {
        if (ev.key === 'Enter')  { ev.preventDefault(); nameEl.blur(); }
        if (ev.key === 'Escape') { nameEl.textContent = sec._name || 'Section'; nameEl.blur(); }
      };
      nameEl.addEventListener('keydown', onKeyDown);
      nameEl.addEventListener('blur', () => {
        nameEl.removeEventListener('keydown', onKeyDown);
        finish();
      }, { once: true });
    });

    const children = document.createElement('div');
    children.className = 'layer-children';

    // section-inner 직접 자식 순회 (Row 단위로 처리)
    const sectionInner = sec.querySelector('.section-inner');

    function appendRowToLayer(child, container) {
      const colBlocks = [...child.querySelectorAll(':scope > .col > *')]
        .filter(el => !el.classList.contains('col-placeholder') && !el.classList.contains('drop-indicator'));
      const allCols = [...child.querySelectorAll(':scope > .col')];
      const isMultiCol = allCols.length > 1;
      // flex/grid는 col이 여러 개 → 항상 row group으로 표시
      if (isMultiCol) {
        container.appendChild(makeLayerRowGroup(child, colBlocks, sec));
        return;
      }
      // stack (단일 col): 블록이 없으면 row group, 1개면 블록 직접 표시
      if (colBlocks.length === 0) {
        container.appendChild(makeLayerRowGroup(child, [], sec));
      } else if (colBlocks.length === 1) {
        const block = colBlocks[0];
        if (block.classList.contains('asset-block')) {
          container.appendChild(makeLayerAssetItem(block, child, sec));
        } else if (block.classList.contains('card-block')) {
          container.appendChild(makeLayerCardItem(block, child, sec));
        } else {
          container.appendChild(makeLayerBlockItem(block, child, sec));
        }
      } else {
        // 단일 col에 블록이 여러 개 → Col(Frame)으로 표시 (Grid 아님)
        container.appendChild(makeLayerColItem(allCols[0], 0, sec, 1));
      }
    }

    [...(sectionInner ? sectionInner.children : [])].forEach(child => {
      if (child.classList.contains('gap-block')) {
        children.appendChild(makeLayerBlockItem(child, child, sec, 1));
      } else if (child.classList.contains('row')) {
        appendRowToLayer(child, children);
      } else if (child.classList.contains('group-block')) {
        children.appendChild(makeLayerGroupItem(child, sec, appendRowToLayer));
      } else if (child.classList.contains('sub-section-block')) {
        children.appendChild(makeLayerSubSectionItem(child, sec, appendRowToLayer));
      }
    });

    // 레이어 패널 드롭존 (Row/Gap 단위 재배치)
    // rAF throttle: getLayerDragAfterItem 내 getBoundingClientRect 호출 최적화 (DBG-11)
    let _layerDragRafId = null;
    children.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!window.layerDragSrc) return;
      if (_layerDragRafId) return;
      const clientY = e.clientY;
      _layerDragRafId = requestAnimationFrame(() => {
        _layerDragRafId = null;
        clearLayerIndicators();
        const after = getLayerDragAfterItem(children, clientY);
        const indicator = document.createElement('div');
        indicator.className = 'layer-drop-indicator';
        if (after) children.insertBefore(indicator, after);
        else children.appendChild(indicator);
      });
    });
    children.addEventListener('dragleave', e => {
      if (!children.contains(e.relatedTarget)) clearLayerIndicators();
    });
    children.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!window.layerDragSrc) return;
      const dragTarget = window.layerDragSrc._dragTarget;
      const indicator = children.querySelector('.layer-drop-indicator');

      const insertIntoSec = (domEl) => {
        if (!indicator) { sectionInner.appendChild(domEl); return; }
        const nextEl = indicator.nextElementSibling;
        const nextTarget = nextEl?._dragTarget || null;
        if (nextTarget) {
          sectionInner.insertBefore(domEl, nextTarget);
        } else {
          const bottomGap = [...sectionInner.querySelectorAll(':scope > .gap-block')].at(-1);
          if (bottomGap && bottomGap !== domEl) sectionInner.insertBefore(domEl, bottomGap);
          else sectionInner.appendChild(domEl);
        }
      };

      // Cross-boundary: overlay-tb → section
      if (dragTarget?.classList.contains('overlay-tb')) {
        dragTarget.classList.remove('overlay-tb');
        const rowInOverlay = dragTarget.closest('.asset-overlay > .row');
        if (rowInOverlay) {
          insertIntoSec(rowInOverlay);
        } else {
          // direct overlayEl child: wrap in row
          const newRow = document.createElement('div');
          newRow.className = 'row'; newRow.dataset.layout = 'stack';
          const newCol = document.createElement('div');
          newCol.className = 'col'; newCol.dataset.width = '100';
          newCol.appendChild(dragTarget);
          newRow.appendChild(newCol);
          insertIntoSec(newRow);
        }
        clearLayerIndicators();
        buildLayerPanel();
        window.pushHistory();
        window.layerDragSrc = null;
        return;
      }

      // Cross-boundary: overlay gap-block → section
      if (dragTarget?.classList.contains('gap-block') && dragTarget?.closest('.asset-overlay')) {
        insertIntoSec(dragTarget);
        clearLayerIndicators();
        buildLayerPanel();
        window.pushHistory();
        window.layerDragSrc = null;
        return;
      }

      // 다중선택 이동: shift+클릭으로 선택된 여러 블록 한번에 이동
      if (window.layerMultiDragTargets?.length > 1) {
        const targets = window.layerMultiDragTargets;
        // 삽입 기준점 확정 (이동 대상 중 하나면 skip)
        let refNode = null;
        if (indicator) {
          const nextEl = indicator.nextElementSibling;
          refNode = nextEl?._dragTarget || null;
          if (refNode && targets.includes(refNode)) refNode = null;
        }
        // 현재 DOM 순서 유지하며 정렬
        const sorted = [...targets].sort((a, b) => {
          const pos = a.compareDocumentPosition(b);
          if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
          if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
          return 0;
        });
        sorted.forEach(target => {
          if (refNode && sectionInner.contains(refNode)) sectionInner.insertBefore(target, refNode);
          else sectionInner.appendChild(target);
        });
        clearLayerIndicators();
        buildLayerPanel();
        window.pushHistory();
        window.layerDragSrc = null;
        window.layerMultiDragTargets = null;
        return;
      }

      // Normal: reorder within section
      insertIntoSec(dragTarget);
      clearLayerIndicators();
      buildLayerPanel();
      window.layerDragSrc = null;
      window.layerMultiDragTargets = null;
    });

    sectionEl.appendChild(header);
    sectionEl.appendChild(children);
    panel.appendChild(sectionEl);

    // collapsed 상태 복원
    if (collapsedSections.has(String(sIdx))) sectionEl.classList.add('collapsed');
    children.querySelectorAll(':scope > .layer-row-group').forEach((g, ri) => {
      if (collapsedRows.has(`${sIdx}:${ri}`)) g.classList.add('collapsed');
    });

    sec._layerEl = sectionEl;
    sec._layerHeader = header;
    sectionEl._canvasSec = sec;

    // 섹션 헤더 드래그 (섹션 순서 변경)
    header.setAttribute('draggable', 'true');
    header.addEventListener('dragstart', e => {
      if (nameEl.classList.contains('editing')) { e.preventDefault(); return; }
      e.stopPropagation();
      window.layerSectionDragSrc = { sec, sectionEl };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
      const ghost = document.createElement('div');
      ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => ghost.remove(), 0);
      requestAnimationFrame(() => sectionEl.classList.add('layer-section-dragging'));
    });
    header.addEventListener('dragend', () => {
      sectionEl.classList.remove('layer-section-dragging');
      clearLayerSectionIndicators();
      window.layerSectionDragSrc = null;
    });
  });

  // variation 그룹 포스트 처리: A/B 쌍을 wrapper로 묶기
  const varGroups = new Map();
  document.querySelectorAll('.section-block[data-variation-group]').forEach(sec => {
    const gid = sec.dataset.variationGroup;
    if (!varGroups.has(gid)) varGroups.set(gid, []);
    varGroups.get(gid).push(sec);
  });
  varGroups.forEach((secs, gid) => {
    const firstLayerEl = secs[0]?._layerEl;
    if (!firstLayerEl) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'layer-variation-group';
    wrapper._gid = gid;
    wrapper._secs = secs;
    const groupHeader = document.createElement('div');
    groupHeader.className = 'layer-variation-header';
    const VLABELS = ['A', 'B', 'C', 'D', 'E'];
    const activeV = secs.find(s => s.dataset.variationActive === '1')?.dataset.variation || 'A';
    const activeIdx = VLABELS.indexOf(activeV);
    const nextV = VLABELS[(activeIdx + 1) % secs.length];
    const labelSpan = document.createElement('span');
    labelSpan.textContent = `Variant (${secs.map(s => s.dataset.variation).join('/')})`;
    labelSpan.style.cursor = 'pointer';
    labelSpan.title = '활성 베리에이션 선택';
    labelSpan.addEventListener('click', e => {
      e.stopPropagation();
      const active = secs.find(s => s.dataset.variationActive === '1') || secs[0];
      if (active && window.selectSection) window.selectSection(active, true);
    });
    groupHeader.appendChild(labelSpan);
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'layer-variation-toggle';
    toggleBtn.textContent = `▷ ${nextV}`;
    toggleBtn.title = '다음 베리에이션으로 전환';
    toggleBtn.onclick = () => { if (window.toggleVariation) window.toggleVariation(secs[0]); };
    groupHeader.appendChild(toggleBtn);
    const addBtn = document.createElement('button');
    addBtn.className = 'layer-variation-add';
    addBtn.textContent = '+';
    addBtn.title = '베리에이션 추가 (최대 E)';
    addBtn.disabled = secs.length >= 5;
    addBtn.onclick = () => { if (window.addVariation) window.addVariation(secs[0]); };
    groupHeader.appendChild(addBtn);
    const delBtn = document.createElement('button');
    delBtn.className = 'layer-variation-del';
    delBtn.textContent = '×';
    delBtn.title = 'Variant 그룹 전체 삭제';
    delBtn.onclick = e => {
      e.stopPropagation();
      if (window.pushHistory) window.pushHistory();
      secs.forEach(s => s.remove());
      if (window.deselectAll) window.deselectAll();
      if (window.buildLayerPanel) window.buildLayerPanel();
    };
    groupHeader.appendChild(delBtn);
    const resolveBtn = document.createElement('button');
    resolveBtn.className = 'layer-variation-resolve';
    resolveBtn.textContent = '✓ 확정';
    resolveBtn.title = '현재 활성 베리에이션으로 확정 (나머지 삭제)';
    resolveBtn.onclick = e => {
      e.stopPropagation();
      const active = secs.find(s => s.dataset.variationActive === '1') || secs[0];
      if (active && window.resolveVariation) window.resolveVariation(active);
    };
    groupHeader.appendChild(resolveBtn);
    panel.insertBefore(wrapper, firstLayerEl);
    secs.forEach(s => { if (s._layerEl) wrapper.appendChild(s._layerEl); });
    wrapper.insertBefore(groupHeader, wrapper.firstChild);
    secs.forEach(s => {
      if (s._layerEl && s.dataset.variationActive === '0') {
        s._layerEl.classList.add('layer-section-inactive-var');
        s._layerEl.classList.add('collapsed');
      }
    });
  });

  if (window.buildFilePageSection) window.buildFilePageSection();
}

export function syncLayerActive(sec) {
  document.querySelectorAll('.layer-section-header').forEach(h => h.classList.remove('active'));
  document.querySelectorAll('.layer-variation-group').forEach(g => g.classList.remove('active'));
  if (sec && sec._layerHeader) sec._layerHeader.classList.add('active');
  if (sec && sec.dataset.variationGroup) {
    const gid = sec.dataset.variationGroup;
    document.querySelectorAll('.layer-variation-group').forEach(g => {
      if (g._gid === gid) g.classList.add('active');
    });
  }
}

export function highlightBlock(block, layerItem) {
  document.querySelectorAll('.layer-item').forEach(i => { i.classList.remove('active'); i.style.background = ''; });
  if (layerItem) layerItem.classList.add('active');
}

/* 캔버스에서 row 선택 시 레이어 패널 row 헤더 하이라이트 */
export function syncLayerRow(rowEl) {
  document.querySelectorAll('.layer-row-header').forEach(h => h.classList.remove('active'));
  if (!rowEl) return;
  /* wrapper._dragTarget === rowEl 인 wrapper의 첫번째 .layer-row-header */
  const panel = document.getElementById('layer-panel-body');
  if (!panel) return;
  panel.querySelectorAll('.layer-section').forEach(sec => {
    sec.querySelectorAll('.layer-row-wrapper, .layer-row-group').forEach(wrapper => {
      if (wrapper._dragTarget === rowEl) {
        const h = wrapper.querySelector(':scope > .layer-row-header');
        if (h) h.classList.add('active');
      }
    });
  });
}

// Backward compat
window.buildLayerPanel = buildLayerPanel;
window.syncLayerActive = syncLayerActive;
window.syncLayerRow    = syncLayerRow;
window.highlightBlock  = highlightBlock;

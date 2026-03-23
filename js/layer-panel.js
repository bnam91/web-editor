/* ═══════════════════════════════════
   LAYER PANEL
═══════════════════════════════════ */
const layerIcons = {
  section: `<svg class="layer-section-icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="12" height="12" rx="1.5"/></svg>`,
  heading: `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="currentColor"><text x="0" y="10" font-size="10" font-weight="700" font-family="serif">H</text></svg>`,
  body:    `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="11" y2="6"/><line x1="1" y1="9" x2="7" y2="9"/></svg>`,
  caption: `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="4" x2="11" y2="4"/><line x1="1" y1="7" x2="8" y2="7"/></svg>`,
  asset:   `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="10" height="10" rx="1"/><circle cx="4" cy="4" r="1"/><polyline points="11 8 8 5 3 11"/></svg>`,
  gap:     `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="4" x2="11" y2="4" stroke-dasharray="2,1"/><line x1="1" y1="8" x2="11" y2="8" stroke-dasharray="2,1"/></svg>`,
  label:      `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="3" width="10" height="6" rx="1.5"/></svg>`,
  'icon-circle': `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="6" cy="6" r="5"/><text x="3.5" y="9" font-size="6" fill="currentColor" stroke="none">★</text></svg>`,
  table:      `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="10" height="10" rx="1"/><line x1="1" y1="4.5" x2="11" y2="4.5"/><line x1="5" y1="4.5" x2="5" y2="11"/></svg>`,
  divider:    `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="6" x2="11" y2="6"/></svg>`,
  'label-group': `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="3" width="4" height="6" rx="1"/><rect x="7" y="3" width="4" height="6" rx="1"/></svg>`,
  card:       `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="10" height="10" rx="1.5"/><line x1="1" y1="7" x2="11" y2="7"/></svg>`,
  banner:     `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="3" width="4" height="6" rx="0.5"/><line x1="7" y1="5" x2="11" y2="5"/><line x1="7" y1="7" x2="10" y2="7"/></svg>`,
  graph:      `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><polyline points="1,10 4,5 7,7 10,2"/></svg>`,
};

/* 레이어 아이템 생성 (단일 블록용) */
function makeLayerBlockItem(block, dragTarget, sec) {
  const isText       = block.classList.contains('text-block');
  const isGap        = block.classList.contains('gap-block');
  const isIconCb     = block.classList.contains('icon-circle-block');
  const isTable      = block.classList.contains('table-block');
  const isLabelGroup = block.classList.contains('label-group-block');
  const isDivider    = block.classList.contains('divider-block');
  const isCard       = block.classList.contains('card-block');
  const isBanner     = block.classList.contains('strip-banner-block');
  const isGraph      = block.classList.contains('graph-block');
  const type     = isText ? (block.dataset.type || 'body') : isGap ? 'gap' : isIconCb ? 'icon-circle' : isTable ? 'table' : isLabelGroup ? 'label-group' : isDivider ? 'divider' : isCard ? 'card' : isBanner ? 'banner' : isGraph ? 'graph' : 'asset';
  const labels    = { heading:'Heading', body:'Body', caption:'Caption', label:'Label', asset:'Asset', gap:'Gap', 'icon-circle':'Icon Circle', table:'Table', 'label-group':'Tags', divider:'Divider', card:'Card', banner:'Strip Banner', graph:'Graph' };
  const typeLbls  = { heading:'Text',    body:'Text',  caption:'Text',   label:'Label', asset:'Image', gap:'Gap', 'icon-circle':'Component', table:'Component', 'label-group':'Tags', divider:'Divider', card:'Component', banner:'Component', graph:'Component' };

  const item = document.createElement('div');
  item.className = 'layer-item';
  item.innerHTML = `${layerIcons[type] || layerIcons.body}<span class="layer-item-name">${labels[type] || type}</span><span class="layer-item-type">${typeLbls[type] || 'Text'}</span>`;
  item._dragTarget = dragTarget;

  item.addEventListener('click', e => {
    e.stopPropagation();
    if (e.shiftKey) {
      // Shift+클릭: 다중선택 토글
      if (block.classList.contains('selected')) {
        block.classList.remove('selected');
        item.classList.remove('active');
      } else {
        block.classList.add('selected');
        item.classList.add('active');
      }
      syncSection(sec);
    } else {
      deselectAll();
      block.classList.add('selected');
      syncSection(sec);
      highlightBlock(block, item);
      if (isText) showTextProperties(block);
      else if (isGap) showGapProperties(block);
      else if (isIconCb) showIconCircleProperties(block);
      else if (isTable) showTableProperties(block);
      else if (isCard) showCardProperties(block);
      else if (isBanner) showStripBannerProperties(block);
      else showAssetProperties(block);
    }
  });
  block.addEventListener('mouseenter', () => item.style.background = '#252525');
  block.addEventListener('mouseleave', () => { if (!item.classList.contains('active')) item.style.background = ''; });

  item.setAttribute('draggable', 'true');
  item.addEventListener('dragstart', e => {
    e.stopPropagation();
    layerDragSrc = item;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => item.classList.add('layer-dragging'));
  });
  item.addEventListener('dragend', () => {
    item.classList.remove('layer-dragging');
    clearLayerIndicators();
    layerDragSrc = null;
  });

  block._layerItem = item;
  return item;
}

/* 레이어 Group 아이템 생성 (group-block용) */
function makeLayerGroupItem(groupEl, sec, appendRowFn) {
  const wrapper = document.createElement('div');
  wrapper.className = 'layer-row-group';
  wrapper._dragTarget = groupEl;

  const header = document.createElement('div');
  header.className = 'layer-row-header';
  const name = groupEl.dataset.name || 'Group';
  header.innerHTML = `
    <svg class="layer-chevron" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
    <svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
      <rect x="1" y="1" width="10" height="10" rx="1.5"/>
      <line x1="3" y1="4" x2="9" y2="4"/><line x1="3" y1="6.5" x2="7" y2="6.5"/><line x1="3" y1="9" x2="8" y2="9"/>
    </svg>
    <span class="layer-item-name">${name}</span>
    <span class="layer-item-type">Group</span>
    <button class="layer-ungroup-btn" title="그룹 해제">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="1" width="3.5" height="3.5" rx="0.5"/>
        <rect x="5.5" y="1" width="3.5" height="3.5" rx="0.5"/>
        <rect x="1" y="5.5" width="3.5" height="3.5" rx="0.5"/>
        <rect x="5.5" y="5.5" width="3.5" height="3.5" rx="0.5"/>
      </svg>
    </button>`;

  header.addEventListener('click', e => {
    if (e.target.closest('.layer-chevron')) { wrapper.classList.toggle('collapsed'); return; }
    if (e.target.closest('.layer-ungroup-btn')) {
      ungroupBlock(groupEl);
      return;
    }
    // 그룹 선택 — 캔버스 그룹 강조 + 섹션 선택
    deselectAll();
    groupEl.classList.add('group-selected');
    const sec = groupEl.closest('.section-block');
    if (sec) selectSection(sec);
    document.querySelectorAll('.layer-row-group').forEach(g => g.classList.remove('active'));
    wrapper.classList.add('active');
  });

  const groupChildren = document.createElement('div');
  groupChildren.className = 'layer-row-children';

  const groupInner = groupEl.querySelector('.group-inner');
  if (groupInner) {
    [...groupInner.children].forEach(child => {
      if (child.classList.contains('row')) appendRowFn(child, groupChildren);
      else if (child.classList.contains('gap-block')) groupChildren.appendChild(makeLayerBlockItem(child, child, sec));
    });
  }

  wrapper.appendChild(header);
  wrapper.appendChild(groupChildren);
  return wrapper;
}

/* 에셋 블록 + overlay-tb 자식 포함 레이어 아이템 */
function makeLayerAssetItem(block, dragTarget, sec) {
  const overlayEl = block.querySelector('.asset-overlay');
  const overlayTbs = overlayEl ? [...overlayEl.querySelectorAll('.overlay-tb')] : [];
  if (overlayTbs.length === 0) return makeLayerBlockItem(block, dragTarget, sec);

  const wrapper = document.createElement('div');
  wrapper.className = 'layer-row-group';
  wrapper._dragTarget = dragTarget;

  const header = document.createElement('div');
  header.className = 'layer-row-header';
  header.innerHTML = `
    <svg class="layer-chevron" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
    ${layerIcons.asset}
    <span class="layer-item-name">Asset</span>
    <span class="layer-item-type">Image + Overlay</span>`;

  header.addEventListener('click', e => {
    if (e.target.closest('.layer-chevron')) { wrapper.classList.toggle('collapsed'); return; }
    deselectAll();
    block.classList.add('selected');
    syncSection(sec);
    highlightBlock(block, header);
    showAssetProperties(block);
  });
  block._layerItem = header;

  header.setAttribute('draggable', 'true');
  header.addEventListener('dragstart', e => {
    e.stopPropagation();
    layerDragSrc = wrapper;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => wrapper.classList.add('layer-dragging'));
  });
  header.addEventListener('dragend', () => {
    wrapper.classList.remove('layer-dragging');
    clearLayerIndicators();
    layerDragSrc = null;
  });

  const children = document.createElement('div');
  children.className = 'layer-row-children';

  const buildOverlayChildren = () => {
    children.innerHTML = '';
    [...overlayEl.querySelectorAll('.overlay-tb')].forEach(tb => {
      const tbType = tb.dataset.type || 'body';
      const item = document.createElement('div');
      item.className = 'layer-item layer-item-nested';
      item.innerHTML = `${layerIcons[tbType] || layerIcons.body}<span class="layer-item-name">${tbType === 'heading' ? 'Overlay H' : 'Overlay Text'}</span><span class="layer-item-type">Overlay</span>`;
      item._dragTarget = tb;

      item.addEventListener('click', e => {
        e.stopPropagation();
        deselectAll();
        tb.classList.add('selected');
        syncSection(sec);
        highlightBlock(tb, item);
        showTextProperties(tb);
      });
      tb._layerItem = item;

      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', e => {
        e.stopPropagation();
        layerDragSrc = item;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
        requestAnimationFrame(() => item.classList.add('layer-dragging'));
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('layer-dragging');
        clearLayerIndicators();
        layerDragSrc = null;
      });
      children.appendChild(item);
    });
  };
  buildOverlayChildren();

  // overlay-tb 순서 변경 드롭존
  children.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
    if (!layerDragSrc?._dragTarget?.classList.contains('overlay-tb')) return;
    clearLayerIndicators();
    const after = getLayerDragAfterItem(children, e.clientY);
    const indicator = document.createElement('div');
    indicator.className = 'layer-drop-indicator';
    if (after) children.insertBefore(indicator, after);
    else children.appendChild(indicator);
  });
  children.addEventListener('dragleave', e => {
    if (!children.contains(e.relatedTarget)) clearLayerIndicators();
  });
  children.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    if (!layerDragSrc?._dragTarget?.classList.contains('overlay-tb')) return;
    const tbEl = layerDragSrc._dragTarget;
    const indicator = children.querySelector('.layer-drop-indicator');
    if (indicator) {
      const nextItem = indicator.nextElementSibling;
      const nextTb = nextItem?._dragTarget || null;
      if (nextTb) overlayEl.insertBefore(tbEl, nextTb);
      else overlayEl.appendChild(tbEl);
    }
    clearLayerIndicators();
    buildLayerPanel();
    pushHistory();
    layerDragSrc = null;
  });

  wrapper.appendChild(header);
  wrapper.appendChild(children);
  return wrapper;
}

/* 레이어 Row 그룹 생성 (멀티컬럼용) */
function makeLayerRowGroup(rowEl, blocks, sec) {
  const ratioStr = rowEl.dataset.ratioStr || `${blocks.length}*1`;
  const group = document.createElement('div');
  group.className = 'layer-row-group';
  group._dragTarget = rowEl;

  const header = document.createElement('div');
  header.className = 'layer-row-header';
  header.innerHTML = `
    <svg class="layer-chevron" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
    <svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
      <rect x="1" y="1" width="4" height="10" rx="0.5"/><rect x="7" y="1" width="4" height="10" rx="0.5"/>
    </svg>
    <span class="layer-item-name">Row</span>
    <span class="layer-item-type">${ratioStr}</span>`;

  const groupChildren = document.createElement('div');
  groupChildren.className = 'layer-row-children';

  blocks.forEach(block => {
    const isText       = block.classList.contains('text-block');
    const isGap        = block.classList.contains('gap-block');
    const isIconCb     = block.classList.contains('icon-circle-block');
    const isTable      = block.classList.contains('table-block');
    const isLabelGroup = block.classList.contains('label-group-block');
    const isDivider    = block.classList.contains('divider-block');
    const isCard       = block.classList.contains('card-block');
    const isBanner     = block.classList.contains('strip-banner-block');
    const isGraph      = block.classList.contains('graph-block');
    const type     = isText ? (block.dataset.type || 'body') : isGap ? 'gap' : isIconCb ? 'icon-circle' : isTable ? 'table' : isLabelGroup ? 'label-group' : isDivider ? 'divider' : isCard ? 'card' : isBanner ? 'banner' : isGraph ? 'graph' : 'asset';
    const labels    = { heading:'Heading', body:'Body', caption:'Caption', label:'Label', asset:'Asset', gap:'Gap', 'icon-circle':'Icon Circle', table:'Table', 'label-group':'Tags', divider:'Divider', card:'Card', banner:'Strip Banner', graph:'Graph' };
    const typeLbls  = { heading:'Text',    body:'Text',  caption:'Text',   label:'Label', asset:'Image', gap:'Gap', 'icon-circle':'Component', table:'Component', 'label-group':'Tags', divider:'Divider', card:'Component', banner:'Component', graph:'Component' };

    const item = document.createElement('div');
    item.className = 'layer-item layer-item-nested';
    item.innerHTML = `${layerIcons[type]}<span class="layer-item-name">${labels[type]}</span><span class="layer-item-type">${typeLbls[type]}</span>`;

    item.addEventListener('click', e => {
      e.stopPropagation();
      if (e.shiftKey) {
        if (block.classList.contains('selected')) {
          block.classList.remove('selected');
          item.classList.remove('active');
        } else {
          block.classList.add('selected');
          item.classList.add('active');
        }
        syncSection(sec);
      } else {
        deselectAll();
        block.classList.add('selected');
        syncSection(sec);
        highlightBlock(block, item);
        if (isText) showTextProperties(block);
        else if (isGap) showGapProperties(block);
        else if (isIconCb) showIconCircleProperties(block);
        else if (isTable) showTableProperties(block);
        else if (isCard) showCardProperties(block);
        else if (isBanner) showStripBannerProperties(block);
        else showAssetProperties(block);
      }
    });
    block.addEventListener('mouseenter', () => item.style.background = '#252525');
    block.addEventListener('mouseleave', () => { if (!item.classList.contains('active')) item.style.background = ''; });

    block._layerItem = item;
    groupChildren.appendChild(item);
  });

  header.addEventListener('click', e => {
    // chevron 클릭이면 토글만
    if (e.target.closest('.layer-chevron')) { group.classList.toggle('collapsed'); return; }
    // Row 헤더 클릭 → 하위 블록 전체 선택 + Properties 표시
    deselectAll();
    blocks.forEach(block => block.classList.add('selected'));
    syncSection(sec);
    // 레이어 하위 아이템 모두 하이라이트
    groupChildren.querySelectorAll('.layer-item').forEach(it => it.classList.add('active'));
    header.classList.add('active');
    showRowProperties(rowEl);
  });

  // Row 그룹 드래그 (섹션 내 Row 순서 변경)
  header.setAttribute('draggable', 'true');
  header.addEventListener('dragstart', e => {
    e.stopPropagation();
    layerDragSrc = group;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => group.classList.add('layer-dragging'));
  });
  header.addEventListener('dragend', () => {
    group.classList.remove('layer-dragging');
    clearLayerIndicators();
    layerDragSrc = null;
  });

  group.appendChild(header);
  group.appendChild(groupChildren);
  return group;
}

function buildLayerPanel() {
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
    if (isHidden) { sec.style.visibility = 'hidden'; sec.style.opacity = '0'; sectionEl.classList.add('layer-section-hidden'); }

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
      } else {
        sec.dataset.hidden = '1';
        sec.style.visibility = 'hidden'; sec.style.opacity = '0';
        eyeBtn.innerHTML = `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><line x1="2" y1="2" x2="12" y2="12"/></svg>`;
        eyeBtn.title = '섹션 표시';
        sectionEl.classList.add('layer-section-hidden');
      }
    });

    chevron.addEventListener('click', () => {
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
      nameEl.addEventListener('blur', finish, { once: true });
      nameEl.addEventListener('keydown', ev => {
        if (ev.key === 'Enter')  { ev.preventDefault(); nameEl.blur(); }
        if (ev.key === 'Escape') { nameEl.textContent = sec._name || 'Section'; nameEl.blur(); }
      });
    });

    const children = document.createElement('div');
    children.className = 'layer-children';

    // section-inner 직접 자식 순회 (Row 단위로 처리)
    const sectionInner = sec.querySelector('.section-inner');

    function appendRowToLayer(child, container) {
      const colBlocks = [...child.querySelectorAll(':scope > .col > *')]
        .filter(el => !el.classList.contains('col-placeholder'));
      const allCols = [...child.querySelectorAll(':scope > .col')];
      const hasPlaceholderOnly = colBlocks.length === 0 && allCols.length > 0;
      if (hasPlaceholderOnly) {
        container.appendChild(makeLayerRowGroup(child, [], sec));
      } else if (colBlocks.length <= 1) {
        const block = colBlocks[0];
        if (block) {
          if (block.classList.contains('asset-block')) {
            container.appendChild(makeLayerAssetItem(block, child, sec));
          } else {
            container.appendChild(makeLayerBlockItem(block, child, sec));
          }
        }
      } else {
        container.appendChild(makeLayerRowGroup(child, colBlocks, sec));
      }
    }

    [...sectionInner.children].forEach(child => {
      if (child.classList.contains('gap-block')) {
        children.appendChild(makeLayerBlockItem(child, child, sec));
      } else if (child.classList.contains('row')) {
        appendRowToLayer(child, children);
      } else if (child.classList.contains('group-block')) {
        children.appendChild(makeLayerGroupItem(child, sec, appendRowToLayer));
      }
    });

    // 레이어 패널 드롭존 (Row/Gap 단위 재배치)
    children.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!layerDragSrc) return;
      clearLayerIndicators();
      const after = getLayerDragAfterItem(children, e.clientY);
      const indicator = document.createElement('div');
      indicator.className = 'layer-drop-indicator';
      if (after) children.insertBefore(indicator, after);
      else children.appendChild(indicator);
    });
    children.addEventListener('dragleave', e => {
      if (!children.contains(e.relatedTarget)) clearLayerIndicators();
    });
    children.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!layerDragSrc) return;
      const dragTarget = layerDragSrc._dragTarget;
      const indicator = children.querySelector('.layer-drop-indicator');
      if (indicator) {
        const nextEl = indicator.nextElementSibling;
        const nextTarget = nextEl?._dragTarget || null;
        if (nextTarget) {
          sectionInner.insertBefore(dragTarget, nextTarget);
        } else {
          const bottomGap = [...sectionInner.querySelectorAll(':scope > .gap-block')].at(-1);
          if (bottomGap && bottomGap !== dragTarget) sectionInner.insertBefore(dragTarget, bottomGap);
          else sectionInner.appendChild(dragTarget);
        }
      }
      clearLayerIndicators();
      buildLayerPanel();
      layerDragSrc = null;
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
      layerSectionDragSrc = { sec, sectionEl };
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
      layerSectionDragSrc = null;
    });
  });

  buildFilePageSection();
}

function syncLayerActive(sec) {
  document.querySelectorAll('.layer-section-header').forEach(h => h.classList.remove('active'));
  if (sec && sec._layerHeader) sec._layerHeader.classList.add('active');
}

function highlightBlock(block, layerItem) {
  document.querySelectorAll('.layer-item').forEach(i => { i.classList.remove('active'); i.style.background = ''; });
  if (layerItem) layerItem.classList.add('active');
}

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

/* 레이어 아이템 이름 더블클릭 인라인 편집 헬퍼 */
function addLayerRename(nameSpan, targetEl, fallbackName, datasetKey = 'layerName') {
  nameSpan.addEventListener('dblclick', e => {
    e.stopPropagation();
    const orig = nameSpan.textContent;
    nameSpan.contentEditable = 'true';
    nameSpan.classList.add('editing');
    nameSpan.focus();
    const range = document.createRange();
    range.selectNodeContents(nameSpan);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    const finish = () => {
      nameSpan.contentEditable = 'false';
      nameSpan.classList.remove('editing');
      const newName = nameSpan.textContent.trim() || fallbackName;
      nameSpan.textContent = newName;
      if (newName !== fallbackName) {
        targetEl.dataset[datasetKey] = newName;
      } else {
        delete targetEl.dataset[datasetKey];
      }
    };
    nameSpan.addEventListener('blur', finish, { once: true });
    nameSpan.addEventListener('keydown', ev => {
      if (ev.key === 'Enter')  { ev.preventDefault(); nameSpan.blur(); }
      if (ev.key === 'Escape') { nameSpan.textContent = orig; nameSpan.blur(); }
    }, { once: true });
  });
}

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
  const labels    = { heading:'Heading', body:'Body', caption:'Caption', label:'Label', asset:'Asset', gap:'Gap', 'icon-circle':'Icon Circle', table:'Table', 'label-group':'Tags', divider:'Divider', card:'Card', banner:'Banner', graph:'Graph' };
  const typeLbls  = { heading:'Text',    body:'Text',  caption:'Text',   label:'Label', asset:'Image', gap:'Gap', 'icon-circle':'Component', table:'Component', 'label-group':'Tags', divider:'Divider', card:'Component', banner:'Component', graph:'Component' };

  const item = document.createElement('div');
  item.className = 'layer-item';
  const displayName = block.dataset.layerName || labels[type] || type;
  item.innerHTML = `${layerIcons[type] || layerIcons.body}<span class="layer-item-name">${displayName}</span><span class="layer-item-type">${typeLbls[type] || 'Text'}</span>`;
  item._dragTarget = dragTarget;
  addLayerRename(item.querySelector('.layer-item-name'), block, labels[type] || type);

  item.addEventListener('click', e => {
    e.stopPropagation();
    if (e.target.classList.contains('editing')) return;
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
      window.deselectAll();
      block.classList.add('selected');
      syncSection(sec);
      highlightBlock(block, item);
      if (isText) window.showTextProperties(block);
      else if (isGap) showGapProperties(block);
      else if (isIconCb) showIconCircleProperties(block);
      else if (isTable) showTableProperties(block);
      else if (isCard) showCardProperties(block);
      else if (isBanner) showStripBannerProperties(block);
      else window.showAssetProperties(block);
    }
  });
  block.addEventListener('mouseenter', () => item.style.background = '#252525');
  block.addEventListener('mouseleave', () => { if (!item.classList.contains('active')) item.style.background = ''; });

  item.setAttribute('draggable', 'true');
  item.addEventListener('dragstart', e => {
    e.stopPropagation();
    window.layerDragSrc = item;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => item.classList.add('layer-dragging'));
  });
  item.addEventListener('dragend', () => {
    item.classList.remove('layer-dragging');
    clearLayerIndicators();
    window.layerDragSrc = null;
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
  addLayerRename(header.querySelector('.layer-item-name'), groupEl, 'Group', 'name');

  header.addEventListener('click', e => {
    if (e.target.closest('.layer-chevron')) { wrapper.classList.toggle('collapsed'); return; }
    if (e.target.closest('.layer-ungroup-btn')) {
      ungroupBlock(groupEl);
      return;
    }
    // 그룹 선택 — 캔버스 그룹 강조 + 섹션 선택
    window.deselectAll();
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
    <span class="layer-item-name">${block.dataset.layerName || 'Asset'}</span>
    <span class="layer-item-type">Image + Overlay</span>`;
  addLayerRename(header.querySelector('.layer-item-name'), block, 'Asset');

  header.addEventListener('click', e => {
    if (e.target.closest('.layer-chevron')) { wrapper.classList.toggle('collapsed'); return; }
    window.deselectAll();
    block.classList.add('selected');
    syncSection(sec);
    highlightBlock(block, header);
    window.showAssetProperties(block);
  });
  block._layerItem = header;

  header.setAttribute('draggable', 'true');
  header.addEventListener('dragstart', e => {
    e.stopPropagation();
    window.layerDragSrc = wrapper;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => wrapper.classList.add('layer-dragging'));
  });
  header.addEventListener('dragend', () => {
    wrapper.classList.remove('layer-dragging');
    clearLayerIndicators();
    window.layerDragSrc = null;
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
        window.deselectAll();
        tb.classList.add('selected');
        syncSection(sec);
        highlightBlock(tb, item);
        window.showTextProperties(tb);
      });
      tb._layerItem = item;

      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', e => {
        e.stopPropagation();
        window.layerDragSrc = item;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
        requestAnimationFrame(() => item.classList.add('layer-dragging'));
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('layer-dragging');
        clearLayerIndicators();
        window.layerDragSrc = null;
      });
      children.appendChild(item);
    });
  };
  buildOverlayChildren();

  // overlay-tb 순서 변경 드롭존
  children.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.layerDragSrc?._dragTarget?.classList.contains('overlay-tb')) return;
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
    if (!window.layerDragSrc?._dragTarget?.classList.contains('overlay-tb')) return;
    const tbEl = window.layerDragSrc._dragTarget;
    const indicator = children.querySelector('.layer-drop-indicator');
    if (indicator) {
      const nextItem = indicator.nextElementSibling;
      const nextTb = nextItem?._dragTarget || null;
      if (nextTb) overlayEl.insertBefore(tbEl, nextTb);
      else overlayEl.appendChild(tbEl);
    }
    clearLayerIndicators();
    buildLayerPanel();
    window.pushHistory();
    window.layerDragSrc = null;
  });

  wrapper.appendChild(header);
  wrapper.appendChild(children);
  return wrapper;
}

/* 카드 블록 + 하위 이미지/제목/설명 자식 포함 레이어 아이템 */
function makeLayerCardItem(block, dragTarget, sec) {
  const wrapper = document.createElement('div');
  wrapper.className = 'layer-row-group';
  wrapper._dragTarget = dragTarget;

  const header = document.createElement('div');
  header.className = 'layer-row-header';
  header.innerHTML = `
    <svg class="layer-chevron" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
    ${layerIcons.card}
    <span class="layer-item-name">${block.dataset.layerName || 'Card'}</span>
    <span class="layer-item-type">Component</span>`;
  addLayerRename(header.querySelector('.layer-item-name'), block, 'Card');

  header.addEventListener('click', e => {
    if (e.target.closest('.layer-chevron')) { wrapper.classList.toggle('collapsed'); return; }
    window.deselectAll();
    block.classList.add('selected');
    syncSection(sec);
    highlightBlock(block, header);
    showCardProperties(block);
  });
  block._layerItem = header;

  header.setAttribute('draggable', 'true');
  header.addEventListener('dragstart', e => {
    e.stopPropagation();
    window.layerDragSrc = wrapper;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => wrapper.classList.add('layer-dragging'));
  });
  header.addEventListener('dragend', () => {
    wrapper.classList.remove('layer-dragging');
    clearLayerIndicators();
    window.layerDragSrc = null;
  });

  const children = document.createElement('div');
  children.className = 'layer-row-children';

  const selectCard = e => {
    e.stopPropagation();
    window.deselectAll();
    block.classList.add('selected');
    syncSection(sec);
    highlightBlock(block, header);
    showCardProperties(block);
  };

  const imgEl = block.querySelector('.cdb-image');
  if (imgEl) {
    const imgItem = document.createElement('div');
    imgItem.className = 'layer-item layer-item-nested';
    imgItem.innerHTML = `${layerIcons.asset}<span class="layer-item-name">Image</span><span class="layer-item-type">Image</span>`;
    imgItem.addEventListener('click', selectCard);
    children.appendChild(imgItem);
  }
  const titleEl = block.querySelector('.cdb-title');
  if (titleEl) {
    const item = document.createElement('div');
    item.className = 'layer-item layer-item-nested';
    item.innerHTML = `${layerIcons.heading}<span class="layer-item-name">Title</span><span class="layer-item-type">Text</span>`;
    item.addEventListener('click', selectCard);
    children.appendChild(item);
  }
  const descEl = block.querySelector('.cdb-desc');
  if (descEl) {
    const item = document.createElement('div');
    item.className = 'layer-item layer-item-nested';
    item.innerHTML = `${layerIcons.body}<span class="layer-item-name">Description</span><span class="layer-item-type">Text</span>`;
    item.addEventListener('click', selectCard);
    children.appendChild(item);
  }

  wrapper.appendChild(header);
  wrapper.appendChild(children);
  return wrapper;
}

/* 배너 블록 + 하위 텍스트/갭 자식 포함 레이어 아이템 */
function makeLayerBannerItem(block, dragTarget, sec) {
  const wrapper = document.createElement('div');
  wrapper.className = 'layer-row-group';
  wrapper._dragTarget = dragTarget;

  const header = document.createElement('div');
  header.className = 'layer-row-header';
  header.innerHTML = `
    <svg class="layer-chevron" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
    ${layerIcons.banner}
    <span class="layer-item-name">${block.dataset.layerName || 'Banner'}</span>
    <span class="layer-item-type">Component</span>`;
  addLayerRename(header.querySelector('.layer-item-name'), block, 'Banner');

  header.addEventListener('click', e => {
    if (e.target.closest('.layer-chevron')) { wrapper.classList.toggle('collapsed'); return; }
    window.deselectAll();
    block.classList.add('selected');
    syncSection(sec);
    highlightBlock(block, header);
    showStripBannerProperties(block);
  });
  block._layerItem = header;

  header.setAttribute('draggable', 'true');
  header.addEventListener('dragstart', e => {
    e.stopPropagation();
    window.layerDragSrc = wrapper;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => wrapper.classList.add('layer-dragging'));
  });
  header.addEventListener('dragend', () => {
    wrapper.classList.remove('layer-dragging');
    clearLayerIndicators();
    window.layerDragSrc = null;
  });

  const children = document.createElement('div');
  children.className = 'layer-row-children';

  const buildBannerChildren = () => {
    children.innerHTML = '';

    // 이미지 영역
    const imgEl = block.querySelector('.sbb-image');
    if (imgEl) {
      const imgItem = document.createElement('div');
      imgItem.className = 'layer-item layer-item-nested';
      imgItem.innerHTML = `${layerIcons.asset}<span class="layer-item-name">Image</span><span class="layer-item-type">Image</span>`;
      imgItem.addEventListener('click', e => {
        e.stopPropagation();
        window.deselectAll();
        block.classList.add('selected');
        syncSection(sec);
        highlightBlock(block, header);
        showStripBannerProperties(block);
      });
      children.appendChild(imgItem);
    }

    // sbb-content 하위 자식 (heading, gap, body)
    const sbbContent = block.querySelector('.sbb-content');
    if (sbbContent) {
      [...sbbContent.children].forEach(child => {
        if (child.classList.contains('sbb-row-indicator')) return;
        const isHeading = child.classList.contains('sbb-heading');
        const isBody    = child.classList.contains('sbb-body');
        const isGap     = child.classList.contains('sbb-gap');
        const iconKey   = isHeading ? 'heading' : isBody ? 'body' : 'gap';
        const label     = isHeading ? 'Heading' : isBody ? 'Body' : 'Gap';
        const typeLabel = isHeading ? 'Text' : isBody ? 'Text' : 'Gap';

        const childItem = document.createElement('div');
        childItem.className = 'layer-item layer-item-nested';
        childItem.innerHTML = `${layerIcons[iconKey] || layerIcons.body}<span class="layer-item-name">${label}</span><span class="layer-item-type">${typeLabel}</span>`;
        childItem.addEventListener('click', e => {
          e.stopPropagation();
          window.deselectAll();
          block.classList.add('selected');
          syncSection(sec);
          highlightBlock(block, header);
          // 하위 요소 하이라이트
          block.querySelectorAll('.sbb-focused').forEach(el => el.classList.remove('sbb-focused'));
          child.classList.add('sbb-focused');
          child.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          showStripBannerProperties(block);
        });
        children.appendChild(childItem);
      });
    }
  };
  buildBannerChildren();

  wrapper.appendChild(header);
  wrapper.appendChild(children);
  return wrapper;
}

/* 레이어 Row 그룹 생성 (멀티컬럼용) */
function makeLayerColItem(colEl, colIdx, sec) {
  const colWrapper = document.createElement('div');
  colWrapper.className = 'layer-row-group layer-col-group';
  colWrapper._dragTarget = colEl;

  const colHeader = document.createElement('div');
  colHeader.className = 'layer-row-header layer-col-header';
  colHeader.innerHTML = `
    <svg class="layer-chevron" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
    <svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
      <rect x="1" y="1" width="10" height="10" rx="0.5"/>
    </svg>
    <span class="layer-item-name">Col ${colIdx + 1}</span>
    <span class="layer-item-type">Frame</span>`;

  const colChildren = document.createElement('div');
  colChildren.className = 'layer-row-children';

  const blocks = [...colEl.querySelectorAll(':scope > *')]
    .filter(el => !el.classList.contains('col-placeholder'));

  const labels    = { heading:'Heading', body:'Body', caption:'Caption', label:'Label', asset:'Asset', gap:'Gap', 'icon-circle':'Icon Circle', table:'Table', 'label-group':'Tags', divider:'Divider', card:'Card', banner:'Banner', graph:'Graph' };
  const typeLbls  = { heading:'Text', body:'Text', caption:'Text', label:'Label', asset:'Image', gap:'Gap', 'icon-circle':'Component', table:'Component', 'label-group':'Tags', divider:'Divider', card:'Component', banner:'Component', graph:'Component' };

  blocks.forEach(block => {
    const isText = block.classList.contains('text-block');
    const isGap  = block.classList.contains('gap-block');
    const isIconCb = block.classList.contains('icon-circle-block');
    const isTable  = block.classList.contains('table-block');
    const isLabelGroup = block.classList.contains('label-group-block');
    const isDivider = block.classList.contains('divider-block');
    const isCard  = block.classList.contains('card-block');
    const isBanner = block.classList.contains('strip-banner-block');
    const isGraph  = block.classList.contains('graph-block');
    const type = isText ? (block.dataset.type || 'body') : isGap ? 'gap' : isIconCb ? 'icon-circle' : isTable ? 'table' : isLabelGroup ? 'label-group' : isDivider ? 'divider' : isCard ? 'card' : isBanner ? 'banner' : isGraph ? 'graph' : 'asset';

    if (isBanner) { colChildren.appendChild(makeLayerBannerItem(block, block.closest('.row') || block, sec)); return; }
    if (isCard)   { colChildren.appendChild(makeLayerCardItem(block, block.closest('.row') || block, sec)); return; }

    const item = document.createElement('div');
    item.className = 'layer-item layer-item-nested';
    item.innerHTML = `${layerIcons[type]}<span class="layer-item-name">${labels[type]}</span><span class="layer-item-type">${typeLbls[type]}</span>`;
    item.addEventListener('click', e => {
      e.stopPropagation();
      window.deselectAll();
      block.classList.add('selected');
      // Col/Row도 함께 활성화
      const row = colEl.closest('.row');
      if (row) { row.classList.add('row-active'); }
      colEl.classList.add('col-active');
      // 레이어 패널 row 헤더 하이라이트
      const rowLayerHeader = colWrapper.parentElement?.parentElement?.querySelector(':scope > .layer-row-header');
      if (rowLayerHeader) rowLayerHeader.classList.add('active');
      colHeader.classList.add('active');
      syncSection(sec);
      highlightBlock(block, item);
      if (isText) window.showTextProperties(block);
      else if (isGap) showGapProperties(block);
      else if (isIconCb) showIconCircleProperties(block);
      else if (isTable) showTableProperties(block);
      else window.showAssetProperties(block);
    });
    block._layerItem = item;
    colChildren.appendChild(item);
  });

  colHeader.addEventListener('click', e => {
    if (e.target.closest('.layer-chevron')) { colWrapper.classList.toggle('collapsed'); return; }
    e.stopPropagation();
    window.deselectAll();
    const row = colEl.closest('.row');
    if (row) { row.classList.add('row-active'); }
    colEl.classList.add('col-active');
    // 레이어 패널 row 헤더 하이라이트
    const rowLayerHeader = colWrapper.parentElement?.parentElement?.querySelector(':scope > .layer-row-header');
    if (rowLayerHeader) rowLayerHeader.classList.add('active');
    syncSection(sec);
    colHeader.classList.add('active');
    if (window.showColProperties) window.showColProperties(colEl);
    else if (window.showRowProperties && row) window.showRowProperties(row);
  });

  colWrapper.appendChild(colHeader);
  colWrapper.appendChild(colChildren);
  return colWrapper;
}

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
    <span class="layer-item-name">Grid</span>
    <span class="layer-item-type">${ratioStr}</span>`;

  const groupChildren = document.createElement('div');
  groupChildren.className = 'layer-row-children';

  // Col Frame을 자식으로 표시
  const cols = [...rowEl.querySelectorAll(':scope > .col')];
  cols.forEach((col, i) => {
    groupChildren.appendChild(makeLayerColItem(col, i, sec));
  });

  header.addEventListener('click', e => {
    if (e.target.closest('.layer-chevron')) { group.classList.toggle('collapsed'); return; }
    window.deselectAll();
    blocks.forEach(block => block.classList.add('selected'));
    rowEl.classList.add('row-active');
    syncSection(sec);
    groupChildren.querySelectorAll('.layer-item').forEach(it => it.classList.add('active'));
    header.classList.add('active');
    window.showRowProperties(rowEl);
  });

  // Row 그룹 드래그 (섹션 내 Row 순서 변경)
  header.setAttribute('draggable', 'true');
  header.addEventListener('dragstart', e => {
    e.stopPropagation();
    window.layerDragSrc = group;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => group.classList.add('layer-dragging'));
  });
  header.addEventListener('dragend', () => {
    group.classList.remove('layer-dragging');
    clearLayerIndicators();
    window.layerDragSrc = null;
  });

  group.appendChild(header);
  group.appendChild(groupChildren);
  return group;
}

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

    header.addEventListener('click', () => { selectSection(sec, true); });
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
        } else if (block.classList.contains('strip-banner-block')) {
          container.appendChild(makeLayerBannerItem(block, child, sec));
        } else if (block.classList.contains('card-block')) {
          container.appendChild(makeLayerCardItem(block, child, sec));
        } else {
          container.appendChild(makeLayerBlockItem(block, child, sec));
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
      if (!window.layerDragSrc) return;
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
      if (!window.layerDragSrc) return;
      const dragTarget = window.layerDragSrc._dragTarget;
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
      window.layerDragSrc = null;
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

  buildFilePageSection();
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

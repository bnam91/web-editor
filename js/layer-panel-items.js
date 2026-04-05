/* ══════════════════════════════════════
   LAYER PANEL ITEMS — 레이어 아이템 렌더러
   (layer-panel.js에서 분리, 2025-03-31)

   buildLayerPanel이 사용하는 makeLayer* 렌더러 함수 모음.
   외부 의존성은 모두 window.* 로 접근:
   - window.syncSection, window.selectSection, window.deselectAll
   - window.buildLayerPanel (재귀 재빌드 시 사용)
   - window.highlightBlock, window.clearLayerIndicators, window.getLayerDragAfterItem
   - window.ungroupBlock, window.pushHistory, window.state
   - window.show*Properties, window.layerDragSrc, window.layerMultiDragTargets
══════════════════════════════════════ */

/* ═══════════════════════════════════
   LAYER PANEL
═══════════════════════════════════ */

/* depth 들여쓰기 span 생성 헬퍼 (피그마 스타일) */
function makeIndents(depth) {
  const wrap = document.createElement('span');
  wrap.className = 'layer-indents';
  for (let i = 0; i < depth; i++) {
    const s = document.createElement('span');
    s.className = 'layer-indent';
    wrap.appendChild(s);
  }
  return wrap;
}
const layerIcons = {
  section: `<svg class="layer-section-icon" viewBox="1.5 1.5 13 13" fill="none"><path fill="currentColor" fill-rule="evenodd" d="M5.5 3a.5.5 0 0 1 .5.5V5h4V3.5a.5.5 0 0 1 1 0V5h1.5a.5.5 0 0 1 0 1H11v4h1.5a.5.5 0 0 1 0 1H11v1.5a.5.5 0 0 1-1 0V11H6v1.5a.5.5 0 0 1-1 0V11H3.5a.5.5 0 0 1 0-1H5V6H3.5a.5.5 0 0 1 0-1H5V3.5a.5.5 0 0 1 .5-.5m4.5 7V6H6v4z" clip-rule="evenodd"/></svg>`,
  heading: `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="currentColor"><text x="6" y="10" font-size="10" font-weight="700" font-family="serif" text-anchor="middle">H</text></svg>`,
  body:    `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="11" y2="6"/><line x1="1" y1="9" x2="7" y2="9"/></svg>`,
  caption: `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="4" x2="11" y2="4"/><line x1="1" y1="7" x2="8" y2="7"/></svg>`,
  asset:   `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="2" width="8" height="8" rx="1"/><circle cx="4.5" cy="4.5" r="0.8"/><polyline points="10 8 7.5 5.5 4 9"/></svg>`,
  gap:     `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="4" x2="11" y2="4" stroke-dasharray="2,1"/><line x1="1" y1="8" x2="11" y2="8" stroke-dasharray="2,1"/></svg>`,
  label:      `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="3" width="10" height="6" rx="1.5"/></svg>`,
  'icon-circle': `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="6" cy="6" r="5"/><text x="3.5" y="9" font-size="6" fill="currentColor" stroke="none">★</text></svg>`,
  table:      `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="10" height="10" rx="1"/><line x1="1" y1="4.5" x2="11" y2="4.5"/><line x1="5" y1="4.5" x2="5" y2="11"/></svg>`,
  divider:    `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="6" x2="11" y2="6"/></svg>`,
  'label-group': `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="3" width="4" height="6" rx="1"/><rect x="7" y="3" width="4" height="6" rx="1"/></svg>`,
  card:       `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="10" height="10" rx="1.5"/><line x1="1" y1="7" x2="11" y2="7"/></svg>`,
  banner:     `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="3" width="4" height="6" rx="0.5"/><line x1="7" y1="5" x2="11" y2="5"/><line x1="7" y1="7" x2="10" y2="7"/></svg>`,
  graph:      `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><polyline points="1,10 4,5 7,7 10,2"/></svg>`,
  'icon-text': `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="3" width="4" height="4" rx="0.8"/><line x1="7" y1="4" x2="11" y2="4"/><line x1="7" y1="7" x2="10" y2="7"/></svg>`,
  canvas:     `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="10" height="10" rx="1.5"/><line x1="1" y1="4.5" x2="11" y2="4.5" stroke-dasharray="2 1.5"/><line x1="4.5" y1="4.5" x2="4.5" y2="11" stroke-dasharray="2 1.5"/></svg>`,
  joker:      `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="6" cy="6" r="4.5"/><text x="6" y="9" font-size="7" text-anchor="middle" fill="currentColor" stroke="none">♠</text></svg>`,
  'shape-rectangle': `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="2.5" width="10" height="7" rx="0.5"/></svg>`,
  'shape-ellipse':   `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="6" cy="6" r="5"/></svg>`,
  'shape-line':      `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="6" x2="11" y2="6"/></svg>`,
  'shape-arrow':     `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="6" x2="9" y2="6"/><polyline points="7,3 11,6 7,9"/></svg>`,
  'shape-polygon':   `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="6,1 11,10 1,10"/></svg>`,
  'shape-star':      `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="currentColor"><polygon points="6,1 7.3,4.3 11,4.3 8.2,6.5 9.2,10 6,7.8 2.8,10 3.8,6.5 1,4.3 4.7,4.3"/></svg>`,
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
      // 프로퍼티 패널이 같은 블록을 표시 중이면 이름 동기화
      if (targetEl.classList.contains('selected')) {
        const propName = document.querySelector('.prop-block-name');
        if (propName) propName.textContent = newName !== fallbackName ? newName : fallbackName;
      } else {
        const badge = document.getElementById('rp-block-id-badge');
        if (badge && targetEl.id && badge.textContent === targetEl.id) {
          const propName = document.querySelector('.prop-block-name');
          if (propName) propName.textContent = newName !== fallbackName ? newName : fallbackName;
        }
      }
      window.pushHistory?.();
    };
    const onKeyDown = ev => {
      if (ev.key === 'Enter')  { ev.preventDefault(); nameSpan.blur(); }
      if (ev.key === 'Escape') { nameSpan.textContent = orig; nameSpan.blur(); }
    };
    nameSpan.addEventListener('keydown', onKeyDown);
    nameSpan.addEventListener('blur', () => {
      nameSpan.removeEventListener('keydown', onKeyDown);
      finish();
    }, { once: true });
  });
}

/* 레이어 아이템 생성 (단일 블록용) */
function makeLayerBlockItem(block, dragTarget, sec, depth = 1) {
  const isText       = block.classList.contains('text-block');
  const isGap        = block.classList.contains('gap-block');
  const isIconCb     = block.classList.contains('icon-circle-block');
  const isTable      = block.classList.contains('table-block');
  const isLabelGroup = block.classList.contains('label-group-block');
  const isDivider    = block.classList.contains('divider-block');
  const isCard       = block.classList.contains('card-block');
  const isGraph      = block.classList.contains('graph-block');
  const isIconText   = block.classList.contains('icon-text-block');
  const isCanvas     = block.classList.contains('canvas-block');
  const isJoker      = block.classList.contains('joker-block');
  const isShape      = block.classList.contains('shape-block');
  const shapeType    = isShape ? (block.dataset.shapeType || 'rectangle') : null;
  const type     = isShape ? `shape-${shapeType}` : isText ? (block.dataset.type || 'body') : isGap ? 'gap' : isIconCb ? 'icon-circle' : isTable ? 'table' : isLabelGroup ? 'label-group' : isDivider ? 'divider' : isCard ? 'card' : isGraph ? 'graph' : isIconText ? 'icon-text' : isCanvas ? 'canvas' : isJoker ? 'joker' : 'asset';
  const labels    = { heading:'Heading', body:'Body', caption:'Caption', label:'Label', asset:'Asset', gap:'Gap', 'icon-circle':'Asset-Circle', table:'Table', 'label-group':'Tags', divider:'Divider', card:'Card', graph:'Graph', 'icon-text':'Icon Text', canvas:'Canvas', joker:'Joker', 'shape-rectangle':'Rectangle', 'shape-ellipse':'Ellipse', 'shape-line':'Line', 'shape-arrow':'Arrow', 'shape-polygon':'Polygon', 'shape-star':'Star' };
  const typeLbls  = { heading:'Text',    body:'Text',  caption:'Text',   label:'Label', asset:'Image', gap:'Gap', 'icon-circle':'Image', table:'Component', 'label-group':'Tags', divider:'Divider', card:'Component', graph:'Component', 'icon-text':'Text', canvas:'Canvas', joker:'Joker', 'shape-rectangle':'Shape', 'shape-ellipse':'Shape', 'shape-line':'Shape', 'shape-arrow':'Shape', 'shape-polygon':'Shape', 'shape-star':'Shape' };

  const item = document.createElement('div');
  item.className = 'layer-item';
  const displayName = block.dataset.layerName || labels[type] || type;
  item.innerHTML = `${layerIcons[type] || layerIcons.body}<span class="layer-item-name">${displayName}</span><span class="layer-item-type">${typeLbls[type] || 'Text'}</span>`;
  item.prepend(makeIndents(depth));
  item._dragTarget = dragTarget;
  addLayerRename(item.querySelector('.layer-item-name'), block, labels[type] || type);

  item.addEventListener('click', e => {
    e.stopPropagation();
    if (e.target.classList.contains('editing')) return;
    if (e.metaKey || e.ctrlKey) {
      // Cmd+클릭: 개별 토글
      window.toggleBlockSelect?.(block, sec);
      return;
    }
    if (e.shiftKey) {
      // Shift+클릭: 범위 선택
      window.rangeSelectBlocks?.(block, sec);
      return;
    }
    window.deselectAll();
    block.classList.add('selected');
    window.syncSection(sec);
    window.highlightBlock(block, item);
    window.setBlockAnchor?.(block);
    if (isCanvas) window.showCanvasProperties?.(block);
    else if (isShape) window.showShapeProperties?.(block);
    else if (isText || isIconText) window.showTextProperties(block);
    else if (isGap) window.showGapProperties(block);
    else if (isIconCb) window.showIconCircleProperties(block);
    else if (isTable) window.showTableProperties(block);
    else if (isCard) window.showCardProperties(block);
    else if (isJoker) window.showJokerProperties?.(block);
    else window.showAssetProperties(block);
  });
  block.addEventListener('mouseenter', () => item.style.background = 'var(--ui-bg-card)');
  block.addEventListener('mouseleave', () => { if (!item.classList.contains('active')) item.style.background = ''; });

  item.setAttribute('draggable', 'true');
  item.addEventListener('dragstart', e => {
    e.stopPropagation();
    if (window.state) window.state._suppressAutoSave = true;
    window.layerDragSrc = item;
    // 다중선택 드래그: 이 아이템이 active 상태이고 다른 active 아이템도 있으면 함께 이동
    if (item.classList.contains('active')) {
      const panel = document.getElementById('layer-panel-body');
      const allActive = panel ? [...panel.querySelectorAll('.layer-item.active')] : [];
      window.layerMultiDragTargets = allActive.length > 1
        ? allActive.map(el => el._dragTarget).filter(Boolean)
        : null;
    } else {
      window.layerMultiDragTargets = null;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => item.classList.add('layer-dragging'));
  });
  item.addEventListener('dragend', () => {
    if (window.state) window.state._suppressAutoSave = false;
    item.classList.remove('layer-dragging');
    window.clearLayerIndicators();
    window.layerDragSrc = null;
    window.layerMultiDragTargets = null;
  });

  block._layerItem = item;

  // canvas-block이면 자식 canvas-item 목록 표시
  if (isCanvas) {
    return _makeLayerCanvasWrapper(block, item, sec, depth);
  }

  return item;
}

/* canvas-block 전용 레이어 wrapper — 자식 canvas-item 목록 포함 */
function _makeLayerCanvasWrapper(cb, headerItem, sec, depth) {
  const wrapper = document.createElement('div');
  wrapper.className = 'layer-row-group ci-layer-group';
  wrapper._dragTarget = headerItem._dragTarget;

  // 헤더(chevron + 기존 item)를 포함하는 행
  const header = document.createElement('div');
  header.className = 'layer-row-header ci-layer-header';

  // chevron
  const chevron = document.createElement('svg');
  chevron.setAttribute('viewBox', '0 0 12 12');
  chevron.setAttribute('fill', 'currentColor');
  chevron.className = 'layer-chevron';
  chevron.innerHTML = '<path d="M2 4l4 4 4-4"/>';
  chevron.style.cssText = 'width:12px;height:12px;flex-shrink:0;cursor:pointer;';
  chevron.addEventListener('click', e => {
    e.stopPropagation();
    wrapper.classList.toggle('collapsed');
  });

  // headerItem은 makeLayerBlockItem에서 이미 makeIndents(depth)가 추가됐으므로 제거
  // ci-layer-header 구조: [indents][chevron][icon+name] (layer-row-group과 동일 순서)
  const existingIndents = headerItem.querySelector('.layer-indents');
  if (existingIndents) existingIndents.remove();

  header.appendChild(chevron);
  header.appendChild(headerItem);
  header.prepend(makeIndents(depth));
  wrapper.appendChild(header);

  // 자식 목록 컨테이너
  const children = document.createElement('div');
  children.className = 'layer-row-children';

  const _rebuildChildren = () => {
    children.innerHTML = '';
    cb.querySelectorAll(':scope > .canvas-item').forEach(ciEl => {
      const ciType = ciEl.dataset.type || 'image';
      const isTextType = ciType === 'text' || ciType === 'text-block';
      const tbType = ciEl.dataset.tbtype;
      const tbLabels = { h2: 'Heading', body: 'Body', caption: 'Caption', label: 'Label' };
      const ciLabel = isTextType ? (tbLabels[tbType] || '텍스트') : '이미지';
      const ciTypeLabel = isTextType ? 'Text' : 'Image';
      const ciIcon = isTextType
        ? `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="2" y1="3" x2="10" y2="3"/><line x1="2" y1="6" x2="8" y2="6"/><line x1="2" y1="9" x2="6" y2="9"/></svg>`
        : `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="10" height="10" rx="1"/><circle cx="4" cy="4" r="1"/><polyline points="11 8 8 5 3 11"/></svg>`;

      const ciItem = document.createElement('div');
      ciItem.className = 'layer-item layer-item-nested ci-layer-item';
      ciItem.dataset.ciId = ciEl.id;
      ciItem.innerHTML = `${ciIcon}<span class="layer-item-name">${ciLabel}</span><span class="layer-item-type">${ciTypeLabel}</span>`;
      ciItem.prepend(makeIndents(depth + 1));

      // 선택 동기화
      if (ciEl.classList.contains('ci-selected')) ciItem.classList.add('active');
      ciEl._layerCiItem = ciItem;

      ciItem.addEventListener('click', e => {
        e.stopPropagation();
        // canvas-item 선택
        window.deselectAll?.();
        cb.classList.add('selected');
        // mousedown 없이 직접 selectItem API 호출
        window.deselectCanvasItem?.();
        // _selectItem 내부 접근을 위해 mousedown 시뮬레이션
        ciEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 0, clientY: 0 }));
        // 레이어 패널 active 표시
        children.querySelectorAll('.ci-layer-item').forEach(el => el.classList.remove('active'));
        ciItem.classList.add('active');
      });

      // hover 연동
      ciEl.addEventListener('mouseenter', () => { if (!ciItem.classList.contains('active')) ciItem.style.background = 'var(--ui-bg-card)'; });
      ciEl.addEventListener('mouseleave', () => { if (!ciItem.classList.contains('active')) ciItem.style.background = ''; });

      children.appendChild(ciItem);
    });
  };

  _rebuildChildren();
  wrapper.appendChild(children);
  wrapper._rebuildChildren = _rebuildChildren;
  cb._layerCanvasWrapper = wrapper;

  return wrapper;
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
  header.prepend(makeIndents(1));
  addLayerRename(header.querySelector('.layer-item-name'), groupEl, 'Group', 'name');

  header.addEventListener('click', e => {
    if (e.target.closest('.layer-chevron')) { wrapper.classList.toggle('collapsed'); return; }
    if (e.target.closest('.layer-ungroup-btn')) {
      window.ungroupBlock(groupEl);
      return;
    }
    // 그룹 선택 — 캔버스 그룹 강조 + 섹션 선택
    window.deselectAll();
    groupEl.classList.add('group-selected');
    const sec = groupEl.closest('.section-block');
    if (sec) window.selectSection(sec);
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
function makeLayerAssetItem(block, dragTarget, sec, depth = 1) {
  const overlayEl = block.querySelector('.asset-overlay');
  const overlayChildren = overlayEl
    ? [...overlayEl.children].filter(c =>
        c.classList.contains('overlay-tb') ||
        c.classList.contains('gap-block') ||
        (c.classList.contains('row') && c.querySelector('.overlay-tb'))
      )
    : [];
  if (overlayChildren.length === 0) return makeLayerBlockItem(block, dragTarget, sec, depth);

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
  header.prepend(makeIndents(depth));
  addLayerRename(header.querySelector('.layer-item-name'), block, 'Asset');

  header.addEventListener('click', e => {
    if (e.target.closest('.layer-chevron')) { wrapper.classList.toggle('collapsed'); return; }
    window.deselectAll();
    block.classList.add('selected');
    window.syncSection(sec);
    window.highlightBlock(block, header);
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
    window.clearLayerIndicators();
    window.layerDragSrc = null;
  });

  const children = document.createElement('div');
  children.className = 'layer-row-children';

  const buildOverlayChildren = () => {
    children.innerHTML = '';
    [...overlayEl.children].forEach(child => {
      if (child.classList.contains('gap-block')) {
        // gap-block: use makeLayerBlockItem for consistent rendering
        const gapItem = makeLayerBlockItem(child, child, sec, depth + 1);
        gapItem.classList.add('layer-item-nested');
        children.appendChild(gapItem);
        return;
      }
      // row로 감싸진 overlay-tb 처리
      if (child.classList.contains('row')) {
        const tb = child.querySelector('.overlay-tb');
        if (!tb) return;
        const tbItem = makeLayerBlockItem(tb, tb, sec, depth + 1);
        tbItem.classList.add('layer-item-nested');
        children.appendChild(tbItem);
        return;
      }
      if (!child.classList.contains('overlay-tb')) return;
      const tbItem = makeLayerBlockItem(child, child, sec, depth + 1);
      tbItem.classList.add('layer-item-nested');
      children.appendChild(tbItem);
    });
  };
  buildOverlayChildren();

  // overlay-tb / gap-block 순서 변경 + 섹션 블록 ↔ 오버레이 크로스 드롭존
  // rAF throttle: getBoundingClientRect 호출 최적화
  let _overlayDragRafId = null;
  children.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
    const dragTarget = window.layerDragSrc?._dragTarget;
    if (!dragTarget) return;
    const isOverlayContent = dragTarget.classList.contains('overlay-tb') ||
      (dragTarget.classList.contains('gap-block') && dragTarget.closest('.asset-overlay'));
    const isSectionRow = dragTarget.classList.contains('row') &&
      !dragTarget.closest('.asset-overlay') && dragTarget.querySelector('.text-block');
    const isSectionGap = dragTarget.classList.contains('gap-block') && !dragTarget.closest('.asset-overlay');
    if (!isOverlayContent && !isSectionRow && !isSectionGap) return;
    if (_overlayDragRafId) return;
    const clientY = e.clientY;
    _overlayDragRafId = requestAnimationFrame(() => {
      _overlayDragRafId = null;
      window.clearLayerIndicators();
      const after = window.getLayerDragAfterItem(children, clientY);
      const indicator = document.createElement('div');
      indicator.className = 'layer-drop-indicator';
      if (after) children.insertBefore(indicator, after);
      else children.appendChild(indicator);
    });
  });
  children.addEventListener('dragleave', e => {
    if (!children.contains(e.relatedTarget)) window.clearLayerIndicators();
  });
  children.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    const dragEl = window.layerDragSrc?._dragTarget;
    if (!dragEl) return;
    const indicator = children.querySelector('.layer-drop-indicator');
    const getNextOverlayChild = () => {
      if (!indicator) return null;
      const nextItem = indicator.nextElementSibling;
      const nextTb = nextItem?._dragTarget;
      return nextTb ? (nextTb.closest('.asset-overlay > *') || nextTb) : null;
    };
    const insertIntoOverlay = (el) => {
      const nextChild = getNextOverlayChild();
      if (nextChild) overlayEl.insertBefore(el, nextChild);
      else overlayEl.appendChild(el);
    };

    // Cross-boundary: section row → overlay
    if (dragEl.classList.contains('row') && !dragEl.closest('.asset-overlay')) {
      const block = dragEl.querySelector('.text-block');
      if (!block) { window.clearLayerIndicators(); return; }
      block.classList.add('overlay-tb');
      insertIntoOverlay(dragEl);
      window.clearLayerIndicators();
      window.buildLayerPanel();
      window.pushHistory();
      window.layerDragSrc = null;
      return;
    }

    // Cross-boundary: section gap-block → overlay
    if (dragEl.classList.contains('gap-block') && !dragEl.closest('.asset-overlay')) {
      insertIntoOverlay(dragEl);
      window.clearLayerIndicators();
      window.buildLayerPanel();
      window.pushHistory();
      window.layerDragSrc = null;
      return;
    }

    // Within overlay: reorder overlay-tb / gap-block
    if (!dragEl.classList.contains('overlay-tb') && !dragEl.classList.contains('gap-block')) return;
    insertIntoOverlay(dragEl);
    window.clearLayerIndicators();
    window.buildLayerPanel();
    window.pushHistory();
    window.layerDragSrc = null;
  });

  wrapper.appendChild(header);
  wrapper.appendChild(children);
  return wrapper;
}

/* 카드 블록 + 하위 이미지/제목/설명 자식 포함 레이어 아이템 */
function makeLayerCardItem(block, dragTarget, sec, depth = 1) {
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
  header.prepend(makeIndents(depth));
  addLayerRename(header.querySelector('.layer-item-name'), block, 'Card');

  header.addEventListener('click', e => {
    if (e.target.closest('.layer-chevron')) { wrapper.classList.toggle('collapsed'); return; }
    window.deselectAll();
    block.classList.add('selected');
    window.syncSection(sec);
    window.highlightBlock(block, header);
    window.showCardProperties(block);
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
    window.clearLayerIndicators();
    window.layerDragSrc = null;
  });

  const children = document.createElement('div');
  children.className = 'layer-row-children';

  const selectCard = e => {
    e.stopPropagation();
    window.deselectAll();
    block.classList.add('selected');
    window.syncSection(sec);
    window.highlightBlock(block, header);
    window.showCardProperties(block);
  };

  const imgEl = block.querySelector('.cdb-image');
  if (imgEl) {
    const imgItem = document.createElement('div');
    imgItem.className = 'layer-item layer-item-nested';
    imgItem.innerHTML = `${layerIcons.asset}<span class="layer-item-name">Image</span><span class="layer-item-type">Image</span>`;
    imgItem.prepend(makeIndents(depth + 1));
    imgItem.addEventListener('click', selectCard);
    children.appendChild(imgItem);
  }
  const titleEl = block.querySelector('.cdb-title');
  if (titleEl) {
    const item = document.createElement('div');
    item.className = 'layer-item layer-item-nested';
    item.innerHTML = `${layerIcons.heading}<span class="layer-item-name">Title</span><span class="layer-item-type">Text</span>`;
    item.prepend(makeIndents(depth + 1));
    item.addEventListener('click', selectCard);
    children.appendChild(item);
  }
  const descEl = block.querySelector('.cdb-desc');
  if (descEl) {
    const item = document.createElement('div');
    item.className = 'layer-item layer-item-nested';
    item.innerHTML = `${layerIcons.body}<span class="layer-item-name">Description</span><span class="layer-item-type">Text</span>`;
    item.prepend(makeIndents(depth + 1));
    item.addEventListener('click', selectCard);
    children.appendChild(item);
  }

  wrapper.appendChild(header);
  wrapper.appendChild(children);
  return wrapper;
}


/* 레이어 Row 그룹 생성 (멀티컬럼용) */
function makeLayerColItem(colEl, colIdx, sec, depth = 2) {
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
  colHeader.prepend(makeIndents(depth));

  const colChildren = document.createElement('div');
  colChildren.className = 'layer-row-children';

  // col 직접 자식 중 row로 래핑된 블록도 꺼내서 평탄화
  const rawChildren = [...colEl.querySelectorAll(':scope > *')]
    .filter(el => !el.classList.contains('col-placeholder') && !el.classList.contains('drop-indicator'));
  const blocks = rawChildren.flatMap(el => {
    if (el.classList.contains('row')) {
      // row > col > block 구조에서 실제 블록만 추출
      const inner = [...el.querySelectorAll(':scope > .col > *')]
        .filter(b => !b.classList.contains('col-placeholder') && !b.classList.contains('drop-indicator'));
      return inner.length > 0 ? inner : [];
    }
    return [el];
  });

  const labels    = { heading:'Heading', body:'Body', caption:'Caption', label:'Label', asset:'Asset', gap:'Gap', 'icon-circle':'Asset-Circle', table:'Table', 'label-group':'Tags', divider:'Divider', card:'Card', banner:'Banner', graph:'Graph', 'icon-text':'Icon Text', canvas:'Canvas' };
  const typeLbls  = { heading:'Text', body:'Text', caption:'Text', label:'Label', asset:'Image', gap:'Gap', 'icon-circle':'Image', table:'Component', 'label-group':'Tags', divider:'Divider', card:'Component', banner:'Component', graph:'Component', 'icon-text':'Text', canvas:'Canvas' };

  blocks.forEach(block => {
    const isText = block.classList.contains('text-block');
    const isGap  = block.classList.contains('gap-block');
    const isIconCb = block.classList.contains('icon-circle-block');
    const isTable  = block.classList.contains('table-block');
    const isLabelGroup = block.classList.contains('label-group-block');
    const isDivider = block.classList.contains('divider-block');
    const isCard  = block.classList.contains('card-block');
    const isGraph  = block.classList.contains('graph-block');
    const isIconText = block.classList.contains('icon-text-block');
    const isCanvas = block.classList.contains('canvas-block');
    const type = isText ? (block.dataset.type || 'body') : isGap ? 'gap' : isIconCb ? 'icon-circle' : isTable ? 'table' : isLabelGroup ? 'label-group' : isDivider ? 'divider' : isCard ? 'card' : isGraph ? 'graph' : isIconText ? 'icon-text' : isCanvas ? 'canvas' : 'asset';

    if (isCard)   { colChildren.appendChild(makeLayerCardItem(block, block.closest('.row') || block, sec, depth + 1)); return; }
    if (isCanvas) { colChildren.appendChild(makeLayerBlockItem(block, block.closest('.row') || block, sec, depth + 1)); return; }

    const item = document.createElement('div');
    item.className = 'layer-item layer-item-nested';
    item.innerHTML = `${layerIcons[type]}<span class="layer-item-name">${block.dataset.layerName || labels[type]}</span><span class="layer-item-type">${typeLbls[type]}</span>`;
    item.prepend(makeIndents(depth + 1));
    item.addEventListener('click', e => {
      e.stopPropagation();
      if (e.metaKey || e.ctrlKey) { window.toggleBlockSelect?.(block, sec); return; }
      if (e.shiftKey) { window.rangeSelectBlocks?.(block, sec); return; }
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
      window.syncSection(sec);
      window.highlightBlock(block, item);
      window.setBlockAnchor?.(block);
      if (isCanvas) window.showCanvasProperties?.(block);
      else if (isText || isIconText) window.showTextProperties(block);
      else if (isGap) window.showGapProperties(block);
      else if (isIconCb) window.showIconCircleProperties(block);
      else if (isTable) window.showTableProperties(block);
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
    window.syncSection(sec);
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
  header.prepend(makeIndents(1));

  const groupChildren = document.createElement('div');
  groupChildren.className = 'layer-row-children';

  // Col Frame을 자식으로 표시
  const cols = [...rowEl.querySelectorAll(':scope > .col')];
  cols.forEach((col, i) => {
    groupChildren.appendChild(makeLayerColItem(col, i, sec, 2));
  });

  header.addEventListener('click', e => {
    if (e.target.closest('.layer-chevron')) { group.classList.toggle('collapsed'); return; }
    window.deselectAll();
    blocks.forEach(block => block.classList.add('selected'));
    rowEl.classList.add('row-active');
    window.syncSection(sec);
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
    window.clearLayerIndicators();
    window.layerDragSrc = null;
  });

  group.appendChild(header);
  group.appendChild(groupChildren);
  return group;
}


/* 레이어 Frame 아이템 생성 */
function makeLayerSubSectionItem(ssEl, sec, appendRowFn) {
  const wrapper = document.createElement('div');
  wrapper.className = 'layer-item';
  wrapper._dragTarget = ssEl;

  const name = ssEl.dataset.layerName || 'Frame';

  // 내부에 shape-block이 하나만 있으면 해당 shape의 아이콘/타입으로 표시
  const innerShapeBlock = ssEl.querySelector('.shape-block');
  const shapeType = innerShapeBlock ? (innerShapeBlock.dataset.shapeType || 'rectangle') : null;
  const shapeKey  = shapeType ? `shape-${shapeType}` : null;
  const shapeTypeLbls = { 'shape-rectangle':'Shape', 'shape-ellipse':'Shape', 'shape-line':'Shape', 'shape-arrow':'Shape', 'shape-polygon':'Shape', 'shape-star':'Shape' };

  const iconHtml  = shapeKey && layerIcons[shapeKey]
    ? layerIcons[shapeKey]
    : `<svg class="layer-item-icon" viewBox="1.5 1.5 13 13" fill="none"><path fill="currentColor" fill-rule="evenodd" d="M5.5 3a.5.5 0 0 1 .5.5V5h4V3.5a.5.5 0 0 1 1 0V5h1.5a.5.5 0 0 1 0 1H11v4h1.5a.5.5 0 0 1 0 1H11v1.5a.5.5 0 0 1-1 0V11H6v1.5a.5.5 0 0 1-1 0V11H3.5a.5.5 0 0 1 0-1H5V6H3.5a.5.5 0 0 1 0-1H5V3.5a.5.5 0 0 1 .5-.5m4.5 7V6H6v4z" clip-rule="evenodd"/></svg>`;
  const typeLabel = shapeKey ? (shapeTypeLbls[shapeKey] || 'Shape') : 'Frame';

  wrapper.innerHTML = `${iconHtml}<span class="layer-item-name">${name}</span><span class="layer-item-type">${typeLabel}</span>`;
  wrapper.prepend(makeIndents(1));
  addLayerRename(wrapper.querySelector('.layer-item-name'), ssEl, 'Frame', 'layerName');

  wrapper.setAttribute('draggable', 'true');
  wrapper.addEventListener('click', e => {
    if (e.target.classList.contains('editing')) return;
    window.deselectAll?.();
    const parentSec = ssEl.closest('.section-block');
    if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
    ssEl.classList.add('selected');
    window._activeSubSection = ssEl;
    document.querySelectorAll('.layer-item.active').forEach(g => g.classList.remove('active'));
    wrapper.classList.add('active');
    window.highlightBlock?.(ssEl, wrapper);
    window.showSubSectionProperties?.(ssEl);
  });
  wrapper.addEventListener('dragstart', e => {
    e.stopPropagation();
    window.layerDragSrc = wrapper;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => wrapper.classList.add('layer-dragging'));
  });
  wrapper.addEventListener('dragend', () => {
    wrapper.classList.remove('layer-dragging');
    window.clearLayerIndicators?.();
    window.layerDragSrc = null;
  });
  ssEl._layerItem = wrapper;

  const ssChildren = document.createElement('div');
  ssChildren.className = 'layer-row-children';

  const ssInner = ssEl.querySelector('.sub-section-inner');
  if (ssInner) {
    [...ssInner.children].forEach(child => {
      if (child.classList.contains('sub-section-block')) {
        // 중첩 프레임 — 재귀 렌더링
        ssChildren.appendChild(makeLayerSubSectionItem(child, sec, appendRowFn));
      } else if (child.classList.contains('row')) {
        appendRowFn(child, ssChildren, 2);
      } else if (['gap-block','joker-block','text-block','asset-block','icon-circle-block',
                 'table-block','card-block','graph-block','divider-block','label-group-block','shape-block']
                .some(c => child.classList.contains(c))) {
        ssChildren.appendChild(makeLayerBlockItem(child, child, sec, 2));
      }
    });
  }

  // shape-only frame이 아니고 자식이 있으면 chevron + group 구조로 반환
  const isShapeOnly = !!ssEl.querySelector('.shape-block') &&
                      ssInner?.children.length === 1 &&
                      ssInner?.firstElementChild?.classList.contains('shape-block');

  if (!isShapeOnly && ssChildren.children.length > 0) {
    const group = document.createElement('div');
    group.className = 'layer-row-group';
    group.dataset.type = 'frame';
    group._dragTarget = ssEl;

    const header = document.createElement('div');
    header.className = 'layer-row-header';

    // innerHTML로 파싱해야 SVG 네임스페이스가 올바르게 설정됨
    header.innerHTML = `
      <svg class="layer-chevron" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>
      ${iconHtml}
      <span class="layer-item-name">${name}</span>
      <span class="layer-item-type">${typeLabel}</span>`;
    header.prepend(makeIndents(1));
    addLayerRename(header.querySelector('.layer-item-name'), ssEl, 'Frame', 'layerName');
    header.querySelector('.layer-chevron').addEventListener('click', e => {
      e.stopPropagation();
      group.classList.toggle('collapsed');
    });
    header.setAttribute('draggable', 'true');
    header.addEventListener('click', e => {
      if (e.target.closest('.layer-chevron')) return;
      if (e.target.classList.contains('editing')) return;
      window.deselectAll?.();
      const parentSec = ssEl.closest('.section-block');
      if (parentSec) { parentSec.classList.add('selected'); window.syncLayerActive?.(parentSec); }
      ssEl.classList.add('selected');
      window._activeSubSection = ssEl;
      document.querySelectorAll('.layer-row-header.active').forEach(h => h.classList.remove('active'));
      header.classList.add('active');
      window.highlightBlock?.(ssEl, header);
      window.showSubSectionProperties?.(ssEl);
    });
    header.addEventListener('dragstart', e => {
      e.stopPropagation();
      window.layerDragSrc = group;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
      requestAnimationFrame(() => group.classList.add('layer-dragging'));
    });
    header.addEventListener('dragend', () => {
      group.classList.remove('layer-dragging');
      window.clearLayerIndicators?.();
      window.layerDragSrc = null;
    });

    group.appendChild(header);
    group.appendChild(ssChildren);

    ssEl._layerItem = header;
    return group;
  }

  return wrapper;
}

export {
  makeIndents,
  layerIcons,
  addLayerRename,
  makeLayerBlockItem,
  makeLayerGroupItem,
  makeLayerSubSectionItem,
  makeLayerAssetItem,
  makeLayerCardItem,
  makeLayerColItem,
  makeLayerRowGroup,
};

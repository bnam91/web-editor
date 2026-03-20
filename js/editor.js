/* ═══════════════════════════════════
   ZOOM
═══════════════════════════════════ */
const CANVAS_W = 860;
let currentZoom = 40;
const scaler = document.getElementById('canvas-scaler');
const zoomDisplay = document.getElementById('zoom-display');

function applyZoom(z) {
  currentZoom = Math.min(150, Math.max(25, z));
  scaler.style.transform = `scale(${currentZoom / 100})`;
  zoomDisplay.textContent = currentZoom + '%';
  document.documentElement.style.setProperty('--inv-zoom', (100 / currentZoom).toFixed(4));
}
function zoomStep(delta) { applyZoom(currentZoom + delta); }
function zoomFit() {
  const wrap = document.getElementById('canvas-wrap');
  applyZoom(Math.floor(((wrap.clientWidth - 80) / CANVAS_W) * 100));
}

/* ══════════════════════════════════════
   Undo / Redo
══════════════════════════════════════ */
const MAX_HISTORY = 50;
let historyStack = [];
let historyPos   = -1;
let _historyPaused = false;

function pushHistory() {
  if (_historyPaused) return;
  historyStack = historyStack.slice(0, historyPos + 1);
  historyStack.push({ canvas: getSerializedCanvas(), settings: { ...pageSettings } });
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
  else historyPos++;
}

function restoreSnapshot(snap) {
  _historyPaused = true;
  Object.assign(pageSettings, snap.settings);
  canvasEl.innerHTML = snap.canvas;
  rebindAll();
  applyPageSettings();
  buildLayerPanel();
  deselectAll();
  _historyPaused = false;
}

function undo() {
  if (historyPos <= 0) return;
  historyPos--;
  restoreSnapshot(historyStack[historyPos]);
}
function redo() {
  if (historyPos >= historyStack.length - 1) return;
  historyPos++;
  restoreSnapshot(historyStack[historyPos]);
}

/* ══════════════════════════════════════
   복사 / 붙여넣기
══════════════════════════════════════ */
let clipboard = null;

function copySelected() {
  const selBlock   = document.querySelector('.text-block.selected, .asset-block.selected, .gap-block.selected');
  const selSection = document.querySelector('.section-block.selected');
  if (selBlock) {
    const target = selBlock.classList.contains('gap-block') ? selBlock : (selBlock.closest('.row') || selBlock);
    clipboard = { type: 'block', html: target.outerHTML };
  } else if (selSection) {
    clipboard = { type: 'section', html: selSection.outerHTML };
  }
}

function pasteClipboard() {
  if (!clipboard) return;
  pushHistory();
  const temp = document.createElement('div');
  temp.innerHTML = clipboard.html;
  const el = temp.firstElementChild;

  if (clipboard.type === 'section') {
    canvasEl.appendChild(el);
    bindSectionDelete(el);
    bindSectionOrder(el);
    bindSectionDrag(el);
    bindSectionDropZone(el);
    el.querySelectorAll('.text-block, .asset-block, .gap-block').forEach(b => bindBlock(b));
    el.querySelectorAll('.col > .col-placeholder').forEach(ph => {
      const col = ph.parentElement;
      col.replaceChild(makeColPlaceholder(col), ph);
    });
    el.addEventListener('click', e2 => { e2.stopPropagation(); selectSection(el); });
  } else {
    const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
    if (!sec) return;
    insertAfterSelected(sec, el);
    el.querySelectorAll('.text-block, .asset-block, .gap-block').forEach(b => bindBlock(b));
    el.querySelectorAll('.col > .col-placeholder').forEach(ph => {
      const col = ph.parentElement;
      col.replaceChild(makeColPlaceholder(col), ph);
    });
  }
  buildLayerPanel();
}

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey) {
    if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomStep(10); }
    if (e.key === '-')                  { e.preventDefault(); zoomStep(-10); }
    if (e.key === '0')                  { e.preventDefault(); applyZoom(100); }
    if (e.key === 'z' && !e.shiftKey)   { e.preventDefault(); undo(); return; }
    if (e.key === 'z' && e.shiftKey)    { e.preventDefault(); redo(); return; }
    if (e.key === 'c') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
      copySelected();
      return;
    }
    if (e.key === 'v') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
      pasteClipboard();
      return;
    }
  }
  if (e.key === 'Escape') deselectAll();

  const isDelete = e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey));
  if (isDelete) {
    // 텍스트 편집 중이거나 input에 포커스가 있으면 기본 동작 유지
    if (document.querySelector('.text-block.editing')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    // 이미지 편집 모드 중이면 이미지 삭제
    const imgEditBlock = document.querySelector('.asset-block.img-editing');
    if (imgEditBlock) {
      e.preventDefault();
      clearAssetImage(imgEditBlock);
      return;
    }

    const selText    = document.querySelector('.text-block.selected');
    const selAsset   = document.querySelector('.asset-block.selected');
    const selGap     = document.querySelector('.gap-block.selected');
    const selSection = document.querySelector('.section-block.selected');

    if (selText || selAsset) {
      e.preventDefault();
      pushHistory();
      const block = selText || selAsset;
      (block.closest('.row') || block).remove();
      deselectAll();
      buildLayerPanel();
    } else if (selGap) {
      e.preventDefault();
      pushHistory();
      selGap.remove();
      deselectAll();
      buildLayerPanel();
    } else if (selSection) {
      e.preventDefault();
      pushHistory();
      selSection.remove();
      deselectAll();
      buildLayerPanel();
    }
  }
});

applyZoom(40);

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
  label:   `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="3" width="10" height="6" rx="1.5"/></svg>`,
};

/* 레이어 아이템 생성 (단일 블록용) */
function makeLayerBlockItem(block, dragTarget, sec) {
  const isText = block.classList.contains('text-block');
  const isGap  = block.classList.contains('gap-block');
  const type   = isText ? (block.dataset.type || 'body') : isGap ? 'gap' : 'asset';
  const labels    = { heading:'Heading', body:'Body', caption:'Caption', label:'Label', asset:'Asset', gap:'Gap' };
  const typeLbls  = { heading:'Text',    body:'Text',  caption:'Text',   label:'Label', asset:'Image', gap:'Gap' };

  const item = document.createElement('div');
  item.className = 'layer-item';
  item.innerHTML = `${layerIcons[type] || layerIcons.body}<span class="layer-item-name">${labels[type] || type}</span><span class="layer-item-type">${typeLbls[type] || 'Text'}</span>`;
  item._dragTarget = dragTarget;

  item.addEventListener('click', e => {
    e.stopPropagation();
    deselectAll();
    block.classList.add('selected');
    syncSection(sec);
    highlightBlock(block, item);
    if (isText) showTextProperties(block);
    else if (isGap) showGapProperties(block);
    else showAssetProperties(block);
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
    const isText = block.classList.contains('text-block');
    const isGap  = block.classList.contains('gap-block');
    const type   = isText ? (block.dataset.type || 'body') : isGap ? 'gap' : 'asset';
    const labels    = { heading:'Heading', body:'Body', caption:'Caption', label:'Label', asset:'Asset', gap:'Gap' };
    const typeLbls  = { heading:'Text',    body:'Text',  caption:'Text',   label:'Label', asset:'Image', gap:'Gap' };

    const item = document.createElement('div');
    item.className = 'layer-item layer-item-nested';
    item.innerHTML = `${layerIcons[type]}<span class="layer-item-name">${labels[type]}</span><span class="layer-item-type">${typeLbls[type]}</span>`;

    item.addEventListener('click', e => {
      e.stopPropagation();
      deselectAll();
      block.classList.add('selected');
      syncSection(sec);
      highlightBlock(block, item);
      if (isText) showTextProperties(block);
      else if (isGap) showGapProperties(block);
      else showAssetProperties(block);
    });
    block.addEventListener('mouseenter', () => item.style.background = '#252525');
    block.addEventListener('mouseleave', () => { if (!item.classList.contains('active')) item.style.background = ''; });

    block._layerItem = item;
    groupChildren.appendChild(item);
  });

  header.addEventListener('click', e => {
    // chevron 클릭이면 토글만
    if (e.target.closest('.layer-chevron')) { group.classList.toggle('collapsed'); return; }
    // Row 헤더 클릭 → 하위 블록 전체 선택
    deselectAll();
    blocks.forEach(block => block.classList.add('selected'));
    syncSection(sec);
    // 레이어 하위 아이템 모두 하이라이트
    groupChildren.querySelectorAll('.layer-item').forEach(it => it.classList.add('active'));
    header.classList.add('active');
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

    header.appendChild(chevron);
    header.appendChild(nameEl);

    chevron.addEventListener('click', () => {
      const collapsed = sectionEl.classList.toggle('collapsed');
      if (!collapsed) selectSection(sec, true);
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
    [...sectionInner.children].forEach(child => {
      if (child.classList.contains('gap-block')) {
        children.appendChild(makeLayerBlockItem(child, child, sec));
      } else if (child.classList.contains('row')) {
        const colBlocks = [...child.querySelectorAll(':scope > .col > *')]
          .filter(el => !el.classList.contains('col-placeholder'));
        const allCols = [...child.querySelectorAll(':scope > .col')];
        const hasPlaceholderOnly = colBlocks.length === 0 && allCols.length > 0;
        if (hasPlaceholderOnly) {
          // 빈 row → Empty row 항목으로 표시
          children.appendChild(makeLayerRowGroup(child, [], sec));
        } else if (colBlocks.length <= 1) {
          const block = colBlocks[0];
          if (block) children.appendChild(makeLayerBlockItem(block, child, sec));
        } else {
          children.appendChild(makeLayerRowGroup(child, colBlocks, sec));
        }
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
}

function syncLayerActive(sec) {
  document.querySelectorAll('.layer-section-header').forEach(h => h.classList.remove('active'));
  if (sec && sec._layerHeader) sec._layerHeader.classList.add('active');
}

function highlightBlock(block, layerItem) {
  document.querySelectorAll('.layer-item').forEach(i => { i.classList.remove('active'); i.style.background = ''; });
  if (layerItem) layerItem.classList.add('active');
}

/* ═══════════════════════════════════
   SELECTION
═══════════════════════════════════ */
function selectSection(sec, scrollIntoView = false) {
  deselectAll();
  sec.classList.add('selected');
  syncLayerActive(sec);
  showSectionProperties(sec);
  if (scrollIntoView) {
    const canvasWrapEl = document.getElementById('canvas-wrap');
    const scalerEl = document.getElementById('canvas-scaler');
    const scale = parseFloat(scalerEl.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1);
    const secTop = sec.offsetTop * scale;
    canvasWrapEl.scrollTo({ top: secTop - 40, behavior: 'smooth' });
  }
}

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
}

function showSectionProperties(sec) {
  const currentBg = sec.style.background || sec.style.backgroundColor || '#ffffff';
  const hexBg = /^#[0-9a-f]{6}$/i.test(currentBg) ? currentBg : '#ffffff';

  // 섹션 내 텍스트 블록 타입별 수집
  const typeMap = { heading: 'Heading', body: 'Body', caption: 'Caption', label: 'Label' };
  const typeOrder = ['heading', 'body', 'caption', 'label'];
  const found = {}; // type → { blocks: [], color: hex }
  sec.querySelectorAll('.text-block').forEach(tb => {
    const type = tb.dataset.type;
    if (!typeMap[type]) return;
    const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
    const computed = window.getComputedStyle(contentEl);
    const colorHex = contentEl.style.color
      ? (/^#/.test(contentEl.style.color) ? contentEl.style.color : rgbToHex(contentEl.style.color))
      : rgbToHex(computed.color);
    if (!found[type]) found[type] = { blocks: [], color: colorHex };
    found[type].blocks.push(tb);
  });

  const colorRows = typeOrder.filter(t => found[t]).map(t => {
    const c = found[t].color;
    return `
      <div class="prop-color-row">
        <span class="prop-label">${typeMap[t]}</span>
        <div class="prop-color-swatch" style="background:${c}">
          <input type="color" id="sec-txt-${t}" value="${c}">
        </div>
        <input type="text" class="prop-color-hex" id="sec-txt-${t}-hex" value="${c}" maxlength="7">
      </div>`;
  }).join('');

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1.5"/>
          </svg>
        </div>
        <span class="prop-block-name">Section</span>
      </div>
      <div class="prop-section-title">배경</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${hexBg}">
          <input type="color" id="sec-bg-color" value="${hexBg}">
        </div>
        <input type="text" class="prop-color-hex" id="sec-bg-hex" value="${hexBg}" maxlength="7">
      </div>
    </div>
    ${colorRows ? `<div class="prop-section"><div class="prop-section-title">텍스트 컬러</div>${colorRows}</div>` : ''}
    <div class="prop-section">
      <div class="prop-section-title">일괄 정렬</div>
      <div class="prop-align-group">
        <button class="prop-align-btn" id="sec-align-left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="sec-align-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="sec-align-right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">내보내기</div>
      <select class="prop-select" id="sec-export-format" style="width:100%;margin-bottom:6px;">
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
      </select>
      <button class="prop-export-btn" id="sec-export-btn">이 섹션 내보내기</button>
    </div>`;

  // 배경색 이벤트
  const picker = document.getElementById('sec-bg-color');
  const hex    = document.getElementById('sec-bg-hex');
  const swatch = picker.closest('.prop-color-swatch');
  picker.addEventListener('input', () => {
    sec.style.background = picker.value;
    hex.value = picker.value;
    swatch.style.background = picker.value;
  });
  hex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(hex.value)) {
      sec.style.background = hex.value;
      picker.value = hex.value;
      swatch.style.background = hex.value;
    }
  });

  // 텍스트 컬러 이벤트
  typeOrder.filter(t => found[t]).forEach(t => {
    const blocks = found[t].blocks;
    const applyColor = (val) => {
      blocks.forEach(tb => {
        const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
        contentEl.style.color = val;
      });
    };
    const p = document.getElementById(`sec-txt-${t}`);
    const h = document.getElementById(`sec-txt-${t}-hex`);
    const sw = p.closest('.prop-color-swatch');
    p.addEventListener('input', () => { applyColor(p.value); h.value = p.value; sw.style.background = p.value; });
    h.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(h.value)) { applyColor(h.value); p.value = h.value; sw.style.background = h.value; }
    });
  });

  // 일괄 정렬
  const allTextBlocks = [...sec.querySelectorAll('.text-block')];
  ['left','center','right'].forEach(align => {
    const btn = document.getElementById(`sec-align-${align}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      allTextBlocks.forEach(tb => {
        const isLabel = tb.querySelector('.tb-label');
        if (isLabel) { tb.style.textAlign = align; }
        else {
          const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
          if (contentEl) contentEl.style.textAlign = align;
        }
      });
      propPanel.querySelectorAll('#sec-align-left,#sec-align-center,#sec-align-right')
        .forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // 내보내기
  const secExportBtn = document.getElementById('sec-export-btn');
  if (secExportBtn) {
    secExportBtn.addEventListener('click', async () => {
      const fmt = document.getElementById('sec-export-format').value;
      secExportBtn.disabled = true;
      secExportBtn.textContent = '내보내는 중...';
      try {
        await exportSection(sec, fmt);
      } finally {
        secExportBtn.disabled = false;
        secExportBtn.textContent = '이 섹션 내보내기';
      }
    });
  }
}

/* 블록이 선택된 상태에서 소속 섹션만 하이라이트 (deselectAll 없이) */
function syncSection(sec) {
  document.querySelectorAll('.section-block').forEach(s => s.classList.remove('selected'));
  sec.classList.add('selected');
  syncLayerActive(sec);
}

function deselectAll() {
  document.querySelectorAll('.section-block').forEach(s => s.classList.remove('selected'));
  document.querySelectorAll('.text-block').forEach(t => {
    t.classList.remove('selected', 'editing');
    t.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('contenteditable','false'));
  });
  document.querySelectorAll('.asset-block').forEach(a => {
    a.classList.remove('selected');
    exitImageEditMode(a);
  });
  document.querySelectorAll('.gap-block').forEach(g => g.classList.remove('selected'));
  document.querySelectorAll('.layer-section-header').forEach(h => h.classList.remove('active'));
  document.querySelectorAll('.layer-item').forEach(i => { i.classList.remove('active'); i.style.background = ''; });
  document.querySelectorAll('.layer-row-header').forEach(h => h.classList.remove('active'));
  showPageProperties();
}


function bindSectionDelete(sec) {
  const btns = sec.querySelectorAll('.section-toolbar .st-btn');
  if (btns[2]) {
    btns[2].addEventListener('click', e => {
      e.stopPropagation();
      pushHistory();
      sec.remove();
      deselectAll();
      buildLayerPanel();
    });
  }
}

function bindSectionOrder(sec) {
  const btns = sec.querySelectorAll('.section-toolbar .st-btn');
  if (btns[0]) {
    btns[0].addEventListener('click', e => {
      e.stopPropagation();
      const prev = sec.previousElementSibling;
      if (prev && prev.classList.contains('section-block')) {
        pushHistory();
        canvasEl.insertBefore(sec, prev);
        buildLayerPanel();
        selectSection(sec);
      }
    });
  }
  if (btns[1]) {
    btns[1].addEventListener('click', e => {
      e.stopPropagation();
      const next = sec.nextElementSibling;
      if (next && next.classList.contains('section-block')) {
        pushHistory();
        canvasEl.insertBefore(next, sec);
        buildLayerPanel();
        selectSection(sec);
      }
    });
  }
}

document.querySelectorAll('.section-block').forEach(sec => {
  sec.addEventListener('click', e => { e.stopPropagation(); selectSection(sec); });
  bindSectionDelete(sec);
  bindSectionOrder(sec);
  bindSectionDropZone(sec);
  bindSectionDrag(sec);
});

document.getElementById('canvas-wrap').addEventListener('click', e => {
  if (['canvas-wrap','canvas-scaler','canvas'].includes(e.target.id)) deselectAll();
});

/* ── Static 블록 초기 바인딩 ── */
document.querySelectorAll('.text-block, .asset-block, .gap-block').forEach(b => bindBlock(b));

/* ═══════════════════════════════════
   PROPERTIES PANEL
═══════════════════════════════════ */
const propPanel   = document.querySelector('#panel-right .panel-body');
const canvasEl    = document.getElementById('canvas');
const canvasWrap  = document.getElementById('canvas-wrap');

let pageSettings = { bg: '#141414', gap: 32, padX: 32, padY: 32 };

function showPageProperties() {
  const { bg, gap, padX, padY } = pageSettings;
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1.5"/>
          </svg>
        </div>
        <span class="prop-block-name">Page</span>
      </div>
      <div class="prop-section-title">배경</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${bg}">
          <input type="color" id="page-bg-color" value="${bg}">
        </div>
        <input type="text" class="prop-color-hex" id="page-bg-hex" value="${bg}" maxlength="7">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">섹션 간격</span>
        <input type="range" class="prop-slider" id="section-gap-slider" min="0" max="100" step="4" value="${gap}">
        <input type="number" class="prop-number" id="section-gap-number" min="0" max="100" value="${gap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="page-padx-slider" min="0" max="200" step="4" value="${padX}">
        <input type="number" class="prop-number" id="page-padx-number" min="0" max="200" value="${padX}">
      </div>
      <div class="prop-row">
        <span class="prop-label">상하 패딩</span>
        <input type="range" class="prop-slider" id="page-pady-slider" min="0" max="200" step="4" value="${padY}">
        <input type="number" class="prop-number" id="page-pady-number" min="0" max="200" value="${padY}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">일괄 정렬</div>
      <div class="prop-align-group">
        <button class="prop-align-btn" id="page-align-left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="page-align-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="page-align-right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">내보내기</div>
      <select class="prop-select" id="page-export-format" style="width:100%;margin-bottom:6px;">
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
      </select>
      <button class="prop-export-btn" id="page-export-all-btn">전체 섹션 내보내기</button>
    </div>`;

  const bgPicker = document.getElementById('page-bg-color');
  const bgHex    = document.getElementById('page-bg-hex');
  const bgSwatch = bgPicker.closest('.prop-color-swatch');
  bgPicker.addEventListener('input', () => {
    pageSettings.bg = bgPicker.value;
    canvasWrap.style.background = pageSettings.bg;
    bgHex.value = pageSettings.bg;
    bgSwatch.style.background = pageSettings.bg;
  });
  bgHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(bgHex.value)) {
      pageSettings.bg = bgHex.value;
      bgPicker.value = pageSettings.bg;
      canvasWrap.style.background = pageSettings.bg;
      bgSwatch.style.background = pageSettings.bg;
    }
  });

  const gapSlider = document.getElementById('section-gap-slider');
  const gapNumber = document.getElementById('section-gap-number');
  gapSlider.addEventListener('input', () => {
    pageSettings.gap = parseInt(gapSlider.value);
    canvasEl.style.gap = pageSettings.gap + 'px';
    gapNumber.value = pageSettings.gap;
  });
  gapNumber.addEventListener('input', () => {
    const v = Math.min(100, Math.max(0, parseInt(gapNumber.value) || 0));
    pageSettings.gap = v;
    canvasEl.style.gap = v + 'px';
    gapSlider.value = v;
  });

  const applyPadX = (v) => {
    pageSettings.padX = v;
    document.querySelectorAll('.text-block').forEach(tb => {
      tb.style.paddingLeft = v + 'px';
      tb.style.paddingRight = v + 'px';
    });
  };
  const applyPadY = (v) => {
    pageSettings.padY = v;
    document.querySelectorAll('.text-block').forEach(tb => {
      if (tb.dataset.type === 'label') return;
      tb.style.paddingTop = v + 'px';
      tb.style.paddingBottom = v + 'px';
    });
  };
  const padxSlider = document.getElementById('page-padx-slider');
  const padxNumber = document.getElementById('page-padx-number');
  padxSlider.addEventListener('input', () => { applyPadX(parseInt(padxSlider.value)); padxNumber.value = padxSlider.value; });
  padxNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padxNumber.value)||0)); applyPadX(v); padxSlider.value = v; });

  const padySlider = document.getElementById('page-pady-slider');
  const padyNumber = document.getElementById('page-pady-number');
  padySlider.addEventListener('input', () => { applyPadY(parseInt(padySlider.value)); padyNumber.value = padySlider.value; });
  padyNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padyNumber.value)||0)); applyPadY(v); padySlider.value = v; });

  ['left','center','right'].forEach(align => {
    const btn = document.getElementById(`page-align-${align}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.text-block').forEach(tb => {
        if (tb.querySelector('.tb-label')) { tb.style.textAlign = align; }
        else {
          const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
          if (contentEl) contentEl.style.textAlign = align;
        }
      });
      propPanel.querySelectorAll('#page-align-left,#page-align-center,#page-align-right')
        .forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // 전체 내보내기
  const pageExportBtn = document.getElementById('page-export-all-btn');
  if (pageExportBtn) {
    pageExportBtn.addEventListener('click', async () => {
      const fmt = document.getElementById('page-export-format').value;
      const secCount = canvasEl.querySelectorAll('.section-block').length;
      if (!confirm(`전체 ${secCount}개 섹션을 내보냅니다. 계속할까요?`)) return;
      pageExportBtn.disabled = true;
      pageExportBtn.textContent = '내보내는 중...';
      try {
        await exportAllSections(fmt);
      } finally {
        pageExportBtn.disabled = false;
        pageExportBtn.textContent = '전체 섹션 내보내기';
      }
    });
  }
}

function getCurrentRatioStr(block) {
  const row = block.closest('.row');
  if (!row) return '1*1';
  if (row.dataset.ratioStr) return row.dataset.ratioStr;
  const cols = [...row.querySelectorAll(':scope > .col')];
  if (cols.length <= 1) return '1*1';
  return `${cols.length}*1`;
}

function makeColPlaceholder(col) {
  const ph = document.createElement('div');
  ph.className = 'col-placeholder';
  ph.innerHTML = `
    <button class="col-add-btn">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
        <line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/>
      </svg>
    </button>
    <div class="col-add-menu" style="display:none">
      <button class="col-add-item" data-add="h2">Heading</button>
      <button class="col-add-item" data-add="body">Body</button>
      <button class="col-add-item" data-add="caption">Caption</button>
      <button class="col-add-item" data-add="label">Label</button>
      <div class="col-add-divider"></div>
      <button class="col-add-item" data-add="asset">Asset</button>
    </div>`;

  const btn  = ph.querySelector('.col-add-btn');
  const menu = ph.querySelector('.col-add-menu');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    // 다른 열린 메뉴 닫기
    document.querySelectorAll('.col-add-menu').forEach(m => { if (m !== menu) m.style.display = 'none'; });
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });

  ph.querySelectorAll('.col-add-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      menu.style.display = 'none';
      const type = item.dataset.add;
      let block;
      if (type === 'asset') {
        const ab = document.createElement('div');
        ab.className = 'asset-block';
        ab.style.height = '460px';
        ab.innerHTML = `
          <span class="asset-tag">Image / GIF</span>
          ${ASSET_SVG}
          <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>`;
        block = ab;
      } else {
        const { block: tb } = makeTextBlock(type);
        block = tb;
      }
      col.replaceChild(block, ph);
      bindBlock(block);
      buildLayerPanel();
    });
  });

  return ph;
}

function makeEmptyCol(flexVal) {
  const col = document.createElement('div');
  col.className = 'col';
  if (flexVal) { col.style.flex = flexVal; col.dataset.flex = flexVal; }
  col.appendChild(makeColPlaceholder(col));
  return col;
}

function applyRowLayout(block, ratioStr) {
  const parts = ratioStr.trim().split('*').map(n => parseInt(n.trim())).filter(n => n > 0 && !isNaN(n));
  if (parts.length === 0) return;

  const cols  = parts[0] || 1;
  const rows  = parts[1] || 1;
  const total = cols * rows;

  const row = block.closest('.row');
  if (!row) return;

  const existingCols = [...row.querySelectorAll(':scope > .col')];

  if (cols === 1 && rows === 1) {
    // 단일 셀: stack 복귀
    row.dataset.layout = 'stack';
    row.dataset.ratioStr = '1*1';
    row.style.display = '';
    row.style.gridTemplateColumns = '';
    existingCols.slice(1).forEach(col => col.remove());
    if (existingCols[0]) { existingCols[0].style.flex = ''; delete existingCols[0].dataset.flex; }

  } else if (rows === 1) {
    // Flex row: 여러 열, 1행
    row.dataset.layout = 'flex';
    row.dataset.ratioStr = `${cols}*1`;
    row.style.display = '';
    row.style.gridTemplateColumns = '';
    existingCols.forEach((col, i) => {
      if (i < cols) { col.style.flex = '1'; col.dataset.flex = '1'; }
      else col.remove();
    });
    for (let i = existingCols.length; i < cols; i++) row.appendChild(makeEmptyCol('1'));

  } else {
    // CSS Grid: cols열 × rows행
    row.dataset.layout = 'grid';
    row.dataset.ratioStr = `${cols}*${rows}`;
    row.style.display = 'grid';
    row.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    existingCols.forEach((col, i) => {
      if (i < total) { col.style.flex = ''; delete col.dataset.flex; }
      else col.remove();
    });
    for (let i = existingCols.length; i < total; i++) row.appendChild(makeEmptyCol(null));
  }

  buildLayerPanel();
}

function bindLayoutInput(block) {
  const input = document.getElementById('layout-ratio');
  if (!input) return;
  const apply = () => applyRowLayout(block, input.value);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
  input.addEventListener('blur', apply);
}

function showAssetProperties(ab) {
  const ratioStr   = getCurrentRatioStr(ab);
  const currentH   = parseInt(ab.style.height) || ab.offsetHeight || 780;
  const hasImage   = ab.classList.contains('has-image');
  const currentR   = parseInt(ab.style.borderRadius) || 0;
  const currentW   = ab.offsetWidth || 400;
  const currentAlign = ab.dataset.align || 'left';

  const imageSection = hasImage ? `
    <div class="prop-section">
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn secondary" id="asset-replace-btn">이미지 교체</button>
      <button class="prop-action-btn danger"    id="asset-remove-btn">이미지 제거</button>
    </div>` : `
    <div class="prop-section">
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn primary" id="asset-upload-btn">이미지 선택</button>
      <div style="text-align:center;font-size:11px;color:#555;margin-top:6px;">또는 블록에 파일을 드래그</div>
    </div>`;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1"/>
            <circle cx="4" cy="4" r="1"/>
            <polyline points="11 8 8 5 3 11"/>
          </svg>
        </div>
        <span class="prop-block-name">Asset Block</span>
      </div>
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-layout-input" id="layout-ratio" value="${ratioStr}" placeholder="2*2">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="asset-h-slider" min="100" max="1200" step="20" value="${currentH}">
        <input type="number" class="prop-number" id="asset-h-number" min="100" max="1200" value="${currentH}">
      </div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="asset-w-slider" min="100" max="1200" step="10" value="${currentW}">
        <input type="number" class="prop-number" id="asset-w-number" min="100" max="1200" value="${currentW}">
      </div>
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" id="asset-align-group">
          <button class="prop-align-btn${currentAlign==='left'?' active':''}" data-align="left">←</button>
          <button class="prop-align-btn${currentAlign==='center'?' active':''}" data-align="center">↔</button>
          <button class="prop-align-btn${currentAlign==='right'?' active':''}" data-align="right">→</button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="asset-r-slider" min="0" max="120" step="2" value="${currentR}">
        <input type="number" class="prop-number" id="asset-r-number" min="0" max="120" value="${currentR}">
      </div>
    </div>
    ${imageSection}`;

  bindLayoutInput(ab);

  const applyH = v => {
    const row = ab.closest('.row');
    const targets = (row && row.dataset.layout !== 'stack')
      ? [...row.querySelectorAll(':scope > .col > .asset-block')]
      : [ab];
    targets.forEach(b => b.style.height = v + 'px');
  };
  const hSlider = document.getElementById('asset-h-slider');
  const hNumber = document.getElementById('asset-h-number');
  hSlider.addEventListener('input', () => { applyH(parseInt(hSlider.value)); hNumber.value = hSlider.value; });
  hNumber.addEventListener('input', () => {
    const v = Math.min(1200, Math.max(100, parseInt(hNumber.value) || 100));
    applyH(v); hSlider.value = v;
  });

  const wSlider = document.getElementById('asset-w-slider');
  const wNumber = document.getElementById('asset-w-number');
  const applyW = v => { ab.style.width = v + 'px'; };
  wSlider.addEventListener('input', () => { applyW(parseInt(wSlider.value)); wNumber.value = wSlider.value; });
  wNumber.addEventListener('input', () => {
    const v = Math.min(1200, Math.max(100, parseInt(wNumber.value) || 100));
    applyW(v); wSlider.value = v;
  });

  const applyAlign = a => {
    ab.dataset.align = a;
    if (a === 'left')   ab.style.alignSelf = 'flex-start';
    if (a === 'center') ab.style.alignSelf = 'center';
    if (a === 'right')  ab.style.alignSelf = 'flex-end';
    document.querySelectorAll('#asset-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === a));
  };
  document.querySelectorAll('#asset-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => applyAlign(btn.dataset.align));
  });

  const rSlider = document.getElementById('asset-r-slider');
  const rNumber = document.getElementById('asset-r-number');
  const applyR = v => { ab.style.borderRadius = v + 'px'; };
  rSlider.addEventListener('input', () => { applyR(parseInt(rSlider.value)); rNumber.value = rSlider.value; });
  rNumber.addEventListener('input', () => {
    const v = Math.min(120, Math.max(0, parseInt(rNumber.value) || 0));
    applyR(v); rSlider.value = v;
  });

  if (hasImage) {
    document.getElementById('asset-replace-btn').addEventListener('click', () => triggerAssetUpload(ab));
    document.getElementById('asset-remove-btn').addEventListener('click', () => clearAssetImage(ab));
  } else {
    document.getElementById('asset-upload-btn').addEventListener('click', () => triggerAssetUpload(ab));
  }
}

function showTextProperties(tb) {
  const contentEl = tb.querySelector('[contenteditable]');
  const computed   = window.getComputedStyle(contentEl);

  const currentClass = ['tb-h1','tb-h2','tb-body','tb-caption','tb-label'].find(c => contentEl.classList.contains(c)) || 'tb-body';
  const rawBg = window.getComputedStyle(contentEl).backgroundColor;
  const currentBgColor = (!rawBg || rawBg === 'rgba(0, 0, 0, 0)' || rawBg === 'transparent') ? '#111111' : (rgbToHex(rawBg) || '#111111');
  const currentRadius = parseInt(contentEl.style.borderRadius) || 4;
  const isLabel = currentClass === 'tb-label';
  const currentAlign = isLabel ? (tb.style.textAlign || 'left') : (contentEl.style.textAlign || 'left');
  const currentSize  = parseInt(computed.fontSize) || 15;
  const currentColor = rgbToHex(computed.color) || '#111111';
  const currentLH    = (parseFloat(computed.lineHeight) / parseFloat(computed.fontSize) || 1.5).toFixed(2);
  const currentLS    = parseFloat(contentEl.style.letterSpacing) || 0;
  const defaultPad   = isLabel ? 0 : pageSettings.padY;
  const currentPadT  = tb.style.paddingTop    ? (parseInt(tb.style.paddingTop)    || 0) : defaultPad;
  const currentPadB  = tb.style.paddingBottom ? (parseInt(tb.style.paddingBottom) || 0) : defaultPad;
  const currentFont  = contentEl.style.fontFamily || '';

  const ratioStr = getCurrentRatioStr(tb);
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="11" y2="6"/><line x1="1" y1="9" x2="7" y2="9"/>
          </svg>
        </div>
        <span class="prop-block-name">Text Block</span>
      </div>
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-layout-input" id="layout-ratio" value="${ratioStr}" placeholder="1*2*1">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">타입</div>
      <div class="prop-type-group">
        <button class="prop-type-btn ${currentClass==='tb-h1'?'active':''}"      data-cls="tb-h1">H1</button>
        <button class="prop-type-btn ${currentClass==='tb-h2'?'active':''}"      data-cls="tb-h2">H2</button>
        <button class="prop-type-btn ${currentClass==='tb-body'?'active':''}"    data-cls="tb-body">Body</button>
        <button class="prop-type-btn ${currentClass==='tb-caption'?'active':''}" data-cls="tb-caption">Cap</button>
        <button class="prop-type-btn ${currentClass==='tb-label'?'active':''}"   data-cls="tb-label">Tag</button>
      </div>
    </div>
    <div id="label-style-section" style="display:${isLabel?'block':'none'}">
      <div class="prop-section">
        <div class="prop-section-title">태그 스타일</div>
        <div class="prop-color-row">
          <span class="prop-label">배경색</span>
          <div class="prop-color-swatch${currentBgColor==='transparent'?' swatch-none':''}" style="background:${currentBgColor==='transparent'?'transparent':currentBgColor}">
            <input type="color" id="label-bg-color" value="${currentBgColor==='transparent'?'#111111':currentBgColor}">
          </div>
          <input type="text" class="prop-color-hex" id="label-bg-hex" value="${currentBgColor==='transparent'?'':currentBgColor}" maxlength="7" placeholder="없음">
          <label class="prop-none-check"><input type="checkbox" id="label-bg-none" ${currentBgColor==='transparent'?'checked':''}>없음</label>
        </div>
        <div class="prop-row">
          <span class="prop-label">모서리</span>
          <input type="range" class="prop-slider" id="label-radius-slider" min="0" max="40" step="1" value="${currentRadius}">
          <input type="number" class="prop-number" id="label-radius-number" min="0" max="40" value="${currentRadius}">
        </div>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">정렬</div>
      <div class="prop-align-group">
        <button class="prop-align-btn ${currentAlign==='left'||currentAlign===''?'active':''}" data-align="left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn ${currentAlign==='center'?'active':''}" data-align="center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn ${currentAlign==='right'?'active':''}" data-align="right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">폰트</div>
      <div class="prop-row">
        <span class="prop-label">종류</span>
        <select class="prop-select" id="txt-font-family">
          <option value="" style="font-family:inherit"           ${currentFont===''?'selected':''}>기본 (시스템)</option>
          <optgroup label="── 한글 ──">
            <option value="'Noto Sans KR', sans-serif"          ${currentFont.includes('Noto Sans KR')?'selected':''}>Noto Sans KR</option>
            <option value="'Noto Serif KR', serif"              ${currentFont.includes('Noto Serif KR')?'selected':''}>Noto Serif KR</option>
          </optgroup>
          <optgroup label="── 영문 ──">
            <option value="'Inter', sans-serif"                 ${currentFont.includes('Inter')?'selected':''}>Inter</option>
            <option value="'Space Grotesk', sans-serif"         ${currentFont.includes('Space Grotesk')?'selected':''}>Space Grotesk</option>
            <option value="'Playfair Display', serif"           ${currentFont.includes('Playfair Display')?'selected':''}>Playfair Display</option>
          </optgroup>
          <optgroup label="── 시스템 ──">
            <option value="sans-serif"                          ${currentFont==='sans-serif'?'selected':''}>Sans-serif</option>
            <option value="serif"                               ${currentFont==='serif'?'selected':''}>Serif</option>
            <option value="monospace"                           ${currentFont==='monospace'?'selected':''}>Monospace</option>
          </optgroup>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="txt-size-slider" min="8" max="400" step="1" value="${currentSize}">
        <input type="number" class="prop-number" id="txt-size-number" min="8" max="400" value="${currentSize}">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">색상</span>
        <div class="prop-color-swatch" style="background:${currentColor}">
          <input type="color" id="txt-color" value="${currentColor}">
        </div>
        <input type="text" class="prop-color-hex" id="txt-color-hex" value="${currentColor}" maxlength="7">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">간격</div>
      <div class="prop-row">
        <span class="prop-label">줄간격</span>
        <input type="range" class="prop-slider" id="txt-lh-slider" min="1" max="3" step="0.05" value="${currentLH}">
        <input type="number" class="prop-number" id="txt-lh-number" min="1" max="3" step="0.05" value="${currentLH}">
      </div>
      <div class="prop-row">
        <span class="prop-label">자간</span>
        <input type="range" class="prop-slider" id="txt-ls-slider" min="-10" max="40" step="0.5" value="${currentLS}">
        <input type="number" class="prop-number" id="txt-ls-number" min="-10" max="40" step="0.5" value="${currentLS}">
      </div>
      <div class="prop-row">
        <span class="prop-label">상단</span>
        <input type="range" class="prop-slider" id="txt-pt-slider" min="0" max="120" step="4" value="${currentPadT}">
        <input type="number" class="prop-number" id="txt-pt-number" min="0" max="120" value="${currentPadT}">
      </div>
      <div class="prop-row">
        <span class="prop-label">하단</span>
        <input type="range" class="prop-slider" id="txt-pb-slider" min="0" max="120" step="4" value="${currentPadB}">
        <input type="number" class="prop-number" id="txt-pb-number" min="0" max="120" value="${currentPadB}">
      </div>
    </div>`;

  /* 폰트 종류 */
  document.getElementById('txt-font-family').addEventListener('change', e => {
    contentEl.style.fontFamily = e.target.value;
  });

  /* 타입 전환 */
  const labelMap = { 'tb-h1':'Heading','tb-h2':'Heading','tb-body':'Body','tb-caption':'Caption','tb-label':'Label' };
  const typeMap2 = { 'tb-h1':'heading','tb-h2':'heading','tb-body':'body','tb-caption':'caption','tb-label':'label' };
  propPanel.querySelectorAll('.prop-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cls = btn.dataset.cls;
      contentEl.className = cls;
      tb.querySelector('.text-block-label').textContent = labelMap[cls];
      tb.dataset.type = typeMap2[cls];
      propPanel.querySelectorAll('.prop-type-btn').forEach(b => b.classList.toggle('active', b===btn));

      const labelSection = document.getElementById('label-style-section');
      if (labelSection) labelSection.style.display = cls === 'tb-label' ? 'block' : 'none';

      // label로 전환 시 기본 스타일 적용, 다른 타입으로 전환 시 초기화
      if (cls === 'tb-label') {
        if (!contentEl.style.backgroundColor) contentEl.style.backgroundColor = '#111111';
        if (!contentEl.style.color) contentEl.style.color = '#ffffff';
        if (!contentEl.style.borderRadius) contentEl.style.borderRadius = '4px';
      } else {
        contentEl.style.backgroundColor = '';
        contentEl.style.borderRadius = '';
      }
    });
  });

  /* 태그 배경색 */
  const labelBgPicker = document.getElementById('label-bg-color');
  const labelBgHex    = document.getElementById('label-bg-hex');
  const labelBgNone   = document.getElementById('label-bg-none');
  if (labelBgPicker) {
    const labelBgSwatch = labelBgPicker.closest('.prop-color-swatch');
    const setLabelBg = (val) => {
      const isNone = val === 'transparent';
      contentEl.style.backgroundColor = val;
      contentEl.style.padding = isNone ? '0' : '';
      contentEl.style.borderRadius = isNone ? '0' : (contentEl.style.borderRadius || '');
      labelBgSwatch.style.background = isNone ? 'transparent' : val;
      labelBgSwatch.classList.toggle('swatch-none', isNone);
      if (!isNone) { labelBgHex.value = val; labelBgPicker.value = val; }
    };
    labelBgPicker.addEventListener('input', () => {
      if (labelBgNone.checked) return;
      setLabelBg(labelBgPicker.value);
      labelBgHex.value = labelBgPicker.value;
    });
    labelBgHex.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(labelBgHex.value)) { setLabelBg(labelBgHex.value); labelBgNone.checked = false; }
    });
    labelBgNone.addEventListener('change', () => {
      if (labelBgNone.checked) { setLabelBg('transparent'); labelBgHex.value = ''; }
      else {
        contentEl.style.padding = '';
        const v = labelBgPicker.value || '#111111';
        setLabelBg(v); labelBgHex.value = v;
      }
    });
  }
  /* 태그 모서리 */
  const rSlider = document.getElementById('label-radius-slider');
  const rNumber = document.getElementById('label-radius-number');
  if (rSlider) {
    rSlider.addEventListener('input', () => { contentEl.style.borderRadius = rSlider.value+'px'; rNumber.value = rSlider.value; });
    rNumber.addEventListener('input', () => {
      const v = Math.min(40, Math.max(0, parseInt(rNumber.value)||0));
      contentEl.style.borderRadius = v+'px'; rSlider.value = v;
    });
  }

  /* 정렬 */
  propPanel.querySelectorAll('.prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // label(inline-block)은 부모 tb에 text-align 적용해야 블록 자체가 정렬됨
      if (contentEl.classList.contains('tb-label')) {
        tb.style.textAlign = btn.dataset.align;
      } else {
        contentEl.style.textAlign = btn.dataset.align;
      }
      propPanel.querySelectorAll('.prop-align-btn').forEach(b => b.classList.toggle('active', b===btn));
    });
  });

  /* 폰트 크기 */
  const sizeSlider = document.getElementById('txt-size-slider');
  const sizeNumber = document.getElementById('txt-size-number');
  sizeSlider.addEventListener('input', () => { contentEl.style.fontSize = sizeSlider.value+'px'; sizeNumber.value = sizeSlider.value; });
  sizeNumber.addEventListener('input', () => {
    const v = Math.min(400, Math.max(8, parseInt(sizeNumber.value)||8));
    contentEl.style.fontSize = v+'px'; sizeSlider.value = v;
  });

  /* 색상 */
  const colorPicker = document.getElementById('txt-color');
  const colorHex    = document.getElementById('txt-color-hex');
  const colorSwatch = colorPicker.closest('.prop-color-swatch');
  colorPicker.addEventListener('input', () => {
    contentEl.style.color = colorPicker.value;
    colorHex.value = colorPicker.value;
    colorSwatch.style.background = colorPicker.value;
  });
  colorHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(colorHex.value)) {
      colorPicker.value = colorHex.value;
      contentEl.style.color = colorHex.value;
      colorSwatch.style.background = colorHex.value;
    }
  });

  /* 줄간격 */
  const lhSlider = document.getElementById('txt-lh-slider');
  const lhNumber = document.getElementById('txt-lh-number');
  lhSlider.addEventListener('input', () => { contentEl.style.lineHeight = lhSlider.value; lhNumber.value = parseFloat(lhSlider.value).toFixed(2); });
  lhNumber.addEventListener('input', () => {
    const v = Math.min(3, Math.max(1, parseFloat(lhNumber.value)||1));
    contentEl.style.lineHeight = v; lhSlider.value = v;
  });

  /* 자간 */
  const lsSlider = document.getElementById('txt-ls-slider');
  const lsNumber = document.getElementById('txt-ls-number');
  lsSlider.addEventListener('input', () => { contentEl.style.letterSpacing = lsSlider.value + 'px'; lsNumber.value = lsSlider.value; });
  lsNumber.addEventListener('input', () => {
    const v = Math.min(40, Math.max(-10, parseFloat(lsNumber.value) || 0));
    contentEl.style.letterSpacing = v + 'px'; lsSlider.value = v;
  });

  /* 패딩 */
  const ptSlider = document.getElementById('txt-pt-slider');
  const ptNumber = document.getElementById('txt-pt-number');
  const pbSlider = document.getElementById('txt-pb-slider');
  const pbNumber = document.getElementById('txt-pb-number');
  ptSlider.addEventListener('input', () => { tb.style.paddingTop    = ptSlider.value+'px'; ptNumber.value = ptSlider.value; });
  ptNumber.addEventListener('input', () => { const v=Math.min(120,Math.max(0,parseInt(ptNumber.value)||0)); tb.style.paddingTop=v+'px'; ptSlider.value=v; });
  pbSlider.addEventListener('input', () => { tb.style.paddingBottom = pbSlider.value+'px'; pbNumber.value = pbSlider.value; });
  pbNumber.addEventListener('input', () => { const v=Math.min(120,Math.max(0,parseInt(pbNumber.value)||0)); tb.style.paddingBottom=v+'px'; pbSlider.value=v; });

  bindLayoutInput(tb);
}

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return '#111111';
  return '#' + m.slice(0,3).map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
}

function showGapProperties(gb) {
  const currentH = gb.offsetHeight;
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="4" x2="11" y2="4" stroke-dasharray="2,1"/>
            <line x1="1" y1="8" x2="11" y2="8" stroke-dasharray="2,1"/>
          </svg>
        </div>
        <span class="prop-block-name">Gap Block</span>
      </div>
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="gap-slider" min="0" max="400" step="4" value="${currentH}">
        <input type="number" class="prop-number" id="gap-number" min="0" max="400" value="${currentH}">
      </div>
    </div>`;

  const slider = document.getElementById('gap-slider');
  const number = document.getElementById('gap-number');

  slider.addEventListener('input', () => {
    gb.style.height = slider.value + 'px';
    number.value = slider.value;
  });
  number.addEventListener('input', () => {
    const v = Math.min(400, Math.max(0, parseInt(number.value) || 0));
    gb.style.height = v + 'px';
    slider.value = v;
  });
}

/* ═══════════════════════════════════
   BLOCK / SECTION 추가
═══════════════════════════════════ */
const ASSET_SVG = `
  <svg class="asset-icon" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>`;

function getSelectedSection() {
  return document.querySelector('.section-block.selected');
}

/* ═══════════════════════════════════
   DRAG AND DROP
═══════════════════════════════════ */
let dragSrc = null;
let layerDragSrc = null;
let sectionDragSrc = null;
let layerSectionDragSrc = null;

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
    buildLayerPanel();
    dragSrc = null;
  });
}

function bindBlock(block) {
  if (block._blockBound) return;
  block._blockBound = true;
  const isText  = block.classList.contains('text-block');
  const isGap   = block.classList.contains('gap-block');
  const isAsset = block.classList.contains('asset-block');

  if (isText) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      deselectAll();
      block.classList.add('selected');
      syncSection(block.closest('.section-block'));
      highlightBlock(block, block._layerItem);
      showTextProperties(block);
    });
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      block.classList.add('editing');
      block.querySelectorAll('[contenteditable]').forEach(el => {
        el.setAttribute('contenteditable', 'true');
        el.focus();
      });
    });
  }

  if (isAsset) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      deselectAll();
      block.classList.add('selected');
      syncSection(block.closest('.section-block'));
      highlightBlock(block, block._layerItem);
      showAssetProperties(block);
    });
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      if (block.classList.contains('has-image')) {
        enterImageEditMode(block);
      } else {
        triggerAssetUpload(block);
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
      if (file && file.type.startsWith('image/')) loadImageToAsset(block, file);
    });
    // 로드/undo 후 has-image 상태 복원
    if (block.classList.contains('has-image')) {
      const overlayBtn = block.querySelector('.asset-overlay-clear');
      if (overlayBtn) overlayBtn.addEventListener('click', e => {
        e.stopPropagation();
        clearAssetImage(block);
      });
      // 수동 편집된 위치/크기 복원 (imgW가 있으면 절대 위치 모드)
      applyImageTransform(block);
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
      deselectAll();
      block.classList.add('selected');
      syncSection(block.closest('.section-block'));
      highlightBlock(block, block._layerItem);
      showGapProperties(block);
    });
  }

  // hover ↔ layer item
  block.addEventListener('mouseenter', () => { if (block._layerItem) block._layerItem.style.background = '#252525'; });
  block.addEventListener('mouseleave', () => { if (block._layerItem && !block._layerItem.classList.contains('active')) block._layerItem.style.background = ''; });

  // 드래그 이벤트
  const dragTarget = isGap ? block : (block.closest('.row') || block);
  if (dragTarget && !dragTarget._dragBound) {
    dragTarget._dragBound = true;
    dragTarget.setAttribute('draggable', 'true');
    if (isText) block.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('draggable', 'false'));

    dragTarget.addEventListener('dragstart', e => {
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
  const classMap  = { h1:'tb-h1', h2:'tb-h2', body:'tb-body', caption:'tb-caption', label:'tb-label' };
  const labelMap  = { h1:'Heading', h2:'Heading', body:'Body', caption:'Caption', label:'Label' };
  const dataType  = (type==='h1'||type==='h2') ? 'heading' : type;
  const placeholder = { h1:'제목을 입력하세요', h2:'소제목을 입력하세요', body:'본문을 입력하세요', caption:'캡션을 입력하세요', label:'Label' };

  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const tb = document.createElement('div');
  tb.className = 'text-block'; tb.dataset.type = dataType;
  tb.innerHTML = `
    <span class="text-block-label">${labelMap[type]}</span>
    <div class="${classMap[type]}" contenteditable="false">${placeholder[type]}</div>`;

  if (pageSettings.padX > 0) { tb.style.paddingLeft = pageSettings.padX + 'px'; tb.style.paddingRight = pageSettings.padX + 'px'; }
  if (type !== 'label') {
    tb.style.paddingTop = pageSettings.padY + 'px';
    tb.style.paddingBottom = pageSettings.padY + 'px';
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
  ab.innerHTML = `
    <span class="asset-tag">Image / GIF</span>
    ${ASSET_SVG}
    <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>`;

  col.appendChild(ab);
  row.appendChild(col);
  return { row, block: ab };
}

function makeGapBlock() {
  const gb = document.createElement('div');
  gb.className = 'gap-block'; gb.dataset.type = 'gap';
  return gb;
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
  const sel = document.querySelector('.text-block.selected, .asset-block.selected, .gap-block.selected');

  if (sel && sel.closest('.section-block') === section) {
    const isGap = sel.classList.contains('gap-block');
    const ref = isGap ? sel : (sel.closest('.row') || sel);
    ref.after(el);
  } else {
    insertBeforeBottomGap(section, el);
  }
}

function addTextBlock(type) {
  const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
  if (!sec) return;
  pushHistory();
  const { row, block } = makeTextBlock(type);
  insertAfterSelected(sec, row);
  bindBlock(block);
  buildLayerPanel();
  selectSection(sec);
}

function addRowBlock() {
  const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
  if (!sec) return;
  pushHistory();
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.layout = 'flex';
  row.dataset.ratioStr = '2*1';

  [0, 1].forEach(() => {
    const col = document.createElement('div');
    col.className = 'col';
    col.style.flex = '1';
    col.dataset.flex = '1';
    col.appendChild(makeColPlaceholder(col));
    row.appendChild(col);
  });

  insertAfterSelected(sec, row);
  buildLayerPanel();
  selectSection(sec);
}

function addAssetBlock() {
  const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
  if (!sec) return;
  pushHistory();
  const { row, block } = makeAssetBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
  buildLayerPanel();
  selectSection(sec);
}

function addGapBlock() {
  const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
  if (!sec) return;
  pushHistory();
  const gb = makeGapBlock();
  insertAfterSelected(sec, gb);
  bindBlock(gb);
  buildLayerPanel();
  selectSection(sec);
}

function addSection() {
  const canvas  = document.getElementById('canvas');
  const secList = canvas.querySelectorAll('.section-block');
  const newIdx  = secList.length + 1;

  const sec = document.createElement('div');
  sec.className = 'section-block'; sec.dataset.section = newIdx;
  sec.innerHTML = `
    <span class="section-label">Section ${String(newIdx).padStart(2,'0')}</span>
    <div class="section-toolbar">
      <button class="st-btn">↑</button>
      <button class="st-btn">↓</button>
      <button class="st-btn" style="color:#e06c6c;">✕</button>
    </div>
    <div class="section-inner">
      <div class="gap-block" data-type="gap"></div>
      <div class="row" data-layout="stack">
        <div class="col" data-width="100">
          <div class="text-block" data-type="heading">
            <span class="text-block-label">Heading</span>
            <div class="tb-h2" contenteditable="false">새 섹션 제목</div>
          </div>
        </div>
      </div>
      <div class="row" data-layout="stack">
        <div class="col" data-width="100">
          <div class="asset-block">
            <span class="asset-tag">Image / GIF</span>
            ${ASSET_SVG}
            <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>
          </div>
        </div>
      </div>
      <div class="gap-block" data-type="gap"></div>
    </div>`;

  const selectedSec = document.querySelector('.section-block.selected');
  if (selectedSec) selectedSec.after(sec);
  else canvas.appendChild(sec);

  // 이벤트 바인딩
  pushHistory();
  sec.addEventListener('click', e => { e.stopPropagation(); selectSection(sec); });
  bindSectionDelete(sec);
  bindSectionOrder(sec);
  bindSectionDropZone(sec);
  bindSectionDrag(sec);
  sec.querySelectorAll('.text-block, .asset-block, .gap-block').forEach(b => bindBlock(b));

  buildLayerPanel();
  selectSection(sec);
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── 플로팅 패널 Text 드롭다운 ── */
function toggleFpDropdown() {
  document.getElementById('fp-text-dropdown').classList.toggle('open');
}
document.addEventListener('click', e => {
  const dd = document.getElementById('fp-text-dropdown');
  if (dd && !dd.contains(e.target)) dd.classList.remove('open');
  if (!e.target.closest('.col-add-btn') && !e.target.closest('.col-add-menu')) {
    document.querySelectorAll('.col-add-menu').forEach(m => m.style.display = 'none');
  }
});

/* ══════════════════════════════════════
   저장 / 불러오기
══════════════════════════════════════ */
const SAVE_KEY = 'web-editor-autosave';
let autoSaveTimer = null;

function getSerializedCanvas() {
  // section data-name 속성 동기화
  canvasEl.querySelectorAll('.section-block').forEach(sec => {
    if (sec._name) sec.dataset.name = sec._name;
  });
  // 핸들/힌트 등 상태 요소는 직렬화에서 제외
  const clone = canvasEl.cloneNode(true);
  clone.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edit-hint').forEach(el => el.remove());
  return clone.innerHTML;
}

function serializeProject() {
  return JSON.stringify({ version: 1, pageSettings, canvas: getSerializedCanvas() });
}

function applyProjectData(data) {
  if (data.pageSettings) Object.assign(pageSettings, data.pageSettings);
  canvasEl.innerHTML = data.canvas || '';
  rebindAll();
  applyPageSettings();
  buildLayerPanel();
  showPageProperties();
}

function applyPageSettings() {
  canvasWrap.style.background = pageSettings.bg;
  canvasEl.style.gap = pageSettings.gap + 'px';
  canvasEl.querySelectorAll('.text-block').forEach(tb => {
    tb.style.paddingLeft  = pageSettings.padX + 'px';
    tb.style.paddingRight = pageSettings.padX + 'px';
    if (tb.dataset.type !== 'label') {
      tb.style.paddingTop    = pageSettings.padY + 'px';
      tb.style.paddingBottom = pageSettings.padY + 'px';
    }
  });
}

function rebindAll() {
  canvasEl.querySelectorAll('.section-block').forEach(sec => {
    if (sec.dataset.name) sec._name = sec.dataset.name;
    sec.addEventListener('click', e => { e.stopPropagation(); selectSection(sec); });
    bindSectionDelete(sec);
    bindSectionOrder(sec);
    bindSectionDrag(sec);
    bindSectionDropZone(sec);
  });
  canvasEl.querySelectorAll('.text-block, .asset-block, .gap-block').forEach(b => bindBlock(b));
  // col-placeholder 이벤트 재연결
  canvasEl.querySelectorAll('.col > .col-placeholder').forEach(ph => {
    const col = ph.parentElement;
    const fresh = makeColPlaceholder(col);
    col.replaceChild(fresh, ph);
  });
}

function saveProject() {
  const json = serializeProject();
  localStorage.setItem(SAVE_KEY, json);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `web-editor-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function loadProjectFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      applyProjectData(data);
    } catch { alert('올바른 프로젝트 파일이 아닙니다.'); }
  };
  reader.readAsText(file);
  e.target.value = ''; // 같은 파일 재선택 허용
}

function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    localStorage.setItem(SAVE_KEY, serializeProject());
  }, 1500);
}

// 변경 감지 — canvas MutationObserver
const autoSaveObserver = new MutationObserver(scheduleAutoSave);

/* ── Init ── */
canvasWrap.style.background = pageSettings.bg;
canvasEl.style.gap = pageSettings.gap + 'px';
document.querySelectorAll('.text-block').forEach(tb => {
  if (pageSettings.padX > 0) { tb.style.paddingLeft = pageSettings.padX + 'px'; tb.style.paddingRight = pageSettings.padX + 'px'; }
  if (tb.dataset.type !== 'label') {
    tb.style.paddingTop = pageSettings.padY + 'px';
    tb.style.paddingBottom = pageSettings.padY + 'px';
  }
});

// 자동저장 복원
const saved = localStorage.getItem(SAVE_KEY);
if (saved) {
  try {
    const data = JSON.parse(saved);
    applyProjectData(data);
  } catch { buildLayerPanel(); showPageProperties(); }
} else {
  buildLayerPanel();
  showPageProperties();
}

autoSaveObserver.observe(canvasEl, { childList: true, subtree: true, attributes: true, characterData: true });

// 초기 스냅샷
pushHistory();

/* 캔버스 — 섹션 드래그 드롭 */
canvasEl.addEventListener('dragover', e => {
  if (!sectionDragSrc) return;
  e.preventDefault();
  clearSectionIndicators();
  const after = getSectionDragAfterEl(canvasEl, e.clientY);
  const indicator = document.createElement('div');
  indicator.className = 'section-drop-indicator';
  if (after) canvasEl.insertBefore(indicator, after);
  else canvasEl.appendChild(indicator);
});
canvasEl.addEventListener('dragleave', e => {
  if (!sectionDragSrc) return;
  if (!canvasEl.contains(e.relatedTarget)) clearSectionIndicators();
});
canvasEl.addEventListener('drop', e => {
  if (!sectionDragSrc) return;
  e.preventDefault();
  const indicator = canvasEl.querySelector('.section-drop-indicator');
  if (indicator) canvasEl.insertBefore(sectionDragSrc, indicator);
  else canvasEl.appendChild(sectionDragSrc);
  clearSectionIndicators();
  buildLayerPanel();
  sectionDragSrc = null;
});

/* ══════════════════════════════════════
   이미지 업로드 (Asset)
══════════════════════════════════════ */
/* ── 이미지 위치/스케일 복원 (로드·undo 후) ── */
function applyImageTransform(ab) {
  const img = ab.querySelector('.asset-img');
  if (!img || !ab.dataset.imgW) return;
  img.style.position  = 'absolute';
  img.style.objectFit = 'cover';
  img.style.width     = ab.dataset.imgW + 'px';
  img.style.height    = 'auto';
  img.style.left      = (parseFloat(ab.dataset.imgX) || 0) + 'px';
  img.style.top       = (parseFloat(ab.dataset.imgY) || 0) + 'px';
}

function enterImageEditMode(ab) {
  if (ab._imgEditing) return;
  const img = ab.querySelector('.asset-img');
  if (!img) return;

  ab._imgEditing = true;
  ab.classList.add('img-editing');
  ab.draggable = false;
  ab.style.overflow = 'visible'; // 핸들이 프레임 밖에 위치할 수 있도록
  const _row = ab.closest('.row');
  if (_row) _row.draggable = false; // 부모 row의 drag가 핸들 mousedown을 가로채지 않도록

  const frameW = ab.offsetWidth;
  const frameH = ab.offsetHeight;

  if (ab.dataset.imgW) {
    applyImageTransform(ab);
  } else {
    const ratio = (img.naturalWidth / img.naturalHeight) || 1;
    const initW = frameW;
    const initH = initW / ratio;
    img.style.position  = 'absolute';
    img.style.width     = initW + 'px';
    img.style.height    = 'auto';
    img.style.left      = '0px';
    img.style.top       = ((frameH - initH) / 2) + 'px';
    ab.dataset.imgW = initW;
    ab.dataset.imgX = 0;
    ab.dataset.imgY = (frameH - initH) / 2;
  }
  img.style.objectFit = 'fill'; // 편집 모드 중 스케일 반영
  img.draggable = false;

  // 우측 패널 — 이미지 편집 프로퍼티
  function renderImgPanel() {
    const x = Math.round(parseFloat(img.style.left) || 0);
    const y = Math.round(parseFloat(img.style.top)  || 0);
    const w = Math.round(img.offsetWidth);
    propPanel.innerHTML = `
      <div class="prop-section">
        <div class="prop-block-label">
          <div class="prop-block-icon">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
              <rect x="1" y="1" width="10" height="10" rx="1"/>
              <circle cx="4" cy="4" r="1"/>
              <polyline points="11 8 8 5 3 11"/>
            </svg>
          </div>
          <span class="prop-block-name">이미지 편집</span>
        </div>
        <div class="prop-section-title">위치</div>
        <div class="prop-row">
          <span class="prop-label">X</span>
          <input type="number" class="prop-number" id="img-x" style="width:64px" value="${x}">
        </div>
        <div class="prop-row">
          <span class="prop-label">Y</span>
          <input type="number" class="prop-number" id="img-y" style="width:64px" value="${y}">
        </div>
      </div>
      <div class="prop-section">
        <div class="prop-section-title">크기</div>
        <div class="prop-row">
          <span class="prop-label">너비</span>
          <input type="number" class="prop-number" id="img-w" style="width:64px" value="${w}" min="40">
        </div>
        <div class="prop-row">
          <span class="prop-label">높이</span>
          <input type="number" class="prop-number" id="img-h" style="width:64px" value="${Math.round(img.offsetHeight)}" disabled>
        </div>
      </div>
      <div class="prop-section" style="color:#555;font-size:11px;padding-top:0;">
        Esc 또는 블록 밖 클릭으로 편집 종료
      </div>`;

    document.getElementById('img-x').addEventListener('input', e => {
      img.style.left = (parseInt(e.target.value) || 0) + 'px';
      ab.dataset.imgX = parseInt(e.target.value) || 0;
      syncHandles();
    });
    document.getElementById('img-y').addEventListener('input', e => {
      img.style.top = (parseInt(e.target.value) || 0) + 'px';
      ab.dataset.imgY = parseInt(e.target.value) || 0;
      syncHandles();
    });
    document.getElementById('img-w').addEventListener('input', e => {
      const v = Math.max(40, parseInt(e.target.value) || 40);
      img.style.width = v + 'px';
      ab.dataset.imgW = v;
      syncHandles();
      // 높이 업데이트
      const hEl = document.getElementById('img-h');
      if (hEl) hEl.value = Math.round(img.offsetHeight);
    });
  }

  // 드래그/스케일 후 패널 값 동기화
  function syncPanel() {
    const xEl = document.getElementById('img-x');
    const yEl = document.getElementById('img-y');
    const wEl = document.getElementById('img-w');
    const hEl = document.getElementById('img-h');
    if (xEl) xEl.value = Math.round(parseFloat(img.style.left) || 0);
    if (yEl) yEl.value = Math.round(parseFloat(img.style.top)  || 0);
    if (wEl) wEl.value = Math.round(img.offsetWidth);
    if (hEl) hEl.value = Math.round(img.offsetHeight);
  }

  // 4 모서리 핸들 생성
  const CORNERS = [
    { id: 'tl', cursor: 'nwse-resize' },
    { id: 'tr', cursor: 'nesw-resize' },
    { id: 'bl', cursor: 'nesw-resize' },
    { id: 'br', cursor: 'nwse-resize' },
  ];
  const cornerEls = {};
  CORNERS.forEach(({ id, cursor }) => {
    const h = document.createElement('div');
    h.className = 'img-corner-handle';
    h.style.cursor = cursor;
    h.draggable = false;
    h.addEventListener('dragstart', e => e.preventDefault());
    ab.appendChild(h);
    cornerEls[id] = h;
  });

  const hint = document.createElement('div');
  hint.className = 'img-edit-hint';
  hint.textContent = '드래그: 위치 · 모서리: 크기 · Esc: 완료';
  ab.appendChild(hint);

  // 핸들 위치를 이미지 4 모서리에 동기화
  const HS = 5; // 핸들 절반 크기 (10px / 2)
  function syncHandles() {
    const x = parseFloat(img.style.left) || 0;
    const y = parseFloat(img.style.top)  || 0;
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    const pos = {
      tl: [x - HS,     y - HS    ],
      tr: [x + w - HS, y - HS    ],
      bl: [x - HS,     y + h - HS],
      br: [x + w - HS, y + h - HS],
    };
    Object.entries(pos).forEach(([id, [lx, ly]]) => {
      cornerEls[id].style.left = lx + 'px';
      cornerEls[id].style.top  = ly + 'px';
    });
  }
  syncHandles();

  // 이미지 드래그 (위치)
  function onImgDown(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const zs = currentZoom / 100;
    const sx = e.clientX, sy = e.clientY;
    const sl = parseFloat(img.style.left) || 0;
    const st = parseFloat(img.style.top)  || 0;
    function onMove(e) {
      img.style.left = (sl + (e.clientX - sx) / zs) + 'px';
      img.style.top  = (st + (e.clientY - sy) / zs) + 'px';
      syncHandles(); syncPanel();
    }
    function onUp() {
      ab.dataset.imgX = parseFloat(img.style.left) || 0;
      ab.dataset.imgY = parseFloat(img.style.top)  || 0;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // 모서리 드래그 (스케일 — 반대 모서리 앵커 고정)
  function onCornerDown(e, corner) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const zs      = currentZoom / 100;
    const startX  = e.clientX;
    const startIX = parseFloat(img.style.left) || 0;
    const startIY = parseFloat(img.style.top)  || 0;
    const startW  = img.offsetWidth;
    const startH  = img.offsetHeight;
    const ratio   = startW / startH;
    const isLeft  = corner === 'tl' || corner === 'bl';
    const isTop   = corner === 'tl' || corner === 'tr';

    function onMove(e) {
      const rawDx = (e.clientX - startX) / zs;
      const dx    = isLeft ? -rawDx : rawDx;
      const newW  = Math.max(40, startW + dx);
      const newH  = newW / ratio;
      img.style.width = newW + 'px';
      if (isLeft) img.style.left = (startIX + (startW - newW)) + 'px';
      if (isTop)  img.style.top  = (startIY + (startH - newH)) + 'px';
      syncHandles(); syncPanel();
    }
    function onUp() {
      ab.dataset.imgW = img.offsetWidth;
      ab.dataset.imgX = parseFloat(img.style.left) || 0;
      ab.dataset.imgY = parseFloat(img.style.top)  || 0;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  img.addEventListener('mousedown', onImgDown);
  Object.entries(cornerEls).forEach(([id, el]) => {
    el.addEventListener('mousedown', e => onCornerDown(e, id));
  });

  renderImgPanel();

  ab._imgEditCleanup = () => {
    img.removeEventListener('mousedown', onImgDown);
    Object.values(cornerEls).forEach(h => h.remove());
    hint.remove();
    img.draggable = true;
    ab.draggable = true;
    if (_row) _row.draggable = true; // row draggable 복원
  };

  ab._exitImgEdit = e => { if (!ab.contains(e.target)) exitImageEditMode(ab); };
  ab._exitImgEsc  = e => { if (e.key === 'Escape') exitImageEditMode(ab); };
  setTimeout(() => {
    document.addEventListener('click',   ab._exitImgEdit);
    document.addEventListener('keydown', ab._exitImgEsc);
  }, 0);
}

function exitImageEditMode(ab) {
  if (!ab._imgEditing) return;
  ab._imgEditing = false;
  ab.classList.remove('img-editing');
  const img = ab.querySelector('.asset-img');
  if (img) {
    ab.dataset.imgW = img.offsetWidth;
    ab.dataset.imgX = parseFloat(img.style.left) || 0;
    ab.dataset.imgY = parseFloat(img.style.top)  || 0;
    img.style.objectFit = 'cover';
  }
  ab.style.overflow = 'hidden'; // 프레임 클리핑 복원
  if (ab._imgEditCleanup) { ab._imgEditCleanup(); ab._imgEditCleanup = null; }
  document.removeEventListener('click',   ab._exitImgEdit);
  document.removeEventListener('keydown', ab._exitImgEsc);
  ab._exitImgEdit = null;
  ab._exitImgEsc  = null;
}

function triggerAssetUpload(ab) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0];
    if (file) loadImageToAsset(ab, file);
  };
  input.click();
}

function loadImageToAsset(ab, file) {
  if (!file || !file.type.startsWith('image/')) return;
  exitImageEditMode(ab);
  pushHistory();
  const reader = new FileReader();
  reader.onload = ev => {
    const src = ev.target.result;
    ab.classList.add('has-image');
    ab.dataset.imgSrc = src;
    if (!ab.dataset.fit) ab.dataset.fit = 'cover';
    // 기존 위치/크기 초기화
    delete ab.dataset.imgW;
    delete ab.dataset.imgX;
    delete ab.dataset.imgY;
    ab.innerHTML = `
      <img class="asset-img" src="${src}" style="object-fit:${ab.dataset.fit}">
      <button class="asset-overlay-clear" title="이미지 제거">✕</button>`;
    ab.querySelector('.asset-overlay-clear').addEventListener('click', e => {
      e.stopPropagation();
      clearAssetImage(ab);
    });
    showAssetProperties(ab);
  };
  reader.readAsDataURL(file);
}

function clearAssetImage(ab) {
  exitImageEditMode(ab);
  pushHistory();
  ab.classList.remove('has-image');
  delete ab.dataset.imgSrc;
  delete ab.dataset.fit;
  delete ab.dataset.imgW;
  delete ab.dataset.imgX;
  delete ab.dataset.imgY;
  ab.innerHTML = `
    <span class="asset-tag">Image / GIF</span>
    ${ASSET_SVG}
    <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>`;
  showAssetProperties(ab);
}

/* ══════════════════════════════════════
   내보내기 (Export)
══════════════════════════════════════ */
async function exportSection(sec, format) {
  const fmt = format || 'png';

  // 클론을 transform 밖(body)에 배치해서 html2canvas가 부모 scale 영향 안 받게 함
  const clone = sec.cloneNode(true);
  const cloneLabel   = clone.querySelector('.section-label');
  const cloneToolbar = clone.querySelector('.section-toolbar');
  if (cloneLabel)   cloneLabel.remove();
  if (cloneToolbar) cloneToolbar.remove();
  clone.classList.remove('selected');
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:' + CANVAS_W + 'px;margin:0;outline:none;';

  document.body.appendChild(clone);

  const secBg   = sec.style.background || sec.style.backgroundColor || '';
  const bgColor = (secBg && secBg !== 'transparent') ? secBg : (pageSettings.bg || '#ffffff');

  try {
    const canvas = await html2canvas(clone, {
      scale: 1,
      useCORS: true,
      backgroundColor: bgColor,
      logging: false,
    });

    const secList = [...canvasEl.querySelectorAll('.section-block')];
    const idx     = secList.indexOf(sec) + 1;
    const name    = (sec._name || `section-${String(idx).padStart(2,'0')}`).replace(/\s+/g, '-');

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url;
      a.download = `${name}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    }, fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);

  } finally {
    document.body.removeChild(clone);
  }
}

async function exportAllSections(format) {
  const sections = [...canvasEl.querySelectorAll('.section-block')];
  for (const sec of sections) {
    await exportSection(sec, format);
    await new Promise(r => setTimeout(r, 300));
  }
}

/* 레이어 패널 — 섹션 순서 변경 */
const layerPanelBody = document.getElementById('layer-panel-body');
layerPanelBody.addEventListener('dragover', e => {
  if (!layerSectionDragSrc) return;
  e.preventDefault();
  clearLayerSectionIndicators();
  const after = getLayerSectionDragAfterEl(layerPanelBody, e.clientY);
  const indicator = document.createElement('div');
  indicator.className = 'layer-section-drop-indicator';
  if (after) layerPanelBody.insertBefore(indicator, after);
  else layerPanelBody.appendChild(indicator);
});
layerPanelBody.addEventListener('dragleave', e => {
  if (!layerSectionDragSrc) return;
  if (!layerPanelBody.contains(e.relatedTarget)) clearLayerSectionIndicators();
});
layerPanelBody.addEventListener('drop', e => {
  if (!layerSectionDragSrc) return;
  e.preventDefault();
  const { sec } = layerSectionDragSrc;
  const indicator = layerPanelBody.querySelector('.layer-section-drop-indicator');
  if (indicator) {
    const nextLayerSec = indicator.nextElementSibling;
    if (nextLayerSec && nextLayerSec._canvasSec) {
      canvasEl.insertBefore(sec, nextLayerSec._canvasSec);
    } else {
      canvasEl.appendChild(sec);
    }
  }
  clearLayerSectionIndicators();
  buildLayerPanel();
  layerSectionDragSrc = null;
});

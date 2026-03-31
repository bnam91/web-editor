import { state } from './globals.js';
import {
  genId,
  showNoSelectionHint,
  showToast,
  insertAfterSelected,
  getSectionAlign,
  makeLabelItem,
  renderGraph,
  GRAPH_DEFAULT_ITEMS,
  applyDividerStyle,
  ASSET_PRESETS,
} from './drag-utils.js';
import {
  bindBlock,
  bindGroupDrag,
  bindSectionDrag,
  bindSectionDropZone,
} from './drag-drop.js';

/* ═══════════════════════════════════
   BLOCK FACTORY — make* / add* / addSection
═══════════════════════════════════ */

/* ── col-active 헬퍼: col이 선택된 상태면 해당 col에 직접 추가 (액자식 중첩) ── */
function _insertToActiveCol(make, isRowBlock = true) {
  const activeCol = document.querySelector('.col.col-active')
    || (state._lastActiveCol?.isConnected ? state._lastActiveCol : null);
  if (!activeCol) return false;
  // stack 단일 col에 row 중첩 방지: leaf 블록이 이미 있으면 section-level 삽입으로 폴백
  if (isRowBlock) {
    const parentRow = activeCol.closest('.row');
    if (parentRow && (parentRow.dataset.layout || 'stack') === 'stack') {
      const hasLeaf = [...activeCol.children].some(c =>
        !c.classList.contains('col-placeholder') && !c.classList.contains('row') &&
        (c.classList.contains('text-block') || c.classList.contains('icon-text-block') ||
         c.classList.contains('asset-block') || c.classList.contains('gap-block') ||
         c.classList.contains('divider-block') || c.classList.contains('label-group-block'))
      );
      if (hasLeaf) return false;
    }
  }
  window.pushHistory();
  activeCol.querySelector('.col-placeholder')?.remove();
  if (isRowBlock) {
    const { row, block } = make();
    activeCol.appendChild(row);
    bindBlock(block);
    if (window.bindRowColAdd) window.bindRowColAdd(row);
    row.querySelectorAll('.col').forEach(c => window.bindColDropZone?.(c));
  } else {
    const block = make();
    activeCol.appendChild(block);
    bindBlock(block);
  }
  window.buildLayerPanel();
  return true;
}

/* ── 오버레이 삽입 헬퍼 ── */
function getSelectedOverlay() {
  const ab = document.querySelector('.asset-block.selected[data-overlay="true"]');
  if (ab) return ab.querySelector('.asset-overlay');
  // overlay-tb 클릭 시 asset-block 선택이 해제되므로 selected overlay-tb 부모도 확인
  const overlayTb = document.querySelector('.overlay-tb.selected');
  if (overlayTb) {
    const parentAb = overlayTb.closest('.asset-block[data-overlay="true"]');
    return parentAb ? parentAb.querySelector('.asset-overlay') : null;
  }
  return null;
}

function insertIntoOverlay(overlay, el) {
  const sel = overlay.querySelector('.row.row-active')
    || overlay.querySelector('.text-block.selected, .gap-block.selected, .overlay-tb.selected, .label-group-block.selected');
  if (sel) {
    const ref = sel.classList.contains('row') ? sel : (sel.closest('.row') || sel);
    ref.after(el);
  } else {
    overlay.appendChild(el);
  }
}

function getOverlayAlign(overlay) {
  const firstContent = overlay.querySelector('.overlay-tb [class^="tb-"]');
  if (firstContent?.style.textAlign) return firstContent.style.textAlign;
  const firstLabel = overlay.querySelector('.overlay-tb');
  if (firstLabel?.style.textAlign) return firstLabel.style.textAlign;
  return null;
}


function makeTextBlock(type) {
  const classMap  = { h1:'tb-h1', h2:'tb-h2', h3:'tb-h3', body:'tb-body', caption:'tb-caption', label:'tb-label' };
  const dataType  = (type==='h1'||type==='h2'||type==='h3') ? 'heading' : type;
  const placeholder = { h1:'제목을 입력하세요', h2:'소제목을 입력하세요', h3:'소항목을 입력하세요', body:'본문 내용을 입력하세요.', caption:'캡션을 입력하세요', label:'Label' };

  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const tb = document.createElement('div');
  tb.className = 'text-block'; tb.dataset.type = dataType;
  tb.id = genId('tb');
  tb.innerHTML = `
    <div class="${classMap[type]}" contenteditable="false" style="font-family:'Pretendard', sans-serif">${placeholder[type]}</div>`;

  col.appendChild(tb);
  row.appendChild(col);
  return { row, block: tb };
}

function makeAssetBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const ab = document.createElement('div');
  ab.className = 'asset-block';
  ab.id = genId('ab');
  ab.dataset.align = 'center';
  ab.dataset.overlay = 'false';
  ab.style.alignSelf = 'center';
  ab.innerHTML = `<div class="asset-overlay"></div>`;

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
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const icb = document.createElement('div');
  icb.className = 'icon-circle-block'; icb.dataset.type = 'icon-circle';
  icb.id = genId('icb');
  icb.dataset.size = '240';
  icb.dataset.bgColor = '#e8e8e8';
  icb.dataset.border = 'none';
  icb.innerHTML = `
    <div class="icb-circle" style="width:240px;height:240px;">
      <span class="icb-placeholder"></span>
    </div>`;

  col.appendChild(icb);
  row.appendChild(col);
  return { row, block: icb };
}

function makeLabelGroupBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const block = document.createElement('div');
  block.className = 'label-group-block';
  block.id = genId('lg');

  block.appendChild(makeLabelItem('Tag', '#e8e8e8', '#333333', 40));
  block.appendChild(makeLabelItem('Tag', '#e8e8e8', '#333333', 40));
  block.appendChild(makeLabelItem('Tag', '#e8e8e8', '#333333', 40));

  const addBtn = document.createElement('button');
  addBtn.className = 'label-group-add-btn';
  addBtn.textContent = '+';
  addBtn.title = '라벨 추가';
  block.appendChild(addBtn);

  col.appendChild(block);
  row.appendChild(col);
  return { row, block };
}

function makeIconTextBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';
  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const itb = document.createElement('div');
  itb.className = 'icon-text-block';
  itb.id = genId('itb');

  const iconSlot = document.createElement('div');
  iconSlot.className = 'itb-icon';
  iconSlot.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

  const bodyEl = document.createElement('div');
  bodyEl.className = 'itb-text';
  bodyEl.setAttribute('contenteditable', 'false');
  bodyEl.textContent = '본문 내용을 입력하세요.';

  itb.appendChild(iconSlot);
  itb.appendChild(bodyEl);
  col.appendChild(itb);
  row.appendChild(col);
  return { row, block: itb };
}

function addIconTextBlock() {
  if (_insertToActiveCol(() => makeIconTextBlock(), true)) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeIconTextBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function addLabelGroupBlock() {
  const overlay = getSelectedOverlay();
  if (overlay) {
    window.pushHistory();
    const { row, block } = makeLabelGroupBlock();
    insertIntoOverlay(overlay, row);
    bindBlock(block);
    window.buildLayerPanel();
    return;
  }
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeLabelGroupBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function makeTableBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

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

function addTextBlock(type) {
  // 오버레이가 활성화된 에셋 블록이 선택된 경우 → 오버레이에 추가
  const overlay = getSelectedOverlay();
  if (overlay) {
    window.pushHistory();
    const { row, block } = makeTextBlock(type);
    block.classList.add('overlay-tb');
    // 오버레이 내 기존 정렬 상속
    const overlayAlign = getOverlayAlign(overlay);
    if (overlayAlign) {
      const contentEl = block.querySelector('[class^="tb-"]');
      if (type === 'label') block.style.textAlign = overlayAlign;
      else if (contentEl) contentEl.style.textAlign = overlayAlign;
    }
    insertIntoOverlay(overlay, row);
    bindBlock(block);
    window.buildLayerPanel();
    return;
  }

  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeTextBlock(type);

  // 섹션의 기존 텍스트 정렬 상속
  const align = getSectionAlign(sec);
  if (align) {
    const contentEl = block.querySelector('[class^="tb-"]');
    if (type === 'label') block.style.textAlign = align;
    else if (contentEl) contentEl.style.textAlign = align;
  }

  insertAfterSelected(sec, row);
  bindBlock(block);
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function groupSelectedBlocks() {
  const selected = [...document.querySelectorAll('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected, .label-group-block.selected, .card-block.selected, .strip-banner-block.selected, .graph-block.selected, .divider-block.selected, .icon-text-block.selected')];
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

function addRowBlock(cols = 2, rows = 1) {
  // 오버레이가 활성화된 에셋 블록이 선택된 경우 → 오버레이에 추가
  const overlay = getSelectedOverlay();
  if (overlay) {
    window.pushHistory();
    const ab = overlay.closest('.asset-block');
    const containerW = ab ? ab.offsetWidth : 860;
    const totalCols = cols * rows;
    const row = document.createElement('div');
    row.className = 'row';
    row.id = genId('row');
    row.dataset.ratioStr = `${cols}*${rows}`;
    const INIT_PX = Math.round(containerW / cols);
    if (rows > 1) {
      row.dataset.layout = 'grid';
      row.style.display = 'grid';
      row.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      row.style.gridTemplateRows = `repeat(${rows}, ${INIT_PX}px)`;
      row.dataset.rowHeight = String(INIT_PX * rows + (rows - 1) * 12);
      row.style.gap = '12px';
      row.dataset.gap = '12';
    } else {
      row.dataset.layout = 'flex';
      row.style.minHeight = INIT_PX + 'px';
      row.style.gap = '12px';
      row.dataset.gap = '12';
    }
    for (let i = 0; i < totalCols; i++) {
      const col = document.createElement('div');
      col.className = 'col';
      if (rows === 1) { col.style.flex = '1'; col.dataset.flex = '1'; }
      col.appendChild(window.makeColPlaceholder(col));
      row.appendChild(col);
    }
    insertIntoOverlay(overlay, row);
    window.buildLayerPanel();
    document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
    row.classList.add('row-active');
    return;
  }
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();

  const totalCols = cols * rows;

  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.ratioStr = `${cols}*${rows}`;

  const INIT_COL_PX = Math.round(860 / cols);
  if (rows > 1) {
    row.dataset.layout = 'grid';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    row.style.gridTemplateRows = `repeat(${rows}, ${INIT_COL_PX}px)`;
    row.dataset.rowHeight = String(INIT_COL_PX * rows + (rows - 1) * 12);
    row.style.gap = '12px';
    row.dataset.gap = '12';
  } else {
    row.dataset.layout = 'flex';
    row.style.minHeight = INIT_COL_PX + 'px';
    row.style.gap = '12px';
    row.dataset.gap = '12';
  }

  for (let i = 0; i < totalCols; i++) {
    const col = document.createElement('div');
    col.className = 'col';
    if (rows === 1) {
      col.style.flex = '1';
      col.dataset.flex = '1';
    }
    const ph = window.makeColPlaceholder(col);
    col.appendChild(ph);
    row.appendChild(col);
  }

  // row 자체에 drag 바인딩 (블록 없이도 드래그 가능하게)
  if (!row._dragBound) {
    row._dragBound = true;
    row.setAttribute('draggable', 'true');
    row.addEventListener('dragstart', e => {
      if (document.activeElement?.contentEditable === 'true') { e.preventDefault(); return; }
      window.dragSrc = row;
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
      row.classList.remove('dragging');
      window.clearDropIndicators();
      window.dragSrc = null;
    });
  }

  insertAfterSelected(sec, row);
  if (window.bindRowColAdd) window.bindRowColAdd(row);

  window.buildLayerPanel();
  document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
  row.classList.add('row-active');
  if (window.syncLayerRow) window.syncLayerRow(row);
}

// ── Row 프리셋 생성 ──────────────────────────────────────────
function makePresetRow(type) {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row');

  const makeAb = () => {
    const ab = document.createElement('div');
    ab.className = 'asset-block';
    ab.id = genId('ab');
    ab.dataset.align = 'center';
    ab.dataset.overlay = 'false';
    ab.style.alignSelf = 'center';
    ab.innerHTML = `<div class="asset-overlay"></div>`;
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
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
  // 첫 번째 asset-block 자동 선택 (이미지 업로드 유도)
  if (firstBlock && firstBlock.classList.contains('asset-block')) {
    firstBlock.click();
  }
}

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
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function addGapBlock() {
  // 오버레이가 활성화된 에셋 블록이 선택된 경우 → 오버레이에 추가
  const overlay = getSelectedOverlay();
  if (overlay) {
    window.pushHistory();
    const gb = makeGapBlock();
    insertIntoOverlay(overlay, gb);
    bindBlock(gb);
    window.buildLayerPanel();
    return;
  }
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
  if (window.bindRowColAdd) window.bindRowColAdd(row);
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
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function makeCardBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

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

  // 2열 grid row 생성
  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.layout = 'grid';
  row.dataset.ratioStr = '2*1';
  row.style.display = 'grid';
  row.style.gridTemplateColumns = 'repeat(2, 1fr)';
  row.style.minHeight = '430px';
  row.style.gap = '16px';
  row.dataset.gap = '16';

  // 카드 2개 생성
  for (let i = 0; i < 2; i++) {
    const col = document.createElement('div');
    col.className = 'col';
    const { block } = makeCardBlock();
    col.appendChild(block);
    row.appendChild(col);
    bindBlock(block);
  }

  insertAfterSelected(sec, row);
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function makeStripBannerBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const sbb = document.createElement('div');
  sbb.className = 'strip-banner-block'; sbb.dataset.type = 'strip-banner';
  sbb.id = genId('sbb');
  sbb.dataset.bgColor = '#f5f5f5';
  sbb.dataset.radius = '0';
  sbb.dataset.imgPos = 'right';
  sbb.dataset.usePadx = 'true';
  sbb.style.background = '#f5f5f5';
  sbb.innerHTML = `
    <div class="sbb-image">
      <span class="sbb-img-placeholder">+</span>
    </div>
    <div class="sbb-content" style="background:#f5f5f5;">
      <div class="sbb-gap sbb-gap-top" style="height:20px"></div>
      <div class="sbb-heading" contenteditable="false">제목을 입력하세요</div>
      <div class="sbb-gap" style="height:8px"></div>
      <div class="sbb-body" contenteditable="false">내용을 입력하세요.</div>
      <div class="sbb-gap sbb-gap-bottom" style="height:20px"></div>
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
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function makeGraphBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

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
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function makeDividerBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const dvd = document.createElement('div');
  dvd.className = 'divider-block'; dvd.dataset.type = 'divider';
  dvd.id = genId('dvd');
  dvd.dataset.lineColor   = '#cccccc';
  dvd.dataset.lineStyle   = 'solid';
  dvd.dataset.lineWeight  = '1';
  dvd.dataset.padV        = '30';
  dvd.dataset.padH        = '0';
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
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function addSection() {
  const canvas  = document.getElementById('canvas');
  const secList = canvas.querySelectorAll('.section-block');
  const newIdx  = secList.length + 1;

  const sec = document.createElement('div');
  sec.className = 'section-block'; sec.dataset.section = newIdx;
  sec.id = genId('sec');
  sec.innerHTML = `
    <div class="section-hitzone"><span class="section-label">Section ${String(newIdx).padStart(2,'0')}</span></div>
    <div class="section-toolbar">
      <button class="st-btn st-branch-btn" onclick="openSectionBranchMenu(this)" title="feature 브랜치로 실험">⎇</button>
    </div>
    <div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:100px" id="${genId('gb')}"></div>
      <div class="row" id="${genId('row')}" data-layout="stack">
        <div class="col" data-width="100">
          <div class="text-block" data-type="heading" id="${genId('tb')}">
            <div class="tb-h2" contenteditable="false">새 섹션 제목</div>
          </div>
        </div>
      </div>
      <div class="row" id="${genId('row')}" data-layout="stack">
        <div class="col" data-width="100">
          <div class="asset-block" id="${genId('ab')}" data-align="center" data-overlay="false">
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
  sec.addEventListener('click', e => {
    e.stopPropagation();
    window.selectSectionWithModifier(sec, e);
    const row = e.target.closest('.row');
    if (row && !e.target.closest('.text-block, .asset-block, .gap-block, .col-placeholder, .icon-circle-block, .table-block, .card-block, .strip-banner-block, .graph-block, .divider-block, .label-group-block, .icon-text-block')) {
      document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
      row.classList.add('row-active');
      if (window.syncLayerRow) window.syncLayerRow(row);
    }
  });
  window.bindSectionDelete(sec);
  window.bindSectionOrder(sec);
  bindSectionDropZone(sec);
  bindSectionDrag(sec);
  if (window.bindSectionHitzone) window.bindSectionHitzone(sec);
  sec.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .strip-banner-block, .graph-block, .divider-block, .icon-text-block').forEach(b => bindBlock(b));
  if (window.bindRowColAdd) sec.querySelectorAll('.row').forEach(row => window.bindRowColAdd(row));
  sec.querySelectorAll('.col').forEach(c => window.bindColDropZone?.(c));
  if (window.bindVariationToolbarBtn) window.bindVariationToolbarBtn(sec);

  window.buildLayerPanel();
  window.selectSection(sec);
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.maybeAddNewSectionToScope(sec.id);
}

export {
  makeTextBlock,
  makeAssetBlock,
  makeGapBlock,
  makeIconCircleBlock,
  makeLabelGroupBlock,
  addLabelGroupBlock,
  makeTableBlock,
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
  makeGraphBlock,
  addGraphBlock,
  makeDividerBlock,
  addDividerBlock,
  addSection,
};

// Backward compat
window.makeTextBlock        = makeTextBlock;
window.makeAssetBlock       = makeAssetBlock;
window.makeGapBlock         = makeGapBlock;
window.makeIconCircleBlock  = makeIconCircleBlock;
window.makeLabelGroupBlock  = makeLabelGroupBlock;
window.addLabelGroupBlock   = addLabelGroupBlock;
window.makeIconTextBlock    = makeIconTextBlock;
window.addIconTextBlock     = addIconTextBlock;
window.makeTableBlock       = makeTableBlock;
window.addTextBlock         = addTextBlock;
window.groupSelectedBlocks  = groupSelectedBlocks;
window.addRowBlock          = addRowBlock;
window.makePresetRow        = makePresetRow;
window.addPresetRow         = addPresetRow;
window.addAssetBlock        = addAssetBlock;
window.addGapBlock          = addGapBlock;
window.addIconCircleBlock   = addIconCircleBlock;
window.addTableBlock        = addTableBlock;
window.makeCardBlock        = makeCardBlock;
window.addCardBlock         = addCardBlock;
window.makeStripBannerBlock = makeStripBannerBlock;
window.addStripBannerBlock  = addStripBannerBlock;
window.makeGraphBlock       = makeGraphBlock;
window.addGraphBlock        = addGraphBlock;
window.makeDividerBlock     = makeDividerBlock;
window.addDividerBlock      = addDividerBlock;
window.addSection           = addSection;

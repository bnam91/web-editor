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
  type = type || 'body';
  const classMap  = { h1:'tb-h1', h2:'tb-h2', h3:'tb-h3', body:'tb-body', caption:'tb-caption', label:'tb-label' };
  const dataType  = (type==='h1'||type==='h2'||type==='h3') ? 'heading' : type;
  const placeholder = { h1:'제목을 입력하세요', h2:'소제목을 입력하세요', h3:'소항목을 입력하세요', body:'본문 내용을 입력하세요.', caption:'캡션을 입력하세요', label:'Label' };

  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const tb = document.createElement('div');
  tb.className = 'text-block'; tb.dataset.type = dataType;
  tb.id = genId('tb');
  const phText = placeholder[type];
  tb.innerHTML = `
    <div class="${classMap[type]}" contenteditable="false" style="font-family:'Pretendard', sans-serif" data-placeholder="${phText}" data-is-placeholder="true">${phText}</div>`;

  row.appendChild(tb);
  return { row, block: tb };
}

function makeAssetBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const ab = document.createElement('div');
  ab.className = 'asset-block';
  ab.id = genId('ab');
  ab.dataset.align = 'center';
  ab.dataset.overlay = 'false';
  ab.style.alignSelf = 'center';
  ab.innerHTML = `<div class="asset-overlay"></div>`;

  row.appendChild(ab);
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

  row.appendChild(icb);
  return { row, block: icb };
}

function makeLabelGroupBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

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

  row.appendChild(block);
  return { row, block };
}

function makeIconTextBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

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
  row.appendChild(itb);
  return { row, block: itb };
}

function addIconTextBlock() {
  if (_insertToFlowSubSection(() => makeIconTextBlock())) return;
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

function addLabelGroupBlock(opts = {}) {
  const overlay = getSelectedOverlay();
  if (overlay) {
    window.pushHistory();
    const { row, block } = makeLabelGroupBlock();
    if (opts.labels && opts.labels.length > 0) {
      block.querySelectorAll('.label-item').forEach(l => l.remove());
      const addBtn = block.querySelector('.label-group-add-btn');
      opts.labels.forEach(text => {
        const item = makeLabelItem(text, '#e8e8e8', '#333333', 40, opts.shape || 'pill');
        block.insertBefore(item, addBtn);
      });
    }
    if (opts.shape) block.dataset.shape = opts.shape;
    insertIntoOverlay(overlay, row);
    bindBlock(block);
    window.buildLayerPanel();
    return;
  }
  if (_insertToFlowSubSection(() => {
    const { row, block } = makeLabelGroupBlock();
    if (opts.labels && opts.labels.length > 0) {
      block.querySelectorAll('.label-item').forEach(l => l.remove());
      const addBtn = block.querySelector('.label-group-add-btn');
      opts.labels.forEach(text => { block.insertBefore(makeLabelItem(text, '#e8e8e8', '#333333', 40, opts.shape || 'pill'), addBtn); });
    }
    if (opts.shape) block.dataset.shape = opts.shape;
    return { row, block };
  })) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeLabelGroupBlock();
  if (opts.labels && opts.labels.length > 0) {
    block.querySelectorAll('.label-item').forEach(l => l.remove());
    const addBtn = block.querySelector('.label-group-add-btn');
    opts.labels.forEach(text => {
      const item = makeLabelItem(text, '#e8e8e8', '#333333', 40, opts.shape || 'pill');
      block.insertBefore(item, addBtn);
    });
  }
  if (opts.shape) block.dataset.shape = opts.shape;
  insertAfterSelected(sec, row);
  bindBlock(block);
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function makeTableBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

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

  row.appendChild(tb);
  return { row, block: tb };
}

function applyTextOpts(block, row, opts, type) {
  const contentEl = block.querySelector('[class^="tb-"]');
  if (opts.content && contentEl) {
    contentEl.style.whiteSpace = 'pre-wrap';
    contentEl.textContent = opts.content;
  }
  if (opts.align) {
    if (type === 'label') block.style.textAlign = opts.align;
    else if (contentEl) contentEl.style.textAlign = opts.align;
  }
  if (opts.color && contentEl) contentEl.style.color = opts.color;
  if (opts.fontSize && contentEl) contentEl.style.fontSize = opts.fontSize + 'px';
  if (opts.paddingX !== undefined) {
    row.style.paddingLeft  = opts.paddingX + 'px';
    row.style.paddingRight = opts.paddingX + 'px';
    row.dataset.paddingX   = opts.paddingX;
  }
}

function addTextBlock(type, opts = {}) {
  // 오버레이가 활성화된 에셋 블록이 선택된 경우 → 오버레이에 추가
  const overlay = getSelectedOverlay();
  if (overlay) {
    window.pushHistory();
    const { row, block } = makeTextBlock(type);
    block.classList.add('overlay-tb');
    const overlayAlign = opts.align || getOverlayAlign(overlay);
    if (overlayAlign) {
      const contentEl = block.querySelector('[class^="tb-"]');
      if (type === 'label') block.style.textAlign = overlayAlign;
      else if (contentEl) contentEl.style.textAlign = overlayAlign;
    }
    if (opts.content) {
      const contentEl = block.querySelector('[class^="tb-"]');
      if (contentEl) contentEl.textContent = opts.content;
    }
    if (opts.color) {
      const contentEl = block.querySelector('[class^="tb-"]');
      if (contentEl) contentEl.style.color = opts.color;
    }
    if (opts.fontSize) {
      const contentEl = block.querySelector('[class^="tb-"]');
      if (contentEl) contentEl.style.fontSize = opts.fontSize + 'px';
    }
    if (opts.paddingX !== undefined) {
      row.style.paddingLeft  = opts.paddingX + 'px';
      row.style.paddingRight = opts.paddingX + 'px';
      row.dataset.paddingX   = opts.paddingX;
    }
    insertIntoOverlay(overlay, row);
    bindBlock(block);
    window.buildLayerPanel();
    return;
  }

  // fullWidth sub-section 활성화 분기
  if (_insertToFlowSubSection(() => {
    const { row, block } = makeTextBlock(type);
    applyTextOpts(block, row, opts, type);
    return { row, block };
  })) return;

  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeTextBlock(type);

  // opts.align 없으면 섹션 정렬 상속
  const alignedOpts = { ...opts, align: opts.align || getSectionAlign(sec) };
  applyTextOpts(block, row, alignedOpts, type);

  insertAfterSelected(sec, row);
  bindBlock(block);
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function promoteToSubSection(block) {
  const col = block.closest('.col');
  if (!col) {
    if (window.showToast) window.showToast('열(col) 안의 블록만 컨테이너로 전환할 수 있어요.');
    return;
  }

  window.pushHistory();

  const ssH = Math.max(block.offsetHeight, 120);

  const ss = document.createElement('div');
  ss.className = 'sub-section-block';
  ss.id = genId('ss');
  ss.dataset.bg = 'transparent';
  ss.dataset.width = '100%';
  ss.style.cssText = `background:transparent;padding:0;width:100%;height:${ssH}px;min-height:${ssH}px;`;

  const inner = document.createElement('div');
  inner.className = 'sub-section-inner';
  inner.style.cssText = 'position:relative;height:100%;';
  ss.appendChild(inner);

  // 원래 자리에 ss 삽입, block을 inner로 이동
  block.before(ss);
  block.style.position = 'absolute';
  block.style.left = '0px';
  block.style.top = '0px';
  block.style.width = '100%';
  block.style.transform = '';
  block.classList.remove('selected');
  // HTML5 drag 비활성화 — absolute 블록은 커스텀 mousemove drag 사용
  block.setAttribute('draggable', 'false');
  const blockRow = block.closest('.row');
  if (blockRow) blockRow.setAttribute('draggable', 'false');
  inner.appendChild(block);

  window.bindSubSectionDropZone?.(ss);
  window.deselectAll?.();

  const sec = ss.closest('.section-block');
  if (sec) {
    sec.classList.add('selected');
    window.syncLayerActive?.(sec);
  }
  ss.classList.add('selected');
  window._activeSubSection = ss;
  window.showSubSectionProperties?.(ss);
  window.buildLayerPanel();
  window.scheduleAutoSave?.();
}

function groupSelectedBlocks() {
  const selected = [...document.querySelectorAll('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected, .label-group-block.selected, .card-block.selected, .graph-block.selected, .divider-block.selected, .icon-text-block.selected')];

  // 단일 블록 → 서브섹션으로 승격
  if (selected.length === 1) {
    promoteToSubSection(selected[0]);
    return;
  }

  if (selected.length < 2) return;

  // 같은 섹션의 블록만 그룹
  const sec = selected[0].closest('.section-block');
  if (!selected.every(b => b.closest('.section-block') === sec)) return;

  // 그룹 안의 블록은 중첩 그룹화 불가 (레이어 패널 미지원)
  if (selected.some(b => b.closest('.group-block'))) {
    if (window.showToast) window.showToast('그룹 안의 블록은 다시 그룹화할 수 없어요.');
    return;
  }

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

function addAssetBlock(preset, opts = {}) {
  const applyPreset = (block) => {
    if (preset && ASSET_PRESETS[preset]) {
      block.style.height = ASSET_PRESETS[preset].height + 'px';
      if (ASSET_PRESETS[preset].width) block.style.width = ASSET_PRESETS[preset].width + 'px';
    }
    if (opts.width) block.style.width = opts.width + 'px';
    if (opts.height) block.style.height = opts.height + 'px';
  };
  // row 레벨 paddingX 적용 (섹션 paddingX와 독립적으로 동작)
  const applyRowPaddingX = (row) => {
    if (opts.paddingX === undefined) return;
    row.style.paddingLeft  = opts.paddingX + 'px';
    row.style.paddingRight = opts.paddingX + 'px';
    row.dataset.paddingX   = opts.paddingX;
  };
  // DOM 삽입 후 padXExcludesAsset 적용 (closest가 올바르게 동작하도록 삽입 후 호출)
  const applyExcludePadX = (block) => {
    if (!window.state?.pageSettings?.padXExcludesAsset) return;
    block.dataset.usePadx = 'true';
    const inner = block.closest('.section-inner');
    const hasOverride = inner?.dataset.paddingX !== '' && inner?.dataset.paddingX !== undefined;
    const px = inner ? (hasOverride ? parseInt(inner.dataset.paddingX) : window.state.pageSettings.padX) : window.state.pageSettings.padX;
    if (px > 0) {
      block.style.marginLeft  = -px + 'px';
      block.style.marginRight = -px + 'px';
      block.style.width = `calc(100% + ${px * 2}px)`;
    }
  };
  // fullWidth sub-section 분기
  let insertedBlock = null;
  if (_insertToFlowSubSection(() => {
    const { row, block } = makeAssetBlock();
    applyPreset(block);
    applyRowPaddingX(row);
    insertedBlock = block;
    return { row, block };
  })) {
    if (insertedBlock) applyExcludePadX(insertedBlock);
    return;
  }
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeAssetBlock();
  applyPreset(block);
  applyRowPaddingX(row);
  insertAfterSelected(sec, row);
  applyExcludePadX(block);   // DOM 삽입 후 실행
  bindBlock(block);
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function addGapBlock(height) {
  // 오버레이가 활성화된 에셋 블록이 선택된 경우 → 오버레이에 추가
  const overlay = getSelectedOverlay();
  if (overlay) {
    window.pushHistory();
    const gb = makeGapBlock();
    if (height) gb.style.height = height + 'px';
    insertIntoOverlay(overlay, gb);
    bindBlock(gb);
    window.buildLayerPanel();
    return;
  }
  // fullWidth sub-section 분기
  if (_insertToFlowSubSection(() => {
    const gb = makeGapBlock();
    if (height) gb.style.height = height + 'px';
    gb.dataset.h = height || 40;
    return gb;
  })) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const gb = makeGapBlock();
  if (height) gb.style.height = height + 'px';
  insertAfterSelected(sec, gb);
  bindBlock(gb);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function addIconCircleBlock(opts = {}) {
  if (_insertToFlowSubSection(() => {
    const { row, block } = makeIconCircleBlock();
    if (opts.size) { block.dataset.size = String(opts.size); const c = block.querySelector('.icb-circle'); if (c) { c.style.width = opts.size + 'px'; c.style.height = opts.size + 'px'; } }
    if (opts.bgColor) { block.dataset.bgColor = opts.bgColor; const c = block.querySelector('.icb-circle'); if (c) c.style.backgroundColor = opts.bgColor; }
    return { row, block };
  })) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeIconCircleBlock();
  if (opts.size) {
    block.dataset.size = String(opts.size);
    const circle = block.querySelector('.icb-circle');
    if (circle) { circle.style.width = opts.size + 'px'; circle.style.height = opts.size + 'px'; }
  }
  if (opts.bgColor) {
    block.dataset.bgColor = opts.bgColor;
    const circle = block.querySelector('.icb-circle');
    if (circle) circle.style.backgroundColor = opts.bgColor;
  }
  insertAfterSelected(sec, row);
  bindBlock(block);
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function addTableBlock(opts = {}) {
  if (_insertToFlowSubSection(() => {
    const { row, block } = makeTableBlock();
    if (opts.showHeader === false) { block.dataset.showHeader = 'false'; const th = block.querySelector('thead'); if (th) th.style.display = 'none'; }
    if (opts.cellAlign) { block.dataset.cellAlign = opts.cellAlign; block.querySelectorAll('td, th').forEach(c => { c.style.textAlign = opts.cellAlign; }); }
    return { row, block };
  })) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeTableBlock();
  if (opts.showHeader === false) {
    block.dataset.showHeader = 'false';
    const thead = block.querySelector('thead');
    if (thead) thead.style.display = 'none';
  }
  if (opts.cellAlign) {
    block.dataset.cellAlign = opts.cellAlign;
    block.querySelectorAll('td, th').forEach(cell => { cell.style.textAlign = opts.cellAlign; });
  }
  insertAfterSelected(sec, row);
  bindBlock(block);
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function makeCardBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

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

  row.appendChild(cdb);
  return { row, block: cdb };
}

function addCardBlock(count = 2, opts = {}) {
  if (_insertToFlowSubSection(() => {
    const { row, block } = makeCardBlock();
    if (opts.bgColor) { block.dataset.bgColor = opts.bgColor; const body = block.querySelector('.cdb-body'); if (body) body.style.background = opts.bgColor; }
    if (opts.radius !== undefined) { block.dataset.radius = String(opts.radius); const body = block.querySelector('.cdb-body'); if (body) body.style.borderRadius = `0 0 ${opts.radius}px ${opts.radius}px`; }
    return { row, block };
  })) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }

  const activeCol = document.querySelector('.col.col-active')
    || (state._lastActiveCol?.isConnected ? state._lastActiveCol : null);

  window.pushHistory();

  const cardCount = (count >= 2 && count <= 4) ? count : 2;
  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.layout = 'grid';
  row.dataset.ratioStr = `${cardCount}*1`;
  row.style.display = 'grid';
  row.style.gridTemplateColumns = `repeat(${cardCount}, 1fr)`;
  row.style.minHeight = '430px';
  row.style.gap = '16px';
  row.dataset.gap = '16';

  for (let i = 0; i < cardCount; i++) {
    const col = document.createElement('div');
    col.className = 'col';
    const { block } = makeCardBlock();
    if (opts.bgColor) {
      block.dataset.bgColor = opts.bgColor;
      const body = block.querySelector('.cdb-body');
      if (body) body.style.background = opts.bgColor;
    }
    if (opts.radius !== undefined) {
      block.dataset.radius = String(opts.radius);
      const body = block.querySelector('.cdb-body');
      if (body) body.style.borderRadius = `0 0 ${opts.radius}px ${opts.radius}px`;
    }
    col.appendChild(block);
    row.appendChild(col);
    bindBlock(block);
  }

  if (activeCol) {
    activeCol.querySelector('.col-placeholder')?.remove();
    activeCol.appendChild(row);
  } else {
    insertAfterSelected(sec, row);
  }
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function makeGraphBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const grb = document.createElement('div');
  grb.className = 'graph-block'; grb.dataset.type = 'graph';
  grb.id = genId('grb');
  grb.dataset.chartType = 'bar-v';
  grb.dataset.preset = 'default';
  grb.dataset.items = JSON.stringify(GRAPH_DEFAULT_ITEMS);

  renderGraph(grb);

  row.appendChild(grb);
  return { row, block: grb };
}

function addGraphBlock(opts = {}) {
  if (_insertToFlowSubSection(() => {
    const { row, block } = makeGraphBlock();
    if (opts.chartType) block.dataset.chartType = opts.chartType;
    if (opts.items && opts.items.length > 0) { block.dataset.items = JSON.stringify(opts.items); renderGraph(block); }
    return { row, block };
  })) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeGraphBlock();
  if (opts.chartType) block.dataset.chartType = opts.chartType;
  if (opts.items && opts.items.length > 0) {
    block.dataset.items = JSON.stringify(opts.items);
    renderGraph(block);
  }
  insertAfterSelected(sec, row);
  bindBlock(block);
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function makeDividerBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const dvd = document.createElement('div');
  dvd.className = 'divider-block'; dvd.dataset.type = 'divider';
  dvd.id = genId('dvd');
  dvd.dataset.lineColor   = '#cccccc';
  dvd.dataset.lineStyle   = 'solid';
  dvd.dataset.lineWeight  = '1';
  dvd.dataset.padV        = '30';
  dvd.dataset.padH        = '0';
  dvd.innerHTML = `<hr class="dvd-line" style="border-top:1px solid #cccccc;">`;

  row.appendChild(dvd);
  return { row, block: dvd };
}

function addDividerBlock(opts = {}) {
  if (_insertToFlowSubSection(() => {
    const { row, block } = makeDividerBlock();
    if (opts.color) block.dataset.lineColor = opts.color;
    if (opts.lineStyle) block.dataset.lineStyle = opts.lineStyle;
    if (opts.weight !== undefined) block.dataset.lineWeight = String(opts.weight);
    if (opts.color || opts.lineStyle || opts.weight !== undefined) applyDividerStyle(block);
    return { row, block };
  })) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeDividerBlock();
  if (opts.color) block.dataset.lineColor = opts.color;
  if (opts.lineStyle) block.dataset.lineStyle = opts.lineStyle;
  if (opts.weight !== undefined) block.dataset.lineWeight = String(opts.weight);
  if (opts.color || opts.lineStyle || opts.weight !== undefined) applyDividerStyle(block);
  insertAfterSelected(sec, row);
  bindBlock(block);
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function addSection(opts = {}) {
  const canvas  = document.getElementById('canvas');
  const secList = canvas.querySelectorAll('.section-block');
  const newIdx  = secList.length + 1;

  const sec = document.createElement('div');
  sec.className = 'section-block'; sec.dataset.section = newIdx;
  sec.id = genId('sec');
  const secLabel = `Section ${String(newIdx).padStart(2,'0')}`;
  sec._name = secLabel;
  sec.dataset.name = secLabel;

  // 섹션 배경색 적용 (bg 옵션 또는 나중에 setSectionBg로 변경 가능)
  if (opts.bg) {
    sec.style.backgroundColor = opts.bg;
    sec.dataset.bg = opts.bg;
  }

  if (opts.skipDefaultBlock) {
    // 기본 h2+asset 블록 없이 빈 섹션 생성 (API 자동화용)
    const gapH = opts.paddingY !== undefined ? opts.paddingY : 100;
    sec.innerHTML = `
      <div class="section-hitzone"><span class="section-label">${secLabel}</span></div>
      <div class="section-toolbar">
        <button class="st-btn st-branch-btn" onclick="openSectionBranchMenu(this)" title="feature 브랜치로 실험">⎇</button>
      </div>
      <div class="section-inner">
        <div class="gap-block" data-type="gap" style="height:${gapH}px" id="${genId('gb')}"></div>
        <div class="gap-block" data-type="gap" style="height:${gapH}px" id="${genId('gb')}"></div>
      </div>`;
  } else {
    sec.innerHTML = `
      <div class="section-hitzone"><span class="section-label">${secLabel}</span></div>
      <div class="section-toolbar">
        <button class="st-btn st-branch-btn" onclick="openSectionBranchMenu(this)" title="feature 브랜치로 실험">⎇</button>
      </div>
      <div class="section-inner" style="min-height:580px">
        <div class="gap-block" data-type="gap" style="height:100px" id="${genId('gb')}"></div>
        <div class="row" id="${genId('row')}" data-layout="stack">
          <div class="col" data-width="100">
            <div class="text-block" data-type="heading" id="${genId('tb')}">
              <div class="tb-h2" contenteditable="false">새 섹션 제목</div>
            </div>
          </div>
        </div>
        <div class="gap-block" data-type="gap" style="height:100px" id="${genId('gb')}"></div>
      </div>`;
  }

  // paddingX 적용 (section-inner에 좌우 padding)
  const inner = sec.querySelector('.section-inner');
  if (inner) {
    if (opts.paddingX !== undefined) {
      // 명시적 override: dataset에 저장 (페이지 설정 일괄적용 제외)
      inner.style.paddingLeft  = opts.paddingX + 'px';
      inner.style.paddingRight = opts.paddingX + 'px';
      inner.dataset.paddingX   = opts.paddingX;
    } else {
      // 페이지 기본 padX 상속 (dataset 미설정 → 페이지 슬라이더로 일괄조절 가능)
      const pagePadX = window.state?.pageSettings?.padX;
      if (pagePadX) {
        inner.style.paddingLeft  = pagePadX + 'px';
        inner.style.paddingRight = pagePadX + 'px';
      }
    }
    // padXExcludesAsset 플래그가 켜져 있으면 신규 섹션의 asset-block에도 즉시 적용
    if (window.state?.pageSettings?.padXExcludesAsset) {
      const hasOverride = inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined;
      const px = hasOverride ? parseInt(inner.dataset.paddingX) : (window.state.pageSettings.padX || 0);
      if (px > 0) {
        inner.querySelectorAll('.asset-block').forEach(ab => {
          ab.dataset.usePadx = 'true';
          ab.style.marginLeft  = -px + 'px';
          ab.style.marginRight = -px + 'px';
          ab.style.width = `calc(100% + ${px * 2}px)`;
        });
      }
    }
  }

  const selectedSec = document.querySelector('.section-block.selected');
  if (selectedSec) selectedSec.after(sec);
  else canvas.appendChild(sec);

  // 이벤트 바인딩
  window.pushHistory();
  sec.addEventListener('click', e => {
    e.stopPropagation();
    window.selectSectionWithModifier(sec, e);
    const row = e.target.closest('.row');
    if (row && !e.target.closest('.text-block, .asset-block, .gap-block, .col-placeholder, .icon-circle-block, .table-block, .card-block, .graph-block, .divider-block, .label-group-block, .icon-text-block')) {
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
  sec.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .shape-block').forEach(b => bindBlock(b));
  sec.querySelectorAll('.sub-section-block').forEach(ss => window.bindSubSectionDropZone?.(ss));
  if (window.bindRowColAdd) sec.querySelectorAll('.row').forEach(row => window.bindRowColAdd(row));
  sec.querySelectorAll('.col').forEach(c => window.bindColDropZone?.(c));
  if (window.bindVariationToolbarBtn) window.bindVariationToolbarBtn(sec);

  window.buildLayerPanel();
  window.selectSection(sec);
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.maybeAddNewSectionToScope(sec.id);
}

/* ── Secret Block (Figma 패스스루 컴포넌트) ── */
function makeJokerBlock(opts = {}) {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const sb = document.createElement('div');
  sb.className = 'joker-block';
  sb.id = genId('sb');
  sb.dataset.type = 'joker';

  const svgContent = opts.svg || '';
  const label = opts.label || 'Figma Component';
  const origW = opts.width || 860;
  const origH = opts.height || 200;

  const origX = opts.x || 0;
  const origY = opts.y || 0;
  sb.dataset.origWidth  = String(origW);
  sb.dataset.origHeight = String(origH);
  sb.dataset.offsetX    = String(origX);
  sb.dataset.offsetY    = String(origY);
  sb.dataset.label      = label;
  if (origX || origY) sb.style.transform = `translate(${origX}px, ${origY}px)`;
  if (svgContent) sb.dataset.svg = svgContent;

  sb.innerHTML = `
    <div class="joker-block-inner" style="width:100%;">
      <div class="joker-block-svg" style="width:${origW}px;height:${origH}px;display:block;line-height:0;">
        ${svgContent || `<div style="width:${origW}px;height:${origH}px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:13px;">SVG 없음</div>`}
      </div>
    </div>`;

  row.appendChild(sb);
  return { row, block: sb };
}

function addJokerBlock(opts = {}) {
  // 서브섹션 활성화 상태: absolute 위치로 직접 삽입 (Figma 좌표 재현)
  if (window._activeSubSection) {
    const ss = window._activeSubSection;
    const inner = ss.querySelector('.sub-section-inner');
    if (inner) {
      const { block } = makeJokerBlock(opts);
      block.style.position = 'absolute';
      block.style.left = `${opts.x || 0}px`;
      block.style.top  = `${opts.y || 0}px`;
      block.style.transform = ''; // absolute 모드에서는 transform 사용 안 함
      inner.appendChild(block);
      bindBlock(block);
      window.buildLayerPanel();
      return;
    }
  }
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeJokerBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  if (window.bindRowColAdd) window.bindRowColAdd(row);
  window.buildLayerPanel();
  window.selectSection(sec);
}

/* ── Sub-Section Block ── */
function makeSubSectionBlock(opts = {}) {
  const ss = document.createElement('div');
  ss.className = 'sub-section-block';
  ss.id = genId('ss');

  if (opts.fullWidth) {
    // fullWidth 모드: 이중 배경 섹션용. 플로우 레이아웃, height: auto
    const bg = opts.bg || 'transparent';
    ss.dataset.bg = bg;
    ss.dataset.fullWidth = 'true';
    ss.style.cssText = `background:${bg};width:100%;box-sizing:border-box;`;
    const inner = document.createElement('div');
    inner.className = 'sub-section-inner';
    // 플로우 레이아웃 (absolute 아님)
    ss.appendChild(inner);
  } else {
    // B 모드: 자유배치 프레임 (기본값)
    ss.dataset.bg = 'transparent';
    ss.dataset.freeLayout = 'true';
    ss.dataset.width = '860';
    ss.dataset.height = '520';
    ss.dataset.padY = '0';
    ss.style.cssText = `background:transparent;padding:0;width:860px;max-width:100%;margin:0 auto;min-height:520px;height:520px;`;
    const inner = document.createElement('div');
    inner.className = 'sub-section-inner';
    inner.style.cssText = 'position:relative;width:100%;height:100%;';
    ss.appendChild(inner);
  }
  return ss;
}

/* freeLayout inner 안에서 absolute 블록들을 아래로 쌓을 Y 좌표 계산 */
function _calcFreeLayoutStackY(inner) {
  const absEls = [...inner.querySelectorAll(':scope > *')].filter(el => el.style.position === 'absolute');
  if (!absEls.length) return 20;
  const last = absEls[absEls.length - 1];
  return Math.round(parseInt(last.style.top || '0') + (last.offsetHeight || 60) + 16);
}

/* sub-section이 활성화된 경우 블록 삽입 — freeLayout(B모드) / fullWidth(플로우) 분기 */
function _insertToFlowSubSection(makeBlockFn) {
  const ss = window._activeSubSection;
  if (!ss) return false;

  /* ── B 모드: 자유배치 프레임 ── */
  if (ss.dataset.freeLayout === 'true') {
    const inner = ss.querySelector('.sub-section-inner');
    if (!inner) return false;
    window.pushHistory();
    const result = makeBlockFn();
    if (!result) return true;
    const isRowBlock = !!(result.row && result.block);
    const block = isRowBlock ? result.block : result;
    // 기존 absolute 자식 아래에 쌓기
    const stackY = _calcFreeLayoutStackY(inner);
    block.style.position = 'absolute';
    block.style.left     = '0px';
    block.style.top      = stackY + 'px';
    block.style.width    = '100%';
    block.style.transform = '';
    inner.appendChild(block);
    bindBlock(block);
    block.setAttribute('draggable', 'false');
    window.buildLayerPanel();
    return true;
  }

  /* ── A 모드: fullWidth 플로우 레이아웃 ── */
  if (ss.dataset.fullWidth !== 'true') return false;
  const inner = ss.querySelector('.sub-section-inner');
  if (!inner) return false;
  window.pushHistory();
  const result = makeBlockFn();
  // makeBlockFn이 { row, block } 또는 block(gap) 반환
  if (result && result.row) {
    inner.appendChild(result.row);
    bindBlock(result.block);
    if (window.bindRowColAdd) window.bindRowColAdd(result.row);
  } else if (result) {
    inner.appendChild(result);
    bindBlock(result);
  }
  window.buildLayerPanel();
  return true;
}

function addSubSectionBlock(opts = {}) {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const ss = makeSubSectionBlock(opts);

  // 활성 프레임 안에 삽입 (중첩 프레임) — fullWidth 모드 및 shape frame 제외
  const activeFrame = !opts.fullWidth && window._activeSubSection;
  const isShapeFrame = activeFrame && !!activeFrame.querySelector(':scope > .sub-section-inner > .shape-block');
  if (activeFrame && !isShapeFrame && activeFrame.closest('.section-block') === sec) {
    const inner = activeFrame.querySelector('.sub-section-inner');
    if (inner) inner.appendChild(ss);
  } else {
    // shape frame이 활성화된 상태면 _activeSubSection을 임시 해제
    // insertAfterSelected가 내부적으로 _activeSubSection을 참조해 shape wrapper 안에 삽입하는 것을 방지
    const _prev = window._activeSubSection;
    if (isShapeFrame) window._activeSubSection = null;
    insertAfterSelected(sec, ss);
    if (isShapeFrame) window._activeSubSection = _prev;
  }

  if (!opts.fullWidth) window.bindSubSectionDropZone?.(ss);
  window.buildLayerPanel();
  window.deselectAll?.();
  sec.classList.add('selected');
  window.syncLayerActive?.(sec);
  ss.classList.add('selected');
  window._activeSubSection = ss;
  if (!opts.fullWidth) window.showSubSectionProperties?.(ss);
}

function activateSubSection(ss) {
  window._activeSubSection = ss;
}
function deactivateSubSection() {
  window._activeSubSection = null;
}

/* ── Wrap selected blocks into a new free-placement Frame ── */
function wrapSelectedBlocksInFrame() {
  const BLOCK_SEL = '.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block';
  const selected = [...document.querySelectorAll(
    BLOCK_SEL.split(',').map(s => s.trim() + '.selected').join(', ')
  )];
  if (selected.length < 1) {
    if (window.showToast) window.showToast('프레임으로 묶을 블록을 먼저 선택하세요.');
    return;
  }

  // 같은 섹션 안의 블록만 처리
  const sec = selected[0].closest('.section-block');
  if (!sec) return;
  if (!selected.every(b => b.closest('.section-block') === sec)) {
    if (window.showToast) window.showToast('같은 섹션 안의 블록만 묶을 수 있어요.');
    return;
  }

  window.pushHistory();

  // 섹션 inner 기준으로 DOM 순서대로 부모 row 수집
  const sectionInner = sec.querySelector('.section-inner');
  const childrenInOrder = [...sectionInner.children];
  const rows = [];
  selected.forEach(b => {
    const row = b.classList.contains('gap-block') ? b : (b.closest('.row') || b);
    if (row && !rows.includes(row)) rows.push(row);
  });
  rows.sort((a, b) => childrenInOrder.indexOf(a) - childrenInOrder.indexOf(b));

  // 선택 블록들의 총 높이 계산 (프레임 높이 결정)
  const GAP = 0;
  let totalH = 0;
  rows.forEach(row => { totalH += (row.offsetHeight || 60) + GAP; });
  const frameH = Math.max(totalH, 120);

  // 자유배치(absolute) 프레임 생성
  const ss = makeSubSectionBlock();
  ss.style.cssText = `background:transparent;padding:0;width:100%;height:${frameH}px;min-height:${frameH}px;`;
  ss.dataset.bg = 'transparent';
  ss.dataset.width = '100%';
  ss.dataset.padY = '0';

  const inner = ss.querySelector('.sub-section-inner');

  // 첫 번째 row 자리에 프레임 삽입
  rows[0].before(ss);

  // 각 블록을 absolute 배치로 inner에 이동
  // gap-block은 row 컨테이너가 아니라 블록 자체가 row이므로 직접 처리
  let stackY = 0;
  rows.forEach(row => {
    const rowH = row.offsetHeight || 60;
    const isGapRow = row.classList.contains('gap-block');
    const blocks = isGapRow ? [row] : [...row.querySelectorAll(BLOCK_SEL)];
    blocks.forEach(block => {
      block.style.position = 'absolute';
      block.style.left = '0px';
      block.style.top = stackY + 'px';
      block.style.width = '100%';
      block.style.transform = '';
      block.classList.remove('selected');
      block.setAttribute('draggable', 'false');
      inner.appendChild(block);
    });
    stackY += rowH + GAP;
    if (!isGapRow) row.remove();
  });

  window.bindSubSectionDropZone?.(ss);

  // 프레임 선택 상태로 전환
  window.deselectAll?.();
  sec.classList.add('selected');
  window.syncLayerActive?.(sec);
  ss.classList.add('selected');
  window._activeSubSection = ss;
  window.showSubSectionProperties?.(ss);
  window.buildLayerPanel();
  window.scheduleAutoSave?.();
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
  promoteToSubSection,
  makePresetRow,
  addPresetRow,
  addAssetBlock,
  addGapBlock,
  addIconCircleBlock,
  addTableBlock,
  makeCardBlock,
  addCardBlock,
  makeGraphBlock,
  addGraphBlock,
  makeDividerBlock,
  addDividerBlock,
  addSection,
  makeSubSectionBlock,
  addSubSectionBlock,
  wrapSelectedBlocksInFrame,
  activateSubSection,
  deactivateSubSection,
};

/* ── Frame 진입점 — sub-section 추가 ── */
function addFrameBlock() { addSubSectionBlock(); }
window.addFrameBlock = addFrameBlock;

// ── Shape Block ──
const SHAPE_DEFS = {
  rectangle: { vb: '0 0 100 100', h: 160, fill: true,  inner: `<rect x="4" y="4" width="92" height="92" rx="0"/>` },
  ellipse:   { vb: '0 0 100 100', h: 160, fill: true,  inner: `<ellipse cx="50" cy="50" rx="46" ry="46"/>` },
  line:      { vb: '0 0 200 40',  h: 60,  fill: false, inner: `<line x1="10" y1="20" x2="190" y2="20" stroke-linecap="round"/>` },
  arrow:     { vb: '0 0 200 40',  h: 60,  fill: false, inner: `<line x1="10" y1="20" x2="172" y2="20" stroke-linecap="round"/><polygon points="170,10 194,20 170,30" fill="currentColor" stroke="none"/>` },
  polygon:   { vb: '0 0 200 180', h: 200, fill: true,  inner: `<polygon points="100,8 194,172 6,172"/>` },
  star:      { vb: '0 0 200 190', h: 200, fill: true,  inner: `<polygon points="100,8 122,70 188,70 135,110 155,172 100,132 45,172 65,110 12,70 78,70"/>` },
};

function makeShapeBlock(type = 'rectangle') {
  const def = SHAPE_DEFS[type] || SHAPE_DEFS.rectangle;
  const block = document.createElement('div');
  block.className = 'shape-block';
  block.dataset.type = 'shape';
  block.dataset.shapeType = type;
  block.dataset.shapeColor = '#cccccc';
  block.dataset.shapeStrokeWidth = '3';
  block.id = genId('shp');
  block.innerHTML = `<svg class="shape-svg" viewBox="${def.vb}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"
    style="color:#cccccc;stroke-width:3;fill:${def.fill ? 'currentColor' : 'none'};stroke:currentColor;">
    ${def.inner}
  </svg>`;
  return { block };
}

function addShapeBlock(type = 'rectangle') {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();

  const { block } = makeShapeBlock(type);
  // block/svg 크기는 CSS 100%로 frame에 위임 — 인라인 스타일 불필요

  // 별도 Frame(sub-section) 생성 — 100×100에 맞는 크기
  const ss = makeSubSectionBlock();
  ss.dataset.layerName = type;
  ss.setAttribute('data-layer-name', type);
  ss.dataset.width  = '100';
  ss.dataset.height = '100';
  ss.style.width    = '100px';
  ss.style.height   = '100px';
  ss.style.maxWidth = '100%';
  ss.style.margin   = '0 auto';
  ss.style.alignSelf = 'center';
  ss.style.minHeight = '100px';
  // 배경 제거
  ss.style.backgroundColor = 'transparent';
  ss.style.background = '';
  ss.style.padding = '0';
  ss.dataset.bg = '';
  const inner = ss.querySelector('.sub-section-inner');
  if (inner) {
    // inner height는 CSS :has(.shape-block) { height: 100% }로 ss를 따름 — inline 불필요
    inner.style.height = '';
    block.style.position = 'absolute';
    block.style.left = '0';
    block.style.top  = '0';
    inner.appendChild(block);
    bindBlock(block);
  }

  // 삽입 대상 결정: 활성 프레임 → 선택된 프레임 → 섹션 레벨
  const activeFrame = window._activeSubSection;
  const isActiveShapeFrame = activeFrame && !!activeFrame.querySelector(':scope > .sub-section-inner > .shape-block');

  if (activeFrame && !isActiveShapeFrame && activeFrame.closest('.section-block') === sec) {
    // 활성 프레임 안에 삽입
    const targetInner = activeFrame.querySelector('.sub-section-inner');
    if (targetInner) {
      if (activeFrame.dataset.freeLayout === 'true') {
        const stackY = _calcFreeLayoutStackY(targetInner);
        ss.style.position = 'absolute';
        ss.style.left = '20px';
        ss.style.top  = stackY + 'px';
      }
      targetInner.appendChild(ss);
    }
  } else {
    const selSS = document.querySelector('.sub-section-block.selected');
    const isSelShapeFrame = selSS && !!selSS.querySelector(':scope > .sub-section-inner > .shape-block');
    if (selSS && !isSelShapeFrame && selSS.closest('.section-block') === sec) {
      // 선택된 프레임 안에 삽입
      const targetInner = selSS.querySelector('.sub-section-inner');
      if (targetInner) {
        if (selSS.dataset.freeLayout === 'true') {
          const stackY = _calcFreeLayoutStackY(targetInner);
          ss.style.position = 'absolute';
          ss.style.left = '20px';
          ss.style.top  = stackY + 'px';
        }
        targetInner.appendChild(ss);
      }
    } else {
      // 섹션 레벨에 삽입 (shape frame은 다른 ss 중첩 금지)
      const prevActiveSS = window._activeSubSection;
      window._activeSubSection = null;
      insertAfterSelected(sec, ss);
      window._activeSubSection = prevActiveSS;
    }
  }

  window.bindSubSectionDropZone?.(ss);
  window.buildLayerPanel();
  window._activeSubSection = ss;
  window.showSubSectionProperties?.(ss);
}

// ── New Grid Block ──
// col 개념 없이 freeLayout Frame 안에 셀 Frame을 x,y 절대좌표로 배치하는 그리드
// addNewGridBlock(cols, rows, opts)
//   cols: 열 수 (기본 2)
//   rows: 행 수 (기본 1)
//   opts: { gap: 16, cellHeight: auto, ratios: [1,1,...], bg: '' }
function addNewGridBlock(cols = 2, rows = 1, opts = {}) {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }

  const CANVAS_W   = 860;
  const gap        = opts.gap        ?? 16;
  const ratios     = opts.ratios     || Array(cols).fill(1);
  const bg         = opts.bg         || '';

  // 너비 계산
  const totalRatio = ratios.reduce((a, b) => a + b, 0);
  const usableW    = CANVAS_W - gap * (cols - 1);
  const colWidths  = ratios.map(r => Math.floor(usableW * r / totalRatio));
  // 반올림 오차 → 마지막 컬에 보정
  const widthSum   = colWidths.reduce((a, b) => a + b, 0);
  colWidths[colWidths.length - 1] += (usableW - widthSum);

  // 높이 계산 (cellHeight 미지정 시 첫 번째 컬 너비 × 0.65, 4px 배수)
  const cellH  = opts.cellHeight ?? Math.round(colWidths[0] * 0.65 / 4) * 4;
  const frameH = rows * cellH + gap * (rows - 1);

  window.pushHistory();

  // ── 1. 부모 GridFrame (freeLayout) ──
  const parentSS = makeSubSectionBlock();
  parentSS.dataset.layerName   = 'Grid';
  parentSS.setAttribute('data-layer-name', 'Grid');
  parentSS.style.width     = CANVAS_W + 'px';
  parentSS.style.maxWidth  = '100%';
  parentSS.style.height    = frameH + 'px';
  parentSS.style.minHeight = frameH + 'px';
  parentSS.style.margin    = '0 auto';
  parentSS.dataset.width      = String(CANVAS_W);
  parentSS.dataset.height     = String(frameH);
  parentSS.dataset.freeLayout = 'true';
  parentSS.dataset.newGrid    = 'true';
  parentSS.dataset.gridCols   = String(cols);
  parentSS.dataset.gridRows   = String(rows);
  parentSS.dataset.gridGap    = String(gap);
  if (bg) { parentSS.style.background = bg; parentSS.dataset.bg = bg; }

  const parentInner = parentSS.querySelector('.sub-section-inner');
  parentInner.style.cssText = 'position:relative;width:100%;height:100%;overflow:visible;';

  // ── 2. 셀 Frame 생성 (rows × cols) ──
  for (let r = 0; r < rows; r++) {
    const y = r * (cellH + gap);
    let x = 0;
    for (let c = 0; c < cols; c++) {
      const w = colWidths[c];
      const cellSS = makeSubSectionBlock();
      const cellIdx = r * cols + c + 1;
      cellSS.dataset.layerName = `Cell ${cellIdx}`;
      cellSS.setAttribute('data-layer-name', `Cell ${cellIdx}`);
      cellSS.style.cssText = `position:absolute;left:${x}px;top:${y}px;` +
        `width:${w}px;height:${cellH}px;min-height:${cellH}px;margin:0;box-sizing:border-box;`;
      cellSS.dataset.offsetX  = String(x);
      cellSS.dataset.offsetY  = String(y);
      cellSS.dataset.width    = String(w);
      cellSS.dataset.height   = String(cellH);
      cellSS.dataset.gridCell = `${r}-${c}`;

      const cellInner = cellSS.querySelector('.sub-section-inner');
      cellInner.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;';

      parentInner.appendChild(cellSS);
      window.bindSubSectionDropZone?.(cellSS);
      x += w + gap;
    }
  }

  // ── 3. 섹션에 삽입 ──
  const _prev = window._activeSubSection;
  window._activeSubSection = null;
  insertAfterSelected(sec, parentSS);
  window._activeSubSection = _prev;

  window.bindSubSectionDropZone?.(parentSS);
  window.buildLayerPanel();
  window._activeSubSection = parentSS;
  window.showSubSectionProperties?.(parentSS);

  return parentSS;
}
window.addNewGridBlock = addNewGridBlock;

// ── setSectionBg: 섹션 단위 배경색 설정 ──
// sectionEl: .section-block 요소 또는 섹션 id(string)
// color: hex 색상 문자열 (#ffffff 등). null/''이면 배경색 제거
window.setSectionBg = function(sectionEl, color) {
  const sec = typeof sectionEl === 'string' ? document.getElementById(sectionEl) : sectionEl;
  if (!sec || !sec.classList.contains('section-block')) return false;
  if (color) {
    sec.style.backgroundColor = color;
    sec.dataset.bg = color;
  } else {
    sec.style.backgroundColor = '';
    delete sec.dataset.bg;
  }
  window.triggerAutoSave?.();
  return true;
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
window.promoteToSubSection  = promoteToSubSection;
window.makePresetRow        = makePresetRow;
window.addPresetRow         = addPresetRow;
window.addAssetBlock        = addAssetBlock;
window.addGapBlock          = addGapBlock;
window.addIconCircleBlock   = addIconCircleBlock;
window.addTableBlock        = addTableBlock;
window.makeCardBlock        = makeCardBlock;
window.addCardBlock         = addCardBlock;
window.makeGraphBlock       = makeGraphBlock;
window.addGraphBlock        = addGraphBlock;
window.makeDividerBlock     = makeDividerBlock;
window.addDividerBlock      = addDividerBlock;
window.addSection           = addSection;
window.makeSubSectionBlock        = makeSubSectionBlock;
window.addSubSectionBlock         = addSubSectionBlock;
window.wrapSelectedBlocksInFrame  = wrapSelectedBlocksInFrame;
window.activateSubSection         = activateSubSection;
window.deactivateSubSection = deactivateSubSection;
window.makeJokerBlock       = makeJokerBlock;
window.addJokerBlock        = addJokerBlock;
window.makeShapeBlock       = makeShapeBlock;
window.addShapeBlock        = addShapeBlock;

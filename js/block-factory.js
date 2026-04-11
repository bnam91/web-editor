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
  bindEmptyRow,
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

  const tb = document.createElement('div');
  tb.className = 'text-block'; tb.dataset.type = dataType;
  tb.id = genId('tb');
  const phText = placeholder[type];
  tb.innerHTML = `
    <div class="${classMap[type]}" contenteditable="false" style="font-family:'Pretendard', sans-serif" data-placeholder="${phText}" data-is-placeholder="true">${phText}</div>`;

  return { block: tb };
}

/* 텍스트 블록 전용 frame wrapper — width:100%, 자동 높이, 선택 투명 */
function _makeTextFrame() {
  const ss = document.createElement('div');
  ss.className = 'frame-block';
  ss.id = genId('ss');
  ss.dataset.textFrame = 'true';
  ss.dataset.bg = 'transparent';
  ss.style.cssText = 'background:transparent;width:100%;box-sizing:border-box;';
  return ss;
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
  if (_insertToFlowFrame(() => makeIconTextBlock())) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeIconTextBlock();
  insertAfterSelected(sec, row);
  bindBlock(block);
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
  if (_insertToFlowFrame(() => {
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

function applyTextOpts(block, frame, opts, type) {
  const contentEl = block.querySelector('[class^="tb-"]');
  if (opts.content && contentEl) {
    contentEl.style.whiteSpace = 'pre-wrap';
    contentEl.textContent = opts.content;
    // content가 실제 텍스트이므로 placeholder 상태 해제
    delete contentEl.dataset.isPlaceholder;
  }
  if (opts.align) {
    if (type === 'label') block.style.textAlign = opts.align;
    else if (contentEl) contentEl.style.textAlign = opts.align;
  }
  if (opts.color && contentEl) contentEl.style.color = opts.color;
  if (opts.fontSize && contentEl) contentEl.style.fontSize = opts.fontSize + 'px';
  if (opts.paddingX !== undefined && frame) {
    frame.style.paddingLeft  = opts.paddingX + 'px';
    frame.style.paddingRight = opts.paddingX + 'px';
    frame.dataset.paddingX   = opts.paddingX;
  }
}

function addTextBlock(type, opts = {}) {
  // 오버레이가 활성화된 에셋 블록이 선택된 경우 → 오버레이에 추가
  // overlay 내부에서는 row wrapper를 로컬로 생성해 기존 구조 유지
  const overlay = getSelectedOverlay();
  if (overlay) {
    window.pushHistory();
    const { block } = makeTextBlock(type);
    block.classList.add('overlay-tb');
    const overlayAlign = opts.align || getOverlayAlign(overlay);
    if (overlayAlign) {
      const contentEl = block.querySelector('[class^="tb-"]');
      if (type === 'label') block.style.textAlign = overlayAlign;
      else if (contentEl) contentEl.style.textAlign = overlayAlign;
    }
    if (opts.content) {
      const contentEl = block.querySelector('[class^="tb-"]');
      if (contentEl) {
        contentEl.style.whiteSpace = 'pre-wrap';
        contentEl.textContent = opts.content;
        // content가 실제 텍스트이므로 placeholder 상태 해제
        delete contentEl.dataset.isPlaceholder;
      }
    }
    if (opts.color) {
      const contentEl = block.querySelector('[class^="tb-"]');
      if (contentEl) contentEl.style.color = opts.color;
    }
    if (opts.fontSize) {
      const contentEl = block.querySelector('[class^="tb-"]');
      if (contentEl) contentEl.style.fontSize = opts.fontSize + 'px';
    }
    // overlay 내 row wrapper (overlay 구조 유지용)
    const overlayRow = document.createElement('div');
    overlayRow.className = 'row'; overlayRow.dataset.layout = 'stack';
    if (opts.paddingX !== undefined) {
      overlayRow.style.paddingLeft  = opts.paddingX + 'px';
      overlayRow.style.paddingRight = opts.paddingX + 'px';
      overlayRow.dataset.paddingX   = opts.paddingX;
    }
    overlayRow.appendChild(block);
    insertIntoOverlay(overlay, overlayRow);
    bindBlock(block);
    window.buildLayerPanel();
    return;
  }

  // 활성 프레임(frame-block) 분기 — freeLayout / fullWidth 모두 처리
  const activeSS = window._activeFrame;
  if (activeSS) {
    window.pushHistory();
    const { block } = makeTextBlock(type);
    const tf = _makeTextFrame();
    applyTextOpts(block, tf, opts, type);
    tf.appendChild(block);

    if (activeSS.dataset.freeLayout === 'true') {
      // B 모드: 자유배치 프레임 — text-frame을 absolute로 추가
      // opts에 x/y/width가 있으면 절대좌표 고정, 없으면 자동 스택
      const hasAbsCoords = (opts.x !== undefined || opts.y !== undefined || opts.width !== undefined);
      const stackY = hasAbsCoords ? (opts.y ?? 0) : _calcFreeLayoutStackY(activeSS);
      const leftPx = hasAbsCoords ? (opts.x ?? 0) : 0;
      const widthVal = opts.width ? opts.width + 'px' : '100%';
      tf.style.position = 'absolute';
      tf.style.left     = leftPx + 'px';
      tf.style.top      = stackY + 'px';
      tf.style.width    = widthVal;
      if (hasAbsCoords) {
        tf.dataset.offsetX = leftPx;
        tf.dataset.offsetY = stackY;
      }
      activeSS.appendChild(tf);
    } else if (activeSS.dataset.fullWidth === 'true') {
      // A 모드: fullWidth 플로우 — text-frame을 flow child로 추가
      activeSS.appendChild(tf);
    } else {
      return; // 지원하지 않는 프레임 타입
    }
    bindBlock(block);
    window.buildLayerPanel();
    return;
  }

  // 섹션에 직접 추가
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { block } = makeTextBlock(type);
  const tf = _makeTextFrame();

  // opts.align 없으면 섹션 정렬 상속
  const alignedOpts = { ...opts, align: opts.align || getSectionAlign(sec) };
  applyTextOpts(block, tf, alignedOpts, type);
  tf.appendChild(block);

  insertAfterSelected(sec, tf);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

function promoteToFrame(block) {
  const col = block.closest('.col');
  if (!col) {
    if (window.showToast) window.showToast('열(col) 안의 블록만 컨테이너로 전환할 수 있어요.');
    return;
  }

  window.pushHistory();

  const ssH = Math.max(block.offsetHeight, 120);

  const ss = document.createElement('div');
  ss.className = 'frame-block';
  ss.id = genId('ss');
  ss.dataset.bg = 'transparent';
  ss.dataset.width = '100%';
  ss.style.cssText = `background:transparent;padding:0;width:100%;height:${ssH}px;min-height:${ssH}px;`;

  // 원래 자리에 ss 삽입, block을 ss로 이동
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
  ss.appendChild(block);

  window.bindFrameDropZone?.(ss);
  window.deselectAll?.();

  const sec = ss.closest('.section-block');
  if (sec) {
    sec.classList.add('selected');
    window.syncLayerActive?.(sec);
  }
  ss.classList.add('selected');
  window._activeFrame = ss;
  window.showFrameProperties?.(ss);
  window.showFrameHandles?.(ss);
  window.buildLayerPanel();
  window.scheduleAutoSave?.();
}

function groupSelectedBlocks() {
  const selected = [...document.querySelectorAll('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected, .label-group-block.selected, .card-block.selected, .graph-block.selected, .divider-block.selected, .icon-text-block.selected')];

  // 단일 블록 → 서브섹션으로 승격
  if (selected.length === 1) {
    promoteToFrame(selected[0]);
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
    const row = b.classList.contains('gap-block') ? b : (b.closest('.frame-block[data-text-frame]') || b.closest('.row'));
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
  else bindEmptyRow(row);
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
    // preset 고정 width가 있으면(logo 등) opts.width로 덮어쓰지 않음
    if (opts.width && !ASSET_PRESETS[preset]?.width) block.style.width = opts.width + 'px';
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
  if (_insertToFlowFrame(() => {
    const { row, block } = makeAssetBlock();
    applyPreset(block);
    applyRowPaddingX(row);
    insertedBlock = block;
    return { row, block };
  }, opts)) {
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
  if (_insertToFlowFrame(() => {
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
  if (_insertToFlowFrame(() => {
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
  window.buildLayerPanel();
  window.selectSection(sec);
}

function addTableBlock(opts = {}) {
  if (_insertToFlowFrame(() => {
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
  if (_insertToFlowFrame(() => {
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
  dvd.dataset.lineDir     = 'horizontal';
  dvd.dataset.lineLength  = '80';
  dvd.innerHTML = `<hr class="dvd-line" style="border-top:1px solid #cccccc;">`;

  row.appendChild(dvd);
  return { row, block: dvd };
}

function addDividerBlock(opts = {}) {
  if (_insertToFlowFrame(() => {
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
    const _tfId = genId('ss'), _tbId = genId('tb');
    sec.innerHTML = `
      <div class="section-hitzone"><span class="section-label">${secLabel}</span></div>
      <div class="section-toolbar">
        <button class="st-btn st-branch-btn" onclick="openSectionBranchMenu(this)" title="feature 브랜치로 실험">⎇</button>
      </div>
      <div class="section-inner">
        <div class="gap-block" data-type="gap" style="height:100px" id="${genId('gb')}"></div>
        <div class="frame-block" data-text-frame="true" id="${_tfId}">
          <div class="text-block" data-type="heading" id="${_tbId}">
            <div class="tb-h2" contenteditable="false" data-placeholder="소제목을 입력하세요" style="font-family:'Pretendard', sans-serif">새 섹션 제목</div>
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
  // bindSectionHitzone은 hz.cloneNode(true)로 label을 교체하므로
  // 반드시 bindSectionHitzone 이후에 bindSectionDrag를 호출해야 함 (FIX-SD-01)
  if (window.bindSectionHitzone) window.bindSectionHitzone(sec);
  bindSectionDrag(sec);
  sec.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .shape-block, .vector-block, .step-block, .chat-block').forEach(b => bindBlock(b));
  sec.querySelectorAll('.frame-block').forEach(ss => window.bindFrameDropZone?.(ss));
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
  if (window._activeFrame) {
    const ss = window._activeFrame;
    const { block } = makeJokerBlock(opts);
    block.style.position = 'absolute';
    block.style.left = `${opts.x || 0}px`;
    block.style.top  = `${opts.y || 0}px`;
    block.style.transform = ''; // absolute 모드에서는 transform 사용 안 함
    ss.appendChild(block);
    bindBlock(block);
    window.buildLayerPanel();
    return;
  }
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeJokerBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

/* ── Frame Block ── */
function makeFrameBlock(opts = {}) {
  const ss = document.createElement('div');
  ss.className = 'frame-block';
  ss.id = genId('ss');

  if (opts.fullWidth) {
    // fullWidth 모드: 이중 배경 섹션용. 플로우 레이아웃, height: auto
    const bg = opts.bg || 'transparent';
    ss.dataset.bg = bg;
    ss.dataset.fullWidth = 'true';
    let css = `background:${bg};width:100%;box-sizing:border-box;`;
    if (opts.radius !== undefined) {
      ss.dataset.radius = String(opts.radius);
      css += `border-radius:${opts.radius}px;overflow:hidden;`;
    }
    ss.style.cssText = css;
  } else {
    // freeLayout 모드: 자유배치 프레임 (기본값) — absolute 자식
    ss.dataset.bg = 'transparent';
    ss.dataset.freeLayout = 'true';
    ss.dataset.width = '860';
    ss.dataset.height = '520';
    ss.dataset.padY = '0';
    let css = `background:transparent;padding:0;width:860px;max-width:100%;margin:0 auto;min-height:520px;height:520px;`;
    if (opts.radius !== undefined) {
      ss.dataset.radius = String(opts.radius);
      css += `border-radius:${opts.radius}px;overflow:hidden;`;
    }
    ss.style.cssText = css;
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
function _insertToFlowFrame(makeBlockFn, opts = {}) {
  const ss = window._activeFrame;
  if (!ss) return false;

  /* ── B 모드: 자유배치 프레임 ── */
  if (ss.dataset.freeLayout === 'true') {
    window.pushHistory();
    const result = makeBlockFn();
    if (!result) return true;
    const isRowBlock = !!(result.row && result.block);
    const block = isRowBlock ? result.block : result;
    // opts에 x/y/width가 있으면 절대좌표 고정, 없으면 자동 스택
    const hasAbsCoords = (opts.x !== undefined || opts.y !== undefined || opts.width !== undefined);
    const stackY = hasAbsCoords ? (opts.y ?? 0) : _calcFreeLayoutStackY(ss);
    const leftPx = hasAbsCoords ? (opts.x ?? 0) : 0;
    // opts.width 없으면 preset이 설정한 width 유지 (logo 등 고정 너비 preset 보호)
    const widthVal = opts.width ? opts.width + 'px' : (block.style.width || '100%');
    block.style.position = 'absolute';
    block.style.left     = leftPx + 'px';
    block.style.top      = stackY + 'px';
    block.style.width    = widthVal;
    block.style.transform = '';
    if (hasAbsCoords) {
      block.dataset.offsetX = leftPx;
      block.dataset.offsetY = stackY;
    }
    ss.appendChild(block);
    bindBlock(block);
    block.setAttribute('draggable', 'false');
    window.buildLayerPanel();
    return true;
  }

  /* ── A 모드: fullWidth 플로우 레이아웃 ── */
  if (ss.dataset.fullWidth !== 'true') return false;
  window.pushHistory();
  const result = makeBlockFn();
  // makeBlockFn이 { row, block } 또는 block(gap) 반환
  if (result && result.row) {
    ss.appendChild(result.row);
    bindBlock(result.block);
  } else if (result) {
    ss.appendChild(result);
    bindBlock(result);
  }
  window.buildLayerPanel();
  return true;
}

function addFrameBlock(opts = {}) {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const ss = makeFrameBlock(opts);

  // 활성 프레임 안에 삽입 (중첩 프레임) — fullWidth 모드 및 shape frame 제외
  const activeFrame = !opts.fullWidth && window._activeFrame;
  const isShapeFrame = activeFrame && !!activeFrame.querySelector(':scope > .shape-block');
  if (activeFrame && !isShapeFrame && activeFrame.closest('.section-block') === sec) {
    activeFrame.appendChild(ss);
  } else {
    // shape frame이 활성화된 상태면 _activeFrame을 임시 해제
    // insertAfterSelected가 내부적으로 _activeFrame을 참조해 shape wrapper 안에 삽입하는 것을 방지
    const _prev = window._activeFrame;
    if (isShapeFrame) window._activeFrame = null;
    insertAfterSelected(sec, ss);
    if (isShapeFrame) window._activeFrame = _prev;
  }

  if (!opts.fullWidth) window.bindFrameDropZone?.(ss);
  window.buildLayerPanel();
  window.deselectAll?.();
  sec.classList.add('selected');
  window.syncLayerActive?.(sec);
  ss.classList.add('selected');
  window._activeFrame = ss;
  if (!opts.fullWidth) {
    window.showFrameProperties?.(ss);
    window.showFrameHandles?.(ss);
  }
}

function activateFrame(ss) {
  window._activeFrame = ss;
}
function deactivateFrame() {
  window._activeFrame = null;
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

  // ── freeLayout 내부 묶기: X/Y 좌표 유지 ──────────────────────────────────
  // 선택된 블록들이 동일한 freeLayout 프레임 안에 있으면 절대좌표 기반으로 처리
  const parentFreeFrame = selected[0].closest('.frame-block[data-free-layout]');
  const allInSameFreeFrame = parentFreeFrame &&
    selected.every(b => b.closest('.frame-block[data-free-layout]') === parentFreeFrame);

  if (allInSameFreeFrame) {
    // 각 블록의 absolute wrapper(text-frame 또는 블록 자체) 수집
    const wrappers = [];
    selected.forEach(b => {
      const w = b.closest('.frame-block[data-text-frame]') ||
                b.closest('.frame-block[data-shape-frame]') ||
                (b.style.position === 'absolute' ? b : null);
      if (w && !wrappers.includes(w)) wrappers.push(w);
    });

    if (wrappers.length === 0) return;

    // bounding box 계산 (캔버스 좌표)
    const lefts  = wrappers.map(w => parseInt(w.style.left)  || 0);
    const tops   = wrappers.map(w => parseInt(w.style.top)   || 0);
    const rights = wrappers.map((w, i) => lefts[i]  + (w.offsetWidth  || 0));
    const bots   = wrappers.map((w, i) => tops[i]   + (w.offsetHeight || 0));
    const minX = Math.min(...lefts);
    const minY = Math.min(...tops);
    const maxX = Math.max(...rights);
    const maxY = Math.max(...bots);
    const frameW = Math.max(maxX - minX, 60);
    const frameH = Math.max(maxY - minY, 60);

    // 새 freeLayout 프레임 생성 — 부모 프레임 내 같은 위치에
    const ss = makeFrameBlock();
    ss.setAttribute('data-free-layout', 'true');
    ss.style.cssText =
      `position:absolute;left:${minX}px;top:${minY}px;` +
      `width:${frameW}px;height:${frameH}px;` +
      `background:transparent;padding:0;`;
    ss.dataset.bg = 'transparent';
    ss.dataset.offsetX = String(minX);
    ss.dataset.offsetY = String(minY);
    parentFreeFrame.appendChild(ss);

    // 각 wrapper를 새 프레임으로 이동 — 상대좌표로 보정
    wrappers.forEach((w, i) => {
      const relLeft = lefts[i] - minX;
      const relTop  = tops[i]  - minY;
      w.style.left = relLeft + 'px';
      w.style.top  = relTop  + 'px';
      w.dataset.offsetX = String(relLeft);
      w.dataset.offsetY = String(relTop);
      w.classList.remove('selected');
      ss.appendChild(w);
    });

    window.bindFrameDropZone?.(ss);

    // 프레임 선택 상태로 전환
    window.deselectAll?.();
    sec.classList.add('selected');
    window.syncLayerActive?.(sec);
    parentFreeFrame.classList.add('selected');
    ss.classList.add('selected');
    window._activeFrame = ss;
    window.showFrameProperties?.(ss);
    window.showFrameHandles?.(ss);
    window.buildLayerPanel();
    window.scheduleAutoSave?.();
    return;
  }

  // ── 섹션 레벨(flow) 블록 묶기: 기존 stack 방식 ───────────────────────────
  const sectionInner = sec.querySelector('.section-inner');
  const childrenInOrder = [...sectionInner.children];
  const rows = [];
  selected.forEach(b => {
    const row = b.classList.contains('gap-block') ? b : (b.closest('.frame-block[data-text-frame]') || b.closest('.row') || b);
    if (row && !rows.includes(row)) rows.push(row);
  });
  rows.sort((a, b) => childrenInOrder.indexOf(a) - childrenInOrder.indexOf(b));

  // 선택 블록들의 총 높이 계산 (프레임 높이 결정)
  const GAP = 0;
  let totalH = 0;
  rows.forEach(row => { totalH += (row.offsetHeight || 60) + GAP; });
  const frameH = Math.max(totalH, 120);

  // 자유배치(absolute) 프레임 생성
  const ss = makeFrameBlock();
  ss.style.cssText = `background:transparent;padding:0;width:100%;height:${frameH}px;min-height:${frameH}px;`;
  ss.dataset.bg = 'transparent';
  ss.dataset.width = '100%';
  ss.dataset.padY = '0';

  // 첫 번째 row 자리에 프레임 삽입
  rows[0].before(ss);

  // 각 블록을 absolute 배치로 ss에 직접 이동
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
      ss.appendChild(block);
    });
    stackY += rowH + GAP;
    if (!isGapRow) row.remove();
  });

  window.bindFrameDropZone?.(ss);

  // 프레임 선택 상태로 전환
  window.deselectAll?.();
  sec.classList.add('selected');
  window.syncLayerActive?.(sec);
  ss.classList.add('selected');
  window._activeFrame = ss;
  window.showFrameProperties?.(ss);
  window.showFrameHandles?.(ss);
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
  promoteToFrame,
  makePresetRow,
  addPresetRow,
  addAssetBlock,
  addGapBlock,
  addIconCircleBlock,
  addTableBlock,
  makeGraphBlock,
  addGraphBlock,
  makeDividerBlock,
  addDividerBlock,
  addSection,
  makeFrameBlock,
  addFrameBlock,
  wrapSelectedBlocksInFrame,
  activateFrame,
  deactivateFrame,
};

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
  const ss = makeFrameBlock();
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
  // shape block을 ss 직속으로 배치
  block.style.position = 'absolute';
  block.style.left = '0';
  block.style.top  = '0';
  ss.appendChild(block);
  bindBlock(block);

  // 삽입 대상 결정: 활성 프레임 → 선택된 프레임 → 섹션 레벨
  const activeFrame = window._activeFrame;
  const isActiveShapeFrame = activeFrame && !!activeFrame.querySelector(':scope > .shape-block');

  if (activeFrame && !isActiveShapeFrame && activeFrame.closest('.section-block') === sec) {
    // 활성 프레임 안에 삽입
    if (activeFrame.dataset.freeLayout === 'true') {
      const stackY = _calcFreeLayoutStackY(activeFrame);
      ss.style.position = 'absolute';
      ss.style.left = '20px';
      ss.style.top  = stackY + 'px';
    }
    activeFrame.appendChild(ss);
  } else {
    const selSS = document.querySelector('.frame-block.selected');
    const isSelShapeFrame = selSS && !!selSS.querySelector(':scope > .shape-block');
    if (selSS && !isSelShapeFrame && selSS.closest('.section-block') === sec) {
      // 선택된 프레임 안에 삽입
      if (selSS.dataset.freeLayout === 'true') {
        const stackY = _calcFreeLayoutStackY(selSS);
        ss.style.position = 'absolute';
        ss.style.left = '20px';
        ss.style.top  = stackY + 'px';
      }
      selSS.appendChild(ss);
    } else {
      // 섹션 레벨에 삽입 (shape frame은 다른 ss 중첩 금지)
      const prevActiveSS = window._activeFrame;
      window._activeFrame = null;
      insertAfterSelected(sec, ss);
      window._activeFrame = prevActiveSS;
    }
  }

  window.bindFrameDropZone?.(ss);
  window.buildLayerPanel();
  window._activeFrame = ss;
  window.showFrameProperties?.(ss);
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
  const parentSS = makeFrameBlock();
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

  // parentSS는 overflow:visible — 셀이 absolute로 배치되므로
  parentSS.style.overflow = 'visible';

  // ── 2. 셀 Frame 생성 (rows × cols) ──
  for (let r = 0; r < rows; r++) {
    const y = r * (cellH + gap);
    let x = 0;
    for (let c = 0; c < cols; c++) {
      const w = colWidths[c];
      const cellSS = makeFrameBlock();
      const cellIdx = r * cols + c + 1;
      cellSS.dataset.layerName = `Cell ${cellIdx}`;
      cellSS.setAttribute('data-layer-name', `Cell ${cellIdx}`);
      cellSS.style.cssText = `position:absolute;left:${x}px;top:${y}px;` +
        `width:${w}px;height:${cellH}px;min-height:${cellH}px;margin:0;box-sizing:border-box;overflow:hidden;`;
      cellSS.dataset.offsetX  = String(x);
      cellSS.dataset.offsetY  = String(y);
      cellSS.dataset.width    = String(w);
      cellSS.dataset.height   = String(cellH);
      cellSS.dataset.gridCell = `${r}-${c}`;

      parentSS.appendChild(cellSS);
      window.bindFrameDropZone?.(cellSS);
      x += w + gap;
    }
  }

  // ── 3. 섹션에 삽입 ──
  const _prev = window._activeFrame;
  window._activeFrame = null;
  insertAfterSelected(sec, parentSS);
  window._activeFrame = _prev;

  window.bindFrameDropZone?.(parentSS);
  window.buildLayerPanel();
  window._activeFrame = parentSS;
  window.showFrameProperties?.(parentSS);

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

// ── Speech Bubble Block ───────────────────────────────────────────────────────
// iMessage 스타일 SVG 말꼬리
// left/right: 비대칭 (right는 CSS scaleX(-1) 반전), center: 대칭 하향
function getBubbleTailSVG(tail) {
  if (tail === 'center') {
    // 대칭형 — 팁이 정가운데 아래를 향함
    return `<svg class="tb-bubble-tail" viewBox="0 0 18 16" xmlns="http://www.w3.org/2000/svg" width="18" height="16"><path d="M0 0 C5 3 8 12 9 16 C10 12 13 3 18 0 Z"/></svg>`;
  }
  // left / right 공용 (right는 CSS scaleX(-1) 처리) — Figma bubble-tail 벡터
  return `<svg class="tb-bubble-tail" viewBox="0 0 19 16" xmlns="http://www.w3.org/2000/svg" width="19" height="16"><path d="M18.3597 14.7395C9.25742 16.3944 2.32729 11.6364 0 9.05055L0.258587 1.29294C2.75826 1.81011 8.17136 2.27557 9.82631 0C9.56773 9.30914 16.5496 13.9637 18.3597 14.7395Z"/></svg>`;
}
window.getBubbleTailSVG = getBubbleTailSVG;

function makeSpeechBubbleBlock(tail) {
  tail = tail || 'left';
  const block = document.createElement('div');
  block.className = 'text-block speech-bubble-block';
  block.dataset.type = 'speech-bubble';
  block.dataset.tail = tail;
  block.dataset.bubbleStyle = 'default';
  block.dataset.showSender = 'false';
  block.dataset.senderName = 'Your name';
  block.id = genId('sb');
  const phText = '말풍선 텍스트를 입력하세요';
  block.innerHTML = `<div class="tb-sender-name" style="display:none">Your name</div><div class="tb-bubble" contenteditable="false" style="font-family:'Pretendard',sans-serif" data-placeholder="${phText}" data-is-placeholder="true">${phText}</div>${getBubbleTailSVG(tail)}`;
  return { block };
}

function addSpeechBubbleBlock(tail) {
  tail = tail || 'left';

  const sec = window.getSelectedSection();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory();

  const { block } = makeSpeechBubbleBlock(tail);
  const tf = _makeTextFrame();
  tf.appendChild(block);

  // 텍스트프레임 빈 영역 클릭 시 내부 버블 블록 선택 위임
  tf.addEventListener('click', e => {
    if (e.target === tf) block.click();
  });

  insertAfterSelected(sec, tf);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

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
window.promoteToFrame  = promoteToFrame;
window.makePresetRow        = makePresetRow;
window.addPresetRow         = addPresetRow;
window.addAssetBlock        = addAssetBlock;
window.addGapBlock          = addGapBlock;
window.addIconCircleBlock   = addIconCircleBlock;
window.addTableBlock        = addTableBlock;
window.makeGraphBlock       = makeGraphBlock;
window.addGraphBlock        = addGraphBlock;
window.makeDividerBlock     = makeDividerBlock;
window.addDividerBlock      = addDividerBlock;
window.addSection           = addSection;
window.makeFrameBlock        = makeFrameBlock;
window.addFrameBlock         = addFrameBlock;
window.wrapSelectedBlocksInFrame  = wrapSelectedBlocksInFrame;
window.activateFrame         = activateFrame;
window.deactivateFrame = deactivateFrame;
window.makeJokerBlock       = makeJokerBlock;
window.addJokerBlock        = addJokerBlock;
window.makeShapeBlock       = makeShapeBlock;
window.addShapeBlock        = addShapeBlock;
window.makeSpeechBubbleBlock = makeSpeechBubbleBlock;
window.addSpeechBubbleBlock  = addSpeechBubbleBlock;

// ── Canvas Block ─────────────────────────────────────────────────────────────
// Figma에서 임포트한 레이어 합성 블록 (shape + image + text 절대배치 단일 컴포넌트)

function _appendCardTexts(container, card, titleSize, descSize, textAlign, titleColor, descColor) {
  const _tc = titleColor || '#ffffff';
  const _dc = descColor  || '#aaaaaa';
  if (card.title) {
    const el = document.createElement('div');
    el.style.cssText = `font-size:${titleSize}px;font-weight:600;color:${_tc};text-align:${textAlign};white-space:pre-wrap;word-break:break-word;line-height:1.3;font-family:Pretendard,-apple-system,sans-serif;`;
    el.textContent = card.title;
    container.appendChild(el);
  }
  if (card.desc) {
    const el = document.createElement('div');
    el.style.cssText = `font-size:${descSize}px;font-weight:400;color:${_dc};text-align:${textAlign};white-space:pre-wrap;word-break:break-word;line-height:1.4;font-family:Pretendard,-apple-system,sans-serif;`;
    el.textContent = card.desc;
    container.appendChild(el);
  }
  if (!card.title && !card.desc) {
    const ph = document.createElement('div');
    ph.style.cssText = 'color:#bbb;font-size:13px;font-family:sans-serif;text-align:center;';
    ph.textContent = '텍스트를 입력하세요';
    container.appendChild(ph);
  }
}

function renderCanvas(block) {
  const layers   = JSON.parse(block.dataset.layers || '[]');
  const designW  = parseInt(block.dataset.canvasW) || 360;
  const designH  = parseInt(block.dataset.canvasH) || 400;
  const bg       = block.dataset.bg || 'transparent';
  const radius   = parseInt(block.dataset.radius) || 0;
  const gridCols = parseInt(block.dataset.gridCols) || 1;
  const gridRows = parseInt(block.dataset.gridRows) || 1;
  const GAP      = parseInt(block.dataset.cardGap ?? '12'); // 카드 사이 간격

  // ── Simple Card Mode ──────────────────────────────────────────────────────
  if (block.dataset.cardMode === 'simple') {
    const imgRatio   = Math.min(90, Math.max(10, parseInt(block.dataset.imgRatio) ?? 65));
    const textHide   = block.dataset.textHide === 'true';
    const textBg     = block.dataset.textBg    || '#f5f5f5';
    const titleSize  = parseInt(block.dataset.titleSize) || 20;
    const descSize   = parseInt(block.dataset.descSize)  || 14;
    const textAlign  = block.dataset.textAlign || 'left';
    const titleColor = block.dataset.titleColor || '#ffffff';
    const descColor  = block.dataset.descColor  || '#aaaaaa';
    const cards     = JSON.parse(block.dataset.cards    || '[]');

    const totalW = designW * gridCols + GAP * (gridCols - 1);
    const totalH = designH * gridRows + GAP * (gridRows - 1);

    if (gridCols === 1) {
      block.style.width    = designW + 'px';
      block.style.maxWidth = '';
      block.style.minWidth = '';
    } else {
      block.style.width    = '100%';
      block.style.maxWidth = '';
      block.style.minWidth = '0';
    }
    const padX = parseInt(block.dataset.padX ?? '0');

    block.style.minHeight     = '';
    block.style.aspectRatio   = '';
    block.style.background    = 'transparent';
    block.style.borderRadius  = '0';
    block.style.position      = 'relative';
    block.style.overflow      = 'hidden';
    block.style.paddingLeft   = '';
    block.style.paddingRight  = '';
    block.style.boxSizing     = '';

    let inner = block.querySelector('.cvb-inner');
    if (!inner) { inner = document.createElement('div'); inner.className = 'cvb-inner'; block.appendChild(inner); }
    inner.innerHTML = '';
    // right/bottom:auto to override CSS class inset:0
    inner.style.cssText = `position:absolute;top:0;left:${padX}px;right:auto;bottom:auto;width:${totalW}px;height:${totalH}px;transform-origin:top left;pointer-events:none;overflow:visible;`;

    const applyScale = () => {
      const aw = block.offsetWidth;
      if (aw <= 0) return;
      const availW = Math.max(1, aw - 2 * padX);
      const scale = availW / totalW;
      inner.style.transform = `scale(${scale})`;
      block.style.height = (totalH * scale) + 'px';
    };
    applyScale();
    if (block._cvbRO) block._cvbRO.disconnect();
    block._cvbRO = new ResizeObserver(applyScale);
    block._cvbRO.observe(block);

    const orient = block.dataset.cardOrient || 'portrait'; // 'portrait' | 'landscape'

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const idx    = r * gridCols + c;
        const card   = cards[idx] || {};
        const cellX  = c * (designW + GAP);
        const cellY  = r * (designH + GAP);
        const cardBg = card.cellBg || textBg;

        const cell = document.createElement('div');
        cell.style.cssText = `position:absolute;left:${cellX}px;top:${cellY}px;width:${designW}px;height:${designH}px;border-radius:${radius}px;overflow:hidden;`;

        if (orient === 'landscape') {
          // ── 가로 모드: 이미지 좌 / 텍스트 우 ────────────────────────────
          const imgW  = textHide ? designW : Math.round(designW * imgRatio / 100);
          const textW = designW - imgW;

          const imgDiv = document.createElement('div');
          imgDiv.style.cssText = `position:absolute;left:0;top:0;width:${imgW}px;height:${designH}px;overflow:hidden;flex-shrink:0;`;
          if (card.imgSrc) {
            imgDiv.style.backgroundImage    = `url("${card.imgSrc}")`;
            imgDiv.style.backgroundSize     = 'cover';
            imgDiv.style.backgroundPosition = 'center';
          } else {
            imgDiv.style.background = 'rgba(0,0,0,0.06)';
            imgDiv.style.display = 'flex'; imgDiv.style.alignItems = 'center'; imgDiv.style.justifyContent = 'center';
            const ph = document.createElement('span');
            ph.style.cssText = 'color:rgba(0,0,0,0.2);font-size:28px;font-family:sans-serif;pointer-events:none;font-weight:200;';
            ph.textContent = '+'; imgDiv.appendChild(ph);
          }
          cell.appendChild(imgDiv);

          if (!textHide) {
            const textDiv = document.createElement('div');
            textDiv.style.cssText = `position:absolute;left:${imgW}px;top:0;width:${textW}px;height:${designH}px;background:${cardBg};box-sizing:border-box;padding:14px 16px;display:flex;flex-direction:column;justify-content:center;gap:6px;`;
            _appendCardTexts(textDiv, card, titleSize, descSize, textAlign, titleColor, descColor);
            cell.appendChild(textDiv);
          }

        } else {
          // ── 세로 모드(기본): 이미지 상 / 텍스트 하 ──────────────────────
          const imgH  = textHide ? designH : Math.round(designH * imgRatio / 100);
          const textH = designH - imgH;

          const imgDiv = document.createElement('div');
          imgDiv.style.cssText = `width:100%;height:${imgH}px;overflow:hidden;box-sizing:border-box;flex-shrink:0;`;
          if (card.imgSrc) {
            imgDiv.style.backgroundImage    = `url("${card.imgSrc}")`;
            imgDiv.style.backgroundSize     = 'cover';
            imgDiv.style.backgroundPosition = 'center';
            imgDiv.style.backgroundRepeat   = 'no-repeat';
          } else {
            imgDiv.style.background = 'rgba(0,0,0,0.06)';
            imgDiv.style.display = 'flex'; imgDiv.style.alignItems = 'center'; imgDiv.style.justifyContent = 'center';
            const ph = document.createElement('span');
            ph.style.cssText = 'color:rgba(0,0,0,0.2);font-size:28px;font-family:sans-serif;pointer-events:none;font-weight:200;';
            ph.textContent = '+'; imgDiv.appendChild(ph);
          }
          cell.appendChild(imgDiv);

          if (!textHide) {
            const textDiv = document.createElement('div');
            textDiv.style.cssText = `width:100%;height:${textH}px;background:${cardBg};box-sizing:border-box;padding:10px 14px;display:flex;flex-direction:column;justify-content:center;gap:4px;border-radius:0 0 ${radius}px ${radius}px;`;
            _appendCardTexts(textDiv, card, titleSize, descSize, textAlign, titleColor, descColor);
            cell.appendChild(textDiv);
          }
        }

        inner.appendChild(cell);
      }
    }
    return;
  }
  // ── End Simple Card Mode ───────────────────────────────────────────────────

  const totalW = designW * gridCols + GAP * (gridCols - 1);
  const totalH = designH * gridRows + GAP * (gridRows - 1);

  // block: gridCols===1이면 고정 너비, 2+이면 섹션 너비에 맞춤
  if (gridCols === 1) {
    block.style.width    = designW + 'px';
    block.style.maxWidth = '';
    block.style.minWidth = '';
  } else {
    block.style.width    = '100%';
    block.style.maxWidth = '';
    block.style.minWidth = '0';
  }
  block.style.height       = '';
  block.style.minHeight    = '';
  block.style.aspectRatio  = `${totalW} / ${totalH}`;
  block.style.background   = 'transparent'; // 개별 셀이 배경 가짐
  block.style.borderRadius = '0';
  block.style.position     = 'relative';
  block.style.overflow     = 'hidden';
  const padX = parseInt(block.dataset.padX ?? '0');
  block.style.paddingLeft  = '';
  block.style.paddingRight = '';
  block.style.boxSizing    = '';

  // cvb-inner: 디자인 좌표계 전체 크기
  let inner = block.querySelector('.cvb-inner');
  if (!inner) { inner = document.createElement('div'); inner.className = 'cvb-inner'; block.appendChild(inner); }
  inner.innerHTML = '';
  inner.style.cssText = `position:absolute;top:0;left:${padX}px;right:auto;bottom:auto;width:${totalW}px;height:${totalH}px;transform-origin:top left;pointer-events:none;overflow:visible;`;

  // scale 갱신 함수
  const applyScale = () => {
    const aw = block.offsetWidth;
    if (aw <= 0) return;
    const availW = Math.max(1, aw - 2 * padX);
    inner.style.transform = `scale(${availW / totalW})`;
  };
  applyScale();

  // ResizeObserver 로 동적 갱신
  if (block._cvbRO) block._cvbRO.disconnect();
  block._cvbRO = new ResizeObserver(applyScale);
  block._cvbRO.observe(block);

  // 빈 레이어 — 플레이스홀더 (그리드 셀 단위로)
  if (layers.length === 0) {
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const cellX = c * (designW + GAP);
        const cellY = r * (designH + GAP);
        const ph = document.createElement('div');
        ph.style.cssText = `position:absolute;left:${cellX}px;top:${cellY}px;width:${designW}px;height:${designH}px;display:flex;align-items:center;justify-content:center;border:2px dashed #ccc;border-radius:${radius}px;color:#bbb;font-size:13px;font-family:sans-serif;`;
        ph.textContent = 'Card Block';
        inner.appendChild(ph);
      }
    }
    return;
  }

  // 각 그리드 셀에 레이어 렌더링
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const cellX = c * (designW + GAP);
      const cellY = r * (designH + GAP);

      // 셀 컨테이너 (배경, 반경)
      const cell = document.createElement('div');
      cell.style.cssText = `position:absolute;left:${cellX}px;top:${cellY}px;width:${designW}px;height:${designH}px;background:${bg};border-radius:${radius}px;overflow:hidden;`;
      inner.appendChild(cell);

      // 레이어 렌더링
      layers.forEach((layer, layerIndex) => {
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;left:${layer.x}px;top:${layer.y}px;width:${layer.w}px;height:${layer.h}px;`;

        if (layer.type === 'shape') {
          el.style.background   = layer.color || '#cccccc';
          el.style.borderRadius = (layer.radius || 0) + 'px';

        } else if (layer.type === 'image') {
          el.style.background   = 'repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 72px 72px';
          el.style.borderRadius = (layer.radius || 0) + 'px';
          if (layer.src) {
            el.style.backgroundImage    = `url("${layer.src}")`;
            el.style.backgroundSize     = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.backgroundRepeat   = 'no-repeat';
          }

        } else if (layer.type === 'text') {
          el.style.color         = layer.color || '#000000';
          el.style.fontSize      = (layer.fontSize || 16) + 'px';
          el.style.fontFamily    = 'Pretendard, -apple-system, sans-serif';
          el.style.fontWeight    = layer.fontWeight || '400';
          el.style.textAlign     = layer.align || 'left';
          el.style.whiteSpace    = 'pre-wrap';
          el.style.lineHeight    = '1.35';
          el.style.wordBreak     = 'break-word';
          el.style.pointerEvents = 'auto';
          el.style.overflow      = 'visible';
          el.style.cursor        = 'default';
          el.textContent         = layer.content || '';

          // 더블클릭 텍스트 편집 (첫 번째 셀만 편집 가능, 나머지는 동기화)
          if (r === 0 && c === 0) {
            el.addEventListener('dblclick', e => {
              e.stopPropagation();
              el.contentEditable = 'true';
              el.focus();
              const range = document.createRange();
              range.selectNodeContents(el);
              range.collapse(false);
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
              el.style.outline    = '1.5px dashed #1592fe';
              el.style.background = 'rgba(255,255,255,0.15)';
              el.style.cursor     = 'text';
              block.dataset.editing = 'true';
            });
            el.addEventListener('blur', () => {
              el.contentEditable = 'false';
              el.style.outline    = '';
              el.style.background = '';
              el.style.cursor     = 'default';
              delete block.dataset.editing;
              const curLayers = JSON.parse(block.dataset.layers || '[]');
              if (curLayers[layerIndex]) {
                curLayers[layerIndex].content = el.innerText;
                block.dataset.layers = JSON.stringify(curLayers);
                window.pushHistory?.();
                window.scheduleAutoSave?.();
                if (block.classList.contains('selected')) window.showCanvasProperties?.(block);
              }
            });
            el.addEventListener('keydown', e => {
              if (e.key === 'Escape') { el.innerText = layer.content || ''; el.blur(); }
            });
          }
          el.addEventListener('mousedown', e => e.stopPropagation());
          el.addEventListener('click',     e => e.stopPropagation());
        }

        cell.appendChild(el);
      });
    }
  }
}

function makeCanvasBlock(data = {}) {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const block = document.createElement('div');
  block.className = 'canvas-block'; block.dataset.type = 'canvas';
  block.id = genId('cvb');
  block.dataset.canvasW   = data.width    || 360;
  block.dataset.canvasH   = data.height   || 400;
  block.dataset.bg        = data.bg       || 'transparent';
  block.dataset.radius    = data.radius   || 0;
  block.dataset.layers    = JSON.stringify(data.layers || []);
  block.dataset.layerName = data.layerName || 'Card';
  block.dataset.gridCols  = data.gridCols || 1;
  block.dataset.gridRows  = data.gridRows || 1;
  block.dataset.cardGap   = data.cardGap ?? 12;
  block.dataset.padX      = data.padX ?? 0;
  if (data.cardMode) {
    block.dataset.cardMode  = data.cardMode;
    block.dataset.imgRatio  = data.imgRatio  ?? 65;
    block.dataset.textBg    = data.textBg    || '#f5f5f5';
    block.dataset.titleSize = data.titleSize || 20;
    block.dataset.descSize  = data.descSize  || 14;
    block.dataset.textAlign = data.textAlign || 'left';
    block.dataset.cards     = JSON.stringify(data.cards || [{ title: '카드 제목', desc: '', imgSrc: '', cellBg: '' }]);
  }

  const gridCols = parseInt(block.dataset.gridCols) || 1;
  const gridRows = parseInt(block.dataset.gridRows) || 1;
  const GAP      = parseInt(block.dataset.cardGap ?? '12');
  const totalW   = (data.width || 360) * gridCols + GAP * (gridCols - 1);
  // 단독(stack) row일 때 너비를 전체 그리드 너비로 고정 (flex:1 환경에선 무시됨)
  block.style.width = totalW + 'px';

  renderCanvas(block);

  row.appendChild(block);
  return { row, block };
}

const CARD_DEFAULT_OPTS = {
  width: 360, height: 508,
  bg: 'transparent', radius: 12,
  cardMode: 'simple',
  imgRatio: 65,
  textBg: '#a2abb8',
  titleSize: 40,
  descSize: 22,
  textAlign: 'center',
  layerName: 'Card',
  layers: [],
  gridCols: 1, gridRows: 1, cardGap: 12, padX: 0,
  cards: [{ title: '카드 제목', desc: '', imgSrc: '', cellBg: '' }],
};

function addCanvasBlock(opts = {}) {
  // 옵션 없이 호출 시 (플로팅 패널 Card 버튼) → 기본 심플 카드 템플릿 사용
  if (!opts.cardMode && !opts.layers?.length) {
    opts = { ...CARD_DEFAULT_OPTS, ...opts };
  }
  if (_insertToFlowFrame(() => {
    const { row, block } = makeCanvasBlock(opts);
    return { row, block };
  })) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeCanvasBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

window.makeCanvasBlock  = makeCanvasBlock;
window.addCanvasBlock   = addCanvasBlock;
window.renderCanvas     = renderCanvas;

// ── Iconify Block ─────────────────────────────────────────────────────────────
function makeIconifyBlock(iconName = '', svgContent = '', size = 64) {
  const row   = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const block = document.createElement('div');
  block.className     = 'icon-block';
  block.dataset.type  = 'icon';
  block.id            = genId('icn');
  block.dataset.iconName  = iconName;
  block.dataset.size      = String(size);
  block.dataset.rotation  = '0';
  block.dataset.iconColor = '#000000';

  _applyIconifyBlockStyle(block, svgContent, size, 0);
  block.style.color = '#000000';

  row.appendChild(block);
  return { row, block };
}

function _applyIconifyBlockStyle(block, svgContent, size, rotation) {
  block.style.cssText = `width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:content-box;`;
  if (rotation) block.style.transform = `rotate(${rotation}deg)`;
  if (svgContent) {
    block.innerHTML = svgContent;
    const svg = block.querySelector('svg');
    if (svg) { svg.setAttribute('width', size); svg.setAttribute('height', size); svg.style.display = 'block'; }
  } else {
    block.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  }
}
window._applyIconifyBlockStyle = _applyIconifyBlockStyle;

function addIconifyBlock(iconName, svgContent, size = 64) {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeIconifyBlock(iconName, svgContent, size);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

window.makeIconifyBlock = makeIconifyBlock;
window.addIconifyBlock  = addIconifyBlock;

// ── Device Mockup Block ───────────────────────────────────────────────────────
function makeDeviceMockupBlock(deviceKey, width) {
  const devices = window.MOCKUP_DEVICES || {};
  const dev = devices[deviceKey];
  if (!dev) { console.warn('Unknown device:', deviceKey); return null; }

  const uid = genId('mkp').replace('mkp_', '');
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const block = document.createElement('div');
  block.className    = 'mockup-block';
  block.dataset.type = 'mockup';
  block.id           = genId('mkp');
  block.dataset.device    = deviceKey;
  block.dataset.shadow    = 'soft';
  block.dataset.imgSrc    = '';
  block.dataset.sourceSec = '';
  block.dataset.width     = String(width);
  block.dataset.uid       = uid;

  block.style.cssText = `position:relative;display:block;width:${width}px;margin:0 auto;cursor:pointer;`;

  // 화면 overlay (z-index:1 — SVG 프레임 뒤에)
  const screen = document.createElement('div');
  screen.className = 'mkp-screen';
  const s = dev.screen;
  screen.style.cssText = [
    'position:absolute',
    `left:${s.l}%`,
    `top:${s.t}%`,
    `width:${s.w}%`,
    `height:${s.h}%`,
    'overflow:hidden',
    `border-radius:${dev.screenRadius || '0'}`,
    'z-index:1',
    'background:#111',
  ].join(';');

  // 화면 placeholder
  screen.innerHTML = `
    <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#111;color:#333;font-size:11px;font-family:Pretendard,-apple-system,sans-serif;flex-direction:column;gap:8px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <span>화면 영역</span>
    </div>`;

  // 디바이스 SVG 프레임 (z-index:2 — 화면 위)
  const frame = document.createElement('div');
  frame.className = 'mkp-frame';
  frame.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none;line-height:0;';
  frame.innerHTML = dev.getSvg(uid);

  // 높이 고정: viewBox 비율 기준
  const aspectH = Math.round(width * dev.viewH / dev.viewW);
  block.style.height = aspectH + 'px';

  block.appendChild(screen);
  block.appendChild(frame);

  // 기본 그림자
  block.style.filter = 'drop-shadow(0 20px 60px rgba(0,0,0,0.25))';

  row.appendChild(block);
  return { row, block };
}

function renderMockupBlock(block) {
  const deviceKey = block.dataset.device;
  const width     = parseInt(block.dataset.width) || parseInt(block.style.width) || 360;
  const devices   = window.MOCKUP_DEVICES || {};
  const dev       = devices[deviceKey];
  if (!dev) return;

  const uid = block.dataset.uid || (block.id || '').replace('mkp_', '');

  // 크기 업데이트
  block.style.width  = width + 'px';
  block.style.height = Math.round(width * dev.viewH / dev.viewW) + 'px';

  // 화면 overlay 위치 업데이트
  const screen = block.querySelector('.mkp-screen');
  if (screen) {
    const s = dev.screen;
    screen.style.left   = s.l + '%';
    screen.style.top    = s.t + '%';
    screen.style.width  = s.w + '%';
    screen.style.height = s.h + '%';
    screen.style.borderRadius = dev.screenRadius || '0';
  }

  // SVG 프레임 재생성 (디바이스 변경 시)
  const frame = block.querySelector('.mkp-frame');
  if (frame) frame.innerHTML = dev.getSvg(uid);
}
window.renderMockupBlock = renderMockupBlock;

function addDeviceMockupBlock(deviceKey, width) {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  const result = makeDeviceMockupBlock(deviceKey, width);
  if (!result) return;
  window.pushHistory();
  const { row, block } = result;
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

window.makeDeviceMockupBlock = makeDeviceMockupBlock;
window.addDeviceMockupBlock  = addDeviceMockupBlock;

/* ═══════════════════════════════════
   STEP BLOCK
═══════════════════════════════════ */

const STEP_DEFAULT_DATA = [
  { title: '1단계', desc: '첫 번째 단계 설명' },
  { title: '2단계', desc: '두 번째 단계 설명' },
  { title: '3단계', desc: '세 번째 단계 설명' },
];

function renderStepBlock(block) {
  const steps      = JSON.parse(block.dataset.steps || '[]');
  const numBg      = block.dataset.numBg      || '#222222';
  const numColor   = block.dataset.numColor   || '#ffffff';
  const numSize    = parseInt(block.dataset.numSize)    || 36;
  const titleSz    = parseInt(block.dataset.titleSize)  || 36;
  const descSz     = parseInt(block.dataset.descSize)   || 24;
  const gap        = parseInt(block.dataset.gap)        || 24;
  const connector  = block.dataset.connector !== 'false';
  const titleColor = block.dataset.titleColor || '#222222';
  const descColor  = block.dataset.descColor  || '#555555';
  const orient     = block.dataset.stepOrient || 'vertical';
  const style      = block.dataset.stepStyle  || 'default';
  const cardBg     = block.dataset.stepCardBg || '#f5f5f5';
  const align          = block.dataset.stepAlign       || 'left';
  const padX           = parseInt(block.dataset.stepPadX)  || 0;
  const badgeFmt       = block.dataset.badgeFormat     || 'number';
  const badgeGap       = parseInt(block.dataset.badgeGap)  || 16;
  const connectorStyle = block.dataset.connectorStyle   || 'line'; // 'line' | 'arrow'

  // 'step'/'point'는 텍스트가 길어 원형 유지 불가 → pill(직사각형) 박스로 렌더
  const badgeIsPill = badgeFmt === 'step' || badgeFmt === 'point';

  function badgeLabel(i) {
    const n = i + 1;
    const pad = String(n).padStart(2, '0');
    if (badgeFmt === 'padded') return pad;
    if (badgeFmt === 'alpha')  return String.fromCharCode(64 + n); // A, B, C...
    if (badgeFmt === 'step')   return `STEP ${pad}`;
    if (badgeFmt === 'point')  return `POINT ${pad}`;
    return String(n);
  }

  // 배지 인라인 스타일 생성 (원형 or pill)
  function badgeStyle(extra = '') {
    const base = `background:${numBg};color:${numColor};font-size:${Math.round(numSize*0.38)}px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;${extra}`;
    if (badgeIsPill) {
      return `${base}height:${numSize}px;padding:0 ${Math.round(numSize*0.4)}px;border-radius:${Math.round(numSize*0.3)}px;white-space:nowrap;`;
    }
    return `${base}width:${numSize}px;height:${numSize}px;border-radius:50%;`;
  }

  const pxStyle = padX > 0 ? `padding-left:${padX}px;padding-right:${padX}px;box-sizing:border-box;` : '';

  // 연결선 헬퍼 — 세로용 (배지 아래 → 다음 배지 위)
  function connectorV() {
    if (connectorStyle === 'arrow') {
      const sz = Math.max(14, Math.round(numSize * 0.45));
      return `<div style="flex:1;display:flex;align-items:center;justify-content:center;min-height:${Math.round(numSize*0.5)}px">
        <svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="${numBg}" style="opacity:0.5">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
        </svg></div>`;
    }
    if (connectorStyle === 'divider') {
      return `<div style="width:100%;height:1px;background:${numBg};opacity:0.2;margin:${Math.round(gap*0.3)}px 0"></div>`;
    }
    return `<div class="stb-line" style="background:${numBg};opacity:0.25"></div>`;
  }

  // 연결선 헬퍼 — 가로용 (side: 'left'|'right', hidden: 끝에서 숨김)
  function connectorH(hidden, side = 'left') {
    if (hidden) return `<div style="flex:1;visibility:hidden"></div>`;
    if (connectorStyle === 'arrow') {
      // 화살표는 오른쪽(right)에만 — 왼쪽은 빈 공간만
      if (side === 'left') return `<div style="flex:1"></div>`;
      const sz = Math.max(12, Math.round(numSize * 0.4));
      return `<div style="flex:1;display:flex;align-items:center;justify-content:center">
        <svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="${numBg}" style="opacity:0.5">
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
        </svg></div>`;
    }
    return `<div style="flex:1;height:2px;background:${numBg};opacity:0.25"></div>`;
  }

  // ── 카드형 ────────────────────────────────────────────────────────────────
  if (style === 'card') {
    if (orient === 'horizontal') {
      block.innerHTML = `<div style="display:flex;flex-direction:row;align-items:stretch;gap:${gap}px;width:100%;${pxStyle}">${
        steps.map((s, i) => `
          <div style="flex:1;min-width:0;background:${cardBg};border-radius:12px;padding:16px 20px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;">
            <div style="${badgeStyle()}">${badgeLabel(i)}</div>
            <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
            ${s.desc?`<div class="stb-desc" style="font-size:${descSz}px;color:${descColor}">${s.desc}</div>`:''}</div>`).join('')
      }</div>`;
    } else {
      // 배지 중심을 제목 첫 줄 중심에 맞추는 오프셋
      const cardTitleLineH = Math.round(titleSz * 1.4);
      const cardBadgeTop   = Math.max(0, Math.round((cardTitleLineH - numSize) / 2));
      block.innerHTML = `<div style="${pxStyle}">${steps.map((s, i) => `
        <div style="background:${cardBg};border-radius:12px;padding:16px 20px;box-sizing:border-box;display:flex;align-items:flex-start;gap:${Math.round(numSize*0.5)}px;${i>0?`margin-top:${gap}px`:''}">
          <div style="${badgeStyle()}margin-top:${cardBadgeTop}px;">${badgeLabel(i)}</div>
          <div style="flex:1;min-width:0;">
            <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
            ${s.desc?`<div class="stb-desc" style="font-size:${descSz}px;color:${descColor};margin-top:4px">${s.desc}</div>`:''}</div></div>`).join('')}</div>`;
    }
    return;
  }

  // 가로 화살표 연결선 — step 컬럼 사이에 독립 요소로 렌더 (중앙 정렬)
  const useHArrow = connector && connectorStyle === 'arrow';
  function hArrowEl(centerPx) {
    const sz = Math.max(12, Math.round(numSize * 0.4));
    return `<div style="display:flex;align-items:flex-start;padding-top:${Math.max(0, centerPx - Math.round(sz/2))}px;flex-shrink:0;">
      <svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="${numBg}" style="opacity:0.5">
        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
      </svg></div>`;
  }

  // ── 원형 (항상 가로) ──────────────────────────────────────────────────────
  if (style === 'circle') {
    const circleSize   = Math.max(80, Math.round(numSize * 2.8));
    const innerTitleSz = Math.min(titleSz, Math.round(circleSize * 0.18));
    block.innerHTML = `<div style="display:flex;flex-direction:row;align-items:flex-start;width:100%;${pxStyle}">${
      steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const lineL = connector && !useHArrow ? `<div style="flex:1;height:2px;${i===0?'visibility:hidden;':`background:${numBg};opacity:0.25;`}"></div>` : `<div style="flex:1;visibility:hidden"></div>`;
        const lineR = connector && !useHArrow ? `<div style="flex:1;height:2px;${isLast?'visibility:hidden;':`background:${numBg};opacity:0.25;`}"></div>` : `<div style="flex:1;visibility:hidden"></div>`;
        return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:0;">
            <div style="display:flex;align-items:center;width:100%;">
              ${lineL}
              <div style="width:${circleSize}px;height:${circleSize}px;border-radius:50%;background:${numBg};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;gap:2px;padding:8px;box-sizing:border-box;">
                <div style="color:${numColor};font-size:${Math.round(numSize*0.45)}px;font-weight:700;line-height:1;text-align:center">${badgeLabel(i)}</div>
                <div style="color:${numColor};font-size:${innerTitleSz}px;font-weight:600;line-height:1.3;text-align:center;word-break:keep-all;overflow:hidden;">${s.title||''}</div>
              </div>
              ${lineR}
            </div>
            ${s.desc?`<div class="stb-desc" style="font-size:${descSz}px;color:${descColor};margin-top:${badgeGap}px;text-align:center;padding:0 4px">${s.desc}</div>`:''}</div>
          ${useHArrow && !isLast ? hArrowEl(Math.round(circleSize/2)) : ''}`;
      }).join('')
    }</div>`;
    return;
  }

  // ── 번호형 (항상 가로) ────────────────────────────────────────────────────
  if (style === 'number') {
    const bigNum = Math.round(numSize * 1.8);
    block.innerHTML = `<div style="display:flex;flex-direction:row;align-items:flex-start;width:100%;gap:${gap}px;${pxStyle}">${
      steps.map((s, i) => `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:0;text-align:center;">
          <div style="font-size:${bigNum}px;font-weight:800;color:${numBg};line-height:1;margin-bottom:${Math.round(gap*0.4)}px">${badgeLabel(i)}</div>
          <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4;font-weight:600">${s.title||''}</div>
          ${s.desc?`<div class="stb-desc" style="font-size:${descSz}px;color:${descColor};margin-top:4px">${s.desc}</div>`:''}</div>`).join('')
    }</div>`;
    return;
  }

  // ── default: 가로 모드 ────────────────────────────────────────────────────
  if (orient === 'horizontal') {
    block.innerHTML = `<div style="display:flex;flex-direction:row;align-items:flex-start;width:100%;${pxStyle}">${
      steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const lineL = connector && !useHArrow ? connectorH(i === 0, 'left') : `<div style="flex:1;visibility:hidden"></div>`;
        const lineR = connector && !useHArrow ? connectorH(isLast, 'right') : `<div style="flex:1;visibility:hidden"></div>`;
        return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:0;">
            <div style="display:flex;align-items:center;width:100%;">
              ${lineL}
              <div style="${badgeStyle()}">${badgeLabel(i)}</div>
              ${lineR}
            </div>
            <div style="text-align:center;padding-top:${Math.round(gap*0.5)}px;padding-left:4px;padding-right:4px;width:100%;box-sizing:border-box;">
              <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
              ${s.desc?`<div class="stb-desc" style="font-size:${descSz}px;color:${descColor};margin-top:4px">${s.desc}</div>`:''}</div></div>
          ${useHArrow && !isLast ? hArrowEl(Math.round(numSize/2)) : ''}`;
      }).join('')
    }</div>`;
    return;
  }

  // ── default: 세로 모드 ────────────────────────────────────────────────────
  const titleLineH  = Math.round(titleSz * 1.4);
  const diff        = (titleLineH - numSize) / 2;
  const leftPadTop  = diff > 0 ? Math.round(diff) : 0;
  const contPadTop  = diff < 0 ? Math.round(-diff) : 0;

  const isCenterAlign = align === 'center';
  const isRightAlign  = align === 'right';

  if (isCenterAlign || isRightAlign) {
    const flexDir   = isCenterAlign ? 'column' : 'row-reverse';
    const textAlign = isCenterAlign ? 'center' : 'right';
    const isDividerCA = connector && connectorStyle === 'divider';
    block.innerHTML = `<div style="${pxStyle}">${steps.map((s, i) => {
      const isLast = i === steps.length - 1;
      return `
        <div class="stb-item" style="flex-direction:${flexDir};gap:${badgeGap}px;${isCenterAlign ? 'align-items:center;' : 'align-items:flex-start;'}">
          <div class="stb-left" style="padding-top:${isCenterAlign ? 0 : leftPadTop}px;align-items:center;">
            <div style="${badgeStyle()}">${badgeLabel(i)}</div>
            ${connector && !isLast && isCenterAlign && !isDividerCA ? connectorV() : ''}
          </div>
          <div class="stb-content" style="padding-top:${isCenterAlign ? 0 : contPadTop}px;padding-bottom:${isLast ? 0 : (isDividerCA ? 0 : gap)}px;text-align:${textAlign};">
            <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
            ${s.desc ? `<div class="stb-desc" style="font-size:${descSz}px;color:${descColor}">${s.desc}</div>` : ''}
          </div>
        </div>
        ${isDividerCA && !isLast ? `<div style="width:100%;height:1px;background:${numBg};opacity:0.2;margin:${Math.round(gap*0.5)}px 0"></div>` : ''}`;
    }).join('')}</div>`;
    return;
  }

  // left (기본)
  const isDivider = connector && connectorStyle === 'divider';
  block.innerHTML = `<div style="${pxStyle}">${steps.map((s, i) => {
    const isLast = i === steps.length - 1;
    return `
      <div class="stb-item" style="gap:${badgeGap}px">
        <div class="stb-left" style="padding-top:${leftPadTop}px">
          <div style="${badgeStyle()}">${badgeLabel(i)}</div>
          ${connector && !isLast && !isDivider ? connectorV() : ''}
        </div>
        <div class="stb-content" style="padding-top:${contPadTop}px;padding-bottom:${isLast ? 0 : (isDivider ? 0 : gap)}px">
          <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
          ${s.desc ? `<div class="stb-desc" style="font-size:${descSz}px;color:${descColor}">${s.desc}</div>` : ''}
        </div>
      </div>
      ${isDivider && !isLast ? `<div style="width:100%;height:1px;background:${numBg};opacity:0.2;margin:${Math.round(gap*0.5)}px 0"></div>` : ''}`;
  }).join('')}</div>`;
}

function makeStepBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'step-block';
  block.id = 'stb_' + Math.random().toString(36).slice(2, 8);
  block.dataset.type       = 'step';
  block.dataset.steps      = JSON.stringify(opts.steps      || STEP_DEFAULT_DATA);
  block.dataset.numBg      = opts.numBg      || '#222222';
  block.dataset.numColor   = opts.numColor   || '#ffffff';
  block.dataset.numSize    = opts.numSize    || 36;
  block.dataset.titleSize  = opts.titleSize  || 36;
  block.dataset.descSize   = opts.descSize   || 24;
  block.dataset.gap        = opts.gap        || 24;
  block.dataset.connector  = opts.connector  !== undefined ? String(opts.connector) : 'true';
  block.dataset.titleColor  = opts.titleColor  || '#222222';
  block.dataset.descColor   = opts.descColor   || '#555555';
  block.dataset.stepStyle      = opts.stepStyle      || 'default';
  block.dataset.stepOrient     = opts.stepOrient     || 'vertical';
  block.dataset.stepAlign      = opts.stepAlign      || 'left';
  block.dataset.stepCardBg     = opts.stepCardBg     || '#f5f5f5';
  block.dataset.stepPadX       = opts.stepPadX       || 0;
  block.dataset.badgeFormat    = opts.badgeFormat    || 'number';
  block.dataset.badgeGap       = opts.badgeGap       || 16;
  block.dataset.connectorStyle = opts.connectorStyle || 'line';
  renderStepBlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addStepBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory();
  const { row, block } = makeStepBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.triggerAutoSave?.();
}

window.makeStepBlock   = makeStepBlock;
window.addStepBlock    = addStepBlock;
window.renderStepBlock = renderStepBlock;

// ── Chat Block ─────────────────────────────────────────────────────────────────
const CHAT_DEFAULT_MESSAGES = [
  { text: '안녕하세요! 반갑습니다 😊', align: 'left' },
  { text: '네, 반갑습니다~', align: 'right' },
  { text: '무엇을 도와드릴까요?', align: 'left' },
];

const CHAT_TAIL_PATH = 'M18.3597 14.7395C9.25742 16.3944 2.32729 11.6364 0 9.05055L0.258587 1.29294C2.75826 1.81011 8.17136 2.27557 9.82631 0C9.56773 9.30914 16.5496 13.9637 18.3597 14.7395Z';

function renderChatBlock(block) {
  const messages    = JSON.parse(block.dataset.messages || '[]');
  const gap         = parseInt(block.dataset.gap)      || 8;
  const fontSize    = parseInt(block.dataset.fontSize) || 16;
  const bgLeft      = block.dataset.bgLeft   || '#e5e5ea';
  const bgRight     = block.dataset.bgRight  || '#1888fe';
  const colorLeft   = block.dataset.colorLeft  || '#111111';
  const colorRight  = block.dataset.colorRight || '#ffffff';
  const radius      = parseInt(block.dataset.radius)  || 16;
  const padding     = parseInt(block.dataset.padding) || 16;
  block.style.padding = `${padding}px`;

  block.innerHTML = messages.map(msg => {
    const isLeft = msg.align !== 'right';
    const bg     = isLeft ? bgLeft  : bgRight;
    const color  = isLeft ? colorLeft : colorRight;
    const dir    = isLeft ? 'left' : 'right';
    // left: scaleX(-1) 반전, right: 원본 (Figma 벡터가 우측 꼬리형)
    const tailTransform = isLeft ? 'transform="scale(-1,1) translate(-19,0)"' : '';
    const tail = `<svg class="chb-tail" viewBox="0 0 19 16" xmlns="http://www.w3.org/2000/svg" width="19" height="16" style="fill:${bg}"><path d="${CHAT_TAIL_PATH}" ${tailTransform}/></svg>`;

    return `<div class="chb-msg chb-${dir}" style="margin-bottom:${gap}px">
  <div class="chb-wrap">
    <div class="chb-bubble" style="background:${bg};color:${color};font-size:${fontSize}px;border-radius:${radius}px">${msg.text}</div>
    ${tail}
  </div>
</div>`;
  }).join('');
}

function makeChatBlock(opts = {}) {
  const block = document.createElement('div');
  block.className    = 'chat-block';
  block.id           = genId('chb');
  block.dataset.type = 'chat';
  block.dataset.messages  = JSON.stringify(opts.messages || CHAT_DEFAULT_MESSAGES);
  block.dataset.gap        = opts.gap       || 8;
  block.dataset.fontSize   = opts.fontSize  || 16;
  block.dataset.bgLeft     = opts.bgLeft    || '#e5e5ea';
  block.dataset.bgRight    = opts.bgRight   || '#1888fe';
  block.dataset.colorLeft  = opts.colorLeft  || '#111111';
  block.dataset.colorRight = opts.colorRight || '#ffffff';
  block.dataset.radius     = opts.radius    || 16;
  block.dataset.padding    = opts.padding   || 16;
  renderChatBlock(block);

  const row = document.createElement('div');
  row.className      = 'row';
  row.id             = genId('row');
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addChatBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory();
  const { row, block } = makeChatBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.triggerAutoSave?.();
}

window.makeChatBlock   = makeChatBlock;
window.addChatBlock    = addChatBlock;
window.renderChatBlock = renderChatBlock;

// ── Vector Block ───────────────────────────────────────────────────────────────
function renderVector(block) {
  const svgStr = block.dataset.svg   || '';
  const color  = block.dataset.color || '#000000';
  const w      = parseInt(block.dataset.w) || 120;
  const h      = parseInt(block.dataset.h) || 120;

  block.style.width  = w + 'px';
  block.style.height = h + 'px';

  const inner = block.querySelector('.vb-inner');
  if (!inner) return;

  // fill 색상 치환: fill="black", fill="#000000", fill="currentColor" 등 → 지정 색상
  let processed = svgStr
    .replace(/fill="black"/gi,        `fill="${color}"`)
    .replace(/fill="#000000"/gi,      `fill="${color}"`)
    .replace(/fill="#000"/gi,         `fill="${color}"`)
    .replace(/fill="currentColor"/gi, `fill="${color}"`);

  // SVG 자체에 width/height 100% 강제 적용
  processed = processed.replace(/<svg([^>]*)>/i, (match, attrs) => {
    let a = attrs
      .replace(/\s*width="[^"]*"/gi, '')
      .replace(/\s*height="[^"]*"/gi, '');
    return `<svg${a} width="100%" height="100%">`;
  });

  inner.innerHTML = processed;

}

function makeVectorBlock(data = {}) {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const block = document.createElement('div');
  block.className      = 'vector-block';
  block.dataset.type   = 'vector';
  block.id             = genId('vb');
  block.setAttribute('draggable', 'true');
  block.dataset.svg    = data.svg   || '';
  block.dataset.color  = data.color || '#000000';
  block.dataset.w      = String(data.w || 120);
  block.dataset.h      = String(data.h || 120);
  block.dataset.layerName = data.label || 'Vector';

  const inner = document.createElement('div');
  inner.className = 'vb-inner';
  block.appendChild(inner);

  renderVector(block);

  row.appendChild(block);
  return { row, block };
}

function addVectorBlock(svgString = '', opts = {}) {
  if (_insertToFlowFrame(() => {
    const { row, block } = makeVectorBlock({ svg: svgString, ...opts });
    return { row, block };
  })) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeVectorBlock({ svg: svgString, ...opts });
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

window.makeVectorBlock = makeVectorBlock;
window.addVectorBlock  = addVectorBlock;
window.renderVector    = renderVector;

/* ── 블록 컨텍스트 메뉴 ── */
(function initBlockContextMenu() {
  const menu = document.getElementById('block-context-menu');
  if (!menu) return;

  let _targetBlock = null;

  // 메뉴 닫기
  function closeMenu() {
    menu.style.display = 'none';
    _targetBlock = null;
  }

  // 메뉴 열기
  function openMenu(e, block) {
    e.preventDefault();
    e.stopPropagation();
    _targetBlock = block;

    // 폴더 목록 채우기
    const folderSel = document.getElementById('bcm-folder-select');
    if (folderSel) {
      const templates = window.loadTemplatesPublic?.() || [];
      const folders = [...new Set(templates.map(t => t.folder || '블록').filter(Boolean))];
      if (!folders.includes('블록')) folders.unshift('블록');
      folderSel.innerHTML = folders.map(f => `<option value="${f}">${f}</option>`).join('') + '<option value="__new__">새 폴더...</option>';
    }

    const x = Math.min(e.clientX, window.innerWidth  - menu.offsetWidth  - 8);
    const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left    = x + 'px';
    menu.style.top     = y + 'px';
    menu.style.display = 'block';
  }

  // 저장 버튼 → 인라인 이름 입력 표시
  const nameRow     = document.getElementById('bcm-name-row');
  const nameInput   = document.getElementById('bcm-name-input');
  const nameConfirm = document.getElementById('bcm-name-confirm');
  const folderSel   = document.getElementById('bcm-folder-select');
  const bcmFolderNew = document.getElementById('bcm-folder-new');
  const bcmTagsInput = document.getElementById('bcm-tags-input');

  folderSel?.addEventListener('change', e => {
    e.stopPropagation();
    if (bcmFolderNew) bcmFolderNew.style.display = folderSel.value === '__new__' ? 'block' : 'none';
  });

  document.getElementById('bcm-save-template')?.addEventListener('click', e => {
    e.stopPropagation();
    if (!_targetBlock) return closeMenu();
    if (nameRow) { nameRow.style.display = 'flex'; nameInput?.focus(); }
  });

  nameConfirm?.addEventListener('click', e => {
    e.stopPropagation();
    const name = nameInput?.value?.trim();
    const folder = folderSel?.value === '__new__'
      ? (bcmFolderNew?.value?.trim() || '블록')
      : (folderSel?.value || '블록');
    const tags = bcmTagsInput?.value?.trim() || '';
    if (name) window.saveBlockAsTemplate?.(_targetBlock, name, folder, tags);
    if (nameInput) nameInput.value = '';
    if (bcmFolderNew) { bcmFolderNew.value = ''; bcmFolderNew.style.display = 'none'; }
    if (bcmTagsInput) bcmTagsInput.value = '';
    if (nameRow) nameRow.style.display = 'none';
    closeMenu();
  });

  nameInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') nameConfirm?.click();
    if (e.key === 'Escape') closeMenu();
    e.stopPropagation();
  });

  nameInput?.addEventListener('click', e => e.stopPropagation());
  folderSel?.addEventListener('click', e => e.stopPropagation());
  bcmFolderNew?.addEventListener('click', e => e.stopPropagation());
  bcmTagsInput?.addEventListener('click', e => e.stopPropagation());

  // 외부 클릭 시 닫기 (click만 — contextmenu는 stopPropagation으로 차단되므로 제거)
  document.addEventListener('click', closeMenu);

  // window에 등록 (bindBlock에서 사용)
  window._openBlockContextMenu = openMenu;
})();

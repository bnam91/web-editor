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
  const classMap  = { h1:'tb-h1', h2:'tb-h2', h3:'tb-h3', body:'tb-body', caption:'tb-caption', label:'tb-label', bullet:'tb-bullet' };
  const dataType  = (type==='h1'||type==='h2'||type==='h3') ? 'heading' : type;
  const placeholder = { h1:'제목을 입력하세요', h2:'소제목을 입력하세요', h3:'소항목을 입력하세요', body:'본문 내용을 입력하세요.', caption:'캡션을 입력하세요', label:'Label', bullet:'항목을 입력하세요' };

  const tb = document.createElement('div');
  tb.className = 'text-block'; tb.dataset.type = dataType;
  tb.id = genId('tb');
  const phText = placeholder[type];

  if (type === 'bullet') {
    // bullet 변형: <ul class="tb-bullet"><li>...</li></ul>
    // ul 자체에 contenteditable 부여 → 엔터 시 브라우저 기본 동작으로 새 <li> 자동 생성
    tb.innerHTML = `
    <ul class="${classMap[type]}" contenteditable="false" style="font-family:'Pretendard', sans-serif" data-placeholder="${phText}" data-is-placeholder="true"><li>${phText}</li></ul>`;
  } else {
    tb.innerHTML = `
    <div class="${classMap[type]}" contenteditable="false" style="font-family:'Pretendard', sans-serif" data-placeholder="${phText}" data-is-placeholder="true">${phText}</div>`;
  }

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
  // 신규 옵션 7개 기본값 (기존 테이블 사이트 호환을 위해 dataset 부재 시 default 동작은 CSS/prop 로직에서 보장)
  tb.dataset.showVLines = 'true';
  tb.dataset.showHLines = 'true';
  tb.dataset.showOuterX = 'true';
  tb.dataset.showOuterY = 'true';
  tb.dataset.outerWidth = '1';
  tb.dataset.rowH = '0';
  tb.dataset.tablePadX = '0';
  tb.dataset.lineColor = '#cccccc';
  tb.dataset.headerBg  = '#f0f0f0';
  tb.dataset.textColor = '#222222';
  tb.dataset.fontFamily = '';
  tb.style.setProperty('--tbl-outer-w', '1px');
  tb.style.setProperty('--tbl-line-color', '#cccccc');
  tb.style.setProperty('--tbl-header-bg', '#f0f0f0');
  tb.style.setProperty('--tbl-text-color', '#222222');
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
  // banner-preset 외곽은 컴포넌트 단위 — 직접 자식 받지 않음. drill-in한 inner만 활성 대상.
  const activeSS = window._activeFrame;
  if (activeSS && !activeSS.dataset.bannerPreset) {
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
      // A 모드: fullWidth 플로우 — 선택된 자손이 있으면 그것을 품은 직계 자식 다음 sibling으로 삽입
      let refChild = null;
      const selList = activeSS.querySelectorAll('.selected');
      if (selList.length) {
        let cur = selList[selList.length - 1];
        while (cur && cur.parentElement !== activeSS) cur = cur.parentElement;
        if (cur && cur.parentElement === activeSS && cur !== tf) refChild = cur;
      }
      if (refChild) activeSS.insertBefore(tf, refChild.nextSibling);
      else activeSS.appendChild(tf);
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
  // (가) 설계: dataset.usePadx는 박지 않음 — 미설정 ab는 글로벌 디폴트 자동 추종.
  // 글로벌 ON일 때만 시각적 margin/width 즉시 적용 (다음 applyPadXToSection 호출에서 재확인됨).
  const applyExcludePadX = (block) => {
    if (!window.state?.pageSettings?.padXExcludesAsset) return;
    // freeLayout 프레임 내부 asset은 절대좌표 + 명시 width로 동작 — padX 확장 적용하지 않음
    if (block.closest('.frame-block[data-free-layout="true"]')) return;
    // preset 고정 width(small, logo 등)는 그 자체로 정해진 사이즈를 유지해야 함 — padX 확장 미적용
    if (ASSET_PRESETS[preset]?.width) return;
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
  // fullWidth 플로우 프레임에만 추가 — 자유배치(freeLayout) 프레임은 스킵 후 섹션 레벨로
  if (window._activeFrame?.dataset.freeLayout !== 'true' && _insertToFlowFrame(() => {
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

function addGhostSection() {
  const canvas = document.getElementById('canvas');
  // 이미 ghost가 있으면 중복 추가 방지
  if (canvas.querySelector('.section-block[data-ghost]')) return;
  const ghost = document.createElement('div');
  ghost.className = 'section-block';
  ghost.dataset.ghost = 'true';
  ghost.id = genId('sec');
  ghost.style.display = 'none';
  ghost.innerHTML = `<div class="section-inner"></div>`;
  canvas.appendChild(ghost);
}

function addSection(opts = {}) {
  const canvas  = document.getElementById('canvas');
  // ghost 섹션이 있으면 먼저 제거
  canvas.querySelector('.section-block[data-ghost]')?.remove();
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
        <button class="st-btn st-ai-fill-btn" onclick="openAIFillUI(this)" title="AI로 섹션 텍스트 채우기">✨</button>
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
        <button class="st-btn st-ai-fill-btn" onclick="openAIFillUI(this)" title="AI로 섹션 텍스트 채우기">✨</button>
      </div>
      <div class="section-inner">
        <div class="gap-block" data-type="gap" style="height:100px" id="${genId('gb')}"></div>
        <div class="frame-block" data-text-frame="true" id="${_tfId}">
          <div class="text-block" data-type="heading" id="${_tbId}">
            <div class="tb-h2" contenteditable="false" data-placeholder="소제목을 입력하세요" data-is-placeholder="true" style="font-family:'Pretendard', sans-serif">소제목을 입력하세요</div>
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
    // padXExcludesAsset 플래그가 켜져 있으면 신규 섹션의 asset-block에도 시각적으로 즉시 적용
    // (가) 설계: dataset.usePadx 박지 않음 — 글로벌 디폴트 추종.
    if (window.state?.pageSettings?.padXExcludesAsset) {
      const hasOverride = inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined;
      const px = hasOverride ? parseInt(inner.dataset.paddingX) : (window.state.pageSettings.padX || 0);
      if (px > 0) {
        inner.querySelectorAll('.asset-block').forEach(ab => {
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
  sec.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .shape-block, .vector-block, .step-block, .chat-block, .laurel-block').forEach(b => bindBlock(b));
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
    // 기본 흰색 — frame은 section과 시각 구분되어야 함 (Figma 등 기본 패턴)
    const bg = opts.bg || '#ffffff';
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
    const bg = opts.bg || '#ffffff';
    ss.dataset.bg = bg;
    ss.dataset.freeLayout = 'true';
    ss.dataset.width = '860';
    ss.dataset.height = '520';
    ss.dataset.padY = '0';
    let css = `background:${bg};padding:0;width:860px;max-width:100%;margin:0 auto;min-height:520px;height:520px;`;
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

  /* banner-preset 외곽은 컴포넌트 단위로 취급 — 직접 자식 추가 받지 않음.
     사용자가 inner를 drill-in하면 inner가 _activeFrame이 되어 그쪽으로 추가됨. */
  if (ss.dataset.bannerPreset) return false;

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
  if (!result) { window.buildLayerPanel(); return true; }
  // makeBlockFn이 { row, block } 또는 block(gap) 반환
  const newEl = result.row || result;
  const innerBlock = result.block || result;

  // 활성 프레임 안에서 선택된 자손이 있으면 그것을 품은 직계 자식 다음 sibling으로 삽입.
  // 선택된 자손이 없거나 활성 프레임 자체만 선택된 경우 끝에 append.
  let refChild = null;
  const selList = ss.querySelectorAll('.selected');
  if (selList.length) {
    let cur = selList[selList.length - 1];
    while (cur && cur.parentElement !== ss) cur = cur.parentElement;
    if (cur && cur.parentElement === ss && cur !== newEl) refChild = cur;
  }
  if (refChild) ss.insertBefore(newEl, refChild.nextSibling);
  else ss.appendChild(newEl);
  bindBlock(innerBlock);
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
// rectangle/ellipse inner geometry는 stroke 두께에 맞춰 동적 계산 (stroke=0이면 풀폭, stroke>0이면 절반만 inset)
// line/arrow/polygon/star는 stroke가 도형의 일부라 inset 의미가 다름 — 그대로 유지
const SHAPE_DEFS = {
  rectangle: { vb: '0 0 100 100', h: 160, fill: true,  dynamic: true },
  ellipse:   { vb: '0 0 100 100', h: 160, fill: true,  dynamic: true },
  line:      { vb: '0 0 200 40',  h: 60,  fill: false, inner: `<line x1="10" y1="20" x2="190" y2="20" stroke-linecap="round"/>` },
  arrow:     { vb: '0 0 200 40',  h: 60,  fill: false, inner: `<line x1="10" y1="20" x2="172" y2="20" stroke-linecap="round"/><polygon points="170,10 194,20 170,30" fill="currentColor" stroke="none"/>` },
  polygon:   { vb: '0 0 200 180', h: 200, fill: true,  inner: `<polygon points="100,8 194,172 6,172"/>` },
  star:      { vb: '0 0 200 190', h: 200, fill: true,  inner: `<polygon points="100,8 122,70 188,70 135,110 155,172 100,132 45,172 65,110 12,70 78,70"/>` },
};

// stroke 두께에 맞춘 rectangle/ellipse inner SVG 생성
// strokeWidth는 user-space(viewBox) 단위로 해석됨. 절반만 inset해서 stroke 잘림 방지.
function _shapeInnerSVG(type, strokeWidth) {
  const sw = Math.max(0, Number(strokeWidth) || 0);
  // stroke=0일 때 미세한 inset도 없음 (풀폭 100%)
  const half = sw / 2;
  if (type === 'rectangle') {
    const w = Math.max(0, 100 - sw);
    const h = Math.max(0, 100 - sw);
    return `<rect x="${half}" y="${half}" width="${w}" height="${h}" rx="0"/>`;
  }
  if (type === 'ellipse') {
    const r = Math.max(0, 50 - half);
    return `<ellipse cx="50" cy="50" rx="${r}" ry="${r}"/>`;
  }
  // 다른 타입은 SHAPE_DEFS의 정적 inner 사용
  return SHAPE_DEFS[type]?.inner || '';
}
window._shapeInnerSVG = _shapeInnerSVG;

// 블록의 inner SVG geometry를 현재 strokeWidth에 맞춰 다시 그림 (rectangle/ellipse만 동적)
function refreshShapeInnerSVG(block) {
  if (!block) return;
  const type = block.dataset.shapeType || 'rectangle';
  const def = SHAPE_DEFS[type];
  if (!def || !def.dynamic) return;
  const sw = Number(block.dataset.shapeStrokeWidth ?? 0) || 0;
  const svg = block.querySelector('svg.shape-svg');
  if (!svg) return;
  // gradient 보존: 기존 defs 캐시 + 적용된 fill url 확인
  const defs = svg.querySelector(':scope > defs');
  const defsHTML = defs ? defs.outerHTML : '';
  // shape에 gradient가 적용 중이면 inner에 fill="url(#..)" 다시 부여
  const gradMeta = block.dataset.shapeGradient;
  svg.innerHTML = defsHTML + _shapeInnerSVG(type, sw);
  if (gradMeta) {
    const id = `grad-${block.id || 'shp_anon'}`;
    svg.querySelectorAll('rect,ellipse,circle,polygon,path').forEach(el => {
      if (el.getAttribute('fill') === 'none') return;
      el.setAttribute('fill', `url(#${id})`);
    });
  }
}
window.refreshShapeInnerSVG = refreshShapeInnerSVG;

function makeShapeBlock(type = 'rectangle') {
  const def = SHAPE_DEFS[type] || SHAPE_DEFS.rectangle;
  const block = document.createElement('div');
  block.className = 'shape-block';
  block.dataset.type = 'shape';
  block.dataset.shapeType = type;
  block.dataset.shapeColor = '#cccccc';
  block.dataset.shapeStrokeWidth = '3';
  block.id = genId('shp');
  const innerSVG = def.dynamic ? _shapeInnerSVG(type, 3) : def.inner;
  block.innerHTML = `<svg class="shape-svg" viewBox="${def.vb}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"
    style="color:#cccccc;stroke-width:3;fill:${def.fill ? 'currentColor' : 'none'};stroke:currentColor;">
    ${innerSVG}
  </svg>`;
  return { block };
}

// ── Annotation Block (펜툴 Phase 2: 폴리라인 + 스타일 props) ───────────
// section 좌상단 기준 절대좌표 points[] (마지막 점이 라벨 위치)
const ANNOT_DEFAULTS = {
  strokeColor:     '#1a1a1a',    // 디폴트: 검정 (프리셋에서 빨강/파랑 등 선택 가능)
  strokeWidth:     1.5,
  anchorShape:     'circle',     // 'circle' | 'square' | 'triangle' | 'arrowhead' | 'glow' | 'none'
  anchorSize:      7,            // 시작점 도형 크기 (지름 또는 한 변)
  labelFontSize:   20,
  labelColor:      '#1a1a1a',
  labelBg:         '#ffffff',
  labelBorderColor:'#1a1a1a',
  text:            '텍스트',
  labelMode:       'text',       // 'text' | 'image'
  labelImageSrc:   '',           // image 모드일 때 dataURL 또는 URL
  labelImageSize:  120,          // image 모드 정사각 가로px (= 세로)
  labelImageRadius: 0,           // image 모드 border-radius (0~50, %)
  labelBorderStyle: 'solid',     // 'solid' | 'dashed' | 'dotted'
  labelBorderWidth: 1,           // border 두께 (px)
};
window.ANNOT_DEFAULTS = ANNOT_DEFAULTS;

// shape별 SVG anchor 노드 문자열
// angleDeg: 첫 segment 방향(도). triangle / arrowhead 회전에 사용. 그 외 shape는 무관.
function _renderAnchorSVG(shape, size, x, y, color, angleDeg = 0) {
  const s = Math.max(2, Number(size) || 7);
  const half = s / 2;
  if (shape === 'none') return '';
  if (shape === 'square') {
    return `<rect class="annot-anchor" x="${x - half}" y="${y - half}" width="${s}" height="${s}" fill="${color}"/>`;
  }
  if (shape === 'triangle') {
    // anchor 기준 오른쪽으로 향하는 정삼각형 — 회전은 angleDeg+180 (꼭지점이 anchor 위치를 가리키도록)
    const h = s * Math.sqrt(3) / 2;
    const tx1 = x + h * (2/3),       ty1 = y;            // 꼭지점 (끝)
    const tx2 = x - h * (1/3),       ty2 = y - half;     // 좌상
    const tx3 = x - h * (1/3),       ty3 = y + half;     // 좌하
    const adj = angleDeg + 180;
    return `<polygon class="annot-anchor" points="${tx1},${ty1} ${tx2},${ty2} ${tx3},${ty3}" fill="${color}" transform="rotate(${adj} ${x} ${y})"/>`;
  }
  if (shape === 'arrowhead') {
    // V자 stroke (선 두 개) — anchor에서 양쪽 뒤로 벌어짐. 회전 +180 (V 끝이 anchor 자체 위치를 가리키게)
    const len = s * 1.2;            // V 길이
    const spread = s * 0.85;        // V 폭
    const lx = x - len, lyTop = y - spread, lyBot = y + spread;
    const sw = Math.max(1.2, s * 0.22);
    const adj = angleDeg + 180;
    return `<g class="annot-anchor" transform="rotate(${adj} ${x} ${y})">`
         + `<line x1="${lx}" y1="${lyTop}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`
         + `<line x1="${lx}" y1="${lyBot}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`
         + `</g>`;
  }
  if (shape === 'glow') {
    // 그라데이션 서클 — 중심 진하고 가장자리로 갈수록 옅어짐 (radial gradient).
    // defs/circle 둘 다 같이 제거되도록 <g class="annot-anchor">로 묶음.
    const gradId = 'annot-glow-' + Math.random().toString(36).slice(2, 9);
    const r = s; // 글로우 반경 = size (시각상 일반 circle보다 부드럽게 더 큼)
    return `<g class="annot-anchor">`
         + `<defs><radialGradient id="${gradId}">`
         + `<stop offset="0%" stop-color="${color}" stop-opacity="0.95"/>`
         + `<stop offset="55%" stop-color="${color}" stop-opacity="0.45"/>`
         + `<stop offset="100%" stop-color="${color}" stop-opacity="0"/>`
         + `</radialGradient></defs>`
         + `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${gradId})"/>`
         + `</g>`;
  }
  // default circle
  return `<circle class="annot-anchor" cx="${x}" cy="${y}" r="${half}" fill="${color}"/>`;
}
window._renderAnnotAnchorSVG = _renderAnchorSVG;

// 라벨 부착 모서리 = 마지막 segment 방향으로 결정 (좌/우/상/하 중앙 4방향)
// 중복점(같은 좌표) skip — 펜툴 더블클릭 종료 시 마지막 점이 중복으로 push되는 케이스 방어
function _calcLabelTransform(points) {
  if (!Array.isArray(points) || points.length < 2) return 'translate(0,-50%)';
  const last = points[points.length - 1];
  let prev = null;
  for (let i = points.length - 2; i >= 0; i--) {
    const p = points[i];
    if (p[0] !== last[0] || p[1] !== last[1]) { prev = p; break; }
  }
  if (!prev) return 'translate(0,-50%)';
  const dx = last[0] - prev[0];
  const dy = last[1] - prev[1];
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'translate(0,-50%)' : 'translate(-100%,-50%)';
  }
  return dy >= 0 ? 'translate(-50%,0)' : 'translate(-50%,-100%)';
}
window._calcAnnotLabelTransform = _calcLabelTransform;

// 첫 segment(anchor → 두 번째 점) 방향(deg). triangle/arrowhead 회전에 사용.
// 중복점 skip.
function _calcAnchorAngle(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  const first = points[0];
  let next = null;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p[0] !== first[0] || p[1] !== first[1]) { next = p; break; }
  }
  if (!next) return 0;
  return Math.atan2(next[1] - first[1], next[0] - first[0]) * 180 / Math.PI;
}
window._calcAnnotAnchorAngle = _calcAnchorAngle;

function makeAnnotationBlock(opts = {}) {
  // backward compat: ax/ay/lx/ly 입력 지원
  let points = opts.points;
  if (!Array.isArray(points) || points.length < 2) {
    const ax = Number(opts.ax) || 0;
    const ay = Number(opts.ay) || 0;
    const lx = Number(opts.lx) || 0;
    const ly = Number(opts.ly) || 0;
    points = [[ax, ay], [lx, ly]];
  } else {
    points = points.map(p => [Number(p[0]) || 0, Number(p[1]) || 0]);
  }
  const last = points[points.length - 1];
  const first = points[0];

  const strokeColor      = opts.strokeColor      ?? ANNOT_DEFAULTS.strokeColor;
  const strokeWidth      = opts.strokeWidth      ?? ANNOT_DEFAULTS.strokeWidth;
  const anchorShape      = opts.anchorShape      ?? ANNOT_DEFAULTS.anchorShape;
  const anchorSize       = opts.anchorSize       ?? ANNOT_DEFAULTS.anchorSize;
  const labelFontSize    = opts.labelFontSize    ?? ANNOT_DEFAULTS.labelFontSize;
  const labelColor       = opts.labelColor       ?? ANNOT_DEFAULTS.labelColor;
  const labelBg          = opts.labelBg          ?? ANNOT_DEFAULTS.labelBg;
  const labelBorderColor = opts.labelBorderColor ?? ANNOT_DEFAULTS.labelBorderColor;
  const text             = opts.text             ?? ANNOT_DEFAULTS.text;
  const labelMode        = opts.labelMode        ?? ANNOT_DEFAULTS.labelMode;
  const labelImageSrc    = opts.labelImageSrc    ?? ANNOT_DEFAULTS.labelImageSrc;
  const labelImageSize   = opts.labelImageSize   ?? ANNOT_DEFAULTS.labelImageSize;
  const labelImageRadius = opts.labelImageRadius ?? ANNOT_DEFAULTS.labelImageRadius;
  const labelBorderStyle = opts.labelBorderStyle ?? ANNOT_DEFAULTS.labelBorderStyle;
  const labelBorderWidth = opts.labelBorderWidth ?? ANNOT_DEFAULTS.labelBorderWidth;

  const block = document.createElement('div');
  block.className = 'annotation-block';
  block.dataset.type = 'annotation';
  block.id = genId('ant');

  // dataset 저장
  block.dataset.points           = JSON.stringify(points);
  block.dataset.anchorX          = String(first[0]); // backward compat
  block.dataset.anchorY          = String(first[1]);
  block.dataset.labelX           = String(last[0]);
  block.dataset.labelY           = String(last[1]);
  block.dataset.text             = text;
  block.dataset.strokeColor      = strokeColor;
  block.dataset.strokeWidth      = String(strokeWidth);
  block.dataset.anchorShape      = anchorShape;
  block.dataset.anchorSize       = String(anchorSize);
  block.dataset.labelFontSize    = String(labelFontSize);
  block.dataset.labelColor       = labelColor;
  block.dataset.labelBg          = labelBg;
  block.dataset.labelBorderColor = labelBorderColor;
  block.dataset.labelMode        = labelMode;
  block.dataset.labelBorderStyle = labelBorderStyle;
  block.dataset.labelBorderWidth = String(labelBorderWidth);
  if (labelMode === 'image') {
    block.dataset.labelImageSrc    = labelImageSrc;
    block.dataset.labelImageSize   = String(labelImageSize);
    block.dataset.labelImageRadius = String(labelImageRadius);
  }

  const ptsAttr = points.map(p => `${p[0]},${p[1]}`).join(' ');
  const anchorAngle = _calcAnchorAngle(points);
  const anchorSvg = _renderAnchorSVG(anchorShape, anchorSize, first[0], first[1], strokeColor, anchorAngle);
  // 이미지 원형(라운드 50% 또는 충분히 큰 라운드) 모드면 라벨 중앙에 부착 — 원에 모서리 없으니 중앙이 자연스러움
  const isImgCircleish = labelMode === 'image' && (parseFloat(labelImageRadius) || 0) >= 25;
  const labelTf = isImgCircleish ? 'translate(-50%,-50%)' : _calcLabelTransform(points);
  // 이미지 모드 + radius > 0이면 라벨박스 padding 0 + border-radius 동기화 → 이미지+테두리가 같은 모양
  const imgWrapping = labelMode === 'image' && (parseFloat(labelImageRadius) || 0) > 0;
  let labelStyle = `left:${last[0]}px;top:${last[1]}px;`
    + `transform:${labelTf};`
    + `font-size:${labelFontSize}px;`
    + `color:${labelColor};`
    + `background:${labelBg};`
    + `border-color:${labelBorderColor};`
    + `border-style:${labelBorderStyle};`
    + `border-width:${labelBorderWidth}px;`;
  if (imgWrapping) {
    const r = Math.max(0, Math.min(50, parseFloat(labelImageRadius) || 0));
    labelStyle += `padding:0;border-radius:${r}%;overflow:hidden;`;
  }
  const labelInner = _renderAnnotLabelInner(labelMode, { text, labelImageSrc, labelImageSize, labelImageRadius });
  const labelExtraClass = labelMode === 'image' ? ' annot-label-image' : '';
  block.innerHTML = `
    <svg class="annot-svg" xmlns="http://www.w3.org/2000/svg">
      <polyline class="annot-line" points="${ptsAttr}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>
      ${anchorSvg}
    </svg>
    <div class="annot-label${labelExtraClass}" contenteditable="false" style="${labelStyle}">${labelInner}</div>`;
  return block;
}

// 라벨박스 내부 컨텐츠 — text 모드 = 텍스트, image 모드 = <img> 또는 체크패턴 placeholder
function _renderAnnotLabelInner(mode, { text, labelImageSrc, labelImageSize, labelImageRadius }) {
  if (mode === 'image') {
    const size  = parseInt(labelImageSize)   || ANNOT_DEFAULTS.labelImageSize;
    const rPct  = Math.max(0, Math.min(50, parseFloat(labelImageRadius) || 0));
    const rCss  = rPct + '%';
    if (!labelImageSrc) {
      // 다른 asset/icon-circle 블록과 동일한 체커보드 placeholder
      return `<div class="annot-label-img-placeholder" style="width:${size}px;height:${size}px;border-radius:${rCss};background:repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 16px 16px;display:flex;align-items:center;justify-content:center;color:#888;font-size:11px;"></div>`;
    }
    return `<img class="annot-label-img" src="${labelImageSrc}" style="width:${size}px;height:${size}px;border-radius:${rCss};display:block;object-fit:cover;" draggable="false">`;
  }
  return text;
}
window._renderAnnotLabelInner = _renderAnnotLabelInner;

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
window.addGhostSection      = addGhostSection;
window.makeFrameBlock        = makeFrameBlock;
window.addFrameBlock         = addFrameBlock;
window.wrapSelectedBlocksInFrame  = wrapSelectedBlocksInFrame;
window.activateFrame         = activateFrame;
window.deactivateFrame = deactivateFrame;
window.makeJokerBlock       = makeJokerBlock;
window.addJokerBlock        = addJokerBlock;
window.makeShapeBlock       = makeShapeBlock;
window.addShapeBlock        = addShapeBlock;
window.makeAnnotationBlock  = makeAnnotationBlock;
window.makeSpeechBubbleBlock = makeSpeechBubbleBlock;
window.addSpeechBubbleBlock  = addSpeechBubbleBlock;

// ── Canvas Block ─────────────────────────────────────────────────────────────
// Figma에서 임포트한 레이어 합성 블록 (shape + image + text 절대배치 단일 컴포넌트)

function _appendCardTexts(container, card, titleSize, descSize, textAlign, titleColor, descColor) {
  const _tc = titleColor || '#ffffff';
  const _dc = descColor  || '#ffffff';
  if (card.title && card.title.trim() !== '') {
    const el = document.createElement('div');
    el.style.cssText = `font-size:${titleSize}px;font-weight:600;color:${_tc};text-align:${textAlign};white-space:pre-wrap;word-break:break-word;line-height:1.3;font-family:Pretendard,-apple-system,sans-serif;`;
    el.textContent = card.title;
    container.appendChild(el);
  }
  if (card.desc && card.desc.trim() !== '') {
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

function _bindCvbImgDrag(imgDiv, block, idx) {
  if (!imgDiv.style.position) imgDiv.style.position = 'relative';
  imgDiv.style.pointerEvents = 'auto';
  imgDiv.style.cursor = 'default';

  // 블록 선택된 상태에서 단일 클릭 → 편집 모드 진입 (블록 선택 안된 경우 버블 허용)
  imgDiv.addEventListener('click', function(e) {
    if (!block.classList.contains('selected')) return;
    e.stopPropagation();
    _enterCvbImgEditMode(imgDiv, block, idx);
  });

  // 더블클릭 → 편집 모드 진입 (블록 선택 여부 무관)
  imgDiv.addEventListener('dblclick', function(e) {
    e.stopPropagation();
    e.preventDefault();
    _enterCvbImgEditMode(imgDiv, block, idx);
  });
}

function _enterCvbImgEditMode(imgDiv, block, idx) {
  if (imgDiv._cvbEditing) return;
  imgDiv._cvbEditing = true;

  imgDiv.style.cursor = 'grab';
  imgDiv.style.outline = '2px solid var(--color-handle, #1592fe)';
  imgDiv.style.outlineOffset = '-2px';

  const hint = document.createElement('div');
  hint.style.cssText = 'position:absolute;bottom:6px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.65);color:#fff;font-size:10px;padding:3px 10px;border-radius:4px;pointer-events:none;white-space:nowrap;z-index:10;';
  hint.textContent = '드래그로 이미지 이동 · ESC 종료';
  imgDiv.appendChild(hint);

  const exitMode = () => {
    if (!imgDiv._cvbEditing) return;
    imgDiv._cvbEditing = false;
    imgDiv.style.cursor = 'default';
    imgDiv.style.outline = '';
    hint.remove();
    document.removeEventListener('keydown', onKey);
    imgDiv.removeEventListener('mousedown', onDragStart);
  };

  const onKey = (e) => { if (e.key === 'Escape') exitMode(); };
  document.addEventListener('keydown', onKey);

  const onDragStart = (e) => {
    e.stopPropagation();
    e.preventDefault();

    const cards = JSON.parse(block.dataset.cards || '[]');
    const c = cards[idx] || {};
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startImgX = c.imgX ?? 50;
    const startImgY = c.imgY ?? 50;
    let curX = startImgX;
    let curY = startImgY;

    imgDiv.style.cursor = 'grabbing';

    const onMove = (me) => {
      const scale = block._cvbScale || 1;
      curX = Math.max(0, Math.min(100, startImgX - (me.clientX - startMouseX) / scale * 0.1));
      curY = Math.max(0, Math.min(100, startImgY - (me.clientY - startMouseY) / scale * 0.1));
      imgDiv.style.backgroundPosition = `${curX}% ${curY}%`;
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      imgDiv.style.cursor = 'grab';
      const arr = JSON.parse(block.dataset.cards || '[]');
      if (arr[idx]) {
        arr[idx].imgX = Math.round(curX * 10) / 10;
        arr[idx].imgY = Math.round(curY * 10) / 10;
        block.dataset.cards = JSON.stringify(arr);
        window.pushHistory?.();
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  imgDiv.addEventListener('mousedown', onDragStart);
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
    const imgRatio   = Math.min(90, Math.max(10, parseInt(block.dataset.imgRatio) ?? 76));
    const imgShape   = block.dataset.imgShape || 'rect'; // 'rect' | 'circle'
    const labelPos   = block.dataset.labelPos || 'bottom'; // 'top' | 'bottom' | 'both'
    const textHide   = block.dataset.textHide === 'true';
    const textBg     = block.dataset.textBg    || '#f5f5f5';
    const titleSize  = parseInt(block.dataset.titleSize) || 20;
    const descSize   = parseInt(block.dataset.descSize)  || 14;
    const textAlign  = block.dataset.textAlign || 'left';
    const titleColor = block.dataset.titleColor || '#ffffff';
    const descColor  = block.dataset.descColor  || '#ffffff';
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
      block._cvbScale = scale;
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
        // desc 비었으면 title 세로 중앙 정렬 (공백만 있어도 비었다고 판단)
        const descEmpty = !card.desc || card.desc.trim() === '';
        const justifyMode = descEmpty ? 'center' : 'flex-start';

        const cell = document.createElement('div');
        const borderW = card.borderWidth > 0 ? parseInt(card.borderWidth) : 0;
        cell.style.cssText = `position:absolute;left:${cellX}px;top:${cellY}px;width:${designW}px;height:${designH}px;border-radius:${radius}px;overflow:hidden;`;

        if (orient === 'landscape') {
          // ── 가로 모드: 이미지 좌 / 텍스트 우 ────────────────────────────
          const imgW  = textHide ? designW : Math.round(designW * imgRatio / 100);
          const textW = designW - imgW;

          const imgDiv = document.createElement('div');
          imgDiv.style.cssText = `position:absolute;left:0;top:0;width:${imgW}px;height:${designH}px;overflow:hidden;flex-shrink:0;`;
          if (card.imgSrc) {
            imgDiv.style.backgroundImage    = `url("${card.imgSrc}")`;
            imgDiv.style.backgroundSize     = card.imgFit === 'contain' ? 'contain' : 'cover';
            imgDiv.style.backgroundPosition = `${card.imgX ?? 50}% ${card.imgY ?? 50}%`;
            imgDiv.style.backgroundRepeat   = 'no-repeat';
            _bindCvbImgDrag(imgDiv, block, idx);
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
            textDiv.style.cssText = `position:absolute;left:${imgW}px;top:0;width:${textW}px;height:${designH}px;background:${cardBg};box-sizing:border-box;padding:14px 16px;display:flex;flex-direction:column;justify-content:${justifyMode};gap:6px;`;
            _appendCardTexts(textDiv, card, titleSize, descSize, textAlign, titleColor, descColor);
            cell.appendChild(textDiv);
          }

        } else {
          // ── 세로 모드(기본): 이미지 상 / 텍스트 하 ──────────────────────
          // labelPos: 'top' | 'bottom'(default) | 'both' — both는 같은 텍스트를 위·아래 동일 표시
          const imgH  = textHide ? designH : Math.round(designH * imgRatio / 100);
          const textTotalH = designH - imgH;
          const textH = labelPos === 'both' ? Math.floor(textTotalH / 2) : textTotalH;

          const makeImgDiv = () => {
            const div = document.createElement('div');
            if (imgShape === 'circle') {
              const side = Math.min(designW, imgH);
              const topMargin = Math.max(0, Math.round((imgH - side) / 2));
              div.style.cssText = `width:${side}px;height:${side}px;margin:${topMargin}px auto 0;overflow:hidden;border-radius:50%;flex-shrink:0;`;
            } else {
              div.style.cssText = `width:100%;height:${imgH}px;overflow:hidden;box-sizing:border-box;flex-shrink:0;`;
            }
            if (card.imgSrc) {
              div.style.backgroundImage    = `url("${card.imgSrc}")`;
              div.style.backgroundSize     = card.imgFit === 'contain' ? 'contain' : 'cover';
              div.style.backgroundPosition = `${card.imgX ?? 50}% ${card.imgY ?? 50}%`;
              div.style.backgroundRepeat   = 'no-repeat';
              _bindCvbImgDrag(div, block, idx);
            } else {
              div.style.background = 'rgba(0,0,0,0.06)';
              div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.justifyContent = 'center';
              const ph = document.createElement('span');
              ph.style.cssText = 'color:rgba(0,0,0,0.2);font-size:28px;font-family:sans-serif;pointer-events:none;font-weight:200;';
              ph.textContent = '+'; div.appendChild(ph);
            }
            return div;
          };
          const makeTextDiv = (h, position) => {
            // position: 'top' | 'bottom' | 'middle' — 모서리 radius 적용 결정
            const div = document.createElement('div');
            const rTop    = (position === 'top'    || position === 'middle') ? `${radius}px ${radius}px 0 0` : '0';
            const rBottom = (position === 'bottom' || position === 'middle') ? `0 0 ${radius}px ${radius}px` : '0';
            const br = position === 'top'    ? `${radius}px ${radius}px 0 0`
                     : position === 'bottom' ? `0 0 ${radius}px ${radius}px`
                     : '0';
            div.style.cssText = `width:100%;height:${h}px;background:${cardBg};box-sizing:border-box;padding:10px 14px;display:flex;flex-direction:column;justify-content:${justifyMode};gap:4px;border-radius:${br};`;
            _appendCardTexts(div, card, titleSize, descSize, textAlign, titleColor, descColor);
            return div;
          };

          if (labelPos === 'top') {
            if (!textHide) cell.appendChild(makeTextDiv(textH, 'top'));
            cell.appendChild(makeImgDiv());
          } else if (labelPos === 'both') {
            if (!textHide) cell.appendChild(makeTextDiv(textH, 'top'));
            cell.appendChild(makeImgDiv());
            if (!textHide) cell.appendChild(makeTextDiv(textH, 'bottom'));
          } else {
            // bottom (기본)
            cell.appendChild(makeImgDiv());
            if (!textHide) cell.appendChild(makeTextDiv(textH, 'bottom'));
          }
        }

        // 테두리 오버레이: 자식 위에 inset box-shadow 표시 (자식들이 cell 전체를 덮으므로 overlay 필요)
        if (borderW > 0 && card.borderColor) {
          const borderOverlay = document.createElement('div');
          borderOverlay.style.cssText = `position:absolute;inset:0;box-shadow:inset 0 0 0 ${borderW}px ${card.borderColor};border-radius:${radius}px;pointer-events:none;z-index:10;`;
          cell.appendChild(borderOverlay);
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
    block.dataset.imgRatio  = data.imgRatio  ?? 76;
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
  width: 360, height: 480,
  bg: 'transparent', radius: 12,
  cardMode: 'simple',
  imgRatio: 76,
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
  const padL = parseInt(block.dataset.stepPadL ?? block.dataset.stepPadX) || 0;
  const padR = parseInt(block.dataset.stepPadR ?? block.dataset.stepPadX) || 0;
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

  const pxStyle = (padL > 0 || padR > 0) ? `padding-left:${padL}px;padding-right:${padR}px;box-sizing:border-box;` : '';

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
    } else if (align === 'center') {
      // card/center = full-width 카드 (left/right와 동일 너비) + 내부 콘텐츠 중앙 정렬
      const _titleLineH = Math.round(titleSz * 1.4);
      const _diff       = (_titleLineH - numSize) / 2;
      const _leftPadTop = _diff > 0 ? Math.round(_diff) : 0;
      const _contPadTop = _diff < 0 ? Math.round(-_diff) : 0;
      block.innerHTML = `<div style="${pxStyle}">${steps.map((s, i) => {
        return `
          <div style="background:${cardBg};border-radius:12px;padding:16px 20px;box-sizing:border-box;${i>0?`margin-top:${gap}px`:''}">
            <div style="width:fit-content;margin:0 auto;display:flex;align-items:flex-start;gap:${badgeGap}px">
              <div style="${badgeStyle()}margin-top:${_leftPadTop}px;">${badgeLabel(i)}</div>
              <div style="margin-top:${_contPadTop}px">
                <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
                ${s.desc ? `<div class="stb-desc" style="font-size:${descSz}px;color:${descColor}">${s.desc}</div>` : ''}
              </div>
            </div>
          </div>`;
      }).join('')}</div>`;
    } else {
      // card left / right / stack
      const cardTitleLineH = Math.round(titleSz * 1.4);
      const cardBadgeTop   = Math.max(0, Math.round((cardTitleLineH - numSize) / 2));
      const isCardRight  = align === 'right';
      const isCardStack  = align === 'stack';
      const itemFlex = isCardStack
        ? `flex-direction:column;align-items:center;gap:${badgeGap}px`
        : isCardRight
        ? `flex-direction:row-reverse;align-items:flex-start;gap:${badgeGap}px`
        : `align-items:flex-start;gap:${badgeGap}px`;
      const contentAlign = isCardStack ? 'center' : isCardRight ? 'right' : 'left';
      const badgeTop     = isCardStack ? 0 : cardBadgeTop;
      block.innerHTML = `<div style="${pxStyle}">${steps.map((s, i) => `
        <div style="background:${cardBg};border-radius:12px;padding:16px 20px;box-sizing:border-box;display:flex;${itemFlex};${i>0?`margin-top:${gap}px`:''}">
          <div style="${badgeStyle()}margin-top:${badgeTop}px;">${badgeLabel(i)}</div>
          <div style="${isCardStack?'':`flex:1;min-width:0;`}text-align:${contentAlign}">
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

  const isStackAlign  = align === 'stack';
  const isRightAlign  = align === 'right';
  const isCenterAlign = align === 'center';

  // stack (1×3 세로 쌓기) 또는 right (배지 우측)
  if (isStackAlign || isRightAlign) {
    const flexDir   = isStackAlign ? 'column' : 'row-reverse';
    const textAlign = isStackAlign ? 'center' : 'right';
    const isDividerCA = connector && connectorStyle === 'divider';
    block.innerHTML = `<div style="${pxStyle}">${steps.map((s, i) => {
      const isLast = i === steps.length - 1;
      return `
        <div class="stb-item" style="flex-direction:${flexDir};gap:${badgeGap}px;${isStackAlign ? 'align-items:center;' : 'align-items:flex-start;'}">
          <div class="stb-left" style="padding-top:${isStackAlign ? 0 : leftPadTop}px;align-items:center;">
            <div style="${badgeStyle()}">${badgeLabel(i)}</div>
            ${connector && !isLast && isStackAlign && !isDividerCA ? connectorV() : ''}
          </div>
          <div class="stb-content" style="padding-top:${isStackAlign ? 0 : contPadTop}px;padding-bottom:${isLast ? 0 : (isDividerCA ? 0 : gap)}px;text-align:${textAlign};">
            <div class="stb-title" style="font-size:${titleSz}px;color:${titleColor};line-height:1.4">${s.title||''}</div>
            ${s.desc ? `<div class="stb-desc" style="font-size:${descSz}px;color:${descColor}">${s.desc}</div>` : ''}
          </div>
        </div>
        ${isDividerCA && !isLast ? `<div style="width:100%;height:1px;background:${numBg};opacity:0.2;margin:${Math.round(gap*0.5)}px 0"></div>` : ''}`;
    }).join('')}</div>`;
    return;
  }

  // center: left와 동일한 2컬럼 구조, 전체를 가운데 정렬
  if (isCenterAlign) {
    const isDivider = connector && connectorStyle === 'divider';
    block.innerHTML = `<div style="width:fit-content;margin:0 auto;${pxStyle}">${steps.map((s, i) => {
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
  block.dataset.stepPadL       = opts.stepPadL ?? opts.stepPadX ?? 0;
  block.dataset.stepPadR       = opts.stepPadR ?? opts.stepPadX ?? 0;
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

// ── Banner Block ───────────────────────────────────────────────────────────────
// frame-block의 변형 (data-banner-preset 속성). 신규 클래스 없음.
// 외곽 frame-block + 자식(text/asset/gap/inner frame) 트리.

function _resetFrameToBannerOuter(ss, frameSpec) {
  delete ss.dataset.freeLayout;
  delete ss.dataset.fullWidth;
  delete ss.dataset.height;
  ss.style.cssText = '';
  ss.dataset.bg = frameSpec.bg || 'transparent';
  if (frameSpec.radius !== undefined) ss.dataset.radius = String(frameSpec.radius);

  if (frameSpec.mode === 'freeLayout') {
    // 외곽 height는 inner flow content를 따라가도록 auto + min-height만 지정.
    // asset 등 absolute 자식은 외곽 height에 영향 없음.
    ss.dataset.freeLayout = 'true';
    ss.dataset.width  = String(frameSpec.width);
    ss.dataset.padY   = '0';
    let css = `background:${frameSpec.bg};padding:0;width:${frameSpec.width}px;max-width:100%;margin:0 auto;min-height:${frameSpec.height}px;`;
    if (frameSpec.radius) css += `border-radius:${frameSpec.radius}px;overflow:hidden;`;
    ss.style.cssText = css;
  } else if (frameSpec.mode === 'fullWidth') {
    ss.dataset.fullWidth = 'true';
    let css = `background:${frameSpec.bg};width:100%;box-sizing:border-box;`;
    if (frameSpec.radius) css += `border-radius:${frameSpec.radius}px;overflow:hidden;`;
    ss.style.cssText = css;
  }
}

function _injectBannerChild(parentFrame, child) {
  const isFree = parentFrame.dataset.freeLayout === 'true';

  if (child.kind === 'frame') {
    const isStackInner = child.mode === 'stack';
    const inner = makeFrameBlock({
      bg: child.bg,
      radius: child.radius,
      fullWidth: isStackInner,
    });
    if (isStackInner) {
      // stack inner: 초기 너비만 지정, 자동 높이. 사용자가 핸들로 너비 조절 가능.
      inner.style.width    = child.width + 'px';
      inner.style.minHeight = '';
      inner.style.height    = '';
      inner.dataset.width  = String(child.width);
      delete inner.dataset.height;
      if (isFree) {
        // 외곽 freeLayout이지만 inner는 absolute 대신 margin으로 위치잡아 외곽 height 추적.
        inner.style.marginLeft   = (child.x ?? 0) + 'px';
        inner.style.marginTop    = (child.y ?? 0) + 'px';
        inner.style.marginBottom = (child.y ?? 0) + 'px';
      }
    } else if (child.mode === 'freeLayout') {
      inner.dataset.width  = String(child.width);
      inner.dataset.height = String(child.height);
      inner.style.width    = child.width  + 'px';
      inner.style.height   = child.height + 'px';
      inner.style.minHeight = child.height + 'px';
      if (isFree) {
        inner.style.position = 'absolute';
        inner.style.left  = (child.x ?? 0) + 'px';
        inner.style.top   = (child.y ?? 0) + 'px';
        inner.style.margin = '0';
        inner.dataset.offsetX = String(child.x ?? 0);
        inner.dataset.offsetY = String(child.y ?? 0);
      }
    }
    parentFrame.appendChild(inner);
    window.bindFrameDropZone?.(inner);
    (child.children || []).forEach(gc => _injectBannerChild(inner, gc));
    return;
  }

  if (child.kind === 'text') {
    const { block } = makeTextBlock(child.textType || 'body');
    const tf = _makeTextFrame();
    applyTextOpts(block, tf, {
      content: child.content, color: child.color,
      fontSize: child.fontSize, align: child.align,
    }, child.textType);
    tf.appendChild(block);
    if (isFree) {
      tf.style.position = 'absolute';
      tf.style.left = (child.x ?? 0) + 'px';
      tf.style.top  = (child.y ?? 0) + 'px';
      if (child.width) tf.style.width = child.width + 'px';
      tf.dataset.offsetX = String(child.x ?? 0);
      tf.dataset.offsetY = String(child.y ?? 0);
    }
    parentFrame.appendChild(tf);
    bindBlock(block);
    return;
  }

  if (child.kind === 'asset') {
    const { row, block } = makeAssetBlock();
    block.style.width  = child.width  + 'px';
    block.style.height = child.height + 'px';
    if (child.src) {
      block.style.backgroundImage = `url("${child.src}")`;
      block.style.backgroundSize = 'cover';
      block.style.backgroundPosition = 'center';
      block.dataset.bgImg = child.src;
    }
    if (isFree) {
      block.style.position = 'absolute';
      block.style.left = (child.x ?? 0) + 'px';
      block.style.top  = (child.y ?? 0) + 'px';
      block.style.alignSelf = '';
      block.dataset.offsetX = String(child.x ?? 0);
      block.dataset.offsetY = String(child.y ?? 0);
      parentFrame.appendChild(block);
    } else {
      parentFrame.appendChild(row);
    }
    bindBlock(block);
    return;
  }

  if (child.kind === 'gap') {
    if (!isFree) {
      const gb = makeGapBlock();
      gb.style.height = (child.height || 24) + 'px';
      parentFrame.appendChild(gb);
      bindBlock(gb);
    }
    return;
  }
}

function _applyBannerPreset(frameEl, presetKey) {
  const preset = window.BANNER_PRESETS?.[presetKey];
  if (!preset) { console.warn('[banner] unknown preset:', presetKey); return; }
  while (frameEl.firstChild) frameEl.removeChild(frameEl.firstChild);
  _resetFrameToBannerOuter(frameEl, preset.frame);
  frameEl.dataset.bannerPreset = presetKey;
  (preset.children || []).forEach(c => _injectBannerChild(frameEl, c));
  window.bindFrameDropZone?.(frameEl);
  window.buildLayerPanel?.();
  window.triggerAutoSave?.();
}

function addBannerBlock(presetKey = 'frame_8') {
  const preset = window.BANNER_PRESETS?.[presetKey];
  if (!preset) { console.warn('[banner] unknown preset:', presetKey); return; }
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory();

  // _resetFrameToBannerOuter가 외곽 dataset/style 일괄 셋업 — single source of truth
  const ss = makeFrameBlock();
  _resetFrameToBannerOuter(ss, preset.frame);
  ss.dataset.bannerPreset = presetKey;

  insertAfterSelected(sec, ss);
  window.bindFrameDropZone?.(ss);

  (preset.children || []).forEach(c => _injectBannerChild(ss, c));

  window.buildLayerPanel();
  window.deselectAll?.();
  sec.classList.add('selected');
  window.syncLayerActive?.(sec);
  ss.classList.add('selected');
  window._activeFrame = ss;
  window.showFrameProperties?.(ss);
  window.showFrameHandles?.(ss);
  window.triggerAutoSave?.();
}

window.addBannerBlock     = addBannerBlock;
window._applyBannerPreset = _applyBannerPreset;

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
  const fontSize    = parseInt(block.dataset.fontSize) || 32;
  const bgLeft      = block.dataset.bgLeft   || '#e5e5ea';
  const bgRight     = block.dataset.bgRight  || '#1888fe';
  const colorLeft   = block.dataset.colorLeft  || '#111111';
  const colorRight  = block.dataset.colorRight || '#ffffff';
  const radius      = parseInt(block.dataset.radius)  || 16;
  const padding     = parseInt(block.dataset.padding) || 16;
  block.style.padding = `${padding}px`;

  block.innerHTML = messages.map((msg, idx) => {
    const isLeft = msg.align !== 'right';
    const bg     = isLeft ? bgLeft  : bgRight;
    const color  = isLeft ? colorLeft : colorRight;
    const dir    = isLeft ? 'left' : 'right';
    // left: scaleX(-1) 반전, right: 원본 (Figma 벡터가 우측 꼬리형)
    const tailTransform = isLeft ? 'transform="scale(-1,1) translate(-19,0)"' : '';
    const tail = `<svg class="chb-tail" viewBox="0 0 19 16" xmlns="http://www.w3.org/2000/svg" width="19" height="16" style="fill:${bg}"><path d="${CHAT_TAIL_PATH}" ${tailTransform}/></svg>`;

    return `<div class="chb-msg chb-${dir}" style="margin-bottom:${gap}px">
  <div class="chb-wrap">
    <div class="chb-bubble" data-msg-idx="${idx}" style="background:${bg};color:${color};font-size:${fontSize}px;border-radius:${radius}px">${msg.text}</div>
    ${tail}
  </div>
</div>`;
  }).join('');

  // 더블클릭으로 메시지 인라인 편집 — Enter는 default(줄바꿈), ESC/blur로 종료
  // innerHTML 재생성으로 bubble 노드가 교체되므로 block에 위임(delegation)으로 1회만 바인딩
  if (!block._chatEditBound) {
    block._chatEditBound = true;

    const finishEdit = (bubble) => {
      if (bubble.getAttribute('contenteditable') !== 'true') return;
      bubble.removeAttribute('contenteditable');
      bubble.style.cursor = '';
      bubble.style.userSelect = '';
      const idx = parseInt(bubble.dataset.msgIdx);
      const msgs = JSON.parse(block.dataset.messages || '[]');
      if (msgs[idx]) {
        const newText = bubble.innerText;  // \n 보존
        if (msgs[idx].text !== newText) {
          msgs[idx].text = newText;
          block.dataset.messages = JSON.stringify(msgs);
          window.pushHistory?.('채팅 메시지 편집');
          window.scheduleAutoSave?.();
          // 우측 prop-chat 패널이 열려있다면 textarea sync
          if (block.classList.contains('selected')) {
            window.showChatProperties?.(block);
          }
        }
      }
    };

    block.addEventListener('dblclick', (e) => {
      const bubble = e.target.closest('.chb-bubble');
      if (!bubble || !block.contains(bubble)) return;
      e.stopPropagation();
      if (bubble.getAttribute('contenteditable') === 'true') return;
      // user-select:none 우회 — 편집 중에는 텍스트 선택/캐럿 허용
      bubble.setAttribute('contenteditable', 'true');
      bubble.style.cursor = 'text';
      bubble.style.userSelect = 'text';
      bubble.focus();
      // 캐럿을 끝으로 (전체 선택 후 collapseToEnd로 caret 이동)
      const sel = window.getSelection();
      try { sel.selectAllChildren(bubble); sel.collapseToEnd(); } catch(_) {}
    });

    // blur 위임: focusout 이벤트로 bubble 단위 종료 감지
    block.addEventListener('focusout', (e) => {
      const bubble = e.target.closest?.('.chb-bubble');
      if (bubble && block.contains(bubble)) finishEdit(bubble);
    });

    block.addEventListener('keydown', (e) => {
      const bubble = e.target.closest?.('.chb-bubble');
      if (!bubble || bubble.getAttribute('contenteditable') !== 'true') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        bubble.blur();
      }
      // Enter는 default(줄바꿈) 그대로
    });
  }
}

function makeChatBlock(opts = {}) {
  const block = document.createElement('div');
  block.className    = 'chat-block';
  block.id           = genId('chb');
  block.dataset.type = 'chat';
  block.dataset.messages  = JSON.stringify(opts.messages || CHAT_DEFAULT_MESSAGES);
  block.dataset.gap        = opts.gap       || 8;
  block.dataset.fontSize   = opts.fontSize  || 32;
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

// ── Laurel Block (월계수) ────────────────────────────────────────────────────
// 좌우 월계수 SVG + 가운데 텍스트. 트로피/수상 마크.
const LAUREL_VIEWBOX = '0 0 170 324';
const LAUREL_LEFT_PATH = 'M73.3342 3.94941C62.1592 17.5874 60.6742 33.1004 69.1282 47.8894C70.4992 50.2864 71.6252 53.3084 71.6322 54.6054C71.6392 55.9024 69.4062 60.3094 66.6712 64.3994C63.9352 68.4894 59.8122 75.6404 57.5072 80.2914C55.2032 84.9424 52.9142 88.7474 52.4222 88.7474C51.9292 88.7474 51.7602 88.3694 52.0452 87.9074C52.3312 87.4454 53.0642 82.9544 53.6762 77.9274C55.6012 62.0924 52.1942 48.2984 44.0472 38.9484L40.8222 35.2474L38.6432 40.2474C31.1052 57.5474 33.1222 71.5894 44.9882 84.4054C48.0992 87.7654 50.6442 91.4094 50.6442 92.5034C50.6442 93.5974 49.0632 99.3204 47.1302 105.22C45.1972 111.12 43.0702 118.827 42.4022 122.347C41.7342 125.867 40.8732 128.747 40.4882 128.747C40.1032 128.747 39.5132 126.159 39.1782 122.997C38.1292 113.119 35.5582 103.476 32.3572 97.4134C29.0602 91.1714 19.2242 81.4894 16.6772 81.9794C13.5802 82.5764 12.6612 98.4724 15.2592 106.517C17.6232 113.839 23.2072 120.575 31.6712 126.317L39.1442 131.387L39.0712 136.317C38.8122 153.763 38.0532 170.735 37.5312 170.74C37.1942 170.744 35.4852 166.741 33.7332 161.845C30.5462 152.935 24.6562 143.281 19.7532 138.933C15.4782 135.141 3.54924 129.442 2.36524 130.626C0.608237 132.383 3.31724 145.566 6.91024 152.74C11.0822 161.07 19.4332 167.714 29.6212 170.809C33.4232 171.963 36.9502 173.434 37.4602 174.078C37.9702 174.721 38.9262 179.627 39.5862 184.981C40.2452 190.334 41.6622 198.388 42.7342 202.878C43.8062 207.367 44.5012 211.224 44.2772 211.448C44.0532 211.672 41.7882 208.724 39.2432 204.896C33.5862 196.386 23.8592 187.197 17.7252 184.567C11.4082 181.86 1.36724 179.624 0.302237 180.689C-0.725763 181.717 0.938235 187.292 4.23624 193.877C6.97924 199.351 13.6532 206.184 18.8642 208.852C24.0622 211.514 33.1812 213.747 38.8542 213.747C43.6232 213.747 47.6442 216.099 47.6442 218.889C47.6442 220.693 54.7002 236.651 58.3662 243.138C60.1972 246.378 61.4772 249.247 61.2102 249.514C60.9442 249.781 57.6992 247.226 54.0002 243.836C43.3502 234.077 30.4692 228.72 17.7582 228.762C15.2202 228.771 12.4702 229.204 11.6462 229.724C10.3342 230.554 10.3752 231.092 11.9802 234.072C14.8672 239.434 22.4202 247.535 26.9772 250.16C29.2692 251.479 33.6802 253.111 36.7792 253.786C42.0452 254.933 44.9502 254.849 58.2692 253.165L63.3952 252.516L68.9882 260.08C72.0652 264.24 77.5752 270.817 81.2342 274.695C84.8932 278.574 87.3692 281.747 86.7372 281.747C86.1042 281.747 83.0122 280.449 79.8652 278.862C65.5442 271.64 51.7722 269.919 39.2492 273.787C35.6012 274.914 32.6442 276.402 32.6442 277.11C32.6442 279.043 42.4252 286.689 48.5052 289.509C58.7102 294.242 71.6642 293.345 82.3222 287.168C84.6202 285.837 87.5452 284.756 88.8222 284.768C90.0992 284.779 95.1402 287.47 100.023 290.748C104.906 294.026 111.994 298.166 115.773 299.948C123.523 303.603 124.604 305.254 118.581 304.236C116.347 303.859 109.26 303.558 102.831 303.568C93.7372 303.582 89.8852 304.03 85.4722 305.586C77.6192 308.354 68.4242 314.366 68.8292 316.467C69.4072 319.469 80.1752 323.024 90.1442 323.504C102.671 324.106 108.386 321.886 118.13 312.63C122.418 308.557 126.243 305.747 127.499 305.747C128.666 305.747 132.889 306.631 136.883 307.711C144.625 309.805 158.331 311.747 165.368 311.747C168.932 311.747 169.644 311.424 169.644 309.808C169.644 307.741 168.611 307.496 154.644 306.249C146.522 305.524 137.374 303.816 135.539 302.682C134.444 302.005 134.144 298.529 134.144 286.533C134.144 271.928 134.023 271.001 131.428 265.717C129.934 262.675 127.387 258.917 125.767 257.365L122.823 254.544L121.203 257.016C117.736 262.307 115.411 271.033 115.926 276.819C116.569 284.037 119.217 289.083 125.809 295.649C130.943 300.762 131.031 300.939 128.144 300.341C124.224 299.53 107.676 291.278 102.609 287.607C97.7452 284.083 97.6052 282.124 101.612 273.652C105.553 265.317 106.977 257.92 106.4 248.78C105.896 240.802 104.189 235.747 101.998 235.747C101.269 235.747 98.6302 238.335 96.1332 241.497C86.8962 253.194 86.4092 265.463 94.6672 278.452C97.8032 283.384 94.1622 281.718 87.5462 275.192C78.4122 266.183 71.6442 257.198 71.6442 254.081C71.6442 252.584 72.9592 250.36 74.9852 248.43C84.7662 239.112 90.3062 226.743 89.4302 216.18C89.1822 213.193 88.6552 210.425 88.2582 210.028C87.0572 208.827 78.8412 213.786 75.0142 218.023C68.9942 224.687 67.3162 229.721 67.9742 239.156C68.2842 243.606 68.8212 248.597 69.1672 250.247L69.7972 253.247L67.7452 250.747C64.5292 246.827 52.6442 222.762 52.6442 220.17C52.6442 217.712 53.4772 216.978 63.2712 210.809C74.4092 203.793 81.7272 190.5 80.7452 179.067C80.6272 177.69 77.3132 178.473 70.4912 181.49C59.5382 186.335 52.6462 196.958 52.6452 208.997C52.6442 212.71 52.2072 215.747 51.6732 215.747C49.7652 215.747 43.6452 190.897 43.6442 183.152C43.6442 179.448 45.9002 177.225 50.6442 176.252C55.5342 175.249 63.3712 171.211 68.3582 167.126C72.9702 163.346 80.3422 150.008 79.3072 147.312C78.8412 146.097 77.7172 145.906 73.9312 146.402C58.4792 148.424 47.5412 158.351 45.1782 172.497C44.7882 174.834 44.0942 176.747 43.6362 176.747C41.5052 176.747 41.2712 156.016 43.2502 142.588C43.8852 138.276 45.9852 137.18 55.1442 136.381C63.3422 135.665 67.6532 134.261 73.2942 130.47C78.5752 126.921 85.8192 118.105 85.3932 115.747C85.0362 113.768 70.9272 113.145 64.8412 114.839C59.0622 116.447 51.3922 123.519 48.0772 130.294C45.3682 135.832 43.1892 137.593 44.1152 133.497C44.3942 132.259 45.2852 127.953 46.0942 123.927C46.9032 119.902 48.7212 112.819 50.1332 108.189C53.0622 98.5884 53.8682 98.0284 63.1762 99.1224C74.9682 100.508 88.0332 96.7344 96.1662 89.5944C100.403 85.8744 99.8582 84.8364 92.3592 82.3404C80.4062 78.3614 67.9472 82.0054 59.1602 92.0504C56.6762 94.8894 54.6452 96.5454 54.6462 95.7304C54.6482 93.9564 64.1102 74.8884 68.2292 68.3564C69.8322 65.8134 71.9272 63.4824 72.8832 63.1764C73.8402 62.8704 78.1152 63.8564 82.3832 65.3684C93.4302 69.2824 104.789 69.3504 112.894 65.5524C116.056 64.0704 118.644 62.2194 118.644 61.4384C118.644 59.7824 112.765 55.5144 107.426 53.2934C102.739 51.3444 93.1582 51.3024 87.7592 53.2074C85.4842 54.0094 81.5702 56.0784 79.0632 57.8034C76.5552 59.5284 74.2552 60.6914 73.9512 60.3874C73.2892 59.7254 84.6672 46.0004 90.8982 39.9464C94.8822 36.0744 96.2102 35.4594 104.234 33.7744C114.678 31.5814 120.898 29.0874 125.43 25.2744C129.114 22.1744 137.644 11.4334 137.644 9.89441C137.644 9.34141 135.115 8.36441 132.025 7.72241C117.158 4.63641 104.149 11.8824 97.0762 27.1874C94.8252 32.0574 92.1562 35.7984 88.4702 39.2474C85.5312 41.9974 80.9932 46.7144 78.3852 49.7304C72.9122 56.0594 72.3722 54.8284 76.5672 45.5774C80.8242 36.1894 82.9262 27.2674 82.8872 18.7474C82.8532 11.0184 80.1622 0.704413 78.0002 0.0154134C77.3712 -0.184587 75.2722 1.58541 73.3342 3.94941Z';

const LAUREL_DEFAULTS = {
  text: '1위',              // backward compat (단일 라인 → lines[0])
  gap: 0,                   // 잎과 텍스트 사이 기본 0 (자연스럽게 붙음)
  color: '#1a1a1a',         // backward compat (마이그레이션 소스)
  leafColor: '#1a1a1a',
  textColor: '#1a1a1a',    // backward compat
  fontSize: 56,             // backward compat
  fontWeight: 700,          // backward compat
  height: 140,
  lines: [{ text: '1위', fontSize: 56, fontWeight: 700, color: '#1a1a1a' }],
};

// dataset.lines 읽기 (backward compat: 단일 text/fontSize/fontWeight/textColor → lines[0])
function _readLaurelLines(block) {
  try {
    const raw = block.dataset.lines;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  // 마이그레이션
  const legacy = block.dataset.color;
  return [{
    text:       block.dataset.text       ?? LAUREL_DEFAULTS.text,
    fontSize:   parseInt(block.dataset.fontSize)   || LAUREL_DEFAULTS.fontSize,
    fontWeight: parseInt(block.dataset.fontWeight) || LAUREL_DEFAULTS.fontWeight,
    color:      block.dataset.textColor || legacy || LAUREL_DEFAULTS.textColor,
  }];
}
window._readLaurelLines = _readLaurelLines;

function _defaultLaurelCell() {
  return {
    lines: [{ text: '1위', fontSize: 56, fontWeight: 700, color: '#1a1a1a' }],
    leafColor: '#1a1a1a',
    gap: 24,
    height: 140,
  };
}

// dataset.cells 읽기 (backward compat: 단일 lines/leafColor/gap/height → cells[0])
function _readLaurelCells(block) {
  try {
    const raw = block.dataset.cells;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  // 마이그레이션: 기존 단일 데이터 → cells[0]
  const legacy = block.dataset.color;
  return [{
    lines:     _readLaurelLines(block),
    leafColor: block.dataset.leafColor || legacy || '#1a1a1a',
    gap:       parseInt(block.dataset.gap)    || 24,
    height:    parseInt(block.dataset.height) || 140,
  }];
}
window._readLaurelCells = _readLaurelCells;

function _escLaurelText(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 월계수 색 프리셋 — 단색(solid)은 currentColor 그대로, 그 외는 linearGradient
// 기본 5종(클래식) + Apple 4종(절제) + Multi-stop 5종(대각선·메탈광택·복합)
// 각 프리셋: stops + (선택) angle {x1,y1,x2,y2}로 그라데이션 방향
const LAUREL_FILL_PRESETS = {
  // 클래식 5종 (기존 — 세로 그라데이션, 3 stops)
  gold:     { name: 'Gold',          stops: [['0%',  '#fff4c2'], ['50%', '#d4af37'], ['100%', '#9e7c1e']] },
  silver:   { name: 'Silver',        stops: [['0%',  '#f5f5f5'], ['50%', '#a8a8a8'], ['100%', '#6b6b6b']] },
  bronze:   { name: 'Bronze',        stops: [['0%',  '#f0c8a0'], ['50%', '#a0703c'], ['100%', '#5e3e1a']] },
  rosegold: { name: 'Rose Gold',     stops: [['0%',  '#fce4d6'], ['50%', '#e8a48f'], ['100%', '#a8625a']] },
  platinum: { name: 'Platinum',      stops: [['0%',  '#ffffff'], ['50%', '#cbd5e0'], ['100%', '#778191']] },
  // Apple 디자인 톤 — 절제된 모노톤 + 미세한 highlight (4 stops)
  appleGold:      { name: 'Soft Gold (Apple)',     stops: [['0%', '#f7e6b4'], ['35%', '#e2c277'], ['65%', '#b8923f'], ['100%', '#7f6326']] },
  appleSilver:    { name: 'Cool Silver (Apple)',   stops: [['0%', '#f4f4f6'], ['35%', '#dadbde'], ['65%', '#a8aab0'], ['100%', '#6e7077']] },
  appleMidnight:  { name: 'Midnight (Apple)',      stops: [['0%', '#5a6577'], ['35%', '#39414f'], ['65%', '#1f2530'], ['100%', '#0d1117']] },
  appleStarlight: { name: 'Starlight (Apple)',     stops: [['0%', '#fbf4e6'], ['35%', '#ede0c2'], ['65%', '#c6b387'], ['100%', '#86754a']] },
  // Multi-stop 5종 — 대각선 + 6 stops로 메탈 광택/홀로그래픽 효과 (밋밋함 해소)
  polishedGold: {
    name: 'Polished Gold (광택)',
    stops: [['0%','#a17e2a'],['18%','#fff4c2'],['38%','#d4af37'],['55%','#7c5d18'],['78%','#f8e592'],['100%','#856226']],
    angle: { x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
  },
  mirrorSilver: {
    name: 'Mirror Silver (광택)',
    stops: [['0%','#4a4a4a'],['20%','#ffffff'],['40%','#bababa'],['60%','#6c6c6c'],['80%','#eaeaea'],['100%','#363636']],
    angle: { x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
  },
  champagne: {
    name: 'Champagne Sparkle',
    stops: [['0%','#fff8dc'],['25%','#e6c994'],['50%','#fffaee'],['70%','#c9a063'],['100%','#7c5e2d']],
    angle: { x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
  },
  emeraldMetal: {
    name: 'Emerald Metal',
    stops: [['0%','#0d3320'],['22%','#a3e4c0'],['42%','#2d8c5a'],['58%','#0d3320'],['78%','#5fc790'],['100%','#0a2818']],
    angle: { x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
  },
  iridescent: {
    name: 'Iridescent (홀로)',
    stops: [['0%','#ff9ad8'],['25%','#a0e7ff'],['50%','#fff5a0'],['75%','#a8ffb0'],['100%','#a098ff']],
    angle: { x1: '0%', y1: '0%', x2: '100%', y2: '0%' },
  },
};
window.LAUREL_FILL_PRESETS = LAUREL_FILL_PRESETS;

function _laurelLeafSvg(width, height, mirror, leafFill) {
  // leaf 크기 고정 (flex-shrink:0 → 텍스트 길어져도 leaf 안 줄어듦)
  // width auto + height 명시 + viewBox로 비율 유지
  const style = `max-width:${width}px;max-height:${height}px;width:auto;height:${height}px;flex-shrink:0;${mirror ? 'transform:scaleX(-1);' : ''}`;
  const preset = (leafFill && leafFill !== 'solid') ? LAUREL_FILL_PRESETS[leafFill] : null;
  let fillAttr = 'currentColor';
  let defs = '';
  if (preset) {
    const gid = 'lrl-grad-' + Math.random().toString(36).slice(2, 9);
    const stopsHtml = preset.stops.map(([off, col]) => `<stop offset="${off}" stop-color="${col}"/>`).join('');
    // 그라데이션 방향: preset.angle이 있으면 그 값, 없으면 세로 (위→아래)
    const a = preset.angle || { x1: '0%', y1: '0%', x2: '0%', y2: '100%' };
    defs = `<defs><linearGradient id="${gid}" x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}">${stopsHtml}</linearGradient></defs>`;
    fillAttr = `url(#${gid})`;
  }
  return `<svg class="laurel-leaf" viewBox="${LAUREL_VIEWBOX}" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg" style="${style}">${defs}<path fill-rule="evenodd" clip-rule="evenodd" d="${LAUREL_LEFT_PATH}" fill="${fillAttr}"/></svg>`;
}

function _renderLaurelCellHtml(cell, idx) {
  const gap       = Number.isFinite(parseInt(cell.gap)) ? parseInt(cell.gap) : 24;
  const leafColor = cell.leafColor        || '#1a1a1a';
  const leafFill  = cell.leafFill         || 'solid';   // 'solid' | 'gold' | 'silver' | 'bronze' | 'rosegold' | 'platinum'
  const height    = parseInt(cell.height) || 140;
  const width     = Math.round(height * 170 / 324);
  const lines     = Array.isArray(cell.lines) && cell.lines.length > 0
    ? cell.lines
    : [{ text: '1위', fontSize: 56, fontWeight: 700, color: '#1a1a1a' }];
  const linesHtml = lines.map(ln => {
    const fs = parseInt(ln.fontSize)   || LAUREL_DEFAULTS.fontSize;
    const fw = parseInt(ln.fontWeight) || LAUREL_DEFAULTS.fontWeight;
    const cl = ln.color || LAUREL_DEFAULTS.textColor;
    const ls = (ln.letterSpacing !== undefined && ln.letterSpacing !== null && !isNaN(parseFloat(ln.letterSpacing))) ? parseFloat(ln.letterSpacing) : 0;
    return `<span class="laurel-text-line" style="font-size:${fs}px;font-weight:${fw};line-height:1.1;white-space:nowrap;color:${cl};letter-spacing:${ls}px;">${_escLaurelText(ln.text)}</span>`;
  }).join('');
  return `
    <div class="laurel-cell" data-cell-idx="${idx}" style="color:${leafColor};">
      <div class="laurel-inner" style="position:relative;width:100%;display:flex;align-items:center;justify-content:center;min-height:${height}px;">
        <span class="laurel-leaf-left" style="position:absolute;left:${gap}px;top:50%;transform:translateY(-50%);display:flex;align-items:center;">${_laurelLeafSvg(width, height, false, leafFill)}</span>
        <span class="laurel-text-stack" style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center;">${linesHtml}</span>
        <span class="laurel-leaf-right" style="position:absolute;right:${gap}px;top:50%;transform:translateY(-50%);display:flex;align-items:center;">${_laurelLeafSvg(width, height, true, leafFill)}</span>
      </div>
    </div>`;
}
window._renderLaurelCellHtml = _renderLaurelCellHtml;

function renderLaurelBlock(block) {
  const cols  = Math.max(1, parseInt(block.dataset.gridCols) || 1);
  const rows  = Math.max(1, parseInt(block.dataset.gridRows) || 1);
  const total = cols * rows;
  let cells   = _readLaurelCells(block);

  // 그리드 크기에 맞춰 cells push/pop
  if (cells.length < total) {
    const seed = cells[0] || _defaultLaurelCell();
    while (cells.length < total) cells.push(JSON.parse(JSON.stringify(seed)));
  } else if (cells.length > total) {
    cells = cells.slice(0, total);
  }
  block.dataset.cells    = JSON.stringify(cells);
  block.dataset.gridCols = String(cols);
  block.dataset.gridRows = String(rows);

  block.style.display              = 'grid';
  // minmax(0, 1fr): 셀이 자식 콘텐츠 size를 무시하고 균등 분배 (컨테이너 초과 방지)
  block.style.gridTemplateColumns  = `repeat(${cols}, minmax(0, 1fr))`;
  block.style.gridTemplateRows     = `repeat(${rows}, auto)`;
  block.style.columnGap            = (parseInt(block.dataset.gridColGap) || 32) + 'px';
  block.style.rowGap               = (parseInt(block.dataset.gridRowGap) || 24) + 'px';
  block.innerHTML = cells.map((c, i) => _renderLaurelCellHtml(c, i)).join('');
}

function makeLaurelBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'laurel-block';
  block.id = 'lrb_' + Math.random().toString(36).slice(2, 8);
  block.dataset.type       = 'laurel';
  // 그리드 + cells 모델 (옛 단일 opts는 cells[0]로 변환)
  const cols = Math.max(1, parseInt(opts.gridCols) || 1);
  const rows = Math.max(1, parseInt(opts.gridRows) || 1);
  block.dataset.gridCols = String(cols);
  block.dataset.gridRows = String(rows);

  const cellSeed = {
    lines: Array.isArray(opts.lines) && opts.lines.length > 0
      ? opts.lines
      : [{
          text:       opts.text       ?? LAUREL_DEFAULTS.text,
          fontSize:   opts.fontSize   ?? LAUREL_DEFAULTS.fontSize,
          fontWeight: opts.fontWeight ?? LAUREL_DEFAULTS.fontWeight,
          color:      opts.textColor  ?? opts.color ?? LAUREL_DEFAULTS.textColor,
        }],
    leafColor: opts.leafColor ?? opts.color ?? LAUREL_DEFAULTS.leafColor,
    gap:       opts.gap       ?? LAUREL_DEFAULTS.gap,
    height:    opts.height    ?? LAUREL_DEFAULTS.height,
  };
  const total = cols * rows;
  const initCells = Array.isArray(opts.cells) && opts.cells.length > 0
    ? opts.cells.slice(0, total)
    : [cellSeed];
  while (initCells.length < total) initCells.push(JSON.parse(JSON.stringify(cellSeed)));
  block.dataset.cells = JSON.stringify(initCells);
  renderLaurelBlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addLaurelBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory();
  const { row, block } = makeLaurelBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.triggerAutoSave?.();
}

window.makeLaurelBlock   = makeLaurelBlock;
window.addLaurelBlock    = addLaurelBlock;
window.renderLaurelBlock = renderLaurelBlock;

// ── Sticker Block (플로팅 오버레이) ───────────────────────────────────────
// 섹션 안에 absolute로 떠있는 작은 뱃지. 어노테이션과 같은 overlay 패턴.
// 첫 종류: 원 + NEW 텍스트 (빨간 배경 + 흰 글자)
const STICKER_DEFAULTS = {
  shape: 'circle',
  size: 60,
  text: 'NEW',
  bgColor: '#e74c3c',
  textColor: '#ffffff',
  fontSize: 14,
  fontWeight: 700,
  x: 40,
  y: 40,
};

function renderStickerBlock(block) {
  const shape      = block.dataset.shape      || STICKER_DEFAULTS.shape;
  const size       = parseInt(block.dataset.size)       || STICKER_DEFAULTS.size;
  // 모서리 핸들 리사이즈 시 W/H 독립 (sizeW/sizeH 우선, 없으면 size로 정사각)
  const sizeW      = parseInt(block.dataset.sizeW) || size;
  const sizeH      = parseInt(block.dataset.sizeH) || size;
  const text       = block.dataset.text ?? STICKER_DEFAULTS.text;
  const bgColor    = block.dataset.bgColor    || STICKER_DEFAULTS.bgColor;
  const textColor  = block.dataset.textColor  || STICKER_DEFAULTS.textColor;
  const fontSize   = parseInt(block.dataset.fontSize)   || STICKER_DEFAULTS.fontSize;
  const fontWeight = parseInt(block.dataset.fontWeight) || STICKER_DEFAULTS.fontWeight;
  const x          = parseInt(block.dataset.x) || 0;
  const y          = parseInt(block.dataset.y) || 0;
  const imgSrc     = block.dataset.imgSrc || '';
  const mode       = block.dataset.mode || (imgSrc ? 'image' : 'text');

  if (shape === 'highlight') {
    // 형광펜 모드 — 색 사각형 (글자 없음), W/H 별도, z-index 낮음 (텍스트 아래)
    const hlW = parseInt(block.dataset.hlW) || 160;
    const hlH = parseInt(block.dataset.hlH) || 28;
    const hlColor = block.dataset.hlColor || 'rgba(255, 235, 70, 0.7)';
    block.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${hlW}px;height:${hlH}px;`
      + `background:${hlColor};border-radius:4px;`
      + `user-select:none;cursor:move;z-index:1;pointer-events:auto;`;
    block.innerHTML = '';
    return;
  }

  if (shape === 'highlightB') {
    // 선 형태 형광펜 — 두 점 (x1,y1)→(x2,y2) 사이를 두께 thickness만큼 칠함
    const x1 = parseFloat(block.dataset.x1) || 0;
    const y1 = parseFloat(block.dataset.y1) || 0;
    const x2 = parseFloat(block.dataset.x2) || 0;
    const y2 = parseFloat(block.dataset.y2) || 0;
    const thickness = parseInt(block.dataset.thickness) || 12;
    const hlColor = block.dataset.hlColor || 'rgba(255, 235, 70, 0.7)';
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    // bbox padding (thickness/2 정도) — 회전된 자식이 빠져나오지 않도록
    const pad = Math.ceil(thickness / 2) + 2;
    const bboxLeft = Math.min(x1, x2) - pad;
    const bboxTop  = Math.min(y1, y2) - pad;
    const bboxW    = Math.abs(dx) + pad * 2;
    const bboxH    = Math.abs(dy) + pad * 2;
    block.style.cssText = `position:absolute;left:${bboxLeft}px;top:${bboxTop}px;`
      + `width:${bboxW}px;height:${bboxH}px;`
      + `background:transparent;pointer-events:none;user-select:none;z-index:1;`;
    // 내부 회전 line div — 실제 클릭/드래그 타겟
    const lineLeft = cx - bboxLeft;
    const lineTop  = cy - bboxTop;
    block.innerHTML = `<div class="sticker-hlb-line" style="`
      + `position:absolute;left:${lineLeft}px;top:${lineTop}px;`
      + `width:${length}px;height:${thickness}px;`
      + `background:${hlColor};border-radius:${Math.min(thickness / 2, 4)}px;`
      + `transform:translate(-50%, -50%) rotate(${angle}deg);transform-origin:center center;`
      + `cursor:move;pointer-events:auto;"></div>`;
    return;
  }

  const radius = shape === 'circle' ? '50%' : '8px';
  if (mode === 'image' && imgSrc) {
    // 이미지 모드 — 배경 색 무시, 이미지로 채움
    block.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${sizeW}px;height:${sizeH}px;`
      + `background:transparent;border-radius:${radius};overflow:hidden;`
      + `display:flex;align-items:center;justify-content:center;`
      + `user-select:none;cursor:move;z-index:55;pointer-events:auto;`;
    block.innerHTML = `<img class="sticker-img" src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;" draggable="false">`;
  } else {
    // 텍스트 모드 (기본)
    block.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${sizeW}px;height:${sizeH}px;`
      + `background:${bgColor};color:${textColor};border-radius:${radius};`
      + `display:flex;align-items:center;justify-content:center;`
      + `font-size:${fontSize}px;font-weight:${fontWeight};line-height:1;`
      + `user-select:none;cursor:move;z-index:55;pointer-events:auto;`;
    block.innerHTML = `<span class="sticker-text" style="text-align:center;padding:4px;">${text}</span>`;
  }
}

function makeStickerBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'sticker-block';
  block.id = 'stk_' + Math.random().toString(36).slice(2, 8);
  block.dataset.type       = 'sticker';
  block.dataset.shape      = opts.shape      ?? STICKER_DEFAULTS.shape;
  block.dataset.size       = opts.size       ?? STICKER_DEFAULTS.size;
  block.dataset.text       = opts.text       ?? STICKER_DEFAULTS.text;
  block.dataset.bgColor    = opts.bgColor    ?? STICKER_DEFAULTS.bgColor;
  block.dataset.textColor  = opts.textColor  ?? STICKER_DEFAULTS.textColor;
  block.dataset.fontSize   = opts.fontSize   ?? STICKER_DEFAULTS.fontSize;
  block.dataset.fontWeight = opts.fontWeight ?? STICKER_DEFAULTS.fontWeight;
  block.dataset.x          = opts.x          ?? STICKER_DEFAULTS.x;
  block.dataset.y          = opts.y          ?? STICKER_DEFAULTS.y;
  // highlightB (선 형광펜) 전용 데이터
  if (opts.shape === 'highlightB') {
    block.dataset.x1        = opts.x1        ?? 0;
    block.dataset.y1        = opts.y1        ?? 0;
    block.dataset.x2        = opts.x2        ?? 100;
    block.dataset.y2        = opts.y2        ?? 0;
    block.dataset.thickness = opts.thickness ?? 12;
    block.dataset.hlColor   = opts.hlColor   ?? 'rgba(255, 235, 70, 0.7)';
  }
  renderStickerBlock(block);
  return block;
}

function addStickerBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory?.('스티커 추가');
  const block = makeStickerBlock(opts);
  sec.appendChild(block); // 섹션 직접 자식 (absolute → 섹션 기준)
  window.bindStickerSelect?.(block);
  window.scheduleAutoSave?.();
}

window.makeStickerBlock   = makeStickerBlock;
window.addStickerBlock    = addStickerBlock;
window.renderStickerBlock = renderStickerBlock;

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

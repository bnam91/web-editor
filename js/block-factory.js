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
  const _tblTok = (name, fallback) => {
    if (typeof getComputedStyle !== 'function') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };
  tb.dataset.lineColor = _tblTok('--preset-table-line', '#cccccc');
  tb.dataset.headerBg  = _tblTok('--preset-table-header-bg', '#f0f0f0');
  tb.dataset.textColor = _tblTok('--preset-table-text', '#222222');
  tb.dataset.fontFamily = '';
  tb.style.setProperty('--tbl-outer-w', '1px');
  tb.style.setProperty('--tbl-line-color', tb.dataset.lineColor);
  tb.style.setProperty('--tbl-header-bg', tb.dataset.headerBg);
  tb.style.setProperty('--tbl-text-color', tb.dataset.textColor);
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
    // opts.html이면 글자별 스타일 span 포함 HTML로 주입
    if (opts.html) contentEl.innerHTML = opts.content;
    else contentEl.textContent = opts.content;
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

// Cmd+G: 선택 블록을 피그마식 그룹(freeLayout 프레임 + data-group)으로 묶음
function groupSelectedBlocks() {
  return wrapSelectedBlocksInFrame({ asGroup: true });
}

// ── Row 프리셋 생성 ──────────────────────────────────────────
function makePresetRow(type) {
  // 2026-06-08 NewGrid 봉인: img2/img3 multi-col preset → canvas-block(cvb_)로 변환.
  // 옛 경로(.row + .col x N)는 load 시 save-load.js가 NewGrid로 자동 변환하던 좀비 동작.
  // canvas-block은 허용된 grid 컴포넌트이므로 multi-image 비교 의도 보존하며 NewGrid 회피.
  if (type === 'img2' || type === 'img3') {
    const n = (type === 'img2') ? 2 : 3;
    const cards = Array.from({ length: n }, (_, i) => ({
      title: `카드 ${i + 1}`, desc: '', imgSrc: '', cellBg: ''
    }));
    const { row, block } = window.makeCanvasBlock({
      cardMode: 'simple',
      gridCols: n, gridRows: 1,
      width: 360, height: 480,
      titleSize: 40, descSize: 22,
      textAlign: 'center', textBg: '#a2abb8',
      imgRatio: 76, cardGap: 12, padX: 0,
      layerName: 'Card',
      cards,
    });
    return { row, firstBlock: block };
  }
  if (type === 'text-img') {
    // 텍스트+이미지 좌우는 stack(text 위 / image 아래)으로 fallback
    console.warn('[block-factory] preset text-img → img1 stack fallback (multi-col grid deprecated)');
    type = 'img1';
  }
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
  // 이미지 자동 박기 (opts.imgSrc | opts.scratchId)
  const applyImageIfAny = (block) => {
    let src = opts.imgSrc;
    if (!src && opts.scratchId && typeof window._getScratchItemByIdForMCP === 'function') {
      const item = window._getScratchItemByIdForMCP(opts.scratchId, { includeSrc: true });
      if (item?.src) src = item.src;
    }
    if (src && typeof window.setAssetImageFromSrc === 'function') {
      try { window.setAssetImageFromSrc(block, src); } catch (e) { console.warn('[addAssetBlock] setAssetImageFromSrc 실패:', e); }
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
    if (insertedBlock) { applyExcludePadX(insertedBlock); applyImageIfAny(insertedBlock); }
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
  applyImageIfAny(block);
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
  // 2026-06-08: opts.headers + opts.rows 데이터 직접 주입 지원 (MCP add_table_block)
  const _escHtml = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const applyData = (block) => {
    if (opts.showHeader === false) {
      block.dataset.showHeader = 'false';
      const thead = block.querySelector('thead'); if (thead) thead.style.display = 'none';
    }
    const align = opts.cellAlign || block.dataset.cellAlign || 'center';
    if (opts.cellAlign) { block.dataset.cellAlign = opts.cellAlign; }
    if (Array.isArray(opts.headers) && opts.headers.length > 0) {
      const thead = block.querySelector('thead');
      if (thead) thead.innerHTML = `<tr>${opts.headers.map(h => `<th style="text-align:${align}">${_escHtml(h)}</th>`).join('')}</tr>`;
    }
    if (Array.isArray(opts.rows) && opts.rows.length > 0) {
      const tbody = block.querySelector('tbody');
      if (tbody) tbody.innerHTML = opts.rows.map(r =>
        `<tr>${(Array.isArray(r) ? r : [r]).map(cell => `<td style="text-align:${align}">${_escHtml(cell)}</td>`).join('')}</tr>`
      ).join('');
    }
    // 정렬 일괄 (기존 셀에도)
    if (opts.cellAlign) block.querySelectorAll('td, th').forEach(c => { c.style.textAlign = opts.cellAlign; });
  };
  if (_insertToFlowFrame(() => {
    const { row, block } = makeTableBlock();
    applyData(block);
    return { row, block };
  })) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeTableBlock();
  applyData(block);
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

  // 위치 지정: opts.beforeId / opts.afterId 우선, 없으면 selected → 끝
  let placed = false;
  if (opts.beforeId) {
    const ref = document.getElementById(opts.beforeId);
    if (ref && ref.classList.contains('section-block')) { ref.before(sec); placed = true; }
  }
  if (!placed && opts.afterId) {
    const ref = document.getElementById(opts.afterId);
    if (ref && ref.classList.contains('section-block')) { ref.after(sec); placed = true; }
  }
  if (!placed) {
    const selectedSec = document.querySelector('.section-block.selected');
    if (selectedSec) selectedSec.after(sec);
    else canvas.appendChild(sec);
  }

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

/* ── Wrap selected blocks into a new free-placement Frame (옵션: 그룹) ── */
function _nextGroupName() {
  const n = document.querySelectorAll('.frame-block[data-group="true"]').length + 1;
  return `Group ${n}`;
}
function wrapSelectedBlocksInFrame(opts = {}) {
  const asGroup = opts.asGroup === true;
  // 그룹은 freeLayout 절대블록 전부 대상 (joker/shape/vector/frame-block 서브섹션·중첩그룹 포함)
  const BLOCK_SEL = '.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .joker-block, .shape-block, .vector-block, .canvas-block, .banner02-block, .comparison-block, .mockup-block, .chat-block, .laurel-block, .step-block, .frame-block';
  let selected = [...document.querySelectorAll(
    BLOCK_SEL.split(',').map(s => s.trim() + '.selected').join(', ')
  )];
  // text-frame 래퍼는 그룹 대상이 아님 (안의 text-block이 실제 선택 단위)
  selected = selected.filter(el => el.dataset?.textFrame !== 'true');
  // 다른 선택 항목을 포함하는 컨테이너(드릴인된 부모 프레임/그룹)는 제외 — 리프 선택만 그룹화
  selected = selected.filter(el => !selected.some(o => o !== el && el.contains(o)));
  if (selected.length < 1) {
    if (window.showToast) window.showToast(asGroup ? '그룹으로 묶을 블록을 먼저 선택하세요.' : '프레임으로 묶을 블록을 먼저 선택하세요.');
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
    if (asGroup) { ss.dataset.group = 'true'; ss.dataset.name = _nextGroupName(); }
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
  if (asGroup) { ss.dataset.group = 'true'; ss.dataset.name = _nextGroupName(); }

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
// ── 분리된 블록 모듈(canvas/iconify/mockup/step/banner/chat/laurel/sticker/vector)에서
//    free-layout frame 안 삽입 처리할 때 사용. block-factory 내부 헬퍼 노출.
window._insertToFlowFrame = _insertToFlowFrame;
window._makeTextFrame     = _makeTextFrame;
window.applyTextOpts      = applyTextOpts;
window.makeJokerBlock       = makeJokerBlock;
window.addJokerBlock        = addJokerBlock;
window.makeShapeBlock       = makeShapeBlock;
window.addShapeBlock        = addShapeBlock;
window.makeAnnotationBlock  = makeAnnotationBlock;
window.makeSpeechBubbleBlock = makeSpeechBubbleBlock;
window.addSpeechBubbleBlock  = addSpeechBubbleBlock;


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

    // 에셋 블록일 때만 "스크래치로 보내기" 노출
    const sendItem = document.getElementById('bcm-send-to-scratch');
    if (sendItem) {
      const isAsset = block.classList.contains('asset-block');
      const hasImg = !!(block.querySelector('.asset-img')?.src || block.dataset?.imgSrc);
      sendItem.style.display = (isAsset && hasImg) ? 'flex' : 'none';
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

  document.getElementById('bcm-send-to-scratch')?.addEventListener('click', async e => {
    e.stopPropagation();
    const block = _targetBlock;
    closeMenu();
    if (!block) return;
    const src = block.querySelector('.asset-img')?.src || block.dataset?.imgSrc;
    if (!src) { window.showToast?.('⚠️ 이미지 없음'); return; }
    try {
      await window._scratchAddAndSave?.(src, 40, 40, 400);
      window.showToast?.('📋 스크래치로 보냄');
    } catch (err) {
      window.showToast?.('❌ 실패: ' + (err?.message || err));
    }
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

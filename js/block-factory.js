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
  tb.style.setProperty('--tbl-hline-w', '1px'); // 수평선 두께 (showHLines=true 시 사용)
  tb.style.setProperty('--tbl-vline-w', '1px'); // 수직선 두께 (showVLines=true 시 사용)
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
  // 방금 추가한 블록을 자동 선택 + 화면 안으로 스크롤 (섹션을 다시 선택하면
  // selectSection→deselectAll로 새 블록 선택이 풀리고 스크롤도 안 일어남)
  try { window.selectBlock?.(block.id); } catch (_) {}
  tf.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  // 방금 추가한 블록을 자동 선택 + 화면 안으로 스크롤 (selectSection→deselectAll로
  // 새 블록 선택이 풀리고 스크롤도 안 일어남 — A1 패턴과 동일)
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  // 방금 추가한 블록을 자동 선택 + 화면 안으로 스크롤 (A1 패턴과 동일)
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  // 방금 추가한 블록을 자동 선택 + 화면 안으로 스크롤 (A1 패턴과 동일)
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

  // sourceScratchIds — PM이 add_section/build_basic_section 호출 시 자동 출처 기록.
  // dataset.memo 에 "출처: sp_xxx, sp_yyy" 한 줄로 기록 (이미 메모가 있으면 append).
  if (Array.isArray(opts.sourceScratchIds) && opts.sourceScratchIds.length) {
    const safeIds = opts.sourceScratchIds
      .filter(id => typeof id === 'string' && /^sp_[A-Za-z0-9_-]+$/.test(id));
    if (safeIds.length) {
      const line = `출처: ${safeIds.join(', ')}`;
      if (typeof window.appendSectionMemoLine === 'function') {
        window.appendSectionMemoLine(sec, line);
      } else {
        // section-memo.js 미로드 폴백 (구버전 호환)
        sec.dataset.memo = (sec.dataset.memo ? sec.dataset.memo + '\n' : '') + line;
      }
    }
  }

  if (opts.skipDefaultBlock) {
    // 기본 h2+asset 블록 없이 빈 섹션 생성 (API 자동화용)
    const gapH = opts.paddingY !== undefined ? opts.paddingY : 100;
    sec.innerHTML = `
      <div class="section-hitzone"><span class="section-label">${secLabel}</span></div>
      <div class="section-toolbar">
        <button class="st-btn st-branch-btn" onclick="openSectionBranchMenu(this)" title="feature 브랜치로 실험">⎇</button>
        <button class="st-btn st-ai-fill-btn" onclick="openAIFillUI(this)" title="AI로 섹션 텍스트 채우기"><svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M6 1.2 L7 4.6 L10.4 5.6 L7 6.6 L6 10 L5 6.6 L1.6 5.6 L5 4.6 Z"/><path d="M10 1.2 L10 2.8 M9.2 2 L10.8 2"/></svg></button>
        <button class="st-btn st-memo-btn" onclick="window.toggleSectionMemoPopover(this)" title="섹션 메모"><svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M7.4 1.5 H3 A1 1 0 0 0 2 2.5 V9.5 A1 1 0 0 0 3 10.5 H9 A1 1 0 0 0 10 9.5 V4.1"/><path d="M8.2 1.3 L10.7 3.8 L7.2 7.3 L5.6 7.7 L6 6.1 Z"/></svg></button>
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
        <button class="st-btn st-ai-fill-btn" onclick="openAIFillUI(this)" title="AI로 섹션 텍스트 채우기"><svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M6 1.2 L7 4.6 L10.4 5.6 L7 6.6 L6 10 L5 6.6 L1.6 5.6 L5 4.6 Z"/><path d="M10 1.2 L10 2.8 M9.2 2 L10.8 2"/></svg></button>
        <button class="st-btn st-memo-btn" onclick="window.toggleSectionMemoPopover(this)" title="섹션 메모"><svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M7.4 1.5 H3 A1 1 0 0 0 2 2.5 V9.5 A1 1 0 0 0 3 10.5 H9 A1 1 0 0 0 10 9.5 V4.1"/><path d="M8.2 1.3 L10.7 3.8 L7.2 7.3 L5.6 7.7 L6 6.1 Z"/></svg></button>
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

  // 히스토리 스냅샷은 새 섹션 삽입 '前' 캔버스를 캡처해야 한다 (push-before 관용구).
  // deleteSection이 sec.remove() 前에 pushHistory하는 것과 대칭 — 첫 ⌘Z 1회로 삭제 복원.
  // (ghost 섹션은 위에서 이미 제거됐고, 신규 sec은 아직 DOM에 안 붙어 스냅샷에서 빠짐)
  window.pushHistory();

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
  sec.addEventListener('click', e => {
    e.stopPropagation();
    window.selectSectionWithModifier(sec, e);
    const row = e.target.closest('.row');
    if (row && !e.target.closest('.text-block, .asset-block, .gap-block, .col-placeholder, .icon-circle-block, .table-block, .graph-block, .divider-block, .label-group-block, .icon-text-block')) {
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
  sec.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .graph-block, .divider-block, .icon-text-block, .shape-block, .vector-block, .step-block, .chat-block, .laurel-block').forEach(b => bindBlock(b));
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
  const BLOCK_SEL = '.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .graph-block, .divider-block, .icon-text-block, .joker-block, .shape-block, .vector-block, .canvas-block, .banner02-block, .comparison-block, .mockup-block, .chat-block, .laurel-block, .step-block, .frame-block';
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

// ── Annotation Block → js/blocks/annotation-block.js 로 분리 (2026-06-14, block-factory 책임 분해) ──

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
      // 새로 만든 도형 프레임을 화면 안으로 스크롤 (섹션 레벨 추가 시 폴드 밖 방지)
      ss.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  window.bindFrameDropZone?.(ss);
  window.buildLayerPanel();
  window._activeFrame = ss;
  window.showFrameProperties?.(ss);
}

// ── New Grid Block ── [봉인됨 2026-06-08]
// 봉인 이유: img2/img3 multi-col preset은 canvas-block(cvb_)로 통합. 옛 .row+.col 경로는 좀비 동작.
// 봉인 후 호출 시 명시적 경고 + canvas-block 대체 안내. 함수 정의는 save-load 마이그레이션이 참조할 수 있어 보존.
// PM/MCP 등록 금지 — update_new_grid_block 같은 도구를 만들지 말 것.
//
// 원래 시그니처 (참고용 — 호출 X):
//   addNewGridBlock(cols, rows, opts)
//     cols: 열 수 (기본 2) / rows: 행 수 (기본 1)
//     opts: { gap: 16, cellHeight: auto, ratios: [1,1,...], bg: '' }
function addNewGridBlock(/* cols, rows, opts */) {
  // [SEALED 2026-06-08] 호출 차단 — multi-col 이미지 비교는 canvas-block(addCanvasBlock)으로 대체.
  // 원본 구현은 git history(v2025-06-08 이전 commit)에서 참조 가능. PM/MCP 등록 금지.
  console.warn('[sealed] addNewGridBlock is deprecated since 2026-06-08. Use addCanvasBlock for multi-image grid.');
  if (typeof window.showToast === 'function') {
    window.showToast('NewGrid는 봉인된 컴포넌트입니다. Canvas 블록을 사용하세요.');
  }
  return null;
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

// ─── update* functions for secondary blocks (MCP partial update entry points) ────────
// divider / asset / table / icon-circle / graph / gap / speech-bubble / label-group / shape / icon-text

// ─── updateDividerBlock — divider 블록 부분 수정 (id 기반) ──────────────────
// banner02 패턴 미러. before snapshot + pushHistory + applied 추적 + applyDividerStyle + autosave.
// 지원 필드 (data-* 매핑):
//   - lineColor  (color)        → dataset.lineColor
//   - lineStyle  (enum)         → dataset.lineStyle  (solid|dashed|dotted)
//   - lineWeight (int 1~24)     → dataset.lineWeight
//   - padV       (int 0~120)    → dataset.padV
//   - padH       (int 0~2000)    → dataset.padH
//   - lineDir    (enum)         → dataset.lineDir    (horizontal|vertical)
//   - lineLength (int 20~400)   → dataset.lineLength  (vertical일 때만 시각 영향)
function updateDividerBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('divider-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `divider-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial empty — provide at least one field' };
  }

  // before 스냅샷 (mutate 전, undo 푸시 전)
  const before = {
    lineColor:  block.dataset.lineColor,
    lineStyle:  block.dataset.lineStyle,
    lineWeight: block.dataset.lineWeight,
    padV:       block.dataset.padV,
    padH:       block.dataset.padH,
    lineDir:    block.dataset.lineDir,
    lineLength: block.dataset.lineLength,
  };

  window.pushHistory?.();

  const applied = {};

  // ── helpers ──
  const _setInt = (datasetKey, value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    if (min !== undefined && n < min) return false;
    if (max !== undefined && n > max) return false;
    block.dataset[datasetKey] = String(Math.trunc(n));
    return true;
  };
  const _COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;
  const _isValidColor = (v) => {
    if (typeof v !== 'string') return false;
    const s = v.trim();
    if (!s || s.length > 64) return false;
    return s === 'transparent' || _COLOR_RE.test(s);
  };

  // 1) lineColor
  if (partial.lineColor !== undefined && partial.lineColor !== null) {
    if (!_isValidColor(partial.lineColor)) {
      return { ok: false, code: 'INVALID', message: `invalid lineColor: ${partial.lineColor}` };
    }
    block.dataset.lineColor = String(partial.lineColor).trim();
    applied.lineColor = block.dataset.lineColor;
  }

  // 2) lineStyle
  if (partial.lineStyle !== undefined && partial.lineStyle !== null) {
    if (!['solid', 'dashed', 'dotted'].includes(partial.lineStyle)) {
      return { ok: false, code: 'INVALID', message: `invalid lineStyle: ${partial.lineStyle}` };
    }
    block.dataset.lineStyle = partial.lineStyle;
    applied.lineStyle = partial.lineStyle;
  }

  // 3) lineWeight (1~24)
  if (partial.lineWeight !== undefined && partial.lineWeight !== null) {
    if (!_setInt('lineWeight', partial.lineWeight, 1, 24)) {
      return { ok: false, code: 'INVALID', message: `invalid lineWeight: ${partial.lineWeight} (1~24)` };
    }
    applied.lineWeight = Number(block.dataset.lineWeight);
  }

  // 4) padV (0~120)
  if (partial.padV !== undefined && partial.padV !== null) {
    if (!_setInt('padV', partial.padV, 0, 120)) {
      return { ok: false, code: 'INVALID', message: `invalid padV: ${partial.padV} (0~120)` };
    }
    applied.padV = Number(block.dataset.padV);
  }

  // 5) padH (0~2000)
  if (partial.padH !== undefined && partial.padH !== null) {
    if (!_setInt('padH', partial.padH, 0, 2000)) {
      return { ok: false, code: 'INVALID', message: `invalid padH: ${partial.padH} (0~2000)` };
    }
    applied.padH = Number(block.dataset.padH);
  }

  // 6) lineDir
  if (partial.lineDir !== undefined && partial.lineDir !== null) {
    if (!['horizontal', 'vertical'].includes(partial.lineDir)) {
      return { ok: false, code: 'INVALID', message: `invalid lineDir: ${partial.lineDir}` };
    }
    block.dataset.lineDir = partial.lineDir;
    applied.lineDir = partial.lineDir;
  }

  // 7) lineLength (20~400) — dataset에는 항상 저장, 시각 효과는 lineDir=vertical일 때만
  if (partial.lineLength !== undefined && partial.lineLength !== null) {
    if (!_setInt('lineLength', partial.lineLength, 20, 400)) {
      return { ok: false, code: 'INVALID', message: `invalid lineLength: ${partial.lineLength} (20~400)` };
    }
    applied.lineLength = Number(block.dataset.lineLength);
  }

  // 8) 실 스타일 반영 (필수)
  try {
    if (typeof window.applyDividerStyle === 'function') {
      window.applyDividerStyle(block);
    }
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  // 9) 우측 패널 갱신 (선택 상태일 때만)
  if (block.classList.contains('selected')) {
    try { window.showDividerProperties?.(block); } catch (_) {}
  }
  // 10) 레이어 패널 (이름 변경 가능성 대비)
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

// ── 수정 (update_asset_block MCP 진입점) ───────────────────────────────────
// PM의 update_asset_block(MCP) → main(_invokeRendererUpdateAssetBlock) → 여기.
// banner02/mockup/card/step 패턴 미러링: pushHistory + before snapshot + applied 추적 + autosave.
// asset-block은 renderer 함수가 따로 없고 inline style + dataset + 자식(.asset-img/.asset-overlay) 직접 조작 구조.
// 지원 필드:
//   - 크기/모양: width(px 또는 860+=full bleed), height(px), borderRadius(px)
//   - 정렬/패딩: align(left|center|right) + style.alignSelf 동기, usePadx(true|false) — 음수 margin + width calc
//   - 이미지: fit(cover|contain) — img.style.objectFit 동기, imgSrc(""=clear, setAssetImageFromSrc 사용)
//   - 배경: bgColor("" reset; hex/rgb/rgba/hsl/transparent 허용)
//   - 오버레이: overlay(true|false), overlayOpacity(0~100 → rgba 알파), overlayPosition(flex-start|center|flex-end)
//   - preset: 'logo' (200x64 강제 + usePadx 무시), 'none' (dataset.preset delete)
//   - layerName: 80자
function updateAssetBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('asset-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `asset-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial empty — provide at least one field' };
  }

  // ── 색상 정규식 (banner02/comparison 패턴 동일) ──
  const COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;
  const _isValidColor = (v) => {
    if (typeof v !== 'string') return false;
    const s = v.trim();
    if (s.length === 0 || s.length > 64) return false;
    return s === 'transparent' || COLOR_RE.test(s);
  };

  // ── before 스냅샷 (mutate/pushHistory 전) ──
  const before = {
    width: block.style.width || '',
    height: block.style.height || '',
    borderRadius: block.style.borderRadius || '',
    backgroundColor: block.style.backgroundColor || '',
    align: block.dataset.align || '',
    usePadx: block.dataset.usePadx || '',
    fit: block.dataset.fit || '',
    bgColor: block.dataset.bgColor || '',
    overlay: block.dataset.overlay || '',
    preset: block.dataset.preset || '',
    baseHeight: block.dataset.baseHeight || '',
    layerName: block.dataset.layerName || '',
    imgSrc: block.dataset.imgSrc || '',
  };

  window.pushHistory?.();

  const applied = {};

  // ── 헬퍼 ──
  const _enum = (key, allowed) => {
    if (!allowed.includes(partial[key])) {
      return { ok: false, code: 'INVALID', message: `invalid ${key}: ${partial[key]}. allowed: ${allowed.join('|')}` };
    }
    return null;
  };
  const _intRange = (key, min, max) => {
    const n = Number(partial[key]);
    if (!Number.isFinite(n)) return { ok: false, code: 'INVALID', message: `${key} must be number` };
    if (n < min || n > max) return { ok: false, code: 'INVALID', message: `${key} out of range [${min},${max}]` };
    return { value: Math.round(n) };
  };

  // section-inner padX 산출 (usePadx 적용 시 음수 margin 폭 계산용)
  const _resolvePadX = () => {
    const inner = block.closest('.section-inner');
    const hasOverride = inner && inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined;
    const globalPx = (window.state?.pageSettings?.padX) || 0;
    if (inner && hasOverride) {
      const n = parseInt(inner.dataset.paddingX);
      return Number.isFinite(n) ? n : globalPx;
    }
    return globalPx;
  };

  // ── 1) preset (다른 width/height에 영향 주므로 먼저 처리) ──
  // 'logo' → 200x64 강제 + width opt 무시 + usePadx 무시 (inline margin 제거)
  // 'none' → dataset.preset delete
  if (partial.preset !== undefined && partial.preset !== null) {
    const err = _enum('preset', ['logo', 'none']);
    if (err) return err;
    if (partial.preset === 'logo') {
      block.dataset.preset = 'logo';
      block.style.width = '200px';
      block.style.height = '64px';
      block.style.marginLeft = '';
      block.style.marginRight = '';
      block.dataset.baseHeight = '64';
      applied.preset = 'logo';
      applied.width = 200;
      applied.height = 64;
    } else {
      delete block.dataset.preset;
      applied.preset = 'none';
    }
  }

  // ── 2) width (logo preset이면 무시 — preset이 이미 width 강제 처리) ──
  if (partial.width !== undefined && partial.width !== null && block.dataset.preset !== 'logo') {
    const r = _intRange('width', 100, 860);
    if (r.ok === false) return r;
    if (r.value >= 860) {
      // full bleed — inline width 제거
      block.style.width = '';
    } else {
      block.style.width = r.value + 'px';
      // align에 맞춰 alignSelf 재정렬 (prop-asset의 applyW 패턴)
      const a = block.dataset.align || 'center';
      block.style.alignSelf = a === 'left' ? 'flex-start' : a === 'right' ? 'flex-end' : 'center';
    }
    applied.width = r.value;
  }

  // ── 3) height (logo preset이면 무시) ──
  if (partial.height !== undefined && partial.height !== null && block.dataset.preset !== 'logo') {
    const r = _intRange('height', 200, 1600);
    if (r.ok === false) return r;
    block.style.height = r.value + 'px';
    block.dataset.baseHeight = String(r.value); // padX 비례 계산 기준 동기
    applied.height = r.value;
    applied.baseHeight = r.value;
  }

  // ── 4) borderRadius ──
  if (partial.borderRadius !== undefined && partial.borderRadius !== null) {
    const r = _intRange('borderRadius', 0, 120);
    if (r.ok === false) return r;
    block.style.borderRadius = r.value + 'px';
    applied.borderRadius = r.value;
  }

  // ── 5) align (dataset + style.alignSelf 동기) ──
  if (partial.align !== undefined && partial.align !== null) {
    const err = _enum('align', ['left', 'center', 'right']);
    if (err) return err;
    block.dataset.align = partial.align;
    block.style.alignSelf = partial.align === 'left' ? 'flex-start'
      : partial.align === 'right' ? 'flex-end' : 'center';
    applied.align = partial.align;
  }

  // ── 6) usePadx (음수 margin + width calc 자동 적용; logo preset이면 무시) ──
  if (partial.usePadx !== undefined && partial.usePadx !== null && block.dataset.preset !== 'logo') {
    const err = _enum('usePadx', ['true', 'false']);
    if (err) return err;
    block.dataset.usePadx = partial.usePadx;
    const padX = _resolvePadX();
    if (partial.usePadx === 'true' && padX > 0) {
      block.style.marginLeft = -padX + 'px';
      block.style.marginRight = -padX + 'px';
      block.style.width = `calc(100% + ${padX * 2}px)`;
    } else {
      block.style.marginLeft = '';
      block.style.marginRight = '';
      // partial.width로 명시 지정된 경우엔 유지, 그 외엔 초기화
      if (partial.width === undefined || partial.width === null) {
        block.style.width = '';
      }
    }
    applied.usePadx = partial.usePadx;
  }

  // ── 7) bgColor (placeholder 배경; "" = reset) ──
  if (partial.bgColor !== undefined && partial.bgColor !== null) {
    if (partial.bgColor === '') {
      delete block.dataset.bgColor;
      block.style.backgroundColor = '';
      applied.bgColor = '';
    } else {
      if (!_isValidColor(partial.bgColor)) {
        return { ok: false, code: 'INVALID', message: `invalid bgColor: ${partial.bgColor} (allowed: #hex | rgb(a)/hsl(a)() | transparent)` };
      }
      const c = String(partial.bgColor).trim();
      block.dataset.bgColor = c;
      block.style.backgroundColor = c;
      applied.bgColor = c;
    }
  }

  // ── 8) imgSrc — setAssetImageFromSrc / clearAssetImage 사용 ──
  // "" 빈문자열 = 이미지 해제 (.has-image 클래스도 제거)
  // 외부 헬퍼 부재 시 dataset.imgSrc만 갱신 (graceful fallback)
  if (partial.imgSrc !== undefined && partial.imgSrc !== null) {
    if (typeof partial.imgSrc !== 'string') {
      return { ok: false, code: 'INVALID', message: 'imgSrc must be string' };
    }
    const src = partial.imgSrc;
    if (src.length > 200000) {
      return { ok: false, code: 'TOO_LARGE', message: 'imgSrc too long (>200000)' };
    }
    if (/["\r\n]/.test(src)) {
      return { ok: false, code: 'INVALID', message: 'imgSrc contains quote/newline (escape unsafe)' };
    }
    if (src === '') {
      if (typeof window.clearAssetImage === 'function') {
        try { window.clearAssetImage(block); } catch (e) {
          // fallback
          block.classList.remove('has-image');
          delete block.dataset.imgSrc;
        }
      } else {
        block.classList.remove('has-image');
        delete block.dataset.imgSrc;
      }
      applied.imgSrc = '';
    } else {
      if (typeof window.setAssetImageFromSrc === 'function') {
        try { window.setAssetImageFromSrc(block, src); } catch (e) {
          return { ok: false, code: 'RENDER_ERROR', message: 'setAssetImageFromSrc failed: ' + e.message };
        }
      } else {
        // fallback (full helper 부재시 최소 동작)
        block.classList.add('has-image');
        block.dataset.imgSrc = src;
      }
      applied.imgSrc = src;
    }
  }

  // ── 9) fit (img.style.objectFit + dataset.fit 동기) ──
  if (partial.fit !== undefined && partial.fit !== null) {
    const err = _enum('fit', ['cover', 'contain']);
    if (err) return err;
    block.dataset.fit = partial.fit;
    const img = block.querySelector('.asset-img');
    if (img) img.style.objectFit = partial.fit;
    applied.fit = partial.fit;
  }

  // ── 10) overlay 토글 (자식 .asset-overlay 보장 생성) ──
  if (partial.overlay !== undefined && partial.overlay !== null) {
    const err = _enum('overlay', ['true', 'false']);
    if (err) return err;
    block.dataset.overlay = partial.overlay;
    let overlayEl = block.querySelector('.asset-overlay');
    if (partial.overlay === 'true' && !overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'asset-overlay';
      block.appendChild(overlayEl);
    }
    applied.overlay = partial.overlay;
  }

  // ── 11) overlayOpacity (% → rgba) ──
  if (partial.overlayOpacity !== undefined && partial.overlayOpacity !== null) {
    const r = _intRange('overlayOpacity', 0, 100);
    if (r.ok === false) return r;
    let overlayEl = block.querySelector('.asset-overlay');
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'asset-overlay';
      block.appendChild(overlayEl);
    }
    const op = r.value / 100;
    overlayEl.style.background = `rgba(0,0,0,${op})`;
    overlayEl.dataset.ovOpacity = String(op);
    applied.overlayOpacity = r.value;
  }

  // ── 12) overlayPosition (justifyContent) ──
  if (partial.overlayPosition !== undefined && partial.overlayPosition !== null) {
    const err = _enum('overlayPosition', ['flex-start', 'center', 'flex-end']);
    if (err) return err;
    let overlayEl = block.querySelector('.asset-overlay');
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'asset-overlay';
      block.appendChild(overlayEl);
    }
    overlayEl.style.justifyContent = partial.overlayPosition;
    applied.overlayPosition = partial.overlayPosition;
  }

  // ── 13) layerName ──
  if (partial.layerName !== undefined && partial.layerName !== null) {
    if (typeof partial.layerName !== 'string') {
      return { ok: false, code: 'INVALID', message: 'layerName must be string' };
    }
    if ([...partial.layerName].length > 80) {
      return { ok: false, code: 'INVALID', message: 'layerName too long (>80)' };
    }
    block.dataset.layerName = partial.layerName;
    applied.layerName = partial.layerName;
  }

  // ── 14) 우측 패널 갱신 (선택 상태일 때만) ──
  if (block.classList.contains('selected')) {
    try { window.showAssetProperties?.(block); } catch (_) {}
  }
  // 15) 레이어 패널 (layerName 변경 가능성 대비)
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

// ─── table 헤더 병합(merge) 헬퍼 ──────────────────────────────────────────
// dataset.mergedHeaderCols = JSON string. shape: [[startColIdx, span], ...]
// (0-base logical column index, span>=2, 정렬·범위·겹침 검증 통과한 정규형)
//
// _parseMergedHeaderCols: dataset 문자열 → 배열. 깨졌으면 [] 리턴 (안전 fallback).
function _parseMergedHeaderCols(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) raw = JSON.stringify(raw);
  if (typeof raw !== 'string') return [];
  let arr;
  try { arr = JSON.parse(raw); } catch (_) { return []; }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const it of arr) {
    if (!Array.isArray(it) || it.length < 2) continue;
    const s = Number(it[0]), n = Number(it[1]);
    if (!Number.isInteger(s) || !Number.isInteger(n)) continue;
    if (s < 0 || n < 2) continue;
    out.push([s, n]);
  }
  return out;
}

// _normalizeMergedHeaderCols(merges, colCount)
//   → { ok:true, normalized:[[s,n],...], serialized: string }
//   → { ok:false, message }
// 정렬(start 오름차순) + 범위 검사(s+n<=colCount) + 겹침 검사.
function _normalizeMergedHeaderCols(merges, colCount) {
  if (!Array.isArray(merges)) return { ok: false, message: 'mergedHeaderCols must be array' };
  if (merges.length === 0) return { ok: true, normalized: [], serialized: '[]' };
  if (!Number.isInteger(colCount) || colCount <= 0) {
    return { ok: false, message: 'cannot validate mergedHeaderCols without colCount' };
  }
  const norm = [];
  for (let i = 0; i < merges.length; i++) {
    const it = merges[i];
    if (!Array.isArray(it) || it.length < 2) {
      return { ok: false, message: `mergedHeaderCols[${i}] must be [start, span]` };
    }
    const s = Number(it[0]), n = Number(it[1]);
    if (!Number.isInteger(s) || !Number.isInteger(n)) {
      return { ok: false, message: `mergedHeaderCols[${i}] start/span must be integer` };
    }
    if (n < 2) continue; // span<2는 무시 (병합 아님)
    if (s < 0 || s + n > colCount) {
      return { ok: false, message: `mergedHeaderCols[${i}] out of range (start=${s}, span=${n}, colCount=${colCount})` };
    }
    norm.push([s, n]);
  }
  norm.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < norm.length; i++) {
    if (norm[i - 1][0] + norm[i - 1][1] > norm[i][0]) {
      return { ok: false, message: `mergedHeaderCols overlap at [${norm[i - 1][0]},${norm[i - 1][1]}] vs [${norm[i][0]},${norm[i][1]}]` };
    }
  }
  return { ok: true, normalized: norm, serialized: JSON.stringify(norm) };
}

// _renderHeaderRowHTML(headers, mergedHeaderCols, alignForCells)
//   → <tr> 내용 HTML 문자열 (예: "<th colspan=2>좌측</th><th>C</th>")
// 'headers'는 '시각 셀 단위' 텍스트 배열 (병합 후 실제로 그릴 th 갯수). length는 colCount - sum(span-1).
// 단순 갯수 일치 가정(헤더 갯수 == 시각 th 갯수). 부족하면 빈 문자열로 패딩, 넘치면 자름.
function _renderHeaderRowHTML(headers, mergedHeaderCols, alignForCells) {
  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const align = alignForCells || 'center';
  // 시각 th 인덱스 → colspan map (start 기준)
  // 시각 th는 logical col 순으로 그려지되, merge에 들어간 logical col은 첫 시작 col에서만 1번 그림.
  const merges = Array.isArray(mergedHeaderCols) ? mergedHeaderCols : [];
  // logical col → merge span (없으면 1)
  const visualSequence = []; // [{logicalStart, span}]
  // logical col count는 시각 헤더 갯수 + sum(merge.span-1)로 역산. 그러나 안전을 위해 헤더 갯수 기반.
  // 시각 헤더 i번째가 어떤 logical col에서 시작하는지 계산:
  let logical = 0;
  let visualIdx = 0;
  // headers.length 만큼만 그림. merge는 정렬되어 있다고 가정.
  let mIdx = 0;
  while (visualIdx < headers.length) {
    if (mIdx < merges.length && merges[mIdx][0] === logical) {
      visualSequence.push({ logicalStart: logical, span: merges[mIdx][1] });
      logical += merges[mIdx][1];
      mIdx += 1;
    } else {
      visualSequence.push({ logicalStart: logical, span: 1 });
      logical += 1;
    }
    visualIdx += 1;
  }
  return visualSequence.map((seg, i) => {
    const text = esc(headers[i] ?? '');
    const colspanAttr = seg.span > 1 ? ` colspan="${seg.span}"` : '';
    return `<th${colspanAttr} style="text-align:${align}">${text}</th>`;
  }).join('');
}

// _migrateLegacyHeaderColspan(block)
//   thead에 colspan>1 인 th가 있고 dataset.mergedHeaderCols이 비어있으면 자동 추출하여 기록.
//   tbl_6y56fxq 류 ghost colspan 보존 목적. 부수효과: dataset.mergedHeaderCols 세팅.
function _migrateLegacyHeaderColspan(block) {
  if (!block) return;
  if (block.dataset.mergedHeaderCols && block.dataset.mergedHeaderCols !== '[]') return;
  const thead = block.querySelector('.tb-table > thead');
  if (!thead) return;
  const ths = thead.querySelectorAll('tr > th');
  if (!ths.length) return;
  const merges = [];
  let logical = 0;
  let hasAny = false;
  ths.forEach(th => {
    const cs = parseInt(th.getAttribute('colspan') || '1', 10) || 1;
    if (cs > 1) {
      merges.push([logical, cs]);
      hasAny = true;
    }
    logical += cs;
  });
  if (hasAny) {
    block.dataset.mergedHeaderCols = JSON.stringify(merges);
  }
}
// expose for save-load / hydrate 등 외부 호출 가능
try { if (typeof window !== 'undefined') {
  window.__migrateLegacyHeaderColspan = _migrateLegacyHeaderColspan;
  window.__parseMergedHeaderCols = _parseMergedHeaderCols;
  window.__normalizeMergedHeaderCols = _normalizeMergedHeaderCols;
  window.__renderHeaderRowHTML = _renderHeaderRowHTML;
} } catch (_) {}

// ─── updateTableBlock ─────────────────────────────────────────────────────
// PM의 update_table_block(MCP) → main(_invokeRendererUpdateTableBlock) → 여기.
// banner02-block 패턴 미러링: pushHistory + dataset partial write + 직접 DOM 적용 + scheduleAutoSave.
function updateTableBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('table-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `table-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial is empty — provide at least one field' };
  }

  const table = block.querySelector('.tb-table');
  if (!table) return { ok: false, code: 'INVALID', message: 'no .tb-table inside block' };
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  // ── 레거시 colspan 마이그레이션 (tbl_6y56fxq 류 ghost 보존) ──
  // dataset.mergedHeaderCols가 비어 있는데 DOM에 colspan>1 th가 있으면 자동 추출.
  try { _migrateLegacyHeaderColspan(block); } catch (_) {}

  // ── 화이트리스트 / 정규식 가드 ──
  const _STYLE_ENUM = ['default', 'stripe', 'borderless', 'colored'];
  const _ALIGN_ENUM = ['left', 'center', 'right'];
  const _FONT_FAMILY_ENUM = [
    '',
    "'Pretendard', sans-serif",
    "'Noto Sans KR', sans-serif",
    "'Spoqa Han Sans Neo', sans-serif",
    "'Inter', sans-serif",
    "'Roboto', sans-serif",
    "'Helvetica Neue', sans-serif",
    'Georgia, serif',
    "'Times New Roman', serif",
    'monospace',
  ];
  const _COLOR_RE = /^(#[0-9a-fA-F]{3,8}|transparent)$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;
  const _isColor = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64 && _COLOR_RE.test(v.trim());
  const _escHtml = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ── before 스냅샷 ──
  // logical col count 계산: 우선순위 (1) tbody 첫 row의 td 갯수 (가장 신뢰)
  // (2) thead 첫 row의 th 갯수 + colspan sum (병합 보정)
  // (3) table의 첫 tr.
  const _logicalColCountFromTr = (tr) => {
    if (!tr) return 0;
    let n = 0;
    tr.querySelectorAll('th,td').forEach(c => {
      const cs = parseInt(c.getAttribute('colspan') || '1', 10) || 1;
      n += cs;
    });
    return n;
  };
  const _currentColCount = () => {
    const bodyTr = tbody?.querySelector('tr');
    if (bodyTr) return bodyTr.querySelectorAll('th,td').length; // tbody는 colspan 없다고 가정 (v1)
    const headTr = thead?.querySelector('tr');
    if (headTr) return _logicalColCountFromTr(headTr);
    const tr = table.querySelector('tr');
    return _logicalColCountFromTr(tr);
  };
  const beforeColCount = _currentColCount();
  const before = {
    style: block.dataset.style,
    cellAlign: block.dataset.cellAlign,
    cellPad: block.dataset.cellPad,
    showHeader: block.dataset.showHeader,
    showVLines: block.dataset.showVLines,
    showHLines: block.dataset.showHLines,
    showOuterX: block.dataset.showOuterX,
    showOuterY: block.dataset.showOuterY,
    outerWidth: block.dataset.outerWidth,
    rowH: block.dataset.rowH,
    tablePadX: block.dataset.tablePadX,
    lineColor: block.dataset.lineColor,
    headerBg: block.dataset.headerBg,
    textColor: block.dataset.textColor,
    fontFamily: block.dataset.fontFamily,
    fontSize: table.style.fontSize || '',
    colWidths: block.dataset.colWidths,
    colBgs: block.dataset.colBgs,
    colFgs: block.dataset.colFgs,
    mergedHeaderCols: block.dataset.mergedHeaderCols,
    colCount: beforeColCount,
  };

  window.pushHistory?.();

  const applied = {};

  // ── 1) 데이터: headers + rows + mergedHeaderCols ──
  let newColCount = beforeColCount;
  let headersTouched = false;
  let rowsTouched = false;
  let mergedHeaderColsTouched = false;
  let newHeaders = null;
  let newRows = null;
  // mergedHeaderCols (정규형 배열). null = 미지정. [] = explicit clear.
  let newMergedHeaderCols = null;

  // partial.mergedHeaderCols는 (a) 배열 [[s,n],...] (b) JSON 문자열 (c) null/"" (clear) 모두 수용.
  if (partial.mergedHeaderCols !== undefined) {
    let raw = partial.mergedHeaderCols;
    if (raw === null || raw === '') {
      newMergedHeaderCols = [];
    } else if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); }
      catch (e) { return { ok: false, code: 'INVALID', message: `mergedHeaderCols JSON parse failed: ${e.message}` }; }
      if (!Array.isArray(raw)) return { ok: false, code: 'INVALID', message: 'mergedHeaderCols must parse to array' };
      newMergedHeaderCols = raw;
    } else if (Array.isArray(raw)) {
      newMergedHeaderCols = raw;
    } else {
      return { ok: false, code: 'INVALID', message: 'mergedHeaderCols must be array or JSON string or null' };
    }
    mergedHeaderColsTouched = true;
  }

  if (partial.headers !== undefined) {
    if (!Array.isArray(partial.headers)) {
      return { ok: false, code: 'INVALID', message: 'headers must be array of strings' };
    }
    if (partial.headers.length === 0) {
      return { ok: false, code: 'INVALID', message: 'headers must have at least 1 item' };
    }
    if (partial.headers.length > 32) {
      return { ok: false, code: 'INVALID', message: 'headers too many (>32)' };
    }
    for (let i = 0; i < partial.headers.length; i++) {
      if (typeof partial.headers[i] !== 'string') {
        return { ok: false, code: 'INVALID', message: `headers[${i}] must be string` };
      }
      if (partial.headers[i].length > 2000) {
        return { ok: false, code: 'INVALID', message: `headers[${i}] too long (>2000)` };
      }
    }
    newHeaders = partial.headers.slice();
    // headers의 length는 시각 th 갯수. logical colCount는 merges가 같이 제공된 경우 +span-1 합산.
    const effectiveMerges = mergedHeaderColsTouched
      ? newMergedHeaderCols
      : _parseMergedHeaderCols(block.dataset.mergedHeaderCols);
    const validMerges = (effectiveMerges || []).filter(m => Array.isArray(m) && Number(m[1]) >= 2);
    const spanExtra = validMerges.reduce((acc, m) => acc + (Number(m[1]) - 1), 0);
    newColCount = newHeaders.length + spanExtra;
    headersTouched = true;
  }

  if (partial.rows !== undefined) {
    if (!Array.isArray(partial.rows)) {
      return { ok: false, code: 'INVALID', message: 'rows must be array of arrays' };
    }
    if (partial.rows.length > 500) {
      return { ok: false, code: 'INVALID', message: 'rows too many (>500)' };
    }
    const expectedCols = headersTouched ? newColCount : beforeColCount;
    if (!expectedCols) {
      return { ok: false, code: 'INVALID', message: 'cannot determine column count for rows update' };
    }
    for (let i = 0; i < partial.rows.length; i++) {
      const r = partial.rows[i];
      if (!Array.isArray(r)) {
        return { ok: false, code: 'INVALID', message: `rows[${i}] must be array` };
      }
      if (r.length !== expectedCols) {
        return { ok: false, code: 'INVALID', message: `rows[${i}].length (${r.length}) != cols (${expectedCols})` };
      }
      for (let j = 0; j < r.length; j++) {
        if (typeof r[j] !== 'string') {
          return { ok: false, code: 'INVALID', message: `rows[${i}][${j}] must be string` };
        }
        if (r[j].length > 2000) {
          return { ok: false, code: 'INVALID', message: `rows[${i}][${j}] too long (>2000)` };
        }
      }
    }
    newRows = partial.rows.map(r => r.slice());
    rowsTouched = true;
  }

  // ── 1-b) mergedHeaderCols 정규화/검증 ──
  // colCount 기준: headersTouched 면 newColCount, 아니면 beforeColCount.
  // headersTouched=false + mergedHeaderColsTouched=true 인 경우 = 헤더 그대로 두고 병합만 바꾸려는 의도.
  // 이 때 시각 th 갯수가 기존 thead의 시각 th 갯수(_visualThCount)와 맞는지 후속 render에서 안전 처리.
  let normalizedMergedHeaderCols = null;
  let normalizedMergedHeaderColsSerialized = null;
  if (mergedHeaderColsTouched) {
    const colCountForMerge = headersTouched ? newColCount : beforeColCount;
    const r = _normalizeMergedHeaderCols(newMergedHeaderCols, colCountForMerge);
    if (!r.ok) {
      return { ok: false, code: 'INVALID', message: r.message };
    }
    normalizedMergedHeaderCols = r.normalized;
    normalizedMergedHeaderColsSerialized = r.serialized;
  }

  // ── 2) dataset 스칼라 검증/세팅 ──
  if (partial.style !== undefined) {
    if (!_STYLE_ENUM.includes(partial.style)) {
      return { ok: false, code: 'INVALID', message: `invalid style: ${partial.style}. allowed: ${_STYLE_ENUM.join('|')}` };
    }
    block.dataset.style = partial.style;
    applied.style = partial.style;
  }

  if (partial.cellAlign !== undefined) {
    if (!_ALIGN_ENUM.includes(partial.cellAlign)) {
      return { ok: false, code: 'INVALID', message: `invalid cellAlign: ${partial.cellAlign}` };
    }
    block.dataset.cellAlign = partial.cellAlign;
    applied.cellAlign = partial.cellAlign;
  }

  if (partial.cellPad !== undefined) {
    const n = Number(partial.cellPad);
    if (!Number.isFinite(n) || n < 0 || n > 40) {
      return { ok: false, code: 'INVALID', message: `invalid cellPad: ${partial.cellPad} (0~40)` };
    }
    block.dataset.cellPad = String(n);
    applied.cellPad = n;
  }

  const _setBool = (datasetKey, value) => {
    let str;
    if (typeof value === 'boolean') str = value ? 'true' : 'false';
    else if (value === 'true' || value === 'false') str = value;
    else return { ok: false, code: 'INVALID', message: `${datasetKey} must be boolean or "true"/"false"` };
    block.dataset[datasetKey] = str;
    return { ok: true, str };
  };

  if (partial.showHeader !== undefined) {
    const r = _setBool('showHeader', partial.showHeader);
    if (!r.ok) return r;
    applied.showHeader = r.str;
  }
  if (partial.showVLines !== undefined) {
    const r = _setBool('showVLines', partial.showVLines);
    if (!r.ok) return r;
    applied.showVLines = r.str;
  }
  if (partial.showHLines !== undefined) {
    const r = _setBool('showHLines', partial.showHLines);
    if (!r.ok) return r;
    applied.showHLines = r.str;
  }
  if (partial.showOuterX !== undefined) {
    const r = _setBool('showOuterX', partial.showOuterX);
    if (!r.ok) return r;
    applied.showOuterX = r.str;
  }
  if (partial.showOuterY !== undefined) {
    const r = _setBool('showOuterY', partial.showOuterY);
    if (!r.ok) return r;
    applied.showOuterY = r.str;
  }

  if (partial.outerWidth !== undefined) {
    const n = Number(partial.outerWidth);
    if (!Number.isFinite(n) || n < 1 || n > 6) {
      return { ok: false, code: 'INVALID', message: `invalid outerWidth: ${partial.outerWidth} (1~6)` };
    }
    block.dataset.outerWidth = String(n);
    applied.outerWidth = n;
  }

  if (partial.rowH !== undefined) {
    const n = Number(partial.rowH);
    if (!Number.isFinite(n) || n < 0 || n > 160) {
      return { ok: false, code: 'INVALID', message: `invalid rowH: ${partial.rowH} (0~160)` };
    }
    block.dataset.rowH = String(n);
    applied.rowH = n;
  }

  if (partial.tablePadX !== undefined) {
    const n = Number(partial.tablePadX);
    if (!Number.isFinite(n) || n < 0 || n > 120) {
      return { ok: false, code: 'INVALID', message: `invalid tablePadX: ${partial.tablePadX} (0~120)` };
    }
    block.dataset.tablePadX = String(n);
    applied.tablePadX = n;
  }

  if (partial.lineColor !== undefined) {
    if (!_isColor(partial.lineColor)) {
      return { ok: false, code: 'INVALID', message: `invalid lineColor: ${partial.lineColor}` };
    }
    block.dataset.lineColor = partial.lineColor.trim();
    applied.lineColor = block.dataset.lineColor;
  }
  if (partial.headerBg !== undefined) {
    if (!_isColor(partial.headerBg)) {
      return { ok: false, code: 'INVALID', message: `invalid headerBg: ${partial.headerBg}` };
    }
    block.dataset.headerBg = partial.headerBg.trim();
    applied.headerBg = block.dataset.headerBg;
  }
  if (partial.textColor !== undefined) {
    if (!_isColor(partial.textColor)) {
      return { ok: false, code: 'INVALID', message: `invalid textColor: ${partial.textColor}` };
    }
    block.dataset.textColor = partial.textColor.trim();
    applied.textColor = block.dataset.textColor;
  }

  if (partial.fontFamily !== undefined) {
    if (typeof partial.fontFamily !== 'string' || !_FONT_FAMILY_ENUM.includes(partial.fontFamily)) {
      return { ok: false, code: 'INVALID', message: `invalid fontFamily: ${partial.fontFamily}` };
    }
    block.dataset.fontFamily = partial.fontFamily;
    applied.fontFamily = partial.fontFamily;
  }

  if (partial.fontSize !== undefined) {
    const n = Number(partial.fontSize);
    if (!Number.isFinite(n) || n < 12 || n > 60) {
      return { ok: false, code: 'INVALID', message: `invalid fontSize: ${partial.fontSize} (12~60)` };
    }
    applied.fontSize = n;
    block._tblNextFontSize = n;
  }

  let colWidthsTouched = false;
  if (partial.colWidths !== undefined) {
    if (typeof partial.colWidths !== 'string') {
      return { ok: false, code: 'INVALID', message: 'colWidths must be string (e.g. "1:1:2")' };
    }
    if (partial.colWidths.length > 200) {
      return { ok: false, code: 'INVALID', message: 'colWidths too long (>200)' };
    }
    block.dataset.colWidths = partial.colWidths;
    applied.colWidths = partial.colWidths;
    colWidthsTouched = true;
  }

  const _normColorList = (v, label) => {
    let arr;
    if (Array.isArray(v)) arr = v.slice();
    else if (typeof v === 'string') arr = v.split(',').map(s => s.trim()).filter(Boolean);
    else return { err: { ok: false, code: 'INVALID', message: `${label} must be array or comma-joined string` } };
    if (arr.length > 32) return { err: { ok: false, code: 'INVALID', message: `${label} too many (>32)` } };
    for (let i = 0; i < arr.length; i++) {
      if (typeof arr[i] !== 'string' || !_isColor(arr[i])) {
        return { err: { ok: false, code: 'INVALID', message: `${label}[${i}] invalid color: ${arr[i]}` } };
      }
      arr[i] = arr[i].trim();
    }
    return { arr };
  };

  let colBgsTouched = false, colFgsTouched = false;
  let nextColBgs = null, nextColFgs = null;
  if (partial.colBgs !== undefined) {
    const r = _normColorList(partial.colBgs, 'colBgs');
    if (r.err) return r.err;
    nextColBgs = r.arr;
    colBgsTouched = true;
  }
  if (partial.colFgs !== undefined) {
    const r = _normColorList(partial.colFgs, 'colFgs');
    if (r.err) return r.err;
    nextColFgs = r.arr;
    colFgsTouched = true;
  }

  // ── 3) 데이터 모델 (thead/tbody) 통째 재생성 ──
  const alignForCells = applied.cellAlign || block.dataset.cellAlign || 'center';

  // mergedHeaderCols dataset 먼저 commit (render에서 읽음)
  if (mergedHeaderColsTouched) {
    if (normalizedMergedHeaderCols && normalizedMergedHeaderCols.length > 0) {
      block.dataset.mergedHeaderCols = normalizedMergedHeaderColsSerialized;
    } else {
      // clear 의도 — dataset 자체를 제거 (저장 용량/정합성)
      delete block.dataset.mergedHeaderCols;
    }
    applied.mergedHeaderCols = normalizedMergedHeaderCols;
  }

  // 헤더 렌더링: headersTouched 면 newHeaders, 아니면 mergedHeaderColsTouched 만으로도 thead 재구성 필요.
  // 재구성 시 현재 thead의 시각 텍스트(또는 newHeaders)를 활용.
  const _activeMerges = mergedHeaderColsTouched
    ? (normalizedMergedHeaderCols || [])
    : _parseMergedHeaderCols(block.dataset.mergedHeaderCols);

  if ((headersTouched || mergedHeaderColsTouched) && thead) {
    let visualHeaders;
    if (headersTouched) {
      visualHeaders = newHeaders;
    } else {
      // 기존 시각 th의 textContent 추출 (legacy 보존)
      visualHeaders = Array.from(thead.querySelectorAll('tr > th')).map(th => th.textContent || '');
      // 만약 시각 th 갯수가 _activeMerges 적용 후 logical colCount 와 안 맞으면 패딩/자름
      const spanExtra = (_activeMerges || []).reduce((acc, m) => acc + (Number(m[1]) - 1), 0);
      const expectedVisual = Math.max(0, beforeColCount - spanExtra);
      while (visualHeaders.length < expectedVisual) visualHeaders.push('');
      if (visualHeaders.length > expectedVisual) visualHeaders.length = expectedVisual;
    }
    const innerHTML = _renderHeaderRowHTML(visualHeaders, _activeMerges, alignForCells);
    thead.innerHTML = `<tr>${innerHTML}</tr>`;
    if (headersTouched) applied.headers = newHeaders;
  }
  if (rowsTouched && tbody) {
    const html = newRows.map(r =>
      `<tr>${r.map(cell => `<td style="text-align:${alignForCells}">${_escHtml(cell)}</td>`).join('')}</tr>`
    ).join('');
    tbody.innerHTML = html;
    applied.rows = newRows;
  }

  // ── 4) 시각 적용 ──
  try {
    if (partial.showHeader !== undefined && thead) {
      thead.style.display = block.dataset.showHeader === 'false' ? 'none' : '';
    }
    if (partial.cellAlign !== undefined) {
      block.querySelectorAll('th, td').forEach(c => { c.style.textAlign = block.dataset.cellAlign; });
    }
    if (partial.cellPad !== undefined) {
      const v = parseInt(block.dataset.cellPad) || 0;
      block.querySelectorAll('th, td').forEach(c => { c.style.padding = v + 'px 16px'; });
    }
    if (partial.rowH !== undefined) {
      const v = parseInt(block.dataset.rowH) || 0;
      const h = v > 0 ? (v + 'px') : '';
      block.querySelectorAll('thead tr, tbody tr').forEach(tr => { tr.style.height = h; });
    }
    if (partial.tablePadX !== undefined) {
      const v = parseInt(block.dataset.tablePadX) || 0;
      block.style.paddingLeft = v + 'px';
      block.style.paddingRight = v + 'px';
    }
    if (partial.outerWidth !== undefined) {
      block.style.setProperty('--tbl-outer-w', (parseInt(block.dataset.outerWidth) || 1) + 'px');
    }
    if (partial.lineColor !== undefined) {
      block.style.setProperty('--tbl-line-color', block.dataset.lineColor);
    }
    if (partial.headerBg !== undefined) {
      block.style.setProperty('--tbl-header-bg', block.dataset.headerBg);
    }
    if (partial.textColor !== undefined) {
      block.style.setProperty('--tbl-text-color', block.dataset.textColor);
    }
    if (partial.fontFamily !== undefined) {
      if (block.dataset.fontFamily) block.style.setProperty('--tbl-font-family', block.dataset.fontFamily);
      else block.style.removeProperty('--tbl-font-family');
    }
    if (partial.fontSize !== undefined) {
      table.style.fontSize = (block._tblNextFontSize) + 'px';
      delete block._tblNextFontSize;
    }
    if (partial.style !== undefined) {
      if (typeof window.__applyTableColColors === 'function') {
        window.__applyTableColColors(block);
      }
    }
    if (colWidthsTouched && typeof window.__applyTableColRatio === 'function') {
      window.__applyTableColRatio(block, block.dataset.colWidths);
    }
    if (colBgsTouched || colFgsTouched) {
      if (typeof window.__applyTableColColors === 'function') {
        window.__applyTableColColors(
          block,
          colBgsTouched ? nextColBgs : undefined,
          colFgsTouched ? nextColFgs : undefined
        );
      }
      if (colBgsTouched) applied.colBgs = (block.dataset.colBgs || '');
      if (colFgsTouched) applied.colFgs = (block.dataset.colFgs || '');
    }
    if ((headersTouched || rowsTouched) && !colWidthsTouched && block.dataset.colWidths && typeof window.__applyTableColRatio === 'function') {
      window.__applyTableColRatio(block, block.dataset.colWidths);
    }
    if ((headersTouched || rowsTouched) && !(colBgsTouched || colFgsTouched) && block.dataset.style === 'colored' && typeof window.__applyTableColColors === 'function') {
      window.__applyTableColColors(block);
    }
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  // ── 5) 우측 패널 / 레이어 패널 갱신 ──
  if (block.classList.contains('selected')) {
    try { window.showTableProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

// ── updateIconCircleBlock ──────────────────────────────────────────────
// PM의 update_icon_circle_block(MCP) → main(_invokeRendererUpdateIconCircleBlock) → 여기.
function updateIconCircleBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('icon-circle-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `icon-circle-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object' || Array.isArray(partial)) {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial empty — provide at least one field' };
  }

  const circle = block.querySelector('.icb-circle');
  if (!circle) {
    return { ok: false, code: 'INVALID', message: '.icb-circle child missing' };
  }

  const before = {
    size:      block.dataset.size,
    bgColor:   block.dataset.bgColor,
    border:    block.dataset.border,
    radius:    block.dataset.radius,
    padX:      block.dataset.padX,
    imgSrc:    block.dataset.imgSrc,
    layerName: block.dataset.layerName,
    hasImage:  block.classList.contains('has-image'),
  };

  window.pushHistory?.();

  const applied = {};

  const _isColor = (v) => {
    if (typeof v !== 'string') return false;
    const s = v.trim();
    if (!s || s.length > 64) return false;
    return /^#[0-9a-fA-F]{3,8}$/.test(s)
        || /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(s)
        || s === 'transparent';
  };

  const _setNum = (datasetKey, value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (min !== undefined && n < min) return null;
    if (max !== undefined && n > max) return null;
    block.dataset[datasetKey] = String(n);
    return n;
  };

  if (partial.size !== undefined && partial.size !== null) {
    const n = _setNum('size', partial.size, 40, 860);
    if (n === null) {
      return { ok: false, code: 'INVALID', message: `size invalid (must be number in [40,860]): ${partial.size}` };
    }
    circle.style.width  = n + 'px';
    circle.style.height = n + 'px';
    applied.size = n;
  }

  if (partial.bgColor !== undefined && partial.bgColor !== null) {
    if (!_isColor(partial.bgColor)) {
      return { ok: false, code: 'INVALID', message: `bgColor invalid (allowed: #hex | rgb(a)/hsl(a)() | transparent)` };
    }
    const v = String(partial.bgColor).trim();
    block.dataset.bgColor = v;
    circle.style.backgroundColor = v;
    applied.bgColor = v;
  }

  if (partial.border !== undefined && partial.border !== null) {
    if (!['none', 'solid', 'dashed'].includes(partial.border)) {
      return { ok: false, code: 'INVALID', message: `invalid border: ${partial.border}. allowed: none|solid|dashed` };
    }
    block.dataset.border  = partial.border;
    circle.dataset.border = partial.border;
    applied.border = partial.border;
  }

  if (partial.radius !== undefined && partial.radius !== null) {
    const n = _setNum('radius', partial.radius, 0, 500);
    if (n === null) {
      return { ok: false, code: 'INVALID', message: `radius invalid (must be number in [0,500]): ${partial.radius}` };
    }
    applied.radius = n;
  }

  if (partial.padX !== undefined && partial.padX !== null) {
    const n = _setNum('padX', partial.padX, 0, 200);
    if (n === null) {
      return { ok: false, code: 'INVALID', message: `padX invalid (must be number in [0,200]): ${partial.padX}` };
    }
    block.style.paddingLeft  = n + 'px';
    block.style.paddingRight = n + 'px';
    applied.padX = n;
  }

  if (partial.imgSrc !== undefined) {
    if (partial.imgSrc === null || partial.imgSrc === '') {
      delete block.dataset.imgSrc;
      block.classList.remove('has-image');
      circle.style.backgroundImage    = '';
      circle.style.backgroundSize     = '';
      circle.style.backgroundPosition = '';
      circle.style.backgroundRepeat   = '';
      applied.imgSrc = '';
    } else {
      if (typeof partial.imgSrc !== 'string') {
        return { ok: false, code: 'INVALID', message: 'imgSrc must be string' };
      }
      const src = partial.imgSrc;
      if (src.length > 200000) {
        return { ok: false, code: 'TOO_LARGE', message: 'imgSrc too long (>200000)' };
      }
      if (/["\r\n]/.test(src)) {
        return { ok: false, code: 'INVALID', message: 'imgSrc contains quote/newline (escape unsafe)' };
      }
      block.dataset.imgSrc = src;
      block.classList.add('has-image');
      circle.style.backgroundImage    = `url("${src}")`;
      circle.style.backgroundSize     = 'cover';
      circle.style.backgroundPosition = 'center';
      circle.style.backgroundRepeat   = 'no-repeat';
      applied.imgSrc = src;
    }
  }

  if (partial.layerName !== undefined && partial.layerName !== null) {
    if (typeof partial.layerName !== 'string') {
      return { ok: false, code: 'INVALID', message: 'layerName must be string' };
    }
    if ([...partial.layerName].length > 80) {
      return { ok: false, code: 'INVALID', message: 'layerName too long (>80 code points)' };
    }
    block.dataset.layerName = partial.layerName;
    applied.layerName = partial.layerName;
  }

  if (block.classList.contains('selected')) {
    try { window.showIconCircleProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

// ── updateGraphBlock (graph-block) ─────────────────────────────────────
function updateGraphBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('graph-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `graph-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial empty — provide at least one field' };
  }

  const before = {
    chartType:    block.dataset.chartType,
    preset:       block.dataset.preset,
    items:        block.dataset.items,
    chartHeight:  block.dataset.chartHeight,
    labelSize:    block.dataset.labelSize,
    barThickness: block.dataset.barThickness,
    padX:         block.dataset.padX,
    barColor:     block.dataset.barColor,
    itemGap:      block.dataset.itemGap,
    pctSize:      block.dataset.pctSize,
    strokeWidth:  block.dataset.strokeWidth,
    pointRadius:  block.dataset.pointRadius,
    fillArea:     block.dataset.fillArea,
    fillAlpha:    block.dataset.fillAlpha,
  };

  const _setInt = (datasetKey, value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    if (min !== undefined && n < min) return false;
    if (max !== undefined && n > max) return false;
    block.dataset[datasetKey] = String(Math.round(n));
    return true;
  };
  const _colorOk = (v) => {
    if (typeof v !== 'string') return false;
    const s = v.trim();
    if (!s || s.length > 64) return false;
    return (
      /^#[0-9a-fA-F]{3,8}$/.test(s) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(s) ||
      s === 'transparent'
    );
  };

  const CHART_TYPES = ['bar-v', 'bar-h', 'line'];
  const PRESETS     = ['default', 'dark', 'minimal', 'colorful'];
  const FILLAREAS   = ['0', '1'];

  window.pushHistory?.();

  const applied = {};

  if (partial.chartType !== undefined) {
    if (!CHART_TYPES.includes(partial.chartType)) {
      return { ok: false, code: 'INVALID', message: `invalid chartType: ${partial.chartType}. allowed: ${CHART_TYPES.join('|')}` };
    }
    block.dataset.chartType = String(partial.chartType);
    applied.chartType = block.dataset.chartType;
  }

  if (partial.preset !== undefined) {
    if (!PRESETS.includes(partial.preset)) {
      return { ok: false, code: 'INVALID', message: `invalid preset: ${partial.preset}. allowed: ${PRESETS.join('|')}` };
    }
    block.dataset.preset = String(partial.preset);
    applied.preset = block.dataset.preset;
  }

  if (partial.items !== undefined) {
    if (!Array.isArray(partial.items)) {
      return { ok: false, code: 'INVALID', message: 'items must be array' };
    }
    if (partial.items.length === 0) {
      return { ok: false, code: 'INVALID', message: 'items must have at least 1 entry' };
    }
    if (partial.items.length > 50) {
      return { ok: false, code: 'INVALID', message: 'items too many (>50)' };
    }
    const norm = [];
    for (let i = 0; i < partial.items.length; i++) {
      const it = partial.items[i];
      if (!it || typeof it !== 'object') {
        return { ok: false, code: 'INVALID', message: `items[${i}] must be object` };
      }
      const label = it.label;
      if (typeof label !== 'string') {
        return { ok: false, code: 'INVALID', message: `items[${i}].label must be string` };
      }
      if ([...label].length > 80) {
        return { ok: false, code: 'INVALID', message: `items[${i}].label too long (>80)` };
      }
      const v = Number(it.value);
      if (!Number.isFinite(v)) {
        return { ok: false, code: 'INVALID', message: `items[${i}].value must be finite number` };
      }
      if (v < 0 || v > 9999) {
        return { ok: false, code: 'INVALID', message: `items[${i}].value out of range [0,9999]` };
      }
      norm.push({ label, value: v });
    }
    block.dataset.items = JSON.stringify(norm);
    applied.items = norm;
  }

  const _intField = (key, datasetKey, min, max) => {
    if (partial[key] === undefined) return;
    if (!_setInt(datasetKey, partial[key], min, max)) {
      throw { code: 'INVALID', message: `${key} invalid (expected finite number in [${min},${max}])` };
    }
    applied[key] = Number(block.dataset[datasetKey]);
  };
  try {
    _intField('chartHeight',  'chartHeight',  80, 2000);
    _intField('labelSize',    'labelSize',    8,  28);
    _intField('barThickness', 'barThickness', 8,  48);
    _intField('padX',         'padX',         0,  80);
    _intField('itemGap',      'itemGap',      8,  80);
    _intField('pctSize',      'pctSize',      20, 120);
    _intField('strokeWidth',  'strokeWidth',  1,  12);
    _intField('pointRadius',  'pointRadius',  0,  16);
  } catch (e) {
    if (e && e.code) return { ok: false, code: e.code, message: e.message };
    throw e;
  }

  if (partial.barColor !== undefined && partial.barColor !== null) {
    if (!_colorOk(partial.barColor)) {
      return { ok: false, code: 'INVALID', message: 'barColor invalid (allowed: #hex | rgb(a)/hsl(a)() | transparent)' };
    }
    block.dataset.barColor = String(partial.barColor).trim();
    applied.barColor = block.dataset.barColor;
  }

  if (partial.fillArea !== undefined && partial.fillArea !== null) {
    let v = partial.fillArea;
    if (v === true || v === 1) v = '1';
    else if (v === false || v === 0) v = '0';
    v = String(v);
    if (!FILLAREAS.includes(v)) {
      return { ok: false, code: 'INVALID', message: `invalid fillArea: ${partial.fillArea}. allowed: 0|1` };
    }
    block.dataset.fillArea = v;
    applied.fillArea = v;
  }

  if (partial.fillAlpha !== undefined && partial.fillAlpha !== null) {
    const n = Number(partial.fillAlpha);
    if (!Number.isFinite(n)) {
      return { ok: false, code: 'INVALID', message: 'fillAlpha must be finite number' };
    }
    if (n < 0 || n > 1) {
      return { ok: false, code: 'INVALID', message: 'fillAlpha out of range [0,1]' };
    }
    const s = n.toFixed(2);
    block.dataset.fillAlpha = s;
    applied.fillAlpha = s;
  }

  try {
    if (typeof window.renderGraph === 'function') {
      window.renderGraph(block);
    }
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  if (block.classList.contains('selected')) {
    try { window.showGraphProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

// ── updateGapBlock ─────────────────────────────────────────────────────
function updateGapBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('gap-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `gap-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  const keys = Object.keys(partial);
  if (keys.length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial empty — provide at least one field' };
  }

  const before = {
    height: parseInt(block.style.height) || block.offsetHeight || 0,
    h: block.dataset.h !== undefined ? parseInt(block.dataset.h) : undefined,
  };

  window.pushHistory?.();

  const applied = {};

  if (partial.height !== undefined && partial.height !== null) {
    const n = Number(partial.height);
    if (!Number.isFinite(n)) {
      return { ok: false, code: 'INVALID', message: `height must be number, got ${partial.height}` };
    }
    if (n < 0 || n > 400) {
      return { ok: false, code: 'INVALID', message: `height out of range [0,400]: ${n}` };
    }
    const v = Math.round(n);
    block.style.height = v + 'px';
    block.dataset.h = String(v);
    applied.height = v;
  }

  if (block.classList.contains('selected')) {
    try { window.showGapProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

// ── updateSpeechBubbleBlock ────────────────────────────────────────────
function updateSpeechBubbleBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('speech-bubble-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `speech-bubble-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial must have at least one field' };
  }

  const bubbleEl = block.querySelector('.tb-bubble');
  const senderEl = block.querySelector('.tb-sender-name');
  if (!bubbleEl) {
    return { ok: false, code: 'RENDER_ERROR', message: '.tb-bubble missing — block malformed' };
  }

  const before = {
    tail:        block.dataset.tail,
    bubbleStyle: block.dataset.bubbleStyle,
    showSender:  block.dataset.showSender,
    senderName:  block.dataset.senderName,
    bubbleBg:    block.style.getPropertyValue('--bubble-bg').trim() || bubbleEl.style.backgroundColor || '',
    text:        (() => { const t = (bubbleEl.innerText || ''); const ph = bubbleEl.dataset.placeholder || ''; return (bubbleEl.dataset.isPlaceholder === 'true' && (t.trim() === '' || t.trim() === ph.trim())) ? '' : t; })(),
  };

  window.pushHistory?.();

  const applied = {};

  if (partial.tail !== undefined) {
    if (!['left', 'center', 'right'].includes(partial.tail)) {
      return { ok: false, code: 'INVALID', message: `invalid tail: ${partial.tail}. allowed: left|center|right` };
    }
    const dir = partial.tail;
    block.dataset.tail = dir;
    block.style.marginLeft  = dir === 'right' || dir === 'center' ? 'auto' : '';
    block.style.marginRight = dir === 'center' ? 'auto' : '';
    const oldTail = block.querySelector('.tb-bubble-tail');
    if (typeof window.getBubbleTailSVG === 'function') {
      const tmp = document.createElement('div');
      tmp.innerHTML = window.getBubbleTailSVG(dir);
      const newTail = tmp.firstElementChild;
      if (newTail) {
        if (oldTail) oldTail.replaceWith(newTail);
        else block.appendChild(newTail);
      }
    }
    applied.tail = dir;
  }

  if (partial.bubbleStyle !== undefined) {
    if (!['default', 'apple', 'imessage'].includes(partial.bubbleStyle)) {
      return { ok: false, code: 'INVALID', message: `invalid bubbleStyle: ${partial.bubbleStyle}. allowed: default|apple|imessage` };
    }
    const style = partial.bubbleStyle;
    block.dataset.bubbleStyle = style;
    if (style === 'apple') {
      bubbleEl.dataset.bubbleStyle = 'apple';
    } else {
      delete bubbleEl.dataset.bubbleStyle;
    }
    applied.bubbleStyle = style;
  }

  if (partial.showSender !== undefined) {
    let show;
    if (typeof partial.showSender === 'boolean') show = partial.showSender;
    else if (partial.showSender === 'true')  show = true;
    else if (partial.showSender === 'false') show = false;
    else return { ok: false, code: 'INVALID', message: `invalid showSender: ${partial.showSender}. allowed: true|false` };
    block.dataset.showSender = show ? 'true' : 'false';
    if (senderEl) senderEl.style.display = show ? '' : 'none';
    applied.showSender = show ? 'true' : 'false';
  }

  if (partial.senderName !== undefined && partial.senderName !== null) {
    if (typeof partial.senderName !== 'string') {
      return { ok: false, code: 'INVALID', message: 'senderName must be string' };
    }
    if ([...partial.senderName].length > 100) {
      return { ok: false, code: 'INVALID', message: 'senderName too long (>100)' };
    }
    block.dataset.senderName = partial.senderName;
    if (senderEl) senderEl.textContent = partial.senderName || 'Your name';
    applied.senderName = partial.senderName;
  }

  if (partial.bubbleBg !== undefined && partial.bubbleBg !== null) {
    if (typeof partial.bubbleBg !== 'string') {
      return { ok: false, code: 'INVALID', message: 'bubbleBg must be string' };
    }
    const v = partial.bubbleBg.trim();
    if (v.length === 0) {
      return { ok: false, code: 'INVALID', message: 'bubbleBg empty' };
    }
    if (v.length > 64) {
      return { ok: false, code: 'INVALID', message: 'bubbleBg too long (>64)' };
    }
    const okColor =
      /^#[0-9a-fA-F]{3,8}$/.test(v) ||
      /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) ||
      v === 'transparent';
    if (!okColor) {
      return { ok: false, code: 'INVALID', message: 'bubbleBg invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent)' };
    }
    bubbleEl.style.backgroundColor = v;
    block.style.setProperty('--bubble-bg', v);
    applied.bubbleBg = v;
  }

  if (partial.text !== undefined && partial.text !== null) {
    if (typeof partial.text !== 'string') {
      return { ok: false, code: 'INVALID', message: 'text must be string' };
    }
    if ([...partial.text].length > 2000) {
      return { ok: false, code: 'INVALID', message: 'text too long (>2000)' };
    }
    if (partial.text === '') {
      const ph = bubbleEl.dataset.placeholder || '말풍선 텍스트를 입력하세요';
      bubbleEl.dataset.isPlaceholder = 'true';
      bubbleEl.innerText = ph;
      applied.text = '';
    } else {
      delete bubbleEl.dataset.isPlaceholder;
      bubbleEl.innerText = partial.text;
      applied.text = partial.text;
    }
  }

  if (block.classList.contains('selected')) {
    try { window.showSpeechBubbleProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.triggerAutoSave?.();
  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

// ─── updateLabelGroupBlock ───────────────────────────────────────────────
function updateLabelGroupBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('label-group-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `label-group-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial is empty — provide at least one field' };
  }

  const LABEL_STYLE_PRESETS = {
    Default: { bg: '#111111', color: '#ffffff', border: 'none' },
    Filled:  { bg: '#333333', color: '#ffffff', border: 'none' },
    Outline: { bg: 'transparent', color: '#111111', border: '1.5px solid #111111' },
    Ghost:   { bg: 'rgba(0,0,0,0.06)', color: '#333333', border: 'none' },
  };

  const isAbsolute = block.style.position === 'absolute';

  const _readLabels = () => [...block.querySelectorAll('.label-item .label-item-text')]
    .map(s => s.textContent || '');
  const before = {
    labels: _readLabels(),
    shape:  block.dataset.shape || 'pill',
    align:  block.style.justifyContent || '',
    gap:    parseInt(block.style.gap) || 0,
    width:  isAbsolute ? (parseInt(block.style.width) || 0) : undefined,
    x:      isAbsolute ? (parseInt(block.style.left)  || 0) : undefined,
    y:      isAbsolute ? (parseInt(block.style.top)   || 0) : undefined,
  };

  window.pushHistory?.();

  const applied = {};
  const warnings = [];

  let shape = before.shape;
  if (partial.shape !== undefined) {
    if (!['pill', 'circle'].includes(partial.shape)) {
      return { ok: false, code: 'INVALID', message: `invalid shape: ${partial.shape}` };
    }
    shape = partial.shape;
    block.dataset.shape = shape;
    applied.shape = shape;
  }

  if (partial.labels !== undefined) {
    if (!Array.isArray(partial.labels)) {
      return { ok: false, code: 'INVALID', message: 'labels must be array' };
    }
    if (partial.labels.length > 50) {
      return { ok: false, code: 'INVALID', message: 'labels too many (>50)' };
    }
    for (let i = 0; i < partial.labels.length; i++) {
      if (typeof partial.labels[i] !== 'string') {
        return { ok: false, code: 'INVALID', message: `labels[${i}] must be string` };
      }
      if (partial.labels[i].length > 500) {
        return { ok: false, code: 'INVALID', message: `labels[${i}] too long (>500)` };
      }
    }
    if (typeof window.makeLabelItem !== 'function') {
      return { ok: false, code: 'API_MISSING', message: 'window.makeLabelItem not found' };
    }
    const firstItem = block.querySelector('.label-item');
    const baseBg     = firstItem?.dataset.bg     || '#e8e8e8';
    const baseColor  = firstItem?.dataset.color  || '#333333';
    const baseRadius = parseInt(firstItem?.dataset.radius) || 40;

    block.querySelectorAll('.label-item').forEach(l => l.remove());
    const addBtn = block.querySelector('.label-group-add-btn');
    partial.labels.forEach(text => {
      const item = window.makeLabelItem(text, baseBg, baseColor, baseRadius, shape);
      if (addBtn) block.insertBefore(item, addBtn);
      else block.appendChild(item);
    });
    applied.labels = partial.labels.slice();
  }

  if (partial.shape !== undefined) {
    const isCircle = shape === 'circle';
    block.querySelectorAll('.label-item').forEach(item => {
      item.dataset.shape = shape;
      item.classList.toggle('label-circle', isCircle);
      if (isCircle) {
        item.style.borderRadius = '50%';
        item.dataset.radius     = '50%';
      } else {
        const r = parseInt(item.dataset.radius);
        const rPx = Number.isFinite(r) ? r : 40;
        item.style.borderRadius = rPx + 'px';
        item.dataset.radius     = String(rPx);
      }
    });
  }

  if (partial.align !== undefined) {
    if (!['left', 'center', 'right'].includes(partial.align)) {
      return { ok: false, code: 'INVALID', message: `invalid align: ${partial.align}` };
    }
    block.style.justifyContent =
      partial.align === 'center' ? 'center' :
      partial.align === 'right'  ? 'flex-end' : 'flex-start';
    applied.align = partial.align;
  }
  if (partial.gap !== undefined) {
    const n = Number(partial.gap);
    if (!Number.isFinite(n) || n < 0 || n > 60) {
      return { ok: false, code: 'INVALID', message: 'gap must be number in [0,60]' };
    }
    block.style.gap = Math.round(n) + 'px';
    applied.gap = Math.round(n);
  }

  if (partial.allItemHeight !== undefined) {
    const n = Number(partial.allItemHeight);
    if (!Number.isFinite(n) || n < 0 || n > 120) {
      return { ok: false, code: 'INVALID', message: 'allItemHeight must be number in [0,120]' };
    }
    const half = Math.round(n / 2);
    block.querySelectorAll('.label-item').forEach(item => {
      item.style.paddingTop    = half + 'px';
      item.style.paddingBottom = half + 'px';
    });
    applied.allItemHeight = Math.round(n);
  }

  if (partial.stylePreset !== undefined) {
    if (!LABEL_STYLE_PRESETS[partial.stylePreset]) {
      return { ok: false, code: 'INVALID', message: `invalid stylePreset: ${partial.stylePreset}` };
    }
    const p = LABEL_STYLE_PRESETS[partial.stylePreset];
    block.querySelectorAll('.label-item').forEach(item => {
      item.style.backgroundColor = p.bg;
      item.style.color           = p.color;
      item.style.border          = p.border;
      item.dataset.bg            = p.bg;
      item.dataset.color         = p.color;
    });
    applied.stylePreset = partial.stylePreset;
  }

  if (partial.itemBg !== undefined && partial.itemBg !== null) {
    const bg = String(partial.itemBg);
    block.querySelectorAll('.label-item').forEach(item => {
      item.style.backgroundColor = bg;
      item.dataset.bg            = bg;
    });
    applied.itemBg = bg;
  }
  if (partial.itemColor !== undefined && partial.itemColor !== null) {
    const c = String(partial.itemColor);
    block.querySelectorAll('.label-item').forEach(item => {
      item.style.color   = c;
      item.dataset.color = c;
    });
    applied.itemColor = c;
  }

  if (partial.itemRadius !== undefined) {
    const n = Number(partial.itemRadius);
    if (!Number.isFinite(n) || n < 0 || n > 50) {
      return { ok: false, code: 'INVALID', message: 'itemRadius must be number in [0,50]' };
    }
    if (shape === 'circle') {
      warnings.push('itemRadius ignored: shape=circle keeps 50%');
    } else {
      const r = Math.round(n);
      block.querySelectorAll('.label-item').forEach(item => {
        item.style.borderRadius = r + 'px';
        item.dataset.radius     = String(r);
      });
      applied.itemRadius = r;
    }
  }

  const _absNum = (key, datasetCssKey, min, max) => {
    if (partial[key] === undefined) return;
    if (!isAbsolute) { warnings.push(`${key} ignored: block is not absolute`); return; }
    const n = Number(partial[key]);
    if (!Number.isFinite(n)) {
      return { ok: false, code: 'INVALID', message: `${key} must be number` };
    }
    if (min !== undefined && n < min) {
      return { ok: false, code: 'INVALID', message: `${key} < ${min}` };
    }
    if (max !== undefined && n > max) {
      return { ok: false, code: 'INVALID', message: `${key} > ${max}` };
    }
    block.style[datasetCssKey] = Math.round(n) + 'px';
    applied[key] = Math.round(n);
  };
  const widthErr = _absNum('width', 'width', 40, 860); if (widthErr && widthErr.ok === false) return widthErr;
  const xErr     = _absNum('x',     'left',  undefined, undefined); if (xErr && xErr.ok === false) return xErr;
  const yErr     = _absNum('y',     'top',   undefined, undefined); if (yErr && yErr.ok === false) return yErr;

  if (block.classList.contains('selected')) {
    try {
      const selectedItem = block.querySelector('.label-item.selected') || null;
      window.showLabelGroupProperties?.(block, selectedItem);
    } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied, warnings };
}

// ── updateShapeBlock: shape 블록 부분 수정 ────────────────────────────────
function updateShapeBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('shape-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `shape-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object' || Array.isArray(partial)) {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial empty — provide at least one field' };
  }

  const svg = block.querySelector('svg.shape-svg');
  if (!svg) return { ok: false, code: 'INVALID', message: 'shape svg missing (corrupted block)' };

  const frame = block.closest('.frame-block');

  const before = {
    shapeType:        block.dataset.shapeType,
    shapeColor:       block.dataset.shapeColor,
    shapeStrokeColor: block.dataset.shapeStrokeColor,
    shapeStrokeWidth: block.dataset.shapeStrokeWidth,
    shapeRotation:    block.dataset.shapeRotation,
    width:  frame ? (frame.dataset.width  || (parseInt(frame.style.width)  || null)) : null,
    height: frame ? (frame.dataset.height || (parseInt(frame.style.height) || null)) : null,
  };

  window.pushHistory?.();

  const applied = {};

  const _isColor = (v) => {
    if (typeof v !== 'string') return false;
    const s = v.trim();
    if (s.length === 0 || s.length > 64) return false;
    return /^#[0-9a-fA-F]{3,8}$/.test(s)
        || /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(s)
        || s === 'transparent';
  };

  const _setInt = (key, value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const c = Math.max(min, Math.min(max, Math.round(n)));
    return c;
  };

  const SHAPE_TYPES = ['rectangle', 'ellipse', 'line', 'arrow', 'polygon', 'star'];

  if (partial.shapeType !== undefined) {
    if (!SHAPE_TYPES.includes(partial.shapeType)) {
      return { ok: false, code: 'INVALID', message: `invalid shapeType: ${partial.shapeType}. allowed: ${SHAPE_TYPES.join('|')}` };
    }
    const SHAPE_DEFS_REF = (typeof window !== 'undefined' && window.SHAPE_DEFS) ? window.SHAPE_DEFS : null;
    if (SHAPE_DEFS_REF && SHAPE_DEFS_REF[partial.shapeType]) {
      const def = SHAPE_DEFS_REF[partial.shapeType];
      const sw  = Number(block.dataset.shapeStrokeWidth ?? 3) || 0;
      if (block.dataset.shapeGradient && typeof window._clearShapeGradient === 'function') {
        try { window._clearShapeGradient(block); } catch (_) {}
      }
      const innerSVG = def.dynamic
        ? (typeof window._shapeInnerSVG === 'function' ? window._shapeInnerSVG(partial.shapeType, sw) : '')
        : (def.inner || '');
      svg.setAttribute('viewBox', def.vb);
      svg.innerHTML = innerSVG;
      svg.style.fill = def.fill ? 'currentColor' : 'none';
      if (!svg.style.stroke) svg.style.stroke = 'currentColor';
    } else if (typeof window.makeShapeBlock === 'function') {
      try {
        const fresh = window.makeShapeBlock(partial.shapeType);
        const freshSvg = fresh.block.querySelector('svg.shape-svg');
        if (freshSvg) {
          svg.setAttribute('viewBox', freshSvg.getAttribute('viewBox'));
          svg.innerHTML = freshSvg.innerHTML;
          svg.style.fill = freshSvg.style.fill || svg.style.fill;
        }
        if (block.dataset.shapeGradient && typeof window._clearShapeGradient === 'function') {
          try { window._clearShapeGradient(block); } catch (_) {}
        }
      } catch (e) {
        return { ok: false, code: 'RENDER_ERROR', message: `shapeType swap failed: ${e.message}` };
      }
    } else {
      return { ok: false, code: 'API_MISSING', message: 'SHAPE_DEFS/makeShapeBlock 미노출 — shapeType 변경 불가' };
    }
    block.dataset.shapeType = partial.shapeType;
    applied.shapeType = partial.shapeType;
  }

  if (partial.shapeColor !== undefined && partial.shapeColor !== null) {
    if (!_isColor(partial.shapeColor)) {
      return { ok: false, code: 'INVALID', message: `shapeColor invalid (allowed: #hex | rgb(a)/hsl(a)() | transparent)` };
    }
    const c = String(partial.shapeColor).trim();
    if (block.dataset.shapeGradient && typeof window._clearShapeGradient === 'function') {
      try { window._clearShapeGradient(block); } catch (_) {}
    }
    block.dataset.shapeColor = c;
    svg.style.color = c;
    applied.shapeColor = c;
  }

  if (partial.shapeStrokeColor !== undefined && partial.shapeStrokeColor !== null) {
    if (partial.shapeStrokeColor === '') {
      delete block.dataset.shapeStrokeColor;
      svg.style.stroke = 'currentColor';
      applied.shapeStrokeColor = '';
    } else {
      if (!_isColor(partial.shapeStrokeColor)) {
        return { ok: false, code: 'INVALID', message: `shapeStrokeColor invalid` };
      }
      const c = String(partial.shapeStrokeColor).trim();
      block.dataset.shapeStrokeColor = c;
      svg.style.stroke = c;
      applied.shapeStrokeColor = c;
    }
  }

  if (partial.shapeStrokeWidth !== undefined && partial.shapeStrokeWidth !== null) {
    const sw = _setInt('shapeStrokeWidth', partial.shapeStrokeWidth, 0, 20);
    if (sw === null) return { ok: false, code: 'INVALID', message: 'shapeStrokeWidth must be finite number' };
    block.dataset.shapeStrokeWidth = String(sw);
    svg.style.strokeWidth = String(sw);
    if (typeof window.refreshShapeInnerSVG === 'function') {
      try { window.refreshShapeInnerSVG(block); } catch (_) {}
    }
    applied.shapeStrokeWidth = sw;
  }

  if (partial.shapeRotation !== undefined && partial.shapeRotation !== null) {
    const deg = _setInt('shapeRotation', partial.shapeRotation, -180, 180);
    if (deg === null) return { ok: false, code: 'INVALID', message: 'shapeRotation must be finite number' };
    const cur = (block.style.transform || '').replace(/rotate\([^)]*\)\s*/g, '').trim();
    if (deg === 0) {
      delete block.dataset.shapeRotation;
      block.style.transform = cur;
      if (!block.style.transform) block.style.removeProperty('transform');
    } else {
      block.dataset.shapeRotation = String(deg);
      block.style.transform = (cur + ` rotate(${deg}deg)`).trim();
      block.style.transformOrigin = 'center center';
    }
    applied.shapeRotation = deg;
  }

  if (partial.width !== undefined && partial.width !== null) {
    if (!frame) return { ok: false, code: 'NOT_FOUND', message: 'parent .frame-block not found — cannot resize' };
    const w = _setInt('width', partial.width, 10, 860);
    if (w === null) return { ok: false, code: 'INVALID', message: 'width must be finite number in [10,860]' };
    frame.style.width = w + 'px';
    frame.dataset.width = String(w);
    applied.width = w;
  }
  if (partial.height !== undefined && partial.height !== null) {
    if (!frame) return { ok: false, code: 'NOT_FOUND', message: 'parent .frame-block not found — cannot resize' };
    const h = _setInt('height', partial.height, 10, 860);
    if (h === null) return { ok: false, code: 'INVALID', message: 'height must be finite number in [10,860]' };
    frame.style.height = h + 'px';
    frame.style.minHeight = h + 'px';
    frame.dataset.height = String(h);
    applied.height = h;
  }

  try { window.buildLayerPanel?.(); } catch (_) {}
  try { window.triggerAutoSave?.() ?? window.scheduleAutoSave?.(); } catch (_) {}

  return { ok: true, blockId, before, applied };
}

// ── 수정: icon-text 블록 partial update ──────────────────────────────────
function updateIconTextBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('icon-text-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `icon-text-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object' || Array.isArray(partial)) {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial empty — provide at least one field' };
  }

  const _textEl0 = block.querySelector(':scope > .itb-text');
  const before = {
    text:   _textEl0 ? _textEl0.textContent : '',
    imgSrc: block.dataset.imgSrc || '',
  };

  if (partial.text !== undefined && partial.text !== null) {
    if (typeof partial.text !== 'string') {
      return { ok: false, code: 'INVALID', message: 'text must be string' };
    }
    if ([...partial.text].length > 2000) {
      return { ok: false, code: 'TOO_LARGE', message: 'text too long (>2000)' };
    }
  }
  if (partial.imgSrc !== undefined && partial.imgSrc !== null) {
    if (typeof partial.imgSrc !== 'string') {
      return { ok: false, code: 'INVALID', message: 'imgSrc must be string' };
    }
    if (partial.imgSrc.length > 200000) {
      return { ok: false, code: 'TOO_LARGE', message: 'imgSrc too long (>200000)' };
    }
    if (partial.imgSrc.length > 0) {
      if (/["\r\n]/.test(partial.imgSrc)) {
        return { ok: false, code: 'INVALID', message: 'imgSrc contains quote/newline (escape unsafe)' };
      }
      const _src = partial.imgSrc.trim();
      const _okProto =
        /^data:image\//i.test(_src) ||
        /^https?:\/\//i.test(_src) ||
        /^blob:/i.test(_src) ||
        /^assets\//i.test(_src);
      if (!_okProto) {
        return { ok: false, code: 'INVALID', message: 'imgSrc protocol not allowed (use data:image/*, http(s)://, blob:, or assets/)' };
      }
    }
  }

  window.pushHistory?.();

  const applied = {};

  if (partial.text !== undefined && partial.text !== null) {
    const textEl = block.querySelector(':scope > .itb-text');
    if (textEl) {
      textEl.textContent = String(partial.text);
      if (!textEl.hasAttribute('contenteditable')) {
        textEl.setAttribute('contenteditable', 'false');
      }
    }
    applied.text = String(partial.text);
  }

  if (partial.imgSrc !== undefined && partial.imgSrc !== null) {
    const iconEl = block.querySelector(':scope > .itb-icon');
    const newSrc = String(partial.imgSrc);
    if (iconEl) {
      if (newSrc.length === 0) {
        iconEl.querySelectorAll('img').forEach(n => n.remove());
        iconEl.classList.remove('has-image');
        iconEl.style.border = '';
        delete block.dataset.imgSrc;
      } else {
        let img = iconEl.querySelector('img');
        if (!img) { img = document.createElement('img'); iconEl.appendChild(img); }
        img.src = newSrc;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;';
        img.setAttribute('draggable', 'false');
        iconEl.classList.add('has-image');
        iconEl.style.border = 'none';
        block.dataset.imgSrc = newSrc;
      }
    }
    applied.imgSrc = newSrc;
  }

  try { window.buildLayerPanel?.(); } catch (_) {}

  try { window.triggerAutoSave?.(); } catch (_) {}
  try { window.scheduleAutoSave?.(); } catch (_) {}

  return { ok: true, blockId, before, applied };
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
window.makeSpeechBubbleBlock = makeSpeechBubbleBlock;
window.addSpeechBubbleBlock  = addSpeechBubbleBlock;
// ─── update* exports for secondary blocks (MCP partial update bridges) ──
window.updateDividerBlock     = updateDividerBlock;
window.updateAssetBlock       = updateAssetBlock;
window.updateTableBlock       = updateTableBlock;
window.updateIconCircleBlock  = updateIconCircleBlock;
window.updateGraphBlock       = updateGraphBlock;
window.updateGapBlock         = updateGapBlock;
window.updateSpeechBubbleBlock = updateSpeechBubbleBlock;
window.updateLabelGroupBlock  = updateLabelGroupBlock;
window.updateShapeBlock       = updateShapeBlock;
window.updateIconTextBlock    = updateIconTextBlock;
window.SHAPE_DEFS             = SHAPE_DEFS; // updateShapeBlock 에서 shapeType swap 시 참조


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

// ── Frame Update API (D 워크플로우 결과 적용 2026-06-09) ──
// frame-block: blockId prefix 'ss'. ID 기반 partial update — banner02 updateBanner02Block 패턴 미러.
// frame은 자체 render 함수가 없고 dataset + inline style 직접 조작 모델 (block-factory.makeFrameBlock 참고).
// 지원 필드: bg, bgImage, width, height, paddingY, radius, borderWidth, borderStyle, borderColor,
//          alignItems, justifyContent, gap, translateX, translateY, rotateDeg, flipH, flipV, bannerPreset.
// 제외: layout 모드 전환(freeLayout↔fullWidth는 구조적 마이그레이션 필요), 자식 add/remove(add_* 도구 영역).
function updateFrameBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('frame-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `frame-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial must have at least 1 field' };
  }

  // before 스냅샷 (mutate / pushHistory 이전)
  const before = {
    bg: block.dataset.bg || block.style.backgroundColor || null,
    bgImage: block.dataset.bgImg || (block.style.backgroundImage && block.style.backgroundImage !== 'none' ? block.style.backgroundImage : null),
    width: parseInt(block.dataset.width) || block.offsetWidth || null,
    height: parseInt(block.dataset.height) || null,
    paddingY: parseInt(block.dataset.padY) || 0,
    radius: parseInt(block.dataset.radius) || 0,
    borderWidth: parseInt(block.dataset.borderWidth) || 0,
    borderStyle: block.dataset.borderStyle || 'solid',
    borderColor: block.dataset.borderColor || null,
    alignItems: block.dataset.alignItems || block.style.alignItems || null,
    justifyContent: block.dataset.justifyContent || block.style.justifyContent || null,
    gap: parseInt(block.dataset.gap) || parseInt(block.style.gap) || 0,
    translateX: parseInt(block.dataset.translateX) || 0,
    translateY: parseInt(block.dataset.translateY) || 0,
    rotateDeg: parseFloat(block.dataset.rotateDeg) || 0,
    flipH: block.dataset.flipH === '1' ? 1 : 0,
    flipV: block.dataset.flipV === '1' ? 1 : 0,
    bannerPreset: block.dataset.bannerPreset || null,
  };

  window.pushHistory?.();

  const applied = {};

  // ── helpers (banner02 패턴 미러) ──
  const _setNum = (datasetKey, value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    if (min !== undefined && n < min) return false;
    if (max !== undefined && n > max) return false;
    block.dataset[datasetKey] = String(n);
    return true;
  };

  // 1) bg — solid / gradient(css) 둘 다 허용. prop-frame.js wireColorField onApply/onGradient 패턴 미러.
  //    string으로 들어오는 색상값을 그대로 backgroundColor에 (gradient면 backgroundImage로 분리해야 정상 표시).
  if (partial.bg !== undefined && partial.bg !== null) {
    if (typeof partial.bg !== 'string') {
      return { ok: false, code: 'INVALID', message: 'bg must be string' };
    }
    const v = partial.bg.trim();
    if (v.length === 0)   return { ok: false, code: 'INVALID', message: 'bg empty' };
    if (v.length > 1024)  return { ok: false, code: 'INVALID', message: 'bg too long (>1024)' };
    if (/["\r\n;]/.test(v)) return { ok: false, code: 'INVALID', message: 'bg contains quote/newline/semicolon (CSS injection guard)' };
    const isGradient = /gradient\s*\(/i.test(v);
    if (isGradient) {
      block.style.backgroundColor = '';
      block.style.background = v;
    } else {
      // strict color guard (hex / rgb(a) / hsl(a) / transparent)
      const okColor = /^#[0-9a-fA-F]{3,8}$/.test(v) || /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) || v === 'transparent';
      if (!okColor) return { ok: false, code: 'INVALID', message: `bg invalid color (allowed: #hex | rgb(a)/hsl(a)() | transparent | css gradient)` };
      // 기존 그라데이션 제거
      block.style.backgroundImage = block.dataset.bgImg ? `url("${block.dataset.bgImg}")` : '';
      block.style.background = '';
      block.style.backgroundColor = v;
    }
    block.dataset.bg = v;
    applied.bg = v;
  }

  // 2) bgImage — file path / URL only (data URL 폭주 방지). " 와 개행 차단.
  //    null/empty 명시면 이미지 제거.
  if (partial.bgImage !== undefined) {
    if (partial.bgImage === null || partial.bgImage === '') {
      block.style.backgroundImage = '';
      block.style.backgroundSize = '';
      block.style.backgroundPosition = '';
      delete block.dataset.bgImg;
      delete block.dataset.bgPos;
      applied.bgImage = null;
    } else {
      if (typeof partial.bgImage !== 'string') {
        return { ok: false, code: 'INVALID', message: 'bgImage must be string (url/path) or null' };
      }
      const src = String(partial.bgImage).trim();
      if (src.length === 0)   return { ok: false, code: 'INVALID', message: 'bgImage empty' };
      if (src.length > 4096)  return { ok: false, code: 'TOO_LARGE', message: 'bgImage too long (>4096)' };
      if (/["\r\n]/.test(src)) return { ok: false, code: 'INVALID', message: 'bgImage contains quote/newline (escape unsafe)' };
      if (/^data:/i.test(src)) return { ok: false, code: 'INVALID', message: 'bgImage data: URL not allowed — use file path or http(s) URL' };
      // http(s)/file/relative path만 허용 — javascript: 등 차단
      if (!/^(https?:\/\/|file:\/\/|\/|\.{1,2}\/|[a-zA-Z0-9_\-./])/.test(src)) {
        return { ok: false, code: 'INVALID', message: 'bgImage scheme not allowed (http/https/file/relative only)' };
      }
      block.style.backgroundImage = `url("${src}")`;
      block.style.backgroundSize = 'cover';
      block.style.backgroundPosition = 'center';
      block.dataset.bgImg = src;
      applied.bgImage = src;
    }
  }

  // 3) Size
  if (partial.width !== undefined) {
    if (_setNum('width', partial.width, 20, 4000)) {
      const w = Number(partial.width);
      block.style.width = w + 'px';
      block.style.margin = '0 auto'; block.style.alignSelf = 'center';
      applied.width = w;
    } else return { ok: false, code: 'INVALID', message: 'width out of range [20, 4000]' };
  }
  if (partial.height !== undefined) {
    if (_setNum('height', partial.height, 20, 4000)) {
      const h = Number(partial.height);
      block.style.height = h + 'px';
      block.style.minHeight = h + 'px';
      applied.height = h;
    } else return { ok: false, code: 'INVALID', message: 'height out of range [20, 4000]' };
  }

  // 4) Padding (상하)
  if (partial.paddingY !== undefined) {
    if (_setNum('padY', partial.paddingY, 0, 400)) {
      const p = Number(partial.paddingY);
      block.style.paddingTop = p + 'px';
      block.style.paddingBottom = p + 'px';
      applied.paddingY = p;
    } else return { ok: false, code: 'INVALID', message: 'paddingY out of range [0, 400]' };
  }

  // 5) Border radius
  if (partial.radius !== undefined) {
    if (_setNum('radius', partial.radius, 0, 400)) {
      const r = Number(partial.radius);
      block.style.borderRadius = r + 'px';
      applied.radius = r;
    } else return { ok: false, code: 'INVALID', message: 'radius out of range [0, 400]' };
  }

  // 6) Border (width/style/color) — 셋이 합쳐져 ss.style.border로 일괄 적용 (prop-frame applyBorder 미러)
  const _borderTouched = (partial.borderWidth !== undefined || partial.borderStyle !== undefined || partial.borderColor !== undefined);
  if (_borderTouched) {
    if (partial.borderWidth !== undefined) {
      if (!_setNum('borderWidth', partial.borderWidth, 0, 100)) {
        return { ok: false, code: 'INVALID', message: 'borderWidth out of range [0, 100]' };
      }
      applied.borderWidth = Number(partial.borderWidth);
    }
    if (partial.borderStyle !== undefined) {
      const allowedStyles = ['solid', 'dashed', 'dotted', 'double', 'none'];
      if (!allowedStyles.includes(partial.borderStyle)) {
        return { ok: false, code: 'INVALID', message: `invalid borderStyle: ${partial.borderStyle}. allowed: ${allowedStyles.join('|')}` };
      }
      block.dataset.borderStyle = partial.borderStyle;
      applied.borderStyle = partial.borderStyle;
    }
    if (partial.borderColor !== undefined && partial.borderColor !== null) {
      if (typeof partial.borderColor !== 'string') {
        return { ok: false, code: 'INVALID', message: 'borderColor must be string' };
      }
      const v = partial.borderColor.trim();
      if (v.length === 0)   return { ok: false, code: 'INVALID', message: 'borderColor empty' };
      if (v.length > 64)    return { ok: false, code: 'INVALID', message: 'borderColor too long' };
      const okColor = /^#[0-9a-fA-F]{3,8}$/.test(v) || /^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/.test(v) || v === 'transparent';
      if (!okColor) return { ok: false, code: 'INVALID', message: `borderColor invalid (allowed: #hex | rgb(a)/hsl(a)() | transparent)` };
      block.dataset.borderColor = v;
      applied.borderColor = v;
    }
    const w = parseInt(block.dataset.borderWidth) || 0;
    const s = block.dataset.borderStyle || 'solid';
    const c = block.dataset.borderColor || '#888888';
    block.style.border = w > 0 ? `${w}px ${s} ${c}` : '';
  }

  // 7) Child align (flex) — alignItems(horizontal) / justifyContent(vertical for column flex)
  //    NOTE: freeLayout 프레임에선 자식이 absolute이므로 flex align이 무효 → dataset만 갱신 + style은 무효.
  //    구조적 재배치(자식 left/top 갱신)는 prop-frame _setAlign이 담당 — MCP partial 범위에선 제외.
  const _alignAllowed = ['flex-start', 'center', 'flex-end', 'stretch', 'baseline'];
  const _justifyAllowed = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'];
  if (partial.alignItems !== undefined) {
    if (!_alignAllowed.includes(partial.alignItems)) {
      return { ok: false, code: 'INVALID', message: `invalid alignItems: ${partial.alignItems}. allowed: ${_alignAllowed.join('|')}` };
    }
    block.dataset.alignItems = partial.alignItems;
    if (block.dataset.freeLayout !== 'true') block.style.alignItems = partial.alignItems;
    applied.alignItems = partial.alignItems;
  }
  if (partial.justifyContent !== undefined) {
    if (!_justifyAllowed.includes(partial.justifyContent)) {
      return { ok: false, code: 'INVALID', message: `invalid justifyContent: ${partial.justifyContent}. allowed: ${_justifyAllowed.join('|')}` };
    }
    block.dataset.justifyContent = partial.justifyContent;
    if (block.dataset.freeLayout !== 'true') block.style.justifyContent = partial.justifyContent;
    applied.justifyContent = partial.justifyContent;
  }

  // 8) gap
  if (partial.gap !== undefined) {
    if (_setNum('gap', partial.gap, 0, 400)) {
      const g = Number(partial.gap);
      block.style.gap = g + 'px';
      applied.gap = g;
    } else return { ok: false, code: 'INVALID', message: 'gap out of range [0, 400]' };
  }

  // 9) Transform (translate / rotate / flip) — prop-frame _applyTransform 미러
  const _transformTouched = (
    partial.translateX !== undefined || partial.translateY !== undefined ||
    partial.rotateDeg !== undefined || partial.flipH !== undefined || partial.flipV !== undefined
  );
  if (partial.translateX !== undefined) {
    if (!_setNum('translateX', partial.translateX, -10000, 10000)) {
      return { ok: false, code: 'INVALID', message: 'translateX out of range [-10000, 10000]' };
    }
    applied.translateX = Number(partial.translateX);
  }
  if (partial.translateY !== undefined) {
    if (!_setNum('translateY', partial.translateY, -10000, 10000)) {
      return { ok: false, code: 'INVALID', message: 'translateY out of range [-10000, 10000]' };
    }
    applied.translateY = Number(partial.translateY);
  }
  if (partial.rotateDeg !== undefined) {
    const n = Number(partial.rotateDeg);
    if (!Number.isFinite(n)) return { ok: false, code: 'INVALID', message: 'rotateDeg must be number' };
    if (n < -360 || n > 360) return { ok: false, code: 'INVALID', message: 'rotateDeg out of range [-360, 360]' };
    block.dataset.rotateDeg = String(n);
    applied.rotateDeg = n;
  }
  if (partial.flipH !== undefined) {
    const v = (partial.flipH === true || partial.flipH === 1 || partial.flipH === '1') ? '1' : '0';
    block.dataset.flipH = v;
    applied.flipH = v === '1';
  }
  if (partial.flipV !== undefined) {
    const v = (partial.flipV === true || partial.flipV === 1 || partial.flipV === '1') ? '1' : '0';
    block.dataset.flipV = v;
    applied.flipV = v === '1';
  }
  if (_transformTouched) {
    const tx = parseInt(block.dataset.translateX) || 0;
    const ty = parseInt(block.dataset.translateY) || 0;
    const rd = parseFloat(block.dataset.rotateDeg) || 0;
    const fx = block.dataset.flipH === '1' ? -1 : 1;
    const fy = block.dataset.flipV === '1' ? -1 : 1;
    block.style.transform = `translate(${tx}px,${ty}px) rotate(${rd}deg) scale(${fx},${fy})`;
  }

  // 10) bannerPreset — destructive. 자식 모두 사라짐. PM 호출 시 명시적 confirmDestructive=true 필요.
  if (partial.bannerPreset !== undefined && partial.bannerPreset !== null) {
    if (typeof partial.bannerPreset !== 'string') {
      return { ok: false, code: 'INVALID', message: 'bannerPreset must be string' };
    }
    const presets = window.BANNER_PRESETS || {};
    if (!presets[partial.bannerPreset]) {
      return { ok: false, code: 'INVALID', message: `invalid bannerPreset: ${partial.bannerPreset}. available: ${Object.keys(presets).join('|') || '(none registered)'}` };
    }
    if (partial.confirmDestructive !== true) {
      return { ok: false, code: 'DESTRUCTIVE_REQUIRES_CONFIRM', message: 'bannerPreset 변경은 frame 내부 자식을 모두 제거합니다. confirmDestructive:true를 명시하세요.' };
    }
    try {
      if (typeof window._applyBannerPreset === 'function') {
        window._applyBannerPreset(block, partial.bannerPreset);
        applied.bannerPreset = partial.bannerPreset;
      } else {
        return { ok: false, code: 'API_MISSING', message: 'window._applyBannerPreset not available' };
      }
    } catch (e) {
      return { ok: false, code: 'PRESET_ERROR', message: e.message };
    }
  }

  // 11) 우측 패널 갱신 (선택 상태일 때만)
  if (block.classList.contains('selected')) {
    try { window.showFrameProperties?.(block); } catch (_) {}
    try { window.showFrameHandles?.(block); } catch (_) {}
  }
  // 12) 레이어 패널
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

window.updateFrameBlock = updateFrameBlock;
export { updateFrameBlock };
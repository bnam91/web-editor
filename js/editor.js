import { canvasEl, propPanel, state } from './globals.js';
import { pushHistory, undo, redo, clearHistory, restoreSnapshot } from './history.js';

/* ═══════════════════════════════════
   PANEL TABS
═══════════════════════════════════ */
function toggleAllSections() {
  const sections = document.querySelectorAll('#layer-panel-body .layer-section');
  const anyOpen = [...sections].some(s => !s.classList.contains('collapsed'));
  sections.forEach(s => s.classList.toggle('collapsed', anyOpen));
}

function switchToTab(tabName) {
  document.querySelectorAll('.panel-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tabName));
  const filePanel = document.getElementById('file-panel-body');
  if (filePanel) filePanel.style.display = tabName === 'file' ? 'flex' : 'none';
  document.getElementById('branch-panel-body').style.display     = tabName === 'branch'    ? '' : 'none';
  document.getElementById('inspector-panel-body').style.display  = tabName === 'inspector' ? 'flex' : 'none';
  document.getElementById('checklist-panel-body').style.display  = tabName === 'checklist' ? 'flex' : 'none';
  const collapseBtn = document.getElementById('layer-collapse-all');
  if (collapseBtn) collapseBtn.style.display = tabName === 'file' ? '' : 'none';
  if (tabName === 'branch') window.renderBranchPanel();
  if (tabName === 'inspector') window.renderInspectorPanel();
  if (tabName === 'checklist') window.renderChecklistPanel?.();
}

function initFileTabToggle() {
  ['page-section-header', 'layers-section-header', 'templates-section-header'].forEach(id => {
    const header = document.getElementById(id);
    if (!header) return;
    header.addEventListener('click', () => {
      header.closest('.file-panel-section').classList.toggle('collapsed');
    });
  });
}

/* ═══════════════════════════════════
   ZOOM
═══════════════════════════════════ */
const CANVAS_W = 860;
let currentZoom = 40;
const scaler = document.getElementById('canvas-scaler');
const zoomDisplay = document.getElementById('zoom-display');

let panOffsetX = 0;
let panOffsetY = 0;

function applyZoom(z) {
  currentZoom = Math.min(400, Math.max(10, z));
  window.currentZoom = currentZoom;
  _applyScalerTransform();
  zoomDisplay.textContent = currentZoom + '%';
  document.documentElement.style.setProperty('--inv-zoom', (100 / currentZoom).toFixed(4));
}

function _applyScalerTransform() {
  scaler.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${currentZoom / 100})`;
}

function resetPanOffset() {
  panOffsetX = 0;
  panOffsetY = 0;
  _applyScalerTransform();
}
function zoomStep(delta) {
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap) { applyZoom(currentZoom + delta); return; }

  const s_old = currentZoom / 100;
  const newZoom = Math.min(400, Math.max(10, currentZoom + delta));
  const s_new = newZoom / 100;

  // 줌인 + 선택 블록 있음: 해당 섹션을 화면 중앙으로
  // 줌아웃 또는 선택 없음: 캔버스 중심을 뷰포트 중심에 유지
  const selectedBlock = delta > 0 && document.querySelector(
    '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
    '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
    '.card-block.selected, .graph-block.selected, .divider-block.selected, ' +
    '.icon-text-block.selected, .shape-block.selected, .speech-bubble-block.selected'
  );
  const targetEl = selectedBlock ? (selectedBlock.closest('.section-block') || selectedBlock) : null;
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const elScreenX = rect.left + rect.width  / 2 - wrapRect.left;
    const elScreenY = rect.top  + rect.height / 2 - wrapRect.top;
    // 캔버스 좌표계 변환 공식 (transform-origin:top center + flexbox centering 고려):
    //   screenX_wrap = wrapWidth/2 + panOffsetX + s*(cx - 430)  → 역산: cx = (screenX - wrapWidth/2 - panOffsetX)/s + 430
    //   screenY_wrap = 40          + panOffsetY + s*cy           → 역산: cy = (screenY - 40 - panOffsetY)/s
    const CANVAS_HALF = 430; // canvas 860px 절반
    const WRAP_PAD    = 40;  // canvas-wrap 상단 패딩
    const elCanvasX = (elScreenX - wrap.clientWidth / 2 - panOffsetX) / s_old + CANVAS_HALF;
    const elCanvasY = (elScreenY - WRAP_PAD - panOffsetY) / s_old;
    panOffsetX = -(elCanvasX - CANVAS_HALF) * s_new;
    panOffsetY = wrap.clientHeight / 2 - WRAP_PAD - elCanvasY * s_new;
  } else {
    const ratio = s_new / s_old;
    panOffsetX = panOffsetX * ratio;
    panOffsetY = panOffsetY * ratio;
  }

  applyZoom(newZoom);
}
function zoomFit() {
  const wrap = document.getElementById('canvas-wrap');
  applyZoom(Math.floor(((wrap.clientWidth - 80) / CANVAS_W) * 100));
}


/* ══ 브레드크럼 헬퍼 ══ */
function getBlockBreadcrumb(el) {
  const sec = el.closest('.section-block');
  if (!sec) return '';
  const sections = [...document.querySelectorAll('.section-block')];
  const sIdx = sections.indexOf(sec) + 1;
  const row = el.classList.contains('row') ? el : el.closest('.row');
  if (!row) return `Section ${sIdx}`;
  const inner = sec.querySelector('.section-inner');
  const rows = inner ? [...inner.querySelectorAll(':scope > .row')] : [];
  const rIdx = rows.indexOf(row) + 1;
  return `Section ${sIdx}  ·  Row ${rIdx}`;
}

/* ══════════════════════════════════════
   클립보드 유틸 — Electron 권한 우회
══════════════════════════════════════ */
function _copyToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(text).catch(() => _clipboardFallback(text));
  } else {
    _clipboardFallback(text);
  }
}
function _clipboardFallback(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
  document.body.appendChild(el);
  el.focus(); el.select();
  try { document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(el);
}
window._copyToClipboard = _copyToClipboard;

/* ══════════════════════════════════════
   복사 / 붙여넣기
══════════════════════════════════════ */
let clipboard = null;

/* ═══════════════════════════════════
   BLOCK MULTI-SELECT HELPERS
   - Cmd+click  : toggle individual block
   - Shift+click: range select from last clicked
═══════════════════════════════════ */
const BLOCK_MULTI_SEL = '.text-block, .asset-block, .gap-block, .icon-circle-block, ' +
  '.table-block, .label-group-block, .graph-block, .divider-block, ' +
  '.icon-text-block, .shape-block';

let _lastClickedBlock = null;

function _getBlockLayerItem(block) {
  if (block.classList.contains('shape-block')) {
    const ss = block.closest('.frame-block');
    return ss?._layerItem || block._layerItem;
  }
  return block._layerItem;
}

/* freeLayout 내 블록인지 확인 */
function _isInFreeLayout(block) {
  const wrapper = block.closest('.frame-block[data-text-frame], .frame-block[data-shape-frame]') ||
    (block.style.position === 'absolute' ? block : null);
  return !!(wrapper && wrapper.closest('.frame-block[data-free-layout]'));
}

/* freeLayout 내 블록의 모든 상위 freeLayout frame에 .selected 복원
 * 중첩 프레임(B inside A) 구조에서 deselectAll() 후 A까지 복원하지 않으면
 * A의 CSS pointer-events:none이 하위 전체에 적용되어 더블클릭이 막힘 */
function _restoreFreeLayoutFrameSelected(block) {
  let el = block;
  let deepestFrame = null;
  while (el) {
    const textOrShape = el.closest('.frame-block[data-text-frame], .frame-block[data-shape-frame]');
    const searchFrom = textOrShape || el;
    const frame = searchFrom.closest('.frame-block[data-free-layout]');
    if (!frame) break;
    frame.classList.add('selected');
    if (!deepestFrame) {
      deepestFrame = frame;
      window._activeFrame = frame;
    }
    const sec = frame.closest('.section-block');
    if (sec) sec.classList.add('selected');
    // 이 frame의 바깥에서 다시 탐색 (상위 frame 복원)
    el = frame.parentElement;
  }
}

/* freeLayout 멀티셀렉 패널 업데이트 트리거 */
function _updateFreeLayoutMultiSelPanel() {
  if (window.hasFreeLayoutMultiSel?.()) {
    window.showFreeLayoutMultiSelPanel?.();
  }
}

/* Cmd+클릭: 단일 블록 토글 */
function toggleBlockSelect(block, sec) {
  const layerItem = _getBlockLayerItem(block);
  if (block.classList.contains('selected')) {
    block.classList.remove('selected');
    if (layerItem) { layerItem.classList.remove('active'); layerItem.style.background = ''; }
  } else {
    block.classList.add('selected');
    if (layerItem) layerItem.classList.add('active');
  }
  if (sec) window.syncSection?.(sec);
  _lastClickedBlock = block;
  // freeLayout 내 블록이면 부모 프레임 selected 복원 + 멀티셀렉 패널 업데이트
  if (_isInFreeLayout(block)) {
    _restoreFreeLayoutFrameSelected(block);
    setTimeout(_updateFreeLayoutMultiSelPanel, 0);
  }
}

/* Shift+클릭: 마지막 클릭 블록 ~ 현재 블록 범위 선택 */
function rangeSelectBlocks(block, sec) {
  const allBlocks = [...(canvasEl || document).querySelectorAll(BLOCK_MULTI_SEL)];
  const anchor = _lastClickedBlock && allBlocks.includes(_lastClickedBlock) ? _lastClickedBlock : null;
  if (!anchor) {
    // 앵커 없으면 단일 선택
    window.deselectAll?.();
    block.classList.add('selected');
    const li = _getBlockLayerItem(block);
    if (li) li.classList.add('active');
    _lastClickedBlock = block;
    if (sec) window.syncSection?.(sec);
    return;
  }
  const a = allBlocks.indexOf(anchor);
  const b = allBlocks.indexOf(block);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  window.deselectAll?.();
  // deselectAll이 _lastClickedBlock을 null로 초기화하므로 앵커 복원
  _lastClickedBlock = anchor;
  for (let i = lo; i <= hi; i++) {
    allBlocks[i].classList.add('selected');
    const li = _getBlockLayerItem(allBlocks[i]);
    if (li) li.classList.add('active');
  }
  if (sec) window.syncSection?.(sec);
  // freeLayout 내 블록이면 부모 프레임 selected 복원 + 멀티셀렉 패널 업데이트
  // deselectAll이 frame.selected를 제거 → pointer-events:none 차단 방지
  if (_isInFreeLayout(block)) {
    _restoreFreeLayoutFrameSelected(block);
    setTimeout(_updateFreeLayoutMultiSelPanel, 0);
  }
}

/* 일반 클릭 시 앵커 업데이트 */
function setBlockAnchor(block) { _lastClickedBlock = block; }
window.toggleBlockSelect  = toggleBlockSelect;
window.rangeSelectBlocks  = rangeSelectBlocks;
window.setBlockAnchor     = setBlockAnchor;
window._restoreFreeLayoutFrameSelected = _restoreFreeLayoutFrameSelected; // QA/디버그용

/* ═══════════════════════════════════
   MULTI-SELECT STATE
═══════════════════════════════════ */
const multiSel = {
  sections: new Set(),
  cols:     new Set(),
  lastSection: null,
  lastCol:     null,
};

function clearMultiSel() {
  multiSel.sections.forEach(s => s.classList.remove('multi-selected'));
  multiSel.cols.forEach(c => c.classList.remove('multi-selected'));
  multiSel.sections.clear();
  multiSel.cols.clear();
  multiSel.lastSection = null;
  multiSel.lastCol     = null;
}

function showMultiSelPanel() {
  if (!propPanel) return;
  // freeLayout 블록 멀티셀렉이면 전용 패널으로 위임
  if (window.hasFreeLayoutMultiSel?.()) {
    window.showFreeLayoutMultiSelPanel?.();
    return;
  }
  // 기존 section/col 멀티셀렉 패널 (기존 동작 유지)
  const n = multiSel.sections.size || multiSel.cols.size;
  propPanel.innerHTML = `<div style="padding:20px;color:#888;font-size:13px;">${n}개 선택됨</div>`;
}

function selectSectionWithModifier(sec, e) {
  if (e && (e.metaKey || e.ctrlKey)) {
    // Cmd: toggle
    if (multiSel.sections.has(sec)) {
      sec.classList.remove('selected', 'multi-selected');
      multiSel.sections.delete(sec);
    } else if (sec.classList.contains('selected') && multiSel.sections.size === 0) {
      // 이미 단일 선택된 항목을 Cmd+클릭 → 선택 해제 (토글)
      sec.classList.remove('selected', 'multi-selected');
    } else {
      // 기존 단일 선택도 multiSel에 합류
      const prev = document.querySelector('.section-block.selected:not(.multi-selected)');
      if (prev && !multiSel.sections.has(prev)) {
        prev.classList.add('multi-selected');
        multiSel.sections.add(prev);
        multiSel.lastSection = prev;
      }
      sec.classList.add('selected', 'multi-selected');
      multiSel.sections.add(sec);
    }
    multiSel.lastSection = sec;
    if (multiSel.sections.size > 1) { showMultiSelPanel(); return; }
    if (multiSel.sections.size === 1) { selectSection([...multiSel.sections][0]); clearMultiSel(); return; }
    deselectAll();
  } else if (e && e.shiftKey && multiSel.lastSection) {
    // Shift: range
    const all = [...document.querySelectorAll('.section-block')];
    const a = all.indexOf(multiSel.lastSection);
    const b = all.indexOf(sec);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    deselectAll();
    clearMultiSel();
    for (let i = lo; i <= hi; i++) {
      all[i].classList.add('selected', 'multi-selected');
      multiSel.sections.add(all[i]);
    }
    multiSel.lastSection = sec;
    if (multiSel.sections.size > 1) { showMultiSelPanel(); return; }
    if (multiSel.sections.size === 1) { selectSection([...multiSel.sections][0]); clearMultiSel(); return; }
  } else {
    // 일반 클릭: 단일 선택
    clearMultiSel();
    selectSection(sec);
    multiSel.lastSection = sec;
  }
}

function selectColWithModifier(col, e) {
  if (!e || (!e.metaKey && !e.ctrlKey && !e.shiftKey)) return false;
  const row = col.closest('.row');
  if (!row) return false;
  const rowCols = [...row.querySelectorAll(':scope > .col')];

  if (e.metaKey || e.ctrlKey) {
    if (multiSel.cols.has(col)) {
      col.classList.remove('selected', 'multi-selected');
      multiSel.cols.delete(col);
    } else {
      const prevCol = row.querySelector('.col.selected:not(.multi-selected)');
      if (prevCol && !multiSel.cols.has(prevCol)) {
        prevCol.classList.add('multi-selected');
        multiSel.cols.add(prevCol);
        multiSel.lastCol = prevCol;
      }
      col.classList.add('selected', 'multi-selected');
      multiSel.cols.add(col);
    }
    multiSel.lastCol = col;
    if (multiSel.cols.size > 1) { showMultiSelPanel(); return true; }
    if (multiSel.cols.size === 1) { clearMultiSel(); return false; }
    return true;
  } else if (e.shiftKey && multiSel.lastCol) {
    const a = rowCols.indexOf(multiSel.lastCol);
    const b = rowCols.indexOf(col);
    if (a === -1 || b === -1) return false;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    multiSel.cols.forEach(c => c.classList.remove('selected','multi-selected'));
    multiSel.cols.clear();
    for (let i = lo; i <= hi; i++) {
      rowCols[i].classList.add('selected', 'multi-selected');
      multiSel.cols.add(rowCols[i]);
    }
    multiSel.lastCol = col;
    if (multiSel.cols.size > 1) { showMultiSelPanel(); return true; }
    if (multiSel.cols.size === 1) { clearMultiSel(); return false; }
    return true;
  }
  return false;
}

/* Cmd+D: 선택 블록 복제 (freeLayout = offset +20px, 섹션 = insertAfter) */
function duplicateSelected() {
  // freeLayout 프레임 내 블록 복제 (absolute 배치)
  const selBlock = document.querySelector(
    '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
    '.icon-circle-block.selected, .shape-block.selected, .divider-block.selected, ' +
    '.graph-block.selected, .table-block.selected, ' +
    '.label-group-block.selected, .icon-text-block.selected'
  );
  const selSS = document.querySelector('.frame-block.selected:not([data-text-frame])');
  const selSection = document.querySelector('.section-block.selected');

  // freeLayout 내 절대 배치 블록: text-frame 또는 shape-frame 래퍼 복제
  if (selBlock) {
    const absWrapper = selBlock.closest('.frame-block[data-text-frame], .frame-block[data-shape-frame]') ||
                       (selBlock.style.position === 'absolute' ? selBlock : null);
    const parentFrame = absWrapper?.closest('.frame-block[data-free-layout]');
    if (absWrapper && parentFrame) {
      window.pushHistory('복제');
      const clone = absWrapper.cloneNode(true);
      // 새 id 생성
      clone.id = 'ss_' + Math.random().toString(36).slice(2, 9);
      clone.querySelectorAll('[id]').forEach(el => {
        const prefix = el.id.split('_')[0] || 'el';
        el.id = prefix + '_' + Math.random().toString(36).slice(2, 9);
      });
      // 오프셋 +20px
      const origLeft = parseInt(absWrapper.style.left || '0');
      const origTop  = parseInt(absWrapper.style.top  || '0');
      clone.style.left = (origLeft + 20) + 'px';
      clone.style.top  = (origTop  + 20) + 'px';
      clone.dataset.offsetX = String(origLeft + 20);
      clone.dataset.offsetY = String(origTop  + 20);
      parentFrame.appendChild(clone);
      // 이벤트 재바인딩
      clone.querySelectorAll('.text-block, .shape-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .graph-block, .divider-block, .icon-text-block, .canvas-block, .vector-block').forEach(b => {
        delete b._blockBound;
        window.bindBlock?.(b);
      });
      clone._dragBound = false;
      clone._subSecBound = false;
      window.bindFrameDropZone?.(clone);
      // 기존 선택 해제 후 복제본 선택
      deselectAll();
      const cloneBlock = clone.querySelector('.text-block, .shape-block, .asset-block') || clone;
      cloneBlock.classList.add('selected');
      parentFrame.closest('.section-block')?.classList.add('selected');
      window.buildLayerPanel?.();
      window.pushHistory('복제 완료');
      return;
    }
  }

  // freeLayout 프레임 자체 복제 (frame-block.selected)
  if (selSS && !selSS.dataset.freeLayout) {
    copySelected();
    pasteClipboard();
    return;
  }

  // 섹션 복제
  if (selSection) {
    copySelected();
    pasteClipboard();
    return;
  }

  // 일반 flow 블록 복제
  copySelected();
  pasteClipboard();
}

function copySelected() {
  const MULTI_SEL = '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
    '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
    '.graph-block.selected, .divider-block.selected, ' +
    '.icon-text-block.selected, .shape-block.selected';

  const allSel = [...document.querySelectorAll(MULTI_SEL)];

  if (allSel.length > 1) {
    // 멀티셀렉트: DOM 순서대로 고유 행 수집 (같은 row 중복 방지)
    const seen = new Set();
    const items = [];
    allSel.forEach(block => {
      let ref;
      if (block.classList.contains('shape-block')) {
        const ss = block.closest('.frame-block');
        ref = ss?.closest('.row') || ss || block;
      } else if (block.classList.contains('gap-block')) {
        ref = block;
      } else {
        ref = block.closest('.row') || block;
      }
      if (!seen.has(ref)) {
        seen.add(ref);
        items.push({ html: ref.outerHTML });
      }
    });
    clipboard = { type: 'multi-block', items };
    return;
  }

  // 단건 copy
  const selBlock   = allSel[0] || null;
  const selShape   = selBlock?.classList.contains('shape-block') ? selBlock : null;
  const selNormal  = selShape ? null : selBlock;
  const selSS      = document.querySelector('.frame-block.selected');
  const selRow     = document.querySelector('.row.row-active');
  const selSection = document.querySelector('.section-block.selected');

  if (selShape) {
    const ss = selShape.closest('.frame-block');
    const rowEl = ss?.closest('.row') || ss || selShape;
    clipboard = { type: 'block', html: rowEl.outerHTML };
  } else if (selNormal) {
    const isGapSel = selNormal.classList.contains('gap-block');
    const target = isGapSel ? selNormal : (selNormal.closest('.row') || selNormal);
    clipboard = { type: 'block', html: target.outerHTML };
  } else if (selSS) {
    // 서브섹션은 row > col > frame-block 구조이므로 row 단위로 복사
    const rowEl = selSS.closest('.row') || selSS;
    clipboard = { type: 'block', html: rowEl.outerHTML };
  } else if (selRow) {
    clipboard = { type: 'block', html: selRow.outerHTML };
  } else if (selSection) {
    clipboard = { type: 'section', html: selSection.outerHTML };
  }
}

/* 붙여넣기 후 블록 이벤트 재바인딩 공통 함수 */
function _bindPastedEl(el) {
  const rand = () => Math.random().toString(36).slice(2, 9);
  const BLOCK_SEL = '.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .icon-text-block, .shape-block, .joker-block';

  // 모든 ID 재생성 — 원본과 ID 충돌 방지
  el.querySelectorAll('[id]').forEach(child => {
    const prefix = child.id.split('_')[0] || 'el';
    child.id = `${prefix}_${rand()}`;
  });
  if (el.id) {
    const prefix = el.id.split('_')[0] || 'el';
    el.id = `${prefix}_${rand()}`;
  }

  // frame-block 재바인딩 — el 자체 포함
  const frames = [...el.querySelectorAll('.frame-block')];
  if (el.classList.contains('frame-block')) frames.unshift(el);
  frames.forEach(ss => {
    ss._subSecBound = false;
    window.bindFrameDropZone?.(ss);
  });

  // 일반 블록 재바인딩 — el 자체 포함 (_blockBound 리셋 후)
  const blocks = [...el.querySelectorAll(BLOCK_SEL)];
  if (el.matches?.(BLOCK_SEL)) blocks.unshift(el);
  blocks.forEach(b => {
    b._blockBound = false;
    window.bindBlock(b);
  });
}

function pasteClipboard() {
  if (!clipboard) return;
  // 현재 DOM 상태가 마지막 히스토리와 다르면 체크포인트 저장
  // (block-factory.js가 push-before라서 최신 N개 블록 상태가 히스토리에 없는 경우 대비)
  window.ensureHistoryCheckpoint?.('붙여넣기 전');

  if (clipboard.type === 'multi-block') {
    const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
    if (!sec) return;
    let lastEl = null;
    clipboard.items.forEach(item => {
      const temp = document.createElement('div');
      temp.innerHTML = item.html;
      const el = temp.firstElementChild;
      if (!el) return;
      if (lastEl) {
        lastEl.after(el);
      } else {
        const pasteHasSS = el.classList.contains('frame-block') || !!el.querySelector('.frame-block');
        const savedActiveSS = window._activeFrame;
        if (pasteHasSS) window._activeFrame = null;
        insertAfterSelected(sec, el);
        if (pasteHasSS) window._activeFrame = savedActiveSS;
      }
      _bindPastedEl(el);
      lastEl = el;
    });
    window.buildLayerPanel();
    pushHistory('붙여넣기');
    return;
  }

  const temp = document.createElement('div');
  temp.innerHTML = clipboard.html;
  const el = temp.firstElementChild;

  if (clipboard.type === 'section') {
    const genIdFn = window.genId || ((p) => p + '_' + Math.random().toString(36).slice(2, 9));
    el.id = genIdFn('sec');
    el.querySelectorAll('[id]').forEach(child => {
      const prefix = child.id.split('_')[0] || 'el';
      child.id = genIdFn(prefix);
    });
    const refSection = getSelectedSection();
    if (refSection) {
      refSection.after(el);
    } else {
      canvasEl.appendChild(el);
    }
    bindSectionDelete(el);
    bindSectionOrder(el);
    bindSectionDrag(el);
    bindSectionDropZone(el);
    _bindPastedEl(el);
    el.addEventListener('click', e2 => { e2.stopPropagation(); selectSectionWithModifier(el, e2); });
  } else {
    const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
    if (!sec) return;
    const pasteHasSS = el.classList.contains('frame-block') || !!el.querySelector('.frame-block');
    const savedActiveSS = window._activeFrame;
    if (pasteHasSS) window._activeFrame = null;
    insertAfterSelected(sec, el);
    if (pasteHasSS) window._activeFrame = savedActiveSS;
    _bindPastedEl(el);
  }
  window.buildLayerPanel();
  pushHistory('붙여넣기');
}

// Option 키 독립 추적 (Korean IME가 altKey를 먹어버리는 문제 대응)
window._optionKeyHeld = false;
document.addEventListener('keydown', e => { if (e.code === 'AltLeft' || e.code === 'AltRight') window._optionKeyHeld = true; }, true);
document.addEventListener('keyup',   e => { if (e.code === 'AltLeft' || e.code === 'AltRight') window._optionKeyHeld = false; }, true);

document.addEventListener('keydown', e => {
  // contenteditable 편집 중: 에디터 전역 단축키 차단
  // (단, Escape는 element 레벨에서 stopPropagation으로 처리 / Cmd 단축키는 통과)
  if (document.activeElement?.isContentEditable && !e.metaKey && !e.ctrlKey) return;

  if (e.metaKey || e.ctrlKey) {
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      document.body.classList.contains('preview-mode') ? window.previewZoomStep?.(10) : zoomStep(10);
    }
    if (e.key === '-') {
      e.preventDefault();
      document.body.classList.contains('preview-mode') ? window.previewZoomStep?.(-10) : zoomStep(-10);
    }
    if (e.key === '0')                  { e.preventDefault(); applyZoom(100); }
    if (e.key === 'z' && !e.shiftKey)   { if (document.activeElement?.isContentEditable) return; e.preventDefault(); undo(); return; }
    if (e.key === 'z' && e.shiftKey)    { if (document.activeElement?.isContentEditable) return; e.preventDefault(); redo(); return; }
    if (e.key === 's' && !e.shiftKey)   { e.preventDefault(); saveProject(); return; }
    if (e.key === 's' && e.shiftKey)    { e.preventDefault(); saveProjectAs(); return; }
    if (e.key === 'b' && !e.shiftKey) {
      // 텍스트 편집 중일 때만 bold 토글
      if (document.activeElement?.isContentEditable || document.querySelector('.text-block.editing')) {
        e.preventDefault();
        document.getElementById('txt-bold-btn')?.click();
        return;
      }
    }
    if (e.key === 'i' && !e.shiftKey) {
      // 텍스트 편집 중일 때만 italic 토글
      if (document.activeElement?.isContentEditable || document.querySelector('.text-block.editing')) {
        e.preventDefault();
        document.getElementById('txt-italic-btn')?.click();
        return;
      }
    }
    if (e.key === 'c') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      copySelected();
      return;
    }
    if (e.key === 'v') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      pasteClipboard();
      return;
    }
    if (e.key === 'd') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      duplicateSelected();
      return;
    }
    if (e.code === 'BracketLeft') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      moveSelectedBlocks('up');
      return;
    }
    if (e.code === 'BracketRight') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      moveSelectedBlocks('down');
      return;
    }
    if (e.code === 'KeyG' && !e.shiftKey && (e.altKey || window._optionKeyHeld || e.key === '©')) {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      window.wrapSelectedBlocksInFrame?.();
      return;
    }
    if (e.code === 'KeyG' && !e.shiftKey && !e.altKey && !window._optionKeyHeld && e.key !== '©') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      window.groupSelectedBlocks?.();
      return;
    }
    if (e.code === 'KeyG' && e.shiftKey) {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      const selGroup = document.querySelector('.group-block.group-selected');
      if (selGroup) window.ungroupBlock?.(selGroup);
      return;
    }
    if (e.key === 'a') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      // 현재 선택된 섹션 내 모든 블록 선택
      const activeSec = document.querySelector('.section-block.selected') || document.querySelector('.section-block');
      if (activeSec) {
        const allBlocks = activeSec.querySelectorAll(
          '.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, ' +
          '.label-group-block, .graph-block, .divider-block, .icon-text-block, .canvas-block, .vector-block'
        );
        allBlocks.forEach(b => b.classList.add('selected'));
      }
      return;
    }
  }
  // `: 핀 추가 모드 토글 (왼손 단독 조작)
  if (e.code === 'Backquote' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
    if (document.activeElement?.isContentEditable) return;
    e.preventDefault();
    window.togglePinMode?.();
    return;
  }

  if (e.key === 'Escape') {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    // group-editing 중이면 editing만 해제, 선택은 유지
    const editingGroup = document.querySelector('.group-block.group-editing');
    if (editingGroup) {
      editingGroup.classList.remove('group-editing');
      return;
    }
    deselectAll();
  }

  // 블록 추가 단축키: G=Gap, T=Text, A=Asset (IME 안전: e.code 사용)
  if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.code === 'KeyG') { e.preventDefault(); window.addGapBlock?.(); return; }
    if (e.code === 'KeyT') { e.preventDefault(); window.addTextBlock?.('body'); return; }
    if (e.code === 'KeyA') { e.preventDefault(); window.addAssetBlock?.(); return; }

    // Enter → 선택된 텍스트 블록 편집 모드 진입
    if (e.code === 'Enter') {
      const tb = document.querySelector('.text-block.selected');
      if (tb && typeof tb._enterTextEditMode === 'function') {
        e.preventDefault();
        tb._enterTextEditMode();
        return;
      }
    }

    // 텍스트 타입 단축키: 1=H1, 2=H2, 3=H3, 4=Body (텍스트 편집 중이면 무시)
    if (['Digit1','Digit2','Digit3','Digit4'].includes(e.code)) {
      if (document.querySelector('.text-block.editing')) return; // 편집 중 차단
      const tb = document.querySelector('.text-block.selected');
      if (!tb) return;
      e.preventDefault();
      const typeMap = { 'Digit1': ['tb-h1','heading'], 'Digit2': ['tb-h2','heading'], 'Digit3': ['tb-h3','heading'], 'Digit4': ['tb-body','body'] };
      const phMap = { 'tb-h1':'제목을 입력하세요', 'tb-h2':'소제목을 입력하세요', 'tb-h3':'소항목을 입력하세요', 'tb-body':'본문 내용을 입력하세요.' };
      const [cls, dtype] = typeMap[e.code];
      const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label');
      if (!contentEl) return;
      window.pushHistory?.();
      contentEl.className = cls;
      tb.dataset.type = dtype;
      // TODO-QA: 타입 변환 시 data-placeholder 텍스트도 새 타입에 맞게 갱신
      if (contentEl.dataset.isPlaceholder === 'true' && phMap[cls]) {
        contentEl.dataset.placeholder = phMap[cls];
        contentEl.innerHTML = phMap[cls];
      } else if (phMap[cls]) {
        contentEl.dataset.placeholder = phMap[cls];
      }
      window.showTextProperties?.(tb);
      return;
    }
  }

  // ── 키보드 Nudge: 블록 이동 Cmd+방향키 (편집 중이거나 입력 포커스 시 무시) ──
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && (e.metaKey || e.ctrlKey)) {
    if (document.querySelector('.text-block.editing, .label-group-block.editing')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    const selBlock = document.querySelector(
      '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
      '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
      '.graph-block.selected, .divider-block.selected, .icon-text-block.selected, .canvas-block.selected, .vector-block.selected'
    );
    const selSection = document.querySelector('.section-block.selected');
    const moveTarget = selBlock
      ? (selBlock.classList.contains('gap-block') ? selBlock : (selBlock.closest('.row') || selBlock))
      : selSection;
    if (moveTarget) {
      e.preventDefault();
      const parent = moveTarget.parentElement;
      if (!parent) return;
      if (e.key === 'ArrowUp') {
        const prev = moveTarget.previousElementSibling;
        if (prev && !prev.classList.contains('drop-indicator')) parent.insertBefore(moveTarget, prev);
      } else {
        const next = moveTarget.nextElementSibling;
        if (next && !next.classList.contains('drop-indicator')) parent.insertBefore(next, moveTarget);
      }
      // 이동 전 선택 상태 수집
      const moveTargetId = moveTarget.id;
      const selBlockIds = selBlock ? [selBlock.id].filter(Boolean) : [];
      const selSectionId = selSection ? selSection.id : null;
      window.buildLayerPanel();
      pushHistory('블록 이동');
      // buildLayerPanel 후 선택 상태 복원
      if (selSectionId) {
        const sec = document.getElementById(selSectionId);
        if (sec) {
          sec.classList.add('selected');
          if (sec._layerItem) { sec._layerItem.classList.add('active'); sec._layerItem.style.background = 'var(--ui-bg-card)'; }
        }
      }
      selBlockIds.forEach(id => {
        const b = document.getElementById(id);
        if (!b) return;
        b.classList.add('selected');
        if (b._layerItem) { b._layerItem.classList.add('active'); b._layerItem.style.background = 'var(--ui-bg-card)'; }
      });
      return;
    }
  }

  const isDelete = e.key === 'Delete' || e.key === 'Backspace';
  if (isDelete) {
    // 텍스트 편집 중이거나 input에 포커스가 있으면 기본 동작 유지
    if (document.querySelector('.text-block.editing, .label-group-block.editing')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    // 이미지 편집 모드 중이면 이미지 삭제
    const imgEditBlock = document.querySelector('.asset-block.img-editing');
    if (imgEditBlock) {
      e.preventDefault();
      clearAssetImage(imgEditBlock);
      return;
    }

    // 다중 선택 삭제: col 다중
    if (multiSel.cols.size > 1) {
      e.preventDefault();
      multiSel.cols.forEach(col => {
        const row = col.closest('.row');
        col.remove();
        if (row && !row.querySelector('.col')) row.remove();
      });
      clearMultiSel();
      deselectAll();
      window.buildLayerPanel();
      pushHistory('열 삭제');
      return;
    }
    // 다중 선택 삭제: section 다중
    if (multiSel.sections.size > 1) {
      e.preventDefault();
      const allSecs = canvasEl.querySelectorAll('.section-block');
      const toDelete = [...multiSel.sections];
      ensureHistoryCheckpoint('섹션 다중 삭제 전');
      toDelete.forEach(s => s.remove());
      clearMultiSel();
      deselectAll();
      if (!canvasEl.querySelector('.section-block')) window.addGhostSection?.();
      window.buildLayerPanel();
      pushHistory('섹션 삭제');
      return;
    }
    const selText    = document.querySelector('.text-block.selected');
    const selAsset   = document.querySelector('.asset-block.selected');
    const selGap     = document.querySelector('.gap-block.selected');
    const selSection = document.querySelector('.section-block.selected');

    // group-block(프레임) selected → group-block 전체 삭제
    const selGroup = document.querySelector('.group-block.group-selected:not(.group-editing)');
    if (selGroup) {
      e.preventDefault();
      window.ensureHistoryCheckpoint?.('삭제 전');
      selGroup.remove();
      deselectAll();
      window.buildLayerPanel();
      pushHistory('프레임 삭제');
      return;
    }

    // 서브섹션 selected → row 단위로 삭제 (부모 섹션 삭제 방지)
    // 단, 자식 블록이 선택된 경우 자식 블록 삭제로 처리 (프레임은 유지)
    const selSS = document.querySelector('.frame-block.selected');
    if (selSS) {
      const ssHasSelectedChild = selSS.querySelector(
        '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
        '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
        '.graph-block.selected, .divider-block.selected, .icon-text-block.selected, .canvas-block.selected, .mockup-block.selected, .icon-block.selected, .vector-block.selected, .step-block.selected'
      );
      if (!ssHasSelectedChild) {
        e.preventDefault();
        const ssRow = selSS.closest('.row') || selSS;
        ssRow.remove();
        window._activeFrame = null;
        deselectAll();
        window.buildLayerPanel();
        pushHistory('서브섹션 삭제');
        return;
      }
      // 자식 블록이 선택된 경우 → 아래 allSelBlocks 삭제 로직으로 fall-through
    }

    // shape 블록 selected (단건 or 복수) + 일반 블록 혼합 일괄 삭제
    const allSelShapes = [...document.querySelectorAll('.shape-block.selected')];
    const allSelBlocks = [...document.querySelectorAll('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected, .label-group-block.selected, .graph-block.selected, .divider-block.selected, .icon-text-block.selected, .canvas-block.selected, .mockup-block.selected, .icon-block.selected, .vector-block.selected, .step-block.selected')];
    if (allSelShapes.length > 0 || allSelBlocks.length > 0) {
      e.preventDefault();
      window.ensureHistoryCheckpoint?.('삭제 전');
      // shape: 부모 ss/row 단위로 삭제
      const ssRowsToRemove = new Set();
      allSelShapes.forEach(shape => {
        const ss = shape.closest('.frame-block');
        const ssRow = ss?.closest('.row') || ss;
        if (ssRow) ssRowsToRemove.add(ssRow); else shape.remove();
      });
      ssRowsToRemove.forEach(r => r.remove());
      // 일반 블록 삭제
      const rowsToRemove = new Set();
      allSelBlocks.forEach(block => {
        // mockup 블록: 연결된 숨김 섹션 복원
        if (block.classList.contains('mockup-block')) {
          const secId = block.dataset.sourceSec;
          if (secId) {
            const sec = document.getElementById(secId);
            if (sec) { sec.style.display = ''; sec.dataset.mockupHidden = ''; }
          }
        }
        if (block.classList.contains('gap-block')) {
          block.remove();
        } else {
          const row = block.closest('.row');
          if (row) rowsToRemove.add(row); else block.remove();
        }
      });
      rowsToRemove.forEach(r => r.remove());
      window._activeFrame = null;
      deselectAll();
      window.buildLayerPanel();
      pushHistory('블록 삭제');
    } else {
      const selRow = document.querySelector('.row.row-active');
      if (selRow) {
        e.preventDefault();
        selRow.remove();
        deselectAll();
        window.buildLayerPanel();
        pushHistory('행 삭제');
      } else if (selSection) {
        e.preventDefault();
        if (selSection.dataset.variationGroup) {
          const gid = selSection.dataset.variationGroup;
          const grouped = [...document.querySelectorAll(`.section-block[data-variation-group="${gid}"]`)];
          grouped.forEach(s => s.remove());
          deselectAll();
          if (!canvasEl.querySelector('.section-block')) window.addGhostSection?.();
          window.buildLayerPanel();
          pushHistory('섹션 삭제');
        } else {
          selSection.remove();
          deselectAll();
          if (!canvasEl.querySelector('.section-block')) window.addGhostSection?.();
          window.buildLayerPanel();
          pushHistory('섹션 삭제');
        }
      }
    }
  }
});

applyZoom(40);

/* ═══════════════════════════════════
   SELECTION
═══════════════════════════════════ */
function selectSection(sec, scrollIntoView = false) {
  deselectAll();
  sec.classList.add('selected');
  syncLayerActive(sec);
  window.showSectionProperties(sec);
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

/* ── Design Presets ── */
// Electron에서는 preload를 통해 JSON 파일 로드, 브라우저 fallback은 하드코딩
// FIX-PR-01: PRESET_FALLBACK을 presets/*.json 내용과 동기화 (폰트·dots 불일치 수정)
// Electron은 readPresets() 성공 시 덮어쓰므로 fallback은 브라우저/race condition 시만 사용됨
const PRESET_FALLBACK = [
  {
    id: 'default', name: 'Default',
    dots: ['#111111', '#555555', '#111111'],
    variables: {
      '--preset-h1-color': '#111111', '--preset-h1-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-h2-color': '#1a1a1a', '--preset-h2-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-h3-color': '#333333', '--preset-h3-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-body-color': '#555555', '--preset-body-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-caption-color': '#999999',
      '--preset-label-bg': '#111111', '--preset-label-color': '#ffffff', '--preset-label-radius': '8px',
    },
  },
  {
    id: 'dark', name: 'Dark',
    dots: ['#ffffff', '#aaaaaa', '#2d6fe8'], // FIX-PR-01: dots를 dark.json과 동기화
    variables: {
      '--preset-h1-color': '#ffffff', '--preset-h1-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-h2-color': '#eeeeee', '--preset-h2-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-h3-color': '#cccccc', '--preset-h3-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-body-color': '#aaaaaa', '--preset-body-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-caption-color': '#666666',
      '--preset-label-bg': '#2d6fe8', '--preset-label-color': '#ffffff', '--preset-label-radius': '8px',
    },
  },
  {
    id: 'brand', name: 'Brand',
    dots: ['#1a3a6b', '#444444', '#2d6fe8'],
    variables: {
      '--preset-h1-color': '#1a3a6b', '--preset-h1-family': "'Noto Serif KR', serif",
      '--preset-h2-color': '#2d4a7a', '--preset-h2-family': "'Noto Serif KR', serif",
      '--preset-h3-color': '#3d5a8a', '--preset-h3-family': "'Noto Serif KR', serif",
      '--preset-body-color': '#444444', '--preset-body-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-caption-color': '#888888',
      '--preset-label-bg': '#2d6fe8', '--preset-label-color': '#ffffff', '--preset-label-radius': '8px',
    },
  },
  {
    id: 'minimal', name: 'Minimal',
    dots: ['#000000', '#666666', '#000000'],
    variables: {
      '--preset-h1-color': '#000000', '--preset-h1-family': "'Space Grotesk', sans-serif",
      '--preset-h2-color': '#222222', '--preset-h2-family': "'Space Grotesk', sans-serif",
      '--preset-h3-color': '#444444', '--preset-h3-family': "'Space Grotesk', sans-serif",
      '--preset-body-color': '#666666', '--preset-body-family': "'Pretendard', 'Noto Sans KR', sans-serif",
      '--preset-caption-color': '#aaaaaa',
      '--preset-label-bg': '#000000', '--preset-label-color': '#ffffff', '--preset-label-radius': '0px',
    },
  },
];

let PRESETS = PRESET_FALLBACK;

// Electron 환경 감지 → body 클래스 추가 (신호등 영역 확보 등 CSS 처리)
if (window.electronAPI) {
  document.body.classList.add('electron-app');
  window.electronAPI.getFullscreen().then(isFullscreen => {
    document.body.classList.toggle('fullscreen', isFullscreen);
  });
  window.electronAPI.onFullscreenChange(isFullscreen => {
    document.body.classList.toggle('fullscreen', isFullscreen);
  });
}

// Electron 환경이면 JSON 파일에서 프리셋 로드.
// _presetsReady: race condition 방지용 Promise — showSectionProperties 등에서 await 후 UI 렌더.
// Electron 비환경(브라우저)에서는 즉시 resolve하여 PRESET_FALLBACK 사용.
let _presetsReady;
if (window.electronAPI) {
  _presetsReady = window.electronAPI.readPresets().then(loaded => {
    if (loaded && loaded.length) {
      PRESETS = loaded.sort((a, b) => {
        const order = ['default', 'dark', 'brand', 'minimal'];
        return (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99);
      });
    }
  });
} else {
  _presetsReady = Promise.resolve();
}


function deselectAll() {
  clearMultiSel();
  _lastClickedBlock = null;
  // 텍스트 편집 중인 블록이 있으면 편집 종료 전 현재 상태 히스토리에 저장
  // (입력한 텍스트가 undo 복원 대상이 되도록)
  if (!window._historyPaused) {
    const editingBlock = canvasEl?.querySelector('.text-block.editing, .icon-text-block.editing, .label-group-block.editing');
    if (editingBlock) pushHistory('텍스트 편집');
  }
  // perf(qa-perf): canvas/layerPanel 범위 한정으로 document 전체 탐색 제거
  const canvas = canvasEl;
  const layerPanel = document.getElementById('layer-panel-body');

  // canvas 내 블록 선택 해제 (단일 querySelectorAll 순회)
  canvas.querySelectorAll('.col').forEach(c => c.classList.remove('multi-selected', 'selected'));
  canvas.querySelectorAll('.group-block').forEach(g => g.classList.remove('group-selected', 'group-editing'));
  canvas.querySelectorAll('.section-block').forEach(s => s.classList.remove('selected'));
  canvas.querySelectorAll('.text-block').forEach(t => {
    t.classList.remove('selected', 'editing');
    t.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('contenteditable','false'));
  });
  canvas.querySelectorAll('.asset-block').forEach(a => {
    a.classList.remove('selected');
    window.exitImageEditMode?.(a);
  });
  canvas.querySelectorAll('.gap-block, .icon-circle-block, .graph-block, .divider-block, .icon-text-block, .joker-block, .shape-block, .canvas-block, .mockup-block, .icon-block, .vector-block, .step-block, .chat-block').forEach(b => b.classList.remove('selected'));
  canvas.querySelectorAll('.label-group-block').forEach(b => {
    b.classList.remove('selected', 'editing');
    b.querySelectorAll('.label-item').forEach(i => i.classList.remove('item-selected'));
    b.querySelectorAll('.label-item-text').forEach(el => el.setAttribute('contenteditable','false'));
  });
  canvas.querySelectorAll('.table-block').forEach(b => {
    b.classList.remove('selected');
    b.querySelectorAll('[contenteditable="true"]').forEach(el => el.setAttribute('contenteditable','false'));
  });
  canvas.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));

  // 레이어 패널 선택 해제
  if (layerPanel) {
    layerPanel.querySelectorAll('.layer-section-header').forEach(h => h.classList.remove('active'));
    layerPanel.querySelectorAll('.layer-item').forEach(i => { i.classList.remove('active'); i.style.background = ''; });
    layerPanel.querySelectorAll('.layer-row-header').forEach(h => h.classList.remove('active'));
  }

  if (window.setRpIdBadge) window.setRpIdBadge(null);
  window._activeFrame = null;
  window.hideFrameHandles?.();
  window.hideMockupHandles?.();
  window.hideIconHandles?.();
  window.hideAssetRadiusHandles?.();
  window.hideAssetResizeHandles?.();
  window.hideCanvasRadiusHandles?.();
  window.hideCanvasResizeHandles?.();
  window.hideVectorResizeHandles?.();
  canvas.querySelectorAll('.frame-block').forEach(s => s.classList.remove('selected'));
  window.showPageProperties();
}


/* ═══════════════════════════════════
   블록 순서 이동 — Cmd+[ (위) / Cmd+] (아래)
   이동 단위: section-inner 또는 frame-block 직속 .row / .gap-block
═══════════════════════════════════ */
function moveSelectedBlocks(direction) {
  // 프레임(frame-block)이 선택된 경우 별도 처리
  const selFrame = window._activeFrame;
  if (selFrame && selFrame.classList.contains('selected')) {
    const sectionInner = selFrame.closest('.section-inner');
    if (!sectionInner) return;
    const containerItems = [...sectionInner.children].filter(c =>
      c.classList.contains('row') || c.classList.contains('gap-block') || c.classList.contains('frame-block')
    );
    const idx = containerItems.indexOf(selFrame);
    if (direction === 'up') {
      if (idx <= 0) return;
      window.ensureHistoryCheckpoint?.('이동 전');
      containerItems[idx - 1].before(selFrame);
    } else {
      if (idx >= containerItems.length - 1) return;
      window.ensureHistoryCheckpoint?.('이동 전');
      containerItems[idx + 1].after(selFrame);
    }
    pushHistory(direction === 'up' ? '프레임 위로 이동' : '프레임 아래로 이동');
    window.buildLayerPanel?.();
    // 선택 상태 복원
    selFrame.classList.add('selected');
    window._activeFrame = selFrame;
    if (selFrame._layerItem) {
      selFrame._layerItem.classList.add('active');
      selFrame._layerItem.style.background = 'var(--ui-bg-card)';
    }
    return;
  }

  const BLOCK_SEL = '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
    '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
    '.graph-block.selected, .divider-block.selected, ' +
    '.icon-text-block.selected, .shape-block.selected';

  const selBlocks = [...document.querySelectorAll(BLOCK_SEL)];
  if (selBlocks.length === 0) return;

  // 각 블록의 이동 단위(row or gap-block)를 DOM 순서대로 수집
  const getUnit = b => b.classList.contains('gap-block')
    ? (b.parentElement?.classList.contains('section-inner') || b.parentElement?.classList.contains('frame-block') ? b : b.closest('.row'))
    : b.closest('.row');

  const unitSet = new Set();
  selBlocks.forEach(b => { const u = getUnit(b); if (u) unitSet.add(u); });
  if (unitSet.size === 0) return;

  // 공통 컨테이너(section-inner / frame-block)가 동일한 unit들만 처리
  const units = [...unitSet];
  const container = units[0].parentElement;
  if (!units.every(u => u.parentElement === container)) return; // 다른 컨테이너 혼합 → 무시

  // 컨테이너의 직속 자식(row/gap-block)만 포함하는 목록
  const containerItems = [...container.children].filter(c =>
    c.classList.contains('row') || c.classList.contains('gap-block')
  );

  // DOM 순서대로 정렬
  units.sort((a, b) => containerItems.indexOf(a) - containerItems.indexOf(b));

  if (direction === 'up') {
    const firstIdx = containerItems.indexOf(units[0]);
    if (firstIdx <= 0) return; // 이미 맨 위
    window.ensureHistoryCheckpoint?.('이동 전');
    const pivot = containerItems[firstIdx - 1]; // 선택 그룹 바로 위 아이템
    pivot.before(...units); // pivot 앞에 units 통째로 삽입 (순서 유지)
  } else {
    const lastIdx = containerItems.indexOf(units[units.length - 1]);
    if (lastIdx >= containerItems.length - 1) return; // 이미 맨 아래
    window.ensureHistoryCheckpoint?.('이동 전');
    const pivot = containerItems[lastIdx + 1]; // 선택 그룹 바로 아래 아이템
    // pivot 뒤에 units 순서 유지하며 삽입: 마커로 삽입 위치 고정
    const marker = document.createComment('mv');
    pivot.after(marker);
    units.forEach(u => marker.before(u));
    marker.remove();
  }

  // 이동 전 선택된 블록 ID 저장
  const selIds = selBlocks.map(b => b.id).filter(Boolean);

  pushHistory(direction === 'up' ? '블록 위로 이동' : '블록 아래로 이동');
  window.buildLayerPanel?.();

  // buildLayerPanel 후 선택 상태 복원 (layer panel active 포함)
  selIds.forEach(id => {
    const b = document.getElementById(id);
    if (!b) return;
    b.classList.add('selected');
    if (b._layerItem) {
      b._layerItem.classList.add('active');
      b._layerItem.style.background = 'var(--ui-bg-card)';
    }
  });
}
window.moveSelectedBlocks = moveSelectedBlocks;

function bindSectionDelete(sec) {
  // 삭제 버튼 제거됨 — 레이어 패널 또는 컨텍스트 메뉴에서 처리
}

function bindSectionOrder(sec) {
  // 순서 버튼 제거됨 — 드래그 또는 레이어 패널에서 처리
}

function bindSectionHitzone(sec) {
  let hz = sec.querySelector('.section-hitzone');
  if (!hz) {
    hz = document.createElement('div');
    hz.className = 'section-hitzone';
    sec.insertBefore(hz, sec.firstChild);
  }
  // 레이블이 hitzone 밖에 있으면 안으로 이동
  const label = sec.querySelector('.section-label');
  if (label && !hz.contains(label)) {
    hz.appendChild(label);
  }
  // 기존 리스너 중복 방지: 새 노드로 교체 후 바인딩
  const fresh = hz.cloneNode(true);
  hz.replaceWith(fresh);
  fresh.addEventListener('click', e => {
    e.stopPropagation();
    selectSectionWithModifier(sec, e);
  });
  fresh.addEventListener('dblclick', e => {
    e.stopPropagation();
    // 레이어 패널에서 해당 섹션 항목으로 스크롤
    const layerEl = sec._layerSectionEl
      || document.querySelector(`.layer-section[data-sec-id="${sec.id}"]`);
    if (layerEl) {
      layerEl.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      layerEl.querySelector('.layer-section-header')?.classList.add('active');
    }
  });
}


document.querySelectorAll('.section-block').forEach(sec => {
  sec.addEventListener('click', e => {
    e.stopPropagation();
    selectSectionWithModifier(sec, e);
    // deselectAll() 이후 row-active 복원
    const row = e.target.closest('.row');
    if (row && !e.target.closest('.text-block, .asset-block, .gap-block, .col-placeholder, .icon-circle-block, .table-block, .graph-block, .divider-block, .label-group-block, .icon-text-block, .canvas-block, .vector-block')) {
      document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
      row.classList.add('row-active');
      if (window.syncLayerRow) window.syncLayerRow(row);
    }
  });
  bindSectionDelete(sec);
  bindSectionOrder(sec);
  bindSectionDropZone(sec);
  bindSectionDrag(sec);
  bindSectionHitzone(sec);
});

document.getElementById('canvas-wrap').addEventListener('click', e => {
  if (['canvas-wrap','canvas-scaler','canvas'].includes(e.target.id)) deselectAll();
});


/* ── Static 블록 초기 바인딩 ── */
document.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .graph-block, .divider-block, .icon-text-block, .canvas-block, .icon-block, .mockup-block, .vector-block, .step-block').forEach(b => window.bindBlock(b));

/* ═══════════════════════════════════
   BLOCK / SECTION 추가
═══════════════════════════════════ */

function getSelectedSection() {
  const secSel = document.querySelector('.section-block.selected');
  if (secSel) return secSel;
  // sub-section 선택 시 부모 섹션 반환
  const selSS = document.querySelector('.frame-block.selected');
  if (selSS) return selSS.closest('.section-block') || null;
  const selBlock = document.querySelector(
    '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
    '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
    '.graph-block.selected, ' +
    '.divider-block.selected, .icon-text-block.selected'
  );
  return selBlock?.closest('.section-block') || null;
}

/* ── 섹션 삭제 API ── */
function deleteSection(secIdOrEl) {
  const sec = typeof secIdOrEl === 'string'
    ? document.getElementById(secIdOrEl)
    : secIdOrEl;
  if (!sec || !sec.classList.contains('section-block')) {
    console.warn('[deleteSection] 유효한 섹션을 찾을 수 없음:', secIdOrEl);
    return false;
  }
  // 마지막 섹션 삭제 방지
  const allSecs = canvasEl.querySelectorAll('.section-block');
  if (allSecs.length <= 1) {
    console.warn('[deleteSection] 마지막 섹션은 삭제할 수 없습니다.');
    return false;
  }
  pushHistory('섹션 삭제 전');
  sec.remove();
  deselectAll();
  window.buildLayerPanel?.();
  window.triggerAutoSave?.();
  return true;
}
window.deleteSection = deleteSection;

/* ── 플로팅 패널 드롭다운 ── */
function toggleFpPluginPanel() {
  const panel = document.getElementById('fp-plugin-panel');
  const btn   = document.getElementById('fp-plugin-btn');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  btn?.classList.toggle('active', !isOpen);
}
window.toggleFpPluginPanel = toggleFpPluginPanel;

// 외부 클릭 시 plugin panel 닫기는 아래 document.addEventListener('click') 에서 처리

function toggleFpDropdown(id) {
  const targetId = id || 'fp-text-dropdown';
  const target = document.getElementById(targetId);
  if (!target) return;
  const wasOpen = target.classList.contains('open');
  document.querySelectorAll('.fp-dropdown').forEach(d => d.classList.remove('open'));
  if (!wasOpen) target.classList.add('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.fp-dropdown')) {
    document.querySelectorAll('.fp-dropdown').forEach(d => d.classList.remove('open'));
  }
  // plugin panel 외부 클릭 시 닫기
  const fpPlugin = document.getElementById('fp-plugin-panel');
  if (fpPlugin && fpPlugin.style.display !== 'none' &&
      !e.target.closest('#fp-plugin-panel') && !e.target.closest('#fp-plugin-btn')) {
    fpPlugin.style.display = 'none';
    document.getElementById('fp-plugin-btn')?.classList.remove('active');
  }
  const bdw = document.getElementById('branch-dropdown-wrap');
  if (bdw && !bdw.contains(e.target)) bdw.classList.remove('open');
  if (!e.target.closest('.col-add-btn') && !e.target.closest('.col-add-menu')) {
    document.querySelectorAll('.col-add-menu').forEach(m => m.style.display = 'none');
  }
});


/* ═══════════════════════════════════
   CANVAS PAN (Space + Drag) — transform offset 방식
═══════════════════════════════════ */
{
  const canvasWrap = document.getElementById('canvas-wrap');
  let panMode = false;
  let panning = false;
  let panStart = null;
  let panOffsetStart = null;

  function isTyping() {
    const el = document.activeElement;
    return el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
  }

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !isTyping()) {
      e.preventDefault();
      if (!panMode) {
        panMode = true;
        canvasWrap.classList.add('pan-mode');
      }
    }
  });

  document.addEventListener('keyup', e => {
    if (e.code === 'Space') {
      panMode = false;
      panning = false;
      canvasWrap.classList.remove('pan-mode', 'panning');
    }
  });

  // capture 단계: 하위 요소 stopPropagation 우회
  canvasWrap.addEventListener('mousedown', e => {
    if (!panMode || e.button !== 0) return;
    panning = true;
    panStart = { x: e.clientX, y: e.clientY };
    panOffsetStart = { x: panOffsetX, y: panOffsetY };
    canvasWrap.classList.add('panning');
    e.preventDefault();
    e.stopPropagation();
  }, true);

  window.addEventListener('mousemove', e => {
    if (!panning) return;
    panOffsetX = panOffsetStart.x + (e.clientX - panStart.x);
    panOffsetY = panOffsetStart.y + (e.clientY - panStart.y);
    _applyScalerTransform();
    if (window.updateNotchPosition) window.updateNotchPosition();
  });

  window.addEventListener('mouseup', () => {
    if (!panning) return;
    panning = false;
    if (panMode) canvasWrap.classList.remove('panning');
  });
}

/* ═══════════════════════════════════
   CENTER NOTCH BAR
═══════════════════════════════════ */
{
  const canvasWrap = document.getElementById('canvas-wrap');
  const notchBar   = document.getElementById('canvas-notch-bar');
  const notch      = document.getElementById('canvas-notch');

  let _notchHideTimer = null;

  function updateNotchPosition() {
    // panOffset 기준으로 노치 위치 표시 (0 = 중앙)
    const isCentered = Math.abs(panOffsetX) < 5 && Math.abs(panOffsetY) < 5;
    notch.classList.toggle('centered', isCentered);
    // 노치 위치: pill 가로 중앙 기준으로 offset 반영
    const pill = 80;
    const clampedX = Math.max(4, Math.min(pill - 4, pill / 2 - panOffsetX / 10));
    notch.style.left = clampedX + 'px';

    if (!isCentered) {
      notchBar.classList.add('visible');
      clearTimeout(_notchHideTimer);
      _notchHideTimer = setTimeout(() => {
        if (Math.abs(panOffsetX) < 5 && Math.abs(panOffsetY) < 5)
          notchBar.classList.remove('visible');
      }, 2500);
    }
  }
  window.updateNotchPosition = updateNotchPosition;

  notchBar.addEventListener('click', () => {
    // 팬 오프셋 리셋 (애니메이션)
    scaler.style.transition = 'transform 0.3s ease';
    resetPanOffset();
    setTimeout(() => { scaler.style.transition = ''; }, 320);
    notchBar.classList.remove('visible');
  });

  setTimeout(updateNotchPosition, 100);
}

/* ── Col 클릭: capture-phase ── */
canvasEl.addEventListener('click', e => {
  const col = e.target.closest('.col');
  if (!col) return;
  // 블록 클릭은 블록 핸들러에게 위임
  if (e.target.closest('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .graph-block, .divider-block, .label-group-block, .icon-text-block, .canvas-block, .vector-block')) return;
  // col-add 버튼/메뉴는 통과 (메뉴 열기 동작 유지)
  if (e.target.closest('.col-add-btn, .col-add-menu')) return;

  const row = col.closest('.row');
  if (!row) return;

  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    e.stopPropagation();
    selectColWithModifier(col, e);
    return;
  }

  e.stopPropagation();
  const isRowActive = row.classList.contains('row-active');

  if (!isRowActive) {
    // 1번 클릭: Row 활성화
    const sec = row.closest('.section-block');
    if (sec) selectSection(sec);
    document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
    row.classList.add('row-active');
    if (window.syncLayerRow) window.syncLayerRow(row);
    if (window.showRowProperties) window.showRowProperties(row);
  }
  // 일반 클릭 후 lastCol 설정 (clearMultiSel 이후이므로 selectSection 호출 다음에 설정)
  multiSel.lastCol = col;
}, true);
// window 할당을 initApp() 보다 먼저 — save-load.js의 initApp 내부에서 참조하기 때문
// pushHistory/undo/redo/clearHistory: history.js에서 window 노출 처리
window.deselectAll = deselectAll;
window.getBlockBreadcrumb = getBlockBreadcrumb;
window.selectSection = selectSection;
window.zoomStep = zoomStep;
window.zoomFit = zoomFit;
window.applyZoom = applyZoom;
window.getPanOffset = () => ({ x: panOffsetX, y: panOffsetY });
window.setPanOffset = (x, y) => { panOffsetX = x; panOffsetY = y; _applyScalerTransform(); };
window.toggleAllSections = toggleAllSections;
window.switchToTab = switchToTab;
window.initFileTabToggle = initFileTabToggle;
window.rgbToHex = rgbToHex;
window.bindSectionDelete  = bindSectionDelete;
window.bindSectionHitzone = bindSectionHitzone;
window.bindSectionOrder = bindSectionOrder;
window.getSelectedSection = getSelectedSection;
window.toggleFpDropdown = toggleFpDropdown;
window.copySelected = copySelected;
window.pasteClipboard = pasteClipboard;

window.multiSel = multiSel;
window.clearMultiSel = clearMultiSel;
window.selectSectionWithModifier = selectSectionWithModifier;
window.selectColWithModifier = selectColWithModifier;
window.showMultiSelPanel = showMultiSelPanel;

/* ═══════════════════════════════════
   PANEL RESIZE
═══════════════════════════════════ */
(function initPanelResize() {
  const MIN_W = 180;
  const MAX_W = 480;
  const LS_KEY = 'panelLeftWidth';

  const panel = document.getElementById('panel-left');
  const handle = document.getElementById('panel-left-resize-handle');
  if (!panel || !handle) return;

  // 저장된 너비 복원
  const saved = parseInt(localStorage.getItem(LS_KEY));
  if (saved && saved >= MIN_W && saved <= MAX_W) panel.style.width = saved + 'px';

  let startX, startW;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    startW = panel.offsetWidth;
    document.body.classList.add('resizing-panel');

    const onMove = e => {
      const w = Math.min(MAX_W, Math.max(MIN_W, startW + (e.clientX - startX)));
      panel.style.width = w + 'px';
    };
    const onUp = e => {
      document.body.classList.remove('resizing-panel');
      localStorage.setItem(LS_KEY, panel.offsetWidth);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();


// 모든 모듈 로드 후 앱 초기화
initApp();

/* ═══════════════════════════════════
   EXPORTS
═══════════════════════════════════ */
export {
  pushHistory,
  undo,
  redo,
  deselectAll,
  getBlockBreadcrumb,
  selectSection,
  zoomStep,
  zoomFit,
  applyZoom,
  toggleAllSections,
  switchToTab,
  initFileTabToggle,
  rgbToHex,
  PRESETS,
  _presetsReady,
  bindSectionDelete,
  bindSectionOrder,
  getSelectedSection,
  toggleFpDropdown,
  copySelected,
  pasteClipboard,
  selectSectionWithModifier,
  selectColWithModifier,
  clearMultiSel,
};
// 위 export의 pushHistory/undo/redo는 history.js에서 import된 것을 re-export함

// (window 할당은 initApp() 호출 전 블록에서 처리됨)

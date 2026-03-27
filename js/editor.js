import { canvasEl, propPanel, state } from './globals.js';

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
  document.getElementById('branch-panel-body').style.display    = tabName === 'branch'    ? '' : 'none';
  document.getElementById('inspector-panel-body').style.display = tabName === 'inspector' ? '' : 'none';
  const collapseBtn = document.getElementById('layer-collapse-all');
  if (collapseBtn) collapseBtn.style.display = tabName === 'file' ? '' : 'none';
  if (tabName === 'branch') window.renderBranchPanel();
  if (tabName === 'inspector') window.renderInspectorPanel();
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
  currentZoom = Math.min(150, Math.max(25, z));
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

function pushHistory(action = '작업') {
  if (_historyPaused) return;
  historyStack = historyStack.slice(0, historyPos + 1);
  historyStack.push({ canvas: getSerializedCanvas(), settings: { ...state.pageSettings }, action, pageId: state.currentPageId });
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
  else historyPos++;
  _updateUndoRedoBtns();
}

function _updateUndoRedoBtns() {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  if (undoBtn) {
    const canUndo = historyPos > 0;
    undoBtn.disabled = !canUndo;
    undoBtn.title = canUndo ? `실행 취소: ${historyStack[historyPos].action}` : '실행 취소 없음';
  }
  if (redoBtn) {
    const canRedo = historyPos < historyStack.length - 1;
    redoBtn.disabled = !canRedo;
    redoBtn.title = canRedo ? `다시 실행: ${historyStack[historyPos + 1]?.action || ''}` : '다시 실행 없음';
  }
}

function restoreSnapshot(snap) {
  _historyPaused = true;
  // 페이지가 다르면 현재 페이지 flush 후 대상 페이지로 전환
  if (snap.pageId && snap.pageId !== state.currentPageId) {
    if (window.flushCurrentPage) window.flushCurrentPage();
    state.currentPageId = snap.pageId;
    const page = state.pages?.find(p => p.id === snap.pageId);
    if (page?.pageSettings) Object.assign(state.pageSettings, page.pageSettings);
    if (window.buildFilePageSection) window.buildFilePageSection();
  }
  Object.assign(state.pageSettings, snap.settings);
  canvasEl.innerHTML = snap.canvas;
  rebindAll();
  deselectAll();
  applyPageSettings();
  if (window.buildLayerPanel) window.buildLayerPanel();
  deselectAll();
  _historyPaused = false;
  _updateUndoRedoBtns();
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

function clearHistory() {
  historyStack = [];
  historyPos   = -1;
  _updateUndoRedoBtns();
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
   복사 / 붙여넣기
══════════════════════════════════════ */
let clipboard = null;

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
  const n = multiSel.sections.size || multiSel.cols.size;
  if (!propPanel) return;
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

function copySelected() {
  const selBlock   = document.querySelector('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected, .label-group-block.selected, .card-block.selected, .strip-banner-block.selected, .graph-block.selected, .divider-block.selected');
  const selRow     = document.querySelector('.row.row-active');
  const selSection = document.querySelector('.section-block.selected');
  if (selBlock) {
    const isGapSel = selBlock.classList.contains('gap-block');
    const target = isGapSel ? selBlock : (selBlock.closest('.row') || selBlock);
    clipboard = { type: 'block', html: target.outerHTML };
  } else if (selRow) {
    clipboard = { type: 'block', html: selRow.outerHTML };
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
    el.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .strip-banner-block, .graph-block, .divider-block').forEach(b => window.bindBlock(b));
    el.querySelectorAll('.col > .col-placeholder').forEach(ph => {
      const col = ph.parentElement;
      col.replaceChild(makeColPlaceholder(col), ph);
    });
    el.addEventListener('click', e2 => { e2.stopPropagation(); selectSectionWithModifier(el, e2); });
  } else {
    const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
    if (!sec) return;
    insertAfterSelected(sec, el);
    el.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .strip-banner-block, .graph-block, .divider-block').forEach(b => window.bindBlock(b));
    el.querySelectorAll('.col > .col-placeholder').forEach(ph => {
      const col = ph.parentElement;
      col.replaceChild(makeColPlaceholder(col), ph);
    });
  }
  window.buildLayerPanel();
}

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
    if (e.key === 'd') {
      if (document.querySelector('.text-block.editing')) return;
      if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
      e.preventDefault();
      copySelected();
      pasteClipboard();
      return;
    }
  }
  if (e.key === 'Escape') deselectAll();

  // ── 키보드 Nudge: 블록 이동 Cmd+방향키 (편집 중이거나 입력 포커스 시 무시) ──
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && (e.metaKey || e.ctrlKey)) {
    if (document.querySelector('.text-block.editing, .label-group-block.editing')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    const selBlock = document.querySelector(
      '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
      '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
      '.card-block.selected, .strip-banner-block.selected, .graph-block.selected, .divider-block.selected'
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
      window.buildLayerPanel();
      pushHistory('블록 이동');
      return;
    }
  }

  const isDelete = e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey));
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
      pushHistory();
      multiSel.cols.forEach(col => {
        const row = col.closest('.row');
        col.remove();
        if (row && !row.querySelector('.col')) row.remove();
      });
      clearMultiSel();
      deselectAll();
      window.buildLayerPanel();
      return;
    }
    // 다중 선택 삭제: section 다중
    if (multiSel.sections.size > 1) {
      e.preventDefault();
      pushHistory();
      multiSel.sections.forEach(s => s.remove());
      clearMultiSel();
      deselectAll();
      window.buildLayerPanel();
      return;
    }
    const selText    = document.querySelector('.text-block.selected');
    const selAsset   = document.querySelector('.asset-block.selected');
    const selGap     = document.querySelector('.gap-block.selected');
    const selSection = document.querySelector('.section-block.selected');

    const allSelBlocks = [...document.querySelectorAll('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected, .label-group-block.selected, .card-block.selected, .strip-banner-block.selected, .graph-block.selected, .divider-block.selected')];
    if (allSelBlocks.length > 0) {
      e.preventDefault();
      pushHistory();
      const rowsToRemove = new Set();
      allSelBlocks.forEach(block => {
        if (block.classList.contains('gap-block')) {
          block.remove();
        } else {
          const row = block.closest('.row');
          if (row) rowsToRemove.add(row); else block.remove();
        }
      });
      rowsToRemove.forEach(r => r.remove());
      deselectAll();
      window.buildLayerPanel();
    } else {
      const selRow = document.querySelector('.row.row-active');
      if (selRow) {
        e.preventDefault();
        pushHistory();
        selRow.remove();
        deselectAll();
        window.buildLayerPanel();
      } else if (selSection) {
        e.preventDefault();
        pushHistory();
        if (selSection.dataset.variationGroup) {
          const gid = selSection.dataset.variationGroup;
          document.querySelectorAll(`.section-block[data-variation-group="${gid}"]`).forEach(s => s.remove());
        } else {
          selSection.remove();
        }
        deselectAll();
        window.buildLayerPanel();
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
const PRESET_FALLBACK = [
  {
    id: 'default', name: 'Default',
    dots: ['#111111', '#555555', '#111111'],
    variables: {
      '--preset-h1-color': '#111111', '--preset-h1-family': "'Noto Sans KR', sans-serif",
      '--preset-h2-color': '#1a1a1a', '--preset-h2-family': "'Noto Sans KR', sans-serif",
      '--preset-body-color': '#555555', '--preset-body-family': "'Noto Sans KR', sans-serif",
      '--preset-caption-color': '#999999',
      '--preset-label-bg': '#111111', '--preset-label-color': '#ffffff', '--preset-label-radius': '8px',
    },
  },
  {
    id: 'dark', name: 'Dark',
    dots: ['#1a1a1a', '#ffffff', '#2d6fe8'],
    backgroundColor: '#1a1a1a',
    variables: {
      '--preset-h1-color': '#ffffff', '--preset-h1-family': "'Noto Sans KR', sans-serif",
      '--preset-h2-color': '#eeeeee', '--preset-h2-family': "'Noto Sans KR', sans-serif",
      '--preset-body-color': '#aaaaaa', '--preset-body-family': "'Noto Sans KR', sans-serif",
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
      '--preset-body-color': '#444444', '--preset-body-family': "'Noto Sans KR', sans-serif",
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
      '--preset-body-color': '#666666', '--preset-body-family': "'Noto Sans KR', sans-serif",
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

// Electron 환경이면 JSON 파일에서 프리셋 로드
if (window.electronAPI) {
  window.electronAPI.readPresets().then(loaded => {
    if (loaded && loaded.length) {
      PRESETS = loaded.sort((a, b) => {
        const order = ['default', 'dark', 'brand', 'minimal'];
        return (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99);
      });
    }
  });
}


function deselectAll() {
  clearMultiSel();
  document.querySelectorAll('.col').forEach(c => c.classList.remove('multi-selected', 'selected'));
  document.querySelectorAll('.group-block').forEach(g => g.classList.remove('group-selected'));
  document.querySelectorAll('.section-block').forEach(s => s.classList.remove('selected'));
  document.querySelectorAll('.text-block').forEach(t => {
    t.classList.remove('selected', 'editing');
    t.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('contenteditable','false'));
  });
  document.querySelectorAll('.asset-block').forEach(a => {
    a.classList.remove('selected');
    window.exitImageEditMode?.(a);
  });
  document.querySelectorAll('.gap-block').forEach(g => g.classList.remove('selected'));
  document.querySelectorAll('.icon-circle-block').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.label-group-block').forEach(b => {
    b.classList.remove('selected', 'editing');
    b.querySelectorAll('.label-item').forEach(i => i.classList.remove('item-selected'));
    b.querySelectorAll('.label-item-text').forEach(el => el.setAttribute('contenteditable','false'));
  });
  document.querySelectorAll('.table-block').forEach(b => {
    b.classList.remove('selected');
    b.querySelectorAll('[contenteditable="true"]').forEach(el => el.setAttribute('contenteditable','false'));
  });
  document.querySelectorAll('.card-block, .strip-banner-block, .graph-block, .divider-block').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.layer-section-header').forEach(h => h.classList.remove('active'));
  document.querySelectorAll('.layer-item').forEach(i => { i.classList.remove('active'); i.style.background = ''; });
  document.querySelectorAll('.layer-row-header').forEach(h => h.classList.remove('active'));
  document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
  document.querySelectorAll('.col.col-active').forEach(c => c.classList.remove('col-active'));
  if (window.setRpIdBadge) window.setRpIdBadge(null);
  window.showPageProperties();
}


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
}


document.querySelectorAll('.section-block').forEach(sec => {
  sec.addEventListener('click', e => {
    e.stopPropagation();
    selectSectionWithModifier(sec, e);
    // deselectAll() 이후 row-active 복원
    const row = e.target.closest('.row');
    if (row && !e.target.closest('.text-block, .asset-block, .gap-block, .col-placeholder, .icon-circle-block, .table-block, .card-block, .strip-banner-block, .graph-block, .divider-block, .label-group-block')) {
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
document.querySelectorAll('.text-block, .asset-block, .gap-block').forEach(b => window.bindBlock(b));

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

/* ── 플로팅 패널 드롭다운 ── */
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
  if (e.target.closest('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .card-block, .strip-banner-block, .graph-block, .divider-block, .label-group-block')) return;
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
    document.querySelectorAll('.col.col-active').forEach(c => c.classList.remove('col-active'));
    row.classList.add('row-active');
    if (window.syncLayerRow) window.syncLayerRow(row);
    if (window.showRowProperties) window.showRowProperties(row);
  } else {
    // 2번 클릭: Col 활성화
    document.querySelectorAll('.col.col-active').forEach(c => c.classList.remove('col-active'));
    col.classList.add('col-active');
    // Col 레이어 헤더 하이라이트
    document.getElementById('layer-panel-body')?.querySelectorAll('.layer-col-group').forEach(wrapper => {
      if (wrapper._dragTarget === col) {
        wrapper.querySelector(':scope > .layer-col-header')?.classList.add('active');
      }
    });
    if (window.showColProperties) window.showColProperties(col);
    else if (window.showRowProperties) window.showRowProperties(row);
  }
  // 일반 클릭 후 lastCol 설정 (clearMultiSel 이후이므로 selectSection 호출 다음에 설정)
  multiSel.lastCol = col;
}, true);
// window 할당을 initApp() 보다 먼저 — save-load.js의 initApp 내부에서 참조하기 때문
window.ASSET_SVG = ASSET_SVG;
window.pushHistory = pushHistory;
window.clearHistory = clearHistory;
window.undo = undo;
window.redo = redo;
window.deselectAll = deselectAll;
window.getBlockBreadcrumb = getBlockBreadcrumb;
window.selectSection = selectSection;
window.zoomStep = zoomStep;
window.zoomFit = zoomFit;
window.applyZoom = applyZoom;
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

// (window 할당은 initApp() 호출 전 블록에서 처리됨)

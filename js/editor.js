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

function pushHistory(action = '작업') {
  if (_historyPaused) return;
  historyStack = historyStack.slice(0, historyPos + 1);
  historyStack.push({ canvas: getSerializedCanvas(), settings: { ...state.pageSettings }, action });
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
  Object.assign(state.pageSettings, snap.settings);
  canvasEl.innerHTML = snap.canvas;
  rebindAll();
  applyPageSettings();
  window.buildLayerPanel();
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
  const selSection = document.querySelector('.section-block.selected');
  if (selBlock) {
    const isGapSel = selBlock.classList.contains('gap-block');
    const target = isGapSel ? selBlock : (selBlock.closest('.row') || selBlock);
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
      document.body.classList.contains('preview-mode') ? previewZoomStep(10) : zoomStep(10);
    }
    if (e.key === '-') {
      e.preventDefault();
      document.body.classList.contains('preview-mode') ? previewZoomStep(-10) : zoomStep(-10);
    }
    if (e.key === '0')                  { e.preventDefault(); applyZoom(100); }
    if (e.key === 'z' && !e.shiftKey)   { e.preventDefault(); undo(); return; }
    if (e.key === 'z' && e.shiftKey)    { e.preventDefault(); redo(); return; }
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
  }
  if (e.key === 'Escape') deselectAll();

  // ── 키보드 Nudge: 블록 이동 (편집 중이거나 입력 포커스 시 무시) ──
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.metaKey && !e.ctrlKey) {
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
    } else if (selSection) {
      e.preventDefault();
      pushHistory();
      selSection.remove();
      deselectAll();
      window.buildLayerPanel();
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

function applyPreset(sec, presetId) {
  const preset = PRESETS.find(p => p.id === presetId);
  // 기존 preset 변수 초기화
  PRESETS.forEach(p => Object.keys(p.variables).forEach(k => sec.style.removeProperty(k)));
  delete sec.dataset.preset;

  if (preset && presetId !== 'default') {
    Object.entries(preset.variables).forEach(([k, v]) => sec.style.setProperty(k, v));
    sec.dataset.preset = presetId;
  }
  // 프리셋 배경색 적용 (정의된 경우에만)
  if (preset?.backgroundColor) {
    sec.style.backgroundColor = preset.backgroundColor;
  }
  pushHistory();
}

function showSectionProperties(sec) {
  const rawBg = sec.style.backgroundColor || sec.style.background || '';
  const hexBg = rawBg
    ? (/^#[0-9a-f]{6}$/i.test(rawBg) ? rawBg : rgbToHex(rawBg))
    : '#ffffff';
  const hasBgImg  = !!sec.dataset.bgImg;
  const bgSize    = sec.dataset.bgSize || 'cover';
  const secPadB   = parseInt(sec.style.paddingBottom) || 0;
  const bgImgHTML = hasBgImg ? `
    <div class="prop-row" style="margin-top:6px;">
      <span class="prop-label">사이즈</span>
      <select class="prop-select" id="sec-bg-size">
        <option value="cover"   ${bgSize==='cover'   ?'selected':''}>Cover</option>
        <option value="contain" ${bgSize==='contain' ?'selected':''}>Contain</option>
        <option value="auto"    ${bgSize==='auto'    ?'selected':''}>Auto</option>
      </select>
    </div>
    <button class="prop-action-btn danger" id="sec-bg-img-remove" style="margin-top:6px;">이미지 제거</button>
  ` : `
    <button class="prop-action-btn secondary" id="sec-bg-img-btn" style="margin-top:6px;">이미지 선택</button>
    <input type="file" id="sec-bg-img-input" accept="image/*" style="display:none">
  `;

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

  const currentPreset = sec.dataset.preset || 'default';
  const presetGridHTML = PRESETS.map(p => `
    <button class="prop-preset-btn${p.id === currentPreset ? ' active' : ''}" data-preset-id="${p.id}">
      <div class="prop-preset-swatches">
        ${p.dots.map(c => `<div class="prop-preset-dot" style="background:${c}"></div>`).join('')}
      </div>
      <span class="prop-preset-name">${p.name}</span>
    </button>`).join('');

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1.5"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">Section</span>
          <span class="prop-breadcrumb">${getBlockBreadcrumb(sec)}</span>
        </div>
      </div>
      <div class="prop-section-title">Preset</div>
      <div class="prop-preset-grid">${presetGridHTML}</div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">배경</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${hexBg}">
          <input type="color" id="sec-bg-color" value="${hexBg}">
        </div>
        <input type="text" class="prop-color-hex" id="sec-bg-hex" value="${hexBg}" maxlength="7">
      </div>
      <div class="prop-section-title" style="margin-top:10px;">배경 이미지</div>
      ${bgImgHTML}
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
      <div class="prop-section-title">여백</div>
      <div class="prop-row">
        <span class="prop-label">아래 여백</span>
        <input type="range" class="prop-slider" id="sec-padb-slider" min="0" max="200" step="4" value="${secPadB}">
        <input type="number" class="prop-number" id="sec-padb-number" min="0" max="200" value="${secPadB}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">내보내기</div>
      <select class="prop-select" id="sec-export-format" style="width:100%;margin-bottom:6px;">
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
      </select>
      <button class="prop-export-btn" id="sec-export-btn">이 섹션 내보내기</button>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">템플릿</div>
      <select class="prop-select" id="sec-tpl-folder" style="width:100%;margin-bottom:6px;">
        ${(()=>{
          const tpls = loadTemplates ? loadTemplates() : [];
          const folders = [...new Set(tpls.map(t => t.folder || '기타'))];
          if (!folders.length) folders.push('내 템플릿');
          return folders.map(f => `<option value="${f.replace(/"/g,'&quot;')}">${f.replace(/</g,'&lt;')}</option>`).join('') +
            '<option value="__new__">새 폴더...</option>';
        })()}
      </select>
      <input type="text" id="sec-tpl-folder-new" class="tpl-name-input" placeholder="새 폴더 이름" style="display:none;margin-bottom:6px;">
      <select class="prop-select" id="sec-tpl-cat" style="width:100%;margin-bottom:6px;">
        <option value="Hero">Hero</option>
        <option value="Main">Main</option>
        <option value="Feature">Feature</option>
        <option value="Detail">Detail</option>
        <option value="CTA">CTA</option>
        <option value="Event">Event</option>
        <option value="기타">기타</option>
      </select>
      <input type="text" id="sec-tpl-name" class="tpl-name-input" placeholder="템플릿 이름 입력">
      <button class="prop-action-btn primary" id="sec-tpl-save-btn" style="margin-top:6px;">템플릿으로 저장</button>
    </div>`;

  // 아래 여백 이벤트
  const padBSlider = document.getElementById('sec-padb-slider');
  const padBNumber = document.getElementById('sec-padb-number');
  if (padBSlider) {
    const applyPadB = v => {
      v = Math.min(200, Math.max(0, isNaN(v) ? 0 : v));
      sec.style.paddingBottom = v ? v + 'px' : '';
      padBSlider.value = v;
      padBNumber.value = v || '';
    };
    padBSlider.addEventListener('input',  e => applyPadB(parseInt(e.target.value)));
    padBSlider.addEventListener('change', () => pushHistory('섹션 여백'));
    padBNumber.addEventListener('change', e => { applyPadB(parseInt(e.target.value)); pushHistory('섹션 여백'); });
  }

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

  // 배경 이미지 이벤트
  const bgImgBtn    = document.getElementById('sec-bg-img-btn');
  const bgImgInput  = document.getElementById('sec-bg-img-input');
  const bgSizeEl    = document.getElementById('sec-bg-size');
  const bgImgRemove = document.getElementById('sec-bg-img-remove');

  if (bgImgBtn && bgImgInput) {
    bgImgBtn.addEventListener('click', () => bgImgInput.click());
    bgImgInput.addEventListener('change', () => {
      const file = bgImgInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        sec.dataset.bgImg = dataUrl;
        sec.dataset.bgSize = 'cover';
        sec.style.backgroundImage = `url(${dataUrl})`;
        sec.style.backgroundSize = 'cover';
        sec.style.backgroundPosition = 'center';
        sec.style.backgroundRepeat = 'no-repeat';
        showSectionProperties(sec);
      };
      reader.readAsDataURL(file);
    });
  }
  if (bgSizeEl) {
    bgSizeEl.addEventListener('change', () => {
      sec.dataset.bgSize = bgSizeEl.value;
      sec.style.backgroundSize = bgSizeEl.value;
    });
  }
  if (bgImgRemove) {
    bgImgRemove.addEventListener('click', () => {
      delete sec.dataset.bgImg;
      delete sec.dataset.bgSize;
      sec.style.backgroundImage = '';
      sec.style.backgroundSize = '';
      sec.style.backgroundPosition = '';
      sec.style.backgroundRepeat = '';
      showSectionProperties(sec);
    });
  }

  // Preset 버튼 이벤트
  propPanel.querySelectorAll('.prop-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyPreset(sec, btn.dataset.presetId);
      showSectionProperties(sec);
    });
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

  // 폴더 드롭다운 → 새 폴더 입력 토글
  const tplFolderSel = document.getElementById('sec-tpl-folder');
  const tplFolderNew = document.getElementById('sec-tpl-folder-new');
  if (tplFolderSel && tplFolderNew) {
    tplFolderSel.addEventListener('change', () => {
      tplFolderNew.style.display = tplFolderSel.value === '__new__' ? 'block' : 'none';
    });
  }

  // 템플릿 저장
  const tplSaveBtn = document.getElementById('sec-tpl-save-btn');
  if (tplSaveBtn) {
    tplSaveBtn.addEventListener('click', () => {
      const name = document.getElementById('sec-tpl-name').value.trim();
      if (!name) { document.getElementById('sec-tpl-name').focus(); return; }
      const category = document.getElementById('sec-tpl-cat').value;
      let folder = tplFolderSel ? tplFolderSel.value : '기타';
      if (folder === '__new__') {
        folder = (tplFolderNew ? tplFolderNew.value.trim() : '') || '기타';
      }
      saveAsTemplate(sec, name, folder, category);
      document.getElementById('sec-tpl-name').value = '';
      tplSaveBtn.textContent = '저장됨 ✓';
      tplSaveBtn.disabled = true;
      setTimeout(() => {
        if (tplSaveBtn) { tplSaveBtn.textContent = '템플릿으로 저장'; tplSaveBtn.disabled = false; }
      }, 1500);
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
    exitImageEditMode(a);
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
  window.showPageProperties();
}


function bindSectionDelete(sec) {
  // 삭제 버튼 제거됨 — 레이어 패널 또는 컨텍스트 메뉴에서 처리
}

function bindSectionOrder(sec) {
  // 순서 버튼 제거됨 — 드래그 또는 레이어 패널에서 처리
}

document.querySelectorAll('.section-block').forEach(sec => {
  sec.addEventListener('click', e => { e.stopPropagation(); selectSectionWithModifier(sec, e); });
  bindSectionDelete(sec);
  bindSectionOrder(sec);
  bindSectionDropZone(sec);
  bindSectionDrag(sec);
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
   CANVAS PAN (Space + Drag)
═══════════════════════════════════ */
{
  const canvasWrap = document.getElementById('canvas-wrap');
  let panMode = false, panning = false, panStart = null, panScrollStart = null;
  function isTyping() {
    const el = document.activeElement;
    return el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !isTyping()) {
      e.preventDefault();
      if (!panMode) { panMode = true; canvasWrap.classList.add('pan-mode'); }
    }
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'Space') {
      panMode = false; panning = false;
      canvasWrap.classList.remove('pan-mode', 'panning');
    }
  });
  canvasWrap.addEventListener('mousedown', e => {
    if (!panMode || e.button !== 0) return;
    panning = true;
    panStart = { x: e.clientX, y: e.clientY };
    panScrollStart = { x: canvasWrap.scrollLeft, y: canvasWrap.scrollTop };
    canvasWrap.classList.add('panning');
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!panning) return;
    canvasWrap.scrollLeft = panScrollStart.x - (e.clientX - panStart.x);
    canvasWrap.scrollTop  = panScrollStart.y - (e.clientY - panStart.y);
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
  function updateNotch() {
    const bw = notchBar.offsetWidth;
    if (!bw) return;
    const viewCenter = canvasWrap.scrollLeft + canvasWrap.clientWidth / 2;
    const x = Math.max(2, Math.min(bw - 2, (viewCenter / canvasWrap.scrollWidth) * bw));
    notch.style.left = x + 'px';
    notch.classList.toggle('centered',
      Math.abs(viewCenter - canvasWrap.scrollWidth / 2) <= canvasWrap.clientWidth * 0.015);
  }
  canvasWrap.addEventListener('scroll', updateNotch, { passive: true });
  window.addEventListener('resize', updateNotch);
  notchBar.addEventListener('click', () => {
    canvasWrap.scrollTo({ left: Math.max(0, (canvasWrap.scrollWidth - canvasWrap.clientWidth) / 2), behavior: 'smooth' });
  });
  setTimeout(updateNotch, 200);
}

/* ── Col 다중선택: capture-phase ── */
canvasEl.addEventListener('click', e => {
  const col = e.target.closest('.col');
  if (!col) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    e.stopPropagation();
    selectColWithModifier(col, e);
  }
}, true);
// window 할당을 initApp() 보다 먼저 — save-load.js의 initApp 내부에서 참조하기 때문
window.ASSET_SVG = ASSET_SVG;
window.pushHistory = pushHistory;
window.undo = undo;
window.redo = redo;
window.deselectAll = deselectAll;
window.getBlockBreadcrumb = getBlockBreadcrumb;
window.syncSection = syncSection;
window.selectSection = selectSection;
window.zoomStep = zoomStep;
window.zoomFit = zoomFit;
window.applyZoom = applyZoom;
window.toggleAllSections = toggleAllSections;
window.switchToTab = switchToTab;
window.initFileTabToggle = initFileTabToggle;
window.rgbToHex = rgbToHex;
window.applyPreset = applyPreset;
window.showSectionProperties = showSectionProperties;
window.bindSectionDelete = bindSectionDelete;
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
  syncSection,
  selectSection,
  zoomStep,
  zoomFit,
  applyZoom,
  toggleAllSections,
  switchToTab,
  initFileTabToggle,
  rgbToHex,
  applyPreset,
  showSectionProperties,
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

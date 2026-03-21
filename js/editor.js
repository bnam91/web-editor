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
  if (tabName === 'branch') renderBranchPanel();
  if (tabName === 'inspector') renderInspectorPanel();
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
  const selBlock   = document.querySelector('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected');
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
    el.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block').forEach(b => bindBlock(b));
    el.querySelectorAll('.col > .col-placeholder').forEach(ph => {
      const col = ph.parentElement;
      col.replaceChild(makeColPlaceholder(col), ph);
    });
    el.addEventListener('click', e2 => { e2.stopPropagation(); selectSection(el); });
  } else {
    const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
    if (!sec) return;
    insertAfterSelected(sec, el);
    el.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block').forEach(b => bindBlock(b));
    el.querySelectorAll('.col > .col-placeholder').forEach(ph => {
      const col = ph.parentElement;
      col.replaceChild(makeColPlaceholder(col), ph);
    });
  }
  buildLayerPanel();
}

document.addEventListener('keydown', e => {
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

    const allSelBlocks = [...document.querySelectorAll('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected')];
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
    dots: ['#ffffff', '#aaaaaa', '#2d6fe8'],
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
  pushHistory();
}

function showSectionProperties(sec) {
  const rawBg = sec.style.backgroundColor || sec.style.background || '';
  const hexBg = rawBg
    ? (/^#[0-9a-f]{6}$/i.test(rawBg) ? rawBg : rgbToHex(rawBg))
    : '#ffffff';
  const hasBgImg  = !!sec.dataset.bgImg;
  const bgSize    = sec.dataset.bgSize || 'cover';
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
        <span class="prop-block-name">Section</span>
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
      propPanel.querySelectorAll('.prop-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
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
  document.querySelectorAll('.table-block').forEach(b => {
    b.classList.remove('selected');
    b.querySelectorAll('[contenteditable="true"]').forEach(el => el.setAttribute('contenteditable','false'));
  });
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

/* ── 플로팅 패널 Text 드롭다운 ── */
function toggleFpDropdown() {
  document.getElementById('fp-text-dropdown').classList.toggle('open');
}
document.addEventListener('click', e => {
  const dd = document.getElementById('fp-text-dropdown');
  if (dd && !dd.contains(e.target)) dd.classList.remove('open');
  const bdw = document.getElementById('branch-dropdown-wrap');
  if (bdw && !bdw.contains(e.target)) bdw.classList.remove('open');
  if (!e.target.closest('.col-add-btn') && !e.target.closest('.col-add-menu')) {
    document.querySelectorAll('.col-add-menu').forEach(m => m.style.display = 'none');
  }
});


// 모든 모듈 로드 후 앱 초기화
initApp();

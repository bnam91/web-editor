/* ═══════════════════════════════════
   PROPERTIES PANEL
═══════════════════════════════════ */

function showPageProperties() {
  const { bg, gap, padX, padY } = pageSettings;
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1.5"/>
          </svg>
        </div>
        <span class="prop-block-name">Page</span>
      </div>
      <div class="prop-section-title">배경</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${bg}">
          <input type="color" id="page-bg-color" value="${bg}">
        </div>
        <input type="text" class="prop-color-hex" id="page-bg-hex" value="${bg}" maxlength="7">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">일괄 정렬</div>
      <div class="prop-align-group">
        <button class="prop-align-btn" id="page-align-left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="page-align-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="page-align-right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">섹션 간격</span>
        <input type="range" class="prop-slider" id="section-gap-slider" min="0" max="200" step="4" value="${gap}">
        <input type="number" class="prop-number" id="section-gap-number" min="0" max="200" value="${gap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="page-padx-slider" min="0" max="200" step="4" value="${padX}">
        <input type="number" class="prop-number" id="page-padx-number" min="0" max="200" value="${padX}">
      </div>
      <div class="prop-row">
        <span class="prop-label">상하 패딩</span>
        <input type="range" class="prop-slider" id="page-pady-slider" min="0" max="200" step="4" value="${padY}">
        <input type="number" class="prop-number" id="page-pady-number" min="0" max="200" value="${padY}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">내보내기</div>
      <select class="prop-select" id="page-export-format" style="width:100%;margin-bottom:6px;">
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
      </select>
      <button class="prop-export-btn" id="page-export-all-btn">전체 섹션 내보내기</button>
    </div>`;

  const bgPicker = document.getElementById('page-bg-color');
  const bgHex    = document.getElementById('page-bg-hex');
  const bgSwatch = bgPicker.closest('.prop-color-swatch');
  bgPicker.addEventListener('input', () => {
    pageSettings.bg = bgPicker.value;
    canvasWrap.style.background = pageSettings.bg;
    bgHex.value = pageSettings.bg;
    bgSwatch.style.background = pageSettings.bg;
  });
  bgHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(bgHex.value)) {
      pageSettings.bg = bgHex.value;
      bgPicker.value = pageSettings.bg;
      canvasWrap.style.background = pageSettings.bg;
      bgSwatch.style.background = pageSettings.bg;
    }
  });

  const gapSlider = document.getElementById('section-gap-slider');
  const gapNumber = document.getElementById('section-gap-number');
  gapSlider.addEventListener('input', () => {
    pageSettings.gap = parseInt(gapSlider.value);
    canvasEl.style.gap = pageSettings.gap + 'px';
    gapNumber.value = pageSettings.gap;
  });
  gapNumber.addEventListener('input', () => {
    const v = Math.min(200, Math.max(0, parseInt(gapNumber.value) || 0));
    pageSettings.gap = v;
    canvasEl.style.gap = v + 'px';
    gapSlider.value = v;
  });

  const applyPadX = (v) => {
    pageSettings.padX = v;
    document.querySelectorAll('.text-block').forEach(tb => {
      tb.style.paddingLeft = v + 'px';
      tb.style.paddingRight = v + 'px';
    });
  };
  const applyPadY = (v) => {
    pageSettings.padY = v;
    document.querySelectorAll('.text-block').forEach(tb => {
      if (tb.dataset.type === 'label') return;
      tb.style.paddingTop = v + 'px';
      tb.style.paddingBottom = v + 'px';
    });
  };
  const padxSlider = document.getElementById('page-padx-slider');
  const padxNumber = document.getElementById('page-padx-number');
  padxSlider.addEventListener('input', () => { applyPadX(parseInt(padxSlider.value)); padxNumber.value = padxSlider.value; });
  padxNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padxNumber.value)||0)); applyPadX(v); padxSlider.value = v; });

  const padySlider = document.getElementById('page-pady-slider');
  const padyNumber = document.getElementById('page-pady-number');
  padySlider.addEventListener('input', () => { applyPadY(parseInt(padySlider.value)); padyNumber.value = padySlider.value; });
  padyNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padyNumber.value)||0)); applyPadY(v); padySlider.value = v; });

  ['left','center','right'].forEach(align => {
    const btn = document.getElementById(`page-align-${align}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.text-block').forEach(tb => {
        if (tb.querySelector('.tb-label')) { tb.style.textAlign = align; }
        else {
          const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
          if (contentEl) contentEl.style.textAlign = align;
        }
      });
      propPanel.querySelectorAll('#page-align-left,#page-align-center,#page-align-right')
        .forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // 전체 내보내기
  const pageExportBtn = document.getElementById('page-export-all-btn');
  if (pageExportBtn) {
    pageExportBtn.addEventListener('click', async () => {
      const fmt = document.getElementById('page-export-format').value;
      const secCount = canvasEl.querySelectorAll('.section-block').length;
      if (!confirm(`전체 ${secCount}개 섹션을 내보냅니다. 계속할까요?`)) return;
      pageExportBtn.disabled = true;
      pageExportBtn.textContent = '내보내는 중...';
      try {
        await exportAllSections(fmt);
      } finally {
        pageExportBtn.disabled = false;
        pageExportBtn.textContent = '전체 섹션 내보내기';
      }
    });
  }
}

function getCurrentRatioStr(block) {
  const row = block.closest('.row');
  if (!row) return '1*1';
  if (row.dataset.ratioStr) return row.dataset.ratioStr;
  const cols = [...row.querySelectorAll(':scope > .col')];
  if (cols.length <= 1) return '1*1';
  return `${cols.length}*1`;
}

function makeColPlaceholder(col) {
  const ph = document.createElement('div');
  ph.className = 'col-placeholder';
  ph.innerHTML = `
    <button class="col-add-btn">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
        <line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/>
      </svg>
    </button>
    <div class="col-add-menu" style="display:none">
      <button class="col-add-item" data-add="h2">Heading</button>
      <button class="col-add-item" data-add="body">Body</button>
      <button class="col-add-item" data-add="caption">Caption</button>
      <button class="col-add-item" data-add="label">Label</button>
      <div class="col-add-divider"></div>
      <button class="col-add-item" data-add="asset">Asset</button>
    </div>`;

  const btn  = ph.querySelector('.col-add-btn');
  const menu = ph.querySelector('.col-add-menu');

  btn.addEventListener('click', e => {
    e.stopPropagation();
    // 다른 열린 메뉴 닫기
    document.querySelectorAll('.col-add-menu').forEach(m => { if (m !== menu) m.style.display = 'none'; });
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });

  ph.querySelectorAll('.col-add-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      menu.style.display = 'none';
      const type = item.dataset.add;
      let block;
      if (type === 'asset') {
        const ab = document.createElement('div');
        ab.className = 'asset-block';
        ab.style.height = '460px';
        ab.innerHTML = `
          ${ASSET_SVG}
          <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>`;
        block = ab;
      } else {
        const { block: tb } = makeTextBlock(type);
        block = tb;
      }
      col.replaceChild(block, ph);
      bindBlock(block);
      buildLayerPanel();
    });
  });

  return ph;
}

function makeEmptyCol(flexVal) {
  const col = document.createElement('div');
  col.className = 'col';
  if (flexVal) { col.style.flex = flexVal; col.dataset.flex = flexVal; }
  col.appendChild(makeColPlaceholder(col));
  return col;
}

function applyRowLayout(block, ratioStr) {
  const parts = ratioStr.trim().split('*').map(n => parseInt(n.trim())).filter(n => n > 0 && !isNaN(n));
  if (parts.length === 0) return;

  const cols  = parts[0] || 1;
  const rows  = parts[1] || 1;
  const total = cols * rows;

  const row = block.closest('.row');
  if (!row) return;

  const existingCols = [...row.querySelectorAll(':scope > .col')];

  if (cols === 1 && rows === 1) {
    // 단일 셀: stack 복귀
    row.dataset.layout = 'stack';
    row.dataset.ratioStr = '1*1';
    row.style.display = '';
    row.style.gridTemplateColumns = '';
    existingCols.slice(1).forEach(col => col.remove());
    if (existingCols[0]) { existingCols[0].style.flex = ''; delete existingCols[0].dataset.flex; }

  } else if (rows === 1) {
    // Flex row: 여러 열, 1행
    row.dataset.layout = 'flex';
    row.dataset.ratioStr = `${cols}*1`;
    row.style.display = '';
    row.style.gridTemplateColumns = '';
    existingCols.forEach((col, i) => {
      if (i < cols) { col.style.flex = '1'; col.dataset.flex = '1'; }
      else col.remove();
    });
    for (let i = existingCols.length; i < cols; i++) row.appendChild(makeEmptyCol('1'));

  } else {
    // CSS Grid: cols열 × rows행
    row.dataset.layout = 'grid';
    row.dataset.ratioStr = `${cols}*${rows}`;
    row.style.display = 'grid';
    row.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    existingCols.forEach((col, i) => {
      if (i < total) { col.style.flex = ''; delete col.dataset.flex; }
      else col.remove();
    });
    for (let i = existingCols.length; i < total; i++) row.appendChild(makeEmptyCol(null));
  }

  buildLayerPanel();
}

function bindLayoutInput(block) {
  const input = document.getElementById('layout-ratio');
  if (!input) return;
  const apply = () => applyRowLayout(block, input.value);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
  input.addEventListener('blur', apply);
}

function showAssetProperties(ab) {
  const ratioStr   = getCurrentRatioStr(ab);
  const currentH   = parseInt(ab.style.height) || ab.offsetHeight || 780;
  const hasImage   = ab.classList.contains('has-image');
  const currentR   = parseInt(ab.style.borderRadius) || 0;
  const currentW   = ab.offsetWidth || 400;
  const currentAlign = ab.dataset.align || 'center';
  if (!ab.dataset.align) { ab.dataset.align = 'center'; ab.style.alignSelf = 'center'; }
  const currentSize  = ab.dataset.size  || '100';

  const imageSection = hasImage ? `
    <div class="prop-section">
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn secondary" id="asset-replace-btn">이미지 교체</button>
      <button class="prop-action-btn danger"    id="asset-remove-btn">이미지 제거</button>
    </div>` : `
    <div class="prop-section">
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn primary" id="asset-upload-btn">이미지 선택</button>
      <div style="text-align:center;font-size:11px;color:#555;margin-top:6px;">또는 블록에 파일을 드래그</div>
    </div>`;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1"/>
            <circle cx="4" cy="4" r="1"/>
            <polyline points="11 8 8 5 3 11"/>
          </svg>
        </div>
        <span class="prop-block-name">Asset Block</span>
      </div>
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-layout-input" id="layout-ratio" value="${ratioStr}" placeholder="2*2">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" id="asset-align-group">
          <button class="prop-align-btn${currentAlign==='left'?' active':''}"   data-align="left">←</button>
          <button class="prop-align-btn${currentAlign==='center'?' active':''}" data-align="center">↔</button>
          <button class="prop-align-btn${currentAlign==='right'?' active':''}"  data-align="right">→</button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="asset-r-slider" min="0" max="120" step="2" value="${currentR}">
        <input type="number" class="prop-number" id="asset-r-number" min="0" max="120" value="${currentR}">
      </div>
      <div class="prop-row">
        <span class="prop-label">사이즈</span>
        <select class="prop-select" id="asset-size-select">
          <option value="85"  ${currentSize==='85'  ?'selected':''}>85%</option>
          <option value="90"  ${currentSize==='90'  ?'selected':''}>90%</option>
          <option value="95"  ${currentSize==='95'  ?'selected':''}>95%</option>
          <option value="100" ${currentSize==='100' ?'selected':''}>100%</option>
        </select>
      </div>
    </div>
    ${imageSection}`;

  bindLayoutInput(ab);


  const applyAlign = a => {
    ab.dataset.align = a;
    if (a === 'left')   ab.style.alignSelf = 'flex-start';
    if (a === 'center') ab.style.alignSelf = 'center';
    if (a === 'right')  ab.style.alignSelf = 'flex-end';
    document.querySelectorAll('#asset-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === a));
  };
  document.querySelectorAll('#asset-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => applyAlign(btn.dataset.align));
  });

  const rSlider = document.getElementById('asset-r-slider');
  const rNumber = document.getElementById('asset-r-number');
  const applyR = v => { ab.style.borderRadius = v + 'px'; };
  rSlider.addEventListener('input', () => { applyR(parseInt(rSlider.value)); rNumber.value = rSlider.value; });
  rNumber.addEventListener('input', () => {
    const v = Math.min(120, Math.max(0, parseInt(rNumber.value) || 0));
    applyR(v); rSlider.value = v;
  });

  document.getElementById('asset-size-select').addEventListener('change', e => {
    const v = e.target.value;
    ab.dataset.size = v;

    const prevW = ab.offsetWidth;
    const prevH = parseInt(ab.style.height) || ab.offsetHeight;
    const ratio = prevH / prevW;

    ab.style.width = v === '100' ? '' : v + '%';

    requestAnimationFrame(() => {
      const newW = ab.offsetWidth;
      ab.style.height = Math.round(newW * ratio) + 'px';
      pushHistory();
    });
  });

  if (hasImage) {
    document.getElementById('asset-replace-btn').addEventListener('click', () => triggerAssetUpload(ab));
    document.getElementById('asset-remove-btn').addEventListener('click', () => clearAssetImage(ab));
  } else {
    document.getElementById('asset-upload-btn').addEventListener('click', () => triggerAssetUpload(ab));
  }
}

function showTextProperties(tb) {
  const contentEl = tb.querySelector('[contenteditable]');
  const computed   = window.getComputedStyle(contentEl);

  const currentClass = ['tb-h1','tb-h2','tb-body','tb-caption','tb-label'].find(c => contentEl.classList.contains(c)) || 'tb-body';
  const rawBg = window.getComputedStyle(contentEl).backgroundColor;
  const currentBgColor = (!rawBg || rawBg === 'rgba(0, 0, 0, 0)' || rawBg === 'transparent') ? '#111111' : (rgbToHex(rawBg) || '#111111');
  const currentRadius = parseInt(contentEl.style.borderRadius) || 4;
  const isLabel = currentClass === 'tb-label';
  const currentAlign = isLabel ? (tb.style.textAlign || 'left') : (contentEl.style.textAlign || 'left');
  const currentSize  = parseInt(computed.fontSize) || 15;
  const currentColor = rgbToHex(computed.color) || '#111111';
  const currentLH    = (parseFloat(computed.lineHeight) / parseFloat(computed.fontSize) || 1.5).toFixed(2);
  const currentLS    = parseFloat(contentEl.style.letterSpacing) || 0;
  const defaultPad   = isLabel ? 0 : pageSettings.padY;
  const currentPadT  = tb.style.paddingTop    ? (parseInt(tb.style.paddingTop)    || 0) : defaultPad;
  const currentPadB  = tb.style.paddingBottom ? (parseInt(tb.style.paddingBottom) || 0) : defaultPad;
  const currentFont  = contentEl.style.fontFamily || '';

  const ratioStr = getCurrentRatioStr(tb);
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="11" y2="6"/><line x1="1" y1="9" x2="7" y2="9"/>
          </svg>
        </div>
        <span class="prop-block-name">Text Block</span>
      </div>
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-layout-input" id="layout-ratio" value="${ratioStr}" placeholder="1*2*1">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">타입</div>
      <div class="prop-type-group">
        <button class="prop-type-btn ${currentClass==='tb-h1'?'active':''}"      data-cls="tb-h1">H1</button>
        <button class="prop-type-btn ${currentClass==='tb-h2'?'active':''}"      data-cls="tb-h2">H2</button>
        <button class="prop-type-btn ${currentClass==='tb-body'?'active':''}"    data-cls="tb-body">Body</button>
        <button class="prop-type-btn ${currentClass==='tb-caption'?'active':''}" data-cls="tb-caption">Cap</button>
        <button class="prop-type-btn ${currentClass==='tb-label'?'active':''}"   data-cls="tb-label">Tag</button>
      </div>
    </div>
    <div id="label-style-section" style="display:${isLabel?'block':'none'}">
      <div class="prop-section">
        <div class="prop-section-title">태그 스타일</div>
        <div class="prop-color-row">
          <span class="prop-label">배경색</span>
          <div class="prop-color-swatch${currentBgColor==='transparent'?' swatch-none':''}" style="background:${currentBgColor==='transparent'?'transparent':currentBgColor}">
            <input type="color" id="label-bg-color" value="${currentBgColor==='transparent'?'#111111':currentBgColor}">
          </div>
          <input type="text" class="prop-color-hex" id="label-bg-hex" value="${currentBgColor==='transparent'?'':currentBgColor}" maxlength="7" placeholder="없음">
          <label class="prop-none-check"><input type="checkbox" id="label-bg-none" ${currentBgColor==='transparent'?'checked':''}>없음</label>
        </div>
        <div class="prop-row">
          <span class="prop-label">모서리</span>
          <input type="range" class="prop-slider" id="label-radius-slider" min="0" max="40" step="1" value="${currentRadius}">
          <input type="number" class="prop-number" id="label-radius-number" min="0" max="40" value="${currentRadius}">
        </div>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">정렬</div>
      <div class="prop-align-group">
        <button class="prop-align-btn ${currentAlign==='left'||currentAlign===''?'active':''}" data-align="left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn ${currentAlign==='center'?'active':''}" data-align="center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn ${currentAlign==='right'?'active':''}" data-align="right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">폰트</div>
      <div class="prop-row">
        <span class="prop-label">종류</span>
        <select class="prop-select" id="txt-font-family">
          <option value="" style="font-family:inherit"           ${currentFont===''?'selected':''}>기본 (시스템)</option>
          <optgroup label="── 한글 ──">
            <option value="'Noto Sans KR', sans-serif"          ${currentFont.includes('Noto Sans KR')?'selected':''}>Noto Sans KR</option>
            <option value="'Noto Serif KR', serif"              ${currentFont.includes('Noto Serif KR')?'selected':''}>Noto Serif KR</option>
          </optgroup>
          <optgroup label="── 영문 ──">
            <option value="'Inter', sans-serif"                 ${currentFont.includes('Inter')?'selected':''}>Inter</option>
            <option value="'Space Grotesk', sans-serif"         ${currentFont.includes('Space Grotesk')?'selected':''}>Space Grotesk</option>
            <option value="'Playfair Display', serif"           ${currentFont.includes('Playfair Display')?'selected':''}>Playfair Display</option>
          </optgroup>
          <optgroup label="── 시스템 ──">
            <option value="sans-serif"                          ${currentFont==='sans-serif'?'selected':''}>Sans-serif</option>
            <option value="serif"                               ${currentFont==='serif'?'selected':''}>Serif</option>
            <option value="monospace"                           ${currentFont==='monospace'?'selected':''}>Monospace</option>
          </optgroup>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="txt-size-slider" min="8" max="400" step="1" value="${currentSize}">
        <input type="number" class="prop-number" id="txt-size-number" min="8" max="400" value="${currentSize}">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">색상</span>
        <div class="prop-color-swatch" style="background:${currentColor}">
          <input type="color" id="txt-color" value="${currentColor}">
        </div>
        <input type="text" class="prop-color-hex" id="txt-color-hex" value="${currentColor}" maxlength="7">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">간격</div>
      <div class="prop-row">
        <span class="prop-label">줄간격</span>
        <input type="range" class="prop-slider" id="txt-lh-slider" min="1" max="3" step="0.05" value="${currentLH}">
        <input type="number" class="prop-number" id="txt-lh-number" min="1" max="3" step="0.05" value="${currentLH}">
      </div>
      <div class="prop-row">
        <span class="prop-label">자간</span>
        <input type="range" class="prop-slider" id="txt-ls-slider" min="-10" max="40" step="0.5" value="${currentLS}">
        <input type="number" class="prop-number" id="txt-ls-number" min="-10" max="40" step="0.5" value="${currentLS}">
      </div>
      <div class="prop-row">
        <span class="prop-label">상단</span>
        <input type="range" class="prop-slider" id="txt-pt-slider" min="0" max="120" step="4" value="${currentPadT}">
        <input type="number" class="prop-number" id="txt-pt-number" min="0" max="120" value="${currentPadT}">
      </div>
      <div class="prop-row">
        <span class="prop-label">하단</span>
        <input type="range" class="prop-slider" id="txt-pb-slider" min="0" max="120" step="4" value="${currentPadB}">
        <input type="number" class="prop-number" id="txt-pb-number" min="0" max="120" value="${currentPadB}">
      </div>
    </div>

    <div class="prop-section prop-section--anim">
      <button class="prop-anim-btn" id="open-anim-btn">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="3" width="12" height="8" rx="1.5"/>
          <path d="M5 6l3 1.5L5 9V6z" fill="currentColor" stroke="none"/>
        </svg>
        애니메이션 GIF 만들기
      </button>
    </div>`;

  /* 폰트 종류 */
  document.getElementById('txt-font-family').addEventListener('change', e => {
    contentEl.style.fontFamily = e.target.value;
  });

  /* 타입 전환 */
  const labelMap = { 'tb-h1':'Heading','tb-h2':'Heading','tb-body':'Body','tb-caption':'Caption','tb-label':'Label' };
  const typeMap2 = { 'tb-h1':'heading','tb-h2':'heading','tb-body':'body','tb-caption':'caption','tb-label':'label' };
  propPanel.querySelectorAll('.prop-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cls = btn.dataset.cls;
      contentEl.className = cls;
      tb.dataset.type = typeMap2[cls];
      propPanel.querySelectorAll('.prop-type-btn').forEach(b => b.classList.toggle('active', b===btn));

      const labelSection = document.getElementById('label-style-section');
      if (labelSection) labelSection.style.display = cls === 'tb-label' ? 'block' : 'none';

      // label로 전환 시 기본 스타일 적용, 다른 타입으로 전환 시 초기화
      if (cls === 'tb-label') {
        if (!contentEl.style.backgroundColor) contentEl.style.backgroundColor = '#111111';
        if (!contentEl.style.color) contentEl.style.color = '#ffffff';
        if (!contentEl.style.borderRadius) contentEl.style.borderRadius = '4px';
      } else {
        contentEl.style.backgroundColor = '';
        contentEl.style.borderRadius = '';
      }
    });
  });

  /* 태그 배경색 */
  const labelBgPicker = document.getElementById('label-bg-color');
  const labelBgHex    = document.getElementById('label-bg-hex');
  const labelBgNone   = document.getElementById('label-bg-none');
  if (labelBgPicker) {
    const labelBgSwatch = labelBgPicker.closest('.prop-color-swatch');
    const setLabelBg = (val) => {
      const isNone = val === 'transparent';
      contentEl.style.backgroundColor = val;
      contentEl.style.padding = isNone ? '0' : '';
      contentEl.style.borderRadius = isNone ? '0' : (contentEl.style.borderRadius || '');
      labelBgSwatch.style.background = isNone ? 'transparent' : val;
      labelBgSwatch.classList.toggle('swatch-none', isNone);
      if (!isNone) { labelBgHex.value = val; labelBgPicker.value = val; }
    };
    labelBgPicker.addEventListener('input', () => {
      if (labelBgNone.checked) return;
      setLabelBg(labelBgPicker.value);
      labelBgHex.value = labelBgPicker.value;
    });
    labelBgHex.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(labelBgHex.value)) { setLabelBg(labelBgHex.value); labelBgNone.checked = false; }
    });
    labelBgNone.addEventListener('change', () => {
      if (labelBgNone.checked) { setLabelBg('transparent'); labelBgHex.value = ''; }
      else {
        contentEl.style.padding = '';
        const v = labelBgPicker.value || '#111111';
        setLabelBg(v); labelBgHex.value = v;
      }
    });
  }
  /* 태그 모서리 */
  const rSlider = document.getElementById('label-radius-slider');
  const rNumber = document.getElementById('label-radius-number');
  if (rSlider) {
    rSlider.addEventListener('input', () => { contentEl.style.borderRadius = rSlider.value+'px'; rNumber.value = rSlider.value; });
    rNumber.addEventListener('input', () => {
      const v = Math.min(40, Math.max(0, parseInt(rNumber.value)||0));
      contentEl.style.borderRadius = v+'px'; rSlider.value = v;
    });
  }

  /* 정렬 */
  propPanel.querySelectorAll('.prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // label(inline-block)은 부모 tb에 text-align 적용해야 블록 자체가 정렬됨
      if (contentEl.classList.contains('tb-label')) {
        tb.style.textAlign = btn.dataset.align;
      } else {
        contentEl.style.textAlign = btn.dataset.align;
      }
      propPanel.querySelectorAll('.prop-align-btn').forEach(b => b.classList.toggle('active', b===btn));
    });
  });

  /* 폰트 크기 */
  const sizeSlider = document.getElementById('txt-size-slider');
  const sizeNumber = document.getElementById('txt-size-number');
  sizeSlider.addEventListener('input', () => { contentEl.style.fontSize = sizeSlider.value+'px'; sizeNumber.value = sizeSlider.value; });
  sizeNumber.addEventListener('input', () => {
    const v = Math.min(400, Math.max(8, parseInt(sizeNumber.value)||8));
    contentEl.style.fontSize = v+'px'; sizeSlider.value = v;
  });

  /* 색상 */
  const colorPicker = document.getElementById('txt-color');
  const colorHex    = document.getElementById('txt-color-hex');
  const colorSwatch = colorPicker.closest('.prop-color-swatch');
  colorPicker.addEventListener('input', () => {
    contentEl.style.color = colorPicker.value;
    colorHex.value = colorPicker.value;
    colorSwatch.style.background = colorPicker.value;
  });
  colorHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(colorHex.value)) {
      colorPicker.value = colorHex.value;
      contentEl.style.color = colorHex.value;
      colorSwatch.style.background = colorHex.value;
    }
  });

  /* 줄간격 */
  const lhSlider = document.getElementById('txt-lh-slider');
  const lhNumber = document.getElementById('txt-lh-number');
  lhSlider.addEventListener('input', () => { contentEl.style.lineHeight = lhSlider.value; lhNumber.value = parseFloat(lhSlider.value).toFixed(2); });
  lhNumber.addEventListener('input', () => {
    const v = Math.min(3, Math.max(1, parseFloat(lhNumber.value)||1));
    contentEl.style.lineHeight = v; lhSlider.value = v;
  });

  /* 자간 */
  const lsSlider = document.getElementById('txt-ls-slider');
  const lsNumber = document.getElementById('txt-ls-number');
  lsSlider.addEventListener('input', () => { contentEl.style.letterSpacing = lsSlider.value + 'px'; lsNumber.value = lsSlider.value; });
  lsNumber.addEventListener('input', () => {
    const v = Math.min(40, Math.max(-10, parseFloat(lsNumber.value) || 0));
    contentEl.style.letterSpacing = v + 'px'; lsSlider.value = v;
  });

  /* 패딩 */
  const ptSlider = document.getElementById('txt-pt-slider');
  const ptNumber = document.getElementById('txt-pt-number');
  const pbSlider = document.getElementById('txt-pb-slider');
  const pbNumber = document.getElementById('txt-pb-number');
  ptSlider.addEventListener('input', () => { tb.style.paddingTop    = ptSlider.value+'px'; ptNumber.value = ptSlider.value; });
  ptNumber.addEventListener('input', () => { const v=Math.min(120,Math.max(0,parseInt(ptNumber.value)||0)); tb.style.paddingTop=v+'px'; ptSlider.value=v; });
  pbSlider.addEventListener('input', () => { tb.style.paddingBottom = pbSlider.value+'px'; pbNumber.value = pbSlider.value; });
  pbNumber.addEventListener('input', () => { const v=Math.min(120,Math.max(0,parseInt(pbNumber.value)||0)); tb.style.paddingBottom=v+'px'; pbSlider.value=v; });

  /* 애니메이션 GIF 버튼 */
  document.getElementById('open-anim-btn').addEventListener('click', () => openAnimModal(tb));

  bindLayoutInput(tb);
}

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return '#111111';
  return '#' + m.slice(0,3).map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
}

function showIconCircleProperties(block) {
  const circle   = block.querySelector('.icb-circle');
  const size     = parseInt(block.dataset.size)    || 80;
  const bgColor  = block.dataset.bgColor           || '#e8e8e8';
  const borderV  = block.dataset.border            || 'none';
  const radius   = parseInt(block.dataset.radius)  || 0;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <circle cx="6" cy="6" r="5"/>
          </svg>
        </div>
        <span class="prop-block-name">Icon Circle</span>
      </div>
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">지름</span>
        <input type="range" class="prop-slider" id="icb-size-slider" min="40" max="200" step="4" value="${size}">
        <input type="number" class="prop-number"  id="icb-size-number" min="40" max="200" value="${size}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">색상</div>
      <div class="prop-row">
        <span class="prop-label">배경</span>
        <input type="color" class="prop-color" id="icb-bg-color" value="${bgColor}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">테두리</div>
      <div class="prop-row">
        <span class="prop-label">스타일</span>
        <select class="prop-select" id="icb-border-select">
          <option value="none"   ${borderV==='none'   ?'selected':''}>없음</option>
          <option value="solid"  ${borderV==='solid'  ?'selected':''}>실선</option>
          <option value="dashed" ${borderV==='dashed' ?'selected':''}>점선</option>
        </select>
      </div>
    </div>`;

  const applySize = v => {
    v = Math.min(200, Math.max(40, v));
    block.dataset.size     = v;
    circle.style.width     = v + 'px';
    circle.style.height    = v + 'px';
    document.getElementById('icb-size-slider').value = v;
    document.getElementById('icb-size-number').value = v;
  };
  document.getElementById('icb-size-slider').addEventListener('input',  e => applySize(parseInt(e.target.value)));
  document.getElementById('icb-size-number').addEventListener('change', e => { applySize(parseInt(e.target.value)); pushHistory(); });
  document.getElementById('icb-size-slider').addEventListener('change', () => pushHistory());

  document.getElementById('icb-bg-color').addEventListener('input', e => {
    block.dataset.bgColor  = e.target.value;
    circle.style.background = e.target.value;
  });
  document.getElementById('icb-bg-color').addEventListener('change', () => pushHistory());

  document.getElementById('icb-border-select').addEventListener('change', e => {
    block.dataset.border   = e.target.value;
    circle.dataset.border  = e.target.value;
    pushHistory();
  });
}

function showTableProperties(block) {
  const table    = block.querySelector('.tb-table');
  const thead    = table.querySelector('thead');
  const tbody    = table.querySelector('tbody');
  const colCount = table.querySelector('tr')?.querySelectorAll('th,td').length || 2;
  const rowCount = tbody?.querySelectorAll('tr').length || 0;
  const curStyle = block.dataset.style || 'default';
  const curAlign = block.dataset.cellAlign || 'left';
  const curPad   = parseInt(block.dataset.cellPad) || 10;
  const curSize  = parseInt(table.style.fontSize) || 28;

  const rebuildTable = () => {
    const cols = table.querySelector('tr')?.querySelectorAll('th,td').length || 2;
    const rows = [...(tbody?.querySelectorAll('tr') || [])];
    rows.forEach(tr => {
      const cur = tr.querySelectorAll('td').length;
      if (cur < cols) {
        for (let i = cur; i < cols; i++) {
          const td = document.createElement('td');
          td.setAttribute('contenteditable','false');
          td.textContent = '-';
          tr.appendChild(td);
        }
      } else {
        for (let i = cur; i > cols; i--) tr.lastElementChild?.remove();
      }
    });
    if (thead) {
      const ths = thead.querySelectorAll('th');
      if (ths.length < cols) {
        const tr = thead.querySelector('tr');
        for (let i = ths.length; i < cols; i++) {
          const th = document.createElement('th');
          th.setAttribute('contenteditable','false');
          th.textContent = '항목';
          tr.appendChild(th);
        }
      } else {
        const tr = thead.querySelector('tr');
        for (let i = ths.length; i > cols; i--) tr.lastElementChild?.remove();
      }
    }
    pushHistory();
  };

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1"/>
            <line x1="1" y1="4" x2="11" y2="4"/>
            <line x1="5" y1="4" x2="5" y2="11"/>
          </svg>
        </div>
        <span class="prop-block-name">Table Block</span>
      </div>
      <div class="prop-section-title">행 / 열</div>
      <div class="prop-row">
        <span class="prop-label">행</span>
        <button class="prop-count-btn" id="tbl-row-minus">−</button>
        <span class="prop-count-val" id="tbl-row-count">${rowCount}</span>
        <button class="prop-count-btn" id="tbl-row-plus">+</button>
      </div>
      <div class="prop-row">
        <span class="prop-label">열</span>
        <button class="prop-count-btn" id="tbl-col-minus">−</button>
        <span class="prop-count-val" id="tbl-col-count">${colCount}</span>
        <button class="prop-count-btn" id="tbl-col-plus">+</button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">스타일</div>
      <div class="prop-row">
        <span class="prop-label">테마</span>
        <select class="prop-select" id="tbl-style-select">
          <option value="default"    ${curStyle==='default'   ?'selected':''}>기본</option>
          <option value="stripe"     ${curStyle==='stripe'    ?'selected':''}>스트라이프</option>
          <option value="borderless" ${curStyle==='borderless'?'selected':''}>보더리스</option>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" id="tbl-align-group">
          <button class="prop-align-btn${curAlign==='left'   ?' active':''}" data-align="left">←</button>
          <button class="prop-align-btn${curAlign==='center' ?' active':''}" data-align="center">↔</button>
          <button class="prop-align-btn${curAlign==='right'  ?' active':''}" data-align="right">→</button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">폰트</span>
        <input type="range" class="prop-slider" id="tbl-size-slider" min="12" max="60" step="2" value="${curSize}">
        <input type="number" class="prop-number"  id="tbl-size-number" min="12" max="60" value="${curSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">여백</span>
        <input type="range" class="prop-slider" id="tbl-pad-slider" min="4" max="32" step="2" value="${curPad}">
        <input type="number" class="prop-number"  id="tbl-pad-number" min="4" max="32" value="${curPad}">
      </div>
    </div>
    <div class="prop-section">
      <div style="font-size:11px;color:#888;">셀을 더블클릭하면 텍스트를 편집할 수 있습니다.</div>
    </div>`;

  /* 행 추가/삭제 */
  document.getElementById('tbl-row-plus').addEventListener('click', () => {
    const cols = table.querySelector('tr')?.querySelectorAll('th,td').length || 2;
    const tr = document.createElement('tr');
    for (let i = 0; i < cols; i++) {
      const td = document.createElement('td');
      td.setAttribute('contenteditable','false');
      td.textContent = '-';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
    document.getElementById('tbl-row-count').textContent = tbody.querySelectorAll('tr').length;
    pushHistory();
  });
  document.getElementById('tbl-row-minus').addEventListener('click', () => {
    const rows = tbody.querySelectorAll('tr');
    if (rows.length > 1) { rows[rows.length - 1].remove(); }
    document.getElementById('tbl-row-count').textContent = tbody.querySelectorAll('tr').length;
    pushHistory();
  });

  /* 열 추가/삭제 */
  document.getElementById('tbl-col-plus').addEventListener('click', () => {
    table.querySelectorAll('tr').forEach(tr => {
      const isHead = tr.closest('thead');
      const cell = document.createElement(isHead ? 'th' : 'td');
      cell.setAttribute('contenteditable','false');
      cell.textContent = isHead ? '항목' : '-';
      tr.appendChild(cell);
    });
    document.getElementById('tbl-col-count').textContent = table.querySelector('tr')?.querySelectorAll('th,td').length || 0;
    rebuildTable();
  });
  document.getElementById('tbl-col-minus').addEventListener('click', () => {
    const cols = table.querySelector('tr')?.querySelectorAll('th,td').length || 0;
    if (cols > 1) {
      table.querySelectorAll('tr').forEach(tr => tr.lastElementChild?.remove());
    }
    document.getElementById('tbl-col-count').textContent = table.querySelector('tr')?.querySelectorAll('th,td').length || 0;
    pushHistory();
  });

  /* 스타일 */
  document.getElementById('tbl-style-select').addEventListener('change', e => {
    block.dataset.style = e.target.value;
    pushHistory();
  });

  /* 정렬 */
  document.querySelectorAll('#tbl-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const align = btn.dataset.align;
      block.dataset.cellAlign = align;
      table.querySelectorAll('th, td').forEach(cell => cell.style.textAlign = align);
      document.querySelectorAll('#tbl-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      pushHistory();
    });
  });

  /* 폰트 크기 */
  const applySize = v => {
    table.style.fontSize = v + 'px';
    block.dataset.fontSize = v;
    document.getElementById('tbl-size-slider').value = v;
    document.getElementById('tbl-size-number').value = v;
  };
  document.getElementById('tbl-size-slider').addEventListener('input',  e => applySize(parseInt(e.target.value)));
  document.getElementById('tbl-size-number').addEventListener('change', e => { applySize(parseInt(e.target.value)); pushHistory(); });
  document.getElementById('tbl-size-slider').addEventListener('change', () => pushHistory());

  /* 셀 여백 */
  const applyPad = v => {
    block.dataset.cellPad = v;
    const style = document.getElementById('_tbl-pad-style') || (() => {
      const s = document.createElement('style'); s.id = '_tbl-pad-style'; document.head.appendChild(s); return s;
    })();
    style.textContent = '';
    table.querySelectorAll('th, td').forEach(cell => { cell.style.padding = v + 'px 16px'; });
    document.getElementById('tbl-pad-slider').value = v;
    document.getElementById('tbl-pad-number').value = v;
  };
  document.getElementById('tbl-pad-slider').addEventListener('input',  e => applyPad(parseInt(e.target.value)));
  document.getElementById('tbl-pad-number').addEventListener('change', e => { applyPad(parseInt(e.target.value)); pushHistory(); });
  document.getElementById('tbl-pad-slider').addEventListener('change', () => pushHistory());
}

function showGapProperties(gb) {
  const currentH = gb.offsetHeight;
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="4" x2="11" y2="4" stroke-dasharray="2,1"/>
            <line x1="1" y1="8" x2="11" y2="8" stroke-dasharray="2,1"/>
          </svg>
        </div>
        <span class="prop-block-name">Gap Block</span>
      </div>
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="gap-slider" min="0" max="400" step="4" value="${currentH}">
        <input type="number" class="prop-number" id="gap-number" min="0" max="400" value="${currentH}">
      </div>
    </div>`;

  const slider = document.getElementById('gap-slider');
  const number = document.getElementById('gap-number');

  slider.addEventListener('input', () => {
    gb.style.height = slider.value + 'px';
    number.value = slider.value;
  });
  number.addEventListener('input', () => {
    const v = Math.min(400, Math.max(0, parseInt(number.value) || 0));
    gb.style.height = v + 'px';
    slider.value = v;
  });
}

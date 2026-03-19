/* ═══════════════════════════════════
   ZOOM
═══════════════════════════════════ */
const CANVAS_W = 860;
let currentZoom = 70;
const scaler = document.getElementById('canvas-scaler');
const zoomDisplay = document.getElementById('zoom-display');

function applyZoom(z) {
  currentZoom = Math.min(150, Math.max(25, z));
  scaler.style.transform = `scale(${currentZoom / 100})`;
  zoomDisplay.textContent = currentZoom + '%';
}
function zoomStep(delta) { applyZoom(currentZoom + delta); }
function zoomFit() {
  const wrap = document.getElementById('canvas-wrap');
  applyZoom(Math.floor(((wrap.clientWidth - 80) / CANVAS_W) * 100));
}

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey) {
    if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomStep(10); }
    if (e.key === '-')                  { e.preventDefault(); zoomStep(-10); }
    if (e.key === '0')                  { e.preventDefault(); applyZoom(100); }
  }
  if (e.key === 'Escape') deselectAll();

  if (e.key === 'Delete' || e.key === 'Backspace') {
    // 텍스트 편집 중이거나 input에 포커스가 있으면 기본 동작 유지
    if (document.querySelector('.text-block.editing')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    const selText    = document.querySelector('.text-block.selected');
    const selAsset   = document.querySelector('.asset-block.selected');
    const selGap     = document.querySelector('.gap-block.selected');
    const selSection = document.querySelector('.section-block.selected');

    if (selText || selAsset) {
      e.preventDefault();
      const block = selText || selAsset;
      (block.closest('.row') || block).remove();
      deselectAll();
      buildLayerPanel();
    } else if (selGap) {
      e.preventDefault();
      selGap.remove();
      deselectAll();
      buildLayerPanel();
    } else if (selSection) {
      e.preventDefault();
      selSection.remove();
      deselectAll();
      buildLayerPanel();
    }
  }
});

applyZoom(70);

/* ═══════════════════════════════════
   LAYER PANEL
═══════════════════════════════════ */
const layerIcons = {
  section: `<svg class="layer-section-icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="12" height="12" rx="1.5"/></svg>`,
  heading: `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="currentColor"><text x="0" y="10" font-size="10" font-weight="700" font-family="serif">H</text></svg>`,
  body:    `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="11" y2="3"/><line x1="1" y1="6" x2="11" y2="6"/><line x1="1" y1="9" x2="7" y2="9"/></svg>`,
  caption: `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="4" x2="11" y2="4"/><line x1="1" y1="7" x2="8" y2="7"/></svg>`,
  asset:   `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="10" height="10" rx="1"/><circle cx="4" cy="4" r="1"/><polyline points="11 8 8 5 3 11"/></svg>`,
  gap:     `<svg class="layer-item-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="4" x2="11" y2="4" stroke-dasharray="2,1"/><line x1="1" y1="8" x2="11" y2="8" stroke-dasharray="2,1"/></svg>`,
};

function buildLayerPanel() {
  const panel = document.getElementById('layer-panel-body');
  panel.innerHTML = '';

  document.querySelectorAll('.section-block').forEach((sec, si) => {
    const sIdx = si + 1;
    const sectionEl = document.createElement('div');
    sectionEl.className = 'layer-section';
    sectionEl.dataset.section = sIdx;

    const header = document.createElement('div');
    header.className = 'layer-section-header';

    const chevron = document.createElement('div');
    chevron.innerHTML = `<svg class="layer-chevron" viewBox="0 0 12 12" fill="currentColor"><path d="M2 4l4 4 4-4"/></svg>${layerIcons.section}`;
    chevron.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';

    const nameEl = document.createElement('span');
    nameEl.className = 'layer-section-name';
    nameEl.textContent = sec._name || 'Section';

    header.appendChild(chevron);
    header.appendChild(nameEl);

    // 헤더 클릭 (이름 영역 제외) → 접기/펼치기 + 선택
    chevron.addEventListener('click', () => {
      const collapsed = sectionEl.classList.toggle('collapsed');
      if (!collapsed) selectSection(sec);
    });

    // 이름 클릭 → 섹션 선택
    nameEl.addEventListener('click', e => {
      e.stopPropagation();
      selectSection(sec);
    });

    // 이름 더블클릭 → 인라인 편집
    nameEl.addEventListener('dblclick', e => {
      e.stopPropagation();
      nameEl.contentEditable = 'true';
      nameEl.classList.add('editing');
      nameEl.focus();
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);

      const finish = () => {
        nameEl.contentEditable = 'false';
        nameEl.classList.remove('editing');
        const newName = nameEl.textContent.trim() || 'Section';
        nameEl.textContent = newName;
        sec._name = newName;
        const label = sec.querySelector('.section-label');
        if (label) label.textContent = newName;
      };
      nameEl.addEventListener('blur', finish, { once: true });
      nameEl.addEventListener('keydown', ev => {
        if (ev.key === 'Enter')  { ev.preventDefault(); nameEl.blur(); }
        if (ev.key === 'Escape') { nameEl.textContent = sec._name || 'Section'; nameEl.blur(); }
      });
    });

    const children = document.createElement('div');
    children.className = 'layer-children';

    let itemIdx = 0;
    sec.querySelectorAll('.text-block, .asset-block, .gap-block').forEach(block => {
      const isText = block.classList.contains('text-block');
      const isGap  = block.classList.contains('gap-block');
      const type   = isText ? (block.dataset.type || 'body') : isGap ? 'gap' : 'asset';
      const labels     = { heading: 'Heading', body: 'Body', caption: 'Caption', asset: 'Asset', gap: 'Gap' };
      const typeLabels = { heading: 'Text', body: 'Text', caption: 'Text', asset: 'Image', gap: 'Gap' };

      const item = document.createElement('div');
      item.className = 'layer-item';
      item.dataset.blockIdx = itemIdx++;
      item.innerHTML = `
        ${layerIcons[type]}
        <span class="layer-item-name">${labels[type]}</span>
        <span class="layer-item-type">${typeLabels[type]}</span>
      `;

      item.addEventListener('click', e => {
        e.stopPropagation();
        deselectAll();
        block.classList.add('selected');
        syncSection(sec);
        highlightBlock(block, item);
        if (isText) showTextProperties(block);
        else if (isGap) showGapProperties(block);
      });

      block.addEventListener('mouseenter', () => item.style.background = '#252525');
      block.addEventListener('mouseleave', () => { if (!item.classList.contains('active')) item.style.background = ''; });

      // 레이어 아이템 드래그
      const itemDragTarget = isGap ? block : (block.closest('.row') || block);
      item._dragTarget = itemDragTarget;
      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', e => {
        e.stopPropagation();
        layerDragSrc = item;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
        requestAnimationFrame(() => item.classList.add('layer-dragging'));
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('layer-dragging');
        clearLayerIndicators();
        layerDragSrc = null;
      });

      children.appendChild(item);
      block._layerItem = item;
    });

    // 레이어 패널 드롭존
    children.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!layerDragSrc) return;
      clearLayerIndicators();
      const after = getLayerDragAfterItem(children, e.clientY);
      const indicator = document.createElement('div');
      indicator.className = 'layer-drop-indicator';
      if (after) children.insertBefore(indicator, after);
      else children.appendChild(indicator);
    });
    children.addEventListener('dragleave', e => {
      if (!children.contains(e.relatedTarget)) clearLayerIndicators();
    });
    children.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!layerDragSrc) return;
      const sectionInner = sec.querySelector('.section-inner');
      const dragTarget = layerDragSrc._dragTarget;
      const indicator = children.querySelector('.layer-drop-indicator');
      if (indicator) {
        const nextItem = indicator.nextElementSibling;
        if (nextItem && nextItem._dragTarget) {
          sectionInner.insertBefore(dragTarget, nextItem._dragTarget);
        } else {
          const bottomGap = [...sectionInner.querySelectorAll(':scope > .gap-block')].at(-1);
          if (bottomGap && bottomGap !== dragTarget) sectionInner.insertBefore(dragTarget, bottomGap);
          else sectionInner.appendChild(dragTarget);
        }
      }
      clearLayerIndicators();
      buildLayerPanel();
      layerDragSrc = null;
    });

    sectionEl.appendChild(header);
    sectionEl.appendChild(children);
    panel.appendChild(sectionEl);

    sec._layerEl = sectionEl;
    sec._layerHeader = header;
  });
}

function syncLayerActive(sec) {
  document.querySelectorAll('.layer-section-header').forEach(h => h.classList.remove('active'));
  if (sec && sec._layerHeader) sec._layerHeader.classList.add('active');
}

function highlightBlock(block, layerItem) {
  document.querySelectorAll('.layer-item').forEach(i => { i.classList.remove('active'); i.style.background = ''; });
  if (layerItem) layerItem.classList.add('active');
}

/* ═══════════════════════════════════
   SELECTION
═══════════════════════════════════ */
function selectSection(sec) {
  deselectAll();
  sec.classList.add('selected');
  syncLayerActive(sec);
}

/* 블록이 선택된 상태에서 소속 섹션만 하이라이트 (deselectAll 없이) */
function syncSection(sec) {
  document.querySelectorAll('.section-block').forEach(s => s.classList.remove('selected'));
  sec.classList.add('selected');
  syncLayerActive(sec);
}

function deselectAll() {
  document.querySelectorAll('.section-block').forEach(s => s.classList.remove('selected'));
  document.querySelectorAll('.text-block').forEach(t => {
    t.classList.remove('selected', 'editing');
    t.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('contenteditable','false'));
  });
  document.querySelectorAll('.asset-block').forEach(a => a.classList.remove('selected'));
  document.querySelectorAll('.gap-block').forEach(g => g.classList.remove('selected'));
  document.querySelectorAll('.layer-section-header').forEach(h => h.classList.remove('active'));
  document.querySelectorAll('.layer-item').forEach(i => { i.classList.remove('active'); i.style.background = ''; });
  showPageProperties();
}

function bindSectionDelete(sec) {
  const btns = sec.querySelectorAll('.section-toolbar .st-btn');
  if (btns[2]) {
    btns[2].addEventListener('click', e => {
      e.stopPropagation();
      sec.remove();
      deselectAll();
      buildLayerPanel();
    });
  }
}

document.querySelectorAll('.section-block').forEach(sec => {
  sec.addEventListener('click', e => { e.stopPropagation(); selectSection(sec); });
  bindSectionDelete(sec);
  bindSectionDropZone(sec);
});

document.getElementById('canvas-wrap').addEventListener('click', e => {
  if (['canvas-wrap','canvas-scaler','canvas'].includes(e.target.id)) deselectAll();
});

/* ── Static 블록 초기 바인딩 ── */
document.querySelectorAll('.text-block, .asset-block, .gap-block').forEach(b => bindBlock(b));

/* ═══════════════════════════════════
   PROPERTIES PANEL
═══════════════════════════════════ */
const propPanel   = document.querySelector('#panel-right .panel-body');
const canvasEl    = document.getElementById('canvas');
const canvasWrap  = document.getElementById('canvas-wrap');

let pageSettings = { bg: '#141414', gap: 20 };

function showPageProperties() {
  const { bg, gap } = pageSettings;
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
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">섹션 간격</span>
        <input type="range" class="prop-slider" id="section-gap-slider" min="0" max="100" step="4" value="${gap}">
        <input type="number" class="prop-number" id="section-gap-number" min="0" max="100" value="${gap}">
      </div>
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
    const v = Math.min(100, Math.max(0, parseInt(gapNumber.value) || 0));
    pageSettings.gap = v;
    canvasEl.style.gap = v + 'px';
    gapSlider.value = v;
  });
}

function showTextProperties(tb) {
  const contentEl = tb.querySelector('[contenteditable]');
  const computed   = window.getComputedStyle(contentEl);

  const currentClass = ['tb-h1','tb-h2','tb-body','tb-caption'].find(c => contentEl.classList.contains(c)) || 'tb-body';
  const currentAlign = contentEl.style.textAlign || 'left';
  const currentSize  = parseInt(computed.fontSize) || 15;
  const currentColor = rgbToHex(computed.color) || '#111111';
  const currentLH    = (parseFloat(computed.lineHeight) / parseFloat(computed.fontSize) || 1.5).toFixed(2);
  const currentPadT  = parseInt(tb.style.paddingTop)    || 32;
  const currentPadB  = parseInt(tb.style.paddingBottom) || 32;
  const currentFont  = contentEl.style.fontFamily || '';

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
      <div class="prop-section-title">타입</div>
      <div class="prop-type-group">
        <button class="prop-type-btn ${currentClass==='tb-h1'?'active':''}"      data-cls="tb-h1">H1</button>
        <button class="prop-type-btn ${currentClass==='tb-h2'?'active':''}"      data-cls="tb-h2">H2</button>
        <button class="prop-type-btn ${currentClass==='tb-body'?'active':''}"    data-cls="tb-body">Body</button>
        <button class="prop-type-btn ${currentClass==='tb-caption'?'active':''}" data-cls="tb-caption">Cap</button>
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
        <input type="range" class="prop-slider" id="txt-size-slider" min="8" max="80" step="1" value="${currentSize}">
        <input type="number" class="prop-number" id="txt-size-number" min="8" max="80" value="${currentSize}">
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
        <span class="prop-label">상단</span>
        <input type="range" class="prop-slider" id="txt-pt-slider" min="0" max="120" step="4" value="${currentPadT}">
        <input type="number" class="prop-number" id="txt-pt-number" min="0" max="120" value="${currentPadT}">
      </div>
      <div class="prop-row">
        <span class="prop-label">하단</span>
        <input type="range" class="prop-slider" id="txt-pb-slider" min="0" max="120" step="4" value="${currentPadB}">
        <input type="number" class="prop-number" id="txt-pb-number" min="0" max="120" value="${currentPadB}">
      </div>
    </div>`;

  /* 폰트 종류 */
  document.getElementById('txt-font-family').addEventListener('change', e => {
    contentEl.style.fontFamily = e.target.value;
  });

  /* 타입 전환 */
  const labelMap = { 'tb-h1':'Heading','tb-h2':'Heading','tb-body':'Body','tb-caption':'Caption' };
  const typeMap2 = { 'tb-h1':'heading','tb-h2':'heading','tb-body':'body','tb-caption':'caption' };
  propPanel.querySelectorAll('.prop-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cls = btn.dataset.cls;
      contentEl.className = cls;
      tb.querySelector('.text-block-label').textContent = labelMap[cls];
      tb.dataset.type = typeMap2[cls];
      propPanel.querySelectorAll('.prop-type-btn').forEach(b => b.classList.toggle('active', b===btn));
    });
  });

  /* 정렬 */
  propPanel.querySelectorAll('.prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      contentEl.style.textAlign = btn.dataset.align;
      propPanel.querySelectorAll('.prop-align-btn').forEach(b => b.classList.toggle('active', b===btn));
    });
  });

  /* 폰트 크기 */
  const sizeSlider = document.getElementById('txt-size-slider');
  const sizeNumber = document.getElementById('txt-size-number');
  sizeSlider.addEventListener('input', () => { contentEl.style.fontSize = sizeSlider.value+'px'; sizeNumber.value = sizeSlider.value; });
  sizeNumber.addEventListener('input', () => {
    const v = Math.min(80, Math.max(8, parseInt(sizeNumber.value)||8));
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

  /* 패딩 */
  const ptSlider = document.getElementById('txt-pt-slider');
  const ptNumber = document.getElementById('txt-pt-number');
  const pbSlider = document.getElementById('txt-pb-slider');
  const pbNumber = document.getElementById('txt-pb-number');
  ptSlider.addEventListener('input', () => { tb.style.paddingTop    = ptSlider.value+'px'; ptNumber.value = ptSlider.value; });
  ptNumber.addEventListener('input', () => { const v=Math.min(120,Math.max(0,parseInt(ptNumber.value)||0)); tb.style.paddingTop=v+'px'; ptSlider.value=v; });
  pbSlider.addEventListener('input', () => { tb.style.paddingBottom = pbSlider.value+'px'; pbNumber.value = pbSlider.value; });
  pbNumber.addEventListener('input', () => { const v=Math.min(120,Math.max(0,parseInt(pbNumber.value)||0)); tb.style.paddingBottom=v+'px'; pbSlider.value=v; });
}

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m) return '#111111';
  return '#' + m.slice(0,3).map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
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

/* ═══════════════════════════════════
   BLOCK / SECTION 추가
═══════════════════════════════════ */
const ASSET_SVG = `
  <svg class="asset-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>`;

function getSelectedSection() {
  return document.querySelector('.section-block.selected');
}

/* ═══════════════════════════════════
   DRAG AND DROP
═══════════════════════════════════ */
let dragSrc = null;
let layerDragSrc = null;

function getDragAfterElement(container, y) {
  const children = [...container.children].filter(el =>
    !el.classList.contains('drop-indicator') && el !== dragSrc
  );
  return children.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function clearDropIndicators() {
  document.querySelectorAll('.drop-indicator').forEach(d => d.remove());
}

function clearLayerIndicators() {
  document.querySelectorAll('.layer-drop-indicator').forEach(d => d.remove());
}

function getLayerDragAfterItem(container, y) {
  const items = [...container.children].filter(el =>
    el.classList.contains('layer-item') && el !== layerDragSrc
  );
  return items.reduce((closest, item) => {
    const box = item.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: item };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function bindSectionDropZone(sec) {
  const inner = sec.querySelector('.section-inner');
  inner.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDropIndicators();
    const after = getDragAfterElement(inner, e.clientY);
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    if (after) inner.insertBefore(indicator, after);
    else inner.appendChild(indicator);
  });
  inner.addEventListener('dragleave', e => {
    if (!inner.contains(e.relatedTarget)) clearDropIndicators();
  });
  inner.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragSrc) return;
    const indicator = inner.querySelector('.drop-indicator');
    if (indicator) inner.insertBefore(dragSrc, indicator);
    else inner.appendChild(dragSrc);
    clearDropIndicators();
    buildLayerPanel();
    dragSrc = null;
  });
}

function bindBlock(block) {
  const isText  = block.classList.contains('text-block');
  const isGap   = block.classList.contains('gap-block');
  const isAsset = block.classList.contains('asset-block');

  if (isText) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      deselectAll();
      block.classList.add('selected');
      syncSection(block.closest('.section-block'));
      highlightBlock(block, block._layerItem);
      showTextProperties(block);
    });
    block.addEventListener('dblclick', e => {
      e.stopPropagation();
      block.classList.add('editing');
      block.querySelectorAll('[contenteditable]').forEach(el => {
        el.setAttribute('contenteditable', 'true');
        el.focus();
      });
    });
  }

  if (isAsset) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      deselectAll();
      block.classList.add('selected');
      syncSection(block.closest('.section-block'));
      highlightBlock(block, block._layerItem);
    });
  }

  if (isGap) {
    block.addEventListener('click', e => {
      e.stopPropagation();
      deselectAll();
      block.classList.add('selected');
      syncSection(block.closest('.section-block'));
      highlightBlock(block, block._layerItem);
      showGapProperties(block);
    });
  }

  // hover ↔ layer item
  block.addEventListener('mouseenter', () => { if (block._layerItem) block._layerItem.style.background = '#252525'; });
  block.addEventListener('mouseleave', () => { if (block._layerItem && !block._layerItem.classList.contains('active')) block._layerItem.style.background = ''; });

  // 드래그 이벤트
  const dragTarget = isGap ? block : (block.closest('.row') || block);
  if (dragTarget && !dragTarget._dragBound) {
    dragTarget._dragBound = true;
    dragTarget.setAttribute('draggable', 'true');
    if (isText) block.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('draggable', 'false'));

    dragTarget.addEventListener('dragstart', e => {
      if (block.classList.contains('editing')) { e.preventDefault(); return; }
      dragSrc = dragTarget;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
      // ghost 이미지 투명 처리 (zoom 왜곡 방지)
      const ghost = document.createElement('div');
      ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => ghost.remove(), 0);
      requestAnimationFrame(() => dragTarget.classList.add('dragging'));
    });
    dragTarget.addEventListener('dragend', () => {
      dragTarget.classList.remove('dragging');
      clearDropIndicators();
      dragSrc = null;
    });
  }
}

function makeTextBlock(type) {
  const classMap  = { h1:'tb-h1', h2:'tb-h2', body:'tb-body', caption:'tb-caption' };
  const labelMap  = { h1:'Heading', h2:'Heading', body:'Body', caption:'Caption' };
  const dataType  = (type==='h1'||type==='h2') ? 'heading' : type;
  const placeholder = { h1:'제목을 입력하세요', h2:'소제목을 입력하세요', body:'본문을 입력하세요', caption:'캡션을 입력하세요' };

  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const tb = document.createElement('div');
  tb.className = 'text-block'; tb.dataset.type = dataType;
  tb.innerHTML = `
    <span class="text-block-label">${labelMap[type]}</span>
    <div class="${classMap[type]}" contenteditable="false">${placeholder[type]}</div>`;

  col.appendChild(tb);
  row.appendChild(col);
  return { row, block: tb };
}

function makeAssetBlock() {
  const row = document.createElement('div');
  row.className = 'row'; row.dataset.layout = 'stack';

  const col = document.createElement('div');
  col.className = 'col'; col.dataset.width = '100';

  const ab = document.createElement('div');
  ab.className = 'asset-block';
  ab.innerHTML = `
    <span class="asset-tag">Image / GIF</span>
    ${ASSET_SVG}
    <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>
    <span class="asset-sub">PNG · JPG · GIF · WebP</span>
    <span class="asset-size">860 × 780</span>`;

  col.appendChild(ab);
  row.appendChild(col);
  return { row, block: ab };
}

function makeGapBlock() {
  const gb = document.createElement('div');
  gb.className = 'gap-block'; gb.dataset.type = 'gap';
  return gb;
}

/* 섹션 안 삽입 — 하단 Gap Block 바로 앞에 */
function insertBeforeBottomGap(section, el) {
  const inner = section.querySelector('.section-inner');
  const bottomGap = [...inner.querySelectorAll(':scope > .gap-block')].at(-1);
  if (bottomGap) inner.insertBefore(el, bottomGap);
  else inner.appendChild(el);
}

function addTextBlock(type) {
  const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
  if (!sec) return;
  const { row, block } = makeTextBlock(type);
  insertBeforeBottomGap(sec, row);
  bindBlock(block);
  buildLayerPanel();
  selectSection(sec);
}

function addAssetBlock() {
  const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
  if (!sec) return;
  const { row, block } = makeAssetBlock();
  insertBeforeBottomGap(sec, row);
  bindBlock(block);
  buildLayerPanel();
  selectSection(sec);
}

function addGapBlock() {
  const sec = getSelectedSection() || document.querySelector('.section-block:last-child');
  if (!sec) return;
  const gb = makeGapBlock();
  insertBeforeBottomGap(sec, gb);
  bindBlock(gb);
  buildLayerPanel();
  selectSection(sec);
}

function addSection() {
  const canvas  = document.getElementById('canvas');
  const secList = canvas.querySelectorAll('.section-block');
  const newIdx  = secList.length + 1;

  const sec = document.createElement('div');
  sec.className = 'section-block'; sec.dataset.section = newIdx;
  sec.innerHTML = `
    <span class="section-label">Section ${String(newIdx).padStart(2,'0')}</span>
    <div class="section-toolbar">
      <button class="st-btn">↑</button>
      <button class="st-btn">↓</button>
      <button class="st-btn" style="color:#e06c6c;">✕</button>
    </div>
    <div class="section-inner">
      <div class="gap-block" data-type="gap"></div>
      <div class="row" data-layout="stack">
        <div class="col" data-width="100">
          <div class="text-block" data-type="heading">
            <span class="text-block-label">Heading</span>
            <div class="tb-h2" contenteditable="false">새 섹션 제목</div>
          </div>
        </div>
      </div>
      <div class="row" data-layout="stack">
        <div class="col" data-width="100">
          <div class="asset-block">
            <span class="asset-tag">Image / GIF</span>
            ${ASSET_SVG}
            <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>
            <span class="asset-sub">PNG · JPG · GIF · WebP</span>
            <span class="asset-size">860 × 780</span>
          </div>
        </div>
      </div>
      <div class="gap-block" data-type="gap"></div>
    </div>`;

  const selectedSec = document.querySelector('.section-block.selected');
  if (selectedSec) selectedSec.after(sec);
  else canvas.appendChild(sec);

  // 이벤트 바인딩
  sec.addEventListener('click', e => { e.stopPropagation(); selectSection(sec); });
  bindSectionDelete(sec);
  bindSectionDropZone(sec);
  sec.querySelectorAll('.text-block, .asset-block, .gap-block').forEach(b => bindBlock(b));

  buildLayerPanel();
  selectSection(sec);
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Init ── */
canvasWrap.style.background = pageSettings.bg;
canvasEl.style.gap = pageSettings.gap + 'px';
buildLayerPanel();
showPageProperties();

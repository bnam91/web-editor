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
    <div class="col-add-menu" style="display:none">
      <button class="col-add-item" data-add="h2">Heading</button>
      <button class="col-add-item" data-add="body">Body</button>
      <button class="col-add-item" data-add="caption">Caption</button>
      <button class="col-add-item" data-add="label">Label</button>
      <div class="col-add-divider"></div>
      <button class="col-add-item" data-add="asset">Asset</button>
    </div>`;

  const menu = ph.querySelector('.col-add-menu');

  ph.querySelectorAll('.col-add-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      menu.style.display = 'none';
      const type = item.dataset.add;
      let block;
      if (type === 'asset') {
        const ab = document.createElement('div');
        ab.className = 'asset-block';
        // grid/flex col 안에서는 부모 높이에 맞춤, stack에서만 고정 높이
        const rowLayout = col.closest('.row')?.dataset.layout;
        if (rowLayout !== 'grid' && rowLayout !== 'flex') ab.style.height = '460px';
        ab.innerHTML = `
          ${window.ASSET_SVG || ''}
          <div class="asset-overlay"></div>`;
        block = ab;
      } else {
        const { block: tb } = window.makeTextBlock(type);
        block = tb;
      }
      col.replaceChild(block, ph);
      window.bindBlock(block);
      window.buildLayerPanel();
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

  window.buildLayerPanel();
}

function bindLayoutInput(block) {
  const input = document.getElementById('layout-ratio');
  if (!input) return;
  const apply = () => applyRowLayout(block, input.value);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
  input.addEventListener('blur', apply);
}

window.getCurrentRatioStr = getCurrentRatioStr;
window.bindLayoutInput    = bindLayoutInput;
window.makeColPlaceholder  = makeColPlaceholder;
window.makeEmptyCol        = makeEmptyCol;

/* ── Col 프로퍼티 패널 ── */
function getColBlockType(block) {
  if (!block) return null;
  if (block.classList.contains('text-block'))         return block.dataset.type || 'body';
  if (block.classList.contains('asset-block'))        return 'asset';
  if (block.classList.contains('icon-circle-block'))  return 'icon-circle';
  if (block.classList.contains('table-block'))        return 'table';
  if (block.classList.contains('card-block'))         return 'card';
  if (block.classList.contains('strip-banner-block')) return 'banner';
  if (block.classList.contains('graph-block'))        return 'graph';
  if (block.classList.contains('divider-block'))      return 'divider';
  if (block.classList.contains('label-group-block'))  return 'label-group';
  return 'unknown';
}

const COL_BLOCK_OPTIONS = [
  { value: '',           label: '— 비우기 —' },
  { value: 'h2',         label: 'Heading' },
  { value: 'body',       label: 'Body' },
  { value: 'caption',    label: 'Caption' },
  { value: 'label',      label: 'Label' },
  { value: 'asset',      label: 'Asset' },
  { value: 'icon-circle',label: 'Icon Circle' },
  { value: 'table',      label: 'Table' },
  { value: 'divider',    label: 'Divider' },
];

function showColProperties(colEl) {
  const row      = colEl.closest('.row');
  const cols     = row ? [...row.querySelectorAll(':scope > .col')] : [];
  const colIdx   = cols.indexOf(colEl) + 1;
  const block    = [...colEl.children].find(el =>
    !el.classList.contains('col-placeholder') && !el.classList.contains('col-add-menu')
  );
  const blockType = getColBlockType(block);

  // 현재 배경색
  const rawBg = colEl.style.backgroundColor || '';
  const hexBg = rawBg ? (/^#[0-9a-f]{6}$/i.test(rawBg) ? rawBg : (window.rgbToHex?.(rawBg) || '#ffffff')) : '#ffffff';

  // 현재 세로 정렬
  const curJustify = colEl.style.justifyContent || 'flex-start';
  const vAligns = [
    { val: 'flex-start', icon: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="2" y1="2" x2="12" y2="2"/><rect x="4" y="4" width="6" height="6" rx="0.5"/></svg>`, title: '상단' },
    { val: 'center',     icon: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="2" y1="7" x2="12" y2="7"/><rect x="4" y="4" width="6" height="6" rx="0.5"/></svg>`, title: '중앙' },
    { val: 'flex-end',   icon: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="2" y1="12" x2="12" y2="12"/><rect x="4" y="4" width="6" height="6" rx="0.5"/></svg>`, title: '하단' },
  ];

  // 드롭다운 option 생성
  const optionsHTML = COL_BLOCK_OPTIONS.map(o =>
    `<option value="${o.value}" ${blockType === o.value ? 'selected' : ''}>${o.label}</option>`
  ).join('');

  const contentsLabel = blockType
    ? COL_BLOCK_OPTIONS.find(o => o.value === blockType)?.label || blockType
    : 'Empty';

  const panel = document.querySelector('#panel-right .panel-body');
  if (!panel) return;

  panel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">Col ${colIdx}</span>
          <span class="prop-breadcrumb">Frame</span>
        </div>
        ${colEl.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${colEl.id}')">${colEl.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Contents</div>
      <div class="prop-row" style="gap:8px;">
        <span class="prop-label" style="flex-shrink:0">${contentsLabel}</span>
        <select class="prop-select" id="col-block-swap" style="flex:1">
          ${optionsHTML}
        </select>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">배경</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${hexBg}">
          <input type="color" id="col-bg-color" value="${hexBg}">
        </div>
        <input type="text" class="prop-color-hex" id="col-bg-hex" value="${hexBg}" maxlength="7">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">세로 정렬</div>
      <div class="prop-align-group">
        ${vAligns.map(a => `
          <button class="prop-align-btn${curJustify === a.val ? ' active' : ''}" data-justify="${a.val}" title="${a.title}">
            ${a.icon}
          </button>`).join('')}
      </div>
    </div>`;

  // ── 드롭다운: 블록 교체 ──
  panel.querySelector('#col-block-swap').addEventListener('change', e => {
    const newType = e.target.value;
    const ph = colEl.querySelector('.col-placeholder');
    // 기존 블록 제거
    if (block) block.remove();
    if (newType === '') {
      // 비우기: placeholder 복원
      if (!ph) colEl.appendChild(window.makeColPlaceholder(colEl));
    } else {
      let newBlock;
      if (newType === 'asset') {
        newBlock = document.createElement('div');
        newBlock.className = 'asset-block';
        const rowLayout = row?.dataset.layout;
        if (rowLayout !== 'grid' && rowLayout !== 'flex') newBlock.style.height = '460px';
        newBlock.innerHTML = `<div class="asset-overlay"></div>`;
      } else if (newType === 'icon-circle') {
        const { block: icb } = window.makeIconCircleBlock();
        newBlock = icb;
      } else if (newType === 'table') {
        const { block: tbl } = window.makeTableBlock();
        newBlock = tbl;
      } else if (newType === 'divider') {
        const { block: dvd } = window.makeDividerBlock();
        newBlock = dvd;
      } else {
        const { block: tb } = window.makeTextBlock(newType);
        newBlock = tb;
      }
      if (ph) colEl.replaceChild(newBlock, ph);
      else colEl.appendChild(newBlock);
      window.bindBlock(newBlock);
    }
    if (window.pushHistory) window.pushHistory('Col 블록 교체');
    window.buildLayerPanel();
    showColProperties(colEl);
  });

  // ── 배경색 ──
  const bgInput  = panel.querySelector('#col-bg-color');
  const bgHexInp = panel.querySelector('#col-bg-hex');
  const swatch   = panel.querySelector('.prop-color-swatch');
  bgInput.addEventListener('input', () => {
    colEl.style.backgroundColor = bgInput.value;
    bgHexInp.value = bgInput.value;
    swatch.style.background = bgInput.value;
  });
  bgHexInp.addEventListener('change', () => {
    const v = bgHexInp.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) { colEl.style.backgroundColor = v; bgInput.value = v; swatch.style.background = v; }
  });

  // ── 세로 정렬 ──
  panel.querySelectorAll('[data-justify]').forEach(btn => {
    btn.addEventListener('click', () => {
      colEl.style.justifyContent = btn.dataset.justify;
      panel.querySelectorAll('[data-justify]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

window.showColProperties = showColProperties;

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

/* ── Row col-add 버튼 ── */
function bindRowColAdd(rowEl) {
  if (rowEl.querySelector('.row-col-add-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'row-col-add-btn';
  btn.title = '열 추가';
  btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>`;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    window.pushHistory();
    const layout = rowEl.dataset.layout || 'stack';
    if (layout === 'stack' || layout === 'flex') {
      rowEl.dataset.layout = 'flex';
      rowEl.style.display = '';
      rowEl.style.gridTemplateColumns = '';
      const existingCols = [...rowEl.querySelectorAll(':scope > .col')];
      existingCols.forEach(c => { c.style.flex = '1'; c.dataset.flex = '1'; });
      const newCol = window.makeEmptyCol('1');
      rowEl.insertBefore(newCol, btn);
      rowEl.dataset.ratioStr = `${rowEl.querySelectorAll(':scope > .col').length}*1`;
    } else if (layout === 'grid') {
      const gtc = rowEl.style.gridTemplateColumns || '';
      let colCount = gtc.startsWith('repeat(') ? (parseInt(gtc.match(/repeat\((\d+)/)?.[1]) || 1) : (gtc ? gtc.split(/\s+/).filter(Boolean).length : 1);
      colCount++;
      rowEl.style.gridTemplateColumns = `repeat(${colCount}, 1fr)`;
      const newCol = window.makeEmptyCol(null);
      rowEl.insertBefore(newCol, btn);
      rowEl.dataset.ratioStr = `${colCount}*${Math.ceil(rowEl.querySelectorAll(':scope > .col').length / colCount)}`;
    }
    window.buildLayerPanel();
    window.triggerAutoSave?.();
  });
  rowEl.appendChild(btn);
}
window.bindRowColAdd = bindRowColAdd;

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


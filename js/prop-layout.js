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

window.getCurrentRatioStr = getCurrentRatioStr;
window.bindLayoutInput    = bindLayoutInput;
window.makeColPlaceholder  = makeColPlaceholder;
window.makeEmptyCol        = makeEmptyCol;

/* ── Col 프로퍼티 패널 ── */
function showColProperties(colEl) {
  const row = colEl.closest('.row');
  const cols = row ? [...row.querySelectorAll(':scope > .col')] : [];
  const colIdx = cols.indexOf(colEl) + 1;
  const block = [...colEl.children].find(el =>
    !el.classList.contains('col-placeholder') && !el.classList.contains('col-add-menu')
  );

  /* 블록이 있으면 해당 prop 패널로 위임 */
  if (block) {
    if (block.classList.contains('asset-block')        && window.showAssetProperties)       return window.showAssetProperties(block);
    if (block.classList.contains('text-block')         && window.showTextProperties)        return window.showTextProperties(block);
    if (block.classList.contains('icon-circle-block')  && window.showIconCircleProperties)  return window.showIconCircleProperties(block);
    if (block.classList.contains('table-block')        && window.showTableProperties)       return window.showTableProperties(block);
    if (block.classList.contains('card-block')         && window.showCardProperties)        return window.showCardProperties(block);
    if (block.classList.contains('strip-banner-block') && window.showStripBannerProperties) return window.showStripBannerProperties(block);
    if (block.classList.contains('graph-block')        && window.showGraphProperties)       return window.showGraphProperties(block);
    if (block.classList.contains('divider-block')      && window.showDividerProperties)     return window.showDividerProperties(block);
    if (block.classList.contains('label-group-block')  && window.showLabelGroupProperties)  return window.showLabelGroupProperties(block);
  }

  /* 비어있는 col: 간단한 패널 표시 */
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
        </div>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">블록 추가</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
        <button class="prop-action-btn secondary" data-add="h2">Heading</button>
        <button class="prop-action-btn secondary" data-add="body">Body</button>
        <button class="prop-action-btn secondary" data-add="caption">Caption</button>
        <button class="prop-action-btn secondary" data-add="asset">Asset</button>
      </div>
    </div>`;

  panel.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.add;
      let block;
      const ph = colEl.querySelector('.col-placeholder');
      if (type === 'asset') {
        const ab = document.createElement('div');
        ab.className = 'asset-block';
        ab.style.height = '460px';
        ab.innerHTML = `${window.ASSET_SVG || ''}<span class="asset-label">에셋을 업로드하거나 드래그하세요</span>`;
        block = ab;
      } else {
        const { block: tb } = window.makeTextBlock(type);
        block = tb;
      }
      if (ph) colEl.replaceChild(block, ph);
      else colEl.appendChild(block);
      window.bindBlock(block);
      window.buildLayerPanel();
      if (window.showColProperties) window.showColProperties(colEl);
    });
  });
}

window.showColProperties = showColProperties;

/* ═══════════════════════════════════
   ROW PROPERTIES PANEL
═══════════════════════════════════ */

function showRowProperties(rowEl) {
  const layout = rowEl.dataset.layout || 'stack';
  const cols = [...rowEl.querySelectorAll(':scope > .col')];
  const currentGap = parseInt(rowEl.dataset.gap) != null && rowEl.dataset.gap !== ''
    ? parseInt(rowEl.dataset.gap)
    : (layout !== 'stack' ? 8 : 0);

  /* 컬럼 비율 HTML (flex 전용) */
  let colRatioHTML = '';
  if (layout === 'flex') {
    cols.forEach((col, i) => {
      const flexVal = parseInt(col.dataset.flex) || 1;
      colRatioHTML += `
        <div class="prop-row">
          <span class="prop-label">Col ${i + 1}</span>
          <input type="range" class="prop-slider" id="row-col-slider-${i}" min="1" max="10" step="1" value="${flexVal}">
          <input type="number" class="prop-number" id="row-col-number-${i}" min="1" max="10" value="${flexVal}">
        </div>`;
    });
  } else if (layout === 'grid') {
    colRatioHTML = `
      <div class="prop-row">
        <span class="prop-label">열 수</span>
        <button class="prop-count-btn" id="row-grid-col-minus">−</button>
        <span class="prop-count-val" id="row-grid-col-count">${cols.length}</span>
        <button class="prop-count-btn" id="row-grid-col-plus">+</button>
      </div>`;
  }

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="4" height="10" rx="0.5"/><rect x="7" y="1" width="4" height="10" rx="0.5"/>
          </svg>
        </div>
        <span class="prop-block-name">Row</span>
      </div>
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <div class="prop-align-group" id="row-layout-group">
          <button class="prop-align-btn${layout === 'stack' ? ' active' : ''}" data-layout="stack">Stack</button>
          <button class="prop-align-btn${layout === 'flex'  ? ' active' : ''}" data-layout="flex">Flex</button>
          <button class="prop-align-btn${layout === 'grid'  ? ' active' : ''}" data-layout="grid">Grid</button>
        </div>
      </div>
    </div>
    ${layout !== 'stack' ? `
    <div class="prop-section">
      <div class="prop-section-title">${layout === 'flex' ? '컬럼 비율' : '컬럼 수'}</div>
      ${colRatioHTML}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">간격</div>
      <div class="prop-row">
        <span class="prop-label">gap</span>
        <input type="range" class="prop-slider" id="row-gap-slider" min="0" max="80" step="4" value="${currentGap}">
        <input type="number" class="prop-number" id="row-gap-number" min="0" max="80" value="${currentGap}">
      </div>
    </div>
    ${layout === 'flex' ? `
    <div class="prop-section">
      <div class="prop-section-title">컬럼 추가 / 삭제</div>
      <div class="prop-row">
        <button class="prop-count-btn" id="row-col-add" style="width:auto;padding:0 10px;font-size:13px;">+ 추가</button>
        <button class="prop-count-btn" id="row-col-remove" style="width:auto;padding:0 10px;font-size:13px;">− 삭제</button>
      </div>
    </div>
    ` : ''}
    ` : ''}`;

  /* ── 레이아웃 토글 ── */
  document.querySelectorAll('#row-layout-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyRowLayoutDirect(rowEl, btn.dataset.layout);
      showRowProperties(rowEl);
      buildLayerPanel();
      pushHistory();
    });
  });

  if (layout === 'stack') return;

  /* ── Gap ── */
  const applyGap = v => {
    v = Math.min(80, Math.max(0, v));
    rowEl.style.gap = v + 'px';
    rowEl.dataset.gap = v;
    const s = document.getElementById('row-gap-slider');
    const n = document.getElementById('row-gap-number');
    if (s) s.value = v;
    if (n) n.value = v;
  };
  document.getElementById('row-gap-slider').addEventListener('input',  e => applyGap(parseInt(e.target.value)));
  document.getElementById('row-gap-number').addEventListener('change', e => { applyGap(parseInt(e.target.value)); pushHistory(); });
  document.getElementById('row-gap-slider').addEventListener('change', () => pushHistory());

  /* ── Flex: 컬럼 비율 슬라이더 ── */
  if (layout === 'flex') {
    cols.forEach((col, i) => {
      const applyFlex = v => {
        v = Math.min(10, Math.max(1, v));
        col.style.flex = v;
        col.dataset.flex = v;
        const s = document.getElementById(`row-col-slider-${i}`);
        const n = document.getElementById(`row-col-number-${i}`);
        if (s) s.value = v;
        if (n) n.value = v;
      };
      document.getElementById(`row-col-slider-${i}`).addEventListener('input',  e => applyFlex(parseInt(e.target.value)));
      document.getElementById(`row-col-number-${i}`).addEventListener('change', e => { applyFlex(parseInt(e.target.value)); pushHistory(); });
      document.getElementById(`row-col-slider-${i}`).addEventListener('change', () => pushHistory());
    });

    /* 컬럼 추가 */
    document.getElementById('row-col-add').addEventListener('click', () => {
      rowEl.appendChild(makeEmptyCol('1'));
      const newCount = rowEl.querySelectorAll(':scope > .col').length;
      rowEl.dataset.ratioStr = `${newCount}*1`;
      buildLayerPanel();
      showRowProperties(rowEl);
      pushHistory();
    });

    /* 컬럼 삭제 */
    document.getElementById('row-col-remove').addEventListener('click', () => {
      const curCols = [...rowEl.querySelectorAll(':scope > .col')];
      if (curCols.length > 1) {
        curCols[curCols.length - 1].remove();
        const newCount = curCols.length - 1;
        rowEl.dataset.ratioStr = `${newCount}*1`;
        buildLayerPanel();
        showRowProperties(rowEl);
        pushHistory();
      }
    });
  }

  /* ── Grid: 열 수 +/- ── */
  if (layout === 'grid') {
    document.getElementById('row-grid-col-minus').addEventListener('click', () => {
      const curCols = [...rowEl.querySelectorAll(':scope > .col')];
      if (curCols.length > 1) {
        curCols[curCols.length - 1].remove();
        const newCount = curCols.length - 1;
        rowEl.style.gridTemplateColumns = `repeat(${newCount}, 1fr)`;
        rowEl.dataset.ratioStr = `${newCount}*1`;
        document.getElementById('row-grid-col-count').textContent = newCount;
        buildLayerPanel();
        pushHistory();
      }
    });
    document.getElementById('row-grid-col-plus').addEventListener('click', () => {
      rowEl.appendChild(makeEmptyCol(null));
      const newCount = rowEl.querySelectorAll(':scope > .col').length;
      rowEl.style.gridTemplateColumns = `repeat(${newCount}, 1fr)`;
      rowEl.dataset.ratioStr = `${newCount}*1`;
      document.getElementById('row-grid-col-count').textContent = newCount;
      buildLayerPanel();
      pushHistory();
    });
  }
}

/* Row 레이아웃 직접 전환 (rowEl 기준) */
function applyRowLayoutDirect(rowEl, newLayout) {
  const existingCols = [...rowEl.querySelectorAll(':scope > .col')];

  if (newLayout === 'stack') {
    rowEl.dataset.layout = 'stack';
    rowEl.dataset.ratioStr = '1*1';
    rowEl.style.display = '';
    rowEl.style.gridTemplateColumns = '';
    existingCols.slice(1).forEach(col => col.remove());
    if (existingCols[0]) {
      existingCols[0].style.flex = '';
      delete existingCols[0].dataset.flex;
    }

  } else if (newLayout === 'flex') {
    rowEl.dataset.layout = 'flex';
    rowEl.style.display = '';
    rowEl.style.gridTemplateColumns = '';
    // 최소 2컬럼
    if (existingCols.length < 2) rowEl.appendChild(makeEmptyCol('1'));
    [...rowEl.querySelectorAll(':scope > .col')].forEach(col => {
      const v = col.dataset.flex || '1';
      col.style.flex = v;
      col.dataset.flex = v;
    });
    const count = rowEl.querySelectorAll(':scope > .col').length;
    rowEl.dataset.ratioStr = `${count}*1`;

  } else if (newLayout === 'grid') {
    rowEl.dataset.layout = 'grid';
    rowEl.style.display = 'grid';
    // 최소 2컬럼
    if (existingCols.length < 2) rowEl.appendChild(makeEmptyCol(null));
    [...rowEl.querySelectorAll(':scope > .col')].forEach(col => { col.style.flex = ''; });
    const count = rowEl.querySelectorAll(':scope > .col').length;
    rowEl.style.gridTemplateColumns = `repeat(${count}, 1fr)`;
    rowEl.dataset.ratioStr = `${count}*1`;
  }
}

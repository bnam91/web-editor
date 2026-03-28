/* ═══════════════════════════════════
   ROW PROPERTIES PANEL
═══════════════════════════════════ */

const propPanel = document.querySelector('#panel-right .panel-body');

function showRowProperties(rowEl) {
  const layout = rowEl.dataset.layout || 'stack';
  const cols = [...rowEl.querySelectorAll(':scope > .col')];
  const currentGap = rowEl.hasAttribute('data-gap')
    ? (parseInt(rowEl.dataset.gap) || 0)
    : 0;
  const padX = parseInt(rowEl.dataset.padX) || 0;
  if (!rowEl.id) rowEl.id = 'row_' + Math.random().toString(36).slice(2, 9);
  let rowHeight = parseInt(rowEl.dataset.rowHeight) || 0;
  /* data-row-height 없으면 실제 렌더링 높이 사용 */
  if (!rowHeight) rowHeight = rowEl.offsetHeight || 0;

  /* grid row count & 최소 높이: 행당 80px + 행 사이 gap */
  let gridRowCount = 1;
  if (layout === 'grid') {
    const gtc = rowEl.style.gridTemplateColumns || '';
    let gridColCount = 1;
    if (gtc.startsWith('repeat(')) gridColCount = parseInt(gtc.match(/repeat\((\d+)/)?.[1]) || 1;
    else if (gtc) gridColCount = gtc.trim().split(/\s+/).filter(Boolean).length;
    gridRowCount = Math.ceil(cols.length / gridColCount);
  }
  const minRowHeight = layout === 'grid'
    ? gridRowCount * 80 + (gridRowCount - 1) * currentGap
    : 0;

  /* 자식 블록 일괄 조절용 데이터 */
  const childBlocks = [...rowEl.querySelectorAll(':scope > .col > *')].filter(el =>
    el.classList.contains('text-block') || el.classList.contains('asset-block') ||
    el.classList.contains('card-block') || el.classList.contains('strip-banner-block') ||
    el.classList.contains('icon-circle-block') || el.classList.contains('table-block') ||
    el.classList.contains('graph-block') || el.classList.contains('divider-block')
  );
  const hasChildren = childBlocks.length > 0;
  const allCards = hasChildren && childBlocks.every(b => b.classList.contains('card-block'));

  /* 자식 블록들의 현재 높이 (min-height) — 공통값 or '' */
  let childHeightVal = '';
  if (hasChildren) {
    const heights = childBlocks.map(b => parseInt(b.style.minHeight) || 0);
    childHeightVal = heights.every(h => h === heights[0]) ? heights[0] : '';
  }

  /* 자식 블록들의 현재 radius (card 전용) */
  let childRadiusVal = '';
  if (allCards) {
    const radii = childBlocks.map(b => b.dataset.radius !== undefined ? parseInt(b.dataset.radius) : 12);
    childRadiusVal = radii.every(r => r === radii[0]) ? radii[0] : '';
  }

  const childBatchHTML = hasChildren ? `
    <div class="prop-section">
      <div class="prop-section-title">하위 블록 일괄</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="row-child-h-slider" min="0" max="600" step="4" value="${childHeightVal || 0}">
        <input type="number" class="prop-number" id="row-child-h-number" min="0" max="600" value="${childHeightVal}" placeholder="auto">
      </div>
      ${allCards ? `
      <div class="prop-row">
        <span class="prop-label">radius</span>
        <input type="range" class="prop-slider" id="row-child-r-slider" min="0" max="40" step="2" value="${childRadiusVal || 0}">
        <input type="number" class="prop-number" id="row-child-r-number" min="0" max="40" value="${childRadiusVal}">
      </div>` : ''}
    </div>` : '';


  /* 컬럼 비율 HTML */
  let colRatioHTML = '';
  if (layout === 'flex') {
    const ratioVal = cols.map(c => parseInt(c.dataset.flex) || 1).join(':');
    colRatioHTML = `
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-text-input" id="row-col-ratio" value="${ratioVal}" placeholder="1:1" style="flex:1;background:#1a1a1a;border:1px solid #333;border-radius:4px;color:#ccc;font-size:12px;padding:3px 8px;min-width:0;">
      </div>`;
  } else if (layout === 'grid') {
    const gtc = rowEl.style.gridTemplateColumns || '';
    let ratioVal;
    if (gtc.startsWith('repeat(')) {
      const count = parseInt(gtc.match(/repeat\((\d+)/)?.[1]) || cols.length;
      ratioVal = Array(count).fill('1').join(':');
    } else if (gtc) {
      ratioVal = gtc.split(/\s+/).map(v => v.replace('fr', '') || '1').join(':');
    } else {
      ratioVal = Array(cols.length).fill('1').join(':');
    }
    colRatioHTML = `
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-text-input" id="row-col-ratio" value="${ratioVal}" placeholder="1:1" style="flex:1;background:#1a1a1a;border:1px solid #333;border-radius:4px;color:#ccc;font-size:12px;padding:3px 8px;min-width:0;">
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
        <div class="prop-block-info">
          <span class="prop-block-name">Grid</span>
        </div>
        ${rowEl.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${rowEl.id}')">${rowEl.id}</span>` : ''}
      </div>
    </div>
    ${childBatchHTML}
    ${layout !== 'stack' ? `
    <div class="prop-section">
      <div class="prop-section-title">컬럼 비율</div>
      ${colRatioHTML}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">그리드 크기</div>
      <div class="grid-picker" id="row-grid-picker"></div>
      <div class="grid-picker-label" id="row-grid-picker-label">—</div>
    </div>` : ''}
    <div class="prop-section">
      <div class="prop-section-title">크기 / 간격</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="row-height-slider" min="${minRowHeight}" max="1200" step="8" value="${rowHeight}">
        <input type="number" class="prop-number" id="row-height-number" min="${minRowHeight}" max="1200" value="${rowHeight || ''}" placeholder="auto">
      </div>
      ${layout !== 'stack' ? `
      <div class="prop-row">
        <span class="prop-label">gap</span>
        <input type="range" class="prop-slider" id="row-gap-slider" min="0" max="80" step="4" value="${currentGap}">
        <input type="number" class="prop-number" id="row-gap-number" min="0" max="80" value="${currentGap}">
      </div>` : ''}
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="row-padx-slider" min="0" max="80" step="4" value="${padX}">
        <input type="number" class="prop-number" id="row-padx-number" min="0" max="80" value="${padX}">
      </div>
    </div>
    `;

  if (window.setRpIdBadge) window.setRpIdBadge(rowEl.id);

  /* ── 높이 ── */
  const applyRowHeight = v => {
    if (isNaN(v) || v < minRowHeight) v = minRowHeight;
    v = Math.min(1200, v);
    if (layout === 'grid') {
      const gtc = rowEl.style.gridTemplateColumns || '';
      let gridColCount = 1;
      if (gtc.startsWith('repeat(')) gridColCount = parseInt(gtc.match(/repeat\((\d+)/)?.[1]) || 1;
      else if (gtc) gridColCount = gtc.split(/\s+/).filter(Boolean).length;
      const gridRowCount = Math.ceil(cols.length / gridColCount);
      const gap = parseInt(rowEl.dataset.gap) || 0;
      if (v) {
        const perRow = Math.max(1, Math.round((v - (gridRowCount - 1) * gap) / gridRowCount));
        rowEl.style.gridTemplateRows = `repeat(${gridRowCount}, ${perRow}px)`;
      } else {
        rowEl.style.gridTemplateRows = '';
      }
    } else {
      rowEl.style.minHeight = v ? v + 'px' : '';
    }
    rowEl.dataset.rowHeight = v || '';
    const s = document.getElementById('row-height-slider');
    const n = document.getElementById('row-height-number');
    if (s) s.value = v;
    if (n) n.value = v || '';
  };
  document.getElementById('row-height-slider')?.addEventListener('input',  e => applyRowHeight(parseInt(e.target.value)));
  document.getElementById('row-height-number')?.addEventListener('change', e => { applyRowHeight(parseInt(e.target.value)); window.pushHistory(); });
  document.getElementById('row-height-slider')?.addEventListener('change', () => window.pushHistory());

  /* ── 좌우 패딩 ── */
  const applyPadX = v => {
    if (isNaN(v) || v < 0) v = 0;
    v = Math.min(80, v);
    rowEl.style.paddingLeft  = v + 'px';
    rowEl.style.paddingRight = v + 'px';
    rowEl.dataset.padX = v;
    const s = document.getElementById('row-padx-slider');
    const n = document.getElementById('row-padx-number');
    if (s) s.value = v;
    if (n) n.value = v;
  };
  document.getElementById('row-padx-slider')?.addEventListener('input',  e => applyPadX(parseInt(e.target.value)));
  document.getElementById('row-padx-number')?.addEventListener('change', e => { applyPadX(parseInt(e.target.value)); window.pushHistory(); });
  document.getElementById('row-padx-slider')?.addEventListener('change', () => window.pushHistory());

  /* ── 자식 블록 일괄: 높이 ── */
  if (hasChildren) {
    const applyChildHeight = v => {
      if (isNaN(v) || v < 0) v = 0;
      childBlocks.forEach(b => { b.style.minHeight = v ? v + 'px' : ''; });
      const s = document.getElementById('row-child-h-slider');
      const n = document.getElementById('row-child-h-number');
      if (s) s.value = v;
      if (n) n.value = v || '';
    };
    document.getElementById('row-child-h-slider').addEventListener('input',  e => applyChildHeight(parseInt(e.target.value)));
    document.getElementById('row-child-h-number').addEventListener('change', e => { applyChildHeight(parseInt(e.target.value)); window.pushHistory(); });
    document.getElementById('row-child-h-slider').addEventListener('change', () => window.pushHistory());

    /* ── 자식 블록 일괄: radius (card 전용) ── */
    if (allCards) {
      const applyChildRadius = v => {
        if (isNaN(v) || v < 0) v = 0;
        childBlocks.forEach(b => {
          b.dataset.radius = v;
          b.style.borderRadius = v + 'px';
        });
        const s = document.getElementById('row-child-r-slider');
        const n = document.getElementById('row-child-r-number');
        if (s) s.value = v;
        if (n) n.value = v;
      };
      document.getElementById('row-child-r-slider').addEventListener('input',  e => applyChildRadius(parseInt(e.target.value)));
      document.getElementById('row-child-r-number').addEventListener('change', e => { applyChildRadius(parseInt(e.target.value)); window.pushHistory(); });
      document.getElementById('row-child-r-slider').addEventListener('change', () => window.pushHistory());
    }
  }

  if (layout === 'stack') return;

  /* ── Gap ── */
  const applyGap = v => {
    if (isNaN(v)) v = 0;
    v = Math.min(80, Math.max(0, v));
    rowEl.style.gap = v + 'px';
    rowEl.dataset.gap = v;
    const s = document.getElementById('row-gap-slider');
    const n = document.getElementById('row-gap-number');
    if (s) s.value = v;
    if (n) n.value = v;
  };
  document.getElementById('row-gap-slider').addEventListener('input',  e => applyGap(parseInt(e.target.value)));
  document.getElementById('row-gap-number').addEventListener('change', e => { applyGap(parseInt(e.target.value)); window.pushHistory(); });
  document.getElementById('row-gap-slider').addEventListener('change', () => window.pushHistory());

  /* ── Flex / Grid: 컬럼 비율 입력 (2:8 형식) ── */
  if (layout === 'flex' || layout === 'grid') {
    const ratioInput = document.getElementById('row-col-ratio');
    const applyRatio = () => {
      const parts = ratioInput.value.split(':').map(s => parseInt(s.trim())).filter(n => n > 0 && !isNaN(n));
      if (layout === 'flex') {
        if (parts.length !== cols.length) return;
        cols.forEach((col, i) => {
          col.style.flex = parts[i];
          col.dataset.flex = parts[i];
        });
      } else {
        // grid: gridTemplateColumns의 열 수로 검증 (col 엘리먼트 수 ≠ 그리드 열 수)
        const gtc = rowEl.style.gridTemplateColumns || '';
        let gridColCount;
        if (gtc.startsWith('repeat(')) {
          gridColCount = parseInt(gtc.match(/repeat\((\d+)/)?.[1]) || cols.length;
        } else if (gtc) {
          gridColCount = gtc.split(/\s+/).filter(Boolean).length;
        } else {
          gridColCount = cols.length;
        }
        if (parts.length !== gridColCount) return;
        rowEl.style.gridTemplateColumns = parts.map(p => p + 'fr').join(' ');
      }
      window.pushHistory();
    };
    ratioInput.addEventListener('keydown', e => { if (e.key === 'Enter') { applyRatio(); e.target.blur(); } });
    ratioInput.addEventListener('blur', applyRatio);
  }

  /* ── Grid 크기 피커 ── */
  if (layout !== 'stack') {
    const picker = document.getElementById('row-grid-picker');
    const pickerLabel = document.getElementById('row-grid-picker-label');
    const MAX = 4;

    for (let r = 1; r <= MAX; r++) {
      for (let c = 1; c <= MAX; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-picker-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        picker.appendChild(cell);
      }
    }

    const highlight = (maxR, maxC) => {
      picker.querySelectorAll('.grid-picker-cell').forEach(cl => {
        cl.classList.toggle('active', parseInt(cl.dataset.r) <= maxR && parseInt(cl.dataset.c) <= maxC);
      });
    };

    picker.addEventListener('mouseover', e => {
      const cell = e.target.closest('.grid-picker-cell');
      if (!cell) return;
      const r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
      highlight(r, c);
      pickerLabel.textContent = `${c} × ${r}`;
    });
    picker.addEventListener('mouseleave', () => {
      picker.querySelectorAll('.grid-picker-cell').forEach(cl => cl.classList.remove('active'));
      pickerLabel.textContent = '—';
    });

    picker.addEventListener('click', e => {
      const cell = e.target.closest('.grid-picker-cell');
      if (!cell) return;
      const targetCols = parseInt(cell.dataset.c);
      const targetRows = parseInt(cell.dataset.r);
      const totalNeeded = targetCols * targetRows;
      const curCols = [...rowEl.querySelectorAll(':scope > .col')];
      if (curCols.length < totalNeeded) {
        for (let i = curCols.length; i < totalNeeded; i++) {
          const col = document.createElement('div');
          col.className = 'col';
          col.appendChild(window.makeColPlaceholder(col));
          rowEl.appendChild(col);
        }
      } else {
        for (let i = curCols.length - 1; i >= totalNeeded; i--) curCols[i].remove();
      }
      /* layout/display 동기화 */
      if (targetRows > 1) {
        rowEl.dataset.layout = 'grid';
        rowEl.style.display = 'grid';
      } else {
        rowEl.dataset.layout = 'flex';
        rowEl.style.display = '';
        rowEl.style.gridTemplateRows = '';
      }
      rowEl.style.gridTemplateColumns = `repeat(${targetCols}, 1fr)`;
      /* flex 단일행은 col flex 값 초기화 */
      if (targetRows === 1) {
        [...rowEl.querySelectorAll(':scope > .col')].forEach(c => { c.style.flex = '1'; c.dataset.flex = '1'; });
      }
      /* 2행 이하 그리드: 실제 너비로 정사각형 초기 높이 픽셀 적용 */
      if (targetRows >= 2 && targetRows <= 2 && rowEl.offsetWidth > 0) {
        const gap = parseInt(rowEl.dataset.gap) || 0;
        const colPx = Math.round((rowEl.offsetWidth - (targetCols - 1) * gap) / targetCols);
        if (colPx > 0) {
          rowEl.style.gridTemplateRows = `repeat(${targetRows}, ${colPx}px)`;
          rowEl.dataset.rowHeight = String(colPx * targetRows + (targetRows - 1) * gap);
        }
      }
      rowEl.dataset.ratioStr = `${targetCols}*${targetRows}`;

      /* 높이 반응형 조정 — dataset.rowHeight 명시값이 있을 때만 재계산 */
      const gap = parseInt(rowEl.dataset.gap) || 0;
      const newMin = targetRows * 80 + (targetRows - 1) * gap;
      const curH = parseInt(rowEl.dataset.rowHeight) || 0;
      if (curH) {
        const prevGridRowCount = gridRowCount; // outer scope의 현재(이전) 행 수
        const perRow = Math.max(80, Math.round((curH - (prevGridRowCount - 1) * gap) / prevGridRowCount));
        const newH = Math.max(newMin, perRow * targetRows + (targetRows - 1) * gap);
        const perRowNew = Math.round((newH - (targetRows - 1) * gap) / targetRows);
        rowEl.style.gridTemplateRows = `repeat(${targetRows}, ${perRowNew}px)`;
        rowEl.dataset.rowHeight = newH;
      }

      buildLayerPanel();
      showRowProperties(rowEl);
      window.pushHistory();
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

window.showRowProperties   = showRowProperties;
window.applyRowLayoutDirect = applyRowLayoutDirect;

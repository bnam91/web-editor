/* ═══════════════════════════════════
   ROW PROPERTIES PANEL
═══════════════════════════════════ */

import { propPanel } from './globals.js';

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
        ${rowEl.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${rowEl.id}')">${rowEl.id}</span>` : ''}
      </div>
    </div>
    ${layout !== 'stack' ? `
    <div class="prop-section">
      <div class="prop-section-title">컬럼 비율</div>
      ${colRatioHTML}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">레이아웃 프리셋</div>
      <div class="layout-preset-btns" id="row-layout-presets"></div>
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
    ${childBatchHTML}
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
        // ratioStr 동기화 — 레이어 패널 표시 갱신
        rowEl.dataset.ratioStr = parts.join('*');
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
        // ratioStr 동기화 — 레이어 패널 표시 갱신
        rowEl.dataset.ratioStr = parts.join('*');
      }
      window.pushHistory();
    };
    ratioInput.addEventListener('keydown', e => { if (e.key === 'Enter') { applyRatio(); e.target.blur(); } });
    ratioInput.addEventListener('blur', applyRatio);
  }

  /* ── Grid 크기 피커 ── */
  if (layout !== 'stack') {
    _bindLayoutPresets(rowEl);
  }
}

/* 레이아웃 프리셋 버튼 — col 개념 제거로 삭제됨, NewGrid 사용 */
function _bindLayoutPresets(rowEl) {}

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
    const flexCols = [...rowEl.querySelectorAll(':scope > .col')];
    // stack→flex 전환 시 col이 1개인 경우 두 번째 col을 추가해 2열 보장
    if (flexCols.length === 1) {
      const newCol = document.createElement('div');
      newCol.className = 'col';
      newCol.id = window.genId ? window.genId('col') : 'col_' + Math.random().toString(36).slice(2, 9);
      newCol.dataset.flex = '1';
      newCol.style.flex = '1';
      rowEl.appendChild(newCol);
      // 기존 col도 균등 비율로 맞춤
      flexCols[0].dataset.flex = '1';
      flexCols[0].style.flex = '1';
    }
    const updatedCols = [...rowEl.querySelectorAll(':scope > .col')];
    updatedCols.forEach(col => {
      const v = col.dataset.flex || '1';
      col.style.flex = v;
      col.dataset.flex = v;
    });
    // 기존 flex 비율 보존 — 균등값(1)이 아닌 경우 ratioStr 재계산
    const flexParts = updatedCols.map(c => parseInt(c.dataset.flex) || 1);
    rowEl.dataset.ratioStr = flexParts.join('*');
    window.pushHistory?.();
    window.scheduleAutoSave?.();

  } else if (newLayout === 'grid') {
    rowEl.dataset.layout = 'grid';
    rowEl.style.display = 'grid';
    [...rowEl.querySelectorAll(':scope > .col')].forEach(col => { col.style.flex = ''; });
    const count = rowEl.querySelectorAll(':scope > .col').length;
    rowEl.style.gridTemplateColumns = `repeat(${count}, 1fr)`;
    rowEl.dataset.ratioStr = `${count}*1`;
  }
}

window.showRowProperties   = showRowProperties;
window.applyRowLayoutDirect = applyRowLayoutDirect;

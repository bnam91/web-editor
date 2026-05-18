import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

const FONT_WEIGHTS = [
  { v: 300, label: 'Light' },
  { v: 400, label: 'Regular' },
  { v: 500, label: 'Medium' },
  { v: 600, label: 'Semibold' },
  { v: 700, label: 'Bold' },
  { v: 800, label: 'Extrabold' },
  { v: 900, label: 'Black' },
];

function _readCells(block) {
  if (typeof window._readLaurelCells === 'function') return window._readLaurelCells(block);
  try { return JSON.parse(block.dataset.cells || '[]'); } catch (_) { return []; }
}

function _writeCells(block, cells) {
  block.dataset.cells = JSON.stringify(cells);
  // 한 번 cells 모델로 가면 legacy 단일 필드는 제거
  delete block.dataset.text;
  delete block.dataset.fontSize;
  delete block.dataset.fontWeight;
  delete block.dataset.lines;
  delete block.dataset.leafColor;
  delete block.dataset.gap;
  delete block.dataset.height;
  delete block.dataset.color;
}

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 셀 내부 lines/gap/height/leafColor UI 렌더 ──────────────────────────────
function _cellInnerHtml(cell, cellIdx) {
  const linesArr = Array.isArray(cell.lines) && cell.lines.length > 0
    ? cell.lines
    : [{ text: '1위', fontSize: 56, fontWeight: 700, color: '#1a1a1a' }];
  const leafColor = cell.leafColor || '#1a1a1a';
  const leafAlpha = parseAlphaFromColor(leafColor);
  const gap       = parseInt(cell.gap)    || 24;
  const height    = parseInt(cell.height) || 140;

  const linesHtml = linesArr.map((ln, i) => {
    const lineColor = ln.color || '#1a1a1a';
    const lineAlpha = parseAlphaFromColor(lineColor);
    return `
      <div class="prop-line-card" data-cell="${cellIdx}" data-line="${i}">
        <div class="prop-row prop-line-card-header">
          <button class="prop-icon-btn lrl-line-up" data-cell="${cellIdx}" data-line="${i}" title="위로 이동 (맨 위에서 누르면 맨 아래로)">↑</button>
          <input type="text" class="prop-input lrl-line-text" data-cell="${cellIdx}" data-line="${i}" value="${_esc(ln.text)}" placeholder="줄 ${i + 1}">
          <button class="prop-icon-btn lrl-line-toggle" title="스타일 펼치기/접기" aria-expanded="false">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="2,3.5 5,6.5 8,3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          ${linesArr.length > 1 ? `<button class="prop-icon-btn lrl-line-remove" data-cell="${cellIdx}" data-line="${i}" title="줄 삭제">×</button>` : ''}
        </div>
        <div class="prop-line-card-details" hidden>
          <div class="prop-row">
            <span class="prop-label">크기</span>
            <input type="range" class="prop-slider lrl-line-fs" data-cell="${cellIdx}" data-line="${i}" min="8" max="200" step="2" value="${parseInt(ln.fontSize) || 56}">
            <input type="number" class="prop-number lrl-line-fs-num" data-cell="${cellIdx}" data-line="${i}" min="8" max="400" value="${parseInt(ln.fontSize) || 56}">
          </div>
          <div class="prop-row">
            <span class="prop-label">굵기</span>
            <select class="prop-select lrl-line-fw" data-cell="${cellIdx}" data-line="${i}">
              ${FONT_WEIGHTS.map(w => `<option value="${w.v}" ${parseInt(ln.fontWeight) === w.v ? 'selected' : ''}>${w.label}</option>`).join('')}
            </select>
          </div>
          <div class="prop-row">
            <span class="prop-label">자간</span>
            <input type="range" class="prop-slider lrl-line-ls" data-cell="${cellIdx}" data-line="${i}" min="-10" max="30" step="0.5" value="${parseFloat(ln.letterSpacing) || 0}">
            <input type="number" class="prop-number lrl-line-ls-num" data-cell="${cellIdx}" data-line="${i}" min="-20" max="50" step="0.5" value="${parseFloat(ln.letterSpacing) || 0}">
          </div>
          <div class="prop-color-row">
            <span class="prop-label">색</span>
            ${colorFieldHTML({ idPrefix: `lrl-line-color-${cellIdx}-${i}`, hex: lineColor, alpha: lineAlpha })}
          </div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="prop-row">
      <span class="prop-label" style="font-size:10px;color:var(--ui-text-muted);">Lines</span>
    </div>
    <div class="lrl-lines-container" data-cell="${cellIdx}">${linesHtml}</div>
    <div class="prop-row">
      <button class="prop-action-btn primary lrl-line-add" data-cell="${cellIdx}" style="width:100%;">+ 줄 추가</button>
    </div>
    <div class="prop-row">
      <span class="prop-label">잎 간격</span>
      <input type="range" class="prop-slider lrl-cell-gap" data-cell="${cellIdx}" min="0" max="800" step="4" value="${gap}">
      <input type="number" class="prop-number lrl-cell-gap-num" data-cell="${cellIdx}" min="0" max="2000" value="${gap}">
    </div>
    <div class="prop-row">
      <span class="prop-label">잎 크기</span>
      <input type="range" class="prop-slider lrl-cell-height" data-cell="${cellIdx}" min="40" max="320" step="4" value="${height}">
      <input type="number" class="prop-number lrl-cell-height-num" data-cell="${cellIdx}" min="20" max="600" value="${height}">
    </div>
    <div class="prop-row">
      <span class="prop-label">잎 채움</span>
      <select class="prop-select lrl-cell-fill" data-cell="${cellIdx}">
        <option value="solid"          ${(cell.leafFill || 'solid') === 'solid'          ? 'selected' : ''}>Solid (단색)</option>
        <optgroup label="Classic">
          <option value="gold"         ${cell.leafFill === 'gold'         ? 'selected' : ''}>Gold</option>
          <option value="silver"       ${cell.leafFill === 'silver'       ? 'selected' : ''}>Silver</option>
          <option value="bronze"       ${cell.leafFill === 'bronze'       ? 'selected' : ''}>Bronze</option>
          <option value="rosegold"     ${cell.leafFill === 'rosegold'     ? 'selected' : ''}>Rose Gold</option>
          <option value="platinum"     ${cell.leafFill === 'platinum'     ? 'selected' : ''}>Platinum</option>
        </optgroup>
        <optgroup label="Apple Design">
          <option value="appleGold"      ${cell.leafFill === 'appleGold'      ? 'selected' : ''}>Soft Gold</option>
          <option value="appleSilver"    ${cell.leafFill === 'appleSilver'    ? 'selected' : ''}>Cool Silver</option>
          <option value="appleMidnight"  ${cell.leafFill === 'appleMidnight'  ? 'selected' : ''}>Midnight</option>
          <option value="appleStarlight" ${cell.leafFill === 'appleStarlight' ? 'selected' : ''}>Starlight</option>
        </optgroup>
        <optgroup label="Multi-stop (광택·복합)">
          <option value="polishedGold"  ${cell.leafFill === 'polishedGold'  ? 'selected' : ''}>Polished Gold</option>
          <option value="mirrorSilver"  ${cell.leafFill === 'mirrorSilver'  ? 'selected' : ''}>Mirror Silver</option>
          <option value="champagne"     ${cell.leafFill === 'champagne'     ? 'selected' : ''}>Champagne Sparkle</option>
          <option value="emeraldMetal"  ${cell.leafFill === 'emeraldMetal'  ? 'selected' : ''}>Emerald Metal</option>
          <option value="iridescent"    ${cell.leafFill === 'iridescent'    ? 'selected' : ''}>Iridescent (홀로)</option>
        </optgroup>
      </select>
    </div>
    <div class="prop-color-row" data-solid-only style="${(cell.leafFill && cell.leafFill !== 'solid') ? 'opacity:0.4;pointer-events:none;' : ''}">
      <span class="prop-label">잎 색상</span>
      ${colorFieldHTML({ idPrefix: `lrl-cell-leaf-${cellIdx}`, hex: leafColor, alpha: leafAlpha })}
    </div>`;
}

export function showLaurelProperties(block) {
  const cells = _readCells(block);
  const cols  = Math.max(1, parseInt(block.dataset.gridCols) || 1);
  const rows  = Math.max(1, parseInt(block.dataset.gridRows) || 1);

  // ── 셀 expanded 상태 보존 (showLaurelProperties는 다양한 이벤트로 재호출됨) ──
  // block._laurelCellExpanded는 cell idx → bool 맵. 최초 호출 시 cell 0만 true.
  if (!block._laurelCellExpanded || typeof block._laurelCellExpanded !== 'object') {
    block._laurelCellExpanded = { 0: true };
  }
  // 현재 cells 개수 범위 밖 키 청소 (그리드 축소 시)
  Object.keys(block._laurelCellExpanded).forEach(k => {
    if (parseInt(k) >= cells.length) delete block._laurelCellExpanded[k];
  });
  const expandedMap = block._laurelCellExpanded;
  const isExpanded = (i) => !!expandedMap[i];

  const cellsHtml = cells.map((cell, i) => {
    const r = Math.floor(i / cols) + 1;
    const c = (i % cols) + 1;
    const exp = isExpanded(i);
    return `
      <div class="prop-cell-card${exp ? ' expanded' : ''}" data-cell-idx="${i}">
        <div class="prop-cell-card-header">
          <span class="prop-cell-card-title">Cell ${i + 1} <span style="color:var(--ui-text-muted);">(${c},${r})</span></span>
          <button class="prop-icon-btn lrl-cell-toggle" title="펼치기/접기" aria-expanded="${exp ? 'true' : 'false'}">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="2,3.5 5,6.5 8,3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="prop-cell-card-body" ${exp ? '' : 'hidden'}>
          ${_cellInnerHtml(cell, i)}
        </div>
      </div>`;
  }).join('');

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <path d="M3 10c0-3 0-6 3-8M9 10c0-3 0-6-3-8" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Laurel'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(block)}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Grid (${cols}×${rows})</div>
      <div class="grid-picker" id="lrl-grid-picker"></div>
      <div class="grid-picker-label" id="lrl-grid-picker-label">—</div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">All Cells (일괄)</div>
      <div class="prop-row">
        <span class="prop-label">잎 간격</span>
        <input type="range" class="prop-slider" id="lrl-all-gap" min="0" max="800" step="4" value="${cells[0]?.gap ?? 24}">
        <input type="number" class="prop-number" id="lrl-all-gap-num" min="0" max="2000" value="${cells[0]?.gap ?? 24}">
      </div>
      <div class="prop-row">
        <span class="prop-label">잎 크기</span>
        <input type="range" class="prop-slider" id="lrl-all-height" min="40" max="320" step="4" value="${cells[0]?.height ?? 140}">
        <input type="number" class="prop-number" id="lrl-all-height-num" min="20" max="600" value="${cells[0]?.height ?? 140}">
      </div>
      ${cols > 1 ? `
      <div class="prop-row">
        <span class="prop-label">셀 가로 간격</span>
        <input type="range" class="prop-slider" id="lrl-grid-col-gap" min="0" max="200" step="2" value="${parseInt(block.dataset.gridColGap) || 32}">
        <input type="number" class="prop-number" id="lrl-grid-col-gap-num" min="0" max="400" value="${parseInt(block.dataset.gridColGap) || 32}">
      </div>
      ` : ''}
      ${rows > 1 ? `
      <div class="prop-row">
        <span class="prop-label">셀 세로 간격</span>
        <input type="range" class="prop-slider" id="lrl-grid-row-gap" min="0" max="200" step="2" value="${parseInt(block.dataset.gridRowGap) || 24}">
        <input type="number" class="prop-number" id="lrl-grid-row-gap-num" min="0" max="400" value="${parseInt(block.dataset.gridRowGap) || 24}">
      </div>
      ` : ''}
      <div class="prop-row">
        <span class="prop-label">잎 채움</span>
        <select class="prop-select" id="lrl-all-fill">
          <option value="solid"          ${(cells[0]?.leafFill || 'solid') === 'solid' ? 'selected' : ''}>Solid (단색)</option>
          <optgroup label="Classic">
            <option value="gold"         ${cells[0]?.leafFill === 'gold'         ? 'selected' : ''}>Gold</option>
            <option value="silver"       ${cells[0]?.leafFill === 'silver'       ? 'selected' : ''}>Silver</option>
            <option value="bronze"       ${cells[0]?.leafFill === 'bronze'       ? 'selected' : ''}>Bronze</option>
            <option value="rosegold"     ${cells[0]?.leafFill === 'rosegold'     ? 'selected' : ''}>Rose Gold</option>
            <option value="platinum"     ${cells[0]?.leafFill === 'platinum'     ? 'selected' : ''}>Platinum</option>
          </optgroup>
          <optgroup label="Apple Design">
            <option value="appleGold"      ${cells[0]?.leafFill === 'appleGold'      ? 'selected' : ''}>Soft Gold</option>
            <option value="appleSilver"    ${cells[0]?.leafFill === 'appleSilver'    ? 'selected' : ''}>Cool Silver</option>
            <option value="appleMidnight"  ${cells[0]?.leafFill === 'appleMidnight'  ? 'selected' : ''}>Midnight</option>
            <option value="appleStarlight" ${cells[0]?.leafFill === 'appleStarlight' ? 'selected' : ''}>Starlight</option>
          </optgroup>
          <optgroup label="Multi-stop (광택)">
            <option value="polishedGold" ${cells[0]?.leafFill === 'polishedGold' ? 'selected' : ''}>Polished Gold</option>
            <option value="mirrorSilver" ${cells[0]?.leafFill === 'mirrorSilver' ? 'selected' : ''}>Mirror Silver</option>
            <option value="champagne"    ${cells[0]?.leafFill === 'champagne'    ? 'selected' : ''}>Champagne Sparkle</option>
            <option value="emeraldMetal" ${cells[0]?.leafFill === 'emeraldMetal' ? 'selected' : ''}>Emerald Metal</option>
            <option value="iridescent"   ${cells[0]?.leafFill === 'iridescent'   ? 'selected' : ''}>Iridescent (홀로)</option>
          </optgroup>
        </select>
      </div>
      <div class="prop-color-row" data-solid-only style="${(cells[0]?.leafFill && cells[0].leafFill !== 'solid') ? 'opacity:0.4;pointer-events:none;' : ''}">
        <span class="prop-label">잎 색상</span>
        ${colorFieldHTML({ idPrefix: 'lrl-all-leaf', hex: cells[0]?.leafColor || '#1a1a1a', alpha: parseAlphaFromColor(cells[0]?.leafColor || '#1a1a1a') })}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Cells (${cells.length})</div>
      <div id="lrl-cells-container">${cellsHtml}</div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const rerender = () => window.renderLaurelBlock?.(block);

  // ── Grid picker (canvas-block 패턴) ───────────────────────────────
  const picker      = document.getElementById('lrl-grid-picker');
  const pickerLabel = document.getElementById('lrl-grid-picker-label');
  const MAX = 4;
  for (let r = 1; r <= MAX; r++) {
    for (let c = 1; c <= MAX; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-picker-cell';
      cell.dataset.r = r; cell.dataset.c = c;
      if (c <= cols && r <= rows) cell.classList.add('active');
      picker.appendChild(cell);
    }
  }
  picker.addEventListener('mouseover', e => {
    const cell = e.target.closest('.grid-picker-cell');
    if (!cell) return;
    const r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => {
      cl.classList.toggle('active', parseInt(cl.dataset.r) <= r && parseInt(cl.dataset.c) <= c);
    });
    pickerLabel.textContent = `${c} × ${r}`;
  });
  picker.addEventListener('mouseleave', () => {
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => {
      const r = parseInt(cl.dataset.r), c = parseInt(cl.dataset.c);
      cl.classList.toggle('active', c <= cols && r <= rows);
    });
    pickerLabel.textContent = '—';
  });
  picker.addEventListener('click', e => {
    const cell = e.target.closest('.grid-picker-cell');
    if (!cell) return;
    const newCols = parseInt(cell.dataset.c);
    const newRows = parseInt(cell.dataset.r);
    window.pushHistory?.('Laurel 그리드');
    block.dataset.gridCols = String(newCols);
    block.dataset.gridRows = String(newRows);
    rerender();              // cells push/pop은 renderLaurelBlock이 처리
    showLaurelProperties(block);
    window.scheduleAutoSave?.();
  });

  // ── 셀 카드 토글 (버튼 직접 클릭 + 헤더 전체 클릭 둘 다 지원) ──
  const _toggleCellCard = (card) => {
    if (!card) return;
    const body = card.querySelector('.prop-cell-card-body');
    const btn = card.querySelector('.lrl-cell-toggle');
    const expanded = btn?.getAttribute('aria-expanded') === 'true';
    const next = !expanded;
    btn?.setAttribute('aria-expanded', String(next));
    card.classList.toggle('expanded', next);
    if (body) body.hidden = expanded;
    // ── 다음 showLaurelProperties 재호출에도 보존 ──
    const idx = parseInt(card.dataset.cellIdx);
    if (!Number.isNaN(idx) && block._laurelCellExpanded) {
      block._laurelCellExpanded[idx] = next;
    }
  };
  // 버튼 자체 클릭 (명시적)
  propPanel.querySelectorAll('.lrl-cell-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _toggleCellCard(btn.closest('.prop-cell-card'));
    });
  });
  // 헤더 영역 클릭 (편의)
  propPanel.querySelectorAll('.prop-cell-card-header').forEach(header => {
    header.addEventListener('click', (e) => {
      // 헤더 안의 인터랙티브 요소(button/input/select/...) 클릭은 통과 — 자체 핸들러에 위임
      if (e.target.closest('button, input, select, textarea, [contenteditable]')) return;
      _toggleCellCard(header.closest('.prop-cell-card'));
    });
  });

  // ── 줄별 wireup (모든 cell의 모든 line) ─────────────────────────
  propPanel.querySelectorAll('.lrl-line-text').forEach(inp => {
    const ci = parseInt(inp.dataset.cell), li = parseInt(inp.dataset.line);
    inp.addEventListener('input', () => {
      const cur = _readCells(block);
      if (!cur[ci]?.lines?.[li]) return;
      cur[ci].lines[li].text = inp.value;
      _writeCells(block, cur);
      rerender();
    });
    inp.addEventListener('change', () => window.pushHistory?.('줄 텍스트'));
  });

  propPanel.querySelectorAll('.lrl-line-fs').forEach(sl => {
    const ci = parseInt(sl.dataset.cell), li = parseInt(sl.dataset.line);
    const num = propPanel.querySelector(`.lrl-line-fs-num[data-cell="${ci}"][data-line="${li}"]`);
    sl.addEventListener('input', () => {
      const v = parseInt(sl.value);
      if (num) num.value = v;
      const cur = _readCells(block);
      cur[ci].lines[li].fontSize = v;
      _writeCells(block, cur);
      rerender();
    });
    sl.addEventListener('change', () => window.pushHistory?.('줄 크기'));
    if (num) {
      num.addEventListener('input', () => {
        const v = Math.min(400, Math.max(8, parseInt(num.value) || 8));
        sl.value = Math.min(parseInt(sl.max), v);
        const cur = _readCells(block);
        cur[ci].lines[li].fontSize = v;
        _writeCells(block, cur);
        rerender();
      });
      num.addEventListener('change', () => window.pushHistory?.('줄 크기'));
    }
  });

  propPanel.querySelectorAll('.lrl-line-fw').forEach(sel => {
    const ci = parseInt(sel.dataset.cell), li = parseInt(sel.dataset.line);
    sel.addEventListener('change', () => {
      window.pushHistory?.('줄 굵기');
      const cur = _readCells(block);
      cur[ci].lines[li].fontWeight = parseInt(sel.value);
      _writeCells(block, cur);
      rerender();
    });
  });

  // 줄별 자간 (letterSpacing)
  propPanel.querySelectorAll('.lrl-line-ls').forEach(sl => {
    const ci = parseInt(sl.dataset.cell), li = parseInt(sl.dataset.line);
    const num = propPanel.querySelector(`.lrl-line-ls-num[data-cell="${ci}"][data-line="${li}"]`);
    sl.addEventListener('input', () => {
      const v = parseFloat(sl.value);
      if (num) num.value = v;
      const cur = _readCells(block);
      cur[ci].lines[li].letterSpacing = v;
      _writeCells(block, cur);
      rerender();
    });
    sl.addEventListener('change', () => window.pushHistory?.('줄 자간'));
    if (num) {
      num.addEventListener('input', () => {
        const v = Math.min(50, Math.max(-20, parseFloat(num.value) || 0));
        sl.value = Math.min(parseFloat(sl.max), v);
        const cur = _readCells(block);
        cur[ci].lines[li].letterSpacing = v;
        _writeCells(block, cur);
        rerender();
      });
      num.addEventListener('change', () => window.pushHistory?.('줄 자간'));
    }
  });

  // 줄별 색상
  cells.forEach((cell, ci) => {
    (cell.lines || []).forEach((ln, li) => {
      const lineColor = ln.color || '#1a1a1a';
      const lineAlpha = parseAlphaFromColor(lineColor);
      wireColorField(`lrl-line-color-${ci}-${li}`, {
        initialAlpha: lineAlpha,
        onApply: (c) => {
          const cur = _readCells(block);
          if (!cur[ci]?.lines?.[li]) return;
          cur[ci].lines[li].color = c;
          _writeCells(block, cur);
          rerender();
        },
        onCommit: () => window.pushHistory?.('줄 색'),
      });
    });
  });

  // 줄별 토글
  propPanel.querySelectorAll('.lrl-line-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.prop-line-card');
      if (!card) return;
      const details = card.querySelector('.prop-line-card-details');
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      card.classList.toggle('expanded', !expanded);
      if (details) details.hidden = expanded;
    });
  });

  // 줄 삭제
  propPanel.querySelectorAll('.lrl-line-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const ci = parseInt(btn.dataset.cell), li = parseInt(btn.dataset.line);
      const cur = _readCells(block);
      if (!cur[ci]?.lines || cur[ci].lines.length <= 1) return;
      window.pushHistory?.('줄 삭제');
      cur[ci].lines.splice(li, 1);
      _writeCells(block, cur);
      rerender();
      showLaurelProperties(block);
    });
  });

  // 줄 추가
  propPanel.querySelectorAll('.lrl-line-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const ci = parseInt(btn.dataset.cell);
      const cur = _readCells(block);
      if (!cur[ci]) return;
      window.pushHistory?.('줄 추가');
      const lastColor = cur[ci].lines?.[cur[ci].lines.length - 1]?.color || '#1a1a1a';
      cur[ci].lines = cur[ci].lines || [];
      cur[ci].lines.push({ text: '텍스트', fontSize: 28, fontWeight: 500, color: lastColor });
      _writeCells(block, cur);
      rerender();
      showLaurelProperties(block);
    });
  });

  // ── 줄 카드 ↑ 순서 변경 (맨 위에서 누르면 맨 아래로 wrap-around) ──
  propPanel.querySelectorAll('.lrl-line-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ci = parseInt(btn.dataset.cell);
      const li = parseInt(btn.dataset.line);
      const cur = _readCells(block);
      const lines = cur[ci]?.lines;
      if (!Array.isArray(lines) || lines.length < 2) return;
      window.pushHistory?.('줄 순서 변경');
      if (li === 0) {
        // 맨 위 → 맨 아래로 (배열 회전)
        const first = lines.shift();
        lines.push(first);
      } else {
        // 위와 swap
        [lines[li], lines[li - 1]] = [lines[li - 1], lines[li]];
      }
      _writeCells(block, cur);
      rerender();
      showLaurelProperties(block);
    });
  });

  // ── 일괄 (All Cells) gap / height ──
  const bindAllNumPair = (sliderId, numberId, key, min, max) => {
    const s = propPanel.querySelector('#' + sliderId);
    const n = propPanel.querySelector('#' + numberId);
    if (!s) return;
    const apply = v => {
      v = Math.min(max, Math.max(min, v));
      const cur = _readCells(block);
      cur.forEach(c => { c[key] = v; });
      _writeCells(block, cur);
      rerender();
      s.value = Math.min(parseInt(s.max), v);
      if (n) n.value = v;
      // 셀 카드 안의 개별 슬라이더도 동기화
      propPanel.querySelectorAll(`.lrl-cell-${key}`).forEach(el => { el.value = Math.min(parseInt(el.max), v); });
      propPanel.querySelectorAll(`.lrl-cell-${key}-num`).forEach(el => { el.value = v; });
    };
    s.addEventListener('input',  () => apply(parseInt(s.value)));
    s.addEventListener('change', () => window.pushHistory?.('일괄 ' + key));
    if (n) n.addEventListener('change', () => { apply(parseInt(n.value)); window.pushHistory?.('일괄 ' + key); });
  };
  bindAllNumPair('lrl-all-gap',    'lrl-all-gap-num',    'gap',     0, 2000);
  bindAllNumPair('lrl-all-height', 'lrl-all-height-num', 'height', 20, 600);

  // Grid 셀 간격 (col/row) — block.dataset에 저장 (cells 배열과 별개)
  const bindGridGap = (sliderId, numberId, datasetKey, min, max) => {
    const s = propPanel.querySelector('#' + sliderId);
    const n = propPanel.querySelector('#' + numberId);
    if (!s) return;
    const apply = v => {
      v = Math.min(max, Math.max(min, v));
      block.dataset[datasetKey] = String(v);
      rerender();
      s.value = Math.min(parseInt(s.max), v);
      if (n) n.value = v;
    };
    s.addEventListener('input',  () => apply(parseInt(s.value)));
    s.addEventListener('change', () => window.pushHistory?.('셀 간격'));
    if (n) n.addEventListener('change', () => { apply(parseInt(n.value)); window.pushHistory?.('셀 간격'); });
  };
  bindGridGap('lrl-grid-col-gap', 'lrl-grid-col-gap-num', 'gridColGap', 0, 400);
  bindGridGap('lrl-grid-row-gap', 'lrl-grid-row-gap-num', 'gridRowGap', 0, 400);

  // 일괄 잎 채움 (모든 cells.leafFill 동시 변경)
  const allFillSel = propPanel.querySelector('#lrl-all-fill');
  if (allFillSel) {
    allFillSel.addEventListener('change', () => {
      const cur = _readCells(block);
      cur.forEach(c => { c.leafFill = allFillSel.value; });
      _writeCells(block, cur);
      rerender();
      window.pushHistory?.('일괄 잎 채움');
      showLaurelProperties(block); // 셀별 select 동기화 + 색상 picker 활성/비활성
    });
  }

  // 일괄 잎 색상 (모든 cells.leafColor 동시 변경)
  const allLeafSeed = cells[0]?.leafColor || '#1a1a1a';
  wireColorField('lrl-all-leaf', {
    initialAlpha: parseAlphaFromColor(allLeafSeed),
    onApply: (c) => {
      const cur = _readCells(block);
      cur.forEach(cell => { cell.leafColor = c; });
      _writeCells(block, cur);
      rerender();
      // 셀별 colorField input도 동기화
      cur.forEach((_, ci) => {
        const hexInp = document.getElementById(`lrl-cell-leaf-${ci}-hex`);
        const sw     = document.querySelector(`#lrl-cell-leaf-${ci}-swatch`) || document.querySelector(`[data-color-field="lrl-cell-leaf-${ci}"] .prop-color-swatch`);
        if (hexInp) hexInp.value = c.replace(/^#/, '').toUpperCase();
        if (sw) sw.style.background = c;
      });
    },
    onCommit: () => window.pushHistory?.('일괄 잎 색상'),
  });

  // 셀 gap / height
  const bindCellNumPair = (sliderClass, numberClass, key, min, max) => {
    propPanel.querySelectorAll('.' + sliderClass).forEach(sl => {
      const ci = parseInt(sl.dataset.cell);
      const num = propPanel.querySelector(`.${numberClass}[data-cell="${ci}"]`);
      const apply = v => {
        v = Math.min(max, Math.max(min, v));
        const cur = _readCells(block);
        cur[ci][key] = v;
        _writeCells(block, cur);
        rerender();
        sl.value = Math.min(parseInt(sl.max), v);
        if (num) num.value = v;
      };
      sl.addEventListener('input',  () => apply(parseInt(sl.value)));
      sl.addEventListener('change', () => window.pushHistory?.());
      if (num) {
        num.addEventListener('change', () => { apply(parseInt(num.value)); window.pushHistory?.(); });
      }
    });
  };
  bindCellNumPair('lrl-cell-gap',    'lrl-cell-gap-num',    'gap',     0, 2000);
  bindCellNumPair('lrl-cell-height', 'lrl-cell-height-num', 'height', 20, 600);

  // 셀별 leafFill (Solid / Gold / Silver / ...)
  propPanel.querySelectorAll('.lrl-cell-fill').forEach(sel => {
    const ci = parseInt(sel.dataset.cell);
    sel.addEventListener('change', () => {
      window.pushHistory?.('월계수 채움');
      const cur = _readCells(block);
      if (!cur[ci]) return;
      cur[ci].leafFill = sel.value;
      _writeCells(block, cur);
      rerender();
      showLaurelProperties(block); // 색상 picker 활성/비활성 갱신
    });
  });

  // 셀별 leaf color
  cells.forEach((cell, ci) => {
    const lc = cell.leafColor || '#1a1a1a';
    const la = parseAlphaFromColor(lc);
    wireColorField(`lrl-cell-leaf-${ci}`, {
      initialAlpha: la,
      onApply: (c) => {
        const cur = _readCells(block);
        if (!cur[ci]) return;
        cur[ci].leafColor = c;
        _writeCells(block, cur);
        rerender();
      },
      onCommit: () => window.pushHistory?.('월계수 색'),
    });
  });
}

window.showLaurelProperties = showLaurelProperties;

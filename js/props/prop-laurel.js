import { propPanel } from '../globals.js';
import { blockHeaderHTML } from './_helpers.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

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

// ── 셀 내부 lines/gap/height/leafColor UI 렌더 ──────────────────────────────
function _cellInnerHtml(cell, cellIdx) {
  const leafColor = cell.leafColor || '#1a1a1a';
  const leafAlpha = parseAlphaFromColor(leafColor);
  const gap       = parseInt(cell.gap)    || 24;
  const height    = parseInt(cell.height) || 140;

  /* ★1013t1B2 C2 — 칸 카드의 Lines 묶음(줄 카드·↑·×·「+ 줄 추가」)을 걷었다. 줄은 캔버스에서 칸/줄을 고르면 헤더 아래에 뜨는
     공용 줄 절(line-host lnAugmentLaurelPanel — 그리드·버블·챗·비교와 같은 함수·같은 id)로 더하고 고친다. 잎 설정은 여기 남는다(결정 B2-7). */
  return `
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
  /* ★1013t1B2 — 캔버스에서 칸/줄을 고르면 그 칸 카드를 펼친다(결정 B2-7). */
  const _act = window.grdGetActiveLine?.(block);
  if (_act && Number.isInteger(_act.r) && _act.r >= 0 && _act.r < cells.length) block._laurelCellExpanded[_act.r] = true;
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

  /* ★t5-10 「패딩 제외」 — 배너2 패널(js/props/prop-banner02.js _bn2CanFullBleed)과 같은 판정(뚫을 수 없는 자리면 안 보인다 · 켜져 있으면 보인다). */
  const _lrlCanFB = block.dataset.fullBleed === 'true' || (window.effectiveSectionPadX?.(block) || 0) > 0;
  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <path d="M3 10c0-3 0-6 3-8M9 10c0-3 0-6-3-8" stroke-linecap="round"/>
          </svg>`,
      name: block.dataset.layerName,
      defaultName: 'Laurel',
      crumb: window.getBlockBreadcrumb(block),
      id: block.id,
    })}
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Grid (${cols}×${rows})</div>
      <div class="grid-picker" id="lrl-grid-picker"></div>
      <div class="grid-picker-label" id="lrl-grid-picker-label">—</div>
      ${_lrlCanFB ? `
      <div class="prop-row">
        <span class="prop-label">패딩 제외</span>
        <label class="prop-toggle">
          <input type="checkbox" id="lrl-fullbleed-toggle" ${block.dataset.fullBleed === 'true' ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>` : ''}
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
  /* ★t5-10 패딩 제외 — 켜기는 renderLaurelBlock 의 applyBlockFullBleed 가 매 렌더 씌운다 · 끄기는 흔적 지우기 먼저(배너2·프레임 규약).
     이력 = 이 패널의 «쓰기 뒤» push(아래 Laurel 그리드와 같은 순서). */
  document.getElementById('lrl-fullbleed-toggle')?.addEventListener('change', (e) => {
    if (e.target.checked) block.dataset.fullBleed = 'true';
    else { delete block.dataset.fullBleed; window.clearBlockFullBleed?.(block); }
    rerender();
    window.pushHistory?.('Laurel 패딩 제외');
    window.scheduleAutoSave?.();
  });

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
    block.dataset.gridCols = String(newCols);
    block.dataset.gridRows = String(newRows);
    rerender();              // cells push/pop은 renderLaurelBlock이 처리
    window.pushHistory?.('Laurel 그리드');   // ★쓰기 «뒤»에 — prop-text-wireup-align.js 의 같은 까닭
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
      const cur = _readCells(block);
      if (!cur[ci]) return;   // ★찍기 «전»에 빠져나간다 — 옛 판은 찍은 뒤라 「아무 일도 없었다」가 한 칸이 됐다
      cur[ci].leafFill = sel.value;
      _writeCells(block, cur);
      rerender();
      window.pushHistory?.('월계수 채움');   // ★쓰기 «뒤»에 찍는다 — 위 prop-text-wireup-align.js 의 같은 까닭
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

  // 이스터에그(**text_) 텍스트 효과가 적용된 경우 우측 패널에 "텍스트 효과 ✨" 스타일 섹션 추가.
  // text-block과 달리 apply/remove를 laurel 전용 함수로 주입(재렌더 경로가 다름).
  if (block.dataset.textEffect) {
    window.enhanceTextEffectPropPanel?.(block, {
      apply:  (b, cfg) => window.applyTextEffectToLaurel?.(b, cfg),
      remove: (b) => { delete b.dataset.textEffect; window.renderLaurelBlock?.(b); },
    });
  }

  /* ★1013t1B2 — 고른 칸/줄이 있으면 헤더 바로 아래에 공용 줄 절(줄바 「+ 줄 추가▾」·줄 꾸미기·Typography)을 얹는다. */
  window.lnAugmentLaurelPanel?.(block);
}

window.showLaurelProperties = showLaurelProperties;

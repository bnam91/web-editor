import { propPanel } from '../globals.js';
import { blockHeaderHTML, discSecOpen, discSecToggle, disclosureChevronHtml, checkHTML } from './_helpers.js';
import { renderPanel, sec, expandSection } from './_panel-frame.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { gridNumOr } from '../blocks/grid-block.js';   /* ★C 181 — 0 을 살려 읽는 문 하나(렌더러 laurel-block.js 와 같은 함수 · 두 벌 금지) */

import { layoutSlotNumberHTML, layoutGapSlotHTML, wireLayoutSection } from './_layout-section.js';   // 표준 Layout(C2)
import { appearanceSectionHTML, appearanceHeadToolsHTML, wireAppearanceSection } from './_appearance-section.js';   // 표준 Appearance A4(C2)

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
  const gap       = gridNumOr(parseInt(cell.gap), 24);   // ★C 181 — ⛔`|| 24` 는 렌더러가 0 으로 그린 칸을 24 로 보였다
  const height    = parseInt(cell.height) > 0 ? parseInt(cell.height) : 140;   // ★C — height 0 = 뜻 없음(계약 [20,600] — 패널 clamp · MCP _isInt(n,20,600)) ⇒ 먹는 게 맞다 · ⛔Number.isFinite 로 0 을 살리지 마라(C 152·181 · 158 «h>0 ? 지정 : 기본» 과 같은 판정)

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

  // ── 셀 카드 펼침 = 공용 블록별 접기(_helpers discSec* · 블록 id 키 ⇒ ⌘Z 로 블록이 갈려도 유지 · U5).
  //    기본 = 칸 0 만 펼침. 키 'lrl-cell-<i>'.
  const _cellKey = (i) => `lrl-cell-${i}`;
  /* ★1013t1B2 — 캔버스에서 칸/줄을 고르면 그 칸 카드를 펼친다(결정 B2-7). */
  const _act = window.grdGetActiveLine?.(block);
  if (_act && Number.isInteger(_act.r) && _act.r >= 0 && _act.r < cells.length && !discSecOpen(block, _cellKey(_act.r), _act.r === 0)) discSecToggle(block, _cellKey(_act.r), _act.r === 0);
  const isExpanded = (i) => discSecOpen(block, _cellKey(i), i === 0);

  const cellsHtml = cells.map((cell, i) => {
    const r = Math.floor(i / cols) + 1;
    const c = (i % cols) + 1;
    const exp = isExpanded(i);
    return `
      <div class="prop-cell-card${exp ? ' expanded' : ''}" data-cell-idx="${i}">
        <div class="prop-cell-card-header">
          <span class="prop-cell-card-title">Cell ${i + 1} <span style="color:var(--ui-text-muted);">(${c},${r})</span></span>
          <button class="prop-icon-btn lrl-cell-toggle" title="펼치기/접기" aria-expanded="${exp ? 'true' : 'false'}">
            ${disclosureChevronHtml(exp)}
          </button>
        </div>
        <div class="prop-cell-card-body" ${exp ? '' : 'hidden'}>
          ${_cellInnerHtml(cell, i)}
        </div>
      </div>`;
  }).join('');

  /* ★t5-10 「패딩 제외」 — 배너2 패널(js/props/prop-banner02.js _bn2CanFullBleed)과 같은 판정(뚫을 수 없는 자리면 안 보인다 · 켜져 있으면 보인다). */
  const _lrlCanFB = block.dataset.fullBleed === 'true' || (window.effectiveSectionPadX?.(block) || 0) > 0;
  /* right-panel-unify U5 — 옛 절 Grid (c×r) · All Cells (일괄) · Cells (n) 을 정본 절로 나눴다.
     ★U6(수지 발주32) — 일괄 줄은 칸 카드와 «같은 이름표»라 어느 쪽이 일괄인지 사라졌다 ⇒ 그리드 범위 표기(「가로 정렬 · 모든 열」 · data-scope)와 같은 꼴로 「… · 모든 칸」 + data-scope="all" + title(56px 라벨에서 잘려도 전문).
     ★RP-LAUREL-SCOPE-LABEL-TRUNCATED-01(현빈 ⓑ 261117) — «잎 크기 · 모든 칸» 은 56px 라벨에서 «잎 크기 · …» 로 잘려 범위가 안 읽혔다 ⇒ 이름표를 «일괄 크기·간격·채움·색상» 으로 짧게(범위 낱말이 맨 앞) · title 전문·data-scope 그대로.
     「일괄」 값은 그 속성의 절(간격=Layout · 잎 크기=Size · 잎 채움/색=Fill)에, 칸 카드(per-cell)는 Content 한 절 안(§3-2 반복 항목). */
  renderPanel(block, {
    header: blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <path d="M3 10c0-3 0-6 3-8M9 10c0-3 0-6-3-8" stroke-linecap="round"/>
          </svg>`,
      name: block.dataset.layerName,
      defaultName: 'Laurel',
      crumb: window.getBlockBreadcrumb(block),
      id: block.id,
    }),
    sections: [
      sec('content', `
      <div id="lrl-cells-container">${cellsHtml}</div>
`),
      /* ★표준 Layout(C2) — 옛 슬라이더 lrl-all-height 걷음 · 숫자 칸 id·범위 무변(잎 크기 · 모든 칸 일괄) */
      /*   이름표 = «일괄 크기·일괄 간격»(현빈 ⓑ 261117 RP-LAUREL-SCOPE-LABEL-TRUNCATED-01 · 56px 안 잘림) · 전문 = 줄 title */
      sec('size', `<div data-scope="all" title="잎 크기 · 모든 칸(일괄)">${layoutSlotNumberHTML({ id: 'lrl-all-height-num', label: '일괄 크기', min: 20, max: 600, value: parseInt(cells[0]?.height) > 0 ? parseInt(cells[0].height) : 140 })}</div>`),
      sec('appearance', appearanceSectionHTML({ prefix: 'lrl', op: { value: window.readBlockOpacity?.(block) ?? 100 } }), { headTools: appearanceHeadToolsHTML({ prefix: 'lrl' }) }),   // ★표준 Appearance A4(C2) — Opacity 만
      sec('layout', `
      <div class="grid-picker" id="lrl-grid-picker"></div>
      <div class="grid-picker-label" id="lrl-grid-picker-label">${cols} × ${rows}</div>
      <!-- ★표준 Layout(C2) — 옛 슬라이더 lrl-all-gap · lrl-grid-col-gap · lrl-grid-row-gap 걷음 · 숫자 칸 id·범위 무변 · 셀 간격 칸은 열/줄이 둘 이상일 때만(옛과 같음) -->
      <div data-scope="all" title="잎 간격 · 모든 칸(일괄)">${layoutSlotNumberHTML({ id: 'lrl-all-gap-num', label: '일괄 간격', value: cells[0]?.gap ?? 24, max: 2000 })}</div>
      ${cols > 1 || rows > 1 ? layoutGapSlotHTML({ label: 'Cell gap', max: 400,
        xId: cols > 1 ? 'lrl-grid-col-gap-num' : null, x: gridNumOr(parseInt(block.dataset.gridColGap), 32),
        yId: rows > 1 ? 'lrl-grid-row-gap-num' : null, y: gridNumOr(parseInt(block.dataset.gridRowGap), 24) }) : ''}
`),
      sec('padding', _lrlCanFB ? `
      <div class="prop-row">
        ${checkHTML({ id: 'lrl-fullbleed-toggle', label: '패딩 제외', checked: block.dataset.fullBleed === 'true' })}
      </div>` : ''),
      sec('fill', `
      <div class="prop-row" data-scope="all">
        <span class="prop-label" title="잎 채움 · 모든 칸(일괄)">일괄 채움</span>
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
      <div class="prop-color-row" data-solid-only data-scope="all" style="${(cells[0]?.leafFill && cells[0].leafFill !== 'solid') ? 'opacity:0.4;pointer-events:none;' : ''}">
        <span class="prop-label" title="잎 색상 · 모든 칸(일괄)">일괄 색상</span>
        ${colorFieldHTML({ idPrefix: 'lrl-all-leaf', hex: cells[0]?.leafColor || '#1a1a1a', alpha: parseAlphaFromColor(cells[0]?.leafColor || '#1a1a1a') })}
      </div>
`),
    ],
  });

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
    pickerLabel.textContent = `${cols} × ${rows}`;   // 쉴 때 = 지금 c×r (옛 절 제목 「Grid (c×r)」 자리 · 제목엔 수 하나만 허용 · U5)
  });
  picker.addEventListener('click', e => {
    expandSection('content');   // 새 항목은 Content 절에 생긴다 — 접혀 있으면 펼쳐 보인다(U5 · 틀 expandSection)
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
    const idx = parseInt(card.dataset.cellIdx);
    if (Number.isNaN(idx)) return;
    const next = discSecToggle(block, _cellKey(idx), idx === 0);   // 다음 재그리기·⌘Z 에도 보존
    btn?.setAttribute('aria-expanded', String(next));
    card.classList.toggle('expanded', next);
    if (body) body.hidden = !next;
    const arrow = btn?.querySelector('svg');
    if (arrow) arrow.style.transform = `rotate(${next ? 0 : -90}deg)`;   // disclosureChevronHtml 과 같은 각도 식
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
  /* 모든 칸에 같은 값 + 셀 카드 안의 개별 칸 동기화(일괄 크기·간격이 같이 쓴다) */
  const applyAll = (key, v) => {
    const cur = _readCells(block);
    cur.forEach(c => { c[key] = v; });
    _writeCells(block, cur);
    rerender();
    propPanel.querySelectorAll(`.lrl-cell-${key}`).forEach(el => { el.value = Math.min(parseInt(el.max), v); });
    propPanel.querySelectorAll(`.lrl-cell-${key}-num`).forEach(el => { el.value = v; });
  };
  wireLayoutSection({ commit: () => window.pushHistory?.('일괄 gap'), w: { numberId: 'lrl-all-gap-num', max: 2000, apply: (v) => applyAll('gap', v) } });   // ★표준 Layout(C2) — 옛 bindAllNumPair(lrl-all-gap) 자리
  /* ★표준 Layout(C2) — 일괄 크기 칸 = 부품(input = 범위 안이면 바로 · change = 잘라 그린 «뒤» 이력 한 번 · 빈 칸 = 옛 값) · 이력 이름 그대로 */
  wireLayoutSection({ commit: () => window.pushHistory?.('일괄 height'), w: { numberId: 'lrl-all-height-num', min: 20, max: 600, apply: (v) => applyAll('height', v) } });
  wireAppearanceSection({ op: { numberId: 'lrl-opacity', apply: (v) => window.setBlockOpacity?.(block, v) } });   // ★표준 Appearance A4(C2)

  // Grid 셀 간격 (col/row) — block.dataset에 저장 (cells 배열과 별개) · ★표준 Layout(C2) — 칸 배선은 부품(옛 bindGridGap 자리 · 이력 이름 그대로)
  for (const [numberId, key] of [['lrl-grid-col-gap-num', 'gridColGap'], ['lrl-grid-row-gap-num', 'gridRowGap']])
    wireLayoutSection({ commit: () => window.pushHistory?.('셀 간격'), w: { numberId, max: 400, apply: (v) => { block.dataset[key] = String(v); rerender(); } } });

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

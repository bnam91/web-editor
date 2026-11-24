/* ═══════════════════════════════════
   ROW PROPERTIES PANEL
═══════════════════════════════════ */

import { propPanel } from '../globals.js';
import { blockHeaderHTML } from './_helpers.js';
import { renderPanel, sec } from './_panel-frame.js';
import { appearanceSectionHTML, appearanceHeadToolsHTML, wireAppearanceSection } from './_appearance-section.js';   // 표준 Appearance(A3)
import { layoutSizeRowHTML, layoutGapSlotHTML, wireLayoutSection } from './_layout-section.js';   // 표준 Layout(L2~L4 · C3)

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
    el.classList.contains('card-block') ||
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

  /* 자식 일괄 — 높이는 Layout 절(Child Blocks) · radius 는 Appearance 절(Q2 모서리 = 모양) */
  const childBatchHTML = hasChildren ? `
      ${layoutSizeRowHTML({ prefix: 'row-child-h', one: { id: 'row-child-h-number', label: '자식 높이', min: 0, max: 600, value: childHeightVal, mixed: childHeightVal === '' } })}` : '';   /* 0 = 자동(옛 뜻 그대로) · 자식 높이가 서로 다르면 Mixed(옛 빈 칸과 같은 뜻) */
  const childRadiusHTML = allCards ? `
      ${appearanceSectionHTML({ prefix: 'row-child', radius: { numberId: 'row-child-r-number', value: childRadiusVal, max: 40, mixed: childRadiusVal === '' } })}   <!-- ★표준 Appearance A3(현빈 261124 · 시안 #mkp-appstd) — 옛 슬라이더 걷음 · 숫자 칸 id·키·범위 무변 -->` : '';   /* 자식 카드 값이 서로 다르면 Mixed(옛 빈 칸과 같은 뜻) */


  /* 컬럼 비율 HTML */
  let colRatioHTML = '';
  if (layout === 'flex') {
    const ratioVal = cols.map(c => parseInt(c.dataset.flex) || 1).join(':');
    colRatioHTML = `
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-layout-input" id="row-col-ratio" value="${ratioVal}" placeholder="1:1">
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
        <input type="text" class="prop-layout-input" id="row-col-ratio" value="${ratioVal}" placeholder="1:1">
      </div>`;
  }

  renderPanel(rowEl, {
    header: blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="4" height="10" rx="0.5"/><rect x="7" y="1" width="4" height="10" rx="0.5"/>
          </svg>`,
      name: rowEl.dataset.layerName,
      defaultName: 'Grid',
      id: rowEl.id,
    }),
    sections: [
      /* ★표준 Layout(현빈 261124 L-4/7 · C3) — 옛 슬라이더 걷음 · 숫자 칸 id·범위 무변.
         ★전폭 블럭(너비 = 줄 폭) — 높이 한 칸만. P 부품 «전폭 = W 막힘·사슬 막힘+까닭» 나오면 w/h 꼴로 바꿀 자리(탑 공지 261125). */
      sec('size', layoutSizeRowHTML({ prefix: 'row', one: { id: 'row-height-number', label: 'Height', min: minRowHeight, max: 1200, value: rowHeight } })),
      sec('layout', (layout !== 'stack' ? colRatioHTML + layoutGapSlotHTML({ id: 'row-gap-number', value: currentGap, max: 80 }) : '') + childBatchHTML),
      /* 패딩 = 좌우 한 축뿐(상하 없음) — 부품 패딩 슬롯은 두 칸 고정이라 한 칸 꼴로(↔ 아이콘) */
      sec('padding', layoutSizeRowHTML({ prefix: 'row-padx', one: { id: 'row-padx-number', label: '좌우 패딩', min: 0, max: 80, value: padX } })),
      sec('appearance', appearanceSectionHTML({ prefix: 'row', op: { value: window.readBlockOpacity?.(rowEl) ?? 100 } }) + childRadiusHTML, childRadiusHTML ? { headTools: appearanceHeadToolsHTML({ prefix: 'row-child' }) } : {}),
    ],
  });

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
  };
  wireLayoutSection({ commit: () => window.pushHistory(), w: { numberId: 'row-height-number', min: minRowHeight, max: 1200, apply: applyRowHeight } });
  wireAppearanceSection({ op: { numberId: 'row-opacity', apply: (v) => window.setBlockOpacity?.(rowEl, v) } });   // A4 Opacity(블럭)

  /* ── 좌우 패딩 ── */
  const applyPadX = v => {
    if (isNaN(v) || v < 0) v = 0;
    v = Math.min(80, v);
    rowEl.style.paddingLeft  = v + 'px';
    rowEl.style.paddingRight = v + 'px';
    rowEl.dataset.padX = v;
    // row 직속 asset-block의 패딩 제외 hack 재계산 (글로벌 padXExcludesAsset 고려)
    const usePadx = window.getEffectiveUsePadx;
    rowEl.querySelectorAll(':scope > .asset-block').forEach(ab => {
      if (usePadx && usePadx(ab) && v > 0) {
        ab.style.marginLeft  = -v + 'px';
        ab.style.marginRight = -v + 'px';
        ab.style.width = `calc(100% + ${v * 2}px)`;
      } else {
        ab.style.marginLeft  = '';
        ab.style.marginRight = '';
        if (!ab.style.width || ab.style.width.includes('calc')) ab.style.width = '';
      }
    });
  };
  wireLayoutSection({ commit: () => window.pushHistory(), w: { numberId: 'row-padx-number', max: 80, apply: applyPadX } });

  /* ── 자식 블록 일괄: 높이 ── */
  if (hasChildren) {
    const applyChildHeight = v => {
      if (isNaN(v) || v < 0) v = 0;
      childBlocks.forEach(b => { b.style.minHeight = v ? v + 'px' : ''; });
    };
    wireLayoutSection({ commit: () => window.pushHistory(), w: { numberId: 'row-child-h-number', max: 600, apply: applyChildHeight } });

    /* ── 자식 블록 일괄: radius (card 전용) ── */
    if (allCards) {
      wireAppearanceSection({ radius: { numberId: 'row-child-r-number', max: 40, apply: (v) => { childBlocks.forEach(b => { b.dataset.radius = v; b.style.borderRadius = v + 'px'; }); }, commit: () => window.pushHistory() } });   // 표준 Appearance A3 — 자식 카드 일괄(슬라이더 걷음)
    }
  }

  if (layout === 'stack') return;

  /* ── Gap ── */
  const applyGap = v => {
    if (isNaN(v)) v = 0;
    v = Math.min(80, Math.max(0, v));
    rowEl.style.gap = v + 'px';
    rowEl.dataset.gap = v;
  };
  wireLayoutSection({ commit: () => window.pushHistory(), w: { numberId: 'row-gap-number', max: 80, apply: applyGap } });

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

}

window.showRowProperties   = showRowProperties;

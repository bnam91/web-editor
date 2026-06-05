/* ═══════════════════════════════════
   DRAG UTILITIES — pure helpers, no drag state
═══════════════════════════════════ */
import { state } from './globals.js';

function genId(prefix) {
  return (prefix || 'b') + '_' + Math.random().toString(36).slice(2, 9);
}

function clearDropIndicators() {
  document.querySelectorAll('.drop-indicator').forEach(d => d.remove());
  document.querySelectorAll('.ss-drag-over').forEach(el => el.classList.remove('ss-drag-over'));
}

function clearLayerIndicators() {
  document.querySelectorAll('.layer-drop-indicator').forEach(d => d.remove());
}

function clearSectionIndicators() {
  document.querySelectorAll('.section-drop-indicator').forEach(d => d.remove());
}

function clearLayerSectionIndicators() {
  document.querySelectorAll('.layer-section-drop-indicator').forEach(d => d.remove());
}

function makeLabelItem(text = 'Label', bg = '#e8e8e8', color = '#333333', radius = 40, shape = 'pill') {
  const item = document.createElement('div');
  const isCircle = shape === 'circle';
  item.className = 'label-item' + (isCircle ? ' label-circle' : '');
  item.dataset.bg     = bg;
  item.dataset.color  = color;
  item.dataset.radius = isCircle ? '50%' : radius;
  item.dataset.shape  = shape;
  item.style.backgroundColor = bg;
  item.style.color            = color;
  item.style.borderRadius     = isCircle ? '50%' : radius + 'px';

  const span = document.createElement('span');
  span.className = 'label-item-text';
  span.contentEditable = 'false';
  span.textContent = text;

  const delBtn = document.createElement('button');
  delBtn.className = 'label-item-delete-btn';
  delBtn.textContent = '×';
  delBtn.title = '라벨 삭제';

  item.appendChild(span);
  item.appendChild(delBtn);
  return item;
}

/* 섹션 안 삽입 — 하단 Gap Block 바로 앞에 */
function insertBeforeBottomGap(section, el) {
  const inner = section.querySelector('.section-inner');
  const bottomGap = [...inner.querySelectorAll(':scope > .gap-block')].at(-1);
  if (bottomGap) inner.insertBefore(el, bottomGap);
  else inner.appendChild(el);
}

/* 선택된 블록 바로 다음에 삽입, 없으면 하단 Gap 앞에 */
function insertAfterSelected(section, el) {
  // 활성 서브섹션이 있으면 그 안에 삽입 (selected 여부 관계없이)
  const activeSS = window._activeFrame;
  // text-frame은 단순 wrapper — 삽입 대상이 아님 (_restoreParentFrameSelected 안전망)
  // banner-preset 외곽은 컴포넌트 단위 — 안에 직접 자식 추가 받지 않음 (drill-in으로 inner 활성화 시에만)
  if (activeSS && !activeSS.dataset?.textFrame && !activeSS.dataset?.bannerPreset && activeSS.closest('.section-block') === section) {
    // shape-block이 선택된 경우: shape frame은 최소 단위 — 내부 삽입 금지, frame 뒤에 삽입
    const selShape = activeSS.querySelector('.shape-block.selected');
    if (selShape) {
      const ref = activeSS.closest('.row') || activeSS;
      ref.after(el);
      return;
    }

    const ssInner = activeSS;
    const sel = ssInner.querySelector(
      '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
      '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
      '.card-block.selected, .graph-block.selected, .divider-block.selected, .icon-text-block.selected, .icon-block.selected, .step-block.selected, .vector-block.selected, .canvas-block.selected, .banner02-block.selected, .comparison-block.selected, .laurel-block.selected, .chat-block.selected'
    );
    if (sel) {
      const ref = sel.classList.contains('gap-block') ? sel : (sel.closest('.frame-block[data-text-frame]') || sel.closest('.row') || sel);
      ref.after(el);
    } else if (ssInner.classList.contains('selected')) {
      // 내부 자식 선택 없이 프레임 자체가 오브젝트로 선택된 상태 → 프레임 안이 아니라 뒤(형제)에 삽입
      const ref = ssInner.closest('.row') || ssInner;
      ref.after(el);
    } else {
      ssInner.appendChild(el);
    }
    return;
  }

  const inner = section.querySelector('.section-inner');

  // 서브섹션 자체가 selected인 경우 → 서브섹션 row 뒤에 삽입
  const selSS = document.querySelector('.frame-block.selected');
  if (selSS && selSS.closest('.section-block') === section) {
    const ssRow = selSS.closest('.row') || selSS;
    ssRow.after(el);
    return;
  }

  // row-active 우선: 그리드/flex row가 선택된 경우 그 row 뒤에 삽입
  const activeRow = document.querySelector('.row.row-active');
  if (activeRow && activeRow.closest('.section-block') === section) {
    activeRow.after(el);
    return;
  }

  // shape-block은 최소 단위 — 내부 삽입 금지, 감싼 frame 뒤에 삽입
  const selShape = document.querySelector('.shape-block.selected');
  if (selShape && selShape.closest('.section-block') === section) {
    const frame = selShape.closest('.frame-block');
    const ref = (frame && (frame.closest('.row') || frame)) || selShape;
    ref.after(el);
    return;
  }

  const sel = document.querySelector('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected, .label-group-block.selected, .card-block.selected, .graph-block.selected, .divider-block.selected, .icon-text-block.selected, .icon-block.selected, .step-block.selected, .vector-block.selected, .canvas-block.selected, .banner02-block.selected, .comparison-block.selected, .laurel-block.selected, .chat-block.selected');

  if (sel && sel.closest('.section-block') === section) {
    const isGap = sel.classList.contains('gap-block');
    const ref = isGap ? sel : (sel.closest('.frame-block[data-text-frame]') || sel.closest('.row') || sel);
    ref.after(el);
  } else {
    insertBeforeBottomGap(section, el);
  }
}

function showNoSelectionHint() {
  const fp = document.getElementById('floating-panel');
  fp.classList.add('fp-shake');
  setTimeout(() => fp.classList.remove('fp-shake'), 400);
  showToast('⚠️ 섹션 또는 블록을 먼저 선택하세요');
}

function showToast(msg) {
  let t = document.getElementById('editor-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'editor-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

function getSectionAlign(sec) {
  const first = sec.querySelector('.text-block .tb-h1, .text-block .tb-h2, .text-block .tb-h3, .text-block .tb-body');
  if (!first) return null;
  return first.style.textAlign || null;
}

const GRAPH_DEFAULT_ITEMS = [
  { label: '항목 1', value: 75 },
  { label: '항목 2', value: 90 },
  { label: '항목 3', value: 55 },
  { label: '항목 4', value: 80 },
  { label: '항목 5', value: 65 },
];

function renderGraph(block) {
  const items      = JSON.parse(block.dataset.items || '[]');
  const chartType  = block.dataset.chartType  || 'bar-v';
  const maxVal     = Math.max(...items.map(i => i.value), 1);
  const chartH     = parseInt(block.dataset.chartHeight) || 240;
  const labelSize  = parseInt(block.dataset.labelSize)   || 20;
  const valSize    = Math.round(labelSize * 1.07);

  if (chartType === 'bar-v') {
    block.innerHTML = `
      <div class="grb-bars-v" style="height:${chartH}px">
        ${items.map(item => {
          const pct = item.value === 0 ? 0 : Math.max(1, Math.round((item.value / maxVal) * 100));
          const fillStyle = pct === 0 ? 'height:4px;opacity:0.25;border-style:dashed;' : `height:${pct}%;`;
          return `
            <div class="grb-bar-col">
              <div class="grb-bar-val-label" style="font-size:${valSize}px">${item.value}</div>
              <div class="grb-bar-fill-wrap">
                <div class="grb-bar-fill" style="${fillStyle}"></div>
              </div>
              <div class="grb-bar-label" style="font-size:${labelSize}px">${item.label}</div>
            </div>`;
        }).join('')}
      </div>`;
  } else if (chartType === 'line') {
    // ── 꺾은선 (line) — SVG polyline + circle data points
    const strokeWidth = parseInt(block.dataset.strokeWidth) || 3;
    const pointRadius = parseInt(block.dataset.pointRadius) || 5;
    const padXL       = parseInt(block.dataset.padX) || 16;
    const padTop      = Math.round(valSize * 1.4) + 8;
    const padBottom   = Math.round(labelSize * 1.4) + 8;

    if (block.style.position !== 'absolute') {
      block.style.height = 'auto';
    }

    // 안전 가드: 빈 데이터
    if (items.length === 0) {
      block.innerHTML = `<div class="grb-line-empty" style="height:${chartH}px"></div>`;
      return;
    }

    const innerW = 1000; // viewBox 기준 가상폭, CSS로 100% 늘림
    const innerH = chartH;
    const plotL  = padXL;
    const plotR  = innerW - padXL;
    const plotT  = padTop;
    const plotB  = innerH - padBottom;
    const plotW  = Math.max(1, plotR - plotL);
    const plotH  = Math.max(1, plotB - plotT);
    const n      = items.length;

    // 1개 점일 때는 중앙에 단일 점만
    const xOf = i => (n === 1) ? (plotL + plotW / 2) : plotL + (plotW * i) / (n - 1);
    const yOf = v => {
      const ratio = maxVal <= 0 ? 0 : (v / maxVal);
      return plotB - plotH * Math.max(0, Math.min(1, ratio));
    };

    const points = items.map((it, i) => ({ x: xOf(i), y: yOf(it.value), v: it.value, label: it.label }));
    const polyPoints = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // %-좌표 (오버레이 HTML 점/라벨 배치용)
    const overlayItems = points.map(p => {
      const leftPct  = (p.x / innerW) * 100;
      const topPct   = (p.y / innerH) * 100;
      const yLabelTop = (plotB + 4) / innerH * 100;
      const yValTop  = Math.max(0, (p.y - valSize - pointRadius - 4)) / innerH * 100;
      return { p, leftPct, topPct, yLabelTop, yValTop };
    });

    const userColor = block.dataset.barColor || '';
    const colorAttr = userColor ? ` stroke="${userColor}"` : '';
    const pointInlineStyle = userColor ? `background:${userColor};border-color:${userColor};` : '';

    // T10: 면 채우기 옵션 (dataset.fillArea === '1')
    const fillArea = block.dataset.fillArea === '1';
    const fillAlpha = Math.max(0, Math.min(1, parseFloat(block.dataset.fillAlpha) || 0.18));

    // SVG는 polyline + baseline 만 (preserveAspectRatio="none" + non-scaling-stroke)
    // 데이터 포인트 원은 HTML div 오버레이로 — 가로/세로 스케일 차이로 인한 타원화 방지
    const baselineY = plotB.toFixed(1);

    // 면 채우기 polygon: polyPoints + (lastX, baselineY) + (firstX, baselineY)로 닫음
    const areaEl = (fillArea && n >= 2) ? (() => {
      const firstX = points[0].x.toFixed(1);
      const lastX  = points[points.length - 1].x.toFixed(1);
      const areaPoints = `${polyPoints} ${lastX},${baselineY} ${firstX},${baselineY}`;
      const fillAttr = userColor
        ? `fill="${userColor}" fill-opacity="${fillAlpha}"`
        : `fill="currentColor" fill-opacity="${fillAlpha}" style="color:var(--ui-accent-primary,#3b82f6)"`;
      return `<polygon class="grb-line-area" points="${areaPoints}" ${fillAttr} stroke="none"/>`;
    })() : '';

    const polyEl = n >= 2
      ? `<polyline class="grb-line-path" points="${polyPoints}" fill="none" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${colorAttr}/>`
      : '';

    const pointDots = overlayItems.map(o =>
      `<div class="grb-line-point-dot" style="left:${o.leftPct.toFixed(2)}%;top:${o.topPct.toFixed(2)}%;width:${pointRadius * 2}px;height:${pointRadius * 2}px;${pointInlineStyle}"></div>`
    ).join('');
    const labelsHTML = overlayItems.map(o =>
      `<div class="grb-line-vlabel" style="left:${o.leftPct.toFixed(2)}%;top:${o.yValTop.toFixed(2)}%;font-size:${valSize}px">${o.p.v}</div>
       <div class="grb-line-xlabel" style="left:${o.leftPct.toFixed(2)}%;top:${o.yLabelTop.toFixed(2)}%;font-size:${labelSize}px">${o.p.label}</div>`
    ).join('');

    block.innerHTML = `
      <div class="grb-line-wrap" style="height:${chartH}px">
        <svg class="grb-line-svg" viewBox="0 0 ${innerW} ${innerH}" preserveAspectRatio="none">
          <line class="grb-line-axis" x1="${plotL}" y1="${baselineY}" x2="${plotR}" y2="${baselineY}" stroke-width="1"/>
          ${areaEl}
          ${polyEl}
        </svg>
        <div class="grb-line-overlay">${pointDots}${labelsHTML}</div>
      </div>`;
  } else {
    const barThickness = parseInt(block.dataset.barThickness) || 0;
    const padX         = parseInt(block.dataset.padX)         || 0;
    const barColor     = block.dataset.barColor || '';
    const itemGap      = parseInt(block.dataset.itemGap)      || 24;
    const pctSize      = parseInt(block.dataset.pctSize)      || Math.round(labelSize * 3);
    const trackH       = barThickness || 24;
    const trackR       = Math.round(trackH / 2);
    const trackStyle   = `height:${trackH}px;border-radius:${trackR}px;`;
    const fillStyle    = `width:__PCT__;border-radius:${trackR}px;${barColor ? `background:${barColor};` : ''}`;

    // freeLayout 절대 배치가 아닌 경우 height 고정 해제 → 콘텐츠 크기에 따라 자동 증가
    if (block.style.position !== 'absolute') {
      block.style.height = 'auto';
    }

    block.innerHTML = `
      <div class="grb-bars-h" style="padding:0 ${padX}px;gap:${itemGap}px">
        ${items.map(item => {
          const pct = item.value === 0 ? 0 : Math.max(1, Math.min(100, Math.round(item.value)));
          const displayVal = Number.isInteger(item.value) ? item.value + '%' : item.value;
          const hFillExtra = pct === 0 ? 'width:4px;opacity:0.25;border-style:dashed;' : '';
          return `
            <div class="grb-bar-row">
              <div class="grb-bar-h-pct" style="font-size:${pctSize}px">${displayVal}</div>
              <div class="grb-bar-h-desc" style="font-size:${Math.round(labelSize * 1.4)}px">${item.label}</div>
              <div class="grb-bar-h-track" style="${trackStyle}">
                <div class="grb-bar-h-fill" style="${fillStyle.replace('__PCT__', pct + '%')}${hFillExtra}"></div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }
}

function applyDividerStyle(block) {
  const hr      = block.querySelector('.dvd-line');
  if (!hr) return;
  const weight  = block.dataset.lineWeight  || '1';
  const style   = block.dataset.lineStyle   || 'solid';
  const color   = block.dataset.lineColor   || '#cccccc';
  const padV    = block.dataset.padV        || '30';
  const padH    = block.dataset.padH        || '0';
  const dir     = block.dataset.lineDir     || 'horizontal';
  const lineLen = parseInt(block.dataset.lineLength) || 80;

  if (dir === 'vertical') {
    hr.style.cssText = `border-left:${weight}px ${style} ${color}; border-top:none; width:0; height:${lineLen}px;`;
    block.style.padding = `${padV}px ${padH}px`;
    block.style.display = 'flex';
    block.style.justifyContent = 'center';
  } else {
    hr.style.cssText = `border-top:${weight}px ${style} ${color};`;
    block.style.padding = `${padV}px ${padH}px`;
    block.style.display = '';
  }
}

const ASSET_PRESETS = {
  standard: { height: 780 },
  square:   { height: 860 },
  tall:     { height: 1032 },
  wide:     { height: 575 },
  small:    { width: 300, height: 300 },
  logo:     { width: 200, height: 64 },
};

export {
  genId,
  clearDropIndicators,
  clearLayerIndicators,
  clearSectionIndicators,
  clearLayerSectionIndicators,
  makeLabelItem,
  insertBeforeBottomGap,
  insertAfterSelected,
  showNoSelectionHint,
  showToast,
  getSectionAlign,
  GRAPH_DEFAULT_ITEMS,
  renderGraph,
  applyDividerStyle,
  ASSET_PRESETS,
};

window.genId                      = genId;
window.clearDropIndicators        = clearDropIndicators;
window.clearLayerIndicators       = clearLayerIndicators;
window.clearSectionIndicators     = clearSectionIndicators;
window.clearLayerSectionIndicators= clearLayerSectionIndicators;
window.makeLabelItem              = makeLabelItem;
window.insertBeforeBottomGap      = insertBeforeBottomGap;
window.insertAfterSelected        = insertAfterSelected;
window.showNoSelectionHint        = showNoSelectionHint;
window.showToast                  = showToast;
window.getSectionAlign            = getSectionAlign;
window.GRAPH_DEFAULT_ITEMS        = GRAPH_DEFAULT_ITEMS;
window.renderGraph                = renderGraph;
window.applyDividerStyle          = applyDividerStyle;
window.ASSET_PRESETS              = ASSET_PRESETS;

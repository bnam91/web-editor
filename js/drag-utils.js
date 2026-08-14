/* ═══════════════════════════════════
   DRAG UTILITIES — pure helpers, no drag state
═══════════════════════════════════ */
import { state } from './globals.js';

/* ── actorId — «누가 만든 블록인가» ────────────────────────────────────────
 * 원격 동시협업에서는 두 사람의 앱이 «같은 문서»에 블록을 만든다. 기존 ID 는
 * prefix + 7자 난수뿐이라 ⑴ 누가 만들었는지 알 수 없고 ⑵ 충돌 때 keep-both 로
 * 둘 다 남길 때 구분할 근거가 없다.
 *
 * ⇒ ID 한가운데에 actor 조각을 넣는다:  b_k3fa9_x8s2m1
 *   - prefix 는 «그대로 첫 칸»이다 → 기존 `id.split('_')[0]` 코드(editor.js·
 *     section-variation.js·template-system.js)가 손 안 대고 그대로 산다.
 *   - 옛 프로젝트의 옛 ID(`b_x8s2m1`)도 그대로 유효하다. 형식을 «강제»하지 않는다 —
 *     읽는 쪽은 actor 조각이 없어도 동작해야 한다(마이그레이션 없음).
 *
 * ★actorId 는 «설치(userData)» 단위다. 계정 단위가 아니다 — 같은 사람이 두 기기에서
 *   편집하면 그건 실제로 두 편집자이고, 충돌도 둘 사이에서 난다.
 *   (그래서 격리 인스턴스로 A·B 검증하면 actorId 도 실제로 갈린다.)
 */
const ACTOR_KEY = 'goditor.actorId';
let _actorId = null;
function getActorId() {
  if (_actorId) return _actorId;
  let v = '';
  try { v = localStorage.getItem(ACTOR_KEY) || ''; } catch (_) { v = ''; }
  if (!/^[a-z0-9]{4,8}$/.test(v)) {
    v = Math.random().toString(36).slice(2, 7);
    // localStorage 가 막혀 있으면(파일 프로토콜·시크릿) 저장은 실패해도 «이번 세션»은 굴러가야 한다.
    try { localStorage.setItem(ACTOR_KEY, v); } catch (_) {}
  }
  _actorId = v;
  return _actorId;
}

function genId(prefix) {
  return (prefix || 'b') + '_' + getActorId() + '_' + Math.random().toString(36).slice(2, 9);
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
      '.card-block.selected, .graph-block.selected, .divider-block.selected, .bridge-block.selected, .duo-block.selected, .infocard-block.selected, .innercard-block.selected, .icon-text-block.selected, .icon-block.selected, .step-block.selected, .vector-block.selected, .canvas-block.selected, .banner02-block.selected, .comparison-block.selected, .laurel-block.selected, .chat-block.selected'
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

  const sel = document.querySelector('.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, .table-block.selected, .label-group-block.selected, .card-block.selected, .graph-block.selected, .divider-block.selected, .bridge-block.selected, .duo-block.selected, .infocard-block.selected, .innercard-block.selected, .icon-text-block.selected, .icon-block.selected, .step-block.selected, .vector-block.selected, .canvas-block.selected, .banner02-block.selected, .comparison-block.selected, .laurel-block.selected, .chat-block.selected');

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
  // bar-pair(2시리즈)의 value2까지 포함해 스케일 산출 — 타 차트는 value2 없음(0)이라 영향 없음
  const maxVal     = Math.max(...items.flatMap(i => [i.value || 0, i.value2 || 0]), 1);
  const chartH     = parseInt(block.dataset.chartHeight) || 240;
  const labelSize  = parseInt(block.dataset.labelSize)   || 20;
  const valSize    = Math.round(labelSize * 1.07);

  if (chartType === 'bar-v') {
    // 값/카테고리 라벨 표시·색 — line 차트와 동일 시맨틱 (이전엔 bar에서 미반영되던 버그)
    const _lc = block.dataset.labelColor || '';
    const _vCss = (block.dataset.showVLabel !== '0' ? '' : 'display:none;') + ((block.dataset.vlabelColor || _lc) ? `color:${block.dataset.vlabelColor || _lc};` : '');
    const _xCss = (block.dataset.showXLabel !== '0' ? '' : 'display:none;') + ((block.dataset.xlabelColor || _lc) ? `color:${block.dataset.xlabelColor || _lc};` : '');
    block.innerHTML = `
      <div class="grb-bars-v" style="height:${chartH}px">
        ${items.map(item => {
          const pct = item.value === 0 ? 0 : Math.max(1, Math.round((item.value / maxVal) * 100));
          const fillStyle = pct === 0 ? 'height:4px;opacity:0.25;border-style:dashed;' : `height:${pct}%;`;
          return `
            <div class="grb-bar-col">
              <div class="grb-bar-val-label" style="font-size:${valSize}px;${_vCss}">${item.value}</div>
              <div class="grb-bar-fill-wrap">
                <div class="grb-bar-fill" style="${fillStyle}"></div>
              </div>
              <div class="grb-bar-label" style="font-size:${labelSize}px;${_xCss}">${item.label}</div>
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

    // U9(BL-BOL-03): 곡선(스무드) 모드 — Catmull-Rom → cubic bezier. 온도 상승/냉각 곡선(temp-curve) 재현용.
    const smooth = block.dataset.lineSmooth === '1' && points.length >= 3;
    const _smoothD = (pts) => {
      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      return d;
    };
    const smoothD = smooth ? _smoothD(points) : '';

    // %-좌표 (오버레이 HTML 점/라벨 배치용)
    const overlayItems = points.map(p => {
      const leftPct  = (p.x / innerW) * 100;
      const topPct   = (p.y / innerH) * 100;
      const yLabelTop = (plotB + 4) / innerH * 100;
      const yValTop  = Math.max(0, (p.y - valSize - pointRadius - 4)) / innerH * 100;
      return { p, leftPct, topPct, yLabelTop, yValTop };
    });

    // 선/면 색상 분리 — lineColor가 선(stroke)·점, fillColor가 면(area). fallback은 barColor.
    // CSS preset rule이 stroke를 var()로 박아 SVG attribute를 덮어씀 → inline style로 우선순위 강제
    const lineColor = block.dataset.lineColor || block.dataset.barColor || '';
    const fillColor = block.dataset.fillColor || block.dataset.barColor || '';
    const colorAttr = lineColor ? ` style="stroke:${lineColor}"` : '';
    const pointInlineStyle = lineColor ? `background:${lineColor};border-color:${lineColor};` : '';

    // T10: 면 채우기 옵션 (dataset.fillArea === '1')
    const fillArea = block.dataset.fillArea === '1';
    const fillAlpha = Math.max(0, Math.min(1, parseFloat(block.dataset.fillAlpha) || 0.18));

    const baselineY = plotB.toFixed(1);

    // 면 채우기 polygon: polyPoints + (lastX, baselineY) + (firstX, baselineY)로 닫음
    const areaEl = (fillArea && n >= 2) ? (() => {
      const firstX = points[0].x.toFixed(1);
      const lastX  = points[points.length - 1].x.toFixed(1);
      const fillAttr = fillColor
        ? `fill="${fillColor}" fill-opacity="${fillAlpha}"`
        : `fill="currentColor" fill-opacity="${fillAlpha}" style="color:var(--ui-accent-primary,#3b82f6)"`;
      if (smooth) {
        return `<path class="grb-line-area" d="${smoothD} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z" ${fillAttr} stroke="none"/>`;
      }
      const areaPoints = `${polyPoints} ${lastX},${baselineY} ${firstX},${baselineY}`;
      return `<polygon class="grb-line-area" points="${areaPoints}" ${fillAttr} stroke="none"/>`;
    })() : '';

    const polyEl = n >= 2
      ? (smooth
        ? `<path class="grb-line-path" d="${smoothD}" fill="none" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${colorAttr}/>`
        : `<polyline class="grb-line-path" points="${polyPoints}" fill="none" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${colorAttr}/>`)
      : '';

    const pointDots = overlayItems.map(o =>
      `<div class="grb-line-point-dot" style="left:${o.leftPct.toFixed(2)}%;top:${o.topPct.toFixed(2)}%;width:${pointRadius * 2}px;height:${pointRadius * 2}px;${pointInlineStyle}"></div>`
    ).join('');
    // 라벨 색상 + 표시 옵션 (vlabel = 값, xlabel = 카테고리)
    const labelColor = block.dataset.labelColor || '';
    // vlabel(값)/xlabel(카테고리) 별도 색상 — 개별 set 안 됐으면 labelColor fallback
    const vlabelColor = block.dataset.vlabelColor || labelColor;
    const xlabelColor = block.dataset.xlabelColor || labelColor;
    const showVLabel = block.dataset.showVLabel !== '0';  // default 보임
    const showXLabel = block.dataset.showXLabel !== '0';  // default 보임
    const vlabelColorCss = vlabelColor ? `color:${vlabelColor};` : '';
    const xlabelColorCss = xlabelColor ? `color:${xlabelColor};` : '';
    const vlabelDisp = showVLabel ? '' : 'display:none;';
    const xlabelDisp = showXLabel ? '' : 'display:none;';
    const labelsHTML = overlayItems.map(o =>
      `<div class="grb-line-vlabel" style="left:${o.leftPct.toFixed(2)}%;top:${o.yValTop.toFixed(2)}%;font-size:${valSize}px;${vlabelColorCss}${vlabelDisp}">${o.p.v}</div>
       <div class="grb-line-xlabel" style="left:${o.leftPct.toFixed(2)}%;top:${o.yLabelTop.toFixed(2)}%;font-size:${labelSize}px;${xlabelColorCss}${xlabelDisp}">${o.p.label}</div>`
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
  } else if (chartType === 'bar-pair') {
    // ── U9(BL-BOL-03): 2시리즈 비교 세로 막대 (자사 vs 경쟁) — items: [{label, value, value2}]
    const _lc = block.dataset.labelColor || '';
    const _vCss = (block.dataset.showVLabel !== '0' ? '' : 'display:none;') + ((block.dataset.vlabelColor || _lc) ? `color:${block.dataset.vlabelColor || _lc};` : '');
    const _xCss = (block.dataset.showXLabel !== '0' ? '' : 'display:none;') + ((block.dataset.xlabelColor || _lc) ? `color:${block.dataset.xlabelColor || _lc};` : '');
    const barColor  = block.dataset.barColor  || '';
    const barColor2 = block.dataset.barColor2 || '#c9c9c9';
    const sA = block.dataset.seriesA || '';
    const sB = block.dataset.seriesB || '';
    const legend = (sA || sB) ? `
      <div class="grb-pair-legend" style="font-size:${labelSize}px;${_xCss}">
        ${sA ? `<span class="grb-pair-legend-item"><span class="grb-pair-dot"${barColor ? ` style="background:${barColor}"` : ''}></span>${sA}</span>` : ''}
        ${sB ? `<span class="grb-pair-legend-item"><span class="grb-pair-dot" style="background:${barColor2}"></span>${sB}</span>` : ''}
      </div>` : '';
    const bar = (v, color, extraClass) => {
      const pct = !v ? 0 : Math.max(1, Math.round((v / maxVal) * 100));
      const fillStyle = pct === 0 ? 'height:4px;opacity:0.25;border-style:dashed;' : `height:${pct}%;`;
      return `
        <div class="grb-pair-series">
          <div class="grb-bar-val-label" style="font-size:${valSize}px;${_vCss}">${v ?? 0}</div>
          <div class="grb-bar-fill${extraClass}" style="${fillStyle}${color ? `background:${color};` : ''}"></div>
        </div>`;
    };
    block.innerHTML = `${legend}
      <div class="grb-bars-v" style="height:${chartH}px">
        ${items.map(item => `
          <div class="grb-bar-col">
            <div class="grb-bar-fill-wrap grb-pair-wrap">
              ${bar(item.value, barColor, '')}
              ${bar(item.value2, barColor2, ' grb-bar-fill-b')}
            </div>
            <div class="grb-bar-label" style="font-size:${labelSize}px;${_xCss}">${item.label}</div>
          </div>`).join('')}
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
    // 값/카테고리 라벨 표시·색 — line 차트와 동일 시맨틱 (이전엔 bar-h에서 미반영되던 버그)
    const _lc = block.dataset.labelColor || '';
    const _vCss = (block.dataset.showVLabel !== '0' ? '' : 'display:none;') + ((block.dataset.vlabelColor || _lc) ? `color:${block.dataset.vlabelColor || _lc};` : '');
    const _xCss = (block.dataset.showXLabel !== '0' ? '' : 'display:none;') + ((block.dataset.xlabelColor || _lc) ? `color:${block.dataset.xlabelColor || _lc};` : '');

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
              <div class="grb-bar-h-pct" style="font-size:${pctSize}px;${_vCss}">${displayVal}</div>
              <div class="grb-bar-h-desc" style="font-size:${Math.round(labelSize * 1.4)}px;${_xCss}">${item.label}</div>
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
  const padH    = parseInt(block.dataset.padH) || 0;
  const dir     = block.dataset.lineDir     || 'horizontal';
  const lineLen = parseInt(block.dataset.lineLength) || 80;
  // padH가 콘텐츠 폭의 절반보다 커도 그대로 적용 (사용자 의도). 라인은 box-sizing border-box로 음수 폭 시 안 보일 수 있음.

  // U7(BL-CDD-06): 페이스라인 — 눈금 레일(tick) + 선택 마커. 수평 전용.
  // 기존 마커는 항상 걷어낸 뒤 tick+markerPos일 때만 다시 그린다(스타일 전환 시 잔재 방지).
  block.querySelector('.dvd-marker')?.remove();
  if (style === 'tick' && dir !== 'vertical') {
    const tickH   = parseInt(block.dataset.tickHeight) || 12;
    const tickGap = parseInt(block.dataset.tickGap) || 24;
    const w = Math.max(1, parseInt(weight) || 1);
    hr.style.cssText = `border:none;height:${tickH}px;` +
      `background:repeating-linear-gradient(90deg, ${color} 0 ${w}px, transparent ${w}px ${tickGap}px);`;
    block.style.padding = `${padV}px ${padH}px`;
    block.style.display = '';
    block.style.position = 'relative';
    const mp = parseFloat(block.dataset.markerPos);
    if (Number.isFinite(mp) && mp >= 0 && mp <= 100) {
      const mc = block.dataset.markerColor || '#2d6fe8';
      const ms = parseInt(block.dataset.markerSize) || 10;
      const marker = document.createElement('span');
      marker.className = 'dvd-marker';
      marker.style.cssText = `position:absolute;left:calc(${padH}px + (100% - ${padH * 2}px) * ${mp / 100});` +
        `top:50%;transform:translate(-50%,-50%);width:${ms}px;height:${ms}px;border-radius:50%;` +
        `background:${mc};pointer-events:none;`;
      block.appendChild(marker);
    }
    return;
  }
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

// 색 문자열 → 상대 휘도(0~1). 인식 불가/투명이면 null.
// block-factory _colorLuminance 미러 — 블록 렌더러 테마어웨어 공용 (2026-07-04 제니 발주)
function colorLuminance(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  let r, g, b;
  let m = s.match(/^#([0-9a-fA-F]{3})$/);
  if (m) { r = parseInt(m[1][0] + m[1][0], 16); g = parseInt(m[1][1] + m[1][1], 16); b = parseInt(m[1][2] + m[1][2], 16); }
  if (r === undefined) {
    m = s.match(/^#([0-9a-fA-F]{6})/);
    if (m) { r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16); }
  }
  if (r === undefined) {
    m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
  }
  if (r === undefined) return null;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
// 블록의 배경 컨텍스트 휘도: 자체 bg가 유효하면 그것, 아니면 섹션 bg.
function blockContextLuminance(block, selfBg) {
  const own = colorLuminance(selfBg);
  if (own !== null) return own;
  const sec = block.closest?.('.section-block');
  if (!sec) return null;
  return colorLuminance(sec.style.backgroundColor || sec.style.background || sec.dataset.bg || '');
}

export {
  genId,
  getActorId,
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
  colorLuminance,
  blockContextLuminance,
};

window.genId                      = genId;
window.getActorId                 = getActorId;
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

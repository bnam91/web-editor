import '../graph-limits.js';   // side-effect import — window.GRAPH_LIMITS 를 «이 모듈보다 먼저» 싣는다(하네스·앱 같은 길, 로드 순서 의존 없음)
import { propPanel, state } from '../globals.js';
import { blockHeaderHTML } from './_helpers.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';
import { isBlurIntoPanel, parkEditing } from './_text-selection.js';
import { graphFieldShown } from '../canvas-contrast.js';   // E149 — 색 칸 «보일 값»의 한 자리

const { BAR_THICKNESS_MIN, BAR_THICKNESS_MAX, BAR_THICKNESS_DEFAULT, BAR_THICKNESS_V_MAX, LABEL_SIZE_DEFAULT, LINE_PADX_DEFAULT, PCT_SIZE_FACTOR } = window.GRAPH_LIMITS;   // js/graph-limits.js — 두께 한계의 한 자리

/* Bar Settings 절 — bar-h·bar-v·bar-pair 가 «한 마크업»을 공유한다(사본 금지, B7).
 * bar-pair 는 «바 색상» 줄을 뺀다 — Pair Settings 의 «색상 A»가 이미 id grb-bar 를 쓴다(중복 id 방지). */
/* GR2·GR3 — bar-v 전용 토글 셋(현빈 「눈금과 가로 격자선은 따로」 + 꺾은선 별도). 묶지 않는다.
 * 켜면 dataset 키 '1', 끄면 키를 «지운다» — 셋 다 꺼진 블럭은 한 번도 안 건드린 블럭과 같은 꼴(렌더 바이트 동일 · GR-W0). */
const GR_OVERLAY_TOGGLES = [
  { key: 'showAxis', id: 'grb-show-axis', label: '축 보이기',     title: '왼쪽 눈금(0~깔끔한 상한, 1·2·5 간격)' },
  { key: 'showGrid', id: 'grb-show-grid', label: '격자선 보이기', title: '눈금 높이마다 옅은 가로선' },
  { key: 'showLine', id: 'grb-show-line', label: '꺾은선 얹기',   title: '막대 꼭대기를 잇는 선·점(막대와 같은 값)' },
];
function overlayTogglesHTML(block) {
  return GR_OVERLAY_TOGGLES.map(t => `
      <div class="prop-row" title="${t.title}">
        <span class="prop-label">${t.label}</span>
        <label class="prop-toggle">
          <input type="checkbox" id="${t.id}" ${block.dataset[t.key] === '1' ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>${t.key === 'showGrid' ? gridColorRowHTML(block) : ''}`).join('');
}
/* H7(현빈 2026-10-05) — 격자선 색 칸. 비어 있으면(키 없음) «지금 그려진» 색 = 블럭 글자색(currentColor) · 투명도 20(렌더 기본 그대로).
   ⛔기본값을 새로 박지 않는다 — 렌더(drag-utils.js _barVPlotGeom)가 키 없을 때 currentColor×0.2 를 그리고, 칸은 그 계산값을 보인다. */
function _gridColorShown(block) {
  if (block.dataset.gridColor) return { c: block.dataset.gridColor, a: parseAlphaFromColor(block.dataset.gridColor) };
  /* E149 — 격자층의 글자색(파생 전). 옛: .grb-ov 의 계산값 = 어두운 바탕에선 H6 가 밝힌 잉크라 #111 위 7C7C7C ↔ 그려진 흰 0.33(실측). */
  return { c: graphFieldShown(block, 'grid'), a: 20 };
}
function gridColorRowHTML(block) {
  const g = _gridColorShown(block);
  return `
      <div class="prop-row" title="격자선 색(비우면 블럭 글자색 · 투명도 20%)">
        <span class="prop-label">격자선 색</span>
        ${colorFieldHTML({ idPrefix: 'grb-grid', hex: g.c, alpha: g.a })}
      </div>`;
}

function barSettingsHTML({ chartType, barThickness, thicknessMax = BAR_THICKNESS_MAX, padX, itemGap, pctSize, pctMin, barColor, barAlpha, overlayToggles = '' }) {
  return `
    <div class="prop-section">
      <div class="prop-section-title">Bar Settings</div>
      <div class="prop-row">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="grb-bar-thickness-slider" min="${BAR_THICKNESS_MIN}" max="${thicknessMax}" step="2" value="${barThickness}">
        <input type="number" class="prop-number" id="grb-bar-thickness-number" min="${BAR_THICKNESS_MIN}" max="${thicknessMax}" value="${barThickness}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="grb-padx-slider" min="0" max="80" step="4" value="${padX}">
        <input type="number" class="prop-number" id="grb-padx-number" min="0" max="80" value="${padX}">
      </div>
      <div class="prop-row">
        <span class="prop-label">항목 간격</span>
        <input type="range" class="prop-slider" id="grb-item-gap-slider" min="8" max="80" step="4" value="${itemGap}">
        <input type="number" class="prop-number" id="grb-item-gap-number" min="8" max="80" value="${itemGap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">숫자 크기</span>
        <input type="range" class="prop-slider" id="grb-pct-size-slider" min="${pctMin}" max="120" step="2" value="${pctSize}">
        <input type="number" class="prop-number" id="grb-pct-size-number" min="${pctMin}" max="120" value="${pctSize}">
      </div>
      ${chartType === 'bar-pair' ? '' : `
      <div class="prop-row">
        <span class="prop-label">바 색상</span>
        ${colorFieldHTML({ idPrefix: 'grb-bar', hex: barColor, alpha: barAlpha })}
      </div>
      `}${overlayToggles}
    </div>`;
}

const _isGrad = (c) => typeof c === 'string' && /gradient\(/i.test(c);
/* GR1 — 항목(막대)마다 색 칸 = colorFieldHTML(단색·그라데이션). 「미지정 = 프리셋 색」은 예전 스와치처럼 체커(.swatch-none)
 * + hex 칸 비움(placeholder 「프리셋」)으로 보인다 — 모델(item.color 없음)은 손대지 않는다. 고르는 순간에만 item.color 가 생긴다. */
function itemColorFieldHTML(item, i) {
  const c = item.color || '';
  return `<div class="grb-data-color" title="바 색상 (미지정 시 프리셋 색 · 그라데이션은 막대마다 따로)">${colorFieldHTML({
    idPrefix: 'grb-data-color-' + i,
    hex: c && !_isGrad(c) ? c : '#4dabf7',
    alpha: c && !_isGrad(c) ? parseAlphaFromColor(c) : 100,
    placeholder: c ? '' : '프리셋',
    gradientCss: _isGrad(c) ? c : '',
  })}</div>`;
}

/* E149 — 그래프 색 칸 배선 한 자리. 칸이 «정해지지 않음»(Mix · 그려진 색을 못 읽음)이면 hex 를 비우고 안내(Mix/—)를 보이며,
 * «투명도만» 고친 입력은 색을 안 쓴다(어느 색에 투명도를 줄지 없다 — Mix 에서 한 색으로 덮으면 파란 값 라벨이 회색이 되는 같은 병).
 * hex·피커로 색을 고르는 순간 정해진다. ⛔칸마다 따로 짜지 않는다. */
function _wireGraphColor(prefix, { unset = false, mixed = false, ...opts } = {}) {
  const hex = document.getElementById(prefix + '-hex'), alpha = document.getElementById(prefix + '-alpha');
  let pending = unset, alphaEvt = false;
  if (unset && hex) { hex.value = ''; hex.placeholder = mixed ? 'Mix' : '—'; }
  /* wireColorField 의 alpha 리스너보다 «먼저» 건다(같은 이벤트 안에서 이 깃발을 보고 onApply 가 갈린다).
     ⚠️내리기는 setTimeout — 사용자 이벤트는 «리스너 사이»에 마이크로태스크가 돈다(queueMicrotask 면 다음 리스너 전에 내려가 투명도만이 색을 썼다 · C3 실측). */
  alpha?.addEventListener('input', () => { alphaEvt = true; setTimeout(() => { alphaEvt = false; }, 0); });
  const onApply = opts.onApply;
  return wireColorField(prefix, { ...opts, onApply: (c) => { if (pending && alphaEvt) return; pending = false; onApply?.(c); } });
}

export function showGraphProperties(block) {
  const _vKey = (hKey, vKey) => (block.dataset.chartType === 'bar-v' || block.dataset.chartType === 'bar-pair') ? vKey : hKey;
  const chartType    = block.dataset.chartType    || 'bar-v';
  const preset       = block.dataset.preset       || 'default';
  const items        = JSON.parse(block.dataset.items || '[]');
  const chartH       = parseInt(block.dataset.chartHeight)  || 240;
  const labelSize    = parseInt(block.dataset.labelSize)    || LABEL_SIZE_DEFAULT;   // E105 = 13≠20 — 렌더러와 같은 한 자리(옛 13 은 그려지는 20 과 달랐다)
  // B7r: bar-v·bar-pair 는 «자기 키»(vXxx)만 읽고 쓴다 — bar-h 키(itemGap·barThickness·padX·pctSize·barColor)와 겹치면
  //      타입 전환 때 단위가 다른 값이 딸려 온다(가로 숫자 크기 60 ↔ 세로 값 글자 21 …).
  const _vOnly = chartType === 'bar-v' || chartType === 'bar-pair';
  const barThickness = parseInt(block.dataset[_vOnly ? 'vBarThickness' : 'barThickness']) || BAR_THICKNESS_DEFAULT;   // 렌더(drag-utils.js)와 «같은 값»
  /* H1 — 세로·비교 막대 두께의 위 끝 = «그 막대가 선 칸의 폭»(GRAPH_LIMITS.BAR_THICKNESS_V_MAX 'column'). 막대의 max-width:100% 가 재는 그 상자
     (막대의 부모 = 막대 칸 · 비교는 시리즈 칸)의 «그려진» 폭이다. 못 재면(막대 0) 옛 상한. 가로 막대는 60 그대로. */
  const _thkMax = (() => {
    if (!(_vOnly && BAR_THICKNESS_V_MAX === 'column')) return BAR_THICKNESS_MAX;
    const f = block.querySelector('.grb-bar-fill');
    const w = f && f.parentElement ? Math.floor(f.parentElement.clientWidth) : 0;
    return w > BAR_THICKNESS_MIN ? w : BAR_THICKNESS_MAX;
  })();
  const padX         = parseInt(block.dataset[_vOnly ? 'vPadX' : 'padX'])         || (chartType === 'line' ? LINE_PADX_DEFAULT : 0);   // E106 — 꺾은선은 렌더 16(막대는 0 그대로)
  /* ★E149(2026-10-05 · 지디 ⒝) — 색 칸의 «보일 값» = 데이터 값, 없으면 «그려진 파생 전» 색(canvas-contrast graphFieldShown 표 한 자리).
     옛: 칸마다 #222222·#4dabf7·#888888·#3b82f6 을 박아 19 칸 중 18 이 그려진 색과 달랐고(실측 $S/e149/census.json),
     «투명도만» 고쳐도 그 틀린 hex 로 명시 색이 굳었다(꺾은선: 파랑 → rgba(34,34,34,.5) · #111 위 26,26,26). */
  const _shown = (f) => graphFieldShown(block, f);
  const barColor     = (chartType === 'line' ? (block.dataset.lineColor || block.dataset.barColor) : block.dataset.barColor) || _shown('bar');
  const barAlpha     = parseAlphaFromColor(barColor);
  const itemGap      = _vOnly ? (parseInt(block.dataset.vItemGap) || 10) : (parseInt(block.dataset.itemGap) || 24);
  const pctSize      = parseInt(block.dataset.pctSize)      || Math.round(labelSize * PCT_SIZE_FACTOR);   // E110 — 렌더러와 같은 식(옛 60 = 라벨 20 일 때만 맞았다)
  // 숫자 크기 — bar-h 는 기존 기본 60·최소 20, bar-v·pair 는 렌더가 쓰는 값 라벨 크기(valSize)·8~120
  const _isBarH      = chartType === 'bar-h';
  const barPctMin    = _isBarH ? 20 : 8;
  const barPctSize   = _isBarH ? pctSize
    : (parseInt(block.dataset.vPctSize) || Math.round((parseInt(block.dataset.labelSize) || LABEL_SIZE_DEFAULT) * 1.07));
  const _barSetColor = chartType === 'bar-v' ? (block.dataset.vBarColor || _shown('bar')) : barColor;   // E149
  const strokeWidth  = parseInt(block.dataset.strokeWidth)  || 3;
  const pointRadius  = parseInt(block.dataset.pointRadius)  || 5;
  const fillArea     = block.dataset.fillArea === '1';
  const fillAlpha    = Math.round((parseFloat(block.dataset.fillAlpha) || 0.18) * 100);
  const _lblShown    = _shown('label');   // { c, mixed } — 값·카테고리 두 색이 다르면 Mix
  const labelColor   = block.dataset.labelColor || _lblShown.c;
  const _labelUnset  = !block.dataset.labelColor && (_lblShown.mixed || !_lblShown.c);
  const _vlabelShown = block.dataset.vlabelColor || block.dataset.labelColor || _shown('vlabel');
  const _xlabelShown = block.dataset.xlabelColor || block.dataset.labelColor || _shown('xlabel');
  const _bar2Shown   = block.dataset.barColor2 || _shown('bar2');
  const labelAlpha   = parseAlphaFromColor(labelColor);
  const fillColor    = block.dataset.fillColor || block.dataset.barColor || _shown('fill');   // E149
  const fillColorAlpha = parseAlphaFromColor(fillColor);
  const showVLabel   = block.dataset.showVLabel !== '0';
  const showXLabel   = block.dataset.showXLabel !== '0';

  const presets = [
    { id: 'default',  label: '기본' },
    { id: 'dark',     label: '다크' },
    { id: 'minimal',  label: '미니멀' },
    { id: 'colorful', label: '컬러풀' },
  ];

  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="5" width="2" height="6" rx="0.5"/>
            <rect x="5" y="2" width="2" height="9" rx="0.5"/>
            <rect x="9" y="4" width="2" height="7" rx="0.5"/>
          </svg>`,
      name: block.dataset.layerName,
      defaultName: 'Graph Block',
      crumb: window.getBlockBreadcrumb(block),
      id: block.id,
    })}
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="grb-h-slider" min="80" max="2000" step="8" value="${chartH}">
        <input type="number" class="prop-number" id="grb-h-number" min="80" max="2000" value="${chartH}">
      </div>
      <div class="prop-row">
        <span class="prop-label">라벨</span>
        <input type="range" class="prop-slider" id="grb-label-slider" min="8" max="28" step="1" value="${labelSize}">
        <input type="number" class="prop-number" id="grb-label-number" min="8" max="28" value="${labelSize}">
      </div>
      <div class="prop-row" title="값 라벨(숫자) + 카테고리 라벨 둘 다 일괄 적용. 아래 항목별로 따로 설정 가능">
        <span class="prop-label">라벨 색상</span>
        ${colorFieldHTML({ idPrefix: 'grb-label', hex: labelColor, alpha: labelAlpha })}
      </div>
      <div class="prop-row" title="값 라벨(숫자)만 별도 색상">
        <span class="prop-label">값 색상</span>
        ${colorFieldHTML({ idPrefix: 'grb-vlabel', hex: _vlabelShown, alpha: parseAlphaFromColor(_vlabelShown) })}
      </div>
      <!-- ★E103 U27(2026-10-05): 「카테고리 색상」·「카테고리 표시」는 56px 고정 라벨에서 잘렸다(sw60/cw56 실측) — 기존 변형 .prop-label--auto(css/editor-props.css, 「그리드 가이드」 선례)를 쓴다. 전역 56px 은 안 건드린다. -->
      <div class="prop-row" title="카테고리 라벨(7차 입고 등)만 별도 색상">
        <span class="prop-label prop-label--auto">카테고리 색상</span>
        ${colorFieldHTML({ idPrefix: 'grb-xlabel', hex: _xlabelShown, alpha: parseAlphaFromColor(_xlabelShown) })}
      </div>
      <div class="prop-row">
        <span class="prop-label">값 표시</span>
        <label class="prop-toggle">
          <input type="checkbox" id="grb-show-vlabel" ${showVLabel ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div class="prop-row">
        <span class="prop-label prop-label--auto">카테고리 표시</span>
        <label class="prop-toggle">
          <input type="checkbox" id="grb-show-xlabel" ${showXLabel ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Chart Type</div>
      <div class="prop-type-group">
        <button class="prop-type-btn ${chartType === 'bar-v' ? 'active' : ''}" id="grb-type-v">세로 막대</button>
        <button class="prop-type-btn ${chartType === 'bar-h' ? 'active' : ''}" id="grb-type-h">가로 막대</button>
        <button class="prop-type-btn ${chartType === 'line' ? 'active' : ''}" id="grb-type-line">꺾은선</button>
        <button class="prop-type-btn ${chartType === 'bar-pair' ? 'active' : ''}" id="grb-type-pair">비교 막대</button>
      </div>
    </div>
    ${chartType === 'bar-pair' ? `
    <div class="prop-section">
      <div class="prop-section-title">Pair Settings</div>
      <div class="prop-row">
        <span class="prop-label">시리즈 A</span>
        <input type="text" class="prop-input" id="grb-series-a" value="${(block.dataset.seriesA || '').replace(/"/g, '&quot;')}" placeholder="예: 우리" style="flex:1;min-width:0">
      </div>
      <div class="prop-row">
        <span class="prop-label">색상 A</span>
        ${colorFieldHTML({ idPrefix: 'grb-bar', hex: barColor, alpha: barAlpha })}
      </div>
      <div class="prop-row">
        <span class="prop-label">시리즈 B</span>
        <input type="text" class="prop-input" id="grb-series-b" value="${(block.dataset.seriesB || '').replace(/"/g, '&quot;')}" placeholder="예: A사" style="flex:1;min-width:0">
      </div>
      <div class="prop-row">
        <span class="prop-label">색상 B</span>
        ${colorFieldHTML({ idPrefix: 'grb-bar2', hex: _bar2Shown, alpha: parseAlphaFromColor(_bar2Shown) })}
      </div>
    </div>` : ''}
    ${chartType === 'line' ? `
    <div class="prop-section">
      <div class="prop-section-title">Line Settings</div>
      <div class="prop-row">
        <span class="prop-label">선 두께</span>
        <input type="range" class="prop-slider" id="grb-stroke-slider" min="1" max="12" step="1" value="${strokeWidth}">
        <input type="number" class="prop-number" id="grb-stroke-number" min="1" max="12" value="${strokeWidth}">
      </div>
      <div class="prop-row">
        <span class="prop-label">점 크기</span>
        <input type="range" class="prop-slider" id="grb-point-slider" min="0" max="16" step="1" value="${pointRadius}">
        <input type="number" class="prop-number" id="grb-point-number" min="0" max="16" value="${pointRadius}">
      </div>
      <div class="prop-row">
        <span class="prop-label">점 모양</span>
        <select class="prop-select" id="grb-pointstyle-select">
          <option value="" ${block.dataset.pointStyle !== 'hollow' ? 'selected' : ''}>채움</option>
          <option value="hollow" ${block.dataset.pointStyle === 'hollow' ? 'selected' : ''}>속빈</option>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="grb-padx-slider" min="0" max="80" step="4" value="${padX}">
        <input type="number" class="prop-number" id="grb-padx-number" min="0" max="80" value="${padX}">
      </div>
      <div class="prop-row">
        <span class="prop-label">선 색상</span>
        ${colorFieldHTML({ idPrefix: 'grb-bar', hex: barColor, alpha: barAlpha })}
      </div>
      <div class="prop-row" title="Catmull-Rom 곡선 보간 — 온도 곡선 등 부드러운 추세선">
        <span class="prop-label">곡선(스무드)</span>
        <label class="prop-toggle">
          <input type="checkbox" id="grb-smooth-toggle" ${block.dataset.lineSmooth === '1' ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div class="prop-row">
        <span class="prop-label">면 채우기</span>
        <label class="prop-toggle">
          <input type="checkbox" id="grb-fillarea-toggle" ${fillArea ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div class="prop-row" id="grb-fillcolor-row" style="display:${fillArea ? 'flex' : 'none'}">
        <span class="prop-label">면 색상</span>
        ${colorFieldHTML({ idPrefix: 'grb-fill', hex: fillColor, alpha: fillColorAlpha })}
      </div>
      <div class="prop-row" id="grb-fillalpha-row" style="display:${fillArea ? 'flex' : 'none'}">
        <span class="prop-label">투명도</span>
        <input type="range" class="prop-slider" id="grb-fillalpha-slider" min="0" max="100" step="1" value="${fillAlpha}">
        <input type="number" class="prop-number" id="grb-fillalpha-number" min="0" max="100" value="${fillAlpha}">
      </div>
    </div>` : ''}
    ${(chartType === 'bar-h' || chartType === 'bar-v' || chartType === 'bar-pair') ? barSettingsHTML({ chartType, barThickness, thicknessMax: _thkMax, padX, itemGap, pctSize: barPctSize, pctMin: barPctMin, barColor: _barSetColor, barAlpha: parseAlphaFromColor(_barSetColor), overlayToggles: chartType === 'bar-v' ? overlayTogglesHTML(block) : '' }) : ''}
    <div class="prop-section">
      <div class="prop-section-title">Preset</div>
      <div class="prop-preset-group">
        ${presets.map(p => `
          <button class="prop-preset-btn ${preset === p.id ? 'active' : ''}" data-preset-id="${p.id}" id="grb-preset-${p.id}">
            ${p.label}
          </button>`).join('')}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Data</div>
      <div class="grb-data-list" id="grb-data-list">
        ${items.map((item, i) => `
          <div class="grb-data-item" data-index="${i}">
            <input type="text" class="grb-data-label-input" value="${item.label}" placeholder="라벨">
            <input type="number" class="grb-data-val-input" value="${item.value}" min="0" max="9999">
            ${chartType === 'bar-pair' ? `<input type="number" class="grb-data-val-input grb-data-val2-input" value="${item.value2 ?? 0}" min="0" max="9999" title="시리즈 B 값">` : ''}
            <button class="grb-data-del-btn" data-index="${i}">✕</button>
            ${(chartType === 'bar-v' || chartType === 'bar-h') ? itemColorFieldHTML(item, i) : ''}
          </div>`).join('')}
      </div>
      <button class="prop-btn-full" id="grb-add-item">+ 항목 추가</button>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  // 타입 토글
  document.getElementById('grb-type-v').addEventListener('click', () => {
    block.dataset.chartType = 'bar-v';
    window.renderGraph(block);
    showGraphProperties(block);
  });
  document.getElementById('grb-type-h').addEventListener('click', () => {
    block.dataset.chartType = 'bar-h';
    window.renderGraph(block);
    showGraphProperties(block);
  });
  document.getElementById('grb-type-line').addEventListener('click', () => {
    block.dataset.chartType = 'line';
    window.renderGraph(block);
    showGraphProperties(block);
  });
  document.getElementById('grb-type-pair').addEventListener('click', () => {
    block.dataset.chartType = 'bar-pair';
    window.renderGraph(block);
    showGraphProperties(block);
  });

  // bar-pair: 시리즈명 + 색상 B
  const seriesA = document.getElementById('grb-series-a');
  const seriesB = document.getElementById('grb-series-b');
  if (seriesA) seriesA.addEventListener('input', () => { block.dataset.seriesA = seriesA.value; window.renderGraph(block); });
  if (seriesA) seriesA.addEventListener('change', () => window.pushHistory());
  if (seriesB) seriesB.addEventListener('input', () => { block.dataset.seriesB = seriesB.value; window.renderGraph(block); });
  if (seriesB) seriesB.addEventListener('change', () => window.pushHistory());
  if (document.getElementById('grb-bar2-color')) {
    _wireGraphColor('grb-bar2', { unset: !_bar2Shown,
      initialAlpha: parseAlphaFromColor(_bar2Shown),
      onApply: (c) => { block.dataset.barColor2 = c; window.renderGraph(block); },
      onCommit: () => window.pushHistory(),
    });
  }

  // line: 곡선(스무드) 토글
  const smoothToggle = document.getElementById('grb-smooth-toggle');
  if (smoothToggle) {
    smoothToggle.addEventListener('change', () => {
      block.dataset.lineSmooth = smoothToggle.checked ? '1' : '0';
      window.renderGraph(block);
      window.pushHistory();
    });
  }

  // 프리셋
  presets.forEach(p => {
    document.getElementById('grb-preset-' + p.id).addEventListener('click', () => {
      block.dataset.preset = p.id;
      window.renderGraph(block);  // 차트도 갱신
      showGraphProperties(block);
    });
  });

  // 데이터 편집
  function syncItems() {
    const list = document.getElementById('grb-data-list');
    if (!list) return;
    const prevItems = JSON.parse(block.dataset.items || '[]');
    const newItems = [...list.querySelectorAll('.grb-data-item')].map((row, i) => {
      const it = {
        label: row.querySelector('.grb-data-label-input').value || '',
        value: parseFloat(row.querySelector('.grb-data-val-input').value) || 0,
      };
      // bar-pair 2번째 시리즈 — 입력이 없으면(타 차트 타입) 기존 value2 보존해 데이터 유실 방지
      const v2El = row.querySelector('.grb-data-val2-input');
      if (v2El) it.value2 = parseFloat(v2El.value) || 0;
      else if (prevItems[i] && prevItems[i].value2 !== undefined) it.value2 = prevItems[i].value2;
      // 바 개별색 — ★GR1: 색은 «모델에서만» 보존한다. 예전엔 목록의 아무 입력(라벨·값)에나 모든 항목 색을 picker.value(hex)에서
      //   다시 읽어, 그라데이션 항목이 라벨 한 글자에 #000000 이 됐다(GR-DESIGN 실측). 색을 바꾸는 길은 wireColorField 의
      //   onApply/onGradient «하나»(아래 _wireItemColor)다.
      if (prevItems[i] && prevItems[i].color) it.color = prevItems[i].color;
      return it;
    });
    block.dataset.items = JSON.stringify(newItems);
    window.renderGraph(block);
  }

  const dataList = document.getElementById('grb-data-list');
  // GR1 — 항목 색 칸 배선. 쓰는 길은 여기 «하나»: 단색 onApply · 그라데이션 onGradient → items[i].color → 렌더.
  //   미지정(체커) 표시는 처음 고를 때 걷는다(.swatch-none 의 !important 배경이 고른 색을 가리므로).
  const _wireItemColor = (i) => {
    const pre = 'grb-data-color-' + i;
    const cur = (JSON.parse(block.dataset.items || '[]')[i] || {}).color || '';
    const swatch = document.getElementById(pre + '-color')?.closest('.prop-color-swatch');
    const hexEl = document.getElementById(pre + '-hex');
    if (!cur) { swatch?.classList.add('swatch-none'); if (hexEl) hexEl.value = ''; }
    const setColor = (c) => {
      const its = JSON.parse(block.dataset.items || '[]');
      if (!its[i]) return;
      its[i].color = c;
      block.dataset.items = JSON.stringify(its);
      swatch?.classList.remove('swatch-none');
      window.renderGraph(block);
    };
    wireColorField(pre, {
      initialAlpha: cur && !_isGrad(cur) ? parseAlphaFromColor(cur) : 100,
      onApply: (c) => setColor(c),
      onGradient: (css, commit) => { setColor(css); if (commit) window.pushHistory(); },
      gradientValue: _isGrad(cur) ? cur : '',
      onCommit: () => window.pushHistory(),
    });
  };
  if (chartType === 'bar-v' || chartType === 'bar-h') items.forEach((_, i) => _wireItemColor(i));
  dataList.addEventListener('input', syncItems);
  dataList.addEventListener('click', e => {
    const btn = e.target.closest('.grb-data-del-btn');
    if (!btn) return;
    const curItems = JSON.parse(block.dataset.items || '[]');
    if (curItems.length <= 1) return;
    curItems.splice(parseInt(btn.dataset.index), 1);
    block.dataset.items = JSON.stringify(curItems);
    window.renderGraph(block);
    showGraphProperties(block);
  });

  document.getElementById('grb-add-item').addEventListener('click', () => {
    const curItems = JSON.parse(block.dataset.items || '[]');
    curItems.push({ label: '항목 ' + (curItems.length + 1), value: 50 });
    block.dataset.items = JSON.stringify(curItems);
    window.renderGraph(block);
    showGraphProperties(block);
  });

  // 차트 높이
  const hSlider = document.getElementById('grb-h-slider');
  const hNumber = document.getElementById('grb-h-number');
  const applyChartH = v => {
    v = Math.min(2000, Math.max(80, v));
    block.dataset.chartHeight = v;
    window.renderGraph(block);
    hSlider.value = v; hNumber.value = v;
  };
  hSlider.addEventListener('input',  () => applyChartH(parseInt(hSlider.value)));
  hNumber.addEventListener('change', () => { applyChartH(parseInt(hNumber.value)); window.pushHistory(); });
  hSlider.addEventListener('change', () => window.pushHistory());

  // 항목 간격 (bar-h·bar-v·bar-pair)
  const igSlider = document.getElementById('grb-item-gap-slider');
  const igNumber = document.getElementById('grb-item-gap-number');
  if (igSlider) {
    const applyItemGap = v => {
      v = Math.min(80, Math.max(8, v));
      block.dataset[_vKey('itemGap','vItemGap')] = v;
      window.renderGraph(block);
      igSlider.value = v; igNumber.value = v;
    };
    igSlider.addEventListener('input',  () => applyItemGap(parseInt(igSlider.value)));
    igNumber.addEventListener('change', () => { applyItemGap(parseInt(igNumber.value)); window.pushHistory(); });
    igSlider.addEventListener('change', () => window.pushHistory());
  }

  // 숫자 크기 (bar-h·bar-v·bar-pair)
  const psSlider = document.getElementById('grb-pct-size-slider');
  const psNumber = document.getElementById('grb-pct-size-number');
  if (psSlider) {
    const applyPctSize = v => {
      v = Math.min(120, Math.max((block.dataset.chartType === 'bar-h' ? 20 : 8), v));
      block.dataset[_vKey('pctSize','vPctSize')] = v;
      window.renderGraph(block);
      psSlider.value = v; psNumber.value = v;
    };
    psSlider.addEventListener('input',  () => applyPctSize(parseInt(psSlider.value)));
    psNumber.addEventListener('change', () => { applyPctSize(parseInt(psNumber.value)); window.pushHistory(); });
    psSlider.addEventListener('change', () => window.pushHistory());
  }

  // 바 두께 (bar-h·bar-v·bar-pair)
  const btSlider = document.getElementById('grb-bar-thickness-slider');
  const btNumber = document.getElementById('grb-bar-thickness-number');
  if (btSlider) {
    const applyBarThickness = v => {
      v = Math.min(_thkMax, Math.max(BAR_THICKNESS_MIN, v));   // H1 — 세로·비교는 칸 폭까지(가로는 60)
      block.dataset[_vKey('barThickness','vBarThickness')] = v;
      window.renderGraph(block);
      btSlider.value = v; btNumber.value = v;
    };
    btSlider.addEventListener('input',  () => applyBarThickness(parseInt(btSlider.value)));
    btNumber.addEventListener('change', () => { applyBarThickness(parseInt(btNumber.value)); window.pushHistory(); });
    btSlider.addEventListener('change', () => window.pushHistory());
  }

  // 좌우 패딩 (bar-h·bar-v·bar-pair)
  const pxSlider = document.getElementById('grb-padx-slider');
  const pxNumber = document.getElementById('grb-padx-number');
  if (pxSlider) {
    const applyPadX = v => {
      v = Math.min(80, Math.max(0, v));
      block.dataset[_vKey('padX','vPadX')] = v;
      window.renderGraph(block);
      pxSlider.value = v; pxNumber.value = v;
    };
    pxSlider.addEventListener('input',  () => applyPadX(parseInt(pxSlider.value)));
    pxNumber.addEventListener('change', () => { applyPadX(parseInt(pxNumber.value)); window.pushHistory(); });
    pxSlider.addEventListener('change', () => window.pushHistory());
  }

  // 색상 — line 차트는 선 색상(lineColor)에, bar 차트는 막대 색상(barColor)에 적용
  if (document.getElementById('grb-bar-color')) {
    _wireGraphColor('grb-bar', { unset: !(chartType === 'bar-v' ? _barSetColor : barColor),
      initialAlpha: chartType === 'bar-v' ? parseAlphaFromColor(_barSetColor) : barAlpha,
      onApply: (c) => {
        if (block.dataset.chartType === 'line') block.dataset.lineColor = c;
        else if (block.dataset.chartType === 'bar-v') block.dataset.vBarColor = c;
        else block.dataset.barColor = c;
        window.renderGraph(block);
      },
      onCommit: () => window.pushHistory(),
    });
  }

  // 선 두께 (line 전용)
  const swSlider = document.getElementById('grb-stroke-slider');
  const swNumber = document.getElementById('grb-stroke-number');
  if (swSlider) {
    const applyStroke = v => {
      v = Math.min(12, Math.max(1, v));
      block.dataset.strokeWidth = v;
      window.renderGraph(block);
      swSlider.value = v; swNumber.value = v;
    };
    swSlider.addEventListener('input',  () => applyStroke(parseInt(swSlider.value)));
    swNumber.addEventListener('change', () => { applyStroke(parseInt(swNumber.value)); window.pushHistory(); });
    swSlider.addEventListener('change', () => window.pushHistory());
  }

  // 점 크기 (line 전용)
  const ptSlider = document.getElementById('grb-point-slider');
  const ptNumber = document.getElementById('grb-point-number');
  if (ptSlider) {
    const applyPoint = v => {
      v = Math.min(16, Math.max(0, v));
      block.dataset.pointRadius = v;
      window.renderGraph(block);
      ptSlider.value = v; ptNumber.value = v;
    };
    ptSlider.addEventListener('input',  () => applyPoint(parseInt(ptSlider.value)));
    ptNumber.addEventListener('change', () => { applyPoint(parseInt(ptNumber.value)); window.pushHistory(); });
    ptSlider.addEventListener('change', () => window.pushHistory());
  }

  // K6: 점 모양 (line 전용) — 채움 = 키 없음(종전 바이트 그대로) · 속빈 = dataset.pointStyle 'hollow' (구멍 색은 canvas-contrast syncGraphTone)
  const ptStyleSel = document.getElementById('grb-pointstyle-select');
  if (ptStyleSel) {
    ptStyleSel.addEventListener('change', () => {
      if (ptStyleSel.value === 'hollow') block.dataset.pointStyle = 'hollow';
      else delete block.dataset.pointStyle;
      window.renderGraph(block);
      window.pushHistory();
    });
  }

  // T10: 면 채우기 토글 + 색상 + 알파 (line 전용)
  const fillToggle  = document.getElementById('grb-fillarea-toggle');
  const fillRow     = document.getElementById('grb-fillalpha-row');
  const fillColorRow = document.getElementById('grb-fillcolor-row');
  if (fillToggle) {
    fillToggle.addEventListener('change', () => {
      const on = fillToggle.checked;
      block.dataset.fillArea = on ? '1' : '0';
      if (fillRow) fillRow.style.display = on ? 'flex' : 'none';
      if (fillColorRow) fillColorRow.style.display = on ? 'flex' : 'none';
      window.renderGraph(block);
      window.pushHistory();
      /* E149 — 면은 켜야 그려진다 → 그 전엔 칸이 읽을 «그려진 면»이 없었다. 데이터 색이 없으면 켠 뒤 패널을 다시 열어 칸을 그려진 면 색으로. */
      if (on && !block.dataset.fillColor && !block.dataset.barColor) showGraphProperties(block);
    });
  }
  // 면 색상 picker
  if (document.getElementById('grb-fill-color')) {
    _wireGraphColor('grb-fill', { unset: !fillColor,
      initialAlpha: fillColorAlpha,
      onApply: (c) => { block.dataset.fillColor = c; window.renderGraph(block); },
      onCommit: () => window.pushHistory(),
    });
  }
  const faSlider = document.getElementById('grb-fillalpha-slider');
  const faNumber = document.getElementById('grb-fillalpha-number');
  if (faSlider) {
    const applyAlpha = v => {
      v = Math.min(100, Math.max(0, v));
      block.dataset.fillAlpha = (v / 100).toFixed(2);
      window.renderGraph(block);
      faSlider.value = v; faNumber.value = v;
    };
    faSlider.addEventListener('input',  () => applyAlpha(parseInt(faSlider.value)));
    faNumber.addEventListener('change', () => { applyAlpha(parseInt(faNumber.value)); window.pushHistory(); });
    faSlider.addEventListener('change', () => window.pushHistory());
  }

  // 라벨 크기
  const lSlider = document.getElementById('grb-label-slider');
  const lNumber = document.getElementById('grb-label-number');
  const applyLabelSize = v => {
    v = Math.min(28, Math.max(8, v));
    block.dataset.labelSize = v;
    window.renderGraph(block);
    lSlider.value = v; lNumber.value = v;
  };
  lSlider.addEventListener('input',  () => applyLabelSize(parseInt(lSlider.value)));
  lNumber.addEventListener('change', () => { applyLabelSize(parseInt(lNumber.value)); window.pushHistory(); });
  lSlider.addEventListener('change', () => window.pushHistory());

  // 라벨 색상
  if (document.getElementById('grb-vlabel-color')) {
    _wireGraphColor('grb-vlabel', { unset: !_vlabelShown,
      initialAlpha: parseAlphaFromColor(_vlabelShown),
      onApply: (c) => { block.dataset.vlabelColor = c; window.renderGraph(block); },
      onCommit: () => window.pushHistory(),
    });
  }
  if (document.getElementById('grb-xlabel-color')) {
    _wireGraphColor('grb-xlabel', { unset: !_xlabelShown,
      initialAlpha: parseAlphaFromColor(_xlabelShown),
      onApply: (c) => { block.dataset.xlabelColor = c; window.renderGraph(block); },
      onCommit: () => window.pushHistory(),
    });
  }
  if (document.getElementById('grb-label-color')) {
    _wireGraphColor('grb-label', { unset: _labelUnset, mixed: _lblShown.mixed && !block.dataset.labelColor,
      initialAlpha: labelAlpha,
      onApply: (c) => { block.dataset.labelColor = c; window.renderGraph(block); },
      onCommit: () => window.pushHistory(),
    });
  }

  // 값 라벨 표시 toggle
  const showVL = document.getElementById('grb-show-vlabel');
  if (showVL) {
    showVL.addEventListener('change', () => {
      block.dataset.showVLabel = showVL.checked ? '1' : '0';
      window.renderGraph(block);
      window.pushHistory();
    });
  }
  // H7 — 격자선 색(bar-v). 고르는 순간에만 키가 생긴다(안 고르면 옛 꼴 그대로).
  if (document.getElementById('grb-grid-color')) {
    _wireGraphColor('grb-grid', { unset: !_gridColorShown(block).c,
      initialAlpha: _gridColorShown(block).a,
      onApply: (c) => { block.dataset.gridColor = c; window.renderGraph(block); },
      onCommit: () => window.pushHistory(),
    });
  }
  // GR2·GR3 — 축·격자선·꺾은선 토글(bar-v). 켜면 '1', 끄면 키 삭제.
  GR_OVERLAY_TOGGLES.forEach(t => {
    const el = document.getElementById(t.id);
    if (!el) return;
    el.addEventListener('change', () => {
      if (el.checked) block.dataset[t.key] = '1'; else delete block.dataset[t.key];
      window.renderGraph(block);
      window.pushHistory();
    });
  });
  // 카테고리 라벨 표시 toggle
  const showXL = document.getElementById('grb-show-xlabel');
  if (showXL) {
    showXL.addEventListener('change', () => {
      block.dataset.showXLabel = showXL.checked ? '1' : '0';
      window.renderGraph(block);
      window.pushHistory();
    });
  }
}


window.showGraphProperties = showGraphProperties;

/* ⒥⒝(지디 2026-10-05) — 카테고리 라벨 편집(K8⒤ 더블클릭)에 들어가면 패널의 «기존» 두 줄(라벨 크기 · 카테고리 색상)로 데려간다.
 *   새 절 0 · 새 키 0 · 옮김 0. 강조 = 섹션 검색 «깜빡임»(ss-flash-pulse 0.7s ×3)과 같은 박자 · 선택 채움 토큰 --sel-color-fill.
 *   park = 패널로 가는 blur 면 편집을 세운다(drag-utils 는 _text-selection 을 직접 import 하지 않는다 — 모듈 하네스가 drag-utils 의 named import 를 404 로 준다). */
function _revealGraphLabelRows() {
  const rows = ['grb-label-slider', 'grb-xlabel-color'].map(id => document.getElementById(id)?.closest('.prop-row')).filter(Boolean);
  if (!rows.length) return;
  rows[0].scrollIntoView({ block: 'nearest' });
  const fill = getComputedStyle(document.documentElement).getPropertyValue('--sel-color-fill').trim() || 'rgba(74, 158, 255, 0.12)';
  rows.forEach(r => r.animate?.([{ backgroundColor: 'transparent' }, { backgroundColor: fill, offset: 0.4 }, { backgroundColor: fill, offset: 0.7 }, { backgroundColor: 'transparent' }], { duration: 700, iterations: 3, easing: 'ease-in-out' }));
}
window.__grbLabelEdit = {
  reveal: _revealGraphLabelRows,
  park(ev, host, end, flush) { if (!isBlurIntoPanel(ev)) return false; parkEditing(host, end, { flush }); return true; },
};

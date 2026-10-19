import '../graph-limits.js';   // side-effect import — window.GRAPH_LIMITS 를 «이 모듈보다 먼저» 싣는다(하네스·앱 같은 길, 로드 순서 의존 없음)
import { propPanel, state } from '../globals.js';
import { blockHeaderHTML, escHtml } from './_helpers.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor, swatchHex } from './color-picker.js';
import { isBlurIntoPanel, parkEditing } from './_text-selection.js';
import { graphFieldShown } from '../canvas-contrast.js';   // E149 — 색 칸 «보일 값»의 한 자리
import '../graph-radial.js';   // 프로토 Z6-B — 「방사형」 유형의 렌더 · 패널 절(window.renderGraphRadial · graphRadialSectionHTML · wireGraphRadialSection)
import { FX_SHADOW_DEFAULTS, FX_SHADOW_RANGES } from '../effects-shadow.js';   // 1017t1f4 — 그림자 x/y/blur 값·범위의 임자(⛔새 수 0 — 그 쪽을 그대로 읽는다)

const { BAR_THICKNESS_MIN, BAR_THICKNESS_MAX, BAR_THICKNESS_DEFAULT, BAR_THICKNESS_V_MAX, LABEL_SIZE_DEFAULT, LABEL_SIZE_MIN, LINE_PADX_DEFAULT, PCT_SIZE_FACTOR, PIE_HOLE_MIN, PIE_HOLE_MAX, PIE_HOLE_DEFAULT, PIE_GAP, PIE_GAP_MIN, PIE_GAP_MAX, PIE_START_MIN, PIE_START_MAX, PIE_GROW_MAX, PIE_PULL_MAX, PIE_LEG_GAP_MIN, PIE_LEG_GAP_MAX, PIE_LEG_GAP_DEFAULT, SHAPE_SVG_MAX, SHAPE_FILL_MAX_DEFAULT, SHAPE_TRACK_OPACITY } = window.GRAPH_LIMITS;   // js/graph-limits.js — 두께 한계의 한 자리

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

/* 1012t1G2 — hideThickness: 모양(실루엣)이 켜지면 «두께» 줄을 뺀다(폭은 실루엣의 비가 정한다 — 두께 키는 안 지운다). */
function barSettingsHTML({ chartType, barThickness, thicknessMax = BAR_THICKNESS_MAX, padX, itemGap, pctSize, pctMin, barColor, barAlpha, overlayToggles = '', hideThickness = false }) {
  return `
    <div class="prop-section">
      <div class="prop-section-title">Bar Settings</div>${hideThickness ? '' : `
      <div class="prop-row">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="grb-bar-thickness-slider" min="${BAR_THICKNESS_MIN}" max="${thicknessMax}" step="2" value="${barThickness}">
        <input type="number" class="prop-number" id="grb-bar-thickness-number" min="${BAR_THICKNESS_MIN}" max="${thicknessMax}" value="${barThickness}">
      </div>`}
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
/* 1012t1G1 — solidOnly(원형·도넛 조각): 단색 전용. 막대에서 넘어온 그라데이션 item.color 는 «미지정»으로 보인다(렌더 _renderPie 와 같은 판정 · 모델은 안 지운다). */
function itemColorFieldHTML(item, i, { solidOnly = false, idPrefix = 'grb-data-color-' + i, title = '' } = {}) {
  const c = (solidOnly && _isGrad(item.color)) ? '' : (item.color || '');
  return `<div class="grb-data-color" title="${title || (solidOnly ? '조각 색상 (미지정 시 프리셋 색)' : '바 색상 (미지정 시 프리셋 색 · 그라데이션은 막대마다 따로)')}">${colorFieldHTML({
    idPrefix,
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

/* 1012t1G1 — 그래프 유형 표 «한 자리»: 버튼(마크업)과 배선(클릭)이 같은 표를 돈다. 새 유형은 여기 한 줄 + drag-utils.js GRAPH_RENDERERS 한 줄.
 * 기존 넷의 id 는 그대로(검사·자동화가 id 로 누른다). 버튼은 3칸 두 줄 — 기존 «프리셋 버튼이 섞인 유형 그룹» 그리드를 탄다(prop-asset 6버튼과 같은 꼴 · 새 CSS 0줄). */
const GRAPH_TYPES = [
  { type: 'bar-v',    id: 'grb-type-v',     label: '세로 막대' },
  { type: 'bar-h',    id: 'grb-type-h',     label: '가로 막대' },
  { type: 'line',     id: 'grb-type-line',  label: '꺾은선' },
  { type: 'bar-pair', id: 'grb-type-pair',  label: '비교 막대' },
  { type: 'pie',      id: 'grb-type-pie',   label: '원형' },
  { type: 'radial',   id: 'grb-type-radial', label: '방사형' },   // 프로토 Z6-B — 그리는 것 · 패널 절은 js/graph-radial.js
];
/* 1013t1C1 — 유형 버튼은 ★여섯(「원형」 하나 ＋ ★261020 `b8055ada` 방사형 이식으로 +1). 도넛은 Pie Settings 의 「도너츠」 토글(dataset.pieDonut '1' · 끄면 키 삭제)이다.
 * 옛 유형 'donut' 은 «읽을 때» 영구 별칭 — 열기·패널 열기·다른 칸 조작은 chartType 을 안 건드린다(옛 저장본 바이트 무변).
 *   'donut' 을 'pie' + pieDonut 로 옮겨 쓰는 자리는 둘뿐: 유형 버튼 클릭 · 도너츠 토글. */
const _isPieType = (t) => t === 'pie' || t === 'donut';
const _isDonut = (ds) => ds.chartType === 'donut' || (ds.chartType === 'pie' && ds.pieDonut === '1');   // 렌더(drag-utils.js _renderPie)와 같은 뜻

/* 1012t1G2 — Shape 절(세로 막대 전용): 막대를 SVG 실루엣으로. 쓰는 길은 window.setGraphShape «하나»(js/graph-shape.js — 소독·한도·키 삭제가 거기 산다).
 * 목록 = 기본 막대 + 내장 실루엣(GRAPH_SHAPE_PRESETS 표 그대로) + 사용자 SVG. 파일은 숨은 input 하나를 블럭 모양·항목 모양이 같이 쓴다. */
const SHAPE_FAIL_TOAST = { TOO_LARGE: '⚠️ SVG가 너무 큽니다', NOT_SVG: '⚠️ 유효한 SVG가 아닙니다', EMPTY: '⚠️ 그릴 도형이 없는 SVG입니다', NO_SIZE: '⚠️ SVG에 크기(viewBox)가 없습니다', TOO_COMPLEX: '⚠️ SVG가 너무 복잡합니다(겹쳐 쓴 use)' };
/* 항목 줄의 작은 버튼 아이콘 — 블럭 헤더 아이콘과 같은 꼴(12 격자 · 선 1.3 · 채움 없음) */
const ITEM_SHAPE_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8V2M3.5 4.5 6 2l2.5 2.5M2 10h8"/></svg>';
/* 1013t1C4 — 원형 «조각 고르기»의 패널 쪽. 고른 조각 = 캔버스 표식 하나(drag-utils.js grbPieSelected — 패널은 따로 안 든다).
 *   · Data 절 항목 줄의 작은 버튼(.grb-data-icon-btn[data-slice-index]) = 그 조각 고르기/풀기(캔버스에서 조각을 누르는 것과 같은 일).
 *   · Slice 절 = 고른 조각이 있을 때만 Pie Settings 뒤에. 머리 줄 「n번 · 라벨」 + 조각별 설정 줄(pieSliceRowsHTML — 「크기」 · 뒤로 밀어내기 · 라벨이 여기 붙는다).
 *   패널 쪽 클래스 이름에 selected 를 쓰지 않는다(켜짐 = 기존 .active) — 선택 마커 센서스가 캔버스 마커만 세게. */
const ITEM_SLICE_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="4.5"/><path d="M6 1.5V6l3.2 3.2"/></svg>';
const _sliceName = (items, i) => `${i + 1}번 · ${(items[i] && items[i].label) || ''}`;
/* 조각(항목) 수준 키 — items[i] 에 산다. 패널이 항목을 다시 짤 때(syncItems) 모델에서 옮겨 보존한다(graph-shape.js carryItemExtras 도 같은 셋을 옮긴다). */
const PIE_ITEM_KEYS = ['pieGrow', 'piePull', 'pieTag'];
const _slicePct = (v, hi) => { const n = parseInt(v); return Number.isFinite(n) ? Math.min(hi, Math.max(0, n)) : 0; };   // 렌더(_renderPie)와 «같은 식»
function pieSliceRowsHTML(item) {   // 조각별 설정 줄 — 줄을 더하면 아래 배선(_wireSliceInt)도 한 줄
  const grow = _slicePct(item.pieGrow, PIE_GROW_MAX);
  const pull = _slicePct(item.piePull, PIE_PULL_MAX);
  const tag = (item.pieTag === 'on' || item.pieTag === 'off') ? item.pieTag : '';
  const tagOpt = (v, label) => `<option value="${v}" ${tag === v ? 'selected' : ''}>${label}</option>`;
  return `
      <div class="prop-row" title="이 조각만 바깥으로 키운다(바깥 반지름 대비 %)">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="grb-pie-grow-slider" min="0" max="${PIE_GROW_MAX}" step="1" value="${grow}">
        <input type="number" class="prop-number" id="grb-pie-grow-number" min="0" max="${PIE_GROW_MAX}" value="${grow}">
      </div>
      <div class="prop-row" title="이 조각만 중심에서 바깥으로 밀어낸다(바깥 반지름 대비 %)">
        <span class="prop-label">밀어내기</span>
        <input type="range" class="prop-slider" id="grb-pie-pull-slider" min="0" max="${PIE_PULL_MAX}" step="1" value="${pull}">
        <input type="number" class="prop-number" id="grb-pie-pull-number" min="0" max="${PIE_PULL_MAX}" value="${pull}">
      </div>
      <div class="prop-row" title="이 조각 안의 순위·이름 라벨. 자동 = 조각이 넉넉할 때만 보인다(Pie Settings 의 순위·이름 표시가 켜져 있어야 한다)">
        <span class="prop-label">라벨</span>
        <select class="prop-select" id="grb-pie-tag-select">
          ${tagOpt('', '자동')}${tagOpt('on', '항상')}${tagOpt('off', '숨김')}
        </select>
      </div>`;
}
/* 1013t1C7 — Shadow 절(원형 전용): 없음 / 부드럽게 / 강하게. 모달(prop-modal.js mdl-drop-group)·확대블럭과 같은 꼴 · 같은 키(dataset.dropShadow).
 *   칠하는 일은 CSS 가 한다(css/editor-graph.css `.graph-block[data-drop-shadow] .grb-pie-svg`) — 여기는 키만 쓴다. 없음 = 키 삭제(안 만진 블럭과 같은 꼴). */
const PIE_DROP_OPTS = [['none', '없음'], ['soft', '부드럽게'], ['strong', '강하게']];
const _pieDropOf = (ds) => (ds.dropShadow === 'soft' || ds.dropShadow === 'strong') ? ds.dropShadow : 'none';
/* 1017t1f4 — 그림자 세기(soft/strong) 위에 x/y/blur/색상을 더 얹는다. x/y/blur 값·범위 = js/effects-shadow.js FX_SHADOW_DEFAULTS/RANGES 그대로(⛔새 수 0).
   색상은 colorFieldHTML/wireColorField(알파 내장 — 새 「불투명도」 글자 0) 로 배선한다 — 키가 없을 때 보일 기본값은 지금 켠 세기의 틴트
   (soft 0.25 · strong 0.55 · css/editor-graph.css:310-311 과 같은 수)라 오버레이를 처음 켜도 그림이 안 튄다. */
const PIE_SH_PRESET_ALPHA = { soft: 0.25, strong: 0.55 };
const _pieShOf = (ds) => {
  const preset = _pieDropOf(ds);
  const a0 = PIE_SH_PRESET_ALPHA[preset] ?? 0.25;
  const curColor = ds.pieShadowColor || `rgba(0,0,0,${a0})`;
  return {
    x: (n => Number.isFinite(n) ? Math.min(FX_SHADOW_RANGES.x[1], Math.max(FX_SHADOW_RANGES.x[0], n)) : FX_SHADOW_DEFAULTS.x)(parseInt(ds.pieShadowX)),
    y: (n => Number.isFinite(n) ? Math.min(FX_SHADOW_RANGES.y[1], Math.max(FX_SHADOW_RANGES.y[0], n)) : FX_SHADOW_DEFAULTS.y)(parseInt(ds.pieShadowY)),
    blur: (n => Number.isFinite(n) ? Math.min(FX_SHADOW_RANGES.blur[1], Math.max(FX_SHADOW_RANGES.blur[0], n)) : FX_SHADOW_DEFAULTS.blur)(parseInt(ds.pieShadowBlur)),
    color: swatchHex(curColor, FX_SHADOW_DEFAULTS.color),
    alpha: ds.pieShadowColor ? parseAlphaFromColor(curColor) : Math.round(a0 * 100),
  };
};
function pieShadowSectionHTML(ds) {
  const cur = _pieDropOf(ds);
  const sh = _pieShOf(ds);
  return `
    <div class="prop-section">
      <div class="prop-section-title">Shadow</div>
      <div class="prop-row">
        <span class="prop-label">그림자</span>
        <div class="prop-align-group" id="grb-drop-group">
          ${PIE_DROP_OPTS.map(([v, label]) => `<button class="prop-align-btn${cur === v ? ' active' : ''}" data-val="${v}">${label}</button>`).join('\n          ')}
        </div>
      </div>${cur !== 'none' ? `
      <div class="prop-row">
        <span class="prop-label">X</span>
        <input type="range" class="prop-slider" id="grb-pie-sh-x-slider" min="${FX_SHADOW_RANGES.x[0]}" max="${FX_SHADOW_RANGES.x[1]}" step="1" value="${sh.x}">
        <input type="number" class="prop-number" id="grb-pie-sh-x-number" min="${FX_SHADOW_RANGES.x[0]}" max="${FX_SHADOW_RANGES.x[1]}" value="${sh.x}">
      </div>
      <div class="prop-row">
        <span class="prop-label">Y</span>
        <input type="range" class="prop-slider" id="grb-pie-sh-y-slider" min="${FX_SHADOW_RANGES.y[0]}" max="${FX_SHADOW_RANGES.y[1]}" step="1" value="${sh.y}">
        <input type="number" class="prop-number" id="grb-pie-sh-y-number" min="${FX_SHADOW_RANGES.y[0]}" max="${FX_SHADOW_RANGES.y[1]}" value="${sh.y}">
      </div>
      <div class="prop-row">
        <span class="prop-label">Blur</span>
        <input type="range" class="prop-slider" id="grb-pie-sh-blur-slider" min="${FX_SHADOW_RANGES.blur[0]}" max="${FX_SHADOW_RANGES.blur[1]}" step="1" value="${sh.blur}">
        <input type="number" class="prop-number" id="grb-pie-sh-blur-number" min="${FX_SHADOW_RANGES.blur[0]}" max="${FX_SHADOW_RANGES.blur[1]}" value="${sh.blur}">
      </div>
      <div class="prop-row">
        <span class="prop-label">색상</span>
        ${colorFieldHTML({ idPrefix: 'grb-pie-sh', hex: sh.color, alpha: sh.alpha })}
      </div>` : ''}
    </div>`;
}
/* 1013t1C4 고침 2 — 조각 표식이 걷혔는데 패널이 다시 안 그려지는 길(같은 블럭을 ⌘클릭해 푼 때 — editor.js toggleBlockSelect 의 해제 가지는 어느 블럭 종류든 패널을 그대로 둔다)에서
 *   Slice 절이 남아 «풀린 블럭»에 썼다. 두 겹으로 막는다:
 *   ① 걷기 — 표식을 걷는 자(toggleBlockSelect)가 window.grbPieDropSlicePanel() 을 부른다: Slice 절을 지우고 데이터 줄의 조각 버튼을 끈다(패널의 나머지는 안 건드린다).
 *   ② 쓰기 가드 — Slice 절의 칸(크기 · 밀어내기 · 라벨)은 쓰기 전에 «그 조각이 지금도 고른 조각인가»(grbPieSelected(block) === 색인 · 블럭이 문서에 붙어 있다)를 본다.
 *      아니면 절을 걷고 아무것도 안 쓴다(히스토리도 안 찍는다) — 표식이 걷히는 다른 길이 생겨도 여기서 걸린다. */
function dropPieSlicePanel() {
  document.getElementById('grb-pie-slice-section')?.remove();
  document.querySelectorAll('#grb-data-list .grb-data-icon-btn[data-slice-index].active').forEach(b => { b.classList.remove('active'); b.title = '이 조각 고르기(조각별 설정)'; });
}
const _pieSliceLive = (block, i) => !!block && block.isConnected && i >= 0 && window.grbPieSelected?.(block) === i;
/* 1013t1C4 고침 2 — 그려지는 조각이 «하나»(온 원)면 「크기」·「밀어내기」는 그림에 안 먹는다(렌더가 온 원은 안 키우고 안 민다 — graph-pie-geom.js piePaths).
 *   ⇒ 두 줄의 칸을 비활성으로(이웃 패널의 disabled 꼴 — prop-modal.js 의 폭·높이 칸) + 안내 한 줄(기존 prop-hint). 값은 안 지운다(조각이 다시 여럿이 되면 그대로 먹는다).
 *   판정 = 렌더와 같은 기하(piePaths 의 shares): 값 > 0 인 조각이 고른 조각 하나뿐. 패널을 그린 뒤와 항목 값을 칠 때마다 부른다(패널을 다시 안 그린다). */
const PIE_SOLO_HINT = '조각이 하나라 적용되지 않음';
function _syncPieSliceSolo(items, sel) {
  const sec = document.getElementById('grb-pie-slice-section');
  if (!sec || !(sel >= 0)) return;
  const shares = window.GRAPH_PIE_GEOM?.piePaths?.((Array.isArray(items) ? items : []).map(it => it && it.value), 0, 0)?.shares || [];
  const solo = shares[sel] > 0 && shares.filter(v => v > 0).length === 1;
  const els = ['grb-pie-grow-slider', 'grb-pie-grow-number', 'grb-pie-pull-slider', 'grb-pie-pull-number'].map(id => document.getElementById(id)).filter(Boolean);
  els.forEach(el => { if (el.disabled !== solo) el.disabled = solo; });
  let hint = document.getElementById('grb-pie-slice-hint');
  if (!solo) { hint?.remove(); return; }
  const row = document.getElementById('grb-pie-pull-slider')?.closest('.prop-row');
  if (!hint && row) { hint = document.createElement('div'); hint.className = 'prop-hint'; hint.id = 'grb-pie-slice-hint'; hint.textContent = PIE_SOLO_HINT; row.insertAdjacentElement('afterend', hint); }
}
function pieSliceSectionHTML(items, sel) {
  if (!(sel >= 0 && sel < items.length)) return '';
  return `
    <div class="prop-section" id="grb-pie-slice-section" data-slice="${sel}">
      <div class="prop-section-title">Slice</div>
      <div class="prop-row" title="고른 조각 — 아래 설정은 이 조각에만 걸린다">
        <span class="prop-label">조각</span>
        <span class="prop-value-text grb-slice-name" id="grb-pie-slice-name">${escHtml(_sliceName(items, sel))}</span>
      </div>${pieSliceRowsHTML(items[sel] || {})}
    </div>`;
}

/* 1012t1G4 — 마디(막대·실루엣을 비율별로 나눈 조각) 편집 줄. 항목 줄 아래 같은 꼴의 줄(라벨 · 값 · ✕ · 색) + 「+ 마디 추가」.
 * 0번이 맨 아래 마디다. 마디가 있으면 그 항목의 값 칸은 읽기 전용(합) — 합을 쓰는 자는 graph-shape.js segSum 한 곳. 세로 막대에서만 나온다.
 * ★다른 유형(가로·꺾은선·비교·원형)에선 마디 줄도, 읽기 전용도, «합으로 되쓰기»도 없다 — 마디는 모델에 «보존만» 하고 값 칸은 자유롭다.
 *   거기서 값을 확정(change)하면 마디를 그 값에 같은 비율로 맞춘다(값이 이긴다 · carryItemExtras 규칙 그대로). 세로 막대로 돌아올 때 한 번 더 맞춘다(reconcileItems)
 *   ⇒ 세로 막대에선 늘 item.value === 마디 합. 값 0 은 비율을 담을 수 없어 마디를 그대로 두고, 돌아오면 값이 마디 합으로 선다. */
const _segsOf = (item) => (item && Array.isArray(item.segments)) ? item.segments : [];
const _segSum = (segs) => window.GRAPH_SHAPE.segSum(segs);
function segListHTML(item, i) {
  const segs = _segsOf(item);
  return `
          <div class="grb-data-list grb-seg-list" data-item="${i}">
            ${segs.map((sg, j) => `
            <div class="grb-data-item grb-seg-item" data-item="${i}" data-seg="${j}">
              <input type="text" class="grb-data-label-input" value="${escHtml(sg && sg.label)}" placeholder="마디 라벨">
              <input type="number" class="grb-data-val-input" value="${Number(sg && sg.value) || 0}" min="0" max="9999">
              <button class="grb-data-del-btn" data-item="${i}" data-seg="${j}" title="이 마디 지우기">✕</button>
              ${itemColorFieldHTML(sg || {}, j, { solidOnly: true, idPrefix: 'grb-seg-color-' + i + '-' + j, title: '마디 색상 (미지정 시 막대색을 위로 갈수록 옅게)' })}
            </div>`).join('')}
            <button class="prop-btn-full grb-seg-add" data-item="${i}" title="이 항목을 비율별 마디로 나눈다(아래부터 쌓인다)">+ 마디 추가</button>
          </div>`;
}

/* 1012t1G3 — 트랙(안 찬 부분) 색 칸의 «보일 값». 키가 없으면 «지금 그려진» 색 = 채움과 같은 색 · 투명도 = SHAPE_TRACK_OPACITY(렌더 기본 그대로 — 격자선 색 칸과 같은 꼴). */
const FILL_MAX_LIMIT = 9999;   // 항목 값 칸의 위 끝과 같다
function _trackColorShown(block) {
  if (block.dataset.trackColor) return { c: block.dataset.trackColor, a: parseAlphaFromColor(block.dataset.trackColor) };
  return { c: graphFieldShown(block, 'track'), a: Math.round(SHAPE_TRACK_OPACITY * 100) };
}
function shapeSectionHTML(block) {
  const cur = block.dataset.barShape || '';
  const fm = parseFloat(block.dataset.fillMax);
  const tk = _trackColorShown(block);
  const presets = window.GRAPH_SHAPE.GRAPH_SHAPE_PRESETS;
  const opt = (v, label) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${label}</option>`;
  return `
    <div class="prop-section">
      <div class="prop-section-title">Shape</div>
      <div class="prop-row" title="막대를 실루엣으로 바꾼다. 값만큼 아래부터 차오른다">
        <span class="prop-label">모양</span>
        <select class="prop-select" id="grb-shape-select">
          ${opt('', '기본 막대')}${Object.keys(presets).map(k => opt(k, presets[k].label)).join('')}${opt('custom', '사용자 SVG')}
        </select>
      </div>
      <div class="prop-row" title="SVG 파일을 실루엣으로 쓴다(색은 그래프 색을 따른다)">
        <span class="prop-label">파일</span>
        <button class="prop-btn-sm" id="grb-shape-file-btn">SVG 불러오기</button>
        <input type="file" id="grb-shape-file-input" accept=".svg,image/svg+xml" hidden>
      </div>${cur ? `
      <div class="prop-row" title="실루엣이 꽉 차는 값. 비우면 ${SHAPE_FILL_MAX_DEFAULT}">
        <span class="prop-label">최대값</span>
        <input type="number" class="prop-number" id="grb-fillmax-number" min="1" max="${FILL_MAX_LIMIT}" placeholder="${SHAPE_FILL_MAX_DEFAULT}" value="${fm > 0 ? fm : ''}">
      </div>
      <div class="prop-row" title="안 찬 부분의 색(비우면 채움과 같은 색 · 투명도 ${Math.round(SHAPE_TRACK_OPACITY * 100)}%)">
        <span class="prop-label">트랙 색</span>
        ${colorFieldHTML({ idPrefix: 'grb-track', hex: tk.c, alpha: tk.a })}
      </div>` : ''}
    </div>`;
}

/* 1013t1C3 고침 2 — Pie Settings 「이름 표시」 줄 아래의 안내 한 줄: 「좁아서 이름 n개 숨김」. n = 라벨을 잰 쪽(drag-utils.js grbPieFitTags)이 센 수(window.grbPieHiddenNames —
   이름 표시가 켜져 있는데 조각이 좁아 이름이 안 보이는 조각 · 사용자가 「숨김」으로 둔 조각과 값 0 조각은 안 센다). 0 이면 줄 자체가 없다.
   패널이 열린 채 블럭 크기·글자가 바뀌면 재는 쪽이 블럭에서 grb-pie-fit 을 올린다 ⇒ 문서에 건 듣는 자 «하나»가 지금 패널의 블럭일 때만 숫자를 고친다(패널을 다시 그릴 때마다 듣는 자가 쌓이지 않는다). */
let _pieHintBlock = null;
function _syncPieNameHint(block) {
  const row = document.getElementById('grb-pie-name-toggle')?.closest('.prop-row');
  if (!row || !block) return;
  const n = (block.isConnected && block.dataset.pieName === '1') ? (window.grbPieHiddenNames?.(block) || 0) : 0;
  let hint = document.getElementById('grb-pie-name-hint');
  if (!(n > 0)) { hint?.remove(); return; }
  if (!hint) { hint = document.createElement('div'); hint.className = 'prop-hint'; hint.id = 'grb-pie-name-hint'; row.insertAdjacentElement('afterend', hint); }
  const txt = `좁아서 이름 ${n}개 숨김`;
  if (hint.textContent !== txt) hint.textContent = txt;
}
if (typeof document !== 'undefined') document.addEventListener('grb-pie-fit', (e) => {
  const b = _pieHintBlock, t = e.target;
  if (b && t && (t === b || (b.id && t.id === b.id))) _syncPieNameHint(t);
});
export function showGraphProperties(block) {
  const _vKey = (hKey, vKey) => (block.dataset.chartType === 'bar-v' || block.dataset.chartType === 'bar-pair') ? vKey : hKey;
  const chartType    = block.dataset.chartType    || 'bar-v';
  const preset       = block.dataset.preset       || 'default';
  const items        = JSON.parse(block.dataset.items || '[]');
  const chartH       = parseInt(block.dataset.chartHeight)  || (chartType === 'radial' ? 520 : 240);   // 방사형은 키가 없으면 520 으로 그린다(js/graph-radial.js 와 같은 값)
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
    const col = block.querySelector('.grb-shape-wrap') || (f && f.parentElement);   // 마디 쌓기(1012t1G4)에선 막대의 부모가 마디라 칸을 직접 잰다
    const w = col ? Math.floor(col.clientWidth) : 0;
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
  const _isPie       = _isPieType(chartType);
  const _rdHide      = chartType === 'radial' ? ' style="display:none"' : '';   // 프로토 Z6-B — 방사형이 안 쓰는 칸(값 색상 · 값 표시 · Data 값)은 숨긴다. 칸은 DOM 에 남는다(배선 · syncItems 가 읽는다)
  const _donut       = _isDonut(block.dataset);   // 1013t1C1 — 옛 'donut' 또는 'pie' + pieDonut
  const _pieInt      = (raw, lo, hi, dflt) => { const n = parseInt(raw); return Math.min(hi, Math.max(lo, (raw !== undefined && Number.isFinite(n)) ? n : dflt)); };   // 렌더(_renderPie)와 «같은 식» — 키 없음·NaN = 기본
  const pieGap       = _pieInt(block.dataset.pieGap, PIE_GAP_MIN, PIE_GAP_MAX, PIE_GAP);
  const _sliceSel    = _isPie ? (i => (i >= 0 && i < items.length) ? i : -1)(window.grbPieSelected?.(block) ?? -1) : -1;   // 1013t1C4 — 고른 조각(없으면 −1)
  const pieStart     = (s => Number.isFinite(s) ? ((s % 360) + 360) % 360 : 0)(parseInt(block.dataset.pieStart));   // 렌더와 같은 식(360 으로 접는다)
  const _shapeOn     = chartType === 'bar-v' && window.GRAPH_SHAPE.shapeOn(block.dataset);   // 1012t1G2 — 실루엣이 «실제로» 켜졌나(세로 막대에서만 · 모르는 이름은 꺼진 것)
  const _segOn       = chartType === 'bar-v';   // 1012t1G4 — 마디 편집(줄 · 읽기 전용 합 · 합으로 되쓰기)은 세로 막대에서만
  const pieHole      = (h => Math.min(PIE_HOLE_MAX, Math.max(PIE_HOLE_MIN, Number.isFinite(h) ? h : PIE_HOLE_DEFAULT)))(parseInt(block.dataset.pieHole));   // 렌더(drag-utils.js _renderPie)와 «같은 식»
  const pieLegGap    = (g => Number.isFinite(g) ? Math.min(PIE_LEG_GAP_MAX, Math.max(PIE_LEG_GAP_MIN, g)) : PIE_LEG_GAP_DEFAULT)(parseInt(block.dataset.pieLegendGap));   // 1017t1f1

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
        <input type="range" class="prop-slider" id="grb-label-slider" min="${LABEL_SIZE_MIN}" max="28" step="1" value="${labelSize}">
        <input type="number" class="prop-number" id="grb-label-number" min="${LABEL_SIZE_MIN}" max="28" value="${labelSize}">
      </div>
      <div class="prop-row" title="값 라벨(숫자) + 카테고리 라벨 둘 다 일괄 적용. 아래 항목별로 따로 설정 가능">
        <span class="prop-label">라벨 색상</span>
        ${colorFieldHTML({ idPrefix: 'grb-label', hex: labelColor, alpha: labelAlpha })}
      </div>
      <div class="prop-row" title="값 라벨(숫자)만 별도 색상"${_rdHide}>
        <span class="prop-label">값 색상</span>
        ${colorFieldHTML({ idPrefix: 'grb-vlabel', hex: _vlabelShown, alpha: parseAlphaFromColor(_vlabelShown) })}
      </div>
      <!-- ★E103 U27(2026-10-05): 「카테고리 색상」·「카테고리 표시」는 56px 고정 라벨에서 잘렸다(sw60/cw56 실측) — 기존 변형 .prop-label--auto(css/editor-props.css, 「그리드 가이드」 선례)를 쓴다. 전역 56px 은 안 건드린다. -->
      <div class="prop-row" title="카테고리 라벨(7차 입고 등)만 별도 색상">
        <span class="prop-label prop-label--auto">카테고리 색상</span>
        ${colorFieldHTML({ idPrefix: 'grb-xlabel', hex: _xlabelShown, alpha: parseAlphaFromColor(_xlabelShown) })}
      </div>
      <div class="prop-row"${_rdHide}>
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
        ${GRAPH_TYPES.map(t => `<button class="prop-preset-btn prop-type-btn ${(chartType === t.type || (t.type === 'pie' && chartType === 'donut')) ? 'active' : ''}" id="${t.id}">${t.label}</button>`).join('\n        ')}
      </div>
    </div>
    ${chartType === 'bar-v' ? shapeSectionHTML(block) : ''}
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
    ${_isPie ? `
    <div class="prop-section">
      <div class="prop-section-title">Pie Settings</div>
      <div class="prop-row" title="가운데를 뚫어 도너츠 모양으로">
        <span class="prop-label">도너츠</span>
        <label class="prop-toggle">
          <input type="checkbox" id="grb-pie-donut-toggle" ${_donut ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>${_donut ? `
      <div class="prop-row" title="도너츠 가운데 구멍의 크기(바깥 반지름 대비 %)">
        <span class="prop-label">구멍 크기</span>
        <input type="range" class="prop-slider" id="grb-pie-hole-slider" min="${PIE_HOLE_MIN}" max="${PIE_HOLE_MAX}" step="1" value="${pieHole}">
        <input type="number" class="prop-number" id="grb-pie-hole-number" min="${PIE_HOLE_MIN}" max="${PIE_HOLE_MAX}" value="${pieHole}">
      </div>` : ''}
      <div class="prop-row" title="조각 사이 틈의 폭(0 = 맞닿는다)">
        <span class="prop-label">조각 간격</span>
        <input type="range" class="prop-slider" id="grb-pie-gap-slider" min="${PIE_GAP_MIN}" max="${PIE_GAP_MAX}" step="1" value="${pieGap}">
        <input type="number" class="prop-number" id="grb-pie-gap-number" min="${PIE_GAP_MIN}" max="${PIE_GAP_MAX}" value="${pieGap}">
      </div>
      <div class="prop-row" title="첫 조각이 시작하는 각도(12시 = 0 · 시계 방향)">
        <span class="prop-label">시작 각도</span>
        <input type="range" class="prop-slider" id="grb-pie-start-slider" min="${PIE_START_MIN}" max="${PIE_START_MAX}" step="1" value="${pieStart}">
        <input type="number" class="prop-number" id="grb-pie-start-number" min="${PIE_START_MIN}" max="${PIE_START_MAX}" value="${pieStart}">
      </div>
      <div class="prop-row" title="원형과 범례 사이의 간격(px)">
        <span class="prop-label">범례 간격</span>
        <input type="range" class="prop-slider" id="grb-pie-leggap-slider" min="${PIE_LEG_GAP_MIN}" max="${PIE_LEG_GAP_MAX}" step="1" value="${pieLegGap}">
        <input type="number" class="prop-number" id="grb-pie-leggap-number" min="${PIE_LEG_GAP_MIN}" max="${PIE_LEG_GAP_MAX}" value="${pieLegGap}">
      </div>
      <div class="prop-row" title="조각 안에 순위 배지(1위·2위…)를 넣는다. 좁은 조각은 자동으로 숨는다">
        <span class="prop-label">순위 표시</span>
        <label class="prop-toggle">
          <input type="checkbox" id="grb-pie-rank-toggle" ${block.dataset.pieRank === '1' ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div class="prop-row" title="조각 안에 항목 이름을 넣는다. 좁은 조각은 줄을 바꾸고 글자를 줄여 보고, 그래도 안 들면 숨긴다">
        <span class="prop-label">이름 표시</span>
        <label class="prop-toggle">
          <input type="checkbox" id="grb-pie-name-toggle" ${block.dataset.pieName === '1' ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
    </div>${pieSliceSectionHTML(items, _sliceSel)}${pieShadowSectionHTML(block.dataset)}` : ''}
    ${chartType === 'radial' ? (window.graphRadialSectionHTML?.(block) || '') : ''}
    ${(chartType === 'bar-h' || chartType === 'bar-v' || chartType === 'bar-pair') ? barSettingsHTML({ chartType, barThickness, thicknessMax: _thkMax, padX, itemGap, pctSize: barPctSize, pctMin: barPctMin, barColor: _barSetColor, barAlpha: parseAlphaFromColor(_barSetColor), overlayToggles: chartType === 'bar-v' ? overlayTogglesHTML(block) : '', hideThickness: _shapeOn }) : ''}
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
            <input type="text" class="grb-data-label-input" value="${escHtml(item.label)}" placeholder="라벨">
            <input type="number" class="grb-data-val-input" value="${_segOn && _segsOf(item).length ? _segSum(item.segments) : escHtml(item.value)}" min="0" max="9999"${_segOn && _segsOf(item).length ? ' readonly title="마디 값의 합"' : ''}${_rdHide}>
            ${chartType === 'bar-pair' ? `<input type="number" class="grb-data-val-input grb-data-val2-input" value="${escHtml(item.value2 ?? 0)}" min="0" max="9999" title="시리즈 B 값">` : ''}
            <button class="grb-data-del-btn" data-index="${i}">✕</button>
            ${_isPie ? `<button class="grb-data-icon-btn ${_sliceSel === i ? 'active' : ''}" data-slice-index="${i}" title="${_sliceSel === i ? '조각 고르기 풀기' : '이 조각 고르기(조각별 설정)'}">${ITEM_SLICE_ICON}</button>` : ''}
            ${_shapeOn ? `<button class="grb-data-icon-btn ${item.shape ? 'active' : ''}" data-shape-index="${i}" title="${item.shape ? '이 항목만 쓰는 모양 지우기(블럭 모양으로)' : '이 항목만 SVG 불러오기'}">${ITEM_SHAPE_ICON}</button>` : ''}
            ${(chartType === 'bar-v' || chartType === 'bar-h') ? itemColorFieldHTML(item, i) : (_isPie ? itemColorFieldHTML(item, i, { solidOnly: true }) : '')}
          </div>${_segOn ? segListHTML(item, i) : ''}`).join('')}
      </div>
      <button class="prop-btn-full" id="grb-add-item">+ 항목 추가</button>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);
  if (chartType === 'radial') window.wireGraphRadialSection?.(block, () => showGraphProperties(block));   // 프로토 Z6-B

  // 타입 토글 — 유형 표를 돈다(클릭 = 유형 쓰기 → 다시 그리기 → 패널 다시 열기 · 기존 넷과 같은 꼴)
  GRAPH_TYPES.forEach(t => {
    document.getElementById(t.id).addEventListener('click', () => {
      if (block.dataset.chartType === 'donut') block.dataset.pieDonut = '1';   // 1013t1C1 — 옛 도넛이 다른 유형에 갔다 「원형」으로 돌아와도 도넛이다
      block.dataset.chartType = t.type;
      if (t.type === 'bar-v') {   // 1012t1G4 — 다른 유형에서 고친 값과 보존된 마디를 한 규칙으로 맞춘다(바뀔 때만 쓴다 — 마디 없는 블럭은 무변)
        const _raw = block.dataset.items || '[]';
        let _rec = _raw; try { _rec = JSON.stringify(window.GRAPH_SHAPE.reconcileItems(JSON.parse(_raw))); } catch (_) {}
        if (_rec !== _raw) block.dataset.items = _rec;
      }
      window.renderGraph(block);
      showGraphProperties(block);
    });
  });

  // 1012t1G2 — Shape 절. 바꾸는 길은 setGraphShape 하나 · 바꾼 «뒤» 패널을 다시 열고 히스토리를 찍는다.
  const shapeSel = document.getElementById('grb-shape-select');
  const shapeFile = document.getElementById('grb-shape-file-input');
  if (shapeSel && shapeFile) {
    let fileIndex = null;   // null = 블럭 모양 · 수 = 그 항목만
    shapeSel.addEventListener('change', () => {
      const v = shapeSel.value;
      if (v === 'custom' && !block.dataset.shapeSvg) {   // 아직 불러온 SVG 가 없다 — 고르기를 되돌리고 파일을 받는다
        shapeSel.value = block.dataset.barShape || '';
        fileIndex = null; shapeFile.click();
        return;
      }
      const r = window.setGraphShape(block, { shape: v || null });
      if (!r.ok) { shapeSel.value = block.dataset.barShape || ''; return; }
      showGraphProperties(block);
      window.pushHistory();
    });
    document.getElementById('grb-shape-file-btn').addEventListener('click', () => { fileIndex = null; shapeFile.click(); });
    shapeFile.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      const index = fileIndex;
      e.target.value = '';   // 같은 파일 재선택 허용
      if (!file) return;
      if (!(/\.svg$/i.test(file.name) || /svg/i.test(file.type))) { window.showToast?.('⚠️ SVG 파일만 지원합니다'); return; }
      if (file.size > SHAPE_SVG_MAX * 8) { window.showToast?.(SHAPE_FAIL_TOAST.TOO_LARGE); return; }
      const wasSelected = block.classList.contains('selected');
      const text = await file.text();
      if (!block.isConnected) return;   // 읽는 사이 블럭이 지워졌다
      const r = window.setGraphShape(block, index == null ? { svg: text } : { svg: text, index });
      if (!r.ok) { window.showToast?.(SHAPE_FAIL_TOAST[r.code] || ('⚠️ 불러오기 실패: ' + r.code)); return; }
      /* 읽는 사이 선택이 다른 블럭으로 옮겨 갔으면 패널을 가로채지 않는다(「부를 때는 선택돼 있었는데 지금은 아니면 접는다」 — showSectionProperties 의 await 가드와 같은 꼴) */
      if (!(wasSelected && !block.classList.contains('selected'))) showGraphProperties(block);
      window.pushHistory();
    });
    // 항목별 모양(G2 — 실루엣이 항목마다 다른 그래프): 없으면 파일을 받고, 있으면 지운다(블럭 모양으로 돌아간다)
    document.getElementById('grb-data-list').addEventListener('click', (e) => {
      const btn = e.target.closest('.grb-data-icon-btn[data-shape-index]');
      if (!btn) return;
      const i = parseInt(btn.dataset.shapeIndex);
      if (!btn.classList.contains('active')) { fileIndex = i; shapeFile.click(); return; }
      if (!window.setGraphShape(block, { index: i, shape: null }).ok) return;
      showGraphProperties(block);
      window.pushHistory();
    });
  }

  // 1012t1G3 — 최대값(채움 분모). 빈 칸·0 이하 = 키 삭제(기본 100 으로 그린다). 숫자칸 change 에 적용하고 히스토리.
  const fmNumber = document.getElementById('grb-fillmax-number');
  if (fmNumber) {
    fmNumber.addEventListener('change', () => {
      const _before = block.dataset.fillMax ?? null;
      const v = parseFloat(fmNumber.value);
      if (Number.isFinite(v) && v > 0) block.dataset.fillMax = String(Math.min(FILL_MAX_LIMIT, Math.max(1, v)));
      else delete block.dataset.fillMax;
      window.renderGraph(block);
      fmNumber.value = block.dataset.fillMax || '';
      if ((block.dataset.fillMax ?? null) !== _before) window.pushHistory();   // 값이 안 바뀌었으면 히스토리를 안 찍는다
    });
  }
  // 1012t1G3 — 트랙 색. 고르는 순간에만 키가 생긴다(안 고르면 채움색 × 기본 투명도 그대로).
  if (document.getElementById('grb-track-color')) {
    _wireGraphColor('grb-track', { unset: !_trackColorShown(block).c,
      initialAlpha: _trackColorShown(block).a,
      onApply: (c) => { block.dataset.trackColor = c; window.renderGraph(block); },
      onCommit: () => window.pushHistory(),
    });
  }

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
    const newItems = [...list.querySelectorAll('.grb-data-item:not(.grb-seg-item)')].map((row, i) => {
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
      // 1012t1G2·G4 — 항목 모양·마디도 «모델에서» 보존한다(라벨 한 글자에 떨어지지 않게). 마디의 라벨·값만 마디 줄에서 읽고, 색은 모델 것 그대로.
      const pv = prevItems[i] || {};
      if (pv.shape) { it.shape = pv.shape; if (pv.shapeSvg) it.shapeSvg = pv.shapeSvg; }
      if (pv.img) it.img = pv.img;   // 프로토 Z6-B — 방사형 마커 그림(샘플 키)도 모델에서 보존
      for (const k of PIE_ITEM_KEYS) if (pv[k] !== undefined) it[k] = pv[k];   // 1013t1C4 — 원형 조각별 키(크기 …)도 «모델에서» 보존한다
      if (_segsOf(pv).length && !_segOn) it.segments = pv.segments;   // 다른 유형: 마디는 «보존만»(값 칸은 자유 — 맞추기는 아래 change 와 유형 전환이 한다)
      else if (_segsOf(pv).length) {
        const segRows = [...list.querySelectorAll('.grb-seg-item[data-item="' + i + '"]')];
        it.segments = pv.segments.map((sg, j) => {
          const r = segRows[j];
          const o = r ? { label: r.querySelector('.grb-data-label-input').value || '', value: parseFloat(r.querySelector('.grb-data-val-input').value) || 0 } : { label: sg.label, value: sg.value };
          if (sg && sg.color) o.color = sg.color;
          return o;
        });
        it.value = _segSum(it.segments);
        const vEl = row.querySelector('.grb-data-val-input');
        if (vEl && document.activeElement !== vEl) vEl.value = it.value;   // 읽기 전용 합 칸을 따라 쓴다(패널을 다시 안 그린다 — 치던 칸의 포커스 유지)
      }
      return it;
    });
    block.dataset.items = JSON.stringify(newItems);
    window.renderGraph(block);
    const _sn = document.getElementById('grb-pie-slice-name');   // 1013t1C4 — Slice 절 머리의 라벨을 따라 쓴다(패널을 다시 안 그린다 — 치던 칸의 포커스 유지)
    if (_sn && _sliceSel >= 0) _sn.textContent = _sliceName(newItems, _sliceSel);
    _syncPieSliceSolo(newItems, _sliceSel);   // 1013t1C4 고침 2 — 값을 쳐서 조각이 하나가 되면(또는 다시 여럿이 되면) 「크기」·「밀어내기」 칸을 따라 잠근다/푼다
  }

  const dataList = document.getElementById('grb-data-list');
  // GR1 — 항목 색 칸 배선. 쓰는 길은 여기 «하나»: 단색 onApply · 그라데이션 onGradient → items[i].color → 렌더.
  //   미지정(체커) 표시는 처음 고를 때 걷는다(.swatch-none 의 !important 배경이 고른 색을 가리므로).
  const _wireItemColor = (i) => {
    const pre = 'grb-data-color-' + i;
    const _cur0 = (JSON.parse(block.dataset.items || '[]')[i] || {}).color || '';
    const cur = (_isPie && _isGrad(_cur0)) ? '' : _cur0;   // 원형·도넛: 그라데이션 = 미지정(체커)
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
      /* 원형·도넛 조각은 단색 전용 — onGradient 를 안 넘기면 피커가 그라데이션 탭을 잠근다(color-picker cpModes 'solid') */
      ...(_isPie ? {} : { onGradient: (css, commit) => { setColor(css); if (commit) window.pushHistory(); }, gradientValue: _isGrad(cur) ? cur : '' }),
      onCommit: () => window.pushHistory(),
    });
  };
  if (chartType === 'bar-v' || chartType === 'bar-h' || _isPie) items.forEach((_, i) => _wireItemColor(i));
  dataList.addEventListener('input', syncItems);
  dataList.addEventListener('click', e => {
    const btn = e.target.closest('.grb-data-del-btn');
    if (!btn) return;
    if (btn.dataset.seg !== undefined) return;   // 마디 ✕ 는 아래 마디 핸들러가 맡는다(항목을 지우지 않는다)
    const curItems = JSON.parse(block.dataset.items || '[]');
    if (curItems.length <= 1) return;
    curItems.splice(parseInt(btn.dataset.index), 1);
    block.dataset.items = JSON.stringify(curItems);
    window.grbPieSelect?.(block, null);   // 1013t1C4 — 항목 수가 바뀌면 조각 선택을 푼다(색인이 다른 조각을 가리키지 않게)
    window.grbVLabelPick?.(block, null);   // ★1017t1f5 — 같은 까닭(값 라벨 고르기도 색인이 다른 항목을 가리키지 않게)
    window.renderGraph(block);
    showGraphProperties(block);
  });

  // 1013t1C4 — 항목 줄의 조각 버튼: 그 조각을 고르거나(꺼져 있으면) 푼다(켜져 있으면). 캔버스 표식을 쓰고 패널을 다시 연다.
  if (_isPie) dataList.addEventListener('click', e => {
    const btn = e.target.closest('.grb-data-icon-btn[data-slice-index]');
    if (!btn) return;
    window.grbPieSelect?.(block, btn.classList.contains('active') ? null : parseInt(btn.dataset.sliceIndex));
    showGraphProperties(block);
  });

  // 1012t1G4 — 마디: 추가 · 삭제 · 색. 전부 «바꾼 뒤» 패널을 다시 열고 히스토리를 찍는다. 값·라벨 타이핑은 위 syncItems 가 받고 change 에 히스토리.
  const _editSegs = (i, fn) => {
    const its = JSON.parse(block.dataset.items || '[]');
    if (!its[i]) return false;
    const segs = fn(_segsOf(its[i]).slice(), its[i]);
    if (segs.length) { its[i].segments = segs; its[i].value = _segSum(segs); } else delete its[i].segments;   // 마지막 마디를 지우면 보통 막대로(값은 마지막 합 그대로)
    block.dataset.items = JSON.stringify(its);
    window.renderGraph(block);
    return true;
  };
  dataList.addEventListener('click', e => {
    const add = e.target.closest('.grb-seg-add');
    const del = add ? null : e.target.closest('.grb-data-del-btn[data-seg]');
    if (!add && !del) return;
    const i = parseInt((add || del).dataset.item);
    const ok = add
      /* 첫 마디는 그 항목의 값을 통째로 받는다(막대 높이가 안 변한다) · 그 뒤로는 10 씩 */
      ? _editSegs(i, (segs, it) => segs.concat([{ label: '마디 ' + (segs.length + 1), value: segs.length ? 10 : (parseFloat(it.value) > 0 ? parseFloat(it.value) : 10) }]))
      : _editSegs(i, (segs) => { segs.splice(parseInt(del.dataset.seg), 1); return segs; });
    if (!ok) return;
    showGraphProperties(block);
    window.pushHistory();
  });
  dataList.addEventListener('change', e => {
    if (e.target.closest('.grb-seg-item') && e.target.matches('.grb-data-label-input, .grb-data-val-input')) window.pushHistory();
  });
  // 1012t1G4 — 다른 유형에서 값 칸을 «확정»하면 보존된 마디를 그 값에 같은 비율로 맞춘다(타이핑 중간값마다 맞추면 반올림이 쌓여 비율이 틀어진다 ⇒ change 에 한 번).
  if (!_segOn) dataList.addEventListener('change', e => {
    if (!e.target.matches('.grb-data-val-input:not(.grb-data-val2-input)')) return;
    const row = e.target.closest('.grb-data-item');
    const i = [...dataList.querySelectorAll('.grb-data-item:not(.grb-seg-item)')].indexOf(row);
    const its = JSON.parse(block.dataset.items || '[]');
    if (i < 0 || !_segsOf(its[i]).length || !(parseFloat(its[i].value) > 0)) return;   // 값 0 은 마디를 그대로 둔다(비율 보존)
    const { segments: _old, ...rest } = its[i];
    its[i] = window.GRAPH_SHAPE.carryItemExtras(rest, its[i], null);
    block.dataset.items = JSON.stringify(its);
  });
  const _wireSegColor = (i, j) => {
    const pre = 'grb-seg-color-' + i + '-' + j;
    if (!document.getElementById(pre + '-color')) return;
    const cur = (_segsOf(JSON.parse(block.dataset.items || '[]')[i])[j] || {}).color || '';
    const swatch = document.getElementById(pre + '-color')?.closest('.prop-color-swatch');
    const hexEl = document.getElementById(pre + '-hex');
    if (!cur || _isGrad(cur)) { swatch?.classList.add('swatch-none'); if (hexEl) hexEl.value = ''; }
    wireColorField(pre, {
      initialAlpha: cur && !_isGrad(cur) ? parseAlphaFromColor(cur) : 100,
      onApply: (c) => {
        const its = JSON.parse(block.dataset.items || '[]');
        const sg = _segsOf(its[i])[j];
        if (!sg) return;
        sg.color = c;
        block.dataset.items = JSON.stringify(its);
        swatch?.classList.remove('swatch-none');
        window.renderGraph(block);
      },
      onCommit: () => window.pushHistory(),
    });
  };
  if (_segOn) items.forEach((it, i) => _segsOf(it).forEach((_, j) => _wireSegColor(i, j)));

  document.getElementById('grb-add-item').addEventListener('click', () => {
    const curItems = JSON.parse(block.dataset.items || '[]');
    curItems.push({ label: '항목 ' + (curItems.length + 1), value: 50 });
    block.dataset.items = JSON.stringify(curItems);
    window.grbPieSelect?.(block, null);   // 1013t1C4 — 위 삭제와 같은 까닭
    window.grbVLabelPick?.(block, null);   // ★1017t1f5 — 위 삭제와 같은 까닭
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

  // 도너츠 토글 (원형 전용 · 1013t1C1) — 켜면 pieDonut '1', 끄면 키 삭제. 옛 유형 'donut' 은 여기서 'pie' 로 옮겨 쓴다(구멍 값 pieHole 은 꺼도 남는다).
  const pdToggle = document.getElementById('grb-pie-donut-toggle');
  if (pdToggle) {
    pdToggle.addEventListener('change', () => {
      block.dataset.chartType = 'pie';
      if (pdToggle.checked) block.dataset.pieDonut = '1'; else delete block.dataset.pieDonut;
      window.renderGraph(block);
      window.pushHistory();
      showGraphProperties(block);
    });
  }

  // 구멍 크기 (도너츠 전용 · 1012t1G1) — 이웃 슬라이더와 같은 꼴: input 에 적용 · change 에 히스토리. 빈 칸(NaN)은 기본값.
  const phSlider = document.getElementById('grb-pie-hole-slider');
  const phNumber = document.getElementById('grb-pie-hole-number');
  if (phSlider) {
    const applyHole = v => {
      v = Math.min(PIE_HOLE_MAX, Math.max(PIE_HOLE_MIN, Number.isFinite(v) ? v : PIE_HOLE_DEFAULT));
      block.dataset.pieHole = v;
      window.renderGraph(block);
      phSlider.value = v; phNumber.value = v;
    };
    phSlider.addEventListener('input',  () => applyHole(parseInt(phSlider.value)));
    phNumber.addEventListener('change', () => { applyHole(parseInt(phNumber.value)); window.pushHistory(); });
    phSlider.addEventListener('change', () => window.pushHistory());
  }

  // 1013t1C6 · C2 — 원형의 블럭 수준 정수 칸(조각 간격 …). 구멍 슬라이더와 같은 꼴: input 에 적용 · change 에 히스토리 · 빈 칸(NaN)은 기본값.
  const _wirePieInt = (pre, key, lo, hi, dflt) => {
    const sl = document.getElementById(pre + '-slider'), nu = document.getElementById(pre + '-number');
    if (!sl || !nu) return;
    const apply = v => {
      v = Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : dflt));
      block.dataset[key] = v;
      window.renderGraph(block);
      sl.value = v; nu.value = v;
    };
    sl.addEventListener('input',  () => apply(parseInt(sl.value)));
    nu.addEventListener('change', () => { apply(parseInt(nu.value)); window.pushHistory(); });
    sl.addEventListener('change', () => window.pushHistory());
  };
  _wirePieInt('grb-pie-gap', 'pieGap', PIE_GAP_MIN, PIE_GAP_MAX, PIE_GAP);
  _wirePieInt('grb-pie-start', 'pieStart', PIE_START_MIN, PIE_START_MAX, 0);
  // 1017t1f1 — 범례 간격. 기본값(PIE_LEG_GAP_DEFAULT)과 같으면 키를 지운다(「없음 = 키 없음」 — 그래야 G0 골든이 안 흔들린다).
  {
    const sl = document.getElementById('grb-pie-leggap-slider'), nu = document.getElementById('grb-pie-leggap-number');
    if (sl && nu) {
      const apply = v => {
        v = Math.min(PIE_LEG_GAP_MAX, Math.max(PIE_LEG_GAP_MIN, Number.isFinite(v) ? v : PIE_LEG_GAP_DEFAULT));
        if (v === PIE_LEG_GAP_DEFAULT) delete block.dataset.pieLegendGap; else block.dataset.pieLegendGap = v;
        window.renderGraph(block);
        sl.value = v; nu.value = v;
      };
      sl.addEventListener('input',  () => apply(parseInt(sl.value)));
      nu.addEventListener('change', () => { apply(parseInt(nu.value)); window.pushHistory(); });
      sl.addEventListener('change', () => window.pushHistory());
    }
  }
  // 1013t1C4 — Slice 절의 조각별 정수 칸(0~hi %). 고른 조각(items[_sliceSel])의 키를 쓴다 · 0 이면 키를 지운다(안 만진 항목과 같은 꼴) · input 에 적용 · change 에 히스토리.
  const _wireSliceInt = (pre, key, hi) => {
    const sl = document.getElementById(pre + '-slider'), nu = document.getElementById(pre + '-number');
    if (!sl || !nu || _sliceSel < 0) return;
    const apply = v => {   // 썼으면 true
      if (!_pieSliceLive(block, _sliceSel)) { dropPieSlicePanel(); return false; }   // 고침 2 — 그 조각이 더는 고른 조각이 아니면 절을 걷고 안 쓴다
      v = Math.min(hi, Math.max(0, Number.isFinite(v) ? v : 0));
      const its = JSON.parse(block.dataset.items || '[]');
      if (!its[_sliceSel]) return false;
      if (v > 0) its[_sliceSel][key] = v; else delete its[_sliceSel][key];
      block.dataset.items = JSON.stringify(its);
      window.renderGraph(block);
      sl.value = v; nu.value = v;
      return true;
    };
    sl.addEventListener('input',  () => apply(parseInt(sl.value)));
    nu.addEventListener('change', () => { if (apply(parseInt(nu.value))) window.pushHistory(); });
    sl.addEventListener('change', () => { if (_pieSliceLive(block, _sliceSel)) window.pushHistory(); else dropPieSlicePanel(); });
  };
  _wireSliceInt('grb-pie-grow', 'pieGrow', PIE_GROW_MAX);
  _wireSliceInt('grb-pie-pull', 'piePull', PIE_PULL_MAX);   // 1013t1C5
  if (_isPie) _syncPieSliceSolo(items, _sliceSel);   // 1013t1C4 고침 2 — 온 원이면 두 칸을 잠근다
  // 1013t1C3 — 조각 안 라벨: 블럭 수준 토글 둘(순위 · 이름 — 켜면 '1', 끄면 키 삭제) + 고른 조각의 「라벨」(자동 = 키 없음 · 항상 'on' · 숨김 'off').
  for (const [tid, key] of [['grb-pie-rank-toggle', 'pieRank'], ['grb-pie-name-toggle', 'pieName']]) {
    const tg = document.getElementById(tid);
    if (tg) tg.addEventListener('change', () => {
      if (tg.checked) block.dataset[key] = '1'; else delete block.dataset[key];
      window.renderGraph(block);
      _syncPieNameHint(block);   // 덧층이 사라지면(둘 다 끔) 재는 쪽이 안 돈다 ⇒ 여기서 한 번 걷는다
      window.pushHistory();
    });
  }
  // 1013t1C7 — 그림자. 값이 같으면 아무 것도 안 한다(히스토리에 빈 칸을 안 쌓는다 — 모달·확대블럭과 같다).
  propPanel.querySelectorAll('#grb-drop-group .prop-align-btn').forEach(btn => btn.addEventListener('click', () => {
    const next = btn.dataset.val;
    /* 1013t1C7 고침 — 키에 쓰레기 값('abc')이 있으면 «없음»으로 보이지만 키는 남아 있다 ⇒ 「없음」을 누르면 그 키를 지운다(같은 값이라고 돌아가지 않는다). */
    const _junk = block.dataset.dropShadow !== undefined && _pieDropOf(block.dataset) === 'none';
    if (_pieDropOf(block.dataset) === next && !(_junk && next === 'none')) return;
    propPanel.querySelectorAll('#grb-drop-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
    if (next === 'soft' || next === 'strong') block.dataset.dropShadow = next; else delete block.dataset.dropShadow;
    /* 1017t1f4 — 세기를 끄면 x/y/blur/색상 오버라이드도 함께 지운다(고아 방지). 세기가 바뀌면(켜짐 포함) 다시 그려 인라인 filter 를 최신 상태로 — 같은 데이터의 재계산이라 바이트는 그대로다(K1 「그림 무변」은 함수를 안 부르는 것이 아니라 «같은 결과»를 뜻한다). */
    if (next === 'none') { ['pieShadowX', 'pieShadowY', 'pieShadowBlur', 'pieShadowColor'].forEach(k => { delete block.dataset[k]; }); }
    window.renderGraph(block);
    window.pushHistory();
    showGraphProperties(block);   // x/y/blur/색상 칸의 보임/숨김을 다시 그린다
  }));
  // 1017t1f4 — 그림자 x/y/blur/색상(세기가 켜진 때만 패널에 보인다). 이웃 슬라이더와 같은 꼴: input 에 적용 · change 에 히스토리.
  for (const [pre, key, R, D] of [
    ['grb-pie-sh-x', 'pieShadowX', FX_SHADOW_RANGES.x, FX_SHADOW_DEFAULTS.x],
    ['grb-pie-sh-y', 'pieShadowY', FX_SHADOW_RANGES.y, FX_SHADOW_DEFAULTS.y],
    ['grb-pie-sh-blur', 'pieShadowBlur', FX_SHADOW_RANGES.blur, FX_SHADOW_DEFAULTS.blur],
  ]) {
    const sl = document.getElementById(pre + '-slider'), nu = document.getElementById(pre + '-number');
    if (!sl || !nu) continue;
    const apply = v => {
      v = Math.min(R[1], Math.max(R[0], Number.isFinite(v) ? v : D));
      block.dataset[key] = v;
      window.renderGraph(block);
      sl.value = v; nu.value = v;
    };
    sl.addEventListener('input',  () => apply(parseInt(sl.value)));
    nu.addEventListener('change', () => { apply(parseInt(nu.value)); window.pushHistory(); });
    sl.addEventListener('change', () => window.pushHistory());
  }
  if (_isPie && _pieDropOf(block.dataset) !== 'none') {
    wireColorField('grb-pie-sh', {
      initialAlpha: _pieShOf(block.dataset).alpha,
      onApply: (c) => { block.dataset.pieShadowColor = c; window.renderGraph(block); },
      onCommit: () => window.pushHistory(),
    });
  }
  _pieHintBlock = _isPie ? block : null;   // 1013t1C3 고침 2 — 「좁아서 이름 n개 숨김」 안내 줄(아래 _syncPieNameHint). 라벨을 다시 잴 때마다(grb-pie-fit) 숫자를 고친다
  if (_isPie) _syncPieNameHint(block);
  const tagSel = document.getElementById('grb-pie-tag-select');
  if (tagSel && _sliceSel >= 0) tagSel.addEventListener('change', () => {
    if (!_pieSliceLive(block, _sliceSel)) { dropPieSlicePanel(); return; }   // 1013t1C4 고침 2 — 위 _wireSliceInt 와 같은 가드
    const its = JSON.parse(block.dataset.items || '[]');
    if (!its[_sliceSel]) return;
    if (tagSel.value === 'on' || tagSel.value === 'off') its[_sliceSel].pieTag = tagSel.value; else delete its[_sliceSel].pieTag;
    block.dataset.items = JSON.stringify(its);
    window.renderGraph(block);
    window.pushHistory();
  });

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
    v = Math.min(28, Math.max(LABEL_SIZE_MIN, v));
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
window.grbPieDropSlicePanel = dropPieSlicePanel;   // 1013t1C4 고침 2 — 조각 표식을 걷는데 패널을 다시 안 그리는 자리(editor.js toggleBlockSelect)가 부른다

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

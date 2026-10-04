import { propPanel } from '../globals.js';
import { alignBtn } from './_helpers.js';
import { detectMix } from './prop-text-mix-detect.js';

/* ═══════════════════════════════════
   FREELAYOUT MULTI-SELECT PANEL
   Figma 스타일 멀티셀렉 UI
═══════════════════════════════════ */

/**
 * freeLayout 내 선택된 블록들의 text-frame(래퍼) 수집
 * frame-block[data-text-frame]을 우선, 없으면 절대 배치된 블록 자체를 위치/크기 기준으로 사용.
 * (T-057: 옛 «도형프레임 속성» 셀렉터는 그 속성을 찍는 코드가 이력 전체에 0건인 죽은 조건이라 뺐다 —
 *  동작 무변화. 도형 래퍼를 제대로 다루려면 shapeFrameOf + parentElement?.closest 로, 별도 카드에서.)
 */
function _getSelectedFrameWrappers() {
  const BLOCK_SEL = '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
    '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
    '.graph-block.selected, .divider-block.selected, .bridge-block.selected, .grid-block.selected, .infocard-block.selected, .innercard-block.selected, .qa-block.selected, ' +
    '.icon-text-block.selected, .shape-block.selected, ' +
    // 누락 블록 추가 (2026-06-09): iconify/chat/gradient/sticker/laurel
    '.iconify-block.selected, .chat-block.selected, .gradient-block.selected, ' +
    // ★확대블럭도 «플로팅»이라 sticker 와 같은 자리다(absolute → wrapper=자기 자신 분기를 탄다).
    '.sticker-block.selected, .zoom-block.selected, .laurel-block.selected';

  const blocks = [...document.querySelectorAll(BLOCK_SEL)];
  const wrappers = new Set();
  blocks.forEach(b => {
    const wrapper = b.closest('.frame-block[data-text-frame]') ||
      (b.style.position === 'absolute' ? b : null);
    if (wrapper) wrappers.add(wrapper);
  });
  return [...wrappers];
}

/**
 * 래퍼에서 x/y/w/h 수집
 */
function _getGeometry(wrapper) {
  const x = parseInt(wrapper.style.left) || 0;
  const y = parseInt(wrapper.style.top)  || 0;
  const w = wrapper.offsetWidth;
  const h = wrapper.offsetHeight;
  return { x, y, w, h };
}

/**
 * 값 배열이 모두 같으면 수치, 다르면 "mixed"
 */
function _mixedOrValue(arr) {
  if (arr.length === 0) return '';
  const first = arr[0];
  return arr.every(v => v === first) ? String(first) : 'mixed';
}

/**
 * 두 블록 간 gap (축 방향 겹침 없으면 거리, 겹치면 0)
 * gap_x + gap_y 방식 (수평/수직 배치 모두 자연스러움)
 */
function _calcSpacing(gA, gB) {
  const overlapX = Math.min(gA.x + gA.w, gB.x + gB.w) - Math.max(gA.x, gB.x);
  const overlapY = Math.min(gA.y + gA.h, gB.y + gB.h) - Math.max(gA.y, gB.y);
  // 두 축 모두 겹치면 실제 겹침 → 음수로 표시 (더 깊이 겹친 축 기준)
  if (overlapX > 0 && overlapY > 0) {
    return -Math.min(overlapX, overlapY);
  }
  const gapX = overlapX >= 0 ? 0 : -overlapX;
  const gapY = overlapY >= 0 ? 0 : -overlapY;
  return Math.round(gapX + gapY);
}

/**
 * Spacing 표시값 계산
 * - 2개: 두 블록 간 거리
 * - 3개 이상: 가장 가까운 쌍들의 spacing 배열 → 모두 같으면 수치, 다르면 "mixed"
 */
function _calcSpacingDisplay(wrappers) {
  const geoms = wrappers.map(_getGeometry);
  if (geoms.length < 2) return '—';

  if (geoms.length === 2) {
    return String(_calcSpacing(geoms[0], geoms[1]));
  }

  // 3개 이상: 모든 인접 쌍 (정렬 후)
  // x 또는 y 중심 좌표 기준으로 정렬 후 인접 쌍 계산
  const sortedByX = [...geoms].sort((a, b) => a.x - b.x);
  const sortedByY = [...geoms].sort((a, b) => a.y - b.y);

  // x 기준 인접 spacing
  const spacingsX = [];
  for (let i = 0; i < sortedByX.length - 1; i++) {
    spacingsX.push(_calcSpacing(sortedByX[i], sortedByX[i + 1]));
  }
  // y 기준 인접 spacing
  const spacingsY = [];
  for (let i = 0; i < sortedByY.length - 1; i++) {
    spacingsY.push(_calcSpacing(sortedByY[i], sortedByY[i + 1]));
  }

  // 더 의미 있는 축 선택 (평균 spacing이 더 작은 쪽 = 더 촘촘한 배치)
  const avgX = spacingsX.reduce((s, v) => s + v, 0) / spacingsX.length;
  const avgY = spacingsY.reduce((s, v) => s + v, 0) / spacingsY.length;
  const spacings = avgX <= avgY ? spacingsX : spacingsY;

  return _mixedOrValue(spacings);
}

/**
 * 전체 bounding box 계산
 */
function _getBoundingBox(geoms) {
  const minLeft   = Math.min(...geoms.map(g => g.x));
  const minTop    = Math.min(...geoms.map(g => g.y));
  const maxRight  = Math.max(...geoms.map(g => g.x + g.w));
  const maxBottom = Math.max(...geoms.map(g => g.y + g.h));
  return { minLeft, minTop, maxRight, maxBottom };
}

/**
 * 정렬 적용
 */
/* ★정렬 «계산»은 여기 한 곳 — 자유배치 패널(_applyAlign)과 오버레이 패널(_applyOverlayAlign)이 같이 쓴다.
   좌표를 «어디에 쓰나»만 종류마다 다르다(자유배치 = style+offsetX/Y · 오버레이 = offsetX/Y · 줌 = x/y). */
export function alignPositions(geoms, type) {
  const bb = _getBoundingBox(geoms);
  return geoms.map(g => {
    let x = g.x, y = g.y;
    switch (type) {
      case 'left':    x = bb.minLeft; break;
      case 'hcenter': x = Math.round((bb.minLeft + bb.maxRight) / 2 - g.w / 2); break;
      case 'right':   x = bb.maxRight - g.w; break;
      case 'top':     y = bb.minTop; break;
      case 'vcenter': y = Math.round((bb.minTop + bb.maxBottom) / 2 - g.h / 2); break;
      case 'bottom':  y = bb.maxBottom - g.h; break;
    }
    return { x, y };
  });
}

/* 균등분배 — 축 위 순서대로 놓고 «양 끝은 제자리», 사이 간격(모서리~모서리)을 똑같이. 셋 미만이면 할 일이 없다. */
export function distributePositions(geoms, axis) {
  const out = geoms.map(g => ({ x: g.x, y: g.y }));
  if (geoms.length < 3) return out;
  const P = axis === 'h' ? 'x' : 'y', S = axis === 'h' ? 'w' : 'h';
  const order = geoms.map((g, i) => i).sort((a, b) => geoms[a][P] - geoms[b][P]);
  const first = geoms[order[0]], last = geoms[order[order.length - 1]];
  const span = (last[P] + last[S]) - first[P];
  const total = order.reduce((s, i) => s + geoms[i][S], 0);
  const gap = (span - total) / (order.length - 1);
  let cur = first[P];
  order.forEach(i => { out[i][P] = Math.round(cur); cur += geoms[i][S] + gap; });
  return out;
}

function _applyAlign(wrappers, type) {
  const geoms = wrappers.map(_getGeometry);
  const pos = alignPositions(geoms, type);

  wrappers.forEach((wrapper, i) => {
    const newLeft = pos[i].x;
    const newTop  = pos[i].y;

    wrapper.style.left = newLeft + 'px';
    wrapper.style.top  = newTop  + 'px';
    wrapper.dataset.offsetX = String(newLeft);
    wrapper.dataset.offsetY = String(newTop);
  });

  window.pushHistory?.('정렬');
  // 패널 재렌더링
  showFreeLayoutMultiSelPanel();
}

/**
 * X/Y/W/H 값 변경 — 선택된 모든 블록에 적용
 */
function _applyDimension(wrappers, field, value) {
  const num = parseInt(value);
  if (isNaN(num)) return;

  wrappers.forEach(wrapper => {
    if (field === 'x') {
      wrapper.style.left = num + 'px';
      wrapper.dataset.offsetX = String(num);
    } else if (field === 'y') {
      wrapper.style.top = num + 'px';
      wrapper.dataset.offsetY = String(num);
    } else if (field === 'w') {
      wrapper.style.width = num + 'px';
      // X/Y(offsetX/Y)와 동일하게 dataset도 항상 기록 — 재로드 시 width 폴백 일관성 확보
      wrapper.dataset.width = String(num);
    } else if (field === 'h') {
      wrapper.style.height = num + 'px';
      wrapper.dataset.height = String(num);
    }
  });

  window.pushHistory?.('멀티셀렉 크기/위치 변경');
  showFreeLayoutMultiSelPanel();
}

/**
 * freeLayout 멀티셀렉 패널 렌더링 (메인 export)
 */
export function showFreeLayoutMultiSelPanel() {
  if (!propPanel) return;

  const wrappers = _getSelectedFrameWrappers();
  if (wrappers.length < 2) return;

  const geoms = wrappers.map(_getGeometry);

  const xVal = _mixedOrValue(geoms.map(g => g.x));
  const yVal = _mixedOrValue(geoms.map(g => g.y));
  const wVal = _mixedOrValue(geoms.map(g => g.w));
  const hVal = _mixedOrValue(geoms.map(g => g.h));
  const spacing = _calcSpacingDisplay(wrappers);

  const mkInput = (id, val, field, label) => `
    <div class="prop-icon-input" style="flex:1;min-width:0;" title="${label}">
      <span style="font-size:9px;color:#666;padding:0 3px;flex-shrink:0;">${label}</span>
      <input type="${val === 'mixed' ? 'text' : 'number'}"
             id="msp-${id}"
             value="${val}"
             placeholder="${val === 'mixed' ? 'mixed' : ''}"
             style="color:${val === 'mixed' ? '#888' : 'var(--ui-text)'}"
             data-field="${field}"
             ${val !== 'mixed' ? 'step="1"' : ''}>
    </div>`;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label" style="padding:2px 0 4px;">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="4" height="4" rx="0.5"/>
            <rect x="7" y="1" width="4" height="4" rx="0.5"/>
            <rect x="1" y="7" width="4" height="4" rx="0.5"/>
            <rect x="7" y="7" width="4" height="4" rx="0.5"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${wrappers.length}개 선택됨</span>
          <span class="prop-breadcrumb">freeLayout 멀티셀렉</span>
        </div>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Position / Size</div>
      <div class="prop-row">
        ${mkInput('x', xVal, 'x', 'X')}
        ${mkInput('y', yVal, 'y', 'Y')}
      </div>
      <div class="prop-row">
        ${mkInput('w', wVal, 'w', 'W')}
        ${mkInput('h', hVal, 'h', 'H')}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Spacing</div>
      <div class="prop-row">
        <div class="prop-icon-input" style="flex:1;">
          <span style="font-size:9px;color:#666;padding:0 3px;flex-shrink:0;">gap</span>
          <input type="text" value="${spacing}" readonly
                 style="color:${spacing === 'mixed' ? '#888' : 'var(--ui-text)'};cursor:default;">
        </div>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Align</div>
      <div class="prop-row" style="gap:3px;justify-content:space-between;">
        ${alignBtn('object-h', 'left', { label: '왼쪽 정렬', title: '왼쪽 정렬', attrs: { 'data-align': 'left' }, base: 'msp-align-btn' })}
        ${alignBtn('object-h', 'center', { label: '가운데 정렬 (수평)', title: '가운데 정렬 (수평)', attrs: { 'data-align': 'hcenter' }, base: 'msp-align-btn' })}
        ${alignBtn('object-h', 'right', { label: '오른쪽 정렬', title: '오른쪽 정렬', attrs: { 'data-align': 'right' }, base: 'msp-align-btn' })}
        <div style="width:1px;background:var(--ui-border);height:20px;flex-shrink:0;"></div>
        ${alignBtn('object-v', 'top', { label: '위쪽 정렬', title: '위쪽 정렬', attrs: { 'data-align': 'top' }, base: 'msp-align-btn' })}
        ${alignBtn('object-v', 'middle', { label: '가운데 정렬 (수직)', title: '가운데 정렬 (수직)', attrs: { 'data-align': 'vcenter' }, base: 'msp-align-btn' })}
        ${alignBtn('object-v', 'bottom', { label: '아래쪽 정렬', title: '아래쪽 정렬', attrs: { 'data-align': 'bottom' }, base: 'msp-align-btn' })}
      </div>
    </div>
  `;

  // X/Y/W/H 입력 이벤트
  ['x', 'y', 'w', 'h'].forEach(field => {
    const input = propPanel.querySelector(`#msp-${field}`);
    if (!input) return;

    input.addEventListener('focus', () => {
      if (input.value === 'mixed') {
        input.value = '';
        input.type = 'number';
        input.style.color = 'var(--ui-text)';
      }
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        _applyDimension(wrappers, field, input.value);
      }
      if (e.key === 'Escape') {
        input.blur();
        showFreeLayoutMultiSelPanel();
      }
    });

    input.addEventListener('blur', () => {
      if (input.value !== '' && input.value !== 'mixed') {
        _applyDimension(wrappers, field, input.value);
      }
    });
  });

  // 정렬 버튼 이벤트
  propPanel.querySelectorAll('.msp-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const align = btn.dataset.align;
      if (align) _applyAlign(wrappers, align);
    });
  });
}

/**
 * freeLayout 내 선택 블록이 2개 이상인지 확인
 */
export function hasFreeLayoutMultiSel() {
  return _getSelectedFrameWrappers().length >= 2;
}

window.showFreeLayoutMultiSelPanel = showFreeLayoutMultiSelPanel;
window.hasFreeLayoutMultiSel = hasFreeLayoutMultiSel;

/* ═══════════════════════════════════
   OVERLAY(떠 있는 블럭) MULTI-SELECT — «서로» 맞춤 (A2, 현빈 2026-10-01)
═══════════════════════════════════
 * 섹션에 떠 있는 블럭(오버레이 래퍼 · 섹션 직속 줌)을 둘 이상 고르면, 캔버스·섹션이 아니라 «고른 것끼리» 맞춘다.
 * 표준 8개: 좌/가로중앙/우 · 상/세로중앙/하 · 가로 균등 · 세로 균등. 계산은 alignPositions/distributePositions 한 곳.
 * ⚠️이 갈래가 없을 때: 오버레이 글자는 «흐름 패널»로 가서 정렬이 text-align 만 바꿨다(editor.js _isFlowMultiSelUnit).
 * 좌표 정본: 오버레이 = dataset.offsetX/Y(overlay-float.js _applyOverlayPos 와 같은 두 칸 + style) · 줌 = dataset.x/y(zoom-block.js _applyZoomPos). */
const _isSectionHost = (el) => !!el && (el.classList?.contains('section-block') || el.classList?.contains('section-merged-part'));
function _overlayUnitOf(el) {
  const w = el.closest?.('[data-overlay-block="true"]');
  if (w && _isSectionHost(w.parentElement)) return w;
  if (el.classList?.contains('zoom-block') && _isSectionHost(el.parentElement)) return el;
  return null;
}
/** 고른 것이 «전부» 같은 섹션에 떠 있는 블럭이면 그 단위들(2개 이상), 아니면 null. */
export function getSelectedOverlayUnits() {
  const sel = [...document.querySelectorAll('#canvas .selected')]
    .filter(el => !el.classList.contains('section-block') && !el.classList.contains('section-merged-part'));
  if (sel.length < 2) return null;
  const units = [];
  for (const el of sel) {
    const u = _overlayUnitOf(el);
    if (!u) return null;                       // 흐름·프레임 안 블럭이 하나라도 섞이면 이 갈래가 아니다
    if (!units.includes(u)) units.push(u);
  }
  if (units.length < 2) return null;
  const host = units[0].parentElement;
  return units.every(u => u.parentElement === host) ? units : null;   // 섹션이 다르면 좌표계가 다르다
}
const _isZoomUnit = (u) => u.classList.contains('zoom-block');
function _overlayGeom(u) {
  const num = (a, b) => { const v = parseFloat(a); return Number.isFinite(v) ? v : (parseFloat(b) || 0); };
  return _isZoomUnit(u)
    ? { x: num(u.dataset.x, u.style.left), y: num(u.dataset.y, u.style.top), w: u.offsetWidth, h: u.offsetHeight }
    : { x: num(u.dataset.offsetX, u.style.left), y: num(u.dataset.offsetY, u.style.top), w: u.offsetWidth, h: u.offsetHeight };
}
function _setOverlayPos(u, x, y) {
  if (_isZoomUnit(u)) {
    u.dataset.x = String(Math.round(x)); u.dataset.y = String(Math.round(y));
    u.style.left = u.dataset.x + 'px';  u.style.top = u.dataset.y + 'px';
    window.renderZoomBlock?.(u);
  } else {
    u.dataset.offsetX = String(Math.round(x)); u.dataset.offsetY = String(Math.round(y));
    u.style.left = u.dataset.offsetX + 'px';  u.style.top = u.dataset.offsetY + 'px';
  }
}
function _applyOverlay(units, pos, label) {
  units.forEach((u, i) => _setOverlayPos(u, pos[i].x, pos[i].y));
  showOverlayMultiSelPanel(units);             // 패널만 다시 그린다(캔버스 불변) — 기록보다 «먼저»(prop-push-after PA-1)
  window.pushHistory?.(label);                 // push-after (js/CLAUDE.md 히스토리 규약)
}
export function showOverlayMultiSelPanel(units = getSelectedOverlayUnits()) {
  if (!propPanel || !units || units.length < 2) return false;
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label" style="padding:2px 0 4px;">
        <div class="prop-block-info">
          <span class="prop-block-name">${units.length}개 선택됨</span>
          <span class="prop-breadcrumb">떠 있는 블럭 — 서로 맞춤</span>
        </div>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Align</div>
      <div class="prop-row" style="gap:3px;justify-content:space-between;">
        ${alignBtn('object-h', 'left', { label: '왼쪽 정렬', title: '왼쪽 정렬', attrs: { 'data-ov-align': 'left' }, base: 'msp-align-btn' })}
        ${alignBtn('object-h', 'center', { label: '가운데 정렬 (수평)', title: '가운데 정렬 (수평)', attrs: { 'data-ov-align': 'hcenter' }, base: 'msp-align-btn' })}
        ${alignBtn('object-h', 'right', { label: '오른쪽 정렬', title: '오른쪽 정렬', attrs: { 'data-ov-align': 'right' }, base: 'msp-align-btn' })}
        <div style="width:1px;background:var(--ui-border);height:20px;flex-shrink:0;"></div>
        ${alignBtn('object-v', 'top', { label: '위쪽 정렬', title: '위쪽 정렬', attrs: { 'data-ov-align': 'top' }, base: 'msp-align-btn' })}
        ${alignBtn('object-v', 'middle', { label: '가운데 정렬 (수직)', title: '가운데 정렬 (수직)', attrs: { 'data-ov-align': 'vcenter' }, base: 'msp-align-btn' })}
        ${alignBtn('object-v', 'bottom', { label: '아래쪽 정렬', title: '아래쪽 정렬', attrs: { 'data-ov-align': 'bottom' }, base: 'msp-align-btn' })}
      </div>
      <div class="prop-row" style="gap:4px;">
        <button class="prop-btn-sm" data-ov-dist="h" title="가로 간격 균등 (셋 이상)" style="flex:1;"${units.length < 3 ? ' disabled' : ''}>가로 균등</button>
        <button class="prop-btn-sm" data-ov-dist="v" title="세로 간격 균등 (셋 이상)" style="flex:1;"${units.length < 3 ? ' disabled' : ''}>세로 균등</button>
      </div>
    </div>`;
  propPanel.querySelectorAll('[data-ov-align]').forEach(b => b.addEventListener('click', () =>
    _applyOverlay(units, alignPositions(units.map(_overlayGeom), b.dataset.ovAlign), '떠 있는 블럭 정렬')));
  propPanel.querySelectorAll('[data-ov-dist]').forEach(b => b.addEventListener('click', () =>
    _applyOverlay(units, distributePositions(units.map(_overlayGeom), b.dataset.ovDist), '떠 있는 블럭 균등분배')));
  return true;
}
window.getSelectedOverlayUnits = getSelectedOverlayUnits;
window.showOverlayMultiSelPanel = showOverlayMultiSelPanel;

/* ═══════════════════════════════════
   FLOW(세로 스택) MULTI-SELECT PANEL  (B15/B18)
═══════════════════════════════════ */

/* ★SSOT 는 js/editor.js 의 FLOW_BLOCK_SEL_SELECTED «하나»다 — 여기는 «읽기»만 한다.
 *   ⛔예전엔 같은 목록을 리터럴로 한 벌 더 갖고 있었고 «둘 다» 주석에 「SSOT」라 적혀 있었다.
 *     확대블럭이 한쪽에만 들어가서, 2개 선택하면 _countFlowMultiSel()=2 로 패널은 열리는데
 *     _getSelectedFlowBlocks()=0 이라 «아무것도 안 그리고 조용히 return» 하는 결함이 났다
 *     (지디 실측 2026-09-08). 사본이 둘이면 다음 블록에서 또 난다 ⇒ 사본을 없앤다.
 *   ⚠️로드 순서상 이 파일이 editor.js 보다 «먼저» 실행된다 — 그래서 모듈 최상단이 아니라
 *     «호출 시점»에 읽는다. 못 읽으면 던지지 말고 빈 목록으로 떨어뜨린다(패널만 안 뜬다). */
function _flowSel() {
  return (typeof window !== 'undefined' && window.FLOW_BLOCK_SEL_SELECTED) || null;
}

/* ★거르개도 정본은 «한 자리» — js/editor.js 의 _isFlowMultiSelUnit (window.isFlowMultiSelUnit).
   ⛔예전엔 여기 `_isFlowBlock` 이 그것의 «역미러»였다. 목록 사본이 갈려서 난 사고(ⓑ-20)와
     똑같은 모양이라, 2026-09-21 T-091 에서 프레임 판정이 붙을 때 미러를 없앴다.
     (프레임은 «조상»으로도 .selected 가 켜지므로 거르개 없이 목록만 늘리면 오검이 된다) */
function _unitPred() {
  return (typeof window !== 'undefined' && window.isFlowMultiSelUnit) || null;
}

function _getSelectedFlowBlocks() {
  const sel = _flowSel();
  if (!sel) return [];   // editor.js 가 아직 안 올라왔다 — 던지지 않는다
  const pred = _unitPred();
  if (!pred) return [];  // 거르개도 같은 파일에서 온다 — 없으면 패널만 안 뜬다(던지지 않는다)
  return [...document.querySelectorAll(sel)].filter(pred); // DOM 순서 보존
}

export function hasFlowMultiSel() {
  return _getSelectedFlowBlocks().length >= 2;
}

/* ★[T-095 2라운드 / T-091 ⑥] 「꽉 찬 자유배치 래퍼」를 옮기는 «한 자리».
   그룹(⌘G)은 섹션 레벨에서 «width:100%» 로 만들어진다(js/block-factory.js wrapSelectedBlocksInFrame
   — flow 갈래는 `width:100%` 를 못 박는다). 폭에 여유가 0 이면 align-self 는 «아무 일도 안 한다» —
   실측(2026-09-22 포트 9634): 섹션 오른쪽/왼쪽 정렬을 눌러도 그룹 속 도형이 L=308·R=308 «불변»,
   글자만 움직였다. = T-095 신고문(「글자만 움직이고 이미지·도형은 제자리」)이 «그룹 안에서» 그대로 산다.
   ★진짜 움직일 것은 그 «안»의 자유배치 자식들이고, 그 좌표의 원점이 바로 이 래퍼의 패딩 상자다.
   ⇒ 「여유가 있나」를 한 칸 안쪽 «좌표축»에서 한 번 더 묻는다(bulk-align-targets.js 와 같은 규칙).
     묶음은 «통째로» 민다 — 서로의 상대 위치는 그룹의 뜻이라 건드리지 않는다.
   ⛔이름(data-group)을 묻지 않는다 — 이 레포는 손목록이 하나 빠져서 난 사고가 반복됐다.
   ↩︎여유가 없으면(자식이 래퍼를 꽉 채움 — 도형 전용 래퍼가 그렇다) false 를 돌려주고 종전 경로로 보낸다. */
function _alignFreeLayoutContents(b, dir) {
  const kids = [...b.children].filter(c => c.nodeType === 1 && getComputedStyle(c).position === 'absolute');
  if (!kids.length) return false;
  const cs = getComputedStyle(b);
  const avail = b.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  const lefts = kids.map(k => parseFloat(k.style.left) || 0);
  const minX = Math.min(...lefts);
  const maxX = Math.max(...kids.map((k, i) => lefts[i] + k.offsetWidth));
  const span = maxX - minX;
  if (!(span < avail - 0.5)) return false;           // 여유 0 — 여기서도 옮길 자리가 없다
  const target = dir === 'left' ? 0
    : dir === 'right' ? avail - span
    : Math.round((avail - span) / 2);
  const delta = Math.round(target - minX);
  if (delta) kids.forEach((k, i) => {
    const nl = Math.round(lefts[i]) + delta;
    k.style.left = nl + 'px';
    // ★저장·재로드는 dataset.offsetX 를 본다(wrapSelectedBlocksInFrame 이 같이 적는다) — 같이 옮긴다
    if (k.dataset) k.dataset.offsetX = String(nl);
  });
  return true;
}

/* 블록 타입별 수평 정렬 (기존 단일패널 핸들러 미러)
   ★[T-095] 섹션 «Bulk Align» 도 이 함수를 쓴다(js/props/prop-section.js).
     그 자리엔 원래 `.text-block` 만 도는 사본이 있어서 글자만 움직이고 이미지·도형은
     제자리였다. 타입별 분기는 «여기 한 벌»만 둔다 — 사본이 둘이면 다음 블록에서 또 갈린다. */
export function alignFlowBlock(b, dir) {
  const selfMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const jcMap   = { left: 'flex-start', center: 'center', right: 'flex-end' };
  if (b.classList.contains('text-block')) {
    const contentEl = b.querySelector('.tb-content, [contenteditable]') || b;
    if (contentEl.classList.contains('tb-label') || b.querySelector('.tb-label')) {
      b.style.textAlign = dir;                       // label은 tb 자체 (align wireup:13)
    } else {
      contentEl.style.textAlign = dir;               // 일반 텍스트 (align wireup:22)
    }
  } else if (b.classList.contains('icon-text-block')) {
    b.style.justifyContent = jcMap[dir];             // align wireup:17
    const itbText = b.querySelector('.itb-text');
    if (itbText) itbText.style.flex = dir === 'left' ? '1' : '0 1 auto';
  } else if (b.classList.contains('asset-block')) {
    b.dataset.align = dir;                           // prop-asset.js:322
    b.style.alignSelf = selfMap[dir];
  } else {
    if (_alignFreeLayoutContents(b, dir)) return;    // 꽉 찬 자유배치 래퍼(그룹) — 안쪽 묶음을 민다
    b.style.alignSelf = selfMap[dir];                // 범용 fallback (무해)
  }
}

function _applyFlowAlign(blocks, dir) {
  blocks.forEach(b => alignFlowBlock(b, dir));
  window.pushHistory?.('블록 정렬');
  showFlowMultiSelPanel();
}

// 선택 블록들의 연속 형제 사이 gap-block 수집 → 평균 높이로 통일 (B18)
function _collectInterGaps(blocks) {
  if (blocks.length < 2) return [];
  // 같은 부모(section-inner)에 직속인 블록만 대상; gap-block은 spacer
  const gaps = [];
  for (let i = 0; i < blocks.length - 1; i++) {
    const a = blocks[i], z = blocks[i + 1];
    if (a.parentElement !== z.parentElement) continue;
    let n = a.nextElementSibling;
    while (n && n !== z) {
      if (n.classList.contains('gap-block')) gaps.push(n);
      n = n.nextElementSibling;
    }
  }
  return gaps;
}

function _applyFlowDistribute(blocks) {
  const gaps = _collectInterGaps(blocks);
  if (gaps.length < 2) return;
  const avg = Math.round(gaps.reduce((s, g) => s + g.offsetHeight, 0) / gaps.length);
  gaps.forEach(g => {
    g.style.height = avg + 'px';
    if (g.dataset) g.dataset.height = String(avg);
    window.markGapManual?.(g);   // ⓓ 사람이 «분배»로 정한 높이 — 갭 감수가 되돌리지 않는다
  });
  window.pushHistory?.('세로 분배');
  showFlowMultiSelPanel();
}

// 텍스트 블럭의 «글자 몸»(contenteditable 또는 tb-* 본체). 칸 판독(_flowFontSizeMix)과 적용(_applyFlowFontSize)이 «같은» 것을 본다.
function _flowTextContentEl(b) {
  if (!b.classList.contains('text-block')) return null;
  return b.querySelector('[contenteditable]') ||
    b.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet,.tb-liner');
}

/* ★TX2(현빈 2026-10-03 「폰트크기가 다른 텍스트 블럭 2개를 선택하면 … 피그마처럼」) — 여러 블럭의 크기 판독.
 *   한 블럭 «안»의 섞임은 detectMix(단일 패널과 같은 자)로, 블럭 «사이»의 다름은 값 모음으로 본다.
 *   하나라도 섞였거나 값이 둘 이상 ⇒ { mixed:true, value:null } · 모두 같으면 그 값(px, 반올림 — detectMix 와 같은 단위).
 *   칸 꼴은 단일 패널 Mix 칸과 같다(value "" · placeholder "Mix" · data-empty="invalid", _typo-section.js). */
function _flowFontSizeMix(blocks) {
  const vals = new Set();
  for (const b of blocks) {
    const el = _flowTextContentEl(b);
    if (!el) continue;
    const m = detectMix(el).fontSize;
    if (m.mixed) return { mixed: true, value: null };
    if (m.value != null) vals.add(m.value);
  }
  if (vals.size > 1) return { mixed: true, value: null };
  return { mixed: false, value: vals.size === 1 ? [...vals][0] : null };
}

// 선택된 텍스트 블록들에 폰트 크기 일괄 적용 (단일 블록 '무선택 전체 적용' 경로와 동일 시맨틱).
//   ★되돌리기 «한 칸»: 모든 블럭을 고친 뒤 pushHistory 를 «한 번»만 부른다(TX2 ⑵ — 섞인 상태에서 넣어도 같다).
function _applyFlowFontSize(blocks, size) {
  const v = Math.max(1, Math.min(800, parseInt(size, 10) || 0));
  if (!v) return 0;
  let applied = 0, skippedLines = 0;
  blocks.forEach(b => {
    /* ★BT2 — 줄 모드 말풍선은 «건너뛴다»(D4 와 같은 결): 본체(.tb-bubble)에 크기를 쓰면 줄마다 인라인 크기라
       화면은 그대로인데 값만 저장본에 남는다(실측: font-size 50px 저장 · 보이는 줄 40/22px 그대로). 알리고 안 쓴다. */
    if (b.classList.contains('speech-bubble-block') && b.dataset.lines !== undefined) { skippedLines++; return; }
    const contentEl = _flowTextContentEl(b);
    if (!contentEl) return;
    // mix 상태의 부분 font-size span 정리 후 블록 전체 사이즈 적용 (prop-text-wireup-text-edit applySizeToSel 무선택 경로 미러)
    contentEl.querySelectorAll('span[style*="font-size"]').forEach(s => {
      s.style.fontSize = '';
      const styleStr = s.getAttribute('style') || '';
      if (!styleStr.replace(/;|\s/g, '')) {
        const parent = s.parentNode;
        while (s.firstChild) parent.insertBefore(s.firstChild, s);
        parent.removeChild(s);
      }
    });
    contentEl.style.fontSize = v + 'px';
    applied++;
  });
  if (applied) {
    window.pushHistory?.('일괄 폰트 크기');
    window.scheduleAutoSave?.();
  }
  if (skippedLines) window.showToast?.(`⚠️ 줄이 있는 말풍선 ${skippedLines}개는 건너뛰었습니다 — 줄을 골라 그 줄의 글자 크기로 바꾸세요`);
  return applied;
}

export function showFlowMultiSelPanel() {
  if (!propPanel) return;
  const blocks = _getSelectedFlowBlocks();
  if (blocks.length < 2) return;
  const gaps = _collectInterGaps(blocks);
  const canDistribute = gaps.length >= 2;
  const textCount = blocks.filter(b => b.classList.contains('text-block')).length;
  const fsMix = _flowFontSizeMix(blocks);
  /* 섞임 ⇒ 비운 칸 + 'Mix' 안내(⛔value 에 'Mix' 를 넣지 않는다 — 넣으면 클릭 뒤 타이핑이 「Mix32」로 이어붙는다, TX2 ⑶).
     같음 ⇒ 그 값. 판독 불가(글자 0) ⇒ 옛 꼴 그대로(빈 칸 + 'px'). */
  const fsVal = fsMix.mixed || fsMix.value == null ? '' : String(fsMix.value);
  const fsPh = fsMix.mixed ? 'Mix' : 'px';

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label" style="padding:2px 0 4px;">
        <div class="prop-block-info">
          <span class="prop-block-name">${blocks.length}개 선택됨</span>
          <span class="prop-breadcrumb">블록 멀티선택 · 정렬/분배</span>
        </div>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group">
          ${alignBtn('object-h', 'left', { label: '왼쪽 정렬', title: '왼쪽 정렬', attrs: { 'data-align': 'left' } })}
          ${alignBtn('object-h', 'center', { label: '가운데 정렬 (수평)', title: '가운데 정렬 (수평)', attrs: { 'data-align': 'center' } })}
          ${alignBtn('object-h', 'right', { label: '오른쪽 정렬', title: '오른쪽 정렬', attrs: { 'data-align': 'right' } })}
        </div>
      </div>
    </div>
    <div class="prop-section" style="${textCount > 0 ? '' : 'display:none;'}">
      <div class="prop-section-title">폰트 크기 (텍스트 ${textCount}개)</div>
      <div class="prop-row" style="gap:3px;">
        <input type="number" class="prop-number msp-fontsize-input" id="msp-font-size" min="1" max="800" value="${fsVal}" placeholder="${fsPh}" data-empty="invalid" style="flex:1;">
        <button class="prop-btn-sm msp-fontsize-btn" id="msp-font-size-apply" title="선택한 텍스트 블록에 일괄 적용">적용</button>
      </div>
    </div>
    <div class="prop-section" style="${canDistribute ? '' : 'display:none;'}">
      <div class="prop-section-title">분배</div>
      <div class="prop-row" style="gap:3px;">
        <button class="prop-btn-sm msp-dist-btn" data-dist="v" title="세로 간격 균등">세로 균등</button>
      </div>
    </div>`;

  propPanel.querySelectorAll('.prop-align-btn[data-align]').forEach(btn => {
    btn.addEventListener('click', () => _applyFlowAlign(blocks, btn.dataset.align));
  });
  propPanel.querySelectorAll('.msp-dist-btn').forEach(btn => {
    btn.addEventListener('click', () => _applyFlowDistribute(blocks));
  });
  const fsInput = propPanel.querySelector('#msp-font-size');
  const fsApply = propPanel.querySelector('#msp-font-size-apply');
  const doFontSize = () => {
    if (!fsInput || !fsInput.value) return;
    // 넣은 값이 «모두에» 들어갔다 ⇒ 더는 섞이지 않았다. 칸을 비우면 'Mix' 가 다시 보이는 일을 막는다.
    if (_applyFlowFontSize(blocks, fsInput.value)) fsInput.placeholder = 'px';
  };
  fsApply?.addEventListener('click', doFontSize);
  fsInput?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doFontSize(); } });
}

window.showFlowMultiSelPanel = showFlowMultiSelPanel;
window.hasFlowMultiSel = hasFlowMultiSel;

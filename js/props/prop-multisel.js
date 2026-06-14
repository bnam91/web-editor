import { propPanel } from '../globals.js';

/* ═══════════════════════════════════
   FREELAYOUT MULTI-SELECT PANEL
   Figma 스타일 멀티셀렉 UI
═══════════════════════════════════ */

/**
 * freeLayout 내 선택된 블록들의 text-frame(래퍼) 수집
 * frame-block[data-text-frame] 또는 frame-block[data-shape-frame]을 우선,
 * 없으면 절대 배치된 블록 자체를 위치/크기 기준으로 사용
 */
function _getSelectedFrameWrappers() {
  const BLOCK_SEL = '.text-block.selected, .asset-block.selected, .gap-block.selected, ' +
    '.icon-circle-block.selected, .table-block.selected, .label-group-block.selected, ' +
    '.graph-block.selected, .divider-block.selected, ' +
    '.icon-text-block.selected, .shape-block.selected, ' +
    // 누락 블록 추가 (2026-06-09): iconify/chat/gradient/sticker/laurel
    '.iconify-block.selected, .chat-block.selected, .gradient-block.selected, ' +
    '.sticker-block.selected, .laurel-block.selected';

  const blocks = [...document.querySelectorAll(BLOCK_SEL)];
  const wrappers = new Set();
  blocks.forEach(b => {
    const wrapper = b.closest('.frame-block[data-text-frame], .frame-block[data-shape-frame]') ||
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
function _applyAlign(wrappers, type) {
  const geoms = wrappers.map(_getGeometry);
  const bb = _getBoundingBox(geoms);

  wrappers.forEach((wrapper, i) => {
    const g = geoms[i];
    let newLeft = parseInt(wrapper.style.left) || 0;
    let newTop  = parseInt(wrapper.style.top)  || 0;

    switch (type) {
      case 'left':
        newLeft = bb.minLeft;
        break;
      case 'hcenter':
        newLeft = Math.round((bb.minLeft + bb.maxRight) / 2 - g.w / 2);
        break;
      case 'right':
        newLeft = bb.maxRight - g.w;
        break;
      case 'top':
        newTop = bb.minTop;
        break;
      case 'vcenter':
        newTop = Math.round((bb.minTop + bb.maxBottom) / 2 - g.h / 2);
        break;
      case 'bottom':
        newTop = bb.maxBottom - g.h;
        break;
    }

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
        <button class="msp-align-btn" data-align="left"    title="왼쪽 정렬">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="2" y1="1" x2="2" y2="13"/>
            <rect x="3" y="3" width="5" height="3" rx="0.5"/>
            <rect x="3" y="8" width="8" height="3" rx="0.5"/>
          </svg>
        </button>
        <button class="msp-align-btn" data-align="hcenter" title="가운데 정렬 (수평)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="7" y1="1" x2="7" y2="13"/>
            <rect x="3.5" y="3" width="7" height="3" rx="0.5"/>
            <rect x="2" y="8" width="10" height="3" rx="0.5"/>
          </svg>
        </button>
        <button class="msp-align-btn" data-align="right"   title="오른쪽 정렬">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="12" y1="1" x2="12" y2="13"/>
            <rect x="6" y="3" width="5" height="3" rx="0.5"/>
            <rect x="3" y="8" width="8" height="3" rx="0.5"/>
          </svg>
        </button>
        <div style="width:1px;background:var(--ui-border);height:20px;flex-shrink:0;"></div>
        <button class="msp-align-btn" data-align="top"     title="위쪽 정렬">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="2" x2="13" y2="2"/>
            <rect x="3" y="3" width="3" height="5" rx="0.5"/>
            <rect x="8" y="3" width="3" height="8" rx="0.5"/>
          </svg>
        </button>
        <button class="msp-align-btn" data-align="vcenter" title="가운데 정렬 (수직)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="7" x2="13" y2="7"/>
            <rect x="3" y="3.5" width="3" height="7" rx="0.5"/>
            <rect x="8" y="2" width="3" height="10" rx="0.5"/>
          </svg>
        </button>
        <button class="msp-align-btn" data-align="bottom"  title="아래쪽 정렬">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="12" x2="13" y2="12"/>
            <rect x="3" y="6" width="3" height="5" rx="0.5"/>
            <rect x="8" y="3" width="3" height="8" rx="0.5"/>
          </svg>
        </button>
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
   FLOW(세로 스택) MULTI-SELECT PANEL  (B15/B18)
═══════════════════════════════════ */

// editor.js:348 FLOW_BLOCK_SEL_SELECTED와 동일 셀렉터 — SSOT
const FLOW_SEL =
  '.text-block.selected, .asset-block.selected, .gap-block.selected, .icon-circle-block.selected, ' +
  '.table-block.selected, .label-group-block.selected, .graph-block.selected, .divider-block.selected, ' +
  '.icon-text-block.selected, .canvas-block.selected, .banner02-block.selected, .comparison-block.selected, ' +
  '.mockup-block.selected, .icon-block.selected, .vector-block.selected, .step-block.selected, ' +
  '.laurel-block.selected, .gradient-block.selected, .chat-block.selected';

// editor.js _isInFreeLayout 역미러: freeLayout 래퍼 밖(=플로우)만 true
function _isFlowBlock(b) {
  const wrapper = b.closest('.frame-block[data-text-frame], .frame-block[data-shape-frame]') ||
    (b.style.position === 'absolute' ? b : null);
  return !(wrapper && wrapper.closest('.frame-block[data-free-layout]'));
}

function _getSelectedFlowBlocks() {
  return [...document.querySelectorAll(FLOW_SEL)].filter(_isFlowBlock); // DOM 순서 보존
}

export function hasFlowMultiSel() {
  return _getSelectedFlowBlocks().length >= 2;
}

// 블록 타입별 수평 정렬 (기존 단일패널 핸들러 미러)
function _alignFlowBlock(b, dir) {
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
    b.style.alignSelf = selfMap[dir];                // 범용 fallback (무해)
  }
}

function _applyFlowAlign(blocks, dir) {
  blocks.forEach(b => _alignFlowBlock(b, dir));
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
  });
  window.pushHistory?.('세로 분배');
  showFlowMultiSelPanel();
}

export function showFlowMultiSelPanel() {
  if (!propPanel) return;
  const blocks = _getSelectedFlowBlocks();
  if (blocks.length < 2) return;
  const gaps = _collectInterGaps(blocks);
  const canDistribute = gaps.length >= 2;

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
      <div class="prop-section-title">수평 정렬</div>
      <div class="prop-row" style="gap:3px;">
        <button class="msp-align-btn" data-fdir="left"   title="왼쪽 정렬">L</button>
        <button class="msp-align-btn" data-fdir="center" title="가운데 정렬">C</button>
        <button class="msp-align-btn" data-fdir="right"  title="오른쪽 정렬">R</button>
      </div>
    </div>
    <div class="prop-section" style="${canDistribute ? '' : 'display:none;'}">
      <div class="prop-section-title">분배</div>
      <div class="prop-row" style="gap:3px;">
        <button class="msp-dist-btn" data-dist="v" title="세로 간격 균등">세로 균등</button>
      </div>
    </div>`;

  propPanel.querySelectorAll('.msp-align-btn[data-fdir]').forEach(btn => {
    btn.addEventListener('click', () => _applyFlowAlign(blocks, btn.dataset.fdir));
  });
  propPanel.querySelectorAll('.msp-dist-btn').forEach(btn => {
    btn.addEventListener('click', () => _applyFlowDistribute(blocks));
  });
}

window.showFlowMultiSelPanel = showFlowMultiSelPanel;
window.hasFlowMultiSel = hasFlowMultiSel;

/* ═══════════════════════════════════
   SMART GUIDES — 피그마 스타일 스냅/가이드선
   freeLayout frame 내 블록 드래그 시 정렬 가이드 + 스냅 제공
═══════════════════════════════════ */

const SNAP_THRESHOLD  = 10;  // px 이내 → 스냅(자석) — Figma 수준 자석 강도
const GUIDE_THRESHOLD = 12;  // px 이내 → 가이드선 표시

// 현재 표시 중인 가이드 DOM 요소 목록
let _activeGuides = [];

function _getOverlay() {
  return document.getElementById('ss-handles-overlay');
}

function _getScale() {
  const scaler = document.getElementById('canvas-scaler');
  return scaler
    ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1')
    : 1;
}

/**
 * 오버레이에 가이드선 하나를 생성한다.
 * @param {'vertical'|'horizontal'} dir
 * @param {number} x   — 오버레이 기준 left (px)
 * @param {number} y   — 오버레이 기준 top  (px)
 * @param {number} len — 선 길이 (px)
 * @param {boolean} spacing — 간격 가이드 여부 (핑크색)
 * @returns {HTMLElement}
 */
function _createGuideLine(dir, x, y, len, spacing = false) {
  const el = document.createElement('div');
  el.className = `smart-guide ${dir}${spacing ? ' spacing' : ''}`;
  el.style.position = 'absolute';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '9999';
  if (dir === 'vertical') {
    el.style.left   = `${x}px`;
    el.style.top    = `${y}px`;
    el.style.width  = '1px';
    el.style.height = `${len}px`;
  } else {
    el.style.left   = `${x}px`;
    el.style.top    = `${y}px`;
    el.style.width  = `${len}px`;
    el.style.height = '1px';
  }
  return el;
}

/**
 * 오버레이에 간격 숫자 라벨을 생성한다.
 */
function _createLabel(text, x, y) {
  const el = document.createElement('div');
  el.className = 'smart-guide-label';
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  return el;
}

/**
 * 현재 드래그 요소(dragEl)와 parentFrame을 기반으로
 * 형제 블록 + 프레임 경계에 대한 정렬 가이드/스냅 정보를 계산한다.
 *
 * @param {number} left  — dragEl의 현재 left (프레임 로컬 좌표, px)
 * @param {number} top   — dragEl의 현재 top  (프레임 로컬 좌표, px)
 * @param {HTMLElement} dragEl
 * @param {HTMLElement} parentFrame — data-free-layout frame-block
 * @param {number} scale
 * @returns {{ left: number, top: number }} — 스냅 적용 후 위치
 */
export function snapPosition(left, top, dragEl, parentFrame, scale) {
  const siblings = _getSiblings(dragEl, parentFrame);
  const frameW = parentFrame.offsetWidth;
  const frameH = parentFrame.offsetHeight;
  const elW    = dragEl.offsetWidth;
  const elH    = dragEl.offsetHeight;

  // dragEl 엣지/중앙
  const elL  = left;
  const elR  = left + elW;
  const elCX = left + elW / 2;
  const elT  = top;
  const elB  = top  + elH;
  const elCY = top  + elH / 2;

  let snapLeft = left;
  let snapTop  = top;
  let bestDX   = SNAP_THRESHOLD + 1;
  let bestDY   = SNAP_THRESHOLD + 1;

  // ── 참조선 목록 수집 ──────────────────────────────────
  // X 참조: { ref: 참조값, el: 드래그요소의 어느 엣지/중앙에 맞출지 }
  const xRefs = [];
  const yRefs = [];

  // 프레임 엣지 + 중앙
  xRefs.push({ ref: 0,          align: 'left'   });
  xRefs.push({ ref: frameW,     align: 'right'  });
  xRefs.push({ ref: frameW / 2, align: 'center' });
  yRefs.push({ ref: 0,          align: 'top'    });
  yRefs.push({ ref: frameH,     align: 'bottom' });
  yRefs.push({ ref: frameH / 2, align: 'center' });

  // 형제 블록 엣지 + 중앙
  siblings.forEach(sib => {
    const sL  = sib.offsetLeft;
    const sT  = sib.offsetTop;
    const sR  = sL + sib.offsetWidth;
    const sB  = sT + sib.offsetHeight;
    const sCX = sL + sib.offsetWidth  / 2;
    const sCY = sT + sib.offsetHeight / 2;

    xRefs.push({ ref: sL,  align: 'left'   });
    xRefs.push({ ref: sR,  align: 'right'  });
    xRefs.push({ ref: sCX, align: 'center' });
    yRefs.push({ ref: sT,  align: 'top'    });
    yRefs.push({ ref: sB,  align: 'bottom' });
    yRefs.push({ ref: sCY, align: 'center' });
  });

  // ── X 스냅 ────────────────────────────────────────────
  xRefs.forEach(({ ref, align }) => {
    let dragEdge, candidate;
    if (align === 'left') {
      dragEdge  = elL;
      candidate = ref;
    } else if (align === 'right') {
      dragEdge  = elR;
      candidate = ref - elW;
    } else {
      dragEdge  = elCX;
      candidate = ref - elW / 2;
    }
    const d = Math.abs(dragEdge - ref);
    if (d < bestDX) {
      bestDX   = d;
      snapLeft = Math.round(candidate);
    }
  });

  // ── Y 스냅 ────────────────────────────────────────────
  yRefs.forEach(({ ref, align }) => {
    let dragEdge, candidate;
    if (align === 'top') {
      dragEdge  = elT;
      candidate = ref;
    } else if (align === 'bottom') {
      dragEdge  = elB;
      candidate = ref - elH;
    } else {
      dragEdge  = elCY;
      candidate = ref - elH / 2;
    }
    const d = Math.abs(dragEdge - ref);
    if (d < bestDY) {
      bestDY  = d;
      snapTop = Math.round(candidate);
    }
  });

  return {
    left: bestDX <= SNAP_THRESHOLD ? snapLeft : left,
    top:  bestDY <= SNAP_THRESHOLD ? snapTop  : top,
  };
}

/**
 * 가이드선을 오버레이에 렌더링한다.
 * dragEl의 현재 left/top (style)을 읽어서 계산한다.
 *
 * @param {HTMLElement} dragEl
 * @param {HTMLElement} parentFrame
 * @param {number} [scale]
 */
export function showGuides(dragEl, parentFrame, scale) {
  hideGuides();

  const overlay = _getOverlay();
  if (!overlay) return;

  const sc = scale ?? _getScale();
  const siblings = _getSiblings(dragEl, parentFrame);

  const frameW = parentFrame.offsetWidth;
  const frameH = parentFrame.offsetHeight;
  const elW    = dragEl.offsetWidth;
  const elH    = dragEl.offsetHeight;

  const left = parseInt(dragEl.style.left || '0');
  const top  = parseInt(dragEl.style.top  || '0');

  const elL  = left;
  const elR  = left + elW;
  const elCX = left + elW / 2;
  const elT  = top;
  const elB  = top  + elH;
  const elCY = top  + elH / 2;

  // 프레임 DOM 기준 → viewport 기준으로 변환
  const frameRect = parentFrame.getBoundingClientRect();

  /**
   * 프레임 로컬 좌표(px, scale 적용 전) → overlay viewport px
   */
  function toVX(localX) { return frameRect.left + localX * sc; }
  function toVY(localY) { return frameRect.top  + localY * sc; }

  const guides = [];

  // ─── 1. 엣지/중앙 정렬 가이드 ────────────────────────
  // 참조: 프레임 경계 + 형제 블록
  const xCandidates = [
    { ref: 0,          label: 'frame-left'   },
    { ref: frameW,     label: 'frame-right'  },
    { ref: frameW / 2, label: 'frame-cx'     },
  ];
  const yCandidates = [
    { ref: 0,          label: 'frame-top'    },
    { ref: frameH,     label: 'frame-bottom' },
    { ref: frameH / 2, label: 'frame-cy'     },
  ];

  siblings.forEach(sib => {
    const sL  = sib.offsetLeft;
    const sT  = sib.offsetTop;
    const sR  = sL + sib.offsetWidth;
    const sB  = sT + sib.offsetHeight;
    const sCX = sL + sib.offsetWidth  / 2;
    const sCY = sT + sib.offsetHeight / 2;
    xCandidates.push({ ref: sL,  sib });
    xCandidates.push({ ref: sR,  sib });
    xCandidates.push({ ref: sCX, sib });
    yCandidates.push({ ref: sT,  sib });
    yCandidates.push({ ref: sB,  sib });
    yCandidates.push({ ref: sCY, sib });
  });

  // X 가이드선 (수직선)
  xCandidates.forEach(({ ref, sib }) => {
    const distances = [
      { edge: elL,  d: Math.abs(elL  - ref) },
      { edge: elR,  d: Math.abs(elR  - ref) },
      { edge: elCX, d: Math.abs(elCX - ref) },
    ];
    const best = distances.reduce((a, b) => a.d < b.d ? a : b);
    if (best.d > GUIDE_THRESHOLD) return;

    // 수직 가이드선 위치 x
    const vx = toVX(ref);
    // 선 길이: dragEl 상단 ~ 하단 (최소 프레임 full height 포함)
    const minY = toVY(Math.min(elT, sib ? sib.offsetTop : 0, 0));
    const maxY = toVY(Math.max(elB, sib ? sib.offsetTop + sib.offsetHeight : frameH, frameH));
    guides.push(_createGuideLine('vertical', vx, minY, maxY - minY, false));
  });

  // Y 가이드선 (수평선)
  yCandidates.forEach(({ ref, sib }) => {
    const distances = [
      { edge: elT,  d: Math.abs(elT  - ref) },
      { edge: elB,  d: Math.abs(elB  - ref) },
      { edge: elCY, d: Math.abs(elCY - ref) },
    ];
    const best = distances.reduce((a, b) => a.d < b.d ? a : b);
    if (best.d > GUIDE_THRESHOLD) return;

    const vy = toVY(ref);
    const minX = toVX(Math.min(elL, sib ? sib.offsetLeft : 0, 0));
    const maxX = toVX(Math.max(elR, sib ? sib.offsetLeft + sib.offsetWidth : frameW, frameW));
    guides.push(_createGuideLine('horizontal', minX, vy, maxX - minX, false));
  });

  // ─── 2. 균등 간격 가이드 ─────────────────────────────
  _computeSpacingGuides(elL, elR, elT, elB, siblings, frameW, frameH, toVX, toVY, sc, guides);

  // ─── 렌더링 ──────────────────────────────────────────
  guides.forEach(g => {
    overlay.appendChild(g);
    _activeGuides.push(g);
  });
}

/**
 * 모든 스마트 가이드 선 제거
 */
export function hideGuides() {
  _activeGuides.forEach(el => el.remove());
  _activeGuides = [];
}

// ─── 내부 헬퍼 ──────────────────────────────────────────

function _getSiblings(dragEl, parentFrame) {
  // 형제 = parentFrame의 직접 자식 중 dragEl 제외, 절대좌표 배치 요소
  return [...parentFrame.children].filter(ch => {
    if (ch === dragEl) return false;
    if (ch.classList.contains('smart-guide')) return false;
    if (ch.classList.contains('drop-indicator')) return false;
    // text-block은 text-frame 래퍼가 absolute → 래퍼만 포함
    const s = window.getComputedStyle(ch);
    return s.position === 'absolute';
  });
}

/**
 * 균등 간격 가이드를 계산하고 guides 배열에 추가한다.
 */
function _computeSpacingGuides(elL, elR, elT, elB, siblings, frameW, frameH, toVX, toVY, sc, guides) {
  if (siblings.length < 2) return;

  // ── 수평 균등 간격 ──────────────────────────────────
  // dragEl 기준 왼쪽/오른쪽에 각각 블록이 있을 때
  const leftSibs  = siblings.filter(s => s.offsetLeft + s.offsetWidth <= elL);
  const rightSibs = siblings.filter(s => s.offsetLeft >= elR);

  if (leftSibs.length > 0 && rightSibs.length > 0) {
    // 가장 가까운 왼쪽 형제 오른쪽 엣지
    const nearLeft  = leftSibs.reduce((a, b) =>
      (a.offsetLeft + a.offsetWidth) > (b.offsetLeft + b.offsetWidth) ? a : b);
    const nearRight = rightSibs.reduce((a, b) =>
      a.offsetLeft < b.offsetLeft ? a : b);

    const gapLeft  = elL - (nearLeft.offsetLeft  + nearLeft.offsetWidth);
    const gapRight = nearRight.offsetLeft - elR;

    if (Math.abs(gapLeft - gapRight) <= GUIDE_THRESHOLD) {
      // 균등 간격 — 핑크 수평 점선 + 숫자 라벨
      const midY = (elT + elB) / 2;
      const vy   = toVY(midY);

      // 왼쪽 간격선
      const lx1 = toVX(nearLeft.offsetLeft + nearLeft.offsetWidth);
      const lx2 = toVX(elL);
      if (lx2 > lx1) {
        guides.push(_createGuideLine('horizontal', lx1, vy, lx2 - lx1, true));
        guides.push(_createLabel(
          `${Math.round(gapLeft)}`,
          (lx1 + lx2) / 2 - 8,
          vy - 10,
        ));
      }
      // 오른쪽 간격선
      const rx1 = toVX(elR);
      const rx2 = toVX(nearRight.offsetLeft);
      if (rx2 > rx1) {
        guides.push(_createGuideLine('horizontal', rx1, vy, rx2 - rx1, true));
        guides.push(_createLabel(
          `${Math.round(gapRight)}`,
          (rx1 + rx2) / 2 - 8,
          vy - 10,
        ));
      }
    }
  }

  // ── 수직 균등 간격 ──────────────────────────────────
  const topSibs    = siblings.filter(s => s.offsetTop + s.offsetHeight <= elT);
  const bottomSibs = siblings.filter(s => s.offsetTop >= elB);

  if (topSibs.length > 0 && bottomSibs.length > 0) {
    const nearTop = topSibs.reduce((a, b) =>
      (a.offsetTop + a.offsetHeight) > (b.offsetTop + b.offsetHeight) ? a : b);
    const nearBottom = bottomSibs.reduce((a, b) =>
      a.offsetTop < b.offsetTop ? a : b);

    const gapTop    = elT - (nearTop.offsetTop + nearTop.offsetHeight);
    const gapBottom = nearBottom.offsetTop - elB;

    if (Math.abs(gapTop - gapBottom) <= GUIDE_THRESHOLD) {
      const midX = (elL + elR) / 2;
      const vx   = toVX(midX);

      // 위쪽 간격선
      const ty1 = toVY(nearTop.offsetTop + nearTop.offsetHeight);
      const ty2 = toVY(elT);
      if (ty2 > ty1) {
        guides.push(_createGuideLine('vertical', vx, ty1, ty2 - ty1, true));
        guides.push(_createLabel(
          `${Math.round(gapTop)}`,
          vx + 4,
          (ty1 + ty2) / 2 - 6,
        ));
      }
      // 아래쪽 간격선
      const by1 = toVY(elB);
      const by2 = toVY(nearBottom.offsetTop);
      if (by2 > by1) {
        guides.push(_createGuideLine('vertical', vx, by1, by2 - by1, true));
        guides.push(_createLabel(
          `${Math.round(gapBottom)}`,
          vx + 4,
          (by1 + by2) / 2 - 6,
        ));
      }
    }
  }
}

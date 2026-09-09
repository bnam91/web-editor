/* ═══════════════════════════════════
   OVERLAY HANDLE WIDGETS
   Resize / radius handles for frames, mockups, icons, assets, canvas, vectors
   Extracted from drag-drop.js (lines ~13–988)
═══════════════════════════════════ */
import { applyFrameTransform, applyFrameRotationMargin } from './frame-geometry.js';

import { resizeColBoundary, resizeRowHeight } from './grid-cell-resize.js';
// ★grid-block.js → drag-drop.js → overlay-handles.js(이 파일) 로 이미 순환 임포트가 있다
//   (grid-block.js 가 drag-drop.js 의 bindBlock 을 쓰고, drag-drop.js 는 `export * from
//   './overlay-handles.js'`). 여기서 grid-block.js 를 다시 임포트해도 사이클이 «닫힐» 뿐
//   깨지지 않는다 — ESM 순환 임포트는 표준(라이브 바인딩)이고, 아래 함수들은 전부 «모듈
//   최상위가 아니라 이벤트 핸들러 안에서만»(사용자가 실제로 드래그를 시작한 뒤, 즉 전체
//   그래프가 이미 링크된 뒤) 쓰인다 — 이 셋(gridCols/gridRows/getGridModel)이 «단일 진실원»
//   이라 여기서 dataset.cols/rows 를 직접 재파싱하면 클램프/폴백 로직이 두 곳에 흩어진다
//   (이 레포의 고질 — P1 IMPL 보고서·P0 EVAL 둘 다 지적한 패턴). 재사용이 맞다.
import { getGridModel, gridCols, gridRows } from './blocks/grid-block.js';
/* ★모달 핸들의 클램프는 «패널과 같은 표»를 본다 — 리터럴을 여기 다시 쓰면 갈라진다.
   (순환 임포트는 위 grid-block 과 «같은 모양»이고 같은 이유로 안전하다: 이 상수는
    모듈 최상위가 아니라 사용자가 드래그를 시작한 «뒤»의 핸들러 안에서만 읽힌다.) */
import { MODAL_LIMITS, clampModal, setModalSizeMode } from './blocks/modal-block.js';

/* ═══════════════════════════════════
   FRAME RESIZE HANDLE OVERLAY
   Figma 방식: 핸들을 #ss-handles-overlay에 렌더링하여
   frame-block이 overflow:hidden을 직접 가질 수 있게 함
═══════════════════════════════════ */
let _overlayFrame = null;  // 현재 핸들이 표시된 frame-block
let _overlayRafId = null;

function _getOverlay() {
  return document.getElementById('ss-handles-overlay');
}

/* ═══════════════════════════════════
   모서리 규약 — 네 모서리와 «바깥» 방향 부호를 «한 곳»에서 정한다.
   에셋 블록(사각)·아이콘 원형(원)이 같은 표를 쓴다. 베껴 두면 한쪽만 고쳐진다.
═══════════════════════════════════ */
export const CORNER_DIRS = ['nw', 'ne', 'sw', 'se'];

/** dir → 상자 중심에서 «바깥»으로 향하는 축별 부호. e/s 가 +, w/n 이 −. */
export function cornerSign(dir) {
  return { sx: dir.includes('e') ? 1 : -1, sy: dir.includes('s') ? 1 : -1 };
}

/** 핸들이 놓이는 «축별 거리». 상자 꼭지점 = (R, R).
 *  ★2026-09-05 현빈 확정: 「다른 거처럼 «꼭지점»에 해줘야지. 아웃라인만 원으로 해도 되지 않나?」
 *   ⇒ 핸들은 다른 모든 블록과 «같은 자리»(상자 네 꼭지점)에 두고, «원처럼 보이는 일»은 아웃라인이 한다.
 *
 *  ⚠️이 함수는 원래 `R/√2`(45° 둘레점)를 돌려줬다. 그 판단은 «그때» 옳았다 —
 *    당시엔 블록 상자가 원의 3배 폭(286×96)이라 상자 꼭지점이 원에서 한참 떨어져 있었다.
 *    그 뒤 검수에서 상자를 원과 같은 크기로 줄이자(33530d0) 전제가 사라졌는데 이 함수만 남아,
 *    «선은 네모 모서리를 그리는데 핸들은 24px 안쪽»이라는 어긋남이 생겼다(실측).
 *    ★두 수정이 각각은 옳았는데 합쳐지니 어긋난 자리다 — 전제를 바꿨으면 그 위에 선 것을 다시 재라. */
export function circumferenceOffset(R) {
  return R;
}

/* ═══════════════════════════════════
   회전 인식 좌표 헬퍼 (U14 — 회전 후 리사이즈 핸들 좌표 보정)
   블록이 transform:rotate 된 상태에서 getBoundingClientRect()는 «회전된 요소의
   축정렬 바운딩박스(AABB)»를 돌려주므로, 코너 핸들을 rect 모서리에 두면
   실제 회전된 코너와 어긋난다. 회전각을 반영해 «진짜 회전된 코너»의 스크린
   좌표를 계산한다. 회전이 0이면 기존 rect 모서리 경로와 «완전 동일»(회귀 0).
═══════════════════════════════════ */
/** ★export — 선택 오버레이(js/selection-overlay.js)가 «같은 배율»을 쓴다.
 *  베끼면 갈라진다: 스케일러 transform 을 읽는 자리는 «한 곳»이어야 한다. */
export function _canvasScaleNow() {
  const s = document.getElementById('canvas-scaler');
  return s ? parseFloat(s.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
}
// 블록이 어떤 규약으로 회전값을 갖든(프레임 rotateDeg / asset rotation / shape shapeRotation)
// 화면상 회전각(deg)을 반환. 없으면 0.
function _blockRotationDeg(el) {
  if (!(el instanceof HTMLElement)) return 0;
  const d = el.dataset;
  let v = d.rotateDeg;
  if (v == null || v === '') v = d.rotation;
  if (v == null || v === '') v = d.shapeRotation;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
// 코너 dir('nw'|'ne'|'sw'|'se')의 스크린 좌표.
// inset>0 이면 코너에서 안쪽으로(코너반경 핸들), inset<0 이면 바깥쪽으로(회전 핫존).
/** ★export — 선택 오버레이가 테두리 꼭지점을 «이 함수로» 얻는다(핸들과 같은 좌표).
 *  ⛔베끼지 마라 — 베끼는 순간 「핸들은 여기, 선은 저기」로 갈라진다(M39 가 바로 그 병이었다).
 *  ⚠️한계: 회전은 el «자신»의 dataset 만 본다. 회전한 «조상» 안의 자식은 AABB 가 나온다. */
export function _cornerScreen(el, dir, inset = 0) {
  const rect = el.getBoundingClientRect();
  const deg = _blockRotationDeg(el);
  if (!deg) {
    // 회귀 0: 기존과 완전히 동일한 rect 모서리 기반 계산
    const x = dir.includes('w') ? rect.left + inset : rect.right  - inset;
    const y = dir.includes('n') ? rect.top  + inset : rect.bottom - inset;
    return { x, y };
  }
  const cx = rect.left + rect.width  / 2;   // 중심은 회전 불변
  const cy = rect.top  + rect.height / 2;
  const scale = _canvasScaleNow();
  const hw = el.offsetWidth  * scale / 2 - inset; // 미회전 반폭(스크린px) - inset
  const hh = el.offsetHeight * scale / 2 - inset;
  const sx = dir.includes('w') ? -1 : 1;
  const sy = dir.includes('n') ? -1 : 1;
  const lx = sx * hw, ly = sy * hh;
  const th = deg * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
  return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos };
}
// 스크린 델타(dx,dy)를 블록 로컬축으로 역회전 — 회전된 블록 리사이즈 시 W/H가
// 블록 자신의 축을 따라 반응하게 한다. 회전 0이면 그대로 반환.
function _unrotateDelta(el, dx, dy) {
  const deg = _blockRotationDeg(el);
  if (!deg) return { dx, dy };
  const th = -deg * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
  return { dx: dx * cos - dy * sin, dy: dx * sin + dy * cos };
}

function showFrameHandles(ss) {
  if (_overlayFrame === ss) return; // already showing
  hideFrameHandles();
  _overlayFrame = ss;
  const overlay = _getOverlay();
  if (!overlay) return;

  const dirs = ['nw', 'ne', 'sw', 'se'];
  dirs.forEach(dir => {
    const h = document.createElement('div');
    h.className = `ss-resize-handle ${dir}`;
    h.dataset.dir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onHandleMouseDown(e, ss, dir));
  });

  // Figma 스타일 코너 반경 핸들 (프레임 내부 코너에 표시)
  dirs.forEach(dir => {
    const r = document.createElement('div');
    r.className = `ss-radius-handle ${dir}`;
    r.dataset.radiusDir = dir;
    r.title = '코너 반경 조절';
    overlay.appendChild(r);
    r.addEventListener('mousedown', e => _onRadiusHandleMouseDown(e, ss, dir));
  });

  // U14 회전 핫존 (코너 바깥) — 프레임 회전은 dataset.rotateDeg 규약(prop-frame과 공유)
  // 도형·텍스트 래퍼 프레임엔 부착하지 않는다(각자 전용 회전 핸들/제외 대상):
  //  - shape frame: shape-block 자체 회전(shape-rotate-zone, asset-rotate.js)
  //  - text frame : 텍스트 회전 상신 대상(보고 참조)
  const _hasShape = !!ss.querySelector(':scope > .shape-block');
  const _isTextFrame = ss.dataset.textFrame === 'true';
  if (!_hasShape && !_isTextFrame) {
    dirs.forEach(dir => {
      const z = document.createElement('div');
      z.className = `ss-rotate-handle ${dir}`;
      z.dataset.rotDir = dir;
      z.title = '회전 (Shift=15° 스냅)';
      z.style.cssText = 'position:fixed;width:20px;height:20px;z-index:98;pointer-events:auto;'
        + 'border-radius:50%;cursor:' + _FRAME_ROTATE_CURSOR + ';';
      overlay.appendChild(z);
      z.addEventListener('mousedown', e => _onFrameRotateMouseDown(e, ss));
    });
  }

  _updateHandlePositions();
  _startHandleRaf();
}

function hideFrameHandles() {
  if (_overlayRafId) { cancelAnimationFrame(_overlayRafId); _overlayRafId = null; }
  _overlayFrame = null;
  const overlay = _getOverlay();
  if (overlay) {
    overlay.querySelectorAll('.ss-resize-handle, .ss-radius-handle, .ss-rotate-handle').forEach(h => h.remove());
  }
}

// 피그마식 회전 커서 (asset-rotate.js와 동일 SVG)
const _FRAME_ROTATE_CURSOR = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 12a8 8 0 1 1-2.3-5.6' stroke='white' stroke-width='4'/%3E%3Cpolyline points='20 3 20 7 16 7' stroke='white' stroke-width='4'/%3E%3Cpath d='M20 12a8 8 0 1 1-2.3-5.6' stroke='%23222' stroke-width='2'/%3E%3Cpolyline points='20 3 20 7 16 7' stroke='%23222' stroke-width='2'/%3E%3C/svg%3E\") 12 12, grab";

// 프레임 회전 드래그 — 중심 기준 atan2 자유회전, Shift=15° 스냅.
// dataset.rotateDeg + 합성 transform(translate·rotate·scale) 규약(prop-frame·save-load과 동일).
function _composeFrameTransform(ss) {
  // SSOT = js/frame-geometry.js. transform 문자열 합성 + 회전 AABB 세로 마진 보정을 함께 한다.
  // identity:'clear' 는 «이 경로의 기존 규약»(항등이면 style.transform 제거)을 그대로 유지한 것.
  applyFrameTransform(ss, { identity: 'clear' });
}
function _onFrameRotateMouseDown(e, ss) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const br = ss.getBoundingClientRect();
  const cx = br.left + br.width  / 2;
  const cy = br.top  + br.height / 2;
  const init   = parseFloat(ss.dataset.rotateDeg) || 0;
  const startA = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
  function onMove(ev) {
    const a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
    let deg = init + (a - startA);
    deg = window._snapRotate(deg, ev.shiftKey); // Shift = 45° 스냅(공유)
    deg = ((deg % 360) + 360) % 360;
    if (deg > 180) deg -= 360; // -180..180
    ss.dataset.rotateDeg = String(deg);
    _composeFrameTransform(ss);
    // 프로퍼티 패널 회전 입력 동기화 (열려 있으면)
    const inp = document.getElementById('ss-rotate-deg');
    if (inp) inp.value = String(deg);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.pushHistory?.('프레임 회전');
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function _startHandleRaf() {
  function loop() {
    if (!_overlayFrame) return;
    // 프레임이 DOM에서 제거됐거나 선택 해제되면 핸들 제거
    if (!_overlayFrame.isConnected || !_overlayFrame.classList.contains('selected')) {
      hideFrameHandles();
      return;
    }
    _updateHandlePositions();
    _overlayRafId = requestAnimationFrame(loop);
  }
  _overlayRafId = requestAnimationFrame(loop);
}

function _updateHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_overlayFrame) return;
  const HALF = 3.5;
  // 회전 인식: 회전된 프레임이면 실제 회전된 코너에 핸들 배치(회전 0이면 기존과 동일)
  const handles = overlay.querySelectorAll('.ss-resize-handle');
  handles.forEach(h => {
    const c = _cornerScreen(_overlayFrame, h.dataset.dir);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });

  // 코너 반경 핸들 위치 (프레임 안쪽 코너에서 INSET만큼 안쪽)
  const INSET = 10; // 코너에서 안쪽으로 떨어진 거리
  const RADIUS_HALF = 3.5; // 7px 핸들 중앙 정렬 (= 7/2)
  const rHandles = overlay.querySelectorAll('.ss-radius-handle');
  rHandles.forEach(h => {
    const c = _cornerScreen(_overlayFrame, h.dataset.radiusDir, INSET);
    h.style.top  = (c.y - RADIUS_HALF) + 'px';
    h.style.left = (c.x - RADIUS_HALF) + 'px';
  });

  // 회전 핫존 위치 (코너 리사이즈 핸들 바깥쪽) — U14 프레임 핸들 회전
  const ROT_OUT  = 16; // 코너에서 바깥으로 (스크린px)
  const ROT_HALF = 10; // 20px 핫존 중앙 정렬
  overlay.querySelectorAll('.ss-rotate-handle').forEach(h => {
    const c = _cornerScreen(_overlayFrame, h.dataset.rotDir, -ROT_OUT); // 음수 inset = 바깥
    h.style.top  = (c.y - ROT_HALF) + 'px';
    h.style.left = (c.x - ROT_HALF) + 'px';
  });
}

function _onHandleMouseDown(e, ss, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const ssRect = ss.getBoundingClientRect();
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  // 회전 시 getBoundingClientRect는 AABB(부풀림) → 미회전 layout 크기(offset*)를 기준으로.
  const _rotStart = _blockRotationDeg(ss);
  const startW = _rotStart ? Math.round(ss.offsetWidth)  : Math.round(ssRect.width  / scale0);
  const startH = _rotStart ? Math.round(ss.offsetHeight) : Math.round(ssRect.height / scale0);
  const secInner = ss.closest('.section-inner') || ss.closest('.section-block');
  const secInnerCS = secInner ? getComputedStyle(secInner) : null;
  const paddingH = secInnerCS ? parseFloat(secInnerCS.paddingLeft) + parseFloat(secInnerCS.paddingRight) : 0;
  const maxW = secInner ? Math.round(secInner.clientWidth - paddingH) : 860;

  // fullWidth 프레임(stack 모드, 자동 높이)은 핸들로 높이 조절 안 함 — 자식이 결정.
  const isFullWidth = ss.dataset.fullWidth === 'true';

  // ── 그룹 리사이즈: 자식을 비례 스케일 (피그마식). data-group 프레임에만 적용 ──
  const isGroup = ss.dataset.group === 'true';
  // 스케일 기준은 style.width/height(canvas px) — rect/scale 불일치 회피
  const groupStartW = parseInt(ss.style.width) || startW;
  const groupStartH = parseInt(ss.style.height) || startH;
  let groupSnap = null;
  if (isGroup) {
    groupSnap = [];
    const collect = (container) => {
      [...container.children].forEach(c => {
        if (c.classList.contains('frame-resize-handle')) return;
        if (getComputedStyle(c).position !== 'absolute') return;
        const isTextFrame = c.dataset.textFrame === 'true';
        const contentEl = isTextFrame ? c.querySelector('[class^="tb-"]') : null;
        groupSnap.push({
          el: c,
          left: parseInt(c.style.left) || 0,
          top: parseInt(c.style.top) || 0,
          w: parseInt(c.style.width) || c.offsetWidth,
          h: parseInt(c.style.height) || c.offsetHeight,
          isTextFrame,
          contentEl,
          fs: contentEl ? (parseFloat(getComputedStyle(contentEl).fontSize) || 0) : 0,
        });
        if (c.classList.contains('frame-block') && !isTextFrame) collect(c);
      });
    };
    collect(ss);
  }

  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    // 회전된 프레임: 스크린 델타를 블록 로컬축으로 역회전(회전 0이면 그대로 → 회귀 0)
    const _rd = _unrotateDelta(ss, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    const dx = _rd.dx;
    const dy = _rd.dy;
    let newW = startW, newH = startH;
    if (dir.includes('e')) newW = Math.min(maxW, Math.max(60, startW + dx));
    if (dir.includes('w')) newW = Math.min(maxW, Math.max(60, startW - dx));
    if (!isFullWidth) {
      if (dir.includes('s')) newH = Math.max(40, startH + dy);
      if (dir.includes('n')) newH = Math.max(40, startH - dy);
    }
    newW = Math.round(newW); newH = Math.round(newH);
    ss.style.width  = `${newW}px`; ss.dataset.width  = String(newW);
    if (!isFullWidth) {
      ss.style.height = `${newH}px`; ss.style.minHeight = `${newH}px`; ss.dataset.height = String(newH);
    }
    // 회전한 프레임을 리사이즈하면 AABB 도 같이 변한다 → 세로 마진 보정 재계산.
    // sizeHint 로 넘겨 offsetWidth/Height 재측정(강제 리플로우) 없이 계산한다.
    if (_blockRotationDeg(ss)) applyFrameRotationMargin(ss, { w: newW, h: isFullWidth ? ss.offsetHeight : newH });
    // 그룹: 자식들을 좌상단(0,0) 원점 기준 비례 스케일 (기준은 style 기반 groupStartW/H)
    if (isGroup && groupSnap) {
      const sx = groupStartW ? newW / groupStartW : 1;
      const sy = (!isFullWidth && groupStartH) ? newH / groupStartH : 1;
      const fsScale = Math.min(sx, sy);
      groupSnap.forEach(s => {
        const L = Math.round(s.left * sx), T = Math.round(s.top * sy);
        s.el.style.left = L + 'px'; s.el.dataset.offsetX = String(L);
        s.el.style.top  = T + 'px'; s.el.dataset.offsetY = String(T);
        const W = Math.round(s.w * sx);
        s.el.style.width = W + 'px';
        if (s.el.dataset.width !== undefined && s.el.dataset.width !== '100%') s.el.dataset.width = String(W);
        if (s.isTextFrame) {
          // 텍스트: 높이는 폰트로 결정 → fontSize만 스케일
          if (s.contentEl && s.fs) s.contentEl.style.fontSize = (s.fs * fsScale).toFixed(1) + 'px';
        } else {
          const H = Math.round(s.h * sy);
          s.el.style.height = H + 'px';
          if (s.el.dataset.height !== undefined) s.el.dataset.height = String(H);
        }
      });
    }
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* 코너 반경 핸들 드래그 — Figma 스타일 */
function _onRadiusHandleMouseDown(e, ss, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startRadius = parseInt(ss.dataset.radius) || 0;

  // 코너 방향에 따른 드래그 방향 (안쪽으로 드래그 = 반경 증가)
  // nw: +x+y → 증가 / ne: -x+y → 증가 / sw: +x-y → 증가 / se: -x-y → 증가
  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    // 드래그 거리 → 반경 변화 (대각선 방향 평균)
    const delta = dir === 'nw' ? (dx + dy) / 2
                : dir === 'ne' ? (-dx + dy) / 2
                : dir === 'sw' ? (dx - dy) / 2
                : (-dx - dy) / 2; // se
    const newR = Math.min(200, Math.max(0, Math.round(startRadius + delta)));
    ss.dataset.radius = String(newR);
    ss.style.borderRadius = newR + 'px';
    // 프로퍼티 패널 동기화
    const slider = document.getElementById('ss-radius-slider');
    const num    = document.getElementById('ss-radius-num');
    if (slider) slider.value = String(newR);
    if (num)    num.value    = String(newR);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showFrameHandles = showFrameHandles;
window.hideFrameHandles = hideFrameHandles;

/* ═══════════════════════════════════
   MOCKUP BLOCK RESIZE HANDLES
   좌/우 중앙 핸들 — 가로 크기 조절, 세로는 비율 유지
═══════════════════════════════════ */
let _overlayMockup = null;
let _mockupRafId   = null;

function showMockupHandles(block) {
  if (_overlayMockup === block) return;
  hideMockupHandles();
  _overlayMockup = block;
  const overlay = _getOverlay();
  if (!overlay) return;

  ['nw', 'ne', 'sw', 'se'].forEach(dir => {
    const h = document.createElement('div');
    h.className = `ss-resize-handle mockup-handle ${dir}`;
    h.dataset.dir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onMockupHandleMouseDown(e, block, dir));
  });

  _updateMockupHandlePositions();
  function loop() {
    if (!_overlayMockup) return;
    if (!_overlayMockup.isConnected || !_overlayMockup.classList.contains('selected')) {
      hideMockupHandles(); return;
    }
    _updateMockupHandlePositions();
    _mockupRafId = requestAnimationFrame(loop);
  }
  _mockupRafId = requestAnimationFrame(loop);
}

function hideMockupHandles() {
  if (_mockupRafId) { cancelAnimationFrame(_mockupRafId); _mockupRafId = null; }
  _overlayMockup = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.ss-resize-handle.mockup-handle').forEach(h => h.remove());
}

function _updateMockupHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_overlayMockup) return;
  const HALF = 3.5;
  overlay.querySelectorAll('.ss-resize-handle.mockup-handle').forEach(h => {
    const dir = h.dataset.dir;
    const c = _cornerScreen(_overlayMockup, dir); // #14b 회전 인식(회전0=rect 모서리 동일)
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _onMockupHandleMouseDown(e, block, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX  = e.clientX;
  const startY  = e.clientY;
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0  = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startW  = parseInt(block.dataset.width) || parseInt(block.style.width) || 280;

  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale  = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    // #14b 회전 인식: 스크린 델타를 블록 로컬축으로 역회전(회전0=그대로) 후 width축(dx) 사용
    const dx = _unrotateDelta(block, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale).dx;
    let newW = dir.includes('e') ? startW + dx : startW - dx;
    newW = Math.round(Math.min(860, Math.max(100, newW)));
    block.dataset.width = String(newW);
    block.style.width   = newW + 'px';
    window.renderMockupBlock?.(block);
    // 프로퍼티 패널 슬라이더 동기화
    const slider = document.getElementById('mkp-width-slider');
    const num    = document.getElementById('mkp-width-number');
    if (slider) slider.value = String(newW);
    if (num)    num.value    = String(newW);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showMockupHandles = showMockupHandles;
window.hideMockupHandles = hideMockupHandles;

/* ═══════════════════════════════════
   ICON BLOCK RESIZE HANDLES
   아이콘 블록 선택 시 4코너 핸들로 크기 조절
   아이콘은 정사각형 — size(width=height) 동시 변경
═══════════════════════════════════ */
let _overlayIcon    = null;
let _iconRafId      = null;

function showIconHandles(block) {
  if (_overlayIcon === block) return;
  hideIconHandles();
  _overlayIcon = block;
  const overlay = _getOverlay();
  if (!overlay) return;

  ['nw', 'ne', 'sw', 'se'].forEach(dir => {
    const h = document.createElement('div');
    h.className = `ss-resize-handle icon-handle ${dir}`;
    h.dataset.dir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onIconHandleMouseDown(e, block, dir));
  });

  _updateIconHandlePositions();
  function loop() {
    if (!_overlayIcon) return;
    if (!_overlayIcon.isConnected || !_overlayIcon.classList.contains('selected')) {
      hideIconHandles(); return;
    }
    _updateIconHandlePositions();
    _iconRafId = requestAnimationFrame(loop);
  }
  _iconRafId = requestAnimationFrame(loop);
}

function hideIconHandles() {
  if (_iconRafId) { cancelAnimationFrame(_iconRafId); _iconRafId = null; }
  _overlayIcon = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.ss-resize-handle.icon-handle').forEach(h => h.remove());
}

function _updateIconHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_overlayIcon) return;
  const HALF = 3.5;
  overlay.querySelectorAll('.ss-resize-handle.icon-handle').forEach(h => {
    const dir = h.dataset.dir;
    const c = _cornerScreen(_overlayIcon, dir); // #14b 회전 인식(회전0=rect 모서리 동일)
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _onIconHandleMouseDown(e, block, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX  = e.clientX;
  const startY  = e.clientY;
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0  = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startSize = parseInt(block.dataset.size) || parseInt(block.style.width) || 64;

  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale  = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    // 대각선 핸들 — dx/dy 중 큰 쪽으로 크기 결정.
    // #14b 회전 인식: 스크린 델타를 블록 로컬축으로 역회전(회전0=그대로) 후 판정
    const _ud = _unrotateDelta(block, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    const dx = _ud.dx, dy = _ud.dy;
    const delta = (Math.abs(dx) > Math.abs(dy) ? dx : dy);
    let newSize = Math.round(Math.min(512, Math.max(16,
      dir === 'nw' || dir === 'sw' ? startSize - delta : startSize + delta
    )));
    block.dataset.size = String(newSize);
    block.style.width  = newSize + 'px';
    block.style.height = newSize + 'px';
    const svg = block.querySelector('svg');
    if (svg) { svg.setAttribute('width', newSize); svg.setAttribute('height', newSize); }
    const img = block.querySelector('img');
    if (img) { img.width = newSize; img.height = newSize; }
    // 프로퍼티 패널 동기화
    const slider = document.getElementById('icn-size-slider');
    const num    = document.getElementById('icn-size-number');
    if (slider) slider.value = String(newSize);
    if (num)    num.value    = String(newSize);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showIconHandles = showIconHandles;
window.hideIconHandles = hideIconHandles;

/* ═══════════════════════════════════
   ASSET BLOCK CORNER RADIUS HANDLES
   프레임 핸들과 동일한 오버레이에 렌더링
═══════════════════════════════════ */
let _assetRadiusBlock = null;
let _assetRadiusRafId = null;

function showAssetRadiusHandles(ab) {
  if (_assetRadiusBlock === ab) return;
  hideAssetRadiusHandles();
  _assetRadiusBlock = ab;
  const overlay = _getOverlay();
  if (!overlay) return;

  CORNER_DIRS.forEach(dir => {
    const r = document.createElement('div');
    r.className = `asset-radius-handle ${dir}`;
    r.dataset.assetRadiusDir = dir;
    r.title = '모서리 반경 조절';
    overlay.appendChild(r);
    r.addEventListener('mousedown', e => _onAssetRadiusHandleMouseDown(e, ab, dir));
  });

  _updateAssetRadiusHandlePositions();
  _startAssetRadiusRaf();
}

function hideAssetRadiusHandles() {
  if (_assetRadiusRafId) { cancelAnimationFrame(_assetRadiusRafId); _assetRadiusRafId = null; }
  _assetRadiusBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.asset-radius-handle').forEach(h => h.remove());
}

function _updateAssetRadiusHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_assetRadiusBlock) return;
  const INSET = 10;
  const HALF  = 3.5; // 7px 핸들 중앙 정렬
  overlay.querySelectorAll('.asset-radius-handle').forEach(h => {
    const c = _cornerScreen(_assetRadiusBlock, h.dataset.assetRadiusDir, INSET);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startAssetRadiusRaf() {
  function loop() {
    if (!_assetRadiusBlock) return;
    if (!_assetRadiusBlock.isConnected || !_assetRadiusBlock.classList.contains('selected')) {
      hideAssetRadiusHandles();
      return;
    }
    _updateAssetRadiusHandlePositions();
    _assetRadiusRafId = requestAnimationFrame(loop);
  }
  _assetRadiusRafId = requestAnimationFrame(loop);
}

function _onAssetRadiusHandleMouseDown(e, ab, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startRadius = parseInt(ab.style.borderRadius) || 0;

  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    const delta = dir === 'nw' ? (dx + dy) / 2
                : dir === 'ne' ? (-dx + dy) / 2
                : dir === 'sw' ? (dx - dy) / 2
                : (-dx - dy) / 2;
    const newR = Math.min(120, Math.max(0, Math.round(startRadius + delta)));
    ab.style.borderRadius = newR + 'px';
    // 프로퍼티 패널 동기화
    const slider = document.getElementById('asset-r-slider');
    const num    = document.getElementById('asset-r-number');
    if (slider) slider.value = String(newR);
    if (num)    num.value    = String(newR);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showAssetRadiusHandles = showAssetRadiusHandles;
window.hideAssetRadiusHandles = hideAssetRadiusHandles;

/* ═══════════════════════════════════
   ASSET BLOCK RESIZE HANDLES (overlay)
   프레임 핸들과 동일한 스타일 / 오버레이 사용
═══════════════════════════════════ */
let _assetResizeBlock = null;
let _assetResizeRafId = null;

function showAssetResizeHandles(ab) {
  if (_assetResizeBlock === ab) return;
  hideAssetResizeHandles();
  _assetResizeBlock = ab;
  const overlay = _getOverlay();
  if (!overlay) return;

  CORNER_DIRS.forEach(dir => {
    const h = document.createElement('div');
    h.className = `asset-overlay-handle ${dir}`;
    h.dataset.assetResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onAssetResizeHandleMouseDown(e, ab, dir));
  });
  _updateAssetResizeHandlePositions();
  _startAssetResizeRaf();
}

function hideAssetResizeHandles() {
  if (_assetResizeRafId) { cancelAnimationFrame(_assetResizeRafId); _assetResizeRafId = null; }
  _assetResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.asset-overlay-handle').forEach(h => h.remove());
}

function _updateAssetResizeHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_assetResizeBlock) return;
  const HALF = 3.5;
  overlay.querySelectorAll('.asset-overlay-handle').forEach(h => {
    const c = _cornerScreen(_assetResizeBlock, h.dataset.assetResizeDir);
    const top  = c.y - HALF;
    const left = c.x - HALF;
    h.style.top  = top  + 'px';
    h.style.left = left + 'px';
  });
}

function _startAssetResizeRaf() {
  function loop() {
    if (!_assetResizeBlock) return;
    if (!_assetResizeBlock.isConnected || !_assetResizeBlock.classList.contains('selected')) {
      hideAssetResizeHandles();
      return;
    }
    _updateAssetResizeHandlePositions();
    _assetResizeRafId = requestAnimationFrame(loop);
  }
  _assetResizeRafId = requestAnimationFrame(loop);
}

function _onAssetResizeHandleMouseDown(e, ab, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const rect = ab.getBoundingClientRect();
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  // 회전 시 rect는 AABB(부풀림) → 미회전 layout 크기를 기준으로 (회전 0이면 기존과 동일)
  const _rotStart = _blockRotationDeg(ab);
  const startW = _rotStart ? Math.round(ab.offsetWidth)  : Math.round(rect.width  / scale0);
  const startH = _rotStart ? Math.round(ab.offsetHeight) : Math.round(rect.height / scale0);

  const aspectRatio = startW / startH;

  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    // 회전된 에셋: 스크린 델타를 로컬축으로 역회전 (회전 0이면 그대로 → 회귀 0)
    const _rd = _unrotateDelta(ab, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    const dx = _rd.dx;
    const dy = _rd.dy;
    let newW = startW, newH = startH;

    if (ev.shiftKey) {
      // 비례 유지: 더 큰 델타 기준으로 종횡비 고정
      const dw = dir.includes('e') ? dx : dir.includes('w') ? -dx : 0;
      const dh = dir.includes('s') ? dy : dir.includes('n') ? -dy : 0;
      if (Math.abs(dw) >= Math.abs(dh)) {
        newW = Math.min(860, Math.max(100, startW + dw));
        newH = Math.max(40, Math.round(newW / aspectRatio));
      } else {
        newH = Math.max(40, startH + dh);
        newW = Math.min(860, Math.max(100, Math.round(newH * aspectRatio)));
      }
    } else {
      if (dir.includes('e')) newW = Math.min(860, Math.max(100, startW + dx));
      if (dir.includes('w')) newW = Math.min(860, Math.max(100, startW - dx));
      if (dir.includes('s')) newH = Math.max(40, startH + dy);
      if (dir.includes('n')) newH = Math.max(40, startH - dy);
    }
    newW = Math.round(newW); newH = Math.round(newH);
    // 최대폭 복귀 시 ''로 지우면 패딩제외(full-bleed)의 calc()가 사라진다 → 공유 헬퍼로 복원 (08-27)
    if (newW >= 860) window.applyAssetFullBleed?.(ab);   // 폭+음수마진 «세트»로 (width 단독이면 우측이 잘린다)
    else ab.style.width = newW + 'px';
    ab.style.height = newH + 'px';
    // 우측 패널 슬라이더 동기화
    const wNum = document.getElementById('asset-w-number');
    const wSl  = document.getElementById('asset-w-slider');
    const hNum = document.getElementById('asset-h-number');
    const hSl  = document.getElementById('asset-h-slider');
    if (wNum) { wNum.value = newW; if (wSl) wSl.value = newW; }
    if (hNum) { hNum.value = newH; if (hSl) hSl.value = newH; }
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showAssetResizeHandles = showAssetResizeHandles;
window.hideAssetResizeHandles = hideAssetResizeHandles;

/* ═══════════════════════════════════
   MODAL BLOCK — CORNER RADIUS + RESIZE HANDLES (overlay)

   ★에셋 핸들을 «뼈대»로 삼되 코드를 베끼지 않았다 — 두 가지가 다르다.
     ⑴ ★진실이 dataset 이다. renderModalBlock 은 `block.style.cssText = …` 로 인라인 스타일을
        «통째로» 갈아끼운다 ⇒ 에셋처럼 ab.style.width/borderRadius 에 쓰면 재렌더 한 번에 증발한다.
        실측: 인라인 {w:300px, h:222px, r:33px} → renderModalBlock 1회 → {860px, 59.8px, 0px}.
        재렌더는 패널 조작·변형 전환·글자 편집(_modalEndEdit)·로드 어디서든 일어난다.
        ⇒ 드래그가 «끝나면» dataset 이 남아야 한다. 드래그 «중»의 인라인은 미리보기일 뿐이다.
     ⑵ ★클래스가 자기 것(.mdl-*)이다. `.asset-overlay-handle` 을 «빌리면»
        hideAssetResizeHandles() 의 일괄 remove 에 쓸려 나간다 — 아이콘 원형이 실제로 그렇게
        물렸다(실측: 재클릭 시 1→0개, css/editor-blocks.css:223-225 에 기록). CSS 는 «규칙»만 공유한다.
═══════════════════════════════════ */
let _modalRadiusBlock = null;
let _modalRadiusRafId = null;

function showModalRadiusHandles(block) {
  if (_modalRadiusBlock === block) return;
  hideModalRadiusHandles();
  _modalRadiusBlock = block;
  const overlay = _getOverlay();
  if (!overlay) return;

  CORNER_DIRS.forEach(dir => {
    const r = document.createElement('div');
    r.className = `mdl-radius-handle ${dir}`;
    r.dataset.modalRadiusDir = dir;
    r.title = '모서리 반경 조절';
    overlay.appendChild(r);
    r.addEventListener('mousedown', e => _onModalRadiusHandleMouseDown(e, block, dir));
  });

  _updateModalRadiusHandlePositions();
  _startModalRadiusRaf();
}

function hideModalRadiusHandles() {
  if (_modalRadiusRafId) { cancelAnimationFrame(_modalRadiusRafId); _modalRadiusRafId = null; }
  _modalRadiusBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.mdl-radius-handle').forEach(h => h.remove());
}

/* ★INSET 을 «상자 크기에 맞춰» 좁힌다 — 에셋의 INSET=10 은 «화면px» 고정이라
   화면 높이가 20px 미만이면 위·아래 라디우스 핸들이 서로 «교차»한다.
   모달 기본 높이는 60px 이므로 줌 33% 이하에서 실제로 교차한다(실측).
   ⛔에셋 쪽 INSET 을 고치면 «에셋 모습»이 바뀐다(공용이다) — 좁히는 일은 이 함수 안에서만 한다. */
function _updateModalRadiusHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_modalRadiusBlock) return;
  const box = _modalRadiusBlock.getBoundingClientRect();   // 화면px — 줌이 이미 곱해진 값
  const INSET = Math.max(0, Math.min(10, box.width / 2 - 4, box.height / 2 - 4));
  const HALF = 3.5; // 7px 핸들 중앙 정렬
  overlay.querySelectorAll('.mdl-radius-handle').forEach(h => {
    const c = _cornerScreen(_modalRadiusBlock, h.dataset.modalRadiusDir, INSET);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startModalRadiusRaf() {
  function loop() {
    if (!_modalRadiusBlock) return;
    if (!_modalRadiusBlock.isConnected || !_modalRadiusBlock.classList.contains('selected')) {
      hideModalRadiusHandles();
      return;
    }
    _updateModalRadiusHandlePositions();
    _modalRadiusRafId = requestAnimationFrame(loop);
  }
  _modalRadiusRafId = requestAnimationFrame(loop);
}

function _onModalRadiusHandleMouseDown(e, block, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  /* ★시작값을 style.borderRadius 에서 읽지 «않는다»(에셋은 거기서 읽는다).
     모달은 dataset 이 진실이고, 인라인은 재렌더에 증발하는 미리보기일 뿐이다. */
  const startR = clampModal(block.dataset.radius, MODAL_LIMITS.radius);
  let moved = false;

  function onMove(ev) {
    const scale = _canvasScaleNow();
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    if (!moved) {
      if (Math.hypot(dx, dy) < 1) return;
      moved = true;
    }
    // 모서리에서 «안쪽»으로 끌면 커진다 — 네 모서리의 부호는 에셋 라디우스와 같은 규약
    const delta = dir === 'nw' ? (dx + dy) / 2
                : dir === 'ne' ? (-dx + dy) / 2
                : dir === 'sw' ? (dx - dy) / 2
                : (-dx - dy) / 2;
    const newR = clampModal(startR + delta, MODAL_LIMITS.radius);
    block.dataset.radius = String(newR);              // ★진실
    block.style.borderRadius = newR + 'px';           // 미리보기(끝나면 재렌더가 같은 값으로 굳힌다)
    /* 패널의 «두 필드»를 다 맞춘다 — 하나만 맞추면 슬라이더와 숫자가 갈라진다.
       슬라이더 step 은 1 이어야 홀수를 담는다(prop-modal.js 의 별도 줄). */
    const slider = document.getElementById('mdl-radius-slider');
    const num    = document.getElementById('mdl-radius-number');
    if (slider) slider.value = String(newR);
    if (num)    num.value    = String(newR);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (!moved) return;
    window.renderModalBlock?.(block);   // ★dataset 을 «그림»으로 굳힌다
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showModalRadiusHandles = showModalRadiusHandles;
window.hideModalRadiusHandles = hideModalRadiusHandles;

/* ── 모달 리사이즈 핸들 (네 모서리) ── */
let _modalResizeBlock = null;
let _modalResizeRafId = null;

function showModalResizeHandles(block) {
  if (_modalResizeBlock === block) return;
  hideModalResizeHandles();
  _modalResizeBlock = block;
  const overlay = _getOverlay();
  if (!overlay) return;

  CORNER_DIRS.forEach(dir => {
    const h = document.createElement('div');
    h.className = `mdl-overlay-handle ${dir}`;
    h.dataset.modalResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onModalResizeHandleMouseDown(e, block, dir));
  });
  _updateModalResizeHandlePositions();
  _startModalResizeRaf();
}

function hideModalResizeHandles() {
  if (_modalResizeRafId) { cancelAnimationFrame(_modalResizeRafId); _modalResizeRafId = null; }
  _modalResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.mdl-overlay-handle').forEach(h => h.remove());
}

function _updateModalResizeHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_modalResizeBlock) return;
  const HALF = 3.5;
  overlay.querySelectorAll('.mdl-overlay-handle').forEach(h => {
    const c = _cornerScreen(_modalResizeBlock, h.dataset.modalResizeDir);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startModalResizeRaf() {
  function loop() {
    if (!_modalResizeBlock) return;
    if (!_modalResizeBlock.isConnected || !_modalResizeBlock.classList.contains('selected')) {
      hideModalResizeHandles();
      return;
    }
    _updateModalResizeHandlePositions();
    _modalResizeRafId = requestAnimationFrame(loop);
  }
  _modalResizeRafId = requestAnimationFrame(loop);
}

function _onModalResizeHandleMouseDown(e, block, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  const startW = Math.round(block.offsetWidth);
  const startH = Math.round(block.offsetHeight);
  const sx = dir.includes('e') ? 1 : -1;
  const sy = dir.includes('s') ? 1 : -1;
  let moved = false;

  function onMove(ev) {
    const scale = _canvasScaleNow();
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    if (!moved) {
      if (Math.hypot(dx, dy) < 1) return;
      moved = true;
      /* ★크기를 «고정»으로 돌리는 것도, 재렌더도 여기 «한 번»뿐이다.
         full → fixed 는 margin-left/right:auto 를 같이 주므로(가운데 정렬) 상자의 기하가
         통째로 바뀐다. 그 변화를 드래그 «중»에 인라인으로 흉내 내면 손을 떼는 순간 튄다. */
      /* ★모드를 바꾸는 문은 하나다 — 「늘어나는 그 순간」의 자동 가운데정렬도 그 안에서 난다.
         여기서 dataset 을 직접 쓰면 핸들 드래그만 «그 순간»을 못 만든다. */
      setModalSizeMode(block, 'w', 'fixed');
      setModalSizeMode(block, 'h', 'fixed');
      block.dataset.width  = String(clampModal(startW, MODAL_LIMITS.width));
      block.dataset.height = String(clampModal(startH, MODAL_LIMITS.height));
      window.renderModalBlock?.(block);
    }
    /* ★★가로는 Δ = 2·dx 다. wMode:'fixed' 가 margin-left/right:auto 를 같이 주므로 상자가
       호스트 «정중앙»에 선다(실측: 폭400 이 860 호스트에서 left=230 = 정중앙).
       가운데 고정 상자는 폭이 Δ 늘 때 각 변이 Δ/2 만 움직인다 ⇒ 에셋 산식(Δ=dx)을 그대로
       쓰면 «커서 100px 에 모서리 50px» 이 된다. w·e 양쪽 다.
       ⚠️세로는 1배다 — 위 변이 흐름에 박혀 있어 상자는 아래로만 자란다. */
    const newW = clampModal(startW + sx * dx * 2, MODAL_LIMITS.width);
    const newH = clampModal(startH + sy * dy,     MODAL_LIMITS.height);
    /* ★dataset 이 진실이다 — 인라인 style 은 재렌더가 cssText 를 갈아끼울 때 증발한다. */
    block.dataset.width  = String(newW);
    block.dataset.height = String(newH);
    /* ⛔mousemove 마다 renderModalBlock 을 부르지 않는다 — innerHTML 을 통째로 갈아끼우므로
       ⑴프레임 드랍 ⑵캐럿·선택 소실 ⑶raster 아이콘의 <img src> 가 매 프레임 새로 만들어져
       깜빡인다. 드래그 «중»엔 인라인 두 줄만 얹는다(끝나면 재렌더가 같은 값으로 덮는다).
       ⚠️height 는 min-height 다 — 내용이 더 크면 상자가 내용을 따른다(안 잘린다). */
    block.style.width = newW + 'px';
    block.style.minHeight = newH + 'px';
    const wNum = document.getElementById('mdl-w-number');
    const hNum = document.getElementById('mdl-h-number');
    if (wNum) wNum.value = String(newW);
    if (hNum) hNum.value = String(newH);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (!moved) return;
    window.renderModalBlock?.(block);       // ★dataset 을 «그림»으로 굳힌다
    window.showModalProperties?.(block);    // 풀폭/고정 버튼·비활성 상태가 실제와 맞게
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showModalResizeHandles = showModalResizeHandles;
window.hideModalResizeHandles = hideModalResizeHandles;

/* ═══════════════════════════════════
   ICON-CIRCLE BLOCK RESIZE HANDLE (overlay, east-only, square-constrained)
═══════════════════════════════════ */
let _icbResizeBlock = null;
let _icbResizeRafId = null;

function showIconCircleResizeHandle(block) {
  if (_icbResizeBlock === block) return;
  hideIconCircleResizeHandle();
  _icbResizeBlock = block;
  const overlay = _getOverlay();
  if (!overlay) return;

  /* ★네 «모서리»에 다 단다 — 에셋 블록(.asset-block)과 개수·종류를 맞춘다.
   * 전엔 se 한 개뿐이라 「다른 에셋 블럭과 조금씩 다르다」(현빈)의 한 축이었다.
   * ⚠️클래스는 `.icb-overlay-handle` — `.asset-overlay-handle` 을 «빌려 쓰면»
   *   `hideAssetResizeHandles()` 의 일괄 제거에 같이 쓸려나간다(실측 재현: 재클릭 시 1→0). */
  const _handles = CORNER_DIRS.map(dir => {
    const h = document.createElement('div');
    h.className = `icb-overlay-handle ${dir}`;
    h.dataset.icbResize = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onIcbResizeMouseDown(e, block, dir));
    return h;
  });

  function _onIcbResizeMouseDown(e, block, dir) {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startSize = parseInt(block.dataset.size) || 240;
    const { sx, sy } = cornerSign(dir);

    function onMove(ev) {
      const scaler = document.getElementById('canvas-scaler');
      const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
      // #14b 회전 인식: 스크린 델타를 블록 로컬축으로 역회전(회전0=그대로)
      const _ud = _unrotateDelta(block, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
      // 바깥으로 끌면 커진다 — 모서리마다 «바깥»의 부호가 달라 위 표로 뒤집는다.
      const dx = _ud.dx * sx, dy = _ud.dy * sy;
      const delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
      const newSize = Math.min(860, Math.max(40, Math.round(startSize + delta)));
      const circle = block.querySelector('.icb-circle');
      if (circle) { circle.style.width = newSize + 'px'; circle.style.height = newSize + 'px'; }
      block.dataset.size = newSize;
      // prop panel sync
      const sl = document.getElementById('icb-size-slider');
      const nb = document.getElementById('icb-size-number');
      if (sl) sl.value = newSize;
      if (nb) nb.value = newSize;
      window.scheduleAutoSave?.();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.pushHistory?.();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function _updatePos() {
    if (!_icbResizeBlock) return;
    const circle = block.querySelector('.icb-circle');
    if (!circle) return;
    const rect = circle.getBoundingClientRect();
    /* ★핸들은 «상자 꼭지점»에 둔다 — 다른 모든 블록과 같은 자리다(현빈 확정).
     * 「원처럼 보이는 일」은 아웃라인이 맡는다(.icon-circle-block.selected 의 border-radius:50%).
     * ⇒ 잡는 자리는 앱 전체가 동일하고, 보이는 모양만 블록마다 다르다. */
    /* ★반지름은 «레이아웃 폭»에서 낸다 — rect.width 를 쓰면 회전했을 때 부푼다.
     * getBoundingClientRect 는 회전된 요소의 «축정렬 바운딩박스(AABB)» 라
     * 30° 회전 시 96px 원의 rect 가 131px 로 잡혔다(실측) → 핸들이 원 밖 17.5px 로 떠버린다.
     * 회전은 중심을 보존하므로 «중심은 rect 에서», «반지름은 offsetWidth×캔버스배율»에서 가져온다.
     * 원은 회전대칭이라 45° 화면좌표에 그대로 두면 어느 각도에서도 둘레에 밀착한다. */
    const R  = (circle.offsetWidth * _canvasScaleNow()) / 2;
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;
    const off = circumferenceOffset(R);   // 45° 둘레점까지의 축별 거리(공용 헬퍼)
    _handles.forEach(h => {
      const { sx, sy } = cornerSign(h.dataset.icbResize);
      h.style.left = (cx + off * sx - 3.5) + 'px';
      h.style.top  = (cy + off * sy - 3.5) + 'px';
    });
  }
  function _loop() {
    if (!_icbResizeBlock) return;
    if (!_icbResizeBlock.isConnected || !_icbResizeBlock.classList.contains('selected')) {
      hideIconCircleResizeHandle(); return;
    }
    _updatePos();
    _icbResizeRafId = requestAnimationFrame(_loop);
  }
  _updatePos();
  _icbResizeRafId = requestAnimationFrame(_loop);
}

function hideIconCircleResizeHandle() {
  if (_icbResizeRafId) { cancelAnimationFrame(_icbResizeRafId); _icbResizeRafId = null; }
  _icbResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('[data-icb-resize]').forEach(h => h.remove());
}

window.showIconCircleResizeHandle = showIconCircleResizeHandle;
window.hideIconCircleResizeHandle = hideIconCircleResizeHandle;

/* ═══════════════════════════════════
   CANVAS BLOCK RADIUS HANDLES (overlay)
═══════════════════════════════════ */
let _canvasRadiusBlock = null;
let _canvasRadiusRafId = null;

function showCanvasRadiusHandles(cb) {
  if (_canvasRadiusBlock === cb) return;
  hideCanvasRadiusHandles();
  _canvasRadiusBlock = cb;
  const overlay = _getOverlay();
  if (!overlay) return;

  /* ★[M39] 현빈 2026-09-05: 「카드 블럭 코너라디우스 조절하는거 좌측 상단에만 핸들이 있는데」
     옛 코드는 'nw' 를 «문자열로 박아» 한 개만 만들었다. 에셋 블록(:611)은 처음부터
     CORNER_DIRS 네 개를 돈다 — 같은 표를 쓰게 맞춘다(핸들 CSS 는 방향별 규칙이 없어 그대로 쓴다). */
  CORNER_DIRS.forEach(dir => {
    const r = document.createElement('div');
    r.className = `canvas-radius-handle ${dir}`;
    r.dataset.canvasRadiusDir = dir;
    r.title = '모서리 반경 조절';
    overlay.appendChild(r);
    r.addEventListener('mousedown', e => _onCanvasRadiusHandleMouseDown(e, cb, dir));
  });

  _updateCanvasRadiusHandlePositions();
  _startCanvasRadiusRaf();
}

function hideCanvasRadiusHandles() {
  if (_canvasRadiusRafId) { cancelAnimationFrame(_canvasRadiusRafId); _canvasRadiusRafId = null; }
  _canvasRadiusBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.canvas-radius-handle').forEach(h => h.remove());
}

function _updateCanvasRadiusHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_canvasRadiusBlock) return;
  const INSET = 10;
  const HALF  = 3.5; // 7px 핸들 중앙 정렬
  /* ★[M39] 옛 코드는 rect.top/left 로 «좌상단 하나»만 계산했다. 에셋 판(:638)과 같은
     _cornerScreen(el, dir, inset) 을 쓴다 — 이건 «회전한 블록»의 모서리도 맞게 돌려준다
     (rect 기반 계산은 회전하면 어긋난다. 카드가 회전 대상이 되면 옛 식은 조용히 틀린다). */
  overlay.querySelectorAll('.canvas-radius-handle').forEach(h => {
    const c = _cornerScreen(_canvasRadiusBlock, h.dataset.canvasRadiusDir, INSET);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startCanvasRadiusRaf() {
  function loop() {
    if (!_canvasRadiusBlock) return;
    if (!_canvasRadiusBlock.isConnected || !_canvasRadiusBlock.classList.contains('selected')) {
      hideCanvasRadiusHandles();
      return;
    }
    _updateCanvasRadiusHandlePositions();
    _canvasRadiusRafId = requestAnimationFrame(loop);
  }
  _canvasRadiusRafId = requestAnimationFrame(loop);
}

function _onCanvasRadiusHandleMouseDown(e, cb, dir = 'nw') {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startRadius = parseInt(cb.dataset.radius) || 0;

  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    /* ★[M39] 현빈 2026-09-05: 「드래그하면 에셋블럭의 모서리 코너핸들과 라디우스 적용되는게
       반대인데 카드블럭을 고쳐줘」 — 정본은 «에셋»이라고 현빈이 지정했다.
       ⑴ 부호가 뒤집혀 있었다: 에셋은 `startRadius + delta`, 카드만 `- delta` 였다.
          같은 방향으로 끌면 에셋은 «커지고» 카드는 «작아졌다».
       ⑵ 그리고 옛 식은 방향을 안 봤다(항상 nw 판 (dx+dy)/2). 핸들이 하나뿐이라 티가 안 났을
          뿐이고, 네 개로 늘리는 순간 ne·sw·se 가 «반대로» 움직인다 — ①을 고치면 반드시
          같이 고쳐야 하는 자리다(둘은 한 결함의 두 얼굴이다).
       ⇒ 에셋(:670)과 «같은 식»을 쓴다. 안쪽으로 끌면 커진다.
       ⚠️상한 60 은 카드의 «설계 상수»라 그대로 둔다(에셋 120 과 다른 건 의도 — 카드가 더 작다). */
    const { sx, sy } = cornerSign(dir);
    const delta = (-sx * dx + -sy * dy) / 2;
    const newR = Math.min(60, Math.max(0, Math.round(startRadius + delta)));
    cb.dataset.radius = String(newR);
    window.renderCanvas(cb);
    const rSlider = document.getElementById('cvb-radius-slider');
    const rNumber = document.getElementById('cvb-radius-number');
    if (rSlider) rSlider.value = String(newR);
    if (rNumber) rNumber.value = String(newR);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showCanvasRadiusHandles = showCanvasRadiusHandles;
window.hideCanvasRadiusHandles = hideCanvasRadiusHandles;

/* ═══════════════════════════════════
   CANVAS BLOCK RESIZE HANDLES (overlay)
═══════════════════════════════════ */
let _canvasResizeBlock = null;
let _canvasResizeRafId = null;

function showCanvasResizeHandles(cb) {
  if (_canvasResizeBlock === cb) return;
  hideCanvasResizeHandles();
  _canvasResizeBlock = cb;
  const overlay = _getOverlay();
  if (!overlay) return;

  const dirs = ['nw', 'ne', 'sw', 'se'];
  dirs.forEach(dir => {
    const h = document.createElement('div');
    h.className = `canvas-overlay-handle ${dir}`;
    h.dataset.canvasResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onCanvasResizeHandleMouseDown(e, cb, dir));
  });
  _updateCanvasResizeHandlePositions();
  _startCanvasResizeRaf();
}

function hideCanvasResizeHandles() {
  if (_canvasResizeRafId) { cancelAnimationFrame(_canvasResizeRafId); _canvasResizeRafId = null; }
  _canvasResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.canvas-overlay-handle').forEach(h => h.remove());
}

function _updateCanvasResizeHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_canvasResizeBlock) return;
  const HALF = 3.5;
  overlay.querySelectorAll('.canvas-overlay-handle').forEach(h => {
    const dir = h.dataset.canvasResizeDir;
    const c = _cornerScreen(_canvasResizeBlock, dir); // #14b 회전 인식(회전0=rect 모서리 동일)
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startCanvasResizeRaf() {
  function loop() {
    if (!_canvasResizeBlock) return;
    if (!_canvasResizeBlock.isConnected || !_canvasResizeBlock.classList.contains('selected')) {
      hideCanvasResizeHandles();
      return;
    }
    _updateCanvasResizeHandlePositions();
    _canvasResizeRafId = requestAnimationFrame(loop);
  }
  _canvasResizeRafId = requestAnimationFrame(loop);
}

function _onCanvasResizeHandleMouseDown(e, cb, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startW = parseInt(cb.dataset.canvasW) || 360;
  const startH = parseInt(cb.dataset.canvasH) || 400;
  // 최대 폭 = 섹션 내부 콘텐츠폭(좌우 패딩 제외) — 프레임 리사이즈 로직(상단 _onResizeHandleMouseDown:110-113)과 동일.
  // 기존엔 860 하드코딩이라 우측 확대 시 섹션 우측패딩을 침범(좌측만 지켜 좌우 비대칭)했음.
  const _secInner = cb.closest('.section-inner') || cb.closest('.section-block');
  const _secCS = _secInner ? getComputedStyle(_secInner) : null;
  const _padH = _secCS ? (parseFloat(_secCS.paddingLeft) || 0) + (parseFloat(_secCS.paddingRight) || 0) : 0;
  const _innerW = _secInner ? _secInner.clientWidth : 0;
  // 레이아웃 미확정/detached 등으로 clientWidth=0(또는 NaN)이면 860 폴백 (실제 리사이즈는 렌더된 카드에서만 발생하므로 정상 경로엔 영향 없음)
  const _maxWcalc = Math.round(_innerW - _padH);
  const maxW = (_innerW > 0 && _maxWcalc > 0) ? _maxWcalc : 860;

  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    // #14b 회전 인식: 스크린 델타를 블록 로컬축으로 역회전(회전0=그대로)
    const _ud = _unrotateDelta(cb, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    const dx = _ud.dx, dy = _ud.dy;
    let newW = startW, newH = startH;
    if (dir.includes('e')) newW = Math.min(maxW, Math.max(100, startW + dx));
    if (dir.includes('w')) newW = Math.min(maxW, Math.max(100, startW - dx));
    if (dir.includes('s')) newH = Math.max(40, startH + dy);
    if (dir.includes('n')) newH = Math.max(40, startH - dy);
    newW = Math.round(newW); newH = Math.round(newH);
    cb.dataset.canvasW = String(newW);
    cb.dataset.canvasH = String(newH);
    window.renderCanvas(cb);
    const wInput = document.getElementById('cvb-w');
    const hInput = document.getElementById('cvb-h');
    if (wInput) wInput.value = String(newW);
    if (hInput) hInput.value = String(newH);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showCanvasResizeHandles = showCanvasResizeHandles;
window.hideCanvasResizeHandles = hideCanvasResizeHandles;

// ── Vector Block overlay resize handles ──────────────────────────────────────
let _vectorResizeBlock = null;
let _vectorResizeRafId = null;

function showVectorResizeHandles(vb) {
  if (_vectorResizeBlock === vb) return;
  hideVectorResizeHandles();
  _vectorResizeBlock = vb;
  const overlay = _getOverlay();
  if (!overlay) return;

  const dirs = ['nw', 'ne', 'sw', 'se'];
  dirs.forEach(dir => {
    const h = document.createElement('div');
    h.className = `vector-overlay-handle ${dir}`;
    h.dataset.vectorResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onVectorResizeHandleMouseDown(e, vb, dir));
  });
  _updateVectorResizeHandlePositions();
  _startVectorResizeRaf();
}

function hideVectorResizeHandles() {
  if (_vectorResizeRafId) { cancelAnimationFrame(_vectorResizeRafId); _vectorResizeRafId = null; }
  _vectorResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.vector-overlay-handle').forEach(h => h.remove());
}

function _updateVectorResizeHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_vectorResizeBlock) return;
  const HALF = 3.5;
  overlay.querySelectorAll('.vector-overlay-handle').forEach(h => {
    const dir = h.dataset.vectorResizeDir;
    const c = _cornerScreen(_vectorResizeBlock, dir); // #14b 회전 인식(회전0=rect 모서리 동일)
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startVectorResizeRaf() {
  function loop() {
    if (!_vectorResizeBlock) return;
    if (!_vectorResizeBlock.isConnected || !_vectorResizeBlock.classList.contains('selected')) {
      hideVectorResizeHandles();
      return;
    }
    _updateVectorResizeHandlePositions();
    _vectorResizeRafId = requestAnimationFrame(loop);
  }
  _vectorResizeRafId = requestAnimationFrame(loop);
}

function _onVectorResizeHandleMouseDown(e, vb, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const startW = parseInt(vb.dataset.w) || 120;
  const startH = parseInt(vb.dataset.h) || 120;

  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    // #14b 회전 인식: 스크린 델타를 블록 로컬축으로 역회전(회전0=그대로)
    const _ud = _unrotateDelta(vb, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    const dx = _ud.dx, dy = _ud.dy;
    let newW = startW, newH = startH;
    if (dir.includes('e')) newW = Math.max(20, startW + dx);
    if (dir.includes('w')) newW = Math.max(20, startW - dx);
    if (dir.includes('s')) newH = Math.max(20, startH + dy);
    if (dir.includes('n')) newH = Math.max(20, startH - dy);
    newW = Math.round(newW); newH = Math.round(newH);
    vb.dataset.w = String(newW);
    vb.dataset.h = String(newH);
    window.renderVector(vb);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showVectorResizeHandles = showVectorResizeHandles;
window.hideVectorResizeHandles = hideVectorResizeHandles;

/* ═══════════════════════════════════
   GRID BLOCK ROW/COLUMN GUTTER OVERLAY (P2 — 셀 경계 드래그, PLAN-gridblock.md §5)
   grid-block(사용자에게는 「그리드 블럭」)이 선택돼 있을 때 열/행 경계에 드래그 가능한
   거터(grd-gutter)를 띄운다. 여기 있는 6종 handle(frame/mockup/icon/asset/canvas/vector)은
   전부 블록 «바깥 테두리»를 px로 늘리는 핸들이라 못 쓴다(PLAN §5-A) — 대신 이 파일의
   #ss-handles-overlay 자리와 rAF 위치갱신·hide 패턴만 그대로 빌린다.
   ⛔거터 DOM 을 블록 «안»에 넣지 않는다 — #ss-handles-overlay는 #canvas-scaler 바깥(캔버스
     클론 대상 밖)이라 저장본·export 에 새지 않는다(완료조건① — section-serialize.js가
     세척하는 root 자체에 애초에 없음).
   ★열 값은 항상 «가중치»(cols[i].width, px 미사용 — 폭 계산 함정 회피). 행 값은 «px 최소높이»
     (rows[r].height) — 재분배가 아니라 «위 행 하나만» 바뀐다(P1 R2 모델, PLAN §3-A/§5-B-3).
   ★DOM 구조(2026-09-04 P1 병합) — flex `.duo-col` → CSS grid `.grd-cell[data-r][data-c]`.
     열 경계는 행0(data-r="0")의 인접 셀, 행 경계는 열0(data-c="0")의 인접 셀에서 rect를 잰다
     (grid-template-columns/rows 가 블록 전역이라 어느 행/열을 봐도 폭/높이는 같다).
═══════════════════════════════════ */
let _gridGutterBlock = null;
let _gridGutterRafId = null;

function _getGridCell(block, r, c) {
  return block.querySelector(`:scope > .grd-inner > .grd-cell[data-r="${r}"][data-c="${c}"]`);
}

function showGridGutters(block) {
  const { cols, rows } = getGridModel(block);   // 단일 진실원(grid-block.js) — 여기서 재파싱하지 않는다
  /* ★같은 블록이어도 «격자 수»가 바뀌었으면 다시 세워야 한다.
   * 전엔 `_gridGutterBlock === block` 이면 위치만 갱신하고 return 했다 —
   * 그래서 3x3 으로 바꿔도 거터가 옛 개수 그대로였다(실측: col 1개).
   * 피커 경로만 밖에서 강제로 고쳤더니 updateGridBlock→showGridProperties 경로가 그대로 남았다.
   * 고칠 자리는 «여기»다 — 개수 비교를 조기 return 조건에 넣는다. */
  /* ★«축별»로 센다. 합으로 비교하면 3x2 → 2x3 처럼 «합이 같은» 전환에서
   * 재생성이 안 돌아 row 거터가 하나 안 생긴다(적대검수 2차 지적).
   * 열 2 + 행 1 = 3 과 열 1 + 행 2 = 3 은 합이 같지만 «다른 격자»다. */
  const needCol = Math.max(0, cols.length - 1);
  const needRow = Math.max(0, rows.length - 1);
  if (_gridGutterBlock === block) {
    const ovl = _getOverlay();
    const haveCol = ovl ? ovl.querySelectorAll('.grd-gutter[data-axis="col"]').length : 0;
    const haveRow = ovl ? ovl.querySelectorAll('.grd-gutter[data-axis="row"]').length : 0;
    if (haveCol === needCol && haveRow === needRow) { _updateGridGutterPositions(); return; }
  }
  hideGridGutters();
  if (cols.length < 2 && rows.length < 2) return; // 경계가 하나도 없다
  _gridGutterBlock = block;
  const overlay = _getOverlay();
  if (!overlay) return;
  for (let i = 0; i < cols.length - 1; i++) {
    const g = document.createElement('div');
    g.className = 'grd-gutter';
    g.dataset.axis = 'col';
    g.dataset.i = String(i);
    // ★position:absolute — #ss-handles-overlay 자체가 position:fixed;inset:0(css/editor-blocks.css:78)
    //   이라 자식은 absolute 로 둬도 좌표계가 뷰포트와 같다(.ss-resize-handle 등 기존 핸들과 동일 관례).
    g.style.cssText = 'position:absolute;width:8px;cursor:col-resize;z-index:97;pointer-events:auto;';
    overlay.appendChild(g);
    g.addEventListener('mousedown', e => _onGridColMouseDown(e, block, i));
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const g = document.createElement('div');
    g.className = 'grd-gutter';
    g.dataset.axis = 'row';
    g.dataset.i = String(i);
    g.style.cssText = 'position:absolute;height:8px;cursor:row-resize;z-index:97;pointer-events:auto;';
    overlay.appendChild(g);
    g.addEventListener('mousedown', e => _onGridRowMouseDown(e, block, i));
  }
  _updateGridGutterPositions();
  _startGridGutterRaf();
}

function hideGridGutters() {
  if (_gridGutterRafId) { cancelAnimationFrame(_gridGutterRafId); _gridGutterRafId = null; }
  _gridGutterBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.grd-gutter').forEach(g => g.remove());
}

function _startGridGutterRaf() {
  function loop() {
    if (!_gridGutterBlock) return;
    // 블록이 DOM에서 사라졌거나 선택 해제되면 거터 제거 — showFrameHandles rAF 패턴과 동일.
    if (!_gridGutterBlock.isConnected || !_gridGutterBlock.classList.contains('selected')) {
      hideGridGutters();
      return;
    }
    _updateGridGutterPositions();
    _gridGutterRafId = requestAnimationFrame(loop);
  }
  _gridGutterRafId = requestAnimationFrame(loop);
}

/* ═══ [M64] 행 거터가 «낮은 배율에서» 칸의 편집 진입을 삼킨다 ═══════════════════════
   미니4호기 윈도우 QA 보고 → 맥 재현(2026-09-06, 9371 · 3열×4행 · 행높이 210px).
   ⛔보고서의 「거터가 21px 짜리 칸을 통째로 덮는다」는 «틀렸다» — 실측하면 거터는 칸의
     «맨 위 2.8px»만 덮는다. 문제는 덮는 «넓이»가 아니라 «자리»다:
       · 편집 가능한 표적은 칸 전체가 아니라 그 안의 글줄(`[data-line]`) «하나»다.
       · valign:top 이라 글줄은 칸의 «맨 위»에 붙는다 — 거터가 파고드는 바로 그 자리다.
       · 10% 에서 글줄 높이 = 35.2×0.1 = 3.52px, 그 중앙은 칸 위끝에서 1.76px.
         거터는 위끝에서 2.8px 까지 덮는다(4 − gap·s/2 = 4 − 1.2). 1.76 < 2.8 ⇒ 삼킨다.
   [실측 — «진짜 더블클릭»(Input.dispatchMouseEvent clickCount 1→2) 12칸 × 배율]
       10%: 편집진입 3/12 (막힘 9, 전부 거터)      13%: 3/12 (막힘 9)
       15%: 12/12                                  25%·40%: 12/12    100%: 9/9(3칸 화면밖)
     ★막히는 칸은 «위에 거터가 있는 행»(1·2·3행) 전부고, 0행은 10% 에서도 들어간다 —
       0행 위에는 경계가 없다. 이 대조가 「10% 라서 다 안 되는 것」이 아님을 증명한다.
     ★깨지는 구간은 s < 4/((gap+lineH)/2) = 4/29.6 ≈ 0.135 — 즉 «10~13%» 뿐이다(측정과 일치).
   ⛔그냥 얇게 만들면 안 된다 — 거터가 «화면 고정 8px»인 건 낮은 배율에서 «잡으라»는 뜻이다.
     8px 를 4px 로 줄이면 이번엔 거터를 못 잡는다. ⇒ «둘 다 잡히는» 자리를 찾아야 한다.
   ★답 = 거터를 경계 «중앙 정렬»에서 풀고, 위/아래 절반을 «각자» 이웃 칸의 글줄 중앙까지만
     뻗게 한다(비대칭 허용). valign:top 이면 위 칸의 «아래쪽»은 언제나 비어 있으므로
     위 절반이 4px 를 그대로 갖고, 아래 절반만 글줄을 피해 줄어든다:
       10% 실측 → 위 4.00 + 아래 2.21 = 6.21px 거터(잡을 수 있다) · 글줄 중앙은 0.75px 여유로 열림.
   ⚠️대가 ⑴ 아주 낮은 배율에서 거터가 경계보다 «살짝 위»에 앉는다(비대칭). 경계선 자체는
        위 절반 4px 가 여전히 덮으므로 「보이는 선을 누르면 잡힌다」는 유지된다.
     ⑵ 위·아래 «둘 다» 글줄이 경계에 붙은 병리적 배치(valign:bottom + 다음 칸 top)에서는
        GUT_MIN_TOTAL floor 가 이겨서 거터가 글줄을 조금 덮는다 — 「거터를 아예 못 잡는다」보다
        낫다고 판단했다. 그 경우에도 사용자는 배율을 올려 편집할 수 있다.
     ⑶ 낮은 배율에서만 글줄 rect 를 읽는다(GUT_PROBE_H 게이트) — 보통 배율에선 추가 비용 0.
   ⛔열 거터는 «안 건드린다» — 글줄은 칸 폭을 가득 채우므로 가로 중앙은 열 거터에서 11px 떨어져
     있고, 실측에서도 열 거터로 막힌 칸은 0 건이었다. 고칠 근거가 없는 것은 안 고친다.
═══════════════════════════════════════════════════════════════════════════════ */
const GUT_HALF_MAX   = 4;    // 기존 8px 거터의 «절반» — 상한(높은 배율에선 이 값 그대로)
const GUT_MIN_TOTAL  = 5;    // 거터 최소 두께(px). 이 아래로는 «못 잡는다»
const GUT_CONTENT_EPS = 0.75; // 글줄 중앙을 이만큼은 «반드시» 비워 둔다
const GUT_PROBE_H    = 64;   // 칸이 이보다 높으면 8px 거터가 글줄 중앙에 닿을 수 없다 → 조사 생략

/** 경계 중앙 cy 에서 위/아래 한계선을 받아 거터 띠([top, height])를 낸다 — 순수함수(단위검사 대상).
 *  upLimit   = 거터가 «이 y 아래»로만 갈 수 있다(위 칸 글줄 중앙 + eps). null = 제약 없음
 *  downLimit = 거터가 «이 y 위»로만 갈 수 있다(아래 칸 글줄 중앙 − eps). null = 제약 없음 */
function _rowGutterBand(cy, upLimit, downLimit) {
  let halfUp   = upLimit   == null ? GUT_HALF_MAX : Math.min(GUT_HALF_MAX, Math.max(0, cy - upLimit));
  let halfDown = downLimit == null ? GUT_HALF_MAX : Math.min(GUT_HALF_MAX, Math.max(0, downLimit - cy));
  /* ★floor — 내용이 양쪽에서 밀어붙여도 «잡을 수 있는» 두께는 남긴다.
     남는 여유가 있는 쪽(주로 위 칸의 빈 아래쪽)부터 채운다. */
  let deficit = GUT_MIN_TOTAL - (halfUp + halfDown);
  if (deficit > 0) {
    const take = Math.min(deficit, GUT_HALF_MAX - halfUp);
    halfUp += take; deficit -= take;
    if (deficit > 0) halfDown = Math.min(GUT_HALF_MAX, halfDown + deficit);
  }
  return { top: cy - halfUp, height: halfUp + halfDown };
}

/** 행 r 의 «경계쪽 글줄 중앙»(화면 y). dir='up' = 그 행이 경계 위(마지막 줄), 'down' = 아래(첫 줄).
 *  ★열을 «전부» 훑는다 — 거터는 블록 폭 전체를 덮으므로 한 열만 보면 다른 열이 계속 막힌다. */
function _rowContentEdge(block, r, dir) {
  const inner = block.querySelector(':scope > .grd-inner');
  if (!inner) return null;
  let edge = null;
  for (const cell of inner.querySelectorAll(`:scope > .grd-cell[data-r="${r}"]`)) {
    const lines = cell.querySelectorAll('[data-line]');
    if (!lines.length) continue;
    const lr = (dir === 'up' ? lines[lines.length - 1] : lines[0]).getBoundingClientRect();
    if (!(lr.height > 0)) continue;
    const mid = lr.top + lr.height / 2;
    const v = dir === 'up' ? mid + GUT_CONTENT_EPS : mid - GUT_CONTENT_EPS;
    if (edge === null || (dir === 'up' ? v > edge : v < edge)) edge = v;
  }
  return edge;
}

function _updateGridGutterPositions() {
  const overlay = _getOverlay();
  if (!overlay || !_gridGutterBlock) return;
  const block = _gridGutterBlock;
  const blockRect = block.getBoundingClientRect();
  overlay.querySelectorAll('.grd-gutter[data-axis="col"]').forEach(g => {
    const i = +g.dataset.i;
    const a = _getGridCell(block, 0, i), b = _getGridCell(block, 0, i + 1);
    if (!a || !b) { g.style.display = 'none'; return; }
    g.style.display = '';
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const cx = (ar.right + br.left) / 2; // 두 열 사이 gap 의 중앙(스크린 좌표, 스케일 반영된 rect)
    g.style.left = (cx - 4) + 'px';      // 8px 폭 중앙 정렬
    g.style.top = blockRect.top + 'px';
    g.style.height = blockRect.height + 'px';
  });
  overlay.querySelectorAll('.grd-gutter[data-axis="row"]').forEach(g => {
    const i = +g.dataset.i;
    const a = _getGridCell(block, i, 0), b = _getGridCell(block, i + 1, 0);
    if (!a || !b) { g.style.display = 'none'; return; }
    g.style.display = '';
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const cy = (ar.bottom + br.top) / 2; // 두 행 사이 gap 의 중앙
    /* [M64] 낮은 배율에서만 이웃 글줄을 조사해 «편집 표적»을 비켜 앉는다(위 큰 주석 참조).
       칸이 충분히 크면 8px 거터가 글줄 중앙까지 닿을 수 없으므로 rect 를 읽지 않는다. */
    const probe = ar.height < GUT_PROBE_H || br.height < GUT_PROBE_H;
    const band = _rowGutterBand(
      cy,
      probe ? _rowContentEdge(block, i, 'up') : null,
      probe ? _rowContentEdge(block, i + 1, 'down') : null,
    );
    g.style.top = band.top + 'px';
    g.style.height = band.height + 'px';
    g.style.left = blockRect.left + 'px';
    g.style.width = blockRect.width + 'px';
  });
}

// 열 경계 드래그 — 인접 두 열의 «가중치»만 재분배(합 보존, 다른 열 불변).
// wL0/wR0(화면 px, 스케일로 나눈 캔버스 px)와 W(가중치 합)는 mousedown 시점 1회 스냅샷 —
// mousemove 는 여기서 튄 델타만 resizeColBoundary(순수함수, grid-cell-resize.js)에 먹인다.
function _onGridColMouseDown(e, block, i) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const cols = gridCols(block);   // 클램프·폴백까지 반영된 단일 진실원(grid-block.js)
  if (!cols[i] || !cols[i + 1]) return;
  const elA = _getGridCell(block, 0, i), elB = _getGridCell(block, 0, i + 1);
  if (!elA || !elB) return;

  // row draggable(block-drag.js)과의 충돌 방지 — 거터는 블록 밖(오버레이)이라 애초에 잘 안 맞지만,
  // 조상 체인의 dragstart 를 막는 안전망을 표 셀 선택과 «공유»한다(drag-utils.js, PLAN §5-B-4).
  const restoreDrag = window.suppressAncestorDrag ? window.suppressAncestorDrag(block) : () => {};

  const scale0 = _canvasScaleNow();
  const wL0 = elA.getBoundingClientRect().width / scale0;
  const wR0 = elB.getBoundingClientRect().width / scale0;
  const W = (Number(cols[i].width) || 1) + (Number(cols[i + 1].width) || 1);
  const startX = e.clientX;
  // ★드래그 «시작 직전» 1회만(mousedown) — mousemove 마다 쌓이면 undo 가 픽셀 단위로 끊긴다.
  window.pushHistory?.();

  function onMove(ev) {
    const scale = _canvasScaleNow(); // 드래그 중 줌이 바뀌는 경우까지 방어(매 move 재조회)
    const delta = (ev.clientX - startX) / scale;
    const r = resizeColBoundary(wL0, wR0, W, delta);   // ★minPx 는 모듈 기본값(COL_MIN_PX) — 여기서 리터럴로 덮지 않는다
    if (!r) return;
    cols[i].width = r.leftWeight;
    cols[i + 1].width = r.rightWeight;
    block.dataset.cols = JSON.stringify(cols);
    window.renderGridBlock?.(block);
    _updateGridGutterPositions();
    // 패널이 열려 있으면 비율 입력값만 갱신 — 패널 재렌더 금지(포커스/드래그 중단 방지,
    // prop-grid.js 의 «드래그 중 패널 재렌더 금지» 규약과 동일, PLAN §4 끝줄).
    const ratioInput = document.getElementById('grd-col-ratio');
    if (ratioInput) {
      ratioInput.value = cols.map(c => {
        const n = Number(c.width);
        return Number.isInteger(n) ? String(n) : String(+n.toFixed(2));
      }).join(':');
    }
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    restoreDrag();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// 행 경계 드래그 (P1 병합 후 신설) — «가중치 재분배 없음»(PLAN §3-A/§5-B-3). 경계 i|i+1 을
// 끌면 «위» 행(rows[i])의 px 최소높이만 바뀐다 — 아래 행은 그대로. resizeRowHeight(순수함수).
function _onGridRowMouseDown(e, block, i) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const rows = gridRows(block);   // 클램프·폴백까지 반영된 단일 진실원(grid-block.js)
  if (!rows[i] || !rows[i + 1]) return;
  const elA = _getGridCell(block, i, 0);
  if (!elA) return;

  const restoreDrag = window.suppressAncestorDrag ? window.suppressAncestorDrag(block) : () => {};

  const scale0 = _canvasScaleNow();
  const startH0 = elA.getBoundingClientRect().height / scale0; // 'auto' 행도 «지금 렌더된» 높이에서 시작
  const startY = e.clientY;
  window.pushHistory?.(); // ★드래그 «시작 직전» 1회만

  function onMove(ev) {
    const scale = _canvasScaleNow();
    const delta = (ev.clientY - startY) / scale;
    const h = resizeRowHeight(startH0, delta);   // ★min/max 는 모듈 기본값(ROW_H_MIN/ROW_H_MAX) — 여기 리터럴 2000 이 상한을 «혼자» 절반으로 깎고 있었다
    rows[i] = { height: h };
    block.dataset.rows = JSON.stringify(rows);
    window.renderGridBlock?.(block);
    _updateGridGutterPositions();
    // 패널이 열려 있으면 그 행의 입력값만 갱신 — 패널 재렌더 금지(열 경계와 동일 원칙).
    const rowInput = document.querySelector(`.grd-row-h-item[data-ri="${i}"]`);
    if (rowInput) rowInput.value = String(h);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    restoreDrag();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showGridGutters = showGridGutters;
window.hideGridGutters = hideGridGutters;

// fix(frame-p0#5): 캔버스 클릭 핸들러 6곳(block-drag.js asset·icon-circle·canvas·vector·
// iconify·mockup)이 저마다 손으로 부르던 핸들 호출을 타입→핸들 맵 하나로 모은다.
// 진입점(레이어패널 등)이 늘어도 여기 한 곳만 맞으면 된다 — SSOT.
// (캔버스 6곳 자체는 회귀 격리를 위해 P0에서는 그대로 두고 P1에서 이 맵으로 치환한다.)
/* ═══════════════════════════════════════════════════════════════════════════
   확대블럭(zoom) 리사이즈 핸들 — 현빈 2026-09-08 「아웃라인으로 핸들로 높이와 너비 조절」
   ───────────────────────────────────────────────────────────────────────────
   ★핸들은 «블록 상자»에 붙는다 — 확대블럭은 플로팅(스티커 계열)이라 블록 상자가 곧
     도형(+테두리) 상자다. 보라 아웃라인이 그리는 상자와 «같은 상자»라 모서리가 정확히 맞는다.
   ★크기는 style.width/height 가 아니라 dataset.w / dataset.h 에 쓴다.
     확대블럭의 크기는 CSS 상자가 아니라 «SVG 안 도형»이라, 블록에 width 를 줘도 도형이 안 변한다.
     ⇒ renderZoomBlock 을 다시 불러 실루엣·그림자·뷰박스가 «같이» 따라오게 한다.
   ⚠️circle 은 정원만 그릴 수 있다(silhouetteCircle 전제) ⇒ w=h 로 묶어서 쓴다.
   ═══════════════════════════════════════════════════════════════════════════ */
const ZOOM_MIN = 20, ZOOM_MAX = 1200;
let _zoomResizeBlock = null;
let _zoomResizeRafId = null;

/** 핸들이 앉을 상자 = ★블록 «자신». 플로팅(스티커 계열)이라 블록 상자가 곧 도형(+테두리) 상자다.
 *  ⛔예전엔 보조 상자(.zoom-sel-box)를 뒀다 — 블록이 행 안에 있어 «행 전체 폭»이었기 때문이다.
 *    플로팅으로 옮기면서 그 보조 상자가 없어졌다(zoom-geometry.js blockBoxSpec 주석 참조). */
function _zoomOutlineBox(zb) {
  return zb;
}

function showZoomResizeHandles(zb) {
  const overlay = _getOverlay();
  /* ★빗장은 «지워진 상태»를 알아채야 한다 — «같은 블록»인지만 보고 early-return 하면
   *   핸들이 이미 쓸려나간 뒤에도 «다시 만들지 않는다». 실측 증상: 추가 후 재클릭에서
   *   4→0 으로 사라지고 그 뒤로는 영영 0 (MutationObserver: REMOVE 4건 / ADD 0건).
   *   deselectAll() → hideAssetResizeHandles() 가 (클래스를 공유하던 시절) 줌 핸들까지
   *   쓸어갔는데 _zoomResizeBlock 은 남의 변수가 아니라 안 지워져서 빗장이 계속 닫혀 있었다.
   * ⇒ «같은 블록»이면서 «핸들이 실제로 DOM 에 있을 때»만 건너뛴다. */
  if (_zoomResizeBlock === zb && overlay && overlay.querySelector('[data-zoom-resize-dir]')) return;
  hideZoomResizeHandles();
  _zoomResizeBlock = zb;
  if (!overlay) return;
  CORNER_DIRS.forEach(dir => {
    const h = document.createElement('div');
    /* ⚠️클래스는 `.zm-overlay-handle` — `.asset-overlay-handle` 을 «빌려 쓰면»
     *   `hideAssetResizeHandles()` 의 일괄 제거에 같이 쓸려나간다.
     *   아이콘원형(.icb-overlay-handle)이 이미 같은 함정을 밟고 이 파일에 경고를 남겼는데
     *   확대블럭이 그 경고를 그대로 밟았다(842행 부근 주석 참조).
     *   모양은 css/editor-blocks.css 에서 기존 규칙에 «얹혀» 공유한다 — 복사가 아니다. */
    h.className = `zm-overlay-handle ${dir}`;
    h.dataset.zoomResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onZoomResizeMouseDown(e, zb, dir));
  });
  _updateZoomHandlePositions();
  _startZoomResizeRaf();
}

function hideZoomResizeHandles() {
  if (_zoomResizeRafId) { cancelAnimationFrame(_zoomResizeRafId); _zoomResizeRafId = null; }
  _zoomResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('[data-zoom-resize-dir]').forEach(h => h.remove());
}

function _updateZoomHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_zoomResizeBlock) return;
  const box = _zoomOutlineBox(_zoomResizeBlock);
  const HALF = 3.5;
  overlay.querySelectorAll('[data-zoom-resize-dir]').forEach(h => {
    const c = _cornerScreen(box, h.dataset.zoomResizeDir);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startZoomResizeRaf() {
  function loop() {
    if (!_zoomResizeBlock) return;
    if (!_zoomResizeBlock.isConnected || !_zoomResizeBlock.classList.contains('selected')) {
      hideZoomResizeHandles();
      return;
    }
    _updateZoomHandlePositions();
    _zoomResizeRafId = requestAnimationFrame(loop);
  }
  _zoomResizeRafId = requestAnimationFrame(loop);
}

function _onZoomResizeMouseDown(e, zb, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const st = window.readZoomState?.(zb) || {};
  const box = _zoomOutlineBox(zb);
  // 시작 크기 = «도형» 크기. 아웃라인 상자는 테두리만큼 더 크므로 그만큼 뺀다.
  const bw = (st.bd === 'on') ? Math.max(0, Number(st.bdw) || 0) : 0;
  const startW = Math.max(ZOOM_MIN, Math.round(box.offsetWidth  - bw * 2));
  const startH = Math.max(ZOOM_MIN, Math.round(box.offsetHeight - bw * 2));
  const startX = e.clientX, startY = e.clientY;
  const isCircle = st.shape === 'circle';
  let moved = false;

  function onMove(ev) {
    const scale = _canvasScaleNow();
    const d = _unrotateDelta(box, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    let dw = dir.includes('e') ? d.dx : dir.includes('w') ? -d.dx : 0;
    let dh = dir.includes('s') ? d.dy : dir.includes('n') ? -d.dy : 0;
    if (!moved && Math.hypot(dw, dh) < 1) return;
    if (!moved) { moved = true; window.pushHistory?.('확대블럭 크기'); }
    let newW = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(startW + dw)));
    let newH = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(startH + dh)));
    // ⚠️원은 정원만 — 큰 쪽으로 묶는다. Shift 는 비율 고정(에셋 핸들과 같은 어휘).
    if (isCircle) { newW = newH = Math.max(newW, newH); }
    else if (ev.shiftKey && startH > 0) {
      if (Math.abs(dw) >= Math.abs(dh)) newH = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(newW * startH / startW)));
      else newW = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(newH * startW / startH)));
    }
    zb.dataset.w = String(newW);
    zb.dataset.h = String(newH);
    window.renderZoomBlock?.(zb);   // ★실루엣·그림자·뷰박스가 «같이» 따라온다
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (moved) { window.showZoomProperties?.(zb); window.triggerAutoSave?.(); }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* ═══════════════════════════════════════════════════════════════════════════
   확대블럭 — 모서리 라운드 핸들 (.zm-radius-handle)
   현빈 2026-09-09 「추가되는 사각형의 모서리 라디오도 좀 조절했으면 좋겠어.
                     다른 사각형 셋 조절할 때 뭐 그렇게 했었잖아」

   ⛔«에셋 핸들을 그대로 베끼면 안 된다». 기존 코너반경 핸들 넷(frame·asset·modal·canvas)은
     전부 `el.style.borderRadius` 로 DOM 에 «직접» 쓴다. 확대블럭은 그 길이 막혀 있다 —
     renderZoomBlock(zoom-block.js:200)이 `block.style.cssText` 를 «통째로» 덮으므로
     끌자마자 다음 렌더에서 값이 날아간다(그리고 «아무 오류도 안 난다»).
   ⇒ 베낄 대상은 «같은 파일의» _onZoomResizeMouseDown 이다: 「dataset 에 쓰고
     renderZoomBlock 을 부른다」는 규약이 거기 이미 산다. 여기도 그 규약만 쓴다.

   ⛔클래스로 `.asset-radius-handle` 을 «빌리지» 않는다 — hideAssetRadiusHandles() 의
     일괄 remove 가 같이 쓸어간다. 이 파일 1827행 주석이 «그 함정을 두 번 밟았다»고 적어 뒀다
     (아이콘원형이 한 번, 확대블럭 리사이즈 핸들이 또 한 번). 모양만 CSS 에서 «얹어» 쓴다.

   ★★상한(ZOOM_BDR_MAX)에 «잠복 결함»이 걸려 있다 — 아래 상수 주석 참조.
   ═══════════════════════════════════════════════════════════════════════════ */

/** 모서리 라운드 상한(px). ★이 숫자는 «취향»이 아니라 아래 결함의 크기에서 나왔다.
 *
 * ⚠️결함: 그림자(빛줄기)의 실루엣은 도형의 «꼭짓점»에서 잡는다(zoom-geometry.js
 *   shapeCornerPts → silhouetteFromPts). 그런데 라운드를 주면 실제 윤곽은 그 꼭짓점에서
 *   호(弧) 쪽으로 «들어간다». 어긋나는 거리는 대각선 방향으로 정확히
 *       g = bdr · (√2 − 1) ≈ 0.4142 · bdr
 *   ⇒ 빛줄기의 밑변이 도형에서 g 만큼 «떠서» 모서리 옆에 얇은 쐐기로 비어 보인다.
 *
 * ★«눈에 띄는» 치수는 g 가 아니라 둘이다(g 는 «최단»거리라 제일 작게 나온다):
 *     · 코너 극점에서 빛줄기 밑변이 도형 위로 뜨는 «높이» = bdr «그 자체»
 *     · 코너 하나당 도형 밖으로 삐져나온 «넓이» = bdr²(1 − π/4)
 *
 * ★★재서 골랐다 — 9363 포트, 배율 100%, rect 260×140, shadow on, maxop 60, 광원 12시.
 *   bdr | 최단 g  | 코너당 넓이 | 극점 높이 | 눈으로
 *     8 | 3.31px |   13.7 px² |    8px | 안 보인다
 *    16 | 6.63px |   54.9 px² |   16px | 안 보인다  ← ★여기를 상한으로 잡았다
 *    24 | 9.94px |  123.6 px² |   24px | 코너에 옅은 쐐기가 «보이기 시작»한다
 *    40 |16.57px |  343.4 px² |   40px | 확실한 «날개» — 그림자가 도형에서 떨어져 보인다
 *
 * ⛔이번에 실루엣을 «고치지 않는다» — 범위 밖이다(현빈 지시는 「모서리 조절」까지다).
 * ★★이 상한을 올리려면 «실루엣부터» 고쳐야 한다: zoom-geometry.js 의
 *   silhouetteFromPts 가 shapeCornerPts 의 «꼭짓점»이 아니라 「라운드된 윤곽의 접점」을
 *   잡도록 바꾸는 일이다. 그걸 안 하고 숫자만 키우면 위 표의 오른쪽으로 그대로 내려간다. */
const ZOOM_BDR_MAX = 16;

let _zoomRadiusBlock = null;
let _zoomRadiusRafId = null;

function showZoomRadiusHandles(zb) {
  const overlay = _getOverlay();
  /* ★빗장은 _zoomResizeBlock 과 «같은 규율» — 「같은 블록」만 보고 건너뛰면 핸들이 남의
     정리에 쓸려나간 뒤로 영영 안 돌아온다(1813행 주석의 그 사고). DOM 존재도 같이 본다. */
  if (_zoomRadiusBlock === zb && overlay && overlay.querySelector('[data-zoom-radius-dir]')) return;
  hideZoomRadiusHandles();
  _zoomRadiusBlock = zb;
  if (!overlay) return;
  CORNER_DIRS.forEach(dir => {
    const h = document.createElement('div');
    h.className = `zm-radius-handle ${dir}`;
    h.dataset.zoomRadiusDir = dir;
    h.title = '모서리 반경 조절';
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onZoomRadiusMouseDown(e, zb, dir));
  });
  _updateZoomRadiusPositions();
  _startZoomRadiusRaf();
}

function hideZoomRadiusHandles() {
  if (_zoomRadiusRafId) { cancelAnimationFrame(_zoomRadiusRafId); _zoomRadiusRafId = null; }
  _zoomRadiusBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('[data-zoom-radius-dir]').forEach(h => h.remove());
}

function _updateZoomRadiusPositions() {
  const overlay = _getOverlay();
  if (!overlay || !_zoomRadiusBlock) return;
  const box = _zoomOutlineBox(_zoomRadiusBlock);
  const INSET = 10;   // 코너에서 «안쪽»으로 — 리사이즈 핸들(inset 0)과 자리가 안 겹친다
  const HALF  = 3.5;  // 7px 핸들 중앙 정렬
  /* ★원에는 모서리가 없다 — blockBoxSpec 이 radius 를 '50%' 로 못박고 shapeEl 의 circle
     갈래는 bdr 을 «아예 안 읽는다». ⇒ 핸들을 보이면 「끌어도 아무 일도 안 나는 손잡이」가 된다.
     ⛔숨기는 자리를 show...() 로 옮기면 안 된다: 프리셋을 원↔사각으로 «선택한 채» 바꿀 때
       (prop-zoom 은 showZoomProperties 만 다시 부르고 핸들은 안 다시 만든다) 상태가 굳는다.
       매 프레임 보는 여기서 토글해야 살아 있는 채로 따라온다. */
  const isCircle = (window.readZoomState?.(_zoomRadiusBlock) || {}).shape === 'circle';
  overlay.querySelectorAll('[data-zoom-radius-dir]').forEach(h => {
    h.style.display = isCircle ? 'none' : '';
    if (isCircle) return;
    const c = _cornerScreen(box, h.dataset.zoomRadiusDir, INSET);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startZoomRadiusRaf() {
  function loop() {
    if (!_zoomRadiusBlock) return;
    if (!_zoomRadiusBlock.isConnected || !_zoomRadiusBlock.classList.contains('selected')) {
      hideZoomRadiusHandles();
      return;
    }
    _updateZoomRadiusPositions();
    _zoomRadiusRafId = requestAnimationFrame(loop);
  }
  _zoomRadiusRafId = requestAnimationFrame(loop);
}

function _onZoomRadiusMouseDown(e, zb, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  /* ★시작값은 «dataset» 에서 읽는다 — ⛔`zb.style.borderRadius` 를 읽으면 안 된다.
     그 자리엔 렌더가 써 둔 «도형 반경 + 테두리 두께»(blockBoxSpec.radius)가 들어 있어
     테두리를 켠 순간 시작값이 bdw 만큼 부풀어 손끝이 튄다. */
  const startR = Math.max(0, Number(window.readZoomState?.(zb)?.bdr) || 0);
  const startX = e.clientX, startY = e.clientY;
  let moved = false;

  function onMove(ev) {
    const scale = _canvasScaleNow();
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    // 델타 산식은 _onAssetRadiusHandleMouseDown 그대로 — 「안쪽으로 끌면 커진다」
    const delta = dir === 'nw' ? (dx + dy) / 2
                : dir === 'ne' ? (-dx + dy) / 2
                : dir === 'sw' ? (dx - dy) / 2
                :                (-dx - dy) / 2;
    if (!moved && Math.abs(delta) < 1) return;
    if (!moved) { moved = true; window.pushHistory?.('확대블럭 모서리'); }
    const newR = Math.min(ZOOM_BDR_MAX, Math.max(0, Math.round(startR + delta)));
    /* ★★규약 — dataset 에 쓰고 «재렌더»한다.
       ⛔`zb.style.borderRadius = …` 로 쓰면 다음 renderZoomBlock 의 style.cssText 통짜
         덮어쓰기에 «조용히» 날아간다. 도형(SVG rect rx)도 안 따라온다. */
    zb.dataset.bdr = String(newR);
    window.renderZoomBlock?.(zb);
    /* 프로퍼티 패널 동기 — ★지금 이 줄들은 «아무것도 못 찾는다»: 모서리 슬라이더가
       prop-zoom.js 에서 가려져 있다(현빈 「아직」). 그래도 남긴다 — 그 줄의 주석을 옮겨
       되살리는 순간 이 동기가 «같이» 살아나야 하기 때문이다(그 파일이 쓰는 id 규약은
       `zm-bdr` · `zm-bdr-num` 이다. ⛔`-slider`/`-number` 가 아니다). */
    const s = document.getElementById('zm-bdr');
    const n = document.getElementById('zm-bdr-num');
    if (s) s.value = String(newR);
    if (n) n.value = String(newR);
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (moved) { window.showZoomProperties?.(zb); window.triggerAutoSave?.(); }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* ═══════════════════════════════════════════════════════════════════════════
   확대블럭 — 회전 핫존 (.zm-rotate-handle)
   현빈 2026-09-09 「스티커의 모서리 핸들에 마우스를 가져다주면 그게 되잖아 회전 기능이
                     되게끔. 다른 셋 블록이나. 그런데 지금은 우측 패널에 회전 슬라이드로만
                     하니까 그것 좀 고쳐줘」

   ★인프라는 이미 있다 — js/asset-rotate.js 의 _makeRotateType 팩토리에 여덟 종이 산다.
     ⛔그런데 «그 팩토리를 쓰면 안 된다». 팩토리는 host.appendChild 로 핫존을 블록의 «자식»
       으로 붙이는데, renderZoomBlock 이 innerHTML 을 통째로 덮으므로 첫 재렌더에 죽는다
       (실측: 붙인 직후 1개 → 재렌더 뒤 0개). 확대블럭에는 「자식으로 붙인다」가 안 통한다.
     ⇒ ★프레임(.ss-rotate-handle)과 «같은 길»로 간다: 오버레이 트랙(#ss-handles-overlay)에
       두고 raf 로 좌표를 따라간다. 리사이즈·라운드 핸들이 이미 그렇게 살아 있다.

   ★크기조절과 «어떻게 가르나» = 모서리 «바깥» 링이다(프레임과 같은 수: ROT_OUT 16, 20×20).
     리사이즈 핸들은 코너에 ±3.5px, 회전은 코너 바깥 6~26px ⇒ 히트영역이 안 겹친다.
     ⛔수정키(Shift/⌘)로 가르지 않는다 — 현빈은 「마우스를 가져다주면」이라 했다(hover 로
       알아야 한다). 게다가 Shift 는 비율고정·45°스냅으로 이미 포화, ⌘ 는 자유이동이다.
     ★갈라지는 실체는 «커서»다: 회전은 _FRAME_ROTATE_CURSOR, 리사이즈는 nw/ne/sw/se-resize
       (css/editor-blocks.css 의 .zm-overlay-handle.* 규칙).
   ═══════════════════════════════════════════════════════════════════════════ */
let _zoomRotateBlock = null;
let _zoomRotateRafId = null;

function showZoomRotateHandles(zb) {
  const overlay = _getOverlay();
  if (_zoomRotateBlock === zb && overlay && overlay.querySelector('[data-zoom-rot-dir]')) return;
  hideZoomRotateHandles();
  _zoomRotateBlock = zb;
  if (!overlay) return;
  CORNER_DIRS.forEach(dir => {
    const z = document.createElement('div');
    z.className = `zm-rotate-handle ${dir}`;
    z.dataset.zoomRotDir = dir;
    z.title = '회전 (Shift=45° 스냅)';
    z.style.cssText = 'position:fixed;width:20px;height:20px;z-index:98;pointer-events:auto;'
      + 'border-radius:50%;cursor:' + _FRAME_ROTATE_CURSOR + ';';
    overlay.appendChild(z);
    z.addEventListener('mousedown', e => _onZoomRotateMouseDown(e, zb));
  });
  _updateZoomRotatePositions();
  _startZoomRotateRaf();
}

function hideZoomRotateHandles() {
  if (_zoomRotateRafId) { cancelAnimationFrame(_zoomRotateRafId); _zoomRotateRafId = null; }
  _zoomRotateBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('[data-zoom-rot-dir]').forEach(h => h.remove());
}

function _updateZoomRotatePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_zoomRotateBlock) return;
  const box = _zoomOutlineBox(_zoomRotateBlock);
  const ROT_OUT  = 16;   // 코너에서 «바깥»으로(스크린px) — 프레임과 같은 수
  const ROT_HALF = 10;   // 20px 핫존 중앙 정렬
  /* ★원은 돌려도 같은 모양이다 — blockBoxSpec 이 circle 에서 rot 을 0 으로 못박는다.
     ⇒ 핫존을 보이면 「끌어도 아무 일도 안 나는 손잡이」가 된다. 라운드 핸들과 «같은 규율»로
       여기(매 프레임)에서 토글해 프리셋을 선택한 채 바꿔도 따라오게 한다. */
  const isCircle = (window.readZoomState?.(_zoomRotateBlock) || {}).shape === 'circle';
  overlay.querySelectorAll('[data-zoom-rot-dir]').forEach(h => {
    h.style.display = isCircle ? 'none' : '';
    if (isCircle) return;
    const c = _cornerScreen(box, h.dataset.zoomRotDir, -ROT_OUT);   // 음수 inset = 바깥
    h.style.top  = (c.y - ROT_HALF) + 'px';
    h.style.left = (c.x - ROT_HALF) + 'px';
  });
}

function _startZoomRotateRaf() {
  function loop() {
    if (!_zoomRotateBlock) return;
    if (!_zoomRotateBlock.isConnected || !_zoomRotateBlock.classList.contains('selected')) {
      hideZoomRotateHandles();
      return;
    }
    _updateZoomRotatePositions();
    _zoomRotateRafId = requestAnimationFrame(loop);
  }
  _zoomRotateRafId = requestAnimationFrame(loop);
}

/** 확대블럭 프로퍼티 패널의 회전 입력 동기.
 *  ⛔asset-rotate.js 의 _syncNumSlider('zm-rot', …) 를 쓰면 «조용히 아무 일도 안 한다» —
 *    그 헬퍼는 `zm-rot-slider`·`zm-rot-number` 를 찾는데, prop-zoom.js 의 _pairRow 가 만드는
 *    id 는 `zm-rot`·`zm-rot-num` 이다. 둘 다 null 이라 오류도 안 나고 값도 안 바뀐다.
 *  ⇒ 전용으로 둔다. prop-zoom.js 의 _pairRow 규약이 바뀌면 «여기»도 같이 바뀌어야 한다. */
function _syncZoomRotUI(deg) {
  const s = document.getElementById('zm-rot');
  const n = document.getElementById('zm-rot-num');
  if (s) s.value = String(deg);
  if (n) n.value = String(deg);
}

function _onZoomRotateMouseDown(e, zb) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const box = _zoomOutlineBox(zb);
  const br = box.getBoundingClientRect();
  /* ★중심은 «회전 불변»이라 회전각과 무관하게 rect 중심이 곧 회전 중심이다.
     ⚠️확대블럭의 DOM 상자는 축정렬 그대로다 — 회전은 CSS transform 이 아니라 SVG «안»에서
       일어난다(renderZoomBlock 주석). 그래서 이 rect 는 회전해도 안 돌아간다. */
  const cx = br.left + br.width  / 2;
  const cy = br.top  + br.height / 2;
  const init   = Number(window.readZoomState?.(zb)?.rot) || 0;
  const startA = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
  let moved = false;

  function onMove(ev) {
    const a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
    let deg = init + (a - startA);
    deg = window._snapRotate ? window._snapRotate(deg, ev.shiftKey) : Math.round(deg);
    deg = ((deg % 360) + 360) % 360;
    if (deg > 180) deg -= 360;   // -180..180 = 패널 슬라이더의 범위와 «같은 어휘»
    if (!moved && deg === init) return;
    if (!moved) { moved = true; window.pushHistory?.('확대블럭 회전'); }
    /* ★★규약 — dataset 에 쓰고 재렌더.
       ⛔asset-rotate.js 의 _applyRotationDeg 를 쓰면 안 된다: 그건 host.style.transform 에
         rotate() 를 거는데, 확대블럭이 그러면 «안에 든 SVG 까지» 돌아 그림자 방향이
         세계좌표를 벗어난다(renderZoomBlock 주석이 그 이유를 적어 뒀다).
       ★renderZoomBlock 이 st.rot → dataset.rotation 을 미러링하므로 _blockRotationDeg →
         _cornerScreen·_unrotateDelta 가 «자동으로» 따라온다 = 회전 뒤 리사이즈가 안 깨진다. */
    zb.dataset.rot = String(deg);
    window.renderZoomBlock?.(zb);
    _syncZoomRotUI(deg);
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (moved) { window.showZoomProperties?.(zb); window.triggerAutoSave?.(); }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function showHandlesFor(block) {
  if (!block || !block.classList) return;
  if (block.classList.contains('zoom-block')) {
    showZoomRadiusHandles(block);
    showZoomRotateHandles(block);
    showZoomResizeHandles(block);
    return;
  }
  if (block.classList.contains('asset-block')) {
    showAssetRadiusHandles(block);
    showAssetResizeHandles(block);
  } else if (block.classList.contains('icon-circle-block')) {
    showIconCircleResizeHandle(block);
  } else if (block.classList.contains('canvas-block')) {
    showCanvasRadiusHandles(block);
    showCanvasResizeHandles(block);
  } else if (block.classList.contains('vector-block')) {
    showVectorResizeHandles(block);
  } else if (block.classList.contains('icon-block')) {
    showIconHandles(block);
  } else if (block.classList.contains('mockup-block')) {
    showMockupHandles(block);
  } else if (block.classList.contains('modal-block')) {
    showModalRadiusHandles(block);
    showModalResizeHandles(block);
  }
}
window.showHandlesFor = showHandlesFor;

export {
  showFrameHandles,
  hideFrameHandles,
  showMockupHandles,
  hideMockupHandles,
  showIconHandles,
  hideIconHandles,
  showAssetRadiusHandles,
  hideAssetRadiusHandles,
  showAssetResizeHandles,
  hideAssetResizeHandles,
  showModalRadiusHandles,
  hideModalRadiusHandles,
  showModalResizeHandles,
  hideModalResizeHandles,
  showIconCircleResizeHandle,
  hideIconCircleResizeHandle,
  showCanvasRadiusHandles,
  hideCanvasRadiusHandles,
  showCanvasResizeHandles,
  hideCanvasResizeHandles,
  showVectorResizeHandles,
  hideVectorResizeHandles,
  showGridGutters,
  hideGridGutters,

  showHandlesFor,
};

/* ═══════════════════════════════════
   OVERLAY HANDLE WIDGETS
   Resize / radius handles for frames, mockups, icons, assets, canvas, vectors
   Extracted from drag-drop.js (lines ~13–988)
═══════════════════════════════════ */

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
   회전 인식 좌표 헬퍼 (U14 — 회전 후 리사이즈 핸들 좌표 보정)
   블록이 transform:rotate 된 상태에서 getBoundingClientRect()는 «회전된 요소의
   축정렬 바운딩박스(AABB)»를 돌려주므로, 코너 핸들을 rect 모서리에 두면
   실제 회전된 코너와 어긋난다. 회전각을 반영해 «진짜 회전된 코너»의 스크린
   좌표를 계산한다. 회전이 0이면 기존 rect 모서리 경로와 «완전 동일»(회귀 0).
═══════════════════════════════════ */
function _canvasScaleNow() {
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
function _cornerScreen(el, dir, inset = 0) {
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
  const tx = parseInt(ss.dataset.translateX) || 0;
  const ty = parseInt(ss.dataset.translateY) || 0;
  const rd = parseFloat(ss.dataset.rotateDeg) || 0;
  const fx = ss.dataset.flipH === '1' ? -1 : 1;
  const fy = ss.dataset.flipV === '1' ? -1 : 1;
  if (!tx && !ty && !rd && fx === 1 && fy === 1) {
    ss.style.removeProperty('transform');
  } else {
    ss.style.transform = `translate(${tx}px,${ty}px) rotate(${rd}deg) scale(${fx},${fy})`;
  }
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

  const dirs = ['nw', 'ne', 'sw', 'se'];
  dirs.forEach(dir => {
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

  const dirs = ['nw', 'ne', 'sw', 'se'];
  dirs.forEach(dir => {
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
    ab.style.width  = newW >= 860 ? (window.assetFullBleedWidth?.(ab) ?? '') : newW + 'px';
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

  const h = document.createElement('div');
  h.className = 'asset-overlay-handle se';
  h.dataset.icbResize = '1';
  overlay.appendChild(h);

  h.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const scaler0 = document.getElementById('canvas-scaler');
    const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    const startSize = parseInt(block.dataset.size) || 240;

    function onMove(ev) {
      const scaler = document.getElementById('canvas-scaler');
      const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
      // #14b 회전 인식: 스크린 델타를 블록 로컬축으로 역회전(회전0=그대로)
      const _ud = _unrotateDelta(block, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
      const dx = _ud.dx, dy = _ud.dy;
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
  });

  function _updatePos() {
    if (!_icbResizeBlock) return;
    const circle = block.querySelector('.icb-circle');
    if (!circle) return;
    const rect = circle.getBoundingClientRect();
    h.style.top  = (rect.bottom - 3.5) + 'px';
    h.style.left = (rect.right  - 3.5) + 'px';
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

  const r = document.createElement('div');
  r.className = 'canvas-radius-handle nw';
  r.dataset.canvasRadiusDir = 'nw';
  r.title = '모서리 반경 조절';
  overlay.appendChild(r);
  r.addEventListener('mousedown', e => _onCanvasRadiusHandleMouseDown(e, cb));

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
  const rect = _canvasRadiusBlock.getBoundingClientRect();
  const INSET = 10;
  const HALF  = 3.5; // 7px 핸들 중앙 정렬
  overlay.querySelectorAll('.canvas-radius-handle').forEach(h => {
    h.style.top  = (rect.top  + INSET - HALF) + 'px';
    h.style.left = (rect.left + INSET - HALF) + 'px';
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

function _onCanvasRadiusHandleMouseDown(e, cb) {
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
    const delta = (dx + dy) / 2;
    const newR = Math.min(60, Math.max(0, Math.round(startRadius - delta)));
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
  showIconCircleResizeHandle,
  hideIconCircleResizeHandle,
  showCanvasRadiusHandles,
  hideCanvasRadiusHandles,
  showCanvasResizeHandles,
  hideCanvasResizeHandles,
  showVectorResizeHandles,
  hideVectorResizeHandles,
};

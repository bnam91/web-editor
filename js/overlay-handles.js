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

  _updateHandlePositions();
  _startHandleRaf();
}

function hideFrameHandles() {
  if (_overlayRafId) { cancelAnimationFrame(_overlayRafId); _overlayRafId = null; }
  _overlayFrame = null;
  const overlay = _getOverlay();
  if (overlay) {
    overlay.querySelectorAll('.ss-resize-handle, .ss-radius-handle').forEach(h => h.remove());
  }
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
  const rect = _overlayFrame.getBoundingClientRect();
  const HALF = 3.5;
  const handles = overlay.querySelectorAll('.ss-resize-handle');
  handles.forEach(h => {
    const dir = h.dataset.dir;
    const top  = dir.includes('n') ? rect.top  - HALF : rect.bottom - HALF;
    const left = dir.includes('w') ? rect.left - HALF : rect.right  - HALF;
    h.style.top  = top  + 'px';
    h.style.left = left + 'px';
  });

  // 코너 반경 핸들 위치 (프레임 안쪽 코너에서 INSET만큼 안쪽)
  const INSET = 10; // 코너에서 안쪽으로 떨어진 거리
  const RADIUS_HALF = 4;
  const rHandles = overlay.querySelectorAll('.ss-radius-handle');
  rHandles.forEach(h => {
    const dir = h.dataset.radiusDir;
    const top  = dir.includes('n') ? rect.top  + INSET - RADIUS_HALF : rect.bottom - INSET - RADIUS_HALF;
    const left = dir.includes('w') ? rect.left + INSET - RADIUS_HALF : rect.right  - INSET - RADIUS_HALF;
    h.style.top  = top  + 'px';
    h.style.left = left + 'px';
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
  const startW = Math.round(ssRect.width / scale0);
  const startH = Math.round(ssRect.height / scale0);
  const secInner = ss.closest('.section-inner') || ss.closest('.section-block');
  const secInnerCS = secInner ? getComputedStyle(secInner) : null;
  const paddingH = secInnerCS ? parseFloat(secInnerCS.paddingLeft) + parseFloat(secInnerCS.paddingRight) : 0;
  const maxW = secInner ? Math.round(secInner.clientWidth - paddingH) : 860;

  // fullWidth 프레임(stack 모드, 자동 높이)은 핸들로 높이 조절 안 함 — 자식이 결정.
  const isFullWidth = ss.dataset.fullWidth === 'true';
  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
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
  const rect = _overlayMockup.getBoundingClientRect();
  const HALF = 3.5;
  overlay.querySelectorAll('.ss-resize-handle.mockup-handle').forEach(h => {
    const dir = h.dataset.dir;
    h.style.top  = (dir.includes('n') ? rect.top - HALF : rect.bottom - HALF) + 'px';
    h.style.left = (dir.includes('w') ? rect.left - HALF : rect.right - HALF) + 'px';
  });
}

function _onMockupHandleMouseDown(e, block, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX  = e.clientX;
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0  = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startW  = parseInt(block.dataset.width) || parseInt(block.style.width) || 280;

  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale  = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    const dx = (ev.clientX - startX) / scale;
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
  const rect = _overlayIcon.getBoundingClientRect();
  const HALF = 3.5;
  overlay.querySelectorAll('.ss-resize-handle.icon-handle').forEach(h => {
    const dir = h.dataset.dir;
    h.style.top  = (dir.includes('n') ? rect.top - HALF : rect.bottom - HALF) + 'px';
    h.style.left = (dir.includes('w') ? rect.left - HALF : rect.right - HALF) + 'px';
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
    // 대각선 핸들 — dx/dy 중 큰 쪽으로 크기 결정
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
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
  const rect = _assetRadiusBlock.getBoundingClientRect();
  const INSET = 10;
  const HALF  = 4;
  overlay.querySelectorAll('.asset-radius-handle').forEach(h => {
    const dir = h.dataset.assetRadiusDir;
    const top  = dir.includes('n') ? rect.top  + INSET - HALF : rect.bottom - INSET - HALF;
    const left = dir.includes('w') ? rect.left + INSET - HALF : rect.right  - INSET - HALF;
    h.style.top  = top  + 'px';
    h.style.left = left + 'px';
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
  const rect = _assetResizeBlock.getBoundingClientRect();
  const HALF = 3.5;
  overlay.querySelectorAll('.asset-overlay-handle').forEach(h => {
    const dir = h.dataset.assetResizeDir;
    const top  = dir.includes('n') ? rect.top  - HALF : rect.bottom - HALF;
    const left = dir.includes('w') ? rect.left - HALF : rect.right  - HALF;
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
  const startW = Math.round(rect.width  / scale0);
  const startH = Math.round(rect.height / scale0);

  const aspectRatio = startW / startH;

  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
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
    ab.style.width  = newW >= 860 ? '' : newW + 'px';
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
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
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
  const HALF  = 4;
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
  const rect = _canvasResizeBlock.getBoundingClientRect();
  const HALF = 3.5;
  overlay.querySelectorAll('.canvas-overlay-handle').forEach(h => {
    const dir = h.dataset.canvasResizeDir;
    const top  = dir.includes('n') ? rect.top    - HALF : rect.bottom - HALF;
    const left = dir.includes('w') ? rect.left   - HALF : rect.right  - HALF;
    h.style.top  = top  + 'px';
    h.style.left = left + 'px';
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

  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    let newW = startW, newH = startH;
    if (dir.includes('e')) newW = Math.min(860, Math.max(100, startW + dx));
    if (dir.includes('w')) newW = Math.min(860, Math.max(100, startW - dx));
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
  const rect = _vectorResizeBlock.getBoundingClientRect();
  const HALF = 3.5;
  overlay.querySelectorAll('.vector-overlay-handle').forEach(h => {
    const dir = h.dataset.vectorResizeDir;
    const top  = dir.includes('n') ? rect.top    - HALF : rect.bottom - HALF;
    const left = dir.includes('w') ? rect.left   - HALF : rect.right  - HALF;
    h.style.top  = top  + 'px';
    h.style.left = left + 'px';
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
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
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

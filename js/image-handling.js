/* ══════════════════════════════════════
   이미지 업로드 (Asset)
══════════════════════════════════════ */
import { propPanel } from './globals.js';

/* ── 이미지 업로드 로딩 오버레이 헬퍼 ── */
function showAssetLoading(block) {
  const overlay = document.createElement('div');
  overlay.className = 'asset-loading-overlay';
  overlay.innerHTML = '<div class="asset-loading-spinner"></div>';
  block.appendChild(overlay);
}
function hideAssetLoading(block) {
  block.querySelector('.asset-loading-overlay')?.remove();
}

/* ── 이미지 위치/스케일 복원 (로드·undo 후) ── */
function applyImageTransform(ab) {
  const img = ab.querySelector('.asset-img');
  if (!img) return;
  if (ab.dataset.imgPosition) {
    img.style.objectPosition = ab.dataset.imgPosition;
  }
  if (!ab.dataset.imgW) return;
  img.style.position  = 'absolute';
  img.style.objectFit = 'cover';
  img.style.width     = ab.dataset.imgW + 'px';
  img.style.height    = 'auto';
  img.style.left      = (parseFloat(ab.dataset.imgX) || 0) + 'px';
  img.style.top       = (parseFloat(ab.dataset.imgY) || 0) + 'px';
  const rotate = parseFloat(ab.dataset.imgRotate || 0);
  img.style.transform = rotate ? `rotate(${rotate}deg)` : '';
}

function enterImageEditMode(ab) {
  if (ab._imgEditing) return;
  const img = ab.querySelector('.asset-img');
  if (!img) return;

  ab._imgEditing = true;
  ab.classList.add('img-editing');
  ab.draggable = false;
  const _row = ab.closest('.row');
  if (_row) _row.draggable = false; // 부모 row의 drag가 핸들 mousedown을 가로채지 않도록

  const frameW = ab.offsetWidth;
  const frameH = ab.offsetHeight;

  if (ab.dataset.imgW) {
    applyImageTransform(ab);
  } else {
    const ratio = (img.naturalWidth / img.naturalHeight) || 1;
    const initW = frameW;
    const initH = initW / ratio;
    img.style.position  = 'absolute';
    img.style.width     = initW + 'px';
    img.style.height    = 'auto';
    img.style.left      = '0px';
    img.style.top       = ((frameH - initH) / 2) + 'px';
    ab.dataset.imgW = initW;
    ab.dataset.imgX = 0;
    ab.dataset.imgY = (frameH - initH) / 2;
  }
  img.style.objectFit = 'fill'; // 편집 모드 중 스케일 반영
  img.draggable = false;

  // 우측 패널 — 이미지 편집 프로퍼티
  function renderImgPanel() {
    const x = Math.round(parseFloat(img.style.left) || 0);
    const y = Math.round(parseFloat(img.style.top)  || 0);
    const w = Math.round(img.offsetWidth);
    propPanel.innerHTML = `
      <div class="prop-section">
        <div class="prop-block-label">
          <div class="prop-block-icon">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
              <rect x="1" y="1" width="10" height="10" rx="1"/>
              <circle cx="4" cy="4" r="1"/>
              <polyline points="11 8 8 5 3 11"/>
            </svg>
          </div>
          <span class="prop-block-name">이미지 편집</span>
        </div>
        <div class="prop-section-title">위치</div>
        <div class="prop-row">
          <span class="prop-label">X</span>
          <input type="number" class="prop-number" id="img-x" style="width:64px" value="${x}">
        </div>
        <div class="prop-row">
          <span class="prop-label">Y</span>
          <input type="number" class="prop-number" id="img-y" style="width:64px" value="${y}">
        </div>
      </div>
      <div class="prop-section">
        <div class="prop-section-title">크기</div>
        <div class="prop-row">
          <span class="prop-label">너비</span>
          <input type="number" class="prop-number" id="img-w" style="width:64px" value="${w}" min="40">
        </div>
        <div class="prop-row">
          <span class="prop-label">높이</span>
          <input type="number" class="prop-number" id="img-h" style="width:64px" value="${Math.round(img.offsetHeight)}" disabled>
        </div>
      </div>
      <div class="prop-section">
        <div class="prop-section-title">정렬</div>
        <div class="prop-row">
          <span class="prop-label">가로</span>
          <div class="prop-align-group">
            <button class="prop-align-btn" id="img-align-hl">←</button>
            <button class="prop-align-btn" id="img-align-hc">↔</button>
            <button class="prop-align-btn" id="img-align-hr">→</button>
          </div>
        </div>
        <div class="prop-row">
          <span class="prop-label">세로</span>
          <div class="prop-align-group">
            <button class="prop-align-btn" id="img-align-vt">↑</button>
            <button class="prop-align-btn" id="img-align-vc">↕</button>
            <button class="prop-align-btn" id="img-align-vb">↓</button>
          </div>
        </div>
      </div>
      <div class="prop-section" style="color:#555;font-size:11px;padding-top:0;">
        Esc 또는 블록 밖 클릭으로 편집 종료
      </div>`;

    document.getElementById('img-x').addEventListener('input', e => {
      img.style.left = (parseInt(e.target.value) || 0) + 'px';
      ab.dataset.imgX = parseInt(e.target.value) || 0;
      syncHandles();
    });
    document.getElementById('img-y').addEventListener('input', e => {
      img.style.top = (parseInt(e.target.value) || 0) + 'px';
      ab.dataset.imgY = parseInt(e.target.value) || 0;
      syncHandles();
    });
    document.getElementById('img-w').addEventListener('input', e => {
      const v = Math.max(40, parseInt(e.target.value) || 40);
      img.style.width = v + 'px';
      ab.dataset.imgW = v;
      syncHandles();
      const hEl = document.getElementById('img-h');
      if (hEl) hEl.value = Math.round(img.offsetHeight);
    });

    const savePos = () => {
      ab.dataset.imgX = parseFloat(img.style.left) || 0;
      ab.dataset.imgY = parseFloat(img.style.top)  || 0;
      syncHandles(); syncPanel();
    };
    const fw = ab.offsetWidth, fh = ab.offsetHeight;
    document.getElementById('img-align-hl').addEventListener('click', () => { img.style.left = '0px'; savePos(); });
    document.getElementById('img-align-hc').addEventListener('click', () => { img.style.left = ((fw - img.offsetWidth)  / 2) + 'px'; savePos(); });
    document.getElementById('img-align-hr').addEventListener('click', () => { img.style.left = (fw - img.offsetWidth)        + 'px'; savePos(); });
    document.getElementById('img-align-vt').addEventListener('click', () => { img.style.top  = '0px'; savePos(); });
    document.getElementById('img-align-vc').addEventListener('click', () => { img.style.top  = ((fh - img.offsetHeight) / 2) + 'px'; savePos(); });
    document.getElementById('img-align-vb').addEventListener('click', () => { img.style.top  = (fh - img.offsetHeight)       + 'px'; savePos(); });
  }

  // 드래그/스케일 후 패널 값 동기화
  function syncPanel() {
    const xEl = document.getElementById('img-x');
    const yEl = document.getElementById('img-y');
    const wEl = document.getElementById('img-w');
    const hEl = document.getElementById('img-h');
    if (xEl) xEl.value = Math.round(parseFloat(img.style.left) || 0);
    if (yEl) yEl.value = Math.round(parseFloat(img.style.top)  || 0);
    if (wEl) wEl.value = Math.round(img.offsetWidth);
    if (hEl) hEl.value = Math.round(img.offsetHeight);
  }

  // 핸들 + 경계선 모두 오버레이에 배치 — section-inner overflow 제약 없이 표시
  const overlay = document.getElementById('ss-handles-overlay');

  const HANDLES = [
    { id: 'tl', cursor: 'nwse-resize', cls: 'img-corner-handle' },
    { id: 'tc', cursor: 'ns-resize',   cls: 'img-edge-handle'   },
    { id: 'tr', cursor: 'nesw-resize', cls: 'img-corner-handle' },
    { id: 'rc', cursor: 'ew-resize',   cls: 'img-edge-handle'   },
    { id: 'br', cursor: 'nwse-resize', cls: 'img-corner-handle' },
    { id: 'bc', cursor: 'ns-resize',   cls: 'img-edge-handle'   },
    { id: 'bl', cursor: 'nesw-resize', cls: 'img-corner-handle' },
    { id: 'lc', cursor: 'ew-resize',   cls: 'img-edge-handle'   },
  ];
  const cornerEls = {};
  HANDLES.forEach(({ id, cursor, cls }) => {
    const h = document.createElement('div');
    h.className = cls;
    h.style.cursor = cursor;
    h.draggable = false;
    h.addEventListener('dragstart', e => e.preventDefault());
    if (overlay) overlay.appendChild(h); else ab.appendChild(h);
    cornerEls[id] = h;
  });

  // 회전 존 — 모서리 핸들 바깥 영역 (20×20px, z-index 낮음)
  const rotateZoneEls = {};
  ['tl','tr','bl','br'].forEach(id => {
    const rz = document.createElement('div');
    rz.className = 'img-rotate-zone';
    rz.draggable = false;
    rz.addEventListener('dragstart', e => e.preventDefault());
    if (overlay) overlay.appendChild(rz); else ab.appendChild(rz);
    rotateZoneEls[id] = rz;
  });

  const hint = document.createElement('div');
  hint.className = 'img-edit-hint';
  hint.textContent = '드래그: 위치 · 모서리: 크기 · Esc: 완료';
  ab.appendChild(hint);

  const boundary = document.createElement('div');
  boundary.className = 'img-boundary';
  if (overlay) overlay.appendChild(boundary);

  // 핸들 + 회전존 + 경계선 위치 동기화 (회전 포함)
  const HS  = 3.5; // 핸들 절반 (7px/2)
  const RZS = 10;  // 회전존 절반 (20px/2)
  function syncHandles() {
    if (!overlay) return;
    const abRect = ab.getBoundingClientRect();
    const oRect  = overlay.getBoundingClientRect();
    const zs     = (window.currentZoom || 100) / 100; // 캔버스 줌 팩터
    const imgX   = parseFloat(img.style.left) || 0;   // 레이아웃 좌표
    const imgY   = parseFloat(img.style.top)  || 0;
    const imgW   = img.offsetWidth  * zs;              // 스크린 좌표로 변환
    const imgH   = img.offsetHeight * zs;
    const deg    = parseFloat(ab.dataset.imgRotate || 0);
    const rad    = deg * Math.PI / 180;
    const cos    = Math.cos(rad), sin = Math.sin(rad);
    // 이미지 중심 (오버레이 좌표) — imgX/imgY도 zs 곱해 스크린 좌표로 통일
    const cx = (abRect.left - oRect.left) + imgX * zs + imgW / 2;
    const cy = (abRect.top  - oRect.top)  + imgY * zs + imgH / 2;
    // 이미지 기준 상대 좌표를 회전 후 절대 좌표로 변환
    const rp = (px, py) => [cx + px*cos - py*sin, cy + px*sin + py*cos];
    const pts = {
      tl: rp(-imgW/2, -imgH/2),
      tc: rp(0,       -imgH/2),
      tr: rp( imgW/2, -imgH/2),
      rc: rp( imgW/2,  0     ),
      br: rp( imgW/2,  imgH/2),
      bc: rp(0,        imgH/2),
      bl: rp(-imgW/2,  imgH/2),
      lc: rp(-imgW/2,  0     ),
    };
    Object.entries(pts).forEach(([id, [hx, hy]]) => {
      cornerEls[id].style.left = (hx - HS)  + 'px';
      cornerEls[id].style.top  = (hy - HS)  + 'px';
      if (rotateZoneEls[id]) {
        rotateZoneEls[id].style.left = (hx - RZS) + 'px';
        rotateZoneEls[id].style.top  = (hy - RZS) + 'px';
      }
    });
    // 경계선: 비회전 rect 기준으로 배치 후 동일 각도 회전
    boundary.style.left            = (cx - imgW/2) + 'px';
    boundary.style.top             = (cy - imgH/2) + 'px';
    boundary.style.width           = imgW + 'px';
    boundary.style.height          = imgH + 'px';
    boundary.style.transform       = deg ? `rotate(${deg}deg)` : '';
    boundary.style.transformOrigin = 'center center';
  }
  syncHandles();

  // 스냅 가이드 생성 (오버레이에 중앙 기준선 표시)
  let _snapGuideH = null, _snapGuideV = null;
  function _showSnapGuide(axis) {
    const overlay = document.getElementById('ss-handles-overlay');
    if (!overlay) return;
    const abRect = ab.getBoundingClientRect();
    const oRect  = overlay.getBoundingClientRect();
    const zs = (window.currentZoom || 100) / 100;
    if (axis === 'h' || axis === 'both') {
      if (!_snapGuideH) {
        _snapGuideH = document.createElement('div');
        _snapGuideH.className = 'img-snap-guide-h';
        overlay.appendChild(_snapGuideH);
      }
      const cy = (abRect.top - oRect.top) + abRect.height / 2;
      _snapGuideH.style.top  = cy + 'px';
      _snapGuideH.style.left = (abRect.left - oRect.left) + 'px';
      _snapGuideH.style.width = abRect.width + 'px';
    }
    if (axis === 'v' || axis === 'both') {
      if (!_snapGuideV) {
        _snapGuideV = document.createElement('div');
        _snapGuideV.className = 'img-snap-guide-v';
        overlay.appendChild(_snapGuideV);
      }
      const cx = (abRect.left - oRect.left) + abRect.width / 2;
      _snapGuideV.style.left = cx + 'px';
      _snapGuideV.style.top  = (abRect.top - oRect.top) + 'px';
      _snapGuideV.style.height = abRect.height + 'px';
    }
  }
  function _hideSnapGuide(axis) {
    if ((axis === 'h' || axis === 'both') && _snapGuideH) { _snapGuideH.remove(); _snapGuideH = null; }
    if ((axis === 'v' || axis === 'both') && _snapGuideV) { _snapGuideV.remove(); _snapGuideV = null; }
  }

  // 이미지 드래그 (위치 + 중앙 스냅)
  function onImgDown(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    const sl = parseFloat(img.style.left) || 0;
    const st = parseFloat(img.style.top)  || 0;
    let _rafId = null;
    function onMove(e) {
      const zs = (window.currentZoom || 100) / 100;
      const SNAP = 12 / zs;  // 화면 12px → 레이아웃 좌표 변환
      let newLeft = sl + (e.clientX - sx) / zs;
      let newTop  = st + (e.clientY - sy) / zs;
      const imgW = img.offsetWidth, imgH = img.offsetHeight;
      const frameW = ab.offsetWidth,  frameH = ab.offsetHeight;
      let snapH = false, snapV = false;
      if (Math.abs((newLeft + imgW/2) - frameW/2) < SNAP) { newLeft = frameW/2 - imgW/2; snapV = true; }
      if (Math.abs((newTop  + imgH/2) - frameH/2) < SNAP) { newTop  = frameH/2 - imgH/2; snapH = true; }
      img.style.left = newLeft + 'px';
      img.style.top  = newTop  + 'px';
      if (snapH) _showSnapGuide('h'); else _hideSnapGuide('h');
      if (snapV) _showSnapGuide('v'); else _hideSnapGuide('v');
      if (!_rafId) _rafId = requestAnimationFrame(() => { syncHandles(); syncPanel(); _rafId = null; });
    }
    function onUp() {
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
      _hideSnapGuide('both');
      ab.dataset.imgX = parseFloat(img.style.left) || 0;
      ab.dataset.imgY = parseFloat(img.style.top)  || 0;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // 드래그 직후 spurious click으로 편집 모드가 종료되는 것을 방지
      ab._justDragged = true;
      setTimeout(() => { ab._justDragged = false; }, 50);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // 모서리 + 변 중앙 핸들 드래그 (스케일)
  function onScaleDown(e, handle) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const startX  = e.clientX, startY = e.clientY;
    const startIX = parseFloat(img.style.left) || 0;
    const startIY = parseFloat(img.style.top)  || 0;
    const startW  = img.offsetWidth, startH = img.offsetHeight;
    const ratio   = startW / startH;
    const isLeft  = handle === 'tl' || handle === 'bl' || handle === 'lc';
    const isTop   = handle === 'tl' || handle === 'tr' || handle === 'tc';
    const isEdgeH = handle === 'lc' || handle === 'rc';
    const isEdgeV = handle === 'tc' || handle === 'bc';
    let _rafId = null;
    function onMove(e) {
      const zs = (window.currentZoom || 100) / 100;
      const rawDx = (e.clientX - startX) / zs;
      const rawDy = (e.clientY - startY) / zs;
      if (isEdgeH) {
        const dx = isLeft ? -rawDx : rawDx;
        const newW = Math.max(40, startW + dx);
        const newH = newW / ratio;
        img.style.width = newW + 'px';
        if (isLeft) img.style.left = (startIX + (startW - newW)) + 'px';
        img.style.top = (startIY + (startH - newH) / 2) + 'px';
      } else if (isEdgeV) {
        const dy = isTop ? -rawDy : rawDy;
        const newH = Math.max(40/ratio, startH + dy);
        const newW = newH * ratio;
        img.style.width = newW + 'px';
        if (isTop) img.style.top = (startIY + (startH - newH)) + 'px';
        img.style.left = (startIX + (startW - newW) / 2) + 'px';
      } else {
        // 모서리: 가로 기준 비례 스케일
        const dx = isLeft ? -rawDx : rawDx;
        const newW = Math.max(40, startW + dx);
        const newH = newW / ratio;
        img.style.width = newW + 'px';
        if (isLeft) img.style.left = (startIX + (startW - newW)) + 'px';
        if (isTop)  img.style.top  = (startIY + (startH - newH)) + 'px';
      }
      if (!_rafId) _rafId = requestAnimationFrame(() => { syncHandles(); syncPanel(); _rafId = null; });
    }
    function onUp() {
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
      ab.dataset.imgW = img.offsetWidth;
      ab.dataset.imgX = parseFloat(img.style.left) || 0;
      ab.dataset.imgY = parseFloat(img.style.top)  || 0;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // 드래그 직후 spurious click으로 편집 모드가 종료되는 것을 방지
      ab._justDragged = true;
      setTimeout(() => { ab._justDragged = false; }, 50);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // 회전존 드래그 (회전)
  function onRotateDown(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    // 이미지 중심 = 회전 중심 — getBoundingClientRect 중심은 줌·회전 모두 반영
    const imgRect = img.getBoundingClientRect();
    const centerX = imgRect.left + imgRect.width  / 2;
    const centerY = imgRect.top  + imgRect.height / 2;
    const startAng = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
    const baseRot  = parseFloat(ab.dataset.imgRotate || 0);
    let _rafId = null;
    function onMove(e) {
      const ang = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
      let newRot = baseRot + (ang - startAng);
      // 45도 단위 스냅 (5도 이내)
      const snap = Math.round(newRot / 45) * 45;
      if (Math.abs(newRot - snap) < 5) newRot = snap;
      ab.dataset.imgRotate = newRot;
      img.style.transform = `rotate(${newRot}deg)`;
      if (!_rafId) _rafId = requestAnimationFrame(() => { syncHandles(); _rafId = null; });
    }
    function onUp() {
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
      window.triggerAutoSave?.();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // 드래그 직후 spurious click으로 편집 모드가 종료되는 것을 방지
      ab._justDragged = true;
      setTimeout(() => { ab._justDragged = false; }, 50);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  img.addEventListener('mousedown', onImgDown);
  Object.entries(cornerEls).forEach(([id, el]) => {
    el.addEventListener('mousedown', e => onScaleDown(e, id));
  });
  Object.values(rotateZoneEls).forEach(rz => {
    rz.addEventListener('mousedown', onRotateDown);
  });

  renderImgPanel();

  // RAF 루프 — 캔버스 패닝/줌 시에도 핸들·경계선 위치 계속 동기화
  let _syncRafId = null;
  function _syncLoop() { syncHandles(); _syncRafId = requestAnimationFrame(_syncLoop); }
  _syncRafId = requestAnimationFrame(_syncLoop);

  ab._imgEditCleanup = () => {
    if (_syncRafId) { cancelAnimationFrame(_syncRafId); _syncRafId = null; }
    _hideSnapGuide('both');
    img.removeEventListener('mousedown', onImgDown);
    Object.values(cornerEls).forEach(h => h.remove());
    Object.values(rotateZoneEls).forEach(h => h.remove());
    hint.remove();
    img.draggable = false;
    ab.draggable = false;
    if (_row) _row.draggable = true;
  };

  ab._exitImgEdit = e => {
    if (ab._justDragged) return; // 드래그/리사이즈 직후 spurious click 무시
    const isOverlayHandle = e.target.classList.contains('img-corner-handle') ||
                            e.target.classList.contains('img-edge-handle')   ||
                            e.target.classList.contains('img-boundary')      ||
                            e.target.classList.contains('img-rotate-zone');
    if (!ab.contains(e.target) && !isOverlayHandle) exitImageEditMode(ab);
  };
  ab._exitImgEsc  = e => { if (e.key === 'Escape') exitImageEditMode(ab); };
  setTimeout(() => {
    document.addEventListener('click',   ab._exitImgEdit);
    document.addEventListener('keydown', ab._exitImgEsc);
  }, 0);
}

function exitImageEditMode(ab) {
  if (!ab._imgEditing) return;
  ab._imgEditing = false;
  ab.classList.remove('img-editing');
  const img = ab.querySelector('.asset-img');
  if (img) {
    ab.dataset.imgW = img.offsetWidth;
    ab.dataset.imgX = parseFloat(img.style.left) || 0;
    ab.dataset.imgY = parseFloat(img.style.top)  || 0;
    img.style.objectFit = 'cover';
  }
  document.querySelectorAll('.img-corner-handle, .img-edge-handle, .img-edit-hint, .img-boundary, .img-rotate-zone').forEach(el => el.remove());
  if (ab._imgEditCleanup) { ab._imgEditCleanup(); ab._imgEditCleanup = null; }
  document.removeEventListener('click',   ab._exitImgEdit);
  document.removeEventListener('keydown', ab._exitImgEsc);
  ab._exitImgEdit = null;
  ab._exitImgEsc  = null;
}

function triggerAssetUpload(ab) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0];
    if (file) loadImageToAsset(ab, file);
  };
  input.click();
}

function loadImageToAsset(ab, file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 10 * 1024 * 1024) { alert('이미지 파일은 10MB 이하만 업로드할 수 있습니다.'); return; }
  exitImageEditMode(ab);
  pushHistory();
  showAssetLoading(ab);
  const reader = new FileReader();
  reader.onload = ev => {
    hideAssetLoading(ab);
    const src = ev.target.result;
    ab.classList.add('has-image');
    ab.dataset.imgSrc = src;
    if (!ab.dataset.fit) ab.dataset.fit = 'cover';
    // 기존 위치/크기/포지션 초기화
    delete ab.dataset.imgW;
    delete ab.dataset.imgX;
    delete ab.dataset.imgY;
    delete ab.dataset.imgPosition;
    // 기존 overlay 내용 보존
    const prevOverlayEl = ab.querySelector('.asset-overlay');
    const prevOverlayHTML = prevOverlayEl ? prevOverlayEl.innerHTML : '';
    const prevOverlayStyle = prevOverlayEl ? prevOverlayEl.getAttribute('style') || '' : '';
    ab.innerHTML = `
      <div class="asset-img-clip"><img class="asset-img" src="${src}" draggable="false" style="object-fit:${ab.dataset.fit}" onerror="this.style.opacity='0.3';this.alt='이미지 로드 실패'"></div>
      <button class="asset-overlay-clear" title="이미지 제거">✕</button>
      <div class="asset-overlay" ${prevOverlayStyle ? `style="${prevOverlayStyle}"` : ''}>${prevOverlayHTML}</div>`;
    ab.querySelector('.asset-overlay-clear').addEventListener('click', e => {
      e.stopPropagation();
      clearAssetImage(ab);
    });
    // overlay-tb 블록 재바인딩
    ab.querySelectorAll('.overlay-tb').forEach(b => { b._blockBound = false; bindBlock(b); });
    showAssetProperties(ab);
  };
  reader.onerror = () => hideAssetLoading(ab);
  reader.readAsDataURL(file);
}

function clearAssetImage(ab) {
  exitImageEditMode(ab);
  pushHistory();
  ab.classList.remove('has-image');
  delete ab.dataset.imgSrc;
  delete ab.dataset.fit;
  delete ab.dataset.imgW;
  delete ab.dataset.imgX;
  delete ab.dataset.imgY;
  const prevOverlayEl2 = ab.querySelector('.asset-overlay');
  const prevOverlayHTML2 = prevOverlayEl2 ? prevOverlayEl2.innerHTML : '';
  const prevOverlayStyle2 = prevOverlayEl2 ? prevOverlayEl2.getAttribute('style') || '' : '';
  ab.innerHTML = `
    <div class="asset-overlay" ${prevOverlayStyle2 ? `style="${prevOverlayStyle2}"` : ''}>${prevOverlayHTML2}</div>`;
  ab.querySelectorAll('.overlay-tb').forEach(b => { b._blockBound = false; bindBlock(b); });
  showAssetProperties(ab);
}

/* ══════════════════════════════════════
   이미지 포지션 드래그 모드
══════════════════════════════════════ */
function enterPosDragMode(ab) {
  if (ab._posDragging) return;
  const img = ab.querySelector('.asset-img');
  if (!img) return;

  ab._posDragging = true;
  ab.classList.add('pos-dragging');

  const stored = ab.dataset.imgPosition || '50% 50%';
  const parts  = stored.split(' ');
  let posX = parseFloat(parts[0]) || 50;
  let posY = parseFloat(parts[1]) || 50;

  const applyPos = () => {
    img.style.objectPosition = `${posX}% ${posY}%`;
    ab.dataset.imgPosition   = `${posX}% ${posY}%`;
  };
  applyPos();

  const hint = document.createElement('div');
  hint.className = 'img-edit-hint';
  hint.textContent = '드래그로 이미지 위치 조절 · Esc / 블록 밖: 완료';
  ab.appendChild(hint);

  let isDragging = false;
  let startX, startY, startPosX, startPosY;

  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    startPosX = posX;   startPosY = posY;
  }
  function onMouseMove(e) {
    if (!isDragging) return;
    const zs = (window.currentZoom || 100) / 100;
    const fw = ab.offsetWidth;
    const fh = ab.offsetHeight;
    const dx = (e.clientX - startX) / zs;
    const dy = (e.clientY - startY) / zs;
    posX = Math.max(0, Math.min(100, startPosX - (dx / fw * 100)));
    posY = Math.max(0, Math.min(100, startPosY - (dy / fh * 100)));
    applyPos();
  }
  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    pushHistory();
  }

  ab.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup',   onMouseUp);

  ab._posDragCleanup = () => {
    ab.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
    hint.remove();
  };

  ab._exitPosDrag    = e => { if (!ab.contains(e.target)) exitPosDragMode(ab); };
  ab._exitPosDragEsc = e => { if (e.key === 'Escape') exitPosDragMode(ab); };
  setTimeout(() => {
    document.addEventListener('click',   ab._exitPosDrag);
    document.addEventListener('keydown', ab._exitPosDragEsc);
  }, 0);
}

function exitPosDragMode(ab) {
  if (!ab._posDragging) return;
  ab._posDragging = false;
  ab.classList.remove('pos-dragging');
  if (ab._posDragCleanup) { ab._posDragCleanup(); ab._posDragCleanup = null; }
  document.removeEventListener('click',   ab._exitPosDrag);
  document.removeEventListener('keydown', ab._exitPosDragEsc);
  ab._exitPosDrag    = null;
  ab._exitPosDragEsc = null;
  showAssetProperties(ab);
}

window.enterPosDragMode   = enterPosDragMode;
window.exitPosDragMode    = exitPosDragMode;
window.enterImageEditMode = enterImageEditMode;
window.exitImageEditMode  = exitImageEditMode;

/* ══════════════════════════════════════
   배경 이미지 위치 드래그 모드 (섹션 / 서브섹션 공용)
══════════════════════════════════════ */
function enterBgPosDragMode(el) {
  if (el._bgPosDragging) return;
  if (!el.style.backgroundImage || el.style.backgroundImage === 'none') return;

  el._bgPosDragging = true;
  el.classList.add('bg-pos-dragging');
  el.draggable = false;

  const stored = el.dataset.bgPos || '50% 50%';
  const parts  = stored.split(' ');
  let posX = parseFloat(parts[0]) || 50;
  let posY = parseFloat(parts[1]) || 50;

  const applyPos = () => {
    el.style.backgroundPosition = `${posX}% ${posY}%`;
    el.dataset.bgPos = `${posX}% ${posY}%`;
  };
  applyPos();

  const hint = document.createElement('div');
  hint.className = 'img-edit-hint';
  hint.textContent = '드래그로 배경 위치 조절 · Esc / 블록 밖: 완료';
  el.style.position = el.style.position || 'relative';
  el.appendChild(hint);

  let isDragging = false;
  let startX, startY, startPosX, startPosY;

  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    startPosX = posX;   startPosY = posY;
  }
  function onMouseMove(e) {
    if (!isDragging) return;
    const zs = (window.currentZoom || 100) / 100;
    const fw = el.offsetWidth;
    const fh = el.offsetHeight;
    const dx = (e.clientX - startX) / zs;
    const dy = (e.clientY - startY) / zs;
    posX = Math.max(0, Math.min(100, startPosX - (dx / fw * 100)));
    posY = Math.max(0, Math.min(100, startPosY - (dy / fh * 100)));
    applyPos();
  }
  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    pushHistory();
  }

  el.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup',   onMouseUp);

  el._bgPosDragCleanup = () => {
    el.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
    hint.remove();
  };

  el._exitBgPosDrag    = e => { if (!el.contains(e.target)) exitBgPosDragMode(el); };
  el._exitBgPosDragEsc = e => { if (e.key === 'Escape') exitBgPosDragMode(el); };
  setTimeout(() => {
    document.addEventListener('click',   el._exitBgPosDrag);
    document.addEventListener('keydown', el._exitBgPosDragEsc);
  }, 0);
}

function exitBgPosDragMode(el) {
  if (!el._bgPosDragging) return;
  el._bgPosDragging = false;
  el.classList.remove('bg-pos-dragging');
  el.draggable = true;
  if (el._bgPosDragCleanup) { el._bgPosDragCleanup(); el._bgPosDragCleanup = null; }
  document.removeEventListener('click',   el._exitBgPosDrag);
  document.removeEventListener('keydown', el._exitBgPosDragEsc);
  el._exitBgPosDrag    = null;
  el._exitBgPosDragEsc = null;
  window.scheduleAutoSave?.();
  // 프로퍼티 패널 갱신
  if (el.classList.contains('section-block')) window.showSectionProperties?.(el);
  else if (el.classList.contains('frame-block')) window.showFrameProperties?.(el);
}

window.enterBgPosDragMode = enterBgPosDragMode;
window.exitBgPosDragMode  = exitBgPosDragMode;
window.applyImageTransform = applyImageTransform;
window.triggerAssetUpload = triggerAssetUpload;
window.clearAssetImage    = clearAssetImage;
window.loadImageToAsset   = loadImageToAsset;

window.triggerCircleUpload        = triggerCircleUpload;
window.loadImageToCircle          = loadImageToCircle;
window.clearCircleImage           = clearCircleImage;
window.applyCircleImageTransform  = applyCircleImageTransform;
window.enterCircleImageEditMode   = enterCircleImageEditMode;
window.exitCircleImageEditMode    = exitCircleImageEditMode;

window.triggerCardImageUpload     = triggerCardImageUpload;
window.loadImageToCard            = loadImageToCard;
window.clearCardImage             = clearCardImage;


/* ══════════════════════════════════════
   원형 프레임 (Icon Circle) 이미지
══════════════════════════════════════ */
function triggerCircleUpload(icb) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0];
    if (file) loadImageToCircle(icb, file);
  };
  input.click();
}

function loadImageToCircle(icb, file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 10 * 1024 * 1024) { alert('이미지 파일은 10MB 이하만 업로드할 수 있습니다.'); return; }
  exitCircleImageEditMode(icb);
  pushHistory();
  showAssetLoading(icb);
  const reader = new FileReader();
  reader.onload = ev => {
    hideAssetLoading(icb);
    const src = ev.target.result;
    const circle = icb.querySelector('.icb-circle');
    icb.classList.add('has-image');
    icb.dataset.imgSrc = src;
    // 기존 위치/크기/포지션 초기화
    delete icb.dataset.imgW;
    delete icb.dataset.imgX;
    delete icb.dataset.imgY;
    delete icb.dataset.imgPosition;
    circle.style.position = 'relative';
    circle.innerHTML = `
      <img class="icb-img" src="${src}" style="width:100%;height:100%;object-fit:cover;display:block;" draggable="false">
      <button class="icb-clear-btn" title="이미지 제거">✕</button>`;
    circle.querySelector('.icb-clear-btn').addEventListener('click', e => {
      e.stopPropagation();
      clearCircleImage(icb);
    });
    showIconCircleProperties(icb);
  };
  reader.onerror = () => hideAssetLoading(icb);
  reader.readAsDataURL(file);
}

/* ── Circle 이미지 위치/스케일 복원 ── */
function applyCircleImageTransform(icb) {
  const circle = icb.querySelector('.icb-circle');
  const img = icb.querySelector('.icb-img');
  if (!img || !icb.dataset.imgW) return;
  circle.style.position = 'relative';
  img.style.position  = 'absolute';
  img.style.objectFit = 'fill';
  img.style.width     = icb.dataset.imgW + 'px';
  img.style.height    = 'auto';
  img.style.left      = (parseFloat(icb.dataset.imgX) || 0) + 'px';
  img.style.top       = (parseFloat(icb.dataset.imgY) || 0) + 'px';
}

/* ── Circle 이미지 편집 모드 ── */
function enterCircleImageEditMode(icb) {
  if (icb._imgEditing) return;
  const circle = icb.querySelector('.icb-circle');
  const img    = icb.querySelector('.icb-img');
  if (!img) return;

  icb._imgEditing = true;
  icb.classList.add('img-editing');
  icb.draggable = false;
  const _row = icb.closest('.row');
  if (_row) _row.draggable = false;

  const frameW = circle.offsetWidth;
  const frameH = circle.offsetHeight;
  circle.style.position = 'relative';
  circle.style.overflow = 'visible'; // 편집 모드: 이미지 전체 표시 (asset-block과 동일)

  if (icb.dataset.imgW) {
    applyCircleImageTransform(icb);
  } else {
    const ratio  = (img.naturalWidth / img.naturalHeight) || 1;
    const initW  = frameW;
    const initH  = initW / ratio;
    img.style.position  = 'absolute';
    img.style.objectFit = 'fill';
    img.style.width     = initW + 'px';
    img.style.height    = 'auto';
    img.style.left      = '0px';
    img.style.top       = ((frameH - initH) / 2) + 'px';
    icb.dataset.imgW = initW;
    icb.dataset.imgX = 0;
    icb.dataset.imgY = (frameH - initH) / 2;
  }
  img.draggable = false;

  function renderCircleImgPanel() {
    const x = Math.round(parseFloat(img.style.left) || 0);
    const y = Math.round(parseFloat(img.style.top)  || 0);
    const w = Math.round(img.offsetWidth);
    propPanel.innerHTML = `
      <div class="prop-section">
        <div class="prop-block-label">
          <div class="prop-block-icon">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
              <circle cx="6" cy="6" r="5"/><circle cx="4" cy="4" r="1"/><polyline points="11 8 8 5 3 11"/>
            </svg>
          </div>
          <span class="prop-block-name">이미지 편집</span>
        </div>
        <div class="prop-section-title">위치</div>
        <div class="prop-row"><span class="prop-label">X</span>
          <input type="number" class="prop-number" id="icb-img-x" style="width:64px" value="${x}">
        </div>
        <div class="prop-row"><span class="prop-label">Y</span>
          <input type="number" class="prop-number" id="icb-img-y" style="width:64px" value="${y}">
        </div>
      </div>
      <div class="prop-section">
        <div class="prop-section-title">크기</div>
        <div class="prop-row"><span class="prop-label">너비</span>
          <input type="number" class="prop-number" id="icb-img-w" style="width:64px" value="${w}" min="40">
        </div>
        <div class="prop-row"><span class="prop-label">높이</span>
          <input type="number" class="prop-number" id="icb-img-h" style="width:64px" value="${Math.round(img.offsetHeight)}" disabled>
        </div>
      </div>
      <div class="prop-section" style="color:#555;font-size:11px;padding-top:0;">
        Esc 또는 블록 밖 클릭으로 편집 종료
      </div>`;
    document.getElementById('icb-img-x').addEventListener('input', e => {
      img.style.left = (parseInt(e.target.value) || 0) + 'px';
      icb.dataset.imgX = parseInt(e.target.value) || 0;
      syncHandles();
    });
    document.getElementById('icb-img-y').addEventListener('input', e => {
      img.style.top = (parseInt(e.target.value) || 0) + 'px';
      icb.dataset.imgY = parseInt(e.target.value) || 0;
      syncHandles();
    });
    document.getElementById('icb-img-w').addEventListener('input', e => {
      const v = Math.max(40, parseInt(e.target.value) || 40);
      img.style.width = v + 'px';
      icb.dataset.imgW = v;
      syncHandles();
      const hEl = document.getElementById('icb-img-h');
      if (hEl) hEl.value = Math.round(img.offsetHeight);
    });
  }

  function syncPanel() {
    const xEl = document.getElementById('icb-img-x');
    const yEl = document.getElementById('icb-img-y');
    const wEl = document.getElementById('icb-img-w');
    const hEl = document.getElementById('icb-img-h');
    if (xEl) xEl.value = Math.round(parseFloat(img.style.left) || 0);
    if (yEl) yEl.value = Math.round(parseFloat(img.style.top)  || 0);
    if (wEl) wEl.value = Math.round(img.offsetWidth);
    if (hEl) hEl.value = Math.round(img.offsetHeight);
  }

  // 8 핸들 (icb 기준, circle offsetLeft/Top 보정)
  const ICB_HANDLES = [
    { id: 'tl', cursor: 'nwse-resize', cls: 'img-corner-handle' },
    { id: 'tc', cursor: 'ns-resize',   cls: 'img-edge-handle'   },
    { id: 'tr', cursor: 'nesw-resize', cls: 'img-corner-handle' },
    { id: 'rc', cursor: 'ew-resize',   cls: 'img-edge-handle'   },
    { id: 'br', cursor: 'nwse-resize', cls: 'img-corner-handle' },
    { id: 'bc', cursor: 'ns-resize',   cls: 'img-edge-handle'   },
    { id: 'bl', cursor: 'nesw-resize', cls: 'img-corner-handle' },
    { id: 'lc', cursor: 'ew-resize',   cls: 'img-edge-handle'   },
  ];
  const handleEls = {};
  const HS = 5;
  ICB_HANDLES.forEach(({ id, cursor, cls }) => {
    const h = document.createElement('div');
    h.className = cls;
    h.style.cursor = cursor;
    h.draggable = false;
    h.addEventListener('dragstart', e => e.preventDefault());
    icb.appendChild(h);
    handleEls[id] = h;
  });

  const hint = document.createElement('div');
  hint.className = 'img-edit-hint';
  hint.textContent = '드래그: 위치 · 모서리: 크기 · Esc: 완료';
  icb.appendChild(hint);

  function syncHandles() {
    const cx = circle.offsetLeft;
    const cy = circle.offsetTop;
    const x  = parseFloat(img.style.left) || 0;
    const y  = parseFloat(img.style.top)  || 0;
    const w  = img.offsetWidth;
    const h  = img.offsetHeight;
    const pos = {
      tl: [cx + x - HS,         cy + y - HS        ],
      tc: [cx + x + w/2 - HS,   cy + y - HS        ],
      tr: [cx + x + w - HS,     cy + y - HS        ],
      rc: [cx + x + w - HS,     cy + y + h/2 - HS  ],
      br: [cx + x + w - HS,     cy + y + h - HS    ],
      bc: [cx + x + w/2 - HS,   cy + y + h - HS    ],
      bl: [cx + x - HS,         cy + y + h - HS    ],
      lc: [cx + x - HS,         cy + y + h/2 - HS  ],
    };
    Object.entries(pos).forEach(([id, [lx, ly]]) => {
      handleEls[id].style.left = lx + 'px';
      handleEls[id].style.top  = ly + 'px';
    });
  }
  syncHandles();

  function onImgDown(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const zs = (window.currentZoom || 100) / 100;
    const sx = e.clientX, sy = e.clientY;
    const sl = parseFloat(img.style.left) || 0;
    const st = parseFloat(img.style.top)  || 0;
    function onMove(e) {
      img.style.left = (sl + (e.clientX - sx) / zs) + 'px';
      img.style.top  = (st + (e.clientY - sy) / zs) + 'px';
      syncHandles(); syncPanel();
    }
    function onUp() {
      icb.dataset.imgX = parseFloat(img.style.left) || 0;
      icb.dataset.imgY = parseFloat(img.style.top)  || 0;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onHandleDown(e, handle) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const zs      = (window.currentZoom || 100) / 100;
    const startX  = e.clientX, startY = e.clientY;
    const startIX = parseFloat(img.style.left) || 0;
    const startIY = parseFloat(img.style.top)  || 0;
    const startW  = img.offsetWidth;
    const startH  = img.offsetHeight;
    const ratio   = startW / startH;
    const isLeft  = handle === 'tl' || handle === 'bl' || handle === 'lc';
    const isTop   = handle === 'tl' || handle === 'tr' || handle === 'tc';
    const isEdgeH = handle === 'lc' || handle === 'rc';
    const isEdgeV = handle === 'tc' || handle === 'bc';
    function onMove(e) {
      const rawDx = (e.clientX - startX) / zs;
      const rawDy = (e.clientY - startY) / zs;
      let newW, newH;
      if (isEdgeH) {
        const dx = isLeft ? -rawDx : rawDx;
        newW = Math.max(40, startW + dx);
        newH = newW / ratio;
        img.style.width = newW + 'px';
        if (isLeft) img.style.left = (startIX + (startW - newW)) + 'px';
        img.style.top = (startIY + (startH - newH) / 2) + 'px';
      } else if (isEdgeV) {
        const dy = isTop ? -rawDy : rawDy;
        newH = Math.max(40 / ratio, startH + dy);
        newW = newH * ratio;
        img.style.width = newW + 'px';
        if (isTop) img.style.top = (startIY + (startH - newH)) + 'px';
        img.style.left = (startIX + (startW - newW) / 2) + 'px';
      } else {
        const dx = isLeft ? -rawDx : rawDx;
        newW = Math.max(40, startW + dx);
        newH = newW / ratio;
        img.style.width = newW + 'px';
        if (isLeft) img.style.left = (startIX + (startW - newW)) + 'px';
        if (isTop)  img.style.top  = (startIY + (startH - newH)) + 'px';
      }
      syncHandles(); syncPanel();
    }
    function onUp() {
      icb.dataset.imgW = img.offsetWidth;
      icb.dataset.imgX = parseFloat(img.style.left) || 0;
      icb.dataset.imgY = parseFloat(img.style.top)  || 0;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  img.addEventListener('mousedown', onImgDown);
  Object.entries(handleEls).forEach(([id, el]) => {
    el.addEventListener('mousedown', e => onHandleDown(e, id));
  });

  renderCircleImgPanel();

  icb._imgEditCleanup = () => {
    img.removeEventListener('mousedown', onImgDown);
    Object.values(handleEls).forEach(h => h.remove());
    hint.remove();
    img.draggable = false;
    icb.draggable = false;
    if (_row) _row.draggable = true;
  };

  icb._exitImgEdit = e => { if (!icb.contains(e.target)) exitCircleImageEditMode(icb); };
  icb._exitImgEsc  = e => { if (e.key === 'Escape') exitCircleImageEditMode(icb); };
  setTimeout(() => {
    document.addEventListener('click',   icb._exitImgEdit);
    document.addEventListener('keydown', icb._exitImgEsc);
  }, 0);
}

function exitCircleImageEditMode(icb) {
  if (!icb._imgEditing) return;
  icb._imgEditing = false;
  icb.classList.remove('img-editing');
  const img = icb.querySelector('.icb-img');
  if (img) {
    icb.dataset.imgW = img.offsetWidth;
    icb.dataset.imgX = parseFloat(img.style.left) || 0;
    icb.dataset.imgY = parseFloat(img.style.top)  || 0;
  }
  const circle = icb.querySelector('.icb-circle');
  if (circle) circle.style.overflow = ''; // 편집 모드 종료: 원형 마스크 복원
  if (icb._imgEditCleanup) { icb._imgEditCleanup(); icb._imgEditCleanup = null; }
  document.removeEventListener('click',   icb._exitImgEdit);
  document.removeEventListener('keydown', icb._exitImgEsc);
  icb._exitImgEdit = null;
  icb._exitImgEsc  = null;
}

function clearCircleImage(icb) {
  exitCircleImageEditMode(icb);
  pushHistory();
  icb.classList.remove('has-image');
  delete icb.dataset.imgSrc;
  delete icb.dataset.imgW;
  delete icb.dataset.imgX;
  delete icb.dataset.imgY;
  delete icb.dataset.imgScale;
  const circle = icb.querySelector('.icb-circle');
  circle.innerHTML = `<span class="icb-placeholder"></span>`;
  showIconCircleProperties(icb);
}

function triggerCardImageUpload(cdb) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const file = e.target.files[0];
    if (file) loadImageToCard(cdb, file);
  };
  input.click();
}

function loadImageToCard(cdb, file) {
  if (!file || !file.type.startsWith('image/')) return;
  pushHistory();
  showAssetLoading(cdb);
  const reader = new FileReader();
  reader.onload = ev => {
    hideAssetLoading(cdb);
    const src = ev.target.result;
    const imageArea = cdb.querySelector('.cdb-image');
    cdb.classList.add('has-image');
    cdb.dataset.imgSrc = src;
    imageArea.innerHTML = `
      <img class="cdb-img" src="${src}" draggable="false">
      <button class="cdb-clear-btn" title="이미지 제거">✕</button>`;
    imageArea.querySelector('.cdb-clear-btn').addEventListener('click', e => {
      e.stopPropagation();
      clearCardImage(cdb);
    });
    showCardProperties(cdb);
  };
  reader.onerror = () => hideAssetLoading(cdb);
  reader.readAsDataURL(file);
}

function clearCardImage(cdb) {
  pushHistory();
  cdb.classList.remove('has-image');
  delete cdb.dataset.imgSrc;
  const imageArea = cdb.querySelector('.cdb-image');
  imageArea.innerHTML = `<span class="cdb-img-placeholder">+</span>`;
  showCardProperties(cdb);
}


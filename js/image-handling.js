/* ══════════════════════════════════════
   이미지 업로드 (Asset)
══════════════════════════════════════ */
/* ── 이미지 위치/스케일 복원 (로드·undo 후) ── */
function applyImageTransform(ab) {
  const img = ab.querySelector('.asset-img');
  if (!img || !ab.dataset.imgW) return;
  img.style.position  = 'absolute';
  img.style.objectFit = 'cover';
  img.style.width     = ab.dataset.imgW + 'px';
  img.style.height    = 'auto';
  img.style.left      = (parseFloat(ab.dataset.imgX) || 0) + 'px';
  img.style.top       = (parseFloat(ab.dataset.imgY) || 0) + 'px';
}

function enterImageEditMode(ab) {
  if (ab._imgEditing) return;
  const img = ab.querySelector('.asset-img');
  if (!img) return;

  ab._imgEditing = true;
  ab.classList.add('img-editing');
  ab.draggable = false;
  ab.style.overflow = 'visible'; // 핸들이 프레임 밖에 위치할 수 있도록
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

  // 4 모서리 핸들 생성
  const CORNERS = [
    { id: 'tl', cursor: 'nwse-resize' },
    { id: 'tr', cursor: 'nesw-resize' },
    { id: 'bl', cursor: 'nesw-resize' },
    { id: 'br', cursor: 'nwse-resize' },
  ];
  const cornerEls = {};
  CORNERS.forEach(({ id, cursor }) => {
    const h = document.createElement('div');
    h.className = 'img-corner-handle';
    h.style.cursor = cursor;
    h.draggable = false;
    h.addEventListener('dragstart', e => e.preventDefault());
    ab.appendChild(h);
    cornerEls[id] = h;
  });

  const hint = document.createElement('div');
  hint.className = 'img-edit-hint';
  hint.textContent = '드래그: 위치 · 모서리: 크기 · Esc: 완료';
  ab.appendChild(hint);

  // 핸들 위치를 이미지 4 모서리에 동기화
  const HS = 5; // 핸들 절반 크기 (10px / 2)
  function syncHandles() {
    const x = parseFloat(img.style.left) || 0;
    const y = parseFloat(img.style.top)  || 0;
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    const pos = {
      tl: [x - HS,     y - HS    ],
      tr: [x + w - HS, y - HS    ],
      bl: [x - HS,     y + h - HS],
      br: [x + w - HS, y + h - HS],
    };
    Object.entries(pos).forEach(([id, [lx, ly]]) => {
      cornerEls[id].style.left = lx + 'px';
      cornerEls[id].style.top  = ly + 'px';
    });
  }
  syncHandles();

  // 이미지 드래그 (위치)
  function onImgDown(e) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const zs = currentZoom / 100;
    const sx = e.clientX, sy = e.clientY;
    const sl = parseFloat(img.style.left) || 0;
    const st = parseFloat(img.style.top)  || 0;
    function onMove(e) {
      img.style.left = (sl + (e.clientX - sx) / zs) + 'px';
      img.style.top  = (st + (e.clientY - sy) / zs) + 'px';
      syncHandles(); syncPanel();
    }
    function onUp() {
      ab.dataset.imgX = parseFloat(img.style.left) || 0;
      ab.dataset.imgY = parseFloat(img.style.top)  || 0;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // 모서리 드래그 (스케일 — 반대 모서리 앵커 고정)
  function onCornerDown(e, corner) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const zs      = currentZoom / 100;
    const startX  = e.clientX;
    const startIX = parseFloat(img.style.left) || 0;
    const startIY = parseFloat(img.style.top)  || 0;
    const startW  = img.offsetWidth;
    const startH  = img.offsetHeight;
    const ratio   = startW / startH;
    const isLeft  = corner === 'tl' || corner === 'bl';
    const isTop   = corner === 'tl' || corner === 'tr';

    function onMove(e) {
      const rawDx = (e.clientX - startX) / zs;
      const dx    = isLeft ? -rawDx : rawDx;
      const newW  = Math.max(40, startW + dx);
      const newH  = newW / ratio;
      img.style.width = newW + 'px';
      if (isLeft) img.style.left = (startIX + (startW - newW)) + 'px';
      if (isTop)  img.style.top  = (startIY + (startH - newH)) + 'px';
      syncHandles(); syncPanel();
    }
    function onUp() {
      ab.dataset.imgW = img.offsetWidth;
      ab.dataset.imgX = parseFloat(img.style.left) || 0;
      ab.dataset.imgY = parseFloat(img.style.top)  || 0;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  img.addEventListener('mousedown', onImgDown);
  Object.entries(cornerEls).forEach(([id, el]) => {
    el.addEventListener('mousedown', e => onCornerDown(e, id));
  });

  renderImgPanel();

  ab._imgEditCleanup = () => {
    img.removeEventListener('mousedown', onImgDown);
    Object.values(cornerEls).forEach(h => h.remove());
    hint.remove();
    img.draggable = false;
    ab.draggable = false;
    if (_row) _row.draggable = true; // row draggable 복원
  };

  ab._exitImgEdit = e => { if (!ab.contains(e.target)) exitImageEditMode(ab); };
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
  ab.style.overflow = 'hidden'; // 프레임 클리핑 복원
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
  exitImageEditMode(ab);
  pushHistory();
  const reader = new FileReader();
  reader.onload = ev => {
    const src = ev.target.result;
    ab.classList.add('has-image');
    ab.dataset.imgSrc = src;
    if (!ab.dataset.fit) ab.dataset.fit = 'cover';
    // 기존 위치/크기 초기화
    delete ab.dataset.imgW;
    delete ab.dataset.imgX;
    delete ab.dataset.imgY;
    ab.innerHTML = `
      <img class="asset-img" src="${src}" draggable="false" style="object-fit:${ab.dataset.fit}">
      <button class="asset-overlay-clear" title="이미지 제거">✕</button>`;
    ab.querySelector('.asset-overlay-clear').addEventListener('click', e => {
      e.stopPropagation();
      clearAssetImage(ab);
    });
    showAssetProperties(ab);
  };
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
  ab.innerHTML = `
    ${ASSET_SVG}
    <span class="asset-label">에셋을 업로드하거나 드래그하세요</span>`;
  showAssetProperties(ab);
}

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
  pushHistory();
  const reader = new FileReader();
  reader.onload = ev => {
    const src = ev.target.result;
    const circle = icb.querySelector('.icb-circle');
    icb.classList.add('has-image');
    icb.dataset.imgSrc = src;
    circle.innerHTML = `
      <img class="icb-img" src="${src}" draggable="false">
      <button class="icb-clear-btn" title="이미지 제거">✕</button>`;
    circle.querySelector('.icb-clear-btn').addEventListener('click', e => {
      e.stopPropagation();
      clearCircleImage(icb);
    });
    showIconCircleProperties(icb);
  };
  reader.readAsDataURL(file);
}

function clearCircleImage(icb) {
  pushHistory();
  icb.classList.remove('has-image');
  delete icb.dataset.imgSrc;
  const circle = icb.querySelector('.icb-circle');
  circle.innerHTML = `<span class="icb-placeholder">+</span>`;
  showIconCircleProperties(icb);
}

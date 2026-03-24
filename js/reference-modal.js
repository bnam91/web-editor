/* ════════════════════════════════════════
   reference-modal.js — 레퍼런스 이미지 플로팅 모달
   ════════════════════════════════════════ */

const LS_KEY = 'reference-modal-state';

let modalEl = null;
let isVisible = false;

// ── 상태 저장/복원 ─────────────────────────────────────────
function saveState() {
  if (!modalEl) return;
  const state = {
    x: parseInt(modalEl.style.left),
    y: parseInt(modalEl.style.top),
    w: parseInt(modalEl.style.width),
    h: parseInt(modalEl.style.height),
    opacity: document.getElementById('ref-opacity-slider')?.value || 80,
    imgSrc: document.getElementById('ref-image')?.src || '',
  };
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function loadState() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}

// ── 모달 DOM 생성 ──────────────────────────────────────────
function createModal() {
  const saved = loadState();
  const W = saved.w || 320;
  const H = saved.h || 240;
  const X = saved.x ?? (window.innerWidth  - W - 24);
  const Y = saved.y ?? (window.innerHeight - H - 24);
  const opacity = saved.opacity ?? 80;

  modalEl = document.createElement('div');
  modalEl.id = 'reference-modal';
  modalEl.style.cssText = `
    position: fixed;
    left: ${X}px; top: ${Y}px;
    width: ${W}px; height: ${H}px;
    z-index: 9999;
    display: none;
    flex-direction: column;
    background: #1e1e1e;
    border: 1px solid #3a3a3a;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    overflow: hidden;
    min-width: 200px; min-height: 150px;
    opacity: ${opacity / 100};
    transition: opacity 0.15s;
  `;

  modalEl.innerHTML = `
    <!-- 헤더 (드래그 핸들) -->
    <div id="ref-header" style="
      height: 36px; flex-shrink: 0;
      background: #282828;
      border-bottom: 1px solid #333;
      display: flex; align-items: center;
      padding: 0 10px; gap: 8px;
      cursor: grab; user-select: none;
    ">
      <span style="font-size:11px; color:#888; font-weight:500; flex:1;">🖼 레퍼런스 이미지</span>

      <!-- 불투명도 슬라이더 -->
      <input id="ref-opacity-slider" type="range" min="30" max="100" value="${opacity}"
        title="불투명도"
        style="width:60px; cursor:pointer; accent-color:#2d6fe8;"
        oninput="window._refModalSetOpacity(this.value)"
      />
      <span id="ref-opacity-label" style="font-size:10px; color:#666; width:28px; text-align:right;">${opacity}%</span>

      <!-- 닫기 버튼 -->
      <button onclick="window._refModalHide()" style="
        width:20px; height:20px;
        background:transparent; border:none;
        color:#555; cursor:pointer; font-size:14px; line-height:1;
        border-radius:4px; display:flex; align-items:center; justify-content:center;
        transition: all 0.1s;
      " onmouseover="this.style.background='#3a3a3a';this.style.color='#ccc'"
         onmouseout="this.style.background='transparent';this.style.color='#555'"
         title="닫기">✕</button>
    </div>

    <!-- 툴바 -->
    <div style="
      height: 32px; flex-shrink: 0;
      background: #242424;
      border-bottom: 1px solid #2e2e2e;
      display: flex; align-items: center;
      padding: 0 8px; gap: 6px;
    ">
      <label style="
        height:22px; padding: 0 8px;
        background:#333; border:1px solid #444; border-radius:4px;
        color:#aaa; font-size:11px; cursor:pointer;
        display:flex; align-items:center; gap:4px;
        transition: all 0.15s;
      "
      onmouseover="this.style.background='#3d3d3d';this.style.color='#fff'"
      onmouseout="this.style.background='#333';this.style.color='#aaa'"
      title="로컬 이미지 업로드">
        📁 업로드
        <input id="ref-file-input" type="file" accept="image/*" style="display:none"
          onchange="window._refModalLoadFile(event)">
      </label>

      <div style="flex:1; display:flex; gap:4px;">
        <input id="ref-url-input" type="text" placeholder="이미지 URL 입력..."
          style="
            flex:1; height:22px; padding: 0 6px;
            background:#1a1a1a; border:1px solid #333; border-radius:4px;
            color:#ccc; font-size:11px; outline:none;
          "
          onkeydown="if(event.key==='Enter') window._refModalLoadUrl()"
        />
        <button onclick="window._refModalLoadUrl()" style="
          height:22px; padding:0 8px;
          background:#333; border:1px solid #444; border-radius:4px;
          color:#aaa; font-size:11px; cursor:pointer;
          transition: all 0.15s;
        "
        onmouseover="this.style.background='#3d3d3d';this.style.color='#fff'"
        onmouseout="this.style.background='#333';this.style.color='#aaa'"
        >불러오기</button>
      </div>
    </div>

    <!-- 이미지 영역 -->
    <div id="ref-image-wrap" style="
      flex:1; overflow:hidden; position:relative;
      display:flex; align-items:center; justify-content:center;
      background:#141414;
    ">
      <span id="ref-placeholder" style="
        font-size:11px; color:#444; text-align:center; line-height:1.6; pointer-events:none;
      ">이미지를 업로드하거나<br>URL을 입력하세요</span>
      <img id="ref-image" src="" alt="" style="
        max-width:100%; max-height:100%; object-fit:contain; display:none;
      " />
    </div>

    <!-- 리사이즈 핸들 (우하단) -->
    <div id="ref-resize-handle" style="
      position:absolute; bottom:0; right:0;
      width:16px; height:16px; cursor:se-resize;
      display:flex; align-items:flex-end; justify-content:flex-end;
      padding:3px;
    ">
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M1 7L7 1M4 7L7 4M7 7V7" stroke="#444" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </div>
  `;

  document.body.appendChild(modalEl);

  // 저장된 이미지 복원
  if (saved.imgSrc && saved.imgSrc !== 'about:blank' && saved.imgSrc !== window.location.href) {
    _setImage(saved.imgSrc);
  }

  _initDrag();
  _initResize();
}

// ── 이미지 설정 ────────────────────────────────────────────
function _setImage(src) {
  const img = document.getElementById('ref-image');
  const placeholder = document.getElementById('ref-placeholder');
  if (!img || !src) return;
  img.src = src;
  img.style.display = 'block';
  if (placeholder) placeholder.style.display = 'none';
  saveState();
}

// ── 파일 업로드 ────────────────────────────────────────────
window._refModalLoadFile = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => _setImage(ev.target.result);
  reader.readAsDataURL(file);
  // input 초기화 (같은 파일 재선택 허용)
  e.target.value = '';
};

// ── URL 불러오기 ───────────────────────────────────────────
window._refModalLoadUrl = function() {
  const input = document.getElementById('ref-url-input');
  const url = input?.value?.trim();
  if (!url) return;
  _setImage(url);
  if (input) input.value = '';
};

// ── 불투명도 ───────────────────────────────────────────────
window._refModalSetOpacity = function(val) {
  if (!modalEl) return;
  modalEl.style.opacity = val / 100;
  const label = document.getElementById('ref-opacity-label');
  if (label) label.textContent = val + '%';
  saveState();
};

// ── 표시/숨기기 ────────────────────────────────────────────
window._refModalHide = function() {
  if (!modalEl) return;
  modalEl.style.display = 'none';
  isVisible = false;
  const btn = document.getElementById('ref-modal-btn');
  if (btn) btn.classList.remove('active');
};

export function toggleReferenceModal() {
  if (!modalEl) createModal();
  if (isVisible) {
    window._refModalHide();
  } else {
    modalEl.style.display = 'flex';
    isVisible = true;
    const btn = document.getElementById('ref-modal-btn');
    if (btn) btn.classList.add('active');
  }
}

// ── 드래그 (헤더) ──────────────────────────────────────────
function _initDrag() {
  const header = document.getElementById('ref-header');
  if (!header) return;

  let startX, startY, startLeft, startTop;

  header.addEventListener('mousedown', e => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(modalEl.style.left);
    startTop  = parseInt(modalEl.style.top);
    header.style.cursor = 'grabbing';

    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      modalEl.style.left = (startLeft + dx) + 'px';
      modalEl.style.top  = (startTop  + dy) + 'px';
    }
    function onUp() {
      header.style.cursor = 'grab';
      saveState();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── 리사이즈 (우하단 핸들) ─────────────────────────────────
function _initResize() {
  const handle = document.getElementById('ref-resize-handle');
  if (!handle) return;

  let startX, startY, startW, startH;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    startX = e.clientX;
    startY = e.clientY;
    startW = parseInt(modalEl.style.width);
    startH = parseInt(modalEl.style.height);

    function onMove(e) {
      const w = Math.max(200, startW + (e.clientX - startX));
      const h = Math.max(150, startH + (e.clientY - startY));
      modalEl.style.width  = w + 'px';
      modalEl.style.height = h + 'px';
    }
    function onUp() {
      saveState();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── 글로벌 노출 (onclick에서 호출 가능하도록) ─────────────────
window._refModalToggle = toggleReferenceModal;

// ── 단축키 ────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    toggleReferenceModal();
  }
});

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
    background: #141414;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.7);
    overflow: hidden;
    min-width: 200px; min-height: 150px;
    opacity: ${opacity / 100};
    transition: opacity 0.15s;
  `;

  modalEl.innerHTML = `
    <style>
      #ref-opacity-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px; height: 12px; border-radius: 50%;
        background: rgba(255,255,255,0.75); cursor: pointer;
      }
    </style>
    <!-- 이미지 영역 (드래그로 모달 이동, 항상 전체 크기) -->
    <div id="ref-image-wrap" style="
      width:100%; height:100%; position:relative;
      display:flex; align-items:center; justify-content:center;
      background:#141414; cursor:grab;
      border-radius: 12px;
      overflow: hidden;
    ">
      <span id="ref-placeholder" style="
        font-size:11px; color:#555; text-align:center; line-height:1.8; pointer-events:none;
      ">이미지를 업로드하거나<br>URL을 입력하세요</span>
      <img id="ref-image" src="" alt="" style="
        max-width:100%; max-height:100%; object-fit:contain; display:none;
        pointer-events:none; user-select:none;
      " />

      <!-- 툴바 오버레이 (호버 시 슬라이드다운) -->
      <div id="ref-header" style="
        position:absolute; top:0; left:0; right:0;
        height:0; overflow:hidden;
        display:flex; align-items:center;
        padding: 0 8px; gap: 6px;
        background: rgba(20,20,20,0.72);
        backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        border-bottom: 1px solid rgba(255,255,255,0.07);
        user-select: none;
        transition: height 0.18s cubic-bezier(0.4,0,0.2,1);
        z-index: 2;
      ">
        <!-- URL 인풋 -->
        <input id="ref-url-input" type="text" placeholder="이미지 URL..."
          style="
            flex:1; height:20px; padding: 0 8px; min-width:0;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 6px;
            color: rgba(255,255,255,0.85); font-size:11px; outline:none;
            transition: border-color 0.15s;
          "
          onfocus="this.style.borderColor='rgba(255,255,255,0.3)'"
          onblur="this.style.borderColor='rgba(255,255,255,0.12)'"
          onkeydown="if(event.key==='Enter') window._refModalLoadUrl()"
        />

        <!-- 불러오기 버튼 (URL 있으면 URL, 없으면 파일 선택) -->
        <button onclick="window._refModalLoadOrPick()" style="
          height:20px; padding: 0 10px; flex-shrink:0;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 6px;
          color: rgba(255,255,255,0.75); font-size:11px; cursor:pointer;
          display:flex; align-items:center;
          transition: background 0.15s;
        "
        onmouseover="this.style.background='rgba(255,255,255,0.18)'"
        onmouseout="this.style.background='rgba(255,255,255,0.1)'"
        title="URL 입력 후 Enter, 또는 클릭하여 파일 선택">불러오기</button>
        <input id="ref-file-input" type="file" accept="image/*" style="display:none"
          onchange="window._refModalLoadFile(event)">

        <!-- 투명도 슬라이더 -->
        <input id="ref-opacity-slider" type="range" min="30" max="100" value="${opacity}"
          title="투명도"
          style="
            width:52px; flex-shrink:0; cursor:pointer;
            -webkit-appearance:none; appearance:none;
            height:3px; border-radius:2px;
            background:#555; outline:none;
          "
          oninput="window._refModalSetOpacity(this.value)"
        />

        <!-- 닫기 -->
        <button onclick="window._refModalHide()" style="
          width:18px; height:18px; flex-shrink:0;
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.5); cursor:pointer; font-size:11px; line-height:1;
          border-radius: 50%; display:flex; align-items:center; justify-content:center;
          transition: all 0.15s;
        "
        onmouseover="this.style.background='rgba(255,80,80,0.5)';this.style.color='#fff';this.style.borderColor='transparent'"
        onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.color='rgba(255,255,255,0.5)';this.style.borderColor='rgba(255,255,255,0.12)'"
        title="닫기">✕</button>
      </div>

      <!-- 리사이즈 핸들 (우하단, 이미지 위에 고정) -->
      <div id="ref-resize-handle" style="
        position:absolute; bottom:0; right:0;
        width:20px; height:20px; cursor:se-resize; z-index:3;
        display:flex; align-items:flex-end; justify-content:flex-end;
        padding:4px;
      ">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style="pointer-events:none;">
          <path d="M1 7L7 1M4 7L7 4" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    </div>

  `;

  document.body.appendChild(modalEl);

  // 저장된 이미지 복원
  if (saved.imgSrc && saved.imgSrc !== 'about:blank' && saved.imgSrc !== window.location.href) {
    _setImage(saved.imgSrc);
  }

  // 툴바 호버 표시/숨김 (이미지 영역 기준)
  const header = document.getElementById('ref-header');
  modalEl.addEventListener('mouseenter', () => { header.style.height = '32px'; });
  modalEl.addEventListener('mouseleave', () => { header.style.height = '0'; });

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

// ── URL 있으면 URL로, 없으면 파일 선택 ────────────────────
window._refModalLoadOrPick = function() {
  const input = document.getElementById('ref-url-input');
  const url = input?.value?.trim();
  if (url) {
    window._refModalLoadUrl();
  } else {
    document.getElementById('ref-file-input')?.click();
  }
};

// ── 불투명도 ───────────────────────────────────────────────
window._refModalSetOpacity = function(val) {
  if (!modalEl) return;
  modalEl.style.opacity = val / 100;
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

// ── 드래그 (이미지 영역) ───────────────────────────────────
function _initDrag() {
  const wrap = document.getElementById('ref-image-wrap');
  if (!wrap) return;

  let startX, startY, startLeft, startTop;

  wrap.addEventListener('mousedown', e => {
    if (e.target.closest('button, input, label, #ref-resize-handle')) return;
    e.preventDefault();
    e.stopPropagation();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(modalEl.style.left) || 0;
    startTop  = parseInt(modalEl.style.top)  || 0;
    wrap.style.cursor = 'grabbing';

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      modalEl.style.left = (startLeft + dx) + 'px';
      modalEl.style.top  = (startTop  + dy) + 'px';
    }
    function onUp() {
      wrap.style.cursor = 'grab';
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

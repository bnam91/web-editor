/* ══════════════════════════════════════
   스크래치패드 — 캔버스 여백 재료 보관
   canvas-wrap 회색 여백에 이미지를 임시 배치.
   프로젝트 직렬화에 포함되지 않음 (별도 localStorage 키).
══════════════════════════════════════ */

const SCRATCH_KEY_PREFIX = 'scratch-pad';
let _currentProjectId = null;
let _scratchItems = [];   // { el, src, x, y, w }

function _getScratchKey(id) {
  return id ? `${SCRATCH_KEY_PREFIX}-${id}` : SCRATCH_KEY_PREFIX;
}

function _saveScratch() {
  const data = _scratchItems.map(({ src, x, y, w }) => ({ src, x, y, w }));
  localStorage.setItem(_getScratchKey(_currentProjectId), JSON.stringify(data));
}

function _removeItem(item) {
  item.el.remove();
  _scratchItems = _scratchItems.filter(s => s !== item);
  _saveScratch();
}

function _createItem(src, x, y, w = 220) {
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap) return null;

  const el = document.createElement('div');
  el.className = 'scratch-item';
  el.style.cssText = `left:${x}px; top:${y}px; width:${w}px;`;

  // 이미지
  const img = document.createElement('img');
  img.src = src;
  img.draggable = false;
  el.appendChild(img);

  // 닫기 버튼
  const closeBtn = document.createElement('button');
  closeBtn.className = 'scratch-close';
  closeBtn.innerHTML = '✕';
  closeBtn.title = '제거';
  closeBtn.addEventListener('click', e => {
    e.stopPropagation();
    _removeItem(item);
  });
  el.appendChild(closeBtn);

  // 리사이즈 핸들 (우하단)
  const resizeH = document.createElement('div');
  resizeH.className = 'scratch-resize';
  resizeH.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = el.offsetWidth;
    const onMove = mv => {
      const newW = Math.max(60, startW + (mv.clientX - startX));
      el.style.width = newW + 'px';
      item.w = newW;
    };
    const onUp = () => {
      _saveScratch();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  el.appendChild(resizeH);

  // 드래그 이동
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target === closeBtn || e.target === resizeH) return;
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX - el.offsetLeft;
    const sy = e.clientY - el.offsetTop;
    let _rafId = null;
    const onMove = mv => {
      const nx = mv.clientX - sx;
      const ny = mv.clientY - sy;
      if (!_rafId) _rafId = requestAnimationFrame(() => {
        el.style.left = nx + 'px';
        el.style.top  = ny + 'px';
        _rafId = null;
      });
    };
    const onUp = () => {
      if (_rafId) cancelAnimationFrame(_rafId);
      item.x = el.offsetLeft;
      item.y = el.offsetTop;
      _saveScratch();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  wrap.appendChild(el);

  const item = { el, src, x, y, w };
  _scratchItems.push(item);
  return item;
}

function _loadScratch(projectId) {
  _currentProjectId = projectId;
  _scratchItems.forEach(s => s.el.remove());
  _scratchItems = [];
  try {
    const data = JSON.parse(localStorage.getItem(_getScratchKey(projectId)) || '[]');
    data.forEach(({ src, x, y, w }) => _createItem(src, x, y, w));
  } catch {}
}

function initScratchPad(projectId) {
  _loadScratch(projectId);

  const wrap = document.getElementById('canvas-wrap');
  if (!wrap || wrap._scratchBound) return;
  wrap._scratchBound = true;

  // 드래그오버 — canvas-scaler 위면 무시 (기존 블록 드롭과 분리)
  wrap.addEventListener('dragover', e => {
    if (e.target.closest('#canvas-scaler')) return;
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    wrap.classList.add('scratch-drag-over');
  });

  wrap.addEventListener('dragleave', e => {
    if (!wrap.contains(e.relatedTarget)) wrap.classList.remove('scratch-drag-over');
  });

  wrap.addEventListener('drop', e => {
    wrap.classList.remove('scratch-drag-over');
    if (e.target.closest('#canvas-scaler')) return;
    const files = [...(e.dataTransfer.files || [])].filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault(); e.stopPropagation();

    const rect = wrap.getBoundingClientRect();
    const baseX = e.clientX - rect.left + wrap.scrollLeft;
    const baseY = e.clientY - rect.top  + wrap.scrollTop;

    files.forEach((file, i) => {
      if (file.size > 20 * 1024 * 1024) return; // 20MB 제한
      const reader = new FileReader();
      reader.onload = ev => {
        _createItem(ev.target.result, baseX + i * 24, baseY + i * 24);
        _saveScratch();
      };
      reader.readAsDataURL(file);
    });
  });
}

// 탭 전환 시 호출 — 이전 프로젝트 저장 후 새 프로젝트 로드
function switchScratch(newProjectId) {
  _saveScratch();
  _loadScratch(newProjectId);
}

window.initScratchPad  = initScratchPad;
window.switchScratch   = switchScratch;
window.clearScratchPad = () => {
  _scratchItems.forEach(s => s.el.remove());
  _scratchItems = [];
  localStorage.removeItem(_getScratchKey(_currentProjectId));
};

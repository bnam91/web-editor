/* ══════════════════════════════════════
   스크래치패드 — 캔버스 여백 재료 보관
   canvas-scaler 안에 배치 → 캔버스와 함께 스크롤/줌
   프로젝트 직렬화에 포함되지 않음 (IndexedDB 별도 저장).
══════════════════════════════════════ */

const SCRATCH_DB_NAME = 'ScratchPadDB';
const SCRATCH_STORE   = 'scratch';
let _db = null;
let _currentProjectId = null;
let _currentPageId = null;
let _scratchItems = [];   // { el, src, x, y, w }
let _selectedItems = new Set();  // 다중 선택 집합

function _openDB() {
  if (_db) return Promise.resolve(_db);
  return _tryOpenDB().catch(err => {
    console.warn('[ScratchPad] IndexedDB open failed, retrying after delete:', err);
    return new Promise((res, rej) => {
      const del = indexedDB.deleteDatabase(SCRATCH_DB_NAME);
      del.onsuccess = () => _tryOpenDB().then(res).catch(rej);
      del.onerror   = () => _tryOpenDB().then(res).catch(rej);
    });
  }).catch(err => {
    console.warn('[ScratchPad] IndexedDB unavailable, using in-memory fallback:', err);
    // 메모리 폴백: get/put/delete 메서드만 흉내냄
    const store = {};
    _db = {
      _isFallback: true,
      transaction() {
        return {
          objectStore() {
            return {
              get(k)    { const r = { result: store[k] }; setTimeout(() => r.onsuccess?.({ target: r })); return r; },
              put(v, k) { store[k] = v; const r = {}; setTimeout(() => r.onsuccess?.({ target: r })); return r; },
              delete(k) { delete store[k]; const r = {}; setTimeout(() => r.onsuccess?.({ target: r })); return r; },
              getAllKeys() { const r = { result: Object.keys(store) }; setTimeout(() => r.onsuccess?.({ target: r })); return r; },
            };
          }
        };
      }
    };
    return _db;
  });
}

function _tryOpenDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SCRATCH_DB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(SCRATCH_STORE);
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

function _getScratchKey(projectId, pageId) {
  const base = projectId ? `scratch-pad-${projectId}` : 'scratch-pad';
  return pageId ? `${base}-${pageId}` : base;
}

async function _saveScratch() {
  const db   = await _openDB();
  const data = _scratchItems.map(({ src, x, y, w }) => ({ src, x, y, w }));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCRATCH_STORE, 'readwrite');
    tx.objectStore(SCRATCH_STORE).put(data, _getScratchKey(_currentProjectId, _currentPageId));
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

function _selectItem(item, shiftKey) {
  if (shiftKey) {
    // Shift+클릭: 토글
    if (_selectedItems.has(item)) {
      _selectedItems.delete(item);
      item.el.classList.remove('scratch-selected');
    } else {
      _selectedItems.add(item);
      item.el.classList.add('scratch-selected');
    }
  } else {
    // 일반 클릭: 단독 선택
    _selectedItems.forEach(s => s.el.classList.remove('scratch-selected'));
    _selectedItems.clear();
    _selectedItems.add(item);
    item.el.classList.add('scratch-selected');
  }
}

function _clearSelection() {
  _selectedItems.forEach(s => s.el.classList.remove('scratch-selected'));
  _selectedItems.clear();
}

function _removeItem(item) {
  // 다중 선택 중이고 item이 선택에 포함된 경우 → 선택 전체 삭제
  if (_selectedItems.size > 0 && _selectedItems.has(item)) {
    const toRemove = [..._selectedItems];
    _clearSelection();
    toRemove.forEach(s => {
      s.el.remove();
      _scratchItems = _scratchItems.filter(i => i !== s);
    });
  } else {
    item.el.remove();
    _scratchItems = _scratchItems.filter(s => s !== item);
  }
  _saveScratch();
}

function _getScale() {
  const scalerEl = document.getElementById('canvas-scaler');
  if (!scalerEl) return 1;
  const m = scalerEl.style.transform?.match(/scale\(([^)]+)\)/);
  return m ? parseFloat(m[1]) : 1;
}

function _createItem(src, x, y, w = 220) {
  const scaler = document.getElementById('canvas-scaler');
  if (!scaler) return null;

  const el = document.createElement('div');
  el.className = 'scratch-item';
  el.style.cssText = `left:${x}px; top:${y}px; width:${w}px;`;

  const img = document.createElement('img');
  img.src = src;
  img.draggable = false;
  el.appendChild(img);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'scratch-close';
  closeBtn.innerHTML = '✕';
  closeBtn.title = '제거';
  closeBtn.addEventListener('click', e => {
    e.stopPropagation();
    _removeItem(item);
  });
  el.appendChild(closeBtn);

  const resizeH = document.createElement('div');
  resizeH.className = 'scratch-resize';
  resizeH.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const scale  = _getScale();
    const startX = e.clientX;
    const startW = el.offsetWidth;
    const onMove = mv => {
      const newW = Math.max(60, startW + (mv.clientX - startX) / scale);
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

  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target === closeBtn || e.target === resizeH) return;
    e.preventDefault(); e.stopPropagation();

    // 선택 처리: 자신이 선택 집합에 없으면 단독 선택 후 드래그
    if (!_selectedItems.has(item)) {
      _selectItem(item, e.shiftKey);
    } else if (e.shiftKey) {
      // Shift+클릭으로 이미 선택된 아이템 → 토글 해제 (드래그는 하지 않음)
      _selectItem(item, true);
      return;
    }

    // 드래그할 아이템 목록 (선택 집합 기준)
    const dragTargets = _selectedItems.size > 0 ? [..._selectedItems] : [item];

    let prevX = e.clientX;
    let prevY = e.clientY;
    let hasMoved = false;
    let _rafId = null;
    const onMove = mv => {
      hasMoved = true;
      const scale = _getScale();
      const dx = (mv.clientX - prevX) / scale;
      const dy = (mv.clientY - prevY) / scale;
      prevX = mv.clientX;
      prevY = mv.clientY;
      dragTargets.forEach(t => {
        t.x += dx;
        t.y += dy;
      });
      if (!_rafId) _rafId = requestAnimationFrame(() => {
        dragTargets.forEach(t => {
          t.el.style.left = t.x + 'px';
          t.el.style.top  = t.y + 'px';
        });
        _rafId = null;
      });
    };
    const onUp = () => {
      if (_rafId) cancelAnimationFrame(_rafId);
      if (hasMoved) {
        dragTargets.forEach(t => {
          t.x = parseFloat(t.el.style.left) || t.x;
          t.y = parseFloat(t.el.style.top)  || t.y;
        });
        _saveScratch();
      }
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  scaler.appendChild(el);

  const item = { el, src, x, y, w };
  _scratchItems.push(item);
  return item;
}

async function _loadScratch(projectId, pageId) {
  _currentProjectId = projectId;
  _currentPageId    = pageId || null;
  _clearSelection();
  _scratchItems.forEach(s => s.el.remove());
  _scratchItems = [];
  try {
    const db   = await _openDB();
    const data = await new Promise((resolve, reject) => {
      const tx  = db.transaction(SCRATCH_STORE, 'readonly');
      const req = tx.objectStore(SCRATCH_STORE).get(_getScratchKey(projectId, pageId));
      req.onsuccess = e => resolve(e.target.result || []);
      req.onerror   = e => reject(e.target.error);
    });
    data.forEach(({ src, x, y, w }) => _createItem(src, x, y, w));
  } catch(e) {
    console.warn('[ScratchPad] load error:', e);
  }
}

async function initScratchPad(projectId, pageId) {
  await _loadScratch(projectId, pageId);

  const wrap = document.getElementById('canvas-wrap');
  if (!wrap || wrap._scratchBound) return;
  wrap._scratchBound = true;

  // canvas-wrap 빈 영역 클릭 → 전체 선택 해제
  wrap.addEventListener('mousedown', e => {
    if (!e.target.closest('.scratch-item')) {
      _clearSelection();
    }
  });

  // Delete / Backspace 키 → 선택 아이템 일괄 삭제 (contenteditable 포커스 중 제외)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (_selectedItems.size === 0) return;
    const active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    const toRemove = [..._selectedItems];
    _clearSelection();
    toRemove.forEach(s => {
      s.el.remove();
      _scratchItems = _scratchItems.filter(i => i !== s);
    });
    _saveScratch();
  });

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

    const scalerEl = document.getElementById('canvas-scaler');
    const scale     = _getScale();
    const scalerRect = scalerEl.getBoundingClientRect();
    const baseX = (e.clientX - scalerRect.left) / scale;
    const baseY = (e.clientY - scalerRect.top)  / scale;

    files.forEach((file, i) => {
      if (file.size > 20 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = ev => {
        _createItem(ev.target.result, baseX + i * 24, baseY + i * 24);
        _saveScratch();
      };
      reader.readAsDataURL(file);
    });
  });

  document.addEventListener('paste', e => {
    const active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

    const items = [...(e.clipboardData?.items || [])].filter(it => it.type.startsWith('image/'));
    if (!items.length) return;
    e.preventDefault();

    const scalerEl  = document.getElementById('canvas-scaler');
    const scale     = _getScale();
    const scalerRect = scalerEl.getBoundingClientRect();
    const wrapRect   = wrap.getBoundingClientRect();
    const cx = (wrapRect.left + wrapRect.width  / 2 - scalerRect.left) / scale;
    const cy = (wrapRect.top  + wrapRect.height / 2 - scalerRect.top)  / scale;

    items.forEach((item, i) => {
      const file = item.getAsFile();
      if (!file || file.size > 20 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = ev => {
        _createItem(ev.target.result, cx - 110 + i * 24, cy - 60 + i * 24);
        _saveScratch();
      };
      reader.readAsDataURL(file);
    });
  });
}

async function switchScratch(newProjectId, pageId) {
  await _saveScratch();
  await _loadScratch(newProjectId, pageId);
}

async function switchScratchPage(newPageId) {
  await _saveScratch();
  await _loadScratch(_currentProjectId, newPageId);
}

window.initScratchPad    = initScratchPad;
window.switchScratch     = switchScratch;
window.switchScratchPage = switchScratchPage;
window.clearScratchPad   = async () => {
  _clearSelection();
  _scratchItems.forEach(s => s.el.remove());
  _scratchItems = [];
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCRATCH_STORE, 'readwrite');
    tx.objectStore(SCRATCH_STORE).delete(_getScratchKey(_currentProjectId, _currentPageId));
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
};

// CDP 스킬용 헬퍼 — 이미지를 추가하고 IndexedDB에 즉시 저장
window._scratchAddAndSave = (src, x, y, w) => {
  _createItem(src, x, y, w);
  return _saveScratch();
};

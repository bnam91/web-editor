/* ══════════════════════════════════════
   스크래치패드 — 캔버스 여백 재료 보관
   canvas-scaler 안에 배치 → 캔버스와 함께 스크롤/줌
   프로젝트 직렬화에 포함되지 않음 (IndexedDB 별도 저장).
══════════════════════════════════════ */

import { previewScratchDropAt, commitScratchDropAt, clearScratchDropGuides } from './canvas-scratch-drop.js';

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
        const tx = {
          oncomplete: null,
          onerror: null,
          objectStore() {
            return {
              get(k)    { const r = { result: store[k] }; setTimeout(() => { r.onsuccess?.({ target: r }); tx.oncomplete?.(); }); return r; },
              put(v, k) { store[k] = v; const r = {}; setTimeout(() => { r.onsuccess?.({ target: r }); tx.oncomplete?.(); }); return r; },
              delete(k) { delete store[k]; const r = {}; setTimeout(() => { r.onsuccess?.({ target: r }); tx.oncomplete?.(); }); return r; },
              getAllKeys() { const r = { result: Object.keys(store) }; setTimeout(() => { r.onsuccess?.({ target: r }); tx.oncomplete?.(); }); return r; },
            };
          }
        };
        return tx;
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
  if (!projectId) return null; // projectId 없으면 key 생성 불가 — 저장 스킵
  const base = `scratch-pad-${projectId}`;
  return pageId ? `${base}-${pageId}` : base;
}

async function _saveScratch() {
  const key = _getScratchKey(_currentProjectId, _currentPageId);
  if (!key) return; // projectId 없으면 저장 스킵
  const db   = await _openDB();
  // 스냅샷을 await 전에 미리 찍어서 비동기 구간 중 배열 변경 영향 차단
  const data = _scratchItems.map(({ src, x, y, w, id }) => ({ src, x, y, w, id }));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCRATCH_STORE, 'readwrite');
    tx.objectStore(SCRATCH_STORE).put(data, key);
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

function _setIdChipVisible(item, vis) {
  const chip = item?.el?.querySelector('.scratch-id-chip');
  if (chip) chip.style.display = vis ? 'block' : 'none';
}

function _selectItem(item, shiftKey) {
  if (shiftKey) {
    // Shift+클릭: 토글
    if (_selectedItems.has(item)) {
      _selectedItems.delete(item);
      item.el.classList.remove('scratch-selected');
      _setIdChipVisible(item, false);
    } else {
      _selectedItems.add(item);
      item.el.classList.add('scratch-selected');
      _setIdChipVisible(item, true);
    }
  } else {
    // 일반 클릭: 단독 선택
    _selectedItems.forEach(s => { s.el.classList.remove('scratch-selected'); _setIdChipVisible(s, false); });
    _selectedItems.clear();
    _selectedItems.add(item);
    item.el.classList.add('scratch-selected');
    _setIdChipVisible(item, true);
  }
}

function _clearSelection() {
  _selectedItems.forEach(s => { s.el.classList.remove('scratch-selected'); _setIdChipVisible(s, false); });
  _selectedItems.clear();
}

function _genScratchId() {
  return 'sp_' + Math.random().toString(36).slice(2, 8);
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

// dataURL → PNG Blob (Chromium 클립보드는 image/png만 허용하므로 canvas 거쳐 변환)
function _dataUrlToPngBlob(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width  = img.naturalWidth  || img.width;
      cv.height = img.naturalHeight || img.height;
      cv.getContext('2d').drawImage(img, 0, 0);
      cv.toBlob(b => b ? resolve(b) : reject(new Error('toBlob 실패')), 'image/png');
    };
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = dataUrl;
  });
}

function _createItem(src, x, y, w = 220, idArg) {
  const scaler = document.getElementById('canvas-scaler');
  if (!scaler) return null;

  const id = idArg || _genScratchId();
  const el = document.createElement('div');
  el.className = 'scratch-item';
  el.dataset.scratchId = id;
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

  // ID 칩 — 선택됐을 때만 보임. 클릭하면 #sp_xxx 클립보드 복사
  const idChip = document.createElement('button');
  idChip.type = 'button';
  idChip.className = 'scratch-id-chip';
  idChip.textContent = '#' + id;
  idChip.title = '클릭하면 ID 복사 (AI 모달 프롬프트에 #sp_xxx로 참조)';
  idChip.style.cssText = 'position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.72);color:#fff;border:none;border-radius:3px;padding:2px 6px;font-size:11px;font-family:ui-monospace,Menlo,monospace;cursor:pointer;display:none;z-index:10;line-height:1.2;';
  idChip.addEventListener('mousedown', e => { e.stopPropagation(); });
  idChip.addEventListener('click', async e => {
    e.stopPropagation();
    const text = '#' + id;
    try {
      if (window.electronAPI?.clipboardWriteText) {
        const r = await window.electronAPI.clipboardWriteText(text);
        if (!r?.ok) throw new Error(r?.error || 'IPC 실패');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('클립보드 API 없음');
      }
      window.showToast?.('📋 ID 복사: ' + text);
    } catch (err) {
      window.showToast?.('❌ ID 복사 실패: ' + err.message);
    }
  });
  el.appendChild(idChip);

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
    if (e.target === closeBtn || e.target === resizeH || e.target === idChip) return;

    e.preventDefault(); e.stopPropagation();

    // 선택 처리
    if (!_selectedItems.has(item)) {
      _selectItem(item, e.shiftKey);
    } else if (e.shiftKey) {
      _selectItem(item, true);
      return;
    }

    // 드래그할 아이템 목록
    const dragTargets = _selectedItems.size > 0 ? [..._selectedItems] : [item];
    // 단일 드래그인 경우만 캔버스 변환 모드 활성 (다중은 위치 이동만)
    const isSingleDrag = dragTargets.length === 1;

    // 드래그 중에는 scratch-item이 마우스 아래를 가리지 않도록 pointer-events 차단
    if (isSingleDrag) dragTargets.forEach(t => { t.el.style.pointerEvents = 'none'; });

    let prevX = e.clientX;
    let prevY = e.clientY;
    let lastClientX = e.clientX;
    let lastClientY = e.clientY;
    let hasMoved = false;
    let dropKind = 'none';  // 마지막 mousemove의 분류 결과 — mouseup 직전 갱신용
    let _rafId = null;

    const onMove = mv => {
      hasMoved = true;
      lastClientX = mv.clientX;
      lastClientY = mv.clientY;
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
        // 단일 드래그면 캔버스 변환 가이드 미리보기
        if (isSingleDrag) {
          try { dropKind = previewScratchDropAt(lastClientX, lastClientY); }
          catch (err) { dropKind = 'none'; }
        }
        _rafId = null;
      });
    };

    const onUp = async () => {
      if (_rafId) cancelAnimationFrame(_rafId);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      // 단일 드래그 + 움직임 있었으면 마지막 좌표에서 변환 시도
      // (pointer-events:none을 commit 전까지 유지해야 elementFromPoint가 underneath 캔버스를 잡음)
      let committed = false;
      // Undo 복원용 — 변환 전에 캡쳐
      const restoreInfo = { src: item.src, x: item.x, y: item.y, w: item.w };
      // 이미지 자연 비율 (insert/append 케이스용)
      const imgEl = item.el.querySelector('img');
      const natW = imgEl?.naturalWidth || 0;
      const natH = imgEl?.naturalHeight || 0;

      if (isSingleDrag && hasMoved) {
        try {
          committed = commitScratchDropAt(lastClientX, lastClientY, item.src, {
            naturalWidth: natW,
            naturalHeight: natH,
          });
        } catch (err) {
          console.warn('[ScratchPad] commit 실패:', err);
          committed = false;
        }
      }

      // pointer-events 복원 (commit 후)
      if (isSingleDrag) dragTargets.forEach(t => { t.el.style.pointerEvents = ''; });

      if (committed) {
        try { await window._scratchRemoveById?.(item.id); } catch (_) {}
        // 변환 후 상태 push + Undo/Redo 시 스크래치 복원/재제거 hook
        // restoredId: onUndo가 새로 추가한 item의 id (브라우저가 새 id 부여) — onRedo에서 제거 대상
        let restoredId = null;
        try {
          window.pushHistory?.('스크래치→섹션 변환', {
            onUndo: async () => {
              try { await window._scratchAddAndSave?.(restoreInfo.src, restoreInfo.x, restoreInfo.y, restoreInfo.w); } catch (_) {}
              // 방금 추가된 item id 추출 — 마지막 .scratch-item의 chip 텍스트 '#sp_xxx' → 'sp_xxx'
              const last = document.querySelectorAll('.scratch-item');
              const chip = last[last.length - 1]?.querySelector('.scratch-id-chip')?.textContent?.trim();
              if (chip) restoredId = chip.replace(/^#/, '');
            },
            onRedo: async () => {
              if (restoredId) {
                try { await window._scratchRemoveById?.(restoredId); } catch (_) {}
                restoredId = null;
              }
            },
          });
        } catch (_) {}
        return;
      }

      // 가이드 정리 (안전망)
      try { clearScratchDropGuides(); } catch (_) {}

      // 변환 안 됐으면 평소대로 위치 저장
      if (hasMoved) {
        dragTargets.forEach(t => {
          t.x = parseFloat(t.el.style.left) || t.x;
          t.y = parseFloat(t.el.style.top)  || t.y;
        });
        _saveScratch();
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  scaler.appendChild(el);

  const item = { el, src, x, y, w, id };
  _scratchItems.push(item);

  // native HTML5 DnD 사용 안 함 — mousedown/move/up 흐름 안에서 모두 처리 (canvas-scratch-drop.js의 export API 호출)
  el.draggable = false;

  return item;
}

async function _loadScratch(projectId, pageId) {
  _currentProjectId = projectId;
  _currentPageId    = pageId || null;
  _clearSelection();
  _scratchItems.forEach(s => s.el.remove());
  _scratchItems = [];
  const key = _getScratchKey(projectId, pageId);
  if (!key) return; // projectId 없으면 로드 스킵
  try {
    const db   = await _openDB();
    const data = await new Promise((resolve, reject) => {
      const tx  = db.transaction(SCRATCH_STORE, 'readonly');
      const req = tx.objectStore(SCRATCH_STORE).get(key);
      req.onsuccess = e => resolve(e.target.result || []);
      req.onerror   = e => reject(e.target.error);
    });
    let migrated = false;
    data.forEach(({ src, x, y, w, id }) => {
      if (!id) migrated = true; // 구 데이터엔 id 없음 — 자동 생성 후 재저장 트리거
      _createItem(src, x, y, w, id);
    });
    if (migrated) _saveScratch();
  } catch(e) {
    console.warn('[ScratchPad] load error:', e);
    window.showToast?.('⚠️ 스크래치패드 복원 실패 (세션 중에는 정상 동작)');
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

  // Cmd/Ctrl+C → 선택된 스크래치 이미지 (첫 장)를 OS 클립보드에 복사
  // 사용 흐름: 스크래치 선택 → Cmd+C → AI 모달 프롬프트에서 Cmd+V로 첨부
  // OS 클립보드는 한 번에 이미지 1장만 받으므로 N장 선택해도 첫 장만 복사된다.
  document.addEventListener('keydown', async e => {
    if ((e.key !== 'c' && e.key !== 'C') || !(e.metaKey || e.ctrlKey)) return;
    if (_selectedItems.size === 0) return;
    const active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    const items = [..._selectedItems];
    try {
      const blob = await _dataUrlToPngBlob(items[0].src);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      if (items.length === 1) {
        window.showToast?.('📋 이미지 복사됨 — 모달 프롬프트에 Cmd+V');
      } else {
        window.showToast?.(`📋 첫 장 복사됨 (선택 ${items.length}장 / OS 한계로 1장씩만)`);
      }
    } catch (err) {
      console.error('[ScratchPad] copy failed:', err);
      window.showToast?.('❌ 이미지 복사 실패: ' + err.message);
    }
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
      if (file.size > 20 * 1024 * 1024) { window.showToast?.('⚠️ 스크래치패드: 20MB 이하 이미지만 지원합니다.'); return; }
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
      if (!file || file.size > 20 * 1024 * 1024) { if (file) window.showToast?.('⚠️ 스크래치패드: 20MB 이하 이미지만 지원합니다.'); return; }
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
// ⚠️ Promise를 반환함 — 호출 시 반드시 await 사용: await window._scratchAddAndSave(...)
window._scratchAddAndSave = async (src, x, y, w) => {
  _createItem(src, x, y, w);
  await _saveScratch();
};

// AI fill 모달 등 외부에서 #sp_xxx ID로 src 조회용
window._scratchGetItemById = id => {
  const it = _scratchItems.find(s => s.id === id);
  return it ? { id: it.id, src: it.src } : null;
};

// canvas-scratch-drop.js → 드롭 성공 후 스크래치 DOM·IndexedDB 정리
window._scratchRemoveById = async (id) => {
  const it = _scratchItems.find(s => s.id === id);
  if (!it) return false;
  _selectedItems.delete(it);
  it.el.remove();
  _scratchItems = _scratchItems.filter(s => s !== it);
  await _saveScratch();
  return true;
};

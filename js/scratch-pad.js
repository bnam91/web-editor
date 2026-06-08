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
let _sliceMode = null;    // 슬라이스 모드 활성 item (또는 null)

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
  if (_sliceMode) _exitSliceMode();
  // 다중 선택 중이고 item이 선택에 포함된 경우 → 선택 전체 삭제
  let removedItems;
  if (_selectedItems.size > 0 && _selectedItems.has(item)) {
    removedItems = [..._selectedItems];
    _clearSelection();
  } else {
    removedItems = [item];
  }
  _deleteScratchItemsWithHistory(removedItems);
}

// 스크래치 아이템 일괄 삭제 + 글로벌 history 스택에 sideEffects로 push
// Cmd+Z 시 캔버스 작업이 아닌 스크래치 삭제가 먼저 되돌려지도록 별도 entry로 등록
function _deleteScratchItemsWithHistory(items) {
  if (!items || items.length === 0) return;
  // 삭제 전 정보 캡쳐 (복원용) — src/x/y/w/id 보존
  const snapshots = items.map(s => ({ src: s.src, x: s.x, y: s.y, w: s.w, id: s.id }));

  // 실제 삭제
  items.forEach(s => {
    s.el.remove();
    _scratchItems = _scratchItems.filter(i => i !== s);
    _selectedItems.delete(s);
  });
  _saveScratch();

  // 글로벌 history에 sideEffects entry 추가 — 캔버스 스냅샷은 동일 상태로 push되어
  // restoreSnapshot은 캔버스에 영향을 주지 않고 onUndo가 스크래치만 복원
  // onUndo가 새로 추가한 item들의 id를 기억해야 redo가 그것들을 다시 지울 수 있음
  const undoNewIds = new Array(snapshots.length).fill(null);
  try {
    window.pushHistory?.('스크래치 삭제', {
      onUndo: async () => {
        for (let i = 0; i < snapshots.length; i++) {
          const s = snapshots[i];
          try { await window._scratchAddAndSave?.(s.src, s.x, s.y, s.w); } catch (_) {}
          // 방금 추가된 item의 새 id 추출 (브라우저가 새 id 부여)
          const all = document.querySelectorAll('.scratch-item');
          const chip = all[all.length - 1]?.querySelector('.scratch-id-chip')?.textContent?.trim();
          undoNewIds[i] = chip ? chip.replace(/^#/, '') : null;
        }
      },
      onRedo: async () => {
        // 복원했던 item들을 다시 제거
        for (let i = 0; i < undoNewIds.length; i++) {
          const id = undoNewIds[i];
          if (id) { try { await window._scratchRemoveById?.(id); } catch (_) {} }
          undoNewIds[i] = null;
        }
      },
    });
  } catch (_) {}
}

function _getScale() {
  const scalerEl = document.getElementById('canvas-scaler');
  if (!scalerEl) return 1;
  const m = scalerEl.style.transform?.match(/scale\(([^)]+)\)/);
  return m ? parseFloat(m[1]) : 1;
}

// dataURL → 이미지 자연 크기
function _loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = src;
  });
}

// 단일 컷 슬라이스: ratio(0~1) 위치에서 가로로 잘라 위/아래 dataURL 두 개 반환
async function _sliceImageHorizontal(src, ratio) {
  const img = await _loadImg(src);
  const W = img.naturalWidth, H = img.naturalHeight;
  const cutY = Math.max(1, Math.min(H - 1, Math.round(H * ratio)));
  const mk = (sy, sh) => {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = sh;
    cv.getContext('2d').drawImage(img, 0, sy, W, sh, 0, 0, W, sh);
    return cv.toDataURL('image/png');
  };
  return {
    top:    mk(0, cutY),
    bottom: mk(cutY, H - cutY),
    cutY,
    naturalH: H,
  };
}

// 슬라이스 실행 — item을 두 조각으로 대체. history push 포함.
async function _sliceItem(item, ratio) {
  if (!item || ratio <= 0 || ratio >= 1) return;
  if (_sliceMode === item) _exitSliceMode();
  let result;
  try { result = await _sliceImageHorizontal(item.src, ratio); }
  catch (err) { window.showToast?.('❌ 슬라이스 실패: ' + err.message); return; }

  // 원본 표시 크기 계산 — display height = w * (natH / natW)
  const imgEl = item.el.querySelector('img');
  const natW  = imgEl?.naturalWidth || 1;
  const natH  = imgEl?.naturalHeight || 1;
  const dispH = item.w * (natH / natW);
  const topDispH = dispH * (result.cutY / result.naturalH);
  const GAP = 6; // 분리 간격 (px, 캔버스 좌표계)

  const restoreInfo = { src: item.src, x: item.x, y: item.y, w: item.w, id: item.id };

  // 원본 제거
  item.el.remove();
  _scratchItems = _scratchItems.filter(s => s !== item);
  _selectedItems.delete(item);

  // 두 조각 생성 (같은 위치 + GAP만큼 떨어뜨려)
  const topItem    = _createItem(result.top,    item.x, item.y, item.w);
  const bottomItem = _createItem(result.bottom, item.x, item.y + topDispH + GAP, item.w);
  await _saveScratch();

  // history push
  try {
    let newTopId = topItem?.id || null;
    let newBotId = bottomItem?.id || null;
    let restoredId = null;
    window.pushHistory?.('스크래치 슬라이스', {
      onUndo: async () => {
        // 두 조각 제거 + 원본 복원
        if (newTopId) { try { await window._scratchRemoveById?.(newTopId); } catch (_) {} }
        if (newBotId) { try { await window._scratchRemoveById?.(newBotId); } catch (_) {} }
        try { await window._scratchAddAndSave?.(restoreInfo.src, restoreInfo.x, restoreInfo.y, restoreInfo.w); } catch (_) {}
        const last = document.querySelectorAll('.scratch-item');
        const chip = last[last.length - 1]?.querySelector('.scratch-id-chip')?.textContent?.trim();
        if (chip) restoredId = chip.replace(/^#/, '');
      },
      onRedo: async () => {
        // 복원된 원본 제거 + 두 조각 재생성
        if (restoredId) { try { await window._scratchRemoveById?.(restoredId); } catch (_) {} restoredId = null; }
        try { await window._scratchAddAndSave?.(result.top,    item.x, item.y, item.w); } catch (_) {}
        try { await window._scratchAddAndSave?.(result.bottom, item.x, item.y + topDispH + GAP, item.w); } catch (_) {}
        const all = document.querySelectorAll('.scratch-item');
        newBotId = all[all.length - 1]?.querySelector('.scratch-id-chip')?.textContent?.trim()?.replace(/^#/, '') || null;
        newTopId = all[all.length - 2]?.querySelector('.scratch-id-chip')?.textContent?.trim()?.replace(/^#/, '') || null;
      },
    });
  } catch (_) {}

  window.showToast?.('✂️ 슬라이스 완료');
}

// 슬라이스 모드 진입 — 마우스로 가로 절단선 위치 미리보기 + 클릭 시 확정
function _enterSliceMode(item) {
  if (_sliceMode) _exitSliceMode();

  // 단독 선택 강제
  _clearSelection();
  _selectItem(item, false);

  _sliceMode = item;
  item.el.classList.add('scratch-slice-mode');

  // 절단선 DOM 생성
  const line = document.createElement('div');
  line.className = 'scratch-slice-line';
  item.el.appendChild(line);
  item._sliceLineEl = line;
  item._sliceRatio = 0.5; // 기본값

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const onMove = mv => {
    const rect = item.el.getBoundingClientRect();
    const y = mv.clientY - rect.top;
    const ratio = clamp(y / rect.height, 0.02, 0.98);
    line.style.top = (ratio * 100) + '%';
    item._sliceRatio = ratio;
  };

  const onClickConfirm = e => {
    e.stopPropagation();
    const r = item._sliceRatio || 0.5;
    _exitSliceMode();
    _sliceItem(item, r);
  };

  const onKeyEsc = e => {
    if (e.key === 'Escape') _exitSliceMode();
  };

  const onOutsideMousedown = e => {
    const target = e.target.closest('.scratch-item');
    if (!target || target !== item.el) _exitSliceMode();
  };

  item._sliceHandlers = { onMove, onClickConfirm, onKeyEsc, onOutsideMousedown };

  item.el.addEventListener('mousemove', onMove);
  item.el.addEventListener('click', onClickConfirm, true);
  document.addEventListener('keydown', onKeyEsc);
  // outside mousedown — 다음 tick 등록 (현재 진행 중인 click 이벤트와 충돌 방지)
  setTimeout(() => document.addEventListener('mousedown', onOutsideMousedown, true), 0);
}

function _exitSliceMode() {
  if (!_sliceMode) return;
  const item = _sliceMode;
  item.el.classList.remove('scratch-slice-mode');
  item._sliceLineEl?.remove();
  item._sliceLineEl = null;

  const h = item._sliceHandlers;
  if (h) {
    item.el.removeEventListener('mousemove', h.onMove);
    item.el.removeEventListener('click', h.onClickConfirm, true);
    document.removeEventListener('keydown', h.onKeyEsc);
    document.removeEventListener('mousedown', h.onOutsideMousedown, true);
  }
  item._sliceHandlers = null;
  _sliceMode = null;
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

  // ✨ AI 버튼 — 이 이미지를 베이스로 AI 모달 오픈
  const aiBtn = document.createElement('button');
  aiBtn.className = 'scratch-ai-btn';
  aiBtn.type = 'button';
  aiBtn.innerHTML = '✨';
  aiBtn.title = 'AI 이미지 생성 (이 이미지 기반)';
  aiBtn.addEventListener('mousedown', e => e.stopPropagation());
  aiBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (window.openImageGenModal) {
      window.openImageGenModal({ mode: 'image' });
      window._aigPrePickScratch?.(id, item.src);
    }
  });
  el.appendChild(aiBtn);

  // ✂ 슬라이스 버튼 — 클릭하면 슬라이스 모드 진입
  const sliceBtn = document.createElement('button');
  sliceBtn.className = 'scratch-slice-btn';
  sliceBtn.type = 'button';
  sliceBtn.innerHTML = '✂';
  sliceBtn.title = '슬라이스 (가로 1컷)';
  sliceBtn.addEventListener('mousedown', e => e.stopPropagation());
  sliceBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (_selectedItems.size > 1) {
      _clearSelection();
      _selectItem(item, false);
    }
    _enterSliceMode(item);
  });
  el.appendChild(sliceBtn);

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
    if (_sliceMode) { e.stopPropagation(); return; }
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

  // 우클릭 → 자산 폴더로 보내기 메뉴
  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    _scratchShowSendMenu(item, e.clientX, e.clientY);
  });

  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target === closeBtn || e.target === resizeH || e.target === idChip || e.target === sliceBtn) return;
    if (_sliceMode === item) { e.preventDefault(); e.stopPropagation(); return; }

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

    // 시작 시점의 커서 좌표 + 각 타겟의 원점 좌표 기록
    // → Shift 축 고정(Figma/Sketch 표준): 시작점 기준 X/Y 누적 변위가 큰 축으로만 이동
    //   드래그 도중 Shift on/off 시 실시간 반응을 위해 항상 (시작점 → 현재 커서) 델타에서 다시 계산
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    dragTargets.forEach(t => { t._dragOrigX = t.x; t._dragOrigY = t.y; });
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
      // 시작점 기준 총 변위 (free)
      const totalDx = (mv.clientX - startClientX) / scale;
      const totalDy = (mv.clientY - startClientY) / scale;
      // Shift 누른 채면 절댓값 큰 축만 살리고 반대 축 0으로 클램프
      let applyDx = totalDx;
      let applyDy = totalDy;
      if (mv.shiftKey) {
        if (Math.abs(totalDx) >= Math.abs(totalDy)) applyDy = 0;
        else applyDx = 0;
      }
      dragTargets.forEach(t => {
        t.x = t._dragOrigX + applyDx;
        t.y = t._dragOrigY + applyDy;
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
      // 드래그 원점 임시 프로퍼티 정리 (저장 직렬화에는 무영향 — 정리만)
      dragTargets.forEach(t => { delete t._dragOrigX; delete t._dragOrigY; });

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
    if (_sliceMode) { _exitSliceMode(); return; }
    if (_selectedItems.size === 0) return;
    const active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    const toRemove = [..._selectedItems];
    _clearSelection();
    _deleteScratchItemsWithHistory(toRemove);
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
      // Electron 환경: 메인 프로세스 nativeImage 경유 (navigator.clipboard 권한 우회)
      if (window.electronAPI?.clipboardWriteImage) {
        const res = await window.electronAPI.clipboardWriteImage(items[0].src);
        if (!res?.ok) throw new Error(res?.error || 'clipboard write failed');
      } else {
        const blob = await _dataUrlToPngBlob(items[0].src);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      }
      // 외부 클립보드(이미지) 복사 timestamp — Cmd+V 시 내부 클립보드와 우선순위 비교용
      window._scratchClipboardTime = Date.now();
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

    // 내부 클립보드(섹션)가 더 최근에 복사됐다면 paste 양보 — editor가 섹션 paste 처리
    const internalT = window._internalClipboardTime || 0;
    const scratchT  = window._scratchClipboardTime  || 0;
    if (internalT > scratchT) return;

    e.preventDefault();
    // editor.js의 Cmd+V 섹션 paste 핸들러 중복 차단 플래그
    window._scratchJustHandledPaste = true;
    setTimeout(() => { window._scratchJustHandledPaste = false; }, 100);

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

// Port 드롭다운 → 폴더 일괄 불러오기 (goditor-images_to_scratchpad 스킬 UI판)
// 좌표 정책: 첫 batch는 x=960부터 세로 컬럼. 이후 batch는 기존 max X 옆 컬럼(+GAP_X)에 새 세로 컬럼으로 추가
async function loadScratchpadFolder(event) {
  const files = [...(event.target.files || [])];
  event.target.value = ''; // 같은 폴더 재선택 가능하도록 즉시 리셋
  if (!files.length) return;

  const images = files
    .filter(f => /^image\//.test(f.type) || /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!images.length) { window.showToast?.('⚠️ 이미지 파일을 찾지 못했습니다'); return; }

  const START_X = 960, WIDTH = 860, GAP_X = 100, GAP_Y = 100;
  let startX = START_X, startY = 0;
  if (_scratchItems.length > 0) {
    // 기존 items 중 가장 오른쪽 끝 → 그 옆 새 컬럼으로
    let maxRight = 0;
    for (const s of _scratchItems) {
      const w = s.el?.offsetWidth || s.w;
      const right = (s.x || 0) + w;
      if (right > maxRight) maxRight = right;
    }
    startX = maxRight + GAP_X;
  }

  let curY = startY, added = 0;
  window.showToast?.(`📥 ${images.length}개 불러오는 중...`);

  for (const file of images) {
    const dataUrl = await new Promise(res => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = () => res(null);
      r.readAsDataURL(file);
    });
    if (!dataUrl) continue;
    const nat = await new Promise(res => {
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => res({ w: WIDTH, h: WIDTH });
      img.src = dataUrl;
    });
    const displayH = nat.w > 0 ? Math.round((nat.h / nat.w) * WIDTH) : WIDTH;
    await window._scratchAddAndSave(dataUrl, startX, curY, WIDTH);
    curY += displayH + GAP_Y;
    added++;
  }

  window.showToast?.(`✅ 스크래치 ${added}개 추가 완료`);
}

window.loadScratchpadFolder = loadScratchpadFolder;
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

// ── Claude PM MCP 노출: 스크래치 아이템 메타데이터 조회 ──
// list: src 제외(토큰 폭발 방지) — id/position/srcType/srcSize만
// read: 단일 아이템 전체 (main 측에서 truncate 처리)
window._getScratchItemsForMCP = function() {
  return _scratchItems.map(({ src, x, y, w, id }) => {
    let srcType = 'other';
    if (typeof src === 'string') {
      if (src.startsWith('data:image/svg')) srcType = 'svg';
      else if (src.startsWith('data:image/')) srcType = 'image';
      else if (/^https?:/.test(src)) srcType = 'url';
      else if (src.startsWith('data:')) srcType = 'dataurl';
    }
    return {
      id,
      x: Math.round(x), y: Math.round(y), w: Math.round(w),
      srcType,
      srcSize: typeof src === 'string' ? src.length : 0,
    };
  });
};

// Codex #1 fix: truncate를 renderer 측에서 처리 — IPC/main 메모리 폭발 방지.
// opts: { includeSrc?: boolean, truncateSrcTo?: number }
window._getScratchItemByIdForMCP = function(id, opts) {
  const it = _scratchItems.find(s => s.id === id);
  if (!it) return null;
  const includeSrc  = !!(opts && opts.includeSrc);
  const truncateTo  = (opts && Number.isFinite(opts.truncateSrcTo)) ? opts.truncateSrcTo : 200;
  const out = {
    id: it.id,
    x: Math.round(it.x), y: Math.round(it.y), w: Math.round(it.w),
    srcSize: typeof it.src === 'string' ? it.src.length : 0,
  };
  if (typeof it.src === 'string') {
    if (includeSrc) {
      out.src = it.src;
    } else if (it.src.length > truncateTo) {
      out.srcPreview = it.src.slice(0, truncateTo) + '...';
    } else {
      out.src = it.src;
    }
  }
  return out;
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

// ════════════════════════════════════════════════════════════════════════
// dataURL → Blob 직접 파싱 (Codex #7 — fetch round-trip 회피)
// ════════════════════════════════════════════════════════════════════════
function _dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const head = dataUrl.indexOf(',');
  if (head < 0) return null;
  const meta = dataUrl.slice(5, head); // 'image/png;base64' or 'image/svg+xml;utf8'
  const data = dataUrl.slice(head + 1);
  const parts = meta.split(';');
  const mime = parts[0] || 'application/octet-stream';
  const isBase64 = parts.slice(1).some(p => p.trim().toLowerCase() === 'base64');
  let bytes;
  try {
    if (isBase64) {
      const bin = atob(data);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(data));
    }
  } catch (_) { return null; }
  return new Blob([bytes], { type: mime });
}

// ════════════════════════════════════════════════════════════════════════
// Scratch → Assets — scratch 카드 우클릭 → 폴더 선택 메뉴
// ════════════════════════════════════════════════════════════════════════
function _scratchShowSendMenu(item, x, y) {
  document.querySelectorAll('.scratch-send-menu').forEach(m => m.remove());
  const folders = (typeof window.assetsGetAllFolders === 'function')
    ? window.assetsGetAllFolders()
    : [];
  const menu = document.createElement('div');
  menu.className = 'scratch-send-menu';
  menu.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:99999; min-width:180px; max-height:320px; overflow:auto; background:#1a1a1a; border:1px solid #333; border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,0.5); padding:4px 0; font-size:12px; color:#e0e0e0;`;
  const header = document.createElement('div');
  header.textContent = '자산 폴더로 보내기';
  header.style.cssText = 'padding:6px 10px; color:#888; font-size:10px; border-bottom:1px solid #333; margin-bottom:4px;';
  menu.appendChild(header);
  if (folders.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = '폴더 없음 — 에셋 탭에서 폴더 생성';
    empty.style.cssText = 'padding:8px 10px; color:#888;';
    menu.appendChild(empty);
  } else {
    folders.forEach(f => {
      const btn = document.createElement('div');
      btn.style.cssText = `padding:6px 10px; padding-left:${10 + f.depth * 12}px; cursor:pointer;`;
      btn.innerHTML = `<span style="opacity:0.6;">📁</span> ${f.name || '(이름 없음)'}`;
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(45,111,232,0.18)');
      btn.addEventListener('mouseleave', () => btn.style.background = '');
      btn.addEventListener('click', async () => {
        menu.remove();
        try {
          // dataURL 직접 파싱 — fetch round-trip 회피 (Codex #7)
          const blob = _dataUrlToBlob(item.src) || await (await fetch(item.src)).blob();
          const mime = blob.type || 'image/png';
          const ext = mime.includes('svg') ? 'svg' : (mime.includes('png') ? 'png' : (mime.includes('jpeg') ? 'jpg' : 'img'));
          const name = 'scratch_' + (item.id || Date.now()) + '.' + ext;
          const file = new File([blob], name, { type: mime });
          await window.assetsAddImageFiles?.([file], f.id);
        } catch (err) {
          console.warn('[scratch → assets] 실패:', err);
        }
      });
      menu.appendChild(btn);
    });
  }
  document.body.appendChild(menu);
  // 화면 경계 보정
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 8) + 'px';
  if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 8) + 'px';
  // 바깥 클릭 시 닫기
  setTimeout(() => {
    const close = e => {
      if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', close, true); }
    };
    document.addEventListener('mousedown', close, true);
  }, 0);
}

// ════════════════════════════════════════════════════════════════════════
// Assets → Scratch — 자산 패널에서 끌어 온 이미지를 스크래치 카드로 추가
//   캔버스 어디든 (scaler 안 섹션, scaler 밖 wrap 회색 영역 모두) 받음
// ════════════════════════════════════════════════════════════════════════
function _bindAssetToScratchDrop() {
  const _hasAssetMIME = dt => dt && Array.from(dt.types || []).includes('application/x-goditor-asset');
  const _dragover = e => {
    if (!_hasAssetMIME(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const _drop = async e => {
    if (!_hasAssetMIME(e.dataTransfer)) return;
    e.preventDefault();
    e.stopImmediatePropagation(); // Codex #6 — 같은 target 다른 listener 차단
    let payload;
    try { payload = JSON.parse(e.dataTransfer.getData('application/x-goditor-asset') || '{}'); } catch (_) { payload = null; }
    if (!payload?.assetId) return;
    const dataUrl = await window.assetsGetDataUrl?.(payload.assetId);
    if (!dataUrl) return;
    const scaler = document.getElementById('canvas-scaler');
    if (!scaler) return;
    const rect = scaler.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) - 110); // width 220 가운데 정렬
    const y = Math.round((e.clientY - rect.top) - 60);
    await window._scratchAddAndSave?.(dataUrl, x, y, 220);
  };

  // scaler (캔버스 내부 — 섹션·블록 영역) + wrap (scaler 외 회색 배경) 둘 다 등록
  for (const id of ['canvas-scaler', 'canvas-wrap']) {
    const el = document.getElementById(id);
    if (!el || el.dataset.assetDropBound === '1') continue;
    el.dataset.assetDropBound = '1';
    el.addEventListener('dragover', _dragover, true);
    el.addEventListener('drop', _drop, true);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _bindAssetToScratchDrop);
} else {
  _bindAssetToScratchDrop();
}

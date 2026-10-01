/* ══════════════════════════════════════
   스크래치패드 — 캔버스 여백 재료 보관
   canvas-scaler 안에 배치 → 캔버스와 함께 스크롤/줌
   프로젝트 직렬화에 포함되지 않음 (IndexedDB 별도 저장).
══════════════════════════════════════ */

import { previewScratchDropAt, commitScratchDropAt, clearScratchDropGuides } from './canvas-scratch-drop.js';
import { parseGoyaAssetUrl, makeElectronAssetReader } from './io/goya-asset-inline.js';

const SCRATCH_DB_NAME = 'ScratchPadDB';
const SCRATCH_STORE   = 'scratch';
/* ★스크래치 항목이 «저장·옮겨 다니는» 칸 — 이 목록 «하나»에서 파생시킨다(2026-10-01 C1).
 *   무엇이 문제였나: 같은 칸 목록이 «일곱 자리»(저장·전환·매니페스트 쓰기·읽기·불러오기·가져오기·삭제 복원)에
 *   손으로 따로 적혀 있었다. 칸 하나(효과 fx)를 더하려면 일곱 곳을 다 고쳐야 했고, 하나라도 빠지면
 *   «그 길로만» 효과가 조용히 사라진다(명부가 둘이면 한쪽이 조용히 늙는다 — 경고 주석으로는 못 막는다).
 *   ⇒ 칸을 늘릴 땐 여기만 고친다. 일부러 «빼는» 자리는 _pickScratch 의 omit 으로 «그 자리에서» 까닭과 함께 적는다.
 *   fx = 에셋에서 빼 온 이미지 효과(image-handling.js captureAssetFx). 없으면 undefined. */
const SCRATCH_ITEM_KEYS = ['src', 'x', 'y', 'w', 'id', 'g', 'linkDy', 'fx'];
function _pickScratch(o, omit = []) {
  const out = {};
  for (const k of SCRATCH_ITEM_KEYS) if (!omit.includes(k)) out[k] = o ? o[k] : undefined;
  return out;
}
let _db = null;
let _currentProjectId = null;
let _currentPageId = null;
let _scratchItems = [];   // { el, src, x, y, w, id, g? } — g = 그룹 id (선택 그룹화)
let _selectedItems = new Set();  // 다중 선택 집합
let _sliceMode = null;    // 슬라이스 모드 활성 item (또는 null)
// ★탭 고속 전환(A→B→C) race 가드 (Codex 리뷰) —
// _scratchLoadGen: 로드 세대 토큰. flush/새 로드가 bump → 늦게 도착한 IndexedDB read가
//                  새 컨텍스트에 이전 프로젝트 아이템을 섞거나 엉뚱한 키에 저장하는 것 차단.
// _scratchLoaded:  현재 컨텍스트의 로드 완료 여부. 미완료 상태에서 _saveScratch/flush가
//                  빈 _scratchItems를 그 키에 덮어써 데이터를 지우는 것 차단.
let _scratchLoadGen = 0;
let _scratchLoaded = true;

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
  if (!_scratchLoaded) return; // ★로드 미완료 컨텍스트 — 빈/불완전 배열로 기존 데이터 덮어쓰기 방지
  const key = _getScratchKey(_currentProjectId, _currentPageId);
  if (!key) return; // projectId 없으면 저장 스킵
  const db   = await _openDB();
  // 스냅샷을 await 전에 미리 찍어서 비동기 구간 중 배열 변경 영향 차단
  const data = _scratchItems.map(s => _pickScratch(s));
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCRATCH_STORE, 'readwrite');
    tx.objectStore(SCRATCH_STORE).put(data, key);
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

// #16 이식성 — 저장 시 스크래치 «전체 페이지» 외부화 + proj.json 매니페스트 기록.
//   · 각 페이지 IndexedDB(scratch-pad-<pid>-<pageId>)를 읽어 base64 src를 goya-asset asset으로 외부화
//     (assetsSaveCanvasImage = content-hash addressed → 이미 goya-asset인 src는 통과=증분 skip).
//   · page.scratchpad = [{id,src(goya-asset),x,y,w,g}] 경량 매니페스트 기록(다른 맥 하이드레이션 원본).
//   · IndexedDB src도 goya-asset로 갱신(같은 맥 재로드도 asset 렌더·중복외부화 방지).
//   ★비파괴: 외부화=복사(원본 base64는 asset로 보존). 실패 시 원본 유지(데이터손실0).
//   ★IndexedDB에 키 없음(undefined)=그 페이지 스크래치 없음/미로드 → 매니페스트 무접촉(보존).
//     빈 배열([])=사용자가 비움 → 매니페스트도 []로 동기화.
async function externalizeScratchpad(proj, projectId) {
  if (!proj || !Array.isArray(proj.pages) || !projectId) return;
  if (!window.electronAPI || !window.electronAPI.assetsSaveCanvasImage) return; // 웹/미가용 no-op
  let db;
  try { db = await _openDB(); } catch (_) { return; }
  const readRaw = (key) => new Promise((res, rej) => {
    const tx = db.transaction(SCRATCH_STORE, 'readonly');
    const rq = tx.objectStore(SCRATCH_STORE).get(key);
    rq.onsuccess = e => res(e.target.result);   // undefined 그대로(키 없음 판별)
    rq.onerror   = e => rej(e.target.error);
  });
  const writeRaw = (key, data) => new Promise((res, rej) => {
    const tx = db.transaction(SCRATCH_STORE, 'readwrite');
    tx.objectStore(SCRATCH_STORE).put(data, key);
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
  });
  const cache = new Map(); // dataUri → goya-asset URL (동일 세이브 내 dedup)
  for (const page of proj.pages) {
    if (!page || !page.id) continue;
    const key = `scratch-pad-${projectId}-${page.id}`;
    let data;
    try { data = await readRaw(key); } catch (_) { continue; }
    if (data === undefined) continue;              // 키 없음 = 스크래치 없음/미로드 → 매니페스트 보존
    if (!Array.isArray(data) || data.length === 0) { page.scratchpad = []; continue; } // 비움 동기화
    let changed = false;
    const manifest = [];
    for (const it of data) {
      let src = it.src;
      if (typeof src === 'string' && src.startsWith('data:image')) {
        let url = cache.get(src);
        if (!url) {
          const m = /^data:(image\/[^;]+);base64,(.+)$/.exec(src);
          if (m) {
            try {
              const r = await window.electronAPI.assetsSaveCanvasImage({ projectId, b64: m[2], mime: m[1] });
              if (r && r.ok && r.url) { url = r.url; cache.set(src, url); }
            } catch (_) { /* 실패 → 원본 base64 유지(손실0) */ }
          }
        }
        if (url) { src = url; changed = true; }
      }
      manifest.push({ ..._pickScratch(it), src });
    }
    page.scratchpad = manifest; // URL+좌표 경량(base64 인라인 아님)
    if (changed) {
      const newData = data.map((it, i) => ({ ...it, src: manifest[i].src }));
      try { await writeRaw(key, newData); } catch (_) {}
      if (projectId === _currentProjectId && page.id === _currentPageId) {
        _scratchItems.forEach(s => { const mm = manifest.find(x => x.id === s.id); if (mm && mm.src !== s.src) { s.src = mm.src; const im = s.el.querySelector('img'); if (im) im.src = mm.src; } });
      }
    }
  }
}
window.externalizeScratchpad = externalizeScratchpad;

// 탭 전환 즉시 호출: 이전 프로젝트 스크래치를 '동기 DOM 제거' 후 백그라운드 저장 (잔상 방지).
// switchScratch는 currentPageId 확정(applyProjectData 이후)까지 미뤄지지만, 이전 프로젝트의
// 저장/제거에는 새 pageId가 필요 없으므로 여기서 분리 수행한다.
async function flushScratchForSwitch() {
  _scratchLoadGen++; // ★진행 중인 _loadScratch 무효화 — 늦은 read가 다음 컨텍스트를 오염시키지 않게
  // ★로드 미완료(A→B→C 고속 전환 중 B의 read 미도착)면 저장 금지 —
  //   빈 _scratchItems를 B의 키에 덮어써 B 데이터가 지워지는 race 차단
  const wasLoaded = _scratchLoaded;
  const key  = _getScratchKey(_currentProjectId, _currentPageId);
  // ★스냅샷은 배열 클리어 '전에' 동기 확보 — 안 그러면 빈 배열이 저장돼 데이터 유실
  const data = _scratchItems.map(s => _pickScratch(s));
  _clearSelection();
  _scratchItems.forEach(s => s.el.remove()); // 동기 제거 — 캔버스 클리어와 같은 턴에 잔상 소멸
  _scratchItems = [];
  // ★키 무효화 — 뒤따르는 switchScratch의 _saveScratch가 옛 키에 빈 배열을 덮어쓰지 않게 no-op화
  _currentProjectId = null;
  _currentPageId    = null;
  _scratchLoaded    = true; // 빈 컨텍스트 = 일관 상태 (key가 null이라 이후 save는 어차피 no-op)
  if (!key || !wasLoaded) return; // projectId 없었거나 로드 미완료였으면 저장 스킵
  const db = await _openDB();
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

// 마퀴 드래그 중 라이브 선택 동기화 — 선택 = base(shift 시 기존 선택) ∪ hits(마퀴 교차)
function _applyMarqueeSelection(baseSet, hitSet) {
  const next = new Set(baseSet);
  hitSet.forEach(s => next.add(s));
  _selectedItems.forEach(s => {
    if (!next.has(s)) { s.el.classList.remove('scratch-selected'); _setIdChipVisible(s, false); }
  });
  next.forEach(s => {
    if (!_selectedItems.has(s)) { s.el.classList.add('scratch-selected'); _setIdChipVisible(s, true); }
  });
  _selectedItems = next;
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
  // 삭제 전 정보 캡쳐 (복원용) — src/x/y/w/id/g 보존
  // ⚠️linkDy 는 빼 왔다(옛 동작 그대로). fx 는 담는다 — 지운 항목을 ⌘Z 로 되살릴 때 효과도 돌아와야 한다.
  const snapshots = items.map(s => _pickScratch(s, ['linkDy']));

  // 실제 삭제
  items.forEach(s => {
    s.el.remove();
    _scratchItems = _scratchItems.filter(i => i !== s);
    _selectedItems.delete(s);
  });
  _saveScratch();

  // 글로벌 history에 sideEffects entry 추가 — 캔버스 스냅샷은 동일 상태로 push되어
  // restoreSnapshot은 캔버스에 영향을 주지 않고 onUndo가 스크래치만 복원
  // ★원본 id로 복원 (Codex 리뷰) — id가 바뀌면 이동/리사이즈 history 스냅샷이
  //   아이템을 못 찾아 undo 체인이 끊기므로 s.id 그대로 재사용. redo도 같은 id로 제거.
  try {
    window.pushHistory?.('스크래치 삭제', {
      onUndo: async () => {
        for (const s of snapshots) {
          try { await window._scratchAddAndSaveFx?.(s.src, s.x, s.y, s.w, s.g, s.id, s.fx); } catch (_) {}
        }
      },
      onRedo: async () => {
        // 복원했던 item들을 다시 제거 (id 보존이므로 원본 id로 직접 제거)
        for (const s of snapshots) {
          try { await window._scratchRemoveById?.(s.id); } catch (_) {}
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
// ★goya-asset:// 는 «캔버스를 오염»시킨다 — 그대로 그리면 toDataURL 이 SecurityError 를 던져
//   슬라이스가 통째로 실패한다(v0.8.0 이미지 외부화 이후 잠복, 2026-09-03 현빈 신고로 발견).
//   렌더러는 file:// origin 이고 커스텀 스킴은 cross-origin 이라 crossOrigin='anonymous' 로도
//   «로드 자체가» 안 된다(실측). export 쪽이 이미 쓰는 assets:readAsDataUri IPC 로 우회한다.
//   ⇒ 여기서 data: URI 로 바꿔 오면 same-origin 이라 오염되지 않는다.
// ★TODO(별건): 이제 공용 문이 있다 — io/goya-asset-inline.js 의 goyaAssetToDrawableSrc().
//   ⛔지금 갈아끼우지 마라: 여기는 실패 시 «원본 src» 를 돌려주고 공용 문은 «null» 을 돌려준다
//   (실패 시맨틱이 다르다). 합치려면 호출부의 실패 처리를 같이 봐야 한다.
async function _toDrawableSrc(src) {
  const info = parseGoyaAssetUrl(src);
  if (!info) return src;                       // data:/http(s)/blob: 는 그대로
  const read = makeElectronAssetReader();
  if (!read) return src;                       // 웹(IPC 없음) — 원본 그대로 시도
  const dataUri = await read(info.projectId, info.filename);
  return dataUri || src;
}

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
  const img = await _loadImg(await _toDrawableSrc(src));
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

// 세로 컷 슬라이스(⌘ hold): ratio(0~1) 위치에서 세로로 잘라 좌/우 dataURL 두 개 반환
async function _sliceImageVertical(src, ratio) {
  const img = await _loadImg(await _toDrawableSrc(src));
  const W = img.naturalWidth, H = img.naturalHeight;
  const cutX = Math.max(1, Math.min(W - 1, Math.round(W * ratio)));
  const mk = (sx, sw) => {
    const cv = document.createElement('canvas');
    cv.width = sw; cv.height = H;
    cv.getContext('2d').drawImage(img, sx, 0, sw, H, 0, 0, sw, H);
    return cv.toDataURL('image/png');
  };
  return {
    left:  mk(0, cutX),
    right: mk(cutX, W - cutX),
    cutX,
    naturalW: W,
  };
}

// 슬라이스 실행 — item을 두 조각으로 대체. history push 포함.
// vert=true(⌘ 컷)면 세로 절단선 → 좌/우 조각, 아니면 가로 절단선 → 위/아래 조각(기존).
async function _sliceItem(item, ratio, vert) {
  if (!item || ratio <= 0 || ratio >= 1) return;
  if (_sliceMode === item) _exitSliceMode();
  let result;
  try { result = vert ? await _sliceImageVertical(item.src, ratio) : await _sliceImageHorizontal(item.src, ratio); }
  catch (err) { window.showToast?.('❌ 슬라이스 실패: ' + err.message); return; }

  // 원본 표시 크기 계산 — display height = w * (natH / natW)
  const imgEl = item.el.querySelector('img');
  const natW  = imgEl?.naturalWidth || 1;
  const natH  = imgEl?.naturalHeight || 1;
  const dispH = item.w * (natH / natW);
  const GAP = 6; // 분리 간격 (px, 캔버스 좌표계)

  const restoreInfo = _pickScratch(item, ['g', 'linkDy']);   // 옛 동작대로 g·linkDy 는 빼고, fx 는 담는다(되살리면 효과도)

  // 조각 배치 계산 — 가로컷: 같은 폭으로 위/아래, 세로컷: 폭을 비율대로 나눠 좌/우
  let pieces;
  if (vert) {
    const leftDispW = item.w * (result.cutX / result.naturalW);
    pieces = [
      { src: result.left,  x: item.x,                        y: item.y, w: leftDispW },
      { src: result.right, x: item.x + leftDispW + GAP,      y: item.y, w: item.w - leftDispW },
    ];
  } else {
    const topDispH = dispH * (result.cutY / result.naturalH);
    pieces = [
      { src: result.top,    x: item.x, y: item.y,                   w: item.w },
      { src: result.bottom, x: item.x, y: item.y + topDispH + GAP,  w: item.w },
    ];
  }

  // 원본 제거
  item.el.remove();
  _scratchItems = _scratchItems.filter(s => s !== item);
  _selectedItems.delete(item);

  // 두 조각 생성
  const topItem    = _createItem(pieces[0].src, pieces[0].x, pieces[0].y, pieces[0].w);
  const bottomItem = _createItem(pieces[1].src, pieces[1].x, pieces[1].y, pieces[1].w);
  await _saveScratch();

  // history push — ★모든 복원/재생성을 원본 id로 (Codex 리뷰: id가 바뀌면
  //   이동/리사이즈 history 스냅샷이 아이템을 못 찾아 undo 체인이 끊김)
  try {
    const topId = topItem?.id || null;
    const botId = bottomItem?.id || null;
    window.pushHistory?.('스크래치 슬라이스', {
      onUndo: async () => {
        // 두 조각 제거 + 원본 복원 (원본 id 유지)
        if (topId) { try { await window._scratchRemoveById?.(topId); } catch (_) {} }
        if (botId) { try { await window._scratchRemoveById?.(botId); } catch (_) {} }
        try { await window._scratchAddAndSaveFx?.(restoreInfo.src, restoreInfo.x, restoreInfo.y, restoreInfo.w, undefined, restoreInfo.id, restoreInfo.fx); } catch (_) {}
      },
      onRedo: async () => {
        // 복원된 원본 제거 + 두 조각 재생성 (조각 id도 최초 슬라이스 때 id 유지, 가로/세로 배치 동일 재현)
        try { await window._scratchRemoveById?.(restoreInfo.id); } catch (_) {}
        try { await window._scratchAddAndSave?.(pieces[0].src, pieces[0].x, pieces[0].y, pieces[0].w, undefined, topId); } catch (_) {}
        try { await window._scratchAddAndSave?.(pieces[1].src, pieces[1].x, pieces[1].y, pieces[1].w, undefined, botId); } catch (_) {}
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

  // ⌘ hold = 세로 절단선(좌/우 컷), 놓으면 가로(위/아래 컷) 복귀 — 클릭 시점 방향으로 확정
  item._sliceVert = false;
  let _lastMx = null, _lastMy = null;

  const _applyLineOrient = () => {
    if (item._sliceVert) {
      line.classList.add('vert');
      line.style.top = '';
      if (_lastMx !== null) {
        const rect = item.el.getBoundingClientRect();
        const ratio = clamp((_lastMx - rect.left) / rect.width, 0.02, 0.98);
        line.style.left = (ratio * 100) + '%';
        item._sliceRatio = ratio;
      } else { line.style.left = '50%'; }
    } else {
      line.classList.remove('vert');
      line.style.left = '';
      if (_lastMy !== null) {
        const rect = item.el.getBoundingClientRect();
        const ratio = clamp((_lastMy - rect.top) / rect.height, 0.02, 0.98);
        line.style.top = (ratio * 100) + '%';
        item._sliceRatio = ratio;
      } else { line.style.top = '50%'; }
    }
  };

  const onMove = mv => {
    _lastMx = mv.clientX; _lastMy = mv.clientY;
    const v = mv.metaKey;
    if (v !== item._sliceVert) { item._sliceVert = v; _applyLineOrient(); return; }
    const rect = item.el.getBoundingClientRect();
    const ratio = v
      ? clamp((mv.clientX - rect.left) / rect.width,  0.02, 0.98)
      : clamp((mv.clientY - rect.top)  / rect.height, 0.02, 0.98);
    if (v) line.style.left = (ratio * 100) + '%';
    else   line.style.top  = (ratio * 100) + '%';
    item._sliceRatio = ratio;
  };

  const onClickConfirm = e => {
    e.stopPropagation();
    const r = item._sliceRatio || 0.5;
    const v = item._sliceVert;
    _exitSliceMode();
    _sliceItem(item, r, v);
  };

  const onKeyEsc = e => {
    if (e.key === 'Escape') { _exitSliceMode(); return; }
    // 마우스 이동 없이 ⌘만 눌러도 방향 즉시 전환
    if (e.key === 'Meta' && !item._sliceVert) { item._sliceVert = true; _applyLineOrient(); }
  };

  const onKeyUp = e => {
    if (e.key === 'Meta' && item._sliceVert) { item._sliceVert = false; _applyLineOrient(); }
  };
  document.addEventListener('keyup', onKeyUp);
  item._sliceKeyUp = onKeyUp;

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
  if (item._sliceKeyUp) { document.removeEventListener('keyup', item._sliceKeyUp); item._sliceKeyUp = null; }
  item._sliceVert = false;
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

// nativeImage.createFromDataURL은 PNG/JPEG data URL만 디코드한다(webp/gif/svg → empty image).
// 외부화 src(goya-asset://)는 main IPC로 재인라인 후, PNG/JPEG가 아니면 캔버스로 PNG 트랜스코드.
async function _srcToPngDataUrl(src) {
  let s = String(src || '');
  const m = /^goya-asset:\/\/([^/]+)\/(.+)$/.exec(s);
  if (m && window.electronAPI?.assetsReadAsDataUri) {
    const res = await window.electronAPI.assetsReadAsDataUri({
      projectId: decodeURIComponent(m[1]), filename: decodeURIComponent(m[2])
    });
    if (res?.ok && res.dataUri) s = res.dataUri;
  }
  if (/^data:image\/(png|jpe?g)[;,]/i.test(s)) return s;
  const blob = await _dataUrlToPngBlob(s);
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload  = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('PNG 변환 실패'));
    fr.readAsDataURL(blob);
  });
}

function _createItem(src, x, y, w = 220, idArg, gArg, linkDyArg, fxArg) {
  const scaler = document.getElementById('canvas-scaler');
  if (!scaler) return null;

  const id = idArg || _genScratchId();
  const el = document.createElement('div');
  el.className = 'scratch-item';
  el.dataset.scratchId = id;
  if (gArg) el.dataset.scratchGroup = gArg;
  el.style.cssText = `left:${x}px; top:${y}px; width:${w}px;`;

  const img = document.createElement('img');
  img.draggable = false;
  // #16 D4: goya-asset 실체 누락(다른 맥·폴더 미동반 등) → 플레이스홀더 표시(링크/데이터는 유지, 추적가능).
  img.onerror = () => { el.classList.add('scratch-missing'); };
  img.src = src;
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

  // ✨ AI 버튼 — 이 이미지를 베이스로 AI 모달 오픈 (사용자 요청으로 일시 숨김)
  const aiBtn = document.createElement('button');
  aiBtn.className = 'scratch-ai-btn';
  aiBtn.type = 'button';
  aiBtn.innerHTML = '✨';
  aiBtn.title = 'AI 이미지 생성 (이 이미지 기반)';
  aiBtn.style.display = 'none';
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
  idChip.style.cssText = 'position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.72);color:#fff;border:none;border-radius:3px;padding:4px 8px;font-size:12px;font-family:ui-monospace,Menlo,monospace;cursor:pointer;display:none;z-index:10;line-height:1.2;';
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
    // 복수 선택(⌘G 그룹 불필요) > 그룹 > 단독 순으로 스케일 대상 결정 —
    // 드래그 이동(dragTargets)과 동일하게 선택 집합을 우선. 그룹처럼 바운딩 비례 스케일.
    const members = (_selectedItems.size > 1 && _selectedItems.has(item))
      ? [..._selectedItems]
      : (item.g ? _scratchItems.filter(s => s.g === item.g) : [item]);
    const isGroup = members.length > 1;
    // 앵커 = 그룹 바운딩박스 좌상단 (핸들이 우하단이므로 좌상단 고정 → 우하단으로 성장)
    const anchorX = Math.min(...members.map(m => m.x));
    const anchorY = Math.min(...members.map(m => m.y));
    // 드래그 시작 시점의 각 멤버 지오메트리 고정 스냅샷 (누적 아닌 절대 배율 적용)
    const starts = members.map(m => ({ it: m, x: m.x, y: m.y, w: m.w }));
    const minMemberW = Math.min(...starts.map(s => s.w));
    // 배율 기준거리 = 앵커(좌상단)에서 잡은 핸들(우변)까지. 그룹에서 잡은 아이템이
    // 최좌측이 아니면 자기 폭(startW)보다 커서 → 배율을 startW로 뽑으면 핸들이 커서보다
    // 빨리 달아나 그룹이 과하게 커진다. 앵커→핸들 거리로 배율을 뽑아야 핸들이 커서를 정확히 추종.
    const gs0 = starts.find(s => s.it === item);
    const anchorDist = Math.max(1, gs0.x + gs0.w - anchorX);
    // 리사이즈 undo/redo용 사전 지오메트리 스냅샷 — onMove가 변형하기 전에 그룹 전체 캡처
    const geomBefore = _scratchGeomSnapshot(members);
    const onMove = mv => {
      const dx = (mv.clientX - startX) / scale;
      // 배율 클램프: 잡은 아이템은 최소 60(기존 관용값), 최소 멤버는 20 밑으로 붕괴 방지
      const fMin = Math.max(60 / startW, 20 / minMemberW);
      const f = Math.max(fMin, (anchorDist + dx) / anchorDist);
      starts.forEach(s => {
        const w = s.w * f;
        s.it.w = w;
        if (isGroup) {
          const x = anchorX + (s.x - anchorX) * f;
          const y = anchorY + (s.y - anchorY) * f;
          s.it.x = x; s.it.y = y;
          if (s.it.el) {
            s.it.el.style.width = w + 'px';
            s.it.el.style.left  = x + 'px';
            s.it.el.style.top   = y + 'px';
          }
        } else if (s.it.el) {
          s.it.el.style.width = w + 'px';
        }
      });
    };
    const onUp = () => {
      _saveScratch();
      // 리사이즈 undo/redo — 잡은 아이템 폭 변화가 있을 때만 history 등록 (이동과 동일 sideEffects 패턴)
      const gb0 = geomBefore.find(g => g.id === item.id);
      if (gb0 && item.w !== gb0.w) {
        const geomAfter = _scratchGeomSnapshot(members);
        try {
          window.pushHistory?.('스크래치 리사이즈', {
            onUndo: () => _applyScratchGeomSnapshot(geomBefore),
            onRedo: () => _applyScratchGeomSnapshot(geomAfter),
          });
        } catch (_) {}
      }
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
    /* ★closeBtn 은 «빠졌다» (2026-09-20 QA 반영, T-075 후속).
       T-075 로 스크래치 하한이 60px 까지 열렸는데, 60px 아이템은 현빈 기본 줌 40% 에서
       화면상 24×24px 이고 .scratch-close(20×20 을 1/zoom 로 되키운다 = 로컬 50px)가 그 위를
       거의 다 덮는다. 그 상태에서 이 가드가 mousedown 을 통째로 버려 «아이템 중앙을 잡으면
       드래그가 아예 안 됐다»(실측: 5×5 격자 25점 중 16점이 closeBtn, 중앙에서 섹션 드롭 2회
       연속 실패 — 가장자리 2px 띠에서만 됐다). ⇒ ✕ 위에서 눌러도 드래그는 «걸린다».
       ⛔지우기가 죽지 않게 «짝»으로 고칠 것이 하나 있다(아래 onMove 참고): 드래그가 실제로
         «움직였을 때만» pointer-events 를 끈다. mousedown 즉시 끄면 제자리 클릭의 mouseup 이
         아이템 «밑»에 떨어져 closeBtn 의 click 이 아예 안 난다 = ✕ 가 안 먹는다. */
    if (e.target === resizeH || e.target === idChip || e.target === sliceBtn) return;
    if (_sliceMode === item) { e.preventDefault(); e.stopPropagation(); return; }

    e.preventDefault(); e.stopPropagation();

    // 선택 처리
    if (!_selectedItems.has(item)) {
      _selectItem(item, e.shiftKey);
    } else if (e.shiftKey) {
      _selectItem(item, true);
      return;
    }

    // 그룹 공동 선택 — 비shift 클릭 시 같은 그룹(g) 멤버 전체를 선택에 포함 → 함께 드래그
    if (!e.shiftKey && item.g) {
      for (const s of _scratchItems) {
        if (s !== item && s.g === item.g && !_selectedItems.has(s)) {
          _selectedItems.add(s);
          s.el.classList.add('scratch-selected');
          _setIdChipVisible(s, true);
        }
      }
    }

    // 드래그할 아이템 목록
    const dragTargets = _selectedItems.size > 0 ? [..._selectedItems] : [item];
    // 단일 드래그인 경우만 캔버스 변환 모드 활성 (다중은 위치 이동만)
    const isSingleDrag = dragTargets.length === 1;

    /* 드래그 중에는 scratch-item이 마우스 아래를 가리지 않도록 pointer-events 차단.
       ★«실제로 움직인 뒤»에 끈다(onMove 첫 틱) — 여기서 끄면 제자리 클릭의 mouseup 이
         아이템 밑 요소에 떨어져 ✕(closeBtn)·이미지의 click 이 안 난다. 2026-09-20 QA 반영. */
    let _peOff = false;

    // 시작 시점의 커서 좌표 + 각 타겟의 원점 좌표 기록
    // → Shift 축 고정(Figma/Sketch 표준): 시작점 기준 X/Y 누적 변위가 큰 축으로만 이동
    //   드래그 도중 Shift on/off 시 실시간 반응을 위해 항상 (시작점 → 현재 커서) 델타에서 다시 계산
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    dragTargets.forEach(t => { t._dragOrigX = t.x; t._dragOrigY = t.y; });
    // 이동 undo/redo용 사전 지오메트리 스냅샷 — onMove가 x/y를 변형하기 전에 캡처
    // (_dragOrigX/Y는 onUp 초입에서 delete되므로 재사용 불가 — 별도 스냅샷 필요)
    const geomBefore = _scratchGeomSnapshot(dragTargets);
    let lastClientX = e.clientX;
    let lastClientY = e.clientY;
    let hasMoved = false;
    let dropKind = 'none';  // 마지막 mousemove의 분류 결과 — mouseup 직전 갱신용
    let _rafId = null;

    // ── 스냅(자석) 셋업 ─────────────────────────────────
    // dragTargets 제외한 나머지 scratch 아이템들의 rect 캐시 (scaler 좌표계)
    // x/y는 model 값, w는 model 값, h는 offsetHeight/scale 추정 (이미지 로드 후엔 정확)
    const SNAP_THRESHOLD = 6;        // edge/center 거리 px
    const SNAP_THRESHOLD_SPACING = 4; // spacing 일치 거리 px
    const snapTargets = [];
    const dragSet = new Set(dragTargets);
    for (const s of _scratchItems) {
      if (dragSet.has(s)) continue;
      const w = s.w || s.el.offsetWidth || 0;
      const h = s.el.offsetHeight || (s.el.querySelector('img')?.offsetHeight) || 0;
      snapTargets.push({
        left: s.x, top: s.y,
        right: s.x + w, bottom: s.y + h,
        cx: s.x + w / 2, cy: s.y + h / 2,
      });
    }
    // dragTargets의 시작 시점 union bbox (model 좌표)
    let _bx0 = Infinity, _by0 = Infinity, _br0 = -Infinity, _bb0 = -Infinity;
    for (const t of dragTargets) {
      const tw = t.w || t.el.offsetWidth || 0;
      const th = t.el.offsetHeight || 0;
      if (t.x < _bx0) _bx0 = t.x;
      if (t.y < _by0) _by0 = t.y;
      if (t.x + tw > _br0) _br0 = t.x + tw;
      if (t.y + th > _bb0) _bb0 = t.y + th;
    }
    const bboxOrigW = _br0 - _bx0;
    const bboxOrigH = _bb0 - _by0;
    const bboxOrigX = _bx0;
    const bboxOrigY = _by0;

    // 가이드 오버레이 컨테이너 (scaler 좌표계 위에 띄움)
    const scalerEl = document.getElementById('canvas-scaler');
    let guidesOverlay = null;
    const guidesPool = []; // 재사용 풀 [{el, used:boolean}]
    const _getGuide = (cls) => {
      let slot = guidesPool.find(g => !g.used);
      if (!slot) {
        const d = document.createElement('div');
        d.className = 'scratch-snap-guide-line';
        guidesOverlay.appendChild(d);
        slot = { el: d, used: false };
        guidesPool.push(slot);
      }
      slot.used = true;
      slot.el.className = 'scratch-snap-guide-line ' + cls;
      slot.el.style.display = 'block';
      return slot.el;
    };
    const _resetGuides = () => { guidesPool.forEach(g => { g.used = false; g.el.style.display = 'none'; }); };
    const _ensureOverlay = () => {
      if (guidesOverlay || !scalerEl) return;
      guidesOverlay = document.createElement('div');
      guidesOverlay.id = 'scratch-snap-guides';
      guidesOverlay.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:9999;';
      scalerEl.appendChild(guidesOverlay);
    };
    const _destroyOverlay = () => {
      try { guidesOverlay?.remove(); } catch (_) {}
      guidesOverlay = null;
      guidesPool.length = 0;
    };

    // 가이드 라인 추가 헬퍼 (좌표는 scaler 내부 px)
    const _addV = (xPos, y1, y2, kind) => {
      const g = _getGuide(kind === 'spacing' ? 'v spacing' : 'v');
      const top = Math.min(y1, y2);
      const h = Math.max(2, Math.abs(y2 - y1));
      g.style.left = (xPos - 0.5) + 'px';
      g.style.top = top + 'px';
      g.style.width = '1px';
      g.style.height = h + 'px';
    };
    const _addH = (yPos, x1, x2, kind) => {
      const g = _getGuide(kind === 'spacing' ? 'spacing' : '');
      const left = Math.min(x1, x2);
      const w = Math.max(2, Math.abs(x2 - x1));
      g.style.left = left + 'px';
      g.style.top = (yPos - 0.5) + 'px';
      g.style.width = w + 'px';
      g.style.height = '1px';
    };

    const onMove = mv => {
      // 미세 지터(클릭 중 1~2px 떨림)가 '드래그'로 승격되는 것 차단 — 화면좌표 기준 임계값
      if (!hasMoved && Math.hypot(mv.clientX - startClientX, mv.clientY - startClientY) < 3) return;
      hasMoved = true;
      // ★여기서 끈다 — 아래 히트테스트(드롭 대상 찾기)보다 «먼저»여야 한다.
      if (isSingleDrag && !_peOff) { _peOff = true; dragTargets.forEach(t => { t.el.style.pointerEvents = 'none'; }); }
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

      // ── 스냅 계산 (Alt 누르면 bypass) ──────────────────
      let snapDx = 0, snapDy = 0;
      const snapGuides = []; // 적용된 가이드 목록
      const snapEnabled = !mv.altKey && snapTargets.length > 0;
      if (snapEnabled) {
        // 현재 union bbox(free 적용 후) 좌표
        const curLeft = bboxOrigX + applyDx;
        const curTop  = bboxOrigY + applyDy;
        const curRight = curLeft + bboxOrigW;
        const curBottom = curTop + bboxOrigH;
        const curCx = curLeft + bboxOrigW / 2;
        const curCy = curTop  + bboxOrigH / 2;

        // 가로 (X축) 후보: bbox의 left/right/cx ↔ target의 left/right/cx
        let bestX = { d: SNAP_THRESHOLD + 1, dx: 0, guides: [] };
        const considerX = (curVal, targetVal, alignVal, kind) => {
          const d = Math.abs(curVal - targetVal);
          if (d < bestX.d) {
            bestX = { d, dx: targetVal - curVal, guides: [{ kind, x: targetVal }] };
          } else if (d === bestX.d && Math.abs(bestX.dx - (targetVal - curVal)) < 0.5) {
            bestX.guides.push({ kind, x: targetVal });
          }
        };
        let bestY = { d: SNAP_THRESHOLD + 1, dy: 0, guides: [] };
        const considerY = (curVal, targetVal, kind) => {
          const d = Math.abs(curVal - targetVal);
          if (d < bestY.d) {
            bestY = { d, dy: targetVal - curVal, guides: [{ kind, y: targetVal }] };
          } else if (d === bestY.d && Math.abs(bestY.dy - (targetVal - curVal)) < 0.5) {
            bestY.guides.push({ kind, y: targetVal });
          }
        };
        for (const T of snapTargets) {
          // left ↔ left / right / cx
          considerX(curLeft, T.left, 'edge');
          considerX(curLeft, T.right, 'edge');
          considerX(curLeft, T.cx, 'center');
          // right ↔ left / right / cx
          considerX(curRight, T.left, 'edge');
          considerX(curRight, T.right, 'edge');
          considerX(curRight, T.cx, 'center');
          // cx ↔ left / right / cx
          considerX(curCx, T.left, 'center');
          considerX(curCx, T.right, 'center');
          considerX(curCx, T.cx, 'center');
          // top ↔ top / bottom / cy
          considerY(curTop, T.top, 'edge');
          considerY(curTop, T.bottom, 'edge');
          considerY(curTop, T.cy, 'center');
          // bottom ↔ top / bottom / cy
          considerY(curBottom, T.top, 'edge');
          considerY(curBottom, T.bottom, 'edge');
          considerY(curBottom, T.cy, 'center');
          // cy ↔ top / bottom / cy
          considerY(curCy, T.top, 'center');
          considerY(curCy, T.bottom, 'center');
          considerY(curCy, T.cy, 'center');
        }
        if (bestX.d <= SNAP_THRESHOLD) {
          snapDx = bestX.dx;
          for (const g of bestX.guides) snapGuides.push({ orient: 'v', kind: g.kind, pos: g.x });
        }
        if (bestY.d <= SNAP_THRESHOLD) {
          snapDy = bestY.dy;
          for (const g of bestY.guides) snapGuides.push({ orient: 'h', kind: g.kind, pos: g.y });
        }
      }

      const finalDx = applyDx + snapDx;
      const finalDy = applyDy + snapDy;
      dragTargets.forEach(t => {
        t.x = t._dragOrigX + finalDx;
        t.y = t._dragOrigY + finalDy;
      });

      if (!_rafId) _rafId = requestAnimationFrame(() => {
        dragTargets.forEach(t => {
          t.el.style.left = t.x + 'px';
          t.el.style.top  = t.y + 'px';
        });
        // 가이드 라인 그리기
        if (snapGuides.length > 0) {
          _ensureOverlay();
          _resetGuides();
          // 가이드 라인 길이: 후보 target들과 현재 bbox를 포함하는 범위로 그림
          const curLeft = bboxOrigX + finalDx;
          const curTop  = bboxOrigY + finalDy;
          const curRight = curLeft + bboxOrigW;
          const curBottom = curTop + bboxOrigH;
          for (const g of snapGuides) {
            if (g.orient === 'v') {
              // 세로선: y 범위는 모든 target 중 이 x를 공유하는 것 + 현재 bbox
              let y1 = curTop, y2 = curBottom;
              for (const T of snapTargets) {
                if (Math.abs(T.left - g.pos) < 0.5 || Math.abs(T.right - g.pos) < 0.5 || Math.abs(T.cx - g.pos) < 0.5) {
                  if (T.top < y1) y1 = T.top;
                  if (T.bottom > y2) y2 = T.bottom;
                }
              }
              _addV(g.pos, y1, y2, g.kind);
            } else {
              let x1 = curLeft, x2 = curRight;
              for (const T of snapTargets) {
                if (Math.abs(T.top - g.pos) < 0.5 || Math.abs(T.bottom - g.pos) < 0.5 || Math.abs(T.cy - g.pos) < 0.5) {
                  if (T.left < x1) x1 = T.left;
                  if (T.right > x2) x2 = T.right;
                }
              }
              _addH(g.pos, x1, x2, g.kind);
            }
          }
        } else if (guidesOverlay) {
          _resetGuides();
        }
        // 단일 드래그면 캔버스 변환 가이드 미리보기 (requireArm: 같은 타깃 위 체류 후에만 하이라이트=armed)
        if (isSingleDrag) {
          try { dropKind = previewScratchDropAt(lastClientX, lastClientY, { requireArm: true }); }
          catch (err) { dropKind = 'none'; }
        }
        _rafId = null;
      });
    };

    const onUp = async () => {
      if (_rafId) cancelAnimationFrame(_rafId);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // 스냅 가이드/캐시 정리
      _destroyOverlay();
      snapTargets.length = 0;
      // 드래그 원점 임시 프로퍼티 정리 (저장 직렬화에는 무영향 — 정리만)
      dragTargets.forEach(t => { delete t._dragOrigX; delete t._dragOrigY; });

      // 단일 드래그 + 움직임 있었으면 마지막 좌표에서 변환 시도
      // (pointer-events:none을 commit 전까지 유지해야 elementFromPoint가 underneath 캔버스를 잡음)
      let committed = false;
      // Undo 복원용 — 변환 전에 캡쳐 (id 포함 — 복원 시 원본 id 유지해야 이동 undo 체인 안 끊김)
      const restoreInfo = _pickScratch(item, ['g', 'linkDy']);   // 옛 동작대로 g·linkDy 는 빼고, fx 는 담는다(되살리면 효과도)
      // 이미지 자연 비율 (insert/append 케이스용)
      const imgEl = item.el.querySelector('img');
      const natW = imgEl?.naturalWidth || 0;
      const natH = imgEl?.naturalHeight || 0;

      if (isSingleDrag && hasMoved) {
        try {
          committed = commitScratchDropAt(lastClientX, lastClientY, item.src, {
            fx: item.fx,   // C1 — 에셋에서 빼 온 항목이면 효과째 되돌아간다
            naturalWidth: natW,
            naturalHeight: natH,
            /* ★「스크래치패드에서 보이던 폭」 (현빈 신고 2026-09-20, 0920b-scratch-modal)
               전에는 이 값을 «안 넘겼다» ⇒ 받는 쪽은 폭을 정할 근거가 없어 CSS 의
               `.asset-block{width:100%}` 에 맡겼고, 220px 로 보이던 그림이 796px 로 들어갔다
               (실측 3.62배). 비율은 맞는데 절대 크기만 커지는 게 그 증상이었다.
               ⚠️`item.w` 는 이미 «캔버스 px»다 — .scratch-item 은 #canvas-scaler 의 자식이라
                 #canvas 와 같은 좌표계에 살고, 리사이즈 핸들도 dx/_getScale() 로 배율을 나눠
                 저장한다 ⇒ 줌 보정은 필요 없다(있으면 오히려 두 번 나눈다).
               ⚠️옵트인이다 — 이 값을 «안» 넘기는 호출자(자산패널 드롭)는 종전대로 풀폭이다. */
            width: item.w,
            requireArm: true, // 하이라이트(armed) 없이 스친 릴리즈는 위치 이동으로만 처리
          });
        } catch (err) {
          console.warn('[ScratchPad] commit 실패:', err);
          committed = false;
        }
      }

      // pointer-events 복원 (commit 후)
      if (isSingleDrag && _peOff) dragTargets.forEach(t => { t.el.style.pointerEvents = ''; });

      if (committed) {
        try { await window._scratchRemoveById?.(item.id); } catch (_) {}
        // 변환 후 상태 push + Undo/Redo 시 스크래치 복원/재제거 hook
        // ★원본 id로 복원 (Codex 리뷰) — id가 바뀌면 이동/리사이즈 history 스냅샷이
        //   아이템을 못 찾아 undo 체인이 끊기므로 restoreInfo.id 그대로 재사용
        try {
          window.pushHistory?.('스크래치→섹션 변환', {
            onUndo: async () => {
              try { await window._scratchAddAndSaveFx?.(restoreInfo.src, restoreInfo.x, restoreInfo.y, restoreInfo.w, undefined, restoreInfo.id, restoreInfo.fx); } catch (_) {}
            },
            onRedo: async () => {
              try { await window._scratchRemoveById?.(restoreInfo.id); } catch (_) {}
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
        // 이동 undo/redo — 실제 좌표 변화가 있을 때만 history 등록 (스냅/지터로 0 이동이면 스킵)
        // 그룹 정렬(_scratchGroupAndAlign)과 동일한 pushHistory sideEffects 패턴
        if (dragTargets.some((t, i) => t.x !== geomBefore[i].x || t.y !== geomBefore[i].y)) {
          const geomAfter = _scratchGeomSnapshot(dragTargets);
          try {
            window.pushHistory?.('스크래치 이동', {
              onUndo: () => _applyScratchGeomSnapshot(geomBefore),
              onRedo: () => _applyScratchGeomSnapshot(geomAfter),
            });
          } catch (_) {}
        }
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  scaler.appendChild(el);

  // #16 follow — linkDy = 연결된 섹션 top(scaler-local) 기준 y 오프셋. 미연결/미앵커면 undefined.
  //   (refLinks dataset 포맷은 «건드리지 않는다» — 오프셋은 스크래치 아이템 레코드에만 둔다.)
  const item = { el, src, x, y, w, id, g: gArg || undefined,
                 linkDy: (typeof linkDyArg === 'number' && isFinite(linkDyArg)) ? linkDyArg : undefined,
                 fx: (fxArg && typeof fxArg === 'object') ? fxArg : undefined };
  _scratchItems.push(item);

  // native HTML5 DnD 사용 안 함 — mousedown/move/up 흐름 안에서 모두 처리 (canvas-scratch-drop.js의 export API 호출)
  el.draggable = false;

  return item;
}

async function _loadScratch(projectId, pageId) {
  const gen = ++_scratchLoadGen; // ★이 로드의 세대 토큰 — 이후 flush/새 로드가 bump하면 stale
  _scratchLoaded    = false;     // 로드 완료 전 save/flush의 빈 배열 덮어쓰기 차단
  _currentProjectId = projectId;
  _currentPageId    = pageId || null;
  _clearSelection();
  _scratchItems.forEach(s => s.el.remove());
  _scratchItems = [];
  const key = _getScratchKey(projectId, pageId);
  if (!key) { _scratchLoaded = true; return; } // projectId 없으면 로드 스킵 (빈 컨텍스트 = 일관 상태)
  try {
    const db   = await _openDB();
    if (gen !== _scratchLoadGen) return; // ★stale — 다른 컨텍스트로 이미 전환됨
    const data = await new Promise((resolve, reject) => {
      const tx  = db.transaction(SCRATCH_STORE, 'readonly');
      const req = tx.objectStore(SCRATCH_STORE).get(key);
      req.onsuccess = e => resolve(e.target.result || []);
      req.onerror   = e => reject(e.target.error);
    });
    if (gen !== _scratchLoadGen) return; // ★stale — DOM/배열 오염·엉뚱한 키 저장 금지
    // #16 이식성 — 하이드레이션: IndexedDB가 «비었고» 프로젝트 매니페스트(page.scratchpad)가 있으면
    //   매니페스트로 재채움(다른 맥 = IndexedDB 빔 → 프로젝트에 딸려온 goya-asset URL+좌표로 복원).
    //   ★«비었을 때만» = 같은 맥 로컬 편집 보존(로컬 IndexedDB 우선·덮어쓰기 금지·회귀0).
    let items = data;
    let hydrated = false;
    if (!items || !items.length) {
      const pg = (window.state && Array.isArray(window.state.pages)) ? window.state.pages.find(p => p.id === pageId) : null;
      const manifest = pg && Array.isArray(pg.scratchpad) ? pg.scratchpad : null;
      if (manifest && manifest.length) {
        items = manifest.map(m => _pickScratch(m));
        hydrated = true;
      }
    }
    let migrated = false;
    items.forEach(({ src, x, y, w, id, g, linkDy, fx }) => {
      if (!id) migrated = true; // 구 데이터엔 id 없음 — 자동 생성 후 재저장 트리거
      _createItem(src, x, y, w, id, g, linkDy, fx);
    });
    _scratchLoaded = true; // migrated 재저장 전에 완료 마킹 (_saveScratch가 가드하므로)
    if (migrated || hydrated) _saveScratch(); // 하이드레이션분을 로컬 IndexedDB에 영속
    // #16: 스크래치 로드 완료 → 연결(refLinks)된 아이템 pane 필터 + 사이드카 재렌더(P2 오버레이).
    try { window.__spLinkRerender && window.__spLinkRerender(); } catch (_) {}
  } catch(e) {
    if (gen === _scratchLoadGen) _scratchLoaded = true; // 기존 동작 유지 — 세션 중 작업/저장은 가능
    console.warn('[ScratchPad] load error:', e);
    window.showToast?.('⚠️ 스크래치패드 복원 실패 (세션 중에는 정상 동작)');
  }
}

async function initScratchPad(projectId, pageId) {
  await _loadScratch(projectId, pageId);

  const wrap = document.getElementById('canvas-wrap');
  if (!wrap || wrap._scratchBound) return;
  wrap._scratchBound = true;

  // canvas-wrap 빈 영역: 클릭 = 전체 선택 해제(기존 동작), 드래그 = 마퀴 다중 선택.
  // panMode(Space)는 editor.js capture 핸들러가 stopPropagation하므로 자연 배제.
  const MARQUEE_THRESHOLD = 4; // client px — 미만이면 단순 클릭으로 간주
  /* ★A1(현빈 2026-10-01 「이걸로 스크래치 패드만 되는데 섹션 및 블럭도 선택되게」) — 섹션·블럭은 «상자가 그 요소 면적의
     이 비율 이상을 덮으면» 잡는다(스크래치 항목은 지금 그대로 «걸치면»). 면적비라 크기에 따라 저절로 갈린다:
     작은 블럭은 조금만 들어와도 넘고(교차처럼), 전폭 row·섹션은 거의 다 덮어야 넘는다(완전포함처럼).
     ⚠️미측정·잠정 · 2026-10-01 · 섹션 높이 분포를 안 쟀다 — 재면 그 수와 분모를 여기 적어 넣어라. */
  const MARQUEE_COVER_RATIO = 0.5;
  wrap.addEventListener('mousedown', e => {
    if (e.target.closest('.scratch-item')) return;

    // 마퀴 발동 조건: 좌클릭 + 캔버스 빈 영역(editor.js deselectAll과 동일 판정) + 펜/슬라이스 모드 아님
    const isEmptyArea = e.button === 0
      && ['canvas-wrap', 'canvas-scaler', 'canvas'].includes(e.target.id)
      && !_sliceMode
      && !document.body.classList.contains('pen-mode')
      && !document.body.classList.contains('vpen-mode');
    // 네이티브 스크롤바 클릭은 마퀴 제외 (preventDefault가 스크롤바 드래그를 막음)
    const onScrollbar = e.target === wrap && (e.offsetX > wrap.clientWidth || e.offsetY > wrap.clientHeight);

    if (!isEmptyArea || onScrollbar) {
      _clearSelection(); // 기존 동작 유지
      return;
    }

    // shift = 기존 선택 보존(additive), 아니면 기존 동작대로 즉시 해제
    const baseSel = e.shiftKey ? new Set(_selectedItems) : new Set();
    /* ⇧ 더하기의 «이미 골라진 섹션» — 섹션 1개 선택은 multiSel 이 아니라 단일 .selected 라 따로 챙긴다.
       단 블럭을 고르면 syncSection 이 부모 섹션에도 .selected 를 붙이므로, «안에 골라진 블럭이 없는» 섹션만 센다. */
    const baseSecs = e.shiftKey ? [...document.querySelectorAll('#canvas .section-block.selected')].filter(s => !s.querySelector('.selected')) : [];
    if (!e.shiftKey) {
      _clearSelection();
      window.deselectAll?.();   // ★A1 ④ — 이제 섹션·블럭도 이 상자의 대상이라 «셋 다» 푼다(빈 바닥 단순 클릭 포함)
    }
    /* ⛔[A1] 옛 판엔 여기 `if (_scratchItems.length === 0) return;` 이 있었다 — 스크래치가 비면 상자 «자체»가 안 떴다
       (실측: 같은 자리·같은 끌기에서 항목 0개 = 상자 0 / 1개 = 상자 1). 섹션·블럭도 대상이 된 지금은 지운다. */

    e.preventDefault();
    // 포커스 잔류로 인한 단축키 가드 오작동 예방 — 입력 요소 blur
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) ae.blur();

    const scalerEl = document.getElementById('canvas-scaler');
    if (!scalerEl) return;
    const scale = _getScale();
    const scalerRect = scalerEl.getBoundingClientRect(); // 시작 시 캐시 (아이템 드래그와 동일 방식)
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startX = (startClientX - scalerRect.left) / scale;
    const startY = (startClientY - scalerRect.top)  / scale;

    // ★A1 — 섹션·블럭 대상도 «시작 때 1회» 캐시(스크래치와 같은 방식). lazy 섹션도 높이는 유지된다(io/lazy-sections.js).
    const _toModel = (r) => ({ left: (r.left - scalerRect.left) / scale, top: (r.top - scalerRect.top) / scale,
                               right: (r.right - scalerRect.left) / scale, bottom: (r.bottom - scalerRect.top) / scale });
    const canvasBoxes = _marqueeCanvasTargets().map(t => ({ ...t, ..._toModel(t.box.getBoundingClientRect()) }))
      .filter(b => b.right > b.left && b.bottom > b.top);   // 면적 0 = 안 보이는 것(숨은 시안 등) — 고르지 않는다
    let _hitEls = new Set();

    // 아이템 AABB 캐시 (model 좌표)
    const boxes = _scratchItems.map(s => ({
      item: s,
      left: s.x, top: s.y,
      right:  s.x + (s.w || s.el.offsetWidth || 0),
      bottom: s.y + (s.el.offsetHeight || 0),
    }));

    let marqueeEl = null;
    let active = false;
    let _rafId = null;
    let lastMv = null;

    const _update = () => {
      _rafId = null;
      if (!lastMv || !marqueeEl) return;
      const curX = (lastMv.clientX - scalerRect.left) / scale;
      const curY = (lastMv.clientY - scalerRect.top)  / scale;
      const x1 = Math.min(startX, curX), x2 = Math.max(startX, curX);
      const y1 = Math.min(startY, curY), y2 = Math.max(startY, curY);
      marqueeEl.style.left   = x1 + 'px';
      marqueeEl.style.top    = y1 + 'px';
      marqueeEl.style.width  = (x2 - x1) + 'px';
      marqueeEl.style.height = (y2 - y1) + 'px';
      // AABB 교차 히트테스트 → 라이브 선택 동기화
      const hits = new Set();
      for (const b of boxes) {
        if (b.left < x2 && b.right > x1 && b.top < y2 && b.bottom > y1) hits.add(b.item);
      }
      _applyMarqueeSelection(baseSel, hits);
      // ★A1 — 섹션·블럭: 면적비(MARQUEE_COVER_RATIO). 상자 중엔 «임시 표시»만, 실제 선택은 mouseup 한 번.
      const cover = (b) => {
        const w = Math.max(0, Math.min(x2, b.right) - Math.max(x1, b.left));
        const h = Math.max(0, Math.min(y2, b.bottom) - Math.max(y1, b.top));
        const area = Math.max(1, (b.right - b.left) * (b.bottom - b.top));
        return (w * h) / area;
      };
      const secHit = new Set(canvasBoxes.filter(b => b.kind === 'section' && cover(b) >= MARQUEE_COVER_RATIO).map(b => b.sec));
      const next = new Set();
      canvasBoxes.forEach(b => {
        if (b.kind === 'section' ? secHit.has(b.sec) : (!secHit.has(b.sec) && cover(b) >= MARQUEE_COVER_RATIO)) next.add(b);
      });
      _hitEls.forEach(b => { if (!next.has(b)) b.box.classList.remove('marquee-hit'); });
      next.forEach(b => b.box.classList.add('marquee-hit'));
      _hitEls = next;
    };

    const onMove = mv => {
      if (!active) {
        if (Math.max(Math.abs(mv.clientX - startClientX), Math.abs(mv.clientY - startClientY)) < MARQUEE_THRESHOLD) return;
        active = true;
        marqueeEl = document.createElement('div');
        marqueeEl.className = 'scratch-marquee';
        scalerEl.appendChild(marqueeEl);
      }
      lastMv = mv;
      if (!_rafId) _rafId = requestAnimationFrame(_update);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; _update(); }
      marqueeEl?.remove();
      marqueeEl = null;
      // ★A1 — 섹션·블럭 선택을 «한 번» 반영한다. 섹션 = ⌘클릭과 같은 다중선택 길, 블럭 = ⌘클릭 길(toggleBlockSelect).
      //   ⇧ 로 시작했으면 이미 골라진 것은 다시 토글하지 않는다(더하기만).
      const hitList = [..._hitEls];
      hitList.forEach(b => b.box.classList.remove('marquee-hit'));
      _hitEls = new Set();
      if (active) {
        /* ⛔mouseup 바로 뒤에 오는 «빈 바닥 click» 을 편집기가 받아 전부 해제한다(실측: 상자는 두 섹션을 잡았는데 놓으면
           선택 0). 상자를 «실제로 끌었을 때만» 그 click 하나를 삼킨다 — 단순 클릭(임계 미만)은 지금처럼 해제로 간다. */
        const _eatClick = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
        document.addEventListener('click', _eatClick, { capture: true, once: true });
        setTimeout(() => document.removeEventListener('click', _eatClick, { capture: true }), 0);
        const secHits = hitList.filter(b => b.kind === 'section').map(b => b.sec);
        hitList.filter(b => b.kind === 'block').forEach(b => {
          if (!b.el.classList.contains('selected')) window.toggleBlockSelect?.(b.el, b.sec);
        });
        /* 블럭이 하나라도 골라져 있으면 «섞임» — ⌘클릭 길은 섹션 1개면 단일선택으로 접히며 블럭을 풀고(selectSection),
           toggleBlockSelect 의 syncSection 은 섹션 .selected 를 전부 지운다(실측: 섹션 B + 블럭 → 블럭만 남음).
           ⇒ 섞임일 때만 섹션을 multiSel 모델에 직접 올린다(⌘클릭 «합류» 갈래와 같은 두 클래스 + multiSel.sections). */
        const mixed = !!document.querySelector('#canvas .section-block .selected');
        const ms = window.multiSel;
        if (mixed && ms) {
          [...ms.sections, ...baseSecs, ...secHits].forEach(sec => {
            sec.classList.add('selected', 'multi-selected'); ms.sections.add(sec); ms.lastSection = sec;
          });
        } else {
          secHits.forEach(sec => {
            if (!sec.classList.contains('multi-selected')) window.selectSectionWithModifier?.(sec, { metaKey: true });
          });
        }
      }
      // 임계 미만 = 단순 클릭: 위에서 이미 기존 동작(선택 해제) 수행됨
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
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
      // goya-asset://·webp 등 nativeImage가 못 읽는 src를 PNG data URL로 정규화
      const srcForCopy = await _srcToPngDataUrl(items[0].src);
      // Electron 환경: 메인 프로세스 nativeImage 경유 (navigator.clipboard 권한 우회)
      if (window.electronAPI?.clipboardWriteImage) {
        const res = await window.electronAPI.clipboardWriteImage(srcForCopy);
        if (!res?.ok) throw new Error(res?.error || 'clipboard write failed');
      } else {
        const blob = await _dataUrlToPngBlob(srcForCopy);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      }
      // 외부 클립보드(이미지) 복사 timestamp — Cmd+V 시 내부 클립보드와 우선순위 비교용
      window._scratchClipboardTime = Date.now();
      // 복사 아이템의 표시 폭 메타 보존 — paste 시 원본 크기 복원용
      // (OS 클립보드는 첫 장만 담으므로 items[0] 기준. 자연 치수는 paste 시 동일 이미지 대조 가드)
      const copiedEl = items[0].el, copiedImg = copiedEl?.querySelector('img');
      window._scratchCopiedMeta = {
        w: copiedEl?.offsetWidth || items[0].w || 220,
        natW: copiedImg?.naturalWidth || 0,
        natH: copiedImg?.naturalHeight || 0,
        time: window._scratchClipboardTime
      };
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

  /* ── C1(현빈 2026-10-01): 에셋을 «섹션 밖»(스크래치 바닥)에 놓으면 스크래치패드로 «이동» ─────────────
     · 우클릭 「스크래치로 보내기」는 «복사»(블럭이 남는다). 이건 «이동» — 블럭은 섹션에서 빠지고 스크래치로 돌아간다.
     · ★이미지 효과(크롭·맞춤·회전·모서리·오버레이·그레인·색보정·GIF)를 항목에 fx 로 담아 간다
       (image-handling.js captureAssetFx). 다시 캔버스로 끌어 넣으면 setAssetImageWithFx 가 효과째 되얹는다.
     · 알아보는 법: 끄는 쪽(block-drag.js dragstart)이 'application/x-goditor-asset-block' 타입을 싣는다.
       섹션 «안»이면 손대지 않는다(섹션의 기존 드롭이 받는다).
     · ⌘Z 한 번 = 이동 한 번 — 캔버스는 push-after 스냅샷, 스크래치 쪽은 sideEffects 로 짝(「스크래치 삭제」와 같은 꼴). */
  const ASSET_DRAG_TYPE = 'application/x-goditor-asset-block';
  const _onScratchFloor = (t) => !!t?.closest?.('#canvas-wrap') && !t.closest('.section-block');
  wrap.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes(ASSET_DRAG_TYPE) || !_onScratchFloor(e.target)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    wrap.classList.add('scratch-drag-over');
  });
  wrap.addEventListener('drop', e => {
    if (!e.dataTransfer.types.includes(ASSET_DRAG_TYPE)) return;
    wrap.classList.remove('scratch-drag-over');
    if (!_onScratchFloor(e.target)) return;
    const ab = document.getElementById(e.dataTransfer.getData(ASSET_DRAG_TYPE) || '');
    if (!ab?.classList.contains('asset-block')) return;
    e.preventDefault(); e.stopPropagation();
    _moveAssetToScratch(ab, e.clientX, e.clientY);
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
        const dataUrl = ev.target.result;
        // 스크래치 Cmd+C로 복사한 이미지면 원본 표시 폭 복원 (자연 치수 대조 가드 —
        // 외부 앱에서 복사한 이미지는 치수 불일치로 걸러져 기본 220px 유지)
        const meta = window._scratchCopiedMeta;
        const probe = new Image();
        probe.onload = () => {
          let w = 220;
          if (meta && meta.time === (window._scratchClipboardTime || 0)
              && probe.naturalWidth === meta.natW && probe.naturalHeight === meta.natH) w = meta.w;
          _createItem(dataUrl, cx - w / 2 + i * 24, cy - 60 + i * 24, w);
          _saveScratch();
        };
        probe.onerror = () => {
          _createItem(dataUrl, cx - 110 + i * 24, cy - 60 + i * 24);
          _saveScratch();
        };
        probe.src = dataUrl;
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


/* ── 스크래치 «놓을 자리» 계산 — 단일 진실소스 ─────────────────────────────────
 * ★왜 함수로 뺐나(2026-08-30): 이 계산이 loadScratchpadFolder 안에 «인라인»으로만 있었는데,
 *   MCP put_image 도 «같은 자리 규칙»을 써야 한다. 복사해두면 나중에 갈린다.
 *   ⇒ 두 곳이 이 함수 «하나»를 쓴다.
 *
 * ⚠️앱의 다른 이미지 투입 경로는 «각자 다른 규칙»을 쓴다. 여기로 합치지 마라(의도가 다르다):
 *     에셋 드래그드롭  마우스 좌표 · 폭 220      (사람이 놓은 자리에 놓는 게 맞다)
 *     블록에서 보내기  고정 (40,40) · 폭 400
 *     AI 이미지갤러리  고정 (0,0)  · 폭 200      ⚠️(0,0)은 캔버스 위다 — 별건 백로그
 *
 * ★START_X 하한의 유래: 스크래치 아이템만 보고 maxRight+GAP 로 잡으면, 아이템이 캔버스
 *   왼쪽(음수 x)에 있을 때 새 컬럼이 캔버스(x0~860) 위로 얹혀 섹션과 겹쳤다
 *   (현빈 보고: sp_ot4tk9 가 x=-945). 캔버스 우측 클리어를 «항상» 지킨다.
 *
 * newColumn:true  — 기존 전부의 오른쪽에 «새 컬럼»을 연다(폴더 일괄 불러오기: 배치마다 새 컬럼)
 * newColumn:false — «현재 가장 오른쪽 컬럼»의 맨 아래에 이어 붙인다(MCP: 한 장씩 들어와도 세로로 쌓기)
 * ⚠️「컬럼이 꽉 참」 개념은 «원래 없다» — 기존 코드에 상한이 없어 무한히 세로로 쌓는다.
 *   새 상한을 여기서 만들지 않는다(지디 지시).
 */
const SCRATCH_PLACE = { START_X: 960, WIDTH: 860, GAP_X: 100, GAP_Y: 100 };

window._scratchNextSlot = ({ newColumn = false } = {}) => {
  const { START_X, GAP_X, GAP_Y } = SCRATCH_PLACE;
  if (!_scratchItems.length) return { x: START_X, y: 0 };

  let maxRight = 0;
  for (const s of _scratchItems) {
    const w = s.el?.offsetWidth || s.w || 0;
    const right = (s.x || 0) + w;
    if (right > maxRight) maxRight = right;
  }
  if (newColumn) return { x: Math.max(START_X, maxRight + GAP_X), y: 0 };

  // 이어 붙이기 — «가장 오른쪽 컬럼»을 찾아 그 아래로.
  //   컬럼 판정: 그 컬럼의 x 와 «같은 x»를 가진 아이템들(일괄 투입은 x 가 동일하다).
  let colX = null, best = -Infinity;
  for (const s of _scratchItems) {
    const x = s.x || 0;
    if (x > best) { best = x; colX = x; }
  }
  if (colX === null || colX < START_X) return { x: Math.max(START_X, maxRight + GAP_X), y: 0 };
  let bottom = 0;
  for (const s of _scratchItems) {
    if ((s.x || 0) !== colX) continue;
    const h = s.el?.offsetHeight || s.h || 0;
    const b = (s.y || 0) + h;
    if (b > bottom) bottom = b;
  }
  return { x: colX, y: bottom + GAP_Y };
};


/* ── MCP put_image 전용 투입구 ─────────────────────────────────────────────────
 * ★왜 별도 함수인가: _scratchAddAndSave 는 «조용히 실패»할 수 있다.
 *   _getScratchKey 가 projectId 없으면 null 을 돌려주고 저장이 «스킵»되는데,
 *   _scratchAddAndSave 는 그래도 resolve 한다 ⇒ 「성공을 돌려주고 실제론 아무 데도 안 남는다».
 *   ★「성공 반환 = 실제로 됐음」이 아니다. 그래서 여기서 «앞뒤로» 막는다:
 *     ⑴ 앞: 프로젝트 열림을 «먼저» 확인하고, 없으면 명확한 오류로 거절
 *     ⑵ 뒤: 저장한 뒤 «되읽어» 실제로 있는지 확인. 없으면 성공을 돌려주지 않는다
 * 위치는 _scratchNextSlot({newColumn:false}) — 폴더 불러오기와 «같은 컬럼 규칙»으로 세로로 쌓는다.
 */
window._scratchAddForMcp = async (src, { width } = {}) => {
  if (!_currentProjectId) {
    return { ok: false, code: 'NO_PROJECT',
             message: '프로젝트가 열려 있지 않습니다. 프로젝트를 먼저 열어 주세요. (스크래치는 프로젝트+페이지에 묶입니다)' };
  }
  if (typeof src !== 'string' || !src) {
    return { ok: false, code: 'BAD_SRC', message: 'src must be a non-empty string' };
  }
  const W = width || SCRATCH_PLACE.WIDTH;
  const { x, y } = window._scratchNextSlot({ newColumn: false });
  const before = _scratchItems.length;
  try {
    await window._scratchAddAndSave(src, x, y, W);
  } catch (e) {
    return { ok: false, code: 'ADD_FAILED', message: String(e && e.message || e) };
  }
  // ⑵ ★되읽기 — 실제로 남았는지 확인한다. 방금 것은 «마지막» 아이템이다.
  const added = _scratchItems.length - before;
  const last = _scratchItems[_scratchItems.length - 1];
  if (added !== 1 || !last || !last.id) {
    return { ok: false, code: 'NOT_PERSISTED', message: '스크래치에 실제로 들어가지 않았습니다(되읽기 실패).' };
  }
  const check = window._scratchGetItemById(last.id);
  if (!check || check.src !== src) {
    return { ok: false, code: 'NOT_PERSISTED', message: '스크래치 되읽기 불일치 — 저장이 반영되지 않았습니다.' };
  }
  return { ok: true, scratchId: last.id, x, y, width: W };
};

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

  const { x: startX, y: startY } = window._scratchNextSlot({ newColumn: true });
  const WIDTH = SCRATCH_PLACE.WIDTH, GAP_Y = SCRATCH_PLACE.GAP_Y;

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
window.flushScratchForSwitch = flushScratchForSwitch;
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
// id(선택): 삭제 undo 등 '복원' 경로에서 원본 id 유지용 (Codex 리뷰 — id가 바뀌면
//           이동/리사이즈 history의 지오메트리 스냅샷이 아이템을 못 찾아 undo 체인이 끊김)
/* ★A1 — 선택상자의 캔버스 대상: 섹션 + 섹션 안 «최상위» 블럭 + 섹션에 떠 있는 블럭.
   el = 고를 것(toggleBlockSelect 가 받는 것) · box = 잴 상자(글자는 래퍼가 보이는 상자다). 갭은 뺀다(보이지 않는 여백).
   숨은 것(숨은 시안 = display:none 포함)은 «렌더 면적 0» 으로 시작 캐시에서 거른다 — 숨김 술어를 베끼지 않는다
   (⛔variant-ship-leak V4: 술어를 아는 파일 명부는 «배송·표시» 셋뿐이어야 한다).
   ⚠️합쳐 넣은 상자(.section-merged-part) «안»의 블럭은 이번 판에선 대상이 아니다(상자째 섹션의 몸이라 — 보고에 적음). */
function _marqueeCanvasTargets() {
  const out = [];
  const live = (el) => !!el && el.isConnected !== false;
  document.querySelectorAll('#canvas > .section-block').forEach(sec => {
    if (!live(sec)) return;
    out.push({ kind: 'section', el: sec, sec, box: sec });
    const add = (el, box) => { if (el && live(el) && !el.classList.contains('gap-block')) out.push({ kind: 'block', el, sec, box: box || el }); };
    const inner = sec.querySelector(':scope > .section-inner');
    [...(inner?.children || [])].forEach(ch => {
      if (ch.classList.contains('row')) {
        ch.querySelectorAll(':scope > *, :scope > .col > *').forEach(b => { if (window.hasPanelForBlock?.(b)) add(b); });
      } else if (ch.matches?.('.frame-block[data-text-frame="true"]')) add(ch.querySelector(':scope > .text-block'), ch);
      else if (ch.classList.contains('frame-block') || window.hasPanelForBlock?.(ch)) add(ch);
    });
    [...sec.children].forEach(ch => {      // 섹션에 떠 있는 것(오버레이·줌)
      if (ch.matches?.('[data-overlay-block="true"][data-text-frame="true"]')) add(ch.querySelector(':scope > .text-block'), ch);
      else if (ch.matches?.('[data-overlay-block="true"], .zoom-block')) add(ch);
    });
  });
  return out;
}

/* C1 — 에셋 블럭을 스크래치로 «이동»(위 drop 이 부른다). 성공하면 새 항목, 아니면 null. */
function _moveAssetToScratch(ab, clientX, clientY) {
  if (ab.dataset.assetType === 'video-pending') { window.showToast?.('⚠️ 영상 확정 전 에셋은 옮길 수 없어요'); return null; }
  const src = ab.dataset.imgSrc || ab.querySelector('.asset-img')?.getAttribute('src');
  if (!src) { window.showToast?.('⚠️ 이미지가 없는 에셋은 스크래치로 옮길 수 없어요'); return null; }
  const fx = window.captureAssetFx?.(ab) || undefined;
  const scalerEl = document.getElementById('canvas-scaler');
  if (!scalerEl) return null;
  const scale = _getScale();
  const r = scalerEl.getBoundingClientRect();
  /* 폭은 우클릭 「스크래치로 보내기」(block-factory.js — 400)와 같은 상한. 에셋 폭(전폭 860)을 그대로 쓰면 스크래치 항목이
     캔버스를 덮어 다시 집기 어렵다(실측: 되살린 항목 가운데를 누르면 섹션이 눌렸다). 두 길이 다른 크기를 내지 않게 맞춘다. */
  const w = Math.min(400, Math.round(ab.offsetWidth) || 220);
  const x = Math.round((clientX - r.left) / scale - w / 2);
  const y = Math.round((clientY - r.top) / scale - 20);
  const item = _createItem(src, x, y, w, undefined, undefined, undefined, fx);
  if (!item) return null;
  // 캔버스에서 뺀다 — 그 블럭만 든 row 면 row 째(빈 row 를 남기지 않는다)
  const row = ab.closest('.row');
  const unit = (row && [...row.querySelectorAll('*')].filter(el => window.hasPanelForBlock?.(el)).length === 1) ? row : ab;
  unit.remove();
  _saveScratch();
  window.buildLayerPanel?.();
  window.triggerAutoSave?.();
  const id = item.id;
  try {
    window.pushHistory?.('에셋 → 스크래치로 이동', {
      onUndo: async () => { try { await window._scratchRemoveById?.(id); } catch (_) {} },
      onRedo: async () => { try { await window._scratchAddAndSaveFx?.(src, x, y, w, undefined, id, fx); } catch (_) {} },
    });
  } catch (_) {}
  window.showToast?.('📋 스크래치로 옮겼어요 — 이미지 효과도 같이 갑니다 (⌘Z 되돌리기)');
  return item;
}
window._moveAssetToScratch = _moveAssetToScratch;

/* C1 — 효과(fx)째 되살리는 저장 입구. ⛔_scratchAddAndSave(아래)는 «동결»이다(tests/unit/scratch-paste-dup T-U1-3b ·
   그 함수의 linkDy 누락은 별건 BL-SPL-01). 그래서 인자를 늘리지 않고 이 입구를 따로 둔다 — fx 를 실어야 하는 복원만 이걸 쓴다. */
window._scratchAddAndSaveFx = async (src, x, y, w, g, id, fx) => {
  _createItem(src, x, y, w, id, g, undefined, fx);
  await _saveScratch();
};

window._scratchAddAndSave = async (src, x, y, w, g, id) => {
  _createItem(src, x, y, w, id, g);
  await _saveScratch();
};

/* ── #16 「링크된 섹션을 붙여넣으면 스크래치도 같이 복제」 (scratchpad-link.js 가 부른다) ──
 *
 * ★왜 «동기»인가 — pasteClipboard 는 동기이고 «끝에서» pushHistory 로 캔버스 스냅샷을 찍는다.
 *   사본 생성이 async 면 그 스냅샷 시점에 새 scratchId 가 아직 없어 refLinks 에 쓸 수가 없다.
 *   영속화는 _scratchSaveSoon(디바운스)에 맡긴다 — 붙여넣기가 IndexedDB 왕복을 기다릴 이유가 없다
 *   (_applyFollow 도 같은 구조로 돈다).
 *
 * ★왜 «둘»인가 — redo 시점엔 원본 스크래치가 이미 지워졌을 수 있다. srcId 로는 못 되살린다.
 *   그래서 라이브 경로(_scratchDuplicateItem)와 복원 경로(_scratchRestoreItem)가 갈린다.
 *
 * ★반환값은 «뜻»을 갖는다(_scratchDeleteForMcp 의 {ok,code,message} 어휘를 빌린다) —
 *   NO_SOURCE(정상 갈래: 다른 페이지·이미 삭제·아직 로드 전)와 NO_SCALER(결함: 만들다 실패)는
 *   부르는 쪽 처분이 «같아도»(토큰 유지) 소리가 달라야 한다. null 하나로 뭉치면 그 구분이 죽는다.
 *
 * ⛔픽셀을 새로 만들지 않는다 — src 문자열을 «그대로» 공유한다. 재인코딩하면 해시가 달라져
 *   assets:saveCanvasImage 의 sha256 dedup(main.js)이 깨지고 디스크가 진짜로 2배가 된다.
 * ⛔g(그룹)는 안 베낀다 — 사본이 원본 그룹에 들어가면 그룹 리사이즈가 둘을 함께 움직이고
 *   _scratchUngroup 의 _severLinks 가 «둘의» 링크를 다 끊는다. 사본은 새 섹션에 딸린 독립 재료다.
 */
window._scratchDuplicateItem = (srcId, { dx = 0, dy = 0 } = {}) => {
  if (!srcId || typeof srcId !== 'string') return { ok: false, code: 'BAD_ARGS', message: 'srcId required' };
  const it = _scratchItems.find(s => s.id === srcId);
  if (!it) return { ok: false, code: 'NO_SOURCE', message: 'scratch item not found: ' + srcId };
  const src = it.src;
  const item = _createItem(src, (it.x || 0) + dx, (it.y || 0) + dy, it.w, undefined, undefined, it.linkDy);
  if (!item) return { ok: false, code: 'NO_SCALER', message: '#canvas-scaler not found — 사본 생성 실패' };
  try { window._scratchSaveSoon?.(); } catch (_) {}
  return { ok: true, item: { id: item.id, src: item.src, x: item.x, y: item.y, w: item.w, linkDy: item.linkDy } };
};

/* onRedo 전용 — 기록해 둔 레코드로 «id·linkDy 를 그대로» 되살린다.
 * ★새 id 를 뽑으면 안 된다 — redo 로 되돌아온 캔버스 스냅샷의 refLinks 토큰이 그 id 를 부른다.
 *   (_deleteScratchItemsWithHistory 가 같은 이유로 id 보존을 못 박아 뒀다.) */
window._scratchRestoreItem = (rec) => {
  if (!rec || typeof rec.id !== 'string') return { ok: false, code: 'BAD_ARGS', message: 'rec.id required' };
  if (_scratchItems.some(s => s.id === rec.id)) return { ok: true, code: 'ALREADY' };
  const item = _createItem(rec.src, rec.x, rec.y, rec.w, rec.id, undefined, rec.linkDy);
  if (!item) return { ok: false, code: 'NO_SCALER', message: '#canvas-scaler not found — 복원 실패' };
  try { window._scratchSaveSoon?.(); } catch (_) {}
  return { ok: true };
};

// AI fill 모달 등 외부에서 #sp_xxx ID로 src 조회용
window._scratchGetItemById = id => {
  const it = _scratchItems.find(s => s.id === id);
  return it ? { id: it.id, src: it.src } : null;
};

// ── #16 follow(연결된 참고이미지가 섹션을 따라 y 이동) 용 최소 접근자 ──
//   추종 «로직»은 scratchpad-link.js 소관. 여기선 모델 접근 + 디바운스 저장만 내준다.
//   ★프레임마다 _saveScratch()를 부르면 IndexedDB가 폭주 → 반드시 디바운스 경유.
window._scratchItemById = id => _scratchItems.find(s => s.id === id) || null;

let _saveSoonTimer = null;
window._scratchSaveSoon = (delay = 400) => {
  if (_saveSoonTimer) clearTimeout(_saveSoonTimer);
  _saveSoonTimer = setTimeout(() => { _saveSoonTimer = null; try { _saveScratch(); } catch (_) {} }, delay);
};

// ── Phase 1(마켓 동기화): 프로젝트 전 페이지 스크래치 export/import ──
// export: 현재 페이지 미저장분 flush 후, pageIds를 진실소스로 전 페이지 IndexedDB 항목 수집.
//   반환 [{ pageId, items:[{src,x,y,w,id}] }] (빈 페이지 제외). pageIds 미지정 시 현재 페이지만.
window._scratchExportAll = async (projectId, pageIds) => {
  if (!projectId) return [];
  try { await _saveScratch(); } catch (_) {}   // 현재 페이지 in-memory분 영속화
  const db = await _openDB();
  const ids = Array.isArray(pageIds) && pageIds.length ? pageIds : (_currentPageId ? [_currentPageId] : []);
  const out = [];
  for (const pageId of ids) {
    const key = `scratch-pad-${projectId}-${pageId}`;
    const items = await new Promise((resolve) => {
      const tx = db.transaction(SCRATCH_STORE, 'readonly');
      const req = tx.objectStore(SCRATCH_STORE).get(key);
      req.onsuccess = e => resolve(e.target.result || []);
      req.onerror   = () => resolve([]);
    });
    if (items && items.length) out.push({ pageId, items });
  }
  return out;
};

// import: pull로 받은 스크래치 블록을 newProjectId 키로 복원(페이지id 보존 — 키가 projectId로 네임스페이스라 충돌無).
window._scratchImportAll = async (newProjectId, scratchBlock) => {
  if (!newProjectId || !Array.isArray(scratchBlock) || !scratchBlock.length) return 0;
  const db = await _openDB();
  let n = 0;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SCRATCH_STORE, 'readwrite');
    const store = tx.objectStore(SCRATCH_STORE);
    for (const { pageId, items } of scratchBlock) {
      if (!pageId || !Array.isArray(items) || !items.length) continue;
      // ⚠️linkDy 는 빼 왔다(옛 동작 그대로 — 가져온 새 프로젝트엔 그 섹션 연결이 없다는 판단으로 보인다, 까닭 기록 없음)
      const clean = items.map(it => _pickScratch(it, ['linkDy']));
      store.put(clean, `scratch-pad-${newProjectId}-${pageId}`);
      n++;
    }
    tx.oncomplete = () => resolve();
    tx.onerror    = e => reject(e.target.error);
  });
  return n;
};

// ════════════════════════════════════════════════════════════════════════
// [#16-C] 스크래치패드 «일괄 숨기기» — 산만할 때 화면에서만 치운다
//
// ⛔데이터는 «절대» 안 건드린다. _scratchRemoveById / _scratchAddAndSave 호출 0.
//   IndexedDB(ScratchPadDB)도, 섹션의 data-ref-links(연결)도 그대로다.
//   하는 일은 body 클래스 토글 하나 → css/editor-canvas.css 의 display:none 한 줄.
//
// ★상태는 «세션 한정»이다(저장 안 함). 왜:
//   숨김은 「지금 이 순간 산만하다」는 일시적 요구지 프로젝트의 속성이 아니다.
//   저장해 두면 며칠 뒤 프로젝트를 연 사람이 «빈 캔버스»를 보고 「참고 이미지가 날아갔다」고
//   읽는다 — 실제로 데이터는 멀쩡한데도. 「없다」와 「안 보인다」를 사용자가 구분할 수 있는
//   유일한 보증이 「껐다 켜면 돌아온다」이므로, 껐다 켜면 «항상» 보이는 쪽을 택했다.
//   (원하면 나중에 settings 키 하나로 승격 가능하지만, 그건 별건 게이트다.)
//
// ★연결선(#16-B)은 여기서 «따로» 끄지 않는다 — 끄면 사용자의 환경설정 값을 덮어쓴다.
//   숨겨진 아이템의 rect 가 0×0 이라 scratchpad-link 의 «0×0 건너뛰기»가 알아서 감춘다.
//   즉시 반영을 위해 __spLinkRelayout 만 한 번 두드린다(rAF 루프가 없을 때 대비).
// ════════════════════════════════════════════════════════════════════════
let _scratchHiddenAll = false;

window.isScratchHiddenAll = () => _scratchHiddenAll;

window.toggleScratchHideAll = (force) => {
  const next = (force === undefined) ? !_scratchHiddenAll : !!force;
  _scratchHiddenAll = next;
  document.body.classList.toggle('scratch-hidden-all', next);
  _syncScratchHideAllLabel();
  // 연결선 즉시 재계산(허공 선 방지). 링크 0이면 rAF 루프가 안 도니 여기서 한 번 그린다.
  try { window.__spLinkRelayout?.(); } catch (_) {}
  // ⛔네이티브 alert 로 «폴백» 시키지 마라 — showToast 는 undefined 를 반환해서 그 폴백이 항상 터지고, 그 alert 이 렌더러를 얼린다.
  window.showToast?.(next
    ? '🙈 스크래치패드를 숨겼습니다 (데이터는 그대로)'
    : '👁 스크래치패드를 다시 표시합니다');
  return next;
};

// 메뉴 항목의 «라벨»이 현재 상태를 말하게 한다 — 누르기 전에 무슨 일이 날지 보여야 한다.
function _syncScratchHideAllLabel() {
  const el = document.getElementById('scratch-hide-all-label');
  if (el) el.textContent = _scratchHiddenAll ? '참고 이미지 다시 보기' : '참고 이미지 일괄 숨기기';
}

// ── 스크래치 그룹화 (Cmd+G — editor.js 단축키 분기) ──────
// 다중 선택된 스크래치들에 data-scratch-group만 박음 — 위치/크기는 보이는 그대로 불변.
// 같은 그룹은 시각적 묶음 (향후 함께 이동 등 확장 가능).
window._scratchHasSelection = () => _selectedItems.size >= 2;

// 그룹/언그룹 undo·redo용 지오메트리 스냅샷 헬퍼 (Codex 리뷰 — Cmd+G가 history에 안 남던 버그)
// snap = [{id, x, y, w, g}] — id로 살아있는 아이템을 찾아 x/y/w/g + DOM 스타일 복원 후 저장
const _scratchGeomSnapshot = items => items.map(it => ({ id: it.id, x: it.x, y: it.y, w: it.w, g: it.g, linkDy: it.linkDy }));
function _applyScratchGeomSnapshot(snaps) {
  snaps.forEach(s => {
    const it = _scratchItems.find(i => i.id === s.id);
    if (!it) return; // 이후 삭제된 아이템은 스킵
    it.x = s.x; it.y = s.y; it.w = s.w;
    // #16 follow — 연결 오프셋도 스냅샷 단위로 복원. 안 하면 undo가 좌표만 되돌리고
    //   linkDy는 새 값으로 남아 «다음 섹션 이동»에 엉뚱한 위치로 튄다.
    if (s.linkDy === undefined) delete it.linkDy; else it.linkDy = s.linkDy;
    if (s.g === undefined) { delete it.g; if (it.el) delete it.el.dataset.scratchGroup; }
    else { it.g = s.g; if (it.el) it.el.dataset.scratchGroup = s.g; }
    if (it.el) {
      it.el.style.left  = it.x + 'px';
      it.el.style.top   = it.y + 'px';
      it.el.style.width = it.w + 'px';
    }
  });
  _saveScratch();
  // #16 follow — 복원된 좌표/오프셋을 추종루프의 기준선으로 재동기화(루프가 재앵커로 오인하지 않게)
  try { window.SPLink && window.SPLink.resyncFollow && window.SPLink.resyncFollow(); } catch (_) {}
}

window._scratchGroupAndAlign = () => {
  if (_selectedItems.size < 2) return { ok: false, msg: '2개 이상 선택 필요' };
  const items = [...(_selectedItems)];
  // 그룹 id (이미 그룹 있으면 재사용 — 첫 아이템 기준)
  const groupId = items[0].g || items[0].el?.dataset?.scratchGroup || ('g_' + Math.random().toString(36).slice(2, 8));
  const before = _scratchGeomSnapshot(items); // undo용 사전 스냅샷
  // 보이는 그대로 그룹 — 위치/크기는 건드리지 않고 g만 부여 (그리드 재배치 제거)
  items.forEach(it => {
    it.g = groupId; // 직렬화 대상 — 리로드 후에도 그룹 유지
    if (it.el) it.el.dataset.scratchGroup = groupId;
  });
  _saveScratch();
  // 글로벌 history에 sideEffects entry — 캔버스는 동일 스냅샷, onUndo/onRedo가 스크래치만 복원
  const after = _scratchGeomSnapshot(items);
  try {
    window.pushHistory?.('스크래치 그룹', {
      onUndo: () => _applyScratchGeomSnapshot(before),
      onRedo: () => _applyScratchGeomSnapshot(after),
    });
  } catch (_) {}
  window.showToast?.(`🧩 스크래치 ${items.length}개 그룹 설정`);
  return { ok: true, count: items.length, groupId };
};

/* ══ 한 아이템을 «지정한 자리»로 스르륵 옮긴다 (현빈 2026-09-30, 연결선 더블클릭 당기기) ══
 * ★왜 이 파일에 있나 — 자리·저장·되돌리기는 «스크래치의 것»이다. 부르는 쪽
 *   (js/scratchpad-link.js 의 연결선 더블클릭)은 «어디로»만 정한다.
 *   ⛔사본을 그쪽에 만들지 마라: _scratchGeomSnapshot 규약이 두 벌이 되고, 그 헬퍼 머리말이
 *     적어 둔 «undo 가 linkDy 를 놓쳐 다음 섹션 이동에 엉뚱한 자리로 튀던» 버그가 그쪽에서
 *     되살아난다. 되돌리기 규약은 이 집에 «하나»만 있다.
 * ★연결선은 따로 안 그린다 — SPLink 의 rAF 루프가 매 프레임 다시 그리므로, 이미지가 움직이면
 *   선이 «같이 짧아지는» 것은 공짜다.
 * ★이미 그 자리면 «아무 일도 안 한다» — 히스토리도 안 쌓는다(현빈 「또 더블클릭하면 아무 일 없음」).
 * ⚠️트윈 중에 ⌘Z 가 오면 트윈이 복원값을 덮어쓴다 ⇒ onUndo/onRedo 가 먼저 트윈을 «세운다».
 * @param {string} id 아이템 id
 * @param {number} x scaler-local px · @param {number} y scaler-local px
 * @param {{label?:string, linkDy?:number, ms?:number}} [opts] linkDy = 옮긴 뒤 섹션 추종 기준
 * @returns {{ok:boolean, moved?:boolean, reason?:string}}
 */
window._scratchAnimateItemTo = (id, x, y, opts = {}) => {
  const it = _scratchItems.find(i => i.id === id);
  if (!it || !it.el) return { ok: false, reason: 'NOT_FOUND' };
  /* ⛔`it.x || parseFloat(...)` 금지 — x=0 은 «유효한 자리»다(왼쪽 끝). ?? 로 가른다. */
  const x0 = it.x ?? (parseFloat(it.el.style.left) || 0);
  const y0 = it.y ?? (parseFloat(it.el.style.top) || 0);
  const nx = Math.round(x), ny = Math.round(y);
  if (Math.abs(nx - x0) < 1 && Math.abs(ny - y0) < 1) return { ok: true, moved: false };

  const before = _scratchGeomSnapshot([it]);
  const stop = () => { if (it._tweenRAF) { cancelAnimationFrame(it._tweenRAF); it._tweenRAF = null; } };
  stop();                                  // 연달아 부르면 «마지막 목표»로 간다
  const ms = Number.isFinite(opts.ms) ? Math.max(0, opts.ms) : 220;
  const t0 = performance.now();
  const ease = (p) => 1 - Math.pow(1 - p, 3);          // ease-out cubic
  const settle = () => {
    it.x = nx; it.y = ny;
    it.el.style.left = nx + 'px'; it.el.style.top = ny + 'px';
    if (Number.isFinite(opts.linkDy)) it.linkDy = opts.linkDy;
    _saveScratch();
    // #16 follow — 추종루프가 이 이동을 «사용자 드래그»로 오인해 재앵커하지 않게 기준선을 맞춘다
    try { window.SPLink && window.SPLink.resyncFollow && window.SPLink.resyncFollow(); } catch (_) {}
  };
  const step = () => {
    const p = ms === 0 ? 1 : Math.min(1, (performance.now() - t0) / ms);
    const k = ease(p);
    it.x = Math.round(x0 + (nx - x0) * k);
    it.y = Math.round(y0 + (ny - y0) * k);
    it.el.style.left = it.x + 'px'; it.el.style.top = it.y + 'px';
    if (p < 1) { it._tweenRAF = requestAnimationFrame(step); return; }
    it._tweenRAF = null;
    settle();
  };
  if (ms === 0) settle(); else step();

  /* 히스토리는 «목표값»으로 찍는다 — 트윈 중간값이 아니다(중간에 ⌘Z 해도 목표로 redo 된다). */
  const after = _scratchGeomSnapshot([it]).map(sn => ({
    ...sn, x: nx, y: ny,
    ...(Number.isFinite(opts.linkDy) ? { linkDy: opts.linkDy } : {}),
  }));
  try {
    window.pushHistory?.(opts.label || '스크래치 이동', {
      onUndo: () => { stop(); _applyScratchGeomSnapshot(before); },
      onRedo: () => { stop(); _applyScratchGeomSnapshot(after); },
    });
  } catch (_) {}
  return { ok: true, moved: true };
};

// 선택 중 그룹(g) 달린 아이템 존재 여부 — Cmd+Shift+G 라우팅용 (editor.js ungroup 분기)
window._scratchHasGroupSelection = () =>
  [..._selectedItems].some(it => it.g || it.el?.dataset?.scratchGroup);

// 스크래치 언그룹 — 선택된 아이템들의 그룹 해제 (Cmd+Shift+G)
/* ── 링크(섹션 연결) 끊기 헬퍼 ───────────────────────────────────────────
 * ⚠️SPLink.removeLink() 를 쓰지 «않는다». 그건 호출마다 pushHistory 를 따로 쌓고
 *   앵커(linkDy)를 버려서, 여러 개를 한꺼번에 끊으면 undo 가 N번으로 쪼개지고
 *   되돌려도 오프셋이 사라진다. 여기선 dataset 을 직접 고쳐 «한 번의» undo 로 묶는다.
 *   linkDy 복원은 _applyScratchGeomSnapshot 이 이미 해준다. */
function _severLinks(ids) {
  const SP = window.SPLink;
  if (!SP || !SP._parse || !SP._write || !SP.sectionIdOf) return [];
  const removed = [];
  ids.forEach(id => {
    const secId = SP.sectionIdOf(id);
    if (!secId) return;                       // 연결 안 돼 있으면 할 일 없음
    const sec = document.getElementById(secId);
    if (!sec) return;
    const arr = SP._parse(sec);
    const link = arr.find(l => l.scratchId === id);
    if (!link) return;
    SP._write(sec, arr.filter(l => l.scratchId !== id));
    removed.push({ secId, link });
  });
  if (removed.length) SP.rerender?.();
  return removed;
}
function _restoreLinks(removed) {
  const SP = window.SPLink;
  if (!SP || !SP._parse || !SP._write) return;
  removed.forEach(({ secId, link }) => {
    const sec = document.getElementById(secId);
    if (!sec) return;
    const arr = SP._parse(sec);
    if (arr.some(l => l.scratchId === link.scratchId)) return;   // 이미 있으면 중복 금지
    arr.push(link);
    SP._write(sec, arr);
  });
  if (removed.length) SP.rerender?.();
}

window._scratchUngroup = () => {
  const items = [..._selectedItems].filter(it => it.g || it.el?.dataset?.scratchGroup);
  if (!items.length) return { ok: false, msg: '그룹 아이템 없음' };
  const before = _scratchGeomSnapshot(items); // undo용 사전 스냅샷 (g·linkDy 복원)
  items.forEach(it => {
    delete it.g;
    if (it.el) delete it.el.dataset.scratchGroup;
  });
  /* ★그룹을 풀면 «섹션 연결»도 같이 끊는다.
   * 안 그러면 그룹만 풀리고 refLinks 는 남아 _applyFollow 의 rAF 루프가
   * 계속 y = secTop + linkDy 를 다시 먹여, 「해제했는데 여전히 같이 움직인다」가 된다.
   * 그룹(6~7월)과 링크(#16, 8월)가 7주 시차로 따로 만들어져 서로를 몰랐다. */
  const severed = _severLinks(items.map(it => it.id));
  _saveScratch();
  const after = _scratchGeomSnapshot(items);
  try {
    window.pushHistory?.('스크래치 그룹 해제', {
      onUndo: () => { _restoreLinks(severed); _applyScratchGeomSnapshot(before); },
      onRedo: () => { _severLinks(severed.map(r => r.link.scratchId)); _applyScratchGeomSnapshot(after); },
    });
  } catch (_) {}
  window.showToast?.(severed.length
    ? `🧩 스크래치 그룹 해제 (${items.length}개) · 섹션 연결 ${severed.length}개도 끊음`
    : `🧩 스크래치 그룹 해제 (${items.length}개)`);
  return { ok: true, count: items.length, unlinked: severed.length };
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

// ── 외부 API (MCP delete_scratch_item) ───────────────────────────────────────
// INV-B3/B1 결손 #5 — put_image/add_asset_block(scratchId)로 넣기만 되고 MCP 스스로
// 치우지는 못했다. 기존 _scratchRemoveById(canvas-scratch-drop.js가 드롭 성공 후 쓰던
// 내부 헬퍼) 그대로 재사용 — 새 삭제 로직을 만들지 않고 ok/code 형태만 MCP 규약에 맞춘다.
// ★스크래치는 프로젝트 캔버스 직렬화 밖(IndexedDB 별도, 파일 상단 주석)이라 undo history
//   대상이 아니다 — pushHistory 불필요(기존 _scratchRemoveById도 안 부름).
window._scratchDeleteForMcp = async (id) => {
  if (!id || typeof id !== 'string') return { ok: false, code: 'BAD_ARGS', message: 'id required' };
  const it = _scratchItems.find(s => s.id === id);
  if (!it) return { ok: false, code: 'NOT_FOUND', message: 'scratch item not found: ' + id };
  const removed = { id: it.id, x: it.x, y: it.y, w: it.w };
  const ok = await window._scratchRemoveById(id);
  return ok ? { ok: true, scratchId: id, item: removed }
            : { ok: false, code: 'REMOVE_FAILED', message: 'remove failed: ' + id };
};

// ── 외부 API (MCP update_scratch_item) ───────────────────────────────────────
// INV-B3/B1 결손 #5 짝 — 좌표(x/y) · 폭(w) 재배치만 지원한다(★src 교체는 범위 밖 —
// add_asset_block/update_asset_block의 scratchId 경로가 이미 "스크래치→캔버스로 붙이기"를
// 담당하므로, 스크래치 자체의 이미지 내용 교체는 이번 결손표에 없던 별도 기능이다).
window._scratchUpdateForMcp = async (id, { x, y, w } = {}) => {
  if (!id || typeof id !== 'string') return { ok: false, code: 'BAD_ARGS', message: 'id required' };
  const it = _scratchItems.find(s => s.id === id);
  if (!it) return { ok: false, code: 'NOT_FOUND', message: 'scratch item not found: ' + id };
  const hasX = typeof x === 'number' && Number.isFinite(x);
  const hasY = typeof y === 'number' && Number.isFinite(y);
  const hasW = typeof w === 'number' && Number.isFinite(w);
  if (!hasX && !hasY && !hasW) {
    return { ok: false, code: 'BAD_ARGS', message: 'no fields to update — provide at least one of x/y/w' };
  }
  if (hasX) it.x = x;
  if (hasY) it.y = y;
  if (hasW) it.w = w;
  if (it.el) {
    if (hasX) it.el.style.left = it.x + 'px';
    if (hasY) it.el.style.top = it.y + 'px';
    if (hasW) it.el.style.width = it.w + 'px';
  }
  await _saveScratch();
  return { ok: true, scratchId: id, x: it.x, y: it.y, w: it.w };
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
      // ★[T-049 후속] 폴더 «이름»도 사용자가 적는 값 — 항상 문자로 넣는다(마크업이 될 수 없게).
      btn.innerHTML = `<span style="opacity:0.6;">📁</span> `;
      btn.appendChild(document.createTextNode(f.name || '(이름 없음)'));
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

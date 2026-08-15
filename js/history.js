/* ══════════════════════════════════════
   HISTORY — Undo/Redo 히스토리 시스템
   (editor.js에서 분리, 2025-03-31)
══════════════════════════════════════ */
import { state } from './globals.js';

/* ── 상태 변수 ── */
const MAX_HISTORY = 50;
let historyStack = [];
let historyPos   = -1;
let _historyPaused = false;
// D1: 페이지별 히스토리 저장맵. 라이브 스택(historyStack/historyPos)은 그대로 두고,
// 페이지를 떠날 때만 여기에 스냅샷을 보관/복원하는 보조 저장소로 사용.
const pageHistories = new Map(); // pageId -> { stack, pos }

/* ── 협업 undo 스코프용: «이 체크포인트 이후 도착한 원격 패치»의 섹션 키 수집 ──
 * sync.js applyPatch 가 «실제 적용 성공 시»에만 쏘는 gd:collab-remote-applied 를 듣고
 * 'pageId::secId' 를 누적한다. 새 히스토리 항목을 만들 때(pushHistory·ensureHistoryCheckpoint
 * «양쪽») remoteKeys 로 «드레인»(비우고 항목에 귀속)해, 그 항목이 담는 diff 중 원격 기여분을
 * 스코프 undo 가 제외할 수 있게 한다. 협업 비활성이면 이벤트가 안 와 항상 빈 셋 → 회귀 0.
 * (드레인=누적분을 항목에 옮기고 셋을 새로 시작 — 항목마다 «그 구간의 원격분»만 담기게.) */
let _remoteSinceCheckpoint = new Set();
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('gd:collab-remote-applied', (e) => {
    const k = e && e.detail && e.detail.key;
    if (k) _remoteSinceCheckpoint.add(k);
  });
}
function _drainRemoteKeys() {
  const s = _remoteSinceCheckpoint;
  _remoteSinceCheckpoint = new Set();
  return s;
}

function pushHistory(action = '작업', sideEffects = null) {
  if (_historyPaused) return;
  historyStack = historyStack.slice(0, historyPos + 1);
  // sideEffects: { onUndo?: fn, onRedo?: fn } — DOM 외 상태(예: 스크래치패드 IDB) 복원용
  // remoteKeys: 직전 체크포인트 이후 적용된 원격 섹션 키 셋(스코프 undo 가 제외에 사용)
  historyStack.push({ canvas: window.getSerializedCanvas(), settings: { ...state.pageSettings }, action, pageId: state.currentPageId, sideEffects, remoteKeys: _drainRemoteKeys() });
  if (historyStack.length > MAX_HISTORY) {
    historyStack.shift(); // 가장 오래된 항목 제거
    historyPos = MAX_HISTORY - 1; // shift로 인덱스가 당겨지므로 포인터 보정
  } else {
    historyPos++;
  }
  _updateUndoRedoBtns();
}

function _updateUndoRedoBtns() {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  if (undoBtn) {
    const canUndo = historyPos > 0;
    undoBtn.disabled = !canUndo;
    undoBtn.title = canUndo ? `실행 취소: ${historyStack[historyPos].action}` : '실행 취소 없음';
  }
  if (redoBtn) {
    const canRedo = historyPos < historyStack.length - 1;
    redoBtn.disabled = !canRedo;
    redoBtn.title = canRedo ? `다시 실행: ${historyStack[historyPos + 1]?.action || ''}` : '다시 실행 없음';
  }
}

function restoreSnapshot(snap) {
  _historyPaused = true;
  // innerHTML 교체가 autoSaveObserver(MutationObserver→scheduleAutoSave)를 발화시켜
  // 복원 도중(rebindAll/applyPageSettings 중간 DOM)에 부분 상태가 저장되는 레이스를 봉쇄.
  // switchPage / applyProjectData와 동일 가드. (DBG-SEC-LOSS)
  state._suppressAutoSave = true;
  // ★C2-A9: 봉쇄구간(innerHTML/rebindAll/applyPageSettings)에서 «예외»가 나도 두 가드를
  // 반드시 해제하도록 try/finally로 감싼다. 안 그러면 예외 시 _historyPaused·_suppressAutoSave가
  // 영구 고착 → 이후 모든 편집이 히스토리 체크포인트도 자동저장도 못 남기고 undo 전면 무동작
  // + 데이터 유실(치명③, 재기동 시 소실). 예외 자체는 삼키지 않고 그대로 전파한다.
  try {
    // 페이지가 다르면 현재 페이지 flush 후 대상 페이지로 전환
    if (snap.pageId && snap.pageId !== state.currentPageId) {
      if (window.flushCurrentPage) window.flushCurrentPage();
      state.currentPageId = snap.pageId;
      const page = state.pages?.find(p => p.id === snap.pageId);
      if (page?.pageSettings) Object.assign(state.pageSettings, page.pageSettings);
      if (window.buildFilePageSection) window.buildFilePageSection();
    }
    Object.assign(state.pageSettings, snap.settings);
    const canvasEl = document.getElementById('canvas');
    canvasEl.innerHTML = snap.canvas;
    window.rebindAll();
    window.deselectAll();
    window.applyPageSettings();
    if (window.buildLayerPanel) window.buildLayerPanel();
    window.deselectAll();
  } finally {
    // ★가드 해제를 UI 갱신보다 «먼저» — 아래 _updateUndoRedoBtns/gdtFontPaintBadge가
    // 던져도 두 플래그는 이미 안전하게 풀린 상태가 되도록.
    _historyPaused = false;
    // _suppressAutoSave는 한 프레임 뒤 해제 — MutationObserver는 microtask 후 발화하므로
    // 동기 해제 시 잔여 mutation이 새어 부분저장을 유발. (applyProjectData와 동일 패턴)
    requestAnimationFrame(() => { state._suppressAutoSave = false; });
    _updateUndoRedoBtns();
    // 캔버스가 통째로 바뀌었으니 「없는 글꼴」 표시도 다시 센다 —
    // 안 하면 ⌘Z로 대체를 되돌린 뒤에도 상단바가 「대체됨」이라고 거짓말한다(실측 2026-08-08).
    window.gdtFontPaintBadge?.();
  }
}

/* ════════════════════════════════════════════════════════════════════════
   협업 «로컬 스코프» undo/redo (P4) — C8 치명① 근본수정
   ────────────────────────────────────────────────────────────────────────
   설계: PLAN §3~§5. 협업 활성 + 같은 페이지일 때, undo/redo 를 «캔버스 전체 교체»가
   아니라 «내가 바꾼 섹션만» 되돌린다. 상대가 바꾼 섹션(remoteKeys·라이브 가드)은
   서버 최신 그대로 두어, 그 섹션이 재저장→재전파로 상대 디스크에서 삭제되는 harm 을
   원천 차단한다(sync.js pushChanged 는 무수정 — 내 섹션만 DOM 이 바뀌어 그것만 push).
   비협업/킬스위치 off/크로스페이지는 기존 restoreSnapshot 경로 그대로(바이트 동일).
════════════════════════════════════════════════════════════════════════ */

// 검증 계측(§7): 비협업 시 스코프 도달 0회를 CDP 로 확인. 스킵/최근 diff 노출.
const _collabScopedUndoStats = { scopedCalls: 0, fullCalls: 0, lastSkipped: 0, lastDiff: null };
if (typeof window !== 'undefined') window._collabScopedUndoStats = _collabScopedUndoStats;

/* 킬스위치(R7): 기본 on. window._collabScopedUndo===false 또는
 * localStorage 'goditor.collabScopedUndo'∈{'0','false'} 이면 off → 기존 전체복원(C8 포함) 복귀.
 * off 는 «C8 동작으로 되돌아감»이라 콘솔 경고 1줄을 남긴다. */
function _scopedEnabled() {
  if (typeof window !== 'undefined' && window._collabScopedUndo === false) {
    console.warn('[history] 협업 스코프 undo OFF(window) — 전체복원 경로(C8 동작 포함)로 되돌아간다.');
    return false;
  }
  if (typeof window !== 'undefined' && window._collabScopedUndo === true) return true;
  try {
    const v = localStorage.getItem('goditor.collabScopedUndo');
    if (v === '0' || v === 'false') {
      console.warn('[history] 협업 스코프 undo OFF(localStorage) — 전체복원 경로(C8 동작 포함)로 되돌아간다.');
      return false;
    }
  } catch (_) {}
  return true;
}

/* fromSnap→toSnap 이 «스코프 경로»를 탈 자격이 되나. 하나라도 아니면 false → 기존 full 경로. */
function _useScoped(fromSnap, toSnap) {
  if (!_scopedEnabled()) return false;
  const cs = (typeof window !== 'undefined') ? window.collabSync : null;
  if (!cs || typeof cs.isActive !== 'function' || !cs.isActive()) return false;   // 비협업/킬스위치(COLLAB) 존중
  if (!window.historyDiff || typeof window.historyDiff.diffSnapshots !== 'function') return false;
  if (!fromSnap || !toSnap) return false;
  if (typeof fromSnap.canvas !== 'string' || typeof toSnap.canvas !== 'string') return false;
  // P4: 같은 페이지 + 현재 페이지만. 크로스페이지는 기존 full 경로(P5 에서 좁힘).
  if (!fromSnap.pageId || fromSnap.pageId !== toSnap.pageId) return false;
  if (fromSnap.pageId !== state.currentPageId) return false;
  return true;
}

/* 섹션 단위 스코프 복원(순수 계획 실행). 스킵 건수 반환.
 * 결정 로직은 historyDiff.planScopedUndo(순수함수·단위테스트 대상). 여기선 DOM 수술만 한다.
 * laterSnap = from/to 중 «나중» 항목(undo: leaving=S[n], redo: new=S[n+1]) — 그 항목의
 *   remoteKeys 에 «그 스텝에 낀 원격 기여분»이 기록돼 있다([redo★] 대칭). */
function _applyScopedDiff(fromSnap, toSnap, laterSnap) {
  const HD = window.historyDiff;
  const pageId = toSnap.pageId;
  const canvasEl = document.getElementById('canvas');
  const remoteSet = (laterSnap && laterSnap.remoteKeys instanceof Set) ? laterSnap.remoteKeys : new Set();
  const inCanvas = (id) => { const el = document.getElementById(id); return !!(el && canvasEl.contains(el)); };

  const plan = HD.planScopedUndo(fromSnap.canvas, toSnap.canvas, {
    remoteHas:  (id) => remoteSet.has(pageId + '::' + id),
    // ★같은 재료 비교(R1): 라이브는 serializeSectionClone 세척 후 정규화(sectionGuardHash).
    liveHashOf: (id) => { const el = document.getElementById(id); return (el && canvasEl.contains(el)) ? HD.sectionGuardHash(el) : null; },
    liveExists: inCanvas,
  });

  for (const op of plan.ops) {
    if (op.op === 'remove') {
      const el = document.getElementById(op.id);
      if (el && canvasEl.contains(el)) el.remove();
    } else if (op.op === 'replace') {
      const el = document.getElementById(op.id);
      if (el && canvasEl.contains(el)) el.outerHTML = op.html;
    } else if (op.op === 'insert') {
      const anchor = op.anchorAfterId ? document.getElementById(op.anchorAfterId) : null;
      if (anchor && canvasEl.contains(anchor)) anchor.insertAdjacentHTML('afterend', op.html);
      else canvasEl.insertAdjacentHTML('afterbegin', op.html);   // ⛔전체 재구성 아님 — 맨앞 삽입만
    }
  }

  _collabScopedUndoStats.lastSkipped = plan.skipped;
  _collabScopedUndoStats.lastDiff = { ...plan.diff, skipped: plan.skipped };
  return plan.skipped;
}

/* 스코프 복원 골격 — restoreSnapshot 과 «동일 규율»(C2-A9 try/finally, _historyPaused +
 * _suppressAutoSave, rebindAll 은 _historyPaused=true 라 clearHistory 자동 스킵=C7 별경로).
 * 다만 캔버스 전체가 아니라 diff 섹션만 수술한다. */
function restoreSnapshotScoped(fromSnap, toSnap, laterSnap) {
  _historyPaused = true;
  state._suppressAutoSave = true;
  let skipped = 0;
  try {
    Object.assign(state.pageSettings, toSnap.settings || {});
    skipped = _applyScopedDiff(fromSnap, toSnap, laterSnap);
    window.rebindAll();
    window.deselectAll();
    window.applyPageSettings();
    if (window.buildLayerPanel) window.buildLayerPanel();
    window.deselectAll();
  } finally {
    _historyPaused = false;
    // ★스코프 수술의 mutation 은 suppress 구간에 흡수된다 → 저장을 «명시 예약»해야 결과가
    //   디스크·서버(내 섹션만)에 남는다(B1 교훈). full-restore 와 달리 여긴 명시적으로 건다.
    requestAnimationFrame(() => { state._suppressAutoSave = false; window.scheduleAutoSave?.(); });
    _updateUndoRedoBtns();
    window.gdtFontPaintBadge?.();
    // 스킵 정책은 «침묵하지 않는다»(notifyConflict 철학) — 되돌리지 않은 섹션을 사용자에 알린다.
    if (skipped > 0 && typeof window.showToast === 'function') {
      try { window.showToast(`상대가 수정한 섹션 ${skipped}건은 되돌리지 않았습니다 — 서버 최신을 유지합니다.`); } catch (_) {}
    }
  }
}

function undo() {
  // 스택 끝에서 undo 시작 시 라이브 상태(tip)가 스택에 없으면 먼저 적재 —
  // 없으면 첫 undo가 마지막 액션 이후 상태를 폐기해 redo로도 복원 불가 (DEF-01)
  if (historyPos === historyStack.length - 1) {
    ensureHistoryCheckpoint('현재 상태');
  }
  if (historyPos <= 0) return;
  // 떠나는 snap의 onUndo (예: 스크래치 복원) — 캔버스 복원 *후* 실행해서 DOM 안정 상태에서 처리
  const leavingSnap = historyStack[historyPos];
  historyPos--;
  const targetSnap = historyStack[historyPos];
  // ★스코프 경로: from=leavingSnap(S[n]), to=targetSnap(S[n-1]). remoteKeys 는 «나중» 항목
  //   =leavingSnap(S[n]) 에서 읽는다([redo★] 대칭 — 그 스텝에 낀 원격분이 도착항목에 기록됨).
  if (_useScoped(leavingSnap, targetSnap)) {
    _collabScopedUndoStats.scopedCalls++;
    restoreSnapshotScoped(leavingSnap, targetSnap, leavingSnap);
  } else {
    _collabScopedUndoStats.fullCalls++;
    restoreSnapshot(targetSnap);
  }
  try { leavingSnap?.sideEffects?.onUndo?.(); } catch (e) { console.warn('[history] onUndo err:', e); }
}

function redo() {
  if (historyPos >= historyStack.length - 1) return;
  const currentSnap = historyStack[historyPos];
  historyPos++;
  const newSnap = historyStack[historyPos];
  // ★스코프 경로: from=currentSnap(S[n]), to=newSnap(S[n+1]). remoteKeys 는 «나중»
  //   =newSnap(S[n+1]) 에서 읽는다(redo 방향의 도착항목).
  if (_useScoped(currentSnap, newSnap)) {
    _collabScopedUndoStats.scopedCalls++;
    restoreSnapshotScoped(currentSnap, newSnap, newSnap);
    try { newSnap?.sideEffects?.onRedo?.(); } catch (e) { console.warn('[history] onRedo err:', e); }
    return;
  }
  _collabScopedUndoStats.fullCalls++;
  restoreSnapshot(newSnap);
  try { newSnap?.sideEffects?.onRedo?.(); } catch (e) { console.warn('[history] onRedo err:', e); }
}

function clearHistory() {
  // 초기 상태를 스냅샷으로 저장해 첫 번째 액션도 Undo 가능하게 함
  // 프로젝트 격리: 이전 프로젝트에서 누적된 원격 키 잔량을 버린다(빈 셋으로 초기화).
  _remoteSinceCheckpoint = new Set();
  const init = { canvas: window.getSerializedCanvas(), settings: { ...state.pageSettings }, action: '초기 상태', pageId: state.currentPageId, remoteKeys: new Set() };
  historyStack = [init];
  historyPos   = 0;
  state._canvasDirty = false;
  _updateUndoRedoBtns();
}

/* ── D1: 페이지별 히스토리 헬퍼 ──
   save-load.js의 switchPage/deletePage/applyProjectData가 window.* 로 호출.
   switchPage/load 경로는 _historyPaused가 아니므로 paused 무관하게 동작. */

// 떠나는 페이지의 라이브 스택을 맵에 보관. slice로 얕은 복사해 이후 변이와 격리.
function stashHistoryFor(pageId) {
  if (!pageId) return;
  pageHistories.set(pageId, { stack: historyStack.slice(), pos: historyPos });
}

// 대상 페이지의 보관된 스택을 라이브로 복원. 없으면 현 DOM 기준 초기 스냅샷(clearHistory).
function adoptHistoryFor(pageId) {
  const saved = pageId ? pageHistories.get(pageId) : null;
  if (saved) {
    historyStack = saved.stack.slice(); // 맵 내부 배열 오염 방지
    historyPos   = saved.pos;
    _updateUndoRedoBtns();
  } else {
    clearHistory();
  }
}

// 삭제된 페이지의 stash 정리 (메모리 누수 방지).
function dropHistoryFor(pageId) {
  pageHistories.delete(pageId);
}

// 프로젝트 로드/탭 전환 시 페이지간 히스토리 전부 비워 프로젝트 격리.
function resetAllPageHistory() {
  pageHistories.clear();
}

/**
 * 현재 DOM 상태가 마지막 히스토리 항목과 다를 때만 체크포인트 저장.
 * block-factory.js가 push-before 방식이라 paste/copy 전에 현재 상태가
 * 히스토리에 없는 문제를 해결하기 위한 보조 함수.
 */
function ensureHistoryCheckpoint(action = 'checkpoint') {
  if (_historyPaused) return;
  const current = window.getSerializedCanvas?.();
  if (!current) return;
  if (historyStack[historyPos]?.canvas !== current) {
    historyStack = historyStack.slice(0, historyPos + 1);
    // ★R3: remoteKeys 드레인은 pushHistory 와 «양쪽» 다 — undo 첫 스텝은 ensure 경유로
    //   현재상태를 선적재(DEF-01)하므로 여기서 안 비우면 원격분이 그 항목 diff 에 섞여 C8 재발.
    historyStack.push({ canvas: current, settings: { ...state.pageSettings }, action, pageId: state.currentPageId, remoteKeys: _drainRemoteKeys() });
    if (historyStack.length > MAX_HISTORY) {
      historyStack.shift(); // 가장 오래된 항목 제거
      historyPos = MAX_HISTORY - 1; // shift로 인덱스가 당겨지므로 포인터 보정
    } else {
      historyPos++;
    }
    _updateUndoRedoBtns();
  }
}

/* ── window 노출 ── */
window.pushHistory  = pushHistory;
window.ensureHistoryCheckpoint = ensureHistoryCheckpoint;
window.undo         = undo;
window.redo         = redo;
window.clearHistory = clearHistory;
window.restoreSnapshot = restoreSnapshot;
// D1: 페이지별 히스토리 헬퍼 노출 (save-load.js는 window.* 로만 호출)
window.stashHistoryFor    = stashHistoryFor;
window.adoptHistoryFor    = adoptHistoryFor;
window.dropHistoryFor     = dropHistoryFor;
window.resetAllPageHistory = resetAllPageHistory;

// historyStack / historyPos 읽기 전용 노출 (CDP 검증용)
Object.defineProperty(window, 'historyStack', {
  get: () => historyStack,
  configurable: true,
});
Object.defineProperty(window, 'historyPos', {
  get: () => historyPos,
  configurable: true,
});
Object.defineProperty(window, '_historyPaused', {
  get: () => _historyPaused,
  set: (v) => { _historyPaused = v; },
  configurable: true,
});

export { pushHistory, undo, redo, clearHistory, restoreSnapshot, _updateUndoRedoBtns,
         stashHistoryFor, adoptHistoryFor, dropHistoryFor, resetAllPageHistory };

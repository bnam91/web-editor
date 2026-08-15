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
  restoreSnapshot(historyStack[historyPos]);
  try { leavingSnap?.sideEffects?.onUndo?.(); } catch (e) { console.warn('[history] onUndo err:', e); }
}

function redo() {
  if (historyPos >= historyStack.length - 1) return;
  historyPos++;
  const newSnap = historyStack[historyPos];
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

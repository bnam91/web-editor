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

function pushHistory(action = '작업', sideEffects = null) {
  if (_historyPaused) return;
  historyStack = historyStack.slice(0, historyPos + 1);
  // sideEffects: { onUndo?: fn, onRedo?: fn } — DOM 외 상태(예: 스크래치패드 IDB) 복원용
  historyStack.push({ canvas: window.getSerializedCanvas(), settings: { ...state.pageSettings }, action, pageId: state.currentPageId, sideEffects });
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
  _historyPaused = false;
  _updateUndoRedoBtns();
  // _suppressAutoSave는 한 프레임 뒤 해제 — MutationObserver는 microtask 후 발화하므로
  // 동기 해제 시 잔여 mutation이 새어 부분저장을 유발. (applyProjectData와 동일 패턴)
  requestAnimationFrame(() => { state._suppressAutoSave = false; });
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
  const init = { canvas: window.getSerializedCanvas(), settings: { ...state.pageSettings }, action: '초기 상태', pageId: state.currentPageId };
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
    historyStack.push({ canvas: current, settings: { ...state.pageSettings }, action, pageId: state.currentPageId });
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

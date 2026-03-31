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

function pushHistory(action = '작업') {
  if (_historyPaused) return;
  historyStack = historyStack.slice(0, historyPos + 1);
  historyStack.push({ canvas: window.getSerializedCanvas(), settings: { ...state.pageSettings }, action, pageId: state.currentPageId });
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
  else historyPos++;
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
}

function undo() {
  if (historyPos <= 0) return;
  historyPos--;
  restoreSnapshot(historyStack[historyPos]);
}

function redo() {
  if (historyPos >= historyStack.length - 1) return;
  historyPos++;
  restoreSnapshot(historyStack[historyPos]);
}

function clearHistory() {
  // 초기 상태를 스냅샷으로 저장해 첫 번째 액션도 Undo 가능하게 함
  const init = { canvas: window.getSerializedCanvas(), settings: { ...state.pageSettings }, action: '초기 상태', pageId: state.currentPageId };
  historyStack = [init];
  historyPos   = 0;
  state._canvasDirty = false;
  _updateUndoRedoBtns();
}

/* ── window 노출 ── */
window.pushHistory  = pushHistory;
window.undo         = undo;
window.redo         = redo;
window.clearHistory = clearHistory;
window.restoreSnapshot = restoreSnapshot;

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

export { pushHistory, undo, redo, clearHistory, restoreSnapshot, _updateUndoRedoBtns };

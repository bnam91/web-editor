/* ═══════════════════════════════════
   DRAG AND DROP — aggregator
   This file re-exports everything from the 3 focused sub-modules.
   Keep this file thin; actual logic lives in:
     js/overlay-handles.js  — resize/radius handle overlays
     js/section-drag.js     — section/group/row HTML5 DnD helpers + dragState
     js/block-drag.js       — bindBlock + bindFrameDropZone
═══════════════════════════════════ */

import {
  clearDropIndicators,
  clearSectionIndicators,
  clearLayerSectionIndicators,
} from './drag-utils.js';
import { _resumeDragSave } from './section-drag.js';

export * from './overlay-handles.js';
export * from './section-drag.js';
export * from './block-drag.js';

// 드래그 중단(ESC 등)으로 dragging 클래스가 고착되는 현상 방지
// FIX-SD-04: ESC 취소 시 section-drop-indicator 정리 및 _suppressAutoSave 복원
document.addEventListener('dragend', () => {
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  clearDropIndicators();
  clearSectionIndicators();      // ESC 취소 시 section-drop-indicator 잔류 방지
  clearLayerSectionIndicators();
  _resumeDragSave();             // ESC 취소 시 _suppressAutoSave 고착 방지
}, true);

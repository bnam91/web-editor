/* ═══════════════════════════════════
   SHARED STATE — loaded first
═══════════════════════════════════ */
export const propPanel   = document.querySelector('#panel-right .panel-body');
export const canvasEl    = document.getElementById('canvas');
export const canvasWrap  = document.getElementById('canvas-wrap');

/* ── Multi-page state ── */
export const PAGE_LABELS = ['', 'Hook', 'Main', 'Detail', 'CTA', 'Event'];

export const state = {
  pageSettings: { bg: '#969696', gap: 100, padX: 32, padY: 32 },
  pages: [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { bg: '#969696', gap: 100, padX: 32, padY: 32 }, canvas: '' }],
  currentPageId: 'page_1',
  _suppressAutoSave: false
};

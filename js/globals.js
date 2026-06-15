/* ═══════════════════════════════════
   SHARED STATE — loaded first
═══════════════════════════════════ */
export const propPanel   = document.querySelector('#panel-right .panel-body');
export const canvasEl    = document.getElementById('canvas');
export const canvasWrap  = document.getElementById('canvas-wrap');

/* ── Multi-page state ── */
export const PAGE_LABELS = ['', 'Hook', 'Main', 'Detail', 'CTA', 'Event'];

export const state = {
  pageSettings: { bg: '#828282', bgAlpha: 100, gap: 100, padX: 32, padY: 0, padXExcludesAsset: true },
  pages: [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { bg: '#828282', bgAlpha: 100, gap: 100, padX: 32, padY: 0, padXExcludesAsset: true }, canvas: '' }],
  currentPageId: 'page_1',
  // AI 이미지 갤러리 — 프로젝트 전역 자산 (페이지 전환 무관)
  imageGallery: [],
  // Assets 트리 — 폴더/이미지/URL 노드 (프로젝트 전역 자산)
  assetsTree: [],
  _suppressAutoSave: false,
};
window.state = state;

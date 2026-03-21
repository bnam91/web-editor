/* ═══════════════════════════════════
   SHARED STATE — loaded first
═══════════════════════════════════ */
const propPanel   = document.querySelector('#panel-right .panel-body');
const canvasEl    = document.getElementById('canvas');
const canvasWrap  = document.getElementById('canvas-wrap');

let pageSettings = { bg: '#969696', gap: 100, padX: 32, padY: 32 };

/* ── Multi-page state ── */
const PAGE_LABELS = ['', 'Hook', 'Main', 'Detail', 'CTA', 'Event'];
let pages = [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { bg: '#969696', gap: 100, padX: 32, padY: 32 }, canvas: '' }];
let currentPageId = 'page_1';
let _suppressAutoSave = false;

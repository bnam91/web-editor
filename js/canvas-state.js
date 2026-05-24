/**
 * Goditor Claude PM — get_canvas_state renderer (window-exposed)
 *
 * READ-ONLY canvas inspection for the PM. Returns every section on the active
 * page with its text blocks (blockId, type, text, color, fontSize, align) so
 * the PM can resolve "the price text" → a concrete blockId before mutating.
 *
 * No ES modules — exposed as window.getCanvasState (loaded via <script> in index.html).
 * Reads the DOM directly; does NOT define getBlockById/selectBlock/editTextBlock
 * (owned by another team) and performs NO mutation.
 */
(function () {
  'use strict';

  // 활성 페이지는 #canvas 컨테이너에 렌더링됨 (save-load.js의 canvasEl 컨벤션과 동일).
  function _getCanvasRoot() {
    return document.getElementById('canvas') || document;
  }

  // 단일 .text-block → { blockId, type, text, color, fontSize, align }
  function _readTextBlock(block) {
    const contentEl = block.querySelector('[class^="tb-"]');
    const type = block.dataset.type || '';
    const text = (contentEl && contentEl.innerText ? contentEl.innerText : '').slice(0, 200);
    // align: label은 block.style.textAlign, 그 외는 contentEl.style.textAlign (applyTextOpts 컨벤션 미러)
    const align = type === 'label'
      ? (block.style.textAlign || '')
      : (contentEl && contentEl.style.textAlign ? contentEl.style.textAlign : '');
    return {
      blockId: block.id || null,
      type,
      text,
      color: (contentEl && contentEl.style.color) ? contentEl.style.color : '',
      fontSize: (contentEl && contentEl.style.fontSize) ? contentEl.style.fontSize : '',
      align,
    };
  }

  // 단일 .section-block → { sectionId, name, blocks: [...] }
  function _readSection(section) {
    const blocks = [];
    // document order로 .text-block 후손 순회
    section.querySelectorAll('.text-block').forEach((block) => {
      blocks.push(_readTextBlock(block));
    });
    return {
      sectionId: section.id || null,
      name: section.dataset.name || '',
      blocks,
    };
  }

  /**
   * window.getCanvasState(sectionId?)
   * - sectionId 주어지면 해당 섹션만, 없으면 활성 페이지의 모든 .section-block.
   * - { ok:true, sections:[...] } 또는 sectionId 미발견 시 { ok:false, code:'NOT_FOUND', message }.
   */
  function getCanvasState(sectionId) {
    const root = _getCanvasRoot();

    if (sectionId) {
      const section = document.getElementById(sectionId);
      if (!section || !section.classList.contains('section-block')) {
        return {
          ok: false,
          code: 'NOT_FOUND',
          message: 'section not found: ' + sectionId,
        };
      }
      return { ok: true, sections: [_readSection(section)] };
    }

    const sections = [];
    root.querySelectorAll('.section-block').forEach((section) => {
      sections.push(_readSection(section));
    });
    return { ok: true, sections };
  }

  window.getCanvasState = getCanvasState;
})();

// ── Vector Block ───────────────────────────────────────────────────────────────
// 임의 SVG 문자열을 색상 치환 + 100% 폭 강제로 렌더하는 블록.
//
// 의존성:
//   - genId, showNoSelectionHint, insertAfterSelected (drag-utils.js)
//   - bindBlock (drag-drop.js)
//   - window._insertToFlowFrame (block-factory.js 노출 헬퍼)

import { genId, showNoSelectionHint, insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

function renderVector(block) {
  const svgStr = block.dataset.svg   || '';
  const color  = block.dataset.color || '#000000';
  const w      = parseInt(block.dataset.w) || 120;
  const h      = parseInt(block.dataset.h) || 120;

  block.style.width  = w + 'px';
  block.style.height = h + 'px';

  const inner = block.querySelector('.vb-inner');
  if (!inner) return;

  // fill 색상 치환: fill="black", fill="#000000", fill="currentColor" 등 → 지정 색상
  let processed = svgStr
    .replace(/fill="black"/gi,        `fill="${color}"`)
    .replace(/fill="#000000"/gi,      `fill="${color}"`)
    .replace(/fill="#000"/gi,         `fill="${color}"`)
    .replace(/fill="currentColor"/gi, `fill="${color}"`);

  // SVG 자체에 width/height 100% 강제 적용
  processed = processed.replace(/<svg([^>]*)>/i, (match, attrs) => {
    let a = attrs
      .replace(/\s*width="[^"]*"/gi, '')
      .replace(/\s*height="[^"]*"/gi, '');
    return `<svg${a} width="100%" height="100%">`;
  });

  inner.innerHTML = processed;

}

function makeVectorBlock(data = {}) {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const block = document.createElement('div');
  block.className      = 'vector-block';
  block.dataset.type   = 'vector';
  block.id             = genId('vb');
  block.setAttribute('draggable', 'true');
  block.dataset.svg    = data.svg   || '';
  block.dataset.color  = data.color || '#000000';
  block.dataset.w      = String(data.w || 120);
  block.dataset.h      = String(data.h || 120);
  block.dataset.layerName = data.label || 'Vector';

  const inner = document.createElement('div');
  inner.className = 'vb-inner';
  block.appendChild(inner);

  renderVector(block);

  row.appendChild(block);
  return { row, block };
}

function addVectorBlock(svgString = '', opts = {}) {
  if (window._insertToFlowFrame?.(() => {
    const { row, block } = makeVectorBlock({ svg: svgString, ...opts });
    return { row, block };
  })) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeVectorBlock({ svg: svgString, ...opts });
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeVectorBlock = makeVectorBlock;
window.addVectorBlock  = addVectorBlock;
window.renderVector    = renderVector;

export { makeVectorBlock, addVectorBlock, renderVector };

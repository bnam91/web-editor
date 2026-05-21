// ── Iconify Block ─────────────────────────────────────────────────────────────
// Iconify 아이콘 SVG를 단일 inline 블록으로 표시.
//
// 의존성:
//   - genId, showNoSelectionHint, insertAfterSelected (drag-utils.js)
//   - bindBlock (drag-drop.js)

import { genId, showNoSelectionHint, insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

function makeIconifyBlock(iconName = '', svgContent = '', size = 64) {
  const row   = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const block = document.createElement('div');
  block.className     = 'icon-block';
  block.dataset.type  = 'icon';
  block.id            = genId('icn');
  block.dataset.iconName  = iconName;
  block.dataset.size      = String(size);
  block.dataset.rotation  = '0';
  block.dataset.iconColor = '#000000';

  _applyIconifyBlockStyle(block, svgContent, size, 0);
  block.style.color = '#000000';

  row.appendChild(block);
  return { row, block };
}

function _applyIconifyBlockStyle(block, svgContent, size, rotation) {
  block.style.cssText = `width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:content-box;`;
  if (rotation) block.style.transform = `rotate(${rotation}deg)`;
  if (svgContent) {
    block.innerHTML = svgContent;
    const svg = block.querySelector('svg');
    if (svg) { svg.setAttribute('width', size); svg.setAttribute('height', size); svg.style.display = 'block'; }
  } else {
    block.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  }
}

function addIconifyBlock(iconName, svgContent, size = 64) {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeIconifyBlock(iconName, svgContent, size);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeIconifyBlock = makeIconifyBlock;
window.addIconifyBlock  = addIconifyBlock;
window._applyIconifyBlockStyle = _applyIconifyBlockStyle;

export { makeIconifyBlock, addIconifyBlock, _applyIconifyBlockStyle };

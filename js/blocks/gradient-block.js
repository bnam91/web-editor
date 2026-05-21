// ── Gradient Block (플로팅 오버레이) ──────────────────────────────────────────
// 2026-05-21 sticker 패턴으로 재작성.
// 섹션 위에 absolute로 떠있는 그라데이션 페이드 오버레이.
// 용도: 이미지 끝선/섹션 경계의 부자연스러움을 페이드로 자연스럽게 연결.
//
// 부모: .section-block 직접 자식 (sticker와 동일 패턴)
// 위치: absolute, left/top dataset 기반
// 디폴트: 860 × 300, 좌상단 (0, 0), linear, 위→아래, 검정 100% → 검정 0%
// z-index: 2 (텍스트/콘텐츠 아래, 배경 위 — 페이드 용도)
//
// 의존성:
//   - window.getSelectedSection, window.showNoSelectionHint,
//     window.pushHistory, window.scheduleAutoSave,
//     window.bindGradientSelect (gradient-select.js)

const GRADIENT_DEFAULTS = {
  style:       'linear',
  direction:   'to bottom',
  startColor:  '#000000',
  endColor:    '#000000',
  startAlpha:  1,
  endAlpha:    0,
  width:       860,
  height:      300,
  x:           0,
  y:           0,
};

function _hexToRgba(hex, alpha) {
  const h = String(hex || '#000000').replace('#','');
  const r = parseInt(h.slice(0,2), 16) || 0;
  const g = parseInt(h.slice(2,4), 16) || 0;
  const b = parseInt(h.slice(4,6), 16) || 0;
  const a = Math.max(0, Math.min(1, parseFloat(alpha)));
  return `rgba(${r},${g},${b},${a})`;
}

function renderGradientBlock(block) {
  const style       = block.dataset.gradStyle      || GRADIENT_DEFAULTS.style;
  const direction   = block.dataset.gradDirection  || GRADIENT_DEFAULTS.direction;
  const startColor  = block.dataset.gradStart      || GRADIENT_DEFAULTS.startColor;
  const endColor    = block.dataset.gradEnd        || GRADIENT_DEFAULTS.endColor;
  const startAlpha  = block.dataset.gradStartAlpha != null ? parseFloat(block.dataset.gradStartAlpha) : GRADIENT_DEFAULTS.startAlpha;
  const endAlpha    = block.dataset.gradEndAlpha   != null ? parseFloat(block.dataset.gradEndAlpha)   : GRADIENT_DEFAULTS.endAlpha;
  const width       = parseInt(block.dataset.gradWidth)  || GRADIENT_DEFAULTS.width;
  const height      = parseInt(block.dataset.gradHeight) || GRADIENT_DEFAULTS.height;
  const x           = parseInt(block.dataset.x) || 0;
  const y           = parseInt(block.dataset.y) || 0;

  const c1 = _hexToRgba(startColor, startAlpha);
  const c2 = _hexToRgba(endColor,   endAlpha);

  let bg;
  if (style === 'radial') {
    // 비네트: 중앙 = endColor(투명) → 외곽 = startColor(불투명)
    bg = `radial-gradient(circle at center, ${c2} 0%, ${c1} 100%)`;
  } else {
    bg = `linear-gradient(${direction}, ${c1} 0%, ${c2} 100%)`;
  }

  // absolute floating overlay — sticker와 동일 패턴
  block.style.cssText = `position:absolute;left:${x}px;top:${y}px;`
    + `width:${width}px;height:${height}px;`
    + `background:${bg};`
    + `user-select:none;cursor:move;z-index:2;pointer-events:auto;`
    + `box-sizing:border-box;`;
  // 내부 콘텐츠는 없음 (배경만)
}

function makeGradientBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'gradient-block';
  block.id = 'grad_' + Math.random().toString(36).slice(2, 8);
  block.dataset.type           = 'gradient';
  block.dataset.gradStyle      = opts.style       ?? GRADIENT_DEFAULTS.style;
  block.dataset.gradDirection  = opts.direction   ?? GRADIENT_DEFAULTS.direction;
  block.dataset.gradStart      = opts.startColor  ?? GRADIENT_DEFAULTS.startColor;
  block.dataset.gradEnd        = opts.endColor    ?? GRADIENT_DEFAULTS.endColor;
  block.dataset.gradStartAlpha = String(opts.startAlpha ?? GRADIENT_DEFAULTS.startAlpha);
  block.dataset.gradEndAlpha   = String(opts.endAlpha   ?? GRADIENT_DEFAULTS.endAlpha);
  block.dataset.gradWidth      = String(opts.width  ?? GRADIENT_DEFAULTS.width);
  block.dataset.gradHeight     = String(opts.height ?? GRADIENT_DEFAULTS.height);
  block.dataset.x              = String(opts.x ?? GRADIENT_DEFAULTS.x);
  block.dataset.y              = String(opts.y ?? GRADIENT_DEFAULTS.y);
  block.dataset.layerName      = opts.layerName || 'Gradient';
  renderGradientBlock(block);
  return block;
}

function addGradientBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory?.('그라데이션 추가');
  const block = makeGradientBlock(opts);
  sec.appendChild(block); // 섹션 직접 자식 (absolute → 섹션 기준)
  window.bindGradientSelect?.(block);
  window.scheduleAutoSave?.();
  window.buildLayerPanel?.();
  return block;
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeGradientBlock   = makeGradientBlock;
window.addGradientBlock    = addGradientBlock;
window.renderGradientBlock = renderGradientBlock;

export { makeGradientBlock, addGradientBlock, renderGradientBlock, GRADIENT_DEFAULTS };

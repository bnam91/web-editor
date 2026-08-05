/* ═══════════════════════════════════
   INNER-CARD BLOCK — 범용 인너카드 (BL-019 확장 · BL-CDD-07 통합, 현빈 스펙 2026-07-03)
═══════════════════════════════════ */
//
// "섹션 bg 무관한 카드 컨테이너 + 텍스트 스택" — 다크 위 흰카드(kitou S67), 보증카드(#ededed),
// 좌측 강조바 후기 인용(CDD-07)을 addInnerCardBlock 한 콜로. 그동안 frame-block+자유배치나
// 텍스트블록 패딩 수동조절로 흉내 내던 패턴의 정식 블록화.
// 라인 모델·렌더러는 duo-block과 공유(부품 공유) — dataset+render 재생성형.

import { insertAfterSelected, genId, blockContextLuminance } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';
import { duoLineHtml } from './duo-block.js';

const INNERCARD_DEFAULTS = {
  bg: '#ffffff', radius: 16, padding: 40, align: 'left', shadow: 'none', width: 0, // width 0 = 100%
  lines: [
    { type: 'h2', text: '카드 제목' },
    { type: 'body', text: '내용을 입력하세요.', marginTop: 12 },
  ],
};
const _ICD_SHADOWS = {
  none: '',
  soft: '0 4px 16px rgba(0,0,0,0.08)',
  strong: '0 8px 32px rgba(0,0,0,0.18)',
};
const _ICD_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|transparent)$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;

function _icdLines(block) {
  let lines;
  try { lines = JSON.parse(block.dataset.lines || '[]'); } catch (_) { lines = []; }
  if (!Array.isArray(lines) || lines.length === 0) lines = JSON.parse(JSON.stringify(INNERCARD_DEFAULTS.lines));
  return lines;
}

function renderInnerCardBlock(block) {
  const lines = _icdLines(block);
  const bg = block.dataset.bg || INNERCARD_DEFAULTS.bg;
  const radius = parseInt(block.dataset.radius);
  const padding = parseInt(block.dataset.padding);
  const align = block.dataset.align || 'left';
  const shadow = _ICD_SHADOWS[block.dataset.shadow] || '';
  const width = parseInt(block.dataset.width) || 0;
  const borderW = parseInt(block.dataset.borderW) || 0;
  const borderColor = block.dataset.borderColor || '#dddddd';
  const accentW = parseInt(block.dataset.accentW) || 0;
  const accentColor = block.dataset.accentColor || '#2d6fe8';

  // 테마어웨어 기본 텍스트색 (2026-07-04 제니 발주): 색 미지정 라인은 카드 자체 bg 휘도 기준 상속.
  // 섹션이 다크여도 카드가 화이트면 다크 텍스트 — 화이트카드 위 화이트(bench 저점 패턴) 방지.
  // line.color 명시는 duoLineHtml이 인라인으로 덮으므로 항상 최우선.
  const _cardLum  = blockContextLuminance(block, bg);
  const _cardDark = _cardLum !== null && _cardLum < 0.45;
  block.style.cssText = `box-sizing:border-box;position:relative;` +
    (width > 0 ? `width:${width}px;max-width:100%;margin-left:auto;margin-right:auto;` : 'width:100%;') +
    `background:${bg};color:${_cardDark ? '#f2f2f2' : '#1a1a1a'};` +
    (Number.isFinite(radius) && radius > 0 ? `border-radius:${radius}px;` : '') +
    `padding:${Number.isFinite(padding) ? padding : INNERCARD_DEFAULTS.padding}px;` +
    (shadow ? `box-shadow:${shadow};` : '') +
    (borderW > 0 ? `border:${borderW}px solid ${borderColor};` : '') +
    (accentW > 0 ? `border-left:${accentW}px solid ${accentColor};` : '');
  block.innerHTML = lines.map(l => duoLineHtml(l, align)).join('');
}

function makeInnerCardBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'innercard-block';
  block.id = genId('icd');
  block.dataset.type = 'innercard';
  block.dataset.lines = JSON.stringify(Array.isArray(opts.lines) && opts.lines.length ? opts.lines : INNERCARD_DEFAULTS.lines);
  block.dataset.bg = (typeof opts.bg === 'string' && _ICD_COLOR_RE.test(opts.bg.trim())) ? opts.bg.trim() : INNERCARD_DEFAULTS.bg;
  block.dataset.radius = String(Number.isFinite(Number(opts.radius)) ? Number(opts.radius) : INNERCARD_DEFAULTS.radius);
  block.dataset.padding = String(Number.isFinite(Number(opts.padding)) ? Number(opts.padding) : INNERCARD_DEFAULTS.padding);
  block.dataset.align = ['left', 'center', 'right'].includes(opts.align) ? opts.align : INNERCARD_DEFAULTS.align;
  block.dataset.shadow = ['none', 'soft', 'strong'].includes(opts.shadow) ? opts.shadow : INNERCARD_DEFAULTS.shadow;
  if (Number(opts.width) > 0) block.dataset.width = String(Number(opts.width));
  if (opts.border && typeof opts.border === 'object') {
    block.dataset.borderW = String(Number(opts.border.width) || 1);
    if (typeof opts.border.color === 'string' && _ICD_COLOR_RE.test(opts.border.color.trim())) block.dataset.borderColor = opts.border.color.trim();
  }
  if (opts.accentBar && typeof opts.accentBar === 'object') {
    block.dataset.accentW = String(Number(opts.accentBar.width) || 4);
    if (typeof opts.accentBar.color === 'string' && _ICD_COLOR_RE.test(opts.accentBar.color.trim())) block.dataset.accentColor = opts.accentBar.color.trim();
  }
  renderInnerCardBlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addInnerCardBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return null; }
  window.pushHistory();
  const { row, block } = makeInnerCardBlock(opts);
  insertAfterSelected(sec, row);
  renderInnerCardBlock(block); // 삽입 후 재렌더 — bg transparent면 섹션 bg 휘도를 알아야 함
  bindBlock(block);
  window.buildLayerPanel();
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
  return { row, block };
}

// updateDuoBlock 미러 — lines 교체 / patchLine {index,...} / 스타일 키
function updateInnerCardBlock(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('innercard-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `innercard-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object' || Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial must be non-empty object' };
  }
  const next = {};
  const applied = {};
  if (partial.lines !== undefined) {
    if (!Array.isArray(partial.lines) || partial.lines.length === 0 || partial.lines.length > 40) {
      return { ok: false, code: 'INVALID', message: 'lines must be array (1~40)' };
    }
    next.lines = JSON.stringify(partial.lines);
    applied.lines = partial.lines;
  }
  if (partial.patchLine !== undefined) {
    if (next.lines !== undefined) return { ok: false, code: 'INVALID', message: 'lines와 patchLine 동시 지정 불가' };
    const p = partial.patchLine;
    if (!p || typeof p !== 'object' || !Number.isFinite(Number(p.index))) {
      return { ok: false, code: 'INVALID', message: 'patchLine must be {index, ...}' };
    }
    const lines = _icdLines(block);
    const i = Number(p.index);
    if (i < 0 || i >= lines.length) return { ok: false, code: 'INVALID', message: `patchLine.index out of range (0~${lines.length - 1})` };
    const { index, ...rest } = p;
    lines[i] = Object.assign({}, lines[i], rest);
    next.lines = JSON.stringify(lines);
    applied.patchLine = { index: i, ...rest };
  }
  const _num = (key, min, max) => {
    if (partial[key] === undefined) return true;
    const n = Number(partial[key]);
    if (!Number.isFinite(n) || n < min || n > max) return false;
    next[key] = String(Math.round(n));
    applied[key] = Math.round(n);
    return true;
  };
  if (!_num('radius', 0, 200)) return { ok: false, code: 'INVALID', message: 'radius must be 0~200' };
  if (!_num('padding', 0, 200)) return { ok: false, code: 'INVALID', message: 'padding must be 0~200' };
  if (!_num('width', 0, 860)) return { ok: false, code: 'INVALID', message: 'width must be 0~860 (0=100%)' };
  if (partial.bg !== undefined) {
    if (typeof partial.bg !== 'string' || !_ICD_COLOR_RE.test(partial.bg.trim())) {
      return { ok: false, code: 'INVALID', message: `invalid bg: ${partial.bg}` };
    }
    next.bg = partial.bg.trim(); applied.bg = next.bg;
  }
  if (partial.align !== undefined) {
    if (!['left', 'center', 'right'].includes(partial.align)) return { ok: false, code: 'INVALID', message: 'align must be left|center|right' };
    next.align = partial.align; applied.align = partial.align;
  }
  if (partial.shadow !== undefined) {
    if (!['none', 'soft', 'strong'].includes(partial.shadow)) return { ok: false, code: 'INVALID', message: 'shadow must be none|soft|strong' };
    next.shadow = partial.shadow; applied.shadow = partial.shadow;
  }

  const before = { lines: block.dataset.lines, bg: block.dataset.bg, radius: block.dataset.radius,
    padding: block.dataset.padding, align: block.dataset.align, shadow: block.dataset.shadow, width: block.dataset.width };
  window.pushHistory?.();
  Object.assign(block.dataset, next);
  try {
    renderInnerCardBlock(block);
  } catch (e) {
    Object.assign(block.dataset, before);
    try { renderInnerCardBlock(block); } catch (_) {}
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }
  if (block.classList.contains('selected')) {
    try { window.showInnerCardProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}
  window.scheduleAutoSave?.();
  return { ok: true, blockId, before, applied };
}

window.makeInnerCardBlock = makeInnerCardBlock;
window.addInnerCardBlock = addInnerCardBlock;
window.updateInnerCardBlock = updateInnerCardBlock;
window.renderInnerCardBlock = renderInnerCardBlock;

export { makeInnerCardBlock, addInnerCardBlock, updateInnerCardBlock, renderInnerCardBlock, INNERCARD_DEFAULTS };

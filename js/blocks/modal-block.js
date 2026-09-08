/* ═══════════════════════════════════
   MODAL BLOCK — 컨테이너 + 텍스트 (현빈 발주 2026-09-08)
═══════════════════════════════════ */
//
// "그냥 컨테이너 안에 텍스트 입력" — 배송안내·교환반품·주의문구처럼 상세페이지에서 자주 쓰는
// 박스형 안내를 정식 블록으로. 그동안 frame-block + 텍스트블록 패딩 수동조절로 흉내 내던 패턴.
//
// ★모델 = dataset 이 진실, render 가 DOM 을 그린다 (grid/infocard/innercard 와 같은 계열).
//   인라인 스타일만 쓰면 저장→로드 왕복에서 값이 증발한다.
//   글자도 dataset(titleText/textText/cell1/cell2)에 산다 — 재렌더가 타이핑을 지우지 않게.
//
// ★텍스트 요소 클래스가 `tb-mdl-*` 인 이유 = «내보내기 보험».
//   export-figma-json 의 generic 폴백이 [class^="tb-"] 만 텍스트로 수집한다.
//   전용 분기가 미래에 깨져도 글자는 살아남는다.

import { insertAfterSelected, genId, showNoSelectionHint } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

const MODAL_VARIANTS = ['plain', 'titled', 'icon', 'icon-stack', 'grid-2', 'dashed'];

const MODAL_DEFAULTS = {
  variant: 'plain',
  bg: '#f6f7f9',
  radius: 0,            // ★현빈 조정⑵ — 처음엔 라디우스 없음(전 변형 공통)
  padX: 20, padY: 18,
  borderW: 0, borderStyle: 'solid', borderColor: '#c3c3ca',
  wMode: 'full', width: 400,
  hMode: 'auto', height: 120,
  align: 'left', textColor: '#1c1c1e', fontSize: 14,
  gap: 14,
  iconSize: 24, iconColor: '#f0b429',
};

// 플레이스홀더 문구 — 고디터 기존 어휘 그대로(block-factory.js:65)
const MODAL_PH = {
  title: '소제목을 입력하세요',
  text:  '본문 내용을 입력하세요.',
  cell:  '항목을 입력하세요',
};

const _MDL_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|transparent)$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;
const _esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function _num(block, key, def) {
  const n = parseInt(block.dataset[key]);
  return Number.isFinite(n) ? n : def;
}

/* 아이콘 슬롯 — ★현빈 조정⑶: 하드코딩 SVG 가 아니라 «아이콘 에셋» 구조를 쓴다.
   iconify-block 과 «같은 키»(iconName/iconSrc/raster/iconColor/iconSize)를 써서
   나중에 Iconify 모달·래스터 에셋이 그대로 물린다. 비어 있으면 placeholder SVG. */
function _modalIconHtml(block) {
  const size = _num(block, 'iconSize', MODAL_DEFAULTS.iconSize);
  const color = block.dataset.iconColor || MODAL_DEFAULTS.iconColor;
  // 래스터(PNG/JPG): goya-asset:// URL 을 <img> 로. ⛔data-URL 인라인 금지(iconify 규약).
  if (block.dataset.raster === '1') {
    const src = block.dataset.iconSrc || '';
    if (src) {
      return `<div class="mdl-icon" style="width:${size}px;height:${size}px;">`
           + `<img src="${_esc(src)}" width="${size}" height="${size}" `
           + `style="width:${size}px;height:${size}px;object-fit:contain;display:block;pointer-events:none;" `
           + `draggable="false" alt=""></div>`;
    }
  }
  const svg = block.dataset.iconSvg || '';
  const inner = svg
    ? svg
    : `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  return `<div class="mdl-icon" style="width:${size}px;height:${size}px;color:${_esc(color)};">${inner}</div>`;
}

function _textHtml(cls, slot, value, ph) {
  const empty = String(value ?? '').trim() === '';
  const shown = empty ? ph : value;
  return `<div class="${cls}" data-mdl-slot="${slot}" contenteditable="false"`
       + ` data-placeholder="${_esc(ph)}"${empty ? ' data-is-placeholder="true"' : ''}>${_esc(shown)}</div>`;
}

function renderModalBlock(block) {
  if (!block) return;
  const v = MODAL_VARIANTS.includes(block.dataset.variant) ? block.dataset.variant : MODAL_DEFAULTS.variant;
  const bg = block.dataset.bg || MODAL_DEFAULTS.bg;
  const radius = _num(block, 'radius', MODAL_DEFAULTS.radius);
  const padX = _num(block, 'padX', MODAL_DEFAULTS.padX);
  const padY = _num(block, 'padY', MODAL_DEFAULTS.padY);
  const borderW = _num(block, 'borderW', MODAL_DEFAULTS.borderW);
  const borderStyle = block.dataset.borderStyle || MODAL_DEFAULTS.borderStyle;
  const borderColor = block.dataset.borderColor || MODAL_DEFAULTS.borderColor;
  const align = ['left', 'center', 'right'].includes(block.dataset.align) ? block.dataset.align : MODAL_DEFAULTS.align;
  const textColor = block.dataset.textColor || MODAL_DEFAULTS.textColor;
  const fontSize = _num(block, 'fontSize', MODAL_DEFAULTS.fontSize);
  const gap = _num(block, 'gap', MODAL_DEFAULTS.gap);
  const wMode = block.dataset.wMode === 'fixed' ? 'fixed' : 'full';
  const hMode = block.dataset.hMode === 'fixed' ? 'fixed' : 'auto';

  // titled 는 제목 줄이 자기 패딩을 갖는다 → 루트 패딩 0, 안쪽에서 준다
  const rootPad = (v === 'titled') ? '0' : `${padY}px ${padX}px`;

  block.style.cssText = 'box-sizing:border-box;position:relative;'
    + (wMode === 'fixed' ? `width:${_num(block, 'width', MODAL_DEFAULTS.width)}px;max-width:100%;margin-left:auto;margin-right:auto;` : 'width:100%;')
    + (hMode === 'fixed' ? `min-height:${_num(block, 'height', MODAL_DEFAULTS.height)}px;` : '')
    + `background:${bg};color:${textColor};font-size:${fontSize}px;line-height:1.7;text-align:${align};`
    + (radius > 0 ? `border-radius:${radius}px;` : '')
    + `padding:${rootPad};`
    + (borderW > 0 ? `border:${borderW}px ${borderStyle} ${borderColor};` : '');

  const title = block.dataset.titleText;
  const text  = block.dataset.textText;
  let html = '';

  if (v === 'titled') {
    html = `<div class="tb-mdl-title" data-mdl-slot="title" contenteditable="false"`
         + ` data-placeholder="${_esc(MODAL_PH.title)}"`
         + `${String(title ?? '').trim() === '' ? ' data-is-placeholder="true"' : ''}`
         + ` style="padding:${Math.round(padY * 0.6)}px ${padX}px;">`
         + `${_esc(String(title ?? '').trim() === '' ? MODAL_PH.title : title)}</div>`
         + `<div class="tb-mdl-text" data-mdl-slot="text" contenteditable="false"`
         + ` data-placeholder="${_esc(MODAL_PH.text)}"`
         + `${String(text ?? '').trim() === '' ? ' data-is-placeholder="true"' : ''}`
         + ` style="padding:${padY}px ${padX}px;">`
         + `${_esc(String(text ?? '').trim() === '' ? MODAL_PH.text : text)}</div>`;
  } else if (v === 'grid-2') {
    // ★현빈 조정⑴ — 칼럼은 «투명 배경». 위치만 잡는 용도라 배경/테두리를 주지 않는다.
    //   셀은 «텍스트 전용»이다(드롭존 미등록) → 모달 안 모달이 안 생긴다.
    html = `<div class="mdl-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:${gap}px;">`
         + _textHtml('tb-mdl-cell', 'cell1', block.dataset.cell1, MODAL_PH.cell)
         + _textHtml('tb-mdl-cell', 'cell2', block.dataset.cell2, MODAL_PH.cell)
         + `</div>`;
  } else if (v === 'icon' || v === 'icon-stack') {
    const stack = (v === 'icon-stack');
    block.style.display = 'flex';
    block.style.flexDirection = stack ? 'column' : 'row';
    block.style.alignItems = stack ? 'center' : 'flex-start';
    block.style.gap = stack ? '9px' : '11px';
    if (stack) block.style.textAlign = 'center';
    html = _modalIconHtml(block) + _textHtml('tb-mdl-text', 'text', text, MODAL_PH.text);
  } else {
    // plain · dashed
    html = _textHtml('tb-mdl-text', 'text', text, MODAL_PH.text);
  }
  block.innerHTML = html;
}

function makeModalBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'modal-block';
  block.id = genId('mdl');
  block.dataset.type = 'modal';
  block.dataset.variant = MODAL_VARIANTS.includes(opts.variant) ? opts.variant : MODAL_DEFAULTS.variant;
  block.dataset.bg = (typeof opts.bg === 'string' && _MDL_COLOR_RE.test(opts.bg.trim())) ? opts.bg.trim() : MODAL_DEFAULTS.bg;
  block.dataset.radius = String(Number.isFinite(Number(opts.radius)) ? Number(opts.radius) : MODAL_DEFAULTS.radius);
  block.dataset.padX = String(Number.isFinite(Number(opts.padX)) ? Number(opts.padX) : MODAL_DEFAULTS.padX);
  block.dataset.padY = String(Number.isFinite(Number(opts.padY)) ? Number(opts.padY) : MODAL_DEFAULTS.padY);
  // dashed 변형만 테두리를 기본으로 갖는다(그게 그 변형의 정체다). radius 는 조정⑵대로 0 유지.
  const isDashed = block.dataset.variant === 'dashed';
  block.dataset.borderW = String(Number.isFinite(Number(opts.borderW)) ? Number(opts.borderW) : (isDashed ? 2 : MODAL_DEFAULTS.borderW));
  block.dataset.borderStyle = ['solid', 'dashed', 'dotted'].includes(opts.borderStyle) ? opts.borderStyle : (isDashed ? 'dashed' : MODAL_DEFAULTS.borderStyle);
  block.dataset.borderColor = (typeof opts.borderColor === 'string' && _MDL_COLOR_RE.test(opts.borderColor.trim())) ? opts.borderColor.trim() : MODAL_DEFAULTS.borderColor;
  if (isDashed && opts.bg === undefined) block.dataset.bg = 'transparent';
  block.dataset.wMode = opts.wMode === 'fixed' ? 'fixed' : MODAL_DEFAULTS.wMode;
  block.dataset.width = String(Number.isFinite(Number(opts.width)) ? Number(opts.width) : MODAL_DEFAULTS.width);
  block.dataset.hMode = opts.hMode === 'fixed' ? 'fixed' : MODAL_DEFAULTS.hMode;
  block.dataset.height = String(Number.isFinite(Number(opts.height)) ? Number(opts.height) : MODAL_DEFAULTS.height);
  block.dataset.align = ['left', 'center', 'right'].includes(opts.align) ? opts.align : MODAL_DEFAULTS.align;
  block.dataset.textColor = (typeof opts.textColor === 'string' && _MDL_COLOR_RE.test(opts.textColor.trim())) ? opts.textColor.trim() : MODAL_DEFAULTS.textColor;
  block.dataset.fontSize = String(Number.isFinite(Number(opts.fontSize)) ? Number(opts.fontSize) : MODAL_DEFAULTS.fontSize);
  block.dataset.gap = String(Number.isFinite(Number(opts.gap)) ? Number(opts.gap) : MODAL_DEFAULTS.gap);
  block.dataset.iconSize = String(Number.isFinite(Number(opts.iconSize)) ? Number(opts.iconSize) : MODAL_DEFAULTS.iconSize);
  block.dataset.iconColor = (typeof opts.iconColor === 'string' && _MDL_COLOR_RE.test(opts.iconColor.trim())) ? opts.iconColor.trim() : MODAL_DEFAULTS.iconColor;
  // 글자는 비워 둔다 → render 가 placeholder 를 그린다(새로 추가하면 흐린 안내문구가 보인다)
  if (typeof opts.title === 'string') block.dataset.titleText = opts.title;
  if (typeof opts.text === 'string') block.dataset.textText = opts.text;
  if (typeof opts.cell1 === 'string') block.dataset.cell1 = opts.cell1;
  if (typeof opts.cell2 === 'string') block.dataset.cell2 = opts.cell2;

  renderModalBlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addModalBlock(opts = {}) {
  // FRAMEICON 패턴 — free-layout/fullWidth 프레임 안이면 _insertToFlowFrame 이 전부 처리한다.
  let made = null;
  if (window._insertToFlowFrame?.(() => (made = makeModalBlock(opts)))) {
    if (made) { renderModalBlock(made.block); try { window.selectBlock?.(made.block.id); } catch (_) {} }
    window.triggerAutoSave?.();
    return made;
  }
  const sec = window.getSelectedSection?.();
  if (!sec) { showNoSelectionHint?.(); return null; }
  window.pushHistory?.();
  const { row, block } = made || makeModalBlock(opts);
  insertAfterSelected(sec, row);
  renderModalBlock(block);
  bindBlock(block);
  window.buildLayerPanel?.();
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
  return { row, block };
}

/* 슬롯 글자 커밋 — 편집이 끝나면 DOM 이 아니라 «dataset» 에 쓴다.
   그래야 재렌더·저장·로드가 같은 값을 본다(grid 의 _gridEndEdit 과 같은 규율). */
function commitModalSlot(block, slot, text) {
  if (!block || !slot) return false;
  const key = { title: 'titleText', text: 'textText', cell1: 'cell1', cell2: 'cell2' }[slot];
  if (!key) return false;
  const next = String(text ?? '');
  if ((block.dataset[key] || '') === next) return false;
  block.dataset[key] = next;
  return true;
}

window.makeModalBlock   = makeModalBlock;
window.addModalBlock    = addModalBlock;
window.renderModalBlock = renderModalBlock;
window.commitModalSlot  = commitModalSlot;
window.MODAL_VARIANTS   = MODAL_VARIANTS;

export { makeModalBlock, addModalBlock, renderModalBlock, commitModalSlot, MODAL_DEFAULTS, MODAL_VARIANTS, MODAL_PH };

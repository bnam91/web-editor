// banner02-block.js
// 1급 독립 배너 블록 (canvas-block 패턴 미러링). 기존 banner-presets 디자인을 자체 데이터모델로 포팅.
//   - dataset 기반 모델, renderBanner02(block)가 dataset에서 DOM 재구성 (scale-to-fit)
//   - makeBanner02Block / addBanner02Block — canvas-block과 동일 구조
import { genId, showNoSelectionHint, insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

// 기존 BANNER_PRESETS 디자인을 variant로 포팅 (런타임 의존 없이 값 복사 — 두 시스템 분리)
const BANNER02_VARIANTS = {
  frame_8: {
    label: '가로 배너',
    width: 780, height: 260, radius: 20, bg: '#f3f4f6',
    textX: 36, textY: 35, textW: 358,
    labelSize: 24, titleSize: 42, subSize: 16, gap1: 5, gap2: 10,
    imgX: 494, imgY: 5, imgW: 250, imgH: 250,
  },
  wide_4x1: {
    label: '와이드 4:1',
    width: 800, height: 200, radius: 16, bg: '#f3f4f6',
    textX: 28, textY: 28, textW: 380,
    labelSize: 20, titleSize: 32, subSize: 14, gap1: 4, gap2: 6,
    imgX: 610, imgY: 10, imgW: 180, imgH: 180,
  },
};

function _variant(key) { return BANNER02_VARIANTS[key] || BANNER02_VARIANTS.frame_8; }

// ── 렌더 ────────────────────────────────────────────────────────────────────
function renderBanner02(block) {
  const d = block.dataset;
  const designW = parseInt(d.bannerW) || 780;
  const designH = parseInt(d.bannerH) || 260;
  const radius  = parseInt(d.radius) || 0;
  const bg      = d.bg || '#f3f4f6';
  const align   = d.align || 'left';

  // 외곽
  block.style.position = 'relative';
  block.style.overflow = 'hidden';
  block.style.borderRadius = radius + 'px';
  block.style.background = bg;
  block.style.width = '100%';
  block.style.maxWidth = designW + 'px';
  block.style.margin = '0 auto';

  let inner = block.querySelector('.bn2-inner');
  if (!inner) { inner = document.createElement('div'); inner.className = 'bn2-inner'; block.appendChild(inner); }
  inner.innerHTML = '';
  inner.style.cssText = `position:absolute;top:0;left:0;right:auto;bottom:auto;width:${designW}px;height:${designH}px;transform-origin:top left;`;

  // 텍스트 영역 (라벨/제목/부제)
  const tx = document.createElement('div');
  tx.className = 'bn2-text';
  tx.style.cssText = `position:absolute;left:${parseInt(d.textX)||36}px;top:${parseInt(d.textY)||35}px;width:${parseInt(d.textW)||358}px;display:flex;flex-direction:column;align-items:${align==='center'?'center':align==='right'?'flex-end':'flex-start'};text-align:${align};`;
  const mkLine = (cls, field, size, color, gapTop) => {
    const el = document.createElement('div');
    el.className = 'bn2-' + cls;
    el.textContent = d[field] || '';
    el.style.cssText = `font-size:${size}px;color:${color};line-height:1.25;width:100%;white-space:pre-wrap;word-break:break-word;${gapTop?`margin-top:${gapTop}px;`:''}`;
    el.setAttribute('contenteditable', 'false');
    el.dataset.field = field;
    el.addEventListener('dblclick', e => {
      e.stopPropagation();
      el.setAttribute('contenteditable', 'true'); el.focus();
    });
    el.addEventListener('blur', () => {
      el.setAttribute('contenteditable', 'false');
      block.dataset[field] = el.textContent;
      window.pushHistory?.(); window.scheduleAutoSave?.();
      if (block.classList.contains('selected')) window.showBanner02Properties?.(block);
    });
    return el;
  };
  tx.appendChild(mkLine('label', 'label', parseInt(d.labelSize)||24, d.labelColor||'#000000', 0));
  tx.appendChild(mkLine('title', 'title', parseInt(d.titleSize)||42, d.titleColor||'#000000', parseInt(d.gap1)||5));
  tx.appendChild(mkLine('sub',   'sub',   parseInt(d.subSize)||16, d.subColor||'#000000', parseInt(d.gap2)||10));
  inner.appendChild(tx);

  // 이미지 영역
  const img = document.createElement('div');
  img.className = 'bn2-img';
  const fit = d.imgFit || 'cover';
  img.style.cssText = `position:absolute;left:${parseInt(d.imgX)||494}px;top:${parseInt(d.imgY)||5}px;width:${parseInt(d.imgW)||250}px;height:${parseInt(d.imgH)||250}px;border-radius:12px;overflow:hidden;`;
  if (d.imgSrc) {
    img.style.backgroundImage = `url("${d.imgSrc}")`;
    img.style.backgroundSize = fit === 'contain' ? 'contain' : 'cover';
    img.style.backgroundPosition = 'center';
    img.style.backgroundRepeat = 'no-repeat';
  } else {
    img.style.background = 'repeating-conic-gradient(#e3e3e3 0% 25%, #efefef 0% 50%) 0 / 16px 16px';
  }
  inner.appendChild(img);

  // scale-to-fit (canvas-block 패턴)
  const applyScale = () => {
    const aw = block.offsetWidth;
    if (aw <= 0) return;
    const scale = aw / designW;
    inner.style.transform = `scale(${scale})`;
    block.style.height = (designH * scale) + 'px';
    block._bn2Scale = scale;
  };
  applyScale();
  if (block._bn2RO) block._bn2RO.disconnect();
  block._bn2RO = new ResizeObserver(applyScale);
  block._bn2RO.observe(block);
}

// ── 생성 ────────────────────────────────────────────────────────────────────
function makeBanner02Block(data = {}) {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const v = _variant(data.variant || 'frame_8');
  const block = document.createElement('div');
  block.className = 'banner02-block'; block.dataset.type = 'banner02';
  block.id = genId('bn2');
  block.dataset.layerName = data.layerName || 'Banner';
  block.dataset.variant   = data.variant || 'frame_8';
  block.dataset.bannerW   = data.width  ?? v.width;
  block.dataset.bannerH   = data.height ?? v.height;
  block.dataset.radius    = data.radius ?? v.radius;
  block.dataset.bg        = data.bg     ?? v.bg;
  block.dataset.align     = data.align  || 'left';
  block.dataset.textX     = data.textX ?? v.textX;
  block.dataset.textY     = data.textY ?? v.textY;
  block.dataset.textW     = data.textW ?? v.textW;
  block.dataset.label     = data.label ?? '라벨입니다.';
  block.dataset.labelSize  = data.labelSize ?? v.labelSize;
  block.dataset.labelColor = data.labelColor || '#000000';
  block.dataset.title      = data.title ?? '제목을 입력합니다.';
  block.dataset.titleSize  = data.titleSize ?? v.titleSize;
  block.dataset.titleColor = data.titleColor || '#000000';
  block.dataset.sub        = data.sub ?? '캡션이 입력됩니다.';
  block.dataset.subSize    = data.subSize ?? v.subSize;
  block.dataset.subColor   = data.subColor || '#000000';
  block.dataset.gap1       = data.gap1 ?? v.gap1;
  block.dataset.gap2       = data.gap2 ?? v.gap2;
  block.dataset.imgSrc     = data.imgSrc || '';
  block.dataset.imgX       = data.imgX ?? v.imgX;
  block.dataset.imgY       = data.imgY ?? v.imgY;
  block.dataset.imgW       = data.imgW ?? v.imgW;
  block.dataset.imgH       = data.imgH ?? v.imgH;
  block.dataset.imgFit     = data.imgFit || 'cover';

  renderBanner02(block);
  row.appendChild(block);
  return { row, block };
}

function addBanner02Block(opts = {}) {
  // freeLayout 프레임 내부 삽입 — 별도 경로
  if (window._insertToFlowFrame?.(() => makeBanner02Block(opts))) {
    // freeLayout 경로는 row를 반환하지 않으므로 추가 후 마지막 banner02 추정 필요 — 호출자가 사용 X
    return null;
  }
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return null; }
  window.pushHistory();
  const { row, block } = makeBanner02Block(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel?.();
  window.selectSection?.(sec);
  window.scheduleAutoSave?.();
  return { row, block };
}

// ── 수정 ────────────────────────────────────────────────────────────────────
// PM의 update_banner02_block(MCP) → main(_invokeRendererUpdateBanner02Block) → 여기.
// add_text_block의 editTextBlock 패턴 미러링: pushHistory + dataset partial write + renderBanner02 재렌더 + scheduleAutoSave.
// 지원 필드 (data-* 매핑):
//   - 변형: variant
//   - 외곽: width(bannerW), height(bannerH), radius, bg, align
//   - 텍스트 박스: textX/textY/textW
//   - 텍스트: label/labelSize/labelColor, title/titleSize/titleColor, sub/subSize/subColor, gap1, gap2
//   - 이미지: imgSrc, imgX/imgY/imgW/imgH, imgFit
//   - 편의: layout: 'left'|'right'  (text/img 좌우 swap — variant 기본 textX/imgX 사용)
function updateBanner02Block(blockId, partial = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('banner02-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `banner02-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }

  // before 스냅샷 (mutate 전, undo 푸시 전)
  const before = {
    variant: block.dataset.variant,
    label: block.dataset.label, title: block.dataset.title, sub: block.dataset.sub,
    imgSrc: block.dataset.imgSrc, bg: block.dataset.bg, align: block.dataset.align,
  };

  window.pushHistory?.();

  const applied = {};

  // 1) variant 스왑 — variant 키만 바뀌고 나머지는 유지 (Codex 안전성: 정의된 키만 허용)
  if (partial.variant !== undefined) {
    if (!BANNER02_VARIANTS[partial.variant]) {
      return { ok: false, code: 'INVALID', message: `invalid variant: ${partial.variant}` };
    }
    block.dataset.variant = String(partial.variant);
    applied.variant = block.dataset.variant;
  }

  // 2) 외곽
  const _setNum = (datasetKey, value, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    if (min !== undefined && n < min) return false;
    if (max !== undefined && n > max) return false;
    block.dataset[datasetKey] = String(n);
    return true;
  };
  if (partial.width  !== undefined) { if (_setNum('bannerW', partial.width, 80, 4000))  applied.width  = Number(partial.width); }
  if (partial.height !== undefined) { if (_setNum('bannerH', partial.height, 40, 4000)) applied.height = Number(partial.height); }
  if (partial.radius !== undefined) { if (_setNum('radius',  partial.radius, 0, 400))   applied.radius = Number(partial.radius); }
  if (partial.bg !== undefined && partial.bg !== null) {
    block.dataset.bg = String(partial.bg);
    applied.bg = block.dataset.bg;
  }
  if (partial.align !== undefined) {
    if (!['left','center','right'].includes(partial.align)) {
      return { ok: false, code: 'INVALID', message: `invalid align: ${partial.align}` };
    }
    block.dataset.align = partial.align;
    applied.align = partial.align;
  }

  // 3) 텍스트 박스
  if (partial.textX !== undefined) { if (_setNum('textX', partial.textX, -4000, 4000)) applied.textX = Number(partial.textX); }
  if (partial.textY !== undefined) { if (_setNum('textY', partial.textY, -4000, 4000)) applied.textY = Number(partial.textY); }
  if (partial.textW !== undefined) { if (_setNum('textW', partial.textW, 20, 4000))    applied.textW = Number(partial.textW); }

  // 4) 텍스트 콘텐츠/스타일 (renderBanner02가 textContent로 박으므로 XSS-safe)
  const _setStr = (datasetKey, value, maxLen) => {
    const s = String(value);
    if (maxLen !== undefined && [...s].length > maxLen) return null;
    block.dataset[datasetKey] = s;
    return s;
  };
  if (partial.label      !== undefined && partial.label !== null)      { const v = _setStr('label',      partial.label,      500); if (v !== null) applied.label = v; }
  if (partial.title      !== undefined && partial.title !== null)      { const v = _setStr('title',      partial.title,      500); if (v !== null) applied.title = v; }
  if (partial.sub        !== undefined && partial.sub !== null)        { const v = _setStr('sub',        partial.sub,        500); if (v !== null) applied.sub = v; }
  if (partial.labelSize  !== undefined) { if (_setNum('labelSize',  partial.labelSize,  4, 400)) applied.labelSize  = Number(partial.labelSize); }
  if (partial.titleSize  !== undefined) { if (_setNum('titleSize',  partial.titleSize,  4, 400)) applied.titleSize  = Number(partial.titleSize); }
  if (partial.subSize    !== undefined) { if (_setNum('subSize',    partial.subSize,    4, 400)) applied.subSize    = Number(partial.subSize); }
  if (partial.labelColor !== undefined && partial.labelColor !== null) { block.dataset.labelColor = String(partial.labelColor); applied.labelColor = block.dataset.labelColor; }
  if (partial.titleColor !== undefined && partial.titleColor !== null) { block.dataset.titleColor = String(partial.titleColor); applied.titleColor = block.dataset.titleColor; }
  if (partial.subColor   !== undefined && partial.subColor !== null)   { block.dataset.subColor   = String(partial.subColor);   applied.subColor   = block.dataset.subColor; }
  if (partial.gap1 !== undefined) { if (_setNum('gap1', partial.gap1, 0, 400)) applied.gap1 = Number(partial.gap1); }
  if (partial.gap2 !== undefined) { if (_setNum('gap2', partial.gap2, 0, 400)) applied.gap2 = Number(partial.gap2); }

  // 5) 이미지 — imgSrc는 renderBanner02에서 url("...") template에 들어가므로 escape 필요
  if (partial.imgSrc !== undefined && partial.imgSrc !== null) {
    const src = String(partial.imgSrc);
    // 길이 가드 (data URL 폭주 방지) + " 와 개행 차단 (CSS url("") 깨짐/탈출 방지)
    if (src.length > 200000) {
      return { ok: false, code: 'TOO_LARGE', message: `imgSrc too long (>200000)` };
    }
    if (/["\r\n]/.test(src)) {
      return { ok: false, code: 'INVALID', message: 'imgSrc contains quote/newline (escape unsafe)' };
    }
    block.dataset.imgSrc = src;
    applied.imgSrc = src;
  }
  if (partial.imgX !== undefined) { if (_setNum('imgX', partial.imgX, -4000, 4000)) applied.imgX = Number(partial.imgX); }
  if (partial.imgY !== undefined) { if (_setNum('imgY', partial.imgY, -4000, 4000)) applied.imgY = Number(partial.imgY); }
  if (partial.imgW !== undefined) { if (_setNum('imgW', partial.imgW, 4, 4000))     applied.imgW = Number(partial.imgW); }
  if (partial.imgH !== undefined) { if (_setNum('imgH', partial.imgH, 4, 4000))     applied.imgH = Number(partial.imgH); }
  if (partial.imgFit !== undefined) {
    if (!['cover','contain'].includes(partial.imgFit)) {
      return { ok: false, code: 'INVALID', message: `invalid imgFit: ${partial.imgFit}` };
    }
    block.dataset.imgFit = partial.imgFit;
    applied.imgFit = partial.imgFit;
  }

  // 6) layout swap — text/img 좌우 위치 swap (편의 필드).
  // 현재 dataset의 textX/imgX 값을 swap. layout='left'면 text가 왼쪽(textX<imgX), 'right'면 그 반대.
  if (partial.layout !== undefined) {
    if (!['left','right'].includes(partial.layout)) {
      return { ok: false, code: 'INVALID', message: `invalid layout: ${partial.layout}` };
    }
    const tx = parseInt(block.dataset.textX) || 0;
    const ix = parseInt(block.dataset.imgX)  || 0;
    const textIsLeft = tx < ix;
    if ((partial.layout === 'left' && !textIsLeft) || (partial.layout === 'right' && textIsLeft)) {
      block.dataset.textX = String(ix);
      block.dataset.imgX  = String(tx);
    }
    applied.layout = partial.layout;
  }

  // 7) 재렌더 (변경 없어도 idempotent — Codex round-trip 안전성)
  try {
    renderBanner02(block);
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  // 8) 우측 패널 갱신 (선택 상태일 때만)
  if (block.classList.contains('selected')) {
    try { window.showBanner02Properties?.(block); } catch (_) {}
  }
  // 9) 레이어 패널 (layerName 변경 가능성 대비)
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

window.makeBanner02Block   = makeBanner02Block;
window.addBanner02Block    = addBanner02Block;
window.updateBanner02Block = updateBanner02Block;
window.renderBanner02      = renderBanner02;
window.BANNER02_VARIANTS   = BANNER02_VARIANTS;

export { makeBanner02Block, addBanner02Block, updateBanner02Block, renderBanner02, BANNER02_VARIANTS };

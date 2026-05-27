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
  if (window._insertToFlowFrame?.(() => makeBanner02Block(opts))) return;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  window.pushHistory();
  const { row, block } = makeBanner02Block(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

window.makeBanner02Block = makeBanner02Block;
window.addBanner02Block  = addBanner02Block;
window.renderBanner02    = renderBanner02;
window.BANNER02_VARIANTS = BANNER02_VARIANTS;

export { makeBanner02Block, addBanner02Block, renderBanner02, BANNER02_VARIANTS };

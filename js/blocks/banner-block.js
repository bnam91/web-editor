// ── Banner Block ───────────────────────────────────────────────────────────────
// frame-block의 변형 (data-banner-preset 속성). 신규 클래스 없음.
// 외곽 frame-block + 자식(text/asset/gap/inner frame) 트리.
//
// 의존성:
//   - makeFrameBlock, makeTextBlock, makeAssetBlock, makeGapBlock (block-factory.js ES export)
//   - insertAfterSelected (drag-utils.js)
//   - bindBlock (drag-drop.js)
//   - window.BANNER_PRESETS (banner-presets.js)
//   - window._makeTextFrame, window.applyTextOpts (block-factory.js 노출 헬퍼)

import {
  makeFrameBlock,
  makeTextBlock,
  makeAssetBlock,
  makeGapBlock,
} from '../block-factory.js';
import { insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

function _resetFrameToBannerOuter(ss, frameSpec) {
  delete ss.dataset.freeLayout;
  delete ss.dataset.fullWidth;
  delete ss.dataset.height;
  ss.style.cssText = '';
  ss.dataset.bg = frameSpec.bg || 'transparent';
  if (frameSpec.radius !== undefined) ss.dataset.radius = String(frameSpec.radius);

  if (frameSpec.mode === 'freeLayout') {
    // 외곽 height는 inner flow content를 따라가도록 auto + min-height만 지정.
    // asset 등 absolute 자식은 외곽 height에 영향 없음.
    ss.dataset.freeLayout = 'true';
    ss.dataset.width  = String(frameSpec.width);
    ss.dataset.padY   = '0';
    let css = `background:${frameSpec.bg};padding:0;width:${frameSpec.width}px;max-width:100%;margin:0 auto;min-height:${frameSpec.height}px;`;
    if (frameSpec.radius) css += `border-radius:${frameSpec.radius}px;overflow:hidden;`;
    ss.style.cssText = css;
  } else if (frameSpec.mode === 'fullWidth') {
    ss.dataset.fullWidth = 'true';
    let css = `background:${frameSpec.bg};width:100%;box-sizing:border-box;`;
    if (frameSpec.radius) css += `border-radius:${frameSpec.radius}px;overflow:hidden;`;
    ss.style.cssText = css;
  }
}

function _injectBannerChild(parentFrame, child) {
  const isFree = parentFrame.dataset.freeLayout === 'true';

  if (child.kind === 'frame') {
    const isStackInner = child.mode === 'stack';
    const inner = makeFrameBlock({
      bg: child.bg,
      radius: child.radius,
      fullWidth: isStackInner,
    });
    if (isStackInner) {
      // stack inner: 초기 너비만 지정, 자동 높이. 사용자가 핸들로 너비 조절 가능.
      inner.style.width    = child.width + 'px';
      inner.style.minHeight = '';
      inner.style.height    = '';
      inner.dataset.width  = String(child.width);
      delete inner.dataset.height;
      if (isFree) {
        // 외곽 freeLayout이지만 inner는 absolute 대신 margin으로 위치잡아 외곽 height 추적.
        inner.style.marginLeft   = (child.x ?? 0) + 'px';
        inner.style.marginTop    = (child.y ?? 0) + 'px';
        inner.style.marginBottom = (child.y ?? 0) + 'px';
      }
    } else if (child.mode === 'freeLayout') {
      inner.dataset.width  = String(child.width);
      inner.dataset.height = String(child.height);
      inner.style.width    = child.width  + 'px';
      inner.style.height   = child.height + 'px';
      inner.style.minHeight = child.height + 'px';
      if (isFree) {
        inner.style.position = 'absolute';
        inner.style.left  = (child.x ?? 0) + 'px';
        inner.style.top   = (child.y ?? 0) + 'px';
        inner.style.margin = '0';
        inner.dataset.offsetX = String(child.x ?? 0);
        inner.dataset.offsetY = String(child.y ?? 0);
      }
    }
    parentFrame.appendChild(inner);
    window.bindFrameDropZone?.(inner);
    (child.children || []).forEach(gc => _injectBannerChild(inner, gc));
    return;
  }

  if (child.kind === 'text') {
    const { block } = makeTextBlock(child.textType || 'body');
    const tf = window._makeTextFrame();
    window.applyTextOpts(block, tf, {
      content: child.content, color: child.color,
      fontSize: child.fontSize, align: child.align,
    }, child.textType);
    tf.appendChild(block);
    if (isFree) {
      tf.style.position = 'absolute';
      tf.style.left = (child.x ?? 0) + 'px';
      tf.style.top  = (child.y ?? 0) + 'px';
      if (child.width) tf.style.width = child.width + 'px';
      tf.dataset.offsetX = String(child.x ?? 0);
      tf.dataset.offsetY = String(child.y ?? 0);
    }
    parentFrame.appendChild(tf);
    bindBlock(block);
    return;
  }

  if (child.kind === 'asset') {
    const { row, block } = makeAssetBlock();
    block.style.width  = child.width  + 'px';
    block.style.height = child.height + 'px';
    if (child.src) {
      block.style.backgroundImage = `url("${child.src}")`;
      block.style.backgroundSize = 'cover';
      block.style.backgroundPosition = 'center';
      block.dataset.bgImg = child.src;
    }
    if (isFree) {
      block.style.position = 'absolute';
      block.style.left = (child.x ?? 0) + 'px';
      block.style.top  = (child.y ?? 0) + 'px';
      block.style.alignSelf = '';
      block.dataset.offsetX = String(child.x ?? 0);
      block.dataset.offsetY = String(child.y ?? 0);
      parentFrame.appendChild(block);
    } else {
      parentFrame.appendChild(row);
    }
    bindBlock(block);
    return;
  }

  if (child.kind === 'gap') {
    if (!isFree) {
      const gb = makeGapBlock();
      gb.style.height = (child.height || 24) + 'px';
      parentFrame.appendChild(gb);
      bindBlock(gb);
    }
    return;
  }
}

function _applyBannerPreset(frameEl, presetKey) {
  const preset = window.BANNER_PRESETS?.[presetKey];
  if (!preset) { console.warn('[banner] unknown preset:', presetKey); return; }
  while (frameEl.firstChild) frameEl.removeChild(frameEl.firstChild);
  _resetFrameToBannerOuter(frameEl, preset.frame);
  frameEl.dataset.bannerPreset = presetKey;
  (preset.children || []).forEach(c => _injectBannerChild(frameEl, c));
  window.bindFrameDropZone?.(frameEl);
  window.buildLayerPanel?.();
  window.triggerAutoSave?.();
}

function addBannerBlock(presetKey = 'frame_8') {
  const preset = window.BANNER_PRESETS?.[presetKey];
  if (!preset) { console.warn('[banner] unknown preset:', presetKey); return; }
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return; }
  window.pushHistory();

  // _resetFrameToBannerOuter가 외곽 dataset/style 일괄 셋업 — single source of truth
  const ss = makeFrameBlock();
  _resetFrameToBannerOuter(ss, preset.frame);
  ss.dataset.bannerPreset = presetKey;

  insertAfterSelected(sec, ss);
  window.bindFrameDropZone?.(ss);

  (preset.children || []).forEach(c => _injectBannerChild(ss, c));

  window.buildLayerPanel();
  window.deselectAll?.();
  sec.classList.add('selected');
  window.syncLayerActive?.(sec);
  ss.classList.add('selected');
  window._activeFrame = ss;
  window.showFrameProperties?.(ss);
  window.showFrameHandles?.(ss);
  window.triggerAutoSave?.();
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.addBannerBlock     = addBannerBlock;
window._applyBannerPreset = _applyBannerPreset;

export { addBannerBlock, _applyBannerPreset };

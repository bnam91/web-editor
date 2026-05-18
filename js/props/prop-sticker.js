import { propPanel } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function showStickerProperties(block) {
  const shape      = block.dataset.shape      || 'circle';
  const size       = parseInt(block.dataset.size)       || 60;
  const text       = block.dataset.text ?? 'NEW';
  const bgColor    = block.dataset.bgColor    || '#e74c3c';
  const textColor  = block.dataset.textColor  || '#ffffff';
  const fontSize   = parseInt(block.dataset.fontSize)   || 14;
  const fontWeight = parseInt(block.dataset.fontWeight) || 700;
  const bgAlpha    = parseAlphaFromColor(bgColor);
  const txtAlpha   = parseAlphaFromColor(textColor);

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3"><circle cx="6" cy="6" r="4.5"/></svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Sticker'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard?.('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Text</div>
      <div class="prop-row">
        <input type="text" class="prop-input" id="stk-text" value="${_esc(text)}" placeholder="텍스트">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Shape</div>
      <div class="prop-row">
        <div class="prop-align-group" id="stk-shape-group">
          <button class="prop-align-btn${shape === 'circle' ? ' active' : ''}" data-shape="circle" title="원형">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.5"/></svg>
          </button>
          <button class="prop-align-btn${shape === 'square' ? ' active' : ''}" data-shape="square" title="사각">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2.5" width="11" height="11" rx="1"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="range" class="prop-slider" id="stk-size" min="20" max="300" step="2" value="${size}">
        <input type="number" class="prop-number" id="stk-size-num" min="10" max="600" value="${size}">
      </div>
      <div class="prop-row">
        <span class="prop-label">폰트 크기</span>
        <input type="range" class="prop-slider" id="stk-fs" min="8" max="72" step="1" value="${fontSize}">
        <input type="number" class="prop-number" id="stk-fs-num" min="6" max="150" value="${fontSize}">
      </div>
      <div class="prop-row">
        <span class="prop-label">폰트 굵기</span>
        <select class="prop-select" id="stk-fw">
          <option value="300" ${fontWeight === 300 ? 'selected' : ''}>Light</option>
          <option value="400" ${fontWeight === 400 ? 'selected' : ''}>Regular</option>
          <option value="500" ${fontWeight === 500 ? 'selected' : ''}>Medium</option>
          <option value="600" ${fontWeight === 600 ? 'selected' : ''}>Semibold</option>
          <option value="700" ${fontWeight === 700 ? 'selected' : ''}>Bold</option>
          <option value="800" ${fontWeight === 800 ? 'selected' : ''}>Extrabold</option>
          <option value="900" ${fontWeight === 900 ? 'selected' : ''}>Black</option>
        </select>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Colors</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        ${colorFieldHTML({ idPrefix: 'stk-bg', hex: bgColor, alpha: bgAlpha })}
      </div>
      <div class="prop-color-row">
        <span class="prop-label">글자색</span>
        ${colorFieldHTML({ idPrefix: 'stk-txt', hex: textColor, alpha: txtAlpha })}
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const rerender = () => window.renderStickerBlock?.(block);

  // 텍스트 — input에선 .sticker-text textContent만 직접 갱신(rerender 시 캐럿 보존 X)
  const txt = propPanel.querySelector('#stk-text');
  txt.addEventListener('input', () => {
    block.dataset.text = txt.value;
    const t = block.querySelector('.sticker-text');
    if (t) t.textContent = txt.value;
  });
  txt.addEventListener('change', () => { window.pushHistory?.('스티커 텍스트'); window.scheduleAutoSave?.(); });

  // Shape 토글
  propPanel.querySelectorAll('#stk-shape-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      propPanel.querySelectorAll('#stk-shape-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      block.dataset.shape = btn.dataset.shape;
      rerender();
      window.pushHistory?.('스티커 모양'); window.scheduleAutoSave?.();
    });
  });

  // Size pair
  const bindNumPair = (sliderId, numberId, key, min, max) => {
    const s = propPanel.querySelector('#' + sliderId);
    const n = propPanel.querySelector('#' + numberId);
    const apply = v => {
      v = Math.min(max, Math.max(min, v));
      block.dataset[key] = v;
      rerender();
      s.value = Math.min(parseInt(s.max), v);
      n.value = v;
    };
    s.addEventListener('input',  () => apply(parseInt(s.value)));
    n.addEventListener('change', () => { apply(parseInt(n.value)); window.pushHistory?.(); window.scheduleAutoSave?.(); });
    s.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  };
  bindNumPair('stk-size', 'stk-size-num', 'size',     10, 600);
  bindNumPair('stk-fs',   'stk-fs-num',   'fontSize', 6,  150);

  // Font weight
  propPanel.querySelector('#stk-fw').addEventListener('change', e => {
    block.dataset.fontWeight = e.target.value;
    rerender();
    window.pushHistory?.('스티커 굵기'); window.scheduleAutoSave?.();
  });

  // Colors
  wireColorField('stk-bg', {
    initialAlpha: bgAlpha,
    onApply: (c) => { block.dataset.bgColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('스티커 배경'); window.scheduleAutoSave?.(); },
  });
  wireColorField('stk-txt', {
    initialAlpha: txtAlpha,
    onApply: (c) => { block.dataset.textColor = c; rerender(); },
    onCommit: () => { window.pushHistory?.('스티커 글자색'); window.scheduleAutoSave?.(); },
  });
}

window.showStickerProperties = showStickerProperties;

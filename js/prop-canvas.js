/* ══════════════════════════════════════
   PROP-CANVAS — Canvas Block / Item 프로퍼티 패널
══════════════════════════════════════ */
import { propPanel } from './globals.js';

/* ── Canvas Block 속성 ── */
export function showCanvasProperties(cb) {
  const h  = parseInt(cb.style.height) || 500;
  const bg = cb.dataset.bg || '#f8f8f8';

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1.5"/>
            <line x1="1" y1="4.5" x2="11" y2="4.5" stroke-dasharray="2 1.5"/>
            <line x1="4.5" y1="4.5" x2="4.5" y2="11" stroke-dasharray="2 1.5"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">Canvas Block</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(cb) || ''}</span>
        </div>
        ${cb.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${cb.id}')">${cb.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">캔버스 크기</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range"  class="prop-slider" id="cb-h-slider" min="100" max="2000" step="10" value="${h}">
        <input type="number" class="prop-number" id="cb-h-number" min="100" max="2000" value="${h}">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${bg}">
          <input type="color" id="cb-bg-color" value="${bg}">
        </div>
        <input type="text" class="prop-color-hex" id="cb-bg-hex" value="${bg}" maxlength="7">
        <button class="prop-align-btn" id="cb-bg-clear">초기화</button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">요소 추가</div>
      <button class="prop-action-btn primary"   id="cb-add-image">이미지 추가</button>
      <button class="prop-action-btn secondary" id="cb-add-text">텍스트 추가</button>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(cb.id || null);

  const hSlider = document.getElementById('cb-h-slider');
  const hNumber = document.getElementById('cb-h-number');
  hSlider.addEventListener('mousedown', () => window.pushHistory?.());
  hSlider.addEventListener('input', () => { cb.style.height = hSlider.value + 'px'; hNumber.value = hSlider.value; });
  hNumber.addEventListener('change', () => {
    const v = Math.min(2000, Math.max(100, parseInt(hNumber.value) || 500));
    cb.style.height = v + 'px'; hSlider.value = v; window.pushHistory?.();
  });

  const bgInput  = document.getElementById('cb-bg-color');
  const bgHex    = document.getElementById('cb-bg-hex');
  const bgSwatch = bgHex?.previousElementSibling;
  const applyBg  = val => {
    cb.style.background = val; cb.dataset.bg = val;
    bgInput.value = val; bgHex.value = val;
    if (bgSwatch) bgSwatch.style.background = val;
  };
  bgInput.addEventListener('input', e => applyBg(e.target.value));
  bgInput.addEventListener('change', () => window.pushHistory?.());
  bgHex.addEventListener('change', e => {
    const v = e.target.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { applyBg(v); window.pushHistory?.(); }
  });
  document.getElementById('cb-bg-clear').addEventListener('click', () => {
    applyBg('#f8f8f8'); window.pushHistory?.();
  });

  // 이미지 추가
  document.getElementById('cb-add-image').addEventListener('click', () => {
    const item = window.addItemToCanvas(cb, 'image');
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        item.dataset.src = ev.target.result;
        let img = item.querySelector('.ci-img');
        if (!img) {
          img = document.createElement('img');
          img.className = 'ci-img'; img.draggable = false;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;border-radius:inherit;';
          item.appendChild(img);
        }
        img.src = ev.target.result;
        window.pushHistory?.();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });

  document.getElementById('cb-add-text').addEventListener('click', () => {
    window.addItemToCanvas(cb, 'text');
  });
}

/* ── Canvas Item 속성 ── */
export function showCanvasItemProperties(cb, item) {
  const x = Math.round(parseFloat(item.dataset.x) || 0);
  const y = Math.round(parseFloat(item.dataset.y) || 0);
  const w = Math.round(parseFloat(item.dataset.w) || 200);
  const h = Math.round(parseFloat(item.dataset.h) || 100);
  const type = item.dataset.type;
  const typeLabel = type === 'image' ? '이미지' : '텍스트';
  const fontSize  = parseInt(item.querySelector('.ci-text')?.style.fontSize) || 24;
  const textColor = item.querySelector('.ci-text')?.style.color || '#111111';

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            ${type === 'image'
              ? '<rect x="1" y="1" width="10" height="10" rx="1"/><circle cx="4" cy="4" r="1"/><polyline points="11 8 8 5 3 11"/>'
              : '<line x1="2" y1="3" x2="10" y2="3"/><line x1="2" y1="6" x2="8" y2="6"/><line x1="2" y1="9" x2="6" y2="9"/>'}
          </svg>
        </div>
        <span class="prop-block-name">${typeLabel} 요소</span>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">위치 / 크기</div>
      <div class="prop-row">
        <span class="prop-icon-label">X</span>
        <input type="number" class="prop-number" id="ci-x" value="${x}">
        <span class="prop-icon-label">Y</span>
        <input type="number" class="prop-number" id="ci-y" value="${y}">
      </div>
      <div class="prop-row">
        <span class="prop-icon-label">W</span>
        <input type="number" class="prop-number" id="ci-w" value="${w}">
        <span class="prop-icon-label">H</span>
        <input type="number" class="prop-number" id="ci-h" value="${h}">
      </div>
    </div>
    ${type === 'text' ? `
    <div class="prop-section">
      <div class="prop-section-title">텍스트</div>
      <div class="prop-row">
        <span class="prop-label">크기</span>
        <input type="number" class="prop-number" id="ci-fs" value="${fontSize}" min="8" max="400">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">색상</span>
        <div class="prop-color-swatch" style="background:${textColor}">
          <input type="color" id="ci-color" value="${textColor}">
        </div>
        <input type="text" class="prop-color-hex" id="ci-color-hex" value="${textColor}" maxlength="7">
      </div>
    </div>` : ''}
    <div class="prop-section">
      <div class="prop-section-title">레이어 순서</div>
      <div class="prop-align-group">
        <button class="prop-align-btn" id="ci-bring">↑ 앞으로</button>
        <button class="prop-align-btn" id="ci-send">↓ 뒤로</button>
      </div>
    </div>
    <div class="prop-section">
      <button class="prop-action-btn secondary" id="ci-back-cb">← 캔버스 속성</button>
      <button class="prop-action-btn secondary" id="ci-duplicate">복제 (⌘D)</button>
      <button class="prop-action-btn danger"    id="ci-delete">요소 삭제</button>
    </div>`;

  // 위치/크기 change
  const applyGeom = () => {
    const nx = parseInt(document.getElementById('ci-x')?.value) || 0;
    const ny = parseInt(document.getElementById('ci-y')?.value) || 0;
    const nw = Math.max(40, parseInt(document.getElementById('ci-w')?.value) || 40);
    const nh = Math.max(20, parseInt(document.getElementById('ci-h')?.value) || 20);
    item.dataset.x = nx; item.dataset.y = ny;
    item.dataset.w = nw; item.dataset.h = nh;
    item.style.left = nx+'px'; item.style.top = ny+'px';
    item.style.width = nw+'px'; item.style.height = nh+'px';
    window.syncCanvasItemHandles?.(item);
  };
  ['ci-x','ci-y','ci-w','ci-h'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { applyGeom(); window.pushHistory?.(); });
  });

  // 텍스트 속성
  if (type === 'text') {
    const textEl    = item.querySelector('.ci-text');
    const colorIn   = document.getElementById('ci-color');
    const colorHex  = document.getElementById('ci-color-hex');
    const colorSwatch = colorHex?.previousElementSibling;
    const applyColor = val => {
      if (textEl) textEl.style.color = val;
      if (colorIn)     colorIn.value  = val;
      if (colorHex)    colorHex.value = val;
      if (colorSwatch) colorSwatch.style.background = val;
    };
    document.getElementById('ci-fs')?.addEventListener('change', e => {
      const v = Math.min(400, Math.max(8, parseInt(e.target.value) || 24));
      if (textEl) textEl.style.fontSize = v + 'px';
      window.pushHistory?.();
    });
    colorIn?.addEventListener('input',  e => applyColor(e.target.value));
    colorIn?.addEventListener('change', () => window.pushHistory?.());
    colorHex?.addEventListener('change', e => {
      const v = e.target.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) { applyColor(v); window.pushHistory?.(); }
    });
  }

  document.getElementById('ci-bring')?.addEventListener('click', () => window.bringForward?.());
  document.getElementById('ci-send')?.addEventListener('click',  () => window.sendBackward?.());
  document.getElementById('ci-back-cb')?.addEventListener('click', () => showCanvasProperties(cb));
  document.getElementById('ci-duplicate')?.addEventListener('click', () => window.duplicateSelectedItem?.());
  document.getElementById('ci-delete')?.addEventListener('click', () => window.removeSelectedItem?.());
}

window.showCanvasProperties     = showCanvasProperties;
window.showCanvasItemProperties = showCanvasItemProperties;

import { propPanel, state } from './globals.js';

export function showDividerProperties(block) {
  const lineColor  = block.dataset.lineColor  || '#cccccc';
  const lineStyle  = block.dataset.lineStyle  || 'solid';
  const lineWeight = parseInt(block.dataset.lineWeight) || 1;
  const padV       = parseInt(block.dataset.padV)       || 12;
  const padH       = parseInt(block.dataset.padH)       || 0;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="6" x2="11" y2="6"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Divider'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(block)}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">선 스타일</div>
      <div class="prop-color-row">
        <span class="prop-label">색상</span>
        <div class="prop-color-swatch" style="background:${lineColor}">
          <input type="color" id="dvd-color" value="${lineColor}">
        </div>
        <input type="text" class="prop-color-hex" id="dvd-hex" value="${lineColor}" maxlength="7">
      </div>
      <div class="prop-row">
        <span class="prop-label">스타일</span>
        <select class="prop-select" id="dvd-style">
          <option value="solid"  ${lineStyle==='solid'  ?'selected':''}>실선</option>
          <option value="dashed" ${lineStyle==='dashed' ?'selected':''}>파선</option>
          <option value="dotted" ${lineStyle==='dotted' ?'selected':''}>점선</option>
        </select>
      </div>
      <div class="prop-row">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="dvd-weight-slider" min="1" max="12" step="1" value="${lineWeight}">
        <input type="number" class="prop-number" id="dvd-weight-number" min="1" max="12" value="${lineWeight}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">패딩</div>
      <div class="prop-row">
        <span class="prop-label">상하 패딩</span>
        <input type="range" class="prop-slider" id="dvd-pady-slider" min="0" max="120" step="4" value="${padV}">
        <input type="number" class="prop-number" id="dvd-pady-number" min="0" max="120" value="${padV}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="dvd-padx-slider" min="0" max="200" step="4" value="${padH}">
        <input type="number" class="prop-number" id="dvd-padx-number" min="0" max="200" value="${padH}">
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  const colorPicker = document.getElementById('dvd-color');
  const colorHex    = document.getElementById('dvd-hex');
  const colorSwatch = colorPicker.closest('.prop-color-swatch');

  const applyAll = () => window.applyDividerStyle(block);

  colorPicker.addEventListener('input', () => {
    block.dataset.lineColor = colorPicker.value;
    colorHex.value = colorPicker.value;
    colorSwatch.style.background = colorPicker.value;
    applyAll();
  });
  colorPicker.addEventListener('change', () => window.pushHistory());
  colorHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(colorHex.value)) {
      block.dataset.lineColor = colorHex.value;
      colorPicker.value = colorHex.value;
      colorSwatch.style.background = colorHex.value;
      applyAll(); window.pushHistory();
    }
  });

  document.getElementById('dvd-style').addEventListener('change', e => {
    block.dataset.lineStyle = e.target.value;
    applyAll(); window.pushHistory();
  });

  const wSlider = document.getElementById('dvd-weight-slider');
  const wNumber = document.getElementById('dvd-weight-number');
  const applyWeight = v => {
    v = Math.min(12, Math.max(1, v));
    block.dataset.lineWeight = v;
    applyAll();
    wSlider.value = v; wNumber.value = v;
  };
  wSlider.addEventListener('input',  () => applyWeight(parseInt(wSlider.value)));
  wNumber.addEventListener('change', () => { applyWeight(parseInt(wNumber.value)); window.pushHistory(); });
  wSlider.addEventListener('change', () => window.pushHistory());

  const pySlider = document.getElementById('dvd-pady-slider');
  const pyNumber = document.getElementById('dvd-pady-number');
  const applyPadV = v => {
    v = Math.min(120, Math.max(0, v));
    block.dataset.padV = v;
    applyAll();
    pySlider.value = v; pyNumber.value = v;
  };
  pySlider.addEventListener('input',  () => applyPadV(parseInt(pySlider.value)));
  pyNumber.addEventListener('change', () => { applyPadV(parseInt(pyNumber.value)); window.pushHistory(); });
  pySlider.addEventListener('change', () => window.pushHistory());

  const pxSlider = document.getElementById('dvd-padx-slider');
  const pxNumber = document.getElementById('dvd-padx-number');
  const applyPadH = v => {
    v = Math.min(200, Math.max(0, v));
    block.dataset.padH = v;
    applyAll();
    pxSlider.value = v; pxNumber.value = v;
  };
  pxSlider.addEventListener('input',  () => applyPadH(parseInt(pxSlider.value)));
  pxNumber.addEventListener('change', () => { applyPadH(parseInt(pxNumber.value)); window.pushHistory(); });
  pxSlider.addEventListener('change', () => window.pushHistory());
}

// Backward compat: classic scripts call these via window.*

window.showDividerProperties = showDividerProperties;

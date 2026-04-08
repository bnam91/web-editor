import { propPanel, state } from './globals.js';

export function showGapProperties(gb) {
  const currentH = gb.offsetHeight;
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <line x1="1" y1="4" x2="11" y2="4" stroke-dasharray="2,1"/>
            <line x1="1" y1="8" x2="11" y2="8" stroke-dasharray="2,1"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${gb.dataset.layerName || 'Gap Block'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(gb)}</span>
        </div>
        ${gb.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${gb.id}')">${gb.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="gap-slider" min="0" max="400" step="4" value="${currentH}">
        <input type="number" class="prop-number" id="gap-number" min="0" max="400" value="${currentH}">
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(gb.id || null);

  const slider = document.getElementById('gap-slider');
  const number = document.getElementById('gap-number');

  slider.addEventListener('mousedown', () => { window.pushHistory?.(); });
  slider.addEventListener('input', () => {
    gb.style.height = slider.value + 'px';
    number.value = slider.value;
    window.scheduleAutoSave?.();
  });
  number.addEventListener('change', () => { window.pushHistory?.(); });
  number.addEventListener('input', () => {
    const v = Math.min(400, Math.max(0, parseInt(number.value) || 0));
    gb.style.height = v + 'px';
    slider.value = v;
    window.scheduleAutoSave?.();
  });
}


window.showGapProperties = showGapProperties;

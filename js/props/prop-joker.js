import { propPanel } from '../globals.js';

export function showJokerProperties(jb) {
  const isAbsolute = jb.style.position === 'absolute';
  const currentX = isAbsolute
    ? parseInt(jb.style.left || jb.dataset.offsetX || '0')
    : parseInt(jb.dataset.offsetX || '0');
  const currentY = isAbsolute
    ? parseInt(jb.style.top || jb.dataset.offsetY || '0')
    : parseInt(jb.dataset.offsetY || '0');
  const label = jb.dataset.label || 'Joker';

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <circle cx="6" cy="6" r="4.5"/>
            <text x="6" y="9" font-size="7" text-anchor="middle" fill="#888" stroke="none">♠</text>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${label}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(jb) || ''}</span>
        </div>
        ${jb.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${jb.id}')">${jb.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Position</div>
      <div class="prop-row">
        <span class="prop-label">X</span>
        <input type="range" class="prop-slider" id="joker-x-slider" min="0" max="860" step="1" value="${currentX}">
        <input type="number" class="prop-number" id="joker-x-number" min="0" max="860" value="${currentX}">
      </div>
      <div class="prop-row">
        <span class="prop-label">Y</span>
        <input type="range" class="prop-slider" id="joker-y-slider" min="-500" max="500" step="1" value="${currentY}">
        <input type="number" class="prop-number" id="joker-y-number" min="-500" max="500" value="${currentY}">
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(jb.id || null);

  const xSlider = document.getElementById('joker-x-slider');
  const xNumber = document.getElementById('joker-x-number');
  const ySlider = document.getElementById('joker-y-slider');
  const yNumber = document.getElementById('joker-y-number');

  function applyX(v) {
    jb.dataset.offsetX = String(v);
    if (isAbsolute) {
      jb.style.left = `${v}px`;
    } else {
      const y = parseInt(jb.dataset.offsetY || '0');
      jb.style.transform = `translate(${v}px, ${y}px)`;
    }
    window.scheduleAutoSave?.();
  }

  function applyY(v) {
    jb.dataset.offsetY = String(v);
    if (isAbsolute) {
      jb.style.top = `${v}px`;
    } else {
      const x = parseInt(jb.dataset.offsetX || '0');
      jb.style.transform = `translate(${x}px, ${v}px)`;
    }
    window.scheduleAutoSave?.();
  }

  xSlider.addEventListener('input', () => { xNumber.value = xSlider.value; applyX(parseInt(xSlider.value)); });
  xSlider.addEventListener('change', () => { window.pushHistory?.(); });
  xNumber.addEventListener('input', () => {
    const v = Math.min(860, Math.max(0, parseInt(xNumber.value) || 0));
    xSlider.value = v; applyX(v);
  });
  xNumber.addEventListener('change', () => { window.pushHistory?.(); });

  ySlider.addEventListener('input', () => { yNumber.value = ySlider.value; applyY(parseInt(ySlider.value)); });
  ySlider.addEventListener('change', () => { window.pushHistory?.(); });
  yNumber.addEventListener('input', () => {
    const v = Math.min(500, Math.max(-500, parseInt(yNumber.value) || 0));
    ySlider.value = v; applyY(v);
  });
  yNumber.addEventListener('change', () => { window.pushHistory?.(); });
}

window.showJokerProperties = showJokerProperties;

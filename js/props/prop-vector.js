import { propPanel } from '../globals.js';

export function showVectorProperties(block) {
  const w       = parseInt(block.dataset.w)        || 120;
  const h       = parseInt(block.dataset.h)        || 120;
  const color   = block.dataset.color              || '#000000';
  const rotateDeg = parseFloat(block.dataset.rotateDeg) || 0;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <path d="M6 1L11 4.5L9 11H3L1 4.5Z" stroke-linejoin="round"/>
            <line x1="1" y1="4.5" x2="11" y2="4.5"/>
            <line x1="6" y1="1" x2="3" y2="4.5"/>
            <line x1="6" y1="1" x2="9" y2="4.5"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Vector'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>

      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">W</span>
        <input type="number" class="prop-number" id="vb-w" value="${w}" min="10" max="1200">
        <span class="prop-label" style="margin-left:8px">H</span>
        <input type="number" class="prop-number" id="vb-h" value="${h}" min="10" max="2000">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">색상</div>
      <div class="prop-row">
        <span class="prop-label">Fill</span>
        <div class="prop-color-swatch" style="background:${color}">
          <input type="color" id="vb-color" value="${color}">
        </div>
        <input type="text" class="prop-text" id="vb-color-text" value="${color}" maxlength="9" style="width:72px;margin-left:6px">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">회전 / 반전</div>
      <div class="prop-row" style="gap:6px;">
        <span class="prop-label" style="flex-shrink:0;">각도</span>
        <input type="number" class="prop-number" id="vb-rotate-deg" style="width:56px;" min="-360" max="360" value="${rotateDeg}">
        <span style="font-size:11px;color:#6b6b6b;flex-shrink:0;">°</span>
      </div>
      <div class="prop-row" style="gap:3px;justify-content:flex-end;margin-top:4px;">
        <button class="prop-align-btn" id="vb-rotate-90" title="90° 시계 방향 회전">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M11.5 4.5A5 5 0 1 0 13 8"/>
            <polyline stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" points="9,2 12,4.5 9.5,7.5"/>
          </svg>
        </button>
        <button class="prop-align-btn${block.dataset.flipH === '1' ? ' active' : ''}" id="vb-flip-h" title="좌우 반전">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M8 2v12M4 4l-2 4 2 4M12 4l2 4-2 4"/>
            <path fill="currentColor" opacity=".35" d="M8 5v6l-4-3z"/>
          </svg>
        </button>
        <button class="prop-align-btn${block.dataset.flipV === '1' ? ' active' : ''}" id="vb-flip-v" title="상하 반전">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M2 8h12M4 4l4-2 4 2M4 12l4 2 4-2"/>
            <path fill="currentColor" opacity=".35" d="M5 8h6l-3 4z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // ── transform 적용 ────────────────────────────────────────────────────────────
  function applyTransform() {
    const rd = parseFloat(block.dataset.rotateDeg) || 0;
    const fx = block.dataset.flipH === '1' ? -1 : 1;
    const fy = block.dataset.flipV === '1' ? -1 : 1;
    block.style.transform = `rotate(${rd}deg) scale(${fx},${fy})`;
    window.scheduleAutoSave?.();
  }

  // ── 크기 ──────────────────────────────────────────────────────────────────────
  document.getElementById('vb-w')?.addEventListener('change', () => {
    block.dataset.w = parseInt(document.getElementById('vb-w').value) || w;
    window.renderVector(block);
    window.scheduleAutoSave?.();
  });
  document.getElementById('vb-h')?.addEventListener('change', () => {
    block.dataset.h = parseInt(document.getElementById('vb-h').value) || h;
    window.renderVector(block);
    window.scheduleAutoSave?.();
  });

  // ── 색상 ──────────────────────────────────────────────────────────────────────
  const colorPick = document.getElementById('vb-color');
  const colorText = document.getElementById('vb-color-text');

  colorPick?.addEventListener('input', () => {
    const v = colorPick.value;
    if (colorText) colorText.value = v;
    colorPick.closest('.prop-color-swatch').style.background = v;
    block.dataset.color = v;
    window.renderVector(block);
    window.scheduleAutoSave?.();
  });
  colorText?.addEventListener('change', () => {
    const v = colorText.value.trim();
    if (!/^#[0-9a-fA-F]{3,8}$/.test(v)) return;
    if (colorPick) colorPick.value = v;
    colorPick?.closest('.prop-color-swatch')?.style.setProperty('background', v);
    block.dataset.color = v;
    window.renderVector(block);
    window.scheduleAutoSave?.();
  });

  // ── 회전 ──────────────────────────────────────────────────────────────────────
  document.getElementById('vb-rotate-deg')?.addEventListener('input', e => {
    block.dataset.rotateDeg = parseFloat(e.target.value) || 0;
    applyTransform();
  });
  document.getElementById('vb-rotate-90')?.addEventListener('click', () => {
    const cur  = parseFloat(block.dataset.rotateDeg) || 0;
    const next = (cur + 90) % 360;
    block.dataset.rotateDeg = next;
    const inp = document.getElementById('vb-rotate-deg');
    if (inp) inp.value = next;
    applyTransform();
  });

  // ── 반전 ──────────────────────────────────────────────────────────────────────
  document.getElementById('vb-flip-h')?.addEventListener('click', () => {
    block.dataset.flipH = block.dataset.flipH === '1' ? '0' : '1';
    document.getElementById('vb-flip-h')?.classList.toggle('active', block.dataset.flipH === '1');
    applyTransform();
  });
  document.getElementById('vb-flip-v')?.addEventListener('click', () => {
    block.dataset.flipV = block.dataset.flipV === '1' ? '0' : '1';
    document.getElementById('vb-flip-v')?.classList.toggle('active', block.dataset.flipV === '1');
    applyTransform();
  });
}

window.showVectorProperties = showVectorProperties;

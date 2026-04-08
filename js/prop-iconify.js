import { propPanel } from './globals.js';

export function showIconifyProperties(block) {
  const iconName = block.dataset.iconName || '';
  const size     = parseInt(block.dataset.size)     || 64;
  const rotation = parseInt(block.dataset.rotation) || 0;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Icon'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>

      <!-- 아이콘 이름 -->
      <div class="prop-row" style="gap:6px;">
        <span class="prop-label" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#888;" title="${iconName}">${iconName || '(없음)'}</span>
        <button class="prop-btn" id="icn-replace-btn" title="Iconify에서 교체"
          style="width:auto;height:auto;padding:3px 8px;font-size:10px;">교체</button>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">Size</span>
        <input type="range"  class="prop-slider" id="icn-size-slider" min="16" max="512" step="8"  value="${size}">
        <input type="number" class="prop-number" id="icn-size-number" min="16" max="512" value="${size}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">회전</div>
      <div class="prop-align-group" id="icn-rotation-group">
        <button class="prop-align-btn${rotation ===   0 ? ' active' : ''}" data-deg="0">0°</button>
        <button class="prop-align-btn${rotation ===  90 ? ' active' : ''}" data-deg="90">90°</button>
        <button class="prop-align-btn${rotation === 180 ? ' active' : ''}" data-deg="180">180°</button>
        <button class="prop-align-btn${rotation === 270 ? ' active' : ''}" data-deg="270">270°</button>
      </div>
    </div>

    <div class="prop-section">
      <button class="prop-btn-full" id="icn-open-modal-btn">Iconify에서 교체</button>
    </div>
  `;

  // 크기
  const sSlider = propPanel.querySelector('#icn-size-slider');
  const sNumber = propPanel.querySelector('#icn-size-number');
  const applySize = v => {
    v = Math.min(512, Math.max(16, v));
    block.dataset.size = v;
    block.style.width  = v + 'px';
    block.style.height = v + 'px';
    const svg = block.querySelector('svg');
    if (svg) { svg.setAttribute('width', v); svg.setAttribute('height', v); }
    const img = block.querySelector('img');
    if (img) { img.width = v; img.height = v; }
    sSlider.value = v; sNumber.value = v;
  };
  sSlider.addEventListener('mousedown', () => window.pushHistory?.());
  sSlider.addEventListener('input',  () => applySize(parseInt(sSlider.value)));
  sNumber.addEventListener('change', () => { window.pushHistory?.(); applySize(parseInt(sNumber.value)); });
  sSlider.addEventListener('change', () => window.pushHistory?.());

  // 회전
  const applyRotation = deg => {
    block.dataset.rotation = deg;
    block.style.transform  = deg > 0 ? `rotate(${deg}deg)` : '';
    propPanel.querySelectorAll('#icn-rotation-group .prop-align-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.deg) === deg);
    });
    window.pushHistory?.();
  };
  propPanel.querySelectorAll('#icn-rotation-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => applyRotation(parseInt(btn.dataset.deg)));
  });

  // 교체 버튼
  const openModal = () => window.openIconifyModal?.();
  propPanel.querySelector('#icn-replace-btn').addEventListener('click', openModal);
  propPanel.querySelector('#icn-open-modal-btn').addEventListener('click', openModal);
}

window.showIconifyProperties = showIconifyProperties;

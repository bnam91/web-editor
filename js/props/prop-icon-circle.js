import { propPanel, state } from '../globals.js';

export function showIconCircleProperties(block) {
  const circle   = block.querySelector('.icb-circle');
  const size     = parseInt(block.dataset.size)    || 80;
  const bgColor  = block.dataset.bgColor           || '#e8e8e8';
  const borderV  = block.dataset.border            || 'none';
  const radius   = parseInt(block.dataset.radius)  || 0;
  const padX     = parseInt(block.dataset.padX)    || 0;

  const hasImage = block.classList.contains('has-image');

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <circle cx="6" cy="6" r="5"/>
            <text x="3.5" y="9" font-size="6" fill="#888" stroke="none">★</text>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Asset-Circle'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(block)}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">SIZE</div>
      <div class="prop-row">
        <span class="prop-label">지름</span>
        <input type="range" class="prop-slider" id="icb-size-slider" min="40" max="860" step="4" value="${size}">
        <input type="number" class="prop-number"  id="icb-size-number" min="40" max="860" value="${size}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="icb-padx-slider" min="0" max="200" step="4" value="${padX}">
        <input type="number" class="prop-number" id="icb-padx-number" min="0" max="200" value="${padX}">
      </div>
    </div>
    ${hasImage ? `
    <div class="prop-section">
      <div class="prop-section-title">IMAGE</div>
      <button class="prop-action-btn secondary" id="icb-pos-btn">이미지 위치 조절</button>
      <button class="prop-action-btn secondary" id="icb-replace-btn">이미지 교체</button>
      <button class="prop-action-btn danger"    id="icb-remove-btn">이미지 제거</button>
    </div>` : `
    <div class="prop-section">
      <div class="prop-section-title">IMAGE</div>
      <button class="prop-action-btn primary" id="icb-upload-btn">이미지 선택</button>
      <div style="text-align:center;font-size:11px;color:#555;margin-top:6px;">또는 블록에 파일을 드래그</div>
    </div>`}
    <div class="prop-section">
      <div class="prop-section-title">COLOR</div>
      <div class="prop-color-row">
        <span class="prop-label">배경</span>
        <div class="prop-color-swatch" style="background:${bgColor}" role="button" aria-label="배경색 선택">
          <input type="color" id="icb-bg-color" value="${bgColor}" aria-label="배경색">
        </div>
        <input type="text" class="prop-color-hex" id="icb-bg-hex" value="${bgColor}" maxlength="7">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">BORDER</div>
      <div class="prop-row">
        <span class="prop-label">스타일</span>
        <select class="prop-select" id="icb-border-select">
          <option value="none"   ${borderV==='none'   ?'selected':''}>없음</option>
          <option value="solid"  ${borderV==='solid'  ?'selected':''}>실선</option>
          <option value="dashed" ${borderV==='dashed' ?'selected':''}>점선</option>
        </select>
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  if (hasImage) {
    propPanel.querySelector('#icb-pos-btn').addEventListener('click', () => window.enterCircleImageEditMode(block));
    propPanel.querySelector('#icb-replace-btn').addEventListener('click', () => window.triggerCircleUpload(block));
    propPanel.querySelector('#icb-remove-btn').addEventListener('click', () => window.clearCircleImage(block));
  } else {
    propPanel.querySelector('#icb-upload-btn').addEventListener('click', () => window.triggerCircleUpload(block));
  }

  const applySize = v => {
    v = Math.min(860, Math.max(40, v));
    block.dataset.size     = v;
    circle.style.width     = v + 'px';
    circle.style.height    = v + 'px';
    propPanel.querySelector('#icb-size-slider').value = v;
    propPanel.querySelector('#icb-size-number').value = v;
  };
  propPanel.querySelector('#icb-size-slider').addEventListener('input',  e => applySize(parseInt(e.target.value)));
  propPanel.querySelector('#icb-size-number').addEventListener('change', e => { applySize(parseInt(e.target.value)); window.pushHistory(); });
  propPanel.querySelector('#icb-size-slider').addEventListener('change', () => window.pushHistory());

  const applyPadX = v => {
    v = Math.min(200, Math.max(0, v));
    block.dataset.padX         = v;
    block.style.paddingLeft    = v + 'px';
    block.style.paddingRight   = v + 'px';
    propPanel.querySelector('#icb-padx-slider').value = v;
    propPanel.querySelector('#icb-padx-number').value = v;
  };
  propPanel.querySelector('#icb-padx-slider').addEventListener('input',  e => applyPadX(parseInt(e.target.value)));
  propPanel.querySelector('#icb-padx-number').addEventListener('change', e => { applyPadX(parseInt(e.target.value)); window.pushHistory(); });
  propPanel.querySelector('#icb-padx-slider').addEventListener('change', () => window.pushHistory());

  const bgPicker = propPanel.querySelector('#icb-bg-color');
  const bgHex    = propPanel.querySelector('#icb-bg-hex');
  const bgSwatch = bgPicker.closest('.prop-color-swatch');
  bgPicker.addEventListener('input', () => {
    block.dataset.bgColor   = bgPicker.value;
    circle.style.backgroundColor = bgPicker.value;
    bgHex.value             = bgPicker.value;
    bgSwatch.style.background = bgPicker.value;
  });
  bgPicker.addEventListener('change', () => window.pushHistory());
  bgHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(bgHex.value)) {
      block.dataset.bgColor   = bgHex.value;
      circle.style.backgroundColor = bgHex.value;
      bgPicker.value          = bgHex.value;
      bgSwatch.style.background = bgHex.value;
      window.pushHistory();
    }
  });

  propPanel.querySelector('#icb-border-select').addEventListener('change', e => {
    block.dataset.border   = e.target.value;
    circle.dataset.border  = e.target.value;
    window.pushHistory();
  });
}


window.showIconCircleProperties = showIconCircleProperties;

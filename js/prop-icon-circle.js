import { propPanel, state } from './globals.js';

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
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">Icon Circle</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(block)}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">크기</div>
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
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn secondary" id="icb-pos-btn">이미지 위치 조절</button>
      <button class="prop-action-btn secondary" id="icb-replace-btn">이미지 교체</button>
      <button class="prop-action-btn danger"    id="icb-remove-btn">이미지 제거</button>
    </div>` : `
    <div class="prop-section">
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn primary" id="icb-upload-btn">이미지 선택</button>
      <div style="text-align:center;font-size:11px;color:#555;margin-top:6px;">또는 블록에 파일을 드래그</div>
    </div>`}
    <div class="prop-section">
      <div class="prop-section-title">색상</div>
      <div class="prop-color-row">
        <span class="prop-label">배경</span>
        <div class="prop-color-swatch" style="background:${bgColor}">
          <input type="color" id="icb-bg-color" value="${bgColor}">
        </div>
        <input type="text" class="prop-color-hex" id="icb-bg-hex" value="${bgColor}" maxlength="7">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">테두리</div>
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
    document.getElementById('icb-pos-btn').addEventListener('click', () => window.enterCircleImageEditMode(block));
    document.getElementById('icb-replace-btn').addEventListener('click', () => window.triggerCircleUpload(block));
    document.getElementById('icb-remove-btn').addEventListener('click', () => window.clearCircleImage(block));
  } else {
    document.getElementById('icb-upload-btn').addEventListener('click', () => window.triggerCircleUpload(block));
  }

  const applySize = v => {
    v = Math.min(860, Math.max(40, v));
    block.dataset.size     = v;
    circle.style.width     = v + 'px';
    circle.style.height    = v + 'px';
    document.getElementById('icb-size-slider').value = v;
    document.getElementById('icb-size-number').value = v;
  };
  document.getElementById('icb-size-slider').addEventListener('input',  e => applySize(parseInt(e.target.value)));
  document.getElementById('icb-size-number').addEventListener('change', e => { applySize(parseInt(e.target.value)); window.pushHistory(); });
  document.getElementById('icb-size-slider').addEventListener('change', () => window.pushHistory());

  const applyPadX = v => {
    v = Math.min(200, Math.max(0, v));
    block.dataset.padX         = v;
    block.style.paddingLeft    = v + 'px';
    block.style.paddingRight   = v + 'px';
    document.getElementById('icb-padx-slider').value = v;
    document.getElementById('icb-padx-number').value = v;
  };
  document.getElementById('icb-padx-slider').addEventListener('input',  e => applyPadX(parseInt(e.target.value)));
  document.getElementById('icb-padx-number').addEventListener('change', e => { applyPadX(parseInt(e.target.value)); window.pushHistory(); });
  document.getElementById('icb-padx-slider').addEventListener('change', () => window.pushHistory());

  const bgPicker = document.getElementById('icb-bg-color');
  const bgHex    = document.getElementById('icb-bg-hex');
  const bgSwatch = bgPicker.closest('.prop-color-swatch');
  bgPicker.addEventListener('input', () => {
    block.dataset.bgColor   = bgPicker.value;
    circle.style.background = bgPicker.value;
    bgHex.value             = bgPicker.value;
    bgSwatch.style.background = bgPicker.value;
  });
  bgPicker.addEventListener('change', () => window.pushHistory());
  bgHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(bgHex.value)) {
      block.dataset.bgColor   = bgHex.value;
      circle.style.background = bgHex.value;
      bgPicker.value          = bgHex.value;
      bgSwatch.style.background = bgHex.value;
      window.pushHistory();
    }
  });

  document.getElementById('icb-border-select').addEventListener('change', e => {
    block.dataset.border   = e.target.value;
    circle.dataset.border  = e.target.value;
    window.pushHistory();
  });
}


window.showIconCircleProperties = showIconCircleProperties;

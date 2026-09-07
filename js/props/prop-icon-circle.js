import { propPanel, state } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

export function showIconCircleProperties(block) {
  const circle   = block.querySelector('.icb-circle');
  const size     = parseInt(block.dataset.size)    || 80;
  const bgColor  = block.dataset.bgColor           || '#e8e8e8';
  const bgAlpha  = parseAlphaFromColor(bgColor);
  const borderV  = block.dataset.border            || 'none';
  const radius   = parseInt(block.dataset.radius)  || 0;
  const padX     = parseInt(block.dataset.padX)    || 0;
  // ★「좌우 패딩」은 «죽은 속성이 아니다» — row 가 cols 일 때만 산다(실측 2026-09-05).
  //   stack(기본)에서는 블록이 행 폭으로 늘어나고 .icon-circle-block 이 justify-content:center
  //   + .icb-circle 이 flex-shrink:0 이라, «좌우 대칭» 패딩이 정확히 상쇄돼 원이 1px도 안 움직인다
  //   (padX 0/40/80/120/200 다섯 값에서 원 중심 720.0 고정·블록 폭 286.4 고정).
  //   → 값을 지우면 cols 에서 쓰던 사람이 잃는다. 그래서 «내리지 않고», 무효인 레이아웃에서만
  //     끄고 이유를 붙인다(prop-laurel/prop-banner02 의 opacity:0.4;pointer-events:none 관례).
  const _padXLive  = block.parentElement?.dataset.layout === 'cols';
  const _padXOff   = _padXLive ? '' : 'opacity:0.4;pointer-events:none;';
  const _padXTitle = _padXLive ? '' : ' title="이 행이 «가로 배치(cols)»일 때만 적용됩니다 — 세로 배치에서는 원이 가운데 정렬이라 좌우 패딩이 상쇄됩니다"';

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
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">지름</span>
        <input type="range" class="prop-slider" id="icb-size-slider" min="40" max="860" step="4" value="${size}">
        <input type="number" class="prop-number"  id="icb-size-number" min="40" max="860" value="${size}">
      </div>
      <div class="prop-row" style="${_padXOff}"${_padXTitle}>
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="icb-padx-slider" min="0" max="200" step="4" value="${padX}">
        <input type="number" class="prop-number" id="icb-padx-number" min="0" max="200" value="${padX}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Rotation</div>
      <div class="prop-row">
        <span class="prop-label">회전°</span>
        <input type="range" class="prop-slider" id="icb-rot-slider" min="-180" max="180" step="1" value="${parseInt(block.dataset.rotation || '0')}">
        <input type="number" class="prop-number" id="icb-rot-number" min="-180" max="180" value="${parseInt(block.dataset.rotation || '0')}">
      </div>
    </div>
    ${hasImage ? `
    <div class="prop-section">
      <div class="prop-section-title">Image</div>
      <button class="prop-action-btn secondary" id="icb-pos-btn">이미지 위치 조절</button>
      <button class="prop-action-btn secondary" id="icb-replace-btn">이미지 교체</button>
      <button class="prop-action-btn danger"    id="icb-remove-btn">이미지 제거</button>
    </div>` : `
    <div class="prop-section">
      <div class="prop-section-title">Image</div>
      <button class="prop-action-btn primary" id="icb-upload-btn">이미지 선택</button>
      <div class="prop-hint" style="margin-top:6px;">또는 블록에 파일을 드래그</div>
    </div>`}
    <div class="prop-section">
      <div class="prop-section-title">Color</div>
      <div class="prop-color-row">
        <span class="prop-label">배경</span>
        ${colorFieldHTML({ idPrefix: 'icb-bg', hex: bgColor, alpha: bgAlpha })}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Border</div>
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
    circle.style.height    = v + 'px';   // height는 항상 width와 동일 — 단일 차원 경로 방어
    circle.style.aspectRatio = '1 / 1';  // 런타임 가드 — 부모 flex stretch로 squash되는 케이스 차단
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

  // 회전 — 공유 헬퍼(applyRotationDeg, dataset.rotation)로 핫존(asset-rotate.js)과 동기
  const _icbRot = v => {
    v = Math.min(180, Math.max(-180, parseInt(v) || 0));
    window.applyRotationDeg?.(block, v);
    propPanel.querySelector('#icb-rot-slider').value = v;
    propPanel.querySelector('#icb-rot-number').value = v;
  };
  propPanel.querySelector('#icb-rot-slider').addEventListener('input',  e => _icbRot(e.target.value));
  propPanel.querySelector('#icb-rot-number').addEventListener('input',  e => _icbRot(e.target.value));
  propPanel.querySelector('#icb-rot-slider').addEventListener('change', () => window.pushHistory());
  propPanel.querySelector('#icb-rot-number').addEventListener('change', () => window.pushHistory());

  wireColorField('icb-bg', {
    initialAlpha: bgAlpha,
    onApply: (c) => {
      block.dataset.bgColor = c;
      circle.style.backgroundColor = c;
    },
    onCommit: () => window.pushHistory(),
  });

  propPanel.querySelector('#icb-border-select').addEventListener('change', e => {
    block.dataset.border   = e.target.value;
    circle.dataset.border  = e.target.value;
    window.pushHistory();
  });
}


window.showIconCircleProperties = showIconCircleProperties;

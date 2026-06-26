import { propPanel, state } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

// 브릿지(V 커버) 블록 프로퍼티 패널 — 정적 블록이라 색상 컨트롤만(공용 prop 클래스 재사용, divider 패널과 일관).
export function showBridgeProperties(block) {
  const color = block.dataset.bridgeColor || '#9a8a78';
  const alpha = parseAlphaFromColor(color);

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3"><path d="M1 4 H4.5 Q5.2 4 6 7 Q6.8 4 7.5 4 H11"/></svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Bridge'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(block)}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Color</div>
      <div class="prop-color-row">
        ${colorFieldHTML({ idPrefix: 'brg', hex: color, alpha })}
      </div>
    </div>`;

  const applyColor = (c) => {
    block.dataset.bridgeColor = c;
    const path = block.querySelector('svg path');
    if (path) path.setAttribute('fill', c);
  };
  wireColorField('brg', {
    initialAlpha: alpha,
    onApply: (c) => applyColor(c),
    onCommit: () => { window.pushHistory?.(); window.scheduleAutoSave?.(); },
  });
}

window.showBridgeProperties = showBridgeProperties;

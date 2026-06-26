import { propPanel, state } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

// 브릿지(V 커버) 블록 프로퍼티 — 색상 + 꼬리(V홈) 모양(프리셋 + 너비/깊이 슬라이더). 공용 prop 클래스 재사용.
// 모양 파라미터는 data-bridge-width/depth/sharp 에 저장(직렬화) → renderBridgeBlock이 path 재생성.
const BRIDGE_PRESETS = {
  sharp:   { width: 70,  depth: 88, sharp: 90 },  // 뾰족
  default: { width: 120, depth: 88, sharp: 50 },  // 기본
  wide:    { width: 220, depth: 70, sharp: 15 },  // 넓은
};

export function showBridgeProperties(block) {
  const color = block.dataset.bridgeColor || '#9a8a78';
  const alpha = parseAlphaFromColor(color);
  const width = parseFloat(block.dataset.bridgeWidth) || 120;
  const depth = parseFloat(block.dataset.bridgeDepth) || 88;

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
    </div>
    <div class="prop-section">
      <div class="prop-section-title">꼬리 (V홈)</div>
      <div class="prop-row" style="gap:3px;">
        <button class="prop-preset-btn" data-bridge-preset="sharp">뾰족</button>
        <button class="prop-preset-btn" data-bridge-preset="default">기본</button>
        <button class="prop-preset-btn" data-bridge-preset="wide">넓은</button>
      </div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="brg-w-slider" min="30" max="400" step="2" value="${width}">
        <input type="number" class="prop-number" id="brg-w-number" min="30" max="400" value="${width}">
      </div>
      <div class="prop-row">
        <span class="prop-label">깊이</span>
        <input type="range" class="prop-slider" id="brg-d-slider" min="8" max="90" step="1" value="${depth}">
        <input type="number" class="prop-number" id="brg-d-number" min="8" max="90" value="${depth}">
      </div>
    </div>`;

  // 색상
  wireColorField('brg', {
    initialAlpha: alpha,
    onApply: (c) => {
      block.dataset.bridgeColor = c;
      const path = block.querySelector('svg path');
      if (path) path.setAttribute('fill', c);
    },
    onCommit: () => { window.pushHistory?.(); window.scheduleAutoSave?.(); },
  });

  const wSlider = document.getElementById('brg-w-slider');
  const wNumber = document.getElementById('brg-w-number');
  const dSlider = document.getElementById('brg-d-slider');
  const dNumber = document.getElementById('brg-d-number');

  const rerender = () => { window.renderBridgeBlock?.(block); };
  const setWidth = (v) => { v = Math.max(30, Math.min(400, parseInt(v) || 120)); block.dataset.bridgeWidth = String(v); wSlider.value = v; wNumber.value = v; rerender(); };
  const setDepth = (v) => { v = Math.max(8, Math.min(90, parseInt(v) || 88)); block.dataset.bridgeDepth = String(v); dSlider.value = v; dNumber.value = v; rerender(); };

  wSlider.addEventListener('input', () => setWidth(wSlider.value));
  wSlider.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  wNumber.addEventListener('change', () => { setWidth(wNumber.value); window.pushHistory?.(); window.scheduleAutoSave?.(); });
  dSlider.addEventListener('input', () => setDepth(dSlider.value));
  dSlider.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
  dNumber.addEventListener('change', () => { setDepth(dNumber.value); window.pushHistory?.(); window.scheduleAutoSave?.(); });

  propPanel.querySelectorAll('[data-bridge-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = BRIDGE_PRESETS[btn.dataset.bridgePreset];
      if (!p) return;
      block.dataset.bridgeWidth = String(p.width);
      block.dataset.bridgeDepth = String(p.depth);
      block.dataset.bridgeSharp = String(p.sharp);
      wSlider.value = p.width; wNumber.value = p.width;
      dSlider.value = p.depth; dNumber.value = p.depth;
      rerender();
      window.pushHistory?.(); window.scheduleAutoSave?.();
    });
  });
}

window.showBridgeProperties = showBridgeProperties;

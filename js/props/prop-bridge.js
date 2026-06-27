import { propPanel, state } from '../globals.js';
import { colorFieldHTML, wireColorField, parseAlphaFromColor } from './color-picker.js';

// 브릿지(V 커버) 블록 프로퍼티 — 색상 + 꼬리(V홈) 모양(너비/깊이/곡률 슬라이더) + 블록 높이. 공용 prop 클래스 재사용.
// 모양 파라미터는 data-bridge-width/depth/arc/height 에 저장(직렬화) → renderBridgeBlock이 path/높이 재생성.
// arc(곡률): 0=직선 V(뾰족), ↑=꼭지점 지나는 호, 100=아치. (현빈 요청) — 슬라이더로 연속 조절, 프리셋 제거(중복).

export function showBridgeProperties(block) {
  const color  = block.dataset.bridgeColor || '#9a8a78';
  const alpha  = parseAlphaFromColor(color);
  const width  = parseFloat(block.dataset.bridgeWidth)  || 120;
  const depth  = parseFloat(block.dataset.bridgeDepth)  || 88;
  const _ar = parseFloat(block.dataset.bridgeArc);
  const arc = Number.isFinite(_ar) ? _ar : 50;
  const _hg = parseFloat(block.dataset.bridgeHeight);
  const height = Number.isFinite(_hg) ? _hg : 90;

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
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="brg-h-slider" min="20" max="300" step="2" value="${height}">
        <input type="number" class="prop-number" id="brg-h-number" min="20" max="300" value="${height}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">꼬리 (V홈)</div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="brg-w-slider" min="30" max="840" step="2" value="${width}">
        <input type="number" class="prop-number" id="brg-w-number" min="30" max="840" value="${width}">
      </div>
      <div class="prop-row">
        <span class="prop-label">깊이</span>
        <input type="range" class="prop-slider" id="brg-d-slider" min="8" max="90" step="1" value="${depth}">
        <input type="number" class="prop-number" id="brg-d-number" min="8" max="90" value="${depth}">
      </div>
      <div class="prop-row">
        <span class="prop-label">곡률</span>
        <input type="range" class="prop-slider" id="brg-a-slider" min="0" max="100" step="1" value="${arc}">
        <input type="number" class="prop-number" id="brg-a-number" min="0" max="100" value="${arc}">
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

  const $ = (id) => document.getElementById(id);
  const wSlider = $('brg-w-slider'), wNumber = $('brg-w-number');
  const dSlider = $('brg-d-slider'), dNumber = $('brg-d-number');
  const aSlider = $('brg-a-slider'), aNumber = $('brg-a-number');
  const hSlider = $('brg-h-slider'), hNumber = $('brg-h-number');

  const rerender = () => { window.renderBridgeBlock?.(block); };
  const setWidth  = (v) => { v = Math.max(30, Math.min(840, parseInt(v) || 120)); block.dataset.bridgeWidth  = String(v); wSlider.value = v; wNumber.value = v; rerender(); };
  const setDepth  = (v) => { v = Math.max(8,  Math.min(90,  parseInt(v) || 88));  block.dataset.bridgeDepth  = String(v); dSlider.value = v; dNumber.value = v; rerender(); };
  const setArc    = (v) => { v = Math.max(0,  Math.min(100, parseInt(v) || 0));   block.dataset.bridgeArc    = String(v); aSlider.value = v; aNumber.value = v; rerender(); };
  const setHeight = (v) => { v = Math.max(20, Math.min(300, parseInt(v) || 90));  block.dataset.bridgeHeight = String(v); hSlider.value = v; hNumber.value = v; rerender(); };
  const commit = () => { window.pushHistory?.(); window.scheduleAutoSave?.(); };

  wSlider.addEventListener('input', () => setWidth(wSlider.value));
  wSlider.addEventListener('change', commit);
  wNumber.addEventListener('change', () => { setWidth(wNumber.value); commit(); });
  dSlider.addEventListener('input', () => setDepth(dSlider.value));
  dSlider.addEventListener('change', commit);
  dNumber.addEventListener('change', () => { setDepth(dNumber.value); commit(); });
  aSlider.addEventListener('input', () => setArc(aSlider.value));
  aSlider.addEventListener('change', commit);
  aNumber.addEventListener('change', () => { setArc(aNumber.value); commit(); });
  hSlider.addEventListener('input', () => setHeight(hSlider.value));
  hSlider.addEventListener('change', commit);
  hNumber.addEventListener('change', () => { setHeight(hNumber.value); commit(); });
}

window.showBridgeProperties = showBridgeProperties;

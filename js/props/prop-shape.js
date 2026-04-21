import { propPanel } from '../globals.js';

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent') return '#cccccc';
  if (/^#/.test(rgb)) return rgb;
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#cccccc';
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

const SHAPE_ICONS = {
  star:      `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polygon points="8,2 9.8,6.2 14.5,6.2 10.8,8.9 12.2,13.5 8,10.8 3.8,13.5 5.2,8.9 1.5,6.2 6.2,6.2" fill="#888"/></svg>`,
  rectangle: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1" stroke="#888" stroke-width="1.4" fill="none"/></svg>`,
  ellipse:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#888" stroke-width="1.4" fill="none"/></svg>`,
  line:      `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><line x1="2" y1="14" x2="14" y2="2" stroke="#888" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  arrow:     `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><line x1="2" y1="14" x2="14" y2="2" stroke="#888" stroke-width="1.6" stroke-linecap="round"/><polyline points="8,2 14,2 14,8" stroke="#888" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  polygon:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polygon points="8,2 14,12 2,12" stroke="#888" stroke-width="1.4" fill="none" stroke-linejoin="round"/></svg>`,
};
const SHAPE_NAMES = {
  star: 'Star', rectangle: 'Rectangle', ellipse: 'Ellipse',
  line: 'Line', arrow: 'Arrow', polygon: 'Polygon',
};

export function showShapeProperties(block) {
  if (!block) return;

  const shapeType   = block.dataset.shapeType || 'rectangle';
  const color       = block.dataset.shapeColor || '#cccccc';
  const strokeWidth = parseInt(block.dataset.shapeStrokeWidth || '3');
  const w           = parseInt(block.style.width)  || 100;
  const h           = parseInt(block.style.height) || 100;
  const iconSvg     = SHAPE_ICONS[shapeType] || SHAPE_ICONS.rectangle;
  const shapeName   = SHAPE_NAMES[shapeType] || shapeType;
  const id          = block.id || '';

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">${iconSvg}</div>
        <div class="prop-block-info">
          <span class="prop-block-name">${shapeName}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${id}')">${id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">COLOR</div>
      <div class="prop-color-row">
        <span class="prop-label">색상</span>
        <div class="prop-color-swatch" style="background:${color}">
          <input type="color" id="shape-color-picker" value="${color}">
        </div>
        <input type="text" class="prop-color-hex" id="shape-color-hex" value="${color}" maxlength="7">
      </div>
      <div class="prop-row" style="margin-top:8px;">
        <span class="prop-label">두께</span>
        <input type="range" class="prop-slider" id="shape-stroke-slider" min="0" max="20" step="1" value="${strokeWidth}">
        <input type="number" class="prop-number" id="shape-stroke-num" min="0" max="20" value="${strokeWidth}">
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">SIZE</div>
      <div class="prop-row">
        <span class="prop-label">W</span>
        <input type="range" class="prop-slider" id="shape-w-slider" min="10" max="860" step="1" value="${w}">
        <input type="number" class="prop-number" id="shape-w-num" min="10" max="860" value="${w}">
      </div>
      <div class="prop-row" style="margin-top:6px;">
        <span class="prop-label">H</span>
        <input type="range" class="prop-slider" id="shape-h-slider" min="10" max="860" step="1" value="${h}">
        <input type="number" class="prop-number" id="shape-h-num" min="10" max="860" value="${h}">
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(id || null);

  const svg = block.querySelector('svg');
  // 부모 sub-section (shape frame)
  const ss = block.closest('.frame-block');

  function applyColor(hex) {
    block.dataset.shapeColor = hex;
    if (svg) svg.style.color = hex;
    window.scheduleAutoSave?.();
  }

  function applyStroke(v) {
    block.dataset.shapeStrokeWidth = String(v);
    if (svg) svg.style.strokeWidth = String(v);
    window.scheduleAutoSave?.();
  }

  function applySize(newW, newH) {
    // frame(ss)만 리사이즈 — block/svg는 CSS 100%로 자동 추종
    if (ss) {
      ss.style.width  = `${newW}px`; ss.dataset.width  = String(newW);
      ss.style.height = `${newH}px`; ss.dataset.height = String(newH);
    }
    window.scheduleAutoSave?.();
  }

  // ── 색상 피커 ──
  const colorPicker = document.getElementById('shape-color-picker');
  const colorHex    = document.getElementById('shape-color-hex');
  colorPicker.addEventListener('input',  () => { colorHex.value = colorPicker.value; applyColor(colorPicker.value); });
  colorPicker.addEventListener('change', () => window.pushHistory?.());
  colorHex.addEventListener('input', () => {
    const v = colorHex.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) { colorPicker.value = v; applyColor(v); }
  });
  colorHex.addEventListener('change', () => window.pushHistory?.());

  // ── 스트로크 두께 ──
  const strokeSlider = document.getElementById('shape-stroke-slider');
  const strokeNum    = document.getElementById('shape-stroke-num');
  strokeSlider.addEventListener('input',  () => { strokeNum.value = strokeSlider.value; applyStroke(parseInt(strokeSlider.value)); });
  strokeSlider.addEventListener('change', () => window.pushHistory?.());
  strokeNum.addEventListener('input', () => {
    const v = Math.min(20, Math.max(0, parseInt(strokeNum.value) || 0));
    strokeSlider.value = v; applyStroke(v);
  });
  strokeNum.addEventListener('change', () => window.pushHistory?.());

  // ── 크기 W ──
  const wSlider = document.getElementById('shape-w-slider');
  const wNum    = document.getElementById('shape-w-num');
  wSlider.addEventListener('input',  () => { wNum.value = wSlider.value; applySize(parseInt(wSlider.value), parseInt(hSlider.value)); });
  wSlider.addEventListener('change', () => window.pushHistory?.());
  wNum.addEventListener('input', () => {
    const v = Math.min(860, Math.max(10, parseInt(wNum.value) || 10));
    wSlider.value = v; applySize(v, parseInt(hSlider.value));
  });
  wNum.addEventListener('change', () => window.pushHistory?.());

  // ── 크기 H ──
  const hSlider = document.getElementById('shape-h-slider');
  const hNum    = document.getElementById('shape-h-num');
  hSlider.addEventListener('input',  () => { hNum.value = hSlider.value; applySize(parseInt(wSlider.value), parseInt(hSlider.value)); });
  hSlider.addEventListener('change', () => window.pushHistory?.());
  hNum.addEventListener('input', () => {
    const v = Math.min(860, Math.max(10, parseInt(hNum.value) || 10));
    hSlider.value = v; applySize(parseInt(wSlider.value), v);
  });
  hNum.addEventListener('change', () => window.pushHistory?.());
}

window.showShapeProperties = showShapeProperties;

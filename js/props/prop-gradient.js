// ── Prop Gradient — 그라데이션 블록 프로퍼티 패널 ──────────────────────────────
// 2026-05-21 신규. gradient-block.js 짝.
//
// 컨트롤:
//   - 헤더 (블록 이름 + ID)
//   - 그라데이션 스타일 (Linear / Radial)
//   - 방향 (linear일 때만 — 8방향)
//   - 시작 색 + opacity
//   - 끝 색 + opacity
//   - 너비 슬라이더 (200~1200, 디폴트 860)
//   - 높이 슬라이더 (50~1500, 디폴트 300)

import { propPanel } from '../globals.js';
import { bindSlider } from './_helpers.js';

const DIRS = [
  { v: 'to bottom',       label: '↓ 위→아래' },
  { v: 'to top',          label: '↑ 아래→위' },
  { v: 'to right',        label: '→ 좌→우' },
  { v: 'to left',         label: '← 우→좌' },
  { v: 'to bottom right', label: '↘ ↖→↘' },
  { v: 'to bottom left',  label: '↙ ↗→↙' },
  { v: 'to top right',    label: '↗ ↙→↗' },
  { v: 'to top left',     label: '↖ ↘→↖' },
];

export function showGradientProperties(block) {
  const style       = block.dataset.gradStyle      || 'linear';
  const direction   = block.dataset.gradDirection  || 'to bottom';
  const startColor  = block.dataset.gradStart      || '#000000';
  const endColor    = block.dataset.gradEnd        || '#000000';
  const startAlpha  = block.dataset.gradStartAlpha != null ? parseFloat(block.dataset.gradStartAlpha) : 1;
  const endAlpha    = block.dataset.gradEndAlpha   != null ? parseFloat(block.dataset.gradEndAlpha)   : 0;
  const height      = parseInt(block.dataset.gradHeight) || 300;
  const width       = parseInt(block.dataset.gradWidth) || 860;

  const startHex = (startColor || '#000000').replace('#','').toUpperCase();
  const endHex   = (endColor   || '#000000').replace('#','').toUpperCase();
  const startAlphaPct = Math.round(startAlpha * 100);
  const endAlphaPct   = Math.round(endAlpha   * 100);

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <defs>
              <linearGradient id="grad-ico" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stop-color="#888" stop-opacity="1"/>
                <stop offset="100%" stop-color="#888" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="12" height="12" fill="url(#grad-ico)" stroke="#888" stroke-width="0.6"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Gradient'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Style</div>
      <div class="prop-row">
        <span class="prop-label">타입</span>
        <select class="prop-select" id="grad-style" style="flex:1">
          <option value="linear" ${style==='linear'?'selected':''}>Linear (선형)</option>
          <option value="radial" ${style==='radial'?'selected':''}>Radial (비네트)</option>
        </select>
      </div>
      <div class="prop-row" id="grad-dir-row" style="${style==='radial'?'display:none':''}">
        <span class="prop-label">방향</span>
        <select class="prop-select" id="grad-direction" style="flex:1">
          ${DIRS.map(d => `<option value="${d.v}" ${direction===d.v?'selected':''}>${d.label}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Colors</div>
      <div class="prop-color-row">
        <span class="prop-label">시작</span>
        <div class="prop-color-field">
          <div class="prop-color-swatch" style="background:${startColor}">
            <input type="color" id="grad-start-color" value="${startColor}">
          </div>
          <input type="text" class="prop-color-hex" id="grad-start-hex" value="${startHex}" maxlength="6" aria-label="시작 색">
          <label class="prop-color-alpha" title="Opacity">
            <input type="text" class="prop-color-alpha-input" id="grad-start-alpha" value="${startAlphaPct}" aria-label="시작 opacity">
            <span class="prop-color-alpha-suffix">%</span>
          </label>
        </div>
      </div>
      <div class="prop-color-row">
        <span class="prop-label">끝</span>
        <div class="prop-color-field">
          <div class="prop-color-swatch" style="background:${endColor}">
            <input type="color" id="grad-end-color" value="${endColor}">
          </div>
          <input type="text" class="prop-color-hex" id="grad-end-hex" value="${endHex}" maxlength="6" aria-label="끝 색">
          <label class="prop-color-alpha" title="Opacity">
            <input type="text" class="prop-color-alpha-input" id="grad-end-alpha" value="${endAlphaPct}" aria-label="끝 opacity">
            <span class="prop-color-alpha-suffix">%</span>
          </label>
        </div>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-section-title">Size</div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="grad-width-slider" min="200" max="1200" step="10" value="${width}">
        <input type="number" class="prop-number" id="grad-width-num" min="200" max="1200" value="${width}">
      </div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="grad-height-slider" min="50" max="1500" step="10" value="${height}">
        <input type="number" class="prop-number" id="grad-height-num" min="50" max="1500" value="${height}">
      </div>
      <div class="prop-hint" style="font-size:11px;color:#999;margin-top:4px">캔버스에 자유 배치 (드래그로 이동, 우측 컨트롤로 크기 조절)</div>
    </div>
  `;

  // ── 헬퍼 ────────────────────────────────────────────────────────────────────
  const rerender = () => window.renderGradientBlock?.(block);

  // 스타일 / 방향
  const styleSel = document.getElementById('grad-style');
  const dirRow   = document.getElementById('grad-dir-row');
  const dirSel   = document.getElementById('grad-direction');
  styleSel.addEventListener('change', () => {
    block.dataset.gradStyle = styleSel.value;
    if (dirRow) dirRow.style.display = (styleSel.value === 'radial') ? 'none' : '';
    rerender();
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });
  dirSel?.addEventListener('change', () => {
    block.dataset.gradDirection = dirSel.value;
    rerender();
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });

  // 색상 + alpha — 시작/끝 각각 동일 패턴
  const wireColor = (which) => {
    const picker = document.getElementById(`grad-${which}-color`);
    const hex    = document.getElementById(`grad-${which}-hex`);
    const alpha  = document.getElementById(`grad-${which}-alpha`);
    const swatch = picker.closest('.prop-color-swatch');
    const dataKey = which === 'start' ? 'gradStart' : 'gradEnd';
    const alphaKey = which === 'start' ? 'gradStartAlpha' : 'gradEndAlpha';

    const apply = () => { swatch.style.background = block.dataset[dataKey]; rerender(); };

    picker.addEventListener('input', () => {
      block.dataset[dataKey] = picker.value;
      hex.value = picker.value.replace('#','').toUpperCase();
      apply();
    });
    picker.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
    hex.addEventListener('input', () => {
      const v = hex.value.trim().replace(/^#/, '');
      if (/^[0-9a-f]{6}$/i.test(v)) { block.dataset[dataKey] = '#' + v.toLowerCase(); picker.value = block.dataset[dataKey]; apply(); }
    });
    hex.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
    hex.addEventListener('blur', () => { hex.value = (block.dataset[dataKey] || '#000000').replace('#','').toUpperCase(); });
    alpha.addEventListener('input', () => {
      const m = alpha.value.match(/(\d+)/);
      if (!m) return;
      const p = Math.max(0, Math.min(100, parseInt(m[1])));
      block.dataset[alphaKey] = String(p / 100);
      rerender();
    });
    alpha.addEventListener('change', () => { window.pushHistory?.(); window.scheduleAutoSave?.(); });
    alpha.addEventListener('blur', () => {
      const v = parseFloat(block.dataset[alphaKey] || '1');
      alpha.value = String(Math.round(v * 100));
    });
  };
  wireColor('start');
  wireColor('end');

  // 너비/높이 — sticker 패턴: dataset만 갱신, renderGradientBlock으로 cssText 재적용
  const widthSlider = document.getElementById('grad-width-slider');
  const widthNum    = document.getElementById('grad-width-num');
  const applyWidth = (v) => {
    block.dataset.gradWidth = String(v);
    rerender();
  };
  bindSlider(widthSlider, widthNum, applyWidth, { min: 200, max: 1200 });

  const heightSlider = document.getElementById('grad-height-slider');
  const heightNum    = document.getElementById('grad-height-num');
  const applyHeight = (v) => {
    block.dataset.gradHeight = String(v);
    rerender();
  };
  bindSlider(heightSlider, heightNum, applyHeight, { min: 50, max: 1500 });
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.showGradientProperties = showGradientProperties;

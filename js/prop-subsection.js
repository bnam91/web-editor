import { propPanel } from './globals.js';

/* ═══════════════════════════════════
   SUB-SECTION PROPERTIES PANEL
═══════════════════════════════════ */

function rgbToHexSS(rgb) {
  if (!rgb || rgb === 'transparent') return '#ffffff';
  if (/^#/.test(rgb)) return rgb;
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#ffffff';
  return '#' + m.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

export function showSubSectionProperties(ss) {
  const rawBg = ss.style.backgroundColor || ss.dataset.bg || '#f5f5f5';
  const hexBg = rgbToHexSS(rawBg);
  const padY   = parseInt(ss.dataset.padY)   || 24;
  const width  = parseInt(ss.dataset.width)  || 780;
  const height = parseInt(ss.dataset.height) || 520;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1.5"/>
            <rect x="3" y="3" width="6" height="6" rx="1"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">Sub-Section</span>
        </div>
        ${ss.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${ss.id}')">${ss.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">배경</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${hexBg}">
          <input type="color" id="ss-bg-color" value="${hexBg}">
        </div>
        <input type="text" class="prop-color-hex" id="ss-bg-hex" value="${hexBg}" maxlength="7">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="ss-width-slider" min="200" max="860" step="10" value="${width}">
        <input type="number" class="prop-number" id="ss-width-num" min="200" max="860" value="${width}">
      </div>
      <div class="prop-row" style="margin-top:6px;">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="ss-height-slider" min="100" max="1200" step="10" value="${height}">
        <input type="number" class="prop-number" id="ss-height-num" min="100" max="1200" value="${height}">
      </div>
      <div class="prop-row" style="margin-top:6px;">
        <span class="prop-label">상/하 여백</span>
        <input type="range" class="prop-slider" id="ss-pady-slider" min="0" max="200" step="4" value="${padY}">
        <input type="number" class="prop-number" id="ss-pady-num" min="0" max="200" value="${padY}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-hint" style="font-size:11px;color:#999;">서브섹션 클릭 후 플로팅 패널에서 블록을 추가하면 이 안으로 들어갑니다.</div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(ss.id || null);

  // 배경색
  const bgColor = document.getElementById('ss-bg-color');
  const bgHex   = document.getElementById('ss-bg-hex');
  const applyBg = (hex) => {
    ss.style.backgroundColor = hex;
    ss.dataset.bg = hex;
    window.scheduleAutoSave?.();
  };
  bgColor.addEventListener('input', () => {
    bgHex.value = bgColor.value;
    applyBg(bgColor.value);
  });
  bgColor.addEventListener('change', () => { window.pushHistory?.(); });
  bgHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(bgHex.value)) {
      bgColor.value = bgHex.value;
      applyBg(bgHex.value);
    }
  });

  // 높이
  const heightSlider = document.getElementById('ss-height-slider');
  const heightNum    = document.getElementById('ss-height-num');
  const applyHeight  = (v) => {
    ss.dataset.height = v;
    ss.style.minHeight = v + 'px';
    window.scheduleAutoSave?.();
  };
  heightSlider.addEventListener('mousedown', () => window.pushHistory?.());
  heightSlider.addEventListener('input', () => { heightNum.value = heightSlider.value; applyHeight(heightSlider.value); });
  heightNum.addEventListener('change', () => window.pushHistory?.());
  heightNum.addEventListener('input', () => {
    const v = Math.min(1200, Math.max(100, parseInt(heightNum.value) || 520));
    heightSlider.value = v;
    applyHeight(v);
  });

  // 너비
  const widthSlider = document.getElementById('ss-width-slider');
  const widthNum    = document.getElementById('ss-width-num');
  const applyWidth  = (v) => {
    ss.dataset.width = v;
    ss.style.width  = v + 'px';
    ss.style.margin = '0 auto';
    window.scheduleAutoSave?.();
  };
  widthSlider.addEventListener('mousedown', () => window.pushHistory?.());
  widthSlider.addEventListener('input', () => { widthNum.value = widthSlider.value; applyWidth(widthSlider.value); });
  widthNum.addEventListener('change', () => window.pushHistory?.());
  widthNum.addEventListener('input', () => {
    const v = Math.min(860, Math.max(200, parseInt(widthNum.value) || 780));
    widthSlider.value = v;
    applyWidth(v);
  });

  // 상/하 패딩
  const padYSlider = document.getElementById('ss-pady-slider');
  const padYNum    = document.getElementById('ss-pady-num');
  const applyPadY  = (v) => {
    ss.dataset.padY = v;
    ss.style.paddingTop    = v + 'px';
    ss.style.paddingBottom = v + 'px';
    window.scheduleAutoSave?.();
  };
  padYSlider.addEventListener('mousedown', () => window.pushHistory?.());
  padYSlider.addEventListener('input', () => { padYNum.value = padYSlider.value; applyPadY(padYSlider.value); });
  padYNum.addEventListener('change', () => window.pushHistory?.());
  padYNum.addEventListener('input', () => {
    const v = Math.min(200, Math.max(0, parseInt(padYNum.value) || 0));
    padYSlider.value = v;
    applyPadY(v);
  });
}

window.showSubSectionProperties = showSubSectionProperties;

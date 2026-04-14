// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// image-color-adjust.js
// 이미지 색상 조정 패널 + SVG 필터 엔진
//
// 구조:
//   Display  : SVG feColorMatrix + feComponentTransfer (실시간 미리보기)
//   Export   : Canvas API로 bake → export-image.js에서 호출
//   Persistence: img.dataset.adj* 속성 (HTML 직렬화 자동 포함)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FILTER_ID  = 'img-color-adj-filter';
const SVG_EL_ID  = 'img-color-adj-svg';

const DEFAULTS = {
  exposure: 0, contrast: 0, saturation: 0,
  temperature: 0, tint: 0, highlights: 0, shadows: 0,
};

const SLIDERS = [
  { key: 'exposure',     label: '노출' },
  { key: 'contrast',     label: '대비' },
  { key: 'saturation',   label: '채도' },
  { key: 'temperature',  label: '색온도' },
  { key: 'tint',         label: '색조' },
  { key: 'highlights',   label: '하이라이트' },
  { key: 'shadows',      label: '그림자' },
];

// ─────────────────────────────────────────────
// SVG 필터 엔진
// ─────────────────────────────────────────────

function _ensureSVGFilter() {
  if (document.getElementById(SVG_EL_ID)) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = SVG_EL_ID;
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
  svg.innerHTML = `
    <defs>
      <filter id="${FILTER_ID}" color-interpolation-filters="linearRGB" x="0" y="0" width="100%" height="100%">
        <feColorMatrix id="ca-matrix" type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
        <feComponentTransfer>
          <feFuncR id="ca-funcR" type="linear" slope="1" intercept="0"/>
          <feFuncG id="ca-funcG" type="linear" slope="1" intercept="0"/>
          <feFuncB id="ca-funcB" type="linear" slope="1" intercept="0"/>
        </feComponentTransfer>
      </filter>
    </defs>`;
  document.body.appendChild(svg);
}

/**
 * SVG 필터 행렬 업데이트 (피그마 Skia 파이프라인 근사)
 * 순서: Exposure → Contrast → Temperature → Tint → Saturation → Highlights/Shadows
 */
function _updateSVGFilter(adj) {
  _ensureSVGFilter();
  const { exposure=0, contrast=0, saturation=0,
          temperature=0, tint=0, highlights=0, shadows=0 } = adj;

  // ── 선형 행렬 퓨전 ──────────────────────────────
  const e  = Math.pow(2, exposure);               // EV: 2^E
  const c  = Math.max(0.01, 1 + contrast * 3.33); // -0.3~0.3 → -1~1
  const p  = 0.5 * (1 - c);                       // contrast pivot offset
  const s  = Math.max(0, 1 + saturation);
  const t  = temperature * 0.5;                    // R↑B↓ (채도 0.5 감쇠)
  const gK = Math.max(0.01, 1 + tint * 0.5);     // G 채널 스케일 (tint: 마젠타↔그린)

  const lr=0.2126, lg=0.7152, lb=0.0722;
  // saturation + temp/tint를 luma 기반 행렬에 퓨전
  const rr = (lr + (1-lr)*s) * c * e * (1 + t);
  const rg = (lr - lr*s)     * c * e;
  const rb = (lr - lr*s)     * c * e;
  const gr = (lg - lg*s)     * c * e;
  const gg = (lg + (1-lg)*s) * c * e * gK;
  const gb = (lg - lg*s)     * c * e;
  const br = (lb - lb*s)     * c * e;
  const bg = (lb - lb*s)     * c * e;
  const bb = (lb + (1-lb)*s) * c * e * (1 - t);

  const m = document.getElementById('ca-matrix');
  if (m) m.setAttribute('values',
    `${_f(rr)} ${_f(rg)} ${_f(rb)} 0 ${_f(p)}
     ${_f(gr)} ${_f(gg)} ${_f(gb)} 0 ${_f(p)}
     ${_f(br)} ${_f(bg)} ${_f(bb)} 0 ${_f(p)}
     0 0 0 1 0`
  );

  // ── Highlights / Shadows: 17점 tone-curve LUT ──
  const lut = Array.from({ length: 17 }, (_, i) => {
    const v  = i / 16;
    const hl = v > 0.5 ? ((v - 0.5) / 0.5) * highlights * 0.3 : 0;
    const sh = v < 0.5 ? ((0.5 - v) / 0.5) * shadows    * 0.3 : 0;
    return Math.min(1, Math.max(0, v + hl + sh)).toFixed(4);
  }).join(' ');

  ['ca-funcR', 'ca-funcG', 'ca-funcB'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('type', 'table');
    el.setAttribute('tableValues', lut);
  });
}

function _f(n) { return n.toFixed(4); }

// ─────────────────────────────────────────────
// 필터 적용 / 저장
// ─────────────────────────────────────────────

function _isDefault(adj) {
  return Object.keys(DEFAULTS).every(k => Math.abs((adj[k] || 0)) < 0.001);
}

function _readAdj(img) {
  return {
    exposure:    parseFloat(img.dataset.adjExposure    ?? 0),
    contrast:    parseFloat(img.dataset.adjContrast    ?? 0),
    saturation:  parseFloat(img.dataset.adjSaturation  ?? 0),
    temperature: parseFloat(img.dataset.adjTemperature ?? 0),
    tint:        parseFloat(img.dataset.adjTint        ?? 0),
    highlights:  parseFloat(img.dataset.adjHighlights  ?? 0),
    shadows:     parseFloat(img.dataset.adjShadows     ?? 0),
  };
}

function _saveAdj(img, adj) {
  img.dataset.adjExposure    = adj.exposure.toFixed(3);
  img.dataset.adjContrast    = adj.contrast.toFixed(3);
  img.dataset.adjSaturation  = adj.saturation.toFixed(3);
  img.dataset.adjTemperature = adj.temperature.toFixed(3);
  img.dataset.adjTint        = adj.tint.toFixed(3);
  img.dataset.adjHighlights  = adj.highlights.toFixed(3);
  img.dataset.adjShadows     = adj.shadows.toFixed(3);
}

/** 이미지에 색상 조정 적용 (dataset 저장 + SVG filter) */
function applyImgColorAdjust(img, adj) {
  _saveAdj(img, adj);
  if (_isDefault(adj)) {
    img.style.filter = '';
    return;
  }
  _updateSVGFilter(adj);
  img.style.filter = `url(#${FILTER_ID})`;
}

// ─────────────────────────────────────────────
// Export 헬퍼: Canvas API로 필터 bake
// (export-image.js에서 html2canvas 전에 호출)
// ─────────────────────────────────────────────

/**
 * adj 값을 Canvas ctx.filter CSS 문자열로 변환
 * Canvas 2D API ctx.filter는 CSS filter 함수를 완전 지원함
 */
function buildExportCSSFilter(adj) {
  const { exposure=0, contrast=0, saturation=0, temperature=0, tint=0 } = adj;
  const brightness = Math.pow(2, exposure);
  const contrastV  = Math.max(0.01, 1 + contrast * 3.33);
  const saturateV  = Math.max(0, 1 + saturation);
  // Temperature 근사: 따뜻→sepia+hue, 차가움→hue
  const sepiaAmt   = Math.max(0, temperature * 0.35);
  const hueTemp    = temperature >= 0 ? -temperature * 12 : Math.abs(temperature) * 18;
  const hueTint    = -tint * 9;
  const hueTotal   = hueTemp + hueTint;

  return [
    `brightness(${brightness.toFixed(3)})`,
    `contrast(${contrastV.toFixed(3)})`,
    `saturate(${saturateV.toFixed(3)})`,
    sepiaAmt > 0.001 ? `sepia(${sepiaAmt.toFixed(3)})` : '',
    Math.abs(hueTotal) > 0.5 ? `hue-rotate(${hueTotal.toFixed(1)}deg)` : '',
  ].filter(Boolean).join(' ');
}

/**
 * export-image.js에서 호출: 색상 조정이 적용된 img를 Canvas로 bake
 * html2canvas가 SVG filter url()을 지원하지 않으므로 export 전에 교체 필요
 * @param {HTMLImageElement} img - clone 내의 .asset-img
 * @returns {Promise<void>}
 */
async function bakeImgFilterToCanvas(img) {
  const adj = _readAdj(img);
  if (_isDefault(adj)) return; // 조정값 없으면 skip

  const dw = img.offsetWidth  || img.naturalWidth  || 800;
  const dh = img.offsetHeight || img.naturalHeight || 600;

  const canvas = document.createElement('canvas');
  canvas.width  = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');

  // 원본 이미지 로드 (이미 로드된 경우 즉시)
  const imgObj = new Image();
  imgObj.crossOrigin = 'anonymous';
  imgObj.src = img.src;
  await new Promise(res => { imgObj.onload = imgObj.onerror = res; });

  // Canvas 2D ctx.filter 적용 (brightness/contrast/saturate/sepia/hue-rotate)
  const cssFilter = buildExportCSSFilter(adj);
  if (cssFilter) ctx.filter = cssFilter;
  ctx.drawImage(imgObj, 0, 0, dw, dh);
  ctx.filter = 'none';

  // Highlights / Shadows: 픽셀 직접 조작 (Canvas ctx.filter로 표현 불가)
  const { highlights=0, shadows=0 } = adj;
  if (Math.abs(highlights) > 0.001 || Math.abs(shadows) > 0.001) {
    const imgData = ctx.getImageData(0, 0, dw, dh);
    const px = imgData.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i]/255, g = px[i+1]/255, b = px[i+2]/255;
      const luma = 0.2126*r + 0.7152*g + 0.0722*b;
      const hl = luma > 0.5 ? ((luma-0.5)/0.5) * highlights * 0.3 : 0;
      const sh = luma < 0.5 ? ((0.5-luma)/0.5) * shadows    * 0.3 : 0;
      const d = hl + sh;
      px[i]   = Math.min(255, Math.max(0, Math.round(px[i]   + d*255)));
      px[i+1] = Math.min(255, Math.max(0, Math.round(px[i+1] + d*255)));
      px[i+2] = Math.min(255, Math.max(0, Math.round(px[i+2] + d*255)));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // img를 canvas로 교체 (style 복사)
  canvas.style.cssText   = img.style.cssText;
  canvas.style.filter    = '';
  canvas.style.objectFit = '';
  canvas.style.display   = 'block';
  img.parentNode?.replaceChild(canvas, img);
}

window.bakeImgFilterToCanvas = bakeImgFilterToCanvas;

// ─────────────────────────────────────────────
// 색상 조정 패널 UI
// ─────────────────────────────────────────────

let _currentAb = null;

function _buildPanelHTML(adj) {
  const rows = SLIDERS.map(({ key, label }) => {
    const val = Math.round((adj[key] || 0) * 100);
    return `
      <div class="prop-row">
        <span class="prop-label ca-label">${label}</span>
        <input type="range"  class="prop-slider" id="ca-${key}" min="-100" max="100" step="1" value="${val}">
        <input type="number" class="prop-number"  id="ca-${key}-num" min="-100" max="100" value="${val}" style="width:40px">
      </div>`;
  }).join('');

  return `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="#888" stroke-width="1.2"/>
            <path d="M6 2v1M6 9v1M2 6h1M9 6h1M3.17 3.17l.7.7M8.13 8.13l.7.7M3.17 8.83l.7-.7M8.13 3.87l.7-.7"
              stroke="#888" stroke-width="1.1" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="prop-block-name">색상 조정</span>
      </div>
      ${rows}
      <div style="padding-top:4px">
        <button class="prop-export-btn" id="ca-reset-btn"
          style="background:var(--ui-bg-input);color:var(--ui-text-sub);border:1px solid var(--ui-border-mid);">
          초기화
        </button>
      </div>
    </div>`;
}

function _bindSliders(img) {
  SLIDERS.forEach(({ key }) => {
    const slider = document.getElementById(`ca-${key}`);
    const numEl  = document.getElementById(`ca-${key}-num`);
    if (!slider || !numEl) return;

    const update = v => {
      slider.value = v;
      numEl.value  = v;
      const adj = _readAdj(img);
      adj[key] = v / 100;
      applyImgColorAdjust(img, adj);
      window.scheduleAutoSave?.();
    };

    slider.addEventListener('input', () => update(parseInt(slider.value)));
    numEl.addEventListener('input', () => {
      const v = Math.min(100, Math.max(-100, parseInt(numEl.value) || 0));
      update(v);
    });
  });

  const resetBtn = document.getElementById('ca-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      applyImgColorAdjust(img, { ...DEFAULTS });
      SLIDERS.forEach(({ key }) => {
        const sl = document.getElementById(`ca-${key}`);
        const nu = document.getElementById(`ca-${key}-num`);
        if (sl) sl.value = 0;
        if (nu) nu.value = 0;
      });
      window.scheduleAutoSave?.();
    });
  }
}

// ─────────────────────────────────────────────
// 플로팅 패널 드래그
// ─────────────────────────────────────────────

let _panelPos = null; // { right, top } — null = 기본 CSS 위치 사용

function _initPanelDrag() {
  const panel  = document.getElementById('color-adjust-panel');
  const header = document.getElementById('color-adjust-header');
  const closeBtn = document.getElementById('color-adjust-close');
  if (!panel || !header) return;

  if (closeBtn) {
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      hideColorAdjustPanel();
    });
  }

  let dragging = false;
  let startX, startY, startLeft, startTop;

  header.addEventListener('mousedown', e => {
    if (e.target === closeBtn) return;
    e.preventDefault();
    dragging = true;

    // fixed 좌표로 전환 (right → left 방식으로 드래그 처리)
    const rect = panel.getBoundingClientRect();
    panel.style.left  = rect.left + 'px';
    panel.style.top   = rect.top  + 'px';
    panel.style.right = 'auto';
    startX    = e.clientX;
    startY    = e.clientY;
    startLeft = rect.left;
    startTop  = rect.top;

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const newLeft = startLeft + dx;
    const newTop  = Math.max(0, startTop  + dy);
    panel.style.left = newLeft + 'px';
    panel.style.top  = newTop  + 'px';
    _panelPos = { left: newLeft, top: newTop };
  }

  function onUp() {
    dragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
}

function showColorAdjustPanel(ab) {
  const panel = document.getElementById('color-adjust-panel');
  const body  = document.getElementById('color-adjust-body');
  if (!panel || !body) return;

  _currentAb = ab;
  const img = ab.querySelector('.asset-img');
  if (!img) return;

  const adj = _readAdj(img);
  body.innerHTML = _buildPanelHTML(adj);

  // 드래그로 이동한 위치가 있으면 복원, 없으면 기본 CSS 위치
  if (_panelPos) {
    panel.style.left  = _panelPos.left + 'px';
    panel.style.top   = _panelPos.top  + 'px';
    panel.style.right = 'auto';
  } else {
    panel.style.left  = '';
    panel.style.top   = '';
    panel.style.right = '';
  }

  panel.style.display = 'flex';

  // 이미 적용된 필터가 있으면 SVG 필터 상태도 동기화
  if (!_isDefault(adj)) _updateSVGFilter(adj);

  _bindSliders(img);
}

function hideColorAdjustPanel() {
  const panel = document.getElementById('color-adjust-panel');
  if (panel) panel.style.display = 'none';
  _currentAb = null;
}

// DOM 준비 후 드래그 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initPanelDrag);
} else {
  _initPanelDrag();
}

// 외부에서 이미지 로드 시 저장된 adj 복원 (loadImageToAsset 후 호출)
function restoreImgColorAdjust(img) {
  const adj = _readAdj(img);
  if (_isDefault(adj)) return;
  _updateSVGFilter(adj);
  img.style.filter = `url(#${FILTER_ID})`;
}

window.showColorAdjustPanel  = showColorAdjustPanel;
window.hideColorAdjustPanel  = hideColorAdjustPanel;
window.applyImgColorAdjust   = applyImgColorAdjust;
window.restoreImgColorAdjust = restoreImgColorAdjust;
window.bakeImgFilterToCanvas = bakeImgFilterToCanvas;

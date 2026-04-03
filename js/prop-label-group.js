import { propPanel } from './globals.js';

// 라벨 스타일 프리셋 정의
const LABEL_STYLE_PRESETS = {
  Default: { bg: '#111111', color: '#ffffff', border: 'none' },
  Filled:  { bg: '#333333', color: '#ffffff', border: 'none' },
  Outline: { bg: 'transparent', color: '#111111', border: '1.5px solid #111111' },
  Ghost:   { bg: 'rgba(0,0,0,0.06)', color: '#333333', border: 'none' },
};

/** 단일 label-item에 스타일 프리셋 적용 */
function _applyPresetToItem(item, presetName) {
  const p = LABEL_STYLE_PRESETS[presetName];
  if (!p) return;
  item.style.backgroundColor = p.bg;
  item.style.color = p.color;
  item.style.border = p.border;
  item.dataset.bg    = p.bg;
  item.dataset.color = p.color;
}

function showLabelGroupProperties(block, selectedItem) {
  const isAbsolute = block.style.position === 'absolute';
  const currentW   = parseInt(block.style.width)  || Math.round(block.offsetWidth);
  const currentX   = parseInt(block.style.left)   || 0;
  const currentY   = parseInt(block.style.top)    || 0;
  const gap        = parseInt(block.style.gap) || 10;
  const jc         = block.style.justifyContent || 'flex-start';
  const align      = jc === 'center' ? 'center' : jc === 'flex-end' ? 'right' : 'left';
  const firstItem  = block.querySelector('.label-item');
  const allItemPadT = parseInt(firstItem?.style.paddingTop)    || 4;
  const allItemPadB = parseInt(firstItem?.style.paddingBottom) || 4;
  const allItemH   = allItemPadT + allItemPadB;
  const itemBg     = selectedItem?.dataset.bg     || '#111111';
  const itemColor  = selectedItem?.dataset.color  || '#ffffff';
  const itemRadius = parseInt(selectedItem?.dataset.radius ?? 40);
  const itemPadT   = parseInt(selectedItem?.style.paddingTop)    || 4;
  const itemPadB   = parseInt(selectedItem?.style.paddingBottom) || 4;
  const itemH      = itemPadT + itemPadB;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="3" width="4" height="6" rx="3"/>
            <rect x="7" y="3" width="4" height="6" rx="3"/>
          </svg>
        </div>
        <span class="prop-block-name">Tags</span>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${block.id}')">${block.id}</span>` : ''}
      </div>
      <div class="prop-section-title">Style</div>
      <div class="prop-row">
        <span class="prop-label">Preset</span>
        <select class="prop-select" id="lg-style-select">
          <option value="Default">Default</option>
          <option value="Filled">Filled</option>
          <option value="Outline">Outline</option>
          <option value="Ghost">Ghost</option>
        </select>
      </div>
      <div class="prop-row">
        <button class="prop-full-btn" id="lg-apply-all-btn">전체 적용</button>
      </div>
      <div class="prop-section-title">정렬</div>
      <div class="prop-align-group">
        <button class="prop-align-btn ${align==='left'?'active':''}" data-align="left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn ${align==='center'?'active':''}" data-align="center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn ${align==='right'?'active':''}" data-align="right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
      <div class="prop-section-title">간격</div>
      <div class="prop-row">
        <span class="prop-label">Gap</span>
        <input type="range"  class="prop-slider" id="lg-gap-slider" min="0" max="60" step="2" value="${gap}">
        <input type="number" class="prop-number"  id="lg-gap-number" min="0" max="60" value="${gap}">
      </div>
      <div class="prop-section-title">높이 (전체)</div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range"  class="prop-slider" id="lg-all-height-slider" min="0" max="120" step="2" value="${allItemH}">
        <input type="number" class="prop-number"  id="lg-all-height-number" min="0" max="120" value="${allItemH}">
      </div>
    </div>

    ${selectedItem ? `
    <div class="prop-section">
      <div class="prop-section-title">선택된 태그</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${itemBg}">
          <input type="color" id="lg-item-bg" value="${itemBg}">
        </div>
        <input type="text" class="prop-color-hex" id="lg-item-bg-hex" value="${itemBg}" maxlength="7">
      </div>
      <div class="prop-color-row">
        <span class="prop-label">글자색</span>
        <div class="prop-color-swatch" style="background:${itemColor}">
          <input type="color" id="lg-item-color" value="${itemColor}">
        </div>
        <input type="text" class="prop-color-hex" id="lg-item-color-hex" value="${itemColor}" maxlength="7">
      </div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range"  class="prop-slider" id="lg-item-radius-slider" min="0" max="50" step="1" value="${itemRadius}">
        <input type="number" class="prop-number"  id="lg-item-radius-number" min="0" max="50" value="${itemRadius}">
      </div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range"  class="prop-slider" id="lg-item-height-slider" min="0" max="120" step="2" value="${itemH}">
        <input type="number" class="prop-number"  id="lg-item-height-number" min="0" max="120" value="${itemH}">
      </div>
    </div>
    ` : `
    <div class="prop-section">
      <div class="prop-section-title" style="color:#666;font-size:10px;">태그를 클릭하면 개별 색상을 변경할 수 있어요</div>
    </div>
    `}

    ${isAbsolute ? `
    <div class="prop-section">
      <div class="prop-section-title">너비</div>
      <div class="prop-row">
        <span class="prop-label">Width</span>
        <input type="range"  class="prop-slider" id="lg-width-slider" min="40" max="860" step="4" value="${currentW}">
        <input type="number" class="prop-number"  id="lg-width-number" min="40" max="860" value="${currentW}">
      </div>
      <div class="prop-section-title">위치</div>
      <div class="prop-row">
        <span class="prop-label" style="width:16px">X</span>
        <input type="number" class="prop-number" id="lg-x-number" value="${currentX}" style="width:72px">
        <span class="prop-label" style="width:16px;margin-left:8px">Y</span>
        <input type="number" class="prop-number" id="lg-y-number" value="${currentY}" style="width:72px">
      </div>
    </div>
    ` : ''}
  `;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  // 정렬
  propPanel.querySelectorAll('.prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.align;
      block.style.justifyContent = a === 'center' ? 'center' : a === 'right' ? 'flex-end' : 'flex-start';
      propPanel.querySelectorAll('.prop-align-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 간격
  const gapSlider = document.getElementById('lg-gap-slider');
  const gapNumber = document.getElementById('lg-gap-number');
  gapSlider?.addEventListener('input', () => {
    block.style.gap = gapSlider.value + 'px';
    gapNumber.value = gapSlider.value;
  });
  gapSlider?.addEventListener('change', () => window.pushHistory?.());
  gapNumber?.addEventListener('input', () => {
    const v = Math.min(60, Math.max(0, parseInt(gapNumber.value) || 0));
    block.style.gap = v + 'px';
    gapSlider.value = v;
  });
  gapNumber?.addEventListener('change', () => window.pushHistory?.());

  // 전체 태그 높이 일괄 조절
  const allHSlider = document.getElementById('lg-all-height-slider');
  const allHNumber = document.getElementById('lg-all-height-number');
  const setAllItemH = v => {
    const half = Math.round(v / 2);
    block.querySelectorAll('.label-item').forEach(item => {
      item.style.paddingTop    = half + 'px';
      item.style.paddingBottom = half + 'px';
    });
  };
  allHSlider?.addEventListener('input', () => { setAllItemH(parseInt(allHSlider.value)); allHNumber.value = allHSlider.value; });
  allHSlider?.addEventListener('change', () => window.pushHistory?.());
  allHNumber?.addEventListener('input', () => {
    const v = Math.min(120, Math.max(0, parseInt(allHNumber.value) || 0));
    setAllItemH(v); allHSlider.value = v;
  });
  allHNumber?.addEventListener('change', () => window.pushHistory?.());

  // ── 스타일 프리셋 드롭다운 (C17) ───────────────────────────────────
  const styleSelect = document.getElementById('lg-style-select');
  const applyAllBtn = document.getElementById('lg-apply-all-btn');

  // 드롭다운 변경 시 선택된 태그에만 즉시 적용
  styleSelect?.addEventListener('change', () => {
    if (!selectedItem) return;
    window.pushHistory?.();
    _applyPresetToItem(selectedItem, styleSelect.value);
    // 컬러 픽커 동기화
    const bgPicker2 = document.getElementById('lg-item-bg');
    const bgHex2    = document.getElementById('lg-item-bg-hex');
    const colorPicker2 = document.getElementById('lg-item-color');
    const colorHex2    = document.getElementById('lg-item-color-hex');
    const p = LABEL_STYLE_PRESETS[styleSelect.value];
    if (p) {
      const bgVal = p.bg.startsWith('rgba') || p.bg === 'transparent' ? '#ffffff' : p.bg;
      if (bgPicker2) bgPicker2.value = bgVal;
      if (bgHex2)    bgHex2.value    = bgVal;
      if (colorPicker2) colorPicker2.value = p.color;
      if (colorHex2)    colorHex2.value    = p.color;
    }
  });

  // C18: 전체 적용 버튼 — 캔버스 전체 label-group-block의 모든 label-item에 적용
  applyAllBtn?.addEventListener('click', () => {
    window.pushHistory?.();
    const presetName = styleSelect?.value || 'Default';
    const canvas = document.getElementById('canvas') || document.querySelector('.canvas-area') || document.body;
    canvas.querySelectorAll('.label-group-block .label-item').forEach(item => {
      _applyPresetToItem(item, presetName);
    });
    // CSS 변수도 업데이트 (design-system 연동)
    const p = LABEL_STYLE_PRESETS[presetName];
    if (p && window.DesignSystem) {
      const tokens = {
        '--preset-label-bg':    p.bg === 'transparent' ? 'transparent' : p.bg,
        '--preset-label-color': p.color,
      };
      document.documentElement.style.setProperty('--preset-label-bg', tokens['--preset-label-bg']);
      document.documentElement.style.setProperty('--preset-label-color', tokens['--preset-label-color']);
    }
  });

  if (!selectedItem) return;

  // 아이템 배경색
  const bgPicker = document.getElementById('lg-item-bg');
  const bgHex    = document.getElementById('lg-item-bg-hex');
  const bgSwatch = bgPicker?.closest('.prop-color-swatch');
  const setBg = val => {
    selectedItem.style.backgroundColor = val;
    selectedItem.dataset.bg = val;
    if (bgSwatch) bgSwatch.style.background = val;
    if (bgPicker) bgPicker.value = val;
    if (bgHex)    bgHex.value = val;
  };
  bgPicker?.addEventListener('input', () => setBg(bgPicker.value));
  bgPicker?.addEventListener('change', () => window.pushHistory?.());
  bgHex?.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(bgHex.value)) setBg(bgHex.value);
  });
  bgHex?.addEventListener('change', () => window.pushHistory?.());

  // 아이템 글자색
  const colorPicker = document.getElementById('lg-item-color');
  const colorHex    = document.getElementById('lg-item-color-hex');
  const colorSwatch = colorPicker?.closest('.prop-color-swatch');
  const setColor = val => {
    selectedItem.style.color = val;
    selectedItem.dataset.color = val;
    if (colorSwatch) colorSwatch.style.background = val;
    if (colorPicker) colorPicker.value = val;
    if (colorHex)    colorHex.value = val;
  };
  colorPicker?.addEventListener('input', () => setColor(colorPicker.value));
  colorPicker?.addEventListener('change', () => window.pushHistory?.());
  colorHex?.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(colorHex.value)) setColor(colorHex.value);
  });
  colorHex?.addEventListener('change', () => window.pushHistory?.());

  // 모서리
  const rSlider = document.getElementById('lg-item-radius-slider');
  const rNumber = document.getElementById('lg-item-radius-number');
  rSlider?.addEventListener('input', () => {
    selectedItem.style.borderRadius = rSlider.value + 'px';
    selectedItem.dataset.radius = rSlider.value;
    rNumber.value = rSlider.value;
  });
  rSlider?.addEventListener('change', () => window.pushHistory?.());
  rNumber?.addEventListener('input', () => {
    const v = Math.min(50, Math.max(0, parseInt(rNumber.value) || 0));
    selectedItem.style.borderRadius = v + 'px';
    selectedItem.dataset.radius = v;
    rSlider.value = v;
  });
  rNumber?.addEventListener('change', () => window.pushHistory?.());

  // 태그 높이 (상하 패딩으로 조절)
  const iHSlider = document.getElementById('lg-item-height-slider');
  const iHNumber = document.getElementById('lg-item-height-number');
  const setItemH = v => {
    const half = Math.round(v / 2);
    selectedItem.style.paddingTop    = half + 'px';
    selectedItem.style.paddingBottom = half + 'px';
  };
  iHSlider?.addEventListener('input', () => { setItemH(parseInt(iHSlider.value)); iHNumber.value = iHSlider.value; });
  iHSlider?.addEventListener('change', () => window.pushHistory?.());
  iHNumber?.addEventListener('input', () => {
    const v = Math.min(120, Math.max(0, parseInt(iHNumber.value) || 0));
    setItemH(v); iHSlider.value = v;
  });
  iHNumber?.addEventListener('change', () => window.pushHistory?.());

  // 너비 / 위치 (서브섹션 내 absolute 전용)
  if (isAbsolute) {
    const wSlider = document.getElementById('lg-width-slider');
    const wNumber = document.getElementById('lg-width-number');
    const setW = v => { block.style.width = v + 'px'; };
    wSlider?.addEventListener('input', () => { setW(+wSlider.value); wNumber.value = wSlider.value; });
    wSlider?.addEventListener('change', () => window.pushHistory?.());
    wNumber?.addEventListener('input', () => {
      const v = Math.min(860, Math.max(40, parseInt(wNumber.value) || 40));
      setW(v); wSlider.value = v;
    });
    wNumber?.addEventListener('change', () => window.pushHistory?.());

    const xNum = document.getElementById('lg-x-number');
    const yNum = document.getElementById('lg-y-number');
    xNum?.addEventListener('input', () => { block.style.left = (parseInt(xNum.value) || 0) + 'px'; });
    xNum?.addEventListener('change', () => window.pushHistory?.());
    yNum?.addEventListener('input', () => { block.style.top  = (parseInt(yNum.value) || 0) + 'px'; });
    yNum?.addEventListener('change', () => window.pushHistory?.());
  }
}

window.showLabelGroupProperties = showLabelGroupProperties;

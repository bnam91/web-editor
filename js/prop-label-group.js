function showLabelGroupProperties(block, selectedItem) {
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
  `;

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
  gapNumber?.addEventListener('input', () => {
    const v = Math.min(60, Math.max(0, parseInt(gapNumber.value) || 0));
    block.style.gap = v + 'px';
    gapSlider.value = v;
  });

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
  allHNumber?.addEventListener('input', () => {
    const v = Math.min(120, Math.max(0, parseInt(allHNumber.value) || 0));
    setAllItemH(v); allHSlider.value = v;
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
  bgHex?.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(bgHex.value)) setBg(bgHex.value);
  });

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
  colorHex?.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(colorHex.value)) setColor(colorHex.value);
  });

  // 모서리
  const rSlider = document.getElementById('lg-item-radius-slider');
  const rNumber = document.getElementById('lg-item-radius-number');
  rSlider?.addEventListener('input', () => {
    selectedItem.style.borderRadius = rSlider.value + 'px';
    selectedItem.dataset.radius = rSlider.value;
    rNumber.value = rSlider.value;
  });
  rNumber?.addEventListener('input', () => {
    const v = Math.min(50, Math.max(0, parseInt(rNumber.value) || 0));
    selectedItem.style.borderRadius = v + 'px';
    selectedItem.dataset.radius = v;
    rSlider.value = v;
  });

  // 태그 높이 (상하 패딩으로 조절)
  const iHSlider = document.getElementById('lg-item-height-slider');
  const iHNumber = document.getElementById('lg-item-height-number');
  const setItemH = v => {
    const half = Math.round(v / 2);
    selectedItem.style.paddingTop    = half + 'px';
    selectedItem.style.paddingBottom = half + 'px';
  };
  iHSlider?.addEventListener('input', () => { setItemH(parseInt(iHSlider.value)); iHNumber.value = iHSlider.value; });
  iHNumber?.addEventListener('input', () => {
    const v = Math.min(120, Math.max(0, parseInt(iHNumber.value) || 0));
    setItemH(v); iHSlider.value = v;
  });
}

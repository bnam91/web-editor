function showAssetProperties(ab) {
  const ratioStr   = getCurrentRatioStr(ab);
  const currentH   = parseInt(ab.style.height) || ab.offsetHeight || 780;
  const hasImage   = ab.classList.contains('has-image');
  const currentR   = parseInt(ab.style.borderRadius) || 0;
  const currentW   = ab.offsetWidth || 400;
  const currentAlign = ab.dataset.align || 'center';
  if (!ab.dataset.align) { ab.dataset.align = 'center'; ab.style.alignSelf = 'center'; }
  const currentSize  = ab.dataset.size  || '100';

  const imageSection = hasImage ? `
    <div class="prop-section">
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn secondary" id="asset-replace-btn">이미지 교체</button>
      <button class="prop-action-btn danger"    id="asset-remove-btn">이미지 제거</button>
    </div>` : `
    <div class="prop-section">
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn primary" id="asset-upload-btn">이미지 선택</button>
      <div style="text-align:center;font-size:11px;color:#555;margin-top:6px;">또는 블록에 파일을 드래그</div>
    </div>`;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="1" width="10" height="10" rx="1"/>
            <circle cx="4" cy="4" r="1"/>
            <polyline points="11 8 8 5 3 11"/>
          </svg>
        </div>
        <span class="prop-block-name">Asset Block</span>
        ${ab.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${ab.id}')">${ab.id}</span>` : ''}
      </div>
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-layout-input" id="layout-ratio" value="${ratioStr}" placeholder="2*2">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">프리셋</div>
      <div class="prop-preset-group">
        <button class="prop-preset-btn" data-w="860" data-h="780">Standard<span>860×780</span></button>
        <button class="prop-preset-btn" data-w="860" data-h="1032">Tall<span>860×1032</span></button>
        <button class="prop-preset-btn" data-w="860" data-h="575">Wide<span>860×575</span></button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" id="asset-align-group">
          <button class="prop-align-btn${currentAlign==='left'?' active':''}"   data-align="left">←</button>
          <button class="prop-align-btn${currentAlign==='center'?' active':''}" data-align="center">↔</button>
          <button class="prop-align-btn${currentAlign==='right'?' active':''}"  data-align="right">→</button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">높이</span>
        <input type="range" class="prop-slider" id="asset-h-slider" min="200" max="1600" step="10" value="${currentH}">
        <input type="number" class="prop-number" id="asset-h-number" min="200" max="1600" value="${currentH}">
      </div>
      <div class="prop-row">
        <span class="prop-label">모서리</span>
        <input type="range" class="prop-slider" id="asset-r-slider" min="0" max="120" step="2" value="${currentR}">
        <input type="number" class="prop-number" id="asset-r-number" min="0" max="120" value="${currentR}">
      </div>
      <div class="prop-row">
        <span class="prop-label">사이즈</span>
        <select class="prop-select" id="asset-size-select">
          <option value="85"  ${currentSize==='85'  ?'selected':''}>85%</option>
          <option value="90"  ${currentSize==='90'  ?'selected':''}>90%</option>
          <option value="95"  ${currentSize==='95'  ?'selected':''}>95%</option>
          <option value="100" ${currentSize==='100' ?'selected':''}>100%</option>
        </select>
      </div>
    </div>
    ${imageSection}`;

  bindLayoutInput(ab);

  const hSlider = document.getElementById('asset-h-slider');
  const hNumber = document.getElementById('asset-h-number');
  const applyH = v => {
    ab.style.height = v + 'px';
    hSlider.value = v;
    hNumber.value = v;
  };
  hSlider.addEventListener('input', () => { applyH(parseInt(hSlider.value)); pushHistory(); });
  hNumber.addEventListener('change', () => {
    const v = Math.min(1600, Math.max(200, parseInt(hNumber.value) || 780));
    applyH(v); pushHistory();
  });

  document.querySelectorAll('.prop-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const h = parseInt(btn.dataset.h);
      ab.style.width  = '';
      ab.style.height = h + 'px';
      ab.dataset.size = '100';
      document.getElementById('asset-size-select').value = '100';
      applyH(h);
      pushHistory();
    });
  });


  const applyAlign = a => {
    ab.dataset.align = a;
    if (a === 'left')   ab.style.alignSelf = 'flex-start';
    if (a === 'center') ab.style.alignSelf = 'center';
    if (a === 'right')  ab.style.alignSelf = 'flex-end';
    document.querySelectorAll('#asset-align-group .prop-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === a));
  };
  document.querySelectorAll('#asset-align-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => applyAlign(btn.dataset.align));
  });

  const rSlider = document.getElementById('asset-r-slider');
  const rNumber = document.getElementById('asset-r-number');
  const applyR = v => { ab.style.borderRadius = v + 'px'; };
  rSlider.addEventListener('input', () => { applyR(parseInt(rSlider.value)); rNumber.value = rSlider.value; });
  rNumber.addEventListener('input', () => {
    const v = Math.min(120, Math.max(0, parseInt(rNumber.value) || 0));
    applyR(v); rSlider.value = v;
  });

  document.getElementById('asset-size-select').addEventListener('change', e => {
    const v = e.target.value;
    ab.dataset.size = v;

    const prevW = ab.offsetWidth;
    const prevH = parseInt(ab.style.height) || ab.offsetHeight;
    const ratio = prevH / prevW;

    ab.style.width = v === '100' ? '' : v + '%';

    requestAnimationFrame(() => {
      const newW = ab.offsetWidth;
      ab.style.height = Math.round(newW * ratio) + 'px';
      pushHistory();
    });
  });

  if (hasImage) {
    document.getElementById('asset-replace-btn').addEventListener('click', () => triggerAssetUpload(ab));
    document.getElementById('asset-remove-btn').addEventListener('click', () => clearAssetImage(ab));
  } else {
    document.getElementById('asset-upload-btn').addEventListener('click', () => triggerAssetUpload(ab));
  }
}

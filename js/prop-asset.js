import { propPanel, state } from './globals.js';

export function applyAssetPadX(ab, padX) {
  const canvasW = 860;
  const baseH   = parseInt(ab.dataset.baseHeight) || parseInt(ab.style.height) || 780;
  const newW    = canvasW - padX * 2;
  const newH    = Math.round(baseH * newW / canvasW);
  const pct     = Math.round(newW / canvasW * 10000) / 100; // 소수점 2자리 %
  ab.style.paddingLeft  = '';
  ab.style.paddingRight = '';
  ab.style.width        = pct + '%';
  ab.style.alignSelf    = 'center';
  ab.style.height       = newH + 'px';
}

export function showAssetProperties(ab) {
  const ratioStr   = window.getCurrentRatioStr(ab);
  const currentH   = parseInt(ab.style.height) || ab.offsetHeight || 780;
  const hasImage   = ab.classList.contains('has-image');
  const currentR   = parseInt(ab.style.borderRadius) || 0;
  const currentW   = ab.offsetWidth || 400;
  const currentAlign = ab.dataset.align || 'center';
  if (!ab.dataset.align) { ab.dataset.align = 'center'; ab.style.alignSelf = 'center'; }
  const currentSize   = ab.dataset.size    || '100';
  const usePadX       = ab.dataset.usePadx === 'true';
  const overlayOn     = ab.dataset.overlay === 'true';
  // 기존 overlay 요소 가져오기 (없으면 생성)
  let overlayEl = ab.querySelector('.asset-overlay');
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.className = 'asset-overlay';
    ab.appendChild(overlayEl);
  }
  const overlayColor = overlayEl.style.color || '#ffffff';
  const overlayOpacity = parseFloat(overlayEl.dataset.ovOpacity ?? '0.35');

  const currentBgColor = ab.dataset.bgColor || '#a0a0a0';
  const imageSection = hasImage ? `
    <div class="prop-section">
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn secondary" id="asset-pos-btn">이미지 위치 조절</button>
      <button class="prop-action-btn secondary" id="asset-replace-btn">이미지 교체</button>
      <button class="prop-action-btn danger"    id="asset-remove-btn">이미지 제거</button>
    </div>` : `
    <div class="prop-section">
      <div class="prop-section-title">이미지</div>
      <button class="prop-action-btn primary" id="asset-upload-btn">이미지 선택</button>
      <div style="text-align:center;font-size:11px;color:#555;margin-top:6px;">또는 블록에 파일을 드래그</div>
      <div class="prop-row" style="margin-top:10px;">
        <span class="prop-label">배경색</span>
        <input type="color" id="asset-bg-color" value="${currentBgColor}" style="width:32px;height:22px;border:none;background:none;cursor:pointer;padding:0;border-radius:3px;">
        <button class="prop-align-btn" id="asset-bg-clear" style="font-size:10px;padding:0 8px;margin-left:4px;">초기화</button>
      </div>
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
        <div class="prop-block-info">
          <span class="prop-block-name">Asset Block</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(ab)}</span>
        </div>
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
        <button class="prop-preset-btn" data-w="860" data-h="860">Square<span>860×860</span></button>
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
        <span class="prop-label">페이지 패딩</span>
        <label class="prop-toggle">
          <input type="checkbox" id="asset-padx-toggle" ${usePadX ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
    </div>
    ${imageSection}
    <div class="prop-section">
      <div class="prop-section-title">텍스트 오버레이</div>
      <div class="prop-row">
        <span class="prop-label">활성화</span>
        <label class="prop-toggle">
          <input type="checkbox" id="asset-overlay-toggle" ${overlayOn ? 'checked' : ''}>
          <span class="prop-toggle-track"></span>
        </label>
      </div>
      <div id="asset-overlay-controls" style="${overlayOn ? '' : 'display:none'}">
        <div class="prop-row">
          <span class="prop-label">불투명</span>
          <input type="range" class="prop-slider" id="asset-overlay-opacity" min="0" max="100" step="1" value="${Math.round(overlayOpacity * 100)}">
          <input type="number" class="prop-number" id="asset-overlay-opacity-num" min="0" max="100" value="${Math.round(overlayOpacity * 100)}">
        </div>
        <div class="prop-row">
          <span class="prop-label">위치</span>
          <div class="prop-align-group" id="overlay-position-group" style="flex:1">
            <button class="prop-align-btn${(overlayEl.style.justifyContent||'center')==='flex-start'?' active':''}" data-pos="flex-start" style="flex:1;font-size:11px">↑ 상단</button>
            <button class="prop-align-btn${(overlayEl.style.justifyContent||'center')==='center'?' active':''}" data-pos="center" style="flex:1;font-size:11px">↕ 중앙</button>
            <button class="prop-align-btn${(overlayEl.style.justifyContent||'center')==='flex-end'?' active':''}" data-pos="flex-end" style="flex:1;font-size:11px">↓ 하단</button>
          </div>
        </div>
        <div class="prop-row">
          <button class="prop-action-btn primary" id="overlay-add-text-btn">+ 텍스트 추가</button>
          <button class="prop-action-btn secondary" id="overlay-del-text-btn">− 텍스트 제거</button>
        </div>
        <div style="font-size:11px;color:#555;margin-top:2px;">더블클릭으로 편집</div>
      </div>
    </div>`;

  window.bindLayoutInput(ab);

  const hSlider = document.getElementById('asset-h-slider');
  const hNumber = document.getElementById('asset-h-number');

  document.getElementById('asset-padx-toggle').addEventListener('change', e => {
    if (e.target.checked) {
      ab.dataset.usePadx = 'true';
      ab.dataset.baseHeight = parseInt(ab.style.height) || 780;
      applyAssetPadX(ab, state.pageSettings.padX || 0);
    } else {
      ab.dataset.usePadx = 'false';
      const baseH = parseInt(ab.dataset.baseHeight) || 780;
      ab.style.paddingLeft  = '';
      ab.style.paddingRight = '';
      ab.style.width  = '';
      ab.style.height = baseH + 'px';
    }
    hSlider.value = parseInt(ab.style.height);
    hNumber.value = parseInt(ab.style.height);
    window.pushHistory();
  });

  const applyH = v => {
    ab.style.height = v + 'px';
    hSlider.value = v;
    hNumber.value = v;
  };
  hSlider.addEventListener('input', () => { applyH(parseInt(hSlider.value)); window.pushHistory(); });
  hNumber.addEventListener('change', () => {
    const v = Math.min(1600, Math.max(200, parseInt(hNumber.value) || 780));
    applyH(v); window.pushHistory();
  });

  document.querySelectorAll('.prop-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const h = parseInt(btn.dataset.h);
      ab.dataset.size       = '100';
      ab.dataset.baseHeight = h;  // 항상 baseHeight 갱신

      if (ab.dataset.usePadx === 'true') {
        // 패딩 ON 상태 → 패딩 적용한 너비/높이로 계산
        applyAssetPadX(ab, state.pageSettings.padX || 0);
        applyH(parseInt(ab.style.height));
      } else {
        ab.style.width  = '';
        ab.style.height = h + 'px';
        applyH(h);
      }
      window.pushHistory();
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


  if (hasImage) {
    document.getElementById('asset-pos-btn').addEventListener('click', () => window.enterPosDragMode(ab));
    document.getElementById('asset-replace-btn').addEventListener('click', () => window.triggerAssetUpload(ab));
    document.getElementById('asset-remove-btn').addEventListener('click', () => window.clearAssetImage(ab));
  } else {
    document.getElementById('asset-upload-btn').addEventListener('click', () => window.triggerAssetUpload(ab));
    const bgColorInput = document.getElementById('asset-bg-color');
    bgColorInput.addEventListener('input', e => {
      ab.dataset.bgColor = e.target.value;
      ab.style.backgroundColor = e.target.value;
      window.pushHistory();
    });
    document.getElementById('asset-bg-clear').addEventListener('click', () => {
      delete ab.dataset.bgColor;
      ab.style.backgroundColor = '';
      bgColorInput.value = '#a0a0a0';
      window.pushHistory();
    });
  }

  // ── 오버레이 이벤트 바인딩 ──
  const applyOverlayBg = opacity => {
    overlayEl.style.background = `rgba(0,0,0,${opacity})`;
    overlayEl.dataset.ovOpacity = String(opacity);
  };

  document.getElementById('asset-overlay-toggle').addEventListener('change', e => {
    const on = e.target.checked;
    ab.dataset.overlay = on ? 'true' : 'false';
    document.getElementById('asset-overlay-controls').style.display = on ? '' : 'none';
    // 첫 활성화 시 기본 텍스트 블록 자동 추가
    if (on && !overlayEl.querySelector('.overlay-tb')) {
      const tb = document.createElement('div');
      tb.className = 'text-block overlay-tb';
      tb.dataset.type = 'heading';
      tb.id = 'tb_' + Math.random().toString(36).slice(2, 9);
      tb.innerHTML = `<div class="tb-h2" contenteditable="false" style="font-size:32px;text-align:center"></div>`;
      overlayEl.appendChild(tb);
      tb._blockBound = false;
      window.bindBlock(tb);
      window.buildLayerPanel();
    }
    window.pushHistory();
  });

  const ovOpSlider = document.getElementById('asset-overlay-opacity');
  const ovOpNum    = document.getElementById('asset-overlay-opacity-num');
  ovOpSlider.addEventListener('input', () => {
    const v = parseInt(ovOpSlider.value) / 100;
    ovOpNum.value = ovOpSlider.value;
    applyOverlayBg(v);
  });
  ovOpNum.addEventListener('change', () => {
    const v = Math.min(100, Math.max(0, parseInt(ovOpNum.value) || 0));
    ovOpSlider.value = v;
    applyOverlayBg(v / 100);
  });

  // 오버레이 위치
  document.querySelectorAll('#overlay-position-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlayEl.style.justifyContent = btn.dataset.pos;
      document.querySelectorAll('#overlay-position-group .prop-align-btn').forEach(b => b.classList.toggle('active', b === btn));
      window.pushHistory();
    });
  });

  // 텍스트 추가/제거
  document.getElementById('overlay-add-text-btn').addEventListener('click', () => {
    const tb = document.createElement('div');
    tb.className = 'text-block overlay-tb';
    tb.dataset.type = 'body';
    tb.id = 'tb_' + Math.random().toString(36).slice(2, 9);
    tb.innerHTML = `<div class="tb-body" contenteditable="false" style="text-align:center"></div>`;
    overlayEl.appendChild(tb);
    tb._blockBound = false;
    window.bindBlock(tb);
    window.buildLayerPanel();
    // 추가 후 즉시 선택 & 우측 패널 표시
    window.deselectAll();
    tb.classList.add('selected');
    window.showTextProperties(tb);
    window.pushHistory();
  });
  document.getElementById('overlay-del-text-btn').addEventListener('click', () => {
    const tbs = [...overlayEl.querySelectorAll('.overlay-tb')];
    if (tbs.length > 0) { tbs[tbs.length - 1].remove(); window.buildLayerPanel(); window.pushHistory(); }
  });
}

// Backward compat: classic scripts call these via window.*
window.applyAssetPadX    = applyAssetPadX;
window.showAssetProperties = showAssetProperties;

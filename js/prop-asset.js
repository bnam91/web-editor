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
  const currentH   = parseInt(ab.style.height) || ab.offsetHeight || 780;
  const hasImage   = ab.classList.contains('has-image');
  const currentR   = parseInt(ab.style.borderRadius) || 0;
  const currentAlign = ab.dataset.align || 'center';
  // 너비: inline px → 그대로 / inline % → px 환산 / 없으면 860 (full)
  const rawW = ab.style.width;
  const currentW = rawW
    ? (rawW.endsWith('%') ? Math.round(parseFloat(rawW) * 860 / 100) : parseInt(rawW) || 860)
    : 860;
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
          <span class="prop-block-name">${ab.dataset.layerName || 'Asset Block'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb(ab)}</span>
        </div>
        ${ab.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="navigator.clipboard.writeText('${ab.id}')">${ab.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">프리셋</div>
      <div class="prop-preset-group">
        <button class="prop-preset-btn" data-w="860" data-h="780">Standard</button>
        <button class="prop-preset-btn" data-w="860" data-h="860">Square</button>
        <button class="prop-preset-btn" data-w="860" data-h="1032">Tall</button>
        <button class="prop-preset-btn" data-w="860" data-h="575">Wide</button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">크기</div>
      <div class="prop-row">
        <span class="prop-label">정렬</span>
        <div class="prop-align-group" id="asset-align-group">
          <button class="prop-align-btn${currentAlign==='left'?' active':''}"   data-align="left"   title="왼쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="2" x2="1" y2="12"/><rect x="3" y="4" width="5" height="6" rx="1"/></svg>
          </button>
          <button class="prop-align-btn${currentAlign==='center'?' active':''}" data-align="center" title="가운데 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="7" y1="2" x2="7" y2="12"/><rect x="3" y="4" width="8" height="6" rx="1"/></svg>
          </button>
          <button class="prop-align-btn${currentAlign==='right'?' active':''}"  data-align="right"  title="오른쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="13" y1="2" x2="13" y2="12"/><rect x="6" y="4" width="5" height="6" rx="1"/></svg>
          </button>
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">너비</span>
        <input type="range" class="prop-slider" id="asset-w-slider" min="100" max="860" step="10" value="${currentW}">
        <input type="number" class="prop-number" id="asset-w-number" min="100" max="860" value="${currentW}">
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
        <span class="prop-label">패딩 제외</span>
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
          <div class="prop-align-group" id="overlay-position-group">
            <button class="prop-align-btn${(overlayEl.style.justifyContent||'center')==='flex-start'?' active':''}" data-pos="flex-start" title="상단 정렬">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="2" y1="1" x2="12" y2="1"/><rect x="4" y="3" width="6" height="5" rx="1"/></svg>
            </button>
            <button class="prop-align-btn${(overlayEl.style.justifyContent||'center')==='center'?' active':''}" data-pos="center" title="중앙 정렬">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="2" y1="7" x2="12" y2="7"/><rect x="4" y="3" width="6" height="8" rx="1"/></svg>
            </button>
            <button class="prop-align-btn${(overlayEl.style.justifyContent||'center')==='flex-end'?' active':''}" data-pos="flex-end" title="하단 정렬">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="2" y1="13" x2="12" y2="13"/><rect x="4" y="6" width="6" height="5" rx="1"/></svg>
            </button>
          </div>
        </div>
        <div style="font-size:11px;color:#555;margin-top:2px;">이 블록 선택 후 중앙 패널로 블록 추가</div>
      </div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(ab.id || null);

  const wSlider = document.getElementById('asset-w-slider');
  const wNumber = document.getElementById('asset-w-number');
  const applyW = v => {
    if (v >= 860) {
      ab.style.width = '';
    } else {
      ab.style.width = v + 'px';
      ab.style.alignSelf = ab.dataset.align === 'left' ? 'flex-start'
        : ab.dataset.align === 'right' ? 'flex-end' : 'center';
    }
    wSlider.value = v;
    wNumber.value = v;
  };
  wSlider.addEventListener('input', () => { applyW(parseInt(wSlider.value)); });
  wSlider.addEventListener('change', () => { window.pushHistory?.(); });
  wNumber.addEventListener('change', () => {
    const v = Math.min(860, Math.max(100, parseInt(wNumber.value) || 860));
    applyW(v); window.pushHistory?.();
  });

  const hSlider = document.getElementById('asset-h-slider');
  const hNumber = document.getElementById('asset-h-number');

  document.getElementById('asset-padx-toggle').addEventListener('change', e => {
    ab.dataset.usePadx = e.target.checked ? 'true' : 'false';
    // 이 블록이 속한 section-inner의 padX 값 결정
    const inner = ab.closest('.section-inner');
    const padX = inner
      ? (parseInt(inner.dataset.paddingX) || state.pageSettings.padX || 0)
      : (state.pageSettings.padX || 0);
    if (e.target.checked && padX > 0) {
      ab.style.marginLeft  = -padX + 'px';
      ab.style.marginRight = -padX + 'px';
      ab.style.width = `calc(100% + ${padX * 2}px)`;
    } else {
      ab.style.marginLeft  = '';
      ab.style.marginRight = '';
      ab.style.width = '';
    }
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
    btn.addEventListener('click', () => { window.pushHistory?.(); applyAlign(btn.dataset.align); });
  });

  const rSlider = document.getElementById('asset-r-slider');
  const rNumber = document.getElementById('asset-r-number');
  const applyR = v => { ab.style.borderRadius = v + 'px'; };
  rSlider.addEventListener('input', () => { applyR(parseInt(rSlider.value)); rNumber.value = rSlider.value; });
  rSlider.addEventListener('change', () => { window.pushHistory?.(); });
  rNumber.addEventListener('change', () => { window.pushHistory?.(); });
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

}

// Backward compat: classic scripts call these via window.*
window.applyAssetPadX    = applyAssetPadX;
window.showAssetProperties = showAssetProperties;

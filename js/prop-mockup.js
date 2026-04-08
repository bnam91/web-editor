// prop-mockup.js — 디바이스 목업 블록 프로퍼티 패널

import { propPanel } from './globals.js';

export function showMockupProperties(block) {
  const deviceKey = block.dataset.device || 'iphone';
  const shadow    = block.dataset.shadow || 'none';
  const imgSrc    = block.dataset.imgSrc || '';
  const sourceSec = block.dataset.sourceSec || '';

  const devices = window.MOCKUP_DEVICES || {};
  const deviceLabel = devices[deviceKey]?.label || deviceKey;

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.5">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <rect x="8" y="6" width="8" height="10" rx="0.5" fill="#888" stroke="none"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Mockup'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb?.(block) || ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>

    <!-- 디바이스 선택 -->
    <div class="prop-section">
      <div class="prop-section-title">디바이스</div>
      <div class="prop-row" style="gap:6px;">
        <span class="prop-label" style="flex:1;font-size:10px;color:#888;">${deviceLabel}</span>
        <button class="prop-btn" id="mkp-change-device-btn"
          style="width:auto;height:auto;padding:3px 8px;font-size:10px;">변경</button>
      </div>
    </div>

    <!-- 너비 -->
    <div class="prop-section">
      <div class="prop-section-title">너비</div>
      <div class="prop-row">
        <span class="prop-label">Width</span>
        <input type="range"  class="prop-slider" id="mkp-width-slider" min="100" max="860" step="10"
          value="${parseInt(block.style.width) || parseInt(block.dataset.width) || 360}">
        <input type="number" class="prop-number" id="mkp-width-number" min="100" max="860"
          value="${parseInt(block.style.width) || parseInt(block.dataset.width) || 360}">
      </div>
    </div>

    <!-- 화면 이미지 -->
    <div class="prop-section">
      <div class="prop-section-title">화면 이미지</div>
      <div class="prop-row" style="flex-direction:column;gap:6px;">
        <!-- 섹션 ID로 캡처 -->
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="text" id="mkp-sec-id-input" placeholder="섹션 ID 입력 (sec_xxx)"
            value="${sourceSec}"
            style="flex:1;background:#111;border:1px solid #333;border-radius:4px;color:#ddd;font-size:10px;padding:4px 7px;font-family:Pretendard,-apple-system,sans-serif;min-width:0;">
          <button class="prop-btn" id="mkp-capture-btn"
            style="width:auto;height:auto;padding:3px 8px;font-size:10px;white-space:nowrap;">캡처</button>
        </div>
        ${sourceSec ? `
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:10px;color:#888;flex:1;">연결된 섹션</span>
            <button class="prop-btn" id="mkp-toggle-sec-btn"
              style="width:auto;height:auto;padding:3px 8px;font-size:10px;">
              ${_isSecHidden(sourceSec) ? '섹션 보이기' : '섹션 숨기기'}
            </button>
          </div>
        ` : ''}
        <!-- 직접 이미지 업로드 -->
        <button class="prop-btn-full" id="mkp-upload-btn">이미지 파일 업로드</button>
        ${imgSrc ? `<div style="font-size:10px;color:#888;text-align:center;">이미지 등록됨 ✓</div>` : ''}
      </div>
    </div>

    <!-- 그림자 -->
    <div class="prop-section">
      <div class="prop-section-title">그림자</div>
      <div class="prop-align-group" id="mkp-shadow-group">
        <button class="prop-align-btn${shadow === 'none'  ? ' active' : ''}" data-val="none">없음</button>
        <button class="prop-align-btn${shadow === 'soft'  ? ' active' : ''}" data-val="soft">부드럽게</button>
        <button class="prop-align-btn${shadow === 'strong'? ' active' : ''}" data-val="strong">강하게</button>
      </div>
    </div>
  `;

  // 디바이스 변경
  propPanel.querySelector('#mkp-change-device-btn').addEventListener('click', () => {
    window.openMockupModal?.();
  });

  // 너비
  const wSlider = propPanel.querySelector('#mkp-width-slider');
  const wNumber = propPanel.querySelector('#mkp-width-number');
  const applyWidth = v => {
    v = Math.min(860, Math.max(100, v));
    block.dataset.width = v;
    block.style.width   = v + 'px';
    window.renderMockupBlock?.(block);
    wSlider.value = v;
    wNumber.value = v;
  };
  wSlider.addEventListener('mousedown', () => window.pushHistory?.());
  wSlider.addEventListener('input',  () => applyWidth(parseInt(wSlider.value)));
  wSlider.addEventListener('change', () => window.pushHistory?.());
  wNumber.addEventListener('change', () => { window.pushHistory?.(); applyWidth(parseInt(wNumber.value)); });

  // 캡처 버튼
  const secIdInput = propPanel.querySelector('#mkp-sec-id-input');
  propPanel.querySelector('#mkp-capture-btn').addEventListener('click', async () => {
    const secId = secIdInput.value.trim();
    if (!secId) { window.showToast?.('섹션 ID를 입력하세요.'); return; }
    const sec = document.getElementById(secId);
    if (!sec || !sec.classList.contains('section-block')) { window.showToast?.('해당 ID의 섹션을 찾을 수 없습니다.'); return; }
    await _captureAndApply(block, sec);
  });

  // 섹션 토글
  const toggleBtn = propPanel.querySelector('#mkp-toggle-sec-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const secId = block.dataset.sourceSec;
      if (!secId) return;
      const sec = document.getElementById(secId);
      if (!sec) return;
      const hidden = sec.style.display === 'none';
      sec.style.display = hidden ? '' : 'none';
      sec.dataset.mockupHidden = hidden ? '' : 'true';
      toggleBtn.textContent = hidden ? '섹션 숨기기' : '섹션 보이기';
      window.pushHistory?.();
    });
  }

  // 이미지 업로드
  propPanel.querySelector('#mkp-upload-btn').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const file = inp.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        window.pushHistory?.();
        _applyScreenImage(block, e.target.result);
        block.dataset.imgSrc = e.target.result;
        block.dataset.sourceSec = '';
        window.showMockupProperties?.(block);
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  });

  // 그림자
  propPanel.querySelectorAll('#mkp-shadow-group .prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.pushHistory?.();
      const val = btn.dataset.val;
      block.dataset.shadow = val;
      _applyShadow(block, val);
      propPanel.querySelectorAll('#mkp-shadow-group .prop-align-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.val === val);
      });
    });
  });
}

function _isSecHidden(secId) {
  const sec = document.getElementById(secId);
  return sec && sec.style.display === 'none';
}

async function _captureAndApply(block, sec) {
  if (typeof html2canvas === 'undefined') { window.showToast?.('html2canvas 없음'); return; }
  let clone = null;
  try {
    window.showToast?.('캡처 중...');

    // 클론 후 오프스크린에 배치 (ignoreElements 없이 깔끔하게 찍기)
    clone = sec.cloneNode(true);
    clone.querySelector?.('.section-hitzone')?.remove();
    clone.querySelector?.('.section-toolbar')?.remove();
    clone.classList.remove('selected');
    // 선택 아웃라인 제거
    clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;outline:none;box-shadow:none;';
    document.body.appendChild(clone);

    const bgColor = sec.style.backgroundColor || sec.style.background || '#ffffff';
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: bgColor || '#ffffff',
      logging: false,
    });
    const dataUrl = canvas.toDataURL('image/png');

    window.pushHistory?.();
    block.dataset.imgSrc = dataUrl;
    block.dataset.sourceSec = sec.id;
    _applyScreenImage(block, dataUrl);
    // 섹션 숨기기
    sec.style.display = 'none';
    sec.dataset.mockupHidden = 'true';
    window.showToast?.('캡처 완료! 섹션이 숨겨졌습니다.');
    window.showMockupProperties?.(block);
  } catch(err) {
    window.showToast?.('캡처 실패: ' + err.message);
  } finally {
    clone?.remove();
  }
}

const _CHECKER = [
  'linear-gradient(45deg, #bbb 25%, transparent 25%)',
  'linear-gradient(-45deg, #bbb 25%, transparent 25%)',
  'linear-gradient(45deg, transparent 75%, #bbb 75%)',
  'linear-gradient(-45deg, transparent 75%, #bbb 75%)',
].join(',');

function _applyScreenImage(block, src) {
  const screen = block.querySelector('.mkp-screen');
  if (!screen) return;
  screen.style.backgroundImage    = `url('${src}'),${_CHECKER}`;
  screen.style.backgroundSize     = '100% auto, 12px 12px, 12px 12px, 12px 12px, 12px 12px';
  screen.style.backgroundPosition = 'top center, 0 0, 0 6px, 6px -6px, -6px 0px';
  screen.style.backgroundRepeat   = 'no-repeat, repeat, repeat, repeat, repeat';
  screen.style.backgroundColor    = '#e8e8e8';
  screen.innerHTML = '';
}

function _applyShadow(block, val) {
  const shadows = {
    none:   'none',
    soft:   '0 20px 60px rgba(0,0,0,0.25)',
    strong: '0 30px 80px rgba(0,0,0,0.55)',
  };
  block.style.filter = val === 'none' ? '' : `drop-shadow(${shadows[val]})`;
  block.dataset.shadow = val;
}

// 외부에서 캡처 호출 가능하도록 노출
window._applyMockupScreenImage = _applyScreenImage;
window._applyMockupShadow = _applyShadow;
window.showMockupProperties = showMockupProperties;

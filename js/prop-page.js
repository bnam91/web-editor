/* ═══════════════════════════════════
   PROPERTIES PANEL
═══════════════════════════════════ */
import { propPanel, canvasEl, canvasWrap, state } from './globals.js';

export function showPageProperties() {
  if (window.setRpIdBadge) window.setRpIdBadge(null);
  const { bg, gap, padX, padY } = state.pageSettings;
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path fill="#888" fill-rule="evenodd" d="M5.5 3a.5.5 0 0 1 .5.5V5h4V3.5a.5.5 0 0 1 1 0V5h1.5a.5.5 0 0 1 0 1H11v4h1.5a.5.5 0 0 1 0 1H11v1.5a.5.5 0 0 1-1 0V11H6v1.5a.5.5 0 0 1-1 0V11H3.5a.5.5 0 0 1 0-1H5V6H3.5a.5.5 0 0 1 0-1H5V3.5a.5.5 0 0 1 .5-.5m4.5 7V6H6v4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <span class="prop-block-name">Background</span>
      </div>
      <div class="prop-section-title">배경</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-swatch" style="background:${bg}">
          <input type="color" id="page-bg-color" value="${bg}">
        </div>
        <input type="text" class="prop-color-hex" id="page-bg-hex" value="${bg}" maxlength="7">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">일괄 정렬</div>
      <div class="prop-align-group">
        <button class="prop-align-btn" id="page-align-left">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="page-align-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="page-align-right">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">레이아웃</div>
      <div class="prop-row">
        <span class="prop-label">섹션 간격</span>
        <input type="range" class="prop-slider" id="section-gap-slider" min="0" max="200" step="4" value="${gap}">
        <input type="number" class="prop-number" id="section-gap-number" min="0" max="200" value="${gap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="page-padx-slider" min="0" max="200" step="4" value="${padX}">
        <input type="number" class="prop-number" id="page-padx-number" min="0" max="200" value="${padX}">
      </div>
      <div class="prop-row">
        <span class="prop-label">상하 패딩</span>
        <input type="range" class="prop-slider" id="page-pady-slider" min="0" max="200" step="4" value="${padY}">
        <input type="number" class="prop-number" id="page-pady-number" min="0" max="200" value="${padY}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">내보내기</div>
      <select class="prop-select" id="page-export-format" style="width:100%;margin-bottom:6px;">
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
      </select>
      <button class="prop-export-btn" id="page-export-all-btn">전체 섹션 내보내기</button>
    </div>`;

  const bgPicker = document.getElementById('page-bg-color');
  const bgHex    = document.getElementById('page-bg-hex');
  const bgSwatch = bgPicker.closest('.prop-color-swatch');
  bgPicker.addEventListener('input', () => {
    state.pageSettings.bg = bgPicker.value;
    canvasWrap.style.background = state.pageSettings.bg;
    bgHex.value = state.pageSettings.bg;
    bgSwatch.style.background = state.pageSettings.bg;
  });
  bgHex.addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test(bgHex.value)) {
      state.pageSettings.bg = bgHex.value;
      bgPicker.value = state.pageSettings.bg;
      canvasWrap.style.background = state.pageSettings.bg;
      bgSwatch.style.background = state.pageSettings.bg;
    }
  });

  const gapSlider = document.getElementById('section-gap-slider');
  const gapNumber = document.getElementById('section-gap-number');
  gapSlider.addEventListener('input', () => {
    state.pageSettings.gap = parseInt(gapSlider.value);
    canvasEl.style.gap = state.pageSettings.gap + 'px';
    gapNumber.value = state.pageSettings.gap;
  });
  gapNumber.addEventListener('input', () => {
    const v = Math.min(200, Math.max(0, parseInt(gapNumber.value) || 0));
    state.pageSettings.gap = v;
    canvasEl.style.gap = v + 'px';
    gapSlider.value = v;
  });

  const applyPadX = (v) => {
    state.pageSettings.padX = v;
    canvasEl.style.setProperty('--page-padx', v + 'px');
    // inline style 제거: CSS Variable이 적용되도록 (개별 override된 블록 제외)
    canvasEl.querySelectorAll('.text-block:not(.overlay-tb), .label-group-block').forEach(el => {
      if (!el.dataset.customPadL) el.style.paddingLeft = '';
      if (!el.dataset.customPadR) el.style.paddingRight = '';
    });
    canvasEl.querySelectorAll('.card-block, .graph-block').forEach(el => {
      el.style.paddingLeft = ''; el.style.paddingRight = '';
    });
    // asset-block: 너비% 재계산 방식 유지
    canvasEl.querySelectorAll('.asset-block[data-use-padx="true"]').forEach(ab => {
      window.applyAssetPadX(ab, v);
    });
  };
  const applyPadY = (v) => {
    state.pageSettings.padY = v;
    canvasEl.style.setProperty('--page-pady', v + 'px');
  };
  const padxSlider = document.getElementById('page-padx-slider');
  const padxNumber = document.getElementById('page-padx-number');
  padxSlider.addEventListener('input', () => { applyPadX(parseInt(padxSlider.value)); padxNumber.value = padxSlider.value; });
  padxNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padxNumber.value)||0)); applyPadX(v); padxSlider.value = v; });

  const padySlider = document.getElementById('page-pady-slider');
  const padyNumber = document.getElementById('page-pady-number');
  padySlider.addEventListener('input', () => { applyPadY(parseInt(padySlider.value)); padyNumber.value = padySlider.value; });
  padyNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padyNumber.value)||0)); applyPadY(v); padySlider.value = v; });

  ['left','center','right'].forEach(align => {
    const btn = document.getElementById(`page-align-${align}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.text-block').forEach(tb => {
        if (tb.querySelector('.tb-label')) { tb.style.textAlign = align; }
        else {
          const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
          if (contentEl) contentEl.style.textAlign = align;
        }
      });
      document.querySelectorAll('.label-group-block').forEach(block => {
        block.style.justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
      });
      propPanel.querySelectorAll('#page-align-left,#page-align-center,#page-align-right')
        .forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // 전체 내보내기
  const pageExportBtn = document.getElementById('page-export-all-btn');
  if (pageExportBtn) {
    pageExportBtn.addEventListener('click', async () => {
      const fmt = document.getElementById('page-export-format').value;
      const secCount = canvasEl.querySelectorAll('.section-block').length;
      if (!confirm(`전체 ${secCount}개 섹션을 내보냅니다. 계속할까요?`)) return;
      pageExportBtn.disabled = true;
      pageExportBtn.textContent = '내보내는 중...';
      try {
        await window.exportAllSections(fmt);
      } finally {
        pageExportBtn.disabled = false;
        pageExportBtn.textContent = '전체 섹션 내보내기';
      }
    });
  }
}

// Backward compat: classic scripts call this via window.*
window.showPageProperties = showPageProperties;

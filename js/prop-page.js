/* ═══════════════════════════════════
   PROPERTIES PANEL
═══════════════════════════════════ */
import { propPanel, canvasEl, canvasWrap, state } from './globals.js';

/* ── 헬퍼: section-inner 하나에 padX 적용 ── */
function applyPadXToSection(inner, padX) {
  inner.style.paddingLeft  = padX ? padX + 'px' : '';
  inner.style.paddingRight = padX ? padX + 'px' : '';
  // 각 asset-block의 usePadx 개별 설정에 따라 negative margin 적용
  inner.querySelectorAll('.asset-block').forEach(ab => {
    if (ab.dataset.usePadx === 'true' && padX > 0) {
      ab.style.marginLeft  = -padX + 'px';
      ab.style.marginRight = -padX + 'px';
      ab.style.width = `calc(100% + ${padX * 2}px)`;
    } else {
      ab.style.marginLeft  = '';
      ab.style.marginRight = '';
      ab.style.width = '';
    }
  });
}

/* ── 페이지 전체 padX 일괄 적용 (섹션 개별 override 제외) ── */
function applyPagePadX(padX) {
  document.querySelectorAll('.section-block').forEach(sec => {
    const inner = sec.querySelector('.section-inner');
    if (!inner) return;
    // 섹션 자체 override가 있으면 건너뜀
    if (inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined) return;
    applyPadXToSection(inner, padX);
  });
}

// save-load.js 등 외부에서 호출 가능하도록 export
window.applyPagePadX = applyPagePadX;

export function showPageProperties() {
  if (window.setRpIdBadge) window.setRpIdBadge(null);
  const { bg, gap, padX, padY, padXExcludesAsset } = state.pageSettings;
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
      <div class="prop-row" style="align-items:center;gap:6px;">
        <input type="checkbox" id="page-padx-asset" ${padXExcludesAsset ? 'checked' : ''}>
        <span class="prop-label" style="margin:0;width:auto;overflow:visible;white-space:normal;">에셋블록 패딩 제외합니다.</span>
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

  const padxSlider = document.getElementById('page-padx-slider');
  const padxNumber = document.getElementById('page-padx-number');
  const padxAsset  = document.getElementById('page-padx-asset');

  const applyPadX = (v) => {
    state.pageSettings.padX = v;
    applyPagePadX(v);
  };

  padxSlider.addEventListener('input', () => { applyPadX(parseInt(padxSlider.value)); padxNumber.value = padxSlider.value; });
  padxNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padxNumber.value)||0)); applyPadX(v); padxSlider.value = v; });

  padxAsset.addEventListener('change', e => {
    state.pageSettings.padXExcludesAsset = e.target.checked;
    // 모든 에셋블록 usePadx 일괄 설정
    const val = e.target.checked ? 'true' : 'false';
    document.querySelectorAll('.asset-block').forEach(ab => { ab.dataset.usePadx = val; });
    // override 포함 모든 섹션 적용 (각 섹션의 실제 padX 사용)
    document.querySelectorAll('.section-block').forEach(sec => {
      const inner = sec.querySelector('.section-inner');
      if (!inner) return;
      const hasOverride = inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined;
      const px = hasOverride ? parseInt(inner.dataset.paddingX) : state.pageSettings.padX;
      applyPadXToSection(inner, px || 0);
    });
  });

  const applyPadY = (v) => {
    state.pageSettings.padY = v;
    canvasEl.style.setProperty('--page-pady', v + 'px');
  };
  const padySlider = document.getElementById('page-pady-slider');
  const padyNumber = document.getElementById('page-pady-number');
  padySlider.addEventListener('input', () => { applyPadY(parseInt(padySlider.value)); padyNumber.value = padySlider.value; });
  padyNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padyNumber.value)||0)); applyPadY(v); padySlider.value = v; });

  ['left','center','right'].forEach(align => {
    const btn = document.getElementById(`page-align-${align}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.text-block').forEach(tb => {
        // 서브섹션 내부 블록은 일괄정렬 제외
        if (tb.closest('.sub-section-block')) return;
        if (tb.querySelector('.tb-label')) { tb.style.textAlign = align; }
        else {
          const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
          if (contentEl) contentEl.style.textAlign = align;
        }
      });
      document.querySelectorAll('.label-group-block').forEach(block => {
        // 서브섹션 내부 블록은 일괄정렬 제외
        if (block.closest('.sub-section-block')) return;
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

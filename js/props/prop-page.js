/* ═══════════════════════════════════
   PROPERTIES PANEL
═══════════════════════════════════ */
import { propPanel, canvasEl, canvasWrap, state } from '../globals.js';

/* ── 헬퍼: ab의 effective usePadx 결정 ──
   'true' / 'false' 명시 → 그 값 (개별 오버라이드)
   미설정 → 글로벌 디폴트(pageSettings.padXExcludesAsset)
*/
function getEffectiveUsePadx(ab) {
  if (ab.dataset.usePadx === 'true') return true;
  if (ab.dataset.usePadx === 'false') return false;
  return !!state.pageSettings.padXExcludesAsset;
}
window.getEffectiveUsePadx = getEffectiveUsePadx;

/* ── 헬퍼: ab의 «패딩 제외(full-bleed)» 폭 문자열 ──
   패딩제외 상태면 `calc(100% + 2*padX px)`, 아니면 '' (= inline width 제거).
   ⚠️ 리사이즈/슬라이더/MCP가 최대폭에서 width를 ''로 지우면 calc()가 사라져 «패딩제외가 영구히 풀린다»
   (현빈 08-27 제보: 우측하단 핸들로 줄였다 늘리면 패딩제외 안 먹음). 그 세 곳이 이 헬퍼를 공유한다.
   padX 출처 규약은 applyPadXToSection(아래)·prop-row.applyPadX·block-factory.applyExcludePadX와 동일. */
function assetFullBleedWidth(ab) {
  if (!ab || !getEffectiveUsePadx(ab)) return '';
  // ★프레임 «전체» 안의 에셋은 full-bleed 대상이 아니다.
  //   ⑴free-layout 프레임 = 절대배치라 무의미(applyExcludePadX 가드 미러)
  //   ⑵flow 프레임도 마찬가지 — `.frame-block{overflow:hidden}`(css/editor-blocks.css:10)이라
  //     프레임 밖으로 나가는 폭은 «어떤 계산으로도 안 보이고 잘리기만» 한다. 헬퍼는 프레임이 아니라
  //     «섹션» padX 로 계산하므로 좌우 padX 만큼 클립됐다(2026-08-27 goditor-qa BUG-2, 4b5c812 유래).
  //     도달경로 = banner-block.js:54 가 배너 프리셋 stack-inner 를 fullWidth 프레임으로 만든다.
  if (ab.closest('.frame-block')) return '';
  // preset 고정폭(logo·a4 등)은 그 사이즈를 지켜야 한다 — applyExcludePadX와 같은 가드.
  // ⚠️ ②width 분기의 `preset !== 'logo'` 만으론 a4가 안 걸린다(08-27 태양 지적).
  if (window.ASSET_PRESETS?.[ab.dataset.preset]?.width) return '';
  const row = ab.parentElement;
  let padX;
  // ⚠️ row의 패딩 키가 «두 가지»다: 생성 경로(block-factory.applyRowPaddingX)는 `paddingX`,
  //    패널 슬라이더(prop-row.applyPadX)는 `padX`. 둘 다 읽어야 한다 — 하나만 보면 조용히 글로벌로 샌다.
  const rowPadX = row && row.classList.contains('row')
    ? (row.dataset.padX !== undefined && row.dataset.padX !== '' ? row.dataset.padX
       : (row.dataset.paddingX !== undefined && row.dataset.paddingX !== '' ? row.dataset.paddingX : undefined))
    : undefined;
  if (rowPadX !== undefined) {
    padX = parseInt(rowPadX);                   // row 직속 ab는 row의 패딩이 지배
  } else {
    const inner = ab.closest('.section-inner');
    const hasOverride = inner && inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined;
    padX = inner && hasOverride ? parseInt(inner.dataset.paddingX) : state.pageSettings.padX;
  }
  padX = parseInt(padX) || 0;
  return padX > 0 ? `calc(100% + ${padX * 2}px)` : '';
}
window.assetFullBleedWidth = assetFullBleedWidth;

/* ── 헬퍼: 패딩제외 폭을 «마진과 세트로» 적용 ──
   ⚠️ width 만 쓰면 폭은 커지는데 위치가 안 밀려 «우측 padX 만큼 섹션 밖으로 넘쳐 잘린다»
   (`.section-inner{overflow-x:hidden}`). 정본 3곳(applyPadXToSection·prop-row.applyPadX·
   block-factory.applyExcludePadX)이 전부 width+marginLeft+marginRight 를 «항상 세트로» 쓰는 이유다.
   2026-08-27 회귀: 신설 경로만 width 단독이라, «음수마진이 없는» usePadx 에셋을 최대폭으로 키우면
   실데이터 15개 중 4개가 잘렸다. 호출부가 이 함수를 쓰면 세트 규약을 못 어긴다.
   반환: 적용한 width 문자열(패딩제외 아니면 ''). */
function applyAssetFullBleed(ab) {
  const w = assetFullBleedWidth(ab);
  ab.style.width = w;
  if (w) {
    const m = w.match(/\+\s*(\d+(?:\.\d+)?)px/);
    const padX = m ? parseFloat(m[1]) / 2 : 0;
    if (padX > 0) { ab.style.marginLeft = -padX + 'px'; ab.style.marginRight = -padX + 'px'; }
  }
  // w === '' 이면 마진은 «건드리지 않는다» — usePadx=false 경로가 이미 각자 정리한다(회귀 0).
  return w;
}
window.applyAssetFullBleed = applyAssetFullBleed;

/* ── 헬퍼: section-inner 하나에 padX 적용 ── */
function applyPadXToSection(inner, padX) {
  inner.style.paddingLeft  = padX ? padX + 'px' : '';
  inner.style.paddingRight = padX ? padX + 'px' : '';
  window.syncMergedPartMargins?.(inner.closest('.section-block'), { applyPadding: true });
  // section-inner의 '직접' 자식 ab만 처리 — row 안의 ab는 row 핸들러가 관리
  inner.querySelectorAll(':scope > .asset-block').forEach(ab => {
    if (getEffectiveUsePadx(ab) && padX > 0) {
      ab.style.marginLeft  = -padX + 'px';
      ab.style.marginRight = -padX + 'px';
      ab.style.width = `calc(100% + ${padX * 2}px)`;
    } else {
      ab.style.marginLeft  = '';
      ab.style.marginRight = '';
      // calc()는 full-bleed 모드가 설정한 값 → 제거
      // px 값은 사용자가 직접 지정한 너비 → 보존
      if (!ab.style.width || ab.style.width.includes('calc')) ab.style.width = '';
    }
  });
  // gradient-block은 항상 패딩 제외 (usePadx='true' 고정) — 섹션/row 내부 모두 처리
  inner.querySelectorAll('.gradient-block').forEach(gb => {
    if (padX > 0) {
      gb.style.marginLeft  = -padX + 'px';
      gb.style.marginRight = -padX + 'px';
      gb.style.width = `calc(100% + ${padX * 2}px)`;
    } else {
      gb.style.marginLeft  = '';
      gb.style.marginRight = '';
      if (!gb.style.width || gb.style.width.includes('calc')) gb.style.width = '100%';
    }
  });
  // bridge-block도 항상 full-bleed(섹션 너비 고정) — gradient와 동일 정책 (b3-2)
  inner.querySelectorAll('.bridge-block').forEach(brg => {
    if (padX > 0) {
      brg.style.marginLeft  = -padX + 'px';
      brg.style.marginRight = -padX + 'px';
      brg.style.width = `calc(100% + ${padX * 2}px)`;
    } else {
      brg.style.marginLeft  = '';
      brg.style.marginRight = '';
      if (!brg.style.width || brg.style.width.includes('calc')) brg.style.width = '100%';
    }
  });
  // full-bleed 카드(canvas-block)는 width/margin을 직접 박지 않고 renderCanvas에 위임
  // (renderCanvas가 effective 섹션 padX를 읽어 calc 확장폭/음수마진을 통합 계산).
  inner.querySelectorAll('.canvas-block[data-full-bleed="true"]').forEach(cvb => {
    window.renderCanvas?.(cvb);
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
window.applyPadXToSection = applyPadXToSection;

export function showPageProperties() {
  if (window.setRpIdBadge) window.setRpIdBadge(null);
  const { bg, gap, padX, padY, padXExcludesAsset } = state.pageSettings;
  const bgAlpha = state.pageSettings.bgAlpha ?? 100;
  const bgHexUp = (bg || '#000000').replace('#','').toUpperCase();
  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path fill="#888" fill-rule="evenodd" d="M5.5 3a.5.5 0 0 1 .5.5V5h4V3.5a.5.5 0 0 1 1 0V5h1.5a.5.5 0 0 1 0 1H11v4h1.5a.5.5 0 0 1 0 1H11v1.5a.5.5 0 0 1-1 0V11H6v1.5a.5.5 0 0 1-1 0V11H3.5a.5.5 0 0 1 0-1H5V6H3.5a.5.5 0 0 1 0-1H5V3.5a.5.5 0 0 1 .5-.5m4.5 7V6H6v4z" clip-rule="evenodd"/>
          </svg>
        </div>
        <span class="prop-block-name">Page</span>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Background</div>
      <div class="prop-color-row">
        <span class="prop-label">배경색</span>
        <div class="prop-color-field">
          <div class="prop-color-swatch" style="background:${bg}">
            <input type="color" id="page-bg-color" value="${bg}">
          </div>
          <input type="text" class="prop-color-hex" id="page-bg-hex" value="${bgHexUp}" maxlength="6" aria-label="Color">
          <label class="prop-color-alpha" title="Opacity">
            <input type="text" class="prop-color-alpha-input" id="page-bg-alpha-input" value="${bgAlpha}" aria-label="Opacity">
            <span class="prop-color-alpha-suffix">%</span>
          </label>
        </div>
      </div>
    </div>
    <div class="prop-section" style="opacity:0.4;pointer-events:none;" title="잘못 누르는 사고 방지로 일시 비활성 — 필요 시 prop-page.js에서 복구">
      <div class="prop-section-title">Bulk Align (비활성)</div>
      <div class="prop-align-group">
        <button class="prop-align-btn" id="page-align-left" disabled>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/>
            <line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="page-align-center" disabled>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/>
            <line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/>
          </svg>
        </button>
        <button class="prop-align-btn" id="page-align-right" disabled>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3">
            <line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/>
            <line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Layout</div>
      <div class="prop-row">
        <span class="prop-label">섹션 간격</span>
        <input type="range" class="prop-slider" id="section-gap-slider" min="0" max="200" step="1" value="${gap}">
        <input type="number" class="prop-number" id="section-gap-number" min="0" max="200" value="${gap}">
      </div>
      <div class="prop-row">
        <span class="prop-label">좌우 패딩</span>
        <input type="range" class="prop-slider" id="page-padx-slider" min="0" max="200" step="1" value="${padX}">
        <input type="number" class="prop-number" id="page-padx-number" min="0" max="200" value="${padX}">
      </div>
      <div class="prop-row" style="align-items:center;gap:4px;">
        <input type="checkbox" id="page-padx-asset" ${padXExcludesAsset ? 'checked' : ''}>
        <span class="prop-label" style="margin:0;width:auto;overflow:visible;white-space:normal;">에셋블록은 일괄패딩적용에서 제외합니다.</span>
      </div>
      <div class="prop-row">
        <span class="prop-label">상하 패딩</span>
        <input type="range" class="prop-slider" id="page-pady-slider" min="0" max="200" step="1" value="${padY}">
        <input type="number" class="prop-number" id="page-pady-number" min="0" max="200" value="${padY}">
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Export</div>
      <select class="prop-select" id="page-export-format" style="width:100%;margin-bottom:6px;">
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
        <option value="gif">GIF (정적)</option>
        <option value="gif-anim">GIF (애니메이션)</option>
      </select>
      <select class="prop-select" id="page-export-width" style="width:100%;margin-bottom:6px;">
        <option value="860">860px (기본)</option>
        <option value="780">780px (쿠팡)</option>
      </select>
      <button class="prop-export-btn" id="page-export-all-btn">전체 섹션 내보내기</button>
    </div>`;

  const bgPicker   = document.getElementById('page-bg-color');
  const bgHex      = document.getElementById('page-bg-hex');
  const bgAlphaInp = document.getElementById('page-bg-alpha-input');
  const bgSwatch   = bgPicker.closest('.prop-color-swatch');

  const _bgToRgba = () => {
    const h = (state.pageSettings.bg || '#000000').replace('#','');
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    const a = Math.max(0, Math.min(1, (state.pageSettings.bgAlpha ?? 100) / 100));
    return `rgba(${r},${g},${b},${a})`;
  };
  const _applyBg = () => {
    const rgba = _bgToRgba();
    canvasWrap.style.background = rgba;
    bgSwatch.style.background = rgba;
  };

  bgPicker.addEventListener('input', () => {
    state.pageSettings.bg = bgPicker.value;
    bgHex.value = bgPicker.value.replace('#','').toUpperCase();
    // 솔리드 색 선택 시 그라데이션 해제(잔상 방지) — 솔리드로 복귀
    delete state.pageSettings.bgGradient;
    _applyBg();
  });
  bgPicker.addEventListener('change', () => {
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });
  bgHex.addEventListener('input', () => {
    const v = bgHex.value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(v)) {
      state.pageSettings.bg = '#' + v.toLowerCase();
      bgPicker.value = state.pageSettings.bg;
      _applyBg();
    }
  });
  bgHex.addEventListener('change', () => {
    const v = bgHex.value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(v)) {
      window.pushHistory?.();
      window.scheduleAutoSave?.();
    }
  });
  bgHex.addEventListener('blur', () => {
    bgHex.value = (state.pageSettings.bg || '#000000').replace('#','').toUpperCase();
  });
  bgAlphaInp.addEventListener('input', () => {
    const m = bgAlphaInp.value.match(/(\d+)/);
    if (!m) return;
    const p = Math.max(0, Math.min(100, parseInt(m[1])));
    state.pageSettings.bgAlpha = p;
    _applyBg();
  });
  bgAlphaInp.addEventListener('change', () => {
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });
  bgAlphaInp.addEventListener('blur', () => {
    bgAlphaInp.value = String(state.pageSettings.bgAlpha ?? 100);
  });

  // ── 페이지 배경 그라데이션 수신 (color-picker gradient 탭) ──
  // prop-shape.js 그라데이션 패턴 미러. goya-cp:gradient = 라이브 미리보기(매 프레임),
  // goya-cp:gradient-commit = 사용자 확정(마우스업·select 변경) → pushHistory.
  // NOTE(B6): export-html/export-image는 아직 solid bg만 읽으므로 내보내기엔 그라데이션 미반영(후속).
  const _applyBgGradient = (css) => {
    canvasWrap.style.background = css;
    bgSwatch.style.background = css;
  };
  if (!bgPicker._gradWired) {
    bgPicker._gradWired = true;
    bgPicker.addEventListener('goya-cp:gradient', (e) => {
      if (!e.detail || !e.detail.css) return;
      state.pageSettings.bgGradient = JSON.stringify({
        type: e.detail.type,
        angle: e.detail.angle,
        stops: e.detail.stops,
      });
      _applyBgGradient(e.detail.css);
      if (e.detail.commit) window.pushHistory?.();
      window.scheduleAutoSave?.();
    });
    bgPicker.addEventListener('goya-cp:gradient-commit', () => {
      window.pushHistory?.();
      window.scheduleAutoSave?.();
    });
  }

  const gapSlider = document.getElementById('section-gap-slider');
  const gapNumber = document.getElementById('section-gap-number');
  gapSlider.addEventListener('mousedown', () => window.pushHistory?.());
  gapSlider.addEventListener('input', () => {
    state.pageSettings.gap = parseInt(gapSlider.value);
    canvasEl.style.gap = state.pageSettings.gap + 'px';
    gapNumber.value = state.pageSettings.gap;
  });
  gapSlider.addEventListener('change', () => window.scheduleAutoSave?.());
  gapNumber.addEventListener('input', () => {
    const v = Math.min(200, Math.max(0, parseInt(gapNumber.value) || 0));
    state.pageSettings.gap = v;
    canvasEl.style.gap = v + 'px';
    gapSlider.value = v;
  });
  gapNumber.addEventListener('change', () => {
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });

  const padxSlider = document.getElementById('page-padx-slider');
  const padxNumber = document.getElementById('page-padx-number');
  const padxAsset  = document.getElementById('page-padx-asset');

  const applyPadX = (v) => {
    state.pageSettings.padX = v;
    applyPagePadX(v);
  };

  padxSlider.addEventListener('mousedown', () => window.pushHistory?.());
  padxSlider.addEventListener('input', () => { applyPadX(parseInt(padxSlider.value)); padxNumber.value = padxSlider.value; });
  padxSlider.addEventListener('change', () => window.scheduleAutoSave?.());
  padxNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padxNumber.value)||0)); applyPadX(v); padxSlider.value = v; });
  padxNumber.addEventListener('change', () => {
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });

  padxAsset.addEventListener('change', e => {
    window.pushHistory?.();
    state.pageSettings.padXExcludesAsset = e.target.checked;
    document.querySelectorAll('.section-block').forEach(sec => {
      const inner = sec.querySelector('.section-inner');
      if (!inner) return;
      const hasOverride = inner.dataset.paddingX !== '' && inner.dataset.paddingX !== undefined;
      const px = hasOverride ? parseInt(inner.dataset.paddingX) : state.pageSettings.padX;
      applyPadXToSection(inner, px || 0);
    });
    window.scheduleAutoSave?.();
  });

  const applyPadY = (v) => {
    state.pageSettings.padY = v;
    canvasEl.style.setProperty('--page-pady', v + 'px');
  };
  const padySlider = document.getElementById('page-pady-slider');
  const padyNumber = document.getElementById('page-pady-number');
  padySlider.addEventListener('mousedown', () => window.pushHistory?.());
  padySlider.addEventListener('input', () => { applyPadY(parseInt(padySlider.value)); padyNumber.value = padySlider.value; });
  padySlider.addEventListener('change', () => window.scheduleAutoSave?.());
  padyNumber.addEventListener('input', () => { const v = Math.min(200, Math.max(0, parseInt(padyNumber.value)||0)); applyPadY(v); padySlider.value = v; });
  padyNumber.addEventListener('change', () => {
    window.pushHistory?.();
    window.scheduleAutoSave?.();
  });

  ['left','center','right'].forEach(align => {
    const btn = document.getElementById(`page-align-${align}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      window.pushHistory?.();
      document.querySelectorAll('.text-block').forEach(tb => {
        const parentFrame = tb.closest('.frame-block');
        if (parentFrame && parentFrame.dataset.textFrame !== 'true') return;
        if (tb.querySelector('.tb-label')) { tb.style.textAlign = align; }
        else {
          const contentEl = tb.querySelector('[contenteditable]') || tb.querySelector('div');
          if (contentEl) contentEl.style.textAlign = align;
        }
      });
      document.querySelectorAll('.label-group-block').forEach(block => {
        const parentFrame = block.closest('.frame-block');
        if (parentFrame && parentFrame.dataset.textFrame !== 'true') return;
        block.style.justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
      });
      propPanel.querySelectorAll('#page-align-left,#page-align-center,#page-align-right')
        .forEach(b => b.classList.toggle('active', b === btn));
      window.scheduleAutoSave?.();
    });
  });

  // 전체 내보내기
  const pageExportBtn = document.getElementById('page-export-all-btn');
  if (pageExportBtn) {
    pageExportBtn.addEventListener('click', async () => {
      const fmt = document.getElementById('page-export-format').value;
      const w   = parseInt(document.getElementById('page-export-width').value) || 860;
      const secCount = canvasEl.querySelectorAll('.section-block').length;
      if (!confirm(`전체 ${secCount}개 섹션을 내보냅니다. 계속할까요?`)) return;
      pageExportBtn.disabled = true;
      pageExportBtn.textContent = '내보내는 중...';
      try {
        const res = await window.exportAllSections(fmt, w, (i, total) => {
          pageExportBtn.textContent = `내보내는 중... (${i}/${total})`;
        });
        if (res?.failed?.length) {
          window.showToast?.(`⚠️ ${res.failed.length}/${res.total}개 섹션 내보내기 실패: ${res.failed.join(', ')}`);
        } else {
          window.showToast?.(`✅ ${res?.total ?? secCount}개 섹션 내보내기 완료 — 다운로드 폴더를 확인하세요`);
        }
      } catch (err) {
        console.error('[export] 전체 내보내기 실패:', err);
        window.showToast?.('⚠️ 내보내기 실패: ' + (err?.message || err));
      } finally {
        pageExportBtn.disabled = false;
        pageExportBtn.textContent = '전체 섹션 내보내기';
      }
    });
  }
}

// Backward compat: classic scripts call this via window.*
window.showPageProperties = showPageProperties;

/* ══════════════════════════════════════════════════════
   PREVIEW MODE
══════════════════════════════════════════════════════ */

let _previewScrollHandler  = null;
let _previewEscHandler     = null;
let _previewTopbarToggle   = null;
let _previewSBS            = false;
let _sbsResizeHandler      = null;
let _previewHz             = false;   // ⇆ 가로 — 섹션을 왼→오 한 줄(페이지마다 한 줄 · SBS 와 배타)
let _previewSecJump        = null;

function enterPreview() {
  flushCurrentPage();

  const overlay   = document.getElementById('preview-overlay');
  const content   = document.getElementById('preview-content');
  const navigator = document.getElementById('preview-navigator');

  content.innerHTML   = '';
  navigator.innerHTML = '';

  const rootStyles = getComputedStyle(document.documentElement);
  const presetVars = [
    '--preset-h1-color','--preset-h1-family',
    '--preset-h2-color','--preset-h2-family',
    '--preset-body-color','--preset-body-family',
    '--preset-caption-color',
    '--preset-label-bg','--preset-label-color','--preset-label-radius',
  ].map(v => `${v}:${rootStyles.getPropertyValue(v)}`).join(';');

  const { pages, currentPageId, pageSettings } = window.state;
  pages.forEach((page, idx) => {
    const ps   = page.id === currentPageId ? pageSettings : (page.pageSettings || pageSettings);
    const bg   = ps.bg   || '#969696';
    const gap  = ps.gap  != null ? ps.gap  : 20;
    const padY = ps.padY != null ? ps.padY : 0;

    const block = document.createElement('div');
    block.className = 'preview-page-block';
    block.dataset.pageIdx = idx;
    block.style.paddingTop    = padY + 'px';
    block.style.paddingBottom = padY + 'px';

    const inner = document.createElement('div');
    inner.className = 'preview-page-inner';
    inner.style.gap = gap + 'px';
    inner.setAttribute('style', inner.getAttribute('style') + ';--inv-zoom:1;' + presetVars);

    inner.innerHTML = page.canvas || '';
    // Documents(cert-block) — 미리보기도 출력 규칙(R1): 빈 용지 빼고 다시 배치 · 전부 비면 숨김(편집 화면·저장본 무변)
    inner.querySelectorAll('.cert-block').forEach((b) => window.renderCertBlock?.(b, { forOutput: true, showSamples: true }));

    block.appendChild(inner);
    content.appendChild(block);

    const label  = page.label || page.name || ('Page ' + (idx + 1));
    const navBtn = document.createElement('button');
    navBtn.className       = 'preview-nav-btn' + (idx === 0 ? ' active' : '');
    navBtn.dataset.pageIdx = idx;
    navBtn.textContent     = label;
    navBtn.addEventListener('click', () => {
      block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    navigator.appendChild(navBtn);
  });

  document.body.classList.add('preview-mode');
  overlay.scrollTop = 0;

  const designBtn  = document.getElementById('mode-design-btn');
  const previewBtn = document.getElementById('mode-preview-btn');
  if (designBtn)  designBtn.classList.remove('active');
  if (previewBtn) previewBtn.classList.add('active');

  _previewScrollHandler = () => _updatePreviewNav(overlay);
  overlay.addEventListener('scroll', _previewScrollHandler);

  _previewEscHandler = e => { if (e.key === 'Escape') exitPreview(); };
  document.addEventListener('keydown', _previewEscHandler);

  // 탑바 토글: overlay 클릭 시 표시/숨김 (탑바 내부 클릭은 무시)
  const topbar = document.getElementById('preview-topbar');
  topbar.classList.remove('visible');
  _previewTopbarToggle = e => {
    if (topbar.contains(e.target)) return;
    topbar.classList.toggle('visible');
  };
  overlay.addEventListener('click', _previewTopbarToggle);

  /* ⇆ 가로 보기에서 섹션을 누르면 편집으로 돌아가 그 섹션으로(가로 보기 때만 · 세로 보기 클릭은 종전대로 탑바 토글) */
  _previewSecJump = e => {
    if (!_previewHz) return;
    const sec = e.target.closest?.('#preview-content .section-block');
    if (!sec) return;
    const page = window.state.pages[+sec.closest('.preview-page-block')?.dataset.pageIdx];
    const id = sec.id;
    exitPreview();
    _jumpToCanvasSection(page, id);
  };
  overlay.addEventListener('click', _previewSecJump, true);
}

/* 미리보기 섹션 id = page.canvas 문자열의 그 id(편집 캔버스와 같은 id) — exitPreview 가 미리보기를 비운 뒤라 getElementById 는 캔버스 것 하나다. */
async function _jumpToCanvasSection(page, id) {
  if (page && page.id !== window.state.currentPageId) await window.switchPage?.(page.id);
  const el = id && document.getElementById(id);
  if (!el?.classList.contains('section-block')) return;
  window.selectSection?.(el);
  el.scrollIntoView({ block: 'start' });
}

function exitPreview() {
  document.body.classList.remove('preview-mode');

  const designBtn  = document.getElementById('mode-design-btn');
  const previewBtn = document.getElementById('mode-preview-btn');
  if (designBtn)  designBtn.classList.add('active');
  if (previewBtn) previewBtn.classList.remove('active');

  const overlay = document.getElementById('preview-overlay');
  if (_previewScrollHandler) {
    overlay.removeEventListener('scroll', _previewScrollHandler);
    _previewScrollHandler = null;
  }
  if (_previewEscHandler) {
    document.removeEventListener('keydown', _previewEscHandler);
    _previewEscHandler = null;
  }
  if (_previewTopbarToggle) {
    overlay.removeEventListener('click', _previewTopbarToggle);
    _previewTopbarToggle = null;
  }
  document.getElementById('preview-topbar').classList.remove('visible');

  if (_previewSecJump) {
    overlay.removeEventListener('click', _previewSecJump, true);
    _previewSecJump = null;
  }
  if (_previewHz) togglePreviewHorizontal(false);   // ⇆ 가로 정리(단추·class)

  // SBS 정리
  if (_previewSBS) {
    _previewSBS = false;
    if (_sbsResizeHandler) {
      window.removeEventListener('resize', _sbsResizeHandler);
      _sbsResizeHandler = null;
    }
    const sbsCont = document.getElementById('preview-sbs-container');
    if (sbsCont) sbsCont.style.display = 'none';
    const sbsBtn = document.getElementById('preview-sbs-btn');
    if (sbsBtn) sbsBtn.classList.remove('active');
    document.getElementById('preview-content').style.display = '';
  }

  document.getElementById('preview-content').innerHTML   = '';
  document.getElementById('preview-navigator').innerHTML = '';

  // zoom 리셋
  _previewZoom = 100;
  const content = document.getElementById('preview-content');
  if (content) { content.style.transform = ''; content.style.transformOrigin = ''; }
  const zd = document.getElementById('preview-zoom-display');
  if (zd) zd.textContent = '100%';
}

/* ── Side by Side ── */
function togglePreviewSideBySide() {
  if (!_previewSBS && _previewHz) togglePreviewHorizontal(false);   // ⇆ 가로와 배타
  _previewSBS = !_previewSBS;
  const btn      = document.getElementById('preview-sbs-btn');
  const content  = document.getElementById('preview-content');
  const sbsCont  = document.getElementById('preview-sbs-container');
  const navigator = document.getElementById('preview-navigator');
  const zoomCtrl = document.getElementById('preview-zoom-ctrl');

  if (_previewSBS) {
    btn.classList.add('active');
    content.style.display   = 'none';
    sbsCont.style.display   = 'flex';
    navigator.style.display = 'none';
    _initSBS();
    _sbsResizeHandler = () => _sbsUpdateScale();
    window.addEventListener('resize', _sbsResizeHandler);
  } else {
    btn.classList.remove('active');
    content.style.display   = '';
    sbsCont.style.display   = 'none';
    navigator.style.display = '';
    if (zoomCtrl) zoomCtrl.style.visibility = '';
    if (_sbsResizeHandler) {
      window.removeEventListener('resize', _sbsResizeHandler);
      _sbsResizeHandler = null;
    }
  }
}

/* ── ⇆ 가로 ── */
/* 섹션 그릇 하나를 «가로 한 줄»로 켜고 끈다 — 배치는 CSS(.section-row-layout · editor-extra.css) · 섹션 폭은 그릇의 원래 폭(--row-sec-w)으로 고정.
   ★미리보기 DOM 을 모른다(그릇만 받는다) — 나중에 편집 캔버스 가로 편집(현빈 ⓐ)에서 같은 함수를 부를 수 있게. */
export function setSectionRowLayout(container, on) {
  if (!container) return;
  if (on) {
    if (!container.classList.contains('section-row-layout')) container.style.setProperty('--row-sec-w', container.offsetWidth + 'px');
    container.classList.add('section-row-layout');
  } else {
    container.classList.remove('section-row-layout');
    container.style.removeProperty('--row-sec-w');
  }
}

function togglePreviewHorizontal(force) {
  const on = typeof force === 'boolean' ? force : !_previewHz;
  if (on && _previewSBS) togglePreviewSideBySide();   // Side by Side 와 배타
  _previewHz = on;
  document.getElementById('preview-hz-btn')?.classList.toggle('active', on);
  document.querySelectorAll('#preview-content .preview-page-inner').forEach(el => setSectionRowLayout(el, on));
}

function _sbsGetScale() {
  const panelW = Math.floor(window.innerWidth / 2) - 1;
  return Math.min(1, panelW / 860);
}

function _sbsUpdateScale() {
  const scale = _sbsGetScale() * (_previewZoom / 100);
  document.querySelectorAll('.sbs-scale-wrap').forEach(el => {
    el.style.zoom = scale;
  });
}

function _initSBS() {
  const rootStyles = getComputedStyle(document.documentElement);
  const presetVars = [
    '--preset-h1-color','--preset-h1-family',
    '--preset-h2-color','--preset-h2-family',
    '--preset-body-color','--preset-body-family',
    '--preset-caption-color',
    '--preset-label-bg','--preset-label-color','--preset-label-radius',
  ].map(v => `${v}:${rootStyles.getPropertyValue(v)}`).join(';');

  ['left', 'right'].forEach((side, si) => {
    const sel = document.getElementById(`sbs-select-${side}`);
    sel.innerHTML = '';
    const { pages: sbsPages } = window.state;
    sbsPages.forEach((page, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = page.label || page.name || `Page ${idx + 1}`;
      sel.appendChild(opt);
    });
    // 기본값: 좌=0, 우=1(없으면 0)
    sel.value = si === 0 ? 0 : Math.min(1, sbsPages.length - 1);
    sel.addEventListener('change', () => _renderSBSPanel(side, parseInt(sel.value), presetVars));
    _renderSBSPanel(side, parseInt(sel.value), presetVars);
  });
}

function _renderSBSPanel(side, pageIdx, presetVars) {
  const bodyEl = document.getElementById(`sbs-body-${side}`);
  bodyEl.innerHTML = '';

  const { pages, currentPageId, pageSettings } = window.state;
  const page = pages[pageIdx];
  if (!page) return;

  const ps   = page.id === currentPageId ? pageSettings : (page.pageSettings || pageSettings);
  const gap  = ps.gap  != null ? ps.gap  : 20;
  const padY = ps.padY != null ? ps.padY : 0;

  // presetVars가 없으면(직접 호출 시) 재계산
  if (!presetVars) {
    const rootStyles = getComputedStyle(document.documentElement);
    presetVars = [
      '--preset-h1-color','--preset-h1-family',
      '--preset-h2-color','--preset-h2-family',
      '--preset-body-color','--preset-body-family',
      '--preset-caption-color',
      '--preset-label-bg','--preset-label-color','--preset-label-radius',
    ].map(v => `${v}:${rootStyles.getPropertyValue(v)}`).join(';');
  }

  const wrap = document.createElement('div');
  wrap.className = 'sbs-scale-wrap';
  wrap.style.zoom = _sbsGetScale();

  const block = document.createElement('div');
  block.className = 'preview-page-block';
  block.style.paddingTop    = padY + 'px';
  block.style.paddingBottom = padY + 'px';

  const inner = document.createElement('div');
  inner.className = 'preview-page-inner';
  inner.style.gap = gap + 'px';
  inner.setAttribute('style', (inner.getAttribute('style') || '') + ';--inv-zoom:1;' + presetVars);
  inner.innerHTML = page.canvas || '';
  inner.querySelectorAll('.cert-block').forEach((b) => window.renderCertBlock?.(b, { forOutput: true, showSamples: true }));   // Documents 출력 규칙(R1) — 나란히 보기도 같게

  block.appendChild(inner);
  wrap.appendChild(block);
  bodyEl.appendChild(wrap);
}

/* ── Preview Zoom ── */
let _previewZoom = 100;
function previewZoomStep(delta) {
  _previewZoom = Math.min(200, Math.max(50, _previewZoom + delta));
  if (_previewSBS) {
    _sbsUpdateScale();
  } else {
    const content = document.getElementById('preview-content');
    if (content) {
      content.style.transform       = `scale(${_previewZoom / 100})`;
      content.style.transformOrigin = 'top center';
    }
  }
  const zd = document.getElementById('preview-zoom-display');
  if (zd) zd.textContent = _previewZoom + '%';
}

function _updatePreviewNav(overlay) {
  const blocks    = [...overlay.querySelectorAll('.preview-page-block')];
  const scrollMid = overlay.scrollTop + overlay.clientHeight * 0.4;

  let activeIdx = 0;
  blocks.forEach((block, idx) => {
    if (block.offsetTop <= scrollMid) activeIdx = idx;
  });

  document.querySelectorAll('.preview-nav-btn').forEach((btn, idx) => {
    btn.classList.toggle('active', idx === activeIdx);
  });
}

window.enterPreview             = enterPreview;
window.exitPreview              = exitPreview;
window.togglePreviewSideBySide  = togglePreviewSideBySide;
window.togglePreviewHorizontal  = togglePreviewHorizontal;
window.setSectionRowLayout      = setSectionRowLayout;
window.previewZoomStep          = previewZoomStep;

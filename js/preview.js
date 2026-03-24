/* ══════════════════════════════════════════════════════
   PREVIEW MODE
══════════════════════════════════════════════════════ */

let _previewScrollHandler  = null;
let _previewEscHandler     = null;
let _previewTopbarToggle   = null;

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

  document.getElementById('preview-content').innerHTML   = '';
  document.getElementById('preview-navigator').innerHTML = '';

  // zoom 리셋
  _previewZoom = 100;
  const content = document.getElementById('preview-content');
  if (content) { content.style.transform = ''; content.style.transformOrigin = ''; }
  const zd = document.getElementById('preview-zoom-display');
  if (zd) zd.textContent = '100%';
}

/* ── Preview Zoom ── */
let _previewZoom = 100;
function previewZoomStep(delta) {
  _previewZoom = Math.min(200, Math.max(50, _previewZoom + delta));
  const content = document.getElementById('preview-content');
  if (content) {
    content.style.transform       = `scale(${_previewZoom / 100})`;
    content.style.transformOrigin = 'top center';
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
window.previewZoomStep          = previewZoomStep;

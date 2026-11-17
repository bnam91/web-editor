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
let _hzPan                 = null;    // ⇆ 가로 스페이스+드래그 팬 처리기 묶음(켤 때 걸고 끌 때·나갈 때 뗀다)
let _hzDown                = null;
let _tbHover               = null;    // r5 위쪽 띠 hover 로 탑바 보이기 — { mm, timer, byHover }
const TOPBAR_HIDE_MS       = 700;
let _pvWheel               = null;    // r5 핀치 줌 — { fn, acc, timer, anchor }     // 띠·바를 벗어난 뒤 숨기기까지(잠깐 뒤 · 지나가다 스친 것에 깜빡이지 않게)    // 마지막 mousedown 자리 — 끈 뒤 click 이 섹션 점프로 새지 않게

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
  _previewZoom = PREVIEW_ZOOM_DEFAULT;   // r5 — 들어갈 때 기본 50%(세로 = 통째 scale(0.5) · 표시 «50%»)
  _applyPreviewZoom();

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
    if (_tbHover) { _tbHover.byHover = false; clearTimeout(_tbHover.timer); _tbHover.timer = null; }   // 클릭으로 정한 상태는 hover 가 안 걷는다
  };
  overlay.addEventListener('click', _previewTopbarToggle);

  /* r5 — 화면 위쪽 끝(탑바 높이 띠)에 마우스를 올리면 탑바가 나타나고(기존 .visible 전환 0.2s), 띠·바를 벗어나면 잠깐 뒤 숨는다.
     hover 로 연 것만 hover 가 닫는다 · 바 위에 있는 동안은 안 닫힌다 · 클릭 토글은 그대로 · 가로·세로·SBS 모두(탑바는 하나). */
  _tbHover = { timer: null, byHover: false, mm: null };
  _tbHover.mm = e => {
    const h = _tbHover, band = topbar.offsetHeight || 48;
    if (e.clientY <= band || topbar.contains(e.target)) {
      clearTimeout(h.timer); h.timer = null;
      if (!topbar.classList.contains('visible')) { topbar.classList.add('visible'); h.byHover = true; }
    } else if (h.byHover && !h.timer) {
      h.timer = setTimeout(() => { h.timer = null; if (h.byHover) { topbar.classList.remove('visible'); h.byHover = false; } }, TOPBAR_HIDE_MS);
    }
  };
  document.addEventListener('mousemove', _tbHover.mm);

  /* r5 트랙패드 핀치(ctrlKey + wheel) = 미리보기 줌 — 편집 캔버스 핀치(editor.js initTrackpadGestures)와 같은 셈(window.wheelZoomAccumulate/Notches · ×ZOOM_RATIO_PER_NOTCH · 16ms 스로틀).
     ctrlKey 없는 wheel(두 손가락 스크롤)은 손대지 않는다(종전 스크롤). 가로·세로·SBS 모두 — 가로는 손가락 아래 지점을 고정. */
  _pvWheel = { acc: { notches: 0, pinch: 0 }, timer: null, anchor: null, fn: null };
  _pvWheel.fn = e => {
    if (!e.ctrlKey || !window.wheelZoomAccumulate) return;
    e.preventDefault();
    const w = _pvWheel;
    window.wheelZoomAccumulate(w.acc, e.deltaY);
    w.anchor = { x: e.clientX, y: e.clientY };
    if (w.timer) return;
    w.timer = setTimeout(() => {
      const n = window.wheelZoomNotches(w.acc);
      w.acc.notches = 0; w.acc.pinch = 0; w.timer = null;
      if (n !== 0) _previewZoomTo(_previewZoom * Math.pow(window.ZOOM_RATIO_PER_NOTCH || 1.2, n), w.anchor);
    }, 16);
  };
  overlay.addEventListener('wheel', _pvWheel.fn, { passive: false });

  /* ⇆ 가로 보기에서 섹션을 누르면 편집으로 돌아가 그 섹션으로(가로 보기 때만 · 세로 보기 클릭은 종전대로 탑바 토글) */
  _previewSecJump = e => {
    if (!_previewHz) return;
    const sec = e.target.closest?.('#preview-content .section-block');
    if (!sec) return;
    if (_hzDown && (_hzDown.panned || Math.hypot(e.clientX - _hzDown.x, e.clientY - _hzDown.y) > 5)) return;   // 끌기(팬·그냥 끌기) 끝의 click 은 점프 아님
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
  if (_tbHover) { document.removeEventListener('mousemove', _tbHover.mm); clearTimeout(_tbHover.timer); _tbHover = null; }
  if (_pvWheel) { overlay.removeEventListener('wheel', _pvWheel.fn, { passive: false }); clearTimeout(_pvWheel.timer); _pvWheel = null; }
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
  _previewZoom = PREVIEW_ZOOM_DEFAULT;
  const content = document.getElementById('preview-content');
  if (content) { content.style.transform = ''; content.style.transformOrigin = ''; }
  const zd = document.getElementById('preview-zoom-display');
  if (zd) zd.textContent = PREVIEW_ZOOM_DEFAULT + '%';
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
  if (!on && _previewZoom < PREVIEW_ZOOM_MIN) _previewZoom = PREVIEW_ZOOM_MIN;   // 세로로 돌아가면 세로 하한으로
  if (!on) {
    document.querySelectorAll('#preview-content .preview-page-inner').forEach(el => { el.style.paddingLeft = el.style.paddingRight = ''; });
    const content = document.getElementById('preview-content'), overlay = document.getElementById('preview-overlay');
    const padTop = parseFloat(content?.style.paddingTop) || 0;
    if (content) content.style.paddingTop = content.style.paddingBottom = '';
    if (overlay && padTop) overlay.scrollTop = Math.max(0, overlay.scrollTop - padTop);   // 걷은 위 여유만큼 되돌려 보던 자리 유지
    if (overlay) overlay.scrollLeft = 0;   // 세로엔 가로 스크롤 없음(overflow-x hidden 복귀)
  }
  _bindHzPan(on);
  _applyPreviewZoom();   // 줌을 옮겨 건다(가로 = 줄 zoom · 세로 = 통째 transform) + 앞뒤 여유
  /* r5 — 가로·세로 스크롤은 #preview-overlay 하나가 맡는다(가로 스크롤바가 창 맨 아래 · 페이지 줄이 함께 움직임). 켤 때 = 가로 스크롤 0 = 첫 섹션이 창 가운데(앞 여유가 그만큼). */
  document.getElementById('preview-overlay').scrollLeft = 0;
  if (on) {   // r4 — 켤 때 세로 = 위 여유만큼 내려온 자리(첫 화면은 r3 와 같이 섹션 윗부분부터 · 빈 화면 아님) · 위 여유는 위로 끌어야 보인다
    const overlay = document.getElementById('preview-overlay');
    overlay.scrollTop = parseFloat(document.getElementById('preview-content').style.paddingTop) || 0;
  }
}

/* ⇆ 가로 앞뒤 여유(현빈 r3 «첫 섹션을 화면 가운데로 · 끝 섹션도») — 줄 앞뒤에 «그릇 폭 반 − 섹션 반 폭»을 둔다.
   줄은 CSS zoom 안이라 그 단위로 적는다(화면 px ÷ z) · 줌·창 크기 바뀔 때마다 다시. 그릇 = .preview-page-block(가로 스크롤 영역). */
function _hzEdgeRoom() {
  if (!_previewHz) return;
  const z = _previewZoom / 100;
  /* r4 위·아래 여유(현빈 «위아래도 빈 공간») — 세로 스크롤은 #preview-overlay 몫이라 #preview-content 위·아래 padding = 창 높이 반.
     ⛔줄(.preview-page-inner)마다 두지 않는다 — 페이지가 여럿이면 페이지 사이가 창 높이만큼 벌어진다. 가로에선 #preview-content 에 transform 이 없어 화면 px 그대로(줌 무관). */
  const content = document.getElementById('preview-content'), overlay = document.getElementById('preview-overlay');
  if (content && overlay) content.style.paddingTop = content.style.paddingBottom = Math.round(overlay.clientHeight / 2) + 'px';
  document.querySelectorAll('#preview-content .preview-page-block').forEach(b => {
    const inner = b.querySelector(':scope > .preview-page-inner');
    if (!inner) return;
    const secW = parseFloat(inner.style.getPropertyValue('--row-sec-w')) || 860;
    const pad = Math.max(0, b.clientWidth / 2 / z - secW / 2);
    inner.style.paddingLeft = inner.style.paddingRight = pad + 'px';
  });
}

/* ⇆ 가로 스페이스+드래그 팬 — 편집 캔버스 팬(editor.js «CANVAS PAN»)과 같은 손맛: 스페이스 = 손바닥 · 누른 채 끌면 «절대 델타»로 스크롤(콘텐츠가 손끝을 따라감).
   가로·세로 = #preview-overlay scrollLeft/scrollTop(r5 스크롤러 하나 · 페이지 줄이 함께).
   ★스페이스는 window 캡처에서 먹는다 — 편집 캔버스 팬(document keydown)·오버레이 기본 스크롤로 안 샌다. 가로가 아닐 땐 손대지 않는다. */
function _bindHzPan(on) {
  const overlay = document.getElementById('preview-overlay');
  if (_hzPan) {
    window.removeEventListener('keydown', _hzPan.kd, true);
    window.removeEventListener('keyup', _hzPan.ku, true);
    overlay.removeEventListener('mousedown', _hzPan.md, true);
    window.removeEventListener('mousemove', _hzPan.mm);
    window.removeEventListener('mouseup', _hzPan.mu);
    window.removeEventListener('resize', _hzPan.rs);
    overlay.classList.remove('pv-pan-mode', 'pv-panning');
    _hzPan = null;
  }
  if (!on) return;
  const typing = () => { const a = document.activeElement; return a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
  const st = { held: false, drag: null };
  const end = () => { st.drag = null; overlay.classList.remove('pv-panning'); };
  _hzPan = {
    kd: e => { if (e.code !== 'Space' || typing()) return; e.preventDefault(); e.stopImmediatePropagation(); st.held = true; overlay.classList.add('pv-pan-mode'); },
    ku: e => { if (e.code !== 'Space') return; e.preventDefault(); e.stopImmediatePropagation(); st.held = false; overlay.classList.remove('pv-pan-mode'); end(); },
    md: e => {
      _hzDown = { x: e.clientX, y: e.clientY, panned: false };
      if (!st.held || e.button !== 0) return;
      st.drag = { x: e.clientX, y: e.clientY, left: overlay.scrollLeft, top: overlay.scrollTop };   // r5 — 스크롤러 하나(#preview-overlay)
      _hzDown.panned = true;
      overlay.classList.add('pv-panning');
      e.preventDefault(); e.stopPropagation();
    },
    mm: e => {
      const d = st.drag;
      if (!d) return;
      overlay.scrollLeft = d.left - (e.clientX - d.x);
      overlay.scrollTop = d.top - (e.clientY - d.y);
    },
    mu: end,
    rs: () => _hzEdgeRoom(),
  };
  window.addEventListener('keydown', _hzPan.kd, true);
  window.addEventListener('keyup', _hzPan.ku, true);
  overlay.addEventListener('mousedown', _hzPan.md, true);
  window.addEventListener('mousemove', _hzPan.mm);
  window.addEventListener('mouseup', _hzPan.mu);
  window.addEventListener('resize', _hzPan.rs);
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
/* r5 기본 배율(현빈 261117 «프리뷰 기본 배율도 100% 말고 50%로») — 들어갈 때·나갈 때 리셋 모두 이것. 세로 하한(50)과 같아 세로·가로 모두 유효. */
const PREVIEW_ZOOM_DEFAULT = 50;
let _previewZoom = PREVIEW_ZOOM_DEFAULT;
/* 줌 하한 — 세로 미리보기는 옛 50 그대로(현빈 미문의) · ⇆ 가로는 긴 줄을 한눈에 보게 10 까지(현빈 261117 «50% 보다 더 낮출 수 없나») */
const PREVIEW_ZOOM_MIN = 50, PREVIEW_ZOOM_MIN_HZ = 10;
function previewZoomStep(delta) {
  _previewZoom = Math.min(200, Math.max(_previewHz ? PREVIEW_ZOOM_MIN_HZ : PREVIEW_ZOOM_MIN, _previewZoom + delta));
  _applyPreviewZoom();
}
/* 줌을 «값»으로(핀치) — 하한(가로 10 · 세로 50)·상한 200 · 정수 %.
   ⇆ 가로 + anchor(화면 좌표)면 그 지점 아래 «줄 안 자리»를 줌 전후 같은 화면 자리에 둔다(편집 캔버스 핀치와 같은 느낌).
   줄은 CSS zoom 이라 «줄 단위» 자리 = (화면 − 줄 왼끝 − 앞 여유×z) ÷ z · 줌·여유를 다시 건 뒤 재서 scrollLeft/scrollTop 을 그만큼 민다. */
function _previewZoomTo(target, anchor) {
  const next = Math.round(Math.min(200, Math.max(_previewHz ? PREVIEW_ZOOM_MIN_HZ : PREVIEW_ZOOM_MIN, target)));
  if (next === _previewZoom) return;
  const z0 = _previewZoom / 100, overlay = document.getElementById('preview-overlay');
  let pin = null;
  if (_previewHz && anchor) {
    const b = document.elementFromPoint(anchor.x, anchor.y)?.closest?.('.preview-page-block') || document.querySelector('#preview-content .preview-page-block');
    const inner = b?.querySelector(':scope > .preview-page-inner');
    if (inner) {
      const r = inner.getBoundingClientRect(), padL = (parseFloat(inner.style.paddingLeft) || 0) * z0;
      pin = { inner, ux: (anchor.x - r.left - padL) / z0, vy: (anchor.y - r.top) / z0 };
    }
  }
  _previewZoom = next;
  _applyPreviewZoom();
  if (pin) {
    const z1 = _previewZoom / 100, r = pin.inner.getBoundingClientRect(), padL = (parseFloat(pin.inner.style.paddingLeft) || 0) * z1;
    overlay.scrollLeft += (r.left + padL + pin.ux * z1) - anchor.x;   // r5 — 스크롤러 하나
    overlay.scrollTop += (r.top + pin.vy * z1) - anchor.y;
  }
}

/* 줌을 지금 배치에 맞게 건다.
   · SBS = 패널 zoom(종전) · 세로 = #preview-content 통째 transform(종전 · top center)
   · ⇆ 가로 = #preview-content 는 안 줄이고(그릇이 창 폭 전부 = 가로 스크롤 영역) «섹션 줄»(.preview-page-inner)에만 CSS zoom
     — zoom 은 레이아웃 크기를 바꾸므로 줄 왼끝 = 스크롤 0 · scrollWidth = 줄 실제 폭(transform 가운데 기준이면 줄이 왼쪽 음수로 넘치고 그릇이 창의 z 배로 갇혔다). */
function _applyPreviewZoom() {
  const z = _previewZoom / 100;
  const content = document.getElementById('preview-content');
  if (_previewSBS) {
    _sbsUpdateScale();
  } else if (content) {
    content.style.transform       = _previewHz ? '' : `scale(${z})`;
    content.style.transformOrigin = _previewHz ? '' : 'top center';
    content.querySelectorAll('.preview-page-inner').forEach(el => { el.style.zoom = _previewHz ? String(z) : ''; });
    _hzEdgeRoom();
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

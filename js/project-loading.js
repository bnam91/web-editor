// 무거운 프로젝트 로딩 인디케이터 (batch-4) — 캔버스 위 반투명 오버레이 + 스피너 + "불러오는 중…".
// 토스트/모달 공용 비주얼 언어(--ui-* 토큰, asset-spin keyframes) 재사용. 경량 프로젝트엔 호출부에서 표시 안 함.
let _overlayEl = null;

function _ensureOverlay() {
  if (_overlayEl && _overlayEl.isConnected) return _overlayEl;
  const host = document.getElementById('canvas-area') || document.body;
  const ov = document.createElement('div');
  ov.className = 'proj-loading-overlay';
  ov.id = 'proj-loading-overlay';
  ov.setAttribute('role', 'status');
  ov.setAttribute('aria-live', 'polite');
  ov.innerHTML = `<div class="proj-loading-box"><div class="proj-loading-spinner"></div><span class="proj-loading-text">불러오는 중…</span></div>`;
  host.appendChild(ov);
  _overlayEl = ov;
  return ov;
}

function showProjectLoadingOverlay() {
  const ov = _ensureOverlay();
  ov.classList.remove('hiding');   // 즉시 표시(페이드인 없음) — 동기 렌더 직전 1프레임에 확실히 페인트되게
}

function hideProjectLoadingOverlay() {
  const ov = _overlayEl;
  if (!ov) return;
  ov.classList.add('hiding');      // 페이드아웃(CSS transition)
  setTimeout(() => { if (ov && ov.classList.contains('hiding')) { ov.remove(); if (_overlayEl === ov) _overlayEl = null; } }, 240);
}

window.showProjectLoadingOverlay = showProjectLoadingOverlay;
window.hideProjectLoadingOverlay = hideProjectLoadingOverlay;

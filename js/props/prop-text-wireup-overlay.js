/* prop-text-wireup-overlay.js
 * 텍스트블록 "오버레이(플로팅)" 토글 — Figma의 오버레이 버튼과 같은 개념.
 * 오토레이아웃(row/text-frame) 흐름에 속한 블록을 흐름에서 빼서 섹션 위에
 * position:absolute 로 띄운다. 다시 누르면 원래 있던 부모 · 순서로 복귀한다.
 *
 * ★기존 자산 재사용:
 *   - 절대배치 판정/이동/드래그는 freeLayout(B모드)이 이미 쓰는 것과 같은 방식
 *     (position:absolute + left/top + dataset.offsetX/Y) — js/block-drag.js 가
 *     `style.position === 'absolute'` 만 보고 커스텀 드래그로 전환하므로 별도 배선 불필요.
 *   - 선택 아웃라인 보라는 새 CSS가 아니라 js/selection-overlay.js 의 선언형 경로
 *     (`host.dataset.selVariant` → 'sticker' 변형 stroke = --ui-sel-overlay) 그대로 탄다.
 *     확대블럭(zoom-block.js)이 이미 쓰는 같은 길.
 */

function _zoom() {
  return (window.currentZoom || 40) / 100;
}

function _posElOf(tb) {
  return tb.closest('.frame-block[data-text-frame="true"]') || tb;
}

function _ensureId(el) {
  if (!el.id) {
    el.id = (typeof window.genId === 'function')
      ? window.genId('anchor')
      : ('anchor_' + Math.random().toString(36).slice(2, 9));
  }
  return el.id;
}

function _isOverlay(posEl) {
  return posEl.dataset.overlayBlock === 'true';
}

// 오토레이아웃 → 오버레이(플로팅) 전환
function _enterOverlay(posEl) {
  const sec = posEl.closest('.section-block');
  if (!sec) return false;
  const parent = posEl.parentElement;
  if (!parent) return false;

  // 복귀용 원위치 기억 — 부모 + 직전 형제(없으면 "맨 앞"으로 복귀)
  const parentId = _ensureId(parent);
  const prevSib  = posEl.previousElementSibling;
  posEl.dataset.overlayReturnParent = parentId;
  posEl.dataset.overlayReturnAfter  = prevSib ? _ensureId(prevSib) : '';

  // 폭 고정 — absolute 전환 시 콘텐츠 폭으로 쪼그라들지 않게 현재 렌더 폭을 그대로 굳힌다.
  if (!posEl.dataset.width) {
    const w = Math.round(posEl.offsetWidth);
    if (w > 0) {
      posEl.style.width = w + 'px';
      posEl.style.maxWidth = '100%';
      posEl.dataset.width = String(w);
    }
  }

  // 현재 화면 위치 → 섹션 기준 좌표로 고정 (줌 보정, freeLayout 드래그와 같은 계산식)
  const zoom = _zoom();
  const secRect = sec.getBoundingClientRect();
  const elRect  = posEl.getBoundingClientRect();
  const x = Math.round((elRect.left - secRect.left) / zoom);
  const y = Math.round((elRect.top  - secRect.top)  / zoom);

  sec.appendChild(posEl); // 섹션 직접 자식 — 스티커/확대블럭과 같은 스태킹(DOM 뒤 = 맨 위)
  posEl.style.position = 'absolute';
  posEl.style.left = x + 'px';
  posEl.style.top  = y + 'px';
  posEl.dataset.offsetX = String(x);
  posEl.dataset.offsetY = String(y);
  posEl.dataset.overlayBlock = 'true';
  posEl.dataset.selVariant   = 'sticker'; // 선택 아웃라인 보라 — js/selection-overlay.js 선언형 경로
  return true;
}

// 오버레이(플로팅) → 오토레이아웃 복귀
function _exitOverlay(posEl) {
  const parentId = posEl.dataset.overlayReturnParent;
  const afterId  = posEl.dataset.overlayReturnAfter;
  const parent = parentId ? document.getElementById(parentId) : null;
  // 원래 부모가 그 사이 사라졌으면(행 정리 등) 섹션 본문 맨 앞으로 폴백
  const fallback = posEl.closest('.section-block')?.querySelector('.section-inner');
  const target = (parent && parent.isConnected) ? parent : fallback;

  if (target) {
    const afterEl = afterId ? document.getElementById(afterId) : null;
    if (afterEl && afterEl.parentElement === target) afterEl.after(posEl);
    else target.prepend(posEl);
  }

  posEl.style.position = '';
  posEl.style.left = '';
  posEl.style.top  = '';
  delete posEl.dataset.offsetX;
  delete posEl.dataset.offsetY;
  delete posEl.dataset.overlayBlock;
  delete posEl.dataset.overlayReturnParent;
  delete posEl.dataset.overlayReturnAfter;
  delete posEl.dataset.selVariant;
}

export function wireOverlaySection({ tb }) {
  const btn = document.getElementById('txt-overlay-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const posEl = _posElOf(tb);
    const wasOverlay = _isOverlay(posEl);
    window.pushHistory?.(wasOverlay ? '오버레이 해제' : '오버레이로 전환');
    if (wasOverlay) _exitOverlay(posEl); else _enterOverlay(posEl);
    window.scheduleAutoSave?.();
    window.buildLayerPanel?.();
    // 패널 재렌더 — 버튼 active 상태 + X/Y 값 갱신
    window.showTextProperties?.(tb);
  });
}

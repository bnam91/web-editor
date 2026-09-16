/* prop-text-wireup-overlay.js
 * 텍스트블록 "오버레이(플로팅)" 토글 — Figma의 오버레이 버튼과 같은 개념.
 * 오토레이아웃(row/text-frame) 흐름에 속한 블록을 흐름에서 빼서 섹션 위에
 * position:absolute 로 띄운다. 다시 누르면 원래 있던 부모 · 순서로 복귀한다.
 *
 * ★기존 자산 재사용:
 *   - 선택 아웃라인 보라는 새 CSS가 아니라 js/selection-overlay.js 의 선언형 경로
 *     (`host.dataset.selVariant` → 'sticker' 변형 stroke = --ui-sel-overlay) 그대로 탄다.
 *     확대블럭(zoom-block.js)이 이미 쓰는 같은 길.
 *   - ⛔이동 드래그는 «별도 배선 불필요」가 아니었다(2026-09-15 정정). js/block-drag.js 의
 *     일반 절대배치 드래그는 «자기 free-layout 프레임 안에서만» 움직이는 것을 전제해서
 *     (부모 조상에 `.frame-block[data-free-layout]` 가 있어야 clamp/스냅이 돈다) 섹션 직속
 *     오버레이(부모가 .section-block 자체)엔 그 전제가 아예 없다 — clamp 분기가 전부
 *     스킵되고 드래그 델타가 그대로 style.left/top 에 꽂혀 다음 섹션 영역을 침범하고,
 *     DOM 은 원래 섹션에 그대로 남아 있어(재부모 없음) 그 섹션의 background 아래 깔려
 *     보이지 않게 됐다(현빈 실사용 재현, proj_1789467632756/tb_fks3h_svn05sy).
 *     ⇒ 확대블럭이 zoom-block.js:383 `if (isZoom) return`로 일반 드래그를 비켜가고
 *       자기만의 크로스섹션 드래그(_bindZoomMoveDrag)를 쓰는 것과 «같은 패턴»을 오버레이에도
 *       적용한다 — 아래 _bindOverlayMoveDrag. js/block-drag.js 쪽엔 `tf.dataset.overlayBlock
 *       === 'true'` 면 일반 드래그를 return 하는 대칭 변경이 있다(block-drag.js 참고).
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

/* ★위치를 쓰는 «단 하나의» 자리 — zoom-block.js _applyZoomPos(⑲)와 같은 규약.
   dataset.offsetX/offsetY 가 SSOT 고, style 은 그걸 되읽어 쓴다. */
function _applyOverlayPos(posEl, x, y) {
  posEl.dataset.offsetX = String(Math.round(x));
  posEl.dataset.offsetY = String(Math.round(y));
  posEl.style.left = posEl.dataset.offsetX + 'px';
  posEl.style.top  = posEl.dataset.offsetY + 'px';
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
  // ⛔dataset.width 는 Position 절의 «수동 너비」로도 쓰이는 필드다(prop-text-wireup-position.js) —
  //   여기서 새로 심은 것만 exit 시 지워야, 원래 수동 너비가 있던 블록의 값을 안 날린다.
  if (!posEl.dataset.width) {
    const w = Math.round(posEl.offsetWidth);
    if (w > 0) {
      posEl.style.width = w + 'px';
      posEl.style.maxWidth = '100%';
      posEl.dataset.width = String(w);
      posEl.dataset.overlayIntroducedWidth = 'true';
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
  _applyOverlayPos(posEl, x, y);
  posEl.dataset.overlayBlock = 'true';
  posEl.dataset.selVariant   = 'sticker'; // 선택 아웃라인 보라 — js/selection-overlay.js 선언형 경로
  window._bindOverlayMoveDrag?.(posEl); // 보통 bindBlock 에서 이미 걸렸지만(아래 참고) 방어적으로 한 번 더
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
  // ★enterOverlay 가 새로 심은 폭만 되돌린다 — 원래 있던 수동 너비는 그대로 둔다(위 주석 참고).
  if (posEl.dataset.overlayIntroducedWidth === 'true') {
    posEl.style.width = '';
    posEl.style.maxWidth = '';
    delete posEl.dataset.width;
    delete posEl.dataset.overlayIntroducedWidth;
  }
}

/* 오버레이(플로팅) 텍스트 — 크로스섹션 이동 드래그. zoom-block.js _bindZoomMoveDrag 와
   ★같은 패턴(재사용 아님 — 파일이 다르고 DOM 셀렉터 기반이라 옮겨적었다. 로직이 갈라지면
   여기서 따로 고친다는 뜻이다): 매 mousemove 마다 커서 아래 섹션을 hit-test 해서, 지금 담긴
   섹션과 다르면 그 섹션으로 실제로 appendChild 하고(재부모) 그 새 섹션 기준으로 좌표를 다시 잰다.
   ⛔섹션 clamp 를 안 하면(⌘ 드래그는 예외) 다음 섹션 영역을 침범해 배경 밑에 깔린다 — 그게
     이 함수가 고치는 버그다(파일 상단 주석 참고).
   posEl 자체(=tf, text-frame 래퍼)에 건다 — block-drag.js 의 bindBlock 이 자식 .text-block
   1개당 1회 호출한다(그쪽 참고), 함수 내부에서 dataset.overlayBlock 을 매번 live로 재확인하므로
   오버레이가 아닌 상태에서 걸어놔도 안전하다(그때는 그냥 조용히 빠진다). */
function _bindOverlayMoveDrag(posEl) {
  if (posEl._overlayMoveBound) return;
  posEl._overlayMoveBound = true;
  posEl.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (posEl.dataset.overlayBlock !== 'true') return; // 오버레이 아니면 일반 드래그(block-drag.js) 몫
    // ★T-037 P0(2026-09-16, 실측 QA 발견) — 텍스트 블록은 편집 중이 아닐 때도 항상
    //   contenteditable="false"를 달고 있다(block-factory.js 다수 자리). CSS 속성선택자
    //   [contenteditable]는 값과 무관하게 «속성 존재»만 보므로 false여도 걸려, 오버레이
    //   글자 «어디를 눌러도» 이 가드가 mousedown을 즉시 삼켜 크로스섹션 드래그가 통째로
    //   막혀 있었다(재현 100% — 실사용에서 마우스로 끌면 텍스트 네이티브 셀렉션만 되고
    //   블록은 1px도 안 움직임). 편집 중(=true로 전환된 상태)만 걸러야 하므로 값을 좁힌다.
    if (e.target.closest('.resize-handle, [contenteditable="true"]')) return;
    e.stopPropagation();

    let sec = posEl.closest('.section-block');
    if (!sec) return;
    const zoom = _zoom();
    /* ★2026-09-16h P0(현빈 실측 — "90도 회전 후 좌우 이동이 안 된다") — 회전된 오버레이는
       getBoundingClientRect()가 회전 «후» 화면상 축정렬 bounding box를 돌려준다(T-026과
       같은 병 — 90°에서 폭·높이가 통째로 뒤바뀐다). 그 rect로 잡은 grabX/grabY가 실제
       style.left/top 기준과 어긋나 90°에서는 가로로만 끌어도 top이 요동쳤다(실측: 가로
       100px만 끌었는데 top이 -100 바뀜).
       ⇒ getBoundingClientRect를 아예 안 쓴다. style.left/top은 «회전 전 프레임»의 위치이고
       transform:rotate()는 그 프레임을 자기 중심으로 돌리기만 할 뿐 위치는 안 옮기므로,
       left/top을 화면 스크린 델타만큼 그대로 더하면 회전각과 «무관하게» 박스 전체가
       스크린에서 정확히 그만큼 움직인다(회전은 그 델타에 영향을 안 준다 — 처음에 회전
       행렬로 델타를 보정하려 했던 건 잘못된 접근이었다, 실측으로 되짚어 확인).
       마우스다운 시점의 로컬 left/top과 스크린좌표를 저장해두고 매 프레임 순수 델타만
       더한다 — 회전 0°에서는 기존 산식과 완전히 같다(회귀 없음). */
    let startClientX = e.clientX, startClientY = e.clientY;
    let startLeft = parseFloat(posEl.style.left) || 0;
    let startTop = parseFloat(posEl.style.top) || 0;
    let moved = false;

    const onMove = ev => {
      if (!moved) {
        if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return;
        moved = true;
        window.pushHistory?.('오버레이 이동');
      }
      // ⌘ 드래그 = 자유 이동(섹션 경계 clamp 없이) — zoom·스티커와 같은 어휘.
      const free = ev.metaKey;
      const hover = (!free && window._findSectionAt) ? window._findSectionAt(ev.clientX, ev.clientY) : null;
      if (hover && hover !== sec) {
        // 재부모 — 지금까지의 로컬 좌표를 확정해 새 섹션 기준으로 다시 앵커를 잡는다.
        const dxs0 = (ev.clientX - startClientX) / zoom, dys0 = (ev.clientY - startClientY) / zoom;
        startLeft += dxs0; startTop += dys0;
        hover.appendChild(posEl);
        sec = hover;
        startClientX = ev.clientX; startClientY = ev.clientY;
      }
      const rawX = startLeft + (ev.clientX - startClientX) / zoom;
      const rawY = startTop  + (ev.clientY - startClientY) / zoom;
      const [cx, cy] = free
        ? [rawX, rawY]
        : (window._clampToSection?.(rawX, rawY, sec, posEl.offsetWidth, posEl.offsetHeight) || [rawX, rawY]);
      _applyOverlayPos(posEl, cx, cy);
      window.scheduleAutoSave?.();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (moved) window.triggerAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
window._bindOverlayMoveDrag = _bindOverlayMoveDrag;

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

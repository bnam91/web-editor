/* ══════════════════════════════════════════════════════════════════════════
   section-serialize.js — «캔버스 직렬화 세척»의 단일 진실원(single source of truth).
   ───────────────────────────────────────────────────────────────────────────
   getSerializedCanvas(save-load.js) 가 «캔버스 전체 클론»에 하던 세척 파이프라인을
   여기 한 곳에 모은다. 이유:
     ⑴ getSerializedCanvas 는 이 함수를 클론에 적용해 그대로 innerHTML 을 반환한다
        (바이트 동일 — 연산·순서 그대로 옮김).
     ⑵ 협업 undo 의 «라이브 가드»는 «라이브 섹션 1개»가 스냅샷 안에서 어떻게 직렬화되는지를
        재현해야 오경보가 안 난다(R1: «최소»가 아니라 «전체 파이프라인의 섹션판»). 그래서
        serializeSectionClone 이 «같은» serializeCleanRoot 를 섹션 1개짜리 래퍼에 적용한다.
   ⇒ 두 경로가 코드를 «공유»하므로 세척 목록이 갈릴 수 없다(drift 불가). 이게 R1 의 구조적 보장.

   ★플레인 스크립트(모듈 아님)로 두어 save-load(모듈)보다 «먼저» 실행되게 한다 —
     모듈은 defer 라 모든 플레인 스크립트 뒤에 돈다. getSerializedCanvas 는 런타임(사용자
     동작·자동저장)에 불리므로 window.serializeCleanRoot 는 항상 준비돼 있다(market-merge.js
     와 같은 로드 계약). 순수 DOM API 만 쓰고 import 가 없어 테스트에서 단독 로드 가능.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  /* 캔버스(또는 섹션 래퍼) 클론 root 를 «제자리»에서 세척한다. getSerializedCanvas 의
   * clone 생성 이후 return 직전까지의 연산을 «그대로»(순서 포함) 옮긴 것. root 를 반환한다. */
  function serializeCleanRoot(root) {
    if (!root) return root;
    // LAZY: 뷰포트 가상화로 언로드된 섹션은 라이브 style.backgroundImage 가 'none' 이고
    // 원본은 data-lazy-bg 에 보관돼 있다 — 클론에서 원복해 저장 HTML 에 배경이 정확히 들어가게.
    root.querySelectorAll('[data-lazy-bg]').forEach(el => {
      el.style.backgroundImage = el.getAttribute('data-lazy-bg');
      el.removeAttribute('data-lazy-bg');
    });
    root.querySelectorAll('.section-block.lazy-unloaded').forEach(el => el.classList.remove('lazy-unloaded'));
    // ghost 섹션은 저장에서 제외
    root.querySelectorAll('.section-block[data-ghost]').forEach(el => el.remove());
    root.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edge-handle, .img-edit-hint, .img-boundary, .img-rotate-zone, .ci-handle, .shape-handle, .sticker-corner-handle, .gradient-corner-handle, .hlb-handle, .grad-line-overlay, .vpen-preview, .vpen-edit-overlay, .ab-rotate-zone, .shape-rotate-zone, .sticker-rotate-zone, .tb-rotate-zone, .icn-rotate-zone, .mkp-rotate-zone, .cvb-rotate-zone, .icb-rotate-zone, .vb-rotate-zone').forEach(el => el.remove());
    // UI 상태 클래스 전면 제거 — selected 잔존이 독립렌더/export 에 파란 아웃라인 유출
    root.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    root.querySelectorAll('.cell-selected').forEach(el => el.classList.remove('cell-selected')); // #5-b 테이블 셀 선택 마킹 (UI 상태 — 저장본 유출 방지)
    root.querySelectorAll('.editing').forEach(el => el.classList.remove('editing'));
    root.querySelectorAll('.row-active').forEach(el => el.classList.remove('row-active'));
    root.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    root.querySelectorAll('.sticker-block.tiny').forEach(s => s.classList.remove('tiny'));
    root.querySelectorAll('.img-editing').forEach(el => el.classList.remove('img-editing'));
    root.querySelectorAll('.ci-selected').forEach(el => el.classList.remove('ci-selected'));
    root.querySelectorAll('.ci-active').forEach(el => el.classList.remove('ci-active'));
    // 편집 상태 속성 제거 — contenteditable/editing 상태가 저장되지 않도록
    root.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    root.querySelectorAll('.editing').forEach(el => el.classList.remove('editing'));
    // 드래그 중단 시 고착된 상태 제거
    root.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    root.querySelectorAll('.ss-drag-over').forEach(el => el.classList.remove('ss-drag-over'));
    // group-block 선택/편집 상태 제거
    root.querySelectorAll('.group-block').forEach(g => g.classList.remove('group-selected', 'group-editing'));
    root.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    // 섹션 임시 스타일 제거 — 미리보기/썸네일용 scale transform 이 저장에 포함되지 않도록
    root.querySelectorAll('.section-block').forEach(sec => {
      sec.style.transform       = '';
      sec.style.transformOrigin = '';
      sec.style.position        = '';
      sec.style.left            = '';
      sec.style.pointerEvents   = '';
      sec.style.userSelect      = '';
    });
    return root;
  }

  /* 라이브 섹션 1개 → 스냅샷 안에서와 «동일하게» 세척된 outerHTML 문자열.
   *   ⚠️라이브 DOM 을 건드리지 않는다(클론에만 세척). getSerializedCanvas 가 저장 직전에
   *   sec._name → dataset.name 을 동기화하므로(MUT-01), 여기서도 «클론에» 같은 동기화를 한 뒤
   *   세척한다 — 안 하면 data-name 차이로 라이브 가드가 오발한다.
   *   섹션 래퍼(div) 안에 넣어 세척하는 이유: serializeCleanRoot 의 selector 들이 root «자신»이
   *   아니라 descendant 를 훑기 때문(캔버스가 섹션의 부모인 것과 동일한 관계를 재현). */
  function serializeSectionClone(liveSecEl) {
    if (!liveSecEl) return '';
    const wrap = (liveSecEl.ownerDocument || document).createElement('div');
    const clone = liveSecEl.cloneNode(true);
    if (liveSecEl._name && clone.dataset.name !== liveSecEl._name) clone.dataset.name = liveSecEl._name;
    wrap.appendChild(clone);
    serializeCleanRoot(wrap);
    return wrap.firstElementChild ? wrap.firstElementChild.outerHTML : '';
  }

  window.serializeCleanRoot = serializeCleanRoot;
  window.serializeSectionClone = serializeSectionClone;
})();

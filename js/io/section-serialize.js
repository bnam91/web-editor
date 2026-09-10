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
  /* ══ 런타임 전용 마커 — «단일 진실원» ═══════════════════════════════════════
     ★성질 우선. 「-line-selected 로 끝나면 줄 선택 마커다」는 이 레포의 «규칙»이지
       bn2/grd 라는 «명단»이 아니다. 그래서 앞으로 생길 xxx-line-selected 는
       아무 파일도 안 고쳐도 자동으로 벗겨진다.
       ⛔이게 없으면: 새 컴포넌트가 자기 줄 마커를 만드는 날, 「6자리 다 지웠나」로 세는
         명부는 조용히 통과하고 마커는 템플릿·저장본·PNG 로 샌다(2026-09-09 «7번째 문»).
     ★성질로 못 묶이는 것만 아래 «현재 목록»에 둔다. 이름에 규칙이 없어서지 원리가 달라서가 아니다.
       ⇒ 늘어날 수 있다. 늘릴 땐 «여기 한 곳만» 고친다 — market-merge·version-diff 도 이걸 읽는다.
     ⚠️'tiny'(스티커)·'lazy-unloaded'(가상화)는 여기 안 넣는다 — 조건부(특정 블록에서만)라
       전역 sweep 대상이 아니다. 아래 serializeCleanRoot 안에서 따로 걷는다. */
  const RUNTIME_MARKER_RE  = /(?:^|-)line-selected$/;
  const RUNTIME_MARKER_CLS = [
    'selected', 'cell-selected', 'ci-selected', 'ci-active', 'row-active',
    'bn2-line-selected', 'grd-line-selected',   // ★RE 가 이미 잡는다. 「현재 무엇이 있나」를 사람이 읽으라고 남긴다
    'bn2-line-empty',                            // 빈 줄 플레이스홀더 (편집 전용)
    'editing', 'img-editing', 'sec-bg-editing', 'group-selected', 'group-editing',
    'dragging', 'ss-drag-over', 'drag-over', 'hovered',
  ];
  /** 클래스 토큰 하나가 «런타임 전용»인가. */
  function isRuntimeMarker(cls) {
    return RUNTIME_MARKER_RE.test(cls) || RUNTIME_MARKER_CLS.indexOf(cls) !== -1;
  }
  /** el «자신»의 런타임 마커를 벗긴다(자손은 안 본다).
   *  ⛔classList 를 «순회»하지 않는다 — SVG 요소와 테스트 미니 DOM 에서 classList 가
   *    iterable 이 아닐 수 있다. class «속성»을 읽으면 셋 다에서 같게 돈다. */
  function stripRuntimeMarkers(el) {
    if (!el || !el.getAttribute || !el.classList) return el;
    const hits = String(el.getAttribute('class') || '').split(/\s+/).filter(isRuntimeMarker);
    if (hits.length) el.classList.remove(...hits);
    return el;
  }

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
    root.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edge-handle, .img-edit-hint, .img-boundary, .img-rotate-zone, .ci-handle, .shape-handle, .sticker-corner-handle, .gradient-corner-handle, .hlb-handle, .grad-line-overlay, .vpen-preview, .vpen-edit-overlay, .ab-rotate-zone, .shape-rotate-zone, .sticker-rotate-zone, .tb-rotate-zone, .icn-rotate-zone, .mkp-rotate-zone, .cvb-rotate-zone, .icb-rotate-zone, .vb-rotate-zone, .sec-bg-proxy').forEach(el => el.remove());
    /* ★UI 상태 클래스 전면 제거 — «성질»로 센다. 손 열거가 아니다.
       selected 잔존이 독립렌더/export 에 파란 아웃라인을 유출하고, 줄 선택 마커
       (bn2/grd/앞으로 생길 것)는 템플릿에 박혀 «유령 선택바»가 된다.
       ⛔한 클래스씩 querySelectorAll 하던 15줄이 여기 있었다. 그 모양이면 새 마커가
         생길 때마다 사람이 «기억해서» 한 줄을 더해야 하고, 안 더한 날 조용히 샌다. */
    root.querySelectorAll('[class]').forEach(stripRuntimeMarkers);
    root.querySelectorAll('.sticker-block.tiny').forEach(s => s.classList.remove('tiny'));  // 조건부 — 스티커에서만 UI 상태
    /* 섹션 배경 «위치 편집» 임시 상태 — .sec-bg-proxy 는 위 remove 목록에서 이미 사라졌고,
       마킹 클래스(sec-bg-editing)는 위 성질 sweep 이 걷었다. ci-selected · ci-active ·
       editing · dragging · ss-drag-over · group-selected/editing 도 마찬가지다.
       (고스트 .sec-bg-ghost 는 #canvas 밖 오버레이라 애초에 클론에 없다) */
    // 편집 상태 속성 제거 — contenteditable 상태가 저장되지 않도록
    root.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    root.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    /* ★패딩 힌트(편집 보조)의 인라인 변수 — 「만지는 동안」만 사는 것이라 저장에 실리면 안 된다.
       ⚠️prop-section.js 가 400ms 뒤 «거두지만», 슬라이더를 «놓지 않고 계속 끄는 동안»엔
         클래스도 변수도 살아 있다. 그 창에 autoSave(1500ms 디바운스)가 겹치면 실린다.
         실측(2026-09-08): 힌트가 켜진 채로 이 함수를 돌리면 --gdt-pad 가 «2건» 남았다.
       ⇒ 거두기는 «보통»을 막고, 여기가 «그 창»을 막는다. 두 겹이어야 새지 않는다.
       ⛔라이브 DOM 이 아니라 «클론»에만 쓴다 — 이 함수의 계약이 그렇다.
       (tests/dom/pad-hint.dom.spec.js D6 이 이 줄을 지킨다) */
    root.querySelectorAll('.section-inner').forEach(inner => {
      inner.style.removeProperty('--gdt-pad-l');
      inner.style.removeProperty('--gdt-pad-r');
    });
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

  /* ★root «자신»까지 씻는다. serializeCleanRoot 는 querySelectorAll 만 쓰므로 구조적으로
     root 자신을 «못 본다» — 캔버스를 씻을 땐 캔버스가 마커를 달 일이 없어 안 드러났다.
     ⛔그런데 템플릿 저장은 «섹션 1개»·«블록 1개»를 root 로 넘긴다. 그 블록은 .editing 을
       달고 있을 수 있고(js/block-drag.js:182), 이미지 블록은 .img-editing 을 단다
       (js/image-handling.js:62). 그대로 굳으면 템플릿 HTML 의 «맨 바깥»에 마커가 박힌다.
     ⇒ 래퍼에 넣어 돌리면 root 가 «자손»이 되어 같은 규칙을 받는다(serializeSectionClone 과 같은 수법).
     ★el 을 제자리에서 고치고 그대로 돌려준다 — 래퍼는 흔적을 안 남긴다(부모가 없던 el 은 부모가 없는 채로). */
  function serializeCleanSelf(el) {
    if (!el) return el;
    const doc = el.ownerDocument || document;
    const parent = el.parentNode, next = el.nextSibling;
    const wrap = doc.createElement('div');
    wrap.appendChild(el);
    serializeCleanRoot(wrap);
    wrap.removeChild(el);
    if (parent) parent.insertBefore(el, next);
    return el;
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
  window.serializeCleanSelf = serializeCleanSelf;
  window.serializeSectionClone = serializeSectionClone;
  /* ★비교 채널(js/market-merge.js · js/version-diff.js)이 «같은 자»를 쓰게 내준다.
     그쪽은 결과물이 아니라 «비교 키»를 만들지만, 마커가 남으면 「줄을 골랐을 뿐인데 변경됨」
     오탐이 난다. 목록이 두 벌이면 한쪽만 고쳐지는 날이 온다 — 그래서 여기가 유일한 원본이다. */
  window.runtimeMarkers = { isRuntimeMarker, stripRuntimeMarkers, LIST: RUNTIME_MARKER_CLS, RE: RUNTIME_MARKER_RE };
})();

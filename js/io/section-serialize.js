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
  /* ══ T-031 video-pending 스냅샷 스코프 사이드카 ═══════════════════════════════
     문제: 아래 serializeCleanRoot 의 T-012 안전장치(video-pending → "업로드대기" 빈
     상태로 세척)는 pushHistory 가 쓰는 getSerializedCanvas 스냅샷도 «그대로» 거친다.
     그래서 트림 핸들을 드래그할 때마다(js/props/asset-video-trim.js pushHistory) 찍히는
     undo 스냅샷도 전부 "빈 에셋"으로 찍혀, ⌘Z 한 번에 트림이 아니라 «영상 자체»가
     사라지는 데이터손실 회귀가 난다(2026-09-15, T-012 직후 예측·실측 재현).
     ⇒ 원본(dataURL/파일)은 직렬화되는 문자열 «밖»에 따로 보관하고, undo/redo·페이지전환
       으로 스냅샷을 되돌릴 때 (js/history.js restoreSnapshot/restoreSnapshotScoped,
       js/io/save-load.js switchPage/deletePage, rebindAll 직후) 원본을 찾아 다시
       연결한다.
     ★2026-09-15 2차 수정(a1-a3 코드리뷰 지적): 최초 구현은 block.id → 마지막 값 «하나»만
       덮어쓰는 전역 Map 이었다 — 그러면 (1) 지운 영상 → 무관한 편집 → ⌘Z 한 번 만으로도
       "무관한 편집"이 아니라 «지운 영상»이 되살아나고(그 스냅샷은 삭제 후 상태인데도
       전역 캐시엔 삭제 전 값이 여전히 남아있어서), (2) 트림을 여러 번 고친 뒤 되돌려도
       구간이 «그 시점 값»이 아니라 «최신 값»으로 붙었다(전역 슬롯이 하나뿐이라 되돌릴
       스냅샷마다 다른 값을 못 가짐), (3) 세션 내내 모든 video-pending 블록의 원본
       dataURL(블록당 최대 ~66MB)이 한 번 캐시되면 안 비워졌다.
       ⇒ 캐시를 전역 Map 이 아니라 «각 스냅샷/페이지 객체가 직접 들고 다니는 사이드카
       객체»로 바꾼다 — getLastVideoPendingSidecar() 가 «바로 직전» serializeCleanRoot
       호출(=이 스냅샷을 만든 그 호출) 하나가 발견한 것만 돌려주므로, 호출자(history.js
       pushHistory/init, save-load.js flushCurrentPage)가 그 스냅샷/페이지 객체에
       videoPendingSidecar 로 붙여 «그 시점 전용»으로 들고 다닌다. reattachVideoPendingBlocks
       는 복원하는 «그 스냅샷의» 사이드카만 받아쓰므로, 무관한 스냅샷을 복원할 땐 그
       스냅샷의 사이드카가 비어 있어(또는 다른 값이라) 잘못 되살아나지 않는다. 메모리도
       history MAX_HISTORY(50)·페이지 수만큼만 살아있는 만큼만 쥔다(전역 누적 없음).
       js/effects/redact-mosaic.js 의 _fullResCache(WeakMap, DOM 노드 자신이 키)와 원리는
       같다(무거운 데이터를 직렬화 밖에 둔다) — 다만 여긴 undo/redo 가 캔버스 innerHTML 을
       통째로 교체해 DOM 인스턴스 자체가 갈리므로(같은 id, 다른 노드) 노드가 아니라
       block.id 문자열을 키로 쓰는 «그때그때의» 일반 객체다.
     ⛔진짜 파일 리로드(앱 재시작 후 프로젝트 다시 열기)에는 안 쓰인다 — 로드된 데이터에
       videoPendingSidecar 필드 자체가 없어(저장 파일엔 안 실린다) 자연히 T-031 의도된
       "빈 업로드대기" 로 떨어진다. */
  let _lastSweepSidecar = null;

  /** 지우기 «직전»에 원본을 «이번 sweep 전용» 사이드카에 남긴다(serializeCleanRoot 가
   *  호출 때마다 새로 연다 — 전역이 아니다). ab 는 (라이브가 아니라) 클론일 수 있지만
   *  cloneNode(true) 가 dataset 을 그대로 복사하므로 값은 동일하다. */
  function captureVideoPendingState(ab) {
    if (!_lastSweepSidecar || !ab || !ab.id) return;
    const imgSrc = ab.dataset.imgSrc;
    if (!imgSrc) return; // 아직 업로드 전(진짜 빈 상태) — 캐시할 게 없다
    _lastSweepSidecar[ab.id] = {
      imgSrc,
      fit: ab.dataset.fit || 'cover',
      trimIn: ab.dataset.trimIn,
      trimOut: ab.dataset.trimOut,
      playbackRate: ab.dataset.playbackRate,
    };
  }

  /** «바로 직전» serializeCleanRoot 호출(=getSerializedCanvas 로 방금 만든 그 스냅샷)이
   *  발견한 video-pending 원본들. 호출자는 getSerializedCanvas() 직후 «같은 동기 구간»
   *  에서 이걸 읽어 자기 스냅샷/페이지 객체에 videoPendingSidecar 로 붙여야 한다 — 다음
   *  serializeCleanRoot 호출(다른 스냅샷·템플릿저장·섹션복사 등 무엇이든)이 오면 갱신돼
   *  버린다. */
  function getLastVideoPendingSidecar() {
    return _lastSweepSidecar || {};
  }

  /** undo/redo·페이지전환으로 캔버스가 통째로(또는 부분) 갈린 뒤 호출 — «빈 업로드대기»로
   *  찍힌 video-pending 블록 중 «지금 복원하는 이 스냅샷/페이지 자신의» sidecar 에 원본이
   *  있으면 다시 붙인다. root 는 보통 #canvas. sidecar 는 복원 대상 스냅샷/페이지 객체가
   *  들고 있던 videoPendingSidecar(js/history.js·js/io/save-load.js 가 rebindAll(opts)로
   *  넘긴다) — 없으면(진짜 파일 리로드 등) 아무것도 되살리지 않는다. */
  function reattachVideoPendingBlocks(root, sidecar) {
    if (!root || !root.querySelectorAll || !sidecar) return;
    /* ⛔[data-asset-type="video-pending"] 로는 못 고른다 — 지우기 자체가 assetType 도
       delete 목록에 넣는다(위 T-012 목록: 'assetType' 포함), 그래서 스냅샷 문자열엔 이
       마커가 «이미 없다». id 가 sidecar 에 있는지만으로 판정한다 — sidecar 는 애초에
       «이 스냅샷을 만들 때» video-pending 이었던 블록만 담는다. */
    root.querySelectorAll('.asset-block').forEach(ab => {
      if (ab.dataset.imgSrc) return; // 이미 원본이 있다 — 손대지 않는다
      const cached = ab.id ? sidecar[ab.id] : null;
      if (!cached) return; // 이 스냅샷의 sidecar 엔 없음 — 의도된 "빈 업로드대기" 그대로 둔다(T-031)
      ab.classList.add('has-image');
      ab.dataset.assetType = 'video-pending';
      ab.dataset.imgSrc = cached.imgSrc;
      ab.dataset.fit = cached.fit;
      if (cached.trimIn  != null) ab.dataset.trimIn  = cached.trimIn;
      if (cached.trimOut != null) ab.dataset.trimOut = cached.trimOut;
      if (cached.playbackRate != null) ab.dataset.playbackRate = cached.playbackRate;
      const overlayEl = ab.querySelector('.asset-overlay');
      const overlayHTML  = overlayEl ? overlayEl.innerHTML : '';
      const overlayStyle = overlayEl ? overlayEl.getAttribute('style') || '' : '';
      const grainEl = ab.querySelector('.asset-grain');
      const grainStyle = grainEl ? grainEl.getAttribute('style') || '' : '';
      const grainIntensity = grainEl ? grainEl.dataset.grainIntensity || '' : '';
      ab.innerHTML = `
        <div class="asset-img-clip"><video class="asset-img asset-video" src="${cached.imgSrc}" style="object-fit:${ab.dataset.fit}" muted loop playsinline></video></div>
        <button class="asset-overlay-clear" title="영상 제거">✕</button>
        <div class="asset-overlay" ${overlayStyle ? `style="${overlayStyle}"` : ''}>${overlayHTML}</div>`;
      if (grainEl) {
        const doc = ab.ownerDocument || document;
        const newGrain = doc.createElement('div');
        newGrain.className = 'asset-grain';
        if (grainStyle) newGrain.setAttribute('style', grainStyle);
        if (grainIntensity) newGrain.dataset.grainIntensity = grainIntensity;
        ab.appendChild(newGrain);
      }
      const clearBtn = ab.querySelector('.asset-overlay-clear');
      if (clearBtn) clearBtn.addEventListener('click', e => {
        e.stopPropagation();
        window.clearAssetImage?.(ab);
      });
      ab.querySelectorAll('.overlay-tb').forEach(b => { b._blockBound = false; window.bindBlock?.(b); });
      /* ★최초 업로드 경로(image-handling.js setAssetVideoFromSrc)와 같은 재생 동작 — 되살린
       * <video> 도 loadedmetadata 뒤 재생을 건다(a1-a3 지적, 2026-09-15: 안 걸면 undo/redo·
       * 페이지전환 뒤 되살아난 미리보기가 첫 프레임에 멈춰 있다). ⛔trimIn/trimOut 은 거기와
       * 달리 «리셋하지 않는다» — 여긴 새 업로드가 아니라 복원이라 캐시된 트림값을 그대로 쓴다. */
      const _video = ab.querySelector('.asset-video');
      if (_video) {
        _video.addEventListener('loadedmetadata', () => { _video.play().catch(() => {}); }, { once: true });
      }
    });
  }

  const RUNTIME_MARKER_RE  = /(?:^|-)line-selected$/;
  const RUNTIME_MARKER_CLS = [
    'selected', 'cell-selected', 'ci-selected', 'ci-active', 'row-active',
    'bn2-line-selected', 'grd-line-selected',   // ★RE 가 이미 잡는다. 「현재 무엇이 있나」를 사람이 읽으라고 남긴다
    'bn2-line-empty',                            // 빈 줄 플레이스홀더 (편집 전용)
    'stb-step-selected',                         // 스텝 마커의 «옛 이름» — 규칙 밖 이름이라 저장본에 샜다(2026-09-15). 새 이름 stb-line-selected 는 RE 가 잡는다
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
    // ★이 호출 전용 sidecar 를 새로 연다(전역 아님) — captureVideoPendingState 가 여기 채운다.
    _lastSweepSidecar = {};
    // LAZY: 뷰포트 가상화로 언로드된 섹션은 라이브 style.backgroundImage 가 'none' 이고
    // 원본은 data-lazy-bg 에 보관돼 있다 — 클론에서 원복해 저장 HTML 에 배경이 정확히 들어가게.
    root.querySelectorAll('[data-lazy-bg]').forEach(el => {
      el.style.backgroundImage = el.getAttribute('data-lazy-bg');
      el.removeAttribute('data-lazy-bg');
    });
    root.querySelectorAll('.section-block.lazy-unloaded').forEach(el => el.classList.remove('lazy-unloaded'));
    /* T-012 안전장치: video-pending(트림 확정 «전» 임시 상태, js/image-handling.js
       setAssetVideoFromSrc 참고)은 저장 대상이 아니다 — "GIF로 적용"을 안 누른 채 저장하면
       원본 영상 data URL(최대 ~50MB×1.33 팽창)이 proj.json «과» 모든 undo 스냅샷(트림 핸들
       드래그마다 최대 50개)에 통째로 영구 저장된다(2026-09-15 적대적 QA 실측). T-012 의 원칙
       "확정된 PNG/GIF 만 저장된다"를 이 임시 상태가 깨고 있었다 — clearAssetImage 와 같은
       delete 목록으로 되돌려 «업로드 대기» 빈 상태로 저장한다(트림 진행은 잃지만 원본 영구
       저장 방지가 우선; 스크래치패드가 이미 같은 이유로 스냅샷 밖에 있다). */
    root.querySelectorAll('.asset-block[data-asset-type="video-pending"]').forEach(ab => {
      // ★지우기 전에 원본을 이번 sweep 전용 sidecar 에 남긴다(undo/redo·페이지전환 복원용 —
      //   위 _lastSweepSidecar 정의부 참고). 저장되는 문자열엔 영향 없다.
      captureVideoPendingState(ab);
      ab.classList.remove('has-image');
      ['imgSrc', 'fit', 'imgW', 'imgX', 'imgY', 'imgPosition', 'assetType', 'trimIn', 'trimOut', 'playbackRate', 'motion', 'gifSrc', 'gifPlaying']
        .forEach(k => delete ab.dataset[k]);
      const overlayEl = ab.querySelector('.asset-overlay');
      const overlayHTML  = overlayEl ? overlayEl.innerHTML : '';
      const overlayStyle = overlayEl ? overlayEl.getAttribute('style') || '' : '';
      // ★그레인 보존 — image-handling.js setAssetVideoFromSrc/setAssetImageFromSrc 와 같은
      //   패턴(적대적 QA 지적, 2026-09-15): innerHTML 을 통째로 갈아엎으면 형제 .asset-grain
      //   이 같이 사라진다 — video-pending 세척만 이 규칙에서 예외일 이유가 없다(섹션
      //   복사/템플릿 저장 경로에서 그레인이 조용히 빠지는 부수피해였다).
      const grainEl = ab.querySelector('.asset-grain');
      const grainStyle = grainEl ? grainEl.getAttribute('style') || '' : '';
      const grainIntensity = grainEl ? grainEl.dataset.grainIntensity || '' : '';
      ab.innerHTML = `<div class="asset-overlay" ${overlayStyle ? `style="${overlayStyle}"` : ''}>${overlayHTML}</div>`;
      if (grainEl) {
        const doc = ab.ownerDocument || document;
        const newGrain = doc.createElement('div');
        newGrain.className = 'asset-grain';
        if (grainStyle) newGrain.setAttribute('style', grainStyle);
        if (grainIntensity) newGrain.dataset.grainIntensity = grainIntensity;
        ab.appendChild(newGrain);
      }
    });
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
  window.reattachVideoPendingBlocks = reattachVideoPendingBlocks;
  window.getLastVideoPendingSidecar = getLastVideoPendingSidecar;
  /* ★비교 채널(js/market-merge.js · js/version-diff.js)이 «같은 자»를 쓰게 내준다.
     그쪽은 결과물이 아니라 «비교 키»를 만들지만, 마커가 남으면 「줄을 골랐을 뿐인데 변경됨」
     오탐이 난다. 목록이 두 벌이면 한쪽만 고쳐지는 날이 온다 — 그래서 여기가 유일한 원본이다. */
  window.runtimeMarkers = { isRuntimeMarker, stripRuntimeMarkers, LIST: RUNTIME_MARKER_CLS, RE: RUNTIME_MARKER_RE };
})();

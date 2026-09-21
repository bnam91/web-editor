/* ═══════════════════════════════════════════════════════════════════════════
   INSERT HISTORY — 삽입(push-before) 입구가 히스토리에 «끝 표본»을 하나 더 남기게 하는 부품
   (T-131 · 현빈 2026-09-21 「텍스트 블럭 추가 직후 글자크기 36→20 커밋 → ⌘Z 한 번에
     블럭 자체가 사라짐」 / 「에셋 추가 직후 프리셋 Tall → ⌘Z 한 번에 에셋이 사라짐」)

   ══ 이 파일이 푸는 문제 ═══════════════════════════════════════════════════
   pushHistory() 는 «부르는 그 순간 살아있는 캔버스»를 찍는다. 그래서 스택은
   「상태를 찍은 표본의 줄」이고, ⌘Z 는 «한 칸 앞 표본»으로 되돌린다.
   ⇒ undo 가 맞으려면 «동작과 동작 사이마다 표본이 하나씩» 있어야 한다.

   이 레포엔 부르는 규약이 «두 벌»이다(js/CLAUDE.md 「히스토리 규약」).
     · push-before — 바꾸기 «전»에 찍는다 (block-factory 삽입류)      109자리
     · push-after  — 바꾼 «뒤»에 찍는다  (우측 패널 대다수·드래그 onUp) 258자리
   ★어느 쪽도 «다수파로 통일»할 만한 크기가 아니다(전수 개종은 회귀면이 너무 넓다).

   드래그가 끼는 이음매는 js/drag-history.js 가 이미 메웠다. 남은 것이 이 카드다:
     삽입(before) → 우측 패널(after) — «드래그가 없는» 이음매라 그 부품이 못 낀다.
       삽입: [S0(=삽입 «전»)]            ← 「블럭이 막 생긴」 상태를 «한 번도» 안 찍는다
       패널: [S0, S2(=값 바꾼 «뒤»)]
       ⌘Z  : S0 ⇒ 값 변경 «과» 삽입이 같이 취소된다  ← 현빈 제보가 정확히 이 모양
   ⇒ 삽입 입구가 돌아온 «직후»에 표본을 하나 더 남기면:
       삽입: [S0, S1(=블럭 있고 값 옛날)] / 패널: [S0, S1, S2]
       ⌘Z  : S1(블럭 있고 값 옛날) ✓  한 번 더: S0(블럭 없음) ✓
     삽입만 하고 ⌘Z 해도 «여전히 한 번»이다 — undo 첫머리의 ensureHistoryCheckpoint 가
     top==live 를 보고 아무것도 안 쌓기 때문이다(그래서 ④ «정착» 규약이 아래에 있다).

   ★새 관용구가 아니다 — 이 레포엔 이미 «양쪽 끝»을 찍는 선례가 있다:
     js/editor.js duplicateSelected 의 `pushHistory('복제')` + `pushHistory('복제 완료')`.

   ══ 규약 넷 (⛔이 넷을 깨면 아래 게이트가 빨강이 된다) ════════════════════
   ① `window.pushHistory` 는 «부를 때» 읽는다. ⛔변수로 미리 잡지 마라.
      js/ai-section-fill.js:425-426 이 `window.pushHistory` 를 «노옵으로 갈아끼운 뒤»
      window.addTextBlock 을 N번 부른다 — 한 번의 ⌘Z 로 AI 채우기 전체가 롤백되게 하려는
      «의도된» 자리다. 시작할 때 캡처하면 그 의도가 깨져 칸이 N개 생긴다.
      같은 규약의 선례: js/table-cell-select.js 의 suppressAncestorDrag 주석.
   ② 끝 표본은 `finally` 에서 찍고 «예외는 안 삼킨다» — 입구가 반쯤 쓰고 던져도 스택이
      라이브를 따라가는 편이 «라이브를 못 찍은 칸»보다 안전하다.
   ③ 중첩은 «깊이 0 일 때만» 찍는다 — 외부 조립자(goditor.buildSection·스크래치 드롭)가
      입구를 N번 불러도 바깥 하나만 남는다.
   ④ ★삽입 입구는 «돌아온 뒤에 캔버스를 더 바꾸면 안 된다»(setTimeout·rAF 로 미루기 금지).
      ensureHistoryCheckpoint 는 «생문자열 !==» 로 재므로(_sameEdit 아님), 끝 표본 뒤에
      DOM 이 더 바뀌면 top≠live 가 되어 ⌘Z 가 «현재 상태» 한 칸을 더 만든다
      ⇒ 삽입만 하고 ⌘Z 가 «두 번»이 된다(=먹통 한 칸). 실측으로 두 자리가 있었다:
        · addTableBlock — flow-frame 경로가 테마적용을 setTimeout 0 으로 미뤘다 ⇒ 동기로 폈다.
        · addStickerBlock — rAF 로 _enterStickerEdit(편집 진입). 그쪽은 «직렬화에서
          세척»되게 했다(contenteditable 은 원래 세척, user-select·cursor 를
          js/io/section-serialize.js 가 같이 걷는다). 두 길 중 «세척»을 고른 이유는
          focus/캐럿이 부착 뒤 틱을 필요로 해서다.
   ⛔이건 «옮기기»가 아니라 «더하기»다. 입구 «안»의 push-before 호출은 하나도 안 건드린다.
     옮기면 이음매가 이사할 뿐이다(js/CLAUDE.md 2026-09-20 회귀 기록).

   ══ 값 ═══════════════════════════════════════════════════════════════════
   삽입 1회당 getSerializedCanvas() 가 1회 → 2회. drag-history 실측(827KB·1081요소)
   기준 직렬화 p50 3.9ms / p90 53.4ms / max 79.2ms 이므로 무거운 문서에서 삽입 클릭이
   +50~80ms 들 수 있다. 판정선(100ms)은 한 번으로 안 넘지만 꼬리가 굵다 — 삽입이
   눈에 띄게 걸리면 여기부터 의심해라.

   ══ 기계 게이트 ═══════════════════════════════════════════════════════════
   · tests/unit/insert-seam-roster.test.mjs — 로스터가 안 썩는가 / 비동기 금지 /
     캡처 대입 금지 / 정착(④) 금지목록.
   · tests/dom/insert-seam-undo.dom.spec.js — 행동(M1~M8) + 음성대조 2벌(N1·N2).

   ⛔플레인 스크립트다(ESM 아님). index.html 의 js/drag-history.js 다음 줄에 둔다.
     설치는 DOMContentLoaded 에서 한다 — 클래식 스크립트는 모든 type="module" 보다
     «먼저» 돌아 로드 시점엔 window.addXxx 가 아직 없고, module(=defer)은
     DOMContentLoaded «전»에 전부 실행되므로 그 시점이면 대입이 전부 끝나 있다.
     ⇒ script 태그를 어디에 두든 안 물리는 설계다.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /** 이 패턴에 맞는 window.add* 는 «자동으로» 로스터다 — 새 블럭 타입이 생겨도 안 썩는다. */
  var MATCH = /^add[A-Z][A-Za-z0-9]*Block$/;
  /** 패턴 밖인데 «삽입»인 것 — 손으로 더한다. */
  var EXTRA = ['addSection', 'addPresetRow'];
  /** 패턴에 걸리지만 «삽입이 아닌» 것 — 이유를 «반드시» 같이 적는다(게이트가 이유를 검사한다). */
  var DENY = {
    /* (지금은 비어 있다 — Block$ 패턴이 비삽입을 한 건도 안 잡는다.
       비삽입 add* 8자리(addGhostSection·addPage·addSectionToScope·addStickerFavorite·
       addToImageGallery·addChecklistItem·addChecklistSection·addVariation)는 전부
       패턴 밖이라 여기 적을 것이 없다. 새 이름이 생기면 «이유와 함께» 여기에.) */
  };
  /** 되돌리기 버튼 툴팁용 라벨(cosmetic). 없으면 기본값. */
  var LABELS = {
    addSection: '섹션 추가', addTextBlock: '텍스트 추가', addBlankTextBlock: '텍스트 추가',
    addAssetBlock: '이미지 추가', addShapeBlock: '도형 추가', addStickerBlock: '스티커 추가',
    addGradientBlock: '그라데이션 추가', addZoomBlock: '확대블럭 추가', addIconifyBlock: '아이콘 추가'
  };
  var DEFAULT_LABEL = '블럭 추가';

  var _depth = 0;          // ★재진입 깊이 — 바깥 하나만 찍는다(규약 ③)
  var _roster = [];

  function wrap(name, fn) {
    if (fn.__insertSeamWrapped) return fn;
    function seamWrapped() {
      _depth++;
      try {
        return fn.apply(this, arguments);
      } finally {
        _depth--;
        if (_depth === 0) {
          /* ★★규약 ① — «부를 때» 읽는다. 시작할 때 붙잡으면 js/ai-section-fill.js 의
             «의도된 노옵»을 깨뜨려 AI 섹션채우기가 ⌘Z 한 번에 안 굴러간다. */
          try {
            if (typeof window.pushHistory === 'function') {
              window.pushHistory(LABELS[name] || DEFAULT_LABEL);
            }
          } catch (e) { console.warn('[insert-history] 끝 표본 실패:', name, e); }
        }
      }
      /* 규약 ② — finally 라 입구가 던져도 표본을 남기고, 예외는 그대로 위로 간다. */
    }
    seamWrapped.__insertSeamWrapped = true;
    seamWrapped.__insertSeamName = name;
    return seamWrapped;
  }

  function install() {
    var names = Object.keys(window).filter(function (k) {
      return typeof window[k] === 'function' && MATCH.test(k) && !DENY[k];
    }).concat(EXTRA.filter(function (k) { return typeof window[k] === 'function'; }));
    names = names.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
    for (var i = 0; i < names.length; i++) window[names[i]] = wrap(names[i], window[names[i]]);
    _roster = names;
  }

  /* 게이트 전용 읽기창 — ⛔쓰기 없음 */
  window.__insertSeamRoster = function () { return _roster.slice(); };
  window.__insertSeamDepth  = function () { return _depth; };
  window.__insertSeamInstall = install;   // ★DOM 하네스가 «진짜 이 파일»을 얹고 부르는 자리

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

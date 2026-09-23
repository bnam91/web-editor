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
   ④ ⚠️★2026-09-21 개정 — 이 조항은 «이유»가 뒤집힌 채 남아 있었다. 고쳐 적는다.
      ⛔옛 문장: 「삽입 입구는 돌아온 뒤에 캔버스를 더 바꾸면 안 된다(setTimeout·rAF 금지).
        ensureHistoryCheckpoint 는 «생문자열 !==» 로 재므로(_sameEdit 아님) …」
      ★지금은 둘 다 틀리다:
        · ensureHistoryCheckpoint 는 이제 **_sameEdit 을 쓴다**(js/history.js, 2026-09-21).
        · «돌아온 뒤에 더 바꾸기»는 **금지할 수 없다** — ResizeObserver·MutationObserver 가 쓰는
          값은 «레이아웃이 끝나야» 나온다. 삽입 시점엔 알 수가 없다.
      ⇒ 그래서 규약 ⑤(끝 표본 갱신)가 생겼다. 아래를 같이 읽어라.
      ⛔이 조항을 「느슨해졌으니 비동기로 미뤄도 된다」로 읽지 마라 — 미루는 건 여전히 나쁘고,
        «동기로 펼 수 있으면 편다»가 먼저다. 실측으로 두 자리가 있었다:
        · addTableBlock — flow-frame 경로가 테마적용을 setTimeout 0 으로 미뤘다 ⇒ 동기로 폈다.
        · addStickerBlock — rAF 로 _enterStickerEdit(편집 진입). 그쪽은 «직렬화에서
          세척»되게 했다(contenteditable 은 원래 세척, user-select·cursor 를
          js/io/section-serialize.js 가 같이 걷는다). 두 길 중 «세척»을 고른 이유는
          focus/캐럿이 부착 뒤 틱을 필요로 해서다.
   ⑤ ★끝 표본을 «한 프레임 뒤 값»으로 다시 찍는다 — window.restampHistoryTop(seq).
      왜: 입구는 동기로 돌아오지만 그 뒤 한 프레임 안에 «레이아웃에서 나오는 값»이 더 써진다.
        · ResizeObserver 가 scale·height 를 쓴다 — banner02 · canvas(카드) · comparison
        · MutationObserver 가 ✨버튼을 옮기고 onclick 을 지운다 — js/ai-section-fill.js
        · CSSOM 을 한 번 건드리면 style 문자열이 «공백 넣어» 재직렬화된다 — 텍스트 스티커
      그러면 꼭대기와 라이브가 어긋나 ⌘Z 가 «두 번»이 된다(첫 번째는 화면 무변화 = 먹통 한 칸).
      ⛔«찍기»를 통째로 비동기로 옮기지 마라 — 규약 ①의 노옵 구간이 그 사이 풀린다.
        찍기는 «동기», 값만 뒤에 갱신한다.
      ⛔rAF 두 번으로는 모자라다 — ResizeObserver 콜백은 「렌더링 갱신」 단계에서 rAF 콜백
        «뒤»에 배달된다(실측: sync 4842 · rAF1 4842 · rAF2 4889). rAF×2 «뒤의 매크로태스크»에서 읽는다.
      ⛔restampHistoryTop 은 안전조건 넷 중 하나라도 틀리면 아무것도 안 한다 —
        seq 불일치 / 되돌린 뒤 / 복원 중 / 무변화. 여기서는 «그때의 seq»만 넘긴다.
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

  /* ★★규약 ⑤ — 끝 표본을 «한 프레임 뒤 값»으로 다시 찍는다(새 칸은 안 만든다).
     왜: 입구는 동기로 돌아오지만 그 뒤에 «레이아웃에서 나오는 값»이 더 써진다 —
       ResizeObserver(scale·height) · MutationObserver(✨버튼 이동) · CSSOM 재직렬화(공백).
       그러면 꼭대기와 라이브가 어긋나 undo 첫 스텝이 「현재 상태」 한 칸을 더 만든다
       ⇒ 삽입만 하고 ⌘Z 가 «두 번»(첫 번째는 화면 무변화 = 먹통 한 칸). 2026-09-21 실앱 실측.
     ⛔«찍기»를 통째로 비동기로 옮기지 마라 — ai-section-fill 의 의도된 노옵이 그 사이 풀린다.
       찍기는 동기, «값만» 뒤에 갱신한다.
     ⛔restampHistoryTop 이 안전조건을 스스로 본다(seq 불일치·되돌린 뒤·복원 중·무변화 → 무동작).
       여기서는 «그때의 seq»만 넘긴다 — 그 사이 다른 항목이 쌓이면 갱신이 저절로 취소된다. */
  /** rAF 가 늦거나 «안 돌 때» 갱신을 대신 태우는 마감(ms) — 위 주석의 실측이 근거다. */
  var RESTAMP_FALLBACK_MS = 120;

  function _scheduleRestamp() {
    var tip = (typeof window.getHistoryTip === 'function') ? window.getHistoryTip() : null;
    var seq = tip && !tip.empty ? tip.seq : null;
    if (seq == null || typeof window.restampHistoryTop !== 'function') return;
    var run = function () {
      try { window.restampHistoryTop(seq); }
      catch (e) { console.warn('[insert-history] 끝 표본 갱신 실패:', e); }
    };
    /* ★rAF 두 번으로는 «모자란다» — ResizeObserver 콜백은 「렌더링 갱신」 단계에서
       rAF 콜백 «뒤»에 배달된다. 그래서 rAF2 에서 읽으면 옵저버가 쓰기 «전» 값을 본다.
       실측(2026-09-21, addBanner02Block): sync 4842 · rAF1 4842 · **rAF2 4889** ·
       그 뒤로는 1.7초까지 안 변함 ⇒ rAF 두 번 «뒤의» 매크로태스크에서 읽으면 잡힌다.

       ★★[2026-09-24 T-179] 그런데 rAF 경로«만» 두면 「프레임이 언제 오는가」가 그대로
         「⌘Z 가 한 번인가 두 번인가」가 된다 — 프레임은 «기계 사정»이다.
         ⛔아래 수는 «부하 조건»을 같이 읽어야 한다 — 이 기계는 12코어이고, 잴 때 다른 유닛이
           전수를 돌리고 있었다. 부하를 안 적으면 다음 사람이 재현을 못 한다.
         실측(레포 js/ 세 파일만 크로미움에 얹어 잼, 앱 무접촉 · load average 41~50 · 남의
         chromium 44~47 · 남의 electron 23):
           · 한가할 때            갱신까지 p50 13ms · p90 17~27ms · max 30ms
           · 매 프레임 50ms 막힘   p50 100ms
           · 매 프레임 150ms 막힘  p50 300ms
           · 매 프레임 400ms 막힘  p50 800ms   ← 그 800ms 안에 ⌘Z 를 누르면 «먹통 한 칸»
           · rAF 가 아예 안 돎     영영 안 닿음 ⇒ ⌘Z 가 «항상» 두 번
         ⇒ 그래서 rAF 를 «정답»으로 두되, 그 정답이 늦거나 안 오면 매크로태스크가 먼저
           한 번 찍게 한다. restampHistoryTop 은 스스로 안전조건을 보고(seq 불일치·되돌린
           뒤·복원 중·무변화 → 무동작) «꼭대기의 canvas 만» 라이브로 되쓰므로 두 번 불려도
           칸이 늘지 않는다 — 늦게 오는 rAF 쪽이 «더 정확한 값»으로 덮는다.
         ⛔되돌리기 설정(retries)을 올려 검사만 초록으로 만드는 길로 가지 않는다 — 위 수가
           말하는 것은 계측기 흔들림이 아니라 «사람도 밟는 창»이다.

       ★★[2026-09-24 정정 — 부하를 «적고» 다시 재서 앞 판단 둘을 뒤집는다]
         처음엔 부하를 안 적고 쟀고, 그 판에서 두 가지를 틀리게 적었다:
         ⑴ ⛔「CPU 스로틀은 이 수를 거의 안 움직였다」 — 틀렸다. «한가할 때» 안 움직인 것이다.
            load 41~50 에서 다시 재니 스로틀이 그대로 먹었다(rate 10 → p90 159ms · rate 20 →
            p90 144ms · rate 1 → p90 17ms).
         ⑵ ⛔★「사람에게는 안 난다(0/24)」 — 틀렸다. 그때 부하가 낮았다.
            load 165~210(12코어)에서 다시 재니 «고치기 전»이 24번 중 **2번** 「⌘Z 두 번」을
            냈다(매 프레임 150ms 막힘 + ⌘Z 300ms 에 1번, 400ms 막힘 + ⌘Z 500ms 에 1번.
            그 두 번 다 «갱신이 아예 안 닿은» 회차였다). 같은 부하에서 «고친 뒤»는 24번 중 0번.
            갱신이 닿는 시각도 898ms→463ms · 416ms→205ms 로 당겨졌다.
         ⇒ ★그러니 이 마감 대비책은 «증상 가리기»가 아니다 — 사람 쪽에서 실제로 열린 창을
           닫는다. ⛔그리고 「부하를 안 적은 수」는 뒤집힐 수 있다는 것이 이 자리의 본보기다. */
    if (typeof requestAnimationFrame === 'function') {
      var rafLanded = false;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { setTimeout(function () { rafLanded = true; run(); }, 0); });
      });
      /* ★이 수가 하는 말 — 「한가한 기계의 p90(≈27ms)보다 넉넉히 뒤, 사람이 ⌘Z 를 누를 수
         있는 때보다 앞」. ⚠️사람의 반응 시간은 «안 쟀다» — 고른 값이지 잰 값이 아니다. */
      setTimeout(function () { if (!rafLanded) run(); }, RESTAMP_FALLBACK_MS);
    } else { run(); }
  }

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
              /* ★[2026-09-22] 끝 표본 «갱신»은 «이 호출이 칸을 실제로 만들었을 때만» 건다.
                 왜: restampHistoryTop 은 «꼭대기 항목의 canvas 를 라이브로 되쓴다». 칸이 안
                 생겼으면 그 꼭대기는 «남의 항목»이고, 되쓰면 그 항목이 가리키던 상태가 사라진다.
                 실측으로 터지는 자리 = js/ai-section-fill.js:446~447 의 «의도된 노옵» 구간이다.
                   거기는 call-site 가 pushHistory('AI 섹션 채우기') 를 1회 찍어 두고
                   window.pushHistory 를 노옵으로 갈아끼운 뒤 addTextBlock 을 N번 부른다
                   (⌘Z 한 번에 채우기 전체가 풀리게 하려는 자리 — 규약 ①).
                   그런데 노옵이라 칸이 «안» 생기는데도 갱신은 그대로 예약돼, 두 프레임 뒤
                   「AI 섹션 채우기」 항목의 canvas 가 «채운 뒤» 라이브로 덮였다.
                   ⇒ ⌘Z 가 그 항목을 건너뛴 것과 같아져 «채우기 전»이 아니라 «그 앞»으로 갔다.
                   실측(앱 무접촉, 진짜 세 파일): 기존 블럭 1 + 채움 3 → ⌘Z ⇒ 0개(1개여야 한다).
                 ⇒ seq 가 안 움직였으면(=칸이 안 생겼으면) 갱신을 예약하지 않는다.
                 ⛔`typeof window.pushHistory === 'function'` 만으로는 못 가른다 — 노옵도 함수다. */
              var _tipBefore = (typeof window.getHistoryTip === 'function') ? window.getHistoryTip() : null;
              var _seqBefore = (_tipBefore && !_tipBefore.empty) ? _tipBefore.seq : null;
              window.pushHistory(LABELS[name] || DEFAULT_LABEL);
              var _tipAfter = (typeof window.getHistoryTip === 'function') ? window.getHistoryTip() : null;
              var _seqAfter = (_tipAfter && !_tipAfter.empty) ? _tipAfter.seq : null;
              if (_seqAfter != null && _seqAfter !== _seqBefore) _scheduleRestamp();
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

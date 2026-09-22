/* ═══════════════════════════════════════════════════════════════════════════
   MODEL UPDATE HISTORY — 모델 커밋 API(update*Block)가 히스토리에 «끝 표본»을
   하나 더 남기게 하는 부품 (T-012 ① · T-130 잔여, 2026-09-22)

   ══ 이 파일이 푸는 문제 ═══════════════════════════════════════════════════
   js/insert-history.js 머리말과 «같은 병, 다른 가족»이다. 한 줄로 적으면:
     pushHistory() 는 «부르는 그 순간 살아있는 캔버스»를 찍는다. 그래서 undo 가 맞으려면
     «동작과 동작 사이마다 표본이 하나씩» 있어야 한다.

   update*Block 26개는 전부 push-before 다 — 「변경 전 캔버스 = undo 타겟」 규약
   (js/blocks/step-block.js 주석 · banner02 패턴). 전수 확인(2026-09-22): 26개 «전부»
   pushHistory 를 정확히 1회 부르고, 그 자리는 dataset 을 쓰기 «전»이다.
   ⚠️세는 자를 조심해라 — 전부 `window.pushHistory?.()` (옵셔널 체이닝) 꼴이라
     /pushHistory\s*\(/ 로 세면 «26개 전부 0건»이 나온다. `\?\.` 를 자에 넣어야 한다.

   그런데 push-before 는 «바로 앞 동작이 push-after 였으면» 같은 상태를 두 번 찍는 꼴이 돼
   js/history.js 의 무변화 차단에 먹힌다. 그러면 그 동작의 «결과»가 스택에 한 번도 안 남는다:
     GIF 적용: 트림 드래그(onUp = push-after)가 S1 을 찍어 둠 → 적용의 push-before 도 S1
               → 차단 → 적용 «뒤» 상태 S2 는 아무도 안 찍음  ⇒ T-012 ①
   ⇒ 입구가 돌아온 «직후»에 표본을 하나 «더한다». ⛔옮기기가 아니다 — 안의 push-before 는
     하나도 안 건드린다(옮기면 이음매가 이사할 뿐이다, js/CLAUDE.md 2026-09-20 회귀 기록).

   ⛔«전수 개종»을 여기에 얹지 마라 — push-before 109자리를 push-after 로 통일하는 것은
     레포가 이미 재고 포기했고(js/CLAUDE.md), 2026-09-20 에 실제로 그 회귀를 냈다
     (「리사이즈 뒤 회전 ⌘Z 가 크기까지 되돌림」). 옳은 규칙은 «통일»이 아니라
     **「모든 동작이 끝 표본을 남긴다」** 하나다.

   ══ 로스터 ═══════════════════════════════════════════════════════════════
   `^update[A-Z][A-Za-z0-9]*Block$` 인 window.* 함수 — 새 블럭 타입이 생겨도 안 썩는다.
   2026-09-22 기준 27개 이름 / 26개 함수(updateDuoBlock 은 updateGridBlock 의 별명이라
   함수는 같고 이름이 둘이다 — 둘 다 감싸도 «부르는 것은 한 번»이라 표본도 한 번이다).
   이 26개는 우측 패널이 아니라 주로 MCP/IPC 도구가 타는 통로다(앱 안의 호출부는
   js/props/prop-table.js 한 자리뿐 — 2026-09-22 전수). ⇒ 직렬화 추가 비용이
   드래그·슬라이더 같은 «초당 여러 번» 경로에 걸리지 않는다.

   ══ 규약 (⛔insert-history 와 «같은» 넷 + 이 파일만의 하나) ═══════════════
   ① `window.pushHistory` 는 «부를 때» 읽는다. ⛔변수로 미리 잡지 마라.
      js/ai-section-fill.js 가 window.pushHistory 를 «노옵으로 갈아끼운 뒤» 입구를 N번 부른다
      (한 번의 ⌘Z 로 전체가 롤백되게 하려는 «의도된» 자리). 시작할 때 캡처하면 그 의도가 깨진다.
   ② 끝 표본은 `finally` 에서 찍고 «예외는 안 삼킨다».
      ⚠️롤백 경로(js/blocks/grid-block.js restore(before) — 렌더 실패 시 되돌린다)가 있어도
        안전하다: 롤백하면 라이브가 «변경 전»으로 돌아가는데 그건 안의 push-before 가 이미
        찍은(혹은 꼭대기와 같은) 상태라 무변화 차단이 삼킨다 ⇒ 롤백 상태가 칸이 되지 않는다.
        같은 이유로 «인자 검증 실패 → 이른 return» 도 칸을 안 만든다.
   ③ 중첩은 «깊이 0 일 때만» 찍는다 — 한 입구가 다른 입구를 불러도 바깥 하나만 남는다.
   ④ ★삽입 래퍼가 도는 «중»에는 안 찍는다 — js/insert-history.js 의 __insertSeamDepth 로 본다.
      add*Block 안에서 update*Block 이 불리면, 여기서 찍는 표본은 «반쯤 조립된 블럭»이 되고
      그게 ⌘Z 한 칸이 된다. 삽입의 끝 표본은 삽입 래퍼가 «다 끝난 뒤» 찍는 것이 정본이다.
      (2026-09-22 기준 실제로 그런 중첩은 없다. 생겼을 때 조용히 틀리지 말라고 미리 막는다.)
   ⑤ 끝 표본 «갱신»(restampHistoryTop)은 «이 호출이 칸을 실제로 만들었을 때만» 건다 —
      seq 가 움직였는지로 본다. 안 만들었으면 꼭대기는 «남의 항목»이고, 되쓰면 그 항목이
      가리키던 상태가 사라진다. ⛔`typeof window.pushHistory === 'function'` 만으로는
      못 가른다 — 노옵도 함수다. (같은 고침이 js/insert-history.js 에도 들어갔다.)

   ══ 값 ═══════════════════════════════════════════════════════════════════
   커밋 1회당 getSerializedCanvas() 가 1회 → 2회. 직렬화 실측 p50 3.9ms / p90 53.4ms /
   max 79.2ms(827KB·1081요소, js/drag-history.js). 위 「로스터」대로 이 통로는
   초당 여러 번 도는 자리가 아니라 꼬리가 사용자 체감에 닿지 않는다.

   ⛔플레인 스크립트다(ESM 아님). index.html 의 js/insert-history.js «다음»에 둔다 —
     규약 ④ 가 window.__insertSeamDepth 를 읽는다. 설치는 DOMContentLoaded 에서 한다
     (module 대입이 그때면 전부 끝나 있다 — js/insert-history.js 머리말과 같은 까닭).
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /** 이 패턴에 맞는 window.update* 는 «자동으로» 로스터다 — 새 블럭 타입이 생겨도 안 썩는다. */
  var MATCH = /^update[A-Z][A-Za-z0-9]*Block$/;
  /** 패턴 밖인데 «모델 커밋»인 것 — 손으로 더한다. */
  var EXTRA = [];
  /** 패턴에 걸리지만 «모델 커밋이 아닌» 것 — 이유를 «반드시» 같이 적는다.
      (2026-09-22 전수: 패턴에 걸리는 27개 이름이 전부 모델 커밋이라 지금은 비어 있다.) */
  var DENY = {};
  /** 되돌리기 버튼 툴팁용 라벨(cosmetic). 없으면 기본값. */
  var LABELS = {
    updateAssetBlock: '이미지 수정', updateShapeBlock: '도형 수정', updateGridBlock: '그리드 수정',
    updateDuoBlock: '그리드 수정', updateTableBlock: '표 수정', updateStepBlock: '스텝 수정',
    updateChatBlock: '대화 수정', updateStickerBlock: '스티커 수정', updateGradientBlock: '그라데이션 수정',
    updateIconifyBlock: '아이콘 수정', updateMockupBlock: '목업 수정', updateCanvasBlock: '카드 수정',
    updateBanner02Block: '배너 수정', updateComparisonBlock: '비교 수정'
  };
  var DEFAULT_LABEL = '블럭 수정';

  var _depth = 0;          // ★재진입 깊이 — 바깥 하나만 찍는다(규약 ③)
  var _roster = [];

  /* 규약 ⑤ 의 뒷부분 — 한 프레임 뒤 값으로 꼭대기를 되쓴다(새 칸은 안 만든다).
     ⛔타이밍을 당기지 마라: ResizeObserver 콜백은 「렌더링 갱신」 단계에서 rAF 콜백 «뒤»에
       배달된다(실측 sync 4842 / rAF1 4842 / rAF2 4889 — js/insert-history.js 머리말).
       rAF 두 번 «뒤의» 매크로태스크에서 읽어야 잡힌다.
     ⛔restampHistoryTop 은 안전조건 넷(seq 불일치·되돌린 뒤·복원 중·무변화)을 스스로 본다. */
  function _scheduleRestamp() {
    var tip = (typeof window.getHistoryTip === 'function') ? window.getHistoryTip() : null;
    var seq = tip && !tip.empty ? tip.seq : null;
    if (seq == null || typeof window.restampHistoryTop !== 'function') return;
    var run = function () {
      try { window.restampHistoryTop(seq); }
      catch (e) { console.warn('[model-update-history] 끝 표본 갱신 실패:', e); }
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { setTimeout(run, 0); });
      });
    } else { run(); }
  }

  function wrap(name, fn) {
    if (fn.__modelUpdateWrapped) return fn;
    function modelUpdateWrapped() {
      _depth++;
      try {
        return fn.apply(this, arguments);
      } finally {
        _depth--;
        if (_depth === 0) {
          try {
            /* 규약 ④ — 삽입 래퍼가 도는 중이면 여기서 안 찍는다(반쯤 조립된 블럭이 칸이 된다). */
            var insDepth = (typeof window.__insertSeamDepth === 'function') ? window.__insertSeamDepth() : 0;
            /* 규약 ① — «부를 때» 읽는다. 시작할 때 붙잡으면 ai-section-fill 의 의도된 노옵이 깨진다. */
            if (insDepth === 0 && typeof window.pushHistory === 'function') {
              /* 규약 ⑤ — 칸이 «실제로» 생겼을 때만 갱신을 예약한다(노옵도 함수라 typeof 로는 못 가른다) */
              var tipBefore = (typeof window.getHistoryTip === 'function') ? window.getHistoryTip() : null;
              var seqBefore = (tipBefore && !tipBefore.empty) ? tipBefore.seq : null;
              window.pushHistory(LABELS[name] || DEFAULT_LABEL);
              var tipAfter = (typeof window.getHistoryTip === 'function') ? window.getHistoryTip() : null;
              var seqAfter = (tipAfter && !tipAfter.empty) ? tipAfter.seq : null;
              if (seqAfter != null && seqAfter !== seqBefore) _scheduleRestamp();
            }
          } catch (e) { console.warn('[model-update-history] 끝 표본 실패:', name, e); }
        }
      }
      /* 규약 ② — finally 라 입구가 던져도 표본을 남기고, 예외는 그대로 위로 간다. */
    }
    modelUpdateWrapped.__modelUpdateWrapped = true;
    modelUpdateWrapped.__modelUpdateName = name;
    return modelUpdateWrapped;
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
  window.__modelUpdateRoster = function () { return _roster.slice(); };
  window.__modelUpdateDepth  = function () { return _depth; };
  window.__modelUpdateInstall = install;   // ★DOM 하네스가 «진짜 이 파일»을 얹고 부르는 자리

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

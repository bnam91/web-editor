/* ═══════════════════════════════════════════════════════════════════════════
   DRAG HISTORY — 드래그 제스처가 히스토리에 «시작 상태»를 한 번 남기게 하는 부품
   (0920b-resize-undo · 현빈 2026-09-20 「원 도형 추가 후 최초 리사이즈 → ⌘Z 를
     눌렀는데 크기가 되돌려지는 게 아니라 블록 삽입된 게 사라지는 이슈」)

   ══ 이 파일이 푸는 문제 ═══════════════════════════════════════════════════
   pushHistory() 는 «부르는 그 순간 살아있는 캔버스»를 찍는다. 그래서 스택은
   「상태를 찍은 표본의 줄」이고, ⌘Z 는 «한 칸 앞 표본»으로 되돌린다.
   ⇒ undo 가 맞으려면 «동작과 동작 사이마다 표본이 하나씩» 있어야 한다.

   이 레포엔 부르는 규약이 «두 벌»이고, 둘 다 자기 동작의 한쪽 끝만 찍는다.
     · push-before — 바꾸기 «전»에 찍는다 (block-factory 삽입류)     … 동작의 «시작»을 찍음
     · push-after  — 바꾼 «뒤»에 찍는다  (우측 패널 대다수·드래그 onUp) … 동작의 «끝»을 찍음
   ★실측(2026-09-20, js 전체 기계 분류): push-after 258 · push-before 109 — 어느 쪽도
     «다수파로 통일»할 만한 크기가 아니다(=전수 개종은 이 카드의 사정거리 밖이다).

   각각 «혼자» 쓰면 둘 다 일관된다. 섞이면 이음매에서 둘 중 하나가 난다.
     ⑴ before → after : 두 동작 «사이»의 표본이 «없다» ⇒ ⌘Z 한 번이 둘을 같이 먹는다
          원 삽입(before: 삽입 «전»을 찍음) → 첫 리사이즈(after: 리사이즈 «뒤»를 찍음)
          ⇒ 「원이 100px 로 막 삽입된」 표본이 스택에 단 한 번도 없다
          ⇒ ⌘Z = 리사이즈 + 삽입 «둘 다» 취소 = 현빈이 본 그 증상.
     ⑵ after → before : 같은 상태를 «두 번» 찍는다 ⇒ ⌘Z 한 번이 화면을 안 바꾼다(먹통).

   ══ 그래서 드래그는 «양쪽 끝»을 다 찍는다 ═════════════════════════════════
   드래그 핸들러는 onMove 첫 틱에 «시작 상태»(이 부품), onUp 에 «끝 상태»(기존
   pushHistory 호출 그대로)를 찍는다. 그러면 어느 이웃을 만나도 표본이 빈 칸 없이 이어진다.
     · 앞이 push-before(삽입) 였다면 → 우리 «시작» 표본이 그 빠진 칸을 메운다 ⇒ ⑴ 해소
     · 앞이 push-after 였다면       → 우리 «시작» 표본은 그 «끝» 표본과 같은 상태다
                                      ⇒ history.js 의 무변화 중복 차단이 조용히 버린다 ⇒ ⑵ 해소
   ⇒ 이웃을 «전부 개종시키지 않고» 두 병을 같이 없앤다. 값은 드래그 한 번에 직렬화
     (getSerializedCanvas)가 «한 번 더» 드는 것 — 그것도 드래그 «시작»에 든다.
     ⚠️실측(2026-09-20 · 포트 9387 · 3섹션/237요소/827KB 캔버스 · 줌 40% · ×20):
       p50 3.9ms / p90 53.4ms / max 79.2ms. 판정선(100ms) «아래»지만 꼬리가 굵다 —
       더 무거운 문서에서 드래그 시작이 눈에 띄게 걸리면 여기부터 의심해라.
   ⛔«onUp 의 pushHistory 를 떼고 이리로 옮기는» 꼴로 쓰지 마라 — 그러면 규약이 통일된 게
     아니라 이음매가 옮겨갈 뿐이라, 고친 드래그 뒤에 «안 고친» push-after 가 오는 순간
     ⑴ 이 그대로 재발한다(2026-09-20 이벨류에이터 실측으로 확인된 회귀다).

   ══ 쓰는 법 — 호출부는 세 줄이다 ═══════════════════════════════════════════
       const _hist = window.beginDragHistory?.('도형 크기');   // mousedown 안에서 1회
       function onMove(ev) {
         ... dx, dy 를 «캔버스 좌표»로 구한 다음 ...
         _hist?.arm(dx, dy);          // ★첫 실제 이동 직전 1회 — «반환값으로 early-return 하지 마라»
         ... 기존 쓰기 그대로 ...
       }
       function onUp() { ... window.pushHistory?.('도형 크기'); ... }   // ←기존 호출 «유지»

   ⚠️규약 셋 — 어기면 조용히 틀린다.
     ⑴ dx/dy 는 «캔버스 좌표»다(화면 델타 ÷ scale). 화면 px 로 재면 40% 줌에서 임계가
        2.5배로 커진다(현빈 실사용 줌이 40%다).
     ⑵ ⛔arm() 의 반환값으로 쓰기를 «막지» 마라. 예전 판은 `if (!arm()) return;` 이었는데
        그러면 임계 미만 틱에서 «히스토리뿐 아니라 리사이즈 자체»가 사라진다 — 줌 150%
        에서 화면 1px 드래그(=캔버스 0.67px)가 아무 일도 안 하는 회귀가 실측됐다.
        그래서 지금 기본 임계는 0 이고(=«움직이기만 하면» 연다), 반환값은 참고용이다.
     ⑶ 한 제스처에 이 부품은 «하나»다. mousedown 에서 만들고 onMove 안에서 만들지 마라
        (틱마다 새로 열려 항목이 쌓인다).
   ⛔플레인 스크립트다(ESM 아님) — sticker-select.js·asset-rotate.js·annotation-select.js 가
     `<script src>` 라 import 로 못 묶는다. 선례: js/io/section-serialize.js.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /** 기본 임계 = 0 캔버스px. 「움직이기만 하면 연다」. ⚠️0 이 아닌 값을 주면 그 미만 틱은
   *  기록이 «안» 열린다 — 그래도 호출부는 쓰기를 마저 해야 한다(규약 ⑵). */
  var DEFAULT_MIN_PX = 0;

  /* ★«시작 표본»을 한 번 찍는다 — 드래그뿐 아니라 «한 번에 끝나는 동작»(오버레이 토글 등)도
     같은 규약으로 양쪽 끝을 찍을 수 있게 따로 뺀다(2026-09-20 int/0920b QA 반영).
     ⛔사본을 만들지 마라 — arm() 과 토글 호출부가 «이 함수 하나»를 쓴다.
     ★라벨은 «직전 항목의 이름»을 물려받는다. 이 표본이 가리키는 되돌리기는 «이 동작»이
       아니라 «이 동작 직전에 끝난 동작»이기 때문이다(undo 버튼 툴팁 =
       historyStack[pos].action 인데 실제로 복원되는 건 [pos-1] 이다 — js/history.js
       _updateUndoRedoBtns). 삽입 → 드래그 순서에서 「실행 취소: 도형 추가」로 정확히 뜬다.
       꼭대기를 못 읽으면(초기 로드·테스트 하네스) 넘겨받은 이름으로 떨어진다. */
  function pushStartSample(label) {
    if (typeof window === 'undefined' || typeof window.pushHistory !== 'function') return;
    var prev = null;
    try { prev = window.getHistoryTip && window.getHistoryTip().action; } catch (_) { prev = null; }
    if (prev) window.pushHistory(prev);
    else if (label) window.pushHistory(label);
    else window.pushHistory();
  }

  /**
   * 드래그 제스처 하나에 붙는 «시작 상태» 적재기를 만든다.
   * @param {string} [label] 이 드래그의 이름(onUp 의 pushHistory 라벨과 같은 값을 준다)
   * @param {{minPx?:number}} [opts] minPx = 이 «캔버스 px» 이상 움직여야 기록을 연다(기본 0)
   * @returns {{arm:(dx:number,dy:number)=>boolean, armed:boolean}}
   */
  function beginDragHistory(label, opts) {
    var o = opts || {};
    var minPx = (typeof o.minPx === 'number' && isFinite(o.minPx) && o.minPx >= 0)
      ? o.minPx : DEFAULT_MIN_PX;
    var armed = false;

    function arm(dx, dy) {
      if (armed) return true;
      var x = Number(dx), y = Number(dy);
      if (!isFinite(x)) x = 0;
      if (!isFinite(y)) y = 0;
      /* ⚠️«완전 정지»(0,0)는 임계가 0 이어도 열지 않는다 — mousemove 는 델타 0 으로도 온다.
         (맨클릭이 만든 빈 항목은 history.js 무변화 차단이 또 한 겹 막는다.) */
      if (x === 0 && y === 0) return false;
      if (minPx > 0 && Math.sqrt(x * x + y * y) < minPx) return false;
      armed = true;
      pushStartSample(label);
      return true;
    }

    return {
      arm: arm,
      get armed() { return armed; },
    };
  }

  if (typeof window !== 'undefined') {
    window.beginDragHistory = beginDragHistory;
    window.pushHistoryStartSample = pushStartSample;
  }
})();

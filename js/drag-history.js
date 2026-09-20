/* ═══════════════════════════════════════════════════════════════════════════
   DRAG HISTORY — 드래그 제스처가 히스토리를 «바꾸기 «전»에 한 번» 찍게 하는 부품
   (0920b-resize-undo · 현빈 2026-09-20 「원 도형 추가 후 최초 리사이즈 → ⌘Z 를
     눌렀는데 크기가 되돌려지는 게 아니라 블록 삽입된 게 사라지는 이슈」)

   ★왜 있나 — 이 레포의 히스토리 규약이 «두 벌»이었다.
     · push-before(다수파, block-factory 40+자리): 바꾸기 «전»에 pushHistory() → 삽입
     · push-after(드래그류):                        onUp 에서 바꾼 «뒤»에 pushHistory()
     각각 «혼자» 쓰면 둘 다 일관된다. ★섞이면 그 이음매에서 «항목 한 칸이 통째로 빈다».

       clearHistory()             stack=[S0]                    pos=0
       원 삽입(push-before)       push(B=원 «없는» 캔버스)→삽입  stack=[S0,B]   pos=1
       첫 리사이즈(push-after)    드래그(기록 0) → onUp 에서
                                  push(A=원+확대 캔버스)         stack=[S0,B,A] pos=2  live===A
       ⌘Z  ├ ensureHistoryCheckpoint → live===stack[2] 라 «아무것도 안 쌓인다»
           └ pos-- → 1 → restoreSnapshot(B) = 원이 «없는» 캔버스  ⇒ 삽입이 사라진다

     즉 「원이 100px 로 «막 삽입된» 상태」라는 스냅샷이 스택에 단 한 번도 없다.
     ⌘Z 한 번이 «리사이즈 + 삽입» 두 동작을 한꺼번에 먹는다.
     둘째 리사이즈부터는 [...,A1,A2] 라 ⌘Z 가 A1 으로 정확히 돌아간다 —
     현빈이 「«최초»에」 라고 짚은 이유가 이 모델로 설명된다.

   ⇒ 정본을 «다수파»(push-before)로 통일한다. 드래그는 「첫 실제 이동 «직전»」에 1회 찍는다.
     이 관용구는 이미 이 레포에 산다(js/overlay-handles.js _onZoomResizeMouseDown 등 4자리,
     그리드 거터 1713/1761). 여기 모아 둘 뿐 새로 발명한 게 아니다.

   쓰는 법 — 호출부는 두 줄이다.
       const _h = window.beginDragHistory?.('도형 크기');        // mousedown 안에서 1회
       function onMove(ev) {
         ... dx, dy 를 «캔버스 좌표»로 구한 다음 ...
         if (_h && !_h.arm(dx, dy)) return;                      // ★첫 arm 에서만 pushHistory
         ... 기존 쓰기 ...
       }
       function onUp() { ...pushHistory 호출 «없음»... }

   ⚠️규약 셋 — 어기면 조용히 틀린다.
     ⑴ dx/dy 는 «캔버스 좌표»다(화면 델타 ÷ scale). 화면 px 로 재면 40% 줌에서 임계가
        2.5배로 커져 첫 미세 이동이 «기록 없이» 새어 나간다(현빈 실사용 줌이 40%다).
     ⑵ arm() 이 true 를 돌려준 «그 틱»에서 기존 쓰기를 반드시 마저 해라 — 임계 미달
        early-return 이 첫 변형까지 삼키면 한 프레임이 사라진다.
     ⑶ 한 제스처에 헬퍼는 «하나»다. mousedown 쪽 push 와 같이 쓰면 항목이 2개가 된다.

   ⛔플레인 스크립트다(ESM 아님) — sticker-select.js·asset-rotate.js·annotation-select.js 가
     `<script src>` 라 import 로 못 묶는다. 선례: js/io/section-serialize.js.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /** 화면 델타가 아니라 «캔버스 델타» 기준의 기본 임계(px). 1 = _onZoomResizeMouseDown 과 같은 값. */
  var DEFAULT_MIN_PX = 1;

  /**
   * 드래그 제스처 하나에 붙는 히스토리 적재기를 만든다.
   * @param {string} [label] 히스토리 항목 이름(undo 버튼 툴팁에 그대로 뜬다)
   * @param {{minPx?:number}} [opts] minPx = 이 «캔버스 px» 이상 움직여야 기록을 연다
   * @returns {{arm:(dx:number,dy:number)=>boolean, armed:boolean}}
   *   arm(dx,dy) → 「이번 틱에 쓰기를 진행해도 되는가」. 처음 true 가 되는 그 호출에서만
   *   pushHistory 를 «1회» 부른다. 이후 호출은 push 없이 true 만 돌려준다.
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
      /* ⚠️«완전 정지»(0,0)는 minPx 가 0 이어도 열지 않는다 — 0 < 0 은 false 라
         임계만으로는 맨클릭이 새어 들어온다. 맨클릭이 항목을 만들면 pushHistory 가
         redo 꼬리를 잘라(history.js: slice(0, historyPos+1)) ⌘Z 뒤 ⌘⇧Z 가 죽는다. */
      if (x === 0 && y === 0) return false;
      if (Math.sqrt(x * x + y * y) < minPx) return false;
      armed = true;
      if (typeof window !== 'undefined' && typeof window.pushHistory === 'function') {
        window.pushHistory(label || '드래그');
      }
      return true;
    }

    return {
      arm: arm,
      get armed() { return armed; },
    };
  }

  if (typeof window !== 'undefined') window.beginDragHistory = beginDragHistory;
})();

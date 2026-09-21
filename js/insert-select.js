/* ═══════════════════════════════════════════════════════════════════════════
   INSERT SELECT — 「블럭을 넣으면 파란 선택 표시와 우측 패널이 «새 블럭»으로 따라간다」를
   삽입 입구 «전부»에 대해 한 자리에서 보장하는 부품
   (T-084 · 2026-09-20 «사용자 관점 훑기» → 2026-09-22 후속)

   ══ 이 파일이 푸는 «남은» 문제 ════════════════════════════════════════════
   T-084 의 1차 고침(4693c0d)은 js/block-edit.js 의 selectBlock 을 고쳤다 —
   선택 해제를 «정본 한 자리»(js/editor.js clearSelectionMarks)로 모아서, 배너 «줄»을
   고른 채 블럭을 넣어도 옛 파란 줄이 남지 않게. 그건 맞았다.
   ⛔그런데 그 고침은 «selectBlock 을 부르는 입구»에만 닿는다.
     2026-09-22 실측(9639, 앱 실행): 삽입 입구 41자리 중 «새 블럭을 고르지 않는» 자리가 12개였다.
       addAssetBlock · addGapBlock · addGradientBlock · addIconCircleBlock · addIconTextBlock ·
       addIconifyBlock · addJokerBlock · addLabelGroupBlock · addLinerBlock · addMockupBlock ·
       addSpeechBubbleBlock · addVectorBlock
     그 12자리에서는 넣은 «뒤»에도
       · 새 블럭에 테두리가 «안» 붙고(카드 ④),
       · 우측 패널이 옛 블럭/섹션 것 그대로거나(카드 ⑤),
       · addGradientBlock 은 옛 배너 줄의 파란 표시가 «그대로 남았다»(카드 ③ 그 자체).
   ⇒ 입구마다 `window.selectBlock?.(block.id)` 한 줄을 «12번 더» 적으면 13번째 입구가 생길 때
     또 빠진다. 그래서 «입구를 자동으로 로스터로 잡는» 자리에서 한 번에 한다.
     선례이자 로스터의 정본 = js/insert-history.js(T-131).

   ══ 규약 ═══════════════════════════════════════════════════════════════════
   ① 로스터를 «베껴 적지 않는다». window.__insertSeamRoster() 한 곳에서 받는다.
      ⛔여기에 MATCH/EXTRA 를 다시 적으면 목록이 둘이 되고 한쪽이 낡는다.
      ⇒ 이 파일의 script 태그는 js/insert-history.js «다음»에 와야 한다(게이트가 순서를 잰다).
   ② «입구가 이미 자기 일을 했으면 손대지 않는다» — 새로 생긴 요소 중 하나라도
      `.selected` 면 아무것도 안 한다. 이게 이 부품의 안전장치 전부다.
      왜 그 판정이 맞나: 프레임을 만드는 입구(addFrameBlock·addShapeBlock·addBannerBlock·
      addLinerBlock 의 프레임 경로)는 «블럭이 아니라 프레임»을 고르는 것이 앱의 규약이고
      (js/block-factory.js `ss.classList.add('selected')` 3자리), addSection 은 «새 섹션»을
      고른다. 그 셋 다 «새로 생긴 것»이 선택돼 있으므로 여기서 저절로 비켜간다.
      ⛔「타입 목록을 보고 비켜가기」로 바꾸지 마라 — 그게 T-079·T-084 를 만든 그 구조다.
   ③ 깊이 0 에서만 — 외부 조립자(goditor.buildSection·addSection 안의 addTextBlock·
      스크래치 드롭)가 입구를 N번 불러도 «바깥 한 번»만 고른다.
      안 그러면 AI 섹션 채우기가 블럭을 넣을 때마다 패널이 깜빡인다.
   ④ 고르는 자리도 «정본 한 자리» — window.selectBlock(js/block-edit.js) 을 부른다.
      거기가 clearSelectionMarks(옛 표시 전부) + openPanelForBlock(우측 패널) +
      highlightBlock(좌측 레이어) 를 한 벌로 한다. ⛔여기서 클래스를 직접 붙이지 마라 —
      붙이면 T-084 1차 고침의 «표시 두 벌» 문제가 이 파일 안에서 되살아난다.
   ⑤ 대상은 «잎»이다 — 새로 생긴 것들 중 다른 새 것을 품지 «않는» 블럭.
      addLinerBlock 은 프레임(ss)+라이너(lnr) 둘을 만드는데, 사람이 고치고 싶은 건 라이너다.
      getBlockById 가 받는 것(=`*-block` 클래스 + dataset.type)만 후보다.
   ⑥ 동기다. setTimeout·rAF 로 미루지 마라 — insert-history 규약 ④ 와 같은 이유이고,
      미루면 그 사이 사용자의 다음 클릭이 선택을 뺏긴다.
   ⛔`.selected` 는 저장·내보내기에 안 샌다 — js/io/section-serialize.js 의
     RUNTIME_MARKER_CLS 에 'selected' 가 있어 직렬화에서 벗겨진다. 그래서 이 부품이
     선택을 더 많이 붙여도 배송본/썸네일/히스토리 표본은 그대로다
     (게이트: tests/dom/export-deliverable-leak.dom.spec.js · tests/dom/insert-select-follows.dom.spec.js N-LEAK).

   ══ 기계 게이트 ═══════════════════════════════════════════════════════════
   · tests/unit/insert-select-roster.test.mjs — 로스터를 베껴 적지 않았는가 / script 순서 /
     클래스 직접 붙이기 금지 / 비동기 금지.
   · tests/dom/insert-select-follows.dom.spec.js — 행동(입구 «전수» 로스터 주행) + 음성대조.

   ⛔플레인 스크립트다(ESM 아님). index.html 의 js/insert-history.js «다음» 줄에 둔다.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _depth = 0;      // ★재진입 깊이 — 바깥 하나만 고른다(규약 ③)
  var _roster = [];

  /** 후보 요소 — 「선택될 수 있는 것」이 아니라 「새로 생겼는지 볼 것」. 넓게 잡는다. */
  var CANDIDATE_SEL = '[class*="-block"]';

  function _canvas() { return document.getElementById('canvas'); }

  function _snapshot() {
    var c = _canvas();
    if (!c) return null;
    var set = new Set();
    var list = c.querySelectorAll(CANDIDATE_SEL);
    for (var i = 0; i < list.length; i++) set.add(list[i]);
    return set;
  }

  /** 새로 생긴 것들 — 문서 순서 그대로. */
  function _newcomers(before) {
    var c = _canvas();
    if (!c || !before) return [];
    var out = [];
    var list = c.querySelectorAll(CANDIDATE_SEL);
    for (var i = 0; i < list.length; i++) if (!before.has(list[i])) out.push(list[i]);
    return out;
  }

  /* ★규약 ⑤ — 「고를 수 있는 잎」을 고른다.
     ⛔「무엇이 블럭인가」를 여기서 «다시 판정하지 않는다» — selectBlock 이 실제로 쓰는
       그 판정(js/block-edit.js getBlockById)에 그대로 묻는다. 여기에 조건을 베껴 적으면
       둘이 어긋나는 날 «고를 수 있다고 판단해 놓고 selectBlock 이 false 를 돌려주는»
       조용한 무동작이 된다(2026-09-22 실측으로 실제 그 모양이었다). */
  function _selectableLeaf(newcomers) {
    if (typeof window.getBlockById !== 'function') return null;
    var cands = newcomers.filter(function (el) { return el.id && !!window.getBlockById(el.id); });
    if (!cands.length) return null;
    /* 다른 후보를 «품는» 것은 껍데기다 — 품지 않는 마지막 것이 사람이 방금 만든 그것. */
    var leaves = cands.filter(function (el) {
      return !cands.some(function (o) { return o !== el && el.contains(o); });
    });
    return leaves.length ? leaves[leaves.length - 1] : null;
  }

  function _followSelection(before) {
    var newcomers = _newcomers(before);
    if (!newcomers.length) return;                       // 아무것도 안 넣었다 → 손대지 않는다
    /* ★규약 ② — 입구가 이미 «새로 생긴 것»을 골랐으면 그 뜻을 존중한다(프레임·섹션 규약). */
    for (var i = 0; i < newcomers.length; i++) {
      if (newcomers[i].classList && newcomers[i].classList.contains('selected')) return;
    }
    var target = _selectableLeaf(newcomers);
    if (!target) return;                                 // 고를 수 있는 블럭이 없다 → 손대지 않는다
    /* ★규약 ④ — 「무엇이 선택됐나」는 여기서 정하지 않는다. 정본 한 자리에 맡긴다. */
    if (typeof window.selectBlock === 'function') window.selectBlock(target.id);
  }

  function wrap(name, fn) {
    if (fn.__insertSelectWrapped) return fn;
    function selectWrapped() {
      var before = (_depth === 0) ? _snapshot() : null;
      _depth++;
      try {
        return fn.apply(this, arguments);
      } finally {
        _depth--;
        if (_depth === 0 && before) {
          /* 규약 ② — 입구가 던져도 «넣긴 넣었을» 수 있다. finally 에서 보되 예외는 안 삼킨다. */
          try { _followSelection(before); }
          catch (e) { console.warn('[insert-select] 선택 옮기기 실패:', name, e); }
        }
      }
    }
    selectWrapped.__insertSelectWrapped = true;
    selectWrapped.__insertSelectName = name;
    return selectWrapped;
  }

  function install() {
    /* ★규약 ① — 로스터의 정본은 js/insert-history.js 하나다. 여기서 다시 세지 않는다.
       ⛔없으면 «조용히 0자리»가 된다 — 그래서 시끄럽게 알린다(게이트도 순서를 잰다). */
    if (typeof window.__insertSeamRoster !== 'function') {
      console.warn('[insert-select] 로스터 정본(js/insert-history.js)이 아직 없다 — 선택 따라가기가 0자리로 설치된다');
      _roster = [];
      return;
    }
    var names = window.__insertSeamRoster();
    for (var i = 0; i < names.length; i++) {
      if (typeof window[names[i]] === 'function') window[names[i]] = wrap(names[i], window[names[i]]);
    }
    _roster = names.slice();
  }

  /* 게이트 전용 읽기창 — ⛔쓰기 없음 */
  window.__insertSelectRoster = function () { return _roster.slice(); };
  window.__insertSelectDepth  = function () { return _depth; };
  window.__insertSelectInstall = install;   // ★DOM 하네스가 «진짜 이 파일»을 얹고 부르는 자리

  /* insert-history 가 같은 DOMContentLoaded 에서 «먼저» 설치된다(script 태그 순서).
     그래야 __insertSeamRoster 가 채워져 있다. */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();

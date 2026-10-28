/* ════════════════════════════════════════════════════
   click-swallow.js — «다음 click 한 번 삼키기» 0ms 꼴 한 벌 (고전 스크립트 · window.swallowNextClick)
   ────────────────────────────────────────────────────
   ★왜 있나 (220 CLICK-SWALLOW-IDIOM-COPIED-SIX-TIMES-01 · S5 261028 세기 · 지디 판정)
     끈 뒤 합성 click 을 삼키는 꼴이 19 자리 14 파일에 사본으로 있었다. 창이 셋(0 · 120 · 300ms)이다.
     ⛔창을 하나로 고르지 않는다 — 179 뿌리가 «120ms 창이 다른 대상 click 까지 먹음» 이었다.
     ⇒ 0ms 꼴 13 자리만 여기로 모은다. 120ms 4 · 300ms 2 는 제자리(tests/unit/click-swallow-roster 가 이름으로 센다).
   ★뜻: capture 로 click 한 번을 먹고, 안 오면 다음 틱(setTimeout 0)에 걷는다 — 같은 태스크의 합성 click 만 먹는다.
   ★옵션 = 옛 사본들의 «다름» 그대로(합칠 때 동작을 바꾸지 않으려고 · 걷는 손 셋 = 첫 click · 다음 틱 · 다음 mousedown):
     on              window | document — 어디에 거나(window capture 는 document capture 보다 먼저 돈다)
     immediate       stopImmediatePropagation 도 (sticker-select 옛 꼴)
     preventDefault  기본 true (annotation-select 라벨 편집 끝 옛 꼴만 false)
     untilMousedown  다음 mousedown 에도 걷는다 (sticker-select 옛 꼴)
   ⚠️index.html 에서 이 파일은 부르는 모듈들보다 «먼저» 실린다. 부르는 쪽은 `?.` 없이 부른다 — 없으면 조용히 안 먹는 대신 던진다.
   ════════════════════════════════════════════════════ */
(function (w) {
  function swallowNextClick({ on = w, immediate = false, preventDefault = true, untilMousedown = false } = {}) {
    const done = () => {
      on.removeEventListener('click', eat, true);
      if (untilMousedown) on.removeEventListener('mousedown', done, true);
    };
    const eat = (ev) => {
      ev.stopPropagation();
      if (immediate) ev.stopImmediatePropagation();
      if (preventDefault) ev.preventDefault();
      done();
    };
    on.addEventListener('click', eat, true);
    if (untilMousedown) on.addEventListener('mousedown', done, true);
    setTimeout(done, 0);
  }
  w.swallowNextClick = swallowNextClick;
})(window);

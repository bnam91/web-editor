/* ══════════════════════════════════════════════════════════════════════════
   block-overlap.js — 블록 «겹침»(pullUp). 흐름(flow) 스택에서 블록을 위로 당겨
   바로 위 블록을 파고들게 한다. 사진 위에 글자를 얹는 연출이 주 용도.

   ★새 데이터가 «없다» — 값이자 렌더가 인라인 `style.marginTop` 하나다.
     · 저장       : DOM innerHTML 이 저장본(section-serialize) → 자동
     · HTML 내보내기: cloneNode(true) → clone.innerHTML       → 자동
     · PNG        : 클론을 실제 DOM 에 붙여 브라우저가 레이아웃  → 자동
     ⇒ 저장·불러오기·HTML·PNG 는 내보내기 코드를 «0줄» 고치고 따라온다.

   ⚠️★그러나 «Figma JSON · Design JSON 두 종은 겹침을 싣지 못한다» — 0줄로는 영구히 안 된다.
     export-figma-json.js 는 라이브 DOM 이 아니라 저장 문자열을 DOMParser 로 «오프라인 파싱»해
     순회하고(:889), 섹션 객체가 { id, name, background, bgImage, blocks } 뿐이라 y·height 축이
     아예 없다(:881). z-index·marginTop 참조도 각각 0회. export-design-json.js 도 의미 모델이라
     좌표축이 없다. ⇒ 두 JSON 에서는 겹침이 «없는 것처럼» 나가고 섹션이 그만큼 길어진다.
     이걸 실으려면 스키마에 pullUp 축을 넣고 Figma 플러그인 빌더까지 손대야 한다 — 별건이다.
     (실측: 블록에 style.marginTop 을 쓰는 곳이 없어 자리가 비어 있었다 —
      editor.js:938 은 «지우는» 쪽, banner-block.js:66 은 배너 내부 자식이라 무관.)

   ★앞/뒤(z)는 «일부러» 안 넣었다.
     앱의 기존 앞/뒤(⌘[ ⌘], editor.js:1613)는 z-index 가 아니라 «DOM 순서 재배치»이고
     free-layout 프레임 전용이다. 흐름 스택에서는 DOM 순서가 «위치»까지 정하므로
     순서와 앞뒤를 분리하려면 z-index 가 필요한데, Figma 내보내기는 z-index 를 0회
     참조한다(자식 순서가 곧 앞뒤). 즉 z 를 넣는 순간 «화면과 Figma 가 갈린다».
     ⇒ 1단계는 z 없이. 앞뒤가 필요하면 ⌘↑/⌘↓ 순서 이동으로 대신한다(이미 있는 기능이고
       순서를 바꾸면 저장·내보내기 네 경로가 다 따라온다).

   ★패널 증강은 MutationObserver 로 한다.
     블록 타입별 패널이 20개인데 «디스패치가 최소 4곳»에 흩어져 있다
     (block-edit.js:27 · block-drag.js:606/1373 · layer-panel-items.js …).
     한 곳을 골라 부르면 나머지 경로에서 컨트롤이 «안 뜬다». 패널이 다시 그려지는 것을
     보고 붙이면 경로를 안 가린다. (badge-transform.js 의 «패널 증강» 전례와 같은 자리다.)
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MIN = -600, MAX = 0;
  /* 기존 블록 z 중 가장 높은 것이 .text-block 의 2 다(실측). 그 위 한 칸. */
  var OVL_Z = 3;

  /* 겹칠 수 있는 것 = 섹션 흐름에 «쌓이는» 블록. 갭 블록은 «틈» 자체라 제외한다. */
  var BLOCK_SEL = '.text-block, .asset-block, .icon-circle-block, .table-block, ' +
    '.label-group-block, .graph-block, .divider-block, .bridge-block, .duo-block, ' +
    '.infocard-block, .innercard-block, .icon-text-block, .canvas-block, .banner02-block, ' +
    '.comparison-block, .mockup-block, .vector-block, .step-block, .chat-block, ' +
    '.laurel-block, .icon-block, .frame-block';

  function panel() { return document.querySelector('#panel-right .panel-body'); }

  /* ★겹침의 «단위»는 블록이 아니라 «흐름의 직계 자식»이다.
     에셋 블록은 .row 래퍼 안에 들어가고, 텍스트 블록은 text-frame 래퍼 안에 들어간다.
     블록 자신에 marginTop 을 걸면 래퍼 안에서만 움직여 «아무 일도 안 난다»(실측).
     ⇒ 흐름 컨테이너(.section-inner / .section-merged-part / 흐름 frame-block)의
       직계 자식까지 거슬러 올라가 거기에 건다. block-drag.js 의 dragTarget 과 같은 규칙. */
  function flowUnit(b) {
    if (!b || !b.closest) return null;
    /* ⚠️text-frame 은 «컨테이너»가 아니라 텍스트 블록의 래퍼다 — 단위의 «일부»로 봐야 한다.
       빼먹으면 텍스트 블록의 단위가 자기 자신이 돼 「앞에 아무것도 없다」로 판정된다(실측). */
    var box = b.closest('.section-inner, .section-merged-part, ' +
                        '.frame-block:not([data-free-layout]):not([data-text-frame])');
    if (!box) return null;
    var u = b;
    while (u && u.parentElement && u.parentElement !== box) u = u.parentElement;
    return (u && u.parentElement === box) ? u : null;
  }

  /* 겹침을 걸 수 «있는가» — 판정은 «단위» 기준이다 */
  function eligible(b) {
    if (!b || !b.matches) return false;
    if (!b.matches(BLOCK_SEL)) return false;
    if (b.classList.contains('gap-block') || b.classList.contains('section-block')) return false;
    if (b.closest('.frame-block[data-free-layout]')) return false;   // 자유배치는 left/top 이 위치다
    var u = flowUnit(b);
    if (!u) return false;
    if (u.style.position === 'absolute') return false;
    if (u.classList.contains('gap-block')) return false;
    /* 맨 «첫» 자리는 파고들 상대가 없다(위가 섹션 여백이다) */
    var prev = u.previousElementSibling;
    while (prev && prev.classList.contains('drop-indicator')) prev = prev.previousElementSibling;
    return !!prev;
  }

  function getPull(b) { var u = flowUnit(b); return u ? (parseInt(u.style.marginTop, 10) || 0) : 0; }

  /* 이 단위가 «위로 갈 수 있는 한계» — 섹션 상자를 넘어가면 PNG 캡처가 잘라낸다
     (export-image.js 의 clip y = 섹션 클론 rect.top). 화면·HTML 은 넘쳐 보이는데 PNG 만
     잘려서 셋이 갈린다. ⇒ 애초에 섹션 위로는 못 나가게 막는다. */
  function minPullFor(u) {
    var natural = (u.offsetTop || 0) - (parseInt(u.style.marginTop, 10) || 0);
    return Math.max(MIN, -natural);
  }

  function setPull(b0, v) {
    var b = flowUnit(b0); if (!b) return 0;
    v = Math.max(minPullFor(b), Math.min(MAX, Math.round(v)));
    if (v) {
      b.style.marginTop = v + 'px';
      /* ★당겨 올린 블록은 «통째로» 위에 와야 한다.
         실측: `.text-block` 은 이미 position:relative + z-index:2 를 갖는데 `.row` 래퍼는
         z-index:auto 다. 그래서 사진(row)을 텍스트 위로 당기면 «아래 글자가 배경을 뚫고» 보였다.
         ⇒ 당긴 단위에만 z 를 얹는다.
         ⚠️이게 Figma 와 안 갈리는 이유: «당김»은 언제나 «자기 바로 위» 블록을 파고드는 것이라
           당긴 쪽이 상대보다 항상 DOM 뒤다. z 를 올려도 결과가 DOM 순서와 «같다».
           (Figma 내보내기는 z-index 를 0회 보고 자식 순서만 쓴다 — 그래서 어긋날 수 없다.) */
      /* ★computed 가 relative 여도 «인라인으로» 박는다.
         내보낸 HTML 에는 `.frame-block{position:relative;display:flex;overflow:hidden}` 규칙이
         «한 줄도» 없다(export-html.js 자체 CSS 에 frame-block 0회). 앱에서 relative 였던 건
         css/editor-blocks.css:4 덕분이라, 인라인이 없으면 내보낸 뒤 static 이 되어 z-index 가 죽는다.
         ★플래그(dataset)를 두지 않는다 — 저장본에 실려 다음 로드에서 «이미 처리함»으로 오인되고,
           무엇보다 「새 데이터 0」이 거짓이 된다. marginTop 이 곧 표식이라 그걸로 충분하다. */
      b.style.position = 'relative';
      b.style.zIndex = String(OVL_Z);
    } else {
      b.style.marginTop = '';
      b.style.position = '';
      b.style.zIndex = '';
      if (b.dataset.ovlPos) delete b.dataset.ovlPos;   // 옛 버전이 남긴 것 청소
    }
    return v;
  }

  function selectedBlock() {
    var els = document.querySelectorAll('.selected');
    for (var i = 0; i < els.length; i++) if (eligible(els[i])) return els[i];
    return null;
  }

  /* ── 블록 패널에 「겹침」 한 줄 ────────────────────────────────────────── */
  function addBlockRow(p, b) {
    var wrap = document.createElement('div');
    wrap.className = 'prop-section';
    wrap.id = 'ovl-prop';
    wrap.innerHTML =
      '<div class="prop-section-title">겹침</div>' +
      '<div class="prop-row">' +
        '<span class="prop-label">위로 당기기</span>' +
        '<input type="range" class="prop-slider" id="ovl-slider" min="-400" max="0" step="1">' +
        '<input type="number" class="prop-number" id="ovl-number" min="-600" max="0">' +
      '</div>' +
      '<div class="prop-hint" style="margin-top:2px">⌥↑ / ⌥↓ 로도 조절됩니다 (⇧ 10px). 겹친 아래 블록은 ⌥클릭으로 고릅니다.</div>' +
      '<button class="prop-btn" id="ovl-clear" style="width:100%;margin-top:6px">겹침 없애기</button>';
    p.appendChild(wrap);

    var sl = wrap.querySelector('#ovl-slider');
    var nb = wrap.querySelector('#ovl-number');
    var cur = getPull(b);
    sl.value = Math.max(-400, cur); nb.value = cur;

    function apply(v, push) {
      if (push) window.pushHistory && window.pushHistory('겹침');
      var out = setPull(b, v);
      sl.value = Math.max(-400, out); nb.value = out;
      window.scheduleAutoSave && window.scheduleAutoSave();
    }
    sl.addEventListener('input', function () { apply(+sl.value, false); });
    sl.addEventListener('change', function () { apply(+sl.value, true); });
    nb.addEventListener('change', function () { apply(+nb.value, true); });
    wrap.querySelector('#ovl-clear').addEventListener('click', function () { apply(0, true); });
  }

  /* ── 섹션 패널에 「이 섹션 겹침 해제」 (Bulk Align 과 같은 자리·같은 모양) ── */
  function addSectionRow(p, sec) {
    var seen = [];
    var hit = [].slice.call(sec.querySelectorAll(BLOCK_SEL)).filter(function (b) {
      var u = flowUnit(b);
      if (!u || seen.indexOf(u) >= 0) return false;      // 단위 중복 제거
      if ((parseInt(u.style.marginTop, 10) || 0) === 0) return false;
      seen.push(u); return true;
    });
    var wrap = document.createElement('div');
    wrap.className = 'prop-section';
    wrap.id = 'ovl-sec-prop';
    wrap.innerHTML =
      '<div class="prop-section-title">겹침</div>' +
      '<button class="prop-btn" id="ovl-sec-clear" style="width:100%">이 섹션 겹침 해제' +
        (hit.length ? ' (' + hit.length + '개)' : '') + '</button>' +
      '<div class="prop-hint" style="margin-top:4px">' +
        (hit.length ? '겹쳐 있는 블록 ' + hit.length + '개를 모두 0 으로 되돌립니다.'
                    : '이 섹션에 겹쳐 있는 블록이 없습니다.') + '</div>';
    p.appendChild(wrap);

    var btn = wrap.querySelector('#ovl-sec-clear');
    btn.disabled = hit.length === 0;
    btn.addEventListener('click', function () {
      if (!hit.length) return;
      window.pushHistory && window.pushHistory('섹션 겹침 해제');
      hit.forEach(function (b) { setPull(b, 0); });
      window.scheduleAutoSave && window.scheduleAutoSave();
      window.showSectionProperties && window.showSectionProperties(sec);
    });
  }

  /* ── 패널이 다시 그려질 때마다 붙인다 ───────────────────────────────── */
  var busy = false;
  function enhance() {
    if (busy) return;
    var p = panel(); if (!p) return;
    if (p.querySelector('#ovl-prop, #ovl-sec-prop')) return;   // 이미 붙음
    var b = selectedBlock();
    var sec = document.querySelector('.section-block.selected');
    busy = true;
    try {
      if (b) addBlockRow(p, b);
      else if (sec && !document.querySelector('.selected:not(.section-block)')) addSectionRow(p, sec);
    } finally { busy = false; }
  }

  function boot() {
    var p = panel(); if (!p) { setTimeout(boot, 300); return; }
    new MutationObserver(function () { enhance(); }).observe(p, { childList: true });
    enhance();

    /* ⌥↑ / ⌥↓ — 1px, ⇧ 10px. (실측: ⌥+방향키는 아직 아무 데도 안 쓰인다) */
    document.addEventListener('keydown', function (e) {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      if (e.metaKey || e.ctrlKey) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      var b = selectedBlock(); if (!b) return;
      e.preventDefault();
      var step = e.shiftKey ? 10 : 1;
      window.pushHistory && window.pushHistory('겹침');
      var out = setPull(b, getPull(b) + (e.key === 'ArrowUp' ? -step : step));
      var sl = document.getElementById('ovl-slider'), nb = document.getElementById('ovl-number');
      if (sl) sl.value = Math.max(-400, out);
      if (nb) nb.value = out;
      window.scheduleAutoSave && window.scheduleAutoSave();
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.blockOverlap = { getPull: getPull, setPull: setPull, eligible: eligible };
})();

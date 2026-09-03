/* ══════════════════════════════════════════════════════════════════════════
   block-overlap.js — 블록 «겹침»(pullUp). 흐름(flow) 스택에서 블록을 위로 당겨
   바로 위 블록을 파고들게 한다. 사진 위에 글자를 얹는 연출이 주 용도.

   ★새 데이터가 «없다» — 값이자 렌더가 인라인 `style.marginTop` 하나다.
     · 저장       : DOM innerHTML 이 저장본(section-serialize) → 자동
     · HTML 내보내기: cloneNode(true) → clone.innerHTML       → 자동
     · Figma      : getBoundingClientRect() 기반               → 자동
     ⇒ 내보내기 3종을 «건드리지 않는다». 이게 이 방식을 고른 이유다.
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

  /* 겹칠 수 있는 것 = 섹션 흐름에 «쌓이는» 블록. 갭 블록은 «틈» 자체라 제외한다. */
  var BLOCK_SEL = '.text-block, .asset-block, .icon-circle-block, .table-block, ' +
    '.label-group-block, .graph-block, .divider-block, .bridge-block, .duo-block, ' +
    '.infocard-block, .innercard-block, .icon-text-block, .canvas-block, .banner02-block, ' +
    '.comparison-block, .mockup-block, .vector-block, .step-block, .chat-block, ' +
    '.laurel-block, .icon-block, .frame-block';

  function panel() { return document.querySelector('#panel-right .panel-body'); }

  /* 겹침을 걸 수 «있는» 블록인가 —
     ⑴ 섹션 흐름 안에 있어야 한다(자유배치 프레임 안은 left/top 이 위치라 marginTop 이 무의미)
     ⑵ 자기 자신이 절대배치면 제외
     ⑶ 갭 블록·섹션은 제외 */
  function eligible(b) {
    if (!b || !b.matches || !b.matches(BLOCK_SEL)) return false;
    if (b.classList.contains('gap-block') || b.classList.contains('section-block')) return false;
    if (b.style.position === 'absolute') return false;
    if (b.closest('.frame-block[data-free-layout]')) return false;
    if (!b.closest('.section-inner')) return false;
    /* 섹션의 «첫» 블록은 파고들 상대가 없다(위가 섹션 여백이다) */
    var prev = b.previousElementSibling;
    while (prev && prev.classList.contains('drop-indicator')) prev = prev.previousElementSibling;
    return !!prev;
  }

  function getPull(b) { return parseInt(b.style.marginTop, 10) || 0; }

  function setPull(b, v) {
    v = Math.max(MIN, Math.min(MAX, Math.round(v)));
    if (v) {
      b.style.marginTop = v + 'px';
      /* 겹친 블록은 «통째로» 위에 올라와야 한다. position:static 인 상자의 배경은
         DOM 순서로 칠해지지만 «글자(inline)»는 모든 배경보다 위에 칠해진다 —
         그래서 relative 를 안 주면 «아래 블록의 글자가 위 블록 배경을 뚫고» 보인다.
         ⚠️이미 자리를 잡은 블록(absolute/relative/sticky)은 건드리지 않는다. */
      if (!b.dataset.ovlPos && getComputedStyle(b).position === 'static') {
        b.style.position = 'relative';
        b.dataset.ovlPos = '1';
      }
    } else {
      b.style.marginTop = '';
      if (b.dataset.ovlPos) { b.style.position = ''; delete b.dataset.ovlPos; }
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
    var hit = [].slice.call(sec.querySelectorAll(BLOCK_SEL)).filter(function (b) {
      return getPull(b) !== 0;
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

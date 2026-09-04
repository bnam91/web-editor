/* ══════════════════════════════════════════════════════════════════════════
   block-overlap.js — 블록 «겹침»(pullUp). 흐름(flow) 스택에서 블록을 위로 당겨
   바로 위 블록을 파고들게 한다. 사진 위에 글자를 얹는 연출이 주 용도.

   ★새 데이터가 «없다» — 값이자 렌더가 인라인 `style.marginTop` 하나다.
     · 저장       : DOM innerHTML 이 저장본(section-serialize) → 자동
     · HTML 내보내기: cloneNode(true) → clone.innerHTML       → 자동
     · PNG        : 클론을 실제 DOM 에 붙여 브라우저가 레이아웃  → 자동

   ⚠️★Figma JSON · Design JSON 두 종은 겹침을 «싣지 못한다».
     export-figma-json.js:889 는 라이브 DOM 이 아니라 저장 문자열을 DOMParser 로
     «오프라인 파싱»해 순회하고, 섹션 객체가 { id, name, background, bgImage, blocks } 뿐이라
     y·height 축이 아예 없다(:881). z-index·marginTop 참조도 각각 0회.
     export-design-json.js 도 의미 모델이라 좌표축이 없다.
     ⇒ 두 JSON 에서는 겹침이 «없는 것처럼» 나가고 섹션이 그만큼 길어진다.
       스키마에 pullUp 축을 넣고 Figma 플러그인 빌더까지 손대야 한다 — 별건이다.

   ★앞/뒤(z) 사용자 컨트롤은 두지 않는다.
     ⌘[ · ⌘] 는 z 가 아니라 moveSelectedBlocks(=흐름 «순서» 이동)이고(editor.js:1375-1387)
     ⌘↑ · ⌘↓ 와 같은 일을 한다. 흐름에서는 DOM 순서가 «위치»까지 정하므로
     앞뒤만 따로 바꾸려면 z-index 가 필요한데, 그건 Figma 와 갈린다.
     ⇒ 앞뒤는 순서 이동으로 대신한다.

   ★패널 증강은 MutationObserver 로 한다 — 블록 타입별 패널이 20개인데 디스패치가
     최소 4곳에 흩어져 있다(block-edit.js:27 · block-drag.js:606/1373 · layer-panel-items.js).
     한 곳을 골라 부르면 나머지 경로에서 컨트롤이 안 뜬다.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var FLOOR = -600, MAX = 0;

  /* ★z 는 «85» 다. 3 이 아니다.
     처음엔 「기존 블록 z 중 가장 높은 게 .text-block 의 2」로 잡았는데 그건 «블록 루트»만 잰
     것이었다. `.asset-block` 은 position:relative 인데 z-index 가 «없어»(editor-layout.css:501)
     스태킹 컨텍스트를 안 만들고, 그 자손 z 가 섹션 맥락까지 올라온다 —
       .img-boundary 15 · .img-edit-hint 20 · .sec-bg-proxy 80(editor-blocks.css:267,379,303)
     게다가 일반 스티커가 55(sticker-block.js:226)다. 3 이면 전부에게 진다.
     85 = 스티커(55)·배경프록시(80) «위», 섹션 선택 아웃라인(90)·툴바(100) «아래». */
  var OVL_Z = 85;

  /* 겹칠 수 있는 것 = 섹션 흐름에 «쌓이는» 블록. 갭 블록은 «틈» 자체라 제외한다.
     ★.frame-block 은 넣지 않는다 — flowUnit 의 closest 가 «자기 자신부터» 매칭해
       흐름 프레임을 고르면 컨테이너와 단위가 같아져 영영 판정이 안 된다. */
  var BLOCK_SEL = '.text-block, .asset-block, .icon-circle-block, .table-block, ' +
    '.label-group-block, .graph-block, .divider-block, .bridge-block, .duo-block, ' +
    '.infocard-block, .innercard-block, .icon-text-block, .canvas-block, .banner02-block, ' +
    '.comparison-block, .mockup-block, .vector-block, .step-block, .chat-block, ' +
    '.laurel-block, .icon-block';

  var CONTAINER_SEL = '.section-inner, .section-merged-part, ' +
                      '.frame-block:not([data-free-layout]):not([data-text-frame])';

  function panel() { return document.querySelector('#panel-right .panel-body'); }

  /* 겹침의 «단위» = 흐름의 직계 자식. 에셋은 .row, 텍스트는 text-frame 래퍼 안에 들어가므로
     블록 자신에 marginTop 을 걸면 래퍼 안에서만 움직여 아무 일도 안 난다.
     ★closest 를 «부모부터» 건다 — 자기 자신부터 매칭하면 컨테이너 자신을 골랐을 때 null 이 된다. */
  function flowUnit(b) {
    if (!b || !b.parentElement) return null;
    var box = b.parentElement.closest(CONTAINER_SEL);
    if (!box) return null;
    var u = b;
    while (u && u.parentElement && u.parentElement !== box) u = u.parentElement;
    return (u && u.parentElement === box) ? u : null;
  }

  /* «위로 갈 수 있는 한계» — 섹션 상자를 넘으면 PNG 캡처가 잘라낸다
     (export-image.js:549-553 clip y = 섹션 클론 rect.top). 화면·HTML 은 넘쳐 보이는데
     PNG 만 잘려 셋이 갈린다.
     ★기준을 offsetParent 가 아니라 «가장 가까운 .section-block» 으로 못 박는다 —
       .section-merged-part(editor-canvas.css:324)·.frame-block(editor-blocks.css:5) 이
       둘 다 relative 라 offsetTop 을 쓰면 합친 섹션·프레임 안에서 기준이 갈아탄다. */
  function minPullFor(u) {
    var sec = u.closest('.section-block');
    if (!sec) return FLOOR;
    var cur = parseInt(u.style.marginTop, 10) || 0;
    var natural = (u.getBoundingClientRect().top - sec.getBoundingClientRect().top) - cur;
    var scale = (window.currentZoom || 100) / 100;
    return Math.max(FLOOR, -Math.round(natural / (scale || 1)));
  }

  function eligible(b) {
    if (!b || !b.matches || !b.matches(BLOCK_SEL)) return false;
    if (b.closest('.frame-block[data-free-layout]')) return false;   // 자유배치는 left/top 이 위치다
    var u = flowUnit(b);
    if (!u) return false;
    if (u.style.position === 'absolute') return false;
    if (u.classList.contains('gap-block')) return false;
    var prev = u.previousElementSibling;
    while (prev && prev.classList.contains('drop-indicator')) prev = prev.previousElementSibling;
    return !!prev;   // 맨 «첫» 자리는 파고들 상대가 없다
  }

  function getPull(b) { var u = flowUnit(b); return u ? (parseInt(u.style.marginTop, 10) || 0) : 0; }

  function setPull(b0, v) {
    var b = flowUnit(b0); if (!b) return 0;
    v = Math.max(minPullFor(b), Math.min(MAX, Math.round(v)));
    if (v) {
      b.style.marginTop = v + 'px';
      /* computed 가 relative 여도 «인라인으로» 박는다 — 내보낸 HTML 에는
         `.frame-block{position:relative;…}` 규칙이 한 줄도 없어(export-html.js 자체 CSS)
         인라인이 없으면 static 이 되어 z 가 죽는다. */
      b.style.position = 'relative';
      b.style.zIndex = String(OVL_Z);
    } else {
      b.style.marginTop = '';
      b.style.position = '';
      b.style.zIndex = '';
      if (b.dataset.ovlPos) delete b.dataset.ovlPos;   // 옛 버전이 남긴 것 청소
    }
    if (typeof markLayers === 'function') markLayers();
    return v;
  }

  /* ── 히스토리: «제스처당 1회», 그리고 «변경 전» ──────────────────────────
     pushHistory 는 «현재 캔버스»를 담는다(history.js:38) → 바꾸기 «전»에 불러야 한다.
     그리고 키 리피트마다 부르면 캔버스 전체 직렬화가 반복되고 MAX_HISTORY(50) 를
     금방 채워 «사용자의 실제 작업 이력이 사라진다». 래치로 한 제스처에 한 번만 찍는다. */
  var _latched = false;
  function beginGesture() {
    if (_latched) return;
    _latched = true;
    window.pushHistory && window.pushHistory('겹침');
  }
  function endGesture() { _latched = false; }

  function inCanvas(el) { return !!(el && el.closest && el.closest('#canvas')); }

  function selectedBlock() {
    var els = document.querySelectorAll('#canvas .selected');
    var hit = null, n = 0;
    for (var i = 0; i < els.length; i++) {
      var u = flowUnit(els[i]);
      if (!u) continue;
      if (!els[i].matches(BLOCK_SEL)) continue;
      if (!hit) hit = els[i];
      n++;
    }
    return { el: hit, multi: n > 1 };
  }

  /* ── 블록 패널의 「겹침」 — «한 줄» ──────────────────────────────────────
     겹침은 값 하나다. 바로 위 「좌우 패딩」(prop-section.js:228-232)이 제목+한 줄인데
     제목·안내문·전폭버튼 네 덩이로 158px 을 쓰던 걸 34px 한 줄로 줄인다(현빈 2026-09-04).
     · 단축키 안내 → 라벨 title 툴팁
     · 되돌리기   → 레포에 이미 있는 「초기화」 버튼(prop-asset.js:73 과 같은 클래스) */
  var TIP = '⌥↑ / ⌥↓ 로 조절 (⇧ 10px) · 겹친 아래 블록은 ⌥클릭으로 선택';

  /* 「패딩/레이아웃/크기」류 절을 찾아 그 «안»에 한 줄로 붙인다. 없으면 자기 절을 만든다. */
  function hostSection(p) {
    var secs = [].slice.call(p.querySelectorAll('.prop-section'));
    for (var i = 0; i < secs.length; i++) {
      var t = secs[i].querySelector('.prop-section-title');
      if (!t) continue;
      if (/padding|layout|spacing|size|패딩|레이아웃|간격|크기/i.test(t.textContent || '')) {
        if (secs[i].querySelector('.prop-slider')) return secs[i];
      }
    }
    return null;
  }

  function addBlockRow(p, b) {
    var canPull = eligible(b);
    var cur = getPull(b);
    if (!canPull && cur === 0) return;         // 걸 수도 없고 걸린 적도 없으면 안 띄운다

    var u = flowUnit(b);
    var lo = u ? minPullFor(u) : FLOOR;
    if (cur < lo) lo = cur;                    // 이미 더 내려가 있으면 그 값까지는 보여준다

    var row = document.createElement('div');
    row.className = 'prop-row';
    row.id = 'ovl-prop';
    row.innerHTML =
      '<span class="prop-label" title="' + TIP + '">겹침</span>' +
      '<input type="range" class="prop-slider" id="ovl-slider" min="' + lo + '" max="0" step="1"' +
        (canPull ? '' : ' disabled') + '>' +
      '<input type="number" class="prop-number" id="ovl-number" min="' + lo + '" max="0"' +
        (canPull ? '' : ' disabled') + '>' +
      '<button class="prop-align-btn prop-align-btn--aux" id="ovl-clear" ' +
        'title="겹침을 0 으로 되돌립니다">초기화</button>';
    /* ★「초기화」는 «겹쳐 있을 때만» 띄운다.
       한 줄 폭이 207px 인데 버튼이 47px 을 먹어 슬라이더가 99→48px 로 반토막 난다(실측).
       겹침이 0 이면 초기화는 할 일이 없으므로 숨기면 슬라이더가 폭을 그대로 돌려받는다. */

    var host = hostSection(p);
    if (host) host.appendChild(row);
    else {
      var wrap = document.createElement('div');
      wrap.className = 'prop-section';
      wrap.innerHTML = '<div class="prop-section-title">겹침</div>';
      wrap.appendChild(row);
      p.appendChild(wrap);
    }

    var sl = row.querySelector('#ovl-slider');
    var nb = row.querySelector('#ovl-number');
    var cb = row.querySelector('#ovl-clear');
    sl.value = cur; nb.value = cur;
    cb.style.display = cur ? '' : 'none';

    function apply(v, gesture) {
      if (gesture) beginGesture();
      var out = setPull(b, v);
      sl.value = out; nb.value = out;
      cb.style.display = out ? '' : 'none';
      window.scheduleAutoSave && window.scheduleAutoSave();
    }
    sl.addEventListener('pointerdown', function () { beginGesture(); });
    sl.addEventListener('input',  function () { apply(+sl.value, true); });
    sl.addEventListener('change', function () { apply(+sl.value, true); endGesture(); });
    nb.addEventListener('change', function () { apply(+nb.value, true); endGesture(); });
    cb.addEventListener('click', function () { apply(0, true); endGesture(); });
  }

  /* ── 섹션 패널에 「이 섹션 겹침 해제」 ─────────────────────────────────── */
  function addSectionRow(p, sec) {
    var seen = [];
    var hit = [].slice.call(sec.querySelectorAll(BLOCK_SEL)).filter(function (b) {
      var u = flowUnit(b);
      if (!u || seen.indexOf(u) >= 0) return false;
      if ((parseInt(u.style.marginTop, 10) || 0) === 0) return false;
      seen.push(u); return true;
    });
    var wrap = document.createElement('div');
    wrap.className = 'prop-section';
    wrap.id = 'ovl-sec-prop';
    wrap.innerHTML =
      '<div class="prop-section-title">겹침</div>' +
      '<div class="prop-row">' +
        '<span class="prop-label" title="이 섹션에서 겹쳐 있는 블록을 모두 0 으로 되돌립니다">겹친 블록</span>' +
        '<span style="flex:1;font-size:11px;color:var(--ui-text-dim)">' +
          (hit.length ? hit.length + '개' : '없음') + '</span>' +
        '<button class="prop-align-btn prop-align-btn--aux" id="ovl-sec-clear">초기화</button>' +
      '</div>';
    /* ★Export·Template 절은 «항상 하단»이어야 한다(현빈 2026-08-30, badge-transform.js:249 규약).
       그 앞에 끼워 넣는다. 없으면 맨 뒤. */
    var tail = [].slice.call(p.querySelectorAll('.prop-section')).filter(function (s) {
      var t = s.querySelector('.prop-section-title');
      return t && /Export|Template|내보내기|템플릿/i.test(t.textContent || '');
    })[0];
    if (tail) p.insertBefore(wrap, tail); else p.appendChild(wrap);

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
  function enhance() {
    var p = panel(); if (!p) return;
    if (p.querySelector('#ovl-prop, #ovl-sec-prop')) return;   // 이미 붙음
    var sel = selectedBlock();
    if (sel.multi) return;                                     // 멀티선택은 첫 하나만 움직여 오해를 부른다
    var sec = document.querySelector('#canvas .section-block.selected');
    if (sel.el) addBlockRow(p, sel.el);
    else if (sec && !document.querySelector('#canvas .selected:not(.section-block)')) addSectionRow(p, sec);
  }

  function blocked(e) {
    /* ★#preview-overlay 는 «항상» DOM 에 있다(숨겨진 채) — 존재만 보면 단축키가 통째로 막힌다.
       실제로 «켜져 있는지»를 봐야 한다(실측: 편집 중에도 존재 = true 였다). */
    if (document.body.classList.contains('preview-mode')) return true;
    var pv = document.getElementById('preview-overlay');
    if (pv && pv.offsetParent !== null) return true;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return true;
    var a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return true;
    if (document.querySelector('.text-block.editing, .label-group-block.editing')) return true;
    return false;
  }

  /* ── 레이어 패널 배지 ──────────────────────────────────────────────────
     겹침 값은 «흐름 단위»(.row / text-frame)에 붙는데 레이어 항목은 그 «안의 블록»이다.
     한 .row 에 블록이 여럿이면(레이어의 「Grid」 행 그룹, layer-panel-items.js:518)
     겹친 건 행 하나인데 줄은 여럿이다.
     ⇒ 행 그룹이 있으면 «헤더에만» 붙인다(현빈 2026-09-04). 자식마다 붙이면
       「셋을 따로 조절할 수 있나」로 읽히는데 실제로는 못 한다 — 값이 행 하나에만 있다. */
  function layerBody() { return document.getElementById('layer-panel-body'); }

  function chip(v) {
    var c = document.createElement('span');
    c.className = 'ovl-chip';
    c.textContent = '↑' + Math.abs(v);
    c.title = '이 줄은 위 블록을 ' + Math.abs(v) + 'px 파고들어 있습니다';
    return c;
  }
  /* 타입 라벨 «앞»에 넣는다 — 이름과 타입 사이가 시안에서 고른 자리다 */
  function put(host, v) {
    if (!host || host.querySelector('.ovl-chip')) return;
    var type = host.querySelector('.layer-item-type');
    if (type) host.insertBefore(chip(v), type); else host.appendChild(chip(v));
  }

  function markLayers() {
    var body = layerBody(); if (!body) return;
    [].slice.call(body.querySelectorAll('.ovl-chip')).forEach(function (c) { c.remove(); });
    var done = [];

    /* ⑴ 행 그룹 — 헤더에만 */
    [].slice.call(body.querySelectorAll('.layer-row-group')).forEach(function (g) {
      var row = g._dragTarget;
      if (!row) return;
      var v = parseInt(row.style.marginTop, 10) || 0;
      done.push(row);
      if (v) put(g.querySelector('.layer-row-header'), v);
    });

    /* ⑵ 나머지 줄 — 자기 단위에 값이 있으면 붙인다.
       ★한 .row 에 블록이 여럿이어도 «줄마다» 붙인다 — 실측(2026-09-04): 레이어 패널의
         「Grid」 행 그룹(makeLayerRowGroup, layer-panel-items.js:518)은 **아무 데서도 안 불리는
         죽은 코드**라 그룹 헤더가 «화면에 없다». 대표할 자리가 없으니 첫 줄에만 붙이면
         「왜 첫 번째만」이 되고, 둘째 줄을 골라도 겹침 컨트롤은 뜨는데 배지만 없어 어긋난다.
         ⇒ 컨트롤이 뜨는 줄에는 배지도 뜨게 맞춘다. 그룹이 되살아나면 ⑴이 헤더로 대표한다. */
    [].slice.call(body.querySelectorAll('.layer-item')).forEach(function (it) {
      if (it.closest('.layer-row-children')) return;      // 행 그룹 자식은 헤더가 대표한다
      var t = it._dragTarget; if (!t) return;
      var u = flowUnit(t) || (t.parentElement ? flowUnit(t.parentElement) : null);
      if (!u || done.indexOf(u) >= 0) return;             // 그룹이 이미 대표한 행만 건너뛴다
      var v = parseInt(u.style.marginTop, 10) || 0;
      if (v) put(it, v);
    });
  }

  function boot() {
    var p = panel(); if (!p) { setTimeout(boot, 300); return; }
    new MutationObserver(function () { enhance(); }).observe(p, { childList: true });
    enhance();

    /* 레이어 패널은 buildLayerPanel 이 통째로 다시 그린다(layer-panel.js:27 innerHTML='') →
       그릴 때마다 배지를 다시 찍는다. 직계 childList 만 본다(자식 트리는 한 번에 붙는다). */
    var lb = layerBody();
    if (lb) { new MutationObserver(function () { markLayers(); }).observe(lb, { childList: true }); }
    markLayers();

    /* ⌥↑ / ⌥↓ — 1px, ⇧ 10px.
       ★한글 IME 는 e.altKey 를 먹는다 — 레포가 window._optionKeyHeld 폴백을 유지한다
         (editor.js:1070-1079, :1393 이 같은 패턴). 그대로 따른다. */
    document.addEventListener('keydown', function (e) {
      var alt = e.altKey || window._optionKeyHeld;
      if (!alt || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      if (e.metaKey || e.ctrlKey) return;
      if (blocked(e)) return;
      var sel = selectedBlock();
      if (!sel.el || sel.multi || !eligible(sel.el)) return;
      e.preventDefault();
      beginGesture();                                   // ★제스처당 1회 — 키 리피트에도 안 쌓인다
      var step = e.shiftKey ? 10 : 1;
      var out = setPull(sel.el, getPull(sel.el) + (e.key === 'ArrowUp' ? -step : step));
      var sl = document.getElementById('ovl-slider'), nb = document.getElementById('ovl-number');
      if (sl) { if (out < +sl.min) sl.min = out; sl.value = out; }
      if (nb) { if (out < +nb.min) nb.min = out; nb.value = out; }
      window.scheduleAutoSave && window.scheduleAutoSave();
    }, true);

    document.addEventListener('keyup', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Alt') endGesture();
    }, true);
    window.addEventListener('blur', endGesture);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.blockOverlap = { getPull: getPull, setPull: setPull, eligible: eligible, flowUnit: flowUnit, markLayers: markLayers };
})();

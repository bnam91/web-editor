/* ══════════════════════════════════════════════════════════════════════════
   section-height.js — 섹션 높이 ★표시의 단일 진실원 (현빈 2026-10-07 (다)·(라))
   ───────────────────────────────────────────────────────────────────────────
   (다) 섹션마다 «지금 몇 px 인가» → 캔버스 섹션 머리(.section-hitzone, 라벨 옆) ＋ 우측 패널 그 섹션 절
   (라) 모든 섹션 높이의 ★합계 → 우측 패널 ★맨 위(#rp-height-total)

   ★무슨 «자»로 재나 — `offsetHeight` ★하나뿐이다(measureSectionHeight).
     까닭은 ★추측이 아니라 «내보내기 자신이 그 자를 쓴다»는 사실이다:
       js/io/export-image.js:444  `const secH = clone.offsetHeight;`
                          :466  `outCanvas.height = Math.round(secH);`
     ⇒ 「내보내면 몇 px 인가」의 ★정의 자리가 offsetHeight 다. 현빈이 보고 싶은 수가 바로 그것이다.
   ⛔`getBoundingClientRect().height` 를 쓰면 안 된다 — 캔버스 배율(#canvas-scaler 의
     `transform: scale()`)이 ★곱해져 «조용히 틀린 수»가 보인다. 실측(2026-10-07 · 300px 섹션):
       배율  offsetHeight   rect.height
        40%      300            120
       100%      300            300
       200%      300            600
     ★offsetHeight 는 레이아웃 px 라 조상 transform 에 ★아예 안 속는다.
     (tests/dom/section-height-display.dom.spec.js H1 이 이 선택을 ★잠근다 — 40%·100%·200% 에서 같은 수.)
   ⚠️이 수는 «캔버스 폭에서의» 레이아웃 px 다. 내보내기 폭을 780 으로 줄이면 클론이 축소되어
     세로도 비율대로 따라간다(syncImageBoxesToCaptureWidth) ⇒ 그때 PNG 세로는 이 수와 다르다.
     ★기본 860 = 캔버스 폭이면 같다. 이것이 이 수의 «범위»다.

   ★(라)는 ★파생이다 — (다)가 쓰는 measureSectionHeight ★그 함수를 합계도 쓴다.
     ⛔섹션마다 따로 더하는 «둘째 명부»를 만들지 않는다. 공용 함수를 무력화하면 ★둘 다 빨강이다
     (같은 spec 의 P1 이 그 쌍을 잠근다).

   ★언제 다시 그리나 — «자리 열거»가 아니라 ★구조로 받는다(열거는 마지막 사고까지만 덮는다):
     ⒜ bindSectionHitzone 래퍼 — 섹션 삽입·템플릿·rebindAll(로드·undo/redo·협업)이 전부 이걸 지난다.
        (js/panels/template-system.js · js/scratchpad-link.js 가 이미 같은 수법을 쓴다 — 선례 둘.)
     ⒝ ResizeObserver(섹션마다) — 블록 추가·삭제·리사이즈·패딩·이미지 로드 ★무엇이든 높이가 바뀌면 온다.
     ⒞ MutationObserver(#canvas · childList · ★subtree 없음) — 섹션 추가·삭제·페이지 전환.
        ⛔subtree:true 로 두면 ★내 배지 삽입이 자신을 다시 부른다(무한). 섹션은 #canvas 의 ★직속 자식이다.
   ★배율 변경에는 다시 안 그린다 — offsetHeight 가 안 변하니 그릴 것이 없다. 그 «안 함»이 자의 증거다.

   ★이 배지는 «편집이 아니다»(저장에서 지워진다). 그래서 명부 넷에 이름이 올라가 있다:
     ① js/io/save-load.js      NON_CONTENT_UI_SELECTOR  — 로드 후 걷기 ＋ dirty 필터
     ② js/io/section-serialize.js serializeCleanRoot    — 저장·히스토리·템플릿·협업 세척(①의 계약 짝)
     ③ js/version-diff.js      _localNormSection        — 버전 비교 키
     ④ js/market-merge.js      normSection              — 병합 비교 키
     ＋ js/io/export-css-collect.js EDITOR_ONLY_SEL      — 단독 HTML 로 CSS 누수 금지
   (PNG·단독 HTML 은 `.section-hitzone` 째 걷으므로 따로 적을 것이 없다 —
    js/io/export-html.js:116 · js/io/capture-safety.js:515. ⌘C 글자는 ①에서 ★파생된다 — js/editor.js:1572.)

   ⛔배지를 `.section-label` ★안에 넣지 마라 — 그 textContent 는 ★섹션 «이름»이다(10 자리가 읽는다:
     branch-system.js ×4 · version-diff · market-merge · ai-section-fill · section-search · editor.js ×2 · main.js:5221).
     ★형제»로 둔다(기존 `.section-tags` 와 같은 자리·같은 꼴).

   이 파일은 plain global script (ES module X) — 의존성 없음. section-memo.js 와 같은 계약.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BADGE_CLS  = 'section-height-badge';
  const TOTAL_ID   = 'rp-height-total';
  const PANEL_ID   = 'sec-height-value';          // 우측 패널 «그 섹션» 절의 값 칸(prop-section.js 가 그린다)

  /* ══ ★자 ★하나 ═══════════════════════════════════════════════════════════
     (다)·(라)·패널 칸 ★셋이 이 함수만 부른다. 무력화하면 셋이 같이 빨강이다.
     ⛔다른 자를 끌어오지 마라 — 위 머리말의 배율 실측과 export-image.js:444 가 근거다. */
  function measureSectionHeight(sec) {
    if (!sec || !sec.classList || !sec.classList.contains('section-block')) return null;
    const h = sec.offsetHeight;
    return Number.isFinite(h) ? Math.round(h) : null;
  }

  /* ★이 모듈 ★안»에서도 자를 «window 를 거쳐» 부른다 — 일부러 그렇게 뒀다. ⛔「안쪽은 지역 함수로
     바로 부르면 되지」로 «정리»하지 마라. 까닭:
       ⑴ 바깥 소비자(js/props/prop-section.js)는 window.measureSectionHeight 밖에 길이 없다.
          안쪽이 지역 바인딩을 쓰면 «길이 둘»이 되고, 그 둘이 갈리는 날 캔버스 배지와 패널 칸이
          서로 다른 수를 말한다(값의 출처가 둘 = 둘째 명부).
       ⑵ 그래서 「공용 자 하나」가 ★행위로 재진다 — 그 하나를 0 으로 바꾸면 (다)·(라)·패널이
          ★동시에 0 이 된다. tests/dom/section-height-display.dom.spec.js P1 이 그걸 잠근다.
       ⚠️실측(2026-10-07): 처음엔 안쪽이 지역 함수를 불렀고, 그래서 P1 양성대조가 «빨강이 안 됐다»
         — 자를 바꿨는데 배지는 300px 그대로였다. 그 초록은 「하나로 모았다」의 증거가 ★아니었다.
     폴백(|| measureSectionHeight)은 로드 순서 보호용이다 — window 에 아직 안 붙었어도 돈다. */
  function ruler(sec) {
    const f = (typeof window !== 'undefined' && window.measureSectionHeight) || measureSectionHeight;
    return f(sec);
  }

  /** 캔버스의 섹션들 — #canvas 의 ★직속 자식만(고스트 섹션은 저장·내보내기 밖이라 안 센다). */
  function listSections() {
    const canvasEl = document.getElementById('canvas');
    if (!canvasEl) return [];
    return [...canvasEl.children].filter(
      el => el.classList?.contains('section-block') && !el.hasAttribute('data-ghost')
    );
  }

  /** 합계 — ★파생이다. 위 자를 섹션마다 부른 것의 합, 그 이상 아무것도 아니다. */
  function totalSectionHeight(secs) {
    const list = secs || listSections();
    let sum = 0;
    for (const s of list) {
      const h = ruler(s);                     // ★공용 자 — 위 ruler 머리말 참조
      if (h != null) sum += h;
    }
    return sum;
  }

  /** 섹션 하나의 배지 — 멱등(없으면 만들고, 있으면 ★값(data-h)만 고친다). */
  function renderOne(sec) {
    const h = ruler(sec);                     // ★공용 자
    if (h == null) return null;
    const hz = sec.querySelector(':scope > .section-hitzone');
    if (!hz) return h;                                  // hitzone 이 아직 없다 — ⒜ 래퍼가 곧 다시 부른다
    let badge = hz.querySelector(':scope > .' + BADGE_CLS);
    if (!badge) {
      badge = document.createElement('span');
      badge.className = BADGE_CLS;
      /* 라벨 ★다음 형제. 라벨이 없으면 머리에 둔다(라벨 없는 섹션도 높이는 보여야 한다). */
      const label = hz.querySelector(':scope > .section-label');
      if (label) label.after(badge);
      else       hz.prepend(badge);
    }
    /* ★글자를 «텍스트 노드»로 넣지 않는다 — `data-h` 에 담고 CSS `::after` 가 그린다.
       까닭(2026-10-07 실측, effects-reflection R5 가 잡았다): 텍스트 노드로 넣으면 그 글자가
       ★`.section-block` 의 innerText·textContent 에 섞인다. 섹션의 «글자»를 읽는 쪽에게
       「1400px」이 ★콘텐츠로 보인다 — 게다가 높이는 효과를 켜고 끌 때마다 바뀌므로
       「반사를 켰더니 섹션 글자가 달라졌다」가 된다(R5 가 잠근 불변식을 내가 깼다).
       ⇒ 가상요소 content 는 innerText·textContent 어느 쪽에도 안 들어간다. 보이는 것은 같고
         읽히는 것만 깨끗해진다. ⛔다시 textContent 로 되돌리지 마라. */
    const txt = h + 'px';
    if (badge.dataset.h !== txt) badge.dataset.h = txt;   // 같은 값 쓰기 생략(MutationObserver spam 방지 — save-load.js MUT-01 과 같은 이유)
    return h;
  }

  /** 우측 패널 ★맨 위 합계 ＋ «그 섹션» 절의 값 — 둘 다 위 두 함수에서만 값을 받는다. */
  function renderPanel(secs, total) {
    const totalEl = document.getElementById(TOTAL_ID);
    if (totalEl) {
      const n = secs.length;
      /* ★섹션이 ★0 개면 띠를 ★비운다 — 보여 줄 합계가 없다(「0px · 섹션 0」은 수가 아니라 소음이다).
         ⛔CSS 의 `#rp-height-total:empty { display:none }` 은 ★이 줄이 있어야 뜻이 산다 —
           비우는 코드가 없으면 그 규칙은 ★영영 안 걸리는 장식이다(적는 것 ≠ 갖다 대는 것). */
      if (n === 0) {
        if (totalEl.innerHTML !== '') { totalEl.innerHTML = ''; delete totalEl.dataset.h; }
        return;
      }
      const txt = total + 'px';
      if (totalEl.dataset.h !== txt) {
        totalEl.dataset.h = txt;
        totalEl.innerHTML = '';
        const k = document.createElement('span');
        k.className = 'rp-ht-key';
        k.textContent = '전체 높이';
        const v = document.createElement('span');
        v.className = 'rp-ht-val';
        v.textContent = txt;
        const c = document.createElement('span');
        c.className = 'rp-ht-count';
        c.textContent = '섹션 ' + n;
        totalEl.append(k, v, c);
        totalEl.title = '모든 섹션 높이의 합계 — 내보내기 기준 레이아웃 px(배율 무관)';
      }
    }
    /* 열려 있는 섹션 패널의 「높이」 칸 — 패널은 선택마다 다시 그려지므로 «있을 때만» 고친다.
       (그릴 때의 첫 값은 prop-section.js 가 ★같은 함수로 직접 넣는다 — 값의 출처가 하나다.) */
    const cell = document.getElementById(PANEL_ID);
    if (cell) {
      const sel = typeof window.getSelectedSection === 'function' ? window.getSelectedSection() : null;
      const target = (sel && sel.classList?.contains('section-block')) ? sel
        : secs.find(s => s.id && s.id === cell.dataset.secId) || null;
      if (target) {
        const h = ruler(target);              // ★공용 자
        const txt = h == null ? '—' : h + 'px';
        if (cell.textContent !== txt) cell.textContent = txt;
        if (target.id) cell.dataset.secId = target.id;
      }
    }
  }

  /* ══ 한 번에 다 그린다 — (다)와 (라)가 ★같은 순회·★같은 자에서 나온다 ══════════ */
  function renderSectionHeights() {
    const secs = listSections();
    let total = 0;
    for (const s of secs) {
      const h = renderOne(s);                 // (다) 캔버스
      if (h != null) total += h;              // (라) 는 ★그 수를 그대로 더한 것
      observeSection(s);
    }
    renderPanel(secs, total);                 // (다) 패널 칸 ＋ (라) 합계
    return { count: secs.length, total };
  }

  /* ══ ⒝ ResizeObserver — 높이가 «무슨 까닭으로든» 바뀌면 온다 ══════════════════ */
  let _ro = null;
  const _observed = new WeakSet();
  let _pending = false;

  function _schedule() {
    if (_pending) return;
    _pending = true;
    /* ⛔rAF 를 쓰지 않는다 — 이 앱은 ★비포커스 창에서 rAF 가 멈춘다(js/editor.js:345 · :3146 ·
       js/io/save-load.js adb8618 이 같은 경고를 세 번 적어 뒀다). setTimeout 하나로 족하다. */
    setTimeout(() => { _pending = false; try { renderSectionHeights(); } catch (_) {} }, 0);
  }

  function observeSection(sec) {
    if (!_ro || !sec || _observed.has(sec)) return;
    _ro.observe(sec);
    _observed.add(sec);
  }

  function _initObservers() {
    if (typeof ResizeObserver === 'function' && !_ro) {
      _ro = new ResizeObserver(() => _schedule());
    }
    const canvasEl = document.getElementById('canvas');
    if (canvasEl && !canvasEl.__secHeightMo) {
      /* ⒞ ★subtree 없음 — 섹션은 #canvas 직속이고, subtree:true 면 내 배지 삽입이 자신을 다시 부른다. */
      const mo = new MutationObserver(() => _schedule());
      mo.observe(canvasEl, { childList: true });
      canvasEl.__secHeightMo = mo;
    }
  }

  /* ══ ⒜ bindSectionHitzone 래퍼 — 삽입·템플릿·rebindAll(로드·undo/redo·협업)이 전부 이 길이다.
        js/panels/template-system.js _installSectionTagHook · js/scratchpad-link.js 와 ★같은 수법(선례 둘). ══ */
  function _installHitzoneHook() {
    if (window.__secHeightHookInstalled) return true;
    const orig = window.bindSectionHitzone;
    if (typeof orig !== 'function') return false;
    window.bindSectionHitzone = function (sec) {
      const r = orig.apply(this, arguments);
      /* bindSectionHitzone 은 히트존을 «깊은 복제»해 replaceWith 로 갈아끼운다(js/editor.js:4152)
         ⇒ 배지는 복제본으로 살아남지만 값은 다시 세워야 한다. 멱등이라 그냥 다시 그린다.
         ⛔여기에 그 복제 API 이름을 ★글자 그대로 적지 마라 — tests/unit/export-channel-roster.test.mjs
           의 분모가 js/ 파일을 «주석까지 포함해» 그 낱말로 훑는다(일부러 거친 그물이다). 이 파일은
           캔버스를 ★복제하지 않으므로 그 명부에 들어갈 채널이 아니다. 글자를 적으면 거짓 양성으로
           빨강이 나고, 그걸 끄려고 명부에 «채널 아닌 것»을 손으로 올리게 된다(그 파일 머리말의 ⛔). */
      try { renderOne(sec); } catch (_) {}
      _schedule();                             // 합계는 섹션 수가 바뀌었을 수 있으니 한 번 더
      return r;
    };
    window.__secHeightHookInstalled = true;
    return true;
  }

  function init() {
    _initObservers();
    _installHitzoneHook();
    _schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  /* 모듈(defer)들이 window.bindSectionHitzone 을 세운 ★뒤»에 한 번 더 — 플레인 스크립트가
     먼저 돌아 래퍼 설치가 실패했을 수 있다(template-system.js 가 같은 이유로 같은 재시도를 한다). */
  window.addEventListener('load', init);

  window.measureSectionHeight  = measureSectionHeight;
  window.totalSectionHeight    = totalSectionHeight;
  window.renderSectionHeights  = renderSectionHeights;
  window.listCanvasSections    = window.listCanvasSections || listSections;
})();

/* section-pin.js — 섹션 높이 «고정(핀)» (0.9.12 ⑦ · 현빈 Q10·Q13 · 2026-11-12)
 *   현빈 결정: 편집 화면에서도 고정 높이 그대로(WYSIWYG) · 넘친 블럭은 프레임 안처럼 아래로 쌓여 잘린다 ·
 *   안전장치 = 「숨은 블럭 N개 [전체 보기] [핀 해제]」.
 *
 * ★값 = `sec.style.height`(Hpx) + 표식 `data-height-pin="true"` — 둘 다 저장본(인라인 style·속성)에 그대로 실린다.
 *   켤 때 `minHeight`(바닥 손잡이 값)는 지운다 — min-height 가 height 보다 크면 min 이 이겨 핀이 안 먹는다.
 * ★자르기는 섹션이 아니라 `.section-inner` 다(css/editor-layout.css) — 라벨·툴바·히트존·손잡이는 섹션 자식이라 안 잘린다.
 * ★전체 보기 = 런타임 클래스 `pin-peek` — 저장·히스토리(section-serialize RUNTIME_MARKER_CLS)·캡처(capture-safety EDITOR_STATE_CLS)에서 벗긴다.
 *   섹션 선택이 풀리면 자동으로 끈다(Q13 ⓑ).
 * ★«자르는 선»(cutY) = 섹션 위 + (핀 − 아래패딩) × 배율 — inner 바닥과 같은 자리. 전체 보기 중에도 같은 수를 낸다(숨은 수 세기용).
 *   shortcut: 위 테두리 두께는 안 더한다(섹션에 border 를 쓰는 곳이 없다) · 생기면 borderTop 을 더하라.
 */
(function () {
  'use strict';

  const PEEK = 'pin-peek';
  const isPinned = (sec) => !!sec && sec.dataset?.heightPin === 'true' && /px$/.test(sec.style.height || '');
  const pinH = (sec) => parseFloat(sec.style.height) || 0;

  /** 자르는 선(화면 y). opts.evenPeek 이면 전체 보기 중에도 낸다. 핀 아니면 null. */
  function cutY(sec, opts) {
    if (!isPinned(sec)) return null;
    if (sec.classList.contains(PEEK) && !(opts && opts.evenPeek)) return null;
    const r = sec.getBoundingClientRect();
    const k = (r.width / (sec.offsetWidth || 1)) || 1;
    const padB = parseFloat(getComputedStyle(sec).paddingBottom) || 0;
    return r.top + (pinH(sec) - padB) * k;
  }

  /** inner 안의 «블럭» 목록 — 행이면 그 안 블럭(·col 안), 합친 몸이면 펴서, 아니면 자신. 갭·안내선은 뺀다. */
  function blocksOf(sec) {
    const inner = sec.querySelector(':scope > .section-inner');
    const out = [];
    const walk = (box) => [...box.children].forEach((ch) => {
      if (ch.classList.contains('section-merged-part')) {
        const pi = ch.querySelector(':scope > .section-inner'); walk(pi || ch); return;
      }
      if (ch.classList.contains('drop-indicator') || ch.classList.contains('sp2c-insert-indicator')) return;
      if (ch.classList.contains('row')) ch.querySelectorAll(':scope > *, :scope > .col > *').forEach((b) => { if (!b.classList.contains('col')) out.push(b); });
      else out.push(ch);
    });
    if (inner) walk(inner);
    return out.filter((b) => !b.classList.contains('gap-block') && !b.classList.contains('drop-indicator'));
  }

  /** 숨은 블럭(Q13 ⓐ 일부라도 잘린 것 포함) — 전체 보기 중에도 «핀이면 숨을 것»을 센다. */
  function hiddenBlocks(sec) {
    const cut = cutY(sec, { evenPeek: true });
    if (cut == null) return [];
    return blocksOf(sec).filter((b) => { const r = b.getBoundingClientRect(); return r.height > 0 && r.bottom > cut + 0.5; });
  }

  /** 블럭 상자를 자르는 선에서 자른 사각형(상자선택용). 자를 일 없으면 null. 완전히 숨으면 면적 0. */
  function visibleRect(box, sec) {
    const cut = cutY(sec);
    if (cut == null) return null;
    const r = box.getBoundingClientRect();
    if (r.bottom <= cut) return null;
    const top = Math.min(r.top, cut);
    return { left: r.left, right: r.right, top, bottom: cut, width: r.width, height: cut - top };
  }

  /** 지금 화면에서 완전히 숨었나(전체 보기 중이면 false). */
  function isFullyHidden(el, sec) {
    const cut = cutY(sec || el.closest('.section-block'));
    return cut != null && el.getBoundingClientRect().top >= cut;
  }

  function peek(sec, on) {
    if (!sec) return;
    sec.classList.toggle(PEEK, !!on && isPinned(sec));
    refreshSoon();
  }

  /** 레이어 등에서 숨은 블럭을 골랐을 때 — 보이게 전체 보기를 켠다. */
  function revealFor(el) {
    const sec = el && el.closest && el.closest('.section-block');
    if (!sec || !isPinned(sec) || sec.classList.contains(PEEK)) return false;
    const cut = cutY(sec);
    if (cut == null || el.getBoundingClientRect().bottom <= cut + 0.5) return false;
    peek(sec, true);
    return true;
  }

  /* ★기록은 «변경 전»에 찍는다 — 이 앱 히스토리 규약(section-merge.js 등 · 끝 상태는 ⌘Z 진입 때 ensureHistoryCheckpoint 가 담는다).
     «변경 후»만 찍으면 앞 조작(예: 합치기)의 «전» 스냅샷과 이 조작 사이에 칸이 없어 ⌘Z 한 번이 둘을 같이 푼다(Codex r2 ①). */
  function pin(sec) {
    if (!sec || isPinned(sec)) return;
    window.pushHistory?.();
    const h = sec.offsetHeight;
    sec.style.minHeight = '';
    sec.style.height = h + 'px';
    sec.dataset.heightPin = 'true';
    window.triggerAutoSave?.();
    refreshSoon();
  }

  /** 핀 해제 — Q13 ⓒ 그 높이를 바닥(minHeight)으로 남긴다(내용이 더 크면 내용만큼 늘어난다 = 해제의 뜻). */
  function unpin(sec) {
    if (!sec || !isPinned(sec)) return;
    window.pushHistory?.();          // ★변경 «전»(pin 머리말)
    const h = pinH(sec);
    sec.classList.remove(PEEK);
    sec.style.height = '';
    delete sec.dataset.heightPin;
    sec.style.minHeight = h + 'px';
    unwatch(sec);
    window.triggerAutoSave?.();
    refreshSoon();
  }

  /** 핀 섹션의 «내용 높이»(핀·바닥·전체보기 떼고 잰 offsetHeight) — 손잡이 더블클릭 «내용에 맞춤»이 쓴다. */
  function naturalHeight(sec) {
    const s = sec.style, h = s.height, mh = s.minHeight, pinned = sec.dataset.heightPin, pk = sec.classList.contains(PEEK);
    s.height = ''; s.minHeight = ''; delete sec.dataset.heightPin; sec.classList.remove(PEEK);
    const n = sec.offsetHeight;
    s.height = h; s.minHeight = mh; if (pinned != null) sec.dataset.heightPin = pinned; if (pk) sec.classList.add(PEEK);
    return n;
  }

  /* ── 넘침이 바뀌면 다시 그린다 ─────────────────────────────────────────────
     ★섹션 높이가 고정이라 section-height.js 의 섹션 RO 는 안 온다(Codex 지적) — 핀 섹션은 따로 본다:
       RO = inner 직계 자식(행) «＋ 그 안 블럭»(blocksOf) · MO = inner subtree childList.
       ★행 안 블럭까지 보는 까닭(Codex r1 P2-④): 행에 최소높이가 있으면 안의 글이 커져 아래 블럭이 잘려도 «행» 크기는 그대로다.
       ⛔루프 없음: 콜백은 refreshSoon(한 틱 모음) → 높이 배지·패널만 쓴다(inner 밖) — 관찰 대상 크기를 안 바꾼다.
       비용: 핀 섹션의 블럭 수만큼만 건다(핀 아닌 섹션 0) · 안내선(drop-indicator) 들락날락은 MO 에서 거른다.
     걸기는 section-height 의 그리기 순회가 info() 로 부를 때(로드·⌘Z·삽입 모두 그 길). */
  /* ★관찰은 «핀 섹션마다 한 벌»(Codex r2 ⑤) — 핀이 풀리거나 섹션이 떨어져 나가면 disconnect · 핀 0 이면 관찰 0.
     ★MO 는 style 속성도 본다(Codex r2 ③) — 텍스트 프레임 Y(style.top)·transform 처럼 «크기는 그대로·자리만» 바뀌어 숨는 길. */
  const _obs = new Map();          // sec → { ro, mo, seen:WeakSet }
  let _t = 0;
  function refreshSoon() {
    if (_t) return;
    _t = setTimeout(() => { _t = 0; try { window.renderSectionHeights?.(); } catch (_) {} }, 0);
  }
  function unwatch(sec) {
    const o = _obs.get(sec);
    if (!o) return;
    o.ro.disconnect(); o.mo.disconnect();
    _obs.delete(sec);
  }
  function prune() { for (const sec of [..._obs.keys()]) if (!sec.isConnected || !isPinned(sec)) unwatch(sec); }
  function watch(sec) {
    const inner = sec.querySelector(':scope > .section-inner');
    if (!inner || typeof ResizeObserver !== 'function' || typeof MutationObserver !== 'function') return;
    let o = _obs.get(sec);
    if (o && o.inner !== inner) { unwatch(sec); o = null; }     // inner 가 갈렸다(재렌더) — 새로 건다
    if (!o) {
      const isGuide = (n) => n.nodeType === 1 && (n.classList.contains('drop-indicator') || n.classList.contains('sp2c-insert-indicator'));
      const mo = new MutationObserver((muts) => {
        if (!isPinned(sec) || !sec.isConnected) { unwatch(sec); refreshSoon(); return; }
        const real = muts.some((m) => m.type === 'attributes'
          ? !isGuide(m.target)
          : [...m.addedNodes, ...m.removedNodes].some((n) => !isGuide(n)));
        if (!real) return;
        watch(sec);
        refreshSoon();
      });
      mo.observe(inner, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'transform'] });
      o = { ro: new ResizeObserver(refreshSoon), mo, inner, seen: new WeakSet() };
      _obs.set(sec, o);
    }
    [...inner.children, ...blocksOf(sec)].forEach((c) => { if (!o.seen.has(c)) { o.ro.observe(c); o.seen.add(c); } });
  }

  /** section-height 그리기 순회가 «읽기 단계»에서 부른다 → { pinned, hidden }. 핀 아닌 섹션은 관찰을 걷는다. */
  function info(sec) {
    prune();
    if (!isPinned(sec)) return null;
    watch(sec);
    return { pinned: true, hidden: hiddenBlocks(sec).length };
  }

  /* ── 우측 패널 «높이» 줄의 📌 와 「숨은 블럭 N개 [전체 보기] [핀 해제]」 줄 (prop-section.js 가 그린다) ── */
  function refreshPanel(sec, inf) {
    const btn = document.getElementById('sec-pin-btn');
    if (!btn || !sec || btn.dataset.secId !== sec.id) return;
    const pinned = isPinned(sec);
    btn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
    btn.title = pinned ? '높이 고정 풀기' : '지금 높이로 고정';
    const row = document.getElementById('sec-pin-hidden-row');
    if (!row) return;
    const n = pinned ? (inf ? inf.hidden : hiddenBlocks(sec).length) : 0;
    row.style.display = n === 0 ? 'none' : '';   // .prop-row 가 display:flex 라 hidden 속성은 안 먹는다
    const cnt = row.querySelector('.sec-pin-hidden-n');
    if (cnt && cnt.textContent !== String(n)) cnt.textContent = String(n);
    const pk = row.querySelector('#sec-pin-peek-btn');
    if (pk) pk.setAttribute('aria-pressed', sec.classList.contains(PEEK) ? 'true' : 'false');
  }

  /* ── Q13 ⓑ 섹션 선택이 풀리면 전체 보기를 끈다 — 클릭 «뒤» 한 틱에 본다(선택 처리가 끝난 뒤). ── */
  function sweepPeek() {
    const sel = typeof window.getSelectedSection === 'function' ? window.getSelectedSection() : null;
    document.querySelectorAll('#canvas .section-block.' + PEEK).forEach((sec) => {
      const keep = sel === sec || sec.classList.contains('selected') || !!sec.querySelector('.selected');
      if (!keep) peek(sec, false);
    });
  }
  /* 한 틱 뒤 — 선택 해제 «직후» 같은 태스크에서 새 선택(레이어 클릭 = deselectAll → 블럭 고름)이 끝난 «뒤»에 본다.
     부르는 곳: 문서 click · Escape · ★editor.js deselectAll 끝(Delete 등 클릭 아닌 해제 길 — Codex r2 ④). */
  const sweepSoon = () => setTimeout(sweepPeek, 0);
  document.addEventListener('click', sweepSoon, true);
  document.addEventListener('keyup', (e) => { if (e.key === 'Escape') setTimeout(sweepPeek, 0); }, true);

  window.sectionPin = { sweepSoon, _observedCount: () => _obs.size, isPinned, cutY, hiddenBlocks, visibleRect, isFullyHidden, peek, revealFor, pin, unpin, naturalHeight, info, refreshPanel, sweepPeek, PEEK };
})();

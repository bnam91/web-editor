/* section-bottom-handle.js — 섹션 ★바닥 높이(최소 높이)를 ★끌어서 맞추는 손잡이
 *   (2026-10-25 지디 · 현빈 「기본 섹션에도 아웃라인 핸들을 추가해서 높이를 늘릴 수 있게」
 *    → 「★일단 브랜치 만들어 ★시안만」 · 시안 가지 proto/section-bottom-space-handle)
 *   (2026-10-27 srv-t803 · 현빈 피드백으로 ★뜻을 바꿨다 — 아래 «여백»이 아니라 ★«바닥 높이»)
 *
 *   (2026-10-27 · 현빈 괴롭히기 뒤 dev 로 — 이름에서 proto- 를 뺐다)
 *
 * ═══ ★무엇을 하나 (현빈 261027 · 원문 요지) ═══════════════════════════════════════
 *   「처음 섹션이 280 인데 ★1000 쯤 만들 거라고 ★어림짐작해서 ★핸들로 1080 에 맞춰 두면
 *    ★빈 공간이 800 이다. 100 짜리 블럭을 넣으면 ★높이는 1080 유지 · 빈 공간만 700.
 *    ★블럭이 1080 을 넘어야 ★그제서야 늘어난다」
 *   ⇒ ★섹션 높이 = max(블럭 높이, 손잡이로 맞춘 바닥). ★값 = `sec.style.minHeight` 하나.
 *   · ★빈 공간은 ★늘 맨 아래(섹션은 display:block · 블럭은 .section-inner 에 위부터 쌓인다)
 *   · ★블럭을 지우면 ★바닥으로 돌아간다(min-height 의 성질 그대로)
 *   · ★손잡이로 ★줄이기도 된다 — ★블럭 높이까지(빈 공간 0). ★끝까지 줄이면 ★바닥을 ★없앤다
 *     (현빈 「없앤다」 — 그 뒤 블럭을 지우면 섹션도 같이 준다)
 *   · ★상한 없음(현빈 「상한 없이」)
 *   · ★손잡이 ★더블클릭 = 빈 공간 0(바닥을 없앤다) — 현빈 261027
 *   · ★기존 «아래 여백»(`paddingBottom` · 패널 슬라이더)은 ★따로 남는다 — ⛔손잡이는 안 건드린다
 *
 * ═══ ★왜 `height` 가 아니라 `min-height` 인가 ═════════════════════════════════════
 *   `height` 를 박으면 ★내용이 늘 때 ★조용히 잘린다(`js/overlay-handles.js:3441~3443`).
 *   `min-height` 는 ★바닥만 정하고 ★내용이 넘으면 ★섹션이 는다 ⇒ ★잘림이 ★없다.
 *   ⚠️섹션 `minHeight` 를 ★쓰는 코드는 ★이것이 처음이다(261027 기준 레포 0 건) — ★새 값이다.
 *     ★저장 = 캔버스 클론 innerHTML(`save-load.js` getSerializedCanvas) 이라 ★인라인 style 째 실린다.
 *
 * ═══ ★끌기 끝 click 을 ★삼킨다 (`PROTO-SECBOT-DESELECT-ON-DRAG-01` 처방 ⓐ) ═══════════
 *   ★뿌리 : 누른 곳 = 손잡이(섹션 안) · 놓은 곳 = 섹션 밖이면 click 은 ★공통 조상 #canvas-wrap 에 뜬다
 *     ⇒ `js/editor.js` 캔버스 click 리스너(`['canvas-wrap','canvas-scaler','canvas'].includes(e.target.id)`)
 *       가 ★빈 클릭으로 읽고 deselectAll ⇒ ★우측 패널이 사라졌다.
 *   ★처방 꼴 = 레포 선례 `armClickSwallow`(table-cell-select.js · overlay-handles.js · drag-utils.js 와 같은 꼴).
 *   ⇒ 옛 «끝나고 다시 고르기»(증상 처리)는 ★뺐다.
 *
 * ═══ ★안 한 것 (★일부러) ═══════════════════════════════════════════════
 *   · ★우측 패널 «바닥 높이» 칸 — 현빈 「일단 대기」
 *   · ★여러 섹션 한꺼번에 · ★스냅 · ★수치 뱃지
 */
(function () {
  'use strict';

  const CLS = 'section-bottom-handle';
  const OUT_CLS = 'sbh-out';

  function ensureHandle(sec) {
    if (!sec || sec.querySelector(':scope > .' + CLS)) return;
    const h = document.createElement('div');
    h.className = CLS;
    h.title = '끌어서 섹션 높이를 맞춥니다 — 블럭이 넘으면 늘어납니다 · 더블클릭 = 빈 공간 0';
    sec.appendChild(h);
  }

  /** 바닥 없이 잰 높이(모델 px) — ★블럭이 정하는 높이. 줄이기의 하한이다. */
  function naturalOf(sec) {
    const mh = sec.style.minHeight;
    sec.style.minHeight = '';
    const n = sec.offsetHeight;
    sec.style.minHeight = mh;
    return n;
  }

  /** 끌기 뒤 따라오는 click 하나를 삼킨다 — 레포 선례 armClickSwallow 와 같은 꼴. */
  function armClickSwallow() { window.swallowNextClick({ on: document }); }   // 220 — 0ms 꼴 한 벌(js/click-swallow.js)

  function onDown(ev) {
    if (ev.button !== 0) return;    /* ⛔오른쪽·가운데 버튼으로는 안 끈다(261027 괴롭히기 : 오른쪽 끌기로 바닥이 생겼다) */
    const h = ev.target.closest('.' + CLS);
    if (!h) return;
    const sec = h.closest('.section-block');
    if (!sec) return;
    ev.preventDefault();
    ev.stopPropagation();           /* ⛔섹션 선택·블록 드래그로 새지 않게 */

    const y0 = ev.clientY;
    const mh0 = sec.style.minHeight;
    /* ⑦ 핀 섹션 — 손잡이는 `style.height` 를 끈다 · 내용 밑으로도 줄인다(그래야 자르기가 뜻이 있다) · 하한 = 아래패딩 + 20 */
    const pinned = !!window.sectionPin?.isPinned(sec);
    const ht0 = sec.style.height;
    if (pinned) window.sectionPin.peek(sec, false);   // 전체 보기(height:auto!important) 중엔 끌어도 안 보인다
    const pinMin = pinned ? (parseFloat(getComputedStyle(sec).paddingBottom) || 0) + 20 : 0;
    const h0 = pinned ? (parseFloat(ht0) || sec.offsetHeight) : sec.offsetHeight;    /* 지금 높이 = max(블럭, 바닥) — 넘친 섹션도 «지금»에서 잡는다 */
    const nat = naturalOf(sec);
    /* ★배율을 먹는다 — 캔버스가 40% 면 화면 1px 이 모델 2.5px 다.
       ⛔`window.zoom` 류를 손으로 읽지 마라 — 요소의 실제 배율에서 뽑는다. */
    const scale = sec.getBoundingClientRect().width / (sec.offsetWidth || 1) || 1;
    sec.classList.add('section-bottom-dragging');
    /* ★히스토리 «양쪽 끝»(js/CLAUDE.md 정본 · drag-history.js) — 첫 실제 이동에 시작 표본 · onUp 에 끝 표본.
       (r2 의 «onUp 에서 옛 값 잠깐 되돌려 찍기»는 끝 표본이 없어 redo 꼬리를 못 잘랐다 — Codex r3) */
    const _hist = window.beginDragHistory?.('섹션 높이');

    const onMove = (e) => {
      const dy = (e.clientY - y0) / scale;
      /* ★수평만(ΔY=0) = 높이 무변 — 아무것도 안 쓴다(Codex r4: 바닥 300 < 내용 400 이면 v=h0=내용이라 아래 식이 바닥을 '' 로 «조용히» 지웠다 ·
         시작 표본은 ΔY=0 이라 안 찍혀 ⌘Z 가 앞 조작(합치기)까지 풀었다). */
      if (dy === 0) return;
      const v = Math.round(h0 + dy);
      /* ★블럭 높이까지만 줄인다 · 끝까지 줄이면 바닥을 없앤다(현빈 「없앤다」) · 상한 없음 / ⑦ 핀이면 height · 하한 pinMin */
      const next = pinned ? Math.max(pinMin, v) + 'px' : (v > nat ? v + 'px' : '');
      if (next === (pinned ? sec.style.height : sec.style.minHeight)) return;   // 값이 안 바뀌면 쓰지도 기록하지도 않는다
      _hist?.arm(0, dy);              // ★시작 표본 = «첫 실제 변경» 바로 앞(drag-history 정본) — 이 줄 아래가 쓰기
      if (pinned) sec.style.height = next; else sec.style.minHeight = next;
    };
    const end = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      sec.classList.remove('section-bottom-dragging');
    };
    const onUp = () => {
      end();
      armClickSwallow();
      if (sec.style.minHeight !== mh0 || sec.style.height !== ht0) {
        window.pushHistory?.('섹션 높이');   // 끝 표본(시작 표본은 onMove 첫 틱의 arm)
        window.triggerAutoSave?.();
      }
    };
    /* ★취소(창 전환·터치 취소 등) = 끌기 전으로 되돌린다 · 기록 없음.
       ⛔안 걷으면 버튼을 뗀 뒤에도 마우스를 따라 값이 바뀐다(261027 괴롭히기 ×3 재현). */
    const onCancel = () => { end(); sec.style.minHeight = mh0; sec.style.height = ht0; };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
  }

  /* ★더블클릭 = 빈 공간 0(바닥을 없앤다) — 현빈 261027 「손잡이를 더블클릭하면 빈공간을 0으로」.
     «끝까지 줄이기»와 같은 끝이다. 바닥이 없으면 아무것도 안 한다(기록도 안 쌓는다). */
  function onDblClick(ev) {
    const h = ev.target.closest && ev.target.closest('.' + CLS);
    if (!h) return;
    const sec = h.closest('.section-block');
    if (!sec) return;
    ev.preventDefault();
    ev.stopPropagation();           /* ⛔섹션·블록의 더블클릭(편집 진입 등)으로 새지 않게 */
    /* ⑦ 핀 섹션 — 더블클릭 = 내용 높이에 맞춤(핀 유지 · Q13 ⓓ). 이미 맞으면 기록 없음. */
    if (window.sectionPin?.isPinned(sec)) {
      const nat = window.sectionPin.naturalHeight(sec);
      if (Math.round(parseFloat(sec.style.height)) === nat) return;
      window.sectionPin.histStart('섹션 높이');   // ★양쪽 끝 — 시작 표본(section-pin.js pin 머리말)
      sec.style.height = nat + 'px';
      window.pushHistory?.('섹션 높이');         // 끝 표본
      window.triggerAutoSave?.();
      return;
    }
    if (!sec.style.minHeight) return;
    const prev = window.getHistoryTip?.()?.action;
    window.pushHistory?.(prev || '섹션 높이');   // ★양쪽 끝 — 시작 표본(⑦ 과 같은 규약)
    sec.style.minHeight = '';
    window.pushHistory?.('섹션 높이');            // 끝 표본
    window.triggerAutoSave?.();
  }

  function sweep() {
    document.querySelectorAll('#canvas .section-block:not([data-ghost])').forEach(ensureHandle);
  }

  /* 비킨 손잡이가 아래 섹션 hitzone 밑에 깔리지 않을 틈이 있나. 프레임은 틈이 있을 때만 비킨다(없으면 비켜도 못 잡아 끌기가 죽는다). */
  function roomBelow(sec, r, band) {
    const hz = sec.nextElementSibling?.querySelector?.(':scope > .section-hitzone');
    return !hz || hz.getBoundingClientRect().top - r.bottom >= band;
  }

  /* ★326 — 글자 칸·스티커 바닥이 띠 안이면 손잡이를 섹션 아래로 비킨다. 띠(10px×배율)가 글자 끝·선 스티커를 먹었다
     (text-selection-panel R7 · w2d06d O5 — 그 자리 클릭이 편집·선택으로 안 갔다). 앱 ×3 값은 시트 326.
     shortcut: x 겹침은 안 본다(닿는 블럭이 하나라도 있으면 띠 전체를 비킨다) · 띠 폭 일부만 비킬 일이 생기면 그때 나눠라
     shortcut: 눌러 보기 «전» 마우스가 움직여야 비킨다 — 사람은 늘 움직인다 · 안 움직이고 임자를 읽는 시험은 손잡이를 본다
     ⚠️아래 섹션 hitzone 과 겹치는 간격(화면 약 26~36px)에서는 비킨 손잡이를 못 잡는다(시트 326 표 · 글자·스티커만, 프레임은 roomBelow 로 안 비킨다). */
  document.addEventListener('pointermove', (ev) => {
    const sec = ev.target.closest && ev.target.closest('#canvas .section-block:not([data-ghost])');
    if (!sec || sec.classList.contains('section-bottom-dragging')) return;
    const h = sec.querySelector(':scope > .' + CLS);
    if (!h) return;
    const r = sec.getBoundingClientRect();
    const band = 10 * (r.width / (sec.offsetWidth || 1) || 1);
    const reaches = (t) => t.getBoundingClientRect().bottom > r.bottom - band && !window.sectionPin?.isFullyHidden(t, sec);   // ⑦ 핀에 완전히 숨은 블럭은 띠에 안 닿는다
    h.classList.toggle(OUT_CLS, [...sec.querySelectorAll('.text-block, .sticker-block')].some(reaches)
      || (roomBelow(sec, r, band) && [...sec.querySelectorAll('.frame-block')].some(reaches)));
  }, true);
  /* 337 — 끌기 중에는 띠가 놓는 자리를 먹지 않게 비킨다(그 자리에서 dragover 가 inner 로 안 가 drop 이 안 났다).
     행·블럭 dragstart 가 stopPropagation 하니 capture 로 받는다. 원본이 놓는 중 사라지면 dragend 가 안 오고,
     dragstart 가 취소되면 끌기가 없으니 drop·포인터로도 푼다. */
  const clearDragYield = () => document.body.classList.remove('sbh-html5-drag');
  document.addEventListener('dragstart', () => document.body.classList.add('sbh-html5-drag'), true);
  for (const t of ['dragend', 'drop', 'pointerup']) document.addEventListener(t, clearDragYield, true);
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('dblclick', onDblClick, true);
  /* 섹션이 #canvas 에 들어오는 입구가 십여 곳이라(새로 만들기·붙여넣기·템플릿·⌘Z·페이지 전환·다시 열기 …) 입구마다 걸지 않고 #canvas 를 본다.
     섹션이 들어오거나 섹션의 직속 자식이 바뀔 때(손잡이가 지워진 경우 포함)만 훑는다 · 관찰 콜백은 그 작업 끝에 돌아 다음 입력 전에 붙는다. */
  function onCanvasChange(muts) {
    for (const m of muts) {
      if (m.target.id === 'canvas' || m.target.classList?.contains('section-block')
        || [...m.addedNodes].some((n) => n.nodeType === 1 && (n.matches('.section-block') || n.querySelector('.section-block')))) { sweep(); return; }
    }
  }
  function start() {
    sweep();
    const c = document.getElementById('canvas');
    if (c) new MutationObserver(onCanvasChange).observe(c, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.sectionBottomHandleSweep = sweep;
})();

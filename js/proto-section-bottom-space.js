/* proto-section-bottom-space.js — ★★시안 : 섹션 ★아래 여백을 ★끌어서 늘린다
 *   (2026-10-25 · 현빈 「기본 섹션에도 아웃라인 핸들을 추가해서 높이를 늘릴 수 있게」
 *    → 확인 「★아래로만 늘리는 거고 ★스페이스 늘리는 거 맞다」 → 「★일단 브랜치 만들어 ★시안만」)
 *
 * ★★⛔제품이 ★아니다. ★`proto/section-bottom-space-handle` 가지에만 산다.
 *   ★이번 릴리스에 ★넣을지는 ★현빈이 ★보고 정한다. ⇒ ★dev 에 ★안 들어간다.
 *
 * ═══ ★왜 ★「높이」가 ★아니라 ★「아래 여백」인가 (★실측 셋) ═══════════════════════
 *   ⑴ ★섹션 패널의 높이 칸은 ★★«읽기 전용»이다 — `prop-section.js:518` 머리말 :
 *      「★이 섹션의 «지금» 높이 — 현빈 2026-10-07. ★읽기 전용(여기서 높이를 «정하지» 않는다)」
 *   ⑵ ★`sec.style.height` · `sec.style.minHeight` 를 ★쓰는 코드가 ★★0 건이다(레포 전수).
 *      ⇒ ★섹션 높이는 ★★«내용이 정하고 ★우리는 잰다».
 *   ⑶ ★`height` 를 박으면 ★★내용이 늘 때 ★조용히 ★잘린다. ★그 사고가 ★이미 적혀 있다 —
 *      `js/overlay-handles.js:3441~3443` 「높이는 «쓰지 않고 잰다». ★height 를 쓰면 ★줄이는 순간
 *       글자가 ★조용히 잘린다」
 *   ⇒ ★★미는 것은 ★`paddingBottom` ★하나다. ★그것은 ★★이미 ★패널에 있다(`applyPadB`).
 *     ⇒ ★★새 개념 ★0 · ★저장 꼴 ★무변 · ★패널 숫자와 ★손잡이가 ★★«같은 값»을 가리킨다.
 *
 * ═══ ★이 시안이 ★쓰는 ★선례 (★하나도 ★새로 안 지었다) ═══════════════════════════
 *   · ★값      = `sec.style.paddingBottom` — `prop-section.js` `applyPadB` 와 ★같은 자리
 *   · ★비춤    = `window._showPadBHint(sec, v)` — ★현빈이 2026-10-07 에 ★시킨 ★그 띠
 *                (「아래 패딩 조절 시 ★안 보이는 문제가 있음」 → 그때 만든 것)
 *   · ★기록    = `window.pushHistory?.()` — ⌘Z 로 되돌아간다
 *   · ★저장    = `window.triggerAutoSave?.()`
 *   · ★손잡이 꼴 = `.section-hitzone` 과 ★같은 자리(섹션 안 · 편집 전용)
 *
 * ═══ ★★안 한 것 (★시안이라 ★일부러) ═══════════════════════════════════════════
 *   · ★위로 줄이기 — ★아래로만(현빈 「아래로만 늘리는 거」). ★0 아래로는 ★안 간다.
 *   · ★여러 섹션 ★한꺼번에
 *   · ★스냅(8px 격자 등) · ★수치 뱃지
 *   · ★`NON_CONTENT_UI_SELECTOR` 등록 — ★제품으로 갈 때 ★반드시 한다(★안 하면 ★내보내기에 ★실린다)
 *     ★이름 `PROTO-SECBOT-HANDLE-NOT-IN-UI-ROSTER-01`
 *
 * ═══ ★★★안 ★된 칸 (★★시안이 ★★못 한 것 — ★감추지 ★않는다) ═══════════════════
 *   ★★끌고 나면 ★★섹션 ★선택이 ★풀린다 ⇒ ★★우측 패널이 ★사라진다.
 *     ★실측(261025 · 헤드리스) : 끌기 뒤 `sec.classList.contains('selected')` = ★★false ·
 *       `#sec-padb-slider` = ★없음. ★`stopPropagation` 을 해도, ★`selectSection(sec)` 을
 *       ★다시 불러도 ★★그대로다.
 *     ⇒ ★★그래서 ★「패널 숫자와 ★손잡이가 ★같은 값을 가리킨다」는 ★★이 시안의 주장은
 *       ★★아직 ★증명되지 ★않았다. ★★«값은 맞는데 ★보여 줄 패널이 ★없다».
 *     ★이름 `PROTO-SECBOT-DESELECT-ON-DRAG-01` (★★제품으로 갈 때 ★반드시 닫을 칸)
 *     ★다음에 볼 곳 — ★누가 ★선택을 ★푸는가. `js/editor.js` 의 전역 `deselectAll` 둘레와
 *       `pointerup`·`click` 을 ★듣는 자를 ★세라. ⛔「stopPropagation 했으니 됐다」로 ★닫지 마라 —
 *       ★이미 ★그렇게 ★닫았다가 ★틀렸다.
 *
 *   ★★증명된 것은 ★이것뿐이다(그래도 ★핵심이다) :
 *     ★끌면 ★`paddingBottom` 이 ★늘고 ★섹션 ★높이가 ★그만큼 ★는다(113 → 193 · 화면 ＋80) ·
 *     ★배율을 ★먹는다(40% 에서 ★화면 120px = ★모델 300px) ·
 *     ★상한이 ★★패널 슬라이더(`max=200`)에서 ★파생된다(★손으로 박은 400 이 ★한 값을 ★둘로 갈랐던 자리).
 */
(function () {
  'use strict';

  const CLS = 'proto-secbot-handle';
  /* ★★상한은 ★«패널 슬라이더»에서 ★파생한다 — ⛔손으로 적지 마라.
     ★261025 ★실측: ★내가 ★400 을 ★손으로 박았더니 ★손잡이가 ★300 을 썼는데
       ★슬라이더(max 200)가 ★★200 에 멈춰 ★★한 값이 ★두 곳에서 ★갈렸다.
     ⇒ ★★이 시안의 ★주장(「패널 숫자와 손잡이가 ★같은 값을 가리킨다」)이 ★★깨졌던 자리다. */
  const PAD_MAX_FALLBACK = 200;
  function maxOf() {
    const sl = document.getElementById('sec-padb-slider');
    const m = sl && Number(sl.max);
    return Number.isFinite(m) && m > 0 ? m : PAD_MAX_FALLBACK;
  }

  function ensureHandle(sec) {
    if (!sec || sec.querySelector(':scope > .' + CLS)) return;
    const h = document.createElement('div');
    h.className = CLS;
    h.title = '끌어서 아래 여백을 늘립니다 (시안)';
    sec.appendChild(h);
  }

  /** 지금 아래 여백(px). 패널과 같은 자를 쓴다. */
  const padOf = (sec) => parseInt(sec.style.paddingBottom) || 0;

  function onDown(ev) {
    const h = ev.target.closest('.' + CLS);
    if (!h) return;
    const sec = h.closest('.section-block');
    if (!sec) return;
    ev.preventDefault();
    ev.stopPropagation();           /* ⛔섹션 선택·블록 드래그로 새지 않게 */

    const y0 = ev.clientY;
    const p0 = padOf(sec);
    /* ★배율을 먹는다 — 캔버스가 40% 면 화면 1px 이 모델 2.5px 다.
       ⛔`window.zoom` 류를 손으로 읽지 마라 — 요소의 실제 배율에서 뽑는다. */
    const scale = sec.getBoundingClientRect().width / (sec.offsetWidth || 1) || 1;
    sec.classList.add('proto-secbot-dragging');

    const onMove = (e) => {
      const dy = (e.clientY - y0) / scale;
      const v = Math.max(0, Math.min(maxOf(), Math.round(p0 + dy)));
      sec.style.paddingBottom = v ? v + 'px' : '';
      window._showPadBHint?.(sec, v);      /* ★현빈이 시킨 그 띠를 그대로 쓴다 */
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      sec.classList.remove('proto-secbot-dragging');
      if (padOf(sec) !== p0) {
        window.pushHistory?.();
        window.triggerAutoSave?.();
        /* ★★261025 ★실측 — 끌고 나면 ★섹션 선택이 ★풀린다(`sel:false` · 패널이 사라진다).
           ★`stopPropagation` 을 ★해도 그렇다 — ★캔버스의 ★비우기가 ★다른 길로 돈다.
           ⇒ ★끈 섹션을 ★다시 고른다. ★그러면 ★패널 숫자가 ★손잡이를 ★따라온다.
           ⚠️이것은 ★증상 처리다 — ★«누가 선택을 푸는가»는 ★안 쟀다.
             ★이름 `PROTO-SECBOT-DESELECT-SOURCE-UNMEASURED-01`. ★제품으로 갈 때 ★그 자리를 찾아라. */
        window.selectSection?.(sec);
        window.showSectionProperties?.(sec);
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  function sweep() {
    document.querySelectorAll('#canvas .section-block:not([data-ghost])').forEach(ensureHandle);
  }

  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('DOMContentLoaded', sweep);
  /* 섹션이 늘거나 줄 때 따라붙는다 — 시안이라 느슨하게 훑는다(제품화 때는 생성 자리에 건다) */
  setInterval(sweep, 1200);
  window.protoSecBotSweep = sweep;
})();

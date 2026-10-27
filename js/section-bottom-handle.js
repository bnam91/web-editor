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
  function armClickSwallow() {
    const swallow = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      document.removeEventListener('click', swallow, true);
    };
    document.addEventListener('click', swallow, true);
    setTimeout(() => document.removeEventListener('click', swallow, true), 0);   // click 이 안 오면 다음 틱에 걷는다(table 선례)
  }

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
    const h0 = sec.offsetHeight;    /* 지금 높이 = max(블럭, 바닥) — 넘친 섹션도 «지금»에서 잡는다 */
    const nat = naturalOf(sec);
    /* ★배율을 먹는다 — 캔버스가 40% 면 화면 1px 이 모델 2.5px 다.
       ⛔`window.zoom` 류를 손으로 읽지 마라 — 요소의 실제 배율에서 뽑는다. */
    const scale = sec.getBoundingClientRect().width / (sec.offsetWidth || 1) || 1;
    sec.classList.add('section-bottom-dragging');

    const onMove = (e) => {
      const v = Math.round(h0 + (e.clientY - y0) / scale);
      /* ★블럭 높이까지만 줄인다 · 끝까지 줄이면 바닥을 없앤다(현빈 「없앤다」) · 상한 없음 */
      sec.style.minHeight = v > nat ? v + 'px' : '';
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
      if (sec.style.minHeight !== mh0) {
        window.pushHistory?.();
        window.triggerAutoSave?.();
      }
    };
    /* ★취소(창 전환·터치 취소 등) = 끌기 전으로 되돌린다 · 기록 없음.
       ⛔안 걷으면 버튼을 뗀 뒤에도 마우스를 따라 값이 바뀐다(261027 괴롭히기 ×3 재현). */
    const onCancel = () => { end(); sec.style.minHeight = mh0; };
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
    if (!sec.style.minHeight) return;
    sec.style.minHeight = '';
    window.pushHistory?.();
    window.triggerAutoSave?.();
  }

  function sweep() {
    document.querySelectorAll('#canvas .section-block:not([data-ghost])').forEach(ensureHandle);
  }

  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('dblclick', onDblClick, true);
  document.addEventListener('DOMContentLoaded', sweep);
  /* shortcut: 섹션 생성 자리 대신 1.2s 마다 훑는다 — 새 섹션에 손잡이가 늦게(≤1.2s) 붙는다, 거슬리면 addSection 에 건다 */
  setInterval(sweep, 1200);
  window.sectionBottomHandleSweep = sweep;
})();

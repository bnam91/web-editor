/* prop-text-wireup-align.js
 * text-align (label / icon-text / 일반)
 * + icon-text 블록 전용 gap
 */

/** ★가로 정렬 낱말 → 세로 flex 자식의 align-self — ★★이 사상표의 ★유일한 자리 (t7-03 · 2026-10-26 S3 · 지디 처방 ⒝).
 *  ★읽는 자 셋: 이 파일 정렬 단추(U10 · 커스텀 폭 박스) · js/editor.js alignSelectedToParent(⌥A/S/D) ·
 *    js/effects-freetransform.js applyFxFreeTransform(폭 100% → px 전이). ⛔다른 자리에 같은 표를 또 적지 마라
 *    (셋이 같은 답인지는 tests/unit/align-self-map-ssot.test.mjs 가 잰다). */
export const ALIGN_SELF_OF = Object.freeze({ left: 'flex-start', center: 'center', right: 'flex-end' });

/** ★★말풍선의 ★★발신자 이름표에 ★가로 정렬을 ★★같이 ★건다 — ★★★이 규칙의 ★유일한 자리.
 *
 * ★★왜 ★따로 ★걸어야 ★하나 (★실측 2026-10-10 · `tests/dom/bubble-sender-align.dom.spec.js`):
 *   ★`js/block-factory.js:2814` — ★`.tb-sender-name` 과 ★`.tb-bubble` 은 ★★★형제다
 *   ⇒ ★★`.tb-bubble` 에 ★건 ★`text-align` 은 ★★★구조적으로 ★이름표에 ★안 닿는다
 *   ★실측(★제 상자 기준): ★넓은 풍선에서 ★★풍선 글자는 ★−10 → ★+0(★가운데로) ·
 *     ★★이름표 글자는 ★−165 → ★−160(★안 간다) ⇒ ★★현빈 2026-10-10 「★발신자이름은 ★안따라옴」
 *
 * ⛔★블록(`tb`)에 ★걸지 ★않는다 — ★★판정 2026-10-10(지디):
 *   ★그러면 ★★말꼬리 SVG 도 ★형제라 ★★같이 ★움직인다(★실측: ★svg cx ★546 → ★558)
 *   ⇒ ★★★현빈이 ★요청하지 ★않은 ★변화다 ⇒ ★★디자인 ★판단이므로 ★★그에게 ★묻는 중이다
 *   ⇒ ★★그때까지의 ★«지금 집행선» = ★★이름표만 ★따라오게 ★한다
 *
 * ★★그리고 ★★★이 함수가 ★있는 ★까닭: ★★그 규칙이 ★★두 자리에 ★있었다 —
 *   ⒜ ★여기(★한 블록 ★정렬) ⒝ ★`prop-page.js` 의 ★★쪽 전체 ★일괄 정렬
 *   ⇒ ★★★주석으로 ★막지 ★않고 ★★파생시켜 ★하나로 ★뒀다(⛔사본을 ★두면 ★한쪽이 ★조용히 ★늙는다) */
export function applyBubbleSenderAlign(tb, align) {
  if (!tb || !tb.classList?.contains('speech-bubble-block')) return false;
  const nm = tb.querySelector('.tb-sender-name');
  if (!nm) return false;
  nm.style.textAlign = align;
  /* ★1012t1M2-b — 표식도 같이 쓴다: CSS 가 center 일 때 말꼬리 쪽 22px 들여쓰기를 뺀다(editor-blocks.css 말풍선 절).
     인라인 textAlign 은 그대로 둔다(10-10 이후 저장본과 같은 꼴 · ⒨ 판별자는 «블럭» 인라인이라 무관). */
  if (align) tb.dataset.senderAlign = align; else delete tb.dataset.senderAlign;
  return true;
}

/** ★1012t1M2(결함 3) — 말꼬리를 바꾸면 «정렬 단추가 남긴 이름표 정렬»을 걷는다 ⇒ 이름은 말꼬리 규칙(CSS)을 따른다.
 *  ★이 규칙의 유일한 자리 — 패널 말꼬리 단추(prop-text-wireup-bubble.js _setTail)와 MCP/모델 문
 *    (block-factory.js updateSpeechBubbleBlock tail 갈래)이 같이 부른다. 옛: 패널만 지워 MCP tail:center 뒤 dLayout −113.7(이벨 실측).
 *  ⛔block-factory 는 이 파일을 import 하지 않는다 — window 다리(아래)로 부른다. */
export function clearBubbleSenderAlign(tb) {
  if (!tb || !tb.classList?.contains('speech-bubble-block')) return false;
  const nm = tb.querySelector('.tb-sender-name');
  if (nm) nm.style.textAlign = '';
  delete tb.dataset.senderAlign;
  return true;
}
if (typeof window !== 'undefined') window.clearBubbleSenderAlign = clearBubbleSenderAlign;

export function wireAlignSection({ tb, ctx, propPanel, isIconText }) {
  /* 정렬 */
  propPanel.querySelectorAll('.prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.dataset.align) return; // 말꼬리 방향 버튼은 data-align 없으므로 무시
      // label(inline-block)은 부모 tb에 text-align 적용해야 블록 자체가 정렬됨
      if (ctx.contentEl.classList.contains('tb-label')) {
        tb.style.textAlign = btn.dataset.align;
      } else if (isIconText && tb.dataset.itbDir === 'v') {
        /* ★S3V — 세로에서 justifyContent 는 «위아래 분배»라 안 먹는다(눌리는데 안 변함). 가로 위치 = alignItems + 글 textAlign. */
        window.applyIconTextAlign?.(tb, btn.dataset.align);
      } else if (isIconText) {
        // 아이콘+텍스트 전체를 함께 정렬 — justifyContent로 icon-text-block 내부 정렬
        const jcMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
        tb.style.justifyContent = jcMap[btn.dataset.align] || 'flex-start';
        const itbText = tb.querySelector('.itb-text');
        if (itbText) itbText.style.flex = btn.dataset.align === 'left' ? '1' : '0 1 auto';
      } else {
        ctx.contentEl.style.textAlign = btn.dataset.align;
        /* ★말풍선 — ★이름표는 ★형제라 ★못 물려받는다 ⇒ ★★한 자리(위 함수)로 ★같이 ★건다 */
        applyBubbleSenderAlign(tb, btn.dataset.align);
        // U10: 커스텀 폭(width≠100%) 블록은 contentEl text-align만으론 박스가 좌측 고정
        //  → section-inner{flex-direction:column}이라 자식 가로위치는 align-self가 지배.
        //    박스 자체(폭을 보유한 flex 자식 = text-frame 래퍼 또는 tb)를 정렬한다.
        //    규약은 #13 alignSelectedToParent(editor.js)와 동일: left→flex-start / center→center / right→flex-end.
        //    기본폭(100%) 블록은 alignSelf 미설정 유지 → 기존 저장본(align-self 없이 text-align만) 회귀 방어.
        const layoutEl = tb.closest('.frame-block[data-text-frame="true"]') || tb;
        const w = layoutEl.style.width;
        const isCustomWidth = !!w && w !== '100%' && w !== 'auto';
        if (isCustomWidth) {
          layoutEl.style.alignSelf = ALIGN_SELF_OF[btn.dataset.align] || 'flex-start';
          window.scheduleAutoSave?.();
        }
      }
      /* ★[2026-09-22 · T-135 의 빠진 넷째] 순서를 뒤집었다 — 2026-09-21 에 형제 셋
         (js/props/prop-asset.js · prop-mockup.js · prop-iconify.js)을 뒤집은 그 결정의 남은 하나다.
         까닭은 prop-asset.js 의 그 주석 그대로: 직전 편집이 push-after 인 순간(⌘Z «직후»도 같다)
         이 클릭의 push-before 가 꼭대기와 «같은 상태»를 찍어 무변화 중복 차단에 버려진다
         ⇒ 칸이 +0 이고, 차단은 redo 꼬리도 «안» 자르므로 ⌘⇧Z 한 번이 방금 한 정렬을
         «스택에 한 번도 안 찍힌 채» 덮어쓴다. 단추가 «한 클릭 = 한 걸음»인 성질은 안 깨진다.
         ⛔js/CLAUDE.md 의 「onUp 의 pushHistory 를 옮기지 마라」와 다른 꼴이다 — 그건 드래그
           제스처의 «두 끝» 얘기고, 여기는 클릭 핸들러 «한 걸음» 안의 순서다.
         게이트: tests/e2e/13-undo-family.spec.js U1 의 T-009 형제(editSlot). */
      window.pushHistory?.();
      propPanel.querySelectorAll('.prop-align-btn[data-align]').forEach(b => b.classList.toggle('active', b===btn));
    });
  });

  /* ★S3V — 「방향」 가로/세로. 쓰기 = js/block-factory.js setIconTextDirection «한 곳»(MCP 와 같은 길).
     ★적용 «먼저» → pushHistory(이 파일 정렬 단추와 같은 순서 — tests/unit/prop-push-after PA-1). 같은 방향이면 false = 이력 칸 0.
     패널을 다시 그린다 — 정렬 단추 active 는 방향마다 읽는 키가 다르다(prop-text.js currentAlign). */
  if (isIconText) {
    propPanel.querySelectorAll('#itb-dir-group .prop-align-btn[data-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!window.setIconTextDirection?.(tb, btn.dataset.dir)) return;
        window.pushHistory?.('Icon Text 방향');
        window.scheduleAutoSave?.();
        window.showTextProperties?.(tb);
      });
    });
  }

  /* 아이콘-텍스트 간격 */
  if (isIconText) {
    const itbGapSlider = propPanel.querySelector('#itb-gap-slider');
    const itbGapNumber = propPanel.querySelector('#itb-gap-number');
    if (itbGapSlider && itbGapNumber) {
      const applyItbGap = v => { tb.style.gap = v + 'px'; window.triggerAutoSave?.(); };
      itbGapSlider.addEventListener('input', () => { itbGapNumber.value = itbGapSlider.value; applyItbGap(itbGapSlider.value); });
      itbGapNumber.addEventListener('input', () => { itbGapSlider.value = itbGapNumber.value; applyItbGap(itbGapNumber.value); });
    }
  }
}

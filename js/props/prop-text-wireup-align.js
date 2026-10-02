/* prop-text-wireup-align.js
 * text-align (label / icon-text / 일반)
 * + icon-text 블록 전용 gap
 */

export function wireAlignSection({ tb, ctx, propPanel, isIconText }) {
  /* 정렬 */
  propPanel.querySelectorAll('.prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.dataset.align) return; // 말꼬리 방향 버튼은 data-align 없으므로 무시
      // label(inline-block)은 부모 tb에 text-align 적용해야 블록 자체가 정렬됨
      if (ctx.contentEl.classList.contains('tb-label')) {
        tb.style.textAlign = btn.dataset.align;
      } else if (isIconText) {
        // 아이콘+텍스트 전체를 함께 정렬 — justifyContent로 icon-text-block 내부 정렬
        const jcMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
        tb.style.justifyContent = jcMap[btn.dataset.align] || 'flex-start';
        const itbText = tb.querySelector('.itb-text');
        if (itbText) itbText.style.flex = btn.dataset.align === 'left' ? '1' : '0 1 auto';
      } else {
        ctx.contentEl.style.textAlign = btn.dataset.align;
        // U10: 커스텀 폭(width≠100%) 블록은 contentEl text-align만으론 박스가 좌측 고정
        //  → section-inner{flex-direction:column}이라 자식 가로위치는 align-self가 지배.
        //    박스 자체(폭을 보유한 flex 자식 = text-frame 래퍼 또는 tb)를 정렬한다.
        //    규약은 #13 alignSelectedToParent(editor.js)와 동일: left→flex-start / center→center / right→flex-end.
        //    기본폭(100%) 블록은 alignSelf 미설정 유지 → 기존 저장본(align-self 없이 text-align만) 회귀 방어.
        const layoutEl = tb.closest('.frame-block[data-text-frame="true"]') || tb;
        const w = layoutEl.style.width;
        const isCustomWidth = !!w && w !== '100%' && w !== 'auto';
        if (isCustomWidth) {
          const asMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
          layoutEl.style.alignSelf = asMap[btn.dataset.align] || 'flex-start';
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

/* prop-text-wireup-align.js
 * text-align (label / icon-text / 일반)
 * + icon-text 블록 전용 gap
 */

export function wireAlignSection({ tb, ctx, propPanel, isIconText }) {
  /* 정렬 */
  propPanel.querySelectorAll('.prop-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.dataset.align) return; // 말꼬리 방향 버튼은 data-align 없으므로 무시
      window.pushHistory?.();
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

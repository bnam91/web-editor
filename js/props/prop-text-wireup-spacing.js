/* prop-text-wireup-spacing.js
 * line-height + letter-spacing
 */

export function wireSpacingSection({ ctx, isLiner }) {
  /* 줄간격 */
  const lhNumber = document.getElementById('txt-lh-number');
  lhNumber.addEventListener('change', () => { window.pushHistory?.(); });
  lhNumber.addEventListener('input', () => {
    const v = Math.min(3, Math.max(1, parseFloat(lhNumber.value)||1));
    ctx.contentEl.style.lineHeight = v;
  });

  /* 자간 — 라이너 블록은 공통 자간 컨트롤 스킵(M6b). 우리 슬라이더(dataset.liner.letterSpacing)가 단일소스 */
  if (isLiner) return;
  const lsNumber = document.getElementById('txt-ls-number');
  if (!lsNumber) return;
  lsNumber.addEventListener('change', () => { window.pushHistory?.(); });
  lsNumber.addEventListener('input', () => {
    const v = Math.min(40, Math.max(-10, parseFloat(lsNumber.value) || 0));
    ctx.contentEl.style.letterSpacing = v + 'px';
  });
}

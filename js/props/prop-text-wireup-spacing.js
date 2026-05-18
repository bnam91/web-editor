/* prop-text-wireup-spacing.js
 * line-height + letter-spacing
 */

export function wireSpacingSection({ ctx }) {
  /* 줄간격 */
  const lhNumber = document.getElementById('txt-lh-number');
  lhNumber.addEventListener('change', () => { window.pushHistory?.(); });
  lhNumber.addEventListener('input', () => {
    const v = Math.min(3, Math.max(1, parseFloat(lhNumber.value)||1));
    ctx.contentEl.style.lineHeight = v;
  });

  /* 자간 */
  const lsNumber = document.getElementById('txt-ls-number');
  lsNumber.addEventListener('change', () => { window.pushHistory?.(); });
  lsNumber.addEventListener('input', () => {
    const v = Math.min(40, Math.max(-10, parseFloat(lsNumber.value) || 0));
    ctx.contentEl.style.letterSpacing = v + 'px';
  });
}

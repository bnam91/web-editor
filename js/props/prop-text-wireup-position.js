/* prop-text-wireup-position.js
 * width / X / Y (overlay-tb는 호출하지 않음)
 */

export function wirePositionSection({ tb }) {
  const wSlider = document.getElementById('txt-width-slider');
  const wNumber = document.getElementById('txt-width-number');
  if (wSlider) {
    const applyW = v => {
      const row = tb.closest('.row');
      const tf  = tb.closest('.frame-block[data-text-frame="true"]');
      if (row) {
        row.style.width     = v + 'px';
        row.style.maxWidth  = '100%';
        row.style.margin    = '0 auto';
        row.style.alignSelf = 'center';
        row.dataset.width   = v;
      } else if (tf) {
        // text-frame이 래퍼인 경우 — text-frame에 width 적용
        tf.style.width    = v + 'px';
        tf.style.maxWidth = '100%';
        tf.dataset.width  = v;
      } else {
        tb.style.width = v + 'px';
        tb.dataset.width = v;
      }
      wSlider.value = v; wNumber.value = v;
      window.scheduleAutoSave?.();
    };
    wSlider.addEventListener('input', () => applyW(parseInt(wSlider.value)));
    wNumber.addEventListener('input', () => applyW(Math.min(860, Math.max(80, parseInt(wNumber.value) || 80))));
    wSlider.addEventListener('change', () => window.pushHistory?.());
    wNumber.addEventListener('change', () => window.pushHistory?.());
  }

  const xNumber = document.getElementById('txt-x-number');
  const yNumber = document.getElementById('txt-y-number');
  if (xNumber) {
    xNumber.addEventListener('input', () => {
      const el = tb.closest('.frame-block[data-text-frame="true"]') || tb;
      el.style.left = (parseInt(xNumber.value) || 0) + 'px';
      el.dataset.offsetX = xNumber.value;
      window.scheduleAutoSave?.();
    });
    xNumber.addEventListener('change', () => window.pushHistory?.());
  }
  if (yNumber) {
    yNumber.addEventListener('input', () => {
      const el = tb.closest('.frame-block[data-text-frame="true"]') || tb;
      el.style.top = (parseInt(yNumber.value) || 0) + 'px';
      el.dataset.offsetY = yNumber.value;
      window.scheduleAutoSave?.();
    });
    yNumber.addEventListener('change', () => window.pushHistory?.());
  }
}

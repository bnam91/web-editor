/* prop-text-wireup-padding.js
 * padding 상하 + padding 좌우 (chain-link 토글 포함)
 * R2: phLinked는 인자로 받아 내부 let으로 복사 → 자유롭게 mutate
 */

export function wirePaddingSection({ tb, phLinked: phLinkedArg }) {
  let phLinked = phLinkedArg; // R2: 내부 가변 복사본

  const pvSlider = document.getElementById('txt-pv-slider');
  const pvNumber = document.getElementById('txt-pv-number');
  if (pvSlider) {
    pvSlider.addEventListener('input', () => { tb.style.paddingTop = pvSlider.value+'px'; tb.style.paddingBottom = pvSlider.value+'px'; pvNumber.value = pvSlider.value; });
    pvNumber.addEventListener('input', () => { const v=Math.min(120,Math.max(0,parseInt(pvNumber.value)||0)); tb.style.paddingTop=v+'px'; tb.style.paddingBottom=v+'px'; pvSlider.value=v; });
  }

  /* 좌우 패딩 */
  const plSlider = document.getElementById('txt-pl-slider');
  const plNumber = document.getElementById('txt-pl-number');
  const prSlider = document.getElementById('txt-pr-slider');
  const prNumber = document.getElementById('txt-pr-number');
  const chainBtn = document.getElementById('txt-ph-chain');

  const CHAIN_SVG_LINKED = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="3.5" width="4" height="5" rx="2"/><rect x="7.5" y="3.5" width="4" height="5" rx="2"/><line x1="4.5" y1="6" x2="7.5" y2="6" stroke-linecap="round"/></svg>`;
  const CHAIN_SVG_BROKEN = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="3.5" width="4" height="5" rx="2"/><rect x="7.5" y="3.5" width="4" height="5" rx="2"/><line x1="5.2" y1="4.8" x2="6.8" y2="7.2" stroke-linecap="round"/></svg>`;

  if (plSlider) {
    chainBtn.addEventListener('click', () => {
      phLinked = !phLinked;
      chainBtn.classList.toggle('active', phLinked);
      chainBtn.innerHTML = phLinked ? CHAIN_SVG_LINKED : CHAIN_SVG_BROKEN;
      if (phLinked) {
        const v = parseInt(plSlider.value);
        tb.style.paddingRight = v + 'px';
        prSlider.value = v; prNumber.value = v;
      }
    });

    const setL = v => {
      tb.style.paddingLeft = v + 'px';
      tb.dataset.customPadL = '1';
      plSlider.value = v; plNumber.value = v;
      if (phLinked) { tb.style.paddingRight = v + 'px'; tb.dataset.customPadR = '1'; prSlider.value = v; prNumber.value = v; }
    };
    const setR = v => {
      tb.style.paddingRight = v + 'px';
      tb.dataset.customPadR = '1';
      prSlider.value = v; prNumber.value = v;
      if (phLinked) { tb.style.paddingLeft = v + 'px'; tb.dataset.customPadL = '1'; plSlider.value = v; plNumber.value = v; }
    };

    plSlider.addEventListener('input', () => setL(parseInt(plSlider.value)));
    plNumber.addEventListener('input', () => setL(Math.min(120, Math.max(0, parseInt(plNumber.value) || 0))));
    prSlider.addEventListener('input', () => setR(parseInt(prSlider.value)));
    prNumber.addEventListener('input', () => setR(Math.min(120, Math.max(0, parseInt(prNumber.value) || 0))));
  }
}

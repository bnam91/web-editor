/* prop-text-wireup-label.js
 * label 전용 스타일 컨트롤
 * - 배경색 (picker + hex + none 토글)
 * - radius (slider + number)
 * - pill 높이 (상하 패딩으로 조절)
 * - 5개 shape preset (pill / box / outline / circle / text)
 */

export function wireLabelSection({ ctx }) {
  /* 태그 배경색 */
  const labelBgPicker = document.getElementById('label-bg-color');
  const labelBgHex    = document.getElementById('label-bg-hex');
  const labelBgNone   = document.getElementById('label-bg-none');
  if (labelBgPicker) {
    const labelBgSwatch = labelBgPicker.closest('.prop-color-swatch');
    const setLabelBg = (val) => {
      const isNone = val === 'transparent';
      ctx.contentEl.style.backgroundColor = val;
      ctx.contentEl.style.padding = isNone ? '0' : '';
      ctx.contentEl.style.borderRadius = isNone ? '0' : (ctx.contentEl.style.borderRadius || '');
      labelBgSwatch.style.background = isNone ? 'transparent' : val;
      labelBgSwatch.classList.toggle('swatch-none', isNone);
      if (!isNone) { labelBgHex.value = val; labelBgPicker.value = val; }
    };
    labelBgPicker.addEventListener('input', () => {
      if (labelBgNone.checked) return;
      setLabelBg(labelBgPicker.value);
      labelBgHex.value = labelBgPicker.value;
    });
    labelBgHex.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(labelBgHex.value)) { setLabelBg(labelBgHex.value); labelBgNone.checked = false; }
    });
    labelBgNone.addEventListener('change', () => {
      if (labelBgNone.checked) { setLabelBg('transparent'); labelBgHex.value = ''; }
      else {
        ctx.contentEl.style.padding = '';
        const v = labelBgPicker.value || '#111111';
        setLabelBg(v); labelBgHex.value = v;
      }
    });
  }
  /* 태그 모서리 */
  const rSlider = document.getElementById('label-radius-slider');
  const rNumber = document.getElementById('label-radius-number');
  if (rSlider) {
    rSlider.addEventListener('input', () => { ctx.contentEl.style.borderRadius = rSlider.value+'px'; rNumber.value = rSlider.value; });
    rSlider.addEventListener('change', () => window.pushHistory?.());
    rNumber.addEventListener('input', () => {
      const v = Math.min(40, Math.max(0, parseInt(rNumber.value)||0));
      ctx.contentEl.style.borderRadius = v+'px'; rSlider.value = v;
    });
    rNumber.addEventListener('change', () => window.pushHistory?.());
  }

  /* 태그 pill 높이 (상하 패딩으로 조절) */
  const pillHSlider = document.getElementById('label-pill-height-slider');
  const pillHNumber = document.getElementById('label-pill-height-number');
  if (pillHSlider) {
    const setPillH = v => { const half = Math.round(v/2); ctx.contentEl.style.paddingTop = half+'px'; ctx.contentEl.style.paddingBottom = half+'px'; };
    pillHSlider.addEventListener('input', () => { setPillH(parseInt(pillHSlider.value)); pillHNumber.value = pillHSlider.value; });
    pillHSlider.addEventListener('change', () => window.pushHistory?.());
    pillHNumber.addEventListener('input', () => {
      const v = Math.min(120, Math.max(0, parseInt(pillHNumber.value)||0));
      setPillH(v); pillHSlider.value = v;
    });
    pillHNumber.addEventListener('change', () => window.pushHistory?.());
  }

  /* 태그 형태 프리셋 */
  // 모든 프리셋은 디폴트 .tb-label(padding:11px 36px, font:26px/700, radius:8px) 기준 + 서로 토글 시 안전 복원
  // 공통 reset 헬퍼 — 인라인 background/color/border/size 제거 → CSS 디폴트 복귀
  const _resetLabelInline = () => {
    ctx.contentEl.style.backgroundColor = '';
    ctx.contentEl.style.color = '';
    ctx.contentEl.style.border = '';
    ctx.contentEl.style.width  = '';
    ctx.contentEl.style.height = '';
    ctx.contentEl.style.display = '';
    ctx.contentEl.style.alignItems = '';
    ctx.contentEl.style.justifyContent = '';
  };
  document.getElementById('label-shape-pill')?.addEventListener('click', () => {
    window.pushHistory?.();
    _resetLabelInline();
    ctx.contentEl.style.borderRadius = '999px';
    ctx.contentEl.style.padding       = '11px 36px';
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 999; rNumber2.value = 999; }
  });
  document.getElementById('label-shape-box')?.addEventListener('click', () => {
    window.pushHistory?.();
    _resetLabelInline();
    ctx.contentEl.style.borderRadius = '8px';
    ctx.contentEl.style.padding       = '11px 36px';
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 8; rNumber2.value = 8; }
  });
  document.getElementById('label-shape-outline')?.addEventListener('click', () => {
    window.pushHistory?.();
    _resetLabelInline();
    ctx.contentEl.style.backgroundColor = 'transparent';
    ctx.contentEl.style.border = '1.5px solid currentColor'; // 텍스트 색 따라가는 외곽선
    ctx.contentEl.style.borderRadius = '8px';
    ctx.contentEl.style.padding = '11px 36px';
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 8; rNumber2.value = 8; }
  });
  document.getElementById('label-shape-circle')?.addEventListener('click', () => {
    window.pushHistory?.();
    _resetLabelInline();
    ctx.contentEl.style.borderRadius = '50%';
    ctx.contentEl.style.padding = '0';
    ctx.contentEl.style.width  = '64px';
    ctx.contentEl.style.height = '64px';
    ctx.contentEl.style.display = 'inline-flex';
    ctx.contentEl.style.alignItems = 'center';
    ctx.contentEl.style.justifyContent = 'center';
    // Circle은 숫자만 — 항상 "1"로 덮어쓰기 (사용자가 직접 2,3 등으로 변경 가능)
    ctx.contentEl.textContent = '1';
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 999; rNumber2.value = 999; }
  });
  document.getElementById('label-shape-text')?.addEventListener('click', () => {
    window.pushHistory?.();
    _resetLabelInline();
    ctx.contentEl.style.backgroundColor = 'transparent';
    ctx.contentEl.style.color = '#111111';
    ctx.contentEl.style.borderRadius = '0';
    ctx.contentEl.style.padding = '0';
    const rSlider2 = document.getElementById('label-radius-slider');
    const rNumber2 = document.getElementById('label-radius-number');
    if (rSlider2) { rSlider2.value = 0; rNumber2.value = 0; }
  });
}

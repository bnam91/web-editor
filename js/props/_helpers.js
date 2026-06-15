// 우측 프로퍼티 패널 공통 helper.
// 2026-05-21 신규. RIGHT_PANEL_PROPS.md §4-4 변경 이력 hook 표준 일괄 적용.

/**
 * 슬라이더 + 숫자 인풋 쌍을 표준 패턴으로 묶는다.
 *   - slider mousedown      → pushHistory()        (드래그 시작 직전 체크포인트)
 *   - slider input          → applyFn(v) + 숫자 동기화
 *   - slider change         → scheduleAutoSave()   (드래그 끝)
 *   - number input          → applyFn(clamped v) + 슬라이더 동기화
 *   - number change         → pushHistory() + scheduleAutoSave()
 *
 * applyFn은 "값 반영"만 담당 (DOM/스타일/dataset). pushHistory·scheduleAutoSave는 helper가 처리.
 * 기존 applyFn이 내부에서 scheduleAutoSave를 호출해도 안전 (debounce 중복 호출 OK).
 *
 * @param {HTMLInputElement} slider  range input
 * @param {HTMLInputElement} number  number input
 * @param {(v:number)=>void} applyFn 값 적용 함수
 * @param {object} [opts]
 * @param {number} [opts.min=0]            클램프 하한
 * @param {number} [opts.max=Infinity]     클램프 상한
 * @param {boolean} [opts.autosave=true]   change 시 scheduleAutoSave 호출
 * @param {boolean} [opts.history=true]    mousedown / number-change 시 pushHistory 호출
 */
export function bindSlider(slider, number, applyFn, opts = {}) {
  if (!slider || !number) return;
  const { min = 0, max = Infinity, autosave = true, history = true } = opts;
  const clamp = (raw) => {
    const v = parseInt(raw);
    if (Number.isNaN(v)) return min;
    return Math.min(max, Math.max(min, v));
  };

  if (history) slider.addEventListener('mousedown', () => window.pushHistory?.());
  slider.addEventListener('input', () => {
    const v = clamp(slider.value);
    applyFn(v);
    number.value = v;
  });
  if (autosave) slider.addEventListener('change', () => window.scheduleAutoSave?.());

  number.addEventListener('input', () => {
    const v = clamp(number.value);
    applyFn(v);
    slider.value = v;
  });
  number.addEventListener('change', () => {
    if (history)  window.pushHistory?.();
    if (autosave) window.scheduleAutoSave?.();
  });
}

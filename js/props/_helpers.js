// 우측 프로퍼티 패널 공통 helper.
// 2026-05-21 신규. RIGHT_PANEL_PROPS.md §4-4 변경 이력 hook 표준 일괄 적용.

/**
 * 「N:M:...」 비율 문자열 → 정규화된 양수 정수 배열(개수=count).
 *   - 구분자: ':' ',' 공백(연속 허용) — `1:1:2` / `1,1,2` / `1 1 2` 모두 동일 결과.
 *   - 부족하면 1로 패딩, 넘치면 자른다(count 초과분 버림).
 *   - 0 이하·NaN인 항목은 걸러진다(음수·0 비율은 의미가 없다).
 * ★prop-table.js `_applyColRatio`의 인라인 파서를 그대로 뽑아온 것(2026-09-04 P0) — 동작 무변경.
 *   테이블·그리드 블록 둘 다 이걸 쓴다(복붙 금지).
 */
export function parseRatio(raw, count) {
  /* ★Number.isFinite 로 거른다 — !isNaN(Infinity) 는 true 라 «1e999» 같은 입력이 그대로 통과했고,
   *   그 값이 dataset 에 들어가면 JSON 직렬화에서 null 이 돼 «비율이 사라진다». */
  let parts = String(raw || '').split(/[:,\s]+/).filter(Boolean).map(Number).filter(n => Number.isFinite(n) && n > 0);
  while (parts.length < count) parts.push(1);
  parts = parts.slice(0, count);
  return parts;
}

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

/**
 * 4×4 그리드 피커를 «한 곳에서» 만든다.
 * ★이 UI 는 카드(prop-canvas.js:134-166)·심플카드(prop-simple-card.js:451-491)에
 *   이미 «복붙 2벌»로 있었다. 그리드 블록이 세 번째 복붙이 되지 않게 여기로 뺐다
 *   (PLAN-gridblock.md §5 권고). 기존 두 곳은 동작이 검증돼 있어 이번엔 안 건드린다 —
 *   옮기려면 그쪽 회귀 검증이 따로 필요하다.
 *
 * @param {HTMLElement} picker  셀을 채울 빈 컨테이너(.grid-picker)
 * @param {HTMLElement} label   "c × r" 을 쓸 곳(.grid-picker-label)
 * @param {(cols:number, rows:number)=>void} onPick  클릭 시 호출
 * @param {object} [opts]
 * @param {number} [opts.max=4]      격자 한 변
 * @param {number} [opts.maxRows]    행 상한(없으면 max). 행 축이 아직 없으면 1 을 준다.
 * @param {number} [opts.minCols=1]  ★열 하한.
 *   ~~[2026-09-04 · 폐기] 「그리드는 2 다 — 1열은 그리드가 아니고, 누르면 dataset 만 1 이 되고
 *     캔버스는 2칸으로 남아 «어긋난다»(실측)」~~
 *   ★[2026-09-05 · 현빈 지시로 뒤집음 = «정책 변경»] 그리드도 «1» 이다. 폐기 문장의 «어긋남»은
 *     grid-block.js 의 `MIN_COLS=2` 폴백(_gridCols)이 만든 것이었고, 그 상수를 1 로 내리면서
 *     폴백 «조건 자체»가 사라졌다. ⛔이 파일(buildGridPicker)은 한 줄도 안 바뀌었다 —
 *     술어 `alive()` 가 처음부터 minCols 를 그대로 따랐다.
 */
export function buildGridPicker(picker, label, onPick, opts = {}) {
  if (!picker) return;
  const MAX = opts.max || 4;
  const MAXR = opts.maxRows || MAX;
  const MINC = opts.minCols || 1;
  const MINR = opts.minRows || 1;
  /* ★「살아있는 칸인가」는 «술어 하나»에서만 판정한다 — 전엔 렌더·hover·클릭 세 곳에 조건을
   * 따로 적어놨고, hover 만 MINC 를 빠뜨려 «죽은 열 1 칸까지 파랗게 칠해졌다»(적대검수 지적).
   * 같은 판정을 여러 곳에 베끼면 반드시 한 곳이 뒤처진다 — 이 레포가 오늘만 여러 번 당한 패턴이다. */
  const alive = (r, c) => r >= MINR && r <= MAXR && c >= MINC && c <= MAX;
  picker.innerHTML = '';
  /* ★칸 «수»도 상수를 따라간다. 전엔 CSS 가 `grid-template-columns: repeat(4, 1fr)` 로 「한 변 4」를
   * 따로 알고 있었다(그것도 editor-blocks.css / editor-props.css 두 벌로). 열 상한을 바꾸면
   * 셀은 늘어나는데 격자는 4칸이라 줄바꿈이 깨진다 — 여기서 한 번에 정한다. */
  picker.style.gridTemplateColumns = `repeat(${MAX}, 1fr)`;
  /* ★행 루프 상한은 MAXR(행) 이다. 전엔 MAX(열 상한)로 돌아서, alive() 는 «살아있다»고 하는데
   * 셀 자체가 안 그려지는 조합이 생겼다(적대검수 G1: MAX_ROWS=5 면 2x5·3x5·4x5).
   * 오늘은 MAX_COLS===MAX_ROWS===4 라 안 터졌을 뿐이고, 이 커밋이 고치겠다고 선언한 바로 그 병이다.
   * ⚠️술어(alive)만 고치고 «술어 밖의 루프»를 안 고치면 이렇게 남는다 — 축은 끝까지 따라가야 한다. */
  for (let r = 1; r <= MAXR; r++) {
    for (let c = 1; c <= MAX; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-picker-cell';
      cell.dataset.r = r; cell.dataset.c = c;
      // 아직 못 만드는 조합은 «죽은 칸»으로 둔다 — 눌러도 아무 일 없는 것보다 안 눌리는 게 정직하다.
      if (!alive(r, c)) cell.classList.add('grid-picker-cell--off');
      picker.appendChild(cell);
    }
  }
  const clear = () => {
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => cl.classList.remove('active'));
    if (label) label.textContent = '—';
  };
  picker.addEventListener('mouseover', e => {
    const cell = e.target.closest('.grid-picker-cell');
    if (!cell || cell.classList.contains('grid-picker-cell--off')) return;
    const r = +cell.dataset.r, c = +cell.dataset.c;
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => {
      const cr = +cl.dataset.r, cc = +cl.dataset.c;
      // ★칠하는 조건도 «alive» 를 거친다 — 죽은 칸은 미리보기에도 안 들어간다.
      cl.classList.toggle('active', alive(cr, cc) && cr <= r && cc <= c);
    });
    if (label) label.textContent = `${c} × ${r}`;
  });
  picker.addEventListener('mouseleave', clear);
  picker.addEventListener('click', e => {
    const cell = e.target.closest('.grid-picker-cell');
    if (!cell) return;
    const r = +cell.dataset.r, c = +cell.dataset.c;
    // ★클래스(--off)가 아니라 «데이터»로 다시 판정한다 — 클래스는 렌더 시점의 «흔적»이라
    //   한도가 바뀌고 다시 안 그리면 낡는다. 판정은 언제나 alive() 하나.
    if (!alive(r, c)) return;
    onPick(c, r);
  });
}

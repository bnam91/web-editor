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

/* ══════════════════════════════════════════════════════════════════════════
 * 정렬 버튼 SSOT — 그림 사전(ALIGN_ICONS) + 문자열 조립기(alignBtn)
 * 2026-09-08 신규(A단계). ★이 단계는 «추가만» 한다 — 위쪽 코드는 한 줄도 안 바꿨고,
 *   호출부도 A단계에선 0 개다. 그래서 A단계만으로는 «렌더가 못 바뀐다».
 *
 * ★왜 노드가 아니라 «HTML 문자열»인가
 *   레포의 정렬 버튼 146/146 이 전부 propPanel.innerHTML 템플릿 리터럴 «안»에 있다.
 *   createElement 로 만드는 align 버튼은 0 건이다. 노드를 내면 146 곳 전부가
 *   「문자열 조립 → 노드 조립」으로 «구조»까지 바뀌어야 한다 — 이관 비용이 100 배가 된다.
 *
 * ★왜 `buildGridPicker` 옆인가
 *   위 buildGridPicker 가 정확히 같은 성격의 선례다(복붙 2벌을 한 곳으로). 새 모듈을 파면
 *   「_helpers 는 무엇을 담는 곳인가」가 두 곳으로 갈린다. 여기가 그 곳이다.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * 정렬 버튼 «그림»의 유일한 출처.
 *
 * ★계열(family)은 «무엇을 정렬하는가»가 아니라 «어떤 그림인가»로 갈린다 —
 *   같은 「왼쪽」이라도 텍스트 정렬(줄 4개)과 오브젝트 정렬(가이드선+상자)은 다른 그림이다.
 *   이 구분이 무너지면 「그림을 통일하자」는 선의의 리팩터가 «뜻이 다른 버튼 두 개»를
 *   같은 아이콘으로 만들어버린다. align-btn-ssot.test.mjs T4 가 그 순간에 빨강을 낸다.
 *
 *   text      — 글 줄 4개(외곽선). 문단/텍스트 정렬.   출처: prop-text-template.js·prop-iconify.js
 *   object-h  — ★칠(solid) 판, 가로축 오브젝트.        출처: prop-frame.js·prop-asset.js·prop-grid.js·prop-multisel.js
 *   object-v  — ★칠(solid) 판, 세로축 오브젝트.        출처: 〃
 *   arrow-h   — ★SVG 가 아니라 «문자» 그대로. 가로축.
 *   arrow-v   — ★SVG 가 아니라 «문자» 그대로. 세로축.
 *
 * ★C단계에서 fill-h·fill-v 를 «지웠다» — object-h·object-v 와 같은 뜻이 됐기 때문이다
 *   현빈: 「외곽선·객체정렬 → 채움으로 일단 바꿔줄래?」 「prop-frame.js 이게 낫다 아웃라인있는것 보다」
 *   ⇒ 객체정렬 27곳이 전부 «채움»이 되면 object-*(외곽선)와 fill-*(채움)는 «구분할 것이 없다».
 *
 *   ★남긴 이름은 object-h·object-v 다. 이유 —
 *     text 는 «무엇을 정렬하는가»(뜻)로 지은 이름이고, fill 은 «어떻게 그렸는가»(그림체)로 지은 이름이다.
 *     한 사전 안에서 두 축이 섞이면 다음 사람이 계열을 못 고른다. 그리고 그림체는 «방금 바뀐 것»이고
 *     또 바뀔 수 있다 — 다음에 누가 이걸 외곽선으로 되돌리면 fill-h 라는 이름은 «거짓»이 되지만
 *     object-h 는 그대로 참이다. 이름은 안 바뀌는 축에 걸어야 한다.
 *
 * ⚠️크기 — width/height 는 14, viewBox 는 «0 0 16 16 그대로»다. 실측하고 정했다
 *   원래 채움 그림은 16x16(viewBox 16), 외곽선은 14x14(viewBox 14)였다. 그냥 16 으로 옮기면
 *   갈아끼우는 21곳의 그림이 «눈에 띄게 커진다». 헤드리스 크롬에서 실제 버튼 안 잉크 크기를 쟀다:
 *     prop-align-btn 가로 — 외곽선@14 = 7x10px · 채움@16 = 10x12px(+43% 폭) · ★채움@14 = 8.75x10.5px(+25%/+5%)
 *     prop-align-btn 세로 — 외곽선@14 = 10x7px · 채움@16 = 12x10px(+43% 높이) · ★채움@14 = 10.5x8.75px
 *   ⇒ 14 가 «덜 튄다». 게다가 이 패널들의 집안 크기가 14 다(js/props 아이콘 실측: 14 가 104개, 16 은 31개).
 *   ⛔viewBox 는 안 건드렸다 — 16 짜리 좌표로 그린 path 를 viewBox 14 로 바꾸면 그림이 «잘린다».
 *     width/height 만 줄이면 통째로 축소될 뿐 안 잘린다.
 *   ★대가도 적는다: 원래 16 이던 prop-frame 6곳과 msp 6곳은 잉크가 약 12.5% «작아진다».
 *     21곳을 최대 43% 키우는 것보다 이쪽이 작다고 봤다. 되돌리려면 이제 여기 한 곳만 고치면 된다.
 *
 * ★SVG 공백은 «없는 판»으로 통일했다. 레포엔 줄바꿈·들여쓰기가 든 복붙본과 한 줄짜리
 *   복붙본이 섞여 있어서(prop-text-template vs prop-iconify), 사전이 둘 중 하나를 안 고르면
 *   「같은 그림인데 문자열이 다른」 상태가 사전 «안»으로 따라 들어온다.
 *
 * ★키(key)는 계열마다 다르다. 가로축은 left/center/right, 세로축은 top/middle/bottom.
 *   arrow-h 만 stack(☰)을 하나 더 갖는다 — prop-step.js 의 4번째 버튼이 쓰는 그림이다.
 *   ⛔키는 «그림 선택자»일 뿐이고 `data-align` 값이 아니다. 우연히 같아 보여도 헬퍼는
 *     둘을 잇지 않는다(아래 alignBtn 주석 1번 참조).
 */
export const ALIGN_ICONS = {
  text: {
    left:   '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="13" y2="3"/><line x1="1" y1="6" x2="9" y2="6"/><line x1="1" y1="9" x2="11" y2="9"/><line x1="1" y1="12" x2="7" y2="12"/></svg>',
    center: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="13" y2="3"/><line x1="3" y1="6" x2="11" y2="6"/><line x1="2" y1="9" x2="12" y2="9"/><line x1="4" y1="12" x2="10" y2="12"/></svg>',
    right:  '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="1" y1="3" x2="13" y2="3"/><line x1="5" y1="6" x2="13" y2="6"/><line x1="3" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/></svg>',
  },
  'object-h': {
    left:   '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill="currentColor" d="M3 2h1.5v12H3zM6.5 4.5h6a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-6zm0 4h4a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-4z"/></svg>',
    center: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill="currentColor" d="M7.25 2h1.5v2.5H13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5H8.75v1H12a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5H8.75V14h-1.5v-2.5H4a.5.5 0 0 1-.5-.5V9a.5.5 0 0 1 .5-.5h3.25v-1H4a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5h3.25z"/></svg>',
    right:  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill="currentColor" d="M11.5 2H13v12h-1.5zM3.5 4.5h6a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-6zm2 4h4a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-4z"/></svg>',
  },
  'object-v': {
    top:    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill="currentColor" d="M2 3v1.5h12V3zM4.5 6.5v6a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-6zm4 0v4a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-4z"/></svg>',
    middle: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill="currentColor" d="M2 7.25h2.5V4a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v3.25h1V4a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v3.25H14v1.5h-2.5V12a.5.5 0 0 1-.5.5H9a.5.5 0 0 1-.5-.5V8.75h-1V12a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V8.75H2z"/></svg>',
    bottom: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill="currentColor" d="M2 11.5v1.5h12v-1.5zM4.5 3.5v6a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-6zm4 2v4a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-4z"/></svg>',
  },
  /* ★★여기부터는 SVG 가 «아니다». 레포가 실제로 쓰는 그림이 문자 그 자체다.
   *   SVG 로 «승격»시키면 이관이 1:1 치환이 아니게 되고 렌더가 바뀐다 — 그건 다른 작업이다. */
  'arrow-h': { left: '←', center: '↔', right: '→', stack: '☰' },
  'arrow-v': { top: '↑', middle: '↕', bottom: '↓' },
};

/**
 * 정렬 버튼 «하나»의 HTML 문자열을 만든다. ★반환값은 노드가 아니라 문자열이다.
 *
 * @param {string} family  ALIGN_ICONS 의 계열 키
 * @param {string} key     그 계열 안의 그림 키. ★«그림 선택자»일 뿐이다
 * @param {object} o
 * @param {string}  o.label   ★필수. aria-label 이 된다. 비면 throw
 * @param {string}  [o.title] title 속성. ★있던 문자열을 «그대로» 넘기는 자리
 * @param {boolean} [o.active] true 면 클래스에 ' active' 를 붙인다
 * @param {string}  [o.cls]   추가 클래스(공백 구분)
 * @param {object}  [o.attrs] 그대로 통과시킬 속성들. 예: {'data-align':'left', id:'x'}
 * @param {string}  [o.style] 인라인 style
 * @param {string}  [o.base='prop-align-btn'] 기반 클래스. 'msp-align-btn' 등으로 «교체»된다
 * @returns {string} `<button …>ICON</button>`
 *
 * ★이 함수가 «하지 않는» 것 — 넷 다 실제 결함에 대응한다
 *
 * 1. ⛔`data-align` 을 «자동 생성하지 않는다».
 *    prop-text-wireup-align.js:9 가 `.prop-align-btn` 을 «전부» 잡아 `dataset.align` 유무로만
 *    거른다. 즉 정렬이 아닌 버튼(모양·테두리·회전 피커도 이 클래스를 쓴다)에 data-align 이
 *    실수로 붙으면 «엉뚱한 블록이 조용히 정렬된다». key 가 'left' 라는 이유로 헬퍼가
 *    data-align 을 붙이면 그 사고가 «전 호출부에서 동시에» 난다. 호출부가 attrs 로
 *    명시할 때만 나간다.
 *
 * 2. ⛔따옴표를 «이스케이프하지 않는다».
 *    prop-banner02.js:167 이 title 을 `.replace(/"/g,'&quot;')` 로 «이미» 이스케이프해서 넘긴다.
 *    여기서 또 하면 `&amp;quot;` 가 화면에 보인다. 이스케이프는 지금도 호출부 책임이고,
 *    그 책임을 옮기는 건 동작 변경이다 — 이 커밋은 현행 동작을 보존한다.
 *
 * 3. ★`active` 앞 공백은 «정확히 한 칸».
 *    현행이 `class="prop-align-btn${… ? ' active' : ''}"` 이다. 붙여 쓰면
 *    `prop-align-btnactive` 라는 «존재하지 않는 클래스» 하나가 되고, CSS 가 안 걸려도
 *    콘솔은 조용하다 — 눈으로만 잡히는 종류의 사고다.
 *
 * 4. ★`style` 을 «빠뜨리지 않는다».
 *    prop-step.js 4곳이 `style="flex:1"` 로 폭을 잡는다. 빠지면 버튼 폭이 눈에 띄게 바뀐다.
 *
 * ★속성 순서는 class → attrs → style → title → aria-label 로 «고정»이다.
 *   DOM 엔 영향이 없지만, 순서가 흔들리면 「바이트 단위로 같은가」를 사람이 눈으로 못 맞춘다.
 */
export function alignBtn(family, key, o = {}) {
  const fam = ALIGN_ICONS[family];
  if (!fam) throw new Error(`alignBtn: 모르는 계열 "${family}" — ALIGN_ICONS 키는 ${Object.keys(ALIGN_ICONS).join(', ')}`);
  const icon = fam[key];
  if (icon === undefined) throw new Error(`alignBtn: "${family}" 계열에 "${key}" 그림이 없다 — 쓸 수 있는 키는 ${Object.keys(fam).join(', ')}`);
  /* ★label 은 «있으면 좋은 것»이 아니라 이 헬퍼의 «존재 이유»다. 지금 레포엔 title 도 없이
   *   `←` 만 든 버튼이 있고, 스크린리더가 그걸 「왼쪽 화살표」라고 읽는다. 옵셔널로 두면
   *   급한 호출부가 빠뜨리고, 그 순간 이 작업의 값이 0 이 된다. 그래서 throw 다. */
  if (!o.label) throw new Error(`alignBtn(${family}, ${key}): label 은 필수다 — aria-label 이 없으면 스크린리더가 그림/문자를 그대로 읽는다`);
  const { label, title, active, cls, attrs, style, base = 'prop-align-btn' } = o;
  let out = `<button class="${base}${cls ? ' ' + cls : ''}${active ? ' active' : ''}"`;
  // ★attrs 는 «해석하지 않고» 원문 그대로 통과시킨다 — 위 1번.
  for (const [k, v] of Object.entries(attrs || {})) out += ` ${k}="${v}"`;
  if (style) out += ` style="${style}"`;
  if (title) out += ` title="${title}"`;
  return out + ` aria-label="${label}">${icon}</button>`;
}

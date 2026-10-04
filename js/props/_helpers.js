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
 * @param {{cols:number, rows:number}} [opts.cur] ★«지금» 칸 수. 주면 그 칸을 처음부터 칠하고
 *   마우스가 나가도 '—' 가 아니라 그 값으로 되돌아간다. 안 주면 옛 동작(빈 피커 · '—').
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
  /* ★칠하기는 «한 곳»에서만 한다 — hover 미리보기와 «지금 값» 표시가 같은 그림이라
   *   두 벌로 적으면 alive() 때처럼 한쪽이 반드시 뒤처진다(위 주석이 같은 말을 적어 뒀다). */
  const paint = (c, r) => {
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => {
      const cr = +cl.dataset.r, cc = +cl.dataset.c;
      // ★칠하는 조건도 «alive» 를 거친다 — 죽은 칸은 미리보기에도 안 들어간다.
      cl.classList.toggle('active', alive(cr, cc) && cr <= r && cc <= c);
    });
    if (label) label.textContent = `${c} × ${r}`;
  };
  /* ★«지금 몇 칸인가»를 피커가 스스로 말한다 (2026-09-25).
   *   왜 — 이 절이 이제 «기본 접힘»이다(prop-grid.js 의 grd-size-toggle). 접힌 절을 펼친 사람이
   *   맨 먼저 묻는 것은 「지금 어디인가」인데, 전엔 ★hover 하기 «전»까지 아무 칸도 안 칠해졌고
   *   라벨도 '—' 였다 — 즉 마우스를 올려 보기 전엔 현재 값을 «피커로는» 알 수 없었다.
   *   ⇒ opts.cur = { cols, rows } 를 받으면 그 칸을 처음부터 칠하고, 마우스가 나가면 «'—' 가
   *     아니라» 그 값으로 되돌아간다.
   *   ⛔opts.cur 를 «안» 주면 옛 동작 그대로다(아무것도 안 칠하고 '—'). 이 파일을 부르는 곳이
   *     지금 prop-grid.js 하나뿐이라 당장은 한 길만 도는데, 기본값을 바꿔 «조용히» 다른
   *     호출부의 그림을 갈아치우지 않으려고 기본을 옛 쪽에 뒀다. */
  const curC = Number(opts.cur && opts.cur.cols) || 0;
  const curR = Number(opts.cur && opts.cur.rows) || 0;
  const hasCur = alive(curR, curC);
  const clear = () => {
    if (hasCur) { paint(curC, curR); return; }
    picker.querySelectorAll('.grid-picker-cell').forEach(cl => cl.classList.remove('active'));
    if (label) label.textContent = '—';
  };
  picker.addEventListener('mouseover', e => {
    const cell = e.target.closest('.grid-picker-cell');
    if (!cell || cell.classList.contains('grid-picker-cell--off')) return;
    paint(+cell.dataset.c, +cell.dataset.r);
  });
  picker.addEventListener('mouseleave', clear);
  // ★처음 그림 — 위 clear() 와 «같은 코드»를 쓴다(초기와 복귀가 갈리면 마우스 한 번에 그림이 튄다).
  clear();
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
 *   ★[G18 실측 2026-10-03 · 핀 37ab1c65] 위 「호출부 0개」·아래 「146/146 이 innerHTML 안」은 «A단계 그날»의 사실이다.
 *     지금은 alignBtn 호출 46곳·7파일(align-btn-ssot.test.mjs RATCHET). prop-grid.js 의 그리드 정렬 여섯도
 *     9bfffe0f(객체정렬 27곳 채움화)에서 이미 이 헬퍼로 옮겨졌다 — prop-grid.js 안 정렬 SVG 리터럴 0건.
 *     ⇒ G18 은 «옮길 것이 없었다». 대신 조립부를 _iconBtnHtml 로 뽑은 뒤 그 여섯이 핀과 «픽셀 0 차이»임을
 *       tests/dom/grid-block-outline.dom.spec.js G18-1·G18-2 가 지킨다.
 *     이 상태는 tests/unit/align-btn-ssot.test.mjs T1 이 지킨다 — 경로로 찾아라.
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
 * ★블럭 외곽선(G17, 2026-10-03) 버튼 «그림»의 유일한 출처 — 위 ALIGN_ICONS 와 «같은 꼴»(계열 없는 한 단 사전).
 *   엑셀·워드의 테두리 고르기 꼴: 옅은 점선 상자 = «아직 안 그은 변», 칠한 막대 = «긋는 변».
 * ⛔ALIGN_ICONS «안»에 계열로 넣지 않았다 — 그 사전은 「정렬 버튼」 인구조사(align-btn-ssot.test.mjs
 *   T0 래칫·T2 지문)의 모수다. 외곽선은 정렬이 아니므로 거기 섞이면 「정렬 버튼 수」가 거짓이 된다.
 * ★크기·viewBox 는 object-* 와 같다(14 · 0 0 16 16) — 바로 위 Layout 절 정렬 단추와 잉크 크기를 맞춘다.
 * ★키 = 변 이름(top·right·bottom·left) + 일괄 둘(all=「사방」 · none=「없음」).
 *   ⛔키는 «그림 선택자»다. 모델 값(dataset.blockOutline)과 잇는 것은 호출부(prop-grid.js)다.
 */
const _BORDER_BOX = '<rect x="2.5" y="2.5" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="1 1.5" opacity=".5"/>';
/* ★«더하기(＋)» 아이콘 정본 (G15 2026-10-04) — 다음 ＋ 는 여기서 가져간다(⛔손으로 svg 를 또 적지 않는다).
 *   글자 '+' 가 아니라 svg(aria-hidden) — 글자면 블럭 textContent·검색·MCP 읽기에 샌다(E65 실측).
 *   크기는 쓰는 쪽 CSS 가 정한다(width/height 없음 · stroke=currentColor).
 *   ★window.PLUS_ICON_SVG 다리: grid-block.js 는 이 파일을 import 하지 «못한다» — 단위시험 15개가 grid-block.js 를
 *     tmp 로 복사해 import 줄을 글자로 갈아 끼운다(grid-block.js replaceShellKeepChildren 머리말). 그래서 window 로 건넨다. */
export const PLUS_ICON_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M8 3v10M3 8h10"/></svg>';
if (typeof window !== 'undefined') window.PLUS_ICON_SVG = PLUS_ICON_SVG;
/* ★눈(보임/숨김) 아이콘 (E1 Effects 2026-10-04) — 레이어 패널 섹션 눈(js/panels/layer-panel.js 의 두 svg)과 «같은 그림»을 이름으로 둔다.
 *   ⛔레이어 패널 쪽은 이번에 안 옮겼다(그 자리를 바꾸는 시험 위험) — 다음에 옮길 때 여기서 가져간다(두 벌 → 한 벌).
 *   effects-reflect.js 는 import 없이 window 다리로 받는다(PLUS_ICON_SVG 와 같은 까닭). */
export const EYE_ICONS = {
  shown:  '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true" focusable="false"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.8"/></svg>',
  hidden: '<svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true" focusable="false"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><line x1="2" y1="2" x2="12" y2="12"/></svg>',
};
if (typeof window !== 'undefined') window.EYE_ICONS = EYE_ICONS;

export const BORDER_ICONS = {
  top:    `<svg width="14" height="14" viewBox="0 0 16 16" fill="none">${_BORDER_BOX}<path fill="currentColor" d="M2 2h12v1.5H2z"/></svg>`,
  right:  `<svg width="14" height="14" viewBox="0 0 16 16" fill="none">${_BORDER_BOX}<path fill="currentColor" d="M12.5 2H14v12h-1.5z"/></svg>`,
  bottom: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none">${_BORDER_BOX}<path fill="currentColor" d="M2 12.5h12V14H2z"/></svg>`,
  left:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none">${_BORDER_BOX}<path fill="currentColor" d="M2 2h1.5v12H2z"/></svg>`,
  all:    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path fill="currentColor" fill-rule="evenodd" d="M2 2h12v12H2zm1.5 1.5v9h9v-9z"/></svg>',
  none:   `<svg width="14" height="14" viewBox="0 0 16 16" fill="none">${_BORDER_BOX}</svg>`,
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
  return _iconBtnHtml(icon, o);
}

/* ★문자열 조립은 «한 벌» — alignBtn 과 borderBtn 이 같이 쓴다(G17 에서 뽑아냄, 산출 바이트 불변).
 *   ⛔두 헬퍼에 조립을 따로 적지 마라 — 위 「하지 않는 것」 넷이 한쪽에서만 지켜지게 된다. */
function _iconBtnHtml(icon, o) {
  const { label, title, active, cls, attrs, style, base = 'prop-align-btn' } = o;
  let out = `<button class="${base}${cls ? ' ' + cls : ''}${active ? ' active' : ''}"`;
  // ★attrs 는 «해석하지 않고» 원문 그대로 통과시킨다 — 위 1번.
  for (const [k, v] of Object.entries(attrs || {})) out += ` ${k}="${v}"`;
  if (style) out += ` style="${style}"`;
  if (title) out += ` title="${title}"`;
  return out + ` aria-label="${label}">${icon}</button>`;
}

/**
 * 블럭 외곽선 버튼 «하나»의 HTML 문자열 — alignBtn 과 같은 계약(label 필수 · attrs 무해석 · 문자열 반환).
 * ★기반 클래스는 같은 prop-align-btn 이다 — 바로 위 정렬 줄과 굵기·색·간격이 «같은 부품»으로 맞는다.
 *   ⛔data-align 을 붙이지 마라(prop-text-wireup-align.js 가 .prop-align-btn 중 data-align 있는 것을 «정렬»로 잡는다).
 * @param {string} key  BORDER_ICONS 의 키 — top|right|bottom|left|all|none
 * @param {object} o    alignBtn 과 같다
 */
export function borderBtn(key, o = {}) {
  const icon = BORDER_ICONS[key];
  if (icon === undefined) throw new Error(`borderBtn: "${key}" 그림이 없다 — 쓸 수 있는 키는 ${Object.keys(BORDER_ICONS).join(', ')}`);
  if (!o.label) throw new Error(`borderBtn(${key}): label 은 필수다 — aria-label 이 없으면 스크린리더가 그림을 못 읽는다`);
  return _iconBtnHtml(icon, o);
}

/* ═══════════════════════════════════════════════════════════════════════════
   오버레이(플로팅) 토글 버튼 — 텍스트·도형·에셋 «세 패널이 같은 버튼»을 쓴다.
   ───────────────────────────────────────────────────────────────────────────
   ★2026-09-20 (0920b-overlay-extend / T-052) — 현빈 원문 3번 「도형 블럭과 에셋 블럭에도
     오버레이 버튼·기능」. 버튼은 원래 prop-text-template.js 안에 인라인으로 박혀 있었고,
     그걸 두 패널에 «베끼면» 아이콘·툴팁·aria 가 조용히 갈라진다(이 레포 고질 — alignBtn /
     grid-callsite 가 같은 이유로 SSOT 함수가 됐고 *-ssot.test.mjs 가 그걸 지킨다).
   ⛔id 는 패널마다 다르다. 특히 에셋은 `asset-overlay-toggle` 을 쓰면 «안 된다» —
     그 id 는 이미 「Text Overlay(이미지 위 어두운 막+텍스트)」 체크박스가 갖고 있다
     (prop-asset.js · .guard/FEATURE_REGISTRY.md 계약). 새 id 는 `asset-float-toggle`.
   ★동작(진입·이탈·드래그)의 SSOT 는 js/overlay-float.js 다 — 이 함수는 «겉모습»만 낸다.
   ⚠️산출 문자열은 골든 픽스처(tests/fixtures/text-props-golden*.html)가 바이트로 고정한다 —
     들여쓰기·줄바꿈까지 그대로 유지할 것(호출부는 8칸 들여쓰기 자리에 놓는다).
═══════════════════════════════════════════════════════════════════════════ */
export function overlayToggleBtnHTML({ id, active = false, title } = {}) {
  const t = title || '오토레이아웃에서 빼서 섹션 위에 절대위치로 띄웁니다(Figma의 Ignore Auto Layout과 같은 개념). 다시 누르면 원래 있던 자리로 돌아갑니다.';
  return `
        <button type="button" class="prop-chain-btn prop-chain-btn--overlay${active ? ' active' : ''}" id="${id}"
          aria-pressed="${active ? 'true' : 'false'}"
          title="${t}">
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2">
            <rect x="1" y="4" width="6" height="6" rx="1"/>
            <rect x="5" y="1" width="6" height="6" rx="1" fill="var(--ui-bg-card)"/>
          </svg>
        </button>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   블록 헤더 SSOT — `.prop-block-label` (아이콘 + 이름 + 브레드크럼 + id)
   ───────────────────────────────────────────────────────────────────────────
   ★2026-09-22 (T-049) — 이 틀이 js/props 안에 «33벌» 복붙돼 있었고, 그중 31벌이
     레이어 이름을 «글자로» 넣지 않고 틀에 그대로 이어붙였다. 이름은 사람·블록 API·MCP·
     템플릿·파일 수신 다섯 갈래로 들어오므로, 「그리는 자리」가 33곳이면 한 곳만 고쳐도
     안 고친 것과 같다. ⇒ 그리는 자리를 여기 하나로 모으고, 이름은 이 함수 «안에서
     한 번만» 글자로 만든다.
   ⛔이름을 «검사»하지 않는다 — 거절하면 멀쩡한 이름(따옴표·꺾쇠 든 제품명)이 죽는다.
     항상 통과시키되 항상 글자로 넣는다.
   ⚠️산출 문자열은 골든 픽스처(tests/fixtures/text-props-golden*.html)가 바이트로 고정한다.
     prop-text-template.js 의 «추출 직전» 바이트가 이 함수의 정본 모양이다 —
     들여쓰기·줄바꿈까지 그대로다.

   @param {string} [icon]        `.prop-block-icon` 안에 «그대로» 들어갈 원문(들여쓰기 포함).
                                 없으면 아이콘 칸 자체를 안 그린다(비교·배너 패널).
   @param {*}      [name]        사용자가 지은 이름. 비면 defaultName 으로 떨어진다.
   @param {string} [defaultName] 이름이 없을 때 쓸 기본 표기.
   @param {string} [crumb]       브레드크럼 문자열. ★undefined 면 칸 자체를 안 그린다
                                 (행·프레임 패널이 원래 그랬다 — '' 와 구분해야 한다).
   @param {string} [id]          블록 id(기계가 지은 값). 비면 id 칸을 안 그린다.
   @param {string} [labelStyle]  `.prop-block-label` 에 붙일 style 속성값(멀티셀렉 전용).
═══════════════════════════════════════════════════════════════════════════ */

/**
 * HTML 특수문자 5종을 전부 덮는다. ★`>` 와 `'` 까지 덮는 것이 이 레포 사본 대부분과 다른 점이다
 * — 홑따옴표 속성 자리에서 뚫리는 사본이 여럿 있었다(prop-comparison.js 의 옛 `_esc`).
 * ⛔새 사본을 만들지 말고 이걸 import 해 써라.
 */
/* ══ 접이식 절 머리의 쉐브론 — «한 벌» (T-234, 2026-09-27) ═══════════════════
 * ★네 곳(prop-grid · prop-banner02 · prop-simple-card · prop-table)이 «들여쓰기까지 똑같은»
 *   SVG 를 각자 인라인으로 그리고 있었다. 다른 것은 «회전을 정하는 표현식» 하나뿐이었다.
 *   그리고 네 곳 주석이 「★네 곳에 같은 마크업으로 산다 … ⛔여기서 «따로» 그리지 마라」라고
 *   ★이미 적고 있었다 — 그 말대로 «따로 그리지 않게» 자리를 만든다.
 *
 * ⛔`--ui-select-caret` 토큰(10×6)으로는 못 모은다 — 그쪽은 CSS `background-image` 이고 이쪽은
 *   인라인 `<svg>` 요소다(★매체가 다르다). 그리고 상자가 «정사각»인 것은 의도다:
 *     ⑴ 잉크를 1.5px 로 맞추려면 viewBox 와 화면 폭이 같아야 한다(10×6 에 폭 10 이면 가늘어진다)
 *     ⑵ ★정사각이라야 −90° 로 돌려도 자리를 안 먹는다(10×6 을 돌리면 6×10 이 되어 제목이 흔들린다)
 *
 * ⛔산출 문자열을 «한 자도» 바꾸지 마라 — 네 곳의 옛 산출과 바이트 동일이어야 한다. 들여쓰기·속성
 *   순서·줄바꿈까지 옛 마크업 그대로다(그것을 tests/unit/disclosure-chevron-ssot.test.mjs 가 문다).
 * @param {boolean} open 펼쳐져 있나 — 펼침 0° · 접힘 −90°
 * @returns {string} `<svg>…</svg>` 한 조각 */
export function disclosureChevronHtml(open) {
  return `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round"
             style="flex:0 0 auto;transform:rotate(${open ? 0 : -90}deg);transition:transform .12s;">
          <path d="M1 3l4 4 4-4"/>
        </svg>`;
}

export function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* id 칸 클릭 → 복사. ★«한 번만» 문서에 건다.
   ⛔전엔 인라인 on* 핸들러였고 값이 그 «속성 안의 JS 문자열»에 들었다 — 문맥이
     셋(본문·속성·JS)이고, on* 속성값은 HTML 실체참조가 «먼저 풀린 뒤» JS 로 읽히므로
     이스케이프를 한 겹 더 씌워도 그 JS 문자열은 안 닫힌다. 오늘 이 자리에 실리는 값은 기계가 지은
     아이디뿐이라 지금 새지는 않지만, 헤더가 한 자리로 모인 김에 «문맥 자체»를 없앤다.
   ★import 부작용으로 걸지 않는다 — _helpers.js 를 document 없는 vm 에 올려 재는 하네스가 여럿이다
     (tests/unit/_text-template-harness.js). 첫 헤더를 그릴 때 게으르게 건다. */
let _copyWired = false;
function _wireBlockIdCopy() {
  if (_copyWired || typeof document === 'undefined' || !document.addEventListener) return;
  _copyWired = true;
  document.addEventListener('click', (e) => {
    const el = e.target?.closest?.('.prop-block-id[data-copy-id]');
    if (el) window._copyToClipboard?.(el.dataset.copyId);
  });
}

export function blockHeaderHTML({ icon, name, defaultName = '', crumb, id, labelStyle } = {}) {
  const shown = (name === undefined || name === null || name === '') ? defaultName : name;
  if (id) _wireBlockIdCopy();
  return `      <div class="prop-block-label"${labelStyle ? ` style="${labelStyle}"` : ''}>
${icon ? `        <div class="prop-block-icon">
${icon}
        </div>
` : ''}        <div class="prop-block-info">
          <span class="prop-block-name">${escHtml(shown)}</span>${crumb === undefined ? '' : `
          <span class="prop-breadcrumb">${crumb}</span>`}
        </div>
        ${id ? `<span class="prop-block-id" title="클릭하여 복사" data-copy-id="${escHtml(id)}">${escHtml(id)}</span>` : ''}
      </div>`;
}

/* ★window 로도 낸다 — prop-grid.js(그리드 오버레이)가 정적 import 없이 부른다(unit 하네스 대역에 이 이름이 없다). */
if (typeof window !== 'undefined') window.overlayToggleBtnHTML = overlayToggleBtnHTML;   // Node unit 시험엔 window 가 없다

/* 라벨 + 슬라이더 + 숫자 한 줄(.prop-row) — 「좌우 패딩」 줄이 섹션·프레임 두 패널에 있다(F5, 2026-10-03).
   마크업 사본을 두 벌 두지 않으려고 뺐다. 결과 HTML 은 prop-section 에 있던 줄과 «글자 그대로» 같다. */
export function sliderRowHTML(label, sliderId, numberId, { min, max, step, value }) {
  return `<div class="prop-row">
        <span class="prop-label">${label}</span>
        <input type="range" class="prop-slider" id="${sliderId}" min="${min}" max="${max}" step="${step}" value="${value}">
        <input type="number" class="prop-number" id="${numberId}" min="${min}" max="${max}" value="${value}">
      </div>`;
}

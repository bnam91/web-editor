/* ── Grid(다단) 블록 프로퍼티 패널 ──
   구조(컬럼/라인 추가·삭제)는 CDP/updateGridBlock 영역 — 패널은 간격·정렬·행 높이만 다룬다(P1.5: 글자는 캔버스 인라인 편집 — js/block-drag.js). */
import { propPanel } from '../globals.js';
import { parseRatio, buildGridPicker, alignBtn, bindSlider, blockHeaderHTML } from './_helpers.js';
/* ★상·하한은 한 곳에서만 온다 — IMG_MIN_PCT 는 캔버스 코너 드래그(resizeGridImage)가 쓰는
   «그» 하한이다. 패널의 폭(%) 칸이 같은 수를 쓰게 import 한다(손으로 5 를 적지 않는다). */
import { ROW_H_MAX, IMG_MIN_PCT } from '../grid-cell-resize.js';
import { gridRows, getGridModel, gridPreviewLine, gridLineHasText, GRID_ROLES, GRID_COLOR_RE,
         MIN_COLS, MAX_COLS, MIN_ROWS, MAX_ROWS, GRID_CELL_DEFAULT_TEXT, MAX_CELL_LINES,
         gridGaps, GRID_GAP_MAX, GRID_IMG_MAX_BYTES, gridCellsToDataset,
         gridCellBorder, GRID_BORDER_W_MAX, GRID_BORDER_STYLES,
         GRID_CELL_FIELDS, GRID_NESTED_LINE_TYPE } from '../blocks/grid-block.js';
import { showGridGutters, hideGridGutters } from '../overlay-handles.js';
import { buildTypographySectionHtml, buildFillSectionHtml } from './_typo-section.js';
import { wireFontPicker } from './_font-picker.js';
import { wireColorVarChips, parseColorVarName } from './color-var-chips.js';
import { parseAlphaFromColor, swatchHex, wireHexText, parseHex6, formatHex6 } from './color-picker.js';

/* ══ 줄(line) 선택 — 「지금 우측 패널이 보고 있는 줄」 ═══════════════════════
 * ★블록별로 «주소»(r,c,li)를 기억한다. prop-banner02.js 의 _bn2ActiveLine 선례(어휘까지 빌린다).
 * ⛔DOM 노드 참조로 들지 마라 — renderGridBlock 이 innerHTML 을 통째로 갈아끼워 매 조작마다 죽는다.
 *   그래서 «주소»를 들고, 렌더 뒤에 _grdSyncLineMark 로 «다시» 붙인다. */
const _grdActiveLine = new WeakMap();
export function grdSetActiveLine(block, addr) { _grdActiveLine.set(block, addr || null); }
export function grdGetActiveLine(block) { return _grdActiveLine.get(block) || null; }
/* ★0918 grid — «블럭 전체 선택»과 «줄 선택»을 가른다.
 *   이 WeakMap 을 null 로 되돌리는 곳이 없어서, 줄을 한 번 누른 블럭은 블럭을 떠났다 «블럭으로»
 *   다시 골라도(레이어 패널·테두리·Esc 후 재클릭) 옛 {r,c,li} 가 살아났다 → Backspace 가
 *   editor.js 줄 삭제 분기로 새서, 한 줄짜리 칸이면 토스트만 뜨고 블럭이 영영 안 지워졌다.
 *   원칙: 블럭을 «떠나면»(deselectAll) 줄 선택도 해제. WeakMap 은 순회가 안 되니 DOM 을 돈다. */
export function grdClearAllActiveLines(root) {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  if (!scope || !scope.querySelectorAll) return;
  scope.querySelectorAll('.grid-block').forEach(b => grdSetActiveLine(b, null));
}

/* ★0918r2 T-058 — «이 그리드 하나만» 선택돼 있나(피그마식 드릴다운 + 줄 삭제 게이트의 단일 판정).
 *   조상(부모 프레임·섹션)의 .selected 는 뺀다 — _restoreParentFrameSelected 가 그 둘에도 selected 를
 *   붙이므로, 빼지 않으면 프레임 안 그리드는 «늘 이미 선택됨»으로 보여 첫 클릭이 다시 줄이 된다.
 *   자기 자손(.selected 가 붙은 내부 요소)도 뺀다. 그 밖에 하나라도 selected 면 다중선택 → false.
 *   ★쓰는 곳 두 군데 — block-drag 클릭(«이미 선택됐나») · editor.js deleteSelectedFromCanvas(줄 삭제는
 *     «단독 선택»일 때만: ⌘클릭 다중선택·붙여넣기 뒤 [원본+사본] 선택에서 ⌫/⌘X 가 원본의 줄 하나를
 *     조용히 지우던 누수). ⛔사본을 따로 두지 마라 — 두 판정이 갈리면 «보이는 선택»과 «지우는 것»이 갈린다. */
export function grdIsSoleSelected(block) {
  if (!block || !block.classList.contains('selected')) return false;
  const scope = document.getElementById('canvas') || document;
  for (const el of scope.querySelectorAll('.selected')) {
    if (el === block || el.contains(block) || block.contains(el)) continue;
    return false;
  }
  return true;
}
/* ★0922 T-058 — «드릴다운 걸쇠»: 이 블럭의 지금 선택을 «캔버스 클릭»이 세웠나.
 *   피그마식 드릴다운(첫 클릭=블럭·다음 클릭=줄)의 «첫 클릭»을 가리는 유일한 근거다.
 *   ⛔걸쇠를 block-drag.js 모듈 안에만 두면 «캔버스 클릭이 아닌» 선택 경로(Esc 로 상위 이동·
 *     레이어 패널·정본 패널표·MCP selectBlock)가 걸쇠를 풀 길이 없어, 그 뒤 «사용자에겐 첫»
 *     캔버스 클릭이 곧바로 줄로 내려갔다 → 블럭을 지우려는 ⌫ 가 «마지막 줄» 보호에 걸렸다.
 *     그래서 걸쇠도 줄 선택(_grdActiveLine)과 «같은 집»에 둔다 — 푸는 자리가 한 곳이 되게.
 *   ★푸는 자리 = showGridProperties(block, null) «명시적 null»(아래). 거는 자리 = 캔버스 클릭
 *     (block-drag.js) «showGridProperties 를 부른 뒤». 순서가 그래서 클릭 쪽은 안 깨진다. */
let _grdDrillLatch = null;
export function grdMarkCanvasDrill(block) { _grdDrillLatch = block || null; }
export function grdWasCanvasDrilled(block) { return !!block && _grdDrillLatch === block; }
export function grdResetCanvasDrill() { _grdDrillLatch = null; }

/* ★0918r2 T-058 — 줄 선택을 «통째로» 끝낸다(모델 + 화면 마커). 다중선택으로 넘어가는 순간(⌘클릭 토글)·
 *   붙여넣기 뒤처럼 «선택이 블럭 단위로 바뀌는데 deselectAll 을 안 지나는» 문에서 부른다. */
export function grdDropLineSelection(root) {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  if (!scope || !scope.querySelectorAll) return;
  grdClearAllActiveLines(scope);
  scope.querySelectorAll('.grd-line-selected').forEach(el => el.classList.remove('grd-line-selected'));
  scope.querySelectorAll('.grd-cell-selected').forEach(el => el.classList.remove('grd-cell-selected'));
}

/* 캔버스 클릭 한 번이 «어느 줄 주소»를 뜻하는지 — 순수 판정(유닛 테스트 대상).
 *   at        : _gridAddrAt 결과(줄/빈 칸이면 주소, 아니면 undefined)
 *   prevAddr  : 클릭 «직전»(deselectAll 전) 그 블럭의 활성줄
 *   insideCell: 클릭 지점이 그 블럭의 .grd-cell 안인가
 *   wasSelected: 클릭 «직전»에 이 블럭 «하나만» 선택돼 있었나(0918r2 T-058, 피그마식 드릴다운).
 *               false → 무조건 null(첫 클릭 = 블럭 선택 — ⌫ 가 블럭을 지운다).
 *               undefined → true 로 본다(옛 호출부 하위호환).
 *   → (wasSelected 일 때) 줄/빈 칸을 눌렀으면 at. 줄 있는 칸의 여백이면 prevAddr(D5: 선택이 안 튄다).
 *     칸 밖(테두리·패딩·gap)이면 null = 블럭 전체 선택. ★undefined 는 절대 돌려주지 않는다
 *     (undefined 는 showGridProperties 에서 «기억하던 줄 되살리기»라 이 버그의 입구였다). */
export function grdResolveClickAddr({ at, prevAddr, insideCell, wasSelected } = {}) {
  if (wasSelected === false) return null;
  if (at !== undefined) return at;
  if (insideCell) return prevAddr || null;
  return null;
}
if (typeof window !== 'undefined') {
  window.grdSetActiveLine = grdSetActiveLine;
  window.grdGetActiveLine = grdGetActiveLine;
  window.grdClearAllActiveLines = grdClearAllActiveLines;
  window.grdResolveClickAddr = grdResolveClickAddr;
  window.grdIsSoleSelected = grdIsSoleSelected;
  window.grdMarkCanvasDrill = grdMarkCanvasDrill;
  window.grdWasCanvasDrilled = grdWasCanvasDrilled;
  window.grdResetCanvasDrill = grdResetCanvasDrill;
  window.grdDropLineSelection = grdDropLineSelection;
}

/* 캔버스에서 선택된 줄에 마커. ⛔`.selected` 재활용 금지 — editor.js 의
   querySelectorAll('.selected') 범용 조회가 그걸 보고 ⌘M 섹션 합치기가 조용히 죽는다. */
function _grdSyncLineMark(block, addr) {
  document.querySelectorAll('.grd-line-selected').forEach(el => el.classList.remove('grd-line-selected'));
  document.querySelectorAll('.grd-cell-selected').forEach(el => el.classList.remove('grd-cell-selected'));
  if (!addr || !block) return;
  // ★addr.li===null — 「빈 칸」 셀 모드(T-A). 줄이 아니라 «칸 자체」에 마커를 붙인다.
  if (addr.li === null) {
    block.querySelector(`.grd-cell[data-r="${addr.r}"][data-c="${addr.c}"]`)?.classList.add('grd-cell-selected');
    return;
  }
  /* ★중첩 안 줄 (T-200 커밋 ②) — 렌더러가 찍은 «다른 이름»으로 집는다.
     ⛔data-line 으로 못 집는다 — 중첩 안 줄은 그 이름을 일부러 안 쓴다(grid-block.js 머리말).
     ★마커 클래스는 «같은 것»을 쓴다: 사용자에게는 똑같이 「지금 고른 줄」이고,
       「못 고친다」는 말은 우측 패널이 한다(_grdNestHintHtml). 여기서 색을 달리하면
       CSS 한 벌이 더 생기고, 그 뜻을 아무도 안 적어 두게 된다. */
  if (addr.np) {
    block.querySelector(`[data-r="${addr.r}"][data-c="${addr.c}"][data-nroot="${addr.li}"][data-npath="${addr.np}"]`)
      ?.classList.add('grd-line-selected');
    return;
  }
  block.querySelector(`[data-r="${addr.r}"][data-c="${addr.c}"][data-line="${addr.li}"]`)
    ?.classList.add('grd-line-selected');
}
if (typeof window !== 'undefined') window._grdSyncLineMark = _grdSyncLineMark;

/** 주소가 «지금도 유효한 글자 줄»인지 확인해 {r,c,li,line} 으로 돌려준다. 아니면 null.
 *  ⛔DOM 순서 역산 금지 — data-r/data-c/data-line 이 정본이다(grid-block.js 의 addr 규약). */
function _grdResolveAddr(block, addr) {
  if (!addr || !block) return null;
  // ★addr.li===null 은 「빈 셀」(셀 모드, T-A) 표식이다 — Number(null)===0 이라 그냥 두면
  //   li:0 처럼 통과해 버릴 수 있다(그 사이 다른 경로가 그 칸에 줄을 채워 넣은 드문 동시성
  //   케이스). 글자 줄 전용 판정이니 셀 모드는 여기서 명시적으로 걸러낸다.
  if (addr.li === null) return null;
  /* ★중첩 안 줄(np 있음)은 «여기서 끝낸다» — Typography/Fill 절을 안 내놓는다 (T-200 커밋 ②).
     ⛔이 한 줄이 없으면 li(=품은 duo 줄의 index)가 그대로 흘러 패널이 «duo 줄»의 타이포를
       고치려 든다. 손잡이는 움직이는데 화면은 그대로인 «거짓 성공»이 바로 그 꼴이다.
       (쓰는 길 자체가 없다: patchCell 은 lineIndex 정수 하나뿐이라 중첩으로 못 내려간다.) */
  if (addr.np) return null;
  const r = Number(addr.r), c = Number(addr.c), li = Number(addr.li);
  if (![r, c, li].every(Number.isInteger)) return null;
  let cells;
  try { cells = getGridModel(block).cells; } catch (_) { return null; }
  const line = cells?.[r]?.[c]?.lines?.[li];
  if (!line || typeof line !== 'object') return null;
  // ⛔「글자를 담는 줄인가」를 여기서 «다시 판정하지» 않는다 — grid-block.js 가 렌더러로 답한다.
  if (!gridLineHasText(line)) return null;
  return { r, c, li, line };
}

/** 지금 그 줄의 «살아 있는» 데이터(재렌더 뒤에도 최신). */
function _grdLine(block, addr) {
  const hit = _grdResolveAddr(block, addr);
  return hit ? hit.line : null;
}

/** «어떤 줄이든» 유효한 주소인지 확인한다 — 글자 줄만 인정하는 _grdResolveAddr 과 다르다.
 *  이미지/갭 줄도, 아직 줄이 하나도 없는 «빈 셀»(li:null, 셀 모드)도 여기서 받는다.
 *  ⛔_grdResolveAddr 은 «한 글자도 바꾸지 않는다» — Typography/Fill 절 전용 판정이고
 *    tests/dom/grid-typo.dom.spec.js D1-b 가 그 판정식을 직접 단언한다.
 *  addr.li === null → 셀 모드(빈 셀 클릭 포함). 정수 li → 그 줄이 실제로 있어야 한다. */
function _grdResolveAnyAddr(block, addr) {
  if (!addr || !block) return null;
  /* ★중첩 안 줄(np 있음)은 «여기서 끝낸다» (T-200 커밋 ②).
     ★이 한 줄이 패널 «전체»의 바일아웃이다 — 줄바·칸 꾸미기·이미지 절·줄 꾸미기의 html 과
       wire 여섯 자리가 전부 이 함수 하나로 주소를 푼다(_grdWireLineBar·_grdWireCellSection·
       _grdWireImageSection·_grdWireLineSection). T/G/K 단축키
       (grdAddLineToSelectedCell·grdAddIconToSelectedCell)도 같은 문으로 들어온다.
     ⇒ 전부 「선택 없음」과 같은 상태가 된다 = 고치는 손잡이가 «안 나온다».
     ★★⛔이 문은 «둘 중 하나»다 — showGridProperties 의 `_nestHit ? null : …` 가 «또 하나»다.
       한쪽만 떼도 «증상이 안 바뀐다»(실측: 패널 문만 떼면 이 문이 혼자 막는다 —
       tests/dom/grid-nested-line-select.dom.spec.js A3-양성2a·2b 가 그 둘을 갈라 잰다).
       ⇒ 다음 사람이 한쪽만 고쳐 보고 「안 듣는다」고 닫지 마라. ★둘 다 봐야 한다.
       ⛔이 레포는 «문이 둘인 것»이 버릇이다 — 쓰기 쪽(updateGridBlock 의 intake 두 자리)도
         같은 꼴이다. 한쪽만 재면 양성대조가 «초록인데 아무것도 안 재는» 자가 된다
         (그 일이 실제로 이 카드에서 한 번 났다).
     ⛔대신 «그 줄이 무엇인지»는 말해야 한다 — showGridProperties 가 _grdResolveNestAddr 로
       따로 풀어 안내 한 줄(_grdNestHintHtml)을 세운다. */
  if (addr.np) return null;
  const r = Number(addr.r), c = Number(addr.c);
  if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
  let model;
  try { model = getGridModel(block); } catch (_) { return null; }
  if (r < 0 || r >= model.rows.length || c < 0 || c >= model.cols.length) return null;
  if (addr.li === null) return { r, c, li: null, line: null };
  const li = Number(addr.li);
  if (!Number.isInteger(li)) return null;
  const lines = model.cells?.[r]?.[c]?.lines;
  const line = Array.isArray(lines) ? lines[li] : undefined;
  if (!line || typeof line !== 'object') return null;
  return { r, c, li, line };
}

/** ★중첩 안 줄 «전용» 리졸버 (T-200 커밋 ②) — `np`(data-npath) 가 있는 주소만 받는다.
 *  `_grdResolveAnyAddr` 이 np 를 거절하므로, 「그 줄이 무엇인지」는 이 문으로만 알 수 있다.
 *  ⛔읽기 전용이다 — 돌려주는 line 은 «보여 주기» 위한 것이지 고치기 위한 것이 아니다.
 *    (쓰는 길이 없다: patchCell{lineIndex} 는 cells[r][c].lines 로 가는 정수 하나뿐이다.)
 *  ★길은 렌더러가 찍은 그 꼴을 그대로 되짚는다 — `"<열>.<줄>"` 을 `/` 로 이은 것
 *    (grid-block.js `_gridNestAddr`). 마디 수 상한을 여기서 따로 안 적는다 — 모델을 실제로
 *    걸어 내려가다 없으면 null 이 된다(렌더러의 깊이 가드와 «같은 답»에 닿는다). */
function _grdResolveNestAddr(block, addr) {
  if (!addr || !block || typeof addr.np !== 'string' || !addr.np) return null;
  const r = Number(addr.r), c = Number(addr.c), li = Number(addr.li);
  if (![r, c, li].every(Number.isInteger)) return null;
  let model;
  try { model = getGridModel(block); } catch (_) { return null; }
  let cur = model.cells?.[r]?.[c]?.lines?.[li];
  for (const seg of addr.np.split('/')) {
    const m = /^(\d+)\.(\d+)$/.exec(seg);
    if (!m || !cur || cur.type !== GRID_NESTED_LINE_TYPE) return null;
    cur = cur.cols?.[Number(m[1])]?.lines?.[Number(m[2])];
  }
  if (!cur || typeof cur !== 'object') return null;
  return { r, c, li, np: addr.np, line: cur };
}

const _grdRoleOf = (line) => GRID_ROLES[line && line.type] || GRID_ROLES.body;

/* ⚠️자간 «단위 불일치» — 역할값은 em 문자열('0.04em'), 패널의 ${p}-ls-number 는 px 숫자다.
   읽을 땐 px = em × size 로 환산(실측 대조: label 16 × 0.04 = 0.64px · h1 64 × −0.02 = −1.28px),
   쓸 땐 px 를 그대로 저장한다. ⇒ 안 건드린 줄은 계속 em 이라 크기를 바꾸면 자간이 따라오고,
   «직접 정한» 줄만 px 로 고정된다 — 의도된 비대칭(U1-b 가 못박는다). */
function _grdRoleLsPx(role, size) {
  const m = String(role.ls ?? '0').trim().match(/^(-?[\d.]+)em$/);
  if (m) return +(Number(m[1]) * size).toFixed(2);
  const n = Number(role.ls);
  return Number.isFinite(n) ? n : 0;
}

/* 이 줄이 «직접 지정»할 수 있는 타이포 필드 전부 — 요약 한 줄과 [↺ 기본값으로] 가 같은 목록을 쓴다. */
const _GRD_TYPO_FIELDS = ['fontSize', 'weight', 'color', 'lineHeight', 'letterSpacing', 'fontFamily', 'italic', 'strike'];
const _grdHas = (line, k) => line[k] !== undefined && line[k] !== null && line[k] !== '';

/* ══ 셀에 «줄 추가» — 공용 함수 ══════════════════════════════════════════════
 * ★T-A(빈 셀 선택+단축키)·T-B(이미지 새 줄) 둘 다 이 함수 하나로 모인다 — 우클릭 이미지
 *   추가(block-factory.js)·패널 [+ 줄 추가]·빈 셀 3버튼·T/G/K 단축키가 전부 이걸 부른다.
 *   ⛔각자 splice 로직을 복붙하지 않는다(우클릭 이미지 추가 vs 패널 [+ 줄 추가]가 그렇게
 *   두 벌이었다 — 2026-09-16 통합).
 * @param {HTMLElement} block
 * @param {{r:number,c:number}} pos
 * @param {number|null} afterLi  null → 셀 끝에 append(빈 셀 채우기 포함) · 정수 → 그 줄 다음에 삽입
 * @param {object} lineSpec      새로 넣을 줄 데이터(예: {type:'body',text:''})
 * @returns {{ok:true, li:number}|{ok:false, code:'LIMIT'}} */
export function grdAddLine(block, pos, afterLi, lineSpec = { type: 'body', text: '' }, opts = {}) {
  const { r, c } = pos;
  let curLines;
  try { curLines = getGridModel(block).cells?.[r]?.[c]?.lines || []; } catch (_) { curLines = []; }
  // ★상한을 먼저 확인한다 — 실패가 확실한 호출 앞에서 grdSetActiveLine 을 먼저 부르면
  //   존재하지 않는 li 를 가리키게 된다(prop-grid.js 옛 주석의 순서 규약, 그대로 계승).
  if (curLines.length >= MAX_CELL_LINES) {
    window.showToast?.(`⚠️ 줄 추가 실패: 셀당 최대 ${MAX_CELL_LINES}줄`);
    return { ok: false, code: 'LIMIT' };
  }
  const insertAt = (afterLi === null || afterLi === undefined) ? curLines.length : afterLi + 1;
  const newLines = curLines.slice();
  newLines.splice(insertAt, 0, lineSpec);
  /* ★위의 「순서 규약」이 상한 «한 종류»만 지키고 있었다 — updateGridBlock 은 TOO_LARGE·
   *   INVALID 로도 거절한다. 그때 활성줄만 앞으로 가 «없는 li»를 가리켰다(2026-09-20 실측).
   *   ⇒ 되돌릴 수 있게 직전 값을 들고 간다. */
  const prevActive = grdGetActiveLine(block);
  grdSetActiveLine(block, { r, c, li: insertAt });
  // updateGridBlock 이 pushHistory + 재렌더 + 패널 재표시를 스스로 한다(줄 삭제·비율 입력과 같은 원칙).
  const res = window.updateGridBlock?.(block.id, { patchCell: { r, c, lines: newLines } }, opts);
  /* ★반환을 «받는다». 예전엔 안 받고 무조건 {ok:true} 를 돌려줬다 — 호출부(우클릭 이미지 추가 등)는
   *   실패를 알 길이 없어 토스트도 못 띄웠다. 현빈이 본 「그리드 우클릭 이미지 삽입이 안 된다」가
   *   바로 이 거짓 성공이다(2026-09-20, 0920b-grid-image). */
  if (res && res.ok === false) {
    grdSetActiveLine(block, prevActive);
    return { ok: false, code: res.code, message: res.message };
  }
  return { ok: true, li: insertAt };
}

/* ══ 칸 «안»에서 줄의 순서를 바꾼다 — 공용 함수 (0926 ⌘↑/↓) ═══════════════
 * ★왜 여기 있나 — 줄을 «넣는» 길(grdAddLine)·«지우는» 길과 같은 집에 둔다. 셋 다
 *   `patchCell{lines}` 한 문으로 나가고 활성줄(_grdActiveLine)을 같이 옮겨야 한다.
 *   ⛔호출부마다 splice 를 복붙하지 마라 — grdAddLine 머리말의 그 규약이 여기도 그대로다.
 * ★줄 «수»는 안 바뀐다 ⇒ MAX_CELL_LINES 확인이 필요 없다(넣는 길과 다른 점).
 * ⛔중첩(duo) «안»의 줄은 이 함수로 못 옮긴다 — patchCell{lines} 는 바깥 lines[] 만 본다.
 *   그 게이트는 부르는 쪽(editor.js moveGridLineFromCanvas)이 addr.np 로 «먼저» 막는다.
 * @param {HTMLElement} block
 * @param {{r:number,c:number}} pos
 * @param {number} li   옮길 «바깥» 줄의 index
 * @param {number} dir  -1 = 위로 · +1 = 아래로
 * @returns {{ok:true, li:number}|{ok:false, code:'INVALID'|'EDGE'|string}}
 *   EDGE = 칸의 끝이라 갈 자리가 없다(실패가 아니라 «할 일이 없다» — 토스트 안 띄운다). */
export function grdMoveLine(block, pos, li, dir) {
  const { r, c } = pos || {};
  const step = dir < 0 ? -1 : 1;
  let curLines;
  try { curLines = getGridModel(block).cells?.[r]?.[c]?.lines; } catch (_) { curLines = null; }
  /* ⛔`li === null` 은 «빈 칸»(셀 모드, T-A) 표식이다 — Number(null) === 0 이라 그냥 Number 로
     받으면 «li:0 처럼» 통과해 첫 줄이 조용히 움직인다. _grdResolveAddr 이 같은 함정을 같은
     말로 막고 있다(그 주석의 규약을 여기서도 지킨다). ★검사가 실제로 잡았다 —
     tests/unit/grid-line-move-wiring.test.mjs 「무효한 주소는 INVALID」.
     ⚠️문이 둘이다 — 부르는 쪽(editor.js moveGridLineFromCanvas)도 `li !== null` 을 본다.
       한쪽만 떼면 증상이 안 바뀐다. 양성대조는 둘을 갈라 재라. */
  const from = li === null ? NaN : Number(li);
  if (!Array.isArray(curLines) || !Number.isInteger(from) || from < 0 || from >= curLines.length) {
    return { ok: false, code: 'INVALID' };
  }
  const to = from + step;
  if (to < 0 || to >= curLines.length) return { ok: false, code: 'EDGE' };
  const newLines = curLines.slice();
  newLines.splice(to, 0, newLines.splice(from, 1)[0]);
  /* ★활성줄을 «먼저» 옮긴다 — updateGridBlock 이 스스로 재렌더 + showGridProperties 를 부르므로,
   *   뒤에 옮기면 패널과 캔버스 마커가 «옛 자리»를 한 번 그린다(grdAddLine 의 순서 규약).
   *   ⛔실패하면 되돌린다(같은 규약 — 없는 li 를 가리키면 패널이 빈 줄을 띄운다). */
  const prevActive = grdGetActiveLine(block);
  grdSetActiveLine(block, { r, c, li: to });
  // updateGridBlock 이 pushHistory + 재렌더 + 패널 재표시를 스스로 한다(줄 추가·삭제와 같은 원칙).
  const res = window.updateGridBlock?.(block.id, { patchCell: { r, c, lines: newLines } });
  if (res && res.ok === false) {
    grdSetActiveLine(block, prevActive);
    return { ok: false, code: res.code, message: res.message };
  }
  return { ok: true, li: to };
}
if (typeof window !== 'undefined') window.grdMoveLine = grdMoveLine;

/* ══ 그리드 이미지 커밋 실패 토스트 — «한 벌»로 모은다 ═══════════════════════
 * ★같은 문구가 세 벌이었다(block-factory.js 우클릭 교체 · 이 파일 패널 [이미지 선택…] ·
 *   block-drag.js 빈 슬롯 더블클릭). 네 번째를 쓰지 말고 이걸 불러라.
 * ⛔성공(ok:true)엔 아무것도 안 띄운다 — 화면이 바뀌는 게 곧 피드백이다. */
export function grdToastImgFail(res) {
  if (!res || res.ok !== false) return false;
  const msg = res.code === 'TOO_LARGE'
    ? '⚠️ 이미지가 너무 큽니다 — 더 작은 파일로 다시 시도해 주세요'
    : res.code === 'LIMIT'
      ? `⚠️ 줄 추가 실패: 셀당 최대 ${MAX_CELL_LINES}줄`
      /* ~~[폐기 · 2026-09-27] `EMPTY_CELL_LINES` 분기 — 「내용이 남은 마지막 칸입니다」~~
           ⇒ **그 code 자체가 없어졌다.** 현빈 지시 「t230 > 마지막 한칸도 비울 수 있게 해줘」로
             grid-block.js 의 `_gridRejectAllCellsEmpty` 를 함수째 지웠다. 뜰 일이 없는 문구다.
         ★역사 두 줄을 남긴다 — 이 자리 문구는 하루 사이 두 번 바뀌었다:
           0925 「마지막 줄은 지울 수 없습니다」 → 0926 「내용이 남은 마지막 칸입니다」 → 0927 없음.
           ⛔셋 다 «막는 문»을 설명하던 말이다. 다시 막을 일이 생기면 문구부터 새로 쓰라는 뜻이다. */
      : res.code === 'LINES_NOT_ARRAY'
        ? '⚠️ 줄 목록의 모양이 잘못됐습니다 — 칸을 비우려면 마지막 줄을 삭제하세요'
        : '❌ 이미지 작업 실패: ' + (res.message || res.code || '알 수 없는 오류');
  window.showToast?.(msg);
  return true;
}
if (typeof window !== 'undefined') window.grdToastImgFail = grdToastImgFail;

/* ══ UI 파일 입구 게이트 — «파일 크기»로 먼저 거른다 ═════════════════════════
 * ★문자열 길이(GRID_IMG_MAX_CHARS)가 아니라 바이트로 잰다. 그쪽 캡은 MCP/IPC 통로 전용이고,
 *   사람이 고른 파일은 opts.trusted 로 그 캡을 건너뛰기 때문에 «여기»가 유일한 방벽이다.
 *   선례: prop-zoom.js _applyZoomImage(5MB) · image-handling.js ASSET_IMAGE_MAX_BYTES(20MB).
 * @returns {boolean} 통과하면 true, 막으면 (토스트 띄우고) false */
export function grdImageFileOk(file) {
  if (!file) return false;
  if (file.type && !String(file.type).startsWith('image/')) {
    window.showToast?.('⚠️ 이미지 파일만 넣을 수 있습니다');
    return false;
  }
  if (file.size > GRID_IMG_MAX_BYTES) {
    window.showToast?.(`⚠️ ${Math.round(GRID_IMG_MAX_BYTES / 1024 / 1024)}MB 이하 이미지만 지원`);
    return false;
  }
  return true;
}
if (typeof window !== 'undefined') window.grdImageFileOk = grdImageFileOk;
if (typeof window !== 'undefined') window.grdAddLine = grdAddLine;

/* SVG 마크업 → data URI. 아이콘 새 줄은 기존 image 라인 타입을 그대로 쓴다(현빈 확정:
 * 재착색 불필요 → 새 icon 타입·새 새니타이저 불필요, GRID_LINE_FIELDS 변경 없음). */
function _grdSvgToDataUri(svg) {
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(String(svg || ''))));
}

/* ══ 전역 T/G/K 단축키 → 그리드 우선처리 ═══════════════════════════════════
 * editor.js 의 addText/addGap 분기, 그리고 하드코딩된 K 분기가 «먼저» 이걸 부른다.
 * 정확히 하나의 그리드 블록이 selected 이고 그 블록에 «기억된 주소»가 유효할 때만 처리해
 * true 를 돌려준다 — false 면 호출부가 기존 전역 동작(텍스트/갭 블록 추가)으로 흘려보낸다. */
export function grdAddLineToSelectedCell(type) {
  const blocks = document.querySelectorAll('.grid-block.selected');
  if (blocks.length !== 1) return false;
  const block = blocks[0];
  const hit = _grdResolveAnyAddr(block, grdGetActiveLine(block));
  if (!hit) return false;
  const lineSpec = type === 'gap' ? { type: 'gap', height: 16 } : { type: 'body', text: '' };
  const res = grdAddLine(block, { r: hit.r, c: hit.c }, hit.li, lineSpec);
  return !!(res && res.ok);
}
if (typeof window !== 'undefined') window.grdAddLineToSelectedCell = grdAddLineToSelectedCell;

/* K 단축키(아이콘) — 위와 같은 게이트이지만 피커가 비동기다. 반환은 「게이트를 통과해
 * 피커를 열었나」다(삽입 성공 여부가 아니다) — 호출부는 이 값으로 전역 흐름 여부만 정한다. */
export function grdAddIconToSelectedCell() {
  const blocks = document.querySelectorAll('.grid-block.selected');
  if (blocks.length !== 1) return false;
  const block = blocks[0];
  const hit = _grdResolveAnyAddr(block, grdGetActiveLine(block));
  if (!hit) return false;
  window.openIconifyModal?.((picked) => {
    const imgSrc = _grdSvgToDataUri(picked.svg);
    grdToastImgFail(grdAddLine(block, { r: hit.r, c: hit.c }, hit.li, { type: 'image', imgSrc, height: picked.size || 64 }));
  });
  return true;
}
if (typeof window !== 'undefined') window.grdAddIconToSelectedCell = grdAddIconToSelectedCell;

/* ══ 줄 «종류» 명부 — ①줄 추가와 ②종류 바꾸기가 «같은 상수·같은 부품»을 쓴다 ═══════
 * ★역할 이름은 grid-block.js 의 GRID_ROLES «한 곳»에서 뜬다 — 여기 손으로 베끼면 역할이
 *   하나 늘 때 한쪽만 늙는다(이 레포의 고질: 열거 자리가 흩어지면 절반만 고쳐진다).
 * ★선례 = prop-banner02.js 의 `data-line-kind` select — «단추를 늘리는 대신 고르게 한다».
 *   ⛔역할마다 단추를 내지 않는다: 240px 패널에 여섯이 안 들어가고, 역할이 늘면 또 는다.
 * ⛔두 벌 만들지 마라 — 아래 두 select(추가·바꾸기)가 이 상수와 이 빌더를 같이 쓴다. */
const _GRD_KIND_KO = {
  label: '작은제목', h1: '제목 1', h2: '제목 2', h3: '제목 3', body: '본문', caption: '캡션',
  image: '아이콘', gap: '여백',
  /* ⛔여기에 «명부 밖 종류»(중첩·막대)의 이름표를 더하지 마라 — 2026-09-24 해 보고 되돌렸다.
     tests/unit/grid-rename-residue.test.mjs S1 이 빨강을 냈다: 그 옛 이름은 2026-09-05 개명에서
     «데이터 토큰»으로만 남기기로 한 것이고, ALLOW ⑷ 가 그 토큰을 grid-block.js 의 렌더 분기
     «한 줄»로 묶어 뒀다. 여기 키로 적으면 그게 두 곳이 된다 — 그 규칙이 막는 바로 그것이다.
     ⇒ 이름표 없이 간다. `_grdKindKo` 가 모르는 키엔 «그 종류 이름 그대로»를 돌려주고,
       줄바 요약이 이미 `(body)`·`(h2)` 처럼 그대로 보여 주고 있어 새 꼴도 아니다.
     ★사람이 읽을 이름을 줄지는 «현빈이 고르실 문제»다 — 주려면 ALLOW 를 넓히는 결정이 먼저다. */
};
const _grdKindKo = (k) => _GRD_KIND_KO[k] || k;
/** 글자 줄 «역할» — GRID_ROLES 에서 뜬다(손으로 안 적는다). */
const _GRD_ROLE_KINDS = Object.keys(GRID_ROLES);
/** ★줄 종류 명부 «하나» — ①추가와 ②바꾸기가 «이것 하나»를 읽는다(설계 M7).
 *  ⛔둘로 가르지 마라 — 「추가로는 되는데 바꾸기로는 안 되는 종류」가 생기고, 종류가 하나 늘 때
 *    한쪽만 늙는다(이 레포의 고질: 비율 상한이 한 곳만 4로 올라가 4열 입력이 조용히 무시됐다). */
const _GRD_KINDS = [..._GRD_ROLE_KINDS, 'image', 'gap'];
const _grdKindOptsHtml = (kinds, cur, prefix = '') => kinds
  .map(k => `<option value="${k}"${k === cur ? ' selected' : ''}>${prefix}${_grdKindKo(k)}</option>`).join('');

/** ①줄 추가 — `[+ 줄 추가 ▾]` 한 자리. 고른 «그 순간» 그 종류로 줄이 생긴다.
 *  ⛔단추 줄에 select 를 «끼우지» 않는다 — 단추 셋(206px)＋select 면 240px 패널을 넘는다.
 *    그래서 [+ 줄 추가] 단추를 이 select 로 «갈음»했다(자리 수는 그대로).
 *
 * ⛔★「중첩 줄(칸 안을 열로 나누기)」을 이 select 에 «넣지 마라» — T-221 에서 넣어 봤고 되돌렸다.
 *   검사 «둘»이 막는다(tests/dom/grid-cell-panel-handles.dom.spec.js):
 *     E12 「추가」와 「종류 바꾸기」가 내놓는 명부가 «같아야» 한다 — 두 벌이면 한쪽만 늙는다.
 *         ⇒ 추가에만 넣으면 여기서 깨진다. 그렇다고 «바꾸기»에도 넣으면 글이 있는 줄을
 *           중첩으로 바꿀 때 그 글이 통째로 사라진다(다른 결함을 만든다).
 *     E13 «페이로드 없이 고르면 줄이 사라지는» 종류가 목록에 없어야 한다 — 중첩은 cols 가
 *         없으면 렌더러가 `return ''` 한다. E13 머리말이 「종류 목록이 늘어나는 그 패치에서
 *         문다」라고 «미리» 적어 두었고, 실제로 그 패치에서 물었다.
 *   ⇒ ★그래서 손잡이를 «우클릭 메뉴»로 냈다(index.html `#bcm-grid-nested` ＋ block-factory.js).
 *     지키는 그물: tests/dom/grid-nested-create.dom.spec.js */
const _grdAddKindSelectHtml = () => `
        <select class="prop-select" id="grd-line-add-kind" style="flex:1 1 96px;min-width:0;width:auto;"
                title="고른 종류로 새 줄을 만든다 (단축키 T=텍스트 · G=여백 · K=아이콘)">
          <option value="">+ 줄 추가…</option>
          ${_grdKindOptsHtml(_GRD_KINDS, null, '+ ')}
        </select>`;

/** ②종류 바꾸기 — 이미 있는 줄의 종류를 바꾼다(지우고 다시 만들 필요 없이).
 *  ★명부는 ①추가와 «같은 _GRD_KINDS» 다 — 아이콘·여백으로도 바꿀 수 있어야 「추가로는 되는데
 *    바꾸기로는 안 되는 종류」가 안 생긴다(M7). */
/* ★★명부에 «없는» 종류를 고른 경우 — 거짓말을 하지 않는다 (2026-09-24)
 *   렌더러가 그리는 줄 종류가 이 명부보다 많다. 소스 실측:
 *     렌더러 `_gridLineHtml` 의 type 분기 = gap · image · duo · graph  ＋ GRID_ROLES 6개
 *     이 명부 `_GRD_KINDS`               = GRID_ROLES 6개 ＋ image ＋ gap   ⇒ duo · graph 가 빠졌다
 *   ~~[폐기 · 2026-09-24] 그 둘이 빠진 채로도 select 는 «아무 말 없이» 첫 옵션을 골라 보였다~~
 *   무엇이 있었나 (실측, 기준선 7780267) — duo 줄·graph 줄을 고르면 둘 다
 *     selectedIndex 0 → value "label" → 보이는 글자 「작은제목」.
 *     같은 절의 요약 줄은 «(duo)»·«(graph)» 라고 «바르게» 말하는데 드롭다운만 달랐다.
 *     ⇒ 한 패널 안에서 두 문장이 어긋났고, 어긋난 쪽이 «누를 수 있는 쪽»이었다.
 *   그리고 그 거짓을 믿고 「본문」으로 바꾸면 중첩이 통째로 날아간다(실측):
 *     before lines[1] = {type:'duo', cols:[…중첩속…]} · 캔버스 .grd-nested 1개
 *     after  lines[1] = {type:'body'}                · 캔버스 .grd-nested 0개, 글자 사라짐
 *     (줄 자체가 지워지지는 «않는다» — 줄 수는 3 그대로고 cols 만 사라진다. ⌘Z 로 돌아온다.)
 * ★고친 방식 — «만들 수 있는 것»은 한 개도 안 늘렸다
 *   명부 밖 종류일 때만 `disabled` 인 머리 옵션을 하나 앞에 세워 그것을 selected 로 둔다.
 *   ⇒ ⑴ 패널이 사실을 말한다 ⑵ 「+ 줄 추가」 목록은 그대로다(거긴 _GRD_KINDS 만 읽는다)
 *     ⑶ 일부러 다른 종류를 고르는 길은 «그대로» 열려 있다(되돌아갈 문을 안 닫는다).
 *   ⛔duo·graph 를 «만들 수 있게» 할지는 여기서 안 정한다 — 중첩·막대는 손잡이가 더 필요하고,
 *     그건 현빈이 고르실 문제다. 이 커밋이 닫은 것은 «거짓말» 하나뿐이다.
 *   ★선례 — 머리에 값 없는 옵션을 세우는 꼴은 이 파일이 이미 쓴다(_grdAddKindSelectHtml 의
 *     `<option value="">+ 줄 추가…</option>`). 새 꼴을 만들지 않았다.
 * 지키는 그물: tests/dom/grid-panel-icon-spec.dom.spec.js (A8) */
const _grdKindSelectHtml = (line) => {
  const cur = line.type || 'body';
  const known = _GRD_KINDS.includes(cur);
  const head = known ? '' :
    `<option value="" disabled selected>${_grdKindKo(cur)} — 패널에서 못 만듦</option>`;
  const title = known
    ? '이 줄의 종류를 바꾼다'
    : `이 줄은 «${_grdKindKo(cur)}»(${cur}) 다 — 이 패널에선 만들 수 없는 종류다. `
      + '다른 종류를 고르면 바뀌지만, 그때 이 줄의 내용은 사라진다(⌘Z 로 복원).';
  return `
        <select class="prop-select" id="grd-line-kind" title="${title}">
          ${head}${_grdKindOptsHtml(_GRD_KINDS, known ? cur : null)}
        </select>`;
};

/** 종류를 바꿀 때 «앞 종류의 짐»을 턴다(설계 M3).
 *  ★image → body 로 바꿨는데 imgSrc 가 남으면 dataURL 수백 KB 가 저장본에 눌러앉는다.
 *    height/widthPct 도 같다 — 글자 줄은 안 읽는데 다음에 다시 image 로 바꾸면 되살아난다.
 *  ⛔undefined 로 «키를 없앤다» — _gridMergeLine 이 Object.assign 이라 JSON 에서 사라진다.
 *  ⛔여기 적는 이름은 GRID_LINE_FIELDS 안에 있어야 한다(아니면 updateGridBlock 이 통째로 거절한다).
 *  ⛔★`text` 를 여기 넣지 마라 — 역할끼리 바꾸는 길(h2→body)이 «같은 함수»를 지나므로
 *    사용자가 쓴 글자가 통째로 지워진다. 실측으로 당했다(2026-09-23):
 *      before {type:'h2', text:'소중한 제목'} → after {type:'body', text:''}
 *    글자가 뜻이 없어지는 것은 «글자 아닌 줄»(gap/image)로 갈 때뿐이고, 그건 grid-block.js 의
 *    _gridMergeLine 이 «렌더러가 안 읽는 키»로 알아서 턴다 — 여기서 손으로 겹쳐 세지 않는다. */
const _GRD_KIND_SHED = { imgSrc: undefined, height: undefined, widthPct: undefined };

/** 두 select 의 배선 — 추가는 «고르면 바로», 바꾸기는 «지금 줄»에만.
 *  @param {number|null} afterLi  null → 칸 끝에 붙인다(빈 칸) · 정수 → 그 줄 다음 */
function _grdWireKindSelects(block, r, c, afterLi) {
  const addSel = document.getElementById('grd-line-add-kind');
  addSel?.addEventListener('change', () => {
    const kind = addSel.value;
    addSel.value = '';                       // 「+ 줄 추가…」로 되돌린다(다음에 또 고를 수 있게)
    if (!kind) return;
    if (kind === 'image') {
      // 아이콘은 피커가 비동기다 — 「+ 아이콘 (K)」 단추와 «같은 길»로 보낸다(두 벌 금지).
      window.openIconifyModal?.((picked) => {
        grdToastImgFail(grdAddLine(block, { r, c }, afterLi,
          { type: 'image', imgSrc: _grdSvgToDataUri(picked.svg), height: picked.size || 64 }));
      });
      return;
    }
    grdToastImgFail(grdAddLine(block, { r, c }, afterLi,
      kind === 'gap' ? { type: 'gap', height: 16 } : { type: kind, text: '' }));
  });

  if (afterLi === null) return;              // 빈 칸엔 «바꿀 줄»이 아직 없다
  const kindSel = document.getElementById('grd-line-kind');
  kindSel?.addEventListener('change', () => {
    /* ⛔머리 옵션(명부 밖 종류 표시, value="")은 «값이 아니다» — 고른 것으로 치지 않는다.
       disabled 라 마우스로는 못 고르지만 키보드·스크립트 경로가 남아 있다. 위 ①추가 select 의
       `if (!kind) return;` 과 «같은 가드»다(두 벌로 갈라 두지 않는다). */
    if (!kindSel.value) return;
    let cur = '';
    try { cur = (getGridModel(block).cells?.[r]?.[c]?.lines || [])[afterLi]?.type || 'body'; } catch (_) {}
    if (kindSel.value === cur) return;       // 같은 값 = 화면이 안 변한다(updateGridBlock 이 거절한다)
    const change = (extra) => _grdToastCellFail(window.updateGridBlock?.(block.id,
      { patchCell: { r, c, lineIndex: afterLi, type: kindSel.value, ..._GRD_KIND_SHED, ...extra } }));
    if (kindSel.value === 'image') {
      // 아이콘은 피커가 «먼저» 온다 — 취소하면 아무것도 안 바꾼다(빈 이미지 자리를 안 남긴다).
      window.openIconifyModal?.((picked) => {
        change({ imgSrc: _grdSvgToDataUri(picked.svg), height: picked.size || 64 });
      });
      return;
    }
    /* ⛔역할끼리 바꿀 땐 아무것도 덮지 않는다 — 글자를 그대로 둬야 한다(위 ⛔ 참조). */
    change(kindSel.value === 'gap' ? { height: 16 } : {});
  });
}

/** 줄바 요약 한 줄 — ⛔두 벌 만들지 마라.
 *  «처음 그릴 때»(_grdLineBarHtml)와 «제자리 갱신»(_grdRefreshSummary)이 이 함수 «하나»를 쓴다.
 *  한 곳만 고치면 타이포를 한 번 만질 때마다 옛 문구가 돌아온다(2026-09-25 R4 가 본 자리).
 *
 *  ★2026-09-25 R4 — 이미지·갭 줄에서도 「직접 지정 0 · 역할 기본 8」이라 «타이포 수»를 셌다.
 *    그 줄엔 타이포 필드가 뜻이 없다 — 옆 [↺ 기본] 단추가 그래서 disabled 다. 판정은
 *    이미 있던 gridLineHasText 하나로 가른다(새 판정을 만들지 않는다). */
function _grdSummaryText(r, c, li, line) {
  const head = `${r + 1}행 ${c + 1}열 · ${li + 1}번째 줄`;
  if (!gridLineHasText(line)) {
    const kind = line.type === 'image' ? '그림 줄' : line.type === 'gap' ? '여백 줄' : `${line.type || 'body'} 줄`;
    return `${head} — ${kind} · 타이포 없음`;
  }
  const nSet = _GRD_TYPO_FIELDS.filter(k => _grdHas(line, k)).length;
  return `${head} (${line.type || 'body'}) — 직접 지정 ${nSet} · 역할 기본 ${_GRD_TYPO_FIELDS.length - nSet}`;
}

/* ══ 줄바(line bar) — 요약 + [종류▾] / [+ 줄 추가▾]·[줄 삭제]·[↺ 기본값으로] ══
 * ★Typography 절에서 분리됐다(2026-09-16) — 이전엔 «글자 줄»에서만 떴다(_grdResolveAddr 이
 *   텍스트 줄만 인정해서, prop-grid.js 옛 _grdTypoSectionsHtml 안에 같이 있었다). 이미지·갭
 *   줄, «빈 셀»도 줄을 추가/삭제할 수 있어야 하므로 _grdResolveAnyAddr 로 판정한 anyHit 을 받는다.
 * ⛔[↺ 기본값으로]만 텍스트 줄 전용이다 — 이미지·갭엔 타이포 필드가 없다. */
/* ★2026-09-23 — 아래 `!anyHit` 안내는 «블럭은 골랐는데 칸/줄은 아직 안 고른» 상태에서만 뜬다.
 *   옛 문구는 「칸이나 줄을 «클릭»하면」이었는데, 사용자는 «이미 칸을 클릭했다» —
 *   그 클릭이 «블럭»을 골랐고(2단 선택: 블럭 → 칸), 칸은 «한 번 더» 눌러야 잡힌다.
 *   ⛔안내가 «이미 한 일»을 시키고 있었다. 실측(격리 인스턴스, 창 1440×900):
 *     클릭 1회 → grid-block 선택됨, 칸 손잡이 «안 뜸» / 클릭 2회 → 뜸.
 *   ⛔2단 선택 «자체»는 안 바꾼다 — 블럭 드래그·이동이 거기 매달려 있다. 말을 맞춘다.
 *   ⚠️여기는 JSX 가 «아니다» — 템플릿 문자열이다. 중괄호 주석(JSX 식)을 넣으면 화면에 그대로 찍힌다. */
/* ★2026-09-25 R5 — 「캔버스를 클릭하라」가 «세 조각»으로 흩어져 있었다:
 *   ⑴ 여기(`!anyHit`) ⑵ _grdTypoSectionsHtml 의 `!hit` ⑶ 패널 맨 끝의 「글자는 …더블클릭해 고친다」.
 *   셋이 서로를 모른 채 각각 한 줄씩 썼고, ⑶ 은 `.prop-label`(56px 고정·overflow:hidden)에
 *   갇혀 «193px 중 56px»만 읽혔다(=R1).
 * ⇒ «지시»는 여기 한 문장으로 모은다 — 두 단계(칸 고르기 → 글자 고치기)를 한 줄에 잇는다.
 *   ⑶ 은 «지워지지 않고 이 문장에 흡수됐다»(R1 은 R5 에 흡수). ⑵ 는 지시를 버리고
 *   «이 절의 상태»만 말하게 바꿨다(Typography 절은 그대로 뜬다 — 빈 절 숨기기는 별건 R10).
 * ⛔이 문장을 «줄이 골라진» 갈래(아래)로 옮기지 마라 — 그 절은
 *   tests/dom/grid-cell-panel-handles.dom.spec.js G2 ⑵ 의 «닻»이라, 한 줄만 더해도
 *   「줄바가 기준선보다 아래로 밀렸다」가 빨개진다(Δ ≤ 0). */
/** ★중첩 안 줄을 골랐을 때의 «한 절» (T-200 커밋 ②, 현빈 「보이게만」).
 *  ⛔고치는 손잡이를 한 개도 안 내놓는다 — 그게 이 갈래를 고른 까닭 «전부»다.
 *    (patchCell{lineIndex} 가 중첩으로 못 내려간다 ⇒ 손잡이를 내면 전부 헛돈다.)
 *  ★문구는 `.prop-hint` 로 싣는다 — ⛔`.prop-label` 은 56px 고정이라 잘린다
 *    (이 패널에 「29%만 읽히던」 전례가 있다). 같은 패널의 다른 안내문과 «같은 부품»이다.
 *  ★주소를 «보여 준다» — 다음 사람이 무엇을 가리켜야 하는지 화면에서 바로 읽게. */
function _grdNestHintHtml(nestHit) {
  if (!nestHit) return '';
  const kind = (nestHit.line && nestHit.line.type) || 'body';
  const addr = `${nestHit.r},${nestHit.c} · ${nestHit.li} · ${nestHit.np}`;
  return `
    <div class="prop-section" id="grd-nest-hint">
      <div class="prop-section-title">줄 (중첩 칸 안)</div>
      <div class="prop-hint">이 줄입니다 — 중첩 칸 «안»의 ${_grdEsc(kind)} 줄</div>
      <div class="prop-hint" style="margin-top:2px;">아직 «고치는» 건 안 됩니다 — 글자는 캔버스에서, 손잡이는 다음 판</div>
      <div class="prop-hint" style="margin-top:2px;opacity:.7;">주소 ${_grdEsc(addr)}</div>
    </div>`;
}
const _grdEsc = (v) => String(v).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function _grdLineBarHtml(anyHit, block) {
  if (!anyHit) {
    return `
    <div class="prop-section">
      <div class="prop-hint">칸을 한 번 더 누르면 줄 편집 · 두 번 누르면 글자 편집</div>
    </div>`;
  }
  const { r, c, li, line } = anyHit;
  if (li === null) {
    /* 빈 셀 — 아직 줄이 하나도 없다. 첫 줄을 [+ 줄 추가 ▾] 로 고른다.
       ★「+ 텍스트 (T)」·「+ 갭 (G)」 단추는 그 select 가 갈음한다(같은 것이 두 벌이 된다).
       ⛔「+ 아이콘 (K)」는 남긴다 — 아이콘은 «피커 모달»을 여는 유일한 손잡이라 단축키 K 의
         짝으로 눈에 보여야 하고, tests/dom/grid-cell-panel-handles.dom.spec.js E0-c 가
         이 자리를 «하네스 자가점검»의 기준점으로 쓴다(그 id 가 없으면 그 검사가 눈이 먼다). */
    return `
    <div class="prop-section" style="padding-bottom:4px;">
      <div class="prop-row" style="align-items:center;gap:6px;">
        <span class="prop-hint" style="flex:1;min-width:0;">${r + 1}행 ${c + 1}열 · 빈 칸</span>
      </div>
      <div class="prop-row" style="gap:6px;flex-wrap:wrap;">
${_grdAddKindSelectHtml()}
        <button id="grd-cell-add-icon-btn" class="prop-btn-sm" title="아이콘 줄 추가 (단축키 K)">+ 아이콘 (K)</button>
      </div>
    </div>`;
  }
  const isTextLine = gridLineHasText(line);
  const summary = _grdSummaryText(r, c, li, line);
  /* ★★★2026-09-26 «[줄 삭제] 는 이제 «언제나» 활성이다» — 현빈 지시.
       「여전히 빈칸으로 두고 싶은데 마지막 남은 줄은 삭제할 수 없다고 하네?」
     ~~[폐기 · 2026-09-26] `cellLineCount`(칸의 줄 수)를 세어 `canDeleteLine = cellLineCount > 1`
       로 마지막 한 줄에서 버튼을 `disabled` 로 잠갔다. title 도 「칸에 남은 마지막 줄은 지울
       수 없습니다」였다.~~
     ⛔그 잠금은 «그날까지 참이었다» — 까닭은 모델 입구에 모아 적어 뒀다
       (js/blocks/grid-block.js `_gridRejectLinesLength` 머리말).
     ★그래서 «칸의 줄 수를 세는 일 자체»가 이 자리에서 사라졌다 — 세어서 쓸 데가 없다.
       ⛔되살리지 마라. 「마지막 줄이면 무언가 다르게」가 이 파일에 다시 들어오면 ⌫(editor.js)와
         모델 입구(grid-block.js)와 셋이 갈린다 — 그 셋이 갈려 있던 것이 바로 오늘 고친 것이다. */
  /* ★[종류 ▾] 는 여기 «없다» — 아래 「줄 꾸미기」 절로 옮겼다(2026-09-23 실측).
       ⛔단추 줄(206px)에 끼우면 240px 패널을 넘고, «요약 줄»에 붙이면 요약이 123px 로 잘리는 데다
         줄바 절의 컨트롤이 두 줄에 걸쳐 G2 ⑸(「줄바 단추가 한 줄을 유지한다」)가 빨개진다.
         ⇒ 「이 줄의 종류」는 「이 줄 꾸미기」에 산다 — 자리가 뜻과도 맞고, 접힌 절이라 0px 다.
       ⇒ 요약은 폭을 되찾는다(123 → 211). 긴 글자는 그대로 말줄임으로 흘린다. */
  void line;
  return `
    <div class="prop-section" style="padding-bottom:4px;">
      <div class="prop-row" style="align-items:center;gap:6px;">
        <span class="prop-hint" id="grd-line-summary" title="${summary}"
              style="flex:1 1 0;min-width:0;padding:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${summary}</span>
      </div>
      <div class="prop-row" style="align-items:center;gap:6px;flex-wrap:wrap;">
${_grdAddKindSelectHtml()}
        <button id="grd-line-del-btn" class="prop-btn-sm"
                title="이 줄을 삭제합니다 — 마지막 줄까지 지우면 칸이 «빈 칸»이 됩니다 (단, 내용이 남은 마지막 칸은 비울 수 없습니다)">줄 삭제</button>
        <button id="grd-line-reset" class="prop-btn-sm" ${isTextLine ? '' : 'disabled'}
                title="${isTextLine ? '이 줄에 «손으로 준 값»을 전부 지우고 기본값으로 되돌립니다 (⌘Z 로 복원)' : '이미지·갭 줄엔 타이포 필드가 없습니다'}">↺ 기본</button>
      </div>
    </div>`;
}

/* 줄바 배선 — [+ 줄 추가]/[줄 삭제]/[↺ 기본값으로] + 빈 셀 3버튼(T/G/K). */
function _grdWireLineBar(block, addr) {
  const hit = _grdResolveAnyAddr(block, addr);
  if (!hit) return;
  const { r, c, li, line } = hit;

  if (li === null) {
    _grdWireKindSelects(block, r, c, null);
    document.getElementById('grd-cell-add-icon-btn')?.addEventListener('click', () => {
      window.openIconifyModal?.((picked) => {
        const imgSrc = _grdSvgToDataUri(picked.svg);
        grdToastImgFail(grdAddLine(block, { r, c }, null, { type: 'image', imgSrc, height: picked.size || 64 }));
      });
    });
    return;
  }

  _grdWireKindSelects(block, r, c, li);
  document.getElementById('grd-line-del-btn')?.addEventListener('click', (e) => {
    if (e.currentTarget.disabled) return;
    let curLines;
    try { curLines = getGridModel(block).cells?.[r]?.[c]?.lines || []; } catch (_) { curLines = []; }
    /* ~~[폐기 · 2026-09-26] `if (curLines.length <= 1) return;` — 마지막 한 줄은 지우지 않았다.~~
       ★이 «둘째» 가드가 버튼 disabled 와 «따로» 앉아 있었다 — 즉 이 기능의 문은 둘이었다.
         버튼만 열고 여기를 남기면 「눌리는데 아무 일도 안 난다」가 된다(이 레포의 고질). */
    if (!curLines.length) return;      // 이미 빈 칸 — 지울 줄이 없다(방어)
    const newLines = curLines.filter((_, i) => i !== li);
    const newLi = Math.min(li, newLines.length - 1);
    /* ★커밋 거절 시 활성줄 원복 — grdAddLine(0920b)과 «같은 관용구»다.
       ~~0926 부터 이 길도 거절될 수 있다(블럭의 마지막 내용 칸 → EMPTY_CELL_LINES)~~
       ⇒ [정정 2026-09-27] 그 거절은 없어졌다(T-230). ★그래도 원복은 «남긴다» —
         상한(TOO_MANY_LINES)·모양(LINES_NOT_ARRAY)으로 여전히 거절될 수 있고,
         「거절인데 활성줄만 움직였다」가 이 레포의 고질이라 방어를 걷지 않는다. */
    const prevActive = grdGetActiveLine(block);
    grdSetActiveLine(block, newLines.length ? { r, c, li: newLi } : null);
    const res = window.updateGridBlock?.(block.id, { patchCell: { r, c, lines: newLines } });
    if (res && res.ok === false) grdSetActiveLine(block, prevActive);
    grdToastImgFail(res);
  });
  if (gridLineHasText(line)) {
    document.getElementById('grd-line-reset')?.addEventListener('click', () => {
      const cleared = {};
      _GRD_TYPO_FIELDS.forEach(k => { cleared[k] = undefined; });
      window.pushHistory?.();
      gridPreviewLine(block, r, c, li, cleared);
      window.scheduleAutoSave?.();
      showGridProperties(block, { r, c, li });
    });
  }
}

/* ══ 이미지 절 — anyHit.line.type === 'image' 일 때만 뜬다 ══════════════════
 * ★다른 블록의 「이미지 선택…」과 같은 방식(FileReader→dataURL)을 재사용한다
 *   (prop-simple-card.js cvb-card-img-btn · prop-zoom.js 선례). goya-asset:// 외부화는
 *   여기서 하지 않는다(그 둘도 안 한다 — 외부화는 저장 시점의 별도 관심사). */
function _grdImageSectionHtml(anyHit, block) {
  if (!anyHit || anyHit.li === null || !anyHit.line || anyHit.line.type !== 'image') return '';
  const { r, c, line } = anyHit;
  const h = Number(line.height) || '';
  const rad = Number(line.radius) || '';
  /* ★2026-09-25 R6 — `widthPct` 는 «모델·렌더러가 이미 읽는» 이름인데 패널엔 그 값을 주는
   *   손잡이가 «0개»였다. 명부(grid-block.js GRID_LINE_FIELDS)에 있고, `_gridLineHtml` 이
   *   `Number(line.widthPct)` 를 읽고, 바로 아래 줄 꾸미기 절의 `imgFull` 판정도 그 값을 읽는다.
   *   ⇒ «값은 사는데 손잡이가 없어» 캔버스 코너 드래그(js/grid-cell-resize.js)가 유일한 길이었다.
   *     그래서 「그림이 칸 안에서 안 움직인다」가 풀리지 않았다 — 폭이 100%면 렌더러의
   *     `wp < 100` 가드 때문에 정렬이 안 먹는데, 폭을 줄일 데가 패널에 없었다.
   * ⛔저장 포맷은 «한 글자도» 안 바뀐다 — 이미 명부에 있는 이름이다. 새 필드가 아니다.
   * ★빈 칸 = «폭 지정 없음» = 렌더러 기본 100%(grid-block.js `_gridLineHtml` 의 `: 100`).
   *   그래서 placeholder 가 "100" 이다(장식이 아니라 «역할 기본값» — 숫자칸 규약 ⑶). */
  const wpN = Number(line.widthPct);
  const wp = Number.isFinite(wpN) ? wpN : '';
  /* ★2026-09-25 현빈 — 이 절에 있던 단추 «셋»을 없앴다(「캔버스에서 다 직관적으로 조작이
   *   가능한거잖아?」). ⛔되살리기 전에 «어디로 갔는지»부터 읽어라 — 기능이 죽은 게 아니라
   *   손잡이가 «한 벌»로 합쳐진 것이다. 두 벌이 되면 둘이 따로 늙는다.
   *     · 「프레임 안에서 맞추기…」 → 캔버스 «더블클릭»(js/block-drag.js:2107 →
   *       image-handling.js enterGridImageEditMode). 지운 단추의 title 이 스스로
   *       「캔버스에서 더블클릭해도 같습니다」라고 적고 있었다 — 같은 함수, 같은 편집기다.
   *     · 「이미지 제거」 → ⑴ 바로 위 줄바의 «줄 삭제»(grd-line-del-btn — 같은 파일
   *       _grdWireLineBar, 핸들러가 «한 글자도 안 다른» 같은 코드였다) ⑵ 우클릭 「이미지 삭제」
   *       (index.html bcm-grid-img-del → block-factory.js). 셋 다 같은 patchCell{lines} 경로다.
   *       ★T-009 버그A(imgSrc만 비우면 회색 placeholder 가 남는다)는 그 둘이 계속 막는다 —
   *       둘 다 «줄 자체»를 지우지 imgSrc 를 비우지 않는다.
   *     · ★「크롭 초기화」 → «대체가 없다». 현빈이 조건부로 없애라 하셨고(「에셋블록에도 같은
   *       기능이 있으면 편집모드 안으로 옮기고, 아니면 없어도 될듯해」), 에셋 패널엔 없다
   *       (prop-asset.js 의 asset-bg-clear 는 «배경색» 초기화지 크롭이 아니다). ⇒ 지웠다.
   *       ⚠️그래서 크롭을 «지우는» 길은 지금 ⌘Z 뿐이다(편집기는 크롭을 쓰기만 하고 못 지운다
   *         — image-handling.js beforeCommit 이 세 값을 «항상» 쓴다). 되살릴 일이 생기면
   *         현빈 조건대로 «편집모드 안»에 넣어라. 이 절로 되돌리지 마라. */
  return `
    <div class="prop-section">
      <div class="prop-section-title">Image</div>
      <div class="prop-row">
        <button id="grd-img-pick-btn" class="prop-btn-full">${line.imgSrc ? '이미지 교체…' : '이미지 선택…'}</button>
      </div>
      <div class="prop-row">
        <span class="prop-label" title="칸 안에서 그림이 차지하는 가로 폭(%). 100 이면 정렬이 안 보인다 — 줄일 데가 없어서다. 비우면 100.">폭(%)</span>
        <input type="number" class="prop-number" id="grd-img-width-pct" min="${IMG_MIN_PCT}" max="100" placeholder="100" value="${wp}">
      </div>
      <div class="prop-row">
        <span class="prop-label">높이(px)</span>
        <input type="number" class="prop-number" id="grd-img-height" min="0" placeholder="auto" value="${h}">
      </div>
      <div class="prop-row">
        <span class="prop-label">모서리 반경(px)</span>
        <input type="number" class="prop-number" id="grd-img-radius" min="0" placeholder="0" value="${rad}">
      </div>
    </div>`;
}

function _grdWireImageSection(block, addr) {
  const hit = _grdResolveAnyAddr(block, addr);
  if (!hit || hit.li === null || !hit.line || hit.line.type !== 'image') return;
  const { r, c, li } = hit;

  document.getElementById('grd-img-pick-btn')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0];
      /* ★사람이 고른 파일이다 — «바이트»로 거르고(grdImageFileOk), 커밋은 trusted 로 보낸다.
         MCP/IPC 용 문자열 캡(GRID_IMG_MAX_CHARS)은 여기 적용하지 않는다(2026-09-20). */
      if (!grdImageFileOk(file)) return;
      const reader = new FileReader();
      reader.onload = ev => {
        grdToastImgFail(window.updateGridBlock?.(block.id,
          { patchCell: { r, c, lineIndex: li, imgSrc: ev.target.result } }, { trusted: true }));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });

  /* ★하한·상한은 «칸 자신의 min/max 속성»이 정본이다(js/props/prop-number-commit-guard.js 의
     규약 — 가드가 그 속성으로 클램프하고 칸에 되쓴다). 여기 lo/hi 는 그 뒤에 오는 «두 번째 그물»이다.
     ⛔두 수를 손으로 적지 마라 — 폭(%)의 5 는 js/grid-cell-resize.js 의 IMG_MIN_PCT 에서 온다
       (캔버스 코너 드래그가 쓰는 바로 그 하한. 두 길이 같은 범위를 쓰게). */
  const numWire = (id, field, lo = 0, hi = Infinity) => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      const raw = String(e.target.value).trim();
      const v = raw === '' ? undefined : Math.max(lo, Math.min(hi, parseInt(raw, 10) || 0));
      window.pushHistory?.();
      gridPreviewLine(block, r, c, li, { [field]: v });
      _grdSyncLineMark(block, { r, c, li });   // 재렌더가 마커를 지웠다 — 다시 붙인다
      window.scheduleAutoSave?.();
      window.showGridImageResizeHandle?.(block);   // ★폭/높이가 바뀌면 코너 핸들 자리도 따라가야 한다
    });
  };
  /* ⚠️★알고 남기는 비대칭 — 「폭(%)」·「높이(px)」 입력은 프레임만 바꾸고 «크롭은 안 되환산한다».
   *   코너 핸들은 되환산한다(js/overlay-handles.js: 그림을 제자리에 두고 프레임만 바꾼다).
   *   ⇒ 크롭을 맞춰 둔 줄에서 이 두 입력으로 상자를 바꾸면 그림이 «같이» 늘었다 줄었다 한다.
   *   왜 안 맞췄나 — 이 입력들은 «연속 input» 경로(gridPreviewLine)라 드래그처럼 시작/끝이
   *     없다. 되환산하려면 「어느 시점의 기하를 못으로 박을 것인가」를 먼저 정해야 하는데,
   *     타자 한 글자마다 못을 박으면 값이 누적으로 떠내려간다(입력 «중»에 기준이 바뀐다).
   *   ⇒ 이건 «별건»이다. 여기서 몰래 하지 않는다. 지금 할 수 있는 정직한 처방은:
   *       ⑴ 사실을 적는다(이 주석) ⑵ 크롭 맞추기는 «캔버스»로 한다 — 코너 핸들, 또는 더블클릭
   *   ★2026-09-25 — ⑶ 이 «없어졌다». 예전엔 「어긋나면 「크롭 초기화」로 되돌릴 길을 둔다」였는데
   *     그 단추를 현빈 지시로 지웠다(위 _grdImageSectionHtml 의 주석에 까닭). ⇒ 지금 어긋난 크롭을
   *     «지우는» 길은 ⌘Z 뿐이다 — 편집기는 크롭을 쓰기만 하고 못 지운다. 비대칭이 남은 채로
   *     되돌릴 길이 하나 줄었으니 ⑵ 로 가는 안내가 그만큼 더 중요해졌다.
   *   ⛔이 문단을 지우려면 «먼저 고치고» 지워라. */
  numWire('grd-img-width-pct', 'widthPct', IMG_MIN_PCT, 100);
  numWire('grd-img-height', 'height');
  numWire('grd-img-radius', 'radius');
}

/* ══ 칸 꾸미기 절 — 칸 배경색·안쪽 여백·모서리·«칸 단위» 정렬 ═══════════════
 * ★렌더러는 이 다섯을 «이미» 읽는다(grid-block.js renderGridBlock 의 pick(...)) 하고,
 *   모델도 patchCell 로 «이미» 받는다. 없던 것은 «패널에 누를 데»뿐이라 여기서는 그
 *   손잡이만 낸다 — 데이터·렌더러는 한 글자도 안 건드린다.
 *
 * ~~[폐기 · T-178 2026-09-23]~~ 아래 세 문단은 «2026-09-23 이전»에 참이었다. 지우지 않는다.
 *   ~~★★행 0 은 «열 그 자체»다(row 0 = cols[].lines). 그래서 0행 칸에 준 값이 실제로 쓰이는
 *     자리는 cols[c] 이고, 렌더러 폴백 `pick = (k) => (cell[k] !== undefined ? cell[k] : col[k])`
 *     때문에 «자기 값이 없는 아래 행 칸»들이 그 값을 물려받는다 — 그 칸들의 저장값은 비어 있는데
 *     화면만 따라 칠해진다.~~
 *   ~~⇒ 이 레포가 이미 한 선택을 그대로 쓴다: «동작을 바꾸는 대신 사실을 적는다».
 *     바로 아래 그리드 피커의 「줄이면 잘린 칸 내용은 사라진다」가 «같은 꼴»이고, 그 주석이
 *     이유까지 적어 뒀다(적대검수 Q3). 상속을 끊는 것은 데이터 모델·저장·되돌리기에 파장이
 *     커서 «별건»이다 — 여기서 몰래 하지 않는다.~~
 *   ~~⇒ 0행 칸을 고르면 절 제목과 힌트가 «이 열 전체에 적용된다»고 말한다. 보인 대로 된다.~~
 *   까닭 — 그 «별건»이 T-178 로 발주되어 끝났다(2026-09-23). 「사실을 적는다」는
 *     «고칠 수 없을 때»의 차선이었고, 이제 고쳐졌으므로 그 문구를 그대로 두면 «거짓»이 된다.
 *   ★지금의 사실:
 *     · 행 0 칸의 꾸밈은 dataset.cells[0][c] 에 «그 칸의 값»으로 저장된다 — 아래 행에 안 번진다.
 *     · 열 전체 기본값은 «따로» 있다(cols[c] 의 꾸밈 = patchCol). 렌더러 폴백은 그대로다.
 *     · 행 0 의 «줄 내용»만 여전히 cols[c].lines 하나다(단일 진실원 — 이건 안 바뀌었다).
 *   ⇒ 그래서 절 제목·힌트가 이제 «모든 행에서 같은 말»을 한다(아래 _grdCellSectionHtml).
 *
 * ★접힘이 기본이다(패널이 이미 길다). 접힘 상태는 «블록별 WeakMap» — _grdActiveLine 과 같은 집.
 *   ⛔DOM 노드 참조·전역 Set 으로 들지 마라 — renderGridBlock 이 innerHTML 을 통째로 갈아끼워
 *     매 조작마다 죽는다(이 파일 머리글이 같은 말을 적어 뒀다).
 */
const _grdOpenSections = new WeakMap();
const _grdSecOpen = (block, key) => (_grdOpenSections.get(block) || {})[key] === true;
function _grdSecToggle(block, key) {
  const cur = _grdOpenSections.get(block) || {};
  const next = { ...cur, [key]: !cur[key] };
  _grdOpenSections.set(block, next);
  return next[key];
}

/** 접이식 절 머리글 — ⛔두 벌 만들지 마라. 칸 꾸미기·줄 꾸미기가 «이 부품 하나»를 쓴다.
 *
 * ★쉐브론은 «이 패널이 이미 쓰는 그림»이다 — 발명하지 않았다(2026-09-24).
 *   출처 둘이 이미 같은 그림을 쓰고 있었다:
 *     · js/props/_typo-section.js:80      — 인라인 쉐브론(같은 우측 패널, 바로 아래 절)
 *     · css/editor-props.css `.prop-select` — 이 패널의 드롭다운이 쓰는 화살표(data URI)
 *       ~~「이 패널의 «모든» 드롭다운이 쓴다」~~ ⛔[정정 2026-09-27] 세어 보지 않은 말이었다.
 *       실측하니 패널 안 드롭다운 넷 중 «셋»이 `.prop-select` 가 아니라 appearance:auto —
 *       맥이 그리는 기본 화살표였다(.var-select 둘 ＋ #var-type-select). 현빈이 그 틈을 짚었다.
 *       ⇒ editor-props.css `#panel-right select` 로 «자리»에 걸어 덮었다(T-196, 0927).
 *       ★교훈 — 「모두 X 를 쓴다」는 세고 나서만 적는다. 안 세면 다음 사람이 그 위에 쌓는다.
 *   둘 다 `M1 1l4 4 4-4` · stroke-width 1.5 · stroke-linecap round 다.
 *
 * ~~[폐기 · 2026-09-24] 옛 그림 `<polyline points="2,2 6,4 2,6">` · 8x8 · stroke-width 1.8 · 선끝 없음~~
 *   까닭 — 현빈 지적(「우측패널에 svg가 일관성도 없고 uiux상 직관적이지 않다」)의 실측 내용이 이것이다.
 *   「칸 꾸미기」 절 하나 안에서 «열기/닫기»를 뜻하는 쉐브론이 두 벌 떴고, 서로 달랐다:
 *     절 머리 쉐브론 — 2:1 완만한 V · 잉크 1.8px · 선끝 butt(각진 끝)
 *     가로/세로 정렬 드롭다운 — 45° V · 잉크 1.5px · 선끝 round
 *   둘 사이 거리는 세로로 약 16px 다. «같은 뜻인데 다른 그림»이 바로 붙어 있었다.
 *
 * ★바꾼 것과 «안» 바꾼 것
 *   바꿈 — 그림(d)·잉크(1.8→1.5)·선끝(butt→round). 색은 원래도 currentColor 라 그대로다.
 *   ⛔동작은 한 글자도 안 바꿨다 — 접힘=오른쪽, 펼침=아래. 옛 그림은 «오른쪽» 쉐브론을 열 때
 *     +90° 돌렸고, 새 그림은 «아래» 쉐브론이라 접을 때 −90° 돌린다. 보이는 방향은 같다.
 *   ★상자는 8x8 → 10x10 «정사각»이다. 두 까닭 —
 *     ⑴ 잉크를 1.5px 로 맞추려면 viewBox 10 에 화면 폭도 10 이어야 한다(1.5 × 10/10 = 1.5).
 *        폭을 8 로 두면 같은 `stroke-width="1.5"` 가 1.2px 로 «가늘게» 그려진다 — 선언값만 보는
 *        검사는 그걸 못 잡는다. 그래서 그물(A3)은 «잉크»를 잰다.
 *     ⑵ 정사각이라야 −90° 로 돌려도 «자리를 안 먹는다». 10x6 을 그대로 돌리면 6x10 이 되어
 *        접었다 폈다 할 때마다 옆의 제목이 좌우로 흔들린다.
 *   ⇒ 제목이 2px 오른쪽으로 간다. 그 값이 이 변경의 «전부»다.
 *
 * 지키는 그물: tests/dom/grid-panel-icon-spec.dom.spec.js (A2 선끝 · A3 잉크 · A3b 모양 · A4 색) */
const _grdDisclosureHtml = (id, title, open) => `
      <div class="prop-section-title" id="${id}" role="button" tabindex="0"
           style="display:flex;align-items:center;gap:6px;cursor:pointer;"
           title="${open ? '접기' : '펼치기'}">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round"
             style="flex:0 0 auto;transform:rotate(${open ? 0 : -90}deg);transition:transform .12s;">
          <path d="M1 3l4 4 4-4"/>
        </svg>
        <span style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title}</span>
      </div>`;

/** 접이식 절의 배선 — 패널을 다시 그리지 않는다(재렌더는 곧 포커스 상실이다). */
function _grdWireDisclosure(block, key, headId, bodyId) {
  const head = document.getElementById(headId);
  const body = document.getElementById(bodyId);
  const arrow = head?.querySelector('svg');
  head?.addEventListener('click', () => {
    const open = _grdSecToggle(block, key);
    if (body) body.style.display = open ? 'block' : 'none';
    /* ⛔각도 식은 _grdDisclosureHtml 과 «같은 값»이어야 한다 — 갈리면 첫 클릭에 그림이 튄다.
       접힘 = −90°(오른쪽) · 펼침 = 0°(아래). 쉐브론이 «아래» 그림이라 부호가 옛 것과 반대다. */
    if (arrow) arrow.style.transform = `rotate(${open ? 0 : -90}deg)`;
    head.title = open ? '접기' : '펼치기';
  });
}

/** 칸 값을 «지운다» — `null` = 그 키를 없앤다 = 열 기본값으로 되돌림.
 *  ~~[폐기 · T-178 2026-09-23] 이름 `_grdBlank(r, zero)` 와 그 주석
 *    「행 0 은 cols[c] 자체라 undefined 가 `_mergeCellIntoCol` 에서 «무시»된다(지워지지 않는다)
 *     ⇒ 행 0 은 ''/0 으로 «명시적으로 덮고», 그 아래 행은 undefined 로 키를 없앤다」~~
 *  까닭 둘 —
 *    ⑴ 행 0 칸이 이제 cells[0][c] 라는 «자기 자리»를 가져 행 0/행 1+ 특례가 없어졌다.
 *       ★같은 「비우기」 단추가 행마다 다르게 동작하던 «비대칭»이, 저장 자리가 하나가 되며 사라졌다.
 *    ⑵ 이름이 틀렸다 — 「blank(빈 값)」이 아니라 「unset(지움)」이다. 이 레포에서 `''` 는
 *       «빈 값»이 아니라 «강제로 없앰»이라 뜻이 다르다(grid-cell-empty-value 가 그 수치다).
 *  ★`undefined` 가 아니라 `null` 을 쓴다 — 둘 다 지우지만, JSON 을 타는 길(MCP·IPC·저장본)은
 *    `undefined` 를 «실을 수 없다». 하나로 통일해 두면 그 길에서도 같은 코드가 돈다.
 *  ⛔★걷은 것은 «행 분기» 하나다 — `''`/`0` «값의 뜻»은 안 버렸다.
 *    ~~예전 표 — 같은 단추가 «행에 따라 다른 값»을 실었다~~
 *      배경 비우기  : 행 0 `''`(강제 없음)       · 행 1+ `undefined`(열 기본값 복귀)
 *      여백·모서리  : 행 0 `0`(0 으로 강제)      · 행 1+ `undefined`
 *      정렬 「기본」 : 행 0 `''`(하드 기본 강제)  · 행 1+ `undefined`
 *  ★★정확히 무엇이 주는가 (팀리드 확정 문구 그대로):
 *    「패널 「비우기」는 이제 «행과 무관하게 열 기본값으로 되돌린다». 예전엔 «행 0 에서만»
 *     ''/0 을 실어 「강제 없음/0 강제」가 됐다 — 같은 단추가 맨 윗줄에서만 다르게 동작하던
 *     것이다. 그 «강제» 뜻 자체는 살아 있고(API·MCP 로 ''/0 을 주면 된다), 패널 단추로
 *     가는 길만 없앴다.」
 *  ⛔렌더러의 `''`/`0` 처리는 한 글자도 안 건드렸다 — grid-cell-clear-contract 의 C2·O2·O3 와
 *    grid-cell-unset-contract 의 D4 가 그 뜻을 잠근다(「열 기본값 12px 인 열에서 이 칸만 0」).
 *  ⚠️인자는 안 받는다 — 행에도, 숫자/문자에도 안 갈린다. 그게 이 변경의 요점이다. */
const _grdUnset = () => null;

const _GRD_CELL_ALIGNS  = [['', '기본'], ['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']];
const _GRD_CELL_VALIGNS = [['', '기본'], ['top', '위'], ['middle', '가운데'], ['bottom', '아래']];
const _grdOptsHtml = (list, cur) => list
  .map(([v, ko]) => `<option value="${v}"${String(cur ?? '') === v ? ' selected' : ''}>${ko}</option>`).join('');

/** 커밋 실패를 «보이게» 한다.
 *  ★조용한 ok:false 는 「됐다는데 화면은 그대로」가 된다 — 이 레포가 2026-09-20 에 실제로 당한
 *    갈래이고 tests/unit/grid-callsite-ssot.test.mjs 가 그 자리를 소스로 못박는다.
 *  ⛔grdToastImgFail 을 돌려쓰지 마라 — 그건 «이미지» 어휘다(「이미지 작업 실패」). 칸/줄 patch 가
 *    그 문구를 띄우면 사용자가 엉뚱한 곳을 본다. */
function _grdToastCellFail(res) {
  if (!res || res.ok !== false) return false;
  window.showToast?.('⚠️ 적용되지 않았습니다 — ' + (res.message || res.code || '알 수 없는 오류'));
  return true;
}

/** 칸 patch «한 길» — 커밋·히스토리·재렌더·패널 재표시를 updateGridBlock 이 스스로 한다
 *  (줄 삭제·비율 입력과 같은 원칙).
 *  ⛔dataset 에 직접 쓰지 마라 — 두 벌이 되면 조용히 갈라진다. 결론은 그대로인데
 *    ~~[폐기 · T-178 2026-09-23] 까닭이 「행 0/그 아래의 저장 자리가 «다르다»」였다~~.
 *    지금은 행 0 도 cells 를 쓴다. 갈리는 것은 «행»이 아니라 «무엇이냐»다:
 *      줄 내용(lines) → dataset.cols[c].lines (행 0) · dataset.cells[r][c].lines (그 아래)
 *      꾸밈           → dataset.cells[r][c]   (모든 행에서 같다)
 *    한 호출에 둘을 섞어 주면 dataset «두 키»가 같이 나온다(_gridCellPatchDataset). */
function _grdPatchCell(block, r, c, fields) {
  return _grdToastCellFail(window.updateGridBlock?.(block.id, { patchCell: { r, c, ...fields } }));
}

function _grdCellSectionHtml(anyHit, block) {
  if (!anyHit) return '';
  const { r, c } = anyHit;
  let cell = {};
  try { cell = (getGridModel(block).cells?.[r] || [])[c] || {}; } catch (_) {}
  const open = _grdSecOpen(block, 'cell');
  const bgRaw = (typeof cell.bg === 'string' && GRID_COLOR_RE.test(cell.bg.trim())) ? cell.bg.trim() : '';
  const bgHex = bgRaw ? swatchHex(bgRaw, '#ffffff') : '#ffffff';
  const pad = Number(cell.padding) || '';
  const rad = Number(cell.radius) || '';
  /* ~~[폐기 · T-178 2026-09-23] 「★0행 = «열 그 자체» — 제목이 먼저 말한다」 + `const wide = r === 0`~~
     까닭 — 행 0 칸도 이제 «그냥 칸»이다(cells[0][c] 에 따로 저장된다). 제목이 「1열 전체」라고
       말하면 «거짓»이 된다. 모든 행에서 같은 말을 한다.
     ★대신 「이 열에 기본값이 걸려 있나」를 «읽기 전용 한 줄»로 알려 준다 — 비웠는데 색이 남으면
       사용자는 「안 지워졌다」고 읽는다. 그게 왜 그런지 그 자리에서 말해 준다.
     ⛔「열 기본값 손잡이」는 이번에 안 만든다(별건 카드) — 여기선 사실만 적는다. */
  const title = `칸 꾸미기 · ${r + 1}행 ${c + 1}열`;
  /* 이 열에 기본값(꾸밈)이 하나라도 걸려 있나 — ⛔필드 이름을 손으로 세지 않는다.
     GRID_CELL_FIELDS(정본 명부)에서 내용(lines)과 열 전용(width)을 뺀 것이 곧 «칸 꾸밈»이다.
     ⇒ T-172(테두리) 같은 새 칸 필드가 명부에 생기면 이 줄이 «자동으로» 그것도 본다. */
  let colHasDefault = false;
  try {
    const col = (getGridModel(block).cols || [])[c] || {};
    colHasDefault = [...GRID_CELL_FIELDS].some(k => k !== 'lines' && col[k] !== undefined && col[k] !== '');
  } catch (_) { colHasDefault = false; }
  return `
    <div class="prop-section"${open ? '' : ' style="padding-bottom:0;"'}>
${_grdDisclosureHtml('grd-cell-toggle', title, open)}
      <div id="grd-cell-body" style="display:${open ? 'block' : 'none'};">
        <div class="prop-hint" style="text-align:left;padding:2px 0 6px;">이 칸에만 적용된다.</div>
        ${colHasDefault
          ? '<div class="prop-hint" style="text-align:left;padding:0 0 6px;">이 열에 기본값이 걸려 있다 — 비워 두면 그 값이 보인다.</div>'
          : ''}
        <div class="prop-row">
          <span class="prop-label">배경색</span>
          <div class="prop-color-swatch${bgRaw ? '' : ' swatch-none'}"${bgRaw ? ` style="background:${bgRaw}"` : ''}>
            <input type="color" id="grd-cell-bg" value="${bgHex}">
          </div>
          <input type="text" class="prop-color-hex" id="grd-cell-bg-hex" maxlength="7" placeholder="없음" aria-label="칸 배경색" value="${bgRaw ? bgHex.replace('#', '').toUpperCase() : ''}">
        </div>
        <div class="prop-row">
          <span class="prop-label">안쪽 여백</span>
          <input type="number" class="prop-number" id="grd-cell-padding" min="0" max="200" placeholder="0" value="${pad}">
        </div>
        <div class="prop-row">
          <span class="prop-label" title="이 «칸»의 모서리. 그림 줄의 「모서리 반경」과 다른 축이다">칸 모서리</span>
          <input type="number" class="prop-number" id="grd-cell-radius" min="0" max="200" placeholder="0" value="${rad}">
        </div>
        <div class="prop-row">
          <span class="prop-label">가로 정렬</span>
          <select class="prop-select" id="grd-cell-align" title="이 칸의 가로 정렬(기본 = 열을 따른다)">${_grdOptsHtml(_GRD_CELL_ALIGNS, cell.align)}</select>
        </div>
        <div class="prop-row">
          <span class="prop-label">세로 정렬</span>
          <select class="prop-select" id="grd-cell-valign" title="이 칸의 세로 정렬(기본 = 블록을 따른다)">${_grdOptsHtml(_GRD_CELL_VALIGNS, cell.valign)}</select>
        </div>
      </div>
    </div>`;
}

function _grdWireCellSection(block, addr) {
  const hit = _grdResolveAnyAddr(block, addr);
  if (!hit) return;
  const { r, c } = hit;

  _grdWireDisclosure(block, 'cell', 'grd-cell-toggle', 'grd-cell-body');

  /* ── 배경색 — 커밋은 «change»(피커 닫힘·blur·Enter)에서만.
       ⛔input 마다 커밋하면 updateGridBlock 이 매 프레임 패널을 통째로 다시 그려
         포커스가 끊기고 히스토리가 폭주한다(이 파일 비율·색 피커 주석의 같은 함정). */
  const bgPick = document.getElementById('grd-cell-bg');
  const bgHexEl = document.getElementById('grd-cell-bg-hex');
  const bgSwatch = bgPick?.closest('.prop-color-swatch');
  const paint = (hex) => {
    if (!bgSwatch) return;
    bgSwatch.classList.toggle('swatch-none', !hex);
    bgSwatch.style.background = hex || '';
  };
  bgPick?.addEventListener('input', () => paint(bgPick.value));
  bgPick?.addEventListener('change', () => {
    if (bgHexEl) bgHexEl.value = bgPick.value.replace('#', '').toUpperCase();
    _grdPatchCell(block, r, c, { bg: bgPick.value });
  });
  /* 배선은 color-picker.js 의 wireHexText 한 자리 — 빈 칸 = «없음»(배경 지움). */
  wireHexText(bgHexEl, {
    parse: (raw) => (String(raw ?? '').trim() === '' ? '' : parseHex6(raw)),
    format: (v) => (v ? formatHex6(v) : ''),
    getCurrent: () => {
      let cur = {};
      try { cur = (getGridModel(block).cells?.[r] || [])[c] || {}; } catch (_) {}
      return (typeof cur.bg === 'string' && GRID_COLOR_RE.test(cur.bg.trim())) ? swatchHex(cur.bg.trim(), '') : '';
    },
    onApply: (v) => { paint(v || ''); if (v && bgPick) bgPick.value = v; },
    onCommit: (v) => { _grdPatchCell(block, r, c, { bg: v || _grdUnset() }); },
  });

  /* ── 안쪽 여백 / 모서리 — change(blur·Enter)에서만. 비우면 «없음»으로 되돌린다. */
  const numWire = (id, field) => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      const raw = String(e.target.value).trim();
      const v = raw === '' ? _grdUnset() : Math.max(0, Math.min(200, parseInt(raw, 10) || 0));
      _grdPatchCell(block, r, c, { [field]: v });
    });
  };
  numWire('grd-cell-padding', 'padding');
  numWire('grd-cell-radius', 'radius');

  /* ── 칸 단위 정렬 — «이 칸만». 블록/열 통째 단추(아래 Layout 절)와 축이 다르다. */
  for (const [id, field] of [['grd-cell-align', 'align'], ['grd-cell-valign', 'valign']]) {
    const sel = document.getElementById(id);
    sel?.addEventListener('change', () => {
      _grdPatchCell(block, r, c, { [field]: sel.value || _grdUnset() });
    });
  }
}

/* ══ 「통째로 건다」는 단추가 정말 통째로 걸리게 — 오버라이드를 걷는 두 부품 ═══════
 * ★렌더러는 «가린다»: 줄 > 칸 > 열 > 블록 (`line.align || colAlign` · `pick(k)=cell[k]??col[k]`).
 *   그래서 열/블록 단위 지시는 «아래 층의 값을 걷어야» 실제로 걸린다. 값을 박지 않고 «걷는» 쪽을
 *   쓰는 이유: 폴백이 알아서 상위 값을 읽고, 저장본도 안 부푼다.
 * ⛔두 벌 만들지 마라 — 가로(data-ha)·세로(data-va) 두 핸들러가 이 둘을 같이 쓴다. */
function _grdStripLineAlign(lines) {
  if (!Array.isArray(lines)) return;
  lines.forEach(l => { if (l && typeof l === 'object') delete l.align; });
}
/** dataset.cells 의 «칸 오버라이드» 한 필드를 전부 걷는다. 걷은 게 있으면 true.
 *  ~~[폐기 · T-178 2026-09-23] 「dataset.cells(행 1~) … 행 0 은 여기 없다」~~
 *  까닭 — dataset.cells 가 «행 0 포함 전체 R×C»가 됐다. 행 0 칸의 꾸밈도 여기 있으므로
 *    이 루프가 그것까지 «같이» 걷는다. 그게 맞다: 「열 통째로 건다」 단추는 행 0 칸에 걸린
 *    오버라이드도 걷어야 정말 통째로 걸린다.
 *  ⛔행 0 의 «줄 정렬»(line.align)은 여기 없다 — 행 0 의 줄은 cols[c].lines 다. 호출부가
 *    cols 쪽에서 _grdStripLineAlign 으로 따로 걷는다(그 자리는 안 바뀌었다).
 *  ★2026-09-25 R3 — `dryRun` 은 «묻기만» 한다(걷지 않고, dataset 에도 안 쓴다).
 *    패널이 「지울 게 있을 때만」 예고 한 줄을 띄우려면 «판정»이 필요한데, 그 판정을
 *    사본으로 만들면 걷는 쪽과 조용히 갈린다(예고는 뜨는데 실제론 안 지워지거나 그 반대).
 *    ⇒ 같은 루프에 스위치 하나. ⛔예고용으로 «부작용 있는» 호출을 하지 마라 — 그리면서
 *      데이터를 지우게 된다. */
function _grdStripCellOverride(block, field, dryRun) {
  let cells;
  try { cells = JSON.parse(block.dataset.cells || '[]'); } catch (_) { return false; }
  if (!Array.isArray(cells) || !cells.length) return false;
  let hit = false;
  cells.forEach(row => {
    if (!Array.isArray(row)) return;
    row.forEach(cell => {
      if (!cell || typeof cell !== 'object') return;
      if (cell[field] !== undefined) { if (!dryRun) delete cell[field]; hit = true; }
      if (field === 'align' && Array.isArray(cell.lines)) {
        if (cell.lines.some(l => l && typeof l === 'object' && l.align !== undefined)) hit = true;
        if (!dryRun) _grdStripLineAlign(cell.lines);
      }
    });
  });
  if (hit && !dryRun) block.dataset.cells = gridCellsToDataset(cells);
  return hit;
}

/** cols 쪽에 «걷힐» 정렬이 있나 — 묻기만 한다(R3 예고용).
 *  ⛔왜 _grdStripCellOverride 로 못 묻나: 그건 dataset.cells 만 본다. cols 에도 걷히는 것이 둘 있다 —
 *    ⑴ 행 0 의 «줄 정렬»(cols[c].lines[].align — 행 0 의 줄은 cells 가 아니라 cols 에 산다)
 *    ⑵ 열 «세로정렬»(col.valign — [data-va] 핸들러가 지운다)
 *  ⛔여기서 걷지 않는다. 걷는 자리는 아래 [data-ha]/[data-va] 핸들러 그대로 한 곳뿐이다. */
function _grdColsHaveAlignOverride(block, field) {
  let cols;
  try { cols = JSON.parse(block.dataset.cols || '[]'); } catch (_) { return false; }
  if (!Array.isArray(cols)) return false;
  return cols.some(col => {
    if (!col || typeof col !== 'object') return false;
    if (field === 'valign') return col.valign !== undefined;
    return Array.isArray(col.lines) && col.lines.some(l => l && typeof l === 'object' && l.align !== undefined);
  });
}

/* ── 컬럼 «비율» UI ────────────────────────────────────────────────────────
 * 렌더러(grid-block.js)는 이미 임의 비율을 지원한다 — 각 컬럼에 flex:(w/총합*100).
 * ★2026-09-04 P0: 슬라이더(2열 20~80 클램프 / 3열 칸별 슬라이더) → 테이블식 `1:1:1` 텍스트
 *   + 「균등」 버튼으로 교체(현빈 지시). 파서는 prop-table.js `_applyColRatio`에서 뽑아온
 *   parseRatio(_helpers.js)를 공용으로 쓴다(복붙 금지) — 부족 1 패딩·초과 자름 규칙 동일.
 * ⛔px width 를 직접 쓰지 말 것 — flex 가중치를 유지해야 폭 계산 함정에 새로 노출되지 않는다.
 * ⛔20~80 클램프도 제거됐다 — 텍스트 입력은 `9:1`도 허용한다(테이블도 그렇다). */
function _ratioRowHtml(cols) {
  if (cols.length < 2) return '';
  /* ★소수 비율(예: 0.5:1.5)을 «있는 그대로» 보여준다.
   * 이전엔 Math.max(1, …) 라 0.5 가 1 로 뭉개져, 패널을 다시 열면 1:1 로 «거짓 표시»됐다.
   * 값은 살아 있는데 화면만 틀리는 종류라 사용자가 「안 먹었다」고 읽는다.
   * 표시는 소수 2자리까지, 정수면 정수로(1.00 이 아니라 1). */
  const curRatioStr = cols.map(c => {
    const n = Number(c.width);
    const v = Number.isFinite(n) && n > 0 ? n : 1;
    return Number.isInteger(v) ? String(v) : String(+v.toFixed(2));
  }).join(':');
  return `
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-input" id="grd-col-ratio" placeholder="1:1:1" value="${curRatioStr}" style="flex:1 1 0;min-width:0;font-size:11px;height:24px;background:#1a1a1a;color:#e5e5e5;border:1px solid #333;border-radius:4px;padding:0 8px;">
        <button id="grd-col-ratio-reset" style="height:24px;flex:0 0 auto;padding:0 10px;font-size:11px;white-space:nowrap;background:#262626;color:#e5e5e5;border:1px solid #333;border-radius:4px;cursor:pointer;line-height:1;box-sizing:border-box;">균등</button>
      </div>
      <div class="prop-hint">예: 1:1:2 → 25/25/50%</div>`;
}

/* ── 행 «높이» UI ──────────────────────────────────────────────────────────
 * ★2026-09-04 P1: 열은 «비율»(가중치)이지만 행은 «px 최소높이»다(PLAN §3-A, 테이블
 *   U5a 와 같은 의미론) — 그래서 열처럼 `1:1:1` 합성 비율 입력을 쓰지 않고, 테이블의
 *   행별 높이 입력(prop-table.js `.tbl-rowh-item-row`)과 같은 마크업으로 «행마다 하나씩» 받는다.
 * rows 가 1개(옛 파일과 동일 상태)면 아예 렌더하지 않는다 — 「비율은 있는데 높이는 없다」는
 *   행 개념이 아직 없다는 뜻이라 보여줄 게 없다(PLAN §4 "행이 생기면 …rows>1일 때만 노출"). */
function _rowHeightHtml(rows) {
  if (rows.length < 2) return '';
  const items = rows.map((r, ri) => `
      <div class="grd-rowh-item-row" style="display:flex;align-items:center;gap:6px;">
        <span class="prop-sublabel" style="width:40px;font-size:11px;color:#888;">행 ${ri + 1}</span>
        <input type="number" class="prop-number grd-row-h-item" data-ri="${ri}" min="0" max="${ROW_H_MAX}"
               placeholder="auto" value="${r.height === 'auto' ? '' : r.height}" title="이 행 높이(px). 비우면 자동" style="width:70px;">
      </div>`).join('');
  return `
      <div class="prop-row" style="align-items:flex-start;">
        <span class="prop-label" style="padding-top:4px;">행 높이</span>
        <div class="grd-rowh-list" style="display:flex;flex-direction:column;gap:4px;flex:1;">${items}</div>
      </div>
      <div class="prop-hint">비우면 자동(내용 높이) · 값은 «최소» 높이(내용이 더 크면 늘어난다)</div>`;
}

/* ── 열/행 「간격」 UI ───────────────────────────────────────────────────────
 * ★2026-09-16(T-D): 09-05 에 지운 「간격」(양축 동시) 슬라이더의 재도입이 아니다 — 그건
 *   재도입하지 않는다(현빈 지시). 이번엔 열 간격/행 간격을 따로 조작한다(월계수 블록의
 *   "셀 가로/세로 간격" 2슬라이더 선례와 같은 형태, 라벨/필드명은 그리드 고유 어휘로 확정).
 * ★1열/1행에서는 그 축 갭이 화면에 효과가 없어 죽은 컨트롤이 된다 — cols.length>=2 /
 *   rows.length>=2 일 때만 각각 노출한다(_ratioRowHtml/_rowHeightHtml 과 같은 술어). */
function _gapRowHtml(cols, rows, colGap, rowGap) {
  let html = '';
  if (cols.length >= 2) {
    html += `
      <div class="prop-row">
        <span class="prop-label">열 간격</span>
        <input type="range" class="prop-slider" id="grd-col-gap-slider" min="0" max="${GRID_GAP_MAX}" step="2" value="${colGap}">
        <input type="number" class="prop-number" id="grd-col-gap-number" min="0" max="${GRID_GAP_MAX}" value="${colGap}">
      </div>`;
  }
  if (rows.length >= 2) {
    html += `
      <div class="prop-row">
        <span class="prop-label">행 간격</span>
        <input type="range" class="prop-slider" id="grd-row-gap-slider" min="0" max="${GRID_GAP_MAX}" step="2" value="${rowGap}">
        <input type="number" class="prop-number" id="grd-row-gap-number" min="0" max="${GRID_GAP_MAX}" value="${rowGap}">
      </div>`;
  }
  if (!html) return '';
  return html + `<div class="prop-hint">행/열 사이 간격(px)</div>`;
}

/* ── 칸 «테두리» UI — T-172 ────────────────────────────────────────────────
 * ★★왜 「칸 꾸미기」 절이 아니라 여기(Layout)인가.
 *   「칸 꾸미기」 절은 자기 입으로 «이 칸에만 적용된다»고 말한다(그 절의 힌트 원문).
 *   이 손잡이는 «블록 통째»라, 거기에 넣으면 패널이 «거짓말»을 한다. 같은 축(블록 전체에
 *   걸리는 배치 손잡이 — 비율·행 높이·간격·정렬)이 모여 있는 Layout 이 제 집이다.
 * ★★굵기가 0 이면 «색·꼴 줄을 아예 안 낸다».
 *   ⑴ 선이 없는데 색·꼴은 «죽은 컨트롤»이다 — 바로 위 _gapRowHtml 이 1열/1행에서 같은
 *      판단을 이미 했다(「그 축 갭이 화면에 효과가 없어 죽은 컨트롤이 된다」). 같은 술어다.
 *   ⑵ 그리고 패널이 이미 길다. 세 줄을 늘 내면 순증이 164px 였다(실측 2026-09-24,
 *      tests/dom/grid-cell-panel-handles.dom.spec.js G2 합격선 +60). 접힘 절을 새로 만드는
 *      대신 «필요할 때만 나오게» 한다 — 손잡이 수는 그대로고 기본 화면만 짧아진다.
 *   ⚠️이 선택이 만든 사각지대 = 「켠 상태의 패널 폭」을 G2 가 «안 잰다»(늘 꺼진 픽스처를 쓴다).
 *     그 자리를 tests/dom/grid-cell-border.dom.spec.js S7 이 «같은 패치에서» 따로 잰다.
 * ★1칸(1×1)이어도 숨기지 않는다 — 간격과 술어가 다르다. 칸이 하나여도 테두리는 «보인다».
 * ⛔새 아이콘을 만들지 않는다(U-SVG 가 규격을 통일 중) — 전부 글자 라벨과 기존 부품이다. */
/** 「칸 테두리」 절 — ⛔Layout «안»이 아니라 줄바 «아래»에 산다.
 *  ★★왜 옮겼나 (2026-09-24 실측). 이 손잡이를 Layout 절에 넣었더니
 *    tests/dom/grid-cell-panel-handles.dom.spec.js G2 ⑵ 가 빨개졌다 —
 *    「줄바(#grd-line-summary)가 기준선보다 아래로 밀리면 안 된다(Δ ≤ 0)」.
 *    줄바는 이 패널에서 손이 제일 자주 가는 자리라 창 900px 에서 화면 밖으로 내려가면 안 된다
 *    (같은 까닭으로 f724dc1 이 「줄 꾸미기」를 Typography «위»로 올렸다).
 *  ⇒ 줄바 «위»에는 무엇도 새로 못 올린다. 그래서 바로 아래에 «자기 절»로 놓는다.
 *  ★덤 — 칸/줄을 안 고른 «블록만 선택» 상태에서는 줄바·칸 꾸미기·줄 꾸미기가 전부 빈 문자열이라,
 *    이 절이 Layout 바로 다음에 온다. 「표를 만들려고 블록을 고른」 사람이 보는 순서가 그거다. */
/* ★2026-09-25 R2 — 이 절의 «범위»가 화면에 없었다.
 *   슬라이더는 «블록의 모든 칸»에 걸리는데, 바로 25px 아래 「칸 꾸미기 · 1행 1열」 절은
 *   「이 칸에만 적용된다」고 적혀 있다. 둘 다 「칸…」으로 시작해 같은 축으로 읽혔다.
 * ⇒ 절 제목 한 줄로 범위를 «먼저» 말한다. 라벨을 「모든 칸 테두리」로 늘리는 길도 있었지만
 *   `.prop-label` 은 56px 고정(overflow:hidden)이라 그 자리에서 잘린다 — R1 이 고치고 있는
 *   바로 그 병이다. 제목은 다른 절(Grid·Layout·Image)과 «같은 부품»이라 새 관용구도 아니다.
 * ⛔자리는 안 옮긴다 — 줄바 «바로 아래»는 G2 ⑵(줄바가 더 밀리면 안 된다) 때문에 정해진 자리다. */
function _borderSectionHtml(bd) {
  return `
    <div class="prop-section">
      <div class="prop-section-title" title="이 블록의 «모든 칸»에 걸린다 — 아래 「칸 꾸미기」 절(그 칸 하나)과 축이 다르다">모든 칸 테두리</div>
${_borderRowHtml(bd)}
    </div>`;
}

function _borderRowHtml(bd) {
  const on = bd.width > 0;
  const hex = swatchHex(bd.color, '#d0d0d0');
  const widthRow = `
      <div class="prop-row">
        <span class="prop-label" title="모든 칸에 선을 두른다 — 표처럼 보이게. 0 = 없음. 간격을 0 으로 두면 선이 «한 겹»으로 붙어 표가 된다">굵기</span>
        <input type="range" class="prop-slider" id="grd-border-w-slider" min="0" max="${GRID_BORDER_W_MAX}" step="1" value="${bd.width}">
        <input type="number" class="prop-number" id="grd-border-w-number" min="0" max="${GRID_BORDER_W_MAX}" value="${bd.width}">
      </div>`;
  if (!on) return widthRow;
  const styleOpts = [['solid', '실선'], ['dashed', '파선'], ['dotted', '점선']]
    .map(([v, ko]) => `<option value="${v}"${bd.style === v ? ' selected' : ''}>${ko}</option>`).join('');
  return widthRow + `
      <div class="prop-row">
        <span class="prop-label">선 색</span>
        <div class="prop-color-swatch" style="background:${bd.color}">
          <input type="color" id="grd-border-color" value="${hex}">
        </div>
        <input type="text" class="prop-color-hex" id="grd-border-color-hex" maxlength="7" aria-label="칸 테두리 색" value="${hex.replace('#', '').toUpperCase()}">
      </div>
      <div class="prop-row">
        <span class="prop-label" title="파선·점선은 «조용히 실선으로» 떨어지지 않는다 — 저장값 그대로 그려진다">선 꼴</span>
        <select class="prop-select" id="grd-border-style" title="선 꼴">${styleOpts}</select>
      </div>`;
}

/* ══ Typography·Fill 절 — 마크업은 «부품»이 낸다 ═══════════════════════════
 * ⛔여기에 절 마크업을 «베끼지» 마라 — _typo-section.js 한 곳에서만 온다.
 *   tests/unit/typo-section-ssot.test.mjs T2·T2-b 가 이 파일도 같은 루프로 검사한다.
 *
 * ★value(명시) vs placeholder(역할 기본값)를 «구분»한다.
 *   이 레포가 이미 쓰는 말이다 — 위 _rowHeightHtml 의 행 높이가 `placeholder="auto" value=""`
 *   («비우면 자동»)이고, prop-banner02 의 Size 절도 같다. 새 관용구를 만들지 않는다.
 *   ⛔구분을 안 하면: 값을 채워 두면 사용자가 「이 줄은 16px 로 정해뒀다」고 착각하고,
 *     더 나쁘게는 «아무것도 안 만졌는데» change 가 한 번 튀기만 해도 역할 폴백이
 *     데이터에 «굳어버린다»(line.fontSize:16 이 박혀 이후 역할 변경에 영영 안 따라온다).
 *   ★스와치는 «진실»(지금 무슨 색인가)을, hex 칸은 «누가 정했나»를 말한다 — 층이 다르다.
 *
 * ★실패 판정식(계획서 §4-B): `칸.value || 칸.placeholder` 가 빈 문자열이면 실패.
 *   회색 22 는 「빈 채로 떴다」가 아니다. D1-b 가 이 식을 그대로 단언한다. */
function _grdTypoSectionsHtml(hit, block) {
  if (!hit) {
    return `
    <div class="prop-section">
      <div class="prop-section-title">Typography</div>
      <!-- ★2026-09-25 R5 — 옛 문구는 「캔버스에서 «글자 줄을 클릭»하면 …」이라 줄바의 안내와
           «같은 지시»를 두 번째로 했다. 지시는 줄바 한 자리에 모았고(_grdLineBarHtml),
           여기는 «이 절의 상태»만 말한다. ⛔빈 절 자체를 숨기는 것은 별건(R10)이다. -->
      <div class="prop-hint">글자 줄을 고르면 여기 뜬다</div>
    </div>`;
  }
  const { line } = hit;
  const role = _grdRoleOf(line);
  const size = Number(line.fontSize) || role.size;
  const weight = String(line.weight ?? role.weight);
  const roleLsPx = _grdRoleLsPx(role, size);

  const colorRaw = (_grdHas(line, 'color') && GRID_COLOR_RE.test(String(line.color).trim()))
    ? String(line.color).trim() : '';
  const swatch = colorRaw ? swatchHex(colorRaw, role.color) : role.color;

  return `
    ${buildTypographySectionHtml({
      p: 'grd-typo',
      font: _grdHas(line, 'fontFamily') ? String(line.fontFamily) : '',
      weight,
      size: _grdHas(line, 'fontSize') ? size : '',
      sizePh: String(role.size),
      isBold: Number(weight) >= 700,
      isItalic: line.italic === '1',
      isStrike: line.strike === '1',
      lh: _grdHas(line, 'lineHeight') ? Number(line.lineHeight) : '',
      lhPh: String(role.lh),
      ls: _grdHas(line, 'letterSpacing') ? Number(line.letterSpacing) : '',
      lsPh: String(roleLsPx),
      /* ★그리드 h1 은 64px 다 — 모달의 10~60 을 그대로 쓰면 «기본값이 상한 밖»이 된다. */
      sizeMin: 8, sizeMax: 800,
      /* ⛔showHighlight:false — 「빠뜨린 것」이 아니다. 그리드 줄에서 «글자 배경»은 line.bg 이고,
         line.bg 가 있으면 렌더러가 «뱃지» 분기(grid-block.js 의 `if (bg)`)로 갈아탄다 —
         inline-block + padding + border-radius:999px, 즉 형광펜이 «알약»이 된다.
         형광펜을 원하면 line.bg 를 넓히는 별건 발주다. 다음 사람이 「빠졌네」 하고
         true 로 되돌리면 tests/unit/grid-line-typo.test.js U1-c 가 빨강을 낸다. */
      showHighlight: false,
    })}
    ${buildFillSectionHtml({
      p: 'grd-typo',
      colorHex: swatch,                                    // 스와치·피커 = «진실»
      alpha: colorRaw ? parseAlphaFromColor(colorRaw) : 100,
      colorHexVal: colorRaw ? swatch.replace('#', '').toUpperCase() : '',   // «누가 정했나»
      colorHexPh: String(role.color).replace('#', '').toUpperCase(),
    })}`;
}

/* ══ Typography·Fill 배선 ══════════════════════════════════════════════════
 * ★어휘는 prop-modal(setDs/commit), «기법»은 prop-grid.
 *   ⛔prop-modal 의 commit 은 슬라이더 change 에서 pushHistory 를 «나중»에 부른다.
 *     뒤에 부르면 스냅샷이 «이미 바뀐 상태»라 undo 가 두 단계를 한꺼번에 되돌린다 —
 *     이 레포엔 moveSection 에 그 버그가 실재한다. ⇒ 제스처의 «첫 적용 전»에 1회.
 * ★진실은 dataset 이다(모달 계보). ⛔DOM 인라인 스타일에 쓰지 마라 — renderGridBlock 이
 *   innerHTML 을 통째로 새로 만들어 «첫 측정을 통과하고 조용히 죽는다»(D1-c 가 2차 측정을 한다). */
function _grdWireTypo(block, addr) {
  let _gesture = false;
  const begin = () => { if (_gesture) return; _gesture = true; window.pushHistory?.(); };   // ★적용 «전»
  const end   = () => { _gesture = false; window.scheduleAutoSave?.(); };

  /* 줄 하나에 필드를 얹는다 — 되쓰기는 grid-block.js 의 gridPreviewLine «한 곳»이고,
     그것은 updateGridBlock 과 «같은» _gridMergeLine/_gridCellPatchDataset 을 쓴다.
     ⛔updateGridBlock 을 직접 부르지 않는 이유: 그건 스스로 pushHistory 를 쌓고 패널을 통째로
       다시 그린다 — 색 피커를 드래그하는 동안 그러면 히스토리가 폭주하고 포커스가 끊긴다. */
  const setLine = (fields) => {
    gridPreviewLine(block, addr.r, addr.c, addr.li, fields);
    _grdSyncLineMark(block, addr);       // 재렌더가 마커를 지웠다 — 다시 붙인다
    _grdRefreshSummary(block, addr);
  };
  const commit = (fields) => { begin(); setLine(fields); end(); };

  // ── 폰트 — 위젯은 «한 벌»(_font-picker.js). 우리는 «적용»만 준다(prop-modal :264 선례).
  wireFontPicker({
    root: propPanel, p: 'grd-typo',
    getCurrent: () => _grdLine(block, addr)?.fontFamily || '',
    onPick: (rawVal) => commit({ fontFamily: rawVal || undefined }),
  });

  // ── 굵기 select — 명시값이 없으면 «역할 기본값» option 이 선택돼 있다(select 엔 placeholder 가 없다).
  const wSel = document.getElementById('grd-typo-font-weight');
  if (wSel && !_grdHas(_grdLine(block, addr) || {}, 'weight')) wSel.title = '역할 기본값';
  wSel?.addEventListener('change', () => commit({ weight: wSel.value }));

  /* ── 숫자 칸 — change(blur·Enter)에서만 커밋한다(비율·행높이 입력과 동일 원칙).
       ★비우면 undefined 를 써서 «역할 기본»으로 되돌린다 — 회색 placeholder 가 다시 뜬다. */
  const numWire = (id, field, min, max, parse) => {
    const el = document.getElementById(id);
    el?.addEventListener('change', () => {
      const raw = String(el.value).trim();
      if (raw === '') { commit({ [field]: undefined }); el.value = ''; return; }
      const x = Math.min(max, Math.max(min, parse(raw)));
      el.value = x;
      commit({ [field]: x });
    });
  };
  numWire('grd-typo-size-number', 'fontSize', 8, 800, v => parseInt(v, 10) || 0);
  numWire('grd-typo-lh-number', 'lineHeight', 1, 3, v => parseFloat(v) || 1);
  numWire('grd-typo-ls-number', 'letterSpacing', -10, 40, v => parseFloat(v) || 0);

  /* ── B / I / S — H 는 «없다»(showHighlight:false, 위 주석 참조).
       B 는 별개다: 그리드 줄엔 bold 플래그가 없고 weight 가 진실이다 ⇒ 700 ↔ 400 토글. */
  const boldBtn = document.getElementById('grd-typo-bold-btn');
  boldBtn?.addEventListener('click', () => {
    const line = _grdLine(block, addr) || {};
    const next = Number(line.weight ?? _grdRoleOf(line).weight) >= 700 ? 400 : 700;
    boldBtn.classList.toggle('active', next >= 700);
    if (wSel) wSel.value = String(next);
    commit({ weight: next });
  });
  for (const [id, key] of [['grd-typo-italic-btn', 'italic'], ['grd-typo-strike-btn', 'strike']]) {
    const btn = document.getElementById(id);
    btn?.addEventListener('click', () => {
      const on = (_grdLine(block, addr) || {})[key] === '1';
      btn.classList.toggle('active', !on);
      commit({ [key]: on ? undefined : '1' });
    });
  }

  /* ── 글자색 (Fill 절) ──
     ⛔wireColorField 를 못 쓴다 — 그건 `<prefix>-hex` 를 보는데 이 절의 id 는 텍스트·모달과
       «같은» `<prefix>-color-hex` 다. 절을 공유한 대가로 배선은 여기서 짠다(prop-modal 과 같은 처지). */
  const cPick   = document.getElementById('grd-typo-color');
  const cHex    = document.getElementById('grd-typo-color-hex');
  const cAlpha  = document.getElementById('grd-typo-color-alpha');
  const cSwatch = cPick?.closest('.prop-color-swatch');
  const raw0 = String((_grdLine(block, addr) || {}).color || '');
  // 스와치 «배경»만은 raw 로 — var() 바인딩이면 변수의 실제 색이 보여야 한다.
  if (cSwatch && raw0) cSwatch.style.background = raw0;
  let _alpha = raw0 ? parseAlphaFromColor(raw0) : 100;
  let _grdLastHex = parseHex6(cHex?.value || '') || '';   // '' = 아무도 안 정했다(placeholder 갈래)
  const buildColor = () => {
    const h = (cPick?.value || '#000000').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const a = Math.max(0, Math.min(1, _alpha / 100));
    return a >= 1 ? (cPick?.value || '#000000') : `rgba(${r},${g},${b},${a})`;
  };
  const applyColor = () => {
    const cc = buildColor();
    if (cSwatch) cSwatch.style.background = cc;
    begin();                       // ★연속 input 의 «첫» 한 번만 히스토리를 찍는다
    setLine({ color: cc });
  };
  cPick?.addEventListener('input', () => {
    // alpha 0 이면 색을 바꿔도 안 보인다 — 사용자가 alpha 를 안 건드렸으면 되살린다.
    if (_alpha === 0) { _alpha = 100; if (cAlpha) cAlpha.value = '100'; }
    if (cHex) cHex.value = cPick.value.replace('#', '').toUpperCase();
    _grdLastHex = cPick.value;              // 피커로 바꾼 색도 「마지막 유효값」이다(blur 복원 기준)
    applyColor();
  });
  cPick?.addEventListener('change', end);
  /* 글자색 hex — 배선은 color-picker.js 의 wireHexText 한 자리(2026-09-21 픽스 라운드).
     ★prop-modal.js 와 «같은 손사본»이었다 — blur 리스너가 0건이라 무효값이 칸에 영원히 남았다.
       두 자리가 같은 절(_typo-section buildFillSectionHtml)을 쓰면서 배선만 따로 짜다 벌어진 일.
     ★빈 값 = 「안 정했다」(placeholder 갈래) — grid-typo.dom.spec 이 지키는 축이다. */
  wireHexText(cHex, {
    parse: (raw) => (String(raw ?? '').trim() === '' ? '' : parseHex6(raw)),
    format: (v) => (v ? formatHex6(v) : ''),
    getCurrent: () => _grdLastHex,
    onApply: (v) => {
      if (!v) return;                       // 빈 칸 = 미지정 — 옛 동작(no-op)과 같다
      _grdLastHex = v;
      if (cPick) cPick.value = v;
      if (_alpha === 0) { _alpha = 100; if (cAlpha) cAlpha.value = '100'; }
      applyColor();
    },
    onCommit: (v) => { if (v) end(); },
  });
  cAlpha?.addEventListener('change', () => {
    _alpha = Math.min(100, Math.max(0, parseInt(cAlpha.value, 10) || 0));
    cAlpha.value = String(_alpha);
    applyColor(); end();
  });

  /* 컬러 변수 칩 — 정적 hex 복사가 아니라 var(--color-<name>, #hex) «바인딩»이다.
     ★_GRID_COLOR_RE 를 var() 까지 넓혔다 — 안 그러면 칩이 「눌리는데 안 먹는」 상태가 된다
       (modal-block.js 가 2026-09-08 같은 것에 물렸다). tests/unit/grid-color-re.test.mjs 가 지킨다. */
  const chipBox = document.getElementById('grd-typo-color-chips');
  if (chipBox) {
    wireColorVarChips({
      container: chipBox,
      getActiveName: () => parseColorVarName((_grdLine(block, addr) || {}).color || ''),
      getFallbackHex: (name, hex) => hex,
      onPick: (cssRef) => {
        commit({ color: cssRef });
        const fb = (String(cssRef).match(/#[0-9a-fA-F]{6}/) || [])[0];
        if (fb && cPick) { cPick.value = fb; _grdLastHex = fb; if (cHex) cHex.value = fb.replace('#', '').toUpperCase(); }
        _alpha = 100; if (cAlpha) cAlpha.value = '100';
        if (cSwatch) cSwatch.style.background = cssRef;
      },
    });
  }

  /* ── [+ 줄 추가]/[줄 삭제]/[↺ 기본값으로] — «줄바»로 분리됐다(2026-09-16, _grdWireLineBar).
       이미지·갭 줄도 줄바가 뜨므로 여기(텍스트 줄 전용 배선)에 두면 두 벌이 된다. */
}

/* ══ 「줄 꾸미기」 절 — «그 줄 하나»에만 걸리는 것들 (줄 정렬 · 알약 배경) ═══════
 * ★줄 정렬 — 렌더러는 글자 줄도 그림 줄도 `line.align || colAlign || 'left'` 로 «줄 값이 열 값을
 *   가린다». 모델도 렌더도 되는데 패널엔 «열 단위» 정렬 하나뿐이라, 한 줄만 가운데로 놓을 길이 없었다.
 *   ⚠️★그림 줄에는 «폭이 꽉 차면 움직일 데가 없다» — 렌더러가 `widthPct < 100` 일 때만
 *     margin-inline 을 건다(꽉 찬 그림에 여백을 붙이면 기존 저장본의 산출이 바뀐다 — 그쪽 그물이
 *     폭 100% 여섯 칸을 「바이트 동일」로 잠가 뒀다). ⇒ 그 사실을 «손잡이 옆에 적는다».
 *     ⛔안 적으면 사용자가 「눌리는데 안 먹는다」로 겪는다 — 이 카드가 정확히 그 말로 시작했다.
 *
 * ★알약 — `line.bg` 가 있으면 _gridLineHtml 이 `if (bg)` 분기로 가 inline-block ＋ padding ＋
 *   border-radius:999px 로 그린다. 「글자 배경」이 아니라 «알약»이다.
 *   ⛔_typo-section 의 showHighlight 를 true 로 되돌리는 것은 «답이 아니다» —
 *     형광펜(글자 배경)과 알약(line.bg)은 렌더러에서 «다른 분기»이고,
 *     tests/unit/grid-line-typo.test.js U1-c 가 그 자리를 잠갔다. 알약은 자기 손잡이로 낸다.
 *   ★기본은 «꺼짐» — 값이 없으면 스와치가 체커보드(없음)이고 hex 칸은 빈 채다. 비우면 다시 꺼진다.
 * ⛔절 마크업을 _typo-section 에서 «베끼지» 않는다 — 여긴 그 절이 아니라 그리드 «전용» 손잡이다
 *   (그 절의 지문 id 꼬리 -color-chips/-style-group 등은 한 개도 쓰지 않는다).
 *
 * ★접힘 기본 — 칸 꾸미기와 «같은 부품·같은 집»(_grdDisclosureHtml · _grdOpenSections).
 *   ⛔절을 하나 더 «펼친 채로» 내면 순증 예산(Δ≤+60)을 그 자리에서 넘긴다(실측으로 확인). */
const _GRD_LINE_ALIGN_KINDS = new Set([..._GRD_ROLE_KINDS, 'image']);

function _grdLineSectionHtml(anyHit, block) {
  if (!anyHit || anyHit.li === null || !anyHit.line) return '';
  const { r, c, li, line } = anyHit;
  const canAlign = _GRD_LINE_ALIGN_KINDS.has(line.type || 'body');
  void block;
  /* ★그림 줄은 «폭이 꽉 차면» 정렬이 안 보인다 — 렌더러의 wp<100 가드가 «의도»다.
     지금 그 줄이 실제로 꽉 차 있을 때만 말한다(늘 띄우면 잔소리가 되고 아무도 안 읽는다). */
  const imgFull = (line.type === 'image') && !(Number(line.widthPct) < 100);
  const isText = gridLineHasText(line);
  /* ⛔여기서 일찍 빠지지 마라 — 갭 줄에도 «종류 바꾸기»는 있어야 한다(되돌아갈 길). */
  const open = _grdSecOpen(block, 'line');
  const raw = (typeof line.bg === 'string' && GRID_COLOR_RE.test(String(line.bg).trim()))
    ? String(line.bg).trim() : '';
  const hex = raw ? swatchHex(raw, '#eeeeee') : '#eeeeee';
  void r; void c;
  return `
    <div class="prop-section"${open ? '' : ' style="padding-bottom:0;"'}>
${_grdDisclosureHtml('grd-line-toggle', `줄 꾸미기 · ${li + 1}번째 줄`, open)}
      <div id="grd-line-body" style="display:${open ? 'block' : 'none'};">
        <div class="prop-row">
          <span class="prop-label" title="이 줄의 종류를 바꾼다(글자 역할 · 아이콘 · 여백)">줄 종류</span>
${_grdKindSelectHtml(line)}
        </div>
        ${canAlign ? `<div class="prop-row">
          <span class="prop-label" title="이 «줄»만 정렬한다(기본 = 열을 따른다). 열 정렬 단추는 그 열 전체다">줄 정렬</span>
          <select class="prop-select" id="grd-line-align" title="이 줄의 가로 정렬(기본 = 칸을 따른다)">${_grdOptsHtml(_GRD_CELL_ALIGNS, line.align)}</select>
        </div>${imgFull ? `<div class="prop-hint" style="text-align:left;padding:0 0 6px;">그림 폭이 100%라 정렬이 안 보인다 — 줄일 데가 없어서다. 아래 Image 절의 「폭(%)」를 줄이거나 캔버스에서 코너를 끌면 움직인다.</div>` : ''}` : ''}
        ${isText ? `<div class="prop-row" style="margin-bottom:0;">
          <span class="prop-label" title="배경을 주면 이 줄이 «알약»(둥근 인라인 배지)이 된다. 비우면 꺼진다.">알약 배경</span>
          <div class="prop-color-swatch${raw ? '' : ' swatch-none'}"${raw ? ` style="background:${raw}"` : ''}>
            <input type="color" id="grd-badge-color" value="${hex}">
          </div>
          <input type="text" class="prop-color-hex" id="grd-badge-hex" maxlength="7" placeholder="없음" aria-label="알약 배경색" value="${raw ? hex.replace('#', '').toUpperCase() : ''}">
        </div>` : ''}
      </div>
    </div>`;
}

function _grdWireLineSection(block, addr) {
  const hit = _grdResolveAnyAddr(block, addr);
  if (!hit || hit.li === null || !hit.line) return;
  const { r, c, li } = hit;
  _grdWireDisclosure(block, 'line', 'grd-line-toggle', 'grd-line-body');

  /* ── 줄 정렬 — «이 줄»에만. ⛔updateGridBlock 을 쓰지 않는다: 이미지 줄에 align 을 주면
       렌더러 민감도 검사(_gridUnreadLineFields)가 「아무것도 안 읽힌다」로 «거절»한다.
       되쓰기는 _grdWireTypo·알약과 «같은» gridPreviewLine 한 길이다. */
  const alignSel = document.getElementById('grd-line-align');
  alignSel?.addEventListener('change', () => {
    window.pushHistory?.();                    // ★적용 «전»에 한 번(제스처 1회 = 히스토리 1회)
    gridPreviewLine(block, r, c, li, { align: alignSel.value || undefined });
    _grdSyncLineMark(block, { r, c, li });     // 재렌더가 마커를 지웠다 — 다시 붙인다
    window.scheduleAutoSave?.();
  });

  if (!gridLineHasText(hit.line)) return;      // 알약은 «글자 줄»만
  const pick = document.getElementById('grd-badge-color');
  const hexEl = document.getElementById('grd-badge-hex');
  const swatch = pick?.closest('.prop-color-swatch');
  const paint = (hex) => {
    if (!swatch) return;
    swatch.classList.toggle('swatch-none', !hex);
    swatch.style.background = hex || '';
  };
  /* ⛔updateGridBlock 을 쓰지 않는다 — 그건 패널을 통째로 다시 그려 색을 고르는 동안
     포커스가 끊기고 히스토리가 폭주한다. 되쓰기는 _grdWireTypo 와 «같은» gridPreviewLine. */
  let _gesture = false;
  const commit = (bg) => {
    if (!_gesture) { _gesture = true; window.pushHistory?.(); }   // ★적용 «전»에 한 번
    gridPreviewLine(block, r, c, li, { bg });
    _grdSyncLineMark(block, { r, c, li });     // 재렌더가 마커를 지웠다 — 다시 붙인다
  };
  const end = () => { _gesture = false; window.scheduleAutoSave?.(); };

  pick?.addEventListener('input', () => {
    paint(pick.value);
    if (hexEl) hexEl.value = pick.value.replace('#', '').toUpperCase();
    commit(pick.value);
  });
  pick?.addEventListener('change', end);
  wireHexText(hexEl, {
    parse: (raw) => (String(raw ?? '').trim() === '' ? '' : parseHex6(raw)),
    format: (v) => (v ? formatHex6(v) : ''),
    getCurrent: () => {
      const cur = _grdLine(block, { r, c, li }) || {};
      return (typeof cur.bg === 'string' && GRID_COLOR_RE.test(cur.bg.trim())) ? swatchHex(cur.bg.trim(), '') : '';
    },
    onApply: (v) => { paint(v || ''); if (v && pick) pick.value = v; },
    // 빈 칸 = 「알약 끄기」 — undefined 로 키를 없앤다(_gridMergeLine 이 Object.assign 이라 사라진다).
    onCommit: (v) => { commit(v || undefined); end(); },
  });
}

/** 요약 한 줄의 «직접 지정 N» 만 제자리에서 고친다 — 패널을 다시 그리지 않는다(포커스 보존).
 *  ⛔문구를 여기 «다시 적지» 마라 — _grdSummaryText 한 곳에서만 온다(R4). */
function _grdRefreshSummary(block, addr) {
  const el = document.getElementById('grd-line-summary');
  const line = _grdLine(block, addr);
  if (!el || !line) return;
  const s = _grdSummaryText(addr.r, addr.c, addr.li, line);
  el.textContent = s;
  el.title = s;
}

/**
 * @param {HTMLElement} block
 * @param {{r:number,c:number,li:number}|null} [addrArg] 선택된 «줄» 주소.
 *   ⛔반드시 «선택적»이어야 한다 — tools/duo-align-probe/run.cjs 가 4곳에서 1-인자로 부르고,
 *     updateGridBlock 도 1-인자로 되부른다. 안 주면 «기억하고 있던» 줄을 그대로 쓴다.
 *   null 을 «명시»하면 선택 해제다(undefined 와 다르다).
 */
export function showGridProperties(block, addrArg) {
  /* ★_grdResolveAnyAddr — 어떤 줄(글자/이미지/갭)이든, «빈 셀»(li:null)까지 받는다.
   *   _curAddr(=기억할 주소)·줄바는 이 «넓은» 판정을 쓴다.
   *   Typography/Fill 절(_hit)만 «좁은» _grdResolveAddr(글자 줄 전용)을 그대로 쓴다 —
   *   D1-b 가 그 판정식을 직접 단언하므로 한 글자도 안 바꾼다. */
  const _addrIn = addrArg === undefined ? grdGetActiveLine(block) : addrArg;
  /* ★0922 T-058 — «명시적 null» = 블럭 단위로 선택을 다시 세웠다는 신호다(Esc 상위 이동 ·
     레이어 패널 · 정본 패널표 panel-dispatch · MCP selectBlock — 네 곳 다 null 을 명시한다).
     그때 드릴다운 걸쇠를 푼다: 안 풀면 그 «다음» 캔버스 클릭(사용자에겐 첫 클릭)이 곧바로 줄로
     내려가 ⌫ 가 «칸에 남은 마지막 줄» 보호에 걸린다 — 블럭이 영영 안 지워지던 그 증상.
     ⛔1-인자(undefined) 재표시(updateGridBlock 되부름)에서는 절대 풀지 마라 — 그건 «선택을
       그대로 둔다»는 뜻이라 D5(줄 있는 칸 여백 클릭)와 줄 편집 중 재렌더가 조용히 깨진다. */
  if (addrArg === null) grdResetCanvasDrill();
  /* ★중첩 안 줄 (T-200 커밋 ②) — «따로» 푼다. _grdResolveAnyAddr 은 np 를 거절하므로
     (그 바일아웃이 패널 여섯 자리를 한 번에 닫는다) 여기서만 정체를 알 수 있다.
     ⛔_curAddr 에 np 를 «싣는다» — 그래야 캔버스 마커가 그 줄에 붙고, ⌫·코너핸들이
       「중첩이면 아무것도 안 한다」를 판정할 수 있다. 실으면서 li 도 같이 남기는데,
       li 는 «품은 duo 줄»이라 np 를 안 보는 자가 있으면 엉뚱한 줄을 건드린다 ⇒ 소비자
       전수(editor.js ⌫ · overlay-handles 둘 · 이 파일 리졸버 둘)에 바일아웃을 박았다. */
  const _nestHit = _grdResolveNestAddr(block, _addrIn);
  const _anyHit = _nestHit ? null : _grdResolveAnyAddr(block, _addrIn);
  const _curAddr = _nestHit
    ? { r: _nestHit.r, c: _nestHit.c, li: _nestHit.li, np: _nestHit.np }
    : (_anyHit ? { r: _anyHit.r, c: _anyHit.c, li: _anyHit.li } : null);
  const _hit = _grdResolveAddr(block, _curAddr);
  grdSetActiveLine(block, _curAddr);
  let cols = [];
  try { cols = JSON.parse(block.dataset.cols || '[]'); } catch (_) {}
  const rows = gridRows(block);   // 없으면(옛 파일) [{height:'auto'}] 1행 — grid-block.js 승격 로직과 공유
  /* ★2026-09-05 현빈 지시로 「간격」(양축 동시) 슬라이더를 패널에서 걷어냈다 — «그» 편의 슬라이더는
   * 재도입하지 않는다. 2026-09-16(T-D) 부터는 열 간격/행 간격을 «따로» 조작하는 슬라이더 2개가 있다
   * (아래 _gapRowHtml). ⛔데이터와 렌더러는 그대로다 — `block.dataset.gap` 은 레거시 기준값 겸
   * 단축값으로 계속 산다(옛 프로젝트 호환), rowGap/colGap 없는 블록은 이 값으로 폴백한다. */
  const { row: _rowGap, col: _colGap } = gridGaps(block);
  const _cellBorder = gridCellBorder(block);   // ★T-172 — 읽는 문은 grid-block.js 하나뿐이다
  const valign = block.dataset.valign || 'top';
  // 가로 정렬은 컬럼 모델(col.align)에 산다. 컬럼마다 다르면(혼합) 어느 버튼도 active 로 켜지 않는다.
  const _aligns = cols.map(c => c.align || 'left');
  const halign = (_aligns.length && _aligns.every(a => a === _aligns[0])) ? _aligns[0] : '';
  /* ★2026-09-25 R3 — 아래 정렬 단추는 «열을 단일 진실원으로» 만들려고 칸·줄에 따로 준 정렬을
   *   전부 걷는다(그 설계는 그대로 둔다 — 아래 [data-ha]/[data-va] 주석이 까닭을 적어 뒀다).
   *   그런데 같은 화면 안내문 아홉 줄 중 «이를 예고하는 문장이 0줄»이었다: 한 번 누르면
   *   말없이 지워진다.
   * ⇒ 「지울 게 있을 때만」 한 줄 예고한다 — 늘 띄우면 그게 또 소음이 되고, 피커가 이미
   *   같은 꼴(「줄이면 잘린 칸 내용은 사라진다 (⌘Z 복원)」)로 파괴를 예고하고 있어서 꼴을 베꼈다.
   * ⛔판정은 «걷는 그 루프»에 dryRun 으로 묻는다 — 사본을 만들면 예고와 실제가 갈린다. */
  const _alignWipes = _grdStripCellOverride(block, 'align', true)
                   || _grdStripCellOverride(block, 'valign', true)
                   || _grdColsHaveAlignOverride(block, 'align')
                   || _grdColsHaveAlignOverride(block, 'valign');

  /* ★「Grid (N×M)」 절도 접이식이다 — 기본 접힘 (2026-09-25 · 현빈 발주 「위를 접는다」).
   *   왜 — 이 절은 패널 «맨 위»에서 4×4 피커 격자만으로 세로를 크게 먹는데, «칸 수»는
   *   블록을 만들 때 한 번 정하고 나면 거의 안 만지는 손잡이다. 그 아래 자주 쓰는 절들
   *   (줄바·테두리·칸 꾸미기·줄 꾸미기·Typography)이 그만큼 화면 밖으로 밀려나 있었다.
   *   ⇒ 접으면 그 절들이 «스크롤 없이» 보이는 자리로 올라온다.
   *   ★접어도 «지금 몇 칸인지»는 제목이 말한다 — 제목에 (N×M) 이 이미 있었고, 여기에
   *     「— 칸 수 바꾸기」를 붙여 «무엇을 여는 절인지»까지 접힌 채로 말하게 했다.
   *   ⛔부품도 집도 «칸 꾸미기»·«줄 꾸미기»와 같은 것을 쓴다(_grdDisclosureHtml · _grdOpenSections).
   *     열림 상태는 WeakMap(메모리)이라 ★저장본에 안 들어간다 — 저장 포맷 무변경.
   *   ⛔이 절이 «DOM 에서 사라지는» 것이 아니다 — 몸(#grd-size-body)만 display:none 이고
   *     피커 셀 16개와 힌트 두 줄은 그대로 있다. 그 사실을 기계로 재는 그물:
   *     tests/dom/grid-panel-fold.dom.spec.js (F2 — 접힘 vs 펼침에서 DOM 수가 «같다»). */
  const _sizeOpen = _grdSecOpen(block, 'size');

  propPanel.innerHTML = `
    <div class="prop-section">
${blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="2" width="4.5" height="8" rx="1"/><rect x="6.5" y="2" width="4.5" height="8" rx="1"/>
          </svg>`,
      name: block.dataset.layerName,
      defaultName: 'Grid Block',
      crumb: window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : '',
      id: block.id,
    })}
    </div>
    <div class="prop-section"${_sizeOpen ? '' : ' style="padding-bottom:0;"'}>
${_grdDisclosureHtml('grd-size-toggle', `Grid (${cols.length}×${rows.length}) — 칸 수 바꾸기`, _sizeOpen)}
      <div id="grd-size-body" style="display:${_sizeOpen ? 'block' : 'none'};">
        <div class="grid-picker" id="grd-grid-picker"></div>
        <div class="grid-picker-label" id="grd-grid-picker-label">—</div>
        <div class="prop-hint" style="margin-top:2px;">가로×세로 칸 수를 고른다</div>
        <!-- ★적대검수 Q3: 「줄이면 보존」으로 동작을 바꾸는 대신 «사실을 적는다».
             API 경로(grid-block.js)가 이미 «자르고 undo» 정책이라, 피커만 보존하면 정책이 둘로 갈라진다. -->
        <div class="prop-hint" style="margin-top:2px;">줄이면 잘린 칸 내용은 사라진다 (⌘Z 복원)</div>
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Layout</div>
      ${_ratioRowHtml(cols)}
      ${_rowHeightHtml(rows)}
      ${_gapRowHtml(cols, rows, _colGap, _rowGap)}
      <div class="prop-row">
        <span class="prop-label">가로 정렬</span>
        <div class="prop-align-group" id="grd-halign-group">
          ${alignBtn('object-h', 'left', { label: '왼쪽 정렬', title: '왼쪽 정렬', active: halign === 'left', attrs: { 'data-ha': 'left' } })}
          ${alignBtn('object-h', 'center', { label: '가운데 정렬 (수평)', title: '가운데 정렬 (수평)', active: halign === 'center', attrs: { 'data-ha': 'center' } })}
          ${alignBtn('object-h', 'right', { label: '오른쪽 정렬', title: '오른쪽 정렬', active: halign === 'right', attrs: { 'data-ha': 'right' } })}
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">세로 정렬</span>
        <div class="prop-align-group" id="grd-valign-group">
          ${alignBtn('object-v', 'top', { label: '위쪽 정렬', title: '위쪽 정렬', active: valign === 'top', attrs: { 'data-va': 'top' } })}
          ${alignBtn('object-v', 'middle', { label: '가운데 정렬 (수직)', title: '가운데 정렬 (수직)', active: valign === 'middle', attrs: { 'data-va': 'middle' } })}
          ${alignBtn('object-v', 'bottom', { label: '아래쪽 정렬', title: '아래쪽 정렬', active: valign === 'bottom', attrs: { 'data-va': 'bottom' } })}
        </div>
      </div>
      ${_alignWipes ? '<div class="prop-hint" style="text-align:left;padding:2px 0 4px;">칸·줄에 따로 준 정렬은 지워진다 (⌘Z 복원)</div>' : ''}
      <div class="prop-hint" style="margin-top:2px;">세로 정렬은 컬럼 높이가 서로 다를 때만 움직인다</div>
    </div>
    ${_grdNestHintHtml(_nestHit)}
    ${_grdLineBarHtml(_anyHit, block)}
    ${_borderSectionHtml(_cellBorder)}
    ${_grdCellSectionHtml(_anyHit, block)}
    ${_grdLineSectionHtml(_anyHit, block)}
    ${_grdImageSectionHtml(_anyHit, block)}
    ${_grdTypoSectionsHtml(_hit, block)}`;
  /* ★2026-09-25 R1＋R5 — 여기 있던 마지막 절
       「글자는 «캔버스에서 줄을 더블클릭»해 고친다」
     을 «지웠다». 두 가지가 한꺼번에 걸려 있었다:
       R1 그 말이 `.prop-label`(56px 고정 · overflow:hidden)에 갇혀 실측 193px 중 56px,
          즉 «약 29%»만 읽혔다. (`.prop-label--auto` 로 풀 수도 있었다 — css/editor-props.css 의
          그 클래스 주석이 정확히 이 사고를 적어 뒀다.)
       R5 그 말은 「캔버스를 클릭하라」를 말하는 «세 조각» 중 ⑶ 이었다.
     ⇒ 폭을 넓혀 «세 번째 조각을 또렷하게» 만드는 대신, 줄바 한 문장
       (「칸을 한 번 더 누르면 줄 편집 · 두 번 누르면 글자 편집」)에 흡수시켰다.
       ★그래서 R1 은 «따로 남지 않는다» — R5 에 흡수됐다.
     ⚠️거래 — 그 한 문장은 «칸/줄을 아직 안 고른» 상태에서만 뜬다. 줄을 고른 뒤에는
       「더블클릭하면 글자를 고친다」가 화면에 없다. 줄바 절에 넣으면 G2 ⑵(줄바가 더 밀리면
       안 된다)가 빨개져서 그 자리에는 못 둔다 — 자리가 필요하면 별건으로 발주해야 한다. */

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  /* ── 비율 배선 — «change» 시점에만 커밋(blur/Enter) ── */
  /* ⚠️updateGridBlock 을 매 입력마다 부르지 않는다 — 성공하면 showGridProperties 를 다시 불러
   *   패널을 통째로 새로 그린다. 입력 중(각 keystroke)에 재호출하면 포커스가 든 input DOM 이
   *   교체돼 타이핑이 끊긴다. (전에 있던 gap 슬라이더도 같은 이유로 dataset 직접 쓰기를 택했었다 —
   *   그 슬라이더는 2026-09-05 에 제거됐다.) 여기서도 «change»(blur/Enter) 시점에만 dataset 을
   *   커밋하고 패널은 다시 그리지 않는다.
   *   (검증은 여기서 한다 — 컬럼 2~4개, width 는 양수) */
  const _commitCols = (next) => {
    /* ★상한은 grid-block.js 의 클램프와 «같은 값»이어야 한다 — MIN_COLS/MAX_COLS 상수를 import 해서
     * «같은 값»을 강제한다(하드코딩 2건 반복 금지). P0 에서 grid-block.js 세 자리(렌더/생성/검증)를
     * 4로 올리면서 «여기 하나»를 놓쳐 4열 그리드 비율 입력이 조용히 무시됐던 사고(2026-09-04
     * fix(grid-p0) 1abfea2)가 있었다 — 이 레포의 고질(열거 자리가 흩어져 있어 한 곳만 고치면
     * «절반만» 고쳐진다)이라 P1에서 아예 상수 import 로 재발을 막는다. */
    if (!Array.isArray(next) || next.length < MIN_COLS || next.length > MAX_COLS) return false;
    next.forEach(c => { const n = Number(c.width); c.width = Number.isFinite(n) && n > 0 ? n : 1; });
    block.dataset.cols = JSON.stringify(next);
    window.renderGridBlock?.(block);
    return true;
  };
  /* ── 4×4 그리드 피커 — 가로×세로 칸 수 변경 (현빈 발주 ①) ─────────────────
   * ★2026-09-04 P1: maxRows 해제 — 이제 진짜 4×4(행 축이 생겼다).
   * 줄일 때 잘린 칸/행의 내용은 pushHistory 로 undo 복원(패널 힌트에도 적어뒀다).
   *
   * ⚠️2026-09-05 정정: 여기 「카드블럭과 «같은» UI 를 쓴다(공용 buildGridPicker)」라고 적혀
   *   있었는데 «거짓» 이었다(적대검수). `_helpers.js` 의 buildGridPicker 를 부르는 곳은
   *   이 파일 «하나» 뿐이고, 카드·월계수·캔버스(prop-simple-card.js · prop-laurel.js ·
   *   prop-canvas.js)는 피커를 통째로 복붙해 각자 갖고 있다.
   *   ⇒ 여기 고친 것이 그쪽에 «안 간다». 피커 동작을 바꿀 땐 그 세 곳을 따로 봐야 한다.
   *   (공용화는 별건 — 지금 묶으면 세 블록의 UX 를 동시에 바꾸는 셈이라 발주가 필요하다.) */
  buildGridPicker(
    document.getElementById('grd-grid-picker'),
    document.getElementById('grd-grid-picker-label'),
    (nCols, nRows) => {
      const curCols = JSON.parse(block.dataset.cols || '[]');
      const curRows = gridRows(block);
      if (nCols === curCols.length && nRows === curRows.length) return;
      window.pushHistory?.();                     // ★변경 «전»에

      const nextCols = [];
      for (let i = 0; i < nCols; i++) {
        /* ★[M41] 열을 늘릴 때의 기본값도 «정본 한 줄»을 쓴다 — 여긴 h2:'제목' 을 얹고 있어서
         * 블록 생성(grid-block.js)·열 추가(여기)·행 추가(아래)가 서로 «다른» 기본값이었다. */
        nextCols.push(curCols[i] || { width: 1, lines: [{ type: 'body', text: GRID_CELL_DEFAULT_TEXT }] });
      }
      // ⛔줄일 때 잘린 칸의 내용은 «버려진다» — undo 로 되돌아온다(pushHistory 를 먼저 부른 이유).
      block.dataset.cols = JSON.stringify(nextCols);

      if (nRows <= 1) {
        // 1행으로 돌아가면 옛 duo 파일과 «완전히 같은» 모양으로 되돌린다(dataset.rows/cells 제거).
        delete block.dataset.rows;
        /* ★T-178 — 다만 «행 0 칸 꾸밈»은 행이 하나가 돼도 살아 있어야 한다(1행 그리드의 칸도 칸이다).
           꾸밈이 하나도 없을 때만 dataset.cells 를 지워 옛 duo 모양을 그대로 돌려준다. */
        let row0 = [];
        try { const cur = JSON.parse(block.dataset.cells || '[]'); row0 = Array.isArray(cur[0]) ? cur[0] : []; } catch (_) { row0 = []; }
        const keep = [];
        for (let c = 0; c < nCols; c++) {
          const cell = row0[c];
          keep.push((cell && typeof cell === 'object' && !Array.isArray(cell)) ? cell : {});
        }
        if (keep.some(cell => Object.keys(cell).length)) block.dataset.cells = gridCellsToDataset([keep]);
        else delete block.dataset.cells;
      } else {
        const nextRows = [];
        for (let i = 0; i < nRows; i++) nextRows.push(curRows[i] || { height: 'auto' });
        block.dataset.rows = JSON.stringify(nextRows);

        /* ★새로 생긴 행에 «기본 내용»을 넣는다.
         * 안 넣으면 셀이 빈 채로 높이 0 이 되어, 2x2 를 눌러도 «아무 일도 안 일어난 것»처럼 보인다
         * (실측: rows=2 이고 grd-cell 4개가 생겼는데 2행 두 칸 높이가 0px).
         * 1행이 기본 텍스트를 갖는 것과 «같은 대우»여야 사용자가 무엇이 생겼는지 안다.
         * ⚠️정정(적대검수 지적, 2026-09-04): 이 코드는 «옛 내용을 보존하지 않는다».
         *   nextCells 를 새로 만들어 덮으므로 «잘린 행/열의 내용은 사라진다».
         *   내가 앞서 커밋 메시지에 「줄였다 늘려도 옛 내용이 살아 있다」고 썼는데 «거짓»이었다 —
         *   P1 의 「cells 를 그대로 둔다」 설계를 병합에서 모르고 뒤집었다.
         *   복원은 undo 로만 된다(그래서 pushHistory 를 변경 전에 부른다). */
        /* ★T-178 — dataset.cells 가 «행 0 포함 전체»가 되면서 이 루프의 인덱스가 «한 칸» 움직였다.
           ⛔읽는 문(_gridCellRows)과 이 자리를 따로 옮기면 행이 한 칸 밀려 «화면은 멀쩡해 보이는
             데이터 손상»이 난다 — 그래서 같은 커밋에 있다.
           ★행 0 에는 기본 줄을 «안» 넣는다: 행 0 의 줄은 cols[].lines 가 갖는다(위 nextCols 가 채운다).
             행 0 칸은 «꾸밈만» 담으므로 없으면 빈 객체다. */
        let curCells = [];
        try { curCells = JSON.parse(block.dataset.cells || '[]'); } catch (_) { curCells = []; }
        const nextCells = [];
        for (let r = 0; r < nRows; r++) {
          const row = Array.isArray(curCells[r]) ? curCells[r] : [];
          const outRow = [];
          for (let c = 0; c < nCols; c++) {
            outRow.push(row[c] || (r === 0 ? {} : { lines: [{ type: 'body', text: GRID_CELL_DEFAULT_TEXT }] }));
          }
          nextCells.push(outRow);
        }
        if (nextCells.length) block.dataset.cells = gridCellsToDataset(nextCells);
        else delete block.dataset.cells;
      }
      window.renderGridBlock?.(block);
      window.scheduleAutoSave?.();
      /* ★거터를 «명시적으로» 걷고 다시 세운다.
       * showGridProperties 끝에도 showGridGutters 가 있지만 피커 경로에서는 그것만으로 안 따라온다 —
       * 실측: 2x1 → 3x3 으로 바꿔도 거터가 col 1개 그대로였다(2초 뒤에도).
       * 격자 «수»가 바뀌는 건 이 경로뿐이라 여기서 한 번 정리한다. */
      hideGridGutters();
      /* ★자기재귀 — 현재 «줄 주소»를 같이 넘긴다. 안 넘기면 조작마다 선택이 첫 줄로 튄다
         (손으로 눌러 보기 전엔 안 보이는 자리 — tests/dom/grid-typo.dom.spec.js D5 가 검사). */
      showGridProperties(block, _curAddr);
      showGridGutters(block);                   // 패널 재생성(칸/행 수가 바뀌면 섹션도 바뀐다)
    },
    /* ★cur — 「지금 몇 칸인가」를 피커가 «펼치자마자» 그림으로 말하게 한다(2026-09-25).
       절이 기본 접힘이 되면서, 펼친 사람이 맨 먼저 묻는 것이 이것이 됐다.
       ⛔hover 하기 전엔 한 칸도 안 칠해지던 것이 옛 동작이다 — _helpers.js 가 까닭을 적어 뒀다. */
    { max: MAX_COLS, maxRows: MAX_ROWS, minCols: MIN_COLS, minRows: MIN_ROWS,
      cur: { cols: cols.length, rows: rows.length } }
  );
  /* ⛔접이식 배선은 innerHTML 이 선 «뒤»라야 한다(getElementById 가 그때 산다).
     칸 꾸미기·줄 꾸미기와 «같은 부품»이다 — 키만 'size' 로 다르다. */
  _grdWireDisclosure(block, 'size', 'grd-size-toggle', 'grd-size-body');

  const ratioInput = document.getElementById('grd-col-ratio');
  const _applyRatioInput = (raw) => {
    const cur = JSON.parse(block.dataset.cols || '[]');
    if (!cur.length) return;
    const parts = parseRatio(raw, cur.length);   // prop-table.js 와 공유 — 부족 1 패딩·초과 자름
    parts.forEach((w, i) => { if (cur[i]) cur[i].width = w; });
    _commitCols(cur);
    if (ratioInput) ratioInput.value = parts.join(':');   // 정규화 결과로 되씀(테이블과 동일 패턴)
  };
  ratioInput?.addEventListener('change', e => {
    /* ★pushHistory 는 변경 «전»에. 뒤에 부르면 스냅샷이 «이미 바뀐 상태»라
     * 피커→비율 순서에서 undo 가 두 단계를 한꺼번에 되돌린다(적대검수 지적).
     * 이 레포엔 moveSection 에 같은 버그가 실재한다 — 새 코드에서 복제하지 않는다. */
    window.pushHistory?.();
    _applyRatioInput(e.target.value);
    window.scheduleAutoSave?.();
  });
  document.getElementById('grd-col-ratio-reset')?.addEventListener('click', () => {
    const cur = JSON.parse(block.dataset.cols || '[]');
    const equal = Array(cur.length).fill(1).join(':');
    window.pushHistory?.();                     // ★변경 «전»에(위와 같은 이유)
    _applyRatioInput(equal);
    window.scheduleAutoSave?.();
  });

  /* ── 열 간격 / 행 간격 슬라이더 — 공용 bindSlider(_helpers.js) 재사용(prop-frame.js:512 선례).
   * ⛔showGridProperties 를 재호출하지 않는다 — 그러면 매 드래그 프레임마다 패널을 통째로
   *   다시 그려 포커스가 든 input 이 교체되고 타이핑/드래그가 끊긴다(색 피커·비율 입력과 같은 함정).
   * ★dataset.gap(레거시 균일값)은 여기서 손대지 않는다 — 패널 슬라이더 조작은 rowGap/colGap 만
   *   갱신한다(현빈 확정 정책: API 의 gap 호출만 양축 동시 갱신, 패널은 축별). */
  const colGapSlider = document.getElementById('grd-col-gap-slider');
  const colGapNumber = document.getElementById('grd-col-gap-number');
  if (colGapSlider && colGapNumber) {
    bindSlider(colGapSlider, colGapNumber, (v) => {
      block.dataset.colGap = String(v);
      window.renderGridBlock?.(block);
      window._grdSyncLineMark?.(block, grdGetActiveLine(block));
    }, { min: 0, max: GRID_GAP_MAX });
  }
  const rowGapSlider = document.getElementById('grd-row-gap-slider');
  const rowGapNumber = document.getElementById('grd-row-gap-number');
  if (rowGapSlider && rowGapNumber) {
    bindSlider(rowGapSlider, rowGapNumber, (v) => {
      block.dataset.rowGap = String(v);
      window.renderGridBlock?.(block);
      window._grdSyncLineMark?.(block, grdGetActiveLine(block));
    }, { min: 0, max: GRID_GAP_MAX });
  }

  /* ── 칸 테두리 «셋» — T-172 ─────────────────────────────────────────────
   * ★굵기는 갭 슬라이더와 «같은 길»이다: dataset 직접 쓰기 + renderGridBlock.
   *   ⛔여기서 updateGridBlock 을 부르면 드래그 «매 프레임»마다 패널이 통째로 다시 그려져
   *     잡고 있던 슬라이더 DOM 이 교체된다(바로 위 갭 주석이 같은 말을 적어 뒀다).
   * ★색·꼴은 «한 번에 끝나는» 조작(change)이라 updateGridBlock 정본 길로 보낸다 —
   *   검증(색 꼴·선 꼴 명부)과 히스토리·자동저장이 그 안에 다 있다.
   * ⛔「굵기 0 이면 1px 로 켜 준다」는 «안» 넣는다 — 굵기 0 에서는 색·꼴 줄이 아예 없어서
   *   그 길이 닿지 않는다. 닿지 않는 보정을 남겨 두면 다음 사람이 「그 경우는 처리돼 있다」로
   *   읽는다(검사처럼 생긴 문장). 굵기 0 에서 켜는 손잡이는 «굵기» 하나다. */
  const _bdCommit = (fields) => _grdToastCellFail(window.updateGridBlock?.(block.id, fields));

  const bdSlider = document.getElementById('grd-border-w-slider');
  const bdNumber = document.getElementById('grd-border-w-number');
  if (bdSlider && bdNumber) {
    /* ★0 을 «넘나들 때만» 패널을 다시 그린다 — 색·꼴 줄이 나오고 들어가야 하기 때문이다.
       ⛔매 프레임 다시 그리지 않는다(드래그 중 슬라이더 DOM 이 교체돼 손이 끊긴다).
         그래서 판정은 «드래그가 끝난 뒤»(change)에 한 번만 한다. */
    const wasOn = gridCellBorder(block).width > 0;
    bindSlider(bdSlider, bdNumber, (v) => {
      block.dataset.cellBorderWidth = String(v);
      window.renderGridBlock?.(block);
      window._grdSyncLineMark?.(block, grdGetActiveLine(block));
    }, { min: 0, max: GRID_BORDER_W_MAX });
    const _reopenIfToggled = () => {
      if ((gridCellBorder(block).width > 0) !== wasOn) showGridProperties(block, _curAddr);
    };
    bdSlider.addEventListener('change', _reopenIfToggled);
    bdNumber.addEventListener('change', _reopenIfToggled);
  }

  const bdColorPick = document.getElementById('grd-border-color');
  const bdColorHex  = document.getElementById('grd-border-color-hex');
  const bdSwatch    = bdColorPick?.closest('.prop-color-swatch');
  const bdPaint = (hex) => {
    if (!bdSwatch) return;
    bdSwatch.classList.toggle('swatch-none', !hex);
    bdSwatch.style.background = hex || '';
  };
  bdColorPick?.addEventListener('input', () => bdPaint(bdColorPick.value));
  bdColorPick?.addEventListener('change', () => {
    if (bdColorHex) bdColorHex.value = bdColorPick.value.replace('#', '').toUpperCase();
    _bdCommit({ cellBorderColor: bdColorPick.value });
  });
  /* ⛔빈 칸을 «지움»으로 읽지 않는다 — 테두리를 끄는 손잡이는 «굵기 0» 하나다.
     두 자리에서 끌 수 있게 하면 「껐는데 안 꺼진다」가 생긴다(색만 비운 상태 = 기본색 선). */
  wireHexText(bdColorHex, {
    parse: (raw) => parseHex6(raw),
    format: (v) => formatHex6(v),
    getCurrent: () => swatchHex(gridCellBorder(block).color, '#d0d0d0'),
    onApply: (v) => { bdPaint(v || ''); if (v && bdColorPick) bdColorPick.value = v; },
    onCommit: (v) => { if (v) _bdCommit({ cellBorderColor: v }); },
  });

  const bdStyleSel = document.getElementById('grd-border-style');
  bdStyleSel?.addEventListener('change', () => {
    if (!GRID_BORDER_STYLES.includes(bdStyleSel.value)) return;   // ⛔모르는 꼴을 조용히 실선으로 떨구지 않는다
    _bdCommit({ cellBorderStyle: bdStyleSel.value });
  });

  /* 세로 정렬 — «블록 통째»(block.dataset.valign). 렌더러는 pick('valign') 가 있으면 그것을 먼저
     쓰므로(_GRID_VALIGN[pick('valign')] || blockValign), 칸/열 오버라이드가 남아 있으면 이 단추가
     그 칸에서만 «조용히 죽는다».
     ★짝 검사 — 이 커밋이 칸 단위 세로정렬 손잡이(위 칸 꾸미기 절)를 새로 냈다. 그 손잡이가 만드는
       오버라이드를 여기서 안 걷으면 «내가 방금 만든» 사각지대가 된다. 가로 정렬과 같은 대우. */
  propPanel.querySelectorAll('[data-va]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.valign = btn.dataset.va;
    try {
      const c = JSON.parse(block.dataset.cols || '[]');
      if (Array.isArray(c) && c.length) {
        c.forEach(col => { if (col && typeof col === 'object') delete col.valign; });
        block.dataset.cols = JSON.stringify(c);
      }
    } catch (_) {}
    _grdStripCellOverride(block, 'valign');
    window.renderGridBlock?.(block);
    window.pushHistory?.(); window.scheduleAutoSave?.();
    showGridProperties(block, _curAddr);        // ★줄 선택 유지 (D5)
  }));

  // 가로 정렬 — 컬럼 단위(col.align)로 일괄 적용.
  // ★라인의 line.align 은 렌더러에서 col.align 을 «가린다»(_gridLineHtml: line.align || colAlign).
  //   실제 저장본 실측(147줄 중 17줄)에서 그 라인들만 안 움직여 «절반만 먹는» 정렬이 된다 →
  //   컬럼 레벨 일괄 지시일 때는 라인 오버라이드를 걷어내 컬럼을 단일 진실원으로 만든다(undo 가능).
  // ★★2026-09-23 — 그 약속이 «행 축이 생기면서» 깨져 있었다. 이 핸들러는 dataset.cols(=행 0)만
  //   읽고 dataset.cells(행 1~)를 «한 번도» 안 읽었다. 실클릭 실측(3×3, 1행 칸에 align:'center'):
  //     after 00:right 01:right 02:right   ← 1행만
  //           10:center 11:center 12:center ← 2~4행은 그대로
  //   ⚠️피커로만 만든 그리드(칸에 align 키가 아예 없음)는 9칸이 다 먹어서 «안 보인다» —
  //     칸/줄에 값이 «있을 때»만 갈라진다 ⇒ AI·MCP 가 만든 그리드를 사람이 패널로 고치는 길에서만
  //     터진다. 이 제품이 실제로 도는 길이 그 길이다.
  //   ⇒ 아래 행 칸의 오버라이드도 «걷어낸다»(값을 박지 않는다 — 렌더러 폴백 pick(cell??col)이
  //     걷어내는 것만으로 컬럼을 단일 진실원으로 만든다. 저장본도 덜 부푼다).
  propPanel.querySelectorAll('[data-ha]').forEach(btn => btn.addEventListener('click', () => {
    try {
      const c = JSON.parse(block.dataset.cols || '[]');
      if (!Array.isArray(c) || !c.length) return;
      c.forEach(col => {
        col.align = btn.dataset.ha;
        _grdStripLineAlign(col.lines);
      });
      block.dataset.cols = JSON.stringify(c);
      if (_grdStripCellOverride(block, 'align')) { /* dataset.cells 갱신은 그 안에서 */ }
      window.renderGridBlock?.(block);
      window.pushHistory?.(); window.scheduleAutoSave?.();
      showGridProperties(block, _curAddr);      // ★줄 선택 유지 (D5)
    } catch (_) {}
  }));

  /* ── 행 높이 — change(blur/Enter)에서만 커밋(비율 입력과 동일 원칙) ──────── */
  propPanel.querySelectorAll('.grd-row-h-item').forEach(inp => {
    inp.addEventListener('change', () => {
      const ri = parseInt(inp.dataset.ri);
      const curRows = gridRows(block);
      if (!curRows[ri]) return;
      const raw = inp.value.trim();
      const v = raw === '' ? 'auto' : Math.max(0, Math.min(ROW_H_MAX, parseInt(raw) || 0));
      curRows[ri] = { height: v };
      window.pushHistory?.();
      block.dataset.rows = JSON.stringify(curRows);
      window.renderGridBlock?.(block);
      window.scheduleAutoSave?.();
      inp.value = v === 'auto' ? '' : v;   // 정규화 결과로 되씀(비율 입력과 동일 패턴)
    });
  });

  // ★2026-09-04 P2: 캔버스 셀 경계 드래그 거터(overlay-handles.js) — 패널이 뜨는 자리마다
  //   같이 띄운다(클릭 선택·레이어패널 선택·updateGridBlock 후 재선택 모두 이 함수를 거친다,
  //   PLAN-gridblock.md §5). 해제는 editor.js deselectAll()의 hideGridGutters 로 일괄.
  _grdWireLineBar(block, _curAddr);
  _grdWireCellSection(block, _curAddr);
  _grdWireImageSection(block, _curAddr);
  if (_hit) _grdWireTypo(block, _curAddr);
  _grdWireLineSection(block, _curAddr);

  showGridGutters(block);
  // ★이미지 줄 코너 리사이즈 핸들(T-C) — 「지금 선택된 이미지 줄」에만 뜬다. 다른 줄이면
  //   내부에서 스스로 hideGridImageResizeHandle() 로 정리한다(showHandlesFor 맵에 없는 이유는
  //   블록 전체가 아니라 «줄 주소» 단위 상태라 그리드 전용 경로에서만 결정할 수 있어서다).
  window.showGridImageResizeHandle?.(block);
  /* ★마커는 «맨 끝»에 다시 붙인다 — 이 함수가 불리는 모든 경로(클릭·레이어패널·MCP·
     updateGridBlock 후 재표시)에서 재렌더가 innerHTML 을 갈아끼웠을 수 있다(bn2 :22~26 과 동형). */
  _grdSyncLineMark(block, _curAddr);
}

window.showGridProperties = showGridProperties;
// ★deprecated 별칭 — 2026-09-05 개명 이전 이름(tools/duo-align-probe·외부 CDP 스크립트 호환).
//   제거는 P1. grid-block.js 의 window.*Duo* 별칭 4개와 동반한다.
window.showDuoProperties = showGridProperties;

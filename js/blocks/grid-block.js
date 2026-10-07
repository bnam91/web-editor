/* ═══════════════════════════════════
   GRID BLOCK — 다단(2~4컬럼 × 1~4행) 그리드 레이아웃 프리미티브 (BL-CDD-02)
   ★2026-09-05 개명: 「duo」 → 「grid」. 셸 정체성은 .grid-block / data-type="grid" / 새 id 접두 grd_.
     옛 저장본의 .duo-block 은 «읽을 때» migrateGridIdentity() 가 승격한다(id 는 안 바꾼다 — 참조다).
   ★열 상한 4 = 2026-09-04 P0 4x4 피커. 중첩 라인 그리드(line.type==='duo')만 3 유지(:77). 행 축(1~4)은 P1 신설.
═══════════════════════════════════ */
//
// 봉인된 NewGrid(자유 중첩 그리드)의 대체가 아니라, 상세페이지에서 실제로 필요한
// "정형 다단/그리드"(좌 수치/우 설명, 양극 게이지, 좌 이미지/우 텍스트, N×M 격자)만 안전하게 커버한다.
// 자식 블록 중첩 없음 — 상태는 전부 data-*(cols/rows/cells JSON), renderGridBlock이 인라인
// 스타일로만 재조립(직렬화·HTML export 그대로 생존, step/infocard 패턴).
//
// ★2026-09-04 P1(행 축) — 데이터 모델 R2(PLAN-gridblock.md §3-A):
//   cols  = [{ width:1, align, valign, bg, padding, radius, lines?[] }]   // 열 가중치(fr) + «행 0」 콘텐츠
//   rows  = [{ height:'auto'|<px> }]                                     // 없으면 [{height:'auto'}] (=옛 1행 파일과 동일)
//   cells = [[{align?,valign?,bg?,padding?,radius?,lines?[]}, …], …]     // ★«행 0 포함 전체 R×C»
// ~~[폐기 · T-178 2026-09-23] 「cells 는 «행 1 이후만» 저장한다(행 0 은 없음)」~~
//   까닭 — 그러면 cols[c] 가 「열 기본값」과 「행 0 칸」을 «겸직»한다. 행 0 칸 하나에 준 배경색이
//   그 열의 기본값이 되어, 렌더러 폴백(cell[k] ?? col[k]) 때문에 «아래 행 칸까지» 칠해졌다.
//   더 고약한 쪽: 아래 칸의 «모델»은 null 인 채 «화면»만 칠해져 저장본을 봐도 까닭이 안 보였다.
// ★T-178 이후의 자리 나눔 — 겸직을 푼다:
//     cols[c].{align,valign,bg,padding,radius} = 그 «열의 기본값»(자기 값 없는 칸들이 따른다)
//     cells[0][c].{…같은 5개}                  = 「행 0 «그 칸»」의 값(열 기본값을 덮는다)
//     cols[c].lines                            = 행 0 «줄 내용»  ← 여기는 «안» 바뀐다
// ★단일 진실원 유지: 행 0 의 «줄 내용»은 여전히 cols[c].lines 「하나」뿐이다 —
//   ⛔cells[0][c] 에는 `lines` 키가 «절대» 없다(있으면 두 값이 어긋나는 2-소스 버그다).
//   쓰는 문 _gridCellsToDataset 이 행 0 의 lines 를 떼고, 읽는 문 _gridCellRows 가 또 뗀다.
//   getGridModel()가 cols 로부터 행 0 의 줄을 «항상 재구성»해서 돌려준다 —
//   이게 곧 「cells 없는 옛 파일의 승격」이다(모든 블록이 항상 이 경로를 거친다).
// ⚠️저장 포맷이 바뀌었다 — T-178 «이전»에 저장된 dataset.cells(행 1~)는 이제 «한 행 위로» 읽힌다.
//   마이그레이션은 범위 밖이다(현빈 승인 — 기존 저장본 무시).
// cols[].lines: [{ type:'label|h1|h2|h3|body|caption|image|gap',
//                  text?, fontSize?, color?, weight?, align?, marginTop?,
//                  imgSrc?, height?(image/gap), radius?(image) }]

import { ROW_H_MAX } from '../grid-cell-resize.js';   // ★행 높이 상한은 한 곳에서만 온다
import { insertAfterSelected, genId } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

/* ★[M41] 새 칸의 기본 내용 — «한 줄». 열 추가(prop-grid.js)·행 추가도 이 값을 쓴다. */
export const GRID_CELL_DEFAULT_TEXT = '내용을 입력하세요.';

const GRID_DEFAULTS = {
  gap: 24,
  valign: 'top', // top | middle | bottom
  cols: [
    /* ★[M41] 「왼쪽 컬럼 / 오른쪽 컬럼」 제거 — 현빈 원문: 「기본적으로 '내용을 입력하세요' 하나만
       있으면 될듯」. 자리를 알려주려고 넣은 h2 였는데, 새 그리드를 만들 때마다 «지우는 일»이 먼저였다.
       ⚠️여기가 «세 자리 중 정본»이다 — 피커로 열을 늘릴 때(prop-grid.js)·행을 늘릴 때가 서로
       다른 기본값을 쓰고 있었다(각각 h2:'제목'+body / body 만). 셋을 이 한 줄로 맞춘다. */
    { width: 1, lines: [{ type: 'body', text: GRID_CELL_DEFAULT_TEXT }] },
    { width: 1, lines: [{ type: 'body', text: GRID_CELL_DEFAULT_TEXT }] },
  ],
};
const ROW_DEFAULT = { height: 'auto' };
// ★한도 — 3곳(이 파일의 _gridCols/_gridRows, updateGridBlock 검증)이 «같은 값»을 봐야 한다
//   (P0 EVAL이 지적한 「열거 자리가 흩어진다」 재발 방지 — 한 곳에 모은다).
/* ═══ 열 하한 «결정 이력» — ⛔이 칸은 버그가 아니라 «정책»이다. 지우지 말고 읽어라 ═══
 *
 * ~~[2026-09-04 결정 · 폐기됨] 「⛔1열은 그대로 막아둔다(그리드 최소 형태).
 *   PLAN §3-A "1열 허용 여부는 결정 필요"에 대한 답」  → MIN_COLS = 2~~
 *   ↑ ★옛 문장을 «남겨 둔다». 이건 오기가 아니라 «의식적으로 묻고 답한 기록»이었다.
 *     지워 버리면 다음 사람이 「왜 2였지」를 다시 처음부터 조사한다.
 *
 * ★[2026-09-05 · 현빈 지시로 «뒤집었다» — 1열 허용] MIN_COLS = 1
 *   현빈 원문: 「그리드 피커 첫번쨰 칼럼 선택이 안되는건 «그리드 이기 떄문이라서 그럴까?»
 *              일단 «1*4로도 할수 있어야»될거 같은데??」
 *   ⇒ ★현빈도 「막힌 데 이유가 있을 수 있다」를 알고 물었고, 그럼에도 열어달라고 했다.
 *     즉 이 커밋은 «버그 수정»이 아니라 «정책 변경»이다. 위 2026-09-04 결정은 «폐기»한다.
 *   ⛔되돌리려면 현빈에게 다시 물어라 — 코드만 보고 「막는 게 맞겠지」로 되돌리지 마라.
 *
 * ── 왜 상수 «하나»가 피커 첫 열 4칸(1x1~1x4)을 죽였나 ──
 *   참조 7자리가 전부 이 값을 본다(2026-09-05 전수 grep):
 *     이 파일 :74 `_gridCols` 폴백 · :327 makeGridBlock · :424·:425 updateGridBlock 검증 · :562 export
 *     prop-grid.js :148 `_commitCols` · :224 피커 `minCols`
 *   ★그중 «진짜 주인»은 `_gridCols` 의 `cols.length < MIN_COLS → 기본값 폴백` 이다 —
 *     _helpers.js 옛 주석이 경고한 「눌러도 dataset 만 1 이 되고 캔버스는 2칸으로 남는다」가 그것이고,
 *     MIN_COLS=1 이면 그 «폴백 조건 자체»가 사라진다.
 * ═══════════════════════════════════════════════════════════════════════════════ */
/* ★K5 ⒜(2026-10-05 지디 · lane-f-grid) — 상한 4×4 → 8×8(현빈 「8×8」). 피커(_helpers.js buildGridPicker)·캔버스 ＋(gridResizeTo)·정리 slice·검증이
   전부 이 두 상수를 읽는다 ⇒ 여기 한 자리. 옛 값 4(2026-09-04 4×4 피커). */
const MIN_COLS = 1, MAX_COLS = 8;
const MIN_ROWS = 1, MAX_ROWS = 8;   // 1행 = 옛 duo 파일과 동일(행 축 신설 이전 기본값).
/* ★셀당 줄 개수 상한 — SSOT(2026-09-16). 이전엔 이 파일(:205)과 prop-grid.js(:367)가 각자
 *   리터럴 20을 들고 있었다(하드코딩 2건 반복 — MIN_COLS/MAX_COLS 사고와 같은 유형).
 *   grdAddLine(prop-grid.js)이 이 값을 import 해서 사전 확인한다. */
const MAX_CELL_LINES = 20;
/** 빈 칸이 «배송본에서도» 차지하는 최소 높이(px). `.bn2-line-empty`(배너 빈 줄)와 같은 값.
 *  ⛔0 으로 되돌리면 「모든 칸이 빈 블럭」이 내보내기에서 통째로 사라진다(현빈 0927 ㈏ 위반).
 *  지키는 그물: tests/dom/grid-cell-emptied.dom.spec.js 의 I. */
const GRID_EMPTY_CELL_MIN_H = 14;

/* ★행/열 간격 상한 — 「클램프가 여러 곳에 흩어져 하나만 고쳐지는」 사고 반복 방지, 한 곳에 모은다.
 *   updateGridBlock 검증(gap/rowGap/colGap)·prop-grid.js 슬라이더 max 가 전부 이 값을 본다. */
/* ══ 이미지 상한 «둘» — 입구가 다르면 상한도 다르다(2026-09-20, 0920b-grid-image) ══════════
 * ★왜 둘인가. 현빈 원문: 「그리드블럭 > 우클릭 후 이미지 삽입안되는 이슈」.
 *   실측 결과 메뉴는 떴고 커밋도 갔는데, 아래 GRID_IMG_MAX_CHARS 에 걸려 «조용히» 버려졌다
 *   (grdAddLine 이 반환을 안 받아 토스트조차 안 떴다). 200000자 ≈ 원본 146KB 라
 *   스크린샷·사진은 거의 전부 넘는다 ⇒ 「거의 항상 실패」.
 *
 *  ┌ GRID_IMG_MAX_CHARS — «MCP/IPC» 통로의 상한. main.js:7024 가 partial 을 JSON 문자열로
 *  │   executeJavaScript 에 실어 보내므로 문자열 길이 자체가 비용이다. 여기는 안 푼다.
 *  │   ★block-factory.js:2691 이 같은 병을 먼저 앓고 같은 말을 적어 뒀다 — 「imgSrc는 IPC
 *  │   문자열이라 200000자 캡이 걸린다(≈150KB — 실사진은 대부분 넘는다)」. 그때의 답도
 *  │   「UI 전용 우회로를 낸다」(scratchId)였다. 그리드는 UI 입구가 MCP용 API 를 그대로
 *  │   타는 바람에 우회로 없이 같은 캡을 뒤집어썼다.
 *  └ GRID_IMG_MAX_BYTES — «UI»(파일 선택 대화상자) 입구의 상한. 사람이 고른 «파일 크기»로
 *      잰다(문자열 길이가 아니다 — 선례: prop-zoom.js _applyZoomImage 5MB,
 *      image-handling.js ASSET_IMAGE_MAX_BYTES 20MB). 5MB 는 prop-zoom 선례를 따랐다.
 *      ⛔무제한 금지 — gridPreviewLine(이 파일 아래)이 색 슬라이더 드래그 «매 프레임»
 *        JSON.stringify(cols) 를 한다. 큰 base64 가 같은 배열에 있으면 rAF 마다 그만큼 문자열
 *        연산이다(끊김). 상한을 더 올리려면 그 자리부터 재라.
 * ⛔GRID_IMG_MAX_CHARS 는 «3번째 인자» opts.trusted 로만 건너뛴다 — partial 안에 넣지 마라.
 *   MCP 는 partial 을 JSON 으로 보내므로 partial.trusted 를 인정하면 그게 곧 뒷문이다. */
export const GRID_IMG_MAX_CHARS = 200000;
export const GRID_IMG_MAX_BYTES = 5 * 1024 * 1024;

export const GRID_GAP_MAX = 200;
/* ★행 간격만 «음수»를 받는다 — 줄끼리 겹치게(현빈 2026-10-01 「로우 사이 간격 0~200 인데 -50 정도까지」).
 *   CSS row-gap 은 음수를 «무효»로 버리므로 그리기에선 row-gap:0 + 둘째 줄부터 칸마다 margin-top:<음수> 로 당긴다.
 *   ⛔열 간격·옛 통합 gap 은 그대로 0~ — 열이 겹치는 요청은 없었다. */
export const GRID_ROW_GAP_MIN = -50;
/* 원형 이미지 줄의 기본 지름(px) — height 가 없을 때. 우클릭 「원형 이미지 추가」도 이 값으로 넣는다. */
export const GRID_IMG_CIRCLE_D = 120;
/* ★G20 — 원 «안 글자»가 차지하는 폭(지름 대비 %) = ★내접 정사각형(1/√2). 둥근 가장자리에 글자가 덜 잘린다.
 *   ★서클 에셋블럭의 자식 그릇(css/editor-blocks.css `.icb-children { width: 70.71% }`)과 ★같은 기하다.
 *   ⛔두 자리에 같은 수가 산다 — CSS 를 JS 로 들여올 길이 없다. 그래서 ★경고 주석 대신 ★«재는 자»를 뒀다:
 *     tests/unit/grid-circle-text-inset.test.mjs 가 그 CSS 를 파싱해 이 상수와 맞춘다(어긋나면 빨강).
 *   ★리터럴을 안 적고 √2 에서 «뜬다» — 70.71 이라는 수가 어디서 왔는지가 코드에 남는다. */
export const GRID_CIRCLE_TEXT_INSET_PCT = Math.round(10000 / Math.SQRT2) / 100;   // = 70.71

/* ══ 구분선 줄의 «굵기·색» 한계 — T-? (2026-09-30, 현빈 grd_owr55_gql6n0n) ════════
 * ★값은 원래 아래 `line.type === 'divider'` 가지 안에 손으로 박혀 있었다(1·40·#e0e0e0).
 *   패널에도 같은 손잡이를 내면서 그 수를 «두 번째로» 적게 되는 자리라 이름을 준다 —
 *   이 레포가 IMG_MIN_PCT·GAP_MIN/MAX 를 그렇게 다루는 것과 같은 규약(prop-grid.js 머리말).
 * ⛔새 «필드»가 아니다. height·color 는 이미 GRID_LINE_FIELDS 에 있다(이 파일 :278). */
export const GRID_DIVIDER_H_MIN = 1;
export const GRID_DIVIDER_H_MAX = 40;
export const GRID_DIVIDER_DEFAULT_COLOR = '#e0e0e0';

/* ══ 칸 «테두리» — T-172 (2026-09-24) ═══════════════════════════════════════
 * ★★어느 «축»에 두는가 — «블록 하나»다(gap·valign 과 같은 자리).
 *   카드가 물은 것은 「표로 보이게」다. 표에 필요한 것은 «격자 선 한 벌»이지
 *   «칸마다 다른 테두리»가 아니다 — 뒤쪽은 4×4 에서 사람이 눌러야 할 자리가 16배로 는다
 *   (작업목록매니저 권고 원문: 「칸마다 네 변을 따로까지 가지 마라」).
 *   ⇒ 칸 축(GRID_CELL_FIELDS)을 «한 글자도» 안 건드린다. 그래서 그 명부에 매인 세 검사
 *     (grid-row0-lines-invariant I5 · grid-patchcell-reject P7 · grid-cell-panel-handles E4)와
 *     원리적으로 부딪히지 않는다 — T-172 가 「삼각 모순」으로 멈춰 있던 자리가 이것이다.
 * ★★왜 «축약값 한 칸»이 아니라 세 키인가.
 *   `border:'1px dashed #ccc'` 로 받으면 카드가 못박은 두 값을 그대로 떠안는다:
 *     ⑴ 구분 부호 탈출(색 이름에 공백이 들어가는 rgb(…) 꼴) ⑵ 파선·점선을 조용히
 *        실선으로 떨구는 «새 거짓 성공».
 *   셋으로 나누면 둘 다 «원리적으로» 없다 — 꼴은 명부(GRID_BORDER_STYLES)가, 색은
 *   기존 _GRID_COLOR_RE 가 각각 «자기 축»에서 검증한다. 파싱이 아예 없다.
 * ⛔0 = 「테두리 없음」이다. 그래서 이 세 키가 없는 옛 저장본은 «한 픽셀도» 안 바뀐다.
 */
export const GRID_BORDER_W_MAX = 20;
export const GRID_BORDER_STYLES = ['solid', 'dashed', 'dotted'];
const GRID_BORDER_DEFAULT_COLOR = '#d0d0d0';

/* ══ 칸 «사이»의 괘선 — 현빈 2026-09-30 ═══════════════════════════════════════
 * 원문: 「2*1인 셀이 있으면 각 칼럼 중간에 줄」 ＋ 「칼럼 간격외에도 로우 간격에도
 *   가로줄」 ＋ 「모든칸 일괄적용할수도 있지만 특정 경계에만 지정해서 넣거나 뺄수 있게도」.
 *
 * ★★어느 «축»에 두는가 — 칸 테두리(GRID_BORDER_*)와 같은 «블럭 축»이다. 다만 켬/끔만은
 *   «경계마다»다. ⛔전체 스위치 하나에 예외를 매달지 않았다: 그 꼴은 스위치와 예외가
 *   어긋난 상태를 반드시 만든다(전체 선언 플래그로 개별 예외를 못 만든다 — 이 팀이 물린 자리).
 *   ⇒ 정본은 «경계 목록» 하나(`colRuleOn="1,0,1"`)고, 「일괄」은 그 목록을 한 번에 채우는
 *     패널 «단추»일 뿐이다. 모델에 「전체」라는 상태가 없으므로 어긋날 것이 없다.
 *
 * ★★왜 테두리(border)로 안 그리나 — 현빈이 말한 자리는 «간격의 가운데»다. border 는 칸
 *   상자에 붙어 간격 안으로 못 나간다. 그래서 칸 «안»에 절대배치 div 를 넣고 간격 쪽으로
 *   내민다. 그러면 경계의 좌표를 «계산하지 않는다» — grid 가 칸 자리를 이미 잡아 준다.
 *   ⛔CSS 파일에 두면 안 된다: 이 줄은 «보여야 하는 것»이라 내보내기(PNG·단독 HTML)에도
 *     실려야 한다. 어제 구분선의 «잡을 데»가 정반대(에디터 전용 CSS)였던 것과 짝이다.
 *   ★막는 것이 없음을 확인했다 — .grd-cell·.grd-inner 에 overflow:hidden 이 없다.
 *     생기면 내민 줄이 «잘려» 이 방법 자체가 죽는다(그 사실을 검사가 문다).
 *
 * ★굵기가 간격보다 커도 «그대로 넘친다»(현빈 확정 2026-09-30) — 자르지 않는다.
 * ★들여쓰기 0 = 칸 높이 전체. 그래서 「전체 높이」와 「위아래 들여서」가 손잡이 «하나»다.
 * ⚠️들여쓰기 > 0 이면 `span:'through'`(통짜)는 «뜻이 없다» — 끊김으로 본다(양쪽이 반대말이다).
 * ⛔GRID_LINE_FIELDS·GRID_CELL_FIELDS 를 한 글자도 건드리지 않았다 — 이건 칸·줄 값이 아니다.
 * ★끄면(경계 목록이 비면) div 가 «아예 안 생긴다» ⇒ 옛 저장본의 산출은 한 픽셀도 안 바뀐다. */
export const GRID_RULE_W_MAX = 40;
export const GRID_RULE_INSET_MAX = 200;
export const GRID_RULE_SPANS = ['cell', 'through'];
export const GRID_RULE_DEFAULT_COLOR = '#e0e0e0';
export const GRID_RULE_AXES = ['col', 'row'];

/** 한 축의 괘선 설정. `n` = 그 축의 «경계 수»(열 축이면 cols-1).
 *  ⛔`parseInt(x) || d` 금지 — 들여쓰기 0 이 «유효값»(전체 높이)이다. */
function _gridAxisRule(ds, ax, n) {
  const raw = String(ds[ax + 'RuleOn'] ?? '');
  const parts = raw === '' ? [] : raw.split(',');
  const on = [];
  for (let i = 0; i < n; i++) on.push(parts[i] !== undefined && String(parts[i]).trim() === '1');
  const wRaw = Number(ds[ax + 'RuleWidth']);
  const iRaw = Number(ds[ax + 'RuleInset']);
  const colRaw = String(ds[ax + 'RuleColor'] ?? '').trim();
  const spanRaw = String(ds[ax + 'RuleSpan'] ?? '');
  return {
    on,
    width: Number.isFinite(wRaw) && wRaw > 0 ? Math.min(GRID_RULE_W_MAX, Math.round(wRaw)) : 1,
    color: _GRID_COLOR_RE.test(colRaw) ? colRaw : GRID_RULE_DEFAULT_COLOR,
    inset: Number.isFinite(iRaw) && iRaw > 0 ? Math.min(GRID_RULE_INSET_MAX, Math.round(iRaw)) : 0,
    span: GRID_RULE_SPANS.includes(spanRaw) ? spanRaw : 'cell',
  };
}

/** 블럭의 괘선 설정 — {col, row}. 각 축에 {on[], width, color, inset, span}.
 *  ★패널(js/props/prop-grid.js)과 렌더러가 «같은 이 함수»를 본다 — 두 벌 금지. */
function _gridRules(block, colsN, rowsN) {
  const ds = (block && block.dataset) || {};
  return {
    col: _gridAxisRule(ds, 'col', Math.max(0, colsN - 1)),
    row: _gridAxisRule(ds, 'row', Math.max(0, rowsN - 1)),
  };
}
export function gridRules(block) {
  const { cols, rows } = getGridModel(block);
  return _gridRules(block, cols.length, rows.length);
}

/** 한 칸이 내놓을 괘선 div 들. 오른쪽 경계(세로) · 아래 경계(가로) 각각 최대 한 개.
 *  ★내미는 거리 = 간격/2 ＋ 굵기/2 ⇒ 줄의 «가운데»가 간격의 «가운데»에 온다.
 *  ★통짜(span:'through')는 위아래(가로줄이면 좌우)를 «반대 축 간격»의 절반만큼 늘려 그 틈을
 *    덮는다. 블럭 «바깥»으로는 안 늘린다(첫·마지막 줄 쪽은 그대로) — 안 그러면 블럭 밖으로 삐친다. */
function _gridCellRuleHtml(rules, r, c, colsN, rowsN, rowGapPx, colGapPx) {
  let out = '';
  const v = rules.col;
  if (c < colsN - 1 && v.on[c]) {
    const off = colGapPx / 2 + v.width / 2;
    const thru = v.inset === 0 && v.span === 'through';
    const top = thru && r > 0 ? -(rowGapPx / 2) : v.inset;
    const bot = thru && r < rowsN - 1 ? -(rowGapPx / 2) : v.inset;
    out += `<div class="grd-crule" aria-hidden="true" style="position:absolute;right:${-off}px;top:${top}px;bottom:${bot}px;width:${v.width}px;background:${_esc(v.color)};pointer-events:none;"></div>`;
  }
  const h = rules.row;
  if (r < rowsN - 1 && h.on[r]) {
    const off = rowGapPx / 2 + h.width / 2;
    const thru = h.inset === 0 && h.span === 'through';
    const left = thru && c > 0 ? -(colGapPx / 2) : h.inset;
    const right = thru && c < colsN - 1 ? -(colGapPx / 2) : h.inset;
    out += `<div class="grd-rrule" aria-hidden="true" style="position:absolute;bottom:${-off}px;left:${left}px;right:${right}px;height:${h.width}px;background:${_esc(h.color)};pointer-events:none;"></div>`;
  }
  return out;
}

/** 블록의 칸 테두리 — {width, color, style}. 값이 없거나 못 읽으면 width:0(=없음).
 *  ⛔`parseInt(x) || 0` 금지 — 여기선 0 이 유효값이라 gap 과 같은 함정을 진다. */
function _gridCellBorder(block) {
  const ds = (block && block.dataset) || {};
  const wRaw = ds.cellBorderWidth;
  const w = (wRaw != null && wRaw !== '' && Number.isFinite(+wRaw))
    ? Math.max(0, Math.min(GRID_BORDER_W_MAX, Math.round(+wRaw)))
    : 0;
  const cRaw = typeof ds.cellBorderColor === 'string' ? ds.cellBorderColor.trim() : '';
  const color = _GRID_COLOR_RE.test(cRaw) ? cRaw : GRID_BORDER_DEFAULT_COLOR;
  const style = GRID_BORDER_STYLES.includes(ds.cellBorderStyle) ? ds.cellBorderStyle : 'solid';
  return { width: w, color, style };
}

/** 한 칸의 테두리 CSS. width 0 이면 «빈 문자열»(= 옛 저장본과 바이트가 같다).
 *  ★★겹침은 «그리는 쪽»에서 푼다 — 걷어낸 간격 손잡이를 되살리지 않는다(T-022 함정,
 *    T-172 카드의 ⚠️함정 칸이 같은 말을 적어 뒀다).
 *    간격이 0 이면 이웃한 두 칸의 선이 맞붙어 «두 배 굵기»로 보인다. 그래서 안쪽 선을
 *    «한 벌»만 긋는다: 위/왼쪽은 첫 행/첫 열에서만, 오른쪽/아래는 언제나.
 *    ⇒ 간격 0 = 표(선이 한 겹) · 간격 >0 = 카드(칸마다 상자). 손잡이는 늘지 않는다.
 *  ⛔`cell.`/`pick('…')` 를 쓰지 않는다 — 이 값은 «칸»이 아니라 «블록»의 것이고,
 *    grid-patchcell-reject.test.js P7 이 renderGridBlock 본문의 그 두 꼴을 파싱해
 *    GRID_CELL_FIELDS 와 대조한다. 여기서 그 꼴을 쓰면 남의 명부를 오염시킨다. */
function _gridCellBorderCss(bd, r, c, rowGapPx, colGapPx) {
  if (!bd || !(bd.width > 0)) return '';
  const line = `${bd.width}px ${bd.style} ${bd.color}`;
  const top  = (rowGapPx > 0 || r === 0) ? line : '0';
  const left = (colGapPx > 0 || c === 0) ? line : '0';
  return `border-top:${top};border-left:${left};border-right:${line};border-bottom:${line};`;
}

/* ══ ★블럭 외곽선 (G17 · 2026-10-03, 지디 2차 발주) ═══════════════════════════════
 * 뜻: 그리드 «블럭 상자»의 네 변을 «변마다» 켜고 끈다(엑셀·워드 테두리 고르기 꼴) + 「사방」·「없음」.
 * ⛔칸 테두리(cellBorder*)·칸 사이 줄(rowRule/colRule)과 «다른 축»이다 — 그 둘은 칸에 붙고 이건 블럭 상자에 붙는다.
 * ★정본 = dataset «한 키» `blockOutline`(data-block-outline) — 켠 변 이름을 콤마로, 순서는 언제나 top,right,bottom,left.
 *   키가 «없으면» = 외곽선 없음 ⇒ 옛 저장본은 style·innerHTML «한 바이트도» 안 바뀐다(아래 렌더 가드).
 *   ⛔전체 스위치를 따로 두지 않는다 — 「사방」·「없음」은 이 목록을 한 번에 채우는 «단추»일 뿐이다(괘선 선례와 같은 까닭).
 * ★굵기·색·꼴은 «새로 만들지 않는다» — 같은 블럭의 칸 테두리 설정(_gridCellBorder)을 그대로 쓴다.
 *   굵기만 예외: 칸 테두리가 0(=꺼짐)이면 1px 로 긋는다(0 이면 켠 변이 «안 보이는» 거짓 켬이 된다).
 *   ⚠️그래서 «칸 테두리 없이 굵은 외곽선»은 지금 못 만든다 — 손잡이를 늘리지 않은 대가(보고서 미완 명부).
 * ★그리는 자리 = 블럭 «자기» style 의 border-top/right/bottom/left. ⛔outline 을 쓰지 마라 —
 *   .grid-block 의 outline 은 선택 표시다(css/editor-blocks.css .grid-block / .grid-block.selected).
 *   블럭은 이미 box-sizing:border-box 라 폭은 그대로고 안쪽이 굵기만큼 준다(인라인이라 PNG·HTML 내보내기에 그대로 실린다). */
export const GRID_OUTLINE_SIDES = ['top', 'right', 'bottom', 'left'];

/** 들어온 값을 «정본 꼴»로 — 'top,left' · ['top','left'] · 'all' · 'none' · '' 를 받는다.
 *  돌려주는 것: 정본 문자열('' = 하나도 안 켬) · 모르는 변 이름이 섞이면 null(거절). */
function _gridNormOutline(v) {
  if (v === null || v === undefined) return '';
  let parts;
  if (Array.isArray(v)) parts = v.map(x => String(x).trim());
  else {
    const raw = String(v).trim();
    if (raw === '' || raw === 'none') return '';
    if (raw === 'all') return GRID_OUTLINE_SIDES.join(',');
    parts = raw.split(',').map(x => x.trim()).filter(Boolean);
  }
  if (parts.some(x => !GRID_OUTLINE_SIDES.includes(x))) return null;
  return GRID_OUTLINE_SIDES.filter(sd => parts.includes(sd)).join(',');
}

/** 블럭 외곽선 — {on:{top,right,bottom,left}, width, color, style}. ★패널과 렌더러가 «같은 이 함수»를 본다.
 *  ⛔저장값이 꼴이 틀리면(손으로 고친 파일) «하나도 안 켠 것»으로 읽는다 — 모르는 변을 짐작해 켜지 않는다. */
function _gridBlockOutline(block) {
  const ds = (block && block.dataset) || {};
  const norm = _gridNormOutline(ds.blockOutline);
  const list = norm ? norm.split(',') : [];
  const on = {};
  for (const sd of GRID_OUTLINE_SIDES) on[sd] = list.includes(sd);
  const bd = _gridCellBorder(block);
  return { on, width: bd.width > 0 ? bd.width : 1, color: bd.color, style: bd.style };
}

/** 블럭 style 에 외곽선을 건다. ★켠 변이 없고 블럭에 border-* 흔적도 없으면 «아무것도 안 만진다»
 *  — 옛 저장본(W0: style 바이트 동일)의 길을 그대로 둔다. 끈 뒤에는 남은 border-* 를 걷는다. */
function _gridApplyBlockOutline(block) {
  const o = _gridBlockOutline(block);
  const st = block.style;
  const any = GRID_OUTLINE_SIDES.some(sd => o.on[sd]);
  /* ⛔getPropertyValue/setProperty 를 쓰지 않는다 — unit 하네스 여럿이 style 을 «평범한 객체»로 대역한다
     (실측: t174-cell-bg-value 등이 그 함수 없음으로 터졌다). 낙타 이름 읽기/쓰기는 둘 다에서 돈다. '' 대입 = 선언 제거. */
  const cap = (sd) => 'border' + sd[0].toUpperCase() + sd.slice(1);
  const trace = GRID_OUTLINE_SIDES.some(sd => st[cap(sd) + 'Style']);
  if (!any && !trace) return;
  /* ★G12 안 A(지디 GO 2026-10-04) — 블럭 배경을 켜면 선은 «배경 바깥 가장자리»가 긋는다(.grd-edge · _gridBlockBgHtml).
     블럭 자기 테두리는 «색만» 투명으로 — 두께는 남겨 칸 자리가 1px 도 안 움직이게(배경 층이 그 자리를 덮어 어차피 안 보인다: 설계 실측 M3). */
  const color = _gridBlockBg(block).on ? 'transparent' : o.color;
  const line = `${o.width}px ${o.style} ${color}`;
  for (const sd of GRID_OUTLINE_SIDES) st[cap(sd)] = o.on[sd] ? line : '';
}

/* ══ ★블럭 배경 (G12 · 2026-10-04, 현빈 안 ㄴ 「배경 여백만큼 바깥까지」) ═══════════════════════════
 * 뜻: 그리드 «블럭 전체» 뒤에 배경(색·이미지·위치·투명도)을 깔고, 그 배경을 블럭 상자 «바깥»으로
 *   상하·좌우 「배경 여백」만큼 넓힌다. ⛔이웃을 밀지 않고(마진 아님) 칸을 줄이지 않는다(패딩 아님) —
 *   레이아웃·폭 모델(data-grid-width)·드롭 판정 사각형은 한 픽셀도 안 바뀐다(설계 실측 M2).
 * ★그리는 자리 = 셸의 «맨 앞» 절대배치 층 `.grd-bg`(z-index:-1 · pointer-events:none) ＋ 블럭에 isolation:isolate.
 *   ⛔z-index:-1 «만»으로는 안 된다 — 색 있는 «프레임 안»의 그리드면 −1 층이 섹션 맥락으로 빠져 프레임 배경
 *     «밑»에 깔린다(설계 실측 M1 S1: 띠 자리 픽셀 = 프레임색 #ffeeaa ⇒ 켰는데 안 보이는 «거짓 켬»).
 *   ⚠️★알고 넣는 대가(지디 GO 2026-10-04): isolation 을 건 그리드는 위치지정 이웃과 «트리 순서»로 겹친다 —
 *     배경 여백이 이웃 간격보다 크면 «배경을 켜면 바로 위 프레임을 가릴 수 있다»(실측 M1 S3: 위 빨강 프레임 → 배경색).
 *     텍스트블럭은 z-index:2 라 늘 위다(실측). 릴리스 노트 후보.
 *   ⚠️★같은 줄기의 대가 둘째(지디 GO B6n): «배경 여백이 아래 블럭과 겹치면 그 블럭이 바깥 선(G17 안 A)을 덮는다» —
 *     아래 텍스트블럭(z 2)이 띠·선 위로 칠해진다(grid-block-bg B6n 이 픽셀로 잰다). 릴리스 노트 후보.
 *   ★z-index 가 아니라 isolation 인 까닭: 떠 있는 그리드는 `.section-block > [data-overlay-block]{z-index:80 !important}` 가 z 를 쥔다.
 * ★섹션 밖은 잘린다 — `.section-inner{overflow-x:clip}`. 「좌우 패딩 제외」(fullBleed)로 펴면 띠가 섹션 가장자리에서 끊긴다 = 맞는 동작.
 * ★정본 = dataset 키 일곱(`blockBg*`). ⛔프레임의 bg/bgImg 이름을 «안» 쓴다 — 내보내기 GENERIC 폴백
 *   (export-figma-json.js `bg: ds.bg`)이 그 이름을 «상자 크기 그대로» 칠한다(띠·끔·투명도를 모른다).
 *   `blockBgOn` 이 «없으면» = 꺼짐 ⇒ 옛 저장본은 style·innerHTML «한 바이트도» 안 바뀐다(렌더 가드).
 *   끄면 `blockBgOn` 만 지운다 — 색·여백은 남아 다시 켜면 돌아온다. 전부 지우는 문은 `blockBg:null` 하나.
 * ⛔`background` 축약·`inset` 축약을 쓰지 마라 — HTML 내보내기는 `[style*="background-image"]` 만 asset 을 풀고
 *   (export-html.js inlineGoyaAssets), PNG html2canvas 길은 inset 을 못 읽는다(export-image.js). */
export const GRID_BLOCK_BG_KEYS = ['blockBgOn', 'blockBgColor', 'blockBgImg', 'blockBgPos', 'blockBgOpacity', 'blockBgPadY', 'blockBgPadX'];
export const GRID_BLOCK_BG_DEFAULTS = { color: '#f5f5f5', pos: 'center center', opacity: 100, padY: 16, padX: 16 };
export const GRID_BLOCK_BG_PAD_Y_MAX = 200;   // 프레임 「상하 패딩」과 같은 범위(prop-frame.js ss-pady 0~200)
export const GRID_BLOCK_BG_PAD_X_MAX = 100;   // 프레임 「좌우 패딩」과 같은 범위(prop-frame.js ss-padx 0~100)
export const GRID_BLOCK_BG_POS_X = ['left', 'center', 'right'];
export const GRID_BLOCK_BG_POS_Y = ['top', 'center', 'bottom'];
/* 이미지 — data:image 또는 goya-asset:// 만. ★따옴표·괄호·공백·꺾쇠가 «없어야» url('…') 안에 안전하게 선다. */
const _GRID_BG_IMG_RE = /^(data:image\/[a-zA-Z0-9.+-]+[;,]|goya-asset:\/\/)[^"'()<>\s\\]*$/;
/* 색 — 칸 배경과 «같은» _GRID_COLOR_RE ＋ style 속성 안에 서므로 따옴표·꺾쇠는 거절. */
const _gridBgColorOk = (v) => typeof v === 'string' && _GRID_COLOR_RE.test(v.trim()) && !/["'<>]/.test(v);

/** 'x y' 정본 꼴로 — 'left top' · 'center' · 'right bottom' … · 모르는 낱말이면 null. */
function _gridNormBgPos(v) {
  if (typeof v !== 'string') return null;
  const p = v.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (p.length === 1 && p[0] === 'center') return 'center center';
  if (p.length !== 2) return null;
  let [x, y] = p;
  if (GRID_BLOCK_BG_POS_Y.includes(x) && GRID_BLOCK_BG_POS_X.includes(y) && !(GRID_BLOCK_BG_POS_X.includes(x) && GRID_BLOCK_BG_POS_Y.includes(y))) [x, y] = [y, x];
  return (GRID_BLOCK_BG_POS_X.includes(x) && GRID_BLOCK_BG_POS_Y.includes(y)) ? `${x} ${y}` : null;
}
/** 정수 0~max 이면 그 값, 아니면 null(거절). */
function _gridBgInt(v, max) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= 0 && r <= max ? r : null;
}

/** 블럭 배경 — {on, color, img, pos, opacity, padY, padX}. ★패널·렌더러·내보내기가 «같은 이 함수»를 본다.
 *  ⛔저장값이 꼴이 틀리면(손으로 고친 파일) 그 칸만 «기본값»으로 읽는다 — 짐작해 고치지 않는다. */
function _gridBlockBg(block) {
  const ds = (block && block.dataset) || {};
  const D = GRID_BLOCK_BG_DEFAULTS;
  const pick = (raw, max, d) => { const v = _gridBgInt(raw, max); return v === null ? d : v; };
  return {
    on: ds.blockBgOn === '1',
    color: _gridBgColorOk(ds.blockBgColor) ? ds.blockBgColor.trim() : D.color,
    img: typeof ds.blockBgImg === 'string' && _GRID_BG_IMG_RE.test(ds.blockBgImg) ? ds.blockBgImg : '',
    pos: _gridNormBgPos(ds.blockBgPos) || D.pos,
    opacity: pick(ds.blockBgOpacity, 100, D.opacity),
    padY: pick(ds.blockBgPadY, GRID_BLOCK_BG_PAD_Y_MAX, D.padY),
    padX: pick(ds.blockBgPadX, GRID_BLOCK_BG_PAD_X_MAX, D.padX),
  };
}

/** 블럭 외곽선의 «변마다 굵기»(px) — 켠 변만 o.width, 아니면 0. ★계산된 스타일을 «안» 읽는다(단위 하네스 대역 style 에서도 돈다).
 *  절대배치 기준은 «패딩 상자»라 띠를 바깥 상자에서 재려면 이 굵기를 더해야 한다(설계 실측: 안 더하면 40 → 38px). */
function _gridOutlineWidths(block) {
  const o = _gridBlockOutline(block);
  const w = {};
  for (const sd of GRID_OUTLINE_SIDES) w[sd] = o.on[sd] ? o.width : 0;
  return { o, w };
}

/** `.grd-bg` 한 덩이의 HTML — 꺼져 있으면 ''(⇒ 셸 문자열이 옛 줄과 바이트 동일). */
function _gridBlockBgHtml(block) {
  const bg = _gridBlockBg(block);
  if (!bg.on) return '';
  const { w } = _gridOutlineWidths(block);
  const t = bg.padY + w.top, b = bg.padY + w.bottom, l = bg.padX + w.left, r = bg.padX + w.right;
  let st = `position:absolute;top:${-t}px;right:${-r}px;bottom:${-b}px;left:${-l}px;z-index:-1;pointer-events:none;background-color:${bg.color};`;
  if (bg.img) st += `background-image:url('${bg.img}');background-size:cover;background-repeat:no-repeat;background-position:${bg.pos};`;
  if (bg.opacity < 100) st += `opacity:${bg.opacity / 100};`;
  /* ★G17 겹침 — 안 A: 외곽선은 «배경 바깥 가장자리»에(띠가 곧 블럭의 보이는 크기). 같은 사각형 · 배경 «뒤» 형제라 그 위에 칠해진다.
     ⛔배경 층 안에 넣지 않는다 — 불투명도가 선까지 옅게 만든다. 켠 변이 없으면 이 덩이도 없다. */
  const { o } = _gridOutlineWidths(block);
  let edge = '';
  if (GRID_OUTLINE_SIDES.some(sd => o.on[sd])) {
    const line = `${o.width}px ${o.style} ${o.color}`;
    const sides = GRID_OUTLINE_SIDES.map(sd => `border-${sd}:${o.on[sd] ? line : '0'};`).join('');
    edge = `<div class="grd-edge" aria-hidden="true" style="position:absolute;top:${-t}px;right:${-r}px;bottom:${-b}px;left:${-l}px;z-index:-1;pointer-events:none;box-sizing:border-box;${sides}"></div>`;
  }
  return `<div class="grd-bg" aria-hidden="true" style="${st}"></div>${edge}`;
}

/** 직계 배경 층(.grd-bg·.grd-edge)을 html 로 맞춘다 — 같으면 안 만진다. */
function _gridSyncBgLayer(block, html) {
  const old = block.children ? [...block.children].filter(ch => ch.classList && (ch.classList.contains('grd-bg') || ch.classList.contains('grd-edge'))) : [];   // 단위 하네스 대역 block 엔 children 이 없을 수 있다
  if (!html && !old.length) return;
  if (old.map(n => n.outerHTML).join('') === html) return;
  old.forEach(n => n.remove());
  if (html) block.insertAdjacentHTML('afterbegin', html);
}

/** 블럭 style 의 쌓임 — 켰을 때만 isolation. ★켠 적이 없고 흔적도 없으면 «아무것도 안 만진다»(옛 저장본 style 바이트 동일). */
function _gridApplyBlockBgStacking(block) {
  const on = _gridBlockBg(block).on;
  const st = block.style;
  if (on) st.isolation = 'isolate';
  else if (st.isolation) st.isolation = '';
}

/** ★슬라이더가 끄는 동안 — 재렌더 없이 `.grd-bg` «한 노드»만 같은 HTML 로 갈아끼운다(두 벌 금지: 렌더와 같은 _gridBlockBgHtml).
 *  층이 없거나 켬/끔이 바뀌면 통째 렌더로 넘긴다. @returns {boolean} 그 노드만으로 끝났나 */
export function applyGridBlockBg(block) {
  if (!block || !block.classList || !block.classList.contains('grid-block')) return false;
  const cur = block.querySelector(':scope > .grd-bg');
  const html = _gridBlockBgHtml(block);
  if (!cur || !html) { renderGridBlock(block); return false; }
  const old = [cur, ...block.querySelectorAll(':scope > .grd-edge')];   // 옛 배경·옛 선을 «먼저» 쥐고
  cur.insertAdjacentHTML('beforebegin', html);                           // 새 것을 그 앞에 넣은 뒤
  old.forEach(n => n.remove());                                          // 옛 것만 걷는다
  /* ★G12·C5 — 색·투명도를 끄는 동안 글자 톤이 뒤집히면(밝은 배경 ↔ 어두운 배경) 그때만 통째로 다시 그린다.
     ⛔관찰자가 이걸 못 잡는다 — 그리드 «안»의 노드 교체는 «자기 렌더»로 보고 건너뛴다(canvas-contrast installTextToneObserver). */
  const _tt = globalThis.__gdTextTone;
  if (_tt && ((_tt.textToneAt(block) === 'light' ? 'light' : '') !== (block.dataset.textTone || ''))) renderGridBlock(block);
  return true;
}
/* ★K2(2026-10-05 · 현빈 「같이 아웃라인이나 그런것도 늘어나야되지 않겠니?」 · 지디/태양 승인 lane-f-grid) — 그리드의 «보이는 상자» 한 자리.
 *  배경(G12)을 켜면 배경 층 .grd-bg 의 상자(블럭 밖으로 배경 여백 + 선폭 — _gridBlockBgHtml 이 그 inset 을 정한다) · 끄면 블럭 자신.
 *  그리드가 아니면 받은 요소 그대로 — 부르는 쪽(선택 선 selection-overlay _geomOf)이 블럭 종류를 따로 묻지 않게.
 *  ⛔다른 자리에서 같은 판정(.grd-bg 가 있나 / blockBgOn)을 다시 짓지 마라. G12 배경·저장 데이터는 그대로다. */
export function gridVisualBox(el) {
  if (!el || !el.classList || !el.classList.contains('grid-block')) return el;
  const bg = el.querySelector(':scope > .grd-bg');
  return (bg && _gridBlockBg(el).on) ? bg : el;
}
if (typeof window !== 'undefined') { window.applyGridBlockBg = applyGridBlockBg; window.gridBlockBg = _gridBlockBg; window.gridVisualBox = gridVisualBox; }   // gridBlockBg: 내보내기(분리 문서·import 안 함)가 «같은 읽는 문»을 쓴다

/** 입구 하나(만드는 문·고치는 문) — `blockBg` 값을 dataset 쓰기 계획으로. 
 *  @returns {{error:string}|{set:Object, del:string[]}}
 *  · null → 일곱 키 전부 지움 · 하위 키 null → 그 키만 지움(= 기본값) · 모르는 하위 키 → 거절 */
const _GRID_BG_SUBKEYS = { on: 'blockBgOn', color: 'blockBgColor', image: 'blockBgImg', pos: 'blockBgPos', opacity: 'blockBgOpacity', padY: 'blockBgPadY', padX: 'blockBgPadX' };
function _gridIntakeBlockBg(v, trusted) {
  if (v === null) return { set: {}, del: GRID_BLOCK_BG_KEYS.slice() };
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { error: 'blockBg must be an object {on,color,image,pos,opacity,padY,padX} or null (= remove all)' };
  const unknown = Object.keys(v).filter(k => !(k in _GRID_BG_SUBKEYS));
  if (unknown.length) return { error: `blockBg: unknown field(s) ${unknown.join(', ')} — expected ${Object.keys(_GRID_BG_SUBKEYS).join('/')}` };
  const set = {}, del = [];
  for (const [k, raw] of Object.entries(v)) {
    const key = _GRID_BG_SUBKEYS[k];
    if (raw === null || raw === undefined) { del.push(key); continue; }
    if (k === 'on') {
      if (typeof raw !== 'boolean') return { error: 'blockBg.on must be true/false' };
      if (raw) set[key] = '1'; else del.push(key);
    } else if (k === 'color') {
      if (!_gridBgColorOk(raw)) return { error: `blockBg.color ${JSON.stringify(raw)} is not a color (#hex · rgb()/rgba() · var(--x))` };
      set[key] = raw.trim();
    } else if (k === 'image') {
      if (raw === '') { del.push(key); continue; }
      if (typeof raw !== 'string' || !_GRID_BG_IMG_RE.test(raw)) return { error: 'blockBg.image must be a data:image/… or goya-asset:// URL (no quotes/spaces), or "" / null to remove' };
      if (!trusted && raw.length > GRID_IMG_MAX_CHARS) return { error: `blockBg.image is ${raw.length} chars — over ${GRID_IMG_MAX_CHARS}` };
      set[key] = raw;
    } else if (k === 'pos') {
      const p = _gridNormBgPos(raw);
      if (!p) return { error: `blockBg.pos must be "<${GRID_BLOCK_BG_POS_X.join('|')}> <${GRID_BLOCK_BG_POS_Y.join('|')}>"` };
      set[key] = p;
    } else {
      const max = k === 'opacity' ? 100 : (k === 'padY' ? GRID_BLOCK_BG_PAD_Y_MAX : GRID_BLOCK_BG_PAD_X_MAX);
      const n = _gridBgInt(raw, max);
      if (n === null) return { error: `blockBg.${k} must be 0~${max}` };
      set[key] = String(n);
    }
  }
  return { set, del };
}

/** 경계 목록을 «경계 수»에 맞춘다 — 넘치면 자르고 모자라면 0 으로 채운다.
 *  경계가 없으면(1열·1행) 빈 문자열 = 켠 것이 하나도 없다.
 *  ⛔새 잣대를 만들지 않는다 — 읽는 자(_gridAxisRule)와 «같은 꼴»('1'/'0' 콤마)을 낸다. */
function _gridTrimRuleOn(raw, n) {
  if (!(n > 0)) return '';
  const parts = String(raw ?? '') === '' ? [] : String(raw).split(',');
  const out = [];
  for (let i = 0; i < n; i++) out.push(parts[i] !== undefined && String(parts[i]).trim() === '1' ? '1' : '0');
  return out.includes('1') ? out.join(',') : '';   // 전부 꺼졌으면 «빈 값»으로 — dataset 을 깨끗하게
}

/** 테두리 굵기 검증 — 0~GRID_BORDER_W_MAX. 통과면 정수, 아니면 null. */
function _gridValidateBorderWidth(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > GRID_BORDER_W_MAX) return null;
  return Math.round(n);
}

/* ★2026-09-16(T-D) — 우측패널 「행 간격/열 간격」 분리 슬라이더 재도입(09-05 제거된 「간격」 슬라이더와는
 *   다른 것 — 양축 동시 편의 슬라이더는 «재도입하지 않는다», 축별로만 조작한다).
 *   `dataset.gap` 은 레거시 기준값 겸 단축값으로 «그대로» 남는다(옛 프로젝트 호환).
 *   ⛔`parseInt(x) || 24` 금지 — gap=0 이 유효값인데 `||` 폴백이 0 을 삼킨다. Number.isFinite 로만 판정. */
function _gridGaps(block) {
  const ds = (block && block.dataset) || {};
  const legacy = Number.isFinite(+ds.gap) && ds.gap !== '' ? +ds.gap : GRID_DEFAULTS.gap;
  const row = (Number.isFinite(+ds.rowGap) && ds.rowGap !== '') ? +ds.rowGap : legacy;
  const col = (Number.isFinite(+ds.colGap) && ds.colGap !== '') ? +ds.colGap : legacy;
  return { row, col };
}

/* ══ ★그리드 블럭 «자체 너비» 모델 (G2-a, 2026-10-03 · TASK-20261003-goditor-32 G2) ══════════
 *  ★키 하나: `data-grid-width`(dataset.gridWidth) — 단위 «px 정수», 블럭 상자의 바깥 폭(box-sizing:border-box).
 *  ★키가 «없으면» = 옛 뜻 그대로 «담는 그릇 폭을 다 쓴다(100%)». 그 경로는 한 바이트도 안 바뀐다
 *    (지키는 시험: tests/dom/grid-block-width-model.dom.spec.js W0 — bf9161d0 과 style·innerHTML 바이트 동일).
 *  ★범위 밖·숫자 아님 = «없는 것»으로 읽는다(렌더는 100%). 고치는 문(updateGridBlock width)은 그런 값을 «거절»한다.
 *  ⛔폭을 담는 자리는 이 키 «하나»다. style.width 에 따로 px 를 박지 마라 — renderGridBlock 이 다시 그릴 때
 *    지워져(100% 로 되돌아가) «두 명부»가 어긋난다(F3 의 드롭 입구가 바로 그 꼴이었다: makeAbsolute 가 860px 를
 *    style 에만 적고, 다음 렌더가 100% 로 폈다).
 *  ⚠️이 커밋은 «모델»뿐이다 — 우측패널 입력·오버레이 모서리 핸들은 G2-b 몫. */
export const GRID_WIDTH_MIN = 40;
export const GRID_WIDTH_MAX = 3000;   // 캔버스 기준 860 의 3배여유. ⛔4000 은 ROW_H_MAX 리터럴 검사(grid-callsite-ssot)에 걸린다 — 뜻이 다른 수라 일부러 피했다
/** 너비 값 검증 — GRID_WIDTH_MIN~MAX 이면 정수 px, 아니면 null. */
function _gridValidateWidth(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return (r < GRID_WIDTH_MIN || r > GRID_WIDTH_MAX) ? null : r;
}
/* ══ ★제4안 «높이 = 칸 위아래 여백» cellPadY (2026-10-05 · 현빈 확정 · 지디 승인 lane-grid-height) ══
 *  그리드 «한 값»이 «모든 칸»의 위·아래 여백에 «더해진다»(칸/열 padding 위에 얹음) — 글자 크기·그림 비율은 안 건드린다.
 *  바닥 0 · 상한 GRID_CELL_PAD_Y_MAX(70 · 시안 MAXPAD). ★키가 없거나 0 = 렌더가 아무것도 안 쓴다 ⇒ 기존 문서 바이트 그대로.
 *  ⛔읽는 문은 getGridCellPadY 하나 · 쓰는 문은 updateGridBlock{cellPadY}(한 번에 끝나는 입력) / applyGridCellPadY(끄는 동안 매 틱). */
export const GRID_CELL_PAD_Y_MAX = 70;
function _gridValidateCellPadY(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return (r < 0 || r > GRID_CELL_PAD_Y_MAX) ? null : r;
}
/** 그리드 칸 위아래 «더한» 여백(px) — 키가 없거나 무효면 0. */
function getGridCellPadY(block) {
  return _gridValidateCellPadY(block && block.dataset ? block.dataset.cellPadY : undefined) || 0;
}
/** 끄는 동안(손잡이) 매 틱 쓰는 문 — 0~상한으로 죄어 쓰고 다시 그린다 · 0 이면 키를 지운다(기존 바이트로 돌아감). ⛔히스토리는 부르는 쪽(드래그 끝). */
function applyGridCellPadY(block, px) {
  if (!block || !block.classList || !block.classList.contains('grid-block')) return null;
  const n = Number(px);
  if (!Number.isFinite(n)) return null;
  const v = Math.min(GRID_CELL_PAD_Y_MAX, Math.max(0, Math.round(n)));
  if (v === 0) delete block.dataset.cellPadY; else block.dataset.cellPadY = String(v);
  renderGridBlock(block);
  return v;
}

/** 블럭의 자체 너비(px) — 키가 없거나 무효면 null(= 100%). ⛔읽는 문은 이것 하나. */
function getGridWidth(block) {
  return _gridValidateWidth(block && block.dataset ? block.dataset.gridWidth : undefined);
}

/* ══ ★G2-b 쓰는 문 — 패널(슬라이더)·오버레이 손잡이가 «끄는 동안» 매 틱 부르는 폭 쓰기 (2026-10-04) ══
 *  ★모델은 그대로다(지디 결정 2026-10-04 ㉠ 「떠 있는 것은 굳힌 폭이 정본」).
 *    · 안 떠 있음 = 키(data-grid-width)에 쓰고 renderGridBlock 이 그 키로 그린다(G2-a 그대로).
 *    · 떠 있음   = «굳힌 폭»(style.width + dataset.overlayFrozenWidth)에 쓴다 — 렌더는 떠 있는 동안 키를 «안» 본다(ownW=null).
 *      ★그리고 키에도 «같이» 쓴다 — 떠 있는 동안 키는 렌더에서 잠자고, 오버레이를 «풀 때» 깨어난다
 *        (overlay-float.js exitFloat 이 키가 있으면 다시 그린다). 이게 「해제해도 사용자가 정한 폭이 남는다」의 길이다.
 *        ⛔굳힌 폭만 바꾸면 해제 때 _unfreezeWidth 가 진입 전 값('100%')으로 되돌려 폭이 «조용히» 사라진다(실측 — G2B 보고서).
 *  ★overlayFrozenWidth 는 «있을 때만» 갱신한다 — 키가 있던 그리드는 띄울 때 이미 px 라 _freezeWidth 가 그 표식을 안 남긴다
 *    (그때 렌더는 style.width 를 안 건드리므로 style 만 쓰면 산다). ⛔없는 표식을 새로 심지 않는다(해제 때 치울 주인이 없다).
 *  ⛔히스토리·패널 재표시·자동저장은 «안» 한다 — 부르는 쪽(드래그 끝·슬라이더 change)이 한 번 한다.
 *    한 번에 끝나는 입력(패널 숫자칸·「100%」)은 이 문이 아니라 updateGridBlock{width} 를 쓴다(같은 규칙을 그 안에서 탄다).
 *  @returns 쓴 px(범위로 «죈» 정수) · 숫자가 아니면 null(아무것도 안 씀) */
function _gridSetFrozenWidth(block, v) {
  block.style.width = v + 'px';
  if (block.dataset.overlayFrozenWidth) block.dataset.overlayFrozenWidth = v + 'px';
}
function applyGridOwnWidth(block, px) {
  if (!block || !block.classList || !block.classList.contains('grid-block')) return null;
  const n = Number(px);
  if (!Number.isFinite(n)) return null;
  const v = Math.min(GRID_WIDTH_MAX, Math.max(GRID_WIDTH_MIN, Math.round(n)));
  block.dataset.gridWidth = String(v);
  delete block.dataset.gridWidthAuto;                      // 사람이 정한 폭 — 자동 출처 표시를 뗀다(updateGridBlock 과 같은 규칙)
  if (block.dataset.overlayBlock === 'true') _gridSetFrozenWidth(block, v);
  renderGridBlock(block);
  return v;
}

/* ══ ★F3 — 자유배치 프레임에 «들어올 때» 그리드 폭을 프레임보다 작게 준다 (2026-10-03, 현빈 「프레임 안 그리드가 수직만」) ══
 *  원인(Evaluator 36cbe872 실측): T-088 클램프가 x 를 [0, 프레임폭−블럭폭] 으로 죈다. 폭 = 프레임폭 이면 [0,0] → 좌우가 죽는다.
 *    ⛔클램프는 안 건드린다(「화면에서 사라진다」를 막는 살아 있는 울타리). 대신 «입구»에서 폭이 프레임폭과 같아지지 않게 한다.
 *  ★폭 규칙: 프레임 «보이는 폭»(clientWidth — 드롭 경로의 가로 중앙 계산 frameVisibleSize 와 같은 자) × GRID_FREE_FRAME_FILL(0.8).
 *    까닭 — 그리드 내용엔 «최소폭»이 없다(칸이 min-width:0 이라 글자가 접힌다) ⇒ 내용에서 하한을 못 뽑는다.
 *    그래서 «움직일 여지»를 프레임에 비례로 남긴다: 어떤 프레임 폭에서도 좌우 이동 범위 = 프레임의 20%
 *    (764 프레임 → 611px · 여지 153px, 끌기 +100 이 다 먹는다). 고정 여백(예: −80px)은 작은 프레임에서 음수가 된다.
 *  ★언제 쓰나 — 키가 «없거나», 이미 있는 키가 프레임 폭 «이상»일 때만. 프레임보다 작은 명시 폭은 사용자 값이라 둔다.
 *    want(명시 요청 px, 예: MCP opts.width)가 오면 그 값을 그대로 키에 쓴다(규칙은 «기본값»에만).
 *  ⛔폭은 모델 키(data-grid-width) «하나»로만 준다 — style.width 를 따로 박지 않는다(다음 렌더가 지운다).
 *  부르는 입구 셋: drag-utils settleRowInFreeFrame · block-drag 드롭 makeAbsolute · block-factory _insertToFlowFrame. */
export const GRID_FREE_FRAME_FILL = 0.8;
/* ★출처 표시(F3 후속, 2026-10-03 적대QA) — `data-grid-width-auto="1"` = 「지금 키 값은 입구가 «자동으로» 넣었다」.
 *  ⛔폭 값은 여전히 data-grid-width «하나»다. 이 표시는 값을 안 담는다(출처만).
 *  무엇이 났나: 자동 폭이 키에 «남아» 프레임을 떠나도 좁은 채였고, 더 작은 프레임을 거치면 더 줄고 다시 안 커졌다
 *    (섹션→764→섹션→400→섹션→764→섹션 = 611·611·320·320·320·320, 기준판은 섹션에서 매번 780).
 *  규약: 자동이면 ⑴ 다른 자유 프레임에 들어갈 때 그 프레임 기준으로 «다시» 맞추고 ⑵ 자유 프레임을 떠나면 키·표시를 지워 100%.
 *        사용자가 정한 폭(updateGridBlock width · want)은 표시가 없으니 안 건드린다. */
function fitGridWidthToFreeFrame(block, frame, want) {
  if (!block || !block.classList || !block.classList.contains('grid-block')) return false;
  if (!frame || !frame.dataset || frame.dataset.freeLayout !== 'true') return false;
  if (block.dataset.overlayBlock === 'true') return false;          // 떠 있는 것은 굳힌 폭이 정본
  const wantPx = _gridValidateWidth(want);
  if (wantPx !== null) {
    const had = block.dataset.gridWidthAuto !== undefined;
    delete block.dataset.gridWidthAuto;                              // 명시 요청 = 사용자 폭
    if (getGridWidth(block) === wantPx) return had;
    block.dataset.gridWidth = String(wantPx);
    renderGridBlock(block);
    return true;
  }
  const fw = frame.clientWidth || 0;
  if (!fw) return false;                                             // 아직 레이아웃 전 — 잴 수 없으면 안 건드린다
  const auto = block.dataset.gridWidthAuto === '1';
  const cur = getGridWidth(block);
  const w = Math.round(fw * GRID_FREE_FRAME_FILL);
  if (_gridValidateWidth(w) === null || w >= fw) return false;      // 아주 작은 프레임(<50px) — 줄일 수 없다
  if (!auto && cur !== null) return false;                           // ⛔사용자 폭(프레임 이상)도 덮지 않는다 — 출처가 사람이다
  if (auto && cur === w) return false;                               // 이미 이 프레임 기준 — 다시 그리지 않는다
  block.dataset.gridWidth = String(w);
  block.dataset.gridWidthAuto = '1';
  renderGridBlock(block);
  return true;
}

/** 그리드가 지금 «자유 프레임의 직계 단위»로 사는가 — 그 프레임(없으면 null).
 *  단위 = 블럭 자신 또는 감싼 .row. 그룹(data-group)도 자유 프레임이지만 «그룹 상자는 자식 폭에 맞춰진다»라
 *  거기 맞추면 서로 줄어든다 ⇒ 그룹 안은 'group' 으로 따로 돌려준다(손대지 않음). */
function _gridHomeFreeFrame(block) {
  let unit = block, p = block.parentElement;
  if (p && p.classList && p.classList.contains('row')) { unit = p; p = p.parentElement; }
  if (!p || !p.classList || !p.classList.contains('frame-block') || p.dataset.freeLayout !== 'true') return null;
  if (p.dataset.group === 'true') return 'group';
  return p;
}

/** 그리드만 담은 row 의 폭을 «따라가게» 한다(D1) — 폭 값은 키 하나, row 는 값을 안 갖는다.
 *  inFree=true(자유 프레임 직계 단위) → 'fit-content'(CSS `.row{width:100%}` 를 이겨 안의 px 그리드 폭이 된다)
 *  inFree=false(흐름) → ''(CSS 100%). 옛 판(c2d57466~1e04a50a)이 적어 둔 px 도 여기서 풀린다.
 *  ⛔다른 블럭이 같이 든 row 는 안 건드린다. */
function _gridRowFollows(g, inFree) {
  const row = g.parentElement;
  if (!row || !row.classList || !row.classList.contains('row')) return;
  const kids = [...row.children].filter(c => !c.classList.contains('drop-indicator'));
  if (kids.length !== 1 || kids[0] !== g) return;
  const cur = row.style.width || '';
  if (inFree) { if (/px$/.test(cur) || cur === '' || cur === '100%') row.style.width = 'fit-content'; }
  else if (/px$/.test(cur) || cur === 'fit-content') row.style.width = '';
}

/** ★자리를 옮긴 «뒤» 부른다 — root(옮긴 단위) 안의 자동 폭 그리드를 새 자리에 맞춘다.
 *  자유 프레임 안 = 그 프레임 기준으로 다시 맞춤 · 밖 = 키·표시를 지우고 100%. 사용자 폭·떠 있는 블럭은 무접촉.
 *  ⛔로드·undo·rebind 에서는 부르지 않는다(저장된 판을 그대로 그린다 — 열 때 다시 맞추는 건 미결정).
 *  ★결정됨: 열 때도 맞춘다(키 없는 전폭만) — E129 · 2026-10-05 · 지디 ⒜. 문 = 아래 fitKeylessFreeFrameGridsOnOpen(«페이지 padX 적용 뒤» — 그 전엔 프레임이 764 로 잡혀 611 이 된다).
 *  부르는 «떠나는/옮기는» 입구 전수는 커밋 메시지에 명부로 적었다. @returns 바꾼 개수 */
function syncAutoGridWidth(root) {
  if (!root || root.nodeType !== 1) return 0;
  const grids = [...root.querySelectorAll('.grid-block[data-grid-width-auto]')];
  if (root.classList.contains('grid-block') && root.dataset.gridWidthAuto !== undefined) grids.unshift(root);
  let n = 0;
  for (const g of grids) {
    if (g.dataset.overlayBlock === 'true') continue;
    const home = _gridHomeFreeFrame(g);
    if (home === 'group') continue;
    _gridRowFollows(g, !!home);
    if (home) { if (fitGridWidthToFreeFrame(g, home)) n++; continue; }
    delete g.dataset.gridWidth;
    delete g.dataset.gridWidthAuto;
    renderGridBlock(g);
    n++;
  }
  return n;
}

/* ══ ★E129 F3 — 열 때 «키 없는 전폭» 자유프레임 그리드를 입구와 같은 규칙으로 맞춘다 (2026-10-05 · 지디 ⒜) ══
 *  증상(실측): 저장본을 열면 키 없는 그리드는 renderGridBlock 이 '100%' 로 그려 폭 = 프레임 폭(716) →
 *    T-088 클램프 left 상한 = 716 − 716 = 0 → «수직만» 움직인다(입구 셋은 이미 맞추지만 «열기»는 안 거쳤다).
 *  ★대상 = 키 없음(getGridWidth === null — _gridValidateWidth 와 같은 부재 조건) ∧ 안 떠 있음 ∧ 집이 자유 프레임(_gridHomeFreeFrame · 그룹 제외).
 *    키가 있는 그리드(사람 폭·자동 폭)는 «무접촉» — fitGridWidthToFreeFrame 도 같은 규칙이지만 문 앞에서 한 번 더 거른다.
 *  ★언제 = «페이지 padX 가 적용된 뒤»(save-load.js applyPageSettings 바로 뒤). rebindAll 안에서 부르면 섹션 패딩이 아직 0 이라
 *    프레임이 style 폭(764)으로 잡혀 764×0.8 = 611 이 된다(실측) — 끌기 클램프가 쓰는 프레임 폭은 716 이고 그 0.8 = 573.
 *  ★이력 밖·자동저장 억제 구간 안(healAssetsBeyondSectionEdge 와 같은 자리 규약) — 열고 «편집해 저장할 때» 저장본에 반영된다.
 *  @returns 맞춘 개수 */
function fitKeylessFreeFrameGridsOnOpen(root) {
  if (!root || root.nodeType !== 1) return 0;
  let n = 0;
  for (const g of root.querySelectorAll('.grid-block')) {
    if (g.dataset.overlayBlock === 'true') continue;
    if (getGridWidth(g) !== null) continue;
    const home = _gridHomeFreeFrame(g);
    if (!home || home === 'group') continue;
    if (fitGridWidthToFreeFrame(g, home)) n++;
  }
  return n;
}

/** gap/rowGap/colGap 공용 검증 — min~GRID_GAP_MAX(min 기본 0, rowGap 만 GRID_ROW_GAP_MIN). 통과면 정수, 아니면 null. */
function _gridValidateGap(v, min = 0) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > GRID_GAP_MAX) return null;
  return Math.round(n);
}

// 컬럼 스케일 텍스트 롤 기본값 (풀폭 h1 104px는 다단에선 과대 — 컬럼용 축소 기준)
/* ★role.color — 「역할 기본색」(§7-ⓐ). 새 색을 «하나도» 만들지 않았다: 전부 editor-base.css 의
 *   --preset-*-color 와 «같은 값»이다(h1 #111 :10 · h2 #1a1a1a :12 · h3 #333 :14 · body #555 :16 ·
 *   caption #999 :18). 그래야 그리드 줄과 텍스트블록이 같은 말을 한다.
 * ⚠️label 만 --preset-label-color(#ffffff)를 «안» 베낀다 — 그건 「어두운 알약 위 흰 글자」 전제고,
 *   line.bg 없는 그리드 label 줄은 «흰 종이 위 흰 글자»가 된다. 뱃지 없는 eyebrow 는 본문 계열로.
 * ⚠️caption 2.85:1 은 WCAG AA 미달이지만 텍스트블록과 «같은 관례»다 — 여기만 올리면 두 블록의
 *   캡션이 갈린다. 올리려면 전 블록 동시 = 별건 발주(계획서 §8-8).
 * ★이 표는 «데이터»다. 렌더러가 이걸 실제로 쓰는 것은 §7-ⓐ 커밋(B) 한 줄이다 — 그 한 줄을
 *   되돌리면 기존 저장 프로젝트의 렌더가 오늘과 «바이트 동일»로 돌아온다. */
/* ★굵기 = 텍스트 블럭 체계와 같게(G7, 지디 결정 2026-10-03 — 현빈 「레귤러, 세미볼드로 해야 맞음」):
 *   css/editor-layout.css .tb-h1 700 · .tb-h2 600 · .tb-h3 600 · .tb-body 400(normal). 전엔 h1 800 · h2 700 · h3 700 이라
 *   같은 「제목」이 그리드에선 한 단 굵었다. label 600 · body 400 은 그대로. 줄의 weight 필드가 있으면 그게 이긴다.
 *   지키는 시험: tests/dom/grid-role-weight.dom.spec.js (computed 를 .tb-h* 와 대조). */
const _GRID_ROLES = {
  label:   { size: 16, weight: 600, lh: 1.4, ls: '0.04em',  color: '#555555' },
  h1:      { size: 64, weight: 700, lh: 1.1, ls: '-0.02em', color: '#111111' },
  h2:      { size: 40, weight: 600, lh: 1.2, ls: '-0.01em', color: '#1a1a1a' },
  h3:      { size: 28, weight: 600, lh: 1.3, ls: '0',       color: '#333333' },
  body:    { size: 22, weight: 400, lh: 1.6, ls: '0',       color: '#555555' },
  caption: { size: 14, weight: 400, lh: 1.5, ls: '0',       color: '#999999' },
};
/* ★G5(현빈 2026-10-03 「어두운 배경을 가진 섹션에 그리드 블럭 추가하면 안 보임, 텍스트 동적으로 되면 좋겠음」)
 *   — 칸의 실제 배경이 «어두우면»(canvas-contrast.js textToneOver = 'light') 역할색 대신 이 표를 쓴다.
 *   ★역할색은 고정값이지 사용자 지정이 아니다 ⇒ 자동 대상. line.color 가 있는 줄은 «안» 바뀐다.
 *   값의 근거(WCAG, 어두운 섹션 4종 중 가장 밝은 #555 기준): h1·h2·h3 #fff 7.46 · label·body #f2f2f2 6.66 · caption #ccc 4.64
 *   ★label·body 는 «새 값을 안 만든다»(지디 2026-10-03) — infocard-block.js 의 어두운 배경 글자색·G6 헤더와 같은 #f2f2f2.
 *   — 셋 다 작은 글자 4.5 를 넘는다. 흰/검 경계(L≈0.18) 근처에선 caption 이 4.5 아래로 갈 수 있다(흰 배경 caption #999 2.85 와 같은 관례). */
/* ★E127(2026-10-06 · 지디 ⓒ) — 역할색을 «프리셋 변수»로 그린다: var(--preset-<역할>-color, <hex>). 텍스트 블럭(css/editor-layout.css .tb-h*)과 «같은 변수»라
 *   프리셋을 바꾸면 그리드 줄도 같이 따라간다(전엔 hex 고정 — brand 에서 텍스트 h2 #2d4a7a vs 그리드 h2 #1a1a1a).
 *   대체값 = 위 표의 hex(변수 없는 곳 — 단독 HTML 이 변수를 안 실었을 때 등 — 은 오늘과 같은 색).
 *   다섯 역할만: label 은 --preset-label-color(#fff · 알약 위 흰 글자 전제)를 «일부러 안 따른다»(위 :720) · 어두운 칸(_GRID_ROLE_COLOR_ON_DARK)·색을 정한 줄은 이 길을 안 탄다.
 *   ★기존 문서 모양: 기본이 아닌 프리셋을 쓰는 설치에서 «색을 안 정한 그리드 줄»이 바뀐다(데이터 무변 · 렌더만) — 릴리스 노트 한 줄(지디). */
const _GRID_ROLE_PRESET_VAR = { h1: '--preset-h1-color', h2: '--preset-h2-color', h3: '--preset-h3-color', body: '--preset-body-color', caption: '--preset-caption-color' };
function _gridRoleColorCss(type, hex) {
  const v = _GRID_ROLE_PRESET_VAR[type];
  return v ? `var(${v}, ${hex})` : hex;
}
const _GRID_ROLE_COLOR_ON_DARK = {
  label: '#f2f2f2', h1: '#ffffff', h2: '#ffffff', h3: '#ffffff', body: '#f2f2f2', caption: '#cccccc',
};
const _GRID_VALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
/* ★칸/줄의 «가로 정렬» 명부 — 지금까지 이 파일엔 «표가 없었다».
   세로(_GRID_VALIGN)는 표를 거쳐 나가는데 가로는 `line.align || colAlign || 'left'` 가
   값을 «그대로» style 속성에 실었다. 그래서 같은 자리의 두 축이 반대로 틀렸다:
     세로 = 모르는 값이면 «조용히» 떨어진다(표에 없으니 undefined)        → T-180
     가로 = 모르는 값이 «그대로 화면 CSS 로 나간다»(표가 없으니 거를 게 없다) → T-170 ㈑
   ⛔값은 js/props/_helpers.js 의 ALIGN_ICONS['object-h'](패널이 실제로 주는 것)와 같아야 한다 —
     지키는 검사: tests/unit/grid-render-gaps.test.js X정렬값-* (그 파일이 두 출처를 대조한다). */
const _GRID_ALIGN = { left: 'left', center: 'center', right: 'right' };

/** 표에서 «자기 키»로만 꺼낸다.
 *  ⛔`map[v]` 로 바로 꺼내지 마라 — `'constructor'`·`'toString'` 같은 이름이 프로토타입에서
 *    «참인 값»을 돌려줘 그대로 style 속성에 실린다(표를 둬도 새는 구멍이 하나 남는다). */
const _gridEnum = (map, v) =>
  (typeof v === 'string' && Object.prototype.hasOwnProperty.call(map, v)) ? map[v] : undefined;

/** 줄의 «유효 가로정렬» — 줄 > 칸 > 'left'. ⛔명부 밖 값은 여기서 죽는다(속성으로 안 샌다).
 *  ★브라우저는 이미 `text-align:centre` 를 무시하고 상속(=왼쪽)으로 떨어뜨린다 —
 *    그러니 «보이는 것»은 그대로고, 바뀌는 것은 「선언이 나가느냐」뿐이다. */
const _gridAlign = (lineAlign, colAlign) =>
  _gridEnum(_GRID_ALIGN, lineAlign) || _gridEnum(_GRID_ALIGN, colAlign) || 'left';

/** 세로정렬·가로정렬의 «허용 값 명부» — 검증하는 쪽이 이 하나를 본다(손으로 베끼지 마라). */
const GRID_VALIGN_VALUES = Object.keys(_GRID_VALIGN);
const GRID_ALIGN_VALUES  = Object.keys(_GRID_ALIGN);
/* ★var(--color-…) 를 «받아야» 한다 — 컬러변수 칩(color-var-chips.js)이 넣는 값이
   `var(--color-brand, #ff0000)` 형태다. 거부하면 칩이 「눌리는데 안 먹는」 상태가 된다
   (modal-block.js:166 이 2026-09-08 «정확히 같은 것»에 물려 고친 자국 — 같은 대안절을 쓴다).
   ⛔여는/닫는 괄호와 허용 글자를 좁게 유지한다 — 세미콜론·중괄호가 새면 선언을 깨고 뒤를 밀어낸다.
   지키는 검사: tests/unit/grid-color-re.test.mjs (U5). */
const _GRID_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|transparent)$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$|^var\(\s*--[\w-]+\s*(?:,\s*[^;{}()]*)?\)$/;
/* 폰트 패밀리는 style 속성에 «그대로» 들어간다 — 세미콜론·중괄호가 새면 선언을 깨고
   그 뒤를 통째로 밀어낸다. modal-block.js 의 _MDL_FONT_RE 와 «같은 글자표»다.
   ⚠️_esc 는 & < > " 만 막는다 — «;» 와 «:» 는 «안» 막는다. 그래서 그 둘을 여기서 막아야 한다.
   ★그리고 이 필드는 MCP update_block{patchCell} 로 «검증 없이» 들어온다(스키마가 type:'object').
   ⇒ 이 정규식이 유일한 문지기다. 지키는 검사: tests/unit/grid-color-re.test.mjs (U10 음성대조).
   (따옴표는 통과시키되 _esc 가 &quot; 로 바꾼다 — 속성 밖으로 못 나간다.) */
const _GRID_FONT_RE = /^[\w\s,'"\-().가-힣]+$/;

/* ★중첩 그리드(line.type==='duo')의 한계 — 전엔 `_gridLineHtml` 안에 리터럴 2건이었다.
 *   입구가 「이건 잘린다」고 말하려면 렌더러와 «같은 값»을 봐야 한다(2026-09-24 T-175 ⑶).
 *   ⛔값은 안 바꿨다: 열 3(중첩은 4x4 피커 대상이 아니다) · 깊이 2단.
 *   지키는 검사: tests/unit/grid-render-gaps.test.js N3·N4(한계) · grid-intake-contract U9(보고). */
const GRID_NESTED_MAX_COLS = 3;
const GRID_NESTED_MAX_DEPTH = 2;
/* ★중첩 줄의 «스키마 enum» — 데이터 토큰이라 개명 대상 밖(PLAN §6-⑤)이고, 그래서 이 레포는
 *   이 이름이 «한 곳»에만 살기를 요구한다(tests/unit/grid-rename-residue.test.mjs S1).
 *   전엔 그 한 곳이 `if (line.type === 'duo') {` 이었다. 입구가 「이 중첩은 잘린다」를 말하려면
 *   같은 판정을 한 번 더 해야 해서, 리터럴을 둘로 늘리는 대신 «이름»으로 옮겼다.
 *   ⇒ 리터럴 수는 그대로 하나다. S1 의 허용 목록 ⑷ 도 이 줄을 가리키게 같이 옮겼다. */
const GRID_NESTED_LINE_TYPE = 'duo';
/* ═══ patchCell 이 «실제로 그려지는 필드»만 받게 하는 명부 ═══════════════════
   ★왜 있나 — 2026-09-09. `update_block{patchCell}` 은 `rest` 의 «아무 키나» 받아
     `applied.patchCell` 에 그대로 되돌려줬다. 렌더러가 안 읽는 이름을 줘도 `ok:true` 다.
     ⇒ 「우리가 뭘 했나」는 성공인데 「세상이 어떻게 됐나」는 그대로다 — «거짓 성공».
     그리고 r≥1 에선 `Object.assign` 이라 그 쓰레기가 «파일에 남는다»(r===0 은 조용히 버려진다).
     둘 다 부르는 쪽엔 안 보인다. 오타 하나가 「됐다는데 화면은 그대로」로 끝난다.

   ⛔이 두 목록을 «손으로» 늘리지 마라. 렌더러가 읽는 것에서 «도출»한 값이다 —
     `tests/unit/grid-patchcell-reject.test.js` 가 `_gridLineHtml` 과 `renderGridBlock` 을
     실제로 파싱해 이 목록과 대조한다. 렌더러가 새 필드를 읽기 시작하면 그 검사가 빨개진다.
     ★대조를 «생성»으로 바꾸지 않는 이유: 생성하면 증인이 둘에서 하나로 준다.
       상수가 틀리면 설명도 «자신 있게» 같이 틀리고 아무 검사도 안 빨개진다. */

/** `_gridLineHtml` 이 읽는 `line.*` — patchCell{lineIndex} 로 줄 수 있는 필드. */
const GRID_LINE_FIELDS = new Set([
  'align', 'barColor', 'bg', 'color', 'cols', 'content', 'fontFamily', 'fontSize',
  'gap', 'height', 'imgPosX', 'imgPosY', 'imgShape', 'imgSizePct', 'imgSrc', 'italic', 'items',
  'labelColor', 'labelSize', 'letterSpacing', 'lineHeight', 'marginTop', 'padH', 'padV',
  'radius', 'strike', 'text', 'trackColor', 'type', 'valign', 'valueColor', 'valueSize',
  'weight', 'widthPct',
]);

/** `renderGridBlock` 이 셀에서 읽는 것(`cell.lines` + `pick(...)`) — patchCell 로 줄 수 있는 필드.
 *  ⚠️`width` 는 «열» 속성이라 여기 없다 — 셀로 주면 조용히 버려진다. 거절 메시지가 patchCol 로 보낸다. */
/* ★G4(2026-10-04) — 칸 배경 이미지 셋(bgImg·bgFit·bgPos). 렌더러가 pick('…') 으로 읽으므로 P7 파싱과 이 명부가 같이 는다. */
const GRID_CELL_FIELDS = new Set(['lines', 'align', 'valign', 'bg', 'padding', 'radius', 'bgImg', 'bgFit', 'bgPos']);

/** `cols[c]` 가 받는 것 — 칸 필드 «전부» ＋ `width`(열 전용). ⛔손으로 베끼지 않는다.
 *  renderGridBlock 이 `pick(k)` 로 칸 값이 없을 때 `col[k]` 를 읽으므로, 열이 받는 꾸밈은
 *  칸이 받는 것과 «같은 명부»다. 다른 것은 `width` 하나뿐이고 그건 열에만 있다
 *  (거절 메시지가 「width 는 열 필드다」라고 돌려보내는 바로 그 자리). */
const GRID_COL_FIELDS = new Set(['width', ...GRID_CELL_FIELDS]);

/** 꾸밈 필드 중 «값이 명부로 묶인» 것 — 칸이든 열이든 같다. ⛔이름 말고 «표»로 묶는다. */
/* ★G4 칸 배경 이미지 맞춤 — 에셋 블럭 fit 명부(block-factory.js _enum('fit',['cover','contain']))와 «같은 두 값». */
export const GRID_BG_FIT_VALUES = ['cover', 'contain'];
const GRID_ENUM_FIELDS = { align: GRID_ALIGN_VALUES, valign: GRID_VALIGN_VALUES, bgFit: GRID_BG_FIT_VALUES };

/* ★★값이 «명부»가 아니라 «잣대»로 묶인 것 (2026-09-24 T-175 ⑵).
 *  ⛔새 잣대를 만들지 않았다 — 렌더러가 «이미 쓰고 있는 바로 그 정규식»을 입구가 같이 본다.
 *    그게 이 카드의 요구다: 「도구와 화면이 같은 답을 해야 한다」.
 *
 *  ★무엇이 있었나 (실측, 기준 7780267 · 행 0·행 1 둘 다):
 *      patchCell{bg:'linear-gradient(90deg,#f00,#00f)'}
 *        → ok:true · applied 에 그 값이 «그대로» 실려 돌아온다
 *        → 화면은 «배경 없음» (_GRID_COLOR_RE 가 안 받는다)
 *        → ⛔★그리고 그 칸에 «있던 멀쩡한 #00ff00 까지 사라진다» — 데이터 손실이다.
 *      대조: 같은 블록에서 line.color:'초록색' 은 ok:false 로 «거절»된다.
 *      ⇒ 같은 「모르는 값」인데 «칸 배경»은 받고 «줄 색»은 거절한다 — 방향이 반대였다.
 *        (줄 쪽이 막힌 것은 값 검사 때문이 아니라 _gridUnreadLineFields 의 «민감도» 덕이다 —
 *         우연히 막힌 쪽이라, 그걸 「설계된 가드」로 읽으면 안 된다.)
 *      ＋ 같은 자리에서 하나 더 나왔다: line.fontFamily:'Noto; color:red' 도 ok:true 였다.
 *  ⛔`''` 은 여기 안 온다 — 「강제로 없앰」이라는 뜻이 이미 있는 값이다(pick 계약 ⑵).
 *  ⛔표를 손으로 늘리지 마라. 늘릴 일이 생기면 «렌더러가 그 필드를 어떤 잣대로 거르나»를
 *    먼저 찾아라 — 잣대가 없는 필드(barColor 등 그래프 줄 색)는 렌더러가 «아무 값이나» 쓰므로
 *    여기 넣으면 도구만 엄해진다(그게 바로 이 카드가 고치려는 비대칭의 거울상이다). */
/* ★그리드 칸 이미지의 «프레임 안 크롭» — 셋 다 «％»다 (2026-09-25, 커밋 ②).
 *   imgSizePct : 그림의 «폭»을 프레임 폭의 몇 % 로 그릴까 (100 = 프레임 폭에 딱)
 *   imgPosX    : 그림의 왼쪽 끝을 프레임 «폭»의 몇 % 자리에 둘까 (음수 = 왼쪽으로 뺀다)
 *   imgPosY    : 그림의 위쪽 끝을 프레임 «높이»의 몇 % 자리에 둘까
 * ⛔px 가 아니라 % 인 까닭 — 칸 폭은 «열 가중치»로 정해져 늘었다 줄었다 하고, 내보내기는
 *   폭을 860→780 으로 바꾼다(js/io/export-image.js syncImageBoxesToCaptureWidth). px 로 두면
 *   그때마다 크롭이 어긋난다. 이 레포가 이미 같은 답을 두 번 골랐다:
 *     · 코너 핸들도 px 로 끌고 «％로» 커밋한다 (js/grid-cell-resize.js resizeGridImage)
 *     · 심플카드 확대도 imgScale(％)로 저장하고 내보내기가 그 ％를 재현한다
 *   ＋ % 는 렌더러가 «혼자» 검사할 수 있다. px 는 naturalWidth 를 알아야 해서 못 잰다. */
/* ★상한 값의 «수»를 고를 때 한 가지 덫이 있다 — tests/unit/grid-callsite-ssot.test.mjs 가
 *   이 파일에서 리터럴 `4000`·`2000` 을 금지한다(행 높이 상한 ROW_H_MAX 의 SSOT 자물쇠).
 *   그 둘은 «행 높이»의 수라 크롭과 아무 상관이 없지만, 자는 낱말이 아니라 «수»를 본다.
 *   ⇒ 겹치지 않는 수를 고른다. 1000% = 10배 확대, ±900% = 그림을 아홉 프레임 밖까지 밀 수 있다 —
 *     어느 쪽도 «실수로 넘길» 범위가 아니고, 넘기면 그림이 프레임에서 사라져 사용자가 바로 안다. */
const GRID_IMG_SIZE_MIN = 5, GRID_IMG_SIZE_MAX = 1000;
const GRID_IMG_POS_LIMIT = 900;
const _gridNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
/* ★소수 «세» 자리로 자른다 — 두 자리면 모자란다(실측). 프레임 폭 597px 에 133.33% 를 주면
 *   795.97px 가 되어 795.999 여야 할 자리에서 0.03px 이 어긋나고, 그 어긋남이 그림의 강한
 *   경계선(검은 세로줄·흰 띠)에서 «눈에 보이는» 재표본화 차이로 커진다
 *   (코너 드래그 뒤 겹치는 조각을 픽셀로 견주면 2665/83580 점 · 최대 세기 223 이 났다).
 * ⛔더 늘릴 이유는 없다 — 세 자리면 860px 폭에서 0.009px 이라 반올림 바닥 아래다. */
const _gridClampPct = (n, lo, hi) => Math.round(Math.max(lo, Math.min(hi, n)) * 1000) / 1000;

const GRID_VALUE_TESTS = {
  bg: (v) => _GRID_COLOR_RE.test(String(v).trim()),
  color: (v) => _GRID_COLOR_RE.test(String(v).trim()),
  fontFamily: (v) => _GRID_FONT_RE.test(String(v).trim()),
  /* ★G4 — 칸 배경 이미지·위치는 G12 블럭 배경과 «같은 잣대»(_GRID_BG_IMG_RE · _gridNormBgPos — 두 벌 금지). */
  bgImg: (v) => _GRID_BG_IMG_RE.test(String(v)),
  bgPos: (v) => _gridNormBgPos(String(v)) !== null,
};

/** 오타를 «되돌려» 준다 — 거절이 「틀렸다」로 끝나면 부르는 쪽은 다음에 뭘 할지 모른다. */
function _gridNearestField(key, allowed) {
  const k = String(key).toLowerCase();
  let best = null, bestD = Infinity;
  for (const a of allowed) {
    const al = a.toLowerCase();
    if (al === k) return a;                       // 대소문자만 다르다
    const d = _gridEditDistance(k, al);
    if (d < bestD) { bestD = d; best = a; }
  }
  return bestD <= Math.max(2, Math.floor(k.length / 3)) ? best : null;
}
function _gridEditDistance(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** patchCell 의 «내용 키»를 검사한다. 통과면 null, 아니면 «무엇을 하라»까지 적은 거절.
 *  @param {boolean} isLine  lineIndex 가 주어졌나(=줄 patch 인가)  */
function _gridRejectUnknownCellFields(rest, isLine) {
  const allowed = isLine ? GRID_LINE_FIELDS : GRID_CELL_FIELDS;
  const other   = isLine ? GRID_CELL_FIELDS : GRID_LINE_FIELDS;
  const bad = Object.keys(rest).filter(k => !allowed.has(k));
  if (!bad.length) return null;

  const where = isLine ? 'a line (lineIndex given)' : 'a cell (no lineIndex)';
  const parts = bad.map(k => {
    if (k === 'width') {
      return `'${k}' is a COLUMN field, not a cell field — use update_block{patchCol:{c,width}} instead`;
    }
    if (other.has(k)) {
      return isLine
        ? `'${k}' is a CELL field, not a line field — drop lineIndex to patch the cell, e.g. patchCell:{r,c,${k}:…}`
        : `'${k}' is a LINE field, not a cell field — add lineIndex to patch one line ` +
          `(patchCell:{r,c,lineIndex:0,${k}:…}), or pass it inside lines:[{${k}:…}]`;
    }
    const near = _gridNearestField(k, allowed);
    return near
      ? `'${k}' is not read by the renderer — did you mean '${near}'?`
      : `'${k}' is not read by the renderer`;
  });

  return {
    ok: false,
    code: 'INVALID',
    /* ★①「무엇을 하라」까지 말한다 — 그리고 «왜 조용했는지»도. 그래야 다음에 안 당한다. */
    message: `patchCell: unknown field(s) for ${where} — ${parts.join('; ')}. `
      + `This would have returned ok:true and changed nothing on screen. `
      + `Allowed here: ${[...allowed].sort().join(', ')}.`,
  };
}

/* ★셀 lines 배열 «상한» 가드 — patchCell{lines} 뿐 아니라 partial.cells(통째 R×C, MCP가 오는 길)도
   같은 셀 모양을 쓰므로 같이 통과시킨다(2026-09-15 a1-a3 지적 — patchCell만 막으면 통째 경로가
   그대로 뚫려 있었다). 상한 20: "+ 줄 추가" 무한증식(banner02/laurel과 같은 값).

   ★★★2026-09-26 «0개 거부를 «걷은» 것이 아니라 «옮겼다»» — 현빈 지시 두 통.
     ⑴ 「여전히 빈칸으로 두고 싶은데 마지막 남은 줄은 삭제할 수 없다고 하네?」
     ⑵ 범위 확정 — 「②칸 하나만」. ⇒ ★«칸 하나»를 비우는 건 된다. ⛔«모든 칸이 빈 블럭»은 막는다.
     ⇒ 그때는 `EMPTY_CELL_LINES` 가 «살아» 있었다. 재는 양만 바뀌었었다:
         옛 뜻 — 「칸 하나라도 비면 거절」(이 함수, 순수·lines 길이만 봤다)
         둘째 뜻 — 「블럭의 «모든» 칸이 비게 되면 거절」(`_gridRejectAllCellsEmpty`, 모델 전체를 봤다)
   ★★★2026-09-27 «그 둘째 문까지 걷었다» — 현빈 지시 「t230 > 마지막 한칸도 비울 수 있게 해줘」.
     ⇒ **`EMPTY_CELL_LINES` 는 이제 «없다»** — 코드도 문구도 지웠다. 0개는 «모든 경로»가 통과한다.
     ⛔그러니 이 머리말의 「옛 뜻」·「둘째 뜻」은 역사다. 지금 이 함수가 재는 것은 «상한» 하나뿐이다.
     ⚠️★대신 물려 둔 사실 — 블럭의 «모든» 칸이 비면 내보낸 결과물에서 높이가 0 이 되어
       그 블럭이 보이지 않는다(2026-09-27 실측: 캔버스 안 19px → 클론 0px · 대조군 35px).
       그것이 «지금의 계약»이고 tests/dom/grid-cell-emptied.dom.spec.js 의 I 가 못박는다.
   ~~[폐기 · 2026-09-26] 「0개: 우클릭 "이미지 삭제"가 마지막 줄까지 지워 [data-line]이 통째로
     사라지던 것」 ＋ 「allowEmpty — 0개 거부는 patchCell(기존 줄을 «지우는» 동작)에만 건다.
     cells 통째 경로는 정상 MCP 왕복이라 상한만 걸고 0개는 통과시킨다」~~
   ⛔그 계약은 «그날까지 참이었다» — 지우지 말고 왜 바뀌었는지를 읽어라:
     ⑴ 막은 까닭은 「줄 0개 칸이 [data-line] 을 잃어 «주소»가 없어진다」였다. 그 전제는
        T-A(2026-09-16) 가 메웠다 — 렌더러가 `.grd-cell-empty` 를 찍고(:1578),
        클릭 판정(block-drag.js `_gridAddrAt`)이 `{r,c,li:null}` 로 칸 자체를 주소로 돌려주며,
        패널·CSS 안내문(「+ 내용 추가 (T/G/K)」)이 되살릴 길을 준다.
     ⑵ 그리고 「줄 0개 칸」은 막던 동안에도 «이미 합법 상태»였다 — makeGridBlock({cols:[{lines:[]}]}),
        새 행/열 추가(_gridCellRows 가 lines:[] 로 정규화), cells 통째 경로(allowEmpty=true).
        tests/unit/grid-p1.test.js:269 가 「4칸 모두 grd-cell-empty」를 못박고 있다.
        ⇒ 가드가 막던 것은 «상태»가 아니라 «그 상태로 가는 한 전이»뿐이었다. 즉 「만들 땐 되는데
          지울 땐 안 된다」는 비대칭이 남아 있었고, 현빈이 걸린 자리가 정확히 그 비대칭이다.
     ⑶ 2026-09-26 실측(tests/dom/grid-cell-emptied.dom.spec.js) — 그 전이를 허용해도
        렌더·행거터(`_rowContentEdge` 는 줄 0개 칸을 `continue` 로 건너뛴다)·클릭주소·패널·
        ⌫·저장왕복·내보내기에서 깨지는 것이 «0건»이고 pageerror 도 0건이다.
   ★그래서 `allowEmpty` 인자도 같이 없앴다 — 이제 모든 경로가 0개를 통과시키므로 «갈 길이 하나»다.
     ⛔인자를 남겨 두면 다음 사람이 「어느 경로는 아직 막힌다」고 읽는다.
   ★그래도 «배열이어야 한다»는 계약은 그대로다 — `lines:null`·`undefined` 는 아래 문이
     `LINES_NOT_ARRAY` 로 여전히 거절한다. 「비우기」의 정식 표현은 `lines:[]` 하나다.
     ~~★★code 를 갈라 둔 것이 여기서 값을 한다 — `EMPTY_CELL_LINES`(뜻: 블럭이 통째로 빈다) 와
       `LINES_NOT_ARRAY`(뜻: 모양이 틀렸다)가 «다른 일»이라 사용자 문구도 갈린다.~~
     ⇒ [정정 2026-09-27] `EMPTY_CELL_LINES` 가 없어졌으니 «갈라 둔 값»도 사라졌다.
       ★그래도 그 판단 자체는 남는다 — **「비울 수 없다」와 「모양이 틀렸다」를 한 code 로 묶지 마라.**
       묶었다면 오늘 이 가드를 걷을 때 `lines:null` 까지 같이 열렸을 것이다. */
function _gridRejectLinesLength(lines) {
  if (!Array.isArray(lines)) return null;
  if (lines.length > MAX_CELL_LINES) {
    return { ok: false, code: 'TOO_MANY_LINES', message: `patchCell.lines limit reached (${MAX_CELL_LINES}, got ${lines.length})` };
  }
  return null;
}

/* === ★「적용 목록」이 «안 그려진 것»까지 담아 돌려주던 것 (T-122, 2026-09-22) ==========
   ★무엇이 문제였나 — 위 명부(GRID_LINE_FIELDS)는 «이름»만 본다. `patchCell{lineIndex, imgSrc}`
     를 «글자 줄»에 주면 이름은 명부에 있으니 통과하고, 렌더러는 `line.type === 'image'` 일 때만
     그 값을 읽으므로 화면엔 그림이 0개다. 그런데 `applied.patchCell.imgSrc` 엔 보낸 값이
     그대로 담겨 돌아왔다 — 2026-09-09 에 막은 «거짓 성공»의 2세대다(그때는 «이름»이 틀렸고,
     이번엔 이름은 맞는데 «줄 종류»가 어긋난다).
     `cells` 통째 경로는 더 셌다 — `applied.cells = partial.cells` 라 입력을 «그대로 메아리»쳤다.
     행이 배열이 아니어도, 셀 키가 통째로 버려져도, 보낸 것이 그대로 「적용됐다」로 돌아왔다.

   ★어떻게 재나 — «이름»이 아니라 «민감도»다. 렌더러(`_gridLineHtml`)를 실제로 돌려서, 그 키를
     지우거나 다른 값으로 바꿔도 출력이 한 글자도 안 바뀌면 «이 줄에선 안 읽는다»로 판정한다.
     ⛔「줄 종류별 필드표」를 손으로 적지 마라 — 그 표는 렌더러와 «따로 늙는다». 명부를 손으로
       못 늘리게 한 것(:154~165)과 같은 이유고, `gridLineHasText()` 가 이미 같은 수법을 쓴다
       (목록을 베끼지 않고 렌더러를 돌려서 묻는다).
   ★«값»이 아니라 «민감도»인 까닭 — `widthPct:100`·`italic:false` 처럼 «기본값과 같은 값»은
     «없앴을 때»와 출력이 같다. 그걸 「안 됐다」고 하면 반대쪽 거짓말이 된다. 그래서 탐침값
     여럿과 대조해 «이 줄에서 그 키를 아예 안 읽는가»라는 구조적 질문으로 바꾼다.
   ⛔`type` 은 안 잰다 — 그건 «값»이 아니라 «가지를 고르는 손잡이»고, 모르는 값은 죄다 글자
     가지로 떨어진다. 그래서 `type:'text'` 를 글자 줄에 주면 «둔감»해 보인다(거짓 고발). */
const _GRID_FIELD_PROBES = ['gdt', 'gdt-probe', 41.5, 3, true, false, null];

/* ★계측기의 사각지대 (2026-09-23, 위 «이미지 줄 정렬»과 같은 패치).
 *   아래 민감도 측정은 «칸의 정렬»(2번째 인자)을 늘 'left' 로 고정해 뒀다. 그런데 줄 정렬은
 *   `line.align || colAlign` 이라, 「칸도 왼쪽·줄도 왼쪽」이라는 «한 문맥»에서는 그 키를 지우든
 *   무엇으로 바꾸든 산출이 같다 — 실제로는 읽는 필드를 «안 읽는다»로 판정한다.
 *   그 오판의 값은 비싸다: patchCell{lineIndex, align:'left'} «하나만» 보낸 호출이
 *   「어느 것도 렌더러가 안 읽는다」로 ok:false 가 된다(멀쩡한 요청을 막는다).
 *   ⇒ 문맥을 «둘» 돌린다 — 한 문맥에서라도 산출이 흔들리면 그 줄은 그 키를 읽는 것이다.
 *   ⛔`_GRID_FIELD_PROBES`(값 탐침)는 안 건드린다 — 그건 «모든» 필드 판정에 걸리는 전역 처방이라
 *     늘리면 비용이 필드 수만큼 곱해진다. 여기서 필요한 것은 «값»이 아니라 «문맥»이다. */
const _GRID_FIELD_CONTEXTS = ['left', 'center'];

function _gridLineFieldIsRead(line, key) {
  try {
    return _GRID_FIELD_CONTEXTS.some((ctx) => {
      const base = _gridLineHtml(line, ctx, 0, null, false);
      const gone = { ...line };
      delete gone[key];
      if (_gridLineHtml(gone, ctx, 0, null, false) !== base) return true;
      return _GRID_FIELD_PROBES.some(p => _gridLineHtml({ ...line, [key]: p }, ctx, 0, null, false) !== base);
    });
  } catch (_) {
    return true;   // 못 쟀으면 «읽는다»로 둔다 — 멀쩡한 필드를 「안 됐다」고 하는 쪽이 더 나쁘다
  }
}

/** 이 줄에서 렌더러가 «안 읽는» 키들(= 보내도 화면엔 안 나오는 것). */
function _gridUnreadLineFields(line, keys) {
  if (!line || typeof line !== 'object') return [];
  return keys.filter(k => k !== 'type' && !_gridLineFieldIsRead(line, k));
}
const _gridLineTypeOf = (line) => (line && line.type) ? String(line.type) : 'text';

/* ★종류가 «읽을 수 있는» 키 — 렌더러에서 «파생»한 종류→키 표 (E14 · 2026-10-06 · APPROVED_BY: 지디 E14-E157 · 모양 B = 태양)
 *   왜: _gridMergeLine 의 청소는 «옛 줄이 읽던 키»만 턴다. 그런데 «읽나»를 그 «인스턴스»로 재면, 렌더러가 그 줄에서
 *     조건부로 안 읽는 키(E157: 크롭 없는 그림 줄은 height 를 그릴 때 무시)를 「옛 종류도 안 읽었다」로 오판해 남긴다
 *     → image(h160) → body → gap 이 160px 여백으로 되살아났다(실측 10-06).
 *   무엇: 「종류 T 의 줄이 키 k 를 읽을 수 있나」 = 맨 줄 {type:T} 에서 _gridLineFieldIsRead(위 민감도 · 탐침 _GRID_FIELD_PROBES).
 *     ⛔손으로 적은 종류별 필드표가 아니다(:1046 T-122 규칙 그대로) — 표는 렌더러를 돌려 «뜬다».
 *   ★표 키 = 종류 이름(_gridLineTypeOf) 하나 · 렌더러 판(版)은 키에 없다 — 아래 수명이 그걸 대신한다.
 *   ★수명 = 이 모듈 인스턴스 한 번(메모리 Map). 다시 불러오면 새로 뜬다. ⛔디스크 캐시·얼린 모듈 상수 금지 —
 *     그러면 렌더러와 «따로 늙는» 표가 된다(T-122 가 막은 것).
 *   ★본 것(10-06 실측 · 맨 줄 모드): image = height·imgSrc·marginTop·radius·widthPct(height 는 «빈 틀» grd-img-empty 높이로 읽힘)
 *     · gap = height·marginTop · divider = color·height·marginTop · 글자 역할 = content·fontFamily·fontSize·letterSpacing·lineHeight·marginTop·text·weight.
 *   ★못 본 것(맨 줄 탐침이 안 만드는 모드): 크롭(imgSrc ∧ imgSizePct/PosX/PosY — 두 키가 같이 있어야 함) · 원(imgShape:'circle')
 *     · 탐침값이 유효값이 아닌 키(색 hex·정렬 낱말 등 — color/align/bg 는 글자 역할 표에 안 뜬다). ⇒ 표는 «하한»이다.
 *     (10-06 실측: 맨 줄 + «한 키 더» 모드 전수(33 키 × 탐침 7)도 더 찾은 것 0 · 234ms — 그래서 안 쓴다.
 *      옛 줄 «이웃» 모드는 크롭으로 height 를 찾지만 인스턴스마다 달라 표가 아니다 — 안 쓴다(태양 · 모양 B 유지).)
 *   ★image height 는 «빈 틀» 모드가 나른다 — 그 모드가 height 를 안 읽게 되면 grid-kind-shed K1·K2 가 빨개진다(지킴).
 *   그래서 청소는 «표 ∪ 인스턴스»로 판정한다(인스턴스 판정 = 옛 규칙 그대로) — 지우는 집합은 옛것보다 «넓어지기만» 한다. */
const _gridTypeReadMemo = new Map();
function _gridTypeCanRead(type, key) {
  let set = _gridTypeReadMemo.get(type);
  if (!set) {
    set = new Set([...GRID_LINE_FIELDS].filter(k => k !== 'type' && _gridLineFieldIsRead({ type }, k)));
    _gridTypeReadMemo.set(type, set);
  }
  return set.has(key);
}

/** 한 셀의 `lines` 를 훑어 «안 그려질 것»을 모은다. `where` 는 보고용 경로 앞머리. */
function _gridInspectLines(lines, where, drops) {
  if (!Array.isArray(lines)) return;
  lines.forEach((ln, i) => {
    if (!ln || typeof ln !== 'object' || Array.isArray(ln)) {
      drops.push({ path: `${where}.lines[${i}]`, why: `line is ${Array.isArray(ln) ? 'an array' : ln === null ? 'null' : typeof ln}, not an object — it renders nothing` });
      return;
    }
    const t = _gridLineTypeOf(ln);
    for (const k of _gridUnreadLineFields(ln, Object.keys(ln))) {
      drops.push({ path: `${where}.lines[${i}].${k}`, why: `not read by the renderer on a type:'${t}' line` });
    }
  });
}

/** `cells`(행 0 포함 전체 R×C)에서 «화면에 안 닿는 것»을 모은다 — 버려지는 행·셀·키 + 종류 안 맞는 줄 필드.
 *  ⛔여기서 «막지» 않는다. `cells` 는 통째 교체라 부분 적용이 정상이다 — 「된 것/안 된 것」을 나눠 돌려주는 게 답이다. */
function _gridInspectCells(fullCells, colCount, rowCount) {
  const drops = [];
  for (let r = 0; r < Math.min(fullCells.length, rowCount); r++) {
    const row = fullCells[r];
    if (!Array.isArray(row)) {
      drops.push({ path: `cells[${r}]`, why: `row is ${row === null ? 'null' : typeof row}, not an array — the whole row was dropped` });
      continue;
    }
    if (row.length > colCount) {
      drops.push({ path: `cells[${r}][${colCount}..${row.length - 1}]`, why: `grid has ${colCount} column(s) — pass cols in a separate call to add columns` });
    }
    for (let c = 0; c < Math.min(row.length, colCount); c++) {
      const cell = row[c];
      const where = `cells[${r}][${c}]`;
      if (!cell || typeof cell !== 'object' || Array.isArray(cell)) {
        drops.push({ path: where, why: `cell is ${Array.isArray(cell) ? 'an array' : cell === null ? 'null' : typeof cell}, not an object — dropped` });
        continue;
      }
      for (const k of Object.keys(cell)) {
        if (GRID_CELL_FIELDS.has(k)) continue;
        const near = _gridNearestField(k, GRID_CELL_FIELDS);
        drops.push({
          path: `${where}.${k}`,
          why: k === 'width'
            ? `'width' is a COLUMN field, not a cell field — use update_block{patchCol:{index,width}}`
            : GRID_LINE_FIELDS.has(k)
              ? `'${k}' is a LINE field, not a cell field — put it inside lines:[{${k}:...}]`
              : near ? `not read by the renderer — did you mean '${near}'?` : 'not read by the renderer',
        });
      }
      if (cell.lines !== undefined && !Array.isArray(cell.lines)) {
        drops.push({ path: `${where}.lines`, why: `lines is ${cell.lines === null ? 'null' : typeof cell.lines}, not an array — dropped (the cell kept its previous lines)` });
      } else {
        _gridInspectLines(cell.lines, where, drops);
      }
    }
  }
  return drops;
}

/** «렌더러가 읽는 것»만 남긴 cells. `applied.cells` 가 «화면과 같은 말»을 하게 하는 마지막 체다.
 *  ★왜 필요한가 — 커밋 뒤 모델(getGridModel)을 그대로 돌려주면 «저장은 됐지만 안 그려지는» 값
 *    (글자 줄에 얹힌 imgSrc 따위)이 `applied.cells` 안에 그대로 남는다. 그러면 같은 답 안에서
 *    `ignoredProps` 는 「안 됐다」고 하는데 `applied` 는 그 값을 들고 있는 «자기모순»이 된다.
 *  ⛔dataset(저장) 은 «안» 건드린다 — 거기서 지우면 read→고쳐→통째로 다시 쓰기(정상 MCP 왕복)가
 *    남의 칸 값을 조용히 지운다. 지우는 게 아니라 «보고에서 빼는» 것이 이 카드의 처방이다. */
function _gridRenderedCell(cell, fields) {
  const out = {};
  /* ★명부 밖 «값»도 여기서 빠진다 (2026-09-24 T-170/180) — 렌더러가 그 값을 안 쓰기 때문이다.
     안 빼면 같은 답 안에서 `ignoredProps` 는 「안 됐다」고 하는데 `applied` 는 그 값을 들고
     있는 자기모순이 된다(T-122 가 «이름» 축에서 닫은 것과 «같은 모양»의 거짓말이다). */
  const badValue = new Set(_gridValueViolations(cell, '').map(v => v.path.replace(/^\./, '')));
  for (const k of Object.keys(cell)) {
    if (!fields.has(k) || cell[k] === undefined || badValue.has(k)) continue;
    if (k !== 'lines' || !Array.isArray(cell.lines)) { out[k] = cell[k]; continue; }
    out.lines = cell.lines.map(ln => {
      if (!ln || typeof ln !== 'object' || Array.isArray(ln)) return ln;
      const unread = new Set(_gridUnreadLineFields(ln, Object.keys(ln)));
      for (const v of _gridValueViolations(ln, '')) unread.add(v.path.replace(/^\./, ''));
      const keep = {};
      for (const lk of Object.keys(ln)) if (!unread.has(lk)) keep[lk] = ln[lk];
      return keep;
    });
  }
  return out;
}
function _gridRenderedCells(cells) {
  return cells.map(row => row.map(cell => {
    const out = _gridRenderedCell(cell, GRID_CELL_FIELDS);
    if (!Array.isArray(out.lines)) out.lines = [];
    return out;
  }));
}

/** `applied.cols` 의 같은 체. ⛔`applied.cols = partial.cols` 는 «입력 메아리»라 거짓말이었다 —
 *  T-122 가 `applied.cells` 에서 닫은 그 구멍이 열 축엔 그대로 남아 있었다(2026-09-24 T-170). */
function _gridRenderedCols(cols) {
  return cols.map(col => _gridRenderedCell(col, GRID_COL_FIELDS));
}

/* ═══ ★T-176 — 「이건 파괴적 교체다」를 «도구»도 말하게 한다 ═══════════════════════════
 *  ⛔동작은 «한 글자도» 안 바꾼다 — 「줄여도 남긴다」로 만들자는 것이 아니다(적대검수 Q3 결정).
 *  ★화면 쪽은 이미 말한다 — js/props/prop-grid.js 가 「줄이면 잘린 칸 내용은 사라진다 (⌘Z 복원)」
 *    을 띄우고, 그 윗줄이 「동작을 바꾸는 대신 «사실을 적는다»로 정했다」고 적어 뒀다.
 *    ⇒ 갈린 것은 «도구 경로»뿐이었다. 같은 한 마디를 여기 붙인다. 새 규칙이 아니다.
 *  ⛔이것을 「데이터가 사라지는 결함」으로 되세우지 마라 — 정해진 동작이고 안내도 있다.
 */

/** 이번 교체로 «격자 밖»에 남는 칸 중 잃을 것이 있는 칸. ⛔세기만 한다 — 막지도 살리지도 않는다.
 *  @param {object} model  «바꾸기 전» 모델(getGridModel) — dataset 은 아직 안 건드린 시점이어야 한다 */
function _gridTruncated(model, nextRowCount, nextColCount) {
  const out = [];
  for (let r = 0; r < model.cells.length; r++) {
    const row = model.cells[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (r < nextRowCount && c < nextColCount) continue;
      const cell = row[c] || {};
      const lines = Array.isArray(cell.lines) ? cell.lines : [];
      const deco = Object.keys(cell).filter(k => k !== 'lines');
      if (!lines.length && !deco.length) continue;     // 빈 칸은 잃을 것이 없다
      out.push({ r, c, lines: lines.length, deco: deco.length });
    }
  }
  return out;
}

/** 「줄이는 교체」면 그 사실을 적은 쪽지, 아니면 null. */
function _gridDestructiveNotice(model, nextRowCount, nextColCount) {
  const rowsBefore = model.rows.length, colsBefore = model.cols.length;
  const shrank = [];
  if (nextRowCount < rowsBefore) shrank.push(`rows ${rowsBefore}→${nextRowCount}`);
  if (nextColCount < colsBefore) shrank.push(`cols ${colsBefore}→${nextColCount}`);
  if (!shrank.length) return null;
  const lost = _gridTruncated(model, nextRowCount, nextColCount);
  /* ⛔★머리말을 «잃은 게 있을 때만» DESTRUCTIVE 로 쓴다 (2026-09-24, 지디 관측 회신).
   *   무엇이 있었나 — 이 쪽지는 «줄이면 언제나» 난다(빈 칸만 잘려도 난다). 그런데 머리말이
   *   늘 「DESTRUCTIVE REPLACE」였다. ⇒ 읽는 쪽에서 「경고가 떴다」와 「뭔가 사라졌다」가
   *   한 낱말로 뭉개진다 — 늑대를 외치는 경고는 다음 진짜 경고를 가린다.
   *   ★두 경우를 가르는 것은 여전히 `droppedCells` 다(빈 배열이면 잃은 것이 없다).
   *     머리말은 그 «같은 사실»을 한눈에 보이게 할 뿐이다 — 새 신호를 만든 게 아니다.
   *   ⛔쪽지 «자체»는 없애지 마라: 「줄였다」는 사실은 잃은 것이 없어도 알 값이 있고,
   *     없애면 「경고 없음」이 「안 줄었다」와 「줄었는데 빈 칸이었다」 둘을 덮는다. */
  return {
    kind: 'truncate',
    shrank,
    /* ⚠️«칸 수»지 «줄 수»가 아니다 — 무엇을 센 건지 이름에 적어 둔다.
       ⚠️★주소는 «모델»(getGridModel) 기준이다 — 행 0 의 줄은 저장본에선 cols[c].lines 에
         사는데(겸직) 이 주소는 cells[0][c] 로 가리킨다. 같은 칸이지 다른 칸이 아니다. */
    droppedCells: lost.map(x => `cells[${x.r}][${x.c}]`),
    message: (lost.length ? 'DESTRUCTIVE REPLACE' : 'SHRINK (nothing lost)') + ` — ${shrank.join(', ')}. `
      + (lost.length
        ? `${lost.length} cell(s) fell outside the new grid and their contents were DISCARDED `
          + `(${lost.map(x => `cells[${x.r}][${x.c}]:${x.lines} line(s)`).join(', ')}). `
        : 'No cell outside the new grid had any content, so nothing was lost this time. ')
      + 'This is the defined behaviour (the on-screen panel says the same); undo (⌘Z) restores it. '
      + 'Read the grid first (get_canvas_state) if you need to keep those cells.',
  };
}

/** 부분 적용 보고 — 기존 규약을 따른다(`main/claude-pm/mcp-block-tools.js:255` 의 `ignoredProps`/`hint`).
 *  ★`ok:false` 로 뒤집지 «않는다» — 나머지는 진짜로 그려졌다. 「된 것 / 안 된 것 + 까닭」을 나눠 준다. */
function _gridAttachNotApplied(res, drops) {
  if (!drops || !drops.length) return res;
  res.ignoredProps = drops.map(d => d.path);
  res.hint = `${drops.length} value(s) were NOT applied and are absent from 'applied' - `
    + drops.map(d => `${d.path}: ${d.why}`).join('; ')
    + ". Nothing on screen changed for these; everything in 'applied' did render.";
  return res;
}

/* ═══ ★입구 계약 — 구조 입구 «넷»이 이 함수 하나를 지난다 (T-170·175·176·180) ═══════════
 *
 * ★왜 «하나»로 모으나 (2026-09-24)
 *   그리드를 고치는 구조 입구는 넷이다 — `cols` · `patchCol` · `cells` · `patchCell`.
 *   고치기 «전»에 넷이 서로 «다른 것»을 쟀다(실측, 아래 표는 이 파일에서 직접 읽은 것):
 *     patchCell — 모르는 이름 거절 ○ · 이미지 상한 ○ · lines 계약 ○ · 값 명부 ✕
 *     cells     — 모양/행수 ○ · lines 길이 ○ · 「안 그려질 것」보고 ○ · 이미지 상한 ✕ · 값 명부 ✕
 *     cols      — «배열 길이만» ○ . 그 안은 아무거나 들어간다 · 이미지 상한 ✕
 *     patchCol  — 검사 «0건». Object.assign 으로 그대로 얹힌다
 *   그리고 patchCell 의 거절문이 「그건 patchCol 로 보내라」고 «안내»한다 —
 *   안내가 가리키는 그 문에 문지기가 없었다(T-170 이 적어 둔 모순이 이것이다).
 *   ⇒ ⛔「입구마다 검사를 하나씩 더 붙인다」로 닫지 않는다. 문이 하나 더 생기면 또 빠진다.
 *     `structKeys` 가 「한 번에 하나」를 이미 강제하므로, 그 한 키를 이 함수가 «한 번» 훑는다.
 *
 * ★계약 — 한 문장
 *   「이번 호출이 «이름을 대어» 준 값」이 명부 밖이면 «거절»하고,
 *   「통째로 되쓰는 문서(cols/cells)」에 섞여 온 것이면 «말한다»(ignoredProps + hint).
 *
 *   ⑴ 왜 둘로 갈랐나 — `cols`/`cells` 는 read(getGridModel) → 한 칸만 고쳐 → 통째로 되쓰기가
 *     «정상 왕복»이다. 거기서 거절하면 옛 저장본에 남아 있던 값 하나가 왕복 «전체»를 죽인다.
 *     T-170·175·180 이 셋 다 함정으로 못박은 「새로 들어오는 값 / 이미 저장된 값」이 그 자리다.
 *     `patchCell`·`patchCol` 은 부르는 쪽이 그 필드를 «직접 적은» 것이라 그 사정이 없다.
 *     ★이 갈림은 내가 발명한 것이 아니다 — `cells` 문이 이미 그렇게 정해 뒀다
 *       (_gridInspectCells 머리의 「⛔여기서 «막지» 않는다」). 그 규약을 넷으로 넓힌 것뿐이다.
 *   ⑵ 「거절」이든 「말한다」든 «둘 다 말은 한다» — 조용한 `ok:true` 가 어느 문에도 안 남는다.
 *     T-180 이 요구한 것이 정확히 그것이다(동작을 바꾸라는 게 아니다).
 *   ⑶ ★자원 가드(이미지 상한 · lines 길이)만은 «네 문 모두 거절»이다 — 그건 값의 옳고 그름이
 *     아니라 「이걸 받으면 프로젝트가 무거워져 안 열린다」라서 왕복 사정이 안 통한다(T-170 ⑶).
 *
 * ★«화면»도 같은 표를 본다 — 렌더러의 `_gridAlign`/`_GRID_VALIGN` 과 여기 명부가 한 곳이다.
 *   그래서 「도구는 거절하는데 렌더러는 관용」(T-175)이 «값의 정의»에서는 더 안 갈린다.
 *   ⛔다만 렌더러는 저장본을 그대로 그린다 — 읽는 길에서 막으면 데이터가 사라진 것처럼 보인다.
 *     ⇒ 좁히는 것은 «입구»고, «그리는 쪽»은 안 좁힌다. 이게 남은 단 하나의 비대칭이고 의도다.
 * ═══════════════════════════════════════════════════════════════════════════════════ */

/** 꾸밈 한 덩이(칸·열·줄)의 «값»이 명부 안인가. 이름 검사와 달리 «값»을 본다.
 *  ⛔`null`/`undefined`/`''` 는 «값이 아니다» — 앞의 둘은 「그 키를 지움」, `''` 는
 *    「열 기본값을 강제로 끔」이라고 이 파일이 이미 계약해 뒀다(renderGridBlock 의 pick 주석 ⑴⑵). */
function _gridValueViolations(node, where) {
  const out = [];
  if (!node || typeof node !== 'object' || Array.isArray(node)) return out;
  for (const k of Object.keys(GRID_VALUE_TESTS)) {
    if (!(k in node)) continue;
    const v = node[k];
    if (v === null || v === undefined || v === '' || v === 0) continue;   // 위와 «같은» 넷
    if (typeof v === 'string' && GRID_VALUE_TESTS[k](v)) continue;
    out.push({
      path: `${where}.${k}`,
      why: `${JSON.stringify(v)} is not a value the renderer accepts for '${k}' — `
        + (k === 'fontFamily'
          ? 'a font family name (no ; : { })'
          : k === 'bgImg'
            ? 'a data:image/… or goya-asset:// URL (no quotes, brackets or spaces)'
            : k === 'bgPos'
              ? `"<${GRID_BLOCK_BG_POS_X.join('|')}> <${GRID_BLOCK_BG_POS_Y.join('|')}>"`
              : 'a CSS color the grid accepts: #hex, rgb()/rgba()/hsl()/hsla(), transparent, or var(--token[, fallback])')
        + '. It would have been stored and then DROPPED at render time, '
        + `wiping whatever '${k}' the cell had before.`,
    });
  }
  for (const k of Object.keys(GRID_ENUM_FIELDS)) {
    if (!(k in node)) continue;
    const v = node[k];
    /* ⛔`null`·`undefined`·`''`·`0` «넷»은 명부로 재지 않는다 — 이 파일이 이미 뜻을 정해 둔
       값들이다(renderGridBlock 의 pick 계약 ⑴⑵): 앞의 둘은 「그 키를 지움」, 뒤의 둘은
       「열 기본값을 끄는 강제값」. 여기서 다시 재면 그 계약을 «한 축만» 뒤집는 셈이 된다
       (지키는 검사: tests/unit/grid-cell-unset-contract.test.js D2 — 행 0/행 1+ 대칭). */
    if (v === null || v === undefined || v === '' || v === 0) continue;
    const allowed = GRID_ENUM_FIELDS[k];
    if (typeof v === 'string' && allowed.includes(v)) continue;
    out.push({
      path: `${where}.${k}`,
      why: `${JSON.stringify(v)} is not a ${k} value — use one of ${allowed.join('|')}`
        + (k === 'valign'
          ? ' (it would have fallen back to the block default without a word)'
          : ' (it would have gone straight into the style attribute and the browser would have ignored it)'),
    });
  }
  return out;
}

/* ★★한계를 넘겨 «잘릴» 중첩을 모은다 (2026-09-24 T-175 ⑶).
 *  ⛔막지 «않는다» — 자르는 것이 «정해진 동작»이다. T-176(행·열 줄이기)과 «같은 갈래»고,
 *    그래서 처방도 같다: 동작은 그대로 두고 «잘랐다»고 말한다.
 *  ★왜 ⑵ 와 처방이 갈리나 — ⑵(모르는 값)는 「부른 쪽이 원한 적 없는 결과」라 되돌릴 근거가 있다.
 *    ⑶(한계 초과)은 「한계가 원래 그렇다」라, 막으면 그건 «동작 변경»이고 발주 밖이다.
 *  ★실측(기준 7780267): 중첩 3단계 → ok:true 인데 화면에 없음 · 중첩 4열 → ok:true 인데
 *    .grd-nested-col 3개. 둘 다 ignoredProps 0건 · 토스트 0건이었다.
 *  ⛔한계 값을 여기 리터럴로 적지 마라 — GRID_NESTED_MAX_* 가 렌더러와 «같은 자리»다. */
function _gridInspectNested(line, where, depth, drops) {
  if (!line || typeof line !== 'object' || _gridLineTypeOf(line) !== GRID_NESTED_LINE_TYPE) return;
  if (depth >= GRID_NESTED_MAX_DEPTH) {
    drops.push({ path: where, why: `a nested grid renders ${GRID_NESTED_MAX_DEPTH} level(s) deep at most — `
      + `this one sits at level ${depth + 1} and renders as nothing (the guard returns an empty string)` });
    return;
  }
  const cols = Array.isArray(line.cols) ? line.cols : [];
  if (cols.length > GRID_NESTED_MAX_COLS) {
    drops.push({ path: `${where}.cols[${GRID_NESTED_MAX_COLS}..${cols.length - 1}]`,
      why: `a nested grid renders at most ${GRID_NESTED_MAX_COLS} columns — the rest are dropped (unchanged behaviour)` });
  }
  cols.slice(0, GRID_NESTED_MAX_COLS).forEach((col, c) => {
    (Array.isArray(col && col.lines) ? col.lines : [])
      .forEach((ln, i) => _gridInspectNested(ln, `${where}.cols[${c}].lines[${i}]`, depth + 1, drops));
  });
}

/** 모르는 «열» 필드 거절 — 칸 쪽 `_gridRejectUnknownCellFields` 의 열 판. 같은 어투를 쓴다. */
function _gridRejectUnknownColFields(rest) {
  const bad = Object.keys(rest).filter(k => !GRID_COL_FIELDS.has(k));
  if (!bad.length) return null;
  const parts = bad.map(k => {
    if (GRID_LINE_FIELDS.has(k)) {
      return `'${k}' is a LINE field, not a column field — put it inside lines:[{${k}:…}]`;
    }
    const near = _gridNearestField(k, GRID_COL_FIELDS);
    return near ? `'${k}' is not read by the renderer — did you mean '${near}'?`
      : `'${k}' is not read by the renderer`;
  });
  return {
    ok: false, code: 'INVALID',
    message: `patchCol: unknown field(s) — ${parts.join('; ')}. `
      + `This would have returned ok:true and changed nothing on screen. `
      + `Allowed here: ${[...GRID_COL_FIELDS].sort().join(', ')}.`,
  };
}

/** 구조 입구 «하나»의 통과. @returns {{reject?:object, drops:Array}}
 *  @param {object} partial  updateGridBlock 이 받은 그대로 — 구조 키는 한 번에 하나다
 *  @param {{trusted:boolean}} ctx */
function _gridIntake(partial, ctx, drops) {
  const trusted = !!(ctx && ctx.trusted === true);
  const violations = [];
  const oversize = [];

  /* ★imgSrc 상한 — block-factory.js 의 다른 이미지 삽입 API들(add_asset_block 등)과 동일하게
   *   GRID_IMG_MAX_CHARS 로 막는다. 없으면 dataset.cells JSON 이 그대로 커져 proj.json 이
   *   무한정 부풀 수 있다(2026-09-15 a1-a3 QA 지적).
   * ★2026-09-20 — «UI 입구»만 opts.trusted 로 면제한다. 이 캡의 명분은 IPC 문자열 비용인데,
   *   사람이 파일 대화상자로 고른 이미지까지 같이 막혀서 「우클릭 이미지 삽입이 안 된다」가 됐다.
   *   ⛔면제는 3번째 인자로만 — partial.trusted 는 «읽지 않는다»(MCP 가 JSON 으로 보낼 수 있다).
   * ★★2026-09-24 T-170 — 이 캡이 «patchCell 한 문»에만 걸려 있었다. 실측: `cols` 로 보낸
   *   20만 자 이미지가 그대로 들어갔다. 이제 네 문이 같은 자로 잰다(이 함수가 그 «한 자»다). */
  const takeImg = (v, where, addr) => {
    if (!trusted && typeof v === 'string' && v.length > GRID_IMG_MAX_CHARS) oversize.push({ where, v, addr });
  };
  const scanLines = (lines, where, addr) => {
    if (!Array.isArray(lines)) return;
    lines.forEach((ln, i) => {
      if (!ln || typeof ln !== 'object' || Array.isArray(ln)) return;
      takeImg(ln.imgSrc, `${where}.lines[${i}].imgSrc`, addr);
      violations.push(..._gridValueViolations(ln, `${where}.lines[${i}]`));
      _gridInspectNested(ln, `${where}.lines[${i}]`, 0, drops);   // ★⑶ 잘릴 중첩 — 막지 않고 말한다
    });
  };
  /** 칸 또는 열 한 덩이 — 값 명부 ＋ 그 안의 줄들. */
  const scanNode = (node, where, addr) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    takeImg(node.bgImg, `${where}.bgImg`, addr);   // ★G4 — 칸·열 배경 이미지도 줄 imgSrc 와 «같은 자»로 잰다
    violations.push(..._gridValueViolations(node, where));
    scanLines(node.lines, where, addr);
  };

  /* ── 문 ①·② «이름을 대어 준» 쪽 — 모르는 이름·값은 거절한다 ───────────────── */
  if (partial.patchCell !== undefined) {
    const p = partial.patchCell;
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      /* ★`np` — 중첩 «안» 줄의 주소(T-220, 2026-09-27). 여기서 «꺼내» 둬야 아래 이름 검사가
         「모르는 칸 필드」로 거절하지 않는다. ⛔이 문과 적용부 둘 다 고쳐야 한다 — 한쪽만
           고치면 거름망이 새 꼴을 막거나, 거름은 통과하는데 적용이 안 된다(카드가 미리 짚은 자리). */
      const { r: _r, c: _c, lineIndex, np, ...rest } = p;
      /* ★`np` 는 «줄 하나» 안을 가리키는 주소라 `lineIndex` 없이는 뜻이 없다. 먼저 거절한다 —
         뒤에서 조용히 무시하면 「보냈는데 아무 일도 안 났다」가 된다(이 레포의 고질). */
      if (np !== undefined && lineIndex === undefined) {
        return { ok: false, code: 'INVALID',
          message: 'patchCell.np (nested line path) needs lineIndex — it points inside the line at that index, '
            + "e.g. patchCell:{r,c,lineIndex:1,np:'0.0',fontSize:20}" };
      }
      if (np !== undefined && !_gridNestPathSegs(np)) {
        return { ok: false, code: 'INVALID',
          message: `patchCell.np must be "<col>.<line>" segments joined by "/" `
            + `(at most ${GRID_NESTED_MAX_DEPTH} — deeper than that the renderer draws nothing), `
            + `got ${JSON.stringify(np)}` };
      }
      const addr = { r: Number(p.r), c: Number(p.c) };
      /* ★거짓 성공 봉쇄 — 렌더러가 «안 읽는» 이름은 여기서 막는다(2026-09-09, T-170 에서 이 문으로 옮김).
         이 줄이 없으면 오타 하나가 ok:true 로 돌아오고 화면은 그대로다. */
      const _reject = _gridRejectUnknownCellFields(rest, lineIndex !== undefined);
      if (_reject) return _reject;
      if (lineIndex !== undefined) {
        takeImg(rest.imgSrc, 'patchCell.imgSrc', addr);
        violations.push(..._gridValueViolations(rest, 'patchCell'));
        _gridInspectNested(rest, 'patchCell', 0, drops);
      } else {
        /* ★★옆문 둘을 닫는다 (2026-09-23 T-178 C3) — `lines:null` · `lines:undefined`.
         *  무엇이 있었나 — 이 레포는 `lines:[]` 를 EMPTY_CELL_LINES 로 «명시적으로 거절»해 놓고,
         *    «같은 결과»(칸의 줄이 통째로 사라짐)를 내는 옆문 둘을 `ok:true` 로 열어 뒀다.
         *    실측(기준 f724dc1, 행 1 칸 · 줄 2개):
         *      lines: []        → ok:false EMPTY_CELL_LINES · 내용 보존   ← 가드가 걸린 «한» 입구
         *      lines: null      → ok:true  · 2줄 → 0줄 «사라짐» · 저장본 {"lines":null}
         *      lines: undefined → ok:true  · 2줄 → 0줄 «사라짐» · 저장본 {}
         *    ⇒ 가드가 «한 입구»에만 걸려 있었다. 그리고 `lines:null` 은 MCP/JSON 으로 «지금 닿는»
         *      길이라 실사용 데이터 손실 경로다.
         *  ⛔「무시」가 아니라 «거절»로 닫는다 — 같은 결과를 내는 입력을 조용히 무시하면
         *    정책이 둘로 갈린다(한쪽은 거절, 한쪽은 노옵).
         *  ⛔`=== null` 만 막지 마라 — 두 옆문은 «독립된 축»이다(평가자 음성대조: null 만 막은
         *    시제품에서 L1 초록 · L2 빨강). 「배열이 아니면」으로 한 번에 닫는다.
         *  ⛔`rest.lines === undefined` 로 보지 마라 — 「안 줬음」과 「undefined 를 줬음」이 안 갈린다.
         *    `'lines' in rest` 가 그 둘을 가른다(rest 는 spread 라 값이 undefined 인 키도 남는다).
         *
         *  ★★★2026-09-26 «이 문은 남지만 «까닭»이 바뀌었다» — code 를 EMPTY_CELL_LINES →
         *    `LINES_NOT_ARRAY` 로 갈았다. 현빈 지시로 `lines:[]`(비우기)가 «허용»됐으므로
         *    (:415 머리말) 「비울 수 없다」는 이름과 문구가 이 자리에서 곧 «거짓»이 된다.
         *    ~~[폐기 · 2026-09-26] 「`lines` 는 「`null` = 그 키를 지운다」 계약의 예외다.
         *      칸의 줄은 patchCell 로 비울 수 없다」~~ → 비울 수 있다. 단 «배열로» 비운다.
         *  ⇒ 이제 이 문이 재는 것은 «비우기 금지»가 아니라 «모양(배열) 계약» 하나다.
         *    `lines:null` 을 여전히 거절하는 까닭은 그대로다: 저장본이 `{"lines":null}` 로
         *    남아 「비웠다」와 「모양이 깨졌다」가 한 글자도 안 갈리게 되기 때문이다. */
        if ('lines' in rest && !Array.isArray(rest.lines)) {
          const t = rest.lines === null ? 'null' : typeof rest.lines;
          return { ok: false, code: 'LINES_NOT_ARRAY',
            message: `patchCell.lines must be an array (got ${t}) — to empty the cell pass lines:[]. `
              + 'To edit one line use patchCell{lineIndex, ...}.' };
        }
        const _linesReject = _gridRejectLinesLength(rest.lines);
        if (_linesReject) return _linesReject;
        /* ★★★2026-09-27 «마지막 문까지 걷었다» — 현빈 지시 「t230 > 마지막 한칸도 비울 수 있게 해줘」.
           ~~[폐기 · 2026-09-27] `_gridRejectAllCellsEmpty` — 「이 칸을 비우면 블럭이 통째로 빈다」를
             막던 자리가 여기였다(0926~0927 하루). 함수째 지웠다.~~
           ⇒ 이제 patchCell{lines:[]} 는 «어느 칸이든» 통과한다. 남은 문은 모양(LINES_NOT_ARRAY)과
             상한(TOO_MANY_LINES) 둘뿐이다.
           ⚠️★대신 «잰 사실»을 하나 물려 둔다 — 블럭의 «모든» 칸이 비면 내보낸 결과물에서
             높이가 0 이 되어 그 블럭이 보이지 않는다(캔버스 안 19px → 클론 0px · 대조군 35px,
             2026-09-27 실측 tests/dom/grid-cell-emptied.dom.spec.js 의 I 가 그것을 못박는다).
             ⛔이것은 «결함이 아니라 지금의 계약»이다. 바꾸려면 현빈 결정이 필요하다(T-230 후속). */
        takeImg(rest.imgSrc, 'patchCell.imgSrc', addr);
        scanNode(rest, 'patchCell', addr);
      }
    }
  }
  if (partial.patchCol !== undefined) {
    const p = partial.patchCol;
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      const { index: _i, ...rest } = p;
      const nameReject = _gridRejectUnknownColFields(rest);
      if (nameReject) return nameReject;
      const lenReject = _gridRejectLinesLength(rest.lines);   // ★0개는 «모든 경로»가 통과시킨다(:415)
      if (lenReject) return lenReject;
      scanNode(rest, 'patchCol', { r: 0, c: Number(p.index) });   // ★열의 lines = 행 0 칸
    }
  }
  if (violations.length) {
    /* 이름을 대어 준 문 — 첫 어긋남 하나로 «전부» 거절한다(이름 검사와 같은 모양). */
    return {
      ok: false, code: 'INVALID',
      message: `${violations.map(v => `${v.path}: ${v.why}`).join('; ')}. `
        + 'This would have returned ok:true; nothing would have changed on screen for it.',
    };
  }

  /* ── 문 ③·④ «통째로 되쓰는 문서» — 거절하지 않고 말한다 ───────────────────── */
  let colsLinesReject = null;
  if (partial.cols !== undefined && Array.isArray(partial.cols)) {
    partial.cols.forEach((col, c) => {
      const where = `cols[${c}]`;
      if (!col || typeof col !== 'object' || Array.isArray(col)) {
        drops.push({ path: where, why: `column is ${Array.isArray(col) ? 'an array' : col === null ? 'null' : typeof col}, not an object — it renders as a default 1fr column` });
        return;
      }
      for (const k of Object.keys(col)) {
        if (GRID_COL_FIELDS.has(k)) continue;
        const near = _gridNearestField(k, GRID_COL_FIELDS);
        drops.push({ path: `${where}.${k}`,
          why: GRID_LINE_FIELDS.has(k) ? `'${k}' is a LINE field, not a column field — put it inside lines:[{${k}:...}]`
            : near ? `not read by the renderer — did you mean '${near}'?` : 'not read by the renderer' });
      }
      /* ★자원 가드는 «통째 교체 문»에서도 거절이다(계약 ⑶) — 값 명부와 달리 왕복 사정이 안 통한다.
         ★빈 열(`lines:[]`)은 정상이다(새 열의 의도된 초기상태) — 2026-09-26 부터는 «이 함수»가
           모든 경로에서 0개를 통과시킨다. 그래서 여기 있던 allowEmpty 인자가 사라졌다.
           ~~[폐기 · 2026-09-27] 「블럭이 통째로 빈다」는 축은 `_gridRejectAllCellsEmpty` 가
             patchCell 문 한 곳에서 잰다~~ → **그 자는 2026-09-27 에 없앴다**(현빈 T-230 결정).
             ⇒ 이제 «어느 경로로도» 블럭이 통째로 비는 것을 막지 않는다. 길이 하나다. */
      const _colLinesReject = _gridRejectLinesLength(col.lines);
      if (_colLinesReject) { colsLinesReject = colsLinesReject || _colLinesReject; return; }
      scanNode(col, where, { r: 0, c });
      _gridInspectLines(col.lines, where, drops);
    });
  }
  if (colsLinesReject) return colsLinesReject;
  if (partial.cells !== undefined && Array.isArray(partial.cells)) {
    for (const row of partial.cells) {
      if (!Array.isArray(row)) continue;            // 행 «모양»은 _gridInspectCells 가 말한다
      for (const cell of row) {
        /* ~~[이사 · 2026-09-24] 이 가드는 updateGridBlock 의 cells 분기 안에 있었다~~
           까닭 — 같은 자원 가드가 문마다 «다른 자리»에 있으면 다음 문에서 또 빠진다. */
        const _reject = _gridRejectLinesLength(cell && cell.lines);
        if (_reject) return _reject;
      }
    }
    partial.cells.forEach((row, r) => {
      if (!Array.isArray(row)) return;
      row.forEach((cell, c) => scanNode(cell, `cells[${r}][${c}]`, { r, c }));
    });
  }
  for (const v of violations) drops.push({ path: v.path, why: v.why });

  /* ── 자원 가드 — 네 문 모두 «거절». 왕복 사정이 안 통하는 축이다 ────────────── */
  /* ★★「새로 들어오는 것」과 「이미 있는 것」을 가른다 (T-170 함정, 2026-09-24).
   *   ⛔상한을 «그냥» 네 문에 걸면 read → 한 칸만 고쳐 → 통째로 되쓰기(정상 왕복)가 죽는다.
   *     사람이 파일 대화상자로 넣은 그림은 `opts.trusted` 로 캡을 건너뛰고 저장본에 앉는데,
   *     그 칸을 «지나가기만» 하는 다음 호출은 trusted 가 아니다 — 자기 그림에 자기가 막힌다.
   *     (그 병은 patchCell 문에 «이미» 있었다: prop-grid.js:478·block-factory.js:5099 가
   *      기존 lines 를 통째로 다시 보내는 2-인자 호출이다. 넓히는 김에 그쪽도 같이 낫는다.)
   *   ⇒ 재는 것은 「이 호출이 «들여오는» 바이트」다. «그 칸에 이미 있던» 문자열이면 안 센다.
   *   ⛔「블록 어딘가에 있으면」으로 넓히지 마라 — 큰 그림을 한 칸에서 «다른 칸으로 베끼는»
   *     호출까지 통과한다. 그건 IPC 문자열을 새로 싣는 것이라 캡의 명분에 그대로 걸린다
   *     (지키는 검사: tests/unit/grid-line-add.test.mjs 의 「2인자(MCP) 통로는 여전히 막힌다」 —
   *      그 시험이 «칸 (0,1) → 칸 (0,0) 베끼기»를 정확히 재고 있다. 한 번 그렇게 틀렸다).
   *   ⚠️그래서 옛 저장본의 큰 그림은 고친 뒤에도 «그대로 열리고 그대로 저장된다» —
   *     이 카드가 「읽을 때까지 막으면 데이터가 사라진 것처럼 보인다」고 못박은 자리다. */
  const fresh = oversize.filter(o => !_gridCellImgSrcs(ctx && ctx.block, o.addr).has(o.v));
  if (fresh.length) {
    return { ok: false, code: 'TOO_LARGE',
      message: `imgSrc too long (>${GRID_IMG_MAX_CHARS}) at ${fresh.map(o => o.where).join(', ')}` };
  }
  return null;
}

/** 「그 칸이 «이미» 들고 있는 imgSrc」. ⛔상한 후보가 있을 때만 불린다(모델을 한 번 뜬다). */
function _gridCellImgSrcs(block, addr) {
  const out = new Set();
  if (!block || !addr || !Number.isFinite(addr.r) || !Number.isFinite(addr.c)) return out;
  let model;
  try { model = getGridModel(block); } catch (_) { return out; }
  const cell = model.cells[addr.r] && model.cells[addr.r][addr.c];
  for (const ln of (Array.isArray(cell && cell.lines) ? cell.lines : [])) {
    if (ln && typeof ln.imgSrc === 'string') out.add(ln.imgSrc);
  }
  return out;
}

const _esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function _gridCols(block) {
  let cols;
  try { cols = JSON.parse(block.dataset.cols || '[]'); } catch (_) { cols = []; }
  if (!Array.isArray(cols) || cols.length < MIN_COLS) cols = JSON.parse(JSON.stringify(GRID_DEFAULTS.cols));
  return cols.slice(0, MAX_COLS);   // ★상한 4 (2026-09-04, 4x4 피커) — updateGridBlock 검증과 «같은 값»이어야 한다
}

// rows — ★신설(P1). 없으면(옛 파일) [{height:'auto'}] 1행으로 승격한다.
// 행 높이는 «가중치»가 아니라 px 최소높이(플랜 §3-A, 테이블 U5a와 같은 의미론) — 'auto' 허용.
function _gridRows(block) {
  let rows;
  try { rows = JSON.parse(block.dataset.rows || '[]'); } catch (_) { rows = []; }
  if (!Array.isArray(rows) || rows.length < MIN_ROWS) rows = [Object.assign({}, ROW_DEFAULT)];
  return rows.slice(0, MAX_ROWS).map(r => {
    const h = r && typeof r === 'object' ? r.height : undefined;
    if (h === 'auto' || h == null || h === '') return { height: 'auto' };
    const n = Number(h);
    return { height: (Number.isFinite(n) && n >= 0) ? n : 'auto' };
  });
}

/** dataset.cells 를 «읽는» 문 — 쓰는 문 _gridCellsToDataset 의 짝. (개명: 옛 _gridExtraRows)
 *  ★T-178 부터 dataset.cells 는 «행 0 포함 전체 R×C»다. rowCount×cols.length 로 pad/truncate.
 *  ⛔행 0 은 `lines` 를 «떼고» 만든다 — 행 0 의 줄은 cols[c].lines 하나뿐이다(단일 진실원).
 *    저장본에 어쩌다 행 0 lines 가 섞여 들어와도(손수정·옛 파일·MCP 되받아쓰기) 여기서 죽는다.
 *  ⚠️옛 이름이 「Extra(추가 행)」였던 것은 행 0 이 «빠져» 있었기 때문이다. 이제 안 빠지므로
 *    이름도 같이 바꾼다 — 이름이 옛 뜻을 들고 있으면 다음 사람이 인덱스를 한 칸 틀린다. */
function _gridCellRows(block, cols, rowCount) {
  let saved;
  try { saved = JSON.parse(block.dataset.cells || '[]'); } catch (_) { saved = []; }
  if (!Array.isArray(saved)) saved = [];
  const need = Math.max(0, rowCount);
  const C = cols.length;
  const out = [];
  for (let i = 0; i < need; i++) {
    const src = Array.isArray(saved[i]) ? saved[i] : [];
    const row = [];
    for (let c = 0; c < C; c++) {
      const cell = (src[c] && typeof src[c] === 'object' && !Array.isArray(src[c])) ? src[c] : {};
      if (i === 0) {
        const { lines: _drop, ...deco } = cell;   // ★행 0 = 꾸밈만. 줄은 cols[c].lines 가 갖는다.
        row.push(deco);
        continue;
      }
      // ★lines 는 항상 배열로 정규화한다 — 소비자가 r 에 상관없이 같은 코드로 cell.lines 를 다루게.
      row.push(Array.isArray(cell.lines) ? cell : { ...cell, lines: [] });
    }
    out.push(row);
  }
  return out;
}

/** dataset.cells 를 만드는 «유일한 길». (2026-09-23 T-178 C0)
 *  ★왜 문을 깔았나 — 지금 dataset.cells 를 만드는 자리가 여섯이다(_gridCellPatchDataset ·
 *    updateGridBlock 의 rows/cols/cells 세 분기 · makeGridBlock · prop-grid.js buildGridPicker).
 *    「저장 모양」을 한 번 바꾸려면 여섯 곳을 같이 고쳐야 하고, 한 곳을 놓치면 행이 밀린
 *    «화면은 멀쩡해 보이는 데이터 손상»이 난다(이 레포의 고질 — MIN_COLS 4열 사고가 본보기).
 *  ⛔C0 은 «순수 통과»였다 — 산출 바이트가 이전과 완전히 같아야 「경유만 시켰다」가 증명된다.
 *    C1(2026-09-23)이 «이 문 안에서» 뜻을 바꿨다: 행 0 의 `lines` 를 뗀다.
 *  ★cellRows = «행 0 포함 전체 R×C». 행 0 칸은 «꾸밈만» 저장한다 —
 *    ⛔`delete c.lines` 이 한 줄이 단일 진실원을 지키는 자리다. 지우면 행 0 줄 내용이
 *      cols[c].lines 와 cells[0][c].lines 두 벌이 되어 조용히 갈라진다
 *      (지키는 검사: tests/unit/grid-row0-lines-invariant.test.js · 음성대조 포함). */
function _gridCellsToDataset(cellRows) {
  const out = (Array.isArray(cellRows) ? cellRows : []).map((row, r) => (Array.isArray(row)
    ? row.map((cell) => {
      const c = (cell && typeof cell === 'object' && !Array.isArray(cell)) ? { ...cell } : {};
      if (r === 0) delete c.lines;
      return c;
    })
    : []));
  return JSON.stringify(out);
}

/** 행 0 «줄 내용»을 cols[c] 에 얹는다 — 행 0 의 줄은 cols[c].lines 하나뿐이다(단일 진실원).
 *  ~~[폐기 · T-178 2026-09-23] 「col(열 기본값)에 cell 오버라이드를 merge — 꾸밈 5개도 같이」~~
 *  까닭 — 꾸밈까지 여기서 cols 로 올리면 「행 0 칸 값」과 「열 기본값」이 같은 자리에 겹쳐
 *    앉는다(T-178 본체). 꾸밈은 이제 cells[0][c] 가 받는다.
 *  ★그리고 여기 있던 `['align','valign','bg','padding','radius'].forEach` 손-명부가 사라졌다 —
 *    GRID_CELL_FIELDS 와 «따로 늙는» 자리였다(T-172 테두리 같은 새 칸 필드가 생기면 조용히 빠진다). */
function _mergeCellLinesIntoCol(col, cell) {
  if (!cell || typeof cell !== 'object') return col;
  if (!Array.isArray(cell.lines)) return col;
  return { ...col, lines: cell.lines };
}

/** 셀의 lines 에서 «한 줄»에만 필드를 병합한 다음 배열. patchCell{lineIndex} 의 심장.
 *  범위 밖이면 null.
 *  ★커밋(updateGridBlock)과 패널의 «연속 input 미리보기»(gridPreviewLine)가 «같은 이 함수»를 쓴다 —
 *    두 벌이 되면 따로 늙는다. tests/unit/grid-line-typo.test.js U2-a·U4 가 그 동일성을 지킨다. */
/** 중첩 «안» 줄의 주소 `np` 를 검산한다 — 꼴과 깊이만 본다(있는지는 걸어 봐야 안다).
 *  ★꼴은 렌더러가 찍는 그대로다: `"<열>.<줄>"` 을 `/` 로 이은 것(`_gridNestAddr`).
 *  ⛔깊이 상한을 손으로 적지 마라 — GRID_NESTED_MAX_DEPTH 가 렌더러와 «같은 자리»다.
 *    렌더러는 `depth >= GRID_NESTED_MAX_DEPTH` 에서 `return ''` 하므로, 마디가 그보다 많은
 *    주소는 «그려지지 않는 자리»다. 거기에 쓰는 것은 조용한 실패라 «거절»이 맞다.
 *  @returns {null|string[]} 마디 배열, 또는 꼴이 틀리면 null */
function _gridNestPathSegs(np) {
  if (typeof np !== 'string' || !np) return null;
  const segs = np.split('/');
  if (!segs.length || segs.length > GRID_NESTED_MAX_DEPTH) return null;
  return segs.every(sg => /^\d+\.\d+$/.test(sg)) ? segs : null;
}

/** `np` 를 따라 «중첩 안» 줄 하나에 `fields` 를 병합한다 — 경로 위 객체는 복사한다(불변).
 *
 * ★★맨 안쪽에서 `_gridMergeLine` 을 «그대로 부른다» — 병합 규칙(종류 바뀌면 옛 짐을 턴다 등)을
 *   여기 베껴 적지 않는다. ⛔베끼면 두 자리가 «따로 늙는다»(2026-09-27 T-184 에서 실제로 그 병에
 *   빠졌고 검사 D5 가 잡았다). ⇒ 규칙은 한 곳, 부르는 자리만 늘린다.
 * ★못 찾으면 null 을 돌려준다 — 부르는 쪽이 「주소가 없다」로 «거절»한다. ⛔여기서 만들지 마라:
 *   없는 자리에 줄을 지어내면 「쓴 것 같은데 화면에 없다」가 된다.
 * @param {Array} curLines  칸의 «바깥» 줄 배열
 * @param {number} li       그 배열에서 중첩 줄의 자리
 * @param {string[]} segs   `_gridNestPathSegs` 가 검산한 마디들
 * @param {object} fields   병합할 값들
 * @returns {null|Array}    새 «바깥» 줄 배열 */
function _gridMergeNestedLine(curLines, li, segs, fields) {
  const walk = (lines, idx, rest) => {
    if (!rest.length) return _gridMergeLine(lines, idx, fields);   // ★규칙은 여기 한 곳
    const arr = Array.isArray(lines) ? lines : [];
    const i = Number(idx);
    if (!Number.isFinite(i) || i < 0 || i >= arr.length) return null;
    const cur = arr[i];
    if (!cur || _gridLineTypeOf(cur) !== GRID_NESTED_LINE_TYPE) return null;
    const m = /^(\d+)\.(\d+)$/.exec(rest[0]);
    if (!m) return null;
    const ci = Number(m[1]);
    const cols = Array.isArray(cur.cols) ? cur.cols : [];
    if (ci < 0 || ci >= cols.length) return null;
    const col = cols[ci];
    const innerNext = walk(Array.isArray(col && col.lines) ? col.lines : [], Number(m[2]), rest.slice(1));
    if (!innerNext) return null;
    const nextCols = cols.slice();
    nextCols[ci] = Object.assign({}, col, { lines: innerNext });
    const next = arr.slice();
    next[i] = Object.assign({}, cur, { cols: nextCols });
    return next;
  };
  return walk(curLines, li, segs);
}

/** `np` 를 따라 «중첩 안» 줄 객체를 읽는다 — 민감도 탐침이 «그 줄»을 재야 하기 때문이다.
 *  ⛔바깥 줄(`lines[li]`)을 재면 「duo 는 fontSize 를 안 읽는다」가 나와 멀쩡한 호출이 거절된다. */
function _gridNestedLineAt(lines, li, segs) {
  let cur = (Array.isArray(lines) ? lines : [])[Number(li)];
  for (const sg of segs) {
    const m = /^(\d+)\.(\d+)$/.exec(sg);
    if (!m || !cur || _gridLineTypeOf(cur) !== GRID_NESTED_LINE_TYPE) return null;
    cur = cur.cols?.[Number(m[1])]?.lines?.[Number(m[2])];
  }
  return (cur && typeof cur === 'object') ? cur : null;
}

function _gridMergeLine(curLines, li, fields) {
  const lines = Array.isArray(curLines) ? curLines : [];
  const i = Number(li);
  if (!Number.isFinite(i) || i < 0 || i >= lines.length) return null;
  const next = lines.slice();
  const prev = next[i];
  const merged = Object.assign({}, prev, fields);
  /* ★종류가 «바뀌면» 앞 종류가 쓰던 짐을 턴다 (2026-09-23).
   *   무엇이 있었나 — `patchCell{lineIndex, type:'body', text:'…'}` 로 image 줄을 글자 줄로
   *   바꾸면 `imgSrc`·`height` 가 «그대로 남았다». imgSrc 는 dataURL 이라 수백 KB 가 저장본에
   *   눌러앉고, 다음에 다시 image 로 바꾸면 «지운 줄 알았던 그림»이 되살아난다.
   *   ⛔새 규칙을 발명하지 않는다 — 「그 종류가 그 키를 읽나」는 이 파일이 이미 답한다
   *     (_gridUnreadLineFields = 렌더러를 실제로 돌려 재는 민감도). 이름표를 손으로 적으면
   *     종류가 하나 늘 때 그 표만 늙는다.
   *   턴다: ⑴ «새» 종류가 안 읽고 ⑵ «옛» 종류는 읽던 것. ⑵를 안 걸면 「기본값과 같아서
   *     안 읽힌다」로 판정된 멀쩡한 값(예: 역할 기본과 같은 letterSpacing)까지 조용히 지운다.
   *   ⛔이번 호출이 «명시»한 키는 안 턴다 — 부르는 쪽이 일부러 준 값이다.
   *   ★gridPreviewLine(패널 미리보기)도 이 함수를 지나므로 두 길이 «같이» 고쳐진다
   *     (tests/unit/grid-line-typo.test.js U2-a·U4 가 그 동일성을 지킨다). */
  if (fields && fields.type !== undefined && _gridLineTypeOf(prev) !== _gridLineTypeOf(merged)) {
    const keys = Object.keys(merged);
    const unreadNow = new Set(_gridUnreadLineFields(merged, keys));
    const unreadBefore = new Set(_gridUnreadLineFields(prev, keys));
    const prevType = _gridLineTypeOf(prev);
    for (const k of keys) {
      if (fields[k] !== undefined) continue;
      /* ★E14 — «옛 종류가 읽을 수 있었나» = 인스턴스(옛 규칙) ∪ 종류 표(위 _gridTypeCanRead). */
      const couldReadBefore = !unreadBefore.has(k) || _gridTypeCanRead(prevType, k);
      if (unreadNow.has(k) && couldReadBefore) delete merged[k];
    }
  }
  next[i] = merged;
  return next;
}

/** 칸에 «꾸밈 patch»를 얹는다. ★값이 `null`(또는 `undefined`)이면 그 키를 «지운다».
 *
 *  ★★왜 `null` 에 뜻을 주나 (2026-09-23 T-178 · 팀리드 확정)
 *    `undefined` 는 «이미» 지움이었다 — `Object.assign` 이 키를 undefined 로 덮고
 *    `JSON.stringify` 가 그 키를 통째로 떨군다. 다만 그 길은 «같은 프로세스의 JS»에서만 닿는다:
 *    ⛔MCP·IPC·저장본은 JSON 이라 `undefined` 를 «실을 수 없다». `null` 이 그 구멍을 막는다.
 *    ⇒ 「지울 길이 없어서」가 아니라 **「JSON 으로 닿는 길이 없어서」**다.
 *    그리고 예전의 `null` 은 «함정»이었다 — 「값 있음」으로 저장되어 열 기본값이 아니라
 *    «하드 기본»으로 떨어졌다(`align:'left'` · `valign:블록값` · `padding/radius:0`).
 *    아무도 의미 있게 못 쓰던 값에 뜻을 준 것이라, 잃는 표현력이 없다.
 *  ⛔★`lines` 는 이 계약의 «예외»다 — 애초에 여기 안 온다(`const { lines, ...deco }` 가 먼저
 *    떼어 낸다). 칸의 줄은 patchCell 로 비울 수 없고, 배열이 아닌 lines 는 위쪽에서 거절된다.
 *    이 계약을 «모든 키»에 똑같이 걸면 그 옆문이 «설계»가 된다.
 *  ⛔0 과 '' 는 «지움이 아니다» — 값이다(`0`=여백 0 강제 · `''`=강제로 없앰).
 *    falsy 를 통째로 지움으로 읽으면 「열 기본값 12px 인 열에서 이 칸만 0」을 표현할 길이 사라진다.
 *  ⛔명부를 만들지 마라 — 「값이 null/undefined 인가」만 본다(새 칸 필드가 저절로 따라온다). */
function _gridApplyCellDeco(cell, deco) {
  const next = Object.assign({}, cell);
  for (const k of Object.keys(deco)) {
    if (deco[k] === null || deco[k] === undefined) delete next[k];
    else next[k] = deco[k];
  }
  return next;
}

/** 셀 patch 를 «dataset 조각»으로.
 *  ★★가르는 기준은 「꾸밈 5개」가 «아니다» — 「`lines` 인가 아닌가」 «하나»다.
 *    `const { lines, ...deco } = cellPatch` — lines 만 이름으로 집고 나머지는 «흘린다».
 *    ⛔새 필드 명부를 만들지 마라. 이렇게 두면 T-172(테두리) 같은 새 «칸» 필드가 생겨도
 *      deco 에 자동으로 실린다(명부가 따로 늙지 않는다).
 *    ⚠️행 0 의 «내용»만 준 patch 는 dataset.cells 를 «안» 건드리고, 꾸밈만 준 patch 는
 *      dataset.cols 를 «안» 건드린다. 둘을 섞어 주면 두 키가 «둘 다» 나온다 —
 *      부르는 쪽이 한쪽만 쓰면 조용히 «반만» 적용된다(grid-render-gaps.test.js:300 이 그 자리다).
 *  ⚠️cols/cellRows 를 «제자리»에서 고친다 — 호출부가 넘긴 배열이 그대로 쓰인다(기존 동작 보존). */
function _gridCellPatchDataset(cols, cellRows, r, c, cellPatch) {
  const { lines, ...deco } = cellPatch;
  const out = {};
  if (r === 0) {
    if (lines !== undefined) {
      cols[c] = _mergeCellLinesIntoCol(cols[c], { lines });
      out.cols = JSON.stringify(cols);
    }
    if (Object.keys(deco).length) {
      cellRows[0][c] = _gridApplyCellDeco(cellRows[0][c], deco);
      out.cells = _gridCellsToDataset(cellRows);
    }
    return out;
  }
  /* ★lines 는 «종전 그대로» Object.assign 으로 얹는다 — 「지움」 규칙은 «꾸밈»의 것이다.
     (`lines:null` 의 대우는 _gridInspectCells 가 이미 정해 뒀다: 「배열이 아니라 버림」) */
  let next = cellRows[r][c];
  if ('lines' in cellPatch) next = Object.assign({}, next, { lines });
  cellRows[r][c] = _gridApplyCellDeco(next, deco);
  out.cells = _gridCellsToDataset(cellRows);
  return out;
}

// API 경계(add_block/update_block{cells})는 «행 0 포함 전체 R×C」를 받는다(PLAN §3-A 스키마 그대로) —
// 내부 저장만 행 0 을 cols 로 흡수한다(단일 진실원). 여기서 그 경계를 나눈다.
function _splitFullCells(fullCells, cols) {
  if (!Array.isArray(fullCells) || !fullCells.length) return { cols, cellRows: [] };
  const row0 = Array.isArray(fullCells[0]) ? fullCells[0] : [];
  // 행 0 의 «줄 내용»만 cols 로 흡수한다. 행 0 의 «꾸밈»은 cells[0] 에 그대로 남는다(T-178).
  const mergedCols = cols.map((col, c) => _mergeCellLinesIntoCol(col, row0[c]));
  const cellRows = fullCells.map(row => (Array.isArray(row)
    ? row.map(cell => (cell && typeof cell === 'object' && !Array.isArray(cell)) ? cell : {})
    : []));
  // ⛔행 0 의 lines 를 여기서 안 떼도 된다 — 쓰는 문 _gridCellsToDataset 이 «한 자리»에서 뗀다.
  return { cols: mergedCols, cellRows };
}

/** 블록의 dataset 에서 전체 그리드(cols/rows/cells)를 읽는다 — «옛 파일 승격」의 단일 진입점.
 *  cells 는 항상 «행 0 포함» 전체 rows.length × cols.length 로 재구성해서 돌려준다(렌더·API 응답용).
 *  dataset.rows/cells 가 아예 없는 옛 파일도 이 함수를 거치면 1행 그리드로 승격된 모양이 나온다 —
 *  옛 파일이라고 다른 코드 경로를 타지 않는다(늘 같은 함수, 승격은 '있으면 쓰고 없으면 기본값'뿐).
 */
function getGridModel(block) {
  const cols = _gridCols(block);
  const rows = _gridRows(block);
  const cellRows = _gridCellRows(block, cols, rows.length);
  /* ★행 0 = «cols 의 줄» + «cells[0] 의 꾸밈». ⛔col 의 꾸밈은 여기서 «안» 섞는다 —
     합성(칸 값이 없으면 열 기본값)은 렌더러의 pick() «한 곳»이 한다. 여기서도 섞으면
     두 벌이 되고, 라운드트립(read → 그대로 write)이 «열 값을 칸으로 승격»시키는 누수가 된다.
     ★손-명부(align/valign/bg/…)가 여기서도 사라졌다 — 스프레드가 새 필드를 자동으로 싣는다. */
  const row0 = cols.map((c, i) => ({
    lines: Array.isArray(c.lines) ? c.lines : [],
    ...cellRows[0][i],
  }));
  return { cols, rows, cells: [row0, ...cellRows.slice(1)] };
}

// ★addr(4번째 인자, 신설) — 「캔버스 인라인 편집을 전제로」 셀 텍스트 주소를 렌더 시점에 심는다
//   (2026-09-04 현빈 지시, P1.5 선행 설계). {r,c,li} 를 받으면 반환 요소의 최상위 태그에
//   data-r/data-c/data-line 을 찍는다 — blur 때 「이 DOM 이 어느 셀의 몇 번째 줄인가」를 DOM
//   순서 추측 없이 바로 읽을 수 있어야 한다(이 레포에서 순서 추측이 실제 버그를 낸 전례가 있다).
//   ⛔addr 은 «최상위 라인»에만 찍는다 — 중첩 duo/graph 내부(depth≥1)는 addr 없이 그대로 호출해
//     기존 출력과 byte-identical 을 유지한다(innercard 등 무변화 요구 — addr=null 이면 이 함수
//     전체가 P0/P1 이전과 동일 문자열을 낸다).
// ⚠️★위 문장은 «2026-09-08까지» 참이었다. 지우지 않고 옆에 대비를 세운다(사실이던 문장은 남긴다):
//   그날 5번째 인자 useRoleColor 가 생겨서 이제 «addr 하나»로는 결정되지 않는다.
//     · addr=null + useRoleColor=false → 여전히 P0/P1 이전과 «동일 문자열»(innercard·중첩이 이 길)
//     · addr=null + useRoleColor=true  → ★색이 붙는다. renderGridBlock 이 중첩 duo 재귀에
//       useRoleColor 를 물려 주므로 «중첩 줄»이 정확히 이 조합이다.
//   ⇒ 「무변화」의 조건은 이제 «addr=null» 이 아니라 «useRoleColor=false» 다.
//   (지키는 검사: tests/unit/grid-line-typo.test.js U2-c — innercard 2-인자 호출은 color 를 안 찍는다)
/** 중첩 안 줄 하나의 «주소»를 한 단 더 내려 잇는다 (T-200 커밋 ①).
 *  @param addr  이 줄을 담은 «바깥 줄»의 주소 {r,c,li} — 중첩의 첫 단일 때만 있다
 *  @param naddr 이 줄을 담은 «중첩 줄»의 주소 {r,c,root,path} — 둘째 단부터
 *  @param ci    중첩 열 index · @param ni 그 열의 lines[] 안 index
 *  @returns {r,c,root,path} | null  — 바깥에 주소가 «없으면» null 을 그대로 물려준다.
 *  ★null 을 물려주는 것이 핵심이다 — innercard(gridLineHtml 2-인자)와 민감도 탐침
 *    (_gridUnreadLineFields 의 addr=null 호출)이 그 길로 와서 산출이 예전과 같아야 한다. */
function _gridNestAddr(addr, naddr, ci, ni) {
  const seg = `${ci}.${ni}`;
  if (naddr) return { r: naddr.r, c: naddr.c, root: naddr.root, path: `${naddr.path}/${seg}` };
  if (addr)  return { r: addr.r,  c: addr.c,  root: addr.li,    path: seg };
  return null;
}

// ★naddr(6번째 인자, 2026-09-25 — T-200 커밋 ①) — «중첩 안의 줄»에도 가리킬 이름을 준다.
//   위 ⛔문단이 「중첩은 addr 없이 그대로 호출한다」고 적어 둔 그 자리다. 그 문장은 오늘까지
//   참이었고 지우지 않는다 — 대신 옆에 「무엇이 달라졌나」를 세운다.
//
// ★왜 «다른 이름»인가 — `data-line` 을 중첩 안 줄에도 찍으면 «뜻이 바뀐다», 산출만 느는 게 아니다.
//
//   ★★어떻게 셌나(다음 사람이 «그 자로 다시 셀 수 있게») — ⛔꼴이 «둘»이다. 둘 다 세야 한다:
//       ⑴ 맨몸    `grep -rn "\[data-line\]"  js/`
//       ⑵ 값 지정 `grep -rn "\[data-line="   js/`
//     ⛔⑴만 세면 ⑵의 «셋»을 통째로 놓친다. 실제로 이 주석의 첫 판이 그렇게 「다섯」이라 적었고,
//       그걸 받아 읽은 사람이 「여섯」으로 다시 틀렸다. 수가 두 번 갈린 자리다.
//     ⛔`js/props/prop-laurel.js` 의 `.lrl-line-*[data-line="…"]` 둘은 «이 명부가 아니다» —
//       월계관 «패널 입력칸»의 제 이름이라 이 렌더러의 줄 주소와 무관하다(그래서 아래 9 에 없다).
//
//   ★오늘 이 줄 주소를 읽는 자 = ★**아홉**이다. «집는 방식»으로 셋으로 갈린다:
//     ㈎ `closest()` — «위로 올라가다 처음 만나는 하나» (다섯)
//        js/block-drag.js `_gridEditable` · `_gridAddrAt` · 빈 이미지 슬롯 · 이미지 프레임
//        js/block-factory.js 우클릭 줄 표적
//     ㈏ ★`querySelectorAll()` — «그 칸의 전부» (하나)  ⇒ ★이 자리가 제일 위험했다
//        js/overlay-handles.js `_rowContentEdge` — `cell.querySelectorAll('[data-line]')` 을
//        받아 ★`lines[0]`(첫 줄) 과 `lines[lines.length-1]`(마지막 줄)을 집는다. 그 사각형이
//        ★행 거터(행 경계 드래그 손잡이)의 y 가 된다(`showGridGutters` → `_rowContentEdge`).
//        ⇒ 중첩 안 줄이 `data-line` 을 가지면 «맨 위/맨 아래»가 중첩 속 줄로 바뀌어
//          ★행 경계 손잡이가 엉뚱한 높이에 앉는다. «처음 하나»의 문제가 아니다.
//     ㈐ `querySelector('[data-line="<값>"]')` — «그 주소 하나» (셋)
//        js/overlay-handles.js 이미지 프레임 · js/image-handling.js · js/props/prop-grid.js 마커
//
//   ⇒ 중첩 안 줄이 `data-line` 을 갖는 순간: ㈎ 는 `closest` 가 «바깥 .grd-nested» 대신
//     «안쪽 줄»을 집어 인라인 편집이 중첩 속으로 새고, ㈏ 는 위처럼 행 경계가 틀어지고,
//     ㈐ 는 문서 순서상 «중첩 안 이미지»를 먼저 집어 코너 핸들이 딴 데 앉는다.
//   ⇒ ★그래서 중첩엔 `data-line` 을 «안» 찍는다. 새 이름을 «더한다»:
//     `data-nroot`(이 줄을 품은 «최상위 줄»의 index = 바깥 addr.li) ＋ `data-npath`(중첩 안의 길).
//     `data-r`·`data-c` 는 «같은 축»이라 그대로 쓴다 — 오늘의 `[data-r][data-c]` 셀렉터는
//     `.grd-cell` 이나 `[data-line]` 으로 한정돼 있어 중첩 안 줄을 집지 않는다
//     (⛔「전수」라고 «주장»하지 않는다 — 세는 자는 위 두 꼴 grep 이고, 그 자로 다시 세라).
//
// ★왜 «둘이 아니라 길»인가 — 팀장 제안은 `data-ncol`·`data-nline` 두 칸이었다. 그 꼴은 깊이 1
//   까지만 말할 수 있다. 그런데 이 렌더러는 «깊이 2 에도 줄을 그린다»: 가드가
//   `depth >= GRID_NESTED_MAX_DEPTH` 라 depth 1 의 duo 는 통과하고 그 자식이 depth 2 로 그려진다
//   (그 자리를 재는 자 = tests/unit/grid-render-gaps.test.js N3).
//   두 칸짜리 꼴로 깊이 2 를 적으면 「4칸을 더하거나」 「깊이 2 는 주소를 안 준다」 둘 중 하나가 된다.
//   ⇒ `data-npath="<열>.<줄>"` 을 «단계마다 / 로 잇는다». 깊이 1 = `"0.2"` · 깊이 2 = `"0.2/1.0"`.
//     ★칸 수가 상수를 «따라간다» — GRID_NESTED_MAX_DEPTH 를 손으로 어디에도 안 적는다.
//   ⛔안 고른 길 셋: ⑴ `data-line` 재사용 → 위 «아홉» 소비자의 뜻이 바뀐다.
//     ⑵ 평평한 두 칸(ncol/nline) → 깊이 2 를 못 적는다. ⑶ JSON 한 덩어리(`data-naddr='{...}'`)
//        → 속성값에 따옴표 이스케이프가 들어가 골든·문자열 검사가 읽기 나빠진다.
//
// ⛔저장 포맷은 «안» 바뀐다 — 주소는 렌더 산출의 속성이지 모델 필드가 아니다.
//   GRID_LINE_FIELDS 에 아무 것도 안 넣었다(넣으면 patchCell 이 받아 dataset 에 실린다).
// ★addr=null && naddr=null 이면 이 함수는 여전히 «예전과 같은 문자열»을 낸다 — innercard 경로
//   (gridLineHtml 2-인자)와 민감도 탐침(_gridUnreadLineFields)이 정확히 그 조합이다.
function _gridLineHtml(line, colAlign, depth = 0, addr = null, useRoleColor = false, naddr = null) {
  if (!line || typeof line !== 'object') return '';
  // ★필드 별칭 정규화 (2026-07-04 bench2 근본픽스): planner/generator는 텍스트블록 어휘(content)를
  // 라인에도 쓴다 — text만 읽으면 "그릇만 있고 내용 없음"(오렌지 바에 빈 텍스트, duo 통째 미렌더).
  // 러너는 pass-through(계약: 스펙 필드 = API 필드)이므로 파서가 별칭을 수용하는 게 1:1 계약의 근본 해법.
  if (line.text === undefined && line.content !== undefined) line = { ...line, text: line.content };
  const mt = Number.isFinite(Number(line.marginTop)) ? Number(line.marginTop) : null;
  const mtCss = mt !== null ? `margin-top:${mt}px;` : '';
  const addrAttr = addr
    ? ` data-r="${addr.r}" data-c="${addr.c}" data-line="${addr.li}"`
    : (naddr ? ` data-r="${naddr.r}" data-c="${naddr.c}" data-nroot="${naddr.root}" data-npath="${naddr.path}"` : '');
  if (line.type === 'gap') {
    const h = Number(line.height) || 16;
    return `<div${addrAttr} class="grd-gap" style="height:${h}px;${mtCss}"></div>`;
  }
  /* ★구분선 줄 (그리드 티켓 ② · 2026-09-28) — 칸 «안»에 가로선을 긋는다.
     ★여백 줄(gap) 바로 옆에 둔다: 둘 다 «글자가 없는 줄»이라 아래 글자 가지(role·font)를
       타면 안 되고, 주소 속성(addrAttr)은 똑같이 달아야 줄 선택·삭제·이동이 그대로 먹는다.
     굵기(height)·색(color) «둘만» 갖는다 — 값이 없으면 1px·#e0e0e0.
     ⛔위아래 여백에 새 필드를 만들지 않는다: 이 레포는 여백을 «여백 줄(gap)»로 다루고,
        렌더러가 읽는 필드는 GRID_LINE_FIELDS 명부에 올라야 한다(P6 검사가 그걸 잠근다).
        필드를 하나 늘리는 대신 숨쉴 틈만 고정으로 주고, 더 벌리고 싶으면 앞뒤에 여백 줄을
        넣는다 — 굵기·색과 달리 «다른 줄로 표현되는» 값이라 필드로 가질 이유가 없다.
     ⛔margin 단축을 쓰면 mtCss(marginTop)가 뒤에서 덮어써 «위 여백만» 사라진다. 그래서
        세로 여백은 margin-block 으로 쓰고 mtCss 는 종전대로 맨 뒤에 둔다.
     ⛔CSS 클래스에 여백을 두지 않는다 — 내보내기(PNG·단독 HTML)는 에디터 CSS 를 안 싣는
        경로가 있어 «화면과 다른 그림»이 된다. 인라인이면 어느 경로로도 같이 간다. */
  if (line.type === 'divider') {
    const th = Math.max(GRID_DIVIDER_H_MIN,
                        Math.min(GRID_DIVIDER_H_MAX, Number(line.height) || GRID_DIVIDER_H_MIN));
    const col = _esc(line.color || GRID_DIVIDER_DEFAULT_COLOR);
    return `<div${addrAttr} class="grd-divider" style="height:${th}px;background:${col};margin-block:8px;${mtCss}"></div>`;
  }
  if (line.type === 'image') {
    const h = Number(line.height) || 0;
    const r = Number(line.radius) || 0;
    /* ★원형 이미지 줄 (현빈 2026-10-01 「그리드 우클릭으로 이미지 넣잖아 — 원형도. 지금은 사각형인데 정원도 필요」)
     *   기존 필드로는 정원이 «안» 나온다 — 폭은 칸 대비 %(widthPct), 높이는 px 라 칸 폭이 바뀌면 타원이 된다.
     *   ⇒ 줄 필드 imgShape:'circle' 하나. 지름 = height(px, 없으면 GRID_IMG_CIRCLE_D), 칸이 좁으면 max-width 로
     *     줄되 aspect-ratio 1/1 이라 «늘 정원». ⛔widthPct·크롭(imgSizePct/imgPosX/imgPosY)은 원에선 안 읽는다
     *     (_gridUnreadLineFields 가 ignoredProps 로 되돌려준다 — 거짓 성공 없음).
     *   ⛔imgShape 가 없으면 이 갈래를 안 탄다 — 아래 사각 산출은 한 글자도 안 바뀐다(grid-img-frame-noop · 골든). */
    /* ★★G20 — 원 «채움색»(bg)과 원 «안 글자»(text·color·fontSize) (현빈 2026-10-07
     *   「그리드 블럭 칸에 원형 이미지에셋을 추가한 뒤, ★서클 에셋블럭처럼 ★색을 솔리드로 바꾸고 ★텍스트 입력이 가능하게」
     *    · 길은 지디 2026-10-07 ⒜「작은 길」 — ⛔서클 에셋블럭을 순수 함수로 뜯는 ⒝는 안 한다)
     *
     * ★★새 줄 필드가 ★0개다 — `bg`·`text`·`color`·`fontSize` 는 ★이미 GRID_LINE_FIELDS 에 있는 이름이다
     *   (글자 줄이 쓰던 그 넷). 이 가지가 ★그 이름을 ★읽기 시작하는 것뿐이다. 그래서
     *   ⑴ 입구가 ★자동으로 받는다 — 민감도 탐침(_gridLineFieldIsRead)이 「렌더러를 켜고 끄며」 재므로.
     *      ★실측(기준 2866df63): 받기 전엔 `patchCell{bg}`·`{text}` 가 ★ok:false/INVALID 로 거절됐다
     *      (「none of bg is read by the renderer on a type:'image' line」). 그 거절이 ★ok:true 로 뒤집히는 것을
     *      tests/dom/grid-circle-text.dom.spec.js G20-1 이 ★단언한다.
     *   ⑵ grid-patchcell-reject P6(상수 == 이 함수가 읽는 줄 필드 «이름»의 uniq 집합)은 ★초록 그대로다 —
     *      ★집합이 안 변한다. ⇒ ⛔P6 을 이 카드의 양성대조로 ★쓸 수 없다(항등식이라 아무것도 안 잠근다).
     *      ⚠️★★그런데 ★이 주석이 ★한 번 P6 을 ★빨갛게 만들었다(2026-10-07 실측): 여기에
     *        ★「점 뒤에 이름을 붙인 꼴」로 예시를 적었더니, P6 의 도출 정규식이 ★주석 속 그 글자를
     *        ★«렌더러가 읽는 필드»로 뽑아 명부에 없는 이름이 하나 늘었다.
     *      ⇒ ⛔★이 파일의 주석에 ★`줄객체.필드` 꼴을 ★새로 쓰지 마라 — ★필드 이름은 ★말로 적어라.
     *        (바로 아래 정렬 가지의 ⛔주석이 ★P8 에 대해 ★같은 함정을 ★같은 말로 적어 뒀다. 나는 그걸
     *         ★읽고도 ★P6 에서 다시 밟았다 — ★두 자가 ★같은 소스를 ★같은 방식으로 파싱한다.)
     *        양성대조는 ★전부 DOM 쪽에 세웠다(그 파일 머리말의 명부).
     *
     * ★배치는 ★서클 에셋블럭과 «같은 상수»다 — 가운데 · 폭 = 지름 × 1/√2(내접 정사각형).
     *   정본이 CSS(`.icb-children`)와 여기 ★둘로 갈리므로 ★«재는 자»를 세웠다:
     *   tests/unit/grid-circle-text-inset.test.mjs 가 css/editor-blocks.css 의 그 %를 파싱해 이 상수와 맞춘다.
     * ⛔`inset` 단축 금지 — html2canvas(PNG 내보내기)가 못 읽는다. left/top/transform 은 `.icb-children` 이
     *   이미 쓰는 ★검증된 관용구다(js/icb-children.js 머리말 · css 그 절).
     * ★꼴은 ★인라인이다 — 내보내기(단독 HTML·캡처 클론)는 에디터 CSS 를 안 싣는 경로가 있다(이 함수의 관례).
     *
     * ★체커무늬 — 빈 원은 `.grd-img-empty` 를 ★그대로 단다(클래스를 떼지 «않는다»):
     *   ⑴ 캔버스 더블클릭 갈래가 `.grd-img-frame[data-line]:not(.grd-img-empty)` 로 ★크롭/파일선택을 가른다
     *      (js/block-drag.js) — 떼면 ★그림 없는 원에서 크롭 편집기가 열린다.
     *   ⑵ 무늬는 ★인라인 `background`가 이긴다(CSS 클래스 규칙 < 인라인). ⇒ 색을 칠하면 무늬가 ★알아서 진다.
     * ⛔bg·text 가 ★둘 다 없으면 산출이 ★예전과 바이트 동일이다 — 그게 음성대조(㉥)가 재는 것이다.
     * ★★「사각으로 바꾸기」가 bg·text 를 ★안 뗀다(지디 2026-10-07 ㉢ 판정) — ★코드 0줄로 그렇다:
     *   _gridMergeLine 의 종류 청소는 `fields.type !== undefined` 일 때만 돌고, 그 길은 `{imgShape:undefined}` 만 준다.
     *   ★두 실패를 견준 결과다 — 「유령 키가 저장본에 남는다」(작은 비용) vs 「★사람이 쓴 글자가 ★말없이 사라진다」(되돌릴 길 없음).
     *   ★잠그는 자: G20-7(원→사각→원 왕복 뒤 글자 그대로) ＋ grid-img-circle C4(imgShape 키만 빠진다)가 ★같이 초록.
     *   ★★⚠️그러나 ★이 동작은 ★«코드»가 떠받치는 것이 ★아니다 — ★`fields.type !== undefined` 라는
     *     ★«기존 조건»이 떠받친다. ⇒ ★그 조건이 바뀌면(예: 청소를 「type 이 없어도 돈다」로 넓히면)
     *     ★이 약속은 ★★«조용히» 깨진다 — ★이 파일엔 ★고칠 자리가 ★한 줄도 없으므로 ★아무 표시도 안 남는다.
     *     ⇒ ★★`G20-7` 이 ★그 파수꾼이다. ⛔그 검사를 지우거나 느슨하게 만들면 ★이 약속이 ★무방비가 된다.
     *     (지디 2026-10-07 지시로 적는다 — 「코드 0줄로 성립한다」는 ★장점이자 ★위험이다.)
     * ⛔안 읽는 것(★손잡이가 없는 값을 읽지 않는다 — 「값은 사는데 손잡이가 없어」가 이 파일의 고질이다):
     *   weight · lineHeight · letterSpacing · italic · strike · padH/padV · radius · widthPct.
     * ⛔G5 어두운 배경 자동 글자색(useRoleColor)은 ★이 글자에 ★안 걸었다 — 범위 밖이다. 대신 패널이
     *   「채움」과 「글자색」을 ★나란히 둬서 어두운 원 위 #555 를 사람이 한 번에 고칠 수 있게 했다. */
    if (line.imgShape === 'circle') {
      const d = h > 0 ? h : GRID_IMG_CIRCLE_D;
      const cAlign = _gridAlign(line.align, colAlign);
      const cAlignCss = cAlign === 'center' ? 'margin-left:auto;margin-right:auto;' : cAlign === 'right' ? 'margin-left:auto;' : '';
      /* ★값 검문은 «글자 줄이 쓰는 그 정규식»을 그대로 쓴다 — 새 잣대를 만들지 않는다(이 파일 GRID_ENUM/잣대 규약). */
      const cBg = (typeof line.bg === 'string' && _GRID_COLOR_RE.test(line.bg.trim())) ? line.bg.trim() : '';
      const cBgCss = cBg ? `background:${cBg};` : '';
      const cText = typeof line.text === 'string' ? line.text : '';
      let cTextHtml = '';
      if (cText !== '') {
        const tRole = _GRID_ROLES.body;   // ★줄의 type 은 'image' 라 역할표에 없다 — 본문 역할을 «빌린다»(새 상수 0)
        const tSize = Number(line.fontSize) || tRole.size;
        const tColor = (typeof line.color === 'string' && _GRID_COLOR_RE.test(line.color.trim())) ? line.color.trim() : tRole.color;
        cTextHtml = `<div class="grd-img-circle-text" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);`
          + `width:${GRID_CIRCLE_TEXT_INSET_PCT}%;box-sizing:border-box;text-align:center;`
          + `font-size:${tSize}px;font-weight:${tRole.weight};line-height:${tRole.lh};color:${tColor};`
          + `white-space:pre-wrap;word-break:keep-all;">${_esc(cText)}</div>`;
      }
      const posCss = cTextHtml ? 'position:relative;' : '';   // ⛔글자가 있을 때만 — 없으면 바이트 동일
      const box = `width:${d}px;max-width:100%;aspect-ratio:1/1;border-radius:50%;${cAlignCss}${cBgCss}${posCss}${mtCss}`;
      if (!line.imgSrc) return `<div${addrAttr} class="grd-img-frame grd-img-empty grd-img-circle" style="${box}">${cTextHtml}</div>`;
      return `<div${addrAttr} class="grd-img-frame grd-img-circle" style="${box}overflow:hidden;">`
        + `<img class="grd-img" src="${_esc(line.imgSrc)}" draggable="false" style="display:block;width:100%;height:100%;object-fit:cover;">`
        + cTextHtml
        + `</div>`;
    }
    // ★widthPct(T-C, 코너 리사이즈 핸들) — 없으면 100(기존과 바이트 동일).
    const wpRaw = Number(line.widthPct);
    const wp = Number.isFinite(wpRaw) ? Math.max(5, Math.min(100, wpRaw)) : 100;
    const widthCss = `width:${wp}%;`;
    // ⚠️<img style="display:block">엔 text-align 이 안 먹는다 — 폭을 100% 미만으로 줄이면
    //   margin-inline 없이는 항상 왼쪽에 붙는다. colAlign 은 이 줄이 속한 «셀의 유효 align»
    //   (renderGridBlock 의 pick('align') — 글자 줄과 같은 값)이라 그대로 재사용한다.
    /* ★줄 단위 정렬 (2026-09-23) — «글자 줄과 같은 우선순위»를 그대로 베낀다:
     *   줄(line.align) > 칸(colAlign) > 'left'  — 아래 «글자 가지»가 본이고, 그 한 줄을 베껴 왔다.
     *   ⛔이 주석에 그 본의 «글자 그대로»를 적지 않는다 — grid-patchcell-reject.test.js P8 이
     *     그 문자열을 «변이 닻»으로 쓰는데(첫 자리 하나만 갈아친다), 주석이 앞서면 그 양성대조가
     *     «주석 속»에 변이를 꽂게 된다. 그러면 초록이긴 한데 「렌더러가 새 필드를 읽기 시작했다」를
     *     재는 게 아니라 「주석에 글자가 있다」를 재는 것이 된다(느슨해진 걸 아무도 모른다).
     *   무엇이 있었나 — 이 가지만 colAlign 만 봤다. 그래서 「글자는 왼쪽, 이미지는 가운데」를
     *   «한 칸 안에서» 못 만들었고, 줄에 align 을 줘도 ok:true 가 돌아오는데 화면은 그대로였다.
     *   ⛔`wp < 100` 가드는 그대로 둔다 — 폭이 꽉 찬 이미지는 움직일 데가 없고, 여백을 붙이면
     *     기존 저장본의 산출만 바뀐다(바이트 동일 유지). 빈 슬롯도 같은 alignCss 를 쓰므로
     *     «같이» 적용되는 것이 의도다(발주 대기 카드가 왼쪽에 붙어 보이던 자리). */
    const align = _gridAlign(line.align, colAlign);   // ★명부 밖 값은 여기서 'left' 로 죽는다(T-170 ㈑)
    const alignCss = wp < 100
      ? (align === 'center' ? 'margin-left:auto;margin-right:auto;' : align === 'right' ? 'margin-left:auto;' : '')
      : '';
    if (!line.imgSrc) {
      // 빈 이미지 슬롯: 발주 대기 placeholder (기존 ''=투명 소실 → 카드가 깨져 보이던 문제)
      /* ★클래스만 `grd-img` → `grd-img-frame` 으로 바뀌었다(아래 ㈎ 참조).
         빈 슬롯은 «담을 그림»이 없으므로 안쪽 <img> 도, overflow 도, flex-shrink 도 안 붙는다
         (붙이면 min-height:auto 가 0 이 되던 «오늘의 동작»이 바뀐다 — 빈 div 는 원래 줄어든다).
         ⚠️여기 달려 있던 「나머지 바이트는 그대로다」는 아래 한 줄(배경) 때문에 «더는 참이 아니다» —
           그 문장을 지웠다. 바이트 동일을 잠그던 골든도 같이 옮겼다
           (tests/unit/grid-render-gaps.test.js D_GOLDEN 의 여섯 `empty` 줄). */
      /* ★무늬는 «CSS 클래스»가 갖는다 — 여기서 `background:#e8e8e8` 을 뺐다 (2026-09-25, 현빈).
         현빈 「빈 슬롯이 들어갈 수 있어야지 … 처음에 체크패턴으로 둘 수 있을 것 같은데」
         ⇒ 회색 단색을 배너02 빈 이미지칸과 «같은 관용구»(16px 체커)로 바꾼다.
         ⛔인라인으로 박지 «않는다» — .tbl-img-cell 주석이 그 함정을 적어 뒀다: 인라인이면
           저장본(.gdt)과 단독 HTML 배송본에 그대로 실린다(편집용 무늬가 배송물이 된다).
           ⇒ 값은 css/editor-blocks.css `.grid-block .grd-img-empty` 한 자리에 있고,
             배송본에서 빼는 몫은 이미 있는 중화기가 진다(capture-safety.js ·
             export-css-collect.js — 둘 다 /repeating-conic-gradient/ 같은 서명).
         ★«상자»는 그대로 인라인이다 — 높이·모서리·폭은 빈 셀이 «자리를 차지한다»는 뜻
           그 자체라 배송본에도 남아야 한다. 빠지는 것은 «무늬»뿐이다. */
      const ph = h > 0 ? h : 180;
      return `<div${addrAttr} class="grd-img-frame grd-img-empty" style="${widthCss}height:${ph}px;` +
        `border-radius:${r > 0 ? r : 8}px;${alignCss}${mtCss}"></div>`;
    }
    /* ═══ ★프레임(컨테이너) + 콘텐츠(이미지) — 에셋 블록과 «같은 구조» (2026-09-25, 커밋 ①) ═══
     *   현빈 2026-09-25: 「에셋블럭의 경우 프레임(컨테이너) 안에 콘텐츠(이미지)가 있잖아. …
     *   코너 핸들로 정하는 그 상자가 맞겠어. 에셋블럭과 구조가 같아야 된다고 보거든?
     *   코너를 끌면 통째로 작아지면 안 되는 거지.」
     *
     *   ⛔이 커밋은 «구조만» 바꾼다 — 화면 산출이 눈으로 같아야 한다. 크롭 값도, 더블클릭도,
     *     코너 핸들의 «뜻»도 여기서는 한 글자도 안 바꾼다(그건 다음 커밋이다).
     *
     * ㈎ 왜 클래스가 «프레임»으로 갔나 — `.grd-img` 를 읽는 두 자리가 둘 다 «상자»를 원한다:
     *     · js/overlay-handles.js `_gridImgFindEl` — 코너 핸들이 앉을 사각형
     *     · js/io/export-image.js `_CAPTURE_IMG_BOX_SELECTORS` — 「상대폭 + 절대높이 + cover」인 상자
     *   그 둘이 가리켜야 하는 것이 이제 프레임이다. ⇒ 프레임이 `.grd-img-frame`(＋주소 data-*),
     *   안쪽 그림이 `.grd-img` 다. ★안쪽이 `.grd-img` 를 «그대로» 들고 있는 덕에
     *   `img.grd-img` 로 그림을 세던 자들(tests/dom/grid-save-export-axes G0 등)은 안 바뀐다.
     *
     * ㈏ 왜 `overflow:hidden` 이 «인라인»인가 — CSS 파일에 두면 내보낸 HTML(js/io/export-html.js)
     *   과 캡처 클론이 그 규칙을 못 들고 간다. 이 렌더러는 원래 전부 인라인이다. 같은 결로 둔다.
     *
     * ㈐ ★⛔이 커밋은 프레임에 `overflow:hidden` 을 «안» 붙인다 — 붙이고 싶은 마음이 크지만
     *   붙이는 순간 «구조만 바꾼다»가 거짓이 된다. 실측으로 두 번 고쳐 세운 자리라 길게 적는다.
     *
     *   칸은 세로 flex 다(renderGridBlock 의 `.grd-cell`: display:flex;flex-direction:column).
     *   그래서 «행 높이가 줄 높이보다 짧은» 칸에서 줄이 쪼그라드느냐가 문제가 된다.
     *   ★옛 <img> 의 규칙 = 대체요소의 «자동 최소 크기» = min(지정 높이, 그 폭에서의 비율 높이).
     *     ⇒ 같은 height:200px 이라도 «그림 비율에 따라» 답이 갈린다. 실측
     *       (tests/dom/grid-img-frame-noop, 행 120px · 줄 height 200px · 그림 400×250):
     *         폭 50%(=180px) → 비율 높이 112.5 < 200 ⇒ 최소가 112.5 ⇒ 120 으로 «줄었다»
     *         폭 100%(=360px) → 비율 높이 225 > 200 ⇒ 최소가 200     ⇒ 200 «그대로»
     *   ★그런데 `overflow:hidden` 을 붙이면 flex 항목의 `min-height:auto` 가 통째로 0 이 된다
     *     ⇒ 비율과 무관하게 «늘 줄어든다». 그러면 폭 100% 칸이 200 → 120 으로 바뀐다.
     *   ⛔내가 처음 세운 가정은 «정반대»였다: 「옛 img 는 안 줄었을 테니 flex-shrink:0 으로
     *     막아야 한다」. 그 사본은 폭 50% 칸에서 120 이어야 할 것을 200 으로 만들었다.
     *     두 번 다 화면으로 재고서야 알았다 — 소스만 읽었으면 두 번 다 틀린 채로 갔다.
     *   ⇒ 안쪽 <img> 를 «흐름 안»에 두고 프레임 overflow 를 건드리지 않으면, 프레임의
     *     content-based 최소 높이가 그 <img> 에서 그대로 와서 «옛 규칙»이 살아 있다(실측 초록).
     *   ★클리핑(overflow:hidden)은 «크롭이 실제로 필요한» 다음 커밋에서 붙인다. 그때 이
     *     쪼그라듦 규칙이 바뀌는 것은 «구조 전환의 부수효과»가 아니라 «그 카드가 고르는 동작»이다.
     *
     * ㈑ ★모서리 반경은 «둘 다»에 찍는다 — 프레임 «과» 안쪽 그림.
     *   프레임에만 주면 아무 것도 안 잘린다(배경도 테두리도 없고 overflow 도 visible 이라
     *   그 반경이 그리는 것이 없다). 실제로 그림 모서리를 깎던 것은 옛 <img> 자신의 반경이다.
     *   실측 — 안쪽에 안 주면 반경 16 칸 24개가 전부 픽셀로 갈렸다(최대 세기 223).
     *   ⇒ 안쪽 = «오늘 실제로 자르는 자» · 프레임 = «상자의 뜻»(다음 커밋의 overflow 가 쓴다).
     *
     * ㈑ 잃는 것(정직하게 적는다)
     *   · tests/unit/grid-render-gaps.test.js 의 D_GOLDEN 12칸이 «재촬영»됐다. 옛 12줄이
     *     지키던 「이미지 줄 산출 무변화」는 이 커밋 이후로는 «새 기준선»을 지킨다.
     *     ⇒ 그래서 이 커밋에 tests/dom/grid-img-frame-noop.dom.spec.js 를 같이 세웠다 —
     *       옛 마크업 문자열과 새 렌더 산출을 «같은 칸에 나란히 놓고 화면으로» 견준다.
     *       골든이 증명을 덮는 자리를 그 자가 대신 막는다.
     *   · 중첩(depth≥1) 이미지 줄의 정렬 증인이 «<img> 태그»에서 «프레임 태그»로 옮겨갔다
     *     (alignCss 가 프레임에 실리므로). grid-render-gaps B4 가 그 자리다. */
    const radiusCss = r > 0 ? `border-radius:${r}px;` : '';

    /* ═══ ★프레임 «안»에서의 크롭 (2026-09-25, 커밋 ②) ═══════════════════════════
     *   현빈: 「원하는 부분만 프레임 안에서 보여주고 싶은데 그게 안 된다」.
     *
     * ★언제 켜지나 — «프레임이 있을 때»만이다. 높이가 auto 면 프레임이 그림 키를 그대로
     *   따라가므로 «잘릴 것»이 애초에 없다 ⇒ h > 0 이 아니면 세 값을 안 읽는다.
     *   ⛔그래서 높이 없는 줄에 크롭만 주면 updateGridBlock 이 ignoredProps 로 되돌려준다
     *     (_gridUnreadLineFields 의 민감도 탐침이 「이 줄에선 출력이 안 바뀐다」를 스스로 본다).
     *     그게 «거짓 성공»을 막는 이 레포의 규약이다 — 편집기·패널은 크롭을 켤 때 높이를 같이 준다.
     *
     * ★켜지면 «에셋 블록과 같은 기전»으로 간다 — object-fit 을 버리고 그림을 절대배치한다.
     *   에셋도 정확히 그렇게 한다: 손대기 전엔 object-fit:cover, dataset.imgW 가 생기면
     *   position:absolute + width px + left/top px (js/image-handling.js applyImageTransform).
     *   다른 것은 «단위»뿐이다 — 여기선 전부 ％다(위 GRID_IMG_SIZE_MIN 주석의 까닭).
     *
     * ⛔셋이 다 없으면 한 글자도 안 찍는다 — 커밋 ① 의 산출과 «바이트 동일»이다.
     *   (그 자리를 지키는 자: tests/dom/grid-img-frame-noop.dom.spec.js) */
    const cropSize = _gridNum(line.imgSizePct);
    const cropX    = _gridNum(line.imgPosX);
    const cropY    = _gridNum(line.imgPosY);
    const cropped  = h > 0 && (cropSize !== null || cropX !== null || cropY !== null);
    /* ★E157(10-05 현빈 「고쳐 그럼」) — 크롭 없는 그림 줄은 높이 키를 «그릴 때 무시»(저장 키 그대로 · 마이그레이션 0) → 네이티브 비율(height:auto).
       크롭 줄(imgSizePct/PosX/PosY)은 사용자가 고른 «틀»이라 높이 h 그대로(사본 0). 옛 줄: `const frameH = h > 0 ? height:h : ''`. */
    const frameH  = cropped ? `height:${h}px;` : '';

    let innerCss;
    if (cropped) {
      const sz = _gridClampPct(cropSize === null ? 100 : cropSize, GRID_IMG_SIZE_MIN, GRID_IMG_SIZE_MAX);
      const px = _gridClampPct(cropX === null ? 0 : cropX, -GRID_IMG_POS_LIMIT, GRID_IMG_POS_LIMIT);
      const py = _gridClampPct(cropY === null ? 0 : cropY, -GRID_IMG_POS_LIMIT, GRID_IMG_POS_LIMIT);
      innerCss = `position:absolute;left:${px}%;top:${py}%;width:${sz}%;height:auto;`;
    } else {
      innerCss = 'width:100%;height:auto;';   // ★E157 — 옛: h > 0 ? 'width:100%;height:100%;object-fit:cover;'(틀 높이 고정 + 잘림) : 'width:100%;height:auto;'
    }
    /* ★`position:relative;overflow:hidden` 은 «크롭이 있을 때만» 붙인다.
     *   까닭 — overflow 를 visible 밖으로 내보내면 flex 항목의 min-height:auto 가 0 이 되어
     *   «행 높이가 짧은 칸»에서 프레임이 늘 쪼그라든다. 옛 <img> 는 그림 비율에 따라 줄기도
     *   안 줄기도 했다(커밋 ① 의 ㈐ 실측). 크롭이 없는 줄까지 그 규칙을 바꿀 이유가 없다.
     *   크롭이 있는 줄은 «자른다»는 것이 이미 그 줄의 뜻이라, 그 규칙 변화도 그 뜻의 일부다. */
    const clipCss = cropped ? 'position:relative;overflow:hidden;' : '';
    /* ★모서리 반경을 «어디에» 찍나 — 크롭 여부로 갈린다. 둘 다에 찍으면 틀린 자리가 생긴다.
     *   · 크롭 없음 : 프레임에 overflow 가 없으니 «자르는 자»는 안쪽 그림 자신이다 ⇒ 안쪽에 찍는다
     *                 (프레임 쪽은 다음 사람이 읽을 «상자의 뜻»으로 같이 남긴다 — 그리는 것은 없다).
     *   · 크롭 있음 : 프레임이 overflow:hidden 으로 «자르는 그릇»이다 ⇒ 프레임만 찍는다.
     *                 ⛔안쪽에도 찍으면 프레임보다 큰 그림의 «제 모서리»가 둥글어진다 —
     *                   보이는 자리가 아닐 때가 많지만, 폭을 100% 아래로 줄이면 드러난다. */
    const innerRadius = cropped ? '' : radiusCss;
    return `<div${addrAttr} class="grd-img-frame" style="${widthCss}${frameH}${clipCss}${radiusCss}${alignCss}${mtCss}">`
      + `<img class="grd-img" src="${_esc(line.imgSrc)}" draggable="false" style="display:block;${innerCss}${innerRadius}">`
      + `</div>`;
  }
  // 중첩 duo: {type:'duo', gap, valign, cols:[{width, lines[]}]} — innercard 후기카드 등 (BL-SFB-01)
  if (line.type === GRID_NESTED_LINE_TYPE) {
    if (depth >= GRID_NESTED_MAX_DEPTH) return '';    // 무한 중첩 가드 (2단까지)
    // ⛔중첩 duo(라인 안의 duo)는 상한 3 «그대로» — 4x4 피커는 «블록» 대상이라
    //   중첩까지 넓히면 innercard 렌더 회귀 범위가 커진다(PLAN §P1 회귀위험).
    const cols = Array.isArray(line.cols) ? line.cols.slice(0, GRID_NESTED_MAX_COLS) : [];
    if (!cols.length) return '';
    const gap = Number(line.gap) || 24;
    const valign = _gridEnum(_GRID_VALIGN, line.valign) || 'flex-start';
    const colsHtml = cols.map((c, ci) => {
      const w = Number(c.width) || 1;
      /* ★중첩 안 줄에 «가리킬 이름»을 준다 (2026-09-25, T-200 커밋 ①).
         ⛔addr 은 여전히 미전달이다 — 중첩 안 줄은 `data-line` 을 «안» 가진다(함수 머리말의
           「왜 다른 이름인가」 참조). 대신 naddr 이 data-nroot/data-npath 를 싣는다.
         ★이 줄이 바깥 줄이면(addr 있음) 길이 시작되고, 이미 중첩 안이면(naddr 있음) 길이 이어진다.
           둘 다 없으면 null 이 내려가 산출이 예전과 «바이트 동일»이다(innercard 경로). */
      const inner = (Array.isArray(c.lines) ? c.lines : [])
        .map((l, ni) => _gridLineHtml(l, c.align || colAlign, depth + 1, null, useRoleColor,
          _gridNestAddr(addr, naddr, ci, ni))).join('');
      // 바깥 duo 와 «같은» 정렬 축을 쓴다 — 컬럼은 stretch, 정렬은 컬럼 안 내용(justify-content).
      return `<div class="grd-nested-col" style="flex:${w};min-width:0;display:flex;flex-direction:column;justify-content:${valign};">${inner}</div>`;
    }).join('');
    return `<div${addrAttr} class="grd-nested" style="display:flex;gap:${gap}px;align-items:stretch;${mtCss}">${colsHtml}</div>`;
  }
  // 중첩 graph: {type:'graph', items:[{label,value,barColor?}]} — 정적 가로바 렌더 (BL-SFB-01).
  // bar-h 외 chartType도 카드 내부에선 동일한 가로바 표현으로 수용 (독립 그래프는 graph-block 몫).
  if (line.type === 'graph') {
    const items = Array.isArray(line.items) ? line.items.slice(0, 10) : [];
    if (!items.length) return '';
    const barColor   = (typeof line.barColor === 'string' && line.barColor) ? line.barColor : '#2d6fe8';
    const trackColor = (typeof line.trackColor === 'string' && line.trackColor) ? line.trackColor : '#e8e8e8';
    const valueColor = (typeof line.valueColor === 'string' && line.valueColor) ? line.valueColor : '#171717';
    const labelColor = (typeof line.labelColor === 'string' && line.labelColor) ? line.labelColor : '#555555';
    const labelSize  = Number(line.labelSize) || 20;
    const valueSize  = Number(line.valueSize) || Math.round(labelSize * 1.6);
    const rows = items.map(it => {
      const v = Math.max(0, Math.min(100, Number(it.value) || 0));
      const bc = (typeof it.barColor === 'string' && it.barColor) ? it.barColor : barColor;
      return `<div class="grd-graph-item" style="margin-top:18px;">` +
        `<div style="display:flex;align-items:baseline;gap:12px;">` +
          `<span style="font-size:${valueSize}px;font-weight:800;color:${valueColor};line-height:1;">${v}%</span>` +
          `<span style="font-size:${labelSize}px;color:${labelColor};line-height:1.3;word-break:keep-all;">${_esc(it.label ?? '')}</span>` +
        `</div>` +
        `<div style="margin-top:10px;height:18px;border-radius:9px;background:${trackColor};overflow:hidden;">` +
          `<div style="width:${v}%;height:100%;border-radius:9px;background:${bc};"></div>` +
        `</div></div>`;
    }).join('');
    return `<div${addrAttr} class="grd-graph" style="width:100%;${mtCss}">${rows}</div>`;
  }
  const role = _GRID_ROLES[line.type] || _GRID_ROLES.body;
  const size = Number(line.fontSize) || role.size;
  const weight = line.weight !== undefined ? String(line.weight) : String(role.weight);
  const color = (typeof line.color === 'string' && _GRID_COLOR_RE.test(line.color.trim())) ? line.color.trim() : '';
  const align = _gridAlign(line.align, colAlign);   // ★명부 밖 값이 style 속성으로 새던 자리(T-170 ㈑)
  /* ★줄별 타이포 — 값이 «있을 때만» 역할값을 가린다(§0-⑷ 가 「role.* 만 먹는다」로 세어 둔 자리).
   *   ⛔안 준 줄의 산출은 «바이트 동일»이어야 한다 — 기존 저장 프로젝트가 로드만으로 흔들리면 안 된다
   *     (tests/unit/grid-line-typo.test.js U1-b 가 역할 폴백 생존을, U1-d 가 뱃지 분기 불변을 지킨다).
   *   ★자간 단위 비대칭은 «의도»다: 역할값은 em(크기에 비례해 따라온다), 사용자가 직접 정하면 px(고정).
   *     _typo-section 의 ${p}-ls-number 가 px 숫자라 읽고 쓰는 단위를 거기에 맞춘다. */
  const _lhN = Number(line.lineHeight);
  const lh = (Number.isFinite(_lhN) && _lhN > 0 && _lhN <= 10) ? String(_lhN) : role.lh;
  const _lsN = Number(line.letterSpacing);
  const ls = (line.letterSpacing !== undefined && line.letterSpacing !== '' && Number.isFinite(_lsN) && Math.abs(_lsN) <= 100)
    ? `${_lsN}px` : role.ls;
  const fontFamily = (typeof line.fontFamily === 'string' && _GRID_FONT_RE.test(line.fontFamily.trim()))
    ? line.fontFamily.trim() : '';
  const ffCss = fontFamily ? `font-family:${_esc(fontFamily)};` : '';
  const italicCss = line.italic === '1' ? 'font-style:italic;' : '';
  /* ★§7-ⓐ 역할 기본색 — «그리드 블록 경로에서만» 켠다(useRoleColor).
   *   ⛔이것이 «기존 저장 그리드 프로젝트 전부»의 글자색을 로드 즉시 바꾼다.
   *     데이터(data-cols)는 한 글자도 안 건드리고 «렌더 결과»만 바뀐다 ⇒ 되돌리기는
   *     커밋 revert 뿐이고 ⌘Z 로는 안 된다. 그래서 이 변경만 «따로» 커밋돼 있다.
   *   ★병명: 값이 «연했던» 게 아니라 «없어서» body{color:var(--ui-text)} = #e0e0e0
   *     (어두운 에디터 크롬용 색)이 흰 캔버스로 상속됐다 — 대비 1.32:1 로, 빈 줄
   *     안내문(#ccc, 1.61:1)보다 «더 연했다». 「바뀐다」는 「보이게 된다」와 같은 말이다.
   *
   * ⚠️★왜 «기본값 false» 인가 — 계획서 §7-ⓐ 를 그대로(무조건) 적용하면 «틀린다».
   *   이 함수는 innercard-block.js 가 «같이» 쓴다(gridLineHtml(l, align) 2-인자).
   *   그런데 innercard 는 카드 배경 휘도를 보고 `color:#f2f2f2 | #1a1a1a` 를 카드에 걸어
   *   «색 미지정 줄이 상속하게» 해 뒀다(2026-07-04 제니 발주, 「화이트카드 위 화이트」 방지).
   *   여기서 role.color(#555)를 무조건 박으면 «어두운 카드 위 짙은 회색» — 지금보다 나빠진다.
   *   ⇒ 뱃지 분기를 건드리지 않는 것과 «같은 이유»(§7-ⓐ 조건2 보강)다. 계획서가 뱃지는
   *     짚었지만 innercard 는 못 짚었고, tests/unit/grid-p1.test.js 의 골든이 그걸 잡았다.
   *   경계 둘: ⑴ line.color 를 «명시한» 줄은 안 바뀐다(U2-b) ⑵ innercard 는 안 바뀐다(U2-c).
   */
  const strikeCss = line.strike === '1' ? 'text-decoration:line-through;' : '';
  /* ★G5 — useRoleColor 가 'light' 면 «어두운 배경 위» 역할색(_GRID_ROLE_COLOR_ON_DARK). 값을 늘리지 않고 이 인자에 싣는 까닭:
   *   중첩(duo) 재귀가 useRoleColor 를 «그대로» 물려주므로 중첩 줄도 같은 톤을 받는다. true/false 산출은 «바이트 동일». */
  const effColor = color || (useRoleColor
    ? (useRoleColor === 'light' ? (_GRID_ROLE_COLOR_ON_DARK[line.type] || _GRID_ROLE_COLOR_ON_DARK.body) : useRoleColor === 'hex' ? role.color : _gridRoleColorCss(line.type, role.color))
    : '');
  // 뱃지/필: line.bg 지정 시 inline-block 필로 렌더 — 지정 bg가 조용히 탈락해
  // 카드 위 무배경 텍스트(색 반전처럼 보임)로 뭉개지던 케이스 방지 (2026-07-04 제니 발주)
  const bg = (typeof line.bg === 'string' && _GRID_COLOR_RE.test(line.bg.trim())) ? line.bg.trim() : '';
  if (bg) {
    const padV = Number(line.padV) || Math.max(6, Math.round(size * 0.4));
    const padH = Number(line.padH) || Math.max(14, Math.round(size * 1.0));
    const rad = Number.isFinite(Number(line.radius)) ? Number(line.radius) : 999;
    return `<div${addrAttr} style="text-align:${align};${mtCss}"><span class="grd-badge" style="display:inline-block;background:${bg};` +
      `font-size:${size}px;font-weight:${weight};line-height:1.2;letter-spacing:${role.ls};${color ? `color:${color};` : ''}` +
      `padding:${padV}px ${padH}px;border-radius:${rad}px;white-space:pre-wrap;word-break:keep-all;">${_esc(line.text ?? '')}</span></div>`;
  }
  /* ★안내문구 표식 (T-085, 2026-09-22 검수 실측).
     무엇이 있었나 — 이 기본 문구가 «내보낸 PNG 에 그대로 찍혔다».
       실측: rgb(85,85,85) 804픽셀 ＋ rgb(117,117,117) 66픽셀, 어두운 픽셀 1,626개가
       y 526~544 한 군데(그 자리가 이 그리드 블럭 72,519,716×35).
     까닭 — js/io/capture-safety.js hidePlaceholderTextForCapture 는 «표식이 붙은» 것만 숨기는데,
       표식이 붙은 자리가 다섯(tb-h2·bn2-label·bn2-title·bn2-sub·tb-mdl-text)뿐이고 여기엔 없었다.
     ⛔★«읽는 쪽»을 넓히지 않았다 — 「글자가 기본 문구와 같으면 숨겨라」로 고치면
       사용자가 정말 그 문장을 쓴 경우에 그 글자를 숨긴다. 그건 T-039 가 낸 사고(진짜 본문을
       가려 흰 페이지가 됨)와 «같은 방향»이다. ⇒ 쓰는 쪽에 표식을 단다.
     ★표식을 달면 읽는 쪽 술어(isStillPlaceholderText)가 나머지를 알아서 한다 —
       사용자가 «다른» 글자를 넣으면 그 술어가 「본문」으로 보고 안 숨긴다. 다른 블럭과 같은 규약이다.
     ⛔`data-placeholder` 도 같이 단다 — 그 술어가 «무엇과 견줄지»를 그 값으로 안다.
       없으면 「견줄 원문이 없다」로 보고 그냥 숨긴다(기존 동작). */
  const _isPh = (line.text ?? '') === GRID_CELL_DEFAULT_TEXT;
  const phAttr = _isPh ? ` data-is-placeholder="true" data-placeholder="${_esc(GRID_CELL_DEFAULT_TEXT)}"` : '';
  return `<div${addrAttr}${phAttr} class="grd-line grd-${_esc(line.type || 'body')}" style="font-size:${size}px;font-weight:${weight};line-height:${lh};letter-spacing:${ls};text-align:${align};${effColor ? `color:${effColor};` : ''}${ffCss}${italicCss}${strikeCss}${mtCss}white-space:pre-wrap;word-break:keep-all;">${_esc(line.text ?? '')}</div>`;
}

// ★2026-09-04 P1: flex → CSS grid(PLAN §3-A) — 행 축을 넣으려면 열끼리 «경계가 맞아야»
//   한다(스프레드시트 드래그가 목표, 5절/P2), flex 행 스택(R1안)은 그게 안 돼 탈락했다.
//   열은 이전과 «같은 비율»(가중치)이라 fr 단위로 바로 옮긴다 — flex:(pct) 1 0 → <w>fr 은
//   수학적으로 같은 분배지만 반올림 경로가 달라 1px 안팎 흔들릴 수 있다(완료조건, QA 대상).
/* ══ ★E157 + 제4안 «한 식»(2026-10-05 · 현빈 「고쳐 그럼」 · 지디 ⒜ · lane-grid-height) ══════════════════════════════
 *  트랙(행) r 의 «최소» = base + 2 × cellPadY.
 *    base = ⑴ 그 행에 칸 배경 이미지가 있고 행 높이 키가 있으면 → 칸 폭(배경이 덮는 padding 상자) × 그림 원 비율(그 행 최댓값)
 *           ⑵ 아니고 행 높이 키 H 가 있으면 → H
 *           ⑶ auto → 없음(트랙 auto · 내용 + 칸 padding 이 정함 — cellPadY 는 칸 padding 으로 이미 들어감)
 *  ★키 없음(cellPadY 0 · 배경 칸 없음)이면 옛 산출 `minmax(Hpx, auto)` / `auto` 그대로 = 바이트 같음.
 *  ⛔행 높이를 다른 자리에서 따로 셈하지 마라 — 렌더(rowTemplate)와 배경 행 다시 세우기가 이 함수 «하나»를 부른다. */
export function gridTrackMin(H, bgBase, padY) {
  const base = (typeof bgBase === 'number' && bgBase >= 0) ? bgBase : ((typeof H === 'number' && H >= 0) ? H : null);
  return base === null ? null : base + 2 * (Number(padY) || 0);
}
const _gridTrack = (H, bgBase, padY) => { const m = gridTrackMin(H, bgBase, padY); return m === null ? 'auto' : `minmax(${m}px, auto)`; };

/* ★그림 원 비율 캐시 «한 자리» — src → 높이/폭. 모르면 읽고(decode) 다 되면 그 그림을 기다리던 그리드만 다시 그린다(처음엔 H+2Y 로 섰다가 한 번 바뀜).
 *  ⛔비율을 저장 데이터에 «안» 남긴다(파생값이 저장에 굳는 E144 병 — 지디 ⒝ 탈락 까닭). 내보내기는 whenGridRatiosSettled 로 기다린다. */
const _gridRatio = new Map();          // src → number(높이/폭) | null(못 읽음)
const _gridRatioLoads = new Map();     // src → Promise(읽는 중 · 다 되면 다시 그린 «뒤» 끝남)
const _gridRatioWaiters = new Map();   // src → Set<block>
function _gridRatioOf(src, block) {
  if (_gridRatio.has(src)) return _gridRatio.get(src);
  let ws = _gridRatioWaiters.get(src); if (!ws) { ws = new Set(); _gridRatioWaiters.set(src, ws); } ws.add(block);
  if (!_gridRatioLoads.has(src) && typeof Image !== 'undefined') {
    const im = new Image(); im.src = src;
    const p = (typeof im.decode === 'function' ? im.decode() : new Promise((res, rej) => { im.onload = res; im.onerror = rej; }))
      .then(() => { _gridRatio.set(src, im.naturalWidth > 0 ? im.naturalHeight / im.naturalWidth : null); })
      .catch(() => { _gridRatio.set(src, null); })
      .then(() => {
        const bs = _gridRatioWaiters.get(src); _gridRatioWaiters.delete(src); _gridRatioLoads.delete(src);
        let drew = false;
        if (bs) bs.forEach(b => { if (b.isConnected) { try { renderGridBlock(b); drew = true; } catch (_) {} } });
        if (drew) _gridRestampAfterSettle();
      });
    _gridRatioLoads.set(src, p);
  }
  return undefined;
}
/* ★C4-settle-restamp(2026-10-06 · APPROVED_BY: 지디 C4-settle-restamp ⒜) — 디코드가 «늦게» 끝나 정착(gridTemplateRows)이 쓰이면
 *   ⌘Z 기록의 꼭대기(push-after 끝 표본)를 그 값으로 «다시 찍는다»(새 칸 0 — restampHistoryTop 은 칸을 안 만든다).
 *   왜: 꼭대기 ≠ 라이브면 ⌘Z 의 ensureHistoryCheckpoint 가 새 칸을 쌓고 «그림 있는» 끝 표본으로 되돌린다 —
 *     느린 디코드(500ms)에서 ⌘Z 한 번이 아무것도 안 했다(5/5 · 0ff05430 0/5). model-update-history 의 2 rAF 뒤 restamp 는 그보다 이르다.
 *   ⛔이 자리는 «디코드 끝» 갈래뿐이다 — _gridSettleBgTracks(동기 렌더) 안에서 부르면 updateGridBlock 의 push-before 표본(S0)을
 *     «그림 있는» 값으로 덮어 ⌘Z 가 통째로 깨진다.
 *   ⛔누른 포인터가 있으면(드래그 제스처 중) 안 한다 — 그 꼭대기는 제스처의 «시작 표본»일 수 있다(덮으면 그 드래그를 못 되돌린다).
 *     남는 틈(㉢): 키보드 제스처(슬라이더 화살표 첫 input ~ change 사이)에 디코드가 끝나면 그 시작 표본을 덮을 수 있다. */
let _gridPointerDown = 0;
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('pointerdown', () => { _gridPointerDown++; }, true);
  const up = () => { _gridPointerDown = 0; };
  document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true);
}
function _gridRestampAfterSettle() {
  if (_gridPointerDown > 0 || typeof window === 'undefined') return;
  try {
    const tip = window.getHistoryTip?.();
    if (tip && !tip.empty && tip.seq != null) window.restampHistoryTop?.(tip.seq);
  } catch (_) {}
}
/* 렌더 «뒤»(레이아웃이 선 뒤) 배경 행만 트랙을 다시 세운다 — 칸 폭은 그려져야 안다. 배경 행이 없으면 아무것도 안 한다. */
function _gridSettleBgTracks(block, bgRows, rows, padY) {
  if (!Object.keys(bgRows).length) return;
  const inner = block.querySelector(':scope > .grd-inner'); if (!inner) return;
  let changed = false;
  const tracks = rows.map((row, r) => {
    const H = row.height === 'auto' ? null : row.height;
    const list = bgRows[r];
    if (!list) return _gridTrack(H, null, padY);
    let base = null;
    for (const { c, src } of list) {
      const ratio = _gridRatioOf(src, block);
      if (typeof ratio !== 'number') continue;
      const cell = inner.querySelector(`:scope > .grd-cell[data-r="${r}"][data-c="${c}"]`);
      const w = cell ? cell.clientWidth : 0;
      if (w > 0) base = Math.max(base ?? 0, Math.round(w * ratio));
    }
    if (base !== null) changed = true;
    return _gridTrack(H, base, padY);
  });
  if (changed) inner.style.gridTemplateRows = tracks.join(' ');
}
/* ★내보내기·캡처 입구의 «공용 대기» — 칸 배경 비율이 다 서고 그 그리드가 다시 그려질 때까지.
 *  반환 셋(⛔섞지 마라): {status:'none'} = 기다릴 것 없음(안 지남) · {status:'settled', ms} = 기다렸고 다 됨 · {status:'cap', pending, ms} = 상한 — 안 읽힌 수·주소를 찍고 돌아옴.
 *  상한 = GRID_RATIO_WAIT_CAP_MS(⚠️임시 3000 — 큰 그림 최악 디코드 실측 뒤 정함). */
export const GRID_RATIO_WAIT_CAP_MS = 3000;
export async function whenGridRatiosSettled({ capMs = GRID_RATIO_WAIT_CAP_MS } = {}) {
  if (!_gridRatioLoads.size) return { status: 'none' };
  const t0 = Date.now(); let timer = null;
  const capP = new Promise(res => { timer = setTimeout(() => res('cap'), Math.max(0, capMs)); });
  const allP = Promise.all([..._gridRatioLoads.values()]).then(() => 'done');
  const r = await Promise.race([allP, capP]); clearTimeout(timer);
  if (r === 'done') {
    const spent = Date.now() - t0;
    if (_gridRatioLoads.size && spent < capMs) {   // 다시 그림이 새 읽기를 불렀으면 남은 상한 안에서 한 번 더
      const again = await whenGridRatiosSettled({ capMs: capMs - spent });
      if (again.status === 'cap') return { ...again, ms: Date.now() - t0 };
    }
    return { status: 'settled', ms: Date.now() - t0 };
  }
  const left = [..._gridRatioLoads.keys()].map(x => String(x).slice(0, 120));
  console.warn(`[whenGridRatiosSettled] 상한 ${capMs}ms — 아직 안 읽힌 그림 ${left.length}개`, left);
  return { status: 'cap', pending: left, ms: Date.now() - t0 };
}

function renderGridBlock(block) {
  const { cols, rows, cells } = getGridModel(block);
  const { row: rowGapPx, col: colGapPx } = _gridGaps(block);
  const blockValign = _gridEnum(_GRID_VALIGN, block.dataset.valign) || 'flex-start';
  const cellBorder = _gridCellBorder(block);   // ★T-172 — «블록» 축. 칸 축(pick)과 섞지 않는다.
  const cellPadY = getGridCellPadY(block);     // ★제4안 — 모든 칸 위아래에 «더함»(0 이면 칸 style 바이트 그대로)

  /* ★오버레이(떠 있음)면 폭을 «굳힌 px» 그대로 둔다 — 띄울 때 overlay-float.js _freezeWidth 가 px 로 굳히는데,
     아래 100% 를 그대로 박으면 다음 렌더(열 간격 등)가 그 폭을 «섹션 전폭»으로 펴 버린다(현빈 2026-10-01 그리드 오버레이).
     그리고 떠 있는 동안엔 「좌우 패딩 제외」를 안 건다 — 띄울 때 음수 마진을 걷어 두는데(_freezeMargins) 다시 걸면
     자리가 패딩만큼 밀린다. ⇒ 이 줄의 조건은 «둘»이다(떠 있음 · 패딩 제외). 둘 다 참일 때 = 떠 있음이 이긴다. */
  const floating = block.dataset.overlayBlock === 'true';
  /* ★G2-a 자체 너비 — 우선순위: 떠 있음(굳힌 폭) > data-grid-width > 100%.
     키가 있으면 「좌우 패딩 제외」(calc(100%+2·pad))와 «같이 설 수 없다» — 명시 폭이 이긴다.
     그래서 패딩제외의 흔적(음수 마진·calc 폭)을 걷고 그 함수는 «안» 부른다. ⛔dataset.fullBleed 는 안 지운다
     (켬/끔 상태는 사용자 것이다 — 키를 지우면 다시 패딩제외로 돌아간다). */
  const ownW = floating ? null : getGridWidth(block);
  if (ownW !== null) {
    if (block.dataset.fullBleed === 'true') window.clearBlockFullBleed?.(block);
    block.style.width = ownW + 'px';
  } else if (!floating) block.style.width = '100%';
  else if (block.dataset.overlayFrozenWidth) block.style.width = block.dataset.overlayFrozenWidth;
  /* ★K1 ⒝(2026-10-05 지디 · lane-f-grid) — 그려지는 폭 = min(키, 부모 내용 폭). «그릴 때» 한 자리에서만 죈다 — 키는 안 죈다
     (부모가 넓어지면 따라 커지고 · 저장·다시 열기에 키 3000 이 그대로 남는다). 패널·손잡이·MCP·읽는 문 넷 다 키에 쓰고 이 렌더로 그려진다.
     키가 없거나(100%) 떠 있으면 «안» 건다 — 옛 저장본 style 바이트 동일(값이 없던 자리에 '' 대입 = 선언 없음 그대로). */
  if (ownW !== null) block.style.maxWidth = '100%';
  else if (block.style.maxWidth) block.style.maxWidth = '';
  block.style.boxSizing = 'border-box';
  _gridApplyBlockOutline(block);   // ★G17 블럭 외곽선 — 키 없으면 아무것도 안 만진다(옛 저장본 바이트 동일)
  _gridApplyBlockBgStacking(block);   // ★G12 블럭 배경 — 켰을 때만 isolation(끄면 흔적만 걷는다)
  /* ★「좌우 패딩 제외」가 켜져 있으면 폭을 다시 건다 — 위 한 줄이 폭만 100% 로 되돌리고 음수 마진은 남겨서
     다시 그릴 때마다(열 간격 끌기 등) «왼쪽은 붙고 오른쪽만 패딩»이 됐다(현빈 2026-10-01, grd_ts0he_lvy913j).
     꺼져 있으면 이 함수는 아무것도 안 만진다(drag-utils 규약). */
  if (!floating && ownW === null) window.applyBlockFullBleed?.(block);

  const colTemplate = cols.map(c => `${Number(c.width) > 0 ? Number(c.width) : 1}fr`).join(' ');
  /* 칸 사이 괘선 — 루프 «밖»에서 한 번 읽는다(칸마다 dataset 을 다시 파싱하지 않는다). */
  const rules = _gridRules(block, cols.length, rows.length);
  // ★행 높이는 «가중치»가 아니라 px 최소높이(minmax) — 3-A U5a 의미론. 'auto' 행은 내용 높이 그대로.
  const rowTemplate = rows.map(r => _gridTrack(r.height === 'auto' ? null : r.height, null, cellPadY)).join(' ');   // ★한 식(gridTrackMin) — 키 없으면 옛 산출 그대로
  const bgRows = {};   // ★E157 — 높이 키 있는 행의 배경 칸 { r: [{c, src}] } · 렌더 뒤 _gridSettleBgTracks 가 쓴다

  /* ★G5 글자 톤 — 블럭 자리의 실제 배경(섹션/프레임, computed)을 한 번 재고, 칸 배경이 있으면 그 위에 합성해 칸마다 가른다.
     못 재면(떼어진 노드·그라데이션·이미지) null → 역할색 그대로(지금과 같음).
     ★자동 색은 «렌더 결과(인라인 color)»에만 산다 — data-cols 는 안 바뀐다. data-text-tone 은 관찰자가 「다시 그릴까」를 가르는 파생 표식. */
  /* ⛔import 하지 않고 전역으로 받는다 — 이 파일을 tmpdir 로 베껴 도는 단위시험 18개가 import 줄을 «글자로» 갈아 끼운다.
     새 import 를 늘리면 그 사본이 전부 못 뜬다. canvas-contrast.js 는 앱 부팅에 늘 실린다(prop-page·save-load 가 import).
     없으면(단위시험) 톤 = null → 역할색 그대로 = 오늘과 바이트 동일. 앱에 실렸는지는 DOM 시험 T0 이 «전제»로 단언한다. */
  const _tt = globalThis.__gdTextTone;
  const backdropRgbAt = _tt ? _tt.backdropRgbAt : () => null;
  const textToneOver = _tt ? _tt.textToneOver : () => null;
  /* ★G12 — 톤을 재기 «전»에 배경 층을 이번 모델로 맞춰 둔다(켤 때 첫 렌더엔 층이 아직 없고, 끌 때는 옛 층이 남아 있다).
     판정은 canvas-contrast 의 backdropRgbAt 이 «층의 계산된 값»으로 한다 — 관찰자(textToneAt)와 «같은 자»라 서로 안 다툰다.
     ⛔꺼져 있고 층도 없으면 DOM 을 안 만진다(옛 저장본 바이트 동일). */
  _gridSyncBgLayer(block, _gridBlockBgHtml(block));
  const _under = backdropRgbAt(block);
  const _blockTone = textToneOver(_under);
  if (block.dataset) {
    if (_blockTone === 'light') block.dataset.textTone = 'light';
    else delete block.dataset.textTone;
  }
  const _cellTone = (bg) => {
    if (!bg) return _blockTone === 'light' ? 'light' : true;
    const rgb = backdropRgbAt(block, bg);
    /* ★E127 ⒜(지디 10-06 · ⑴) — 칸이 «자기 배경을 칠하면» 프리셋 변수를 쓰지 않는다: 'hex' = 그 배경에 맞는 옛 hex(role.color).
     *   프리셋은 «섹션 배경»에 맞춰 고른 색이라, 칸이 제 배경을 칠한 줄엔 맞지 않는다(어두운 섹션 프리셋 + 흰 칸 → 흰 위 흰 · 옅은 회색).
     *   조건은 «설정됐나» 하나 — 어두운 칸은 원래도 on-dark 표('light')라 «밝을 때만»과 같은 결과(㉢ 잼).
     *   칸 «배경 이미지»(cellImg)도 같은 조건(지디 10-06) — 부르는 자리에서 'hex'. ⛔이미지 위 결과를 «맞는 색»이라 하지 않는다: dev 와 같은 값일 뿐. */
    return textToneOver(rgb) === 'light' ? 'light' : 'hex';
  };
  const cellsHtml = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      const cell = (cells[r] && cells[r][c]) || {};
      /* 셀 속성 우선순위: cell > col > block(valign) — PLAN §3-A.
         ~~[폐기 · T-178 2026-09-23] 「행 0 은 cell===col 이라 pick()이 늘 col 값을 돌려준다」~~
           까닭 — 이제 행 0 칸도 cells[0][c] 라는 «자기 값»을 갖는다. 그래서 pick 이 «진짜로»
           갈린다(칸 값 → 없으면 열 기본값). 코드는 그대로 모든 행에 «같은 코드»로 맞다.
         ⛔이 표현식은 한 글자도 바꾸지 마라 — 이것이 곧 「열 기본값」기능이고,
           grid-patchcell-reject.test.js P7 이 `pick('…')` 를 «파싱해» 명부와 대조한다.

         ★★pick 위에서 «네 값»이 갈린다. 「열 기본값 UI」를 만들 사람이 다시 조사하지
           않도록 여기 못박는다 (2026-09-23 실측 · tests/dom/grid-cell-clear-contract.dom.spec.js):
             ⑴ 키 없음    → «열 기본값을 따른다»(폴백이 col[k] 를 돌려준다)
                ★patchCell 에 `null` 또는 `undefined` 를 주면 키가 «지워져» 이 상태가 된다
                  (_gridApplyCellDeco). `null` 이 JSON 으로 닿는 유일한 길이다.
             ⑵ '' 또는 0  → 값은 «있다». 폴백이 안 걸리고, 아래에서 이렇게 갈린다:
                  bg:''             → _GRID_COLOR_RE 불통과 → «배경 없음»(열 값 무시)
                  padding/radius:'' → Number('')||0 → 0 («여백 없음» 강제)
                  align:''          → text-align:'' 가 아니라 _gridLineHtml 의 `line.align || colAlign`
                                       로 내려가 결국 'left' 강제
                  valign:''         → _GRID_VALIGN[''] 가 undefined → blockValign 강제
             ⑶ 실제 값     → 그 값
           ⇒ 「이 칸만 열 기본값을 «끈다»」는 ⑵, 「열 기본값으로 되돌린다」는 ⑴이다.
             패널의 「비우기」는 ⑴을 보낸다(js/props/prop-grid.js 의 _grdUnset = `null`). */
      const pick = (k) => (cell[k] !== undefined ? cell[k] : col[k]);
      const lines = Array.isArray(cell.lines) ? cell.lines : [];
      const align = pick('align');
      // ★세로 정렬의 축 = «셀 박스»가 아니라 «셀 안의 내용» (2026-09-03 fix/duo-layout-align 계승).
      //   그리드 아이템은 기본 stretch(칸을 꽉 채움) + 셀 내부 justify-content 로 «내용»을 배치.
      const cv = _gridEnum(_GRID_VALIGN, pick('valign')) || blockValign;
      const bgRaw = pick('bg');
      const bg = (typeof bgRaw === 'string' && _GRID_COLOR_RE.test(bgRaw.trim())) ? bgRaw.trim() : '';
      const pad = Number(pick('padding')) || 0;
      const rad = Number(pick('radius')) || 0;
      /* ★G4 칸 배경 이미지 — 롱핸드로, 배경색 축약(background:) «뒤»에 붙인다(앞이면 축약이 이미지를 지운다).
         ⛔background 축약 금지 — HTML 내보내기는 [style*="background-image"] 만 goya-asset 을 푼다(G12 B4 와 같은 함정).
         값 잣대는 G12 블럭 배경과 같다(_GRID_BG_IMG_RE · _gridNormBgPos) · 맞춤 명부는 에셋 fit 과 같다(GRID_BG_FIT_VALUES).
         ⛔z-index·isolation 을 «안» 만든다 — 칸 style 에 배경 속성만(RG5 꼴 없음). */
      const imgRaw = pick('bgImg');
      const cellImg = (typeof imgRaw === 'string' && _GRID_BG_IMG_RE.test(imgRaw)) ? imgRaw : '';
      const fitRaw = pick('bgFit');
      const cellFit = GRID_BG_FIT_VALUES.includes(fitRaw) ? fitRaw : 'cover';
      const cellPos = _gridNormBgPos(pick('bgPos')) || 'center center';
      const imgCss = cellImg ? `background-image:url('${cellImg}');background-size:${cellFit};background-position:${cellPos};background-repeat:no-repeat;` : '';
      if (cellImg && rows[r] && rows[r].height !== 'auto') (bgRows[r] = bgRows[r] || []).push({ c, src: cellImg });   // ★E157
      // ★각 라인에도 좌표를 심는다(data-r/data-c/data-line) — 현빈 2026-09-04 지시.
      //   ★2026-09-05 P1.5 부터 «실제로 읽는 소비자»가 있다: js/block-drag.js 의 캔버스 인라인 편집이
      //   blur 때 「어느 셀 몇 번째 줄인가」를 DOM 순서 추측 없이 여기서 바로 읽어 patchCell 로 커밋한다.
      // ★grd-cell-empty(T-A) — 아직 줄이 하나도 없는 칸. CSS 안내문(+ 내용 추가)과 클릭 판정
      //   (block-drag.js _gridAddrAt)이 「진짜 빈 칸」을 이 표식으로 가른다.
      const emptyCls = lines.length === 0 ? ' grd-cell-empty' : '';
      /* ★빈 칸이 «자리»를 차지한다 (T-230 후속, 현빈 0927 ㈏ 「틀이 보이게 나가게」).
       *   2026-09-27 부터 블럭의 «모든» 칸을 비울 수 있다. 그때 내보낸 결과물에서 그 블럭의
       *   높이가 «0» 이 되어 통째로 안 보였다(실측: 캔버스 19px → 내보내기 클론 0px).
       *   캔버스의 19px 는 안내문(`+ 내용 추가`)이 만든 것이고, 그 안내문은 `#canvas` 스코프라
       *   배송본에 «일부러» 안 나간다 ⇒ 자리를 만들 것이 하나도 안 남는다.
       * ⛔CSS 로는 못 준다 — 이 인라인이 언제나 이긴다(`#canvas … {min-height:48px}` 가
       *   죽어 있는 까닭도 같다). 그래서 «여기서» 준다. 선례는 `.grd-img-empty` 다:
       *   「★«상자»는 여전히 인라인이다 — 빈 셀이 자리를 차지한다는 뜻 그 자체라 배송본에도 남는다」.
       * ★왜 14px 인가 — `.bn2-line-empty`(배너 빈 줄)와 같은 값·같은 뜻.
       *   ⛔48px 이 아니다: 캔버스의 빈 칸까지 커져 현빈 T-229 결정(「얇은 채로 둔다」)을 뒤집는다.
       * ★★T-229 와 «왜» 안 부딪히나 — 근거는 «수»가 아니라 `min-height` 라는 **성질**이다.
       *   `min-height` 는 «내용이 더 크면 내용이 이긴다». 캔버스에는 `::before` 안내문
       *   (「+ 내용 추가 (T/G/K)」)이 «내용»으로 들어가므로, 그 높이가 이 값 이상인 한
       *   캔버스 높이는 이 규칙과 «무관»하다. 배송본에는 그 안내문이 `#canvas` 스코프라
       *   안 나가서 이 값이 드러난다. ⇒ 한 값이 두 자리에서 «다르게» 일한다.
       *   ⛔「14 < 19 니까 괜찮다」로 적지 마라 — 19 는 그날 그 글꼴의 «실측»이라 늙는다.
       *     안내문 글자·글꼴·줄높이가 바뀌면 그 수는 흔들리지만 위 성질은 안 흔들린다.
       *   ★지키는 그물: grid-cell-emptied.dom.spec.js 의 I ⑵ — 「이 규칙이 있을 때와 «없을 때»
       *     캔버스 높이가 같은가」를 잰다(수를 안 쓴다). 48 로 바꿔 보면 빨개진다(2026-09-27 확인).
       * ★내용이 있는 칸은 0 그대로다 — flex 아이템의 기본 min-height:auto 를 풀어 두는 관용구라
       *   값을 바꾸면 «넘치는 내용»이 안 줄어든다. 빈 칸엔 줄일 내용이 없어 안전하다.
       * ⛔단위를 «붙여서» 만들지 마라(`${n}px` 꼴) — 내용이 있는 칸까지 `min-height:0` 이
       *   `0px` 로 바뀐다. 화면은 같지만 산출 «바이트»가 달라져 골든(G2)이 빨개진다.
       *   2026-09-27 에 실제로 그랬고, 그때 내가 바로 윗줄에 「내용이 있는 칸은 0 그대로다」라고
       *   «적어 두고도» 산출은 달랐다.
       *   ⇒ ★바꾸려는 것보다 넓게 바뀌었는지는 «골든이» 말해 준다. 주석은 안 말해 준다. */
      const cellMinH = lines.length === 0 ? `${GRID_EMPTY_CELL_MIN_H}px` : '0';
      /* ★칸 «사이» 괘선(현빈 0930) — 끄면 «빈 문자열»이라 옛 산출과 바이트 동일하다.
         `position:relative` 도 줄이 있을 때만 붙는다(있으면 절대배치 자식의 기준이 된다).
         ⛔줄 div 는 «줄(line)들보다 앞»에 둔다 — 흐름에 안 끼는 absolute 라 자리는 안 먹고,
           먼저 그려져 내용 뒤에 깔린다(내용이 줄 위로 온다). */
      const ruleHtml = _gridCellRuleHtml(rules, r, c, cols.length, rows.length, Math.max(0, rowGapPx), colGapPx);
      const pullUp = rowGapPx < 0 && r > 0 ? `margin-top:${rowGapPx}px;` : '';   // 음수 행 간격 = 위 줄로 당긴다(GRID_ROW_GAP_MIN 주석)
      cellsHtml.push(`<div class="grd-cell${emptyCls}" data-r="${r}" data-c="${c}" style="min-width:0;min-height:${cellMinH};display:flex;flex-direction:column;justify-content:${cv};${ruleHtml ? 'position:relative;' : ''}${bg ? `background:${bg};` : ''}${imgCss}${cellPadY > 0 ? `padding:${pad + cellPadY}px ${pad}px;` : (pad > 0 ? `padding:${pad}px;` : '')}${rad > 0 ? `border-radius:${rad}px;` : ''}${_gridCellBorderCss(cellBorder, r, c, rowGapPx, colGapPx)}${pullUp}">
        ${ruleHtml}${lines.map((l, li) => _gridLineHtml(l, align, 0, { r, c, li }, cellImg ? 'hex' : _cellTone(bg))).join('')}
      </div>`);
    }
  }

  /* ★G19 — «격자 껍데기(.grd-inner)»만 다시 그리고, 그리드 밑에 쌓인 자식 블럭 그릇(.grd-children)은 남긴다.
     옛 줄은 `block.innerHTML = …` 통째 교체라 재렌더(칸 편집·폭·로드·rebindAll)마다 자식이 지워졌다(측정 M1·M2).
     ⛔html 문자열은 «옛 줄 그대로»다 — 자식이 없으면 replaceShellKeepChildren 이 옛 줄과 «같은 대입»을 한다
       ⇒ 기존 그리드 렌더 바이트 동일(지키는 시험: grid-block-width-model W0 · grid-children-shell-bytes). */
  /* ★G12 — 배경 층은 셸 «맨 앞»(꺼지면 '' ⇒ 옛 줄과 바이트 동일). 셸이라 매 렌더 «데이터에서» 다시 선다. */
  replaceShellKeepChildren(block, `${_gridBlockBgHtml(block)}<div class="grd-inner" style="display:grid;grid-template-columns:${colTemplate};grid-template-rows:${rowTemplate};row-gap:${Math.max(0, rowGapPx)}px;column-gap:${colGapPx}px;width:100%;">
    ${cellsHtml.join('')}
  </div>`, GRID_CHILDREN_CLASS);
  _syncGridAddBtns(block);   // ★G15 — ＋ 흐림·자리 맞추기(＋ 는 블럭 밖 층 — 블럭 DOM 은 안 건드린다 ⇒ 렌더 바이트 불변)
  _gridSettleBgTracks(block, bgRows, rows, cellPadY);   // ★E157 — 배경 행 트랙 = 칸 폭 × 원 비율 + 2Y(배경 행 없으면 아무것도 안 함)
}

/* ═══ ★G19 공용 — «껍데기만» 갈아끼우고 «자식 그릇»은 남긴다 (지디 2026-10-03 설계 확정) ══════════════
 *  block 의 직계 자식 중 `:scope > .{keepClass}` «하나»를 뺀 나머지만 지우고, html 을 그 «앞»에 넣는다.
 *  ★그릇이 없거나 «비어» 있으면(요소 자식 0개) = 옛 줄 그대로 `block.innerHTML = html` — 한 바이트도 안 바뀐다.
 *    빈 그릇은 이때 같이 걷힌다(자식을 다 빼낸 그리드는 다음 렌더에서 옛 모양으로 돌아온다).
 *  ★그리드가 첫 손님이다(GRID_CHILDREN_CLASS). 모달(modal-block.js:505 `block.innerHTML = html`)도 같은 병인데
 *    그쪽은 M1 레인 몫이라 여기서 바꾸지 «않는다» — 같은 함수를 window 로도 내 둔다.
 *  ⚠️자리가 grid-block.js 인 까닭: Node 단위시험 15개가 이 파일을 tmp 로 복사해 import 줄을 «글자로» 바꿔 끼운다.
 *    새 모듈을 import 하면 그 15개가 tmp 에서 상대경로를 못 찾는다(코드 읽기 — 각 시험의 src.replace 닻 참조).
 *  @returns {Element|null} 남긴 그릇(없으면 null) */
export const GRID_CHILDREN_CLASS = 'grd-children';
export function replaceShellKeepChildren(block, html, keepClass) {
  let keep = null;
  for (const ch of block.children) { if (ch.classList.contains(keepClass)) { keep = ch; break; } }
  if (!keep || keep.childElementCount === 0) { block.innerHTML = html; return null; }
  for (const n of [...block.childNodes]) if (n !== keep) n.remove();
  keep.insertAdjacentHTML('beforebegin', html);
  return keep;
}
if (typeof window !== 'undefined') window.replaceShellKeepChildren = replaceShellKeepChildren;

/* ── 옛 셸 정체성 승격 (2026-09-05 개명) ───────────────────────────────
   선례 = js/io/save-load.js migrateColsFromDOM 의 `.sub-section-block → .frame-block`.
   ★바꾸는 것은 «셸 2속성»뿐이다: class · data-type.
     하위 클래스(duo-line/duo-inner/duo-cell…)는 «스냅샷»이라 안 건드린다 — renderGridBlock 이
     block.innerHTML 을 dataset 에서 통째로 다시 그린다(저장본에 P1 이전 클래스 duo-col 이
     그대로 남아 있는데 아무 문제가 없는 이유가 이것이다).
   ★id 는 «절대» 안 바꾼다 — id 는 참조다(이력 diff·collab op·클립보드가 그 값을 쥐고 있다).
     옛 블록은 승격 후 `class="grid-block" id="duo_…"` 가 된다. 이게 «정상»이다.
   ★멱등이어야 한다 — 협업·undo 가 같은 DOM 을 여러 번 지나간다. */
export const LEGACY_GRID_CLASS = 'duo-block';
export const LEGACY_GRID_TYPE  = 'duo';
// ★그리드 블록의 id 접두 «전부». 옛 duo_ 는 영구 승인 접두다(재작성 금지).
//   지금 이걸 «읽는» 코드는 없다 — MCP 에 grid 가 등록되는 날 BLOCK_TYPES 2행이 여기서 온다.
export const GRID_ID_PREFIXES = ['grd_', 'duo_'];

export function migrateGridIdentity(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  const targets = [...root.querySelectorAll('.' + LEGACY_GRID_CLASS)];
  // ★root 자신이 블록일 수 있다 — _bindPastedEl(el) 의 el, bindBlock(block) 의 block.
  if (root.classList && root.classList.contains(LEGACY_GRID_CLASS)) targets.unshift(root);
  for (const el of targets) {
    el.classList.replace(LEGACY_GRID_CLASS, 'grid-block');
    if (el.dataset && el.dataset.type === LEGACY_GRID_TYPE) el.dataset.type = 'grid';
    // ⛔el.id 는 건드리지 않는다.
  }
  return targets.length;   // 승격 «건수» — 안전망 warn 과 단위테스트가 이 값을 본다.
}

/* ═══ ★「만드는 문」이 «눌러 맞춘 것»을 말하게 한다 (2026-09-24, 지디 실기 관측) ══════════
 *  ★무엇이 있었나 — 「고치는 문」과 「만드는 문」이 «같은 값»에 다른 답을 했다(실측):
 *      cols 6개  → update: ok:false INVALID   /  add: ok:true · 조용히 4로 잘림
 *      rows 6개  → update: ok:false INVALID   /  add: ok:true · 조용히 4로 잘림
 *      valign:'중간' → update: ok:false        /  add: ok:true · 조용히 'top'
 *      gap:999   → update: ok:false(0~200)     /  add: ok:true · ★999 가 «그대로 저장된다»
 *      rowGap:999→ update: ok:false            /  add: 조용히 «안 써진다»(gap 으로 떨어짐)
 *    ⇒ T-175 의 제목 그대로다 — 「무엇이 옳은 값인지 아무도 모른다」.
 *  ⛔★동작은 «한 바이트도» 안 바꾼다 — 자르고 눌러 맞추는 것은 그대로다.
 *    까닭 ⑴ T-180 이 이 모양의 처방을 «말을 시킨다»로 못박았다(막으라고 안 했다).
 *         ⑵ T-176 선례 — 자르는 것이 «정해진 동작»이면 바꾸지 말고 적는다.
 *         ⑶ 만들기를 «거절»로 바꾸면 오타 하나에 블록이 «안 생긴다». 지금 되던 자동화가
 *            깨지는데, 그걸 시킨 카드가 없다. ⛔고치는 문과 달리 여기엔 «지킬 옛 값»이 없다.
 *  ⚠️⛔`gap` 만은 «자르지도» 않는다 — 999 가 그대로 앉는다. 그러면 고치는 문(0~200)으로는
 *    영영 못 되돌리는 값이 생긴다(「만들 수는 있는데 고칠 수는 없는 값」). 동작을 안 바꾸는
 *    이 판에선 «말만» 하고 남긴다 — 자를지 말지는 따로 설 카드다.
 *  @param {Array} [drops]  «안 닿은 것»을 담을 자리. 안 주면 예전과 완전히 같다(조용).
 * ═══════════════════════════════════════════════════════════════════════════════════ */
function makeGridBlock(opts = {}, drops = []) {
  const block = document.createElement('div');
  block.className = 'grid-block';
  block.id = genId('grd');
  block.dataset.type = 'grid';
  let cols = (Array.isArray(opts.cols) && opts.cols.length >= MIN_COLS) ? opts.cols.slice(0, MAX_COLS) : JSON.parse(JSON.stringify(GRID_DEFAULTS.cols));
  if (Array.isArray(opts.cols) && opts.cols.length > MAX_COLS) {
    drops.push({ path: `cols[${MAX_COLS}..${opts.cols.length - 1}]`,
      why: `a grid holds ${MIN_COLS}~${MAX_COLS} columns — the rest were dropped (update_grid_block REFUSES the same value; this door clamps it)` });
  } else if (opts.cols !== undefined && !(Array.isArray(opts.cols) && opts.cols.length >= MIN_COLS)) {
    drops.push({ path: 'cols', why: `cols must be an array of ${MIN_COLS}~${MAX_COLS} columns — it was ignored and the default 2-column grid was built instead` });
  }
  /* ═══ ★`gap` 도 «자르되 말한다» — 만드는 문의 규칙에 맞춘다 (2026-09-24, ⓑ 지디 권한 판정) ═══
   *  ~~[폐기 · 2026-09-24] 「⚠️`gap` 만은 «자르지도» 않는다 — 999 가 그대로 앉는다 … 말만 하고 남긴다」~~
   *    ★옛 문장을 «남겨 둔다» — 그때는 「동작을 안 바꾸는 판」이었고 그 판단은 그 판에서 옳았다.
   *  ★왜 뒤집었나 — 만드는 문의 규칙은 이미 「자르되 말한다」인데(cols 6→4 · rows 6→4) `gap` «하나»만
   *    「저장하고 말한다」로 예외였다. 그 예외에 근거가 없었고, 그 탓에 고치는 문(0~200)으로는
   *    ★«영영 못 되돌리는 값»이 생겼다(만들 수는 있는데 고칠 수는 없는 값).
   *    ⇒ 취향 결정이 아니라 «버그 수정»이다 — 정상 사용자는 패널 슬라이더(max=GRID_GAP_MAX)로
   *      그 값을 만들 수조차 없다. API/잘못된 호출로만 생긴다.
   *  ⛔★★그리고 «여기서만» 자른다 — 렌더러(`_gridGaps`)는 «절대» 안 건드린다.
   *    까닭: 저장본에 200 넘는 gap 이 있으면 렌더러를 좁히는 순간 그 프로젝트의 «보이는 것»이
   *    바뀐다(T-170 함정과 같은 자리). ⚠️★그리고 「그런 저장본이 있나」는 «잴 수 없다» —
   *    현빈 계정은 그리드 블록이 0건이라 «표본이 0»이고(지디 실측), 배포판 사용자 저장본엔 손이
   *    안 닿는다. ⛔「표본 0」은 «안전하다»가 아니라 «모른다»다. 모르는 것을 상대로는 «안 건드리는»
   *    쪽만 안전하다. 지키는 검사: tests/unit/grid-gap-clamp.test.js G2(렌더러 바이트 동일).
   *  ★두 갈래를 가른다 — «숫자인데 범위 밖»은 한계로 «자르고», «숫자가 아님»은 기본값으로 떨어진다.
   *    (뒤엣것은 예전에도 그랬다 — 바뀐 것은 「말을 한다」뿐이다.) */
  const _gapRaw = opts.gap;
  if (_gapRaw !== undefined) {
    const n = Number(_gapRaw);
    if (!Number.isFinite(n)) {
      drops.push({ path: 'gap', why: `${JSON.stringify(_gapRaw)} is not a number — the default ${GRID_DEFAULTS.gap}px was used instead` });
    } else if (_gridValidateGap(n) === null) {
      const clamped = Math.round(Math.max(0, Math.min(GRID_GAP_MAX, n)));
      drops.push({ path: 'gap', why: `${JSON.stringify(_gapRaw)} is outside 0~${GRID_GAP_MAX} — it was CLAMPED to ${clamped}. `
        + 'update_grid_block refuses that range outright, so an unclamped value could never be edited back through that field' });
      opts = { ...opts, gap: clamped };   // ⛔부르는 쪽 객체를 제자리에서 안 고친다
    }
  }
  block.dataset.gap = String(Number.isFinite(Number(opts.gap)) ? Number(opts.gap) : GRID_DEFAULTS.gap);
  // ★rowGap/colGap 은 «주어졌을 때만» dataset 에 쓴다 — 안 주면 옛 파일과 완전히 같은 모양(legacy gap 폴백).
  for (const k of ['rowGap', 'colGap']) {
    if (opts[k] === undefined) continue;
    const lo = k === 'rowGap' ? GRID_ROW_GAP_MIN : 0;
    const v = _gridValidateGap(opts[k], lo);
    if (v !== null) block.dataset[k] = String(v);
    else drops.push({ path: k, why: `${JSON.stringify(opts[k])} is outside ${lo}~${GRID_GAP_MAX} — it was not written, so this axis falls back to gap` });
  }
  /* ★T-172 칸 테두리도 «주어졌을 때만» 쓴다 — 안 주면 옛 파일과 dataset 이 완전히 같다. */
  if (opts.cellBorderWidth !== undefined) { const v = _gridValidateBorderWidth(opts.cellBorderWidth); if (v !== null) block.dataset.cellBorderWidth = String(v); }
  if (typeof opts.cellBorderColor === 'string' && _GRID_COLOR_RE.test(opts.cellBorderColor.trim())) block.dataset.cellBorderColor = opts.cellBorderColor.trim();
  if (GRID_BORDER_STYLES.includes(opts.cellBorderStyle)) block.dataset.cellBorderStyle = opts.cellBorderStyle;
  /* ★제4안 cellPadY — 주어졌고 0 보다 클 때만 쓴다(안 주면 옛 dataset 과 같음) · 범위 밖은 말하고 버린다 */
  if (opts.cellPadY !== undefined && opts.cellPadY !== null) {
    const v = _gridValidateCellPadY(opts.cellPadY);
    if (v === null) drops.push({ path: 'cellPadY', why: `${JSON.stringify(opts.cellPadY)} is outside 0~${GRID_CELL_PAD_Y_MAX} — it was not written` });
    else if (v > 0) block.dataset.cellPadY = String(v);
  }
  /* ★G12 블럭 배경 — 고치는 문과 «같은» 입구. 만드는 문은 거절 대신 «말하고 버린다»(이 함수의 drops 규약). */
  if (opts.blockBg !== undefined && opts.blockBg !== null) {
    const plan = _gridIntakeBlockBg(opts.blockBg, false);   // ⛔opts 는 MCP JSON 일 수 있다 — trusted 를 여기서 안 읽는다
    if (plan.error) drops.push({ path: 'blockBg', why: `${plan.error} — the block was made without a background` });
    else Object.assign(block.dataset, plan.set);
  }
  if (opts.valign !== undefined && !GRID_VALIGN_VALUES.includes(opts.valign)) {
    drops.push({ path: 'valign', why: `${JSON.stringify(opts.valign)} is not one of ${GRID_VALIGN_VALUES.join('|')} — `
      + `the block fell back to '${GRID_DEFAULTS.valign}' without a word (update_grid_block REFUSES the same value)` });
  }
  block.dataset.valign = GRID_VALIGN_VALUES.includes(opts.valign) ? opts.valign : GRID_DEFAULTS.valign;

  // ★P1: rows/cells(선택) — 안 주면 옛 duo 와 완전히 같은 1행 블록(dataset.rows/cells 아예 안 씀).
  //   cells 는 add_block API 경계 그대로 «행 0 포함 전체»를 받는다(§3-A) — 행 0 은 cols 로 흡수.
  if (opts.rows !== undefined && !(Array.isArray(opts.rows) && opts.rows.length >= MIN_ROWS)) {
    drops.push({ path: 'rows', why: `rows must be an array of ${MIN_ROWS}~${MAX_ROWS} — it was ignored and a 1-row grid was built` });
  }
  /* ⚠️★`cells` 는 «rows 가 성립할 때만» 읽힌다 — rows 를 안 주면 cells 가 통째로 조용히 버려진다.
     지디 관측엔 없던 자리고, 「만들기」에서 제일 크게 잃는 갈래다(칸 내용 전부). */
  if (Array.isArray(opts.cells) && opts.cells.length && !(Array.isArray(opts.rows) && opts.rows.length >= MIN_ROWS)) {
    drops.push({ path: 'cells', why: 'cells is only read when rows is also given — pass rows in the SAME call, '
      + 'otherwise every cell you sent is dropped (this door built a 1-row grid from cols alone)' });
  }
  if (Array.isArray(opts.rows) && opts.rows.length >= MIN_ROWS) {
    if (opts.rows.length > MAX_ROWS) {
      drops.push({ path: `rows[${MAX_ROWS}..${opts.rows.length - 1}]`,
        why: `a grid holds ${MIN_ROWS}~${MAX_ROWS} rows — the rest were dropped (update_grid_block REFUSES the same value; this door clamps it)` });
    }
    const rows = opts.rows.slice(0, MAX_ROWS).map(r => {
      const h = r && typeof r === 'object' ? r.height : undefined;
      if (h === 'auto' || h == null || h === '') return { height: 'auto' };
      const n = Number(h);
      return { height: (Number.isFinite(n) && n >= 0) ? n : 'auto' };
    });
    block.dataset.rows = JSON.stringify(rows);
    /* ⚠️T-178 — `rows.length > 1` 조건을 걷었다. 행이 하나여도 행 0 칸의 «꾸밈»은
       이제 cells[0] «자리»에 살아야 한다(옛 코드는 그것을 cols 로 올려 «열 기본값»으로 삼았다).
       조건을 남기면 1행 그리드에 준 칸 꾸밈이 조용히 사라진다. */
    if (Array.isArray(opts.cells) && opts.cells.length) {
      if (opts.cells.length > rows.length) {
        drops.push({ path: `cells[${rows.length}..${opts.cells.length - 1}]`,
          why: `the grid has ${rows.length} row(s) — the extra rows were dropped` });
      }
      const { cols: mergedCols, cellRows } = _splitFullCells(opts.cells.slice(0, rows.length), cols);
      cols = mergedCols;
      if (cellRows.length) block.dataset.cells = _gridCellsToDataset(cellRows);
    }
  }
  block.dataset.cols = JSON.stringify(cols);
  renderGridBlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addGridBlock(opts = {}) {
  /* ★자원 가드는 «만드는 문»에도 건다 (2026-09-24 T-170).
   *   ⛔고치는 문 넷만 막으면 `add_grid_block` 으로 20만 자를 «처음부터» 심을 수 있다 —
   *     그 프로젝트는 무거워져 결국 사람 쪽으로 온다(이 카드가 「사람 쪽으로 온다」고 적은 자리).
   *   ⚠️★여기서 닫히는 것은 «자원 가드 하나»뿐이다. 「모르는 값을 말해 준다」 쪽은 여기 못 붙인다 —
   *     makeGridBlock/addGridBlock 에는 부분 적용을 «보고할 칸»이 없다(돌려주는 것이 {row,block}이다).
   *     ⇒ 그건 add 쪽 반환 규약을 바꾸는 별건이다. 조용히 버리는 쪽으로 때우지 «않는다».
   *   ⛔ctx.block 은 null 이다 — 아직 블록이 없으니 「이미 있던 그림」이라는 예외가 성립 안 한다. */
  /* ~~[2026-09-24 오전] 「모르는 값을 말해 준다 쪽은 여기 못 붙인다 — 보고할 칸이 없다」~~
     ⛔그 문장은 «내가 안 만든 칸»을 「없는 칸」으로 적은 것이었다(지디 실기 관측이 그 자리를 밟았다).
     ★칸은 만들면 된다 — 아래처럼 `notApplied` 를 «덧붙여» 돌려준다. 기존 부르는 쪽은
       `{ row, block }` 을 구조분해로 받으므로 한 자도 안 깨진다(⛔반환 «교체»가 아니라 «추가»다). */
  const _drops = [];
  const _intakeReject = _gridIntake({ cols: opts.cols, cells: opts.cells },
    { trusted: opts.trusted === true, block: null }, _drops);
  if (_intakeReject) return _intakeReject;   // {ok:false, code, message} — main.js 가 그대로 올린다
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return null; }
  window.pushHistory();
  const { row, block } = makeGridBlock(opts, _drops);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
  /* ★「안 닿은 것」을 «고치는 문과 같은 모양»으로 싣는다(ignoredProps + hint).
     ⛔비었으면 키 자체를 안 만든다 — 아무 일 없던 호출의 답이 굵어지지 않게. */
  const notApplied = _drops.length ? _gridAttachNotApplied({}, _drops) : null;
  return notApplied ? { row, block, notApplied } : { row, block };
}

// updateStepBlock/updateInfoCardBlock 미러 — validate-then-commit + before 스냅샷.
// 지원: cols(전체 교체) · patchCol{index,…} · rows(전체 교체) · cells(행0 포함 전체 교체) ·
//       patchCell{r,c,…} · gap · valign.
// ★구조 필드(cols/patchCol/cells/patchCell)는 한 번에 하나만 — 부분 적용 혼란 방지(기존 cols/patchCol 규칙 확장).
/* @param {object} [opts]  ★«3번째 인자». opts.trusted === true 일 때만 GRID_IMG_MAX_CHARS 를
 *   건너뛴다 — 사람이 파일 대화상자로 고른 UI 입구 전용이다(그쪽은 파일 «바이트»로 이미 걸렀다).
 *   MCP(main.js:7024)는 2인자로만 부르므로 이 통로는 IPC 에 노출되지 않는다(실측 확인).
 *   ★opts.noHistory === true 면 pushHistory 를 «안» 쌓는다 — 한 제스처가 두 문으로 나갈 때
 *   «두 번째부터»만 쓴다(T-227 칸 사이 줄 이동). 까닭은 커밋 자리의 ⛔주석에 적어 뒀다. */
function updateGridBlock(blockId, partial = {}, opts = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('grid-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `grid-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'partial is empty' };
  }
  let appliedCellsPending = false;   // ★T-122 — applied.cells 는 «커밋 뒤» 모델로 채운다(아래)
  let appliedColsPending  = false;   // ★T-170 — applied.cols 도 같다(전엔 입력을 그대로 메아리쳤다)
  const structKeys = ['cols', 'patchCol', 'cells', 'patchCell'].filter(k => partial[k] !== undefined);
  if (structKeys.length > 1) {
    return { ok: false, code: 'INVALID', message: `${structKeys.join(', ')} 동시 지정 불가 — 구조 변경은 한 번에 하나만` };
  }

  const next = {};
  const applied = {};
  /* ★T-122 — 「보냈지만 화면엔 안 닿은 것」. `applied` 에서 빼고 여기에 까닭과 함께 모은다. */
  const drops = [];

  // rows 를 먼저 처리한다 — cells/patchCell 검증이 「바뀐 뒤」 행 수를 기준으로 범위를 잰다.
  if (partial.rows !== undefined) {
    if (!Array.isArray(partial.rows) || partial.rows.length < MIN_ROWS || partial.rows.length > MAX_ROWS) {
      return { ok: false, code: 'INVALID', message: `rows must be array of ${MIN_ROWS}~${MAX_ROWS} rows` };
    }
    const normRows = [];
    for (const r of partial.rows) {
      const h = r && typeof r === 'object' ? r.height : undefined;
      if (h === 'auto' || h == null || h === '') { normRows.push({ height: 'auto' }); continue; }
      const n = Number(h);
      if (!Number.isFinite(n) || n < 0 || n > ROW_H_MAX) {
        return { ok: false, code: 'INVALID', message: `row height must be "auto" or a number 0~${ROW_H_MAX}` };
      }
      normRows.push({ height: n });
    }
    next.rows = JSON.stringify(normRows);
    applied.rows = normRows;
    // ⛔줄어든 행의 셀 데이터는 dataset.cells 에서 잘려나간다 — «변경 전» pushHistory 로 undo 복원.
    const colsForTrim = _gridCols(block);
    const trimmedRows = _gridCellRows(block, colsForTrim, normRows.length);
    next.cells = _gridCellsToDataset(trimmedRows);
    /* ★행 경계 괘선의 켬/끔도 «같이» 자른다 — 안 자르면 주인 없는 값이 dataset 에 남고,
       행을 다시 늘렸을 때 «옛 켬»이 되살아나 사용자가 안 켠 줄이 나타난다.
       ⛔칸 내용이 잘리는 것과 «같은 규약»이다(변경 전 pushHistory 로 ⌘Z 복원). */
    next.rowRuleOn = _gridTrimRuleOn(block.dataset.rowRuleOn, normRows.length - 1);
  }
  const rowCountForValidation = next.rows !== undefined ? JSON.parse(next.rows).length : _gridRows(block).length;

  /* ★★입구 계약 — 구조 입구 넷이 «여기 한 번»을 지난다 (T-170·175·176·180, _gridIntake 머리 참고).
   *   ⛔아래 문들에 검사를 하나씩 더 붙이지 마라 — 문이 늘면 또 빠진다. 계약은 저 함수 안에 있다.
   *   ⚠️`opts.trusted` 는 «3번째 인자»로만 온다(partial.trusted 는 여전히 안 읽는다 — 뒷문). */
  const _intakeReject = _gridIntake(partial, { trusted: !!(opts && opts.trusted === true), block }, drops);
  if (_intakeReject) return _intakeReject;

  if (partial.cols !== undefined) {
    /* ★상한 3 → 4 (2026-09-04): 우측 패널 4×4 피커가 최대 4열을 준다.
     * ~~[폐기] 「하한 2 는 유지한다 — 1열짜리 「그리드」는 그리드가 아니고, _gridCols 폴백이
     *   1열을 기본값으로 되돌려 «내용을 지우는» 함정이 있다(PLAN §P1 회귀위험)」~~
     * ★하한 2 → 1 (2026-09-05 · 현빈 지시 = «정책 변경», 버그 수정 아님).
     *   폐기한 문장의 「함정」은 MIN_COLS 가 1 이 되면서 «폴백 조건 자체»가 사라져 성립하지 않는다. */
    if (!Array.isArray(partial.cols) || partial.cols.length < MIN_COLS || partial.cols.length > MAX_COLS) {
      return { ok: false, code: 'INVALID', message: `cols must be array of ${MIN_COLS}~${MAX_COLS} columns` };
    }
    next.cols = JSON.stringify(partial.cols);
    appliedColsPending = true;   // ★커밋 «뒤» 모델로 채운다(아래) — 메아리는 거짓말이다
    // 열 수가 바뀌면 칸 행들도 새 열 수에 맞춰 pad/truncate(방어 — 다음 렌더에서도 어차피
    // _gridCellRows 가 같은 일을 하지만, dataset 자체를 깨끗하게 유지해 export/외부 판독을 돕는다).
    const trimmedRows = _gridCellRows(block, partial.cols, rowCountForValidation);
    next.cells = _gridCellsToDataset(trimmedRows);
    next.colRuleOn = _gridTrimRuleOn(block.dataset.colRuleOn, partial.cols.length - 1);   // 위 rows 와 같은 까닭
  }
  /* ★T-176 — 줄이는 교체면 «도구»도 그 사실을 말한다. ⛔동작은 안 바꾼다(잘림은 그대로).
   *   ⚠️dataset 은 아래 `Object.assign(block.dataset, next)` 에서야 바뀐다 — 그래서 «지금» 읽은
   *     모델이 «바꾸기 전»이다. 이 줄이 그 아래로 내려가면 잃은 것을 «0» 으로 세게 된다. */
  const _destructive = _gridDestructiveNotice(
    getGridModel(block),
    rowCountForValidation,
    (partial.cols !== undefined && Array.isArray(partial.cols)) ? partial.cols.length : _gridCols(block).length,
  );

  if (partial.patchCol !== undefined) {
    const p = partial.patchCol;
    if (!p || typeof p !== 'object' || !Number.isFinite(Number(p.index))) {
      return { ok: false, code: 'INVALID', message: 'patchCol must be {index, ...}' };
    }
    const cols = _gridCols(block);
    const i = Number(p.index);
    if (i < 0 || i >= cols.length) return { ok: false, code: 'INVALID', message: `patchCol.index out of range (0~${cols.length - 1})` };
    const { index, ...rest } = p;
    cols[i] = Object.assign({}, cols[i], rest);
    next.cols = JSON.stringify(cols);
    applied.patchCol = { index: i, ...rest };
  }
  if (partial.cells !== undefined) {
    // ★API 경계는 «행 0 포함 전체 R×C»(§3-A 스키마 그대로) — 내부에서 행 0 은 cols 로 흡수한다.
    if (!Array.isArray(partial.cells) || !partial.cells.length) {
      return { ok: false, code: 'INVALID', message: 'cells must be a non-empty 2D array (rows × cols, row 0 included)' };
    }
    if (partial.cells.length > rowCountForValidation) {
      return { ok: false, code: 'INVALID', message: `cells has ${partial.cells.length} rows but grid has ${rowCountForValidation} rows — pass rows in the same call to grow the grid first` };
    }
    /* ~~[이사 · 2026-09-24 T-170] 여기 있던 lines 길이 가드는 `_gridIntake` 로 갔다~~
       ⛔되가져오지 마라 — 자원 가드가 문마다 흩어지면 다음 문에서 또 빠진다(이 카드의 본병). */
    const baseCols = _gridCols(block);
    const { cols: mergedCols, cellRows } = _splitFullCells(partial.cells, baseCols);
    next.cols = JSON.stringify(mergedCols);
    /* ★「null = 그 키를 지운다」를 이 입구에도 건다 (T-184, 2026-09-27 · 현빈 「찌꺼기는 남으면 안되지」).
     * ⛔없으면 `cells` 통째로 온 `bg:null` 이 저장본에 `"bg":null` 로 «남는다» — 같은 상태에
     *   «두 표기»가 생기고, 화면은 열 기본값이 아니라 «하드 기본»으로 떨어진다.
     *   실측(2026-09-27): patchCell{bg:null} → 키 없음 ✅ / cells{bg:null} → "bg":null 남음 ⛔.
     * ★★`_gridApplyCellDeco` 를 «그대로 태운다» — 규칙을 베껴 적지 않는다.
     *   ⛔처음엔 `_gridCellsToDataset` 안에 같은 for 문을 «새로 썼고», 그 순간 «지움 길이 둘»이
     *     됐다. 검사 D5(「그 두 줄이 유일한 지움 길이다」)가 바로 빨개져서 잡았다.
     *   ⇒ ★같은 뜻의 코드를 두 번 쓰면 «따로 늙는다». 부르는 쪽을 늘리고 규칙은 한 곳에 둔다.
     * ⛔`lines` 는 이 계약 밖이다(그 함수 머리말과 같은 까닭) — 떼어 두었다가 그대로 되붙인다. */
    const cellRowsUnset = (Array.isArray(cellRows) ? cellRows : []).map((row) => (Array.isArray(row)
      ? row.map((cell) => {
        if (!cell || typeof cell !== 'object' || Array.isArray(cell)) return cell;
        const { lines, ...deco } = cell;
        const cleaned = _gridApplyCellDeco({}, deco);
        if (lines !== undefined) cleaned.lines = lines;
        return cleaned;
      })
      : row));
    next.cells = _gridCellsToDataset(cellRowsUnset);
    /* ★T-122 — `applied.cells = partial.cells` 는 «입력을 그대로 메아리»치는 것이라 거짓말이었다.
       행이 배열이 아니어도, 셀 키가 `_mergeCellLinesIntoCol`·`_gridCellRows` 에서
       통째로 버려져도, 보낸 것이 그대로 「적용됐다」로 돌아왔다.
       ⇒ ⑴버려진 것을 `drops` 로 모으고, ⑵`applied.cells` 는 «커밋 뒤 모델»(=화면이 읽는 것)로
         아래에서 다시 채운다. 여기서 채우면 또 «보낸 값»을 보는 셈이라 같은 거짓말이 된다. */
    drops.push(..._gridInspectCells(partial.cells, baseCols.length, rowCountForValidation));
    appliedCellsPending = true;
  }
  if (partial.patchCell !== undefined) {
    const p = partial.patchCell;
    if (!p || typeof p !== 'object' || !Number.isFinite(Number(p.r)) || !Number.isFinite(Number(p.c))) {
      return { ok: false, code: 'INVALID', message: 'patchCell must be {r, c, ...}' };
    }
    const cols = _gridCols(block);
    const r = Number(p.r), c = Number(p.c);
    if (r < 0 || r >= rowCountForValidation) return { ok: false, code: 'INVALID', message: `patchCell.r out of range (0~${rowCountForValidation - 1})` };
    if (c < 0 || c >= cols.length) return { ok: false, code: 'INVALID', message: `patchCell.c out of range (0~${cols.length - 1})` };
    const { r: _r, c: _c, lineIndex, np, ...rest } = p;
    /* ~~[이사 · 2026-09-24 T-170] 「모르는 이름 거절 · imgSrc 상한 · lines 계약」이 여기 있었다~~
       까닭 — 그 셋이 «이 문에만» 있어서 나머지 세 문(cols/patchCol/cells)이 그대로 뚫려 있었다.
       지금은 `_gridIntake` 한 곳에 있고 네 문이 같이 지난다. ⛔여기로 되가져오지 마라.
       (옛 주석은 그 함수로 같이 옮겼다 — 까닭을 잃지 않으려고 «글자 그대로» 들고 갔다.)
       ⇒ 이 문에 남는 것은 «자리 계산»(범위·줄 병합·민감도)뿐이다. */
    /* ★행 0 도 이제 cells 에 «꾸밈 자리»가 있으므로 r 과 상관없이 전체 R×C 를 든다(T-178).
       ⛔여기서 r>0 만 만들면 행 0 꾸밈이 쓸 자리를 못 찾아 조용히 버려진다. */
    const cellRows = _gridCellRows(block, cols, rowCountForValidation);
    let cellPatch = rest;   // 기본: 셀 전체(부분) patch — 기존 동작 그대로
    let unreadLine = [];    // ★T-122 — 이름은 맞는데 «줄 종류»가 안 맞아 안 그려질 키들

    if (lineIndex !== undefined) {
      /* ★한 줄 단위 patch — P1.5 캔버스 인라인 편집 전제 설계(현빈 2026-09-04 지시).
       * 셀 전체(lines 배열 통째)를 갈아치우지 않고 lines[lineIndex] «하나만» 병합한다 —
       * 인라인 편집이 blur 때 이 경로로 한 줄만 커밋해야 다른 줄이 안 날아가고 커서도 안 튄다. */
      const li = Number(lineIndex);
      // ★줄 내용은 r===0 이면 cols[c] 가, 그 아래는 cells[r][c] 가 갖는다(꾸밈과 자리가 다르다).
      const curCell = r === 0 ? cols[c] : cellRows[r][c];
      const curLines = Array.isArray(curCell.lines) ? curCell.lines : [];
      if (!Number.isFinite(li) || li < 0 || li >= curLines.length) {
        return { ok: false, code: 'INVALID', message: `patchCell.lineIndex out of range (0~${curLines.length - 1})` };
      }
      /* ★★중첩 «안» 줄로 가는 길 (T-220, 2026-09-27) — 현빈 순서 결정의 뒷부분.
       *   T-221 이 «만드는» 길을 냈고, 여기가 «고치는» 길이다.
       *   ⛔`np` 가 없으면 한 글자도 안 바뀐다 — 바깥 줄 patch 는 옛 길 그대로다.
       *   ★병합 규칙은 `_gridMergeLine` «한 곳»에 있다. 중첩판은 경로를 걸어 내려가
       *     그 함수를 부를 뿐이다(규칙을 베끼지 않는다 — T-184 에서 배운 자리). */
      const nestSegs = np === undefined ? null : _gridNestPathSegs(np);
      if (np !== undefined && !nestSegs) {
        /* 거름 문이 이미 잡지만, 이 문만 따로 불릴 수도 있어 같은 답을 여기서도 낸다. */
        return { ok: false, code: 'INVALID', message: `patchCell.np is malformed: ${JSON.stringify(np)}` };
      }
      if (nestSegs) {
        const nextLines = _gridMergeNestedLine(curLines, li, nestSegs, rest);
        if (!nextLines) {
          /* ★없는 자리를 «만들지» 않는다 — 지어내면 「쓴 것 같은데 화면엔 없다」가 된다.
             ⛔여기서 무엇이 틀렸는지(열인가 줄인가 깊이인가)를 나누지 않는다: 모델을 걸어
               내려가 봐야 아는 것이라, 「그 주소에 줄이 없다」 하나로 말하는 편이 정직하다. */
          return { ok: false, code: 'INVALID',
            message: `patchCell.np "${np}" does not point at a line — walk from cells[${r}][${c}].lines[${li}] `
              + 'through cols[<col>].lines[<line>] and nothing is there '
              + '(the path segment order is "<col>.<line>", and every hop but the last must be a nested line).' };
        }
        cellPatch = { lines: nextLines };
      } else {
        cellPatch = { lines: _gridMergeLine(curLines, li, rest) };
      }

      /* ★T-122 — 이름 검사(_gridRejectUnknownCellFields)를 통과해도 «그 줄 종류»가 안 읽으면
         화면은 그대로다(글자 줄에 imgSrc 가 그 자리다). 렌더러를 돌려서 «민감도»로 잰다.
         ⛔★중첩일 때는 «그 안쪽 줄»을 재야 한다(T-220). 바깥 줄(lines[li], 곧 중첩 줄 자신)을
           재면 「그 종류는 fontSize 를 안 읽는다」가 나와 «멀쩡한 호출»이 거절된다. */
      const mergedLine = nestSegs
        ? _gridNestedLineAt(cellPatch.lines, li, nestSegs)
        : cellPatch.lines[li];
      const keys = Object.keys(rest);
      unreadLine = _gridUnreadLineFields(mergedLine, keys);
      if (keys.length && unreadLine.length === keys.length) {
        /* ★통째로 «안» 닿았다 — 부분 적용이 아니라 «적용 0개»다. 그래서 `ok:false` 로 돌려준다:
           이름이 틀렸을 때(_gridRejectUnknownCellFields)와 «같은 결과, 같은 모양»이어야 한다.
           ⛔남은 것이 하나라도 있으면 여기 안 온다 — 그쪽은 ok:true + drops 로 갈린다(아래). */
        const t = _gridLineTypeOf(mergedLine);
        return {
          ok: false, code: 'INVALID',
          message: `patchCell: none of ${keys.join(', ')} is read by the renderer on a type:'${t}' line `
            + '(rendering it with and without them gives identical HTML). '
            + 'This would have returned ok:true and changed nothing on screen. '
            + `Change the line kind in the SAME call if that was the intent, e.g. patchCell:{r:${r},c:${c},lineIndex:${li},type:'image',imgSrc:...}.`,
        };
      }
      if (unreadLine.length) {
        const lt = _gridLineTypeOf(mergedLine);
        for (const k of unreadLine) drops.push({ path: `patchCell.${k}`, why: `not read by the renderer on a type:'${lt}' line` });
      }
    } else {
      /* 셀 통째 patch — `lines` 안쪽 줄은 이름 검사가 «일부러» 안 보는 자리다
         (tests/unit/grid-patchcell-reject.test.js P5b). 막지는 않되 «안 그려질 것»은 일러 준다. */
      _gridInspectLines(rest.lines, 'patchCell', drops);
    }

    /* ~~[폐기 · T-178] 「행 0 은 늘 cols[c] 자체다 — patchCol 과 «같은 길»로 보낸다」~~
       까닭 — 그 «같은 길»이 바로 병이었다. 이제 갈린다:
         patchCell{r:0, bg} = 그 «칸»만        → dataset.cells[0][c]
         patchCol{index, bg} = 그 열의 «기본값» → dataset.cols[index]
       행 0 의 «줄 내용»만 여전히 cols[c].lines 다(단일 진실원). */
    Object.assign(next, _gridCellPatchDataset(cols, cellRows, r, c, cellPatch));
    /* ★T-122 — «안 그려진 것»은 applied 에서 뺀다. 담아 주면 부르는 쪽이 됐다고 믿고 넘어간다. */
    const shown = { ...rest };
    for (const k of unreadLine) delete shown[k];
    applied.patchCell = lineIndex !== undefined ? { r, c, lineIndex: Number(lineIndex), ...shown } : { r, c, ...shown };
  }
  if (partial.gap !== undefined) {
    // ★CSS 단축속성 의미로 확장 — gap · rowGap · colGap 셋 다 쓴다. rowGap/colGap 이 이미 있는
    //   블록에서 gap 만 바꾸면 "ok:true인데 화면은 그대로"인 거짓 성공이 된다(양축 갱신으로 봉쇄).
    const v = _gridValidateGap(partial.gap);
    if (v === null) return { ok: false, code: 'INVALID', message: `gap must be 0~${GRID_GAP_MAX}` };
    next.gap = String(v);
    next.rowGap = String(v);
    next.colGap = String(v);
    applied.gap = v;
  }
  if (partial.rowGap !== undefined) {
    const v = _gridValidateGap(partial.rowGap, GRID_ROW_GAP_MIN);
    if (v === null) return { ok: false, code: 'INVALID', message: `rowGap must be ${GRID_ROW_GAP_MIN}~${GRID_GAP_MAX}` };
    next.rowGap = String(v);
    applied.rowGap = v;
  }
  if (partial.colGap !== undefined) {
    const v = _gridValidateGap(partial.colGap);
    if (v === null) return { ok: false, code: 'INVALID', message: `colGap must be 0~${GRID_GAP_MAX}` };
    next.colGap = String(v);
    applied.colGap = v;
  }
  /* ── ★T-172 칸 테두리 «세 키». 축약값을 안 받는 이유는 선언부에 적혀 있다. ── */
  if (partial.cellBorderWidth !== undefined) {
    const v = _gridValidateBorderWidth(partial.cellBorderWidth);
    if (v === null) return { ok: false, code: 'INVALID', message: `cellBorderWidth must be 0~${GRID_BORDER_W_MAX} (0 = no border)` };
    next.cellBorderWidth = String(v);
    applied.cellBorderWidth = v;
  }
  if (partial.cellBorderColor !== undefined) {
    const raw = String(partial.cellBorderColor ?? '').trim();
    if (!_GRID_COLOR_RE.test(raw)) {
      return { ok: false, code: 'INVALID', message: "cellBorderColor must be a CSS color literal, e.g. '#d0d0d0' / 'rgba(0,0,0,.2)' / 'transparent'" };
    }
    next.cellBorderColor = raw;
    applied.cellBorderColor = raw;
  }
  if (partial.cellBorderStyle !== undefined) {
    /* ⛔모르는 꼴을 «조용히 실선으로» 떨구지 않는다 — 그게 카드가 못박은 「새 거짓 성공」이다. */
    if (!GRID_BORDER_STYLES.includes(partial.cellBorderStyle)) {
      return { ok: false, code: 'INVALID', message: `cellBorderStyle must be ${GRID_BORDER_STYLES.join('|')}` };
    }
    next.cellBorderStyle = partial.cellBorderStyle;
    applied.cellBorderStyle = partial.cellBorderStyle;
  }
  /* ── ★칸 «사이» 괘선 (현빈 2026-09-30) — 축 둘 × 다섯 키. 선언부(GRID_RULE_*)에 «왜»가 있다.
   *   ⛔열거를 손으로 열 번 적지 않는다: 축·키를 표로 돌린다. 그래야 축을 하나 더 늘릴 때
   *     「한 축만 고쳐진」 상태가 안 생긴다(이 레포의 고질). 거절 메시지는 키 이름을 담는다. */
  for (const ax of GRID_RULE_AXES) {
    const kOn = ax + 'RuleOn', kW = ax + 'RuleWidth', kC = ax + 'RuleColor';
    const kI = ax + 'RuleInset', kS = ax + 'RuleSpan';
    if (partial[kOn] !== undefined) {
      /* 경계 목록 — "1,0,1" 꼴. 경계 수는 «지금 모델»이 정한다(구조 변경과 같은 문에서 오면
         위 cols/rows 가지가 이미 next 에 넣었으므로 그쪽이 이긴다 — 여기선 길이만 맞춘다). */
      const raw = String(partial[kOn] ?? '').trim();
      if (raw !== '' && !/^[01](,[01])*$/.test(raw)) {
        return { ok: false, code: 'INVALID', message: `${kOn} must be a comma list of 0/1, e.g. '1,0,1' (empty = all off)` };
      }
      const nB = (ax === 'col')
        ? (next.cols !== undefined ? JSON.parse(next.cols).length : _gridCols(block).length) - 1
        : (next.rows !== undefined ? JSON.parse(next.rows).length : _gridRows(block).length) - 1;
      next[kOn] = _gridTrimRuleOn(raw, nB);
      applied[kOn] = next[kOn];
    }
    if (partial[kW] !== undefined) {
      const n = Number(partial[kW]);
      if (!Number.isFinite(n) || n < 1 || n > GRID_RULE_W_MAX) {
        return { ok: false, code: 'INVALID', message: `${kW} must be 1~${GRID_RULE_W_MAX}` };
      }
      next[kW] = String(Math.round(n));
      applied[kW] = Math.round(n);
    }
    if (partial[kC] !== undefined) {
      const raw = String(partial[kC] ?? '').trim();
      if (!_GRID_COLOR_RE.test(raw)) {
        return { ok: false, code: 'INVALID', message: `${kC} must be a CSS color literal, e.g. '#e0e0e0'` };
      }
      next[kC] = raw;
      applied[kC] = raw;
    }
    if (partial[kI] !== undefined) {
      /* ⛔0 이 «유효값»이다 — 「칸 높이 전체」가 곧 0 이다. `|| 기본값` 으로 삼키지 않는다. */
      const n = Number(partial[kI]);
      if (!Number.isFinite(n) || n < 0 || n > GRID_RULE_INSET_MAX) {
        return { ok: false, code: 'INVALID', message: `${kI} must be 0~${GRID_RULE_INSET_MAX} (0 = full cell height)` };
      }
      next[kI] = String(Math.round(n));
      applied[kI] = Math.round(n);
    }
    if (partial[kS] !== undefined) {
      if (!GRID_RULE_SPANS.includes(partial[kS])) {
        return { ok: false, code: 'INVALID', message: `${kS} must be ${GRID_RULE_SPANS.join('|')}` };
      }
      next[kS] = partial[kS];
      applied[kS] = partial[kS];
    }
  }
  /* ★G2-a 자체 너비 — 숫자(px)면 쓰고, `null` 이면 키를 «지워» 100%(옛 뜻)로 돌린다. 범위 밖은 거절. */
  let widthUnset = false;
  /* ★제4안 cellPadY — null/0 = 키 지움(기존 바이트로) · 0~상한 정수 · 그 밖 거절 */
  let cellPadYUnset = false;
  if (partial.cellPadY !== undefined) {
    if (partial.cellPadY === null || Number(partial.cellPadY) === 0) { cellPadYUnset = true; applied.cellPadY = 0; }
    else {
      const v = _gridValidateCellPadY(partial.cellPadY);
      if (v === null) return { ok: false, code: 'INVALID', message: `cellPadY must be 0~${GRID_CELL_PAD_Y_MAX} (px — added to every cell's top and bottom padding) or null (= none)` };
      next.cellPadY = String(v);
      applied.cellPadY = v;
    }
  }
  if (partial.width !== undefined) {
    if (partial.width === null) { widthUnset = true; applied.width = null; }
    else {
      const v = _gridValidateWidth(partial.width);
      if (v === null) return { ok: false, code: 'INVALID', message: `width must be ${GRID_WIDTH_MIN}~${GRID_WIDTH_MAX} (px) or null (= fill 100%)` };
      next.gridWidth = String(v);
      applied.width = v;
    }
  }
  if (partial.valign !== undefined) {
    /* ★명부는 _GRID_VALIGN «하나»에서 온다 — 전엔 여기와 makeGridBlock 이 각자 리터럴을
       들고 있었다(MIN_COLS/MAX_COLS 사고와 같은 유형, T-175). 칸 축도 같은 명부를 본다. */
    if (!GRID_VALIGN_VALUES.includes(partial.valign)) {
      return { ok: false, code: 'INVALID', message: `valign must be ${GRID_VALIGN_VALUES.join('|')}` };
    }
    next.valign = partial.valign;
    applied.valign = partial.valign;
  }
  /* ★G17 블럭 외곽선 — 켠 변 목록. 비우면(''·'none'·[]) 키를 «지워» 옛 뜻(없음)으로 돌린다. 모르는 변은 거절. */
  let outlineUnset = false;
  if (partial.blockOutline !== undefined) {
    const v = _gridNormOutline(partial.blockOutline);
    if (v === null) return { ok: false, code: 'INVALID', message: `blockOutline must list sides from ${GRID_OUTLINE_SIDES.join('|')} (comma string or array), or 'all' / 'none' / ''` };
    if (v === '') outlineUnset = true; else next.blockOutline = v;
    applied.blockOutline = v;
  }
  /* ★G12 블럭 배경 — 하위 키 일곱을 «한 값»으로 받는다. null = 전부 지움 · 하위 null = 그 키만(기본값). 모르는 하위 키는 거절. */
  let bgDel = [];
  if (partial.blockBg !== undefined) {
    const plan = _gridIntakeBlockBg(partial.blockBg, !!(opts && opts.trusted === true));
    if (plan.error) return { ok: false, code: 'INVALID', message: plan.error };
    Object.assign(next, plan.set);
    bgDel = plan.del.filter(k => !(k in plan.set));
  }
  if (Object.keys(next).length === 0 && !widthUnset && !outlineUnset && !bgDel.length && !cellPadYUnset) {
    return { ok: false, code: 'INVALID', message: 'no recognized fields — expected one of cols/patchCol/rows/cells/patchCell/gap/rowGap/colGap/valign/width/cellBorderWidth/cellBorderColor/cellBorderStyle/{col,row}Rule{On,Width,Color,Inset,Span}/blockOutline/blockBg' };
  }

  /* ⛔되돌림 명부에 «새 키»를 같이 넣어라 — 빠지면 RENDER_ERROR 롤백이 테두리만 남겨
     「그리기에 실패했는데 화면엔 선이 남는」 반쪽 상태를 만든다. */
  const before = {
    cols: block.dataset.cols, gap: block.dataset.gap, valign: block.dataset.valign,
    rows: block.dataset.rows, cells: block.dataset.cells,
    rowGap: block.dataset.rowGap, colGap: block.dataset.colGap,
    cellBorderWidth: block.dataset.cellBorderWidth,
    cellBorderColor: block.dataset.cellBorderColor,
    cellBorderStyle: block.dataset.cellBorderStyle,
    /* ⛔괘선 열 키도 여기 있어야 한다 — 빠지면 RENDER_ERROR 롤백이 줄만 남겨
       「그리기에 실패했는데 화면엔 줄이 남는」 반쪽 상태를 만든다(바로 위 ⛔와 같은 까닭). */
    colRuleOn: block.dataset.colRuleOn,
    colRuleWidth: block.dataset.colRuleWidth,
    colRuleColor: block.dataset.colRuleColor,
    colRuleInset: block.dataset.colRuleInset,
    colRuleSpan: block.dataset.colRuleSpan,
    rowRuleOn: block.dataset.rowRuleOn,
    rowRuleWidth: block.dataset.rowRuleWidth,
    rowRuleColor: block.dataset.rowRuleColor,
    rowRuleInset: block.dataset.rowRuleInset,
    rowRuleSpan: block.dataset.rowRuleSpan,
    gridWidth: block.dataset.gridWidth,   // G2-a
    cellPadY: block.dataset.cellPadY,     // 제4안 — 칸 위아래 여백
    gridWidthAuto: block.dataset.gridWidthAuto,   // F3 후속 — 출처 표시도 같이 되돌린다
    blockOutline: block.dataset.blockOutline,     // G17 — 블럭 외곽선
    /* G12 — 블럭 배경 일곱 키(GRID_BLOCK_BG_KEYS 와 같은 줄) */
    blockBgOn: block.dataset.blockBgOn, blockBgColor: block.dataset.blockBgColor, blockBgImg: block.dataset.blockBgImg,
    blockBgPos: block.dataset.blockBgPos, blockBgOpacity: block.dataset.blockBgOpacity,
    blockBgPadY: block.dataset.blockBgPadY, blockBgPadX: block.dataset.blockBgPadX,
  };
  /* ★★★2026-09-30 — 되돌림 명부를 «스냅샷에서 뽑는다». 손으로 적지 않는다.
   *   ⛔무엇이 났나: 바로 위 ⛔주석이 「새 키를 같이 넣어라」라고 경고하는데, 나는 `before` 에는
   *     괘선 10키를 넣고 이 `restore` 의 «손으로 적은 명부»에는 넣지 않았다. 그래서 RENDER_ERROR
   *     롤백이 cols·cells 는 되돌리고 «괘선 10키는 방금 실패한 새 값 그대로» 남겼다 —
   *     주석이 예고한 「그리기에 실패했는데 화면엔 줄이 남는」 반쪽 상태 그 자체다.
   *     (코덱스 적대 리뷰가 잡았다. 검사는 RENDER_ERROR 경로를 안 태워서 못 잡았다.)
   *   ★★고칠 것은 «빠진 10개»가 아니라 «명부가 둘인 것»이었다. 한쪽만 고치는 사고는 이 레포가
   *     반복해 물린 자리고(MIN_COLS 2건 · align 명부 · valign 명부 …), 주석으로는 못 막힌다 —
   *     오늘 내가 그 주석을 «읽을 수 있는 자리에 두고도» 어겼다는 것이 증거다.
   *   ⇒ `Object.keys(snap)` 로 뽑으면 명부가 «하나»가 되어 «어긋날 수가 없다».
   *     (`{a: undefined}` 도 Object.keys 에 'a' 가 남는다 — 안 쓰던 키의 `delete` 도 그대로 돈다.)
   *   ⛔여기에 명부를 다시 적지 마라. 새 키는 `before` 에만 더하면 된다. */
  const restore = (snap) => {
    Object.keys(snap).forEach(k => {
      if (snap[k] === undefined) delete block.dataset[k]; else block.dataset[k] = snap[k];
    });
  };
  /* ★opts.noHistory — «한 제스처가 두 문으로 나갈 때» 두 번째부터 끄는 자리다 (T-227).
     ⛔첫 문에는 절대 쓰지 마라 — 위 pushHistory 는 `Object.assign(block.dataset, next)` «앞»이라
       «변경 전» 스냅샷을 쌓는다. 그래서 첫 문만 쌓아 두면 그 한 칸이 «둘 다 바뀌기 전»을 담고,
       ⌘Z 한 번이 두 칸을 함께 되돌린다. 두 문 다 쌓으면 ⌘Z 를 «두 번» 눌러야 하고, 한 번만
       누른 사용자는 «줄이 두 칸에 다 있는» 반쪽 상태를 본다.
     ⛔부르는 쪽이 «실패하면 되돌린다»를 같이 들어야 한다 — 이 플래그는 히스토리를 끄는 것일 뿐
       되돌림을 주지 않는다(prop-grid.js grdMoveLineToCell 이 그 되돌림을 들고 있다).
     ★낱말은 이 저장소에 이미 있는 것을 쓴다(js/spacing-normalize.js `plan.noHistory`). */
  if (opts.noHistory !== true) window.pushHistory?.();
  /* ★G2-b — 떠 있는 그리드는 «굳힌 폭»이 정본이라 키만 쓰면 화면이 안 바뀐다(렌더가 키를 안 본다).
     applyGridOwnWidth 와 «같은 규칙»: 굳힌 폭도 같이 쓴다. 되돌림용으로 style·표식을 따로 쥔다
     (⛔`before` 에 넣지 않는다 — 그건 MCP 응답으로 나가는 «모델 키» 명부다). */
  const _floatW = (partial.width !== undefined && !widthUnset && block.dataset.overlayBlock === 'true')
    ? { style: block.style.width, frozen: block.dataset.overlayFrozenWidth } : null;
  Object.assign(block.dataset, next);
  if (_floatW) _gridSetFrozenWidth(block, Number(next.gridWidth));
  if (widthUnset) delete block.dataset.gridWidth;
  if (cellPadYUnset) delete block.dataset.cellPadY;
  if (outlineUnset) delete block.dataset.blockOutline;
  bgDel.forEach(k => { delete block.dataset[k]; });
  if (partial.width !== undefined) delete block.dataset.gridWidthAuto;   // 사람이 정한 폭 — 자동 출처 표시를 뗀다
  try {
    renderGridBlock(block);
  } catch (e) {
    restore(before); // rollback
    if (_floatW) {
      block.style.width = _floatW.style;
      if (_floatW.frozen === undefined) delete block.dataset.overlayFrozenWidth; else block.dataset.overlayFrozenWidth = _floatW.frozen;
    }
    try { renderGridBlock(block); } catch (_) {}
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }
  /* ★opts.keepPanel — 패널 조작 «직전»에 세워 둔 줄 편집을 커밋할 때(block-drag.js _gridBeginEdit 의 flush)만 켠다.
     그 순간 패널을 다시 그리면 지금 눌린 패널 칸이 DOM 에서 떨어져 그 조작이 먹힌다(TX1 · 2026-10-03). */
  if (block.classList.contains('selected') && !(opts && opts.keepPanel === true)) {
    try { window.showGridProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}
  window.scheduleAutoSave?.();
  /* ★T-122 — `applied.cells` 는 «보낸 값»이 아니라 «커밋 뒤 모델»이다. getGridModel 이 돌려주는
     것이 곧 렌더러가 읽는 것이라, 이 값은 «화면과 같은 말»이 된다(메아리는 그렇지 않았다). */
  if (appliedCellsPending) applied.cells = _gridRenderedCells(getGridModel(block).cells);
  if (appliedColsPending) applied.cols = _gridRenderedCols(getGridModel(block).cols);
  if (partial.blockBg !== undefined) applied.blockBg = _gridBlockBg(block);   // ★G12 — «커밋 뒤» 읽은 값(메아리 아님)
  const res = _gridAttachNotApplied({ ok: true, blockId, before, applied }, drops);
  /* ★T-176 — 「안 된 것」(ignoredProps/hint)과 «다른 칸»에 담는다. 잘림은 «된 것»이다 — 일부러
     그렇게 정해진 동작이라 「적용 안 됨」으로 세면 거짓말이 된다. 말은 하되 뜻은 안 섞는다. */
  if (_destructive) {
    res.destructive = _destructive;
    res.hint = [res.hint, _destructive.message].filter(Boolean).join(' ');
  }
  return res;
}

/** 이 줄이 «글자를 담는가» — 패널이 「Typography 절을 띄울 줄인가」를 이걸로 묻는다.
 *
 * ★판정을 «되풀이하지 않는다» — 렌더러를 실제로 돌려 「글자를 담는 요소가 나왔나」로 잰다.
 *   ⛔목록(gap/image/…)을 패널 쪽에 «베끼면» 두 벌이 되어 조용히 갈라진다. 그리고 그 목록엔
 *     중첩 그리드의 스키마 enum 이 들어 있는데, 그 이름은 이 파일 «한 곳»에만 살아야 한다
 *     (tests/unit/grid-rename-residue.test.mjs S1 이 그것을 지킨다 — 실제로 잡혔다).
 * ★클래스 두 개는 block-drag.js 의 _gridEditable 이 «이미» 보는 것과 같다(hostOf 술어) —
 *   그쪽이 DOM 에서, 여기가 모델에서 «같은» 질문에 답한다. */
/* ══ BT2(2026-10-04) — «줄 배열 하나»를 그리드 입구와 «같은 잣대»로 재는 얇은 문 ══════════════
 * ★왜 — 버블·챗이 «그리드 줄 데이터»를 그대로 쓴다(BT2 설계 D1·D8). 그 줄을 MCP·패널로 받을 때
 *   «무엇이 맞는 줄인가»를 그리드와 다른 자로 재면 두 벌이 되어 따로 늙는다.
 * ⛔새 규칙이 «하나도» 없다 — 이 파일의 기존 검사를 차례로 부를 뿐이다:
 *   _gridRejectLinesLength(상한 MAX_CELL_LINES) · _gridRejectUnknownCellFields(줄 명부 GRID_LINE_FIELDS) ·
 *   _gridValueViolations(색·글꼴·정렬 값).
 * ⚠️그리드의 `patchCell{lines}`(통째) 문은 모르는 줄 필드를 «거절하지 않고 말한다»(drops). 여기는 «거절»이다 —
 *   버블·챗 줄은 새로 생기는 데이터라 «왕복 사정»(옛 저장본에 남은 쓰레기)이 없다.
 * @returns {null|{ok:false, code:string, message:string}}  null = 통과 */
export function gridValidateLines(lines, where = 'lines') {
  if (!Array.isArray(lines)) {
    return { ok: false, code: 'LINES_NOT_ARRAY', message: `${where} must be an array (got ${lines === null ? 'null' : typeof lines})` };
  }
  const lenReject = _gridRejectLinesLength(lines);
  if (lenReject) return { ...lenReject, message: lenReject.message.replace('patchCell.lines', where) };
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln || typeof ln !== 'object' || Array.isArray(ln)) {
      return { ok: false, code: 'INVALID', message: `${where}[${i}] must be an object` };
    }
    const nameReject = _gridRejectUnknownCellFields(ln, true);
    if (nameReject) return { ...nameReject, message: `${where}[${i}]: ` + nameReject.message };
    const v = _gridValueViolations(ln, `${where}[${i}]`);
    if (v.length) return { ok: false, code: 'INVALID', message: v.map(x => `${x.path}: ${x.why}`).join('; ') };
  }
  return null;
}

export function gridLineHasText(line) {
  if (!line || typeof line !== 'object') return false;
  const html = _gridLineHtml(line, 'left', 0, null);
  /* ⚠️«최상위 요소»만 본다 — 부분 문자열로 재면 중첩 그리드가 «자기 안쪽» 줄의 .grd-line 을
     내보내서 「글자 줄」로 오판한다(실측: 첫 판이 그렇게 틀렸다). _gridEditable 도 바깥 요소의
     classList / :scope > .grd-badge 만 본다 — 그 판정과 «같은 자리»를 재는 것이다. */
  return /^<div[^>]*\sclass="grd-line\s/.test(html)          // 보통 줄 = 자기 자신이 글자를 담는다
      || /^<div[^>]*><span class="grd-badge"/.test(html);     // 뱃지 줄 = 안쪽 span 이 담는다
}

/* ★패널의 «연속 input 미리보기» 전용 — 줄 하나에 필드를 얹어 block.dataset 에 «바로» 쓰고 재렌더한다.
 *
 * ⛔왜 updateGridBlock 을 안 부르나 (계획서 §4-C 「이 작업 최대의 함정」)
 *   updateGridBlock 은 성공하면 스스로 pushHistory 를 1회 쌓고, 블록이 선택돼 있으면
 *   window.showGridProperties 를 다시 불러 «패널을 통째로» 새로 그린다(이 파일 아래쪽).
 *   색 피커를 «드래그하는 동안» 그러면 ⑴ 히스토리가 프레임 수만큼 쌓여 ⌘Z 가 못 쓰게 되고
 *   ⑵ 포커스가 든 input 이 교체돼 조작이 끊긴다.
 * ★그렇다고 되쓰기를 «두 벌»로 만들지 않는다 — 줄 병합(_gridMergeLine)과 셀 되쓰기
 *   (_gridCellPatchDataset) 는 updateGridBlock 이 쓰는 «바로 그 함수»다.
 * ⛔pushHistory·autosave·패널 재생성은 «여기서 하지 않는다» — 그 정책은 제스처를 아는
 *   호출부(prop-grid.js)가 정한다(첫 input 에서 «적용 전» pushHistory 1회, change 에서 autosave).
 * 성공하면 true, 좌표가 범위 밖이면 false(화면·데이터가 갈라진 채 남지 않는다). */
export function gridPreviewLine(block, r, c, li, fields, np) {
  if (!block) return false;
  const cols = _gridCols(block);
  const rows = _gridRows(block);
  const R = Number(r), C = Number(c);
  if (!(R >= 0 && R < rows.length) || !(C >= 0 && C < cols.length)) return false;
  const cellRows = _gridCellRows(block, cols, rows.length);
  // ★줄 내용의 자리 — 행 0 은 cols[C], 그 아래는 cells[R][C] (T-178 뒤에도 그대로다).
  const curCell = R === 0 ? cols[C] : cellRows[R][C];
  /* ★★6번째 인자 `np` — 중첩 «안» 줄까지 미리보기가 닿는다 (T-220 ②, 2026-09-27).
   *   ⛔`updateGridBlock` 과 «같은 두 함수»를 쓴다(_gridMergeNestedLine → _gridMergeLine).
   *     두 길이 갈리면 「패널로 고친 것」과 「API 로 고친 것」이 달라진다 — 이 파일 머리말의 규율.
   *   ★안 주면 한 글자도 안 바뀐다(옛 길). 꼴이 틀리면 false 를 돌려 «조용한 성공»을 막는다. */
  let nextLines;
  if (np === undefined || np === null || np === '') {
    nextLines = _gridMergeLine(curCell && curCell.lines, li, fields);
  } else {
    const segs = _gridNestPathSegs(np);
    if (!segs) return false;
    nextLines = _gridMergeNestedLine(curCell && curCell.lines, li, segs, fields);
  }
  if (!nextLines) return false;
  Object.assign(block.dataset, _gridCellPatchDataset(cols, cellRows, R, C, { lines: nextLines }));
  renderGridBlock(block);
  return true;
}

/* ══ 칸 기하 히트테스트 — «칸 밖»에 떨어진 좌표를 칸으로 되돌린다 ═══════════════════
 * ★왜 DOM 히트테스트만으로는 부족한가 (2026-09-20, 0920b-grid-image)
 *   우클릭 메뉴의 「이미지 추가」는 «어느 칸인가»를 못 정하면 항목 자체가 조용히 사라진다.
 *   그런데 좌표가 칸을 안 가리키는 길이 셋이나 된다 —
 *     ① 선택된 그리드 위엔 거터(.grd-gutter, overlay-handles.js — #ss-handles-overlay 소속이라
 *        «블록 바깥» 요소다)와 이미지 코너핸들이 pointer-events:auto 로 덮여 있다.
 *     ② 블록 자체의 padding·gap(칸 사이 빈 틈). 40% 줌에선 이 띠가 좁아 오조준이 잦다.
 *     ③ 선택 안 된 프레임 «안»의 그리드 — css/editor-blocks.css 의
 *        `.frame-block:not(.selected)…* { pointer-events:none }` 때문에 elementsFromPoint 가
 *        그 자식들을 «반환조차 안 한다». 그래서 DOM 히트테스트로는 원리상 못 잡는다.
 *   ⇒ 사각형으로 직접 잰다. getBoundingClientRect 는 줌/transform 이 이미 반영된 값이라
 *     40% 줌에서도 따로 보정할 게 없다.
 * ⛔선택 상태는 «안 건드린다» — 「우클릭이 먼저 선택한다」로 풀면 첫클릭=블럭/둘째클릭=줄
 *   규약(T-058, 38b298e)과 충돌한다.
 *
 * @param {{r:number,c:number,rect:{left:number,top:number,right:number,bottom:number}}[]} cells
 * @returns {{r:number,c:number}|null}  후보가 없으면 null(조용한 오판보다 「못 찾았다」가 낫다) */
export function pickCellByRects(cells, x, y) {
  if (!Array.isArray(cells) || cells.length === 0) return null;
  let best = null, bestD = Infinity;
  for (const cell of cells) {
    const q = cell && cell.rect;
    if (!q) continue;
    if (x >= q.left && x <= q.right && y >= q.top && y <= q.bottom) return { r: cell.r, c: cell.c };
    // 사각형까지의 «거리» — 안이면 0, 밖이면 축별 초과분의 유클리드 거리.
    const dx = x < q.left ? q.left - x : (x > q.right ? x - q.right : 0);
    const dy = y < q.top ? q.top - y : (y > q.bottom ? y - q.bottom : 0);
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = { r: cell.r, c: cell.c }; }
  }
  return best;
}

/** 위 함수의 DOM 껍데기 — 이 블록의 .grd-cell 사각형을 읽어 (x,y)가 어느 칸인지 돌려준다. */
export function gridPickCellByPoint(block, x, y) {
  if (!block || !block.querySelectorAll) return null;
  const cells = [];
  block.querySelectorAll('.grd-cell').forEach(el => {
    const r = Number(el.dataset.r), c = Number(el.dataset.c);
    if (!Number.isInteger(r) || !Number.isInteger(c)) return;
    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (!rect || (rect.width === 0 && rect.height === 0)) return;   // 0×0 유령은 후보가 아니다
    cells.push({ r, c, rect });
  });
  return pickCellByRects(cells, x, y);
}
if (typeof window !== 'undefined') window.gridPickCellByPoint = gridPickCellByPoint;

// ★GRID_CELL_DEFAULT_TEXT 를 window 로도 노출 — block-drag.js(_gridBeginEdit)가 「이 셀이 안내문구인가」를
//   값-비교로 판정해야 하는데, 거기서 이 파일을 정적 import 하면 순환이다
//   (grid-block.js → drag-drop.js → `export * from './block-drag.js'`). 이 파일이 _gridEndEdit 에서
//   window.updateGridBlock 을 쓰는 것과 «같은» 브리지 관례를 따른다(아래 makeGridBlock 등과 동일 자리).
window.GRID_CELL_DEFAULT_TEXT = GRID_CELL_DEFAULT_TEXT;
window.makeGridBlock = makeGridBlock;
window.addGridBlock = addGridBlock;
window.updateGridBlock = updateGridBlock;
/* ★«끝 표본» 래퍼(js/model-update-history.js — window.update*Block 전부를 감싸 호출마다 pushHistory 를 한 칸 더 쌓는다)를
   «안 타는» 원본. 이름이 /^update[A-Z]\w*Block$/ 에 안 걸리게 Raw 로 끝낸다.
   ⛔일반 호출부는 window.updateGridBlock 을 쓴다. 이건 «자기 히스토리 칸을 직접 쌓는» 호출자 전용이다 —
     스크래치→그리드 칸 드롭(canvas-scratch-drop.js gridimg): scratch-pad onUp 이 sideEffects(스크래치 되살리기)가 실린
     「스크래치→섹션 변환」 칸을 쌓는데, 래퍼가 «같은 캔버스»의 칸을 하나 더 쌓으면 ⌘Z 첫 걸음이 화면이 안 바뀌는 먹통이 된다(실측 G4). */
window.updateGridBlockRaw = updateGridBlock;
/* ══ G15 캔버스 ＋ — 열·행을 «끝에» 하나 더한다 (2026-10-04 현빈·지디, 안 ㉠) ══════════════
 * ★자리 둘: 오른쪽 끝(열 +1) · 아래 끝(행 +1). 안 고른 안 ㉡(네 끝·앞에) ㉢(칸 사이)는 만들지 않는다.
 * ★동작은 우측 패널 4×4 피커와 «같은 함수»(gridResizeTo)를 지난다 — 새 칸 크기·내용·히스토리가
 *   피커 결과와 같아야 한다(측정 G15-MEASURE ⑷: 새 열 width:1 · 새 행 height:'auto' · 새 칸 기본 줄).
 * ★크기 = 40×40 «모델 px»(배율 따라 작아진다 — 태그블럭 ＋ 와 같은 단위 · H9/H10 2026-10-05).
 *   옛: calc(40px * var(--inv-zoom)) 화면 고정 — 배율 50 에서 라벨 ＋ 의 두 배였고, 그 단위가 그대로 H10(매달림·겹침 40 화면px)이었다.
 * ★＋ 는 그리드 블럭 «밖»의 층에 그린다 — #canvas-scaler 안 `#grd-plus-layer`(#canvas 의 형제 · 선례 #todo-pin-overlay).
 *   까닭(2026-10-04 실측) ⑴ E65: 블럭 안 <button>+</button> 이면 호버 중 '+' 가 PNG 클론·MCP get_canvas_state·검색(innerText)으로 샜다
 *     (tests/dom/grid-plus-g15-leak) ⑵ RG5: G12 배경이 블럭에 isolation 을 걸면 블럭 밖 아래 ＋ 가 뒤 형제 밑에 깔려 안 눌렸다
 *     ⑶ integ7 전수: 블럭 DOM·textContent·손잡이 수를 재는 다른 레인 시험 8곳이 깨졌다.
 *   ⇒ 블럭 DOM·textContent·저장·내보내기·읽기 길 어디에도 ＋ 가 없다. 글리프도 글자 '+' 가 아니라 svg(aria-hidden).
 *   (저장·내보내기 명부의 .grd-add-btn 줄은 «혹시 섞이면» 걷는 방어로 남긴다.)
 * ⛔태그블럭 ＋ 의 --inv-zoom 미보정(E28)은 여기서 안 고친다(범위 밖). */
const GRID_ADD_BTN_CLS = 'grd-add-btn';
const GRID_PLUS_LAYER_ID = 'grd-plus-layer';
const _gridPlusBtns = new Map();   // block → { col, row } — ＋ 가 떠 있는 블럭만(뜨면 넣고 지면 뺀다)
/* ＋ 층 — 없으면 #canvas-scaler 끝에 만든다. 스케일러가 없는 하네스(단위 시험 대역)에선 null ⇒ ＋ 없음. */
function _gridPlusLayer() {
  let L = document.getElementById(GRID_PLUS_LAYER_ID);
  if (L) return L;
  const scaler = document.getElementById('canvas-scaler');
  if (!scaler) return null;
  L = document.createElement('div');
  L.id = GRID_PLUS_LAYER_ID;
  scaler.appendChild(L);
  return L;
}

/* ★뜨는 조건 = «선택» — 그리드 블럭이 골라져 있으면(.selected) 두 ＋ 가 붙는다.
 *   역사: «호버»(현빈 2026-10-04 결정 — 태그블럭 ＋ 의 «선택» 선례와 일부러 다르게) → «선택 시»(현빈 2026-10-05 재지시 · H8).
 *   ⛔옛 줄을 지우지 않는다 — 결정이 «바뀐» 것이지 처음부터 이랬던 게 아니다.
 *   이제 태그블럭 ＋(.label-group-block.selected .label-group-add-btn)와 같은 조건이다.
 * ★클릭은 «＋ 버튼 그 자체»(둥근 원)만 받는다 — 「정확히 +버튼을 눌러야지만 칼럼추가」(현빈 2026-10-04).
 * ★조건은 이 함수 «하나»에만 둔다. 붙이고 떼는 계기 = 블럭 class 바뀜(아래 관측자) + 렌더 끝(_syncGridAddBtns).
 *   (옛 호버 장치 — mouseenter/leave · ＋ 상자까지 덮는 호버 네모 _inGridPlusZone/_trackGridPlusZone — 는 걷었다. 선택은 마우스 자리와 무관하다.) */
function _gridPlusShown(block) {
  return !!block?.classList?.contains('selected');
}

/* 블럭마다 한 번 — class 가 바뀌면(골라짐·풀림) 다시 맞춘다. ＋ 는 #canvas 밖 층이라 붙였다 떼도 자동저장 감시(#canvas)에 안 걸린다. */
const _gridPlusBound = new WeakSet();
function _bindGridPlusHover(block) {   // 이름은 옛 그대로(부르는 자리 하나 — _syncGridAddBtns) · 하는 일 = «선택» 관측
  if (!block?.addEventListener || _gridPlusBound.has(block) || typeof MutationObserver !== 'function') return;
  _gridPlusBound.add(block);
  let was = _gridPlusShown(block);
  new MutationObserver(() => {
    const now = _gridPlusShown(block);
    if (now === was) return;
    was = now;
    _syncGridAddBtns(block);
  }).observe(block, { attributes: true, attributeFilter: ['class'] });
}

/* 피커·＋ 공용 — 칸 수를 (nCols, nRows) 로 바꾼다. 바뀌었으면 true.
 * (원래 prop-grid.js 피커 콜백 몸통이었다 — ＋ 가 «같은 길»을 지나게 여기로 옮겼다. 내용은 그대로.) */
function gridResizeTo(block, nCols, nRows) {
  if (!block) return false;
  if (!(nCols >= MIN_COLS && nCols <= MAX_COLS && nRows >= MIN_ROWS && nRows <= MAX_ROWS)) return false;
  const curCols = JSON.parse(block.dataset.cols || '[]');
  const curRows = _gridRows(block);
  if (nCols === curCols.length && nRows === curRows.length) return false;
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
    // 1행으로 돌아가면 행 축 신설 이전 저장본과 «완전히 같은» 모양으로 되돌린다(dataset.rows/cells 제거).
    delete block.dataset.rows;
    /* ★T-178 — 다만 «행 0 칸 꾸밈»은 행이 하나가 돼도 살아 있어야 한다(1행 그리드의 칸도 칸이다).
       꾸밈이 하나도 없을 때만 dataset.cells 를 지워 그 옛 모양을 그대로 돌려준다. */
    let row0 = [];
    try { const cur = JSON.parse(block.dataset.cells || '[]'); row0 = Array.isArray(cur[0]) ? cur[0] : []; } catch (_) { row0 = []; }
    const keep = [];
    for (let c = 0; c < nCols; c++) {
      const cell = row0[c];
      keep.push((cell && typeof cell === 'object' && !Array.isArray(cell)) ? cell : {});
    }
    if (keep.some(cell => Object.keys(cell).length)) block.dataset.cells = _gridCellsToDataset([keep]);
    else delete block.dataset.cells;
  } else {
    const nextRows = [];
    for (let i = 0; i < nRows; i++) nextRows.push(curRows[i] || { height: 'auto' });
    block.dataset.rows = JSON.stringify(nextRows);
    /* ★새로 생긴 행에 «기본 내용»을 넣는다(안 넣으면 높이 0 — 무슨 일이 났는지 안 보인다).
     * ⚠️옛 내용을 보존하지 않는다 — 잘린 행/열의 내용은 사라지고 undo 로만 돌아온다.
     * ★T-178 — 행 0 에는 기본 줄을 «안» 넣는다: 행 0 의 줄은 cols[].lines 가 갖는다. */
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
    if (nextCells.length) block.dataset.cells = _gridCellsToDataset(nextCells);
    else delete block.dataset.cells;
  }
  renderGridBlock(block);
  window.scheduleAutoSave?.();
  return true;
}

/* ＋ 한 번 = 끝에 열(axis 'col') 또는 행(axis 'row') 하나. 상한이면 아무것도 안 한다. */
function gridAddAtEnd(block, axis) {
  const nC = _gridCols(block).length, nR = _gridRows(block).length;
  const ok = axis === 'col' ? gridResizeTo(block, nC + 1, nR)
           : axis === 'row' ? gridResizeTo(block, nC, nR + 1) : false;
  if (ok) window._grdAfterResize?.(block);   // 패널·거터가 이 블럭을 보고 있으면 다시 세운다(prop-grid.js)
  return ok;
}

function _syncGridAddBtns(block) {
  if (!block?.addEventListener) return;
  _bindGridPlusHover(block);
  let p = _gridPlusBtns.get(block);
  if (!_gridPlusShown(block) || !block.isConnected) { _dropGridPlus(block); return; }
  const L = _gridPlusLayer();
  if (!L) return;
  /* ⛔이미 떠 있으면 «갈아끼우지 않는다» — 흐림·자리만 맞춘다(마우스 밑 노드를 빼면 mouseenter 고리가 돈다 — 2026-10-04 실측). */
  if (!p || !p.col.isConnected || !p.row.isConnected) {
    _dropGridPlus(block);
    p = { col: _makeGridAddBtn(block, 'col'), row: _makeGridAddBtn(block, 'row') };
    L.append(p.col, p.row);
    _gridPlusBtns.set(block, p);
  }
  const full = { col: _gridCols(block).length >= MAX_COLS, row: _gridRows(block).length >= MAX_ROWS };
  /* 상한(8 — MAX_COLS·MAX_ROWS :82–83)에서는 흐리게 + 눌러도 아무 일 없음. ★흐림을 정하는 곳은 «여기 한 줄»(새로 붙일 때도 이미 있을 때도).
     캔버스 선례 없음 — 2026-10-04 신규 결정 (패널 쪽 참고 선례: layer-panel.js:559 addBtn.disabled) */
  for (const b of [p.col, p.row]) b.disabled = !!full[b.dataset.grdAdd];
  _placeGridAddBtns(block);
  _startGridPlusRaf();
}
function _dropGridPlus(block) {
  const p = _gridPlusBtns.get(block);
  if (p) { p.col.remove(); p.row.remove(); }
  _gridPlusBtns.delete(block);
}
/* 떠 있는 동안만 도는 rAF — 칸 글 입력·이웃 높이 변화·배율 전환 애니메이션을 따라간다(손잡이 층 선례 overlay-handles.js rAF).
   블럭이 문서에서 빠지면(삭제·⌘Z 교체) ＋ 도 걷는다. */
let _gridPlusRaf = 0;
function _startGridPlusRaf() {
  if (_gridPlusRaf || typeof requestAnimationFrame !== 'function') return;
  const loop = () => {
    _gridPlusRaf = 0;
    for (const blk of [..._gridPlusBtns.keys()]) {
      if (!blk.isConnected) { _dropGridPlus(blk); continue; }
      _placeGridAddBtns(blk);
    }
    if (_gridPlusBtns.size) _gridPlusRaf = requestAnimationFrame(loop);
  };
  _gridPlusRaf = requestAnimationFrame(loop);
}

/* ★＋ 의 기준 = «격자 껍데기(.grd-inner)» — 블럭 전체(껍데기 + G19 자식 그릇)가 아니다 (태양 2026-10-04).
 *   ＋ 는 격자의 «열·행»을 더하는 손잡이라서다. 오른쪽 ＋ = 껍데기 세로 가운데(블럭 오른쪽 끝 안쪽) · 아래 ＋ = 껍데기 바로 아래(블럭 가로 가운데).
 *   자식이 없으면 기준 = 블럭(= 껍데기 하나) — 블럭 안에 붙던 때와 같은 자리다(K0 이 잰다).
 * ★좌표 = 스케일러 «로컬» — #todo-pin-overlay 의 변환을 «그대로» 빌린다(js/checklist-panel.js _onCanvasClickForPin:
 *     `scale = (window.currentZoom || 40) / 100 · x = (clientX − scalerRect.left) / scale`). 층이 스케일러 «안»이라
 *     스크롤·배율(스케일러 transform)엔 저절로 따라가고, 블럭 쪽 변화(재렌더·크기·자식·이동·삭제)는 아래 rAF 가 다시 잰다.
 * ⚠️G19 자식 있을 때 아래 ＋ 가 첫 자식 위를 100% 15.8px · 40% 30.3px 덮는다 — 원 안만 히트라 의도대로(지디 2026-10-04 ㉠), 호버 중에만
 *   (지키는 시험: tests/dom/grid-plus-g15 K5 — 겹친 띠에서 원 안 = 행 +1 · 원 밖 1px = 행·열 그대로). */
function _placeGridAddBtns(block) {
  const p = _gridPlusBtns.get(block);
  const scaler = p && p.col.parentElement && p.col.parentElement.parentElement;
  if (!p || !scaler) return;
  const sr = scaler.getBoundingClientRect();
  const scale = (window.currentZoom || 40) / 100;   // ← checklist-panel.js _onCanvasClickForPin 와 같은 식
  const br = block.getBoundingClientRect();
  const inner = block.querySelector(':scope > .grd-inner');
  let kids = null;
  for (const ch of block.children) if (ch.classList.contains(GRID_CHILDREN_CLASS)) { kids = ch; break; }
  const ar = (inner && kids && kids.childElementCount > 0) ? inner.getBoundingClientRect() : br;
  const put = (b, x, y) => { const l = (x - sr.left) / scale + 'px', t = (y - sr.top) / scale + 'px'; if (b.style.left !== l) b.style.left = l; if (b.style.top !== t) b.style.top = t; };
  put(p.col, br.right, (ar.top + ar.bottom) / 2);
  put(p.row, (br.left + br.right) / 2, ar.bottom);
}

/* ＋ 글리프 = CSS ::before «+»(H9 · 태그블럭 ＋ 꼴) — 옛: 아이콘 정본 PLUS_ICON_SVG. 글자 노드는 없다(E65). */
function _makeGridAddBtn(block, axis) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = GRID_ADD_BTN_CLS;
  btn.dataset.grdAdd = axis;
  if (block.id) btn.dataset.grdFor = block.id;
  /* ★H9(2026-10-05) — 글리프는 태그블럭 ＋ 와 같은 «+» 글자 꼴. 단 글자 «노드»가 아니라 CSS ::before 로 그린다
     (E65 — 글자 '+' 가 PNG·MCP·검색으로 새던 병을 다시 안 연다). 옛: PLUS_ICON_SVG 14px(화면 고정). */
  const label = axis === 'col' ? '열 추가' : '행 추가';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  // ⛔캔버스 쪽 손(마키·팬·선택 해제)으로 새지 않게 — mousedown/click 을 여기서 멈춘다
  btn.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });
  /* 연타(같은 자리 두 번 = dblclick)가 블럭의 더블클릭(편집 진입)으로 새지 않게 — 예방(이것 때문에 깨진 실측은 없다) */
  btn.addEventListener('dblclick', e => { e.stopPropagation(); e.preventDefault(); });
  btn.addEventListener('click', e => {
    e.stopPropagation(); e.preventDefault();
    if (btn.disabled) return;
    gridAddAtEnd(block, axis);
  });
  return btn;
}
window.gridAddAtEnd = gridAddAtEnd;

window.renderGridBlock = renderGridBlock;
window.migrateGridIdentity = migrateGridIdentity;
// ★getGridModel(T-A, 2026-09-16) — block-drag.js 의 _gridAddrAt 이 「진짜 빈 셀」인지(lines.length===0)
//   판정하려고 window 경유로 부른다(block-drag.js 는 이 파일을 import 하지 않는다 — 기존 관례
//   그대로 window.updateGridBlock/renderGridBlock 과 같은 다리를 쓴다).
window.getGridModel = getGridModel;
window.getGridWidth = getGridWidth;   // G2-a — 다른 파일이 폭을 «읽을» 때도 이 문 하나
window.applyGridOwnWidth = applyGridOwnWidth;   // G2-b — 끄는 동안(손잡이·슬라이더) 매 틱 쓰는 문. 떠 있으면 굳힌 폭+키, 아니면 키
window.applyGridCellPadY = applyGridCellPadY;   // 제4안 — 끄는 동안(높이 손잡이) 매 틱 쓰는 문
window.getGridCellPadY = getGridCellPadY;       // 제4안 — 읽는 문(패널·손잡이)
window.GRID_CELL_PAD_Y_MAX = GRID_CELL_PAD_Y_MAX; // 제4안 — 패널 칸 상한(같은 수 한 자리)
window.whenGridRatiosSettled = whenGridRatiosSettled;   // ★E157 — 내보내기·캡처 입구 공용 대기
window.gridTrackMin = gridTrackMin;                     // ★한 식(진단·시험용 읽기)
window.syncAutoGridWidth = syncAutoGridWidth;   // F3 후속 — 옮긴 뒤 자동 폭을 새 자리에 맞춘다(떠나면 100%)
window.fitGridWidthToFreeFrame = fitGridWidthToFreeFrame;   // F3 — 자유배치 프레임 입구 셋이 부른다(drag-utils·block-drag 는 이 파일을 import 안 함)
window.fitKeylessFreeFrameGridsOnOpen = fitKeylessFreeFrameGridsOnOpen;   // E129 — 열기 길 셋(save-load.js)이 applyPageSettings 뒤에 부른다

// ★deprecated 별칭 — 2026-09-05 개명 이전 이름. scripts/goditor_runner.js 와 외부 스킬 md·
//   다른 맥의 CDP 스크립트가 아직 이 이름을 부른다. 제거는 P1(러너·스킬 md 갱신 «후»).
window.makeDuoBlock = makeGridBlock;
window.addDuoBlock = addGridBlock;
window.updateDuoBlock = updateGridBlock;
window.renderDuoBlock = renderGridBlock;

// innercard-block 등 라인 스택형 블록이 같은 롤/렌더를 공유한다 (부품 공유 — 현빈 지시 2026-07-03)
// ★getGridModel/gridRows: 「옛 파일 승격」이 실제로 일어나는 단일 진입점 — 단위테스트가
//   DOM 없이 순수 데이터(fake block = {dataset:{...}})로 이걸 직접 검사한다.
export {
  makeGridBlock, addGridBlock, updateGridBlock, renderGridBlock, GRID_DEFAULTS,
  _gridLineHtml as gridLineHtml, _GRID_ROLES as GRID_ROLES,
  /* ★BT2(2026-10-04) — 버블·챗 줄이 «같은 명부·같은 병합»을 쓴다(두 벌 금지). 선언 줄은 안 건드렸다(P7 파싱 무관). */
  GRID_LINE_FIELDS, _gridMergeLine as gridMergeLine,
  _GRID_COLOR_RE as GRID_COLOR_RE, _GRID_FONT_RE as GRID_FONT_RE,
  getGridModel, _gridRows as gridRows, _gridCols as gridCols,
  getGridWidth, _gridValidateWidth as gridValidateWidth, fitGridWidthToFreeFrame, syncAutoGridWidth, applyGridOwnWidth,
  getGridCellPadY, applyGridCellPadY,
  MIN_COLS, MAX_COLS, MIN_ROWS, MAX_ROWS, MAX_CELL_LINES,
  _gridGaps as gridGaps, _gridCellsToDataset as gridCellsToDataset,
  _gridBlockOutline as gridBlockOutline,   /* ★G17 — 패널이 «같은 읽는 문»을 쓴다 */
  _gridBlockBg as gridBlockBg,   /* ★G12 — 패널·내보내기가 «같은 읽는 문»을 쓴다 */
  _gridCellBorder as gridCellBorder,   /* ★T-172 — 패널이 «같은 읽는 문»을 쓴다(두 벌 금지) */
  /* ★GRID_CELL_FIELDS — 칸 필드의 «정본 명부». 패널(prop-grid.js)이 「이 열에 기본값이
     걸려 있나」를 물을 때 이걸 쓴다. ⛔패널 쪽에 이름을 베끼면 두 벌이 되어 따로 늙는다
     (T-172 테두리처럼 새 칸 필드가 생기면 한쪽만 모른다). 선언 줄은 «그대로»라
     grid-patchcell-reject.test.js P7 의 소스 파싱은 영향받지 않는다. */
  GRID_CELL_FIELDS,
  /* ★GRID_NESTED_LINE_TYPE — 중첩 줄의 «정본 이름». 패널(prop-grid.js)이 중첩 주소를
     모델로 걸어 내려갈 때 「이 줄이 중첩인가」를 물으려고 쓴다. ⛔그 이름을 패널 쪽에
     손으로 베끼면 두 벌이 되어 따로 늙는다(위 GRID_CELL_FIELDS 와 같은 까닭).
     ★실제로 grid-rename-residue.test.mjs S1 이 「코드에 옛 이름을 손으로 적었나」를 재는데,
       이 주석의 첫 판이 «그 이름을 예시로 적는» 바람에 그 그물에 걸렸다. 적지 않는다. */
  GRID_NESTED_LINE_TYPE,
  gridResizeTo, gridAddAtEnd,   /* ★G15 — 피커·캔버스 ＋ 가 «같은 길» */
};

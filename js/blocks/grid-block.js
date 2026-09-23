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
const MIN_COLS = 1, MAX_COLS = 4;
const MIN_ROWS = 1, MAX_ROWS = 4;   // 1행 = 옛 duo 파일과 동일(행 축 신설 이전 기본값).
/* ★셀당 줄 개수 상한 — SSOT(2026-09-16). 이전엔 이 파일(:205)과 prop-grid.js(:367)가 각자
 *   리터럴 20을 들고 있었다(하드코딩 2건 반복 — MIN_COLS/MAX_COLS 사고와 같은 유형).
 *   grdAddLine(prop-grid.js)이 이 값을 import 해서 사전 확인한다. */
const MAX_CELL_LINES = 20;

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

/** gap/rowGap/colGap 공용 검증 — 0~GRID_GAP_MAX. 통과면 정수, 아니면 null. */
function _gridValidateGap(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > GRID_GAP_MAX) return null;
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
const _GRID_ROLES = {
  label:   { size: 16, weight: 600, lh: 1.4, ls: '0.04em',  color: '#555555' },
  h1:      { size: 64, weight: 800, lh: 1.1, ls: '-0.02em', color: '#111111' },
  h2:      { size: 40, weight: 700, lh: 1.2, ls: '-0.01em', color: '#1a1a1a' },
  h3:      { size: 28, weight: 700, lh: 1.3, ls: '0',       color: '#333333' },
  body:    { size: 22, weight: 400, lh: 1.6, ls: '0',       color: '#555555' },
  caption: { size: 14, weight: 400, lh: 1.5, ls: '0',       color: '#999999' },
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
  'gap', 'height', 'imgSrc', 'italic', 'items', 'labelColor', 'labelSize',
  'letterSpacing', 'lineHeight', 'marginTop', 'padH', 'padV', 'radius', 'strike',
  'text', 'trackColor', 'type', 'valign', 'valueColor', 'valueSize', 'weight', 'widthPct',
]);

/** `renderGridBlock` 이 셀에서 읽는 것(`cell.lines` + `pick(...)`) — patchCell 로 줄 수 있는 필드.
 *  ⚠️`width` 는 «열» 속성이라 여기 없다 — 셀로 주면 조용히 버려진다. 거절 메시지가 patchCol 로 보낸다. */
const GRID_CELL_FIELDS = new Set(['lines', 'align', 'valign', 'bg', 'padding', 'radius']);

/** `cols[c]` 가 받는 것 — 칸 필드 «전부» ＋ `width`(열 전용). ⛔손으로 베끼지 않는다.
 *  renderGridBlock 이 `pick(k)` 로 칸 값이 없을 때 `col[k]` 를 읽으므로, 열이 받는 꾸밈은
 *  칸이 받는 것과 «같은 명부»다. 다른 것은 `width` 하나뿐이고 그건 열에만 있다
 *  (거절 메시지가 「width 는 열 필드다」라고 돌려보내는 바로 그 자리). */
const GRID_COL_FIELDS = new Set(['width', ...GRID_CELL_FIELDS]);

/** 꾸밈 필드 중 «값이 명부로 묶인» 것 — 칸이든 열이든 같다. ⛔이름 말고 «표»로 묶는다. */
const GRID_ENUM_FIELDS = { align: GRID_ALIGN_VALUES, valign: GRID_VALIGN_VALUES };

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
const GRID_VALUE_TESTS = {
  bg: (v) => _GRID_COLOR_RE.test(String(v).trim()),
  color: (v) => _GRID_COLOR_RE.test(String(v).trim()),
  fontFamily: (v) => _GRID_FONT_RE.test(String(v).trim()),
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

/* ★셀 lines 배열 길이 가드 — patchCell{lines} 뿐 아니라 partial.cells(통째 R×C, MCP가 오는 길)도
   같은 셀 모양을 쓰므로 같이 통과시킨다(2026-09-15 a1-a3 지적 — patchCell만 막으면 통째 경로가
   그대로 뚫려 있었다). 0개: 우클릭 "이미지 삭제"가 마지막 줄까지 지워 [data-line]이 통째로
   사라지던 것. 상한 20: "+ 줄 추가" 무한증식(banner02/laurel과 같은 값).
   ★코드를 둘로 나눈다(EMPTY_CELL_LINES/TOO_MANY_LINES) — 호출부(block-factory.js)가 res.message를
   그대로 토스트에 얹지 않고 code로 한국어 문구를 고르게 하기 위해서다.
   ★allowEmpty(2026-09-15 a1-a3 2차 지적, 반례로 반박됨): 0개 거부는 patchCell(기존 줄을
   «지우는» 동작)에만 건다. cells 통째 경로는 read(getGridModel) → 한 칸만 고쳐 → 통째로
   다시 쓰기가 정상 MCP 왕복이라, 다른 칸이 «원래부터» 빈 채(새 행/열의 의도된 초기상태,
   getGridModel이 lines:[]로 정규화해 돌려준다)로 껴 있으면 그 칸과 무관하게 호출 전체가
   막힌다 — 상한(20)만 걸고 0개는 통과시킨다. */
function _gridRejectLinesLength(lines, allowEmpty) {
  if (!Array.isArray(lines)) return null;
  if (lines.length === 0 && !allowEmpty) {
    return { ok: false, code: 'EMPTY_CELL_LINES', message: 'cell lines cannot be emptied — remove the row/column instead' };
  }
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
  return {
    kind: 'truncate',
    shrank,
    /* ⚠️«칸 수»지 «줄 수»가 아니다 — 무엇을 센 건지 이름에 적어 둔다. */
    droppedCells: lost.map(x => `cells[${x.r}][${x.c}]`),
    message: `DESTRUCTIVE REPLACE — ${shrank.join(', ')}. `
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
    violations.push(..._gridValueViolations(node, where));
    scanLines(node.lines, where, addr);
  };

  /* ── 문 ①·② «이름을 대어 준» 쪽 — 모르는 이름·값은 거절한다 ───────────────── */
  if (partial.patchCell !== undefined) {
    const p = partial.patchCell;
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      const { r: _r, c: _c, lineIndex, ...rest } = p;
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
         *  ★★`lines` 는 「`null` = 그 키를 지운다」 계약의 «예외»다. 그 계약을 모든 키에 똑같이
         *    걸면 이 옆문이 «설계»가 된다. 칸의 줄은 patchCell 로 비울 수 없다(위 규칙 그대로).
         *  ⛔`=== null` 만 막지 마라 — 두 옆문은 «독립된 축»이다(평가자 음성대조: null 만 막은
         *    시제품에서 L1 초록 · L2 빨강). 「배열이 아니면」으로 한 번에 닫는다.
         *  ⛔`rest.lines === undefined` 로 보지 마라 — 「안 줬음」과 「undefined 를 줬음」이 안 갈린다.
         *    `'lines' in rest` 가 그 둘을 가른다(rest 는 spread 라 값이 undefined 인 키도 남는다). */
        if ('lines' in rest && !Array.isArray(rest.lines)) {
          const t = rest.lines === null ? 'null' : typeof rest.lines;
          return { ok: false, code: 'EMPTY_CELL_LINES',
            message: `patchCell.lines must be an array (got ${t}) — cell lines cannot be emptied, `
              + 'remove the row/column instead. To edit one line use patchCell{lineIndex, ...}.' };
        }
        const _linesReject = _gridRejectLinesLength(rest.lines);
        if (_linesReject) return _linesReject;
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
      const lenReject = _gridRejectLinesLength(rest.lines, /* allowEmpty */ true);
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
         ⛔allowEmpty=true — 빈 열(`lines:[]`)은 정상이다(새 열의 의도된 초기상태). */
      const _colLinesReject = _gridRejectLinesLength(col.lines, /* allowEmpty */ true);
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
        const _reject = _gridRejectLinesLength(cell && cell.lines, /* allowEmpty */ true);
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
    for (const k of keys) {
      if (fields[k] !== undefined) continue;
      if (unreadNow.has(k) && !unreadBefore.has(k)) delete merged[k];
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
function _gridLineHtml(line, colAlign, depth = 0, addr = null, useRoleColor = false) {
  if (!line || typeof line !== 'object') return '';
  // ★필드 별칭 정규화 (2026-07-04 bench2 근본픽스): planner/generator는 텍스트블록 어휘(content)를
  // 라인에도 쓴다 — text만 읽으면 "그릇만 있고 내용 없음"(오렌지 바에 빈 텍스트, duo 통째 미렌더).
  // 러너는 pass-through(계약: 스펙 필드 = API 필드)이므로 파서가 별칭을 수용하는 게 1:1 계약의 근본 해법.
  if (line.text === undefined && line.content !== undefined) line = { ...line, text: line.content };
  const mt = Number.isFinite(Number(line.marginTop)) ? Number(line.marginTop) : null;
  const mtCss = mt !== null ? `margin-top:${mt}px;` : '';
  const addrAttr = addr ? ` data-r="${addr.r}" data-c="${addr.c}" data-line="${addr.li}"` : '';
  if (line.type === 'gap') {
    const h = Number(line.height) || 16;
    return `<div${addrAttr} class="grd-gap" style="height:${h}px;${mtCss}"></div>`;
  }
  if (line.type === 'image') {
    const h = Number(line.height) || 0;
    const r = Number(line.radius) || 0;
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
      const ph = h > 0 ? h : 180;
      return `<div${addrAttr} class="grd-img grd-img-empty" style="${widthCss}height:${ph}px;background:#e8e8e8;` +
        `border-radius:${r > 0 ? r : 8}px;${alignCss}${mtCss}"></div>`;
    }
    const sizeCss = h > 0 ? `height:${h}px;object-fit:cover;` : 'height:auto;';
    return `<img${addrAttr} class="grd-img" src="${_esc(line.imgSrc)}" draggable="false" style="display:block;${widthCss}${sizeCss}${r > 0 ? `border-radius:${r}px;` : ''}${alignCss}${mtCss}">`;
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
    const colsHtml = cols.map(c => {
      const w = Number(c.width) || 1;
      const inner = (Array.isArray(c.lines) ? c.lines : [])
        .map(l => _gridLineHtml(l, c.align || colAlign, depth + 1, null, useRoleColor)).join('');   // ⛔addr 미전달(중첩은 아직 미주소화)
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
  const effColor = color || (useRoleColor ? role.color : '');
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
function renderGridBlock(block) {
  const { cols, rows, cells } = getGridModel(block);
  const { row: rowGapPx, col: colGapPx } = _gridGaps(block);
  const blockValign = _gridEnum(_GRID_VALIGN, block.dataset.valign) || 'flex-start';
  const cellBorder = _gridCellBorder(block);   // ★T-172 — «블록» 축. 칸 축(pick)과 섞지 않는다.

  block.style.width = '100%';
  block.style.boxSizing = 'border-box';

  const colTemplate = cols.map(c => `${Number(c.width) > 0 ? Number(c.width) : 1}fr`).join(' ');
  // ★행 높이는 «가중치»가 아니라 px 최소높이(minmax) — 3-A U5a 의미론. 'auto' 행은 내용 높이 그대로.
  const rowTemplate = rows.map(r => r.height === 'auto' ? 'auto' : `minmax(${r.height}px, auto)`).join(' ');

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
      // ★각 라인에도 좌표를 심는다(data-r/data-c/data-line) — 현빈 2026-09-04 지시.
      //   ★2026-09-05 P1.5 부터 «실제로 읽는 소비자»가 있다: js/block-drag.js 의 캔버스 인라인 편집이
      //   blur 때 「어느 셀 몇 번째 줄인가」를 DOM 순서 추측 없이 여기서 바로 읽어 patchCell 로 커밋한다.
      // ★grd-cell-empty(T-A) — 아직 줄이 하나도 없는 칸. CSS 안내문(+ 내용 추가)과 클릭 판정
      //   (block-drag.js _gridAddrAt)이 「진짜 빈 칸」을 이 표식으로 가른다.
      const emptyCls = lines.length === 0 ? ' grd-cell-empty' : '';
      cellsHtml.push(`<div class="grd-cell${emptyCls}" data-r="${r}" data-c="${c}" style="min-width:0;min-height:0;display:flex;flex-direction:column;justify-content:${cv};${bg ? `background:${bg};` : ''}${pad > 0 ? `padding:${pad}px;` : ''}${rad > 0 ? `border-radius:${rad}px;` : ''}${_gridCellBorderCss(cellBorder, r, c, rowGapPx, colGapPx)}">
        ${lines.map((l, li) => _gridLineHtml(l, align, 0, { r, c, li }, true)).join('')}
      </div>`);
    }
  }

  block.innerHTML = `<div class="grd-inner" style="display:grid;grid-template-columns:${colTemplate};grid-template-rows:${rowTemplate};row-gap:${rowGapPx}px;column-gap:${colGapPx}px;width:100%;">
    ${cellsHtml.join('')}
  </div>`;
}

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
  if (opts.gap !== undefined && _gridValidateGap(opts.gap) === null) {
    drops.push({ path: 'gap', why: `${JSON.stringify(opts.gap)} is outside 0~${GRID_GAP_MAX}. ⚠️It was STORED ANYWAY (behaviour unchanged), `
      + 'but update_grid_block refuses that range — so this value cannot be edited back through that field' });
  }
  block.dataset.gap = String(Number.isFinite(Number(opts.gap)) ? Number(opts.gap) : GRID_DEFAULTS.gap);
  // ★rowGap/colGap 은 «주어졌을 때만» dataset 에 쓴다 — 안 주면 옛 파일과 완전히 같은 모양(legacy gap 폴백).
  for (const k of ['rowGap', 'colGap']) {
    if (opts[k] === undefined) continue;
    const v = _gridValidateGap(opts[k]);
    if (v !== null) block.dataset[k] = String(v);
    else drops.push({ path: k, why: `${JSON.stringify(opts[k])} is outside 0~${GRID_GAP_MAX} — it was not written, so this axis falls back to gap` });
  }
  /* ★T-172 칸 테두리도 «주어졌을 때만» 쓴다 — 안 주면 옛 파일과 dataset 이 완전히 같다. */
  if (opts.cellBorderWidth !== undefined) { const v = _gridValidateBorderWidth(opts.cellBorderWidth); if (v !== null) block.dataset.cellBorderWidth = String(v); }
  if (typeof opts.cellBorderColor === 'string' && _GRID_COLOR_RE.test(opts.cellBorderColor.trim())) block.dataset.cellBorderColor = opts.cellBorderColor.trim();
  if (GRID_BORDER_STYLES.includes(opts.cellBorderStyle)) block.dataset.cellBorderStyle = opts.cellBorderStyle;
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
 *   MCP(main.js:7024)는 2인자로만 부르므로 이 통로는 IPC 에 노출되지 않는다(실측 확인). */
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
    next.cells = _gridCellsToDataset(cellRows);
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
    const { r: _r, c: _c, lineIndex, ...rest } = p;
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
      cellPatch = { lines: _gridMergeLine(curLines, li, rest) };

      /* ★T-122 — 이름 검사(_gridRejectUnknownCellFields)를 통과해도 «그 줄 종류»가 안 읽으면
         화면은 그대로다(글자 줄에 imgSrc 가 그 자리다). 렌더러를 돌려서 «민감도»로 잰다. */
      const mergedLine = cellPatch.lines[li];
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
    const v = _gridValidateGap(partial.rowGap);
    if (v === null) return { ok: false, code: 'INVALID', message: `rowGap must be 0~${GRID_GAP_MAX}` };
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
  if (partial.valign !== undefined) {
    /* ★명부는 _GRID_VALIGN «하나»에서 온다 — 전엔 여기와 makeGridBlock 이 각자 리터럴을
       들고 있었다(MIN_COLS/MAX_COLS 사고와 같은 유형, T-175). 칸 축도 같은 명부를 본다. */
    if (!GRID_VALIGN_VALUES.includes(partial.valign)) {
      return { ok: false, code: 'INVALID', message: `valign must be ${GRID_VALIGN_VALUES.join('|')}` };
    }
    next.valign = partial.valign;
    applied.valign = partial.valign;
  }
  if (Object.keys(next).length === 0) {
    return { ok: false, code: 'INVALID', message: 'no recognized fields — expected one of cols/patchCol/rows/cells/patchCell/gap/rowGap/colGap/valign/cellBorderWidth/cellBorderColor/cellBorderStyle' };
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
  };
  const restore = (snap) => {
    ['cols', 'gap', 'valign', 'rows', 'cells', 'rowGap', 'colGap',
      'cellBorderWidth', 'cellBorderColor', 'cellBorderStyle'].forEach(k => {
      if (snap[k] === undefined) delete block.dataset[k]; else block.dataset[k] = snap[k];
    });
  };
  window.pushHistory?.();
  Object.assign(block.dataset, next);
  try {
    renderGridBlock(block);
  } catch (e) {
    restore(before); // rollback
    try { renderGridBlock(block); } catch (_) {}
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }
  if (block.classList.contains('selected')) {
    try { window.showGridProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}
  window.scheduleAutoSave?.();
  /* ★T-122 — `applied.cells` 는 «보낸 값»이 아니라 «커밋 뒤 모델»이다. getGridModel 이 돌려주는
     것이 곧 렌더러가 읽는 것이라, 이 값은 «화면과 같은 말»이 된다(메아리는 그렇지 않았다). */
  if (appliedCellsPending) applied.cells = _gridRenderedCells(getGridModel(block).cells);
  if (appliedColsPending) applied.cols = _gridRenderedCols(getGridModel(block).cols);
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
export function gridPreviewLine(block, r, c, li, fields) {
  if (!block) return false;
  const cols = _gridCols(block);
  const rows = _gridRows(block);
  const R = Number(r), C = Number(c);
  if (!(R >= 0 && R < rows.length) || !(C >= 0 && C < cols.length)) return false;
  const cellRows = _gridCellRows(block, cols, rows.length);
  // ★줄 내용의 자리 — 행 0 은 cols[C], 그 아래는 cells[R][C] (T-178 뒤에도 그대로다).
  const curCell = R === 0 ? cols[C] : cellRows[R][C];
  const nextLines = _gridMergeLine(curCell && curCell.lines, li, fields);
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
window.renderGridBlock = renderGridBlock;
window.migrateGridIdentity = migrateGridIdentity;
// ★getGridModel(T-A, 2026-09-16) — block-drag.js 의 _gridAddrAt 이 「진짜 빈 셀」인지(lines.length===0)
//   판정하려고 window 경유로 부른다(block-drag.js 는 이 파일을 import 하지 않는다 — 기존 관례
//   그대로 window.updateGridBlock/renderGridBlock 과 같은 다리를 쓴다).
window.getGridModel = getGridModel;

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
  _GRID_COLOR_RE as GRID_COLOR_RE, _GRID_FONT_RE as GRID_FONT_RE,
  getGridModel, _gridRows as gridRows, _gridCols as gridCols,
  MIN_COLS, MAX_COLS, MIN_ROWS, MAX_ROWS, MAX_CELL_LINES,
  _gridGaps as gridGaps, _gridCellsToDataset as gridCellsToDataset,
  _gridCellBorder as gridCellBorder,   /* ★T-172 — 패널이 «같은 읽는 문»을 쓴다(두 벌 금지) */
  /* ★GRID_CELL_FIELDS — 칸 필드의 «정본 명부». 패널(prop-grid.js)이 「이 열에 기본값이
     걸려 있나」를 물을 때 이걸 쓴다. ⛔패널 쪽에 이름을 베끼면 두 벌이 되어 따로 늙는다
     (T-172 테두리처럼 새 칸 필드가 생기면 한쪽만 모른다). 선언 줄은 «그대로»라
     grid-patchcell-reject.test.js P7 의 소스 파싱은 영향받지 않는다. */
  GRID_CELL_FIELDS,
};

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
//   cells = [[{align?,valign?,bg?,padding?,radius?,lines[]}, …], …]      // ★«행 1 이후만» 저장한다(행 0 은 없음)
// ★단일 진실원 유지: 행 0 의 콘텐츠는 cols[c].lines 「하나」뿐이다 — cells 안에 행 0 을 따로
//   복제해 두면(예: cells[0]) 두 값이 어긋나는 전형적 2-소스 버그가 생긴다(이 레포의 dataset
//   단일 진실원 불변식 위반). getGridModel()가 cols 로부터 행 0 을 «항상 재구성»해서 돌려준다 —
//   이게 곧 「cells 없는 옛 파일의 승격」이다(모든 블록이 항상 이 경로를 거친다).
// cols[].lines: [{ type:'label|h1|h2|h3|body|caption|image|gap',
//                  text?, fontSize?, color?, weight?, align?, marginTop?,
//                  imgSrc?, height?(image/gap), radius?(image) }]

import { ROW_H_MAX } from '../grid-cell-resize.js';   // ★행 높이 상한은 한 곳에서만 온다
import { insertAfterSelected, genId } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

const GRID_DEFAULTS = {
  gap: 24,
  valign: 'top', // top | middle | bottom
  cols: [
    { width: 1, lines: [{ type: 'h2', text: '왼쪽 컬럼' }, { type: 'body', text: '내용을 입력하세요.' }] },
    { width: 1, lines: [{ type: 'h2', text: '오른쪽 컬럼' }, { type: 'body', text: '내용을 입력하세요.' }] },
  ],
};
const ROW_DEFAULT = { height: 'auto' };
// ★한도 — 3곳(이 파일의 _gridCols/_gridRows, updateGridBlock 검증)이 «같은 값»을 봐야 한다
//   (P0 EVAL이 지적한 「열거 자리가 흩어진다」 재발 방지 — 한 곳에 모은다).
const MIN_COLS = 2, MAX_COLS = 4;   // ⛔1열은 그대로 막아둔다(그리드 최소 형태). PLAN §3-A "1열 허용 여부는 결정 필요"에 대한 답.
const MIN_ROWS = 1, MAX_ROWS = 4;   // 1행 = 옛 duo 파일과 동일(행 축 신설 이전 기본값).

// 컬럼 스케일 텍스트 롤 기본값 (풀폭 h1 104px는 다단에선 과대 — 컬럼용 축소 기준)
const _GRID_ROLES = {
  label:   { size: 16, weight: 600, lh: 1.4, ls: '0.04em' },
  h1:      { size: 64, weight: 800, lh: 1.1, ls: '-0.02em' },
  h2:      { size: 40, weight: 700, lh: 1.2, ls: '-0.01em' },
  h3:      { size: 28, weight: 700, lh: 1.3, ls: '0' },
  body:    { size: 22, weight: 400, lh: 1.6, ls: '0' },
  caption: { size: 14, weight: 400, lh: 1.5, ls: '0' },
};
const _GRID_VALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
const _GRID_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|transparent)$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;
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

// ★dataset.cells 는 «행 0 을 뺀 나머지 행」만 담는다(위 헤더 주석 참조 — 단일 진실원).
//   rowCount(행 0 포함 전체 행 수) 만큼 나올 «추가 행» 배열을 cols.length 열에 맞춰 pad/truncate.
function _gridExtraRows(block, cols, rowCount) {
  let extra;
  try { extra = JSON.parse(block.dataset.cells || '[]'); } catch (_) { extra = []; }
  if (!Array.isArray(extra)) extra = [];
  const need = Math.max(0, rowCount - 1);
  const C = cols.length;
  const out = [];
  for (let i = 0; i < need; i++) {
    const src = Array.isArray(extra[i]) ? extra[i] : [];
    const row = [];
    for (let c = 0; c < C; c++) {
      const cell = (src[c] && typeof src[c] === 'object') ? src[c] : {};
      // ★lines 는 항상 배열로 정규화한다 — 행0 셀(cols 기반)이 늘 lines:[] 를 갖는 것과 «같은 모양»으로
      //   맞춰야 getGridModel() 소비자가 r===0 이든 아니든 같은 코드로 cell.lines 를 다룰 수 있다.
      row.push(Array.isArray(cell.lines) ? cell : { ...cell, lines: [] });
    }
    out.push(row);
  }
  return out;
}

// col(열 기본값) 에 cell(행 0 이 아닌 개별 셀 오버라이드)을 merge — patchCol/patchCell{r:0} 공용.
function _mergeCellIntoCol(col, cell) {
  if (!cell || typeof cell !== 'object') return col;
  const next = { ...col };
  if (Array.isArray(cell.lines)) next.lines = cell.lines;
  ['align', 'valign', 'bg', 'padding', 'radius'].forEach(k => { if (cell[k] !== undefined) next[k] = cell[k]; });
  return next;
}

// API 경계(add_block/update_block{cells})는 «행 0 포함 전체 R×C」를 받는다(PLAN §3-A 스키마 그대로) —
// 내부 저장만 행 0 을 cols 로 흡수한다(단일 진실원). 여기서 그 경계를 나눈다.
function _splitFullCells(fullCells, cols) {
  if (!Array.isArray(fullCells) || !fullCells.length) return { cols, extra: [] };
  const row0 = Array.isArray(fullCells[0]) ? fullCells[0] : [];
  const mergedCols = cols.map((col, c) => _mergeCellIntoCol(col, row0[c]));
  const extra = fullCells.slice(1).map(row => (Array.isArray(row)
    ? row.map(cell => (cell && typeof cell === 'object') ? cell : {})
    : []));
  return { cols: mergedCols, extra };
}

/** 블록의 dataset 에서 전체 그리드(cols/rows/cells)를 읽는다 — «옛 파일 승격」의 단일 진입점.
 *  cells 는 항상 «행 0 포함» 전체 rows.length × cols.length 로 재구성해서 돌려준다(렌더·API 응답용).
 *  dataset.rows/cells 가 아예 없는 옛 파일도 이 함수를 거치면 1행 그리드로 승격된 모양이 나온다 —
 *  옛 파일이라고 다른 코드 경로를 타지 않는다(늘 같은 함수, 승격은 '있으면 쓰고 없으면 기본값'뿐).
 */
function getGridModel(block) {
  const cols = _gridCols(block);
  const rows = _gridRows(block);
  const extra = _gridExtraRows(block, cols, rows.length);
  const row0 = cols.map(c => ({
    lines: Array.isArray(c.lines) ? c.lines : [],
    align: c.align, valign: c.valign, bg: c.bg, padding: c.padding, radius: c.radius,
  }));
  return { cols, rows, cells: [row0, ...extra] };
}

// ★addr(4번째 인자, 신설) — 「캔버스 인라인 편집을 전제로」 셀 텍스트 주소를 렌더 시점에 심는다
//   (2026-09-04 현빈 지시, P1.5 선행 설계). {r,c,li} 를 받으면 반환 요소의 최상위 태그에
//   data-r/data-c/data-line 을 찍는다 — blur 때 「이 DOM 이 어느 셀의 몇 번째 줄인가」를 DOM
//   순서 추측 없이 바로 읽을 수 있어야 한다(이 레포에서 순서 추측이 실제 버그를 낸 전례가 있다).
//   ⛔addr 은 «최상위 라인»에만 찍는다 — 중첩 duo/graph 내부(depth≥1)는 addr 없이 그대로 호출해
//     기존 출력과 byte-identical 을 유지한다(innercard 등 무변화 요구 — addr=null 이면 이 함수
//     전체가 P0/P1 이전과 동일 문자열을 낸다).
function _gridLineHtml(line, colAlign, depth = 0, addr = null) {
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
    if (!line.imgSrc) {
      // 빈 이미지 슬롯: 발주 대기 placeholder (기존 ''=투명 소실 → 카드가 깨져 보이던 문제)
      const ph = h > 0 ? h : 180;
      return `<div${addrAttr} class="grd-img grd-img-empty" style="width:100%;height:${ph}px;background:#e8e8e8;` +
        `border-radius:${r > 0 ? r : 8}px;${mtCss}"></div>`;
    }
    const sizeCss = h > 0 ? `height:${h}px;object-fit:cover;` : 'height:auto;';
    return `<img${addrAttr} class="grd-img" src="${_esc(line.imgSrc)}" draggable="false" style="display:block;width:100%;${sizeCss}${r > 0 ? `border-radius:${r}px;` : ''}${mtCss}">`;
  }
  // 중첩 duo: {type:'duo', gap, valign, cols:[{width, lines[]}]} — innercard 후기카드 등 (BL-SFB-01)
  if (line.type === 'duo') {
    if (depth >= 2) return '';                       // 무한 중첩 가드 (2단까지)
    // ⛔중첩 duo(라인 안의 duo)는 상한 3 «그대로» — 4x4 피커는 «블록» 대상이라
    //   중첩까지 넓히면 innercard 렌더 회귀 범위가 커진다(PLAN §P1 회귀위험).
    const cols = Array.isArray(line.cols) ? line.cols.slice(0, 3) : [];
    if (!cols.length) return '';
    const gap = Number(line.gap) || 24;
    const valign = _GRID_VALIGN[line.valign] || 'flex-start';
    const colsHtml = cols.map(c => {
      const w = Number(c.width) || 1;
      const inner = (Array.isArray(c.lines) ? c.lines : [])
        .map(l => _gridLineHtml(l, c.align || colAlign, depth + 1)).join('');   // ⛔addr 미전달(중첩은 아직 미주소화)
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
  const align = line.align || colAlign || 'left';
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
  return `<div${addrAttr} class="grd-line grd-${_esc(line.type || 'body')}" style="font-size:${size}px;font-weight:${weight};line-height:${role.lh};letter-spacing:${role.ls};text-align:${align};${color ? `color:${color};` : ''}${mtCss}white-space:pre-wrap;word-break:keep-all;">${_esc(line.text ?? '')}</div>`;
}

// ★2026-09-04 P1: flex → CSS grid(PLAN §3-A) — 행 축을 넣으려면 열끼리 «경계가 맞아야»
//   한다(스프레드시트 드래그가 목표, 5절/P2), flex 행 스택(R1안)은 그게 안 돼 탈락했다.
//   열은 이전과 «같은 비율»(가중치)이라 fr 단위로 바로 옮긴다 — flex:(pct) 1 0 → <w>fr 은
//   수학적으로 같은 분배지만 반올림 경로가 달라 1px 안팎 흔들릴 수 있다(완료조건, QA 대상).
function renderGridBlock(block) {
  const { cols, rows, cells } = getGridModel(block);
  const gap = parseInt(block.dataset.gap);
  const gapPx = Number.isFinite(gap) ? gap : GRID_DEFAULTS.gap;
  const blockValign = _GRID_VALIGN[block.dataset.valign] || 'flex-start';

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
      // 셀 속성 우선순위: cell > col > block(valign) — PLAN §3-A. 행 0 은 cell===col 이라
      // pick()이 늘 col 값을 돌려주므로(값이 같다) 아래는 모든 행에 대해 «같은 코드»로 맞다.
      const pick = (k) => (cell[k] !== undefined ? cell[k] : col[k]);
      const lines = Array.isArray(cell.lines) ? cell.lines : [];
      const align = pick('align');
      // ★세로 정렬의 축 = «셀 박스»가 아니라 «셀 안의 내용» (2026-09-03 fix/duo-layout-align 계승).
      //   그리드 아이템은 기본 stretch(칸을 꽉 채움) + 셀 내부 justify-content 로 «내용»을 배치.
      const cv = _GRID_VALIGN[pick('valign')] || blockValign;
      const bgRaw = pick('bg');
      const bg = (typeof bgRaw === 'string' && _GRID_COLOR_RE.test(bgRaw.trim())) ? bgRaw.trim() : '';
      const pad = Number(pick('padding')) || 0;
      const rad = Number(pick('radius')) || 0;
      // ★각 라인에도 좌표를 심는다(data-r/data-c/data-line) — 현빈 2026-09-04 지시.
      //   ★2026-09-05 P1.5 부터 «실제로 읽는 소비자»가 있다: js/block-drag.js 의 캔버스 인라인 편집이
      //   blur 때 「어느 셀 몇 번째 줄인가」를 DOM 순서 추측 없이 여기서 바로 읽어 patchCell 로 커밋한다.
      cellsHtml.push(`<div class="grd-cell" data-r="${r}" data-c="${c}" style="min-width:0;min-height:0;display:flex;flex-direction:column;justify-content:${cv};${bg ? `background:${bg};` : ''}${pad > 0 ? `padding:${pad}px;` : ''}${rad > 0 ? `border-radius:${rad}px;` : ''}">
        ${lines.map((l, li) => _gridLineHtml(l, align, 0, { r, c, li })).join('')}
      </div>`);
    }
  }

  block.innerHTML = `<div class="grd-inner" style="display:grid;grid-template-columns:${colTemplate};grid-template-rows:${rowTemplate};gap:${gapPx}px;width:100%;">
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

function makeGridBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'grid-block';
  block.id = genId('grd');
  block.dataset.type = 'grid';
  let cols = (Array.isArray(opts.cols) && opts.cols.length >= MIN_COLS) ? opts.cols.slice(0, MAX_COLS) : JSON.parse(JSON.stringify(GRID_DEFAULTS.cols));
  block.dataset.gap = String(Number.isFinite(Number(opts.gap)) ? Number(opts.gap) : GRID_DEFAULTS.gap);
  block.dataset.valign = ['top', 'middle', 'bottom'].includes(opts.valign) ? opts.valign : GRID_DEFAULTS.valign;

  // ★P1: rows/cells(선택) — 안 주면 옛 duo 와 완전히 같은 1행 블록(dataset.rows/cells 아예 안 씀).
  //   cells 는 add_block API 경계 그대로 «행 0 포함 전체»를 받는다(§3-A) — 행 0 은 cols 로 흡수.
  if (Array.isArray(opts.rows) && opts.rows.length >= MIN_ROWS) {
    const rows = opts.rows.slice(0, MAX_ROWS).map(r => {
      const h = r && typeof r === 'object' ? r.height : undefined;
      if (h === 'auto' || h == null || h === '') return { height: 'auto' };
      const n = Number(h);
      return { height: (Number.isFinite(n) && n >= 0) ? n : 'auto' };
    });
    block.dataset.rows = JSON.stringify(rows);
    if (rows.length > 1 && Array.isArray(opts.cells) && opts.cells.length) {
      const { cols: mergedCols, extra } = _splitFullCells(opts.cells.slice(0, rows.length), cols);
      cols = mergedCols;
      if (extra.length) block.dataset.cells = JSON.stringify(extra);
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
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return null; }
  window.pushHistory();
  const { row, block } = makeGridBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
  return { row, block };
}

// updateStepBlock/updateInfoCardBlock 미러 — validate-then-commit + before 스냅샷.
// 지원: cols(전체 교체) · patchCol{index,…} · rows(전체 교체) · cells(행0 포함 전체 교체) ·
//       patchCell{r,c,…} · gap · valign.
// ★구조 필드(cols/patchCol/cells/patchCell)는 한 번에 하나만 — 부분 적용 혼란 방지(기존 cols/patchCol 규칙 확장).
function updateGridBlock(blockId, partial = {}) {
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
  const structKeys = ['cols', 'patchCol', 'cells', 'patchCell'].filter(k => partial[k] !== undefined);
  if (structKeys.length > 1) {
    return { ok: false, code: 'INVALID', message: `${structKeys.join(', ')} 동시 지정 불가 — 구조 변경은 한 번에 하나만` };
  }

  const next = {};
  const applied = {};

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
    const trimmedExtra = _gridExtraRows(block, colsForTrim, normRows.length);
    next.cells = JSON.stringify(trimmedExtra);
  }
  const rowCountForValidation = next.rows !== undefined ? JSON.parse(next.rows).length : _gridRows(block).length;

  if (partial.cols !== undefined) {
    /* ★상한 3 → 4 (2026-09-04): 우측 패널 4×4 피커가 최대 4열을 준다.
     * 하한 2 는 유지한다 — 1열짜리 「그리드」는 그리드가 아니고, _gridCols 폴백이
     * 1열을 기본값으로 되돌려 «내용을 지우는» 함정이 있다(PLAN §P1 회귀위험). */
    if (!Array.isArray(partial.cols) || partial.cols.length < MIN_COLS || partial.cols.length > MAX_COLS) {
      return { ok: false, code: 'INVALID', message: `cols must be array of ${MIN_COLS}~${MAX_COLS} columns` };
    }
    next.cols = JSON.stringify(partial.cols);
    applied.cols = partial.cols;
    // 열 수가 바뀌면 추가행 셀도 새 열 수에 맞춰 pad/truncate(방어 — 다음 렌더에서도 어차피
    // _gridExtraRows 가 같은 일을 하지만, dataset 자체를 깨끗하게 유지해 export/외부 판독을 돕는다).
    const trimmedExtra = _gridExtraRows(block, partial.cols, rowCountForValidation);
    next.cells = JSON.stringify(trimmedExtra);
  }
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
    const baseCols = _gridCols(block);
    const { cols: mergedCols, extra } = _splitFullCells(partial.cells, baseCols);
    next.cols = JSON.stringify(mergedCols);
    next.cells = JSON.stringify(extra);
    applied.cells = partial.cells;
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
    const extra = r > 0 ? _gridExtraRows(block, cols, rowCountForValidation) : null;
    let cellPatch = rest;   // 기본: 셀 전체(부분) patch — 기존 동작 그대로

    if (lineIndex !== undefined) {
      /* ★한 줄 단위 patch — P1.5 캔버스 인라인 편집 전제 설계(현빈 2026-09-04 지시).
       * 셀 전체(lines 배열 통째)를 갈아치우지 않고 lines[lineIndex] «하나만» 병합한다 —
       * 인라인 편집이 blur 때 이 경로로 한 줄만 커밋해야 다른 줄이 안 날아가고 커서도 안 튄다. */
      const li = Number(lineIndex);
      const curCell = r === 0 ? cols[c] : extra[r - 1][c];
      const curLines = Array.isArray(curCell.lines) ? curCell.lines : [];
      if (!Number.isFinite(li) || li < 0 || li >= curLines.length) {
        return { ok: false, code: 'INVALID', message: `patchCell.lineIndex out of range (0~${curLines.length - 1})` };
      }
      const nextLines = curLines.slice();
      nextLines[li] = Object.assign({}, nextLines[li], rest);
      cellPatch = { lines: nextLines };
    }

    if (r === 0) {
      // 행 0 은 늘 cols[c] 자체다(단일 진실원) — patchCol 과 «같은 길」로 보낸다.
      cols[c] = _mergeCellIntoCol(cols[c], cellPatch);
      next.cols = JSON.stringify(cols);
    } else {
      extra[r - 1][c] = Object.assign({}, extra[r - 1][c], cellPatch);
      next.cells = JSON.stringify(extra);
    }
    applied.patchCell = lineIndex !== undefined ? { r, c, lineIndex: Number(lineIndex), ...rest } : { r, c, ...rest };
  }
  if (partial.gap !== undefined) {
    const n = Number(partial.gap);
    if (!Number.isFinite(n) || n < 0 || n > 200) return { ok: false, code: 'INVALID', message: 'gap must be 0~200' };
    next.gap = String(Math.round(n));
    applied.gap = Math.round(n);
  }
  if (partial.valign !== undefined) {
    if (!['top', 'middle', 'bottom'].includes(partial.valign)) {
      return { ok: false, code: 'INVALID', message: 'valign must be top|middle|bottom' };
    }
    next.valign = partial.valign;
    applied.valign = partial.valign;
  }
  if (Object.keys(next).length === 0) {
    return { ok: false, code: 'INVALID', message: 'no recognized fields — expected one of cols/patchCol/rows/cells/patchCell/gap/valign' };
  }

  const before = {
    cols: block.dataset.cols, gap: block.dataset.gap, valign: block.dataset.valign,
    rows: block.dataset.rows, cells: block.dataset.cells,
  };
  const restore = (snap) => {
    ['cols', 'gap', 'valign', 'rows', 'cells'].forEach(k => {
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
  return { ok: true, blockId, before, applied };
}

window.makeGridBlock = makeGridBlock;
window.addGridBlock = addGridBlock;
window.updateGridBlock = updateGridBlock;
window.renderGridBlock = renderGridBlock;
window.migrateGridIdentity = migrateGridIdentity;

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
  getGridModel, _gridRows as gridRows, _gridCols as gridCols,
  MIN_COLS, MAX_COLS, MIN_ROWS, MAX_ROWS,
};

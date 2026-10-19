/* ═══════════════════════════════════
   GRID INFOGRAPHIC — 그리드 블럭 기반 인포그래픽 + 레이아웃 프리셋(기본 · 구분선) (1013t2F · 2026-10-14)
   ★새 블럭 종류 0 — 보통 grid-block 에 뿌리 표식 `data-ifg-preset` 하나(렌더러는 안 읽는다: 패널 표시·절 노출만).
   ★Z3 프로토(js/proto/z3-*.js · proto/z3.css)에서 «값»만 옮겼다. 프로토가 CSS 로 고정했던 것은 전부 «데이터»로:
     · 구분선(칸 위 변 · 칸 사이 세로 선) = 「모든 칸 테두리」 cellBorder{Width,Color,Style} + cellBorderEdges(grid-block.js)
       ⇒ 우측 패널 「모든 칸 테두리」에서 켜고 끄고 굵기·색·꼴을 바꾼다(현빈 지적 ⒜⒝).
     · 칸 안 자리(아이콘·꼬리말을 아래로) = 줄 marginTop:'auto'(grid-block.js _gridLineHtml)
     · 줄 순서 = 모델에 그림 순서대로 저장.
   ⛔프로토 CSS(proto/z3.css)를 붙이지 않는다 · ⛔프로토의 13.6% 광학 보정(translate)은 버렸다.
   ⛔범위 밖(현빈 결정 D1): 키워드 자동 채움 · ⌘V SVG 아이콘 · ~~아이콘 팝오버~~ · 아이콘 크기/색 일괄 · 열×행 전용 손잡이 · 꼬리말 토글.
     ★[정정 2026-10-20 · 1017t1i2] ★「아이콘 고르개」는 ★범위 안으로 들어왔다 — 현빈 「아이콘을 더블클릭하면 svg를 바로
       교체할수 패널이 … 이 방식이 좋은것 같아」 ＋ 「원래는 ★iconify 플러그인이 연결되어있어야되는거야」.
       ⇒ js/blocks/grid-ifg-icon-pick.js (더블클릭 → window.openIconifyModal). ⛔이 줄을 「범위 밖」으로 읽지 마라.
       ⛔「내장 아이콘 35종 명부」는 ★없다 — 시안의 35종은 ★프로토가 API 를 못 써서 박아 둔 ★샘플이었다(현빈 정정).
   ★고치는 문은 언제나 window.updateGridBlock «한 번»(⌘Z 한 번 · 표식도 같은 문 = 같은 히스토리).
═══════════════════════════════════ */
import { GRID_IFG_PRESET_KEYS } from './grid-block.js';

/* ── 프리셋 표 — 전부 캔버스 «콘텐츠» 값(사용자 편집값 · CSS 토큰 대상 아님 · GRID_RULE_DEFAULT_COLOR 선례).
 *   basic = 프로토 Z3_PRESETS.basic 그대로 · lines = 그림 ref/1013t2-img04 를 잰 프로토 값 그대로.
 *   border = 프리셋이 «한 번» 쓰는 「모든 칸 테두리」 네 키. 그 뒤로는 패널이 주인이다(렌더는 데이터만 본다).
 *   선색 #b3b1ae = 발주문 명시(현빈 ⒝ · 지디 실측 · 오케스트레이터 D3). */
export const GRID_IFG_LINE_COLOR = '#b3b1ae';
export const GRID_IFG_PRESETS = {
  basic: {
    label: '기본', dims: [3, 3], iconSize: 144, iconColor: '#222222', iconAlign: 'center',
    order: ['icon', 'title', 'desc'],
    title: { type: 'h3', align: 'center', fontSize: 26, color: '#222222', marginTop: 10 },
    desc: { type: 'body', align: 'center', fontSize: 21, color: '#888888', lineHeight: 1.4 },
    cell: { padding: null }, gap: 24, rowGap: 44, colGap: 24, rowH: 'auto',
    border: { cellBorderWidth: 0, cellBorderEdges: null },
  },
  lines: {
    label: '구분선', dims: [2, 2], iconSize: 84, iconColor: '#111111', iconAlign: 'right',
    /* 그림 ② — 제목 위 왼쪽 · 아이콘 아래 오른쪽 · 꼬리말 맨 아래. 아이콘이 marginTop:'auto' 로 아래로 밀린다. */
    order: ['title', 'icon', 'desc'], iconMarginTop: 'auto',
    title: { type: 'h3', align: 'left', fontSize: 42, weight: 400, color: '#1a1a1a', lineHeight: 1.45 },
    desc: { type: 'body', align: 'right', fontSize: 24, color: '#333333', lineHeight: 1.4 },
    cell: { padding: 48 }, gap: 0, rowGap: 0, colGap: 0, rowH: 400,
    /* 열 수 단계 — [최대 열 수, 제목, 꼬리말, 여백, 아이콘, 행 높이]. 프리셋 «적용 때»만 쓴다(프로토 값 그대로). */
    tiers: [[2, 42, 24, 48, 84, 400], [3, 28, 17, 32, 60, 266], [4, 21, 14, 24, 48, 200], [6, 15, 12, 16, 40, 140], [8, 12, 11, 10, 40, 100]],
    border: { cellBorderWidth: 1, cellBorderColor: GRID_IFG_LINE_COLOR, cellBorderStyle: 'solid', cellBorderEdges: 'top,vsep' },
  },
};
/* ★명부는 grid-block.js 하나(고치는 문이 그걸로 검증한다) — 표가 어긋나면 «여기서» 죽는다(조용히 안 늙게). */
if (JSON.stringify(Object.keys(GRID_IFG_PRESETS)) !== JSON.stringify(GRID_IFG_PRESET_KEYS)) {
  throw new Error('[grid-infographic] GRID_IFG_PRESETS 키가 grid-block.js GRID_IFG_PRESET_KEYS 와 다르다');
}
const _own = (k) => typeof k === 'string' && Object.hasOwn(GRID_IFG_PRESETS, k);   // ⛔'constructor' 등 통과 금지

/** 프리셋 값(열 수 단계까지 푼 것). 표에 없는 키는 basic. */
export function ifgPreset(key, nCols) {
  const base = GRID_IFG_PRESETS[_own(key) ? key : 'basic'];
  if (!base.tiers) return base;
  const n = Number(nCols) > 0 ? Number(nCols) : base.dims[0];
  const t = base.tiers.find(x => n <= x[0]) || base.tiers[base.tiers.length - 1];
  return { ...base, iconSize: t[4], rowH: t[5], title: { ...base.title, fontSize: t[1] }, desc: { ...base.desc, fontSize: t[2] }, cell: { ...base.cell, padding: t[3] } };
}

/* ── 자리표시 아이콘 «하나»(check-circle · 프로토 z3-icons.js 의 그 선 그림). 아이콘 «고르기»는 iconify 다. ──
 * ★★1017t1i2 — 한때 이 넷을 `./grid-ifg-icons.js`(내장 35종 명부)로 옮겼다가 ★되돌렸다.
 *   까닭: 현빈 정정 「35종은 샘플이라 그런거고 원래는 ★iconify 플러그인이 연결되어있어야되는거야」
 *   ⇒ 내장 명부는 ★없다. 아이콘은 `window.openIconifyModal`(js/panels/iconify-panel.js)에서 온다.
 *   ⇒ 자리표시 ★하나뿐이니 명부가 둘이 될 일도 없다 — ★여기 그대로 둔다.
 * ★★색 자리(`style="color:…"`)는 ★계약이다 — 아래 `_recolor` 가 그 자리를 찾아 프리셋 색으로 갈아낀다.
 *   ⇒ iconify 에서 받은 svg 도 ★그 자리를 갖춰야 프리셋 적용에서 색을 안 잃는다.
 *     그 일은 js/blocks/grid-ifg-icon-pick.js `ifgPaintSvgRoot` 가 한다(⛔두 벌로 적지 마라). */
const _URI_HEAD = 'data:image/svg+xml;base64,';
const _ICON_D = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>';
const _ICON_VB = '-4.5 -4.5 33 33';   // 원형 틀에 안 잘리게 24 상자 둘레 4.5 여백
const _hexOk = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ''));
const _b64 = (s) => btoa(unescape(encodeURIComponent(s)));
const _unb64 = (s) => decodeURIComponent(escape(atob(s)));

/** 자리표시 아이콘 data URI — 색은 SVG 뿌리 style="color:…" + currentColor. */
export function ifgIconUri(color) {
  const col = _hexOk(color) ? color.toLowerCase() : '#222222';
  return _URI_HEAD + _b64('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + _ICON_VB + '" style="color:' + col + '"'
    + ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + _ICON_D + '</svg>');
}
/** 색만 갈아 다시 싼다 — 뿌리에 style=color 가 없는 그림(사용자가 바꾼 사진 등)은 «그대로» 둔다. */
function _recolor(uri, hex) {
  if (!_hexOk(hex) || typeof uri !== 'string' || uri.indexOf(_URI_HEAD) !== 0) return uri;
  let s;
  try { s = _unb64(uri.slice(_URI_HEAD.length)); } catch (_) { return uri; }
  const re = /(<svg[^>]*\sstyle="[^"]*color:\s*)(#[0-9a-fA-F]{3,8})/;
  if (!re.test(s)) return uri;
  return _URI_HEAD + _b64(s.replace(re, '$1' + hex.toLowerCase()));
}

const TEXT_TYPES = ['label', 'h1', 'h2', 'h3', 'body', 'caption'];
/** 칸의 줄에서 아이콘·제목·설명 자리(없으면 -1). 아이콘 = 첫 원형 이미지 줄 · 제목/설명 = 글 줄 첫째/둘째(순서 무관). */
export function ifgCellParts(lines) {
  const arr = Array.isArray(lines) ? lines : [];
  const iconLi = arr.findIndex(l => l && l.type === 'image' && l.imgShape === 'circle');
  let titleLi = -1, descLi = -1;
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i] || TEXT_TYPES.indexOf(arr[i].type) < 0) continue;
    if (titleLi < 0) titleLi = i; else { descLi = i; break; }
  }
  return { iconLi, titleLi, descLi };
}

/* 글 줄 = 프리셋 꾸밈 + 글(부분 서식 textHtml 은 싣지 않는다 — 꾸밈이 바뀌므로). */
function _textLine(base, text) { const o = { ...base, text: text == null ? '' : String(text) }; delete o.textHtml; return o; }
function _iconLine(P, src) {
  const o = { type: 'image', imgShape: 'circle', height: P.iconSize, imgSrc: src, align: P.iconAlign };
  if (P.iconMarginTop !== undefined) o.marginTop = P.iconMarginTop;
  return o;
}
function _cellDeco(P) { return { ...P.cell }; }   // null 값 = 그 꾸밈을 지운다(grid-block 칸 계약)

/** 프리셋 순서로 줄을 다시 세운다 — 아이콘·제목·설명 밖의 줄은 뒤에 원래 순서대로. */
function _restyleLines(lines, P) {
  const p = ifgCellParts(lines);
  const parts = {
    icon: p.iconLi >= 0 ? _iconLine(P, _recolor(lines[p.iconLi].imgSrc, P.iconColor)) : null,
    title: p.titleLi >= 0 ? _textLine(P.title, lines[p.titleLi].text) : null,
    desc: p.descLi >= 0 ? _textLine(P.desc, lines[p.descLi].text) : null,
  };
  const used = new Set([p.iconLi, p.titleLi, p.descLi]);
  const rest = lines.filter((_, i) => !used.has(i));
  return P.order.map(k => parts[k]).filter(Boolean).concat(rest);
}

/** items([{title, desc}]) → addGridBlock 에 줄 opts. 프리셋 border·표식까지 «만드는 문 한 번»에 싣는다. */
export function ifgBuildOpts(items, nCols, nRows, presetKey = 'basic') {
  const key = _own(presetKey) ? presetKey : 'basic';
  const P = ifgPreset(key, nCols);
  const list = Array.isArray(items) && items.length ? items : [{ title: '제목', desc: '설명' }];
  const deco = {};
  Object.keys(P.cell).forEach(k => { if (P.cell[k] != null) deco[k] = P.cell[k]; });
  const cells = [];
  for (let r = 0; r < nRows; r++) {
    const row = [];
    for (let c = 0; c < nCols; c++) {
      const it = list[(r * nCols + c) % list.length];
      const lines = _restyleLines([
        { type: 'image', imgShape: 'circle', imgSrc: ifgIconUri(P.iconColor) },
        { type: 'h3', text: it.title }, { type: 'body', text: it.desc },
      ], P);
      row.push({ ...deco, lines });
    }
    cells.push(row);
  }
  const opts = {
    cols: cells[0].map(cell => ({ width: 1, align: P.title.align, lines: cell.lines })),
    rows: cells.map(() => ({ height: P.rowH })),
    cells, gap: P.gap, rowGap: P.rowGap, colGap: P.colGap, ifgPreset: key,
  };
  /* 만드는 문은 «필요한 키만» — basic 의 width 0 · edges null 은 안 싣는다(새 그리드 dataset 이 보통 그리드와 같게). */
  for (const [k, v] of Object.entries(P.border)) if (v !== null && v !== 0) opts[k] = v;
  return opts;
}

/** 레이아웃 프리셋 적용 — 칸의 글(제목·설명)·아이콘 그림은 그대로, 배치·꾸밈·간격·행 높이·테두리 네 키·표식을
 *  updateGridBlock «한 문»으로(⌘Z 1회 — 프로토는 표식을 커밋 «뒤»에 따로 써서 ⌘Z 가 표식을 못 되돌렸다). */
export function applyIfgPreset(block, presetKey) {
  if (!block || !_own(presetKey)) return { ok: false, code: 'INVALID', message: `preset must be ${Object.keys(GRID_IFG_PRESETS).join('|')}` };
  const m = window.getGridModel(block);
  const P = ifgPreset(presetKey, m.cols.length);
  const deco = _cellDeco(P);
  const cells = m.cells.map(row => row.map(cell => ({ ...cell, ...deco, lines: _restyleLines(Array.isArray(cell.lines) ? cell.lines : [], P) })));
  const partial = {
    cells, rows: m.rows.map(() => ({ height: P.rowH })),
    gap: P.gap, rowGap: P.rowGap, colGap: P.colGap,
    ...P.border, ifgPreset: presetKey,
  };
  return window.updateGridBlock(block.id, partial);
}

/* ── ★1017t1i1 — ＋ 로 들어오는 새 로우/칼럼이 인포그래픽 포맷(아이콘·제목·설명 3줄 + 칸 꾸밈 + 열 align + 행 height)을
 *   물려받게. 현빈 지적: 「빈칼럼이 아니라 기존에 인포그래픽 블럭 포맷으로 로우나 칼럼 추가되어야」(proj_1791778999148_grd_ts0he_gixosx9).
 * ★이웃에서 뜬다(프리셋 표가 아니라 ★지금 그리드에서) — 사용자가 고친 값(fontSize 등)을 프리셋 표 값으로 덮지 않으려고.
 * ★순수 읽기 — updateGridBlock/pushHistory 를 «안» 부른다(def01-pair-grid 선례 — ⌘Z 한 번에 그대로 들어가야 한다).
 * ★호출 쪽(grid-block.js gridResizeTo)이 window.ifgNewShape?.() 로 늦게 묻는다 — import 하면 순환(이 파일이
 *   grid-block.js 를 이미 import)이고, 유닛 하네스 loadGrid({withIfg:false}) 10곳이 grid-block.js 한 파일만 얹어서 죽는다. */
function _ifgQualifies(lines) {
  const p = ifgCellParts(Array.isArray(lines) ? lines : []);
  return p.iconLi >= 0 || p.titleLi >= 0;
}
/* donor 줄을 복제하고 제목·설명 글만 자리표시로 — 아이콘·꾸밈(fontSize·color·align 등)은 donor 그대로(= 손 댄 값 보존). */
function _ifgCloneShapeLines(lines) {
  const out = (Array.isArray(lines) ? lines : []).map(l => ({ ...l }));
  const p = ifgCellParts(out);
  if (p.titleLi >= 0) out[p.titleLi] = { ...out[p.titleLi], text: '제목' };
  if (p.descLi >= 0) out[p.descLi] = { ...out[p.descLi], text: '설명' };
  return out;
}
/** 새 열/행의 꼴 — {col, cell, cellDecoOnly, rowHeight} | null(= 표식이 없거나 물려받을 이웃이 없다 ⇒ 옛 동작 그대로).
 *  ⒈ 표식이 GRID_IFG_PRESET_KEYS 에 없으면 null. ⒉ 지금 그리드(getGridModel)에서 «이웃»을 뜬다 —
 *    마지막 열부터(열 방향 추가가 보는 자리) · 그 다음 마지막 행의 0열(행 방향 추가가 보는 자리) 차례로,
 *    ifgCellParts 로 «포맷이 성립하는»(아이콘 또는 제목 줄이 있는) 첫 칸을 쓴다. 하나도 없으면 null. */
export function ifgNewShape(block, nCols, nRows) {
  if (!block || !block.dataset || !_own(block.dataset.ifgPreset)) return null;
  let m = null;
  try { m = window.getGridModel ? window.getGridModel(block) : null; } catch (_) { m = null; }
  if (!m || !Array.isArray(m.cols) || !Array.isArray(m.cells)) return null;
  const cols = m.cols, rows = Array.isArray(m.rows) ? m.rows : [], cells = m.cells;
  const cands = [];
  for (let c = cols.length - 1; c >= 0; c--) {
    cands.push({ lines: cols[c] && cols[c].lines, align: cols[c] && cols[c].align,
      height: rows[0] && rows[0].height, deco: cells[0] && cells[0][c] });
  }
  for (let r = rows.length - 1; r >= 1; r--) {
    const cell = cells[r] && cells[r][0];
    cands.push({ lines: cell && cell.lines, align: cols[0] && cols[0].align,
      height: rows[r] && rows[r].height, deco: cell });
  }
  const donor = cands.find(x => _ifgQualifies(x.lines));
  if (!donor) return null;
  /* ★4축 중 「칸 꾸밈」은 ★padding 하나만 — bgImg/bgFit/bgPos 등은 이 블럭의 일이 아니다(grid-cell-bg-image C7 경계). */
  const padding = (donor.deco && typeof donor.deco.padding === 'number') ? donor.deco.padding : null;
  const cellDecoOnly = padding != null ? { padding } : {};
  return {
    col: { width: 1, align: donor.align, lines: _ifgCloneShapeLines(donor.lines) },
    cell: { ...cellDecoOnly, lines: _ifgCloneShapeLines(donor.lines) },
    cellDecoOnly,
    rowHeight: donor.height != null ? donor.height : 'auto',
  };
}

/** 삽입 입구 — 3×3 «기본» 인포그래픽 그리드(자리표시 아이콘 · 「제목」 · 「설명」).
 *  ★이름이 …Block 이라 insert-history 로스터(MATCH)에 자동으로 걸린다(⌘Z 끝 표본). 동기다(insert-seam-roster B1).
 *  ★섹션 미선택 경고는 «한 벌»(showNoSelectionHint · block-add-noselection-hint T1) — 그래서 `export function` 이 아니라
 *    맨 `function` 으로 적고 아래에서 내보낸다(그 검사가 `\nfunction 이름(` 으로 본문을 찾는다). */
function addInfographicBlock() {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return null; }
  const opts = ifgBuildOpts([{ title: '제목', desc: '설명' }], 3, 3, 'basic');
  const res = window.addGridBlock?.(opts);
  return res && res.block ? res.block : null;
}
export { addInfographicBlock };

if (typeof window !== 'undefined') {
  window.addInfographicBlock = addInfographicBlock;
  window.applyIfgPreset = applyIfgPreset;
  window.GRID_IFG_PRESETS = GRID_IFG_PRESETS;   // 패널(prop-grid.js)이 이름표를 «부를 때» 읽는다 — 그 파일은 이 모듈을 import 하지 않는다
  window.ifgNewShape = ifgNewShape;   // ★1017t1i1 — grid-block.js gridResizeTo 가 «부를 때» 읽는다(선례 :4074 _grdAfterResize)
}

// comparison-block.js — 1급 비교 블록 (banner02 패턴). N칼럼 비교(1:1, 1:1:1 …).
// 한 칼럼(featured)이 더 크게 떠보임(그림자·overlap·스케일↑). 칼럼은 cols 배열로 관리.
import { genId, showNoSelectionHint, insertAfterSelected, mdlReadText } from '../drag-utils.js';   /* ★1017t1c2 — Enter 줄바꿈 읽기 한 벌(모달·block-drag.js 와 같은 자리 · 사본 0) */
import { bindBlock } from '../drag-drop.js';
import { _cvbBackgroundSize } from './canvas-block.js';   // ★D3 — 이미지 확대 식 한 벌(카드와 같은 필드 imgScale/imgFit)
import { normalizeRedact, applyRedact } from '../effects/image-redact.js';   // ★D4 — 셀 이미지 블러(Redact) 공용 모듈(C1 · 에셋과 한 벌)
import { lnHasLines, lnLinesHtml, lnValidateLines, lnPlainText, lnRemark } from './line-host.js';   // ★D2 — 칸 안 «줄»(버블·챗과 같은 주인 계약 · 사본 금지)
import { GRID_ROLES } from './grid-block.js';   // ★D2 — 문서에 안 붙은 블럭의 줄 높이 근사(역할 크기 × 줄높이)

// ── cmp 셀 placeholder(기본문구) 식별 ───────────────────────────────────────
// comparison 셀은 일반 텍스트블럭과 달리 cols 모델에 텍스트가 들어있어 data-isPlaceholder
// 플래그를 못 단다. 그래서 '기본문구와 동일 비교'(간단·저위험)로 placeholder를 식별한다.
// ★★2026-10-08 ⒜⒝ 로 «쓰는 자리»가 바뀌었다 — 아래 둘을 같이 고쳤으니 따로 늙지 않는다:
//   ~~「신규 칼럼/행 추가도 같은 상수를 import해서 일관성 유지」~~
//      ⇒ 이제 신규 칼럼/행은 ★빈 칸(cmpEmptyRow/cmpEmptyRows)이다. 상수를 import 하지 «않는다».
//   ~~「빈 셀 blur 시 복원 판정용」~~
//      ⇒ ★복원을 걷었다(⒝). 명부가 남은 까닭은 ★«편집 진입 시 전체선택» ★하나뿐이고,
//        그 대상은 ★이미 저장된 옛 프로젝트의 칸이다(그 글자가 모델에 그대로 있다).
// ★이 둘은 이제 «넣는 값»이 아니라 «옛 기본문구의 이름»이다(2026-10-08 ⒜⒝ — 아래 머리말).
//   ⛔지우지 마라: 이미 저장된 프로젝트의 모델엔 이 글자가 그대로 남아 있고,
//   CMP_PLACEHOLDERS 가 그걸 식별해 「더블클릭=전체선택」을 살려 준다.
export const CMP_PLACEHOLDER_TITLE = '새 칼럼';      // 옛 신규-칼럼 헤더 기본문구
export const CMP_PLACEHOLDER_ROW   = '내용 입력';    // 옛 신규-행 기본문구
// ★같은 글자를 세 벌로 적지 않는다 — 위 두 상수를 «참조»한다(값·순서는 그대로).
export const CMP_PLACEHOLDERS = [
  '강점 키워드 입력', '경쟁사 내용', CMP_PLACEHOLDER_ROW, CMP_PLACEHOLDER_TITLE,
  '일반 제품', '브랜드 명·상품 명',
];
/* ★⒜ 새로 만드는 칸은 «빈 칸»으로 둔다 (현빈 2026-10-08 — 「캔버스 직접 입력 가능하니 불필요」).
   꼴은 ★객체행 ★한 벌로 모은다 — prop-comparison.js 「+ 행 추가」가 쓰던 꼴과 같다.
   ⚠️예전엔 makeComparisonBlock 이 rows 를 ★문자열 배열로, 패널은 ★객체로 써서 두 꼴이 갈려 있었다
     (normalizeRow 가 읽을 때 객체로 바꿔 주지만 dataset 에는 문자열로 남았다). */
export const cmpEmptyRow  = () => ({ type: 'text', text: '' });
export const cmpEmptyRows = (n) => Array.from({ length: Math.max(0, n) }, cmpEmptyRow);
/* ★D5 (현빈 2026-10-12) — 빈 칸의 «안내 힌트» 문구. 글자가 아니라 CSS ::before(css/editor-blocks.css)가 그리는 시각 전용 안내다.
   ⛔모델(cols)·textContent·저장본에 넣지 않는다 — 10-08 「제거」(지워도 되살아남)와 다른 것이다.
   ⛔CMP_PLACEHOLDERS 명부에 넣지 마라(그 글자를 진짜로 쓴 칸이 더블클릭=전체선택이 된다).
   CSS content 와 두 벌 — 검사(cmp-placeholder-hint P1)가 런타임 ::before content == 이 값을 단언해 묶는다. */
export const CMP_ROW_HINT = '내용을 입력하세요.';
export const CMP_HD_HINT  = '제목을 입력하세요';
/* ★보존 필드 명부 (1012t1D1 · 2026-10-12) — MCP/AI 문 `updateComparisonBlock` 이 칼럼·행을 «다시 지을» 때
   기본 필드({title,bg,text,rows} · {type,text,imgSrc,imgFit}) «밖»에서 실어 보낼 확장 필드의 ★정본 한 자리.
   ★까닭(실측 plan-D §0 C.fieldSurvival): cols 전체교체가 칼럼을 {title,bg,text,rows} 로 새로 지어
     렌더는 읽는데 패널/문은 모르는 필드(titleBg 등)를 «조용히» 버렸다 — getComparisonCols(...c) 왕복은 살리는데 문만 떨궜다.
   꼴: { 키: 검증함수 } — 검증함수(v) → 저장할 값 · '' = 지우기(키 없음) · null = 무효(INVALID).
   ⇒ 새 칼럼/행 필드를 들이는 항목(D2·D3·D4 …)은 ★여기에 한 줄 더한다. ⛔문 안에 필드를 따로 적지 마라
     (cols 교체 · columnPatch · _sanitizeRow 세 자리가 모두 이 명부를 돈다). */
const _cmpStrMax = max => v => { const s = String(v); return s.length > max ? null : s; };
export const CMP_COL_KEEP = {
  titleBg:    _cmpStrMax(1024),   // 헤더 배경(헤더 모드 = 밴드 · 캡션 모드 = 알약) — 칼럼 bg 와 같은 상한
  titleColor: _cmpStrMax(64),     // 헤더 글자색 — 칼럼 text 와 같은 상한
};
/* 숫자 칸 — 범위로 «클램프»(⛔거절 아님: 카드 imgX/imgScale 과 같은 관용). 수가 아니면 무효. '' = 지우기. */
const _cmpNumIn = (lo, hi) => v => {
  if (v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};
/* 색보정 7키(image-color-adjust.js ADJ_KEYS 와 같은 이름 · 슬라이더 -100..100 ÷ 100 = -1..1). 모르는 키는 버린다. */
export const CMP_ADJ_KEYS = ['exposure', 'contrast', 'saturation', 'temperature', 'tint', 'highlights', 'shadows'];
function _cmpAdj(v) {
  if (v === '') return '';
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  let any = false;
  for (const k of CMP_ADJ_KEYS) {
    const n = Number(v[k]);
    out[k] = Number.isFinite(n) ? Math.min(1, Math.max(-1, n)) : 0;
    if (Math.abs(out[k]) > 0.001) any = true;
  }
  return any ? out : '';
}
export const CMP_ROW_KEEP = {
  /* ★1012t1D3 — 이미지 칸 위치/확대 (카드블럭 card.imgX/imgY/imgScale 과 ★이름·범위 그대로).
     없으면 키 없음 = 현행 렌더(가운데 · cover|contain) 바이트 그대로. */
  imgX:     _cmpNumIn(0, 100),     // background-position x (%) · 기본 50
  imgY:     _cmpNumIn(0, 100),     // background-position y (%) · 기본 50
  imgScale: _cmpNumIn(100, 400),   // 확대(%) · 기본 100 (= imgFit 그대로)
  /* ★1012t1D4 — 셀 이미지 블러(Redact) 강도 0..100 정수(C1 공용 normalizeRedact 그대로 · 0 = 끔 = 키 없음). */
  redact:   v => { const n = normalizeRedact(v); return n > 0 ? n : ''; },
  /* ★1012t1D4 — 셀 이미지 색보정(카드 card.adj 와 ★이름·꼴 그대로 · 7키 -1..1 클램프). 객체가 아니면 무효 · 전부 0 = 키 없음. */
  adj:      _cmpAdj,
  /* ★1012t1D2 — 칸 안 «줄»(그리드 줄 데이터 · line-host LN_KINDS = 글자 역할 + 여백 · ⛔그림 줄 없음). 빈 배열 = 키 없음(= 글자 하나 칸).
     잣대는 lnValidateLines 한 벌(버블·챗과 같다). 이미지 칸에 남은 줄은 «보존»만 한다(imgSrc 가 글자 칸에 남는 것과 같은 관용 · 렌더는 안 읽는다). */
  lines:    v => {
    if (!Array.isArray(v)) return null;
    if (!v.length) return '';
    if (lnValidateLines(v)) return null;
    try { return JSON.parse(JSON.stringify(v)); } catch (_) { return null; }
  },
};
/* ★1012t1D2 — 칸(행 객체)에 줄을 싣는 «한 벌»: 줄이 있으면 lines + text 거울(챗 D3 — Figma JSON·AI 읽기가 text 를 읽는다) ·
   없으면 lines 를 걷고 text 를 비운다(= 줄을 다 지운 칸은 빈 글자 칸 — D5 안내가 다시 뜬다). line-host 주인(write)·문(rowLines)이 같이 쓴다. */
export function cmpRowSetLines(row, lines) {
  if (!row || typeof row !== 'object') return row;
  if (lnHasLines(lines)) { row.lines = lines; row.text = lnPlainText(lines); }
  else { delete row.lines; row.text = ''; }
  return row;
}
/* 명부를 한 객체(src)에서 읽어 dst 에 싣는다. 반환: null = 통과 · 문자열 = 무효 키 이름.
   '' = dst 에서 키를 지운다(columnPatch = 지우기 · cols 교체는 dst 가 새 객체라 «안 싣기»와 같다). */
function _cmpKeep(roster, src, dst) {
  for (const [k, check] of Object.entries(roster)) {
    if (src[k] === undefined || src[k] === null) continue;
    const v = check(src[k]);
    if (v === null) return k;
    if (v === '') delete dst[k]; else dst[k] = v;
  }
  return null;
}
// 셀 텍스트가 기본문구와 동일하거나 비어있으면 placeholder로 간주.
export function isCmpPlaceholderText(t) {
  const s = (t == null ? '' : String(t)).trim();
  if (s === '') return true;
  return CMP_PLACEHOLDERS.includes(s);
}
// focus된 contenteditable el의 내용 전체를 선택 (block-drag.js:617-624 미러).
// focus 직후 동기 실행 필수 — 비동기면 caret이 선택을 덮는다.
function _selectAllContents(el) {
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (_) {}
}

// 행 모델 정규화: 문자열 rows(구버전)는 {type:'text', text} 객체로 무손실 마이그레이션.
// 객체면 type 화이트리스트(text|image)·필드 보정 후 반환. 비교블록 칼럼 간 행 정렬 유지를 위해
// 행은 칼럼별 독립 배열이지만 같은 행 인덱스를 공통 단위로 본다.
function normalizeRow(r) {
  if (typeof r === 'string') return { type: 'text', text: r };
  if (r && typeof r === 'object') {
    // content 별칭 수용 — planner 텍스트 어휘(content)로 쓴 행도 무손실 (2026-07-04 bench2)
    if (r.text === undefined && r.content !== undefined) r = { ...r, text: r.content };
    const type = r.type === 'image' ? 'image' : 'text';
    // ...r 보존: memo(이미지 발주채널) 등 확장 필드가 편집 blur 재직렬화에서 소실되지 않게
    if (type === 'image') {
      const out = { ...r, type: 'image', text: r.text != null ? String(r.text) : '',
               imgSrc: r.imgSrc != null ? String(r.imgSrc) : '',
               imgFit: r.imgFit === 'contain' ? 'contain' : 'cover' };
      // ★D3 위치/확대 — 있으면 명부(CMP_ROW_KEEP)의 범위로 클램프, 수가 아니면 키를 걷는다(없으면 키 없음 그대로).
      for (const k of ['imgX', 'imgY', 'imgScale', 'redact', 'adj']) {   // ★D4 redact/adj 도 같은 명부로(0·기본값 = 키 없음)
        if (out[k] === undefined) continue;
        const v = (out[k] === null || out[k] === '') ? null : CMP_ROW_KEEP[k](out[k]);
        if (v === null || v === '') delete out[k]; else out[k] = v;
      }
      return out;
    }
    return { ...r, type: 'text', text: r.text != null ? String(r.text) : '' };
  }
  return { type: 'text', text: '' };
}
const _rows = s => { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a.map(normalizeRow) : []; } catch { return []; } };
const _colsParse = s => { try { const a = JSON.parse(s || 'null'); return Array.isArray(a) && a.length ? a : null; } catch { return null; } };
// per-row 높이 오버라이드 배열 (행 인덱스→px, null/0이면 기본 rowH). data-rowHeights JSON.
function _rowHeights(d) { try { const a = JSON.parse(d.rowHeights || 'null'); return Array.isArray(a) ? a : []; } catch { return []; } }

/* cols 배열 획득 (없으면 구버전 left/right dataset → 배열로 마이그레이션). rows는 객체로 정규화.
 *
 * ★★아래 '일반 제품'·'브랜드 명·상품 명' 은 ⒜(기본문구 제거)에서 ★«일부러» 안 바꿨다
 *   — ⛔다음 사람이 「빠뜨렸다」고 읽지 않게 적어 둔다 (지디 판정 2026-10-08 ⑵ = ★제외).
 *   까닭: 이 줄은 «새로 만드는 자리»가 아니라 ★이미 저장된 옛 블럭(cols 가 없고 left/right 만 있는 판)을
 *   ★읽는 자리다. leftTitle 이 없던 옛 블럭은 ★그동안 화면에 '일반 제품'으로 ★보여 왔고,
 *   여기를 '' 로 바꾸면 ★현빈이 만든 옛 문서의 «보이던 제목»이 조용히 사라진다.
 *   ⇒ 「재생성 가능」≠「지워도 되는」. 바꾸려면 ★현빈 게이트다(쿠폰에서 같은 자리를 그렇게 올렸다). */
function getComparisonCols(d) {
  const parsed = _colsParse(d.cols);
  // ...c 보존: titleBg/titleColor(헤더 밴드 색) 등 확장 필드가 재직렬화에서 소실되지 않게
  if (parsed) return parsed.map(c => ({
    ...c,
    title: c.title ?? '', bg: c.bg || '', text: c.text || '',
    rows: (Array.isArray(c.rows) ? c.rows : []).map(normalizeRow)
  }));
  return [
    { title: d.leftTitle ?? '일반 제품',        bg: d.leftBg  || '#e9ebef', text: d.leftText  || '#9aa0a8', rows: _rows(d.leftRows) },
    { title: d.rightTitle ?? '브랜드 명·상품 명', bg: d.rightBg || '#ffffff', text: d.rightText || '#1a1a1a', rows: _rows(d.rightRows) },
  ];
}
function getComparisonFeaturedIdx(d, n) {
  const f = d.featured;
  if (f === 'left') return 0;
  if (f === 'right') return n - 1;
  const i = parseInt(f);
  return (isNaN(i) || i < 0 || i >= n) ? (n - 1) : i;
}
function setComparisonCols(block, cols) { block.dataset.cols = JSON.stringify(cols); }

/* ══ ★1012t1D3 — 이미지 칸 «편집» (현빈 「셀 이미지 넣은 뒤 편집이 안 된다」) ══════════════════════
 * 몸짓 = 그리드(2번째 클릭 = 칸 선택 + 패널 「Image」 절 · 더블클릭 = 편집기 · 우클릭 「이미지 교체」),
 * 편집기 = 카드블럭(드래그 = imgX/imgY · 휠 = imgScale) — js/blocks/comparison-img-edit.js.
 * ★상태의 정본은 모델(행 필드)이다 — renderComparison 이 .cmp-inner 를 통째로 다시 그리므로 DOM 에 둔 값은 사라진다. */
export function cmpImgBgSize(row) { return _cvbBackgroundSize(row || {}); }
export function cmpImgBgPos(row) {
  if (!row || (row.imgX == null && row.imgY == null)) return 'center';   // ⛔옛 행 바이트 불변(E7)
  return `${row.imgX ?? 50}% ${row.imgY ?? 50}%`;
}
/* 활성 칸 — 블럭 «속성»(직렬화 안 됨 · undo 로 DOM 이 갈리면 저절로 사라짐). 주소 꼴 = {colIdx,rowIdx}(우클릭 판정과 같은 꼴).
   표시 클래스 `cmp-cell-selected` 는 `-cell-selected` 로 끝나 저장 때 section-serialize RUNTIME_MARKER_RE 가 벗긴다. */
export function cmpGetActiveCell(block) { return (block && block._cmpActiveCell) || null; }
function _cmpPaintActiveMark(block) {
  block.querySelectorAll('.cmp-cell-selected').forEach(el => el.classList.remove('cmp-cell-selected'));
  const a = block._cmpActiveCell;
  if (!a) return;
  block.querySelector(`.cmp-row[data-col-idx="${a.colIdx}"][data-row-idx="${a.rowIdx}"]`)?.classList.add('cmp-cell-selected');
}
export function cmpSetActiveCell(block, addr) {
  if (!block) return;
  block._cmpActiveCell = (addr && Number.isInteger(addr.colIdx) && Number.isInteger(addr.rowIdx))
    ? { colIdx: addr.colIdx, rowIdx: addr.rowIdx } : null;
  _cmpPaintActiveMark(block);
}
/* editor.js clearSelectionMarks 가 부른다(그리드 grdClearAllActiveLines 와 같은 자리) — 표시 + 모델 둘 다. */
export function cmpClearAllActiveCells(root) {
  (root || document).querySelectorAll('.comparison-block').forEach(b => { b._cmpActiveCell = null; });
  (root || document).querySelectorAll('.cmp-cell-selected').forEach(el => el.classList.remove('cmp-cell-selected'));
}
/* 비교 블록 (x,y) → 「어느 ★행 칸인가」 {colIdx,rowIdx} · 헤더·카드 여백·캡션이면 null.
   ★block-factory.js 우클릭(_cmpCellAddrAt)에서 «올려» 왔다 — 클릭·더블클릭·우클릭 세 길이 이 한 벌을 쓴다(사본 금지).
   ⑴ elementsFromPoint(★복수) 먼저 — 선택된 블럭 위 오버레이가 «단수»를 가로채는 병(그리드 2026-09-20).
   ⑵ ⛔DOM 순서 역산 금지 — 렌더러가 심은 data-col-idx / data-row-idx 가 정본.
   (기하 폴백 없음 · 헤더 제외의 까닭은 block-factory.js 그 자리 머리말 그대로) */
export function cmpCellAddrAt(e, block) {
  if (!block || !block.classList.contains('comparison-block')) return null;
  let node = null;
  if (typeof document.elementsFromPoint === 'function') {
    const stack = document.elementsFromPoint(e.clientX, e.clientY) || [];
    for (const el of stack) { if (block.contains(el)) { node = el; break; } }
  }
  if (!node) {
    const atPoint = document.elementFromPoint(e.clientX, e.clientY);
    node = (atPoint && block.contains(atPoint)) ? atPoint : e.target;
  }
  const rowEl = node && node.closest ? node.closest('.cmp-row[data-row-idx]') : null;
  if (!rowEl || !block.contains(rowEl)) return null;
  const colIdx = Number(rowEl.dataset.colIdx), rowIdx = Number(rowEl.dataset.rowIdx);
  if (!Number.isInteger(colIdx) || !Number.isInteger(rowIdx)) return null;
  return { colIdx, rowIdx };
}
/* 칸에 그림 고르기(파일창) — ★입구 넷(패널 「+ 이미지/교체」·Image 절 「이미지 교체…」·우클릭 「이미지 교체」·빈 칸 더블클릭)이
   이 한 벌을 부른다(block-factory.js bcm-cmp-img 머리말이 요구한 꼴 · 사본 금지). push-after(패널 commit 과 같은 규약).
   반환 = 만든 input(검사가 prototype.click 가로채기로 «배선만» 잰다 — 파일창은 안 연다). */
export function cmpPickRowImage(block, colIdx, rowIdx) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const cols = getComparisonCols(block.dataset); const row = cols[colIdx]?.rows?.[rowIdx]; if (!row) return;
      row.type = 'image'; row.imgSrc = r.result; row.imgFit = row.imgFit || 'cover';
      setComparisonCols(block, cols); renderComparison(block);
      window.pushHistory?.(); window.scheduleAutoSave?.();
      if (block.classList.contains('selected')) window.showComparisonProperties?.(block);
    };
    r.readAsDataURL(f);
  };
  inp.click();
  return inp;
}

/* ★1012t1D2 — _lnNeed = 「줄 칸 때문에 늘어야 할 행 높이」(행 인덱스 → 기본 높이 px · featScale 적용 전). 내부 2단계용 —
   바깥에서 부를 때는 안 준다. 줄 칸이 없는 블럭은 2단계를 «안 탄다»(옛 저장본 산출 바이트 그대로). */
function renderComparison(block, _lnNeed = null) {
  const d = block.dataset;
  const overlap   = parseInt(d.overlap) || 32;
  const radius    = parseInt(d.radius) || 20;
  const headerH   = parseInt(d.headerH) || 72;
  const rowH      = parseInt(d.rowH) || 64;
  const rowGap    = parseInt(d.rowGap) || 8;
  let featScale   = parseFloat(d.featScale);
  if (!(featScale >= 1)) featScale = 1.2;          // 기본 1.2배
  featScale = Math.min(1.5, Math.max(1.0, featScale));
  const padX = Math.max(0, parseInt(d.padX) || 0); // 전체 좌우 패딩 (블록 ↔ 카드)
  const padY = Math.max(0, parseInt(d.padY) || 0); // 패널 상하 패딩 (카드 내부)
  const baseTitleFont = parseInt(d.titleFont) || 26; // 제목 기본 폰트 (featured는 ×featScale)
  const baseRowFont   = parseInt(d.rowFont) || 18;   // 내용 기본 폰트 (featured는 ×featScale)
  const yPad = 24;                                   // 위/아래 그림자 여유
  // 캡션 상단 배치 + 컬럼 스태거 (2026-07-04 제니 발주 — 원본들이 캡션을 카드 위에 얹고
  // 좌우 카드 높이를 어긋나게 하는 패턴, bench S08/11/14/17 공통)
  const captionPos = d.captionPos === 'top' ? 'top' : 'header'; // 'top' = 제목을 카드 밖 상단 캡션으로
  const stagger    = Math.max(0, Math.min(400, parseInt(d.stagger) || 0)); // muted 칼럼 하향 오프셋 px
  const capH   = captionPos === 'top' ? Math.round(baseTitleFont * 1.9) : 0; // 캡션 존 높이
  const capGap = captionPos === 'top' ? 12 : 0;
  const capZone = capH + capGap;

  // 칼럼 모델 (없으면 left/right에서 마이그레이션 → cols로 영속화)
  const cols = getComparisonCols(d);
  if (!_colsParse(d.cols)) d.cols = JSON.stringify(cols);
  const rowHeights = _rowHeights(d);        // 행 인덱스별 높이 오버라이드 (전 칼럼 공통)
  const N = cols.length;
  const featuredIdx = getComparisonFeaturedIdx(d, N);
  if (d.featured !== String(featuredIdx)) d.featured = String(featuredIdx);

  const designW = parseInt(d.compW) || 720;
  const contentW = Math.max(120, designW - padX * 2);   // 카드들이 놓일 안쪽 폭

  // 가로 폭: featured = baseW * featScale, 나머지는 baseW, 인접 칼럼은 overlap만큼 겹침
  const baseW = Math.round((contentW + overlap * (N - 1)) / ((N - 1) + featScale));
  const featW = Math.round(baseW * featScale);

  // 이미지 행 기본 높이: rowHeights 오버라이드 없으면 제품컷 슬롯답게 카드폭 비례(~정방형).
  // (구버전은 텍스트행 rowH=64로 폴백 → 이미지 슬롯이 얇은 띠로 수축하는 렌더 붕괴)
  const imgRowDefault = () => Math.round(Math.max(120, baseW * 0.9));
  // 행 인덱스 ri의 기본 높이(featScale 적용 전): rowHeights 오버라이드 > 이미지행 기본 > rowH.
  const _baseRowH0 = (ri, row) => {
    const o = rowHeights[ri];
    const n = (o == null) ? 0 : Number(o);
    if (Number.isFinite(n) && n > 0) return n;
    if (row && row.type === 'image') return imgRowDefault();
    return rowH;
  };
  // ★D2 행 높이 자동 확장(결정 ⑩) — 그 행 인덱스의 높이 = max(설정 높이, 전 칼럼 중 그 행 줄 내용 높이). _lnNeed 없으면 위 그대로.
  const baseRowH = (ri, row) => {
    const h = _baseRowH0(ri, row);
    const n = _lnNeed ? _lnNeed[ri] : 0;
    return n > h ? n : h;
  };
  // 각 칼럼 높이 (featured만 header/row/gap 확대). 각 카드 상하 padY 포함. 행별 높이 누적.
  // captionPos:'top'이면 헤더가 카드 밖으로 나가므로 카드 높이에서 제외.
  const colHeightOf = (rows, isFeat) => {
    const hH  = captionPos === 'top' ? 0 : (isFeat ? Math.round(headerH * featScale) : headerH);
    const gap = isFeat ? Math.round(rowGap * featScale) : rowGap;
    let acc = padY * 2 + hH;
    for (let ri = 0; ri < rows.length; ri++) {
      const rH = isFeat ? Math.round(baseRowH(ri, rows[ri]) * featScale) : baseRowH(ri, rows[ri]);
      acc += rH + gap;
    }
    return acc;
  };
  const heights = cols.map((c, i) => colHeightOf(c.rows, i === featuredIdx));
  const totalH = Math.max(...heights, 1);
  const designH = capZone + totalH + stagger + yPad * 2;

  block.style.position = 'relative';
  block.style.overflow = 'visible';
  block.style.width = '100%';
  block.style.maxWidth = 'none';   // 테이블 등 일반 블록과 동일하게 컨테이너 폭을 꽉 채움 (designW는 내부 좌표 기준일 뿐)
  block.style.margin = '0';

  let inner = block.querySelector('.cmp-inner');
  if (!inner) { inner = document.createElement('div'); inner.className = 'cmp-inner'; block.appendChild(inner); }
  inner.innerHTML = '';
  inner.style.cssText = `position:absolute;top:0;left:0;right:auto;bottom:auto;width:${designW}px;height:${designH}px;transform-origin:top left;overflow:visible;`;

  const buildCol = (idx, c, isFeat, left, w) => {
    const col = document.createElement('div');
    col.className = 'cmp-col' + (isFeat ? ' cmp-feat' : ' cmp-muted');
    col.dataset.colIdx = idx;
    const hH    = isFeat ? Math.round(headerH * featScale) : headerH;
    const gap   = isFeat ? Math.round(rowGap * featScale) : rowGap;
    const tFont = isFeat ? Math.round(baseTitleFont * featScale) : baseTitleFont;
    const rFont = isFeat ? Math.round(baseRowFont * featScale) : baseRowFont;
    const rad   = isFeat ? Math.round(radius * featScale) : radius;
    const h = colHeightOf(c.rows, isFeat);
    // 공통 중심선 정렬(featured overhang) + 캡션 존 + muted 스태거 하향
    const top = yPad + capZone + (totalH - h) / 2 + (isFeat ? 0 : stagger);
    const bg = c.bg || (isFeat ? '#ffffff' : '#e9ebef');
    const textColor = c.text || (isFeat ? '#1a1a1a' : '#9aa0a8');
    col.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${w}px;` +
      `padding:${padY}px 0;box-sizing:border-box;background:${bg};border-radius:${rad}px;` +
      `z-index:${isFeat ? 2 : 1};overflow:hidden;` +
      (isFeat ? 'box-shadow:0 18px 50px rgba(0,0,0,0.22);' : '');

    // featured 이웃에 겹쳐 가려지는 쪽 인셋: muted 칼럼의 헤더/텍스트가 overlap 존을 피하게 (R3)
    const insetR = (!isFeat && idx === featuredIdx - 1) ? overlap : 0;
    const insetL = (!isFeat && idx === featuredIdx + 1) ? overlap : 0;

    // 헤더 — titleBg/titleColor(칼럼별 밴드 색) 지원. 미지정 시 기존 동작 유지.
    const hdBg = (typeof c.titleBg === 'string' && c.titleBg) ? c.titleBg : '';
    const hdColor = (typeof c.titleColor === 'string' && c.titleColor) ? c.titleColor : textColor;
    if (captionPos === 'top') {
      // 캡션 모드: 제목을 카드 밖 상단에 — titleBg 있으면 필(pill), 없으면 볼드 텍스트
      const cap = document.createElement('div');
      cap.className = 'cmp-caption'; cap.dataset.colIdx = idx;
      cap.style.cssText = `position:absolute;left:${left}px;top:${top - capH - capGap}px;width:${w}px;` +
        `display:flex;align-items:center;justify-content:center;text-align:center;height:${capH}px;` +
        `z-index:${isFeat ? 2 : 1};box-sizing:border-box;`;
      const capIn = document.createElement('div');
      capIn.className = 'cmp-hd'; capIn.dataset.colIdx = idx;   // _editableTitle 규약 유지 (blur → cols[idx].title)
      capIn.textContent = c.title || '';
      /* ★⒟ 빈 제목에 «누를 면적»을 준다 (2026-10-08 ⒜의 ★전제조건).
         ★무엇이 있었나 — capIn 엔 height 가 ★없다. 글자가 있을 때만 줄상자가 생긴다.
           ⇒ ⒜로 제목을 비우면 ★0×0 이 되어 더블클릭이 ★안 닿는다
             (실측: header 모드 .cmp-hd = 331×70 / 397×83 · 캡션 모드 = ★0×0 / ★0×0).
           그 꼴이 바로 「★«선택이 안 된다»는 규칙이 아니라 ★«면적»일 수 있다」(1px 줄, 260930)의 재발이다.
         ★«빈 제목일 때만» 준다 — 글자가 있는 칸의 그림은 ★한 픽셀도 안 바뀐다
           (hdBg 알약이 칸 폭으로 늘어나는 부수효과를 막는다).
         ★자는 capH 를 ★그대로 쓴다(캡션 존 높이) — ⛔새 수를 발명하지 않는다. */
      const capEmpty = !(c.title || '').trim();
      capIn.style.cssText = `font-size:${tFont}px;font-weight:${isFeat ? 800 : 700};color:${hdColor};line-height:1.2;` +
        `white-space:pre-wrap;word-break:keep-all;` +
        (capEmpty ? `min-width:100%;min-height:${capH}px;box-sizing:border-box;` : '') +
        (hdBg ? `background:${hdBg};padding:${Math.round(tFont * 0.35)}px ${Math.round(tFont * 0.9)}px;border-radius:999px;` : '');
      _editableTitle(capIn, block, idx);
      cap.appendChild(capIn);
      inner.appendChild(cap);
    } else {
      const hd = document.createElement('div');
      hd.className = 'cmp-hd'; hd.dataset.colIdx = idx;
      hd.textContent = c.title || '';
      hd.style.cssText = `height:${hH}px;display:flex;align-items:center;justify-content:center;text-align:center;` +
        `font-size:${tFont}px;font-weight:${isFeat ? 800 : 700};color:${hdColor};${hdBg ? `background:${hdBg};` : ''}` +
        `padding:0 ${16 + insetR}px 0 ${16 + insetL}px;box-sizing:border-box;line-height:1.2;` +
        `white-space:pre-wrap;word-break:keep-all;`;   /* ★1017t1c2 — 캡션 모드(:392)와 ★같은 선언. Enter 줄바꿈이 헤더(header)에서도 그려지게 */
      _editableTitle(hd, block, idx);
      col.appendChild(hd);
    }
    // 행 (행 인덱스별 높이 + text/image 분기)
    c.rows.forEach((row, ri) => {
      const effRowH = isFeat ? Math.round(baseRowH(ri, row) * featScale) : baseRowH(ri, row);
      const r = document.createElement('div');
      r.className = 'cmp-row'; r.dataset.colIdx = idx; r.dataset.rowIdx = ri;
      const isImg = row && row.type === 'image';
      if (isImg) {
        // 순수 이미지 행: backgroundImage div. 빈 imgSrc면 placeholder(체커보드) — dataset 직접 채우지 않음.
        r.classList.add('cmp-img');
        const src = row.imgSrc || '';
        /* ★D3 위치/확대 — 식은 카드블럭 «한 벌»(_cvbBackgroundSize · 사본 금지). 키가 없으면 현행 바이트 그대로
           (size = fit · position = center) ⇒ 옛 저장본 픽셀 불변(검사 cmp-img-edit E7). */
        r.style.cssText = `height:${effRowH}px;margin-top:${gap}px;box-sizing:border-box;overflow:hidden;` +
          (src
            ? `background-image:url("${src}");background-size:${cmpImgBgSize(row)};background-position:${cmpImgBgPos(row)};background-repeat:no-repeat;`
            : '');
        if (!src) r.classList.add('cmp-img-empty');
        /* ★1012t1D4 — 블러·색보정. ★정본은 모델(row.redact · row.adj) — div 는 매 렌더 새로 생기므로 «매번» 칠한다.
           블러 = 이 div 의 ::after backdrop(css/editor-layout.css · data-redact + --redact-blur) · 색보정 = 이 div 의 filter:url(#…)
           ⇒ 다른 요소·다른 속성이라 서로 안 덮는다. 0/기본값이면 흔적 0(옛 저장본 바이트 그대로). 빈 슬롯엔 안 건다. */
        applyRedact(r, src ? row.redact : 0);
        const _adj = src ? _cmpAdj(row.adj) : '';   // 7키 다 채운 꼴로(applyImgColorAdjust 는 키가 빠지면 toFixed 에서 죽는다)
        if (_adj) window.applyImgColorAdjust?.(r, _adj);
      } else if (row && lnHasLines(row.lines)) {
        /* ★1012t1D2 — 줄 칸: text 대신 줄만 그린다(버블 D1 「갈음」). 줄 = 그리드 줄 HTML(line-host lnLinesHtml · 칸 기본 정렬 = 가운데).
           줄 글자 편집 = 줄 더블클릭(lnBindLineEdit · block-drag.js 가 블럭에 건다) — ⛔_editableRow(칸 통째 편집)를 안 건다(줄 경계가 깨진다).
           줄 역할 크기는 절대값(결정 ⑪ — 강조 배율 안 곱함). 칼럼 글자색은 상속(색 미지정 줄). */
        r.classList.add('cmp-lines');
        r.style.cssText = `height:${effRowH}px;margin-top:${gap}px;display:flex;flex-direction:column;justify-content:center;text-align:center;` +
          `font-size:${rFont}px;font-weight:${isFeat ? 600 : 400};color:${textColor};` +
          `padding:0 ${12 + insetR}px 0 ${12 + insetL}px;box-sizing:border-box;`;
        r.setAttribute('contenteditable', 'false');
        r.innerHTML = lnLinesHtml(row.lines, ri, idx, 'center');
      } else {
        r.textContent = (row && row.text != null) ? row.text : '';
        r.style.cssText = `height:${effRowH}px;margin-top:${gap}px;display:flex;align-items:center;justify-content:center;text-align:center;` +
          `font-size:${rFont}px;font-weight:${isFeat ? 600 : 400};color:${textColor};` +
          `padding:0 ${12 + insetR}px 0 ${12 + insetL}px;box-sizing:border-box;` +
          `white-space:pre-wrap;word-break:keep-all;`;   /* ★1017t1c2 — 캡션 헤더(:392)와 ★같은 선언. Enter 줄바꿈이 그려지게 */
        _editableRow(r, block, idx, ri);
      }
      col.appendChild(r);
    });
    return col;
  };

  let x = padX;
  cols.forEach((c, i) => {
    const isFeat = i === featuredIdx;
    const w = isFeat ? featW : baseW;
    inner.appendChild(buildCol(i, c, isFeat, x, w));
    x += w - overlap;
  });
  /* ★D2 2단계 — 줄 칸의 자연 높이를 재서(offset* 는 transform 영향 없음) 모자라면 그 행 인덱스를 늘려 «한 번» 다시 그린다. */
  if (!_lnNeed) {
    const need = _cmpLinesNeed(inner, featuredIdx, featScale, cols);
    if (need) { renderComparison(block, need); return; }
  }
  _cmpPaintActiveMark(block);   // ★D3 — 통째 재렌더가 지운 «칸 선택» 표시를 모델(block._cmpActiveCell)에서 다시 칠한다
  lnRemark(block);              // ★D2 — 통째 재렌더가 지운 «줄 선택» 표시를 되붙인다(선택된 블럭의 활성 줄만 · 줄 없으면 DOM 무변)

  const applyScale = () => {
    const aw = block.offsetWidth; if (aw <= 0) return;
    const scale = aw / designW;
    inner.style.transform = `scale(${scale})`;
    block.style.height = (designH * scale) + 'px';
    block._cmpScale = scale;
  };
  applyScale();
  if (block._cmpRO) block._cmpRO.disconnect();
  block._cmpRO = new ResizeObserver(applyScale);
  block._cmpRO.observe(block);
}

/* ★D2 — 줄 칸이 «늘어야 할» 행 높이. 없으면 null(= 2단계 안 탐). 문서에 안 붙은 칸(offsetHeight 0)은 역할 크기 × 줄높이로 근사. */
function _cmpLinesApproxH(lines) {
  let h = 0;
  for (const l of (Array.isArray(lines) ? lines : [])) {
    if (!l || typeof l !== 'object') continue;
    if (l.type === 'gap') { h += Number(l.height) || 16; continue; }
    const role = GRID_ROLES[l.type] || GRID_ROLES.body;
    const fs = Number(l.fontSize) || role.size;
    const lh = Number(l.lineHeight) || Number(role.lh) || 1.4;
    h += fs * lh * String(l.text ?? '').split('\n').length;
  }
  return Math.ceil(h);
}
function _cmpLinesNeed(inner, featuredIdx, featScale, cols) {
  const cells = inner.querySelectorAll('.cmp-row.cmp-lines');
  if (!cells.length) return null;
  const need = {};
  let grow = false;
  cells.forEach(cell => {
    const ci = Number(cell.dataset.colIdx), ri = Number(cell.dataset.rowIdx);
    const k = ci === featuredIdx ? featScale : 1;
    const kids = cell.children;
    let span;
    if (cell.isConnected && cell.offsetHeight > 0 && kids.length) {
      const first = kids[0], last = kids[kids.length - 1];
      span = (last.offsetTop + last.offsetHeight) - first.offsetTop;
    } else span = _cmpLinesApproxH(cols[ci]?.rows?.[ri]?.lines);
    const cur = parseFloat(cell.style.height) || 0;
    if (span > cur) {
      const b = Math.ceil(span / k) + 1;   // +1 = 강조 칼럼 반올림(Math.round(b × featScale)) 여유
      if (!(need[ri] >= b)) need[ri] = b;
      grow = true;
    }
  });
  return grow ? need : null;
}

function _editableTitle(el, block, colIdx) {
  el.setAttribute('contenteditable', 'false');
  el.addEventListener('dblclick', e => {
    e.stopPropagation();
    el.setAttribute('contenteditable', 'true');
    el.focus();
    // placeholder(기본문구)면 전체선택 → 첫 타이핑이 즉시 교체. 실데이터면 caret 유지.
    if (isCmpPlaceholderText(el.textContent)) _selectAllContents(el);
  });
  el.addEventListener('blur', () => {
    el.setAttribute('contenteditable', 'false');
    /* ★D5 — 다 지우고 나가면 contenteditable 이 <br> 을 남겨 :empty 가 깨진다(실측) → 안내 ::before 가 안 돌아온다. 진짜로 비운다.
       ★1017t1c2 — mdlReadText 로 재므로 ★textContent 가 아니라 ★같은 자로 비었는지 본다(두 자가 갈리면 뜻이 안 맞는다). */
    if (mdlReadText(el) === '' && el.firstChild) el.textContent = '';
    const cols = getComparisonCols(block.dataset);
    if (cols[colIdx]) {
      /* ★⒝ 빈 칸을 기본문구로 ★«되돌리지 않는다» (현빈 2026-10-08).
         ~~예전: `if (val.trim()==='') { val = CMP_PLACEHOLDER_TITLE; el.textContent = val; }`~~
         ★그 한 줄이 현빈이 불편해한 «지워도 되살아난다»의 ★바로 그 자리다
           (실측 — 비우고 blur → DOM·모델 둘 다 '새 칼럼'으로 돌아왔다).
         ⛔「빈 칸이 레이아웃 빈칸이 된다」는 ★여기서 막지 않는다 — 면적은 renderComparison 이 준다:
           header 모드 = hd 의 `height:${hH}px` · 캡션 모드 = capIn 의 ⒟ 최소 면적.
         ★1017t1c2 — ★el.textContent 대신 ★mdlReadText(el) — Enter 줄바꿈이 \n 으로 산다(모달 한 벌). */
      cols[colIdx].title = mdlReadText(el);
      setComparisonCols(block, cols);
    }
    window.pushHistory?.(); window.scheduleAutoSave?.();
    /* ★⒟ 과 한 쌍 — 캡션 모드에서 제목을 ★비웠으면 ★다시 그린다.
       까닭: capIn 의 «빈 칸 최소 면적»은 ★그릴 때 정해진다. 안 그리면 방금 비운 그 칸이
       옛 인라인 style 을 쥔 채 ★0×0 이 되어 ★다시 눌러 쓸 길이 사라진다(되돌릴 수 없는 소실).
       ⛔header 모드는 height 가 박혀 있어 해당 없다 — 조건을 좁혀 둔다. */
    if (block.dataset.captionPos === 'top' && el.textContent.trim() === '') {
      try { renderComparison(block); } catch (_) {}
    }
    if (block.classList.contains('selected')) window.showComparisonProperties?.(block);
  });
}
function _editableRow(el, block, colIdx, rowIdx) {
  el.setAttribute('contenteditable', 'false');
  el.addEventListener('dblclick', e => {
    e.stopPropagation();
    el.setAttribute('contenteditable', 'true');
    el.focus();
    // placeholder(기본문구)면 전체선택 → 첫 타이핑이 즉시 교체. 실데이터면 caret 유지.
    if (isCmpPlaceholderText(el.textContent)) _selectAllContents(el);
  });
  el.addEventListener('blur', () => {
    el.setAttribute('contenteditable', 'false');
    /* ★D5 — 다 지우고 나가면 contenteditable 이 <br> 을 남겨 :empty 가 깨진다(실측) → 안내 ::before 가 안 돌아온다. 진짜로 비운다.
       ★1017t1c2 — mdlReadText 로 재므로 ★textContent 가 아니라 ★같은 자로 비었는지 본다(두 자가 갈리면 뜻이 안 맞는다). */
    if (mdlReadText(el) === '' && el.firstChild) el.textContent = '';
    const cols = getComparisonCols(block.dataset);
    const row = cols[colIdx]?.rows?.[rowIdx];
    // 객체행이면 .text만 갱신(이미지행 imgSrc 유실 방지). getComparisonCols가 항상 객체로 정규화하므로 항상 객체.
    if (row && typeof row === 'object') {
      if (row.type !== 'image') {
        /* ★⒝ 빈 칸을 기본문구로 ★«되돌리지 않는다» (현빈 2026-10-08).
           ~~예전: `if (val.trim()==='') { val = CMP_PLACEHOLDER_ROW; el.textContent = val; }`~~
           ★실측 — 비우고 blur → DOM·모델 둘 다 '내용 입력'으로 돌아왔다.
           ⛔행은 ★면적을 잃지 않는다 — r 의 `height:${effRowH}px` 가 늘 박혀 있다(캡션 모드에서도).
           ★1017t1c2 — ★el.textContent 대신 ★mdlReadText(el) — Enter 줄바꿈이 \n 으로 산다(모달 한 벌). */
        row.text = mdlReadText(el);
      }
      setComparisonCols(block, cols);
    }
    window.pushHistory?.(); window.scheduleAutoSave?.();
    if (block.classList.contains('selected')) window.showComparisonProperties?.(block);
  });
}

function makeComparisonBlock(data = {}) {
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';
  const block = document.createElement('div');
  block.className = 'comparison-block'; block.dataset.type = 'comparison';
  block.id = genId('cmp');
  block.dataset.layerName = data.layerName || 'Comparison';
  block.dataset.compW     = data.compW ?? 720;
  block.dataset.featScale = data.featScale ?? 1.2;
  block.dataset.titleFont = data.titleFont ?? 26;
  block.dataset.rowFont   = data.rowFont ?? 18;
  block.dataset.padX      = data.padX ?? 0;
  block.dataset.padY      = data.padY ?? 0;
  block.dataset.overlap   = data.overlap ?? 32;
  block.dataset.radius    = data.radius ?? 20;
  block.dataset.headerH   = data.headerH ?? 72;
  block.dataset.rowH      = data.rowH ?? 64;
  block.dataset.rowGap    = data.rowGap ?? 8;
  if (data.captionPos === 'top') block.dataset.captionPos = 'top';      // 캡션 카드 밖 상단 (2026-07-04)
  if (Number(data.stagger) > 0) block.dataset.stagger = String(Math.min(400, Math.round(Number(data.stagger))));
  /* ★⒜ 새 블럭은 ★빈 칸으로 난다(2026-10-08). 칸 «수»(2칼럼 × 4행)는 ★그대로 둔다 —
     구조가 보여야 어디에 쓸지 알 수 있고, 면적도 거기서 나온다(renderComparison 이 height 를 박는다). */
  const defaultCols = [
    { title: data.leftTitle  ?? '', bg: data.leftBg  || '#e9ebef', text: data.leftText  || '#9aa0a8', rows: data.leftRows  || cmpEmptyRows(4) },
    { title: data.rightTitle ?? '', bg: data.rightBg || '#ffffff', text: data.rightText || '#1a1a1a', rows: data.rightRows || cmpEmptyRows(4) },
  ];
  const cols0 = data.cols || defaultCols;
  block.dataset.cols = JSON.stringify(cols0);
  // featured: 인덱스. 구버전 'left'/'right'도 허용. 기본은 마지막(오른쪽) 칼럼.
  // Codex Medium 픽스: cols 3개 이상에서 '1' 하드코딩이 가운데를 강조하던 회귀 수정.
  block.dataset.featured = data.featured != null
    ? String(data.featured)
    : String(Math.max(0, (Array.isArray(cols0) ? cols0.length : 2) - 1));
  renderComparison(block);
  row.appendChild(block);
  return { row, block };
}

function addComparisonBlock(opts = {}) {
  if (window._insertToFlowFrame?.(() => makeComparisonBlock(opts))) return null;
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return null; }
  window.pushHistory();
  const { row, block } = makeComparisonBlock(opts);
  insertAfterSelected(sec, row);
  bindBlock(block);
  if (block.querySelector('.cmp-lines')) renderComparison(block);   // ★D2 — 문서에 붙은 뒤 줄 칸 높이를 «재서» 다시(붙기 전엔 근사)
  window.buildLayerPanel();
  // 방금 추가한 블록 자동 선택 + 화면 안으로 스크롤 (C9)
  try { window.selectBlock?.(block.id); } catch (_) {}
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.scheduleAutoSave?.();
  return { row, block };
}

// ── 수정 ────────────────────────────────────────────────────────────────────
// PM의 update_comparison_block(MCP) → main(_invokeRendererUpdateComparisonBlock) → 여기.
// banner02 updateBanner02Block 패턴 미러. dataset partial write + renderComparison 재렌더 + autoSave.
// 지원 필드 (data-* 매핑):
//   - 외곽: compW, featScale, overlap, radius, padX, padY, headerH, rowH, rowGap
//   - 텍스트: titleFont, rowFont
//   - 강조: featured (int index)
//   - 칼럼 전체: cols (배열 전체 교체, 길이 2~8, rows ≤ 20)
//       rows 항목: 문자열(=text행) 또는 {type:'text'|'image', text?, imgSrc?, imgFit?'cover'|'contain'}
//       칼럼·행의 확장 필드(titleBg/titleColor · 행 imgX/imgY/imgScale …)는 보존 명부 CMP_COL_KEEP/CMP_ROW_KEEP 대로 실린다(파일 머리).
//   - 칼럼 단위 patch: columnPatch [{index, title?, bg?, text?, titleBg?, titleColor?, rows?}, ...] (rows 항목 동일 규칙 · titleBg/titleColor '' = 지우기)
//   - 행 높이: rowHeights (행 인덱스→px 배열, null/0이면 기본 rowH, 16~400, ≤ 20개)
//   - 칸 하나의 줄: rowLines {col, row, lines|null} (★1012t1D2 — 그 칸만 바꾼다 · 다른 행·필드 무접촉 · null/[] = 줄 걷기 · 이미지 칸 거절)
//       rows 항목의 lines 도 받는다(보존 명부 CMP_ROW_KEEP.lines — 잣대 lnValidateLines). 줄이 있으면 text 는 줄 글자 거울.
//   - 메타: layerName
// opts.noHistory — push-before 를 안 찍는다(line-host 주인 계약 · 버블/챗 문과 같은 칸).
function updateComparisonBlock(blockId, partial = {}, opts = {}) {
  if (!blockId) return { ok: false, code: 'NOT_FOUND', message: 'blockId required' };
  const block = document.getElementById(String(blockId));
  if (!block || !block.classList.contains('comparison-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `comparison-block not found: ${blockId}` };
  }
  if (partial == null || typeof partial !== 'object') {
    return { ok: false, code: 'INVALID', message: 'partial must be object' };
  }

  // Codex Medium 픽스: 검증 단계에서 어떤 dataset도 mutate하지 않는다.
  // 모든 검증을 통과한 후에만 마지막에 일괄 commit. 실패해도 상태는 변화 없음.
  const draft = {};      // 데이터셋 단순 필드 (key → string)
  const applied = {};    // 반환용 요약
  let draftCols = null;  // cols 변경분 (cols 전체교체 또는 columnPatch 적용 후)

  const _setNumDraft = (datasetKey, value, min, max, appliedKey) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return { ok: false, msg: `${appliedKey || datasetKey} must be finite number` };
    if (min !== undefined && n < min) return { ok: false, msg: `${appliedKey || datasetKey} < ${min}` };
    if (max !== undefined && n > max) return { ok: false, msg: `${appliedKey || datasetKey} > ${max}` };
    draft[datasetKey] = String(n);
    applied[appliedKey || datasetKey] = n;
    return { ok: true };
  };

  // 행 1개 검증/정규화 — 문자열(text행) 또는 {type:'text'|'image', text, imgSrc, imgFit} 객체 허용.
  // imgSrc는 renderComparison의 url("...") template에 들어가므로 escape 가드(banner02:417-424 미러).
  const _sanitizeRow = (raw) => {
    if (raw == null || typeof raw === 'string') {
      const s = raw == null ? '' : String(raw);
      if ([...s].length > 500) return { ok: false, msg: 'too long' };
      return { ok: true, row: { type: 'text', text: s } };
    }
    if (typeof raw !== 'object') return { ok: false, msg: 'must be string or object' };
    const type = raw.type === 'image' ? 'image' : (raw.type == null || raw.type === 'text' ? 'text' : null);
    if (type === null) return { ok: false, msg: `invalid type: ${raw.type}` };
    /* ★D2 — 줄은 먼저 잰다(잣대의 말을 그대로 돌려준다). 줄이 있는 글자 칸의 text 는 거울이라 500자 상한을 안 본다(줄마다 상한이 있다). */
    const hasLines = raw.lines != null && !(Array.isArray(raw.lines) && !raw.lines.length);
    if (hasLines) {
      const e = Array.isArray(raw.lines) ? lnValidateLines(raw.lines, 'lines') : { message: 'lines must be array' };
      if (e) return { ok: false, msg: e.message };
    }
    const text = raw.text == null ? '' : String(raw.text);
    if (!(hasLines && type === 'text') && [...text].length > 500) return { ok: false, msg: 'text too long' };
    let row;
    if (type === 'text') row = { type: 'text', text };
    else {
      const imgSrc = raw.imgSrc == null ? '' : String(raw.imgSrc);
      if (imgSrc.length > 200000) return { ok: false, msg: 'imgSrc too long (>200000)' };
      if (/["\r\n]/.test(imgSrc)) return { ok: false, msg: 'imgSrc contains quote/newline (escape unsafe)' };
      const imgFit = raw.imgFit === 'contain' ? 'contain' : 'cover';
      row = { type: 'image', text, imgSrc, imgFit };
    }
    const bad = _cmpKeep(CMP_ROW_KEEP, raw, row);   // 보존 명부(행) — D3: imgX/imgY/imgScale. D2·D4 가 더한다.
    if (bad) return { ok: false, msg: `${bad} invalid` };
    if (type === 'text' && row.lines) cmpRowSetLines(row, row.lines);   // ★D2 — text = 줄 글자 거울
    return { ok: true, row };
  };

  if (partial.layerName !== undefined && partial.layerName !== null) {
    const s = String(partial.layerName);
    if ([...s].length > 100) return { ok: false, code: 'INVALID', message: 'layerName too long' };
    draft.layerName = s;
    applied.layerName = s;
  }

  // 외곽/크기
  const _numFields = [
    ['compW',     'compW',     120, 4000],
    ['overlap',   'overlap',   0,   400],
    ['radius',    'radius',    0,   400],
    ['padX',      'padX',      0,   400],
    ['padY',      'padY',      0,   400],
    ['headerH',   'headerH',   16,  400],
    ['rowH',      'rowH',      16,  400],
    ['rowGap',    'rowGap',    0,   200],
    ['titleFont', 'titleFont', 4,   400],
    ['rowFont',   'rowFont',   4,   400],
  ];
  for (const [pk, dk, min, max] of _numFields) {
    if (partial[pk] === undefined || partial[pk] === null) continue;
    const r = _setNumDraft(dk, partial[pk], min, max, pk);
    if (!r.ok) return { ok: false, code: 'INVALID', message: r.msg };
  }

  if (partial.featScale !== undefined && partial.featScale !== null) {
    const n = Number(partial.featScale);
    if (!Number.isFinite(n) || n < 1 || n > 1.5) {
      return { ok: false, code: 'INVALID', message: 'featScale out of range (1.0~1.5)' };
    }
    draft.featScale = String(n);
    applied.featScale = n;
  }

  // 캡션 상단 배치 + 컬럼 스태거 (2026-07-04)
  if (partial.captionPos !== undefined && partial.captionPos !== null) {
    if (!['header', 'top'].includes(partial.captionPos)) {
      return { ok: false, code: 'INVALID', message: "captionPos must be 'header'|'top'" };
    }
    draft.captionPos = partial.captionPos;
    applied.captionPos = partial.captionPos;
  }
  if (partial.stagger !== undefined && partial.stagger !== null) {
    const n = Number(partial.stagger);
    if (!Number.isFinite(n) || n < 0 || n > 400) {
      return { ok: false, code: 'INVALID', message: 'stagger must be 0~400' };
    }
    draft.stagger = String(Math.round(n));
    applied.stagger = Math.round(n);
  }

  // cols 전체 교체 (draft만 갱신, mutate X)
  if (partial.cols !== undefined && partial.cols !== null) {
    if (!Array.isArray(partial.cols)) {
      return { ok: false, code: 'INVALID', message: 'cols must be array' };
    }
    if (partial.cols.length < 2 || partial.cols.length > 8) {
      return { ok: false, code: 'INVALID', message: 'cols length must be 2~8' };
    }
    const safeCols = [];
    for (let i = 0; i < partial.cols.length; i++) {
      const c = partial.cols[i];
      if (!c || typeof c !== 'object') {
        return { ok: false, code: 'INVALID', message: `cols[${i}] must be object` };
      }
      const title = c.title != null ? String(c.title) : '';
      if ([...title].length > 200) return { ok: false, code: 'INVALID', message: `cols[${i}].title too long` };
      const bg    = c.bg   != null ? String(c.bg)   : '';
      const text  = c.text != null ? String(c.text) : '';
      if (bg.length > 1024 || text.length > 64) return { ok: false, code: 'INVALID', message: `cols[${i}] color too long` };
      const rows  = Array.isArray(c.rows) ? c.rows : [];
      if (rows.length > 20) return { ok: false, code: 'INVALID', message: `cols[${i}].rows length > 20` };
      const safeRows = [];
      for (let ri = 0; ri < rows.length; ri++) {
        const sr = _sanitizeRow(rows[ri]);
        if (!sr.ok) return { ok: false, code: 'INVALID', message: `cols[${i}].rows[${ri}] ${sr.msg}` };
        safeRows.push(sr.row);
      }
      const safeCol = { title, bg, text, rows: safeRows };
      const badK = _cmpKeep(CMP_COL_KEEP, c, safeCol);   // ★보존 명부 — 예전엔 여기서 titleBg 등을 버렸다
      if (badK) return { ok: false, code: 'INVALID', message: `cols[${i}].${badK} invalid (too long)` };
      safeCols.push(safeCol);
    }
    draftCols = safeCols;
    applied.cols = safeCols;
  }

  // columnPatch — 개별 칼럼 부분 갱신 (draft만 갱신, mutate X)
  if (partial.columnPatch !== undefined && partial.columnPatch !== null) {
    if (!Array.isArray(partial.columnPatch)) {
      return { ok: false, code: 'INVALID', message: 'columnPatch must be array' };
    }
    if (partial.columnPatch.length > 16) {
      return { ok: false, code: 'INVALID', message: 'columnPatch too long' };
    }
    // cols 전체교체 결과를 base로 사용 (없으면 현재 dataset). 둘 다 draft 단계라 mutate X.
    const base = draftCols ? draftCols.map(c => ({ ...c, rows: [...c.rows] })) : getComparisonCols(block.dataset);
    const appliedPatches = [];
    for (let pi = 0; pi < partial.columnPatch.length; pi++) {
      const p = partial.columnPatch[pi];
      if (!p || typeof p !== 'object') {
        return { ok: false, code: 'INVALID', message: `columnPatch[${pi}] must be object` };
      }
      const idx = Number(p.index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= base.length) {
        return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].index ${p.index} out of range (0~${base.length - 1})` };
      }
      const col = base[idx];
      if (p.title !== undefined && p.title !== null) {
        const t = String(p.title);
        if ([...t].length > 200) return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].title too long` };
        col.title = t;
      }
      if (p.bg !== undefined && p.bg !== null) {
        const v = String(p.bg);
        if (v.length > 1024) return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].bg too long` };
        col.bg = v;
      }
      if (p.text !== undefined && p.text !== null) {
        const v = String(p.text);
        if (v.length > 64) return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].text too long` };
        col.text = v;
      }
      { // 보존 명부(칼럼) — titleBg/titleColor 등. '' = 지우기(칼럼 색을 따름).
        const badK = _cmpKeep(CMP_COL_KEEP, p, col);
        if (badK) return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].${badK} invalid (too long)` };
      }
      if (p.rows !== undefined && p.rows !== null) {
        if (!Array.isArray(p.rows)) return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].rows must be array` };
        if (p.rows.length > 20) return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].rows length > 20` };
        const newRows = [];
        for (let ri = 0; ri < p.rows.length; ri++) {
          const sr = _sanitizeRow(p.rows[ri]);
          if (!sr.ok) return { ok: false, code: 'INVALID', message: `columnPatch[${pi}].rows[${ri}] ${sr.msg}` };
          newRows.push(sr.row);
        }
        col.rows = newRows;
      }
      appliedPatches.push({ index: idx });
    }
    draftCols = base;
    applied.columnPatch = appliedPatches;
  }

  /* ★1012t1D2 rowLines — 칸 «하나»의 줄만 바꾼다(line-host 비교 주인의 쓰는 문 · MCP 도 같은 길).
     ⛔columnPatch{rows} 로 보내지 않는 까닭: 그 길은 칼럼의 행을 _sanitizeRow 로 «다시 지어» 명부 밖 필드(memo 등)를 버린다. */
  if (partial.rowLines !== undefined && partial.rowLines !== null) {
    const p = partial.rowLines;
    if (typeof p !== 'object') return { ok: false, code: 'INVALID', message: 'rowLines must be object' };
    const base = draftCols || getComparisonCols(block.dataset);
    const ci = Number(p.col), ri = Number(p.row);
    if (!Number.isInteger(ci) || ci < 0 || ci >= base.length) return { ok: false, code: 'INVALID', message: `rowLines.col ${p.col} out of range (0~${base.length - 1})` };
    const row = base[ci].rows?.[ri];
    if (!Number.isInteger(ri) || !row) return { ok: false, code: 'INVALID', message: `rowLines.row ${p.row} out of range` };
    if (row.type === 'image') return { ok: false, code: 'INVALID', message: 'rowLines: image cell has no lines (lines are for text cells)' };
    const lines = p.lines == null ? null : p.lines;
    if (lines !== null) {
      if (!Array.isArray(lines)) return { ok: false, code: 'INVALID', message: 'rowLines.lines must be array or null' };
      if (lines.length) {
        const e = lnValidateLines(lines, 'rowLines.lines');
        if (e) return { ok: false, code: e.code || 'INVALID', message: e.message };
      }
    }
    let copy = null;
    try { copy = lines && lines.length ? JSON.parse(JSON.stringify(lines)) : null; } catch (_) { return { ok: false, code: 'INVALID', message: 'rowLines.lines not serializable' }; }
    cmpRowSetLines(row, copy);
    draftCols = base;
    applied.rowLines = { col: ci, row: ri, lines: copy ? copy.length : 0 };
  }

  // featured (int index) — cols 변경분과의 정합성 검사
  let draftFeatured = null;
  if (partial.featured !== undefined && partial.featured !== null) {
    const refCols = draftCols || getComparisonCols(block.dataset);
    const fi = Number(partial.featured);
    if (!Number.isInteger(fi) || fi < 0 || fi >= refCols.length) {
      return { ok: false, code: 'INVALID', message: `featured ${partial.featured} out of range (0~${refCols.length - 1})` };
    }
    draftFeatured = String(fi);
    applied.featured = fi;
  }

  // rowHeights — 행 인덱스별 높이 오버라이드 배열 (draft만 갱신, mutate X)
  let draftRowHeights = null;
  if (partial.rowHeights !== undefined && partial.rowHeights !== null) {
    if (!Array.isArray(partial.rowHeights)) {
      return { ok: false, code: 'INVALID', message: 'rowHeights must be array' };
    }
    if (partial.rowHeights.length > 20) {
      return { ok: false, code: 'INVALID', message: 'rowHeights length > 20' };
    }
    const safeRH = [];
    for (let ri = 0; ri < partial.rowHeights.length; ri++) {
      const v = partial.rowHeights[ri];
      if (v == null || v === 0 || v === '') { safeRH.push(null); continue; } // 기본 rowH 사용
      const n = Number(v);
      if (!Number.isFinite(n) || n < 16 || n > 400) {
        return { ok: false, code: 'INVALID', message: `rowHeights[${ri}] out of range (16~400 or null)` };
      }
      safeRH.push(Math.round(n));
    }
    draftRowHeights = safeRH;
    applied.rowHeights = safeRH;
  }

  // before 스냅샷 (commit 직전, 검증 모두 통과 후)
  const before = {
    cols: block.dataset.cols, featured: block.dataset.featured,
    featScale: block.dataset.featScale, compW: block.dataset.compW,
    rowHeights: block.dataset.rowHeights,
  };

  // ── 모든 검증 통과 — 여기서부터 mutate ──
  if ((opts || {}).noHistory !== true) window.pushHistory?.();

  // 단순 필드 (key=value)
  for (const [k, v] of Object.entries(draft)) {
    block.dataset[k] = v;
  }
  // cols 변경분
  if (draftCols) block.dataset.cols = JSON.stringify(draftCols);
  // featured
  if (draftFeatured !== null) block.dataset.featured = draftFeatured;
  // rowHeights
  if (draftRowHeights !== null) block.dataset.rowHeights = JSON.stringify(draftRowHeights);

  // 재렌더
  try {
    renderComparison(block);
  } catch (e) {
    return { ok: false, code: 'RENDER_ERROR', message: e.message };
  }

  if (block.classList.contains('selected')) {
    try { window.showComparisonProperties?.(block); } catch (_) {}
  }
  try { window.buildLayerPanel?.(); } catch (_) {}

  window.scheduleAutoSave?.();

  return { ok: true, blockId, before, applied };
}

window.makeComparisonBlock = makeComparisonBlock;
window.addComparisonBlock  = addComparisonBlock;
window.updateComparisonBlock = updateComparisonBlock;
window.renderComparison    = renderComparison;
window.getComparisonCols   = getComparisonCols;
window.getComparisonFeaturedIdx = getComparisonFeaturedIdx;
window.setComparisonCols   = setComparisonCols;
window.normalizeComparisonRow = normalizeRow;
/* ★식별 명부의 ★정본 한 자리를 검사가 «런타임»으로 읽게 둔다 (선례: window.GRID_CELL_DEFAULT_TEXT).
   ⛔검사가 이 파일을 ★소스 파싱해 리터럴을 뽑던 것을 걷었다 — 주석·상수 참조로 적는 순간 그 자가 조용히 줄어든다. */
window.CMP_PLACEHOLDERS    = CMP_PLACEHOLDERS;
window.CMP_ROW_HINT        = CMP_ROW_HINT;   // D5 — 빈 칸 안내문(시각 전용). 검사·패널이 읽는다.
window.CMP_HD_HINT         = CMP_HD_HINT;
window.CMP_COL_KEEP        = CMP_COL_KEEP;  // D1 — 보존 명부(검사가 런타임으로 읽는다)
window.CMP_ROW_KEEP        = CMP_ROW_KEEP;
// ★D3 — 이미지 칸 편집 (block-drag.js · block-factory.js · editor.js 는 import 대신 window 로 부른다 — 순환 회피 관례)
window.cmpCellAddrAt          = cmpCellAddrAt;
window.cmpGetActiveCell       = cmpGetActiveCell;
window.cmpSetActiveCell       = cmpSetActiveCell;
window.cmpClearAllActiveCells = cmpClearAllActiveCells;
window.cmpPickRowImage        = cmpPickRowImage;
window.cmpImgBgSize           = cmpImgBgSize;
window.cmpImgBgPos            = cmpImgBgPos;
window.cmpRowSetLines         = cmpRowSetLines;   // ★D2 — line-host 비교 주인(write)이 부른다(순환 import 회피 관례)

/* ⛔isCmpPlaceholderText 를 여기 더하지 마라 — 위에서 이미 `export function` 이다(중복 export = 문법 오류).
   2026-10-08 에 내가 실제로 이 줄로 깨뜨렸고, ★자가 그걸 ★못 잡았다. 실측(★어느 판인지 같이 적는다 —
   이 워크트리 · node v24.11.1 · 레포 package.json `"type":"commonjs"`):
     node --check js/blocks/comparison-block.js            → rc=1 「Cannot use import statement outside a module」
     node --check <같은 파일에 진짜 문법오류를 더한 사본>   → rc=1 ★같은 메시지
     ⇒ ★멀쩡한 파일과 깨진 파일이 ★같은 답을 낸다 — ★막힌 빨강이라 ★아무것도 가르지 못한다.
     node --check <.mjs 사본>                               → rc=1 「Unexpected token ';'」 ★진짜 오류를 짚는다
   ⇒ ★ESM 파일은 ★.mjs 사본으로 재라. ⛔`node --check <그 .js>` 의 rc 를 근거로 쓰지 마라.
   ⚠️그리고 ~/.claude/settings.json 의 저장 훅은 ★여기까지 ★닿지도 않는다(까닭은 지디에게 올렸다) —
     「저장 때 자동으로 잡힌다」를 ★믿지 마라. */
export { makeComparisonBlock, addComparisonBlock, updateComparisonBlock, renderComparison, getComparisonCols, getComparisonFeaturedIdx, setComparisonCols, normalizeRow };

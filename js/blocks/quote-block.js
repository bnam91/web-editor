/* ═══════════════════════════════════════════════════════════════════════════
   QUOTE BLOCK — 인용구 블럭 (현빈 발주 2026-10-07 · ★v1)

   ══ 현빈 말 그대로 ════════════════════════════════════════════════════════
     「텍스트 쉼표쓰기는 천단위 쉼표를 넣는 게 아냐. `< "안녕" >` 이것처럼
       ★텍스트 양옆에 텍스트가 들어가는 블럭을 말해. 3*1 그리드에 들어가 있는 느낌인데
       ★쉼표 모양을 바꿀 수도 있는 거지. … ★쉼표 크기도 바꿀 수 있고
       한 줄씩 `"/안녕/"` 으로 ★스택되는 모양으로도 바꿀 수 있어.
       ★인용구 느낌의 블럭이야. ★앞쪽 혹은 뒤쪽 쉼표를 Off 시킬 수도 있는 거야.」
     추가: 「모양에는 ★[,] (,) 도 괄호도 넣어주면 될듯해」

   ══ 이름 ══════════════════════════════════════════════════════════════════
   ★코드·패널·레이어·프리셋 이름은 ★`quote` / 「인용구」 ★하나다(지디 판정 2026-10-07).
     근거 = 현빈 자신이 「★인용구 느낌의 블럭이야」로 기능 설명을 닫았다.
   ★단 ★사람이 읽는 한 자리(패널 부제)에 ★입말 「쉼표」를 남긴다 — 현빈이 「쉼표」로
     찾았을 때 못 찾으면 ★그게 다음 메모가 된다.

   ══ ⛔3×1 그리드로 만들지 않는다 (★실측 근거) ═══════════════════════════════
   ★「3×1 느낌」은 ★이 블럭이 스스로 내는 레이아웃이다. ⛔grid-block 을 쓰지 않는다.
   ★까닭을 ★행위로 쟀다(2026-10-07):
     ⑴ js/blocks/grid-block.js:11~12 — 「자식 블록 중첩 없음 — 상태는 전부 data-*」
     ⑵ 칸에 블럭을 놓는 길은 ★있다(js/props/prop-grid.js:844 grdDropTextBlockOnCell) —
        그런데 그것은 ★DOM 을 품는 것이 아니라 끌어온 블럭을 ★data 줄로 바꾸고(grdAddLine)
        원본을 ★뗀다(unit.remove()). ⇒ 칸은 ★DOM 블럭을 담지 않는다.
     ⑶ 그리고 prop-grid.js:822 가 `inner.querySelector('ul,ol,img,svg,input,table')` 이면
        ★거절한다 ⇒ ★부호가 SVG·이미지면 그리드 칸은 ★구조적으로 못 받는다.
   ⇒ 이 블럭은 ★제 격자(inline) / ★제 세로쌓기(stack)를 ★스스로 낸다.

   ══ 모델 = dataset 이 진실 ════════════════════════════════════════════════
   coupon-block.js 머리말과 ★같은 규약이다. 인라인 스타일만 쓰면 저장→로드 왕복에서
   값이 증발한다. 글도 dataset 에 산다(재렌더가 타이핑을 지우지 않게).
   ★글자 칸 클래스가 `tb-qt-*` 인 이유 = ★«내보내기 보험».
     export-figma-json 의 generic 폴백이 ★[class^="tb-"] 만 텍스트로 수집한다
     (coupon 의 tb-cpn-line · modal 의 tb-mdl-* 과 ★같은 까닭).
     ⇒ ★부호도 `tb-qt-mark` 라 ★글자로 수집된다 — ★전용 분기가 없어도 ★살아남는다.

   ══ ★v1 부호 = ★글꼴 글리프 8종만 (⛔SVG·이미지 아니다) ═══════════════════════
   ★까닭은 ★내보내기다(P-export 실측 2026-10-07 · 지디 판정):
     `sangpe_to_figma.mjs:185 renderBlock()` 이 타입 ★20개만 분기하고, 안 걸리면
     `generic`(:1356~1373) 으로 떨어지는데 ★그 분기가 `block.svg` 를 ★한 번도 안 읽는다.
     ⇒ ★부호가 SVG 면 ★피그마에서 조용히 사라진다(vector-block 이 이미 그 구멍을 밟고 있다).
   ⇒ ★v1 은 ★글리프라서 ★글자로 나간다 ⇒ ★안 깨진다.
   ⇒ ⛔패널에 ★「에셋(SVG·이미지)」 단추를 ★내지 않는다 — ★없는 걸 보여 주면
      ★「되는 줄 알았다」가 된다. ★v2 에서 ★피그마 분기와 ★같이 켠다.

   ══ ★v1 스택 = «엔터로 나눈다» (⛔줄 버튼 아니다) ═══════════════════════════
   ★지디 판정 — ★모델이 작은 쪽에서 시작한다:
     ① 글이 ★한 덩이(문자열) ⇒ text 블럭과 같은 꼴
     ② migrate 방향이 ★한쪽이다 — 「한 덩이 → lines[]」는 나중에 쪼갤 수 있지만
        ⛔거꾸로는 ★줄마다 준 꾸밈이 사라진다
     ③ 줄 버튼이면 ★줄 추가·삭제·순서 UI 가 같이 와야 한다(grid grdAddLine 꼴) ⇒ v1 범위 밖
   ⇒ ★v1 = 글은 한 덩이고 ★렌더가 줄로 쪼개 ★부호를 양쪽에 단다.
   ★★빈 줄은 ★건너뛴다 — 안 그러면 「/ /」만 떠 버린다(지디가 못박은 단언).
     ⇒ ★불변식: ★«그려진 줄 수» == ★«부호 쌍 수» (앞뒤 둘 다 켰을 때)

   ══ ★부호 크기·간격은 ★글자 크기와 ★따로 간다 ════════════════════════════════
   ⛔묶지 마라 — 묶으면 ★큰 부호를 쓰려고 ★글까지 커진다(시안 설계 결정).
   ⇒ `markSize` · `gap` 은 `fontSize` 와 ★독립된 dataset 키다.

   ══ ⌘Z 한 걸음 ═══════════════════════════════════════════════════════════
   ★`addQuoteBlock` 은 /^add[A-Z][A-Za-z0-9]*Block$/ 에 걸려 js/insert-history.js 가
     ★자동으로 감싼다(그 파일 :91). ⛔EXTRA·DENY 에 손댈 것이 없다.
   ★⛔`updateQuoteBlock` 이라는 이름을 ★만들지 않는다 — js/model-update-history.js 의
     MATCH(/^update[A-Z][A-Za-z0-9]*Block$/)에 ★자동으로 걸려 끝 표본을 하나 더 쌓고
     ⌘Z 가 ★두 번이 된다. 패널 커밋은 coupon 선례대로 `commitQuoteText` ＋ 패널 push-after.
   ⛔삽입 뒤 rAF·setTimeout 으로 캔버스를 더 바꾸지 않는다(insert-history 규약 ④).

   ══ v1 에 ★없는 것 (⛔「나중에」가 아니라 ★이름으로) ═══════════════════════════
   SVG·이미지 부호(＋피그마 renderBlock 분기) · 줄마다 따로 꾸밈(lines[]) · 좌우반전 이미지 ·
   프레임·그리드 칸 끌어넣기 · 부호 앞뒤 ★다른 모양 섞기 · 프리셋 · 세로쓰기 ·
   MCP BLOCK_TYPES · ai-section-fill 슬롯 · 인라인 더블클릭 편집(글은 우측 패널로 넣는다).
═══════════════════════════════════════════════════════════════════════════ */

import { insertAfterSelected, genId, showNoSelectionHint } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

/* ★부호 8종 — ★시안 goditor-quote-block.html 의 그 여덟이다(모양 줄 :qm-1~qm-8).
   ⛔순서를 바꾸지 마라 — 패널 단추 순서다.
   ★현빈 추가 지시의 「[,] (,) 괄호」가 bracket·paren·angle 셋으로 들어와 있다. */
const QUOTE_SHAPES = Object.freeze([
  Object.freeze({ key: 'curly',   label: '“ ”', pre: '“', post: '”' }),
  Object.freeze({ key: 'guillem', label: '« »', pre: '«', post: '»' }),
  Object.freeze({ key: 'corner',  label: '『 』', pre: '『', post: '』' }),
  Object.freeze({ key: 'heavy',   label: '❝ ❞', pre: '❝', post: '❞' }),
  Object.freeze({ key: 'slash',   label: '/ /', pre: '/',       post: '/' }),
  Object.freeze({ key: 'bracket', label: '[ ]', pre: '[',       post: ']' }),
  Object.freeze({ key: 'paren',   label: '( )', pre: '(',       post: ')' }),
  Object.freeze({ key: 'angle',   label: '〈 〉', pre: '〈', post: '〉' }),
]);
const QUOTE_SHAPE_KEYS = Object.freeze(QUOTE_SHAPES.map(s => s.key));

const QUOTE_DEFAULTS = Object.freeze({
  text: '',
  ph: '빠르게 입는 하루',          /* 안내문구 — 비면 이것을 그린다(coupon placeholder 규약) */
  shape: 'curly',
  layout: 'inline',                /* 'inline'(부호·글·부호 한 줄) | 'stack'(줄마다) */
  /* ★부호 — 글자 크기와 ★따로 간다 */
  markSize: 46, markColor: '#C9CDD4',
  gap: 14,
  preOn: true, postOn: true,
  /* ★글 */
  fontSize: 21, textColor: '#1B1D22', weight: 400, align: 'center',
});

/* ★바닥·천장 — 패널과 손잡이가 ★같은 표를 본다(coupon 의 COUPON_LIMITS 규약).
   ⛔패널이 자기 리터럴을 갖는 순간 둘이 갈라진다. */
const QUOTE_LIMITS = Object.freeze({
  markSize: { min: 8,  max: 200 },
  gap:      { min: 0,  max: 80  },
  fontSize: { min: 10, max: 96  },
});
const clampQuote = (v, lim) => Math.min(lim.max, Math.max(lim.min, Math.round(Number(v) || 0)));

const _QT_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|transparent)$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;
/* ⛔HTML 이스케이프 사본을 ★여기 두지 않는다 — 정본은 js/props/_helpers.js 의 escHtml 이고
   tests/unit/name-axes-to-markup X9 가 «사본이 늘었나»를 센다.
   ★이 파일은 글자를 ★textContent 로만 넣는다 ⇒ 이스케이프가 ★필요하지 않다. */

function _num(block, key, def) {
  const v = Number(block?.dataset?.[key]);
  return Number.isFinite(v) ? v : def;
}
function _bool(block, key, def) {
  const v = block?.dataset?.[key];
  return v === undefined || v === '' ? def : v === '1' || v === 'true';
}
function _col(block, key, def) {
  const v = block?.dataset?.[key];
  return (typeof v === 'string' && _QT_COLOR_RE.test(v.trim())) ? v.trim() : def;
}

/** 지금 고른 부호 한 벌. 모르는 key 는 기본으로 떨어진다(저장본이 손상돼도 안 죽는다). */
function quoteShapeOf(block) {
  const k = block?.dataset?.shape;
  return QUOTE_SHAPES.find(s => s.key === k) || QUOTE_SHAPES[0];
}

/* ══ ★줄 쪼개기 — ★한 자리 ════════════════════════════════════════════════════
   ★★빈 줄은 ★건너뛴다(지디가 못박은 단언). 안 그러면 부호만 둘 뜬 「/ /」가 생긴다.
   ⛔두 벌로 만들지 마라 — 렌더와 검사가 ★이 함수를 같이 쓴다.
   ★돌려주는 것 = 그려질 줄의 배열. ★그 길이가 ★곧 부호 쌍 수다. */
function quoteLines(block) {
  const raw = String(block?.dataset?.text ?? '');
  const src = raw.trim() === '' ? String(QUOTE_DEFAULTS.ph) : raw;
  return src
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(s => s.replace(/​/g, '').trim())
    .filter(s => s !== '');            /* ★빈 줄 건너뛰기 — 여기 한 자리 */
}

/** 글이 비어 안내문구를 그리는 중인가 — 패널이 흐리게 보여 줄지 묻는 문. */
function quoteIsPlaceholder(block) {
  return String(block?.dataset?.text ?? '').trim() === '';
}

/** 지금 값 한 벌 — ★dataset 에서만 읽는다(인라인 style 을 보지 않는다). */
function _qtState(block) {
  const D = QUOTE_DEFAULTS;
  return {
    shape: quoteShapeOf(block),
    layout: block?.dataset?.layout === 'stack' ? 'stack' : 'inline',
    markSize: clampQuote(_num(block, 'markSize', D.markSize), QUOTE_LIMITS.markSize),
    markColor: _col(block, 'markColor', D.markColor),
    gap: clampQuote(_num(block, 'gap', D.gap), QUOTE_LIMITS.gap),
    preOn: _bool(block, 'preOn', D.preOn),
    postOn: _bool(block, 'postOn', D.postOn),
    fontSize: clampQuote(_num(block, 'fontSize', D.fontSize), QUOTE_LIMITS.fontSize),
    textColor: _col(block, 'textColor', D.textColor),
    weight: _num(block, 'weight', D.weight),
    align: ['left', 'center', 'right'].includes(block?.dataset?.align) ? block.dataset.align : D.align,
  };
}

/* ══ 조각 만들기 ════════════════════════════════════════════════════════════
   ★`tb-qt-mark` / `tb-qt-line` — 둘 다 ★`tb-` 접두다(내보내기 보험 · 머리말 참조).
   ★부호 크기·색은 ★글과 ★따로 — st.markSize/markColor 만 본다. */
function _markEl(st, which) {
  const e = document.createElement('span');
  e.className = 'tb-qt-mark tb-qt-mark--' + which;
  e.dataset.qtMark = which;
  e.textContent = which === 'pre' ? st.shape.pre : st.shape.post;
  e.style.fontSize = st.markSize + 'px';
  e.style.color = st.markColor;
  e.style.lineHeight = '0.82';
  e.style.userSelect = 'none';
  e.style.whiteSpace = 'pre';
  e.style.flex = '0 0 auto';
  return e;
}

function _lineEl(block, st, text) {
  const e = document.createElement('div');
  e.className = 'tb-qt-line';
  if (quoteIsPlaceholder(block)) e.dataset.isPlaceholder = 'true';
  e.textContent = text;
  e.style.fontSize = st.fontSize + 'px';
  e.style.color = st.textColor;
  e.style.fontWeight = String(st.weight);
  e.style.lineHeight = '1.5';
  e.style.textAlign = st.align;
  e.style.minWidth = '0';
  return e;
}

/* ══ 렌더 ═══════════════════════════════════════════════════════════════════
   ★inline — ★현빈의 「3×1 그리드에 들어가 있는 ★느낌」을 ★블럭이 스스로 낸다.
     `grid-template-columns: auto minmax(0,1fr) auto` ⇒ 가운데만 글이 흐르고 양옆은 부호 폭만 먹는다.
     ★끈 쪽은 ★칸째 빠진다 — ⛔빈 칸으로 남기지 마라(시안 ⒟ 「끈 쪽은 칸째 빠져 글이 그만큼 넓어진다」).
   ★stack — 줄마다 부호가 따라붙는다. ★빈 줄은 quoteLines 가 이미 걸러 냈다. */
function renderQuoteBlock(block) {
  if (!block) return;
  const st = _qtState(block);
  const lines = quoteLines(block);

  block.innerHTML = '';
  if (st.layout === 'stack') {
    block.style.cssText = 'box-sizing:border-box;position:relative;display:flex;flex-direction:column;'
      + `align-items:${st.align === 'left' ? 'flex-start' : (st.align === 'right' ? 'flex-end' : 'center')};`
      + `row-gap:${Math.round(st.gap * 0.42)}px;`;
    for (const t of lines) {
      const row = document.createElement('div');
      row.className = 'tb-qt-row';
      row.style.cssText = `display:flex;align-items:center;column-gap:${st.gap}px;min-width:0;`;
      if (st.preOn) row.appendChild(_markEl(st, 'pre'));
      row.appendChild(_lineEl(block, st, t));
      if (st.postOn) row.appendChild(_markEl(st, 'post'));
      block.appendChild(row);
    }
    return;
  }

  /* inline — 여러 줄이면 가운데 칸 안에서 줄로 쌓는다(부호는 ★한 쌍이다). */
  const cols = [st.preOn ? 'auto' : null, 'minmax(0,1fr)', st.postOn ? 'auto' : null].filter(Boolean).join(' ');
  block.style.cssText = 'box-sizing:border-box;position:relative;display:grid;align-items:center;'
    + `grid-template-columns:${cols};column-gap:${st.gap}px;`;
  if (st.preOn) block.appendChild(_markEl(st, 'pre'));
  const body = document.createElement('div');
  body.className = 'tb-qt-body';
  body.style.cssText = 'min-width:0;display:flex;flex-direction:column;row-gap:2px;'
    + `align-items:${st.align === 'left' ? 'flex-start' : (st.align === 'right' ? 'flex-end' : 'center')};`;
  for (const t of lines) body.appendChild(_lineEl(block, st, t));
  block.appendChild(body);
  if (st.postOn) block.appendChild(_markEl(st, 'post'));
}

function makeQuoteBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'quote-block';
  block.id = genId('qt');
  block.dataset.type = 'quote';
  /* ★전부 박는다 — 안 박으면 나중에 기본값을 바꾸는 순간 ★이미 만든 블럭까지 같이 움직인다
     (coupon 머리말의 그 까닭). ★글(text)만 비워 둔다 → render 가 안내문구를 그린다. */
  block.dataset.shape = QUOTE_SHAPE_KEYS.includes(opts.shape) ? opts.shape : QUOTE_DEFAULTS.shape;
  block.dataset.layout = opts.layout === 'stack' ? 'stack' : QUOTE_DEFAULTS.layout;
  block.dataset.markSize = String(clampQuote(
    Number.isFinite(Number(opts.markSize)) ? Number(opts.markSize) : QUOTE_DEFAULTS.markSize, QUOTE_LIMITS.markSize));
  block.dataset.markColor = (typeof opts.markColor === 'string' && _QT_COLOR_RE.test(opts.markColor.trim()))
    ? opts.markColor.trim() : QUOTE_DEFAULTS.markColor;
  block.dataset.gap = String(clampQuote(
    Number.isFinite(Number(opts.gap)) ? Number(opts.gap) : QUOTE_DEFAULTS.gap, QUOTE_LIMITS.gap));
  block.dataset.preOn = (opts.preOn === false) ? '0' : '1';
  block.dataset.postOn = (opts.postOn === false) ? '0' : '1';
  block.dataset.fontSize = String(clampQuote(
    Number.isFinite(Number(opts.fontSize)) ? Number(opts.fontSize) : QUOTE_DEFAULTS.fontSize, QUOTE_LIMITS.fontSize));
  block.dataset.textColor = (typeof opts.textColor === 'string' && _QT_COLOR_RE.test(opts.textColor.trim()))
    ? opts.textColor.trim() : QUOTE_DEFAULTS.textColor;
  block.dataset.weight = String(Number.isFinite(Number(opts.weight)) ? Number(opts.weight) : QUOTE_DEFAULTS.weight);
  block.dataset.align = ['left', 'center', 'right'].includes(opts.align) ? opts.align : QUOTE_DEFAULTS.align;
  if (typeof opts.text === 'string') block.dataset.text = opts.text;

  renderQuoteBlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

/* ★새로 만든 블럭을 «캔버스 클릭 경로와 같게» 고른다 — coupon 의 _selectNewCoupon 과 같은 자리.
   ⛔「두 번 호출」은 멱등이다(showQuoteProperties 는 dataset 만 읽어 패널을 새로 그린다). */
function _selectNewQuote(block) {
  if (!block) return;
  try { window.selectBlock?.(block.id); } catch (_) {}
  try {
    window.showQuoteProperties?.(block);
    window.showHandlesFor?.(block);
  } catch (_) {}
}

function addQuoteBlock(opts = {}) {
  // FRAMEICON 패턴 — free-layout/fullWidth 프레임 안이면 _insertToFlowFrame 이 전부 처리한다.
  let made = null;
  if (window._insertToFlowFrame?.(() => (made = makeQuoteBlock(opts)))) {
    if (made) { renderQuoteBlock(made.block); _selectNewQuote(made.block); }
    window.triggerAutoSave?.();
    return made;
  }
  const sec = window.getSelectedSection?.();
  if (!sec) { showNoSelectionHint?.(); return null; }
  window.pushHistory?.();
  const { row, block } = made || makeQuoteBlock(opts);
  insertAfterSelected(sec, row);
  renderQuoteBlock(block);
  bindBlock(block);
  window.buildLayerPanel?.();
  _selectNewQuote(block);
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
  return { row, block };
}

/* 글 커밋 — DOM 이 아니라 ★dataset 에 쓴다(coupon commitCouponSlot 과 같은 규율).
   ⛔히스토리를 ★여기서 쌓지 않는다 — 부르는 쪽(패널)이 push-after 로 쌓는다.
   ⛔이름을 `updateQuoteBlock` 으로 바꾸지 마라 — 머리말의 그 까닭(⌘Z 가 두 번이 된다). */
function commitQuoteText(block, text) {
  if (!block) return false;
  const next = String(text ?? '');
  if ((block.dataset.text || '') === next) return false;
  block.dataset.text = next;
  return true;
}

window.makeQuoteBlock = makeQuoteBlock;
window.addQuoteBlock = addQuoteBlock;
window.renderQuoteBlock = renderQuoteBlock;
window.commitQuoteText = commitQuoteText;
window.quoteLines = quoteLines;
window.quoteShapeOf = quoteShapeOf;
window.quoteIsPlaceholder = quoteIsPlaceholder;
window.QUOTE_SHAPES = QUOTE_SHAPES;
window.QUOTE_SHAPE_KEYS = QUOTE_SHAPE_KEYS;
window.QUOTE_DEFAULTS = QUOTE_DEFAULTS;
window.QUOTE_LIMITS = QUOTE_LIMITS;
window.clampQuote = clampQuote;

export {
  makeQuoteBlock, addQuoteBlock, renderQuoteBlock, commitQuoteText,
  quoteLines, quoteShapeOf, quoteIsPlaceholder, _qtState,
  QUOTE_SHAPES, QUOTE_SHAPE_KEYS, QUOTE_DEFAULTS, QUOTE_LIMITS, clampQuote,
};

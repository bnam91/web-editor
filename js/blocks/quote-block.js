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
   MCP BLOCK_TYPES · ai-section-fill 슬롯.

   ══ ★★⚰️2026-10-10 — ★이 명부에서 ★★«빠진 것» ＋ ★★«들어온 것» ════════════════════
   ★★⚰️빠짐: 「★인라인 더블클릭 편집(글은 ★우측 패널로 넣는다)」 — ★★★현빈이 ★뒤집었다.
     ★누가·언제 = ★현빈 ★2026-10-10 ★티켓 ★`1010t2c1-①` ★원문 그대로:
       「qt_ts0he_hhbu8oo - 우측 프로퍼티에서 글내용 입력하게 되는데, ★텍스트를 ★캔버스에서
         ★수정 바로 할수 있게 해주고 …」
     ⇒ ★★⛔이 줄을 ★지우지 ★않는다 — ★★「★v1 에 없다」로 ★적혀 있던 자리라, ★안 적어 두면
       ★다음 사람이 ★★«결정대로» ★되돌린다(★그게 ★「안 하기로 한 것」이 ★살아남는 꼴이다).
     ★지금 ★어디 사나 = ★`js/block-drag.js` 의 ★`isQuote` dblclick ＋ ★`_quoteEndEdit`
       (★모달 `_modalEndEdit` 과 ★한 벌의 규율 · ★편집 host 는 ★`.tb-qt-body` ★하나).
     ★아직 ★없는 것(★이름으로) = ★부분 서식(선택한 글자만) ⇒ ★`sanitizeRichTextHtml` 커밋이 ★전제다.
   ★★들어옴: ★타이포그래피 절(글꼴·굵기·크기·B·I·S·줄간격·자간) — ★현빈 ★`1010t2c1-②`
     「우측에서는 ★타이포그래피 ★동적으로 ★다른 텍스트블럭처럼 수정되게해줘」.
     ★★«다른 텍스트블럭»의 ★참값 = ★`js/props/_typo-section.js` ★`buildTypographySectionHtml`.
     ★기준판 = ★★모달(`p='mdl-typo'`) — ★지디 판정 2026-10-10 ⇒ ⛔★«최종»이 아니라 ★«지금 집행선»이다
       (★현빈이 ★텍스트블럭 34칸을 뜻했다면 ★되돌릴 수 있게 ★지디가 ★노트에 적었다).
     ★안 켠 칸 ★3 = ★형광펜 H(★색 명부가 ★이미 둘 — 아래 QUOTE_DEFAULTS 의 그 주석) · ★밑줄 U · ★점.
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

/* ── ★사용자가 더한 부호 (현빈 2026-10-09 ⒝) ────────────────────────────────────────
 * ★★«무엇이 부호인가»의 명부는 ★여기 ★하나다 — ★제품 8종 ＋ ★사용자 것을 ★이 함수가 ★합친다.
 *   ⛔패널(prop-quote.js)이 ★제 목록을 ★또 만들지 않는다. ⛔`quoteShapeOf` 도 ★이것만 본다.
 * ★저장은 ★여기가 ★안 한다 — `DesignSystem`(정본 `meta.quoteShapes` · 캐시 localStorage)이 한다.
 *   ⇒ ★이 파일은 ★«무엇이 목록인가»를, ★그 파일은 ★«어디에 사나»를 가진다.
 * ★`label` 은 ★짓는다(`pre + ' ' + post`) — ⛔저장본에 ★또 적지 않는다(명부 둘 방지).
 *   ★제품 8종은 ★제 label 을 가진다(「“ ”」처럼 ★사람이 고른 표기라 ★유도식과 다를 수 있다).
 * ⚠️★DesignSystem 이 ★없는 판(단독 HTML·검사 하네스)에서도 ★죽지 않아야 한다 ⇒ ★`?.` 와 빈 배열.
 */
export function quoteUserShapes() {
  try {
    const list = (typeof window !== 'undefined' && window.DesignSystem?.getQuoteShapes?.()) || [];
    return Array.isArray(list) ? list : [];
  } catch (_) { return []; }
}
/** ★부호 ★한 명부 — 제품 8종이 ★앞, 사용자 것이 ★뒤. ⛔키가 겹치면 ★제품이 이긴다. */
export function quoteShapesAll() {
  const out = QUOTE_SHAPES.slice();
  const seen = new Set(QUOTE_SHAPE_KEYS);
  for (const u of quoteUserShapes()) {
    if (!u || typeof u.key !== 'string' || seen.has(u.key)) continue;
    seen.add(u.key);
    out.push(Object.freeze({ key: u.key, label: `${u.pre} ${u.post}`.trim(), pre: u.pre || '', post: u.post || '', user: true }));
  }
  return out;
}

const QUOTE_DEFAULTS = Object.freeze({
  text: '',
  ph: '빠르게 입는 하루',          /* 안내문구 — 비면 이것을 그린다(coupon placeholder 규약) */
  shape: 'curly',
  layout: 'inline',                /* 'inline'(부호·글·부호 한 줄) | 'stack'(줄마다) */
  /* ★부호 — 글자 크기와 ★따로 간다 */
  markSize: 46, markColor: '#C9CDD4',
  gap: 14,
  preOn: true, postOn: true,
  /* ★★부호 ★y (현빈 2026-10-09 ④⒝ 「★SVG 높이(y값) ★슬라이드로 우측에서 조절」)
     ⚠️★현빈이 「SVG」라 부른 것은 ★«부호 글리프»다 — ★이 블럭에 ★SVG 는 ★0건이다
       (머리말 「★v1 부호 = 글꼴 글리프 8종만」 · 실측: 블럭 안 svg 0 · img 0 · 부호 = SPAN).
       ⇒ ⛔「SVG 가 없으니 못 한다」로 ★닫지 않는다. ★밀 자리는 ★있다 = `translateY`.
     ★`markDy` 는 ★부호 ★만 민다(글은 ★안 움직인다) · ★inline·stack ★두 꼴 ★모두에서 먹는다
       (실측 2026-10-09 · 핀 a3556b936f8f: translateY ±20px ⇒ 부호가 ±17.4(inline)·±18.7(stack) 움직였다
        ★화면 px 가 ★20 이 아닌 까닭 = ★섹션 ★배율 — ⇒ ★판정은 ★그 요소 제 CSS 로 해야 한다). */
  markDy: 0,
  /* ★★세로 정렬 — ★★`inline` ★에서만 ★뜻이 있다(⛔stack 은 ★아니다).
     ★까닭은 ★실측이다(같은 날 · 같은 핀): stack 에서 `align-items` 를 start/center/end 로 ★몰아도
       ★부호 중심이 ★−76.6 으로 ★세 번 ★같았다 = ★★안 움직인다.
       ★stack 은 ★1열×3행이라 ★세로가 ★«차례»(앞부호/글/뒤부호)로 ★이미 정해져 ★밀 틈이 ★없다.
     ⇒ ★패널도 ★그대로 — stack 에서는 ★그 줄을 ★내지 않는다(prop-quote.js 가 그 판정을 들고 있다).
       ⛔「칸은 있는데 눌러도 ★조용히 아무 일 없음」을 ★만들지 않는다. */
  vAlign: 'middle',
  /* ★★⚠️`vAlign` 이라는 ★dataset 키는 ★이 레포에 ★이미 있다 — `modal-block.js:213,498` 이
       ★`'top'|'center'|'bottom'`(MODAL_VALIGNS)을 쓴다. ★나는 ★`'middle'` 을 쓴다.
     ★왜 ★안 맞췄나 — ⒈ dataset 은 ★요소마다라 ★섞이지 않는다(⛔generic 독자 ★0건: 실측으로
       `prop-multisel.js` 의 한 건은 ★`ovAlign` 이었고 `feature-flags.js` 둘은 ★주석이었다)
       ⒉ ★`top/middle/bottom` 은 ★`ALIGN_ICONS['object-v']` 의 ★키 그대로다 — ★단추를 고르는
         어휘와 ★모델의 어휘가 ★같아야 호출부에서 ★번역표가 안 생긴다
       ⒊ `center` 를 ★세로에도 쓰면 ★이 블럭 안에서 `align:'center'`(가로)와 ★같은 낱말이 ★두 축을 뜻한다
     ⇒ ★★그래도 ★«갈렸다»는 사실은 ★적어 둔다 — ★합칠 때는 ★두 블럭을 ★같이 옮기고
       ★«합친 것을 재는 검사»를 ★같이 세워라(⛔한쪽만 바꾸면 ★저장본이 조용히 기본값으로 떨어진다). */
  /* ★글 */
  fontSize: 21, textColor: '#1B1D22', weight: 400, align: 'center',
  /* ★★타이포 — 현빈 2026-10-10 `1010t2c1-②` 「우측에서는 ★타이포그래피 ★동적으로
       ★다른 텍스트블럭처럼 수정되게해줘」 ⇒ ★«다른 텍스트블럭»의 ★참값 명세 =
       `js/props/_typo-section.js` 의 ★`buildTypographySectionHtml`(소비자 13파일 ·
       `tests/unit/typo-section-ssot.test.mjs` 가 그 정본을 잠근다).
     ★기준판은 ★★모달(`p='mdl-typo'`)로 잡았다 — ★dataset 이 진실인 ★같은 꼴이라
       ★«실제로 켤 수 있는 범위»가 그쪽이다(실측: 텍스트블럭 Typography 조종칸 ★34 중
       ★23 은 ★부분 서식 전제 · 모달은 ★11 — 앱에서 ★전수로 셌다).
     ★`lineHeight` 는 ★무조건 박는다(모달 `:649` 와 ★같은 까닭) — 전엔 `_lineEl` 에 ★1.5 가
       ★리터럴이라 ★dataset 이 비어 있었다. ★그 값을 ★그대로 기본값으로 둬 ★화면을 안 바꾼다.
     ⚠️★★`weight` 는 ★이 블럭이 ★이미 쓰던 키다(모달은 `fontWeight`). ⛔새 키를 ★만들지 않았다 —
       ★굵기 명부가 ★둘이 되면 ★저장본이 ★조용히 ★한쪽만 산다. ★그 갈림을 ★여기 적어 둔다. */
  fontFamily: '', lineHeight: 1.5, letterSpacing: 0,
  bold: false, italic: false, strike: false,
  /* ⛔★형광펜(H)은 ★v1 에 ★없다 — ★「나중에」가 아니라 ★까닭으로 적는다:
       ★형광펜 ★색의 명부가 ★이 레포에 ★★이미 ★둘이다(`modal-block.js:326` ＋ `modal-frameify.js:42`)
       ★그리고 `tests/unit/modal-frameify-gates.test.mjs` ★G1 이 ★그 둘만 대조한다
       ⇒ ★내가 ★세 번째 사본을 만들면 ★그 게이트 ★밖에서 ★조용히 갈라진다.
       ★그리고 ★이 블럭은 ★내보내기 보험 때문에 ★색을 ★인라인 리터럴로 줘야 해 ★`var()` 로도 못 피한다.
     ⇒ ★합치는 일은 ★모달 파일을 ★건드리는 일이라 ★이 레인 밖이다 ⇒ ★지디 판정 대기. */
});

/* ★바닥·천장 — 패널과 손잡이가 ★같은 표를 본다(coupon 의 COUPON_LIMITS 규약).
   ⛔패널이 자기 리터럴을 갖는 순간 둘이 갈라진다. */
const QUOTE_LIMITS = Object.freeze({
  markSize: { min: 8,  max: 200 },
  gap:      { min: 0,  max: 80  },
  fontSize: { min: 10, max: 96  },
  /* ★±60 — ★부호 크기 천장(200)보다 ★작게 잡았다. ⚠️⛔이 수는 ★«줄 폭»을 잰 수가 ★아니다
     (`markSize` 의 8~200 과 달리 ★UI 에서 ★안 쟀다) — ★밀어낼 수 있는 ★범위의 ★울타리일 뿐이다.
     ★그 까닭을 ★여기 적어 둔다: 다음 사람이 ★「실측값」으로 ★읽지 않게. */
  markDy:   { min: -60, max: 60 },
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
/* ★글꼴 이름 — ★모달 `_MDL_FONT_RE`(modal-block.js:283)와 ★같은 꼴을 쓴다.
   ⚠️★사본이다 — ★그 파일은 ★제 상수를 ★안 내보낸다(export 0). ★합치려면 ★모달 파일을 건드려야 하고
     ★그건 ★이 레인 밖이다 ⇒ ★갈림을 ★여기 적어 둔다(형광펜 색과 ★같은 자리의 ★같은 병). */
const _QT_FONT_RE = /^[\w\s,'"\-().가-힣]+$/;
function _font(block, def) {
  const v = String(block?.dataset?.fontFamily ?? '').trim();
  return (v && _QT_FONT_RE.test(v)) ? v : def;
}
function _lh(block, def) {
  const v = parseFloat(block?.dataset?.lineHeight);
  return Number.isFinite(v) ? Math.min(3, Math.max(1, v)) : def;
}
function _ls(block, def) {
  const v = parseFloat(block?.dataset?.letterSpacing);
  return Number.isFinite(v) ? Math.min(40, Math.max(-10, v)) : def;
}

/** 지금 고른 부호 한 벌. 모르는 key 는 기본으로 떨어진다(저장본이 손상돼도 안 죽는다). */
function quoteShapeOf(block) {
  const k = block?.dataset?.shape;
  /* ★명부는 ★quoteShapesAll ★하나다(제품 8종 ＋ 사용자 것).
     ⚠️★못 찾으면 ★기본값으로 ★조용히 떨어진다 — ★사용자 부호를 쓴 블럭을 ★그 부호가 ★없는 판
       (다른 프로젝트 · meta 유실)에서 열면 ★모양이 ★바뀐다. ★그 자리를 ★검사가 ★이름으로 잡는다. */
  return quoteShapesAll().find(s => s.key === k) || QUOTE_SHAPES[0];
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
    markDy: clampQuote(_num(block, 'markDy', D.markDy), QUOTE_LIMITS.markDy),
    vAlign: ['top', 'middle', 'bottom'].includes(block?.dataset?.vAlign) ? block.dataset.vAlign : D.vAlign,
    /* ★타이포(c1-②) — ⛔여기서 ★리터럴을 다시 적지 않는다(QUOTE_DEFAULTS ★한 표에서 온다) */
    fontFamily: _font(block, D.fontFamily),
    lineHeight: _lh(block, D.lineHeight),
    letterSpacing: _ls(block, D.letterSpacing),
    bold: _bool(block, 'bold', D.bold),
    italic: _bool(block, 'italic', D.italic),
    strike: _bool(block, 'strike', D.strike),
  };
}

/* ★★타이포 선언은 ★«이 함수 하나»에서만 나온다 — ★모달 `_typoStyles`(modal-block.js:297)와 ★같은 규율.
   ⛔`_lineEl` 안에 ★여러 줄로 흩지 마라(같은 자리를 ★정렬·크기가 ★동시에 만진다).
   ★「아무것도 안 정한 블럭」은 ★★예전과 ★같은 화면을 내야 한다 ⇒
     ★`line-height` 는 ★항상(기본 1.5 = ★옛 리터럴) · ★나머지는 ★정했을 때만 ★선언을 낸다. */
function _qtTypoCss(st) {
  return (st.fontFamily ? `font-family:${st.fontFamily};` : '')
       + `font-weight:${_effQtWeight(st)};`
       + `line-height:${st.lineHeight};`
       + (st.letterSpacing !== 0 ? `letter-spacing:${st.letterSpacing}px;` : '')
       + (st.italic ? 'font-style:italic;' : '')
       + (st.strike ? 'text-decoration:line-through;' : '');
}

/** ★유효 굵기 — ★B 단추가 켜져 있으면 ★그게 이긴다(모달 `_effWeight` 와 ★같은 관례). */
function _effQtWeight(st) {
  return st.bold ? '700' : String(st.weight);
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
  /* ★★부호 ★y — ⛔`position`·`top` 으로 밀지 마라(격자 칸에서 ★빠져 ★폭 계산이 틀어진다).
     ★`transform` 은 ★레이아웃을 ★안 건드리고 ★그림만 민다 ⇒ ★글은 ★제자리다(Q15 음성대조가 그걸 잰다).
     ★0 일 때도 ★적는다 — ★`none` 과 `matrix(…,0)` 이 갈리면 ★재는 쪽이 ★두 갈래를 봐야 한다. */
  e.style.transform = `translateY(${st.markDy}px)`;
  return e;
}

function _lineEl(block, st, text) {
  const e = document.createElement('div');
  e.className = 'tb-qt-line';
  if (quoteIsPlaceholder(block)) e.dataset.isPlaceholder = 'true';
  e.textContent = text;
  e.style.fontSize = st.fontSize + 'px';
  e.style.color = st.textColor;
  e.style.textAlign = st.align;
  e.style.minWidth = '0';
  /* ★★타이포 — ★`_qtTypoCss` ★한 자리에서 온다(굵기·줄간격·자간·기울임·취소선).
     ⛔`fontWeight`·`lineHeight` 를 ★여기 ★다시 적지 마라 — ★그 둘이 ★거기로 ★옮겨갔다. */
  e.style.cssText += _qtTypoCss(st);
  return e;
}

/* ★가로 자리 ★한 벌 — ⛔`flex-start`/`start` 두 어휘를 ★두 자리에 적지 않는다.
   ★`start`·`end` 는 flex 와 grid 가 ★둘 다 읽는다(CSS Box Alignment). */
const _qtSide = (align) => (align === 'left' ? 'start' : (align === 'right' ? 'end' : 'center'));

/* ★세로 자리 ★한 벌 — ★`_qtSide` 와 ★같은 꼴. ★`start`·`end` 는 flex·grid 가 ★둘 다 읽는다.
   ⛔`inline` ★에서만 부른다(위 QUOTE_DEFAULTS.vAlign 의 그 실측). */
const _qtVSide = (v) => (v === 'top' ? 'start' : (v === 'bottom' ? 'end' : 'center'));

/* 글 덩이 — ★inline 의 가운데 칸이자 ★stack 의 가운데 ★행이다(★한 벌). */
function _bodyEl(block, st, lines) {
  const body = document.createElement('div');
  body.className = 'tb-qt-body';
  body.style.cssText = 'min-width:0;display:flex;flex-direction:column;row-gap:2px;'
    + `align-items:${_qtSide(st.align)};`;
  for (const t of lines) body.appendChild(_lineEl(block, st, t));
  return body;
}

/* ══ 렌더 ═══════════════════════════════════════════════════════════════════
   ★inline — ★현빈의 「3×1 그리드에 들어가 있는 ★느낌」을 ★블럭이 스스로 낸다.
     `grid-template-columns: auto minmax(0,1fr) auto` ⇒ 가운데만 글이 흐르고 양옆은 부호 폭만 먹는다.
     ★끈 쪽은 ★칸째 빠진다 — ⛔빈 칸으로 남기지 마라(시안 ⒟ 「끈 쪽은 칸째 빠져 글이 그만큼 넓어진다」).

   ★★stack — ★★«축을 돌린다». ★inline 이 ★3열×1행이면 stack 은 ★★1열×3행이다:
     `grid-template-rows: auto minmax(0,auto) auto` ⇒ [앞부호] / [글] / [뒤부호] · ★부호는 ★한 쌍.
     ★끈 쪽이 ★행째 빠지는 것도 ★inline 과 ★같다(같은 `filter(Boolean)` 꼴).

   ★★⚰️2026-10-09 — ★옛 stack 은 ★★«줄마다 부호가 따라붙는» 꼴이었다(flex column · 줄마다 `.tb-qt-row`).
     ★그 꼴에서 나온 불변식이 ★「★그려진 줄 수 == ★부호 쌍 수」였고 ★Q4 가 그것을 잠갔다.
     ★★현빈이 ★2026-10-09 에 ★「★지금 ★스택모드 ★이해가 ★틀렸다. ★3×1 이 스택모드서 ★1×3 으로
       바뀌어야 한다(★현재 안 그럼)」고 말했다 ⇒ ★★그 꼴 ★자체가 틀린 것이었다.
     ⇒ ★★그 불변식은 ★«뒤집힌» 것이 아니라 ★★«까닭이 죽었다». ★문장을 ★지우지 않고 ★여기 남긴다 —
       ★다음 사람이 「왜 줄마다 부호가 없나」를 물을 때 ★이 줄이 답이다.
     ★실측(2026-10-09 · 좌표로): 옛 판에서 ★한 줄 글은 inline 도 stack 도 ★둘 다 ★3열×1행이었다
       (cx 329/717/1105 → 675/717/759 — ★간격만 좁아지고 ★축이 ★안 돌았다). ⇒ 현빈 말 그대로다. */
function renderQuoteBlock(block) {
  if (!block) return;
  const st = _qtState(block);
  const lines = quoteLines(block);

  block.innerHTML = '';
  if (st.layout === 'stack') {
    const rows = [st.preOn ? 'auto' : null, 'minmax(0,auto)', st.postOn ? 'auto' : null].filter(Boolean).join(' ');
    block.style.cssText = 'box-sizing:border-box;position:relative;display:grid;'
      + `justify-items:${_qtSide(st.align)};grid-template-rows:${rows};row-gap:${st.gap}px;`;
    if (st.preOn) block.appendChild(_markEl(st, 'pre'));
    block.appendChild(_bodyEl(block, st, lines));
    if (st.postOn) block.appendChild(_markEl(st, 'post'));
    return;
  }

  /* inline — 여러 줄이면 가운데 칸 안에서 줄로 쌓는다(부호는 ★한 쌍이다).
     ★★2026-10-10 현빈 1010t2c2 — 「★슬라이드를 움직여도 ★실제론 ★간격조절이 ★안 된다」 ⇒ ★여기를 갈았다.
     ★무엇이었나: 가운데 칸이 ★`minmax(0,1fr)` 이라 ★블럭이 ★섹션 폭 ★전부를 먹고
       ★부호가 ★양 끝에 ★박혔다. 그러면 `column-gap` 은 ★가운데 칸만 좁히고 ★글은 ★그 칸의
       가운데에 그대로 서서 — ★★사람 눈의 거리에서 ★gap 이 ★★약분된다:
         거리 = gap + (블럭폭 − 2·부호폭 − 2·gap − 글폭)/2 = (블럭폭 − 2·부호폭 − 글폭)/2
     ★실측(핀 ★f69c307e · tests/dom/quote-block.dom.spec.js ★Q16 이 ★그 판에서 ★빨강 ×3):
       ★gap 0 → 40 에서 ★앞부호↔글 거리 ★391.6 → ★391.6 CSS px = ★★«0.0px 움직였다».
       ★대조(같은 판 · 조건만 바꿈): ★align=left ✅먹는다 · ★stack ✅먹는다 · ★align=center(★기본값) ⛔안 먹는다.
     ★무엇으로 갈았나 ⑴ 가운데 칸 ★`minmax(0,auto)` — ★stack 의 가운데 ★행과 ★같은 사이징이다
       (⇒ 글폭만 먹고, ★길면 ★available 까지만 자라 ★줄바꿈한다. ⛔`max-content` 는 ★넘친다)
                      ⑵ ★`justify-content` 를 ★`_qtSide(align)` 으로 ★박는다 — ★★이 줄이 ★없으면
       ★grid 의 기본 `normal`(=stretch)이 ★`auto` ★최대 트랙을 ★다시 ★늘려 ★★옛 항등식이 ★되살아난다.
     ★★이 변경이 ★두 단언의 ★까닭을 ★죽였다(⛔몰래 바꾸지 않았다 — 그 자리에 ⚰️로 적어 뒀다):
       ⚰️Q3 「끈 쪽은 칸째 빠져 ★글 칸이 그만큼 ★넓어진다」(시안 ⒟) — ★글 칸은 이제 ★글폭이다
       ⚰️Q10 inline 음성대조 「★앞부호는 ★안 움직인다」 — ★이제 ★셋이 ★같이 움직인다(그래야 gap 이 뜻을 가진다) */
  const cols = [st.preOn ? 'auto' : null, 'minmax(0,auto)', st.postOn ? 'auto' : null].filter(Boolean).join(' ');
  block.style.cssText = 'box-sizing:border-box;position:relative;display:grid;'
    + `align-items:${_qtVSide(st.vAlign)};justify-content:${_qtSide(st.align)};`
    + `grid-template-columns:${cols};column-gap:${st.gap}px;`;
  if (st.preOn) block.appendChild(_markEl(st, 'pre'));
  block.appendChild(_bodyEl(block, st, lines));
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
  block.dataset.markDy = String(clampQuote(
    Number.isFinite(Number(opts.markDy)) ? Number(opts.markDy) : QUOTE_DEFAULTS.markDy, QUOTE_LIMITS.markDy));
  block.dataset.vAlign = ['top', 'middle', 'bottom'].includes(opts.vAlign) ? opts.vAlign : QUOTE_DEFAULTS.vAlign;
  /* ★★타이포(c1-②) — ★`lineHeight` 는 ★무조건 박는다(모달 `:649` 와 ★같은 까닭: 렌더에 리터럴로
     살면 ★dataset 이 비고, ★나중에 기본값을 바꿀 때 ★이미 만든 블럭이 ★같이 움직인다).
     ★나머지는 ★«정했을 때만» 박는다 — ⛔빈 값을 박으면 ★`fontFamily:;` 같은 ★죽은 선언이 ★저장본에 쌓인다. */
  block.dataset.lineHeight = String(Number.isFinite(Number(opts.lineHeight)) ? Number(opts.lineHeight) : QUOTE_DEFAULTS.lineHeight);
  if (typeof opts.fontFamily === 'string' && opts.fontFamily.trim()) block.dataset.fontFamily = opts.fontFamily.trim();
  if (Number.isFinite(Number(opts.letterSpacing))) block.dataset.letterSpacing = String(Number(opts.letterSpacing));
  for (const k of ['bold', 'italic', 'strike']) if (opts[k]) block.dataset[k] = '1';
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
window.quoteShapesAll = quoteShapesAll;   // ★부호 ★한 명부(제품 8종 ＋ 사용자 것) — 검사·패널이 같이 본다
window.quoteUserShapes = quoteUserShapes;
window.QUOTE_SHAPE_KEYS = QUOTE_SHAPE_KEYS;
window.QUOTE_DEFAULTS = QUOTE_DEFAULTS;
window.QUOTE_LIMITS = QUOTE_LIMITS;
window.clampQuote = clampQuote;

export {
  makeQuoteBlock, addQuoteBlock, renderQuoteBlock, commitQuoteText,
  quoteLines, quoteShapeOf, quoteIsPlaceholder, _qtState,
  /* ★quoteShapesAll·quoteUserShapes 는 ★선언 자리에서 `export function` 으로 나간다 — ⛔여기 또 적으면 중복 export 다 */
  QUOTE_SHAPES, QUOTE_SHAPE_KEYS, QUOTE_DEFAULTS, QUOTE_LIMITS, clampQuote,
};

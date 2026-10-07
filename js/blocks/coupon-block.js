/* ═══════════════════════════════════════════════════════════════════════════
   COUPON BLOCK — 쿠폰 블럭 (현빈 발주 2026-10-07 · ★1단계)

   ══ 현빈 말 그대로 ════════════════════════════════════════════════════════
     「쿠폰이 좁은 자리에 들어갈 때 … ★스티커블럭이나 모달블럭처럼 다뤄주면돼.
       텍스트 스티커 블럭을 보니 ★비율이 줄어들거든? ★그렇게 해주면 될 것 같은데
       그리고 ★중앙패널에 ★컴포넌트 패널 쪽에 넣으면 될 것 같아.」

   ══ 정본은 «시안»이다 ═════════════════════════════════════════════════════
   ★ 시안 = https://claude.ai/artifact/H2KuSF675jjRkPHnCoreeD (6판)
   ★ 파일 = ~/.claude/skills/지디/dashboard/artifacts/goditor-coupon-block.html
   ★ 배경 SVG 생성기는 ★이 파일에 없다 — js/blocks/coupon-geometry.js 에 ★줄째 떠 왔다.
     (그 파일 머리말에 «무엇을 몇 줄 떠 왔고 바이트가 같은지»를 적어 뒀다.)
   ★ 아래 COUPON_DEFAULTS · COUPON_SLOTS 의 수·색도 ★시안 baseState()(:1130~1152)에서 왔다.
     ⛔내가 고른 수가 ★하나도 없다. 바꿀 일이 생기면 ★시안을 먼저 고쳐라.

   ══ 모델 = dataset 이 진실 ════════════════════════════════════════════════
   modal-block.js 머리말과 ★같은 규약이다. 인라인 스타일만 쓰면 저장→로드 왕복에서 값이
   증발한다. 글자 다섯도 dataset 에 산다(재렌더가 타이핑을 지우지 않게).
   ★글자 칸의 클래스가 `tb-cpn-line` 인 이유 = «내보내기 보험».
     export-figma-json 의 generic 폴백이 [class^="tb-"] 만 텍스트로 수집한다
     (modal 의 tb-mdl-* 과 같은 까닭). 전용 분기가 없어도 ★글자는 살아남는다.
     ⚠️그래도 ★배경 SVG 는 폴백에 ★안 걸린다 — ★알려진 결함으로 ★검사에 박아 뒀다
       (tests/dom/coupon-block.dom.spec.js 의 test.fail · 2단계에서 고친다 · 지디 Q1 판정).
       선례: js/blocks/zoom-block.js:26 「피그마로 업로드하면 확대블럭이 ★조용히 빠진다」.

   ══ ⌘Z 한 걸음 ═══════════════════════════════════════════════════════════
   ★`addCouponBlock` 은 /^add[A-Z][A-Za-z0-9]*Block$/ 에 걸려 js/insert-history.js 가
     ★자동으로 감싼다(그 파일 :91) ⇒ 「S0(삽입 전) ＋ S1(블럭 있고 값 옛날)」 두 표본이
     ★저절로 선다. ⛔EXTRA·DENY 에 손댈 것이 없다.
   ★⛔`updateCouponBlock` 이라는 이름을 ★만들지 않는다 — 그 이름은 js/model-update-history.js
     의 MATCH(/^update[A-Z][A-Za-z0-9]*Block$/)에 ★자동으로 걸려 ★끝 표본을 ★하나 더 쌓는다.
     그러면 한 제스처가 두 문으로 나가 ⌘Z 가 ★두 번이 된다. 패널 커밋은 modal 선례대로
     `commitCouponSlot` ＋ 패널 쪽 push-after 로 간다.
     (지디가 가리킨 grid-block.js:3440 `updateGridBlockRaw` 는 ★이미 생긴 자리를 ★푸는 약이고,
      이 파일은 ★그 자리가 ★안 생기게 하는 쪽을 골랐다 — 지디 승인 2026-10-07.)
   ⛔삽입 뒤 rAF·setTimeout 으로 캔버스를 ★더 바꾸지 않는다(insert-history 규약 ④ —
     addStickerBlock 이 밟은 그 자리).

   ══ ★좁아지면 — «비율 축소» (현빈이 말한 그것) ══════════════════════════════
   ★현빈이 본 「텍스트 스티커 블럭을 보니 비율이 줄어들거든」의 ★실제 자리는
     ★js/sticker-select.js:255~323 이다(지디 발주서의 overlay-handles 둘이 아니다 — 실측 정정):
         const ratio = initW>0 ? newW/initW : 1;
         block.dataset.fontSize = String(Math.max(6, Math.min(150, Math.round(initFs*ratio))));
     ⇒ ⑴ ★dataset(모델) ⑵ ★마우스다운 스냅샷 ⑶ ★clamp 6~150 ⑷ ★폭 비율만(높이 아님).
   ★이 파일은 ★그 식을 그대로 쓴다 — `_cpnScale` ＋ `_cpnEffFontSize`. ★새 설계 0.
   ⛔transform:scale 이 아니다 — 그걸로 하면 내보낼 때 글자가 뭉갠다.
     배경은 SVG 라 어떤 크기에도 깨끗하고, 글자는 ★곱으로 비율을 지킨다.
   ⛔저장본(dataset.slot*Size)은 ★안 고친다 — ★읽는 자리에서만 자른다.
     선례 = js/blocks/zoom-geometry.js:392 「저장본은 안 고친다 … 읽는 자리에서만」.
     그래서 ★넓히면 원래 크기가 ★되살아난다.
   ★그물은 ★다섯 칸 ★전부다 — overlay-handles.js:3017 `_tfoFontSnapshot` 의 규율을 따른다.
     ⚠️overlay-handles.js:389(그룹 경로)는 contentEl «하나»만 키워 부분 span 을 놓치는데,
       ★:2906 주석이 「★여기선 그 미비를 ★답습하지 않는다」고 적어 뒀다. ★쿠폰도 안 답습한다.
       ⇒ 다섯 중 ★하나라도 `_cpnEffFontSize` 를 안 지나면 V6 변이 검사가 빨강이 된다.

   ══ 1단계에 ★없는 것 (⛔「나중에」가 아니라 ★이름으로) ═══════════════════════
   로고 SVG 칸 · 프리셋 6종 · 비율 고르기(7:4·3:2·자유) · 좁아짐 ★세 꼴 고르기(clip/wrap/
   shrink) · 배지 · 장식 · 자유배치(layout:'free') · 그림자·그라데이션 ★패널 노출 ·
   피그마 내보내기 전용 분기 · MCP BLOCK_TYPES · ai-section-fill 슬롯 · ★슬롯 인라인
   더블클릭 편집(글자는 우측 패널로 넣는다).
   ★생성기는 그림자·그라데이션·배지를 ★이미 품고 있다(시안 그대로 떠 왔다) — ★패널만 안 낸다.
     ⇒ 2단계는 ★패널 줄만 더하면 된다. ⛔생성기를 다시 쓰지 마라.
═══════════════════════════════════════════════════════════════════════════ */

import { insertAfterSelected, genId, showNoSelectionHint } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';
import { paint } from './coupon-geometry.js';

/* ★글자 다섯 — 이름·안내문구·기본 꼴. ★시안 baseState().t (:1147~1151) 에서 왔다.
   ⛔순서를 바꾸지 마라 — 패널 줄 순서이고, 시안의 SLOTS(:1128) 순서다.
   ⚠️bot·stub 의 on=false 도 ★시안 그대로다(시안 slot(…,on) 의 일곱째 인자). */
const COUPON_SLOTS = Object.freeze([
  Object.freeze({ key: 'top',  label: '윗줄',           ph: 'GODITOR 회원 전용', size: 14, weight: 600, color: '#FFEBDC', on: true  }),
  Object.freeze({ key: 'num',  label: '큰 숫자',         ph: '12',                size: 46, weight: 800, color: '#FFFFFF', on: true  }),
  Object.freeze({ key: 'unit', label: '단위',           ph: '만원',              size: 24, weight: 700, color: '#FFFFFF', on: true  }),
  Object.freeze({ key: 'bot',  label: '아랫줄',          ph: '쿠폰 설명',          size: 13, weight: 500, color: '#FFFFFF', on: false }),
  Object.freeze({ key: 'stub', label: '스텁/머리 글자',   ph: 'GODITOR',           size: 16, weight: 700, color: '#FFFFFF', on: false }),
]);
const COUPON_SLOT_KEYS = Object.freeze(COUPON_SLOTS.map(s => s.key));

/* ★dataset 키는 ★명부에서 «파생»시킨다 — ⛔손으로 스물다섯 개를 적지 않는다.
   적는 순간 명부가 둘이 되고, 한쪽만 고쳐진다(이 레포의 고질). */
const _dsKey = (slotKey, field) => 'slot' + slotKey.charAt(0).toUpperCase() + slotKey.slice(1) + field;

/* ★글자 크기의 ★바닥·천장 — sticker-select.js:320~323 과 ★같은 수다.
   ⛔여기에 다른 수를 적지 마라. 거기와 갈리면 「스티커처럼」이 거짓이 된다. */
const CPN_FS_MIN = 6;
const CPN_FS_MAX = 150;

const COUPON_DEFAULTS = {
  /* 그림 — ★시안 baseState() :1133 (cw:460, ch:259, radius:14, ratio:1.7778) */
  cw: 460, ch: 259, radius: 14, ratio: 1.7778,
  /* ★화면에 그려지는 폭. ch 는 ★여기서 «내지» 않는다 — cw/ch 비율로 따라온다(_cpnBoxH). */
  width: 460,
  /* ★캔버스 바탕은 ★투명 — 앱에서는 블럭이 곧 쿠폰이다(coupon-geometry.js 머리말).
     ⛔생성기에서 <rect> 를 빼는 쪽으로 고치지 마라. 시안과 두 벌이 된다. */
  canvasCol: 'transparent',
  bodyCol: '#F2792B', stubCol: '#15151A', strokeCol: '#D8D8D4', strokeW: 0,
  /* 배경 갈래 — 'coupon'(홈·절취선·분할을 쓴다) · 'plain' · 'grad'. 1단계 패널은 안 낸다. */
  bgKind: 'coupon',
  /* 홈·절취선·분할 — ★시안 기본 그대로 «전부 꺼짐»이다.
     ⚠️그래서 ★스텁 칸은 ★«자리가 없다»(paintCoupon 이 stubRect:null 을 준다).
       시안도 화면에 그 말을 찍는다: 「분할을 켜거나 절취선을 켜십시오」.
       ⇒ 패널이 그 줄을 ★회색으로 적는다(지디 Q2 판정 ㈁ — 시안에 충실한 쪽). */
  nTop: false, nRight: false, nBottom: false, nLeft: false, nR: 16, nPos: 50,
  perfOn: false, perfDir: 'v', perfPos: 80, perfDash: 4, perfGap: 5, perfW: 2, perfCol: '#8A6D00', perfEnd: true,
  split: 'none', stubPct: 22, gap: 6,
  /* 그림자 — 1단계는 'none'. ⚠️2단계에서 패널에 내면 viewBox 를 넓혀야 한다. */
  shadow: 'none', shDx: 10, shDy: 10, shBlur: 8, shCol: '#C2410C', shOpa: 100,
  /* 글자 배치 — ★시안 :1143 */
  align: 'left', valign: 'center', order: 't-n-b', inlineUnit: true, pad: 24, gapY: 4, stubVert: false,
};

/* ★폭의 바닥·천장 — 패널과 손잡이가 ★같은 표를 본다(modal 의 MODAL_LIMITS 규약).
   ⛔손잡이가 자기 리터럴을 갖는 순간 둘이 갈라진다. */
const COUPON_LIMITS = {
  width:  { min: 80, max: 860 },
  radius: { min: 0,  max: 60  },
};
const clampCoupon = (v, lim) => Math.min(lim.max, Math.max(lim.min, Math.round(Number(v) || 0)));

const _CPN_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|transparent)$|^(rgb|rgba|hsl|hsla)\(\s*[\d.,\s%/]+\)$/;
/* ⛔HTML 이스케이프 사본을 ★여기 두지 않는다 — 정본은 js/props/_helpers.js 의 escHtml 이고
   tests/unit/name-axes-to-markup X9 가 «사본이 늘었나»를 센다(실측으로 물렸다 · 2026-10-07).
   ★이 파일은 글자를 ★textContent 로만 넣는다(_lineEl) ⇒ 이스케이프가 ★필요하지 않다. */

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
  return (typeof v === 'string' && _CPN_COLOR_RE.test(v.trim())) ? v.trim() : def;
}

/* ══ ★비율 — «식이 ★한 자리»다 ═══════════════════════════════════════════════
   ⛔두 벌로 만들지 마라: 글자 크기도, 글자 자리(사각형)도 ★이 함수가 낸 k 를 쓴다.
   ★분모를 ★블럭 자신의 cw 에서 읽는 이유 — COUPON_DEFAULTS.cw 를 쓰면 2단계에서
     「비율 고르기」가 cw 를 바꾸는 순간 ★조용히 틀린다. 1단계에서는 둘이 ★같다
     (makeCouponBlock 이 cw 를 늘 460 으로 박는다 — tests/unit 이 그 전제를 단언한다). */
function _cpnScale(block, boxW) {
  const cw = _num(block, 'cw', COUPON_DEFAULTS.cw);
  return (boxW > 0 && cw > 0) ? boxW / cw : 1;
}

/** 그려지는 높이 — 폭에서 ★낸다(16:9 를 블럭이 스스로 지킨다). */
function _cpnBoxH(block, boxW) {
  const ch = _num(block, 'ch', COUPON_DEFAULTS.ch);
  return Math.max(1, Math.round(ch * _cpnScale(block, boxW)));
}

/* ★★좁아지면 줄어드는 ★그 자리. (지디 Q3 판정 — 1단계에서 ★켠다)
   식·clamp 가 ★sticker-select.js:320~323 과 ★같다. ⛔다른 수를 적지 마라.
   ★다섯 칸이 ★전부 이 문을 지난다(V6 변이가 그것을 잰다). */
function _cpnEffFontSize(block, slotKey, boxW) {
  const def = COUPON_SLOTS.find(s => s.key === slotKey);
  const base = _num(block, _dsKey(slotKey, 'Size'), def ? def.size : 14);
  const k = _cpnScale(block, boxW);
  return Math.max(CPN_FS_MIN, Math.min(CPN_FS_MAX, Math.round(base * k)));
}

/** 한 칸의 «지금 값» — 글자·굵기·색·켜짐. 크기는 ★위 함수가 따로 낸다(비율이 걸리므로). */
function _slotOf(block, slotKey) {
  const def = COUPON_SLOTS.find(s => s.key === slotKey) || COUPON_SLOTS[0];
  const txt = block?.dataset?.[_dsKey(slotKey, 'Text')];
  const empty = String(txt ?? '').trim() === '';
  return {
    key: slotKey,
    on: _bool(block, _dsKey(slotKey, 'On'), def.on),
    txt: empty ? def.ph : String(txt),
    isPh: empty,
    weight: _num(block, _dsKey(slotKey, 'Weight'), def.weight),
    color: _col(block, _dsKey(slotKey, 'Color'), def.color),
  };
}

/** 생성기에 건네는 설정 하나 — ★dataset 에서만 읽는다(인라인 style 을 보지 않는다). */
function _cpnState(block) {
  const D = COUPON_DEFAULTS;
  return {
    cw: _num(block, 'cw', D.cw), ch: _num(block, 'ch', D.ch),
    radius: clampCoupon(_num(block, 'radius', D.radius), COUPON_LIMITS.radius),
    bgKind: ['coupon', 'plain', 'grad'].includes(block?.dataset?.bgKind) ? block.dataset.bgKind : D.bgKind,
    canvasCol: _col(block, 'canvasCol', D.canvasCol),
    bodyCol: _col(block, 'bodyCol', D.bodyCol),
    stubCol: _col(block, 'stubCol', D.stubCol),
    strokeCol: _col(block, 'strokeCol', D.strokeCol),
    strokeW: _num(block, 'strokeW', D.strokeW),
    nSides: {
      top: _bool(block, 'nTop', D.nTop), right: _bool(block, 'nRight', D.nRight),
      bottom: _bool(block, 'nBottom', D.nBottom), left: _bool(block, 'nLeft', D.nLeft),
    },
    nR: _num(block, 'nR', D.nR), nPos: _num(block, 'nPos', D.nPos),
    perfOn: _bool(block, 'perfOn', D.perfOn),
    perfDir: block?.dataset?.perfDir === 'h' ? 'h' : D.perfDir,
    perfPos: _num(block, 'perfPos', D.perfPos), perfDash: _num(block, 'perfDash', D.perfDash),
    perfGap: _num(block, 'perfGap', D.perfGap), perfW: _num(block, 'perfW', D.perfW),
    perfCol: _col(block, 'perfCol', D.perfCol), perfEnd: _bool(block, 'perfEnd', D.perfEnd),
    split: ['none', 'lr', 'tb', 'two'].includes(block?.dataset?.split) ? block.dataset.split : D.split,
    stubPct: _num(block, 'stubPct', D.stubPct), gap: _num(block, 'gap', D.gap),
    shadow: ['none', 'layer', 'drop'].includes(block?.dataset?.shadow) ? block.dataset.shadow : D.shadow,
    shDx: _num(block, 'shDx', D.shDx), shDy: _num(block, 'shDy', D.shDy),
    shBlur: _num(block, 'shBlur', D.shBlur), shCol: _col(block, 'shCol', D.shCol),
    shOpa: _num(block, 'shOpa', D.shOpa),
    /* 배지·장식은 1단계 패널에 없다 — 생성기가 요구하는 칸만 꺼 둔다. */
    badgeOn: false, decoOn: false,
    align: ['left', 'center', 'right'].includes(block?.dataset?.align) ? block.dataset.align : D.align,
    valign: ['top', 'center', 'bottom'].includes(block?.dataset?.valign) ? block.dataset.valign : D.valign,
    order: ['t-n-b', 't-b-n', 'n-t-b'].includes(block?.dataset?.order) ? block.dataset.order : D.order,
    inlineUnit: _bool(block, 'inlineUnit', D.inlineUnit),
    pad: _num(block, 'pad', D.pad), gapY: _num(block, 'gapY', D.gapY),
    stubVert: _bool(block, 'stubVert', D.stubVert),
  };
}

/* ══ 생성기 출력의 ★두 속성만 100% 로 ═══════════════════════════════════════
   생성기는 width/height 를 ★모델 px 로 박아 낸다(시안 그대로 · 바꾸지 않았다).
   블럭은 그 그림을 ★폭에 맞춰 늘린다 ⇒ ★그 두 속성만 바꾼다.
   ⛔viewBox 는 ★안 건드린다 — 그 좌표계가 곧 ★글자 자리의 좌표계다.
   ★바꿨는지를 ★돌려준다 — 「바꾼 척」을 막는다(검사가 이 전제를 단언한다). */
function cpnResponsiveSvg(svg, cw, ch) {
  const want = ` width="${cw}" height="${ch}">`;
  const i = String(svg).indexOf(want);
  if (i < 0) return { svg: String(svg), swapped: false };
  return { svg: String(svg).replace(want, ' width="100%" height="100%">'), swapped: true };
}

/* ══ 글자 얹기 — ★시안 :1258~1382 의 꼴 ═════════════════════════════════════
   ⛔<text> 를 SVG 에 넣지 않는다(안쪽은 DOM 이어야 «그릇»이 된다 — 시안 생성기 ③ 주석).
   ★글자 칸 하나. `tb-cpn-line` = 내보내기 보험 · `data-cpn-slot` = «어느 칸인가». */
function _lineEl(block, sl, boxW) {
  const e = document.createElement('div');
  e.className = 'tb-cpn-line';
  e.dataset.cpnSlot = sl.key;
  if (sl.isPh) e.dataset.isPlaceholder = 'true';
  e.textContent = sl.txt;
  e.style.fontSize = _cpnEffFontSize(block, sl.key, boxW) + 'px';   // ★다섯이 전부 이 문을 지난다
  e.style.fontWeight = String(sl.weight);
  e.style.color = sl.color;
  e.style.whiteSpace = 'pre';
  e.style.lineHeight = '1.15';
  e.style.cursor = 'pointer';
  e.title = '이 칸만 열기 — ' + sl.key;
  return e;
}

/** 큰 숫자 ＋ 단위 — 한 줄로 붙이거나(inlineUnit) 따로 쌓는다. ★시안 numUnit(:1269). */
function _numUnit(block, st, boxW) {
  const num = _slotOf(block, 'num'), unit = _slotOf(block, 'unit');
  const out = [];
  if (st.inlineUnit) {
    if (num.on || unit.on) {
      const r = document.createElement('div');
      r.style.display = 'flex';
      r.style.alignItems = 'baseline';
      r.style.gap = Math.round(4 * _cpnScale(block, boxW)) + 'px';
      r.style.justifyContent = st.align === 'left' ? 'flex-start' : (st.align === 'right' ? 'flex-end' : 'center');
      if (num.on) r.appendChild(_lineEl(block, num, boxW));
      if (unit.on) r.appendChild(_lineEl(block, unit, boxW));
      out.push(r);
    }
  } else {
    if (num.on) out.push(_lineEl(block, num, boxW));
    if (unit.on) out.push(_lineEl(block, unit, boxW));
  }
  return out;
}

/** 글자 묶음이 들어갈 사각형 하나. ★시안 mkBlock(:1296) — 여백을 짧은 변의 25% 로 자르는 그 규율까지. */
function _mkBox(block, rect, st, kids, vert, boxW) {
  const k = _cpnScale(block, boxW);
  const d = document.createElement('div');
  d.className = 'cpn-tx';
  d.style.position = 'absolute';
  d.style.boxSizing = 'border-box';
  d.style.display = 'flex';
  d.style.flexDirection = vert ? 'row' : 'column';
  d.style.left = Math.round(rect.x * k) + 'px';
  d.style.top = Math.round(rect.y * k) + 'px';
  d.style.width = Math.round(rect.w * k) + 'px';
  d.style.height = Math.round(rect.h * k) + 'px';
  /* ★여백은 «칸 크기에 매여» 있다 — 52px 칸에 24px 여백이면 글자 자리가 4px 다.
     ⇒ 짧은 변의 25% 로 ★자른다(시안 mkBlock 의 그 줄). */
  const padEff = Math.round(Math.min(st.pad * k, rect.w * k * 0.25, rect.h * k * 0.25));
  d.style.padding = padEff + 'px';
  d.style.gap = Math.round(st.gapY * k) + 'px';
  if (!vert) {
    d.style.alignItems = st.align === 'left' ? 'flex-start' : (st.align === 'right' ? 'flex-end' : 'center');
    d.style.justifyContent = st.valign === 'top' ? 'flex-start' : (st.valign === 'bottom' ? 'flex-end' : 'center');
    d.style.textAlign = st.align;
  } else {
    d.style.alignItems = 'center';
    d.style.justifyContent = 'center';
    d.style.writingMode = 'vertical-rl';
  }
  for (const kid of kids) d.appendChild(kid);
  return d;
}

/** ★시안 drawOverlay(:1315) 의 «쌓기» 갈래. ⛔layout:'free' 는 1단계에 없다(2단계). */
function _drawOverlay(block, L, st, ovl, boxW) {
  const seq = st.order === 't-b-n' ? ['t', 'b', 'n'] : (st.order === 'n-t-b' ? ['n', 't', 'b'] : ['t', 'n', 'b']);
  const toStrip = (st.split === 'two' && L.stripRect);
  const top = _slotOf(block, 'top'), bot = _slotOf(block, 'bot'), stub = _slotOf(block, 'stub');
  const kids = [];
  for (const s of seq) {
    if (s === 't' && top.on) kids.push(_lineEl(block, top, boxW));
    if (s === 'n') kids.push(..._numUnit(block, st, boxW));
    if (s === 'b' && bot.on && !toStrip) kids.push(_lineEl(block, bot, boxW));
  }
  if (kids.length) ovl.appendChild(_mkBox(block, L.bodyRect, st, kids, false, boxW));
  if (toStrip && bot.on) ovl.appendChild(_mkBox(block, L.stripRect, st, [_lineEl(block, bot, boxW)], false, boxW));
  /* ★스텁은 ★자리가 있을 때만 — 분할이나 절취선이 켜져야 생긴다(지디 Q2 ㈁).
     ⛔자리가 없을 때 ★몸통에 끼워 넣지 마라. 그러면 「없는 칸」이 있는 척한다. */
  if (stub.on && L.stubRect) ovl.appendChild(_mkBox(block, L.stubRect, st, [_lineEl(block, stub, boxW)], st.stubVert, boxW));
}

/** ★스텁 칸의 «자리»가 지금 있나 — 패널이 회색 처리를 할지 묻는 문. 한 자리에서 답한다. */
function couponStubHasRoom(block) {
  if (!block) return false;
  const st = _cpnState(block);
  return !!paint(st, st.cw, st.ch).stubRect;
}

function renderCouponBlock(block) {
  if (!block) return;
  const st = _cpnState(block);
  const boxW = clampCoupon(_num(block, 'width', COUPON_DEFAULTS.width), COUPON_LIMITS.width);
  const boxH = _cpnBoxH(block, boxW);

  /* ★블럭은 곧 쿠폰이다 — 생성기에 ★모델 크기를 그대로 건넨다(가운데 띄우기 없음). */
  const L = paint(st, st.cw, st.ch);
  const r = cpnResponsiveSvg(L.svg, st.cw, st.ch);
  if (!r.swapped) console.warn('[coupon-block] 생성기 출력의 width/height 를 못 바꿨다 — 그림이 안 늘어난다');

  block.style.cssText = 'box-sizing:border-box;position:relative;'
    + `width:${boxW}px;height:${boxH}px;max-width:100%;margin-left:auto;margin-right:auto;`;

  const bg = document.createElement('div');
  bg.className = 'cpn-bg';
  bg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;line-height:0;pointer-events:none;';
  bg.innerHTML = r.svg;

  const ovl = document.createElement('div');
  ovl.className = 'cpn-ovl';
  ovl.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
  _drawOverlay(block, L, st, ovl, boxW);

  block.innerHTML = '';
  block.appendChild(bg);
  block.appendChild(ovl);
}

function makeCouponBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'coupon-block';
  block.id = genId('cpn');
  block.dataset.type = 'coupon';
  /* ★그림 기하 — cw·ch·radius 는 ★무조건 박는다(modal 의 lineHeight 와 같은 까닭:
     안 박으면 「비율」이라는 개념이 저장·로드 왕복에서 없는 것이 되고, 나중에 기본값을
     바꾸는 순간 ★이미 만든 블럭까지 같이 움직인다). */
  block.dataset.cw = String(COUPON_DEFAULTS.cw);
  block.dataset.ch = String(COUPON_DEFAULTS.ch);
  block.dataset.ratio = String(COUPON_DEFAULTS.ratio);
  block.dataset.radius = String(Number.isFinite(Number(opts.radius)) ? Number(opts.radius) : COUPON_DEFAULTS.radius);
  block.dataset.width = String(clampCoupon(
    Number.isFinite(Number(opts.width)) ? Number(opts.width) : COUPON_DEFAULTS.width, COUPON_LIMITS.width));
  block.dataset.canvasCol = COUPON_DEFAULTS.canvasCol;
  block.dataset.bodyCol = (typeof opts.bodyCol === 'string' && _CPN_COLOR_RE.test(opts.bodyCol.trim()))
    ? opts.bodyCol.trim() : COUPON_DEFAULTS.bodyCol;
  block.dataset.stubCol = (typeof opts.stubCol === 'string' && _CPN_COLOR_RE.test(opts.stubCol.trim()))
    ? opts.stubCol.trim() : COUPON_DEFAULTS.stubCol;
  /* ★글자 다섯 — 켜짐·크기·굵기·색은 ★무조건 박는다(위와 같은 까닭).
     ★글자(Text)는 ★비워 둔다 → render 가 안내문구를 그린다(modal 의 placeholder 규약). */
  for (const s of COUPON_SLOTS) {
    block.dataset[_dsKey(s.key, 'On')] = s.on ? '1' : '0';
    block.dataset[_dsKey(s.key, 'Size')] = String(s.size);
    block.dataset[_dsKey(s.key, 'Weight')] = String(s.weight);
    block.dataset[_dsKey(s.key, 'Color')] = s.color;
    if (typeof opts[s.key] === 'string') block.dataset[_dsKey(s.key, 'Text')] = opts[s.key];
  }

  renderCouponBlock(block);

  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

/* ★새로 만든 쿠폰을 «캔버스 클릭 경로와 같게» 고른다 — modal 의 _selectNewModal 과 ★같은 자리.
   ⚠️패널은 selectBlock 이 js/panel-dispatch.js 를 거쳐 열어 준다(T-079 뒤). 손잡이는
     ★여기서만 붙으므로 두 줄을 한 벌로 남긴다. ⛔「두 번 호출」은 멱등이다
     (showCouponProperties 는 dataset 만 읽어 패널을 새로 그린다). */
function _selectNewCoupon(block) {
  if (!block) return;
  try { window.selectBlock?.(block.id); } catch (_) {}
  try {
    window.showCouponProperties?.(block);
    window.showHandlesFor?.(block);
  } catch (_) {}
}

function addCouponBlock(opts = {}) {
  // FRAMEICON 패턴 — free-layout/fullWidth 프레임 안이면 _insertToFlowFrame 이 전부 처리한다.
  let made = null;
  if (window._insertToFlowFrame?.(() => (made = makeCouponBlock(opts)))) {
    if (made) { renderCouponBlock(made.block); _selectNewCoupon(made.block); }
    window.triggerAutoSave?.();
    return made;
  }
  const sec = window.getSelectedSection?.();
  if (!sec) { showNoSelectionHint?.(); return null; }
  window.pushHistory?.();
  const { row, block } = made || makeCouponBlock(opts);
  insertAfterSelected(sec, row);
  renderCouponBlock(block);
  bindBlock(block);
  window.buildLayerPanel?.();
  _selectNewCoupon(block);
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
  return { row, block };
}

/* 슬롯 글자 커밋 — DOM 이 아니라 ★dataset 에 쓴다(modal commitModalSlot 과 같은 규율).
   ⛔히스토리를 ★여기서 쌓지 않는다 — 부르는 쪽(패널)이 push-after 로 쌓는다.
     여기서 쌓으면 한 제스처가 두 칸이 된다. */
function commitCouponSlot(block, slot, text) {
  if (!block || !COUPON_SLOT_KEYS.includes(slot)) return false;
  const key = _dsKey(slot, 'Text');
  const next = String(text ?? '');
  if ((block.dataset[key] || '') === next) return false;
  block.dataset[key] = next;
  return true;
}

window.makeCouponBlock = makeCouponBlock;
window.addCouponBlock = addCouponBlock;
window.renderCouponBlock = renderCouponBlock;
window.commitCouponSlot = commitCouponSlot;
window.couponStubHasRoom = couponStubHasRoom;
window.COUPON_SLOTS = COUPON_SLOTS;
window.COUPON_SLOT_KEYS = COUPON_SLOT_KEYS;
window.COUPON_DEFAULTS = COUPON_DEFAULTS;
window.COUPON_LIMITS = COUPON_LIMITS;
window.clampCoupon = clampCoupon;
window.cpnSlotDsKey = _dsKey;
window.cpnBoxH = _cpnBoxH;
window.cpnEffFontSize = _cpnEffFontSize;

export {
  makeCouponBlock, addCouponBlock, renderCouponBlock, commitCouponSlot, couponStubHasRoom,
  cpnResponsiveSvg, _cpnScale, _cpnEffFontSize, _cpnBoxH, _cpnState, _slotOf, _dsKey,
  COUPON_SLOTS, COUPON_SLOT_KEYS, COUPON_DEFAULTS, COUPON_LIMITS, clampCoupon,
  CPN_FS_MIN, CPN_FS_MAX,
};

/* 버즈(1012t1Z5) — 자유배치 프레임 + «진짜 모달» N개 묶음.
   새 블럭이 아니다. 낱개는 끝까지 그냥 모달이다(끌기 · 회전 · 글 편집 = 기존 코드 그대로).
   여기 있는 것은 «묶음 전체»에 거는 일뿐이다:
     · 스타일 6종(모달 dataset + 장식 + 배치 설정을 한 번에)
     · 다시 놓기(자리 · 회전 · 겹침 순서를 무늬번호 seed 로)
     · 개수 +/−
     · 삽입 window.addBuzzBlock
   패널은 js/props/prop-frame-buzz.js(프레임 패널의 Buzz 절) · 판정과 아이콘은 js/blocks/buzz-mark.js ·
   배치 규칙(순수 함수)은 js/blocks/buzz-layout.js.

   ★규칙 둘(현빈 2026-10-13):
     ⑴ 다시 놓기는 «전부» 다시 놓는다 — 손으로 옮긴 말풍선도 예외가 없다. 「옮긴 것」을 기억하는 값이 없다.
     ⑵ 프레임 높이는 이 파일의 삽입(addBuzzBlock) «한 자리»에서만 쓴다. 다시 놓기 · 스타일 · 개수 · 배치는
        높이를 안 건드리고 «지금 프레임의 높이»(clientHeight) 안에 자리를 맞춘다(buzz-layout.js).
        사용자가 패널이나 손잡이로 높이를 바꾸면 그 값이 곧 새 기준이다 — 따로 기억하는 값이 없다.
   저장: 설정은 프레임의 data-buzz-* · 뒤쪽 단계는 row 의 data-buzz-far · 장식은 모달의 data-deco-* / data-glass.
         자리는 row 인라인(left/top/width/z-index) · 회전은 모달 data-rotation — 기존 모델 그대로. */
import { insertAfterSelected, showNoSelectionHint, applyBlockFullBleed } from '../drag-utils.js';
import { isBuzzFrame } from './buzz-mark.js';
import { scatterLayout, stackLayout, pickSpot, buzzRotations, depthTiers, BUZZ_MARGIN, BUZZ_TAIL_ROOM } from './buzz-layout.js';

export const BUZZ_COUNT = [1, 12];
export const BUZZ_DEFAULTS = { style: 'card', layout: 'scatter', seed: 2291, spread: 60, overlap: 1, offset: 60, gap: 28, width: 0, angle: 0, range: 4, dir: 'alt', depth: 'none', scale: 100 };
/* 숫자 칸의 범위 — 패널의 min/max 도 여기서 찍는다(값 표를 두 벌 두지 않는다). */
export const BUZZ_LIMITS = {
  spread: { min: 0,   max: 100, step: 1 },
  offset: { min: 0,   max: 300, step: 1 },
  gap:    { min: -40, max: 120, step: 1 },
  width:  { min: 0,   max: 800, step: 10 },
  angle:  { min: -15, max: 15,  step: 1 },
  range:  { min: 0,   max: 15,  step: 1 },
  scale:  { min: 50,  max: 200, step: 5 },
};
const _STR_KEYS = ['style', 'layout', 'dir', 'depth'];
const _key = (k) => 'buzz' + k[0].toUpperCase() + k.slice(1);

/** 설정 읽기 — 글자 칸은 없으면 기본값, 숫자 칸은 못 읽으면 기본값 · 범위 밖이면 죈다. */
export function getBuzz(frame, k) {
  const raw = frame?.dataset?.[_key(k)];
  if (_STR_KEYS.includes(k)) return raw || BUZZ_DEFAULTS[k];
  const v = parseFloat(raw);
  if (!Number.isFinite(v)) return BUZZ_DEFAULTS[k];
  const lim = BUZZ_LIMITS[k];
  return lim ? Math.max(lim.min, Math.min(lim.max, v)) : v;
}
export function setBuzz(frame, k, v) { frame.dataset[_key(k)] = String(v); }

/* ── 스타일 6종(묶음 전체에 한 번에) ─────────────────────────────
   modal = 모달 dataset 에 쓰는 값(모달 패널이 아는 그 칸들) · deco = 장식 · frame = 배치 설정.
   색은 «콘텐츠»의 색이다(상세페이지에 실리는 말풍선) — 에디터 크롬 토큰과 무관하다.
   ★frameBg = 그 스타일의 «프레임 기본 배경»(1013t2 D1 · D2 · 현빈 2026-10-14):
     · 알약만 솔리드 BUZZ_PILL_BG.solid — 알약 낱개가 흰 26% 채움 + 흰 글자라 어두운 바탕이 있어야 읽힌다
       (합성 뒤 흰 글자 대비 ≥ 3.0 · 지키는 자: tests/dom/buzz-frame.dom.spec.js BZ-24 · tests/unit/buzz-layout.test.mjs U13).
     · 나머지 5종은 투명 — 섹션 배경이 그대로 비친다.
   ⛔이미 저장된 버즈는 안 바꾼다. 이 값은 «새로 넣을 때 · 스타일을 고를 때»에만 쓰인다(applyBuzzStyle). */
/* 알약 프레임 배경의 고를 거리 — 솔리드가 기본이고, 옛 기본이던 그라데이션은 Buzz 절 「배경」 묶음의 프리셋으로 남는다. */
export const BUZZ_PILL_BG = {
  solid: '#5f564e',
  gradient: 'linear-gradient(165deg,#b8ada0,#a79c91 55%,#9f948a)',
};
export const BUZZ_STYLES = {
  card: { label: '카드', frameBg: 'transparent',
    modal: { bg: '#ffffff', radius: 12, padX: 28, padY: 20, borderW: 0, borderColor: '#dddddd', dropShadow: 'soft', align: 'center', textColor: '#222222', fontSize: 28, fontWeight: '500', lineHeight: 1.4 },
    deco: { tail: 'none', tape: 'none', glass: 0 },
    frame: { layout: 'scatter', spread: 60, overlap: 1, angle: 0, range: 4, dir: 'alt', depth: 'none', width: 0 } },
  pill: { label: '알약', frameBg: BUZZ_PILL_BG.solid, frameBgPresets: BUZZ_PILL_BG,
    modal: { bg: 'rgba(255,255,255,0.26)', radius: 60, padX: 40, padY: 20, borderW: 2, borderColor: 'rgba(255,255,255,0.55)', dropShadow: 'none', align: 'center', textColor: '#ffffff', fontSize: 30, fontWeight: '700', lineHeight: 1.4 },
    deco: { tail: 'none', tape: 'none', glass: 1 },
    frame: { layout: 'scatter', spread: 85, overlap: 0, angle: 0, range: 0, dir: 'alt', depth: 'strong', width: 0 } },
  bubble: { label: '버블', frameBg: 'transparent',
    modal: { bg: '#ffffff', radius: 40, padX: 36, padY: 24, borderW: 0, borderColor: '#dddddd', dropShadow: 'soft', align: 'center', textColor: '#333333', fontSize: 28, fontWeight: '500', lineHeight: 1.4 },
    deco: { tail: 'none', tape: 'none', glass: 0 },
    frame: { layout: 'scatter', spread: 70, overlap: 0, angle: 0, range: 2, dir: 'alt', depth: 'none', width: 0 } },
  tail: { label: '꼬리 말풍선', frameBg: 'transparent',
    modal: { bg: '#ffffff', radius: 60, padX: 44, padY: 30, borderW: 0, borderColor: '#dddddd', dropShadow: 'soft', align: 'center', textColor: '#333333', fontSize: 28, fontWeight: '500', lineHeight: 1.45 },
    deco: { tail: 'alt', tape: 'none', glass: 0 },
    frame: { layout: 'stack', offset: 0, gap: 46, overlap: 0, angle: 0, range: 0, dir: 'alt', depth: 'none', width: 700 } },
  tape: { label: '테이프 메모', frameBg: 'transparent',
    modal: { bg: '#ffffff', radius: 0, padX: 36, padY: 40, borderW: 0, borderColor: '#dddddd', dropShadow: 'soft', align: 'left', textColor: '#222222', fontSize: 24, fontWeight: '600', lineHeight: 1.6 },
    deco: { tail: 'none', tape: 'cycle', glass: 0 },
    frame: { layout: 'scatter', spread: 70, overlap: 1, angle: 0, range: 5, dir: 'alt', depth: 'none', width: 0 } },
  strip: { label: '띠', frameBg: 'transparent',
    modal: { bg: '#ffffff', radius: 0, padX: 46, padY: 22, borderW: 0, borderColor: '#dddddd', dropShadow: 'strong', align: 'center', textColor: '#111111', fontSize: 32, fontWeight: '800', lineHeight: 1.3 },
    deco: { tail: 'none', tape: 'none', glass: 0 },
    frame: { layout: 'stack', offset: 50, gap: 30, overlap: 0, angle: -5, range: 0, dir: 'one', depth: 'none', width: 0 } },
};
export const BUZZ_STYLE_KEYS = Object.keys(BUZZ_STYLES);
const _TAPES = ['left', 'center', 'right'];

/* 「＋」와 삽입이 넣는 예문(가짜 후기 — 실명 · 실브랜드 0). */
export const BUZZ_SAMPLES = [
  '한 달 써 보고 엄마 것도 주문했어요',
  '향이 세지 않아서 아이 방에도 써요',
  '빨래 개는 시간이 절반으로 줄었어요',
  '배송도 빠르고 포장이 꼼꼼했어요',
  '재구매만 벌써 세 번째예요',
  '선물했더니 어디서 샀냐고 물어봐요',
  '손이 덜 가서 저녁이 여유로워졌어요',
  '소리가 조용해서 밤에도 써요',
  '설명서 없이도 바로 쓸 수 있었어요',
  '디자인이 깔끔해서 어디 둬도 예뻐요',
  '부모님 댁에도 하나 놔 드렸어요',
  '진작 살 걸 그랬어요',
];

/** 프레임 직속의 «모달을 담은 row» 들(DOM 순서). */
export function buzzRows(frame) {
  return [...frame.querySelectorAll(':scope > .row')].filter((r) => r.querySelector(':scope > .modal-block'));
}
const _modalOf = (row) => row.querySelector(':scope > .modal-block');
const _rng = (seed) => window.FxSeed.mulberry32((seed >>> 0) || 1);

/* ── 카드 크기 일괄 스케일(1017t1l1 · 현빈 「버즈블럭 - 카드크기(폰트크기 포함) 일괄로 카드의
   크기(스케일) 조절도 가능하게」) ─────────────────────────────────────────────────
   ★「폰트크기 포함」이 핵심 — 도형만 키우고 글자가 안 따라오는 것을 막는다.
   ★선례: js/count-sticker-tool.js countStickerRescaleLabel · js/props/prop-sticker-count.js _fsRatio
     (1017t1j1, 마커블럭의 같은 요구) — 그 꼴은 «비율을 어딘가 들고 있어야만」 하는 자리(라벨 크기가
     마커 폭의 «파생값»이라 자기 자신으로는 전 비율을 못 되살린다)에 쓴 것이다. 버즈는 그 자리가
     필요 없다 — frame.dataset.buzzScale(=prevPct) 자체가 ★이미 저장되는 persist 필드라
     «그 자체가 앵커」다(마커의 WeakMap 이 흉내 내려던 것을 프레임이 이미 갖고 있다). ⇒ 새 WeakMap ·
     새 배율 변수를 ★안 만든다 — getBuzz(frame,'scale') 을 그대로 prevPct 로 쓴다.
   ⛔lineHeight 는 안 건드린다(무차원 — 2배로 키우면 줄간격이 글자 대비 2배로 벌어진다).
   ⛔width(row 폭)는 안 건드린다 — _fitWidths 가 폰트 변화를 글 길이로 스스로 따라간다(이중 확대 방지). */
const BUZZ_SCALE_KEYS = ['fontSize', 'padX', 'padY', 'radius', 'borderW'];
/** prevPct → nextPct 비율로 모든 카드(모달)의 치수칸을 다시 쓴다. frame.dataset.buzzScale 은
 *  호출자가 쓴다(여기선 안 쓴다 — setBuzz 가 단일 쓰기 자리다). */
export function rescaleBuzzCards(frame, prevPct, nextPct) {
  if (!frame || !Number.isFinite(prevPct) || !Number.isFinite(nextPct) || prevPct <= 0) return false;
  const ratio = nextPct / prevPct;
  if (!Number.isFinite(ratio) || ratio === 1) return false;
  const rows = buzzRows(frame);
  rows.forEach((row) => {
    const modal = _modalOf(row);
    if (!modal) return;
    BUZZ_SCALE_KEYS.forEach((k) => {
      const cur = parseFloat(modal.dataset[k]);
      if (!Number.isFinite(cur)) return;
      modal.dataset[k] = String(Math.max(0, Math.round(cur * ratio)));
    });
    window.renderModalBlock?.(modal);
  });
  // BUZZ_SCALE_KEYS 에 width 가 없는 까닭이 :123 — "_fitWidths 가 따라간다"가 전제다. 그 전제를 여기서 세운다.
  // ⛔again/relayoutBuzzFrame 은 부르지 않는다 — 흩어짐이 다시 뿌려진다(prop-frame-buzz.js:260~261). 폭만 따라가게.
  if (rows.length) _fitWidths(frame, rows);
  return rows.length > 0;
}

/* ── 장식 ───────────────────────────── */
function _setDeco(modal, key, v) {
  if (!v || v === 'none' || v === '0') delete modal.dataset[key];
  else modal.dataset[key] = String(v);
}
function _styleModal(modal, S, i, seed) {
  Object.keys(S.modal).forEach((k) => { modal.dataset[k] = String(S.modal[k]); });
  modal.dataset.wMode = 'full';
  _setDeco(modal, 'decoTail', S.deco.tail === 'alt' ? (i % 2 ? 'right' : 'left') : S.deco.tail);
  _setDeco(modal, 'decoTape', S.deco.tape === 'cycle' ? _TAPES[(i + (seed >>> 0)) % 3] : S.deco.tape);
  _setDeco(modal, 'glass', S.deco.glass ? '1' : '');
  window.renderModalBlock?.(modal);
}

/* ── 배치 ───────────────────────────── */
/* row 폭 = 「너비」가 0 이면 글 길이(max-content), 아니면 그 값. 어느 쪽이든 프레임 안쪽 폭을 넘지 않는다.
   ★글 길이에 «비례하는» 여유를 둔다(BUZZ_WIDTH_SLACK). 내보낸 HTML 은 편집기의 글꼴(Pretendard)이 없는 화면에서도 열리는데,
     대체 글꼴은 같은 글이 더 넓다(판정서 실측 324.6 → 330.6px ≈ +1.85%). 여유가 고정 2px 뿐이면 마지막 글자가 다음 줄로 떨어진다.
     3% = 그 실측의 1.6배. 지키는 자: tests/dom/buzz-frame.dom.spec.js BZ-21. */
const BUZZ_WIDTH_SLACK = 1.03;
function _fitWidths(frame, rows) {
  const cap = (frame.clientWidth || 860) - 2 * BUZZ_MARGIN;
  const fixed = getBuzz(frame, 'width');
  rows.forEach((row) => {
    if (fixed > 0) { row.style.width = Math.min(cap, fixed) + 'px'; return; }
    row.style.width = 'max-content';
    row.style.width = Math.min(cap, Math.ceil(row.offsetWidth * BUZZ_WIDTH_SLACK) + 2) + 'px';
  });
}

/* ── 프로필(1017t1l2 · 현빈 1018t1-l2a/b/c) ────────────────────────
   ★그리는 자는 «모달»이다(js/blocks/modal-block.js _profileHtml) — 여기서는 ★칸만 쓰고 재렌더를 시킨다.
   ⛔그리는 규칙의 사본을 여기 두지 않는다(장식·유리와 같은 결 — 버즈는 «값»만 안다).
   ★묶음 전체에 걸기 — 현빈의 l2a·l2c 는 「버즈블럭」 에 대한 말씀이라 패널은 묶음 단위로 준다.
     낱개만 다르게 하려면 그 카드를 골라 모달 패널에서 고친다(사진·이모지가 가장 흔한 갈래다).
   ★스타일을 다시 걸어도 프로필은 ★안 지워진다 — _styleModal 은 S.modal 의 칸만 다시 쓰고
     프로필 칸은 그 표에 없다(BUZZ_STYLES 전수 실측 — profile* ★항목 없음).
   ⚠새 낱개는 «마지막 모달의 dataset 그대로» 예전 규약(_newModalRow · _COPY_SKIP)을 따라
     ★앞 카드의 얼굴을 물려받는다 — _COPY_SKIP 을 ★안 건드렸기 때문이다(= 예전 규칙 그대로).
     ★★「같은 얼굴이 여럿 카드에 가도 되나」는 ★현빈께 안 여쭤 칸이다 — ⛔지어내서 따로 규칙을 만들지 말고 물어라. */
export const BUZZ_PROFILE_KEYS = ['profileImg', 'profileEmoji', 'profileSide', 'profileSize', 'profileOverlay'];

/** 묶음 안 모든 낱개에 프로필 칸 하나를 건다. 빈 값('' · null · undefined)은 칸을 «지운다».
 *  @returns {number} 고친 낱개 수 */
export function setBuzzProfile(frame, key, v) {
  if (!frame || !BUZZ_PROFILE_KEYS.includes(key)) return 0;
  const rows = buzzRows(frame);
  rows.forEach((row) => {
    const modal = _modalOf(row);
    if (!modal) return;
    if (v === '' || v === null || v === undefined) delete modal.dataset[key];
    else modal.dataset[key] = String(v);
    /* 사진과 이모지는 ★둘 중 하나다 — 그리는 쪽이 사진을 먼저 본다(_profileKind)
       ⇒ 쓰는 자리에서 반대 칸을 비운다. 안 비우면 «이모지를 넣었는데 사진이 뜨는» 자리가 생긴다. */
    if (key === 'profileImg' && v) delete modal.dataset.profileEmoji;
    if (key === 'profileEmoji' && v) delete modal.dataset.profileImg;
    window.renderModalBlock?.(modal);
  });
  return rows.length;
}

/** 묶음의 «지금 값» — 낱개가 갈라져 있으면 ★첫 낱개의 값(패널은 한 값만 보여 준다). */
export function getBuzzProfile(frame, key) {
  const row = frame ? buzzRows(frame)[0] : null;
  const modal = row ? _modalOf(row) : null;
  return modal ? modal.dataset[key] : undefined;
}

/** 낱개 하나의 row 폭만 다시 재는다 — ★자리·회전·겹침 순서는 ★안 건드린다.
 *  현빈 l2b 「x 를 누르면 글이 당겨짐」 — 칸이 사라진 만큼 상자도 줄어야 «자리가 안 남는다».
 *  창구를 window 로 낸다 — js/blocks/modal-block.js 가 버즈를 import 하지 않고 부른다(refitBuzzOnResize 와 같은 꼴).
 *  @param {HTMLElement} modal  낱개(모달)
 *  @returns {boolean} 다시 재었나 */
export function refitBuzzRowWidth(modal) {
  const row = modal?.parentElement;
  const frame = row?.parentElement;
  if (!row || !row.classList?.contains('row') || !isBuzzFrame(frame)) return false;
  _fitWidths(frame, [row]);
  return true;
}
if (typeof window !== 'undefined') window.refitBuzzRowWidth = refitBuzzRowWidth;

/**
 * 자리 · 회전 · 겹침 순서 · 뒤쪽 단계를 무늬번호로 «전부» 다시 놓는다(손으로 옮긴 것도).
 * 프레임 높이는 읽기만 한다 — 넘치면 그 안에서 자리를 줄여 맞춘다.
 * @param {HTMLElement} frame
 * @param {object} [o]
 * @param {boolean} [o.dry]      true 면 아무것도 안 쓰고 결과만 잰다(패널의 「겹쳐 놓았습니다」 안내 · 삽입 때 처음 높이)
 * @param {boolean} [o.natural]  true 면 프레임 높이를 안 보고 자연 배치로 잰다
 * @returns {{ok:boolean, squeezed:boolean, natural:number}}
 */
export function relayoutBuzzFrame(frame, { dry = false, natural = false } = {}) {
  const none = { ok: false, squeezed: false, natural: 0 };
  if (!frame || !frame.clientWidth || !window.FxSeed) return none;
  const rows = buzzRows(frame);
  if (!rows.length) return none;
  const seed = getBuzz(frame, 'seed');
  const angle = getBuzz(frame, 'angle'), range = getBuzz(frame, 'range');
  if (!dry) _fitWidths(frame, rows);
  /* 실측은 offsetWidth/offsetHeight(레이아웃 px) — 캔버스 배율 · row 의 깊이 축소(transform)와 무관하다. */
  const sizes = rows.map((r) => ({ w: r.offsetWidth, h: r.offsetHeight }));
  const stageW = frame.clientWidth;
  const stageH = natural ? undefined : frame.clientHeight;
  const tilt = Math.min(20, Math.abs(angle) + range);
  const hasTail = rows.some((r) => _modalOf(r).dataset.decoTail);
  const out = getBuzz(frame, 'layout') === 'stack'
    ? stackLayout({ sizes, stageW, stageH, margin: BUZZ_MARGIN, offset: getBuzz(frame, 'offset'), gap: getBuzz(frame, 'gap'), tilt,
        tailRoom: hasTail ? BUZZ_TAIL_ROOM : 0, topFirst: hasTail })
    : scatterLayout({ rng: _rng(seed), sizes, stageW, stageH, margin: BUZZ_MARGIN, spread: getBuzz(frame, 'spread'), tilt,
        overlap: getBuzz(frame, 'overlap') === 1, padY: parseFloat(_modalOf(rows[0]).dataset.padY) || 20 });
  const res = { ok: true, squeezed: !!out.squeezed, natural: out.natural };
  if (dry) return res;
  /* 회전은 자리와 «다른 줄기»의 난수다 — 각도만 바꿔도 자리가 안 흔들린다. */
  const rots = buzzRotations({ rng: _rng(Math.imul(seed >>> 0, 2654435761)), tops: out.items.map((p) => p.y), angle, range, dir: getBuzz(frame, 'dir') });
  const tiers = depthTiers(out.items.map((p) => p.z));
  rows.forEach((row, i) => {
    const p = out.items[i];
    row.style.left = p.x + 'px';
    row.style.top = p.y + 'px';
    row.style.zIndex = String(p.z);
    if (tiers[i]) row.dataset.buzzFar = String(tiers[i]); else delete row.dataset.buzzFar;
    const modal = _modalOf(row);
    modal.dataset.rotation = String(rots[i]);
    window.renderModalBlock?.(modal);
  });
  return res;
}

/** 프레임 «밖»으로 나간 말풍선이 있나(레이아웃 상자). */
export function buzzOverflowing(frame) {
  const cw = frame.clientWidth, ch = frame.clientHeight;
  return buzzRows(frame).some((r) => r.offsetTop < 0 || r.offsetLeft < 0 || r.offsetLeft + r.offsetWidth > cw || r.offsetTop + r.offsetHeight > ch);
}

/**
 * 사용자가 프레임 크기를 바꾼 «직후»에 부른다(패널 높이 칸 · 크기 손잡이를 놓았을 때).
 * 밖으로 나간 말풍선이 있을 때만 «같은 무늬번호로» 그 안에 다시 놓는다. 다 안에 있으면(키웠거나 여유가 있으면) 아무것도 안 건드린다
 * — 손으로 옮긴 자리를 까닭 없이 지우지 않는다. 프레임 높이는 여기서도 읽기만 한다.
 * ⛔⌘Z/⌘⇧Z 길에서는 부르지 않는다(저장된 자리가 높이와 같이 돌아온다).
 * @returns {boolean} 다시 놓았나
 */
export function refitBuzzFrame(frame) {
  if (!isBuzzFrame(frame) || !buzzOverflowing(frame)) return false;
  return relayoutBuzzFrame(frame).ok;
}

/**
 * 「겹쳐 놓았습니다」 안내를 켤 때인가 — 프레임 높이에 눌렸고(자연 배치가 안 들어간다) «그리고» 상자가 실제로 겹쳐 있을 때만.
 * 스택의 간격만 줄었을 뿐 서로 안 닿으면 끈다(문구가 사실과 달라진다).
 */
export function buzzCrowded(frame) {
  if (!relayoutBuzzFrame(frame, { dry: true }).squeezed) return false;
  const b = buzzRows(frame).map((r) => ({ x: r.offsetLeft, y: r.offsetTop, w: r.offsetWidth, h: r.offsetHeight }));
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
    if (Math.min(b[i].x + b[i].w, b[j].x + b[j].w) - Math.max(b[i].x, b[j].x) > 0
      && Math.min(b[i].y + b[i].h, b[j].y + b[j].h) - Math.max(b[i].y, b[j].y) > 0) return true;
  }
  return false;
}

/** 프레임 배경을 쓴다 — 값 칸(data-bg)과 인라인 배경을 «같이». 솔리드 · 투명 · 그라데이션 어느 것이든 background 한 줄이 앞 값을 지운다. */
export function setBuzzFrameBg(frame, css) {
  if (!frame || !css) return false;
  frame.dataset.bg = css;
  frame.style.background = css;
  return true;
}

/** 스타일을 묶음 전체에 건다(모달 dataset + 장식 + 배치 설정 + 프레임 배경) → 다시 놓는다. 높이는 그대로다.
 *  프레임 배경은 «그 스타일의 기본»으로 간다 — 손으로 바꾼 배경도 덮는다(1012t1Z5 부터의 동작 그대로). */
export function applyBuzzStyle(frame, key) {
  const S = BUZZ_STYLES[key];
  if (!frame || !S) return false;
  setBuzz(frame, 'style', key);
  Object.keys(S.frame).forEach((k) => setBuzz(frame, k, S.frame[k]));
  if (frame.dataset.buzzSeed === undefined) setBuzz(frame, 'seed', BUZZ_DEFAULTS.seed);
  setBuzz(frame, 'scale', BUZZ_DEFAULTS.scale);   // ★1017t1l1 — 스타일을 새로 걸면 _styleModal 이 치수를 S.modal 기본값으로 «다시 쓴다» ⇒ 스케일도 100%로
  setBuzzFrameBg(frame, S.frameBg);
  const seed = getBuzz(frame, 'seed');
  buzzRows(frame).forEach((row, i) => _styleModal(_modalOf(row), S, i, seed));
  relayoutBuzzFrame(frame);
  return true;
}

/* 새 모달이 «물려받지 않는» 칸 — 글과 회전은 낱개의 것이고, 장식은 아래에서 번갈이 규칙으로 따로 준다. */
const _COPY_SKIP = ['textText', 'textHtml', 'titleText', 'rotation', 'decoTail', 'decoTape', 'glass'];

function _newModalRow(frame, text) {
  const made = window.makeModalBlock({ variant: 'plain' });
  const { row, block } = made;
  const rows = buzzRows(frame);
  const last = rows.length ? _modalOf(rows[rows.length - 1]) : null;
  if (last) {
    /* «지금 스타일» = 마지막 모달의 dataset 을 그대로(사용자가 낱개 패널에서 고친 값 포함). 장식은 번갈아. */
    Object.keys(last.dataset).forEach((k) => { if (!_COPY_SKIP.includes(k)) block.dataset[k] = last.dataset[k]; });
    const tail = last.dataset.decoTail;
    _setDeco(block, 'decoTail', tail ? (tail === 'left' ? 'right' : 'left') : '');
    const tape = last.dataset.decoTape;
    _setDeco(block, 'decoTape', _TAPES.includes(tape) ? _TAPES[(_TAPES.indexOf(tape) + 1) % 3] : '');
    _setDeco(block, 'glass', last.dataset.glass === '1' ? '1' : '');
  } else {
    const S = BUZZ_STYLES[frame.dataset.buzzStyle] || BUZZ_STYLES.card;
    Object.keys(S.modal).forEach((k) => { block.dataset[k] = String(S.modal[k]); });
  }
  block.dataset.wMode = 'full';
  block.dataset.textText = text;
  block.dataset.rotation = '0';
  row.style.position = 'absolute';
  row.style.left = BUZZ_MARGIN + 'px';
  row.style.top = BUZZ_MARGIN + 'px';
  row.style.width = '300px';
  row.setAttribute('draggable', 'false');
  frame.appendChild(row);
  window.renderModalBlock?.(block);
  window.bindBlock?.(block);
  return row;
}

/**
 * 개수를 n 으로(1~12). 늘리면 «지금 스타일»의 새 모달, 줄이면 마지막 모달.
 * 흩어짐: 남은 것의 자리 · 겹침 순서 · 뒤쪽 단계를 안 건드리고 새 것만 프레임 «안» 덜 겹치는 자리에(맨 앞).
 * 스택: 전부 다시 쌓는다. 어느 쪽도 프레임 높이는 안 건드린다.
 */
export function setBuzzCount(frame, n) {
  if (!frame || !window.makeModalBlock || !window.FxSeed) return frame ? buzzRows(frame).length : 0;
  const target = Math.max(BUZZ_COUNT[0], Math.min(BUZZ_COUNT[1], Math.round(n)));
  let rows = buzzRows(frame);
  const stack = getBuzz(frame, 'layout') === 'stack';
  while (rows.length > target) { rows[rows.length - 1].remove(); rows = buzzRows(frame); }
  while (rows.length < target) {
    const used = new Set(rows.map((r) => (_modalOf(r).dataset.textText || '').replace(/\s+/g, ' ').trim()));
    const others = rows.map((r) => ({ x: r.offsetLeft, y: r.offsetTop, w: r.offsetWidth, h: r.offsetHeight }));
    const topZ = rows.reduce((m, r) => Math.max(m, parseInt(r.style.zIndex, 10) || 0), 0);
    const row = _newModalRow(frame, BUZZ_SAMPLES.find((t) => !used.has(t)) || BUZZ_SAMPLES[rows.length % BUZZ_SAMPLES.length]);
    if (!stack) {
      _fitWidths(frame, [row]);
      const rng = _rng((getBuzz(frame, 'seed') >>> 0) + rows.length * 7919);
      const spot = pickSpot({ rng, size: { w: row.offsetWidth, h: row.offsetHeight }, others,
        stageW: frame.clientWidth || 860, stageH: frame.clientHeight, margin: BUZZ_MARGIN });
      row.style.left = spot.x + 'px';
      row.style.top = spot.y + 'px';
      row.style.zIndex = String(topZ + 1);
      const modal = _modalOf(row);
      modal.dataset.rotation = String(Math.round(getBuzz(frame, 'angle') + (rng() * 2 - 1) * getBuzz(frame, 'range')) || 0);
      window.renderModalBlock?.(modal);
    }
    rows = buzzRows(frame);
  }
  if (stack) relayoutBuzzFrame(frame);
  window.buildLayerPanel?.();
  return rows.length;
}

/* ── 삽입 메뉴 「Buzz」 ───────────────────────────────
   ★프레임 높이를 쓰는 «유일한» 자리다(「처음 값」 = 기본 스타일의 자연 높이 · 패널 높이 칸의 범위 100~1200 안).
   동기 함수다 — 끝 표본은 js/insert-history.js 의 래퍼가 찍는다(여기서 한 번 더 부르지 않는다). */
function addBuzzBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { showNoSelectionHint(); return null; }
  if (!window.makeFrameBlock || !window.makeModalBlock || !window.FxSeed) return null;
  window.pushHistory?.();
  const style = BUZZ_STYLES[opts.style] ? opts.style : BUZZ_DEFAULTS.style;
  const frame = window.makeFrameBlock({ bg: BUZZ_STYLES[style].frameBg });
  frame.dataset.buzz = '1';
  setBuzz(frame, 'seed', window.FxSeed.newSeed() % 10000 || 1);
  insertAfterSelected(sec, frame);                          /* DOM 에 붙어야 실측이 된다 */
  /* 1013t2 D1 — 새 버즈는 「패딩 제외」(프레임 패널 Size 절의 그 스위치)가 켜진 채로 들어간다: 섹션 좌우 패딩을 넘어 가장자리까지.
     ★말풍선을 놓기 «전»에 건다 — 놓는 폭이 프레임의 clientWidth 다. 뚫을 패딩이 없는 자리면 표식만 남고 폭은 그대로다.
     끄기 · 폭 바꾸기 · 저장 복원은 프레임의 기존 길(js/props/prop-frame.js · js/overlay-handles.js) 그대로다. */
  frame.dataset.fullBleed = 'true';
  applyBlockFullBleed(frame);
  const count = Math.max(BUZZ_COUNT[0], Math.min(BUZZ_COUNT[1], Math.round(Number(opts.count)) || 6));
  BUZZ_SAMPLES.slice(0, count).forEach((text) => _newModalRow(frame, text));
  applyBuzzStyle(frame, style);
  const nat = relayoutBuzzFrame(frame, { dry: true, natural: true }).natural;
  if (nat > 0) {
    const h = Math.max(100, Math.min(1200, nat));
    frame.dataset.height = String(h);
    frame.style.height = h + 'px';
    frame.style.minHeight = h + 'px';
    relayoutBuzzFrame(frame);
  }
  window.bindFrameDropZone?.(frame);
  window.buildLayerPanel?.();
  /* 선택 — addFrameBlock(js/block-factory.js)과 같은 순서. 프레임에 selected 를 붙여야 선택 따라가기가
     마지막 모달을 고르지 않는다(js/insert-select.js 규약 ②). */
  window.deselectAll?.();
  sec.classList.add('selected');
  window.syncLayerActive?.(sec);
  frame.classList.add('selected');
  window._activeFrame = frame;
  window.showFrameProperties?.(frame);
  window.showFrameHandles?.(frame);
  frame.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
  return { frame };
}

window.addBuzzBlock = addBuzzBlock;

export { addBuzzBlock, isBuzzFrame };

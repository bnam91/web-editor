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
import { insertAfterSelected, showNoSelectionHint } from '../drag-utils.js';
import { isBuzzFrame } from './buzz-mark.js';
import { scatterLayout, stackLayout, pickSpot, buzzRotations, depthTiers, BUZZ_MARGIN, BUZZ_TAIL_ROOM } from './buzz-layout.js';

export const BUZZ_COUNT = [1, 12];
export const BUZZ_DEFAULTS = { style: 'card', layout: 'scatter', seed: 2291, spread: 60, overlap: 1, offset: 60, gap: 28, width: 0, angle: 0, range: 4, dir: 'alt', depth: 'none' };
/* 숫자 칸의 범위 — 패널의 min/max 도 여기서 찍는다(값 표를 두 벌 두지 않는다). */
export const BUZZ_LIMITS = {
  spread: { min: 0,   max: 100, step: 1 },
  offset: { min: 0,   max: 300, step: 1 },
  gap:    { min: -40, max: 120, step: 1 },
  width:  { min: 0,   max: 800, step: 10 },
  angle:  { min: -15, max: 15,  step: 1 },
  range:  { min: 0,   max: 15,  step: 1 },
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
   색은 «콘텐츠»의 색이다(상세페이지에 실리는 말풍선) — 에디터 크롬 토큰과 무관하다. */
export const BUZZ_STYLES = {
  card: { label: '카드', frameBg: '#f3f1ee',
    modal: { bg: '#ffffff', radius: 12, padX: 28, padY: 20, borderW: 0, borderColor: '#dddddd', dropShadow: 'soft', align: 'center', textColor: '#222222', fontSize: 28, fontWeight: '500', lineHeight: 1.4 },
    deco: { tail: 'none', tape: 'none', glass: 0 },
    frame: { layout: 'scatter', spread: 60, overlap: 1, angle: 0, range: 4, dir: 'alt', depth: 'none', width: 0 } },
  pill: { label: '알약', frameBg: 'linear-gradient(165deg,#b8ada0,#a79c91 55%,#9f948a)',
    modal: { bg: 'rgba(255,255,255,0.26)', radius: 60, padX: 40, padY: 20, borderW: 2, borderColor: 'rgba(255,255,255,0.55)', dropShadow: 'none', align: 'center', textColor: '#ffffff', fontSize: 30, fontWeight: '700', lineHeight: 1.4 },
    deco: { tail: 'none', tape: 'none', glass: 1 },
    frame: { layout: 'scatter', spread: 85, overlap: 0, angle: 0, range: 0, dir: 'alt', depth: 'strong', width: 0 } },
  bubble: { label: '버블', frameBg: '#eef0f3',
    modal: { bg: '#ffffff', radius: 40, padX: 36, padY: 24, borderW: 0, borderColor: '#dddddd', dropShadow: 'soft', align: 'center', textColor: '#333333', fontSize: 28, fontWeight: '500', lineHeight: 1.4 },
    deco: { tail: 'none', tape: 'none', glass: 0 },
    frame: { layout: 'scatter', spread: 70, overlap: 0, angle: 0, range: 2, dir: 'alt', depth: 'none', width: 0 } },
  tail: { label: '꼬리 말풍선', frameBg: '#f1f1f1',
    modal: { bg: '#ffffff', radius: 60, padX: 44, padY: 30, borderW: 0, borderColor: '#dddddd', dropShadow: 'soft', align: 'center', textColor: '#333333', fontSize: 28, fontWeight: '500', lineHeight: 1.45 },
    deco: { tail: 'alt', tape: 'none', glass: 0 },
    frame: { layout: 'stack', offset: 0, gap: 46, overlap: 0, angle: 0, range: 0, dir: 'alt', depth: 'none', width: 700 } },
  tape: { label: '테이프 메모', frameBg: '#e9e9e9',
    modal: { bg: '#ffffff', radius: 0, padX: 36, padY: 40, borderW: 0, borderColor: '#dddddd', dropShadow: 'soft', align: 'left', textColor: '#222222', fontSize: 24, fontWeight: '600', lineHeight: 1.6 },
    deco: { tail: 'none', tape: 'cycle', glass: 0 },
    frame: { layout: 'scatter', spread: 70, overlap: 1, angle: 0, range: 5, dir: 'alt', depth: 'none', width: 0 } },
  strip: { label: '띠', frameBg: '#ffffff',
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
/* row 폭 = 「너비」가 0 이면 글 길이(max-content), 아니면 그 값. 어느 쪽이든 프레임 안쪽 폭을 넘지 않는다. */
function _fitWidths(frame, rows) {
  const cap = (frame.clientWidth || 860) - 2 * BUZZ_MARGIN;
  const fixed = getBuzz(frame, 'width');
  rows.forEach((row) => {
    if (fixed > 0) { row.style.width = Math.min(cap, fixed) + 'px'; return; }
    row.style.width = 'max-content';
    row.style.width = Math.min(cap, row.offsetWidth + 2) + 'px';
  });
}

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
  const out = getBuzz(frame, 'layout') === 'stack'
    ? stackLayout({ sizes, stageW, stageH, margin: BUZZ_MARGIN, offset: getBuzz(frame, 'offset'), gap: getBuzz(frame, 'gap'), tilt,
        tailRoom: rows.some((r) => _modalOf(r).dataset.decoTail) ? BUZZ_TAIL_ROOM : 0 })
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

/** 스타일을 묶음 전체에 건다(모달 dataset + 장식 + 배치 설정 + 프레임 배경) → 다시 놓는다. 높이는 그대로다. */
export function applyBuzzStyle(frame, key) {
  const S = BUZZ_STYLES[key];
  if (!frame || !S) return false;
  setBuzz(frame, 'style', key);
  Object.keys(S.frame).forEach((k) => setBuzz(frame, k, S.frame[k]));
  if (frame.dataset.buzzSeed === undefined) setBuzz(frame, 'seed', BUZZ_DEFAULTS.seed);
  frame.dataset.bg = S.frameBg;
  frame.style.background = S.frameBg;
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

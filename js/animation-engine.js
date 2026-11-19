/* ═══════════════════════════════════════════════════════
   ANIMATION GIF ENGINE
═══════════════════════════════════════════════════════ */
import { countUpLine, numToken, reelDigit, lineStartX, typedLines, fillStyled, measureStyled, remapCs, parseTextShadow } from './fx/anim-gif-text.js';
import { drawTracks, V2_FX, TRACK_FX, normTracks, totalMs, scaleTracks, parseAnimGif, serializeAnimGif, AT_MAX, DUR_MIN, DUR_MAX, GIF_FPS, GIF_HOLD_S, loopInfoText, fitCanvasH, textBox, layoutLines, withGradFill, S0_MIN, S0_MAX, S0_DEFAULT, clampS0, stampNeedH, normOpt, optOf, OPT_KEYS, HL_MODES } from './fx/anim-gif-tracks.js';
import { sectionBgColor } from './io/export-image.js';
import { sliderRowHTML, bindSlider } from './props/_helpers.js';
import { TRAIL_MAX, SLIDE_ANIM_DEFAULT } from './fx/slide-motion.js';

const ANIM_LIST = [
  { id: 'slide-up',     label: '슬라이드업',     desc: '아래→위로 올라오며 등장' },
  { id: 'typewriter',   label: '타이핑',          desc: '한 글자씩 입력되듯 등장' },
  { id: 'slot-machine', label: '슬롯머신',        desc: '숫자가 롤링되다 멈춤' },
  { id: 'fade-in',      label: '페이드인',        desc: '투명→불투명 부드럽게' },
  { id: 'word-pop',     label: '단어별 순차등장', desc: '단어 하나씩 팝인' },
  { id: 'glow-pulse',   label: '글로우 펄스',     desc: '빛이 번쩍이며 강조' },
  { id: 'count-up',     label: '카운트업',        desc: '0부터 목표 숫자까지 카운팅' },
  /* GIF V2(현빈 GO 261114) — 줄별 타임라인 엔진(js/fx/anim-gif-tracks.js)으로 그린다 · 위 7종은 옛 _drawFrame 그대로 */
  { id: 'stamp',        label: '도장 찍기',       desc: '크고 흐리게 내려와 «쾅» 선명하게' },
  { id: 'blur-in',      label: '흐림→선명',       desc: '흐릿하게 시작해 또렷해짐' },
  { id: 'blur-whip',    label: '블러 휩',         desc: '옆에서 잔상을 끌며 휙 들어옴' },
  { id: 'fade-char',    label: '한 글자씩 부드럽게', desc: '글자마다 투명→선명으로 차례로' },   // GIF V3(0.9.13 · P035 형식)
];

/** 한 바퀴 계획 — V1 7종 = 옛 길(_drawFrame · 1200ms/속도) · V2 효과 = 줄별 타임라인(블럭 전체 = 모든 줄 같은 효과 · 0ms 동시 시작).
 *  k = 배율(블럭 1px = 캔버스 k px) — 흐림·흔들림 px 를 미리보기·GIF 에서 같은 «눈 크기»로. */
const _V2_DUR = { stamp: 560, 'blur-in': 900, 'blur-whip': 700, 'fade-char': 1200 };
/** 그릴 트랙에 도장 시작 크기를 채운다 — 줄 값이 없으면 블럭 값(s0). 높이 셈(_fitStampHeight)과 그리기가 같은 값을 쓴다. */
const _withS0 = (tracks, s0) => tracks.map((t) => (t.fx === 'stamp' && t.s0 == null ? { ...t, s0 } : t));
/** st = { perLine, tracks, type, s0 } — 모달 지금 값(_plan) 또는 블럭에 저장된 값(_savedState · 블럭 ▶ 단추). */
function _planOf(st, style, speed, k) {
  const paint = (ctx, W, H, size) => withGradFill(ctx, style, W, H, size);   // ⑫ 글자 그라데이션 = 기본 채움색(없으면 style 그대로)
  const n = String(style.text || '').split('\n').length;
  /* F3 줄마다 따로 — 저장된 트랙(글 줄 수에 다시 맞춤) · 속도는 at·dur 를 나눈다 · 한 바퀴 = 가장 늦게 끝나는 줄 */
  if (st.perLine && st.tracks) {
    const tr = _withS0(scaleTracks(normTracks(st.tracks, n), speed), st.s0);
    const dur = Math.max(1, totalMs(tr));
    return { duration: dur, draw: (ctx, W, H, size, t) => drawTracks(ctx, W, H, paint(ctx, W, H, size), size, tr, t * dur, k) };
  }
  const type = st.type;   // 계획 = 지금 효과로 고정(캔버스에서 보기가 모달을 닫은 뒤에도 같은 효과)
  /* GIF V3 옵션(가이드·커서·글로우·깜빡임·형광펜)은 줄별 엔진이 그린다 ⇒ 옛 7종도 옵션을 켜면 그쪽으로 · 옵션 없으면 옛 _drawFrame 그대로(옛 GIF 바이트) */
  const op = normOpt(st.opt, type), hasOp = Object.keys(op).length > 0;
  if (!V2_FX.includes(type) && !(hasOp && TRACK_FX.includes(type))) return { duration: 1200 / speed, draw: (ctx, W, H, size, t) => _drawFrame(ctx, W, H, paint(ctx, W, H, size), size, type, t) };
  const dur = Math.round((_V2_DUR[type] || 1200) / speed);
  const tracks = _withS0(Array.from({ length: n }, (_, i) => ({ line: i, fx: type, at: 0, dur, ...(hasOp ? { o: op } : {}) })), st.s0);
  return { duration: dur, draw: (ctx, W, H, size, t) => drawTracks(ctx, W, H, paint(ctx, W, H, size), size, tracks, t * dur, k) };
}
function _plan(style, speed, k) { return _planOf({ perLine: _perLine, tracks: _tracks, type: _animType, s0: _stampS0(), opt: _animOpt }, style, speed, k); }
/* 블럭 전체 효과의 V3 옵션 — 블럭 data-anim-opt(JSON · 그 효과 허용 키만 · 기본이면 키 없음) */
let _animOpt = {};
function _readOpt(tb) { try { const o = JSON.parse(tb?.dataset.animOpt || '{}'); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } }
/** 지금 효과 기준으로 data-anim-opt 를 맞춘다 — 바뀌었으면 true(부르는 쪽이 이력 한 칸에 묶는다). */
function _saveBlockOpt() {
  if (!_animTb) return false;
  const op = normOpt(_animOpt, _animType), next = Object.keys(op).length ? JSON.stringify(op) : null;
  if ((_animTb.dataset.animOpt ?? null) === next) return false;
  if (next) _animTb.dataset.animOpt = next; else delete _animTb.dataset.animOpt;
  return true;
}
const _hasHl = (tb) => !!tb && (_getTextStyle(tb).cs || []).some((c) => c && c.hl && c.hl.color);
const _OPT_LABEL = { guide: '옅은 가이드', cursor: '커서', glow: '글로우', pulse: '깜빡임' };
/** V3 옵션 칸 — 효과(fx)가 받는 키만 + 형광펜 글이면 형광펜 고르기. 모달(블럭 전체)·줄 칸이 같은 것을 쓴다(onChange(k, v)). */
function _optControls(fx, o, onChange, hl) {
  const box = document.createElement('span'); box.className = 'anim-fx-opt-set';
  box.optCount = 0;   // 칸 수(0 이면 부르는 쪽이 안 붙인다)
  for (const k of OPT_KEYS[fx] || []) {
    const lab = document.createElement('label'); lab.className = 'anim-opt-label';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.dataset.opt = k; cb.checked = !!optOf(o, k);
    cb.addEventListener('change', () => onChange(k, cb.checked));
    lab.append(cb, ' ' + _OPT_LABEL[k]);
    box.appendChild(lab); box.optCount++;
  }
  if (hl) {
    const sel = document.createElement('select'); sel.className = 'anim-track-fx'; sel.dataset.opt = 'hl'; sel.title = '형광펜(칠한 글)';   // 줄 효과 고르기와 같은 공용 꼴(NEW-현빈QA-GIF-HL-SELECT-CSS-01 · 새 CSS 0) — 같은 줄에서 효과 고르기는 :not([data-opt]) 로 가린다
    for (const [v, t] of [['', '형광펜: 글과 같이'], ['fixed', '형광펜 고정 + 글만'], ['draw', '형광펜 긋기'], ['sweep', '글 고정 + 띠만 긋기']]) { const op = document.createElement('option'); op.value = v; op.textContent = t; op.selected = (optOf(o, 'hl') || '') === v; sel.appendChild(op); }
    sel.addEventListener('change', () => onChange('hl', HL_MODES.includes(sel.value) ? sel.value : null));
    box.appendChild(sel); box.optCount++;
  }
  return box;
}
function _renderBlockOpts() {
  const host = document.getElementById('anim-fx-opts');
  if (!host) return;
  host.textContent = '';
  if (_perLine || !_animTb) { host.style.display = 'none'; return; }   // 줄마다 따로면 줄 칸이 옵션을 든다
  const set = _optControls(_animType, normOpt(_animOpt, _animType), (k, v) => {
    _animOpt = { ..._animOpt, [k]: v };
    if (v === null) delete _animOpt[k];
    _commitGif(_saveBlockOpt());
    restartAnimPreview();
  }, _hasHl(_animTb));
  host.style.display = set.optCount ? '' : 'none';
  host.appendChild(set);
}
/* 도장 시작 크기(블럭 전체 값) — 모달 슬라이더(#anim-stamp-s0)가 정본 · 저장은 블럭 data-anim-stamp-s0(기본이면 키 없음) */
function _stampS0() {
  const el = document.getElementById('anim-stamp-s0');
  return clampS0(el && el.value !== undefined && el.value !== '' ? el.value : _animTb?.dataset.animStampS0);
}
const _ANIM_IDS = () => ANIM_LIST.map((a) => a.id);
/** 블럭에 저장된 GIF 설정 — 블럭 ▶ 단추(모달 없이)가 이것으로 그린다. */
function _savedState(tb) {
  const n = String(_getTextStyle(tb).text || '').split('\n').length;
  const r = parseAnimGif(tb.dataset.animGif, n);
  const type = _ANIM_IDS().includes(tb.dataset.animFx) ? tb.dataset.animFx : 'slide-up';
  return { perLine: r.perLine, tracks: r.tracks, type, s0: clampS0(tb.dataset.animStampS0), opt: _readOpt(tb), speed: r.perLine ? r.speed : 1 };
}

let _animTb        = null;
let _animType      = 'slide-up';
let _animRafId     = null;
let _animTimeoutId = null;   // setTimeout 전용 (cancelAnimationFrame과 분리)
let _animStart     = null;
let _animLoops     = 0;
let _perLine       = false;   // F3 «줄마다 따로»
let _tracks        = null;    // F3 줄별 트랙(normTracks 결과) — 블럭 data-anim-gif 와 같은 값
/* ══ 0.9.13 MOTION 슬라이드 블럭(현빈 결정 261116: 움직임 입구 = GIF 버튼 → 이 GIF 패널 하나 · 고른 블럭 종류로 효과 목록이 바뀜) ══
   셈·그림은 js/blocks/slide-block.js(window.slidePlan/slidePrepare · 순수 셈 js/fx/slide-motion.js) — 이 엔진은 «종류 갈래» 몇 자리만 둔다:
   openAnimModal · _buildAnimList · _selectAnim · _startAnimPreview · closeAnimModal · _isEmptyText · playAnimOnCanvas · toggleAnimOnCanvas · exportAnimGif. 텍스트 길은 무변. */
let _animKind      = 'text';   // 'text' | 'slide' | 'step'(3단계 신호등 · 그리드)
const SLIDE_LIST = [
  { id: 'slide-flow',  label: '가로 흐름', desc: '사진 줄이 끊김 없이 한 방향으로 흐름' },
  { id: 'slide-swipe', label: '스와이프',  desc: '한 장씩 넘기고 잠깐 머무름' },
  { id: 'slide-vflow', label: '세로 흐름', desc: '사진이 세로로 쌓여 끊김 없이 위·아래로 흐름' },   // 2단계
  { id: 'slide-vstep', label: '세로 넘김', desc: '세로로 한 장씩 올리고 잠깐 머무름' },
  { id: 'slide-fade',  label: '제자리 페이드', desc: '한 장이 꽉 차고 그 자리에서 겹쳐 흐려지며 바뀜' },   // SLIDE-FX-SINGLE-FRAME-MULTI-01
  { id: 'slide-cut',   label: '제자리 컷',     desc: '한 장이 꽉 차고 그 자리에서 바로 바뀜' },
  { id: 'slide-center', label: '가운데 캐러셀', desc: '가운데 한 장 · 양옆 엿보기 · 한 장씩 넘김' },   // SLIDE-FX-CENTER-CAROUSEL-01
  { id: 'slide-wipe',  label: '전후 비교',    desc: '첫째(전)·둘째(후)를 겹치고 나눔선이 좌우로 오감' },   // SLIDE-FX-BEFORE-AFTER-WIPE-01
  { id: 'slide-trail', label: '스와이프 잔상', desc: '한 장씩 넘길 때 지나간 자리에 옅은 잔상' },   // SLIDE-FX-SWIPE-TRAIL-01
  { id: 'slide-gridzoom', label: '격자 줌아웃', desc: '큰 사진 한 장이 작아지며 사진 격자로 멀어짐' },   // SLIDE-FX-GRID-ZOOMOUT-01
];
const _SLIDE_NODWELL = new Set(['slide-wipe', 'slide-gridzoom']);   // 머무름 없음(방향도 없음)
const _SLIDE_INPLACE = new Set(['slide-fade', 'slide-cut', 'slide-center']);   // 방향 칸 없음(가운데 캐러셀은 왼쪽으로만) · 머무름 칸 있음
const _SLIDE_VERT = new Set(['slide-vflow', 'slide-vstep']);
/* 3단계 ③ 신호등(MOTION-STEP-HIGHLIGHT-01) — 그리드 칸 차례 강조. 셈·그림 = js/fx/step-motion.js · 바탕 그림·저장 = js/blocks/grid-step.js */
const STEP_LIST = [
  { id: 'step-fill',    label: '차례 채움',    desc: '칸이 하나씩 강조 색으로 채워지고 나머지는 흐리게' },
  { id: 'step-outline', label: '차례 테두리',  desc: '칸이 하나씩 강조 색 테두리로 켜짐' },
  { id: 'step-pop',     label: '차례 튀어나옴', desc: '칸이 하나씩 조금 커지며 떠오름' },
];
/* 움직임 블럭 종류 표 — 엔진의 갈래 자리(열기·미리보기·캔버스 재생·GIF 저장·빈 판정)는 이 표 한 줄만 본다(텍스트 길은 무변). */
const _MK = {
  slide: { cls: 'slide-block', list: SLIDE_LIST, prepare: (b) => window.slidePrepare?.(b), plan: (b, a, fx) => window.slidePlan(b, a, fx), read: (b) => window.readSlideState(b),
    save: (b, a) => !!window.setSlideAnim?.(b, a), has: (b) => !!window.slideHasPhotos?.(b), emptyTitle: '사진이 없어 GIF 를 만들 수 없습니다 — 오른쪽 패널에서 사진을 넣으세요' },
  step:  { cls: 'grid-block', list: STEP_LIST, prepare: (b) => window.stepPrepare?.(b), plan: (b, a, fx) => window.stepPlan(b, a, fx), read: (b) => window.readStepState(b),
    save: (b, a) => !!window.setStepAnim?.(b, a), has: (b) => !!window.stepHasCells?.(b), emptyTitle: '칸이 없어 GIF 를 만들 수 없습니다' },
};
const _mkOf = (el) => (el && el.classList ? Object.keys(_MK).find((k) => el.classList.contains(_MK[k].cls)) || null : null);
const _isMotion = (el) => !!_mkOf(el);   // 움직임 블럭(슬라이드·신호등)
const _kindList = () => (_MK[_animKind] ? _MK[_animKind].list : ANIM_LIST);
const _slideBgStyle = (tb) => ({ sectionBg: window.slideBg ? window.slideBg(tb) : '#ffffff', fontSize: 1 });
/** 글자 전용 칸 ↔ 슬라이드 칸 — 종류에 따라 숨김/보임(값·저장은 안 건드림). */
function _syncKindRows() {
  const slide = !!_MK[_animKind], step = _animKind === 'step';
  const perRow = document.getElementById('anim-per-line')?.closest?.('.anim-opt-row');
  for (const el of [perRow, document.getElementById('anim-stamp-s0-row'), document.getElementById('anim-stamp-grow')]) if (el) el.style.display = slide ? 'none' : '';
  if (slide) for (const id of ['anim-tracks', 'anim-fx-opts', 'anim-conflict-warn']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  const dirRow = document.getElementById('anim-slide-row'), dwRow = document.getElementById('anim-slide-dwell-row');
  if (dirRow) dirRow.style.display = slide && !step && !_SLIDE_INPLACE.has(_animType) && !_SLIDE_NODWELL.has(_animType) ? '' : 'none';
  if (dwRow) dwRow.style.display = step || (slide && (_animType === 'slide-swipe' || _animType === 'slide-vstep' || _animType === 'slide-trail' || _SLIDE_INPLACE.has(_animType))) ? '' : 'none';
  const dwLab = dwRow?.querySelector?.('.anim-opt-label'); if (dwLab) dwLab.textContent = step ? '한 칸 시간' : '머무름';   // 같은 칸 · 신호등이면 글만
  const trRow = _trailRow(); if (trRow) trRow.style.display = slide && _animType === 'slide-trail' ? '' : 'none';
  const pastRow = document.getElementById('anim-step-past-row'); if (pastRow) pastRow.style.display = step ? '' : 'none';
  /* 방향 값은 그대로(left = 줄이 음의 쪽으로) — 세로 효과면 글만 위로/아래로 */
  const dirSel = document.getElementById('anim-slide-dir'), v = _SLIDE_VERT.has(_animType);
  if (slide && dirSel) for (const o of dirSel.options) o.textContent = o.value === 'right' ? (v ? '↓ 아래로' : '→ 오른쪽으로') : (v ? '↑ 위로' : '← 왼쪽으로');
}
/* SLIDE-FX-SWIPE-TRAIL-01 «세기 조절»(83 · 지디 261120) — 잔상 세기 줄 = 공용 sliderRowHTML(슬라이더+숫자) · 처음 쓸 때 한 번 채우고 bindSlider 로 맞물림.
   이력·저장은 다른 슬라이드 칸과 같은 길(setSlideAnimOpt: 끌기 중 미리보기 · 놓을 때 한 칸) — bindSlider 자체 이력·자동저장은 끈다(두 번 안 쌓이게). */
function _trailRow() {
  const row = document.getElementById('anim-slide-trail-row');
  if (row && !row.firstElementChild) {
    row.innerHTML = sliderRowHTML('잔상 세기', 'anim-slide-trail', 'anim-slide-trail-num', { min: 0, max: TRAIL_MAX, step: 1, value: SLIDE_ANIM_DEFAULT.trail });
    const sl = document.getElementById('anim-slide-trail'), nu = document.getElementById('anim-slide-trail-num');
    sl.title = nu.title = '스와이프 잔상 — 넘길 때 지나간 자리 잔상의 진하기(%) · 0 = 잔상 없음 · 캔버스·GIF 같이';
    bindSlider(sl, nu, () => setSlideAnimOpt(false), { min: 0, max: TRAIL_MAX, history: false, autosave: false });
    sl.addEventListener('change', () => setSlideAnimOpt(true));
    nu.addEventListener('change', () => setSlideAnimOpt(true));
  }
  return row;
}
/** GIF 패널 지금 값(슬라이드) — 방향·머무름·속도·잔상 세기. */
function _slideAnimNow() {
  return {
    dir: document.getElementById('anim-slide-dir')?.value === 'right' ? 'right' : 'left',
    dwell: parseFloat(document.getElementById('anim-slide-dwell')?.value) || 1.2,
    speed: parseFloat(document.getElementById('anim-speed')?.value) || 1,
    past: document.getElementById('anim-step-past')?.value === 'stack' ? 'stack' : 'off',   // 신호등만 읽는다(슬라이드 소독이 버림)
    trail: parseFloat(document.getElementById('anim-slide-trail')?.value),   // 없거나 비면 NaN → normAnim 기본(22)
  };
}
/** 슬라이드 움직임 값 저장(블럭 data-anim-slide) — commit = 이력 한 칸(바뀌었을 때만). index.html 방향·머무름 칸 인라인이 부른다. */
function setSlideAnimOpt(commit = true) {
  const lab = document.getElementById('anim-slide-dwell-val'), dw = document.getElementById('anim-slide-dwell');
  if (lab && dw) lab.textContent = `${(+dw.value).toFixed(1)}초`;
  _syncKindRows();
  restartAnimPreview();
  return commit ? _saveSlideAnim() : false;
}
function _saveSlideAnim() {
  const mk = _MK[_mkOf(_animTb)];
  if (!mk) return false;
  const changed = mk.save(_animTb, _slideAnimNow());
  if (changed) { window.pushHistory?.('GIF 슬라이드'); window.scheduleAutoSave?.(); }
  return changed;
}
function _openSlideModal(tb) {
  const st = _MK[_animKind].read(tb);
  _animType = st.fx;
  _perLine = false; _tracks = null; _animOpt = {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
  if (st.anim.dir) set('anim-slide-dir', st.anim.dir);
  if (st.anim.past) set('anim-step-past', st.anim.past);
  set('anim-slide-dwell', st.anim.dwell); set('anim-speed', st.anim.speed);
  if (_trailRow()) { const tr = st.anim.trail ?? SLIDE_ANIM_DEFAULT.trail; set('anim-slide-trail', tr); set('anim-slide-trail-num', tr); }
  const sv = document.getElementById('anim-speed-val'); if (sv) sv.textContent = st.anim.speed + 'x';
  const dv = document.getElementById('anim-slide-dwell-val'); if (dv) dv.textContent = `${(+st.anim.dwell).toFixed(1)}초`;
  _buildAnimList();
  _selectAnim(_animType);
  _applyEmptyGate(document.querySelector('.anim-export-btn'));
}
let _slidePrevToken = 0;
/** 슬라이드 미리보기 — 그림 준비(IPC data URL) 뒤 끊김 없이 돈다(끝 멈춤 0 · GIF 와 같은 계획). */
function _startSlidePreview() {
  const canvas = document.getElementById('anim-preview-canvas'), tb = _animTb, token = ++_slidePrevToken;
  const mk = _MK[_animKind];
  if (!canvas || !tb || !mk) return;
  Promise.resolve(mk.prepare(tb)).then(() => {
    if (token !== _slidePrevToken || _animTb !== tb) return;
    const bW = Math.max(tb.offsetWidth, 1), bH = Math.max(tb.offsetHeight, 1);
    canvas.width = 480; canvas.height = Math.max(40, Math.round(480 * bH / bW));
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, style = _slideBgStyle(tb);
    const plan = mk.plan(tb, _slideAnimNow(), _animType);
    const info = document.getElementById('anim-loop-info');
    if (info) info.textContent = plan.info;
    _animStart = null;
    const tick = (ts) => {
      if (token !== _slidePrevToken) return;
      if (_animStart == null) _animStart = ts;
      ctx.clearRect(0, 0, W, H);
      _fillBg(ctx, style, W, H);
      plan.draw(ctx, W, H, 0, ((ts - _animStart) % plan.duration) / plan.duration);
      _animRafId = requestAnimationFrame(tick);
    };
    _animRafId = requestAnimationFrame(tick);
  });
}

/* ══ F3 줄마다 따로(현빈 GO 261114 · P076 = 질문 «타이핑» · 답 «도장») ══
   저장 = 텍스트 블럭 data-anim-gif(js/fx/anim-gif-tracks.js parseAnimGif/serializeAnimGif — 글 내용은 저장 안 함) · 값이 바뀔 때만 쓰고 이력 한 칸.
   «줄» = 글의 명시 줄바꿈 한 줄(화면에서 접힌 조각은 같은 트랙) · 줄 글은 textContent 로만 보인다. */
const _fxLabel = (id) => (ANIM_LIST.find((a) => a.id === id) || {}).label || id;
function _lineTexts() { return _animTb ? String(_getTextStyle(_animTb).text || '').split('\n') : ['']; }
function _loadAnimGif() {
  const r = parseAnimGif(_animTb?.dataset.animGif, _lineTexts().length);
  _perLine = r.perLine; _tracks = r.tracks;
  if (r.perLine) {
    const sp = document.getElementById('anim-speed'), rp = document.getElementById('anim-repeat');
    if (sp) { sp.value = String(r.speed); const v = document.getElementById('anim-speed-val'); if (v) v.textContent = r.speed + 'x'; }
    if (rp) { rp.value = String(r.repeat); const v = document.getElementById('anim-repeat-val'); if (v) v.textContent = r.repeat + '회'; }
  }
  const cb = document.getElementById('anim-per-line');
  if (cb) cb.checked = _perLine;
  _renderTrackRows();
}
function _saveAnimGif(push = true) {
  if (!_animTb) return false;
  const next = (_perLine && _tracks)
    ? serializeAnimGif({ tracks: _tracks, speed: parseFloat(document.getElementById('anim-speed')?.value) || 1, repeat: parseInt(document.getElementById('anim-repeat')?.value) || 1 })
    : null;
  if ((_animTb.dataset.animGif ?? null) === next) return false;   // 안 바뀌면 이력도 안 쌓는다
  if (next) _animTb.dataset.animGif = next; else delete _animTb.dataset.animGif;
  if (push) { window.pushHistory?.('GIF 줄별 효과'); window.scheduleAutoSave?.(); }
  return true;
}
/** 효과·줄별·도장 크기를 바꾼 «한 동작» = 이력 한 칸 — 저장 꼴 + 블럭 높이 늘림(_fitStampHeight)을 같이 찍는다(⌘Z 한 걸음에 둘 다 돌아감). */
function _commitGif(changed = false) {
  const a = _saveAnimGif(false), b = _animKind === 'text' ? _fitStampHeight() : false;
  if (changed || a || b) { window.pushHistory?.('GIF 효과'); window.scheduleAutoSave?.(); }
}
/* ══ 도장이 블럭을 넘으면 블럭 높이를 늘려 담는다(현빈 재QA 261116 «시작 크기가 커지면 블럭의 높이도 커지게») ══
   화면 «캔버스에서 보기»·저장 GIF 둘 다 블럭 W×H 캔버스 ⇒ 블럭이 커지면 둘이 같이 커진다(화면==GIF · 잘림 0 · 약해짐 0).
   늘림 = 위아래 패딩을 같은 만큼 더함(글 가운데 그대로) · 더한 몫은 data-anim-gif-grow(한쪽 px)에 적어 다음 셈에서 빼고 다시 잰다 ⇒ 효과를 바꾸거나 크기를 줄이면 도로 줄어든다.
   부르는 자리 = 사람이 효과·줄별·도장 크기를 바꿀 때만(_commitGif) — 모달을 열기만 해서는 안 바뀐다. 가로는 못 늘린다(폭 = 레이아웃) — FX.stamp 가 긴 줄만 폭까지. */
function _fitStampHeight() {
  const tb = _animTb;
  if (!tb) return false;
  const style = _getTextStyle(tb), n = String(style.text || '').split('\n').length, s0 = _stampS0();
  const trs = _perLine && _tracks ? _withS0(normTracks(_tracks, n), s0) : (_animType === 'stamp' ? Array.from({ length: n }, (_, i) => ({ line: i, fx: 'stamp', s0 })) : []);
  const need = stampNeedH(style, trs, style.fontSize);
  const g0 = Math.max(0, parseInt(tb.dataset.animGifGrow, 10) || 0);
  const h0 = Math.max(0, (tb.offsetHeight || 0) - 2 * g0);
  const g = need > h0 ? Math.ceil((need - h0) / 2) : 0;
  _showGrow(g);
  if (g === g0) return false;
  const cs = getComputedStyle(tb);
  tb.style.paddingTop = `${Math.max(0, (parseFloat(cs.paddingTop) || 0) - g0 + g)}px`;
  tb.style.paddingBottom = `${Math.max(0, (parseFloat(cs.paddingBottom) || 0) - g0 + g)}px`;
  if (g) tb.dataset.animGifGrow = String(g); else delete tb.dataset.animGifGrow;
  return true;
}
function _showGrow(g) {
  const el = document.getElementById('anim-stamp-grow');
  if (el) el.textContent = g ? `블럭 높이 +${g * 2}px — 도장 시작 크기에 맞춰 늘림(⌘Z 로 되돌림)` : '';
}
/* «도장 시작» 줄은 도장일 때만(현빈 재QA 261116 «왜 다른 효과에도 있냐») — 블럭 효과 = 도장 · 또는 줄마다 따로에 도장 줄이 하나라도.
   숨김만 — 저장 키(data-anim-stamp-s0)·슬라이더 값은 그대로(도장으로 돌아오면 그 값). 미리보기 시작마다 부른다(효과·줄 효과·줄마다 켬/끔이 다 거기로 온다). */
function _syncStampRow() {
  const row = document.getElementById('anim-stamp-s0-row');
  if (row) row.style.display = (_perLine ? (_tracks || []).some((t) => t.fx === 'stamp') : _animType === 'stamp') ? '' : 'none';
}
/** 모달 «도장 시작» 슬라이더 — 끄는 동안(commit false)은 미리보기만 · 놓으면 저장 + 높이 + 이력 한 칸. */
function setAnimStampS0(v, commit) {
  const s0 = clampS0(v);
  const lab = document.getElementById('anim-stamp-s0-val');
  if (lab) lab.textContent = s0 + '배';
  if (_perLine && _tracks) _renderTrackRows();   // 줄 칸의 «블럭 값» 표시도
  restartAnimPreview();
  if (!commit || !_animTb) return;
  const key = s0 === S0_DEFAULT ? null : String(s0), had = _animTb.dataset.animStampS0 ?? null;
  if (key) _animTb.dataset.animStampS0 = key; else delete _animTb.dataset.animStampS0;
  _commitGif(had !== key);
}
function setAnimPerLine(on) {
  _perLine = !!on;
  if (_perLine && !_tracks) _tracks = normTracks(null, _lineTexts().length, { fx: TRACK_FX.includes(_animType) ? _animType : 'fade-in', dur: 1000 });
  _renderTrackRows();
  _renderBlockOpts();
  _commitGif();
  restartAnimPreview();
}
function _renderTrackRows() {
  const box = document.getElementById('anim-tracks');
  const list = document.getElementById('anim-list');
  if (list) list.classList.toggle('is-off', _perLine);   // 줄마다 따로일 땐 왼쪽 목록(블럭 전체 한 효과)은 쉰다
  if (!box) return;
  box.style.display = _perLine ? '' : 'none';
  box.textContent = '';
  if (!_perLine || !_tracks) return;
  const texts = _lineTexts();
  _tracks = normTracks(_tracks, texts.length);
  const T = Math.max(1, totalMs(_tracks)), hasHl = _hasHl(_animTb);
  _tracks.forEach((tr, i) => {
    const row = document.createElement('div'); row.className = 'anim-track-row'; row.dataset.line = String(i);
    const lab = document.createElement('span'); lab.className = 'anim-track-label'; lab.textContent = (texts[i] || '').slice(0, 12) || '(빈 줄)'; lab.title = texts[i] || '';
    const sel = document.createElement('select'); sel.className = 'anim-track-fx';
    for (const id of TRACK_FX) { const o = document.createElement('option'); o.value = id; o.textContent = _fxLabel(id); o.selected = id === tr.fx; sel.appendChild(o); }
    const num = (cls, v, min, max, title) => { const n = document.createElement('input'); n.type = 'number'; n.className = cls; n.min = String(min); n.max = String(max); n.step = '50'; n.value = String(v); n.title = title; return n; };
    const atIn = num('anim-track-at', tr.at, 0, AT_MAX, '시작(ms)'), durIn = num('anim-track-dur', tr.dur, DUR_MIN, DUR_MAX, '길이(ms)');
    let s0In = null;   // 도장 줄만 — 그 줄 시작 크기(비우면 블럭 값)
    if (tr.fx === 'stamp') { s0In = num('anim-track-s0', tr.s0 ?? '', S0_MIN, S0_MAX, `도장 시작 크기(배) — 비우면 블럭 값 ${_stampS0()}배`); s0In.step = '0.1'; s0In.placeholder = String(_stampS0()); }
    const bar = document.createElement('div'); bar.className = 'anim-track-bar';
    const seg = document.createElement('span'); seg.className = 'anim-track-seg';
    seg.style.left = `${(tr.at / T) * 100}%`; seg.style.width = `${(tr.dur / T) * 100}%`;
    bar.appendChild(seg);
    const apply = () => {
      _tracks[i] = { line: i, fx: sel.value, at: Number(atIn.value), dur: Number(durIn.value), s0: s0In && s0In.value !== '' ? Number(s0In.value) : undefined, o: tr.o };
      _tracks = normTracks(_tracks, texts.length);   // 범위 고정(소독과 같은 문)
      _renderTrackRows(); _commitGif(); restartAnimPreview();
    };
    sel.addEventListener('change', apply); atIn.addEventListener('change', apply); durIn.addEventListener('change', apply);
    if (s0In) s0In.addEventListener('change', apply);
    const opts = _optControls(tr.fx, tr.o, (k, v) => {   // GIF V3 줄 옵션 — 같은 칸 부품
      const o = { ...(tr.o || {}), [k]: v }; if (v === null) delete o[k];
      _tracks[i] = { ...tr, o };
      _tracks = normTracks(_tracks, texts.length);
      _renderTrackRows(); _commitGif(); restartAnimPreview();
    }, hasHl);
    row.append(lab, sel, atIn, durIn, ...(s0In ? [s0In] : []), ...(opts.optCount ? [opts] : []), bar);
    box.appendChild(row);
  });
}

function openAnimModal(tb) {
  // BUG-FIX: tb null 가드 — null/undefined면 모달 열지 않음
  if (!tb) { console.warn('[AnimGif] openAnimModal: tb is null, skipped'); return; }
  _animTb = tb;
  const modal = document.getElementById('anim-gif-modal');
  modal.style.display = 'flex';
  _bindModalOverlay(modal);
  _animKind = _mkOf(tb) || 'text';
  _syncKindRows();
  if (_MK[_animKind]) { _openSlideModal(tb); return; }

  // BUG-FIX: _animType을 먼저 초기화하고 buildAnimList 호출해야
  // _buildAnimList 내부 active 표시가 올바른 초기값을 반영함
  _animType = _ANIM_IDS().includes(tb.dataset.animFx) ? tb.dataset.animFx : 'slide-up';   // 블럭 전체 효과도 블럭에 남긴다(data-anim-fx · 블럭 ▶ 단추가 읽는다)
  const s0El = document.getElementById('anim-stamp-s0'), s0 = clampS0(tb.dataset.animStampS0);
  if (s0El) s0El.value = String(s0);
  const s0Lab = document.getElementById('anim-stamp-s0-val');
  if (s0Lab) s0Lab.textContent = s0 + '배';
  _showGrow(Math.max(0, parseInt(tb.dataset.animGifGrow, 10) || 0));
  _animOpt = _readOpt(tb);   // GIF V3 블럭 전체 옵션
  _loadAnimGif();   // F3 — 저장된 줄별 효과가 있으면 그것으로(미리보기도)
  _buildAnimList();
  // _selectAnim은 _buildAnimList 후에 호출 (active 토글 + preview 시작)
  _selectAnim(_animType);
  _applyEmptyGate(document.querySelector('.anim-export-btn'));
}
// BUG-FIX: 오버레이 바깥 클릭으로 닫기 (한 번만 등록) — 슬라이드 갈래도 같이 쓰게 함수로 뺌(동작 무변)
function _bindModalOverlay(modal) {
  if (modal._overlayClickBound) return;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAnimModal();
  });
  modal._overlayClickBound = true;
}

function closeAnimModal() {
  if (_MK[_animKind]) _saveSlideAnim(); else   // 슬라이드 = 속도 등 지금 값 저장(바뀌었을 때만 이력)
  _saveAnimGif();   // F3 — 속도·반복을 바꾼 채 닫으면 그 값도(안 바뀌었으면 무동작)
  document.getElementById('anim-gif-modal').style.display = 'none';
  _stopAnimPreview();
}

/* ══ PLAY-ON-CANVAS-01 캔버스에서 보기(현빈: «gif 효과가 섹션에서 어울리는지 보기 위해서») ══
   그 블럭 «자리»에 같은 엔진(_planOf · 줄바꿈·부분 꾸밈 그대로)으로 그린 캔버스를 덮어 «끝없이» 반복 재생(현빈 재QA 261116 «계속 플레이되면 좋겠고»).
   ⛔글 DOM 무변 · 덮개·단추는 #canvas 밖 ⇒ 저장(serializeProject)·PNG/HTML/Figma·GIF·⌘Z 에 흔적 0.
   ★뒤집음(현빈 QA 스샷 #47 · NEW-현빈QA-GIF-PLAY-OVERLAY-LAYER-SIZE-01): 1판 body 직속 fixed z 2147483000 → 중앙 플로팅·우측 패널 위로 뜨고
   선택 테두리 층(#ss-handles-overlay · #canvas-area 격리 안 z 9990)까지 덮어 «재생 중 블럭이 안 골라지는» 것처럼 보였다 · 단추는 배율 무관 30px.
   ⇒ 이제 #canvas-scaler 층(_canvasLayer · 캔버스 줌 transform 안 · #canvas 형제): 배율 따라 크기(에셋 ✕ 와 같은 30 캔버스px) · 캔버스 스크롤·자르기 ·
   패널 아래 · 선택 테두리가 그 위. 매 프레임 블럭 자리를 scaler 좌표로 맞춘다(_toLayer).
   끝 = 블럭 ⏸ 단추 · Esc(멈춤에만 쓰고 에디터로 안 넘김) · 블럭 편집(더블클릭 → .editing) · 블럭이 사라짐. 다른 곳 클릭은 안 끝낸다(에디터로 그대로).
   시작 = 모달 «캔버스에서 보기»(모달 지금 값) · 블럭 ▶ 단추(블럭에 저장된 값 · _savedState).
   shortcut: 회전·자유변형 블럭은 기울지 않은 테두리 상자에 덮는다 · 바탕은 섹션 단색(GIF 와 같은 규칙) — 필요해지면 transform 복사. */
const _PLAY_K = 2;   // GIF 저장과 같은 배율(블럭 1px = 2 캔버스 px)
let _onCanvas = null;
const _canvasLayer = () => document.getElementById('canvas-scaler');
/** 화면 사각형 → #canvas-scaler 안 좌표(줌 전 캔버스 px · section-search.js 깜빡이 덮개와 같은 셈). */
function _toLayer(r) {
  const sr = _canvasLayer().getBoundingClientRect(), sw = _canvasLayer().offsetWidth, k = sw ? sr.width / sw : 1;
  return { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k };
}
function playAnimOnCanvas() {
  if (!_animTb || _isEmptyText(_animTb)) return;
  if (_isMotion(_animTb)) {   // 슬라이드 — 닫기 전에 지금 패널 값으로 고정 · 그림 준비 뒤 같은 덮개
    const tb = _animTb, anim = _slideAnimNow(), fx = _animType;
    closeAnimModal();
    const mk = _MK[_mkOf(tb)];
    Promise.resolve(mk.prepare(tb)).then(() => { if (tb.isConnected) _startCanvasPlay(tb, mk.plan(tb, anim, fx), _slideBgStyle(tb)); });
    return;
  }
  const tb = _animTb, style = _getTextStyle(tb);
  const speed = parseFloat(document.getElementById('anim-speed')?.value) || 1;
  const plan = _plan(style, speed, _PLAY_K);   // 닫기 전에 — 지금 효과·줄별 트랙으로 고정
  closeAnimModal();
  _startCanvasPlay(tb, plan, style);
}
/** 블럭 ▶/⏸ — 그 블럭이 재생 중이면 끝, 아니면 저장된 설정으로 시작. */
function toggleAnimOnCanvas(tb) {
  if (!tb) return;
  if (_onCanvas && _onCanvas.tb === tb) { stopAnimOnCanvas(); return; }
  if (_isEmptyText(tb)) return;
  const mk = _MK[_mkOf(tb)];
  if (mk) { Promise.resolve(mk.prepare(tb)).then(() => { if (tb.isConnected) _startCanvasPlay(tb, mk.plan(tb), _slideBgStyle(tb)); }); return; }
  const style = _getTextStyle(tb), st = _savedState(tb);
  _startCanvasPlay(tb, _planOf(st, style, st.speed, _PLAY_K), style);
}
function _startCanvasPlay(tb, plan, style) {
  stopAnimOnCanvas();
  const cv = document.createElement('canvas');
  cv.id = 'anim-canvas-play';
  cv.width = Math.round(Math.max(tb.offsetWidth, 1) * _PLAY_K);
  cv.height = Math.round(Math.max(tb.offsetHeight, 1) * _PLAY_K);
  cv.style.cssText = 'position:absolute;pointer-events:none;z-index:80;';   // scaler 안 — 섹션(z 2) 위 · 연결선(90)·스크래치(100) 아래
  _canvasLayer().appendChild(cv);
  const ctx = cv.getContext('2d'), size = Math.round(style.fontSize * _PLAY_K), cycle = plan.duration + (plan.hold ?? 1500);   // 끝에서 1.5초 멈춤(미리보기와 같음)
  let t0 = null;
  const tick = (ts) => {
    if (!_onCanvas || _onCanvas.cv !== cv) return;   // 이 재생이 이미 끝났다(멈춘 뒤 늦게 온 프레임 · 다음 재생으로 바뀜) — 그리지 않는다
    if (!tb.isConnected || tb.classList.contains('editing')) { stopAnimOnCanvas(); return; }   // 블럭이 사라짐 · 편집 들어감 = 끝
    const r = _toLayer(tb.getBoundingClientRect());
    Object.assign(cv.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    if (t0 == null) t0 = ts;
    cv.dataset.loops = String(Math.floor((ts - t0) / cycle));   // 몇 바퀴 돌았나(시험이 «끝없는 반복»을 읽는다 · 덮개는 #canvas 밖이라 저장 0)
    const t = Math.min(((ts - t0) % cycle) / plan.duration, 1);
    ctx.clearRect(0, 0, cv.width, cv.height);
    _fillBg(ctx, style, cv.width, cv.height);
    plan.draw(ctx, cv.width, cv.height, size, t);
    _placePlayBtn();
    _onCanvas.raf = requestAnimationFrame(tick);
  };
  /* Esc 만 끝 — 멈춤에만 쓰고 에디터로 안 넘긴다(Esc 가 선택 해제까지 타서 #canvas HTML 이 바뀌었다 · 아이맥 001ae0374+C9 P1). 다른 키·클릭은 그대로 에디터로. */
  const stop = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault(); e.stopImmediatePropagation();
    stopAnimOnCanvas();
  };
  window.addEventListener('keydown', stop, true);
  _onCanvas = { cv, tb, stop, raf: 0 };
  _onCanvas.raf = requestAnimationFrame(tick);
  _placePlayBtn();
}
function stopAnimOnCanvas() {
  if (!_onCanvas) return;
  const { cv, stop, raf } = _onCanvas;
  _onCanvas = null;
  cancelAnimationFrame(raf);
  window.removeEventListener('keydown', stop, true);
  cv.remove();
  _placePlayBtn();
}

/* ══ 블럭 ▶/⏸ 단추(현빈 재QA 261116 «에셋블럭 x버튼 위치에 플레이/퍼즈 버튼» · 지디 판정 (나)) ══
   GIF 효과가 있는 텍스트 블럭(data-anim-fx · data-anim-gif)에 마우스를 올리거나 골랐을 때만(재생 중도 같음 · 에셋 ✕ 규칙) — 블럭 오른쪽 위.
   겉모습 = 에셋 ✕(.asset-overlay-clear 절 · css/editor-blocks.css 에 .anim-tb-play 를 같이 걸었다) · 자리 = 블럭 오른쪽 위 10px.
   ⛔블럭 DOM 에 안 넣는다 — #canvas-scaler 의 단추 하나를 옮겨 다닌다(배율 따라 크기 = 에셋 ✕)(텍스트 블럭은 글을 textContent·AI 채우기·직렬화로 읽는다 ⇒ 안에 넣으면 거기 다 섞인다). 그래서 저장·PNG·HTML·Figma·GIF 에 구조적으로 0. */
let _playBtn = null, _hoverTb = null;
const _hasGif = (tb) => !!(tb && tb.isConnected && (tb.dataset.animFx || tb.dataset.animGif));
/* ★뒤집음(현빈 추가 261116 · 135행): 재생 중에도 «늘» 띄우던 갈래를 걷었다 — 에셋 ✕ 와 같은 노출(올렸을 때 · 골랐을 때)만.
   재생 중인 블럭은 GIF 키가 없어도(모달 «캔버스에서 보기») 대상 — 올리면 ⏸ 로 끝낼 수 있게. */
function _playTarget() {
  const ok = (t) => _hasGif(t) || !!(_onCanvas && t === _onCanvas.tb && t.isConnected);
  if (ok(_hoverTb)) return _hoverTb;
  const sel = document.querySelector('#canvas .text-block.selected, #canvas .slide-block.selected, #canvas .grid-block.selected');
  return ok(sel) ? sel : null;
}
function _placePlayBtn() {
  const tb = _playTarget();
  if (!tb) { if (_playBtn) _playBtn.style.display = 'none'; return; }
  if (!_playBtn) {
    _playBtn = document.createElement('button');
    _playBtn.id = 'anim-tb-play';
    _playBtn.className = 'anim-tb-play';
    _playBtn.type = 'button';
    _playBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });   // 선택 해제·끌기로 안 번지게
    _playBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleAnimOnCanvas(_playBtn._tb); });
    _canvasLayer().appendChild(_playBtn);
  }
  const playing = !!(_onCanvas && _onCanvas.tb === tb);
  _playBtn._tb = tb;
  _playBtn.textContent = playing ? '⏸' : '▶';
  _playBtn.title = playing ? '캔버스 재생 끝 (Esc)' : '캔버스에서 반복 재생';
  const r = _toLayer(tb.getBoundingClientRect());   // 에셋 ✕ 와 같은 캔버스 px 자리(오른끝−40 · 위+10) — 크기 30 은 CSS 절 그대로 줌에 따라
  Object.assign(_playBtn.style, { display: 'flex', position: 'absolute', zIndex: '81', opacity: '1', left: `${r.x + r.w - 40}px`, top: `${r.y + 10}px`, right: 'auto' });
}
/* 마우스가 블럭 위로 — 단추 자체 위에선 대상 유지(누르러 가는 길에 사라지지 않게) · 스크롤·휠·클릭 뒤 자리·대상 다시 */
document.addEventListener?.('pointermove', (e) => {
  if (_playBtn && e.target === _playBtn) return;
  _hoverTb = e.target && e.target.closest ? e.target.closest('#canvas .text-block, #canvas .slide-block, #canvas .grid-block') : null;
  _placePlayBtn();
}, true);
for (const t of ['scroll', 'wheel', 'pointerup', 'click', 'keyup']) document.addEventListener?.(t, () => _placePlayBtn(), true);

function _buildAnimList() {
  const list = document.getElementById('anim-list');
  /* ★이름·설명은 틀에 안 넣는다 (T-049) — 지금은 이 파일의 고정 목록이지만, 「목록이
     고정이다」는 옆 파일이 바뀌면 끝나는 전제다. 어차피 아래에서 한 줄씩 훑으므로 비용이 0. */
  const LIST = _kindList();   // 텍스트 = 글자 효과 · 슬라이드 = 흐름·스와이프
  list.innerHTML = LIST.map(a => `
    <div class="anim-item${a.id === _animType ? ' active' : ''}" data-id="${a.id}">
      <div class="anim-item-name"></div>
      <div class="anim-item-desc"></div>
    </div>
  `).join('');
  list.querySelectorAll('.anim-item').forEach((el, i) => {
    el.querySelector('.anim-item-name').textContent = LIST[i].label;
    el.querySelector('.anim-item-desc').textContent = LIST[i].desc;
    el.addEventListener('click', () => {   // 사람이 고름 = 블럭에 남김(data-anim-fx) + 도장이면 높이 맞춤 · 이력 한 칸
      _selectAnim(el.dataset.id);
      if (!_animTb) return;
      const had = _animTb.dataset.animFx ?? null;
      _animTb.dataset.animFx = el.dataset.id;
      if (_animKind === 'slide' && had !== el.dataset.id) window.renderSlideBlock?.(_animTb);   // 2단계 — 가로↔세로면 정적 첫 장면도 바뀐다
      const optChanged = _animKind === 'text' ? _saveBlockOpt() : false;   // 옵션은 그 효과가 받는 키만 남긴다(슬라이드엔 글자 옵션 없음)
      _commitGif(had !== el.dataset.id || optChanged);
    });
  });
}

function _selectAnim(id) {
  _animType = id;
  document.querySelectorAll('.anim-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === id));
  if (_MK[_animKind]) { _syncKindRows(); _startAnimPreview(); return; }
  _updateAnimConflictWarning();
  _renderBlockOpts();   // GIF V3 — 이 효과가 받는 옵션 칸
  _startAnimPreview();
}

function _updateAnimConflictWarning() {
  const warn = document.getElementById('anim-conflict-warn');
  if (!warn || !_animTb) return;
  const conflictTypes = ['count-up', 'slot-machine'];
  const style = _getTextStyle(_animTb);
  const hasMultiline = style.text.includes('\n');
  warn.style.display = (conflictTypes.includes(_animType) && hasMultiline) ? 'flex' : 'none';
}

function restartAnimPreview() {
  _startAnimPreview();
}

function _stopAnimPreview() {
  _slidePrevToken++;   // 슬라이드 미리보기 — 그림 준비가 늦게 와도 멈춘 뒤엔 안 그린다
  if (_animRafId)     { cancelAnimationFrame(_animRafId); _animRafId = null; }
  if (_animTimeoutId) { clearTimeout(_animTimeoutId); _animTimeoutId = null; }
  _animStart = null;
  _animLoops = 0;
}

function _extractText(el) {
  // innerHTML 기반으로 줄바꿈을 안정적으로 추출
  const html = el.innerHTML || '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')       // <br> → 줄바꿈
    .replace(/<div/gi, '\u0001<div')     // <div>·<p> 시작 = «새 줄 시작» 표(아래에서 줄바꿈으로)
    .replace(/<p(?=[\s>])/gi, '\u0001<p')
    .replace(/<[^>]+>/g, '')             // 모든 태그 제거
    .replace(/(^|\n)\u0001+/g, '$1').replace(/\u0001+/g, '\n')   // 블럭 시작은 «이미 줄 처음이면» 줄바꿈 0 · 겹 div(<div><div>) = 하나(NEW-현빈QA-GIF-BROKEN-AFTER-LINEBREAK-EDIT-01 · 옛: 겹마다 \n 이라 빈 줄이 생겨 캔버스 재생 두 줄이 벌어지고 잘렸다)
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')          // 3개 이상 연속 줄바꿈 → 최대 2개
    .replace(_EDGE_WS, '')                // 앞뒤 «접히는» 공백만 깎는다 — &nbsp; 는 화면에 자리를 차지하므로 남김(NEW-현빈QA-GIF-HL-LEADING-SPACE-LOST-01 · 옛 .trim() 은 \u00a0 도 깎아 앞 빈칸 형광펜이 빠졌다)
    .replace(/\u00a0/g, ' ') || el.textContent?.trim() || 'Sample Text';
}

const _EDGE_WS = /^[ \t\r\n]+|[ \t\r\n]+$/g;   // 접히는 공백(빈칸·탭·줄바꿈) — \u00a0 은 빼고
/* 조각 스타일 cs(RICHTEXT-EFFECTS-01) — _extractText 와 «같은 글»을 DOM 을 걸어 만들고, 글자마다 그 글자를 감싼 요소의 스타일.
   같은 규칙: br = 줄바꿈 · div/p 시작 = 줄 처음이 아니면 줄바꿈(겹 div 는 하나) · nbsp = 빈칸 · 줄바꿈 셋 이상 = 둘 · 앞뒤 «접히는» 공백만 깎기(nbsp 는 남김). 결과 글이 text 와 다르면 null(평글로 그린다). */
function _extractCs(el, text) {
  if (!el.childNodes) return null;
  const memo = new Map();
  const st = (host) => { if (!host) return null; if (!memo.has(host)) memo.set(host, _runStyle(host, el)); return memo.get(host); };
  let raw = '';
  const rc = [];
  const walk = (node, host) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { const d = n.data; raw += d; for (let i = 0; i < d.length; i++) rc.push(st(host)); }
      else if (n.nodeType === 1) {
        if (n.tagName === 'BR') { raw += '\n'; rc.push(null); continue; }
        if ((n.tagName === 'DIV' || n.tagName === 'P') && raw && !raw.endsWith('\n')) { raw += '\n'; rc.push(null); }   // _extractText 의 블럭 시작 표와 같은 규칙
        walk(n, n);
      }
    }
  };
  walk(el, el);   // 글 요소에 바로 든 글도 el 의 장식(블럭 전체 밑줄 등)을 읽는다 — 나머지는 el 과 같아 null
  let t = '';
  const c = [];
  for (let i = 0; i < raw.length; i++) { if (raw[i] === '\n' && t.endsWith('\n\n')) continue; t += raw[i]; c.push(rc[i]); }
  const a = t.length - t.replace(/^[ \t\r\n]+/, '').length, b = t.length - t.replace(/[ \t\r\n]+$/, '').length;
  if (t.slice(a, Math.max(a, t.length - b)).replace(/\u00a0/g, ' ') !== text) return null;
  const cs = c.slice(a, c.length - b);
  return cs.some(Boolean) ? cs : null;
}
/* 한 요소의 조각 스타일(계산된 스타일) — 블럭 글 요소와 다 같으면 null.
   C2 글자색·굵기·기울임·크기 비 · C3 밑줄(ul)·취소선(lt)·형광펜(hl · span.tb-hl 변수)·배경색(bg · 옛 hiliteColor span) ·
   C4 그림자(shadows · text-shadow 는 상속 ⇒ host 의 계산값 하나가 범위 글로우 span.tb-glow · 블럭 글로우 · Shadow 절을 다 담는다) ·
   C5 방점(dot · span.tb-dot::before 의 «계산된» 크기·색·transform — 변수·currentColor·-50% 가 이미 px 로 풀려 있다). */
const _italic = (cs) => /italic|oblique/.test(cs.fontStyle || '');
/* 글자 «칠» — 채움색(-webkit-text-fill-color)이 있으면 그것(그라데이션 블럭의 부분 단색 span 이 이걸로 단색을 지킨다) ·
   투명이면 null(= 블럭 그라데이션을 받는다 ⑫) · 없으면 color. */
const _paint = (c) => { const f = c.webkitTextFillColor; return f && /^(transparent|rgba\(0, 0, 0, 0\))$/.test(f) ? null : f || c.color; };
const _cssVar = (c, name) => String((c.getPropertyValue && c.getPropertyValue(name)) || '').trim();
const _line = (c) => ({
  color: c.textDecorationColor || c.color,
  thick: parseFloat(c.textDecorationThickness) || 0,                                              // 0 = auto
  off: c.textUnderlineOffset && c.textUnderlineOffset !== 'auto' ? parseFloat(c.textUnderlineOffset) || 0 : null,   // null = auto
});
function _runStyle(host, el) {
  const h = window.getComputedStyle(host), b = window.getComputedStyle(el);
  const sizeK = (parseFloat(h.fontSize) || 0) / (parseFloat(b.fontSize) || 1) || 1;
  const st = { color: _paint(h), weight: h.fontWeight, italic: _italic(h), sizeK: Math.abs(sizeK - 1) < 1e-3 ? 1 : sizeK, ul: null, lt: null, hl: null, bg: null, shadows: parseTextShadow(h.textShadow), dot: null };
  // 장식선은 상속되지 않고 «그은 요소»가 그 안 글 전체에 긋는다 ⇒ host 에서 el 까지 거슬러 그 요소의 색·두께·위치
  for (let n = host; n; n = n === el ? null : n.parentElement) {
    const c = n === host ? h : n === el ? b : window.getComputedStyle(n), line = c.textDecorationLine || '';
    if (!st.ul && /underline/.test(line)) st.ul = _line(c);
    if (!st.lt && /line-through/.test(line)) st.lt = _line(c);
    if (!st.bg && n !== el && c.backgroundColor && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(c.backgroundColor)) st.bg = c.backgroundColor;
  }
  const hl = host.closest && host.closest('.tb-hl');
  if (hl && hl !== el && el.contains(hl)) {
    const c = window.getComputedStyle(hl), hv = _cssVar(c, '--tb-hl-h');
    st.hl = { color: _cssVar(c, '--tb-hl-color'), h: hv.endsWith('%') ? { pct: parseFloat(hv) / 100 } : { px: parseFloat(hv) || 0 }, y: parseFloat(_cssVar(c, '--tb-hl-y')) || 0 };
  }
  const dot = host.closest && host.closest('.tb-dot');
  if (dot && dot !== el && el.contains(dot)) {
    const c = window.getComputedStyle(dot, '::before'), size = parseFloat(c.width) || 0;
    const mt = /matrix\(([^)]*)\)/.exec(c.transform || '');
    const [tx, ty] = mt ? mt[1].split(',').slice(4).map(Number) : [-size / 2, 0];
    if (size > 0 && c.content !== 'none') st.dot = { color: c.backgroundColor, size, tx: tx || 0, ty: ty || 0 };
  }
  if (st.color === _paint(b) && st.weight === b.fontWeight && st.italic === _italic(b) && st.sizeK === 1 && !st.ul && !st.lt && !st.hl && !st.bg && !st.shadows && !st.dot) return null;
  return Object.freeze(st);
}

/** GIF 가 읽는 글 요소 — 그리기·경고가 같은 요소를 본다. */
function _textEl(tb) {
  return tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label') || tb.querySelector('div');
}

/* ⑸(DONE40 · 시트 GIF-V1 RICHTEXT) 옛 «꾸밈은 GIF 에 안 실립니다» 경고(#anim-rich-warn · 지디 결정 C)는 RICHTEXT-EFFECTS-01 C7 에서 지웠다 —
   부분 꾸밈을 이제 GIF 에 그린다(C1~C6 · _extractCs/_runStyle → fillStyled · 현빈 결정 «화면 == 내보낸 것»). */

/* X2(GIF-V1-EMPTY-TEXT-SAMPLE-01) 빈 글이면 «Sample Text» GIF 가 성공 토스트와 함께 나갔다(_extractText 대체값)
   ⇒ 저장 단추를 끄고 까닭을 툴팁으로(지디 결정 A · 단추 모양은 기존 .anim-export-btn:disabled). */
const _EMPTY_TITLE = '글이 비어 있어 GIF 를 만들 수 없습니다 — 글을 먼저 입력하세요';
function _isEmptyText(tb) {
  const mk = _MK[_mkOf(tb)];
  if (mk) return !mk.has(tb);   // 슬라이드 = 사진 0 · 신호등 = 칸 0 이면 «빈 것»
  const el = tb && _textEl(tb);
  return !el || !(el.textContent || '').trim();
}
function _applyEmptyGate(btn) {
  if (!btn) return;
  const empty = _isEmptyText(_animTb);
  btn.disabled = empty;
  if (empty) { btn.setAttribute('aria-disabled', 'true'); btn.title = _MK[_mkOf(_animTb)]?.emptyTitle || _EMPTY_TITLE; }
  else { btn.removeAttribute('aria-disabled'); btn.title = ''; }
}

function _textGrad(cs) {
  const clip = `${cs.backgroundClip || ''} ${cs.webkitBackgroundClip || ''}`, GM = window.GradientModel;
  if (!/\btext\b/.test(clip) || !/gradient\(/i.test(cs.backgroundImage || '') || !GM) return {};
  const grad = GM.parseGradient(cs.backgroundImage);
  return grad && grad.stops && grad.stops.length >= 2 ? { grad, gradLine: GM.gradientLine } : {};
}

/** 섹션 배경 그라데이션 — 앱은 dataset.bg 에 그라데이션 CSS 를 두고 style.backgroundImage 로 그린다(prop-section.js _applySectionBg · backgroundColor 는 비움)
 *  ⇒ computed backgroundColor 만 읽던 GIF 바탕이 기본 바탕색이 됐다(지디 실앱 (1,1)=119,119,119). 선 = 섹션 상자 기준 제품 gradientLine(space 'css')
 *  → 블럭 왼위 원점·블럭 px(배율 무관: 화면 사각형 ÷ zoom). 겹이 하나인 그라데이션만(메시·그림 합성은 여러 겹 = 바탕색만). */
function _secGrad(sec, tb) {
  const GM = window.GradientModel, img = String(window.getComputedStyle(sec).backgroundImage || '').trim();
  if (!GM || !/^(linear|radial)-gradient\(/i.test(img) || (img.match(/gradient\(/gi) || []).length !== 1) return null;
  const grad = GM.parseGradient(img);
  if (!grad || !grad.stops || grad.stops.length < 2) return null;
  const bw = Math.max(tb.offsetWidth, 1), sr = sec.getBoundingClientRect(), br = tb.getBoundingClientRect(), z = br.width / bw || 1;
  const sw = sr.width / z, sh = sr.height / z, ox = (br.left - sr.left) / z, oy = (br.top - sr.top) / z;
  const ln = GM.gradientLine(grad, { space: 'css', w: sw, h: sh });
  const P = (q) => ({ x: q.x * sw - ox, y: q.y * sh - oy });
  return { stops: grad.stops, p0: P(ln.p0), p1: P(ln.p1), radial: !!ln.radial, bw };
}
/** GIF 한 프레임 바탕 — 섹션 바탕색(반투명 정지점 받침) + 그라데이션 섹션이면 그 블럭 자리 그라데이션. 캔버스 px = 블럭 px × (W / 블럭 폭). */
function _fillBg(ctx, style, W, H) {
  ctx.fillStyle = style.sectionBg || '#ffffff';
  ctx.fillRect(0, 0, W, H);
  const g = style.secGrad;
  if (!g || !ctx.createLinearGradient) return;
  const k = W / g.bw, ax = g.p0.x * k, ay = g.p0.y * k, bx = g.p1.x * k, by = g.p1.y * k;
  const cg = g.radial ? ctx.createRadialGradient(ax, ay, 0, ax, ay, Math.hypot(bx - ax, by - ay)) : ctx.createLinearGradient(ax, ay, bx, by);
  for (const st of g.stops) cg.addColorStop(Math.max(0, Math.min(1, st.offset)), st.color);
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, W, H);
}

function _getTextStyle(tb) {
  const el  = _textEl(tb);
  if (!el) return { text: '', fontSize: 24, color: '#111111', fontFamily: 'sans-serif', fontWeight: '400', letterSpacing: 0, textAlign: 'left', lineHeight: 1.4, sectionBg: '#ffffff' };
  const cs  = window.getComputedStyle(el);
  const sec = tb.closest('.section-block');
  /* ⑷(DONE40) 인라인 style 만 읽어 클래스·테마 배경 섹션이 흰색으로 나갔다 ⇒ 정지 이미지 내보내기와 같은 규칙(computed · 투명이면 페이지 배경).
     그라데이션 섹션은 그 위에 블럭 자리만큼 그라데이션을 깐다(secGrad · GIF-V1-SECTION-BG-INLINE-ONLY-01).
     shortcut: 이미지·메시(여러 겹) 배경은 아직 «바탕색»만 — 그 모양이 필요해지면 _secGrad 옆에. */
  const bg  = sec ? sectionBgColor(sec) : '#ffffff';
  const text = _extractText(el);
  return {
    text,
    cs:            _extractCs(el, text),
    fontSize:      parseFloat(cs.fontSize)      || 24,
    color:         cs.color                     || '#111111',
    fontFamily:    cs.fontFamily                || 'sans-serif',
    fontWeight:    cs.fontWeight                || '400',
    letterSpacing: parseFloat(cs.letterSpacing) || 0,
    textAlign:     el.style.textAlign || (cs.textAlign === 'start' ? 'left' : cs.textAlign) || 'left',
    lineHeight:    parseFloat(cs.lineHeight) / (parseFloat(cs.fontSize) || 1) || 1.4,
    sectionBg:     bg || '#ffffff',
    secGrad:       sec ? _secGrad(sec, tb) : null,
    // ⑫ 글자 그라데이션 — background-clip:text + 그라데이션이면 제품 파서·선 기하(window.GradientModel · gradient-model.js)로 넘긴다
    ...(_textGrad(cs)),
    // 블럭 글 안쪽 폭(em) — 캔버스가 블럭과 같은 곳에서 접게(textBox). clientWidth 는 zoom 영향 없음 · 0 이면 옛 규칙
    wrapEm:        (el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)) / (parseFloat(cs.fontSize) || 24) || undefined,
  };
}

function _startAnimPreview() {
  _stopAnimPreview();
  if (!_animTb) return;
  if (_MK[_animKind]) { _startSlidePreview(); return; }
  _updateAnimConflictWarning();
  _syncStampRow();
  const canvas = document.getElementById('anim-preview-canvas');
  // BUG-FIX: canvas 없으면 에러 대신 조용히 리턴
  if (!canvas) { console.warn('[AnimGif] anim-preview-canvas not found'); return; }
  const ctx    = canvas.getContext('2d');
  const style  = _getTextStyle(_animTb);
  const speed  = parseFloat(document.getElementById('anim-speed')?.value  || 1);
  const repeat = parseInt(document.getElementById('anim-repeat')?.value   || 1);

  // 블록 비율 기반으로 캔버스 해상도 설정 (고정 너비 480 기준)
  // offsetWidth/offsetHeight: CSS transform(zoom) 영향 없는 실제 논리 크기
  const bW = Math.max(_animTb.offsetWidth,  1);
  const bH = Math.max(_animTb.offsetHeight, 1);
  const CANVAS_PREVIEW_W = 480;
  const ratio    = bH / bW;
  // 폰트 크기도 비율에 맞게 스케일
  const scale       = CANVAS_PREVIEW_W / bW;
  const displaySize = Math.round(style.fontSize * scale);
  canvas.width   = CANVAS_PREVIEW_W;
  canvas.height  = fitCanvasH(ctx, style, CANVAS_PREVIEW_W, Math.round(CANVAS_PREVIEW_W * ratio), displaySize);
  const W = canvas.width, H = canvas.height;
  const plan        = _plan(style, speed, scale);
  const duration    = plan.duration; // ms for one cycle
  const info = document.getElementById('anim-loop-info');   // F4 한 바퀴 길이·GIF 프레임 수(내보내기와 같은 셈)
  if (info) info.textContent = loopInfoText(duration);

  _animLoops = 0;

  function tick(ts) {
    if (!_animStart) _animStart = ts;
    const elapsed = ts - _animStart;
    const t       = Math.min(elapsed / duration, 1);

    ctx.clearRect(0, 0, W, H);
    _fillBg(ctx, style, W, H);
    plan.draw(ctx, W, H, displaySize, t);

    if (t < 1) {
      _animRafId = requestAnimationFrame(tick);
    } else {
      _animLoops++;
      if (_animLoops < repeat) {
        // 루프 간 300ms 대기 (카운트업 등 마지막 값 인식 시간)
        _animTimeoutId = setTimeout(() => {
          _animTimeoutId = null;
          _animStart = null;
          _animRafId = requestAnimationFrame(tick);
        }, 300);
      } else {
        // hold 1500ms then restart loop
        _animTimeoutId = setTimeout(() => {
          _animTimeoutId = null;
          _animLoops = 0;
          _animStart = null;
          _animRafId = requestAnimationFrame(tick);
        }, 1500);
      }
    }
  }
  _animRafId = requestAnimationFrame(tick);
}

function _drawFrame(ctx, W, H, style, displaySize, animType, t) {
  const cx = W / 2;
  const cy = H / 2;

  ctx.font         = `${style.fontWeight} ${displaySize}px ${style.fontFamily}`;
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = style.letterSpacing + 'px'; } catch(e) {}

  // textAlign & x-anchor
  const { paddingX } = textBox(W, displaySize, style);   // 블럭과 같은 줄바꿈(layoutLines 와 같은 함수)
  let anchorX;
  if (style.textAlign === 'left') {
    anchorX = paddingX;
    ctx.textAlign = 'left';
  } else if (style.textAlign === 'right') {
    anchorX = W - paddingX;
    ctx.textAlign = 'right';
  } else {
    anchorX = cx;
    ctx.textAlign = 'center';
  }

  // 줄바꿈(\n + 폭 접기) — V2 와 같은 layoutLines(같은 textBox 폭 · 조각 스타일 cs 를 줄마다 잘라 붙임)
  const segs      = layoutLines(ctx, style, W, H, displaySize).segs;
  const lines     = segs.map(s => s.text);
  const env       = { style, size: displaySize };
  const firstLine = lines[0];

  // draw all lines centered vertically around baseY
  const drawLines = (linesArr, baseY, drawFn) => {
    linesArr.forEach((line, i) => drawFn(line, anchorX, segs[i].y + (baseY - cy), i));   // 줄 y = layoutLines(줄마다 높이 다를 수 있음)
  };

  switch (animType) {

    /* ── 슬라이드업 ── */
    case 'slide-up': {
      const offset = (1 - _easeOut(t)) * H * 0.45;
      ctx.save();
      ctx.globalAlpha = _easeInOut(t);
      ctx.fillStyle   = style.color;
      drawLines(lines, cy + offset, (line, x, y, i) => fillStyled(ctx, line, segs[i].cs, x, y, env));
      ctx.restore();
      break;
    }

    /* ── 타이핑 ── */
    case 'typewriter': {
      /* ⑶·X1(DONE40) 원문(줄바꿈 전)을 잘라 매 프레임 다시 정렬했다 ⇒ 가운데 정렬이면 친 글자가 왼쪽으로 밀리고, 긴 글은 폭을 넘었다.
         ⇒ 다른 효과와 같은 줄(wrapLine 뒤 lines)에서 치고, 줄 시작 x 는 «그 줄 전체» 폭으로 고정한다. */
      const shown  = typedLines(lines, t);
      ctx.fillStyle = style.color;
      ctx.textAlign = 'left';
      let curX = null, curY = null;
      shown.forEach((part, i) => {
        const pcs = segs[i].cs && segs[i].cs.slice(0, part.length);
        const x = lineStartX(style.textAlign, anchorX, measureStyled(ctx, lines[i], segs[i].cs, env));
        const y = segs[i].y;
        fillStyled(ctx, part, pcs, x, y, env);
        curX = x + measureStyled(ctx, part, pcs, env) + 2; curY = y;
      });
      if (t < 1 && curX != null) ctx.fillRect(curX, curY - displaySize * 0.45, 2, displaySize * 0.9);   // 커서
      break;
    }

    /* ── 슬롯머신 (줄바꿈 시 첫줄만) ── */
    case 'slot-machine': {
      if (!numToken(firstLine)) {
        const offset = (1 - _easeOut(t)) * H * 0.4;
        ctx.save(); ctx.globalAlpha = t;
        ctx.fillStyle = style.color;
        fillStyled(ctx, firstLine, segs[0].cs, anchorX, cy + offset, env);
        ctx.restore();
        break;
      }
      /* ⑵·X3(DONE40) 숫자 교체 + 줄 통째 슬라이드 + «첫 묶음+10» 잔상이었다(릴 아님 · 없는 숫자가 보임)
         ⇒ 수(콤마·소수 포함)의 «자리마다» 릴이 돌고 오른쪽 자리일수록 늦게 멈춘다. 숫자 아닌 글자는 제자리. */
      const tok    = numToken(firstLine);
      const nDig   = tok.raw.replace(/\D/g, '').length;
      const step   = displaySize * 1.2;
      const fcs    = segs[0].cs;
      const startX = lineStartX(style.textAlign, anchorX, measureStyled(ctx, firstLine, fcs, env));
      ctx.save();
      ctx.fillStyle = style.color;
      let order = 0;   // 왼쪽 자리부터 0 — 오른쪽 자리일수록 늦게 멈춘다
      for (let i = 0; i < firstLine.length; i++) {
        const ch = firstLine[i];
        const c1 = fcs && [fcs[i]];
        const x  = startX + measureStyled(ctx, firstLine.slice(0, i), fcs && fcs.slice(0, i), env);
        const inNum = i >= tok.index && i < tok.index + tok.raw.length && ch >= '0' && ch <= '9';
        if (!inNum) { ctx.textAlign = 'left'; fillStyled(ctx, ch, c1, x, cy, env); continue; }
        const r  = reelDigit(+ch, order++, nDig, t, _easeOut);
        const mx = x + measureStyled(ctx, ch, c1, env) / 2;
        ctx.textAlign = 'center';
        // 도는 자리만 줄 띠로 자른다(위·아래 숫자 숨김) — 멈춘 자리·숫자 아닌 글자는 안 잘라 방점·글로우·형광이 산다(RICHTEXT C6)
        if (r.frac) { ctx.save(); ctx.beginPath(); ctx.rect(0, cy - displaySize * 0.6, W, displaySize * 1.2); ctx.clip(); }
        fillStyled(ctx, String(r.cur), c1, mx, cy - r.frac * step, env);
        if (r.frac) { fillStyled(ctx, String(r.next), c1, mx, cy + (1 - r.frac) * step, env); ctx.restore(); }
      }
      ctx.restore();
      break;
    }

    /* ── 페이드인 ── */
    case 'fade-in': {
      ctx.save();
      ctx.globalAlpha = _easeInOut(t);
      ctx.fillStyle   = style.color;
      drawLines(lines, cy, (line, x, y, i) => fillStyled(ctx, line, segs[i].cs, x, y, env));
      ctx.restore();
      break;
    }

    /* ── 단어별 순차등장 ── */
    case 'word-pop': {
      // wrapLine으로 줄 나눔 후 단어 순서 재구성
      const wrappedLines = lines; // 이미 위에서 wrapLine 처리됨
      const spaceW = ctx.measureText(' ').width;

      // 전체 단어 목록 (줄 순서 유지, 줄 정보 포함)
      const wordEntries = [];
      wrappedLines.forEach((line, lineIdx) => {
        for (const m of line.matchAll(/[^ ]+/g)) wordEntries.push({ word: m[0], lineIdx, cs: segs[lineIdx].cs && segs[lineIdx].cs.slice(m.index, m.index + m[0].length) });
      });
      if (!wordEntries.length) break;

      const totalWords = wordEntries.length;

      wrappedLines.forEach((line, lineIdx) => {
        const lineEntries = wordEntries.filter(e => e.lineIdx === lineIdx);
        const lineWords = lineEntries.map(e => e.word);
        const lineWidths = lineEntries.map(e => measureStyled(ctx, e.word, e.cs, env));
        const lineW = lineWidths.reduce((s, w) => s + w, 0) + spaceW * (lineWords.length - 1);
        let x;
        if (style.textAlign === 'left')       x = anchorX;
        else if (style.textAlign === 'right') x = anchorX - lineW;
        else                                  x = cx - lineW / 2;

        const y = segs[lineIdx].y;
        // 이 줄의 첫 단어가 전체에서 몇 번째인지
        const lineStartIdx = wordEntries.findIndex(e => e.lineIdx === lineIdx);

        lineWords.forEach((word, wi) => {
          const globalIdx = lineStartIdx + wi;
          const prog = Math.max(0, Math.min(1, t * totalWords - globalIdx));
          const sc   = 0.6 + 0.4 * _easeOut(prog);
          const wx   = x + lineWidths[wi] / 2;
          ctx.save();
          ctx.globalAlpha = prog;
          ctx.textAlign = 'left';
          ctx.translate(wx, y);
          ctx.scale(sc, sc);
          ctx.fillStyle = style.color;
          fillStyled(ctx, word, lineEntries[wi].cs, -lineWidths[wi] / 2, 0, env);
          ctx.restore();
          x += lineWidths[wi] + spaceW;
        });
      });
      break;
    }

    /* ── 글로우 펄스 ── */
    case 'glow-pulse': {
      const phase = t * Math.PI * 4;
      const glow  = 0.5 + 0.5 * Math.sin(phase);
      ctx.save();
      ctx.shadowColor = style.solid || style.color;   // 그라데이션이면 대체 단색(그림자는 CanvasGradient 를 못 받는다)
      ctx.shadowBlur  = 4 + 32 * glow;
      ctx.globalAlpha = 0.6 + 0.4 * glow;
      ctx.fillStyle   = style.color;
      drawLines(lines, cy, (line, x, y, i) => fillStyled(ctx, line, segs[i].cs, x, y, env));
      ctx.restore();
      break;
    }

    /* ── 카운트업 (줄바꿈 시 첫줄만) ── */
    case 'count-up': {
      /* ⑴(DONE40) 첫 숫자 묶음만 셌다(12,345 → 0,345…) ⇒ 콤마·소수까지 한 수로 0 부터 센다. 수가 없으면 옛 꼴(0→100). */
      const display  = countUpLine(firstLine, t >= 1 ? 1 : _easeOut(t)) ?? Math.floor(100 * _easeOut(t)).toString();
      const dcs      = remapCs(firstLine, segs[0].cs, display);
      const scale    = t === 1 ? 1 : (1 + 0.05 * Math.sin(t * Math.PI * 8) * (1 - t));
      ctx.save();
      ctx.translate(anchorX, cy);
      ctx.scale(scale, scale);
      ctx.fillStyle = style.color;
      fillStyled(ctx, display, dcs, 0, 0, env);
      ctx.restore();
      break;
    }
  }
}

function _easeOut(t)   { return 1 - Math.pow(1 - t, 3); }
function _easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }

/* ── GIF 내보내기 ── */
const _GIF_BTN_HTML = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 1v7M3 5l3 4 3-4"/><path d="M1 10h10"/></svg> GIF 저장`;

function _restoreGifBtn(btn) {
  btn.innerHTML = _GIF_BTN_HTML;
  _applyEmptyGate(btn);   // 다시 켤 때도 빈 글이면 꺼 둔다
}

/* ⑹(DONE40) 실패를 네이티브 alert 로 띄워 앱 창이 막혔다 ⇒ 앱의 다른 알림처럼 토스트(창을 안 막는다). */
function _gifFail(err) {
  window.showToast?.('⚠️ GIF 생성 중 오류가 발생했습니다: ' + (err && err.message ? err.message : err));
}

async function exportAnimGif() {
  if (!_animTb) return;
  if (_isMotion(_animTb)) return _exportSlideGif();

  const btn = document.querySelector('.anim-export-btn');
  // 중복 클릭 방지: 이미 비활성화 상태면 무시 · 빈 글은 만들지 않는다(콘솔 호출 길 포함)
  if (btn.disabled || _isEmptyText(_animTb)) return;

  btn.disabled    = true;
  btn.textContent = '생성 중...';

  try {
    const style  = _getTextStyle(_animTb);
    const speed  = parseFloat(document.getElementById('anim-speed')?.value) || 1;
    // BUG-FIX: parseInt(value || 1)은 value="0"일 때 1로 오버라이드됨
    // 올바른 방법: null/undefined/빈문자열만 기본값 처리
    const repeatRaw = document.getElementById('anim-repeat')?.value;
    const repeat = (repeatRaw != null && repeatRaw !== '') ? parseInt(repeatRaw) : 1;

    // 동적 캔버스 크기: 실제 블록 크기 기반 2x 해상도
    // BUG-FIX: offsetWidth가 0이면 scale이 Infinity → displaySize가 Infinity 방지
    const bW = Math.max(_animTb.offsetWidth,  1);
    const bH = Math.max(_animTb.offsetHeight, 1);
    const W = Math.max(320, Math.round(bW * 2));
    const offCanvas  = document.createElement('canvas');
    const ctx = offCanvas.getContext('2d');

    const scale       = W / bW;
    const displaySize = Math.round(style.fontSize * scale);
    const H = fitCanvasH(ctx, style, W, Math.max(80, Math.round(bH * 2)), displaySize);   // 미리보기와 같은 셈
    offCanvas.width  = W;
    offCanvas.height = H;
    const plan        = _plan(style, speed, scale);
    const duration    = plan.duration; // ms
    const fps         = GIF_FPS;   // F4 — 안내 한 줄(loopInfoText)과 같은 수
    const frames      = Math.ceil((duration / 1000) * fps);
    const delay       = Math.round(1000 / fps);

    const gif = new GIF({
      workers:      2,
      quality:      8,
      width:        W,
      height:       H,
      workerScript: 'js/gif.worker.js',
      // gif.js: repeat=-1 → 1회 재생, repeat=0 → 무한루프, repeat=N → N번 추가반복
      // UI 슬라이더 min=1이므로 repeat=1은 "1회 재생"(=-1), repeat=2는 "2회"(=1번 추가반복)
      repeat:       repeat <= 1 ? -1 : repeat - 1,
    });

    for (let i = 0; i <= frames; i++) {
      const t = i / frames;
      ctx.clearRect(0, 0, W, H);
      _fillBg(ctx, style, W, H);
      plan.draw(ctx, W, H, displaySize, t);
      gif.addFrame(ctx, { copy: true, delay });
    }
    // 마지막 값에서 1.5초 정지 (카운트업 등 UX)
    const holdFrames = Math.ceil(fps * GIF_HOLD_S);
    for (let i = 0; i < holdFrames; i++) {
      ctx.clearRect(0, 0, W, H);
      _fillBg(ctx, style, W, H);
      plan.draw(ctx, W, H, displaySize, 1);
      gif.addFrame(ctx, { copy: true, delay });
    }

    // 진행률 표시
    gif.on('progress', p => {
      btn.textContent = `생성 중... ${Math.round(p * 100)}%`;
    });

    gif.on('finished', blob => _downloadGif(blob, btn));

    // BUG-FIX: gif.on('error') 없으면 Worker 에러 시 EventEmitter가 uncaught error throw → 앱 크래시
    gif.on('error', err => {
      console.error('[GIF] Worker error:', err);
      _gifFail(err);
      _restoreGifBtn(btn);
    });

    gif.render();

  } catch (err) {
    console.error('GIF export error:', err);
    _gifFail(err);
    _restoreGifBtn(btn);
  }
}
/** 슬라이드 GIF — 블럭 × 2 크기(텍스트와 같은 셈) · 한 바퀴를 상한 60 안에(fps 낮춤 · slide-motion gifPlan) · 끝 = 처음이라 끝 프레임·멈춤 없음.
 *  그림은 slidePrepare 가 IPC(assets:readAsDataUri)로 받은 data URL ⇒ addFrame(copy) 의 getImageData 가 오염 없이 돈다. */
async function _exportSlideGif() {
  const btn = document.querySelector('.anim-export-btn');
  if (!btn || btn.disabled || _isEmptyText(_animTb)) return;
  btn.disabled = true;
  btn.textContent = '생성 중...';
  try {
    const tb = _animTb;
    const mk = _MK[_mkOf(tb)];
    await mk.prepare(tb);
    const repeatRaw = document.getElementById('anim-repeat')?.value;
    const repeat = (repeatRaw != null && repeatRaw !== '') ? parseInt(repeatRaw) : 1;
    const bW = Math.max(tb.offsetWidth, 1), bH = Math.max(tb.offsetHeight, 1);
    const W = Math.max(320, Math.round(bW * 2)), H = Math.max(40, Math.round(bH * (W / bW)));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), style = _slideBgStyle(tb);
    const plan = mk.plan(tb, _slideAnimNow(), _animType), g = plan.gif;
    const gif = new GIF({ workers: 2, quality: 8, width: W, height: H, workerScript: 'js/gif.worker.js', repeat: repeat <= 1 ? -1 : repeat - 1 });
    for (let i = 0; i < g.frames; i++) {
      ctx.clearRect(0, 0, W, H);
      _fillBg(ctx, style, W, H);
      plan.draw(ctx, W, H, 0, i / g.frames);
      gif.addFrame(ctx, { copy: true, delay: g.delay });
    }
    gif.on('progress', (p) => { btn.textContent = `생성 중... ${Math.round(p * 100)}%`; });
    gif.on('finished', (blob) => _downloadGif(blob, btn));
    gif.on('error', (err) => { console.error('[GIF] Worker error:', err); _gifFail(err); _restoreGifBtn(btn); });
    gif.render();
  } catch (err) {
    console.error('GIF export error:', err);
    _gifFail(err);
    _restoreGifBtn(btn);
  }
}
function _downloadGif(blob, btn) {
      // BUG-FIX: Electron에서 DOM 미삽입 <a>의 .click()은 다운로드를 트리거하지 않을 수 있음
      // document.body에 추가 후 클릭, 그 다음 제거
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = 'sangpe_animation.gif';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // BUG-FIX: Electron 다운로드는 비동기 처리 → 즉시 revoke하면 URL 무효화 위험
      // setTimeout으로 1초 후 revoke하여 다운로드 핸들러가 URL을 읽을 시간 확보
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      showToast('✅ GIF 저장 완료!');
      _restoreGifBtn(btn);
}

window.openAnimModal    = openAnimModal;
// BUG-FIX: openAnimGifModal 별칭 추가 (외부에서 다른 이름으로 호출하는 경우 대비)
window.openAnimGifModal = openAnimModal;
window.closeAnimModal   = closeAnimModal;
window.setAnimPerLine   = setAnimPerLine;
window.exportAnimGif    = exportAnimGif;
window.restartAnimPreview = restartAnimPreview;
window.playAnimOnCanvas  = playAnimOnCanvas;
window.stopAnimOnCanvas  = stopAnimOnCanvas;
window.toggleAnimOnCanvas = toggleAnimOnCanvas;
window.setSlideAnimOpt   = setSlideAnimOpt;   // index.html 슬라이드 방향·머무름 칸 인라인(0.9.13 MOTION)
window.setAnimStampS0    = setAnimStampS0;   // index.html «도장 시작» 슬라이더 인라인 oninput/onchange   // index.html 속도·반복 슬라이더 인라인 oninput 이 부른다(모듈이라 안 붙이면 ReferenceError · 0.9.12 QA)

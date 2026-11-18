/* slide-motion.js — 슬라이드 블럭 움직임 셈(순수 · DOM 0) · 0.9.13 MOTION-SLIDE-BLOCK-01(현빈 261116 · 설계 DESIGN-ty-0913-motion-261116.md).
 *   ① 흐름(slide-flow) = 카드 줄이 끊김 없이 한 방향으로 · 한 바퀴 = 카드 n 장 한 주기(첫·끝 프레임이 이어진다 · 끝 멈춤 0)
 *   ② 스와이프(slide-swipe) = 한 장씩 넘김(0.5초 easeInOut) + 머무름 · 마지막 → 첫 장으로 이어 넘김
 *   ③ 세로(2단계 · slide-vflow = 흐름 · slide-vstep = 넘김+머무름) = 같은 셈을 y 로 — 카드 세로로 쌓음 · 카드 크기 % = 블럭 «높이»의 % · dir left/right = 위로/아래로
 *   길이 단위 = 블럭 px(화면 크기 무관) · 그릴 때 캔버스 폭 / 블럭 폭(k)만큼 곱한다 ⇒ 미리보기·캔버스 재생·GIF 가 같은 셈(화면==GIF).
 *   GIF 프레임 상한 60(export-image.js GIF_MAX_FRAMES 와 같은 수 · 지디 결정 ⓑ: fps 를 낮춤 + 안내 줄에 몇 fps 인지).
 *   정적 «첫 장면»(slide-block.js renderSlideBlock 의 flex 줄)은 offset 0 그림과 같은 자리 — 카드 i 의 왼끝 = i × (카드 폭 + 간격).
 */
export const SLIDE_FX = Object.freeze(['slide-flow', 'slide-swipe', 'slide-vflow', 'slide-vstep']);
/** 움직임 축 — 세로 효과면 'y'(정적 첫 장면도 세로로 쌓음). */
export const slideAxis = (fx) => (fx === 'slide-vflow' || fx === 'slide-vstep' ? 'y' : 'x');
const _stepping = (fx) => fx === 'slide-swipe' || fx === 'slide-vstep';   // 넘김+머무름 꼴(아니면 흐름)
export const SLIDE_MAX = 12;                       // 지디 결정 ⓓ
export const SLIDE_LAYOUT_DEFAULT = Object.freeze({ cardW: 60, gap: 16, h: 360 });
export const SLIDE_ANIM_DEFAULT = Object.freeze({ dir: 'left', dwell: 1.2, speed: 1 });
export const FLOW_PX_S = 120;                      // 흐름 기본 속도(블럭 px/초 · 속도 배율로 곱함)
export const SWIPE_MOVE_S = 0.5;                   // 스와이프 한 번 넘김
export const GIF_FPS_MAX = 20, GIF_FRAMES_MAX = 60;

const _num = (v, lo, hi, d) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };

/** 내용 배치 소독 — 카드 폭 % · 간격 px · 블럭 높이 px. */
export function normLayout(o) {
  const s = o && typeof o === 'object' ? o : {};
  return { cardW: _num(s.cardW, 20, 100, SLIDE_LAYOUT_DEFAULT.cardW), gap: _num(s.gap, 0, 80, SLIDE_LAYOUT_DEFAULT.gap), h: _num(s.h, 120, 1200, SLIDE_LAYOUT_DEFAULT.h) };
}
/** 움직임 소독 — 방향 · 머무름(초) · 속도 배율. */
export function normAnim(o) {
  const s = o && typeof o === 'object' ? o : {};
  return { dir: s.dir === 'right' ? 'right' : 'left', dwell: _num(s.dwell, 0.3, 4, SLIDE_ANIM_DEFAULT.dwell), speed: _num(s.speed, 0.25, 3, SLIDE_ANIM_DEFAULT.speed) };
}
/** 기본값과 다른 키만(저장 꼴 — 기본이면 키 없음). */
export function diffFromDefault(v, def) {
  const out = {};
  for (const k of Object.keys(def)) if (v[k] !== def[k]) out[k] = v[k];
  return out;
}

/** 카드 하나 폭 % 소독(SLIDE-CELL-SIZE-EACH-01) — 없거나 숫자 아니면 undefined(= 공통 카드 폭). */
export const normCardW = (w) => (w === undefined || w === null || w === '' || !Number.isFinite(+w) ? undefined : _num(w, 20, 100, SLIDE_LAYOUT_DEFAULT.cardW));

/** 블럭 px 기하 — 카드 폭 · 한 칸(카드+간격) · 한 주기. bw = 움직임 축 길이(가로 = 블럭 폭 · 세로 = 블럭 높이).
 *  ws[i] = 카드 i 폭 %(SLIDE-CELL-SIZE-EACH-01 · 없으면 공통 cardW) → cws[i](px) · starts[i] = 앞 카드들 (폭+간격) 누적합 · period = 전부의 합.
 *  ★칸별 폭이 하나도 없으면 uniform = 옛 셈 그대로(starts = i·step · period = n·step — 부동소수 한 자리까지 같다 · 옛 저장본·GIF 무변). */
export function slideGeom(bw, n, layout, ws) {
  const L = normLayout(layout);
  const N = Math.max(1, n | 0), cw = (bw * L.cardW) / 100, step = cw + L.gap;
  const own = Array.from({ length: N }, (_, i) => normCardW(Array.isArray(ws) ? ws[i] : undefined));
  if (own.every((w) => w === undefined)) {
    return { bw, n: N, cw, gap: L.gap, step, period: N * step, uniform: true, cws: own.map(() => cw), starts: own.map((_, i) => i * step) };
  }
  const cws = own.map((w) => (w === undefined ? cw : (bw * w) / 100));
  const starts = []; let acc = 0;
  for (const c of cws) { starts.push(acc); acc += c + L.gap; }
  return { bw, n: N, cw, gap: L.gap, step, period: acc, uniform: false, cws, starts };
}
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/** 한 바퀴(초). */
export function loopSec(fx, geom, anim) {
  const A = normAnim(anim);
  if (_stepping(fx)) return (geom.n * (SWIPE_MOVE_S + A.dwell)) / A.speed;
  return geom.period / (FLOW_PX_S * A.speed);
}
/** 진행 t(0~1 · 한 바퀴) → 줄이 밀린 거리(블럭 px · 0 ≤ s < period). 방향은 drawSlides 가 부호로. */
export function slideOffset(fx, geom, anim, t) {
  const tt = ((t % 1) + 1) % 1;
  if (_stepping(fx)) {
    const A = normAnim(anim), per = SWIPE_MOVE_S + A.dwell, x = tt * geom.n * per;   // 장마다 [넘김 · 머무름]
    const i = Math.floor(x / per), local = x - i * per;
    const f = local < SWIPE_MOVE_S ? easeInOut(local / SWIPE_MOVE_S) : 1;
    if (geom.uniform !== false) return ((i + f) * geom.step) % geom.period;
    const j = i % geom.n;   // 칸별 폭 — 카드 j 왼끝에서 다음 카드 왼끝까지(그 카드 폭 + 간격)를 f 만큼
    return (geom.starts[j] + f * (geom.cws[j] + geom.gap)) % geom.period;
  }
  return tt * geom.period;   // tt < 1 ⇒ 이미 < period(옛 `% period` 는 죽은 줄 — MOTION1 CTL1 이 S1 을 못 붉혔다)
}
/** GIF 프레임 셈 — 상한 60 이면 fps 를 낮춘다(한 바퀴 전부 담음 · 자르지 않음). frames = 한 바퀴 프레임 수(끝 = 처음이라 끝 프레임은 안 넣음). */
export function gifPlan(sec) {
  const s = Math.max(0.05, sec);
  const fps = Math.min(GIF_FPS_MAX, GIF_FRAMES_MAX / s);
  const frames = Math.max(2, Math.min(GIF_FRAMES_MAX, Math.round(s * fps)));
  return { fps: frames / s, frames, delay: Math.round((s * 1000) / frames), capped: GIF_FRAMES_MAX / s < GIF_FPS_MAX };
}
/** 모달 안내 한 줄 — 미리보기·GIF 저장이 같은 셈. */
export function slideInfoText(sec) {
  const g = gifPlan(sec);
  return `한 바퀴 ${sec.toFixed(2)}초 · GIF ${g.frames}프레임(상한 ${GIF_FRAMES_MAX}) · 초당 ${g.fps.toFixed(1)}프레임${g.capped ? ` — 상한 때문에 ${GIF_FPS_MAX}에서 낮춤` : ''}`;
}

/** 카드 줄 한 장면 — imgs[i] = 그릴 그림(없으면 null → 빈 카드 색) · k = 캔버스 px / 블럭 px · s = slideOffset · dir 'left' = 왼쪽으로 흐름.
 *  카드 i 의 왼끝 = i·step − s(왼쪽) / i·step + s(오른쪽) 를 주기로 감아 화면 폭을 다 덮을 만큼 되풀이. 그림은 카드 칸을 cover 로 채움(정적 첫 장면 object-fit:cover 와 같음). */
export function drawSlides(ctx, W, H, imgs, geom, s, dir, k, emptyFill = '#e9e9e9', axis = 'x') {
  const y = axis === 'y', L = y ? H : W, X = y ? W : H;   // L = 움직임 축 길이 · X = 가로지른 길이(카드가 다 채움)
  const rect = (p, len) => (y ? [0, p, X, len] : [p, 0, len, X]);
  const step = geom.step * k, cw = geom.cw * k, P = geom.period * k, off = (dir === 'right' ? -s : s) * k;
  const uni = geom.uniform !== false;
  for (let i = 0; i < geom.n; i++) {
    const cwi = uni ? cw : geom.cws[i] * k;   // 칸별 폭(SLIDE-CELL-SIZE-EACH-01) · uniform 이면 옛 식 그대로
    let x = ((uni ? i * step : geom.starts[i] * k) - off) % P;
    if (x > 0) x -= P;   // 주기 하나 왼쪽부터 오른쪽 끝까지
    for (; x < L; x += P) {
      if (x + cwi <= 0) continue;
      const im = imgs[i], [dx, dy, dw, dh] = rect(x, cwi);
      if (!im || !im.width) { ctx.fillStyle = emptyFill; ctx.fillRect(dx, dy, dw, dh); continue; }
      const sc = Math.max(dw / im.width, dh / im.height), sw = dw / sc, sh = dh / sc;
      ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, dx, dy, dw, dh);
    }
  }
}

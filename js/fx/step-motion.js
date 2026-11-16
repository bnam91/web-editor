/* step-motion.js — 신호등(차례 강조) 셈·그림(순수 · DOM 0) · 0.9.13 MOTION-STEP-HIGHLIGHT-01(현빈 261116 · 설계 DESIGN-ty-0913-motion-step-261117.md · 지디 GO 261117).
 *   칸 n 개가 한 칸 시간씩 차례로 켜짐 · 한 바퀴 = n × 한 칸 시간 ÷ 속도(끝 = 처음 · 끝 멈춤 0).
 *   꼴: step-fill(칸에 옅은 강조 색) · step-outline(강조 색 테두리) · step-pop(칸 조각을 조금 키워 다시 그림 + 그림자) — 셋 다 꺼진 칸은 바탕색으로 흐리게.
 *   지난 칸: off = 지금 칸만 · stack = 처음부터 지금 칸까지 켜진 채 쌓임.
 *   칸 자리 = 블럭 px(블럭 왼위 기준) · 그릴 때 k(캔버스 px / 블럭 px)를 곱함 ⇒ 미리보기·캔버스 재생·GIF 가 같은 셈(화면==GIF).
 *   바탕 그림(base) = 블럭을 찍은 캔버스(grid-step.js 가 PNG 내보내기 길로 만든다) — 여기선 받아서 그리기만.
 */
export const STEP_FX = Object.freeze(['step-fill', 'step-outline', 'step-pop']);
export const STEP_ANIM_DEFAULT = Object.freeze({ dwell: 0.8, past: 'off', speed: 1 });
export const STEP_FADE = 0.15;   // 켜지는 칸이 한 칸 시간의 앞 15% 동안 서서히(딱 바뀌는 깜빡임 대신)
export const STEP_DIM = 0.55;    // 꺼진 칸 흐림(바탕색을 이만큼 덮음 · P194 꼴)

const _num = (v, lo, hi, d) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
/** 움직임 소독 — 한 칸 시간(초) · 지난 칸 · 속도 배율. */
export function normStep(o) {
  const s = o && typeof o === 'object' ? o : {};
  return { dwell: _num(s.dwell, 0.3, 4, STEP_ANIM_DEFAULT.dwell), past: s.past === 'stack' ? 'stack' : 'off', speed: _num(s.speed, 0.25, 3, STEP_ANIM_DEFAULT.speed) };
}
/** 한 바퀴(초). */
export const stepLoopSec = (n, anim) => { const A = normStep(anim); return (Math.max(1, n | 0) * A.dwell) / A.speed; };
/** 진행 t(0~1) → 켜진 칸 i · 그 칸 안 진행 local(0~1). */
export function stepAt(n, t) {
  const m = Math.max(1, n | 0), x = (((t % 1) + 1) % 1) * m, i = Math.min(m - 1, Math.floor(x));
  return { i, local: x - i };
}
/** 켜진 칸 번호들 — off = [i] · stack = [0..i]. */
export const stepLit = (i, past) => (past === 'stack' ? Array.from({ length: i + 1 }, (_, j) => j) : [i]);

/** 한 장면 — base = 블럭 그림(캔버스 · 없으면 바탕 안 그림) · cells = [{x,y,w,h}](블럭 px) · color = 강조 색 · dimColor = 꺼진 칸을 덮을 바탕색 · k = 캔버스 px / 블럭 px. */
export function drawStep(ctx, W, H, base, cells, fx, at, past, color, dimColor, k) {
  if (base) ctx.drawImage(base, 0, 0, W, H);
  const lit = new Set(stepLit(at.i, past)), fade = Math.min(1, at.local / STEP_FADE);
  cells.forEach((c, j) => {
    const x = c.x * k, y = c.y * k, w = c.w * k, h = c.h * k;
    if (!lit.has(j)) { ctx.globalAlpha = STEP_DIM; ctx.fillStyle = dimColor; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; return; }
    const a = j === at.i ? fade : 1;
    if (fx === 'step-outline') {
      const lw = Math.max(2, 3 * k);
      ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
    } else if (fx === 'step-pop') {
      if (j === at.i && base) {   // 지금 칸만 키움(쌓인 칸은 흐림만 빠짐)
        const s = 1 + 0.06 * a, r = base.width / W, dw = w * s, dh = h * s;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 12 * k * a; ctx.shadowOffsetY = 4 * k * a;
        ctx.drawImage(base, x * r, y * r, w * r, h * r, x - (dw - w) / 2, y - (dh - h) / 2, dw, dh);
        ctx.restore();
      }
    } else {
      ctx.globalAlpha = 0.22 * a; ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    }
    ctx.globalAlpha = 1;
  });
}

/* color-reveal.js — 컬러 리빌(흑백 → 색이 차오름) 셈·그림(순수 · DOM 은 임시 캔버스 하나만) · SLIDE-FX-COLOR-REVEAL-01(현빈 «0.9.14» · 지디 GO 261121)
 *   한 바퀴 = 흑백 머무름 → 차오름(REVEAL_MOVE_S) → 컬러 머무름 → 처음(흑백)으로 · ÷ 속도.
 *   방식(mode): wipe(기본 · 왼→오로 색이 쓸고 지나감 · 부드러운 경계) · all(전체 동시 채도 0→100) · radial(가운데서 번짐).
 *   바탕 그림(base) = 블럭을 찍은 «컬러» 캔버스(PNG 내보내기 길 · 색보정 채도도 이미 들어 있다) — 흑백은 그릴 때 ctx.filter 로.
 */
export const REVEAL_FX = Object.freeze(['color-reveal']);
export const REVEAL_MODES = Object.freeze(['wipe', 'all', 'radial']);
export const REVEAL_ANIM_DEFAULT = Object.freeze({ mode: 'wipe', dwell: 0.8, speed: 1 });
export const REVEAL_MOVE_S = 1.4;   // 차오르는 시간(초 · 속도 1)
export const REVEAL_EDGE = 0.12;    // 와이프·번짐 경계 폭(블럭 폭/반지름 비)

const _num = (v, lo, hi, d) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
export function normReveal(o) {
  const s = o && typeof o === 'object' ? o : {};
  return { mode: REVEAL_MODES.includes(s.mode) ? s.mode : REVEAL_ANIM_DEFAULT.mode,
    dwell: _num(s.dwell, 0.3, 4, REVEAL_ANIM_DEFAULT.dwell), speed: _num(s.speed, 0.25, 3, REVEAL_ANIM_DEFAULT.speed) };
}
/** 한 바퀴(초). */
export const revealLoopSec = (anim) => { const A = normReveal(anim); return (2 * A.dwell + REVEAL_MOVE_S) / A.speed; };
/** 진행 t(0~1) → 색 차오름 p(0~1 · 앞 머무름 0 · 끝 머무름 1 · 가운데 ease-in-out). */
export function revealAt(anim, t) {
  const A = normReveal(anim), tot = 2 * A.dwell + REVEAL_MOVE_S, x = (((t % 1) + 1) % 1) * tot;
  if (x <= A.dwell) return 0;
  if (x >= A.dwell + REVEAL_MOVE_S) return 1;
  const u = (x - A.dwell) / REVEAL_MOVE_S;
  return u * u * (3 - 2 * u);
}

/** 한 장면 — 흑백 위에 색을 p 만큼(방식별 마스크). base 없으면 아무것도 안 그림. */
export function drawReveal(ctx, W, H, base, mode, p) {
  if (!base) return;
  ctx.save(); ctx.filter = 'grayscale(1)'; ctx.drawImage(base, 0, 0, W, H); ctx.restore();
  if (p <= 0) return;
  if (p >= 1) { ctx.drawImage(base, 0, 0, W, H); return; }
  if (mode === 'all') { ctx.save(); ctx.globalAlpha = p; ctx.drawImage(base, 0, 0, W, H); ctx.restore(); return; }
  const tmp = ctx.canvas.ownerDocument.createElement('canvas');
  tmp.width = W; tmp.height = H;
  const t = tmp.getContext('2d');
  t.drawImage(base, 0, 0, W, H);
  t.globalCompositeOperation = 'destination-in';
  let g;
  if (mode === 'radial') {
    const R = Math.hypot(W, H) / 2, E = R * REVEAL_EDGE, r1 = p * (R + E), r0 = Math.max(0, r1 - E);
    g = t.createRadialGradient(W / 2, H / 2, r0, W / 2, H / 2, Math.max(r0 + 0.01, r1));
  } else {   // wipe — 경계 오른끝 x1 이 0 → W+E (p=0 다 흑백 · p=1 다 컬러)
    const E = W * REVEAL_EDGE, x1 = p * (W + E), x0 = x1 - E;
    g = t.createLinearGradient(x0, 0, x1, 0);
  }
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  t.fillStyle = g; t.fillRect(0, 0, W, H);
  ctx.drawImage(tmp, 0, 0);
}

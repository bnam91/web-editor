/* fx/soft-shadow.js — 부드러운 그림자 겹 셈(순수 · ESM) · TEXT-FX-BEAUTIFUL-SHADOW-01(현빈 261121 · 피그마 «Beautiful Shadows» 결).
 *   각도·높이·세기·색 → 같은 방향으로 점점 멀고 흐린 그림자 SOFT_LAYERS 겹(가까운 겹은 진하고 또렷 · 먼 겹은 옅고 넓게).
 *   각도 = 그림자가 떨어지는 방향(0° = 오른쪽 · 90° = 아래 · 시계방향) · 높이 = 가장 먼 겹의 거리(px) · 세기 = 진하기(0~100).
 *   겹 i(1..N): 거리 = 높이 × 2^(i−N)(1/16 … 1) · 흐림 = 거리 × 2 · 알파 = 세기/100 × 0.35 × (1 − (i−1)/N).
 *   ⚠️Figma 는 text-shadow 를 DROP_SHADOW 로 최대 8겹 옮긴다(figma-renderer · cssTextShadowToEffects slice(0,8)) — 글로우 3 + 사용자 그림자 1 + 이것 5 = 9 면 가장 먼 겹 1이 빠진다.
 */
export const SOFT_LAYERS = 5;
export const SOFT_RANGES = Object.freeze({ angle: [0, 360], height: [0, 40], strength: [0, 100] });
export const SOFT_DEFAULTS = Object.freeze({ angle: 90, height: 12, strength: 60, color: '#000000' });

const num = (v, [lo, hi], d) => { const n = Math.round(Number(v)); return Number.isFinite(n) && String(v).trim() !== '' ? Math.max(lo, Math.min(hi, n)) : d; };
export function normSoft(o) {
  const s = o && typeof o === 'object' ? o : {};
  const R = SOFT_RANGES, D = SOFT_DEFAULTS;
  return { angle: num(s.angle, R.angle, D.angle), height: num(s.height, R.height, D.height), strength: num(s.strength, R.strength, D.strength),
    color: typeof s.color === 'string' && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color.toLowerCase() : D.color };
}
const r1 = (v) => Math.round(v * 10) / 10 || 0;   // −0 → 0
/** 겹 목록 [{x,y,blur,a}] — 가까운 겹부터. */
export function softLayers(o) {
  const { angle, height, strength } = normSoft(o), rad = (angle * Math.PI) / 180, N = SOFT_LAYERS;
  return Array.from({ length: N }, (_, k) => { const i = k + 1, d = height * Math.pow(2, i - N);
    return { x: r1(Math.cos(rad) * d), y: r1(Math.sin(rad) * d), blur: r1(d * 2), a: Math.round((strength / 100) * 0.35 * (1 - (i - 1) / N) * 1000) / 1000 }; });
}
/** text-shadow 글(여러 겹 · 쉼표) — 세기 0 이면 ''. */
export function softShadowCss(o) {
  const n = normSoft(o); if (!n.strength) return '';
  const h = n.color.slice(1), rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
  return softLayers(n).map((l) => `${l.x}px ${l.y}px ${l.blur}px rgba(${rgb},${l.a})`).join(', ');
}

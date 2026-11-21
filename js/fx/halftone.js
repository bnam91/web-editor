/* fx/halftone.js — 하프톤 셈(순수 · DOM 0 · ESM — js/fx/package.json "type":"module") · IMG-FX-HALFTONE-01(현빈 261121 · 피그마 «Halftone» 플러그인 결).
 * 점 격자를 angle 만큼 돌려 깔고, 칸 가운데의 밝기로 점 크기를 정한다(어두울수록 큼 · 넓이 비례 = r ∝ √(1−밝기)).
 * 길이 단위 = 블럭 px(그리는 쪽이 배율 S 를 곱한다). 그리기(캔버스)는 js/effects-halftone.js.
 * 색 기본값은 이름 색('white')과 'image'(원본 색) — JS hex 리터럴 래칫(scripts/check-design-tokens.sh ③ JS_COLOR)을 늘리지 않는다.
 */
export const HT_SHAPES = Object.freeze(['circle', 'square', 'line']);
export const HT_RANGES = Object.freeze({ size: [1, 40], gap: [3, 60], angle: [0, 90] });
export const HT_DEFAULTS = Object.freeze({ size: 8, gap: 10, angle: 45, shape: 'circle', color: 'image', bg: 'white' });

const HEX6 = /^#[0-9a-f]{6}$/i;
const num = (v, [lo, hi], d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };

/** 소독 — 남이 준 저장본에서도 올 수 있다: 숫자는 범위 안 정수 · 모양은 허용 목록 · 색은 'image' 또는 #rrggbb · 바탕은 'none'·'white'·#rrggbb. */
export function normHalftone(o) {
  const s = o && typeof o === 'object' ? o : {};
  const D = HT_DEFAULTS, R = HT_RANGES;
  return {
    size: num(s.size, R.size, D.size),
    gap: num(s.gap, R.gap, D.gap),
    angle: num(s.angle, R.angle, D.angle),
    shape: HT_SHAPES.includes(s.shape) ? s.shape : D.shape,
    color: s.color === 'image' || (typeof s.color === 'string' && HEX6.test(s.color)) ? (s.color === 'image' ? 'image' : s.color.toLowerCase()) : D.color,
    bg: s.bg === 'none' || s.bg === 'white' || (typeof s.bg === 'string' && HEX6.test(s.bg)) ? (HEX6.test(s.bg) ? s.bg.toLowerCase() : s.bg) : D.bg,
  };
}

/** data-halftone 글 → 옵션(깨진 JSON = null). */
export function parseHalftone(str) {
  if (typeof str !== 'string' || !str) return null;
  try { return normHalftone(JSON.parse(str)); } catch (_) { return null; }
}
export const serializeHalftone = (o) => JSON.stringify(normHalftone(o));

/** 점 목록 — lumAt(x,y) → 0(검정)..1(흰/투명). 돌린 격자 칸 가운데마다 { x, y, r }(r=0 은 뺀다).
 *  w·h = 그릴 판 크기(블럭 px) · 판 밖으로 반 칸까지 덮어 가장자리가 비지 않게. */
export function halftoneDots(lumAt, w, h, opts) {
  const { size, gap, angle } = normHalftone(opts);
  const a = (angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const R = Math.hypot(w, h) / 2 + gap, cx = w / 2, cy = h / 2, n = Math.ceil(R / gap);
  const out = [];
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const u = i * gap, v = j * gap, x = cx + u * c - v * s, y = cy + u * s + v * c;
    if (x < -gap / 2 || y < -gap / 2 || x > w + gap / 2 || y > h + gap / 2) continue;
    const L = Math.max(0, Math.min(1, lumAt(Math.max(0, Math.min(w - 1e-6, x)), Math.max(0, Math.min(h - 1e-6, y)))));
    const r = (size / 2) * Math.sqrt(1 - L);
    if (r > 0.05) out.push({ x, y, r });
  }
  return out;
}

/** 밝기(0..1) — sRGB 가중 + 투명은 흰 종이로 본다(점 없음). */
export const lumOf = (r, g, b, a = 255) => 1 - (a / 255) * (1 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255);

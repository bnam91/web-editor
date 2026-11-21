/* fx/holo-palette.js — 홀로그램(무지갯빛) 색 정본 · FX-GRADIENT-GAZE-01(현빈 261121 · 가안 = «계산 그라데이션»).
 *   배지 .badge-hologram-* 의 conic 7색(css/editor-blocks.css --holo-c1..c7)과 «홀로그램» 효과 식구가 같은 색을 쓴다.
 *   CSS 쪽 값과 이 표가 같은지는 tests/unit/holo-palette.test.mjs 가 CSS 를 읽어 잰다(두 벌이 갈라지면 빨강).
 *   정지 각도 = 배지와 같은 0·40·90·140·200·250·310·360(마지막 = 첫 색 · 고리).
 *   ESM · DOM 0(js/fx/package.json "type":"module").
 */
export const HOLO_STOP_DEG = Object.freeze([0, 40, 90, 140, 200, 250, 310, 360]);
export const HOLO_FROM_DEG = 210;
export const HOLO_PRESETS = Object.freeze({
  silver: Object.freeze(['#f0e8dc', '#ffe8f0', '#ccddc0', '#ebe0f5', '#b8acc8', '#ffffff', '#c8b8e0']),   // 배지 기본
  gold:   Object.freeze(['#d4a956', '#fff3c2', '#b8821a', '#f0d088', '#a87420', '#ffefa0', '#b88830']),   // 배지 color-gold
  rose:   Object.freeze(['#e0a8a0', '#ffe0d8', '#c88478', '#f0c8c0', '#b07060', '#ffe8e0', '#c08878']),   // 배지 color-rose
  pearl:  Object.freeze(['#f0d8f5', '#fff0fa', '#c8b0e5', '#fdd8f0', '#a890c8', '#ffffff', '#d8a8e5']),   // 배지 color-pearl
  aurora: Object.freeze(['#7ef0d0', '#a0c4ff', '#e3a8ff', '#ffd6a0', '#9bf6ff', '#ffffff', '#caffbf']),   // 새로(효과용) — 민트·하늘·보라·살구
  oil:    Object.freeze(['#3b2e5a', '#5ad1c8', '#f5a3c7', '#f9e27d', '#6b8cff', '#e8f6ff', '#8e5bd8']),   // 새로(효과용) — 기름막처럼 짙은 바탕
});
export const HOLO_KEYS = Object.freeze(Object.keys(HOLO_PRESETS));

/** conic-gradient 글(CSS) — from = 시작각(deg) · 프리셋 이름이 틀리면 silver. */
export function holoConicCss(preset, from = HOLO_FROM_DEG) {
  const c = HOLO_PRESETS[preset] || HOLO_PRESETS.silver;
  const stops = HOLO_STOP_DEG.map((d, i) => `${c[i % c.length]} ${d}deg`);
  return `conic-gradient(from ${Number(from) || 0}deg at 50% 50%, ${stops.join(', ')})`;
}
/** Figma GRADIENT_ANGULAR 정지점(0..1) — 같은 색·같은 각도 비. */
export function holoAngularStops(preset) {
  const c = HOLO_PRESETS[preset] || HOLO_PRESETS.silver;
  return HOLO_STOP_DEG.map((d, i) => ({ position: d / 360, color: c[i % c.length] }));
}

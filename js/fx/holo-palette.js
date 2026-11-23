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

/* ═══ FX-GRADIENT-GAZE-01 — 색 고르기·Effects «홀로그램» 프리셋 16 정본 ═══
 * ★GradientGaze 16 값 재현(미카사 261123 실측 · handoff/MIKASA-holo-noise-261123/notes.md ①) — 현빈 261123 «처음엔 똑같이»(앞 판의 «IP 라 안 옮김»은 거둠).
 *   순서 = 플러그인 격자 1~16 · 홀수 = Linear 90°(0% 왼쪽) · 짝수 = Angular(우리 conic · 시작 = 3시 = 90° · 시계 방향) · 정지점 위치 %·HEX 그대로 · 불투명도 전부 100.
 * ★key = 옛 이름 그대로(블럭 data-fx-holo 의 k 로 저장된다 — 옛 저장본이 같은 칸을 찾게) · 보이는 이름 = name «Holo NN»(현빈 261123).
 *   이미 넣은 블럭의 칠은 넣을 때 블럭에 정지점째 박혀 있어 이 표가 바뀌어도 무변(다시 고를 때만 새 값).
 * 꼴: { key, name, type: 'linear' | 'conic', stops: [[#rrggbb, 0..1], …] } · 처음 6종 배지 팔레트 고리(HOLO_PRESETS)는 배지 전용으로 그대로(이 표와 따로). */
export const GAZE_CONIC_FROM = 90;   // Angular 시작 = 3시(Figma Angular 0% = 오른쪽 · 미카사 실측) — 스와치·새로 넣는 conic 의 시작각
export const GAZE_PRESETS = Object.freeze([
  { key: 'silver', name: 'Holo 01', type: 'linear', stops: [['#b6d0f7', 0], ['#eef4e1', 0.14], ['#fafcfe', 0.28], ['#e2c1f9', 0.42], ['#bfd1f9', 0.57], ['#fafcfe', 0.71], ['#bae4e2', 0.85], ['#8c6be3', 1]] },   // GradientGaze #1 Linear
  { key: 'gold', name: 'Holo 02', type: 'conic', stops: [['#b6d0f7', 0], ['#eef4e1', 0.15], ['#fafcfe', 0.3], ['#e2c1f9', 0.45], ['#bfd1f9', 0.58], ['#fafcfe', 0.75], ['#bae4e2', 0.85], ['#b6d0f7', 1]] },   // GradientGaze #2 Angular
  { key: 'rose', name: 'Holo 03', type: 'linear', stops: [['#50e6c1', 0], ['#60abed', 0.15], ['#985be7', 0.3], ['#f057a2', 0.45], ['#fba2c6', 0.58], ['#fffaea', 0.75], ['#ffc169', 1]] },   // GradientGaze #3 Linear
  { key: 'pearl', name: 'Holo 04', type: 'conic', stops: [['#ffc169', 0], ['#50e6c1', 0.15], ['#e2f1ff', 0.3], ['#985be7', 0.45], ['#f057a2', 0.58], ['#fba2c6', 0.75], ['#fffaea', 0.85], ['#ffc169', 1]] },   // GradientGaze #4 Angular
  { key: 'aurora', name: 'Holo 05', type: 'linear', stops: [['#fec6b4', 0], ['#b6d0f7', 0.25], ['#e2c1f9', 0.5], ['#f1f9bf', 0.75], ['#fafcfe', 1]] },   // GradientGaze #5 Linear
  { key: 'oil', name: 'Holo 06', type: 'conic', stops: [['#b6d0f7', 0], ['#f1f9bf', 0.15], ['#e2c1f9', 0.3], ['#fec6b4', 0.45], ['#fafcfe', 0.58], ['#b6d0f7', 1]] },   // GradientGaze #6 Angular
  { key: 'mist', name: 'Holo 07', type: 'linear', stops: [['#80b1a7', 0], ['#eef4e1', 0.33], ['#fafcfe', 0.66], ['#fae4ff', 1]] },   // GradientGaze #7 Linear
  { key: 'sunset', name: 'Holo 08', type: 'conic', stops: [['#eef4e1', 0], ['#80b1a7', 0.2], ['#fafcfe', 0.4], ['#fae4ff', 0.6], ['#f0f8f6', 0.8], ['#eef4e1', 1]] },   // GradientGaze #8 Angular
  { key: 'mint', name: 'Holo 09', type: 'linear', stops: [['#b6d0f7', 0], ['#c5c1f9', 0.2], ['#fafcfe', 0.4], ['#bff6f9', 0.6], ['#ccbae4', 0.8], ['#b6d0f7', 1]] },   // GradientGaze #9 Linear
  { key: 'chrome', name: 'Holo 10', type: 'conic', stops: [['#b6d0f7', 0], ['#c5c1f9', 0.2], ['#fafcfe', 0.4], ['#bff6f9', 0.6], ['#ccbae4', 0.8], ['#b6d0f7', 1]] },   // GradientGaze #10 Angular
  { key: 'neon', name: 'Holo 11', type: 'linear', stops: [['#9156ca', 0], ['#f8bdda', 0.14], ['#afc8b9', 0.28], ['#3498bb', 0.42], ['#10ecaf', 0.57], ['#4441b3', 0.71], ['#fcb3f4', 0.85], ['#9156ca', 1]] },   // GradientGaze #11 Linear
  { key: 'pastel', name: 'Holo 12', type: 'conic', stops: [['#9156ca', 0], ['#f8bdda', 0.14], ['#afc8b9', 0.28], ['#3498bb', 0.42], ['#10ecaf', 0.57], ['#4441b3', 0.71], ['#fcb3f4', 0.85], ['#9156ca', 1]] },   // GradientGaze #12 Angular
  { key: 'prism', name: 'Holo 13', type: 'linear', stops: [['#e2c1f9', 0], ['#febd8e', 0.33], ['#fbffe4', 0.66], ['#b6d0f7', 1]] },   // GradientGaze #13 Linear
  { key: 'slick', name: 'Holo 14', type: 'conic', stops: [['#e2c1f9', 0], ['#febd8e', 0.25], ['#fbffe4', 0.5], ['#b6d0f7', 0.75], ['#e2c1f9', 1]] },   // GradientGaze #14 Angular
  { key: 'opal', name: 'Holo 15', type: 'linear', stops: [['#e2c1f9', 0], ['#f0fffa', 0.33], ['#fbffe4', 0.66], ['#fedafb', 1]] },   // GradientGaze #15 Linear
  { key: 'goldswirl', name: 'Holo 16', type: 'conic', stops: [['#e2c1f9', 0], ['#f0fffa', 0.25], ['#fbffe4', 0.5], ['#fedafb', 0.75], ['#e2c1f9', 1]] },   // GradientGaze #16 Angular
]);
/** 스와치 미리보기 CSS — 그 종류 그대로(linear 90° · conic = GAZE_CONIC_FROM 3시 시작). */
export function gazeSwatchCss(p) {
  const parts = p.stops.map(([c, o]) => `${c} ${Math.round(o * 100)}%`).join(', ');
  return p.type === 'conic' ? `conic-gradient(from ${GAZE_CONIC_FROM}deg at 50% 50%, ${parts})` : `linear-gradient(90deg, ${parts})`;
}

/* ── 세기 = «덮는 정도»(미카사 채점 261121 ③ · 지디 승인): 홀로 정지점 색을 «넣기 전 칠» 위에 a% 로 얹은 결과 색 —
 *   0 = 넣기 전 칠 · 100 = 홀로 그대로 · 결과는 여전히 정지점 목록 한 벌(그라데이션 칠 한 장).
 *   base = null(넣기 전 칠 모름 · 투명) → 옛 셈(정지점 투명도 = a) · {solid:색} → 알파 합성과 같은 셈(정확) ·
 *   {stops:[{color, offset 0..1, opacity?}]} → 넣기 전 그라데이션을 «홀로 정지점 자리(offset)»에서 표본.
 *   shortcut: 넣기 전 그라데이션의 꼴·각도가 홀로와 다르면(예: 선형 위 원뿔) 같은 offset ≠ 같은 화면 자리 — 근사다(DOM 이 근사 정도를 수로 남긴다). 정확해야 하면 칠을 두 겹으로. */
const _rgba = (c) => {
  const s = String(c || '').trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) { let h = m[1]; if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join(''); if (h.length !== 6 && h.length !== 8) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1]; }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(s);
  if (m) { const a = m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return [+m[1], +m[2], +m[3], a]; }
  return null;
};
const _hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** 정지점 목록을 t(0..1)에서 표본 — [r,g,b,a] · 정지점 opacity 를 a 에 곱한다 · 못 읽으면 null. */
export function sampleStops(stops, t) {
  const st = (Array.isArray(stops) ? stops : []).map((x) => { const c = _rgba(x && x.color); return c ? { o: Number(x.offset) || 0, c: [c[0], c[1], c[2], c[3] * (x.opacity == null ? 1 : Number(x.opacity))] } : null; }).filter(Boolean).sort((a, b) => a.o - b.o);
  if (!st.length) return null;
  if (t <= st[0].o) return st[0].c;
  for (let i = 1; i < st.length; i++) if (t <= st[i].o) { const a = st[i - 1], b = st[i], f = b.o === a.o ? 0 : (t - a.o) / (b.o - a.o); return a.c.map((v, j) => v + (b.c[j] - v) * f); }
  return st[st.length - 1].c;
}
/** 홀로 정지점([색, offset]) + 세기 a(0..100) + 넣기 전 칠 base → 그라데이션 모델 정지점 [{color, offset, opacity}]. */
export function holoMixStops(stops, a, base) {
  const k = Math.max(0, Math.min(100, Number(a))) / 100;
  return stops.map(([color, offset]) => {
    const h = _rgba(color);
    const b = !base ? null : base.solid != null ? _rgba(base.solid) : sampleStops(base.stops, offset);
    if (!h || !b) return { color, offset, opacity: k };   // 넣기 전 칠 모름 = 옛 셈(투명도)
    const oa = k + b[3] * (1 - k);
    const mix = (j) => (oa ? (h[j] * k + b[j] * b[3] * (1 - k)) / oa : 0);
    return { color: _hex(mix(0), mix(1), mix(2)), offset, opacity: Math.round(oa * 1000) / 1000 };
  });
}
